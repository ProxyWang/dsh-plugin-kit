/* ---------------- request entries: one history, two protocols ----------------
 *
 * HTTP and gRPC share the workbench's history and favorites, so both have to
 * agree on what a record is. The shape stays the HTTP one — `{ id, ts, request }`
 * — with one added discriminant: `protocol`. Rows written before the merge have
 * no field at all, and reading them as HTTP is exactly right, so the migration
 * is "absent means http" instead of a rewrite pass.
 *
 * Everything here is pure: the panels filter, label and interpolate through
 * these functions, and the tests drive them without a DOM.
 */

/** Protocols an entry can belong to. */
export const PROTOCOLS = ["http", "grpc"];

/** How many entries each store keeps. */
export const HISTORY_CAP = 60;

/**
 * Protocol of a stored record.
 * @param entry - a history or favorite row.
 * @returns `"grpc"` for gRPC rows, `"http"` for everything else (including
 *   rows written before the field existed).
 */
export function entryProtocol(entry) {
	return entry?.protocol === "grpc" ? "grpc" : "http";
}

/**
 * Tag a record with its protocol, leaving HTTP rows exactly as they were.
 * @param entry - a record.
 * @param protocol - the protocol it belongs to.
 * @returns the record, tagged only when it is not HTTP.
 */
export function withProtocol(entry, protocol) {
	return protocol === "grpc" ? { ...entry, protocol: "grpc" } : entry;
}

/**
 * Rows of one protocol, newest first.
 * @param list - stored rows.
 * @param protocol - the protocol to keep.
 * @returns a filtered copy; the input is never mutated.
 */
export function filterByProtocol(list, protocol) {
	const wanted = PROTOCOLS.includes(protocol) ? protocol : "http";
	return (Array.isArray(list) ? list : []).filter((entry) => entryProtocol(entry) === wanted);
}

/**
 * Merge both protocols into one newest-first list.
 * @param lists - rows from either protocol.
 * @returns the merged list, tagged and sorted by timestamp.
 */
export function mergeProtocols(...lists) {
	const rows = lists.flatMap((list) => (Array.isArray(list) ? list : []));
	return rows
		.slice()
		.sort((a, b) => Number(b?.ts ?? 0) - Number(a?.ts ?? 0));
}

/**
 * Add a record to a capped, newest-first list.
 * @param list - existing rows.
 * @param entry - the new row.
 * @param cap - maximum rows kept.
 * @returns a new list.
 */
export function pushHistory(list, entry, cap = HISTORY_CAP) {
	const rows = [entry, ...(Array.isArray(list) ? list : [])];
	return rows.slice(0, Math.max(1, cap));
}

/**
 * Human label for one row in a merged history list.
 * @param entry - a stored record.
 * @returns a short description; gRPC rows name the method and target, HTTP rows
 *   the method and URL.
 */
export function entryLabel(entry) {
	if (entryProtocol(entry) === "grpc") {
		const request = entry.request ?? {};
		const method = String(request.method ?? "").trim();
		const address = String(request.address ?? "").trim();
		return `${method || "(method)"}${address ? ` → ${address}` : ""}`;
	}
	const method = String(entry.method ?? entry.request?.method ?? "").toUpperCase();
	const url = String(entry.url ?? entry.request?.url ?? "");
	return `${method}${url ? ` ${url}` : ""}`.trim();
}

/**
 * Substitute `{{name}}` placeholders from a variable map.
 *
 * Unknown names are left verbatim, which is the useful failure: the request is
 * still visible and sendable, and the missing variable reads as itself instead
 * of becoming an empty string that silently changes the target.
 *
 * @param text - template text.
 * @param variables - `{ name: value }` map.
 * @returns the text with known placeholders replaced.
 */
export function interpolateVariables(text, variables) {
	if (typeof text !== "string" || text === "") return text;
	const source = variables && typeof variables === "object" ? variables : {};
	return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/gu, (all, name) => {
		const value = source[name];
		return value === undefined || value === null ? all : String(value);
	});
}

/**
 * Interpolate every string in a structured value (request bodies, metadata).
 * @param value - any JSON-like value.
 * @param variables - `{ name: value }` map.
 * @returns a copy with placeholders substituted; primitives are returned as-is.
 */
export function interpolateDeep(value, variables) {
	if (typeof value === "string") return interpolateVariables(value, variables);
	if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, variables));
	if (value && typeof value === "object") {
		const out = {};
		for (const [key, item] of Object.entries(value)) out[key] = interpolateDeep(item, variables);
		return out;
	}
	return value;
}

/**
 * Variables of the active environment, ready for substitution.
 * @param envStore - the workbench's environment store.
 * @returns a `{ name: value }` map, empty when there is no active environment.
 */
export function activeVariables(envStore) {
	const active = (envStore?.envs ?? []).find((env) => env.id === envStore?.activeId);
	const vars = {};
	for (const row of active?.vars ?? []) {
		if (row && row.enabled !== false && typeof row.name === "string" && row.name !== "") vars[row.name] = row.value ?? "";
	}
	return vars;
}
