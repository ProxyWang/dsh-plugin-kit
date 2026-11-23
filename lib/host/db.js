/** Database workbench, host half: the facade.
 *
 * Layering (imports only point downwards):
 *
 *   db.js (this file)   connect ladder, saved profiles, routes, re-exports
 *     └── db/operations.js   schema, columns, table pages, ad-hoc queries
 *           └── db/cli.js     mysql/psql adapters (one process per statement)
 *                 └── db/sql.js   pure quoting/parsing helpers
 *     └── db/registry.js  the live-connection map every layer asks for a handle
 *
 * A new engine means a new implementation plus a catalog entry in `drivers.js`;
 * the routes, the dialog and the grid stay untouched.
 */

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { isAbsolute, join, resolve } from "node:path";
import { homedir } from "node:os";
import * as sqliteOps from "./sqlite-ops.js";
import { clearBinaryCache, findBinary } from "./binpath.js";
import { DRIVER_MODULES, resolveModule } from "./modresolve.js";
import { openTunnel } from "./tunnel.js";
import { findDbxStore, readDbxConnections } from "./dbximport.js";
import { driverCatalog } from "./drivers.js";
import { importDbx } from "./db/migrate.js";
import { installDriver } from "./db/install.js";

// Re-exported so the routes, the agent tools and the tests keep one entry point.
export { importDbx, installDriver };
import { closeQuietly, connOf, connections, listConnections } from "./db/registry.js";
import { columns, explain, query, rows, schema } from "./db/operations.js";
import { CLI_MAX_BUFFER, CLI_TIMEOUT_MS, PSQL_NULL, cliQuery, hasCli, runMysql, runPsql } from "./db/cli.js";
import { filterClause, pageable, parseCsv, parseMysqlTag, quoteIdent } from "./db/sql.js";

// Re-exported so callers (and the tests) keep one entry point for the host API.
export { parseCsv, parseMysqlTag };
export { listConnections };
export { columns, explain, query, rows, schema };


/** Saved-connection service, injected by the plugin entry (null in a bare test). */
import { profiles, setProfileService } from "./db/profile-source.js";

/** @param service - `createDbProfileService(...)`, or null to disable profiles. */
export function setDbProfileService(service) {
	setProfileService(service);
}


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



/** Whether a CLI is reachable; cached because the driver list is polled. */











/** The marker `psql -P null=` prints for SQL NULL (an empty string is data). */





// --- connection lifecycle ---------------------------------------------------------------

export async function listDrivers(options = {}) {
	// `refresh` re-probes: a client installed while the dialog is open should not
	// need a reload. The lookup memo is dropped first.
	if (options.refresh === true) clearBinaryCache();
	// The catalog reports every implementation of every driver (module, then CLI)
	// and what each one can do; `ready`/`note`/`bin` stay for older callers.
	return driverCatalog({ cwd: options.cwd, allowWorkspace: options.allowWorkspace === true });
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

export async function connect(params) {
	// A saved profile supplies everything (including the vault-held password);
	// explicit parameters still win, so "connect with an override" works.
	let source = params;
	if (typeof params.profileId === "string" && params.profileId !== "") {
		const profile = await profiles().resolve(params.profileId);
		if (!profile) throw new Error("unknown saved connection");
		source = { ...profile, ...Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== "")) };
		// The saved name is what the rail should show, not host:port.
		source.label = String(profile.label ?? "");
	}
	const driver = String(source.driver ?? "").toLowerCase();
	const id = randomUUID();
	// Remember where this connection came from: the panel uses it to focus the
	// existing connection instead of opening a second one for the same profile.
	const profileId = String(params.profileId ?? "");
	// Idempotent by profile: clicking a saved connection twice must not create a
	// second live connection (the client cannot be trusted to dedupe alone).
	if (profileId !== "") {
		const live = [...connections.values()].find((entry) => entry.profileId === profileId);
		if (live) {
			const [[existingId]] = [...connections.entries()].filter(([, entry]) => entry === live);
			return { id: existingId, driver: live.driver, label: live.label, profileId, reused: true };
		}
	}
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
		const label = String(source.label ?? "") || path.split(/[\\/]/).pop() || path;
		connections.set(id, { driver, label, config: { path }, runner, pending: new Map(), runningToken: "", profileId });
		return { id, driver, label, path, mode: runner.mode, profileId };
	}

	if (driver === "mysql" || driver === "postgres") {
		const cliName = driver === "mysql" ? "mysql" : "psql";
		const explicit = String(source.clientPath ?? "").trim();
		// Rung 1 of the ladder: a JavaScript driver the workspace already has.
		// It needs explicit permission because loading it runs project code.
		// The plugin ships mysql2 and pg itself, so the module path is the default:
		// `{source: "host"}` means our own dependency, no permission needed. A
		// workspace copy is still opt-in, because that runs the project's code.
		const moduleName = driver === "mysql" ? "mysql2" : "pg";
		const found = explicit === ""
			? (resolveModule(moduleName, {}) ?? (source.allowModule === true ? resolveModule(moduleName, { cwd: String(source.cwd ?? ""), allowWorkspace: true }) : null))
			: null;
		const wanted = found !== null;
		if (!wanted && explicit === "" && !(await hasCli(cliName))) {
			throw new Error(`${cliName} client not found — install it (${driver === "mysql" ? "brew install mysql-client" : "brew install postgresql@16"}) or set the client path`);
		}

		const { config, tunnel } = await serverTarget(source, driver);
		const label = String(source.label ?? "") || `${config.host}:${config.port}${config.database ? `/${config.database}` : ""}`;
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
				connections.set(id, { driver, label, config, runner, pending: new Map(), runningToken: "", impl: "module", tunnel, profileId });
				return { id, driver, label, impl: "module", profileId, module: `${driver === "mysql" ? "mysql2" : "pg"}@${found.version || "?"}` };
			}
			// Prove the connection before handing out an id: a wrong password must
			// surface at connect time, not on the first query.
			if (driver === "mysql") await runMysql(config, "SELECT 1");
			else await runPsql(config, "SELECT 1");
			connections.set(id, { driver, label, config, pending: new Map(), tunnel, profileId });
			return { id, driver, label, profileId, ...(tunnel ? { tunnel: tunnel.command } : {}) };
		} catch (error) {
			tunnel?.close();
			throw error;
		}
	}
	throw new Error(`unsupported driver: ${driver || "(none)"}`);
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







// --- schema -----------------------------------------------------------------------------









// --- table pages ------------------------------------------------------------------------





// --- free SQL ---------------------------------------------------------------------------



/** Route table consumed by the private API dispatcher. */
export function disconnect(id) {
	const key = String(id);
	const conn = connections.get(key);
	if (!conn) throw new Error("unknown connection");
	closeQuietly(conn);
	connections.delete(key);
	return {};
}

export function closeAll() {
	for (const conn of connections.values()) closeQuietly(conn);
	connections.clear();
}

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
	if (conn.pending.size === 0) return { cancelled: false, connectionClosed: false };
	for (const child of conn.pending.values()) {
		try { child.kill("SIGTERM"); } catch { /* already gone */ }
	}
	conn.pending.clear();
	return { cancelled: true, connectionClosed: false };
}

export const dbRoutes = {
	"db.drivers": (body) => listDrivers(body ?? {}),
	"db.connect": (body) => connect(body),
	"db.disconnect": (body) => disconnect(body.id),
	"db.connections": () => listConnections(),
	"db.schema": (body) => schema(body.id, { database: body.database }),
	"db.columns": (body) => columns(body.id, body.table, body.database),
	"db.rows": (body) => rows(body.id, body.table, body),
	"db.query": (body) => query(body.id, body.sql, body.limit, body.token, body.offset),
	"db.cancel": (body) => cancel(body.id, body.token),
	"db.test": (body) => testConnection(body),
	"db.explain": (body) => explain(body.id, body.sql),
	"db.import.dbx": (body) => importDbx(body),
	"db.driver.install": (body) => installDriver(body),
	"db.profile.list": () => profiles().list(),
	"db.profile.save": (body) => profiles().save(body),
	"db.profile.delete": (body) => profiles().remove(body.id),
};
