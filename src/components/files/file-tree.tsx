import { useEffect, useState } from "react";
import { listFolder, type FileEntry } from "@/lib";
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
  onNavigate?: (path: string) => void;
  stagedPaths?: readonly string[];
  onToggleStage?: (path: string) => void;
  editingPath?: string | null;
  onSubmitRename?: (src: string, newName: string) => void;
  onCancelEdit?: () => void;
  newEntry?: NewEntry | null;
  onSubmitNew?: (parent: string, kind: "file" | "folder", name: string) => void;
  onCancelNew?: () => void;
  treeVersion?: number;
  depth?: number;
};

export function FileTree({
  rootPath,
  activePath,
  onSelect,
  onMove,
  onContextMenu,
  onRequestRename,
  onNavigate,
  stagedPaths = [],
  onToggleStage,
  editingPath,
  onSubmitRename,
  onCancelEdit,
  newEntry,
  onSubmitNew,
  onCancelNew,
  treeVersion = 0,
  depth = 0,
}: FileTreeProps) {
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listFolder(rootPath)
      .then((items) => {
        if (!cancelled) setEntries(items);
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
  }, [rootPath, treeVersion]);

  if (error) {
    return (
      <div className="mdv-tree__error">
        <img src={errorIconUrl} alt="" aria-hidden width={56} height={56} className="mdv-tree__error-art" />
        <span>cannot read folder</span>
      </div>
    );
  }
  if (!entries) {
    return <div className="mdv-tree__loading">loading…</div>;
  }
  if (entries.length === 0 && depth === 0 && !(newEntry && newEntry.parent === rootPath)) {
    return <div className="mdv-tree__empty">empty folder</div>;
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
              onNavigate={onNavigate}
              stagedPaths={stagedPaths}
              onToggleStage={onToggleStage}
              editingPath={editingPath}
              onSubmitRename={onSubmitRename}
              onCancelEdit={onCancelEdit}
              newEntry={newEntry}
              onSubmitNew={onSubmitNew}
              onCancelNew={onCancelNew}
              treeVersion={treeVersion}
              depth={depth}
            />
          );
        }
        return (
          <FileNode
            key={entry.path}
            entry={entry}
            active={activePath === entry.path}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            onRequestRename={onRequestRename}
            staged={stagedPaths.includes(entry.path)}
            onToggleStage={onToggleStage}
            depth={depth}
          />
        );
      })}
    </ul>
  );
}
