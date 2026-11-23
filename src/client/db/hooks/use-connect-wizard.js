/** The new-connection dialog: form state, address parsing, test and connect.
 *
 * The dialog is a two-step wizard (pick the engine, then fill the connection),
 * with an optional pasted address that fills the fields. Everything it owns is
 * local to the dialog; the two effects it has on the world — "a connection was
 * opened" and "remember this draft" — are injected as callbacks, so the wizard
 * never reaches into the connection list or the profile store itself.
 */

import { useCallback, useMemo, useState } from "../../react.js";
import { api } from "../../api.js";
import { DRIVERS, driverLabel, parseConnectionAddress } from "../../dbconnect.js";
import { CATEGORIES, defaultPort } from "../meta.js";

/** The empty form: `postgres` with its default port is the friendliest start. */
function initialForm() {
	return {
		address: "", label: "", color: "", note: "",
		driver: "postgres", path: "", host: "localhost", port: "5432",
		user: "", password: "", database: "", clientPath: "",
		sslMode: "", sslCa: "", sslCert: "", sslKey: "", urlParams: "",
		tunnelHost: "", tunnelPort: "22", tunnelUser: "", tunnelKey: "", tunnelLocalPort: "",
	};
}

/**
 * @param options - `{cwd, t, drivers, allowModule, saveDraft, onConnected, onNotice}`
 *   `saveDraft(draft)` remembers the connection, `onConnected(connection)` adds and
 *   selects it, `onNotice(text)` shows a message where the dialog and toolbar can.
 * @returns the dialog state and every action its fields call
 */
export function useConnectWizard({ cwd, t, drivers, allowModule, saveDraft, onConnected, onNotice, onEditProfile }) {
	const [connectOpen, setConnectOpen] = useState(false);
	const [form, setForm] = useState(initialForm);
	// Which step of the wizard is showing, and which tab inside the form step.
	const [step, setStep] = useState("pick");
	const [tab, setTab] = useState("info");
	const [showPassword, setShowPassword] = useState(false);
	// The pick step filters like dbx's: a search box and engine categories.
	const [pickQuery, setPickQuery] = useState("");
	const [pickCategory, setPickCategory] = useState("all");
	const [saveProfile, setSaveProfile] = useState(true);
	// The dialog's "Test" result: a connection proven without being kept.
	const [testState, setTestState] = useState({ busy: false, ok: null, text: "" });

	const openConnect = useCallback(() => {
		onEditProfile("");
		onNotice("");
		setTestState({ busy: false, ok: null, text: "" });
		setShowPassword(false);
		setStep("pick");
		setConnectOpen(true);
	}, [onNotice, onEditProfile]);

	/** Fill the form from a saved connection (the dialog's quick pick). */
	const useSavedProfile = useCallback((profile) => {
		onEditProfile(profile.id);
		const parsed = parseConnectionAddress(profile.address || profile.path || "");
		setForm({
			address: profile.address || profile.path || "",
			label: profile.label ?? "",
			color: profile.color ?? "",
			note: profile.note ?? "",
			...Object.fromEntries(Object.entries(profile.options ?? {}).filter(([, value]) => value !== undefined)),
			driver: profile.driver,
			path: profile.path ?? parsed.path,
			host: profile.host || parsed.host || "localhost",
			port: profile.port ? String(profile.port) : parsed.port,
			user: profile.user ?? parsed.user,
			password: "",
			database: profile.database ?? parsed.database,
			clientPath: "",
		});
		onNotice(parsed.error ?? "");
		setTestState({ busy: false, ok: null, text: "" });
	}, [onNotice, onEditProfile]);

	/** Engines the pick step should show for the current search/category. */
	const pickableDrivers = useMemo(() => {
		const needle = pickQuery.trim().toLowerCase();
		const category = CATEGORIES.find((entry) => entry.id === pickCategory);
		return DRIVERS.filter((id) => (category?.ids ? category.ids.includes(id) : true))
			.filter((id) => needle === "" || driverLabel(id).toLowerCase().includes(needle) || id.includes(needle));
	}, [pickQuery, pickCategory]);

	/** Switch driver, carrying the port over when it was still a default. */
	const setDriver = useCallback((driver) => {
		setForm((current) => {
			const defaultNow = defaultPort(current.driver);
			const keep = String(current.port ?? "") !== "" && String(current.port) !== defaultNow;
			return { ...current, driver, port: keep ? current.port : defaultPort(driver) };
		});
		onNotice("");
		setTestState({ busy: false, ok: null, text: "" });
	}, [onNotice]);

	/** Read a pasted address into driver and fields (the optional shortcut). */
	const applyAddress = useCallback((value) => {
		const parsed = parseConnectionAddress(value);
		setForm((current) => ({
			...current,
			address: value,
			driver: parsed.driver,
			path: parsed.driver === "sqlite" ? parsed.path : current.path,
			host: parsed.driver === "sqlite" ? current.host : (parsed.host || current.host),
			port: parsed.port,
			user: parsed.user,
			password: parsed.password,
			database: parsed.database,
		}));
		// The paste field is optional: it only reports a problem while it has text.
		onNotice(String(value).trim() === "" ? "" : parsed.error);
		// Any edit invalidates a previous test: it proved a different target.
		setTestState({ busy: false, ok: null, text: "" });
	}, [onNotice]);

	const driverReady = drivers.find((entry) => entry.id === form.driver)?.ready ?? true;
	// A driver whose CLI is not on PATH can still be chosen: the binary may be
	// keg-only, or the user may be about to install it. The note is a warning,
	// and the connect attempt reports the real reason.
	const canConnect = form.driver !== ""
		&& (form.driver === "sqlite" ? form.path.trim() !== "" : form.host.trim() !== "");

	const connectParams = useCallback(() => {
		const params = { driver: form.driver, cwd, allowModule: allowModule === true };
		if (form.driver === "sqlite") params.path = form.path.trim();
		else {
			params.host = form.host.trim();
			params.port = form.port ? Number(form.port) : undefined;
			params.user = form.user;
			params.password = form.password;
			params.database = form.database.trim();
			if (String(form.clientPath ?? "").trim() !== "") params.clientPath = form.clientPath.trim();
			if (String(form.sslMode ?? "") !== "") params.sslMode = form.sslMode;
			for (const key of ["sslCa", "sslCert", "sslKey", "urlParams"]) {
				if (String(form[key] ?? "").trim() !== "") params[key] = String(form[key]).trim();
			}
			if (String(form.tunnelHost ?? "").trim() !== "") {
				params.tunnel = {
					bastion: form.tunnelHost.trim(),
					port: Number(form.tunnelPort) || 22,
					user: form.tunnelUser.trim(),
					keyPath: String(form.tunnelKey ?? "").trim(),
					localPort: Number(form.tunnelLocalPort) || 0,
				};
			}
		}
		return params;
	}, [form, cwd, allowModule]);

	/**
	 * Prove the target without keeping it. dbx has this as a first-class action;
	 * the point is to get the driver's own error text before committing.
	 */
	const doTest = useCallback(async () => {
		if (!canConnect) return;
		setTestState({ busy: true, ok: null, text: "" });
		const res = await api("db.test", connectParams());
		if (!res.ok) { setTestState({ busy: false, ok: false, text: res.error }); return; }
		if (res.value?.error) { setTestState({ busy: false, ok: false, text: res.value.error }); return; }
		setTestState({ busy: false, ok: true, text: t("db.testOk").replace("{ms}", String(res.value.ms ?? 0)) });
	}, [canConnect, connectParams, t]);

	const doConnect = useCallback(async () => {
		if (!canConnect) return;
		const res = await api("db.connect", connectParams());
		if (!res.ok) { onNotice(res.error); return; }
		setConnectOpen(false);
		onNotice("");
		if (saveProfile) await saveDraft(form);
		await onConnected(res.value);
	}, [canConnect, connectParams, saveProfile, saveDraft, onConnected, onNotice, form]);

	return {
		connectOpen, setConnectOpen, form, setForm, step, setStep, tab, setTab,
		showPassword, setShowPassword, pickQuery, setPickQuery, pickCategory, setPickCategory,
		saveProfile, setSaveProfile, testState, setTestState,
		openConnect, useSavedProfile, setDriver, applyAddress, pickableDrivers,
		driverReady, canConnect, connectParams, doTest, doConnect,
	};
}
