import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { Icon } from "@/components/primitives";
import { isMarkdownPath, listFolder, type FileEntry } from "@/lib";
import sadUrl from "@/assets/mascot/sad.png";

type FileTreeProps = {
  rootPath: string;
  activePath: string | null;
  selectedPaths: ReadonlySet<string>;
  onSelect: (path: string) => void;
  onToggleSelection: (path: string) => void;
  depth?: number;
};

export function FileTree({
  rootPath,
  activePath,
  selectedPaths,
  onSelect,
  onToggleSelection,
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
            selectedPaths={selectedPaths}
            onSelect={onSelect}
            onToggleSelection={onToggleSelection}
            depth={depth}
          />
        ) : (
          <FileNode
            key={entry.path}
            entry={entry}
            active={activePath === entry.path}
            selected={selectedPaths.has(entry.path)}
            onSelect={onSelect}
            onToggleSelection={onToggleSelection}
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
  selectedPaths: ReadonlySet<string>;
  onSelect: (path: string) => void;
  onToggleSelection: (path: string) => void;
  depth: number;
};

function FolderNode({
  entry,
  activePath,
  selectedPaths,
  onSelect,
  onToggleSelection,
  depth,
}: FolderNodeProps) {
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
          selectedPaths={selectedPaths}
          onSelect={onSelect}
          onToggleSelection={onToggleSelection}
          depth={depth + 1}
        />
      ) : null}
    </li>
  );
}

type FileNodeProps = {
  entry: FileEntry;
  active: boolean;
  selected: boolean;
  onSelect: (path: string) => void;
  onToggleSelection: (path: string) => void;
  depth: number;
};

function FileNode({ entry, active, selected, onSelect, onToggleSelection, depth }: FileNodeProps) {
  const isMd = isMarkdownPath(entry.path);

  return (
    <li className="mdv-tree__item" role="treeitem" aria-selected={active}>
      <div
        className={`mdv-tree__row mdv-tree__row--file${active ? " is-active" : ""}${selected ? " is-checked" : ""}`}
        style={{ paddingLeft: `${8 + depth * 12 + 16}px` }}
        title={entry.path}
      >
        {isMd ? (
          <button
            type="button"
            className={`mdv-tree__check${selected ? " is-checked" : ""}`}
            aria-label={selected ? "remove from bundle" : "add to bundle"}
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection(entry.path);
            }}
          >
            {selected ? <Icon icon={Check} size={11} strokeWidth={2.5} /> : null}
          </button>
        ) : (
          <span className="mdv-tree__check mdv-tree__check--spacer" aria-hidden />
        )}
        <button
          type="button"
          className="mdv-tree__row-main"
          onClick={() => onSelect(entry.path)}
        >
          <span className="mdv-tree__icon">
            <Icon icon={FileText} size={13} strokeWidth={1.5} />
          </span>
          <span className="mdv-tree__name">{entry.name}</span>
        </button>
      </div>
    </li>
  );
}
