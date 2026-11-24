/* Embedded browser chrome and the built-in terminal's painted overlays. */

export const CHROME_CSS = `
/* ============================ browser ============================ */
.ceb-root{container-type:inline-size;overflow:hidden;display:flex;flex-direction:column;height:100%;background:var(--ce-bg)}
.ceb-strip{display:flex;align-items:center;gap:2px;flex:none;height:40px;padding:6px 8px;background:var(--ce-bg);border-bottom:1px solid var(--ce-line);overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.ceb-strip::-webkit-scrollbar{display:none}
.ceb-sub{display:flex;align-items:center;flex:none;max-width:180px;min-width:56px;height:28px;border:0;border-radius:7px;background:transparent;color:var(--ce-fg-3)}
.ceb-sub:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.ceb-sub-active,.ceb-sub-active:hover{background:var(--ce-fill-strong);color:var(--ce-fg);border:0}
.ceb-sub-open{flex:1;min-width:0;height:100%;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;text-align:left;padding:0 2px 0 10px;cursor:pointer}
.ceb-sub-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ceb-sub-close{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin:0 4px 0 2px;border:0;border-radius:4px;background:transparent;color:inherit;cursor:pointer;opacity:0;transition:opacity var(--ce-dur) var(--ce-ease)}
.ceb-sub:hover .ceb-sub-close,.ceb-sub-active .ceb-sub-close{opacity:.7}
.ceb-sub-close:hover{background:var(--ce-fill-strong);color:var(--ce-fg);opacity:1}
.ceb-sub-close svg{width:11px;height:11px;display:block}
.ceb-strip-add{flex:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;margin-left:2px;border:0;border-radius:6px;background:transparent;color:var(--ce-fg-3);cursor:pointer}
.ceb-strip-add:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ceb-strip-add svg{width:14px;height:14px;display:block}
.ceb-strip-note{flex:none;font-size:11px;color:var(--ce-fg-3);padding:0 6px}
.ceb-page{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0}

/* address bar */
.ceb-toolbar{display:flex;align-items:center;gap:10px;flex:none;padding:8px 10px;background:var(--ce-bg);min-width:0;border-bottom:1px solid var(--ce-line)}
.ceb-nav-group,.ceb-action-group{display:flex;align-items:center;gap:1px;flex:none}
.ceb-toolbar .ceb-tool{flex:none;width:28px;height:30px;border-radius:6px;color:var(--ce-fg-3)}
.ceb-toolbar .ceb-tool:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ceb-toolbar .ceb-tool svg{width:15px;height:15px;display:block}
.ceb-toolbar .ceb-tool:disabled{opacity:.4;cursor:default;background:transparent}
.ceb-toolbar .ceb-tool[aria-pressed=true]{background:var(--ce-accent-soft);color:var(--ce-accent)}
.ceb-address-shell{display:flex;align-items:center;gap:4px;flex:1;min-width:80px;height:34px;padding:0 4px 0 10px;border:1px solid var(--ce-line);border-radius:9px;background:var(--ce-fill);transition:border-color var(--ce-dur) var(--ce-ease),background-color var(--ce-dur) var(--ce-ease)}
.ceb-address-shell:hover{border-color:var(--ce-line)}
.ceb-address-shell:focus-within{border-color:var(--ce-accent);background:var(--ce-bg);box-shadow:0 0 0 3px var(--ce-accent-softer)}
.ceb-address-icon{display:inline-flex;flex:none;color:var(--ce-fg-3)}
.ceb-root .ceb-address{flex:1;min-width:0;width:100%;height:30px;padding:0 5px;border:0;border-radius:0;background:transparent;color:var(--ce-fg);font-family:inherit;font-size:12px;box-shadow:none;outline:none}
.ceb-root .ceb-address:focus-visible{outline:none;box-shadow:none}
.ceb-go{display:inline-flex;align-items:center;justify-content:center;flex:none;width:26px;height:26px;padding:0;border:0;border-radius:6px;background:var(--ce-accent-soft);color:var(--ce-accent);cursor:pointer}
.ceb-go:hover{background:color-mix(in srgb,var(--ce-accent) 18%,transparent)}
.ceb-go:disabled{opacity:.3;cursor:default}
.ceb-toolbar .ceb-star{width:26px;height:26px}
.ceb-toolbar .ceb-star-saved{color:var(--ce-warn)}
.ceb-progress{position:relative;height:2px;flex:none;overflow:hidden;background:transparent}
.ceb-progress>span{display:none}
.ceb-progress-active>span{display:block;position:absolute;inset:0 auto 0 0;width:35%;background:var(--ce-accent);animation:ceb-loading 1.3s ease-in-out infinite}
@keyframes ceb-loading{from{transform:translateX(-100%)}to{transform:translateX(390%)}}

/* bookmarks */
.ceb-bookmarks-bar{display:flex;align-items:center;gap:2px;overflow:auto;flex:none;padding:4px 8px;border-bottom:1px solid var(--ce-line)}
.ceb-bookmarks-bar button{flex:none;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 8px;border:0;border-radius:5px;background:transparent;color:var(--ce-fg-3);font:inherit;font-size:11px;cursor:pointer}
.ceb-bookmarks-bar button:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ceb-content{position:relative;flex:1;min-height:0;min-width:0;overflow:hidden}
.ceb-viewport{position:absolute;inset:0;display:flex;min-height:0;min-width:0}
.ceb-guest{flex:1;display:flex;width:100%;height:100%;border:0;background:var(--ce-bg)}

/* task panels: bookmarks, start page, settings, capabilities */
.ceb-panel{position:absolute;inset:0;background:var(--ce-bg);padding:24px clamp(16px,4%,40px);z-index:1;overflow:auto}
.ceb-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px}
.ceb-panel-head h2,.ceb-start h2{margin:0;font-size:17px;line-height:1.35;font-weight:600;letter-spacing:-.015em;color:var(--ce-fg)}
.ceb-panel-caption{margin:5px 0 0;font-size:12px;line-height:1.65;color:var(--ce-fg-3)}
.ceb-start-icon{display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:var(--ce-fill);border:0;color:var(--ce-fg-2);margin-bottom:6px}
.ceb-list-tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.ceb-list-tools>.ce-input{flex:1 1 180px;font-size:12px}
.ceb-list-tools label,.ceb-checkbox{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ce-fg-2)}
.ceb-bookmark-row{display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid var(--ce-line);min-width:0}
.ceb-bookmark-row:last-child{border-bottom:0}
.ceb-bookmark-open{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px;border:0;background:transparent;text-align:left;color:var(--ce-fg);font:inherit;cursor:pointer}
.ceb-bookmark-open strong{font-size:12.5px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ceb-bookmark-open span{font-size:11px;color:var(--ce-fg-3);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ceb-bookmark-open .ceb-bookmark-title{display:flex;align-items:center;gap:8px;max-width:100%;color:var(--ce-fg)}
.ceb-bookmark-open .ceb-bookmark-glyph{display:inline-flex;flex:none;color:var(--ce-accent)}
.ceb-bookmark-open small{font-size:11px;color:var(--ce-fg-3)}
.ceb-bookmark-open:hover strong{color:var(--ce-accent)}
.ceb-confirm{display:inline-flex;align-items:center;gap:4px;flex:none}
.ceb-empty{padding:32px 12px;color:var(--ce-fg-3);font-size:12.5px;line-height:1.7}
.ceb-feedback:not([hidden]){padding:8px 12px;font-size:11.5px;line-height:1.5;background:var(--ce-fill);color:var(--ce-fg-2);overflow-wrap:anywhere;flex:none;border-radius:6px;margin:8px 10px 0}
.ceb-loading{font-size:11px;color:var(--ce-fg-3);padding:3px 10px;flex:none}
.ceb-setting-hint,.ceb-capabilities p{font-size:12px;line-height:1.7;color:var(--ce-fg-3)}
.ceb-settings-form{padding:16px 0;border-block:1px solid var(--ce-line);display:flex;flex-direction:column;align-items:flex-start;gap:14px;margin:16px 0;max-width:620px}
.ceb-settings-form>label:not(.ceb-checkbox){display:flex;flex-direction:column;align-self:stretch;gap:6px;font-size:12px;color:var(--ce-fg-2)}
.ceb-settings-form .ce-input{flex:none}
.ceb-capabilities{border-top:1px solid var(--ce-line);margin-top:22px;padding-top:12px;max-width:76ch}
.ceb-capabilities h3{font-size:12.5px;margin:12px 0 6px;color:var(--ce-fg)}
.ceb-bookmark-editor{max-height:calc(100% - 58px);overflow:auto;position:absolute;z-index:8;top:48px;right:10px;width:min(400px,calc(100% - 20px));display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius-lg);background:var(--ce-s1);box-shadow:var(--ce-shadow-2)}
.ceb-bookmark-editor header,.ceb-bookmark-editor footer{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px}
.ceb-bookmark-editor footer{justify-content:flex-end}
.ceb-bookmark-editor>label:not(.ceb-checkbox){display:flex;flex-direction:column;gap:5px;font-size:11.5px;color:var(--ce-fg-3)}
.ceb-bookmark-editor .ce-input{flex:none;font-size:12px}
.ceb-start{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;background:var(--ce-bg);color:var(--ce-fg-2);overflow:auto}
.ceb-start p{margin:0;font-size:12px;line-height:1.7;overflow-wrap:anywhere;max-width:100%;color:var(--ce-fg-3)}
.ceb-root input[type=checkbox]{accent-color:var(--ce-accent)}
@container (max-width:620px){
	.ceb-toolbar{display:grid;grid-template-columns:1fr auto;gap:6px;padding:8px 10px}
	.ceb-nav-group{grid-column:1;grid-row:1}
	.ceb-action-group{grid-column:2;grid-row:1}
	.ceb-address-shell{grid-column:1/-1;grid-row:2;min-width:0;width:100%}
	.ceb-bookmark-row{flex-wrap:wrap}
	.ceb-bookmark-open{flex:1 1 100%}
	.ceb-panel{padding:18px 14px}
	.ceb-bookmark-editor{top:94px;max-height:calc(100% - 104px)}
}
@media(pointer:coarse){
	.ceb-toolbar .ceb-tool{min-width:36px;min-height:36px}
	.ceb-bookmark-editor .ceb-tool{min-width:36px;min-height:36px}
}
@media(prefers-reduced-motion:reduce){.ceb-progress-active>span{animation:none;width:100%;opacity:.5}.ceb-address-shell{transition:none}}

/* ============================ terminal ============================ */
.ce-term-shell{position:relative;flex:1;min-height:0;min-width:0;display:flex;background:var(--ce-bg)}
.ce-term{position:relative;flex:1;min-height:0;min-width:0;overflow:hidden;box-sizing:border-box;padding:10px;background:var(--ce-bg);color:var(--ce-fg);cursor:text}
.ce-term-rows{position:relative;white-space:pre;letter-spacing:0;font-kerning:none;font-variant-ligatures:none;tab-size:8}
.ce-term-row{white-space:pre;overflow:hidden;overflow-wrap:normal}
.ce-term-row span{white-space:pre}
.ce-term-measure{position:absolute;top:0;left:-9999px;visibility:hidden;white-space:pre;display:inline-block}
.ce-term-selection{position:absolute;top:10px;left:10px;pointer-events:none}
.ce-term-selection-rect{position:absolute;top:0;left:0;background:var(--ce-accent);opacity:.28}
.ce-term-cursor{position:absolute;top:10px;left:10px;pointer-events:none;box-sizing:border-box}
.ce-term-cursor-block{background:var(--ce-fg);mix-blend-mode:difference}
.ce-term-cursor-underline{border-bottom:2px solid var(--ce-fg)}
.ce-term-cursor-bar{border-left:2px solid var(--ce-fg)}
.ce-term-focused .ce-term-cursor-blink{animation:ce-term-blink 1.06s step-end infinite}
@keyframes ce-term-blink{50%{opacity:0}}
.ce-term-input{position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;resize:none;overflow:hidden}
.ce-term-status{position:absolute;left:10px;bottom:7px;right:10px;font-size:11px;color:var(--ce-fg-3);pointer-events:none}
.ce-term-status-error{color:var(--ce-bad)}
.ce-term-scrollbar{position:absolute;top:10px;right:3px;bottom:10px;width:8px;border-radius:4px;background:transparent;touch-action:none;z-index:3}
.ce-term-scrollbar:hover{background:var(--ce-fill)}
.ce-term-scrollbar-thumb{position:absolute;top:0;right:1px;width:5px;border-radius:3px;background:var(--ce-fg-3);opacity:.55;min-height:12px}
.ce-term-scrollbar:hover .ce-term-scrollbar-thumb,.ce-term-scrollbar-thumb:active{opacity:1;background:var(--ce-fg-2)}
.ce-term-search-layer{position:absolute;top:10px;left:10px;pointer-events:none;z-index:2}
.ce-term-search-rect{position:absolute;top:0;left:0;background:var(--ce-warn-soft);border-radius:2px}
.ce-term-search-current{background:var(--ce-accent-soft);outline:1px solid var(--ce-accent)}
.ce-term-find{position:absolute;top:8px;right:12px;z-index:4;display:flex;align-items:center;gap:4px;padding:5px 6px;border-radius:9px;border:1px solid var(--ce-line-strong);background:var(--ce-s1);box-shadow:var(--ce-shadow-2)}
.ce-term-find-input{width:190px;height:24px;box-sizing:border-box;padding:0 7px;font:inherit;font-size:12px;border-radius:5px;border:1px solid transparent;background:var(--ce-fill);color:var(--ce-fg);outline:none}
.ce-term-find-input:focus{border-color:var(--ce-accent)}
.ce-term-find-count{min-width:42px;text-align:center;font-size:11px;color:var(--ce-fg-3);font-variant-numeric:tabular-nums}
.ce-term-find-btn{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:5px;background:transparent;color:var(--ce-fg-2);font:inherit;font-size:12px;cursor:pointer}
.ce-term-find-btn:hover{background:var(--ce-fill-strong);color:var(--ce-fg)}
.ce-term-copy-cursor{position:absolute;top:10px;left:10px;border:1.5px solid var(--ce-accent);box-sizing:border-box;pointer-events:none;z-index:2;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.25)}
.ce-term-copybar{position:absolute;left:12px;bottom:10px;z-index:4;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);padding:5px 10px;border-radius:7px;border:1px solid var(--ce-line-strong);background:var(--ce-s1);box-shadow:var(--ce-shadow-2)}
.ce-term-copy-mode{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ce-accent);font-family:var(--ce-mono)}
.ce-term-copy-hint{font-size:11px;color:var(--ce-fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ce-term-a11y{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:pre-wrap;border:0}
.ce-term-notice{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:5;max-width:min(520px,calc(100% - 24px));padding:6px 12px;border-radius:7px;border:1px solid var(--ce-line-strong);background:var(--ce-s1);color:var(--ce-fg);font-size:11.5px;box-shadow:var(--ce-shadow-2);animation:ce-term-notice-in .16s ease-out}
@keyframes ce-term-notice-in{from{opacity:0;transform:translate(-50%,4px)}to{opacity:1;transform:translate(-50%,0)}}
.ce-term-reconnect{position:absolute;right:12px;bottom:10px;z-index:4;font:inherit;font-size:11.5px;padding:4px 10px;border-radius:6px;border:1px solid var(--ce-line);background:var(--ce-s1);color:var(--ce-fg);cursor:pointer}
.ce-term-reconnect:hover{background:var(--ce-fill-strong)}
.ce-term-title{display:inline-flex;align-items:center;gap:4px;font-family:var(--ce-mono)}
@media(prefers-reduced-motion:reduce){
	.ce-term-focused .ce-term-cursor-blink{animation:none}
	.ce-term-notice{animation:none}
}
`;
