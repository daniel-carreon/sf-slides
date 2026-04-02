mod watcher;

use tauri::Manager;

#[tauri::command]
fn watch_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    watcher::watch_file(app, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_watching(app: tauri::AppHandle) -> Result<(), String> {
    watcher::stop_watching(app).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Initialize watcher state
            app.manage(watcher::WatcherState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![watch_file, stop_watching])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
