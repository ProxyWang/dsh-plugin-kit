# Toolbox UI system

The toolbox is an **Operate** surface inside the DSH right sidebar: browsing source, reviewing changes, testing HTTP requests and maintaining skills. Its visual language stays compatible with the host application's light and dark themes.

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

- The main toolbar can wrap when the panel is narrow.
- Skills switch from list/detail columns to one page with a back action below 620 px.
- API method and URL stay together; Send moves to a full-width row below 380 px.
- Peek headers let the keyboard hint wrap below the symbol and count instead of squeezing the symbol to a few characters.
- Hidden file-row actions keep zero width; only the hovered/focused row reserves action space.
- Reduced-motion preferences disable decorative button transitions and spinner motion.

## Verification

In addition to the functional test suites, v1.5.0 was checked in headless Chrome using the DSH theme stylesheet and fixture content: API, Skills, Changes, launcher and references peek, each at 360 px and 1000 px in both themes. These are component previews, not an authenticated end-to-end GUI test. The measurement checks control bounds and the contrast of enabled primary buttons; it does not prove that every text/background combination in the application meets an accessibility standard.
