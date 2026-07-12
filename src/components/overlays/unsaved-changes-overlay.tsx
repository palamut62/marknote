import { Save, Trash2, X } from "lucide-react";
import { Button, Icon, Overlay } from "@/components/primitives";

type UnsavedChangesOverlayProps = {
  open: boolean;
  fileName: string;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedChangesOverlay({
  open,
  fileName,
  saving,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesOverlayProps) {
  return (
    <Overlay open={open} onClose={onCancel} ariaLabel="unsaved changes" variant="modal">
      <header className="mdv-help__header">
        <div className="mdv-help__title-text">
          <span className="mdv-help__brand">unsaved changes</span>
          <span className="mdv-help__subtitle">save {fileName} before continuing?</span>
        </div>
        <Button
          title="cancel"
          aria-label="cancel"
          onClick={onCancel}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>
      <div className="mdv-unsaved__body">
        Your latest edits are only in memory. Discarding them cannot be undone.
      </div>
      <footer className="mdv-unsaved__actions">
        <button type="button" className="mdv-unsaved__button mdv-unsaved__button--danger" onClick={onDiscard}>
          <Icon icon={Trash2} size={13} /> discard
        </button>
        <button type="button" className="mdv-unsaved__button" onClick={onCancel}>cancel</button>
        <button type="button" className="mdv-unsaved__button mdv-unsaved__button--primary" onClick={onSave} disabled={saving}>
          <Icon icon={Save} size={13} /> {saving ? "saving..." : "save"}
        </button>
      </footer>
    </Overlay>
  );
}
