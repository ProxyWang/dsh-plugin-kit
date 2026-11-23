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
import { isAbsolute, join, resolve } from "node:path";
import { homedir } from "node:os";
import * as sqliteOps from "./sqlite-ops.js";
import { clearBinaryCache, findBinary } from "./binpath.js";
import { resolveModule } from "./modresolve.js";
import { openTunnel } from "./tunnel.js";
import { driverCatalog } from "./drivers.js";

/** Rows one `db.query` may return before it reports truncation. */
const QUERY_CAP = 10_000;
/** Rows one table page may return (the grid pages instead of growing). */
const PAGE_CAP = 500;
const CLI_TIMEOUT_MS = 30_000;
const CLI_MAX_BUFFER = 32 * 1024 * 1024;

/** Saved-connection service, injected by the plugin entry (null in a bare test). */
let profileService = null;
/** @param service - `createDbProfileService(...)`, or null to disable profiles. */
export function setDbProfileService(service) {
	profileService = service && typeof service.list === "function" ? service : null;
}

function profiles() {
	if (!profileService) throw new Error("saved connections are unavailable in this profile");
	return profileService;
}

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
 * A connection's operation runner.
 *
 * SQLite runs in a worker (`db-worker.js`) because the driver is synchronous:
 * doing the work here would freeze the Host for the length of every query. The
 * inline runner is the fallback for a runtime without `worker_threads` and
 * keeps the same call shape.
 *
 * @param path - the database file
 * @returns `{ mode, call(op, args), cancel(reason), close() }`
 */
/**
 * Spawn the worker that owns a connection.
 *
 * @param workerData - `{kind:"sqlite", path}` or `{kind:"module", driver, entry, config}`
 * @param inline - fallback used when `worker_threads` is unavailable
 * @returns `{mode, call, cancel, close}`
 */
async function spawnRunner(workerData, inline) {
	try {
		const { Worker } = await import("node:worker_threads");
		const worker = new Worker(new URL("./db-worker.js", import.meta.url), { workerData });
		const pending = new Map();
		let seq = 0;
		let dead = null;
		const failAll = (error) => {
			dead = error;
			for (const [, entry] of pending) entry.reject(error);
			pending.clear();
		};
		worker.on("message", (message) => {
			const entry = pending.get(message?.id);
			if (!entry) return;
			pending.delete(message.id);
			if (message.ok) entry.resolve(message.value);
			else entry.reject(new Error(message.error));
		});
		worker.on("error", (error) => failAll(error));
		worker.on("exit", () => failAll(new Error("the database worker exited")));
		return {
			mode: "worker",
			call(op, args) {
				if (dead) return Promise.reject(dead);
				return new Promise((resolvePromise, rejectPromise) => {
					const id = ++seq;
					pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
					worker.postMessage({ id, op, args });
				});
			},
			// A synchronous driver cannot be interrupted in place, so cancelling a
			// statement ends the thread — and the connection with it. The panel
			// says so instead of pretending the handle survived.
			async cancel(reason) {
				failAll(new Error(reason ?? "the query was cancelled"));
				await worker.terminate().catch(() => {});
			},
			async close() {
				try { await worker.terminate(); } catch { /* already gone */ }
				failAll(new Error("the connection is closed"));
			},
		};
	} catch {
		return inline();
	}
}

/**
 * A connection's operation runner.
 *
 * SQLite runs in a worker (`db-worker.js`) because the driver is synchronous:
 * doing the work here would freeze the Host for the length of every query. The
 * inline runner is the fallback for a runtime without `worker_threads` and
 * keeps the same call shape.
 */
async function sqliteRunner(path) {
	return spawnRunner({ kind: "sqlite", path }, async () => {
		const mod = await sqlite();
		if (!mod) throw new Error("SQLite needs Node ≥ 22.5 (node:sqlite)");
		const db = new mod.DatabaseSync(path);
		let closed = false;
		return {
			mode: "inline",
			async call(op, args) {
				if (closed) throw new Error("the connection is closed");
				if (op === "query") return sqliteOps.query(db, args?.sql, args?.limit);
				if (op === "columns") return sqliteOps.columns(db, String(args?.table ?? ""));
				if (op === "rows") return sqliteOps.rows(db, String(args?.table ?? ""), args ?? {});
				if (op === "schema") return sqliteOps.schema(db, args ?? {});
				throw new Error(`unknown database operation: ${op}`);
			},
			async cancel() { /* inline work cannot be interrupted */ },
			async close() {
				closed = true;
				try { db.close(); } catch { /* already closed */ }
			},
		};
	});
}

/** A connection served by a JavaScript driver module (`mysql2` / `pg`). */
async function moduleRunner({ driver, entry, config }) {
	return spawnRunner({ kind: "module", driver, entry, config }, async () => {
		// No worker support: load in-process and accept the risk the worker avoids.
		const { openModuleRunner } = await import("./drivers/module-runner.js");
		return openModuleRunner({ driver, entry, config });
	});
}

/**
 * Resolve an executable the way the rest of the plugin does (`binpath.js`):
 * an explicit override, the project's own tool dirs, PATH, then the per-user
 * install locations a GUI-launched Host never sees.
 */
async function which(name) {
	return findBinary(name);
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

/** `Query OK, 2 rows affected` / `Rows matched: 2` from mysql's verbose output. */
export function parseMysqlTag(output) {
	const text = String(output ?? "");
	const affected = /Query OK,\s+(\d+)\s+rows? affected/i.exec(text);
	if (affected) return Number(affected[1]);
	const matched = /Rows matched:\s*(\d+)/i.exec(text);
	if (matched) return Number(matched[1]);
	return null;
}

/** mysql's batch mode escapes these; `--raw` would break rows on a newline cell. */
function unescapeMysql(cell) {
	if (cell === "NULL") return null;
	if (!cell.includes("\\")) return cell;
	return cell.replace(/\\(.)/g, (_all, ch) => (ch === "n" ? "\n" : ch === "t" ? "\t" : ch === "0" ? "\0" : ch));
}

function runMysql(config, sql, onSpawn, options = {}) {
	return new Promise((resolvePromise, reject) => {
		const args = ["--batch", "-e", sql];
		// `--verbose` is what makes a write statement report its affected rows
		// ("Query OK, 2 rows affected"); batch mode prints nothing otherwise.
		// Only asked for on writes, because it also decorates SELECT output.
		if (options.verbose === true) args.push("--verbose");
		if (config.host) args.push("-h", config.host);
		if (config.port) args.push("-P", String(config.port));
		if (config.user) args.push("-u", config.user);

		if (config.database) args.push("-D", config.database);
		// TLS: the CLI takes the same knobs the user set in the dialog.
		const mysqlMode = { disabled: "DISABLED", preferred: "PREFERRED", required: "REQUIRED", "verify-ca": "VERIFY_CA", "verify-full": "VERIFY_IDENTITY" }[String(config.sslMode).toLowerCase()];
		if (mysqlMode) args.push(`--ssl-mode=${mysqlMode}`);
		if (config.sslCa) args.push(`--ssl-ca=${config.sslCa}`);
		if (config.sslCert) args.push(`--ssl-cert=${config.sslCert}`);
		if (config.sslKey) args.push(`--ssl-key=${config.sslKey}`);
		// MYSQL_PWD keeps the password out of the process table; `-p<pass>` on
		// argv would be readable by every local user for the life of the call.
		const env = { ...process.env, ...(config.password ? { MYSQL_PWD: config.password } : {}) };
		const child = execFile(String(config.bin || "mysql"), args, { timeout: CLI_TIMEOUT_MS, maxBuffer: CLI_MAX_BUFFER, encoding: "utf8", env }, (error, stdout, stderr) => {
			onSpawn?.(null);
			if (error) return reject(new Error((stderr || error.message).trim()));
			const changes = parseMysqlTag(stdout);
			if (changes !== null) {
				// A write with --verbose echoes the statement and then the tag;
				// there is no result set to parse.
				resolvePromise({ columns: [], rows: [], changes });
				return;
			}
			// --batch makes the first line a header row of tab-separated names.
			const lines = stdout.replace(/\n$/, "").split("\n");
			const columns = lines.length > 0 ? lines[0].split("\t").map((cell) => unescapeMysql(cell)) : [];
			const rows = lines.slice(1).map((line) => line.split("\t").map(unescapeMysql));
			resolvePromise({ columns, rows });
		});
		onSpawn?.(child);
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

function runPsql(config, sql, onSpawn) {
	return new Promise((resolvePromise, reject) => {
		const env = { ...process.env, PGPASSWORD: config.password ?? "", PGCLIENTENCODING: "UTF8" };
		const pgMode = { disabled: "disable", preferred: "prefer", required: "require", "verify-ca": "verify-ca", "verify-full": "verify-full" }[String(config.sslMode).toLowerCase()];
		if (pgMode) env.PGSSLMODE = pgMode;
		if (config.sslCa) env.PGSSLROOTCERT = config.sslCa;
		if (config.sslCert) env.PGSSLCERT = config.sslCert;
		if (config.sslKey) env.PGSSLKEY = config.sslKey;
		// CSV (not tab-separated) so a value containing a tab, a comma or a
		// newline stays one cell; `-P null=` distinguishes NULL from ''.
		const args = ["--csv", "-P", `null=${PSQL_NULL}`, "-c", sql];
		if (config.host) args.push("-h", config.host);
		if (config.port) args.push("-p", String(config.port));
		if (config.user) args.push("-U", config.user);
		if (config.database) args.push("-d", config.database);
		const child = execFile(String(config.bin || "psql"), args, { timeout: CLI_TIMEOUT_MS, maxBuffer: CLI_MAX_BUFFER, encoding: "utf8", env }, (error, stdout, stderr) => {
			onSpawn?.(null);
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
		onSpawn?.(child);
	});
}

// --- connection lifecycle ---------------------------------------------------------------

export async function listDrivers(options = {}) {
	// `refresh` re-probes: a client installed while the dialog is open should not
	// need a reload. The lookup memo is dropped first.
	if (options.refresh === true) clearBinaryCache();
	// The catalog reports every implementation of every driver (module, then CLI)
	// and what each one can do; `ready`/`note`/`bin` stay for older callers.
	return driverCatalog({ cwd: options.cwd, allowWorkspace: options.allowWorkspace === true });
}

export async function connect(params) {
	// A saved profile supplies everything (including the vault-held password);
	// explicit parameters still win, so "connect with an override" works.
	let source = params;
	if (typeof params.profileId === "string" && params.profileId !== "") {
		const profile = await profiles().resolve(params.profileId);
		if (!profile) throw new Error("unknown saved connection");
		source = { ...profile, ...Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== "")) };
	}
	const driver = String(source.driver ?? "").toLowerCase();
	const id = randomUUID();
	if (driver === "sqlite") {
		const mod = await sqlite();
		if (!mod) throw new Error("SQLite needs Node ≥ 22.5 (node:sqlite)");
		// A relative path belongs to the SESSION workspace, not to whatever
		// directory the Host process happens to run in (the app bundle, for a
		// Desktop launch) — typing `data/app.db` used to open a file somewhere
		// else entirely, or fail with "cannot open".
		let path = String(source.path ?? "").trim();
		if (path === "") throw new Error("a database file path is required");
		if (path.startsWith("~")) path = join(homedir(), path.slice(1));
		if (!isAbsolute(path)) {
			const base = String(source.cwd ?? "").trim();
			if (base === "") throw new Error("a relative database path needs a session workspace — use an absolute path");
			path = resolve(base, path);
		}
		const runner = await sqliteRunner(path);
		// Prove the file really opens inside the runner, so a bad path fails here
		// instead of on the first schema read.
		try {
			await runner.call("schema", { path });
		} catch (error) {
			await runner.close().catch(() => {});
			throw new Error(`cannot open ${path}: ${String(error?.message ?? error)}`);
		}
		const label = path.split(/[\\/]/).pop() || path;
		connections.set(id, { driver, label, config: { path }, runner, pending: new Map(), runningToken: "" });
		return { id, driver, label, path, mode: runner.mode };
	}
/**
 * Everything a server connection needs, including the optional tunnel and TLS.
 *
 * @param source - connect parameters
 * @param driver - mysql | postgres
 * @returns `{config, tunnel}`; the tunnel must be closed with the connection
 */
async function serverTarget(source, driver) {
	let host = String(source.host ?? "localhost").trim() || "localhost";
	let port = Number(source.port) || (driver === "mysql" ? 3306 : 5432);
	let tunnel = null;
	const jump = source.tunnel ?? null;
	if (jump && String(jump.bastion ?? "").trim() !== "") {
		tunnel = await openTunnel({
			bastion: String(jump.bastion).trim(),
			bastionPort: Number(jump.port) || 22,
			user: String(jump.user ?? ""),
			keyPath: String(jump.keyPath ?? ""),
			targetHost: host,
			targetPort: port,
			localPort: Number(jump.localPort) || 0,
		});
		host = "127.0.0.1";
		port = tunnel.localPort;
	}
	const config = {
		host,
		port,
		user: String(source.user ?? ""),
		password: String(source.password ?? ""),
		database: String(source.database ?? ""),
		sslMode: String(source.sslMode ?? ""),
		sslCa: String(source.sslCa ?? ""),
		sslCert: String(source.sslCert ?? ""),
		sslKey: String(source.sslKey ?? ""),
		urlParams: String(source.urlParams ?? ""),
		...(String(source.clientPath ?? "").trim() !== "" ? { bin: String(source.clientPath).trim() } : {}),
	};
	return { config, tunnel };
}

	if (driver === "mysql" || driver === "postgres") {
		const cliName = driver === "mysql" ? "mysql" : "psql";
		const explicit = String(source.clientPath ?? "").trim();
		// Rung 1 of the ladder: a JavaScript driver the workspace already has.
		// It needs explicit permission because loading it runs project code.
		const wanted = source.allowModule === true && explicit === "";
		const found = wanted ? resolveModule(driver === "mysql" ? "mysql2" : "pg", { cwd: String(source.cwd ?? ""), allowWorkspace: true }) : null;
		if (!wanted && explicit === "" && !(await hasCli(cliName))) {
			throw new Error(`${cliName} client not found — install it (${driver === "mysql" ? "brew install mysql-client" : "brew install postgresql@16"}) or set the client path`);
		}

		const { config, tunnel } = await serverTarget(source, driver);
		const label = `${config.host}:${config.port}${config.database ? `/${config.database}` : ""}`;
		try {
			if (found) {
				const runner = await moduleRunner({ driver, entry: found.path, config });
				try {
					// Same probe as the CLI path: prove it before handing out an id.
					await runner.call("query", { sql: "SELECT 1" });
				} catch (error) {
					await runner.close().catch(() => {});
					throw new Error(`${driver === "mysql" ? "mysql2" : "pg"} could not connect: ${String(error?.message ?? error)}`);
				}
				connections.set(id, { driver, label, config, runner, pending: new Map(), runningToken: "", impl: "module", tunnel });
				return { id, driver, label, impl: "module", module: `${driver === "mysql" ? "mysql2" : "pg"}@${found.version || "?"}` };
			}
			// Prove the connection before handing out an id: a wrong password must
			// surface at connect time, not on the first query.
			if (driver === "mysql") await runMysql(config, "SELECT 1");
			else await runPsql(config, "SELECT 1");
			connections.set(id, { driver, label, config, pending: new Map(), tunnel });
			return { id, driver, label, ...(tunnel ? { tunnel: tunnel.command } : {}) };
		} catch (error) {
			tunnel?.close();
			throw error;
		}
	}
	throw new Error(`unsupported driver: ${driver || "(none)"}`);
}

export function disconnect(id) {
	const key = String(id);
	const conn = connections.get(key);
	if (!conn) throw new Error("unknown connection");
	closeQuietly(conn);
	connections.delete(key);
	return {};
}

/** Close whatever a connection holds (worker runner or an inline handle). */
function closeQuietly(conn) {
	try {
		conn.tunnel?.close?.();
		if (conn.runner) { void conn.runner.close().catch(() => {}); return; }
		conn.handle?.close?.();
	} catch { /* teardown races are not errors */ }
}

export function closeAll() {
	for (const conn of connections.values()) closeQuietly(conn);
	connections.clear();
}

/**
 * Cancel the statement currently running on a connection.
 *
 * SQLite runs in a worker thread and cannot be interrupted in place, so its
 * connection is ended (the panel reconnects); a CLI child is killed, which
 * leaves the connection usable.
 */
export async function cancel(id, token) {
	const conn = connOf(id);
	if (conn.runner) {
		// The worker runs one statement at a time and cannot be interrupted in
		// place, so a cancel ends the thread — but only when the caller named the
		// statement that is actually running.
		if (typeof token === "string" && token !== "" && conn.runningToken !== token) {
			return { cancelled: false, connectionClosed: false, reason: "that statement is not running" };
		}
		await conn.runner.cancel("the query was cancelled");
		connections.delete(String(id));
		return { cancelled: true, connectionClosed: true };
	}
	if (typeof token === "string" && token !== "") {
		const child = conn.pending.get(token);
		if (!child) return { cancelled: false, connectionClosed: false, reason: "that statement is not running" };
		try { child.kill("SIGTERM"); } catch { /* already gone */ }
		conn.pending.delete(token);
		return { cancelled: true, connectionClosed: false };
	}
	// No token: stop whatever this connection is running (the old behaviour).
	if (conn.pending.size === 0) return { cancelled: false, connectionClosed: false };
	for (const child of conn.pending.values()) {
		try { child.kill("SIGTERM"); } catch { /* already gone */ }
	}
	conn.pending.clear();
	return { cancelled: true, connectionClosed: false };
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

/**
 * Prove a target without keeping it: connect, then close.
 *
 * This is the dialog's "Test" action — the user gets the real probe result
 * (including the driver's own error text) before deciding to keep the
 * connection.
 *
 * @param params - the same shape `connect` takes
 * @returns `{driver, label, ms}`
 */
export async function testConnection(params) {
	const started = Date.now();
	const opened = await connect(params);
	disconnect(opened.id);
	return { driver: opened.driver, label: opened.label, ms: Date.now() - started };
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

function connOf(id) {
	const conn = connections.get(String(id));
	if (!conn) throw new Error("unknown connection");
	return conn;
}

/**
 * Run one statement on a CLI-backed connection, remembering the child process
 * so `cancel()` can stop a slow query before its timeout.
 */
function cliQuery(conn, sql, token, options = {}) {
	const run = conn.driver === "mysql" ? runMysql : runPsql;
	const key = typeof token === "string" && token !== "" ? token : `anon-${Math.random().toString(36).slice(2)}`;
	return run(conn.config, sql, (child) => {
		// `null` means the child finished (or failed): drop the handle either way.
		if (child === null) conn.pending.delete(key);
		else conn.pending.set(key, child);
	}, options);
}

// --- schema -----------------------------------------------------------------------------

/** Full schema: databases (attached / server-wide), tables and views with columns. */
export async function schema(id) {
	const conn = connOf(id);
	// A runner-backed connection answers from its own implementation: SQLite in a
	// worker, or a project-local mysql2/pg. Only CLI connections fall through.
	if (conn.runner) return await conn.runner.call("schema", { path: conn.config?.path ?? "" });
	if (conn.driver === "mysql") return mysqlSchema(conn);
	return postgresSchema(conn);
}

async function mysqlSchema(conn) {
	const dbs = await cliQuery(conn, "SHOW DATABASES");
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
		const sql = [
			`SELECT * FROM ${quoteIdent("mysql", table)}`,
			where ? `WHERE ${where}` : "",
			validOrder ? `ORDER BY ${quoteIdent("mysql", orderColumn)} ${orderDir}` : "",
			`LIMIT ${limit} OFFSET ${offset}`,
		].filter(Boolean).join(" ");
		const res = await cliQuery(conn, sql, token);
		const countRes = await cliQuery(conn, `SELECT COUNT(*) FROM ${quoteIdent("mysql", table)}${where ? ` WHERE ${where}` : ""}`, token);
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

// --- free SQL ---------------------------------------------------------------------------

export async function query(id, sql, limit, token) {
	const conn = connOf(id);
	const text = String(sql ?? "").trim();
	if (text === "") throw new Error("the query is empty");
	const cap = Math.min(Math.max(Number(limit) || QUERY_CAP, 1), QUERY_CAP);
	const started = Date.now();

	if (conn.runner) {
		const previous = conn.runningToken;
		conn.runningToken = typeof token === "string" ? token : "";
		try {
			return await conn.runner.call("query", { sql: text, limit: cap });
		} finally {
			conn.runningToken = previous;
		}
	}
	if (conn.driver === "mysql") {
		const write = /^\s*(insert|update|delete|replace|alter|create|drop|truncate|rename|grant|revoke)\b/i.test(text);
		const res = await cliQuery(conn, text, token, { verbose: write });
		const truncated = res.rows.length > cap;
		return {
			columns: res.columns,
			rows: truncated ? res.rows.slice(0, cap) : res.rows,
			truncated,
			ms: Date.now() - started,
			...(res.changes !== undefined ? { changes: res.changes } : {}),
		};
	}
	// The token must reach the child process too, or Stop cannot name the
	// statement it wants to cancel on a PostgreSQL connection.
	const res = await cliQuery(conn, text, token);
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
	"db.drivers": (body) => listDrivers(body ?? {}),
	"db.connect": (body) => connect(body),
	"db.disconnect": (body) => disconnect(body.id),
	"db.connections": () => listConnections(),
	"db.schema": (body) => schema(body.id),
	"db.columns": (body) => columns(body.id, body.table, body.database),
	"db.rows": (body) => rows(body.id, body.table, body),
	"db.query": (body) => query(body.id, body.sql, body.limit, body.token),
	"db.cancel": (body) => cancel(body.id, body.token),
	"db.test": (body) => testConnection(body),
	"db.explain": (body) => explain(body.id, body.sql),
	"db.profile.list": () => profiles().list(),
	"db.profile.save": (body) => profiles().save(body),
	"db.profile.delete": (body) => profiles().remove(body.id),
};
