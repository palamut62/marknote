import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { StatusBar, type VimMode } from "@/components/chrome";
import {
  Editor,
  MarkdownInspector,
  MarkdownToolbar,
  Preview,
  ReadingFind,
  RichEditor,
  RichToolbar,
  Splitter,
  type EditorHandle,
  type RichEditorHandle,
} from "@/components/editor";
import { EditorErrorBoundary } from "@/components/editor/editor-error-boundary";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { ContextMenu, type ContextMenuItem } from "@/components/files";
import {
  AboutOverlay,
  AiReviewOverlay,
  CommandPalette,
  ConfirmDialog,
  DeveloperToolsOverlay,
  DropOverlay,
  HelpOverlay,
  HistoryOverlay,
  PromptDialog,
  RecoveryDialog,
  SecretSendDialog,
  SettingsOverlay,
  Toast,
  UnsavedChangesDialog,
} from "@/components/overlays";
import { TooltipRoot, Icon } from "@/components/primitives";
import { NavPanel, type NavSection } from "@/components/shell/nav-panel";
import { NoteList, type NoteListItem } from "@/components/shell/note-list";
import { EditorHeader, VIEW_LABELS, type ViewMode } from "@/components/shell/editor-header";
import {
  useDebouncedValue,
  useFileOps,
  useFileSession,
  useFileWatcher,
  useNotifications,
  useOverlays,
  usePersistedState,
  useShortcuts,
  useSecureSecret,
  useSyncScroll,
  useUpdateFlow,
} from "@/hooks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import {
  basename,
  buildCommands,
  CHANGELOG_URL,
  createNewNoteFile,
  defaultNotesFolder,
  dirname,
  estimateTokens,
  exportPreviewToHtml,
  exportPreviewToPdf,
  formatTokens,
  getWhatsNewToastMessage,
  IS_MAC,
  isEditablePath,
  isNewNoteFileName,
  joinPath,
  PdfExportError,
  resolveNewNoteFolder,
  pickFolder,
  pickMarkdownFile,
  STORAGE_KEYS,
  DEFAULT_PROOFREAD_PROMPT,
  DEFAULT_PROMPTIFY_PROMPT,
  DEFAULT_TRANSLATE_PROMPT,
  applyMarkdownAction,
  extractHeadings,
  insertTemplate,
  lintMarkdown,
  proofreadMarkdown,
  promptifyMarkdown,
  translateMarkdown,
  LANGUAGES,
  type MarkdownAction,
  type TextRange,
  type ExportProfile,
  type FileEntry,
} from "@/lib";
import { UPDATES_ENABLED } from "@/lib/updater";
import { applyDockMode, collapseDock, expandDock, type DockMode } from "@/lib/dock";
import { maskSecretsInText, sourceHasSecrets } from "@/lib/secret-mask";
import { buildNoteIndex, deriveTitle, searchNotes, upsertNote, type NoteIndex } from "@/lib/notes-index";
import { isSameOrChildPath, remapPath, samePath } from "@/lib/paths";
import { deleteFromTrash, emptyTrash, listTrash, moveToTrash, restoreFromTrash, type TrashItem } from "@/lib/trash";
import {
  deleteVersion,
  listVersions,
  migrateLegacySnapshots,
  readVersion,
  saveVersion,
  type HistoryEntry,
} from "@/lib/history";
import {
  BookOpen,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Copy,
  Columns2,
  FileCode2,
  FileDown,
  FolderInput,
  FolderOpen,
  FolderPlus,
  History,
  Languages,
  Maximize2,
  MousePointer2,
  PenLine,
  Pin,
  PinOff,
  Save,
  Scissors,
  Settings2,
  TextCursorInput,
  Trash2,
  WandSparkles,
} from "lucide-react";
import "./app.css";

const AI_TIMEOUT_MS = 90_000;
const AI_MAX_CHARS = 100_000;
const NAV_COLLAPSE_PX = 1000;
const LIST_COLLAPSE_PX = 760;

type AiKind = "proofread" | "promptify" | "translate";
type AiJob = { kind: AiKind; label: string; docId: number; controller: AbortController };
type AiReview = { title: string; original: string; next: string; range: TextRange; docId: number };
type PendingNavigation = { action: () => void; quit?: boolean };
type InfoToast = { message: string; action?: { label: string; onClick: () => void } };
type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};
type PromptState = {
  title: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  onSubmit: (value: string) => void;
};

const INVALID_NAME = /[<>:"/\\|?*\u0000-\u001f]/;

function validateName(name: string): string | null {
  if (INVALID_NAME.test(name)) return 'Ad şu karakterleri içeremez: < > : " / \\ | ? *';
  if (name === "." || name === "..") return "Geçersiz ad";
  return null;
}

/** File name for a new note: its title, minus characters Windows rejects. */
function fileNameFromTitle(title: string): string {
  const clean = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `${clean || "Yeni not"}.txt`;
}

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

function relativeTo(root: string | null, path: string): string {
  if (!root || !isSameOrChildPath(path, root)) return path;
  return path.replace(/\\/g, "/").slice(root.replace(/\\/g, "/").replace(/\/$/, "").length + 1);
}

export function App() {
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [navigationSaving, setNavigationSaving] = useState(false);
  const [infoToast, setInfoToast] = useState<InfoToast | null>(null);
  const showInfo = useCallback((toast: InfoToast, ms = 4000) => {
    setInfoToast(toast);
    if (ms > 0) window.setTimeout(() => setInfoToast((t) => (t === toast ? null : t)), ms);
  }, []);
  const {
    loadError,
    setLoadError,
    dismissLoadError,
    copyToast,
    dismissCopyToast,
    copyMarkdown: copyMarkdownCore,
  } = useNotifications();

  const {
    source,
    setSource,
    activePath,
    rootPath,
    setRootPath,
    docId,
    saveStatus,
    lastSaveError,
    recentFiles,
    setRecentFiles,
    externalReloadToast,
    dismissExternalReload,
    externalConflict,
    setExternalConflict,
    acceptExternalChange,
    loadFile,
    saveNow,
    saveAs: saveAsCore,
    startNewBuffer,
    detachFromFile,
    remapPaths,
    dirty,
    recoveryDraft,
    restoreRecovery,
    dismissRecovery,
    flushRecovery,
  } = useFileSession({ onLoadError: setLoadError });

  // refs for async callbacks that must see the latest document (F06, R03)
  const docIdRef = useRef(docId);
  docIdRef.current = docId;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // ---- shared document-switch guard (F04) ------------------------------
  // every path that replaces the open document goes through here
  const continueNavigation = useCallback((action: () => void) => {
    if (dirtyRef.current) {
      setPendingNavigation({ action });
      return;
    }
    action();
  }, []);

  const [pinned, setPinned] = usePersistedState<string[]>(STORAGE_KEYS.pinnedNotes, []);
  const [newNoteFolder, setNewNoteFolder] = useState<string | null>(null);

  const remapAllPaths = useCallback((from: string, to: string) => {
    remapPaths(from, to);
    setPinned((list) => list.map((p) => remapPath(p, from, to)));
    setNewNoteFolder((p) => (p ? remapPath(p, from, to) : p));
    setNavSection((s) => (s.kind === "folder" ? { kind: "folder", path: remapPath(s.path, from, to) } : s));
  }, [remapPaths, setPinned]);

  const richRef = useRef<RichEditorHandle | null>(null);
  const mdEditorRef = useRef<EditorHandle | null>(null);
  const [pendingReveal, setPendingReveal] = useState<string | null>(null);

  const focusEditorSoon = useCallback(() => {
    window.requestAnimationFrame(() => richRef.current?.focus());
  }, []);

  const openNote = useCallback((path: string, match?: string) => {
    if (samePath(path, activePath)) {
      if (match) setPendingReveal(match);
      return;
    }
    continueNavigation(() => {
      void loadFile(path).then((ok) => {
        if (ok && match) setPendingReveal(match);
      });
    });
  }, [activePath, continueNavigation, loadFile]);

  // declared further down; newNote reads them at call time
  const navFolderRef = useRef<string | null>(null);
  const bumpTreeRef = useRef<() => void>(() => undefined);

  // a new note is a real .txt file from the start, created in the folder the
  // user is working in - so it is always on disk and reopens after a restart
  const newNote = useCallback((folder: string | null = null) => {
    continueNavigation(() => {
      void (async () => {
        let target = resolveNewNoteFolder({
          explicit: folder,
          selectedFolder: navFolderRef.current,
          activePath,
          rootPath,
        });
        // the open note is already an untouched new note in that folder: reuse it
        if (
          target && activePath && !dirtyRef.current && !sourceRef.current.trim()
          && isNewNoteFileName(basename(activePath)) && samePath(dirname(activePath), target)
        ) {
          setViewMode("write");
          focusEditorSoon();
          return;
        }
        try {
          const useDefault = !target;
          if (!target) target = await defaultNotesFolder();
          const created = await createNewNoteFile(target);
          // only point the workspace at Belgeler\Marknote once it exists on disk
          if (useDefault) setRootPath(target);
          bumpTreeRef.current();
          if (!(await loadFile(created))) return;
          setNewNoteFolder(null);
          setViewMode("write");
          focusEditorSoon();
          showInfo({ message: `${basename(created)} oluşturuldu: ${target}` }, 3200);
        } catch (err) {
          console.error("marknote: new note file failed", err);
          setLoadError({ message: `Yeni not dosyası oluşturulamadı - ${String(err)}` });
          // still let the user write; saving asks for a location
          setNewNoteFolder(target);
          startNewBuffer();
          setViewMode("write");
          focusEditorSoon();
        }
      })();
    });
  }, [continueNavigation, activePath, rootPath, setRootPath, loadFile, startNewBuffer, focusEditorSoon, showInfo, setLoadError]);

  const {
    treeVersion,
    bumpTree,
    handleMove,
    handleSubmitRename,
    handleSubmitNew,
    handleUndoFileOp,
  } = useFileOps({
    activePath,
    dirty,
    openFileGuarded: (path) => openNote(path),
    newBufferGuarded: () => continueNavigation(() => startNewBuffer()),
    onPathsRemapped: remapAllPaths,
    onError: setLoadError,
  });
  bumpTreeRef.current = bumpTree;

  // refresh the folder tree when the open folder changes on disk; also on
  // window focus, since root-mtime polling misses nested changes (R05)
  useFileWatcher(rootPath, bumpTree);
  useEffect(() => {
    window.addEventListener("focus", bumpTree);
    return () => window.removeEventListener("focus", bumpTree);
  }, [bumpTree]);

  const { paletteOpen, setPaletteOpen, helpOpen, setHelpOpen, aboutOpen, setAboutOpen, showHelp, showAbout } = useOverlays();

  const {
    updateAvail,
    setUpdateAvail,
    updateInstalling,
    updateUpToDate,
    setUpdateUpToDate,
    handleApplyUpdate,
    handleManualUpdateCheck,
  } = useUpdateFlow({ onError: setLoadError });

  // ---- view state --------------------------------------------------------
  const [viewMode, setViewMode] = useState<ViewMode>("write");
  const [focusMode, setFocusMode] = useState(false);
  const [navSection, setNavSection] = useState<NavSection>({ kind: "all" });
  navFolderRef.current = navSection.kind === "folder" ? navSection.path : null;
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 150);
  const width = useWindowWidth();
  const navCollapsed = width < NAV_COLLAPSE_PX;
  const listCollapsed = width < LIST_COLLAPSE_PX;
  const [navDrawer, setNavDrawer] = useState(false);
  const [listDrawer, setListDrawer] = useState(false);
  useEffect(() => {
    if (!navCollapsed) setNavDrawer(false);
    if (!listCollapsed) setListDrawer(false);
  }, [navCollapsed, listCollapsed]);
  const showNav = !focusMode && (!navCollapsed || navDrawer);
  const showList = !focusMode && (!listCollapsed || listDrawer);

  const [vimOn, setVimOn] = usePersistedState<boolean>(STORAGE_KEYS.vimMode, false);
  const [techCounters, setTechCounters] = usePersistedState<boolean>(STORAGE_KEYS.techCounters, false);
  const [remoteImages, setRemoteImages] = usePersistedState<boolean>(STORAGE_KEYS.remoteImages, false);
  const [vimMode, setVimMode] = useState<VimMode | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [developerToolsOpen, setDeveloperToolsOpen] = useState(false);
  const [exportProfile, setExportProfile] = usePersistedState<ExportProfile>(STORAGE_KEYS.exportProfile, "standard");
  const {
    value: openrouterKey,
    setValue: setOpenrouterKey,
    ready: secureStorageReady,
    error: secureStorageError,
  } = useSecureSecret(STORAGE_KEYS.openrouterKey);
  const [openrouterModel, setOpenrouterModel] = usePersistedState<string>(STORAGE_KEYS.openrouterModel, "");
  const [translateTargetLang, setTranslateTargetLang] = usePersistedState<string>(
    STORAGE_KEYS.translateTargetLang,
    LANGUAGES[0]?.code ?? "en",
  );
  const [proofreadPrompt, setProofreadPrompt] = usePersistedState<string>(STORAGE_KEYS.proofreadPrompt, DEFAULT_PROOFREAD_PROMPT);
  const [promptifyPrompt, setPromptifyPrompt] = usePersistedState<string>(STORAGE_KEYS.promptifyPrompt, DEFAULT_PROMPTIFY_PROMPT);
  const [translatePrompt, setTranslatePrompt] = usePersistedState<string>(STORAGE_KEYS.translatePrompt, DEFAULT_TRANSLATE_PROMPT);
  const [translatedSource, setTranslatedSource] = useState<string | null>(null);
  const [previewTranslating, setPreviewTranslating] = useState(false);

  const [richEditor, setRichEditor] = useState<TiptapEditor | null>(null);
  const [richSafe, setRichSafe] = useState(true);
  const [selectionRange, setSelectionRange] = useState<TextRange>({ from: 0, to: 0 });
  const [aiSelectionScope, setAiSelectionScope] = useState(false);
  const [editorContextMenu, setEditorContextMenu] = useState<{ x: number; y: number; range: TextRange; hasSelection: boolean } | null>(null);
  const [richContextMenu, setRichContextMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; path: string; isDir: boolean; isRoot?: boolean } | null>(null);
  const [docMenu, setDocMenu] = useState<{ x: number; y: number } | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);

  const [secretsHidden, setSecretsHidden] = usePersistedState<boolean>(STORAGE_KEYS.secretsHidden, true);
  const [editorTextColor, setEditorTextColor] = usePersistedState<string>(STORAGE_KEYS.editorTextColor, "#2563eb");
  const [editorHighlightColor, setEditorHighlightColor] = usePersistedState<string>(STORAGE_KEYS.editorHighlightColor, "#fde047");
  const [secretHiddenColor, setSecretHiddenColor] = usePersistedState<string>(STORAGE_KEYS.secretHiddenColor, "#7c3aed");
  const [secretHiddenBg, setSecretHiddenBg] = usePersistedState<string>(STORAGE_KEYS.secretHiddenBg, "#ede9fe");
  const [secretRevealedColor, setSecretRevealedColor] = usePersistedState<string>(STORAGE_KEYS.secretRevealedColor, "#b91c1c");
  const [secretRevealedBg, setSecretRevealedBg] = usePersistedState<string>(STORAGE_KEYS.secretRevealedBg, "#fee2e2");
  const toggleSecrets = useCallback(() => setSecretsHidden((v: boolean) => !v), [setSecretsHidden]);
  const [dockMode, setDockMode] = usePersistedState<DockMode>(STORAGE_KEYS.dockMode, "off");
  const [dockOpen, setDockOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [whatsNewVersion, setWhatsNewVersion] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.platform = IS_MAC ? "mac" : "other";
  }, []);

  // remote images: read by the rich editor's image node view and the preview
  useEffect(() => {
    (window as unknown as { __marknoteRemoteImages?: boolean }).__marknoteRemoteImages = remoteImages;
  }, [remoteImages]);

  // ---- dock (unchanged behaviour) -----------------------------------------
  useEffect(() => {
    void applyDockMode(dockMode, { open: dockOpen && dockMode !== "off" });
    if (dockMode === "off") setDockOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockMode]);

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
    return () => unlisten?.();
  }, [dockMode]);

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
    return () => unlisten?.();
  }, [dockMode, dockOpen]);

  const handleDockTabClick = useCallback(() => {
    if (dockMode === "off") return;
    void expandDock(dockMode as Exclude<DockMode, "off">).then(() => setDockOpen(true));
  }, [dockMode]);

  // ---- note index (list + unified search) ---------------------------------
  const [noteIndex, setNoteIndex] = useState<NoteIndex | null>(null);
  const [indexLoading, setIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexVersion, setIndexVersion] = useState(0);
  useEffect(() => {
    if (!rootPath) {
      setNoteIndex(null);
      setIndexError(null);
      return;
    }
    const controller = new AbortController();
    setIndexLoading(true);
    setIndexError(null);
    buildNoteIndex(rootPath, controller.signal)
      .then((idx) => {
        if (!controller.signal.aborted) setNoteIndex(idx);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setIndexError(`Notlar okunamadı - ${String(err)}`);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIndexLoading(false);
      });
    return () => controller.abort();
  }, [rootPath, treeVersion, indexVersion]);

  // ---- trash ----------------------------------------------------------------
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const refreshTrash = useCallback(() => {
    listTrash()
      .then(setTrashItems)
      .catch((err) => console.warn("marknote: trash list failed", err));
  }, []);
  useEffect(() => {
    refreshTrash();
  }, [refreshTrash]);

  // ---- history (per document, on disk) -------------------------------------
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  useEffect(() => {
    void migrateLegacySnapshots().catch((err) => console.warn("marknote: snapshot migration failed", err));
  }, []);
  const refreshHistory = useCallback(async () => {
    setHistoryError(null);
    try {
      setHistoryEntries(await listVersions(activePath));
    } catch (err) {
      setHistoryEntries([]);
      setHistoryError(`Sürümler okunamadı - ${String(err)}`);
    }
  }, [activePath]);
  const openHistory = useCallback(() => {
    setHistoryEntries(null);
    setHistoryOpen(true);
    void refreshHistory();
  }, [refreshHistory]);
  const saveCurrentVersion = useCallback(async (label = "Elle kaydedilen sürüm"): Promise<boolean> => {
    if (!sourceRef.current.trim()) return true;
    try {
      await saveVersion(activePath, sourceRef.current, label);
      return true;
    } catch (err) {
      setHistoryError(`Sürüm kaydedilemedi - ${String(err)}`);
      setLoadError({ message: `Sürüm kaydedilemedi - ${String(err)}` });
      return false;
    }
  }, [activePath, setLoadError]);

  // ---- derived document info ----------------------------------------------
  const isNew = activePath == null;
  const docTitle = useMemo(() => {
    if (activePath) return deriveTitle(source, basename(activePath));
    return source.trim() ? deriveTitle(source, "Yeni not") : "Yeni not";
  }, [source, activePath]);
  const folderLabel = useMemo(() => {
    if (!activePath) return newNoteFolder ? basename(newNoteFolder) : null;
    const dir = dirname(activePath);
    if (rootPath && isSameOrChildPath(dir, rootPath)) return relativeTo(rootPath, dir) || basename(rootPath);
    return basename(dir);
  }, [activePath, rootPath, newNoteFolder]);

  // keep the index entry of the open note fresh after a save
  const lastIndexedRef = useRef<string | null>(null);
  useEffect(() => {
    if (saveStatus !== "saved" || !activePath || !rootPath || !isSameOrChildPath(activePath, rootPath)) return;
    const key = `${activePath}:${sourceRef.current.length}`;
    if (lastIndexedRef.current === key) return;
    lastIndexedRef.current = key;
    setNoteIndex((idx) => (idx ? upsertNote(idx, activePath, relativeTo(rootPath, activePath), sourceRef.current) : idx));
  }, [saveStatus, activePath, rootPath]);

  // ---- saving ----------------------------------------------------------------
  const saveAs = useCallback(async (): Promise<string | null> => {
    const folder = newNoteFolder ?? (navSection.kind === "folder" ? navSection.path : null) ?? rootPath;
    const suggested = activePath ?? (folder ? joinPath(folder, fileNameFromTitle(docTitle)) : fileNameFromTitle(docTitle));
    const target = await saveAsCore(suggested);
    if (!target) return null;
    setNewNoteFolder(null);
    bumpTree();
    showInfo({ message: `${basename(target)} kaydedildi` }, 2400);
    return target;
  }, [newNoteFolder, navSection, rootPath, activePath, docTitle, saveAsCore, bumpTree, showInfo]);

  const saveCurrent = useCallback(async (): Promise<boolean> => {
    if (activePath) {
      if (!dirtyRef.current && saveStatus !== "error") return true;
      return saveNow(activePath, sourceRef.current);
    }
    return (await saveAs()) != null;
  }, [activePath, saveStatus, saveNow, saveAs]);

  const discardAndContinue = useCallback(() => {
    const pending = pendingNavigation;
    setPendingNavigation(null);
    pending?.action();
  }, [pendingNavigation]);

  const saveAndContinue = useCallback(async () => {
    if (!pendingNavigation || navigationSaving) return;
    setNavigationSaving(true);
    const saved = await saveCurrent();
    setNavigationSaving(false);
    // a failed or cancelled save keeps the current note open (F04)
    if (!saved) return;
    const pending = pendingNavigation;
    setPendingNavigation(null);
    pending.action();
  }, [pendingNavigation, navigationSaving, saveCurrent]);

  const cancelNavigation = useCallback(() => {
    if (pendingNavigation?.quit) void invoke("cancel_quit").catch(() => undefined);
    setPendingNavigation(null);
  }, [pendingNavigation]);

  // ---- open / folders ------------------------------------------------------
  const handleOpenFolder = useCallback(async () => {
    const folder = await pickFolder();
    if (folder) {
      setRootPath(folder);
      setNavSection({ kind: "all" });
    }
  }, [setRootPath]);

  const handleOpenFile = useCallback(async () => {
    const file = await pickMarkdownFile();
    if (file) openNote(file);
  }, [openNote]);

  // file passed on the command line (Windows double click / "Open with") (R04)
  useEffect(() => {
    void invoke<string | null>("take_launch_file")
      .then((path) => {
        if (path) openNote(path);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<string>("marknote:open-file", (event) => {
      const path = event.payload;
      if (typeof path === "string" && path.length > 0) openNote(path);
    }).then((un) => {
      unlisten = un;
    });
    return () => unlisten?.();
  }, [openNote]);

  // tray "Çık" (R03): flush the recovery draft, then ask about unsaved work
  const flushRecoveryRef = useRef(flushRecovery);
  flushRecoveryRef.current = flushRecovery;
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen("marknote:quit-requested", () => {
      void (async () => {
        await flushRecoveryRef.current();
        if (!dirtyRef.current) {
          void invoke("quit_app");
          return;
        }
        setPendingNavigation({ action: () => void invoke("quit_app"), quit: true });
      })();
    }).then((un) => {
      unlisten = un;
    });
    return () => unlisten?.();
  }, []);

  // ---- reveal a search match after opening ----------------------------------
  useEffect(() => {
    if (!pendingReveal) return;
    const match = pendingReveal;
    const id = window.requestAnimationFrame(() => {
      setPendingReveal(null);
      if (viewMode === "write" && richRef.current?.revealText(match)) return;
      const idx = sourceRef.current.toLocaleLowerCase("tr").indexOf(match.toLocaleLowerCase("tr"));
      if (idx >= 0) {
        if (viewMode === "write" || viewMode === "read") setViewMode("markdown");
        window.requestAnimationFrame(() => mdEditorRef.current?.selectRange({ from: idx, to: idx + match.length }));
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [pendingReveal, docId, viewMode]);

  // ---- misc effects ----------------------------------------------------------
  useEffect(() => {
    setTranslatedSource(null);
  }, [docId]);

  useEffect(() => {
    if (secureStorageError) setLoadError({ message: secureStorageError });
  }, [secureStorageError, setLoadError]);

  useEffect(() => {
    let cancelled = false;
    void getVersion()
      .then((version) => {
        if (cancelled) return;
        const lastSeen = window.localStorage.getItem(STORAGE_KEYS.lastSeenVersion);
        if (lastSeen && lastSeen !== version) setWhatsNewVersion(version);
        window.localStorage.setItem(STORAGE_KEYS.lastSeenVersion, version);
      })
      .catch((err) => console.warn("marknote: version check failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useSyncScroll({ rebindKey: `${activePath ?? "new"}:${viewMode}` });

  const [findOpen, setFindOpen] = useState(false);
  const [proseEl, setProseEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (viewMode !== "read") {
      setProseEl(null);
      setFindOpen(false);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      setProseEl(document.querySelector<HTMLElement>(".mdv-doc-read .mdv-prose"));
    });
    return () => window.cancelAnimationFrame(id);
  }, [viewMode]);

  const copyMarkdown = useCallback(() => copyMarkdownCore(sourceRef.current), [copyMarkdownCore]);
  const debouncedPreview = useDebouncedValue(source, 50);

  const { words, minutes, docTokens } = useMemo(() => {
    const trimmed = source.trim();
    const w = trimmed.length ? trimmed.split(/\s+/).length : 0;
    return { words: w, minutes: Math.max(1, Math.round(w / 220)), docTokens: techCounters ? estimateTokens(source) : 0 };
  }, [source, techCounters]);

  const headings = useMemo(() => (inspectorOpen ? extractHeadings(source) : []), [source, inspectorOpen]);
  const markdownIssues = useMemo(() => (inspectorOpen ? lintMarkdown(source) : []), [source, inspectorOpen]);
  const hasTextSelection = selectionRange.from !== selectionRange.to;

  const handleEditorSelectionChange = useCallback((range: TextRange) => {
    setSelectionRange((prev) => (prev.from === range.from && prev.to === range.to ? prev : range));
    setAiSelectionScope(range.from !== range.to);
  }, []);

  const handleMarkdownAction = useCallback((action: MarkdownAction) => {
    const selection = mdEditorRef.current?.getSelection() ?? { from: source.length, to: source.length };
    const edit = applyMarkdownAction(source, selection, action, {
      textColor: editorTextColor,
      highlightColor: editorHighlightColor,
    });
    setTranslatedSource(null);
    mdEditorRef.current?.replaceRange(edit.range, edit.insert, edit.selection);
  }, [editorHighlightColor, editorTextColor, source]);

  // null on teardown: the toolbar must never hold a destroyed editor (F02)
  const handleRichEditorReady = useCallback((editor: TiptapEditor | null) => setRichEditor(editor), []);

  const appStyle = useMemo(() => ({
    "--mdv-user-text-color": editorTextColor,
    "--mdv-user-highlight-color": editorHighlightColor,
    "--mdv-secret-hidden-color": secretHiddenColor,
    "--mdv-secret-hidden-bg": secretHiddenBg,
    "--mdv-secret-revealed-color": secretRevealedColor,
    "--mdv-secret-revealed-bg": secretRevealedBg,
  }) as CSSProperties, [editorTextColor, editorHighlightColor, secretHiddenColor, secretHiddenBg, secretRevealedColor, secretRevealedBg]);

  const handleInsertTemplate = useCallback((kind: "note" | "readme" | "prompt") => {
    const selection = mdEditorRef.current?.getSelection() ?? { from: source.length, to: source.length };
    const edit = insertTemplate(source, selection, kind);
    setTranslatedSource(null);
    mdEditorRef.current?.replaceRange(edit.range, edit.insert, edit.selection);
  }, [source]);

  // ---- history restore -------------------------------------------------------
  const handleRestoreVersion = useCallback(async (entry: HistoryEntry) => {
    // never apply another note's version to this one (F11)
    if (!samePath(entry.path, activePath) && !(entry.path == null && activePath == null)) {
      setHistoryError("Bu sürüm başka bir nota ait; uygulanmadı.");
      return;
    }
    setHistoryBusy(true);
    try {
      const full = await readVersion(entry.id);
      // keep what is on screen now before replacing it
      if (!(await saveCurrentVersion("Geri yüklemeden önce"))) return;
      setSource(full.source);
      setHistoryOpen(false);
      showInfo({ message: `"${entry.label}" sürümü geri yüklendi. Kalıcı olması için kaydedin.` });
    } catch (err) {
      setHistoryError(`Sürüm geri yüklenemedi - ${String(err)}`);
    } finally {
      setHistoryBusy(false);
    }
  }, [activePath, saveCurrentVersion, setSource, showInfo]);

  const handleDeleteVersion = useCallback(async (entry: HistoryEntry) => {
    setHistoryBusy(true);
    try {
      await deleteVersion(entry.id);
      await refreshHistory();
    } catch (err) {
      setHistoryError(`Sürüm silinemedi - ${String(err)}`);
    } finally {
      setHistoryBusy(false);
    }
  }, [refreshHistory]);

  // ---- AI (F06 + privacy) ----------------------------------------------------
  const translateReady = secureStorageReady && openrouterKey.length > 0 && openrouterModel.length > 0;
  const aiTooltip = !openrouterKey
    ? "Ayarlar'dan OpenRouter API anahtarı ekleyin"
    : !openrouterModel
      ? "Ayarlar'dan bir model seçin"
      : undefined;
  const [aiJob, setAiJob] = useState<AiJob | null>(null);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [secretPrompt, setSecretPrompt] = useState<{ kind: AiKind; range: TextRange; text: string; count: number } | null>(null);

  const aiTargetRange = useCallback((): TextRange => {
    if (hasTextSelection && aiSelectionScope && viewMode !== "write") return selectionRange;
    return { from: 0, to: source.length };
  }, [aiSelectionScope, hasTextSelection, selectionRange, source.length, viewMode]);

  const targetLanguage = LANGUAGES.find((lang) => lang.code === translateTargetLang)?.label ?? translateTargetLang;

  const runAi = useCallback(async (kind: AiKind, range: TextRange, original: string, mask: boolean) => {
    const masked = mask ? maskSecretsInText(original) : null;
    const payload = masked ? masked.text : original;
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, AI_TIMEOUT_MS);
    const label = kind === "proofread" ? "AI düzeltiyor…" : kind === "promptify" ? "Prompta dönüştürülüyor…" : "Çevriliyor…";
    const job: AiJob = { kind, label, docId: docIdRef.current, controller };
    setAiJob(job);
    try {
      const common = { apiKey: openrouterKey, model: openrouterModel, source: payload, signal: controller.signal };
      let result: string;
      if (kind === "proofread") result = await proofreadMarkdown({ ...common, systemPrompt: proofreadPrompt });
      else if (kind === "promptify") result = await promptifyMarkdown({ ...common, systemPrompt: promptifyPrompt });
      else result = await translateMarkdown({ ...common, targetLang: translateTargetLang, systemPrompt: translatePrompt });
      if (masked) result = masked.restore(result);
      // the user moved to another note while waiting: never apply there
      if (job.docId !== docIdRef.current) {
        showInfo({ message: "AI sonucu başka bir nota ait olduğu için gösterilmedi." });
        return;
      }
      if (kind === "translate" && result.trim() === original.trim()) {
        setLoadError({ message: `Çeviri değişiklik üretmedi - hedef dil ${targetLanguage}; gerekirse Ayarlar'dan değiştirin.` });
        return;
      }
      const title = kind === "proofread" ? "AI düzeltme" : kind === "promptify" ? "AI prompt" : `AI çeviri (${targetLanguage})`;
      setAiReview({ title, original, next: result, range, docId: job.docId });
    } catch (err) {
      if (controller.signal.aborted) {
        showInfo({ message: timedOut ? "AI isteği zaman aşımına uğradı (90 sn). Tekrar deneyin." : "AI isteği iptal edildi." });
      } else {
        setLoadError({ message: `AI isteği başarısız - ${String(err)}` });
      }
    } finally {
      window.clearTimeout(timer);
      setAiJob((current) => (current === job ? null : current));
    }
  }, [openrouterKey, openrouterModel, proofreadPrompt, promptifyPrompt, translatePrompt, translateTargetLang, targetLanguage, setLoadError, showInfo]);

  const startAi = useCallback((kind: AiKind, rangeOverride?: TextRange) => {
    if (!translateReady) {
      setLoadError({ message: aiTooltip ?? "AI ayarlı değil" });
      return;
    }
    if (aiJob) return;
    const range = rangeOverride ?? aiTargetRange();
    const text = source.slice(range.from, range.to);
    if (!text.trim()) return;
    if (text.length > AI_MAX_CHARS) {
      setLoadError({ message: `AI için metin çok uzun (${text.length.toLocaleString("tr-TR")} karakter). Markdown görünümünde bir bölüm seçin.` });
      return;
    }
    const masked = maskSecretsInText(text);
    if (masked.count > 0) {
      setSecretPrompt({ kind, range, text, count: masked.count });
      return;
    }
    void runAi(kind, range, text, false);
  }, [translateReady, aiTooltip, aiJob, aiTargetRange, source, runAi, setLoadError]);

  const applyAiReview = useCallback(() => {
    const review = aiReview;
    if (!review) return;
    setAiReview(null);
    if (review.docId !== docIdRef.current) {
      setLoadError({ message: "AI sonucu başka bir nota ait; uygulanmadı." });
      return;
    }
    const current = sourceRef.current;
    let range = review.range;
    if (current.slice(range.from, range.to) !== review.original) {
      // text changed while waiting: re-anchor only on an unambiguous match
      const first = current.indexOf(review.original);
      const second = first >= 0 ? current.indexOf(review.original, first + 1) : -1;
      if (first < 0 || second >= 0) {
        setLoadError({ message: "Metin AI isteğinden sonra değişti; sonuç güvenle uygulanamıyor. Lütfen yeniden çalıştırın." });
        return;
      }
      range = { from: first, to: first + review.original.length };
    }
    void saveVersion(activePath, current, `${review.title} öncesi`).catch((err) => console.warn("marknote: pre-ai version failed", err));
    setTranslatedSource(null);
    setSource(`${current.slice(0, range.from)}${review.next}${current.slice(range.to)}`);
  }, [aiReview, activePath, setSource, setLoadError]);

  const handlePreviewTranslate = useCallback(async () => {
    if (!translateReady || previewTranslating) return;
    const startDoc = docIdRef.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    setPreviewTranslating(true);
    try {
      const masked = maskSecretsInText(sourceRef.current);
      const translated = await translateMarkdown({
        apiKey: openrouterKey,
        model: openrouterModel,
        targetLang: translateTargetLang,
        source: masked.text,
        systemPrompt: translatePrompt,
        signal: controller.signal,
      });
      if (startDoc === docIdRef.current) setTranslatedSource(masked.restore(translated));
    } catch (err) {
      if (!controller.signal.aborted) setLoadError({ message: `Çeviri başarısız - ${String(err)}` });
    } finally {
      window.clearTimeout(timer);
      setPreviewTranslating(false);
    }
  }, [translateReady, previewTranslating, openrouterKey, openrouterModel, translateTargetLang, translatePrompt, setLoadError]);

  // ---- trash flows (F08) -------------------------------------------------------
  const trashPath = useCallback(async (path: string, isDir: boolean) => {
    try {
      const item = await moveToTrash(path);
      if (isSameOrChildPath(activePath, path)) {
        // keep unsaved text as a new note; a clean note simply closes
        if (dirtyRef.current) detachFromFile();
        else startNewBuffer();
      }
      setPinned((list) => list.filter((p) => !isSameOrChildPath(p, path)));
      setRecentFiles((list) => list.filter((p) => !isSameOrChildPath(p, path)));
      setNavSection((s) => (s.kind === "folder" && isSameOrChildPath(s.path, path) ? { kind: "all" } : s));
      bumpTree();
      refreshTrash();
      showInfo({
        message: `${isDir ? "Klasör" : "Not"} çöp kutusuna taşındı: ${item.name}`,
        action: {
          label: "Geri al",
          onClick: () => {
            void restoreFromTrash(item.id)
              .then(() => {
                bumpTree();
                refreshTrash();
              })
              .catch((err) => setLoadError({ message: `Geri alınamadı - ${String(err)}` }));
          },
        },
      }, 6000);
    } catch (err) {
      setLoadError({ message: `Çöp kutusuna taşınamadı - ${String(err)}` });
    }
  }, [activePath, detachFromFile, startNewBuffer, setPinned, setRecentFiles, bumpTree, refreshTrash, showInfo, setLoadError]);

  const requestTrash = useCallback((path: string, isDir: boolean) => {
    if (!isDir) {
      void trashPath(path, false);
      return;
    }
    const inside = noteIndex?.notes.filter((n) => isSameOrChildPath(n.path, path)).length ?? 0;
    setConfirmState({
      title: `"${basename(path)}" klasörü çöp kutusuna taşınsın mı?`,
      body: `Klasör, içindeki ${inside} not ve tüm alt klasörleriyle birlikte çöp kutusuna taşınır. Çöp kutusundan geri yükleyebilirsiniz.`,
      confirmLabel: "Çöp kutusuna taşı",
      destructive: true,
      onConfirm: () => void trashPath(path, true),
    });
  }, [noteIndex, trashPath]);

  const handleRestoreTrash = useCallback(async (item: TrashItem) => {
    try {
      const restored = await restoreFromTrash(item.id);
      bumpTree();
      refreshTrash();
      const renamed = basename(restored) !== item.name;
      showInfo({
        message: renamed
          ? `Aynı adda dosya olduğu için "${basename(restored)}" olarak geri yüklendi.`
          : `${item.name} geri yüklendi.`,
        action: item.isDir ? undefined : { label: "Aç", onClick: () => openNote(restored) },
      }, 6000);
    } catch (err) {
      setLoadError({ message: `Geri yüklenemedi - ${String(err)}` });
    }
  }, [bumpTree, refreshTrash, showInfo, openNote, setLoadError]);

  const handleDeleteForever = useCallback((item: TrashItem) => {
    setConfirmState({
      title: `"${item.name}" kalıcı olarak silinsin mi?`,
      body: "Bu işlem geri alınamaz.",
      confirmLabel: "Kalıcı olarak sil",
      destructive: true,
      onConfirm: () => {
        void deleteFromTrash(item.id)
          .then(refreshTrash)
          .catch((err) => setLoadError({ message: `Silinemedi - ${String(err)}` }));
      },
    });
  }, [refreshTrash, setLoadError]);

  const handleEmptyTrash = useCallback(() => {
    setConfirmState({
      title: "Çöp kutusu boşaltılsın mı?",
      body: `${trashItems.length} öğe kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmLabel: "Çöp kutusunu boşalt",
      destructive: true,
      onConfirm: () => {
        void emptyTrash()
          .then(refreshTrash)
          .catch((err) => setLoadError({ message: `Boşaltılamadı - ${String(err)}` }));
      },
    });
  }, [trashItems.length, refreshTrash, setLoadError]);

  const togglePin = useCallback((path: string) => {
    setPinned((list) => (list.some((p) => samePath(p, path)) ? list.filter((p) => !samePath(p, path)) : [path, ...list]));
  }, [setPinned]);

  const requestRename = useCallback((path: string) => {
    setPromptState({
      title: "Yeniden adlandır",
      label: "Yeni ad",
      initialValue: basename(path),
      confirmLabel: "Yeniden adlandır",
      onSubmit: (name) => void handleSubmitRename(path, name),
    });
  }, [handleSubmitRename]);

  const requestNewFolder = useCallback((parent: string) => {
    setPromptState({
      title: "Yeni klasör",
      label: "Klasör adı",
      initialValue: "",
      confirmLabel: "Oluştur",
      onSubmit: (name) => void handleSubmitNew(parent, "folder", name),
    });
  }, [handleSubmitNew]);

  // ---- note list data ------------------------------------------------------------
  const listItems = useMemo<NoteListItem[]>(() => {
    const notes = noteIndex?.notes ?? [];
    const byPath = new Map(notes.map((n) => [n.path, n]));
    const toItem = (path: string): NoteListItem => {
      const n = byPath.get(path) ?? notes.find((x) => samePath(x.path, path));
      const dir = relativeTo(rootPath, dirname(path));
      return {
        path,
        title: n?.title ?? basename(path).replace(/\.(md|markdown|mdx|txt)$/i, ""),
        excerpt: n?.excerpt ?? (rootPath && isSameOrChildPath(path, rootPath) ? "" : dirname(path)),
        mtime: n?.mtime ?? null,
        folder: n ? (dir === path ? "" : dir.replace(/\//g, " / ")) : "",
        pinned: pinned.some((p) => samePath(p, path)),
      };
    };
    if (navSection.kind === "recent") return recentFiles.map(toItem);
    if (navSection.kind === "pinned") return pinned.map(toItem);
    const scope = navSection.kind === "folder" ? notes.filter((n) => isSameOrChildPath(n.path, navSection.path)) : notes;
    return [...scope]
      .sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
      .map((n) => toItem(n.path))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [noteIndex, navSection, recentFiles, pinned, rootPath]);

  const searchResult = useMemo(() => {
    if (!debouncedQuery.trim() || !noteIndex) return null;
    const scope = navSection.kind === "folder" ? noteIndex.notes.filter((n) => isSameOrChildPath(n.path, navSection.path)) : noteIndex.notes;
    return searchNotes(scope, debouncedQuery);
  }, [debouncedQuery, noteIndex, navSection]);

  const listNotices = useMemo(() => {
    const out: string[] = [];
    if (noteIndex?.truncatedFiles) out.push("Klasördeki ilk 5000 dosya gösteriliyor");
    if (noteIndex && noteIndex.problems.length) out.push(`${noteIndex.problems.length} dosya okunamadı`);
    if (searchResult?.limited) out.push("İlk 200 sonuç gösteriliyor");
    if (searchResult && searchResult.skippedLarge) out.push(`${searchResult.skippedLarge} büyük dosyanın içeriği aranmadı`);
    return out;
  }, [noteIndex, searchResult]);

  const listHeading =
    navSection.kind === "all" ? "Tüm notlar"
      : navSection.kind === "recent" ? "Son açılanlar"
        : navSection.kind === "pinned" ? "Sabitlenenler"
          : navSection.kind === "trash" ? "Çöp kutusu"
            : basename(navSection.path);
  const listEmptyText =
    navSection.kind === "pinned" ? "Sabitlenmiş not yok. Bir notu sağ tıklayıp Sabitle'yi seçin."
      : navSection.kind === "recent" ? "Henüz açılmış not yok."
        : navSection.kind === "folder" ? "Bu klasörde not yok."
          : "Bu klasörde henüz not yok. Yeni not ile başlayın.";

  const selectSection = useCallback((section: NavSection) => {
    setNavSection(section);
    setQuery("");
    if (section.kind === "trash") refreshTrash();
    if (navCollapsed) setNavDrawer(false);
    if (listCollapsed) setListDrawer(true);
  }, [refreshTrash, navCollapsed, listCollapsed]);

  const selectFromList = useCallback((path: string, match?: string) => {
    openNote(path, match);
    if (listCollapsed) setListDrawer(false);
  }, [openNote, listCollapsed]);

  const focusSearch = useCallback(() => {
    setFocusMode(false);
    if (listCollapsed) setListDrawer(true);
    if (navSection.kind === "trash") setNavSection({ kind: "all" });
    window.requestAnimationFrame(() => document.getElementById("mdv-note-search")?.focus());
  }, [listCollapsed, navSection.kind]);

  // ---- context menus -----------------------------------------------------------------
  const handleRowContextMenu = useCallback((e: ReactMouseEvent, path: string) => {
    setRowMenu({ x: e.clientX, y: e.clientY, path, isDir: false });
  }, []);
  const handleFolderContextMenu = useCallback((e: ReactMouseEvent, entry: FileEntry) => {
    setRowMenu({ x: e.clientX, y: e.clientY, path: entry.path, isDir: entry.isDir, isRoot: samePath(entry.path, rootPath) });
  }, [rootPath]);

  const rowMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!rowMenu) return [];
    const { path, isDir, isRoot } = rowMenu;
    if (isDir) {
      const items: ContextMenuItem[] = [
        { label: "Bu klasörde yeni not", icon: PenLine, onSelect: () => newNote(path) },
        { label: "Yeni alt klasör", icon: FolderPlus, onSelect: () => requestNewFolder(path) },
      ];
      // the workspace root itself is switched, not renamed or trashed
      if (!isRoot) items.push({ label: "Yeniden adlandır", onSelect: () => requestRename(path) });
      items.push({ label: IS_MAC ? "Finder'da göster" : "Dosya Gezgini'nde göster", icon: FolderInput, onSelect: () => void openPath(path) });
      if (isRoot) items.push({ label: "Başka klasör aç", icon: FolderOpen, onSelect: () => void handleOpenFolder() });
      else items.push("divider", { label: "Çöp kutusuna taşı", icon: Trash2, destructive: true, onSelect: () => requestTrash(path, true) });
      return items;
    }
    const isPinned = pinned.some((p) => samePath(p, path));
    return [
      { label: "Aç", onSelect: () => openNote(path) },
      { label: isPinned ? "Sabitlemeyi kaldır" : "Sabitle", icon: isPinned ? PinOff : Pin, onSelect: () => togglePin(path) },
      { label: "Yeniden adlandır", onSelect: () => requestRename(path) },
      "divider",
      { label: IS_MAC ? "Finder'da göster" : "Dosya Gezgini'nde göster", icon: FolderInput, onSelect: () => void openPath(dirname(path)) },
      { label: "Varsayılan uygulamada aç", onSelect: () => void openPath(path) },
      "divider",
      { label: "Çöp kutusuna taşı", icon: Trash2, destructive: true, onSelect: () => requestTrash(path, false) },
    ];
  }, [rowMenu, pinned, newNote, requestNewFolder, requestRename, requestTrash, openNote, togglePin, handleOpenFolder]);

  const exportToPdf = useCallback(async () => {
    try {
      await exportPreviewToPdf({ source: sourceRef.current, activePath, profile: exportProfile });
    } catch (err) {
      const message = err instanceof PdfExportError ? err.message : "PDF'e aktarılamadı";
      console.error("marknote: pdf export failed", err);
      setLoadError({ message });
    }
  }, [activePath, exportProfile, setLoadError]);

  const exportToHtml = useCallback(async () => {
    try {
      const target = await exportPreviewToHtml({ source: sourceRef.current, activePath, profile: exportProfile });
      if (target) showInfo({ message: `${basename(target)} dışa aktarıldı` }, 2400);
    } catch (err) {
      setLoadError({ message: err instanceof Error ? err.message : "HTML dışa aktarılamadı" });
    }
  }, [activePath, exportProfile, showInfo, setLoadError]);

  const toggleFullscreen = useCallback(async () => {
    const win = getCurrentWindow();
    try {
      await win.setFullscreen(!(await win.isFullscreen()));
    } catch (err) {
      console.error("marknote: fullscreen toggle failed", err);
    }
  }, []);

  const toggleFocus = useCallback(() => setFocusMode((v) => !v), []);

  const docMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!docMenu) return [];
    const check = (mode: ViewMode) => (viewMode === mode ? "seçili" : undefined);
    const aiDisabled = !translateReady || aiJob != null || !source.trim();
    const items: ContextMenuItem[] = [
      { label: "Kaydet", icon: Save, hint: IS_MAC ? "⌘S" : "Ctrl+S", onSelect: () => void saveCurrent() },
      { label: "Farklı kaydet…", onSelect: () => void saveAs() },
      { label: "Sürüm geçmişi…", icon: History, onSelect: openHistory },
      "divider",
      { label: `Görünüm: ${VIEW_LABELS.write}`, icon: PenLine, hint: check("write"), onSelect: () => setViewMode("write") },
      { label: `Görünüm: ${VIEW_LABELS.markdown}`, icon: FileCode2, hint: check("markdown"), onSelect: () => setViewMode("markdown") },
      { label: `Görünüm: ${VIEW_LABELS.split}`, icon: Columns2, hint: check("split"), onSelect: () => setViewMode("split") },
      { label: `Görünüm: ${VIEW_LABELS.read}`, icon: BookOpen, hint: check("read"), onSelect: () => setViewMode("read") },
      { label: focusMode ? "Odak modundan çık" : "Odak modu", icon: Maximize2, onSelect: toggleFocus },
      "divider",
      { label: "Markdown'ı kopyala", icon: Copy, onSelect: () => void copyMarkdown() },
      { label: "PDF olarak dışa aktar", icon: FileDown, onSelect: () => void exportToPdf() },
      { label: "HTML olarak dışa aktar", icon: FileDown, onSelect: () => void exportToHtml() },
      "divider",
      { label: "AI ile düzelt", icon: CheckCheck, hint: aiTooltip, disabled: aiDisabled, onSelect: () => startAi("proofread") },
      { label: `AI ile çevir (${targetLanguage})`, icon: Languages, hint: aiTooltip, disabled: aiDisabled, onSelect: () => startAi("translate") },
      { label: "Prompta dönüştür", icon: WandSparkles, hint: aiTooltip, disabled: aiDisabled, onSelect: () => startAi("promptify") },
      { label: "Geliştirici araçları", icon: Settings2, onSelect: () => setDeveloperToolsOpen(true) },
    ];
    if (activePath) {
      const isPinned = pinned.some((p) => samePath(p, activePath));
      items.push(
        "divider",
        { label: isPinned ? "Sabitlemeyi kaldır" : "Sabitle", icon: isPinned ? PinOff : Pin, onSelect: () => togglePin(activePath) },
        { label: IS_MAC ? "Finder'da göster" : "Dosya Gezgini'nde göster", icon: FolderInput, onSelect: () => void openPath(dirname(activePath)) },
        { label: "Çöp kutusuna taşı", icon: Trash2, destructive: true, onSelect: () => requestTrash(activePath, false) },
      );
    }
    return items;
  }, [docMenu, viewMode, translateReady, aiJob, source, saveCurrent, saveAs, openHistory, focusMode, toggleFocus, copyMarkdown, exportToPdf, exportToHtml, aiTooltip, startAi, targetLanguage, activePath, pinned, togglePin, requestTrash]);

  const handleEditorContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const selection = mdEditorRef.current?.getSelection() ?? { from: 0, to: 0 };
    const hasSelection = selection.from !== selection.to;
    setSelectionRange(selection);
    setAiSelectionScope(hasSelection);
    setEditorContextMenu({ x: e.clientX, y: e.clientY, range: hasSelection ? selection : { from: 0, to: source.length }, hasSelection });
  }, [source.length]);

  const handleRichContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sel = richEditor && !richEditor.isDestroyed ? richEditor.state.selection : null;
    setRichContextMenu({ x: e.clientX, y: e.clientY, hasSelection: sel ? sel.from !== sel.to : false });
  }, [richEditor]);

  const richContextItems = useMemo<ContextMenuItem[]>(() => {
    if (!richContextMenu) return [];
    const { hasSelection } = richContextMenu;
    const editor = richEditor && !richEditor.isDestroyed ? richEditor : null;
    const wholeFile: TextRange = { from: 0, to: source.length };
    const aiDisabled = !translateReady || aiJob != null || !source.trim();
    const selectedText = () => {
      if (!editor) return "";
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, "\n");
    };
    return [
      { label: "Kopyala", icon: Copy, disabled: !hasSelection, onSelect: () => { const t = selectedText(); if (t) void navigator.clipboard.writeText(t); } },
      {
        label: "Kes",
        icon: Scissors,
        disabled: !hasSelection || !richSafe,
        onSelect: () => {
          const t = selectedText();
          if (t) void navigator.clipboard.writeText(t);
          editor?.chain().focus().deleteSelection().run();
        },
      },
      {
        label: "Yapıştır",
        icon: Clipboard,
        disabled: !richSafe,
        onSelect: () => {
          void navigator.clipboard.readText().then((text) => {
            if (text) editor?.chain().focus().insertContent(text).run();
          });
        },
      },
      { label: "Tümünü seç", icon: TextCursorInput, onSelect: () => editor?.chain().focus().selectAll().run() },
      "divider",
      { label: "AI ile düzelt", icon: CheckCheck, hint: "tüm not", disabled: aiDisabled, onSelect: () => startAi("proofread", wholeFile) },
      { label: "Prompta dönüştür", icon: WandSparkles, hint: "tüm not", disabled: aiDisabled, onSelect: () => startAi("promptify", wholeFile) },
      { label: "Çevir", icon: Languages, hint: `${targetLanguage} · tüm not`, disabled: aiDisabled, onSelect: () => startAi("translate", wholeFile) },
    ];
  }, [richContextMenu, richEditor, richSafe, source, translateReady, aiJob, startAi, targetLanguage]);

  const replaceEditorRange = useCallback((range: TextRange, text: string) => {
    setTranslatedSource(null);
    mdEditorRef.current?.replaceRange(range, text, { from: range.from + text.length, to: range.from + text.length });
  }, []);

  const editorContextItems = useMemo<ContextMenuItem[]>(() => {
    if (!editorContextMenu) return [];
    const { range, hasSelection } = editorContextMenu;
    const targetRange = hasSelection ? range : { from: 0, to: source.length };
    const selectedText = hasSelection ? source.slice(range.from, range.to) : "";
    const aiHint = hasSelection ? "seçim" : "tüm not";
    const aiDisabled = !translateReady || aiJob != null || !source.trim();
    return [
      { label: "Kopyala", icon: Copy, disabled: !hasSelection, onSelect: () => { if (selectedText) void navigator.clipboard.writeText(selectedText); } },
      {
        label: "Kes",
        icon: Scissors,
        disabled: !hasSelection,
        onSelect: () => {
          if (selectedText) void navigator.clipboard.writeText(selectedText);
          replaceEditorRange(range, "");
        },
      },
      {
        label: "Yapıştır",
        icon: Clipboard,
        onSelect: () => {
          void navigator.clipboard.readText().then((text) => {
            if (text) replaceEditorRange(hasSelection ? range : selectionRange, text);
          });
        },
      },
      {
        label: "Tümünü seç",
        icon: TextCursorInput,
        onSelect: () => {
          const full = { from: 0, to: source.length };
          setSelectionRange(full);
          setAiSelectionScope(source.length > 0);
          mdEditorRef.current?.selectRange(full);
        },
      },
      "divider",
      { label: "AI ile düzelt", icon: CheckCheck, hint: aiHint, disabled: aiDisabled, onSelect: () => startAi("proofread", targetRange) },
      { label: "Prompta dönüştür", icon: WandSparkles, hint: aiHint, disabled: aiDisabled, onSelect: () => startAi("promptify", targetRange) },
      { label: "Çevir", icon: Languages, hint: `${targetLanguage} · ${aiHint}`, disabled: aiDisabled, onSelect: () => startAi("translate", targetRange) },
      {
        label: hasSelection ? "AI için seçimi kullan" : "AI tüm notu kullanır",
        icon: MousePointer2,
        disabled: !hasSelection,
        onSelect: () => setAiSelectionScope(true),
      },
    ];
  }, [editorContextMenu, source, translateReady, aiJob, startAi, targetLanguage, replaceEditorRange, selectionRange]);

  // ---- OS file drop -----------------------------------------------------------------
  useEffect(() => {
    let enterCount = 0;
    const isOsFileDrag = (e: DragEvent) => {
      if (!e.dataTransfer) return false;
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
        reset();
        return;
      }
      e.preventDefault();
      reset();
      const files = Array.from(e.dataTransfer?.files ?? []);
      const firstMd = files.find((f) => isEditablePath(f.name));
      if (firstMd) {
        try {
          const text = await firstMd.text();
          // the webview doesn't expose the path: open as a new unsaved note,
          // through the same unsaved-changes guard (F04)
          continueNavigation(() => {
            setNewNoteFolder(null);
            startNewBuffer(text);
          });
        } catch (err) {
          console.error("marknote: file drop read failed", err);
          setLoadError({ message: `${firstMd.name} okunamadı - ${err}` });
        }
      } else if (files.length > 0) {
        setLoadError({ message: "Yalnız .md / .markdown / .mdx / .txt / .env dosyaları açılabilir" });
      }
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
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
  }, [continueNavigation, startNewBuffer, setLoadError]);

  // ---- shortcuts -----------------------------------------------------------------
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
      "mod+s": (e: KeyboardEvent) => {
        e.preventDefault();
        void saveCurrent();
      },
      "mod+shift+s": (e: KeyboardEvent) => {
        e.preventDefault();
        void saveAs();
      },
      "mod+n": (e: KeyboardEvent) => {
        e.preventDefault();
        newNote();
      },
      "mod+o": (e: KeyboardEvent) => {
        e.preventDefault();
        void handleOpenFile();
      },
      "mod+shift+o": (e: KeyboardEvent) => {
        e.preventDefault();
        void handleOpenFolder();
      },
      "mod+shift+f": (e: KeyboardEvent) => {
        e.preventDefault();
        focusSearch();
      },
      "mod+shift+c": (e: KeyboardEvent) => {
        e.preventDefault();
        void copyMarkdown();
      },
      "mod+p": (e: KeyboardEvent) => {
        e.preventDefault();
        void exportToPdf();
      },
      "mod+ctrl+f": (e: KeyboardEvent) => {
        e.preventDefault();
        void toggleFullscreen();
      },
      "mod+.": (e: KeyboardEvent) => {
        e.preventDefault();
        setViewMode((v) => (v === "read" ? "write" : "read"));
      },
      "mod+shift+.": (e: KeyboardEvent) => {
        e.preventDefault();
        toggleFocus();
      },
      escape: (e: KeyboardEvent) => {
        if (viewMode === "read") {
          e.preventDefault();
          setViewMode("write");
        } else if (focusMode) {
          e.preventDefault();
          setFocusMode(false);
        }
      },
      ...(viewMode === "read"
        ? {
            "mod+f": (e: KeyboardEvent) => {
              e.preventDefault();
              setFindOpen(true);
            },
          }
        : {}),
    }),
    [setPaletteOpen, setHelpOpen, saveCurrent, saveAs, newNote, handleOpenFile, handleOpenFolder, focusSearch, copyMarkdown, exportToPdf, toggleFullscreen, toggleFocus, viewMode, focusMode],
  );
  useShortcuts(shortcuts);

  const commands = useMemo(
    () =>
      buildCommands({
        newFile: () => newNote(),
        openFile: handleOpenFile,
        openFolder: handleOpenFolder,
        save: () => void saveCurrent(),
        saveAs: () => void saveAs(),
        search: focusSearch,
        toggleFocus,
        setView: setViewMode,
        showHistory: openHistory,
        showHelp,
        showAbout,
        showSettings: () => setSettingsOpen(true),
        showDeveloperTools: () => setDeveloperToolsOpen(true),
        undoFileOp: handleUndoFileOp,
        checkForUpdates: handleManualUpdateCheck,
        copyMarkdown,
        exportToPdf: () => void exportToPdf(),
        toggleFullscreen,
        openRecent: (path: string) => openNote(path),
        recentFiles,
        hasActivePath: activePath != null,
        focusMode,
        viewMode,
      }),
    [newNote, handleOpenFile, handleOpenFolder, saveCurrent, saveAs, focusSearch, toggleFocus, openHistory, showHelp, showAbout, handleUndoFileOp, handleManualUpdateCheck, copyMarkdown, exportToPdf, toggleFullscreen, openNote, recentFiles, activePath, focusMode, viewMode],
  );

  // ---- editor surfaces ------------------------------------------------------------
  const switchToSource = useCallback(() => setViewMode("markdown"), []);

  const richWorkspace = (
    <div className="mdv-doc-write">
      <RichToolbar
        editor={richEditor}
        readOnly={!richSafe}
        textColor={editorTextColor}
        highlightColor={editorHighlightColor}
        secretsPresent={sourceHasSecrets(source)}
        secretsHidden={secretsHidden}
        onToggleSecrets={toggleSecrets}
      />
      <div className="mdv-doc-scroll">
        <div className="mdv-doc-page">
          <RichEditor
            ref={richRef}
            value={source}
            onChange={setSource}
            secretsHidden={secretsHidden}
            onEditorReady={handleRichEditorReady}
            onContextMenu={handleRichContextMenu}
            onRequestSource={switchToSource}
            onCompatibilityChange={setRichSafe}
          />
        </div>
      </div>
    </div>
  );

  const markdownWorkspace = (
    <div className="mdv-editor-workspace">
      <MarkdownToolbar
        onAction={handleMarkdownAction}
        onTemplate={handleInsertTemplate}
        onSnapshot={() => void saveCurrentVersion().then((ok) => ok && showInfo({ message: "Sürüm kaydedildi" }, 2000))}
        onShowSnapshots={openHistory}
        onUndo={() => {
          setTranslatedSource(null);
          mdEditorRef.current?.undo();
        }}
        onRedo={() => {
          setTranslatedSource(null);
          mdEditorRef.current?.redo();
        }}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((v) => !v)}
        textColor={editorTextColor}
        highlightColor={editorHighlightColor}
      />
      <div className="mdv-editor-workspace__body">
        <div className="mdv-editor-workspace__main">
          <Editor
            ref={mdEditorRef}
            value={source}
            onChange={setSource}
            onSelectionChange={handleEditorSelectionChange}
            onContextMenu={handleEditorContextMenu}
            vimOn={vimOn}
            onVimMode={setVimMode}
            secretsHidden={secretsHidden}
          />
        </div>
        {inspectorOpen ? (
          <MarkdownInspector headings={headings} issues={markdownIssues} onGoTo={(pos) => mdEditorRef.current?.goTo(pos)} />
        ) : null}
      </div>
    </div>
  );

  const previewSource = translatedSource ?? debouncedPreview;
  const preview = (
    <Preview
      source={previewSource}
      onTranslate={() => void handlePreviewTranslate()}
      onRevertTranslation={() => setTranslatedSource(null)}
      translating={previewTranslating}
      translated={translatedSource != null}
      translateDisabled={!translateReady}
      translateTooltip={aiTooltip}
      secretsHidden={secretsHidden}
      onToggleSecrets={toggleSecrets}
    />
  );

  const appClass = [
    "mdv-app",
    "mdv-app--notebook",
    focusMode ? "is-focus" : "",
    showNav ? "has-nav" : "",
    showList ? "has-list" : "",
    navCollapsed && navDrawer ? "nav-drawer" : "",
    listCollapsed && listDrawer ? "list-drawer" : "",
    dockMode !== "off" && !dockOpen ? `is-docked is-docked-${dockMode}` : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={appClass} style={appStyle}>
      {dockMode !== "off" && !dockOpen ? (
        <button
          type="button"
          className={`mdv-dock-rail mdv-dock-rail--${dockMode}`}
          onClick={handleDockTabClick}
          aria-label="marknote'u aç"
          data-tooltip="Aç"
        >
          <Icon icon={dockMode === "left" ? ChevronRight : ChevronLeft} size={14} strokeWidth={1.8} />
        </button>
      ) : null}

      <div className="mdv-body">
        {showNav ? (
          <NavPanel
            section={navSection}
            onSelectSection={selectSection}
            counts={{ all: noteIndex ? noteIndex.notes.length : null, pinned: pinned.length, trash: trashItems.length }}
            rootPath={rootPath}
            onNewNote={() => newNote(navSection.kind === "folder" ? navSection.path : null)}
            onOpenFolder={() => void handleOpenFolder()}
            onOpenFile={() => void handleOpenFile()}
            onNewFolder={() => rootPath && requestNewFolder(navSection.kind === "folder" ? navSection.path : rootPath)}
            onShowSettings={() => setSettingsOpen(true)}
            activePath={activePath}
            onOpenNote={(path) => {
              openNote(path);
              if (navCollapsed) setNavDrawer(false);
            }}
            onRequestRename={requestRename}
            onRequestDelete={(entry) => requestTrash(entry.path, entry.isDir)}
            onMove={(src, dst) => void handleMove(src, dst)}
            onFolderContextMenu={handleFolderContextMenu}
            editingPath={null}
            onSubmitRename={(src, name) => void handleSubmitRename(src, name)}
            onCancelEdit={() => undefined}
            newEntry={null}
            onSubmitNew={(parent, kind, name) => void handleSubmitNew(parent, kind, name)}
            onCancelNew={() => undefined}
            treeVersion={treeVersion}
          />
        ) : null}
        {navCollapsed && navDrawer ? <div className="mdv-scrim" onClick={() => setNavDrawer(false)} aria-hidden /> : null}

        {showList ? (
          <NoteList
            heading={listHeading}
            items={listItems}
            selectedPath={activePath}
            query={query}
            onQueryChange={setQuery}
            searchHits={searchResult?.hits ?? null}
            notices={listNotices}
            loading={indexLoading}
            error={indexError}
            onRetry={() => setIndexVersion((v) => v + 1)}
            hasFolder={rootPath != null}
            onOpenFolder={() => void handleOpenFolder()}
            onNewNote={() => newNote()}
            onSelect={selectFromList}
            onContextMenu={handleRowContextMenu}
            onDelete={(path) => requestTrash(path, false)}
            emptyText={listEmptyText}
            trash={navSection.kind === "trash" ? trashItems : null}
            onRestore={(item) => void handleRestoreTrash(item)}
            onDeleteForever={handleDeleteForever}
            onEmptyTrash={handleEmptyTrash}
          />
        ) : null}
        {listCollapsed && listDrawer && !focusMode ? <div className="mdv-scrim mdv-scrim--list" onClick={() => setListDrawer(false)} aria-hidden /> : null}

        <main className="mdv-doc" aria-label="Not">
          <EditorHeader
            folderLabel={folderLabel}
            title={docTitle}
            isNew={isNew}
            saveStatus={saveStatus}
            saveError={lastSaveError}
            onSave={() => void saveCurrent()}
            viewMode={viewMode}
            onViewMode={setViewMode}
            focusMode={focusMode}
            onToggleFocus={toggleFocus}
            onOpenMenu={(rect) => setDocMenu({ x: rect.right - 240, y: rect.bottom + 4 })}
            showNavButton={navCollapsed && !focusMode}
            onToggleNav={() => setNavDrawer((v) => !v)}
            showListButton={(listCollapsed && !focusMode) || focusMode}
            onToggleList={() => {
              if (focusMode) setFocusMode(false);
              else setListDrawer((v) => !v);
            }}
          />
          <div className="mdv-doc-body">
            <EditorErrorBoundary resetKey={`${viewMode}:${docId}`} onOpenSource={switchToSource}>
              <div className="mdv-view" hidden={viewMode !== "write"}>{richWorkspace}</div>
              <div className="mdv-view" hidden={viewMode !== "markdown" && viewMode !== "split"}>
                <Splitter
                  show={viewMode === "split" ? "both" : "left"}
                  left={markdownWorkspace}
                  right={viewMode === "split" ? preview : null}
                />
              </div>
              {viewMode === "read" ? (
                <div className="mdv-view mdv-doc-read">
                  {preview}
                  <ReadingFind open={findOpen} onClose={() => setFindOpen(false)} scope={proseEl} contentKey={debouncedPreview} />
                </div>
              ) : null}
            </EditorErrorBoundary>
            {aiJob ? (
              <div className="mdv-editor-ai-busy" role="status" aria-live="polite">
                <span className="mdv-editor-ai-busy__spinner" aria-hidden />
                <span>{aiJob.label}</span>
                <button type="button" className="mdv-save__action" onClick={() => aiJob.controller.abort()}>İptal</button>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <StatusBar
        fileName={activePath ? basename(activePath) : undefined}
        words={words}
        minutes={minutes}
        docTokens={docTokens}
        tokensLabel={techCounters ? `~${formatTokens(docTokens)} token` : null}
        onShowHelp={() => setHelpOpen(true)}
        onShowAbout={showAbout}
        vimMode={viewMode === "markdown" || viewMode === "split" ? vimMode : null}
      />

      <Toast
        open={loadError != null}
        message={loadError?.message ?? ""}
        onDismiss={dismissLoadError}
        action={
          loadError?.path
            ? {
                label: "Varsayılan uygulamada aç",
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
      <Toast open={copyToast != null && loadError == null} message={copyToast ?? ""} variant="info" onDismiss={dismissCopyToast} />
      <Toast
        open={infoToast != null && loadError == null}
        message={infoToast?.message ?? ""}
        variant="info"
        durationMs={null}
        onDismiss={() => setInfoToast(null)}
        action={infoToast?.action ? {
          label: infoToast.action.label,
          onClick: () => {
            infoToast.action?.onClick();
            setInfoToast(null);
          },
        } : undefined}
      />
      <Toast
        open={updateAvail != null && loadError == null}
        message={updateInstalling ? `v${updateAvail?.version} kuruluyor…` : `Güncelleme var · v${updateAvail?.version}`}
        variant="info"
        durationMs={null}
        onDismiss={() => setUpdateAvail(null)}
        action={updateInstalling ? undefined : { label: "Kur", onClick: () => void handleApplyUpdate() }}
      />
      <Toast
        open={updateUpToDate && loadError == null && updateAvail == null}
        message="En güncel sürümü kullanıyorsunuz"
        variant="info"
        onDismiss={() => setUpdateUpToDate(false)}
      />
      <Toast
        open={whatsNewVersion != null && loadError == null && updateAvail == null}
        message={whatsNewVersion ? getWhatsNewToastMessage(whatsNewVersion) : ""}
        variant="info"
        durationMs={null}
        onDismiss={() => setWhatsNewVersion(null)}
        action={{ label: "Yenilikler", onClick: () => void openUrl(CHANGELOG_URL) }}
      />
      <Toast
        open={externalReloadToast && loadError == null}
        message="Dosya dışarıda değişti · yeniden yüklendi"
        variant="info"
        onDismiss={dismissExternalReload}
      />
      <Toast
        open={externalConflict != null && loadError == null}
        message="Bu dosya dışarıda değişti. Kaydedilmemiş değişiklikleriniz var; yeniden yüklerseniz kaybolur."
        variant="info"
        durationMs={null}
        onDismiss={() => setExternalConflict(null)}
        action={{
          label: "Dıştakini yükle (benimkini at)",
          onClick: () => {
            if (externalConflict != null) {
              void saveVersion(activePath, sourceRef.current, "Dış değişiklikten önce").catch(() => undefined);
              acceptExternalChange(externalConflict);
            }
            setExternalConflict(null);
          },
        }}
      />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      <AiReviewOverlay
        open={aiReview != null}
        title={aiReview?.title ?? "AI"}
        original={aiReview?.original ?? ""}
        next={aiReview?.next ?? ""}
        onApply={applyAiReview}
        onClose={() => setAiReview(null)}
      />

      <SecretSendDialog
        open={secretPrompt != null}
        secretCount={secretPrompt?.count ?? 0}
        chars={secretPrompt?.text.length ?? 0}
        onSendMasked={() => {
          const p = secretPrompt;
          setSecretPrompt(null);
          if (p) void runAi(p.kind, p.range, p.text, true);
        }}
        onSendRaw={() => {
          const p = secretPrompt;
          setSecretPrompt(null);
          if (p) void runAi(p.kind, p.range, p.text, false);
        }}
        onCancel={() => setSecretPrompt(null)}
      />

      <RecoveryDialog
        open={recoveryDraft != null}
        fileName={recoveryDraft?.path ? basename(recoveryDraft.path) : "Yeni not"}
        chars={recoveryDraft?.source.length ?? 0}
        onRestore={() => continueNavigation(() => void restoreRecovery())}
        onDiscard={dismissRecovery}
      />

      <UnsavedChangesDialog
        open={pendingNavigation != null && recoveryDraft == null}
        fileName={activePath ? basename(activePath) : docTitle}
        saving={navigationSaving}
        onSave={() => void saveAndContinue()}
        onDiscard={discardAndContinue}
        onCancel={cancelNavigation}
      />

      <ConfirmDialog
        open={confirmState != null}
        title={confirmState?.title ?? ""}
        confirmLabel={confirmState?.confirmLabel ?? "Tamam"}
        destructive={confirmState?.destructive}
        onConfirm={() => {
          const c = confirmState;
          setConfirmState(null);
          c?.onConfirm();
        }}
        onCancel={() => setConfirmState(null)}
      >
        {confirmState?.body}
      </ConfirmDialog>

      <PromptDialog
        open={promptState != null}
        title={promptState?.title ?? ""}
        label={promptState?.label ?? ""}
        initialValue={promptState?.initialValue ?? ""}
        confirmLabel={promptState?.confirmLabel ?? "Tamam"}
        validate={validateName}
        onSubmit={(value) => {
          const p = promptState;
          setPromptState(null);
          p?.onSubmit(value);
        }}
        onCancel={() => setPromptState(null)}
      />

      <HistoryOverlay
        open={historyOpen}
        noteName={activePath ? basename(activePath) : "Yeni not"}
        entries={historyEntries}
        error={historyError}
        busy={historyBusy}
        onSaveVersion={() => void saveCurrentVersion().then((ok) => { if (ok) void refreshHistory(); })}
        onRestore={(entry) => void handleRestoreVersion(entry)}
        onDelete={(entry) => void handleDeleteVersion(entry)}
        onClose={() => setHistoryOpen(false)}
      />

      <SettingsOverlay
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        vimOn={vimOn}
        onVimToggle={setVimOn}
        techCounters={techCounters}
        onTechCountersChange={setTechCounters}
        remoteImages={remoteImages}
        onRemoteImagesChange={setRemoteImages}
        onShowAbout={() => {
          setSettingsOpen(false);
          showAbout();
        }}
        onShowDeveloperTools={() => {
          setSettingsOpen(false);
          setDeveloperToolsOpen(true);
        }}
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

      <DeveloperToolsOverlay
        open={developerToolsOpen}
        rootPath={rootPath}
        activePath={activePath}
        source={source}
        onChange={setSource}
        onOpenFile={(path, match) => {
          setDeveloperToolsOpen(false);
          openNote(path, match);
        }}
        exportProfile={exportProfile}
        onExportProfileChange={setExportProfile}
        onExportHtml={() => void exportToHtml()}
        onExportPdf={() => void exportToPdf()}
        onClose={() => setDeveloperToolsOpen(false)}
      />

      <AboutOverlay open={aboutOpen} onClose={() => setAboutOpen(false)} onCheckForUpdates={UPDATES_ENABLED ? handleManualUpdateCheck : undefined} />

      <DropOverlay active={dragActive} />
      <TooltipRoot />

      <ContextMenu open={rowMenu != null} x={rowMenu?.x ?? 0} y={rowMenu?.y ?? 0} items={rowMenuItems} onClose={() => setRowMenu(null)} />
      <ContextMenu open={docMenu != null} x={docMenu?.x ?? 0} y={docMenu?.y ?? 0} items={docMenuItems} onClose={() => setDocMenu(null)} />
      <ContextMenu open={editorContextMenu != null} x={editorContextMenu?.x ?? 0} y={editorContextMenu?.y ?? 0} items={editorContextItems} onClose={() => setEditorContextMenu(null)} />
      <ContextMenu open={richContextMenu != null} x={richContextMenu?.x ?? 0} y={richContextMenu?.y ?? 0} items={richContextItems} onClose={() => setRichContextMenu(null)} />
    </div>
  );
}
