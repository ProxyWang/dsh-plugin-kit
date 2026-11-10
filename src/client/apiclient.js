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
 * {method, url, headers:[{name,value}], body}. Supports -X/--request,
 * -H/--header, -d/--data*, --json, -F/--form (as urlencoded pairs),
 * -u/--user (Basic auth), -A/-e/-b (UA/Referer/Cookie), -I/--head,
 * -G/--get (data becomes query), --url, and ignores common noise flags.
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
	if (form.length > 0) {
		body = form.map((f) => f.replace(/@[^;]*$/, "")).join("&");
		setHeader("Content-Type", "application/x-www-form-urlencoded");
	}
	if (hasBody && method === "") method = "POST";
	if (method === "") method = "GET";
	return { method, url, headers, body };
}

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

	const send = useCallback(() => {
		if (url.trim() === "" || sending) return;
		const sendHeaders = headers.filter((hd) => String(hd.name ?? "").trim() !== "").map((hd) => ({ name: hd.name, value: String(hd.value ?? "") }));
		let sendBody;
		if (bodyType === "raw") {
			sendBody = body;
			upsertHeader(sendHeaders, "Content-Type", SUB_CT[rawSub] ?? "text/plain");
		} else if (bodyType === "form") {
			sendBody = new URLSearchParams(formPairs.filter((p) => String(p.name ?? "").trim() !== "").map((p) => [p.name.trim(), String(p.value ?? "")])).toString();
			upsertHeader(sendHeaders, "Content-Type", "application/x-www-form-urlencoded");
		}
		setSending(true);
		api("api.send", {
			method,
			url: url.trim(),
			headers: sendHeaders,
			body: sendBody,
		}).then((res) => {
			setSending(false);
			setResponse(res.ok ? res.value : { error: res.error });
		});
	}, [method, url, headers, bodyType, rawSub, formPairs, body, sending]);

	const doImport = useCallback(() => {
		const p = parseCurl(importText);
		setMethod(p.method);
		setUrl(p.url);
		if (p.headers.length > 0) setHeaders(p.headers);
		if (p.body !== "") {
			setBody(p.body);
			setBodyType("raw");
		}
		setImportText("");
		setImportOpen(false);
	}, [importText]);

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
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.importTitle"), onClick: () => setImportOpen(true) }, t("api.import")),
		),
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
				bodyType === "form"
					? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.addHeader"), onClick: () => setFormPairs((prev) => [...prev, { name: "", value: "" }]) }, "+")
					: null,
			),
			bodyType === "form"
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
