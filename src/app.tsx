import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AboutOverlay,
  Breadcrumb,
  CommandPalette,
  DropOverlay,
  Editor,
  HelpOverlay,
  Preview,
  Sidebar,
  Splitter,
  StatusBar,
  TitleBar,
  Toast,
  WelcomeOverlay,
  type SaveStatus,
} from "@/components/features";
import { TooltipRoot } from "@/components/primitives";
import { useDebouncedValue, usePersistedState, useShortcuts, useSyncScroll } from "@/hooks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { tempDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  basename,
  buildCommands,
  estimateTokens,
  isMarkdownPath,
  pickFolder,
  pickMarkdownFile,
  readMarkdown,
  validateMarkdownFile,
  writeMarkdown,
  STORAGE_KEYS,
} from "@/lib";
import { DEMO_MARKDOWN } from "@/lib/demo";
import "./app.css";

const SAVED_FLASH_MS = 1200;

export function App() {
  const [source, setSource] = useState<string>(DEMO_MARKDOWN);
  const [savedContent, setSavedContent] = useState<string>(DEMO_MARKDOWN);
  const [activePath, setActivePath] = usePersistedState<string | null>(
    STORAGE_KEYS.lastFile,
    null,
  );
  const [rootPath, setRootPath] = usePersistedState<string | null>(
    STORAGE_KEYS.lastFolder,
    null,
  );
  const [sidebarOpen, setSidebarOpen] = usePersistedState<boolean>(
    STORAGE_KEYS.sidebarOpen,
    false,
  );
  const [sidebarWidth, setSidebarWidth] = usePersistedState<number>(
    STORAGE_KEYS.sidebarWidth,
    240,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [welcomed, setWelcomed] = usePersistedState<boolean>(STORAGE_KEYS.welcomed, false);
  const [welcomeOpen, setWelcomeOpen] = useState(!welcomed);
  const [dragActive, setDragActive] = useState(false);
  const [loadError, setLoadError] = useState<{ message: string; path?: string } | null>(null);

  const dismissWelcome = useCallback(() => {
    setWelcomeOpen(false);
    setWelcomed(true);
  }, [setWelcomed]);

  const showWelcome = useCallback(() => {
    setWelcomeOpen(true);
  }, []);

  const showHelp = useCallback(() => {
    setHelpOpen(true);
  }, []);

  const showAbout = useCallback(() => {
    setAboutOpen(true);
  }, []);

  const handleToggleSidebarFromCommands = useCallback(() => {
    setSidebarOpen((v) => !v);
  }, [setSidebarOpen]);

  const exportToPdf = useCallback(async () => {
    // workaround: Tauri 2's WKWebView no-ops window.print(). instead, clone
    // the already-rendered preview article (which has mermaid svgs, katex
    // html, and shiki spans already painted), wrap in a standalone html
    // doc with print-friendly styles, write to OS temp dir, open in the
    // user's default browser. the browser auto-triggers its print dialog
    // on load — user picks "Save as PDF" → real native flow.
    if (!source.trim()) {
      setLoadError({
        message: "nothing to export. open or write some markdown first.",
      });
      return;
    }

    const article = document.querySelector<HTMLElement>(".mdv-prose");
    if (!article) {
      setLoadError({
        message: "preview isn't rendered yet. try again in a moment.",
      });
      return;
    }

    const fileName = activePath ? basename(activePath) : undefined;
    const title = fileName ?? "marka.md export";
    const escapeHtml = (s: string): string =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // self-contained print stylesheet — light theme regardless of app theme.
    // tracks the live prose CSS conceptually but stays decoupled so the
    // exported pdf has a stable "document" look.
    const printStyles = `
      *, *::before, *::after { box-sizing: border-box; }
      :root {
        --pfg: #1d1d1f;
        --pmuted: #6e6e73;
        --paccent: #e2722e;
        --pborder: rgba(0, 0, 0, 0.08);
      }
      html, body {
        background: #fff;
        color: var(--pfg);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
        font-size: 15px;
        line-height: 1.65;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
        /* preserve colors when saving to pdf (e.g. shiki code-block backgrounds) */
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .doc { max-width: 720px; margin: 0 auto; padding: 18mm 16mm 22mm; }
      h1, h2, h3, h4 {
        font-weight: 600;
        letter-spacing: -0.018em;
        /* keep headings on the same page as the first paragraph that follows */
        break-after: avoid;
        page-break-after: avoid;
      }
      h1 { font-size: 2.1em; margin: 0 0 0.5em; }
      h2 { font-size: 1.55em; margin: 2em 0 0.5em; }
      h3 { font-size: 1.25em; margin: 1.6em 0 0.5em; }
      h4 { font-size: 1em; margin: 1.4em 0 0.4em; }
      p, ul, ol, blockquote, pre, table { margin: 0 0 1em; }
      p { orphans: 3; widows: 3; }
      a {
        color: var(--paccent);
        text-decoration: none;
        border-bottom: 1px solid color-mix(in srgb, var(--paccent) 30%, transparent);
      }
      code {
        font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
        font-size: 0.88em;
        background: rgba(0, 0, 0, 0.045);
        padding: 1px 6px;
        border-radius: 4px;
      }
      pre {
        font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
        font-size: 12.5px;
        line-height: 1.55;
        background: #fafafa;
        border: 1px solid var(--pborder);
        border-radius: 8px;
        padding: 14px 16px;
        overflow-x: auto;
        /* don't split code blocks across pages — looks bad and breaks tokens */
        break-inside: avoid;
        page-break-inside: avoid;
      }
      blockquote, table, .mdv-mermaid {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      img { max-width: 100%; height: auto; border-radius: 6px; break-inside: avoid; }
      pre code { background: transparent; padding: 0; font-size: inherit; border-radius: 0; }
      pre.shiki, pre.shiki * { font-family: inherit; }
      blockquote {
        border-left: 3px solid var(--paccent);
        padding-left: 16px;
        color: var(--pmuted);
        font-style: italic;
      }
      hr { border: none; border-top: 1px solid var(--pborder); margin: 2em 0; }
      ul, ol { padding-left: 24px; }
      li { margin: 0.25em 0; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid var(--pborder); padding: 8px 12px; text-align: left; vertical-align: top; }
      th { background: rgba(0, 0, 0, 0.03); font-weight: 600; }
      /* mermaid renders as inline SVG inside <pre class="mdv-mermaid"> */
      .mdv-mermaid { background: transparent; border: 0; padding: 0; text-align: center; }
      .mdv-mermaid svg { max-width: 100%; height: auto; }
      /* hide in-app affordances that don't belong in print */
      .mdv-copy, .mdv-codeblock > .mdv-copy { display: none !important; }
      /* margin: 0 on @page leaves no room for the browser's auto header /
         footer (title, date, url, page numbers). all visible whitespace is
         pushed into .doc padding instead so it still looks like a margined
         document. users can also uncheck "Headers and footers" in the print
         dialog's "More settings" if their browser still tries to render them. */
      @page { margin: 0; size: auto; }
      @media print {
        body { padding: 0; }
        .doc { padding: 18mm 16mm 22mm; }
      }
    `;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${printStyles}</style>
</head>
<body>
  <main class="doc">
    ${article.outerHTML}
  </main>
  <script>
    // auto-trigger the print dialog once layout settles
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 350);
    });
  </script>
</body>
</html>`;

    try {
      const dir = (await tempDir()).replace(/[\\/]+$/, "");
      const safeName = (fileName ?? "export")
        .replace(/\.md$/i, "")
        .replace(/[^\w.-]+/g, "-")
        .slice(0, 60) || "export";
      // stable name → overwrites on each export instead of piling up in /tmp
      const tempPath = `${dir}/marka-${safeName}.html`;
      await writeMarkdown(tempPath, html);
      await openPath(tempPath);
    } catch (err) {
      console.error("marka.md: pdf export failed", err);
      setLoadError({ message: `pdf export failed: ${err}` });
    }
  }, [source, activePath]);

  const toggleFullscreen = useCallback(async () => {
    const win = getCurrentWindow();
    try {
      const isFs = await win.isFullscreen();
      await win.setFullscreen(!isFs);
    } catch (err) {
      console.error("marka.md: fullscreen toggle failed", err);
    }
  }, []);

  const [recentFiles, setRecentFiles] = usePersistedState<string[]>(
    STORAGE_KEYS.recentFiles,
    [],
  );

  const [readingMode, setReadingMode] = useState(false);
  const toggleReadingMode = useCallback(() => setReadingMode((v) => !v), []);
  const exitReadingMode = useCallback(() => setReadingMode(false), []);

  // tiny "just copied!" pulse for the breadcrumb copy button + ambient toast
  const [copyPulse, setCopyPulse] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const copyMarkdown = useCallback(async () => {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopyPulse(true);
      setCopyToast(true);
      window.setTimeout(() => setCopyPulse(false), 1200);
      window.setTimeout(() => setCopyToast(false), 1600);
    } catch (err) {
      console.error("marka.md: copy failed", err);
    }
  }, [source]);

  const debouncedPreview = useDebouncedValue(source, 50);

  // proportional editor <-> preview scroll sync; rebinds when active file changes
  useSyncScroll({ rebindKey: activePath ?? "untitled" });

  const { words, minutes, docTokens } = useMemo(() => {
    const trimmed = source.trim();
    const w = trimmed.length ? trimmed.split(/\s+/).length : 0;
    const m = Math.max(1, Math.round(w / 220));
    const t = estimateTokens(source);
    return { words: w, minutes: m, docTokens: t };
  }, [source]);

  const dirty = activePath != null && source !== savedContent;

  const loadFile = useCallback(
    async (path: string) => {
      setLoadError(null);
      const check = await validateMarkdownFile(path);
      if (!check.ok) {
        setLoadError({ message: check.reason, path });
        console.warn("marka.md: refused to open", path, "·", check.reason);
        return;
      }
      try {
        const content = await readMarkdown(path);
        setSource(content);
        setSavedContent(content);
        setActivePath(path);
        setSaveStatus("idle");
        // bump the file to the top of the recent list (dedupe, cap 8)
        setRecentFiles((prev) => [path, ...prev.filter((p) => p !== path)].slice(0, 8));
      } catch (err) {
        console.error("marka.md: readMarkdown failed", err);
        setLoadError({ message: String(err), path });
      }
    },
    [setActivePath],
  );

  const saveNow = useCallback(
    async (path: string, content: string) => {
      setSaveStatus("saving");
      try {
        await writeMarkdown(path, content);
        setSavedContent(content);
        setSaveStatus("saved");
        window.setTimeout(() => {
          setSaveStatus((s: SaveStatus) => (s === "saved" ? "idle" : s));
        }, SAVED_FLASH_MS);
      } catch (err) {
        console.error("marka.md: writeMarkdown failed", err);
        setSaveStatus("dirty");
      }
    },
    [],
  );

  // mark dirty as soon as content diverges from disk
  useEffect(() => {
    if (!activePath) {
      setSaveStatus("idle");
      return;
    }
    if (source !== savedContent) {
      setSaveStatus((s: SaveStatus) => (s === "saving" ? s : "dirty"));
    }
  }, [source, savedContent, activePath]);

  const handleOpenFolder = useCallback(async () => {
    const folder = await pickFolder();
    if (folder) {
      setRootPath(folder);
      setSidebarOpen(true);
    }
  }, [setRootPath, setSidebarOpen]);

  const handleOpenFile = useCallback(async () => {
    const file = await pickMarkdownFile();
    if (file) {
      void loadFile(file);
    }
  }, [loadFile]);

  const handleNewFile = useCallback(() => {
    setSource("");
    setSavedContent("");
    setActivePath(null);
    setSaveStatus("idle");
  }, [setActivePath]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [setSidebarOpen, sidebarOpen]);

  // OS "Open With → marka.md" from Finder — Rust emits marka:open-file
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<string>("marka:open-file", (event) => {
      const path = event.payload;
      if (typeof path === "string" && path.length > 0) {
        void loadFile(path);
      }
    }).then((un) => {
      unlisten = un;
    });
    return () => {
      unlisten?.();
    };
  }, [loadFile]);

  // drag-and-drop a .md onto the window — also drives the drop overlay
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void win.onDragDropEvent((event) => {
      const type = event.payload.type;
      if (type === "enter" || type === "over") {
        setDragActive(true);
      } else if (type === "leave") {
        setDragActive(false);
      } else if (type === "drop") {
        setDragActive(false);
        const paths = event.payload.paths ?? [];
        const firstMd = paths.find(isMarkdownPath);
        if (firstMd) {
          void loadFile(firstMd);
        } else if (paths.length > 0) {
          setLoadError({
            message: "only .md / .markdown / .mdx files can be opened in marka.md",
            path: paths[0],
          });
        }
      }
    }).then((un) => {
      unlisten = un;
    });
    return () => {
      unlisten?.();
    };
  }, [loadFile]);

  const shortcuts = useMemo(
    () => ({
      "mod+k": (e: KeyboardEvent) => {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      },
      "mod+/": (e: KeyboardEvent) => {
        e.preventDefault();
        setHelpOpen((v) => !v);
      },
      "mod+b": (e: KeyboardEvent) => {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      },
      "mod+s": (e: KeyboardEvent) => {
        e.preventDefault();
        if (activePath && source !== savedContent) {
          void saveNow(activePath, source);
        }
      },
      "mod+n": (e: KeyboardEvent) => {
        e.preventDefault();
        handleNewFile();
      },
      "mod+o": (e: KeyboardEvent) => {
        e.preventDefault();
        void handleOpenFile();
      },
      "mod+shift+o": (e: KeyboardEvent) => {
        e.preventDefault();
        void handleOpenFolder();
      },
      "mod+shift+c": (e: KeyboardEvent) => {
        e.preventDefault();
        void copyMarkdown();
      },
      "mod+p": (e: KeyboardEvent) => {
        e.preventDefault();
        exportToPdf();
      },
      "mod+ctrl+f": (e: KeyboardEvent) => {
        e.preventDefault();
        void toggleFullscreen();
      },
      "mod+.": (e: KeyboardEvent) => {
        e.preventDefault();
        toggleReadingMode();
      },
      escape: (e: KeyboardEvent) => {
        if (readingMode) {
          e.preventDefault();
          exitReadingMode();
        }
      },
    }),
    [
      sidebarOpen,
      activePath,
      source,
      savedContent,
      saveNow,
      handleOpenFile,
      handleOpenFolder,
      handleNewFile,
      handleToggleSidebarFromCommands,
      showHelp,
      showWelcome,
      copyMarkdown,
      exportToPdf,
      toggleFullscreen,
      loadFile,
      recentFiles,
      readingMode,
      toggleReadingMode,
      exitReadingMode,
    ],
  );
  useShortcuts(shortcuts);

  const commands = useMemo(
    () =>
      buildCommands({
        newFile: handleNewFile,
        openFile: handleOpenFile,
        openFolder: handleOpenFolder,
        save: () => {
          if (activePath && source !== savedContent) {
            void saveNow(activePath, source);
          }
        },
        toggleSidebar: handleToggleSidebarFromCommands,
        toggleReading: toggleReadingMode,
        showHelp,
        showWelcome,
        showAbout,
        copyMarkdown,
        exportToPdf,
        toggleFullscreen,
        openRecent: (path: string) => void loadFile(path),
        recentFiles,
        hasActivePath: activePath != null,
        sidebarOpen,
        readingMode,
      }),
    [
      handleNewFile,
      handleOpenFile,
      handleOpenFolder,
      activePath,
      source,
      savedContent,
      saveNow,
      sidebarOpen,
      setSidebarOpen,
      copyMarkdown,
      showHelp,
      showWelcome,
      showAbout,
      exportToPdf,
      toggleFullscreen,
      handleToggleSidebarFromCommands,
      loadFile,
      recentFiles,
    ],
  );

  const displayName = activePath ? basename(activePath) : undefined;

  return (
    <div
      className={`mdv-app${sidebarOpen ? " has-sidebar" : ""}${readingMode ? " is-reading" : ""}`}
    >
      <TitleBar
        fileName={displayName}
        dirty={dirty}
        readingMode={readingMode}
        onToggleReading={toggleReadingMode}
        onCopyMarkdown={activePath || source ? () => void copyMarkdown() : undefined}
        copyPulse={copyPulse}
        onExportPdf={exportToPdf}
      />

      <Breadcrumb
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        rootPath={rootPath}
        activePath={activePath}
        saveStatus={saveStatus}
        onNewFile={handleNewFile}
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenFolder}
        onCopyMarkdown={activePath || source ? () => void copyMarkdown() : undefined}
        copyPulse={copyPulse}
      />

      <main className="mdv-shell">
        {readingMode ? (
          <Preview source={debouncedPreview} />
        ) : (
          <>
            <Sidebar
              open={sidebarOpen}
              rootPath={rootPath}
              activePath={activePath}
              width={sidebarWidth}
              onWidthChange={setSidebarWidth}
              onOpenFolder={handleOpenFolder}
              onSelectFile={(path) => void loadFile(path)}
            />
            <Splitter
              left={<Editor value={source} onChange={setSource} />}
              right={<Preview source={debouncedPreview} />}
            />
          </>
        )}
      </main>

      <Toast
        open={loadError != null}
        message={loadError?.message ?? ""}
        onDismiss={() => setLoadError(null)}
        action={
          loadError?.path
            ? {
                label: "open in default app",
                onClick: async () => {
                  if (loadError.path) {
                    try {
                      await openPath(loadError.path);
                    } catch (err) {
                      console.error("marka.md: openPath failed", err);
                    }
                  }
                },
              }
            : undefined
        }
      />

      <Toast
        open={copyToast && loadError == null}
        message="copied to clipboard · paste into claude"
        variant="info"
        onDismiss={() => setCopyToast(false)}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      <HelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onReplayTutorial={showWelcome}
      />

      <AboutOverlay open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <WelcomeOverlay
        open={welcomeOpen}
        onClose={dismissWelcome}
        onOpenFolder={handleOpenFolder}
      />

      <DropOverlay active={dragActive} />
      <TooltipRoot />

      <StatusBar
        fileName={displayName}
        words={words}
        minutes={minutes}
        docTokens={docTokens}
        onShowHelp={() => setHelpOpen(true)}
      />
    </div>
  );
}
