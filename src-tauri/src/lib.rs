mod commands;
mod db;
mod models;

use commands::{ai, board, export, member, project, task};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = db::open_db().expect("Failed to open database");
    db::init_db(&conn).expect("Failed to initialize database");
    drop(conn);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            board::list_boards,
            board::create_board,
            board::delete_board,
            board::clone_board,
            task::list_tasks,
            task::list_tasks_by_date,
            task::list_tasks_completed_between,
            task::list_unfinished_tasks,
            task::create_task,
            task::update_task,
            task::delete_task,
            task::batch_update_tasks,
            member::list_members,
            member::create_member,
            member::update_member,
            member::delete_member,
            project::list_projects,
            project::create_project,
            project::update_project,
            project::delete_project,
            export::export_db_file,
            export::get_db_file_path,
            ai::ai_complete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
