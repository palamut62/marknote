export type TextRange = { from: number; to: number };

export type MarkdownAction =
  | "h1"
  | "h2"
  | "h3"
  | "bold"
  | "italic"
  | "strikethrough"
  | "quote"
  | "inline-code"
  | "code-block"
  | "text-color"
  | "highlight"
  | "link"
  | "image"
  | "checklist"
  | "bullet-list"
  | "ordered-list"
  | "hr"
  | "table";

export type MarkdownEdit = {
  next: string;
  selection: TextRange;
  range: TextRange;
  insert: string;
};

export type MarkdownActionOptions = {
  textColor?: string;
  highlightColor?: string;
};

export type HeadingItem = {
  level: number;
  text: string;
  pos: number;
  line: number;
};

export type MarkdownIssue = {
  label: string;
  pos: number;
  line: number;
};

function selectedOrPlaceholder(source: string, range: TextRange, placeholder: string): string {
  const selected = source.slice(range.from, range.to);
  return selected || placeholder;
}

/** Build an edit that replaces `range` with `insert`. Selection defaults to the
 *  whole inserted text but can be narrowed (e.g. to the inner content) so that
 *  re-running the same action toggles cleanly. */
function makeEdit(
  source: string,
  range: TextRange,
  insert: string,
  selection?: TextRange,
): MarkdownEdit {
  return {
    next: `${source.slice(0, range.from)}${insert}${source.slice(range.to)}`,
    selection: selection ?? { from: range.from, to: range.from + insert.length },
    range,
    insert,
  };
}

function replaceRange(source: string, range: TextRange, insert: string): MarkdownEdit {
  return makeEdit(source, range, insert);
}

function keepRange(source: string, range: TextRange): MarkdownEdit {
  return {
    next: source,
    selection: range,
    range,
    insert: source.slice(range.from, range.to),
  };
}

function safeHexColor(value: string | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? "") ? value as string : fallback;
}

function lineBounds(source: string, range: TextRange): TextRange {
  const from = source.lastIndexOf("\n", Math.max(0, range.from - 1)) + 1;
  const nextBreak = source.indexOf("\n", range.to);
  const to = nextBreak === -1 ? source.length : nextBreak;
  return { from, to };
}

function mapLines(text: string, mapper: (line: string) => string): string {
  return text.split("\n").map(mapper).join("\n");
}

/**
 * Wrap/unwrap a selection with a symmetric inline marker (`**`, `_`, `` ` ``).
 * Toggles off when the marker is already present — either inside the selection
 * (`**x**` selected) or hugging it (`x` selected with `**` on both sides).
 */
function toggleInline(
  source: string,
  range: TextRange,
  marker: string,
  placeholder: string,
): MarkdownEdit {
  const ml = marker.length;
  const selected = source.slice(range.from, range.to);

  // Case A: the markers are part of the selection — strip them. We require the
  // inner text NOT to begin/end with the same marker so that literal underscore
  // (snake_case / __dunder__) or `**`-laden content isn't mistaken for emphasis
  // and silently mangled — e.g. selecting `__init__` must not become `_init_`.
  if (selected.length >= ml * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(ml, selected.length - ml);
    if (!inner.startsWith(marker) && !inner.endsWith(marker)) {
      return makeEdit(source, range, inner, { from: range.from, to: range.from + inner.length });
    }
  }

  // Case B: the markers hug the selection — strip the surrounding pair. Guard
  // against runs of the marker char (e.g. selecting `init` inside `__init__`):
  // if the char just outside the pair is also the marker char, it's not a clean
  // emphasis wrapper, so leave the literal underscores/asterisks alone.
  if (
    range.from >= ml &&
    source.slice(range.from - ml, range.from) === marker &&
    source.slice(range.to, range.to + ml) === marker &&
    source[range.from - ml - 1] !== marker[0] &&
    source[range.to + ml] !== marker[marker.length - 1]
  ) {
    const outer = { from: range.from - ml, to: range.to + ml };
    return makeEdit(source, outer, selected, { from: outer.from, to: outer.from + selected.length });
  }

  // Otherwise wrap, leaving the inner content selected so a second press hits
  // Case B above (markers now hug the selection) and cleanly toggles it off.
  const content = selected || placeholder;
  const insert = `${marker}${content}${marker}`;
  const innerFrom = range.from + ml;
  return makeEdit(source, range, insert, { from: innerFrom, to: innerFrom + content.length });
}

type SpanStyle = { color?: string; background?: string };

type StyledWrapper = SpanStyle & { from: number; to: number; text: string };

/** Parse a `style="…"` attribute body into the color / background it carries. */
function parseStyle(style: string): SpanStyle {
  const out: SpanStyle = {};
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!value) continue;
    if (key === "color") out.color = value;
    else if (key === "background" || key === "background-color") out.background = value;
  }
  return out;
}

/**
 * Find a styled inline wrapper (`<span style="…">` we emit, or a legacy
 * `<mark style="…">`) that ENCLOSES the selection. Scans every styled tag in the
 * source and returns the one whose full range contains the selection — so it
 * works whether the user selected the inner text, the whole tag, or anything in
 * between, instead of requiring pixel-perfect selection boundaries.
 */
function findStyledWrapper(source: string, range: TextRange): StyledWrapper | null {
  const tagRe = /<(span|mark) style="([^"]*)">([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(source)) !== null) {
    const from = m.index;
    const to = from + m[0].length;
    if (range.from >= from && range.to <= to) {
      return { from, to, text: m[3], ...parseStyle(m[2]) };
    }
  }
  return null;
}

/** Re-emit a styled span from text + styles, or unwrap to plain text when empty. */
function rebuildSpan(source: string, range: TextRange, text: string, styles: SpanStyle): MarkdownEdit {
  const parts: string[] = [];
  if (styles.color) parts.push(`color: ${styles.color}`);
  if (styles.background) parts.push(`background: ${styles.background}`);
  if (parts.length === 0) {
    // no styles left → drop the wrapper entirely
    return makeEdit(source, range, text, { from: range.from, to: range.from + text.length });
  }
  const open = `<span style="${parts.join("; ")}">`;
  const insert = `${open}${text}</span>`;
  const innerFrom = range.from + open.length;
  return makeEdit(source, range, insert, { from: innerFrom, to: innerFrom + text.length });
}

/**
 * Apply text color or highlight as ONE combined `<span>`. Color and highlight
 * share a single wrapper (e.g. `<span style="color: …; background: …">`) so they
 * compose cleanly instead of nesting tags. Re-applying the SAME value clears just
 * that property; a different value updates it; clearing the last property unwraps.
 */
function applyStyledSpan(
  source: string,
  range: TextRange,
  prop: keyof SpanStyle,
  value: string,
): MarkdownEdit {
  const wrap = findStyledWrapper(source, range);
  if (wrap) {
    const styles: SpanStyle = { color: wrap.color, background: wrap.background };
    const current = styles[prop];
    if (current && current.toLowerCase() === value.toLowerCase()) {
      delete styles[prop]; // same value → toggle this property off
    } else {
      styles[prop] = value;
    }
    return rebuildSpan(source, { from: wrap.from, to: wrap.to }, wrap.text, styles);
  }

  // Nothing to wrap without a selection.
  const selected = source.slice(range.from, range.to);
  if (!selected) return keepRange(source, range);
  return rebuildSpan(source, range, selected, { [prop]: value });
}

/** Wrap/unwrap a selection that may already be a markdown link or image. */
function toggleLink(source: string, range: TextRange, image: boolean): MarkdownEdit {
  const selected = source.slice(range.from, range.to);
  const re = image ? /^!\[([\s\S]*?)\]\([\s\S]*?\)$/ : /^\[([\s\S]*?)\]\([\s\S]*?\)$/;
  const m = re.exec(selected);
  if (m) {
    const text = m[1];
    return makeEdit(source, range, text, { from: range.from, to: range.from + text.length });
  }
  if (image) {
    const alt = selected || "alt text";
    return replaceRange(source, range, `![${alt}](./image.png)`);
  }
  const label = selected || "text";
  return replaceRange(source, range, `[${label}](https://example.com)`);
}

/** Toggle a line-level prefix (heading / quote / checklist / bullet) across the selected lines. */
function toggleLinePrefix(
  source: string,
  range: TextRange,
  action: "h1" | "h2" | "h3" | "quote" | "checklist" | "bullet-list",
): MarkdownEdit {
  const bounds = lineBounds(source, range);
  const lines = source.slice(bounds.from, bounds.to);
  const arr = lines.split("\n");
  const nonEmpty = arr.filter((l) => l.trim().length > 0);

  const config = {
    h1: { add: (l: string) => `# ${l}`, has: /^# /, strip: /^#{1,6}\s+/, placeholder: "Heading" },
    h2: { add: (l: string) => `## ${l}`, has: /^## /, strip: /^#{1,6}\s+/, placeholder: "Heading" },
    h3: { add: (l: string) => `### ${l}`, has: /^### /, strip: /^#{1,6}\s+/, placeholder: "Heading" },
    quote: { add: (l: string) => `> ${l}`, has: /^>\s?/, strip: /^>\s?/, placeholder: "Quote" },
    checklist: {
      add: (l: string) => `- [ ] ${l}`,
      has: /^[-*]\s+\[[ xX]\]\s+/,
      strip: /^[-*]\s+\[[ xX]\]\s+/,
      placeholder: "Task",
    },
    "bullet-list": {
      // strip an existing checklist/bullet marker first so toggling is clean
      add: (l: string) => `- ${l}`,
      has: /^[-*]\s+(?!\[[ xX]\]\s)/,
      strip: /^[-*]\s+(?:\[[ xX]\]\s+)?/,
      placeholder: "Item",
    },
  }[action];

  const allApplied = nonEmpty.length > 0 && nonEmpty.every((l) => config.has.test(l));
  const insert = allApplied
    ? mapLines(lines, (l) => l.replace(config.strip, ""))
    : mapLines(lines || config.placeholder, (l) => config.add(l.replace(config.strip, "")));
  return replaceRange(source, bounds, insert);
}

/** Toggle an ordered (numbered) list across the selected lines, renumbering from 1. */
function toggleOrderedList(source: string, range: TextRange): MarkdownEdit {
  const bounds = lineBounds(source, range);
  const lines = source.slice(bounds.from, bounds.to);
  const has = /^\d+\.\s+/;
  const nonEmpty = lines.split("\n").filter((l) => l.trim().length > 0);
  const allApplied = nonEmpty.length > 0 && nonEmpty.every((l) => has.test(l));

  if (allApplied) {
    return replaceRange(source, bounds, mapLines(lines, (l) => l.replace(has, "")));
  }
  let n = 0;
  const insert = mapLines(lines || "Item", (l) => `${++n}. ${l.replace(has, "")}`);
  return replaceRange(source, bounds, insert);
}

export function applyMarkdownAction(
  source: string,
  range: TextRange,
  action: MarkdownAction,
  options: MarkdownActionOptions = {},
): MarkdownEdit {
  switch (action) {
    case "h1":
    case "h2":
    case "h3":
    case "quote":
    case "checklist":
    case "bullet-list":
      return toggleLinePrefix(source, range, action);
    case "ordered-list":
      return toggleOrderedList(source, range);
    case "bold":
      return toggleInline(source, range, "**", "text");
    case "italic":
      return toggleInline(source, range, "_", "text");
    case "strikethrough":
      return toggleInline(source, range, "~~", "text");
    case "inline-code":
      return toggleInline(source, range, "`", "text");
    case "code-block": {
      const selected = selectedOrPlaceholder(source, range, "text");
      return replaceRange(source, range, `\`\`\`\n${selected}\n\`\`\``);
    }
    case "text-color":
      return applyStyledSpan(source, range, "color", safeHexColor(options.textColor, "#2563eb"));
    case "highlight":
      return applyStyledSpan(source, range, "background", safeHexColor(options.highlightColor, "#fde047"));
    case "link":
      return toggleLink(source, range, false);
    case "image":
      return toggleLink(source, range, true);
    case "hr":
      return replaceRange(source, range, "\n---\n");
    case "table":
      return replaceRange(source, range, "| Column | Value |\n| --- | --- |\n| Item | Detail |");
    default:
      return replaceRange(source, range, selectedOrPlaceholder(source, range, "text"));
  }
}

export function insertTemplate(source: string, range: TextRange, kind: "note" | "readme" | "prompt"): MarkdownEdit {
  const templates = {
    note: "# Note\n\n## Summary\n\n## Details\n\n## Next steps\n\n- [ ] ",
    readme: "# Project Name\n\n## Overview\n\n## Installation\n\n```bash\nnpm install\n```\n\n## Usage\n\n## Notes\n",
    prompt: "# Task\n\n## Context\n\n## Requirements\n\n- \n\n## Expected output\n\n",
  } as const;
  return replaceRange(source, range, templates[kind]);
}

export function extractHeadings(source: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  let pos = 0;
  source.split("\n").forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2],
        pos,
        line: index + 1,
      });
    }
    pos += line.length + 1;
  });
  return headings;
}

export function lintMarkdown(source: string): MarkdownIssue[] {
  const issues: MarkdownIssue[] = [];
  const seen = new Set<string>();
  let previousHeading = 0;
  let pos = 0;

  source.split("\n").forEach((line, index) => {
    const lineNo = index + 1;
    const heading = /^(#{1,6})\s*(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (!text) issues.push({ label: "empty heading", pos, line: lineNo });
      if (previousHeading && level > previousHeading + 1) {
        issues.push({ label: "heading level jumps", pos, line: lineNo });
      }
      const key = text.toLowerCase();
      if (key && seen.has(key)) issues.push({ label: "duplicate heading", pos, line: lineNo });
      if (key) seen.add(key);
      previousHeading = level;
    }
    if (/\[[^\]]*\]\(\s*\)/.test(line)) issues.push({ label: "empty link target", pos, line: lineNo });
    if (/!\[\s*\]\([^)]+\)/.test(line)) issues.push({ label: "image missing alt text", pos, line: lineNo });
    if (/\s+$/.test(line)) issues.push({ label: "trailing whitespace", pos, line: lineNo });
    pos += line.length + 1;
  });

  return issues;
}
