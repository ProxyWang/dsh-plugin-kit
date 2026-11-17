/* ---------------- code snippet generators (Bruno-style "Generate Code") ----------------
 *
 * Pure serializers from a *resolved* request — resolveRequest()'s output with
 * environment variables substituted, params already in the URL and the auth
 * section folded into headers — to runnable client snippets. Because the input
 * is the same record the Timeline shows and the host puts on the wire, the
 * generated code can never disagree with what was actually sent.
 */

import { toCurl } from "./curl.js";
import { requestToBru } from "./brucol.js";

/** Adapt a resolved request back to toCurl's editor-state input (headers are final). */
export function resolvedToCurlRequest(resolved) {
	const req = {
		method: resolved?.method ?? "GET",
		url: resolved?.url ?? "",
		headers: resolved?.headers ?? [],
		bodyType: "none",
	};
	if (Array.isArray(resolved?.multipart)) {
		req.bodyType = "multipart";
		req.formPairs = resolved.multipart.map((f) => ({ name: f.name, value: f.value, enabled: true }));
	} else if (typeof resolved?.body === "string") {
		req.bodyType = "raw";
		req.body = resolved.body;
	}
	return req;
}

/** curl snippet for a resolved request (auth already lives in the headers). */
export function toCurlSnippet(resolved) {
	return toCurl(resolvedToCurlRequest(resolved));
}

/** JavaScript (fetch) snippet; mirrors the host's wire request including the timeout signal. */
export function toFetchSnippet(resolved) {
	const req = resolved ?? {};
	const lines = [];
	if (Array.isArray(req.multipart)) {
		lines.push("const form = new FormData();");
		for (const f of req.multipart) lines.push(`form.append(${JSON.stringify(String(f?.name ?? ""))}, ${JSON.stringify(String(f?.value ?? ""))});`);
		lines.push("");
	}
	const opts = [`  method: ${JSON.stringify(String(req.method ?? "GET"))}`];
	const headers = req.headers ?? [];
	if (headers.length > 0) {
		opts.push("  headers: {");
		for (const hd of headers) opts.push(`    ${JSON.stringify(String(hd?.name ?? ""))}: ${JSON.stringify(String(hd?.value ?? ""))},`);
		opts.push("  }");
	}
	if (Array.isArray(req.multipart)) opts.push("  body: form");
	else if (typeof req.body === "string") opts.push(`  body: ${JSON.stringify(req.body)}`);
	if (Number.isFinite(req.timeoutMs) && req.timeoutMs > 0) opts.push(`  signal: AbortSignal.timeout(${req.timeoutMs})`);
	lines.push(`const response = await fetch(${JSON.stringify(String(req.url ?? ""))}, {`);
	lines.push(opts.join(",\n"));
	lines.push("});");
	lines.push("");
	lines.push("console.log(response.status);");
	lines.push("console.log(await response.text());");
	return lines.join("\n");
}

function pyLiteral(value) {
	// JSON string literals are valid Python str literals for our character set
	// (double quotes, \" \\ \n \t \uXXXX escapes all carry over).
	return JSON.stringify(String(value ?? ""));
}

/** Python (requests) snippet; multipart text fields go through `files=` like Bruno's codegen. */
export function toPythonSnippet(resolved) {
	const req = resolved ?? {};
	const lines = ["import requests", ""];
	lines.push(`url = ${pyLiteral(req.url)}`);
	const headers = req.headers ?? [];
	if (headers.length > 0) {
		lines.push("headers = {");
		for (const hd of headers) lines.push(`    ${pyLiteral(hd?.name)}: ${pyLiteral(hd?.value)},`);
		lines.push("}");
	}
	const args = [pyLiteral(req.method ?? "GET"), "url"];
	if (headers.length > 0) args.push("headers=headers");
	if (Array.isArray(req.multipart)) {
		lines.push("files = [");
		for (const f of req.multipart) lines.push(`    (${pyLiteral(f?.name)}, (None, ${pyLiteral(f?.value)})),`);
		lines.push("]");
		args.push("files=files");
	} else if (typeof req.body === "string") {
		lines.push(`data = ${pyLiteral(req.body)}`);
		args.push("data=data");
	}
	if (Number.isFinite(req.timeoutMs) && req.timeoutMs > 0) args.push(`timeout=${Math.max(1, Math.round(req.timeoutMs / 1000))}`);
	lines.push("");
	lines.push(`resp = requests.request(${args.join(", ")})`);
	lines.push("");
	lines.push("print(resp.status_code)");
	lines.push("print(resp.text)");
	return lines.join("\n");
}

/** Menu metadata for the API toolbar's Code popup: id → label + builder. */
export const SNIPPET_KINDS = [
	{ id: "curl", label: "curl", build: toCurlSnippet },
	{ id: "fetch", label: "JavaScript · fetch", build: toFetchSnippet },
	{ id: "python", label: "Python · requests", build: toPythonSnippet },
	// Bruno collection file: keeps {{var}} templates verbatim (the second
	// argument is the raw editor state), so the file stays environment-agnostic.
	{ id: "bru", label: "Bruno · .bru", build: (_resolved, state) => requestToBru(state) },
];
