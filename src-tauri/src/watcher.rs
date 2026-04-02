use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub struct WatcherState {
    debouncer:
        Mutex<Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            debouncer: Mutex::new(None),
        }
    }
}

pub fn watch_file(app: AppHandle, path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<WatcherState>();
    // Stop existing watcher
    let mut debouncer_lock = state.debouncer.lock().unwrap();
    *debouncer_lock = None;

    let app_handle = app.clone();
    let mut debouncer = new_debouncer(Duration::from_millis(200), move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
        match res {
            Ok(events) => {
                for event in events {
                    if event.kind == DebouncedEventKind::Any {
                        let path_str = event.path.to_string_lossy().to_string();
                        let _ = app_handle.emit("file-changed", path_str);
                    }
                }
            }
            Err(e) => {
                log::error!("Watch error: {:?}", e);
            }
        }
    })?;

    debouncer
        .watcher()
        .watch(Path::new(path), notify::RecursiveMode::NonRecursive)?;

    *debouncer_lock = Some(debouncer);
    log::info!("Watching file: {}", path);
    Ok(())
}

pub fn stop_watching(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<WatcherState>();
    let mut debouncer_lock = state.debouncer.lock().unwrap();
    *debouncer_lock = None;
    log::info!("Stopped watching");
    Ok(())
}
