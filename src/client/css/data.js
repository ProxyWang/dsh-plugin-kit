/* Data workbenches: the database browser (rail, tabs, SQL editor, virtual grid,
 * dialogs) and the gRPC console (method rail, message editor, response cards). */

export const DATA_CSS = `
/* ============================ database ============================ */
.cedb-root{display:flex;flex-direction:column;height:100%;overflow:hidden;position:relative;background:var(--ce-bg)}
.cedb-toolbar{flex:none;display:flex;align-items:center;gap:4px;height:44px;padding:0 10px;border-bottom:1px solid var(--ce-line);background:var(--ce-bg);min-width:0}
.cedb-toolbar .ce-sk-btn{height:27px;background:transparent;color:var(--ce-fg-3)}
.cedb-toolbar .ce-sk-btn:hover{background:var(--ce-fill);color:var(--ce-fg)}
.cedb-toolbar .ce-sk-btn.ce-sk-primary{background:var(--dsw-alias-button-primary-fill,var(--ce-accent));color:var(--ce-on-accent)}
.cedb-chip{font-size:10.5px;padding:2px 8px;border-radius:999px;background:var(--ce-fill);color:var(--ce-fg-3);white-space:nowrap;font-variant-numeric:tabular-nums}
.cedb-chip-warn{background:var(--ce-warn-soft);color:var(--ce-warn)}
.cedb-notice{font-size:11px;color:var(--ce-bad);max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-body{flex:1;min-height:0;display:flex;overflow:hidden}

/* ---- rail ---- */
.cedb-rail{flex:none;width:244px;min-width:170px;display:flex;flex-direction:column;border-right:1px solid var(--ce-line);overflow-y:auto;overflow-x:hidden;background:var(--ce-bg);padding-bottom:8px}
.cedb-rail-head{flex:none;padding:12px 10px 5px;font-size:11px;font-weight:600;color:var(--ce-fg-3);position:sticky;top:0;background:var(--ce-bg);z-index:2}
.cedb-rail-head-split{display:flex;flex-direction:column;gap:5px;padding-bottom:6px}
.cedb-rail-title{display:block}
.cedb-filter{height:26px;font-size:12px;width:100%;margin:0 0 2px}
.cedb-empty{padding:6px 12px 10px;font-size:12px;color:var(--ce-fg-3);line-height:1.55}
.cedb-instance{display:flex;flex-direction:column}
.cedb-instance-body{padding-left:8px;border-left:1px solid var(--ce-line);margin-left:10px}
.cedb-caret{width:10px;flex:0 0 auto;color:var(--ce-fg-3);font-size:8px}
.cedb-conn{display:flex;align-items:center;gap:2px;margin:0 4px;padding:0 6px 0 4px;border-radius:6px;border-left:2px solid transparent}
.cedb-conn:hover{background:var(--ce-fill)}
.cedb-conn-on{background:var(--ce-accent-soft);border-left-color:var(--ce-accent)}
.cedb-conn-on:hover{background:var(--ce-accent-soft)}
.cedb-conn-main{flex:1;min-width:0;display:flex;align-items:center;gap:6px;min-height:28px;padding:2px;border:0;background:transparent;color:var(--ce-fg);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.cedb-conn-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-driver{flex:none;font-size:9px;font-weight:700;letter-spacing:.02em;padding:1px 4px;border-radius:4px;background:var(--ce-fill);color:var(--ce-fg-3);font-family:var(--ce-mono)}
.cedb-driver-sqlite,.cedb-driver-mysql,.cedb-driver-postgres{color:var(--ce-fg-2)}
.cedb-rail-head-sub{padding-top:12px;border-top:1px solid var(--ce-line);margin-top:6px}
.cedb-saved .cedb-driver{opacity:.7}
.cedb-conn-bad{color:var(--ce-bad);font-size:10px;flex:0 0 auto}
.cedb-saved-pick{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:2px 0 4px}
.cedb-saved-pick-title{font-size:11px;color:var(--ce-fg-3);width:100%}
.cedb-saved-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border:1px solid var(--ce-line);border-radius:999px;background:transparent;color:var(--ce-fg);font-size:11px;cursor:pointer;max-width:100%}
.cedb-saved-chip:hover{border-color:var(--ce-accent-line);background:var(--ce-accent-softer)}
.cedb-saved-chip .cedb-driver{font-size:9px}
.cedb-dialog-test{font-size:11px;padding:5px 7px;border-radius:6px;background:var(--ce-fill);margin-top:4px}
.cedb-dialog-test-ok{color:var(--ce-ok)}
.cedb-dialog-test-bad{color:var(--ce-bad)}
.cedb-redetect{margin-left:auto;font-size:11px;color:var(--ce-fg-3);background:none;border:0;cursor:pointer;padding:2px 4px;border-radius:4px}
.cedb-redetect:hover{color:var(--ce-fg);background:var(--ce-fill)}
.cedb-bin{font-size:11px;color:var(--ce-fg-3);word-break:break-all;margin-top:2px;font-family:var(--ce-mono)}
.cedb-remember{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ce-fg-2);cursor:pointer;margin-top:2px;accent-color:var(--ce-accent)}

/* schema tree */
.cedb-db,.cedb-table{padding:0}
.cedb-db-name{display:flex;align-items:center;gap:6px;width:calc(100% - 8px);margin:0 4px;padding:8px 6px 3px;border:0;border-radius:5px;background:transparent;color:var(--ce-fg-3);font:inherit;font-size:11px;font-weight:600;text-align:left;cursor:pointer}
.cedb-db-name:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.cedb-db-on{color:var(--ce-fg-2)}
.cedb-db-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-db-hint{font-weight:400;font-size:10px;color:var(--ce-fg-3);margin-left:auto}
.cedb-table-row{display:flex;align-items:center;gap:6px;width:calc(100% - 8px);margin:0 4px;min-height:26px;padding:0 6px 0 10px;border:0;border-radius:6px;background:transparent;color:var(--ce-fg-2);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.cedb-table-row:hover{background:var(--ce-fill);color:var(--ce-fg)}
.cedb-table-on,.cedb-table-on:hover{background:var(--ce-accent-soft);color:var(--ce-fg);box-shadow:inset 2px 0 0 var(--ce-accent)}
.cedb-kind{flex:none;font-size:10px;color:var(--ce-fg-3);width:12px;text-align:center}
.cedb-table-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ce-mono)}
.cedb-cols{margin:0;padding:0 8px 4px 22px;list-style:none;min-width:0;overflow:hidden}
.cedb-col{display:flex;align-items:center;gap:6px;padding:1px 0;font-size:10.5px;color:var(--ce-fg-3);font-family:var(--ce-mono);min-width:0;overflow:hidden}
.cedb-col-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ce-fg-2)}
.cedb-col-type{flex:0 1 auto;font-size:9.5px;color:var(--ce-fg-3);max-width:62px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-pk,.cedb-nn{flex:none;font-size:9px;font-weight:700;padding:0 3px;border-radius:3px}
.cedb-pk{color:var(--ce-warn);background:var(--ce-warn-soft)}
.cedb-nn{color:var(--ce-fg-3);background:var(--ce-fill)}
.cedb-nopk{font-size:10px;color:var(--ce-fg-3);padding-left:28px;font-style:italic}

/* ---- main column ---- */
.cedb-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;background:var(--ce-bg)}
.cedb-tabs{flex:none;display:flex;align-items:center;gap:2px;height:37px;padding:5px 8px;overflow-x:auto;border-bottom:1px solid var(--ce-line);background:var(--ce-bg);scrollbar-width:none}
.cedb-tabs::-webkit-scrollbar{display:none}
.cedb-tab{display:flex;align-items:center;gap:2px;flex:none;max-width:210px;height:27px;padding:0 3px 0 9px;border:0;border-radius:7px;color:var(--ce-fg-3);background:transparent}
.cedb-tab:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.cedb-tab-on,.cedb-tab-on:hover{background:var(--ce-fill-strong);color:var(--ce-fg);box-shadow:none}
.cedb-tab-label{display:flex;align-items:center;gap:5px;min-width:0;height:100%;padding:0 0 0 1px;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-tab-kind{font-size:10px;color:var(--ce-fg-3)}
.cedb-tab-close{border:0;background:transparent;color:inherit;font-size:10px;cursor:pointer;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;opacity:0}
.cedb-tab:hover .cedb-tab-close,.cedb-tab-on .cedb-tab-close{opacity:.65}
.cedb-tab-close:hover{opacity:1;background:var(--ce-fill-strong);color:var(--ce-fg)}
.cedb-tab-add{border:0;background:transparent;color:var(--ce-fg-3);font-size:15px;cursor:pointer;width:26px;height:26px;border-radius:6px;flex:none}
.cedb-tab-add:hover{background:var(--ce-fill);color:var(--ce-fg)}
.cedb-tabbody{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}

/* ---- SQL editor ---- */
.cedb-editor{flex:none;display:flex;flex-direction:column}
.cedb-editor-bar{display:flex;align-items:center;gap:6px;padding:10px 10px 6px}
.cedb-conn-select{height:28px;font-size:12px;max-width:240px;background:var(--ce-fill);color:var(--ce-fg);border:1px solid var(--ce-line);border-radius:6px;padding:0 6px}
.cedb-conn-select:hover{border-color:var(--ce-line)}
.cedb-conn-select:focus{border-color:var(--ce-accent);outline:none}
.cedb-run{flex:none;height:28px;padding:0 12px;font-size:12px;font-weight:600}
.cedb-kbd{font-size:10px;color:var(--ce-fg-3);font-family:var(--ce-mono);margin-left:auto;white-space:nowrap}
.cedb-sql{min-height:88px;max-height:34vh;resize:vertical;margin:0 10px 10px;padding:10px 12px;border:1px solid var(--ce-line);border-radius:var(--ce-radius);background:var(--ce-fill);color:var(--ce-fg);font-family:var(--ce-mono);font-size:12.5px;line-height:1.6;outline:none;tab-size:2}
.cedb-sql::placeholder{color:var(--ce-fg-3)}
.cedb-sql:hover{border-color:var(--ce-line)}
.cedb-sql:focus{border-color:var(--ce-accent);background:var(--ce-bg);box-shadow:0 0 0 3px var(--ce-accent-softer)}
.cedb-ctx-row{display:flex;align-items:center;gap:6px;padding:1px 10px 8px;flex-wrap:wrap}
.cedb-ctx{padding:2px 7px;border-radius:5px;background:var(--ce-fill);font-size:11px;color:var(--ce-fg-3);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ce-mono)}
.cedb-ctx-strong{color:var(--ce-fg-2);font-weight:600}
.cedb-ctx-dim{color:var(--ce-fg-3)}

/* ---- result area ---- */
.cedb-result-head{flex:none;display:flex;align-items:center;gap:6px;padding:6px 12px;font-size:11px;color:var(--ce-fg-3);min-height:30px;flex-wrap:nowrap;white-space:nowrap;border-top:1px solid var(--ce-line);border-bottom:1px solid var(--ce-line);background:var(--ce-bg)}
.cedb-result-head .ce-tool,.cedb-result-head .ce-sk-btn{flex:0 0 auto;white-space:nowrap}
.cedb-result-hint{font-size:11px;color:var(--ce-fg-3)}
.cedb-tablebar{flex:none;display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--ce-line)}
.cedb-tablebar-name{font-size:12px;font-weight:600;color:var(--ce-fg);font-family:var(--ce-mono)}
.cedb-tablebar-filter{max-width:220px;height:26px;font-size:12px}
.cedb-grid-wrap{flex:1;min-height:0;overflow:auto;padding:0}
.cedb-grid{width:100%;border-collapse:collapse;font-size:12px;font-family:var(--ce-mono);border:0}
.cedb-grid th{position:sticky;top:0;z-index:1;text-align:left;padding:0 8px;height:30px;background:var(--ce-s1);border-bottom:1px solid var(--ce-line);color:var(--ce-fg-3);font-weight:600;white-space:nowrap;font-size:11px;font-family:inherit}
.cedb-grid-sortable{cursor:pointer}
.cedb-grid-sortable:hover{color:var(--ce-fg)}
.cedb-grid-sorted{color:var(--ce-accent)}
.cedb-grid-gutter{color:var(--ce-fg-3);text-align:right;padding-right:8px!important;user-select:none;white-space:nowrap;background:var(--ce-s1);font-variant-numeric:tabular-nums}
.cedb-grid .cedb-grid-row td{height:26px;line-height:25px;padding-top:0;padding-bottom:0}
.cedb-grid-td{padding:0 8px;border-bottom:1px solid var(--ce-line);color:var(--ce-fg);max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.cedb-grid tbody tr:hover td{background:var(--ce-fill)}
.cedb-grid tbody tr:last-child td{border-bottom:0}
.cedb-null{color:var(--ce-fg-3);font-style:italic}
.cedb-grid-editable{cursor:text}
.cedb-grid-editable:focus{outline:2px solid var(--ce-accent);outline-offset:-2px;background:var(--ce-accent-softer)}
.cedb-addrow td{color:var(--ce-fg-3);cursor:pointer}
.cedb-addrow:hover td{color:var(--ce-accent);background:var(--ce-accent-softer)}
.cedb-addrow-label{font-family:inherit;font-size:11px}
.cedb-del-armed{color:var(--ce-bad)!important}
.cedb-pager{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:8px;height:30px;padding:0 12px;border-top:1px solid var(--ce-line);font-size:11px;color:var(--ce-fg-3)}
.cedb-pager-text{font-family:var(--ce-mono);font-variant-numeric:tabular-nums}
.cedb-pager-info{font-size:11px;color:var(--ce-fg-3)}
.cedb-stop{color:var(--ce-bad);border-color:transparent}

/* ---- placeholder and empty result ---- */
.cedb-placeholder{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:28px;text-align:center}
.cedb-placeholder-title{font-size:13px;font-weight:600;color:var(--ce-fg-2)}
.cedb-placeholder-hint{font-size:12px;color:var(--ce-fg-3);max-width:320px;line-height:1.65}
.cedb-placeholder-small{flex:1;display:flex;align-items:center;justify-content:center;padding:20px;font-size:12px;color:var(--ce-fg-3)}
.cedb-empty-result{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px;text-align:center}
.cedb-empty-icon{font-size:20px;color:var(--ce-fg-3);opacity:.8}
.cedb-empty-title{font-size:12.5px;color:var(--ce-fg-2)}
.cedb-empty-hint{font-size:11.5px;color:var(--ce-fg-3)}
.cedb-error{margin:8px 12px;padding:8px 10px;border-radius:var(--ce-radius);font-size:12px;white-space:pre-wrap;color:var(--ce-bad);background:var(--ce-bad-soft);font-family:var(--ce-mono);line-height:1.55}
.cedb-pad{padding:8px 12px}
.cedb-detect{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--ce-fg-2);margin:-2px 0 2px}
.cedb-detect-miss{color:var(--ce-warn)}
.cedb-detect-note{color:var(--ce-bad)}
.cedb-advanced{align-self:flex-start;border:0;background:transparent;color:var(--ce-accent);font:inherit;font-size:11.5px;cursor:pointer;padding:2px 0}

/* ---- dialogs and popovers ---- */
.cedb-dialog{position:absolute;top:52px;left:50%;transform:translateX(-50%);width:min(440px,calc(100% - 32px));z-index:20;display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:var(--ce-radius-lg);background:var(--ce-bg);border:1px solid var(--ce-line-strong);box-shadow:var(--ce-shadow-2)}
.cedb-dialog-wide{width:min(920px,calc(100vw - 48px));max-height:86vh;overflow:auto}
.cedb-dialog-head{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;min-width:0}
.cedb-dialog-head .cedb-dialog-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}
.cedb-dialog-head .ce-tool{flex:0 0 auto}
.cedb-dialog-title{margin:0;font-size:14px;font-weight:600;color:var(--ce-fg)}
.cedb-dialog-hint{margin:0;font-size:11.5px;color:var(--ce-fg-3);line-height:1.55}
.cedb-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
.cedb-dialog-error{font-size:11.5px;color:var(--ce-bad);overflow-wrap:anywhere}
.cedb-field{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--ce-fg-3)}
.cedb-field-row{display:flex;gap:8px}
.cedb-field-row .cedb-field{flex:1}
.cedb-field-narrow{flex:0 0 90px!important}
.cedb-password{display:flex;align-items:center;gap:4px}
.cedb-password .ce-input{flex:1 1 auto;min-width:0}

/* driver picker */
.cedb-wtabs{display:flex;gap:2px;padding:2px 0 8px;margin-bottom:2px;border-bottom:1px solid var(--ce-line)}
.cedb-wtab{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:0;border-radius:6px;background:transparent;color:var(--ce-fg-3);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.cedb-wtab:hover{background:var(--ce-fill);color:var(--ce-fg-2)}
.cedb-wtab-on,.cedb-wtab-on:hover{background:var(--ce-fill-strong);color:var(--ce-fg);box-shadow:none;font-weight:600}
.cedb-wtab-dot{width:6px;height:6px;border-radius:50%;background:var(--ce-accent)}
.cedb-pick-tools{display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.cedb-pick-tools .ce-input{flex:1 1 200px;height:30px}
.cedb-cat{padding:4px 10px;border-radius:999px;border:1px solid transparent;background:var(--ce-fill);color:var(--ce-fg-3);font-size:11px;cursor:pointer}
.cedb-cat:hover{color:var(--ce-fg-2)}
.cedb-cat-on,.cedb-cat-on:hover{background:var(--ce-accent-soft);color:var(--ce-accent);border-color:transparent;font-weight:600}
.cedb-color-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.cedb-conn-note{color:var(--ce-fg-3);font-size:10px;flex:0 0 auto}
.cedb-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:2px 0}
.cedb-pick-card{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;border:1px solid var(--ce-line);border-radius:10px;background:transparent;color:var(--ce-fg);cursor:pointer}
.cedb-pick-card:hover{border-color:var(--ce-accent-line);background:var(--ce-accent-softer)}
.cedb-pick-on,.cedb-pick-on:hover{border-color:var(--ce-accent);background:var(--ce-accent-soft);box-shadow:none}
.cedb-pick-glyph{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9px;background:var(--ce-fill);font-size:12px;font-weight:700;letter-spacing:.02em;font-family:var(--ce-mono);color:var(--ce-fg-2)}
.cedb-pick-card:hover .cedb-pick-glyph{color:var(--ce-fg)}
.cedb-pick-label{font-size:12px;font-weight:600;color:var(--ce-fg)}
.cedb-pick-note{font-size:10px;color:var(--ce-fg-3);text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-colors{display:flex;gap:6px;align-items:center;height:30px}
.cedb-colors .cedb-color{width:18px;height:18px}
.cedb-color{width:16px;height:16px;border-radius:50%;border:1px solid var(--ce-line);cursor:pointer;padding:0}
.cedb-color-none{background:transparent;position:relative}
.cedb-color-none::after{content:"";position:absolute;inset:2px;border-radius:50%;border-top:1.5px solid var(--ce-fg-3);transform:rotate(45deg)}
.cedb-color-on{outline:2px solid var(--ce-accent);outline-offset:1px}

/* driver diagnostics, ER, plan, menus */
.cedb-dbx{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 10px;margin-bottom:8px;border:1px solid var(--ce-line);border-radius:var(--ce-radius);background:var(--ce-s1)}
.cedb-dbx-title{font-size:12px;font-weight:600;color:var(--ce-fg)}
.cedb-dbx-info{font-size:11px;color:var(--ce-fg-2)}
.cedb-dbx-ok{font-size:11px;color:var(--ce-ok)}
.cedb-dbx-bad{font-size:11px;color:var(--ce-bad)}
.cedb-driver-list{display:flex;flex-direction:column;gap:8px;max-height:56vh;overflow:auto}
.cedb-driver-card{border:1px solid var(--ce-line);border-radius:var(--ce-radius);padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.cedb-driver-head{display:flex;align-items:center;gap:8px;font-size:12px}
.cedb-driver-caps{display:flex;flex-wrap:wrap;gap:4px}
.cedb-cap{font-size:10px;padding:1px 6px;border-radius:4px;background:var(--ce-fill);color:var(--ce-fg-3);border:0}
.cedb-cap-on{color:var(--ce-fg-2);background:var(--ce-fill-strong)}
.cedb-driver-alts{display:flex;flex-direction:column;gap:2px}
.cedb-driver-alt{display:flex;gap:8px;font-size:11px;align-items:baseline}
.cedb-driver-impl{flex:0 0 64px;color:var(--ce-fg-2)}
.cedb-driver-ok{color:var(--ce-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-driver-no{color:var(--ce-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-er-scroll{overflow:auto;max-height:60vh;border:1px solid var(--ce-line);border-radius:var(--ce-radius);background:var(--ce-bg)}
.cedb-er-link{fill:none;stroke:var(--ce-line-strong);stroke-width:1.2}
.cedb-er-box{cursor:pointer}
.cedb-er-box rect{fill:var(--ce-s1);stroke:var(--ce-line)}
.cedb-er-box:hover rect{stroke:var(--ce-accent)}
.cedb-er-title{fill:var(--ce-fg);font-size:12px;font-family:var(--ce-mono)}
.cedb-er-cols{fill:var(--ce-fg-3);font-size:10px;font-family:var(--ce-mono)}
.cedb-plan{max-height:56vh;overflow:auto;font-family:var(--ce-mono);font-size:12px}
.cedb-plan-row{padding:4px 0;border-bottom:1px solid var(--ce-line);color:var(--ce-fg-2)}
.cedb-import-text{width:100%;box-sizing:border-box}
.cedb-export{position:relative;display:inline-flex;align-items:center}
.cedb-export .ce-sk-btn{min-height:24px;font-size:11px;padding:0 7px}
.cedb-menu{position:absolute;top:100%;right:0;z-index:20;margin-top:4px;display:flex;flex-direction:column;min-width:140px;padding:5px;background:var(--ce-s1);border:1px solid var(--ce-line-strong);border-radius:8px;box-shadow:var(--ce-shadow-2)}
.cedb-menu-row{text-align:left;padding:6px 8px;border:0;background:transparent;color:var(--ce-fg-2);font:inherit;font-size:12px;border-radius:5px;cursor:pointer}
.cedb-menu-row:hover{background:var(--ce-fill);color:var(--ce-fg)}

/* history and cell detail */
.cedb-history{position:absolute;right:10px;top:48px;bottom:10px;width:min(380px,66%);z-index:15;display:flex;flex-direction:column;border-radius:var(--ce-radius-lg);overflow:hidden;background:var(--ce-s1);border:1px solid var(--ce-line-strong);box-shadow:var(--ce-shadow-2)}
.cedb-history-head{flex:none;display:flex;align-items:center;justify-content:space-between;padding:9px 10px 9px 12px;border-bottom:1px solid var(--ce-line);font-size:12px;font-weight:600;color:var(--ce-fg-2)}
.cedb-history-row{display:flex;align-items:center;gap:8px;padding:7px 12px;border:0;border-bottom:1px solid var(--ce-line);background:transparent;color:var(--ce-fg-2);font-size:11.5px;text-align:left;cursor:pointer;font-family:var(--ce-mono)}
.cedb-history-row:hover{background:var(--ce-fill);color:var(--ce-fg)}
.cedb-history-sql{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-history-ms{flex:none;color:var(--ce-fg-3);font-variant-numeric:tabular-nums}
.cedb-cell-detail{position:absolute;right:20px;bottom:20px;width:min(520px,calc(100% - 40px));max-height:50%;z-index:20;display:flex;flex-direction:column;border-radius:var(--ce-radius-lg);overflow:hidden;background:var(--ce-s1);border:1px solid var(--ce-line-strong);box-shadow:var(--ce-shadow-2)}
.cedb-cell-head{flex:none;display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 12px;border-bottom:1px solid var(--ce-line);font-size:12px;color:var(--ce-fg-2)}
.cedb-cell-title{font-family:var(--ce-mono);color:var(--ce-fg)}
.cedb-cell-body{flex:1;min-height:0;overflow:auto;margin:0;padding:12px;font-family:var(--ce-mono);font-size:12px;line-height:1.65;white-space:pre-wrap;word-break:break-all;color:var(--ce-fg)}

/* ============================ gRPC ============================ */
.cerpc-root{display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--ce-bg)}
.cerpc-toolbar{flex:none;display:flex;align-items:flex-end;gap:10px;padding:12px 12px 10px;border-bottom:1px solid var(--ce-line);background:var(--ce-bg);flex-wrap:wrap}
.cerpc-field{flex:1 1 200px;min-width:140px;display:flex;flex-direction:column;gap:4px}
.cerpc-label{font-size:10.5px;color:var(--ce-fg-3);font-weight:500}
.cerpc-input{height:30px;font-size:12px;font-family:var(--ce-mono)}
.cerpc-onboard{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:32px 24px;text-align:center;background:var(--ce-bg)}
.cerpc-onboard-icon{display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:var(--ce-fill);border:1px solid var(--ce-line);color:var(--ce-fg-2)}
.cerpc-onboard-title{margin:2px 0 0;font-size:15px;font-weight:600;color:var(--ce-fg)}
.cerpc-onboard-body{margin:0;max-width:440px;font-size:12px;line-height:1.7;color:var(--ce-fg-3)}
.cerpc-onboard-actions{display:flex;gap:8px;margin-top:6px}
.cerpc-onboard-recent{display:flex;flex-direction:column;gap:1px;margin-top:14px;padding-top:12px;border-top:1px solid var(--ce-line);width:min(440px,100%)}
.cerpc-onboard-recent-title{font-size:11px;color:var(--ce-fg-3);margin-bottom:4px;text-align:left}
.cerpc-onboard-recent-row{display:flex;align-items:baseline;width:100%;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:var(--ce-fg-2);font-family:var(--ce-mono);font-size:12px;text-align:left;cursor:pointer;overflow:hidden}
.cerpc-onboard-recent-row:hover{background:var(--ce-fill);color:var(--ce-fg)}
.cerpc-resp-empty{display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:12px;color:var(--ce-fg-3)}
.cerpc-resp-empty-icon{font-size:14px;opacity:.8}

/* method rail */
.cerpc-body{flex:1;min-height:0;display:flex;overflow:hidden}
.cerpc-rail{flex:none;width:236px;min-width:160px;display:flex;flex-direction:column;gap:1px;overflow-y:auto;border-right:1px solid var(--ce-line);background:var(--ce-bg);padding:6px 4px}
.cerpc-service{padding:0 0 4px}
.cerpc-service-name{padding:10px 8px 3px;font-size:11px;font-weight:600;color:var(--ce-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cerpc-method{display:flex;align-items:center;gap:7px;width:100%;min-height:27px;padding:0 8px 0 12px;border:0;border-radius:6px;background:transparent;color:var(--ce-fg-2);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.cerpc-method:hover{background:var(--ce-fill);color:var(--ce-fg)}
.cerpc-method-on,.cerpc-method-on:hover{background:var(--ce-accent-soft);color:var(--ce-fg);box-shadow:inset 2px 0 0 var(--ce-accent)}
.cerpc-arrow{flex:none;font-size:10px;color:var(--ce-fg-3);font-family:var(--ce-mono)}
.cerpc-method-on .cerpc-arrow{color:var(--ce-accent)}
.cerpc-method-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ce-mono)}
.cerpc-files{margin-top:auto;padding:10px 12px;border-top:1px solid var(--ce-line)}
.cerpc-file{font-size:10px;color:var(--ce-fg-3);font-family:var(--ce-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* request and response panes */
.cerpc-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.cerpc-pane{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.cerpc-request{flex:0 1 auto;max-height:62%;overflow:hidden}
.cerpc-request .cerpc-actions{flex:none}
.cerpc-response{flex:1 1 auto;border-top:1px solid var(--ce-line);background:var(--ce-bg)}
.cerpc-pane-head{flex:none;display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:11px;color:var(--ce-fg-3);min-height:30px;flex-wrap:wrap}
.cerpc-pane-title{font-weight:600;color:var(--ce-fg-2);font-size:11px}
.cerpc-address{display:flex;gap:6px;align-items:center;min-width:0}
.cerpc-scheme{width:100px;height:28px;font-size:12px;padding:0 6px;flex:0 0 auto}
.cerpc-host{min-width:0;flex:1 1 auto}
.cerpc-proto{position:relative}
.cerpc-proto-row{display:flex;gap:6px;align-items:center}
.cerpc-picker{position:absolute;top:100%;left:0;z-index:30;margin-top:4px;padding:8px;display:flex;flex-direction:column;gap:8px;width:min(600px,calc(100vw - 40px));background:var(--ce-s1);border:1px solid var(--ce-line-strong);border-radius:var(--ce-radius-lg);box-shadow:var(--ce-shadow-2)}
.cerpc-picker-floating{position:fixed;margin:0}
.cerpc-picker-input{height:30px;font-size:12.5px}
.cerpc-picker-list{max-height:340px;overflow:auto;display:flex;flex-direction:column;gap:1px}
.cerpc-picker-row{display:flex;align-items:baseline;gap:0;width:100%;min-height:28px;text-align:left;padding:5px 8px;border:0;border-radius:5px;background:transparent;color:var(--ce-fg);font-size:12.5px;line-height:1.5;font-family:var(--ce-mono);cursor:pointer}
.cerpc-picker-dir{color:var(--ce-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto;min-width:0}
.cerpc-picker-name{color:var(--ce-fg);flex:0 0 auto;white-space:nowrap}
.cerpc-picker-row:hover,.cerpc-picker-row-on{background:var(--ce-fill)}
.cerpc-picker-empty{font-size:12px;color:var(--ce-fg-3);padding:6px 8px;display:flex;flex-direction:column;gap:4px}
.cerpc-picker-empty-title{color:var(--ce-fg-2)}
.cerpc-picker-empty-hint{font-size:11px;line-height:1.6}
.cerpc-picker-foot{font-size:11px;color:var(--ce-fg-3);padding:0 4px}
.cerpc-inline{display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;color:var(--ce-fg-2)}
.cerpc-timeout{width:70px;height:26px;font-size:11px;padding:0 6px}
.cerpc-json{flex:0 1 auto;min-height:96px;max-height:52vh;overflow:auto;resize:vertical;font-family:var(--ce-mono)}
.cerpc-json-bad{border-color:var(--ce-bad)!important;box-shadow:0 0 0 3px var(--ce-bad-soft)!important}
.cerpc-json-error{padding:0 12px 8px;font-size:11px;color:var(--ce-bad);font-family:var(--ce-mono)}
.cerpc-meta-head{flex:none;display:flex;align-items:center;gap:8px;padding:4px 12px}
.cerpc-meta-empty{padding:0 12px 8px;font-size:11px;color:var(--ce-fg-3)}
.cerpc-meta-list{flex:none;display:flex;flex-direction:column;gap:4px;padding:0 12px 4px;max-height:24vh;overflow:auto}
.cerpc-meta-row{display:flex;align-items:center;gap:6px}
.cerpc-meta-name{flex:0 0 150px;height:26px;font-size:11px;font-family:var(--ce-mono)}
.cerpc-meta-value{flex:1;height:26px;font-size:11px;font-family:var(--ce-mono)}
.cerpc-actions{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px 12px}
.cerpc-actions .ce-sk-btn{min-height:32px;padding:0 14px;font-size:12.5px}
.cerpc-actions .ce-sk-primary{background:var(--dsw-alias-button-primary-fill,var(--ce-accent));color:var(--ce-on-accent);font-weight:600}
.cerpc-status-msg{font-size:11px;color:var(--ce-warn);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40%}
.cerpc-result{flex:1;min-height:0;overflow:auto;padding:8px 12px 12px;display:flex;flex-direction:column;gap:8px}
.cerpc-message{border:1px solid var(--ce-line);border-radius:var(--ce-radius);overflow:hidden;background:var(--ce-bg)}
.cerpc-message-head{padding:5px 10px;font-size:10px;color:var(--ce-fg-3);background:var(--ce-s1);border-bottom:1px solid var(--ce-line)}
.cerpc-message-body{margin:0;padding:10px 12px;font-family:var(--ce-mono);font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:var(--ce-fg)}
.cerpc-trailers{border-top:1px solid var(--ce-line);padding-top:8px;display:flex;flex-direction:column;gap:3px}
.cerpc-trailer{display:flex;gap:8px;font-size:11px;font-family:var(--ce-mono)}
.cerpc-trailer-name{flex:none;color:var(--ce-fg-3);min-width:110px}
.cerpc-trailer-value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ce-fg-2)}
.cerpc-hist{margin:0 8px 8px}
.cerpc-title{display:inline-flex;align-items:center;gap:4px;font-family:var(--ce-mono);font-size:11.5px}
`;
