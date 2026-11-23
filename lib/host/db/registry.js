/** The live-connection registry.
 *
 * One map owns every open connection; everything else asks this module for a
 * handle. Engines, schema loading and the routes all go through `connOf`, so a
 * connection id means the same thing everywhere.
 */

/** id → {driver, label, config?, runner?, tunnel?, profileId?} */
export const connections = new Map();

export function connOf(id) {
	const conn = connections.get(String(id));
	if (!conn) throw new Error("unknown connection");
	return conn;
}

export function listConnections() {
	return [...connections.entries()].map(([id, conn]) => ({
		id,
		driver: conn.driver,
		label: conn.label,
		path: conn.config?.path ?? "",
		database: conn.config?.database ?? "",
		profileId: conn.profileId ?? "",
		impl: conn.impl ?? "",
	}));
}

/** Close whatever a connection holds (worker runner or an inline handle). */
export function closeQuietly(conn) {
	try {
		conn.tunnel?.close?.();
		if (conn.runner) { void conn.runner.close().catch(() => {}); return; }
		conn.handle?.close?.();
	} catch { /* teardown races are not errors */ }
}

export function closeAll() {
	for (const conn of connections.values()) closeQuietly(conn);
	connections.clear();
}
