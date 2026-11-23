/** The live-connection list: what the Host has open, and which one is active.
 *
 * The Host owns the connections, so this hook re-reads them on mount — a page
 * refresh used to forget them, and the next click on a saved connection opened a
 * second copy of the same target. Duplicates of one profile are folded here, by
 * disconnecting the extras, so the rail never shows the same database twice.
 */

import { useCallback, useEffect, useState } from "../../react.js";
import { api } from "../../api.js";

/**
 * @returns the list, the active connection and database, and a disconnect action
 */
export function useConnections() {
	const [connections, setConnections] = useState([]);
	const [activeConn, setActiveConn] = useState("");
	const [activeDb, setActiveDb] = useState({ conn: "", database: "" });

	// Recover the Host's live connections after a reload.
	useEffect(() => {
		api("db.connections", {}).then((res) => {
			if (!res.ok || !Array.isArray(res.value)) return;
			const seen = new Set();
			const keep = [];
			for (const connection of res.value) {
				const key = connection.profileId || connection.id;
				if (connection.profileId && seen.has(key)) {
					// Duplicates came from clicking a saved connection twice; close the extras.
					void api("db.disconnect", { id: connection.id });
					continue;
				}
				seen.add(key);
				keep.push(connection);
			}
			setConnections(keep);
			if (keep.length > 0) setActiveConn((current) => current || keep[0].id);
		}).catch(() => {});
	}, []);

	/** Close one connection on the Host and drop it from the list. */
	const disconnect = useCallback(async (id) => {
		await api("db.disconnect", { id });
		setConnections((current) => current.filter((entry) => entry.id !== id));
		if (activeConn === id) setActiveConn("");
	}, [activeConn]);

	return { connections, setConnections, activeConn, setActiveConn, activeDb, setActiveDb, disconnect };
}
