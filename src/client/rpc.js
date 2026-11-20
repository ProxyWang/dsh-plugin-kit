/* ---------------- RPC workbench: gRPC over a .proto, Bruno-style ----------------
 *
 * The API panel speaks HTTP; this one speaks gRPC. Shape, after Bruno's gRPC
 * request tab (and the way every gRPC client lays out):
 *
 *   [server address] [.proto path] [Load]
 *   rail: services → methods        main: request JSON, metadata, Invoke
 *                                    response: status, messages, headers, trailers
 *
 * The host does the protocol work (`rpc.proto` parses the file and lists the
 * methods, `rpc.call` frames the request over HTTP/2 and decodes the reply),
 * so this component owns state and layout only.
 */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { api } from "./api.js";
import { useAutoHeight } from "./autosize.js";
import { GRPC_SCHEMES, joinAddress, splitAddress } from "./grpcaddr.js";
import { RPC_TAB_ID, RPC_TAB_KIND } from "./constants.js";
import { apiKey, migrateLegacyApiStores } from "./apistore.js";
import { activeVariables, entryLabel, filterByProtocol, HISTORY_CAP, interpolateDeep, interpolateVariables, withProtocol, removeHistoryEntry, clearHistoryEntries } from "./apientries.js";
import { useDismissLayer } from "./dismiss.js";

export const rpcDefinition = (t) => ({
	id: RPC_TAB_ID,
	kind: RPC_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("rpc.label"),
	guide: [],
});

/** Pure: pretty-print a JSON text, or return the reason it cannot be parsed. */
export function parseJsonText(text) {
	const trimmed = String(text ?? "").trim();
	if (trimmed === "") return { value: {}, error: "" };
	try {
		return { value: JSON.parse(trimmed), error: "" };
	} catch (error) {
		return { value: null, error: String(error?.message ?? error) };
	}
}

/** Pure: the stream arrow shown next to a method (`→` server, `↔` bidi, …). */
export function methodArrows(method) {
	if (method?.clientStreaming && method?.serverStreaming) return "↔";
	if (method?.clientStreaming) return "→|";
	if (method?.serverStreaming) return "|→";
	return "→";
}

/** Pure: group a flat method list by service, preserving declaration order. */
export function groupMethods(methods) {
	const groups = new Map();
	for (const method of methods ?? []) {
		if (!groups.has(method.service)) groups.set(method.service, []);
		groups.get(method.service).push(method);
	}
	return [...groups.entries()].map(([service, entries]) => ({ service, methods: entries }));
}

/**
 * Split a path into the part that may be truncated and the part that must not.
 *
 * A picker row is narrow; truncating from the right would eat the file name,
 * which is the only part that identifies the choice.
 *
 * @param path - workspace-relative path
 * @returns `{dir, name}` with the trailing slash kept on the directory
 */
export function splitProtoPath(path) {
	const text = String(path ?? "");
	const cut = text.lastIndexOf("/");
	return cut < 0 ? { dir: "", name: text } : { dir: text.slice(0, cut + 1), name: text.slice(cut + 1) };
}

/**
 * Workspace `.proto` picker.
 *
 * Typing a path is fine when you know it; finding one is what a file tree is
 * for. The picker searches the session workspace for `.proto` files (the host
 * filters by suffix before limiting) and loads the choice in one click.
 *
 * @param props - `{ t, cwd, onPick, onClose }`
 */
export function ProtoPicker({ t, cwd, box, onPick, onClose }) {
	const [query, setQuery] = useState("");
	const [matches, setMatches] = useState([]);
	const [busy, setBusy] = useState(true);
	const [index, setIndex] = useState(0);
	const panelRef = useDismissLayer({ open: true, onDismiss: onClose, ignoreSelector: '[data-ce-popup-trigger="rpc-proto"]' });

	useEffect(() => {
		let alive = true;
		setBusy(true);
		const timer = setTimeout(() => {
			api("search.files", { cwd, query, suffix: ".proto", limit: 200 }).then((res) => {
				if (!alive) return;
				setBusy(false);
				// The host filters by suffix before its limit, but the same filter is
				// applied here too: a Host that predates the parameter would
				// otherwise fill the list with `.md` and `.gitignore` rows.
				const paths = (res.ok ? res.value.matches ?? [] : [])
					.map((entry) => entry.path)
					.filter((path) => typeof path === "string" && path.toLowerCase().endsWith(".proto"));
				// With no query the host returns walk order, which looks random in a
				// list; sort it. A real query keeps the host's relevance ranking.
				setMatches(query.trim() === "" ? paths.sort((a, b) => a.localeCompare(b)) : paths);
				setIndex(0);
			});
		}, 120);
		return () => { alive = false; clearTimeout(timer); };
	}, [cwd, query]);

	const onKeyDown = (event) => {
		if (event.key === "ArrowDown") { event.preventDefault(); setIndex((value) => Math.min(matches.length - 1, value + 1)); }
		else if (event.key === "ArrowUp") { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
		else if (event.key === "Enter") { event.preventDefault(); if (matches[index]) onPick(matches[index]); }
		else if (event.key === "Escape") { event.preventDefault(); onClose(); }
	};

	return h("div", {
		className: "cerpc-picker cerpc-picker-floating",
		ref: panelRef,
		role: "dialog",
		"aria-label": t("rpc.pickProto"),
		style: box ? { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px` } : undefined,
		onKeyDown,
	},
		h("input", {
			className: "ce-input cerpc-picker-input",
			value: query,
			autoFocus: true,
			spellCheck: false,
			placeholder: t("rpc.pickPlaceholder"),
			onChange: (event) => setQuery(event.target.value),
		}),
		matches.length === 0
			? h("div", { className: "cerpc-picker-empty" },
				busy ? t("loading") : h(Fragment, null,
					h("div", { className: "cerpc-picker-empty-title" }, t("rpc.noProto")),
					h("div", { className: "cerpc-picker-empty-hint" }, t("rpc.noProtoHint"))))
			: h(Fragment, null,
				h("div", { className: "cerpc-picker-list ce-scroll" }, matches.map((path, position) => {
				const parts = splitProtoPath(path);
				return h("button", {
					key: path,
					type: "button",
					className: `cerpc-picker-row${position === index ? " cerpc-picker-row-on" : ""}`,
					title: path,
					onMouseEnter: () => setIndex(position),
					onClick: () => onPick(path),
				},
					h("span", { className: "cerpc-picker-dir" }, parts.dir),
					h("span", { className: "cerpc-picker-name" }, parts.name));
				})),
				h("div", { className: "cerpc-picker-foot" }, `${matches.length} ${t("rpc.protoCount")}`)),
	);
}

export function RpcView({ t, useTabInfo, sessionId, useSessions, incoming }) {
	const cwd = useSessions ? useSessions((sessions) => (sessionId ? sessions.byId[sessionId]?.cwd : void 0)) : void 0;

	const [address, setAddress] = useState("");
	const [protoPath, setProtoPath] = useState("");
	const [methods, setMethods] = useState([]);
	const [protoError, setProtoError] = useState("");
	const [protoFiles, setProtoFiles] = useState([]);
	const [protoBusy, setProtoBusy] = useState(false);
	// Set when the methods came from server reflection instead of a file: the
	// call then carries this id rather than a .proto path.
	const [schemaId, setSchemaId] = useState("");
	// The request body grows with its content instead of living in a 70px box.
	const requestRef = useRef(null);
	const [selected, setSelected] = useState(""); // method path
	const [requestText, setRequestText] = useState("{}");
	const [metadata, setMetadata] = useState([]);
	const [response, setResponse] = useState(null);
	const [busy, setBusy] = useState(false);
	const [timeoutMs, setTimeoutMs] = useState(30000);
	const [insecureTls, setInsecureTls] = useState(false);
	// History, favorites and environments are the workbench's stores, shared with
	// the HTTP pane; this pane only ever sees its own protocol's rows.
	const [history, setHistory] = useState([]);
	const [saved, setSaved] = useState([]);
	const [envStore, setEnvStore] = useState({ envs: [], activeId: null });
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [drawerTab, setDrawerTab] = useState("history");
	// Clearing is a two-step action; the arming state resets when the drawer closes.
	const [confirmClear, setConfirmClear] = useState(false);
	const drawerRef = useDismissLayer({ open: drawerOpen, onDismiss: () => setDrawerOpen(false), ignoreSelector: '[data-ce-popup-trigger="rpc-history"]' });

	const keys = useMemo(() => ({
		history: apiKey("history", cwd ?? ""),
		saved: apiKey("saved", cwd ?? ""),
		env: apiKey("env", cwd ?? ""),
	}), [cwd]);

	const readStored = useCallback(() => {
		const read = (key) => {
			try {
				const raw = localStorage.getItem(key);
				const value = raw === null ? null : JSON.parse(raw);
				return Array.isArray(value) ? value : null;
			} catch {
				return null;
			}
		};
		if (cwd) migrateLegacyApiStores(cwd);
		// The stores are shared with HTTP; this pane keeps only its own protocol.
		setHistory(filterByProtocol(read(keys.history), "grpc"));
		setSaved(filterByProtocol(read(keys.saved), "grpc"));
		try {
			const env = JSON.parse(localStorage.getItem(keys.env) ?? "null");
			setEnvStore(env && typeof env === "object" && Array.isArray(env.envs) ? env : { envs: [], activeId: null });
		} catch {
			setEnvStore({ envs: [], activeId: null });
		}
	}, [cwd, keys]);

	useEffect(() => { readStored(); }, [readStored]);

	/**
	 * Write one record into a shared store without dropping the other protocol's
	 * rows: the pane owns only its own slice of the list.
	 * @param key - the storage key.
	 * @param entry - the record to add.
	 * @param cap - maximum rows kept (history only).
	 * @returns the full merged list that was stored.
	 */
	const writeMerged = useCallback((key, entry, cap = Number.POSITIVE_INFINITY) => {
		let rows = [];
		try {
			const raw = JSON.parse(localStorage.getItem(key) ?? "null");
			if (Array.isArray(raw)) rows = raw;
		} catch { rows = []; }
		const next = [entry, ...rows.filter((row) => row?.id !== entry.id)].slice(0, cap);
		try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota: the call still ran */ }
		return next;
	}, []);

	/** Put one stored record back into the editor. */
	const applyEntry = useCallback((entry) => {
		const request = entry?.request ?? {};
		if (typeof request.address === "string") setAddress(request.address);
		if (typeof request.proto === "string") setProtoPath(request.proto);
		if (typeof request.method === "string") setSelected(request.method);
		if (request.body !== undefined) setRequestText(JSON.stringify(request.body, null, 2));
		if (Array.isArray(request.metadata)) setMetadata(request.metadata.map((row) => ({ ...row })));
		setResponse(null);
		setDrawerOpen(false);
	}, []);

	// A row picked in the workbench's merged history arrives here once; applying it
	// is the only way that panel can drive this one.
	useEffect(() => {
		if (!incoming || incoming.protocol !== "grpc" || !incoming.entry) return;
		applyEntry(incoming.entry);
	}, [incoming?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

	const selectedMethod = useMemo(() => methods.find((method) => method.path === selected) ?? null, [methods, selected]);
	const groups = useMemo(() => groupMethods(methods), [methods]);
	const request = useMemo(() => parseJsonText(requestText), [requestText]);
	useAutoHeight(requestRef, requestText, { min: 96 });

	const loadProto = useCallback(async (overridePath) => {
		const path = String(overridePath ?? protoPath).trim();
		if (path === "") { setProtoError(t("rpc.protoRequired")); return; }
		setProtoBusy(true);
		setProtoError("");
		const res = await api("rpc.proto", { cwd, path });
		setProtoBusy(false);
		if (!res.ok) { setProtoError(res.error); setMethods([]); return; }
		if (res.value?.error) { setProtoError(res.value.error); setMethods([]); return; }
		setMethods(res.value.methods ?? []);
		setProtoFiles(res.value.files ?? []);
		setSchemaId("");
		const first = res.value.methods?.[0];
		if (first) {
			setSelected(first.path);
			// Seed the editor with the request message's zero value: a gRPC call
			// with an empty body is a protocol error, so a skeleton is required.
			setRequestText(JSON.stringify(first.sample ?? {}, null, 2));
		}
	}, [cwd, protoPath, t]);

	/**
	 * Ask the server for its schema (gRPC reflection) instead of reading a file.
	 * The panel then calls with the returned schema id, so a server that exposes
	 * reflection needs no `.proto` at all.
	 */
	const discoverSchema = useCallback(async () => {
		const target = address.trim();
		if (target === "") { setProtoError(t("rpc.addressRequired")); return; }
		setProtoBusy(true);
		setProtoError("");
		const res = await api("rpc.discover", { url: target, insecureTls, timeoutMs });
		setProtoBusy(false);
		const value = res.ok ? res.value : { error: res.error };
		if (value.error) {
			// A server without reflection is a normal state, not a crash: say so
			// and keep whatever the panel already had.
			setProtoError(`${t("rpc.reflectionUnavailable")}: ${value.error}`);
			return;
		}
		setMethods(value.methods ?? []);
		setProtoFiles(value.files ?? []);
		setSchemaId(value.schemaId ?? "");
		// A server may advertise a service it cannot describe; that is worth
		// saying, because the missing methods look like a panel bug otherwise.
		const skipped = value.skipped ?? [];
		if (skipped.length > 0) {
			setProtoError(`${t("rpc.skippedServices")}: ${skipped.map((entry) => entry.service ?? entry).join(", ")}`);
		}
		const first = value.methods?.[0];
		if (first) {
			setSelected(first.path);
			setRequestText(JSON.stringify(first.sample ?? {}, null, 2));
		}
	}, [address, insecureTls, timeoutMs, t]);

	const [pickerOpen, setPickerOpen] = useState(false);

	useEffect(() => {
		if (!pickerOpen) return undefined;
		const close = () => setPickerOpen(false);
		globalThis.addEventListener?.("resize", close);
		globalThis.addEventListener?.("scroll", close, true);
		return () => {
			globalThis.removeEventListener?.("resize", close);
			globalThis.removeEventListener?.("scroll", close, true);
		};
	}, [pickerOpen]);

	// The list is positioned against the viewport: a 560px panel anchored inside
	// a narrow toolbar made the whole workspace scroll sideways.
	const protoAnchor = useRef(null);
	const [pickerBox, setPickerBox] = useState(null);

	/** Open the chooser under its field, clamped to the window. */
	const openPicker = useCallback(() => {
		const rect = protoAnchor.current?.getBoundingClientRect?.();
		if (rect) {
			const viewport = Number(globalThis.innerWidth) || 1200;
			const left = Math.max(8, Math.min(rect.left, viewport - 320));
			setPickerBox({ left, top: rect.bottom + 6, width: Math.min(560, Math.max(320, viewport - left - 16)) });
		}
		setPickerOpen(true);
	}, []);

	// Distinct .proto files this session already called, newest first — the
	// fastest way back into a service you were debugging a minute ago.
	const recentProtos = useMemo(() => {
		const seen = new Set();
		const out = [];
		for (const entry of history) {
			const path = entry?.request?.proto;
			if (typeof path !== "string" || path === "" || seen.has(path)) continue;
			seen.add(path);
			out.push(path);
			if (out.length >= 4) break;
		}
		return out;
	}, [history]);
	// The field shows `host:port`; the scheme is the selector beside it.
	const addressParts = splitAddress(address);

	/** A file chosen in the picker is also loaded: one click, methods appear. */
	const pickProto = useCallback((path) => {
		setPickerOpen(false);
		setProtoPath(path);
		void loadProto(path);
	}, [loadProto]);

	/** Drop one row from whichever store the drawer is showing. */
	const removeEntry = useCallback((entry) => {
		removeHistoryEntry(drawerTab === "history" ? keys.history : keys.saved, entry.id);
		readStored();
	}, [drawerTab, keys.history, keys.saved, readStored]);

	/** Empty the visible store (two steps: the first click arms it). */
	const clearEntries = useCallback(() => {
		if (!confirmClear) { setConfirmClear(true); return; }
		clearHistoryEntries(drawerTab === "history" ? keys.history : keys.saved);
		readStored();
		setConfirmClear(false);
	}, [confirmClear, drawerTab, keys.history, keys.saved, readStored]);

	const chooseMethod = useCallback((method) => {		setSelected(method.path);
		if (requestText.trim() === "{}" || requestText.trim() === "") setRequestText(JSON.stringify(method.sample ?? {}, null, 2));
	}, [requestText]);

	const invoke = useCallback(async () => {
		if (!selectedMethod || busy) return;
		if (request.error) return;
		setBusy(true);
		setResponse(null);
		// The active environment's variables apply to the address, the metadata and
		// the message, so one call is reproducible across environments.
		const vars = activeVariables(envStore);
		const meta = {};
		for (const row of metadata) {
			const name = interpolateVariables(String(row.name ?? "").trim(), vars);
			if (name !== "" && row.enabled !== false) meta[name] = interpolateVariables(String(row.value ?? ""), vars);
		}
		const body = interpolateDeep(request.value, vars);
		const target = interpolateVariables(address.trim(), vars);
		const res = await api("rpc.call", {
			cwd,
			proto: protoPath.trim(),
			...(schemaId ? { schemaId } : {}),
			method: selectedMethod.path,
			url: target,
			messages: [body],
			metadata: meta,
			timeoutMs,
			insecureTls,
		});
		setBusy(false);
		const value = res.ok ? res.value : { error: res.error };
		setResponse(value);
		// Every settled call joins the shared history, tagged so the merged list can
		// tell it apart from an HTTP request.
		const entry = withProtocol({
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			ts: Date.now(),
			status: value?.status,
			ms: value?.ms,
			error: value?.error ?? void 0,
			request: {
				address: target,
				proto: protoPath.trim(),
				method: selectedMethod.path,
				body,
				metadata: metadata.filter((row) => String(row.name ?? "").trim() !== "" && row.enabled !== false).map((row) => ({ ...row })),
			},
		}, "grpc");
		const merged = writeMerged(keys.history, entry, HISTORY_CAP);
		setHistory(filterByProtocol(merged, "grpc"));
	}, [busy, cwd, protoPath, selectedMethod, address, request, metadata, timeoutMs, insecureTls, envStore, keys.history]);

	/** Save the current call into favorites under a readable, derived name. */
	const saveFavorite = useCallback(() => {
		if (!selectedMethod) return;
		const name = `${selectedMethod.name} → ${interpolateVariables(address.trim(), activeVariables(envStore)) || "?"}`;
		const entry = withProtocol({
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			ts: Date.now(),
			name,
			request: {
				address: address.trim(),
				proto: protoPath.trim(),
				method: selectedMethod.path,
				body: request.value ?? {},
				metadata: metadata.filter((row) => String(row.name ?? "").trim() !== "" && row.enabled !== false).map((row) => ({ ...row })),
			},
		}, "grpc");
		// Same name replaces the old favorite, across the whole shared store.
		const merged = writeMerged(keys.saved, entry).filter((row) => row?.name !== name || row.id === entry.id);
		try { localStorage.setItem(keys.saved, JSON.stringify(merged)); } catch { /* best effort */ }
		setSaved(filterByProtocol(merged, "grpc"));
	}, [selectedMethod, address, envStore, protoPath, request, metadata, keys.saved]);

	const onKeyDown = useCallback((event) => {
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			event.preventDefault();
			void invoke();
		}
	}, [invoke]);

	if (!cwd) {
		return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
	}

	const okStatus = response && !response.error && response.status === 0;

	return h("div", { className: "ce-root cerpc-root", onKeyDown },
		// ---- toolbar ---------------------------------------------------------------------
		h("div", { className: "cerpc-toolbar" },
			h("label", { className: "cerpc-field" },
				h("span", { className: "cerpc-label" }, t("rpc.address")),
				h("div", { className: "cerpc-address" },
					h("select", {
						className: "ce-input cerpc-scheme",
						value: addressParts.scheme,
						"aria-label": t("rpc.scheme"),
						onChange: (event) => setAddress(joinAddress(event.target.value, addressParts.host)),
					}, GRPC_SCHEMES.map((scheme) => h("option", { key: scheme, value: scheme }, scheme))),
					h("input", {
						className: "ce-input cerpc-input cerpc-host",
						value: addressParts.host,
						spellCheck: false,
						placeholder: "10.0.0.1:50051",
						onChange: (event) => setAddress(joinAddress(addressParts.scheme, event.target.value)),
					}))),
			h("div", { className: "cerpc-field cerpc-proto" },
				h("span", { className: "cerpc-label" }, t("rpc.proto")),
				h("div", { className: "cerpc-proto-row", ref: protoAnchor },
					h("input", { className: "ce-input cerpc-input", value: protoPath, spellCheck: false, placeholder: "proto/hello.proto", onChange: (event) => setProtoPath(event.target.value) }),
					h("button", {
						type: "button",
						className: "ce-sk-btn",
						"data-ce-popup-trigger": "rpc-proto",
						"aria-expanded": pickerOpen,
						title: t("rpc.browseHint"),
						onClick: () => (pickerOpen ? setPickerOpen(false) : openPicker()),
					}, t("rpc.browse"))),
				pickerOpen ? h(ProtoPicker, { t, cwd, box: pickerBox, onPick: pickProto, onClose: () => setPickerOpen(false) }) : null),
			h("button", { type: "button", className: "ce-sk-btn", disabled: protoBusy, onClick: () => void loadProto() }, protoBusy ? t("loading") : t("rpc.load")),
			h("button", {
				type: "button",
				className: "ce-sk-btn ce-sk-btn-ghost",
				disabled: protoBusy || address.trim() === "",
				title: t("rpc.discoverHint"),
				onClick: () => void discoverSchema(),
			}, t("rpc.discover")),
			h("button", {
				type: "button",
				className: `ce-sk-btn ce-sk-btn-ghost${drawerOpen ? " cea-btn-on" : ""}`,
				"data-ce-popup-trigger": "rpc-history",
				"aria-expanded": drawerOpen,
				title: t("api.history"),
				onClick: () => setDrawerOpen((open) => !open),
			}, `${t("api.history")} ${history.length}`),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: !selectedMethod, title: t("api.saveTitle"), onClick: saveFavorite }, t("api.saveBtn")),
		),
		protoError ? h("div", { className: "cedb-error" }, protoError) : null,
		drawerOpen
			? h("div", { className: "cea-hist cerpc-hist", ref: drawerRef, role: "dialog", "aria-label": t("api.history") },
				h("div", { className: "cea-hist-tabs" },
					h("button", { type: "button", className: `cea-tab${drawerTab === "history" ? " cea-tab-on" : ""}`, onClick: () => setDrawerTab("history") }, `${t("api.history")} · ${history.length}`),
					h("button", { type: "button", className: `cea-tab${drawerTab === "saved" ? " cea-tab-on" : ""}`, onClick: () => setDrawerTab("saved") }, `${t("api.saved")} · ${saved.length}`),
					h("span", { className: "ce-spacer" }),
					(drawerTab === "history" ? history : saved).length > 0
						? h("button", { type: "button", className: "ce-link", title: t("api.clear"), onClick: clearEntries }, confirmClear ? t("api.clearConfirm") : t("api.clear"))
						: null,
					h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => { setDrawerOpen(false); setConfirmClear(false); } }, "✕"),
				),
				h("div", { className: "cea-hist-list ce-scroll" },
					(drawerTab === "history" ? history : saved).length === 0
						? h("div", { className: "cea-he" }, t("api.histEmpty"))
						: (drawerTab === "history" ? history : saved).map((entry) => h("div", { key: entry.id, className: "cea-hist-item" },
							h("button", {
								type: "button",
								className: "cea-hist-row",
								title: entryLabel(entry),
								onClick: () => { applyEntry(entry); setDrawerTab("history"); },
							},
							h("span", { className: "cedb-chip" }, entry.status ?? "—"),
							h("span", { className: "cea-hist-url" }, entryLabel(entry)),
							h("span", { className: "cea-hist-ms" }, entry.ms === undefined ? "" : `${entry.ms} ms`)),
							h("button", {
								type: "button",
								className: "ce-tool ce-tiny cea-hist-del",
								title: t("api.delete"),
								"aria-label": t("api.delete"),
								onClick: () => removeEntry(entry),
							}, "✕")))),
			)
			: null,
		methods.length === 0 && !protoBusy
			? h("div", { className: "cerpc-onboard" },
				h("div", { className: "cerpc-onboard-icon", "aria-hidden": "true" },
					h("svg", { viewBox: "0 0 24 24", width: 30, height: 30, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" },
						h("path", { d: "M6 4v6a4 4 0 0 0 4 4h4" }),
						h("path", { d: "M18 4v6a4 4 0 0 1-4 4h-4" }),
						h("circle", { cx: 6, cy: 3, r: 1.6 }),
						h("circle", { cx: 18, cy: 3, r: 1.6 }))),
				h("h3", { className: "cerpc-onboard-title" }, t("rpc.onboardTitle")),
				h("p", { className: "cerpc-onboard-body" }, t("rpc.onboardBody")),
				h("div", { className: "cerpc-onboard-actions" },
					h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: openPicker }, t("rpc.browse")),
					h("button", { type: "button", className: "ce-sk-btn", disabled: address.trim() === "" || protoBusy, title: t("rpc.discoverHint"), onClick: () => void discoverSchema() }, t("rpc.discover"))),
				recentProtos.length === 0
					? null
					: h("div", { className: "cerpc-onboard-recent" },
						h("div", { className: "cerpc-onboard-recent-title" }, t("rpc.recentProtos")),
						recentProtos.map((path) => h("button", {
							key: path,
							type: "button",
							className: "cerpc-onboard-recent-row",
							title: path,
							onClick: () => pickProto(path),
						}, splitProtoPath(path).dir, h("span", { className: "cerpc-picker-name" }, splitProtoPath(path).name)))))
			: h("div", { className: "cerpc-body" },
			// ---- method rail ------------------------------------------------------------
			h("aside", { className: "cerpc-rail" },
				methods.length === 0
					? h("div", { className: "cedb-empty" }, t("rpc.noMethods"))
					: groups.map((group) => h("div", { key: group.service, className: "cerpc-service" },
						h("div", { className: "cerpc-service-name", title: group.service }, group.service.split(".").pop()),
						group.methods.map((method) => h("button", {
							key: method.path,
							type: "button",
							className: `cerpc-method${method.path === selected ? " cerpc-method-on" : ""}`,
							title: `${method.request} → ${method.response}`,
							onClick: () => chooseMethod(method),
						},
						h("span", { className: "cerpc-arrow" }, methodArrows(method)),
						h("span", { className: "cerpc-method-name" }, method.name))),
					)),
				protoFiles.length > 0
					? h("div", { className: "cerpc-files" }, protoFiles.map((file) => h("div", { key: file, className: "cerpc-file" }, file)))
					: null,
			),
			// ---- request / response -----------------------------------------------------
			h("section", { className: "cerpc-main" },
				h("div", { className: "cerpc-pane" },
					h("div", { className: "cerpc-pane-head" },
						h("span", { className: "cerpc-pane-title" }, t("rpc.request")),
						selectedMethod ? h("span", { className: "cedb-chip" }, selectedMethod.request) : null,
						h("span", { className: "ce-spacer" }),
						h("label", { className: "cerpc-inline" },
							h("input", { type: "checkbox", checked: insecureTls, onChange: (event) => setInsecureTls(event.target.checked) }),
							t("rpc.insecureTls")),
						h("input", {
							className: "ce-input cerpc-timeout",
							type: "number",
							value: timeoutMs,
							"aria-label": t("rpc.timeout"),
							onChange: (event) => setTimeoutMs(Number(event.target.value) || 30000),
						}),
						h("span", { className: "cedb-kbd" }, "ms"),
					),
					h("textarea", {
						className: `cedb-sql cerpc-json${request.error ? " cerpc-json-bad" : ""}`,
						ref: requestRef,
						rows: 6,
						value: requestText,
						spellCheck: false,
						onChange: (event) => setRequestText(event.target.value),
					}),
					request.error ? h("div", { className: "cerpc-json-error" }, request.error) : null,
					h("div", { className: "cerpc-meta-head" },
						h("span", { className: "cerpc-pane-title" }, t("rpc.metadata")),
						h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setMetadata((current) => [...current, { name: "", value: "", enabled: true }]) }, "＋"),
					),
					metadata.length === 0
						? h("div", { className: "cerpc-meta-empty" }, t("rpc.noMetadata"))
						: h("div", { className: "cerpc-meta-list" }, metadata.map((row, index) => h("div", { key: index, className: "cerpc-meta-row" },
							h("input", { type: "checkbox", checked: row.enabled !== false, onChange: (event) => setMetadata((cur) => cur.map((entry, i) => (i === index ? { ...entry, enabled: event.target.checked } : entry))) }),
							h("input", { className: "ce-input cerpc-meta-name", value: row.name, placeholder: "authorization", spellCheck: false, onChange: (event) => setMetadata((cur) => cur.map((entry, i) => (i === index ? { ...entry, name: event.target.value } : entry))) }),
							h("input", { className: "ce-input cerpc-meta-value", value: row.value, placeholder: "Bearer …", spellCheck: false, onChange: (event) => setMetadata((cur) => cur.map((entry, i) => (i === index ? { ...entry, value: event.target.value } : entry))) }),
							h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setMetadata((cur) => cur.filter((_, i) => i !== index)) }, "✕"),
						))),
					h("div", { className: "cerpc-actions" },
						h("button", {
							type: "button",
							className: "ce-sk-btn ce-sk-primary",
							disabled: busy || !selectedMethod || Boolean(request.error),
							onClick: () => void invoke(),
						}, busy ? t("loading") : `▶ ${t("rpc.invoke")}`),
						h("span", { className: "cedb-kbd" }, "⌘/Ctrl+Enter"),
					),
				),
				// ---- response ---------------------------------------------------------
				h("div", { className: "cerpc-pane cerpc-response" },
					h("div", { className: "cerpc-pane-head" },
						h("span", { className: "cerpc-pane-title" }, t("rpc.response")),
						response && !response.error
							? h(Fragment, null,
								h("span", { className: `cedb-chip${okStatus ? "" : " cedb-chip-warn"}` }, `${response.status} ${response.statusName}`),
								response.message ? h("span", { className: "cerpc-status-msg" }, response.message) : null,
								h("span", { className: "cedb-chip" }, `${response.ms} ms`),
								h("span", { className: "cedb-chip" }, `${response.messages?.length ?? 0} ${t("rpc.messages")}`),
								response.truncated ? h("span", { className: "cedb-chip cedb-chip-warn" }, t("db.truncated")) : null)
							: null,
					),
					response?.error
						? h("div", { className: "cedb-error" }, response.error)
						: response
							? h("div", { className: "cerpc-result" },
								(response.messages ?? []).map((message, index) => h("div", { key: index, className: "cerpc-message" },
									h("div", { className: "cerpc-message-head" }, `#${index + 1}`),
									h("pre", { className: "cerpc-message-body" }, JSON.stringify(message, null, 2)))),
								(response.messages ?? []).length === 0
									? h("div", { className: "cerpc-resp-empty" },
										h("span", { className: "cerpc-resp-empty-icon", "aria-hidden": "true" }, "◌"),
										h("span", null, t("rpc.emptyResponse")))
									: null,
								Object.keys(response.trailers ?? {}).length > 0
									? h("div", { className: "cerpc-trailers" },
										h("div", { className: "cerpc-pane-title" }, t("rpc.trailers")),
										Object.entries(response.trailers).map(([name, value]) => h("div", { key: name, className: "cerpc-trailer" },
											h("span", { className: "cerpc-trailer-name" }, name),
											h("span", { className: "cerpc-trailer-value" }, value))))
									: null,
							)
							: h("div", { className: "cedb-placeholder" },
								h("div", { className: "cedb-placeholder-title" }, t("rpc.welcome")),
								h("div", { className: "cedb-placeholder-hint" }, t("rpc.welcomeHint"))),
				),
			),
		),
	);
}

/**
 * Title chip for the legacy gRPC page.
 *
 * A title slot that renders nothing leaves an empty tab, which is what a layout
 * saved before the merge showed; the page is folded into the workbench on open,
 * and until then it carries its own label.
 *
 * @param props - the slot's tab reader.
 * @returns the chip.
 */
export function RpcTitle({ useTabInfo }) {
	const info = useTabInfo ? useTabInfo() : null;
	const title = info?.tab?.title;
	const label = typeof title === "string" && title !== "" ? title : "gRPC";
	return h("span", { className: "cerpc-title" }, `>_ ${label}`);
}