import { useCallback, useEffect, useMemo, useState } from "react";
import {
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

  const handleToggleSidebarFromCommands = useCallback(() => {
    setSidebarOpen((v) => !v);
  }, [setSidebarOpen]);

  const exportToPdf = useCallback(() => {
    // macOS print dialog has "Save as PDF" built in;
    // print stylesheet hides chrome and shows only .mdv-prose
    document.body.classList.add("mdv-print");
    window.print();
    window.setTimeout(() => document.body.classList.remove("mdv-print"), 600);
  }, []);

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

  // tiny "just copied!" pulse for the breadcrumb copy button
  const [copyPulse, setCopyPulse] = useState(false);
  const copyMarkdown = useCallback(async () => {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopyPulse(true);
      window.setTimeout(() => setCopyPulse(false), 1200);
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
