/* ---------------- Database panel: connection manager, schema browser, SQL editor, result grid ----------------
 *
 * A lightweight local-DB workbench inspired by dbx (https://github.com/t8y2/dbx).
 * SQLite is built-in (node:sqlite on Node ≥ 22.5); MySQL and PostgreSQL use
 * their CLI clients when present. The UI follows the same task-oriented layout
 * as the API tester: left rail for connections + schema tree, centre for the
 * SQL editor, bottom for the result grid.
 */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { api } from "./api.js";
import { useDismissLayer } from "./dismiss.js";
import { DB_TAB_KIND, DB_TAB_ID } from "./constants.js";

const TAB_KIND = DB_TAB_KIND;
const TAB_ID = DB_TAB_ID;

export const dbDefinition = (t) => ({
	id: TAB_ID,
	kind: TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("db.label"),
	guide: [],
});

/** Pure: format a cell value for display in the result grid. */
export function formatCell(value) {
	if (value === null) return "NULL";
	if (value === undefined) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

/** Pure: truncate a long cell for the grid preview. */
export function truncateCell(value, max = 120) {
	const s = formatCell(value);
	return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function DbView({ t, useTabInfo, sessionId, useSessions }) {
	const cwd = useSessions ? useSessions((sessions) => (sessionId ? sessions.byId[sessionId]?.cwd : void 0)) : void 0;
	const hostTab = useTabInfo ? useTabInfo()?.tab : null;

	const [drivers, setDrivers] = useState([]);
	const [connections, setConnections] = useState([]);
	const [activeConn, setActiveConn] = useState(null); // connection id
	const [schema, setSchema] = useState(null); // {databases, tables}
	const [sql, setSql] = useState("");
	const [result, setResult] = useState(null); // {columns, rows, truncated, ms, error}
	const [running, setRunning] = useState(false);
	const [connectForm, setConnectForm] = useState({ driver: "sqlite", path: "", host: "localhost", port: "", user: "", password: "", database: "" });
	const [connectOpen, setConnectOpen] = useState(false);
	const connectRef = useDismissLayer({ open: connectOpen, onDismiss: () => setConnectOpen(false) });
	const [selectedTable, setSelectedTable] = useState(null);
	const sqlRef = useRef(null);

	// Load drivers and existing connections on mount.
	useEffect(() => {
		api("db.drivers", {}).then((res) => { if (res.ok) setDrivers(res.value); });
		api("db.connections", {}).then((res) => { if (res.ok) setConnections(res.value); });
	}, []);

	// When the active connection changes, load its schema.
	useEffect(() => {
		if (!activeConn) { setSchema(null); return; }
		api("db.list", { id: activeConn }).then((res) => {
			if (res.ok) setSchema(res.value);
			else setSchema({ databases: [], tables: [], error: res.error });
		});
	}, [activeConn]);

	const doConnect = useCallback(async () => {
		const f = connectForm;
		const params = { driver: f.driver };
		if (f.driver === "sqlite") params.path = f.path;
		else {
			params.host = f.host;
			params.port = f.port ? Number(f.port) : void 0;
			params.user = f.user;
			params.password = f.password;
			params.database = f.database;
		}
		const res = await api("db.connect", params);
		if (res.ok) {
			setConnections((prev) => [...prev, res.value]);
			setActiveConn(res.value.id);
			setConnectOpen(false);
		}
	}, [connectForm]);

	const doDisconnect = useCallback(async (id) => {
		await api("db.disconnect", { id });
		setConnections((prev) => prev.filter((c) => c.id !== id));
		if (activeConn === id) { setActiveConn(null); setSchema(null); setResult(null); }
	}, [activeConn]);

	const runQuery = useCallback(async () => {
		if (!activeConn || !sql.trim() || running) return;
		setRunning(true);
		setResult(null);
		const res = await api("db.query", { id: activeConn, sql: sql.trim(), limit: 1000 });
		setRunning(false);
		if (res.ok) setResult(res.value);
		else setResult({ error: res.error });
	}, [activeConn, sql, running]);

	const selectTable = useCallback((name) => {
		setSelectedTable(name);
		setSql(`SELECT * FROM "${name}" LIMIT 100`);
	}, []);

	// Keyboard: Cmd/Ctrl+Enter runs the query.
	const onKeyDown = useCallback((e) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			runQuery();
		}
	}, [runQuery]);

	if (!cwd) {
		return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
	}

	return h("div", { className: "ce-root ceb-db-root", onKeyDown },
		h("div", { className: "ceb-db-toolbar" },
			h("span", { className: "ceb-db-title" }, t("db.label")),
			h("button", { type: "button", className: "ce-sk-btn", onClick: () => setConnectOpen(true) }, t("db.connect")),
			activeConn ? h("span", { className: "ceb-db-conn" }, connections.find((c) => c.id === activeConn)?.label ?? activeConn.slice(0, 8)) : null,
			activeConn ? h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", onClick: () => doDisconnect(activeConn) }, t("db.disconnect")) : null,
		),
		connectOpen ? h("div", { className: "ceb-db-connect", ref: connectRef },
			h("h3", null, t("db.newConnection")),
			h("label", null, t("db.driver"),
				h("select", { className: "ce-sk-scope", value: connectForm.driver, onChange: (e) => setConnectForm({ ...connectForm, driver: e.target.value }) },
					drivers.map((d) => h("option", { key: d.id, value: d.id, disabled: !d.ready }, `${d.label}${d.note ? ` (${d.note})` : ""}`)),
				),
			),
			connectForm.driver === "sqlite"
				? h("label", null, t("db.path"), h("input", { className: "ce-input", value: connectForm.path, placeholder: "/path/to/database.sqlite", onChange: (e) => setConnectForm({ ...connectForm, path: e.target.value }) }))
				: h(Fragment, null,
					h("label", null, t("db.host"), h("input", { className: "ce-input", value: connectForm.host, onChange: (e) => setConnectForm({ ...connectForm, host: e.target.value }) })),
					h("label", null, t("db.port"), h("input", { className: "ce-input", type: "number", value: connectForm.port, placeholder: connectForm.driver === "mysql" ? "3306" : "5432", onChange: (e) => setConnectForm({ ...connectForm, port: e.target.value }) })),
					h("label", null, t("db.user"), h("input", { className: "ce-input", value: connectForm.user, onChange: (e) => setConnectForm({ ...connectForm, user: e.target.value }) })),
					h("label", null, t("db.password"), h("input", { className: "ce-input", type: "password", value: connectForm.password, onChange: (e) => setConnectForm({ ...connectForm, password: e.target.value }) })),
					h("label", null, t("db.database"), h("input", { className: "ce-input", value: connectForm.database, onChange: (e) => setConnectForm({ ...connectForm, database: e.target.value }) })),
				),
			h("div", { className: "ceb-db-connect-actions" },
				h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: doConnect }, t("db.connectAction")),
				h("button", { type: "button", className: "ce-sk-btn", onClick: () => setConnectOpen(false) }, t("editor.cancel")),
			),
		) : null,
		h("div", { className: "ceb-db-body" },
			h("div", { className: "ceb-db-rail ce-scroll" },
				h("div", { className: "ceb-db-section" }, t("db.connections")),
				connections.length === 0
					? h("div", { className: "ceb-db-empty" }, t("db.noConnections"))
					: connections.map((c) => h("button", {
						key: c.id,
						type: "button",
						className: `ceb-db-conn-row${c.id === activeConn ? " ceb-db-conn-active" : ""}`,
						onClick: () => setActiveConn(c.id),
					}, h("span", { className: "ceb-db-driver" }, c.driver), h("span", { className: "ceb-db-label" }, c.label))),
				schema ? h(Fragment, null,
					h("div", { className: "ceb-db-section" }, t("db.tables")),
					schema.tables?.length === 0
						? h("div", { className: "ceb-db-empty" }, t("db.noTables"))
						: schema.tables?.map((tbl) => h("div", { key: tbl.name, className: "ceb-db-table" },
							h("button", {
								type: "button",
								className: `ceb-db-table-name${selectedTable === tbl.name ? " ceb-db-table-active" : ""}`,
								onClick: () => selectTable(tbl.name),
							}, tbl.name),
							h("span", { className: "ceb-db-col-count" }, `${tbl.columns?.length ?? 0} cols`),
						)),
				) : null,
			),
			h("div", { className: "ceb-db-main" },
				h("div", { className: "ceb-db-editor-wrap" },
					h("textarea", {
						ref: sqlRef,
						className: "ceb-db-sql",
						value: sql,
						placeholder: t("db.sqlPlaceholder"),
						spellcheck: false,
						onChange: (e) => setSql(e.target.value),
					}),
					h("button", {
						type: "button",
						className: "ce-sk-btn ce-sk-primary ceb-db-run",
						disabled: !activeConn || !sql.trim() || running,
						onClick: runQuery,
					}, running ? t("loading") : t("db.run")),
				),
				result ? h("div", { className: "ceb-db-result ce-scroll" },
					result.error
						? h("div", { className: "ceb-db-error" }, result.error)
						: h(Fragment, null,
							h("div", { className: "ceb-db-result-meta" },
								result.ms !== void 0 ? `${result.ms} ms` : null,
								result.truncated ? t("db.truncated") : null,
								result.changes !== void 0 ? `${result.changes} rows affected` : null,
								!result.columns?.length && !result.rows?.length && result.changes === void 0 ? t("db.noRows") : null,
							),
							result.columns?.length > 0 ? h("table", { className: "ceb-db-grid" },
								h("thead", null, h("tr", null, result.columns.map((col, i) => h("th", { key: i }, col)))),
								h("tbody", null, result.rows?.map((row, ri) => h("tr", { key: ri }, row.map((cell, ci) => h("td", { key: ci, title: formatCell(cell) }, truncateCell(cell)))))),
							) : null,
						),
				) : h("div", { className: "ceb-db-empty ceb-db-result-empty" }, t("db.runHint")),
			),
		),
	);
}

export function DbTitle({ useTabInfo }) {
	return null;
}