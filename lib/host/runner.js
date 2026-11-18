/** .bru collection runner: execute a folder of saved requests sequentially.
 *
 * Reads every *.bru file from the workspace collection directory, resolves
 * {{var}} placeholders from the active environment, sends each request through
 * the existing api.send route, and applies post-response extracts to chain
 * variables between requests. Returns a per-request report with status, timing
 * and any extract hits/misses.
 *
 * This is the Host-side engine; the Client UI wires it to a "Run collection"
 * button in the API workbench's settings tab.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseBru } from "../../src/client/brucol.js";
import { applyParamsToUrl, normalizeAuth, normalizeUrlParams, resolveRequest, syncParamsFromUrl, applyExtracts, buildEnvMap, activeEnvOf } from "../../src/client/reqmodel.js";

const MAX_FILES = 200;
const MAX_FILE_SIZE = 256 * 1024;

/**
 * Run every .bru file in a directory sequentially.
 *
 * @param cwd - workspace root (for fencing)
 * @param dir - collection directory relative to cwd
 * @param envStore - environment store {envs, activeId} for {{var}} resolution
 * @param sendFn - async (resolvedRequest) => response value (same shape as api.send)
 * @returns {results: [{file, name, status, ms, error, extracts:{applied,missed}}], totalMs}
 */
export async function runCollection(cwd, dir, envStore, sendFn) {
	const absDir = resolve(String(cwd ?? ""), String(dir ?? ""));
	const rel = relative(resolve(String(cwd ?? "")), absDir);
	if (rel.startsWith("..") || rel.startsWith("/")) throw new Error("collection directory escapes the workspace");
	let entries;
	try {
		entries = await readdir(absDir, { withFileTypes: true });
	} catch (error) {
		throw new Error(`cannot read collection directory: ${error.message}`);
	}
	const bruFiles = entries
		.filter((e) => e.isFile() && e.name.endsWith(".bru") && !e.name.startsWith("."))
		.map((e) => e.name)
		.sort()
		.slice(0, MAX_FILES);
	if (bruFiles.length === 0) return { results: [], totalMs: 0 };

	const results = [];
	const started = Date.now();
	// Mutable env store so extracts from earlier requests feed later ones.
	let liveEnv = JSON.parse(JSON.stringify(envStore ?? { envs: [], activeId: null }));

	for (const file of bruFiles) {
		const filePath = join(absDir, file);
		let text;
		try {
			const buf = await readFile(filePath, { encoding: "utf8" });
			if (buf.length > MAX_FILE_SIZE) {
				results.push({ file, name: file, status: 0, ms: 0, error: "file too large", extracts: { applied: [], missed: [] } });
				continue;
			}
			text = buf;
		} catch (error) {
			results.push({ file, name: file, status: 0, ms: 0, error: `read failed: ${error.message}`, extracts: { applied: [], missed: [] } });
			continue;
		}
		let bru;
		try {
			bru = parseBru(text);
		} catch (error) {
			results.push({ file, name: file, status: 0, ms: 0, error: `parse failed: ${error.message}`, extracts: { applied: [], missed: [] } });
			continue;
		}
		const reqState = {
			method: bru.method,
			url: applyParamsToUrl(bru.url, bru.paramPairs),
			headers: bru.headers,
			bodyType: bru.bodyType,
			rawSub: bru.rawSub,
			formPairs: bru.formPairs ?? [],
			body: bru.bodyType === "raw" ? bru.body : "",
			paramPairs: syncParamsFromUrl(applyParamsToUrl(bru.url, bru.paramPairs), bru.paramPairs),
			timeoutMs: 30000,
			auth: normalizeAuth(bru.auth),
			extracts: bru.extracts ?? [],
		};
		const resolved = resolveRequest(reqState, envMapOf(liveEnv));
		const t0 = Date.now();
		let response;
		try {
			response = await sendFn(resolved);
		} catch (error) {
			results.push({ file, name: bru.name || file, status: 0, ms: Date.now() - t0, error: `send failed: ${error.message}`, extracts: { applied: [], missed: [] } });
			continue;
		}
		const ms = Date.now() - t0;
		// Apply extracts: write hits into the live env for subsequent requests.
		const { store: nextEnv, applied, missed } = applyExtracts(reqState.extracts, response, resolved, liveEnv);
		liveEnv = nextEnv;
		results.push({
			file,
			name: bru.name || file,
			status: response?.status ?? 0,
			ms,
			error: response?.error ?? null,
			extracts: { applied, missed },
		});
	}
	return { results, totalMs: Date.now() - started };
}

/** Build a variable map from an env store (plain object, matching reqmodel.buildEnvMap). */
function envMapOf(store) {
	return buildEnvMap(activeEnvOf(store)?.vars);
}