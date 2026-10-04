import { stat } from "@tauri-apps/plugin-fs";
import { basename, loadMarkdownFile, walkMarkdownFilesDetailed, WALK_MAX_FILES } from "./files";
import { splitFrontmatter } from "./rich-compat";

/**
 * In-memory note index behind the note list and the unified search (title +
 * content in one box). Built from the open folder; every limit is reported so
 * the UI never shows a silently partial result (F07, R06).
 */

export type NoteEntry = {
  path: string;
  /** path relative to the folder root, for display */
  rel: string;
  name: string;
  title: string;
  excerpt: string;
  mtime: number | null;
  /** full text, kept only for files under CONTENT_CACHE_MAX_BYTES */
  content: string | null;
};

export type IndexProblem = { path: string; reason: string };

export type NoteIndex = {
  notes: NoteEntry[];
  /** folder walk hit WALK_MAX_FILES */
  truncatedFiles: boolean;
  /** files that could not be read; the rest of the index is still usable */
  problems: IndexProblem[];
  unreadableDirs: number;
};

export const CONTENT_CACHE_MAX_BYTES = 1024 * 1024;
const READ_CONCURRENCY = 6;

const HEADING_RE = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;

function stripInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_~`=]+/g, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "")
    .replace(/^\s*>\s?/, "")
    .trim();
}

function fileStem(name: string): string {
  return name.replace(/\.(md|markdown|mdx|txt)$/i, "");
}

/** First heading, else first non-empty line, else the file name. */
export function deriveTitle(content: string, fileName: string): string {
  const { body } = splitFrontmatter(content);
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(HEADING_RE);
    if (heading) return stripInline(heading[1]) || fileStem(fileName);
    const text = stripInline(line);
    if (text && !/^(```|---|\|)/.test(line.trim())) return text.slice(0, 120);
  }
  return fileStem(fileName);
}

/** Short plain-text summary that skips the title line and code fences. */
export function deriveExcerpt(content: string, title: string, max = 140): string {
  const { body } = splitFrontmatter(content);
  const parts: string[] = [];
  let inFence = false;
  let skippedTitle = false;
  for (const raw of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // tables read as noise in a one-line summary
    if (/^\s*\|/.test(raw)) continue;
    const heading = raw.match(HEADING_RE);
    const text = stripInline(heading ? heading[1] : raw);
    if (!text || /^[-|:\s]+$/.test(text)) continue;
    if (!skippedTitle && text === title) {
      skippedTitle = true;
      continue;
    }
    parts.push(text);
    if (parts.join(" ").length >= max) break;
  }
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return joined.length > max ? `${joined.slice(0, max - 1).trimEnd()}…` : joined;
}

export type SearchHit = {
  path: string;
  rel: string;
  title: string;
  /** "title" when the note name/title matches; otherwise the matching line */
  kind: "title" | "content";
  line: number | null;
  excerpt: string;
  /** the literal text to reveal in the editor after opening */
  match: string;
};

export type SearchResult = {
  hits: SearchHit[];
  /** more hits existed than `maxHits` */
  limited: boolean;
  /** notes whose text was too big to keep in memory and was not searched */
  skippedLarge: number;
};

function excerptAround(line: string, index: number, needleLength: number, radius = 60): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(line.length, index + needleLength + radius);
  return `${start > 0 ? "…" : ""}${line.slice(start, end).trim()}${end < line.length ? "…" : ""}`;
}

/**
 * Title matches first (one per note), then up to `perNote` content lines per
 * note. Case-insensitive with Turkish-aware lowercasing.
 */
export function searchNotes(
  notes: readonly NoteEntry[],
  query: string,
  { maxHits = 200, perNote = 3 }: { maxHits?: number; perNote?: number } = {},
): SearchResult {
  const needle = query.trim().toLocaleLowerCase("tr");
  const result: SearchResult = { hits: [], limited: false, skippedLarge: 0 };
  if (!needle) return result;

  const titleHits: SearchHit[] = [];
  const contentHits: SearchHit[] = [];
  for (const note of notes) {
    const titleText = `${note.title} ${note.rel}`.toLocaleLowerCase("tr");
    if (titleText.includes(needle)) {
      titleHits.push({
        path: note.path,
        rel: note.rel,
        title: note.title,
        kind: "title",
        line: null,
        excerpt: note.excerpt,
        match: query.trim(),
      });
    }
    if (note.content == null) {
      result.skippedLarge += 1;
      continue;
    }
    let found = 0;
    const lines = note.content.split(/\r?\n/);
    for (let i = 0; i < lines.length && found < perNote; i += 1) {
      const line = lines[i];
      const idx = line.toLocaleLowerCase("tr").indexOf(needle);
      if (idx < 0) continue;
      found += 1;
      contentHits.push({
        path: note.path,
        rel: note.rel,
        title: note.title,
        kind: "content",
        line: i + 1,
        excerpt: excerptAround(line, idx, needle.length),
        match: line.slice(idx, idx + needle.length),
      });
    }
  }
  const all = [...titleHits, ...contentHits];
  result.limited = all.length > maxHits;
  result.hits = all.slice(0, maxHits);
  return result;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>, signal?: AbortSignal): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !signal?.aborted) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Walks the folder and reads every note once. A single unreadable file is
 * recorded in `problems` and never aborts the whole build.
 */
export async function buildNoteIndex(root: string, signal?: AbortSignal): Promise<NoteIndex> {
  const walk = await walkMarkdownFilesDetailed(root, signal);
  const problems: IndexProblem[] = [];
  const entries = await mapLimit(walk.files, READ_CONCURRENCY, async (file): Promise<NoteEntry | null> => {
    let mtime: number | null = null;
    try {
      const info = await stat(file.path);
      mtime = info.mtime ? new Date(info.mtime).getTime() : null;
      if (info.size > CONTENT_CACHE_MAX_BYTES) {
        return { path: file.path, rel: file.rel, name: file.name, title: fileStem(file.name), excerpt: "", mtime, content: null };
      }
    } catch (err) {
      problems.push({ path: file.path, reason: String(err) });
      return null;
    }
    const loaded = await loadMarkdownFile(file.path);
    if (!loaded.ok) {
      problems.push({ path: file.path, reason: loaded.reason });
      return null;
    }
    const title = deriveTitle(loaded.content, file.name);
    return {
      path: file.path,
      rel: file.rel,
      name: file.name,
      title,
      excerpt: deriveExcerpt(loaded.content, title),
      mtime,
      content: loaded.content,
    };
  }, signal);
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  return {
    notes: entries.filter((e): e is NoteEntry => e != null),
    truncatedFiles: walk.truncated,
    problems,
    unreadableDirs: walk.unreadableDirs,
  };
}

/** Replace (or add) one note after a save, without re-walking the folder. */
export function upsertNote(index: NoteIndex, path: string, rel: string, content: string): NoteIndex {
  const name = basename(path);
  const title = deriveTitle(content, name);
  const entry: NoteEntry = {
    path,
    rel,
    name,
    title,
    excerpt: deriveExcerpt(content, title),
    mtime: Date.now(),
    content: content.length > CONTENT_CACHE_MAX_BYTES ? null : content,
  };
  const others = index.notes.filter((n) => n.path !== path);
  return { ...index, notes: [entry, ...others] };
}

export const INDEX_FILE_LIMIT = WALK_MAX_FILES;
