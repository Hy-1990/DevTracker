use crate::db::open_db;
use crate::models::Member;

#[tauri::command]
pub fn list_members() -> Result<Vec<Member>, String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, role, created_at FROM members ORDER BY role, name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Member {
                id: row.get(0)?,
                name: row.get(1)?,
                role: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let members: Vec<Member> = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(members)
}

#[tauri::command]
pub fn create_member(name: String, role: String) -> Result<Member, String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO members (name, role) VALUES (?1, ?2)",
        rusqlite::params![name, role],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(Member {
        id,
        name,
        role,
        created_at: None,
    })
}

#[tauri::command]
pub fn update_member(id: i64, name: String, role: String) -> Result<(), String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE members SET name = ?1, role = ?2 WHERE id = ?3",
        rusqlite::params![name, role, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_member(id: i64) -> Result<(), String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM members WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
