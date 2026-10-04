import { useCallback, useEffect, useRef, useState } from "react";
import {
  basename,
  createFolder,
  createMarkdownFile,
  dirname,
  FS_CONFLICT,
  joinPath,
  listFolder,
  moveEntry,
  readMarkdown,
  removeEntry,
  renameEntry,
} from "@/lib";
import { remapPath, samePath } from "@/lib/paths";
import type { NewEntry } from "@/components/files/file-tree";
import type { LoadError } from "./use-file-session";

type UndoOp =
  | { kind: "move"; from: string; to: string }
  | { kind: "rename"; from: string; to: string }
  | { kind: "create-folder"; path: string }
  | { kind: "create-file"; path: string };

type UseFileOpsArgs = {
  activePath: string | null;
  dirty: boolean;
  /** opens a file through the shared unsaved-changes guard (F04) */
  openFileGuarded: (path: string) => void;
  /** replaces the buffer through the shared unsaved-changes guard (F04) */
  newBufferGuarded: () => void;
  /** a file or folder moved on disk: update every stored path (F05) */
  onPathsRemapped: (from: string, to: string) => void;
  onError: (err: LoadError) => void;
};

type UseFileOpsResult = {
  /** Bump this counter to force the sidebar tree to re-walk after fs mutations. */
  treeVersion: number;
  bumpTree: () => void;
  editingPath: string | null;
  setEditingPath: (v: string | null) => void;
  newEntry: NewEntry | null;
  setNewEntry: (v: NewEntry | null) => void;
  handleMove: (src: string, dstParent: string) => Promise<void>;
  handleSubmitRename: (src: string, newName: string) => Promise<void>;
  handleSubmitNew: (parent: string, kind: "file" | "folder", name: string) => Promise<void>;
  handleUndoFileOp: () => Promise<void>;
};

export function useFileOps({
  activePath,
  dirty,
  openFileGuarded,
  newBufferGuarded,
  onPathsRemapped,
  onError,
}: UseFileOpsArgs): UseFileOpsResult {
  const [treeVersion, setTreeVersion] = useState(0);
  const bumpTree = useCallback(() => setTreeVersion((v) => v + 1), []);

  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<NewEntry | null>(null);

  const undoStackRef = useRef<UndoOp[]>([]);
  const pushUndo = useCallback((op: UndoOp) => {
    const stack = undoStackRef.current;
    stack.push(op);
    if (stack.length > 20) stack.shift();
  }, []);

  // keep queued undo entries valid after their paths move (F05)
  const remapAll = useCallback((from: string, to: string) => {
    undoStackRef.current = undoStackRef.current.map((op) => {
      if (op.kind === "move" || op.kind === "rename") {
        return { ...op, from: remapPath(op.from, from, to), to: remapPath(op.to, from, to) };
      }
      return { ...op, path: remapPath(op.path, from, to) };
    });
    onPathsRemapped(from, to);
  }, [onPathsRemapped]);

  const handleMove = useCallback(
    async (src: string, dstParent: string) => {
      try {
        const newPath = await moveEntry(src, dstParent);
        if (samePath(newPath, src)) return;
        remapAll(src, newPath);
        pushUndo({ kind: "move", from: src, to: newPath });
        bumpTree();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes(FS_CONFLICT)) {
          const name = basename(src);
          onError({ message: `Hedefte zaten "${name}" var`, path: joinPath(dstParent, name) });
        } else {
          console.error("marknote: move failed", err);
          onError({ message: `${basename(src)} taşınamadı - ${msg}` });
        }
      }
    },
    [bumpTree, pushUndo, remapAll, onError],
  );

  const handleSubmitRename = useCallback(
    async (src: string, newName: string) => {
      setEditingPath(null);
      try {
        const newPath = await renameEntry(src, newName);
        if (samePath(newPath, src)) return;
        remapAll(src, newPath);
        pushUndo({ kind: "rename", from: src, to: newPath });
        bumpTree();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes(FS_CONFLICT)) {
          onError({ message: `Bu klasörde zaten "${newName}" var` });
        } else {
          console.error("marknote: rename failed", err);
          onError({ message: `Yeniden adlandırılamadı - ${msg}` });
        }
      }
    },
    [bumpTree, pushUndo, remapAll, onError],
  );

  const handleSubmitNew = useCallback(
    async (parent: string, kind: "file" | "folder", name: string) => {
      setNewEntry(null);
      try {
        if (kind === "folder") {
          const created = await createFolder(parent, name);
          pushUndo({ kind: "create-folder", path: created });
        } else {
          const created = await createMarkdownFile(parent, name);
          pushUndo({ kind: "create-file", path: created });
          // goes through the same save / discard / cancel guard as every
          // other document switch (F04)
          openFileGuarded(created);
        }
        bumpTree();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes(FS_CONFLICT)) {
          onError({ message: `Bu klasörde zaten "${name}" var` });
        } else {
          console.error("marknote: create failed", err);
          onError({ message: `Oluşturulamadı - ${msg}` });
        }
      }
    },
    [bumpTree, pushUndo, openFileGuarded, onError],
  );

  const handleUndoFileOp = useCallback(async () => {
    const op = undoStackRef.current.pop();
    if (!op) return;
    try {
      if (op.kind === "move") {
        const back = await moveEntry(op.to, dirname(op.from));
        remapAll(op.to, back);
        bumpTree();
        return;
      }
      if (op.kind === "rename") {
        const back = await renameEntry(op.to, basename(op.from));
        remapAll(op.to, back);
        bumpTree();
        return;
      }
      if (op.kind === "create-folder") {
        const entries = await listFolder(op.path);
        if (entries.length > 0) {
          onError({ message: `Geri alınamıyor - ${basename(op.path)} içinde dosya var` });
          return;
        }
        await removeEntry(op.path, true);
        bumpTree();
        return;
      }
      if (op.kind === "create-file") {
        const content = await readMarkdown(op.path);
        const isOpen = samePath(activePath, op.path);
        if (content.length > 0 || (isOpen && dirty)) {
          onError({ message: `Geri alınamıyor - ${basename(op.path)} düzenlendi` });
          return;
        }
        await removeEntry(op.path, false);
        if (isOpen) newBufferGuarded();
        bumpTree();
        return;
      }
    } catch (err) {
      console.error("marknote: undo failed", err);
      onError({ message: `Geri alınamadı - ${err instanceof Error ? err.message : err}` });
    }
  }, [activePath, dirty, bumpTree, remapAll, newBufferGuarded, onError]);

  // Ctrl+Alt+Z (⌥Z produces Ω on macOS — match e.code, not e.key)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.altKey && !e.shiftKey && e.code === "KeyZ") {
        e.preventDefault();
        void handleUndoFileOp();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleUndoFileOp]);

  return {
    treeVersion,
    bumpTree,
    editingPath,
    setEditingPath,
    newEntry,
    setNewEntry,
    handleMove,
    handleSubmitRename,
    handleSubmitNew,
    handleUndoFileOp,
  };
}
