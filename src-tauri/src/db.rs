use rusqlite::{backup::Backup, Connection, OpenFlags, Result};
use std::path::{Path, PathBuf};
use std::time::Duration;

const APP_DATA_DIR: &str = "DevTracker";
const DB_FILE_NAME: &str = "data.db";
const MIGRATION_FILE_NAME: &str = ".data.db.migrating";

pub fn get_db_path() -> PathBuf {
    db_path_and_override().0
}

fn db_path_and_override() -> (PathBuf, bool) {
    let override_dir = std::env::var_os("DEVTRACKER_DB_DIR").filter(|value| !value.is_empty());
    let has_override = override_dir.is_some();
    let base_dir = dirs::data_local_dir().unwrap_or_else(|| {
        std::env::current_dir()
            .expect("Cannot resolve a writable directory for DevTracker data")
            .join(".devtracker")
    });
    let path = resolve_db_path(override_dir.as_deref(), &base_dir);
    std::fs::create_dir_all(path.parent().expect("Database path has no parent"))
        .expect("Cannot create DevTracker data directory");
    (path, has_override)
}

pub fn open_db() -> Result<Connection> {
    let (path, has_override) = db_path_and_override();
    if !has_override && !path.exists() {
        if let Some(legacy_path) = find_legacy_project_db() {
            migrate_legacy_db(&legacy_path, &path)?;
        }
    }
    let conn = Connection::open(&path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}

fn resolve_db_path(override_dir: Option<&std::ffi::OsStr>, data_local_dir: &Path) -> PathBuf {
    override_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| data_local_dir.join(APP_DATA_DIR))
        .join(DB_FILE_NAME)
}

fn find_legacy_project_db() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    find_legacy_project_db_from(&exe)
}

fn find_legacy_project_db_from(start: &Path) -> Option<PathBuf> {
    let mut dir = start.parent()?.to_path_buf();
    loop {
        if dir.join("Cargo.toml").is_file() {
            let legacy = dir.parent()?.join("data").join(DB_FILE_NAME);
            return legacy.is_file().then_some(legacy);
        }
        if !dir.pop() {
            return None;
        }
    }
}

/// Copies a legacy database through SQLite's online-backup API. The destination only becomes
/// visible after it passes an integrity check, so a failed migration cannot replace user data.
fn migrate_legacy_db(source_path: &Path, destination_path: &Path) -> Result<()> {
    if destination_path.exists() {
        return Ok(());
    }

    let parent = destination_path
        .parent()
        .ok_or_else(|| rusqlite::Error::InvalidPath(destination_path.to_path_buf()))?;
    std::fs::create_dir_all(parent)
        .map_err(|_| rusqlite::Error::InvalidPath(parent.to_path_buf()))?;

    let temporary_path = parent.join(MIGRATION_FILE_NAME);
    if temporary_path.exists() {
        std::fs::remove_file(&temporary_path)
            .map_err(|_| rusqlite::Error::InvalidPath(temporary_path.clone()))?;
    }

    let source = Connection::open_with_flags(source_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut destination = Connection::open(&temporary_path)?;
    {
        let backup = Backup::new(&source, &mut destination)?;
        backup.run_to_completion(64, Duration::from_millis(10), None)?;
    }

    let integrity: String =
        destination.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity != "ok" {
        drop(destination);
        let _ = std::fs::remove_file(&temporary_path);
        return Err(rusqlite::Error::InvalidQuery);
    }
    destination.close().map_err(|(_, error)| error)?;
    std::fs::File::open(&temporary_path)
        .and_then(|file| file.sync_all())
        .map_err(|_| rusqlite::Error::InvalidPath(temporary_path.clone()))?;

    std::fs::rename(&temporary_path, destination_path)
        .map_err(|_| rusqlite::Error::InvalidPath(destination_path.to_path_buf()))?;
    Ok(())
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'dev'
                CHECK (role IN ('dev', 'test')),
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS boards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            year_month TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
            parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
            name TEXT NOT NULL DEFAULT '',
            description TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT '待开始'
                CHECK (status IN ('已停滞', '待开始', '进行中', '待上线', '已完成')),
            priority TEXT NOT NULL DEFAULT '日常'
                CHECK (priority IN ('紧急', '重要', '日常', '不重要')),
            type TEXT NOT NULL DEFAULT '产品需求'
                CHECK (type IN ('产品需求', '功能优化', '基建', 'bug修复', '日常维护', 'toboss')),
            project_id INTEGER REFERENCES projects(id),
            owner_id INTEGER REFERENCES members(id),
            start_date TEXT,
            estimated_test_date TEXT,
            actual_test_date TEXT,
            estimated_release_date TEXT,
            completion_date TEXT,
            progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
            progress_auto INTEGER DEFAULT 1 CHECK (progress_auto IN (0, 1)),
            story_points REAL DEFAULT 1.0,
            quality_rating INTEGER CHECK (quality_rating IS NULL OR (quality_rating >= 1 AND quality_rating <= 10)),
            latest_note TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS task_assignees (
            task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            PRIMARY KEY (task_id, member_id)
        );

        CREATE TABLE IF NOT EXISTS task_testers (
            task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            PRIMARY KEY (task_id, member_id)
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_board ON tasks(board_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_task_assignees_member ON task_assignees(member_id);
        CREATE INDEX IF NOT EXISTS idx_task_testers_member ON task_testers(member_id);
        ",
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_directory(test_name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "devtracker-{test_name}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn database_path_uses_app_data_and_honors_override() {
        let base = Path::new("/tmp/platform-data");
        assert_eq!(
            resolve_db_path(None, base),
            base.join(APP_DATA_DIR).join(DB_FILE_NAME)
        );
        assert_eq!(
            resolve_db_path(Some(OsStr::new("/tmp/custom")), base),
            Path::new("/tmp/custom").join(DB_FILE_NAME)
        );
    }

    #[test]
    fn legacy_database_is_backed_up_without_overwriting_source_or_destination() {
        let root = temporary_directory("migration");
        let source_path = root.join("legacy.db");
        let destination_path = root.join("app-data").join(DB_FILE_NAME);
        fs::create_dir_all(destination_path.parent().unwrap()).unwrap();

        let source = Connection::open(&source_path).unwrap();
        source
            .execute_batch(
                "PRAGMA journal_mode=WAL;
                 PRAGMA wal_autocheckpoint=0;
                 CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
                 CREATE INDEX idx_items_value ON items(value);
                 CREATE VIEW item_values AS SELECT value FROM items;
                 CREATE TRIGGER normalize_item AFTER INSERT ON items
                 BEGIN UPDATE items SET value = upper(value) WHERE id = NEW.id; END;
                 INSERT INTO items(value) VALUES ('private local row');",
            )
            .unwrap();

        let source_rows_before: i64 = source
            .query_row("SELECT count(*) FROM items", [], |row| row.get(0))
            .unwrap();
        migrate_legacy_db(&source_path, &destination_path).unwrap();

        let migrated = Connection::open(&destination_path).unwrap();
        let migrated_value: String = migrated
            .query_row("SELECT value FROM item_values", [], |row| row.get(0))
            .unwrap();
        let integrity: String = migrated
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))
            .unwrap();
        let index_count: i64 = migrated
            .query_row(
                "SELECT count(*) FROM sqlite_schema WHERE type = 'index' AND name = 'idx_items_value'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(source_rows_before, 1);
        assert_eq!(migrated_value, "PRIVATE LOCAL ROW");
        assert_eq!(integrity, "ok");
        assert_eq!(index_count, 1);
        assert!(source_path.exists());

        migrated
            .execute("INSERT INTO items(value) VALUES ('destination only')", [])
            .unwrap();
        migrate_legacy_db(&source_path, &destination_path).unwrap();
        let destination_rows: i64 = migrated
            .query_row("SELECT count(*) FROM items", [], |row| row.get(0))
            .unwrap();
        assert_eq!(destination_rows, 2);

        drop(migrated);
        drop(source);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stale_migration_file_is_replaced() {
        let root = temporary_directory("stale-migration");
        let source_path = root.join("legacy.db");
        let destination_dir = root.join("app-data");
        let destination_path = destination_dir.join(DB_FILE_NAME);
        fs::create_dir_all(&destination_dir).unwrap();
        fs::write(destination_dir.join(MIGRATION_FILE_NAME), b"partial").unwrap();

        let source = Connection::open(&source_path).unwrap();
        source
            .execute_batch("CREATE TABLE example(value TEXT); INSERT INTO example VALUES ('ok');")
            .unwrap();
        drop(source);

        migrate_legacy_db(&source_path, &destination_path).unwrap();
        let migrated = Connection::open(&destination_path).unwrap();
        let value: String = migrated
            .query_row("SELECT value FROM example", [], |row| row.get(0))
            .unwrap();
        assert_eq!(value, "ok");
        assert!(!destination_dir.join(MIGRATION_FILE_NAME).exists());

        drop(migrated);
        fs::remove_dir_all(root).unwrap();
    }
}
