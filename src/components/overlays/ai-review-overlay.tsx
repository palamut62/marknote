import { Check, X } from "lucide-react";
import { Button, Icon, Overlay } from "@/components/primitives";

type AiReviewOverlayProps = {
  open: boolean;
  title: string;
  original: string;
  next: string;
  onApply: () => void;
  onClose: () => void;
};

export function AiReviewOverlay({
  open,
  title,
  original,
  next,
  onApply,
  onClose,
}: AiReviewOverlayProps) {
  return (
    <Overlay open={open} onClose={onClose} ariaLabel="Yapay zeka incelemesi" variant="wide">
      <header className="mdv-help__header">
        <div className="mdv-help__title-text">
          <span className="mdv-help__brand">{title}</span>
          <span className="mdv-help__subtitle">Editöre uygulamadan önce incele</span>
        </div>
        <Button
          title="Kapat"
          aria-label="Kapat"
          onClick={onClose}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>

      <div className="mdv-ai-review">
        <section className="mdv-ai-review__pane">
          <h2>Önceki</h2>
          <pre>{original}</pre>
        </section>
        <section className="mdv-ai-review__pane">
          <h2>Önerilen</h2>
          <pre>{next}</pre>
        </section>
      </div>

      <footer className="mdv-help__footer">
        <span>Dosyayı kaydedene kadar değişiklikler yereldir</span>
        <button type="button" className="mdv-help__replay" onClick={onApply}>
          <Icon icon={Check} size={12} strokeWidth={1.7} />
          Uygula
        </button>
      </footer>
    </Overlay>
  );
}
