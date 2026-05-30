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

function replaceRange(source: string, range: TextRange, insert: string): MarkdownEdit {
  return {
    next: `${source.slice(0, range.from)}${insert}${source.slice(range.to)}`,
    selection: { from: range.from, to: range.from + insert.length },
    range,
    insert,
  };
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

export function applyMarkdownAction(
  source: string,
  range: TextRange,
  action: MarkdownAction,
  options: MarkdownActionOptions = {},
): MarkdownEdit {
  if (action === "h1" || action === "h2") {
    const hasSelection = range.from !== range.to;
    const bounds = hasSelection ? range : lineBounds(source, range);
    const level = action === "h1" ? "# " : "## ";
    const lines = source.slice(bounds.from, bounds.to);
    const insert = mapLines(lines || "Heading", (line) => `${level}${line.replace(/^#{1,6}\s+/, "")}`);
    return replaceRange(source, bounds, insert);
  }

  if (action === "quote" || action === "checklist") {
    const hasSelection = range.from !== range.to;
    const bounds = hasSelection ? range : lineBounds(source, range);
    const lines = source.slice(bounds.from, bounds.to);
    const insert = mapLines(lines || (action === "quote" ? "Quote" : "Task"), (line) =>
      action === "quote" ? `> ${line.replace(/^>\s?/, "")}` : `- [ ] ${line.replace(/^[-*]\s+\[[ xX]\]\s+/, "")}`,
    );
    return replaceRange(source, bounds, insert);
  }

  const selected = selectedOrPlaceholder(source, range, "text");
  switch (action) {
    case "bold":
      return replaceRange(source, range, `**${selected}**`);
    case "italic":
      return replaceRange(source, range, `_${selected}_`);
    case "inline-code":
      return replaceRange(source, range, `\`${selected}\``);
    case "code-block":
      return replaceRange(source, range, `\`\`\`\n${selected}\n\`\`\``);
    case "text-color": {
      const selectedText = source.slice(range.from, range.to);
      if (!selectedText) return keepRange(source, range);
      return replaceRange(source, range, `<span style="color: ${safeHexColor(options.textColor, "#2563eb")}">${selectedText}</span>`);
    }
    case "highlight": {
      const selectedText = source.slice(range.from, range.to);
      if (!selectedText) return keepRange(source, range);
      return replaceRange(source, range, `<mark style="background: ${safeHexColor(options.highlightColor, "#fde047")}">${selectedText}</mark>`);
    }
    case "link":
      return replaceRange(source, range, `[${selected}](https://example.com)`);
    case "image":
      return replaceRange(source, range, `![${selected === "text" ? "alt text" : selected}](./image.png)`);
    case "table":
      return replaceRange(source, range, "| Column | Value |\n| --- | --- |\n| Item | Detail |");
    default:
      return replaceRange(source, range, selected);
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
