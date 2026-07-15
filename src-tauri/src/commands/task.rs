use crate::db::open_db;
use crate::models::*;
use rusqlite::params;

fn get_members_for_task(
    conn: &rusqlite::Connection,
    task_id: i64,
    table: &str,
) -> Result<Vec<Member>, String> {
    let sql = format!(
        "SELECT m.id, m.name, m.role, m.created_at FROM members m
         JOIN {} t ON t.member_id = m.id
         WHERE t.task_id = ?1 ORDER BY m.name",
        table
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([task_id], |row| {
            Ok(Member {
                id: row.get(0)?,
                name: row.get(1)?,
                role: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let result: Vec<Member> = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(result)
}

fn get_member(
    conn: &rusqlite::Connection,
    member_id: Option<i64>,
) -> Result<Option<Member>, String> {
    match member_id {
        None => Ok(None),
        Some(mid) => {
            let result = conn.query_row(
                "SELECT id, name, role, created_at FROM members WHERE id = ?1",
                [mid],
                |row| {
                    Ok(Member {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        role: row.get(2)?,
                        created_at: row.get(3)?,
                    })
                },
            );
            match result {
                Ok(m) => Ok(Some(m)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.to_string()),
            }
        }
    }
}

fn get_project(
    conn: &rusqlite::Connection,
    project_id: Option<i64>,
) -> Result<Option<Project>, String> {
    match project_id {
        None => Ok(None),
        Some(pid) => {
            let result = conn.query_row(
                "SELECT id, name, created_at FROM projects WHERE id = ?1",
                [pid],
                |row| {
                    Ok(Project {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        created_at: row.get(2)?,
                    })
                },
            );
            match result {
                Ok(p) => Ok(Some(p)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.to_string()),
            }
        }
    }
}

fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    let progress_auto_int: i32 = row.get(16)?;
    let sp: Option<f64> = row.get(17)?;
    Ok(Task {
        id: row.get(0)?,
        board_id: row.get(1)?,
        parent_id: row.get(2)?,
        name: row.get(3)?,
        description: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
        status: row.get(5)?,
        priority: row.get(6)?,
        task_type: row.get(7)?,
        project_id: row.get(8)?,
        owner_id: row.get(9)?,
        start_date: row.get(10)?,
        estimated_test_date: row.get(11)?,
        actual_test_date: row.get(12)?,
        estimated_release_date: row.get(13)?,
        completion_date: row.get(14)?,
        progress: row.get(15)?,
        progress_auto: progress_auto_int == 1,
        story_points: sp.unwrap_or(1.0),
        quality_rating: row.get(18)?,
        latest_note: row.get::<_, Option<String>>(19)?.unwrap_or_default(),
        created_at: row.get(20)?,
        updated_at: row.get(21)?,
    })
}

const TASK_SELECT: &str =
    "SELECT id, board_id, parent_id, name, description, status, priority, type,
    project_id, owner_id, start_date, estimated_test_date, actual_test_date,
    estimated_release_date, completion_date, progress, progress_auto,
    story_points, quality_rating, latest_note, created_at, updated_at FROM tasks";

fn query_tasks(
    conn: &rusqlite::Connection,
    sql: &str,
    params: &[&dyn rusqlite::types::ToSql],
) -> Result<Vec<Task>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params, row_to_task)
        .map_err(|e| e.to_string())?;
    let tasks: Vec<Task> = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(tasks)
}

fn build_task_with_relations(
    conn: &rusqlite::Connection,
    task: Task,
    include_children: bool,
) -> Result<TaskWithRelations, String> {
    let assignees = get_members_for_task(conn, task.id, "task_assignees")?;
    let testers = get_members_for_task(conn, task.id, "task_testers")?;
    let project = get_project(conn, task.project_id)?;
    let owner = get_member(conn, task.owner_id)?;

    let children = if include_children {
        let sql = format!("{} WHERE parent_id = ?1 ORDER BY id", TASK_SELECT);
        let child_tasks = query_tasks(conn, &sql, &[&task.id])?;
        child_tasks
            .into_iter()
            .map(|ct| build_task_with_relations(conn, ct, false))
            .collect::<Result<Vec<_>, _>>()?
    } else {
        vec![]
    };

    Ok(TaskWithRelations {
        task,
        project,
        assignees,
        testers,
        owner,
        children,
    })
}

#[tauri::command]
pub fn list_tasks(
    board_id: i64,
    filters: Option<TaskFilters>,
) -> Result<Vec<TaskWithRelations>, String> {
    let conn = open_db().map_err(|e| e.to_string())?;

    let mut where_clauses = vec!["board_id = ?1".to_string(), "parent_id IS NULL".to_string()];
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(board_id)];
    let mut param_idx = 2;

    if let Some(ref f) = filters {
        if let Some(ref statuses) = f.status {
            if !statuses.is_empty() {
                let placeholders: Vec<String> = statuses
                    .iter()
                    .map(|_| {
                        let p = format!("?{}", param_idx);
                        param_idx += 1;
                        p
                    })
                    .collect();
                where_clauses.push(format!("status IN ({})", placeholders.join(",")));
                for s in statuses {
                    param_values.push(Box::new(s.clone()));
                }
            }
        }
        if let Some(ref priorities) = f.priority {
            if !priorities.is_empty() {
                let placeholders: Vec<String> = priorities
                    .iter()
                    .map(|_| {
                        let p = format!("?{}", param_idx);
                        param_idx += 1;
                        p
                    })
                    .collect();
                where_clauses.push(format!("priority IN ({})", placeholders.join(",")));
                for p in priorities {
                    param_values.push(Box::new(p.clone()));
                }
            }
        }
        if let Some(pid) = f.project_id {
            where_clauses.push(format!("project_id = ?{}", param_idx));
            param_idx += 1;
            param_values.push(Box::new(pid));
        }
        if let Some(aid) = f.assignee_id {
            where_clauses.push(format!(
                "id IN (SELECT task_id FROM task_assignees WHERE member_id = ?{})",
                param_idx
            ));
            let _ = param_idx;
            param_values.push(Box::new(aid));
        }
    }

    let sql = format!(
        "{} WHERE {} ORDER BY CASE status
            WHEN '已停滞' THEN 1 WHEN '待开始' THEN 2
            WHEN '进行中' THEN 3 WHEN '待上线' THEN 4
            WHEN '已完成' THEN 5 END, id",
        TASK_SELECT,
        where_clauses.join(" AND ")
    );

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();
    let tasks = query_tasks(&conn, &sql, params_refs.as_slice())?;

    tasks
        .into_iter()
        .map(|t| build_task_with_relations(&conn, t, true))
        .collect()
}

/// 日报：跨所有看板按日期查任务（完成日期或实际提测日期命中），含子任务，平铺返回
#[tauri::command]
pub fn list_tasks_by_date(date: String) -> Result<Vec<TaskWithRelations>, String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    let sql = format!(
        "{} WHERE completion_date = ?1 OR actual_test_date = ?1 ORDER BY id",
        TASK_SELECT
    );
    let tasks = query_tasks(&conn, &sql, &[&date])?;
    tasks
        .into_iter()
        .map(|t| build_task_with_relations(&conn, t, false))
        .collect()
}

/// 周报：跨所有看板查完成日期在 [start, end] 内的任务，平铺返回
#[tauri::command]
pub fn list_tasks_completed_between(
    start: String,
    end: String,
) -> Result<Vec<TaskWithRelations>, String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    let sql = format!(
        "{} WHERE completion_date >= ?1 AND completion_date <= ?2 ORDER BY id",
        TASK_SELECT
    );
    let tasks = query_tasks(&conn, &sql, &[&start, &end])?;
    tasks
        .into_iter()
        .map(|t| build_task_with_relations(&conn, t, false))
        .collect()
}

/// 周报：查月份区间（YYYY-MM 字典序）看板下进行中/待上线的任务，平铺返回
#[tauri::command]
pub fn list_unfinished_tasks(
    start_month: String,
    end_month: String,
) -> Result<Vec<TaskWithRelations>, String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    let sql = format!(
        "{} WHERE board_id IN (SELECT id FROM boards WHERE year_month >= ?1 AND year_month <= ?2)
         AND status IN ('进行中', '待上线') ORDER BY id",
        TASK_SELECT
    );
    let tasks = query_tasks(&conn, &sql, &[&start_month, &end_month])?;
    tasks
        .into_iter()
        .map(|t| build_task_with_relations(&conn, t, false))
        .collect()
}

#[tauri::command]
pub fn create_task(input: CreateTaskInput) -> Result<TaskWithRelations, String> {
    let conn = open_db().map_err(|e| e.to_string())?;

    if let Some(pid) = input.parent_id {
        let parent_parent: Option<i64> = conn
            .query_row("SELECT parent_id FROM tasks WHERE id = ?1", [pid], |row| {
                row.get(0)
            })
            .map_err(|e| e.to_string())?;
        if parent_parent.is_some() {
            return Err("子任务不能再创建子任务（仅支持一层嵌套）".to_string());
        }
    }

    let name = input.name.unwrap_or_default();
    let status = input.status.unwrap_or_else(|| "待开始".to_string());

    conn.execute(
        "INSERT INTO tasks (board_id, parent_id, name, status) VALUES (?1, ?2, ?3, ?4)",
        params![input.board_id, input.parent_id, name, status],
    )
    .map_err(|e| e.to_string())?;

    let task_id = conn.last_insert_rowid();
    let sql = format!("{} WHERE id = ?1", TASK_SELECT);
    let tasks = query_tasks(&conn, &sql, &[&task_id])?;
    let task = tasks
        .into_iter()
        .next()
        .ok_or("Task not found".to_string())?;
    build_task_with_relations(&conn, task, true)
}

#[tauri::command]
pub fn update_task(id: i64, input: UpdateTaskInput) -> Result<TaskWithRelations, String> {
    let conn = open_db().map_err(|e| e.to_string())?;

    let mut sets = vec!["updated_at = datetime('now')".to_string()];
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    let mut idx = 1;

    macro_rules! maybe_set {
        ($field:ident, $col:expr) => {
            if let Some(ref val) = input.$field {
                sets.push(format!("{} = ?{}", $col, idx));
                param_values.push(Box::new(val.clone()));
                idx += 1;
            }
        };
    }

    maybe_set!(name, "name");
    maybe_set!(description, "description");
    maybe_set!(status, "status");
    maybe_set!(priority, "priority");
    maybe_set!(task_type, "type");
    maybe_set!(project_id, "project_id");
    maybe_set!(owner_id, "owner_id");
    maybe_set!(start_date, "start_date");
    maybe_set!(estimated_test_date, "estimated_test_date");
    maybe_set!(actual_test_date, "actual_test_date");
    maybe_set!(estimated_release_date, "estimated_release_date");
    maybe_set!(completion_date, "completion_date");
    maybe_set!(progress, "progress");
    maybe_set!(story_points, "story_points");
    // quality_rating: Option<Option<i32>> — Some(None) means set to NULL, Some(Some(v)) means set value
    if let Some(ref opt_val) = input.quality_rating {
        sets.push(format!("quality_rating = ?{}", idx));
        param_values.push(Box::new(opt_val.clone()));
        idx += 1;
    }
    maybe_set!(latest_note, "latest_note");

    if let Some(auto) = input.progress_auto {
        sets.push(format!("progress_auto = ?{}", idx));
        param_values.push(Box::new(if auto { 1i32 } else { 0i32 }));
        idx += 1;
    }

    let sql = format!("UPDATE tasks SET {} WHERE id = ?{}", sets.join(", "), idx);
    param_values.push(Box::new(id));
    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    if let Some(ref ids) = input.assignee_ids {
        conn.execute("DELETE FROM task_assignees WHERE task_id = ?1", [id])
            .map_err(|e| e.to_string())?;
        for aid in ids {
            conn.execute(
                "INSERT OR IGNORE INTO task_assignees (task_id, member_id) VALUES (?1, ?2)",
                params![id, aid],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    if let Some(ref ids) = input.tester_ids {
        conn.execute("DELETE FROM task_testers WHERE task_id = ?1", [id])
            .map_err(|e| e.to_string())?;
        for tid in ids {
            conn.execute(
                "INSERT OR IGNORE INTO task_testers (task_id, member_id) VALUES (?1, ?2)",
                params![id, tid],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    let sql = format!("{} WHERE id = ?1", TASK_SELECT);
    let tasks = query_tasks(&conn, &sql, &[&id])?;
    let task = tasks
        .into_iter()
        .next()
        .ok_or("Task not found".to_string())?;
    build_task_with_relations(&conn, task, true)
}

#[tauri::command]
pub fn delete_task(id: i64) -> Result<(), String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn batch_update_tasks(ids: Vec<i64>, input: BatchUpdateInput) -> Result<(), String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    for id in &ids {
        let mut sets = vec!["updated_at = datetime('now')".to_string()];
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
        let mut idx = 1;
        if let Some(ref status) = input.status {
            sets.push(format!("status = ?{}", idx));
            param_values.push(Box::new(status.clone()));
            idx += 1;
        }
        if let Some(ref priority) = input.priority {
            sets.push(format!("priority = ?{}", idx));
            param_values.push(Box::new(priority.clone()));
            idx += 1;
        }
        let sql = format!("UPDATE tasks SET {} WHERE id = ?{}", sets.join(", "), idx);
        param_values.push(Box::new(*id));
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, params_refs.as_slice())
            .map_err(|e| e.to_string())?;

        if let Some(ref assignee_ids) = input.assignee_ids {
            conn.execute("DELETE FROM task_assignees WHERE task_id = ?1", [id])
                .map_err(|e| e.to_string())?;
            for aid in assignee_ids {
                conn.execute(
                    "INSERT OR IGNORE INTO task_assignees (task_id, member_id) VALUES (?1, ?2)",
                    params![id, aid],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}
