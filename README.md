<p align="center">
  <img src="./assets/readme-icon.png" width="160" alt="marknote application icon" />
</p>

<h1 align="center">marknote</h1>

<p align="center">A local-first Markdown workspace for Windows, built for developers who prepare notes and context for AI tools.</p>

<p align="center">
  <a href="https://github.com/palamut62/marknote/releases/latest">Download</a> ·
  <a href="https://github.com/palamut62/marknote/releases">Releases</a> ·
  <a href="https://github.com/palamut62/marknote/issues">Issues</a> ·
  <a href="./SECURITY.md">Security</a>
</p>

<p align="center">
  <a href="https://github.com/palamut62/marknote/releases/latest"><img src="https://img.shields.io/github/v/release/palamut62/marknote?style=flat-square&color=2563EB&label=release" alt="latest release" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4?style=flat-square&logo=windows11&logoColor=white" alt="Windows 10 and 11" />
  <img src="https://img.shields.io/badge/architecture-x64-334155?style=flat-square" alt="x64 architecture" />
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&logo=tauri&logoColor=white" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React 19" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-22C55E?style=flat-square" alt="MIT license" /></a>
</p>

> marknote is a Windows desktop application. The official v1.6 release ships as an x64 NSIS installer and MSI package.

marknote combines a rich editor, raw Markdown editor, live preview, file workspace, developer tools, AI-assisted editing, and secure local recovery in one native Windows window. Documents remain on disk. Network access is only used when you explicitly run an OpenRouter-powered AI action.

marknote is derived from [marka.md](https://github.com/mattenarle10/markamd) by Matt Enarle and remains available under the MIT License.

## Table of contents

- [Features](#features)
- [Windows installation](#windows-installation)
- [Usage](#usage)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Configuration and privacy](#configuration-and-privacy)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Development setup](#development-setup)
- [Testing and packaging](#testing-and-packaging)
- [Release process](#release-process)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security](#security)
- [FAQ](#faq)
- [License and acknowledgments](#license-and-acknowledgments)

## Features

### Writing and preview

- Rich-text and raw Markdown editing backed by Tiptap and CodeMirror 6.
- Live Markdown preview with Shiki syntax highlighting and Mermaid diagrams.
- Headings, lists, task lists, links, tables, code blocks, highlights, colors, and templates.
- Reading mode, editor-only mode, optional Vim keybindings, find/replace, and command palette.
- Markdown inspector with headings, lint issues, and deterministic lint auto-fix.

### Files and reliability

- Workspace sidebar with recursive search, create, rename, move, delete, and undo support.
- Support for `.md`, `.markdown`, `.mdx`, `.txt`, `.env`, `.env.*`, and `*.env` text files.
- Unsaved-change protection before switching documents.
- Atomic crash-recovery drafts stored in the Windows application data directory.
- External file watching with safe reload and conflict handling.
- Save As failures remain visible and never report a false success.

### Developer Tools

- Search across the current workspace.
- View the current Git working-tree diff.
- Inspect and update frontmatter fields.
- Validate local links and find broken references.
- Find backlinks across workspace documents.
- Save reusable literal find/replace transformations.
- Export standalone HTML or print-ready PDF using compact, standard, or spacious profiles.

### AI and secret handling

- Proofread, translate, and turn selected text or a document into an AI-ready prompt.
- Review AI output before applying it to the editor.
- OpenRouter API keys are stored in Windows Credential Manager, not browser storage.
- Common API keys and `.env` values are masked by default in editors and preview.
- No telemetry, analytics, account requirement, or cloud document storage.

## Windows installation

### Recommended: NSIS installer

1. Open the [latest release](https://github.com/palamut62/marknote/releases/latest).
2. Download `marknote_1.6.0_x64-setup.exe` or the newest matching `marknote_*_x64-setup.exe`.
3. Run the installer and follow the setup wizard.
4. Launch **marknote** from the Start menu.

The current installer is not code-signed. Windows SmartScreen may display **Windows protected your PC**. If you downloaded the file from this repository, select **More info**, verify the publisher status and filename, then choose **Run anyway**.

Direct v1.6 installer: [marknote_1.6.0_x64-setup.exe](https://github.com/palamut62/marknote/releases/download/v1.6.0/marknote_1.6.0_x64-setup.exe)

### Alternative: MSI

Local release builds also produce `marknote_1.6.0_x64_en-US.msi` under `src-tauri/target/release/bundle/msi/`. The GitHub v1.6 release currently publishes the NSIS `.exe` installer.

## Usage

1. Select **Open folder** to use a notes repository or project documentation folder as a workspace.
2. Select a Markdown or environment file from the sidebar.
3. Edit using the rich editor or raw Markdown pane.
4. Open **Developer Tools** from the status bar for workspace search, Git diff, metadata, link, and transformation tools.
5. Save with `Ctrl+S`, export from Developer Tools, or copy Markdown for another application.

Files are edited in place. marknote does not upload documents to a server.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+K` | Open command palette |
| `Ctrl+O` | Open a file |
| `Ctrl+Shift+O` | Open a folder |
| `Ctrl+N` | Create an untitled document |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+B` | Toggle workspace sidebar |
| `Ctrl+F` | Find in the active editor or reading mode |
| `Ctrl+Shift+C` | Copy Markdown |
| `Ctrl+P` | Open PDF export flow |
| `Ctrl+.` | Toggle reading mode |
| `Ctrl+Shift+.` | Toggle editor-only mode |
| `F11` | Toggle fullscreen |
| `Ctrl+/` | Open help |
| `Esc` | Close the active overlay |

## Configuration and privacy

Application settings are available from the status bar.

### Optional OpenRouter configuration

AI actions require:

- an OpenRouter API key;
- an OpenRouter model selected from the live model list;
- optional custom instructions for proofreading, prompt conversion, and translation.

The API key is stored through the operating-system credential vault. Existing v1.5 browser-storage keys are migrated once and removed from browser storage. AI requests send the selected text or document content to OpenRouter only when you explicitly start an AI action.

### Local data

- Preferences use `marknote.*` keys in the embedded WebView storage.
- Recovery drafts use the Tauri application-local data directory.
- Documents remain at their original filesystem paths.
- File access is scoped to the Windows user home directory and paths selected through application dialogs.

## Tech stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri 2, Rust, Windows WebView2 |
| Frontend | React 19, TypeScript 5.9, Vite 7 |
| Rich editor | Tiptap 3 |
| Markdown editor | CodeMirror 6, optional Vim mode |
| Rendering | markdown-it, Shiki, Mermaid |
| Native integrations | Tauri filesystem, dialog, opener, process, autostart, and updater plugins |
| Credential storage | Rust `keyring` with Windows Credential Manager |
| Tests | Bun test |
| Windows packaging | NSIS `.exe` and WiX `.msi` |

## Architecture

```text
React application shell
├── editor workspaces
│   ├── Tiptap rich editor
│   └── CodeMirror Markdown editor and inspector
├── preview pipeline
│   └── markdown-it → Shiki / Mermaid → rendered preview
├── file session
│   ├── Tauri filesystem operations
│   ├── external-change watcher
│   └── atomic recovery commands
├── developer tools
│   ├── workspace search and backlinks
│   ├── frontmatter and link validation
│   └── Git diff and reusable transforms
└── native Rust shell
    ├── Windows Credential Manager
    ├── system tray and window lifecycle
    └── NSIS / MSI packaging
```

The React layer owns editor state and user interaction. Native commands in `src-tauri/src/lib.rs` handle credential storage, atomic recovery, Git diff collection, tray behavior, and application lifecycle tasks.

## Project structure

```text
marknote/
├── src/
│   ├── components/
│   │   ├── chrome/       # title bar, breadcrumb, status bar
│   │   ├── editor/       # rich editor, Markdown editor, preview, inspector
│   │   ├── files/        # workspace sidebar and file operations
│   │   ├── overlays/     # settings, developer tools, dialogs, help
│   │   └── primitives/   # shared UI building blocks
│   ├── hooks/            # file session, recovery, shortcuts, overlays
│   ├── lib/              # Markdown, files, exports, AI, developer utilities
│   └── styles/           # tokens and component styles
├── src-tauri/
│   ├── capabilities/     # native permission scope
│   ├── src/              # Rust application and commands
│   └── tauri.conf.json   # Windows bundle configuration
├── tests/                # Bun unit tests
├── docs/                 # release and update documentation
└── .github/workflows/    # CI and release automation
```

## Development setup

### Requirements

- Windows 10 or Windows 11 x64.
- [Node.js 24 or newer](https://nodejs.org/).
- [Bun](https://bun.sh/) for the configured test and Tauri pre-build scripts.
- Stable [Rust toolchain](https://rustup.rs/) for `x86_64-pc-windows-msvc`.
- Visual Studio 2022 Build Tools with **Desktop development with C++**.
- Microsoft Edge WebView2 Runtime. It is normally included with supported Windows versions.

### Install and run

```powershell
git clone https://github.com/palamut62/marknote.git
Set-Location marknote
npm install
npm run tauri -- dev
```

Frontend-only development:

```powershell
npm run dev
```

## Testing and packaging

Run the complete local verification set:

```powershell
npm test
npx tsc --noEmit
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri -- build
```

Successful Windows packaging creates:

```text
src-tauri/target/release/marknote.exe
src-tauri/target/release/bundle/nsis/marknote_<version>_x64-setup.exe
src-tauri/target/release/bundle/msi/marknote_<version>_x64_en-US.msi
```

Release builds can take several minutes because Rust and the frontend syntax-highlighting/diagram modules are optimized for production.

## Release process

1. Update the version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Add release notes under `docs/release-notes/`.
3. Run all tests, type checking, frontend build, Rust check, and Tauri packaging.
4. Smoke-test `src-tauri/target/release/marknote.exe`.
5. Create a matching Git tag and GitHub Release.
6. Upload the NSIS installer and verify its SHA-256 digest.

See [v1.6.0 release notes](./docs/release-notes/v1.6.0.md) for the current release.

## Roadmap

- Code-sign Windows installers to remove SmartScreen publisher warnings.
- Add focused integration tests for native dialogs and credential-vault behavior.
- Reduce the initial frontend bundle with additional lazy loading.
- Add optional native PDF generation without the browser print flow.

Roadmap items are proposals, not committed release dates.

## Contributing

Issues and pull requests are welcome.

1. Fork the repository and create a focused branch.
2. Keep changes scoped and include tests for behavior changes.
3. Run the commands in [Testing and packaging](#testing-and-packaging).
4. Open a pull request describing the problem, solution, and verification evidence.

Use the [feedback template](https://github.com/palamut62/marknote/issues/new?template=feedback.yml) for ideas and the [bug report template](https://github.com/palamut62/marknote/issues/new?template=bug-report.yml) for defects.

## Security

Do not report security vulnerabilities in a public issue. Follow the private reporting instructions in [SECURITY.md](./SECURITY.md).

Never commit API keys, `.env` secrets, signing certificates, or credential exports.

## FAQ

### Does marknote run on macOS or Linux?

The current maintained and published application is Windows x64. The repository contains Tauri code with some platform-aware behavior, but macOS and Linux installers are not part of the supported v1.6 release.

### Why does Windows SmartScreen warn about the installer?

The current installer is not digitally signed. Download releases only from this repository and verify the SHA-256 digest shown on the release page when available.

### Does marknote upload my files?

No. Files and recovery data stay local. Only explicit AI actions send selected content to the configured OpenRouter service.

### Where is the Windows installer?

Download it from [GitHub Releases](https://github.com/palamut62/marknote/releases/latest). Local builds place it under `src-tauri/target/release/bundle/nsis/`.

### Can I edit `.env` files safely?

marknote masks recognized secret values by default, but it is still a text editor. Review the destination carefully before copying, exporting, or sending content to an AI provider.

## License and acknowledgments

marknote is licensed under the [MIT License](./LICENSE).

- marknote fork and Windows development: Umut Çelik ([@palamut62](https://github.com/palamut62)).
- Original project: [marka.md](https://github.com/mattenarle10/markamd) by Matt Enarle.
- UI icons: [Lucide](https://lucide.dev/).
- Core open-source technologies: Tauri, React, Tiptap, CodeMirror, markdown-it, Shiki, and Mermaid.
