import type { LucideIcon } from "lucide-react";
import {
  CircleHelp,
  Copy,
  FilePlus2,
  FolderOpen,
  FolderPlus,
  Leaf,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Sparkles,
  SquareDashed,
  Sun,
} from "lucide-react";
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
  showHelp: () => void;
  showWelcome: () => void;
  copyBundle: () => void | Promise<void>;
  clearSelection: () => void;
  hasActivePath: boolean;
  sidebarOpen: boolean;
  selectedCount: number;
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
  return [
    {
      id: "new",
      label: "new file",
      hint: "start an untitled markdown buffer",
      shortcut: "⌘N",
      icon: FilePlus2,
      action: actions.newFile,
    },
    {
      id: "open-file",
      label: "open file…",
      hint: "pick a .md from your disk",
      shortcut: "⌘O",
      icon: FolderOpen,
      action: actions.openFile,
    },
    {
      id: "open-folder",
      label: "open folder…",
      hint: "load a folder into the sidebar",
      shortcut: "⌘⇧O",
      icon: FolderPlus,
      action: actions.openFolder,
    },
    {
      id: "save",
      label: "save",
      hint: actions.hasActivePath ? "write to disk" : "no file loaded — pick one first",
      shortcut: "⌘S",
      icon: Save,
      action: actions.save,
    },
    {
      id: "toggle-sidebar",
      label: actions.sidebarOpen ? "hide sidebar" : "show sidebar",
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
      id: "copy-bundle",
      label: "copy bundle to clipboard",
      hint:
        actions.selectedCount > 0
          ? `${actions.selectedCount} file${actions.selectedCount === 1 ? "" : "s"} selected · concat with separators`
          : "select files in the sidebar first",
      shortcut: "⌘⇧C",
      icon: Copy,
      action: actions.copyBundle,
    },
    {
      id: "clear-selection",
      label: "clear bundle selection",
      hint: `${actions.selectedCount} selected`,
      icon: SquareDashed,
      action: actions.clearSelection,
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
  ];
}
