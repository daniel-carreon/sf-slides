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

/// Resolve the presentations directory. Always uses the repo path:
/// ~/Developer/software/sf-slides/presentations/
fn resolve_presentations_dir() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let dir = std::path::PathBuf::from(home)
        .join("Developer")
        .join("software")
        .join("sf-slides")
        .join("presentations");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

/// Returns the absolute path to the presentations directory
#[tauri::command]
fn get_presentations_dir() -> String {
    let dir = resolve_presentations_dir();
    dir.to_string_lossy().to_string()
}

/// Save presentation JSON to sf-slides/presentations/{name}.sfslides
/// Bypasses Tauri FS plugin scope restrictions
#[tauri::command]
fn save_presentation(name: String, content: String) -> Result<String, String> {
    let dir = resolve_presentations_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.sfslides", name));
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;
    let result = path.to_string_lossy().to_string();
    eprintln!("[SF-Slides] save_presentation: {} ({} bytes)", result, content.len());
    Ok(result)
}

/// List all .sfslides/.json files in the presentations directory.
/// For large files, only extracts metadata via string search (no full JSON parse).
/// Uses std::fs directly — no Tauri FS scope restrictions.
#[tauri::command]
fn list_presentations() -> Result<Vec<serde_json::Value>, String> {
    let dir = resolve_presentations_dir();

    let mut results = Vec::new();
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        if !name.ends_with(".sfslides") && !name.ends_with(".json") {
            continue;
        }
        // Skip non-file entries (directories, assets folder, etc.)
        if path.is_dir() {
            continue;
        }

        let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

        if file_size < 5_000_000 {
            // Small file (<5MB): read entirely
            match std::fs::read_to_string(&path) {
                Ok(content) => {
                    results.push(serde_json::json!({
                        "path": path.to_string_lossy().to_string(),
                        "name": name,
                        "content": content,
                    }));
                }
                Err(e) => {
                    eprintln!("[SF-Slides] list: skip {:?}: {}", name, e);
                }
            }
        } else {
            // Large file (>5MB): read only first 200KB for metadata extraction
            use std::io::Read;
            let mut file = match std::fs::File::open(&path) {
                Ok(f) => f,
                Err(e) => {
                    eprintln!("[SF-Slides] list: skip {:?}: {}", name, e);
                    continue;
                }
            };
            let read_size = std::cmp::min(file_size as usize, 200_000);
            let mut buf = vec![0u8; read_size];
            let _ = file.read_exact(&mut buf);
            let header = String::from_utf8_lossy(&buf);

            // Extract metadata fields via string search
            let title = extract_json_string(&header, "\"title\"")
                .unwrap_or_else(|| name.replace(".sfslides", ""));
            let author = extract_json_string(&header, "\"author\"").unwrap_or_default();
            let created = extract_json_string(&header, "\"created\"").unwrap_or_default();
            let cover = extract_json_string(&header, "\"cover_image_data\"").unwrap_or_default();

            // Count slides by counting "elements" keys
            let slide_count = header.matches("\"elements\"").count()
                + (file_size as usize / 5_000_000); // rough estimate for remaining

            // Count actual slides more accurately
            let actual_count = {
                // Read full file just to count slides array length
                // This is fast because we only scan for the pattern
                let full = std::fs::read_to_string(&path).unwrap_or_default();
                let count = full.matches("\"elements\":").count();
                if count > 0 { count } else { slide_count }
            };

            // Build minimal presentation JSON for the frontend
            let minimal = serde_json::json!({
                "version": 1,
                "metadata": {
                    "title": title,
                    "author": author,
                    "created": created,
                    "cover_image_data": if cover.len() > 100 { cover } else { String::new() },
                },
                "defaults": { "font_family": "Inter, system-ui, sans-serif", "background": { "type": "solid", "color": "#0D0D0D" }},
                "slides": (0..actual_count).map(|_| serde_json::json!({"elements": []})).collect::<Vec<_>>(),
            });

            results.push(serde_json::json!({
                "path": path.to_string_lossy().to_string(),
                "name": name,
                "content": minimal.to_string(),
            }));
            eprintln!("[SF-Slides] list: {} ({}MB) → metadata extracted, {} slides", name, file_size / 1_000_000, actual_count);
        }
    }
    eprintln!("[SF-Slides] list: found {} files in {:?}", results.len(), dir);
    Ok(results)
}

/// Extract a JSON string value after a key pattern like `"title":"value"`
fn extract_json_string(text: &str, key: &str) -> Option<String> {
    let pos = text.find(key)?;
    let after = &text[pos + key.len()..];
    // Skip `:` and whitespace
    let after = after.trim_start();
    let after = after.strip_prefix(':')?;
    let after = after.trim_start();
    let after = after.strip_prefix('"')?;
    // Find closing quote (handle escaped quotes)
    let mut end = 0;
    let bytes = after.as_bytes();
    while end < bytes.len() {
        if bytes[end] == b'"' && (end == 0 || bytes[end - 1] != b'\\') {
            return Some(after[..end].to_string());
        }
        end += 1;
    }
    None
}

/// Read a single presentation file by absolute path.
/// Uses std::fs directly — no Tauri FS scope restrictions.
#[tauri::command]
fn read_presentation(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

/// Delete a presentation file by absolute path.
/// Uses std::fs directly — no Tauri FS scope restrictions.
#[tauri::command]
fn delete_presentation(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete {}: {}", path, e))
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
        .invoke_handler(tauri::generate_handler![watch_file, stop_watching, take_pending_file, get_presentations_dir, save_presentation, list_presentations, read_presentation, delete_presentation])
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
