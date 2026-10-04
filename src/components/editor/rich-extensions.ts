import { Extension, type AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "tiptap-markdown";
import { RichSecretMask } from "./rich-secret-mask-extension";
import { RichTextStyle } from "./rich-text-style-extension";
import { isRemoteImageUrl, remoteImagesAllowed } from "@/lib/remote-images";

// Images render through a node view so a remote URL is never put into `src`
// while the "load internet images" privacy setting is off.
const PrivateImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const src = (node.attrs.src as string | null) ?? "";
      if (isRemoteImageUrl(src) && !remoteImagesAllowed()) {
        const blocked = document.createElement("span");
        blocked.className = "mdv-remote-blocked";
        blocked.title = src;
        blocked.textContent = `İnternet görseli gösterilmiyor${node.attrs.alt ? `: ${node.attrs.alt as string}` : ""} (Ayarlar - Gizlilik)`;
        return { dom: blocked };
      }
      const dom = document.createElement("img");
      dom.src = src;
      if (node.attrs.alt) dom.alt = node.attrs.alt as string;
      if (node.attrs.title) dom.title = node.attrs.title as string;
      return { dom };
    };
  },
});

// tiptap-markdown only tracks "tight" (no blank line between items) for bullet
// and ordered lists; without it task lists come back loose (blank line between items).
const TaskListTight = Extension.create({
  name: "marknoteTaskListTight",
  addGlobalAttributes() {
    return [
      {
        types: ["taskList"],
        attributes: {
          tight: {
            default: true,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute("data-tight") === "true" || !element.querySelector("p"),
            renderHTML: (attributes: { tight?: boolean }) => ({
              "data-tight": attributes.tight ? "true" : null,
            }),
          },
        },
      },
    ];
  },
});

/**
 * One extension list for the live editor and the round-trip tests, so the
 * structure check (F01) exercises exactly what the user edits with.
 * Tables, task lists and images have dedicated nodes; tiptap-markdown knows
 * how to serialize all three back to GFM.
 */
export function richExtensions({ secretsHidden = true }: { secretsHidden?: boolean } = {}): AnyExtension[] {
  return [
    // StarterKit v3 already bundles link + lists; configure link inline so we
    // don't double-register the extension (#editor-split)
    StarterKit.configure({ link: { openOnClick: false } }),
    Highlight.configure({ multicolor: true }),
    PrivateImage.configure({ inline: true, allowBase64: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TaskListTight,
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder: "Yazmaya başlayın…" }),
    RichTextStyle,
    RichSecretMask.configure({ hidden: secretsHidden }),
    Markdown.configure({ html: true, transformPastedText: true, linkify: true }),
  ];
}

type MarkdownStorage = { markdown: { getMarkdown: () => string } };

export function getEditorMarkdown(editor: { storage: unknown }): string {
  return (editor.storage as MarkdownStorage).markdown.getMarkdown();
}
