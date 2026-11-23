/** The read operations: schema, columns, table pages, ad-hoc queries.
 *
 * These are what every engine has to answer. They talk to the CLI adapters and
 * the registry only, never to the facade, so the dependency arrow points one way.
 */

import { cliQuery } from "./cli.js";
import { connOf } from "./registry.js";
import { filterClause, pageable, quoteIdent } from "./sql.js";

/** How many rows one table page may return. */
export const PAGE_CAP = 500;
/** How many rows one ad-hoc query page may return. */
export const QUERY_CAP = 10_000;

/** Full schema: databases (attached / server-wide), tables and views with columns. */
export async function schema(id, options = {}) {
	const conn = connOf(id);
	const database = String(options.database ?? "");
	// A runner-backed connection answers from its own implementation: SQLite in a
	// worker, or a project-local mysql2/pg. Only CLI connections fall through.
	if (conn.runner) return await conn.runner.call("schema", { path: conn.config?.path ?? "", database });
	if (conn.driver === "mysql") return mysqlSchema(conn, database);
	return postgresSchema(conn);
}

async function mysqlSchema(conn, target = "") {
	const dbs = await cliQuery(conn, "SHOW DATABASES");
	const hidden = new Set(["information_schema", "performance_schema", "mysql", "sys"]);
	const names = dbs.rows.map((row) => row[0]).filter((name) => !hidden.has(String(name)));
	// The tree shows one database at a time; clicking another asks for it by name.
	const current = String(target || "") || conn.config.database || names[0] || "";
	const databases = [];
	for (const name of names) {
		if (name !== current) {
			// Only the current database is introspected: listing every schema's
			// tables would multiply CLI round trips on a server with many
			// databases, and the grid can only browse one at a time anyway.
			databases.push({ name, tables: [] });
			continue;
		}
		const res = await cliQuery(conn, `SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA='${String(name).replace(/'/g, "''")}' ORDER BY TABLE_NAME`);
		const cols = await cliQuery(conn, `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${String(name).replace(/'/g, "''")}' ORDER BY TABLE_NAME, ORDINAL_POSITION`);
		// Foreign keys in one query, grouped per table for the ER diagram.
		const fkRes = await cliQuery(conn, `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='${String(name).replace(/'/g, "''")}' AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME, ORDINAL_POSITION`);
		const fkMap = new Map();
		for (const [table, column, refTable, refColumn] of fkRes.rows) {
			if (!fkMap.has(table)) fkMap.set(table, new Map());
			const perTable = fkMap.get(table);
			if (!perTable.has(refTable)) perTable.set(refTable, { refTable, columns: [], refColumns: [] });
			const entry = perTable.get(refTable);
			entry.columns.push(column);
			entry.refColumns.push(refColumn ?? "");
		}
		const byTable = new Map();
		for (const row of cols.rows) {
			const [table, column, type, nullable, defaultValue, key] = row;
			if (!byTable.has(table)) byTable.set(table, []);
			byTable.get(table).push({
				name: column,
				type,
				nullable: String(nullable).toUpperCase() === "YES",
				primaryKey: key === "PRI",
				defaultValue: defaultValue === null ? null : defaultValue,
			});
		}
		const tables = res.rows.map(([table, kind]) => ({
			name: table,
			kind: String(kind).toUpperCase().includes("VIEW") ? "view" : "table",
			columns: byTable.get(table) ?? [],
			indexes: [],
			foreignKeys: [...(fkMap.get(table)?.values() ?? [])],
		}));
		databases.push({ name, tables });
	}
	return { driver: "mysql", databases, current };
}

async function postgresSchema(conn) {
	const dbs = await cliQuery(conn, "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname");
	const names = dbs.rows.map((row) => row[0]);
	const current = conn.config.database || names[0] || "";
	const databases = [];
	for (const name of names) {
		if (name !== current) {
			databases.push({ name, tables: [] });
			continue;
		}
		const relations = await cliQuery(conn, "SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name");
		const cols = await cliQuery(conn, "SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name, ordinal_position");
		// One query for every foreign key; grouped per table for the ER diagram.
		const fkRes = await cliQuery(conn, "SELECT tc.table_schema, tc.table_name, kcu.column_name, ccu.table_schema AS ref_schema, ccu.table_name AS ref_table, ccu.column_name AS ref_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position");
		const fkMap = new Map();
		for (const [schemaName, table, column, refSchema, refTable, refColumn] of fkRes.rows) {
			const key = `${schemaName}.${table}`;
			if (!fkMap.has(key)) fkMap.set(key, new Map());
			const perTable = fkMap.get(key);
			const refKey = `${refSchema}.${refTable}`;
			if (!perTable.has(refKey)) perTable.set(refKey, { refTable, columns: [], refColumns: [] });
			const entry = perTable.get(refKey);
			entry.columns.push(column);
			entry.refColumns.push(refColumn ?? "");
		}
		const byTable = new Map();
		for (const row of cols.rows) {
			const [schemaName, table, column, type, nullable, defaultValue] = row;
			const key = `${schemaName}.${table}`;
			if (!byTable.has(key)) byTable.set(key, []);
			byTable.get(key).push({
				name: column,
				type,
				nullable: nullable === "YES",
				primaryKey: false,
				defaultValue: defaultValue ?? null,
			});
		}
		const tables = relations.rows.map(([schemaName, table, kind]) => ({
			name: table,
			schema: schemaName,
			kind: String(kind).includes("VIEW") ? "view" : "table",
			columns: byTable.get(`${schemaName}.${table}`) ?? [],
			indexes: [],
			foreignKeys: [...(fkMap.get(`${schemaName}.${table}`)?.values() ?? [])],
		}));
		databases.push({ name, tables });
	}
	return { driver: "postgres", databases, current };
}

/** Columns of one table, fetched on demand by the structure view. */
export async function columns(id, table, database) {
	const conn = connOf(id);
	if (conn.runner) return await conn.runner.call("columns", { table, database });
	if (conn.driver === "mysql") {
		const db = String(database || conn.config.database || "").replace(/'/g, "''");
		const res = await cliQuery(conn, `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${db}' AND TABLE_NAME='${String(table).replace(/'/g, "''")}' ORDER BY ORDINAL_POSITION`);
		return res.rows.map(([name, type, nullable, defaultValue, key, extra]) => ({
			name, type, nullable: String(nullable).toUpperCase() === "YES", primaryKey: key === "PRI", defaultValue, extra,
		}));
	}
	const schemaName = String(database || "public").replace(/'/g, "''");
	const res = await cliQuery(conn, `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_schema='${schemaName}' AND table_name='${String(table).replace(/'/g, "''")}' ORDER BY ordinal_position`);
	return res.rows.map(([name, type, nullable, defaultValue, maxLength]) => ({
		name, type, nullable: nullable === "YES", primaryKey: false, defaultValue, maxLength: Number(maxLength) || null,
	}));
}

/** One page of a table: rows, the columns they came in, and the total. */
export async function rows(id, table, options = {}) {
	const conn = connOf(id);
	const limit = Math.min(Math.max(Number(options.limit) || 100, 1), PAGE_CAP);
	const offset = Math.max(Number(options.offset) || 0, 0);
	const orderColumn = typeof options.order === "string" ? options.order : "";
	const orderDir = String(options.dir).toLowerCase() === "desc" ? "DESC" : "ASC";
	const token = typeof options.token === "string" ? options.token : "";

	if (conn.runner) {
		const previous = conn.runningToken;
		conn.runningToken = token;
		try {
			return await conn.runner.call("rows", { table, database: options.database, limit, offset, order: orderColumn, dir: orderDir, filter: options.filter });
		} finally {
			conn.runningToken = previous;
		}
	}
	if (conn.driver === "mysql") {
		const cols = await columns(id, table, options.database);
		const where = filterClause("mysql", cols, options.filter);
		const validOrder = cols.some((c) => c.name === orderColumn);
		// A table from another database must be qualified, or the query would hit
		// whichever database the session happens to default to.
		const qualifiedTable = String(options.database ?? "").trim() === ""
			? quoteIdent("mysql", table)
			: `${quoteIdent("mysql", String(options.database))}.${quoteIdent("mysql", table)}`;
		const sql = [
			`SELECT * FROM ${qualifiedTable}`,
			where ? `WHERE ${where}` : "",
			validOrder ? `ORDER BY ${quoteIdent("mysql", orderColumn)} ${orderDir}` : "",
			`LIMIT ${limit} OFFSET ${offset}`,
		].filter(Boolean).join(" ");
		const res = await cliQuery(conn, sql, token);
		const countRes = await cliQuery(conn, `SELECT COUNT(*) FROM ${qualifiedTable}${where ? ` WHERE ${where}` : ""}`, token);
		return { columns: res.columns, rows: res.rows, total: Number(countRes.rows[0]?.[0] ?? 0), offset, limit };
	}
	const schemaName = String(options.database || "public");
	const cols = await columns(id, table, schemaName);
	const where = filterClause("postgres", cols, options.filter);
	const validOrder = cols.some((c) => c.name === orderColumn);
	const qualified = `${quoteIdent("postgres", schemaName)}.${quoteIdent("postgres", table)}`;
	const sql = [
		`SELECT * FROM ${qualified}`,
		where ? `WHERE ${where}` : "",
		validOrder ? `ORDER BY ${quoteIdent("postgres", orderColumn)} ${orderDir}` : "",
		`LIMIT ${limit} OFFSET ${offset}`,
	].filter(Boolean).join(" ");
	const res = await cliQuery(conn, sql, token);
	const countRes = await cliQuery(conn, `SELECT COUNT(*) FROM ${qualified}${where ? ` WHERE ${where}` : ""}`, token);
	return { columns: cols.map((c) => c.name), rows: res.rows, total: Number(countRes.rows[0]?.[0] ?? 0), offset, limit };
}

export async function query(id, sql, limit, token, offset = 0) {
	const conn = connOf(id);
	const text = String(sql ?? "").trim();
	if (text === "") throw new Error("the query is empty");
	const cap = Math.min(Math.max(Number(limit) || QUERY_CAP, 1), QUERY_CAP);
	const skip = Math.max(Number(offset) || 0, 0);
	const started = Date.now();
	// A read-only statement is paged on the server: `select *` on a wide table can
	// be tens of megabytes, and sending all of it is what made Run feel slow.
	const pageSql = pageable(text) ? `SELECT * FROM (${text.replace(/;\s*$/, "")}) AS __ce_page LIMIT ${cap + 1}${skip > 0 ? ` OFFSET ${skip}` : ""}` : text;

	if (conn.runner) {
		const previous = conn.runningToken;
		conn.runningToken = typeof token === "string" ? token : "";
		try {
			const res = await conn.runner.call("query", { sql: pageSql, limit: cap + 1 });
			if (!pageable(text)) return res;
			const rows = Array.isArray(res.rows) ? res.rows : [];
			return { ...res, rows: rows.slice(0, cap), hasMore: rows.length > cap, offset: skip, ms: Date.now() - started };
		} finally {
			conn.runningToken = previous;
		}
	}
	if (conn.driver === "mysql") {
		const write = /^\s*(insert|update|delete|replace|alter|create|drop|truncate|rename|grant|revoke)\b/i.test(text);
		const res = await cliQuery(conn, pageSql, token, { verbose: write });
		const over = res.rows.length > cap;
		return {
			columns: res.columns,
			rows: over ? res.rows.slice(0, cap) : res.rows,
			truncated: over,
			hasMore: over,
			offset: skip,
			ms: Date.now() - started,
			...(res.changes !== undefined ? { changes: res.changes } : {}),
		};
	}
	// The token must reach the child process too, or Stop cannot name the
	// statement it wants to cancel on a PostgreSQL connection.
	const res = await cliQuery(conn, pageSql, token);
	const over = res.rows.length > cap;
	return {
		columns: res.columns,
		rows: over ? res.rows.slice(0, cap) : res.rows,
		truncated: over,
		hasMore: over,
		offset: skip,
		ms: Date.now() - started,
		...(res.changes !== undefined ? { changes: res.changes } : {}),
	};
}

/**
 * Ask the server how it will run a statement.
 *
 * SQLite's `EXPLAIN QUERY PLAN` returns a parent/child tree, which the panel
 * draws as a tree; MySQL and PostgreSQL return tabular plans and are shown as a
 * table. The statement is never executed.
 *
 * @param id - connection id
 * @param sql - the statement to explain
 * @returns `{driver, columns, rows}`
 */
export async function explain(id, sql) {
	const conn = connOf(id);
	const text = String(sql ?? "").trim();
	if (text === "") throw new Error("the query is empty");
	if (conn.driver === "sqlite") {
		const res = await query(id, `EXPLAIN QUERY PLAN ${text}`, 2000);
		return { driver: "sqlite", columns: res.columns, rows: res.rows, tree: true };
	}
	const limit = 1000;
	if (conn.driver === "mysql") {
		const res = await cliQuery(conn, `EXPLAIN ${text}`);
		return { driver: "mysql", columns: res.columns, rows: res.rows.slice(0, limit), tree: false };
	}
	const res = await cliQuery(conn, `EXPLAIN ${text}`);
	return { driver: "postgres", columns: res.columns, rows: res.rows.slice(0, limit), tree: false };
}
