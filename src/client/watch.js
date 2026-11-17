/* ---------------- live workspace changes (watch.poll long-poll) ---------------- */

/**
 * Pure helpers for the Dev Workspace's live-refresh loop: fold the host's
 * debounced change batches into the UI's invalidation targets, and a small
 * state machine for the long-poll cycle (baseline → stream, error → capped
 * backoff, unsupported → slow retry so a transient watcher failure heals).
 */

/** Unique workspace-relative parent directories of changed paths ("" = root). */
export function parentDirs(paths) {
	const dirs = new Set();
	for (const p of paths) dirs.add(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
	return [...dirs];
}

/**
 * What the active editor must do about a batch:
 * - "reload": the open document's path changed and no unsaved draft exists;
 * - "conflict": it changed while a draft is open — never auto-discard, show
 *   the banner and let the human choose (VS Code semantics);
 * - "ignore": untouched.
 */
export function docAction(paths, docPath, dirty) {
	if (!docPath || !paths.includes(docPath)) return "ignore";
	return dirty ? "conflict" : "reload";
}

/**
 * Drives the poll cycle. `poll(body)` must resolve to the api() envelope.
 * The loop starts immediately and is idempotent until stop() is called.
 */
export function createWatchLoop({ poll, onChanges, onReset, onUnsupported, schedule = (fn) => setTimeout(fn, 0), unschedule = clearTimeout, maxBackoffMs = 60_000, supportedRetryMs = 30_000 }) {
	let stopped = false;
	let since = -1; // -1 asks the host for the baseline cursor
	let timer = null;
	let backoff = 1_000;
	const tick = async () => {
		if (stopped) return;
		const res = await poll({ since, waitMs: 20_000 });
		if (stopped) return;
		const v = res && res.ok ? res.value : null;
		if (!v || typeof v.seq !== "number") {
			timer = schedule(tick, backoff);
			backoff = Math.min(backoff * 2, maxBackoffMs);
			return;
		}
		backoff = 1_000;
		since = v.seq;
		if (v.supported === false) {
			onUnsupported?.();
			timer = schedule(tick, supportedRetryMs);
			return;
		}
		if (v.baseline) {
			timer = schedule(tick, 0);
			return;
		}
		if (v.reset) onReset?.();
		else if ((v.paths && v.paths.length) || v.git) onChanges?.(v);
		timer = schedule(tick, 0);
	};
	void tick();
	return {
		stop() {
			stopped = true;
			if (timer !== null) unschedule(timer);
		},
	};
}
