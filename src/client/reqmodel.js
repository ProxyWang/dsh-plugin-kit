/* ---------------- request model: pure state logic for the API tester ----------------
 *
 * Bruno-style layering: the React component (apiclient.js) only wires UI and
 * persistence, while every transformation of request data lives here as a
 * pure, individually testable function:
 *
 * - URL ↔ query-params sync — Bruno/Postman treat the URL bar and the Params
 *   table as two projections of one query string. Typing in the URL updates
 *   the table; editing the table rebuilds the URL. The two directions run in
 *   separate event handlers, never in an effect, so they cannot ping-pong.
 * - Environments — Bruno keeps named variable sets with an active selector and
 *   an explicit "No Environment" state. The store below is the persisted shape
 *   plus pure mutators; the legacy flat variable array migrates on load.
 * - Auth — Bruno's Auth section (Bearer / Basic) generates the wire header at
 *   send time instead of forcing users to hand-write `Authorization`.
 * - resolveRequest — the single place that turns editor state + environment
 *   into the exact payload the host sends, so the Timeline view, code snippet
 *   generators and the wire request can never disagree.
 */

import { SUB_CT } from "./curl.js";

/* ================================ variables ================================ */

/** Replace {{name}} from envMap; unknown names stay literal (Postman/Bruno semantics). */
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

/* ============================ URL ↔ params sync ============================ */

/** Split a URL into {base, query, fragment} at the first `?` and `#`. */
export function splitUrl(url) {
	const raw = String(url ?? "");
	const hAt = raw.indexOf("#");
	const fragment = hAt >= 0 ? raw.slice(hAt) : "";
	const work = hAt >= 0 ? raw.slice(0, hAt) : raw;
	const qAt = work.indexOf("?");
	return { base: qAt >= 0 ? work.slice(0, qAt) : work, query: qAt >= 0 ? work.slice(qAt + 1) : "", fragment };
}

/** Decode a query string into ordered rows; duplicate names stay separate rows. */
export function parseQueryPairs(query) {
	const rows = [];
	for (const [name, value] of new URLSearchParams(String(query ?? ""))) rows.push({ name, value });
	return rows;
}

/** Serialize active query rows into a query string (no leading `?`); duplicates are kept. */
export function buildQuery(pairs) {
	const params = new URLSearchParams();
	for (const p of pairs ?? []) {
		const name = String(p?.name ?? "").trim();
		if (name && p.enabled !== false && (p.kind ?? "query") === "query") params.append(name, String(p?.value ?? ""));
	}
	return params.toString();
}

/**
 * `:name` segments of the URL path, in order (Bruno path params). The URL bar
 * keeps them literal; enabled rows substitute into the wire URL at send time.
 */
export function parsePathParams(url) {
	const names = [];
	for (const segment of splitUrl(url).base.split("/")) {
		if (segment.startsWith(":") && segment.length > 1) names.push(segment.slice(1));
	}
	return names;
}

/**
 * URL → table direction of the sync, following Bruno's collections reducer:
 * enabled query rows mirror the URL query exactly (descriptions of same-named
 * previous rows carry over), `:name` path segments become path rows (existing
 * rows keep their values, new ones start empty, vanished segments drop), and
 * disabled query rows SURVIVE the URL edit so re-enabling them is one click.
 * Result order: query rows, path rows, retained disabled rows.
 */
export function syncParamsFromUrl(url, prevPairs) {
	const prev = (Array.isArray(prevPairs) ? prevPairs : []).filter((p) => p && String(p.name ?? "").trim() !== "");
	const isPath = (p) => p.kind === "path";
	const enabledPool = prev.filter((p) => !isPath(p) && p.enabled !== false);
	const disabledPool = prev.filter((p) => !isPath(p) && p.enabled === false);
	const used = new Set();
	const queryRows = parseQueryPairs(splitUrl(url).query).map((row) => {
		const at = enabledPool.findIndex((p, i) => !used.has(i) && String(p.name).trim() === row.name);
		let description = "";
		if (at >= 0) {
			used.add(at);
			description = enabledPool[at].description ?? "";
		}
		return { ...row, enabled: true, description, kind: "query" };
	});
	const prevPath = prev.filter(isPath);
	const pathRows = parsePathParams(url).map((name) => {
		const existing = prevPath.find((p) => String(p.name).trim() === name);
		return existing ? { ...existing, enabled: existing.enabled !== false, kind: "path" } : { name, value: "", enabled: true, description: "", kind: "path" };
	});
	return [...queryRows, ...pathRows, ...disabledPool.map((p) => ({ name: String(p.name), value: String(p.value ?? ""), description: String(p.description ?? ""), ...(p.enabled === false ? { enabled: false } : {}), kind: "query" }))];
}

/**
 * Table → URL direction of the sync: rebuild the query from active query rows,
 * preserving base (including `:name` segments) and #fragment. Disabled and
 * nameless rows stay in the table (their values survive in drafts/history) but
 * leave the URL.
 */
export function applyParamsToUrl(url, pairs) {
	const { base, fragment } = splitUrl(url);
	const qs = buildQuery(pairs);
	return `${base}${qs ? `?${qs}` : ""}${fragment}`;
}

/**
 * Substitute enabled path-param rows into `:name` segments (URL-encoded);
 * segments without a resolvable row stay literal, exactly like Bruno's
 * interpolateUrlPathParams. The editor URL is never rewritten this way — only
 * the wire URL at send time.
 */
export function substitutePathParams(url, pairs) {
	const raw = String(url ?? "");
	const rows = (pairs ?? []).filter((p) => p?.kind === "path" && p.enabled !== false && String(p?.name ?? "").trim() !== "" && String(p?.value ?? "") !== "");
	if (rows.length === 0 || !raw.includes("/:")) return raw;
	return raw.split("/").map((segment) => {
		if (!segment.startsWith(":")) return segment;
		const row = rows.find((p) => String(p.name).trim() === segment.slice(1));
		return row ? encodeURIComponent(String(row.value)) : segment;
	}).join("/");
}

/**
 * Merge query-param pairs into a URL (legacy send-time semantics, kept for
 * normalizing snapshots saved before the two-way sync existed): table entries
 * override same-named params already in the URL, other existing params
 * survive, empty values send `name=`, and a #fragment is preserved.
 */
export function mergeParams(url, pairs) {
	const raw = String(url ?? "");
	const active = (pairs ?? []).filter((p) => p?.enabled !== false && String(p?.name ?? "").trim() !== "");
	if (active.length === 0) return raw;
	const { base, fragment } = splitUrl(raw);
	const params = new URLSearchParams(splitUrl(raw).query);
	for (const p of active) params.set(String(p.name).trim(), String(p.value ?? ""));
	const qs = params.toString();
	return `${base}${qs ? `?${qs}` : ""}${fragment}`;
}

/**
 * Normalize a persisted {url, paramPairs} snapshot (draft, history row or
 * favorite) onto the sync invariant "the URL carries the full query, the table
 * mirrors it". Snapshots saved by older versions had pairs merged only at send
 * time, so merge first and re-project the table from the result.
 */
export function normalizeUrlParams(url, pairs) {
	const merged = mergeParams(String(url ?? ""), Array.isArray(pairs) ? pairs : []);
	return { url: merged, pairs: syncParamsFromUrl(merged, pairs) };
}

/* ================================ environments ================================
 * Persisted shape (localStorage, JSON):
 *   { envs: [{ id, name, vars: [{name, value, description?, enabled?}] }], activeId: string|null }
 * activeId null is Bruno's "No Environment": placeholders stay literal.
 * The legacy shape was a bare vars array; it migrates into one active "Default"
 * environment so existing variables keep working.
 */

export const DEFAULT_ENV_ID = "env-default";

function sanitizeVars(vars) {
	return (Array.isArray(vars) ? vars : [])
		.filter((v) => v && typeof v === "object")
		.map((v) => ({ name: String(v.name ?? ""), value: String(v.value ?? ""), description: String(v.description ?? ""), ...(v.enabled === false ? { enabled: false } : {}) }));
}

function sanitizeEnv(env, fallbackId) {
	if (!env || typeof env !== "object") return null;
	const id = typeof env.id === "string" && env.id !== "" ? env.id : fallbackId;
	const name = typeof env.name === "string" && env.name.trim() !== "" ? env.name.trim() : "Environment";
	return { id, name, vars: sanitizeVars(env.vars) };
}

/** Parsed-JSON → valid store; migrates the legacy flat-array shape. Exported for tests. */
export function normalizeEnvStore(raw) {
	if (Array.isArray(raw)) {
		const vars = sanitizeVars(raw);
		if (vars.length === 0) return { envs: [], activeId: null };
		return { envs: [{ id: DEFAULT_ENV_ID, name: "Default", vars }], activeId: DEFAULT_ENV_ID };
	}
	if (raw && typeof raw === "object" && Array.isArray(raw.envs)) {
		const envs = raw.envs.map((env, i) => sanitizeEnv(env, `env-${i + 1}`)).filter(Boolean);
		const ids = new Set(envs.map((e) => e.id));
		const activeId = typeof raw.activeId === "string" && ids.has(raw.activeId) ? raw.activeId : null;
		return { envs, activeId };
	}
	return { envs: [], activeId: null };
}

export function emptyEnvStore() {
	return { envs: [], activeId: null };
}

/** The active environment object, or null for "No Environment". */
export function activeEnvOf(store) {
	if (!store || typeof store.activeId !== "string") return null;
	return (store.envs ?? []).find((e) => e.id === store.activeId) ?? null;
}

/** Variable map for sending: the active environment's vars, or {} when none. */
export function envMapOf(store) {
	return buildEnvMap(activeEnvOf(store)?.vars);
}

/** Local-id generator; tests pass explicit ids to stay deterministic. */
export function newEnvId() {
	return `env-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextName(store) {
	let n = (store.envs ?? []).length + 1;
	const names = new Set((store.envs ?? []).map((e) => e.name));
	while (names.has(`Environment ${n}`)) n++;
	return `Environment ${n}`;
}

/** Append a new environment and make it active (Bruno activates what you create). */
export function addEnv(store, { name, id } = {}) {
	const base = store ?? emptyEnvStore();
	const env = { id: typeof id === "string" && id !== "" ? id : newEnvId(), name: typeof name === "string" && name.trim() !== "" ? name.trim() : nextName(base), vars: [] };
	return { envs: [...(base.envs ?? []), env], activeId: env.id };
}

export function renameEnv(store, id, name) {
	const clean = typeof name === "string" ? name.trim() : "";
	if (clean === "") return store;
	return { ...store, envs: (store?.envs ?? []).map((e) => (e.id === id ? { ...e, name: clean } : e)) };
}

/** Remove an environment; removing the active one falls back to "No Environment". */
export function removeEnv(store, id) {
	const envs = (store?.envs ?? []).filter((e) => e.id !== id);
	return { envs, activeId: store?.activeId === id ? null : store?.activeId ?? null };
}

/** Select the active environment; id null selects "No Environment". */
export function selectEnv(store, id) {
	const wanted = typeof id === "string" && id !== "" ? id : null;
	if (wanted !== null && !(store?.envs ?? []).some((e) => e.id === wanted)) return store;
	return { ...store, activeId: wanted };
}

/** Replace one environment's variable rows (the Vars tab editor). */
export function setEnvVars(store, id, vars) {
	return { ...store, envs: (store?.envs ?? []).map((e) => (e.id === id ? { ...e, vars: sanitizeVars(vars) } : e)) };
}

/* =================================== auth ===================================
 * Auth state shape: { mode: "none"|"bearer"|"basic", token, user, pass }.
 * Like Bruno, the section generates the Authorization header at send time;
 * a configured section overrides any hand-written Authorization header.
 */

export const AUTH_MODES = ["none", "bearer", "basic"];

/** Coerce arbitrary input (draft JSON, curl import, history) into auth state. */
export function normalizeAuth(raw) {
	const mode = AUTH_MODES.includes(raw?.mode) ? raw.mode : "none";
	return {
		mode,
		token: typeof raw?.token === "string" ? raw.token : "",
		user: typeof raw?.user === "string" ? raw.user : "",
		pass: typeof raw?.pass === "string" ? raw.pass : "",
	};
}

function base64Encode(text) {
	return btoa(unescape(encodeURIComponent(String(text))));
}

function base64Decode(text) {
	return decodeURIComponent(escape(atob(String(text))));
}

/** `user:pass` → "Basic <base64>" (UTF-8 safe). */
export function basicAuthValue(user, pass) {
	return `Basic ${base64Encode(`${user ?? ""}:${pass ?? ""}`)}`;
}

/** "Basic <base64>" → {user, pass}, or null when the value is not decodable. */
export function decodeBasicAuth(value) {
	const m = /^Basic\s+(.+)$/i.exec(String(value ?? "").trim());
	if (!m) return null;
	try {
		const plain = base64Decode(m[1].trim());
		const at = plain.indexOf(":");
		if (at < 0) return null;
		return { user: plain.slice(0, at), pass: plain.slice(at + 1) };
	} catch {
		return null;
	}
}

/** The header rows the auth section contributes (empty for "none" or blank values). */
export function authHeaders(auth) {
	if (auth?.mode === "bearer" && String(auth.token ?? "").trim() !== "") {
		return [{ name: "Authorization", value: `Bearer ${String(auth.token).trim()}` }];
	}
	if (auth?.mode === "basic" && (String(auth.user ?? "") !== "" || String(auth.pass ?? "") !== "")) {
		return [{ name: "Authorization", value: basicAuthValue(auth.user, auth.pass) }];
	}
	return [];
}

/**
 * Fold auth into final headers: a configured section replaces any manual
 * Authorization header (one authoritative source on the wire). Mode "none"
 * leaves the table untouched.
 */
export function applyAuth(headers, auth) {
	const generated = authHeaders(auth);
	if (generated.length === 0) return headers;
	return [...headers.filter((hd) => hd.name.toLowerCase() !== "authorization"), ...generated];
}

/* =============================== send resolution =============================== */

/**
 * Pick the raw-body sub-type (json/text/html/xml) for an imported request,
 * the way Bruno detects the body language: an explicit Content-Type wins,
 * then a cheap shape probe, defaulting to plain text.
 */
export function guessRawSubType(headers, body) {
	const ct = String((headers ?? []).find((hd) => String(hd?.name ?? "").toLowerCase() === "content-type")?.value ?? "");
	if (/json/i.test(ct)) return "json";
	if (/xml/i.test(ct)) return "xml";
	if (/html/i.test(ct)) return "html";
	if (/^text\/plain/i.test(ct)) return "text";
	const text = String(body ?? "").trim();
	if (text.startsWith("{") || text.startsWith("[")) {
		try {
			JSON.parse(text);
			return "json";
		} catch { /* not JSON after all */ }
	}
	if (/^<\?xml/i.test(text)) return "xml";
	if (/^<!doctype html>/i.test(text)) return "html";
	return "text";
}

function activePairs(pairs) {
	return (pairs ?? []).filter((p) => p?.enabled !== false && String(p?.name ?? "").trim() !== "");
}

function upsertHeader(list, name, value) {
	const found = list.find((hd) => hd.name.toLowerCase() === name.toLowerCase());
	if (found) found.value = value;
	else list.push({ name, value });
}

/**
 * Editor state + environment → the exact request the host will send:
 * { method, url, headers, body?, multipart?, timeoutMs? }.
 *
 * `state.url` is expected to already carry the synced query string (see
 * syncParamsFromUrl / applyParamsToUrl); {{var}} placeholders resolve here for
 * URL, header values and body. The result doubles as the Timeline record and
 * as input for the code snippet generators, so what you see is what was sent.
 */
export function resolveRequest(state, envMap) {
	const env = envMap ?? {};
	const method = String(state?.method || "GET").toUpperCase();
	// Path params (`:name`) substitute into the wire URL only; the editor URL
	// keeps them literal (Bruno). {{var}} placeholders resolve afterwards.
	const url = substituteVars(substitutePathParams(String(state?.url ?? "").trim(), state?.paramPairs), env);
	const headers = (state?.headers ?? [])
		.filter((hd) => hd?.enabled !== false && String(hd?.name ?? "").trim() !== "")
		.map((hd) => ({ name: String(hd.name).trim(), value: substituteVars(String(hd.value ?? ""), env) }));
	let body;
	let multipart;
	const bodyType = state?.bodyType || "none";
	if (bodyType === "raw") {
		body = substituteVars(String(state?.body ?? ""), env);
		upsertHeader(headers, "Content-Type", SUB_CT[state?.rawSub] ?? "text/plain");
	} else if (bodyType === "form") {
		body = new URLSearchParams(activePairs(state?.formPairs)
			.map((p) => [String(p.name).trim(), substituteVars(String(p.value ?? ""), env)])).toString();
		upsertHeader(headers, "Content-Type", "application/x-www-form-urlencoded");
	} else if (bodyType === "multipart") {
		multipart = activePairs(state?.formPairs)
			.map((p) => ({ name: String(p.name).trim(), value: substituteVars(String(p.value ?? ""), env) }));
	}
	const timeoutMs = Number.isFinite(state?.timeoutMs) && state.timeoutMs > 0 ? state.timeoutMs : undefined;
	return {
		method,
		url,
		headers: applyAuth(headers, normalizeAuth(state?.auth)),
		...(body !== undefined ? { body } : {}),
		...(multipart ? { multipart } : {}),
		...(timeoutMs !== undefined ? { timeoutMs } : {}),
	};
}

/* ============================== history lists ============================== */

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

/** Newest-first insert, deduped by id, capped. Pure for testability. */
export function pushEntry(list, entry, cap) {
	const base = Array.isArray(list) ? list.filter((e) => e && e.id !== entry.id) : [];
	return [entry, ...base].slice(0, cap);
}

/* ============================== post-response extracts ============================== */

/**
 * Read a dotted JSONPath-lite expression out of a decoded JSON body:
 * `data.items[0].id`, `meta["x.y"]`. Brackets only index arrays or quote
 * keys; there is no wildcard/slice engine here on purpose — extracts feed
 * the next request, they are not a query language.
 */
export function jsonPath(value, expr) {
	const src = String(expr ?? "").trim().replace(/^\$\.?/, "");
	if (src === "") return void 0;
	let cur = value;
	let i = 0;
	const readKey = (name) => {
		if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return false;
		if (!Object.hasOwn(cur, name)) return false;
		cur = cur[name];
		return true;
	};
	while (i < src.length) {
		if (src.charCodeAt(i) === 46 /* . */) i++;
		const dot = src.indexOf(".", i);
		const brack = src.indexOf("[", i);
		const segEnd = dot === -1 ? (brack === -1 ? src.length : brack) : brack === -1 ? dot : Math.min(dot, brack);
		if (segEnd > i) {
			const key = src.slice(i, segEnd);
			if (!readKey(key)) return void 0;
			i = segEnd;
			continue;
		}
		if (src.charCodeAt(i) !== 91 /* [ */) return void 0;
		const close = src.indexOf("]", i);
		if (close === -1) return void 0;
		const inner = src.slice(i + 1, close).trim();
		if (inner.startsWith('"') || inner.startsWith("'")) {
			if (!readKey(inner.slice(1, -1))) return void 0;
		} else if (/^\d+$/.test(inner)) {
			if (!Array.isArray(cur) || Number(inner) >= cur.length) return void 0;
			cur = cur[Number(inner)];
		} else {
			return void 0;
		}
		i = close + 1;
	}
	return cur;
}

/**
 * Run one extract rule against a settled response. Returns the resolved
 * string value, or undefined when the rule misses (header absent, JSONPath
 * not found, regex without a group).
 */
export function runExtract(rule, response, resolvedRequest) {
	if (!rule) return void 0;
	const source = rule.source ?? "json";
	// status needs no expression; everything else does.
	if (source !== "status" && !rule.expr) return void 0;
	if (source === "status") return String(response?.status ?? "");
	if (source === "header") {
		const list = response?.headers ?? [];
		const want = String(rule.expr).toLowerCase();
		const hit = list.find(([k]) => String(k).toLowerCase() === want);
		return hit ? String(hit[1]) : void 0;
	}
	if (source === "body") return response?.text ?? void 0;
	if (source === "regex") {
		try {
			const re = new RegExp(rule.expr, "m");
			const m = re.exec(response?.text ?? "");
			if (!m) return void 0;
			return m[1] ?? m[0];
		} catch {
			return void 0;
		}
	}
	if (source === "query") {
		// extract from the REQUEST wire url's query — e.g. a redirect token
		try {
			const u = new URL(resolvedRequest?.url ?? "", "http://example.invalid");
			const v = u.searchParams.get(rule.expr);
			return v === null ? void 0 : v;
		} catch {
			return void 0;
		}
	}
	// json (default): parse the body then walk the path
	let parsed;
	try {
		parsed = JSON.parse(response?.text ?? "");
	} catch {
		return void 0;
	}
	const found = jsonPath(parsed, rule.expr);
	if (found === void 0 || found === null) return void 0;
	return typeof found === "object" ? JSON.stringify(found) : String(found);
}

/**
 * Apply all enabled extracts of a request to the env store after a send.
 * Returns {store, applied:[{name,value}], missed:[names]} — callers persist
 * `store` only when something applied, and the UI reports misses without
 * writing half-baked variables.
 */
export function applyExtracts(extracts, response, resolvedRequest, store) {
	const rules = (Array.isArray(extracts) ? extracts : []).filter((r) => r && r.enabled !== false && String(r.name ?? "").trim() && String(r.expr ?? "").trim());
	if (rules.length === 0) return { store, applied: [], missed: [] };
	const env = activeEnvOf(store);
	if (!env) return { store, applied: [], missed: rules.map((r) => String(r.name).trim()) };
	const applied = [];
	const missed = [];
	const vars = [...(Array.isArray(env.vars) ? env.vars : [])];
	for (const rule of rules) {
		const value = runExtract(rule, response, resolvedRequest);
		if (value === void 0) { missed.push(rule.name); continue; }
		const idx = vars.findIndex((v) => v.name === rule.name);
		const row = { name: rule.name, value, enabled: true };
		if (idx === -1) vars.push(row);
		else vars[idx] = row;
		applied.push(row);
	}
	if (applied.length === 0) return { store, applied, missed };
	return { store: setEnvVars(store, env.id, vars), applied, missed };
}
