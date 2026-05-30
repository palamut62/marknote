export type TextRange = { from: number; to: number };

export type MarkdownAction =
  | "h1"
  | "h2"
  | "bold"
  | "italic"
  | "quote"
  | "inline-code"
  | "code-block"
  | "text-color"
  | "highlight"
  | "link"
  | "image"
  | "checklist"
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

  // Case A: the markers are part of the selection — strip them.
  if (selected.length >= ml * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(ml, selected.length - ml);
    return makeEdit(source, range, inner, { from: range.from, to: range.from + inner.length });
  }

  // Case B: the markers hug the selection — strip the surrounding pair.
  if (
    range.from >= ml &&
    source.slice(range.from - ml, range.from) === marker &&
    source.slice(range.to, range.to + ml) === marker
  ) {
    const outer = { from: range.from - ml, to: range.to + ml };
    return makeEdit(source, outer, selected, { from: outer.from, to: outer.from + selected.length });
  }

  // Otherwise wrap, leaving the inner content selected so a second press undoes it.
  const content = selected || placeholder;
  const insert = `${marker}${content}${marker}`;
  const innerFrom = range.from + ml;
  return makeEdit(source, range, insert, { from: innerFrom, to: innerFrom + content.length });
}

/**
 * Wrap/unwrap a selection with an inline HTML tag (`<span style="color: …">` or
 * `<mark style="background: …">`). Re-applying with the SAME color removes it;
 * applying with a DIFFERENT color recolors in place (no nesting).
 */
function toggleColorTag(
  source: string,
  range: TextRange,
  tag: "span" | "mark",
  attr: "color" | "background",
  color: string,
): MarkdownEdit {
  const open = (c: string) => `<${tag} style="${attr}: ${c}">`;
  const close = `</${tag}>`;
  const colorRe = "#[0-9a-fA-F]{6}";
  const selected = source.slice(range.from, range.to);

  // Detect an existing wrapper — either fully selected or hugging the selection.
  const wholeRe = new RegExp(`^<${tag} style="${attr}: (${colorRe})">([\\s\\S]*)</${tag}>$`);
  const whole = wholeRe.exec(selected);
  let wrapRange: TextRange | null = null;
  let inner = "";
  let currentColor = "";

  if (whole) {
    wrapRange = range;
    currentColor = whole[1];
    inner = whole[2];
  } else if (source.slice(range.to, range.to + close.length) === close) {
    const openRe = new RegExp(`<${tag} style="${attr}: (${colorRe})">$`);
    const om = openRe.exec(source.slice(0, range.from));
    if (om) {
      wrapRange = { from: om.index, to: range.to + close.length };
      currentColor = om[1];
      inner = selected;
    }
  }

  if (wrapRange) {
    // same color → strip the wrapper; different color → recolor in place.
    if (currentColor.toLowerCase() === color.toLowerCase()) {
      return makeEdit(source, wrapRange, inner, { from: wrapRange.from, to: wrapRange.from + inner.length });
    }
    const insert = `${open(color)}${inner}${close}`;
    const innerFrom = wrapRange.from + open(color).length;
    return makeEdit(source, wrapRange, insert, { from: innerFrom, to: innerFrom + inner.length });
  }

  // Nothing to wrap without a selection.
  if (!selected) return keepRange(source, range);
  const insert = `${open(color)}${selected}${close}`;
  const innerFrom = range.from + open(color).length;
  return makeEdit(source, range, insert, { from: innerFrom, to: innerFrom + selected.length });
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

/** Toggle a line-level prefix (heading / quote / checklist) across the selected lines. */
function toggleLinePrefix(
  source: string,
  range: TextRange,
  action: "h1" | "h2" | "quote" | "checklist",
): MarkdownEdit {
  const bounds = lineBounds(source, range);
  const lines = source.slice(bounds.from, bounds.to);
  const arr = lines.split("\n");
  const nonEmpty = arr.filter((l) => l.trim().length > 0);

  const config = {
    h1: { add: (l: string) => `# ${l}`, has: /^# /, strip: /^#{1,6}\s+/, placeholder: "Heading" },
    h2: { add: (l: string) => `## ${l}`, has: /^## /, strip: /^#{1,6}\s+/, placeholder: "Heading" },
    quote: { add: (l: string) => `> ${l}`, has: /^>\s?/, strip: /^>\s?/, placeholder: "Quote" },
    checklist: {
      add: (l: string) => `- [ ] ${l}`,
      has: /^[-*]\s+\[[ xX]\]\s+/,
      strip: /^[-*]\s+\[[ xX]\]\s+/,
      placeholder: "Task",
    },
  }[action];

  const allApplied = nonEmpty.length > 0 && nonEmpty.every((l) => config.has.test(l));
  const insert = allApplied
    ? mapLines(lines, (l) => l.replace(config.strip, ""))
    : mapLines(lines || config.placeholder, (l) => config.add(l.replace(config.strip, "")));
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
    case "quote":
    case "checklist":
      return toggleLinePrefix(source, range, action);
    case "bold":
      return toggleInline(source, range, "**", "text");
    case "italic":
      return toggleInline(source, range, "_", "text");
    case "inline-code":
      return toggleInline(source, range, "`", "text");
    case "code-block": {
      const selected = selectedOrPlaceholder(source, range, "text");
      return replaceRange(source, range, `\`\`\`\n${selected}\n\`\`\``);
    }
    case "text-color":
      return toggleColorTag(source, range, "span", "color", safeHexColor(options.textColor, "#2563eb"));
    case "highlight":
      return toggleColorTag(source, range, "mark", "background", safeHexColor(options.highlightColor, "#fde047"));
    case "link":
      return toggleLink(source, range, false);
    case "image":
      return toggleLink(source, range, true);
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
