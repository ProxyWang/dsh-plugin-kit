/* ---------------- scoped storage: one place that decides where client state lives ----------------
 *
 * Client state used to be scattered across a dozen literal keys with three
 * different naming rules. They all now come from this table, so a new store
 * has to declare its scope explicitly:
 *
 *   session   — belongs to one conversation: navigation, browser sub-tabs
 *   workspace — belongs to one project directory: API drafts/history/envs
 *   global    — a preference shared by every conversation: layout toggles
 *
 * Keys keep their historical spellings: existing installs must keep reading
 * the same bytes (the migration paths below are one-shot and leave the old
 * value in place on failure). Passing `storage` lets tests use a fake.
 */

const SESSION = "session";
const WORKSPACE = "workspace";
const GLOBAL = "global";

/** Legacy global API stores, still read once by migrateLegacyApiStores. */
export const LEGACY_API_SUFFIX = {
	draft: "draft.v1",
	history: "history.v1",
	saved: "saved.v1",
	env: "env.v1",
	colldir: "colldir.v1",
};

/** Stable, key-safe scope id for a workspace path ("global" when empty). */
export function workspaceScope(cwd) {
	const clean = String(cwd ?? "").trim();
	if (clean === "") return "global";
	// encodeURIComponent keeps every path byte reversible and key-safe.
	return encodeURIComponent(clean);
}

/** Key builders, grouped by scope. Each returns the exact historical name. */
export const keys = {
	// session
	nav: (sessionId) => `dsh.plugin-kit.v1.${sessionId}`,
	browserSub: (sessionId, tabId) => `dsh.plugin-kit.browser.tabs.v2.${sessionId}.${tabId}`,
	browserLegacyPage: (sessionId, tabId) => `dsh.plugin-kit.browser.page.v1.${sessionId}.${tabId}`,
	// workspace
	api: (kind, cwd) => `dsh.ce.api.${kind}.v2.${workspaceScope(cwd)}`,
	apiLegacy: (kind) => `dsh.ce.api.${LEGACY_API_SUFFIX[kind] ?? kind}`,
	// global preferences and one-shot flags
	protocol: () => "dsh.plugin-kit.workbench.protocol",
	width: () => "dsh-kit.rightbar-width",
	diffSideBySide: () => "dsh.ce.diff.sbs.v1",
	allowModule: () => "dsh.plugin-kit.db.allowModule",
	liveRefresh: () => "dsh.plugin-kit.live",
	formatOnSave: () => "dsh.plugin-kit.format",
	// meta flags (never user state)
	apiMigrated: () => "dsh.ce.api.migrated.v1",
	orphansCleaned: () => "dsh.plugin-kit.orphans.cleaned",
};

/** Prefixes that own session-scoped keys, for orphan pruning. */
export const SESSION_KEY_PREFIXES = ["dsh.plugin-kit.v1.", "dsh.plugin-kit.browser.tabs.v2."];

/** The scope each key family belongs to; exported for tests and docs. */
export const KEY_SCOPES = {
	nav: SESSION,
	browserSub: SESSION,
	browserLegacyPage: SESSION,
	api: WORKSPACE,
	apiLegacy: WORKSPACE,
	protocol: GLOBAL,
	width: GLOBAL,
	diffSideBySide: GLOBAL,
	allowModule: GLOBAL,
	liveRefresh: GLOBAL,
	formatOnSave: GLOBAL,
};

export function defaultStorage() {
	try {
		return globalThis.localStorage;
	} catch {
		return undefined;
	}
}

/** Read a JSON value; null when missing or unreadable. */
export function readJson(key, storage = defaultStorage()) {
	try {
		const raw = storage?.getItem(key);
		return raw === null || raw === undefined ? null : JSON.parse(raw);
	} catch {
		return null;
	}
}

/** Write a JSON value; storage denial/quota is swallowed, the caller keeps running. */
export function writeJson(key, value, storage = defaultStorage()) {
	try {
		storage?.setItem(key, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

export function readRaw(key, storage = defaultStorage()) {
	try {
		return storage?.getItem(key) ?? null;
	} catch {
		return null;
	}
}

export function writeRaw(key, value, storage = defaultStorage()) {
	try {
		storage?.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

/** Read a boolean flag stored as "1"/"on" versus "0"/"off". */
export function readFlag(key, storage = defaultStorage()) {
	const value = readRaw(key, storage);
	return value === "1" || value === "on";
}

export function writeFlag(key, on, storage = defaultStorage()) {
	return writeRaw(key, on ? "1" : "0", storage);
}

/**
 * Copy one key to another once, leaving the source in place when the write
 * fails. Returns whether the value moved.
 */
export function migrateKey(from, to, storage = defaultStorage()) {
	if (!storage || from === to) return false;
	const raw = readRaw(from, storage);
	if (raw === null) return false;
	if (!writeRaw(to, raw, storage)) return false;
	try {
		storage.removeItem(from);
	} catch {
		/* keep both copies rather than lose data */
	}
	return true;
}
