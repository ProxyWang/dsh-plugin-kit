import { ROW } from "../constants.js";

/* Code reading and editing surfaces: virtual-scrolled source, unified and
 * side-by-side diffs, in-file search, workspace search results, blame and the
 * problems list. The row height comes from ROW so the virtual windows and the
 * painted rows cannot disagree. */

export const EDITOR_CSS = `
/* ---------- source view ---------- */
.ce-code-wrap{flex:1;min-height:0;display:flex;overflow:hidden;position:relative;background:var(--ce-bg)}
.ce-gutter{flex:none;width:50px;overflow:hidden;position:relative;background:var(--ce-bg);border-right:1px solid var(--ce-line)}
.ce-gutter-inner{position:absolute;top:0;left:0;right:0}
.ce-gline{position:absolute;right:9px;height:${ROW}px;line-height:${ROW}px;text-align:right;font-family:var(--ce-mono);font-size:11.5px;color:var(--ce-fg-3);font-variant-numeric:tabular-nums}
.ce-gline-active{color:var(--ce-fg)}
.ce-code{flex:1;min-width:0;overflow:auto;position:relative;background:var(--ce-bg)}
.ce-code-inner{position:relative;min-width:max-content}
.ce-line{position:absolute;left:0;min-width:max-content;height:${ROW}px;line-height:${ROW}px;white-space:pre;font-family:var(--ce-mono);font-size:13px;padding-right:24px;color:var(--ce-fg)}
.ce-flash{background:var(--ce-accent-soft);animation:ce-fade 1.4s ease-out}
@keyframes ce-fade{from{background:color-mix(in srgb,var(--ce-accent) 24%,transparent)}to{background:transparent}}
.ce-kw{color:var(--ce-kw,var(--ce-accent))}
.ce-type{color:var(--ce-type,var(--ce-ok))}
.ce-str{color:var(--ce-str,var(--ce-warn))}
.ce-prop{color:var(--ce-prop,var(--ce-fg))}
.ce-num{color:var(--ce-num,color-mix(in srgb,var(--ce-warn) 70%,var(--ce-bad)))}
.ce-com{color:var(--ce-com,var(--ce-fg-3));font-style:italic}
.ce-jump{cursor:pointer;text-decoration:underline dotted transparent;text-underline-offset:3px}
.ce-jump:hover{text-decoration-color:var(--ce-fg-3)}
.ce-line-changed{background:var(--ce-ok-soft);box-shadow:inset 2px 0 0 var(--ce-ok)}
.ce-gline-changed{color:var(--ce-ok);font-weight:700;background:var(--ce-ok-soft)}
.ce-gline-find{color:var(--ce-warn)}
.ce-gline-find-cur{background:var(--ce-warn-soft);color:var(--ce-fg);font-weight:700}
.ce-mark-cur{background:color-mix(in srgb,var(--ce-warn) 42%,transparent);border-radius:2px;box-shadow:none;color:var(--ce-fg)}
.ce-dnav{outline:1.5px solid var(--ce-accent);outline-offset:-1.5px}
.ce-chip-mark{color:var(--ce-ok);cursor:pointer}

/* ---------- diffs ---------- */
.ce-dline{display:flex;min-width:max-content;height:${ROW}px;line-height:${ROW}px;font-family:var(--ce-mono);font-size:13px;white-space:pre;padding-right:24px;color:var(--ce-fg)}
.ce-dline-add{background:color-mix(in srgb,var(--ce-ok) 11%,transparent);box-shadow:inset 2px 0 0 color-mix(in srgb,var(--ce-ok) 55%,transparent)}
.ce-dline-del{background:color-mix(in srgb,var(--ce-bad) 11%,transparent);box-shadow:inset 2px 0 0 color-mix(in srgb,var(--ce-bad) 55%,transparent)}
.ce-dline-hunk{color:var(--ce-accent);background:var(--ce-fill);font-size:12px}
.ce-dline-meta{color:var(--ce-fg-3);font-style:italic}
.ce-dline-click{cursor:pointer}
.ce-dline-click:hover{box-shadow:inset 0 0 0 1px var(--ce-line-strong)}
.ce-dnum{width:44px;flex:none;text-align:right;padding-right:9px;color:var(--ce-fg-3);user-select:none;font-variant-numeric:tabular-nums}
.ce-dtext{min-width:0}
.ce-sbsrow{display:grid;grid-template-columns:40px minmax(0,1fr) 40px minmax(0,1fr)}
.ce-sbsrow-full{display:flex;align-items:center}
.ce-sbsrow-full .ce-sbscell{flex:1;min-width:0}
.ce-hunk-revert{margin-left:auto;flex:none;opacity:.55}
.ce-dline:hover .ce-hunk-revert,.ce-sbsrow-full:hover .ce-hunk-revert{opacity:1}
.ce-hunk-confirm{margin-left:auto;display:flex;gap:2px;align-items:center;flex:none}
.ce-hunk-revert-on{color:var(--ce-bad);font-weight:700}
.ce-sbsnum{font-family:var(--ce-mono);font-size:11px;line-height:19px;color:var(--ce-fg-3);text-align:right;padding:1px 6px 1px 0;user-select:none;background:var(--ce-fill);overflow:hidden;font-variant-numeric:tabular-nums}
.ce-sbscell{font-family:var(--ce-mono);font-size:12px;line-height:19px;white-space:pre-wrap;overflow-wrap:break-word;padding:1px 10px 1px 5px;min-width:0}
.ce-sbs-del{background:color-mix(in srgb,var(--ce-bad) 10%,transparent)}
.ce-sbs-add{background:color-mix(in srgb,var(--ce-ok) 10%,transparent)}
.ce-sbs-empty{background:color-mix(in srgb,var(--ce-fg) 3%,transparent)}
.ce-wd{border-radius:2px}
.ce-wd-del{background:color-mix(in srgb,var(--ce-bad) 38%,transparent)}
.ce-wd-add{background:color-mix(in srgb,var(--ce-ok) 38%,transparent)}
.ce-wd-zero{display:inline-block;width:0;overflow:hidden;vertical-align:baseline}
.ce-wd-zero.ce-wd-add{border-left:2px solid var(--ce-ok)}
.ce-wd-zero.ce-wd-del{border-left:2px solid var(--ce-bad)}
.ce-delbar{position:absolute;left:0;right:0;width:100%;height:${ROW}px;display:flex;align-items:center;gap:6px;padding:0 10px;border:0;text-align:left;cursor:pointer;background:color-mix(in srgb,var(--ce-bad) 14%,transparent);color:var(--ce-bad);font-family:var(--ce-mono);font-size:11px}
.ce-delbar:hover{background:color-mix(in srgb,var(--ce-bad) 24%,transparent)}
.ce-delbar-flow{position:static;width:auto;height:${ROW}px;margin-left:52px;border-radius:4px}

/* ---------- blame and the change rail ---------- */
.ce-blame{flex:none;width:150px;overflow:hidden;position:relative;background:var(--ce-s1);border-right:1px solid var(--ce-line)}
.ce-bline{position:absolute;left:0;right:0;height:${ROW}px;line-height:${ROW}px;border:0;background:transparent;text-align:left;font:inherit;font-family:var(--ce-mono);font-size:10.5px;color:var(--ce-fg-3);padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.ce-bline:hover{color:var(--ce-fg);background:var(--ce-fill)}
.ce-bline-uncommitted{color:var(--ce-warn)}
.ce-changerail{flex:none;width:12px;position:relative;border-left:1px solid var(--ce-line);background:transparent}
.ce-changeblob{position:absolute;left:2px;right:2px;min-height:4px;border:0;padding:0;border-radius:2px;cursor:pointer;opacity:.85}
.ce-changeblob:hover{opacity:1}
.ce-changeblob-mod{background:var(--ce-ok)}
.ce-changeblob-del{background:var(--ce-bad)}

/* ---------- in-file edit surface ---------- */
.ce-edit-wrap{flex:1;min-height:0;display:flex;position:relative;overflow:hidden;background:var(--ce-bg)}
.ce-edit-ta{flex:1;min-height:0;resize:none;border:0;outline:none;background:var(--ce-bg);color:var(--ce-fg);font-family:var(--ce-mono);font-size:13px;line-height:${ROW}px;padding:8px 10px;white-space:pre;overflow:auto;tab-size:4;caret-color:var(--ce-accent)}
.ce-edit-gutter{flex:none;width:48px;overflow:hidden;background:var(--ce-bg);border-right:1px solid var(--ce-line);position:relative}
.ce-edit-gutter .ce-gutter-row{position:absolute;left:0;right:0;height:${ROW}px;line-height:${ROW}px;text-align:right;padding-right:9px;font-family:var(--ce-mono);font-size:11.5px;color:var(--ce-fg-3);user-select:none;font-variant-numeric:tabular-nums}

/* ---------- in-file / workspace search ---------- */
.ce-search{position:absolute;inset:0;z-index:7;background:var(--ce-bg);display:flex;flex-direction:column;padding:12px;gap:8px}
.ce-search-scope{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:3px 8px;flex:none;padding-bottom:8px;border-bottom:1px solid var(--ce-line)}
.ce-search-scope strong{font-size:13px;font-weight:600;color:var(--ce-fg)}
.ce-search-scope>span{grid-row:2;font-size:11px;color:var(--ce-fg-3);overflow-wrap:anywhere}
.ce-search-scope>.ce-tool{grid-column:2;grid-row:1/3}
.ce-search-box{display:flex;gap:6px;align-items:center;flex:none}
.ce-search-include{flex:none;font-size:12px}
.ce-search-directory{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:11px;color:var(--ce-fg-2);flex:none}
.ce-search-directory .ce-input{flex:1 1 160px;font-size:12px;min-width:0}
.ce-search-meta{font-size:11px;color:var(--ce-fg-3);flex:none;min-height:14px;font-variant-numeric:tabular-nums}
.ce-search-results{flex:1;min-height:0;overflow:auto;border:1px solid var(--ce-line);border-radius:var(--ce-radius);background:var(--ce-bg)}
.ce-srow{display:flex;align-items:stretch;width:100%}
.ce-sgroup-row{display:flex;align-items:center;gap:2px;width:100%;position:sticky;top:0;z-index:1;background:var(--ce-s1);border-bottom:1px solid var(--ce-line)}
.ce-sgroup{display:flex;gap:6px;align-items:center;flex:1;min-width:0;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:6px 4px 6px 8px;cursor:pointer}
.ce-sgroup:hover .ce-sgroup-path{color:var(--ce-fg)}
.ce-sgroup-rep{flex:none;margin-right:6px;color:var(--ce-fg-3)}
.ce-sgroup-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;color:var(--ce-fg-2);font-family:var(--ce-mono)}
.ce-sgroup-count{flex:none;font-size:10px;color:var(--ce-fg-3);background:var(--ce-fill);border-radius:999px;padding:1px 7px;line-height:14px;font-variant-numeric:tabular-nums}
.ce-shl{color:var(--ce-fg);background:color-mix(in srgb,var(--ce-warn) 30%,transparent);border-radius:2px;font-weight:600}
.ce-sctx-toggle{flex:none;border:0;background:transparent;color:var(--ce-fg-3);cursor:pointer;padding:6px 2px 6px 7px;font:inherit;font-size:10px;line-height:1}
.ce-sctx-toggle:hover{color:var(--ce-fg)}
.ce-sresult{display:flex;gap:10px;align-items:baseline;flex:1;min-width:0;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px 4px 6px;cursor:pointer;white-space:nowrap}
.ce-sresult:hover{background:var(--ce-fill)}
.ce-sctx{border-left:1px solid var(--ce-line);margin:0 6px 4px 15px;background:var(--ce-s1);border-radius:0 6px 6px 0;overflow:hidden}
.ce-sctx-line{display:flex;gap:8px;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:1px 8px;cursor:pointer;white-space:nowrap}
.ce-sctx-line:hover{background:var(--ce-fill)}
.ce-sctx-no{flex:none;min-width:30px;text-align:right;font-family:var(--ce-mono);font-size:10px;color:var(--ce-fg-3);font-variant-numeric:tabular-nums}
.ce-sctx-text{font-family:var(--ce-mono);font-size:11px;color:var(--ce-fg-2);overflow:hidden;text-overflow:ellipsis}
.ce-sctx-hit{background:var(--ce-accent-soft)}
.ce-sctx-hit .ce-sctx-text{color:var(--ce-fg)}
.ce-sctx-note{padding:3px 10px 5px 24px;font-size:11px;color:var(--ce-fg-3)}
.ce-sloc{font-family:var(--ce-mono);font-size:11px;color:var(--ce-accent);flex:none;font-variant-numeric:tabular-nums}
.ce-stext{font-family:var(--ce-mono);font-size:12px;color:var(--ce-fg-2);overflow:hidden;text-overflow:ellipsis}
.ce-repo{width:calc(100% - 16px);margin:6px 8px 2px;height:26px;font-size:11.5px;padding:0 8px;flex:none;align-self:flex-start}

/* ---------- problems ---------- */
.ce-problems{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--ce-bg);border-top:1px solid var(--ce-line)}
.ce-problem-sev{flex:none;width:16px;text-align:center;font-weight:700;color:var(--ce-fg-3)}
.ce-problem-err{color:var(--ce-bad)}
.ce-problem-warn{color:var(--ce-warn)}
.ce-problem-filter{font-family:var(--ce-mono);font-size:10.5px}
.ce-problem-off{opacity:.45;text-decoration:line-through}
.ce-problems .ce-row{font-family:var(--ce-mono);font-size:11.5px;min-height:26px}
.ce-problems .ce-row .ce-name{flex:0 1 auto}
.ce-problems .ce-note{flex:none}

.ce-id{color:var(--ce-fg)}
`;