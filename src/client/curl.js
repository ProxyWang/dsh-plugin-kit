/* ---------------- curl wire format: import (parse) and export (serialize) ----------------
 *
 * Pure functions shared by the API tab's "Import curl" and "⧉ copy-as-curl"
 * flows. The two are inverse enough to roundtrip: toCurl output re-imports
 * through parseCurl to the same request (covered by tests).
 */

export const SUB_CT = { json: "application/json", text: "text/plain", html: "text/html", xml: "application/xml" };

/**
 * Parse a (possibly multi-line, backslash-continued) curl command into
 * {method, url, headers:[{name,value}], body, multipart?}. Supports
 * -X/--request, -H/--header, -d/--data*, --json, -F/--form (as multipart
 * field pairs), -u/--user (Basic auth), -A/-e/-b (UA/Referer/Cookie),
 * -I/--head, -G/--get (data becomes query), --url, and ignores common
 * noise flags.
 */
export function parseCurl(input) {
	const joined = String(input ?? "").trim();
	const tokens = [];
	let cur = "";
	let quote = null;
	let started = false;
	// Backslash-newline continuation: bash drops both chars (unquoted AND
	// inside double quotes); inside single quotes they stay literal. Folding
	// them in a pre-pass used to corrupt multi-line request bodies.
	const continuationLen = (i) => {
		if (joined[i] !== "\\") return 0;
		if (joined[i + 1] === "\n") return 2;
		if (joined[i + 1] === "\r" && joined[i + 2] === "\n") return 3;
		return 0;
	};
	for (let i = 0; i < joined.length; i++) {
		const ch = joined[i];
		if (quote !== null) {
			if (ch === "\\" && quote === '"') {
				const cont = continuationLen(i);
				if (cont > 0) {
					i += cont - 1;
					continue;
				}
				if (i + 1 < joined.length) {
					cur += joined[++i];
					continue;
				}
				continue;
			}
			if (ch === quote) {
				quote = null;
				continue;
			}
			cur += ch;
			continue;
		}
		const cont = continuationLen(i);
		if (cont > 0) {
			i += cont - 1;
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
	const VALUE_FLAGS = new Set(["-o", "--output", "--max-time", "-m", "--retry", "--connect-timeout", "-w", "--write-out", "--resolve", "--cacert", "--cert", "--key", "--proxy", "-x", "-c", "--cookie-jar", "-T", "--upload-file", "--url-query", "--retry-delay", "--retry-max-time", "--limit-rate", "--compressed-ssh"]);
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
	const headers = (req?.headers ?? []).filter((hd) => hd?.enabled !== false && String(hd?.name ?? "").trim() !== "");
	for (const hd of headers) parts.push(`-H ${shellQuote(`${String(hd.name).trim()}: ${hd.value ?? ""}`)}`);
	const hasCT = headers.some((hd) => String(hd.name).trim().toLowerCase() === "content-type");
	if (bodyType === "raw") {
		if (!hasCT) parts.push(`-H ${shellQuote(`Content-Type: ${SUB_CT[req?.rawSub] ?? "text/plain"}`)}`);
		parts.push(`--data-raw ${shellQuote(req?.body ?? "")}`);
	} else if (bodyType === "form") {
		for (const p of req?.formPairs ?? []) {
			const name = String(p?.name ?? "").trim();
			if (name && p.enabled !== false) parts.push(`--data-urlencode ${shellQuote(`${name}=${p?.value ?? ""}`)}`);
		}
	} else if (bodyType === "multipart") {
		for (const p of req?.formPairs ?? []) {
			const name = String(p?.name ?? "").trim();
			if (name && p.enabled !== false) parts.push(`-F ${shellQuote(`${name}=${p?.value ?? ""}`)}`);
		}
	}
	// One logical flag per line (backslash continuations) once it gets long;
	// parseCurl folds them back, so the output stays re-importable.
	return parts.length <= 2 ? parts.join(" ") : parts.join(" \\\n  ");
}
