/* Design tokens, resets and the shared control vocabulary.
 *
 * One rule for this file: no component geometry here. Surfaces below paint with
 * these tokens only, so both DSH themes stay in sync and a host token change
 * flows through without a second edit.
 */

export const TOKENS_CSS = `
/* ---------- tokens ---------- */
:where(.ce-root,.cel-root,.cedb-root,.cerpc-root,.cea-root,.ceb-root,.ce-sk-root,.ce-wb,.ce-term,.ce-fast-hint,.ce-left-notice,.ce-workspace-guide){
	--ce-bg:var(--dsw-alias-bg-base,#111315);
	--ce-s1:var(--dsw-alias-bg-layer-1,#181b1f);
	--ce-s2:var(--dsw-alias-bg-layer-2,#20242a);
	--ce-hover:var(--dsw-alias-interactive-bg-hover,#29313b);
	--ce-fg:var(--dsw-alias-label-primary,#edf2f7);
	--ce-fg-2:var(--dsw-alias-label-secondary,#aab5c1);
	--ce-fg-3:var(--dsw-alias-label-tertiary,#7d8996);
	--ce-line:color-mix(in srgb,var(--dsw-alias-border-l1,#39414a) 62%,transparent);
	--ce-line-strong:color-mix(in srgb,var(--dsw-alias-border-l2,#515b66) 88%,transparent);
	--ce-accent:var(--dsw-alias-button-info-fill,var(--dsw-alias-brand-primary,#4176e6));
	--ce-on-accent:var(--dsw-alias-label-primary-foreground,#fff);
	--ce-accent-soft:color-mix(in srgb,var(--ce-accent) 12%,transparent);
	--ce-accent-softer:color-mix(in srgb,var(--ce-accent) 7%,transparent);
	--ce-accent-line:color-mix(in srgb,var(--ce-accent) 42%,transparent);
	--ce-ok:var(--dsw-alias-state-success-primary,#3fb950);
	--ce-warn:var(--dsw-alias-state-warn-primary,#e3b341);
	--ce-bad:var(--dsw-alias-state-error-primary,#f85149);
	--ce-ok-soft:color-mix(in srgb,var(--ce-ok) 14%,transparent);
	--ce-warn-soft:color-mix(in srgb,var(--ce-warn) 16%,transparent);
	--ce-bad-soft:color-mix(in srgb,var(--ce-bad) 14%,transparent);
	/* Foreground-tinted washes read as "one step deeper" in either theme,
	   unlike layer tokens whose direction flips between light and dark. */
	--ce-fill:color-mix(in srgb,var(--ce-fg) 4.5%,transparent);
	--ce-fill-strong:color-mix(in srgb,var(--ce-fg) 7.5%,transparent);
	--ce-radius-sm:6px;
	--ce-radius:8px;
	--ce-radius-lg:12px;
	--ce-shadow-1:0 1px 2px rgba(0,0,0,.16);
	--ce-shadow-2:0 14px 40px rgba(0,0,0,.24),0 2px 8px rgba(0,0,0,.12);
	--ce-dur:.13s;
	--ce-ease:cubic-bezier(.2,.7,.3,1);
	--ce-mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}

/* ---------- base ---------- */
.ce-root,.cel-root,.cedb-root,.cerpc-root,.cea-root,.ceb-root,.ce-sk-root,.ce-wb{
	color:var(--ce-fg);
	background:var(--ce-bg);
	font-family:inherit;
	font-size:13px;
	line-height:1.45;
	-webkit-font-smoothing:antialiased;
	scrollbar-width:thin;
	scrollbar-color:color-mix(in srgb,var(--ce-fg) 22%,transparent) transparent;
}
.ce-root *,.cel-root *,.cedb-root *,.cerpc-root *,.cea-root *,.ceb-root *,.ce-sk-root *{box-sizing:border-box}
.ce-root ::selection,.cedb-root ::selection,.cerpc-root ::selection,.cea-root ::selection,.ce-sk-root ::selection{background:var(--ce-accent-soft);color:var(--ce-fg)}
.ce-root ::-webkit-scrollbar,.cedb-root ::-webkit-scrollbar,.cerpc-root ::-webkit-scrollbar,.cea-root ::-webkit-scrollbar,.ceb-root ::-webkit-scrollbar,.ce-sk-root ::-webkit-scrollbar{width:10px;height:10px}
.ce-root ::-webkit-scrollbar-thumb,.cedb-root ::-webkit-scrollbar-thumb,.cerpc-root ::-webkit-scrollbar-thumb,.cea-root ::-webkit-scrollbar-thumb,.ceb-root ::-webkit-scrollbar-thumb,.ce-sk-root ::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ce-fg) 18%,transparent);border:3px solid transparent;background-clip:content-box;border-radius:999px}
.ce-root ::-webkit-scrollbar-thumb:hover,.cedb-root ::-webkit-scrollbar-thumb:hover,.cerpc-root ::-webkit-scrollbar-thumb:hover,.cea-root ::-webkit-scrollbar-thumb:hover,.ceb-root ::-webkit-scrollbar-thumb:hover,.ce-sk-root ::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--ce-fg) 32%,transparent);border:3px solid transparent;background-clip:content-box}
.ce-root ::-webkit-scrollbar-track,.cedb-root ::-webkit-scrollbar-track,.cerpc-root ::-webkit-scrollbar-track,.cea-root ::-webkit-scrollbar-track,.ceb-root ::-webkit-scrollbar-track,.ce-sk-root ::-webkit-scrollbar-track{background:transparent}
.ce-root button,.ce-root input,.ce-root select,.ce-root textarea,.cedb-root button,.cedb-root input,.cedb-root select,.cedb-root textarea,.cerpc-root button,.cerpc-root input,.cerpc-root select,.cerpc-root textarea,.cea-root button,.cea-root input,.cea-root select,.cea-root textarea,.ceb-root button,.ceb-root input,.ceb-root select,.ceb-root textarea,.ce-sk-root button,.ce-sk-root input,.ce-sk-root select,.ce-sk-root textarea,.cel-root button{font-family:inherit;transition:background-color var(--ce-dur) var(--ce-ease),color var(--ce-dur) var(--ce-ease),border-color var(--ce-dur) var(--ce-ease),opacity var(--ce-dur) var(--ce-ease),box-shadow var(--ce-dur) var(--ce-ease)}
:where(.ce-root,.cedb-root,.cerpc-root,.cea-root,.ceb-root,.ce-sk-root,.cel-root) :where(button,select,textarea,input,[tabindex]):focus-visible{outline:2px solid var(--ce-accent);outline-offset:1px}
.ce-root svg,.cea-root svg,.cedb-root svg,.cerpc-root svg,.ceb-root svg,.cel-root svg{flex:none}

/* ---------- type helpers ---------- */
.ce-root kbd,.cea-root kbd,.cedb-root kbd{font-family:var(--ce-mono);font-size:10px;line-height:1;color:var(--ce-fg-3);background:var(--ce-fill);border-radius:4px;padding:3px 5px}

/* ---------- surfaces ---------- */

/* ---------- icon button ---------- */
.ce-tool{display:inline-flex;align-items:center;justify-content:center;flex:none;width:26px;height:26px;padding:0;border:0;border-radius:var(--ce-radius-sm);background:transparent;color:var(--ce-fg-2);font-size:14px;line-height:1;cursor:pointer}
.ce-tool:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ce-tool:active{background:var(--ce-fill-strong)}
.ce-tool:disabled{opacity:.35;cursor:default;background:transparent}
.ce-tool-on{color:var(--ce-accent);background:var(--ce-accent-soft)}
.ce-tool-on:hover{color:var(--ce-accent);background:var(--ce-accent-soft)}
.ce-tool-danger{color:var(--ce-bad)}
.ce-tool-danger:hover{color:var(--ce-bad);background:var(--ce-bad-soft)}
.ce-tiny{width:22px;height:22px;font-size:12px}
.ce-tool svg{width:15px;height:15px}

/* ---------- text button ---------- */
.ce-link{border:0;background:transparent;color:var(--ce-accent);font:inherit;font-size:11.5px;font-weight:500;cursor:pointer;padding:0 1px;flex:none;border-radius:4px}
.ce-link:hover{text-decoration:underline;text-underline-offset:2px}
.ce-link-danger{color:var(--ce-bad)}
.ce-link:disabled{opacity:.45;cursor:default;text-decoration:none}
.ce-danger{color:var(--ce-bad)}
.ce-sk-confirm{display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap}
.ce-symglyph{width:16px;flex:none;text-align:center;color:var(--ce-fg-3);font-size:12px;font-family:var(--ce-mono)}

/* ---------- shared button (skills, API tools, database actions) ---------- */
.ce-sk-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:none;min-height:26px;padding:0 9px;border:1px solid transparent;border-radius:var(--ce-radius-sm);background:var(--ce-fill);color:var(--ce-fg-2);font:inherit;font-size:11.5px;font-weight:500;cursor:pointer;white-space:nowrap}
.ce-sk-btn:hover{background:var(--ce-fill-strong);color:var(--ce-fg)}
.ce-sk-btn:active{background:var(--ce-fill-strong)}
.ce-sk-btn:disabled{opacity:.4;cursor:default;background:var(--ce-fill)}
.ce-sk-btn-ghost{background:transparent;color:var(--ce-fg-2)}
.ce-sk-btn-ghost:hover{background:var(--ce-fill);color:var(--ce-fg)}
.ce-sk-btn-danger{color:var(--ce-bad);background:var(--ce-bad-soft)}
.ce-sk-btn-danger:hover{color:var(--ce-bad);background:color-mix(in srgb,var(--ce-bad) 20%,transparent)}
.ce-sk-btn-danger-text{color:var(--ce-bad)}
.ce-sk-btn-danger-text:hover{color:var(--ce-bad);background:var(--ce-bad-soft)}
.ce-sk-primary{background:var(--dsw-alias-button-primary-fill,var(--ce-accent));color:var(--ce-on-accent);font-weight:600}
.ce-sk-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,var(--ce-accent)));color:var(--ce-on-accent)}
.ce-sk-btn svg{width:14px;height:14px}

/* ---------- fields ---------- */
.ce-input{flex:1;min-width:0;height:28px;padding:0 9px;border:1px solid var(--ce-line);border-radius:var(--ce-radius-sm);background:var(--ce-fill);color:var(--ce-fg);font:inherit;font-size:12.5px;outline:none;transition:background-color var(--ce-dur) var(--ce-ease),border-color var(--ce-dur) var(--ce-ease),box-shadow var(--ce-dur) var(--ce-ease)}
input.ce-input,select.ce-input{appearance:none}
select.ce-input{padding-right:6px}
textarea.ce-input{height:auto;padding:7px 9px;line-height:1.55;resize:vertical}
.ce-input::placeholder{color:var(--ce-fg-3)}
.ce-input,.cea-body,.cedb-sql,.ce-sk-ta,.ce-sk-source,.ce-edit-ta,.ce-term-input{caret-color:var(--ce-accent)}
.ce-input:hover{border-color:var(--ce-line-strong)}
.ce-input:focus,.ce-input:focus-visible{border-color:var(--ce-accent);background:var(--ce-bg);box-shadow:0 0 0 3px var(--ce-accent-softer);outline:none}
.ce-input:disabled{opacity:.5;cursor:default}

/* ---------- chips and labels ---------- */
.ce-chip{display:inline-flex;align-items:center;gap:4px;flex:none;padding:2px 7px;border-radius:999px;background:var(--ce-fill);color:var(--ce-fg-2);font-size:11px;line-height:1.5;white-space:nowrap}
.ce-chip-warn{color:var(--ce-warn);background:var(--ce-warn-soft)}
.ce-badge{flex:none;min-width:16px;height:16px;line-height:16px;padding:0 4px;text-align:center;border-radius:5px;font-size:10px;font-weight:700;font-family:var(--ce-mono);background:var(--ce-fill);color:var(--ce-fg-2)}
.ce-badge-m{color:var(--ce-warn)}
.ce-badge-a,.ce-badge-u{color:var(--ce-ok)}
.ce-badge-d,.ce-badge-r{color:var(--ce-bad)}
.ce-badge-c{color:var(--ce-accent)}
.ce-section{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:12px 12px 5px;color:var(--ce-fg-3);font-size:11px;font-weight:600;letter-spacing:.01em}
.ce-note{color:var(--ce-fg-3);padding:6px 12px;font-size:12px;line-height:1.55}
.ce-note-line{display:flex;align-items:center;justify-content:space-between;gap:6px}
.ce-spacer{flex:1}

/* ---------- status dots ---------- */
.ce-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--ce-fg-3)}
.ce-dot-ready{background:var(--ce-ok)}
.ce-dot-starting{background:var(--ce-warn)}
.ce-dot-error{background:var(--ce-bad)}
.ce-spin{display:inline-flex;animation:ce-spin .9s linear infinite}
.ce-spin svg{width:12px;height:12px}
@keyframes ce-spin{to{transform:rotate(360deg)}}

/* ---------- empty state ---------- */
.ce-empty{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:28px;text-align:center;color:var(--ce-fg-3);background:var(--ce-bg);font-size:12.5px;line-height:1.7;max-width:44ch;margin:0 auto}
.ce-empty strong{color:var(--ce-fg-2);font-weight:500;font-size:12.5px;line-height:1.6;max-width:36ch}
.ce-empty-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--ce-fill);color:var(--ce-fg-3);margin-bottom:4px}
.ce-empty-hint{font-size:11.5px;color:var(--ce-fg-3);max-width:38ch}

/* ---------- banner ---------- */
.ce-banner{flex:none;display:flex;align-items:center;gap:8px;margin:8px 10px 0;padding:8px 8px 8px 10px;border-radius:var(--ce-radius);background:var(--ce-bad-soft);color:var(--ce-fg);font-size:12px;line-height:1.5}
.ce-banner-warn{background:var(--ce-accent-softer)}
.ce-banner-text{min-width:0;flex:1;white-space:pre-wrap;word-break:break-word}

@media(prefers-reduced-motion:reduce){
	.ce-root *,.cel-root *,.cedb-root *,.cerpc-root *,.cea-root *,.ceb-root *,.ce-sk-root *{transition:none!important;animation:none!important;scroll-behavior:auto!important}
}
`;
