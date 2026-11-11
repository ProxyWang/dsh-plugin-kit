/* ---------------- styles ---------------- */

import { ROW } from "./constants.js";

export const CSS = `
.ce-root{height:100%;min-height:0;display:flex;flex-direction:column;position:relative;color:var(--dsw-alias-label-primary,#ddd);font-size:13px;background:var(--dsw-alias-bg-base,#181818)}
.ce-toolbar{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.ce-tool.ce-workspace-search{width:auto;flex:none;gap:5px;padding:0 7px;white-space:nowrap;font:inherit;font-size:11px}
.ce-workspace-search svg{width:14px;height:14px;flex:none}
.ce-seg{display:flex;border-radius:var(--dsw-radius-sm,6px);overflow:hidden;border:.5px solid var(--dsw-alias-border-l2,#444)}
.ce-seg-btn{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#999);padding:3px 10px;cursor:pointer;font:inherit}
.ce-seg-on{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#eee)}
.ce-branch{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary,#9ab);font:inherit;font-size:12px;margin-left:2px;border:0;background:transparent;cursor:pointer;padding:2px 7px;border-radius:6px}
.ce-branch:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30);color:var(--dsw-alias-label-primary,#dde)}
.ce-branch:disabled{opacity:.6;cursor:default}
.ce-ab{font-size:10.5px;font-weight:700;letter-spacing:.02em}
.ce-ab-ahead{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-ab-behind{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-spin{display:inline-flex;animation:ce-spin .9s linear infinite}
.ce-spin svg{width:12px;height:12px}
@keyframes ce-spin{to{transform:rotate(360deg)}}
.ce-spacer{flex:1}
.ce-tool{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--dsw-radius-sm,6px);border:0;background:transparent;color:var(--dsw-alias-label-secondary,#999);cursor:pointer}
.ce-tool:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#eee)}
.ce-tool-on{color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-tool:disabled{opacity:.35;cursor:default}
.ce-tiny{width:20px;height:20px}
.ce-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary,#666)}
.ce-dot-ready{background:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-dot-starting{background:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-dot-error{background:var(--dsw-alias-state-error-primary,#f85149)}
.ce-main{flex:1;min-height:0;display:flex}
.ce-rail-wrap{width:230px;min-width:150px;flex:none;display:flex;border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-rail-with-search{flex-direction:column;min-height:0}
.ce-rail-with-search>.ce-rail{min-height:0}
.ce-rail-search{display:flex;align-items:center;gap:8px;flex:none;align-self:stretch;min-height:32px;margin:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l2,#444);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#1e2126);color:var(--dsw-alias-label-secondary,#aaa);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.ce-rail-search svg{width:14px;height:14px;flex:none}
.ce-rail-search:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e);color:var(--dsw-alias-label-primary,#ddd)}
.ce-rail-search:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:1px}
.ce-rail{flex:1;min-width:0}
.ce-scroll{overflow:auto;scrollbar-gutter:stable}
.ce-row{display:flex;align-items:center;gap:6px;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:4px 8px;cursor:pointer;border-radius:4px;min-width:0}
.ce-row:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-active{background:var(--dsw-alias-interactive-bg-hover,#2c313a)}
.ce-row-drop{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 18%,transparent);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#59b7ff)}
.ce-tree-ico{margin:0 1px}
.ce-ico{flex:none;display:inline-flex;color:var(--dsw-alias-label-tertiary,#777)}
.ce-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ce-note{color:var(--dsw-alias-label-tertiary,#777);padding:3px 10px;font-size:12px}
.ce-section{display:flex;align-items:center;justify-content:space-between;gap:4px;color:var(--dsw-alias-label-secondary,#999);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 8px 4px}
.ce-badge{flex:none;width:16px;height:16px;line-height:16px;text-align:center;border-radius:4px;font-size:10px;font-weight:700;background:var(--dsw-alias-interactive-bg-hover,#333);color:var(--dsw-alias-label-secondary,#999)}
.ce-badge-m{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-badge-a,.ce-badge-u{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-badge-d,.ce-badge-r{color:var(--dsw-alias-state-error-primary,#f85149)}
.ce-badge-c{color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-editor{flex:1;min-width:0;display:flex;flex-direction:column;position:relative}
.ce-tabs{display:flex;gap:2px;align-items:flex-end;flex:none;overflow-x:auto;overflow-y:hidden;padding:4px 6px 0;background:var(--dsw-alias-bg-base,#181818);border-bottom:.5px solid var(--dsw-alias-border-l1,#333);scrollbar-width:thin}
.ce-tab{display:flex;gap:4px;align-items:center;flex:none;max-width:170px;padding:3px 5px 3px 8px;border:.5px solid transparent;border-bottom:0;border-radius:6px 6px 0 0;cursor:pointer;color:var(--dsw-alias-label-tertiary,#889);background:transparent;font-size:11.5px}
.ce-tab:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-tab-active{background:var(--dsw-alias-bg-layer-1,#1e2126);color:var(--dsw-alias-label-primary,#ddd);border-color:var(--dsw-alias-border-l1,#333)}
.ce-tab-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-tab-dot{flex:none;width:9px;font-size:8px;line-height:1;color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-tab-x{border:0;background:transparent;color:inherit;font:inherit;font-size:9px;cursor:pointer;padding:1px 3px;border-radius:4px;opacity:.55;flex:none}
.ce-tab-x:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover,#3a3d42)}
.ce-head{display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none;min-width:0}
.ce-head-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary,#ddd)}
.ce-chip{font-size:11px;padding:1px 7px;border-radius:99px;background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-secondary,#999);flex:none}
.ce-pos{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#888);flex:none}
.ce-diag{font-size:11px;color:var(--dsw-alias-state-error-primary,#f85149);flex:none}
.ce-code-wrap{flex:1;min-height:0;display:flex;overflow:hidden;position:relative}
.ce-gutter{flex:none;width:52px;overflow:hidden;position:relative;background:var(--dsw-alias-bg-base,#181818);border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-gutter-inner{position:absolute;top:0;left:0;right:0}
.ce-gline{position:absolute;right:8px;height:${ROW}px;line-height:${ROW}px;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-tertiary,#667)}
.ce-gline-active{color:var(--dsw-alias-label-primary,#cde)}
.ce-code{flex:1;min-width:0;overflow:auto;position:relative}
.ce-code-inner{position:relative;min-width:max-content}
.ce-line{position:absolute;left:0;min-width:max-content;height:${ROW}px;line-height:${ROW}px;white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;padding-right:24px}
.ce-flash{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 18%,transparent);animation:ce-fade 1.4s ease-out}
@keyframes ce-fade{from{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 30%,transparent)}to{background:transparent}}
.ce-kw{color:var(--ce-kw,var(--dsw-alias-brand-primary,#6cb2ff))}
.ce-type{color:var(--ce-type,#7de3a4)}
.ce-str{color:var(--ce-str,#e6b56d)}
.ce-prop{color:var(--ce-prop,#9cdcfe)}
.ce-num{color:var(--ce-num,#d19a66)}
.ce-com{color:var(--ce-com,var(--dsw-alias-label-tertiary,#7a8490));font-style:italic}
.ce-jump{cursor:pointer;text-decoration:underline dotted transparent;text-underline-offset:3px}
.ce-jump:hover{text-decoration-color:var(--dsw-alias-label-tertiary,#889)}
.ce-underline{position:absolute;bottom:3px;height:2px;border-bottom:2px dotted var(--dsw-alias-state-error-primary,#f85149);pointer-events:auto;background:transparent}
.ce-underline-warn{border-bottom-color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-hover{position:absolute;z-index:5;max-width:420px;min-width:180px;background:var(--dsw-alias-bg-overlay,#232729);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:var(--dsw-radius-md,8px);padding:8px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;box-shadow:0 6px 22px rgba(0,0,0,.35);pointer-events:none;color:var(--dsw-alias-label-primary,#ddd)}
.ce-overlay{position:absolute;left:8px;right:8px;top:36px;z-index:6;background:var(--dsw-alias-bg-layer-2,#24272c);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:var(--dsw-radius-md,8px);box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;max-height:60%}
.ce-overlay-head{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);font-weight:600}
.ce-overlay-list{overflow:auto}
.ce-loc{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px;cursor:pointer;white-space:nowrap}
.ce-loc:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-loc-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-brand-primary,#6cb2ff);flex:none}
.ce-loc-snippet{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-secondary,#999);overflow:hidden;text-overflow:ellipsis}
.ce-dline{display:flex;min-width:max-content;height:${ROW}px;line-height:${ROW}px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;white-space:pre;padding-right:24px}
.ce-dline-add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent)}
.ce-dline-del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 14%,transparent)}
.ce-dline-hunk{color:var(--dsw-alias-brand-primary,#6cb2ff)}
.ce-dline-meta{color:var(--dsw-alias-label-tertiary,#777);font-style:italic}
.ce-dnum{width:44px;flex:none;text-align:right;padding-right:8px;color:var(--dsw-alias-label-tertiary,#667);user-select:none}
.ce-dtext{min-width:0}
.ce-sbsrow{display:grid;grid-template-columns:40px minmax(0,1fr) 40px minmax(0,1fr)}
.ce-sbsrow-full{display:flex;align-items:center}
.ce-sbsrow-full .ce-sbscell{flex:1;min-width:0}
.ce-hunk-revert{margin-left:auto;flex:none;opacity:.6}
.ce-dline:hover .ce-hunk-revert,.ce-sbsrow-full:hover .ce-hunk-revert{opacity:1}
.ce-hunk-confirm{margin-left:auto;display:flex;gap:2px;align-items:center;flex:none}
.ce-hunk-revert-on{color:var(--dsw-alias-state-error-primary,#f85149);font-weight:700}
.ce-sbsnum{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:19px;color:var(--dsw-alias-label-tertiary,#667);text-align:right;padding:1px 6px 1px 0;user-select:none;background:rgba(128,128,128,.05);overflow:hidden}
.ce-sbscell{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:19px;white-space:pre-wrap;overflow-wrap:break-word;padding:1px 10px 1px 4px;min-width:0}
.ce-sbs-del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 12%,transparent)}
.ce-sbs-add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 12%,transparent)}
.ce-sbs-empty{background:rgba(128,128,128,.05)}
.ce-wd{border-radius:2px}
.ce-wd-del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 45%,transparent)}
.ce-wd-add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 45%,transparent)}
.ce-wd-zero{display:inline-block;width:0;overflow:hidden;vertical-align:baseline}
.ce-wd-zero.ce-wd-add{border-left:2px solid var(--dsw-alias-state-success-primary,#3fb950)}
.ce-wd-zero.ce-wd-del{border-left:2px solid var(--dsw-alias-state-error-primary,#f85149)}
.ce-dnav{outline:1.5px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:-1.5px}
.ce-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#7a8490);padding:24px;text-align:center}
.ce-statusbar{flex:none;display:flex;gap:8px;align-items:center;padding:3px 10px;border-top:.5px solid var(--dsw-alias-border-l1,#333);font-size:11px;color:var(--dsw-alias-label-tertiary,#889);min-height:22px}
.ce-title-ico{display:inline-flex;margin-right:2px}
.ce-peek{position:absolute;left:12px;width:min(720px,calc(100% - 24px));z-index:6;background:var(--dsw-alias-bg-layer-1,#1d2126);border:.5px solid var(--dsw-alias-border-l2,#454a52);border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.18);display:flex;flex-direction:column;max-height:390px;overflow:hidden}
.ce-peek-head{display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none;background:var(--dsw-alias-bg-layer-1,#1d2126)}
.ce-peek-sym{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:13px;color:var(--dsw-alias-label-primary,#eee);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42%}
.ce-peek-meta{font-size:11px;color:var(--dsw-alias-label-secondary,#999);flex:none;padding:2px 7px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,#252a31)}
.ce-peek-hint{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#778);flex:none;margin-right:4px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-peek-body{min-height:0;padding:4px 0 8px}
.ce-peek-file{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:7px;padding:6px 12px;background:var(--dsw-alias-bg-layer-2,#23272c);border-top:.5px solid var(--dsw-alias-border-l1,#333);border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-peek-file-icon{width:15px;flex:none;text-align:center;color:var(--dsw-alias-label-tertiary,#889);font-size:12px}
.ce-peek-fpath{direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary,#c3cbd5)}
.ce-peek-file-count{flex:none;min-width:20px;text-align:center;padding:1px 6px;border-radius:9px;background:var(--dsw-alias-bg-layer-1,#1d2126);color:var(--dsw-alias-label-tertiary,#889);font-size:10px;font-variant-numeric:tabular-nums}
.ce-peek-row{display:grid;grid-template-columns:16px 58px minmax(0,1fr);gap:8px;align-items:baseline;width:100%;text-align:left;border:0;border-left:3px solid transparent;background:transparent;color:inherit;font:inherit;padding:5px 12px 5px 11px;cursor:pointer;white-space:nowrap}
.ce-peek-row:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-peek-row-sel{background:var(--dsw-alias-interactive-bg-hover,#2b3038);border-left-color:var(--dsw-alias-brand-primary,#59b7ff);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 24%,transparent)}
.ce-peek-def{border-left-color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-peek-kind{width:16px;text-align:center;color:var(--dsw-alias-label-tertiary,#778);font-size:10px}
.ce-peek-def .ce-peek-kind{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-peek-lno{min-width:0;text-align:right;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;flex:none;user-select:none}
.ce-peek-def .ce-peek-lno{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-peek-snippet{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-primary,#d5dbe3);overflow:hidden;text-overflow:ellipsis;white-space:pre;min-width:0}
.ce-mark{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 34%,transparent);border-radius:3px;box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent);text-decoration:none}
.ce-banner{flex:none;display:flex;align-items:center;gap:8px;margin:6px 10px 0;padding:6px 8px 6px 10px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 14%,transparent);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 40%,transparent);color:var(--dsw-alias-label-primary,#eee);font-size:12px}
.ce-banner-text{min-width:0;flex:1;white-space:pre-wrap;word-break:break-word}
.ce-splitter{flex:none;width:5px;cursor:col-resize;background:transparent;border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-splitter:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent)}
.ce-rail-tab{flex:none;width:16px;border:0;border-right:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#1d2126);color:var(--dsw-alias-label-tertiary,#889);cursor:pointer;font-size:10px;padding:0}
.ce-rail-tab:hover{color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-crumb{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#9ab);font:inherit;font-size:12px;cursor:pointer;padding:1px 6px;border-radius:5px;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.ce-crumb:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30);color:var(--dsw-alias-label-primary,#eee)}
.ce-note-line{display:flex;align-items:center;justify-content:space-between;gap:6px}
.ce-link{border:0;background:transparent;color:var(--dsw-alias-brand-primary,#6cb2ff);font:inherit;font-size:11px;cursor:pointer;padding:0 2px;flex:none}
.ce-link:hover{text-decoration:underline}
.ce-commit{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:3px 10px 3px 14px;cursor:pointer;border-radius:4px;white-space:nowrap}
.ce-commit:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-chash{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#778);flex:none}
.ce-histrow{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px;cursor:pointer;white-space:nowrap}
.ce-histrow:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-histrow .ce-csubject{flex:1}
.ce-histmeta{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#778)}
.ce-histpath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-left:8px}
.ce-csubject{color:var(--dsw-alias-label-secondary,#9ab);overflow:hidden;text-overflow:ellipsis;min-width:0}
.ce-symglyph{width:16px;flex:none;text-align:center;color:var(--dsw-alias-label-tertiary,#889);font-size:12px}
.ce-prog{font-size:11px;color:var(--dsw-alias-label-tertiary,#889);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:50%}
.ce-palette{position:absolute;top:40px;left:50%;transform:translateX(-50%);width:min(560px,calc(100% - 32px));z-index:8;display:flex;flex-direction:column;max-height:70%;background:var(--dsw-alias-bg-layer-2,#24272c);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:var(--dsw-radius-md,8px);box-shadow:0 14px 44px rgba(0,0,0,.45);overflow:hidden}
.ce-bp .ce-palette-head{background:var(--dsw-alias-bg-layer-1,#1e2126);border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-bp .ce-palette-list{background:var(--dsw-alias-bg-layer-2,#24272c)}
.ce-bp .ce-section{background:transparent;color:var(--dsw-alias-label-tertiary,#889)}
.ce-bp .ce-qitem{background:transparent}
.ce-bp .ce-qitem-sel{background:var(--dsw-alias-interactive-bg-hover,#2b3038)}
.ce-bp-act{flex:none;border:.5px solid var(--dsw-alias-border-l2,#444);background:transparent;color:var(--dsw-alias-label-secondary,#999);border-radius:6px;font:inherit;font-size:11px;padding:3px 9px;cursor:pointer}
.ce-bp-act:hover{color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-bp-act:disabled{opacity:.45;cursor:default}
.ce-bp-push{color:var(--dsw-alias-brand-primary,#6cb2ff);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent)}
.ce-palette-head{display:flex;align-items:center;gap:6px;padding:8px}
.ce-input{flex:1;min-width:0;background:var(--dsw-alias-bg-layer-1,#1e2126);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:6px;color:var(--dsw-alias-label-primary,#ddd);padding:6px 9px;font:inherit;outline:none}
.ce-input:focus{border-color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-palette-list{border-top:.5px solid var(--dsw-alias-border-l1,#333);padding:4px 0}
.ce-qitem{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:5px 12px;cursor:pointer}
.ce-qitem-sel{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-qbase{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62%;flex:none}
.ce-qdir{font-size:11px;color:var(--dsw-alias-label-tertiary,#778);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ce-search{position:absolute;inset:0;z-index:7;background:var(--dsw-alias-bg-base,#181818);display:flex;flex-direction:column;padding:10px;gap:8px}
.ce-search-box{display:flex;gap:6px;align-items:center;flex:none}
.ce-search-include{flex:none}
.ce-repo{width:calc(100% - 16px);margin:4px 8px 2px;font-size:11px;padding:4px 6px;flex:none;align-self:flex-start}
.ce-changes{overflow-x:hidden}
.ce-changes>.ce-note{padding:8px 12px 4px;overflow-wrap:anywhere}
.ce-change-group{min-width:0;padding:8px 0 12px;border-top:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-changes .ce-section{justify-content:flex-start;flex-wrap:wrap;gap:8px;padding:8px 12px;text-transform:none;letter-spacing:normal;color:var(--dsw-alias-label-primary,#ddd)}
.ce-changes .ce-section>span:first-child{flex:1;min-width:0}
.ce-changes .ce-section>.ce-link,.ce-changes .ce-section>.ce-tool{flex:none}
.ce-changes .ce-note{padding-left:12px;padding-right:12px;line-height:1.5}
.ce-changes .ce-note-line{align-items:flex-start;flex-wrap:wrap;gap:4px 8px}
.ce-changes .ce-note-line>span{flex:1 1 160px;min-width:0;overflow-wrap:anywhere}
.ce-changes .ce-note-line>.ce-link{flex:none}
.ce-changes-search{display:flex;gap:6px;align-items:center;padding:4px 12px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-changes-search .ce-input{flex:1;min-width:0;font-size:12px;padding:6px 8px}
.ce-changes-search .ce-sk-btn{flex:none;font-size:11px;white-space:nowrap}
.ce-commitbox{display:flex;flex-direction:column;gap:8px;align-items:stretch;padding:8px 12px 12px;min-width:0;flex:none}
.ce-commitbox-msg{flex:none;width:100%;box-sizing:border-box;min-width:0;font-size:12px;padding:7px 8px}
.ce-commitbox-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;min-width:0}
.ce-commitbox-amend{display:inline-flex;align-items:center;justify-content:center;flex:none;min-height:28px;border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#999);font:inherit;font-size:11px;padding:4px 8px;cursor:pointer}
.ce-commitbox-amend:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-commitbox-amend:disabled{opacity:.45;cursor:default}
.ce-commitbox-amend:focus-visible,.ce-commitbox-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:2px}
.ce-commitbox-btn{flex:0 1 auto;max-width:100%;min-height:28px;border:0;border-radius:6px;background:var(--dsw-alias-brand-primary,#2f81f7);color:#fff;font:inherit;font-size:11px;font-weight:600;padding:5px 10px;cursor:pointer;white-space:normal;overflow-wrap:anywhere;text-align:center}
.ce-commitbox-btn:hover{filter:brightness(1.12)}
.ce-commitbox-btn:disabled{opacity:.45;cursor:default;filter:none}
.ce-stash-save{display:flex;gap:5px;align-items:center;padding:4px 8px;flex-wrap:wrap}
.ce-stash-save .ce-input{flex:1;min-width:90px;font-size:11px;padding:4px 6px}
.ce-stash-u{display:flex;gap:3px;align-items:center;font-size:10px;color:var(--dsw-alias-label-tertiary,#889);flex:none;cursor:pointer;user-select:none}
.ce-stashrow{display:flex;gap:6px;align-items:center;padding:3px 8px;width:100%}
.ce-stashrow:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-stashref{flex:none;font-size:10px;font-weight:700;color:var(--dsw-alias-brand-primary,#6cb2ff);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-stashmsg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-secondary,#bcc)}
.ce-stashacts{flex:none;display:flex;gap:2px;align-items:center}
.ce-search-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#778);flex:none;min-height:14px}
.ce-search-results{flex:1;min-height:0;border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#1e2126)}
.ce-srow{display:flex;align-items:stretch;width:100%}
.ce-sgroup-row{display:flex;align-items:center;gap:2px;width:100%;position:sticky;top:0;z-index:1;background:var(--dsw-alias-bg-layer-1,#1e2126);border-bottom:.5px solid var(--dsw-alias-border-l1,#2a2a2a)}
.ce-sgroup{display:flex;gap:5px;align-items:center;flex:1;min-width:0;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 4px 3px 8px;cursor:pointer}
.ce-sgroup:hover .ce-sgroup-path{color:var(--dsw-alias-label-primary,#eee)}
.ce-sgroup-rep{flex:none;margin-right:6px}
.ce-sgroup-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary,#bcc);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-sgroup-count{flex:none;font-size:10px;color:var(--dsw-alias-label-secondary,#999);background:var(--dsw-alias-bg-layer-2,#2a2d33);border-radius:8px;padding:0 7px;line-height:16px}
.ce-shl{color:var(--dsw-alias-label-primary,#fff);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e3b341) 32%,transparent);border-radius:2px;font-weight:600}
.ce-sctx-toggle{flex:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#778);cursor:pointer;padding:4px 1px 4px 7px;font:inherit;font-size:10px;line-height:1}
.ce-sctx-toggle:hover{color:var(--dsw-alias-label-primary,#ddd)}
.ce-sresult{display:flex;gap:10px;align-items:baseline;flex:1;min-width:0;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px 4px 5px;cursor:pointer;white-space:nowrap}
.ce-sresult:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-sctx{border-left:2px solid var(--dsw-alias-border-l2,#444);margin:0 6px 3px 15px;background:var(--dsw-alias-bg-layer-2,#1c1f24);border-radius:0 6px 6px 0;overflow:hidden}
.ce-sctx-line{display:flex;gap:8px;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:1px 8px;cursor:pointer;white-space:nowrap}
.ce-sctx-line:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-sctx-no{flex:none;min-width:30px;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--dsw-alias-label-tertiary,#667)}
.ce-sctx-text{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#999);overflow:hidden;text-overflow:ellipsis}
.ce-sctx-hit{background:rgba(47,129,247,.10)}
.ce-sctx-hit .ce-sctx-text{color:var(--dsw-alias-label-primary,#ddd)}
.ce-sctx-note{padding:3px 10px 5px 24px;font-size:11px;color:var(--dsw-alias-label-tertiary,#778)}
.ce-sloc{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-brand-primary,#6cb2ff);flex:none}
.ce-stext{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-secondary,#999);overflow:hidden;text-overflow:ellipsis}
.ce-calrow{display:flex;align-items:center;gap:8px;width:100%;border:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#1e2126);color:inherit;font:inherit;text-align:left;padding:4px 10px;cursor:pointer;border-radius:8px;margin:2px 0}
.ce-calrow:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-calrow:disabled{cursor:default;opacity:.7}
.ce-calrow-fail{opacity:.65}
.ce-calrow-run{cursor:default;border-style:dashed}
.ce-cal-label{flex:none;font-weight:600;font-size:12px;color:var(--dsw-alias-label-secondary,#9ab)}
.ce-cal-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-primary,#ddd)}
.ce-cal-stats{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.ce-cal-hint{flex:none;font-size:11px;color:var(--dsw-alias-brand-primary,#6cb2ff);opacity:0;transition:opacity .12s}
.ce-calrow:hover .ce-cal-hint{opacity:1}
.ce-cal-hint-on{opacity:1;color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-root{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;container-type:inline-size;overflow:hidden}
.ce-sk-top{display:flex;gap:8px;align-items:center;flex:none;padding:12px 16px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-sk-heading{display:flex;align-items:baseline;gap:8px;flex:1;min-width:0;flex-wrap:wrap}
.ce-sk-heading h2{font-size:14px;font-weight:600;margin:0;color:var(--dsw-alias-label-primary,#ddd)}
.ce-sk-total{font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-workspace{display:grid;grid-template-columns:clamp(210px,30%,280px) minmax(0,1fr);flex:1;min-height:0;min-width:0}
.ce-sk-list{min-width:0;min-height:0;border-right:.5px solid var(--dsw-alias-border-l1,#333);display:flex;flex-direction:column;overflow:hidden}
.ce-sk-searchbar{display:flex;flex-direction:column;gap:8px;padding:12px;flex:none;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-sk-searchbar .ce-input{width:100%;box-sizing:border-box;flex:none;font-size:12px;min-height:32px}
.ce-sk-scope{min-width:0;border:.5px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-1,#1e2126);color:var(--dsw-alias-label-secondary,#999);border-radius:6px;font:inherit;font-size:11px;padding:6px 8px;min-height:30px}
.ce-sk-results{flex:1;min-height:0;overflow:auto;padding-bottom:12px}
.ce-sk-section{display:flex;justify-content:space-between;gap:8px;margin:0;padding:16px 16px 8px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-section>span:last-child{font-weight:400;font-variant-numeric:tabular-nums}
.ce-sk-row{display:flex;flex-direction:column;gap:4px;width:calc(100% - 12px);margin:0 6px 4px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;padding:10px;cursor:pointer}
.ce-sk-row:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-sk-row-on{background:var(--dsw-alias-interactive-bg-hover,#2c313a)}
.ce-sk-row-on .ce-sk-row-name{color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-sk-row-name{max-width:100%;font-size:12px;line-height:1.4;font-weight:600;color:var(--dsw-alias-label-primary,#ddd);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-sk-row-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary,#999);overflow-wrap:anywhere}
.ce-sk-row:disabled{cursor:default;opacity:.65}
.ce-sk-edit{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.ce-sk-detail-head{flex:none;max-height:42%;overflow:auto;padding:20px 20px 12px}
.ce-sk-detail-title{margin:0 0 8px;font-size:18px;line-height:1.4;font-weight:600;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary,#ddd)}
.ce-sk-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-detail-desc{margin:12px 0 8px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,#999);overflow-wrap:anywhere}
.ce-sk-detail-tools{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 16px;border-top:.5px solid var(--dsw-alias-border-l1,#333);border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-sk-view-switch{display:flex;align-items:center;gap:2px;margin-right:auto}
.ce-sk-edit-label{margin-right:auto;font-size:12px;color:var(--dsw-alias-label-secondary,#999)}
.ce-sk-root .ce-sk-view-on{background:var(--dsw-alias-interactive-bg-hover,#2c313a);color:var(--dsw-alias-label-primary,#ddd)}
.ce-sk-root .ce-sk-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#2f81f7));border-color:transparent;color:var(--dsw-alias-label-on-color,#fff)}
.ce-sk-root .ce-sk-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#2f81f7)));filter:none}
.ce-sk-root .ce-sk-btn{min-height:28px;white-space:normal}
.ce-sk-name-hint{flex-basis:100%;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary,#999)}
.ce-sk-edit .ce-md-pre,.ce-sk-edit .ce-md-code{background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-primary,#ddd)}
.ce-sk-back{display:none;margin-bottom:12px}
.ce-sk-create{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none;align-items:center}
.ce-sk-name-input{flex:1 1 180px;min-width:0;font-size:12px}
.ce-sk-welcome{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:12px;flex:1;padding:32px;max-width:440px;align-self:center;color:var(--dsw-alias-label-secondary,#999)}
.ce-sk-welcome>svg{width:28px;height:28px;color:var(--dsw-alias-label-tertiary,#889);margin-bottom:4px}
.ce-sk-welcome h3{margin:0;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary,#ddd)}
.ce-sk-welcome p{margin:0;font-size:12px;line-height:1.7}
.ce-sk-welcome-note{color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-feedback{padding:20px 16px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,#999);overflow-wrap:anywhere;display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
.ce-sk-delete-confirm{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:12px 16px;background:var(--dsw-alias-bg-layer-1,#1e2126);border-bottom:.5px solid var(--dsw-alias-border-l1,#333);font-size:12px}
.ce-sk-delete-confirm>span{flex:1 1 180px;overflow-wrap:anywhere}
.ce-sk-ta,.ce-sk-source{flex:1;min-height:0;resize:none;border:0;outline:none;margin:0;background:transparent;color:var(--dsw-alias-label-primary,#ddd);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;padding:16px 20px;white-space:pre;overflow:auto}
.ce-sk-root button:focus-visible,.ce-sk-root select:focus-visible,.ce-sk-root textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:-2px}
@container (max-width:620px){.ce-sk-workspace{grid-template-columns:minmax(0,1fr)}.ce-sk-list{border-right:0}.ce-sk-edit{display:none}.ce-sk-has-selection .ce-sk-list{display:none}.ce-sk-has-selection .ce-sk-edit{display:flex}.ce-sk-back{display:inline-flex}.ce-sk-searchbar{flex-direction:row;flex-wrap:wrap}.ce-sk-searchbar .ce-input{flex:1 1 160px;width:auto;min-width:0}.ce-sk-searchbar .ce-sk-scope{flex:1 1 100px}.ce-sk-top{padding:12px}.ce-sk-detail-head{padding:16px}.ce-sk-detail-title{font-size:16px}.ce-sk-name-input{flex-basis:100%}}
.ce-sk-btn{border:.5px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-primary,#ddd);border-radius:6px;font:inherit;font-size:11px;padding:3px 10px;cursor:pointer;flex:none}
.ce-sk-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-sk-btn:disabled{opacity:.45;cursor:default}
.ce-sk-btn-danger{color:var(--dsw-alias-state-error-primary,#f85149);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 45%,transparent)}
.ce-sk-btn-ghost{background:transparent;color:var(--dsw-alias-label-secondary,#999)}
.ce-sk-path{display:block;width:100%;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#777);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;padding:4px 0;cursor:pointer;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.ce-sk-path:hover{color:var(--dsw-alias-brand-primary,#6cb2ff);text-decoration:underline}
.ce-imgwrap{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px;overflow:auto}
.ce-img{max-width:100%;object-fit:contain;border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:6px;background:repeating-conic-gradient(#2b2b2b 0% 25%, #232323 0% 50%) 0 0/16px 16px}
.ce-imgmeta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,#778);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-md{flex:1;min-height:0;overflow:auto;padding:14px 18px;font-size:13px;line-height:1.7;color:var(--dsw-alias-label-primary,#ddd)}
.ce-md-h{font-weight:700;color:var(--dsw-alias-label-primary,#eee);margin:14px 0 6px}
.ce-md-h1{font-size:19px}
.ce-md-h2{font-size:16px}
.ce-md-h3{font-size:14px}
.ce-md-h4,.ce-md-h5,.ce-md-h6{font-size:13px}
.ce-md-p{margin:6px 0}
.ce-md-pre{background:var(--dsw-alias-markdown-code-block,#20242a);border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:8px;padding:8px 10px;overflow:auto;margin:8px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;white-space:pre}
.ce-md-code{background:var(--dsw-alias-markdown-code-block,#20242a);border-radius:4px;padding:1px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.ce-md-list{margin:6px 0;padding-left:22px}
.ce-md-list li{margin:2px 0}
.ce-md-quote{border-left:3px solid var(--dsw-alias-border-l2,#444);padding:2px 10px;margin:8px 0;color:var(--dsw-alias-label-secondary,#999)}
.ce-md-hr{border:0;border-top:.5px solid var(--dsw-alias-border-l1,#333);margin:12px 0}
.ce-md-table{border-collapse:collapse;margin:8px 0;font-size:12.5px}
.ce-md-table th,.ce-md-table td{border:.5px solid var(--dsw-alias-border-l1,#333);padding:4px 10px;text-align:left}
.ce-md-table th{background:var(--dsw-alias-bg-layer-2,#24272c);font-weight:600}
.ce-md-a{color:var(--dsw-alias-brand-primary,#6cb2ff);text-decoration:none}
.ce-md-a:hover{text-decoration:underline}
.cel-root{padding:14px 12px 20px;display:flex;flex-direction:column;gap:2px;height:100%;box-sizing:border-box}
.cel-section{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#889);padding:12px 4px 6px}
.cel-row{display:flex;align-items:center;gap:10px;width:100%;border:.5px solid transparent;background:transparent;color:inherit;font:inherit;text-align:left;padding:8px 10px;border-radius:10px;cursor:pointer}
.cel-row:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e);border-color:var(--dsw-alias-border-l1,#333)}
.cel-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:-2px}
.cel-ico{flex:none;width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 12%,transparent);color:var(--dsw-alias-brand-primary,#59b7ff)}
.cel-ico svg{width:16px;height:16px}
.cel-ico-skills{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e3b341) 14%,transparent);color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cel-ico-run{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 12%,transparent);color:var(--dsw-alias-state-success-primary,#3fb950)}
.cel-ico-more{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-secondary,#999)}
.cel-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.cel-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#ddd);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cel-desc{font-size:11.5px;line-height:1.45;color:var(--dsw-alias-label-tertiary,#777);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cel-kbd{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#999);background:var(--dsw-alias-bg-layer-2,#24272c);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:5px;padding:2px 6px}
.ce-chip-warn{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-sk-confirm{display:inline-flex;gap:8px;align-items:center}
.ce-link-danger{color:var(--dsw-alias-state-error-primary,#f85149)}
.ce-find{display:flex;gap:6px;align-items:center;padding:4px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.ce-find-input{flex:0 1 240px}
.ce-find-count{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#889);flex:none}
.ce-edit-ta{flex:1;min-height:0;resize:none;border:0;outline:none;background:var(--dsw-alias-bg-base,#181818);color:var(--dsw-alias-label-primary,#ddd);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:${ROW}px;padding:8px 10px;white-space:pre;overflow:auto;tab-size:4}
.ce-gline-find{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-line-changed{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 20%,transparent);box-shadow:inset 3px 0 0 0 var(--dsw-alias-state-success-primary,#3fb950)}
.ce-gline-changed{color:var(--dsw-alias-state-success-primary,#3fb950);font-weight:700;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent)}
.ce-delbar{position:absolute;left:0;right:0;width:100%;height:${ROW}px;display:flex;align-items:center;gap:6px;padding:0 10px;border:0;text-align:left;cursor:pointer;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 16%,transparent);color:var(--dsw-alias-state-error-primary,#f85149);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}
.ce-delbar:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 28%,transparent)}
.ce-wdoc{padding:4px 0 10px;min-width:0}
.ce-wline{display:flex;align-items:flex-start;padding-right:10px}
.ce-wlineno{flex:none;width:52px;box-sizing:border-box;padding-right:10px;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:${ROW}px;color:var(--dsw-alias-label-tertiary,#667);user-select:none}
.ce-wlineno-active{color:var(--dsw-alias-label-primary,#cde)}
.ce-wtext{flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:${ROW}px;tab-size:4}
.ce-delbar-flow{position:static;width:auto;height:${ROW}px;margin-left:52px;border-radius:4px}
.ce-wcap{padding:6px 12px}
.ce-goto{width:min(340px,calc(100% - 32px))}
.ce-edit-ta-wrap{white-space:pre-wrap;overflow-wrap:break-word}
.ce-pos-btn{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:0 2px;border-radius:4px}
.ce-pos-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#ddd)}
.ce-chip-mark{color:var(--dsw-alias-state-success-primary,#3fb950);cursor:pointer}
.ce-dline-click{cursor:pointer}
.ce-dline-click:hover{box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l2,#444)}
.ce-tree-dir{color:var(--dsw-alias-label-secondary,#999);font-weight:600}
.ce-tree-dir:hover{color:var(--dsw-alias-label-primary,#ddd)}
.ce-tree-chev{flex:none;width:10px;font-size:9px;color:var(--dsw-alias-label-tertiary,#777)}
.ce-tree-folder{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.ce-tree-count{background:transparent;color:var(--dsw-alias-label-tertiary,#889);font-weight:600}
.ce-tree-file .ce-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.cet-row{height:24px;min-height:24px;padding-top:0;padding-bottom:0;border-radius:0}
.cet-tw{flex:none;width:14px;font-size:8px;line-height:1;color:var(--dsw-alias-label-tertiary,#777);display:inline-flex;align-items:center;justify-content:center;transition:transform .12s ease}
.cet-tw-open{transform:rotate(90deg)}
.cet-fico{flex:none;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:#8a9199}
.cet-fico svg{width:14px;height:14px;display:block}
.cet-fico-dir{color:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 75%,#9aa0a6)}
.cet-go{color:#59b7ff}
.cet-md{color:#9aa0a6}
.cet-sql{color:#e3b341}
.cet-toml{color:#e39a5c}
.cet-zip{color:#b07fe0}
.cet-html{color:#e0876a}
.cet-js{color:#d7ba7d}
.cet-json{color:#7de3a4}
.cet-file{color:#8a9199}
.cet-dirname{font-weight:600;color:var(--dsw-alias-label-primary,#ccc)}
.cet-count{margin-left:0;flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#777)}
.cet-right{margin-left:auto;flex:none;display:inline-flex;align-items:center;gap:6px}
.cet-act{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#889);cursor:pointer;font:inherit;font-size:12px;line-height:1;padding:2px 5px;border-radius:4px;opacity:0;transition:opacity .1s}
.cet-row:hover .cet-act{opacity:1}
.cet-act-show{opacity:1}
.cet-act:hover{color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.cet-act-danger{color:var(--dsw-alias-state-error-primary,#f85149);font-size:11px}.cet-context{position:fixed;z-index:100001;min-width:190px;max-width:260px;padding:4px;background:var(--dsw-alias-bg-layer-2,#24272c);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:7px;box-shadow:0 8px 24px rgba(0,0,0,.28);color:var(--dsw-alias-label-primary,#ddd)}
.cet-context-path{padding:6px 9px;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cet-context-rule{height:.5px;background:var(--dsw-alias-border-l1,#333);margin:3px 0}
.cet-context>button{display:block;width:100%;border:0;border-radius:4px;background:transparent;color:inherit;text-align:left;font:inherit;font-size:12px;padding:6px 9px;cursor:pointer}
.cet-context>button:hover,.cet-context>button:focus-visible{background:var(--dsw-alias-interactive-bg-hover,#2b3038);outline:0}
.cet-context-danger{color:var(--dsw-alias-state-error-primary,#f85149)!important}

.cet-context{position:fixed;z-index:100001;min-width:190px;max-width:260px;padding:4px;background:var(--dsw-alias-bg-layer-2,#24272c);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:7px;box-shadow:0 8px 24px rgba(0,0,0,.28);color:var(--dsw-alias-label-primary,#ddd)}
.cet-context-path{padding:6px 9px;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cet-context-rule{height:.5px;background:var(--dsw-alias-border-l1,#333);margin:3px 0}
.cet-context>button{display:block;width:100%;border:0;border-radius:4px;background:transparent;color:inherit;text-align:left;font:inherit;font-size:12px;padding:6px 9px;cursor:pointer}
.cet-context>button:hover,.cet-context>button:focus-visible{background:var(--dsw-alias-interactive-bg-hover,#2b3038);outline:0}
.cet-context-danger{color:var(--dsw-alias-state-error-primary,#f85149)!important}
.cet-status{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700}
.cet-st-m{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cet-st-u,.cet-st-a{color:var(--dsw-alias-state-success-primary,#3fb950)}
.cet-st-d{color:var(--dsw-alias-state-error-primary,#f85149)}
.cet-st-c{color:var(--dsw-alias-brand-primary,#59b7ff)}
.cet-st-r{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cet-dirhint{color:var(--dsw-alias-label-tertiary,#777);font-size:11px;margin-left:6px}
.ce-changerail{flex:none;width:12px;position:relative;border-left:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-changeblob{position:absolute;left:2px;right:2px;min-height:4px;border:0;padding:0;border-radius:2px;cursor:pointer}
.ce-changeblob-mod{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 80%,transparent)}
.ce-changeblob-del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 80%,transparent)}
.ce-changeblob:hover{filter:brightness(1.35)}
.ce-blame{flex:none;width:150px;overflow:hidden;position:relative;background:var(--dsw-alias-bg-layer-1,#1d2126);border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-bline{position:absolute;left:0;right:0;height:${ROW}px;line-height:${ROW}px;border:0;background:transparent;text-align:left;font:inherit;font-size:11px;color:var(--dsw-alias-label-tertiary,#778);padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.ce-bline:hover{color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-bline-uncommitted{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cea-bar{display:flex;gap:6px;padding:8px;flex:none;align-items:center;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.cea-method{flex:none;width:88px;border:.5px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-secondary,#999);border-radius:6px;font:inherit;font-size:11px;padding:4px 6px}
.cea-url{flex:1;min-width:0}
.cea-send{color:var(--dsw-alias-brand-primary,#6cb2ff);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent)}
.cea-scroll{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto}
.cea-sec{display:flex;align-items:center;gap:6px;padding:10px 8px 4px;color:var(--dsw-alias-label-tertiary,#889);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;flex:none}
.cea-tmo{display:flex;gap:4px;align-items:center;font-size:10px;color:var(--dsw-alias-label-tertiary,#889);text-transform:none;letter-spacing:0;font-weight:400;flex:none}
.cea-tmo-in{width:64px;flex:none;font-size:11px;padding:2px 6px}
.cea-hint{font-size:10px;color:var(--dsw-alias-label-tertiary,#778);text-transform:none;letter-spacing:0;font-weight:400}
.cea-hrow{display:flex;gap:4px;padding:2px 8px;align-items:center;flex:none}
.cea-hkey{flex:0 0 36%;min-width:0}
.cea-hval{flex:1;min-width:0}
.cea-body{flex:none;min-height:110px;max-height:220px;width:100%;box-sizing:border-box;resize:vertical;border:0;outline:none;background:var(--dsw-alias-bg-layer-1,#1e2126);color:var(--dsw-alias-label-primary,#ddd);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;padding:8px;margin:2px 0 4px;border-top:.5px solid var(--dsw-alias-border-l1,#333);border-bottom:.5px solid var(--dsw-alias-border-l1,#333);white-space:pre;overflow:auto}
.cea-import{min-height:140px;max-height:none;flex:1;border:0}
.cea-status{display:flex;gap:8px;align-items:center;padding:4px 8px;font-size:12px;flex:none}
.cea-meta{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.cea-ok{color:var(--dsw-alias-state-success-primary,#3fb950);font-weight:700}
.cea-info{color:var(--dsw-alias-brand-primary,#6cb2ff);font-weight:700}
.cea-warn{color:var(--dsw-alias-state-warn-primary,#e3b341);font-weight:700}
.cea-err{color:var(--dsw-alias-state-error-primary,#f85149);font-weight:700}
.cea-hlist{padding:0 8px 6px;font-size:11px;color:var(--dsw-alias-label-secondary,#999)}
.cea-hlist div{display:flex;gap:6px;line-height:1.6}
.cea-hk{font-weight:600;color:var(--dsw-alias-label-primary,#ccc);flex:none}
.cea-resp{flex:none;margin:0;padding:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;white-space:pre;overflow:auto;color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-bg-base,#181818);border-top:.5px solid var(--dsw-alias-border-l1,#333)}
.cea-btn-on{color:var(--dsw-alias-brand-primary,#6cb2ff);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent)}
.cea-hist{position:absolute;top:44px;left:8px;right:8px;z-index:8;background:var(--dsw-alias-bg-layer-1,#1e2126);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.45);display:flex;flex-direction:column;max-height:62%}
.cea-hist-tabs{display:flex;gap:4px;align-items:center;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.cea-tab{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#999);font:inherit;font-size:11px;padding:3px 9px;border-radius:6px;cursor:pointer;flex:none}
.cea-tab:hover{color:var(--dsw-alias-label-primary,#ddd)}
.cea-tab-on{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#ddd)}
.cea-hist-list{overflow:auto;min-height:0;padding:4px 6px}
.cea-hrow2{display:flex;align-items:center;gap:2px;border-radius:6px}
.cea-hrow2:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.cea-hmain{flex:1;min-width:0;display:flex;gap:8px;align-items:center;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:4px 6px;cursor:pointer}
.cea-mbadge{flex:none;font-size:9.5px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2,#2a2d33);color:var(--dsw-alias-label-secondary,#aaa)}
.cea-m-post{color:#7ee787}
.cea-m-put{color:#d2a8ff}
.cea-m-patch{color:#ffa657}
.cea-m-delete{color:#ff7b72}
.cea-hurl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-primary,#ccc);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cea-hname{flex:none;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cea-hstatus{flex:none;font-size:11px}
.cea-root{container-type:inline-size;overflow:hidden}
.cea-root>.cea-bar{display:grid;grid-template-columns:88px minmax(0,1fr) auto;gap:0;padding:12px 12px 8px;border:0}
.cea-root>.cea-bar .cea-request-method{width:88px;height:36px;border-radius:6px 0 0 6px;font-weight:700}
.cea-root>.cea-bar .cea-url{width:100%;height:36px;box-sizing:border-box;border-radius:0 6px 6px 0;border-left:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.cea-root>.cea-bar .cea-send{margin-left:8px;min-height:36px;padding:6px 16px;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#2f81f7));border-color:transparent;color:var(--dsw-alias-label-on-color,#fff);font-weight:600}
.cea-root>.cea-bar .cea-send:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#2f81f7)))}
.cea-tools{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:0 12px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.cea-tools .ce-sk-btn{border-color:transparent;padding:4px 8px;font-size:11px}
.cea-tools .ce-sk-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.cea-request-tabs{display:flex;gap:16px;padding:0 12px;overflow-x:auto;flex:none;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.cea-config-tab{display:inline-flex;align-items:center;gap:6px;flex:none;border:0;border-bottom:2px solid transparent;padding:10px 0 8px;background:transparent;color:var(--dsw-alias-label-secondary,#999);font:inherit;font-size:12px;cursor:pointer}
.cea-config-tab-on{color:var(--dsw-alias-label-primary,#ddd);border-bottom-color:var(--dsw-alias-brand-primary,#59b7ff);font-weight:600}
.cea-tab-count{font-size:10px;color:var(--dsw-alias-label-tertiary,#889)}
.cea-root button:focus-visible,.cea-root select:focus-visible,.cea-root textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:-2px}
.cea-request-panel{flex:0 0 auto;min-height:160px;max-height:55%;overflow:auto;padding:8px 4px 12px;box-sizing:border-box}
.cea-root .cea-sec{flex-wrap:wrap;padding:8px;color:var(--dsw-alias-label-secondary,#999);text-transform:none;letter-spacing:normal;font-weight:500}
.cea-settings{padding:12px 8px}
.cea-settings .cea-tmo{font-size:12px;gap:12px}
.cea-settings .cea-tmo-in{box-sizing:border-box;width:100px}
.cea-root .cea-body:not(.cea-import){min-height:180px;max-height:none;resize:vertical;border:0;margin:4px 0 0;padding:12px;background:var(--dsw-alias-bg-base,#181818)}
.cea-response{display:flex;flex-direction:column;flex:1 0 160px;min-height:160px;border-top:.5px solid var(--dsw-alias-border-l1,#333);position:relative}
.cea-response>.cea-sec{font-weight:600;flex:none}
.cea-response .cea-resp{flex:1;min-height:100px}
.cea-root .cea-status{flex-wrap:wrap;padding:4px 12px 8px}
.cea-response-wait{padding:8px 12px;color:var(--dsw-alias-brand-primary,#59b7ff);font-size:12px}
.cea-response[aria-busy="true"] .cea-resp{opacity:.5}
.cea-empty{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;min-height:110px;padding:16px;text-align:center;color:var(--dsw-alias-label-secondary,#999);font-size:12px;line-height:1.5}
.cea-empty strong{font-weight:500}
.cea-empty span{font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.cea-root .cea-hist{top:94px}
@container (max-width:380px){.cea-root>.cea-bar{grid-template-columns:76px minmax(0,1fr)}.cea-root>.cea-bar .cea-request-method{width:76px}.cea-root>.cea-bar .cea-send{grid-column:1/-1;margin:8px 0 0}.cea-tools{gap:2px}.cea-request-tabs{gap:12px}.cea-root .cea-hist{top:138px}}
.cea-hts{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#778);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-htmlprev{flex:1;min-height:0;width:100%;border:0;background:#fff}
.ctp-tools{display:flex;gap:6px;padding:4px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.ctp-acts{margin-left:0;display:inline-flex;flex:none;gap:2px;width:0;overflow:hidden;visibility:hidden;pointer-events:none}
.ce-row[data-tp] .ce-name{flex:1}
.ce-row[data-tp]>.ce-ico,.ce-row[data-tp]>.ce-tree-ico{flex:none}
.ce-row[data-tp]{column-gap:0}
.ce-row[data-tp]>.ce-name{margin-left:6px}
.ce-row:hover .ctp-acts,.ce-row:focus-within .ctp-acts{margin-left:6px}
.ce-fast-hint{position:fixed;z-index:100000;pointer-events:none;max-width:min(260px,calc(100vw - 16px));box-sizing:border-box;padding:5px 8px;border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:5px;background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-primary,#ddd);font-family:system-ui,sans-serif;font-size:12px;font-weight:400;line-height:1.4;white-space:normal;overflow-wrap:anywhere;box-shadow:0 3px 10px rgba(0,0,0,.14)}
.ce-row:hover .ctp-acts,.ce-row:focus-within .ctp-acts,.ctp-acts:has(.cet-act-danger){width:auto;overflow:visible;visibility:visible;pointer-events:auto}
.ctp-acts .cet-act{opacity:1}
.ctp-inputrow{cursor:default}
.ctp-inputrow:hover{background:transparent}
.ctp-inputrow .ce-input{flex:1;min-width:0}
/* v1.5 visual system: calm surfaces, one interaction accent, readable density. */
.ce-root{
	--ce-surface-0:var(--dsw-alias-bg-base,#111315);
	--ce-surface-1:var(--dsw-alias-bg-layer-1,#181b1f);
	--ce-surface-2:var(--dsw-alias-bg-layer-2,#20242a);
	--ce-line:color-mix(in srgb,var(--dsw-alias-border-l1,#39414a) 72%,transparent);
	--ce-line-strong:var(--dsw-alias-border-l2,#515b66);
	--ce-fg:var(--dsw-alias-label-primary,#edf2f7);
	--ce-fg-2:var(--dsw-alias-label-secondary,#aab5c1);
	--ce-fg-3:var(--dsw-alias-label-tertiary,#7d8996);
	--ce-accent:var(--dsw-alias-brand-primary,#79b8ff);
	--ce-accent-soft:color-mix(in srgb,var(--ce-accent) 14%,transparent);
	--ce-radius:8px;
	background:var(--ce-surface-0);color:var(--ce-fg);font-size:13px;letter-spacing:.005em
}
.ce-root *{box-sizing:border-box}
.ce-root button,.ce-root input,.ce-root select,.ce-root textarea{font-family:inherit}
.ce-root button{transition:background-color .12s ease,color .12s ease,border-color .12s ease,opacity .12s ease}
.ce-root button:focus-visible,.ce-root input:focus-visible,.ce-root select:focus-visible,.ce-root textarea:focus-visible{outline:2px solid var(--ce-accent);outline-offset:1px}
.ce-toolbar{min-height:42px;padding:7px 10px;background:var(--ce-surface-1);border-bottom:1px solid var(--ce-line);gap:7px}
.ce-seg{background:var(--ce-surface-0);border:1px solid var(--ce-line);border-radius:var(--ce-radius);padding:2px}
.ce-seg-btn{border-radius:6px;padding:5px 10px;color:var(--ce-fg-3)}
.ce-seg-on{background:var(--ce-accent-soft);color:var(--ce-fg);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ce-accent) 28%,transparent)}
.ce-tool{border-radius:6px;color:var(--ce-fg-2)}
.ce-tool:hover{background:var(--ce-accent-soft);color:var(--ce-fg)}
.ce-branch{background:var(--ce-surface-2);border:1px solid var(--ce-line);color:var(--ce-fg-2);padding:5px 8px}
.ce-rail-wrap{background:var(--ce-surface-0);border-right:1px solid var(--ce-line)}
.ce-rail-search{background:var(--ce-surface-1);border-color:var(--ce-line-strong);color:var(--ce-fg-2)}
.ce-rail-search:hover{background:var(--ce-accent-soft);border-color:color-mix(in srgb,var(--ce-accent) 45%,transparent)}
.ce-row{min-height:28px;border-radius:6px;padding:5px 9px;color:var(--ce-fg-2)}
.ce-row:hover{background:var(--ce-surface-2);color:var(--ce-fg)}
.ce-active{background:var(--ce-accent-soft);color:var(--ce-fg);box-shadow:inset 2px 0 0 var(--ce-accent)}
.ce-note{color:var(--ce-fg-3);padding:6px 12px;line-height:1.5}
.ce-section{padding:14px 12px 7px;color:var(--ce-fg-2);font-size:11px;letter-spacing:.06em;border-top:1px solid var(--ce-line)}
.ce-editor{background:var(--ce-surface-0)}
.ce-tabs{background:var(--ce-surface-0);border-bottom:1px solid var(--ce-line);padding:5px 8px 0}
.ce-tab{border-radius:7px 7px 0 0;padding:6px 8px;color:var(--ce-fg-3)}
.ce-tab-active{background:var(--ce-surface-1);border-color:var(--ce-line);color:var(--ce-fg);box-shadow:0 -1px 0 var(--ce-accent)}
.ce-head{min-height:36px;padding:7px 10px;background:var(--ce-surface-1);border-bottom:1px solid var(--ce-line)}
.ce-head-path{color:var(--ce-fg);font-weight:600}
.ce-chip{background:var(--ce-surface-2);border:1px solid var(--ce-line);color:var(--ce-fg-2);padding:2px 7px}
.ce-code-wrap,.ce-code,.ce-gutter{background:var(--ce-surface-0)}
.ce-gutter{border-right:1px solid var(--ce-line)}
.ce-line{font-size:13px;line-height:${ROW}px}
.ce-empty{color:var(--ce-fg-3);background:radial-gradient(circle at 50% 42%,var(--ce-accent-soft),transparent 34%);line-height:1.6}
.ce-commitbox{background:var(--ce-surface-1);border-bottom:1px solid var(--ce-line);padding:10px 12px 12px}
.ce-commitbox-msg,.ce-input{background:var(--ce-surface-0);border:1px solid var(--ce-line-strong);color:var(--ce-fg);border-radius:7px}
.ce-commitbox-msg::placeholder,.ce-input::placeholder{color:var(--ce-fg-3)}
.ce-commitbox-msg:focus,.ce-input:focus{border-color:var(--ce-accent);box-shadow:0 0 0 3px var(--ce-accent-soft)}
.ce-commitbox-btn,.ce-sk-primary{background:var(--dsw-alias-button-primary-fill,var(--ce-accent));border:0;color:var(--dsw-alias-label-on-color,#fff);border-radius:7px;min-height:30px}
.ce-commitbox-btn:hover,.ce-sk-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--ce-accent))}
.ce-changes-search{background:var(--ce-surface-1);border-bottom:1px solid var(--ce-line);padding:8px 12px}
.ce-change-group{border-top:1px solid var(--ce-line);padding-bottom:8px}
.ce-peek,.ce-overlay,.cea-hist,.cet-context{background:var(--ce-surface-1);border:1px solid var(--ce-line-strong);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.42)}
.ce-peek-head,.ce-overlay-head{background:var(--ce-surface-2);border-bottom:1px solid var(--ce-line);padding:9px 12px}
.ce-peek-file{background:var(--ce-surface-2);border-color:var(--ce-line);padding:7px 12px}
.ce-peek-row-sel{background:var(--ce-accent-soft)}
.cea-root>.cea-bar{background:var(--ce-surface-1);border-bottom:1px solid var(--ce-line);padding:10px 12px}
.cea-root>.cea-bar .cea-request-method,.cea-root>.cea-bar .cea-url{height:38px;background:var(--ce-surface-0);border-color:var(--ce-line-strong)}
.cea-tools,.cea-request-tabs{background:var(--ce-surface-1);border-color:var(--ce-line)}
.cea-config-tab{color:var(--ce-fg-3);padding:11px 2px 9px}
.cea-config-tab-on{color:var(--ce-fg);border-bottom-color:var(--ce-accent)}
.cea-request-panel{background:var(--ce-surface-0)}
.cea-response{background:var(--ce-surface-0);border-top:1px solid var(--ce-line)}
.cea-resp{background:var(--ce-surface-1);border-color:var(--ce-line);border-radius:7px;margin:0 10px 10px}
.ce-sk-root{background:var(--ce-surface-0)}
.ce-sk-top,.ce-sk-detail-tools,.ce-sk-searchbar,.ce-sk-create{background:var(--ce-surface-1);border-color:var(--ce-line)}
.ce-sk-row-on{background:var(--ce-accent-soft);box-shadow:inset 2px 0 var(--ce-accent)}
.ce-sk-detail-title{letter-spacing:-.01em}
.ce-sk-source,.ce-sk-ta{background:var(--ce-surface-0);color:var(--ce-fg)}
.cel-root{background:var(--ce-surface-1);border:1px solid var(--ce-line);border-radius:10px;padding:8px}
.cel-section{color:var(--ce-fg-3);padding:12px 8px 6px;font-size:11px;letter-spacing:.06em}
.cel-row{border-radius:8px;padding:8px;color:var(--ce-fg-2)}
.cel-row:hover{background:var(--ce-accent-soft);color:var(--ce-fg)}
`;
