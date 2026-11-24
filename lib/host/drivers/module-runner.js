/** A database runner backed by a JAVASCRIPT driver module.
 *
 * The middle rung of the ladder in `docs/driver-architecture.md`: when the
 * session workspace already depends on `mysql2` or `pg`, the plugin can talk to
 * the server through it instead of shelling out to `mysql`/`psql`. That buys a
 * persistent session (real transactions), correct value types, and streaming,
 * at the cost of loading a module the user installed.
 *
 * Two rules keep this honest:
 *
 *   1. It runs inside the connection's worker (`db-worker.js`), so a driver
 *      that blocks or crashes takes one connection down with it, not the Host.
 *   2. The module is resolved by absolute path ahead of time (`modresolve.js`,
 *      whitelist + explicit permission); this file only loads what it is given.
 *
 * The returned object implements the same `Runner` shape as the SQLite runner:
 * `call(op, args)`, `cancel()`, `close()`.
 */

import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Read a PEM file the dialog points at, tolerating a missing one. */
function pem(path) {
	try {
		return path ? readFileSync(path) : undefined;
	} catch {
		return undefined;
	}
}

/** Parse the dialog's `k=v&k=v` parameters into an object. */
function urlParams(text) {
	const out = {};
	for (const [key, value] of new URLSearchParams(String(text ?? ""))) out[key] = value;
	return out;
}

/** TLS options shared by both drivers, derived from the dialog's settings. */
function tlsOptions(config) {
	const mode = String(config.sslMode ?? "").toLowerCase();
	if (mode === "" || mode === "disabled") return undefined;
	// `verify-*` means "actually check the chain"; `require`/`prefer` encrypt
	// without verifying, which is what MySQL's REQUIRED and PG's require mean.
	const verify = mode === "verify-ca" || mode === "verify-full";
	const ca = pem(config.sslCa);
	const cert = pem(config.sslCert);
	const key = pem(config.sslKey);
	return { rejectUnauthorized: verify, ...(ca ? { ca } : {}), ...(cert ? { cert } : {}), ...(key ? { key } : {}) };
}

/** Quote an identifier. */
function quote(driver, name) {
	return driver === "mysql"
		? `\`${String(name).replace(/`/g, "``")}\``
		: `"${String(name).replace(/"/g, '""')}"`;
}

/** `(a OR b)` over every column, with the needle escaped as data.
 *
 * MySQL has no `TEXT` cast target (CHAR, SIGNED, DECIMAL, …), and a backslash is
 * an escape inside its string literals — both matter here because this is the
 * default MySQL path now that the plugin ships mysql2.
 */
export function filterClause(driver, columns, filter) {
	const needle = String(filter ?? "").trim();
	if (needle === "" || columns.length === 0) return "";
	// `%`/`_` are wildcards, quotes end the literal, and MySQL also eats a
	// backslash: each has to be escaped for the filter to mean what it says.
	const likeEscaped = needle.replace(/[\\%_]/g, (ch) => `\\${ch}`);
	const literal = (driver === "mysql" ? likeEscaped.replace(/\\/g, "\\\\") : likeEscaped).replace(/'/g, "''");
	const castType = driver === "mysql" ? "CHAR" : "TEXT";
	const escape = driver === "mysql" ? "ESCAPE '\\\\'" : "ESCAPE '\\'";
	return `(${columns.map((column) => `CAST(${quote(driver, column)} AS ${castType}) LIKE '%${literal}%' ${escape}`).join(" OR ")})`;
}

/** Columns of one table from information_schema, shaped like the CLI driver's. */
function columnRows(driver, rows, schemaName) {
	return rows.map((row) => ({
		name: driver === "mysql" ? row.COLUMN_NAME : row.column_name,
		type: driver === "mysql" ? row.COLUMN_TYPE : row.data_type,
		nullable: driver === "mysql" ? String(row.IS_NULLABLE).toUpperCase() === "YES" : row.is_nullable === "YES",
		primaryKey: driver === "mysql" ? row.COLUMN_KEY === "PRI" : false,
		defaultValue: driver === "mysql" ? row.COLUMN_DEFAULT : row.column_default,
	}));
}

/**
 * Open a module-backed runner.
 *
 * @param options - `{driver, entry, config}`; `entry` is the resolved module path
 * @returns the Runner
 */
export async function openModuleRunner({ driver, entry, config }) {
	// mysql2's main entry is the callback API; the promise wrapper is a sibling
	// file. Loading the wrong one makes every `await connection.query(...)` fail
	// with "you have tried to call .then() on a non-promise".
	const target = driver === "mysql" ? await importMysqlPromise(entry) : entry;
	const loaded = await import(pathToFileURL(target).href);
	return driver === "mysql" ? mysqlRunner(loaded, config) : postgresRunner(loaded, config);
}

/** The `mysql2/promise` entry that sits beside the package's main file. */
async function importMysqlPromise(entry) {
	const candidate = join(dirname(entry), "promise.js");
	try {
		readFileSync(candidate);
		return candidate;
	} catch {
		return entry;
	}
}

/** mysql2-backed runner.
 *
 * MySQL closes idle connections (wait_timeout), and a cancelled statement
 * destroys the socket. The rail keeps a connection id until the user closes it,
 * so the next schema/page read must rebuild the session once instead of showing
 * "Can't add new command when connection is in closed state" forever.
 */
async function mysqlRunner(loaded, config) {
	const mysql = loaded.default ?? loaded;
	const params = urlParams(config.urlParams);
	const create = mysql.createConnection ?? mysql.createPool;
	const options = {
		host: config.host,
		port: config.port,
		user: config.user,
		password: config.password,
		database: config.database || undefined,
		// Values come back as JS types: the panel renders them, the agent reads them.
		supportBigNumbers: true,
		dateStrings: false,
		// `charset` is the one URL parameter mysql2 understands directly.
		...(params.charset ? { charset: params.charset } : {}),
		...(tlsOptions(config) ? { ssl: tlsOptions(config) } : {}),
	};
	let connection = null;
	let disposed = false;
	let lost = false;
	let opening = null;

	const attach = (target) => {
		// Without a handler an idle socket error is an unhandled worker error.
		target?.on?.("error", () => { lost = true; });
		target?.on?.("end", () => { lost = true; });
	};
	const open = async () => {
		const next = await create(options);
		attach(next);
		connection = next;
		lost = false;
		return next;
	};
	const reconnect = async () => {
		if (disposed) throw new Error("the connection is closed");
		if (opening === null) {
			opening = (async () => {
				const previous = connection;
				connection = null;
				try { await previous?.destroy?.(); } catch { /* already gone */ }
				await open();
			})().finally(() => { opening = null; });
		}
		await opening;
	};
	const ensure = async () => {
		if (disposed) throw new Error("the connection is closed");
		if (connection === null || lost) await reconnect();
	};
	const isLost = (error) => {
		if (error?.code === "PROTOCOL_CONNECTION_LOST" || error?.code === "ECONNRESET") return true;
		return /closed state|connection is closed|server has gone away|connection lost|connection terminated|cannot enqueue/i.test(String(error?.message ?? error));
	};
	const send = async (query) => {
		await ensure();
		try {
			return await connection.query(query);
		} catch (error) {
			if (disposed || !isLost(error)) throw error;
			lost = true;
			await reconnect();
			return connection.query(query);
		}
	};

	await open();

	/** Run one statement with array rows (the shape the op contract uses). */
	const run = async (sql) => {
		const [rows, fields] = await send({ sql, rowsAsArray: true });
		const columns = (fields ?? []).map((field) => field.name);
		return { columns, rows: Array.isArray(rows) ? rows : [] };
	};

	return {
		mode: "module",
		impl: "module",
		async call(op, args = {}) {
			if (disposed) throw new Error("the connection is closed");
			if (op === "query") {
				const text = String(args.sql ?? "").trim();
				if (text === "") throw new Error("the query is empty");
				const reader = /^\s*(select|with|show|describe|desc|explain|table|pragma)\b/i.test(text);
				if (!reader) {
					const [result] = await send(text);
					return { columns: [], rows: [], truncated: false, changes: Number(result?.affectedRows ?? 0) };
				}
				const result = await run(text);
				const cap = Math.max(1, Number(args.limit) || 10_000);
				const truncated = result.rows.length > cap;
				return { columns: result.columns, rows: truncated ? result.rows.slice(0, cap) : result.rows, truncated, changes: undefined };
			}
			if (op === "rows") {
				const table = String(args.table ?? "");
				// A table from another database must be qualified, or the page reads
				// whichever database the connection defaults to.
				const database = String(args.database ?? "");
				const target = database === "" ? quote("mysql", table) : `${quote("mysql", database)}.${quote("mysql", table)}`;
				const columns = (await this.call("columns", { table, database })).map((column) => column.name);
				const where = filterClause("mysql", columns.map((name) => ({ name })), args.filter);
				const order = columns.includes(args.order) ? ` ORDER BY ${quote("mysql", args.order)} ${String(args.dir).toLowerCase() === "desc" ? "DESC" : "ASC"}` : "";
				const limit = Math.max(1, Math.min(Number(args.limit) || 100, 500));
				const offset = Math.max(0, Number(args.offset) || 0);
				const page = await run(`SELECT * FROM ${target}${where ? ` WHERE ${where}` : ""}${order} LIMIT ${limit} OFFSET ${offset}`);
				const count = await run(`SELECT COUNT(*) AS n FROM ${target}${where ? ` WHERE ${where}` : ""}`);
				return { columns: page.columns, rows: page.rows, total: Number(count.rows[0]?.[0] ?? 0), offset, limit };
			}
			if (op === "columns") {
				const schemaName = String(args.database || config.database || "").replace(/'/g, "''");
				const table = String(args.table ?? "").replace(/'/g, "''");
				const res = await run(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${schemaName}' AND TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION`);
				const objects = res.rows.map((row) => Object.fromEntries(res.columns.map((column, index) => [column, row[index]])));
				return columnRows("mysql", objects, schemaName);
			}
			if (op === "schema") {
				const dbs = await run("SHOW DATABASES");
				const hidden = new Set(["information_schema", "performance_schema", "mysql", "sys"]);
				const names = dbs.rows.map((row) => String(row[0])).filter((name) => !hidden.has(name));
				// The rail loads a database on demand; without honouring the target it
				// re-introspected the connection's default one, so clicking another
				// database looked like it did nothing.
				const current = String(args.database ?? "") || config.database || names[0] || "";
				const tablesRes = await run(`SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA='${current.replace(/'/g, "''")}' ORDER BY TABLE_NAME`);
				const colsRes = await run(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${current.replace(/'/g, "''")}' ORDER BY TABLE_NAME, ORDINAL_POSITION`);
				const fkRes = await run(`SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='${current.replace(/'/g, "''")}' AND REFERENCED_TABLE_NAME IS NOT NULL`);
				const byTable = new Map();
				for (const row of colsRes.rows) {
					const [table, ...rest] = row;
					if (!byTable.has(table)) byTable.set(table, []);
					byTable.get(table).push(Object.fromEntries(colsRes.columns.slice(1).map((column, index) => [column, rest[index]])));
				}
				const fkMap = new Map();
				for (const [table, column, refTable, refColumn] of fkRes.rows) {
					if (!fkMap.has(table)) fkMap.set(table, new Map());
					const per = fkMap.get(table);
					if (!per.has(refTable)) per.set(refTable, { refTable, columns: [], refColumns: [] });
					per.get(refTable).columns.push(column);
					per.get(refTable).refColumns.push(refColumn ?? "");
				}
				const tables = tablesRes.rows.map(([table, kind]) => ({
					name: table,
					kind: String(kind).toUpperCase().includes("VIEW") ? "view" : "table",
					columns: columnRows("mysql", byTable.get(table) ?? []),
					indexes: [],
					foreignKeys: [...(fkMap.get(table)?.values() ?? [])],
				}));
				return { driver: "mysql", current, databases: [{ name: current, tables }, ...names.filter((name) => name !== current).map((name) => ({ name, tables: [] }))] };
			}
			throw new Error(`unknown database operation: ${op}`);
		},
		async cancel() {
			// A module connection has no OS process to kill; dropping the socket is
			// the only interrupt mysql2 offers. The connection is gone afterwards.
			disposed = true;
			try { await connection?.destroy?.(); } catch { /* already gone */ }
		},
		async close() {
			disposed = true;
			try { await connection?.end?.(); } catch { /* already gone */ }
		},
	};
}

/** `pg`-backed runner. */
async function postgresRunner(loaded, config) {
	const pg = loaded.default ?? loaded;
	const params = urlParams(config.urlParams);
	const client = new pg.Client({
		host: config.host,
		port: config.port,
		user: config.user,
		password: config.password,
		database: config.database || undefined,
		...(params.application_name ? { application_name: params.application_name } : {}),
		...(tlsOptions(config) ? { ssl: tlsOptions(config) } : {}),
	});
	await client.connect();
	let closed = false;

	/** Run one statement, rows as arrays. */
	const run = async (sql) => {
		const result = await client.query({ text: sql, rowMode: "array" });
		// `pg` returns an array for multi-statement text; the last result set wins.
		const last = Array.isArray(result) ? result[result.length - 1] : result;
		return { columns: (last?.fields ?? []).map((field) => field.name), rows: last?.rows ?? [], rowCount: last?.rowCount ?? 0 };
	};

	return {
		mode: "module",
		impl: "module",
		async call(op, args = {}) {
			if (closed) throw new Error("the connection is closed");
			if (op === "query") {
				const text = String(args.sql ?? "").trim();
				if (text === "") throw new Error("the query is empty");
				const reader = /^\s*(select|with|show|describe|desc|explain|table|values)\b/i.test(text);
				if (!reader) {
					const result = await run(text);
					return { columns: [], rows: [], truncated: false, changes: result.rowCount };
				}
				const result = await run(text);
				const cap = Math.max(1, Number(args.limit) || 10_000);
				const truncated = result.rows.length > cap;
				return { columns: result.columns, rows: truncated ? result.rows.slice(0, cap) : result.rows, truncated };
			}
			if (op === "rows") {
				const table = String(args.table ?? "");
				const columns = (await this.call("columns", { table, database: args.database })).map((column) => column.name);
				const where = filterClause("postgres", columns.map((name) => ({ name })), args.filter);
				const order = columns.includes(args.order) ? ` ORDER BY ${quote("postgres", args.order)} ${String(args.dir).toLowerCase() === "desc" ? "DESC" : "ASC"}` : "";
				const limit = Math.max(1, Math.min(Number(args.limit) || 100, 500));
				const offset = Math.max(0, Number(args.offset) || 0);
				const schemaName = String(args.database || "public");
				const qualified = `${quote("postgres", schemaName)}.${quote("postgres", table)}`;
				const page = await run(`SELECT * FROM ${qualified}${where ? ` WHERE ${where}` : ""}${order} LIMIT ${limit} OFFSET ${offset}`);
				const count = await run(`SELECT COUNT(*) AS n FROM ${qualified}${where ? ` WHERE ${where}` : ""}`);
				return { columns: page.columns, rows: page.rows, total: Number(count.rows[0]?.[0] ?? 0), offset, limit };
			}
			if (op === "columns") {
				const schemaName = String(args.database || "public").replace(/'/g, "''");
				const table = String(args.table ?? "").replace(/'/g, "''");
				const res = await run(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='${schemaName}' AND table_name='${table}' ORDER BY ordinal_position`);
				const objects = res.rows.map((row) => Object.fromEntries(res.columns.map((column, index) => [column, row[index]])));
				return columnRows("postgres", objects, schemaName);
			}
			if (op === "schema") {
				const dbs = await run("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname");
				const names = dbs.rows.map((row) => String(row[0]));
				const current = config.database || names[0] || "";
				const relations = await run("SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name");
				const cols = await run("SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name, ordinal_position");
				const fks = await run("SELECT tc.table_schema, tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY'");
				const byTable = new Map();
				for (const row of cols.rows) {
					const [schemaName, table, ...rest] = row;
					const key = `${schemaName}.${table}`;
					if (!byTable.has(key)) byTable.set(key, []);
					byTable.get(key).push(Object.fromEntries(cols.columns.slice(2).map((column, index) => [column, rest[index]])));
				}
				const fkMap = new Map();
				for (const [schemaName, table, column, refTable, refColumn] of fks.rows) {
					const key = `${schemaName}.${table}`;
					if (!fkMap.has(key)) fkMap.set(key, new Map());
					const per = fkMap.get(key);
					if (!per.has(refTable)) per.set(refTable, { refTable, columns: [], refColumns: [] });
					per.get(refTable).columns.push(column);
					per.get(refTable).refColumns.push(refColumn ?? "");
				}
				const tables = relations.rows.map(([schemaName, table, kind]) => ({
					name: table,
					schema: schemaName,
					kind: String(kind).includes("VIEW") ? "view" : "table",
					columns: columnRows("postgres", byTable.get(`${schemaName}.${table}`) ?? []),
					indexes: [],
					foreignKeys: [...(fkMap.get(`${schemaName}.${table}`)?.values() ?? [])],
				}));
				return { driver: "postgres", current, databases: [{ name: current, tables }, ...names.filter((name) => name !== current).map((name) => ({ name, tables: [] }))] };
			}
			throw new Error(`unknown database operation: ${op}`);
		},
		async cancel() {
			closed = true;
			try { await client.end(); } catch { /* already gone */ }
		},
		async close() {
			closed = true;
			try { await client.end(); } catch { /* already gone */ }
		},
	};
}