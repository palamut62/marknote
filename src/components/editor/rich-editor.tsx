import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import { FileCode2 } from "lucide-react";
import { Icon } from "@/components/primitives";
import {
  applyLineStyle,
  detectLineStyle,
  sameMarkdownStructure,
  splitFrontmatter,
  type LineStyle,
} from "@/lib/rich-compat";
import { richSecretMaskPluginKey } from "./rich-secret-mask-extension";
import { getEditorMarkdown, richExtensions } from "./rich-extensions";

/**
 * WYSIWYG rich-text editor — the default "Yaz" view. Edits markdown visually;
 * typing serializes back to markdown via tiptap-markdown.
 *
 * Content safety (F01): every externally supplied document is round-tripped
 * through the editor first. If the serialized structure differs from the
 * original (raw HTML, aligned tables, footnotes…), the editor turns read-only
 * and offers the markdown view, so nothing is rewritten behind the user's back.
 * Frontmatter, line endings and the final newline are preserved verbatim.
 */
type RichEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  onSelectionChange?: (range: { from: number; to: number }) => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
  secretsHidden?: boolean;
  /** surfaces the tiptap instance (or null once it is gone) for the toolbar */
  onEditorReady?: (editor: Editor | null) => void;
  /** called when the document cannot be edited here without loss */
  onRequestSource?: () => void;
  /** reports whether the current document is safe for rich editing */
  onCompatibilityChange?: (safe: boolean) => void;
};

export type RichEditorHandle = {
  getEditor: () => Editor | null;
  focus: () => void;
  /** select the first occurrence of `text` and scroll it into view */
  revealText: (text: string) => boolean;
};

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(function RichEditor(
  {
    value,
    onChange,
    onSelectionChange,
    onContextMenu,
    secretsHidden = true,
    onEditorReady,
    onRequestSource,
    onCompatibilityChange,
  },
  ref,
) {
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onCompatRef = useRef(onCompatibilityChange);
  onCompatRef.current = onCompatibilityChange;
  // last markdown we emitted upward — guards the value→editor sync from
  // clobbering the cursor on every keystroke (only re-set on external changes)
  const lastEmitted = useRef<string | null>(null);
  const frontmatterRef = useRef("");
  const lineStyleRef = useRef<LineStyle>({ eol: "\n", trailingNewline: true });
  const [safe, setSafe] = useState(true);
  const safeRef = useRef(true);

  // built once: useEditor diffs the array by identity on every render, and the
  // secret mask is toggled through plugin meta afterwards
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const extensions = useMemo(() => richExtensions({ secretsHidden }), []);

  const editor = useEditor({
    extensions,
    content: "",
    // reuse the rendered-markdown typography (.mdv-prose) for the live document
    editorProps: { attributes: { class: "mdv-prose mdv-rich-editor__doc" } },
    onUpdate: ({ editor }) => {
      if (!safeRef.current) return;
      const md = frontmatterRef.current + applyLineStyle(getEditorMarkdown(editor), lineStyleRef.current);
      lastEmitted.current = md;
      onChangeRef.current(md);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      onSelectionChangeRef.current?.({ from, to });
    },
  });

  useImperativeHandle(ref, () => ({
    getEditor: () => (editor && !editor.isDestroyed ? editor : null),
    focus: () => {
      if (editor && !editor.isDestroyed) editor.commands.focus();
    },
    revealText: (text: string) => {
      if (!editor || editor.isDestroyed || !text) return false;
      const needle = text.toLocaleLowerCase();
      let found: { from: number; to: number } | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (found || !node.isText || !node.text) return !found;
        const idx = node.text.toLocaleLowerCase().indexOf(needle);
        if (idx >= 0) found = { from: pos + idx, to: pos + idx + text.length };
        return !found;
      });
      if (!found) return false;
      editor.chain().focus().setTextSelection(found).scrollIntoView().run();
      return true;
    },
  }), [editor]);

  // hand the instance up to the parent (for the toolbar); null on teardown so
  // the toolbar never drives a destroyed editor (F02)
  useEffect(() => {
    onEditorReadyRef.current?.(editor ?? null);
    return () => onEditorReadyRef.current?.(null);
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(richSecretMaskPluginKey, secretsHidden));
  }, [editor, secretsHidden]);

  // external value changes (file load, snapshot restore, ai apply, edits in the
  // markdown view) → reparse markdown into the document and re-check safety
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const { frontmatter, body } = splitFrontmatter(value);
    frontmatterRef.current = frontmatter;
    lineStyleRef.current = detectLineStyle(body);
    editor.commands.setContent(body, { emitUpdate: false });
    const roundTrip = getEditorMarkdown(editor);
    const ok = sameMarkdownStructure(body, roundTrip);
    safeRef.current = ok;
    setSafe(ok);
    editor.setEditable(ok, false);
    onCompatRef.current?.(ok);
  }, [value, editor]);

  return (
    <div className={`mdv-rich-editor${safe ? "" : " is-readonly"}`} onContextMenu={onContextMenu}>
      {!safe ? (
        <div className="mdv-rich-editor__notice" role="status">
          <Icon icon={FileCode2} size={15} strokeWidth={1.7} />
          <span>
            Bu not, metin görünümünde kayıpsız düzenlenemeyen içerik barındırıyor (ör. HTML, hizalı tablo).
            Notu korumak için burada salt okunur gösteriliyor.
          </span>
          {onRequestSource ? (
            <button type="button" className="mdv-btn mdv-btn--primary" onClick={onRequestSource}>
              Markdown görünümünde düzenle
            </button>
          ) : null}
        </div>
      ) : null}
      <EditorContent editor={editor} className="mdv-rich-editor__content" />
    </div>
  );
});
