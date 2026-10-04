import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Code,
  Eye,
  EyeOff,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  MoreHorizontal,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Type,
  Undo2,
} from "lucide-react";
import { type Editor, useEditorState } from "@tiptap/react";
import { Icon } from "@/components/primitives";
import { RICH_FONT_FAMILIES, RICH_FONT_SIZES } from "@/lib/fonts";
import { shortcutLabel } from "@/lib";

/**
 * Short formatting bar for the "Yaz" view: block type, bold, italic, lists,
 * task list, link. Everything else sits behind "Diğer" so the writing surface
 * stays calm. Never touches a destroyed editor (F02).
 */
type RichToolbarProps = {
  editor: Editor | null;
  readOnly?: boolean;
  textColor: string;
  highlightColor: string;
  secretsPresent: boolean;
  secretsHidden: boolean;
  onToggleSecrets: () => void;
};

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  block: "p" | "h1" | "h2" | "h3";
  bullet: boolean;
  ordered: boolean;
  task: boolean;
  quote: boolean;
  code: boolean;
  link: boolean;
  highlight: boolean;
  canUndo: boolean;
  canRedo: boolean;
  style: { color?: string; fontFamily?: string; fontSize?: string };
};

const EMPTY_STATE: ToolbarState = {
  bold: false,
  italic: false,
  strike: false,
  block: "p",
  bullet: false,
  ordered: false,
  task: false,
  quote: false,
  code: false,
  link: false,
  highlight: false,
  canUndo: false,
  canRedo: false,
  style: {},
};

function usable(editor: Editor | null): editor is Editor {
  return editor != null && !editor.isDestroyed;
}

export function RichToolbar({
  editor,
  readOnly = false,
  textColor,
  highlightColor,
  secretsPresent,
  secretsHidden,
  onToggleSecrets,
}: RichToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }): ToolbarState => {
      if (!usable(e)) return EMPTY_STATE;
      try {
        return {
          bold: e.isActive("bold"),
          italic: e.isActive("italic"),
          strike: e.isActive("strike"),
          block: e.isActive("heading", { level: 1 })
            ? "h1"
            : e.isActive("heading", { level: 2 })
              ? "h2"
              : e.isActive("heading", { level: 3 })
                ? "h3"
                : "p",
          bullet: e.isActive("bulletList"),
          ordered: e.isActive("orderedList"),
          task: e.isActive("taskList"),
          quote: e.isActive("blockquote"),
          code: e.isActive("code"),
          link: e.isActive("link"),
          highlight: e.isActive("highlight"),
          canUndo: e.can().undo(),
          canRedo: e.can().redo(),
          style: (e.getAttributes("richTextStyle") as ToolbarState["style"]) ?? {},
        };
      } catch {
        // editor torn down between the check and the read
        return EMPTY_STATE;
      }
    },
  }) ?? EMPTY_STATE;

  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  const disabled = readOnly || !usable(editor);

  const run = (fn: (e: Editor) => void) => {
    if (!usable(editor)) return;
    fn(editor);
  };
  const chain = (e: Editor) => e.chain().focus();
  const applyStyle = (attrs: Partial<ToolbarState["style"]>) =>
    run((e) => {
      chain(e).setMark("richTextStyle", { ...state.style, ...attrs }).run();
    });

  const btn = (
    key: string,
    label: string,
    icon: typeof Bold,
    active: boolean,
    action: (e: Editor) => void,
    extraDisabled = false,
  ) => (
    <button
      key={key}
      type="button"
      className={`mdv-tool${active ? " is-active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={label}
      disabled={disabled || extraDisabled}
      onClick={() => run(action)}
    >
      <Icon icon={icon} size={15} strokeWidth={1.8} />
    </button>
  );

  const submitLink = () => {
    const href = linkValue.trim();
    run((e) => {
      if (!href) chain(e).extendMarkRange("link").unsetLink().run();
      else chain(e).extendMarkRange("link").setLink({ href }).run();
    });
    setLinkOpen(false);
  };

  return (
    <div className="mdv-richbar" role="toolbar" aria-label="Biçimlendirme">
      <div className="mdv-richbar__row">
        <label className="mdv-richbar__select">
          <span className="mdv-visually-hidden">Paragraf biçimi</span>
          <select
            value={state.block}
            disabled={disabled}
            onChange={(ev) => {
              const v = ev.currentTarget.value as ToolbarState["block"];
              run((e) => {
                if (v === "p") chain(e).setParagraph().run();
                else chain(e).setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
              });
            }}
          >
            <option value="p">Metin</option>
            <option value="h1">Başlık 1</option>
            <option value="h2">Başlık 2</option>
            <option value="h3">Başlık 3</option>
          </select>
        </label>
        <span className="mdv-richbar__sep" aria-hidden />
        {btn("bold", shortcutLabel("Kalın (⌘B)"), Bold, state.bold, (e) => chain(e).toggleBold().run())}
        {btn("italic", shortcutLabel("İtalik (⌘I)"), Italic, state.italic, (e) => chain(e).toggleItalic().run())}
        {btn("bullet", "Madde listesi", List, state.bullet, (e) => chain(e).toggleBulletList().run())}
        {btn("task", "Yapılacaklar listesi", ListChecks, state.task, (e) => chain(e).toggleTaskList().run())}
        <div className="mdv-richbar__link">
          {btn("link", state.link ? "Bağlantıyı düzenle" : "Bağlantı ekle", LinkIcon, state.link || linkOpen, (e) => {
            setLinkValue((e.getAttributes("link").href as string | undefined) ?? "");
            setLinkOpen((v) => !v);
          })}
          {linkOpen ? (
            <form
              className="mdv-richbar__popover"
              onSubmit={(ev) => {
                ev.preventDefault();
                submitLink();
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Escape") {
                  ev.stopPropagation();
                  setLinkOpen(false);
                }
              }}
            >
              <label className="mdv-visually-hidden" htmlFor="mdv-link-input">Bağlantı adresi</label>
              <input
                id="mdv-link-input"
                ref={linkInputRef}
                className="mdv-input"
                placeholder="https://…"
                value={linkValue}
                onChange={(ev) => setLinkValue(ev.target.value)}
              />
              <button type="submit" className="mdv-btn mdv-btn--primary">{linkValue.trim() ? "Uygula" : "Kaldır"}</button>
            </form>
          ) : null}
        </div>
        <span className="mdv-richbar__spacer" />
        {secretsPresent ? (
          <button
            type="button"
            className={`mdv-tool${secretsHidden ? "" : " is-active"}`}
            aria-label={secretsHidden ? "Gizli bilgileri göster" : "Gizli bilgileri gizle"}
            aria-pressed={!secretsHidden}
            data-tooltip={secretsHidden ? "API anahtarlarını göster" : "API anahtarlarını gizle"}
            onClick={onToggleSecrets}
          >
            <Icon icon={secretsHidden ? EyeOff : Eye} size={15} strokeWidth={1.8} />
          </button>
        ) : null}
        <button
          type="button"
          className={`mdv-tool${moreOpen ? " is-active" : ""}`}
          aria-label="Diğer biçimler"
          aria-expanded={moreOpen}
          data-tooltip="Diğer biçimler"
          disabled={disabled}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Icon icon={MoreHorizontal} size={15} strokeWidth={1.8} />
        </button>
      </div>
      {moreOpen && !disabled ? (
        <div className="mdv-richbar__row mdv-richbar__row--more">
          {btn("ordered", "Numaralı liste", ListOrdered, state.ordered, (e) => chain(e).toggleOrderedList().run())}
          {btn("quote", "Alıntı", Quote, state.quote, (e) => chain(e).toggleBlockquote().run())}
          {btn("strike", "Üstü çizili", Strikethrough, state.strike, (e) => chain(e).toggleStrike().run())}
          {btn("code", "Satır içi kod", Code, state.code, (e) => chain(e).toggleCode().run())}
          {btn("highlight", "Vurgula", Highlighter, state.highlight, (e) => chain(e).setHighlight({ color: highlightColor }).run())}
          {btn("table", "Tablo ekle", TableIcon, false, (e) =>
            chain(e).insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(),
          )}
          <span className="mdv-richbar__sep" aria-hidden />
          <label className="mdv-richbar__select">
            <span className="mdv-visually-hidden">Yazı tipi</span>
            <select
              value={state.style.fontFamily ?? ""}
              onChange={(ev) => applyStyle({ fontFamily: ev.currentTarget.value || undefined })}
            >
              <option value="">Yazı tipi</option>
              {RICH_FONT_FAMILIES.map((font) => (
                <option key={font.value} value={font.value}>{font.label}</option>
              ))}
            </select>
          </label>
          <label className="mdv-richbar__select">
            <span className="mdv-visually-hidden">Yazı boyutu</span>
            <select
              value={state.style.fontSize ?? ""}
              onChange={(ev) => applyStyle({ fontSize: ev.currentTarget.value || undefined })}
            >
              <option value="">Boyut</option>
              {RICH_FONT_SIZES.map((size) => (
                <option key={size} value={size}>{size.replace("px", "")}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="mdv-tool"
            aria-label="Yazı rengi"
            data-tooltip="Yazı rengi"
            onClick={() => applyStyle({ color: textColor })}
          >
            <Icon icon={Type} size={15} strokeWidth={1.8} />
            <span className="mdv-tool__swatch" style={{ background: textColor }} aria-hidden />
          </button>
          <span className="mdv-richbar__spacer" />
          {btn("undo", shortcutLabel("Geri al (⌘Z)"), Undo2, false, (e) => chain(e).undo().run(), !state.canUndo)}
          {btn("redo", shortcutLabel("Yinele (⌘⇧Z)"), Redo2, false, (e) => chain(e).redo().run(), !state.canRedo)}
        </div>
      ) : null}
    </div>
  );
}
