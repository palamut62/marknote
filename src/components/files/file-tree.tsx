import { useEffect, useState } from "react";
import { isEditablePath, listFolder, type FileEntry } from "@/lib";
import { samePath } from "@/lib/paths";
import errorIconUrl from "@/assets/brand/marka-app-icon.png";
import { EditableRow } from "./editable-row";
import { FileNode, FolderNode } from "./folder-node";

export type NewEntry = { parent: string; kind: "file" | "folder" };

type FileTreeProps = {
  rootPath: string;
  activePath: string | null;
  onSelect: (path: string) => void;
  onMove?: (src: string, dstParent: string) => void;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
  onRequestRename?: (path: string) => void;
  /** Delete key / row trash button -> move to trash */
  onRequestDelete?: (entry: FileEntry) => void;
  onNavigate?: (path: string) => void;
  editingPath?: string | null;
  onSubmitRename?: (src: string, newName: string) => void;
  onCancelEdit?: () => void;
  newEntry?: NewEntry | null;
  onSubmitNew?: (parent: string, kind: "file" | "folder", name: string) => void;
  onCancelNew?: () => void;
  treeVersion?: number;
  depth?: number;
  /** navigation mode: list folders only; clicking a folder selects it */
  foldersOnly?: boolean;
  selectedFolder?: string | null;
  onSelectFolder?: (path: string) => void;
};

export function FileTree({
  rootPath,
  activePath,
  onSelect,
  onMove,
  onContextMenu,
  onRequestRename,
  onRequestDelete,
  onNavigate,
  editingPath,
  onSubmitRename,
  onCancelEdit,
  newEntry,
  onSubmitNew,
  onCancelNew,
  treeVersion = 0,
  depth = 0,
  foldersOnly = false,
  selectedFolder = null,
  onSelectFolder,
}: FileTreeProps) {
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listFolder(rootPath)
      .then((items) => {
        if (!cancelled) setEntries(items.filter((item) => item.isDir || (!foldersOnly && isEditablePath(item.path))));
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("marknote: listFolder failed", e);
          setError(String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rootPath, treeVersion, foldersOnly]);

  if (error) {
    return (
      <div className="mdv-tree__error">
        <img src={errorIconUrl} alt="" aria-hidden width={56} height={56} className="mdv-tree__error-art" />
        <span>Klasör okunamadı</span>
      </div>
    );
  }
  if (!entries) {
    return <div className="mdv-tree__loading">Yükleniyor…</div>;
  }
  if (entries.length === 0 && depth === 0 && !(newEntry && newEntry.parent === rootPath)) {
    return <div className="mdv-tree__empty">{foldersOnly ? "Alt klasör yok" : "Klasör boş"}</div>;
  }

  const showNewEntryHere = newEntry && newEntry.parent === rootPath;

  return (
    <ul className="mdv-tree" role={depth === 0 ? "tree" : "group"}>
      {showNewEntryHere && newEntry && onSubmitNew && onCancelNew ? (
        <EditableRow
          key="__new__"
          depth={depth}
          kind={newEntry.kind}
          initialValue=""
          onSubmit={(name) => onSubmitNew(newEntry.parent, newEntry.kind, name)}
          onCancel={onCancelNew}
        />
      ) : null}
      {entries.map((entry) => {
        if (editingPath === entry.path && onSubmitRename && onCancelEdit) {
          return (
            <EditableRow
              key={entry.path}
              depth={depth}
              kind={entry.isDir ? "folder" : "file"}
              initialValue={entry.name}
              onSubmit={(name) => onSubmitRename(entry.path, name)}
              onCancel={onCancelEdit}
            />
          );
        }
        if (entry.isDir) {
          return (
            <FolderNode
              key={entry.path}
              entry={entry}
              activePath={activePath}
              onSelect={onSelect}
              onMove={onMove}
              onContextMenu={onContextMenu}
              onRequestRename={onRequestRename}
              onRequestDelete={onRequestDelete}
              onNavigate={onNavigate}
              editingPath={editingPath}
              onSubmitRename={onSubmitRename}
              onCancelEdit={onCancelEdit}
              newEntry={newEntry}
              onSubmitNew={onSubmitNew}
              onCancelNew={onCancelNew}
              treeVersion={treeVersion}
              depth={depth}
              foldersOnly={foldersOnly}
              selectedFolder={selectedFolder}
              onSelectFolder={onSelectFolder}
            />
          );
        }
        return (
          <FileNode
            key={entry.path}
            entry={entry}
            active={samePath(activePath, entry.path)}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            onRequestRename={onRequestRename}
            onRequestDelete={onRequestDelete}
            depth={depth}
          />
        );
      })}
    </ul>
  );
}
