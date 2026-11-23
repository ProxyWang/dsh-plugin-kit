/** Migrating saved connections from a dbx installation.
 *
 * Reads dbx's own SQLite database (read-only) and writes profiles through the
 * injected service. Passwords cannot cross: dbx encrypts them with a key only its
 * own process holds, so the import reports how many need a new one.
 */

import { findDbxStore, readDbxConnections } from "../dbximport.js";
import { profiles } from "./profile-source.js";

/**
 * Preview or apply an import.
 *
 * @param body - `{path?, apply?}`; `path` defaults to the platform's dbx store
 * @returns the preview, plus `imported` when applied
 */
export async function importDbx(body = {}) {
	const path = String(body.path ?? "").trim() || (await findDbxStore());
	if (!path) throw new Error("no dbx database found — pass its path explicitly");
	const found = await readDbxConnections(path);
	if (body.apply !== true) return { ...found, imported: 0 };
	const service = profiles();
	const existing = await service.list();
	const seen = new Set(existing.profiles.map((profile) => `${profile.label}\u0000${profile.host}\u0000${profile.port}\u0000${profile.database}`));
	let imported = 0;
	for (const entry of found.supported) {
		const key = `${entry.label}\u0000${entry.host}\u0000${entry.port}\u0000${entry.database}`;
		if (seen.has(key)) continue;
		seen.add(key);
		await service.save({
			label: entry.label,
			driver: entry.driver,
			address: entry.driver === "sqlite" ? entry.path : `${entry.driver}://${entry.host}:${entry.port}/${entry.database}`,
			host: entry.host,
			port: entry.port,
			user: entry.user,
			database: entry.database,
			path: entry.path,
			color: entry.color,
			note: entry.note,
			options: entry.options,
		});
		imported += 1;
	}
	return { ...found, imported };
}
