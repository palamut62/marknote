import {
  Baseline,
  Bold,
  Code,
  Eye,
  EyeOff,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Type,
  Undo2,
} from "lucide-react";
import { type Editor, useEditorState } from "@tiptap/react";
import { Icon } from "@/components/primitives";

/**
 * Toolbar for the WYSIWYG pane (#editor-split). Drives formatting through the
 * tiptap editor instance and reflects active marks/nodes via useEditorState.
 */
type RichToolbarProps = {
  editor: Editor | null;
  textColor: string;
  highlightColor: string;
  secretsPresent: boolean;
  secretsHidden: boolean;
  onToggleSecrets: () => void;
};

const FONT_FAMILIES = [
  { label: "font", value: "" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "System", value: "system-ui, -apple-system, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Segoe UI", value: "'Segoe UI', Tahoma, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Verdana, sans-serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', sans-serif" },
  { label: "Calibri", value: "Calibri, Candara, sans-serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Garamond", value: "Garamond, 'Times New Roman', serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
  { label: "Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "Comic Sans", value: "'Comic Sans MS', 'Comic Sans', cursive" },
];

const FONT_SIZES = [
  { label: "size", value: "" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "24", value: "24px" },
  { label: "32", value: "32px" },
];

export function RichToolbar({
  editor,
  textColor,
  highlightColor,
  secretsPresent,
  secretsHidden,
  onToggleSecrets,
}: RichToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      strike: e?.isActive("strike") ?? false,
      h1: e?.isActive("heading", { level: 1 }) ?? false,
      h2: e?.isActive("heading", { level: 2 }) ?? false,
      bullet: e?.isActive("bulletList") ?? false,
      ordered: e?.isActive("orderedList") ?? false,
      quote: e?.isActive("blockquote") ?? false,
      code: e?.isActive("code") ?? false,
      link: e?.isActive("link") ?? false,
      highlight: e?.isActive("highlight") ?? false,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
      style: e?.getAttributes("richTextStyle") as {
        color?: string;
        fontFamily?: string;
        fontSize?: string;
      } ?? {},
    }),
  });

  if (!editor || !state) return <div className="mdv-mdtools" role="toolbar" aria-label="text tools" />;

  const btn = (
    key: string,
    label: string,
    icon: typeof Bold,
    active: boolean,
    run: () => void,
    disabled = false,
  ) => (
    <button
      key={key}
      type="button"
      className={`mdv-mdtools__btn${active ? " is-active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={label}
      disabled={disabled}
      onClick={run}
    >
      <Icon icon={icon} size={13} strokeWidth={1.7} />
    </button>
  );

  const chain = () => editor.chain().focus();
  const styleAttrs = state.style ?? {};
  const applyStyle = (attrs: Partial<typeof styleAttrs>) => {
    chain().setMark("richTextStyle", { ...styleAttrs, ...attrs }).run();
  };

  return (
    <div className="mdv-mdtools" role="toolbar" aria-label="text tools">
      <div className="mdv-mdtools__group">
        {btn("h1", "heading 1", Heading1, state.h1, () => chain().toggleHeading({ level: 1 }).run())}
        {btn("h2", "heading 2", Heading2, state.h2, () => chain().toggleHeading({ level: 2 }).run())}
        {btn("bold", "bold", Bold, state.bold, () => chain().toggleBold().run())}
        {btn("italic", "italic", Italic, state.italic, () => chain().toggleItalic().run())}
        {btn("strike", "strikethrough", Strikethrough, state.strike, () => chain().toggleStrike().run())}
        {btn("highlight", "highlight", Highlighter, state.highlight, () => chain().toggleHighlight().run())}
      </div>

      <div className="mdv-mdtools__group">
        <label className="mdv-mdtools__selectwrap" data-tooltip="font family">
          <Type size={12} strokeWidth={1.7} aria-hidden />
          <select
            className="mdv-mdtools__select"
            aria-label="font family"
            value={styleAttrs.fontFamily ?? ""}
            onChange={(e) => {
              if (e.currentTarget.value) applyStyle({ fontFamily: e.currentTarget.value });
            }}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font.label} value={font.value}>{font.label}</option>
            ))}
          </select>
        </label>
        <label className="mdv-mdtools__selectwrap" data-tooltip="font size">
          <Baseline size={12} strokeWidth={1.7} aria-hidden />
          <select
            className="mdv-mdtools__select mdv-mdtools__select--size"
            aria-label="font size"
            value={styleAttrs.fontSize ?? ""}
            onChange={(e) => {
              if (e.currentTarget.value) applyStyle({ fontSize: e.currentTarget.value });
            }}
          >
            {FONT_SIZES.map((size) => (
              <option key={size.label} value={size.value}>{size.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="mdv-mdtools__btn mdv-mdtools__btn--swatch"
          aria-label="text color"
          data-tooltip="text color"
          onClick={() => applyStyle({ color: textColor })}
        >
          <Icon icon={Type} size={13} strokeWidth={1.7} />
          <span className="mdv-mdtools__swatch" style={{ background: textColor }} aria-hidden />
        </button>
        <button
          type="button"
          className="mdv-mdtools__btn mdv-mdtools__btn--swatch"
          aria-label="highlight color"
          data-tooltip="highlight color"
          onClick={() => chain().setHighlight({ color: highlightColor }).run()}
        >
          <Icon icon={Highlighter} size={13} strokeWidth={1.7} />
          <span className="mdv-mdtools__swatch" style={{ background: highlightColor }} aria-hidden />
        </button>
      </div>

      <div className="mdv-mdtools__group">
        {btn("bullet", "bullet list", List, state.bullet, () => chain().toggleBulletList().run())}
        {btn("ordered", "numbered list", ListOrdered, state.ordered, () => chain().toggleOrderedList().run())}
        {btn("quote", "quote", Quote, state.quote, () => chain().toggleBlockquote().run())}
        {btn("code", "inline code", Code, state.code, () => chain().toggleCode().run())}
        {btn("link", "link · select a url then click", LinkIcon, state.link, () => {
          if (state.link) {
            chain().unsetLink().run();
            return;
          }
          // no native prompt (in-app rule): treat the current selection as the
          // href. select a url, click link. richer link editing lands in phase 2.
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to).trim();
          if (text) chain().setLink({ href: text }).run();
        })}
      </div>

      <div className="mdv-mdtools__group">
        {btn("undo", "undo", Undo2, false, () => chain().undo().run(), !state.canUndo)}
        {btn("redo", "redo", Redo2, false, () => chain().redo().run(), !state.canRedo)}
      </div>

      {secretsPresent ? (
        <button
          type="button"
          className={`mdv-mdtools__btn mdv-mdtools__btn--push${secretsHidden ? "" : " is-active"}`}
          aria-label={secretsHidden ? "show secrets" : "hide secrets"}
          aria-pressed={!secretsHidden}
          data-tooltip={secretsHidden ? "show api keys / tokens" : "hide api keys / tokens"}
          onClick={onToggleSecrets}
        >
          <Icon icon={secretsHidden ? EyeOff : Eye} size={13} strokeWidth={1.7} />
        </button>
      ) : null}
    </div>
  );
}
