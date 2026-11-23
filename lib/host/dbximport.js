/** Import connections from a dbx installation.
 *
 * dbx keeps its connection list in `dbx.db` (SQLite) next to the app's data
 * directory, one JSON document per row. Migrating them here means a person does
 * not have to retype five hostnames by hand.
 *
 * What can and cannot move:
 *
 *   - **the connection**: host, port, user, database, colour, SSL flag and URL
 *     parameters — all readable;
 *   - **the password**: no. dbx stores secrets in `connection_secrets`, encrypted
 *     at rest with a key the app owns; a different process cannot decrypt them,
 *     and pretending otherwise would be worse than asking once. The import
 *     reports which connections had a password so the panel can say so.
 */

import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** Drivers this plugin can actually open. */
const SUPPORTED = new Map([
	["mysql", "mysql"],
	["mariadb", "mysql"],
	["postgres", "postgres"],
	["postgresql", "postgres"],
	["sqlite", "sqlite"],
	["sqlite3", "sqlite"],
]);

/**
 * Where dbx keeps its data directory on each platform.
 *
 * @returns candidate paths, most likely first
 */
export function dbxCandidates() {
	const home = homedir();
	return [
		join(home, "Library", "Application Support", "com.dbx.app", "dbx.db"),
		join(home, ".local", "share", "com.dbx.app", "dbx.db"),
		...(process.env.APPDATA ? [join(process.env.APPDATA, "com.dbx.app", "dbx.db")] : []),
	];
}

/** First existing dbx database, or null. */
export async function findDbxStore() {
	for (const candidate of dbxCandidates()) {
		try {
			await access(candidate);
			return candidate;
		} catch { /* try the next */ }
	}
	return null;
}

/** Only accept a colour the panel can render. */
function normalizeColor(value) {
	const text = String(value ?? "").trim();
	return /^#[0-9a-f]{3,8}$/i.test(text) ? text : "";
}

/**
 * Read the connection list out of a dbx database.
 *
 * @param path - the `dbx.db` file
 * @returns `{source, total, supported, skipped, withPassword}`; nothing is written
 */
export async function readDbxConnections(path) {
	const { DatabaseSync } = await import("node:sqlite");
	let db;
	try {
		db = new DatabaseSync(path, { readOnly: true });
	} catch (error) {
		throw new Error(`cannot open ${path}: ${String(error?.message ?? error)}`);
	}
	try {
		const rows = db.prepare("SELECT id, config_json FROM connections").all();
		let secrets = [];
		try {
			secrets = db.prepare("SELECT connection_id, key FROM connection_secrets").all();
		} catch { /* older dbx builds have no secrets table */ }
		const secretCount = new Map();
		for (const row of secrets) {
			if (row.key !== "password") continue;
			secretCount.set(row.connection_id, true);
		}

		const supported = [];
		const skipped = [];
		for (const row of rows) {
			let config;
			try {
				config = JSON.parse(row.config_json);
			} catch {
				skipped.push({ name: String(row.id), reason: "unreadable config" });
				continue;
			}
			const driver = SUPPORTED.get(String(config.db_type ?? "").toLowerCase());
			if (!driver) {
				skipped.push({ name: String(config.name ?? row.id), reason: `unsupported driver: ${config.db_type ?? "?"}` });
				continue;
			}
			const host = String(config.host ?? "").trim();
			const port = Number(config.port) || 0;
			const database = String(config.database ?? "").trim();
			const label = String(config.name ?? "").trim() || (driver === "sqlite" ? database : `${host}:${port}`);
			supported.push({
				label,
				driver,
				host,
				port,
				user: String(config.username ?? ""),
				database,
				path: driver === "sqlite" ? database : "",
				color: normalizeColor(config.color),
				note: `imported from dbx${config.database_info?.productVersion ? ` (${config.database_info.productName ?? ""} ${config.database_info.productVersion})` : ""}`.trim(),
				options: {
					sslMode: config.ssl === true ? "required" : "",
					urlParams: String(config.url_params ?? ""),
				},
				hadPassword: secretCount.get(row.id) === true,
			});
		}
		return { source: path, total: rows.length, supported, skipped, withPassword: supported.filter((entry) => entry.hadPassword).length };
	} finally {
		try { db.close(); } catch { /* already closed */ }
	}
}