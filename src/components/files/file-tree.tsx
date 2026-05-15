import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { Icon } from "@/components/primitives";
import { listFolder, type FileEntry } from "@/lib";
import sadUrl from "@/assets/mascot/sad.png";

const DRAG_MIME = "application/x-marka-path";

export type NewEntry = { parent: string; kind: "file" | "folder" };

type FileTreeProps = {
  rootPath: string;
  activePath: string | null;
  onSelect: (path: string) => void;
  onMove?: (src: string, dstParent: string) => void;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
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
          console.error("marka.md: listFolder failed", e);
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
        <img src={sadUrl} alt="" aria-hidden width={56} height={56} className="mdv-tree__error-art" />
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
            depth={depth}
          />
        );
      })}
    </ul>
  );
}

type FolderNodeProps = {
  entry: FileEntry;
  activePath: string | null;
  onSelect: (path: string) => void;
  onMove?: (src: string, dstParent: string) => void;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
  editingPath?: string | null;
  onSubmitRename?: (src: string, newName: string) => void;
  onCancelEdit?: () => void;
  newEntry?: NewEntry | null;
  onSubmitNew?: (parent: string, kind: "file" | "folder", name: string) => void;
  onCancelNew?: () => void;
  treeVersion: number;
  depth: number;
};

function isDescendantPath(child: string, parent: string): boolean {
  if (child === parent) return true;
  const sep = parent.includes("\\") ? "\\" : "/";
  const prefix = parent.endsWith(sep) ? parent : parent + sep;
  return child.startsWith(prefix);
}

function FolderNode({
  entry,
  activePath,
  onSelect,
  onMove,
  onContextMenu,
  editingPath,
  onSubmitRename,
  onCancelEdit,
  newEntry,
  onSubmitNew,
  onCancelNew,
  treeVersion,
  depth,
}: FolderNodeProps) {
  const [open, setOpen] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // auto-open when a new entry is being created inside us
  useEffect(() => {
    if (newEntry && newEntry.parent === entry.path && !open) setOpen(true);
  }, [newEntry, entry.path, open]);

  const onDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(DRAG_MIME, entry.path);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    if (!onMove) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDropTarget) setIsDropTarget(true);
  };

  const onDragLeave = () => {
    if (isDropTarget) setIsDropTarget(false);
  };

  const onDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDropTarget(false);
    const src = e.dataTransfer.getData(DRAG_MIME);
    if (!src || !onMove) return;
    if (isDescendantPath(entry.path, src)) return; // drop into self or descendant
    onMove(src, entry.path);
  };

  const onCtx = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, entry);
    }
  };

  return (
    <li className="mdv-tree__item" role="treeitem" aria-expanded={open}>
      <button
        type="button"
        draggable
        className={`mdv-tree__row mdv-tree__row--folder${isDropTarget ? " is-drop-target" : ""}`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={toggle}
        onContextMenu={onCtx}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        title={entry.name}
      >
        <span className={`mdv-tree__chevron${open ? " is-open" : ""}`}>
          <Icon icon={ChevronRight} size={12} strokeWidth={2} />
        </span>
        <span className="mdv-tree__icon">
          <Icon icon={open ? FolderOpen : Folder} size={13} strokeWidth={1.5} />
        </span>
        <span className="mdv-tree__name">{entry.name}</span>
      </button>
      {open ? (
        <FileTree
          rootPath={entry.path}
          activePath={activePath}
          onSelect={onSelect}
          onMove={onMove}
          onContextMenu={onContextMenu}
          editingPath={editingPath}
          onSubmitRename={onSubmitRename}
          onCancelEdit={onCancelEdit}
          newEntry={newEntry}
          onSubmitNew={onSubmitNew}
          onCancelNew={onCancelNew}
          treeVersion={treeVersion}
          depth={depth + 1}
        />
      ) : null}
    </li>
  );
}

type FileNodeProps = {
  entry: FileEntry;
  active: boolean;
  onSelect: (path: string) => void;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
  depth: number;
};

function FileNode({ entry, active, onSelect, onContextMenu, depth }: FileNodeProps) {
  const onDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(DRAG_MIME, entry.path);
    e.dataTransfer.effectAllowed = "move";
  };

  const onCtx = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, entry);
    }
  };

  return (
    <li className="mdv-tree__item" role="treeitem" aria-selected={active}>
      <button
        type="button"
        draggable
        className={`mdv-tree__row mdv-tree__row--file${active ? " is-active" : ""}`}
        style={{ paddingLeft: `${8 + depth * 12 + 4}px` }}
        onClick={() => onSelect(entry.path)}
        onContextMenu={onCtx}
        onDragStart={onDragStart}
        title={entry.path}
      >
        <span className="mdv-tree__icon">
          <Icon icon={FileText} size={13} strokeWidth={1.5} />
        </span>
        <span className="mdv-tree__name">{entry.name}</span>
      </button>
    </li>
  );
}

type EditableRowProps = {
  depth: number;
  kind: "file" | "folder";
  initialValue: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
};

function EditableRow({ depth, kind, initialValue, onSubmit, onCancel }: EditableRowProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // select basename without the .md extension for fast rename
    const dot = initialValue.lastIndexOf(".");
    if (dot > 0) input.setSelectionRange(0, dot);
    else input.select();
  }, [initialValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    if (trimmed === initialValue) {
      onCancel();
      return;
    }
    onSubmit(trimmed);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const Glyph = kind === "folder" ? Folder : FileText;
  const padLeft = 8 + depth * 12 + (kind === "file" ? 4 : 0);

  return (
    <li className="mdv-tree__item">
      <div
        className={`mdv-tree__row mdv-tree__row--editing mdv-tree__row--${kind}`}
        style={{ paddingLeft: `${padLeft}px` }}
      >
        {kind === "folder" ? (
          <span className="mdv-tree__chevron" aria-hidden>
            <Icon icon={ChevronRight} size={12} strokeWidth={2} />
          </span>
        ) : null}
        <span className="mdv-tree__icon">
          <Icon icon={Glyph} size={13} strokeWidth={1.5} />
        </span>
        <input
          ref={inputRef}
          className="mdv-tree__edit-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={submit}
          onKeyDown={onKey}
          aria-label={`${kind} name`}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </li>
  );
}
