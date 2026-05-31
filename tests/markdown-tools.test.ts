import { expect, test } from "bun:test";
import { applyMarkdownAction } from "../src/lib/markdown-tools";

const at = (source: string, from: number, to: number) => ({ from, to });

// ---------------------------------------------------------------------------
// inline wrap / unwrap (bold, italic, inline-code)
// ---------------------------------------------------------------------------

test("bold wraps a selection", () => {
  const edit = applyMarkdownAction("hello", at("hello", 0, 5), "bold");
  expect(edit.next).toBe("**hello**");
  // inner content stays selected so a second press toggles off
  expect(edit.selection).toEqual({ from: 2, to: 7 });
});

test("bold on empty selection inserts a placeholder", () => {
  const edit = applyMarkdownAction("", at("", 0, 0), "bold");
  expect(edit.next).toBe("**text**");
  expect(edit.selection).toEqual({ from: 2, to: 6 });
});

test("bold toggles off when the markers are inside the selection", () => {
  const edit = applyMarkdownAction("**hello**", at("**hello**", 0, 9), "bold");
  expect(edit.next).toBe("hello");
  expect(edit.selection).toEqual({ from: 0, to: 5 });
});

test("bold toggles off when the markers hug the selection", () => {
  // select just `hello` inside `**hello**`
  const edit = applyMarkdownAction("**hello**", at("**hello**", 2, 7), "bold");
  expect(edit.next).toBe("hello");
  expect(edit.selection).toEqual({ from: 0, to: 5 });
});

test("italic and inline-code wrap with their own markers", () => {
  expect(applyMarkdownAction("x", at("x", 0, 1), "italic").next).toBe("_x_");
  expect(applyMarkdownAction("x", at("x", 0, 1), "inline-code").next).toBe("`x`");
});

test("italic does not toggle bold markers off", () => {
  // selecting `**x**` and pressing italic should nest, not strip the bold
  expect(applyMarkdownAction("**x**", at("**x**", 0, 5), "italic").next).toBe("_**x**_");
});

test("italic does not eat literal underscores in __dunder__ identifiers", () => {
  // selecting the whole `__init__` must not be mistaken for emphasis
  const whole = applyMarkdownAction("__init__", at("__init__", 0, 8), "italic");
  expect(whole.next).toBe("___init___");
  // selecting just `init` inside `__init__` must not strip the surrounding pair
  const inner = applyMarkdownAction("__init__", at("__init__", 2, 6), "italic");
  expect(inner.next).toBe("___init___");
});

test("bold applied twice in a row returns to the original text", () => {
  const first = applyMarkdownAction("hi", at("hi", 0, 2), "bold");
  expect(first.next).toBe("**hi**");
  const second = applyMarkdownAction(first.next, first.selection, "bold");
  expect(second.next).toBe("hi");
});

// ---------------------------------------------------------------------------
// color + highlight
// ---------------------------------------------------------------------------

test("text-color wraps a selection in a span", () => {
  const edit = applyMarkdownAction("word", at("word", 0, 4), "text-color", { textColor: "#ff0000" });
  expect(edit.next).toBe('<span style="color: #ff0000">word</span>');
});

test("text-color with no selection is a no-op", () => {
  const edit = applyMarkdownAction("word", at("word", 0, 0), "text-color", { textColor: "#ff0000" });
  expect(edit.next).toBe("word");
});

test("re-applying the same color removes the span", () => {
  const wrapped = '<span style="color: #ff0000">word</span>';
  const edit = applyMarkdownAction(wrapped, at(wrapped, 0, wrapped.length), "text-color", {
    textColor: "#ff0000",
  });
  expect(edit.next).toBe("word");
  expect(edit.selection).toEqual({ from: 0, to: 4 });
});

test("applying a different color recolors in place without nesting", () => {
  const wrapped = '<span style="color: #ff0000">word</span>';
  const edit = applyMarkdownAction(wrapped, at(wrapped, 0, wrapped.length), "text-color", {
    textColor: "#00ff00",
  });
  expect(edit.next).toBe('<span style="color: #00ff00">word</span>');
});

test("color removal works when only the inner text is selected", () => {
  const wrapped = '<span style="color: #ff0000">word</span>';
  const innerFrom = '<span style="color: #ff0000">'.length;
  const edit = applyMarkdownAction(wrapped, at(wrapped, innerFrom, innerFrom + 4), "text-color", {
    textColor: "#ff0000",
  });
  expect(edit.next).toBe("word");
});

test("highlight wraps and toggles off", () => {
  const edit = applyMarkdownAction("hot", at("hot", 0, 3), "highlight", { highlightColor: "#fde047" });
  expect(edit.next).toBe('<span style="background: #fde047">hot</span>');
  const off = applyMarkdownAction(edit.next, at(edit.next, 0, edit.next.length), "highlight", {
    highlightColor: "#fde047",
  });
  expect(off.next).toBe("hot");
});

test("invalid color falls back to the default hex", () => {
  const edit = applyMarkdownAction("x", at("x", 0, 1), "text-color", { textColor: "red" });
  expect(edit.next).toBe('<span style="color: #2563eb">x</span>');
});

test("color then highlight combine into a single span", () => {
  const colored = applyMarkdownAction("word", at("word", 0, 4), "text-color", { textColor: "#ff0000" });
  expect(colored.next).toBe('<span style="color: #ff0000">word</span>');
  // colored.selection points at the inner `word`
  const both = applyMarkdownAction(colored.next, colored.selection, "highlight", {
    highlightColor: "#fde047",
  });
  expect(both.next).toBe('<span style="color: #ff0000; background: #fde047">word</span>');
});

test("highlight then color also combine into one span", () => {
  const hl = applyMarkdownAction("word", at("word", 0, 4), "highlight", { highlightColor: "#fde047" });
  const both = applyMarkdownAction(hl.next, hl.selection, "text-color", { textColor: "#ff0000" });
  // style order is normalized: color always precedes background
  expect(both.next).toBe('<span style="color: #ff0000; background: #fde047">word</span>');
});

test("removing one of two combined styles keeps the other", () => {
  const combined = '<span style="color: #ff0000; background: #fde047">word</span>';
  const edit = applyMarkdownAction(combined, at(combined, 0, combined.length), "text-color", {
    textColor: "#ff0000",
  });
  expect(edit.next).toBe('<span style="background: #fde047">word</span>');
});

test("recoloring a combined span updates only the color", () => {
  const combined = '<span style="color: #ff0000; background: #fde047">word</span>';
  const edit = applyMarkdownAction(combined, at(combined, 0, combined.length), "text-color", {
    textColor: "#0000ff",
  });
  expect(edit.next).toBe('<span style="color: #0000ff; background: #fde047">word</span>');
});

test("removing the last style unwraps a combined span back to text", () => {
  const colorOnly = '<span style="color: #ff0000">word</span>';
  const edit = applyMarkdownAction(colorOnly, at(colorOnly, 0, colorOnly.length), "text-color", {
    textColor: "#ff0000",
  });
  expect(edit.next).toBe("word");
});

test("highlight applies to the whole span even from a partial / cursor selection", () => {
  const colored = '<span style="color: #ff0000">hello world</span>';
  const innerStart = '<span style="color: #ff0000">'.length;
  // select just "world" inside the colored phrase
  const partial = applyMarkdownAction(colored, at(colored, innerStart + 6, innerStart + 11), "highlight", {
    highlightColor: "#fde047",
  });
  expect(partial.next).toBe('<span style="color: #ff0000; background: #fde047">hello world</span>');
  // a bare cursor inside the span also works
  const cursor = applyMarkdownAction(colored, at(colored, innerStart + 2, innerStart + 2), "highlight", {
    highlightColor: "#fde047",
  });
  expect(cursor.next).toBe('<span style="color: #ff0000; background: #fde047">hello world</span>');
});

test("highlight removal works on a legacy mark tag", () => {
  const legacy = '<mark style="background: #fde047">word</mark>';
  const edit = applyMarkdownAction(legacy, at(legacy, 0, legacy.length), "highlight", {
    highlightColor: "#fde047",
  });
  expect(edit.next).toBe("word");
});

// ---------------------------------------------------------------------------
// headings / quote / checklist (line-level toggles)
// ---------------------------------------------------------------------------

test("h1 adds then removes the heading marker on repeat", () => {
  const on = applyMarkdownAction("Title", at("Title", 0, 0), "h1");
  expect(on.next).toBe("# Title");
  const off = applyMarkdownAction(on.next, at(on.next, 0, 0), "h1");
  expect(off.next).toBe("Title");
});

test("h2 replaces an existing h1 marker", () => {
  const edit = applyMarkdownAction("# Title", at("# Title", 0, 0), "h2");
  expect(edit.next).toBe("## Title");
});

test("quote toggles a line on and off", () => {
  const on = applyMarkdownAction("cite", at("cite", 0, 0), "quote");
  expect(on.next).toBe("> cite");
  const off = applyMarkdownAction(on.next, at(on.next, 0, 0), "quote");
  expect(off.next).toBe("cite");
});

test("checklist toggles across multiple selected lines", () => {
  const src = "one\ntwo";
  const on = applyMarkdownAction(src, at(src, 0, src.length), "checklist");
  expect(on.next).toBe("- [ ] one\n- [ ] two");
  const off = applyMarkdownAction(on.next, at(on.next, 0, on.next.length), "checklist");
  expect(off.next).toBe("one\ntwo");
});

test("checklist toggle off handles a checked item", () => {
  const src = "- [x] done";
  const edit = applyMarkdownAction(src, at(src, 0, src.length), "checklist");
  expect(edit.next).toBe("done");
});

// ---------------------------------------------------------------------------
// link / image
// ---------------------------------------------------------------------------

test("link wraps a selection and unwraps an existing link", () => {
  const on = applyMarkdownAction("docs", at("docs", 0, 4), "link");
  expect(on.next).toBe("[docs](https://example.com)");
  const off = applyMarkdownAction(on.next, at(on.next, 0, on.next.length), "link");
  expect(off.next).toBe("docs");
});

test("image unwraps back to its alt text", () => {
  const src = "![logo](./image.png)";
  const edit = applyMarkdownAction(src, at(src, 0, src.length), "image");
  expect(edit.next).toBe("logo");
});

// ---------------------------------------------------------------------------
// insertion-only actions
// ---------------------------------------------------------------------------

test("table inserts a markdown table scaffold", () => {
  const edit = applyMarkdownAction("", at("", 0, 0), "table");
  expect(edit.next).toBe("| Column | Value |\n| --- | --- |\n| Item | Detail |");
});

test("hr inserts a horizontal rule", () => {
  const edit = applyMarkdownAction("", at("", 0, 0), "hr");
  expect(edit.next).toBe("\n---\n");
});

// ---------------------------------------------------------------------------
// new line-level toggles: h3, lists
// ---------------------------------------------------------------------------

test("h3 adds then removes the heading marker on repeat", () => {
  const on = applyMarkdownAction("Title", at("Title", 0, 0), "h3");
  expect(on.next).toBe("### Title");
  const off = applyMarkdownAction(on.next, at(on.next, 0, 0), "h3");
  expect(off.next).toBe("Title");
});

test("strikethrough wraps and toggles off", () => {
  const on = applyMarkdownAction("gone", at("gone", 0, 4), "strikethrough");
  expect(on.next).toBe("~~gone~~");
  const off = applyMarkdownAction(on.next, on.selection, "strikethrough");
  expect(off.next).toBe("gone");
});

test("code-block wraps the selection in a fenced block", () => {
  const edit = applyMarkdownAction("x = 1", at("x = 1", 0, 5), "code-block");
  expect(edit.next).toBe("```\nx = 1\n```");
});

test("bullet-list toggles across multiple selected lines", () => {
  const src = "one\ntwo";
  const on = applyMarkdownAction(src, at(src, 0, src.length), "bullet-list");
  expect(on.next).toBe("- one\n- two");
  const off = applyMarkdownAction(on.next, at(on.next, 0, on.next.length), "bullet-list");
  expect(off.next).toBe("one\ntwo");
});

test("ordered-list numbers selected lines and toggles off", () => {
  const src = "alpha\nbeta\ngamma";
  const on = applyMarkdownAction(src, at(src, 0, src.length), "ordered-list");
  expect(on.next).toBe("1. alpha\n2. beta\n3. gamma");
  const off = applyMarkdownAction(on.next, at(on.next, 0, on.next.length), "ordered-list");
  expect(off.next).toBe("alpha\nbeta\ngamma");
});
