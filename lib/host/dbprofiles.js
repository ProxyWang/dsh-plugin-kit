/** Saved database connections: the profile list, with passwords in the vault.
 *
 * A connection you have to retype every session is not a saved connection. The
 * profile holds what a person would recognise (a label, the target address and
 * the driver), while the password lives in the plugin's secret vault
 * (`vault.js`) and never enters the profile record, the client, or any
 * response this service makes.
 *
 * Storage is DSH's `storageDomain`, so the list survives a restart and is
 * shared by every window on the profile. Writes are revision-checked: two
 * windows saving at once cannot silently drop one of the profiles.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";

const profileSchema = z.object({
	id: z.string().max(80),
	label: z.string().max(120),
	// A colour tag and a free note: dbx lets a connection be recognisable at a
	// glance, and two servers called "prod" need exactly that.
	color: z.string().max(24).default(""),
	note: z.string().max(500).default(""),
	driver: z.enum(["sqlite", "mysql", "postgres"]),
	address: z.string().max(2048),
	// The fields are kept beside the address so the dialog can open a profile
	// without re-parsing (and so a future address syntax cannot lose them).
	path: z.string().max(4096).default(""),
	host: z.string().max(255).default(""),
	port: z.number().int().min(0).max(65535).default(0),
	user: z.string().max(255).default(""),
	database: z.string().max(255).default(""),
	secretId: z.string().max(120).default(""),
	updatedAt: z.number().default(0),
});

const schema = z.object({
	revision: z.number().int().nonnegative(),
	profiles: z.array(profileSchema).max(200),
});

const initial = () => ({ revision: 0, profiles: [] });

/**
 * @param storageDomain - DSH storage service
 * @param vault - the plugin's secret vault (same one the API workbench uses)
 */
export function createDbProfileService(storageDomain, vault) {
	let domain;
	let opening;
	let tail = Promise.resolve();
	let closed = false;
	const open = () => opening ??= storageDomain.open({
		name: "dsh_plugin_kit_db_profiles",
		version: 1,
		tables: {},
		global: { schema, initial: initial() },
	}).then((value) => { domain = value; return value; }).catch((error) => { opening = undefined; throw error; });

	const read = async () => (await open()).global.get();

	return {
		/** Every saved profile, without secrets. */
		async list() {
			if (closed) throw new Error("Database profiles are closed");
			const current = await read();
			return { revision: current.revision, profiles: current.profiles };
		},

		/**
		 * Create or update one profile.
		 *
		 * @param entry - `{id?, label, driver, address, path, host, port, user,
		 *   database, password?}`; an empty password keeps the stored one.
		 */
		save(entry) {
			if (closed) return Promise.reject(Error("Database profiles are closed"));
			const result = tail.then(async () => {
				const handle = await open();
				const current = handle.global.get();
				if (entry.baseRevision !== undefined && entry.baseRevision !== current.revision) {
					throw new Error("db.profilesConflict");
				}
				const id = typeof entry.id === "string" && entry.id !== "" ? entry.id : randomUUID();
				const existing = current.profiles.find((profile) => profile.id === id);
				let secretId = existing?.secretId ?? "";
				// An explicit password writes a vault entry; an empty one keeps the
				// stored secret, which is what "leave the field blank" must mean.
				if (typeof entry.password === "string" && entry.password !== "") {
					if (!vault) throw new Error("the secret vault is unavailable, so the password cannot be saved");
					const wrote = await vault.execute({ action: "set", entries: [{ id: secretId || undefined, key: "password", value: entry.password }] });
					secretId = wrote.ids.password;
				}
				const profile = {
					id,
					label: String(entry.label ?? existing?.label ?? "").slice(0, 120) || String(entry.address ?? "").slice(0, 120),
					color: String(entry.color ?? existing?.color ?? "").slice(0, 24),
					note: String(entry.note ?? existing?.note ?? "").slice(0, 500),
					driver: entry.driver ?? existing?.driver ?? "sqlite",
					address: String(entry.address ?? existing?.address ?? "").slice(0, 2048),
					path: String(entry.path ?? existing?.path ?? ""),
					host: String(entry.host ?? existing?.host ?? ""),
					port: Number(entry.port ?? existing?.port ?? 0) || 0,
					user: String(entry.user ?? existing?.user ?? ""),
					database: String(entry.database ?? existing?.database ?? ""),
					secretId,
					updatedAt: Date.now(),
				};
				const profiles = [profile, ...current.profiles.filter((item) => item.id !== id)].slice(0, 200);
				const next = { revision: current.revision + 1, profiles };
				await handle.global.set(schema.parse(next));
				return { revision: next.revision, profile };
			});
			tail = result.catch(() => {});
			return result;
		},

		/** Delete one profile and the secret behind it. */
		remove(id) {
			if (closed) return Promise.reject(Error("Database profiles are closed"));
			const result = tail.then(async () => {
				const handle = await open();
				const current = handle.global.get();
				const profile = current.profiles.find((item) => item.id === String(id));
				if (!profile) return { removed: false, revision: current.revision };
				if (profile.secretId !== "" && vault) {
					await vault.execute({ action: "delete", ids: [profile.secretId] }).catch(() => {});
				}
				const next = { revision: current.revision + 1, profiles: current.profiles.filter((item) => item.id !== profile.id) };
				await handle.global.set(schema.parse(next));
				return { removed: true, revision: next.revision };
			});
			tail = result.catch(() => {});
			return result;
		},

		/** The plaintext password for one profile (host-side use only). */
		async passwordOf(id) {
			const current = await read();
			const profile = current.profiles.find((item) => item.id === String(id));
			if (!profile || profile.secretId === "" || !vault) return "";
			const got = await vault.execute({ action: "get", ids: [profile.secretId] });
			return got.values?.[profile.secretId] ?? "";
		},

		/** One profile with its password resolved, for the connect path. */
		async resolve(id) {
			const current = await read();
			const profile = current.profiles.find((item) => item.id === String(id));
			if (!profile) return null;
			return { ...profile, password: await this.passwordOf(id) };
		},

		async close() {
			closed = true;
			await tail;
			if (opening) await opening.catch(() => {});
			await domain?.close();
		},
	};
}