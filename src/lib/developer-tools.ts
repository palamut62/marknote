export type FrontmatterResult = {
  present: boolean;
  valid: boolean;
  fields: Array<{ key: string; value: string }>;
  error?: string;
};

export type DocumentLink = {
  label: string;
  target: string;
  line: number;
  external: boolean;
  image: boolean;
};

export function parseFrontmatter(source: string): FrontmatterResult {
  const normalized = source.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) return { present: false, valid: true, fields: [] };
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) return { present: true, valid: false, fields: [], error: "missing closing ---" };
  const fields: Array<{ key: string; value: string }> = [];
  const lines = normalized.slice(4, end).split("\n");
  for (const [index, line] of lines.entries()) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      return { present: true, valid: false, fields, error: `invalid field on line ${index + 2}` };
    }
    fields.push({ key: match[1], value: match[2] });
  }
  return { present: true, valid: true, fields };
}

export function extractDocumentLinks(source: string): DocumentLink[] {
  const links: DocumentLink[] = [];
  const pattern = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) != null) {
    const target = match[3];
    links.push({
      label: match[2],
      target,
      line: source.slice(0, match.index).split("\n").length,
      external: /^(https?:|mailto:|tel:)/i.test(target),
      image: match[1] === "!",
    });
  }
  return links;
}

export function applyTextTransform(source: string, find: string, replacement: string): string {
  if (!find) return source;
  return source.split(find).join(replacement);
}

export function upsertFrontmatterField(source: string, key: string, value: string): string {
  const safeKey = key.trim().replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeKey) return source;
  const normalized = source.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) return `---\n${safeKey}: ${value}\n---\n${normalized}`;
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) return source;
  const body = normalized.slice(4, end);
  const pattern = new RegExp(`^${safeKey}:.*$`, "m");
  const nextBody = pattern.test(body) ? body.replace(pattern, `${safeKey}: ${value}`) : `${body}\n${safeKey}: ${value}`;
  return `---\n${nextBody}\n---${normalized.slice(end + 4)}`;
}
