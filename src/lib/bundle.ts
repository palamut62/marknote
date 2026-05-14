import { readMarkdown, validateMarkdownFile } from "./files";

export type BundleFormat = "separator" | "xml";

type BundleOptions = {
  format?: BundleFormat;
};

function relativeName(path: string, root: string | null): string {
  if (!root) return path;
  if (path.startsWith(root)) {
    return path.slice(root.length).replace(/^[\\/]+/, "");
  }
  return path;
}

/** Concat selected markdown files into a single prompt-ready blob. */
export async function buildBundle(
  paths: readonly string[],
  rootPath: string | null,
  { format = "separator" }: BundleOptions = {},
): Promise<string> {
  if (paths.length === 0) return "";

  const parts = await Promise.all(
    paths.map(async (p) => {
      const rel = relativeName(p, rootPath);
      // safety: re-validate each path (selectedPaths is persisted, may be stale or tampered)
      const check = await validateMarkdownFile(p);
      if (!check.ok) {
        console.warn("marka.md: bundle skipped non-markdown path", p, "·", check.reason);
        return `=== ${rel} (skipped: ${check.reason}) ===`;
      }
      try {
        const content = await readMarkdown(p);
        if (format === "xml") {
          return `<file path="${rel}">\n${content}\n</file>`;
        }
        return `=== ${rel} ===\n${content}`;
      } catch (err) {
        console.error("marka.md: bundle read failed", p, err);
        return `=== ${rel} (error: could not read) ===`;
      }
    }),
  );

  return parts.join("\n\n");
}

/** Rough token estimate (~1 token per 4 chars). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Format a token count for compact display: 938, 1.2k, 23k. */
export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}
