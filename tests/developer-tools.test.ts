import { describe, expect, test } from "bun:test";
import { applyTextTransform, extractDocumentLinks, parseFrontmatter, upsertFrontmatterField } from "../src/lib/developer-tools";

describe("developer tools", () => {
  test("parses flat frontmatter", () => {
    expect(parseFrontmatter("---\ntitle: Hello\ntags: dev\n---\n# Note")).toEqual({
      present: true,
      valid: true,
      fields: [{ key: "title", value: "Hello" }, { key: "tags", value: "dev" }],
    });
  });

  test("reports malformed frontmatter", () => {
    expect(parseFrontmatter("---\ntitle: Hello")).toMatchObject({ present: true, valid: false });
  });

  test("extracts local and external links with line numbers", () => {
    expect(extractDocumentLinks("[local](note.md)\n![logo](img/a.png)\n[web](https://example.com)"))
      .toMatchObject([{ target: "note.md", line: 1, external: false }, { image: true, line: 2 }, { external: true, line: 3 }]);
  });

  test("applies literal custom transformations", () => {
    expect(applyTextTransform("one one", "one", "two")).toBe("two two");
  });

  test("creates and updates frontmatter fields", () => {
    expect(upsertFrontmatterField("# Note", "title", "Hello")).toStartWith("---\ntitle: Hello\n---");
    expect(upsertFrontmatterField("---\ntitle: Old\n---\n# Note", "title", "New")).toContain("title: New");
  });
});
