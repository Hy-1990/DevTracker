PRAGMA foreign_keys = ON;

CREATE TABLE members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'dev' CHECK (role IN ('dev', 'test')), created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE boards (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, year_month TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE, name TEXT NOT NULL DEFAULT '', description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT '待开始', priority TEXT NOT NULL DEFAULT '日常', type TEXT NOT NULL DEFAULT '产品需求',
  project_id INTEGER REFERENCES projects(id), owner_id INTEGER REFERENCES members(id), start_date TEXT,
  estimated_test_date TEXT, actual_test_date TEXT, estimated_release_date TEXT, completion_date TEXT,
  progress INTEGER DEFAULT 0, progress_auto INTEGER DEFAULT 1, story_points REAL DEFAULT 1.0,
  quality_rating INTEGER, latest_note TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE task_assignees (task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE, PRIMARY KEY (task_id, member_id));
CREATE TABLE task_testers (task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE, PRIMARY KEY (task_id, member_id));
CREATE INDEX idx_tasks_board ON tasks(board_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_status ON tasks(status);

INSERT INTO members (id, name, role) VALUES (1, 'Alex', 'dev'), (2, 'Morgan', 'dev'), (3, 'Taylor', 'dev'), (4, 'Jordan', 'test'), (5, 'Casey', 'test');
INSERT INTO projects (id, name) VALUES (1, 'Atlas Web'), (2, 'Mobile Refresh'), (3, 'Platform Reliability');
INSERT INTO boards (id, name, year_month) VALUES (1, 'July 2026', '2026-07');

INSERT INTO tasks (id, board_id, name, status, priority, type, project_id, owner_id, start_date, estimated_test_date, actual_test_date, estimated_release_date, completion_date, progress, story_points, quality_rating, latest_note) VALUES
(1,1,'Improve authentication recovery','进行中','紧急','产品需求',1,1,'2026-07-02','2026-07-16',NULL,'2026-07-22',NULL,70,8,NULL,'Security review complete; integration tests in progress'),
(2,1,'Reduce dashboard load time','待上线','重要','功能优化',1,2,'2026-07-01','2026-07-10','2026-07-10','2026-07-17',NULL,95,5,9,'Validated a 38% improvement with the demo dataset'),
(3,1,'Automate mobile smoke tests','进行中','重要','基建',2,3,'2026-07-04','2026-07-18',NULL,'2026-07-25',NULL,55,8,NULL,'Core navigation coverage is ready'),
(4,1,'Fix offline sync conflict','已完成','紧急','bug修复',2,2,'2026-07-01','2026-07-07','2026-07-07','2026-07-11','2026-07-10',100,3,10,'Released with additional telemetry'),
(5,1,'Accessibility keyboard pass','待开始','日常','功能优化',1,1,'2026-07-20','2026-07-25',NULL,'2026-07-30',NULL,0,5,NULL,'Scope covers primary task workflows'),
(6,1,'Database backup verification','已完成','重要','日常维护',3,3,'2026-07-02','2026-07-08','2026-07-08','2026-07-12','2026-07-12',100,3,9,'Restore drill completed successfully'),
(7,1,'Refresh release checklist','待上线','日常','日常维护',3,3,'2026-07-08','2026-07-12','2026-07-12','2026-07-18',NULL,90,2,8,'Waiting for final release window'),
(8,1,'Stabilize notification delivery','已停滞','重要','基建',3,2,'2026-07-03','2026-07-14',NULL,'2026-07-21',NULL,35,8,NULL,'Dependency upgrade is under review'),
(9,1,'Add project health filters','进行中','日常','产品需求',1,1,'2026-07-09','2026-07-21',NULL,'2026-07-28',NULL,45,5,NULL,'Interaction design approved'),
(10,1,'Improve app startup diagnostics','已完成','日常','基建',3,3,'2026-07-01','2026-07-05','2026-07-05','2026-07-09','2026-07-09',100,3,8,'Diagnostics are available in local logs'),
(11,1,'Resolve date picker timezone issue','已完成','重要','bug修复',2,2,'2026-07-02','2026-07-06','2026-07-06','2026-07-10','2026-07-10',100,2,9,'Verified across supported locale settings'),
(12,1,'Prepare quarterly reliability review','待开始','不重要','toboss',3,1,'2026-07-22','2026-07-28',NULL,'2026-07-31',NULL,0,5,NULL,'Metrics outline drafted'),
(13,1,'Session expiry coverage','已完成','重要','产品需求',1,1,'2026-07-03','2026-07-09','2026-07-09','2026-07-12','2026-07-12',100,3,9,'Edge cases documented'),
(14,1,'Recovery email integration','进行中','日常','产品需求',1,1,'2026-07-10','2026-07-17',NULL,'2026-07-22',NULL,60,3,NULL,'Provider sandbox connected');

INSERT INTO task_assignees VALUES (1,1),(2,2),(3,3),(4,2),(5,1),(6,3),(7,3),(8,2),(9,1),(10,3),(11,2),(12,1),(13,1),(14,1);
INSERT INTO task_testers VALUES (1,4),(2,4),(3,5),(4,5),(5,4),(6,5),(7,4),(8,5),(9,4),(10,5),(11,4),(12,5),(13,4),(14,4);
