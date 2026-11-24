/* ---------------- localStorage orphan cleanup for per-session keys ----------------
 *
 * The Code panel persists navigation state under `dsh.plugin-kit.v1.<sessionId>`
 * and the browser sub-tabs under `dsh.plugin-kit.browser.tabs.v2.<sessionId>.<tabId>`.
 * When a session is deleted, its keys become orphans that accumulate toward the
 * ~5 MB localStorage quota. This module prunes them on startup: it reads the
 * host's current session list (via the useSessions selector) and removes any
 * plugin-owned key whose sessionId is no longer present.
 *
 * The cleanup runs once per plugin activation (guarded by a flag so repeated
 * mounts don't re-scan). It never touches keys from other plugins or the host.
 */

import { SESSION_KEY_PREFIXES, keys } from "./storage.js";

const [NAV_PREFIX, BROWSER_PREFIX] = SESSION_KEY_PREFIXES;
const CLEANED_FLAG = keys.orphansCleaned();

/**
 * Remove localStorage keys belonging to sessions that no longer exist.
 *
 * @param liveSessionIds - Set of currently active session ids
 * @param storage - localStorage-compatible object (injectable for tests)
 * @returns number of orphan keys removed
 */
export function pruneOrphanKeys(liveSessionIds, storage = globalThis.localStorage) {
	if (!storage || typeof storage.key !== "function") return 0;
	try {
		if (storage.getItem(CLEANED_FLAG) !== null) return 0;
	} catch { return 0; }
	const live = new Set(Array.isArray(liveSessionIds) ? liveSessionIds : []);
	let removed = 0;
	const toRemove = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (!key) continue;
		if (key.startsWith(NAV_PREFIX)) {
			const sid = key.slice(NAV_PREFIX.length);
			if (!live.has(sid)) toRemove.push(key);
		} else if (key.startsWith(BROWSER_PREFIX)) {
			// Format: dsh.plugin-kit.browser.tabs.v2.<sessionId>.<tabId>
			const rest = key.slice(BROWSER_PREFIX.length);
			const dot = rest.indexOf(".");
			const sid = dot >= 0 ? rest.slice(0, dot) : rest;
			if (!live.has(sid)) toRemove.push(key);
		}
	}
	for (const key of toRemove) {
		try { storage.removeItem(key); removed++; } catch { /* quota or permission */ }
	}
	try { storage.setItem(CLEANED_FLAG, String(Date.now())); } catch { /* best effort */ }
	return removed;
}

/** Reset the cleaned flag so the next activation re-scans (for tests). */
export function resetOrphanCleanup(storage = globalThis.localStorage) {
	try { storage.removeItem(CLEANED_FLAG); } catch { /* ignore */ }
}