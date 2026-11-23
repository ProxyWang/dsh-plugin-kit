/** Saved connections: the list, its revision guard and the write actions.
 *
 * The Host owns the profiles (passwords live in its vault); this hook is the
 * client-side view of them. Saves carry the revision the list was read at, so a
 * second window cannot silently overwrite a newer list — that is why the
 * revision lives here and not in the component that happens to render the rows.
 */

import { useCallback, useEffect, useRef, useState } from "../../react.js";
import { api } from "../../api.js";

/** The port a driver uses when the draft leaves it empty. */
function draftPort(draft) {
	if (draft.driver === "mysql") return 3306;
	if (draft.driver === "postgres") return 5432;
	return 0;
}

/**
 * @param options - `{cwd, editingProfileId, onNotice}`
 *   `editingProfileId` makes a save update that profile instead of adding one;
 *   `onNotice(text)` surfaces a save failure where the dialog can show it.
 * @returns the list, the revision, per-row errors and the read/write actions
 */
export function useProfiles({ cwd, onNotice }) {
	const [profiles, setProfiles] = useState([]);
	// Which profile a save updates; empty means "add a new one".
	const [editingProfileId, setEditingProfileId] = useState("");
	// The revision the list was read at: a save carries it so the Host can refuse
	// to overwrite a newer list written by another window.
	const revision = useRef(0);
	// Last failure per saved connection, shown on its row: a target that stopped
	// working should not look identical to one that never failed.
	const [profileErrors, setProfileErrors] = useState({});

	const reload = useCallback(async () => {
		const res = await api("db.profile.list", {});
		if (!res.ok) return;
		revision.current = res.value.revision ?? 0;
		setProfiles(res.value.profiles ?? []);
	}, []);

	// Load once: the rail shows the saved connections before anything is opened.
	useEffect(() => {
		api("db.profile.list", {}).then((res) => {
			if (!res.ok) return;
			revision.current = res.value.revision ?? 0;
			setProfiles(res.value.profiles ?? []);
		}).catch(() => {});
	}, []);

	/** Save the dialog's draft, updating the profile being edited when there is one. */
	const save = useCallback(async (draft) => {
		const port = draftPort(draft);
		const label = draft.driver === "sqlite"
			? (String(draft.path).split(/[\\/]/).pop() || draft.path)
			: `${draft.host}:${Number(draft.port) || port}${draft.database ? `/${draft.database}` : ""}`;
		// A relative file path is stored absolute: the profile outlives this
		// session, and its meaning must not change with the next workspace.
		const absolute = draft.driver === "sqlite" && draft.path !== "" && !/^(\/|~|[A-Za-z]:[\\/])/.test(draft.path) && cwd
			? `${cwd.replace(/\/+$/, "")}/${draft.path.replace(/^\.\//, "")}`
			: draft.path;
		const res = await api("db.profile.save", {
			baseRevision: revision.current,
			...(editingProfileId ? { id: editingProfileId } : {}),
			label: String(draft.label ?? "").trim() || label,
			color: draft.color ?? "",
			note: draft.note ?? "",
			options: {
				sslMode: draft.sslMode ?? "",
				sslCa: draft.sslCa ?? "",
				sslCert: draft.sslCert ?? "",
				sslKey: draft.sslKey ?? "",
				urlParams: draft.urlParams ?? "",
				tunnelHost: draft.tunnelHost ?? "",
				tunnelPort: draft.tunnelPort ?? "22",
				tunnelUser: draft.tunnelUser ?? "",
				tunnelKey: draft.tunnelKey ?? "",
				tunnelLocalPort: draft.tunnelLocalPort ?? "",
				clientPath: draft.clientPath ?? "",
			},
			driver: draft.driver,
			address: draft.address,
			path: absolute,
			host: draft.host,
			port: Number(draft.port) || port,
			user: draft.user,
			database: draft.database,
			...(draft.password ? { password: draft.password } : {}),
		});
		if (!res.ok) { onNotice(res.error); return; }
		revision.current = res.value.revision ?? revision.current;
		setProfiles((current) => [res.value.profile, ...current.filter((entry) => entry.id !== res.value.profile.id)]);
	}, [cwd, editingProfileId, onNotice]);

	/** Forget one saved connection (the Host deletes its vault secret too). */
	const forget = useCallback(async (profile) => {
		await api("db.profile.delete", { id: profile.id });
		setProfiles((current) => current.filter((entry) => entry.id !== profile.id));
	}, []);

	return { profiles, setProfiles, revision, profileErrors, setProfileErrors, reload, save, forget, editingProfileId, setEditingProfileId };
}
