/* ---------------- legacy RPC tabs: fold them into the workbench ----------------
 *
 * Before HTTP and gRPC shared one tab, a session could have a `code-rpc` page
 * open. That type is still registered so an old layout opens instead of showing
 * "unavailable", but it is no longer offered anywhere — and leaving it alone
 * means the person keeps a second, orphaned gRPC page with no entry point.
 *
 * So each legacy tab is migrated exactly once per session: remember the gRPC
 * preference, close the old page, and open the workbench, which reads that
 * preference and starts on gRPC. The migration is idempotent (a per-tab guard),
 * skips itself when the workbench is not registered, and leaves the tab alone
 * if closing it fails — a refused close must not lose the page.
 */

/** Kind of the page that replaced the legacy one. */
export const WORKBENCH_KIND = "code-api";

/**
 * Fold any legacy gRPC page into the workbench.
 *
 * @param options - the open tabs and the effects to run (all injectable).
 * @returns how many tabs were migrated in this pass.
 */
export function migrateLegacyRpcTabs({
	tabs,
	migrated,
	canOpen,
	preferGrpc,
	close,
	open,
} = {}) {
	const rows = Array.isArray(tabs) ? tabs : [];
	let count = 0;
	for (const tab of rows) {
		if (tab?.kind !== "code-rpc") continue;
		const key = `${tab.sessionId}:${tab.id}`;
		if (migrated?.has?.(key)) continue;
		if (typeof canOpen === "function" && canOpen() === false) continue;
		// Marked before acting: a re-entrant call from the close must not loop.
		migrated?.add?.(key);
		try {
			preferGrpc?.();
			close?.(tab);
			open?.(tab.sessionId);
			count += 1;
		} catch {
			// A refused close keeps the page: nothing was lost, it just stays legacy.
		}
	}
	return count;
}
