/* ---------------- API tester: curl import, request editor, response view ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useState } from "./react.js";
import { api } from "./api.js";

const DRAFT_KEY = "dsh.ce.api.draft.v1";

const SUB_CT = { json: "application/json", text: "text/plain", html: "text/html", xml: "application/xml" };

function upsertHeader(list, name, value) {
	const found = list.find((hd) => hd.name.toLowerCase() === name.toLowerCase());
	if (found) found.value = value;
	else list.push({ name, value });
}

/**
 * Parse a (possibly multi-line, backslash-continued) curl command into
 * {method, url, headers:[{name,value}], body, multipart?}. Supports
 * -X/--request, -H/--header, -d/--data*, --json, -F/--form (as multipart
 * field pairs), -u/--user (Basic auth), -A/-e/-b (UA/Referer/Cookie),
 * -I/--head, -G/--get (data becomes query), --url, and ignores common
 * noise flags.
 */
export function parseCurl(input) {
	const joined = String(input ?? "").replace(/\\\r?\n/g, " ").trim();
	const tokens = [];
	let cur = "";
	let quote = null;
	let started = false;
	for (let i = 0; i < joined.length; i++) {
		const ch = joined[i];
		if (quote !== null) {
			if (ch === "\\" && quote === '"' && i + 1 < joined.length) {
				cur += joined[++i];
				continue;
			}
			if (ch === quote) {
				quote = null;
				continue;
			}
			cur += ch;
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			started = true;
			continue;
		}
		if (ch === "\\" && i + 1 < joined.length) {
			cur += joined[++i];
			started = true;
			continue;
		}
		if (/\s/.test(ch)) {
			if (started || cur !== "") {
				tokens.push(cur);
				cur = "";
				started = false;
			}
			continue;
		}
		cur += ch;
		started = true;
	}
	if (cur !== "" || started) tokens.push(cur);
	if (tokens.length > 0 && /^curl$/i.test(tokens[0])) tokens.shift();

	let method = "";
	let url = "";
	let body = "";
	let hasBody = false;
	let asQuery = false;
	const headers = [];
	const form = [];
	const setHeader = (name, value) => {
		const existing = headers.find((hd) => hd.name.toLowerCase() === name.toLowerCase());
		if (existing) existing.value = value;
		else headers.push({ name, value });
	};
	const VALUE_FLAGS = new Set(["-o", "--output", "--max-time", "-m", "--retry", "--connect-timeout", "-w", "--write-out", "--resolve", "--cacert", "--cert", "--key", "--proxy", "-x"]);
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		const next = () => {
			i += 1;
			return tokens[i] ?? "";
		};
		if (t === "-X" || t === "--request") {
			method = next().toUpperCase();
			continue;
		}
		if (t === "-H" || t === "--header") {
			const hv = next();
			const at = hv.indexOf(":");
			if (at > 0) setHeader(hv.slice(0, at).trim(), hv.slice(at + 1).trim());
			continue;
		}
		if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--data-urlencode") {
			const d = next();
			hasBody = true;
			body = body === "" ? d : `${body}&${d}`;
			continue;
		}
		if (t === "--json") {
			body = next();
			hasBody = true;
			setHeader("Content-Type", "application/json");
			continue;
		}
		if (t === "-F" || t === "--form") {
			form.push(next());
			hasBody = true;
			continue;
		}
		if (t === "-u" || t === "--user") {
			setHeader("Authorization", `Basic ${btoa(unescape(encodeURIComponent(next())))}`);
			continue;
		}
		if (t === "-A" || t === "--user-agent") {
			setHeader("User-Agent", next());
			continue;
		}
		if (t === "-e" || t === "--referer") {
			setHeader("Referer", next());
			continue;
		}
		if (t === "-b" || t === "--cookie") {
			setHeader("Cookie", next());
			continue;
		}
		if (t === "-I" || t === "--head") {
			method = "HEAD";
			continue;
		}
		if (t === "-G" || t === "--get") {
			asQuery = true;
			continue;
		}
		if (t === "--url") {
			url = next();
			continue;
		}
		if (t.startsWith("-")) {
			if (VALUE_FLAGS.has(t)) next();
			continue;
		}
		if (url === "") url = t;
	}
	if (asQuery && body !== "") {
		url = url + (url.includes("?") ? "&" : "?") + body;
		body = "";
		hasBody = false;
	}
	// -F entries are multipart fields: split on the first "=" and keep the
	// raw value (including "@file" markers, which stay visible as text).
	let multipart = null;
	if (form.length > 0) {
		multipart = form.map((f) => {
			const eq = f.indexOf("=");
			return eq > 0 ? { name: f.slice(0, eq), value: f.slice(eq + 1) } : { name: f, value: "" };
		});
	}
	if (hasBody && method === "") method = "POST";
	if (method === "") method = "GET";
	return multipart ? { method, url, headers, body, multipart } : { method, url, headers, body };
}

function statusClass(status) {
	if (status < 300) return "cea-ok";
	if (status < 400) return "cea-info";
	if (status < 500) return "cea-warn";
	return "cea-err";
}

/** POSIX single-quote escaping; embedded ' becomes '\'' — safe for any shell. */
export function shellQuote(s) {
	return `'${String(s).replace(/'/g, "'\\''")}'`;
}

/**
 * Serialize the current request back to a curl command (Postman's "Copy as
 * curl"). Output uses backslash line continuations and stays re-importable by
 * parseCurl. Content-Type implied by the body mode is emitted explicitly when
 * the user has not set one, matching what send() does on the wire.
 */
export function toCurl(req) {
	const parts = ["curl"];
	const method = String(req?.method || "GET").toUpperCase();
	const bodyType = req?.bodyType || "none";
	if (method !== "GET" || bodyType !== "none") parts.push(`-X ${method}`);
	parts.push(shellQuote(String(req?.url ?? "")));
	const headers = (req?.headers ?? []).filter((hd) => String(hd?.name ?? "").trim() !== "");
	for (const hd of headers) parts.push(`-H ${shellQuote(`${String(hd.name).trim()}: ${hd.value ?? ""}`)}`);
	const hasCT = headers.some((hd) => String(hd.name).trim().toLowerCase() === "content-type");
	if (bodyType === "raw") {
		if (!hasCT) parts.push(`-H ${shellQuote(`Content-Type: ${SUB_CT[req?.rawSub] ?? "text/plain"}`)}`);
		parts.push(`--data-raw ${shellQuote(req?.body ?? "")}`);
	} else if (bodyType === "form") {
		for (const p of req?.formPairs ?? []) {
			const name = String(p?.name ?? "").trim();
			if (name) parts.push(`--data-urlencode ${shellQuote(`${name}=${p?.value ?? ""}`)}`);
		}
	} else if (bodyType === "multipart") {
		for (const p of req?.formPairs ?? []) {
			const name = String(p?.name ?? "").trim();
			if (name) parts.push(`-F ${shellQuote(`${name}=${p?.value ?? ""}`)}`);
		}
	}
	// One logical flag per line (backslash continuations) once it gets long;
	// parseCurl folds them back, so the output stays re-importable.
	return parts.length <= 2 ? parts.join(" ") : parts.join(" \\\n  ");
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
		if (name) map[name] = p?.value ?? "";
	}
	return map;
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

export function ApiView({ t }) {
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
	const [envPairs, setEnvPairs] = useState(() => loadList(ENV_KEY));
	const [envOpen, setEnvOpen] = useState(false);
	const [copied, setCopied] = useState(false);

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
			if (typeof d.bodyType === "string") setBodyType(d.bodyType);
			if (typeof d.rawSub === "string") setRawSub(d.rawSub);
			if (Array.isArray(d.formPairs)) setFormPairs(d.formPairs);
			if (typeof d.body === "string") setBody(d.body);
		} catch { /* corrupt draft: start clean */ }
	}, []);
	useEffect(() => {
		try {
			localStorage.setItem(DRAFT_KEY, JSON.stringify({ method, url, headers, bodyType, rawSub, formPairs, body }));
		} catch { /* storage unavailable */ }
	}, [method, url, headers, bodyType, rawSub, formPairs, body]);

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
		() => ({ method, url, headers, bodyType, rawSub, formPairs, body }),
		[method, url, headers, bodyType, rawSub, formPairs, body],
	);

	const restoreRequest = useCallback((req) => {
		if (!req || typeof req !== "object") return;
		if (typeof req.method === "string") setMethod(req.method);
		if (typeof req.url === "string") setUrl(req.url);
		if (Array.isArray(req.headers)) setHeaders(req.headers);
		if (typeof req.bodyType === "string") setBodyType(req.bodyType);
		if (typeof req.rawSub === "string") setRawSub(req.rawSub);
		if (Array.isArray(req.formPairs)) setFormPairs(req.formPairs);
		if (typeof req.body === "string") setBody(req.body);
		setResponse(null);
		setHistOpen(false);
	}, []);

	const send = useCallback(() => {
		if (url.trim() === "" || sending) return;
		// {{var}} placeholders resolve from the env table at send time; the
		// editor and history keep the unsubstituted template.
		const envMap = buildEnvMap(envPairs);
		const sendHeaders = headers
			.filter((hd) => String(hd.name ?? "").trim() !== "")
			.map((hd) => ({ name: String(hd.name).trim(), value: substituteVars(String(hd.value ?? ""), envMap) }));
		let sendBody;
		let multipart;
		if (bodyType === "raw") {
			sendBody = substituteVars(body, envMap);
			upsertHeader(sendHeaders, "Content-Type", SUB_CT[rawSub] ?? "text/plain");
		} else if (bodyType === "form") {
			sendBody = new URLSearchParams(formPairs
				.filter((p) => String(p.name ?? "").trim() !== "")
				.map((p) => [p.name.trim(), substituteVars(String(p.value ?? ""), envMap)])).toString();
			upsertHeader(sendHeaders, "Content-Type", "application/x-www-form-urlencoded");
		} else if (bodyType === "multipart") {
			multipart = formPairs
				.filter((p) => String(p.name ?? "").trim() !== "")
				.map((p) => ({ name: p.name.trim(), value: substituteVars(String(p.value ?? ""), envMap) }));
		}
		const sentMethod = method;
		const sentUrl = substituteVars(url.trim(), envMap);
		const sentSnapshot = snapshot();
		setSending(true);
		api("api.send", {
			method,
			url: sentUrl,
			headers: sendHeaders,
			body: sendBody,
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
	}, [method, url, headers, bodyType, rawSub, formPairs, body, sending, snapshot, envPairs]);

	const copyCurl = useCallback(() => {
		const text = toCurl({ method, url, headers, bodyType, rawSub, formPairs, body });
		const done = () => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		};
		try {
			const p = navigator.clipboard?.writeText(text);
			if (p && typeof p.then === "function") p.then(done, () => {});
			else done();
		} catch { /* clipboard unavailable */ }
	}, [method, url, headers, bodyType, rawSub, formPairs, body]);

	const doImport = useCallback(() => {
		const p = parseCurl(importText);
		setMethod(p.method);
		setUrl(p.url);
		if (p.headers.length > 0) setHeaders(p.headers);
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

	const setHeaderAt = (index, patch) => setHeaders((prev) => prev.map((hd, i) => (i === index ? { ...hd, ...patch } : hd)));

	return h("div", { className: "ce-root" },
		h("div", { className: "cea-bar" },
			h("select", { className: "cea-method", value: method, onChange: (e) => setMethod(e.target.value) },
				["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map((m) => h("option", { key: m, value: m }, m))),
			h("input", {
				className: "ce-input cea-url",
				placeholder: t("api.urlPlaceholder"),
				value: url,
				onChange: (e) => setUrl(e.target.value),
				onKeyDown: (e) => {
					if (e.key === "Enter") send();
				},
			}),
			h("button", { type: "button", className: "ce-sk-btn cea-send", disabled: sending || url.trim() === "", onClick: send }, sending ? t("api.sending") : t("api.send")),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.importTitle"), onClick: () => { setImportOpen(true); setHistOpen(false); setSaveOpen(false); setEnvOpen(false); } }, t("api.import")),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.copyCurl"), disabled: url.trim() === "", onClick: copyCurl }, copied ? t("api.copied") : "⧉ curl"),
			h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${envOpen ? " cea-btn-on" : ""}`, title: t("api.envTitle"), onClick: () => { setEnvOpen((v) => !v); setHistOpen(false); setSaveOpen(false); setImportOpen(false); } }, `{{}}${envPairs.length ? ` ${envPairs.length}` : ""}`),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.saveTitle"), onClick: () => { setSaveOpen(true); setHistOpen(false); setImportOpen(false); setEnvOpen(false); } }, t("api.saveBtn")),
			h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${histOpen ? " cea-btn-on" : ""}`, title: t("api.history"), onClick: () => { setHistOpen((v) => !v); setSaveOpen(false); setImportOpen(false); setEnvOpen(false); } }, `${t("api.history")}${history.length ? ` ${history.length}` : ""}`),
		),
		histOpen
			? h("div", { className: "cea-hist" },
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
		h("div", { className: "cea-scroll ce-scroll" },
			h("div", { className: "cea-sec" },
				h("span", null, t("api.headers")),
				h("span", { className: "ce-spacer" }),
				h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.addHeader"), onClick: () => setHeaders((prev) => [...prev, { name: "", value: "" }]) }, "+"),
			),
			headers.map((hd, i) => h("div", { key: i, className: "cea-hrow" },
				h("input", { className: "ce-input cea-hkey", placeholder: "Header", value: hd.name ?? "", onChange: (e) => setHeaderAt(i, { name: e.target.value }) }),
				h("input", { className: "ce-input cea-hval", placeholder: "Value", value: hd.value ?? "", onChange: (e) => setHeaderAt(i, { value: e.target.value }) }),
				h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setHeaders((prev) => prev.filter((_, j) => j !== i)) }, "✕"),
			)),
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
				bodyType === "form" || bodyType === "multipart"
					? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.addHeader"), onClick: () => setFormPairs((prev) => [...prev, { name: "", value: "" }]) }, "+")
					: null,
			),
			bodyType === "form" || bodyType === "multipart"
				? h(Fragment, null, formPairs.map((p, i) => h("div", { key: i, className: "cea-hrow" },
					h("input", { className: "ce-input cea-hkey", placeholder: "key", value: p.name ?? "", onChange: (e) => setFormPairs((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))) }),
					h("input", { className: "ce-input cea-hval", placeholder: "value", value: p.value ?? "", onChange: (e) => setFormPairs((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x))) }),
					h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setFormPairs((prev) => prev.filter((_, j) => j !== i)) }, "✕"),
				)))
				: null,
			bodyType === "raw"
				? h("textarea", { className: "cea-body", value: body, spellcheck: false, onChange: (e) => { setBody(e.target.value); setBeautifyErr(""); } })
				: null,
			response
				? h(Fragment, null,
					h("div", { className: "cea-sec" }, h("span", null, t("api.resp"))),
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
					showRespHeaders && !response.error
						? h("div", { className: "cea-hlist" }, (response.headers ?? []).map((hd, i) =>
							h("div", { key: i }, h("span", { className: "cea-hk" }, hd[0]), h("span", null, hd[1]))))
						: null,
					!response.error
						? h("pre", { className: "cea-resp" }, respJson ?? response.text ?? "")
						: null,
				)
				: null,
		),
		importOpen
			? h("div", { className: "ce-overlay" },
				h("div", { className: "ce-overlay-head" },
					h("span", null, t("api.importTitle")),
					h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setImportOpen(false) }, "✕"),
				),
				h("textarea", { className: "cea-body cea-import", value: importText, spellcheck: false, placeholder: "curl -X POST 'https://…' -H 'K: V' -d '{…}'", onChange: (e) => setImportText(e.target.value) }),
				h("div", { className: "cea-bar" },
					h("span", { className: "ce-spacer" }),
					h("button", { type: "button", className: "ce-sk-btn", disabled: importText.trim() === "", onClick: doImport }, t("api.importBtn")),
				),
			)
			: null,
		saveOpen
			? h("div", { className: "ce-overlay" },
				h("div", { className: "ce-overlay-head" },
					h("span", null, t("api.saveTitle")),
					h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setSaveOpen(false) }, "✕"),
				),
				h("div", { className: "cea-bar" },
					h("input", {
						className: "ce-input",
						placeholder: t("api.savePlaceholder"),
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
		envOpen
			? h("div", { className: "ce-overlay" },
				h("div", { className: "ce-overlay-head" },
					h("span", null, t("api.env")),
					h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setEnvOpen(false) }, "✕"),
				),
				h("div", { className: "ce-note" }, t("api.envTitle")),
				h("div", { className: "cea-scroll" },
					envPairs.length === 0 ? h("div", { className: "ce-note" }, t("api.envEmpty")) : null,
					envPairs.map((p, i) => h("div", { key: i, className: "cea-hrow" },
						h("input", { className: "ce-input cea-hkey", placeholder: "name", value: p.name ?? "", onChange: (e) => setEnvPairs((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))) }),
						h("input", { className: "ce-input cea-hval", placeholder: "value", value: p.value ?? "", onChange: (e) => setEnvPairs((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x))) }),
						h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.delete"), onClick: () => setEnvPairs((prev) => prev.filter((_, j) => j !== i)) }, "✕"),
					)),
				),
				h("div", { className: "cea-bar" },
					h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.addEnv"), onClick: () => setEnvPairs((prev) => [...prev, { name: "", value: "" }]) }, "+"),
					h("span", { className: "ce-spacer" }),
					h("button", { type: "button", className: "ce-sk-btn", onClick: () => setEnvOpen(false) }, t("close")),
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
