/** The workbench's markup: a pure function of the state object.
 *
 * Every handler and every value comes from `useWorkbench`, so this module holds
 * no state of its own and can be read top to bottom like a template.
 */

import { Fragment, h } from "../react.js";
import { ResultGrid } from "./grid.js";
import { AddRowDialog, DriverManager, ErDiagram, ExplainPanel, ImportDialog } from "./dialogs.js";
import { renderRail } from "./rail.js";
import { CONNECTION_COLORS, CATEGORIES, defaultPort, implSuffix } from "./meta.js";
import { driverLabel } from "../dbconnect.js";
import { formatCell } from "./grid.js";
import { PAGE_SIZE, QUERY_PAGE, tableSql } from "./format.js";
import { IconRefresh } from "../icons.js";

/**
 * @param wb - everything `useWorkbench` returns
 * @returns the panel tree, or the "no session" placeholder
 */
export function renderWorkbench(wb) {
	const { DbView, absolute, activeConn, activeDb, activeTab, activeTabId, allowModule, anchor, applyAddress, blob, body, canConnect, cancelQuery, category, cellDetail, cellEdit, closeTab, collapsedDbs, commitCell, conn, connectOpen, connectParams, connectProfile, connectRef, connections, copyCommand, copyResult, counts, csv, cwd, database, databases, databasesOf, dbxState, defaultNow, detailRef, dir, doConnect, doDisconnect, doTest, driver, driverReady, drivers, editingProfileId, entries, existing, expanded, explainState, exportOpen, exportResult, fetchRows, fetched, filter, forgetProfile, form, history, historyOpen, id, index, installDriverModule, keep, key, known, label, list, loadRows, modal, ms, needle, next, notice, onKeyDown, openConnect, openConns, openQueryTab, openTab, openTable, params, parsed, patchTab, pendingDelete, pickCategory, pickQuery, pickableDrivers, pkColumn, pkIndex, pkValue, probeDrivers, profileErrors, profileRevision, profiles, refreshSchema, rememberConnection, removeRow, res, result, runDbxImport, runExplain, importRows, insertRow, runMutation, runQuery, saveProfile, schema, schemaBusy, schemaErrors, schemaFor, schemas, selectDatabase, setActiveConn, setActiveDb, setActiveTabId, setAllowModule, setCellDetail, setCellEdit, setCollapsedDbs, setConnectOpen, setConnections, setDbxState, setDriver, setDrivers, setEditingProfileId, setExpanded, setExplainState, setExportOpen, setFilter, setForm, setHistory, setHistoryOpen, setModal, setNotice, setOpenConns, setPendingDelete, setPickCategory, setPickQuery, setProfileErrors, setProfiles, setSaveProfile, setSchemaBusy, setSchemaError, setSchemas, setShowPassword, setStep, setTab, setTabs, setTestState, showPassword, sortBy, sql, sqlRef, started, step, t, tab, tableEntry, tabs, target, testState, text, toggleTable, token, url, useSavedProfile, value } = wb;
	if (!cwd) return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));

	return h("div", { className: "ce-root cedb-root", onKeyDown },
		// ---- toolbar -------------------------------------------------------------------
		h("div", { className: "cedb-toolbar" },
			h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: openConnect }, `＋ ${t("db.connect")}`),
			h("button", { type: "button", className: "ce-sk-btn", title: t("db.driversHint"), onClick: () => setModal({ kind: "drivers" }) }, t("db.driversButton")),
			h("button", { type: "button", className: "ce-sk-btn", disabled: !schema, title: t("db.erHint"), onClick: () => setModal({ kind: "er" }) }, t("db.erButton")),
			h("button", { type: "button", className: "ce-sk-btn", onClick: () => openQueryTab("") }, t("db.newQuery")),
			activeConn ? h("button", { type: "button", className: "ce-tool", title: t("db.refresh"), "aria-label": t("db.refresh"), onClick: () => void refreshSchema() }, h(IconRefresh, { size: 14 })) : null,
			h("span", { className: "ce-spacer" }),
			schema ? h("span", { className: "cedb-chip" }, `${counts.tables} ${t("db.tables")}`) : null,
			schema ? h("span", { className: "cedb-chip" }, `${counts.views} ${t("db.views")}`) : null,
			notice && !connectOpen ? h("span", { className: "cedb-notice" }, notice) : null,
		),
		h("div", { className: "cedb-body" },
			renderRail({
				t,
				profiles,
				connections,
				databasesFor: databasesOf,
				schemas,
				openConns,
				collapsedDbs,
				expanded,
				activeConn,
				activeDb,
				activeTableKey: activeTab?.key ?? "",
				profileErrors,
				schemaBusy,
				schemaErrors,
				filter,
				onFilter: setFilter,
				onConnect: (profile) => void connectProfile(profile),
				onForget: (profile) => void forgetProfile(profile),
				onToggleConn: (connection, open) => {
					setActiveConn(connection.id);
					setOpenConns((current) => ({ ...current, [connection.id]: open }));
					// Retry after a stale/closed-connection error; the Host rebuilds the
					// mysql session on demand now, so expanding is a natural retry.
					if (open && (!schemas[connection.id] || schemaErrors[connection.id])) void refreshSchema(connection.id);
				},
				onDisconnect: (id) => void doDisconnect(id),
				onSelectDatabase: (connId, database) => {
					void selectDatabase(connId, database);
					setCollapsedDbs((current) => {
						const key = `${connId}:${database}`;
						return { ...current, [key]: current[key] !== true };
					});
				},
				onSelectTable: (connId, database, entry) => {
					toggleTable(`${connId}:${database}:${entry.name}`);
					setActiveConn(connId);
					setActiveDb({ conn: connId, database });
					openTable(connId, database, entry);
				},
				onOpenQuery: (table) => openQueryTab(`SELECT * FROM "${String(table).replace(/"/g, '""')}" LIMIT 100;`) }),
			// ---- main ------------------------------------------------------------------
			h("section", { className: "cedb-main" },
				h("div", { className: "cedb-wtabs", role: "tablist" },
					tabs.map((tab) => h("div", { key: tab.id, className: `cedb-tab${tab.id === activeTabId ? " cedb-tab-on" : ""}` },
						h("button", { type: "button", className: "cedb-tab-label", role: "tab", "aria-selected": tab.id === activeTabId, onClick: () => setActiveTabId(tab.id), title: tab.kind === "table" ? `${tab.table} · ${tab.database}` : tab.sql },
							h("span", { className: "cedb-tab-kind" }, tab.kind === "table" ? "▤" : "⌘"),
							tab.title),
						h("button", { type: "button", className: "cedb-tab-close", title: t("close"), onClick: () => closeTab(tab.id) }, "✕"),
					)),
					h("button", { type: "button", className: "cedb-tab-add", title: t("db.newQuery"), onClick: () => openQueryTab("") }, "＋"),
				),
				activeTab === null
					? h("div", { className: "cedb-placeholder" },
						h("div", { className: "cedb-placeholder-title" }, t("db.welcome")),
						h("div", { className: "cedb-placeholder-hint" }, t("db.welcomeHint")))
					: h("div", { className: "cedb-tabbody" },
						// ---- context chips: what this tab is pointed at ----------------
						h("div", { className: "cedb-ctx-row" },
							h("span", { className: "cedb-ctx" }, connections.find((entry) => entry.id === (activeTab.conn || activeConn))?.label ?? t("db.noConnectionCtx")),
							activeTab.database ? h("span", { className: "cedb-ctx" }, activeTab.database) : null,
							activeTab.table ? h("span", { className: "cedb-ctx cedb-ctx-strong" }, activeTab.table) : null,
							activeTab.result?.columns?.length ? h("span", { className: "cedb-ctx cedb-ctx-dim" }, `${activeTab.result.columns.length} ${t("db.columns")}`) : null,
							activeTab.result ? h("span", { className: "cedb-ctx cedb-ctx-dim" }, `${activeTab.result.rows?.length ?? 0} ${t("db.rows")}`) : null),
						// ---- query tab ----
						activeTab.kind === "query"
							? h(Fragment, null,
								h("div", { className: "cedb-editor" },
									h("div", { className: "cedb-editor-bar" },
										h("select", {
											className: "cedb-conn-select",
											value: activeTab.conn || activeConn,
											"aria-label": t("db.connections"),
											onChange: async (event) => {
												const value = event.target.value;
												if (!value.startsWith("profile:")) { patchTab(activeTab.id, { conn: value }); return; }
												const profile = profiles.find((entry) => entry.id === value.slice("profile:".length));
												if (!profile) return;
												const connected = await connectProfile(profile);
												if (connected) patchTab(activeTab.id, { conn: connected });
											} }, [
											...(connections.length === 0 ? [h("option", { key: "none", value: "" }, t("db.noConnectionCtx"))] : []),
											...connections.map((connection) => h("option", { key: connection.id, value: connection.id }, `${connection.driver} · ${connection.label}`)),
											// Saved but not open: picking one connects it (or asks for its
											// password) and binds this tab, instead of leaving an empty menu.
											...profiles
												.filter((profile) => !connections.some((connection) => connection.profileId === profile.id))
												.map((profile) => h("option", { key: `p-${profile.id}`, value: `profile:${profile.id}` }, `${t("db.savedPrefix")} · ${profile.label}`)),
										]),
										activeTab.loading
											? h("button", { type: "button", className: "ce-sk-btn cedb-run cedb-stop", onClick: () => void cancelQuery(activeTab) }, `■ ${t("db.stop")}`)
											: h("button", {
												type: "button",
												className: "ce-sk-btn ce-sk-primary cedb-run",
												disabled: !String(activeTab.sql ?? "").trim(),
												onClick: () => void runQuery(activeTab.id) }, `▶ ${t("db.run")}`),
										h("button", {
											type: "button",
											className: "ce-sk-btn",
											disabled: !String(activeTab.sql ?? "").trim() || activeTab.loading,
											title: t("db.explainHint"),
											onClick: runExplain }, t("db.explain")),
										h("button", { type: "button", className: "ce-sk-btn", title: t("db.history"), onClick: () => setHistoryOpen((v) => !v) }, t("db.history")),
										h("span", { className: "ce-spacer" }),
										h("span", { className: "cedb-kbd" }, "⌘/Ctrl+Enter"),
									),
									h("textarea", {
										className: "cedb-sql",
										ref: sqlRef,
										rows: 4,
										value: activeTab.sql ?? "",
										placeholder: t("db.sqlPlaceholder"),
										spellCheck: false,
										onChange: (event) => patchTab(activeTab.id, { sql: event.target.value }) }),
								),
								h("div", { className: "cedb-result-head" },
									activeTab.result
										? h(Fragment, null,
											h("span", { className: "cedb-chip" }, `${activeTab.result.rows?.length ?? 0} ${t("db.rows")}`),
											h("span", { className: "cedb-chip" }, `${activeTab.ms || activeTab.result.ms || 0} ms`),
											activeTab.result.truncated ? h("span", { className: "cedb-chip cedb-chip-warn" }, t("db.truncated")) : null,
											activeTab.result.changes !== undefined ? h("span", { className: "cedb-chip" }, `${activeTab.result.changes} ${t("db.affected")}`) : null,
											activeTab.result.columns?.length
												? h("span", { className: "cedb-export" },
													h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("db.export"), "aria-label": t("db.export"), onClick: () => setExportOpen((open) => !open) }, t("db.export")),
													exportOpen
														? h("div", { className: "cedb-menu" },
															h("button", { type: "button", className: "cedb-menu-row", onClick: () => { exportResult(activeTab.result, activeTab.title); setExportOpen(false); } }, "CSV"),
															h("button", { type: "button", className: "cedb-menu-row", onClick: () => { copyResult(activeTab, "json"); setExportOpen(false); } }, "JSON"),
															h("button", { type: "button", className: "cedb-menu-row", onClick: () => { copyResult(activeTab, "sql"); setExportOpen(false); } }, t("db.exportSql")))
														: null)
												: null,
										)
										: h("span", { className: "cedb-result-hint" }, t("db.runHint")),
								),
								activeTab.error ? h("div", { className: "cedb-error" }, activeTab.error) : null,
								activeTab.result
									? h(ResultGrid, { t, result: activeTab.result, onCell: setCellDetail })
									: h("div", { className: "cedb-empty-result" },
										h("span", { className: "cedb-empty-icon", "aria-hidden": "true" }, "▤"),
										h("div", { className: "cedb-empty-title" }, t("db.runHint")),
										activeTab.loading ? null : h("button", { type: "button", className: "ce-sk-btn", disabled: !String(activeTab.sql ?? "").trim(), onClick: () => void runQuery(activeTab.id) }, `▶ ${t("db.run")}`)),
							)
							// ---- table tab ----
							: h(Fragment, null,
								h("div", { className: "cedb-tablebar" },
									h("span", { className: "cedb-tablebar-name" }, `${activeTab.database}.${activeTab.table}`),
									h("input", {
										className: "ce-input cedb-tablebar-filter",
										placeholder: t("db.filterRows"),
										value: activeTab.filter,
										onChange: (event) => patchTab(activeTab.id, { filter: event.target.value, offset: 0 }),
										onKeyDown: (event) => { if (event.key === "Enter") void loadRows(activeTab.id, { filter: event.currentTarget.value, offset: 0 }); } }),
									h("button", { type: "button", className: "ce-sk-btn", disabled: activeTab.loading, title: t("db.refresh"), onClick: () => void loadRows(activeTab.id) }, activeTab.loading ? t("loading") : t("db.refresh")),
									h("button", { type: "button", className: "ce-sk-btn", title: t("db.sqlForTable"), onClick: () => openQueryTab(`${tableSql(activeTab.table, { ...activeTab, limit: PAGE_SIZE, driver: connections.find((entry) => entry.id === activeTab.conn)?.driver }).replace(/;\s*$/, "")};`) }, "SQL"),
									h("span", { className: "ce-spacer" }),
									activeTab.result ? h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("db.export"), onClick: () => exportResult(activeTab.result, activeTab.table) }, "CSV") : null,
									h("button", {
										type: "button",
										className: "ce-sk-btn",
										title: t("db.importHint"),
										onClick: () => setModal({ kind: "import", table: activeTab.table, conn: activeTab.conn || activeConn, onDone: () => void loadRows(activeTab.id) }) }, t("db.import")),
									h("button", {
										type: "button",
										className: "ce-sk-btn",
										title: t("db.addRowHint"),
										onClick: () => setModal({
											kind: "addrow",
											table: activeTab.table,
											database: activeTab.database,
											columns: tableEntry?.columns ?? [],
											conn: activeTab.conn || activeConn,
											onDone: () => void loadRows(activeTab.id) }) }, `＋ ${t("db.addRow")}`),
									pkColumn === "" ? h("span", { className: "cedb-nopk", title: t("db.noPkHint") }, t("db.noPk")) : null,
								),
								activeTab.error ? h("div", { className: "cedb-error" }, activeTab.error) : null,
								activeTab.result && (activeTab.result.hasMore || activeTab.offset > 0)
									? h("div", { className: "cedb-pager" },
										h("button", { type: "button", className: "ce-sk-btn", disabled: activeTab.loading || (activeTab.offset ?? 0) <= 0, onClick: () => void runQuery(activeTab.id, Math.max((activeTab.offset ?? 0) - QUERY_PAGE, 0)) }, "‹ " + t("db.prevPage")),
										h("span", { className: "cedb-pager-info" }, `${t("db.rows")} ${(activeTab.offset ?? 0) + 1}–${(activeTab.offset ?? 0) + (activeTab.result.rows?.length ?? 0)}`),
										h("button", { type: "button", className: "ce-sk-btn", disabled: activeTab.loading || !activeTab.result.hasMore, onClick: () => void runQuery(activeTab.id, (activeTab.offset ?? 0) + QUERY_PAGE) }, t("db.nextPage") + " ›"))
									: null,
								activeTab.result
									? h(ResultGrid, {
										t,
										result: activeTab.result,
										onCell: setCellDetail,
										onSort: (column) => sortBy(activeTab.id, column),
										order: activeTab.order,
										dir: activeTab.dir,
										pkColumn,
										onEditCell: (rowIndex, column, value) => void commitCell(rowIndex, column, value),
										onDeleteRow: (rowIndex) => void removeRow(rowIndex),
										pendingDelete })
									: h("div", { className: "cedb-empty-result" },
										h("span", { className: "cedb-empty-icon", "aria-hidden": "true" }, "▤"),
										h("div", { className: "cedb-empty-title" }, activeTab.loading ? t("loading") : t("db.reloadTable")),
										h("div", { className: "cedb-empty-hint" }, t("db.reloadTableHint")),
										activeTab.loading ? null : h("button", { type: "button", className: "ce-sk-btn", onClick: () => void loadRows(activeTab.id) }, t("db.refresh"))),
								h("div", { className: "cedb-pager" },
									h("button", {
										type: "button",
										className: "ce-tool ce-tiny",
										disabled: activeTab.offset === 0 || activeTab.loading,
										onClick: () => { const offset = Math.max(0, activeTab.offset - PAGE_SIZE); patchTab(activeTab.id, { offset }); void loadRows(activeTab.id, { offset }); } }, "←"),
									h("span", { className: "cedb-pager-text" },
										`${activeTab.offset + 1}–${Math.min(activeTab.offset + PAGE_SIZE, activeTab.result?.total ?? 0)} / ${activeTab.result?.total ?? 0}`),
									h("button", {
										type: "button",
										className: "ce-tool ce-tiny",
										disabled: activeTab.loading || activeTab.offset + PAGE_SIZE >= (activeTab.result?.total ?? 0),
										onClick: () => { const offset = activeTab.offset + PAGE_SIZE; patchTab(activeTab.id, { offset }); void loadRows(activeTab.id, { offset }); } }, "→"),
								),
							),
					),
			),
		),
		// ---- modal layer: drivers / ER / plan / import ------------------------------------
		modal === null
			? null
			: modal.kind === "drivers"
				? h(DriverManager, { t, drivers, dbxState, onImportDbx: runDbxImport, onInstall: installDriverModule, onCopy: copyCommand, onRedetect: () => void probeDrivers(true), onClose: () => setModal(null) })
				: modal.kind === "er"
					? h(ErDiagram, { t, schema, onOpenTable: (table) => {
						setModal(null);
						const database = activeDb.database || schema?.current || "";
						const entry = schema?.databases?.find((entry) => entry.name === database)?.tables?.find((entry) => entry.name === table);
						if (entry) openTable(activeDb.conn || activeConn, database, entry);
					}, onClose: () => setModal(null) })
					: modal.kind === "explain"
						? h(ExplainPanel, { t, state: explainState, onClose: () => setModal(null) })
						: modal.kind === "addrow"
							? h(AddRowDialog, {
								t,
								table: modal.table,
								columns: modal.columns,
								driver: connections.find((entry) => entry.id === modal.conn)?.driver,
								database: modal.database,
								onClose: () => setModal(null),
								onInsert: async (values) => {
									const message = await insertRow(modal.conn, modal.table, modal.database, values);
									if (message === "") modal.onDone?.();
									return message;
								} })
							: h(ImportDialog, {
							t,
							table: modal.table,
							driver: connections.find((entry) => entry.id === modal.conn)?.driver,
							onClose: () => setModal(null),
							onInsert: async (text) => {
								const message = await importRows(modal.conn, modal.table, text);
								if (message === "" && modal.onDone) modal.onDone();
								return message;
							} }),
		// ---- connect dialog ---------------------------------------------------------------
		connectOpen
			? h("div", { className: "cedb-dialog cedb-dialog-wide", ref: connectRef, role: "dialog", "aria-label": t("db.newConnection") },
				h("div", { className: "cedb-dialog-head" },
					h("h3", { className: "cedb-dialog-title" }, step === "pick" ? t("db.newConnection") : t("db.connectionInfo")),
					h("span", { className: "ce-spacer" }),
					step === "form"
						? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.changeDriver"), onClick: () => setStep("pick") }, `${driverLabel(form.driver)} ▾`)
						: null,
					h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setConnectOpen(false) }, "✕")),
				profiles.length === 0
					? null
					: h("div", { className: "cedb-saved-pick" },
						h("span", { className: "cedb-saved-pick-title" }, `${t("db.recentConnections")} · ${t("db.useSaved")}`),
						profiles.map((profile) => h("button", {
							key: profile.id,
							type: "button",
							className: "cedb-saved-chip",
							title: profile.address || profile.path,
							onClick: () => { useSavedProfile(profile); setStep("form"); } }, h("span", { className: `cedb-driver cedb-driver-${profile.driver}` }, profile.driver), profile.label))),
				step === "pick"
					? h(Fragment, null,
						h("div", { className: "cedb-pick-tools" },
							h("input", { className: "ce-input", value: pickQuery, placeholder: t("db.pickSearch"), spellCheck: false, onChange: (event) => setPickQuery(event.target.value) }),
							CATEGORIES.map((category) => h("button", {
								key: category.id,
								type: "button",
								className: `cedb-cat${pickCategory === category.id ? " cedb-cat-on" : ""}`,
								onClick: () => setPickCategory(category.id) }, t(category.key)))),
						h("div", { className: "cedb-pick" }, pickableDrivers.map((id) => {
						const known = drivers.find((entry) => entry.id === id);
						return h("button", {
							key: id,
							type: "button",
							className: `cedb-pick-card${form.driver === id ? " cedb-pick-on" : ""}`,
							"aria-pressed": form.driver === id,
							onClick: () => setForm((current) => ({ ...current, driver: id, port: defaultPort(id) })),
							onDoubleClick: () => { setForm((current) => ({ ...current, driver: id, port: defaultPort(id) })); setStep("form"); } },
						h("span", { className: `cedb-pick-glyph cedb-driver-${id}`, "aria-hidden": "true" }, driverLabel(id).slice(0, 2)),
						h("span", { className: "cedb-pick-label" }, driverLabel(id)),
						h("span", { className: "cedb-pick-note" }, known?.ready ? (known.bin || known.version || t("db.notReady")) : (known?.note ?? "")));
					})))
					: h(Fragment, null,
						h("div", { className: "cedb-wtabs", role: "tablist" }, [
							["info", "db.tabInfo"],
							["tls", "db.tabTls"],
							["tunnel", "db.tabTunnel"],
							["advanced", "db.tabAdvanced"],
						].map(([id, key]) => h("button", {
							key: id,
							type: "button",
							role: "tab",
							"aria-selected": tab === id,
							className: `cedb-wtab${tab === id ? " cedb-wtab-on" : ""}`,
							onClick: () => setTab(id) }, t(key),
						id === "tls" && String(form.sslMode ?? "") !== "" ? h("span", { className: "cedb-wtab-dot" }) : null,
						id === "tunnel" && String(form.tunnelHost ?? "").trim() !== "" ? h("span", { className: "cedb-wtab-dot" }) : null))),
						tab === "info"
							? h(Fragment, null,
								h("label", { className: "cedb-field" }, t("db.pasteAddress"),
									h("input", {
										className: "ce-input",
										value: form.address,
										placeholder: t("db.addressPlaceholder"),
										autoFocus: true,
										spellCheck: false,
										autoComplete: "off",
										onChange: (event) => applyAddress(event.target.value) })),
								h("div", { className: "cedb-field-row" },
									h("label", { className: "cedb-field" }, t("db.name"),
										h("input", { className: "ce-input", value: form.label, placeholder: t("db.namePlaceholder"), onChange: (event) => setForm({ ...form, label: event.target.value }) })),
									h("label", { className: "cedb-field cedb-field-narrow" }, t("db.color"),
										h("div", { className: "cedb-colors" }, CONNECTION_COLORS.map((color) => h("button", {
											key: color || "none",
											type: "button",
											className: `cedb-color${form.color === color ? " cedb-color-on" : ""}${color === "" ? " cedb-color-none" : ""}`,
											style: color === "" ? undefined : { background: color },
											"aria-label": color || t("db.noColor"),
											"aria-pressed": form.color === color,
											onClick: () => setForm({ ...form, color }) }))))),
								form.driver === "sqlite"
									? h("label", { className: "cedb-field" }, t("db.path"),
										h("input", { className: "ce-input", value: form.path, placeholder: "/path/to/app.sqlite", spellCheck: false, onChange: (event) => setForm({ ...form, path: event.target.value }) }))
									: h(Fragment, null,
										h("div", { className: "cedb-field-row" },
											h("label", { className: "cedb-field" }, t("db.host"),
												h("input", { className: "ce-input", value: form.host, spellCheck: false, placeholder: "localhost", onChange: (event) => setForm({ ...form, host: event.target.value }) })),
											h("label", { className: "cedb-field cedb-field-narrow" }, t("db.port"),
												h("input", { className: "ce-input", type: "number", value: form.port, placeholder: defaultPort(form.driver), onChange: (event) => setForm({ ...form, port: event.target.value }) }))),
										h("div", { className: "cedb-field-row" },
											h("label", { className: "cedb-field" }, t("db.user"),
												h("input", { className: "ce-input", value: form.user, spellCheck: false, autoComplete: "off", onChange: (event) => setForm({ ...form, user: event.target.value }) })),
											h("label", { className: "cedb-field" }, t("db.password"),
												h("div", { className: "cedb-password" },
													h("input", { className: "ce-input", type: showPassword ? "text" : "password", value: form.password, autoComplete: "off", onChange: (event) => setForm({ ...form, password: event.target.value }) }),
													h("button", { type: "button", className: "ce-tool ce-tiny", title: showPassword ? t("db.hidePassword") : t("db.showPassword"), onClick: () => setShowPassword((value) => !value) }, showPassword ? "🙈" : "👁")))),
										h("label", { className: "cedb-field" }, t("db.database"),
											h("input", { className: "ce-input", value: form.database, spellCheck: false, onChange: (event) => setForm({ ...form, database: event.target.value }) })),
										h("label", { className: "cedb-field" }, t("db.urlParams"),
											h("input", { className: "ce-input", value: form.urlParams, placeholder: "charset=utf8mb4&sslmode=require", spellCheck: false, onChange: (event) => setForm({ ...form, urlParams: event.target.value }) }))),
								h("label", { className: "cedb-field" }, t("db.note"),
									h("input", { className: "ce-input", value: form.note, placeholder: t("db.notePlaceholder"), onChange: (event) => setForm({ ...form, note: event.target.value }) })),
								h("label", { className: "cedb-remember" },
									h("input", { type: "checkbox", checked: saveProfile, onChange: (event) => setSaveProfile(event.target.checked) }),
									t("db.remember")))
							: null,
						tab === "tls"
							? h(Fragment, null,
								h("label", { className: "cedb-field" }, t("db.sslMode"),
									h("select", { className: "ce-input", value: form.sslMode, onChange: (event) => setForm({ ...form, sslMode: event.target.value }) },
										h("option", { value: "" }, t("db.sslDefault")),
										h("option", { value: "disabled" }, t("db.sslDisabled")),
										h("option", { value: "preferred" }, t("db.sslPreferred")),
										h("option", { value: "required" }, t("db.sslRequired")),
										h("option", { value: "verify-ca" }, t("db.sslVerifyCa")),
										h("option", { value: "verify-full" }, t("db.sslVerifyFull")))),
								h("label", { className: "cedb-field" }, t("db.sslCa"),
									h("input", { className: "ce-input", value: form.sslCa, placeholder: "/path/to/ca.pem", spellCheck: false, onChange: (event) => setForm({ ...form, sslCa: event.target.value }) })),
								h("div", { className: "cedb-field-row" },
									h("label", { className: "cedb-field" }, t("db.sslCert"),
										h("input", { className: "ce-input", value: form.sslCert, placeholder: "/path/to/client-cert.pem", spellCheck: false, onChange: (event) => setForm({ ...form, sslCert: event.target.value }) })),
									h("label", { className: "cedb-field" }, t("db.sslKey"),
										h("input", { className: "ce-input", value: form.sslKey, placeholder: "/path/to/client-key.pem", spellCheck: false, onChange: (event) => setForm({ ...form, sslKey: event.target.value }) }))),
								h("p", { className: "cedb-dialog-hint" }, t("db.sslHint")))
							: null,
						tab === "tunnel"
							? h(Fragment, null,
								h("p", { className: "cedb-dialog-hint" }, t("db.tunnelHint")),
								h("div", { className: "cedb-field-row" },
									h("label", { className: "cedb-field" }, t("db.tunnelHost"),
										h("input", { className: "ce-input", value: form.tunnelHost, placeholder: "jump.example.com", spellCheck: false, onChange: (event) => setForm({ ...form, tunnelHost: event.target.value }) })),
									h("label", { className: "cedb-field cedb-field-narrow" }, t("db.tunnelPort"),
										h("input", { className: "ce-input", type: "number", value: form.tunnelPort, placeholder: "22", onChange: (event) => setForm({ ...form, tunnelPort: event.target.value }) }))),
								h("div", { className: "cedb-field-row" },
									h("label", { className: "cedb-field" }, t("db.tunnelUser"),
										h("input", { className: "ce-input", value: form.tunnelUser, placeholder: "root", spellCheck: false, onChange: (event) => setForm({ ...form, tunnelUser: event.target.value }) })),
									h("label", { className: "cedb-field cedb-field-narrow" }, t("db.tunnelLocalPort"),
										h("input", { className: "ce-input", type: "number", value: form.tunnelLocalPort, placeholder: t("db.tunnelAuto"), onChange: (event) => setForm({ ...form, tunnelLocalPort: event.target.value }) }))),
								h("label", { className: "cedb-field" }, t("db.tunnelKey"),
									h("input", { className: "ce-input", value: form.tunnelKey, placeholder: "~/.ssh/id_ed25519", spellCheck: false, onChange: (event) => setForm({ ...form, tunnelKey: event.target.value }) })))
							: null,
						tab === "advanced"
							? h(Fragment, null,
								form.driver === "sqlite"
									? null
									: h(Fragment, null,
										h("label", { className: "cedb-field" }, t("db.clientPath"),
											h("input", {
												className: "ce-input",
												value: form.clientPath,
												placeholder: form.driver === "mysql" ? "/opt/homebrew/opt/mysql-client/bin/mysql" : "/opt/homebrew/opt/postgresql@16/bin/psql",
												spellCheck: false,
												onChange: (event) => setForm({ ...form, clientPath: event.target.value }) })),
										String(form.clientPath ?? "").trim() === ""
											? h("div", { className: "cedb-bin" },
												drivers.find((entry) => entry.id === form.driver)?.bin
													? `${t("db.clientBin")}: ${drivers.find((entry) => entry.id === form.driver).bin}`
													: t("db.clientBinMissing"))
											: null,
										h("label", { className: "cedb-remember" },
											h("input", {
												type: "checkbox",
												checked: allowModule,
												onChange: (event) => {
													setAllowModule(event.target.checked);
													try { localStorage.setItem("dsh.plugin-kit.db.allowModule", event.target.checked ? "on" : "off"); } catch { /* storage may be denied */ }
												} }),
											t("db.allowModule"))))
							: null,
						h("div", { className: `cedb-detect${driverReady ? "" : " cedb-detect-miss"}` },
							h("span", null, `${t("db.detected")}: ${driverLabel(form.driver)}${implSuffix(drivers.find((entry) => entry.id === form.driver), t)}`),
							driverReady ? null : h("span", { className: "cedb-detect-note" }, drivers.find((entry) => entry.id === form.driver)?.note ?? ""),
							h("button", { type: "button", className: "cedb-redetect", title: t("db.redetectHint"), onClick: () => void probeDrivers(true) }, t("db.redetect"))),
						notice !== "" ? h("div", { className: "cedb-dialog-error", role: "alert" }, notice) : null,
						testState.ok !== null || testState.text !== ""
							? h("div", { className: `cedb-dialog-test${testState.ok === true ? " cedb-dialog-test-ok" : " cedb-dialog-test-bad"}`, role: "status" }, testState.text)
							: null),
				h("div", { className: "cedb-dialog-actions" },
					step === "pick"
						? h(Fragment, null,
							h("span", { className: "cedb-dialog-hint" }, form.driver === "" ? t("db.notDetected") : `${t("db.detected")}: ${driverLabel(form.driver)}`),
							h("span", { className: "ce-spacer" }),
							h("button", { type: "button", className: "ce-sk-btn", onClick: () => setConnectOpen(false) }, t("editor.cancel")),
							h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", disabled: form.driver === "", onClick: () => setStep("form") }, t("db.nextStep")))
						: h(Fragment, null,
							h("button", { type: "button", className: "ce-sk-btn", onClick: () => setStep("pick") }, t("db.prevStep")),
							h("span", { className: "ce-spacer" }),
							h("button", { type: "button", className: "ce-sk-btn", disabled: !canConnect || testState.busy, onClick: () => void doTest() }, testState.busy ? t("loading") : t("db.testAction")),
							h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", disabled: !canConnect, onClick: () => void doConnect() }, t("db.saveAndConnect")))),
			)
			: null,
		// ---- history drawer ---------------------------------------------------------------
		historyOpen && history.length > 0
			? h("div", { className: "cedb-history" },
				h("div", { className: "cedb-history-head" },
					h("span", null, t("db.history")),
					h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setHistoryOpen(false) }, "✕")),
				history.map((entry, index) => h("button", {
					key: `${entry.at}-${index}`,
					type: "button",
					className: "cedb-history-row",
					title: entry.sql,
					onClick: () => { const id = openQueryTab(entry.sql); setHistoryOpen(false); setActiveTabId(id); } },
				h("span", { className: "cedb-history-sql" }, entry.sql.slice(0, 120)),
				h("span", { className: "cedb-history-ms" }, `${entry.ms} ms`))))
			: null,
		// ---- cell detail ------------------------------------------------------------------
		cellDetail
			? h("div", { className: "cedb-cell-detail", ref: detailRef, role: "dialog", "aria-label": cellDetail.title },
				h("div", { className: "cedb-cell-head" },
					h("span", { className: "cedb-cell-title" }, cellDetail.title),
					h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setCellDetail(null) }, "✕")),
				h("pre", { className: "cedb-cell-body" }, formatCell(cellDetail.value)))
			: null,
	);
}
