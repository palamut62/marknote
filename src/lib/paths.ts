/**
 * Path helpers that behave the same for Windows (`C:\notes\a.md`) and POSIX
 * (`/home/u/notes/a.md`) paths. Comparison is separator-insensitive and, for
 * Windows-style paths, case-insensitive (NTFS default).
 */

function isWindowsStyle(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\") || path.includes("\\");
}

/** Comparable key: forward slashes, no trailing slash, lowercase on Windows. */
export function pathKey(path: string): string {
  let out = path.replace(/\\/g, "/");
  if (out.length > 1 && out.endsWith("/") && !/^[a-zA-Z]:\/$/.test(out)) out = out.slice(0, -1);
  return isWindowsStyle(path) ? out.toLowerCase() : out;
}

export function samePath(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return pathKey(a) === pathKey(b);
}

/** True when `path` equals `parent` or lives somewhere below it. */
export function isSameOrChildPath(path: string | null | undefined, parent: string | null | undefined): boolean {
  if (!path || !parent) return false;
  const p = pathKey(path);
  const root = pathKey(parent);
  if (p === root) return true;
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return p.startsWith(prefix);
}

/**
 * If `path` is `from` or inside it, return the equivalent path under `to`
 * (keeping `to`'s separator style). Otherwise return `path` unchanged.
 */
export function remapPath(path: string, from: string, to: string): string {
  if (!isSameOrChildPath(path, from)) return path;
  const fromLen = pathKey(from).length;
  const rest = path.replace(/\\/g, "/").slice(fromLen).replace(/^\//, "");
  if (!rest) return to;
  const sep = to.includes("\\") ? "\\" : "/";
  const base = to.endsWith(sep) ? to.slice(0, -1) : to;
  return `${base}${sep}${rest.split("/").join(sep)}`;
}

/** Null-safe variant for optional state values. */
export function remapOptionalPath(path: string | null, from: string, to: string): string | null {
  return path == null ? null : remapPath(path, from, to);
}
