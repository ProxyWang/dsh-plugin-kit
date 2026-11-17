/* ---------------- curl wire format: import (parse) and export (serialize) ----------------
 *
 * Pure functions shared by the API tab's "Import curl" and "⧉ copy-as-curl"
 * flows. The two are inverse enough to roundtrip: toCurl output re-imports
 * through parseCurl to the same request (covered by tests).
 *
 * Parser coverage follows curlconverter (the library Bruno's curl importer is
 * built on) for the shapes real "copy as cURL" producers emit: single/double
 * and $'ANSI-C' quoting, backslash line continuations, attached short-flag
 * values (-XPOST, -d'{}'), the -d/--data flag family and --json bodies,
 * -F/--form-string multipart fields, --url-query, and -u / Authorization
 * headers folded into a structured auth section. Consecutive k=v data chunks
 * without a non-form Content-Type import as form pairs, matching Bruno's
 * request view.
 */

export const SUB_CT = { json: "application/json", text: "text/plain", html: "text/html", xml: "application/xml" };

/** Short flags whose value may be attached without a space (`-XPOST`, `-d'{}'`). */
const SHORT_VALUE_FLAGS = "dHXuAebFTomxcwK";
/** Flags that consume the next token as their value but carry no request data. */
const VALUE_FLAGS = new Set([
	"-o", "--output", "--max-time", "-m", "--retry", "--connect-timeout", "-w", "--write-out",
	"--resolve", "--cacert", "--cert", "--key", "--proxy", "-x", "-c", "--cookie-jar", "-T",
	"--upload-file", "--retry-delay", "--retry-max-time", "--limit-rate", "--compressed-ssh",
	"-K", "--config", "--proto", "--max-redirs", "--ciphers", "--max-filesize",
]);

/** $'...' escape table (bash ANSI-C quoting); \xHH is handled separately. */
const ANSI_C_ESCAPES = { n: "\n", t: "\t", r: "\r", a: "\x07", b: "\b", f: "\f", v: "\v", e: "\x1b", "\\": "\\", "'": "'", '"': '"' };

/**
 * Shell-style tokenizer for one curl command line. Handles single quotes
 * (literal), double quotes (backslash escapes + line continuations),
 * $'...' ANSI-C quotes (\n, \t, \xHH …), bare backslash escapes and
 * backslash-newline continuations outside quotes. Exported for tests.
 */
export function tokenizeCurl(input) {
	const joined = String(input ?? "").trim();
	const tokens = [];
	let cur = "";
	let quote = null; // "'" | '"' | "$'"
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
			if (ch === "\\" && quote !== "'") {
				const cont = continuationLen(i);
				if (cont > 0) {
					i += cont - 1;
					continue;
				}
				if (quote === "$'") {
					const esc = joined[i + 1];
					if (esc === "x") {
						const hex = joined.slice(i + 2, i + 4);
						if (/^[0-9a-fA-F]{1,2}$/.test(hex)) {
							const digits = /^[0-9a-fA-F]{2}$/.test(hex) ? 2 : 1;
							cur += String.fromCharCode(parseInt(hex.slice(0, digits), 16));
							i += 1 + digits;
							continue;
						}
					}
					if (esc !== undefined && esc in ANSI_C_ESCAPES) {
						cur += ANSI_C_ESCAPES[esc];
						i += 1;
						continue;
					}
					if (i + 1 < joined.length) cur += joined[++i];
					continue;
				}
				// double quotes: backslash escapes the next char
				if (i + 1 < joined.length) {
					cur += joined[++i];
					continue;
				}
				continue;
			}
			if (ch === quote[quote.length - 1]) {
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
		if (ch === "$" && joined[i + 1] === "'") {
			quote = "$'";
			started = true;
			i += 1;
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
	return tokens;
}

const ATTACHED_SHORT_RE = new RegExp(`^-([${SHORT_VALUE_FLAGS}])(.+)$`, "s");
const ATTACHED_LONG_RE = /^--([A-Za-z0-9-]+)=([\s\S]*)$/;

/**
 * Split values attached to their flag into separate tokens: `-XPOST` →
 * `-X POST`, `-d'{}'` (already unquoted by the tokenizer) → `-d {}`, and
 * `--header=A: b` → `--header` `A: b`. Only single-char flags that take a
 * value are split, so boolean clusters like `-sS` pass through untouched.
 * Exported for tests.
 */
export function expandShortFlags(tokens) {
	const out = [];
	for (const token of tokens) {
		const short = ATTACHED_SHORT_RE.exec(token);
		if (short) {
			out.push(`-${short[1]}`, short[2]);
			continue;
		}
		const long = ATTACHED_LONG_RE.exec(token);
		if (long) out.push(`--${long[1]}`, long[2]);
		else out.push(token);
	}
	return out;
}

function decodeFormBody(joined) {
	const pairs = [];
	for (const [name, value] of new URLSearchParams(joined)) pairs.push({ name, value });
	return pairs;
}

/**
 * Parse a (possibly multi-line, backslash-continued) curl command into
 * {method, url, headers:[{name,value}], body, multipart?, form?, auth?}.
 * Supports -X/--request, -H/--header (including curl's empty `Name;` form),
 * the -d/--data family and --json, -F/--form/--form-string (multipart
 * fields), --url-query, -u/--user and Authorization headers (folded into
 * `auth`), -A/-e/-b (UA/Referer/Cookie), -I/--head, -G/--get (data becomes
 * query), --url, and ignores common noise flags.
 */
export function parseCurl(input) {
	const tokens = expandShortFlags(tokenizeCurl(input));

	let method = "";
	let url = "";
	let body = "";
	let hasBody = false;
	let asQuery = false;
	let userPass = null; // from -u; only used when no explicit Authorization header
	let hasJson = false;
	const headers = [];
	const form = [];
	const dataChunks = [];
	const urlQueries = [];
	const setHeader = (name, value) => {
		const existing = headers.find((hd) => hd.name.toLowerCase() === name.toLowerCase());
		if (existing) existing.value = value;
		else headers.push({ name, value });
	};
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
			else if (hv.endsWith(";")) setHeader(hv.slice(0, -1).trim(), ""); // curl's empty-header form
			continue;
		}
		if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--data-ascii") {
			dataChunks.push(next());
			hasBody = true;
			continue;
		}
		if (t === "--data-urlencode") {
			// curl encodes only the content part at send time; the argument is
			// plain text, so it joins the data chunks verbatim.
			dataChunks.push(next());
			hasBody = true;
			continue;
		}
		if (t === "--json") {
			dataChunks.push(next());
			hasBody = true;
			hasJson = true;
			setHeader("Content-Type", "application/json");
			continue;
		}
		if (t === "-F" || t === "--form" || t === "--form-string") {
			form.push(next());
			hasBody = true;
			continue;
		}
		if (t === "--url-query") {
			urlQueries.push(next());
			continue;
		}
		if (t === "-u" || t === "--user") {
			userPass = next();
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
	body = dataChunks.join("&");

	// -G/--get moves the data into the query string; --url-query always does.
	if (asQuery && body !== "") {
		url = url + (url.includes("?") ? "&" : "?") + body;
		body = "";
		hasBody = false;
	}
	for (const q of urlQueries) {
		url = url + (url.includes("?") ? "&" : "?") + q;
	}

	// Auth section (Bruno-style): an explicit Authorization header wins over
	// -u, and Bearer/Basic values fold into the structured section instead of
	// staying raw header rows. Undecodable values stay headers.
	let auth;
	const authAt = headers.findIndex((hd) => hd.name.toLowerCase() === "authorization");
	if (authAt >= 0) {
		const value = String(headers[authAt].value ?? "");
		const bearer = /^Bearer\s+(.+)$/i.exec(value);
		const basic = /^Basic\s+\S+$/i.test(value) ? decodeBasicValue(value) : null;
		if (bearer) {
			auth = { mode: "bearer", token: bearer[1].trim() };
			headers.splice(authAt, 1);
		} else if (basic) {
			auth = { mode: "basic", user: basic.user, pass: basic.pass };
			headers.splice(authAt, 1);
		}
	} else if (userPass !== null) {
		const at = userPass.indexOf(":");
		auth = at >= 0 ? { mode: "basic", user: userPass.slice(0, at), pass: userPass.slice(at + 1) } : { mode: "basic", user: userPass, pass: "" };
	}

	// Body shaping: multipart fields win; otherwise k=v data without a
	// non-form Content-Type imports as form pairs (Bruno shows these in its
	// form body editor), and everything else stays a raw body.
	let multipart = null;
	let formPairs = null;
	if (form.length > 0) {
		// -F entries are multipart fields: split on the first "=" and keep the
		// raw value (including "@file" markers, which stay visible as text).
		multipart = form.map((f) => {
			const eq = f.indexOf("=");
			return eq > 0 ? { name: f.slice(0, eq), value: f.slice(eq + 1) } : { name: f, value: "" };
		});
		body = "";
	} else if (body !== "") {
		const ct = headers.find((hd) => hd.name.toLowerCase() === "content-type")?.value ?? "";
		const isFormCt = /x-www-form-urlencoded/i.test(ct);
		const looksForm = !hasJson && dataChunks.every((chunk) => /^[^=&]+=/.test(chunk));
		if (isFormCt || (!ct && looksForm)) {
			formPairs = decodeFormBody(body);
			body = "";
		}
	}
	if (hasBody && method === "") method = "POST";
	if (method === "") method = "GET";
	const result = { method, url, headers, body };
	if (multipart) result.multipart = multipart;
	if (formPairs) result.form = formPairs;
	if (auth) result.auth = auth;
	return result;
}

/** UTF-8-safe base64 decode of `Basic <b64>` → {user, pass}, or null. */
function decodeBasicValue(value) {
	try {
		const plain = decodeURIComponent(escape(atob(String(value).replace(/^Basic\s+/i, "").trim())));
		const at = plain.indexOf(":");
		if (at < 0) return null;
		return { user: plain.slice(0, at), pass: plain.slice(at + 1) };
	} catch {
		return null;
	}
}

/** POSIX single-quote escaping; embedded ' becomes '\'' — safe for any shell. */
export function shellQuote(s) {
	return `'${String(s).replace(/'/g, "'\\''")}'`;
}

/**
 * Serialize the current request back to a curl command (Postman's "Copy as
 * curl", Bruno's curl codegen). Output uses backslash line continuations and
 * stays re-importable by parseCurl. Content-Type implied by the body mode is
 * emitted explicitly when the user has not set one, matching what send() does
 * on the wire; the auth section becomes -u (basic) or an Authorization header
 * (bearer), exactly the shapes parseCurl folds back into `auth`.
 */
export function toCurl(req) {
	const parts = ["curl"];
	const method = String(req?.method || "GET").toUpperCase();
	const bodyType = req?.bodyType || "none";
	if (method !== "GET" || bodyType !== "none") parts.push(`-X ${method}`);
	parts.push(shellQuote(String(req?.url ?? "")));
	const auth = req?.auth && typeof req.auth === "object" ? req.auth : null;
	if (auth?.mode === "basic" && (String(auth.user ?? "") !== "" || String(auth.pass ?? "") !== "")) {
		parts.push(`-u ${shellQuote(`${auth.user ?? ""}:${auth.pass ?? ""}`)}`);
	}
	let headers = (req?.headers ?? []).filter((hd) => hd?.enabled !== false && String(hd?.name ?? "").trim() !== "");
	if (auth?.mode === "bearer" && String(auth.token ?? "").trim() !== "") {
		headers = [...headers.filter((hd) => String(hd.name).trim().toLowerCase() !== "authorization"), { name: "Authorization", value: `Bearer ${String(auth.token).trim()}` }];
	}
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
