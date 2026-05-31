import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export const richSecretMaskPluginKey = new PluginKey<boolean>("richSecretMask");

const KV_PATTERN =
  /(\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PWD)\s*[:=]\s*)([^\s"'`]+)/g;
const STANDALONE_PATTERN =
  /\b(sk-or-v1-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|gh[opusr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|xox[abp]-[A-Za-z0-9-]{10,})\b/g;

type Range = { start: number; end: number; secret: string };

function maskOf(value: string): string {
  return "•".repeat(Math.max(6, Math.min(24, value.length)));
}

function collectRanges(text: string): Range[] {
  const ranges: Range[] = [];

  KV_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = KV_PATTERN.exec(text)) !== null) {
    const start = m.index + m[1].length;
    ranges.push({ start, end: start + m[2].length, secret: m[2] });
  }

  STANDALONE_PATTERN.lastIndex = 0;
  while ((m = STANDALONE_PATTERN.exec(text)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length, secret: m[0] });
  }

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start < last.end) continue;
    merged.push(range);
  }
  return merged;
}

function buildDecorations(doc: ProseMirrorNode, hidden: boolean): DecorationSet {
  if (!hidden) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const ranges = collectRanges(node.text);
    for (const range of ranges) {
      decorations.push(
        Decoration.inline(pos + range.start, pos + range.end, {
          class: "mdv-rich-secret-mask",
          "data-mask": maskOf(range.secret),
          title: "secret (hidden) - click eye icon to reveal",
        }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

export const RichSecretMask = Extension.create<{ hidden: boolean }>({
  name: "richSecretMask",

  addOptions() {
    return { hidden: true };
  },

  addProseMirrorPlugins() {
    const initialHidden = this.options.hidden;
    return [
      new Plugin<boolean>({
        key: richSecretMaskPluginKey,
        state: {
          init: () => initialHidden,
          apply: (tr, value) => {
            const next = tr.getMeta(richSecretMaskPluginKey);
            return typeof next === "boolean" ? next : value;
          },
        },
        props: {
          decorations(state) {
            return buildDecorations(state.doc, richSecretMaskPluginKey.getState(state) ?? true);
          },
        },
      }),
    ];
  },
});
