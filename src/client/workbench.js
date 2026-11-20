/* ---------------- request workbench: one tab, two protocols ----------------
 *
 * HTTP and gRPC are the same job — "send something to a service and read what
 * comes back" — so they share one tab instead of two entries in the navigation.
 * The switch lives in a slim bar above both panes:
 *
 *   [ Request Workbench ]  [ HTTP | gRPC ]                       <protocol hint>
 *
 * Both panes stay mounted after their first visit, so switching protocols never
 * discards a draft, a response or a scrolled log; the inactive pane is hidden
 * rather than unmounted. gRPC mounts lazily because it parses a `.proto` and a
 * person who is only debugging HTTP should not pay for that.
 *
 * The chosen protocol is remembered across sessions (one small preference, not
 * per-tab state): someone who works in gRPC all day should not re-pick it every
 * time they open the workbench.
 */

import { h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { apiKey } from "./apistore.js";
import { useDismissLayer } from "./dismiss.js";
import { clearHistoryEntries, entryLabel, entryProtocol, filterByProtocol, mergeProtocols, removeHistoryEntry } from "./apientries.js";

/** Preference key for the last protocol used. */
export const PROTOCOL_KEY = "dsh.plugin-kit.workbench.protocol";

/** Protocols the workbench can show, in bar order. */
export const PROTOCOLS = ["http", "grpc"];

/**
 * Read the remembered protocol.
 * @param storage - a Web Storage-like area.
 * @returns a known protocol, defaulting to HTTP.
 */
export function readProtocol(storage = globalThis.localStorage) {
	try {
		const value = storage?.getItem(PROTOCOL_KEY);
		return PROTOCOLS.includes(value) ? value : "http";
	} catch {
		return "http";
	}
}

/**
 * Remember the protocol.
 * @param protocol - the chosen protocol.
 * @param storage - a Web Storage-like area.
 * @returns whether the value was stored.
 */
export function writeProtocol(protocol, storage = globalThis.localStorage) {
	if (!PROTOCOLS.includes(protocol)) return false;
	try {
		storage?.setItem(PROTOCOL_KEY, protocol);
		return true;
	} catch {
		return false;
	}
}

/**
 * Give a pane element the pending hand-off without losing its other props.
 * @param pane - the pane element supplied by the plugin descriptor.
 * @param incoming - the row to load, or null.
 * @returns the element, or null.
 */
function clonePane(pane, incoming) {
	if (!pane || typeof pane !== "object") return null;
	return { ...pane, props: { ...pane.props, incoming } };
}

/**
 * The merged workbench surface.
 *
 * @param props - locale translator, the two panes as elements, and an optional
 *   initial protocol (tests).
 * @returns the bar and both panes.
 */
export function WorkbenchView({ t, http, grpc, initialProtocol, sessionId, useSessions }) {
	const cwd = useSessions ? useSessions((sessions) => (sessionId ? sessions.byId[sessionId]?.cwd : undefined)) : undefined;
	const [protocol, setProtocol] = useState(() => (PROTOCOLS.includes(initialProtocol) ? initialProtocol : readProtocol()));
	// A pane mounts on first visit and stays mounted: state survives the switch.
	const seen = useRef({ http: protocol === "http", grpc: protocol === "grpc" });
	seen.current[protocol] = true;
	const choose = (next) => {
		if (next === protocol) return;
		setProtocol(next);
		writeProtocol(next);
	};

	// One history for both protocols. The panes keep writing it; this only reads,
	// so a call made in one pane shows up in the other's list immediately.
	const historyKey = useMemo(() => apiKey("history", cwd ?? ""), [cwd]);
	const [history, setHistory] = useState([]);
	// Re-reading on a timer must not re-render for an unchanged list, or the open
	// drawer would flicker every few seconds.
	const lastHistory = useRef("");
	const readHistory = useCallback(() => {
		let rows;
		try {
			const raw = JSON.parse(localStorage.getItem(historyKey) ?? "null");
			rows = mergeProtocols(filterByProtocol(raw, "http"), filterByProtocol(raw, "grpc"));
		} catch {
			rows = [];
		}
		const fingerprint = rows.map((row) => row?.id).join("|");
		if (fingerprint === lastHistory.current) return;
		lastHistory.current = fingerprint;
		setHistory(rows);
	}, [historyKey]);
	useEffect(() => {
		readHistory();
		// Coming back to the tab is the moment another pane (or another window)
		// could have added a row; polling is not needed, a re-read is.
		const timer = setInterval(readHistory, 4000);
		return () => clearInterval(timer);
	}, [readHistory]);

	const [drawerOpen, setDrawerOpen] = useState(false);
	// Clearing everything is a two-step action: the first click arms it.
	const [confirmClear, setConfirmClear] = useState(false);
	// The drawer is a transient layer like every other popup in the plugin:
	// clicking outside it (or Escape) closes it.
	const drawerRef = useDismissLayer({ open: drawerOpen, onDismiss: () => setDrawerOpen(false), ignoreSelector: '[data-ce-popup-trigger="workbench-history"]' });
	const [incoming, setIncoming] = useState(null);
	/** Hand one row to the pane that owns its protocol, then show that pane. */
	const openEntry = (entry) => {
		const target = entryProtocol(entry);
		choose(target);
		setIncoming({ protocol: target, entry, nonce: Date.now() + Math.random() });
		setDrawerOpen(false);
	};
	/** Drop one row from the shared store, then re-read it. */
	const removeEntry = (entry) => {
		removeHistoryEntry(historyKey, entry.id);
		lastHistory.current = "";
		readHistory();
	};
	/** Clear the shared history (both protocols live in one key). */
	const clearAll = () => {
		if (!confirmClear) { setConfirmClear(true); return; }
		clearHistoryEntries(historyKey);
		lastHistory.current = "";
		readHistory();
		setConfirmClear(false);
	};

	return h(
		"div",
		{ className: "ce-wb" },
		h(
			"div",
			{ className: "ce-wb-bar" },
			h(
				"div",
				{ className: "ce-wb-seg", role: "tablist", "aria-label": t("workbench.title") },
				PROTOCOLS.map((id) => h("button", {
					key: id,
					type: "button",
					role: "tab",
					"aria-selected": protocol === id,
					className: `ce-wb-btn${protocol === id ? " ce-wb-on" : ""}`,
					title: t(`workbench.${id}Hint`),
					onClick: () => choose(id),
				}, t(`workbench.${id}`))),
			),
			h("span", { className: "ce-spacer" }),
			h("span", { className: "ce-wb-hint" }, t(protocol === "http" ? "workbench.httpHint" : "workbench.grpcHint")),
			h("button", {
				type: "button",
				className: `ce-wb-hist${drawerOpen ? " ce-wb-on" : ""}`,
				"data-ce-popup-trigger": "workbench-history",
				"aria-expanded": drawerOpen,
				title: t("workbench.historyHint"),
				onClick: () => { readHistory(); setDrawerOpen((open) => !open); },
			}, `${t("workbench.history")} ${history.length}`),
		),
		drawerOpen
			? h("div", { className: "ce-wb-drawer", ref: drawerRef, role: "dialog", "aria-label": t("workbench.history") },
				h("div", { className: "ce-wb-drawer-head" },
					h("span", null, t("workbench.history")),
					h("span", { className: "ce-wb-drawer-hint" }, t("workbench.historyHint")),
					h("span", { className: "ce-spacer" }),
					history.length > 0
						? h("button", { type: "button", className: "ce-link", title: t("api.clear"), onClick: clearAll }, confirmClear ? t("api.clearConfirm") : t("api.clear"))
						: null,
					h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => { setDrawerOpen(false); setConfirmClear(false); } }, "✕")),
				history.length === 0
					? h("div", { className: "ce-wb-drawer-empty" }, t("api.histEmpty"))
					: h("div", { className: "ce-wb-drawer-list ce-scroll" }, history.map((entry) => h("div", { key: entry.id, className: "ce-wb-drawer-item" },
						h("button", {
							type: "button",
							className: "ce-wb-drawer-row",
							title: entryLabel(entry),
							onClick: () => openEntry(entry),
						},
						h("span", { className: `ce-wb-proto ce-wb-proto-${entryProtocol(entry)}` }, entryProtocol(entry) === "grpc" ? "gRPC" : "HTTP"),
						h("span", { className: "ce-wb-drawer-label" }, entryLabel(entry)),
						h("span", { className: "ce-wb-drawer-ms" }, entry.status === undefined ? "" : String(entry.status))),
						h("button", {
							type: "button",
							className: "ce-tool ce-tiny ce-wb-drawer-del",
							title: t("api.delete"),
							"aria-label": t("api.delete"),
							onClick: () => removeEntry(entry),
						}, "✕")))))
			: null,
		h("div", { className: "ce-wb-pane", hidden: protocol !== "http" }, seen.current.http ? clonePane(http, incoming) : null),
		h("div", { className: "ce-wb-pane", hidden: protocol !== "grpc" }, seen.current.grpc ? clonePane(grpc, incoming) : null),
	);
}
