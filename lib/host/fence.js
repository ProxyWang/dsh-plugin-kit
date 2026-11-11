/** Workspace path fencing and fenced reads: containment checks, symlink refusal, text LRU, directory listing. */

import { lstat, open, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

import { IMAGE_CAP, IMAGE_MIME, LIST_CAP, READ_CAP, WRITE_CAP } from "./constants.js";
import { extraReadRoots } from "./roots.js";

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

/**
 * Resolve a path that does not exist yet (fs.create target, fs.rename
 * destination). The nearest existing ancestor decides where the new entry
 * would physically land, so that ancestor is realpath'd and re-fenced:
 * a symlinked directory inside the workspace cannot smuggle the write or
 * move outside of it.
 */
async function resolveFencedNewPath(cwd, requestedPath) {
	if (typeof cwd !== "string" || cwd === "") throw new Error("cwd is required");
	if (typeof requestedPath !== "string" || requestedPath === "") throw new Error("path is required");
	const root = await realpath(cwd);
	const candidate = resolve(root, requestedPath);
	if (!insideFence(root, candidate)) throw new Error("path is outside the session workspace");
	const segments = [];
	let probe = candidate;
	let anchorStat = null;
	for (;;) {
		const parent = dirname(probe);
		if (parent === probe) break; // filesystem root reached, nothing existed
		segments.unshift(basename(probe));
		probe = parent;
		try {
			anchorStat = await lstat(probe);
			break;
		} catch { /* missing ancestor: keep walking up */ }
	}
	if (anchorStat === null) throw new Error("path is outside the session workspace");
	if (anchorStat.isSymbolicLink()) throw new Error("symbolic links are not supported");
	const realAnchor = await realpath(probe);
	if (!insideFence(root, realAnchor)) throw new Error("resolved path is outside the session workspace");
	const filename = join(realAnchor, ...segments);
	if (!insideFence(root, filename)) throw new Error("resolved path is outside the session workspace");
	return { filename, root, anchorIsDir: anchorStat.isDirectory() };
}

/**
 * Resolve for READ purposes: the session workspace first, then the sibling
 * directory and Go toolchain roots (cross-repo / module-cache jumps). Writes
 * and listings keep using the strict resolveFencedTarget.
 */
async function resolveReadTarget(cwd, requestedPath) {
	if (typeof cwd !== "string" || cwd === "") throw new Error("cwd is required");
	if (typeof requestedPath !== "string" || requestedPath === "") throw new Error("path is required");
	const root = await realpath(cwd);
	const candidate = resolve(root, requestedPath);
	const roots = [root, ...await extraReadRoots(root)];
	let lastError = null;
	for (let ri = 0; ri < roots.length; ri++) {
		const base = roots[ri];
		if (!insideFence(base, candidate)) continue;
		try {
			const linkStat = await lstat(candidate);
			if (linkStat.isSymbolicLink()) throw new Error("symbolic links are not supported");
			if (!linkStat.isFile()) throw new Error("path is not a regular file");
			const filename = await realpath(candidate);
			if (!insideFence(base, filename)) throw new Error("resolved path is outside the allowed roots");
			// Extra roots (everything but the workspace) never serve hidden
			// paths: the parent tree can contain ~/.ssh, ~/.aws & co when the
			// workspace sits directly under $HOME.
			if (ri > 0 && relative(base, filename).split(/[\\/]/).some((seg) => seg.startsWith("."))) {
				throw new Error("hidden paths are not readable outside the workspace");
			}
			return { filename, stat: linkStat, root: base };
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error("path is outside the session workspace");
}

/** Small LRU of decoded file texts, keyed by absolute path. Capped by entry count AND retained bytes. */
const textCache = new Map();
const TEXT_CACHE_CAP = 12;
const TEXT_CACHE_BYTES_CAP = 24 * 1024 * 1024;
let textCacheBytes = 0;

function cacheHeld(entry) {
	return Math.min(entry.size ?? 0, READ_CAP);
}

function cachePut(key, entry) {
	const prev = textCache.get(key);
	if (prev !== undefined) textCacheBytes -= cacheHeld(prev);
	textCache.delete(key);
	textCache.set(key, entry);
	textCacheBytes += cacheHeld(entry);
	while (textCache.size > 1 && (textCache.size > TEXT_CACHE_CAP || textCacheBytes > TEXT_CACHE_BYTES_CAP)) {
		const oldestKey = textCache.keys().next().value;
		textCacheBytes -= cacheHeld(textCache.get(oldestKey));
		textCache.delete(oldestKey);
	}
}

/** Read at most `cap` bytes from the start of a file without buffering the rest. */
async function readFilePrefix(filename, cap) {
	const fh = await open(filename, "r");
	try {
		const buf = Buffer.alloc(cap);
		const { bytesRead } = await fh.read(buf, 0, cap, 0);
		return bytesRead === cap ? buf : buf.subarray(0, bytesRead);
	} finally {
		await fh.close();
	}
}

async function readFencedText(cwd, requestedPath) {
	const target = await resolveReadTarget(cwd, requestedPath);
	if (!target.stat.isFile()) throw new Error("path is not a regular file");
	// Raster images bypass the text LRU and go back as base64 for the panel's
	// <img> preview; oversize images report their kind without the payload.
	const mime = IMAGE_MIME.get(extname(target.filename).toLowerCase());
	if (mime !== undefined) {
		if (target.stat.size > IMAGE_CAP) return { kind: "image", mime, size: target.stat.size, truncated: true, mtimeMs: target.stat.mtimeMs, filename: target.filename };
		const buf = await readFile(target.filename);
		return { kind: "image", mime, size: target.stat.size, truncated: false, base64: buf.toString("base64"), mtimeMs: target.stat.mtimeMs, filename: target.filename };
	}
	const hit = textCache.get(target.filename);
	if (hit && hit.mtimeMs === target.stat.mtimeMs && hit.size === target.stat.size) {
		return { ...hit.result, filename: target.filename };
	}
	// Oversize files: read only the capped prefix — buffering a multi-GB log
	// just to discard everything past READ_CAP could OOM the host process.
	const truncated = target.stat.size > READ_CAP;
	const bytes = truncated
		? await readFilePrefix(target.filename, READ_CAP)
		: await readFile(target.filename);
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
	const result = { kind: "text", content: text, truncated, size: target.stat.size, mtimeMs: target.stat.mtimeMs };
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

/**
 * Write UTF-8 text to a fenced regular file (the panel editor's save path).
 * Symlinks and escapes are refused by resolveFencedTarget; only pre-existing
 * regular files are writable, and the byte size is capped. When `baseMtime`
 * is given (the mtimeMs the editor loaded), a mismatch means the file changed
 * on disk since — the write is refused so external edits are never silently
 * clobbered (VSCode-style conflict detection). The text LRU needs no
 * invalidation: readFencedText revalidates on mtime/size.
 */
async function writeFencedText(cwd, requestedPath, content, baseMtime) {
	if (typeof content !== "string") throw new Error("content must be a string");
	const target = await resolveFencedTarget(cwd, requestedPath);
	if (!target.stat.isFile()) throw new Error("path is not a regular file");
	if (Number.isFinite(baseMtime) && target.stat.mtimeMs !== baseMtime) {
		throw new Error("file was modified on disk; reload before saving");
	}
	const size = Buffer.byteLength(content, "utf8");
	if (size > WRITE_CAP) throw new Error("content too large");
	await writeFile(target.filename, content, "utf8");
	const after = await lstat(target.filename);
	return { path: requestedPath, size, mtimeMs: after.mtimeMs };
}

export { insideFence, resolveFencedTarget, resolveFencedNewPath, resolveReadTarget, textCache, readFencedText, writeFencedText, listFencedDir };
