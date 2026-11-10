/** The POST route table served under API_PREFIX; every handler takes the parsed JSON body and returns the `value` payload. */

import { realpath } from "node:fs/promises";
import { lstat, mkdir, rename as renameFs, rm, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { insideFence, listFencedDir, readFencedText, resolveFencedTarget, resolveReadTarget, writeFencedText } from "./fence.js";
import { fenceRepo, gitBlame, gitDiff, gitRepoRoot, gitStatus, gitStatusAt, repoRelPath, runGit } from "./git.js";
import { fuzzyScore, searchCandidates, textSearch } from "./search.js";
import { descriptorForPath, findProjectRoot, serverFor, servers } from "./lsp.js";
import { createSkill, deleteSkill, listSkills, readSkill, writeSkill } from "./skills.js";

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
		return await writeFencedText(String(body.cwd ?? ""), String(body.path ?? ""), String(body.content ?? ""));
	},
	async "fs.create"(body) {
		const cwd = String(body.cwd ?? "");
		const requested = String(body.path ?? "");
		if (requested === "") return { error: "path is required" };
		const root = await realpath(cwd);
		const candidate = resolve(root, requested);
		if (!insideFence(root, candidate)) return { error: "path is outside the session workspace" };
		const exists = await lstat(candidate).then(() => true, () => false);
		if (exists) return { error: "path already exists" };
		if (body.kind === "dir") await mkdir(candidate);
		else await writeFile(candidate, "", "utf8");
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
		const root = await realpath(cwd);
		const dest = resolve(root, to);
		if (!insideFence(root, dest)) return { error: "path is outside the session workspace" };
		const destExists = await lstat(dest).then(() => true, () => false);
		if (destExists) return { error: "target already exists" };
		await renameFs(target.filename, dest);
		return { path: to };
	},
	async "git.status"(body) {
		return await gitStatus(String(body.cwd ?? ""), body.repo ? String(body.repo) : "");
	},
	async "git.diff"(body) {
		const scope = body.scope === "branch" ? "branch" : body.scope === "commit" ? "commit" : "working";
		return await gitDiff(String(body.cwd ?? ""), String(body.path ?? ""), scope, body.repo ? String(body.repo) : "", body.sha ? String(body.sha) : "");
	},
	async "git.fetch"(body) {
		const cwd = String(body.cwd ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
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
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
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
		const uri = pathToFileURL(target.filename).href;
		return { items: server.diagnostics.get(uri) ?? [] };
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
		return { state: best.state, message: best.message, progress: best.progressLine(), label: best.label };
	},
	async "search.files"(body) {
		const cwd = String(body.cwd ?? "");
		const query = String(body.query ?? "").trim();
		const limit = Math.max(1, Math.min(200, Number(body.limit ?? 60)));
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
		return await textSearch(root, query, body.include ? String(body.include) : "", Number(body.limit ?? 200), { regex: body.regex === true, words: body.words === true });
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
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
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
			const buf = Buffer.from(await res.arrayBuffer());
			const CAP = 2 * 1024 * 1024;
			const truncated = buf.length > CAP;
			const text = (truncated ? buf.subarray(0, CAP) : buf).toString("utf8");
			return {
				status: res.status,
				statusText: res.statusText,
				headers: [...res.headers.entries()],
				text,
				ms: Date.now() - started,
				size: buf.length,
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
	async "git.discard"(body) {
		const cwd = String(body.cwd ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
		if (!root) return { error: "not a git repository" };
		const rel = await repoRelPath(cwd, root, body.path);
		if (rel === "") return { error: "path is required" };
		// Staged additions have no HEAD blob: unstage instead of checkout (never deletes).
		const args = String(body.ch ?? "M") === "A"
			? ["restore", "--staged", "--", rel]
			: ["checkout", "HEAD", "--", rel];
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
		const args = rel === "" ? ["add", "-A"] : ["add", "-A", "--", rel];
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
		if (head.ok && head.stdout.trim()) args = rel === "" ? ["reset", "--"] : ["restore", "--staged", "--", rel];
		else args = rel === "" ? ["rm", "--cached", "-r", "--ignore-unmatch", "--", "."] : ["rm", "--cached", "-r", "--ignore-unmatch", "--", rel];
		const res = await runGit(root, args);
		const status = await gitStatusAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || "git unstage failed").trim().split("\n").slice(-2).join(" "), status };
		return { status };
	},
	async "git.commit"(body) {
		const cwd = String(body.cwd ?? "");
		const root = body.repo ? await fenceRepo(cwd, String(body.repo)) : await gitRepoRoot(cwd);
		if (!root) return { error: "not a git repository" };
		const message = String(body.message ?? "").trim();
		if (message === "") return { error: "commit message is required" };
		if (Buffer.byteLength(message, "utf8") > 8192) return { error: "commit message too long" };
		// execFile passes the message as one argv element: no shell, no flag
		// injection through the message text. Hooks may run, hence 60s.
		const res = await runGit(root, ["commit", "-m", message], 60000);
		const status = await gitStatusAt(root);
		if (res.failed) return { error: (res.stderr || res.stdout || "git commit failed").trim().split("\n").slice(-2).join(" "), status };
		const info = await runGit(root, ["log", "-1", "--format=%h %s"]);
		return { status, commit: info.ok ? info.stdout.trim() : "" };
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
};

export { routes };
