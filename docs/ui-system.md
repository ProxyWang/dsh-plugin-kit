# Toolbox UI system

The toolbox is an **Operate** surface inside the DSH right sidebar: browsing source, reviewing changes, testing HTTP requests and maintaining skills. Its visual language stays compatible with the host application's light and dark themes.

## Entry points and work areas

Tool entry points live in native left `sidebar.panellist` rows alongside Plugins and Automations. The plugin registers matching `main` keys because the host validates those ids; its synchronous `layout.panelInfo` subscriber restores Conversation and opens the selected tool through the current `sidebarRight.commandTarget(null)`. This uses public services and does not patch native DOM or core code. The native on-screen Session update was verified in the installed 0.2.2-rc.1 client bundle.

Owned right-side tab ids/kinds and keepMounted state stay stable, while their guide entries are empty. The right guide is a quiet workspace hint with no launcher buttons. Existing browser pages are reused without resetting URLs, including when the right column was collapsed. No-session clicks show feedback immediately and are never queued into a later Session. Registry subscriptions add/remove left tool entries dynamically; unloading releases all registrations and subscriptions.

Left entry clicks are toggles: with the workspace visible, an existing matching tab is closed through the host close API. Other tool tabs stay open; closing the final real tool collapses the workspace even if the host retains a guide. A collapsed workspace reveals the existing tab first. Multiple instances close the active matching instance, falling back to the latest matching tab. Code and Skills register native cleanup guards to refuse discarding unsaved text; API request drafts retain their existing persistence.

Behavior tests cover these contracts with simulated synchronous host stores. A live authenticated DSH end-to-end click check has not been performed.

The right column opens at the widest the frame allows. The host seeds its width preference at 45% of the frame on the first opening and keeps a drag afterwards, so `rightbarwidth.js` writes the preference once before any opening: the request is above the host's own ceiling, which is what "maximum" means there (`[300 px, 70 %]` plus the frame's 400 px centre reservation), so the host keeps ownership of its ratios. Because that ceiling is a fraction of the frame, a widened window re-pins the pending request while nothing has been chosen and no panel is on screen. A settled drag is then measured from the rendered track and remembered, so the user's own width — not the maximum — is what a later opening restores, including after a reload. The width action is the layout service's internal store delegation, not the published `ILayout` face: the feature probes for it and installs nothing when a host has no such seam.

## Hierarchy

- The toolbar identifies the current view and exposes navigation; the content rail carries search and file/change lists.
- Editors and response bodies use the base surface. Toolbars use layer 1; compact metadata and grouped file headers use layer 2.
- Primary text names the object or action. Secondary text describes it. Tertiary text supplies supporting metadata.
- Selection and keyboard focus use the informational blue accent. Git success/warning/error colors keep their existing semantic meanings.
- No gradient is needed for empty states. Quiet copy and sufficient space communicate what to do next.

## Theme contract

Local `--ce-*` aliases are defined on both `.ce-root` and `.cel-root` (the launcher is not a descendant of the code root).

| Role | Host token |
| --- | --- |
| Canvas / surfaces | `--dsw-alias-bg-base`, `--dsw-alias-bg-layer-1`, `--dsw-alias-bg-layer-2` |
| Text hierarchy | `--dsw-alias-label-primary`, `--dsw-alias-label-secondary`, `--dsw-alias-label-tertiary` |
| Selection accent | `--dsw-alias-button-info-fill` |
| Primary button background | `--dsw-alias-button-primary-fill` / `--dsw-alias-button-primary-hover` |
| Primary button text | `--dsw-alias-label-primary-foreground` |

DSH's `brand-primary` is neutral ink in the light theme and near-white in the dark theme; it must not be assumed to mean blue. A primary button's text must use the matching foreground token. A fixed white foreground on the dark theme's near-white button is unreadable.

## Density and adaptation

Controls use 6–8 px corner radii and consistent compact spacing. Code and request editors retain their monospace font and the code renderer's fixed row height.

- At 620 px and below, Code uses a full-width file/change list or a full-width editor. Opening a document or search shows the editor region; Back returns to the list without reloading the document. The toolbar avoids duplicate search actions while the rail is visible.
- Skills switch from list/detail columns to one page with a back action below 620 px.
- API method and URL stay together; Send moves to a full-width row below 380 px.
- Peek headers let the keyboard hint wrap below the symbol and count instead of squeezing the symbol to a few characters.
- Hidden file-row actions keep zero width; only the hovered/focused row reserves action space.
- Reduced-motion preferences disable decorative button transitions and spinner motion.

## Verification

In addition to the functional test suites, v1.5.0 was checked in headless Chrome using the DSH theme stylesheet and fixture content: API, Skills, Changes, launcher and references peek, each at 360 px and 1000 px in both themes. These are component previews, not an authenticated end-to-end GUI test. The measurement checks control bounds and the contrast of enabled primary buttons; it does not prove that every text/background combination in the application meets an accessibility standard.

## Task-oriented page layout

### Code and changes

Navigation stays in the rail: workspace search and quick-open sit together. A narrow panel does not squeeze the file rail beside a tiny editor. Opening a file, diff or search switches to the editor region; returning to the list preserves the current document. On wide panels both regions remain visible.

### Code IDE command center

The Code surface is a compact IDE workbench rather than a file viewer. The command center is available from the toolbar and `⌘/Ctrl+Shift+P`; it exposes the same actions as the visible controls so keyboard and pointer workflows stay equivalent. Commands are filtered locally, support Up/Down/Enter/Escape, and close before running the action to preserve focus and avoid duplicate state transitions.

VS Code's editor ergonomics are part of the same surface: the tab strip carries a Pin / Close / Close Others / Close to the Right / Close All context menu (pinned tabs move to the front and survive bulk closes, mirroring VS Code's excludeSticky), `⌘/Ctrl+Shift+T` reopens the most recently closed editor, the find widget grows a replace row (`⌘/Ctrl+Alt+F`) whose results always land in the reviewable edit buffer instead of writing to disk — with the `AB` preserve-case toggle ported from VS Code's search utilities — the active find match keeps a solid highlight with a distinct gutter color, and the diagnostics chip toggles a Problems panel (`⇧⌘M` / `Ctrl+Shift+M`) whose header carries error/warning/info count filters and whose rows jump to their line. Each of these also appears in the command center.

The workbench keeps the file rail, editor tabs, symbol navigation, search and source control in one task context. This follows the navigation model described in [VS Code’s interface documentation](https://code.visualstudio.com/docs/editing/getting-started/userinterface) and [code navigation guide](https://code.visualstudio.com/docs/editing/editingevolved). The API and Skills tabs remain focused task surfaces: API keeps request, environment, history and response together; Skills keeps scope, preview, source and edit state together.


Changes are reviewed before committing: filtered staged/working files precede the collapsed commit form. The form remains mounted so expanding/collapsing does not discard a draft. Branch history is a separate disclosure; filtering expands it so matches are discoverable. Stash controls keep their existing behavior.

### API requests and responses

Request configuration and response are independent scroll regions within a bounded workspace. A horizontal separator adjusts the request share from 24% to 72%; drag, Up/Down, Home/End and double-click reset are supported. The toolbar stays visible while long response bodies scroll.

The API request builder follows Bruno's task model: a method/URL/Send row followed by configuration tabs (Params, Headers, Body, Auth, Vars, Settings). The tool row carries import/export, code generation, favorites, history and — at its right end, like Bruno — the active-environment selector with a "No Environment" state. The URL bar and the Params table are two projections of one query string: each direction of the sync runs in its own input handler, never in an effect, so the two cannot ping-pong. `:name` path segments get a second Path Params table; they stay literal in the URL and substitute only into the wire request, following Bruno's `interpolateUrlPathParams`. Disabled rows survive URL edits so re-enabling them is one click, matching Bruno's collections reducer. Query parameters, headers, form bodies and environment variables share a Name/Value/Description table with enable checkboxes, deletion and a trailing insert row; the Vars tab edits the active environment and hosts rename/create/delete. Disabled rows preserve their values in drafts, history and favorites and are excluded from sending, the URL and curl export. Below 560px, the table prioritizes names and values and hides the description column. Colors follow host theme tokens.

The import dialog accepts curl commands and Bruno `.bru` collection documents (auto-detected); the Code menu exports curl / fetch / Python snippets from the resolved request plus a `.bru` document that keeps `{{var}}` templates verbatim — the plain-text, Git-friendly property that defines Bruno collections.

The response pane mirrors Bruno's Body / Headers / Timeline tabs. The timeline renders the resolved request actually put on the wire (post-substitution URL, final headers including the auth-generated one, body or multipart fields, timeout) plus response metadata, so variable resolution and auth folding are inspectable rather than implied.

The new layout was checked with fixture component previews in light and dark at 1100px and 390px container widths; it has not been verified as an authenticated live DSH interaction.

![API request builder, wide light preview](images/api-request-builder-wide-light.png)

[Narrow dark preview](images/api-request-builder-narrow-dark.png)


### Skill instructions

The detail header prioritizes skill name, source and editability. Long descriptions and installation paths move into a native details disclosure. Preview and source/edit controls stay directly above the document, giving instructions more vertical space.

### Layout verification

The task-layout pass adds state/handler regressions for splitter bounds and release, narrow search/file navigation, retained documents, metadata disclosure and review-before-commit order. Chrome previews covered API, Changes, Skills, Code list and Code editor at 360 px and 1000 px in both DSH themes. File-tree rows in the preview use inert row wrappers to avoid HTML parsing of nested controls; these screenshots validate layout, not the full live DSH event path.

![Independent request and response panes](images/layout-api-dark.png)

| Changes: review files first | Skills: instructions first |
| --- | --- |
| ![Changes narrow layout](images/layout-changes-narrow.png) | ![Skills narrow layout](images/layout-skills-narrow.png) |
