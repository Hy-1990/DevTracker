use crate::db::open_db;
use crate::models::Board;

struct CloneTaskDraft {
    old_id: i64,
    name: String,
    description: String,
    status: String,
    priority: String,
    task_type: String,
    project_id: Option<i64>,
    owner_id: Option<i64>,
    start_date: Option<String>,
    estimated_test_date: Option<String>,
    actual_test_date: Option<String>,
    estimated_release_date: Option<String>,
    completion_date: Option<String>,
    progress: i32,
    progress_auto: i32,
    story_points: f64,
    quality_rating: Option<i32>,
    latest_note: String,
}

const CLONE_TASK_SELECT: &str =
    "id, name, description, status, priority, type, project_id, owner_id,
    start_date, estimated_test_date, actual_test_date, estimated_release_date, completion_date,
    progress, progress_auto, story_points, quality_rating, latest_note";

fn row_to_clone_task(row: &rusqlite::Row) -> rusqlite::Result<CloneTaskDraft> {
    Ok(CloneTaskDraft {
        old_id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        status: row.get(3)?,
        priority: row.get(4)?,
        task_type: row.get(5)?,
        project_id: row.get(6)?,
        owner_id: row.get(7)?,
        start_date: row.get(8)?,
        estimated_test_date: row.get(9)?,
        actual_test_date: row.get(10)?,
        estimated_release_date: row.get(11)?,
        completion_date: row.get(12)?,
        progress: row.get(13)?,
        progress_auto: row.get(14)?,
        story_points: row.get(15)?,
        quality_rating: row.get(16)?,
        latest_note: row.get(17)?,
    })
}

fn insert_cloned_task(
    conn: &rusqlite::Connection,
    board_id: i64,
    parent_id: Option<i64>,
    task: &CloneTaskDraft,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO tasks (
            board_id, parent_id, name, description, status, priority, type,
            project_id, owner_id, start_date, estimated_test_date, actual_test_date,
            estimated_release_date, completion_date, progress, progress_auto,
            story_points, quality_rating, latest_note
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
            ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19
        )",
        rusqlite::params![
            board_id,
            parent_id,
            task.name,
            task.description,
            task.status,
            task.priority,
            task.task_type,
            task.project_id,
            task.owner_id,
            task.start_date,
            task.estimated_test_date,
            task.actual_test_date,
            task.estimated_release_date,
            task.completion_date,
            task.progress,
            task.progress_auto,
            task.story_points,
            task.quality_rating,
            task.latest_note,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

fn copy_task_people(conn: &rusqlite::Connection, old_id: i64, new_id: i64) -> Result<(), String> {
    conn.execute(
        "INSERT INTO task_assignees (task_id, member_id) SELECT ?1, member_id FROM task_assignees WHERE task_id = ?2",
        rusqlite::params![new_id, old_id],
    ).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO task_testers (task_id, member_id) SELECT ?1, member_id FROM task_testers WHERE task_id = ?2",
        rusqlite::params![new_id, old_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_boards() -> Result<Vec<Board>, String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, year_month, created_at FROM boards ORDER BY year_month DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Board {
                id: row.get(0)?,
                name: row.get(1)?,
                year_month: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let boards: Vec<Board> = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(boards)
}

#[tauri::command]
pub fn create_board(name: String, year_month: String) -> Result<Board, String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO boards (name, year_month) VALUES (?1, ?2)",
        rusqlite::params![name, year_month],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let board = conn
        .query_row(
            "SELECT id, name, year_month, created_at FROM boards WHERE id = ?1",
            [id],
            |row| {
                Ok(Board {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    year_month: row.get(2)?,
                    created_at: row.get(3)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(board)
}

#[tauri::command]
pub fn delete_board(id: i64) -> Result<(), String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM boards WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn clone_board(source_id: i64, name: String, year_month: String) -> Result<Board, String> {
    let conn = open_db().map_err(|e| e.to_string())?;

    // Create new board
    conn.execute(
        "INSERT INTO boards (name, year_month) VALUES (?1, ?2)",
        rusqlite::params![name, year_month],
    )
    .map_err(|e| e.to_string())?;
    let new_board_id = conn.last_insert_rowid();

    // Carry unfinished top-level tasks forward with all business fields preserved.
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {}
             FROM tasks
             WHERE board_id = ?1 AND parent_id IS NULL AND status != '已完成'",
            CLONE_TASK_SELECT
        ))
        .map_err(|e| e.to_string())?;

    let parent_tasks: Vec<CloneTaskDraft> = stmt
        .query_map([source_id], row_to_clone_task)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for parent_task in &parent_tasks {
        let new_task_id = insert_cloned_task(&conn, new_board_id, None, parent_task)?;
        copy_task_people(&conn, parent_task.old_id, new_task_id)?;

        // Carry unfinished child tasks forward
        let mut child_stmt = conn
            .prepare(&format!(
                "SELECT {}
                 FROM tasks
                 WHERE parent_id = ?1 AND status != '已完成'",
                CLONE_TASK_SELECT
            ))
            .map_err(|e| e.to_string())?;
        let children: Vec<CloneTaskDraft> = child_stmt
            .query_map([parent_task.old_id], row_to_clone_task)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        for child in &children {
            let new_child_id = insert_cloned_task(&conn, new_board_id, Some(new_task_id), child)?;
            copy_task_people(&conn, child.old_id, new_child_id)?;
        }
    }

    let mut orphan_child_stmt = conn
        .prepare(&format!(
            "SELECT c.id, c.name, c.description, c.status, c.priority, c.type, c.project_id, c.owner_id,
                    c.start_date, c.estimated_test_date, c.actual_test_date, c.estimated_release_date,
                    c.completion_date, c.progress, c.progress_auto, c.story_points, c.quality_rating,
                    c.latest_note
             FROM tasks c
             JOIN tasks p ON p.id = c.parent_id
             WHERE p.board_id = ?1 AND p.status = '已完成' AND c.status != '已完成'"
        ))
        .map_err(|e| e.to_string())?;
    let orphan_children: Vec<CloneTaskDraft> = orphan_child_stmt
        .query_map([source_id], row_to_clone_task)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for child in &orphan_children {
        let new_child_id = insert_cloned_task(&conn, new_board_id, None, child)?;
        copy_task_people(&conn, child.old_id, new_child_id)?;
    }

    let board = conn
        .query_row(
            "SELECT id, name, year_month, created_at FROM boards WHERE id = ?1",
            [new_board_id],
            |row| {
                Ok(Board {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    year_month: row.get(2)?,
                    created_at: row.get(3)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(board)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use rusqlite::params;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_ENV_LOCK: Mutex<()> = Mutex::new(());

    fn setup_test_db() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "devtracker-board-test-{}-{}",
            std::process::id(),
            nonce
        ));
        std::fs::create_dir_all(&dir).unwrap();
        std::env::set_var("DEVTRACKER_DB_DIR", &dir);
        let conn = db::open_db().unwrap();
        db::init_db(&conn).unwrap();
        dir
    }

    #[test]
    fn clone_board_preserves_parent_and_child_task_status() {
        let _guard = TEST_ENV_LOCK.lock().unwrap();
        let dir = setup_test_db();
        let source = create_board("2026年6月".to_string(), "2026-06".to_string()).unwrap();
        let conn = db::open_db().unwrap();

        conn.execute(
            "INSERT INTO tasks (board_id, name, status, priority, type)
             VALUES (?1, '父任务', '进行中', '重要', '产品需求')",
            [source.id],
        )
        .unwrap();
        let parent_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO tasks (board_id, parent_id, name, status, priority, type)
             VALUES (?1, ?2, '子任务', '待上线', '紧急', 'bug修复')",
            params![source.id, parent_id],
        )
        .unwrap();

        let cloned =
            clone_board(source.id, "2026年7月".to_string(), "2026-07".to_string()).unwrap();
        let statuses: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT status FROM tasks WHERE board_id = ?1 ORDER BY parent_id IS NOT NULL, id")
                .unwrap();
            stmt.query_map([cloned.id], |row| row.get(0))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap()
        };

        assert_eq!(statuses, vec!["进行中".to_string(), "待上线".to_string()]);

        std::env::remove_var("DEVTRACKER_DB_DIR");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn clone_board_only_carries_unfinished_tasks_forward() {
        let _guard = TEST_ENV_LOCK.lock().unwrap();
        let dir = setup_test_db();
        let source = create_board("2026年6月".to_string(), "2026-06".to_string()).unwrap();
        let conn = db::open_db().unwrap();

        conn.execute(
            "INSERT INTO tasks (board_id, name, status, priority, type)
             VALUES (?1, '未完成父任务', '进行中', '重要', '产品需求')",
            [source.id],
        )
        .unwrap();
        let unfinished_parent_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO tasks (board_id, parent_id, name, status, priority, type)
             VALUES (?1, ?2, '未完成子任务', '待上线', '紧急', 'bug修复')",
            params![source.id, unfinished_parent_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO tasks (board_id, parent_id, name, status, priority, type)
             VALUES (?1, ?2, '已完成子任务', '已完成', '日常', '功能优化')",
            params![source.id, unfinished_parent_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO tasks (board_id, name, status, priority, type)
             VALUES (?1, '已完成父任务', '已完成', '重要', '产品需求')",
            [source.id],
        )
        .unwrap();

        let cloned =
            clone_board(source.id, "2026年7月".to_string(), "2026-07".to_string()).unwrap();
        let copied_tasks: Vec<(String, String)> = {
            let mut stmt = conn
                .prepare("SELECT name, status FROM tasks WHERE board_id = ?1 ORDER BY id")
                .unwrap();
            stmt.query_map([cloned.id], |row| Ok((row.get(0)?, row.get(1)?)))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap()
        };

        assert_eq!(
            copied_tasks,
            vec![
                ("未完成父任务".to_string(), "进行中".to_string()),
                ("未完成子任务".to_string(), "待上线".to_string()),
            ]
        );

        std::env::remove_var("DEVTRACKER_DB_DIR");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn clone_board_carries_unfinished_children_of_completed_parents_forward() {
        let _guard = TEST_ENV_LOCK.lock().unwrap();
        let dir = setup_test_db();
        let source = create_board("2026年6月".to_string(), "2026-06".to_string()).unwrap();
        let conn = db::open_db().unwrap();

        conn.execute(
            "INSERT INTO tasks (board_id, name, status, priority, type)
             VALUES (?1, '已完成父任务', '已完成', '重要', '产品需求')",
            [source.id],
        )
        .unwrap();
        let completed_parent_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO tasks (board_id, parent_id, name, status, priority, type)
             VALUES (?1, ?2, '遗留子任务', '进行中', '紧急', 'bug修复')",
            params![source.id, completed_parent_id],
        )
        .unwrap();

        let cloned =
            clone_board(source.id, "2026年7月".to_string(), "2026-07".to_string()).unwrap();
        let copied_tasks: Vec<(String, String, Option<i64>)> = {
            let mut stmt = conn
                .prepare(
                    "SELECT name, status, parent_id FROM tasks WHERE board_id = ?1 ORDER BY id",
                )
                .unwrap();
            stmt.query_map([cloned.id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
        };

        assert_eq!(
            copied_tasks,
            vec![("遗留子任务".to_string(), "进行中".to_string(), None)]
        );

        std::env::remove_var("DEVTRACKER_DB_DIR");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn clone_board_preserves_unfinished_task_planning_fields() {
        let _guard = TEST_ENV_LOCK.lock().unwrap();
        let dir = setup_test_db();
        let source = create_board("2026年6月".to_string(), "2026-06".to_string()).unwrap();
        let conn = db::open_db().unwrap();

        conn.execute(
            "INSERT INTO tasks (
                board_id, name, description, status, priority, type,
                start_date, estimated_test_date, actual_test_date,
                estimated_release_date, completion_date,
                progress, progress_auto, story_points, quality_rating, latest_note
             )
             VALUES (
                ?1, '计划字段任务', '完整复制业务字段', '进行中', '重要', '产品需求',
                '2026-06-03', '2026-06-12', '2026-06-13',
                '2026-06-20', '2026-06-21',
                65, 0, 8.5, 9, '保持当前节奏'
             )",
            [source.id],
        )
        .unwrap();

        let cloned =
            clone_board(source.id, "2026年7月".to_string(), "2026-07".to_string()).unwrap();
        let copied = conn
            .query_row(
                "SELECT
                    start_date, estimated_test_date, actual_test_date,
                    estimated_release_date, completion_date,
                    progress, progress_auto, story_points, quality_rating, latest_note
                 FROM tasks
                 WHERE board_id = ?1 AND name = '计划字段任务'",
                [cloned.id],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                        row.get::<_, i32>(5)?,
                        row.get::<_, i32>(6)?,
                        row.get::<_, f64>(7)?,
                        row.get::<_, Option<i32>>(8)?,
                        row.get::<_, String>(9)?,
                    ))
                },
            )
            .unwrap();

        assert_eq!(
            copied,
            (
                Some("2026-06-03".to_string()),
                Some("2026-06-12".to_string()),
                Some("2026-06-13".to_string()),
                Some("2026-06-20".to_string()),
                Some("2026-06-21".to_string()),
                65,
                0,
                8.5,
                Some(9),
                "保持当前节奏".to_string(),
            )
        );

        std::env::remove_var("DEVTRACKER_DB_DIR");
        std::fs::remove_dir_all(dir).unwrap();
    }
}
