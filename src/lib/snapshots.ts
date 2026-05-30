import { STORAGE_KEYS } from "./storage";

export type Snapshot = {
  id: string;
  label: string;
  source: string;
  path: string | null;
  createdAt: number;
};

const MAX_SNAPSHOTS = 20;

function readRaw(): Snapshot[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.snapshots);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Snapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(items: Snapshot[]): void {
  window.localStorage.setItem(STORAGE_KEYS.snapshots, JSON.stringify(items.slice(0, MAX_SNAPSHOTS)));
}

export function listSnapshots(): Snapshot[] {
  return readRaw();
}

export function createSnapshot(source: string, path: string | null, label = "manual snapshot"): Snapshot | null {
  if (!source.trim()) return null;
  const snapshot: Snapshot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    source,
    path,
    createdAt: Date.now(),
  };
  writeRaw([snapshot, ...readRaw()]);
  return snapshot;
}

export function deleteSnapshot(id: string): void {
  writeRaw(readRaw().filter((item) => item.id !== id));
}
