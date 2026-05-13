# marka.md

_a local markdown space, built for the notes you share with ai._

a native macos markdown editor specialized for **claude / llm context management**. live editor on the left (codemirror 6), rendered preview on the right (markdown-it + shiki). minimal chrome, full catppuccin + matcha themes, macos vibrancy, orange octopus mascot. ~10 mb bundle.

> think obsidian, but the workshop where you craft and bundle the markdown you'll paste into claude.

## features

- live preview with debounced render (~50 ms)
- 5 themes: catppuccin **latte / frappé / macchiato / mocha** + **matcha** (washi paper + kelly green) + system auto-switch
- macos vibrancy with opt-in transparency toggle
- copy-to-clipboard on every code block
- syntax highlighting via shiki (all 5 themes baked in)
- file tree sidebar with resize handle and persisted state
- ⌘k command palette · ⌘/ help overlay · ⌘b sidebar toggle
- first-launch welcome with the marka.md mascot

## install

### from source

requires bun (or npm), rust toolchain, xcode command line tools.

```sh
bun install
bun run tauri dev      # native window with hmr
bun run tauri build    # produces .dmg under src-tauri/target/release/bundle/dmg/
```

### prebuilt `.dmg` (apple silicon)

download the latest `marka.md_<version>_aarch64.dmg` from [releases](https://github.com/mattenarle10/markamd/releases) (or build your own via `bun run tauri build`).

**first launch — unsigned app**: macOS will block it with "marka.md can't be opened because Apple cannot check it for malicious software." This is normal for unsigned indie apps. Two ways to bypass:

1. **right-click → open** in Finder → "Open" in the warning dialog (one-time approval)
2. or `xattr -d com.apple.quarantine /Applications/marka.md.app` in Terminal

code-signing + notarization with an Apple Developer ID is on the roadmap — see [SIGNING.md](./SIGNING.md) for the plan.

## keyboard

| key | does |
|---|---|
| ⌘K | command palette |
| ⌘N | new untitled buffer |
| ⌘O | open a `.md` file |
| ⌘⇧O | open a folder |
| ⌘S | save (manual — no autosave) |
| ⌘B | toggle sidebar |
| ⌘/ | help overlay |
| esc | close any popup |

## stack

| layer | choice |
|---|---|
| shell | tauri 2 (rust + webview) |
| frontend | react 19, vite 7, typescript 5.8 |
| editor | codemirror 6 + @codemirror/lang-markdown |
| markdown | markdown-it + shiki + markdown-it-task-lists |
| icons | lucide-react |
| styling | css variables, no framework |

## project structure

```
src/
├── app.tsx                       # thin shell — state + layout
├── main.tsx                      # react entry
├── app.css                       # @imports + shell grid
├── components/
│   ├── primitives/               # button, icon, popover, overlay, kbd
│   ├── chrome/                   # title-bar, breadcrumb, status-bar, logo
│   ├── editor/                   # editor, preview, splitter
│   ├── files/                    # sidebar, file-tree
│   ├── overlays/                 # command-palette, help-overlay, welcome
│   └── features/                 # top-level barrel
├── hooks/                        # use-debounced, use-persisted-state, use-shortcuts
├── lib/                          # markdown, theme, files, storage, commands
├── styles/                       # tokens, globals + per-domain css
└── assets/mascot/                # in-app sprites
src-tauri/
├── src/lib.rs                    # rust entry + vibrancy
├── tauri.conf.json               # overlay title bar
└── Cargo.toml
mdview-assets/                    # source PNGs (mascot + favicons; folder named pre-rebrand)
```

every folder exports its public api via `index.ts`. path alias `@/*` resolves to `src/*`.

## roadmap

shipped:
- branded shell + mascot + welcome flow
- codemirror editor + live preview + resizable splitter
- 5 themes (catppuccin family + matcha) + transparency
- copy-to-clipboard on code blocks
- file tree sidebar with persisted state
- ⌘K command palette + ⌘/ help overlay

planned:
- context-bundling: select multiple `.md` → one prompt blob with separators + token estimate
- "copy as claude context" + "send to claude" commands
- finder integration (`.md` "open with → marka.md")
- per-file tags (system / example / spec)
- prompt templates
- mermaid + katex (stretch)
- mcp integration (stretch)

## license

mit
