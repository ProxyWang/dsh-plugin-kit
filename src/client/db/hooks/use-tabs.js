/** Tabs, table pages and ad-hoc queries.
 *
 * One tab list serves both kinds of work: a table tab pages a table through
 * `db.rows`, a query tab runs free SQL through `db.query`. Both patch the same
 * tab record (`loading`, `error`, `result`, `runToken`), which is why they live
 * together here instead of in two hooks that would have to share that shape.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "../../react.js";
import { api } from "../../api.js";
import { useAutoHeight } from "../../autosize.js";
import { PAGE_SIZE, QUERY_PAGE, HISTORY_CAP, requestToken, toCsv } from "../format.js";
import { toInsertSql, toJsonRows } from "../../dbtools.js";

/** Rows fetched per page for ad-hoc queries; bigger pages were slow to send. */

/**
 * @param options - `{connections, setConnections, activeConn, setActiveConn, t, refreshSchema, onNotice}`
 * @returns the tab list, the active tab, and every action that touches them
 */
export function useTabs({ connections, setConnections, activeConn, setActiveConn, t, refreshSchema, onNotice, onConnectionOk }) {
	const [tabs, setTabs] = useState([]);
	const [activeTabId, setActiveTabId] = useState("");
	const [history, setHistory] = useState([]);

	const activeTab = tabs.find((entry) => entry.id === activeTabId) ?? null;
	// A long statement should not be read through an 88px slot.
	const sqlRef = useRef(null);
	useAutoHeight(sqlRef, activeTab?.sql ?? "", { min: 88 });

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

	// --- table pages -----------------------------------------------------------------------

	const fetchRows = useCallback(async (tab) => {
		const token = requestToken("rows");
		patchTab(tab.id, { loading: true, error: "", runToken: token });
		const res = await api("db.rows", {
			id: tab.conn,
			token,
			table: tab.table,
			database: tab.database,
			limit: PAGE_SIZE,
			offset: tab.offset,
			order: tab.order,
			dir: tab.dir,
			filter: tab.filter,
		});
		if (!res.ok) { patchTab(tab.id, { loading: false, error: res.error }); return; }
		patchTab(tab.id, { loading: false, result: res.value, error: "", runToken: "" });
		onConnectionOk?.(tab.conn);
	}, [patchTab, onConnectionOk]);

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

	// --- SQL tabs --------------------------------------------------------------------------

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

	const runQuery = useCallback(async (id, offset = 0) => {
		const tab = tabs.find((entry) => entry.id === id);
		if (!tab || tab.kind !== "query") return;
		const sql = String(tab.sql ?? "").trim();
		if (sql === "") return;
		const conn = tab.conn || activeConn;
		if (!conn) { patchTab(id, { error: t("db.noConnection"), result: null }); return; }
		const token = requestToken("query");
		patchTab(id, { loading: true, error: "", runToken: token });
		const started = Date.now();
		// One page per run: a 12 MB result was the reason Run felt slow.
		const res = await api("db.query", { id: conn, token, sql, limit: QUERY_PAGE, offset });
		const ms = Date.now() - started;
		// A failed statement is history too: the next attempt usually starts from
		// what went wrong, so the drawer keeps it with its flag.
		setHistory((current) => [{ sql, at: Date.now(), ms, ok: res.ok && !res.value?.error }, ...current.filter((entry) => entry.sql !== sql)].slice(0, HISTORY_CAP));
		if (!res.ok) { patchTab(id, { loading: false, error: res.error, result: null }); return; }
		patchTab(id, { loading: false, result: res.value, error: "", ms, runToken: "", offset });
		onConnectionOk?.(conn);
		// A statement that changes the schema (CREATE/DROP/ALTER) refreshes the tree.
		if (/^\s*(create|drop|alter|rename|truncate)\b/i.test(sql)) void refreshSchema(conn);
	}, [tabs, activeConn, patchTab, refreshSchema, onConnectionOk, t]);

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
		const res = await api("db.cancel", { id: conn, ...(tab.runToken ? { token: tab.runToken } : {}) });
		const value = res.ok ? res.value : null;
		// A statement that already finished is not a cancellation: saying so would
		// show "cancelled" over a result that actually arrived.
		if (!value?.cancelled) {
			patchTab(tab.id, { loading: false, error: "" });
			onNotice(res.ok ? t("db.notRunning") : res.error);
			return;
		}
		patchTab(tab.id, { loading: false, error: t("db.cancelled") });
		if (value.connectionClosed) {
			setConnections((current) => current.filter((entry) => entry.id !== conn));
			setTabs((current) => current.filter((entry) => entry.conn !== conn));
			if (activeConn === conn) setActiveConn("");
			onNotice(t("db.cancelledClosed"));
		}
	}, [activeConn, patchTab, t, setConnections, setActiveConn, onNotice]);

	/** Copy the current result as JSON or as INSERT statements. */
	const copyResult = useCallback(async (tab, kind) => {
		const driver = connections.find((entry) => entry.id === (tab.conn || activeConn))?.driver;
		const text = kind === "json" ? toJsonRows(tab.result) : toInsertSql(tab.result, tab.table ?? tab.title, driver);
		try {
			await navigator.clipboard.writeText(text);
			onNotice(t("db.copied"));
		} catch {
			onNotice(t("db.copyFailed"));
		}
	}, [connections, activeConn, t, onNotice]);

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

	return {
		tabs, setTabs, activeTab, activeTabId, setActiveTabId, history, setHistory, sqlRef,
		patchTab, openTab, closeTab, openQueryTab, openTable, loadRows, fetchRows, sortBy,
		runQuery, cancelQuery, copyResult, exportResult,
	};
}
