import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";

/**
 * Guards the WYSIWYG editor against silent content loss (F01).
 *
 * The rich editor re-serializes the whole document on every edit. Before we let
 * the user type into it, the loaded markdown is pushed through the editor and
 * back; if the rendered structure differs, the document is not safe to edit
 * there and must be edited in the markdown (source) view instead.
 */

const FRONTMATTER_RE = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

export type SplitDocument = {
  /** raw frontmatter block including both `---` fences and its line break, or "" */
  frontmatter: string;
  body: string;
};

/** Frontmatter is kept verbatim outside the editor; tiptap would turn it into an hr + paragraph. */
export function splitFrontmatter(source: string): SplitDocument {
  const match = source.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: "", body: source };
  return { frontmatter: match[0], body: source.slice(match[0].length) };
}

// html on + task lists so structure comparisons see the same constructs the
// preview renders. markdown-it never touches the DOM, so this also runs in tests.
const structureMd = new MarkdownIt({ html: true, linkify: true }).use(taskLists, { enabled: false });

function normalizeHtml(html: string): string {
  return html
    .replace(/\r\n?/g, "\n")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when both markdown strings render to the same HTML structure (whitespace-insensitive). */
export function sameMarkdownStructure(a: string, b: string): boolean {
  if (a === b) return true;
  return normalizeHtml(structureMd.render(a)) === normalizeHtml(structureMd.render(b));
}

export type LineStyle = { eol: "\n" | "\r\n"; trailingNewline: boolean };

export function detectLineStyle(text: string): LineStyle {
  return {
    eol: text.includes("\r\n") ? "\r\n" : "\n",
    trailingNewline: /\r?\n$/.test(text),
  };
}

/** Re-applies the original line endings / final newline to serializer output. */
export function applyLineStyle(text: string, style: LineStyle): string {
  let out = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (style.trailingNewline && out.length > 0) out += "\n";
  return style.eol === "\r\n" ? out.replace(/\n/g, "\r\n") : out;
}
