import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { sameMarkdownStructure, splitFrontmatter } from "../src/lib/rich-compat";

// T01 — real tiptap pipeline (same extension list the app uses), headless DOM.
type EditorLike = {
  commands: { setContent: (c: string, o?: object) => boolean; insertContentAt: (p: number, c: string) => boolean };
  state: { doc: { content: { size: number } } };
  storage: unknown;
  destroy: () => void;
};

let makeEditor: (content: string) => EditorLike;
let toMarkdown: (e: EditorLike) => string;

beforeAll(async () => {
  GlobalRegistrator.register();
  const { Editor } = await import("@tiptap/core");
  const { richExtensions, getEditorMarkdown } = await import("../src/components/editor/rich-extensions");
  makeEditor = (content: string) => {
    const editor = new Editor({ extensions: richExtensions(), content: "" }) as unknown as EditorLike;
    editor.commands.setContent(content, { emitUpdate: false });
    return editor;
  };
  toMarkdown = (e) => getEditorMarkdown(e as { storage: unknown });
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

const SAMPLE = `---
title: Haftalık plan
tags: [iş, plan]
---
# Haftalık plan

Öncelikler şunlar: **çğıöşü** ve _ÇĞİÖŞÜ_.

| İş | Durum |
| --- | --- |
| Not | Hazır |
| Rapor | Bekliyor |

- [ ] Kontrol et
- [x] Bitti

![logo](./logo.png)

\`\`\`ts
const x = 1;
\`\`\`

Son satır
`;

test("table, task list, image, code and Turkish text survive edit + save (T01)", () => {
  const { frontmatter, body } = splitFrontmatter(SAMPLE);
  expect(frontmatter.length).toBeGreaterThan(0);
  const editor = makeEditor(body);
  const untouched = toMarkdown(editor);
  expect(sameMarkdownStructure(body, untouched)).toBe(true);

  // "add one character" at the end of the document
  editor.commands.insertContentAt(editor.state.doc.content.size - 1, "!");
  const edited = toMarkdown(editor);
  expect(edited).toContain("| İş | Durum |");
  expect(edited).toContain("- [ ] Kontrol et");
  expect(edited).toContain("- [x] Bitti");
  expect(edited).toContain("![logo](./logo.png)");
  expect(edited).toContain("çğıöşü");
  expect(edited).toContain("Son satır!");
  editor.destroy();
});

test("unsupported raw HTML is detected instead of silently dropped", () => {
  const body = "Giriş\n\n<details><summary>Gizli</summary>\n\nİçerik\n\n</details>\n";
  const editor = makeEditor(body);
  expect(sameMarkdownStructure(body, toMarkdown(editor))).toBe(false);
  editor.destroy();
});

test("aligned table columns are detected as not round-trippable", () => {
  const body = "| a | b |\n| :-: | --: |\n| 1 | 2 |\n";
  const editor = makeEditor(body);
  expect(sameMarkdownStructure(body, toMarkdown(editor))).toBe(false);
  editor.destroy();
});
