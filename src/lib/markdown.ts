import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import { createHighlighter, type Highlighter } from "shiki";
import type { Theme } from "./theme";

// random suffix per render — mermaid id reuse across re-renders silently fails.
function mermaidId(): string {
  return `mdv-mermaid-${Math.random().toString(36).slice(2, 10)}`;
}

// allowed langs — shiki chunks load on first use via ensureLangsLoaded.
const LANGS = [
  "markdown", "ts", "tsx", "js", "jsx", "json", "rust", "bash", "css", "html", "python", "go",
  "c", "cpp", "csharp", "objective-c",
  "java", "kotlin", "scala", "groovy",
  "swift",
  "ruby", "php", "lua", "perl", "r", "elixir", "haskell",
  "sql", "yaml", "toml", "xml", "ini",
  "shellscript", "powershell", "dockerfile", "makefile", "nginx",
  "diff", "git-commit",
  "graphql", "protobuf", "regex", "vim", "jsonc",
] as const;

const THEMES = {
  latte: "catppuccin-latte",
  frappe: "catppuccin-frappe",
  macchiato: "catppuccin-macchiato",
  mocha: "catppuccin-mocha",
  matcha: "vitesse-light",
  kanagawa: "kanagawa-wave",
  "rose-pine": "rose-pine",
  ayu: "ayu-dark",
} as const;

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();
const loadedThemes = new Set<string>();
// read synchronously inside md.highlight; updated before md.render in renderMarkdown.
let activeShikiTheme: string = THEMES.latte;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes: [], langs: [] })
      .then((h) => {
        highlighter = h;
        return h;
      })
      .catch((err) => {
        console.error("marka.md: shiki highlighter init failed", err);
        highlighterPromise = null;
        throw err;
      });
  }
  return highlighterPromise;
}

const FENCE_RE = /^[ \t]*```([a-zA-Z0-9_+\-]+)/gm;
function extractLangs(src: string): string[] {
  const found = new Set<string>();
  FENCE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(src)) !== null) {
    const lang = m[1];
    if ((LANGS as readonly string[]).includes(lang)) found.add(lang);
  }
  return [...found];
}

async function ensureThemeLoaded(h: Highlighter, shikiTheme: string): Promise<void> {
  if (loadedThemes.has(shikiTheme)) return;
  await h.loadTheme(shikiTheme as Parameters<Highlighter["loadTheme"]>[0]);
  loadedThemes.add(shikiTheme);
}

async function ensureLangsLoaded(h: Highlighter, langs: string[]): Promise<void> {
  const toLoad = langs.filter((l) => !loadedLangs.has(l));
  if (toLoad.length === 0) return;
  await Promise.all(
    toLoad.map((l) => h.loadLanguage(l as Parameters<Highlighter["loadLanguage"]>[0])),
  );
  toLoad.forEach((l) => loadedLangs.add(l));
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight: (code, lang) => {
    // mermaid blocks bypass shiki — Preview component renders them as svg
    if (lang === "mermaid") {
      const id = mermaidId();
      const encoded = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre class="mdv-mermaid" id="${id}"><code>${encoded}</code></pre>`;
    }
    if (!highlighter) return "";
    const loaded = highlighter.getLoadedLanguages() as readonly string[];
    const language = loaded.includes(lang) ? lang : "text";
    try {
      return highlighter.codeToHtml(code, {
        lang: language,
        theme: activeShikiTheme,
      });
    } catch {
      return "";
    }
  },
});

md.use(taskLists, { enabled: false, label: true });

export async function ensureMarkdownReady(): Promise<void> {
  await getHighlighter();
}

export async function renderMarkdown(src: string, theme: Theme): Promise<string> {
  const h = await getHighlighter();
  const shikiTheme = THEMES[theme];
  await ensureThemeLoaded(h, shikiTheme);
  await ensureLangsLoaded(h, extractLangs(src));
  activeShikiTheme = shikiTheme;
  return md.render(src);
}
