import { invoke } from "@tauri-apps/api/core";

/** App-managed trash (Rust: src-tauri/src/store.rs). Items can be restored from inside the app. */
export type TrashItem = {
  id: string;
  name: string;
  originalPath: string;
  deletedAt: number;
  isDir: boolean;
};

export function moveToTrash(path: string): Promise<TrashItem> {
  return invoke<TrashItem>("trash_move", { path });
}

export function listTrash(): Promise<TrashItem[]> {
  return invoke<TrashItem[]>("trash_list");
}

/** Resolves to the restored path; never overwrites an existing file (adds "(geri yüklendi)"). */
export function restoreFromTrash(id: string): Promise<string> {
  return invoke<string>("trash_restore", { id });
}

export function deleteFromTrash(id: string): Promise<void> {
  return invoke("trash_delete", { id });
}

export function emptyTrash(): Promise<void> {
  return invoke("trash_empty");
}
