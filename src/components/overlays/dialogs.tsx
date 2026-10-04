import { useEffect, useId, useState, type ReactNode } from "react";
import { Overlay } from "@/components/primitives";

/**
 * In-app replacements for window.confirm / window.prompt (native dialogs are
 * not allowed). Both trap focus via Overlay and return focus on close.
 */

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Vazgeç",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  return (
    <Overlay open={open} onClose={onCancel} ariaLabel={title} variant="dialog">
      <div className="mdv-dialog" aria-labelledby={titleId}>
        <h2 id={titleId} className="mdv-dialog__title">{title}</h2>
        {children ? <div className="mdv-dialog__body">{children}</div> : null}
        <div className="mdv-dialog__actions">
          <button type="button" className="mdv-btn mdv-btn--quiet" onClick={onCancel} data-autofocus={destructive || undefined}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`mdv-btn ${destructive ? "mdv-btn--danger" : "mdv-btn--primary"}`}
            onClick={onConfirm}
            disabled={busy}
            data-autofocus={destructive ? undefined : true}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

type PromptDialogProps = {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel: string;
  /** return an error message to block submission */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

export function PromptDialog({
  open,
  title,
  label,
  initialValue = "",
  confirmLabel,
  validate,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputId = useId();
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);
  const error = value.trim() ? validate?.(value.trim()) ?? null : null;
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || error) return;
    onSubmit(trimmed);
  };
  return (
    <Overlay open={open} onClose={onCancel} ariaLabel={title} variant="dialog">
      <form
        className="mdv-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2 className="mdv-dialog__title">{title}</h2>
        <label className="mdv-dialog__field" htmlFor={inputId}>
          <span>{label}</span>
          <input
            id={inputId}
            className="mdv-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => {
              // select the name without its extension, like a file manager
              const dot = e.target.value.lastIndexOf(".");
              e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
            }}
            aria-invalid={error ? true : undefined}
            data-autofocus
            spellCheck={false}
          />
        </label>
        {error ? <p className="mdv-dialog__error" role="alert">{error}</p> : null}
        <div className="mdv-dialog__actions">
          <button type="button" className="mdv-btn mdv-btn--quiet" onClick={onCancel}>Vazgeç</button>
          <button type="submit" className="mdv-btn mdv-btn--primary" disabled={!value.trim() || !!error}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

type UnsavedChangesDialogProps = {
  open: boolean;
  fileName: string;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedChangesDialog({
  open,
  fileName,
  saving,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <Overlay open={open} onClose={onCancel} ariaLabel="Kaydedilmemiş değişiklikler" variant="dialog">
      <div className="mdv-dialog">
        <h2 className="mdv-dialog__title">Değişiklikler kaydedilsin mi?</h2>
        <div className="mdv-dialog__body">
          <strong>{fileName}</strong> içindeki son değişiklikler henüz kaydedilmedi.
          Kaydetmezseniz bu değişiklikler kaybolur.
        </div>
        <div className="mdv-dialog__actions">
          <button type="button" className="mdv-btn mdv-btn--danger-quiet" onClick={onDiscard}>Kaydetme</button>
          <span className="mdv-dialog__spacer" />
          <button type="button" className="mdv-btn mdv-btn--quiet" onClick={onCancel}>İptal</button>
          <button type="button" className="mdv-btn mdv-btn--primary" onClick={onSave} disabled={saving} data-autofocus>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

type RecoveryDialogProps = {
  open: boolean;
  fileName: string;
  chars: number;
  onRestore: () => void;
  onDiscard: () => void;
};

/** F03: the draft is only removed after an explicit choice; no dismiss-by-Escape. */
export function RecoveryDialog({ open, fileName, chars, onRestore, onDiscard }: RecoveryDialogProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => {
    if (!open) setConfirmDiscard(false);
  }, [open]);
  return (
    <Overlay open={open} onClose={() => undefined} ariaLabel="Kaydedilmemiş taslak bulundu" variant="dialog" dismissible={false}>
      <div className="mdv-dialog">
        <h2 className="mdv-dialog__title">Kaydedilmemiş taslak bulundu</h2>
        <div className="mdv-dialog__body">
          Önceki oturumdan <strong>{fileName}</strong> için kaydedilmemiş bir taslak kaldı ({chars.toLocaleString("tr-TR")} karakter).
          Geri yükleyebilir ya da kalıcı olarak silebilirsiniz.
          {confirmDiscard ? (
            <p className="mdv-dialog__warning" role="alert">Taslak silinecek ve geri getirilemeyecek. Emin misiniz?</p>
          ) : null}
        </div>
        <div className="mdv-dialog__actions">
          {confirmDiscard ? (
            <>
              <button type="button" className="mdv-btn mdv-btn--quiet" onClick={() => setConfirmDiscard(false)} data-autofocus>Vazgeç</button>
              <button type="button" className="mdv-btn mdv-btn--danger" onClick={onDiscard}>Taslağı sil</button>
            </>
          ) : (
            <>
              <button type="button" className="mdv-btn mdv-btn--danger-quiet" onClick={() => setConfirmDiscard(true)}>Taslağı sil</button>
              <span className="mdv-dialog__spacer" />
              <button type="button" className="mdv-btn mdv-btn--primary" onClick={onRestore} data-autofocus>Geri yükle</button>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}

type SecretSendDialogProps = {
  open: boolean;
  secretCount: number;
  chars: number;
  onSendMasked: () => void;
  onSendRaw: () => void;
  onCancel: () => void;
};

/**
 * Shown before an AI request whose text contains detected keys/tokens: the
 * on-screen dots only hide them visually, so the user decides what leaves the device.
 */
export function SecretSendDialog({ open, secretCount, chars, onSendMasked, onSendRaw, onCancel }: SecretSendDialogProps) {
  return (
    <Overlay open={open} onClose={onCancel} ariaLabel="Gizli bilgi uyarısı" variant="dialog">
      <div className="mdv-dialog">
        <h2 className="mdv-dialog__title">Metinde gizli bilgi var</h2>
        <div className="mdv-dialog__body">
          OpenRouter'a gönderilecek {chars.toLocaleString("tr-TR")} karakterlik metinde {secretCount} API anahtarı / parola benzeri değer bulundu.
          Ekranda gizli görünmeleri, gönderilmeyecekleri anlamına gelmez. Maskelenmiş gönderimde bu değerler yer tutucuyla değiştirilir ve sonuç uygulanırken geri konur.
        </div>
        <div className="mdv-dialog__actions">
          <button type="button" className="mdv-btn mdv-btn--danger-quiet" onClick={onSendRaw}>Olduğu gibi gönder</button>
          <span className="mdv-dialog__spacer" />
          <button type="button" className="mdv-btn mdv-btn--quiet" onClick={onCancel}>Vazgeç</button>
          <button type="button" className="mdv-btn mdv-btn--primary" onClick={onSendMasked} data-autofocus>Maskeleyerek gönder</button>
        </div>
      </div>
    </Overlay>
  );
}
