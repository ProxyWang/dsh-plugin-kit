/* HTTP client surface: request row, configuration tabs and editable tables,
 * response pane, history/favourites overlays, SSE stream and the two-protocol
 * request workbench that hosts API and gRPC in one tab. */

export const API_CSS = `
/* ---------- shell ---------- */
.cea-root{container-type:inline-size;overflow:hidden;min-width:0;width:100%;max-width:100%;height:100%;display:flex;flex-direction:column}

/* ---------- tool row ---------- */
.cea-tools{display:flex;flex-wrap:wrap;align-items:center;gap:2px;flex:none;min-height:38px;padding:4px 10px;border-bottom:1px solid var(--ce-line);background:var(--ce-bg)}
.cea-tools .ce-sk-btn{border-color:transparent;background:transparent;color:var(--ce-fg-3);padding:0 8px;font-size:11.5px;font-weight:500}
.cea-tools .ce-sk-btn:hover{background:var(--ce-fill);color:var(--ce-fg)}
.cea-tools .ce-sk-btn.cea-btn-on{background:var(--ce-accent-soft);color:var(--ce-accent)}
.cea-root button:focus-visible,.cea-root select:focus-visible,.cea-root textarea:focus-visible{outline:2px solid var(--ce-accent);outline-offset:1px}

/* ---------- request row ---------- */
.cea-bar{display:grid;grid-template-columns:82px minmax(0,1fr) auto;gap:8px;align-items:center;flex:none;padding:12px 12px 10px;background:var(--ce-bg);border:0}
.cea-method{flex:none;height:32px;padding:0 6px;border:1px solid var(--ce-line);border-radius:7px;background:var(--ce-fill);color:var(--ce-fg-2);font:inherit;font-size:11.5px;cursor:pointer}
.cea-method:hover{border-color:var(--ce-line)}
.cea-method:focus{border-color:var(--ce-accent);outline:none}
.cea-root>.cea-bar .cea-request-method{height:36px;width:82px;font-family:var(--ce-mono);font-size:12px;font-weight:700;letter-spacing:.01em;background:var(--ce-fill);border-color:var(--ce-line)}
.cea-root>.cea-bar .cea-request-method.cea-m-get{background:var(--ce-ok-soft);border-color:color-mix(in srgb,var(--ce-ok) 26%,transparent)}
.cea-root>.cea-bar .cea-request-method.cea-m-post{background:var(--ce-warn-soft);border-color:color-mix(in srgb,var(--ce-warn) 26%,transparent)}
.cea-root>.cea-bar .cea-request-method.cea-m-put{background:var(--ce-accent-soft);border-color:var(--ce-accent-line)}
.cea-root>.cea-bar .cea-request-method.cea-m-patch{background:color-mix(in srgb,var(--ce-warn) 12%,transparent);border-color:color-mix(in srgb,var(--ce-warn) 24%,transparent)}
.cea-root>.cea-bar .cea-request-method.cea-m-delete{background:var(--ce-bad-soft);border-color:color-mix(in srgb,var(--ce-bad) 26%,transparent)}
.cea-root>.cea-bar .cea-url{width:100%;height:36px;font-family:var(--ce-mono);font-size:12px;background:var(--ce-fill);border-color:var(--ce-line);border-radius:8px;padding:0 12px}
.cea-root>.cea-bar .cea-url:hover{border-color:var(--ce-line-strong)}
.cea-root>.cea-bar .cea-url:focus{background:var(--ce-bg);border-color:var(--ce-accent);box-shadow:0 0 0 3px var(--ce-accent-softer)}
.cea-root>.cea-bar .cea-send{margin-left:2px;min-width:78px;height:36px;padding:0 16px;border-radius:8px;background:var(--dsw-alias-button-primary-fill,var(--ce-accent));color:var(--ce-on-accent);font-size:12.5px;font-weight:600}
.cea-root>.cea-bar .cea-send:hover:not(:disabled){filter:brightness(1.06)}
.cea-root>.cea-bar .cea-send:disabled{opacity:.45;cursor:default;filter:none}

/* method identity: one semantic hue per verb, never a rainbow */
.cea-m-get{color:var(--ce-ok)}
.cea-m-post{color:var(--ce-warn)}
.cea-m-put{color:var(--ce-accent)}
.cea-m-patch{color:color-mix(in srgb,var(--ce-warn) 65%,var(--ce-bad))}
.cea-m-delete{color:var(--ce-bad)}
.cea-m-head,.cea-m-options{color:var(--ce-fg-3)}

/* ---------- environment and secondary tools ---------- */
.cea-env{width:auto;max-width:150px;min-width:96px;height:26px;font-size:11.5px;background:transparent;color:var(--ce-fg-3);border-color:transparent}
.cea-env:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.cea-envbar{display:flex;gap:6px;align-items:center;padding:4px 10px 8px;flex:none}
.cea-env-name{flex:1;min-width:0;font-size:12px}
.cea-envbar .ce-sk-btn{flex:none;font-size:11px;padding:0 8px}
.cea-danger{color:var(--ce-bad)!important;border-color:transparent!important}
.cea-save-coll{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ce-fg-2)}
.cea-link{border:0;background:transparent;color:var(--ce-accent);font:inherit;font-size:11.5px;cursor:pointer;padding:0}
.cea-link:hover{text-decoration:underline;text-underline-offset:2px}

/* ---------- configuration tabs and panels ---------- */
.cea-root .cea-request-tabs{display:flex;align-items:center;gap:20px;flex:none;padding:0 14px;overflow-x:auto;border-bottom:1px solid var(--ce-line);background:var(--ce-bg);scrollbar-width:none}
.cea-root .cea-request-tabs::-webkit-scrollbar{display:none}
.cea-config-tab{display:inline-flex;align-items:center;gap:5px;flex:none;border:0;border-bottom:2px solid transparent;padding:11px 1px 9px;margin-bottom:-1px;background:transparent;color:var(--ce-fg-3);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
.cea-config-tab:hover{color:var(--ce-fg-2)}
.cea-config-tab-on,.cea-config-tab-on:hover{color:var(--ce-fg);border-bottom-color:var(--ce-accent);font-weight:600}
.cea-tab-count{font-size:10px;color:var(--ce-fg-3);background:var(--ce-fill);border-radius:999px;padding:1px 6px;line-height:14px;font-variant-numeric:tabular-nums}
.cea-config-tab-on .cea-tab-count{color:var(--ce-accent);background:var(--ce-accent-soft)}
.cea-request-panel{flex:0 0 auto;min-height:160px;max-height:55%;overflow:auto;padding:12px 12px 14px;box-sizing:border-box;background:var(--ce-bg)}
.cea-root .cea-sec{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 2px 4px;color:var(--ce-fg-3);font-size:11px;font-weight:600;letter-spacing:.01em;flex:none}
.cea-tmo{display:flex;gap:6px;align-items:center;font-size:10px;color:var(--ce-fg-3);font-weight:400;flex:none}
.cea-tmo-in{width:64px;flex:none;height:26px;font-size:11px;padding:0 6px}
.cea-hint{font-size:10.5px;color:var(--ce-fg-3);font-weight:400}
.cea-hrow{display:flex;gap:6px;padding:2px 2px;align-items:center;flex:none}
.cea-hkey{flex:0 0 36%;min-width:0}
.cea-hval{flex:1;min-width:0}
.cea-hlist{padding:0 2px 6px;font-size:11.5px;color:var(--ce-fg-2)}
.cea-hlist div{display:flex;gap:6px;line-height:1.6}
.cea-hk{font-weight:600;color:var(--ce-fg);flex:none}
.cea-he{color:var(--ce-bad)}

/* ---------- body, auth, settings ---------- */
.cea-body{flex:none;min-height:110px;max-height:220px;width:100%;box-sizing:border-box;resize:vertical;border:1px solid var(--ce-line);border-radius:var(--ce-radius);outline:none;background:var(--ce-fill);color:var(--ce-fg);font-family:var(--ce-mono);font-size:12px;line-height:1.55;padding:10px 12px;margin:4px 0;white-space:pre;overflow:auto}
.cea-body:focus{border-color:var(--ce-accent);background:var(--ce-bg);box-shadow:0 0 0 3px var(--ce-accent-softer)}
.cea-root .cea-body:not(.cea-import){min-height:180px;max-height:none;resize:vertical;margin:6px 0 0;padding:12px}
.cea-import{min-height:140px;max-height:none;flex:1;border:0}
.cea-settings{padding:12px 2px}
.cea-settings .cea-tmo{font-size:12px;gap:12px}
.cea-settings .cea-tmo-in{box-sizing:border-box;width:100px;height:28px}
.cea-auth{display:flex;flex-direction:column;gap:10px;padding:4px 2px}
.cea-auth-row{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--ce-fg-2)}
.cea-auth-row>span{flex:0 0 88px;color:var(--ce-fg-3)}
.cea-auth-row .ce-input{flex:1;min-width:0;font-family:var(--ce-mono);font-size:12px}

/* ---------- key/value tables: one hairline grid, no boxes in boxes ---------- */
.cea-fields{min-width:0}
.cea-fields-scroll{overflow:auto;border:1px solid var(--ce-line);border-radius:var(--ce-radius);background:var(--ce-bg)}
.cea-fields-table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:12px;color:var(--ce-fg)}
.cea-fields-check,.cea-fields-action{width:34px}
.cea-fields-name{width:25%}
.cea-fields-value{width:auto}
.cea-fields-description{width:25%}
.cea-fields-table th{font-weight:500;color:var(--ce-fg-3);background:var(--ce-s1);text-align:left;height:32px;padding:0 10px;font-size:11px;border-bottom:1px solid var(--ce-line)}
.cea-fields-table td{height:36px;padding:0;border-top:1px solid var(--ce-line)}
.cea-fields-table tr:first-child td{border-top:0}
.cea-fields-table th,.cea-fields-table td{border-right:0}
.cea-fields-table td:first-child{text-align:center}
.cea-fields-table tbody tr:hover td{background:var(--ce-fill)}
.cea-fields-table input[type=checkbox]{accent-color:var(--ce-accent);width:14px;height:14px;cursor:pointer;margin:0}
.cea-fields-table input[type=checkbox]:disabled{opacity:.25;cursor:default}
.cea-field-input{width:100%;min-width:0;height:36px;border:0;border-radius:0;background:transparent;color:var(--ce-fg);padding:0 10px;font:inherit;font-size:12px;outline-offset:-2px!important}
.cea-field-input::placeholder{color:var(--ce-fg-3)}
.cea-field-input:focus{background:var(--ce-accent-softer);outline:none}
.cea-field-disabled .cea-field-input{color:var(--ce-fg-3);text-decoration:line-through;text-decoration-color:var(--ce-line-strong)}
.cea-field-delete{width:26px;height:26px;margin:0}
.cea-fields-footer{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:10px 2px;color:var(--ce-fg-3);font-size:11px;line-height:1.5}
.cea-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.cea-request-panel .cea-fields+.cea-fields{margin-top:12px;border-top:1px solid var(--ce-line);padding-top:8px}

/* ---------- workspace split ---------- */
.cea-scroll.cea-workspace{display:grid;flex:1;min-height:0;overflow:hidden;gap:0}
.cea-request{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;background:var(--ce-bg)}
.cea-workspace .cea-request-panel{flex:1;min-height:0;max-height:none;overflow:auto;padding:12px 12px 14px}
.cea-workspace .cea-request-panel .cea-body{display:block;min-height:160px;max-height:none;resize:vertical}
.cea-resizer{display:flex;align-items:center;justify-content:center;cursor:row-resize;touch-action:none;background:transparent;min-height:10px;position:relative}
.cea-resizer::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--ce-line)}
.cea-resizer>span{position:relative;width:32px;height:3px;border-radius:999px;background:var(--ce-line-strong);opacity:0;transition:opacity var(--ce-dur) var(--ce-ease)}
.cea-resizer:hover>span,.cea-resizer:focus-visible>span{opacity:1;background:var(--ce-accent)}
.cea-resizer:hover,.cea-resizer:focus-visible{outline:0;background:var(--ce-accent-softer)}

/* ---------- response ---------- */
.cea-response{display:flex;flex-direction:column;flex:1 1 auto;min-height:160px;border-top:1px solid var(--ce-line);position:relative;background:var(--ce-bg);overflow:hidden}
.cea-workspace .cea-response{flex:none;min-height:0;min-width:0;border:0;overflow:hidden}
.cea-response-content{flex:1;min-height:0;min-width:0;overflow:auto;background:var(--ce-bg)}
.cea-response>.cea-sec{font-weight:600;flex:none;padding:10px 12px 6px;color:var(--ce-fg-2);font-size:11.5px}
.cea-status{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 14px;font-size:12px;flex:none;border-bottom:1px solid var(--ce-line)}
.cea-ok{color:var(--ce-ok);font-weight:600;background:var(--ce-ok-soft);border-radius:999px;padding:1px 8px;font-size:11px;font-family:var(--ce-mono)}
.cea-info{color:var(--ce-accent);font-weight:600;background:var(--ce-accent-soft);border-radius:999px;padding:1px 8px;font-size:11px;font-family:var(--ce-mono)}
.cea-warn{color:var(--ce-warn);font-weight:600;background:var(--ce-warn-soft);border-radius:999px;padding:1px 8px;font-size:11px;font-family:var(--ce-mono)}
.cea-err{color:var(--ce-bad);font-weight:600;background:var(--ce-bad-soft);border-radius:999px;padding:1px 8px;font-size:11px;font-family:var(--ce-mono)}
.cea-meta{font-family:var(--ce-mono);font-size:11px;color:var(--ce-fg-3);font-variant-numeric:tabular-nums}
.cea-hts{flex:none;font-size:10px;color:var(--ce-fg-3);font-family:var(--ce-mono)}
.cea-resp{flex:1;min-height:100px;margin:0;padding:12px 14px;font-family:var(--ce-mono);font-size:12px;line-height:1.6;white-space:pre;overflow:auto;color:var(--ce-fg);background:var(--ce-bg);border-top:0}
.cea-response-content .cea-resp{min-height:0;margin:0;padding:12px 14px;border:0;border-radius:0;overflow:visible;width:max-content;min-width:100%}
.cea-response-content .cea-hlist{padding:8px 14px;border-bottom:1px solid var(--ce-line)}
.cea-response-content .cea-hlist div{overflow-wrap:anywhere}
.cea-root .cea-status{flex-wrap:wrap;padding:8px 14px}
.cea-response-wait{padding:8px 14px;color:var(--ce-accent);font-size:12px}
.cea-response[aria-busy="true"] .cea-resp{opacity:.5}
.cea-empty{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;min-height:110px;padding:16px;text-align:center;color:var(--ce-fg-3);font-size:12px;line-height:1.6;flex:1}
.cea-empty strong{font-weight:500;color:var(--ce-fg-2)}
.cea-empty span{font-size:11px;color:var(--ce-fg-3)}
.cea-resp-tabs{padding:2px 10px 0;border-bottom:1px solid var(--ce-line);flex:none;background:var(--ce-bg)}
.cea-root .cea-hist{top:100px}

/* response sub-tabs share the configuration-tab grammar */
.cea-resp-tabs .cea-tab{padding:8px 8px 7px;border-radius:0;background:transparent;color:var(--ce-fg-3);font-size:12px;border-bottom:2px solid transparent}
.cea-resp-tabs .cea-tab:hover{color:var(--ce-fg-2);background:transparent}
.cea-resp-tabs .cea-tab-on{color:var(--ce-fg);border-bottom-color:var(--ce-accent);background:transparent;font-weight:600}

/* ---------- history, favourites, codegen and import overlays ---------- */
.cea-hist{position:absolute;top:46px;left:10px;right:10px;z-index:8;background:var(--ce-s1);border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius-lg);box-shadow:var(--ce-shadow-2);display:flex;flex-direction:column;max-height:62%;overflow:hidden}
.cea-hist-tabs{display:flex;gap:4px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--ce-line);flex:none;font-size:12px;color:var(--ce-fg-2)}
.cea-tab{border:0;background:transparent;color:var(--ce-fg-3);font:inherit;font-size:11.5px;padding:4px 9px;border-radius:6px;cursor:pointer;flex:none}
.cea-tab:hover{color:var(--ce-fg);background:var(--ce-fill)}
.cea-tab-on,.cea-tab-on:hover{background:var(--ce-fill-strong);color:var(--ce-fg)}
.cea-hist-list{overflow:auto;min-height:0;padding:5px}
.cea-hrow2{display:flex;align-items:center;gap:2px;border-radius:6px}
.cea-hrow2:hover{background:var(--ce-fill)}
.cea-hmain{flex:1;min-width:0;display:flex;gap:8px;align-items:center;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:6px 8px;cursor:pointer;border-radius:6px}
.cea-hist-item{display:flex;align-items:center;gap:2px}
.cea-hist-item .cea-hist-row{flex:1 1 auto;min-width:0}
.cea-hist-del{opacity:0}
.cea-hist-item:hover .cea-hist-del,.cea-hist-del:focus-visible{opacity:1}
.cea-mbadge{flex:none;font-size:9px;font-weight:700;font-family:var(--ce-mono);padding:1px 5px;border-radius:4px;background:var(--ce-fill);color:var(--ce-fg-2)}
.cea-hurl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;color:var(--ce-fg-2);font-family:var(--ce-mono)}
.cea-hname{flex:none;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--ce-warn)}
.cea-hstatus{flex:none;font-size:11px;font-variant-numeric:tabular-nums}
.cea-hist-url{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ce-mono);font-size:11.5px}
.cea-hist-ms{flex:none;font-size:10.5px;color:var(--ce-fg-3);font-variant-numeric:tabular-nums}
.cea-codemenu{max-width:270px;min-width:220px;left:auto;right:10px}
.cea-code-item{align-items:center}
.cea-code-label{flex:1;min-width:0;font-family:var(--ce-mono);font-size:11.5px}
.cea-code-copied{flex:none;font-size:11px}

/* ---------- SSE stream ---------- */
.cea-stream{display:flex;flex-direction:column;gap:2px;padding:4px 0}
.cea-sse-row{display:flex;gap:8px;align-items:baseline;white-space:pre-wrap;word-break:break-word;font-size:11.5px}
.cea-sse-kind{flex:none;color:var(--ce-accent);font-weight:600;font-family:var(--ce-mono);font-size:10.5px}
.cea-sse-id,.cea-sse-retry{flex:none;color:var(--ce-fg-3);font-size:10.5px;font-family:var(--ce-mono)}
.cea-sse-data{font-family:var(--ce-mono);color:var(--ce-fg-2)}
.cea-sse-stop{flex:none;margin-right:6px}

/* ---------- request timeline ---------- */
.cea-timeline{display:flex;flex-direction:column;gap:6px;padding:10px 12px}
.cea-tl-req{display:flex;gap:8px;align-items:center;padding:0 2px}
.cea-tl-body{margin:0 2px;border-radius:var(--ce-radius);max-height:160px;overflow:auto;border:1px solid var(--ce-line)}
.cea-tl-meta{padding:2px 2px;font-size:10.5px;color:var(--ce-fg-3);font-family:var(--ce-mono)}

/* ---------- HTML preview ---------- */
.ce-htmlprev{flex:1;min-height:0;width:100%;border:0;background:#fff}

@container (max-width:380px){
	.cea-root>.cea-bar{grid-template-columns:74px minmax(0,1fr);padding:10px}
	.cea-root>.cea-bar .cea-request-method{width:74px;height:34px;font-size:11px}
	.cea-root>.cea-bar .cea-url{height:34px}
	.cea-root>.cea-bar .cea-send{grid-column:1/-1;margin:2px 0 0;width:100%}
	.cea-tools{gap:0}
	.cea-root .cea-request-tabs{gap:14px;padding:0 10px}
	.cea-root .cea-request-panel{padding:10px}
	.cea-root .cea-hist{top:148px}
}
@container (max-width:560px){
	.cea-fields-description{display:none}
	.cea-fields-name{width:36%}
	.cea-root>.cea-bar{padding:10px}
	.cea-workspace .cea-request-panel{padding:10px}
	.cea-root .cea-request-tabs{padding:0 10px;gap:16px}
}

/* ---------- request workbench: one tab, two protocols ---------- */
.ce-wb{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--ce-bg)}
.ce-wb-bar{display:flex;align-items:center;gap:8px;flex:none;height:44px;padding:0 10px;border-bottom:1px solid var(--ce-line);background:var(--ce-bg)}
.ce-wb-seg{display:flex;align-items:center;gap:1px;border:0;border-radius:0;overflow:visible;background:transparent}
.ce-wb-btn{display:inline-flex;align-items:center;height:27px;border:0;border-radius:7px;background:transparent;color:var(--ce-fg-3);padding:0 10px;cursor:pointer;font:inherit;font-size:12px;font-weight:500}
.ce-wb-btn:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.ce-wb-on,.ce-wb-on:hover{background:var(--ce-fill-strong);color:var(--ce-fg);font-weight:600}
.ce-wb-on:focus-visible{outline:2px solid var(--ce-accent);outline-offset:1px}
.ce-wb-hint{font-size:11px;color:var(--ce-fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ce-wb-hist{display:inline-flex;align-items:center;height:27px;border:0;background:transparent;color:var(--ce-fg-3);font:inherit;font-size:11.5px;padding:0 8px;border-radius:7px;cursor:pointer}
.ce-wb-hist:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.ce-wb-hist.ce-wb-on{background:var(--ce-fill-strong);color:var(--ce-fg)}
.ce-wb-pane{flex:1;min-height:0;min-width:0;display:flex}
.ce-wb-pane[hidden]{display:none}
.ce-wb-drawer{flex:none;max-height:46%;display:flex;flex-direction:column;border-bottom:1px solid var(--ce-line);background:var(--ce-s1)}
.ce-wb-drawer-head{display:flex;align-items:center;gap:8px;padding:8px 10px;font-size:11.5px;color:var(--ce-fg-2)}
.ce-wb-drawer-hint{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ce-fg-3);font-size:11px}
.ce-wb-drawer-list{min-height:0;overflow:auto;padding:0 6px 6px}
.ce-wb-drawer-empty{padding:10px 12px;font-size:12px;color:var(--ce-fg-3)}
.ce-wb-drawer-item{display:flex;align-items:center;gap:4px}
.ce-wb-drawer-item .ce-wb-drawer-row{flex:1 1 auto;min-width:0}
.ce-wb-drawer-del{opacity:0}
.ce-wb-drawer-item:hover .ce-wb-drawer-del,.ce-wb-drawer-del:focus-visible{opacity:1}
.ce-wb-drawer-row{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;text-align:left;padding:6px 8px;border-radius:6px;cursor:pointer}
.ce-wb-drawer-row:hover{background:var(--ce-fill)}
.ce-wb-proto{flex:none;font-size:9px;font-weight:700;letter-spacing:.03em;padding:1px 5px;border-radius:4px;background:var(--ce-fill);color:var(--ce-fg-2);font-family:var(--ce-mono)}
.ce-wb-proto-grpc{background:var(--ce-accent-soft);color:var(--ce-accent)}
.ce-wb-drawer-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ce-mono);font-size:11.5px}
.ce-wb-drawer-ms{flex:none;font-size:11px;color:var(--ce-fg-3);font-variant-numeric:tabular-nums}
`;
