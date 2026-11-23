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
import { useSchemaCache } from "./hooks/use-schema-cache.js";
import { useProfiles } from "./hooks/use-profiles.js";
import { useTabs } from "./hooks/use-tabs.js";
import { useConnections } from "./hooks/use-connections.js";
import { useDrivers } from "./hooks/use-drivers.js";


/**
 * @param props - `{t, useTabInfo, sessionId, useSessions}` from the host tab
 * @returns every piece of state and every action the panel uses
 */
export function useWorkbench({ t, useTabInfo, sessionId, useSessions }) {

	const cwd = useSessions ? useSessions((sessions) => (sessionId ? sessions.byId[sessionId]?.cwd : void 0)) : void 0;


	// The Host owns the live connections; this hook owns the client view of them.
	const connectionStore = useConnections();
	const { connections, setConnections, activeConn, setActiveConn, activeDb, setActiveDb, disconnect } = connectionStore;


	// A cell being edited, plus which row is waiting for a second click to delete.
	const [cellEdit, setCellEdit] = useState(null);
	const [pendingDelete, setPendingDelete] = useState(-1);
	const [collapsedDbs, setCollapsedDbs] = useState({});
	const [expanded, setExpanded] = useState(() => new Set()); // table keys open in the tree
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
	const [cellDetail, setCellDetail] = useState(null); // {title, value}
	const [notice, setNotice] = useState("");
	const [importState, setImportState] = useState(null);
	// The driver catalog: readiness, the project-module permission and installs.
	const driverStore = useDrivers({ cwd, t, onNotice: setNotice });
	const {
		drivers, probe: probeDrivers, allowModule, setAllowModule,
		installState, install: installDriverModule, copyCommand,
	} = driverStore;
	// The dialogs consume one object: import progress and install progress.
	const dbxState = { ...(importState ?? {}), ...(installState ?? {}) };
	// Schema cache: the rail's tree data and its filter, in its own hook.
	const schemaCache = useSchemaCache({
		activeConn,
		connections,
		t,
		onSelect: (connId, database) => { setActiveConn(connId); setActiveDb({ conn: connId, database }); },
		onNotice: setNotice,
	});
	const {
		schemas, setSchemas, openConns, setOpenConns, schema,
		schemaBusy, setSchemaBusy, schemaError, setSchemaError,
		filter, setFilter, refreshSchema, selectDatabase, databasesOf,
	} = schemaCache;

	// Tabs and queries: table pages and free SQL share one tab record.
	const tabStore = useTabs({
		connections,
		setConnections,
		activeConn,
		setActiveConn,
		t,
		refreshSchema,
		onNotice: setNotice,
	});
	const {
		tabs, setTabs, activeTab, activeTabId, setActiveTabId, history, setHistory, sqlRef,
		patchTab, openTab, closeTab, openQueryTab, openTable, loadRows, fetchRows, sortBy,
		runQuery, cancelQuery, copyResult, exportResult,
	} = tabStore;
	// Modal layer: driver manager, ER diagram, execution plan, import.
	const [modal, setModal] = useState(null);
	const [explainState, setExplainState] = useState({ busy: false, result: null, error: "" });
	const [exportOpen, setExportOpen] = useState(false);
	// dbx migration: preview first, write on the second click.
	// Which saved profile the dialog is editing, so saving updates it instead of
	// creating a near-duplicate. Set when a saved connection is opened or lacks a
	// password.
	const [editingProfileId, setEditingProfileId] = useState("");

	// Saved connections live in their own hook: list, revision guard, writes.
	const profileStore = useProfiles({ cwd, editingProfileId, onNotice: setNotice });
	const {
		profiles, setProfiles, revision: profileRevision,
		profileErrors, setProfileErrors, reload: reloadProfiles, save: rememberConnection, forget: forgetProfile,
	} = profileStore;
	const [saveProfile, setSaveProfile] = useState(true);
	// The dialog's "Test" result: a connection proven without being kept.
	const [testState, setTestState] = useState({ busy: false, ok: null, text: "" });
	const [historyOpen, setHistoryOpen] = useState(false);
	const detailRef = useDismissLayer({ open: Boolean(cellDetail), onDismiss: () => setCellDetail(null) });
	const connectRef = useDismissLayer({ open: connectOpen, onDismiss: () => setConnectOpen(false) });

	/**
	 * Read the driver probes. `refresh` asks the Host to look again (a client
	 * installed while this dialog is open should be picked up without a reload).
	 */



	// --- connections ----------------------------------------------------------------------


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


	/** Read dbx's connection list, then import it on the second step. */
	const runDbxImport = useCallback(async (apply) => {
		setImportState((current) => ({ ...(current ?? {}), busy: true }));
		const res = await api("db.import.dbx", { apply });
		const value = res.ok ? res.value : null;
		if (!value || value.error) {
			setImportState({ busy: false, error: value?.error ?? res.error ?? "" });
			return;
		}
		setImportState({ busy: false, ...value });
		if (apply && value.imported > 0) {
			const list = await api("db.profile.list", {});
			if (list.ok) {
				profileRevision.current = list.value.revision ?? profileRevision.current;
				setProfiles(list.value.profiles ?? []);
			}
		}
	}, []);

	/** Save the current target as a reusable connection (password → Host vault). */

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
		await disconnect(id);
		// Tabs bound to this connection could only fail on their next request.
		setTabs((current) => current.filter((tab) => tab.conn !== id));
		setSchemas((current) => { const next = { ...current }; delete next[id]; return next; });
	}, [disconnect]);

	// --- table pages ----------------------------------------------------------------------

	
	/**
	 * Load one table page. `override` carries the new offset/order/filter so the
	 * request uses the values the user just picked instead of the state the
	 * closure was created with (React has not re-rendered yet at call time).
	 */
	
	
	
	// --- SQL tabs -------------------------------------------------------------------------

	
	
	/**
	 * Stop the statement running on this tab's connection.
	 *
	 * A CLI-backed connection survives (the child process is killed); a SQLite
	 * statement runs in a worker thread that cannot be interrupted in place, so
	 * cancelling ends that connection and the panel says so.
	 */
	
	/** Copy the current result as JSON or as INSERT statements. */
	
	
	// --- tree ----------------------------------------------------------------------------


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

	/** Explain the active tab's statement and open the plan modal. */
	const runExplain = useCallback(() => {
		const conn = activeTab?.conn || activeConn;
		const sql = activeTab?.sql ?? "";
		setModal({ kind: "explain" });
		setExplainState({ busy: true, result: null, error: "" });
		api("db.explain", { id: conn, sql }).then((res) => {
			const value = res.ok ? res.value : null;
			if (!value || value.error) setExplainState({ busy: false, result: null, error: value?.error ?? res.error ?? "" });
			else setExplainState({ busy: false, result: value, error: "" });
		});
	}, [activeTab, activeConn]);

	/** Insert the rows of the add-row dialog. @returns an error message or "" */
	const insertRow = useCallback(async (target, table, database, values) => {
		const driver = connections.find((entry) => entry.id === target)?.driver;
		const sql = insertRowSql({ driver, table, database, values });
		if (sql === "") return t("db.importEmpty");
		const res = await api("db.query", { id: target, sql });
		if (!res.ok || res.value?.error) return res.value?.error ?? res.error;
		setModal(null);
		setNotice(t("db.rowInserted"));
		return "";
	}, [connections, t]);

	/** Insert pasted CSV/JSON rows. @returns an error message or the row count */
	const importRows = useCallback(async (target, table, text) => {
		const parsed = parseDataText(text);
		if (parsed.error !== "") return parsed.error;
		const driver = connections.find((entry) => entry.id === target)?.driver;
		const sql = toInsertSql(parsed, table, driver);
		if (sql === "") return t("db.importEmpty");
		const res = await api("db.query", { id: target, sql, limit: 1 });
		if (!res.ok || res.value?.error) return res.value?.error ?? res.error;
		setModal(null);
		setNotice(t("db.imported").replace("{n}", String(parsed.rows.length)));
		return "";
	}, [connections, t]);

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



	return { activeConn, activeDb, activeTab, activeTabId, allowModule, applyAddress, canConnect, cancelQuery, cellDetail, cellEdit, closeTab, collapsedDbs, commitCell, connectOpen, connectParams, connectProfile, connectRef, connections, copyCommand, copyResult, counts, cwd, databasesOf, dbxState, detailRef, doConnect, doDisconnect, doTest, driverReady, drivers, editingProfileId, expanded, explainState, exportOpen, exportResult, fetchRows, filter, forgetProfile, form, history, historyOpen, installDriverModule, loadRows, modal, notice, onKeyDown, openConnect, openConns, openQueryTab, openTab, openTable, patchTab, pendingDelete, pickCategory, pickQuery, pickableDrivers, pkColumn, probeDrivers, profileErrors, profileRevision, profiles, refreshSchema, rememberConnection, removeRow, runDbxImport, runMutation, runQuery, saveProfile, schema, schemaBusy, schemaError, schemas, selectDatabase, setActiveConn, setActiveDb, setActiveTabId, setAllowModule, setCellDetail, setCellEdit, setCollapsedDbs, setConnectOpen, setConnections, setDriver, setEditingProfileId, setExpanded, setExplainState, setExportOpen, setFilter, setForm, setHistory, setHistoryOpen, setModal, setNotice, setOpenConns, setPendingDelete, setPickCategory, setPickQuery, setProfileErrors, setProfiles, setSaveProfile, setSchemaBusy, setSchemaError, setSchemas, setShowPassword, setStep, setTab, setTabs, setTestState, showPassword, sortBy, sqlRef, step, t, tab, tableEntry, tabs, testState, toggleTable, useSavedProfile };
}
