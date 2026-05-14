import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CircleHelp,
  Copy,
  FilePlus2,
  FileDown,
  FileText,
  FolderOpen,
  FolderPlus,
  Info,
  Leaf,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Sparkles,
  Sun,
} from "lucide-react";
import { basename, dirname } from "./files";
import { setThemeMode, setTransparency, type ThemeMode } from "./theme";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  icon?: LucideIcon;
  action: () => void | Promise<void>;
};

/** Inputs the app shell knows about — actions and state slices needed for hint text. */
export type CommandActions = {
  newFile: () => void;
  openFile: () => void | Promise<void>;
  openFolder: () => void | Promise<void>;
  save: () => void;
  toggleSidebar: () => void;
  toggleReading: () => void;
  showHelp: () => void;
  showWelcome: () => void;
  showAbout: () => void;
  copyMarkdown: () => void | Promise<void>;
  exportToPdf: () => void;
  toggleFullscreen: () => void | Promise<void>;
  openRecent: (path: string) => void;
  recentFiles: readonly string[];
  hasActivePath: boolean;
  sidebarOpen: boolean;
  readingMode: boolean;
};

const THEME_COMMANDS: Array<{ mode: ThemeMode; label: string; hint: string; icon: LucideIcon }> = [
  { mode: "system", label: "theme: system", hint: "follow macOS appearance", icon: Monitor },
  { mode: "latte", label: "theme: latte", hint: "catppuccin light", icon: Sun },
  { mode: "matcha", label: "theme: matcha", hint: "washi paper + kelly green", icon: Leaf },
  { mode: "frappe", label: "theme: frappé", hint: "catppuccin mid-dark", icon: Moon },
  { mode: "macchiato", label: "theme: macchiato", hint: "catppuccin deeper dark", icon: Moon },
  { mode: "mocha", label: "theme: mocha", hint: "catppuccin deepest dark", icon: Moon },
];

export function buildCommands(actions: CommandActions): Command[] {
  const recent = actions.recentFiles.slice(0, 5).map(
    (path): Command => ({
      id: `recent-${path}`,
      label: basename(path),
      hint: `recent · ${dirname(path)}`,
      icon: FileText,
      action: () => actions.openRecent(path),
    }),
  );

  return [
    ...recent,
    {
      id: "open-folder",
      label: "open folder…",
      hint: "load a folder of notes — turn the sidebar into your context library",
      shortcut: "⌘⇧O",
      icon: FolderPlus,
      action: actions.openFolder,
    },
    {
      id: "open-file",
      label: "open file…",
      hint: "pick a single .md from disk",
      shortcut: "⌘O",
      icon: FolderOpen,
      action: actions.openFile,
    },
    {
      id: "new",
      label: "new file",
      hint: "start a blank markdown buffer",
      shortcut: "⌘N",
      icon: FilePlus2,
      action: actions.newFile,
    },
    {
      id: "save",
      label: "save",
      hint: actions.hasActivePath ? "write changes to disk" : "no file loaded — open one first",
      shortcut: "⌘S",
      icon: Save,
      action: actions.save,
    },
    {
      id: "copy-markdown",
      label: "copy markdown to clipboard",
      hint: "share with claude — paste straight into chat",
      shortcut: "⌘⇧C",
      icon: Copy,
      action: actions.copyMarkdown,
    },
    {
      id: "toggle-reading",
      label: actions.readingMode ? "exit reading mode" : "enter reading mode",
      hint: actions.readingMode
        ? "back to split editor + preview"
        : "calm preview-only view — great for proofing before sharing",
      shortcut: "⌘.",
      icon: actions.readingMode ? Minimize2 : BookOpen,
      action: actions.toggleReading,
    },
    {
      id: "toggle-sidebar",
      label: actions.sidebarOpen ? "hide sidebar" : "show sidebar",
      hint: "your folder tree + file search",
      shortcut: "⌘B",
      icon: actions.sidebarOpen ? PanelLeftClose : PanelLeftOpen,
      action: actions.toggleSidebar,
    },
    ...THEME_COMMANDS.map(
      (t): Command => ({
        id: `theme-${t.mode}`,
        label: t.label,
        hint: t.hint,
        icon: t.icon,
        action: () => setThemeMode(t.mode),
      }),
    ),
    {
      id: "transparency-on",
      label: "transparency: on",
      hint: "macOS vibrancy through the window",
      icon: Sparkles,
      action: () => setTransparency(true),
    },
    {
      id: "transparency-off",
      label: "transparency: off",
      hint: "solid window background",
      icon: Sparkles,
      action: () => setTransparency(false),
    },
    {
      id: "export-pdf",
      label: "export to pdf",
      hint: "macOS print dialog → choose 'save as pdf'",
      shortcut: "⌘P",
      icon: FileDown,
      action: actions.exportToPdf,
    },
    {
      id: "fullscreen",
      label: "toggle fullscreen",
      hint: "native macOS fullscreen",
      shortcut: "⌃⌘F",
      icon: Maximize2,
      action: actions.toggleFullscreen,
    },
    {
      id: "help",
      label: "show help",
      hint: "keyboard shortcuts + tips",
      shortcut: "⌘/",
      icon: CircleHelp,
      action: actions.showHelp,
    },
    {
      id: "tutorial",
      label: "show tutorial · welcome",
      hint: "reopen the onboarding modal",
      icon: Sparkles,
      action: actions.showWelcome,
    },
    {
      id: "about",
      label: "about marka.md",
      hint: "version, license, links",
      icon: Info,
      action: actions.showAbout,
    },
  ];
}
