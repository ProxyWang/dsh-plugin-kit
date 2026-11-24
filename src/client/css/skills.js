/* Reading surfaces that do not belong to a code editor: the skills manager
 * (list + markdown reader/editor) and the left-panel launcher rows. */

export const SKILLS_CSS = `
/* ---------- skills container ---------- */
.ce-sk-root{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;container-type:inline-size;overflow:hidden;background:var(--ce-bg)}
.ce-sk-top{display:flex;gap:8px;align-items:center;flex:none;min-height:48px;padding:0 14px;border-bottom:1px solid var(--ce-line);background:var(--ce-bg)}
.ce-sk-heading{display:flex;align-items:center;gap:8px;flex:1;min-width:0;flex-wrap:wrap}
.ce-sk-heading h2{font-size:13px;font-weight:600;margin:0;color:var(--ce-fg);letter-spacing:0}
.ce-sk-total{font-size:11px;color:var(--ce-fg-3);background:var(--ce-fill);border-radius:999px;padding:2px 8px;font-variant-numeric:tabular-nums}
.ce-sk-workspace{display:grid;grid-template-columns:clamp(210px,30%,280px) minmax(0,1fr);flex:1;min-height:0;min-width:0}
.ce-sk-list{min-width:0;min-height:0;border-right:1px solid var(--ce-line);display:flex;flex-direction:column;overflow:hidden;background:var(--ce-bg)}
.ce-sk-searchbar{display:flex;flex-direction:column;gap:6px;padding:10px 12px;flex:none;border-bottom:1px solid var(--ce-line);background:var(--ce-bg)}
.ce-sk-searchbar .ce-input{width:100%;box-sizing:border-box;flex:none;font-size:12px;min-height:30px}
.ce-sk-scope{min-width:0;height:28px;border:1px solid var(--ce-line);background:var(--ce-fill);color:var(--ce-fg-2);border-radius:6px;font:inherit;font-size:11.5px;padding:0 6px}
.ce-sk-scope:hover{border-color:var(--ce-line-strong)}
.ce-sk-scope:focus{border-color:var(--ce-accent);outline:none}
.ce-sk-results{flex:1;min-height:0;overflow:auto;padding:2px 0 12px}
.ce-sk-section{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:0;padding:14px 12px 5px;font-size:11px;font-weight:600;color:var(--ce-fg-3);background:transparent}
.ce-sk-section>span:last-child{font-weight:400;font-variant-numeric:tabular-nums;color:var(--ce-fg-3)}
.ce-sk-row{display:flex;flex-direction:column;gap:2px;width:calc(100% - 8px);margin:0 4px 2px;border:0;border-radius:var(--ce-radius);background:transparent;color:inherit;font:inherit;text-align:left;padding:9px 10px;cursor:pointer}
.ce-sk-row:hover{background:var(--ce-fill)}
.ce-sk-row-on,.ce-sk-row-on:hover{background:var(--ce-accent-soft);box-shadow:inset 2px 0 0 var(--ce-accent)}
.ce-sk-row-on .ce-sk-row-name{color:var(--ce-fg)}
.ce-sk-row-name{max-width:100%;font-size:12.5px;line-height:1.4;font-weight:600;color:var(--ce-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-sk-row-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:11.5px;line-height:1.5;color:var(--ce-fg-3);overflow-wrap:anywhere}
.ce-sk-row:disabled{cursor:default;opacity:.65}
.ce-sk-edit{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--ce-bg)}
.ce-sk-detail-head{flex:none;max-height:36%;overflow:auto;padding:16px 18px 10px}
.ce-sk-detail-title{margin:0 0 6px;font-size:17px;line-height:1.35;font-weight:600;letter-spacing:-.01em;overflow-wrap:anywhere;color:var(--ce-fg)}
.ce-sk-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:11px;color:var(--ce-fg-3)}
.ce-sk-meta .ce-sk-btn{padding:0 7px;min-height:22px;font-size:10.5px}
.ce-sk-detail-desc{margin:10px 0 6px;font-size:12px;line-height:1.65;color:var(--ce-fg-2);overflow-wrap:anywhere}
.ce-sk-detail-tools{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-height:40px;padding:6px 14px;border-top:1px solid var(--ce-line);border-bottom:1px solid var(--ce-line);background:var(--ce-bg)}
.ce-sk-view-switch{display:flex;align-items:center;gap:1px;margin-right:auto}
.ce-sk-view-switch .ce-sk-btn{min-height:26px}
.ce-sk-edit-label{margin-right:auto;font-size:11.5px;color:var(--ce-fg-3)}
.ce-sk-root .ce-sk-view-on{background:var(--ce-fill-strong);color:var(--ce-fg);font-weight:600}
.ce-sk-root .ce-sk-primary{background:var(--dsw-alias-button-primary-fill,var(--ce-accent));border-color:transparent;color:var(--ce-on-accent);font-weight:600}
.ce-sk-root .ce-sk-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,var(--ce-accent)));filter:none}
.ce-sk-root .ce-sk-btn{min-height:28px;white-space:normal;border-color:transparent}
.ce-sk-name-hint{flex-basis:100%;font-size:11px;line-height:1.5;color:var(--ce-fg-3)}
.ce-sk-back{display:none;margin-bottom:8px}
.ce-sk-create{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;border-bottom:1px solid var(--ce-line);flex:none;align-items:center;background:var(--ce-bg)}
.ce-sk-name-input{flex:1 1 180px;min-width:0;font-size:12px}
.ce-sk-welcome{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:10px;flex:1;padding:32px;max-width:460px;align-self:center;color:var(--ce-fg-2)}
.ce-sk-welcome>svg{width:28px;height:28px;color:var(--ce-fg-2);margin-bottom:2px;padding:9px;box-sizing:content-box;border-radius:12px;background:var(--ce-fill)}
.ce-sk-welcome h3{margin:0;font-size:15px;font-weight:600;color:var(--ce-fg)}
.ce-sk-welcome p{margin:0;font-size:12px;line-height:1.7;color:var(--ce-fg-3)}
.ce-sk-welcome-note{color:var(--ce-fg-3);font-size:11.5px}
.ce-sk-feedback{padding:20px 16px;font-size:12px;line-height:1.6;color:var(--ce-fg-2);overflow-wrap:anywhere;display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
.ce-sk-delete-confirm{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 14px;background:var(--ce-fill);border-bottom:1px solid var(--ce-line);font-size:12px}
.ce-sk-delete-confirm>span{flex:1 1 180px;overflow-wrap:anywhere}
.ce-sk-ta,.ce-sk-source{flex:1;min-height:0;resize:none;border:0;outline:none;margin:0;background:var(--ce-bg);color:var(--ce-fg);font-family:var(--ce-mono);font-size:12px;line-height:1.65;padding:16px 20px;white-space:pre;overflow:auto}
.ce-sk-root button:focus-visible,.ce-sk-root select:focus-visible,.ce-sk-root textarea:focus-visible{outline:2px solid var(--ce-accent);outline-offset:-2px}
.ce-sk-path{display:block;width:100%;border:0;background:transparent;color:var(--ce-fg-3);font-family:var(--ce-mono);font-size:10px;padding:4px 0;cursor:pointer;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.ce-sk-path:hover{color:var(--ce-accent);text-decoration:underline;text-underline-offset:2px}
.ce-sk-install-details{margin-top:6px;font-size:11px;color:var(--ce-fg-3)}
.ce-sk-install-details>summary{cursor:pointer;padding:4px 0;color:var(--ce-fg-3)}
.ce-sk-install-details>summary:hover{color:var(--ce-fg-2)}
.ce-sk-install-details .ce-sk-detail-desc{font-size:11.5px;margin:6px 0;line-height:1.6}
.ce-sk-edit>.ce-md{padding:18px 22px;line-height:1.75}
.ce-sk-edit .ce-md-p,.ce-sk-edit .ce-md-list{max-width:76ch}
.ce-sk-edit .ce-md-pre,.ce-sk-edit .ce-md-code{background:var(--ce-s1);color:var(--ce-fg)}

/* ---------- images ---------- */
.ce-imgwrap{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px;overflow:auto}
.ce-img{max-width:100%;object-fit:contain;border:1px solid var(--ce-line);border-radius:var(--ce-radius);background:repeating-conic-gradient(color-mix(in srgb,var(--ce-fg) 6%,transparent) 0% 25%,transparent 0% 50%) 0 0/16px 16px}
.ce-imgmeta{flex:none;font-size:11px;color:var(--ce-fg-3);font-family:var(--ce-mono)}

/* ---------- markdown ---------- */
.ce-md{flex:1;min-height:0;overflow:auto;padding:18px 22px;font-size:13.5px;line-height:1.75;color:var(--ce-fg);max-width:88ch}
.ce-md-h{font-weight:600;color:var(--ce-fg);margin:20px 0 8px;letter-spacing:-.005em;line-height:1.4}
.ce-md-h:first-child{margin-top:0}
.ce-md-h1{font-size:20px;letter-spacing:-.015em}
.ce-md-h2{font-size:15.5px}
.ce-md-h3{font-size:13.5px;color:var(--ce-fg-2)}
.ce-md-h4,.ce-md-h5,.ce-md-h6{font-size:13px;color:var(--ce-fg-2)}
.ce-md-p{margin:8px 0}
.ce-md-pre{background:var(--ce-s1);border:1px solid var(--ce-line);border-radius:10px;padding:12px 14px;overflow:auto;margin:12px 0;font-family:var(--ce-mono);font-size:12px;line-height:1.65;white-space:pre}
.ce-md-code{background:var(--ce-fill);border-radius:4px;padding:1px 5px;font-family:var(--ce-mono);font-size:12px;color:var(--ce-fg-2)}
.ce-md-list{margin:8px 0;padding-left:22px}
.ce-md-list li{margin:3px 0}
.ce-md-quote{border-left:1px solid var(--ce-line-strong);padding:4px 12px;margin:12px 0;color:var(--ce-fg-2);background:var(--ce-fill);border-radius:0 6px 6px 0}
.ce-md-hr{border:0;border-top:1px solid var(--ce-line);margin:18px 0}
.ce-md-table{border-collapse:collapse;margin:12px 0;font-size:12.5px;width:auto}
.ce-md-table th,.ce-md-table td{border:0;border-bottom:1px solid var(--ce-line);padding:6px 12px;text-align:left}
.ce-md-table th{background:transparent;color:var(--ce-fg-3);font-weight:600;font-size:11.5px}
.ce-md-table tr:last-child td{border-bottom:0}
.ce-md-a{color:var(--ce-accent);text-decoration:none}
.ce-md-a:hover{text-decoration:underline;text-underline-offset:2px}

@container (max-width:620px){
	.ce-sk-workspace{grid-template-columns:minmax(0,1fr)}
	.ce-sk-list{border-right:0}
	.ce-sk-edit{display:none}
	.ce-sk-has-selection .ce-sk-list{display:none}
	.ce-sk-has-selection .ce-sk-edit{display:flex}
	.ce-sk-back{display:inline-flex}
	.ce-sk-searchbar{flex-direction:row;flex-wrap:wrap}
	.ce-sk-searchbar .ce-input{flex:1 1 160px;width:auto;min-width:0}
	.ce-sk-searchbar .ce-sk-scope{flex:1 1 100px}
	.ce-sk-top{padding:0 10px;min-height:44px}
	.ce-sk-detail-head{padding:14px 16px 8px}
	.ce-sk-detail-title{font-size:16px}
	.ce-sk-name-input{flex-basis:100%}
	.ce-sk-edit>.ce-md{padding:16px}
	.ce-sk-meta{gap:4px}
	.ce-sk-detail-tools{padding:6px 10px}
}

/* ---------- left launcher (native panel rows) ---------- */
.cel-root{padding:12px 10px 20px;display:flex;flex-direction:column;gap:1px;height:100%;box-sizing:border-box;background:var(--ce-bg)}
.cel-section{font-size:11px;font-weight:600;letter-spacing:.01em;color:var(--ce-fg-3);padding:16px 10px 5px}
.cel-row{display:flex;align-items:center;gap:10px;width:100%;border:1px solid transparent;background:transparent;color:inherit;font:inherit;text-align:left;padding:8px 10px;border-radius:9px;cursor:pointer;min-height:54px}
.cel-row:hover{background:var(--ce-fill);border-color:transparent;color:var(--ce-fg)}
.cel-row:focus-visible{outline:2px solid var(--ce-accent);outline-offset:-2px}
.cel-ico{flex:none;width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:var(--ce-accent-soft);color:var(--ce-accent)}
.cel-ico svg{width:16px;height:16px}
.cel-ico-skills{background:var(--ce-warn-soft);color:var(--ce-warn)}
.cel-ico-run{background:var(--ce-ok-soft);color:var(--ce-ok)}
.cel-ico-more{background:var(--ce-fill);color:var(--ce-fg-3)}
.cel-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.cel-title{font-size:12.5px;font-weight:600;color:var(--ce-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cel-desc{font-size:11.5px;line-height:1.45;color:var(--ce-fg-3);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cel-kbd{flex:none;font-family:var(--ce-mono);font-size:10px;color:var(--ce-fg-3);background:transparent;border:0;border-radius:4px;padding:2px 5px}
`;
