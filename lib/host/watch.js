/**
 * Workspace file watching with a debounced coalesced event log and long-poll
 * delivery over the existing private JSON route (`watch.poll`).
 *
 * Design:
 * - One hub per resolved workspace root (shared by every session/tab on that
 *   root), built on `fs.watch(root, { recursive: true })`. On runtimes where
 *   recursive watching is unavailable (Linux below Node 20, exhausted watch
 *   descriptors) the hub degrades to `supported:false`; the client sees the
 *   flag and stops live refresh instead of pretending to work.
 * - Events are coalesced per path (last write wins) into monotonic batches;
 *   everything under `.git/` collapses into a single `gitSeq` tick because
 *   consumers only need "refresh git status", not per-ref filenames.
 * - Clients long-poll with their last seen batch seq. `snapshotFor` answers
 *   immediately when anything newer exists, otherwise the waiter is held up
 *   to `waitMs` and answered with an empty beat. If the client's cursor is
 *   older than what the log still retains, the answer is `reset:true` — the
 *   consumer re-reads whatever it holds rather than trusting a partial list.
 * - Hubs idle for IDLE_MS are swept; everything closes on plugin unload.
 */

import { watch as fsWatch } from "node:fs";
import { realpath } from "node:fs/promises";

const FLUSH_MS = 250;
const DEFAULT_WAIT_MS = 20_000;
const MAX_WAIT_MS = 29_000;
const LOG_CAP = 20_000;
const IDLE_MS = 5 * 60_000;
const SWEEP_MS = 60_000;

const hubs = new Map(); // realpath root → hub

function makeHub(root) {
	const hub = {
		root,
		seq: 0, // last flushed batch seq
		lostBelow: 0, // entries with seq < lostBelow may have been dropped (reset boundary)
		gitSeq: 0, // seq at which .git last ticked
		paths: new Map(), // path → seq of last change
		pending: new Set(),
		pendingGit: false,
		pendingCoarse: false, // filename-less event: force a reset for everyone
		timer: null,
		waiters: new Set(),
		handle: null,
		supported: true,
		lastPoll: Date.now(),
	};
	const schedule = () => {
		if (hub.timer !== null) return;
		hub.timer = setTimeout(flush, FLUSH_MS);
	};
	const flush = () => {
		hub.timer = null;
		let changed = false;
		if (hub.pending.size > 0) {
			hub.seq++;
			for (const path of hub.pending) {
				hub.paths.delete(path); // reinsert so iteration order follows last-change seq
				hub.paths.set(path, hub.seq);
			}
			hub.pending.clear();
			changed = true;
			while (hub.paths.size > LOG_CAP) {
				const oldest = hub.paths.keys().next().value;
				const oldestSeq = hub.paths.get(oldest);
				hub.paths.delete(oldest);
				if (oldestSeq >= hub.lostBelow) hub.lostBelow = oldestSeq + 1;
			}
		}
		if (hub.pendingGit) {
			hub.seq++;
			hub.gitSeq = hub.seq;
			hub.pendingGit = false;
			changed = true;
		}
		if (hub.pendingCoarse) {
			hub.lostBelow = hub.seq + 1;
			hub.pendingCoarse = false;
			changed = true;
		}
		if (changed) for (const waiter of [...hub.waiters]) settle(hub, waiter);
		if (hub.pending.size > 0 || hub.pendingGit || hub.pendingCoarse) schedule();
	};
	const onEvent = (event, filename) => {
		if (filename === undefined || filename === null || filename === "") {
			hub.pendingCoarse = true;
			schedule();
			return;
		}
		const rel = String(filename).split(/[\\/]/).join("/");
		if (rel === ".git" || rel.startsWith(".git/")) hub.pendingGit = true;
		else hub.pending.add(rel);
		schedule();
	};
	try {
		hub.handle = fsWatch(root, { recursive: true }, onEvent);
		hub.handle.on("error", () => {
			hub.supported = false;
			closeHub(hub);
			for (const waiter of [...hub.waiters]) settle(hub, waiter, { force: true });
		});
	} catch {
		// Recursive watching unsupported or descriptor limits exhausted:
		// live refresh degrades off, every other route keeps working.
		hub.supported = false;
	}
	return hub;
}

function closeHub(hub) {
	if (hub.timer !== null) {
		clearTimeout(hub.timer);
		hub.timer = null;
	}
	try {
		hub.handle?.close();
	} catch { /* already closed */ }
	hub.handle = null;
}

/** What a waiter at `since` may receive right now (ready=false → still holding). */
function snapshotFor(hub, since) {
	if (!hub.supported) return { ready: true, value: { seq: hub.seq, supported: false } };
	if (since < hub.lostBelow - 1) return { ready: true, value: { seq: hub.seq, reset: true } };
	const paths = [];
	for (const [path, seq] of hub.paths) if (seq > since) paths.push(path);
	const git = hub.gitSeq > since;
	if (paths.length === 0 && !git) return { ready: false, value: null };
	return { ready: true, value: { seq: hub.seq, paths, git } };
}

function settle(hub, waiter, opts) {
	const snap = opts?.force ? { ready: true, value: { seq: hub.seq, reset: true } } : snapshotFor(hub, waiter.since);
	if (!snap.ready) return false;
	waiter.timer?.(); // cancel the hold deadline
	hub.waiters.delete(waiter);
	waiter.off?.(); // detach any response-close hook
	waiter.deliver(snap.value);
	return true;
}

async function poll(body, ctx) {
	const cwd = String(body.cwd ?? "");
	if (cwd === "") throw new Error("cwd is required");
	const root = await realpath(cwd);
	let hub = hubs.get(root);
	if (!hub) {
		hub = makeHub(root);
		if (hub.supported) hubs.set(root, hub);
		else return { seq: 0, supported: false };
	}
	hub.lastPoll = Date.now();
	ensureSweeper();
	const wantWait = Math.min(Math.max(Number(body.waitMs) || DEFAULT_WAIT_MS, 1), MAX_WAIT_MS);
	// First contact establishes the cursor baseline; the client then streams from it.
	if (!Number.isInteger(body.since) || body.since < 0) return { seq: hub.seq, baseline: true, supported: hub.supported };
	if (!hub.supported) return { seq: hub.seq, supported: false };
	const already = snapshotFor(hub, body.since);
	if (already.ready) return already.value;
	return new Promise((resolvePromise) => {
		const waiter = { since: body.since, deliver: resolvePromise, timer: null, off: null };
		const hold = setTimeout(() => {
			if (!hub.waiters.has(waiter)) return;
			hub.waiters.delete(waiter);
			resolvePromise({ seq: hub.seq, paths: [], git: false });
		}, wantWait);
		waiter.timer = () => clearTimeout(hold);
		waiter.off = () => clearTimeout(hold);
		// A closed response means the client is gone: drop the waiter promptly.
		// (Real IncomingMessage responses only; the test stub has no emitter.)
		if (ctx?.res && typeof ctx.res.on === "function" && ctx.res.writableFinished === false) {
			const onClose = () => {
				if (!hub.waiters.has(waiter)) return;
				hub.waiters.delete(waiter);
				clearTimeout(hold);
			};
			ctx.res.on("close", onClose);
			waiter.off = () => {
				clearTimeout(hold);
				try {
					ctx.res.off?.("close", onClose) ?? ctx.res.removeListener?.("close", onClose);
				} catch { /* socket already gone */ }
			};
		}
		hub.waiters.add(waiter);
	});
}

// Sweeper is (re)created on demand so a plugin reload after stopAllWatchers keeps working.
let sweeper = null;
function ensureSweeper() {
	if (sweeper !== null) return;
	sweeper = setInterval(() => {
		const now = Date.now();
		for (const [root, hub] of hubs) {
			if (now - hub.lastPoll > IDLE_MS) {
				closeHub(hub);
				hubs.delete(root);
				for (const waiter of [...hub.waiters]) settle(hub, waiter, { force: true });
			}
		}
	}, SWEEP_MS);
	sweeper.unref?.();
}

function stopAllWatchers() {
	if (sweeper !== null) clearInterval(sweeper);
	sweeper = null;
	for (const [, hub] of hubs) {
		closeHub(hub);
		for (const waiter of [...hub.waiters]) settle(hub, waiter, { force: true });
	}
	hubs.clear();
}

export { poll, snapshotFor, stopAllWatchers, hubs, makeHub };
