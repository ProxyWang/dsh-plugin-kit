/** Host-side secret vault for the API workbench.
 *
 * Auth tokens/passwords and environment variable values are stored here
 * (DSH storageDomain, profile-persistent) instead of browser localStorage.
 * The client keeps only opaque `secret:<id>` markers in its snapshots; this
 * service resolves them for display/send and accepts new values. Writes are
 * serialized like the browser bookmark service so concurrent tabs cannot
 * lose updates. Values are capped and never logged.
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";

const MAX_SECRETS = 500;
const MAX_VALUE = 64 * 1024;

const schema = z.object({
	revision: z.number().int().nonnegative(),
	secrets: z.record(z.string().max(100), z.string().max(MAX_VALUE)),
});

const initial = () => ({ revision: 0, secrets: {} });

export function createVaultService(storageDomain) {
	let domain;
	let opening;
	let tail = Promise.resolve();
	let closed = false;
	const open = () => opening ??= storageDomain.open({ name: "dsh_plugin_kit_vault", version: 1, tables: {}, global: { schema, initial: initial() } }).then((value) => { domain = value; return value; }).catch((error) => { opening = undefined; throw error; });
	return {
		execute(request) {
			if (closed) return Promise.reject(Error("Vault storage is closed"));
			const result = tail.then(async () => {
				const handle = await open();
				const current = handle.global.get();
				const action = String(request?.action ?? "");
				if (action === "get") {
					const ids = Array.isArray(request.ids) ? request.ids.slice(0, MAX_SECRETS).map(String) : [];
					const values = {};
					for (const id of ids) if (Object.hasOwn(current.secrets, id)) values[id] = current.secrets[id];
					return { values };
				}
				if (action === "set") {
					const entries = Array.isArray(request.entries) ? request.entries : [];
					const next = { ...current.secrets };
					const ids = {};
					for (const entry of entries.slice(0, MAX_SECRETS)) {
						const value = String(entry?.value ?? "");
						if (value.length > MAX_VALUE) throw Error("secret value too large");
						// An explicit id updates in place; otherwise mint a new one.
						const id = typeof entry?.id === "string" && entry.id !== "" && Object.hasOwn(next, entry.id) ? entry.id : randomUUID();
						if (!Object.hasOwn(next, id) && Object.keys(next).length >= MAX_SECRETS) throw Error("vault is full");
						next[id] = value;
						ids[String(entry?.key ?? id)] = id;
					}
					const updated = { revision: current.revision + 1, secrets: next };
					await handle.global.set(schema.parse(updated));
					return { ids, revision: updated.revision };
				}
				if (action === "delete") {
					const ids = Array.isArray(request.ids) ? request.ids.map(String) : [];
					const next = { ...current.secrets };
					let changed = false;
					for (const id of ids) if (Object.hasOwn(next, id)) { delete next[id]; changed = true; }
					if (changed) await handle.global.set(schema.parse({ revision: current.revision + 1, secrets: next }));
					return { deleted: ids.filter((id) => !Object.hasOwn(next, id)) };
				}
				throw Error(`unknown vault action: ${action}`);
			});
			tail = result.catch(() => {});
			return result;
		},
		async close() { closed = true; await tail; if (opening) await opening.catch(() => {}); await domain?.close(); },
	};
}