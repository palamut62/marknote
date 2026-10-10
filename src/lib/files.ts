import { documentDir } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readDir, readFile, readTextFile, writeTextFile, exists, stat, rename, mkdir, remove } from "@tauri-apps/plugin-fs";

export type FileEntry = {
  name: string;
  path: string;
  isDir: boolean;
};

export async function pickFolder(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: "open folder",
  });
  if (typeof result === "string") return result;
  return null;
}

export async function pickMarkdownFile(): Promise<string | null> {
  const result = await open({
    multiple: false,
    title: "open markdown",
    filters: [{ name: "markdown / text", extensions: ["md", "markdown", "mdx", "txt"] }],
  });
  if (typeof result === "string") return result;
  return null;
}

/** Native "Save As" dialog. Returns path or null on cancel. */
export async function pickSaveMarkdown(defaultPath?: string): Promise<string | null> {
  const result = await save({
    title: "save markdown",
    defaultPath,
    // txt first: Windows uses the first extension when the typed name has none
    filters: [{ name: "text / markdown", extensions: ["txt", "md", "markdown", "mdx"] }],
  });
  return result ?? null;
}

export async function pickSaveHtml(defaultPath?: string): Promise<string | null> {
  const result = await save({
    title: "export html",
    defaultPath,
    filters: [{ name: "HTML", extensions: ["html"] }],
  });
  return result ?? null;
}

// .txt is included so plain-text notes open and render as markdown (paragraphs,
// lists, headings — anything markdown-it can detect — work the same way).
const MARKDOWN_EXT = /\.(md|markdown|mdx|txt)$/i;

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXT.test(path);
}

// .env / .env.local / .env.production / name.env — config files worth editing
// in place. They're dotfiles, so they need explicit allow-listing throughout.
export function isEnvPath(path: string): boolean {
  const name = basename(path);
  return name === ".env" || name.startsWith(".env.") || /\.env$/i.test(name);
}

/** Any plain-text file marknote can open and edit (markdown family + .env). */
export function isEditablePath(path: string): boolean {
  return isMarkdownPath(path) || isEnvPath(path);
}

export function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

export function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : "/";
}

export function joinPath(parent: string, child: string): string {
  const sep = parent.includes("\\") ? "\\" : "/";
  if (parent.endsWith(sep)) return `${parent}${child}`;
  return `${parent}${sep}${child}`;
}

export async function listFolder(path: string): Promise<FileEntry[]> {
  const entries = await readDir(path);
  return entries
    .filter((e) => !e.name.startsWith(".") || isEnvPath(e.name))
    .map((e) => ({
      name: e.name,
      path: joinPath(path, e.name),
      isDir: e.isDirectory,
    }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export type FlatFileEntry = {
  name: string;
  path: string;
  /** path relative to the walk root, for display ("notes/ideas.md") */
  rel: string;
};

const WALK_SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  ".next",
  ".vercel",
  ".cache",
]);

export const WALK_MAX_FILES = 5000;

export type WalkResult = {
  files: FlatFileEntry[];
  /** true when the WALK_MAX_FILES cap cut the walk short */
  truncated: boolean;
  /** folders that could not be read (permissions, vanished mid-walk) */
  unreadableDirs: number;
};

export async function walkMarkdownFilesDetailed(root: string, signal?: AbortSignal): Promise<WalkResult> {
  const out: FlatFileEntry[] = [];
  const sep = root.includes("\\") ? "\\" : "/";
  let truncated = false;
  let unreadableDirs = 0;

  async function visit(dir: string, relPrefix: string) {
    if (signal?.aborted) return;
    if (out.length >= WALK_MAX_FILES) {
      truncated = true;
      return;
    }
    let entries: Awaited<ReturnType<typeof readDir>>;
    try {
      entries = await readDir(dir);
    } catch {
      unreadableDirs += 1;
      return;
    }
    for (const e of entries) {
      if (signal?.aborted) return;
      if (out.length >= WALK_MAX_FILES) {
        truncated = true;
        return;
      }
      if (e.name.startsWith(".") && !isEnvPath(e.name)) continue;
      if (e.isDirectory && WALK_SKIP.has(e.name)) continue;
      const childPath = joinPath(dir, e.name);
      const childRel = relPrefix ? `${relPrefix}${sep}${e.name}` : e.name;
      if (e.isDirectory) {
        await visit(childPath, childRel);
      } else if (isEditablePath(e.name)) {
        out.push({ name: e.name, path: childPath, rel: childRel });
      }
    }
  }

  await visit(root, "");
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  return { files: out, truncated, unreadableDirs };
}

export async function walkMarkdownFiles(root: string): Promise<FlatFileEntry[]> {
  return (await walkMarkdownFilesDetailed(root)).files;
}

const MAX_MARKDOWN_BYTES = 5 * 1024 * 1024; // 5MB sanity cap

const BINARY_SIGNATURES: Array<{ bytes: number[]; label: string }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], label: "pdf" }, // %PDF
  { bytes: [0xff, 0xd8, 0xff], label: "jpeg image" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], label: "png image" },
  { bytes: [0x47, 0x49, 0x46, 0x38], label: "gif image" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], label: "zip / docx / xlsx" },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], label: "elf binary" },
  { bytes: [0xcf, 0xfa, 0xed, 0xfe], label: "mach-o binary" },
];

export type FileValidation =
  | { ok: true }
  | { ok: false; reason: string };

function binaryLabel(head: Uint8Array): string | null {
  for (const sig of BINARY_SIGNATURES) {
    if (sig.bytes.every((b, i) => head[i] === b)) return sig.label;
  }
  return null;
}

/** Quick guard before reading a file as markdown. Catches PDFs, images, oversized files. */
export async function validateMarkdownFile(path: string): Promise<FileValidation> {
  const result = await loadMarkdownFile(path);
  return result.ok ? { ok: true } : result;
}

export type LoadedMarkdown = { ok: true; content: string } | { ok: false; reason: string };

// fatal: invalid UTF-8 must not be silently replaced with U+FFFD and then saved
// back over the original bytes. ignoreBOM keeps a leading BOM in the text so a
// save writes it back unchanged.
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/**
 * Validates and reads a note with a single file read (size + binary signature
 * + UTF-8 check), instead of reading the whole file twice.
 */
export async function loadMarkdownFile(path: string): Promise<LoadedMarkdown> {
  const name = basename(path);
  if (!isEditablePath(path)) {
    return { ok: false, reason: `${name} desteklenen bir dosya değil. marknote .md / .markdown / .mdx / .txt / .env açar.` };
  }
  try {
    const info = await stat(path);
    if (info.size > MAX_MARKDOWN_BYTES) {
      const mb = (info.size / (1024 * 1024)).toFixed(1);
      return { ok: false, reason: `${name} ${mb} MB - güvenle açmak için çok büyük.` };
    }
    const bytes = await readFile(path);
    const label = binaryLabel(bytes.slice(0, 8));
    if (label) {
      return { ok: false, reason: `${name} bir ${label} gibi görünüyor. marknote yalnız düz metin notları açar.` };
    }
    try {
      return { ok: true, content: UTF8.decode(bytes) };
    } catch {
      return { ok: false, reason: `${name} UTF-8 metin değil; bozulmaması için açılmadı.` };
    }
  } catch (err) {
    return { ok: false, reason: `${name} okunamadı - ${err}` };
  }
}

export async function readMarkdown(path: string): Promise<string> {
  return readTextFile(path);
}

function tempPathFor(path: string): string {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  // dot-prefixed so the sidebar / search walkers skip it while it exists
  return joinPath(dirname(path), `.${basename(path)}.${stamp}.marknote-tmp`);
}

/**
 * Atomic save (R01): write the full text to a sibling temp file, then rename it
 * over the target. A crash, full disk or kill mid-write leaves either the old
 * file or the new one on disk, never a truncated mix. Rename replaces the
 * destination on Windows as well (MoveFileEx + REPLACE_EXISTING).
 */
export async function writeMarkdown(path: string, content: string): Promise<void> {
  const temp = tempPathFor(path);
  try {
    await writeTextFile(temp, content);
    await rename(temp, path);
  } catch (err) {
    try {
      if (await exists(temp)) await remove(temp);
    } catch {
      /* best effort cleanup; the original file is untouched */
    }
    throw err;
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

/** Thrown when a destination path already exists. Callers should surface a friendly toast. */
export const FS_CONFLICT = "FS_CONFLICT";

/** Move a file or folder into `dstParent`. Preserves the source basename. */
export async function moveEntry(src: string, dstParent: string): Promise<string> {
  const target = joinPath(dstParent, basename(src));
  if (target === src) return src;
  if (await pathExists(target)) throw new Error(FS_CONFLICT);
  await rename(src, target);
  return target;
}

/** Rename in place (same parent folder). `newName` is just the base name. */
export async function renameEntry(src: string, newName: string): Promise<string> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("empty name");
  const target = joinPath(dirname(src), trimmed);
  if (target === src) return src;
  if (await pathExists(target)) throw new Error(FS_CONFLICT);
  await rename(src, target);
  return target;
}

export async function createFolder(parent: string, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("empty name");
  const target = joinPath(parent, trimmed);
  if (await pathExists(target)) throw new Error(FS_CONFLICT);
  await mkdir(target, { recursive: false });
  return target;
}

export async function createMarkdownFile(parent: string, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("empty name");
  const withExt =
    /\.(md|markdown|mdx|txt)$/i.test(trimmed) || isEnvPath(trimmed) ? trimmed : `${trimmed}.txt`;
  const target = joinPath(parent, withExt);
  if (await pathExists(target)) throw new Error(FS_CONFLICT);
  await writeTextFile(target, "");
  return target;
}

export const NEW_NOTE_STEM = "Yeni not";

/** "Yeni not.txt", "Yeni not 2.txt", ... - the n-th candidate name for a new note. */
export function newNoteFileName(n: number): string {
  return n <= 1 ? `${NEW_NOTE_STEM}.txt` : `${NEW_NOTE_STEM} ${n}.txt`;
}

export function isNewNoteFileName(name: string): boolean {
  return /^Yeni not( \d+)?\.txt$/i.test(name);
}

/**
 * Where a new note lands: an explicitly chosen folder, else the folder the
 * user is working in (selected folder, the open file's folder, the workspace).
 */
export function resolveNewNoteFolder(opts: {
  explicit?: string | null;
  selectedFolder?: string | null;
  activePath?: string | null;
  rootPath?: string | null;
}): string | null {
  return opts.explicit
    ?? opts.selectedFolder
    ?? (opts.activePath ? dirname(opts.activePath) : null)
    ?? opts.rootPath
    ?? null;
}

/** Fallback home for new notes when no folder has been opened yet: Belgeler\Marknote. */
export async function defaultNotesFolder(): Promise<string> {
  return joinPath(await documentDir(), "Marknote");
}

/** Create an empty .txt note with the first free "Yeni not" name in `folder`. */
export async function createNewNoteFile(folder: string): Promise<string> {
  if (!(await pathExists(folder))) await mkdir(folder, { recursive: true });
  for (let n = 1; n <= 999; n += 1) {
    const target = joinPath(folder, newNoteFileName(n));
    if (await pathExists(target)) continue;
    await writeTextFile(target, "");
    return target;
  }
  throw new Error(FS_CONFLICT);
}

/** Permanently delete a file or empty folder. Used by undo of "create" ops. */
export async function removeEntry(path: string, isDir: boolean): Promise<void> {
  await remove(path, isDir ? { recursive: false } : undefined);
}
