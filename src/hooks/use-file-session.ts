import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  basename,
  joinPath,
  pathExists,
  pickSaveMarkdown,
  readMarkdown,
  STORAGE_KEYS,
  writeMarkdown,
} from "@/lib";
import { loadMarkdownFile } from "@/lib/files";
import { remapOptionalPath, remapPath, samePath } from "@/lib/paths";
import { usePersistedState } from "./use-persisted-state";
import { useFileWatcher } from "./use-file-watcher";

const SAVED_FLASH_MS = 1600;
const RECOVERY_DEBOUNCE_MS = 750;

/**
 * idle     — document matches disk (or an empty new note)
 * unsaved  — new note with content that has never been written anywhere
 * dirty    — file on disk, buffer differs
 * saving   — write in progress
 * saved    — write just finished (flashes, then idle)
 * error    — last write failed; the buffer is untouched
 */
export type SaveStatus = "idle" | "unsaved" | "dirty" | "saving" | "saved" | "error";

function normalizeForDirtyCheck(content: string): string {
  return content.replace(/\r\n?/g, "\n");
}

function contentsMatch(a: string, b: string): boolean {
  return normalizeForDirtyCheck(a) === normalizeForDirtyCheck(b);
}

export type LoadError = { message: string; path?: string };
export type RecoveryDraft = { source: string; path: string | null };

type UseFileSessionArgs = {
  onLoadError?: (err: LoadError) => void;
};

type UseFileSessionResult = {
  source: string;
  setSource: (v: string) => void;
  savedContent: string;
  activePath: string | null;
  setActivePath: (v: string | null | ((p: string | null) => string | null)) => void;
  rootPath: string | null;
  setRootPath: (v: string | null | ((p: string | null) => string | null)) => void;
  /** increments whenever a different document replaces the buffer */
  docId: number;
  saveStatus: SaveStatus;
  lastSaveError: string | null;
  recentFiles: string[];
  setRecentFiles: (v: string[] | ((prev: string[]) => string[])) => void;
  externalReloadToast: boolean;
  dismissExternalReload: () => void;
  externalConflict: string | null;
  setExternalConflict: (v: string | null) => void;
  /** Accept fresh content from disk (external-change reload, "discard mine"). */
  acceptExternalChange: (fresh: string) => void;
  /** Resolves true when the file is now the open document. */
  loadFile: (path: string) => Promise<boolean>;
  saveNow: (path: string, content: string) => Promise<boolean>;
  /** Picks save location + writes. Returns the chosen path (or null if cancelled/failed). */
  saveAs: (defaultPath?: string) => Promise<string | null>;
  /** Discard buffer, leave activePath null. Accepts optional initial text for OS-drop. */
  startNewBuffer: (initial?: string) => void;
  /** Turn the open file into an unsaved new note, keeping its text (used when the file is trashed). */
  detachFromFile: () => void;
  /** After a move/rename on disk, point every stored path at the new location. */
  remapPaths: (from: string, to: string) => void;
  dirty: boolean;
  recoveryDraft: RecoveryDraft | null;
  restoreRecovery: () => Promise<void>;
  dismissRecovery: () => void;
  /** Write the recovery draft right now (quit / hide paths). */
  flushRecovery: () => Promise<void>;
};

export function useFileSession({ onLoadError }: UseFileSessionArgs = {}): UseFileSessionResult {
  const [source, setSource] = useState<string>("");
  const [savedContent, setSavedContent] = useState<string>("");
  const [activePath, setActivePath] = usePersistedState<string | null>(
    STORAGE_KEYS.lastFile,
    null,
  );
  const [rootPath, setRootPath] = usePersistedState<string | null>(
    STORAGE_KEYS.lastFolder,
    null,
  );
  const [docId, setDocId] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = usePersistedState<string[]>(
    STORAGE_KEYS.recentFiles,
    [],
  );
  const [externalReloadToast, setExternalReloadToast] = useState(false);
  const [externalConflict, setExternalConflict] = useState<string | null>(null);
  const [recoveryDraft, setRecoveryDraft] = useState<RecoveryDraft | null>(null);
  // the recovery file on disk must not be touched until we know whether it holds
  // a draft and the user has decided what to do with it (F03)
  const [recoveryChecked, setRecoveryChecked] = useState(false);

  // identity of the document currently in the buffer — async completions
  // (loads, saves) compare against it so a slow result never lands on the
  // wrong note (R02)
  const docIdRef = useRef(0);
  const loadSeqRef = useRef(0);
  const replaceDocument = useCallback(() => {
    docIdRef.current += 1;
    setDocId(docIdRef.current);
    setExternalConflict(null);
    setLastSaveError(null);
    return docIdRef.current;
  }, []);

  const dismissExternalReload = useCallback(() => setExternalReloadToast(false), []);

  const acceptExternalChange = useCallback((fresh: string) => {
    setSource(fresh);
    setSavedContent(fresh);
    setSaveStatus("idle");
  }, []);

  const restoreRecovery = useCallback(async () => {
    const draft = recoveryDraft;
    if (!draft) return;
    let disk = "";
    let path = draft.path;
    if (path) {
      try {
        if (await pathExists(path)) disk = await readMarkdown(path);
        else path = null; // file vanished: keep the text as a new note
      } catch {
        path = null;
      }
    }
    // a session-restore load still in flight must not overwrite the draft
    loadSeqRef.current += 1;
    replaceDocument();
    setSavedContent(disk);
    setSource(draft.source);
    setActivePath(path);
    setSaveStatus("idle");
    // the draft stays on disk: the dirty-buffer effect rewrites it until the
    // restored text is actually saved somewhere
    setRecoveryDraft(null);
  }, [recoveryDraft, replaceDocument, setActivePath]);

  const dismissRecovery = useCallback(() => {
    setRecoveryDraft(null);
    void invoke("clear_recovery").catch((err) => console.warn("marknote: recovery clear failed", err));
  }, []);

  const loadFile = useCallback(
    async (path: string): Promise<boolean> => {
      const seq = ++loadSeqRef.current;
      const loaded = await loadMarkdownFile(path);
      // a newer open request superseded this one while we were reading (R02)
      if (seq !== loadSeqRef.current) return false;
      if (!loaded.ok) {
        onLoadError?.({ message: loaded.reason, path });
        console.warn("marknote: refused to open", path, "·", loaded.reason);
        return false;
      }
      replaceDocument();
      setSource(loaded.content);
      setSavedContent(loaded.content);
      setActivePath(path);
      setSaveStatus("idle");
      setRecentFiles((prev) => [path, ...prev.filter((p) => !samePath(p, path))].slice(0, 12));
      return true;
    },
    [setActivePath, setRecentFiles, onLoadError, replaceDocument],
  );

  const startNewBuffer = useCallback((initial: string = "") => {
    loadSeqRef.current += 1;
    replaceDocument();
    setSource(initial);
    // dropped text is not on disk anywhere yet → counts as unsaved
    setSavedContent("");
    setActivePath(null);
    setSaveStatus("idle");
  }, [setActivePath, replaceDocument]);

  const detachFromFile = useCallback(() => {
    replaceDocument();
    setSavedContent("");
    setActivePath(null);
    setSaveStatus("idle");
  }, [setActivePath, replaceDocument]);

  const saveNow = useCallback(async (path: string, content: string): Promise<boolean> => {
    const savingDoc = docIdRef.current;
    setSaveStatus("saving");
    try {
      await writeMarkdown(path, content);
      // the user switched notes while the write was in flight: the bytes are on
      // disk, but the visible document's state must not be touched
      if (savingDoc !== docIdRef.current) return true;
      setSavedContent(content);
      setLastSaveError(null);
      setSaveStatus("saved");
      window.setTimeout(() => {
        setSaveStatus((s) => (s === "saved" ? "idle" : s));
      }, SAVED_FLASH_MS);
      return true;
    } catch (err) {
      console.error("marknote: writeMarkdown failed", err);
      if (savingDoc === docIdRef.current) {
        setSaveStatus("error");
        setLastSaveError(String(err));
      }
      onLoadError?.({ message: `${basename(path)} kaydedilemedi - ${String(err)}`, path });
      return false;
    }
  }, [onLoadError]);

  const saveAs = useCallback(async (suggested?: string): Promise<string | null> => {
    const defaultPath = suggested ?? activePath
      ?? (rootPath ? joinPath(rootPath, "Yeni not.txt") : "Yeni not.txt");
    const savingDoc = docIdRef.current;
    const target = await pickSaveMarkdown(defaultPath);
    if (!target) return null;
    if (savingDoc !== docIdRef.current) return null;
    const saved = await saveNow(target, source);
    if (!saved) return null;
    setActivePath(target);
    setRecentFiles((prev) => [target, ...prev.filter((p) => !samePath(p, target))].slice(0, 12));
    return target;
  }, [activePath, rootPath, source, saveNow, setActivePath, setRecentFiles]);

  const remapPaths = useCallback((from: string, to: string) => {
    setActivePath((p) => remapOptionalPath(p, from, to));
    setRootPath((p) => remapOptionalPath(p, from, to));
    setRecentFiles((prev) => prev.map((p) => remapPath(p, from, to)));
  }, [setActivePath, setRootPath, setRecentFiles]);

  // stable refs so handleExternalChange identity doesn't fluctuate with keystrokes.
  const sourceRef = useRef(source);
  const savedRef = useRef(savedContent);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    savedRef.current = savedContent;
  }, [savedContent]);

  const handleExternalChange = useCallback(async () => {
    if (!activePath) return;
    const watchingDoc = docIdRef.current;
    try {
      const fresh = await readMarkdown(activePath);
      if (watchingDoc !== docIdRef.current) return;
      if (contentsMatch(fresh, sourceRef.current)) return;
      // our own save landing: disk now equals what we last wrote
      if (contentsMatch(fresh, savedRef.current)) return;
      const isDirty = !contentsMatch(sourceRef.current, savedRef.current);
      if (!isDirty) {
        setSource(fresh);
        setSavedContent(fresh);
        setExternalReloadToast(true);
        window.setTimeout(() => setExternalReloadToast(false), 2400);
      } else {
        setExternalConflict(fresh);
      }
    } catch (err) {
      console.error("marknote: external change reload failed", err);
    }
  }, [activePath]);
  useFileWatcher(activePath, handleExternalChange);

  // mount-only: reopen the last open file; if it is gone, the most recent file
  // that still exists. A file opened meanwhile (launch arg, recovery) wins.
  useEffect(() => {
    const candidates = [activePath, ...recentFiles].filter(
      (p, i, all): p is string => !!p && all.findIndex((q) => samePath(q, p)) === i,
    );
    if (candidates.length === 0) return;
    const startSeq = loadSeqRef.current;
    let cancelled = false;
    void (async () => {
      for (const path of candidates) {
        let exists = false;
        try {
          exists = await pathExists(path);
        } catch (err) {
          console.warn("marknote: session restore check failed", path, err);
        }
        if (cancelled || loadSeqRef.current !== startSeq) return;
        if (exists) {
          void loadFile(path);
          return;
        }
      }
      setActivePath(null);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    void invoke<RecoveryDraft | null>("load_recovery")
      .then((draft) => {
        if (!cancelled && draft?.source) setRecoveryDraft(draft);
      })
      .catch((err) => console.warn("marknote: recovery load failed", err))
      .finally(() => {
        if (!cancelled) setRecoveryChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = !contentsMatch(source, savedContent);

  // derive the visible status from the buffer; "saving"/"error"/"saved" are
  // owned by saveNow and only cleared by the next successful write
  useEffect(() => {
    setSaveStatus((s) => {
      if (s === "saving" || s === "error") return s;
      if (!activePath) return dirty ? "unsaved" : (s === "saved" ? s : "idle");
      if (dirty) return "dirty";
      return s === "dirty" || s === "unsaved" ? "idle" : s;
    });
  }, [dirty, activePath]);

  const recoveryBlocked = !recoveryChecked || recoveryDraft != null;

  const writeRecovery = useCallback(async (text: string, path: string | null) => {
    try {
      await invoke("save_recovery", { draft: { source: text, path } });
    } catch (err) {
      console.warn("marknote: recovery save failed", err);
    }
  }, []);

  useEffect(() => {
    if (recoveryBlocked) return;
    const timer = window.setTimeout(() => {
      if (dirty) {
        void writeRecovery(source, activePath);
      } else {
        void invoke("clear_recovery").catch((err) => {
          console.warn("marknote: recovery clear failed", err);
        });
      }
    }, RECOVERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, source, activePath, recoveryBlocked, writeRecovery]);

  const flushRecovery = useCallback(async () => {
    if (recoveryBlocked || !dirty) return;
    await writeRecovery(sourceRef.current, activePath);
  }, [recoveryBlocked, dirty, activePath, writeRecovery]);

  return {
    source,
    setSource,
    savedContent,
    activePath,
    setActivePath,
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
    saveAs,
    startNewBuffer,
    detachFromFile,
    remapPaths,
    dirty,
    recoveryDraft,
    restoreRecovery,
    dismissRecovery,
    flushRecovery,
  };
}
