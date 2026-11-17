/* ---------------- Bruno .bru collection interop (plain text, Git-friendly) ----------------
 *
 * Bruno stores every request as a `.bru` plain-text file inside the collection
 * directory, which is what makes its collections Git-friendly. This module
 * speaks a compatible subset of the v2 grammar (packages/bruno-lang) so
 * requests can move between this toolbox and a real Bruno collection:
 *
 *   meta { name, type }            <method> { url, body, auth }
 *   params:query { k: v, ~off: v } params:path { id: 7 }
 *   headers { K: V, ~Off: V }      auth:basic { username, password } / auth:bearer { token }
 *   body:<mode> { …raw… }          modes: json | text | xml | form-urlencoded | multipart-form | none
 *
 * Disabled rows use Bruno's `~` prefix; keys with spaces/colons/quotes/braces
 * are quoted with backslash escapes. Values are single-line (newlines fold to
 * spaces, matching the line-based format).
 */

const BODY_MODES = { json: "json", text: "text", xml: "xml", html: "text", form: "form-urlencoded", multipart: "multipart-form", none: "none" };
const MODE_TO_BODY = { json: ["raw", "json"], text: ["raw", "text"], xml: ["raw", "xml"], "form-urlencoded": ["form", null], "multipart-form": ["multipart", null], none: ["none", null] };
const METHOD_RE = /^(get|post|put|patch|delete|head|options)$/i;

function quoteKey(name) {
	const raw = String(name ?? "");
	if (raw === "" || /[\s":{}~]/.test(raw)) return JSON.stringify(raw);
	return raw;
}

function oneLine(value) {
	return String(value ?? "").replace(/\r?\n/g, " ");
}

function rowsBlock(title, rows) {
	const active = (rows ?? []).filter((r) => r && String(r.name ?? "").trim() !== "");
	if (active.length === 0) return [];
	const lines = [`${title} {`];
	for (const r of active) lines.push(`  ${r.enabled === false ? "~" : ""}${quoteKey(r.name)}: ${oneLine(r.value)}`);
	lines.push("}");
	return lines;
}

/** Derive a collection-friendly request name from the URL path. */
export function bruNameFor(url, method) {
	const noScheme = String(url ?? "").replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
	const pathPart = noScheme.includes("/") ? noScheme.slice(noScheme.indexOf("/")) : "/";
	const seg = pathPart.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() ?? "";
	const clean = seg.replace(/\.[a-z0-9]+$/i, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
	if (clean !== "") return clean;
	return String(method || "request").toLowerCase();
}

/**
 * Serialize editor state into a v2 `.bru` document. Templates ({{var}}) are
 * kept verbatim so the file stays environment-agnostic, exactly like Bruno's
 * own request files.
 */
export function requestToBru(state) {
	const method = String(state?.method || "GET").toLowerCase();
	const bodyType = state?.bodyType || "none";
	const mode = BODY_MODES[bodyType === "raw" ? (state?.rawSub ?? "json") : bodyType] ?? "none";
	const authMode = state?.auth?.mode === "basic" || state?.auth?.mode === "bearer" ? state.auth.mode : "none";
	const queryRows = (state?.paramPairs ?? []).filter((p) => p?.kind !== "path");
	const pathRows = (state?.paramPairs ?? []).filter((p) => p?.kind === "path");
	const lines = [
		"meta {",
		`  name: ${oneLine(bruNameFor(state?.url, method))}`,
		"  type: http",
		"}",
		"",
		`${method} {`,
		`  url: ${oneLine(state?.url ?? "")}`,
		`  body: ${mode}`,
		`  auth: ${authMode}`,
		"}",
	];
	const push = (block) => {
		if (block.length === 0) return;
		lines.push("", ...block);
	};
	push(rowsBlock("params:query", queryRows));
	push(rowsBlock("params:path", pathRows));
	push(rowsBlock("headers", state?.headers));
	if (authMode === "bearer") push(["", "auth:bearer {", `  token: ${oneLine(state?.auth?.token)}`, "}"]);
	if (authMode === "basic") push(["", "auth:basic {", `  username: ${oneLine(state?.auth?.user)}`, `  password: ${oneLine(state?.auth?.pass)}`, "}"]);
	if (mode === "form-urlencoded" || mode === "multipart-form") {
		push(rowsBlock(`body:${mode}`, state?.formPairs));
	} else if (mode !== "none" && String(state?.body ?? "") !== "") {
		// Bruno indents body content by two spaces (a column-0 `}` ends the
		// block in the grammar) and outdents it again when parsing.
		push(["", `body:${mode} {`, String(state.body).split("\n").map((line) => (line === "" ? "" : `  ${line}`)).join("\n"), "}"]);
	}
	return `${lines.join("\n")}\n`;
}

/** Cheap detector used by the import dialog to choose the parser. */
export function looksLikeBru(text) {
	const head = String(text ?? "").trimStart();
	return /^\s*meta\s*\{/m.test(head) || /^\s*(get|post|put|patch|delete|head|options)\s*\{/im.test(head);
}

function parseRow(line) {
	const m = /^(~?)("((?:[^"\\]|\\.)*)"|[^:]+):\s?(.*)$/.exec(line);
	if (!m) return null;
	const enabled = m[1] !== "~";
	const name = m[2].startsWith('"') ? JSON.parse(m[2]) : m[2].trim();
	return { name, value: m[4] ?? "", enabled, description: "", kind: "query" };
}

/**
 * Parse a v2 `.bru` document into editor state ({name, method, url, headers,
 * paramPairs, bodyType, rawSub, body, formPairs, auth}). Unknown blocks are
 * skipped so files written by newer Bruno versions still import.
 */
export function parseBru(text) {
	const out = {
		name: "", method: "GET", url: "", headers: [], paramPairs: [],
		bodyType: "none", rawSub: "json", body: "", formPairs: [],
		auth: { mode: "none", token: "", user: "", pass: "" },
	};
	const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
	let i = 0;
	const readBlock = (onLine) => {
		i++;
		for (; i < lines.length; i++) {
			const line = lines[i];
			// Bruno's grammar ends a block at a column-0 `}` (tagend = nl "}"),
			// which is why serialized body content is indented.
			if (line === "}") {
				i++;
				return;
			}
			onLine(line);
		}
	};
	const kv = (line) => {
		const at = line.indexOf(":");
		return at < 0 ? null : [line.slice(0, at).trim(), line.slice(at + 1).trim()];
	};
	for (; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line === "" || line.startsWith("#")) continue;
		if (line === "meta {") {
			readBlock((inner) => {
				const pair = kv(inner.trim());
				if (pair?.[0] === "name") out.name = pair[1];
			});
			continue;
		}
		const methodBlock = METHOD_RE.exec(line.replace(/\s*\{$/, ""));
		if (methodBlock && line.endsWith("{")) {
			out.method = methodBlock[1].toUpperCase();
			readBlock((inner) => {
				const pair = kv(inner.trim());
				if (!pair) return;
				if (pair[0] === "url") out.url = pair[1];
				if (pair[0] === "body" && MODE_TO_BODY[pair[1]]) {
					const [bodyType, rawSub] = MODE_TO_BODY[pair[1]];
					out.bodyType = bodyType;
					if (rawSub) out.rawSub = rawSub;
				}
				if (pair[0] === "auth" && (pair[1] === "basic" || pair[1] === "bearer")) out.auth.mode = pair[1];
			});
			continue;
		}
		if (line === "params:query {" || line === "params:path {") {
			const kind = line.startsWith("params:query") ? "query" : "path";
			readBlock((inner) => {
				const row = parseRow(inner.trim());
				if (row) out.paramPairs.push({ ...row, kind });
			});
			continue;
		}
		if (line === "headers {") {
			readBlock((inner) => {
				const row = parseRow(inner.trim());
				if (row) out.headers.push({ name: row.name, value: row.value, enabled: row.enabled, description: "" });
			});
			continue;
		}
		if (line === "auth:bearer {") {
			readBlock((inner) => {
				const pair = kv(inner.trim());
				if (pair?.[0] === "token") {
					out.auth.mode = "bearer";
					out.auth.token = pair[1];
				}
			});
			continue;
		}
		if (line === "auth:basic {") {
			readBlock((inner) => {
				const pair = kv(inner.trim());
				if (pair?.[0] === "username") {
					out.auth.mode = "basic";
					out.auth.user = pair[1];
				}
				if (pair?.[0] === "password") {
					out.auth.mode = "basic";
					out.auth.pass = pair[1];
				}
			});
			continue;
		}
		const bodyBlock = /^body:([\w-]+)\s*\{$/.exec(line);
		if (bodyBlock) {
			const mode = bodyBlock[1];
			const raw = [];
			readBlock((inner) => {
				if (MODE_TO_BODY[mode]) raw.push(inner);
			});
			if (!MODE_TO_BODY[mode]) continue;
			const [bodyType, rawSub] = MODE_TO_BODY[mode];
			if (bodyType === "raw") {
				out.bodyType = "raw";
				if (rawSub) out.rawSub = rawSub;
				// outdentString: strip the two-space serializer indent per line
				out.body = raw.map((line) => (line.startsWith("  ") ? line.slice(2) : line)).join("\n");
			} else if (bodyType === "form" || bodyType === "multipart") {
				out.bodyType = bodyType;
				for (const inner of raw) {
					const row = parseRow(inner.trim());
					if (row) out.formPairs.push({ name: row.name, value: row.value, enabled: row.enabled, description: "" });
				}
			}
			continue;
		}
		if (line.endsWith("{")) {
			readBlock(() => {}); // unknown block: skip
		}
	}
	return out;
}
