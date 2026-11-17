/* ---------------- API tester: request editor, environments, auth, response view ----------------
 *
 * UI wiring only: every request-data transformation (URL ↔ params sync,
 * environments, auth folding, send resolution) lives in reqmodel.js, the curl
 * wire format in curl.js and the snippet generators in codegen.js, so each
 * half stays testable on its own. Interaction model references:
 * - Bruno: named environments with an active selector and "No Environment",
 *   a dedicated Auth section, URL/Params two-way sync, response Timeline and
 *   "Generate Code" snippets.
 * - Postman: params merged into the URL, {{var}} placeholders resolved at
 *   send time while editors and history keep the template.
 */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { api } from "./api.js";
import { parseCurl, toCurl } from "./curl.js";
import { looksLikeBru, parseBru } from "./brucol.js";
import { detectCollectionImport } from "./openimp.js";
import { foldStream, parseSse, emptySseState, sseEventLabel } from "./sse.js";
import { SNIPPET_KINDS } from "./codegen.js";
import {
	activeEnvOf, addEnv, applyExtracts, applyParamsToUrl, envMapOf, guessRawSubType, normalizeAuth, normalizeEnvStore,
	normalizeUrlParams, pushEntry, relTimeAgo, removeEnv, renameEnv, resolveRequest, selectEnv,
	setEnvVars, syncParamsFromUrl,
} from "./reqmodel.js";
import { RequestFields } from "./requestfields.js";
import { useDismissLayer } from "./dismiss.js";

const DRAFT_KEY = "dsh.ce.api.draft.v1";
const HIST_KEY = "dsh.ce.api.history.v1";
const SAVED_KEY = "dsh.ce.api.saved.v1";
const ENV_KEY = "dsh.ce.api.env.v1";
const HIST_CAP = 30;
const SAVED_CAP = 50;
/** Draft/snapshot format: 2 = URL and params are synced; absent = legacy (merge at load). */
const SNAPSHOT_V = 2;

function statusClass(status) {
	if (status < 300) return "cea-ok";
	if (status < 400) return "cea-info";
	if (status < 500) return "cea-warn";
	return "cea-err";
}

function prettySize(n) {
	if (n < 1024) return `${n}B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
	return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function loadJson(key) {
	try {
		return JSON.parse(localStorage.getItem(key) ?? "null");
	} catch {
		return null;
	}
}

function loadList(key) {
	const value = loadJson(key);
	return Array.isArray(value) ? value : [];
}

function storeJson(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch { /* storage unavailable */ }
}

/** Editor state → the snapshot stored in drafts, history rows and favorites. */
function requestSnapshot(state) {
	return { v: SNAPSHOT_V, ...state };
}

/**
 * Apply a persisted snapshot to the editor. v2 snapshots keep URL and params
 * as saved (the sync invariant already holds); legacy snapshots get the old
 * send-time merge and the table is re-projected from the result.
 */
function restoredUrlParams(req) {
	if (req?.v === SNAPSHOT_V) {
		return { url: typeof req.url === "string" ? req.url : "", pairs: Array.isArray(req.paramPairs) ? req.paramPairs : [] };
	}
	return normalizeUrlParams(req?.url ?? "", req?.paramPairs);
}

export function ApiView({ t, useTabInfo }) {
	const hostTab = useTabInfo ? useTabInfo()?.tab : null;
	const [method, setMethod] = useState("GET");
	const [url, setUrl] = useState("");
	const [headers, setHeaders] = useState([]);
	const [bodyType, setBodyType] = useState("none");
	const [rawSub, setRawSub] = useState("json");
	const [formPairs, setFormPairs] = useState([]);
	const [beautifyErr, setBeautifyErr] = useState("");
	const [body, setBody] = useState("");
	const [auth, setAuth] = useState(() => normalizeAuth(null));
	const [sending, setSending] = useState(false);
	const [response, setResponse] = useState(null);
	const [respTab, setRespTab] = useState("body"); // body | headers | timeline
	const [importOpen, setImportOpen] = useState(false);
	const [importText, setImportText] = useState("");
	const [importError, setImportError] = useState("");
	const [histOpen, setHistOpen] = useState(false);
	const [histTab, setHistTab] = useState("history"); // history | saved
	const [history, setHistory] = useState([]);
	const [saved, setSaved] = useState([]);
	const [saveOpen, setSaveOpen] = useState(false);
	const [saveName, setSaveName] = useState("");
	const [codeMenuOpen, setCodeMenuOpen] = useState(false);
	const [copiedCode, setCopiedCode] = useState("");
	const [envStore, setEnvStore] = useState(() => normalizeEnvStore(loadJson(ENV_KEY)));
	const [envNameDraft, setEnvNameDraft] = useState(null); // {id, name} while renaming
	const [envDeleteArmed, setEnvDeleteArmed] = useState(false);
	const importRef = useDismissLayer({ open: importOpen, onDismiss: () => setImportOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-import"]' });
	const saveRef = useDismissLayer({ open: saveOpen, onDismiss: () => setSaveOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-save"]' });
	const historyRef = useDismissLayer({ open: histOpen, onDismiss: () => setHistOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-history"]' });
	const codeMenuRef = useDismissLayer({ open: codeMenuOpen, onDismiss: () => setCodeMenuOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-code"]' });
	useEffect(() => {
		if (hostTab?.visible === false) { setImportOpen(false); setSaveOpen(false); setHistOpen(false); setCodeMenuOpen(false); }
	}, [hostTab?.visible]);
	const [copied, setCopied] = useState(false);
	const [paramPairs, setParamPairs] = useState([]);
	const [requestTab, setRequestTab] = useState("params");
	const [responseCopied, setResponseCopied] = useState(false);
	const [timeoutMs, setTimeoutMs] = useState(30000);
	const [extracts, setExtracts] = useState([]); // [{name, source, expr, enabled}]
	const [extractNote, setExtractNote] = useState("");
	const [stream, setStream] = useState(null); // {id,status,headers,state:{raw,sse,events,seq,...}}
	const streamRef = useRef(null);
	streamRef.current = stream;
	const [requestShare, setRequestShare] = useState(42);
	const workspaceRef = useRef(null);
	const splitDrag = useRef(null);
	const copiedTimer = useRef(null);
	const setSplit = (value) => setRequestShare(Math.max(24, Math.min(72, value)));
	const splitPointer = (event) => {
		const rect = workspaceRef.current?.getBoundingClientRect();
		if (!rect || rect.height <= 0) return;
		setSplit((event.clientY - rect.top) / rect.height * 100);
	};

	useEffect(() => {
		storeJson(ENV_KEY, envStore);
	}, [envStore]);
	useEffect(() => {
		setHistory(loadList(HIST_KEY));
		setSaved(loadList(SAVED_KEY));
	}, []);
	useEffect(() => {
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (raw === null) return;
			const d = JSON.parse(raw);
			if (typeof d.method === "string") setMethod(d.method);
			const restored = restoredUrlParams(d);
			setUrl(restored.url);
			setParamPairs(restored.pairs);
			if (Array.isArray(d.headers)) setHeaders(d.headers);
			if (typeof d.bodyType === "string") { setBodyType(d.bodyType); if (d.bodyType !== "none") setRequestTab("body"); }
			if (typeof d.rawSub === "string") setRawSub(d.rawSub);
			if (Array.isArray(d.formPairs)) setFormPairs(d.formPairs);
			if (typeof d.body === "string") setBody(d.body);
			if (d.auth) setAuth(normalizeAuth(d.auth));
			if (Number.isFinite(d.timeoutMs) && d.timeoutMs >= 1000) setTimeoutMs(Math.min(120000, d.timeoutMs));
			if (Array.isArray(d.extracts)) setExtracts(d.extracts);
		} catch { /* corrupt draft: start clean */ }
	}, []);
	useEffect(() => {
		storeJson(DRAFT_KEY, requestSnapshot({ method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs, auth, extracts }));
	}, [method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs, auth, extracts]);
	useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);

	const beautify = useCallback(() => {
		try {
			setBody(JSON.stringify(JSON.parse(body), null, 2));
			setBeautifyErr("");
		} catch {
			setBeautifyErr(t("api.beautifyErr"));
		}
	}, [body, t]);

	/** The full editor state — one shape feeds snapshots and resolveRequest. */
	const editorState = useCallback(
		() => ({ method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs, auth, extracts }),
		[method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs, auth, extracts],
	);
	const snapshot = useCallback(() => requestSnapshot(editorState()), [editorState]);

	const restoreRequest = useCallback((req) => {
		if (!req || typeof req !== "object") return;
		if (typeof req.method === "string") setMethod(req.method);
		const restored = restoredUrlParams(req);
		setUrl(restored.url);
		setParamPairs(restored.pairs);
		if (Array.isArray(req.headers)) setHeaders(req.headers);
		if (typeof req.bodyType === "string") { setBodyType(req.bodyType); setRequestTab(req.bodyType === "none" ? "params" : "body"); }
		if (typeof req.rawSub === "string") setRawSub(req.rawSub);
		if (Array.isArray(req.formPairs)) setFormPairs(req.formPairs);
		if (typeof req.body === "string") setBody(req.body);
		setAuth(normalizeAuth(req.auth));
		if (Array.isArray(req.extracts)) setExtracts(req.extracts); else setExtracts([]);
		if (Number.isFinite(req.timeoutMs) && req.timeoutMs >= 1000) setTimeoutMs(Math.min(120000, req.timeoutMs));
		setResponse(null);
		setHistOpen(false);
	}, []);

	const send = useCallback(() => {
		if (url.trim() === "" || sending) return;
		// One resolution for wire, timeline and history: {{var}} placeholders
		// resolve from the active environment here; editors keep the template.
		const resolved = resolveRequest(editorState(), envMapOf(envStore));
		const sentSnapshot = snapshot();
		setSending(true);
		setResponseCopied(false);
		api("api.send", resolved).then((res) => {
			setSending(false);
			const value = res.ok ? res.value : { error: res.error };
			if (value?.streaming) {
				// SSE response: hand the panel a live stream view instead of
				// a finished body; extracts/history still record what arrives.
				setResponse({ ...value, sent: resolved, text: "" });
				setRespTab("stream");
				streamEpoch.current += 1;
				setStream({
					id: value.id,
					pollEpoch: streamEpoch.current,
					status: value.status,
					headers: value.headers ?? [],
					state: foldStream({ raw: "", events: [], seq: 0, baseSeq: 0, done: false, error: "", dropped: false, sse: emptySseState() }, { chunks: value.chunks ?? [], seq: value.seq ?? 0, baseSeq: value.baseSeq ?? 0, done: value.done === true, error: value.error ?? "", dropped: false, reset: false }),
				});
			} else {
				if (streamRef.current) { void api("api.streamStop", { id: streamRef.current.id }); streamEpoch.current += 1; setStream(null); }
				setResponse({ ...value, sent: resolved });
				if (value?.error) setRespTab("body");
			}
			// Every settled send lands in the history (newest first, capped),
			// carrying the full request so one click restores it.
			const entry = {
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				ts: Date.now(),
				method: resolved.method,
				url: resolved.url,
				status: value?.status,
				ms: value?.ms,
				error: value?.error ?? void 0,
				request: sentSnapshot,
			};
			setHistory((prev) => {
				const next = pushEntry(prev, entry, HIST_CAP);
				storeJson(HIST_KEY, next);
				return next;
			});
			// Post-response extracts: write hits into the ACTIVE environment
			// (misses only get reported, never half-written as empty vars).
			const { store: nextStore, applied, missed } = applyExtracts(extracts, value, resolved, envStore);
			if (applied.length > 0) setEnvStore(nextStore);
			if (applied.length + missed.length > 0) {
				setExtractNote(applied.length > 0
					? `${applied.map((a) => a.name).join(", ")}${missed.length > 0 ? ` · ${missed.map((m) => m).join(", ")} ${t("api.extractMissed")}` : ""}`
					: t("api.extractAllMissed"));
			} else {
				setExtractNote("");
			}
		});
	}, [url, sending, editorState, snapshot, envStore, extracts, t]);

	// Drain a live SSE capture with the same long-poll cursor protocol used
	// by watch/tasks; a newer start (pollEpoch) makes older answers no-ops.
	const streamEpoch = useRef(0);
	useEffect(() => {
		if (!stream || stream.state.done) return undefined;
		const id = stream.id;
		const epoch = stream.pollEpoch;
		let stop = false;
		let cursor = stream.state.seq;
		const pump = async () => {
			while (!stop && cursor >= 0) {
				const res = await api("api.streamPoll", { id, since: cursor, waitMs: 18000 });
				if (stop || epoch !== streamEpoch.current) break;
				if (!res.ok || res.value?.error) break;
				const snap = res.value;
				cursor = snap.done ? -1 : snap.seq;
				setStream((prev) => (prev === null || prev.id !== id || prev.pollEpoch !== epoch ? prev : { ...prev, state: foldStream(prev.state, snap) }));
			}
		};
		void pump();
		return () => { stop = true; };
	}, [stream?.id, stream?.pollEpoch, stream?.state.done]);

	const flashCopied = useCallback(() => {
		setCopied(true);
		if (copiedTimer.current) clearTimeout(copiedTimer.current);
		copiedTimer.current = setTimeout(() => setCopied(false), 1500);
	}, []);

	const copyText = useCallback((text) => {
		try {
			const p = navigator.clipboard?.writeText(text);
			return p && typeof p.then === "function" ? p : Promise.resolve();
		} catch {
			return Promise.resolve();
		}
	}, []);

	const copyCurl = useCallback(() => {
		// The toolbar button exports the editor template ({{var}} unresolved),
		// matching what the request editor shows.
		copyText(toCurl(editorState())).then(flashCopied);
	}, [copyText, editorState, flashCopied]);

	const copySnippet = useCallback((kind) => {
		// Snippets are generated from the *resolved* request, so the copied
		// code runs as-is — the same record the Timeline shows (Bruno codegen).
		const text = kind.build(resolveRequest(editorState(), envMapOf(envStore)), editorState());
		copyText(text).then(() => {
			setCopiedCode(kind.id);
			if (copiedTimer.current) clearTimeout(copiedTimer.current);
			copiedTimer.current = setTimeout(() => setCopiedCode(""), 1500);
		});
	}, [copyText, editorState, envStore]);

	const doImport = useCallback(() => {
		// Collection documents (OpenAPI / Postman) import as a SET: every
		// operation becomes a favorite and the first one lands in the editor.
		let collection = null;
		try {
			collection = detectCollectionImport(importText);
		} catch {
			collection = null;
		}
		if (collection) {
			if (collection.error || collection.requests.length === 0) {
				setImportError(`${t("api.importFailed")}: ${collection.error ?? t("api.importEmpty")}`);
				return;
			}
			const entries = collection.requests.map((req, i) => ({
				id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
				name: req.name,
				ts: Date.now(),
				request: requestSnapshot({ method: req.method, url: req.url, headers: req.headers, bodyType: req.bodyType, rawSub: req.rawSub, formPairs: [], body: req.body, paramPairs: req.paramPairs, timeoutMs: 30000, auth: normalizeAuth(null), extracts: [] }),
			}));
			setSaved((prev) => {
				const names = new Set(entries.map((e) => e.name));
				const next = [...entries, ...prev.filter((e) => e && !names.has(e.name))].slice(0, SAVED_CAP);
				storeJson(SAVED_KEY, next);
				return next;
			});
			const first = collection.requests[0];
			setMethod(first.method);
			setUrl(first.url);
			setParamPairs(syncParamsFromUrl(first.url, first.paramPairs));
			setHeaders(first.headers);
			setBody(first.body);
			setBodyType(first.bodyType);
			setRawSub(first.rawSub);
			setImportText("");
			setImportOpen(false);
			setHistTab("saved");
			setHistOpen(true);
			return;
		}
		// The import dialog accepts curl commands and Bruno .bru documents;
		// .bru carries its own param rows (disabled + path included), curl
		// projects the URL query into the table.
		const isBru = looksLikeBru(importText);
		const bru = isBru ? parseBru(importText) : null;
		const p = isBru
			? {
				method: bru.method,
				url: bru.url,
				headers: bru.headers,
				auth: bru.auth,
				body: bru.bodyType === "raw" ? bru.body : "",
				multipart: bru.bodyType === "multipart" ? bru.formPairs : null,
				form: bru.bodyType === "form" ? bru.formPairs : null,
			}
			: parseCurl(importText);
		const seedPairs = isBru ? bru.paramPairs : [];
		const syncedUrl = isBru ? applyParamsToUrl(p.url, seedPairs) : p.url;
		setMethod(p.method);
		setUrl(syncedUrl);
		setParamPairs(syncParamsFromUrl(syncedUrl, seedPairs));
		setHeaders(p.headers);
		setAuth(normalizeAuth(p.auth));
		setResponse(null);
		if (p.multipart) {
			setFormPairs(p.multipart);
			setBodyType("multipart");
			setRequestTab("body");
		} else if (p.form) {
			setFormPairs(p.form);
			setBodyType("form");
			setRequestTab("body");
		} else if (p.body !== "") {
			setBody(p.body);
			setRawSub(isBru ? bru.rawSub : guessRawSubType(p.headers, p.body));
			setBodyType("raw");
			setRequestTab("body");
		} else {
			setFormPairs([]);
			setBody(p.body ?? "");
			setBodyType("none");
			setRequestTab("params");
		}
		setImportText("");
		setImportOpen(false);
	}, [importText, t]);

	const doSaveFavorite = useCallback(() => {
		const name = saveName.trim();
		if (name === "") return;
		const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, ts: Date.now(), request: snapshot() };
		setSaved((prev) => {
			// Same name replaces the old favorite (differing ids).
			const next = [entry, ...prev.filter((e) => e && e.name !== name)].slice(0, SAVED_CAP);
			storeJson(SAVED_KEY, next);
			return next;
		});
		setSaveName("");
		setSaveOpen(false);
		setHistTab("saved");
		setHistOpen(true);
	}, [saveName, snapshot]);

	const removeHistory = useCallback((id) => {
		setHistory((prev) => {
			const next = prev.filter((e) => e && e.id !== id);
			storeJson(HIST_KEY, next);
			return next;
		});
	}, []);
	const removeSaved = useCallback((id) => {
		setSaved((prev) => {
			const next = prev.filter((e) => e && e.id !== id);
			storeJson(SAVED_KEY, next);
			return next;
		});
	}, []);
	const clearHistory = useCallback(() => {
		setHistory([]);
		storeJson(HIST_KEY, []);
	}, []);

	/* environments (Bruno-style named variable sets with an active selector) */
	const activeEnv = activeEnvOf(envStore);
	const envDraftName = envNameDraft && activeEnv && envNameDraft.id === activeEnv.id ? envNameDraft.name : activeEnv?.name ?? "";
	const createEnv = useCallback(() => {
		setEnvStore((store) => addEnv(store));
		setEnvNameDraft(null);
		setEnvDeleteArmed(false);
	}, []);
	const commitEnvName = useCallback(() => {
		const draft = envNameDraft;
		setEnvNameDraft(null);
		if (draft) setEnvStore((store) => renameEnv(store, draft.id, draft.name));
	}, [envNameDraft]);
	const deleteActiveEnv = useCallback(() => {
		if (!envDeleteArmed) {
			setEnvDeleteArmed(true);
			return;
		}
		if (activeEnv) setEnvStore((store) => removeEnv(store, activeEnv.id));
		setEnvDeleteArmed(false);
		setEnvNameDraft(null);
	}, [envDeleteArmed, activeEnv]);

	/* URL ↔ params two-way sync: each direction runs only in its own input
	 * handler (never in an effect), so the URL bar and the params table are two
	 * projections of one query string without ping-ponging. Path rows (`:name`)
	 * never touch the editor URL — they substitute at send time only. */
	const onUrlChange = useCallback((value) => {
		setUrl(value);
		setParamPairs((prev) => syncParamsFromUrl(value, prev));
	}, []);
	const onQueryPairsChange = useCallback((rows) => {
		const paths = paramPairs.filter((p) => p.kind === "path");
		const next = [...rows.map((r) => (r.kind === "path" ? r : { ...r, kind: "query" })), ...paths];
		setParamPairs(next);
		setUrl((prev) => applyParamsToUrl(prev, next));
	}, [paramPairs]);
	const onPathPairsChange = useCallback((rows) => {
		const queries = paramPairs.filter((p) => p.kind !== "path");
		setParamPairs([...queries, ...rows.map((r) => ({ ...r, kind: "path" }))]);
	}, [paramPairs]);

	const respJson = useMemo(() => {
		if (!response || response.error || typeof response.text !== "string") return null;
		const ct = (response.headers ?? []).find((hd) => hd[0].toLowerCase() === "content-type")?.[1] ?? "";
		if (!/json/i.test(ct)) return null;
		try {
			return JSON.stringify(JSON.parse(response.text), null, 2);
		} catch {
			return null;
		}
	}, [response]);

	const activeParamCount = paramPairs.filter((p) => p?.kind !== "path" && p?.enabled !== false && String(p?.name ?? "").trim() !== "").length;
	const pathPairs = paramPairs.filter((p) => p?.kind === "path");
	const activeEnvVarCount = (activeEnv?.vars ?? []).filter((p) => p?.enabled !== false && String(p?.name ?? "").trim() !== "").length;
	const sent = response?.sent;

	return h("div", { className: "ce-root cea-root", onKeyDown: (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !importOpen && !saveOpen && !codeMenuOpen) {
			e.preventDefault(); e.stopPropagation(); send();
		}
	} },
		h("div", { className: "cea-tools" },
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.importTitle"), "data-ce-popup-trigger": "api-import", "aria-expanded": importOpen, onClick: () => { setImportOpen((value) => !value); setHistOpen(false); setSaveOpen(false); setCodeMenuOpen(false); } }, t("api.import")),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.copyCurl"), disabled: url.trim() === "", onClick: copyCurl }, copied ? t("api.copied") : "⧉ curl"),
			h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${codeMenuOpen ? " cea-btn-on" : ""}`, title: t("api.codeTitle"), disabled: url.trim() === "", "data-ce-popup-trigger": "api-code", "aria-expanded": codeMenuOpen, onClick: () => { setCodeMenuOpen((value) => !value); setHistOpen(false); setSaveOpen(false); setImportOpen(false); } }, copiedCode ? t("api.copied") : `</> ${t("api.code")}`),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.saveTitle"), "data-ce-popup-trigger": "api-save", "aria-expanded": saveOpen, onClick: () => { setSaveOpen((value) => !value); setHistOpen(false); setImportOpen(false); setCodeMenuOpen(false); } }, t("api.saveBtn")),
			h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${histOpen ? " cea-btn-on" : ""}`, title: t("api.history"), "data-ce-popup-trigger": "api-history", "aria-expanded": histOpen, onClick: () => { setHistOpen((v) => !v); setSaveOpen(false); setImportOpen(false); setCodeMenuOpen(false); } }, `${t("api.history")}${history.length ? ` ${history.length}` : ""}`),
			h("span", { className: "ce-spacer" }),
			h("select", {
				className: "cea-method cea-env",
				"aria-label": t("api.envSelect"),
				title: t("api.envSelect"),
				value: envStore.activeId ?? "",
				onChange: (e) => { setEnvStore((store) => selectEnv(store, e.target.value || null)); setEnvDeleteArmed(false); },
			},
				h("option", { value: "" }, t("api.envNone")),
				envStore.envs.map((env) => h("option", { key: env.id, value: env.id }, env.name))),
		),
		h("div", { className: "cea-bar" },
			h("select", { className: `cea-method cea-request-method cea-m-${method.toLowerCase()}`, "aria-label": t("api.method"), value: method, onChange: (e) => setMethod(e.target.value) },
				["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => h("option", { key: m, value: m }, m))),
			h("input", {
				className: "ce-input cea-url",
				placeholder: t("api.urlPlaceholder"),
				"aria-label": t("api.urlPlaceholder"),
				value: url,
				onChange: (e) => onUrlChange(e.target.value),
				onKeyDown: (e) => {
					if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); send(); }
				},
			}),
			h("button", { type: "button", className: "ce-sk-btn cea-send", title: t("api.sendShortcut"), disabled: sending || url.trim() === "", onClick: send }, sending ? t("api.sending") : t("api.send")),
		),

		codeMenuOpen
			? h("div", { className: "cea-hist cea-codemenu", ref: codeMenuRef, role: "dialog", "aria-label": t("api.codeTitle") },
				h("div", { className: "cea-hist-tabs" },
					h("span", null, t("api.codeTitle")),
					h("span", { className: "ce-spacer" }),
					h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setCodeMenuOpen(false) }, "✕"),
				),
				h("div", { className: "cea-hist-list ce-scroll" },
					SNIPPET_KINDS.map((kind) => h("button", { key: kind.id, type: "button", className: "cea-hmain cea-code-item", title: t("api.codeItemTitle"), onClick: () => copySnippet(kind) },
						h("span", { className: "cea-code-label" }, kind.label),
						copiedCode === kind.id ? h("span", { className: "cea-ok cea-code-copied" }, "✓") : null,
					))),
			)
			: null,
		histOpen
			? h("div", { className: "cea-hist", ref: historyRef, role: "dialog", "aria-label": t("api.history") },
				h("div", { className: "cea-hist-tabs" },
					h("button", { type: "button", className: `cea-tab${histTab === "history" ? " cea-tab-on" : ""}`, onClick: () => setHistTab("history") }, `${t("api.history")} · ${history.length}`),
					h("button", { type: "button", className: `cea-tab${histTab === "saved" ? " cea-tab-on" : ""}`, onClick: () => setHistTab("saved") }, `${t("api.saved")} · ${saved.length}`),
					h("span", { className: "ce-spacer" }),
					histTab === "history" && history.length > 0
						? h("button", { type: "button", className: "ce-link", title: t("api.clear"), onClick: clearHistory }, t("api.clear"))
						: null,
					h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setHistOpen(false) }, "✕"),
				),
				h("div", { className: "cea-hist-list ce-scroll" },
					histTab === "history"
						? (history.length === 0
							? h("div", { className: "ce-note" }, t("api.histEmpty"))
							: history.map((e) => h("div", { key: e.id, className: "cea-hrow2" },
								h("button", { type: "button", className: "cea-hmain", title: t("api.restoreTitle"), onClick: () => restoreRequest(e.request) },
									h("span", { className: `cea-mbadge cea-m-${String(e.method ?? "get").toLowerCase()}` }, e.method),
									h("span", { className: "cea-hurl" }, e.url),
									e.error
										? h("span", { className: "cea-hstatus cea-err" }, "✕")
										: h("span", { className: `cea-hstatus ${statusClass(e.status ?? 0)}` }, String(e.status ?? "")),
									h("span", { className: "cea-hts" }, `${relTimeAgo(e.ts)}${e.ms != null ? ` · ${e.ms}ms` : ""}`),
								),
								h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.delete"), onClick: () => removeHistory(e.id) }, "✕"),
							)))
						: (saved.length === 0
							? h("div", { className: "ce-note" }, t("api.savedEmpty"))
							: saved.map((e) => h("div", { key: e.id, className: "cea-hrow2" },
								h("button", { type: "button", className: "cea-hmain", title: t("api.restoreTitle"), onClick: () => restoreRequest(e.request) },
									h("span", { className: "cea-hname" }, `★ ${e.name}`),
									h("span", { className: `cea-mbadge cea-m-${String(e.request?.method ?? "get").toLowerCase()}` }, e.request?.method),
									h("span", { className: "cea-hurl" }, e.request?.url ?? ""),
								),
								h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.delete"), onClick: () => removeSaved(e.id) }, "✕"),
							))),
				),
			)
			: null,
		h("div", { className: "cea-scroll cea-workspace", ref: workspaceRef, style: { gridTemplateRows: `minmax(0, ${requestShare}fr) 10px minmax(0, ${100 - requestShare}fr)` } },
			h("section", { className: "cea-request", "aria-label": t("api.requestConfig") },
			h("div", { className: "cea-request-tabs", role: "group", "aria-label": t("api.requestConfig") },
				[ ["params", t("api.params"), activeParamCount], ["headers", t("api.headers"), headers.filter((p) => p.enabled !== false && p.name?.trim()).length], ["body", t("api.body"), bodyType === "none" ? 0 : 1], ["auth", t("api.auth"), auth.mode === "none" ? 0 : 1], ["variables", t("api.environment"), activeEnvVarCount], ["extracts", t("api.extracts"), extracts.filter((r) => r && r.enabled !== false && String(r.name ?? "").trim() !== "" && String(r.expr ?? "").trim() !== "").length], ["settings", t("api.settings"), 0] ].map(([id, label, count]) =>
					h("button", { type: "button", key: id, className: `cea-config-tab${requestTab === id ? " cea-config-tab-on" : ""}`, "aria-pressed": requestTab === id, onClick: () => { setRequestTab(id); setEnvDeleteArmed(false); } }, label, count ? h("span", { className: "cea-tab-count" }, count) : null)),
			),
			h("div", { className: "cea-request-panel" },
			requestTab === "settings" ? h("div", { className: "cea-settings" }, h("label", { className: "cea-tmo" }, t("api.timeout"),
					h("input", {
						className: "ce-input cea-tmo-in",
						type: "number",
						min: 1000,
						max: 120000,
						step: 1000,
						value: timeoutMs,
						onChange: (e) => setTimeoutMs(Math.max(1000, Math.min(120000, Number(e.target.value) || 30000))),
					}),
				)) : null,
			requestTab === "params" ? h(Fragment, null,
				h(RequestFields, { t, label: t("api.params"), rows: paramPairs.filter((p) => p?.kind !== "path"), onChange: onQueryPairsChange, hint: t("api.paramsHint") }),
				pathPairs.length > 0
					? h(RequestFields, { t, label: t("api.pathParams"), rows: pathPairs, onChange: onPathPairsChange, hint: t("api.pathParamsHint") })
					: null,
			) : null,
			requestTab === "headers" ? h(RequestFields, { t, label: t("api.headers"), rows: headers, onChange: setHeaders }) : null,
			requestTab === "variables" ? h(Fragment, null,
				h("div", { className: "cea-envbar" },
					h("input", {
						className: "ce-input cea-env-name",
						"aria-label": t("api.envName"),
						placeholder: t("api.envName"),
						value: envDraftName,
						disabled: !activeEnv,
						spellCheck: false,
						onChange: (e) => activeEnv && setEnvNameDraft({ id: activeEnv.id, name: e.target.value }),
						onBlur: commitEnvName,
						onKeyDown: (e) => {
							e.stopPropagation();
							if (e.key === "Enter") { commitEnvName(); e.currentTarget?.blur?.(); }
						},
					}),
					h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.envNewTitle"), onClick: createEnv }, `＋ ${t("api.envNew")}`),
					activeEnv
						? h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${envDeleteArmed ? " cea-danger" : ""}`, title: t("api.envDelete"), onClick: deleteActiveEnv }, envDeleteArmed ? t("api.envDeleteConfirm") : t("api.envDelete"))
						: null,
				),
				activeEnv
					? h(RequestFields, { t, label: t("api.environment"), rows: activeEnv.vars, onChange: (rows) => setEnvStore((store) => setEnvVars(store, activeEnv.id, rows)), hint: t("api.envTitle") })
					: h("div", { className: "cea-empty" }, h("span", null, t("api.envNoActive"))),
			) : null,
			requestTab === "extracts" ? h(Fragment, null,
				h("div", { className: "cea-fields-footer" }, h("span", null, t("api.extractHint"))),
				activeEnv === null ? h("div", { className: "cea-fields-footer" }, h("span", { className: "cea-warn" }, t("api.extractNoEnv"))) : null,
				h("div", { className: "cea-fields" },
					h("div", { className: "cea-fields-scroll" },
						h("table", { className: "cea-fields-table", "aria-label": t("api.extracts") },
							h("colgroup", null, h("col", { className: "cea-fields-check" }), h("col", { className: "cea-fields-name" }), h("col", { className: "cea-fields-value" }), h("col", { className: "cea-fields-description" }), h("col", { className: "cea-fields-action" })),
							h("thead", null,
								h("tr", null,
									h("th", { scope: "col" }, h("span", { className: "cea-sr-only" }, t("api.fieldEnabled"))),
									h("th", { scope: "col" }, t("api.extractName")),
									h("th", { scope: "col" }, t("api.extractSource")),
									h("th", { scope: "col" }, t("api.extractExpr")),
									h("th", { scope: "col" }, h("span", { className: "cea-sr-only" }, t("api.delete"))),
								),
							),
							h("tbody", null,
								extracts.map((rule, index) => h("tr", { key: index, className: rule.enabled === false ? "cea-field-disabled" : undefined },
									h("td", null, h("input", { type: "checkbox", checked: rule.enabled !== false, "aria-label": `${t("api.extracts")} · ${t("api.fieldEnabled")} ${index + 1}`, onChange: (e) => setExtracts((prev) => prev.map((r, j) => (j === index ? { ...r, enabled: e.target.checked } : r))) })),
									h("td", null, h("input", { className: "cea-field-input", type: "text", spellCheck: false, autoComplete: "off", placeholder: t("api.extractName"), "aria-label": `${t("api.extracts")} · ${t("api.extractName")} ${index + 1}`, value: rule.name ?? "", onChange: (e) => setExtracts((prev) => prev.map((r, j) => (j === index ? { ...r, name: e.target.value } : r))) })),
									h("td", null, h("select", {
										className: "cea-field-input",
										"aria-label": `${t("api.extracts")} · ${t("api.extractSource")} ${index + 1}`,
										value: rule.source ?? "json",
										onChange: (e) => setExtracts((prev) => prev.map((r, j) => (j === index ? { ...r, source: e.target.value } : r))),
									}, ["json", "header", "status", "body", "regex", "query"].map((s) => h("option", { key: s, value: s }, t(`api.extractSrc.${s}`))))),
									h("td", null, h("input", { className: "cea-field-input", type: "text", spellCheck: false, autoComplete: "off", placeholder: t("api.extractExpr"), "aria-label": `${t("api.extracts")} · ${t("api.extractExpr")} ${index + 1}`, value: rule.expr ?? "", onChange: (e) => setExtracts((prev) => prev.map((r, j) => (j === index ? { ...r, expr: e.target.value } : r))) })),
									h("td", null, h("button", { type: "button", className: "ce-tool cea-field-delete", title: t("api.delete"), "aria-label": `${t("api.delete")} ${t("api.extracts")} ${index + 1}`, onClick: () => setExtracts((prev) => prev.filter((_, j) => j !== index)) }, "×")),
								)),
							),
						),
					),
					h("div", { className: "cea-fields-footer" },
						h("button", { type: "button", className: "ce-tool cea-link", onClick: () => setExtracts((prev) => [...prev, { name: "", source: "json", expr: "", enabled: true }]) }, `+ ${t("api.addExtract")}`),
						extracts.length === 0 ? h("span", null, t("api.extractEmpty")) : null,
					),
				),
				extractNote !== "" ? h("div", { className: "cea-fields-footer", role: "status" }, h("span", null, extractNote)) : null,
			) : null,
			requestTab === "auth" ? h("div", { className: "cea-auth" },
				h("div", { className: "cea-sec" },
					h("span", null, t("api.auth")),
					h("select", { className: "cea-method", "aria-label": t("api.auth"), value: auth.mode, onChange: (e) => setAuth({ ...auth, mode: e.target.value }) },
						h("option", { value: "none" }, t("api.authNone")),
						h("option", { value: "bearer" }, t("api.authBearer")),
						h("option", { value: "basic" }, t("api.authBasic")),
					),
				),
				auth.mode === "bearer"
					? h("label", { className: "cea-auth-row" },
						h("span", null, t("api.authToken")),
						h("input", { className: "ce-input", "aria-label": t("api.authToken"), placeholder: t("api.authTokenPlaceholder"), value: auth.token, spellCheck: false, autoComplete: "off", onChange: (e) => setAuth({ ...auth, token: e.target.value }) }))
					: null,
				auth.mode === "basic"
					? h(Fragment, null,
						h("label", { className: "cea-auth-row" },
							h("span", null, t("api.authUser")),
							h("input", { className: "ce-input", "aria-label": t("api.authUser"), value: auth.user, spellCheck: false, autoComplete: "off", onChange: (e) => setAuth({ ...auth, user: e.target.value }) })),
						h("label", { className: "cea-auth-row" },
							h("span", null, t("api.authPass")),
							h("input", { className: "ce-input", "aria-label": t("api.authPass"), placeholder: t("api.authPassPlaceholder"), value: auth.pass, spellCheck: false, autoComplete: "off", onChange: (e) => setAuth({ ...auth, pass: e.target.value }) })))
					: null,
				h("div", { className: "cea-fields-footer" }, h("span", null, t("api.authHint"))),
			) : null,
			requestTab === "body" ? h(Fragment, null,
			h("div", { className: "cea-sec" },
				h("span", null, t("api.body")),
				h("select", { className: "cea-method", value: bodyType, onChange: (e) => setBodyType(e.target.value) },
					h("option", { value: "none" }, t("api.bodyNone")),
					h("option", { value: "form" }, t("api.bodyForm")),
					h("option", { value: "multipart" }, t("api.bodyMultipart")),
					h("option", { value: "raw" }, t("api.bodyRaw")),
				),
				bodyType === "raw"
					? h(Fragment, null,
						h("select", { className: "cea-method", value: rawSub, onChange: (e) => setRawSub(e.target.value) },
							["json", "text", "html", "xml"].map((s) => h("option", { key: s, value: s }, s))),
						rawSub === "json"
							? h(Fragment, null,
								h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", onClick: beautify }, t("api.beautify")),
								beautifyErr ? h("span", { className: "cea-err" }, beautifyErr) : null,
							)
							: null,
					)
					: null,

			),
			bodyType === "form" || bodyType === "multipart"
				? h(RequestFields, { t, label: t("api.body"), rows: formPairs, onChange: setFormPairs })
				: null,
			bodyType === "raw"
				? h("textarea", { className: "cea-body", "aria-label": t("api.body"), placeholder: rawSub === "json" ? '{\n  "key": "value"\n}' : t("api.body"), value: body, spellcheck: false, onKeyDown: (e) => {
					if (e.key !== "Tab" || e.shiftKey) return;
					e.preventDefault();
					const el = e.currentTarget; const start = el.selectionStart; const end = el.selectionEnd;
					setBody(body.slice(0, start) + "  " + body.slice(end));
					requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
				}, onChange: (e) => { setBody(e.target.value); setBeautifyErr(""); } })
				: null,
			bodyType === "none" ? h("div", { className: "cea-empty" }, t("api.bodyEmpty")) : null,
			) : null,
			),
			),
			h("div", {
				className: "cea-resizer", role: "separator", tabIndex: 0,
				"aria-label": t("api.resizePanels"), "aria-orientation": "horizontal",
				"aria-valuemin": 24, "aria-valuemax": 72, "aria-valuenow": Math.round(requestShare),
				title: t("api.resizeHint"),
				onPointerDown: (e) => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); splitDrag.current = e.pointerId; splitPointer(e); },
				onPointerMove: (e) => { if (splitDrag.current === e.pointerId) splitPointer(e); },
				onPointerUp: (e) => { if (splitDrag.current !== e.pointerId) return; splitDrag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); },
				onLostPointerCapture: () => { splitDrag.current = null; },
				onDoubleClick: () => setRequestShare(42),
				onKeyDown: (e) => {
					if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
					e.preventDefault(); e.stopPropagation();
					setSplit(e.key === "Home" ? 24 : e.key === "End" ? 72 : requestShare + (e.key === "ArrowDown" ? 5 : -5));
				},
			}, h("span", { "aria-hidden": true })),
			h("section", { className: "cea-response", "aria-label": t("api.resp"), "aria-busy": sending },
			sending ? h("div", { className: "cea-response-wait", role: "status" }, t("api.sending")) : null,
			response
				? h(Fragment, null,
					h("div", { className: "cea-sec" }, h("span", null, t("api.resp")), h("span", { className: "ce-spacer" }),
						!response.error ? h("button", { type: "button", className: "ce-link", onClick: async () => {
							try { await navigator.clipboard.writeText(respJson ?? response.text ?? ""); setResponseCopied(true); } catch { setResponseCopied(false); }
						} }, responseCopied ? t("api.copied") : t("api.copyResponse")) : null),
					h("div", { className: "cea-status" },
						response.error
							? h("span", { className: "cea-err" }, `${t("api.err")}: ${response.error}`)
							: h(Fragment, null,
								h("span", { className: statusClass(response.status) }, `${response.status} ${response.statusText ?? ""}`),
								h("span", { className: "cea-meta" }, `${response.ms ?? 0}ms · ${prettySize(response.size ?? 0)}${response.truncated ? " · truncated" : ""}`),
							),
					),
					h("div", { className: "cea-hist-tabs cea-resp-tabs", role: "tablist", "aria-label": t("api.resp") },
						[["body", t("api.respBody")], ["headers", t("api.respHeaders")], ["timeline", t("api.timeline")], ...(stream ? [["stream", `${t("api.streamTab")} · ${stream.state.events.length}${stream.state.done ? "" : " ●"}`]] : [])].map(([id, label]) =>
							h("button", { type: "button", role: "tab", key: id, className: `cea-tab${respTab === id ? " cea-tab-on" : ""}`, "aria-selected": respTab === id, onClick: () => setRespTab(id) }, label))),
					h("div", { className: "cea-response-content ce-scroll" },
						respTab === "headers"
							? (response.error
								? h("div", { className: "ce-note" }, `${t("api.err")}: ${response.error}`)
								: h("div", { className: "cea-hlist" }, (response.headers ?? []).map((hd, i) =>
									h("div", { key: i }, h("span", { className: "cea-hk" }, hd[0]), h("span", null, hd[1])))))
								: respTab === "stream" ? (stream
								? h("div", { className: "cea-stream" },
									stream.state.error !== "" ? h("div", { className: "cea-err" }, `${t("api.err")}: ${stream.state.error}`) : null,
									stream.state.dropped ? h("div", { className: "cea-meta" }, t("api.streamDropped")) : null,
									stream.state.events.length === 0 && !stream.state.error ? h("div", { className: "ce-note" }, stream.state.done ? t("api.streamEmptyDone") : t("api.streamEmptyWaiting")) : null,
									stream.state.events.slice(-300).map((ev, i) => h("div", { className: "cea-sse-row", key: `${stream.state.seq}-${i}` },
										h("span", { className: "cea-sse-kind" }, ev.event),
										typeof ev.retry === "number" ? h("span", { className: "cea-sse-retry" }, `${ev.retry}ms`) : null,
										ev.id ? h("span", { className: "cea-sse-id" }, `#${ev.id}`) : null,
										h("span", { className: "cea-sse-data" }, sseEventLabel(ev)),
									))
								)
								: h("div", { className: "ce-note" }, t("api.streamEmpty")))
								: respTab === "timeline"
								? (sent
									? h("div", { className: "cea-timeline" },
										h("div", { className: "cea-tl-req" },
											h("span", { className: `cea-mbadge cea-m-${String(sent.method).toLowerCase()}` }, sent.method),
											h("span", { className: "cea-hurl" }, sent.url)),
										h("div", { className: "cea-hlist" }, (sent.headers ?? []).map((hd, i) =>
											h("div", { key: i }, h("span", { className: "cea-hk" }, hd.name), h("span", null, hd.value)))),
										Array.isArray(sent.multipart)
											? h("div", { className: "cea-hlist" }, sent.multipart.map((f, i) =>
												h("div", { key: i }, h("span", { className: "cea-hk" }, `[form] ${f.name}`), h("span", null, f.value))))
											: null,
										typeof sent.body === "string" && sent.body !== ""
											? h("pre", { className: "cea-resp cea-tl-body" }, sent.body)
											: null,
										h("div", { className: "cea-tl-meta" }, `${t("api.timeout")}: ${sent.timeoutMs ?? 30000}ms${response.error ? "" : ` · ${response.status} · ${response.ms ?? 0}ms · ${prettySize(response.size ?? 0)}`}`),
									)
									: h("div", { className: "ce-note" }, t("api.timelineEmpty")))
								: h("pre", { className: "cea-resp" }, !response.error ? (respJson ?? response.text ?? "") : `${t("api.err")}: ${response.error}`),
					),
				)
				: h("div", { className: "cea-empty" }, h("strong", null, t("api.responseEmpty")), h("span", null, t("api.sendShortcut"))),
			),
		),
		importOpen
			? h("div", { className: "ce-overlay", ref: importRef, role: "dialog", "aria-label": t("api.importTitle") },
				h("div", { className: "ce-overlay-head" },
					h("span", null, t("api.importTitle")),
					h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setImportOpen(false) }, "✕"),
				),
				h("textarea", { className: "cea-body cea-import", autoFocus: true, "aria-label": t("api.importTitle"), value: importText, spellcheck: false, placeholder: t("api.importPlaceholder"), onChange: (e) => { setImportText(e.target.value); if (importError !== "") setImportError(""); } }),
				importError !== "" ? h("div", { className: "cea-bar" }, h("span", { className: "cea-warn", role: "status" }, importError)) : null,
				h("div", { className: "cea-bar" },
					h("span", { className: "ce-spacer" }),
					h("button", { type: "button", className: "ce-sk-btn", disabled: importText.trim() === "", onClick: doImport }, t("api.importBtn")),
				),
			)
			: null,
		saveOpen
			? h("div", { className: "ce-overlay", ref: saveRef, role: "dialog", "aria-label": t("api.saveTitle") },
				h("div", { className: "ce-overlay-head" },
					h("span", null, t("api.saveTitle")),
					h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setSaveOpen(false) }, "✕"),
				),
				h("div", { className: "cea-bar" },
					h("input", {
						className: "ce-input",
						placeholder: t("api.savePlaceholder"),
						"aria-label": t("api.savePlaceholder"),
						value: saveName,
						autoFocus: true,
						onChange: (e) => setSaveName(e.target.value),
						onKeyDown: (e) => {
							e.stopPropagation();
							if (e.key === "Enter") doSaveFavorite();
							else if (e.key === "Escape") setSaveOpen(false);
						},
					}),
					h("button", { type: "button", className: "ce-sk-btn", disabled: saveName.trim() === "", onClick: doSaveFavorite }, t("api.saveConfirm")),
				),
			)
			: null,
	);
}

const ApiGlyph = () => h("svg", { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } },
	h("path", { d: "M6 2v4M10 2v4" }),
	h("path", { d: "M4 6h8v3a4 4 0 0 1-8 0z" }),
	h("path", { d: "M8 13v1.5" }),
);

export function ApiTitle({ useTabInfo }) {
	const tabInfo = useTabInfo ? useTabInfo() : null;
	return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(ApiGlyph)), tabInfo?.tab?.title ?? "API");
}
