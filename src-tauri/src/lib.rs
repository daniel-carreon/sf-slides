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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Handle macOS "Open With" / double-click file open
            if let tauri::RunEvent::Opened { urls } = event {
                for url in urls {
                    // url is a URL like file:///path/to/file.pptx
                    let path = url.to_string();
                    // Strip file:// prefix if present
                    let file_path = if path.starts_with("file://") {
                        percent_decode(path.strip_prefix("file://").unwrap_or(&path))
                    } else {
                        path.clone()
                    };
                    if file_path.ends_with(".sfslides") || file_path.ends_with(".pptx") || file_path.ends_with(".json") {
                        let _ = app.emit("open-file", file_path);
                    }
                }
            }
        });
}

// Simple percent-decode for file paths (handles %20 spaces etc.)
fn percent_decode(input: &str) -> String {
    let mut result = String::new();
    let mut chars = input.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte as char);
            }
        } else {
            result.push(c);
        }
    }
    result
}
