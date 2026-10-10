/**
 * DEV ONLY (loaded from main.tsx when `import.meta.env.DEV` and the URL has
 * `?mock`). Emulates the Tauri bridge with an in-memory Windows-style file
 * system persisted in localStorage, so user flows (save, switch guard, trash,
 * history, recovery, search) can be exercised in a plain browser.
 *
 * Fault injection from the console / test driver:
 *   window.__mock.failWrites = true      → every write_text_file rejects
 *   window.__mock.nextSave = null        → next Save As dialog is cancelled
 *   window.__mock.nextSave = "C:\\…"      → next Save As returns this path
 *   window.__mock.emit("marknote:quit-requested")
 *   window.__mock.reset()                → reseed the sample folder
 */
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";

type Node = { path: string; dir: boolean; content?: string; mtime: number };
type Store = {
  nodes: Record<string, Node>;
  recovery: { source: string; path: string | null } | null;
  trash: Array<{ id: string; name: string; originalPath: string; deletedAt: number; isDir: boolean; nodes: Node[] }>;
  history: Array<{ id: string; label: string; path: string | null; createdAt: number; size: number; source: string }>;
};

const KEY = "marknote.dev.mockfs";
const ROOT = "C:\\Users\\demo\\Notlar";

const key = (p: string) => p.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
const parentOf = (p: string) => p.slice(0, Math.max(p.lastIndexOf("\\"), 0));
const nameOf = (p: string) => p.slice(p.lastIndexOf("\\") + 1);

function seed(): Store {
  const now = Date.now();
  const nodes: Record<string, Node> = {};
  const add = (path: string, content?: string, ageMin = 0) => {
    nodes[key(path)] = { path, dir: content === undefined, content, mtime: now - ageMin * 60_000 };
  };
  add("C:\\Users");
  add("C:\\Users\\demo");
  add(ROOT);
  add(`${ROOT}\\İş`);
  add(`${ROOT}\\Kişisel`);
  add(
    `${ROOT}\\İş\\Haftalık plan.md`,
    "---\ntitle: Haftalık plan\n---\n# Haftalık plan\n\nBu hafta önemli üç işe odaklanacağım.\n\n| İş | Durum |\n| --- | --- |\n| Rapor | Hazır |\n| Sunum | Bekliyor |\n\n- [x] Proje notlarını toparla\n- [ ] Yeni arayüzü gözden geçir\n\n![logo](https://example.com/logo.png)\n",
    5,
  );
  add(`${ROOT}\\İş\\Toplantı notları.md`, "# Toplantı notları\n\nKararlar, sorular ve yapılacaklar.\n\n- Bütçe onaylandı\n- Tarih: Cuma\n", 60);
  add(`${ROOT}\\Kişisel\\Okuma listesi.md`, "# Okuma listesi\n\nBu ay okumak istediğim kitaplar.\n\n1. Tutunamayanlar\n2. Kürk Mantolu Madonna\n", 300);
  add(`${ROOT}\\Aklıma gelenler.md`, "# Aklıma gelenler\n\nKüçük bir fikir, bir sonraki adım.\n\n<details><summary>Ham HTML</summary>\n\nGizli içerik\n\n</details>\n", 1500);
  return { nodes, recovery: null, trash: [], history: [] };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* reseed */
  }
  return seed();
}

let store = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(store));
const enc = new TextEncoder();
const dec = new TextDecoder();

const mock = {
  failWrites: false,
  nextSave: undefined as string | null | undefined,
  nextOpen: undefined as string | null | undefined,
  emit: (event: string, payload?: unknown) => emit(event, payload),
  reset: () => {
    store = seed();
    save();
  },
  store: () => store,
};
(window as unknown as { __mock: typeof mock }).__mock = mock;

function need(path: string): Node {
  const n = store.nodes[key(path)];
  if (!n) throw new Error(`os error 2: ${path} bulunamadı`);
  return n;
}

function children(path: string): Node[] {
  const k = key(path);
  return Object.values(store.nodes).filter((n) => key(parentOf(n.path)) === k);
}

function subtree(path: string): Node[] {
  const k = key(path);
  return Object.values(store.nodes).filter((n) => key(n.path) === k || key(n.path).startsWith(`${k}\\`));
}

function moveTree(from: string, to: string) {
  for (const n of subtree(from)) {
    delete store.nodes[key(n.path)];
    const np = to + n.path.slice(from.length);
    store.nodes[key(np)] = { ...n, path: np };
  }
}

function uniqueRestore(path: string): string {
  if (!store.nodes[key(path)]) return path;
  const dot = path.lastIndexOf(".");
  const stem = dot > path.lastIndexOf("\\") ? path.slice(0, dot) : path;
  const ext = dot > path.lastIndexOf("\\") ? path.slice(dot) : "";
  for (let n = 1; ; n += 1) {
    const c = `${stem} (${n === 1 ? "geri yüklendi" : `geri yüklendi ${n}`})${ext}`;
    if (!store.nodes[key(c)]) return c;
  }
}

type Args = Record<string, unknown> & { options?: Record<string, unknown> };

function handle(cmd: string, args: Args, opts?: { headers?: Record<string, string> }): unknown {
  switch (cmd) {
    case "plugin:fs|read_dir":
      need(args.path as string);
      return children(args.path as string).map((n) => ({ name: nameOf(n.path), isDirectory: n.dir, isFile: !n.dir, isSymlink: false }));
    case "plugin:fs|stat": {
      const n = need(args.path as string);
      return {
        isFile: !n.dir, isDirectory: n.dir, isSymlink: false, size: n.content ? enc.encode(n.content).length : 0,
        mtime: n.mtime, atime: null, birthtime: null, readonly: false, fileAttributes: null,
        dev: null, ino: null, mode: null, nlink: null, uid: null, gid: null, rdev: null, blksize: null, blocks: null,
      };
    }
    case "plugin:fs|read_file":
    case "plugin:fs|read_text_file":
      return Array.from(enc.encode(need(args.path as string).content ?? ""));
    case "plugin:fs|write_text_file": {
      const path = decodeURIComponent(opts?.headers?.path ?? "");
      if (mock.failWrites) throw new Error("os error 112: diskte yeterli alan yok");
      if (!store.nodes[key(parentOf(path))]) throw new Error(`os error 3: klasör yok ${parentOf(path)}`);
      store.nodes[key(path)] = { path, dir: false, content: dec.decode(args as unknown as Uint8Array), mtime: Date.now() };
      save();
      return null;
    }
    case "plugin:fs|exists":
      return store.nodes[key(args.path as string)] != null;
    case "plugin:fs|rename": {
      const from = args.oldPath as string;
      const to = args.newPath as string;
      need(from);
      if (store.nodes[key(to)] && store.nodes[key(to)].dir) throw new Error("os error 5: hedef bir klasör");
      delete store.nodes[key(to)];
      moveTree(from, to);
      save();
      return null;
    }
    case "plugin:fs|mkdir":
      if (store.nodes[key(args.path as string)]) throw new Error("os error 183: zaten var");
      store.nodes[key(args.path as string)] = { path: args.path as string, dir: true, mtime: Date.now() };
      save();
      return null;
    case "plugin:fs|remove": {
      const path = args.path as string;
      need(path);
      if (children(path).length && !(args.options as { recursive?: boolean } | undefined)?.recursive) throw new Error("os error 145: klasör boş değil");
      for (const n of subtree(path)) delete store.nodes[key(n.path)];
      save();
      return null;
    }
    case "plugin:dialog|open": {
      const next = mock.nextOpen;
      mock.nextOpen = undefined;
      if (next !== undefined) return next;
      return (args.options as { directory?: boolean })?.directory ? ROOT : `${ROOT}\\İş\\Haftalık plan.md`;
    }
    case "plugin:dialog|save": {
      const next = mock.nextSave;
      mock.nextSave = undefined;
      if (next !== undefined) return next;
      return ((args.options as { defaultPath?: string })?.defaultPath ?? `${ROOT}\\Yeni not.md`);
    }
    case "load_recovery":
      return store.recovery;
    case "save_recovery":
      store.recovery = args.draft as Store["recovery"];
      save();
      return null;
    case "clear_recovery":
      store.recovery = null;
      save();
      return null;
    case "take_launch_file":
      return null;
    case "get_openrouter_key":
      return localStorage.getItem("marknote.dev.key");
    case "set_openrouter_key":
      localStorage.setItem("marknote.dev.key", args.value as string);
      return null;
    case "quit_app":
    case "cancel_quit":
      console.info("[mock]", cmd);
      return null;
    case "git_diff":
      return "";
    case "trash_move": {
      const path = args.path as string;
      const n = need(path);
      const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const nodes = subtree(path);
      for (const x of nodes) delete store.nodes[key(x.path)];
      const item = { id, name: nameOf(n.path), originalPath: path, deletedAt: Date.now(), isDir: n.dir, nodes };
      store.trash.push(item);
      save();
      return { id, name: item.name, originalPath: path, deletedAt: item.deletedAt, isDir: item.isDir };
    }
    case "trash_list":
      return [...store.trash].sort((a, b) => b.deletedAt - a.deletedAt).map(({ nodes: _n, ...rest }) => rest);
    case "trash_restore": {
      const item = store.trash.find((t) => t.id === args.id);
      if (!item) throw new Error("çöp kutusu öğesi bulunamadı");
      const target = uniqueRestore(item.originalPath);
      for (const x of item.nodes) {
        const np = target + x.path.slice(item.originalPath.length);
        store.nodes[key(np)] = { ...x, path: np };
      }
      store.trash = store.trash.filter((t) => t !== item);
      save();
      return target;
    }
    case "trash_delete":
      store.trash = store.trash.filter((t) => t.id !== args.id);
      save();
      return null;
    case "trash_empty":
      store.trash = [];
      save();
      return null;
    case "history_save": {
      const entry = {
        id: `h${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        label: args.label as string,
        path: (args.path as string | null) ?? null,
        createdAt: Date.now(),
        size: (args.source as string).length,
        source: args.source as string,
      };
      store.history.push(entry);
      const mine = store.history.filter((h) => (h.path ?? "") === (entry.path ?? "")).sort((a, b) => b.createdAt - a.createdAt);
      const drop = new Set(mine.slice(20).map((h) => h.id));
      store.history = store.history.filter((h) => !drop.has(h.id));
      save();
      const { source: _s, ...meta } = entry;
      return meta;
    }
    case "history_list":
      return store.history
        .filter((h) => key(h.path ?? "untitled") === key((args.path as string | null) ?? "untitled"))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(({ source: _s, ...meta }) => meta);
    case "history_read": {
      const h = store.history.find((x) => x.id === args.id);
      if (!h) throw new Error("sürüm bulunamadı");
      return h;
    }
    case "history_delete":
      store.history = store.history.filter((x) => x.id !== args.id);
      save();
      return null;
    case "plugin:path|resolve_directory":
      // documentDir() and friends; only Belgeler matters for new notes
      return `${parentOf(ROOT)}\\Documents`;
    case "plugin:app|version":
      return "1.6.0";
    case "plugin:autostart|is_enabled":
      return false;
    default:
      // window / opener / process plugins: no-op in the browser
      return null;
  }
}

mockWindows("main");
mockIPC((cmd, args) => handle(cmd, args as Args), { shouldMockEvents: true });
// mockIPC drops invoke's third argument; write_text_file sends its path in headers
const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
const original = internals.invoke.bind(internals);
internals.invoke = async (cmd, args, options) => {
  if (cmd === "plugin:fs|write_text_file") return handle(cmd, args as Args, options as { headers?: Record<string, string> });
  return original(cmd, args, options);
};
console.info("[mock] Tauri bridge emulated; sample folder:", ROOT);
