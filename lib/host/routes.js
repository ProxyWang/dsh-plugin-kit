/** The POST route table served under API_PREFIX; every handler takes the parsed JSON body and returns the `value` payload. */

import { realpath, access, lstat, mkdir, readFile, readdir, rename as renameFs, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

import { insideFence, listFencedDir, readFencedText, resolveFencedNewPath, resolveFencedTarget, resolveReadTarget, writeFencedText } from "./fence.js";
import { extractHunk, fenceRepo, gitBlame, gitCherryPick, gitCompare, gitDiff, gitRepoRoot, gitResolveConflict, gitSequencerAbort, gitSequencerContinue, gitStatus, gitStatusAt, litPathspec, parsePorcelainZ, repoRelPath, runGit } from "./git.js";
import { fuzzyScore, searchCandidates, textSearch } from "./search.js";
import { descriptorForPath, findProjectRoot, LANGUAGE_SERVERS, serverFor, servers, applyTextEdits } from "./lsp.js";
import { createSkill, deleteSkill, listSkills, readSkill, writeSkill } from "./skills.js";
import { killTask, pollTask, scriptsFor, startTask, stopAllTasks } from "./tasks.js";
import { poll as watchPoll } from "./watch.js";
import { isEventStream, startStream, pollStream, stopStream } from "./streams.js";
import { runCollection } from "./runner.js";
import { openExternalTerminal } from "./external-terminal.js";
import { parseProto, listMethods, resolveSchemaTypes } from "./proto.js";
import { sampleMessage } from "./protobuf.js";
import { grpcCall } from "./grpc.js";
import { discover } from "./grpc-reflect.js";

/** Stash refs are positional args: validate strictly so nothing flag-like slips through. */
const STASH_REF_RE = /^stash@\{\d+\}$/;

/** Current stash list as [{ref, message}], newest first, capped at 50. */
async function stashListAt(root) {
	const res = await runGit(root, ["stash", "list", "--format=%gd\u001f%gs", "-50"]);
	if (!res.ok) return [];
	return res.stdout.split("\n").filter(Boolean).slice(0, 50).map((line) => {
		const at = line.indexOf("\u001f");
		return at < 0 ? { ref: line, message: "" } : { ref: line.slice(0, at), message: line.slice(at + 1) };
	});
}

/**
 * Repo root for WRITE-side git routes (fetch/pull/checkout/commit/push/stash
 * mutations). Explicit hints go through fenceRepo; without a hint an ancestor
 * repository enclosing the workspace is refused — mutating a repo that
 * extends beyond the session workspace is outside the panel's write fence.
 * Read routes (status/diff/branches/blame/history/stash.list) stay lenient.
 */
async function fencedRepoRoot(cwd, repoHint) {
	if (repoHint) return await fenceRepo(cwd, String(repoHint));
	const root = await gitRepoRoot(cwd);
	if (!root) return null;
	const sessionRoot = await realpath(cwd);
	if (root !== sessionRoot && !insideFence(sessionRoot, root)) {
		throw new Error(`workspace sits inside a larger repository (${root}); panel git writes are fenced to the workspace — open the repository root as the workspace`);
	}
	return root;
}

/**
 * Load a `.proto` and everything it imports, merged into one schema.
 *
 * Imports resolve against the workspace first (how a project usually keeps
 * `proto/` side by side), then against the importing file's own directory.
 * A missing import is skipped rather than fatal: `google/protobuf/*.proto`
 * well-known types live outside most repositories, and a request that never
 * touches them still works. The walk is depth- and count-bounded so a cyclic
 * or pathological import graph cannot spin.
 */
async function loadProtoSchema(cwd, requestedPath) {
	const seen = new Set();
	const files = [];
	const messages = {};
	const enums = {};
	const services = {};
	let protocolPackage = "";
	// The file the user asked for must exist; only IMPORTS may be missing
	// (google/protobuf/*.proto lives outside most repositories).
	await resolveReadTarget(cwd, requestedPath);
	const visit = async (rawPath, depth) => {
		if (depth > 12 || files.length >= 64) return;
		let target;
		try {
			target = await resolveReadTarget(cwd, rawPath);
		} catch {
			return; // an unresolvable import is skipped, not an error
		}
		if (seen.has(target.filename)) return;
		seen.add(target.filename);
		const text = await readFile(target.filename, "utf8");
		files.push(relative(await realpath(cwd), target.filename).split("\\").join("/"));
		const parsed = parseProto(text);
		Object.assign(messages, parsed.messages);
		Object.assign(enums, parsed.enums);
		Object.assign(services, parsed.services);
		if (protocolPackage === "") protocolPackage = parsed.package;
		// Follow `import "..."` statements.
		for (const match of text.matchAll(/^\s*import\s+(?:public\s+|weak\s+)?"([^"]+)"/gm)) {
			const importPath = match[1];
			const candidates = [importPath, join(dirname(target.filename), importPath)];
			for (const candidate of candidates) {
				await visit(candidate, depth + 1);
			}
		}
	};
	await visit(requestedPath, 0);
	// Imports merge AFTER each file is parsed, so a type declared in an imported
	// file is still a short name at this point; one pass over the merged schema
	// resolves those (and keeps unambiguous short names only).
	const schema = resolveSchemaTypes({ package: protocolPackage, messages, enums, services });
	return { schema, files };
}

/** Schemas learned by reflection, keyed by the id handed to the panel. */
const discoveredSchemas = new Map();

const routes = {
	async "fs.list"(body) {
		return await listFencedDir(String(body.cwd ?? ""), String(body.path ?? ""));
	},
	async "fs.read"(body) {
		const { filename, ...result } = await readFencedText(String(body.cwd ?? ""), String(body.path ?? ""));
		void filename;
		return result;
	},
	async "fs.write"(body) {
		return await writeFencedText(
			String(body.cwd ?? ""),
			String(body.path ?? ""),
			String(body.content ?? ""),
			typeof body.baseMtime === "number" ? body.baseMtime : void 0,
		);
	},
	async "fs.create"(body) {
		const cwd = String(body.cwd ?? "");
		const requested = String(body.path ?? "");
		if (requested === "") return { error: "path is required" };
		// resolveFencedNewPath realpaths the nearest existing ancestor, so a
		// symlinked dir inside the workspace cannot redirect the create outside.
		const target = await resolveFencedNewPath(cwd, requested);
		const exists = await lstat(target.filename).then(() => true, () => false);
		if (exists) return { error: "path already exists" };
		if (!target.anchorIsDir) return { error: "parent is not a directory" };
		if (body.kind === "dir") await mkdir(target.filename);
		else await writeFile(target.filename, "", "utf8");
		return { path: requested };
	},
	async "fs.delete"(body) {
		const cwd = String(body.cwd ?? "");
		const requested = String(body.path ?? "");
		const target = await resolveFencedTarget(cwd, requested);
		if (relative(await realpath(cwd), target.filename) === "") return { error: "cannot delete the workspace root" };
		if (target.stat.isDirectory()) await rm(target.filename, { recursive: true, force: true });
		else await unlink(target.filename);
		return { path: requested };
	},
	async "fs.rename"(body) {
		const cwd = String(body.cwd ?? "");
		const requested = String(body.path ?? "");
		const to = String(body.to ?? "");
		if (to === "") return { error: "new name is required" };
		const target = await resolveFencedTarget(cwd, requested);
		// Destination goes through the new-path resolver: symlinked ancestor
		// dirs cannot move the file outside the workspace.
		const dest = await resolveFencedNewPath(cwd, to);
		const destExists = await lstat(dest.filename).then(() => true, () => false);
		if (destExists) return { error: "target already exists" };
		if (!dest.anchorIsDir) return { error: "target parent is not a directory" };
		await renameFs(target.filename, dest.filename);
		return { path: to };
	},
	async "git.status"(body) {
		return await gitStatus(String(body.cwd ?? ""), body.repo ? String(body.repo) : "");
	},
	async "git.diff"(body) {
		const scope = body.scope === "branch" ? "branch" : body.scope === "commit" ? "commit" : body.scope === "staged" ? "staged" : body.scope === "compare" ? "compare" : "working";
		return await gitDiff(String(body.cwd ?? ""), String(body.path ?? ""), scope, body.repo ? String(body.repo) : "", body.sha ? String(body.sha) : "", scope === "compare" ? { base: body.base, head: body.head } : void 0);
	},
	async "git.compare"(body) {
		return await gitCompare(String(body.cwd ?? ""), body.repo ? String(body.repo) : "", String(body.base ?? ""), String(body.head ?? ""));
	},
	// Conflict side-pick: choose one side for a conflicted file and stage it.
	async "git.resolve"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		return await gitResolveConflict(cwd, body.repo ? String(body.repo) : "", String(body.path ?? ""), String(body.side ?? ""));
	},
	async "git.cherryPick"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		return await gitCherryPick(cwd, body.repo ? String(body.repo) : "", String(body.sha ?? ""));
	},
	async "git.sequencerAbort"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		return await gitSequencerAbort(cwd, body.repo ? String(body.repo) : "", String(body.kind ?? "cherry-pick"));
	},
	async "git.sequencerContinue"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		return await gitSequencerContinue(cwd, body.repo ? String(body.repo) : "", String(body.kind ?? "cherry-pick"));
	},
	async "git.fetch"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		const before = await gitStatusAt(root);
		const remote = before.upstream ? before.upstream.split("/")[0] : "origin";
		const res = await runGit(root, ["fetch", "--prune", "--quiet", remote], 120000);
		const status = await gitStatusAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || `git fetch ${remote} failed`).trim().split("\n").slice(-2).join(" "), status };
		return { status };
	},
	async "git.pull"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		const before = await gitStatusAt(root);
		const branch = before.branch;
		if (!branch || branch === "?" || branch === "HEAD") return { error: "detached HEAD: 无法拉取", status: before };
		let up = before.upstream;
		if (!up) {
			const remote = "origin";
			const v = await runGit(root, ["ls-remote", "--heads", remote, branch], 60000);
			if (v.ok && v.stdout.includes(`refs/heads/${branch}`)) up = `${remote}/${branch}`;
		}
		if (!up) return { error: `远程没有分支 ${branch}`, status: before };
		if (before.upstreamInferred || !before.upstream) {
			await runGit(root, ["branch", `--set-upstream-to=${up}`, branch], 15000);
		}
		const remote = up.split("/")[0];
		const refName = up.slice(remote.length + 1);
		const res = await runGit(root, ["pull", "--ff-only", remote, refName], 120000);
		const status = await gitStatusAt(root);
		if (res.failed && !/Already up to date/i.test(res.stdout)) {
			return { error: (res.stderr || res.stdout || "git pull failed").trim().split("\n").slice(-3).join(" "), status, behindBefore: before.behind };
		}
		return { output: res.stdout.trim(), status, behindBefore: before.behind, upstream: up };
	},
	async "lsp.request"(body) {
		const cwd = String(body.cwd ?? "");
		const path = String(body.path ?? "");
		const kind = String(body.kind ?? "definition");
		if (!["definition", "references", "hover", "implementation", "typeDefinition", "symbol"].includes(kind)) {
			throw new Error(`unsupported kind ${kind}`);
		}
		const descriptor = descriptorForPath(path);
		if (!descriptor) {
			if (kind === "hover") return { hover: "" };
			if (kind === "symbol") return { symbols: [] };
			return { targets: [], note: "No language server covers this file type (Go, TypeScript/JavaScript, Python)" };
		}
		const target = await resolveReadTarget(cwd, path);
		const server = await serverFor(descriptor, await findProjectRoot(target.filename, target.root, descriptor.rootMarkers));
		await server.ensureStarted();
		server.touchIdle();
		const result = await server.symbolRequest(kind, target.filename, Number(body.line ?? 1), Number(body.col ?? 1));
		result.status = { state: server.state, message: server.message, progress: server.progressLine(), label: server.label };
		return result;
	},
	async "lsp.workspaceSymbol"(body) {
		const cwd = String(body.cwd ?? "");
		const query = String(body.query ?? "").slice(0, 128);
		if (cwd === "") throw new Error("cwd is required");
		// Server choice: the active document's language wins; otherwise probe
		// the workspace root for the first language whose markers are present.
		let descriptor = body.path ? descriptorForPath(String(body.path)) : null;
		if (!descriptor) {
			const root = await realpath(cwd);
			for (const candidate of LANGUAGE_SERVERS) {
				for (const marker of candidate.rootMarkers) {
					try {
						await access(join(root, marker));
						descriptor = candidate;
						break;
					} catch { /* marker not here */ }
				}
				if (descriptor) break;
			}
		}
		if (!descriptor) return { symbols: [], note: "No language server covers this workspace" };
		let projectRoot;
		if (body.path) {
			const target = await resolveReadTarget(cwd, String(body.path));
			projectRoot = await findProjectRoot(target.filename, target.root, descriptor.rootMarkers);
		} else {
			projectRoot = await findProjectRoot(join(await realpath(cwd), "workspace-root"), await realpath(cwd), descriptor.rootMarkers);
		}
		const server = await serverFor(descriptor, projectRoot);
		await server.ensureStarted();
		server.touchIdle();
		const status = { state: server.state, message: server.message, progress: server.progressLine(), label: server.label };
		try {
			const result = await server.workspaceSymbol(query);
			result.status = status;
			return result;
		} catch (error) {
			return { symbols: [], error: `workspace/symbol: ${String(error?.message ?? error)}`, status };
		}
	},
	// Format-on-save: write the draft through the normal mtime guard, then run
	// the server's formatter over what landed on disk and write the result.
	// A formatter failure NEVER loses the save — the draft stays written and
	// the reply reports formatted:false with the reason.
	async "fs.formatDraft"(body) {
		const cwd = String(body.cwd ?? "");
		const path = String(body.path ?? "");
		const content = String(body.content ?? "");
		const written = await writeFencedText(
			cwd,
			path,
			content,
			typeof body.baseMtime === "number" ? body.baseMtime : void 0,
		);
		const descriptor = descriptorForPath(path);
		if (!descriptor) return { ...written, formatted: false, content, formatError: "no formatter for this file type" };
		try {
			const target = await resolveReadTarget(cwd, path);
			const projectRoot = await findProjectRoot(target.filename, target.root, descriptor.rootMarkers);
			const server = await serverFor(descriptor, projectRoot);
			await server.ensureStarted();
			server.touchIdle();
			const edits = await server.formatDocument(target.filename);
			const formatted = applyTextEdits(content, edits);
			if (formatted === content) return { ...written, formatted: true, content };
			const after = await writeFencedText(cwd, path, formatted);
			return { ...after, formatted: true, content: formatted };
		} catch (error) {
			return { ...written, formatted: false, content, formatError: String(error?.message ?? error) };
		}
	},
	async "lsp.diagnostics"(body) {
		const cwd = String(body.cwd ?? "");
		const path = String(body.path ?? "");
		const descriptor = descriptorForPath(path);
		if (!descriptor) return { items: [] };
		let target;
		let server;
		try {
			target = await resolveReadTarget(cwd, path);
			const projectRoot = await findProjectRoot(target.filename, target.root, descriptor.rootMarkers);
			server = servers.get(`${descriptor.id}\u0000${await realpath(projectRoot)}`);
		} catch {
			return { items: [] };
		}
		if (!server || server.state !== "ready") return { items: [] };
		server.touchIdle(); // reading diagnostics counts as activity
		const uri = pathToFileURL(target.filename).href;
		return { items: server.diagnostics.get(uri) ?? [] };
	},
	async "lsp.workspaceDiagnostics"(body) {
		// Aggregate diagnostics across all open documents for every ready LSP
		// server. Returns [{path, items}] so the client can show a workspace-wide
		// Problems panel (VS Code's markers view).
		const results = [];
		for (const server of servers.values()) {
			if (server.state !== "ready") continue;
			for (const [uri, items] of server.diagnostics) {
				if (!items || items.length === 0) continue;
				let filePath;
				try { filePath = fileURLToPath(uri); } catch { continue; }
				results.push({ path: filePath, items });
			}
		}
		return { files: results };
	},
	async "lsp.status"(body) {
		const cwd = String(body.cwd ?? "");
		let key;
		try {
			key = await realpath(cwd);
		} catch {
			return { state: "off", message: "" };
		}
		let best = null;
		// servers is keyed by `${serverId}\u0000${root}`; match on server.root so
		// every language of the workspace contributes to the status.
		for (const server of servers.values()) {
			const root = server.root;
			if (root === key || root.startsWith(`${key}/`)) {
				if (!best || (server.state === "ready" && best.state !== "ready")) best = server;
			}
		}
		if (!best) return { state: "off", message: "" };
		best.touchIdle(); // the panel polling status means the user is watching
		return { state: best.state, message: best.message, progress: best.progressLine(), label: best.label };
	},
	async "search.files"(body) {
		const cwd = String(body.cwd ?? "");
		const query = String(body.query ?? "").trim();
		const reqLimit = Number(body.limit);
		const limit = Number.isFinite(reqLimit) ? Math.max(1, Math.min(200, reqLimit)) : 60;
		const root = await realpath(cwd);
		const candidates = await searchCandidates(root);
		if (!query) return { matches: candidates.slice(0, limit).map((path) => ({ path })) };
		const scored = [];
		for (const path of candidates) {
			const score = fuzzyScore(query, path);
			if (score >= 0) scored.push({ path, score });
		}
		scored.sort((a, b) => b.score - a.score);
		return { matches: scored.slice(0, limit) };
	},
	async "search.text"(body) {
		const cwd = String(body.cwd ?? "");
		const query = String(body.query ?? "");
		if (query.trim().length < 2) return { results: [], engine: "", truncated: false };
		const root = await realpath(cwd);
		const reqLimit = Number(body.limit);
		const limit = Number.isFinite(reqLimit) ? Math.max(1, Math.min(2000, reqLimit)) : 200;
		const scope = body.scope ?? "workspace";
		if (!["workspace", "directory", "changes"].includes(scope)) throw new Error("invalid search scope");
		const opts = { regex: body.regex === true, words: body.words === true };
		let scopeInfo = { kind: scope };
		if (scope === "directory") {
			const target = await resolveFencedTarget(cwd, String(body.directory ?? ""));
			if (!target.stat.isDirectory()) throw new Error("search scope is not a directory");
			opts.directory = target.filename;
			scopeInfo.directory = relative(root, target.filename).split(/[\\/]/).join("/");
		} else if (scope === "changes") {
			// Derive the set on the Host. Empty changes must mean no results,
			// never a missing/empty glob that silently searches the whole workspace.
			const repoRoot = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
			const paths = [];
			let working = [];
			if (repoRoot) {
				const status = await runGit(repoRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
				if (status.failed) throw new Error(status.stderr || "could not read changed files");
				working = parsePorcelainZ(status.stdout);
			}
			for (const entry of working) {
				const filename = resolve(repoRoot, entry.path);
				if (!insideFence(root, filename)) continue;
				try {
					const target = await resolveFencedTarget(cwd, filename);
					if (target.stat.isFile()) paths.push(target.filename);
				} catch { /* deleted files and symlinks cannot be searched */ }
			}
			opts.paths = [...new Set(paths)];
			scopeInfo.files = opts.paths.length;
		}
		const value = await textSearch(root, query, body.include ? String(body.include) : "", limit, opts);
		return { ...value, scope: scopeInfo };
	},
	async "git.branches"(body) {
		const cwd = String(body.cwd ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
		if (!root) return { error: "not a git repository" };
		const res = await runGit(root, ["for-each-ref", "--format=%(refname)\t%(refname:short)\t%(HEAD)\t%(objectname:short)", "refs/heads", "refs/remotes"]);
		if (!res.ok) return { error: (res.stderr || "git for-each-ref failed").trim() };
		const branches = [];
		for (const line of res.stdout.split("\n")) {
			if (line.trim() === "") continue;
			const [refname, name, head, sha] = line.split("\t");
			if (!name || name.endsWith("/HEAD")) continue;
			branches.push({
				name,
				current: head === "*",
				remote: refname.startsWith("refs/remotes/"),
				sha: sha ?? "",
			});
		}
		branches.sort((a, b) => (a.remote === b.remote ? a.name.localeCompare(b.name) : a.remote ? 1 : -1));
		return { branches };
	},
	async "git.checkout"(body) {
		const cwd = String(body.cwd ?? "");
		const branch = String(body.branch ?? "");
		if (branch.startsWith("-") || !/^[A-Za-z0-9._/+-]+$/.test(branch)) return { error: "invalid branch name" };
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		const res = await runGit(root, ["checkout", branch]);
		const status = await gitStatusAt(root);
		if (!res.ok) return { error: (res.stderr || res.stdout || "git checkout failed").trim().split("\n").slice(-2).join(" "), status };
		return { status };
	},
	async "api.send"(body) {
		const method = String(body.method ?? "GET").toUpperCase();
		if (!/^[A-Z]{2,16}$/.test(method)) return { error: "invalid method" };
		const url = String(body.url ?? "");
		if (!/^https?:\/\//i.test(url)) return { error: "only http(s) URLs are supported" };
		let headers = Array.isArray(body.headers)
			? body.headers.filter((hd) => hd && typeof hd.name === "string" && hd.name.trim() !== "").map((hd) => [hd.name.trim(), String(hd.value ?? "")])
			: [];
		// multipart fields: Node's FormData lets fetch generate the boundary and
		// the matching Content-Type, so any user-set Content-Type must go.
		const multipart = Array.isArray(body.multipart)
			? body.multipart.filter((f) => f && typeof f.name === "string" && f.name.trim() !== "").map((f) => [f.name.trim(), String(f.value ?? "")])
			: null;
		if (multipart) headers = headers.filter(([name]) => name.toLowerCase() !== "content-type");
		const timeoutMs = Math.min(120000, Math.max(1000, Number(body.timeoutMs ?? 30000)));
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), timeoutMs);
		const started = Date.now();
		try {
			let payload;
			if (method !== "GET" && method !== "HEAD") {
				if (multipart) {
					const fd = new FormData();
					for (const [name, value] of multipart) fd.append(name, value);
					payload = fd;
				} else if (typeof body.body === "string") {
					payload = body.body;
				}
			}
			const res = await fetch(url, {
				method,
				headers,
				body: payload,
				redirect: "follow",
				signal: ctrl.signal,
			});
			// Event streams never close: hand the live body to the stream
			// capture and let the panel drain it by cursor instead.
			if (isEventStream(res.headers)) {
				return startStream(res, ctrl, { ms: Date.now() - started });
			}
			// Stream the body and stop at the cap — buffering an unbounded
			// response first could exhaust host memory on a firehose endpoint.
			const CAP = 2 * 1024 * 1024;
			const chunks = [];
			let total = 0;
			let truncated = false;
			const reader = res.body && typeof res.body.getReader === "function" ? res.body.getReader() : null;
			if (reader) {
				try {
					for (;;) {
						const { done, value } = await reader.read();
						if (done) break;
						total += value.byteLength;
						chunks.push(Buffer.from(value));
						if (total > CAP) {
							truncated = true;
							ctrl.abort();
							break;
						}
					}
				} catch (streamError) {
					if (!truncated) throw streamError;
					// intentional abort after hitting the cap: keep what we have
				}
			} else {
				const whole = Buffer.from(await res.arrayBuffer());
				total = whole.length;
				chunks.push(whole);
			}
			let buf = Buffer.concat(chunks);
			if (buf.length > CAP) {
				buf = buf.subarray(0, CAP);
				truncated = true;
			}
			const contentLength = Number(res.headers.get("content-length"));
			const text = buf.toString("utf8");
			return {
				status: res.status,
				statusText: res.statusText,
				headers: [...res.headers.entries()],
				text,
				ms: Date.now() - started,
				size: truncated && Number.isFinite(contentLength) && contentLength > 0 ? contentLength : total,
				truncated,
			};
		} catch (error) {
			return { error: String(error?.message ?? error), ms: Date.now() - started };
		} finally {
			clearTimeout(timer);
		}
	},
	async "git.blame"(body) {
		const cwd = String(body.cwd ?? "");
		const path = String(body.path ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
		if (!root) return { error: "not a git repository" };
		const target = await resolveReadTarget(cwd, path);
		const rel = relative(root, target.filename);
		if (rel.startsWith("..") || isAbsolute(rel)) return { error: "path is outside the repository" };
		const lines = await gitBlame(root, rel);
		if (lines === null) return { error: "git blame failed" };
		return { lines };
	},
	async "git.history"(body) {
		const cwd = String(body.cwd ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
		if (!root) return { error: "not a git repository" };
		// repoRelPath (no lstat): history works for deleted files too; untracked
		// files simply yield an empty log.
		const rel = await repoRelPath(cwd, root, body.path);
		if (rel === "") return { error: "path is required" };
		const limit = Math.max(1, Math.min(200, Number(body.limit ?? 50)));
		const res = await runGit(root, ["log", "--follow", `-${limit}`, "--format=%h\u001f%ad\u001f%an\u001f%s", "--date=relative", "--", litPathspec(rel)], 30000);
		if (res.failed) return { error: (res.stderr || res.stdout || "git log failed").trim().split("\n").filter(Boolean).slice(-2).join(" ") };
		const commits = res.stdout.split("\n").filter(Boolean).map((line) => {
			const parts = line.split("\u001f");
			return { hash: parts[0] ?? "", when: parts[1] ?? "", author: parts[2] ?? "", subject: parts[3] ?? "" };
		});
		return { commits, path: rel };
	},
	async "git.discard"(body) {
		const cwd = String(body.cwd ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
		if (!root) return { error: "not a git repository" };
		const rel = await repoRelPath(cwd, root, body.path);
		if (rel === "") return { error: "path is required" };
		// Untracked files have no HEAD blob to restore: "revert" is meaningless
		// and `git checkout HEAD --` answers with a pathspec error that reads
		// like a bug. Deleting is the honest operation, and it is destructive,
		// so it stays a separate explicit action instead of being smuggled in.
		if (String(body.ch ?? "") === "U") {
			return { error: "untracked file has no committed version to revert — delete it instead", untracked: true };
		}
		// Staged additions have no HEAD blob: unstage instead of checkout (never deletes).
		const args = String(body.ch ?? "M") === "A"
			? ["restore", "--staged", "--", litPathspec(rel)]
			: ["checkout", "HEAD", "--", litPathspec(rel)];
		const res = await runGit(root, args);
		if (!res.ok) return { error: (res.stderr || res.stdout || "git discard failed").trim().split("\n").slice(-2).join(" ") };
		return { status: await gitStatusAt(root) };
	},
	async "git.stage"(body) {
		const cwd = String(body.cwd ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
		if (!root) return { error: "not a git repository" };
		const rel = await repoRelPath(cwd, root, body.path);
		// -A records deletions too; empty path stages the whole repo.
		const args = rel === "" ? ["add", "-A"] : ["add", "-A", "--", litPathspec(rel)];
		const res = await runGit(root, args);
		const status = await gitStatusAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || "git add failed").trim().split("\n").slice(-2).join(" "), status };
		return { status };
	},
	async "git.unstage"(body) {
		const cwd = String(body.cwd ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
		if (!root) return { error: "not a git repository" };
		const rel = await repoRelPath(cwd, root, body.path);
		// Unborn HEAD (fresh repo): restore/reset need a HEAD commit, so drop
		// the index entries instead — the worktree is never touched.
		// --ignore-unmatch keeps an already-empty index from failing (and git
		// messages are localized, so never match on the error text).
		const head = await runGit(root, ["rev-parse", "--verify", "--quiet", "HEAD"]);
		let args;
		if (head.ok && head.stdout.trim()) args = rel === "" ? ["reset", "--"] : ["restore", "--staged", "--", litPathspec(rel)];
		else args = rel === "" ? ["rm", "--cached", "-r", "--ignore-unmatch", "--", "."] : ["rm", "--cached", "-r", "--ignore-unmatch", "--", litPathspec(rel)];
		const res = await runGit(root, args);
		const status = await gitStatusAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || "git unstage failed").trim().split("\n").slice(-2).join(" "), status };
		return { status };
	},
	async "git.commit"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		const message = String(body.message ?? "").trim();
		if (message === "") return { error: "commit message is required" };
		if (Buffer.byteLength(message, "utf8") > 8192) return { error: "commit message too long" };
		// execFile passes the message as one argv element: no shell, no flag
		// injection through the message text. Hooks may run, hence 60s.
		const args = body.amend === true ? ["commit", "--amend", "-m", message] : ["commit", "-m", message];
		const res = await runGit(root, args, 60000);
		const status = await gitStatusAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || "git commit failed").trim().split("\n").slice(-2).join(" "), status };
		const info = await runGit(root, ["log", "-1", "--format=%h %s"]);
		return { status, commit: info.ok ? info.stdout.trim() : "", amended: body.amend === true };
	},
	async "git.push"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		const before = await gitStatusAt(root);
		const branch = before.branch;
		if (!branch || branch === "?" || branch === "HEAD") return { error: "detached HEAD: 无法推送", status: before };
		const up = before.upstream;
		const remote = up ? up.split("/")[0] : "origin";
		let refspec;
		if (up) {
			const remoteBranch = up.slice(remote.length + 1);
			refspec = `${branch}:${remoteBranch}`;
		} else {
			// Publish mode: verify the remote exists, then push with -u so the
			// branch starts tracking it (VSCode's "Publish branch").
			const remotes = await runGit(root, ["remote"]);
			if (!remotes.ok || !remotes.stdout.split("\n").map((s) => s.trim()).includes(remote)) {
				return { error: `没有名为 ${remote} 的远程仓库`, status: before };
			}
			refspec = branch;
		}
		// Never force: a rejected non-fast-forward surfaces git's own hint.
		const res = await runGit(root, up ? ["push", remote, refspec] : ["push", "-u", remote, refspec], 120000);
		const status = await gitStatusAt(root);
		if (res.failed) {
			return { error: (res.stderr || res.stdout || "git push failed").trim().split("\n").filter(Boolean).slice(-3).join(" "), status, upstream: up ?? `${remote}/${branch}` };
		}
		return { status, upstream: up ?? `${remote}/${branch}`, published: !up };
	},
	async "git.stash.list"(body) {
		const cwd = String(body.cwd ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
		if (!root) return { error: "not a git repository" };
		return { stashes: await stashListAt(root) };
	},
	async "git.stash.save"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		// Deterministic pre-check instead of parsing git's localized "No local
		// changes to save" output. Without -u, untracked-only changes would be
		// a silent git no-op, so they don't count as stashable.
		const before = await gitStatusAt(root);
		const relevant = body.includeUntracked === true ? before.working : (before.working ?? []).filter((f) => f.xy !== "??");
		if (!before.repo || relevant.length === 0) return { error: "no local changes to stash", status: before };
		const message = String(body.message ?? "").trim().slice(0, 500);
		const args = ["stash", "push"];
		if (body.includeUntracked === true) args.push("--include-untracked");
		if (message !== "") args.push("-m", message);
		const res = await runGit(root, args, 60000);
		const status = await gitStatusAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || "git stash failed").trim().split("\n").slice(-2).join(" "), status };
		return { status, stashes: await stashListAt(root) };
	},
	async "git.stash.apply"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		const ref = String(body.ref ?? "");
		if (!STASH_REF_RE.test(ref)) return { error: "invalid stash ref" };
		// Apply can legitimately conflict: git exits non-zero after writing
		// conflict markers, so the fresh status rides along with the error.
		const res = await runGit(root, ["stash", "apply", ref], 60000);
		const status = await gitStatusAt(root);
		const stashes = await stashListAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || "git stash apply failed").trim().split("\n").filter(Boolean).slice(-3).join(" "), status, stashes };
		return { status, stashes };
	},
	async "git.stash.pop"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		const ref = String(body.ref ?? "");
		if (!STASH_REF_RE.test(ref)) return { error: "invalid stash ref" };
		const res = await runGit(root, ["stash", "pop", ref], 60000);
		const status = await gitStatusAt(root);
		const stashes = await stashListAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || "git stash pop failed").trim().split("\n").filter(Boolean).slice(-3).join(" "), status, stashes };
		return { status, stashes };
	},
	async "git.stash.drop"(body) {
		const cwd = String(body.cwd ?? "");
		const root = await fencedRepoRoot(cwd, body.repo);
		if (!root) return { error: "not a git repository" };
		const ref = String(body.ref ?? "");
		if (!STASH_REF_RE.test(ref)) return { error: "invalid stash ref" };
		const res = await runGit(root, ["stash", "drop", ref]);
		const stashes = await stashListAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || "git stash drop failed").trim().split("\n").slice(-2).join(" "), stashes };
		return { stashes };
	},
	async "git.revertHunk"(body) {
		const cwd = String(body.cwd ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
		if (!root) return { error: "not a git repository" };
		const rel = await repoRelPath(cwd, root, body.path);
		if (rel === "") return { error: "path is required" };
		const hunkIndex = Number(body.hunkIndex);
		if (!Number.isInteger(hunkIndex) || hunkIndex < 0) return { error: "invalid hunk index" };
		// Re-derive the diff fresh so the patch always matches current HEAD and
		// worktree bytes; a stale client view simply fails to find its hunk.
		const diffRes = await runGit(root, ["diff", "--no-color", "-U3", "HEAD", "--", litPathspec(rel)]);
		if (diffRes.failed) return { error: (diffRes.stderr || "git diff failed").trim() };
		const patch = extractHunk(diffRes.stdout, hunkIndex);
		if (patch === null) return { error: "hunk not found (the diff may have changed — refresh)" };
		// Concurrency guard: the client sends the hunk header it rendered. If
		// the file changed since (an agent editing alongside is the norm here),
		// the index may point at a different hunk — refuse instead of silently
		// reverting the wrong change.
		const wantHeader = String(body.hunkHeader ?? "");
		if (wantHeader !== "") {
			const rangeOf = (s) => /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.exec(s)?.[0] ?? "";
			const gotLine = patch.split("\n").find((l) => l.startsWith("@@")) ?? "";
			if (rangeOf(wantHeader) !== "" && rangeOf(wantHeader) !== rangeOf(gotLine)) {
				return { error: "diff has changed since it was rendered; refresh and retry", status: await gitStatusAt(root) };
			}
		}
		// Reverse-apply through stdin ("-"): worktree-only, index untouched.
		const res = await runGit(root, ["apply", "-R", "--whitespace=nowarn", "-"], 30000, patch);
		const status = await gitStatusAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || "git apply -R failed").trim().split("\n").filter(Boolean).slice(-2).join(" "), status };
		return { status };
	},
	async "skills.list"(body) {
		return { skills: await listSkills(String(body.cwd ?? "")) };
	},
	async "skills.read"(body) {
		return await readSkill(String(body.cwd ?? ""), String(body.path ?? ""));
	},
	async "skills.write"(body) {
		return await writeSkill(String(body.cwd ?? ""), String(body.path ?? ""), String(body.content ?? ""));
	},
	async "skills.create"(body) {
		return await createSkill(String(body.cwd ?? ""), body.name, body.scope);
	},
	async "skills.delete"(body) {
		return await deleteSkill(String(body.cwd ?? ""), String(body.path ?? ""));
	},
	// Long-poll live change delivery; ctx carries {req, res} for response-close teardown.
	// Collection-on-disk: a directory of .bru files, Git-friendly and shared
	// between the panel and the Agent. Load returns raw texts (parsing lives
	// client-side with brucol); save writes one file through the normal fence.
	async "collection.load"(body) {
		const cwd = String(body.cwd ?? "");
		const dir = String(body.dir ?? "");
		if (cwd === "") throw new Error("cwd is required");
		const root = await realpath(cwd);
		const dirAbs = resolve(root, dir === "" ? "." : dir);
		const relDir = relative(root, dirAbs);
		if (relDir.startsWith("..") || isAbsolute(relDir)) return { error: "directory is outside the workspace" };
		let entries;
		try {
			entries = await readdir(dirAbs, { withFileTypes: true, recursive: true });
		} catch (error) {
			return { error: `cannot read collection directory: ${String(error?.message ?? error)}` };
		}
		const files = [];
		for (const ent of entries) {
			if (!ent.isFile()) continue;
			const parent = relative(dirAbs, ent.parentPath ?? dirAbs).split(/[\\/]/).join("/");
			const rel = parent === "" ? ent.name : `${parent}/${ent.name}`;
			if (!ent.name.endsWith(".bru")) continue;
			if (rel.split("/").some((seg) => seg.startsWith("."))) continue;
			try {
				const text = await readFile(join(dirAbs, rel), "utf8");
				files.push({ path: rel, text: text.slice(0, 256 * 1024) });
			} catch { /* unreadable: skip */ }
			if (files.length >= 200) break;
		}
		return { dir: relDir === "." ? "" : relDir, files };
	},
	async "collection.save"(body) {
		const cwd = String(body.cwd ?? "");
		const dir = String(body.dir ?? "");
		const name = String(body.name ?? "").trim();
		const text = String(body.text ?? "");
		if (cwd === "") throw new Error("cwd is required");
		if (name === "" || /[\\/]|\.\./.test(name) || name.startsWith(".")) return { error: "invalid collection entry name" };
		if (text.length > 256 * 1024) return { error: "entry too large" };
		const root = await realpath(cwd);
		const relDir = relative(root, resolve(root, dir === "" ? "." : dir));
		if (relDir.startsWith("..") || isAbsolute(relDir)) return { error: "directory is outside the workspace" };
		if (relDir !== "." && dir !== "") {
			const probe = await lstat(resolve(root, dir)).then((s) => s.isDirectory(), () => false);
			if (!probe) return { error: "collection directory does not exist — create it first" };
		}
		const fileRel = (relDir === "." ? "" : `${relDir}/`) + `${name}.bru`;
		const abs = join(root, fileRel);
		let prevMtime = null;
		try {
			prevMtime = (await lstat(abs)).mtimeMs;
		} catch { /* new file */ }
		if (prevMtime !== null && Number.isFinite(body.baseMtime) && prevMtime !== body.baseMtime) {
			return { error: "file was modified on disk; reload before saving" };
		}
		await writeFile(abs, text, "utf8");
		const after = await lstat(abs);
		return { path: fileRel, mtimeMs: after.mtimeMs, created: prevMtime === null };
	},
	async "watch.poll"(body, ctx) {
		return await watchPoll(body, ctx);
	},
	async "api.streamPoll"(body, ctx) {
		return pollStream(body, ctx);
	},
	async "api.streamStop"(body) {
		return stopStream(body);
	},
	async "task.scripts"(body) {
		return await scriptsFor(body);
	},
	async "task.start"(body) {
		return await startTask(body);
	},
	async "task.poll"(body, ctx) {
		return await pollTask(body, ctx);
	},
	async "task.kill"(body) {
		return await killTask(body);
	},
	async "collection.run"(body) {
		const cwd = String(body.cwd ?? "");
		const dir = String(body.dir ?? "");
		const envStore = body.envStore ?? { envs: [], activeId: null };
		const sendFn = async (resolved) => {
			const res = await routes["api.send"]({ ...resolved }, {});
			if (!res.ok) throw new Error(res.error ?? "send failed");
			return res;
		};
		return await runCollection(cwd, dir, envStore, sendFn);
	},
	async "terminal.open"(body) {
		return await openExternalTerminal({ cwd: String(body.cwd ?? ""), app: String(body.app ?? "") });
	},
	/** Parse a .proto (plus its imports) into the method list the RPC panel shows. */
	async "rpc.proto"(body) {
		const cwd = String(body.cwd ?? "");
		const path = String(body.path ?? "");
		if (path === "") return { error: "a .proto path is required" };
		const { schema, files } = await loadProtoSchema(cwd, path);
		const methods = listMethods(schema).map((method) => ({
			...method,
			// A ready-to-edit request body: the zero value of every field.
			sample: sampleMessage(schema, method.request),
		}));
		return { files, package: schema.package, methods };
	},
	/** Learn a server's schema through gRPC reflection (no .proto file needed). */
	async "rpc.discover"(body) {
		const url = String(body.url ?? "");
		if (url === "") return { error: "a server address is required" };
		let found;
		try {
			found = await discover(url, { insecureTls: body.insecureTls === true, timeoutMs: Number(body.timeoutMs) || 10_000 });
		} catch (error) {
			return { error: String(error?.message ?? error), unsupported: true };
		}
		const id = randomUUID();
		discoveredSchemas.set(id, { schema: found.schema, at: Date.now() });
		// Bounded cache: a panel that rediscovers repeatedly must not grow it.
		if (discoveredSchemas.size > 8) {
			const oldest = [...discoveredSchemas.entries()].sort((a, b) => a[1].at - b[1].at)[0];
			discoveredSchemas.delete(oldest[0]);
		}
		return {
			schemaId: id,
			reflection: found.target,
			services: found.services,
			files: found.files,
			package: found.schema.package,
			methods: listMethods(found.schema).map((method) => ({ ...method, sample: sampleMessage(found.schema, method.request) })),
		};
	},
	/** Perform one gRPC call through the parsed schema. */
	async "rpc.call"(body) {
		const cwd = String(body.cwd ?? "");
		const protoPath = String(body.proto ?? "");
		const methodPath = String(body.method ?? "");
		if (protoPath === "" && !body.schemaId) return { error: "select a .proto first, or use Discover" };
		if (methodPath === "") return { error: "select a method first" };
		// A discovered schema (reflection) replaces the file: the descriptors are
		// already in memory, keyed by the id the discover route returned.
		let schema;
		if (typeof body.schemaId === "string" && body.schemaId !== "") {
			const cached = discoveredSchemas.get(body.schemaId);
			if (!cached) return { error: "the discovered schema is gone — run Discover again" };
			schema = cached.schema;
		} else {
			({ schema } = await loadProtoSchema(cwd, protoPath));
		}
		const methods = listMethods(schema);
		const method = methods.find((entry) => entry.path === methodPath)
			?? methods.find((entry) => entry.path.endsWith(methodPath));
		if (!method) return { error: `method not found in the protos: ${methodPath}` };
		const payload = Array.isArray(body.messages) ? body.messages : [];
		// A unary call without a body still sends the message's zero value, which
		// is what every gRPC tool does (an empty body is a protocol error).
		const messages = payload.length > 0 ? payload : [sampleMessage(schema, method.request)];
		try {
			const value = await grpcCall({
				url: String(body.url ?? ""),
				path: method.path,
				schema,
				requestType: method.request,
				responseType: method.response,
				messages,
				metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
				timeoutMs: Number(body.timeoutMs) || 30_000,
				rejectUnauthorized: body.insecureTls !== true,
			});
			return { ...value, method: { path: method.path, request: method.request, response: method.response, serverStreaming: method.serverStreaming, clientStreaming: method.clientStreaming } };
		} catch (error) {
			return { error: String(error?.message ?? error), method: { path: method.path } };
		}
	},
};

export { routes };
