import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Braces,
  CircleHelp,
  Copy,
  FilePlus2,
  FileDown,
  FileText,
  FolderOpen,
  FolderPlus,
  Download,
  History,
  Info,
  Leaf,
  Undo2,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  Save,
  Search,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import { basename, dirname } from "./files";
import { setThemeMode, setTransparency, type ThemeMode } from "./theme";

export type CommandCategory = "recent" | "file" | "view" | "edit" | "share" | "theme" | "help";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  icon?: LucideIcon;
  category?: CommandCategory;
  action: () => void | Promise<void>;
};

export type CommandViewMode = "write" | "markdown" | "split" | "read";

/** Inputs the app shell knows about — actions and state slices needed for hint text. */
export type CommandActions = {
  newFile: () => void;
  openFile: () => void | Promise<void>;
  openFolder: () => void | Promise<void>;
  save: () => void;
  saveAs: () => void;
  search: () => void;
  toggleFocus: () => void;
  setView: (mode: CommandViewMode) => void;
  showHistory: () => void;
  showHelp: () => void;
  showAbout: () => void;
  showSettings: () => void;
  showDeveloperTools: () => void;
  undoFileOp: () => void | Promise<void>;
  checkForUpdates: () => void | Promise<void>;
  copyMarkdown: () => void | Promise<void>;
  exportToPdf: () => void;
  toggleFullscreen: () => void | Promise<void>;
  openRecent: (path: string) => void;
  recentFiles: readonly string[];
  hasActivePath: boolean;
  focusMode: boolean;
  viewMode: CommandViewMode;
};

const THEME_COMMANDS: Array<{ mode: ThemeMode; label: string; hint: string; icon: LucideIcon }> = [
  { mode: "system", label: "Tema: Sistem", hint: "Sistem görünümünü izle", icon: Monitor },
  { mode: "sade", label: "Tema: Sade", hint: "Açık, sade (varsayılan)", icon: Sun },
  { mode: "gece", label: "Tema: Gece", hint: "Koyu, sade", icon: Moon },
  { mode: "latte", label: "Tema: Latte", hint: "Catppuccin açık", icon: Sun },
  { mode: "matcha", label: "Tema: Matcha", hint: "Kâğıt ve yeşil", icon: Leaf },
  { mode: "frappe", label: "Tema: Frappé", hint: "Catppuccin orta koyu", icon: Moon },
  { mode: "macchiato", label: "Tema: Macchiato", hint: "Catppuccin koyu", icon: Moon },
  { mode: "mocha", label: "Tema: Mocha", hint: "Catppuccin en koyu", icon: Moon },
];

const VIEW_COMMANDS: Array<{ mode: CommandViewMode; label: string; hint: string; icon: LucideIcon }> = [
  { mode: "write", label: "Görünüm: Yaz", hint: "Zengin metin düzenleyici (varsayılan)", icon: FileText },
  { mode: "markdown", label: "Görünüm: Markdown", hint: "Ham Markdown kaynağı", icon: FileText },
  { mode: "split", label: "Görünüm: Bölünmüş", hint: "Markdown kaynağı ve gerçek önizleme yan yana", icon: BookOpen },
  { mode: "read", label: "Görünüm: Okuma", hint: "Yalnız önizleme", icon: BookOpen },
];

export const CATEGORY_ORDER: CommandCategory[] = [
  "recent",
  "file",
  "view",
  "edit",
  "share",
  "theme",
  "help",
];

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  recent: "Son açılanlar",
  file: "Dosya",
  view: "Görünüm",
  edit: "Düzen",
  share: "Paylaş",
  theme: "Tema",
  help: "Yardım",
};

export function buildCommands(actions: CommandActions): Command[] {
  const recent = actions.recentFiles.slice(0, 5).map(
    (path): Command => ({
      id: `recent-${path}`,
      label: basename(path),
      hint: dirname(path),
      icon: FileText,
      category: "recent",
      action: () => actions.openRecent(path),
    }),
  );

  return [
    ...recent,
    {
      id: "new",
      label: "Yeni not",
      hint: "Boş bir not başlat",
      shortcut: "⌘N",
      icon: FilePlus2,
      category: "file",
      action: actions.newFile,
    },
    {
      id: "search",
      label: "Notlarda ara",
      hint: "Başlık ve içerikte tek yerden ara",
      shortcut: "⌘⇧F",
      icon: Search,
      category: "file",
      action: actions.search,
    },
    {
      id: "open-folder",
      label: "Klasör aç…",
      hint: "Notlarınızın bulunduğu klasörü seçin",
      shortcut: "⌘⇧O",
      icon: FolderPlus,
      category: "file",
      action: actions.openFolder,
    },
    {
      id: "open-file",
      label: "Dosya aç…",
      hint: "Tek bir .md dosyası açın",
      shortcut: "⌘O",
      icon: FolderOpen,
      category: "file",
      action: actions.openFile,
    },
    {
      id: "save",
      label: "Kaydet",
      hint: actions.hasActivePath ? "Değişiklikleri diske yaz" : "Kaydedilecek yeri seçin",
      shortcut: "⌘S",
      icon: Save,
      category: "file",
      action: actions.save,
    },
    {
      id: "save-as",
      label: "Farklı kaydet…",
      hint: "Notu başka bir dosyaya kaydet",
      shortcut: "⌘⇧S",
      icon: Save,
      category: "file",
      action: actions.saveAs,
    },
    {
      id: "history",
      label: "Sürüm geçmişi",
      hint: "Bu notun kayıtlı sürümleri",
      icon: History,
      category: "file",
      action: actions.showHistory,
    },
    {
      id: "undo-file-op",
      label: "Son dosya işlemini geri al",
      hint: "Son taşıma / yeniden adlandırma / oluşturma",
      shortcut: "⌘⌥Z",
      icon: Undo2,
      category: "file",
      action: actions.undoFileOp,
    },
    {
      id: "toggle-focus",
      label: actions.focusMode ? "Odak modundan çık" : "Odak modu",
      hint: "Yan panelleri gizle, yalnız notu göster",
      shortcut: "⌘⇧.",
      icon: actions.focusMode ? Minimize2 : Maximize2,
      category: "view",
      action: actions.toggleFocus,
    },
    ...VIEW_COMMANDS.filter((v) => v.mode !== actions.viewMode).map(
      (v): Command => ({
        id: `view-${v.mode}`,
        label: v.label,
        hint: v.hint,
        icon: v.icon,
        category: "view",
        action: () => actions.setView(v.mode),
      }),
    ),
    {
      id: "fullscreen",
      label: "Tam ekran",
      hint: "Pencereyi tam ekran yap",
      shortcut: "⌃⌘F",
      icon: Maximize2,
      category: "view",
      action: actions.toggleFullscreen,
    },
    {
      id: "copy-markdown",
      label: "Markdown'ı kopyala",
      hint: "Notun ham metnini panoya kopyala",
      shortcut: "⌘⇧C",
      icon: Copy,
      category: "share",
      action: actions.copyMarkdown,
    },
    {
      id: "export-pdf",
      label: "PDF olarak dışa aktar",
      hint: "Yazdırma görünümünü açar",
      shortcut: "⌘P",
      icon: FileDown,
      category: "share",
      action: actions.exportToPdf,
    },
    ...THEME_COMMANDS.map(
      (t): Command => ({
        id: `theme-${t.mode}`,
        label: t.label,
        hint: t.hint,
        icon: t.icon,
        category: "theme",
        action: () => setThemeMode(t.mode),
      }),
    ),
    {
      id: "transparency-on",
      label: "Saydamlık: açık (%74)",
      hint: "Pencere arkasını hafifçe göster",
      icon: Sparkles,
      category: "theme",
      action: () => setTransparency(74),
    },
    {
      id: "transparency-off",
      label: "Saydamlık: kapalı",
      hint: "Düz pencere arka planı",
      icon: Sparkles,
      category: "theme",
      action: () => setTransparency(100),
    },
    {
      id: "settings",
      label: "Ayarlar",
      hint: "Tema, AI ve gelişmiş seçenekler",
      icon: Settings,
      category: "help",
      action: actions.showSettings,
    },
    {
      id: "developer-tools",
      label: "Geliştirici araçları",
      hint: "Gelişmiş: frontmatter, bağlantı denetimi, Git diff, dönüşümler",
      icon: Braces,
      category: "help",
      action: actions.showDeveloperTools,
    },
    {
      id: "help",
      label: "Yardım ve kısayollar",
      hint: "Klavye kısayolları ve ipuçları",
      shortcut: "⌘/",
      icon: CircleHelp,
      category: "help",
      action: actions.showHelp,
    },
    {
      id: "check-updates",
      label: "Güncellemeleri denetle",
      hint: "Yeni sürüm var mı bak",
      icon: Download,
      category: "help",
      action: actions.checkForUpdates,
    },
    {
      id: "about",
      label: "marknote hakkında",
      hint: "Sürüm, lisans, ürün sahibi",
      icon: Info,
      category: "help",
      action: actions.showAbout,
    },
  ];
}
