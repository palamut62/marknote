export const STORAGE_KEYS = {
  themeMode: "marknote.theme",
  transparency: "marknote.transparency",
  splitterRatio: "marknote.split.ratio",
  sidebarOpen: "marknote.sidebar.open",
  sidebarWidth: "marknote.sidebar.width",
  lastFolder: "marknote.lastFolder",
  lastFile: "marknote.lastFile",
  welcomed: "marknote.welcomed",
  lastSeenVersion: "marknote.lastSeenVersion",
  recentFiles: "marknote.recent.files",
  vimMode: "marknote.vim",
  openrouterKey: "marknote.openrouter.key",
  openrouterModel: "marknote.openrouter.model",
  translateTargetLang: "marknote.translate.targetLang",
  proofreadPrompt: "marknote.ai.prompt.proofread",
  promptifyPrompt: "marknote.ai.prompt.promptify",
  translatePrompt: "marknote.ai.prompt.translate",
  snapshots: "marknote.snapshots",
  autostart: "marknote.autostart",
  secretsHidden: "marknote.secrets.hidden",
  editorTextColor: "marknote.editor.textColor",
  editorHighlightColor: "marknote.editor.highlightColor",
  secretHiddenColor: "marknote.secrets.hiddenColor",
  secretHiddenBg: "marknote.secrets.hiddenBg",
  secretRevealedColor: "marknote.secrets.revealedColor",
  secretRevealedBg: "marknote.secrets.revealedBg",
  dockMode: "marknote.dock.mode",
  exportProfile: "marknote.export.profile",
  customTransforms: "marknote.developer.transforms",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function migrateLegacyStorage(): void {
  for (const key of Object.values(STORAGE_KEYS)) {
    if (!key.startsWith("marknote.")) continue;
    const legacy = `mdview.${key.slice("marknote.".length)}`;
    if (window.localStorage.getItem(key) == null) {
      const value = window.localStorage.getItem(legacy);
      if (value != null) window.localStorage.setItem(key, value);
    }
    window.localStorage.removeItem(legacy);
  }
}
