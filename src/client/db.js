/* ---------------- Database workbench: connections, schema, table pages, SQL ----------------
 *
 * Three things a local database tool has to do, and this panel does them in
 * one surface (the shape dbx/DataGrip use):
 *
 * 1. **Browse** — a connection list and a schema tree (databases → tables and
 *    views → columns), with a filter box that narrows the tree by name.
 * 2. **Page a table** — clicking a table opens a grid tab with server-side
 *    ordering and filtering, a fixed page size, and a footer that pages
 *    through the total; no SELECT * ever runs unbounded.
 * 3. **Query** — any number of SQL tabs, each with its own editor, result,
 *    timing, truncation flag, and a shared history the panel can recall.
 *
 * Everything is client state over three host routes (`db.schema`, `db.rows`,
 * `db.query`), so the panel keeps its tabs and history across a connection
 * swap in the same session.
 */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { api } from "./api.js";
import { DRIVERS, driverLabel, parseConnectionAddress } from "./dbconnect.js";
import { useDismissLayer } from "./dismiss.js";
import { DB_TAB_KIND, DB_TAB_ID } from "./constants.js";

export const dbDefinition = (t) => ({
	id: DB_TAB_ID,
	kind: DB_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("db.label"),
	guide: [],
});

const PAGE_SIZE = 100;
const HISTORY_CAP = 40;

/** Pure: format a cell for the grid (NULL is visibly distinct from ''. */
export function formatCell(value) {
	if (value === null) return "NULL";
	if (value === undefined) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

/** Pure: shorten a cell for the grid preview, keeping the full value for the title. */
export function truncateCell(value, max = 120) {
	const text = formatCell(value);
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Pure: one CSV document from a result (RFC 4180 quoting). */
export function toCsv(columns, rows) {
	const quote = (value) => {
		const text = value === null || value === undefined ? "" : String(value);
		return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	};
	const lines = [columns.map(quote).join(",")];
	for (const row of rows) lines.push(row.map(quote).join(","));
	return lines.join("\n");
}

/** Pure: the SQL a table tab runs for the current page/order/filter. */
export function tableSql(table, { order, dir, limit, offset, filter, columns, driver }) {
	// MySQL only accepts backticks (unless ANSI_QUOTES is on), so the generated
	// SELECT has to use the driver's own identifier quoting to be runnable.
	const q = (name) => (driver === "mysql"
		? `\`${String(name).replace(/`/g, "``")}\``
		: `"${String(name).replace(/"/g, '""')}"`);
	const quote = q(table);
	const where = filter && filter.trim() && columns?.length
		? ` WHERE (${columns.map((column) => `CAST(${q(column.name)} AS TEXT) LIKE '%${filter.trim().replace(/'/g, "''")}%'`).join(" OR ")})`
		: "";
	const sorting = order ? ` ORDER BY ${q(order)} ${dir === "desc" ? "DESC" : "ASC"}` : "";
	return `SELECT * FROM ${quote}${where}${sorting} LIMIT ${limit} OFFSET ${offset}`;
}

/** Count rows and messages for the header chips. */
function countOf(schema) {
	let tables = 0;
	let views = 0;
	for (const database of schema?.databases ?? []) {
		for (const entry of database.tables ?? []) {
			if (entry.kind === "view") views++;
			else tables++;
		}
	}
	return { tables, views };
}

export function DbView({ t, useTabInfo, sessionId, useSessions }) {
	const cwd = useSessions ? useSessions((sessions) => (sessionId ? sessions.byId[sessionId]?.cwd : void 0)) : void 0;

	const [drivers, setDrivers] = useState([]);
	const [connections, setConnections] = useState([]);
	const [activeConn, setActiveConn] = useState("");
	const [schema, setSchema] = useState(null);
	const [schemaBusy, setSchemaBusy] = useState(false);
	const [schemaError, setSchemaError] = useState("");
	const [filter, setFilter] = useState("");
	const [expanded, setExpanded] = useState(() => new Set()); // table keys open in the tree
	const [tabs, setTabs] = useState([]);
	const [activeTabId, setActiveTabId] = useState("");
	const [history, setHistory] = useState([]);
	const [connectOpen, setConnectOpen] = useState(false);
	// The address is the only thing a person has to know: the driver and the
	// fields are derived from it (dbconnect.js). `advanced` reveals the fields
	// for the cases where inference is not enough.
	const [form, setForm] = useState({ address: "", driver: "", path: "", host: "localhost", port: "", user: "", password: "", database: "" });
	const [advanced, setAdvanced] = useState(false);
	const [cellDetail, setCellDetail] = useState(null); // {title, value}
	const [notice, setNotice] = useState("");
	// Saved connections: the profile list (passwords stay in the Host vault).
	const [profiles, setProfiles] = useState([]);
	// The revision the list was read at: a save carries it so the Host can
	// refuse to overwrite a newer list written by another window.
	const profileRevision = useRef(0);
	const [saveProfile, setSaveProfile] = useState(true);
	const [historyOpen, setHistoryOpen] = useState(false);
	const detailRef = useDismissLayer({ open: Boolean(cellDetail), onDismiss: () => setCellDetail(null) });
	const connectRef = useDismissLayer({ open: connectOpen, onDismiss: () => setConnectOpen(false) });

	useEffect(() => {
		api("db.profile.list", {}).then((res) => {
			if (!res.ok) return;
			profileRevision.current = res.value.revision ?? 0;
			setProfiles(res.value.profiles ?? []);
		}).catch(() => {});
	}, []);

	useEffect(() => {
		api("db.drivers", {}).then((res) => {
			// The readiness list only decorates the optional override; a failed
			// probe must not silence the panel, so it degrades to "assume ready"
			// and the Host reports the real reason when connecting.
			if (res.ok) setDrivers(res.value ?? []);
		});
	}, []);

	const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

	const patchTab = useCallback((id, patch) => {
		setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...(typeof patch === "function" ? patch(tab) : patch) } : tab)));
	}, []);

	const openTab = useCallback((tab) => {
		// Focus is decided OUTSIDE the updater: a state write inside it would run
		// twice under React's double-invoked updaters and is a render side effect.
		const existing = tabs.find((entry) => entry.key === tab.key);
		if (existing) {
			setActiveTabId(existing.id);
			return;
		}
		setTabs((current) => [...current, tab]);
		setActiveTabId(tab.id);
	}, [tabs]);

	const closeTab = useCallback((id) => {
		setTabs((current) => {
			const index = current.findIndex((tab) => tab.id === id);
			const next = current.filter((tab) => tab.id !== id);
			if (id === activeTabId) setActiveTabId(next[Math.max(0, index - 1)]?.id ?? next[0]?.id ?? "");
			return next;
		});
	}, [activeTabId]);

	// --- connections ----------------------------------------------------------------------

	const refreshSchema = useCallback(async (id = activeConn) => {
		if (!id) { setSchema(null); return; }
		setSchemaBusy(true);
		setSchemaError("");
		const res = await api("db.schema", { id });
		setSchemaBusy(false);
		if (res.ok) setSchema(res.value);
		else { setSchema(null); setSchemaError(res.error); }
	}, [activeConn]);

	/**
	 * Read a pasted address into driver and fields.
	 *
	 * A URL fills host/port/user/password/database; a path fills the SQLite
	 * file. Unknown input clears the driver so Connect stays disabled, and the
	 * reason is shown instead of being swallowed.
	 */
	const applyAddress = useCallback((value) => {
		const parsed = parseConnectionAddress(value);
		setForm((current) => ({
			...current,
			address: value,
			driver: parsed.driver,
			path: parsed.driver === "sqlite" ? parsed.path : current.path,
			host: parsed.driver === "sqlite" ? current.host : (parsed.host || current.host),
			port: parsed.port,
			user: parsed.user,
			password: parsed.password,
			database: parsed.database,
		}));
		setNotice(parsed.error);
	}, []);

	const driverReady = drivers.find((entry) => entry.id === form.driver)?.ready ?? true;
	const canConnect = form.driver !== ""
		&& driverReady
		&& (form.driver === "sqlite" ? form.path.trim() !== "" : form.host.trim() !== "");

	/** Save the current target as a reusable connection (password → Host vault). */
	const rememberConnection = useCallback(async (draft) => {
		const defaultPort = draft.driver === "mysql" ? 3306 : draft.driver === "postgres" ? 5432 : 0;
		const label = draft.driver === "sqlite"
			? (String(draft.path).split(/[\\/]/).pop() || draft.path)
			: `${draft.host}:${Number(draft.port) || defaultPort}${draft.database ? `/${draft.database}` : ""}`;
		// A relative file path is stored absolute: the profile outlives this
		// session, and its meaning must not change with the next workspace.
		const absolute = draft.driver === "sqlite" && draft.path !== "" && !/^(\/|~|[A-Za-z]:[\\/])/.test(draft.path) && cwd
			? `${cwd.replace(/\/+$/, "")}/${draft.path.replace(/^\.\//, "")}`
			: draft.path;
		const res = await api("db.profile.save", {
			baseRevision: profileRevision.current,
			label,
			driver: draft.driver,
			address: draft.address,
			path: absolute,
			host: draft.host,
			port: Number(draft.port) || defaultPort,
			user: draft.user,
			database: draft.database,
			...(draft.password ? { password: draft.password } : {}),
		});
		if (!res.ok) { setNotice(res.error); return; }
		profileRevision.current = res.value.revision ?? profileRevision.current;
		setProfiles((current) => [res.value.profile, ...current.filter((entry) => entry.id !== res.value.profile.id)]);
	}, [cwd]);

	/** Open a saved connection. The password never reaches this side. */
	const connectProfile = useCallback(async (profile) => {
		const res = await api("db.connect", { profileId: profile.id, cwd });
		if (!res.ok) { setNotice(res.error); return; }
		setConnections((current) => [...current.filter((entry) => entry.id !== res.value.id), res.value]);
		setActiveConn(res.value.id);
		setNotice("");
		await refreshSchema(res.value.id);
	}, [refreshSchema, cwd]);

	const forgetProfile = useCallback(async (profile) => {
		await api("db.profile.delete", { id: profile.id });
		setProfiles((current) => current.filter((entry) => entry.id !== profile.id));
	}, []);

	const doConnect = useCallback(async () => {
		if (!canConnect) return;
		const params = { driver: form.driver, cwd };
		if (form.driver === "sqlite") params.path = form.path.trim();
		else {
			params.host = form.host.trim();
			params.port = form.port ? Number(form.port) : undefined;
			params.user = form.user;
			params.password = form.password;
			params.database = form.database.trim();
		}
		const res = await api("db.connect", params);
		if (!res.ok) { setNotice(res.error); return; }
		setConnections((current) => [...current.filter((entry) => entry.id !== res.value.id), res.value]);
		setActiveConn(res.value.id);
		setConnectOpen(false);
		setNotice("");
		if (saveProfile) await rememberConnection(form);
		await refreshSchema(res.value.id);
	}, [form, refreshSchema, saveProfile, rememberConnection]);

	const doDisconnect = useCallback(async (id) => {
		await api("db.disconnect", { id });
		setConnections((current) => current.filter((entry) => entry.id !== id));
		// Tabs bound to this connection could only fail on their next request.
		setTabs((current) => current.filter((tab) => tab.conn !== id));
		if (activeConn === id) { setActiveConn(""); setSchema(null); }
	}, [activeConn]);

	// --- table pages ----------------------------------------------------------------------

	const fetchRows = useCallback(async (tab) => {
		patchTab(tab.id, { loading: true, error: "" });
		const res = await api("db.rows", {
			id: tab.conn,
			table: tab.table,
			database: tab.database,
			limit: PAGE_SIZE,
			offset: tab.offset,
			order: tab.order,
			dir: tab.dir,
			filter: tab.filter,
		});
		if (!res.ok) { patchTab(tab.id, { loading: false, error: res.error }); return; }
		patchTab(tab.id, { loading: false, result: res.value, error: "" });
	}, [patchTab]);

	/**
	 * Load one table page. `override` carries the new offset/order/filter so the
	 * request uses the values the user just picked instead of the state the
	 * closure was created with (React has not re-rendered yet at call time).
	 */
	const loadRows = useCallback((tabId, override) => {
		const tab = tabs.find((entry) => entry.id === tabId);
		if (!tab || tab.kind !== "table") return;
		return fetchRows({ ...tab, ...override });
	}, [tabs, fetchRows]);

	const openTable = useCallback((connectionId, database, entry) => {
		const key = `table:${connectionId}:${database}:${entry.name}`;
		openTab({
			id: `tab-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
			key,
			kind: "table",
			title: entry.name,
			conn: connectionId,
			database,
			table: entry.name,
			columns: entry.columns ?? [],
			offset: 0,
			order: "",
			dir: "asc",
			filter: "",
			loading: false,
			error: "",
			result: null,
		});
	}, [openTab]);

	// A freshly-opened table tab fetches its first page exactly once.
	const fetched = useRef(new Set());
	useEffect(() => {
		const target = tabs.find((tab) => tab.kind === "table" && !tab.result && !tab.loading && !fetched.current.has(tab.id));
		if (!target) return;
		fetched.current.add(target.id);
		void fetchRows(target);
	}, [tabs, fetchRows]);

	const sortBy = useCallback((id, column) => {
		const target = tabs.find((tab) => tab.id === id);
		if (!target) return;
		const dir = target.order === column && target.dir === "asc" ? "desc" : "asc";
		patchTab(id, { order: column, dir, offset: 0 });
		void loadRows(id, { order: column, dir, offset: 0 });
	}, [tabs, patchTab, loadRows]);

	// --- SQL tabs -------------------------------------------------------------------------

	const openQueryTab = useCallback((sql = "") => {
		const id = `tab-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
		openTab({
			id,
			key: `query:${id}`,
			kind: "query",
			title: t("db.queryTab"),
			sql,
			conn: activeConn,
			loading: false,
			error: "",
			result: null,
			ms: 0,
		});
		return id;
	}, [openTab, activeConn, t]);

	const runQuery = useCallback(async (id) => {
		const tab = tabs.find((entry) => entry.id === id);
		if (!tab || tab.kind !== "query") return;
		const sql = String(tab.sql ?? "").trim();
		if (sql === "") return;
		const conn = tab.conn || activeConn;
		if (!conn) { patchTab(id, { error: t("db.noConnection"), result: null }); return; }
		patchTab(id, { loading: true, error: "" });
		const started = Date.now();
		const res = await api("db.query", { id: conn, sql, limit: 5000 });
		const ms = Date.now() - started;
		if (!res.ok) { patchTab(id, { loading: false, error: res.error, result: null }); return; }
		patchTab(id, { loading: false, result: res.value, error: "", ms });
		setHistory((current) => [{ sql, at: Date.now(), ms, ok: !res.value.error }, ...current.filter((entry) => entry.sql !== sql)].slice(0, HISTORY_CAP));
		// A statement that changes the schema (CREATE/DROP/ALTER) refreshes the tree.
		if (/^\s*(create|drop|alter)\b/i.test(sql)) void refreshSchema(conn);
	}, [tabs, activeConn, patchTab, refreshSchema, t]);

	/**
	 * Stop the statement running on this tab's connection.
	 *
	 * A CLI-backed connection survives (the child process is killed); a SQLite
	 * statement runs in a worker thread that cannot be interrupted in place, so
	 * cancelling ends that connection and the panel says so.
	 */
	const cancelQuery = useCallback(async (tab) => {
		const conn = tab.conn || activeConn;
		if (!conn) return;
		const res = await api("db.cancel", { id: conn });
		patchTab(tab.id, { loading: false, error: t("db.cancelled") });
		if (res.ok && res.value?.connectionClosed) {
			setConnections((current) => current.filter((entry) => entry.id !== conn));
			setTabs((current) => current.filter((entry) => entry.conn !== conn));
			if (activeConn === conn) { setActiveConn(""); setSchema(null); }
			setNotice(t("db.cancelledClosed"));
		}
	}, [activeConn, patchTab, t]);

	const exportResult = useCallback((result, name) => {
		if (!result?.columns?.length) return;
		const csv = toCsv(result.columns, result.rows ?? []);
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `${name || "result"}.csv`;
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 4000);
	}, []);

	// --- tree ----------------------------------------------------------------------------

	const tree = useMemo(() => {
		const needle = filter.trim().toLowerCase();
		const databases = (schema?.databases ?? []).map((database) => {
			const entries = (database.tables ?? []).filter((entry) => !needle || entry.name.toLowerCase().includes(needle));
			return { ...database, tables: entries };
		});
		return needle ? databases.filter((database) => database.tables.length > 0) : databases;
	}, [schema, filter]);

	const counts = countOf(schema);

	const toggleTable = (key) => {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	const onKeyDown = useCallback((event) => {
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			event.preventDefault();
			if (activeTab?.kind === "query") void runQuery(activeTab.id);
		}
	}, [activeTab, runQuery]);

	if (!cwd) {
		return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
	}

	return h("div", { className: "ce-root cedb-root", onKeyDown },
		// ---- toolbar -------------------------------------------------------------------
		h("div", { className: "cedb-toolbar" },
			h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: () => setConnectOpen(true) }, `＋ ${t("db.connect")}`),
			h("button", { type: "button", className: "ce-sk-btn", onClick: () => openQueryTab("") }, t("db.newQuery")),
			activeConn ? h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("db.refresh"), onClick: () => void refreshSchema() }, "⟳") : null,
			h("span", { className: "ce-spacer" }),
			schema ? h("span", { className: "cedb-chip" }, `${counts.tables} ${t("db.tables")}`) : null,
			schema ? h("span", { className: "cedb-chip" }, `${counts.views} ${t("db.views")}`) : null,
			notice && !connectOpen ? h("span", { className: "cedb-notice" }, notice) : null,
		),
		h("div", { className: "cedb-body" },
			// ---- rail ------------------------------------------------------------------
			h("aside", { className: "cedb-rail" },
				h("div", { className: "cedb-rail-head" },
					h("span", { className: "cedb-rail-title" }, t("db.connections")),
				),
				profiles.length > 0
					? h(Fragment, null,
						h("div", { className: "cedb-rail-head cedb-rail-head-sub" },
							h("span", { className: "cedb-rail-title" }, t("db.savedConnections"))),
						profiles.map((profile) => h("div", { key: profile.id, className: "cedb-conn cedb-saved" },
							h("button", {
								type: "button",
								className: "cedb-conn-main",
								title: `${profile.address || profile.path} — ${t("db.connectSaved")}`,
								onClick: () => void connectProfile(profile),
							},
							h("span", { className: `cedb-driver cedb-driver-${profile.driver}` }, profile.driver),
							h("span", { className: "cedb-conn-label" }, profile.label)),
							h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.forget"), onClick: () => void forgetProfile(profile) }, "✕"),
						)))
					: null,
				connections.length === 0
					? h("div", { className: "cedb-empty" }, t("db.noConnections"))
					: connections.map((connection) => h("div", { key: connection.id, className: `cedb-conn${connection.id === activeConn ? " cedb-conn-on" : ""}` },
						h("button", {
							type: "button",
							className: "cedb-conn-main",
							title: connection.path || connection.label,
							onClick: () => { setActiveConn(connection.id); void refreshSchema(connection.id); },
						},
						h("span", { className: `cedb-driver cedb-driver-${connection.driver}` }, connection.driver),
						h("span", { className: "cedb-conn-label" }, connection.label)),
						h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.disconnect"), onClick: () => void doDisconnect(connection.id) }, "✕"),
					)),
				schema ? h(Fragment, null,
					h("div", { className: "cedb-rail-head cedb-rail-head-split" },
						h("span", { className: "cedb-rail-title" }, t("db.objects")),
						h("input", {
							className: "ce-input cedb-filter",
							placeholder: t("db.search"),
							value: filter,
							onChange: (event) => setFilter(event.target.value),
						}),
					),
					schemaBusy ? h("div", { className: "cedb-empty" }, t("loading")) : null,
					schemaError ? h("div", { className: "cedb-error cedb-pad" }, schemaError) : null,
					tree.map((database) => h("div", { key: database.name, className: "cedb-db" },
						h("div", { className: "cedb-db-name" }, database.name, database.tables.length === 0 ? h("span", { className: "cedb-db-hint" }, t("db.notLoaded")) : null),
						database.tables.map((entry) => {
							const key = `${database.name}:${entry.name}`;
							const open = expanded.has(key);
							return h("div", { key, className: "cedb-table" },
								h("button", {
									type: "button",
									className: `cedb-table-row${activeTab?.key === `table:${activeConn}:${database.name}:${entry.name}` ? " cedb-table-on" : ""}`,
									title: `${entry.name} · ${entry.columns?.length ?? 0} ${t("db.columns")}`,
									onClick: () => { toggleTable(key); openTable(activeConn, database.name, entry); },
									onDoubleClick: () => openQueryTab(`SELECT * FROM "${entry.name.replace(/"/g, '""')}" LIMIT 100;`),
								},
								h("span", { className: `cedb-kind cedb-kind-${entry.kind}` }, entry.kind === "view" ? "◇" : "▤"),
								h("span", { className: "cedb-table-name" }, entry.name)),
								open && entry.columns?.length
									? h("ul", { className: "cedb-cols" }, entry.columns.map((column) => h("li", { key: column.name, className: "cedb-col" },
										h("span", { className: "cedb-col-name" }, column.name),
										h("span", { className: "cedb-col-type" }, column.type),
										column.primaryKey ? h("span", { className: "cedb-pk" }, "PK") : null,
										column.nullable === false ? h("span", { className: "cedb-nn" }, "NN") : null,
									)))
									: null,
							);
						}),
					)),
				) : null,
			),
			// ---- main ------------------------------------------------------------------
			h("section", { className: "cedb-main" },
				h("div", { className: "cedb-tabs", role: "tablist" },
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
						// ---- query tab ----
						activeTab.kind === "query"
							? h(Fragment, null,
								h("div", { className: "cedb-editor" },
									h("div", { className: "cedb-editor-bar" },
										h("select", {
											className: "cedb-conn-select",
											value: activeTab.conn || activeConn,
											onChange: (event) => patchTab(activeTab.id, { conn: event.target.value }),
											"aria-label": t("db.connections"),
										}, connections.map((connection) => h("option", { key: connection.id, value: connection.id }, `${connection.driver} · ${connection.label}`))),
										activeTab.loading
											? h("button", { type: "button", className: "ce-sk-btn cedb-run cedb-stop", onClick: () => void cancelQuery(activeTab) }, `■ ${t("db.stop")}`)
											: h("button", {
												type: "button",
												className: "ce-sk-btn ce-sk-primary cedb-run",
												disabled: !String(activeTab.sql ?? "").trim(),
												onClick: () => void runQuery(activeTab.id),
											}, `▶ ${t("db.run")}`),
										h("button", { type: "button", className: "ce-sk-btn", title: t("db.history"), onClick: () => setHistoryOpen((v) => !v) }, t("db.history")),
										h("span", { className: "ce-spacer" }),
										h("span", { className: "cedb-kbd" }, "⌘/Ctrl+Enter"),
									),
									h("textarea", {
										className: "cedb-sql",
										value: activeTab.sql ?? "",
										placeholder: t("db.sqlPlaceholder"),
										spellCheck: false,
										onChange: (event) => patchTab(activeTab.id, { sql: event.target.value }),
									}),
								),
								h("div", { className: "cedb-result-head" },
									activeTab.result
										? h(Fragment, null,
											h("span", { className: "cedb-chip" }, `${activeTab.result.rows?.length ?? 0} ${t("db.rows")}`),
											h("span", { className: "cedb-chip" }, `${activeTab.ms || activeTab.result.ms || 0} ms`),
											activeTab.result.truncated ? h("span", { className: "cedb-chip cedb-chip-warn" }, t("db.truncated")) : null,
											activeTab.result.changes !== undefined ? h("span", { className: "cedb-chip" }, `${activeTab.result.changes} ${t("db.affected")}`) : null,
											activeTab.result.columns?.length ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.export"), onClick: () => exportResult(activeTab.result, activeTab.title) }, "⤓ CSV") : null,
										)
										: h("span", { className: "cedb-result-hint" }, t("db.runHint")),
								),
								activeTab.error ? h("div", { className: "cedb-error" }, activeTab.error) : null,
								activeTab.result
									? h(ResultGrid, { t, result: activeTab.result, onCell: setCellDetail })
									: h("div", { className: "cedb-placeholder-small" }, t("db.runHint")),
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
										onKeyDown: (event) => { if (event.key === "Enter") void loadRows(activeTab.id, { filter: event.currentTarget.value, offset: 0 }); },
									}),
									h("button", { type: "button", className: "ce-sk-btn", disabled: activeTab.loading, onClick: () => void loadRows(activeTab.id) }, activeTab.loading ? t("loading") : "⟳"),
									h("button", { type: "button", className: "ce-sk-btn", title: t("db.sqlForTable"), onClick: () => openQueryTab(`${tableSql(activeTab.table, { ...activeTab, limit: PAGE_SIZE, driver: connections.find((entry) => entry.id === activeTab.conn)?.driver }).replace(/;\s*$/, "")};`) }, "SQL"),
									h("span", { className: "ce-spacer" }),
									activeTab.result ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.export"), onClick: () => exportResult(activeTab.result, activeTab.table) }, "⤓ CSV") : null,
								),
								activeTab.error ? h("div", { className: "cedb-error" }, activeTab.error) : null,
								activeTab.result
									? h(ResultGrid, { t, result: activeTab.result, onCell: setCellDetail, onSort: (column) => sortBy(activeTab.id, column), order: activeTab.order, dir: activeTab.dir })
									: h("div", { className: "cedb-placeholder-small" }, activeTab.loading ? t("loading") : t("db.noRows")),
								h("div", { className: "cedb-pager" },
									h("button", {
										type: "button",
										className: "ce-tool ce-tiny",
										disabled: activeTab.offset === 0 || activeTab.loading,
										onClick: () => { const offset = Math.max(0, activeTab.offset - PAGE_SIZE); patchTab(activeTab.id, { offset }); void loadRows(activeTab.id, { offset }); },
									}, "←"),
									h("span", { className: "cedb-pager-text" },
										`${activeTab.offset + 1}–${Math.min(activeTab.offset + PAGE_SIZE, activeTab.result?.total ?? 0)} / ${activeTab.result?.total ?? 0}`),
									h("button", {
										type: "button",
										className: "ce-tool ce-tiny",
										disabled: activeTab.loading || activeTab.offset + PAGE_SIZE >= (activeTab.result?.total ?? 0),
										onClick: () => { const offset = activeTab.offset + PAGE_SIZE; patchTab(activeTab.id, { offset }); void loadRows(activeTab.id, { offset }); },
									}, "→"),
								),
							),
					),
			),
		),
		// ---- connect dialog ---------------------------------------------------------------
		connectOpen
			? h("div", { className: "cedb-dialog", ref: connectRef, role: "dialog", "aria-label": t("db.newConnection") },
				h("h3", { className: "cedb-dialog-title" }, t("db.newConnection")),
				h("label", { className: "cedb-field" }, t("db.address"),
					h("input", {
						className: "ce-input",
						value: form.address,
						placeholder: t("db.addressPlaceholder"),
						autoFocus: true,
						spellcheck: false,
						autoComplete: "off",
						onChange: (event) => applyAddress(event.target.value),
					})),
				h("div", { className: `cedb-detect${form.driver === "" ? " cedb-detect-miss" : ""}` },
					h("span", null, form.driver === "" ? t("db.notDetected") : `${t("db.detected")}: ${driverLabel(form.driver)}`),
					driverReady || form.driver === "" ? null : h("span", { className: "cedb-detect-note" }, drivers.find((entry) => entry.id === form.driver)?.note ?? "")),
				advanced || form.driver === ""
					? h(Fragment, null,
						h("label", { className: "cedb-field" }, t("db.driver"),
							h("select", {
								className: "ce-input",
								value: form.driver,
								onChange: (event) => setForm({ ...form, driver: event.target.value }),
							// Always populated: an unprobed deployment still shows the
							// drivers it could open, instead of an empty box.
							}, DRIVERS.map((id) => {
								const known = drivers.find((entry) => entry.id === id);
								return h("option", { key: id, value: id, disabled: known ? !known.ready : false }, known && !known.ready ? `${known.label} — ${known.note}` : driverLabel(id));
							}))),
						form.driver === "sqlite"
							? h("label", { className: "cedb-field" }, t("db.path"),
								h("input", { className: "ce-input", value: form.path, placeholder: "/path/to/app.sqlite", onChange: (event) => setForm({ ...form, path: event.target.value }) }))
							: h(Fragment, null,
								h("div", { className: "cedb-field-row" },
									h("label", { className: "cedb-field" }, t("db.host"), h("input", { className: "ce-input", value: form.host, onChange: (event) => setForm({ ...form, host: event.target.value }) })),
									h("label", { className: "cedb-field cedb-field-narrow" }, t("db.port"), h("input", { className: "ce-input", type: "number", value: form.port, placeholder: form.driver === "mysql" ? "3306" : "5432", onChange: (event) => setForm({ ...form, port: event.target.value }) })),
								),
								h("label", { className: "cedb-field" }, t("db.database"), h("input", { className: "ce-input", value: form.database, onChange: (event) => setForm({ ...form, database: event.target.value }) })),
								h("div", { className: "cedb-field-row" },
									h("label", { className: "cedb-field" }, t("db.user"), h("input", { className: "ce-input", value: form.user, onChange: (event) => setForm({ ...form, user: event.target.value }) })),
									h("label", { className: "cedb-field" }, t("db.password"), h("input", { className: "ce-input", type: "password", value: form.password, onChange: (event) => setForm({ ...form, password: event.target.value }) })),
								)))
					: h("button", {
						type: "button",
						className: "cedb-advanced",
						"aria-expanded": advanced,
						onClick: () => setAdvanced(true),
					}, t("db.advanced")),
				notice !== "" && connectOpen ? h("div", { className: "cedb-dialog-error", role: "alert" }, notice) : null,
				h("label", { className: "cedb-remember" },
					h("input", { type: "checkbox", checked: saveProfile, onChange: (event) => setSaveProfile(event.target.checked) }),
					t("db.remember")),
				h("div", { className: "cedb-dialog-actions" },
					h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", disabled: !canConnect, onClick: () => void doConnect() }, t("db.connectAction")),
					h("button", { type: "button", className: "ce-sk-btn", onClick: () => setConnectOpen(false) }, t("editor.cancel")),
				),
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
					onClick: () => { const id = openQueryTab(entry.sql); setHistoryOpen(false); setActiveTabId(id); },
				},
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

/** The tab title is the fixed database label; open tabs carry their own names. */
export function DbTitle() {
	return null;
}

/** The result grid: sticky header, sortable columns, row numbers, cell inspection. */
function ResultGrid({ t, result, onCell, onSort, order, dir }) {
	const columns = result.columns ?? [];
	const rows = result.rows ?? [];
	if (columns.length === 0) return h("div", { className: "cedb-placeholder-small" }, t("db.noRows"));
	return h("div", { className: "cedb-grid-wrap" },
		h("table", { className: "cedb-grid" },
			h("thead", null,
				h("tr", null,
					h("th", { className: "cedb-grid-gutter" }, "#"),
					columns.map((column, index) => h("th", {
						key: `${column}-${index}`,
						className: `cedb-grid-th${onSort ? " cedb-grid-sortable" : ""}${order === column ? " cedb-grid-sorted" : ""}`,
						onClick: onSort ? () => onSort(column) : undefined,
						title: column,
					}, column, order === column ? (dir === "desc" ? " ↓" : " ↑") : "")))),
			h("tbody", null,
				rows.map((row, rowIndex) => h("tr", { key: rowIndex },
					h("td", { className: "cedb-grid-gutter" }, rowIndex + 1),
					row.map((cell, cellIndex) => h("td", {
						key: cellIndex,
						className: `cedb-grid-td${cell === null ? " cedb-null" : ""}`,
						title: formatCell(cell),
						onClick: () => onCell?.({ title: `${columns[cellIndex]} · ${t("db.row")} ${rowIndex + 1}`, value: cell }),
					}, truncateCell(cell)))))),
		),
	);
}