import { RotateCcw, Trash2, X } from "lucide-react";
import { Button, Icon, Overlay } from "@/components/primitives";
import type { Snapshot } from "@/lib";

type SnapshotsOverlayProps = {
  open: boolean;
  snapshots: Snapshot[];
  onRestore: (snapshot: Snapshot) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function SnapshotsOverlay({
  open,
  snapshots,
  onRestore,
  onDelete,
  onClose,
}: SnapshotsOverlayProps) {
  return (
    <Overlay open={open} onClose={onClose} ariaLabel="snapshots" variant="modal">
      <header className="mdv-help__header">
        <div className="mdv-help__title-text">
          <span className="mdv-help__brand">snapshots</span>
          <span className="mdv-help__subtitle">restore a local markdown checkpoint</span>
        </div>
        <Button
          title="close"
          aria-label="close"
          onClick={onClose}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>

      <div className="mdv-snapshots">
        {snapshots.length ? (
          snapshots.map((snapshot) => (
            <div className="mdv-snapshots__row" key={snapshot.id}>
              <div className="mdv-snapshots__meta">
                <span className="mdv-snapshots__label">{snapshot.label}</span>
                <span className="mdv-snapshots__sub">
                  {formatDate(snapshot.createdAt)}
                  {snapshot.path ? ` · ${snapshot.path}` : ""}
                </span>
              </div>
              <div className="mdv-snapshots__actions">
                <button
                  type="button"
                  className="mdv-settings__icon-btn"
                  aria-label="restore snapshot"
                  data-tooltip="restore"
                  onClick={() => onRestore(snapshot)}
                >
                  <Icon icon={RotateCcw} size={12} strokeWidth={1.6} />
                </button>
                <button
                  type="button"
                  className="mdv-settings__icon-btn"
                  aria-label="delete snapshot"
                  data-tooltip="delete"
                  onClick={() => onDelete(snapshot.id)}
                >
                  <Icon icon={Trash2} size={12} strokeWidth={1.6} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="mdv-snapshots__empty">no snapshots yet</p>
        )}
      </div>

      <footer className="mdv-help__footer">
        <span>snapshots stay on this device</span>
      </footer>
    </Overlay>
  );
}
