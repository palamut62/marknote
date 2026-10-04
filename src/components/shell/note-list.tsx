import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import { FolderOpen, Loader2, Pin, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Icon } from "@/components/primitives";
import { DRAG_MIME } from "@/components/files/folder-node";
import { shortcutLabel } from "@/lib";
import type { SearchHit } from "@/lib/notes-index";
import type { TrashItem } from "@/lib/trash";
import { samePath } from "@/lib/paths";

export type NoteListItem = {
  path: string;
  title: string;
  excerpt: string;
  mtime: number | null;
  /** folder label shown in the meta line ("İş", "İş/2026") */
  folder: string;
  pinned: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

export function formatNoteDate(ms: number | null, now = Date.now()): string {
  if (ms == null) return "";
  const date = new Date(ms);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (diff <= 0) return `Bugün ${date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
  if (diff <= DAY) return "Dün";
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString("tr-TR", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

type NoteListProps = {
  heading: string;
  items: NoteListItem[];
  selectedPath: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  searchHits: SearchHit[] | null;
  /** short limit / problem notes ("ilk 200 sonuç", "3 dosya okunamadı") */
  notices: string[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  hasFolder: boolean;
  onOpenFolder: () => void;
  onNewNote: () => void;
  onSelect: (path: string, match?: string) => void;
  onContextMenu: (e: ReactMouseEvent, path: string) => void;
  emptyText: string;
  // trash view
  trash: TrashItem[] | null;
  onRestore: (item: TrashItem) => void;
  onDeleteForever: (item: TrashItem) => void;
  onEmptyTrash: () => void;
};

function Highlight({ text, match }: { text: string; match: string }) {
  if (!match) return <>{text}</>;
  const idx = text.toLocaleLowerCase("tr").indexOf(match.toLocaleLowerCase("tr"));
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + match.length)}</mark>
      {text.slice(idx + match.length)}
    </>
  );
}

export function NoteList({
  heading,
  items,
  selectedPath,
  query,
  onQueryChange,
  searchHits,
  notices,
  loading,
  error,
  onRetry,
  hasFolder,
  onOpenFolder,
  onNewNote,
  onSelect,
  onContextMenu,
  emptyText,
  trash,
  onRestore,
  onDeleteForever,
  onEmptyTrash,
}: NoteListProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const searching = query.trim().length > 0 && searchHits != null;
  const count = trash ? trash.length : searching ? searchHits.length : items.length;

  return (
    <section className="mdv-list" aria-label={heading}>
      <header className="mdv-list__header">
        <h2 className="mdv-list__title">{searching ? "Arama sonuçları" : heading}</h2>
        <span className="mdv-list__count">
          {trash ? `${count} öğe` : `${count} ${searching ? "sonuç" : "not"}`}
        </span>
      </header>

      {trash ? null : (
        <div className="mdv-list__search">
          <Icon icon={Search} size={15} strokeWidth={1.8} />
          <label className="mdv-visually-hidden" htmlFor="mdv-note-search">Notlarda ara</label>
          <input
            id="mdv-note-search"
            ref={searchRef}
            className="mdv-list__search-input"
            type="search"
            placeholder={hasFolder ? "Notlarda ara…" : "Aramak için klasör açın"}
            disabled={!hasFolder}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.stopPropagation();
                onQueryChange("");
              }
            }}
            data-tooltip={shortcutLabel("Başlık ve içerikte ara (⌘⇧F)")}
          />
          {query ? (
            <button type="button" className="mdv-list__search-clear" aria-label="Aramayı temizle" onClick={() => { onQueryChange(""); searchRef.current?.focus(); }}>
              <Icon icon={X} size={14} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      )}

      {notices.length > 0 ? (
        <p className="mdv-list__notice" role="status">{notices.join(" · ")}</p>
      ) : null}

      <div className="mdv-list__body">
        {error ? (
          <div className="mdv-list__empty" role="alert">
            <p>{error}</p>
            <button type="button" className="mdv-btn mdv-btn--quiet" onClick={onRetry}>Tekrar dene</button>
          </div>
        ) : loading && count === 0 ? (
          <div className="mdv-list__empty" role="status">
            <span className="mdv-spin"><Icon icon={Loader2} size={16} /></span>
            <p>Notlar yükleniyor…</p>
          </div>
        ) : trash ? (
          trash.length === 0 ? (
            <div className="mdv-list__empty">
              <p>Çöp kutusu boş.</p>
              <p className="mdv-list__hint">Silinen notlar burada durur; geri yükleyebilir ya da kalıcı olarak silebilirsiniz.</p>
            </div>
          ) : (
            <>
              <ul className="mdv-list__items">
                {trash.map((item) => (
                  <li key={item.id} className="mdv-row mdv-row--trash">
                    <div className="mdv-row__main">
                      <span className="mdv-row__title">{item.name}</span>
                      <span className="mdv-row__excerpt" title={item.originalPath}>{item.originalPath}</span>
                      <span className="mdv-row__meta">{formatNoteDate(item.deletedAt)} silindi{item.isDir ? " · klasör" : ""}</span>
                    </div>
                    <div className="mdv-row__actions">
                      <button type="button" className="mdv-btn mdv-btn--quiet" onClick={() => onRestore(item)}>
                        <Icon icon={RotateCcw} size={14} /> Geri yükle
                      </button>
                      <button type="button" className="mdv-btn mdv-btn--danger-quiet" aria-label={`${item.name} kalıcı olarak sil`} onClick={() => onDeleteForever(item)}>
                        <Icon icon={Trash2} size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mdv-list__footer">
                <button type="button" className="mdv-btn mdv-btn--danger-quiet" onClick={onEmptyTrash}>Çöp kutusunu boşalt</button>
              </div>
            </>
          )
        ) : !hasFolder && items.length === 0 ? (
          <div className="mdv-list__empty">
            <p>Notlarınızı görmek için bir klasör açın.</p>
            <p className="mdv-list__hint">Notlar bilgisayarınızda, seçtiğiniz klasörde düz metin dosyaları olarak durur.</p>
            <div className="mdv-list__empty-actions">
              <button type="button" className="mdv-btn mdv-btn--primary" onClick={onOpenFolder}>
                <Icon icon={FolderOpen} size={15} /> Klasör aç
              </button>
              <button type="button" className="mdv-btn mdv-btn--quiet" onClick={onNewNote}>
                <Icon icon={Plus} size={15} /> Yeni not
              </button>
            </div>
          </div>
        ) : searching ? (
          searchHits.length === 0 ? (
            <div className="mdv-list__empty">
              <p>"{query.trim()}" için sonuç yok.</p>
              <p className="mdv-list__hint">Başlıklarda ve not içeriklerinde arandı.</p>
            </div>
          ) : (
            <ul className="mdv-list__items" role="listbox" aria-label="Arama sonuçları">
              {searchHits.map((hit) => (
                <li key={`${hit.path}:${hit.kind}:${hit.line ?? 0}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={samePath(selectedPath, hit.path)}
                    className={`mdv-row${samePath(selectedPath, hit.path) ? " is-active" : ""}`}
                    onClick={() => onSelect(hit.path, hit.kind === "content" ? hit.match : undefined)}
                  >
                    <span className="mdv-row__title"><Highlight text={hit.title} match={hit.kind === "title" ? hit.match : ""} /></span>
                    <span className="mdv-row__excerpt"><Highlight text={hit.excerpt} match={hit.kind === "content" ? hit.match : ""} /></span>
                    <span className="mdv-row__meta">{hit.kind === "content" ? `Satır ${hit.line} · ${hit.rel}` : hit.rel}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : items.length === 0 ? (
          <div className="mdv-list__empty"><p>{emptyText}</p></div>
        ) : (
          <ul className="mdv-list__items" role="listbox" aria-label={heading}>
            {items.map((item) => {
              const active = samePath(selectedPath, item.path);
              return (
                <li key={item.path}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`mdv-row${active ? " is-active" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_MIME, item.path);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onSelect(item.path)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onContextMenu(e, item.path);
                    }}
                    title={item.path}
                  >
                    <span className="mdv-row__title">
                      {item.pinned ? <span className="mdv-row__pin"><Icon icon={Pin} size={12} title="Sabitlendi" /></span> : null}
                      {item.title}
                    </span>
                    {item.excerpt ? <span className="mdv-row__excerpt">{item.excerpt}</span> : null}
                    <span className="mdv-row__meta">
                      {[formatNoteDate(item.mtime), item.folder].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
