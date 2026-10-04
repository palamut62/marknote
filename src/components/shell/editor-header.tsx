import { useRef } from "react";
import { AlertCircle, Check, ChevronRight, Circle, Loader2, Maximize2, Menu, Minimize2, MoreHorizontal, PanelLeft } from "lucide-react";
import { Icon } from "@/components/primitives";
import { shortcutLabel, startWindowDrag } from "@/lib";
import type { SaveStatus } from "@/hooks/use-file-session";

export type ViewMode = "write" | "markdown" | "split" | "read";

export const VIEW_LABELS: Record<ViewMode, string> = {
  write: "Yaz",
  markdown: "Markdown",
  split: "Bölünmüş",
  read: "Okuma",
};

type EditorHeaderProps = {
  folderLabel: string | null;
  title: string;
  isNew: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  onSave: () => void;
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  onOpenMenu: (anchor: DOMRect) => void;
  /** narrow windows: show buttons that re-open the hidden panels */
  showNavButton: boolean;
  onToggleNav: () => void;
  showListButton: boolean;
  onToggleList: () => void;
};

function StatusChip({ status, isNew, error, onSave }: { status: SaveStatus; isNew: boolean; error: string | null; onSave: () => void }) {
  switch (status) {
    case "saving":
      return (
        <span className="mdv-save mdv-save--saving" role="status">
          <span className="mdv-spin"><Icon icon={Loader2} size={13} /></span> Kaydediliyor…
        </span>
      );
    case "saved":
      return (
        <span className="mdv-save mdv-save--saved" role="status">
          <Icon icon={Check} size={13} strokeWidth={2.2} /> Kaydedildi
        </span>
      );
    case "error":
      return (
        <span className="mdv-save mdv-save--error" role="alert" title={error ?? undefined}>
          <Icon icon={AlertCircle} size={13} /> Kayıt başarısız
          <button type="button" className="mdv-save__action" onClick={onSave}>Tekrar dene</button>
        </span>
      );
    case "dirty":
    case "unsaved":
      return (
        <span className="mdv-save mdv-save--dirty" role="status">
          <Icon icon={Circle} size={9} strokeWidth={3} /> Kaydedilmedi
          <button type="button" className="mdv-save__action" onClick={onSave} data-tooltip={shortcutLabel(isNew ? "Kaydedilecek yeri seç (⌘S)" : "Kaydet (⌘S)")}>
            {isNew ? "Kaydet…" : "Kaydet"}
          </button>
        </span>
      );
    default:
      return isNew ? null : (
        <span className="mdv-save mdv-save--idle" role="status">
          <Icon icon={Check} size={13} /> Kaydedildi
        </span>
      );
  }
}

export function EditorHeader({
  folderLabel,
  title,
  isNew,
  saveStatus,
  saveError,
  onSave,
  viewMode,
  onViewMode,
  focusMode,
  onToggleFocus,
  onOpenMenu,
  showNavButton,
  onToggleNav,
  showListButton,
  onToggleList,
}: EditorHeaderProps) {
  const menuRef = useRef<HTMLButtonElement>(null);
  return (
    <header className="mdv-doc-header" data-tauri-drag-region onMouseDown={startWindowDrag}>
      <div className="mdv-doc-header__left" data-tauri-drag-region>
        {showNavButton ? (
          <button type="button" className="mdv-tool" aria-label="Gezinme panelini aç" data-tooltip="Notlarım" onClick={onToggleNav}>
            <Icon icon={Menu} size={16} />
          </button>
        ) : null}
        {showListButton ? (
          <button type="button" className="mdv-tool mdv-tool--label" aria-label="Not listesini aç" onClick={onToggleList}>
            <Icon icon={PanelLeft} size={16} /> <span>Notlar</span>
          </button>
        ) : null}
        <nav className="mdv-crumbs" aria-label="Konum" data-tauri-drag-region>
          {folderLabel ? (
            <>
              <span className="mdv-crumbs__folder">{folderLabel}</span>
              <Icon icon={ChevronRight} size={13} />
            </>
          ) : null}
          <span className="mdv-crumbs__title" aria-current="page">{title}</span>
        </nav>
      </div>
      <div className="mdv-doc-header__right">
        {viewMode !== "write" ? (
          <span className="mdv-viewpill">
            {VIEW_LABELS[viewMode]} görünümü
            <button type="button" className="mdv-save__action" onClick={() => onViewMode("write")}>Yaz'a dön</button>
          </span>
        ) : null}
        <StatusChip status={saveStatus} isNew={isNew} error={saveError} onSave={onSave} />
        <button
          type="button"
          className={`mdv-tool${focusMode ? " is-active" : ""}`}
          aria-label={focusMode ? "Odak modundan çık" : "Odak modu"}
          aria-pressed={focusMode}
          data-tooltip={shortcutLabel(focusMode ? "Odak modundan çık (⌘⇧.)" : "Odak modu (⌘⇧.)")}
          onClick={onToggleFocus}
        >
          <Icon icon={focusMode ? Minimize2 : Maximize2} size={16} />
        </button>
        <button
          ref={menuRef}
          type="button"
          className="mdv-tool"
          aria-label="Diğer işlemler"
          aria-haspopup="menu"
          data-tooltip="Diğer işlemler"
          onClick={() => menuRef.current && onOpenMenu(menuRef.current.getBoundingClientRect())}
        >
          <Icon icon={MoreHorizontal} size={18} />
        </button>
      </div>
    </header>
  );
}
