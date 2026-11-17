/* ---------------- OpenAPI & Postman collection import (pure) ---------------- */

/**
 * Convert external collection formats into this panel's request snapshots.
 * Kept deliberately small: one request per operation/item, first server,
 * example-or-schema sampling for bodies. Deep $ref graphs, auth schemes and
 * multi-file specs stay out — the import gets you 80% of the way there and
 * everything it produces is editable in the normal request UI.
 */

const METHODS = ["get", "put", "post", "patch", "delete", "options", "head", "trace"];

function sampleFromSchema(schema, depth = 0) {
	if (!schema || typeof schema !== "object" || depth > 3) return {};
	if (schema.example !== void 0) return schema.example;
	if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
	switch (schema.type) {
		case "string": return "";
		case "number": case "integer": return 0;
		case "boolean": return false;
		case "array": return [sampleFromSchema(schema.items, depth + 1)];
		case "object": {
			const out = {};
			for (const [key, sub] of Object.entries(schema.properties ?? {})) out[key] = sampleFromSchema(sub, depth + 1);
			return out;
		}
		default: return {};
	}
}

function firstServer(doc) {
	const s = Array.isArray(doc.servers) ? doc.servers[0]?.url : void 0;
	return typeof s === "string" ? s.replace(/\/+$/, "") : "";
}

function openApiRequest(path, method, op, doc) {
	const url = `${firstServer(doc)}${path}`.replace(/[?&]$/, "");
	// {param} → :param (this panel's path-parameter syntax).
	const urlOut = url.replace(/\{([^/}]+)\}/g, ":$1");
	const query = [];
	const pathParams = [];
	for (const p of Array.isArray(op?.parameters) ? op.parameters : []) {
		if (!p || typeof p.name !== "string") continue;
		const value = p.example ?? p.schema?.example ?? "";
		if (p.in === "query") query.push({ name: p.name, value: String(value), enabled: true });
		else if (p.in === "path") pathParams.push({ name: p.name, kind: "path", value: String(value), enabled: true });
	}
	const headers = [];
	let bodyType = "none";
	let rawSub = "json";
	let body = "";
	const content = op?.requestBody?.content;
	if (content && typeof content === "object") {
		const types = Object.keys(content);
		const jsonType = types.find((c) => c.includes("json"));
		const formType = types.find((c) => c.includes("form-urlencoded"));
		if (jsonType) {
			bodyType = "raw";
			rawSub = "json";
			const c = content[jsonType];
			const example = c?.example ?? c?.examples?.[Object.keys(c?.examples ?? {})[0]]?.value;
			body = JSON.stringify(example ?? sampleFromSchema(c?.schema) ?? {}, null, 2);
			headers.push({ name: "Content-Type", value: jsonType, enabled: true });
		} else if (formType) {
			bodyType = "form";
			const formPairs = [];
			const props = content[formType]?.schema?.properties ?? {};
			for (const [key, sub] of Object.entries(props)) formPairs.push({ name: key, value: String(sub?.example ?? sampleFromSchema(sub) ?? ""), enabled: true });
			body = JSON.stringify(formPairs);
			headers.push({ name: "Content-Type", value: "application/x-www-form-urlencoded", enabled: true });
		}
	}
	const name = op?.summary ?? op?.operationId ?? `${method.toUpperCase()} ${path}`;
	return { method: method.toUpperCase(), url: urlOut, headers, bodyType, rawSub, body, paramPairs: [...query, ...pathParams], name: String(name) };
}

export function parseOpenApi(doc) {
	if (!doc || typeof doc !== "object" || typeof doc.openapi !== "string") return null;
	const out = [];
	for (const [path, item] of Object.entries(doc.paths ?? {})) {
		if (!item || typeof item !== "object") continue;
		for (const [method, op] of Object.entries(item)) {
			if (!METHODS.includes(method.toLowerCase()) || op === null || typeof op !== "object") continue;
			out.push(openApiRequest(path, method.toLowerCase(), op, doc));
		}
	}
	if (out.length === 0) return { requests: [], error: "no operations found" };
	return { requests: out };
}

function postmanUrl(raw) {
	if (typeof raw === "string") return { url: raw, query: [] };
	if (raw && typeof raw === "object") {
		const query = (Array.isArray(raw.query) ? raw.query : [])
			.filter((p) => p && typeof p.key === "string")
			.map((p) => ({ name: p.key, value: String(p.value ?? ""), enabled: p.disabled !== true }));
		return { url: typeof raw.raw === "string" ? raw.raw : "", query };
	}
	return { url: "", query: [] };
}

function postmanItem(item, out) {
	if (!item || typeof item !== "object") return;
	if (Array.isArray(item.item)) {
		for (const sub of item.item) postmanItem(sub, out);
		return;
	}
	const req = item.request;
	if (!req || typeof req !== "object" || typeof req.method !== "string") return;
	const { url, query } = postmanUrl(req.url);
	const headers = (Array.isArray(req.header) ? req.header : [])
		.filter((hd) => hd && typeof hd.key === "string")
		.map((hd) => ({ name: hd.key, value: String(hd.value ?? ""), enabled: hd.disabled !== true }));
	let bodyType = "none";
	let rawSub = "json";
	let body = "";
	const b = req.body;
	if (b && typeof b === "object") {
		if (b.mode === "urlencoded" && Array.isArray(b.urlencoded)) {
			bodyType = "form";
			body = JSON.stringify(b.urlencoded.filter((p) => p && typeof p.key === "string").map((p) => ({ name: p.key, value: String(p.value ?? ""), enabled: p.disabled !== true })));
		} else if (b.mode === "formdata" && Array.isArray(b.formdata)) {
			bodyType = "multipart";
			body = JSON.stringify(b.formdata.filter((p) => p && typeof p.key === "string" && p.type !== "file").map((p) => ({ name: p.key, value: String(p.src ?? p.value ?? ""), enabled: p.disabled !== true })));
		} else if (typeof b.raw === "string") {
			bodyType = "raw";
			rawSub = b.options?.raw?.language ?? (/^\s*[{[]/.test(b.raw) ? "json" : "text");
			body = b.raw;
		}
	}
	out.push({ method: req.method.toUpperCase(), url, headers, bodyType, rawSub, body, paramPairs: query, name: String(item.name ?? req.method.toUpperCase()) });
}

export function parsePostman(doc) {
	if (!doc || typeof doc !== "object" || !Array.isArray(doc.item)) return null;
	if (typeof doc.info?.schema === "string" && !/collection/.test(doc.info.schema)) return null;
	const requests = [];
	for (const item of doc.item) postmanItem(item, requests);
	if (requests.length === 0) return { requests: [], error: "no requests found" };
	return { requests };
}

/** Which collection import (if any) matches a pasted JSON document. */
export function detectCollectionImport(text) {
	const trimmed = String(text ?? "").trim();
	if (!trimmed.startsWith("{")) return null;
	let doc;
	try {
		doc = JSON.parse(trimmed);
	} catch {
		return null;
	}
	if (typeof doc?.openapi === "string") return parseOpenApi(doc);
	if (Array.isArray(doc?.item)) return parsePostman(doc);
	return null;
}
