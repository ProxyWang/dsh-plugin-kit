/* ---------------- API tester: curl import, request editor, response view ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { api } from "./api.js";
import { SUB_CT, parseCurl, toCurl } from "./curl.js";
import { RequestFields } from "./requestfields.js";
import { useDismissLayer } from "./dismiss.js";

const DRAFT_KEY = "dsh.ce.api.draft.v1";


function upsertHeader(list, name, value) {
	const found = list.find((hd) => hd.name.toLowerCase() === name.toLowerCase());
	if (found) found.value = value;
	else list.push({ name, value });
}

function statusClass(status) {
	if (status < 300) return "cea-ok";
	if (status < 400) return "cea-info";
	if (status < 500) return "cea-warn";
	return "cea-err";
}

/** Replace {{name}} from envMap; unknown names stay literal (Postman semantics). */
export function substituteVars(text, envMap) {
	if (typeof text !== "string" || !text.includes("{{")) return text;
	return text.replace(/\{\{\s*([A-Za-z0-9_.\-]+)\s*\}\}/g, (whole, name) =>
		Object.prototype.hasOwnProperty.call(envMap, name) ? String(envMap[name]) : whole);
}

/** [{name,value}] pairs → plain map, skipping empty names (last wins). */
export function buildEnvMap(pairs) {
	const map = {};
	for (const p of pairs ?? []) {
		const name = String(p?.name ?? "").trim();
		if (name && p.enabled !== false) map[name] = p?.value ?? "";
	}
	return map;
}

/**
 * Merge query-param pairs into a URL (Postman Params-tab semantics): table
 * entries override same-named params already in the URL, other existing
 * params survive, empty values send `name=`, and a #fragment is preserved.
 * Exported for tests.
 */
export function mergeParams(url, pairs) {
	const raw = String(url ?? "");
	const active = (pairs ?? []).filter((p) => p?.enabled !== false && String(p?.name ?? "").trim() !== "");
	if (active.length === 0) return raw;
	const hAt = raw.indexOf("#");
	const frag = hAt >= 0 ? raw.slice(hAt) : "";
	const work = hAt >= 0 ? raw.slice(0, hAt) : raw;
	const qAt = work.indexOf("?");
	const base = qAt >= 0 ? work.slice(0, qAt) : work;
	const params = new URLSearchParams(qAt >= 0 ? work.slice(qAt + 1) : "");
	for (const p of active) params.set(String(p.name).trim(), String(p.value ?? ""));
	const qs = params.toString();
	return `${base}${qs ? `?${qs}` : ""}${frag}`;
}

function prettySize(n) {
	if (n < 1024) return `${n}B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
	return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

const HIST_KEY = "dsh.ce.api.history.v1";
const SAVED_KEY = "dsh.ce.api.saved.v1";
const ENV_KEY = "dsh.ce.api.env.v1";
const HIST_CAP = 30;
const SAVED_CAP = 50;

/** Newest-first insert, deduped by id, capped. Pure for testability. */
export function pushEntry(list, entry, cap) {
	const base = Array.isArray(list) ? list.filter((e) => e && e.id !== entry.id) : [];
	return [entry, ...base].slice(0, cap);
}

/** Compact relative age for history rows: 5s / 4m / 3h / 2d. */
export function relTimeAgo(ts) {
	const s = Math.max(0, Math.floor((Date.now() - (ts || 0)) / 1000));
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const hh = Math.floor(m / 60);
	if (hh < 24) return `${hh}h`;
	return `${Math.floor(hh / 24)}d`;
}

function loadList(key) {
	try {
		const list = JSON.parse(localStorage.getItem(key) ?? "[]");
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

function storeList(key, list) {
	try {
		localStorage.setItem(key, JSON.stringify(list));
	} catch { /* storage unavailable */ }
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
	const [sending, setSending] = useState(false);
	const [response, setResponse] = useState(null);
	const [showRespHeaders, setShowRespHeaders] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [importText, setImportText] = useState("");
	const [histOpen, setHistOpen] = useState(false);
	const [histTab, setHistTab] = useState("history"); // history | saved
	const [history, setHistory] = useState([]);
	const [saved, setSaved] = useState([]);
	const [saveOpen, setSaveOpen] = useState(false);
	const [saveName, setSaveName] = useState("");
	const importRef = useDismissLayer({ open: importOpen, onDismiss: () => setImportOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-import"]' });
	const saveRef = useDismissLayer({ open: saveOpen, onDismiss: () => setSaveOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-save"]' });
	const historyRef = useDismissLayer({ open: histOpen, onDismiss: () => setHistOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-history"]' });
	useEffect(() => {
		if (hostTab?.visible === false) { setImportOpen(false); setSaveOpen(false); setHistOpen(false); }
	}, [hostTab?.visible]);
	const [envPairs, setEnvPairs] = useState(() => loadList(ENV_KEY));
	const [copied, setCopied] = useState(false);
	const [paramPairs, setParamPairs] = useState([]);
	const [requestTab, setRequestTab] = useState("params");
	const [responseCopied, setResponseCopied] = useState(false);
	const [timeoutMs, setTimeoutMs] = useState(30000);
	const [requestShare, setRequestShare] = useState(42);
	const workspaceRef = useRef(null);
	const splitDrag = useRef(null);
	const setSplit = (value) => setRequestShare(Math.max(24, Math.min(72, value)));
	const splitPointer = (event) => {
		const rect = workspaceRef.current?.getBoundingClientRect();
		if (!rect || rect.height <= 0) return;
		setSplit((event.clientY - rect.top) / rect.height * 100);
	};

	useEffect(() => {
		storeList(ENV_KEY, envPairs);
	}, [envPairs]);
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
			if (typeof d.url === "string") setUrl(d.url);
			if (Array.isArray(d.headers)) setHeaders(d.headers);
			if (typeof d.bodyType === "string") { setBodyType(d.bodyType); if (d.bodyType !== "none") setRequestTab("body"); }
			if (typeof d.rawSub === "string") setRawSub(d.rawSub);
			if (Array.isArray(d.formPairs)) setFormPairs(d.formPairs);
			if (typeof d.body === "string") setBody(d.body);
			if (Array.isArray(d.paramPairs)) setParamPairs(d.paramPairs);
			if (Number.isFinite(d.timeoutMs) && d.timeoutMs >= 1000) setTimeoutMs(Math.min(120000, d.timeoutMs));
		} catch { /* corrupt draft: start clean */ }
	}, []);
	useEffect(() => {
		try {
			localStorage.setItem(DRAFT_KEY, JSON.stringify({ method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs }));
		} catch { /* storage unavailable */ }
	}, [method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs]);

	const beautify = useCallback(() => {
		try {
			setBody(JSON.stringify(JSON.parse(body), null, 2));
			setBeautifyErr("");
		} catch {
			setBeautifyErr(t("api.beautifyErr"));
		}
	}, [body, t]);

	/** Full editor snapshot — what history rows and favorites restore. */
	const snapshot = useCallback(
		() => ({ method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs }),
		[method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs],
	);

	const restoreRequest = useCallback((req) => {
		if (!req || typeof req !== "object") return;
		if (typeof req.method === "string") setMethod(req.method);
		if (typeof req.url === "string") setUrl(req.url);
		if (Array.isArray(req.headers)) setHeaders(req.headers);
		if (typeof req.bodyType === "string") { setBodyType(req.bodyType); setRequestTab(req.bodyType === "none" ? "params" : "body"); }
		if (typeof req.rawSub === "string") setRawSub(req.rawSub);
		if (Array.isArray(req.formPairs)) setFormPairs(req.formPairs);
		if (typeof req.body === "string") setBody(req.body);
		if (Array.isArray(req.paramPairs)) setParamPairs(req.paramPairs);
		if (Number.isFinite(req.timeoutMs) && req.timeoutMs >= 1000) setTimeoutMs(Math.min(120000, req.timeoutMs));
		setResponse(null);
		setHistOpen(false);
	}, []);

	const send = useCallback(() => {
		if (url.trim() === "" || sending) return;
		// {{var}} placeholders resolve from the env table at send time; the
		// editor and history keep the unsubstituted template.
		const envMap = buildEnvMap(envPairs);
		const sendHeaders = headers
			.filter((hd) => hd.enabled !== false && String(hd.name ?? "").trim() !== "")
			.map((hd) => ({ name: String(hd.name).trim(), value: substituteVars(String(hd.value ?? ""), envMap) }));
		let sendBody;
		let multipart;
		if (bodyType === "raw") {
			sendBody = substituteVars(body, envMap);
			upsertHeader(sendHeaders, "Content-Type", SUB_CT[rawSub] ?? "text/plain");
		} else if (bodyType === "form") {
			sendBody = new URLSearchParams(formPairs
				.filter((p) => p.enabled !== false && String(p.name ?? "").trim() !== "")
				.map((p) => [p.name.trim(), substituteVars(String(p.value ?? ""), envMap)])).toString();
			upsertHeader(sendHeaders, "Content-Type", "application/x-www-form-urlencoded");
		} else if (bodyType === "multipart") {
			multipart = formPairs
				.filter((p) => p.enabled !== false && String(p.name ?? "").trim() !== "")
				.map((p) => ({ name: p.name.trim(), value: substituteVars(String(p.value ?? ""), envMap) }));
		}
		const sentMethod = method;
		const sentUrl = substituteVars(mergeParams(url.trim(), paramPairs), envMap);
		const sentSnapshot = snapshot();
		setSending(true);
		setResponseCopied(false);
		api("api.send", {
			method,
			url: sentUrl,
			headers: sendHeaders,
			body: sendBody,
			timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : void 0,
			...(multipart ? { multipart } : {}),
		}).then((res) => {
			setSending(false);
			const value = res.ok ? res.value : { error: res.error };
			setResponse(value);
			// Every settled send lands in the history (newest first, capped),
			// carrying the full request so one click restores it.
			const entry = {
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				ts: Date.now(),
				method: sentMethod,
				url: sentUrl,
				status: value?.status,
				ms: value?.ms,
				error: value?.error ?? void 0,
				request: sentSnapshot,
			};
			setHistory((prev) => {
				const next = pushEntry(prev, entry, HIST_CAP);
				storeList(HIST_KEY, next);
				return next;
			});
		});
	}, [method, url, headers, bodyType, rawSub, formPairs, body, sending, snapshot, envPairs, paramPairs, timeoutMs]);

	const copyCurl = useCallback(() => {
		const text = toCurl({ method, url: mergeParams(url.trim(), paramPairs), headers, bodyType, rawSub, formPairs, body });
		const done = () => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		};
		try {
			const p = navigator.clipboard?.writeText(text);
			if (p && typeof p.then === "function") p.then(done, () => {});
			else done();
		} catch { /* clipboard unavailable */ }
	}, [method, url, headers, bodyType, rawSub, formPairs, body, paramPairs]);

	const doImport = useCallback(() => {
		const p = parseCurl(importText);
		setMethod(p.method);
		setUrl(p.url);
		setHeaders(p.headers);
		setParamPairs([]);
		setBody(p.body ?? "");
		setFormPairs(p.multipart ?? []);
		setBodyType("none");
		setResponse(null);
		setRequestTab(p.multipart || p.body !== "" ? "body" : "params");
		if (p.multipart) {
			setFormPairs(p.multipart);
			setBodyType("multipart");
		} else if (p.body !== "") {
			setBody(p.body);
			setBodyType("raw");
		}
		setImportText("");
		setImportOpen(false);
	}, [importText]);

	const doSaveFavorite = useCallback(() => {
		const name = saveName.trim();
		if (name === "") return;
		const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, ts: Date.now(), request: snapshot() };
		setSaved((prev) => {
			// Same name replaces the old favorite (differing ids).
			const next = [entry, ...prev.filter((e) => e && e.name !== name)].slice(0, SAVED_CAP);
			storeList(SAVED_KEY, next);
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
			storeList(HIST_KEY, next);
			return next;
		});
	}, []);
	const removeSaved = useCallback((id) => {
		setSaved((prev) => {
			const next = prev.filter((e) => e && e.id !== id);
			storeList(SAVED_KEY, next);
			return next;
		});
	}, []);
	const clearHistory = useCallback(() => {
		setHistory([]);
		storeList(HIST_KEY, []);
	}, []);

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

	const activeParamCount = paramPairs.filter((p) => p?.enabled !== false && String(p?.name ?? "").trim() !== "").length;

	return h("div", { className: "ce-root cea-root", onKeyDown: (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !importOpen && !saveOpen) {
			e.preventDefault(); e.stopPropagation(); send();
		}
	} },
		h("div", { className: "cea-tools" },
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.importTitle"), "data-ce-popup-trigger": "api-import", "aria-expanded": importOpen, onClick: () => { setImportOpen((value) => !value); setHistOpen(false); setSaveOpen(false); } }, t("api.import")),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.copyCurl"), disabled: url.trim() === "", onClick: copyCurl }, copied ? t("api.copied") : "⧉ curl"),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.saveTitle"), "data-ce-popup-trigger": "api-save", "aria-expanded": saveOpen, onClick: () => { setSaveOpen((value) => !value); setHistOpen(false); setImportOpen(false); } }, t("api.saveBtn")),
			h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${histOpen ? " cea-btn-on" : ""}`, title: t("api.history"), "data-ce-popup-trigger": "api-history", "aria-expanded": histOpen, onClick: () => { setHistOpen((v) => !v); setSaveOpen(false); setImportOpen(false); } }, `${t("api.history")}${history.length ? ` ${history.length}` : ""}`),
		),
		h("div", { className: "cea-bar" },
			h("select", { className: `cea-method cea-request-method cea-m-${method.toLowerCase()}`, "aria-label": t("api.method"), value: method, onChange: (e) => setMethod(e.target.value) },
				["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => h("option", { key: m, value: m }, m))),
			h("input", {
				className: "ce-input cea-url",
				placeholder: t("api.urlPlaceholder"),
				"aria-label": t("api.urlPlaceholder"),
				value: url,
				onChange: (e) => setUrl(e.target.value),
				onKeyDown: (e) => {
					if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); send(); }
				},
			}),
			h("button", { type: "button", className: "ce-sk-btn cea-send", title: t("api.sendShortcut"), disabled: sending || url.trim() === "", onClick: send }, sending ? t("api.sending") : t("api.send")),
		),

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
				[ ["params", t("api.params"), activeParamCount], ["headers", t("api.headers"), headers.filter((p) => p.enabled !== false && p.name?.trim()).length], ["body", t("api.body"), bodyType === "none" ? 0 : 1], ["variables", t("api.environment"), envPairs.filter((p) => p.enabled !== false && p.name?.trim()).length], ["settings", t("api.settings"), 0] ].map(([id, label, count]) =>
					h("button", { type: "button", key: id, className: `cea-config-tab${requestTab === id ? " cea-config-tab-on" : ""}`, "aria-pressed": requestTab === id, onClick: () => setRequestTab(id) }, label, count ? h("span", { className: "cea-tab-count" }, count) : null)),
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
			requestTab === "params" ? h(RequestFields, { t, label: t("api.params"), rows: paramPairs, onChange: setParamPairs, hint: t("api.paramsHint") }) : null,
			requestTab === "headers" ? h(RequestFields, { t, label: t("api.headers"), rows: headers, onChange: setHeaders }) : null,
			requestTab === "variables" ? h(RequestFields, { t, label: t("api.environment"), rows: envPairs, onChange: setEnvPairs, hint: t("api.envTitle") }) : null,
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
								h("span", { className: "ce-spacer" }),
								h("button", { type: "button", className: "ce-link", onClick: () => setShowRespHeaders((v) => !v) }, `${t("api.respHeaders")} ${showRespHeaders ? "▾" : "▸"}`),
							),
					),
					h("div", { className: "cea-response-content ce-scroll" },
						showRespHeaders && !response.error
							? h("div", { className: "cea-hlist" }, (response.headers ?? []).map((hd, i) =>
								h("div", { key: i }, h("span", { className: "cea-hk" }, hd[0]), h("span", null, hd[1]))))
							: null,
						!response.error ? h("pre", { className: "cea-resp" }, respJson ?? response.text ?? "") : null,
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
				h("textarea", { className: "cea-body cea-import", autoFocus: true, "aria-label": t("api.importTitle"), value: importText, spellcheck: false, placeholder: "curl -X POST 'https://…' -H 'K: V' -d '{…}'", onChange: (e) => setImportText(e.target.value) }),
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
