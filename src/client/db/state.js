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
import { useConnectWizard } from "./hooks/use-connect-wizard.js";
import { useMutations } from "./hooks/use-mutations.js";


/**
 * @param props - `{t, useTabInfo, sessionId, useSessions}` from the host tab
 * @returns every piece of state and every action the panel uses
 */
export function useWorkbench({ t, useTabInfo, sessionId, useSessions }) {

	const cwd = useSessions ? useSessions((sessions) => (sessionId ? sessions.byId[sessionId]?.cwd : void 0)) : void 0;


	// The Host owns the live connections; this hook owns the client view of them.
	const connectionStore = useConnections();
	const { connections, setConnections, activeConn, setActiveConn, activeDb, setActiveDb, disconnect } = connectionStore;


	const [collapsedDbs, setCollapsedDbs] = useState({});
	const [expanded, setExpanded] = useState(() => new Set()); // table keys open in the tree
	// Loading a workspace's `mysql2`/`pg` runs project code in the connection's
	// worker, so it is opt-in and remembered.
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

	// Saved connections live in their own hook: list, revision guard, writes.
	const profileStore = useProfiles({ cwd, onNotice: setNotice });
	const {
		profiles, setProfiles, revision: profileRevision,
		profileErrors, setProfileErrors, reload: reloadProfiles, save: rememberConnection, forget: forgetProfile,
		editingProfileId, setEditingProfileId,
	} = profileStore;

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

	// The new-connection dialog: its own form state, plus two world-effects.
	const wizard = useConnectWizard({
		cwd,
		t,
		drivers,
		allowModule,
		saveDraft: rememberConnection,
		onNotice: setNotice,
		onEditProfile: setEditingProfileId,
		onConnected: async (connection) => {
			setConnections((current) => [...current.filter((entry) => entry.id !== connection.id), connection]);
			setActiveConn(connection.id);
			setActiveDb({ conn: connection.id, database: connection.database ?? "" });
			await refreshSchema(connection.id);
		},
	});
	const {
		connectOpen, setConnectOpen, form, setForm, step, setStep, tab, setTab,
		showPassword, setShowPassword, pickQuery, setPickQuery, pickCategory, setPickCategory,
		saveProfile, setSaveProfile, testState, setTestState,
		openConnect, useSavedProfile, setDriver, applyAddress, pickableDrivers,
		driverReady, canConnect, connectParams, doTest, doConnect,
	} = wizard;
	// Modal layer: driver manager, ER diagram, execution plan, import.
	const [modal, setModal] = useState(null);

	// Grid edits: one rule for every write (addressed by primary key).
	const mutationStore = useMutations({
		t,
		connections,
		activeConn,
		activeTab,
		schemas,
		loadRows,
		onNotice: setNotice,
		onModal: setModal,
	});
	const {
		cellEdit, setCellEdit, pendingDelete, setPendingDelete,
		cellDetail, setCellDetail, explainState, setExplainState,
		tableEntry, pkColumn,
		runMutation, commitCell, removeRow, insertRow, importRows, runExplain,
	} = mutationStore;
	const [exportOpen, setExportOpen] = useState(false);
	// dbx migration: preview first, write on the second click.

	// The dialog's "Test" result: a connection proven without being kept.
	const [historyOpen, setHistoryOpen] = useState(false);
	const detailRef = useDismissLayer({ open: Boolean(cellDetail), onDismiss: () => setCellDetail(null) });
	const connectRef = useDismissLayer({ open: connectOpen, onDismiss: () => setConnectOpen(false) });

	/**
	 * Read the driver probes. `refresh` asks the Host to look again (a client
	 * installed while this dialog is open should be picked up without a reload).
	 */



	// --- connections ----------------------------------------------------------------------




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
