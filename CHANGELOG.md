# Changelog

## 1.4.2 (2026-11-11)

### Fixed

- **Branch-changes baseline used a stale LOCAL default branch.** `detectBase` stripped the `origin/` prefix from the `origin/HEAD` target, so `merge-base` ran against local `master`/`main`: whenever the local copy lagged behind the remote, the "branch committed changes" list inflated with the remote's own history (e.g. 141 files / 159 commits for a small feature branch). The baseline is now the remote-tracking ref (`origin/master` / `origin/main`); local branch names remain the fallback only when no remote ref exists.
- **"变更行 0" chip on files the changes list insists are modified.** Diffs without content hunks — mode/permission-only changes, binaries, rename/copy metadata, empty additions — now carry an explanatory `note` from `git.diff`, and the whole-file view shows it as a chip instead of the baffling zero count.

### Tests

- Regression: mode-only diff returns the explanatory note; a feature branch's base resolves to `origin/main` (remote-tracking default), while a checkout of the default branch itself still reports no base.

## 1.4.1 (2026-11-11)

Quality review round: an independent audit (separate agent, read-only, all findings reproduced in sandboxes) found 1 critical + 6 major + 10 minor issues; every one is fixed with regression tests (suite now 353 assertions).

### Fixed — data loss

- **Workspace replace could permanently truncate files >4 MiB**: `fs.read` returns a capped prefix and the replace flow wrote it back over the original. Replaces now skip truncated files with a per-file error.
- **Skills editor could truncate SKILL.md >1 MiB on save**: `skills.read` now reports `truncated:true` and the editor blocks saving truncated content (warning chip + toast).
- `readFencedText` / `skills.readCapped` read only the capped prefix of oversize files instead of buffering multi-GB files into the host process (OOM risk).

### Fixed — fences & git safety

- **Symlinked skill directories** (e.g. `.agents/skills/evil -> $HOME` carried by a cloned repo) could smuggle reads/writes/deletes outside the skill roots — all four skill routes now do a realpath containment re-check.
- **`fs.create` / `fs.rename` destinations** resolved lexically — a symlinked dir inside the workspace could redirect creates/moves outside. Both now realpath the nearest existing ancestor and re-fence (`resolveFencedNewPath`).
- **Parent-tree reads exposed hidden directories**: when the workspace sits directly under `$HOME`, `fs.read ../.ssh/...` was allowed. Extra read roots now refuse any path with a dot segment.
- **Cross-session cache leak**: `extraReadRoots` cached the first workspace's roots process-wide; later sessions inherited them. Roots are now computed per call (only the workspace-independent Go roots are cached).
- **Git write routes on enclosing repos**: with the session cwd inside a larger repo, `commit`/`push`/`stash`/`checkout`/`pull`/`fetch` silently mutated the repo beyond the workspace while `stage`/`discard` refused it. All write routes now share one fence (`fencedRepoRoot`) and refuse with a clear error; reads (status/diff/log/blame/branches) stay lenient.
- **`git.revertHunk` race**: the client now sends the rendered hunk header and the host refuses on range mismatch ("diff has changed; refresh") instead of reverting a shifted hunk — previously an agent editing the same file alongside could cause an unrecoverable wrong-hunk revert.
- **Glob metacharacters in filenames** (`a*.txt`) swept sibling files in stage/discard/diff/log/restore — all git pathspecs are now `:(literal)` (blame excluded: it doesn't parse the magic and is read-only).
- `runGit`: maxBuffer overflow no longer counts as success (truncated diffs were returned as complete); timeouts now SIGTERM first and SIGKILL after a 3 s grace so a killed git can clean up `index.lock`.

### Fixed — UI behavior

- Tree refresh/reveal no longer flickers loaded subtrees away (previous listing stays visible while refetching; a failed refresh keeps stale entries).
- Dragging a file onto another **file** row moves it into that file's folder (VSCode behavior) instead of falling through to the workspace root; root-drop only triggers on the bare panel background.
- Switching files clears stale floating UI (file history 🕘, go-to-line, symbol palette).
- Hunk revert is two-step (⟲ arms an inline danger confirm), consistent with every other destructive action.
- Active editor tab auto-scrolls into view; go-to-line clamps to the wrap render cap in wrap mode.
- Auto gutter marks are debounced (220 ms) — rapid tab switching no longer spawns a git process per passthrough file.
- Workspace replace invalidates the search context cache (stale previews) and the cache is bounded to 30 files.
- ripgrep timeouts return partial results with `timedOut:true` instead of burning another 15 s on grep and misreporting "grep could not run".
- `parseCurl`: line continuations are handled in the tokenizer — single-quoted bodies keep literal backslash+newline (multi-line bodies survive roundtrips), double-quoted fold per POSIX; `-c/--cookie-jar`, `-T/--upload-file` & co no longer leak their values into the URL.
- NaN `limit` falls back to the default instead of silently returning empty results.
- LSP servers no longer idle out while the user is reading code (diagnostics/status calls touch the idle timer); `didOpen` sends correct languageIds for `.pyi/.mjs/.cjs/.mts/.cts`.
- `api.send` streams responses and aborts at the 2 MiB cap instead of buffering unbounded bodies.

### Changed — structure

- `curl.js` split out of `apiclient.js` (pure curl wire format: parse/serialize/quote); `searchpanel.js` split out of `overlays.js` (search UI + match highlighting). `apiclient.js` 800→553, `overlays.js` ~750→355 lines.

## 1.4.0 (2026-11-11)

Second competitor-parity round: the remaining VSCode / GitLens / Postman gaps.

### Added

- **Find widget (⌘F)**: `Aa` match-case, `ab|` whole-word and `.*` regex toggles (VSCode parity); invalid patterns show a hint instead of silently matching nothing; matches flash their actual matched text; options persist per session.
- **Workspace replace**: ▸ toggle in the search panel reveals a replace row — per-file ⇄ action and Replace All with a two-step confirm showing the file count; literal replacements keep `$` literal while regex mode honors `$1`/`$&`; every write goes through the `baseMtime` guard so external edits are never clobbered; capped at 200 files per run with a summary toast.
- **Staged diff scope**: `git.diff scope:"staged"` (index vs HEAD); staged-section rows open it, with its own chip label.
- **Git stash suite**: `git.stash.list/save/apply/pop/drop` routes (ref-validated, deterministic nothing-to-stash pre-check incl. the untracked-only case, conflict-tolerant apply/pop); collapsible 贮藏 section in the Changes panel with inline message input, include-untracked checkbox, and Apply/Pop/Drop (two-step) per row.
- **File history (GitLens-style)**: `git.history` route (`log --follow`, relative dates); 🕘 head button opens the history overlay; clicking a commit shows that commit's diff **scoped to the file** (`git.diff` commit scope gained an optional path filter).
- **Hunk-level revert**: `git.revertHunk` re-derives the patch fresh and reverse-applies it via `git apply -R -` (stdin; worktree-only, index untouched); ⟲ button on every hunk row in both diff views, working scope only.
- **Editor tabs**: open files join a tab strip (dedup, capped 15, persisted); switching restores per-tab cursor+scroll; middle-click or ✕ closes with neighbor fallback; unsaved-edit guard; file/folder deletion evicts tabs.
- **File tree**: drag-to-move (files and folders, root drop included) with canDropInto guards and drop-target highlight; auto-reveal expands ancestors and scrolls to the file opened from search/quick-open/LSP jumps; type-tinted file glyphs shared with the changes tree.
- **API tester**: collapsible Query Params table (merged into the URL at send and in copy-as-curl, same-name override, fragment preserved) and a per-request timeout input (clamped 1–120 s); both persist in drafts, history and favorites.

### Changed

- `openDiffSource` always reloads from the host (mtime LRU keeps it cheap) — the source view can no longer show stale content after a hunk revert or external edit.
- `parseDiff` drops the trailing empty segment, removing the phantom context row at every diff tail.

### Tests

- 45+ new assertions across the round: find matcher (smart-case/words/regex/zero-length), replace engine ($-escaping, capture refs, multiline anchors), staged scope, stash flow (incl. untracked sweep + pop restore), history + scoped commit diff, revertHunk (two-hunk selectivity, range/fence errors), tab list algebra, mergeParams, tree drag/reveal helpers, DiffView revert wiring.

## 1.3.0 (2026-11-11)

Competitor-parity round: every module benchmarked against VSCode / GitLens / Postman and closed to the gap.

### Added

- **Diff view (VSCode parity)**: side-by-side mode (▥ toggle, persisted) with aligned mod rows, wrapped cells and empty-side fillers; word-level intra-line highlight in **both** views (token prefix/suffix trim, zero-width caret for pure insertions); ↑↓ change navigation with centered scroll and outline highlight.
- **SCM (VSCode/GitLens parity)**: `git.push` route — pushes to the exact upstream refspec, publishes with `-u` when no upstream exists, refuses detached HEAD, never force; push button in the branch palette; **amend** toggle in the commit box (`git commit --amend -m`); opening any file with uncommitted changes now loads gutter diff marks automatically (untracked files skipped).
- **Search (VSCode parity)**: results grouped under collapsible sticky file headers with counts; every match occurrence highlighted in result rows and context lines with the engine's smart-case rule (regex-aware, invalid patterns degrade safely).
- **API tester (Postman parity)**: **Copy as curl** (`⧉ curl`, POSIX-quoted, one flag per line, re-importable by the curl parser — roundtrip tested); **environment variables** (`{{}}` table persisted in localStorage, substituted in URL/headers/body/form values at send time, unknown names stay literal).
- **File tree**: 📋 hover action on every row — click copies the absolute path, ⌥/Alt-click copies the workspace-relative path.
- **Save-conflict guard (VSCode parity)**: `fs.read` returns `mtimeMs`; `fs.write` accepts `baseMtime` and refuses the write when the file changed on disk since load — external edits are never silently clobbered; the editor surfaces a localized conflict notice and refreshes its mtime after each save.

### Fixed

- `parseDiff` dropped a phantom trailing context row (git diff text ends with `\n`), which consumed a line number at the tail of every diff.
- `toCurl` initially split flag names and values across continuation lines; logical units (`-X POST`) now stay on one line.

### Tests

- 27 new assertions: push round-trips against a real bare remote (publish, tracking, diverged refusal, detached refusal), amend semantics (replaces instead of adding, folds staged content), mtime guard (stale refusal, untouched file, compatibility), toCurl/substituteVars/buildEnvMap/shellQuote incl. parseCurl roundtrips, pairRows/intraLineDelta/intraMarks, matchRanges/highlightText.

## 1.2.0 (2026-11-11)

### Added

- **Git commit flow**: `git.stage` / `git.unstage` / `git.commit` host routes; the Changes panel splits into Staged/Changes sections with per-row and per-directory +/− actions, section-level stage-all/unstage-all, and a commit box (Enter commits the staged set; with an empty index the button explicitly becomes "Stage All & Commit").
- **Image preview**: `fs.read` returns base64 data URLs for png/jpg/gif/webp/avif/bmp/ico (10 MiB cap, oversize reports kind without payload); the editor renders them on a checkerboard backdrop. SVG joins the default-preview set (rendered via charset-safe data URL, toggle to raw).
- **Search enhancements**: `search.text` accepts `regex` and `words` options; include filters support comma/semicolon-separated multi-globs with `!` exclusion; engine errors (e.g. invalid patterns) surface inline instead of silently falling back. Result rows expand ±3 context lines on demand (click any context line to jump to it).
- **API tester**: automatic request history (localStorage, newest first, capped 30, full request snapshot, one-click restore, per-row delete/clear), named favorites (☆ Save, same-name replaces), and multipart/form-data sending (host builds FormData so fetch sets the boundary; curl `-F` imports as multipart fields).
- **Editor**: word-wrap mode (↩ button / ⌥Z, persisted per session, flow layout with inline line numbers, capped at 5000 lines) and a go-to-line palette (⌘G / clickable Ln-Col chip).
- **Multi-language LSP**: server descriptor table — Go (gopls), TS/JS (typescript-language-server), Python (pyright-langserver or pylsp); one server per language per project root; `lsp.status` reports the active server label; missing binaries degrade gracefully. Token click-jump extended to TS/JS/Python.
- **Syntax highlighting**: json (with distinct property names), yaml, sh, toml, rust, java, c/cpp, sql (case-insensitive keywords), css; hash-comment languages no longer mis-tokenize `//` inside values.
- **CI**: GitHub Actions workflow (Node 20 + pnpm + gopls); host LSP assertions skip instead of failing when gopls is absent.
- English README (`README.en.md`); fence regression tests (symlink refusal, escape refusal for create/rename/stage).

### Fixed

- `git.discard` failed with ENOENT on deleted files (lstat-based resolution required the file to exist); it now resolves repo-relative paths without touching disk.
- Git working-tree paths in multi-repo workspaces resolved against the session cwd instead of the selected repo root (discard/stage/unstage hit the wrong tree or threw).
- Unborn-HEAD repos: unstaging now falls back to `git rm --cached --ignore-unmatch` (restore/reset need a HEAD commit); localized git messages no longer break the empty-index no-op.
- Dropped the dead `IconBolt` import; commit-list rows and the new commit box no longer share the `ce-commit` class name.

### Changed

- **Refactor**: `components.js` (2033 lines) split into `pathtools.js`, `tree.js`, `changes.js`, `overlays.js`, `codeview.js` (pure row builders `computeVisible` / `computeGutter` / `computeWrapRows` / `buildTokenCells`) and `code.js` (stateful orchestrator); `findModuleRoot` generalized to `findProjectRoot` with per-language markers.
- gopls-specific UI copy generalized to "language server"; the head chip shows the detected language instead of a Go-only badge.

## 1.1.0 (2026-11-10)

- Renamed `@local/dsh-code-explorer` → `dsh-plugin-kit`; MIT license + README.
- File tree create/rename/delete, editor save, blame column, branch switcher, whole-file diff marks + change rail, folder discard, tree/list toggle, md/html preview, skills manager (incl. bundled read-only group), Postman-style API tester with curl import, grouped sidebar launcher.
- Host split into `lib/host/*` modules (behavior unchanged).

## 1.0.0

- Initial bundle: Code tab (file tree, virtual-scroll editor with gopls jumps, git changes + diffs), chat call-diff rows, host HTTP API.
