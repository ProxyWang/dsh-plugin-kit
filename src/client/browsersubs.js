/* Sub-tab document: the pages one host browser tab keeps inside its window. */

export const MAX_SUBTABS = 10;
export const subDocKey = (sessionId, tabId) => `dsh.plugin-kit.browser.tabs.v2.${sessionId}.${tabId}`;
const legacyPageKey = (sessionId, tabId) => `dsh.plugin-kit.browser.page.v1.${sessionId}.${tabId}`;

export function newSubId() {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const cleanEntry = (entry) => ({
	id: String(entry?.id ?? newSubId()),
	url: entry?.url ? String(entry.url) : "",
	title: String(entry?.title ?? "").slice(0, 240),
});

/**
 * Read the persisted sub-tab document for one host browser tab.
 * A legacy single-page checkpoint migrates into a one-tab document so an
 * upgrade never drops the page the reader was on.
 * @returns `{ tabs, activeId, navigationRevision, initialUrl, restored }` or `null` when nothing was persisted.
 */
export function loadSubDoc(sessionId, tabId) {
	try {
		const raw = JSON.parse(localStorage.getItem(subDocKey(sessionId, tabId)) ?? "null");
		if (raw && Array.isArray(raw.tabs) && raw.tabs.length) {
			const tabs = raw.tabs.slice(0, MAX_SUBTABS).map(cleanEntry);
			const activeId = tabs.some((entry) => entry.id === raw.activeId) ? String(raw.activeId) : tabs[0].id;
			return { tabs, activeId, navigationRevision: raw.navigationRevision, initialUrl: raw.initialUrl, restored: true };
		}
		const legacy = JSON.parse(localStorage.getItem(legacyPageKey(sessionId, tabId)) ?? "null");
		if (legacy?.url) {
			const only = cleanEntry(legacy);
			return { tabs: [only], activeId: only.id, navigationRevision: legacy.navigationRevision, initialUrl: legacy.initialUrl, restored: true };
		}
	} catch { /* unreadable storage falls back to a fresh window */ }
	return null;
}

/** Persist the sub-tab list, the active sub-tab and the host navigation envelope. */
export function saveSubDoc(sessionId, tabId, doc) {
	try {
		localStorage.setItem(subDocKey(sessionId, tabId), JSON.stringify({
			tabs: doc.tabs.map((entry) => ({ id: entry.id, url: entry.url, title: entry.title })),
			activeId: doc.activeId,
			navigationRevision: doc.navigationRevision,
			initialUrl: doc.initialUrl,
		}));
	} catch { /* private mode or quota: the window simply starts fresh next time */ }
}

/** Drop every trace of one host browser tab's window, including the legacy checkpoint. */
export function clearSubDoc(sessionId, tabId) {
	try { localStorage.removeItem(subDocKey(sessionId, tabId)); } catch {}
	try { localStorage.removeItem(legacyPageKey(sessionId, tabId)); } catch {}
}
