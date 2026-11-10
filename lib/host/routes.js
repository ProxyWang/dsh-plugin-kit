/** The POST route table served under API_PREFIX; every handler takes the parsed JSON body and returns the `value` payload. */

import { realpath } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { listFencedDir, readFencedText, resolveFencedTarget } from "./fence.js";
import { fenceRepo, gitDiff, gitRepoRoot, gitStatus, gitStatusAt, runGit } from "./git.js";
import { fuzzyScore, searchCandidates, textSearch } from "./search.js";
import { findModuleRoot, serverFor, servers } from "./lsp.js";

const routes = {
	async "fs.list"(body) {
		return await listFencedDir(String(body.cwd ?? ""), String(body.path ?? ""));
	},
	async "fs.read"(body) {
		const { filename, ...result } = await readFencedText(String(body.cwd ?? ""), String(body.path ?? ""));
		void filename;
		return result;
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
		if (!path.endsWith(".go")) {
			if (kind === "hover") return { hover: "" };
			if (kind === "symbol") return { symbols: [] };
			return { targets: [], note: "LSP jumps are Go-only in this build (gopls)" };
		}
		const target = await resolveFencedTarget(cwd, path);
		const server = await serverFor(await findModuleRoot(target.filename, target.root));
		await server.ensureStarted();
		server.touchIdle();
		const result = await server.symbolRequest(kind, target.filename, Number(body.line ?? 1), Number(body.col ?? 1));
		result.status = { state: server.state, message: server.message, progress: server.progressLine() };
		return result;
	},
	async "lsp.diagnostics"(body) {
		const cwd = String(body.cwd ?? "");
		const path = String(body.path ?? "");
		if (!path.endsWith(".go")) return { items: [] };
		let target;
		let server;
		let moduleRoot;
		try {
			target = await resolveFencedTarget(cwd, path);
			moduleRoot = await findModuleRoot(target.filename, target.root);
			server = servers.get(await realpath(moduleRoot));
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
		for (const [root, server] of servers) {
			if (root === key || root.startsWith(`${key}/`)) {
				if (!best || (server.state === "ready" && best.state !== "ready")) best = server;
			}
		}
		if (!best) return { state: "off", message: "" };
		return { state: best.state, message: best.message, progress: best.progressLine() };
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
		return await textSearch(root, query, body.include ? String(body.include) : "", Number(body.limit ?? 200));
	},
};

export { routes };
