use crate::db::get_db_path;
use std::fs;

#[tauri::command]
pub fn export_db_file(dest_path: String) -> Result<(), String> {
    let src = get_db_path();
    fs::copy(&src, &dest_path).map_err(|e| format!("Failed to export database: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_db_file_path() -> Result<String, String> {
    let path = get_db_path();
    Ok(path.to_string_lossy().to_string())
}
