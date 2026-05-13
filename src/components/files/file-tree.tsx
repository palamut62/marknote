import { useCallback, useEffect, useState } from "react";
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { Icon } from "@/components/primitives";
import { listFolder, type FileEntry } from "@/lib";
import sadUrl from "@/assets/mascot/sad.png";

type FileTreeProps = {
  rootPath: string;
  activePath: string | null;
  onSelect: (path: string) => void;
  depth?: number;
};

export function FileTree({ rootPath, activePath, onSelect, depth = 0 }: FileTreeProps) {
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
  }, [rootPath]);

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
  if (entries.length === 0 && depth === 0) {
    return <div className="mdv-tree__empty">empty folder</div>;
  }

  return (
    <ul className="mdv-tree" role={depth === 0 ? "tree" : "group"}>
      {entries.map((entry) =>
        entry.isDir ? (
          <FolderNode
            key={entry.path}
            entry={entry}
            activePath={activePath}
            onSelect={onSelect}
            depth={depth}
          />
        ) : (
          <FileNode
            key={entry.path}
            entry={entry}
            active={activePath === entry.path}
            onSelect={onSelect}
            depth={depth}
          />
        ),
      )}
    </ul>
  );
}

type FolderNodeProps = {
  entry: FileEntry;
  activePath: string | null;
  onSelect: (path: string) => void;
  depth: number;
};

function FolderNode({ entry, activePath, onSelect, depth }: FolderNodeProps) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <li className="mdv-tree__item" role="treeitem" aria-expanded={open}>
      <button
        type="button"
        className="mdv-tree__row mdv-tree__row--folder"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={toggle}
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
  depth: number;
};

function FileNode({ entry, active, onSelect, depth }: FileNodeProps) {
  return (
    <li className="mdv-tree__item" role="treeitem" aria-selected={active}>
      <button
        type="button"
        className={`mdv-tree__row mdv-tree__row--file${active ? " is-active" : ""}`}
        style={{ paddingLeft: `${8 + depth * 12 + 16}px` }}
        onClick={() => onSelect(entry.path)}
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
