/** The CLI rung: one child process per statement, parsed back to rows.
 *
 * Every statement is a fresh `mysql`/`psql` process, so these adapters own the
 * argv construction and the output parsing; nothing else in the Host spawns them.
 */

import { execFile } from "node:child_process";
import { findBinary } from "../binpath.js";
import { PSQL_NULL as NULL_MARKER, parseCsv, parseMysqlTag, unescapeMysql } from "./sql.js";

export const CLI_TIMEOUT_MS = 30_000;
export const CLI_MAX_BUFFER = 32 * 1024 * 1024;
// The null marker is a parsing concern: sql.js owns it, cli.js re-exports it so
// the workbench keeps importing everything from one place.
export { PSQL_NULL } from "./sql.js";

/**
 * Resolve an executable the way the rest of the plugin does (`binpath.js`):
 * an explicit override, the project's own tool dirs, PATH, then the per-user
 * install locations a GUI-launched Host never sees.
 */
export async function which(name) {
	return findBinary(name);
}

const cliCache = new Map();

export async function hasCli(name) {
	if (cliCache.has(name)) return cliCache.get(name);
	const found = (await which(name)) !== null;
	cliCache.set(name, found);
	return found;
}

export function runMysql(config, sql, onSpawn, options = {}) {
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

export function runPsql(config, sql, onSpawn) {
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


/**
 * Run one statement on a CLI-backed connection, remembering the child process
 * so `cancel()` can stop a slow query before its timeout.
 */
export function cliQuery(conn, sql, token, options = {}) {
	const run = conn.driver === "mysql" ? runMysql : runPsql;
	const key = typeof token === "string" && token !== "" ? token : `anon-${Math.random().toString(36).slice(2)}`;
	return run(conn.config, sql, (child) => {
		// `null` means the child finished (or failed): drop the handle either way.
		if (child === null) conn.pending.delete(key);
		else conn.pending.set(key, child);
	}, options);
}
