/** Worker thread that owns one SQLite connection.
 *
 * `node:sqlite` is synchronous, so a slow statement on the main thread freezes
 * the entire Host — every other panel, tool call and session request waits for
 * it. Each SQLite connection therefore lives in its own worker: the main thread
 * posts `{id, op, args}` and gets `{id, ok, value|error}` back, and stays
 * responsive meanwhile. Cancelling a statement is `worker.terminate()`; the
 * connection is gone afterwards, which the panel explains rather than hides.
 *
 * Messages arrive one at a time and are handled synchronously, which is exactly
 * the semantics of a single SQLite connection.
 */

import { parentPort, workerData } from "node:worker_threads";

const ops = await import("./sqlite-ops.js");

const { DatabaseSync } = await import("node:sqlite");
const db = new DatabaseSync(String(workerData.path));

const handlers = {
	schema: (args) => ops.schema(db, args ?? {}),
	columns: (args) => ops.columns(db, String(args?.table ?? "")),
	rows: (args) => ops.rows(db, String(args?.table ?? ""), args ?? {}),
	query: (args) => ops.query(db, args?.sql, args?.limit),
	close: () => {
		try { db.close(); } catch { /* already closed */ }
		return { closed: true };
	},
};

parentPort.on("message", (message) => {
	const { id, op, args } = message ?? {};
	const handler = handlers[op];
	if (!handler) {
		parentPort.postMessage({ id, ok: false, error: `unknown database operation: ${op}` });
		return;
	}
	try {
		parentPort.postMessage({ id, ok: true, value: handler(args) });
	} catch (error) {
		// Errors cross the thread boundary as text: the panel shows the driver's
		// own message, which is the whole point of surfacing it.
		parentPort.postMessage({ id, ok: false, error: String(error?.message ?? error) });
	}
	if (op === "close") parentPort.postMessage({ id: `exit-${id}`, ok: true, value: { exited: true } });
});
