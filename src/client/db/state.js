/** The workbench's single state owner.
 *
 * Every hook, effect and action the database panel needs lives here; the view
 * modules only read the object this returns. That is what lets the rail, the tab
 * panes and the dialogs stay presentational, and it keeps the action graph in one
 * place instead of spread across the markup.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "../react.js";
import { api } from "../api.js";
import { useAutoHeight } from "../autosize.js";
import { deleteRowSql, toInsertSql, toJsonRows, updateCellSql } from "../dbtools.js";
import { DRIVERS, driverLabel, parseConnectionAddress } from "../dbconnect.js";
import { useDismissLayer } from "../dismiss.js";
import { HISTORY_CAP, PAGE_SIZE, countOf, requestToken, toCsv } from "./format.js";
import { CATEGORIES, defaultPort } from "./meta.js";


/**
 * @param props - `{t, useTabInfo, sessionId, useSessions}` from the host tab
 * @returns every piece of state and every action the panel uses
 */
export function useWorkbench({ t, useTabInfo, sessionId, useSessions }) {

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
		tunnelHost: "", tunnelPort: "22", tunnelUser: "", tunnelKey: "", tunnelLocalPort: "" });
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
			clientPath: "" });
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
			return { activeConn, activeDb, activeTab, activeTabId, allowModule, applyAddress, canConnect, cancelQuery, cellDetail, cellEdit, closeTab, collapsedDbs, commitCell, connectOpen, connectParams, connectProfile, connectRef, connections, copyCommand, copyResult, counts, cwd, databasesOf, dbxState, detailRef, doConnect, doDisconnect, doTest, driverReady, drivers, editingProfileId, expanded, explainState, exportOpen, exportResult, fetchRows, fetched, filter, forgetProfile, form, history, historyOpen, installDriverModule, loadRows, modal, notice, onKeyDown, openConnect, openConns, openQueryTab, openTab, openTable, patchTab, pendingDelete, pickCategory, pickQuery, pickableDrivers, pkColumn, probeDrivers, profileErrors, profileRevision, profiles, refreshSchema, rememberConnection, removeRow, runDbxImport, runMutation, runQuery, saveProfile, schema, schemaBusy, schemaError, schemas, selectDatabase, setActiveConn, setActiveDb, setActiveTabId, setAllowModule, setCellDetail, setCellEdit, setCollapsedDbs, setConnectOpen, setConnections, setDbxState, setDriver, setDrivers, setEditingProfileId, setExpanded, setExplainState, setExportOpen, setFilter, setForm, setHistory, setHistoryOpen, setModal, setNotice, setOpenConns, setPendingDelete, setPickCategory, setPickQuery, setProfileErrors, setProfiles, setSaveProfile, setSchemaBusy, setSchemaError, setSchemas, setShowPassword, setStep, setTab, setTabs, setTestState, showPassword, sortBy, sqlRef, step, t, tab, tableEntry, tabs, testState, toggleTable, useSavedProfile };
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
			database: parsed.database }));
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
				clientPath: draft.clientPath ?? "" },
			driver: draft.driver,
			address: draft.address,
			path: absolute,
			host: draft.host,
			port: Number(draft.port) || defaultPort,
			user: draft.user,
			database: draft.database,
			...(draft.password ? { password: draft.password } : {}) });
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
					localPort: Number(form.tunnelLocalPort) || 0 };
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
			filter: tab.filter });
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
			result: null });
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
			ms: 0 });
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
					databases: schemaFor.databases.map((entry) => (entry.name === databaseName ? fetched : entry)) } };
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
			pkValue });
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
			pkValue });
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



	return { activeConn, activeDb, activeTab, activeTabId, allowModule, applyAddress, canConnect, cancelQuery, cellDetail, cellEdit, closeTab, collapsedDbs, commitCell, connectOpen, connectParams, connectProfile, connectRef, connections, copyCommand, copyResult, counts, cwd, databasesOf, dbxState, detailRef, doConnect, doDisconnect, doTest, driverReady, drivers, editingProfileId, expanded, explainState, exportOpen, exportResult, fetchRows, fetched, filter, forgetProfile, form, history, historyOpen, installDriverModule, loadRows, modal, notice, onKeyDown, openConnect, openConns, openQueryTab, openTab, openTable, patchTab, pendingDelete, pickCategory, pickQuery, pickableDrivers, pkColumn, probeDrivers, profileErrors, profileRevision, profiles, refreshSchema, rememberConnection, removeRow, runDbxImport, runMutation, runQuery, saveProfile, schema, schemaBusy, schemaError, schemas, selectDatabase, setActiveConn, setActiveDb, setActiveTabId, setAllowModule, setCellDetail, setCellEdit, setCollapsedDbs, setConnectOpen, setConnections, setDbxState, setDriver, setDrivers, setEditingProfileId, setExpanded, setExplainState, setExportOpen, setFilter, setForm, setHistory, setHistoryOpen, setModal, setNotice, setOpenConns, setPendingDelete, setPickCategory, setPickQuery, setProfileErrors, setProfiles, setSaveProfile, setSchemaBusy, setSchemaError, setSchemas, setShowPassword, setStep, setTab, setTabs, setTestState, showPassword, sortBy, sqlRef, step, t, tab, tableEntry, tabs, testState, toggleTable, useSavedProfile };
}
