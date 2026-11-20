/** Worker thread that owns one database connection.
 *
 * Two kinds of connection run here:
 *
 *   - `sqlite`: `node:sqlite` is synchronous, so a slow statement on the main
 *     thread would freeze the whole Host;
 *   - `module`: a JavaScript driver (`mysql2` / `pg`) loaded from the session
 *     workspace, isolated so a driver that crashes or blocks takes one
 *     connection down instead of the Host.
 *
 * Either way the protocol is the same: `{id, op, args}` in, `{id, ok, value}`
 * or `{id, ok: false, error}` out. Cancelling is `worker.terminate()`.
 */

import { parentPort, workerData } from "node:worker_threads";

const kind = workerData?.kind ?? "sqlite";
let handlers;

if (kind === "module") {
	const { openModuleRunner } = await import("./drivers/module-runner.js");
	const runner = await openModuleRunner({
		driver: String(workerData.driver ?? ""),
		entry: String(workerData.entry ?? ""),
		config: workerData.config ?? {},
	});
	handlers = {
		schema: (args) => runner.call("schema", args ?? {}),
		columns: (args) => runner.call("columns", { ...args, table: String(args?.table ?? "") }),
		rows: (args) => runner.call("rows", { ...args, table: String(args?.table ?? "") }),
		query: (args) => runner.call("query", args ?? {}),
		close: async () => {
			await runner.close();
			return { closed: true };
		},
	};
} else {
	const ops = await import("./sqlite-ops.js");
	const { DatabaseSync } = await import("node:sqlite");
	const db = new DatabaseSync(String(workerData.path));
	handlers = {
		schema: (args) => ops.schema(db, args ?? {}),
		columns: (args) => ops.columns(db, String(args?.table ?? "")),
		rows: (args) => ops.rows(db, String(args?.table ?? ""), args ?? {}),
		query: (args) => ops.query(db, args?.sql, args?.limit),
		close: () => {
			try { db.close(); } catch { /* already closed */ }
			return { closed: true };
		},
	};
}

parentPort.on("message", async (message) => {
	const { id, op, args } = message ?? {};
	const handler = handlers[op];
	if (!handler) {
		parentPort.postMessage({ id, ok: false, error: `unknown database operation: ${op}` });
		return;
	}
	try {
		parentPort.postMessage({ id, ok: true, value: await handler(args) });
	} catch (error) {
		// Errors cross the thread boundary as text: the panel shows the driver's
		// own message, which is the whole point of surfacing it.
		parentPort.postMessage({ id, ok: false, error: String(error?.message ?? error) });
	}
});
