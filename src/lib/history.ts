import { invoke } from "@tauri-apps/api/core";
import { STORAGE_KEYS } from "./storage";

/**
 * Per-document version history stored on disk (Rust: src-tauri/src/store.rs),
 * capped at 20 versions per note so one busy note can't push out another's
 * history (F11). Replaces the old shared localStorage snapshot list.
 */
export type HistoryEntry = {
  id: string;
  label: string;
  path: string | null;
  createdAt: number;
  size: number;
};

export function saveVersion(path: string | null, source: string, label: string): Promise<HistoryEntry> {
  return invoke<HistoryEntry>("history_save", { path, label, source });
}

export function listVersions(path: string | null): Promise<HistoryEntry[]> {
  return invoke<HistoryEntry[]>("history_list", { path });
}

export async function readVersion(id: string): Promise<HistoryEntry & { source: string }> {
  return invoke<HistoryEntry & { source: string }>("history_read", { id });
}

export function deleteVersion(id: string): Promise<void> {
  return invoke("history_delete", { id });
}

type LegacySnapshot = { label: string; source: string; path: string | null; createdAt: number };

/**
 * One-time move of the old localStorage snapshots to disk. The key is only
 * removed after every snapshot was written, so a failure loses nothing.
 */
export async function migrateLegacySnapshots(): Promise<number> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEYS.snapshots);
  } catch {
    return 0;
  }
  if (!raw) return 0;
  let items: LegacySnapshot[] = [];
  try {
    const parsed = JSON.parse(raw) as LegacySnapshot[];
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    items = [];
  }
  // oldest first so the newest ends up on top of each note's list
  for (const item of [...items].sort((a, b) => a.createdAt - b.createdAt)) {
    if (!item?.source) continue;
    await saveVersion(item.path ?? null, item.source, item.label || "eski sürüm");
  }
  window.localStorage.removeItem(STORAGE_KEYS.snapshots);
  return items.length;
}
