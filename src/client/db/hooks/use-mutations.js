/** Edits made from the result grid: cell update, row delete, row insert, import.
 *
 * Every write follows the same shape: build the statement from the table page's
 * primary key, run it through `db.query`, report the result to the panel and
 * reload the page that changed. Keeping them together means the "addressed by
 * primary key" rule is stated once.
 */

import { useCallback, useMemo, useState } from "../../react.js";
import { api } from "../../api.js";
import { deleteRowSql, insertRowSql, parseDataText, toInsertSql, updateCellSql } from "../../dbtools.js";

/**
 * @param options - `{t, connections, activeConn, activeTab, schemas, loadRows, onNotice, onModal}`
 * @returns the edit state, the derived primary key and the write actions
 */
export function useMutations({ t, connections, activeConn, activeTab, schemas, loadRows, onNotice, onModal }) {
	// A cell being edited, plus which row is waiting for a second click to delete.
	const [cellEdit, setCellEdit] = useState(null);
	const [pendingDelete, setPendingDelete] = useState(-1);
	const [cellDetail, setCellDetail] = useState(null); // {title, value}
	const [explainState, setExplainState] = useState({ busy: false, result: null, error: "" });

	/** The schema entry behind the open table tab, when there is one. */
	const tableEntry = useMemo(() => {
		if (activeTab?.kind !== "table") return null;
		const schemaFor = schemas[activeTab.conn || activeConn];
		const database = (schemaFor?.databases ?? []).find((entry) => entry.name === activeTab.database);
		return (database?.tables ?? []).find((entry) => entry.name === activeTab.table) ?? null;
	}, [activeTab, schemas, activeConn]);

	const pkColumn = tableEntry?.columns?.find((column) => column.primaryKey)?.name ?? "";

	const driverOf = (conn) => connections.find((entry) => entry.id === conn)?.driver;

	/** Run one write, then reload the page it touched. */
	const runMutation = useCallback(async (sql, message) => {
		const conn = activeTab?.conn || activeConn;
		if (!conn || sql === "") return;
		const res = await api("db.query", { id: conn, sql });
		const value = res.ok ? res.value : null;
		if (!value || value.error) { onNotice(value?.error ?? res.error ?? ""); return; }
		onNotice(message);
		setCellEdit(null);
		setPendingDelete(-1);
		if (activeTab?.kind === "table") await loadRows(activeTab.id);
	}, [activeTab, activeConn, loadRows, onNotice]);

	/** Commit one edited cell, addressed by the row's primary key. */
	const commitCell = useCallback(async (rowIndex, column, value) => {
		const result = activeTab?.result;
		if (!result || pkColumn === "") return;
		const pkValue = result.rows?.[rowIndex]?.[result.columns.indexOf(pkColumn)];
		const sql = updateCellSql({
			driver: driverOf(activeTab.conn || activeConn),
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
			driver: driverOf(activeTab.conn || activeConn),
			table: activeTab.table,
			database: activeTab.database,
			pkColumn,
			pkValue,
		});
		await runMutation(sql, t("db.rowDeleted"));
	}, [activeTab, pkColumn, pendingDelete, connections, activeConn, runMutation, t]);

	/** Insert the rows of the add-row dialog. @returns an error message or "" */
	const insertRow = useCallback(async (target, table, database, values) => {
		const sql = insertRowSql({ driver: driverOf(target), table, database, values });
		if (sql === "") return t("db.importEmpty");
		const res = await api("db.query", { id: target, sql });
		if (!res.ok || res.value?.error) return res.value?.error ?? res.error;
		onModal(null);
		onNotice(t("db.rowInserted"));
		return "";
	}, [connections, t, onModal, onNotice]);

	/** Insert pasted CSV/JSON rows. @returns an error message or "" */
	const importRows = useCallback(async (target, table, text) => {
		const parsed = parseDataText(text);
		if (parsed.error !== "") return parsed.error;
		const sql = toInsertSql(parsed, table, driverOf(target));
		if (sql === "") return t("db.importEmpty");
		const res = await api("db.query", { id: target, sql, limit: 1 });
		if (!res.ok || res.value?.error) return res.value?.error ?? res.error;
		onModal(null);
		onNotice(t("db.imported").replace("{n}", String(parsed.rows.length)));
		return "";
	}, [connections, t, onModal, onNotice]);

	/** Explain the active tab's statement and open the plan modal. */
	const runExplain = useCallback(() => {
		const conn = activeTab?.conn || activeConn;
		const sql = activeTab?.sql ?? "";
		onModal({ kind: "explain" });
		setExplainState({ busy: true, result: null, error: "" });
		api("db.explain", { id: conn, sql }).then((res) => {
			const value = res.ok ? res.value : null;
			if (!value || value.error) setExplainState({ busy: false, result: null, error: value?.error ?? res.error ?? "" });
			else setExplainState({ busy: false, result: value, error: "" });
		});
	}, [activeTab, activeConn, onModal]);

	return {
		cellEdit, setCellEdit, pendingDelete, setPendingDelete,
		cellDetail, setCellDetail, explainState, setExplainState,
		tableEntry, pkColumn,
		runMutation, commitCell, removeRow, insertRow, importRows, runExplain,
	};
}
