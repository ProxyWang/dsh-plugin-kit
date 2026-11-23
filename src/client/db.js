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
import { useAutoHeight } from "./autosize.js";
import { deleteRowSql, erGraph, erLayout, insertRowSql, parseDataText, planTree, toInsertSql, toJsonRows, updateCellSql } from "./dbtools.js";
import { DRIVERS, driverLabel, parseConnectionAddress } from "./dbconnect.js";
import { useDismissLayer } from "./dismiss.js";
import { DB_TAB_KIND, DB_TAB_ID } from "./constants.js";
import { ToolGlyph } from "./lefttools.js";
import { GRID_ROW_H, ResultGrid } from "./db/grid.js";
import { AddRowDialog, DriverManager, ErDiagram, ExplainPanel, ImportDialog } from "./db/dialogs.js";

// The panel's public surface stays on this module: tests and the tab registry
// import from here, not from the internal files.
export { formatCell, gridWindow, truncateCell, ResultGrid, GRID_ROW_H } from "./db/grid.js";
export { AddRowDialog, DriverManager, ErDiagram, ExplainPanel, ImportDialog } from "./db/dialogs.js";

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

/**
 * One request token. A connection can serve several tabs at once, so a cancel
 * has to name the statement it means — killing "whatever is running on this
 * connection" stops the wrong one.
 */
export function requestToken(prefix = "r") {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
	// One schema per open connection: the rail is a tree of instances, not a
	// single "objects" pane for whichever one is active.
	const [schemas, setSchemas] = useState({});
	const [openConns, setOpenConns] = useState({});
	// Clicking a database selects it (and folds its tables): the rail's job is to
	// move the target, and picking another database used to do nothing at all.
	const [activeDb, setActiveDb] = useState({ conn: "", database: "" });
	// A cell being edited, plus which row is waiting for a second click to delete.
	const [cellEdit, setCellEdit] = useState(null);
	const [pendingDelete, setPendingDelete] = useState(-1);
	const [collapsedDbs, setCollapsedDbs] = useState({});
	const [schemaBusy, setSchemaBusy] = useState(false);
	const [schemaError, setSchemaError] = useState("");
	const [filter, setFilter] = useState("");
	const [expanded, setExpanded] = useState(() => new Set()); // table keys open in the tree
	const [tabs, setTabs] = useState([]);
	const [activeTabId, setActiveTabId] = useState("");
	const [history, setHistory] = useState([]);
	const [connectOpen, setConnectOpen] = useState(false);
	// The address is the only thing a person has to know: the driver and the
	// fields are typed directly instead.
	// for the cases where inference is not enough.
	const [form, setForm] = useState({
		address: "", label: "", color: "", note: "",
		driver: "postgres", path: "", host: "localhost", port: "5432", user: "", password: "", database: "", clientPath: "",
		sslMode: "", sslCa: "", sslCert: "", sslKey: "", urlParams: "",
		tunnelHost: "", tunnelPort: "22", tunnelUser: "", tunnelKey: "", tunnelLocalPort: "",
	});
	const [tab, setTab] = useState("info");
	// The pick step filters like dbx's: a search box and engine categories.
	const [pickQuery, setPickQuery] = useState("");
	const [pickCategory, setPickCategory] = useState("all");
	// Two steps: pick the engine, then fill the connection. dbx's flow, and it
	// keeps eight fields off the screen until they are relevant.
	const [step, setStep] = useState("pick");
	const [showPassword, setShowPassword] = useState(false);
	// Loading a workspace's `mysql2`/`pg` runs project code in the connection's
	// worker, so it is opt-in and remembered.
	const [allowModule, setAllowModule] = useState(() => {
		try { return localStorage.getItem("dsh.plugin-kit.db.allowModule") === "on"; } catch { return false; }
	});
	const [cellDetail, setCellDetail] = useState(null); // {title, value}
	const [notice, setNotice] = useState("");
	// Modal layer: driver manager, ER diagram, execution plan, import.
	const [modal, setModal] = useState(null);
	const [explainState, setExplainState] = useState({ busy: false, result: null, error: "" });
	const [exportOpen, setExportOpen] = useState(false);
	// dbx migration: preview first, write on the second click.
	const [dbxState, setDbxState] = useState(null);
	// Which saved profile the dialog is editing, so saving updates it instead of
	// creating a near-duplicate. Set when a saved connection is opened or lacks a
	// password.
	const [editingProfileId, setEditingProfileId] = useState("");
	// Saved connections: the profile list (passwords stay in the Host vault).
	const [profiles, setProfiles] = useState([]);
	// The revision the list was read at: a save carries it so the Host can
	// refuse to overwrite a newer list written by another window.
	const profileRevision = useRef(0);
	// Last failure per saved connection, shown on its row: a target that stopped
	// working should not look identical to one that never failed.
	const [profileErrors, setProfileErrors] = useState({});
	const [saveProfile, setSaveProfile] = useState(true);
	// The dialog's "Test" result: a connection proven without being kept.
	const [testState, setTestState] = useState({ busy: false, ok: null, text: "" });
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

	/**
	 * Read the driver probes. `refresh` asks the Host to look again (a client
	 * installed while this dialog is open should be picked up without a reload).
	 */
	const probeDrivers = useCallback(async (refresh = false) => {
		// `allowWorkspace` is what turns a resolvable project module from "found"
		// into "will be used"; the catalog reports the difference.
		const body = { allowWorkspace: allowModule === true, ...(refresh ? { refresh: true } : {}) };
		const res = await api("db.drivers", body);
		// The readiness list only decorates the optional override; a failed
		// probe must not silence the panel, so it degrades to "assume ready"
		// and the Host reports the real reason when connecting.
		if (res.ok) setDrivers(res.value ?? []);
	}, [allowModule]);

	useEffect(() => { void probeDrivers(); }, [probeDrivers]);

	const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
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

	// --- connections ----------------------------------------------------------------------

	const refreshSchema = useCallback(async (id = activeConn) => {
		if (!id) return;
		setSchemaBusy(true);
		setSchemaError("");
		const res = await api("db.schema", { id });
		setSchemaBusy(false);
		if (res.ok) {
			setSchemas((current) => ({ ...current, [id]: res.value }));
			setOpenConns((current) => ({ ...current, [id]: true }));
		} else {
			setSchemas((current) => { const next = { ...current }; delete next[id]; return next; });
			setSchemaError(res.error);
		}
	}, [activeConn]);

	/**
	 * Read a pasted address into driver and fields.
	 *
	 * A URL fills host/port/user/password/database; a path fills the SQLite
	 * file. Unknown input clears the driver so Connect stays disabled, and the
	 * reason is shown instead of being swallowed.
	 */
	/** Open the dialog in a clean state: no stale error from a previous attempt. */
	const openConnect = useCallback(() => {
		setEditingProfileId("");
		setNotice("");
		setTestState({ busy: false, ok: null, text: "" });
		setShowPassword(false);
		setStep("pick");
		setConnectOpen(true);
	}, []);

	/** Fill the form from a saved connection (the dialog's quick pick). */
	const useSavedProfile = useCallback((profile) => {
		setEditingProfileId(profile.id);
		const parsed = parseConnectionAddress(profile.address || profile.path || "");
		setForm({
			address: profile.address || profile.path || "",
			label: profile.label ?? "",
			color: profile.color ?? "",
			note: profile.note ?? "",
			...Object.fromEntries(Object.entries(profile.options ?? {}).filter(([, value]) => value !== undefined)),
			driver: profile.driver,
			path: profile.path ?? parsed.path,
			host: profile.host || parsed.host || "localhost",
			port: profile.port ? String(profile.port) : parsed.port,
			user: profile.user ?? parsed.user,
			password: "",
			database: profile.database ?? parsed.database,
			clientPath: "",
		});
		setNotice(parsed.error ?? "");
		setTestState({ busy: false, ok: null, text: "" });
	}, []);

	/** Engines the pick step should show for the current search/category. */
	const pickableDrivers = useMemo(() => {
		const needle = pickQuery.trim().toLowerCase();
		const category = CATEGORIES.find((entry) => entry.id === pickCategory);
		return DRIVERS.filter((id) => (category?.ids ? category.ids.includes(id) : true))
			.filter((id) => needle === "" || driverLabel(id).toLowerCase().includes(needle) || id.includes(needle));
	}, [pickQuery, pickCategory]);

	/** Switch driver, carrying the port over when it was still a default. */
	const setDriver = useCallback((driver) => {
		setForm((current) => {
			const defaultNow = defaultPort(current.driver);
			const keep = String(current.port ?? "") !== "" && String(current.port) !== defaultNow;
			return { ...current, driver, port: keep ? current.port : defaultPort(driver) };
		});
		setNotice("");
		setTestState({ busy: false, ok: null, text: "" });
	}, []);

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
		// The paste field is optional: it only reports a problem while it has text.
		setNotice(String(value).trim() === "" ? "" : parsed.error);
		// Any edit invalidates a previous test: it proved a different target.
		setTestState({ busy: false, ok: null, text: "" });
	}, []);

	const driverReady = drivers.find((entry) => entry.id === form.driver)?.ready ?? true;
	// A driver whose CLI is not on PATH can still be chosen: the binary may be
	// keg-only, or the user may be about to install it. The note is a warning,
	// and the connect attempt reports the real reason.
	const canConnect = form.driver !== ""
		&& (form.driver === "sqlite" ? form.path.trim() !== "" : form.host.trim() !== "");

	/**
	 * Install a driver module into the project (or copy the CLI command when the
	 * missing implementation is a binary). Both are explicit user actions.
	 */
	const installDriverModule = useCallback(async (name) => {
		setDbxState((current) => ({ ...(current ?? {}), installing: name, installError: "" }));
		const res = await api("db.driver.install", { name, cwd });
		const value = res.ok ? res.value : null;
		if (!value || value.error) {
			setDbxState((current) => ({ ...(current ?? {}), installing: "", installError: value?.error ?? res.error ?? "" }));
			return;
		}
		setDbxState((current) => ({ ...(current ?? {}), installing: "", installed: name }));
		await probeDrivers(true);
	}, [cwd, probeDrivers]);

	const copyCommand = useCallback(async (text) => {
		try {
			await navigator.clipboard.writeText(text);
			setNotice(t("db.copied"));
		} catch {
			setNotice(t("db.copyFailed"));
		}
	}, [t]);

	/** Read dbx's connection list, then import it on the second step. */
	const runDbxImport = useCallback(async (apply) => {
		setDbxState((current) => ({ ...(current ?? {}), busy: true }));
		const res = await api("db.import.dbx", { apply });
		const value = res.ok ? res.value : null;
		if (!value || value.error) {
			setDbxState({ busy: false, error: value?.error ?? res.error ?? "" });
			return;
		}
		setDbxState({ busy: false, ...value });
		if (apply && value.imported > 0) {
			const list = await api("db.profile.list", {});
			if (list.ok) {
				profileRevision.current = list.value.revision ?? profileRevision.current;
				setProfiles(list.value.profiles ?? []);
			}
		}
	}, []);

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
			...(editingProfileId ? { id: editingProfileId } : {}),
			label: String(draft.label ?? "").trim() || label,
			color: draft.color ?? "",
			note: draft.note ?? "",
			options: {
				sslMode: draft.sslMode ?? "",
				sslCa: draft.sslCa ?? "",
				sslCert: draft.sslCert ?? "",
				sslKey: draft.sslKey ?? "",
				urlParams: draft.urlParams ?? "",
				tunnelHost: draft.tunnelHost ?? "",
				tunnelPort: draft.tunnelPort ?? "22",
				tunnelUser: draft.tunnelUser ?? "",
				tunnelKey: draft.tunnelKey ?? "",
				tunnelLocalPort: draft.tunnelLocalPort ?? "",
				clientPath: draft.clientPath ?? "",
			},
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
	}, [cwd, editingProfileId]);

	/** Open a saved connection. The password never reaches this side. */
	const connectProfile = useCallback(async (profile) => {
		// A migrated profile has no secret (dbx encrypts its own): ask for the
		// password in the dialog rather than firing a connect that can only fail.
		if (String(profile.secretId ?? "") === "") {
			useSavedProfile(profile);
			setStep("form");
			setTab("info");
			setConnectOpen(true);
			setNotice(t("db.needPassword"));
			return "";
		}
		const existing = connections.find((entry) => entry.profileId === profile.id);
		if (existing) {
			setActiveConn(existing.id);
			setOpenConns((current) => ({ ...current, [existing.id]: true }));
			if (!schemas[existing.id]) void refreshSchema(existing.id);
			return existing.id;
		}
		const res = await api("db.connect", { profileId: profile.id, cwd });
		if (!res.ok) {
			setNotice(res.error);
			setProfileErrors((current) => ({ ...current, [profile.id]: res.error }));
			return;
		}
		setProfileErrors((current) => {
			if (!(profile.id in current)) return current;
			const next = { ...current };
			delete next[profile.id];
			return next;
		});
		setConnections((current) => [...current.filter((entry) => entry.id !== res.value.id), res.value]);
		setActiveConn(res.value.id);
		setActiveDb({ conn: res.value.id, database: res.value.database ?? "" });
		setNotice("");
		await refreshSchema(res.value.id);
		return res.value.id;
	}, [refreshSchema, cwd, useSavedProfile, t, connections, schemas]);

	const forgetProfile = useCallback(async (profile) => {
		await api("db.profile.delete", { id: profile.id });
		setProfiles((current) => current.filter((entry) => entry.id !== profile.id));
	}, []);

	/** The request body for both "Test" and "Connect". */
	const connectParams = useCallback(() => {
		const params = { driver: form.driver, cwd, allowModule: allowModule === true };
		if (form.driver === "sqlite") params.path = form.path.trim();
		else {
			params.host = form.host.trim();
			params.port = form.port ? Number(form.port) : undefined;
			params.user = form.user;
			params.password = form.password;
			params.database = form.database.trim();
			if (String(form.clientPath ?? "").trim() !== "") params.clientPath = form.clientPath.trim();
			if (String(form.sslMode ?? "") !== "") params.sslMode = form.sslMode;
			for (const key of ["sslCa", "sslCert", "sslKey", "urlParams"]) {
				if (String(form[key] ?? "").trim() !== "") params[key] = String(form[key]).trim();
			}
			if (String(form.tunnelHost ?? "").trim() !== "") {
				params.tunnel = {
					bastion: form.tunnelHost.trim(),
					port: Number(form.tunnelPort) || 22,
					user: form.tunnelUser.trim(),
					keyPath: String(form.tunnelKey ?? "").trim(),
					localPort: Number(form.tunnelLocalPort) || 0,
				};
			}
		}
		return params;
	}, [form, cwd, allowModule]);

	/**
	 * Prove the target without keeping it. dbx has this as a first-class action;
	 * the point is to get the driver's own error text before committing.
	 */
	const doTest = useCallback(async () => {
		if (!canConnect) return;
		setTestState({ busy: true, ok: null, text: "" });
		const res = await api("db.test", connectParams());
		if (!res.ok) { setTestState({ busy: false, ok: false, text: res.error }); return; }
		if (res.value?.error) { setTestState({ busy: false, ok: false, text: res.value.error }); return; }
		setTestState({ busy: false, ok: true, text: t("db.testOk").replace("{ms}", String(res.value.ms ?? 0)) });
	}, [canConnect, connectParams, t]);

	const doConnect = useCallback(async () => {
		if (!canConnect) return;
		const params = connectParams();
		const res = await api("db.connect", params);
		if (!res.ok) { setNotice(res.error); return; }
		setConnections((current) => [...current.filter((entry) => entry.id !== res.value.id), res.value]);
		setActiveConn(res.value.id);
		setConnectOpen(false);
		setNotice("");
		if (saveProfile) await rememberConnection(form);
		await refreshSchema(res.value.id);
		setActiveDb({ conn: res.value.id, database: res.value.database ?? "" });
	}, [connectParams, refreshSchema, saveProfile, rememberConnection]);

	const doDisconnect = useCallback(async (id) => {
		await api("db.disconnect", { id });
		setConnections((current) => current.filter((entry) => entry.id !== id));
		// Tabs bound to this connection could only fail on their next request.
		setTabs((current) => current.filter((tab) => tab.conn !== id));
		setSchemas((current) => { const next = { ...current }; delete next[id]; return next; });
		if (activeConn === id) setActiveConn("");
	}, [activeConn]);

	// --- table pages ----------------------------------------------------------------------

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
		if (!res.ok) { patchTab(id, { loading: false, error: res.error, result: null }); return; }
		patchTab(id, { loading: false, result: res.value, error: "", ms, runToken: "", offset });
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
		const res = await api("db.cancel", { id: conn, ...(tab.runToken ? { token: tab.runToken } : {}) });
		const value = res.ok ? res.value : null;
		// A statement that already finished is not a cancellation: saying so would
		// show "cancelled" over a result that actually arrived.
		if (!value?.cancelled) {
			patchTab(tab.id, { loading: false, error: "" });
			setNotice(res.ok ? t("db.notRunning") : res.error);
			return;
		}
		patchTab(tab.id, { loading: false, error: t("db.cancelled") });
		if (value.connectionClosed) {
			setConnections((current) => current.filter((entry) => entry.id !== conn));
			setTabs((current) => current.filter((entry) => entry.conn !== conn));
			if (activeConn === conn) setActiveConn("");
			setNotice(t("db.cancelledClosed"));
		}
	}, [activeConn, patchTab, t]);

	/** Copy the current result as JSON or as INSERT statements. */
	const copyResult = useCallback(async (tab, kind) => {
		const driver = connections.find((entry) => entry.id === (tab.conn || activeConn))?.driver;
		const text = kind === "json" ? toJsonRows(tab.result) : toInsertSql(tab.result, tab.table ?? tab.title, driver);
		try {
			await navigator.clipboard.writeText(text);
			setNotice(t("db.copied"));
		} catch {
			setNotice(t("db.copyFailed"));
		}
	}, [connections, activeConn, t]);

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

	const schema = schemas[activeConn] ?? null;

	/**
	 * Select a database, loading its tables the first time.
	 *
	 * MySQL lists every database but only introspects one; clicking another used
	 * to select a name with no tables behind it.
	 */
	const selectDatabase = useCallback(async (connId, databaseName) => {
		setActiveConn(connId);
		setActiveDb({ conn: connId, database: databaseName });
		const known = schemas[connId]?.databases?.find((entry) => entry.name === databaseName);
		if (known && known.tables.length > 0) return;
		// PostgreSQL binds a connection to one database; there is no `USE`.
		if (connections.find((entry) => entry.id === connId)?.driver === "postgres") {
			setNotice(t("db.pgCrossDatabase"));
			return;
		}
		const res = await api("db.schema", { id: connId, database: databaseName });
		if (!res.ok || !res.value) { setSchemaError(res.error ?? ""); return; }
		const fetched = (res.value.databases ?? []).find((entry) => entry.name === databaseName);
		if (!fetched) return;
		setSchemas((current) => {
			const schemaFor = current[connId];
			if (!schemaFor) return { ...current, [connId]: res.value };
			return {
				...current,
				[connId]: {
					...schemaFor,
					current: databaseName,
					databases: schemaFor.databases.map((entry) => (entry.name === databaseName ? fetched : entry)),
				},
			};
		});
	}, [schemas, connections, t]);

	/** The schema entry behind the open table tab, when there is one. */
	const tableEntry = useMemo(() => {
		if (activeTab?.kind !== "table") return null;
		const schemaFor = schemas[activeTab.conn || activeConn];
		const database = (schemaFor?.databases ?? []).find((entry) => entry.name === activeTab.database);
		return (database?.tables ?? []).find((entry) => entry.name === activeTab.table) ?? null;
	}, [activeTab, schemas, activeConn]);

	const pkColumn = tableEntry?.columns?.find((column) => column.primaryKey)?.name ?? "";

	/** Run one write, then reload the page it touched. */
	const runMutation = useCallback(async (sql, message) => {
		const conn = activeTab?.conn || activeConn;
		if (!conn || sql === "") return;
		const res = await api("db.query", { id: conn, sql });
		const value = res.ok ? res.value : null;
		if (!value || value.error) { setNotice(value?.error ?? res.error ?? ""); return; }
		setNotice(message);
		setCellEdit(null);
		setPendingDelete(-1);
		if (activeTab?.kind === "table") await loadRows(activeTab.id);
	}, [activeTab, activeConn, loadRows]);

	/** Commit one edited cell, addressed by the row's primary key. */
	const commitCell = useCallback(async (rowIndex, column, value) => {
		const result = activeTab?.result;
		if (!result || pkColumn === "") return;
		const pkIndex = result.columns.indexOf(pkColumn);
		const pkValue = result.rows?.[rowIndex]?.[pkIndex];
		const sql = updateCellSql({
			driver: connections.find((entry) => entry.id === (activeTab.conn || activeConn))?.driver,
			table: activeTab.table,
			database: activeTab.database,
			column,
			value,
			pkColumn,
			pkValue,
		});
		await runMutation(sql, t("db.rowUpdated"));
	}, [activeTab, pkColumn, connections, activeConn, runMutation, t]);

	/** Delete one row (the second click on its button confirms). */
	const removeRow = useCallback(async (rowIndex) => {
		const result = activeTab?.result;
		if (!result || pkColumn === "") return;
		if (pendingDelete !== rowIndex) { setPendingDelete(rowIndex); return; }
		const pkValue = result.rows?.[rowIndex]?.[result.columns.indexOf(pkColumn)];
		const sql = deleteRowSql({
			driver: connections.find((entry) => entry.id === (activeTab.conn || activeConn))?.driver,
			table: activeTab.table,
			database: activeTab.database,
			pkColumn,
			pkValue,
		});
		await runMutation(sql, t("db.rowDeleted"));
	}, [activeTab, pkColumn, pendingDelete, connections, activeConn, runMutation, t]);

	/** The databases of one instance, filtered by the rail's search box. */
	const databasesOf = useCallback((connId) => {
		const needle = filter.trim().toLowerCase();
		const databases = (schemas[connId]?.databases ?? []).map((database) => {
			const entries = (database.tables ?? []).filter((entry) => !needle || entry.name.toLowerCase().includes(needle));
			return { ...database, tables: entries };
		});
		return needle ? databases.filter((database) => database.tables.length > 0) : databases;
	}, [schemas, filter]);

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
			h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: openConnect }, `＋ ${t("db.connect")}`),
			h("button", { type: "button", className: "ce-sk-btn", title: t("db.driversHint"), onClick: () => setModal({ kind: "drivers" }) }, t("db.driversButton")),
			h("button", { type: "button", className: "ce-sk-btn", disabled: !schema, title: t("db.erHint"), onClick: () => setModal({ kind: "er" }) }, t("db.erButton")),
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
							profile.color ? h("span", { className: "cedb-color-dot", style: { background: profile.color }, "aria-hidden": "true" }) : null,
							h("span", { className: `cedb-driver cedb-driver-${profile.driver}` }, profile.driver),
							h("span", { className: "cedb-conn-label" }, profile.label),
							profile.note ? h("span", { className: "cedb-conn-note", title: profile.note }, "…") : null,
							profileErrors[profile.id] ? h("span", { className: "cedb-conn-bad", title: profileErrors[profile.id], "aria-label": profileErrors[profile.id] }, "⚠") : null),
							h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.forget"), onClick: () => void forgetProfile(profile) }, "✕"),
						)))
					: null,
				h("div", { className: "cedb-rail-head cedb-rail-head-split" },
					h("span", { className: "cedb-rail-title" }, t("db.connections")),
					h("input", {
						className: "ce-input cedb-filter",
						placeholder: t("db.search"),
						value: filter,
						onChange: (event) => setFilter(event.target.value),
					}),
				),
				connections.length === 0
					? h("div", { className: "cedb-empty" }, t("db.noConnections"))
					: connections.map((connection) => {
						const open = openConns[connection.id] === true;
						const loaded = schemas[connection.id];
						return h("div", { key: connection.id, className: `cedb-instance${connection.id === activeConn ? " cedb-instance-on" : ""}` },
							h("div", { className: "cedb-conn" },
								h("button", {
									type: "button",
									className: "cedb-conn-main",
									title: connection.path || connection.label,
									"aria-expanded": open,
									onClick: () => {
										setActiveConn(connection.id);
										const next = !open;
										setOpenConns((current) => ({ ...current, [connection.id]: next }));
										if (next && !loaded) void refreshSchema(connection.id);
									},
								},
								h("span", { className: "cedb-caret" }, open ? "▾" : "▸"),
								h("span", { className: `cedb-driver cedb-driver-${connection.driver}` }, connection.driver),
								h("span", { className: "cedb-conn-label" }, connection.label),
								connection.impl === "module" ? h("span", { className: "cedb-ctx cedb-ctx-dim" }, "module") : null),
								h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.disconnect"), onClick: () => void doDisconnect(connection.id) }, "✕")),
							open
								? h("div", { className: "cedb-instance-body" },
									schemaBusy && !loaded ? h("div", { className: "cedb-empty" }, t("loading")) : null,
									schemaError && connection.id === activeConn ? h("div", { className: "cedb-error cedb-pad" }, schemaError) : null,
									databasesOf(connection.id).map((database) => {
										const dbKey = `${connection.id}:${database.name}`;
										const selected = activeDb.conn === connection.id && activeDb.database === database.name;
										const collapsed = collapsedDbs[dbKey] === true;
										return h("div", { key: database.name, className: "cedb-db" },
										h("button", {
											type: "button",
											className: `cedb-db-name${selected ? " cedb-db-on" : ""}`,
											"aria-expanded": !collapsed,
											title: `${database.name} · ${database.tables.length} ${t("db.tables")}`,
											onClick: () => {
												void selectDatabase(connection.id, database.name);
												setCollapsedDbs((current) => ({ ...current, [dbKey]: current[dbKey] !== true }));
											},
										},
										h("span", { className: "cedb-caret" }, collapsed ? "▸" : "▾"),
										h("span", { className: "cedb-db-label" }, database.name),
										database.tables.length === 0 ? h("span", { className: "cedb-db-hint" }, t("db.notLoaded")) : null),
										collapsed ? null : database.tables.map((entry) => {
											const key = `${connection.id}:${database.name}:${entry.name}`;
											const expandedTable = expanded.has(key);
											const tabKey = `table:${connection.id}:${database.name}:${entry.name}`;
											return h("div", { key, className: "cedb-table" },
												h("button", {
													type: "button",
													className: `cedb-table-row${activeTab?.key === tabKey ? " cedb-table-on" : ""}`,
													title: `${entry.name} · ${entry.columns?.length ?? 0} ${t("db.columns")}`,
													onClick: () => { toggleTable(key); setActiveConn(connection.id); setActiveDb({ conn: connection.id, database: database.name }); openTable(connection.id, database.name, entry); },
													onDoubleClick: () => openQueryTab(`SELECT * FROM "${entry.name.replace(/"/g, '""')}" LIMIT 100;`),
												},
												h("span", { className: `cedb-kind cedb-kind-${entry.kind}` }, entry.kind === "view" ? "◇" : "▤"),
												h("span", { className: "cedb-table-name" }, entry.name)),
												expandedTable && entry.columns?.length
													? h("ul", { className: "cedb-cols" }, entry.columns.map((column) => h("li", { key: column.name, className: "cedb-col" },
														h("span", { className: "cedb-col-name" }, column.name),
														h("span", { className: "cedb-col-type" }, column.type),
														column.primaryKey ? h("span", { className: "cedb-pk" }, "PK") : null,
														column.nullable === false ? h("span", { className: "cedb-nn" }, "NN") : null,
													)))
													: null,
											);
										}));
									}),
								)
								: null,
						);
					}),
			),
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
											},
										}, [
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
												onClick: () => void runQuery(activeTab.id),
											}, `▶ ${t("db.run")}`),
										h("button", {
											type: "button",
											className: "ce-sk-btn",
											disabled: !String(activeTab.sql ?? "").trim() || activeTab.loading,
											title: t("db.explainHint"),
											onClick: () => {
												const conn = activeTab.conn || activeConn;
												const sql = activeTab.sql ?? "";
												setModal({ kind: "explain" });
												setExplainState({ busy: true, result: null, error: "" });
												api("db.explain", { id: conn, sql }).then((res) => {
													const value = res.ok ? res.value : null;
													if (!value || value.error) setExplainState({ busy: false, result: null, error: value?.error ?? res.error ?? "" });
													else setExplainState({ busy: false, result: value, error: "" });
												});
											},
										}, t("db.explain")),
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
											activeTab.result.columns?.length
												? h("span", { className: "cedb-export" },
													h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.export"), onClick: () => setExportOpen((open) => !open) }, `⤓ ${t("db.export")}`),
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
										onKeyDown: (event) => { if (event.key === "Enter") void loadRows(activeTab.id, { filter: event.currentTarget.value, offset: 0 }); },
									}),
									h("button", { type: "button", className: "ce-sk-btn", disabled: activeTab.loading, onClick: () => void loadRows(activeTab.id) }, activeTab.loading ? t("loading") : "⟳"),
									h("button", { type: "button", className: "ce-sk-btn", title: t("db.sqlForTable"), onClick: () => openQueryTab(`${tableSql(activeTab.table, { ...activeTab, limit: PAGE_SIZE, driver: connections.find((entry) => entry.id === activeTab.conn)?.driver }).replace(/;\s*$/, "")};`) }, "SQL"),
									h("span", { className: "ce-spacer" }),
									activeTab.result ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.export"), onClick: () => exportResult(activeTab.result, activeTab.table) }, "⤓ CSV") : null,
									h("button", {
										type: "button",
										className: "ce-sk-btn",
										title: t("db.importHint"),
										onClick: () => setModal({ kind: "import", table: activeTab.table, conn: activeTab.conn || activeConn, onDone: () => void loadRows(activeTab.id) }),
									}, t("db.import")),
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
											onDone: () => void loadRows(activeTab.id),
										}),
									}, `＋ ${t("db.addRow")}`),
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
										pendingDelete,
									})
									: h("div", { className: "cedb-empty-result" },
										h("span", { className: "cedb-empty-icon", "aria-hidden": "true" }, "▤"),
										h("div", { className: "cedb-empty-title" }, activeTab.loading ? t("loading") : t("db.reloadTable")),
										h("div", { className: "cedb-empty-hint" }, t("db.reloadTableHint")),
										activeTab.loading ? null : h("button", { type: "button", className: "ce-sk-btn", onClick: () => void loadRows(activeTab.id) }, `⟳ ${t("db.refresh")}`)),
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
		// ---- modal layer: drivers / ER / plan / import ------------------------------------
		modal === null
			? null
			: modal.kind === "drivers"
				? h(DriverManager, { t, drivers, dbxState, onImportDbx: runDbxImport, onInstall: installDriverModule, onCopy: copyCommand, onRedetect: () => void probeDrivers(true), onClose: () => setModal(null) })
				: modal.kind === "er"
					? h(ErDiagram, { t, schema, onOpenTable: (table) => { setModal(null); openTableTab(table); }, onClose: () => setModal(null) })
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
									const sql = insertRowSql({ driver: connections.find((entry) => entry.id === modal.conn)?.driver, table: modal.table, database: modal.database, values });
									if (sql === "") return t("db.importEmpty");
									const res = await api("db.query", { id: modal.conn, sql });
									if (!res.ok || res.value?.error) return res.value?.error ?? res.error;
									setModal(null);
									setNotice(t("db.rowInserted"));
									modal.onDone?.();
									return "";
								},
							})
							: h(ImportDialog, {
							t,
							table: modal.table,
							driver: connections.find((entry) => entry.id === modal.conn)?.driver,
							onClose: () => setModal(null),
							onInsert: async (text) => {
								const parsed = parseDataText(text);
								if (parsed.error !== "") return parsed.error;
								const sql = toInsertSql(parsed, modal.table, connections.find((entry) => entry.id === modal.conn)?.driver);
								if (sql === "") return t("db.importEmpty");
								const res = await api("db.query", { id: modal.conn, sql, limit: 1 });
								if (!res.ok || res.value?.error) return res.value?.error ?? res.error;
								setModal(null);
								setNotice(t("db.imported").replace("{n}", String(parsed.rows.length)));
								if (modal.onDone) modal.onDone();
								return "";
							},
						}),
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
							onClick: () => { useSavedProfile(profile); setStep("form"); },
						}, h("span", { className: `cedb-driver cedb-driver-${profile.driver}` }, profile.driver), profile.label))),
				step === "pick"
					? h(Fragment, null,
						h("div", { className: "cedb-pick-tools" },
							h("input", { className: "ce-input", value: pickQuery, placeholder: t("db.pickSearch"), spellCheck: false, onChange: (event) => setPickQuery(event.target.value) }),
							CATEGORIES.map((category) => h("button", {
								key: category.id,
								type: "button",
								className: `cedb-cat${pickCategory === category.id ? " cedb-cat-on" : ""}`,
								onClick: () => setPickCategory(category.id),
							}, t(category.key)))),
						h("div", { className: "cedb-pick" }, pickableDrivers.map((id) => {
						const known = drivers.find((entry) => entry.id === id);
						return h("button", {
							key: id,
							type: "button",
							className: `cedb-pick-card${form.driver === id ? " cedb-pick-on" : ""}`,
							"aria-pressed": form.driver === id,
							onClick: () => setForm((current) => ({ ...current, driver: id, port: defaultPort(id) })),
							onDoubleClick: () => { setForm((current) => ({ ...current, driver: id, port: defaultPort(id) })); setStep("form"); },
						},
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
							onClick: () => setTab(id),
						}, t(key),
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
										onChange: (event) => applyAddress(event.target.value),
									})),
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
											onClick: () => setForm({ ...form, color }),
										}))))),
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
												onChange: (event) => setForm({ ...form, clientPath: event.target.value }),
											})),
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
												},
											}),
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
/**
 * The database tab's label in the sidebar strip.
 *
 * It used to return null, and a registered title slot *replaces* the fallback
 * the host would otherwise draw — which is why the tab showed nothing but its ✕.
 */
export function DbTitle({ useTabInfo }) {
	const info = useTabInfo ? useTabInfo() : null;
	const title = info?.tab?.title;
	const label = typeof title === "string" && title !== "" ? title : "数据库";
	return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(ToolGlyph, { size: 14, glyph: "db" })), label);
}

/** Pick-step categories; only the engines this plugin speaks. */
export const CATEGORIES = [
	{ id: "all", key: "db.catAll", ids: null },
	{ id: "relational", key: "db.catRelational", ids: ["mysql", "postgres"] },
	{ id: "file", key: "db.catFile", ids: ["sqlite"] },
];

/** Colour tags a connection can carry ("" means none). */
export const CONNECTION_COLORS = ["", "#e5484d", "#f5a524", "#3fb950", "#58a6ff", "#a371f7"];

/**
 * The port a driver uses when the field is left empty.
 *
 * @param driver - `sqlite` | `mysql` | `postgres`
 * @returns the port as a string, or "" for a file-backed driver
 */
export function defaultPort(driver) {
	if (driver === "mysql") return "3306";
	if (driver === "postgres") return "5432";
	return "";
}

/**
 * Which implementation of a driver will run, in one short suffix.
 *
 * The catalog prefers a project module over the CLI, so the dialog has to say
 * which one it picked — "MySQL" alone no longer identifies what will execute.
 *
 * @param driver - one entry from `db.drivers`
 * @param t - translator
 * @returns a suffix like ` · mysql2@3.11` or ` · CLI`, or ""
 */
export function implSuffix(driver, t) {
	if (!driver || !driver.impl) return "";
	if (driver.impl === "module") return ` · ${driver.version || t("db.implModule")}`;
	if (driver.impl === "cli") return ` · ${t("db.implCli")}`;
	return ` · ${t("db.implEmbedded")}`;
}

/** One grid row's height, in px — must match `.cedb-grid-row` in the stylesheet. */
/** Rows fetched per page for ad-hoc queries; bigger pages were slow to send. */
const QUERY_PAGE = 200;














