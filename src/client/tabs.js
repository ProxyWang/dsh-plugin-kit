/* ---------------- editor tab list operations (VS Code tab model) ----------------
 *
 * Pure helpers behind the editor strip's context menu and "Reopen Closed
 * Editor" (⌘/Ctrl+Shift+T): VS Code's Close / Close Others / Close to the
 * Right / Close All, plus a bounded most-recently-closed stack. The Code
 * orchestrator owns the state; these functions only compute transitions so
 * they can be tested without a component.
 */

/** Tabs minus every entry except `keep` (empty result when `keep` is absent). */
export function closeOtherTabs(tabs, keep) {
	const list = Array.isArray(tabs) ? tabs : [];
	return list.filter((p) => p === keep);
}

/** Tabs up to and including `anchor`; no-op when the anchor is missing. */
export function closeTabsToRight(tabs, anchor) {
	const list = Array.isArray(tabs) ? tabs : [];
	const at = list.indexOf(anchor);
	return at < 0 ? list : list.slice(0, at + 1);
}

/** Paths a bulk close removed, given the previous and resulting tab lists. */
export function removedPaths(prev, next) {
	const kept = new Set(Array.isArray(next) ? next : []);
	return (Array.isArray(prev) ? prev : []).filter((p) => !kept.has(p));
}

/**
 * Push onto the most-recently-closed stack (newest first, capped). Entries
 * carry the view state ({path, line, col}) so reopening restores position.
 */
export function pushClosedTab(stack, entry, cap = 10) {
	const list = Array.isArray(stack) ? stack : [];
	if (!entry || typeof entry.path !== "string" || entry.path === "") return list;
	return [entry, ...list].slice(0, Math.max(1, cap));
}

/** Pop the most recently closed tab. Returns [entry|null, rest]. */
export function popClosedTab(stack) {
	const list = Array.isArray(stack) ? stack : [];
	return [list[0] ?? null, list.slice(1)];
}

/**
 * Pinned (sticky) tabs survive bulk closes — VS Code passes excludeSticky to
 * Close Others / Close to the Right / Close All, while an explicit single
 * Close still closes (and unpins) them.
 */
export function excludePinned(paths, pinned) {
	const pins = new Set(Array.isArray(pinned) ? pinned : []);
	return (Array.isArray(paths) ? paths : []).filter((p) => !pins.has(p));
}

/** Pinning moves the tab to the front of the strip (VS Code sticky editors). */
export function pinTab(tabs, path) {
	const list = Array.isArray(tabs) ? tabs : [];
	if (!list.includes(path)) return list;
	return [path, ...list.filter((p) => p !== path)];
}
