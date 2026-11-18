/** Host-side database drivers for the toolbox DB panel.
 *
 * SQLite runs in-process through Node's built-in `node:sqlite` (the DSH
 * Desktop runtime ships Node 24); MySQL and PostgreSQL are reached through
 * their CLI clients (`mysql`, `psql`) when those exist on PATH. Every
 * connection is an opaque id held in this module and dies with the plugin
 * effect.
 *
 * The routes answer the panel's three jobs and nothing else:
 *   db.drivers     → which drivers this deployment can actually open
 *   db.connect     → open a connection
 *   db.disconnect  → close it
 *   db.connections → the open ones
 *   db.schema      → databases / schemas / tables / views / columns / indexes
 *   db.rows        → one page of a table, ordered and filtered by the grid
 *   db.count       → the total behind that page (pagination footer)
 *   db.query       → free SQL from the editor
 *
 * Reads are bounded in both directions: a table page caps its row count, and
 * a free query caps its result size and reports the truncation instead of
 * silently dropping rows.
 */

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { delimiter, join } from "node:path";

/** Rows one `db.query` may return before it reports truncation. */
const QUERY_CAP = 10_000;
/** Rows one table page may return (the grid pages instead of growing). */
const PAGE_CAP = 500;
const CLI_TIMEOUT_MS = 30_000;
const CLI_MAX_BUFFER = 32 * 1024 * 1024;

/** id → {driver, label, config?, handle?} */
const connections = new Map();

let sqliteModule; // undefined = not probed, false = unavailable

/** Node's built-in SQLite, or false when this runtime has none. */
async function sqlite() {
	if (sqliteModule !== undefined) return sqliteModule;
	try {
		sqliteModule = await import("node:sqlite");
	} catch {
		sqliteModule = false;
	}
	return sqliteModule;
}

/**
 * Resolve an executable through PATH.
 *
 * `fs.access("mysql")` resolves the name against the *current directory*, so it
 * reports every CLI as missing — the bug that made the MySQL/PostgreSQL
 * drivers unreachable even on a machine that has them. Each PATH entry is
 * probed instead.
 */
async function which(name) {
	const entries = String(process.env.PATH ?? "").split(delimiter).filter(Boolean);
	const candidates = process.platform === "win32"
		? [name, ...String(process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean).map((ext) => name + ext.toLowerCase())]
		: [name];
	for (const entry of entries) {
		for (const candidate of candidates) {
			const full = join(entry, candidate);
			try {
				await access(full, constants.X_OK);
				return full;
			} catch { /* next entry */ }
		}
	}
	return null;
}

/** Whether a CLI is reachable; cached because the driver list is polled. */
const cliCache = new Map();
async function hasCli(name) {
	if (cliCache.has(name)) return cliCache.get(name);
	const found = (await which(name)) !== null;
	cliCache.set(name, found);
	return found;
}

/** Quote an identifier for the active driver (doubling embedded quotes). */
function quoteIdent(driver, name) {
	const clean = String(name ?? "");
	if (driver === "mysql") return `\`${clean.replace(/`/g, "``")}\``;
	return `"${clean.replace(/"/g, '""')}"`;
}

// --- CLI adapters -----------------------------------------------------------------------

/** mysql's batch mode escapes these; `--raw` would break rows on a newline cell. */
function unescapeMysql(cell) {
	if (cell === "NULL") return null;
	if (!cell.includes("\\")) return cell;
	return cell.replace(/\\(.)/g, (_all, ch) => (ch === "n" ? "\n" : ch === "t" ? "\t" : ch === "0" ? "\0" : ch));
}

function runMysql(config, sql) {
	return new Promise((resolvePromise, reject) => {
		const args = ["--batch", "-e", sql];
		if (config.host) args.push("-h", config.host);
		if (config.port) args.push("-P", String(config.port));
		if (config.user) args.push("-u", config.user);

		if (config.database) args.push("-D", config.database);
		// MYSQL_PWD keeps the password out of the process table; `-p<pass>` on
		// argv would be readable by every local user for the life of the call.
		const env = { ...process.env, ...(config.password ? { MYSQL_PWD: config.password } : {}) };
		execFile("mysql", args, { timeout: CLI_TIMEOUT_MS, maxBuffer: CLI_MAX_BUFFER, encoding: "utf8", env }, (error, stdout, stderr) => {
			if (error) return reject(new Error((stderr || error.message).trim()));
			// --batch makes the first line a header row of tab-separated names.
			const lines = stdout.replace(/\n$/, "").split("\n");
			const columns = lines.length > 0 ? lines[0].split("\t").map((cell) => unescapeMysql(cell)) : [];
			const rows = lines.slice(1).map((line) => line.split("\t").map(unescapeMysql));
			resolvePromise({ columns, rows });
		});
	});
}

/** The marker `psql -P null=` prints for SQL NULL (an empty string is data). */
const PSQL_NULL = "\\N";

/** Parse CSV the way psql emits it: quotes, doubled quotes, embedded newlines. */
export function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = "";
	let quoted = false;
	const source = String(text ?? "");
	for (let i = 0; i < source.length; i++) {
		const ch = source[i];
		if (quoted) {
			if (ch === '"') {
				if (source[i + 1] === '"') { field += '"'; i++; }
				else quoted = false;
			} else field += ch;
			continue;
		}
		if (ch === '"') { quoted = true; continue; }
		if (ch === ",") { row.push(field); field = ""; continue; }
		if (ch === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			continue;
		}
		if (ch === "\r") continue;
		field += ch;
	}
	if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
	// psql writes a trailing newline: drop the empty final row it produces.
	if (rows.length > 0 && rows.at(-1).length === 1 && rows.at(-1)[0] === "") rows.pop();
	return rows.map((cells) => cells.map((cell) => (cell === PSQL_NULL ? null : cell)));
}

function runPsql(config, sql) {
	return new Promise((resolvePromise, reject) => {
		const env = { ...process.env, PGPASSWORD: config.password ?? "", PGCLIENTENCODING: "UTF8" };
		// CSV (not tab-separated) so a value containing a tab, a comma or a
		// newline stays one cell; `-P null=` distinguishes NULL from ''.
		const args = ["--csv", "-P", `null=${PSQL_NULL}`, "-c", sql];
		if (config.host) args.push("-h", config.host);
		if (config.port) args.push("-p", String(config.port));
		if (config.user) args.push("-U", config.user);
		if (config.database) args.push("-d", config.database);
		execFile("psql", args, { timeout: CLI_TIMEOUT_MS, maxBuffer: CLI_MAX_BUFFER, encoding: "utf8", env }, (error, stdout, stderr) => {
			if (error) return reject(new Error((stderr || error.message).trim()));
			const rows = parseCsv(stdout);
			// A statement with no result set prints one command tag instead of a
			// header (`UPDATE 3`, `CREATE TABLE`); report it as a change count
			// rather than pretending it was a one-column result.
			const tag = rows.length === 1 && rows[0].length === 1
				? /^(INSERT|UPDATE|DELETE|TRUNCATE)\b\s+(\d+)/i.exec(String(rows[0][0]))
				: null;
			if (tag !== null) {
				resolvePromise({ columns: [], rows: [], changes: Number(tag[2]) });
				return;
			}
			// The first row is the header (every statement that returns rows has one).
			const columns = rows.length > 0 ? rows[0] : [];
			resolvePromise({ columns, rows: rows.slice(1) });
		});
	});
}

// --- connection lifecycle ---------------------------------------------------------------

export async function listDrivers() {
	const builtin = await sqlite();
	const [mysql, postgres] = await Promise.all([hasCli("mysql"), hasCli("psql")]);
	return [
		{ id: "sqlite", label: "SQLite", ready: Boolean(builtin), note: builtin ? "" : "needs Node ≥ 22.5" },
		{ id: "mysql", label: "MySQL", ready: mysql, note: mysql ? "" : "mysql CLI not on PATH" },
		{ id: "postgres", label: "PostgreSQL", ready: postgres, note: postgres ? "" : "psql CLI not on PATH" },
	];
}

export async function connect(params) {
	const driver = String(params.driver ?? "").toLowerCase();
	const id = randomUUID();
	if (driver === "sqlite") {
		const mod = await sqlite();
		if (!mod) throw new Error("SQLite needs Node ≥ 22.5 (node:sqlite)");
		const path = String(params.path ?? "").trim();
		if (path === "") throw new Error("a database file path is required");
		let handle;
		try {
			handle = new mod.DatabaseSync(path);
		} catch (error) {
			throw new Error(`cannot open ${path}: ${String(error?.message ?? error)}`);
		}
		const label = path.split(/[\\/]/).pop() || path;
		connections.set(id, { driver, label, config: { path }, handle });
		return { id, driver, label, path };
	}
	if (driver === "mysql" || driver === "postgres") {
		if (!(await hasCli(driver === "mysql" ? "mysql" : "psql"))) {
			throw new Error(`${driver === "mysql" ? "mysql" : "psql"} CLI not found on PATH`);
		}
		const config = {
			host: String(params.host ?? "localhost").trim() || "localhost",
			port: Number(params.port) || (driver === "mysql" ? 3306 : 5432),
			user: String(params.user ?? ""),
			password: String(params.password ?? ""),
			database: String(params.database ?? ""),
		};
		const label = `${config.host}:${config.port}${config.database ? `/${config.database}` : ""}`;
		// Prove the connection before handing out an id: a wrong password must
		// surface at connect time, not on the first query.
		if (driver === "mysql") await runMysql(config, "SELECT 1");
		else await runPsql(config, "SELECT 1");
		connections.set(id, { driver, label, config });
		return { id, driver, label };
	}
	throw new Error(`unsupported driver: ${driver || "(none)"}`);
}

export function disconnect(id) {
	const key = String(id);
	const conn = connections.get(key);
	if (!conn) throw new Error("unknown connection");
	try {
		conn.handle?.close?.();
	} catch { /* already closed */ }
	connections.delete(key);
	return {};
}

export function listConnections() {
	return [...connections.entries()].map(([id, conn]) => ({
		id,
		driver: conn.driver,
		label: conn.label,
		path: conn.config?.path ?? "",
		database: conn.config?.database ?? "",
	}));
}

export function closeAll() {
	for (const conn of connections.values()) {
		try { conn.handle?.close?.(); } catch { /* ignore */ }
	}
	connections.clear();
}

function connOf(id) {
	const conn = connections.get(String(id));
	if (!conn) throw new Error("unknown connection");
	return conn;
}

// --- schema -----------------------------------------------------------------------------

/** Full schema: databases (attached / server-wide), tables and views with columns. */
export async function schema(id) {
	const conn = connOf(id);
	if (conn.driver === "sqlite") return sqliteSchema(conn);
	if (conn.driver === "mysql") return mysqlSchema(conn);
	return postgresSchema(conn);
}

function sqliteSchema(conn) {
	const objects = conn.handle.prepare(
		"SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name",
	).all();
	const tables = objects.map((row) => {
		const columns = conn.handle.prepare(`PRAGMA table_info(${quoteIdent("sqlite", row.name)})`).all().map((c) => ({
			name: c.name,
			type: c.type || "TEXT",
			nullable: c.notnull === 0,
			primaryKey: c.pk > 0,
			defaultValue: c.dflt_value ?? null,
		}));
		const indexes = conn.handle.prepare(`PRAGMA index_list(${quoteIdent("sqlite", row.name)})`).all().map((ix) => ({
			name: ix.name,
			unique: ix.unique === 1,
			columns: conn.handle.prepare(`PRAGMA index_info(${quoteIdent("sqlite", ix.name)})`).all().map((c) => c.name).filter(Boolean),
		}));
		return { name: row.name, kind: row.type === "view" ? "view" : "table", columns, indexes };
	});
	let file = "";
	let size = 0;
	try {
		file = conn.config?.path ?? "";
		const st = conn.handle.prepare("PRAGMA database_list").all().find((r) => r.name === "main");
		if (st) file = st.file || file;
		size = conn.handle.prepare("PRAGMA page_count").get()?.page_count * (conn.handle.prepare("PRAGMA page_size").get()?.page_size ?? 0) || 0;
	} catch { /* pragmas are advisory */ }
	return {
		driver: "sqlite",
		databases: [{ name: "main", tables }],
		current: "main",
		file,
		size,
	};
}

async function mysqlSchema(conn) {
	const dbs = await runMysql(conn.config, "SHOW DATABASES");
	const hidden = new Set(["information_schema", "performance_schema", "mysql", "sys"]);
	const names = dbs.rows.map((row) => row[0]).filter((name) => !hidden.has(String(name)));
	const current = conn.config.database || names[0] || "";
	const databases = [];
	for (const name of names) {
		if (name !== current) {
			// Only the current database is introspected: listing every schema's
			// tables would multiply CLI round trips on a server with many
			// databases, and the grid can only browse one at a time anyway.
			databases.push({ name, tables: [] });
			continue;
		}
		const res = await runMysql(conn.config, `SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA='${String(name).replace(/'/g, "''")}' ORDER BY TABLE_NAME`);
		const cols = await runMysql(conn.config, `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${String(name).replace(/'/g, "''")}' ORDER BY TABLE_NAME, ORDINAL_POSITION`);
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
		}));
		databases.push({ name, tables });
	}
	return { driver: "mysql", databases, current };
}

async function postgresSchema(conn) {
	const dbs = await runPsql(conn.config, "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname");
	const names = dbs.rows.map((row) => row[0]);
	const current = conn.config.database || names[0] || "";
	const databases = [];
	for (const name of names) {
		if (name !== current) {
			databases.push({ name, tables: [] });
			continue;
		}
		const relations = await runPsql(conn.config, "SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name");
		const cols = await runPsql(conn.config, "SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name, ordinal_position");
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
		}));
		databases.push({ name, tables });
	}
	return { driver: "postgres", databases, current };
}

/** Columns of one table, fetched on demand by the structure view. */
export async function columns(id, table, database) {
	const conn = connOf(id);
	if (conn.driver === "sqlite") {
		return conn.handle.prepare(`PRAGMA table_info(${quoteIdent("sqlite", table)})`).all().map((c) => ({
			name: c.name, type: c.type || "TEXT", nullable: c.notnull === 0, primaryKey: c.pk > 0, defaultValue: c.dflt_value ?? null,
		}));
	}
	if (conn.driver === "mysql") {
		const db = String(database || conn.config.database || "").replace(/'/g, "''");
		const res = await runMysql(conn.config, `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${db}' AND TABLE_NAME='${String(table).replace(/'/g, "''")}' ORDER BY ORDINAL_POSITION`);
		return res.rows.map(([name, type, nullable, defaultValue, key, extra]) => ({
			name, type, nullable: String(nullable).toUpperCase() === "YES", primaryKey: key === "PRI", defaultValue, extra,
		}));
	}
	const schemaName = String(database || "public").replace(/'/g, "''");
	const res = await runPsql(conn.config, `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_schema='${schemaName}' AND table_name='${String(table).replace(/'/g, "''")}' ORDER BY ordinal_position`);
	return res.rows.map(([name, type, nullable, defaultValue, maxLength]) => ({
		name, type, nullable: nullable === "YES", primaryKey: false, defaultValue, maxLength: Number(maxLength) || null,
	}));
}

// --- table pages ------------------------------------------------------------------------

/** WHERE clause the grid may add: only a literal substring filter, never raw SQL. */
function filterClause(driver, columns, filter) {
	const needle = String(filter ?? "").trim();
	if (needle === "" || columns.length === 0) return null;
	const escaped = needle.replace(/'/g, "''");
	const parts = columns.map((column) => `CAST(${quoteIdent(driver, column.name)} AS TEXT) LIKE '%${escaped}%'`);
	return `(${parts.join(" OR ")})`;
}

/** One page of a table: rows, the columns they came in, and the total. */
export async function rows(id, table, options = {}) {
	const conn = connOf(id);
	const limit = Math.min(Math.max(Number(options.limit) || 100, 1), PAGE_CAP);
	const offset = Math.max(Number(options.offset) || 0, 0);
	const orderColumn = typeof options.order === "string" ? options.order : "";
	const orderDir = String(options.dir).toLowerCase() === "desc" ? "DESC" : "ASC";

	if (conn.driver === "sqlite") {
		const cols = conn.handle.prepare(`PRAGMA table_info(${quoteIdent("sqlite", table)})`).all();
		const where = filterClause("sqlite", cols, options.filter);
		const validOrder = cols.some((c) => c.name === orderColumn);
		const sql = [
			`SELECT * FROM ${quoteIdent("sqlite", table)}`,
			where ? `WHERE ${where}` : "",
			validOrder ? `ORDER BY ${quoteIdent("sqlite", orderColumn)} ${orderDir}` : "",
			`LIMIT ${limit} OFFSET ${offset}`,
		].filter(Boolean).join(" ");
		const all = conn.handle.prepare(sql).all();
		const columns = all.length > 0 ? Object.keys(all[0]) : cols.map((c) => c.name);
		const countSql = `SELECT COUNT(*) AS n FROM ${quoteIdent("sqlite", table)}${where ? ` WHERE ${where}` : ""}`;
		const total = Number(conn.handle.prepare(countSql).get()?.n ?? 0);
		return { columns, rows: all.map((row) => columns.map((c) => row[c])), total, offset, limit };
	}
	if (conn.driver === "mysql") {
		const cols = await columns(id, table, options.database);
		const where = filterClause("mysql", cols, options.filter);
		const validOrder = cols.some((c) => c.name === orderColumn);
		const sql = [
			`SELECT * FROM ${quoteIdent("mysql", table)}`,
			where ? `WHERE ${where}` : "",
			validOrder ? `ORDER BY ${quoteIdent("mysql", orderColumn)} ${orderDir}` : "",
			`LIMIT ${limit} OFFSET ${offset}`,
		].filter(Boolean).join(" ");
		const res = await runMysql(conn.config, sql);
		const countRes = await runMysql(conn.config, `SELECT COUNT(*) FROM ${quoteIdent("mysql", table)}${where ? ` WHERE ${where}` : ""}`);
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
	const res = await runPsql(conn.config, sql);
	const countRes = await runPsql(conn.config, `SELECT COUNT(*) FROM ${qualified}${where ? ` WHERE ${where}` : ""}`);
	return { columns: cols.map((c) => c.name), rows: res.rows, total: Number(countRes.rows[0]?.[0] ?? 0), offset, limit };
}

// --- free SQL ---------------------------------------------------------------------------

export async function query(id, sql, limit) {
	const conn = connOf(id);
	const text = String(sql ?? "").trim();
	if (text === "") throw new Error("the query is empty");
	const cap = Math.min(Math.max(Number(limit) || QUERY_CAP, 1), QUERY_CAP);
	const started = Date.now();

	if (conn.driver === "sqlite") {
		const statement = conn.handle.prepare(text);
		const reader = /^\s*(select|pragma|explain|with)\b/i.test(text);
		if (!reader) {
			const info = statement.run();
			return { columns: [], rows: [], truncated: false, ms: Date.now() - started, changes: Number(info.changes ?? 0) };
		}
		const all = statement.all();
		const truncated = all.length > cap;
		const kept = truncated ? all.slice(0, cap) : all;
		const columns = kept.length > 0 ? Object.keys(kept[0]) : [];
		return {
			columns,
			rows: kept.map((row) => columns.map((name) => row[name])),
			truncated,
			ms: Date.now() - started,
		};
	}
	if (conn.driver === "mysql") {
		const res = await runMysql(conn.config, text);
		const truncated = res.rows.length > cap;
		return { columns: res.columns, rows: truncated ? res.rows.slice(0, cap) : res.rows, truncated, ms: Date.now() - started };
	}
	const res = await runPsql(conn.config, text);
	const truncated = res.rows.length > cap;
	return {
		columns: res.columns,
		rows: truncated ? res.rows.slice(0, cap) : res.rows,
		truncated,
		ms: Date.now() - started,
		...(res.changes !== undefined ? { changes: res.changes } : {}),
	};
}

/** Route table consumed by the private API dispatcher. */
export const dbRoutes = {
	"db.drivers": () => listDrivers(),
	"db.connect": (body) => connect(body),
	"db.disconnect": (body) => disconnect(body.id),
	"db.connections": () => listConnections(),
	"db.schema": (body) => schema(body.id),
	"db.columns": (body) => columns(body.id, body.table, body.database),
	"db.rows": (body) => rows(body.id, body.table, body),
	"db.query": (body) => query(body.id, body.sql, body.limit),
};
