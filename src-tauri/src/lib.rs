mod watcher;

use tauri::{Manager, Emitter};

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

            // Check if a file was passed as argument (macOS "Open With" or double-click)
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = &args[1];
                if file_path.ends_with(".sfslides") || file_path.ends_with(".pptx") || file_path.ends_with(".json") {
                    // Emit event to frontend with the file path
                    let path = file_path.clone();
                    let handle = app.handle().clone();
                    std::thread::spawn(move || {
                        // Small delay to let frontend initialize
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        let _ = handle.emit("open-file", path);
                    });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![watch_file, stop_watching])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
