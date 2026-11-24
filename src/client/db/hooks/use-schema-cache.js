/** One schema per open connection, plus the rail's view of it.
 *
 * The rail renders a tree of instances → databases → tables; this hook owns the
 * tree data, which instance is expanded, the error of the last load, and the
 * table-name filter. It knows nothing about tabs or the connect dialog, which is
 * what lets it be unit-tested on its own.
 */

import { useCallback, useState } from "../../react.js";
import { api } from "../../api.js";

/**
 * @param options - `{activeConn, connections, t, onSelect, onNotice}`
 *   `onSelect(connId, database)` lets the workbench move its active target;
 *   `onNotice(text)` surfaces a message (PostgreSQL cannot switch databases).
 * @returns the schema map, expansion state, filter and the loaders
 */
export function useSchemaCache({ activeConn, connections, t, onSelect, onNotice }) {
	const [schemas, setSchemas] = useState({});
	const [openConns, setOpenConns] = useState({});
	const [schemaBusy, setSchemaBusy] = useState(false);
	// Per connection: a stale error from another connection must not be shown
	// under whichever connection happens to be active now.
	const [schemaErrors, setSchemaErrors] = useState({});
	const schemaError = schemaErrors[activeConn] ?? "";
	// The rail's search box: it narrows table names inside every expanded instance.
	const [filter, setFilter] = useState("");

	const clearSchemaError = useCallback((id) => {
		setSchemaErrors((current) => {
			if (!(id in current)) return current;
			const next = { ...current };
			delete next[id];
			return next;
		});
	}, []);

	/** Load (or reload) one connection's tree. */
	const refreshSchema = useCallback(async (id = activeConn) => {
		if (!id) return;
		setSchemaBusy(true);
		clearSchemaError(id);
		const res = await api("db.schema", { id });
		setSchemaBusy(false);
		if (res.ok) {
			setSchemas((current) => ({ ...current, [id]: res.value }));
			setOpenConns((current) => ({ ...current, [id]: true }));
			clearSchemaError(id);
		} else {
			setSchemas((current) => { const next = { ...current }; delete next[id]; return next; });
			setSchemaErrors((current) => ({ ...current, [id]: res.error }));
		}
	}, [activeConn, clearSchemaError]);

	/**
	 * Select a database, loading its tables the first time.
	 *
	 * MySQL lists every database but only introspects one; clicking another used
	 * to select a name with no tables behind it.
	 */
	const selectDatabase = useCallback(async (connId, databaseName) => {
		onSelect(connId, databaseName);
		const known = schemas[connId]?.databases?.find((entry) => entry.name === databaseName);
		if (known && known.tables.length > 0) return;
		// PostgreSQL binds a connection to one database; there is no `USE`.
		if (connections.find((entry) => entry.id === connId)?.driver === "postgres") {
			onNotice(t("db.pgCrossDatabase"));
			return;
		}
		const res = await api("db.schema", { id: connId, database: databaseName });
		if (!res.ok || !res.value) {
			setSchemaErrors((current) => ({ ...current, [connId]: res.error ?? "" }));
			return;
		}
		const fetched = (res.value.databases ?? []).find((entry) => entry.name === databaseName);
		if (!fetched) return;
		clearSchemaError(connId);
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
	}, [schemas, connections, t, onSelect, onNotice, clearSchemaError]);

	/** The databases of one instance, filtered by the rail's search box. */
	const databasesOf = useCallback((connId) => {
		const needle = filter.trim().toLowerCase();
		const databases = (schemas[connId]?.databases ?? []).map((database) => {
			const entries = (database.tables ?? []).filter((entry) => !needle || entry.name.toLowerCase().includes(needle));
			return { ...database, tables: entries };
		});
		return needle ? databases.filter((database) => database.tables.length > 0) : databases;
	}, [schemas, filter]);

	return {
		schemas, setSchemas, openConns, setOpenConns,
		schema: schemas[activeConn] ?? null,
		schemaBusy, setSchemaBusy, schemaError, schemaErrors, clearSchemaError,
		filter, setFilter,
		refreshSchema, selectDatabase, databasesOf,
	};
}
