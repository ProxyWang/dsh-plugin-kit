/* Application shell: toolbar, navigator rail, tree, editor tab strip and the
 * transient layers that hang off them (palette, peek, menus, find, toasts). */

export const SHELL_CSS = `
/* The workspace fills the pane the Host hands it: a column whose middle row
 * (toolbar/banners above, statusbar below) is the only part that scrolls.
 * Height must be definite here, or every .ce-scroll inside grows with its
 * content and the pane clips instead of scrolling. */
.ce-root{height:100%;min-height:0;display:flex;flex-direction:column;position:relative}

/* ---------- toolbar ---------- */
.ce-toolbar{display:flex;align-items:center;gap:6px;flex:none;height:44px;padding:0 10px;background:var(--ce-bg);border-bottom:1px solid var(--ce-line);min-width:0}
.ce-toolbar-rule{flex:none;width:1px;height:16px;background:var(--ce-line);margin:0 2px}
.ce-tool.ce-workspace-search{width:auto;flex:none;gap:6px;padding:0 8px;white-space:nowrap;font:inherit;font-size:11.5px;font-weight:500}
.ce-workspace-search svg{width:14px;height:14px;flex:none}

/* Mode switch reads as two quiet labels with a filled active pill. */
.ce-seg{display:flex;align-items:center;gap:1px;flex:none;background:transparent;border:0;padding:0;border-radius:0;overflow:visible}
.ce-seg-btn{display:inline-flex;align-items:center;gap:5px;height:27px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--ce-fg-3);font:inherit;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap}
.ce-seg-btn:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.ce-seg-on,.ce-seg-on:hover{background:var(--ce-fill-strong);color:var(--ce-fg);font-weight:600;box-shadow:none}

.ce-command-trigger{display:inline-flex;align-items:center;gap:6px;flex:0 1 auto;min-width:0;max-width:230px;height:27px;padding:0 6px 0 9px;border:0;border-radius:7px;background:var(--ce-fill);color:var(--ce-fg-3);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}
.ce-command-trigger:hover,.ce-command-trigger.ce-tool-on{background:var(--ce-fill-strong);color:var(--ce-fg);border:0}
.ce-command-trigger>span:not(.ce-command-mark){overflow:hidden;text-overflow:ellipsis}
.ce-command-trigger kbd,.ce-command-hint{flex:none;margin-left:auto;font-family:var(--ce-mono);font-size:10px;line-height:1;color:var(--ce-fg-3);background:transparent;border:0;border-radius:4px;padding:3px 0 3px 4px}
.ce-command-mark{flex:none;font-family:var(--ce-mono);font-size:11px;font-weight:700;color:var(--ce-accent)}
.ce-command-palette{top:48px;max-width:640px}
.ce-command-palette .ce-palette-head{gap:8px}
.ce-command-item{display:flex;align-items:center;gap:10px;width:100%;min-height:30px;border:0;background:transparent;color:var(--ce-fg-2);font:inherit;font-size:12.5px;text-align:left;padding:5px 12px;cursor:pointer;border-radius:6px}
.ce-command-item:hover,.ce-command-item.ce-qitem-sel{background:var(--ce-fill);color:var(--ce-fg)}
.ce-command-icon{flex:none;width:18px;text-align:center;color:var(--ce-fg-3);font-family:var(--ce-mono);font-size:11px}
.ce-command-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ce-command-hint{flex:none}

/* Branch is a quiet metadata chip, not a boxed button. */
.ce-branch{display:inline-flex;align-items:center;gap:5px;flex:0 1 auto;min-width:0;max-width:220px;height:27px;margin-left:2px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--ce-fg-3);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}
.ce-branch:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.ce-branch:disabled{opacity:.55;cursor:default;background:transparent}
.ce-branch>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis}
.ce-branch .ce-spin{color:var(--ce-fg-3)}
.ce-ab{flex:none;font-family:var(--ce-mono);font-size:10.5px;font-weight:700}
.ce-ab-ahead{color:var(--ce-ok)}
.ce-ab-behind{color:var(--ce-warn)}
.ce-branch-chip{display:inline-flex;align-items:center;gap:2px;flex:0 0 auto;padding:0 3px;margin-left:4px;border-radius:999px;background:var(--ce-fill);color:var(--ce-fg-2);font-size:9px;line-height:15px;vertical-align:middle;overflow:hidden;white-space:nowrap}
.ce-branch-glyph{opacity:.7;flex:0 0 auto;font-size:10px}
.ce-branch-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
/* The Session hover card is a dark surface in both palettes (Host rule), so the
 * branch line takes the Host's hover-card ink. Page tokens would resolve to the
 * light palette there and paint dark-on-dark; currentColor keeps older Hosts
 * readable when the hover-card tokens are absent. */
.ce-branch-card{display:flex;align-items:center;gap:6px;min-width:0;font-size:12px;line-height:16px;color:var(--dsw-alias-hovercard-label-secondary,currentColor)}
.ce-branch-card-label{flex:0 0 auto;color:var(--dsw-alias-hovercard-label-tertiary,currentColor)}
.ce-branch-card-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ce-mono);color:var(--dsw-alias-hovercard-label-primary,currentColor)}
.ce-branch-card .ce-branch-glyph{opacity:1;font-size:12px;color:var(--dsw-alias-hovercard-label-tertiary,currentColor)}

/* ---------- workspace ---------- */
.ce-main{flex:1;min-height:0;display:flex;overflow:hidden}
.ce-rail-wrap{flex:none;display:flex;background:var(--ce-bg);border-right:1px solid var(--ce-line);min-width:0}
.ce-rail-with-search{flex-direction:column;min-height:0;max-width:45%;min-width:170px}
.ce-rail-with-search>.ce-rail{min-height:0}
.ce-rail{flex:1;min-width:0;padding:4px;background:var(--ce-bg)}
.ce-scroll{overflow:auto;scrollbar-gutter:stable}
.ce-splitter{flex:none;width:5px;cursor:col-resize;background:transparent;border:0;transition:background-color var(--ce-dur) var(--ce-ease)}
.ce-splitter:hover{background:var(--ce-accent-soft)}
.ce-rail-tab{flex:none;width:16px;border:0;border-right:1px solid var(--ce-line);background:var(--ce-bg);color:var(--ce-fg-3);cursor:pointer;font-size:10px;padding:0}
.ce-rail-tab:hover{color:var(--ce-fg);background:var(--ce-fill)}

/* ---------- navigator: search + quick open ---------- */
.ce-rail-navigation{display:flex;align-items:center;gap:4px;flex:none;padding:8px 8px 6px;border-bottom:1px solid var(--ce-line)}
.ce-rail-search{display:flex;align-items:center;gap:8px;flex:1;min-width:0;min-height:30px;margin:0;padding:0 9px;border:1px solid var(--ce-line);border-radius:var(--ce-radius);background:var(--ce-fill);color:var(--ce-fg-3);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.ce-rail-search svg{width:14px;height:14px;flex:none;color:var(--ce-fg-3)}
.ce-rail-search>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-rail-search:hover{background:var(--ce-fill-strong);color:var(--ce-fg-2);border-color:var(--ce-line-strong)}
.ce-rail-search:hover svg{color:var(--ce-fg-2)}
.ce-rail-search:focus-visible{outline:2px solid var(--ce-accent);outline-offset:1px}
.ce-rail-quickopen{flex:none;color:var(--ce-fg-3)}

/* ---------- rows ---------- */
.ce-row{display:flex;align-items:center;gap:6px;width:100%;min-height:26px;border:0;background:transparent;color:var(--ce-fg-2);font:inherit;font-size:12.5px;text-align:left;padding:0 8px;cursor:pointer;border-radius:var(--ce-radius-sm);min-width:0;position:relative}
.ce-row:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ce-active,.ce-active:hover{background:var(--ce-accent-soft);color:var(--ce-fg);box-shadow:inset 2px 0 0 var(--ce-accent)}
.ce-row-drop,.ce-row-drop:hover{background:var(--ce-accent-soft);box-shadow:inset 0 0 0 1px var(--ce-accent-line)}
.ce-tree-ico{margin:0 1px}
.ce-ico{flex:none;display:inline-flex;color:var(--ce-fg-3)}
.ce-ico-dir{color:var(--ce-warn)}
.ce-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ce-tree-dir{color:var(--ce-fg-2);font-weight:600}
.ce-tree-dir:hover{color:var(--ce-fg)}
.ce-tree-chev{flex:none;width:10px;font-size:9px;color:var(--ce-fg-3)}
.ce-tree-folder{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.ce-tree-count{background:transparent;color:var(--ce-fg-3);font-weight:600}
.ce-tree-file .ce-name{font-family:var(--ce-mono);font-size:12px}
.ce-crumb{border:0;background:transparent;color:var(--ce-fg-2);font:inherit;font-size:12px;cursor:pointer;padding:2px 6px;border-radius:5px;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.ce-crumb:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ce-dirhint,.cet-dirhint{color:var(--ce-fg-3);font-size:11px;margin-left:6px}
.cet-dir{color:var(--ce-fg-2);font-weight:600}
.cet-status{flex:none;font-family:var(--ce-mono);font-size:11px;font-weight:700}
.cet-st-m,.cet-st-r{color:var(--ce-warn)}
.cet-st-u,.cet-st-a{color:var(--ce-ok)}
.cet-st-d{color:var(--ce-bad)}
.cet-st-c{color:var(--ce-accent)}

/* ---------- file tree ---------- */
.cet-row{height:26px;min-height:26px;padding-top:0;padding-bottom:0;border-radius:var(--ce-radius-sm)}
.cet-tw{flex:none;width:12px;font-size:8px;line-height:1;color:var(--ce-fg-3);display:inline-flex;align-items:center;justify-content:center;transition:transform var(--ce-dur) var(--ce-ease)}
.cet-tw-open{transform:rotate(90deg)}
.ce-row:hover>.ctp-entry-open .cet-tw{color:var(--ce-fg-2)}
.cet-fico{flex:none;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:var(--ce-fg-3)}
.cet-fico svg{width:14px;height:14px;display:block}
.cet-fico-dir{color:var(--ce-warn)}
/* File tints use the theme's semantic hues, never fixed hex values. */
.cet-go,.cet-ts{color:var(--ce-accent)}
.cet-css{color:color-mix(in srgb,var(--ce-accent) 55%,var(--ce-bad))}
.cet-py{color:var(--ce-ok)}
.cet-rs{color:color-mix(in srgb,var(--ce-warn) 72%,var(--ce-bad))}
.cet-img{color:color-mix(in srgb,var(--ce-accent) 45%,var(--ce-warn))}
.cet-pdf{color:var(--ce-bad)}
.cet-js{color:var(--ce-warn)}
.cet-json{color:var(--ce-ok)}
.cet-md{color:var(--ce-fg-2)}
.cet-sql{color:var(--ce-warn)}
.cet-toml{color:color-mix(in srgb,var(--ce-accent) 55%,var(--ce-bad))}
.cet-html{color:color-mix(in srgb,var(--ce-warn) 55%,var(--ce-bad))}
.cet-zip{color:color-mix(in srgb,var(--ce-warn) 40%,var(--ce-fg-2))}
.cet-file{color:var(--ce-fg-3)}
.cet-dirname{font-weight:600;color:var(--ce-fg)}
.cet-count{margin-left:0;flex:none;font-family:var(--ce-mono);font-size:11px;color:var(--ce-fg-3)}
.cet-right{margin-left:auto;flex:none;display:inline-flex;align-items:center;gap:6px}
.cet-act{border:0;background:transparent;color:var(--ce-fg-3);cursor:pointer;font:inherit;font-size:12px;line-height:1;padding:3px 5px;border-radius:5px;opacity:0;transition:opacity var(--ce-dur) var(--ce-ease),background-color var(--ce-dur) var(--ce-ease)}
.ce-row:hover .cet-act{opacity:1}
.cet-act-show{opacity:1}
.cet-act:hover{color:var(--ce-fg);background:var(--ce-fill-strong)}
.cet-act-delete:hover,.cet-act-danger{color:var(--ce-bad)}
.cet-act-danger{font-size:11px}
.cet-act-done{color:var(--ce-ok)!important}
.cet-act-done:hover{color:var(--ce-ok)}
.cet-copy-path{display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px;padding:4px}
.cet-row:focus-within .cet-act,.cet-copy-path:focus-visible{opacity:1}
@media(hover:none){.cet-copy-path{opacity:1}}

/* ---------- tree row composition ---------- */
.ce-row[data-tp]{column-gap:0}
.ce-row[data-tp]>.ce-ico,.ce-row[data-tp]>.ce-tree-ico{flex:none}
.ce-row[data-tp]>.ce-name{margin-left:6px}
.ce-row[data-tp] .ce-name{flex:1}
.ctp-acts{margin-left:0;display:inline-flex;flex:none;gap:1px;width:0;overflow:hidden;visibility:hidden;pointer-events:none}
.ce-row:hover .ctp-acts,.ce-row:focus-within .ctp-acts{margin-left:6px}
.ce-row:hover .ctp-acts,.ce-row:focus-within .ctp-acts,.ctp-acts:has(.cet-act-danger){width:auto;overflow:visible;visibility:visible;pointer-events:auto}
.ctp-acts .cet-act{opacity:1}
.ctp-entry-open{display:flex;align-items:center;gap:6px;flex:1;min-width:0;align-self:stretch;border:0;padding:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.ctp-entry-open>.ce-ico,.ctp-entry-open>.cet-fico{flex:none}
.ctp-entry-open>.ce-name{flex:1}
.ctp-tools{display:flex;align-items:center;gap:2px;padding:4px 4px 6px;border-bottom:1px solid var(--ce-line);flex:none}
.ctp-tools .cet-act{opacity:1;color:var(--ce-fg-3);font-size:11.5px;padding:4px 7px}
.ctp-tools .cet-act:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ctp-inputrow{cursor:default;padding-top:2px;padding-bottom:2px}
.ctp-inputrow:hover{background:transparent}
.ctp-inputrow .ce-input{flex:1;min-width:0;height:24px;font-size:12px}
.ctp-input-ok,.ctp-input-cancel{width:22px;height:22px}
.ctp-delete-panel{margin:6px 4px 8px;padding:12px;border:1px solid var(--ce-line);border-radius:var(--ce-radius);background:var(--ce-s1);color:var(--ce-fg);font-size:12px;line-height:1.6;overflow-wrap:anywhere}
.ctp-delete-panel strong{font-size:12px;font-weight:600}
.ctp-delete-panel p{margin:6px 0;color:var(--ce-fg-2)}
.ctp-delete-panel .ctp-delete-error{color:var(--ce-bad)}
.ctp-delete-buttons{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}

/* ---------- changes rail ---------- */
.ce-changes{overflow-x:hidden}
.ce-changes>.ce-note{padding:10px 12px 6px;font-size:11.5px;line-height:1.55;overflow-wrap:anywhere}
.ce-change-group{min-width:0;padding:4px 0 10px;border-top:1px solid var(--ce-line)}
.ce-changes>.ce-change-group:first-of-type{border-top:0;padding-top:0}
.ce-changes .ce-section{justify-content:flex-start;flex-wrap:wrap;gap:6px 10px;padding:10px 12px 4px;color:var(--ce-fg-2);font-size:11.5px;font-weight:600;letter-spacing:0}
.ce-changes .ce-section>span:first-child{flex:1 0 auto;min-width:0}
.ce-changes .ce-section>.ce-link,.ce-changes .ce-section>.ce-tool{flex:none}
.ce-changes .ce-note{padding-left:12px;padding-right:12px;line-height:1.55}
.ce-changes .ce-note-line{align-items:flex-start;flex-wrap:wrap;gap:2px 8px}
.ce-changes .ce-note-line>span{flex:1 1 160px;min-width:0;overflow-wrap:anywhere}
.ce-changes .ce-note-line>.ce-link{flex:none}
.ce-changes-search{display:flex;gap:6px;align-items:center;padding:6px 12px 8px;border-bottom:1px solid var(--ce-line)}
.ce-changes-search .ce-input{flex:1;min-width:0;font-size:12px}
.ce-changes-search .ce-sk-btn{flex:none;font-size:11px;white-space:nowrap}
.ce-commit-disclosure{border-top:1px solid var(--ce-line);border-bottom:1px solid var(--ce-line);margin-top:8px}
.ce-disclosure-summary{cursor:pointer;padding:10px 12px;list-style-position:inside;color:var(--ce-fg);font-size:12px;line-height:1.5}
.ce-disclosure-summary>span:first-child{font-weight:600}
.ce-disclosure-meta{display:block;margin-top:3px;margin-left:14px;font-size:11px;color:var(--ce-fg-3);font-weight:400}
.ce-disclosure-summary:hover{background:var(--ce-fill)}
.ce-disclosure-summary:focus-visible{outline:2px solid var(--ce-accent);outline-offset:-2px}
.ce-commit-disclosure .ce-commitbox{border:0}
.ce-branch-history{padding:0}
.ce-commit{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px 4px 12px;cursor:pointer;border-radius:5px;white-space:nowrap}
.ce-commit-row{display:flex;align-items:center;gap:4px}
.ce-commit-row .ce-commit{flex:1;min-width:0}
.ce-commit-row .ce-tool{opacity:0;flex:none}
.ce-commit-row:hover .ce-tool,.ce-commit-row:focus-within .ce-tool{opacity:1}
.ce-commit:hover{background:var(--ce-fill)}
.ce-csubject{color:var(--ce-fg-2);overflow:hidden;text-overflow:ellipsis;min-width:0}
.ce-chash{font-family:var(--ce-mono);font-size:11px;color:var(--ce-fg-3);flex:none}
.ce-histrow{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px;cursor:pointer;white-space:nowrap;border-radius:5px}
.ce-histrow:hover{background:var(--ce-fill)}
.ce-histrow .ce-csubject{flex:1}
.ce-histmeta{flex:none;font-size:10px;color:var(--ce-fg-3)}
.ce-histpath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--ce-fg-3);font-family:var(--ce-mono);margin-left:8px}

/* ---------- commit box ---------- */
.ce-commitbox{display:flex;flex-direction:column;gap:8px;align-items:stretch;padding:8px 12px 12px;min-width:0;flex:none;background:var(--ce-bg)}
.ce-commitbox-msg{flex:none;width:100%;box-sizing:border-box;min-width:0;font-size:12px;padding:7px 9px;height:auto;min-height:56px;background:var(--ce-fill);border:1px solid transparent;border-radius:var(--ce-radius);color:var(--ce-fg)}
.ce-commitbox-msg::placeholder{color:var(--ce-fg-3)}
.ce-commitbox-msg:focus{border-color:var(--ce-accent);background:var(--ce-bg);box-shadow:0 0 0 3px var(--ce-accent-softer)}
.ce-commitbox-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;min-width:0}
.ce-commitbox-amend{display:inline-flex;align-items:center;justify-content:center;flex:none;min-height:28px;border:1px solid transparent;border-radius:var(--ce-radius-sm);background:transparent;color:var(--ce-fg-3);font:inherit;font-size:11.5px;padding:0 8px;cursor:pointer}
.ce-commitbox-amend:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.ce-commitbox-amend:disabled{opacity:.45;cursor:default;background:transparent}
.ce-commitbox-amend:focus-visible,.ce-commitbox-btn:focus-visible{outline:2px solid var(--ce-accent);outline-offset:1px}
.ce-commitbox-btn{flex:0 1 auto;max-width:100%;min-height:30px;border:0;border-radius:var(--ce-radius-sm);background:var(--dsw-alias-button-primary-fill,var(--ce-accent));color:var(--ce-on-accent);font:inherit;font-size:12px;font-weight:600;padding:0 12px;cursor:pointer;white-space:normal;overflow-wrap:anywhere;text-align:center}
.ce-commitbox-btn:hover:not(:disabled){filter:brightness(1.06)}
.ce-changes .ce-commitbox-btn:disabled{opacity:1;cursor:not-allowed;filter:none;background:var(--ce-fill);color:var(--ce-fg-3)}
.ce-stash-save{display:flex;gap:5px;align-items:center;padding:4px 8px;flex-wrap:wrap}
.ce-stash-save .ce-input{flex:1;min-width:90px;height:26px;font-size:11px}
.ce-stash-u{display:flex;gap:3px;align-items:center;font-size:10px;color:var(--ce-fg-3);flex:none;cursor:pointer;user-select:none}
.ce-stashrow{display:flex;gap:6px;align-items:center;padding:3px 6px;width:100%;border-radius:5px}
.ce-stashrow:hover{background:var(--ce-fill)}
.ce-stashref{flex:none;font-size:10px;font-weight:700;color:var(--ce-accent);font-family:var(--ce-mono)}
.ce-stashmsg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--ce-fg-2)}
.ce-stashacts{flex:none;display:flex;gap:1px;align-items:center}

/* ---------- editor shell ---------- */
.ce-editor{flex:1;min-width:0;display:flex;flex-direction:column;position:relative;background:var(--ce-bg)}
.ce-editor-file-drop{outline:2px solid var(--ce-accent);outline-offset:-2px}
.ce-file-drop-hint{position:absolute;z-index:12;bottom:14px;left:50%;transform:translateX(-50%);max-width:calc(100% - 24px);padding:7px 12px;border:1px solid var(--ce-accent-line);border-radius:8px;background:var(--ce-s1);color:var(--ce-fg);font-size:12px;line-height:1.5;box-shadow:var(--ce-shadow-2);pointer-events:none;text-align:center}

.ce-tabs{display:flex;gap:2px;align-items:center;flex:none;height:37px;overflow-x:auto;overflow-y:hidden;padding:5px 8px;background:var(--ce-bg);border-bottom:1px solid var(--ce-line);scrollbar-width:none}
.ce-tabs::-webkit-scrollbar{display:none}
.ce-tab{display:flex;gap:5px;align-items:center;flex:none;max-width:180px;height:27px;padding:0 4px 0 9px;border:1px solid transparent;border-radius:7px;cursor:pointer;color:var(--ce-fg-3);background:transparent;font-size:12px;white-space:nowrap}
.ce-tab:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.ce-tab-active,.ce-tab-active:hover{background:var(--ce-fill-strong);color:var(--ce-fg);border-color:transparent;box-shadow:none;font-weight:500}
.ce-tab-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-tab-dot{flex:none;width:6px;font-size:6px;line-height:1;color:var(--ce-warn)}
.ce-tab-dot:empty{width:0}
.ce-tab-pin{flex:none;font-size:8px;line-height:1;color:var(--ce-accent)}
.ce-tab-x{border:0;background:transparent;color:inherit;font:inherit;font-size:11px;line-height:1;cursor:pointer;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;opacity:0;flex:none;transition:opacity var(--ce-dur) var(--ce-ease),background-color var(--ce-dur) var(--ce-ease)}
.ce-tab:hover .ce-tab-x,.ce-tab-active .ce-tab-x,.ce-tab-x:focus-visible{opacity:.7}
.ce-tab-x:hover{opacity:1;background:var(--ce-fill-strong);color:var(--ce-fg)}
.ce-tab-drop-before{box-shadow:inset 2px 0 0 var(--ce-accent)}
.ce-tabmenu{min-width:180px}

.ce-head{display:flex;align-items:center;gap:6px;flex:none;min-height:36px;padding:0 9px;background:var(--ce-bg);border-bottom:1px solid var(--ce-line);min-width:0;overflow-x:auto;scrollbar-width:none}
.ce-head::-webkit-scrollbar{display:none}
.ce-head-path{font-family:var(--ce-mono);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ce-fg-2);font-weight:500}
.ce-pos{font-family:var(--ce-mono);font-size:11px;color:var(--ce-fg-3);flex:none;font-variant-numeric:tabular-nums}
.ce-diag{font-size:11px;color:var(--ce-bad);flex:none}
.ce-diag-btn{border:1px solid transparent;background:transparent;border-radius:5px;font:inherit;font-size:11px;cursor:pointer;padding:2px 7px;color:var(--ce-bad)}
.ce-diag-btn:hover{background:var(--ce-bad-soft)}
.ce-pos-btn{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:0 2px;border-radius:4px}
.ce-pos-btn:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ce-title-ico{display:inline-flex;margin-right:2px;color:var(--ce-fg-2)}
.ce-wdoc{padding:4px 0 10px;min-width:0}
.ce-wline{display:flex;align-items:flex-start;padding-right:10px}
.ce-wlineno{flex:none;width:52px;box-sizing:border-box;padding-right:10px;text-align:right;font-family:var(--ce-mono);font-size:11.5px;line-height:22px;color:var(--ce-fg-3);user-select:none}
.ce-wlineno-active{color:var(--ce-fg)}
.ce-wtext{flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:break-word;font-family:var(--ce-mono);font-size:13px;line-height:22px;tab-size:4}
.ce-wcap{padding:8px 12px}
.ce-goto{width:min(340px,calc(100% - 32px))}
.ce-edit-ta-wrap{white-space:pre-wrap;overflow-wrap:break-word}

/* ---------- status bar ---------- */
.ce-statusbar{flex:none;display:flex;gap:8px;align-items:center;height:24px;padding:0 10px;border-top:1px solid var(--ce-line);background:var(--ce-bg);font-size:11px;color:var(--ce-fg-3);min-height:24px;font-variant-numeric:tabular-nums}
.ce-prog{font-size:11px;color:var(--ce-fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:50%}

/* ---------- command palette / quick open / peek ---------- */
.ce-palette{position:absolute;top:46px;left:50%;transform:translateX(-50%);width:min(560px,calc(100% - 32px));z-index:8;display:flex;flex-direction:column;max-height:70%;background:var(--ce-s1);border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius-lg);box-shadow:var(--ce-shadow-2);overflow:hidden}
.ce-palette-head{display:flex;align-items:center;gap:8px;padding:9px 10px;background:transparent;border-bottom:1px solid var(--ce-line)}
.ce-palette-list{border-top:0;padding:5px;overflow:auto;display:flex;flex-direction:column;gap:1px}
.ce-qitem{display:flex;align-items:center;gap:8px;width:100%;min-height:28px;text-align:left;border:0;border-radius:6px;background:transparent;color:var(--ce-fg-2);font:inherit;font-size:12.5px;padding:4px 9px;cursor:pointer}
.ce-qitem:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ce-qitem-sel,.ce-qitem-sel:hover{background:var(--ce-accent-soft);color:var(--ce-fg)}
.ce-qbase{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62%;flex:none;color:var(--ce-fg)}
.ce-qdir{font-size:11px;color:var(--ce-fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--ce-mono)}
.ce-palette .ce-section{background:transparent;color:var(--ce-fg-3);padding:9px 9px 3px}
.ce-bp .ce-palette-head{background:var(--ce-s2);border-bottom-color:var(--ce-line)}
.ce-bp .ce-palette-list{background:var(--ce-s1)}
.ce-bp .ce-section{background:transparent;color:var(--ce-fg-3)}
.ce-bp-act{flex:none;border:1px solid transparent;background:var(--ce-fill);color:var(--ce-fg-2);border-radius:5px;font:inherit;font-size:11px;padding:3px 9px;cursor:pointer}
.ce-bp-act:hover{color:var(--ce-fg);background:var(--ce-fill-strong)}
.ce-bp-act:disabled{opacity:.45;cursor:default}
.ce-bp-push{color:var(--ce-accent);background:var(--ce-accent-soft);border-color:transparent}

.ce-peek{position:absolute;left:12px;width:min(720px,calc(100% - 24px));z-index:6;background:var(--ce-s1);border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius-lg);box-shadow:var(--ce-shadow-2);display:flex;flex-direction:column;max-height:390px;overflow:hidden}
.ce-peek-head{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;padding:9px 12px;border-bottom:1px solid var(--ce-line);flex:none;background:var(--ce-s1)}
.ce-peek-sym{font-family:var(--ce-mono);font-weight:600;font-size:12.5px;color:var(--ce-fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 120px;min-width:0;max-width:none}
.ce-peek-meta{font-size:10.5px;color:var(--ce-fg-2);flex:none;padding:2px 7px;border-radius:999px;background:var(--ce-fill)}
.ce-peek-hint{font-size:10px;color:var(--ce-fg-3);flex:1 1 100%;order:1;margin-right:4px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-peek-head>.ce-spacer{display:none}
.ce-peek-head>.ce-tool{flex:none}
.ce-peek-body{min-height:0;padding:4px 0 8px;overflow:auto}
.ce-peek-file{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:7px;padding:6px 12px;background:var(--ce-s2);border-top:1px solid var(--ce-line);border-bottom:1px solid var(--ce-line)}
.ce-peek-file-icon{width:15px;flex:none;text-align:center;color:var(--ce-fg-3);font-size:12px}
.ce-peek-fpath{direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;font-family:var(--ce-mono);font-size:11px;font-weight:600;color:var(--ce-fg-2)}
.ce-peek-file-count{flex:none;min-width:20px;text-align:center;padding:1px 6px;border-radius:999px;background:var(--ce-fill);color:var(--ce-fg-3);font-size:10px;font-variant-numeric:tabular-nums}
.ce-peek-row{display:grid;grid-template-columns:16px 58px minmax(0,1fr);gap:8px;align-items:baseline;width:100%;text-align:left;border:0;border-left:2px solid transparent;background:transparent;color:inherit;font:inherit;padding:5px 12px 5px 10px;cursor:pointer;white-space:nowrap}
.ce-peek-row:hover{background:var(--ce-fill)}
.ce-peek-row-sel,.ce-peek-row-sel:hover{background:var(--ce-accent-soft);border-left-color:var(--ce-accent);box-shadow:none}
.ce-peek-def{border-left-color:var(--ce-ok)}
.ce-peek-kind{width:16px;text-align:center;color:var(--ce-fg-3);font-size:10px}
.ce-peek-def .ce-peek-kind{color:var(--ce-ok)}
.ce-peek-lno{min-width:0;text-align:right;color:var(--ce-fg-3);font-family:var(--ce-mono);font-size:10.5px;flex:none;user-select:none}
.ce-peek-def .ce-peek-lno{color:var(--ce-ok)}
.ce-peek-snippet{font-family:var(--ce-mono);font-size:12px;color:var(--ce-fg);overflow:hidden;text-overflow:ellipsis;white-space:pre;min-width:0}
.ce-mark{background:color-mix(in srgb,var(--ce-accent) 26%,transparent);border-radius:3px;box-shadow:none;text-decoration:none;color:var(--ce-fg)}

/* ---------- hover card, signatures and locations ---------- */
.ce-hover{position:absolute;z-index:5;max-width:420px;min-width:180px;background:var(--ce-s1);border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius);padding:9px 11px;font-family:var(--ce-mono);font-size:12px;line-height:1.55;white-space:pre-wrap;box-shadow:var(--ce-shadow-2);pointer-events:none;color:var(--ce-fg)}
.ce-overlay{position:absolute;left:10px;right:10px;top:38px;z-index:6;background:var(--ce-s1);border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius-lg);box-shadow:var(--ce-shadow-2);display:flex;flex-direction:column;max-height:64%;overflow:hidden}
.ce-overlay-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px 8px 12px;border-bottom:1px solid var(--ce-line);font-weight:600;font-size:12px;color:var(--ce-fg)}
.ce-overlay-list{overflow:auto;padding:5px}
.ce-loc{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;border-radius:5px;background:transparent;color:inherit;font:inherit;font-size:12px;padding:5px 9px;cursor:pointer;white-space:nowrap}
.ce-loc:hover{background:var(--ce-fill)}
.ce-loc-path{font-family:var(--ce-mono);font-size:12px;color:var(--ce-accent);flex:none}
.ce-loc-file{color:var(--ce-fg-3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
.ce-loc-snippet{font-family:var(--ce-mono);font-size:12px;color:var(--ce-fg-2);overflow:hidden;text-overflow:ellipsis}
.ce-underline{position:absolute;bottom:3px;height:2px;border-bottom:2px dotted var(--ce-bad);pointer-events:auto;background:transparent}
.ce-underline-warn{border-bottom-color:var(--ce-warn)}

/* ---------- find widgets ---------- */
.ce-find{display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid var(--ce-line);flex:none;background:var(--ce-bg)}
.ce-find-input{flex:0 1 240px}
.ce-find-count{font-family:var(--ce-mono);font-size:11px;color:var(--ce-fg-3);flex:none;min-width:44px;text-align:center}
.ce-find-replace{border-top:0;background:var(--ce-s1)}
.ce-find-replace .ce-sk-btn{flex:none;font-size:11px;padding:0 8px}
.ce-edit-find{position:absolute;top:6px;right:10px;z-index:5;display:flex;align-items:center;gap:4px;padding:4px 5px;background:var(--ce-s1);border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius);box-shadow:var(--ce-shadow-2)}
.ce-edit-find-input{width:160px;height:24px;padding:0 7px;font-size:12px;background:var(--ce-fill);color:var(--ce-fg);border:1px solid transparent;border-radius:5px;outline:none}
.ce-edit-find-input:focus{border-color:var(--ce-accent)}
.ce-edit-find-count{font-size:11px;color:var(--ce-fg-3);font-family:var(--ce-mono);min-width:40px;text-align:center;font-variant-numeric:tabular-nums}
.ce-search-box>.ce-tool{flex:none;min-width:24px;padding:0;white-space:nowrap}
.ce-search-q{flex:1;min-width:0}
.ce-t{flex:1;min-width:0}

/* ---------- transient menus ---------- */
.cet-context{position:fixed;z-index:100001;min-width:190px;max-width:260px;padding:5px;background:var(--ce-s1);border:1px solid var(--ce-line-strong);border-radius:10px;box-shadow:var(--ce-shadow-2);color:var(--ce-fg)}
.cet-context-path{padding:6px 8px 7px;color:var(--ce-fg-3);font-family:var(--ce-mono);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cet-context-rule{height:1px;background:var(--ce-line);margin:2px 0 4px}
.cet-context>button{display:block;width:100%;border:0;border-radius:6px;background:transparent;color:var(--ce-fg-2);text-align:left;font:inherit;font-size:12px;padding:6px 8px;cursor:pointer}
.cet-context>button:hover,.cet-context>button:focus-visible{background:var(--ce-fill);color:var(--ce-fg);outline:0}
.cet-context>button:disabled{opacity:.45;cursor:default}
.cet-context>button:disabled:hover{background:transparent}
.cet-context-danger{color:var(--ce-bad)!important}
.cet-context-danger:hover{background:var(--ce-bad-soft)!important}
.ce-fast-hint{position:fixed;z-index:100000;pointer-events:none;max-width:min(260px,calc(100vw - 16px));box-sizing:border-box;padding:5px 8px;border:1px solid var(--ce-line-strong);border-radius:6px;background:var(--ce-s1);color:var(--ce-fg);font-family:inherit;font-size:11.5px;font-weight:400;line-height:1.45;white-space:normal;overflow-wrap:anywhere;box-shadow:var(--ce-shadow-1)}
.ce-left-notice{position:fixed;z-index:1000;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;max-width:min(480px,calc(100vw - 32px));padding:10px 12px 10px 14px;border:1px solid var(--ce-line-strong);border-radius:10px;background:var(--ce-s1);color:var(--ce-fg);font:inherit;font-size:12.5px;line-height:1.5;box-shadow:var(--ce-shadow-2)}
.ce-left-notice>span{min-width:0;overflow-wrap:anywhere}
.ce-left-notice>button{flex:none;width:26px;height:26px;border:0;border-radius:5px;background:transparent;color:var(--ce-fg-2);font:inherit;font-size:16px;cursor:pointer}
.ce-left-notice>button:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ce-left-notice>button:focus-visible{outline:2px solid var(--ce-accent)}

/* ---------- conflicts, comparison ---------- */
.ce-conflict-diff{flex:none;display:flex;flex-direction:column;max-height:46%;margin:8px 10px 0;border:1px solid var(--ce-line);border-radius:var(--ce-radius);overflow:auto;background:var(--ce-s1)}
.ce-conflict-head{flex:none;display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--ce-line);background:var(--ce-s1);position:sticky;top:0;z-index:2}
.ce-conflict-title{flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--ce-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-conflict-meta{flex:none;font-size:11px;color:var(--ce-fg-3);font-family:var(--ce-mono)}
.ce-conflict-row{display:flex;align-items:center;gap:6px}
.ce-conflict-row .ce-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-conflict-row .ce-tiny{flex:none}
.ce-compare{border-left:2px solid var(--ce-accent-line)}
.ce-compare-box{width:min(560px,92vw)}
.ce-compare-fields{display:flex;gap:6px;align-items:center;padding:8px 10px;flex-wrap:wrap}
.ce-compare-fields .ce-input{flex:1;min-width:120px}

/* ---------- task output ---------- */
.ce-task-panel{display:flex;flex-direction:column;max-height:min(72vh,640px)}
.ce-task-body{flex:1;min-height:120px;overflow:auto;font-family:var(--ce-mono);font-size:11px;line-height:1.55;padding:8px 10px;background:var(--ce-s1);color:var(--ce-fg-2);border-radius:6px;margin:0 10px 10px}
.ce-task-line{white-space:pre-wrap;word-break:break-word}
.ce-task-jump{border:0;background:none;color:var(--ce-accent);font:inherit;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.ce-calrow{display:flex;align-items:center;gap:8px;width:100%;border:1px solid transparent;background:var(--ce-fill);color:inherit;font:inherit;text-align:left;padding:6px 10px;cursor:pointer;border-radius:var(--ce-radius-sm);margin:2px 0}
.ce-calrow:hover{background:var(--ce-fill-strong)}
.ce-calrow:disabled{cursor:default;opacity:.7}
.ce-calrow-fail{opacity:.65}
.ce-calrow-run{cursor:default;border-style:dashed;border-color:var(--ce-line)}
.ce-cal-label{flex:none;font-weight:600;font-size:12px;color:var(--ce-fg-2)}
.ce-cal-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ce-mono);font-size:12px;color:var(--ce-fg)}
.ce-cal-stats{flex:none;font-family:var(--ce-mono);font-size:11px;color:var(--ce-fg-3)}
.ce-cal-hint{flex:none;font-size:11px;color:var(--ce-accent);opacity:0;transition:opacity var(--ce-dur) var(--ce-ease)}
.ce-calrow:hover .ce-cal-hint{opacity:1}
.ce-cal-hint-on{opacity:1;color:var(--ce-fg-3)}

/* ---------- hidden workspace guide and mobile navigation ---------- */
.ce-workspace-guide{height:100%;min-height:180px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;color:var(--ce-fg-2);font-family:inherit;background:var(--ce-bg)}
.ce-workspace-guide-icon{display:inline-flex;color:var(--ce-fg-3);width:44px;height:44px;align-items:center;justify-content:center;border-radius:12px;background:var(--ce-fill)}
.ce-workspace-guide h2{margin:0;font-size:15px;font-weight:600;color:var(--ce-fg)}
.ce-workspace-guide p{margin:0;max-width:38ch;font-size:12px;line-height:1.7;color:var(--ce-fg-3)}
.ce-mobile-back,.ce-mobile-open-editor{display:none}

/* ---------- task layout: Code is a container, not a fixed column ---------- */
.ce-code-root{container-type:inline-size}
.ce-code-root .ce-toolbar{flex-wrap:nowrap;min-width:0}
.ce-code-root .ce-seg{flex:none}
.ce-code-root .ce-branch{min-width:0;max-width:220px;flex:0 1 auto}
.ce-code-root .ce-toolbar>.ce-tool{flex:none}

@container (max-width:620px){
	.ce-code-root .ce-rail-wrap{max-width:none;width:100%!important;min-width:0;border:0}
	.ce-code-root .ce-splitter,.ce-code-root .ce-rail-tab{display:none}
	.ce-code-root[data-mobile-view="files"] .ce-editor{display:none}
	.ce-code-root[data-mobile-view="editor"] .ce-rail-wrap{display:none}
	.ce-code-root[data-mobile-view="editor"] .ce-mobile-back{display:block;flex:none;text-align:left;padding:9px 12px;border:0;border-bottom:1px solid var(--ce-line);background:var(--ce-bg);color:var(--ce-fg-2);font:inherit;font-size:12px;cursor:pointer}
	.ce-code-root[data-mobile-view="files"] .ce-mobile-open-editor{display:block;flex:none;font-size:11px}
	.ce-code-root .ce-branch{max-width:120px}
	.ce-code-root .ce-command-trigger{padding:0 7px}
	.ce-code-root .ce-command-trigger>span:not(.ce-command-mark),.ce-code-root .ce-command-trigger>kbd{display:none}
	.ce-code-root .ce-workspace-search{width:26px;padding:0}
	.ce-code-root .ce-workspace-search>span{display:none}
	.ce-code-root .ce-seg-btn{padding:0 8px}
}
@media(pointer:coarse){
	.ce-tool{width:32px;height:32px}
	.ce-row{min-height:32px}
	.cet-row{height:32px;min-height:32px}
}

/* Markup-level state hooks that carry no geometry of their own. */
/* Markup-level state hooks that carry no geometry of their own. */
.ce-tab-dirty{color:var(--ce-warn)}
.ce-conflict{box-shadow:inset 2px 0 0 var(--ce-warn)}
.ce-commitbox-ai{display:inline-flex;align-items:center;justify-content:center;flex:none;min-height:28px;padding:0 9px;border:1px solid transparent;border-radius:6px;background:var(--ce-fill);color:var(--ce-fg-2);font:inherit;font-size:11.5px;font-weight:500;cursor:pointer;white-space:nowrap}
.ce-commitbox-ai:hover{background:var(--ce-fill-strong);color:var(--ce-fg)}
.ce-commitbox-ai:disabled{opacity:.45;cursor:default}
`;