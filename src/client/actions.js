/* ---------------- pluginKit action bus ----------------
 *
 * The workspace tab is a single mounted surface; other plugins (and the model
 * through `pluginKit`) ask it to open a file or a diff instead of reaching
 * into its state. A request emitted while no tab body is mounted is buffered
 * once and replayed to the next subscriber within a short window, so
 * "open a file, then mount the tab" works from a cold start.
 */

const listeners = new Set();
let pending = null;
const PENDING_TTL_MS = 5000;

/** Emit one action to every mounted body (or buffer it for the next one). */
export function emitAction(action) {
	const stamped = { ...action, at: Date.now() };
	if (listeners.size === 0) {
		pending = stamped;
		return false;
	}
	for (const listener of listeners) {
		try {
			listener(stamped);
		} catch {
			/* one consumer must not break the others */
		}
	}
	return true;
}

/** Subscribe to actions; returns the unsubscribe function. */
export function subscribeActions(listener) {
	listeners.add(listener);
	if (pending !== null && Date.now() - pending.at <= PENDING_TTL_MS) {
		const action = pending;
		pending = null;
		// Let the caller finish mounting/visibility work before the action lands.
		setTimeout(() => {
			if (!listeners.has(listener)) return;
			try {
				listener(action);
			} catch {
				/* consumer failure stays local */
			}
		}, 120);
	}
	return () => listeners.delete(listener);
}

/** Test helper: forget listeners and the buffered action. */
export function resetActions() {
	listeners.clear();
	pending = null;
}

/** Test helper: whether an action is buffered for the next subscriber. */
export function hasPendingAction() {
	return pending !== null;
}
