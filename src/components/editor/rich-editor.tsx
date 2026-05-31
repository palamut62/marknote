import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { Markdown } from "tiptap-markdown";
import { RichSecretMask, richSecretMaskPluginKey } from "./rich-secret-mask-extension";
import { RichTextStyle } from "./rich-text-style-extension";

/**
 * WYSIWYG rich-text editor (#editor-split). Edits markdown visually — bold,
 * headings, lists, quotes, code, links and highlight render formatted with no
 * raw markdown tags. The buffer is kept in sync with the shared markdown
 * `source`: typing serializes back to markdown via tiptap-markdown so the right
 * "markdown page" + preview stay current.
 */
type RichEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  onSelectionChange?: (range: { from: number; to: number }) => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
  secretsHidden?: boolean;
  /** surfaces the tiptap instance so the toolbar (rendered by the parent) can drive it */
  onEditorReady?: (editor: Editor | null) => void;
};

export type RichEditorHandle = {
  /** the tiptap editor instance — toolbar drives formatting through this */
  getEditor: () => ReturnType<typeof useEditor> | null;
  focus: () => void;
};

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(function RichEditor(
  { value, onChange, onSelectionChange, onContextMenu, secretsHidden = true, onEditorReady },
  ref,
) {
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  // last markdown we emitted upward — guards the value→editor sync from
  // clobbering the cursor on every keystroke (only re-set on external changes)
  const lastEmitted = useRef<string>(value);

  const editor = useEditor({
    extensions: [
      // StarterKit v3 already bundles link + lists; configure link inline so we
      // don't double-register the extension (#editor-split)
      StarterKit.configure({ link: { openOnClick: false } }),
      Highlight.configure({ multicolor: true }),
      RichTextStyle,
      RichSecretMask.configure({ hidden: secretsHidden }),
      Markdown.configure({ html: true, transformPastedText: true, linkify: true }),
    ],
    content: value,
    // reuse the rendered-markdown typography (.mdv-prose) for the live document
    editorProps: { attributes: { class: "mdv-prose mdv-rich-editor__doc" } },
    onUpdate: ({ editor }) => {
      // tiptap-markdown attaches an untyped `markdown` storage slot
      const md = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
      lastEmitted.current = md;
      onChangeRef.current(md);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      onSelectionChangeRef.current?.({ from, to });
    },
  });

  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
    focus: () => editor?.commands.focus(),
  }), [editor]);

  // hand the instance up to the parent (for the toolbar) once it exists
  useEffect(() => {
    onEditorReadyRef.current?.(editor);
    return () => onEditorReadyRef.current?.(null);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(richSecretMaskPluginKey, secretsHidden));
  }, [editor, secretsHidden]);

  // external value changes (file load, snapshot restore, ai apply, edits in the
  // markdown pane) → reparse markdown into the document
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  return (
    <div className="mdv-rich-editor" onContextMenu={onContextMenu}>
      <EditorContent editor={editor} className="mdv-rich-editor__content" />
    </div>
  );
});
