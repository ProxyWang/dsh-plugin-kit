/* Branch-conversation dialog: overlay + card, painted with the kit tokens.
 *
 * The overlay carries `ce-root` so the token block applies even though the
 * dialog is appended to `document.body` instead of a sidebar slot.
 */

export const WORKTREE_CSS = `
/* ---------- branch conversation dialog ---------- */
.ce-wt-overlay{
	position:fixed;inset:0;z-index:2147483000;
	display:flex;align-items:center;justify-content:center;
	background:rgba(0,0,0,.42);
	-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);
	animation:ce-wt-fade var(--ce-dur) var(--ce-ease);
}
@keyframes ce-wt-fade{from{opacity:0}to{opacity:1}}
.ce-wt-card{
	width:min(460px,calc(100vw - 48px));
	background:var(--ce-s1);color:var(--ce-fg);
	border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius-lg);
	box-shadow:var(--ce-shadow-2);overflow:hidden;
	font-size:13px;line-height:1.45;
	animation:ce-wt-rise var(--ce-dur) var(--ce-ease);
}
@keyframes ce-wt-rise{from{transform:translateY(6px);opacity:.6}to{transform:none;opacity:1}}
.ce-wt-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 4px}
.ce-wt-title{font-weight:600;font-size:14px}
.ce-wt-close{appearance:none;border:0;background:transparent;color:var(--ce-fg-3);font-size:18px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:var(--ce-radius-sm)}
.ce-wt-close:hover{background:var(--ce-hover);color:var(--ce-fg)}
.ce-wt-body{padding:8px 16px 4px;display:flex;flex-direction:column;gap:12px}
.ce-wt-modes{display:flex;gap:6px;background:var(--ce-fill);padding:3px;border-radius:var(--ce-radius)}
.ce-wt-mode{flex:1;appearance:none;border:0;background:transparent;color:var(--ce-fg-2);font:inherit;padding:6px 8px;border-radius:var(--ce-radius-sm);cursor:pointer}
.ce-wt-mode.is-active{background:var(--ce-accent);color:var(--ce-on-accent);font-weight:600;box-shadow:none}
.ce-wt-mode.is-active:hover{background:var(--ce-accent);filter:brightness(1.04)}
.ce-wt-field{display:flex;flex-direction:column;gap:5px}
.ce-wt-field[hidden]{display:none}
.ce-wt-field-head[hidden]{display:none}
.ce-wt-label{color:var(--ce-fg-2);font-size:12px}
.ce-wt-input,.ce-wt-select{
	appearance:none;width:100%;box-sizing:border-box;
	background:var(--ce-bg);color:var(--ce-fg);
	border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius-sm);
	font:inherit;padding:7px 9px;outline:none;
}
.ce-wt-input:focus,.ce-wt-select:focus{border-color:var(--ce-accent-line);box-shadow:0 0 0 3px var(--ce-accent-softer)}
.ce-wt-input::placeholder{color:var(--ce-fg-3)}
.ce-wt-picker{display:flex;flex-direction:column;gap:6px}
.ce-wt-list{
	max-height:196px;overflow:auto;overscroll-behavior:contain;
	border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius-sm);
	background:var(--ce-bg);padding:4px;
}
.ce-wt-option{
	display:flex;align-items:baseline;gap:10px;min-width:0;
	padding:6px 8px;border-radius:var(--ce-radius-sm);cursor:pointer;color:var(--ce-fg-2);
	font-family:var(--ce-mono);font-size:12.5px;white-space:nowrap;overflow:hidden;
}
.ce-wt-option-name{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ce-wt-option-note{flex:0 1 auto;min-width:0;margin-left:auto;overflow:hidden;text-overflow:ellipsis;color:var(--ce-fg-3);font-family:inherit;font-size:11.5px}
.ce-wt-option.is-active{background:var(--ce-accent-soft);color:var(--ce-fg);box-shadow:inset 2px 0 var(--ce-accent)}
.ce-wt-option.is-occupied{cursor:default;color:var(--ce-fg-3);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--ce-fg-3) 55%,transparent)}
.ce-wt-option.is-occupied{flex-wrap:wrap;row-gap:2px}
/* Occupied rows carry a note and an action; give the branch its own line so the
 * name is never squeezed to zero and the button cannot be clipped by the path. */
.ce-wt-option.is-occupied .ce-wt-option-name{flex:1 1 100%}
.ce-wt-option.is-occupied .ce-wt-option-note{flex:1 1 auto;margin-left:0;text-decoration:none}
.ce-wt-option.is-occupied .ce-wt-option-open{margin-left:auto}
.ce-wt-option-open{flex:none;appearance:none;border:1px solid var(--ce-line-strong);border-radius:999px;background:var(--ce-s2);color:var(--ce-fg-2);font:inherit;font-family:inherit;font-size:11px;line-height:16px;padding:1px 8px;cursor:pointer;text-decoration:none}
.ce-wt-option-open:hover{background:var(--ce-hover);color:var(--ce-fg)}
.ce-wt-empty{padding:10px 8px;color:var(--ce-fg-3);font-size:12px}
.ce-wt-check[hidden]{display:none}
.ce-wt-check{display:flex;align-items:center;gap:8px;color:var(--ce-fg-2);font-size:12px;cursor:pointer}
.ce-wt-check input{accent-color:var(--ce-accent)}
.ce-wt-wt-list{display:flex;flex-direction:column;gap:6px;max-height:280px;overflow:auto;overscroll-behavior:contain}
.ce-wt-wt-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--ce-line);border-radius:var(--ce-radius-sm);background:var(--ce-bg)}
.ce-wt-wt-text{flex:1;min-width:0}
.ce-wt-wt-branch{display:flex;align-items:center;gap:6px;font-family:var(--ce-mono);font-size:12.5px;color:var(--ce-fg);min-width:0}
.ce-wt-wt-path{color:var(--ce-fg-3);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ce-wt-badge{flex:none;font-family:inherit;font-size:10.5px;color:var(--ce-fg-2);border:1px solid var(--ce-line-strong);border-radius:999px;padding:0 6px;line-height:16px}
.ce-wt-danger{color:var(--ce-bad);border-color:color-mix(in srgb,var(--ce-bad) 42%,transparent)}
.ce-wt-danger:hover{background:var(--ce-bad-soft)}
.ce-wt-btn[disabled].ce-wt-danger{color:var(--ce-fg-3);border-color:var(--ce-line)}
.ce-wt-field-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ce-wt-link{appearance:none;border:0;background:transparent;color:var(--ce-accent);font:inherit;font-size:12px;cursor:pointer;padding:0 2px;border-radius:var(--ce-radius-sm)}
.ce-wt-link:hover{text-decoration:underline}
.ce-wt-link[disabled]{color:var(--ce-fg-3);cursor:default;text-decoration:none}
.ce-wt-sub{color:var(--ce-fg-3);font-size:12px;font-family:var(--ce-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ce-wt-more{padding:6px 8px;color:var(--ce-fg-3);font-size:11.5px}
.ce-wt-note{color:var(--ce-warn);font-size:12px}
.ce-wt-note[hidden]{display:none}
.ce-wt-hint{color:var(--ce-fg-3);font-size:12px}
.ce-wt-error{color:var(--ce-bad);font-size:12px;white-space:pre-wrap}
.ce-wt-error[hidden]{display:none}
.ce-wt-status{color:var(--ce-fg-2);font-size:12px;padding:0 16px}
.ce-wt-status[hidden]{display:none}
.ce-wt-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px 16px}
.ce-wt-btn{appearance:none;border:1px solid var(--ce-line-strong);background:var(--ce-s2);color:var(--ce-fg);font:inherit;padding:6px 14px;border-radius:var(--ce-radius-sm);cursor:pointer}
.ce-wt-btn:hover{background:var(--ce-hover)}
.ce-wt-btn[disabled]{opacity:.55;cursor:default}
.ce-wt-primary{border-color:transparent;background:var(--ce-accent);color:var(--ce-on-accent)}
.ce-wt-primary:hover{filter:brightness(1.06);background:var(--ce-accent)}
`;
