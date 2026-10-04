import { History, RotateCcw, Save, Trash2, X } from "lucide-react";
import { Button, Icon, Overlay } from "@/components/primitives";
import type { HistoryEntry } from "@/lib/history";

type HistoryOverlayProps = {
  open: boolean;
  /** note the list belongs to — shown so it is clear whose history this is */
  noteName: string;
  entries: HistoryEntry[] | null;
  error: string | null;
  busy: boolean;
  onSaveVersion: () => void;
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  onClose: () => void;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} bayt` : `${(bytes / 1024).toFixed(1)} KB`;
}

/** Per-note version history (F11). Only the open note's versions are listed. */
export function HistoryOverlay({
  open,
  noteName,
  entries,
  error,
  busy,
  onSaveVersion,
  onRestore,
  onDelete,
  onClose,
}: HistoryOverlayProps) {
  return (
    <Overlay open={open} onClose={onClose} ariaLabel="Sürüm geçmişi" variant="modal">
      <header className="mdv-help__header">
        <div className="mdv-help__title-text">
          <span className="mdv-help__brand">Sürüm geçmişi</span>
          <span className="mdv-help__subtitle">{noteName} · not başına en fazla 20 sürüm</span>
        </div>
        <Button title="Kapat" aria-label="Kapat" onClick={onClose} icon={<Icon icon={X} size={14} strokeWidth={1.5} />} />
      </header>

      <div className="mdv-snapshots">
        {error ? <p className="mdv-dialog__error" role="alert">{error}</p> : null}
        {entries == null ? (
          <p className="mdv-snapshots__empty">Yükleniyor…</p>
        ) : entries.length ? (
          entries.map((entry) => (
            <div className="mdv-snapshots__row" key={entry.id}>
              <div className="mdv-snapshots__meta">
                <span className="mdv-snapshots__label">{entry.label}</span>
                <span className="mdv-snapshots__sub">{formatDate(entry.createdAt)} · {formatSize(entry.size)}</span>
              </div>
              <div className="mdv-snapshots__actions">
                <button type="button" className="mdv-btn mdv-btn--quiet" disabled={busy} onClick={() => onRestore(entry)}>
                  <Icon icon={RotateCcw} size={13} /> Geri yükle
                </button>
                <button
                  type="button"
                  className="mdv-btn mdv-btn--danger-quiet"
                  aria-label={`${entry.label} sürümünü sil`}
                  disabled={busy}
                  onClick={() => onDelete(entry)}
                >
                  <Icon icon={Trash2} size={13} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="mdv-snapshots__empty">
            <Icon icon={History} size={14} /> Bu not için henüz kayıtlı sürüm yok.
          </p>
        )}
      </div>

      <footer className="mdv-help__footer mdv-history__footer">
        <span>Sürümler bu bilgisayarda, uygulama verisi klasöründe saklanır; şifrelenmez.</span>
        <button type="button" className="mdv-btn mdv-btn--primary" disabled={busy} onClick={onSaveVersion}>
          <Icon icon={Save} size={13} /> Şimdiki hâli sürüm olarak kaydet
        </button>
      </footer>
    </Overlay>
  );
}
