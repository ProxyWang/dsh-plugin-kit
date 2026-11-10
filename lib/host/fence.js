/** Workspace path fencing and fenced reads: containment checks, symlink refusal, text LRU, directory listing. */

import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { LIST_CAP, READ_CAP } from "./constants.js";

/** Path containment: candidate is root itself or below it (no .. escape). */
function insideFence(root, candidate) {
	const child = relative(root, candidate);
	return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

/** Resolve a requested path inside the workspace fence; returns resolved file info. */
async function resolveFencedTarget(cwd, requestedPath) {
	if (typeof cwd !== "string" || cwd === "") throw new Error("cwd is required");
	if (typeof requestedPath !== "string" || requestedPath === "") throw new Error("path is required");
	const root = await realpath(cwd);
	const candidate = resolve(root, requestedPath);
	if (!insideFence(root, candidate)) throw new Error("path is outside the session workspace");
	const linkStat = await lstat(candidate);
	if (linkStat.isSymbolicLink()) throw new Error("symbolic links are not supported");
	const filename = await realpath(candidate);
	if (!insideFence(root, filename)) throw new Error("resolved path is outside the session workspace");
	return { filename, stat: linkStat, root };
}

/** Small LRU of decoded file texts, keyed by absolute path. */
const textCache = new Map();
const TEXT_CACHE_CAP = 12;

function cachePut(key, entry) {
	textCache.delete(key);
	textCache.set(key, entry);
	if (textCache.size > TEXT_CACHE_CAP) textCache.delete(textCache.keys().next().value);
}

async function readFencedText(cwd, requestedPath) {
	const target = await resolveFencedTarget(cwd, requestedPath);
	if (!target.stat.isFile()) throw new Error("path is not a regular file");
	const hit = textCache.get(target.filename);
	if (hit && hit.mtimeMs === target.stat.mtimeMs && hit.size === target.stat.size) {
		return { ...hit.result, filename: target.filename };
	}
	let bytes = await readFile(target.filename);
	const truncated = target.stat.size > READ_CAP;
	if (truncated) bytes = bytes.subarray(0, READ_CAP);
	if (bytes.includes(0)) {
		const result = { kind: "binary", truncated, size: target.stat.size };
		return { ...result, filename: target.filename };
	}
	if (truncated) {
		for (let back = 1; back <= 3 && back <= bytes.length; back++) {
			const last = bytes[bytes.length - back];
			if ((last & 0b1100_0000) === 0b1000_0000) continue;
			const need = last >= 0b1111_0000 ? 4 : last >= 0b1110_0000 ? 3 : last >= 0b1100_0000 ? 2 : 1;
			if (need > back) bytes = bytes.subarray(0, bytes.length - back);
			break;
		}
	}
	let text = bytes.toString("utf8");
	if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
	const result = { kind: "text", content: text, truncated, size: target.stat.size };
	cachePut(target.filename, { mtimeMs: target.stat.mtimeMs, size: target.stat.size, result });
	return { ...result, filename: target.filename };
}

async function listFencedDir(cwd, requestedPath) {
	const target = await resolveFencedTarget(cwd, requestedPath === "" ? "." : requestedPath);
	if (!target.stat.isDirectory()) throw new Error("path is not a directory");
	const names = await readdir(target.filename);
	const entries = [];
	for (const name of names) {
		if (name === ".git") continue;
		let entryStat;
		try {
			entryStat = await lstat(join(target.filename, name));
		} catch {
			continue;
		}
		if (entryStat.isSymbolicLink()) continue;
		const type = entryStat.isDirectory() ? "directory" : entryStat.isFile() ? "file" : "other";
		entries.push({ name, type, size: entryStat.size });
		if (entries.length >= LIST_CAP) {
			return { entries, truncated: true };
		}
	}
	return { entries, truncated: false };
}

export { insideFence, resolveFencedTarget, textCache, readFencedText, listFencedDir };
