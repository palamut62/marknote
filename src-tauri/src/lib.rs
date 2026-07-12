#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

// `Manager` powers `_app.get_webview_window` in the macOS setup block,
// `Emitter` powers the file-open event below, and `RunEvent::Opened` is a
// macOS-only enum variant (Finder "Open With" file association). Gating the
// whole `use` line lets the crate compile on Windows + Linux where the
// variant doesn't exist.
#[cfg(target_os = "macos")]
use tauri::{Emitter, RunEvent};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "marknote";
const OPENROUTER_ACCOUNT: &str = "openrouter-api-key";

#[tauri::command]
fn get_openrouter_key() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, OPENROUTER_ACCOUNT)
        .map_err(|err| err.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn set_openrouter_key(value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, OPENROUTER_ACCOUNT)
        .map_err(|err| err.to_string())?;
    if value.is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(err.to_string()),
        }
    } else {
        entry.set_password(&value).map_err(|err| err.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryDraft {
    source: String,
    path: Option<String>,
}

fn recovery_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join("recovery.json"))
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn save_recovery(app: tauri::AppHandle, draft: RecoveryDraft) -> Result<(), String> {
    let path = recovery_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let temp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(&draft).map_err(|err| err.to_string())?;
    std::fs::write(&temp, bytes).map_err(|err| err.to_string())?;
    std::fs::rename(&temp, &path).map_err(|err| err.to_string())
}

#[tauri::command]
fn load_recovery(app: tauri::AppHandle) -> Result<Option<RecoveryDraft>, String> {
    let path = recovery_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(path).map_err(|err| err.to_string())?;
    serde_json::from_slice(&bytes).map(Some).map_err(|err| err.to_string())
}

#[tauri::command]
fn clear_recovery(app: tauri::AppHandle) -> Result<(), String> {
    let path = recovery_path(&app)?;
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn git_diff(root: String) -> Result<String, String> {
    let root = std::fs::canonicalize(root).map_err(|err| err.to_string())?;
    if !root.is_dir() {
        return Err("workspace is not a directory".into());
    }
    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["diff", "--no-ext-diff", "--", "."])
        .output()
        .map_err(|err| err.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_openrouter_key,
            set_openrouter_key,
            save_recovery,
            load_recovery,
            clear_recovery,
            git_diff
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // ---- system tray ----------------------------------------------
            let show_item = MenuItem::with_id(app, "show", "open marknote", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "hide", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main")
                .tooltip("marknote")
                .icon(app.default_window_icon().cloned().expect("missing icon"))
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            #[cfg(target_os = "macos")]
            {
                let window = app.get_webview_window("main").expect("main window missing");
                if let Err(err) = apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::Sidebar,
                    Some(NSVisualEffectState::Active),
                    Some(12.0),
                ) {
                    eprintln!("marknote: apply_vibrancy failed: {err:?}");
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        // macOS Finder "Open With → marknote" emits this event with file URLs.
        // `RunEvent::Opened` doesn't exist on Windows/Linux — gating the block
        // keeps non-mac compilation clean.
        #[cfg(target_os = "macos")]
        if let RunEvent::Opened { urls } = _event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    let path_str = path.to_string_lossy().to_string();
                    if let Err(err) = _app_handle.emit("marknote:open-file", path_str.clone()) {
                        eprintln!("marknote: failed to emit open-file event: {err:?}");
                    } else {
                        eprintln!("marknote: open-file requested: {path_str}");
                    }
                }
            }
        }
    });
}
