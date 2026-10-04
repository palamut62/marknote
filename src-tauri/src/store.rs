//! App-managed trash and per-document version history.
//!
//! Both live under the app's local data dir, so they work the same on every
//! platform and the app can list and restore items itself (the OS recycle bin
//! can't be listed/restored portably). Every path coming from the webview is
//! checked to be inside the user's home folder, matching the fs scope the
//! frontend already has.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const HISTORY_PER_DOC: usize = 20;

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn random_suffix() -> String {
    // not cryptographic: only has to make ids unique within the same millisecond
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    format!("{:06x}", (nanos ^ std::process::id()) & 0xff_ffff)
}

/// Ids are generated here and echoed back by the webview; only allow the
/// characters we produce so an id can never escape its folder.
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() < 96 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn data_dir(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join(name);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn ensure_in_home(app: &tauri::AppHandle, path: &Path) -> Result<PathBuf, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let home = fs::canonicalize(&home).map_err(|e| e.to_string())?;
    let canonical = fs::canonicalize(path).map_err(|e| format!("{}: {e}", path.display()))?;
    if !canonical.starts_with(&home) {
        return Err("yalnız ana klasördeki dosyalar işlenebilir".into());
    }
    Ok(canonical)
}

fn copy_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            copy_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(src, dst).map(|_| ())
    }
}

/// rename, falling back to copy + delete when source and target are on
/// different volumes (rename can't cross drives).
fn move_path(src: &Path, dst: &Path) -> Result<(), String> {
    if fs::rename(src, dst).is_ok() {
        return Ok(());
    }
    copy_recursive(src, dst).map_err(|e| e.to_string())?;
    let removed = if src.is_dir() {
        fs::remove_dir_all(src)
    } else {
        fs::remove_file(src)
    };
    removed.map_err(|e| e.to_string())
}

/// `notes.md` → `notes (geri yüklendi).md`, then `notes (geri yüklendi 2).md`…
/// Never returns an existing path, so a restore can't overwrite anything.
pub fn unique_restore_path(target: &Path) -> PathBuf {
    if !target.exists() {
        return target.to_path_buf();
    }
    let parent = target.parent().map(Path::to_path_buf).unwrap_or_default();
    let stem = target
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = target
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    for n in 1.. {
        let label = if n == 1 {
            "geri yüklendi".to_string()
        } else {
            format!("geri yüklendi {n}")
        };
        let candidate = parent.join(format!("{stem} ({label}){ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    unreachable!()
}

// ---------------------------------------------------------------- trash ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrashItem {
    id: String,
    name: String,
    original_path: String,
    deleted_at: u64,
    is_dir: bool,
}

fn read_trash_item(dir: &Path) -> Option<TrashItem> {
    let bytes = fs::read(dir.join("meta.json")).ok()?;
    serde_json::from_slice(&bytes).ok()
}

#[tauri::command]
pub fn trash_move(app: tauri::AppHandle, path: String) -> Result<TrashItem, String> {
    let src = ensure_in_home(&app, Path::new(&path))?;
    let name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or("geçersiz yol")?;
    let id = format!("{}-{}", now_millis(), random_suffix());
    let slot = data_dir(&app, "trash")?.join(&id);
    fs::create_dir_all(&slot).map_err(|e| e.to_string())?;
    let item = TrashItem {
        id,
        name: name.clone(),
        // keep the path the user knows (not the canonical \\?\ form)
        original_path: path,
        deleted_at: now_millis(),
        is_dir: src.is_dir(),
    };
    // metadata first: if the move fails we drop the slot again
    let meta = serde_json::to_vec(&item).map_err(|e| e.to_string())?;
    fs::write(slot.join("meta.json"), meta).map_err(|e| e.to_string())?;
    if let Err(err) = move_path(&src, &slot.join(&name)) {
        let _ = fs::remove_dir_all(&slot);
        return Err(err);
    }
    Ok(item)
}

#[tauri::command]
pub fn trash_list(app: tauri::AppHandle) -> Result<Vec<TrashItem>, String> {
    let dir = data_dir(&app, "trash")?;
    let mut items: Vec<TrashItem> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| read_trash_item(&e.path()))
        .collect();
    items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
    Ok(items)
}

#[tauri::command]
pub fn trash_restore(app: tauri::AppHandle, id: String) -> Result<String, String> {
    if !valid_id(&id) {
        return Err("geçersiz kimlik".into());
    }
    let slot = data_dir(&app, "trash")?.join(&id);
    let item = read_trash_item(&slot).ok_or("çöp kutusu öğesi bulunamadı")?;
    let original = PathBuf::from(&item.original_path);
    let parent = original.parent().ok_or("geçersiz hedef")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    ensure_in_home(&app, parent)?;
    let target = unique_restore_path(&original);
    move_path(&slot.join(&item.name), &target)?;
    let _ = fs::remove_dir_all(&slot);
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn trash_delete(app: tauri::AppHandle, id: String) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("geçersiz kimlik".into());
    }
    let slot = data_dir(&app, "trash")?.join(&id);
    match fs::remove_dir_all(slot) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn trash_empty(app: tauri::AppHandle) -> Result<(), String> {
    let dir = data_dir(&app, "trash")?;
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
        fs::remove_dir_all(entry.path()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// -------------------------------------------------------------- history ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    id: String,
    label: String,
    path: Option<String>,
    created_at: u64,
    size: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<String>,
}

/// FNV-1a over a normalized path: same note → same folder, regardless of
/// slash direction (and case on Windows).
pub fn doc_key(path: Option<&str>) -> String {
    let Some(path) = path else {
        return "untitled".into();
    };
    let mut norm = path.replace('\\', "/");
    if cfg!(windows) {
        norm = norm.to_lowercase();
    }
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in norm.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }
    format!("{hash:016x}")
}

fn history_dir(app: &tauri::AppHandle, key: &str) -> Result<PathBuf, String> {
    let dir = data_dir(app, "history")?.join(key);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_entries(dir: &Path) -> Vec<(PathBuf, HistoryEntry)> {
    let mut items: Vec<(PathBuf, HistoryEntry)> = fs::read_dir(dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter_map(|e| {
                    let p = e.path();
                    let bytes = fs::read(&p).ok()?;
                    let entry: HistoryEntry = serde_json::from_slice(&bytes).ok()?;
                    Some((p, entry))
                })
                .collect()
        })
        .unwrap_or_default();
    items.sort_by(|a, b| b.1.created_at.cmp(&a.1.created_at));
    items
}

#[tauri::command]
pub fn history_save(
    app: tauri::AppHandle,
    path: Option<String>,
    label: String,
    source: String,
) -> Result<HistoryEntry, String> {
    let key = doc_key(path.as_deref());
    let dir = history_dir(&app, &key)?;
    let id = format!("{key}-{}-{}", now_millis(), random_suffix());
    let entry = HistoryEntry {
        id: id.clone(),
        label,
        path,
        created_at: now_millis(),
        size: source.len(),
        source: Some(source),
    };
    let bytes = serde_json::to_vec(&entry).map_err(|e| e.to_string())?;
    let file = dir.join(format!("{id}.json"));
    let temp = dir.join(format!("{id}.json.tmp"));
    fs::write(&temp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&temp, &file).map_err(|e| e.to_string())?;
    // per-document cap: one busy note can't push out another note's history
    for (old, _) in read_entries(&dir).into_iter().skip(HISTORY_PER_DOC) {
        let _ = fs::remove_file(old);
    }
    Ok(HistoryEntry { source: None, ..entry })
}

#[tauri::command]
pub fn history_list(app: tauri::AppHandle, path: Option<String>) -> Result<Vec<HistoryEntry>, String> {
    let dir = history_dir(&app, &doc_key(path.as_deref()))?;
    Ok(read_entries(&dir)
        .into_iter()
        .map(|(_, e)| HistoryEntry { source: None, ..e })
        .collect())
}

fn history_file(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err("geçersiz kimlik".into());
    }
    let key = id.split('-').next().ok_or("geçersiz kimlik")?;
    Ok(history_dir(app, key)?.join(format!("{id}.json")))
}

#[tauri::command]
pub fn history_read(app: tauri::AppHandle, id: String) -> Result<HistoryEntry, String> {
    let bytes = fs::read(history_file(&app, &id)?).map_err(|e| e.to_string())?;
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn history_delete(app: tauri::AppHandle, id: String) -> Result<(), String> {
    match fs::remove_file(history_file(&app, &id)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restore_path_never_overwrites() {
        let dir = std::env::temp_dir().join(format!("marknote-test-{}", random_suffix()));
        fs::create_dir_all(&dir).unwrap();
        let target = dir.join("not.md");
        assert_eq!(unique_restore_path(&target), target);
        fs::write(&target, "a").unwrap();
        let first = unique_restore_path(&target);
        assert_eq!(first, dir.join("not (geri yüklendi).md"));
        fs::write(&first, "b").unwrap();
        assert_eq!(unique_restore_path(&target), dir.join("not (geri yüklendi 2).md"));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn doc_key_is_separator_insensitive() {
        assert_eq!(doc_key(Some("C:\\notes\\a.md")), doc_key(Some("C:/notes/a.md")));
        assert_eq!(doc_key(None), "untitled");
        assert!(valid_id(&format!("{}-1-abc", doc_key(Some("/x")))));
        assert!(!valid_id("../../etc"));
    }
}
