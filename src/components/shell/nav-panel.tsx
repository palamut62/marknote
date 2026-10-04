import type { MouseEvent as ReactMouseEvent } from "react";
import { Clock, FileText, FolderOpen, FolderPlus, NotebookPen, Pin, Plus, Settings, Trash2 } from "lucide-react";
import { Icon } from "@/components/primitives";
import { FileTree, type NewEntry } from "@/components/files/file-tree";
import { basename, shortcutLabel, type FileEntry } from "@/lib";

export type NavSection =
  | { kind: "all" }
  | { kind: "recent" }
  | { kind: "pinned" }
  | { kind: "trash" }
  | { kind: "folder"; path: string };

type NavPanelProps = {
  section: NavSection;
  onSelectSection: (section: NavSection) => void;
  counts: { all: number | null; pinned: number; trash: number };
  rootPath: string | null;
  onNewNote: () => void;
  onOpenFolder: () => void;
  onNewFolder: () => void;
  onShowSettings: () => void;
  // folder tree (reuses the file tree in folders-only mode)
  onMove: (src: string, dstParent: string) => void;
  onFolderContextMenu: (e: ReactMouseEvent, entry: FileEntry) => void;
  editingPath: string | null;
  onSubmitRename: (src: string, newName: string) => void;
  onCancelEdit: () => void;
  newEntry: NewEntry | null;
  onSubmitNew: (parent: string, kind: "file" | "folder", name: string) => void;
  onCancelNew: () => void;
  treeVersion: number;
};

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  count?: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`mdv-nav__item${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <Icon icon={icon} size={16} strokeWidth={1.7} />
      <span className="mdv-nav__label">{label}</span>
      {count != null && count > 0 ? <span className="mdv-nav__count">{count}</span> : null}
    </button>
  );
}

export function NavPanel({
  section,
  onSelectSection,
  counts,
  rootPath,
  onNewNote,
  onOpenFolder,
  onNewFolder,
  onShowSettings,
  onMove,
  onFolderContextMenu,
  editingPath,
  onSubmitRename,
  onCancelEdit,
  newEntry,
  onSubmitNew,
  onCancelNew,
  treeVersion,
}: NavPanelProps) {
  return (
    <nav className="mdv-nav" aria-label="Notlar">
      <div className="mdv-nav__brand">
        <Icon icon={NotebookPen} size={17} strokeWidth={1.7} />
        <span>Notlarım</span>
      </div>

      <button type="button" className="mdv-nav__new" onClick={onNewNote} data-tooltip={shortcutLabel("Yeni not (⌘N)")}>
        <Icon icon={Plus} size={16} strokeWidth={2} />
        <span>Yeni not</span>
      </button>

      <div className="mdv-nav__group">
        <NavItem icon={FileText} label="Tüm notlar" count={counts.all} active={section.kind === "all"} onClick={() => onSelectSection({ kind: "all" })} />
        <NavItem icon={Clock} label="Son açılanlar" active={section.kind === "recent"} onClick={() => onSelectSection({ kind: "recent" })} />
        <NavItem icon={Pin} label="Sabitlenenler" count={counts.pinned} active={section.kind === "pinned"} onClick={() => onSelectSection({ kind: "pinned" })} />
      </div>

      <div className="mdv-nav__folders">
        <div className="mdv-nav__heading">
          <span>Klasörler</span>
          {rootPath ? (
            <button type="button" className="mdv-nav__heading-btn" aria-label="Yeni klasör" data-tooltip="Yeni klasör" onClick={onNewFolder}>
              <Icon icon={FolderPlus} size={14} strokeWidth={1.7} />
            </button>
          ) : null}
        </div>
        {rootPath ? (
          <div className="mdv-nav__tree">
            <button
              type="button"
              className={`mdv-nav__root${section.kind === "folder" && section.path === rootPath ? " is-active" : ""}`}
              title={rootPath}
              onClick={() => onSelectSection({ kind: "folder", path: rootPath })}
            >
              <Icon icon={FolderOpen} size={15} strokeWidth={1.7} />
              <span>{basename(rootPath)}</span>
            </button>
            <FileTree
              rootPath={rootPath}
              activePath={null}
              onSelect={() => undefined}
              foldersOnly
              selectedFolder={section.kind === "folder" ? section.path : null}
              onSelectFolder={(path) => onSelectSection({ kind: "folder", path })}
              onMove={onMove}
              onContextMenu={onFolderContextMenu}
              editingPath={editingPath}
              onSubmitRename={onSubmitRename}
              onCancelEdit={onCancelEdit}
              newEntry={newEntry}
              onSubmitNew={onSubmitNew}
              onCancelNew={onCancelNew}
              treeVersion={treeVersion}
              depth={1}
            />
          </div>
        ) : (
          <button type="button" className="mdv-nav__item" onClick={onOpenFolder}>
            <Icon icon={FolderOpen} size={16} strokeWidth={1.7} />
            <span className="mdv-nav__label">Klasör aç</span>
          </button>
        )}
      </div>

      <div className="mdv-nav__footer">
        <NavItem icon={Trash2} label="Çöp kutusu" count={counts.trash} active={section.kind === "trash"} onClick={() => onSelectSection({ kind: "trash" })} />
        <NavItem icon={Settings} label="Ayarlar" active={false} onClick={onShowSettings} />
      </div>
    </nav>
  );
}
