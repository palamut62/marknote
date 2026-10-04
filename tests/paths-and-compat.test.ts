import { expect, test } from "bun:test";
import { isSameOrChildPath, remapPath, samePath } from "../src/lib/paths";
import {
  applyLineStyle,
  detectLineStyle,
  sameMarkdownStructure,
  splitFrontmatter,
} from "../src/lib/rich-compat";

test("samePath ignores separators and windows casing", () => {
  expect(samePath("C:\\Notes\\A.md", "c:/notes/a.md")).toBe(true);
  expect(samePath("/home/u/A.md", "/home/u/a.md")).toBe(false);
});

test("isSameOrChildPath matches nested windows paths, not siblings with shared prefix", () => {
  expect(isSameOrChildPath("C:\\notes\\work\\a.md", "C:\\notes\\work")).toBe(true);
  expect(isSameOrChildPath("C:\\notes\\work", "c:/notes/work/")).toBe(true);
  expect(isSameOrChildPath("C:\\notes\\workshop\\a.md", "C:\\notes\\work")).toBe(false);
  expect(isSameOrChildPath("/a/b/c.md", "/a/b")).toBe(true);
});

test("remapPath moves children of a moved folder and keeps target separator", () => {
  expect(remapPath("C:\\notes\\work\\sub\\a.md", "C:\\notes\\work", "C:\\archive\\work")).toBe(
    "C:\\archive\\work\\sub\\a.md",
  );
  expect(remapPath("/n/old/a.md", "/n/old", "/n/new")).toBe("/n/new/a.md");
  expect(remapPath("/n/old", "/n/old", "/n/new")).toBe("/n/new");
  expect(remapPath("/n/other/a.md", "/n/old", "/n/new")).toBe("/n/other/a.md");
});

test("splitFrontmatter keeps the block verbatim", () => {
  const src = "---\ntitle: Deneme\ntags: [a]\n---\n# Başlık\n";
  const { frontmatter, body } = splitFrontmatter(src);
  expect(frontmatter).toBe("---\ntitle: Deneme\ntags: [a]\n---\n");
  expect(body).toBe("# Başlık\n");
  expect(splitFrontmatter("# no front\n---\n").frontmatter).toBe("");
});

test("sameMarkdownStructure detects the table/task loss from the review (F01)", () => {
  const original = "# Deneme\n\n| İş | Durum |\n| --- | --- |\n| Not | Hazır |\n\n- [ ] Kontrol et\n\nSon satır\n";
  const lossy = "# Deneme\n\nİşDurumNotHazır\n\n- \\[ \\] Kontrol et\n\nSon satır\n";
  expect(sameMarkdownStructure(original, lossy)).toBe(false);
});

test("sameMarkdownStructure tolerates pure formatting differences", () => {
  expect(sameMarkdownStructure("* a\n* b\n", "- a\n- b\n")).toBe(true);
  expect(sameMarkdownStructure("_x_ and __y__", "*x* and **y**")).toBe(true);
  expect(sameMarkdownStructure("satır bir\nsatır iki", "satır bir satır iki")).toBe(true);
  expect(sameMarkdownStructure("- [x] bitti\n", "* [x] bitti\n")).toBe(true);
  expect(sameMarkdownStructure("<div>ham</div>\n", "ham\n")).toBe(false);
});

test("line style round-trips CRLF and the final newline", () => {
  const style = detectLineStyle("a\r\nb\r\n");
  expect(applyLineStyle("a\nb", style)).toBe("a\r\nb\r\n");
  expect(applyLineStyle("a\nb\n\n", detectLineStyle("a\nb"))).toBe("a\nb");
});

test("every font the toolbar offers passes the preview whitelist; unsafe css does not (F10)", async () => {
  const { RICH_FONT_FAMILIES, RICH_FONT_SIZES } = await import("../src/lib/fonts");
  const { isSafeStyle } = await import("../src/lib/markdown");
  for (const font of RICH_FONT_FAMILIES) expect(isSafeStyle(`font-family: ${font.value}`)).toBe(true);
  for (const size of RICH_FONT_SIZES) expect(isSafeStyle(`font-size: ${size}`)).toBe(true);
  expect(isSafeStyle("font-family: 'Segoe UI', Tahoma, sans-serif")).toBe(true);
  expect(isSafeStyle("font-family: x; background: url(javascript:alert(1))")).toBe(false);
  expect(isSafeStyle("position: fixed")).toBe(false);
});
