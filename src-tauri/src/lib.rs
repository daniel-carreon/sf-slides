mod watcher;

use std::sync::Mutex;
use tauri::{Manager, Emitter};

/// Stores file path queued for opening (survives the race condition)
pub struct PendingFile(pub Mutex<Option<String>>);

#[tauri::command]
fn watch_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    watcher::watch_file(app, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_watching(app: tauri::AppHandle) -> Result<(), String> {
    watcher::stop_watching(app).map_err(|e| e.to_string())
}

/// Frontend calls this on mount to check if a file was queued before the listener was ready
#[tauri::command]
fn take_pending_file(state: tauri::State<'_, PendingFile>) -> Option<String> {
    let result = state.0.lock().unwrap().take();
    eprintln!("[SF-Slides] take_pending_file called, result: {:?}", result);
    result
}

fn is_supported_file(path: &str) -> bool {
    path.ends_with(".sfslides") || path.ends_with(".pptx") || path.ends_with(".json")
}

fn queue_or_emit(app: &tauri::AppHandle, file_path: String) {
    eprintln!("[SF-Slides] queue_or_emit: {}", file_path);
    let state = app.state::<PendingFile>();
    *state.0.lock().unwrap() = Some(file_path.clone());
    let _ = app.emit("open-file", file_path);
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
            // Initialize states
            app.manage(watcher::WatcherState::default());
            app.manage(PendingFile(Mutex::new(None)));

            // Check if a file was passed as CLI argument
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 && is_supported_file(&args[1]) {
                let state = app.state::<PendingFile>();
                *state.0.lock().unwrap() = Some(args[1].clone());
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![watch_file, stop_watching, take_pending_file])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Handle macOS Apple Events (double-click / "Open With")
            if let tauri::RunEvent::Opened { urls } = event {
                for url in urls {
                    let path = url.to_string();
                    let file_path = if path.starts_with("file://") {
                        percent_decode(path.strip_prefix("file://").unwrap_or(&path))
                    } else {
                        path.clone()
                    };
                    if is_supported_file(&file_path) {
                        queue_or_emit(app, file_path);
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
