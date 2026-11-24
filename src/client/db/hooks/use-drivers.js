/** The driver catalog: what the panel may connect with, and whether it is ready.
 *
 * The Host reports every implementation of every driver (bundled module, project
 * module, CLI) with `ready`/`note`/`version`. This hook owns that list, the
 * project-module permission it is probed with, and the actions the 驱动管理 dialog
 * offers (re-probe, install into the project, copy a CLI install command).
 */

import { useCallback, useEffect, useState } from "../../react.js";
import { api } from "../../api.js";

import { keys } from "../../storage.js";

const ALLOW_MODULE_KEY = keys.allowModule();

/**
 * @param options - `{cwd, t, onNotice}`
 * @returns the catalog, the permission flag and the driver actions
 */
export function useDrivers({ cwd, t, onNotice }) {
	const [drivers, setDrivers] = useState([]);
	// A project's own mysql2/pg only runs when the user allows project code.
	const [allowModule, setAllowModuleState] = useState(() => {
		try { return localStorage.getItem(ALLOW_MODULE_KEY) === "on"; } catch { return false; }
	});
	// Progress and result of an install, shown next to the driver it targets.
	const [installState, setInstallState] = useState(null);

	const probe = useCallback(async (refresh = false) => {
		// `allowWorkspace` is what turns a resolvable project module from "found"
		// into "will be used"; the catalog reports the difference.
		const body = { allowWorkspace: allowModule === true, ...(refresh ? { refresh: true } : {}) };
		const res = await api("db.drivers", body);
		// The readiness list only decorates the optional override; a failed probe
		// must not silence the panel, so it degrades to "assume ready" and the Host
		// reports the real reason when connecting.
		if (res.ok) setDrivers(res.value ?? []);
	}, [allowModule]);

	useEffect(() => { void probe(); }, [probe]);

	/** Remember the permission and re-probe, so the dialog reflects it at once. */
	const setAllowModule = useCallback((next) => {
		setAllowModuleState(next);
		try { localStorage.setItem(ALLOW_MODULE_KEY, next ? "on" : "off"); } catch { /* storage may be denied */ }
	}, []);

	/** Install a whitelisted module into the project, then re-probe. */
	const install = useCallback(async (name) => {
		setInstallState((current) => ({ ...(current ?? {}), installing: name, error: "" }));
		const res = await api("db.driver.install", { name, cwd });
		const value = res.ok ? res.value : null;
		if (!value || value.error) {
			setInstallState((current) => ({ ...(current ?? {}), installing: "", error: value?.error ?? res.error ?? "" }));
			return;
		}
		setInstallState((current) => ({ ...(current ?? {}), installing: "", installed: name }));
		await probe(true);
	}, [cwd, probe]);

	/** Copy a CLI install command for the user to run in their own terminal. */
	const copyCommand = useCallback(async (text) => {
		try {
			await navigator.clipboard.writeText(text);
			onNotice(t("db.copied"));
		} catch {
			onNotice(t("db.copyFailed"));
		}
	}, [t, onNotice]);

	return { drivers, setDrivers, probe, allowModule, setAllowModule, installState, install, copyCommand };
}
