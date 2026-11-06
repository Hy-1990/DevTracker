//! Loopback-only API. The serving thread belongs to the desktop process.
use rusqlite::{params_from_iter, types::Value as SqlValue, Connection};
use serde_json::{json, Map, Value};
use std::io::{Read, Write};

const TABLES: &[&str] = &[
    "boards",
    "projects",
    "members",
    "tasks",
    "task_assignees",
    "task_testers",
];
type ApiResult = Result<(u16, Value), (u16, String)>;

fn bad(message: impl ToString) -> (u16, String) {
    (400, message.to_string())
}
fn sql_error(error: rusqlite::Error) -> (u16, String) {
    if let rusqlite::Error::SqliteFailure(ref e, _) = error {
        if e.code == rusqlite::ErrorCode::ConstraintViolation {
            return (409, error.to_string());
        }
        if e.code == rusqlite::ErrorCode::DatabaseBusy {
            return (503, "Database busy; retry later".into());
        }
    }
    (500, "Database operation failed".into())
}

pub fn start() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let token_path = crate::db::get_db_path().with_file_name("api-token");
    let token = if token_path.exists() {
        std::fs::read_to_string(&token_path)?.trim().to_owned()
    } else {
        let mut bytes = [0u8; 32];
        getrandom::getrandom(&mut bytes).map_err(|e| std::io::Error::other(e.to_string()))?;
        let token: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        options.open(&token_path)?.write_all(token.as_bytes())?;
        token
    };
    if token.len() < 32 {
        return Err("API token must contain at least 32 characters".into());
    }
    let server = tiny_http::Server::http("127.0.0.1:17863")?;
    std::thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let authorization = request
                .headers()
                .iter()
                .find(|h| h.field.equiv("Authorization"));
            let expected = format!("Bearer {token}");
            let result = if request.headers().iter().any(|h| h.field.equiv("Origin")) {
                Err((403, "Browser-origin requests are not supported".into()))
            } else if authorization.map(|h| h.value.as_str()) != Some(expected.as_str()) {
                Err((401, "Bearer token required".into()))
            } else {
                let method = request.method().as_str().to_owned();
                let uri = request.url().to_owned();
                let mut body = Vec::new();
                match request.as_reader().take(1_048_577).read_to_end(&mut body) {
                    Ok(_) if body.len() > 1_048_576 => Err((413, "Body exceeds 1 MiB".into())),
                    Err(_) => Err(bad("Cannot read request body")),
                    _ => crate::db::open_db().map_err(sql_error).and_then(|conn| {
                        conn.busy_timeout(std::time::Duration::from_secs(3))
                            .map_err(sql_error)?;
                        handle(&conn, &method, &uri, &body)
                    }),
                }
            };
            let (status, value) =
                result.unwrap_or_else(|(status, message)| (status, json!({"error":message})));
            let response = tiny_http::Response::from_string(value.to_string())
                .with_status_code(status)
                .with_header(
                    tiny_http::Header::from_bytes(
                        "Content-Type",
                        "application/json; charset=utf-8",
                    )
                    .unwrap(),
                )
                .with_header(tiny_http::Header::from_bytes("Cache-Control", "no-store").unwrap());
            let _ = request.respond(response);
        }
    });
    Ok(())
}

fn columns(conn: &Connection, table: &str) -> Result<Vec<(String, bool)>, (u16, String)> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(sql_error)?;
    let rows = stmt
        .query_map([], |row| Ok((row.get(1)?, row.get::<_, i64>(5)? > 0)))
        .map_err(sql_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)
}

fn read_rows(
    conn: &Connection,
    sql: &str,
    values: &[SqlValue],
) -> Result<Vec<Value>, (u16, String)> {
    let mut stmt = conn.prepare(sql).map_err(sql_error)?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let rows = stmt
        .query_map(params_from_iter(values), |row| {
            let mut object = Map::new();
            for (index, name) in names.iter().enumerate() {
                let value: SqlValue = row.get(index)?;
                object.insert(
                    name.clone(),
                    match value {
                        SqlValue::Null => Value::Null,
                        SqlValue::Integer(n) => json!(n),
                        SqlValue::Real(n) => json!(n),
                        SqlValue::Text(s) => json!(s),
                        SqlValue::Blob(_) => Value::Null,
                    },
                );
            }
            Ok(Value::Object(object))
        })
        .map_err(sql_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)
}

fn scalar(value: &Value) -> Result<SqlValue, (u16, String)> {
    Ok(match value {
        Value::Null => SqlValue::Null,
        Value::Bool(v) => SqlValue::Integer(i64::from(*v)),
        Value::Number(n) => {
            if let Some(v) = n.as_i64() {
                SqlValue::Integer(v)
            } else {
                SqlValue::Real(n.as_f64().ok_or_else(|| bad("Invalid number"))?)
            }
        }
        Value::String(s) => SqlValue::Text(s.clone()),
        _ => return Err(bad("Fields must be scalar JSON values")),
    })
}

fn validate_tasks(conn: &Connection) -> Result<(), (u16, String)> {
    let invalid: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM tasks c JOIN tasks p ON p.id=c.parent_id WHERE c.id=p.id OR c.board_id!=p.board_id OR p.parent_id IS NOT NULL)", [], |r| r.get(0)).map_err(sql_error)?;
    if invalid {
        return Err((409,"Tasks require a top-level parent in the same board; cycles and nested subtasks are not allowed".into()));
    }
    Ok(())
}

fn handle(conn: &Connection, method: &str, uri: &str, body: &[u8]) -> ApiResult {
    let url = url::Url::parse(&format!("http://localhost{uri}")).map_err(bad)?;
    let path: Vec<_> = url.path().trim_matches('/').split('/').collect();
    if method == "GET" && path == ["api", "v1", "health"] {
        return Ok((200, json!({"status":"ok","version":1})));
    }
    if method == "GET" && path == ["api", "v1", "schema"] {
        let mut schema = Map::new();
        for table in TABLES {
            let fields = read_rows(conn, &format!("PRAGMA table_info({table})"), &[])?;
            schema.insert(table.to_string(), json!({"columns":fields}));
        }
        return Ok((200, json!({"data":schema})));
    }
    if path.len() < 3 || path[0..2] != ["api", "v1"] || !TABLES.contains(&path[2]) {
        return Err((404, "Unknown endpoint".into()));
    }
    let table = path[2];
    let fields = columns(conn, table)?;
    let keys: Vec<_> = fields
        .iter()
        .filter(|(_, pk)| *pk)
        .map(|(name, _)| name.as_str())
        .collect();
    let item = path.len() > 3;
    if item && path.len() != 3 + keys.len() {
        return Err(bad("Incorrect primary key path"));
    }
    let mut values = Vec::new();
    let mut predicates = Vec::new();
    if item {
        for (key, id) in keys.iter().zip(&path[3..]) {
            values.push(SqlValue::Integer(id.parse::<i64>().map_err(bad)?));
            predicates.push(format!("{key} = ?"));
        }
    }
    let mut limit = 100i64;
    let mut offset = 0i64;
    for (name, value) in url.query_pairs() {
        if method != "GET" || item {
            return Err(bad("Query parameters are supported only on collection GET"));
        }
        match name.as_ref() {
            "limit" => {
                limit = value.parse().map_err(bad)?;
                if !(1..=1000).contains(&limit) {
                    return Err(bad("limit must be 1..1000"));
                }
            }
            "offset" => {
                offset = value.parse().map_err(bad)?;
                if offset < 0 {
                    return Err(bad("offset must be nonnegative"));
                }
            }
            name if fields.iter().any(|(f, _)| f == name) => {
                predicates.push(format!("{name} = ?"));
                values.push(SqlValue::Text(value.into_owned()));
            }
            _ => return Err(bad("Unknown filter field")),
        }
    }
    let condition = if predicates.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", predicates.join(" AND "))
    };
    if method == "GET" {
        let sql = format!(
            "SELECT * FROM {table}{condition} ORDER BY {} LIMIT {limit} OFFSET {offset}",
            keys.join(",")
        );
        let rows = read_rows(conn, &sql, &values)?;
        if item {
            return rows
                .into_iter()
                .next()
                .map(|r| (200, json!({"data":r})))
                .ok_or((404, "Record not found".into()));
        }
        return Ok((200, json!({"data":rows,"limit":limit,"offset":offset})));
    }
    if !matches!(
        (method, item),
        ("POST", false) | ("PATCH", true) | ("DELETE", true)
    ) {
        return Err((405, "Use GET/POST collection, GET/PATCH/DELETE item".into()));
    }
    let object = if method == "DELETE" {
        Map::new()
    } else {
        serde_json::from_slice::<Value>(body)
            .map_err(bad)?
            .as_object()
            .cloned()
            .ok_or_else(|| bad("Expected a JSON object"))?
    };
    if method != "DELETE" && object.is_empty() {
        return Err(bad("Provide at least one field"));
    }
    for name in object.keys() {
        if !fields.iter().any(|(f, _)| f == name)
            || name == "created_at"
            || name == "updated_at"
            || name == "id"
        {
            return Err(bad(format!("Unknown or read-only field: {name}")));
        }
    }
    let tx = conn.unchecked_transaction().map_err(sql_error)?;
    let response = if method == "DELETE" {
        let changed = tx
            .execute(
                &format!("DELETE FROM {table}{condition}"),
                params_from_iter(&values),
            )
            .map_err(sql_error)?;
        if changed == 0 {
            return Err((404, "Record not found".into()));
        }
        json!({"deleted":changed})
    } else {
        let names: Vec<_> = object.keys().cloned().collect();
        let mut write_values: Vec<_> = object.values().map(scalar).collect::<Result<_, _>>()?;
        if method == "POST" {
            let slots = vec!["?"; names.len()].join(",");
            tx.execute(
                &format!("INSERT INTO {table} ({}) VALUES ({slots})", names.join(",")),
                params_from_iter(&write_values),
            )
            .map_err(sql_error)?;
            let id = tx.last_insert_rowid();
            json!({"data":read_rows(&tx,&format!("SELECT * FROM {table} WHERE rowid=?"),&[SqlValue::Integer(id)])?[0]})
        } else {
            let mut assignments: Vec<_> = names.iter().map(|n| format!("{n}=?")).collect();
            if table == "tasks" {
                assignments.push("updated_at=datetime('now')".into());
            }
            write_values.extend(values.clone());
            let rows = read_rows(
                &tx,
                &format!(
                    "UPDATE {table} SET {}{condition} RETURNING *",
                    assignments.join(",")
                ),
                &write_values,
            )?;
            if rows.is_empty() {
                return Err((404, "Record not found".into()));
            }
            json!({"data":rows[0]})
        }
    };
    if table == "tasks" {
        validate_tasks(&tx)?;
    }
    tx.commit().map_err(sql_error)?;
    Ok((if method == "POST" { 201 } else { 200 }, response))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_tables_support_crud_and_relationship_updates() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON").unwrap();
        crate::db::init_db(&conn).unwrap();
        for (table, body) in [
            ("boards", r#"{"name":"Demo","year_month":"2026-11"}"#),
            ("members", r#"{"name":"Dev"}"#),
            ("projects", r#"{"name":"Demo"}"#),
            ("tasks", r#"{"board_id":1,"project_id":1}"#),
            ("task_assignees", r#"{"task_id":1,"member_id":1}"#),
            ("task_testers", r#"{"task_id":1,"member_id":1}"#),
        ] {
            let base = format!("/api/v1/{table}");
            assert_eq!(
                handle(&conn, "POST", &base, body.as_bytes()).unwrap().0,
                201
            );
            assert_eq!(
                handle(&conn, "GET", &base, b"").unwrap().1["data"]
                    .as_array()
                    .unwrap()
                    .len(),
                1
            );
            let item = format!(
                "{base}/{}",
                if table.starts_with("task_") {
                    "1/1"
                } else {
                    "1"
                }
            );
            assert_eq!(handle(&conn, "GET", &item, b"").unwrap().0, 200);
            let patch = if table.starts_with("task_") {
                r#"{"member_id":1}"#
            } else {
                r#"{"name":"Changed"}"#
            };
            assert_eq!(
                handle(&conn, "PATCH", &item, patch.as_bytes()).unwrap().0,
                200
            );
        }
        handle(&conn, "POST", "/api/v1/members", br#"{"name":"Other"}"#).unwrap();
        handle(
            &conn,
            "PATCH",
            "/api/v1/task_assignees/1/1",
            br#"{"member_id":2}"#,
        )
        .unwrap();
        assert_eq!(
            handle(&conn, "GET", "/api/v1/task_assignees/1/1", b"")
                .unwrap_err()
                .0,
            404
        );
        assert_eq!(
            handle(&conn, "GET", "/api/v1/task_assignees/1/2", b"")
                .unwrap()
                .1["data"]["member_id"],
            2
        );
        assert_eq!(
            handle(&conn, "DELETE", "/api/v1/projects/1", b"")
                .unwrap_err()
                .0,
            409
        );
        for path in [
            "task_assignees/1/2",
            "task_testers/1/1",
            "tasks/1",
            "projects/1",
            "members/1",
            "boards/1",
        ] {
            assert_eq!(
                handle(&conn, "DELETE", &format!("/api/v1/{path}"), b"")
                    .unwrap()
                    .0,
                200
            );
        }
        assert_eq!(
            handle(&conn, "GET", "/api/v1/sqlite_master", b"")
                .unwrap_err()
                .0,
            404
        );
    }
    #[test]
    fn crud_and_hierarchy_are_atomic() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON").unwrap();
        crate::db::init_db(&conn).unwrap();
        assert_eq!(
            handle(
                &conn,
                "POST",
                "/api/v1/boards",
                br#"{"name":"Demo","year_month":"2026-11"}"#
            )
            .unwrap()
            .0,
            201
        );
        handle(
            &conn,
            "POST",
            "/api/v1/tasks",
            br#"{"board_id":1,"name":"Parent"}"#,
        )
        .unwrap();
        handle(
            &conn,
            "POST",
            "/api/v1/tasks",
            br#"{"board_id":1,"parent_id":1,"name":"Child"}"#,
        )
        .unwrap();
        assert_eq!(
            handle(&conn, "PATCH", "/api/v1/tasks/1", br#"{"parent_id":2}"#)
                .unwrap_err()
                .0,
            409
        );
        assert!(
            handle(&conn, "GET", "/api/v1/tasks/1", b"").unwrap().1["data"]["parent_id"].is_null()
        );
        assert_eq!(
            handle(&conn, "GET", "/api/v1/tasks?board_id=1&limit=1", b"")
                .unwrap()
                .1["data"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            handle(&conn, "PATCH", "/api/v1/tasks/1", br#"{"unknown":1}"#)
                .unwrap_err()
                .0,
            400
        );
        handle(&conn, "DELETE", "/api/v1/boards/1", b"").unwrap();
        assert_eq!(
            handle(&conn, "GET", "/api/v1/tasks/2", b"").unwrap_err().0,
            404
        );
    }
}
