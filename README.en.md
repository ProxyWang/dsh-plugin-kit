# dsh-plugin-kit

English | [简体中文](README.md)

A comprehensive development toolbox plugin for the DeepSeek Harness (DSH) right sidebar. One bundle provides three top-level tabs plus a grouped launcher:

## Features

- **Code**
  - Workspace file tree: lazy expansion, quick open (⌘P), full-text search (⇧⌘F, ripgrep, with **regex / whole-word toggles, multi-glob filters (`!` prefix excludes), results grouped by file with collapsible sticky headers, match highlighting, and ▸ context expansion (±3 lines) per result**), **create file/folder, rename, delete, 📋 copy path (⌥-click copies the relative path)** (hover actions + two-step confirm)
  - VSCode-style editor: virtual scrolling, **syntax highlighting for Go/TS/JS/Python/JSON/YAML/Shell/TOML/Rust/Java/C/SQL/CSS**, **LSP go-to-definition/references/implementation/hover (Go: gopls; TS/JS: typescript-language-server; Python: pyright/pylsp — whichever is installed)**, back/forward navigation, **✎ edit mode + ⌘S save (refuses to clobber files modified on disk since load)**, ⌘F find-in-file, **↩ word wrap (⌥Z)**, **⌘G go-to-line (the Ln/Col chip is clickable)**
  - **Image preview**: png/jpg/gif/webp/avif/bmp/ico rendered from base64 data URLs (10 MiB cap) on a checkerboard backdrop with mime/size metadata
  - **B blame column**: author · relative time per commit run; click a blamed line to open that commit's diff
  - Git changes: VSCode-style collapsible tree (directory counts, status letters, indent guides, duplicate-name disambiguation), **tree/list toggle**, per-file and per-directory **discard** (two-step confirm); **opening any file with uncommitted changes shows gutter diff marks automatically**
  - **Full git commit flow**: stage (+, per file or directory), unstage (−), **separate Staged/Changes sections**, commit box (Enter commits; with an empty index the button explicitly becomes "Stage All & Commit"; **amend toggle**), **push (publishes with -u when no upstream; never force)**
  - Change review: **whole-file view with changed-line marks** (green tint + gutter marks + folded deletion bars + a clickable change rail); the hunk view supports a **▥ side-by-side / ≡ unified toggle**, **word-level intra-line highlight**, and **↑↓ change navigation**
  - Branch switcher: click the branch chip for a searchable palette (local/remote groups, fetch / ff-only pull / push)
  - Markdown / HTML / **SVG** files open in **rendered preview by default**, toggleable to raw
- **Skills**: browse/edit/create/delete installed agent skills (SKILL.md preview + ⌘S save), including a read-only bundled group; writes are strictly fenced to the skill roots
- **API**: a basic Postman — one-click curl import (**-F parses into multipart fields**) and **⧉ copy-as-curl export**, **environment variables `{{var}}` (substituted in URL/headers/body at send time)**, method/URL/headers/body editors (form-urlencoded / **multipart** / raw with JSON beautify), Host-proxied send (no CORS issues), status/time/size + response headers + pretty JSON, **request history (last 30 sends recorded automatically, one-click restore)**, **named favorites**
- **Start-page launcher**: reworks the right-sidebar picker into a grouped compact list (Code & Files / Terminal & Web / Agent Extensions / More) via the official chain slot
- Chat edit/write tool calls render as compact rows; clicking one opens that call's diff in the side panel

## Install

Link-install inside a DSH profile (development mode):

```sh
dsh plugin add /abs/path/to/dsh-plugin-kit   # or install_bundle in the plugin manager
```

From git:

```sh
git clone https://gitee.com/wang-jun-07/dsh-plugin-kit.git
# install the directory via the plugin manager
```

LSP jumps require the matching language server on the Host's PATH (or in common global bin locations): `gopls` for Go, `typescript-language-server` for TS/JS, `pyright-langserver` or `pylsp` for Python. Missing servers degrade gracefully (the status dot reports it; everything else keeps working).

## Development

```sh
pnpm install
pnpm run build   # src/client/** -> client.js (DSH client module format)
pnpm test        # host routes + client pure logic + bundle shape, 6 suites (LSP cases auto-skip without gopls)
```

CI: `.github/workflows/ci.yml` (Node 20 + pnpm + gopls, runs on push/PR).

Host routes are served under `/code-explorer/api`: `fs.list fs.read fs.write fs.create fs.rename fs.delete git.status git.diff git.fetch git.pull git.push git.stage git.unstage git.commit git.discard git.branches git.checkout git.blame lsp.request lsp.diagnostics lsp.status search.files search.text skills.list skills.read skills.write skills.create skills.delete api.send`. All file routes are fenced to the session workspace (reads additionally allow sibling directories and Go toolchain roots for cross-repo jumps; writes are workspace-only and support an optimistic-concurrency `baseMtime` guard that refuses to clobber external edits). Git index routes resolve paths against the **repository root** with a double fence, supporting multi-repo workspaces and deleted files.

## License

MIT © 2026 wang-jun-07
