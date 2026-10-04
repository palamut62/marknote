import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  History,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  PanelRight,
  Palette,
  Pilcrow,
  Quote,
  SquareCode,
  Strikethrough,
  Table,
  TimerReset,
  Redo2,
  Undo2,
} from "lucide-react";
import { Icon } from "@/components/primitives";
import type { MarkdownAction } from "@/lib";

type MarkdownToolbarProps = {
  onAction: (action: MarkdownAction) => void;
  onTemplate: (kind: "note" | "readme" | "prompt") => void;
  onSnapshot: () => void;
  onShowSnapshots: () => void;
  onUndo: () => void;
  onRedo: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  textColor: string;
  highlightColor: string;
};

const ACTIONS: ReadonlyArray<{ action: MarkdownAction; label: string; icon: typeof Bold }> = [
  { action: "h1", label: "Başlık 1", icon: Heading1 },
  { action: "h2", label: "Başlık 2", icon: Heading2 },
  { action: "h3", label: "Başlık 3", icon: Heading3 },
  { action: "bold", label: "Kalın", icon: Bold },
  { action: "italic", label: "İtalik", icon: Italic },
  { action: "strikethrough", label: "Üstü çizili", icon: Strikethrough },
  { action: "quote", label: "Alıntı", icon: Quote },
  { action: "inline-code", label: "Satır içi kod", icon: Code },
  { action: "code-block", label: "Kod bloğu", icon: SquareCode },
  { action: "link", label: "Bağlantı", icon: Link },
  { action: "image", label: "Görsel", icon: Image },
  { action: "bullet-list", label: "Madde listesi", icon: List },
  { action: "ordered-list", label: "Numaralı liste", icon: ListOrdered },
  { action: "checklist", label: "Yapılacaklar listesi", icon: ListChecks },
  { action: "hr", label: "Ayırıcı", icon: Minus },
  { action: "table", label: "Tablo", icon: Table },
];

export function MarkdownToolbar({
  onAction,
  onTemplate,
  onSnapshot,
  onShowSnapshots,
  onUndo,
  onRedo,
  inspectorOpen,
  onToggleInspector,
  textColor,
  highlightColor,
}: MarkdownToolbarProps) {
  return (
    <div className="mdv-mdtools" role="toolbar" aria-label="Markdown araçları">
      <div className="mdv-mdtools__group">
        {ACTIONS.map(({ action, label, icon }) => (
          <button
            key={action}
            type="button"
            className="mdv-mdtools__btn"
            aria-label={label}
            data-tooltip={label}
            onClick={() => onAction(action)}
          >
            <Icon icon={icon} size={13} strokeWidth={1.7} />
          </button>
        ))}
      </div>

      <div className="mdv-mdtools__group">
        <button
          type="button"
          className="mdv-mdtools__btn mdv-mdtools__btn--swatch"
          aria-label="Metin rengi"
          data-tooltip="Metin rengi"
          onClick={() => onAction("text-color")}
        >
          <Icon icon={Palette} size={13} strokeWidth={1.7} />
          <span className="mdv-mdtools__swatch" style={{ background: textColor }} aria-hidden />
        </button>
        <button
          type="button"
          className="mdv-mdtools__btn mdv-mdtools__btn--swatch"
          aria-label="Vurgu"
          data-tooltip="Vurgu"
          onClick={() => onAction("highlight")}
        >
          <Icon icon={Highlighter} size={13} strokeWidth={1.7} />
          <span className="mdv-mdtools__swatch" style={{ background: highlightColor }} aria-hidden />
        </button>
      </div>

      <div className="mdv-mdtools__group">
        <button
          type="button"
          className="mdv-mdtools__template"
          data-tooltip="Not şablonu ekle"
          onClick={() => onTemplate("note")}
        >
          not
        </button>
        <button
          type="button"
          className="mdv-mdtools__template"
          data-tooltip="Readme şablonu ekle"
          onClick={() => onTemplate("readme")}
        >
          readme
        </button>
        <button
          type="button"
          className="mdv-mdtools__template"
          data-tooltip="Prompt şablonu ekle"
          onClick={() => onTemplate("prompt")}
        >
          prompt
        </button>
      </div>

      <div className="mdv-mdtools__group">
        <button
          type="button"
          className="mdv-mdtools__btn"
          aria-label="Düzenlemeyi geri al"
          data-tooltip="Düzenlemeyi geri al"
          onClick={onUndo}
        >
          <Icon icon={Undo2} size={13} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="mdv-mdtools__btn"
          aria-label="Düzenlemeyi yinele"
          data-tooltip="Düzenlemeyi yinele"
          onClick={onRedo}
        >
          <Icon icon={Redo2} size={13} strokeWidth={1.7} />
        </button>
      </div>

      <div className="mdv-mdtools__group">
        <button
          type="button"
          className="mdv-mdtools__btn"
          aria-label="Anlık görüntü oluştur"
          data-tooltip="Anlık görüntü oluştur"
          onClick={onSnapshot}
        >
          <Icon icon={History} size={13} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="mdv-mdtools__btn"
          aria-label="Anlık görüntüleri göster"
          data-tooltip="Anlık görüntüleri göster"
          onClick={onShowSnapshots}
        >
          <Icon icon={TimerReset} size={13} strokeWidth={1.7} />
        </button>
      </div>

      <button
        type="button"
        className={`mdv-mdtools__btn mdv-mdtools__btn--push${inspectorOpen ? " is-active" : ""}`}
        aria-label={inspectorOpen ? "Ana hatları gizle" : "Ana hatları göster"}
        aria-pressed={inspectorOpen}
        data-tooltip={inspectorOpen ? "Ana hatları gizle" : "Ana hatları göster"}
        onClick={onToggleInspector}
      >
        <Icon icon={inspectorOpen ? PanelRight : Pilcrow} size={13} strokeWidth={1.7} />
      </button>
    </div>
  );
}
