# Changelog

## Unreleased — API: live SSE/EventStream responses

- `api.send` no longer buffers forever on `text/event-stream`: when the response announces an event stream, the live body is handed to a new host capture (`lib/host/streams.js`) and the send answers immediately with `{streaming:true, id, status, headers, ...}`. The capture keeps a bounded 1 MiB retained tail with a byte cursor and the same long-poll protocol as watch/tasks (`api.streamPoll`, `api.streamStop`); a dead client's closed response releases its waiter, finished captures expire after ten minutes, the job cap evicts finished streams before ever clobbering a live one, and everything aborts on plugin unload.
- Client `src/client/sse.js` (pure): WHATWG-shaped incremental frame parser — partial frames held across deltas, multi-line `data:` joined, `event`/`id`/`retry` carried, comment keep-alives skipped, CRLF tolerated, `id` persists across frames; `foldStream` folds poll snapshots into the view model with reset-on-evicted-cursor semantics and a 2000-event window.
- The response pane grows an **Events tab** while a stream is live: one row per event (kind glyph-color chip, `#id`, retry, first-line data with 120-char trim), auto-scrolling, "waiting for server events…" while idle, drop-marker when early events were evicted, a Stop button in the status row, and the tab count live-updating (`事件流 · 5 ●`). A subsequent normal send stops the old capture first. Extracts and timeline still run for non-streaming responses; a streaming send records history without a body.
- Fixes caught by the own-suite on the way: the first payload object used to be assembled with a spread order that let the snapshot's empty `done:false` mask the real status fields, `trimStreams` counted the just-created stream against its own cap, `stream.snap` was assembled in three inconsistent ways (closure/call/this), the timeout beat returned a bare `beat:true` without current state, and the pump's `!reader` fallback assumed `response.text()` exists.
- Regressions: host — real-HTTP server end-to-end (switch to capture, frames streamed until close, unknown-stream refusal); client — parser partial/complete/multi-line/CRLF/comment/id-persistence, fold hold/emit/reset, ApiView streaming send tab switch and per-event rows with kind and data.

## Unreleased — API: post-response extracts, OpenAPI & Postman collection import

- **Extracts tab**: each request carries rules `{name, source, expr, enabled}` with six sources — JSON path (`$.data.items[0].id`, a dot/bracket walker with quoted-key support, no wildcard engine on purpose), response header (case-insensitive), status code, full body, regex capture (group 1 else group 0), and the resolved request's own query. After every settled send `applyExtracts` writes hits into the ACTIVE environment (creating/overwriting rows by name) and reports misses in the tab footer (`uid · gone not found`); an all-miss run never half-writes empty variables, and with no active environment the tab says so instead of silently dropping. Rules ride drafts, history and favorites through the existing v2 snapshot (legacy snapshots normalize to no rules).
- **Collection import in the same dialog that already eats curl and .bru**: `openimp.js` detects pasted JSON as OpenAPI 3 (`paths × methods` → one request per operation: servers[0] + `{param}` → `:param` path rows + query params with examples, first-content-type bodies sampled from `example ?? schema` one property per type, names from summary/operationId) or Postman v2 (`{info.schema collection}`, folders flattened recursively, raw/urlencoded/formdata bodies, query-object URLs). Imports land as **favorites in bulk** (deduped by name against existing favorites, capped) with the first operation applied to the editor; malformed or empty collections surface through a real in-dialog error line (`setImportError` now actually declared and cleared on retype).
- Two correctness bugs caught by the own-suite: `runExtract` no longer demands an expression for the status source, and `postmanUrl` referenced an undeclared binding on object-shaped URLs.
- Regressions: jsonPath walk/miss/quoted-key, every source of runExtract including broken-regex and non-JSON refusal, applyExtracts write+miss+disabled-rule+all-miss-no-write (host-store level), OpenAPI three-operation spec (path-param syntax, query examples, sampled JSON body, form path), Postman folder flatten + urlencoded mapping, shape-detection refusals, the extracts tab render/round-trip (add → name/expr hold → remove empties), OpenAPI import applying the first operation and storing every favorite.

## Unreleased — task runner: run package.json scripts, click a failure, land in the file

- Host `lib/host/tasks.js`: jobs launch `npm run <script>` with no shell, gated twice — the name must be shape-clean AND present in the workspace's own package.json `scripts`, so a hand-built request cannot smuggle a command. Output streams into a per-job ring buffer (1 MiB tail, `dropped` + byte `baseSeq` when the head is evicted); `task.poll` long-polls new bytes with the same cursor protocol as `watch.poll` (response-close drops waiters, `beat` empty answers keep the pipeline warm), `task.kill` SIGTERMs then SIGKILLs after a 3 s grace, jobs are capped at 12 with a 10-minute TTL once finished, and everything dies with the plugin effect. `task.scripts` also reports which scripts are currently running so the palette shows live dots.
- Client: the Command Center's **Run Tasks…** opens a script palette (name + command + running marker), starting one swaps to an output panel that streams the tail auto-scrolled, distinguishes stdout from stderr, and reports running / exit-code / failure status. `failureAt` recognises go-test, tsc, eslint-colon, pytest-frame and rustc-arrow shapes and renders those lines as jump buttons into the editor; `foldTaskOutput` (pure) folds a poll snapshot into the panel state, honouring `reset` (buffer head evicted → replace the window) and byte cursors otherwise.
- Correctness caught in its own regression: two poll answers can land before a repaint, so folding happens INSIDE the state updater (prev is the truth, not a render-time ref) — and the fold must carry the job identity fields (script, pollSeq) through, or the next answer is silently rejected as stale.
- Regressions: host — scripts listing, absent-script and flag-shaped refusal, a real npm run streamed across polls with stdout/stderr split, exit code 3 surfaced, kill-on-finished reporting already, unknown-job refusal, SIGTERM path on a live job (npm-gated, skips cleanly where npm is absent). Client — every failure grammar plus noise refusal, fold append/reset/lineCount, palette rows and running dot, jump button wiring, stop affordance and its disappearance on completion, dropped-tail badge, and a CodeBody end-to-end: command → scripts → run → start → pump folds streamed chunks then stops at done with the exit code.

## Unreleased — Git deepening: compare refs, cherry-pick, conflict sides

- **Compare References** (Command Center `≷`): a dialog with base/head fields fed by the live branch list (local then remote, click-to-fill); submitting runs a new read-side `git.compare` route that verifies both refs through `rev-parse --verify --end-of-options` (flag-shaped and unknown refs refused before any git process spawns), diffs the two trees (`--name-status -z`, renames threaded through as `{from,to}`), and reports shortstat + commit count. Results land as a dismissible group on the Changes panel; each row opens a per-file diff through the new `scope:"compare"` of `git.diff`, and live watch refreshes an open compare diff exactly like a working diff.
- **Cherry-pick from history**: each commit row in the branch-commits list gains a `⤵` control with the repo's established two-step confirmation (first click arms to ✓, second picks). The write-side `git.cherryPick` route refuses non-hex shas before spawning, requires a clean tree with a human-readable reason, and treats the sequencer state — not git's exit code (conflict text on stdout defeats the ok heuristic) — as the authority: conflicts come back as `{conflicted:true}` with the updated status.
- **Conflict resolution UI**: when the host reports `inProgress` (cheap `.git` marker probes for CHERRY_PICK_HEAD / MERGE_HEAD / rebase-merge / REVERT_HEAD added to gitStatusAt), the Changes panel opens a sequencer banner listing the UU files, each with **ours / theirs** buttons routed through `git.resolve` (checkout --side + auto-stage, fenced like every git write), plus **Continue** (`--continue --no-edit`) and **Abort** for the whole sequencer. Busy state disables all sequencer controls to stop double-submits.
- `parseNameStatusZ` matches git's real `-z` layout — status and path are SEPARATE NUL fields (`R100\0from\0to\0`), caught by its regression on day one.
- Regressions: host — compare file list with rename status, merge-base/shortstat/count, unknown-ref and flag-injection refusal, compare-scope file diff, conflicting pick opening the sequencer, non-hex refusal, resolve-theirs content + staging, unknown side refusal, continue producing the cherry-picked commit with the original subject, re-conflict + abort cleaning the tree, sequencer kind whitelist, name-status NUL layout. Client — banner with both side buttons wired to callbacks, pick arm/confirm two-step, compare group rows with refs threaded to `onOpenDiff`, dismiss control, and the full CodeBody flow command→dialog→branches→compare→panel→diff→DiffView.

## Unreleased — editor productivity: workspace symbols and format-on-save

- **Search Symbols in Workspace** (`⌥⌘O` or Command Center): a new palette queries `workspace/symbol` through the existing per-root language servers (gopls / typescript-language-server / pyright) with a 220 ms debounce and a local seq guard so slow answers can never land over a newer query. Rows show the kind glyph, `name · container`, and the workspace-relative file:line; picking a row opens the definition with the normal navigation stack and match flash. Without an open document the route probes the workspace root for the first language marker (`go.mod`, `package.json`, `pyproject.toml`…), so the command works before the first file is opened. The client declares `workspace.symbol` (incl. `resolveSupport.properties: ["location.range"]`) in the initialize capabilities; symbols without a resolvable location are dropped rather than shown dead.
- **Format On Save** (default on, toggle persisted): saving a Go/TS/JS/Python draft now routes through `fs.formatDraft` — the draft is written through the existing `baseMtime` conflict guard first, the server formats what is on disk, and the formatted text is re-written and adopted into the editor buffer. The save notice distinguishes *Saved and formatted* from *Saved (formatter did not run)*; a formatter crash or timeout NEVER loses the save — the draft is already on disk and the reply carries `formatted:false` with the reason. A plain `fs.write` path stays untouched for non-LSP files and when the toggle is off.
- `applyTextEdits` (host, exported and unit-tested) converts LSP UTF-16 ranges to absolute offsets and applies right-to-left, clamping ends past EOF and defensively skipping overlapping edits; `textDocument/formatting` capability declared in initialize.
- Regressions: right-to-left multi-edit application, overlap skip, EOF clamp; workspace-symbol fuzzy query through the real gopls, marker probing without a document hint; `fs.formatDraft` writes-then-formats (disk content equals the returned text), advances mtime, refuses blind overwrite via `baseMtime`, and leaves the file intact on a refused format; client palette open→debounce→request→state rows→pick opens the definition; save routes a `.go` draft through `fs.formatDraft` with the guard and adopts the server-formatted text.

## Unreleased — live refresh: the workspace follows the disk

The Dev Workspace used to show the disk only as of the moment it loaded a file — an Agent editing in the background, a `go fmt` from the terminal, or a `git checkout` left the editor, tree and Git badges frozen until the manual ⟳. Now the host watches the workspace and streams coalesced change batches to every open workspace tab.

- Host `lib/host/watch.js`: one recursive `fs.watch` hub per resolved workspace root (shared by all sessions on it), events coalesced per path into monotonic batches on a 250 ms debounce; everything under `.git/` collapses into a single git tick because consumers only need "status changed". A retained log answers each client cursor; cursors older than what the log keeps get `reset:true` instead of a misleading partial list. New route `watch.poll` delivers batches by HTTP long-poll over the existing private-prefix JSON API — no new transport, bounded wait beats back so dead clients self-heal; response-close drops waiters, idle hubs are swept after five minutes, everything closes on plugin unload. Platforms without recursive watching (or with exhausted descriptors) degrade to `supported:false` rather than pretending.
- Client `src/client/watch.js`: `parentDirs`/`docAction` are pure folding helpers; `createWatchLoop` is the poll state machine — one baseline cursor per mount, capped error backoff, slow retry so a transient watcher failure heals itself. CodeBody folds batches into every surface: clean documents reload in place with cursor and scroll preserved (one merged `fs.read` per change, mtime-equal touches are dropped), the file tree refetches only the directories whose listings are actually shown without collapsing anything, an open working/index diff refetches its text, and git status refreshes through a debounce timer.
- **A dirty draft is never auto-discarded.** When the changed path is the open document and an unsaved edit exists, the banner offers the VS Code choice instead: Reload (discard draft) or Keep editing — the ⌘S `baseMtime` guard keeps blocking blind writes throughout, and live refresh never issues a host write on its own.
- Command Center gains **Toggle Live Refresh** (persisted, default on) and the panel warns once when the platform cannot watch, so manual ⟳ stays the honest fallback.
- Regressions added: host — baseline cursor, missing-cwd and missing-workspace errors, created-file delivery, per-path coalescing, `.git` ticks staying out of file paths, settled-cursor empty beats, and the pure `snapshotFor` cursor math (retention reset, per-path slicing, git flag, not-ready, unsupported). Client — loop state machine (baseline, streams, backoff, unsupported retry, stop), plus a full CodeBody lifecycle: exactly one baseline per mount, clean reload in place with cursor/scroll preserved, stale-dir invalidation, debounced git refresh, banner-without-buffer-touch for dirty drafts, no extra read on the conflict path, both banner round-trips (keep editing / reload discarding), and "live never writes".

## Unreleased — right sidebar opens at its maximum width

- The host seeds the right column's width preference at **45% of the frame** on its first opening (`RIGHTBAR_DEFAULT_RATIO` in `@deepseek-ai/dsh-client-ui-layout`), which is too narrow for an editor, an embedded browser and a request workbench. `rightbarwidth.js` now writes the preference once before any opening, so the **first opening takes the widest the frame allows** — the same ceiling the drag handle stops at (`[300px, 70%]` plus the frame's 400px centre reservation). The request is deliberately above the ceiling rather than a copied ratio, so the host keeps ownership of its own maximum.
- Dragging is unchanged and still wins: the handle writes the host store directly, and once a gesture settles the rendered track is measured and remembered (the host preference is in-memory only), so a later opening — including after a reload — restores the width the user chose instead of jumping back to the maximum. The ceiling is a fraction of the frame, so widening the window before that first choice moves the pending maximum with it; a panel already on screen is never re-widened under the user.
- The width action lives on the layout service's internal store delegation, not on the published `ILayout` face, so the whole feature is a probe: without a callable `setRightbar` it installs nothing and the host's stock behavior is left untouched.
- Added regressions: seam probing without assuming the seam exists, ceiling request landing on the host's clamped maximum, a remembered width restoring the first opening, junk/below-floor stored values ignored, a settled drag remembered only for the rightbar handle and only when a track is rendered, the measurement deferred until the gesture settles, the ceiling tracking a wider window before any choice, an already-chosen or already-visible panel left alone, and unload unhooks both listeners.

## Unreleased — copy-path feedback at the click site

- Copying a path from Changes (tree and flat views, including deleted files) or the Explorer row actions now flips the button glyph to a green check for ~1.4 s, with the title swapping to "Path copied". The previous success notice only reached the Code view's status bar and was easy to miss next to the rows — the click site itself stayed silent. Explorer context-menu copies flash the same row glyph after the menu closes.
- Failures keep reporting through the error notice and never show the check, so the feedback cannot fake success. The button clears its timer on unmount.
- Added regressions: success flips glyph/class/title and writes the expected absolute/relative text, failure keeps the copy glyph, and the Explorer row action flashes ✓ plus notifies.

## Unreleased — source-studied refinements from the Bruno and VS Code repositories

Both upstream repositories were cloned locally and read at the source level; the following behaviors are ported from their actual implementations rather than from documentation summaries.

- **Bruno path params**: `:name` segments in the URL path become rows in a second Path Params table inside the Params tab. The editor URL keeps them literal; enabled values substitute (URL-encoded) into the wire URL at send time, exactly like Bruno's `interpolateUrlPathParams` (`packages/bruno-app/src/utils/url`). Unresolved segments stay literal.
- **Bruno sync fidelity**: `syncParamsFromUrl` now follows the collections reducer (`ReduxStore/slices/collections`): disabled query rows survive URL edits (re-joining when re-enabled), path rows keep their values across URL changes, and vanished `:name` segments drop their rows.
- **Bruno `.bru` collection interop**: new `brucol.js` speaks a compatible subset of the v2 grammar (`packages/bruno-lang`: `meta{}`, method block, `params:query`/`params:path` with `~` disabled prefixes and quoted keys, `headers{}`, `auth:basic`/`auth:bearer{}`, indented `body:<mode>{}` blocks with column-0 `}` terminators, unknown blocks skipped). The import dialog auto-detects `.bru` documents next to curl, and the Code menu gains a **Bruno · .bru** entry that exports the request with `{{var}}` templates verbatim — the property that makes Bruno collections Git-friendly.
- **VS Code preserve-case replace**: the replace row gains the `AB` toggle; the replacement case pattern is ported from `base/common/search.ts buildReplaceStringWithCasePreserved` (ALL-CAPS / all-lower / capitalized / mirrored, per hyphen- and underscore-segment). Like VS Code it only applies to static replacement text, not `$`-group patterns.
- **VS Code current-match highlight**: while the find widget is open, the active match gets a solid highlight (token runs are split at the match range) and a distinct gutter color, separating it from the other matches.
- **VS Code sticky tabs**: the tab context menu pins/unpins; pinned tabs move to the front of the strip and survive Close Others / Close to the Right / Close All (`excludeSticky` in `editorActions.ts`), while an explicit single close still closes them. Pins persist with the session navigation state.
- **VS Code problems filters**: the Problems panel header shows per-severity counts with error/warning/info toggles (markers view filter model), reporting shown/total while filtered.
- Regressions added for all of the above: preserve-case matrix and per-match application, path-param sync/substitution/wire resolution, disabled-row retention, `.bru` round-trips (raw/form/multipart/auth/quoted keys/unknown blocks), pin ordering and bulk-close exclusion, current-match highlighting, and severity filtering.

## Unreleased — Bruno-style API request workbench

- The curl tool now follows [Bruno](https://github.com/usebruno/bruno)'s request model: **URL ↔ Query-params two-way sync** (typing `?a=1` in the URL fills the Params table; editing the table rebuilds the URL, disabled rows leave it but keep their values), **named environments** with a tool-row selector and Bruno's "No Environment" state (the legacy flat variable list migrates into one active *Default* environment on load), a dedicated **Auth section** (None / Bearer / Basic) that generates the `Authorization` header at send time and overrides a same-named manual header, a response **Timeline** tab showing the exact resolved wire request (post-substitution URL, final headers, body/multipart, timeout) next to Body and Headers, and a **</> Code** menu generating runnable **curl / JavaScript fetch / Python requests** snippets from the resolved request.
- curl import hardened toward curlconverter (the parser Bruno uses): `$'ANSI-C'` quoting, attached short-flag values (`-XPOST`, `-H'K: V'`, `-d'{}'`), `--flag=value` long forms, `--form-string`, `--url-query`, curl's empty-header form (`-H 'Name;'`), `-u` and `Authorization: Bearer/Basic` headers folding into the Auth section (undecodable values stay headers), and consecutive `k=v` data chunks without a non-form Content-Type importing as **form-urlencoded pairs** instead of a raw body. Imported raw bodies pick their language (json/xml/html/text) from the Content-Type or a shape probe. Export emits `-u` for basic auth and an `Authorization` header for bearer, so `toCurl → parseCurl` round-trips the auth section.
- Architecture: request-data logic moved out of the 571-line component into two pure modules — `reqmodel.js` (sync, environments, auth, `resolveRequest` as the single builder shared by wire/Timeline/codegen, history helpers) and `codegen.js` (snippet serializers) — leaving `apiclient.js` as UI wiring only; drafts and history/favorite snapshots carry `v: 2` and legacy snapshots are normalized (old send-time param merge) on restore.
- Added regressions for tokenizer/quoting/attached flags, form & auth import, export round-trips, both sync directions and their stability, environment migration/selection/rename/delete, auth override semantics, resolveRequest substitution, all three generators, and component flows (query sync, environment switching driving `{{host}}`, Timeline content, bearer/basic wire headers, codegen clipboard, curl import mapping); updated the `-u` and `-d k=v` parser expectations to the new Bruno-style shapes.

## Unreleased — VS Code editor ergonomics

- Dev Workspace adopts three [VS Code](https://github.com/microsoft/vscode) editor workflows: an **editor-tab context menu** (Close / Close Others / Close to the Right / Close All, with disabled states and the existing dirty guard), **Reopen Closed Editor** (`⌘/Ctrl+Shift+T`, a bounded most-recently-closed stack restoring cursor position), **find & replace** (`⌘/Ctrl+Alt+F` or the find widget's ⇄ toggle: Replace / Replace All with regex `$1`/`$&` expansion; results land in the edit buffer for review and save through the existing ⌘S mtime conflict guard — never written blindly), and a **Problems panel** (`⇧⌘M` or the diagnostics chip: severity-sorted diagnostics, click to jump to the line).
- The Command Center gains Find and Replace, Toggle Problems, Reopen Closed Editor and Close All Editors entries, keeping keyboard and pointer workflows equivalent.
- Architecture: tab-list transitions (`tabs.js`) and the replace splice (`codeview.js applyReplace`, right-to-left per line with stale-match refusal) are pure functions; `ProblemsPanel` joins the shared overlays and dismissal registry.
- Added regressions for close-others/right/all through the real menu, MRU reopen ordering, replace-one/replace-all/regex-group replacement, edit-buffer-only writes, problems open/jump/Escape, and command-center contents, running the workbench with effects enabled.

## Unreleased — terminal entry beside the workspace

- Dev Workspace now opens DSH's own terminal beside itself: a **New Terminal** button in the toolbar tool group and a Command Center entry of the same name call `ctx.sidebarRight.openTab('terminal', { preferNewPane: true })`, so the terminal splits the current docked pane under the host's two-pane and room rules and falls back to a tab in that pane. A successful open also clears a stale error banner.
- The plugin renders no terminal of its own. xterm.js, input ownership, window holds, reload bindings, theme and the permission model stay with `@deepseek-ai/dsh-client-ui-sidebar-terminal` and `@deepseek-ai/dsh-api-terminal-controller`, so a DSH upgrade cannot strand a second terminal implementation here.
- Availability is a registry probe, not a guess: profiles without the `terminal` tab type hide both entry points instead of showing a control that fails. Missing session, missing capability and a failed open each report their own banner text. The result is trusted from the host rather than inferred by diffing the tab list, because the `terminal` type is `multiple: true` and every open is a new instance.
- The host's **New terminal** row is folded out of the left navigation (`LEFT_TOOL_HIDDEN_KINDS`), following the one-primary-entry rule already applied to file browsing: Dev Workspace owns the terminal entry. The global `⌃` shortcut is untouched, so a terminal stays reachable without opening the workspace. A restored selection for a folded-away tool hands the main panel back to Conversation instead of stranding a blank page. README documents that terminal commands run with system-user permissions, outside the Agent's sandbox and approval policy.
- Added terminal-entry regressions for the registry probe, hidden/unavailable path, split preference, trusted success, missing session, open failure, hostile registry, inert fallback, and zh/en dictionary parity; added left-navigation regressions for the folded terminal row and stale-selection recovery, and moved the multi-instance close semantics onto the remaining multi-instance tool.
- Verified syntax, full regressions and the host contract (`preferNewPane`, `openTab`, `mounted`). Authenticated live visual inspection remains unavailable in this environment.

## Unreleased — refined browser chrome

- The browser tab is now a window with its own sub-tab strip: every sub-tab owns a carrier (Desktop webview guest / Web iframe), address history and title; the strip switches, closes per tab and adds tabs with + (new tabs follow the configured start page). Desktop keeps every guest resident; Web keeps only the foreground page alive and restores the others from the per-window checkpoint. Page popups (`window.open` / `target=_blank`) open as background sub-tabs; the host strip keeps the fixed browser label while page titles live on the sub-tab chips. Legacy single-page checkpoints migrate into a one-tab window; up to 10 sub-tabs per window.
- Grouped back/forward/reload controls and secondary tools around a prominent address field, with bookmark and Go actions inside the field.
- Replaced character glyphs with consistent SVG icons, added selected tool states and local Cmd/Ctrl+L address focus, and replaced the loading text row with a reduced-motion-aware progress line.
- Refined bookmark/settings hierarchy and empty states; narrow panels use a predictable two-row toolbar. Rendering remains owned by the existing DSH carrier.
- Verified syntax, full regressions and UI rule scan. Authenticated live visual inspection remains unavailable.

## Unreleased — copy paths from Changes

- Added accessible copy-path actions to file and directory rows in Changes tree and flat views, covering staged, working and branch changes, including deleted files. Click copies an absolute path; Alt-click copies the repository-relative path.
- Paths resolve against the Git repository root for nested/multiple repositories. Clipboard errors surface instead of reporting false success.
- Split Changes row navigation and actions into sibling controls, preserving drag handles without nesting buttons.

## Unreleased — reliable file-tree deletion

- Split Explorer row navigation and action buttons into sibling controls, removing nested interactive buttons.
- Deleting a file or folder now shows a named confirmation below the row, independent of hover actions. Confirming shows progress and refuses duplicate requests; failures remain visible for retry.
- Added file/folder cancellation, confirmed deletion, duplicate prevention, failure feedback and editor notification regressions.

## Unreleased — Explorer and Changes file dragging

- Added typed internal drag data for Explorer, Changes tree/list and editor tabs, scoped to the workspace and Session.
- Drop Explorer files into the editor to open source, or Changes files to view their captured repository/scope diff, including deleted files. Editor tab drags reorder views without moving files.
- Explorer folder moves retain their existing disk-move behavior. Plain text, OS files, directory-to-editor and foreign-session drops are not accepted; unsaved edits remain protected.

## Unreleased — embedded browser bookmarks and settings

- Added an enhanced Browser page using the DSH lease-scoped Desktop browser bridge (restricted iframe fallback on Web), without bundling another browser engine. Native history, approved popups, Workspace storage isolation, explicit page restore and system-browser escape remain available.
- Added profile-persistent bookmarks, favorites bar, folders, search, edit/delete, home URL and new-tab start settings. Host persistence serializes writes and rejects stale revisions; UI and `browser_bookmarks` use the same service.
- Settings accurately explain that DSH currently exposes no Chrome extension install/enable/configuration API.
- Added browser regressions for URL policy, durable data, conflict/retry behavior, guest acquisition/disposal/crash recovery, requested URL preservation, Workspace partitioning and UI settings flows.
- Verified real Host browser-data initialization; live authenticated Electron page rendering and extension support remain outside automated verification.

## Unreleased — left tool entries toggle workspace tabs

- Left entries now close an already open matching tool tab. The last real tool tab also collapses the right workspace; retained guide tabs do not keep it open. Other tools and other sessions remain untouched.
- A manually collapsed workspace is revealed before any close. With multiple matching instances (such as terminals), the active matching instance is closed first. Browser pages can reopen immediately after a toggle close.
- Registered native close cleanup guards for unsaved Code IDE and Skills edits, protecting both left-entry closes and native tab closes.
- Added toggle, final-tab, session-isolation, multi-instance, immediate-reopen and unsaved-close regressions.

## Unreleased — left navigation, right workspace

- Moved all toolbox entry points into native left panel rows alongside Plugins and Automations. Selecting a tool restores Conversation and opens the current session’s right workspace through public layout/sidebar services.
- Removed owned right guide entries and replaced the duplicate right launcher with a workspace hint. Browser/terminal and other registered tool entries follow the live registry; browser reuse now reveals a collapsed workspace.
- Added regressions for global-panel navigation, current-session targeting, no-session feedback without delayed cross-session opens, dynamic tools and unload cleanup.

## Unreleased — consistent transient-layer dismissal

- Added one shared, non-modal pointer/Escape dismissal registry for API dialogs, IDE palettes, file menus, skills forms and temporary destructive confirmations. Outside pointer events continue to their destination; Escape affects only the top visible layer, with IME protection and listener cleanup.
- Favorites and curl import retain drafts when dismissed. Tool-page hiding closes transient UI without cancelling document edits. Trigger buttons toggle without reopening accidentally.
- Fixed duplicate input/palette keyboard handling in quick open and symbol lists, and duplicate trailing insert rows in legacy request drafts.
- Added listener-lifecycle and component regressions plus 9 Chrome fixture checks using actual DOM pointer/keyboard events. See [interaction audit](docs/interaction-audit.md) for coverage and verification limits.

## Unreleased — API request builder layout

- Reorganized API debugging around a method/URL/Send row followed by configuration tabs; import/export, favorites and history remain in a compact utility row.
- Added a shared request-fields table for query parameters, headers, form/multipart bodies and environment variables, with Name/Value/Description columns, enable checkboxes, row deletion and a trailing insert row. Variables are now a configuration tab.
- Disabled fields remain in drafts/history/favorites but are excluded from HTTP requests and curl exports. Old rows without an enabled flag stay enabled.
- Verified 452 assertions across all suites; checked light/dark component previews at 1100px and 390px container widths. These previews use fixture data and do not represent a live authenticated DSH session.

## Unreleased — consistent editor navigation

- Opening files, Git diffs, commits and chat diffs dismisses transient panels so search cannot cover the selected document. Clicking the current editor tab also dismisses panels without reloading the file.
- Search, quick open and the command center replace each other. Search inputs survive dismissal; Escape closes navigation panels before cancelling an editor draft.
- Centralized unsaved-edit checks protect file navigation and refresh. Added regression coverage for file clicks, retained queries, panel switching, Git navigation and draft protection.

## Unreleased — unified Dev Workspace

- Merged the primary file browsing and code editing entry into **Dev Workspace / 开发工作台**. The existing Code IDE `TreePanel` is now the launcher’s single primary workspace explorer, with file operations, previews, search, editing, LSP and Git review in one context.
- The Start launcher filters the host’s redundant `files` guide entry to avoid presenting two competing workspace file browsers. The host file page remains available through host capabilities for compatibility.
- Renamed the in-workspace Files control to **Explorer / 资源管理器**, clarified launcher grouping, and added a regression test that prevents the duplicate file entry from returning.

## Unreleased — Code IDE command center

- Renamed the Code Explorer surface to **Code IDE / 代码 IDE** across the launcher, tab metadata, locale and package documentation.
- Added a keyboard-first Command Center (`⌘/Ctrl+Shift+P`) that unifies file browsing, source control, workspace search, quick open, current-file symbols, word wrap, side-panel visibility and refresh. Actions reuse existing handlers so navigation state and concurrency guards remain consistent.
- The interaction direction follows the continuous workbench model documented by [VS Code’s user interface](https://code.visualstudio.com/docs/editing/getting-started/userinterface) and [code navigation](https://code.visualstudio.com/docs/editing/editingevolved): one editor context, discoverable commands, breadcrumbs/symbols and source control close to the file.

## Unreleased — browser launcher reuse

- The toolbox Browser launcher now focuses an existing browser in the on-screen session, including older UUID-backed tabs, instead of always creating another page. Existing navigation is preserved; Doubao is only the initial URL when creating a new page.
- Repeated clicks before the sidebar inventory updates are suppressed. Reuse does not cross sessions or close existing pages.
- This change belongs to the plugin launcher; links that explicitly open a new browser page and Chromium renderer processes retain their host behavior.

## Unreleased — scoped code search

- Files search the workspace by default, with an explicit directory field and a folder context-menu action.
- Changes keep filename/path filtering separate from code-content search. Content search derives staged, unstaged and untracked files on the Host; empty changes do not widen to the workspace, deleted files skip, and glob filters only narrow the set.
- Literal Git filenames, nested selected repositories, result batching, and stale scope response handling have regression coverage. Search labels show the active scope.

## Unreleased — task-oriented layouts

- Code: full-width list/editor navigation below 620 px, retained document state on Back, search and quick-open grouped in the rail.
- Changes: review files before expanding the commit composer; branch history becomes a disclosure and expands for filtering.
- API: independently scrolling request/response panes with a draggable, keyboard-accessible separator and reset.
- Skills: descriptions and installation paths are disclosed on demand so instructions appear sooner.
- Added layout interaction regression coverage and light/dark, narrow/wide component preview checks; details and examples are in `docs/ui-system.md`.

## 1.5.0 (2026-11-11)

### Changed — unified UI system

- Added a cohesive visual foundation across Code Explorer, Changes, API Tester, Skills Manager and the Start launcher: three surface levels, consistent border/radius/spacing tokens, clearer foreground hierarchy, one interaction accent, and semantic success/warning/error colors.
- Standardized toolbar, segmented controls, inputs, tabs, chips, primary buttons, focus rings, empty states, overlays and response/code surfaces for both light and dark DSH themes.
- Improved the Code and Changes rails with clearer active states, section rhythm, branch metadata and search/filter grouping.
- Improved API request/response hierarchy, Skills list/detail/editor hierarchy and launcher rows without changing their existing behavior.
- Added responsive container rules and checked wide and narrow sidebar layouts for horizontal overflow.

### Verification

- 386 assertions green across host, client, search, nested, parent and remote suites.
- Chrome component previews checked API, Skills, Changes, launcher and references peek at 360 px and 1000 px in both actual DSH themes (20 states); no horizontal control overflow. Enabled primary button contrast exceeded 4.5:1. This is not an authenticated end-to-end GUI test.
- Corrected primary button text to the actual `label-primary-foreground` token, supplied the launcher with its own local aliases, preserved editor monospace fonts, and let narrow peek headers wrap the shortcut hint.

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
