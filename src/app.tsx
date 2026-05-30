import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Breadcrumb, StatusBar, TitleBar, type VimMode } from "@/components/chrome";
import {
  Editor,
  MarkdownInspector,
  MarkdownToolbar,
  Preview,
  ReadingFind,
  Splitter,
  type EditorHandle,
} from "@/components/editor";
import { ContextMenu, Sidebar, type ContextMenuItem } from "@/components/files";
import {
  AboutOverlay,
  AiReviewOverlay,
  CommandPalette,
  DropOverlay,
  HelpOverlay,
  SettingsOverlay,
  SnapshotsOverlay,
  Toast,
  WelcomeOverlay,
} from "@/components/overlays";
import { TooltipRoot } from "@/components/primitives";
import {
  useContextMenu,
  useDebouncedValue,
  useFileOps,
  useFileSession,
  useNotifications,
  useOverlays,
  usePersistedState,
  useShortcuts,
  useSyncScroll,
  useUpdateFlow,
} from "@/hooks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import {
  basename,
  buildCommands,
  CHANGELOG_URL,
  dirname,
  estimateTokens,
  exportPreviewToPdf,
  getWhatsNewToastMessage,
  isMarkdownPath,
  PdfExportError,
  pickFolder,
  pickMarkdownFile,
  removeEntry,
  STORAGE_KEYS,
  DEFAULT_PROOFREAD_PROMPT,
  DEFAULT_PROMPTIFY_PROMPT,
  DEFAULT_TRANSLATE_PROMPT,
  applyMarkdownAction,
  createSnapshot,
  deleteSnapshot,
  extractHeadings,
  insertTemplate,
  listSnapshots,
  lintMarkdown,
  proofreadMarkdown,
  promptifyMarkdown,
  type MarkdownAction,
  type Snapshot,
  type TextRange,
} from "@/lib";
import { UPDATES_ENABLED } from "@/lib/updater";
import { translateMarkdown, LANGUAGES } from "@/lib";
import { applyDockMode, collapseDock, expandDock, type DockMode } from "@/lib/dock";
import { sourceHasSecrets } from "@/lib/secret-mask";
import { CheckCheck, ChevronLeft, ChevronRight, Clipboard, Copy, Languages, MousePointer2, Scissors, TextCursorInput, WandSparkles } from "lucide-react";
import { Icon } from "@/components/primitives";
import "./app.css";

export function App() {
  const {
    loadError,
    setLoadError,
    dismissLoadError,
    copyPulse,
    copyToast,
    dismissCopyToast,
    saveAsToast,
    dismissSaveAsToast,
    showSaveAsToast,
    copyMarkdown: copyMarkdownCore,
  } = useNotifications();

  const {
    source,
    setSource,
    activePath,
    setActivePath,
    rootPath,
    setRootPath,
    saveStatus,
    recentFiles,
    externalReloadToast,
    dismissExternalReload,
    externalConflict,
    setExternalConflict,
    loadFile,
    loadDemo,
    saveNow,
    saveAs: saveAsCore,
    startNewBuffer,
    dirty,
  } = useFileSession({ onLoadError: setLoadError });

  const [sidebarOpen, setSidebarOpen] = usePersistedState<boolean>(
    STORAGE_KEYS.sidebarOpen,
    false,
  );
  const [sidebarWidth, setSidebarWidth] = usePersistedState<number>(
    STORAGE_KEYS.sidebarWidth,
    240,
  );
  const {
    treeVersion,
    bumpTree,
    editingPath,
    setEditingPath,
    newEntry,
    setNewEntry,
    handleMove,
    handleSubmitRename,
    handleSubmitNew,
    handleUndoFileOp,
  } = useFileOps({
    activePath,
    setActivePath,
    loadFile,
    startNewBuffer,
    onError: setLoadError,
  });

  const {
    paletteOpen,
    setPaletteOpen,
    helpOpen,
    setHelpOpen,
    aboutOpen,
    setAboutOpen,
    welcomeOpen,
    dismissWelcome,
    showWelcome,
    showHelp,
    showAbout,
  } = useOverlays();

  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

  const {
    updateAvail,
    setUpdateAvail,
    updateInstalling,
    updateUpToDate,
    setUpdateUpToDate,
    handleApplyUpdate,
    handleManualUpdateCheck,
  } = useUpdateFlow({ onError: setLoadError });

  const [vimOn, setVimOn] = usePersistedState<boolean>(STORAGE_KEYS.vimMode, false);
  const [vimMode, setVimMode] = useState<VimMode | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openrouterKey, setOpenrouterKey] = usePersistedState<string>(
    STORAGE_KEYS.openrouterKey,
    "",
  );
  const [openrouterModel, setOpenrouterModel] = usePersistedState<string>(
    STORAGE_KEYS.openrouterModel,
    "",
  );
  const [translateTargetLang, setTranslateTargetLang] = usePersistedState<string>(
    STORAGE_KEYS.translateTargetLang,
    LANGUAGES[0]?.code ?? "en",
  );
  const [proofreadPrompt, setProofreadPrompt] = usePersistedState<string>(
    STORAGE_KEYS.proofreadPrompt,
    DEFAULT_PROOFREAD_PROMPT,
  );
  const [promptifyPrompt, setPromptifyPrompt] = usePersistedState<string>(
    STORAGE_KEYS.promptifyPrompt,
    DEFAULT_PROMPTIFY_PROMPT,
  );
  const [translatePrompt, setTranslatePrompt] = usePersistedState<string>(
    STORAGE_KEYS.translatePrompt,
    DEFAULT_TRANSLATE_PROMPT,
  );
  const [translatedSource, setTranslatedSource] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [promptifying, setPromptifying] = useState(false);
  const editorRef = useRef<EditorHandle | null>(null);
  const [selectionRange, setSelectionRange] = useState<TextRange>({ from: 0, to: 0 });
  const [aiSelectionScope, setAiSelectionScope] = useState(false);
  const [editorContextMenu, setEditorContextMenu] = useState<{
    x: number;
    y: number;
    range: TextRange;
    hasSelection: boolean;
  } | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => listSnapshots());
  const [aiReview, setAiReview] = useState<{
    title: string;
    original: string;
    next: string;
    range: TextRange;
  } | null>(null);
  const [secretsHidden, setSecretsHidden] = usePersistedState<boolean>(
    STORAGE_KEYS.secretsHidden,
    true,
  );
  const [editorTextColor, setEditorTextColor] = usePersistedState<string>(
    STORAGE_KEYS.editorTextColor,
    "#2563eb",
  );
  const [editorHighlightColor, setEditorHighlightColor] = usePersistedState<string>(
    STORAGE_KEYS.editorHighlightColor,
    "#fde047",
  );
  const [secretHiddenColor, setSecretHiddenColor] = usePersistedState<string>(
    STORAGE_KEYS.secretHiddenColor,
    "#7c3aed",
  );
  const [secretHiddenBg, setSecretHiddenBg] = usePersistedState<string>(
    STORAGE_KEYS.secretHiddenBg,
    "#ede9fe",
  );
  const [secretRevealedColor, setSecretRevealedColor] = usePersistedState<string>(
    STORAGE_KEYS.secretRevealedColor,
    "#b91c1c",
  );
  const [secretRevealedBg, setSecretRevealedBg] = usePersistedState<string>(
    STORAGE_KEYS.secretRevealedBg,
    "#fee2e2",
  );
  const toggleSecrets = useCallback(() => setSecretsHidden((v: boolean) => !v), [setSecretsHidden]);
  const [dockMode, setDockMode] = usePersistedState<DockMode>(STORAGE_KEYS.dockMode, "off");
  const [dockOpen, setDockOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // apply dock mode on mount + whenever the setting changes
  useEffect(() => {
    void applyDockMode(dockMode, { open: dockOpen && dockMode !== "off" });
    if (dockMode === "off") setDockOpen(false);
  }, [dockMode]);

  // intercept window close → when docked, collapse to the dock tab instead of quitting
  useEffect(() => {
    if (dockMode === "off") return;
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void win.onCloseRequested((event) => {
      event.preventDefault();
      void collapseDock(dockMode as Exclude<DockMode, "off">).then(() => setDockOpen(false));
    }).then((un) => {
      unlisten = un;
    });
    return () => { unlisten?.(); };
  }, [dockMode]);

  // auto-collapse on focus loss
  useEffect(() => {
    if (dockMode === "off") return;
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void win.onFocusChanged(({ payload: focused }) => {
      if (!focused && dockOpen) {
        void collapseDock(dockMode as Exclude<DockMode, "off">).then(() => setDockOpen(false));
      }
    }).then((un) => {
      unlisten = un;
    });
    return () => { unlisten?.(); };
  }, [dockMode, dockOpen]);

  const handleDockTabClick = useCallback(() => {
    if (dockMode === "off") return;
    void expandDock(dockMode as Exclude<DockMode, "off">).then(() => setDockOpen(true));
  }, [dockMode]);

  const [whatsNewVersion, setWhatsNewVersion] = useState<string | null>(null);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((v: boolean) => !v);
  }, [setSidebarOpen]);

  const exportToPdf = useCallback(async () => {
    try {
      await exportPreviewToPdf({ source, activePath });
    } catch (err) {
      const message = err instanceof PdfExportError
        ? err.message
        : "couldn't export to pdf";
      console.error("marknote: pdf export failed", err);
      setLoadError({ message });
    }
  }, [source, activePath]);


  const toggleFullscreen = useCallback(async () => {
    const win = getCurrentWindow();
    try {
      const isFs = await win.isFullscreen();
      await win.setFullscreen(!isFs);
    } catch (err) {
      console.error("marknote: fullscreen toggle failed", err);
    }
  }, []);

  const [readingMode, setReadingMode] = useState(false);
  const [editorOnly, setEditorOnly] = useState(true);
  const [previewOnly, setPreviewOnly] = useState(false);
  // reading + editor-only + preview-only are mutually exclusive view modes
  const toggleReadingMode = useCallback(() => {
    setReadingMode((v) => {
      const next = !v;
      if (next) {
        setEditorOnly(false);
        setPreviewOnly(false);
      }
      return next;
    });
  }, []);
  const exitReadingMode = useCallback(() => setReadingMode(false), []);
  const toggleEditorOnly = useCallback(() => {
    setEditorOnly((v) => {
      const next = !v;
      if (next) {
        setReadingMode(false);
        setPreviewOnly(false);
      }
      return next;
    });
  }, []);
  // breadcrumb pane toggles — symmetric show/hide for the two split-view panes
  const editorVisible = !previewOnly;
  const previewVisible = !editorOnly;
  const handleToggleEditor = useCallback(() => {
    // hiding the editor === previewOnly mode; showing it === clear previewOnly
    setPreviewOnly((v) => {
      const next = !v;
      if (next) {
        setEditorOnly(false);
        setReadingMode(false);
      }
      return next;
    });
  }, []);
  const handleTogglePreview = useCallback(() => {
    // hiding preview === editorOnly mode
    toggleEditorOnly();
  }, [toggleEditorOnly]);

  // ⌘F only bound while reading — CM owns it in editor mode.
  const [findOpen, setFindOpen] = useState(false);
  const [proseEl, setProseEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!readingMode) {
      setProseEl(null);
      setFindOpen(false);
      return;
    }
    // wait one frame for Preview to render its <article class="mdv-prose">
    const id = window.requestAnimationFrame(() => {
      setProseEl(document.querySelector<HTMLElement>(".mdv-prose"));
    });
    return () => window.cancelAnimationFrame(id);
  }, [readingMode]);

  const copyMarkdown = useCallback(() => copyMarkdownCore(source), [copyMarkdownCore, source]);

  const debouncedPreview = useDebouncedValue(source, 50);

  useEffect(() => {
    let cancelled = false;
    void getVersion()
      .then((version) => {
        if (cancelled) return;
        const lastSeen = window.localStorage.getItem(STORAGE_KEYS.lastSeenVersion);
        if (lastSeen && lastSeen !== version) {
          setWhatsNewVersion(version);
        }
        window.localStorage.setItem(STORAGE_KEYS.lastSeenVersion, version);
      })
      .catch((err) => console.warn("marknote: version check failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // proportional editor <-> preview scroll sync; rebinds when active file changes
  useSyncScroll({ rebindKey: activePath ?? "untitled" });

  const { words, minutes, docTokens } = useMemo(() => {
    const trimmed = source.trim();
    const w = trimmed.length ? trimmed.split(/\s+/).length : 0;
    const m = Math.max(1, Math.round(w / 220));
    const t = estimateTokens(source);
    return { words: w, minutes: m, docTokens: t };
  }, [source]);

  const headings = useMemo(() => extractHeadings(source), [source]);
  const markdownIssues = useMemo(() => lintMarkdown(source), [source]);
  const hasTextSelection = selectionRange.from !== selectionRange.to;
  const selectionCharCount = hasTextSelection ? Math.abs(selectionRange.to - selectionRange.from) : 0;

  const handleEditorSelectionChange = useCallback((range: TextRange) => {
    setSelectionRange((prev) => (
      prev.from === range.from && prev.to === range.to ? prev : range
    ));
    setAiSelectionScope(range.from !== range.to);
  }, []);

  const handleMarkdownAction = useCallback((action: MarkdownAction) => {
    const selection = editorRef.current?.getSelection() ?? { from: source.length, to: source.length };
    const edit = applyMarkdownAction(source, selection, action, {
      textColor: editorTextColor,
      highlightColor: editorHighlightColor,
    });
    setTranslatedSource(null);
    editorRef.current?.replaceRange(edit.range, edit.insert, edit.selection);
  }, [editorHighlightColor, editorTextColor, source]);

  const appStyle = useMemo(() => ({
    "--mdv-user-text-color": editorTextColor,
    "--mdv-user-highlight-color": editorHighlightColor,
    "--mdv-secret-hidden-color": secretHiddenColor,
    "--mdv-secret-hidden-bg": secretHiddenBg,
    "--mdv-secret-revealed-color": secretRevealedColor,
    "--mdv-secret-revealed-bg": secretRevealedBg,
  }) as CSSProperties, [
    editorTextColor,
    editorHighlightColor,
    secretHiddenColor,
    secretHiddenBg,
    secretRevealedColor,
    secretRevealedBg,
  ]);

  const handleInsertTemplate = useCallback((kind: "note" | "readme" | "prompt") => {
    const selection = editorRef.current?.getSelection() ?? { from: source.length, to: source.length };
    const edit = insertTemplate(source, selection, kind);
    setTranslatedSource(null);
    editorRef.current?.replaceRange(edit.range, edit.insert, edit.selection);
  }, [source]);

  const handleUndoEdit = useCallback(() => {
    setTranslatedSource(null);
    editorRef.current?.undo();
  }, []);

  const handleRedoEdit = useCallback(() => {
    setTranslatedSource(null);
    editorRef.current?.redo();
  }, []);

  const refreshSnapshots = useCallback(() => setSnapshots(listSnapshots()), []);

  const handleCreateSnapshot = useCallback((label = "manual snapshot") => {
    createSnapshot(source, activePath, label);
    refreshSnapshots();
  }, [source, activePath, refreshSnapshots]);

  const handleRestoreSnapshot = useCallback((snapshot: Snapshot) => {
    createSnapshot(source, activePath, "before restore");
    setSource(snapshot.source);
    setSnapshotsOpen(false);
    refreshSnapshots();
    window.requestAnimationFrame(() => editorRef.current?.goTo(0));
  }, [source, activePath, setSource, refreshSnapshots]);

  const handleDeleteSnapshot = useCallback((id: string) => {
    deleteSnapshot(id);
    refreshSnapshots();
  }, [refreshSnapshots]);

  const aiTargetRange = useCallback((): TextRange => {
    if (hasTextSelection && aiSelectionScope) return selectionRange;
    return { from: 0, to: source.length };
  }, [aiSelectionScope, hasTextSelection, selectionRange, source.length]);

  // wraps useFileSession's saveAs to bump the sidebar tree + show landing toast.
  const saveAs = useCallback(async () => {
    const target = await saveAsCore();
    if (!target) return;
    bumpTree();
    showSaveAsToast(`saved to ${basename(target)}`);
  }, [saveAsCore, bumpTree, showSaveAsToast]);

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
    startNewBuffer();
  }, [startNewBuffer]);

  // revert when source / active file changes so we never show stale translation
  useEffect(() => {
    setTranslatedSource(null);
  }, [activePath]);

  const translateReady = openrouterKey.length > 0 && openrouterModel.length > 0;
  const aiTooltip = !openrouterKey
    ? "add an openrouter api key in settings"
    : !openrouterModel
      ? "pick a model in settings"
      : undefined;
  const translateTooltip = aiTooltip;

  const handleTranslate = useCallback(async () => {
    if (!translateReady || translating) return;
    setTranslating(true);
    try {
      const translated = await translateMarkdown({
        apiKey: openrouterKey,
        model: openrouterModel,
        targetLang: translateTargetLang,
        source,
        systemPrompt: translatePrompt,
      });
      setTranslatedSource(translated);
    } catch (err) {
      console.error("marknote: translate failed", err);
      setLoadError({ message: `translate failed — ${String(err)}` });
    } finally {
      setTranslating(false);
    }
  }, [translateReady, translating, openrouterKey, openrouterModel, translateTargetLang, translatePrompt, source, setLoadError]);

  const handleRevertTranslation = useCallback(() => setTranslatedSource(null), []);

  const handleCorrectMarkdown = useCallback(async (rangeOverride?: TextRange) => {
    if (!translateReady || correcting || !source.trim()) return;
    const range = rangeOverride ?? aiTargetRange();
    const target = source.slice(range.from, range.to);
    if (!target.trim()) return;
    setCorrecting(true);
    try {
      const corrected = await proofreadMarkdown({
        apiKey: openrouterKey,
        model: openrouterModel,
        source: target,
        systemPrompt: proofreadPrompt,
      });
      setTranslatedSource(null);
      setAiReview({
        title: "ai proofread",
        original: target,
        next: corrected,
        range,
      });
    } catch (err) {
      console.error("marknote: proofreading failed", err);
      setLoadError({ message: `proofreading failed - ${String(err)}` });
    } finally {
      setCorrecting(false);
    }
  }, [translateReady, correcting, source, aiTargetRange, openrouterKey, openrouterModel, proofreadPrompt, setLoadError]);

  const handlePromptifyMarkdown = useCallback(async (rangeOverride?: TextRange) => {
    if (!translateReady || promptifying || !source.trim()) return;
    const range = rangeOverride ?? aiTargetRange();
    const target = source.slice(range.from, range.to);
    if (!target.trim()) return;
    setPromptifying(true);
    try {
      const prompt = await promptifyMarkdown({
        apiKey: openrouterKey,
        model: openrouterModel,
        source: target,
        systemPrompt: promptifyPrompt,
      });
      setTranslatedSource(null);
      setAiReview({
        title: "ai prompt",
        original: target,
        next: prompt,
        range,
      });
    } catch (err) {
      console.error("marknote: promptify failed", err);
      setLoadError({ message: `promptify failed - ${String(err)}` });
    } finally {
      setPromptifying(false);
    }
  }, [translateReady, promptifying, source, aiTargetRange, openrouterKey, openrouterModel, promptifyPrompt, setLoadError]);

  const handleTranslateMarkdown = useCallback(async (rangeOverride?: TextRange) => {
    if (!translateReady || translating || !source.trim()) return;
    const range = rangeOverride ?? aiTargetRange();
    const target = source.slice(range.from, range.to);
    if (!target.trim()) return;
    const targetLanguage = LANGUAGES.find((lang) => lang.code === translateTargetLang)?.label ?? translateTargetLang;
    setTranslating(true);
    try {
      const translated = await translateMarkdown({
        apiKey: openrouterKey,
        model: openrouterModel,
        targetLang: translateTargetLang,
        source: target,
        systemPrompt: translatePrompt,
      });
      if (translated.trim() === target.trim()) {
        setLoadError({
          message: `translate returned no changes - target language is ${targetLanguage}; pick another language in settings if needed`,
        });
        return;
      }
      setTranslatedSource(null);
      setAiReview({
        title: `ai translate to ${targetLanguage}`,
        original: target,
        next: translated,
        range,
      });
    } catch (err) {
      console.error("marknote: translate failed", err);
      setLoadError({ message: `translate failed - ${String(err)}` });
    } finally {
      setTranslating(false);
    }
  }, [
    translateReady,
    translating,
    source,
    aiTargetRange,
    openrouterKey,
    openrouterModel,
    translateTargetLang,
    translatePrompt,
    setLoadError,
  ]);

  const applyAiReview = useCallback(() => {
    if (!aiReview) return;
    const { range, next } = aiReview;
    createSnapshot(source, activePath, `before ${aiReview.title}`);
    refreshSnapshots();
    const nextSource = `${source.slice(0, range.from)}${next}${source.slice(range.to)}`;
    setSource(nextSource);
    setAiReview(null);
    window.requestAnimationFrame(() => editorRef.current?.goTo(range.from + next.length));
  }, [aiReview, source, activePath, refreshSnapshots, setSource]);

  const previewSource = translatedSource ?? debouncedPreview;
  const editorAiBusyLabel = correcting
    ? "ai proofread..."
    : promptifying
      ? "turning into prompt..."
      : translating
        ? "translating..."
        : null;

  const closeEditorContextMenu = useCallback(() => setEditorContextMenu(null), []);

  const handleEditorContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const selection = editorRef.current?.getSelection() ?? { from: 0, to: 0 };
    const hasSelection = selection.from !== selection.to;
    setSelectionRange(selection);
    setAiSelectionScope(hasSelection);
    setEditorContextMenu({
      x: e.clientX,
      y: e.clientY,
      range: hasSelection ? selection : { from: 0, to: source.length },
      hasSelection,
    });
  }, [source.length]);

  const replaceEditorRange = useCallback((range: TextRange, text: string) => {
    setTranslatedSource(null);
    editorRef.current?.replaceRange(range, text, {
      from: range.from + text.length,
      to: range.from + text.length,
    });
  }, []);

  const editorContextItems = useMemo<ContextMenuItem[]>(() => {
    if (!editorContextMenu) return [];
    const { range, hasSelection } = editorContextMenu;
    const targetRange = hasSelection ? range : { from: 0, to: source.length };
    const selectedText = hasSelection ? source.slice(range.from, range.to) : "";
    const aiHint = hasSelection ? "selection" : "file";
    const targetLanguage = LANGUAGES.find((lang) => lang.code === translateTargetLang)?.label ?? translateTargetLang;
    return [
      {
        label: "ai proofread",
        icon: CheckCheck,
        hint: aiHint,
        disabled: !translateReady || correcting || !source.trim(),
        onSelect: () => void handleCorrectMarkdown(targetRange),
      },
      {
        label: "turn into prompt",
        icon: WandSparkles,
        hint: aiHint,
        disabled: !translateReady || promptifying || !source.trim(),
        onSelect: () => void handlePromptifyMarkdown(targetRange),
      },
      {
        label: "translate",
        icon: Languages,
        hint: `${targetLanguage} · ${aiHint}`,
        disabled: !translateReady || translating || !source.trim(),
        onSelect: () => void handleTranslateMarkdown(targetRange),
      },
      "divider",
      {
        label: "copy",
        icon: Copy,
        disabled: !hasSelection,
        onSelect: () => {
          if (selectedText) void navigator.clipboard.writeText(selectedText);
        },
      },
      {
        label: "cut",
        icon: Scissors,
        disabled: !hasSelection,
        onSelect: () => {
          if (selectedText) void navigator.clipboard.writeText(selectedText);
          replaceEditorRange(range, "");
        },
      },
      {
        label: "paste",
        icon: Clipboard,
        onSelect: () => {
          void navigator.clipboard.readText().then((text) => {
            if (!text) return;
            const pasteRange = hasSelection ? range : selectionRange;
            replaceEditorRange(pasteRange, text);
          });
        },
      },
      "divider",
      {
        label: "select all",
        icon: TextCursorInput,
        onSelect: () => {
          const full = { from: 0, to: source.length };
          setSelectionRange(full);
          setAiSelectionScope(source.length > 0);
          editorRef.current?.selectRange(full);
        },
      },
      {
        label: hasSelection ? "use selection for ai" : "ai uses whole file",
        icon: MousePointer2,
        hint: hasSelection ? "on" : "file",
        disabled: !hasSelection,
        onSelect: () => setAiSelectionScope(true),
      },
    ];
  }, [
    editorContextMenu,
    source,
    translateReady,
    correcting,
    promptifying,
    translating,
    translateTargetLang,
    handleCorrectMarkdown,
    handlePromptifyMarkdown,
    handleTranslateMarkdown,
    replaceEditorRange,
    selectionRange,
  ]);

  const contextItems = useMemo<ContextMenuItem[]>(() => {
    if (!contextMenu) return [];
    const { path, isDir } = contextMenu;
    const items: ContextMenuItem[] = [
      {
        label: "rename",
        onSelect: () => setEditingPath(path),
      },
    ];
    if (isDir) {
      items.push("divider");
      items.push({
        label: "new file",
        onSelect: () => setNewEntry({ parent: path, kind: "file" }),
      });
      items.push({
        label: "new folder",
        onSelect: () => setNewEntry({ parent: path, kind: "folder" }),
      });
    } else {
      items.push("divider");
      items.push({
        label: "reveal in finder",
        onSelect: () => void openPath(dirname(path)),
      });
      items.push({
        label: "open in default app",
        onSelect: () => void openPath(path),
      });
    }
    items.push("divider");
    items.push({
      label: isDir ? "delete folder" : "delete",
      destructive: true,
      onSelect: () => {
        const name = basename(path);
        const msg = isDir
          ? `delete folder "${name}" and everything inside it?\n\nthis cannot be undone.`
          : `delete "${name}"?\n\nthis cannot be undone.`;
        if (!window.confirm(msg)) return;
        void (async () => {
          try {
            await removeEntry(path, isDir);
            // if the deleted file was active, clear the editor back to demo
            if (!isDir && activePath === path) {
              loadDemo();
            }
            // if the deleted folder contained the active file, clear too
            if (isDir && activePath && activePath.startsWith(path + "/")) {
              loadDemo();
            }
            bumpTree();
          } catch (err) {
            console.error("marknote: delete failed", err);
            setLoadError({ message: `couldn't delete: ${String(err)}` });
          }
        })();
      },
    });
    return items;
  }, [contextMenu, activePath, setActivePath, bumpTree]);

  // OS "Open With → marknote" from Finder — Rust emits marknote:open-file
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<string>("marknote:open-file", (event) => {
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

  // OS drop. dragDropEnabled is OFF so Tauri doesn't intercept. counter guards
  // nested dragenter/leave firing multiple times.
  useEffect(() => {
    let enterCount = 0;

    const isOsFileDrag = (e: DragEvent) => {
      if (!e.dataTransfer) return false;
      // never engage on in-app sidebar drags
      if (e.dataTransfer.types.includes("application/x-marknote-path")) return false;
      return e.dataTransfer.types.includes("Files");
    };

    const reset = () => {
      enterCount = 0;
      setDragActive(false);
    };

    const onDragEnter = (e: DragEvent) => {
      if (!isOsFileDrag(e)) return;
      enterCount += 1;
      if (enterCount === 1) setDragActive(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!isOsFileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (e: DragEvent) => {
      if (!isOsFileDrag(e)) return;
      enterCount = Math.max(0, enterCount - 1);
      if (enterCount === 0) setDragActive(false);
    };

    const onDrop = async (e: DragEvent) => {
      if (!isOsFileDrag(e)) {
        // safety: any drop that lands on window resets state
        reset();
        return;
      }
      e.preventDefault();
      reset();
      const files = Array.from(e.dataTransfer?.files ?? []);
      const firstMd = files.find((f) => isMarkdownPath(f.name));
      if (firstMd) {
        // WKWebView doesn't expose file path; load content as an untitled buffer.
        try {
          const text = await firstMd.text();
          startNewBuffer(text);
        } catch (err) {
          console.error("marknote: file drop read failed", err);
          setLoadError({ message: `could not read ${firstMd.name} — ${err}` });
        }
      } else if (files.length > 0) {
        setLoadError({
          message: "only .md / .markdown / .mdx / .txt files can be opened in marknote",
        });
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    // safety: any of these end the drag for sure — keeps state from sticking
    window.addEventListener("dragend", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("blur", reset);
    };
  }, [setActivePath]);

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
        // functional update — avoids stale closure on rapid double-tap when
        // shortcuts memo hasn't rebuilt yet
        setSidebarOpen((v: boolean) => !v);
      },
      "mod+s": (e: KeyboardEvent) => {
        e.preventDefault();
        if (activePath) {
          // existing file — only write if dirty
          if (dirty) void saveNow(activePath, source);
        } else {
          // untitled buffer — open native save dialog (resolves #17 save half + macOS parity)
          void saveAs();
        }
      },
      "mod+shift+s": (e: KeyboardEvent) => {
        e.preventDefault();
        // explicit "save as" — works on both untitled and existing buffers
        void saveAs();
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
      "mod+shift+.": (e: KeyboardEvent) => {
        e.preventDefault();
        toggleEditorOnly();
      },
      escape: (e: KeyboardEvent) => {
        if (readingMode) {
          e.preventDefault();
          exitReadingMode();
        }
      },
      // ⌘F / Ctrl+F — only active in reading mode. In editor mode, codemirror
      // owns ⌘F via its searchKeymap (editor.tsx:105).
      ...(readingMode
        ? {
            "mod+f": (e: KeyboardEvent) => {
              e.preventDefault();
              setFindOpen(true);
            },
          }
        : {}),
    }),
    [
      activePath,
      source,
      dirty,
      saveNow,
      saveAs,
      handleOpenFile,
      handleOpenFolder,
      handleNewFile,
      handleToggleSidebar,
      copyMarkdown,
      exportToPdf,
      toggleFullscreen,
      readingMode,
      toggleReadingMode,
      exitReadingMode,
      toggleEditorOnly,
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
          if (activePath && dirty) {
            void saveNow(activePath, source);
          }
        },
        toggleSidebar: handleToggleSidebar,
        toggleReading: toggleReadingMode,
        showHelp,
        showWelcome,
        showAbout,
        loadDemo,
        undoFileOp: handleUndoFileOp,
        checkForUpdates: handleManualUpdateCheck,
        copyMarkdown,
        exportToPdf,
        toggleFullscreen,
        openRecent: (path: string) => void loadFile(path),
        recentFiles,
        hasActivePath: activePath != null,
        sidebarOpen,
        readingMode,
        editorOnly,
        toggleEditorOnly,
      }),
    [
      handleNewFile,
      handleOpenFile,
      handleOpenFolder,
      activePath,
      source,
      dirty,
      saveNow,
      sidebarOpen,
      copyMarkdown,
      showHelp,
      showWelcome,
      showAbout,
      loadDemo,
      handleUndoFileOp,
      handleManualUpdateCheck,
      exportToPdf,
      toggleFullscreen,
      handleToggleSidebar,
      loadFile,
      recentFiles,
    ],
  );

  const displayName = activePath ? basename(activePath) : undefined;
  const editorWorkspace = (
    <div className="mdv-editor-workspace">
      <MarkdownToolbar
        onAction={handleMarkdownAction}
        onTemplate={handleInsertTemplate}
        onSnapshot={() => handleCreateSnapshot()}
        onShowSnapshots={() => {
          refreshSnapshots();
          setSnapshotsOpen(true);
        }}
        onUndo={handleUndoEdit}
        onRedo={handleRedoEdit}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((v) => !v)}
        textColor={editorTextColor}
        highlightColor={editorHighlightColor}
      />
      <div className="mdv-editor-workspace__body">
        <div className="mdv-editor-workspace__main">
          <Editor
            ref={editorRef}
            value={source}
            onChange={setSource}
            onSelectionChange={handleEditorSelectionChange}
            onContextMenu={handleEditorContextMenu}
            vimOn={vimOn}
            onVimMode={setVimMode}
            secretsHidden={secretsHidden}
          />
          {editorAiBusyLabel ? (
            <div className="mdv-editor-ai-busy" role="status" aria-live="polite">
              <span className="mdv-editor-ai-busy__spinner" aria-hidden />
              <span>{editorAiBusyLabel}</span>
            </div>
          ) : null}
        </div>
        {inspectorOpen ? (
          <MarkdownInspector
            headings={headings}
            issues={markdownIssues}
            onGoTo={(pos) => editorRef.current?.goTo(pos)}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={`mdv-app${sidebarOpen ? " has-sidebar" : ""}${readingMode ? " is-reading" : ""}${dockMode !== "off" && !dockOpen ? ` is-docked is-docked-${dockMode}` : ""}`}
      style={appStyle}
    >
      {dockMode !== "off" && !dockOpen ? (
        <button
          type="button"
          className={`mdv-dock-rail mdv-dock-rail--${dockMode}`}
          onClick={handleDockTabClick}
          aria-label="open marknote"
          data-tooltip="open"
        >
          <Icon icon={dockMode === "left" ? ChevronRight : ChevronLeft} size={14} strokeWidth={1.8} />
        </button>
      ) : null}

      <TitleBar
        fileName={displayName}
        filePath={activePath}
        dirty={dirty}
        readingMode={readingMode}
        onToggleReading={toggleReadingMode}
        onCopyMarkdown={activePath || source ? () => void copyMarkdown() : undefined}
        copyPulse={copyPulse}
        onExportPdf={exportToPdf}
        vimOn={vimOn}
        onToggleVim={() => setVimOn((v) => !v)}
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
        onCorrectMarkdown={source.trim() ? () => void handleCorrectMarkdown() : undefined}
        correcting={correcting}
        correctDisabled={!translateReady || correcting}
        correctTooltip={aiTooltip}
        onPromptifyMarkdown={source.trim() ? () => void handlePromptifyMarkdown() : undefined}
        promptifying={promptifying}
        promptifyDisabled={!translateReady || promptifying}
        promptifyTooltip={aiTooltip}
        aiSelectionAvailable={hasTextSelection}
        aiSelectionActive={aiSelectionScope}
        aiSelectionLabel={`${selectionCharCount} chars`}
        onToggleAiSelection={() => setAiSelectionScope((v) => !v)}
        onSave={() => {
          if (activePath) {
            if (dirty) void saveNow(activePath, source);
          } else {
            void saveAs();
          }
        }}
        saveDisabled={activePath != null && !dirty}
        onNavigateToFolder={(folder) => {
          setRootPath(folder);
          setSidebarOpen(true);
        }}
        editorVisible={editorVisible}
        previewVisible={previewVisible}
        onToggleEditor={handleToggleEditor}
        onTogglePreview={handleTogglePreview}
        secretsPresent={sourceHasSecrets(source)}
        secretsHidden={secretsHidden}
        onToggleSecrets={toggleSecrets}
      />

      <main className="mdv-shell">
        {readingMode ? (
          <>
            <Preview
              source={previewSource}
              onTranslate={handleTranslate}
              onRevertTranslation={handleRevertTranslation}
              translating={translating}
              translated={translatedSource != null}
              translateDisabled={!translateReady}
              translateTooltip={translateTooltip}
              secretsHidden={secretsHidden}
              onToggleSecrets={toggleSecrets}
            />
            <ReadingFind
              open={findOpen}
              onClose={() => setFindOpen(false)}
              scope={proseEl}
              contentKey={debouncedPreview}
            />
          </>
        ) : (
          <>
            <Sidebar
              open={sidebarOpen}
              rootPath={rootPath}
              activePath={activePath}
              width={sidebarWidth}
              onWidthChange={setSidebarWidth}
              onOpenFolder={handleOpenFolder}
              onNewFileAtRoot={rootPath ? () => setNewEntry({ parent: rootPath, kind: "file" }) : undefined}
              onNewFolderAtRoot={rootPath ? () => setNewEntry({ parent: rootPath, kind: "folder" }) : undefined}
              onSelectFile={(path) => void loadFile(path)}
              onNavigateToFolder={(folder) => {
                setRootPath(folder);
                setSidebarOpen(true);
              }}
              onMove={handleMove}
              onContextMenu={handleContextMenu}
              onRequestRename={setEditingPath}
              editingPath={editingPath}
              onSubmitRename={handleSubmitRename}
              onCancelEdit={() => setEditingPath(null)}
              newEntry={newEntry}
              onSubmitNew={handleSubmitNew}
              onCancelNew={() => setNewEntry(null)}
              treeVersion={treeVersion}
            />
            {editorOnly ? (
              <div className="mdv-shell__editor-solo">
                {editorWorkspace}
              </div>
            ) : previewOnly ? (
              <div className="mdv-shell__editor-solo mdv-shell__preview-solo">
                <Preview
                  source={previewSource}
                  onTranslate={handleTranslate}
                  onRevertTranslation={handleRevertTranslation}
                  translating={translating}
                  translated={translatedSource != null}
                  translateDisabled={!translateReady}
                  translateTooltip={translateTooltip}
                  secretsHidden={secretsHidden}
                  onToggleSecrets={toggleSecrets}
                />
              </div>
            ) : (
              <Splitter
                left={editorWorkspace}
                right={
                  <Preview
                    source={previewSource}
                    onTranslate={handleTranslate}
                    onRevertTranslation={handleRevertTranslation}
                    translating={translating}
                    translated={translatedSource != null}
                    translateDisabled={!translateReady}
                    translateTooltip={translateTooltip}
                  />
                }
              />
            )}
          </>
        )}
      </main>

      <Toast
        open={loadError != null}
        message={loadError?.message ?? ""}
        onDismiss={dismissLoadError}
        action={
          loadError?.path
            ? {
                label: "open in default app",
                onClick: async () => {
                  if (loadError.path) {
                    try {
                      await openPath(loadError.path);
                    } catch (err) {
                      console.error("marknote: openPath failed", err);
                    }
                  }
                },
              }
            : undefined
        }
      />

      <Toast
        open={copyToast != null && loadError == null}
        message={copyToast ?? ""}
        variant="info"
        onDismiss={dismissCopyToast}
      />

      <Toast
        open={saveAsToast != null && loadError == null}
        message={saveAsToast ?? ""}
        variant="info"
        onDismiss={dismissSaveAsToast}
      />

      <Toast
        open={updateAvail != null && loadError == null}
        message={
          updateInstalling
            ? `installing v${updateAvail?.version}…`
            : `update available · v${updateAvail?.version}`
        }
        variant="info"
        durationMs={null}
        onDismiss={() => setUpdateAvail(null)}
        action={
          updateInstalling
            ? undefined
            : { label: "install", onClick: () => void handleApplyUpdate() }
        }
      />

      <Toast
        open={updateUpToDate && loadError == null && updateAvail == null}
        message="you're on the latest version"
        variant="info"
        onDismiss={() => setUpdateUpToDate(false)}
      />

      <Toast
        open={whatsNewVersion != null && loadError == null && updateAvail == null}
        message={whatsNewVersion ? getWhatsNewToastMessage(whatsNewVersion) : ""}
        variant="info"
        durationMs={null}
        onDismiss={() => setWhatsNewVersion(null)}
        action={{
          label: "what's new",
          onClick: () => {
            void openUrl(CHANGELOG_URL);
          },
        }}
      />

      <Toast
        open={externalReloadToast && loadError == null}
        message="file changed externally · reloaded"
        variant="info"
        onDismiss={dismissExternalReload}
      />

      <Toast
        open={externalConflict != null && loadError == null}
        message="this file changed externally · your unsaved edits would be lost"
        variant="info"
        durationMs={null}
        onDismiss={() => setExternalConflict(null)}
        action={{
          label: "reload (discard mine)",
          onClick: () => {
            if (externalConflict != null) {
              setSource(externalConflict);
            }
            setExternalConflict(null);
          },
        }}
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

      <AiReviewOverlay
        open={aiReview != null}
        title={aiReview?.title ?? "ai review"}
        original={aiReview?.original ?? ""}
        next={aiReview?.next ?? ""}
        onApply={applyAiReview}
        onClose={() => setAiReview(null)}
      />

      <SnapshotsOverlay
        open={snapshotsOpen}
        snapshots={snapshots}
        onRestore={handleRestoreSnapshot}
        onDelete={handleDeleteSnapshot}
        onClose={() => setSnapshotsOpen(false)}
      />

      <SettingsOverlay
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        vimOn={vimOn}
        onVimToggle={setVimOn}
        openrouterKey={openrouterKey}
        onOpenrouterKeyChange={setOpenrouterKey}
        openrouterModel={openrouterModel}
        onOpenrouterModelChange={setOpenrouterModel}
        translateTargetLang={translateTargetLang}
        onTranslateTargetLangChange={setTranslateTargetLang}
        proofreadPrompt={proofreadPrompt}
        onProofreadPromptChange={setProofreadPrompt}
        promptifyPrompt={promptifyPrompt}
        onPromptifyPromptChange={setPromptifyPrompt}
        translatePrompt={translatePrompt}
        onTranslatePromptChange={setTranslatePrompt}
        editorTextColor={editorTextColor}
        onEditorTextColorChange={setEditorTextColor}
        editorHighlightColor={editorHighlightColor}
        onEditorHighlightColorChange={setEditorHighlightColor}
        secretHiddenColor={secretHiddenColor}
        onSecretHiddenColorChange={setSecretHiddenColor}
        secretHiddenBg={secretHiddenBg}
        onSecretHiddenBgChange={setSecretHiddenBg}
        secretRevealedColor={secretRevealedColor}
        onSecretRevealedColorChange={setSecretRevealedColor}
        secretRevealedBg={secretRevealedBg}
        onSecretRevealedBgChange={setSecretRevealedBg}
        onCheckForUpdates={UPDATES_ENABLED ? handleManualUpdateCheck : undefined}
        dockMode={dockMode}
        onDockModeChange={setDockMode}
      />

      <AboutOverlay
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onCheckForUpdates={UPDATES_ENABLED ? handleManualUpdateCheck : undefined}
      />

      <WelcomeOverlay
        open={welcomeOpen}
        onClose={dismissWelcome}
        onOpenFolder={handleOpenFolder}
      />

      <DropOverlay active={dragActive} />
      <TooltipRoot />

      <ContextMenu
        open={contextMenu != null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        items={contextItems}
        onClose={closeContextMenu}
      />

      <ContextMenu
        open={editorContextMenu != null}
        x={editorContextMenu?.x ?? 0}
        y={editorContextMenu?.y ?? 0}
        items={editorContextItems}
        onClose={closeEditorContextMenu}
      />

      <StatusBar
        fileName={displayName}
        words={words}
        minutes={minutes}
        docTokens={docTokens}
        onShowHelp={() => setHelpOpen(true)}
        onShowSettings={() => setSettingsOpen(true)}
        vimMode={readingMode ? null : vimMode}
      />
    </div>
  );
}
