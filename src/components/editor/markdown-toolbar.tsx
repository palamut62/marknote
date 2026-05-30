import {
  Bold,
  Code,
  History,
  Heading1,
  Heading2,
  Highlighter,
  Image,
  Italic,
  Link,
  ListChecks,
  PanelRight,
  Pilcrow,
  Palette,
  Quote,
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
  { action: "h1", label: "heading 1", icon: Heading1 },
  { action: "h2", label: "heading 2", icon: Heading2 },
  { action: "bold", label: "bold", icon: Bold },
  { action: "italic", label: "italic", icon: Italic },
  { action: "quote", label: "quote", icon: Quote },
  { action: "inline-code", label: "inline code", icon: Code },
  { action: "link", label: "link", icon: Link },
  { action: "image", label: "image", icon: Image },
  { action: "checklist", label: "checklist", icon: ListChecks },
  { action: "table", label: "table", icon: Table },
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
    <div className="mdv-mdtools" role="toolbar" aria-label="markdown tools">
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
          aria-label="text color"
          data-tooltip="text color"
          onClick={() => onAction("text-color")}
        >
          <Icon icon={Palette} size={13} strokeWidth={1.7} />
          <span className="mdv-mdtools__swatch" style={{ background: textColor }} aria-hidden />
        </button>
        <button
          type="button"
          className="mdv-mdtools__btn mdv-mdtools__btn--swatch"
          aria-label="highlight"
          data-tooltip="highlight"
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
          data-tooltip="insert note template"
          onClick={() => onTemplate("note")}
        >
          note
        </button>
        <button
          type="button"
          className="mdv-mdtools__template"
          data-tooltip="insert readme template"
          onClick={() => onTemplate("readme")}
        >
          readme
        </button>
        <button
          type="button"
          className="mdv-mdtools__template"
          data-tooltip="insert prompt template"
          onClick={() => onTemplate("prompt")}
        >
          prompt
        </button>
      </div>

      <div className="mdv-mdtools__group">
        <button
          type="button"
          className="mdv-mdtools__btn"
          aria-label="undo edit"
          data-tooltip="undo edit"
          onClick={onUndo}
        >
          <Icon icon={Undo2} size={13} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="mdv-mdtools__btn"
          aria-label="redo edit"
          data-tooltip="redo edit"
          onClick={onRedo}
        >
          <Icon icon={Redo2} size={13} strokeWidth={1.7} />
        </button>
      </div>

      <div className="mdv-mdtools__group">
        <button
          type="button"
          className="mdv-mdtools__btn"
          aria-label="create snapshot"
          data-tooltip="create snapshot"
          onClick={onSnapshot}
        >
          <Icon icon={History} size={13} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="mdv-mdtools__btn"
          aria-label="show snapshots"
          data-tooltip="show snapshots"
          onClick={onShowSnapshots}
        >
          <Icon icon={TimerReset} size={13} strokeWidth={1.7} />
        </button>
      </div>

      <button
        type="button"
        className={`mdv-mdtools__btn mdv-mdtools__btn--push${inspectorOpen ? " is-active" : ""}`}
        aria-label={inspectorOpen ? "hide outline" : "show outline"}
        aria-pressed={inspectorOpen}
        data-tooltip={inspectorOpen ? "hide outline" : "show outline"}
        onClick={onToggleInspector}
      >
        <Icon icon={inspectorOpen ? PanelRight : Pilcrow} size={13} strokeWidth={1.7} />
      </button>
    </div>
  );
}
