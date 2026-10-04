import { expect, test } from "bun:test";
import { deriveExcerpt, deriveTitle, searchNotes, type NoteEntry } from "../src/lib/notes-index";

const note = (path: string, content: string | null, title = "Not"): NoteEntry => ({
  path,
  rel: path,
  name: path,
  title,
  excerpt: "",
  mtime: null,
  content,
});

test("deriveTitle prefers the first heading and skips frontmatter", () => {
  expect(deriveTitle("---\ntitle: x\n---\n\n# Haftalık **plan**\n\nmetin", "a.md")).toBe("Haftalık plan");
  expect(deriveTitle("İlk satır burada\nikinci", "a.md")).toBe("İlk satır burada");
  expect(deriveTitle("", "toplanti-notlari.md")).toBe("toplanti-notlari");
});

test("deriveExcerpt skips the title and code fences", () => {
  const md = "# Plan\n\n```js\nsecret()\n```\n\n- [ ] Önemli üç iş\n\nDevamı burada.";
  expect(deriveExcerpt(md, "Plan")).toBe("Önemli üç iş Devamı burada.");
});

test("searchNotes finds titles and content lines in one query (Turkish casing)", () => {
  const notes = [
    note("a.md", "# İstanbul gezisi\nbilet al", "İstanbul gezisi"),
    note("b.md", "# Market\nistanbul'dan gelen kahve", "Market"),
    note("c.md", null, "Dev dosya"),
  ];
  const res = searchNotes(notes, "İSTANBUL");
  expect(res.hits[0]).toMatchObject({ path: "a.md", kind: "title" });
  expect(res.hits.some((h) => h.path === "b.md" && h.kind === "content" && h.line === 2)).toBe(true);
  expect(res.skippedLarge).toBe(1);
});

test("searchNotes reports when results were limited", () => {
  const notes = Array.from({ length: 10 }, (_, i) => note(`${i}.md`, "kelime\nkelime", `n${i}`));
  const res = searchNotes(notes, "kelime", { maxHits: 5 });
  expect(res.hits.length).toBe(5);
  expect(res.limited).toBe(true);
});

test("maskSecretsInText hides keys for AI and restores them in the answer", async () => {
  const { maskSecretsInText } = await import("../src/lib/secret-mask");
  const masked = maskSecretsInText("OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123\nmetin");
  expect(masked.count).toBe(1);
  expect(masked.text).not.toContain("sk-abc");
  expect(masked.restore(masked.text.replace("metin", "Metin"))).toBe("OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123\nMetin");
});

test("blockRemoteImages strips remote src but keeps local images", async () => {
  const { blockRemoteImages } = await import("../src/lib/remote-images");
  const html = '<p><img src="https://x.com/a.png" alt="a"> <img src="./yerel.png" alt="b"></p>';
  const out = blockRemoteImages(html);
  expect(out).not.toMatch(/\ssrc="https:/);
  expect(out).toContain('title="https://x.com/a.png"');
  expect(out).toContain('src="./yerel.png"');
});
