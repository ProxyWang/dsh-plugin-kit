/** Host-side database driver for the toolbox DB panel.
 *
 * SQLite is built-in via Node 24's `node:sqlite` (the DSH Desktop runtime
 * ships Electron with Node 24). MySQL and PostgreSQL are supported through
 * their CLI clients (`mysql`, `psql`) when present on PATH — the plugin
 * spawns them per query with `-e` / `-c` and parses tab-separated output.
 * Connections are identified by opaque ids; each open connection holds a
 * DatabaseSync handle (SQLite) or a config object (CLI adapters). All handles
 * die with the plugin effect.
 *
 * Routes served under /code-explorer/api:
 *   POST db.connect   {driver, path|host|port|user|password|database} → {id}
 *   POST db.disconnect {id} → {}
 *   POST db.list       {id} → {databases:[], tables:[{name,columns}]}
 *   POST db.query      {id, sql, limit} → {columns:[], rows:[[]], truncated, ms}
 *   POST db.connections {} → [{id, driver, label}]
 */

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";

const QUERY_CAP = 10_000; // max rows returned per query
const CLI_TIMEOUT_MS = 30_000;

/** Lazily loaded node:sqlite (only available on Node ≥ 22.5 / Electron with Node 24). */
let sqliteModule = null;
async function getSqlite() {
	if (sqliteModule !== null) return sqliteModule;
	try {
		sqliteModule = await import("node:sqlite");
		return sqliteModule;
	} catch {
		sqliteModule = false;
		return false;
	}
}

const connections = new Map(); // id → {driver, handle|config, label}

/** Check whether a CLI binary is available on PATH. */
async function hasCli(name) {
	try {
		await access(name, constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

/** List available drivers and their readiness. */
export async function listDrivers() {
	const sqlite = await getSqlite();
	const mysql = await hasCli("mysql");
	const pg = await hasCli("psql");
	return [
		{ id: "sqlite", label: "SQLite", ready: Boolean(sqlite), note: sqlite ? "" : "requires Node ≥ 22.5" },
		{ id: "mysql", label: "MySQL", ready: mysql, note: mysql ? "" : "install the mysql CLI" },
		{ id: "postgres", label: "PostgreSQL", ready: pg, note: pg ? "" : "install the psql CLI" },
	];
}

/** Open a connection. Returns {id, driver, label}. */
export async function connect(params) {
	const driver = String(params.driver ?? "").toLowerCase();
	if (driver === "sqlite") {
		const mod = await getSqlite();
		if (!mod) throw new Error("SQLite requires Node ≥ 22.5 (node:sqlite)");
		const path = String(params.path ?? "");
		if (path === "") throw new Error("SQLite path is required");
		const db = new mod.DatabaseSync(path);
		const id = randomUUID();
		const label = path.split("/").pop() || path;
		connections.set(id, { driver, handle: db, label });
		return { id, driver, label };
	}
	if (driver === "mysql") {
		if (!(await hasCli("mysql"))) throw new Error("mysql CLI not found on PATH");
		const id = randomUUID();
		const label = `${params.host ?? "localhost"}:${params.port ?? 3306}/${params.database ?? ""}`;
		connections.set(id, {
			driver,
			config: {
				host: params.host ?? "localhost",
				port: Number(params.port) || 3306,
				user: params.user ?? "",
				password: params.password ?? "",
				database: params.database ?? "",
			},
			label,
		});
		return { id, driver, label };
	}
	if (driver === "postgres") {
		if (!(await hasCli("psql"))) throw new Error("psql CLI not found on PATH");
		const id = randomUUID();
		const label = `${params.host ?? "localhost"}:${params.port ?? 5432}/${params.database ?? ""}`;
		connections.set(id, {
			driver,
			config: {
				host: params.host ?? "localhost",
				port: Number(params.port) || 5432,
				user: params.user ?? "",
				password: params.password ?? "",
				database: params.database ?? "",
			},
			label,
		});
		return { id, driver, label };
	}
	throw new Error(`unsupported driver: ${driver}`);
}

/** Close a connection. */
export function disconnect(id) {
	const conn = connections.get(String(id));
	if (!conn) throw new Error("unknown connection");
	if (conn.handle && typeof conn.handle.close === "function") conn.handle.close();
	connections.delete(String(id));
	return {};
}

/** List databases and tables for a connection. */
export async function listObjects(id) {
	const conn = connections.get(String(id));
	if (!conn) throw new Error("unknown connection");
	if (conn.driver === "sqlite") {
		const tables = conn.handle.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
		).all().map((r) => r.name);
		const result = [];
		for (const name of tables) {
			const cols = conn.handle.prepare(`PRAGMA table_info("${name.replace(/"/g, '""')}")`).all();
			result.push({ name, columns: cols.map((c) => ({ name: c.name, type: c.type ?? "" })) });
		}
		return { databases: [], tables: result };
	}
	if (conn.driver === "mysql") {
		const dbs = await runMysql(conn.config, "SHOW DATABASES");
		const databases = dbs.rows.map((r) => r[0]).filter((n) => !["information_schema", "performance_schema", "mysql", "sys"].includes(n));
		const currentDb = conn.config.database;
		let tables = [];
		if (currentDb) {
			const res = await runMysql(conn.config, `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${currentDb.replace(/'/g, "''")}' ORDER BY TABLE_NAME, ORDINAL_POSITION`);
			const byTable = new Map();
			for (const row of res.rows) {
				const [tbl, col, typ] = row;
				if (!byTable.has(tbl)) byTable.set(tbl, []);
				byTable.get(tbl).push({ name: col, type: typ });
			}
			tables = [...byTable.entries()].map(([name, columns]) => ({ name, columns }));
		}
		return { databases, tables };
	}
	if (conn.driver === "postgres") {
		const dbs = await runPsql(conn.config, "SELECT datname FROM pg_database WHERE datistemplate=false ORDER BY datname");
		const databases = dbs.rows.map((r) => r[0]);
		const currentDb = conn.config.database;
		let tables = [];
		if (currentDb) {
			const res = await runPsql(conn.config, `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
			const byTable = new Map();
			for (const row of res.rows) {
				const [tbl, col, typ] = row;
				if (!byTable.has(tbl)) byTable.set(tbl, []);
				byTable.get(tbl).push({ name: col, type: typ });
			}
			tables = [...byTable.entries()].map(([name, columns]) => ({ name, columns }));
		}
		return { databases, tables };
	}
	throw new Error(`unsupported driver: ${conn.driver}`);
}

/** Execute a SQL query. Returns {columns, rows, truncated, ms}. */
export async function query(id, sql, limit) {
	const conn = connections.get(String(id));
	if (!conn) throw new Error("unknown connection");
	const cap = Math.min(Math.max(Number(limit) || QUERY_CAP, 1), QUERY_CAP);
	const started = Date.now();
	if (conn.driver === "sqlite") {
		const stmt = conn.handle.prepare(sql);
		const isSelect = /^\s*(select|pragma|explain)\b/i.test(sql);
		if (!isSelect) {
			const info = stmt.run();
			return { columns: [], rows: [], truncated: false, ms: Date.now() - started, changes: info.changes ?? 0 };
		}
		const all = stmt.all();
		const truncated = all.length > cap;
		const rows = truncated ? all.slice(0, cap) : all;
		const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
		return { columns, rows: rows.map((r) => columns.map((c) => r[c])), truncated, ms: Date.now() - started };
	}
	if (conn.driver === "mysql") {
		const res = await runMysql(conn.config, sql);
		const truncated = res.rows.length > cap;
		const rows = truncated ? res.rows.slice(0, cap) : res.rows;
		return { columns: res.columns, rows, truncated, ms: Date.now() - started };
	}
	if (conn.driver === "postgres") {
		const res = await runPsql(conn.config, sql);
		const truncated = res.rows.length > cap;
		const rows = truncated ? res.rows.slice(0, cap) : res.rows;
		return { columns: res.columns, rows, truncated, ms: Date.now() - started };
	}
	throw new Error(`unsupported driver: ${conn.driver}`);
}

/** List all open connections. */
export function listConnections() {
	return [...connections.entries()].map(([id, c]) => ({ id, driver: c.driver, label: c.label }));
}

/** Close every connection (plugin unload). */
export function closeAll() {
	for (const [id, conn] of connections) {
		if (conn.handle && typeof conn.handle.close === "function") conn.handle.close();
	}
	connections.clear();
}

// --- CLI adapters -----------------------------------------------------------------------

function runMysql(config, sql) {
	return new Promise((resolvePromise, reject) => {
		const args = ["--batch", "--skip-column-names", "-e", sql];
		if (config.host) args.push("-h", config.host);
		if (config.port) args.push("-P", String(config.port));
		if (config.user) args.push("-u", config.user);
		if (config.password) args.push(`-p${config.password}`);
		if (config.database) args.push("-D", config.database);
		execFile("mysql", args, { timeout: CLI_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024, encoding: "utf8" }, (error, stdout, stderr) => {
			if (error) return reject(new Error(stderr || error.message));
			const lines = stdout.trim().split("\n").filter(Boolean);
			// First line is the header when --skip-column-names is NOT used;
			// we use --skip-column-names so all lines are data. Columns come
			// from a separate DESCRIBE or are inferred from the first row.
			const rows = lines.map((line) => line.split("\t"));
			resolvePromise({ columns: [], rows });
		});
	});
}

function runPsql(config, sql) {
	return new Promise((resolvePromise, reject) => {
		const env = { ...process.env, PGPASSWORD: config.password ?? "" };
		const args = ["-t", "-A", "-F", "\t", "-c", sql];
		if (config.host) args.push("-h", config.host);
		if (config.port) args.push("-p", String(config.port));
		if (config.user) args.push("-U", config.user);
		if (config.database) args.push("-d", config.database);
		execFile("psql", args, { timeout: CLI_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024, encoding: "utf8", env }, (error, stdout, stderr) => {
			if (error) return reject(new Error(stderr || error.message));
			const lines = stdout.trim().split("\n").filter(Boolean);
			const rows = lines.map((line) => line.split("\t"));
			resolvePromise({ columns: [], rows });
		});
	});
}

// --- route table -------------------------------------------------------------------------

export const dbRoutes = {
	async "db.drivers"() {
		return await listDrivers();
	},
	async "db.connect"(body) {
		return await connect(body);
	},
	async "db.disconnect"(body) {
		return disconnect(body.id);
	},
	async "db.list"(body) {
		return await listObjects(body.id);
	},
	async "db.query"(body) {
		return await query(body.id, body.sql, body.limit);
	},
	async "db.connections"() {
		return listConnections();
	},
};