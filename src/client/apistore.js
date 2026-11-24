/* ---------------- API workbench persistence: per-workspace keys + secret vault ----------------
 *
 * The request workbench used to keep drafts, history, favorites and environments
 * under five GLOBAL localStorage keys: debugging project A's internal API left
 * its URLs and Bearer tokens visible in project B's session. Keys are now scoped
 * by the session workspace (cwd), with a one-time migration from the legacy
 * global keys into the first workspace that opens.
 *
 * Secrets (auth token/password and environment variable values) never land in
 * localStorage: they live in a Host-side vault (storageDomain) addressed by
 * opaque refs. Snapshots carry `secret:<id>` markers; the UI resolves them for
 * display/send and writes new values back through the vault routes. When the
 * Host vault is unavailable the workbench degrades to the old inline behavior
 * rather than losing data.
 */

import { LEGACY_API_SUFFIX, keys, workspaceScope } from "./storage.js";

export { workspaceScope } from "./storage.js";

const MIGRATED_FLAG = keys.apiMigrated();

/** Scoped storage key for one store kind in one workspace. */
export function apiKey(kind, cwd) {
	return keys.api(kind, cwd);
}

/** Legacy global key (pre-scoping). */
export function legacyApiKey(kind) {
	return keys.apiLegacy(kind);
}

/**
 * One-time migration: move the five legacy global stores into the first
 * workspace that opens, then mark migration done so later workspaces start
 * clean instead of inheriting another project's data. Returns the list of
 * kinds actually moved (for tests/telemetry).
 */
export function migrateLegacyApiStores(cwd, storage = globalThis.localStorage) {
	if (!cwd || !storage) return [];
	try {
		if (storage.getItem(MIGRATED_FLAG) !== null) return [];
	} catch { return []; }
	const moved = [];
	for (const kind of Object.keys(LEGACY_API_SUFFIX)) {
		let raw = null;
		try { raw = storage.getItem(legacyApiKey(kind)); } catch { continue; }
		if (raw === null) continue;
		try {
			storage.setItem(apiKey(kind, cwd), raw);
			storage.removeItem(legacyApiKey(kind));
			moved.push(kind);
		} catch { /* quota: leave the legacy value in place */ }
	}
	try { storage.setItem(MIGRATED_FLAG, String(Date.now())); } catch { /* best effort */ }
	return moved;
}

// --- secret refs -----------------------------------------------------------------------

const SECRET_PREFIX = "secret:";

/** Whether a stored value is a vault reference rather than inline text. */
export function isSecretRef(value) {
	return typeof value === "string" && value.startsWith(SECRET_PREFIX) && value.length > SECRET_PREFIX.length;
}

/** Build the stored marker for a vault id. */
export function secretRef(id) {
	return `${SECRET_PREFIX}${id}`;
}

/** Extract the vault id from a marker (null when not a marker). */
export function secretId(value) {
	return isSecretRef(value) ? value.slice(SECRET_PREFIX.length) : null;
}

/**
 * Collect every secret ref inside a request snapshot / env store so the UI can
 * batch-resolve them in one vault call. Walks auth.token/auth.pass and every
 * environment variable value.
 */
export function collectSecretRefs(shape) {
	const ids = new Set();
	const visit = (value) => { if (isSecretRef(value)) ids.add(secretId(value)); };
	if (shape && typeof shape === "object") {
		if (shape.auth && typeof shape.auth === "object") { visit(shape.auth.token); visit(shape.auth.pass); }
		if (Array.isArray(shape.envs)) {
			for (const env of shape.envs) for (const v of env?.vars ?? []) visit(v?.value);
		}
		if (Array.isArray(shape.vars)) for (const v of shape.vars) visit(v?.value);
	}
	return [...ids];
}

/**
 * Replace secret refs with their resolved plaintext using a lookup map.
 * Unknown refs resolve to "" (the vault entry was deleted elsewhere).
 * Returns a new object; the input is never mutated.
 */
export function resolveSecrets(shape, lookup) {
	const subst = (value) => (isSecretRef(value) ? String(lookup?.[secretId(value)] ?? "") : value);
	if (!shape || typeof shape !== "object") return shape;
	const out = { ...shape };
	if (shape.auth && typeof shape.auth === "object") out.auth = { ...shape.auth, token: subst(shape.auth.token), pass: subst(shape.auth.pass) };
	if (Array.isArray(shape.envs)) out.envs = shape.envs.map((env) => ({ ...env, vars: (env?.vars ?? []).map((v) => ({ ...v, value: subst(v?.value) })) }));
	if (Array.isArray(shape.vars)) out.vars = shape.vars.map((v) => ({ ...v, value: subst(v?.value) }));
	return out;
}