/**
 * Host half of @local/dsh-code-explorer.
 *
 * Serves one JSON API prefix `/code-explorer/api` for this package's Client
 * half (same private-route pattern the installed dsh-inline-diff bundle uses):
 *
 *   POST fs.list        {cwd, path}   → directory entries (workspace-fenced)
 *   POST fs.read        {cwd, path}   → bounded text (workspace-fenced)
 *   POST git.status     {cwd}         → repo/branch/base/working/branch files/commits
 *   POST git.diff       {cwd, path, scope} → unified diff text for one file
 *   POST lsp.request    {cwd, path, kind, line, col} → definition / implementation /
 *                                       typeDefinition / references / hover results,
 *                                       positions converted to 1-based
 *   POST lsp.diagnostics {cwd, path}  → latest gopls diagnostics for an open doc
 *   POST lsp.status     {cwd}         → {state:'off'|'starting'|'ready'|'error', message}
 *
 * LSP: one lazily-spawned `gopls` process per resolved workspace root, speaking
 * JSON-RPC over stdio. Documents are opened from disk on demand and re-synced
 * when their mtime changes. Servers idle for LSP_IDLE_MS are shut down; all
 * servers die with this plugin's effect.
 */

import { spawn, execFile } from "node:child_process";
import { access, lstat, readFile, readdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, basename, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const API_PREFIX = "/code-explorer/api";
const READ_CAP = 4 * 1024 * 1024;
const DIFF_CAP = 2 * 1024 * 1024;
const BODY_CAP = 1 * 1024 * 1024;
const LIST_CAP = 4000;
const LSP_TIMEOUT_MS = 30000;
const LSP_FIRST_TIMEOUT_MS = 90000;
const LSP_IDLE_MS = 5 * 60 * 1000;
const GIT_LOG_CAP = 200;

/* ---------- shared helpers ---------- */

function respondJson(res, status, payload) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
	return new Promise((resolvePromise, rejectPromise) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			size += buf.length;
			if (size > BODY_CAP) {
				rejectPromise(new Error("request body too large"));
				req.destroy();
				return;
			}
			chunks.push(buf);
		});
		req.on("end", () => {
			try {
				const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				if (parsed === null || typeof parsed !== "object") throw new Error("body must be a JSON object");
				resolvePromise(parsed);
			} catch (error) {
				rejectPromise(error);
			}
		});
		req.on("error", rejectPromise);
	});
}

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

/* ---------- git ---------- */

function runGit(cwd, args, timeoutMs) {
	return new Promise((resolvePromise) => {
		execFile("git", ["-C", cwd, ...args], { maxBuffer: 32 * 1024 * 1024, encoding: "utf8", timeout: timeoutMs ?? 10000, killSignal: "SIGKILL" }, (error, stdout, stderr) => {
			resolvePromise({ ok: !error || stdout !== "", failed: !!error, stdout: stdout ?? "", stderr: stderr ?? "", code: typeof error?.code === "number" ? error.code : error ? 1 : 0 });
		});
	});
}

async function gitRepoRoot(cwd) {
	const result = await runGit(cwd, ["rev-parse", "--show-toplevel"]);
	if (!result.ok) return null;
	return result.stdout.trim() || null;
}

async function detectBase(cwd, branch) {
	// Preferred: the remote HEAD symbolic ref.
	let res = await runGit(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
	if (res.ok) {
		const name = res.stdout.trim().replace(/^origin\//, "");
		if (name && name !== branch) return name;
	}
	for (const candidate of ["origin/main", "main", "origin/master", "master"]) {
		if (candidate === branch || `origin/${branch}` === candidate) continue;
		res = await runGit(cwd, ["rev-parse", "--verify", "--quiet", candidate]);
		if (res.ok && res.stdout.trim()) return candidate;
	}
	return null;
}

function parsePorcelainZ(out) {
	const tokens = out.split("\0");
	const files = [];
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (!token || token.length < 4) continue;
		const xy = token.slice(0, 2);
		let path = token.slice(3);
		let from;
		if ((xy[0] === "R" || xy[1] === "R" || xy[0] === "C" || xy[1] === "C") && i + 1 < tokens.length) {
			// -z format: the primary path is the destination; the source follows after NUL.
			from = tokens[++i] ?? null;
		}
		files.push({ path, xy, from: from ?? null });
	}
	return files;
}

async function gitStatusAt(root) {
	const branchRes = await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
	const branch = branchRes.ok ? branchRes.stdout.trim() : "?";
	const statusRes = await runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
	const working = statusRes.ok ? parsePorcelainZ(statusRes.stdout) : [];
	const baseName = await detectBase(root, branch);
	let base = null;
	let branchFiles = [];
	let commits = [];
	if (baseName) {
		const mergeRes = await runGit(root, ["merge-base", "HEAD", baseName]);
		if (mergeRes.ok && mergeRes.stdout.trim()) {
			const mergeBase = mergeRes.stdout.trim();
			base = { name: baseName, mergeBase };
			const namesRes = await runGit(root, ["diff", "--name-only", "-z", mergeBase, "HEAD"]);
			branchFiles = namesRes.ok ? namesRes.stdout.split("\0").filter(Boolean) : [];
			const logRes = await runGit(root, ["log", "--format=%h\u001f%s", `${mergeBase}..HEAD`, `-${GIT_LOG_CAP}`]);
			if (logRes.ok) {
				commits = logRes.stdout.split("\n").filter(Boolean).map((line) => {
					const at = line.indexOf("\u001f");
					return { hash: line.slice(0, at), subject: line.slice(at + 1) };
				});
			}
		}
	}
	// Remote-tracking state of the current branch: real upstream, else origin/<branch> if the ref exists.
	let upstream = null;
	let upstreamInferred = false;
	const upRes = await runGit(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
	const upName = upRes.ok ? upRes.stdout.trim() : "";
	if (upName && !upName.includes("@{")) {
		upstream = upName;
	} else if (branch && branch !== "?" && branch !== "HEAD") {
		const guess = await runGit(root, ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}`]);
		if (guess.ok && guess.stdout.trim()) {
			upstream = `origin/${branch}`;
			upstreamInferred = true;
		}
	}
	let ahead = 0;
	let behind = 0;
	if (upstream) {
		const lr = await runGit(root, ["rev-list", "--left-right", "--count", `${upstream}...HEAD`]);
		if (lr.ok) {
			const parts = lr.stdout.trim().split(/\s+/).map(Number);
			behind = Number.isFinite(parts[0]) ? parts[0] : 0;
			ahead = Number.isFinite(parts[1]) ? parts[1] : 0;
		}
	}
	return { repo: true, root, branch, base, working, branchFiles, commits, upstream, upstreamInferred, ahead, behind };
}

/** Session cwd may itself be a repo, or a parent folder of several repos. */
async function gitStatus(cwd, repoHint) {
	if (repoHint) {
		const root = await fenceRepo(cwd, repoHint);
		return await gitStatusAt(root);
	}
	const root = await gitRepoRoot(cwd);
	if (root) return await gitStatusAt(root);
	return { repo: false, repos: await discoverRepos(await realpath(cwd)) };
}

async function hasDotGit(dir) {
	try {
		await lstat(join(dir, ".git"));
		return true;
	} catch {
		return false;
	}
}

/** Discover git repos up to two directories below the session cwd. */
async function discoverRepos(root) {
	const found = [];
	const scan = async (dir, depth) => {
		if (found.length >= 20) return;
		let names;
		try {
			names = await readdir(dir);
		} catch {
			return;
		}
		for (const name of names) {
			if (found.length >= 20) return;
			if (name.startsWith(".") || WALK_SKIP.has(name)) continue;
			const full = join(dir, name);
			let st;
			try {
				st = await lstat(full);
			} catch {
				continue;
			}
			if (!st.isDirectory() || st.isSymbolicLink()) continue;
			if (await hasDotGit(full)) {
				found.push(full);
				continue;
			}
			if (depth > 0) await scan(full, depth - 1);
		}
	};
	await scan(root, 1);
	const summaries = [];
	for (const repo of found) {
		const b = await runGit(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
		const s = await runGit(repo, ["status", "--porcelain", "-uno"]);
		summaries.push({
			root: repo,
			branch: b.ok ? b.stdout.trim() : "?",
			dirtyCount: s.ok ? s.stdout.split("\n").filter(Boolean).length : 0,
		});
	}
	return summaries;
}

/** Repo hint must be an absolute path inside the session workspace fence. */
async function fenceRepo(cwd, repoHint) {
	const sessionRoot = await realpath(cwd);
	const repo = await realpath(repoHint);
	if (repo !== sessionRoot && !insideFence(sessionRoot, repo)) {
		throw new Error("repo is outside the session workspace");
	}
	if (!await hasDotGit(repo)) throw new Error("not a git repository");
	return repo;
}

function synthesizeAddDiff(text, path) {
	const lines = text.split("\n");
	if (lines.length && lines[lines.length - 1] === "") lines.pop();
	const count = lines.length;
	const body = lines.map((line) => `+${line}`).join("\n");
	return `--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${count} @@\n${body}${count ? "\n\\ No newline at end of file\n" : "\n"}`;
}

async function gitDiff(cwd, requestedPath, scope, repoHint, sha) {
	const root = repoHint ? await fenceRepo(cwd, repoHint) : await gitRepoRoot(cwd);
	if (!root) return { error: "not a git repository" };
	if (scope === "commit") {
		if (!/^[0-9a-zA-Z^~_./-]{4,64}$/.test(sha ?? "")) return { error: "invalid commit id" };
		const verify = await runGit(root, ["rev-parse", "--verify", "--quiet", `${sha}^{commit}`]);
		if (!verify.ok) return { error: "unknown commit" };
		const parent = await runGit(root, ["rev-parse", "--verify", "--quiet", `${sha}^`]);
		const from = parent.ok && parent.stdout.trim() ? parent.stdout.trim() : "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
		const res = await runGit(root, ["diff", "--no-color", "-U3", from, sha]);
		const info = await runGit(root, ["log", "-1", "--format=%h %s", sha]);
		if (!res.ok) return { error: res.stderr || "git diff failed" };
		return { diff: truncate(res.stdout, DIFF_CAP), scope: "commit", commit: info.ok ? info.stdout.trim() : sha };
	}
	const relPath = relative(root, resolve(root, requestedPath)).split(/[\\/]/).join("/");
	if (!relPath || relPath.startsWith("..")) return { error: "path is outside the repository" };
	if (scope === "branch") {
		const status = await gitStatusAt(root);
		if (!status.base) return { error: "no base branch detected" };
		const res = await runGit(root, ["diff", "--no-color", "-U3", status.base.mergeBase, "HEAD", "--", relPath]);
		if (!res.ok) return { error: res.stderr || "git diff failed" };
		return { diff: truncate(res.stdout, DIFF_CAP), scope: "branch", base: status.base.name };
	}
	const statusRes = await runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", relPath]);
	const entries = statusRes.ok ? parsePorcelainZ(statusRes.stdout) : [];
	const untracked = entries.some((entry) => entry.xy === "??");
	if (untracked) {
		try {
			const file = await readFencedText(root, relPath);
			if (file.kind !== "text") return { diff: "", note: "binary file" };
			return { diff: truncate(synthesizeAddDiff(file.content, relPath), DIFF_CAP), scope: "working", untracked: true };
		} catch (error) {
			if (await exists(join(root, relPath))) return { diff: "", note: `deleted or unreadable: ${String(error?.message ?? error)}` };
			return { diff: "", note: "deleted file" };
		}
	}
	const res = await runGit(root, ["diff", "--no-color", "-U3", "HEAD", "--", relPath]);
	if (!res.ok) return { error: res.stderr || "git diff failed" };
	return { diff: truncate(res.stdout, DIFF_CAP), scope: "working" };
}

async function exists(path) {
	try {
		await lstat(path);
		return true;
	} catch {
		return false;
	}
}

function truncate(text, cap) {
	return text.length > cap ? `${text.slice(0, cap)}\n… truncated …` : text;
}

/* ---------- search ---------- */

const WALK_SKIP = new Set([".git", "node_modules", "dist", "build", "vendor", "target", "out", "__pycache__", ".venv", "venv", "coverage", ".next", ".cache", ".idea"]);
const WALK_FILE_CAP = 60000;
const WALK_DEPTH_CAP = 14;

async function walkFiles(root) {
	const out = [];
	const stack = [[root, 0]];
	while (stack.length && out.length < WALK_FILE_CAP) {
		const [dir, depth] = stack.pop();
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (out.length >= WALK_FILE_CAP) break;
			if (entry.name.startsWith(".") && entry.isDirectory()) continue;
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (WALK_SKIP.has(entry.name) || depth >= WALK_DEPTH_CAP) continue;
				stack.push([full, depth + 1]);
			} else if (entry.isFile()) {
				out.push(relative(root, full).split(/[\\/]/).join("/"));
			}
		}
	}
	return out;
}

async function gitTrackedFiles(root) {
	const res = await runGit(root, ["ls-files", "-co", "--exclude-standard"]);
	if (!res.ok) return null;
	return res.stdout.split("\n").filter(Boolean);
}

/** Drop vendored/noise paths from candidate lists (Quick Open, both sources). */
function isSearchNoise(path) {
	for (const segment of path.split("/")) {
		if (WALK_SKIP.has(segment)) return true;
	}
	return false;
}

function searchCandidates(root) {
	return gitTrackedFiles(root)
		.then((tracked) => (tracked ?? walkFiles(root)))
		.then((list) => list.filter((path) => !isSearchNoise(path)));
}

/** Subsequence fuzzy score; higher is better, -1 for no match. */
function fuzzyScore(query, path) {
	const q = query.toLowerCase();
	const p = path.toLowerCase();
	let qi = 0;
	let score = 0;
	let streak = 0;
	for (let i = 0; i < p.length && qi < q.length; i++) {
		if (p[i] === q[qi]) {
			qi++;
			streak++;
			score += 1 + streak * 2;
		} else {
			streak = 0;
		}
	}
	if (qi < q.length) return -1;
	const base = p.slice(p.lastIndexOf("/") + 1);
	if (base.startsWith(q)) score += 200;
	if (p.includes(q)) score += 80;
	if (base.includes(q)) score += 120;
	return score - p.length / 50;
}

function splitMatchLine(line, root) {
	const first = line.indexOf(":");
	const second = line.indexOf(":", first + 1);
	if (first < 0 || second < 0) return null;
	let path = line.slice(0, first);
	if (path.startsWith(root)) path = path.slice(root.length + 1);
	const num = Number(line.slice(first + 1, second));
	if (!Number.isFinite(num)) return null;
	return { path: path.split(/[\\/]/).join("/"), line: num, text: line.slice(second + 1).trim().slice(0, 300) };
}

async function textSearch(root, query, include, limit) {
	const caseFlag = query === query.toLowerCase() ? ["-i"] : [];
	const cap = limit ?? 200;
	const runTool = (command, args) => new Promise((resolvePromise) => {
		execFile(command, args, { maxBuffer: 16 * 1024 * 1024, encoding: "utf8", timeout: 15000, killSignal: "SIGKILL" }, (error, stdout) => {
			// grep/rg exit 1 simply means "no matches"; a missing binary reports ENOENT (-1).
			resolvePromise({ code: error ? (typeof error.code === "number" ? error.code : -1) : 0, killed: error?.killed === true, stdout: stdout ?? "" });
		});
	});
	// Prefer ripgrep when present: respects .gitignore, skips binaries, fast.
	const rgArgs = ["--no-heading", "--color", "never", "-Fn", "--max-count", "40", "-g", "!.git", "-g", "!node_modules", "-g", "!dist", "-g", "!build", "-g", "!vendor", ...caseFlag];
	if (include) rgArgs.push("-g", include);
	rgArgs.push("--", query, root);
	const rg = await runTool("rg", rgArgs);
	if (rg.code === 0 || rg.code === 1) {
		const all = rg.stdout.split("\n").filter(Boolean);
		return { engine: "ripgrep", results: all.slice(0, cap).map((l) => splitMatchLine(l, root)).filter(Boolean), truncated: all.length > cap || rg.killed, timedOut: rg.killed };
	}
	const grepArgs = ["-rInF", ...caseFlag, "--exclude-dir=.git", "--exclude-dir=node_modules", "--exclude-dir=dist", "--exclude-dir=build", "--exclude-dir=vendor", "--exclude-dir=target", "-m", "40"];
	if (include) grepArgs.push("--include", include);
	grepArgs.push("--", query, root);
	const grep = await runTool("grep", grepArgs);
	if (grep.code !== 0 && grep.code !== 1) {
		throw new Error(`search failed (grep exit ${grep.code})`);
	}
	const all = grep.stdout.split("\n").filter(Boolean);
	return { engine: "grep", results: all.slice(0, cap).map((l) => splitMatchLine(l, root)).filter(Boolean), truncated: all.length > cap || grep.killed, timedOut: grep.killed };
}

/* ---------- gopls LSP manager ---------- */

function goplsCandidates() {
	const home = homedir();
	const list = [];
	if (process.env.GOBIN) list.push(join(process.env.GOBIN, "gopls"));
	if (process.env.GOPATH) {
		for (const part of process.env.GOPATH.split(isAbsolute("/gopls") ? ":" : ";")) {
			if (part) list.push(join(part, "bin", "gopls"));
		}
	}
	list.push(join(home, "gopath", "bin", "gopls"));
	list.push(join(home, "go", "bin", "gopls"));
	list.push("/opt/homebrew/bin/gopls");
	list.push("/usr/local/bin/gopls");
	list.push("gopls");
	return list;
}

class LspServer {
	constructor(root) {
		this.root = root;
		this.rootUri = pathToFileURL(root).href;
		this.child = null;
		this.state = "off"; // off | starting | ready | error
		this.message = "";
		this.seq = 0;
		this.pending = new Map();
		this.buffer = Buffer.alloc(0);
		this.docs = new Map(); // uri → {version, mtimeMs, path}
		this.diagnostics = new Map(); // uri → items[]
		this.progress = new Map(); // token → {title, message, percentage}
		this.idleTimer = null;
		this.candidates = goplsCandidates();
		this.candidateIndex = 0;
	}

	touchIdle() {
		if (this.idleTimer) clearTimeout(this.idleTimer);
		this.idleTimer = setTimeout(() => this.stop("idle"), LSP_IDLE_MS);
		this.idleTimer.unref?.();
	}

	async ensureStarted() {
		if (this.state === "ready") return;
		if (this.state === "starting") {
			await this.startPromise;
			return;
		}
		this.state = "starting";
		this.startPromise = this.start();
		try {
			await this.startPromise;
			this.state = "ready";
			this.message = "";
		} catch (error) {
			this.state = "error";
			this.message = String(error?.message ?? error);
			this.startPromise = null;
			throw error;
		}
	}

	async start() {
		let lastError = null;
		for (let i = this.candidateIndex; i < this.candidates.length; i++) {
			const command = this.candidates[i];
			try {
				await this.spawnAndInitialize(command);
				this.candidateIndex = i;
				return;
			} catch (error) {
				lastError = error;
			}
		}
		throw lastError ?? new Error("gopls not found");
	}

	spawnAndInitialize(command) {
		return new Promise((resolvePromise, rejectPromise) => {
			let child;
			try {
				child = spawn(command, ["serve"], {
					cwd: this.root,
					env: { ...process.env, GOFLAGS: process.env.GOFLAGS ?? "" },
					stdio: ["pipe", "pipe", "pipe"],
				});
			} catch (error) {
				rejectPromise(error);
				return;
			}
			let settled = false;
			const fail = (error) => {
				if (settled) return;
				settled = true;
				try {
					child.kill("SIGKILL");
				} catch {}
				rejectPromise(error);
			};
			child.once("error", fail);
			this.child = child;
			child.stdout.on("data", (chunk) => this.onBytes(chunk));
			child.stderr.resume();
			child.on("exit", () => {
				if (this.child === child) {
					this.state = "off";
					this.child = null;
					for (const entry of this.pending.values()) entry.reject(new Error("gopls exited"));
					this.pending.clear();
					this.docs.clear();
				}
				fail(new Error("gopls exited before ready"));
			});
			const initId = this.nextId();
			this.pending.set(initId, {
				resolve: () => {
					this.notify("initialized", {});
					if (!settled) {
						settled = true;
						resolvePromise();
					}
				},
				reject: fail,
				timer: setTimeout(() => fail(new Error("gopls initialize timeout")), LSP_FIRST_TIMEOUT_MS),
			});
			this.write({
				jsonrpc: "2.0",
				id: initId,
				method: "initialize",
				params: {
					processId: null,
					clientInfo: { name: "dsh-code-explorer", version: "1.0.0" },
					rootUri: this.rootUri,
					capabilities: {
						textDocument: {
							definition: { linkSupport: false },
							typeDefinition: { linkSupport: false },
							implementation: { linkSupport: false },
							references: {},
							documentSymbol: { hierarchicalDocumentSymbolSupport: true },
							hover: { contentFormat: ["markdown", "plaintext"] },
							publishDiagnostics: { relatedInformation: true, versionSupport: false },
							synchronization: { dynamicRegistration: false },
						},
						window: { workDoneProgress: true },
						workspace: { didChangeWatchedFiles: { dynamicRegistration: false }, configuration: false },
					},
					workspaceFolders: [{ uri: this.rootUri, name: basename(this.root) }],
					initializationOptions: {},
				},
			});
		});
	}

	nextId() {
		return ++this.seq;
	}

	write(message) {
		if (!this.child?.stdin?.writable) throw new Error("gopls is not running");
		const body = Buffer.from(JSON.stringify(message), "utf8");
		this.child.stdin.write(Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"));
		this.child.stdin.write(body);
	}

	notify(method, params) {
		try {
			this.write({ jsonrpc: "2.0", method, params });
		} catch {}
	}

	request(method, params, timeoutMs = LSP_TIMEOUT_MS) {
		return new Promise((resolvePromise, rejectPromise) => {
			let id;
			try {
				id = this.nextId();
				this.write({ jsonrpc: "2.0", id, method, params });
			} catch (error) {
				rejectPromise(error);
				return;
			}
			this.pending.set(id, {
				resolve: resolvePromise,
				reject: rejectPromise,
				timer: setTimeout(() => {
					this.pending.delete(id);
					rejectPromise(new Error(`LSP request "${method}" timed out`));
				}, timeoutMs),
			});
		});
	}

	onBytes(chunk) {
		this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
		for (;;) {
			const headerEnd = this.buffer.indexOf("\r\n\r\n", 0, "ascii");
			if (headerEnd < 0) return;
			const header = this.buffer.subarray(0, headerEnd).toString("ascii");
			const match = /content-length:\s*(\d+)/i.exec(header);
			if (!match) {
				this.buffer = this.buffer.subarray(headerEnd + 4);
				continue;
			}
			const length = Number(match[1]);
			const total = headerEnd + 4 + length;
			if (this.buffer.length < total) return;
			const body = this.buffer.subarray(headerEnd + 4, total);
			this.buffer = this.buffer.subarray(total);
			let message;
			try {
				message = JSON.parse(body.toString("utf8"));
			} catch {
				continue;
			}
			this.handleMessage(message);
		}
	}

	handleMessage(message) {
		if (message?.id !== undefined && message.method === undefined) {
			const entry = this.pending.get(message.id);
			if (entry) {
				this.pending.delete(message.id);
				clearTimeout(entry.timer);
				if (message.error) entry.reject(new Error(message.error.message ?? "LSP error"));
				else entry.resolve(message.result);
			}
			return;
		}
		if (message?.id !== undefined && message.method) {
			// Server-to-client request: decline politely.
			try {
				this.write({ jsonrpc: "2.0", id: message.id, result: message.method === "workspace/configuration" ? [] : null });
			} catch {}
			return;
		}
		if (message?.method === "$/progress") {
			const p = message.params ?? {};
			if (typeof p.token === "string" || typeof p.token === "number") {
				const kind = p.value?.kind;
				if (kind === "begin") this.progress.set(String(p.token), { title: String(p.value.title ?? "gopls"), message: p.value.message ? String(p.value.message) : "", percentage: Number.isFinite(p.value.percentage) ? p.value.percentage : undefined });
				else if (kind === "report") this.progress.set(String(p.token), { title: String(p.value.title ?? this.progress.get(String(p.token))?.title ?? "gopls"), message: p.value.message ? String(p.value.message) : "", percentage: Number.isFinite(p.value.percentage) ? p.value.percentage : undefined });
				else if (kind === "end") this.progress.delete(String(p.token));
			}
			return;
		}
		if (message?.method === "textDocument/publishDiagnostics") {
			const uri = message.params?.uri;
			if (typeof uri === "string") {
				this.diagnostics.set(
					uri,
					(message.params.diagnostics ?? []).map((item) => ({
						line: (item.range?.start?.line ?? 0) + 1,
						startCol: (item.range?.start?.character ?? 0) + 1,
						endCol: (item.range?.end?.character ?? item.range?.start?.character ?? 0) + 1,
						endLine: (item.range?.end?.line ?? item.range?.start?.line ?? 0) + 1,
						severity: item.severity ?? 1,
						message: String(item.message ?? "").split("\n")[0],
						source: item.source ?? "",
						code: item.code === undefined ? "" : String(item.code),
					})),
				);
			}
		}
	}

	/** One-line summary of active work-progress notifications, for status surfaces. */
	progressLine() {
		const parts = [];
		for (const item of this.progress.values()) {
			const pct = item.percentage === undefined ? "" : ` ${item.percentage}%`;
			parts.push(`${item.title}${item.message ? `: ${item.message}` : ""}${pct}`);
			if (parts.length >= 2) break;
		}
		const line = parts.join(" · ");
		return line.length > 220 ? `${line.slice(0, 220)}…` : line;
	}

	async ensureDocument(path) {
		const target = await resolveFencedTarget(this.root, path);
		if (!target.stat.isFile()) throw new Error("not a regular file");
		const uri = pathToFileURL(target.filename).href;
		const known = this.docs.get(uri);
		if (known && known.mtimeMs === target.stat.mtimeMs && !known.stale) return { uri, path: target.filename };
		const file = await readFencedText(this.root, path);
		if (file.kind !== "text") throw new Error("binary file");
		const version = (known?.version ?? 0) + 1;
		if (known) {
			this.notify("textDocument/didChange", {
				textDocument: { uri, version },
				contentChanges: [{ text: file.content }],
			});
		} else {
			this.notify("textDocument/didOpen", {
				textDocument: { uri, languageId: languageIdFor(target.filename), version, text: file.content },
			});
		}
		this.docs.set(uri, { version, mtimeMs: target.stat.mtimeMs, path: target.filename, stale: false });
		return { uri, path: target.filename };
	}

	locationToEntry(location) {
		let uri = location.uri ?? location.targetUri;
		const range = location.range ?? location.targetSelectionRange ?? location.targetRange;
		if (typeof uri !== "string" || !range) return null;
		let path;
		try {
			path = fileURLToPath(uri);
		} catch {
			return null;
		}
		return {
			path,
			line: (range.start?.line ?? 0) + 1,
			col: (range.start?.character ?? 0) + 1,
			endLine: (range.end?.line ?? 0) + 1,
			endCol: (range.end?.character ?? 0) + 1,
		};
	}

	async symbolRequest(kind, path, line, col) {
		const doc = await this.ensureDocument(path);
		if (kind === "symbol") {
			const result = await this.request("textDocument/documentSymbol", { textDocument: { uri: doc.uri } });
			const symbols = [];
			const walk = (node) => {
				if (!node || typeof node.name !== "string") return;
				const sel = node.selectionRange ?? node.range;
				if (node.location === void 0) {
					symbols.push({ name: node.name, kind: node.kind ?? 0, line: (sel?.start?.line ?? 0) + 1, col: (sel?.start?.character ?? 0) + 1 });
				} else {
					const entry = this.locationToEntry(node.location);
					if (entry) symbols.push({ name: node.name, kind: node.kind ?? 0, line: entry.line, col: entry.col, path: entry.path });
				}
				for (const child of node.children ?? []) walk(child);
			};
			for (const node of Array.isArray(result) ? result : []) walk(node);
			symbols.sort((a, b) => a.line - b.line);
			return { symbols };
		}
		const params = { textDocument: { uri: doc.uri }, position: { line: Math.max(0, line - 1), character: Math.max(0, col - 1) } };
		let result;
		if (kind === "hover") {
			result = await this.request("textDocument/hover", params);
			return { hover: hoverToText(result) };
		}
		if (kind === "references") {
			params.context = { includeDeclaration: true };
			result = await this.request("textDocument/references", params);
		} else if (kind === "implementation") {
			result = await this.request("textDocument/implementation", params);
		} else if (kind === "typeDefinition") {
			result = await this.request("textDocument/typeDefinition", params);
		} else {
			result = await this.request("textDocument/definition", params);
		}
		const list = Array.isArray(result) ? result : result ? [result] : [];
		const targets = [];
		for (const item of list) {
			const entry = this.locationToEntry(item);
			if (entry && !targets.some((t) => t.path === entry.path && t.line === entry.line && t.col === entry.col)) {
				targets.push(entry);
			}
		}
		await attachSnippets(this.root, targets);
		return { targets };
	}

	stop(reason) {
		if (this.idleTimer) clearTimeout(this.idleTimer);
		this.idleTimer = null;
		const child = this.child;
		this.child = null;
		this.state = "off";
		this.startPromise = null;
		this.docs.clear();
		this.diagnostics.clear();
		this.progress.clear();
		if (!child) return;
		try {
			child.stdin.end();
		} catch {}
		setTimeout(() => {
			try {
				child.kill("SIGTERM");
				setTimeout(() => {
					try {
						child.kill("SIGKILL");
					} catch {}
				}, 2000).unref?.();
			} catch {}
		}, 200).unref?.();
		void reason;
	}
}

function languageIdFor(path) {
	const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
	if (ext === ".go") return "go";
	if (ext === ".ts") return "typescript";
	if (ext === ".tsx") return "typescriptreact";
	if (ext === ".js") return "javascript";
	if (ext === ".jsx") return "javascriptreact";
	if (ext === ".py") return "python";
	if (ext === ".json") return "json";
	return "plaintext";
}

function hoverToText(hover) {
	if (!hover) return "";
	const contents = hover.contents;
	if (typeof contents === "string") return contents;
	if (Array.isArray(contents)) return contents.map((part) => (typeof part === "string" ? part : part?.value ?? "")).join("\n");
	return contents?.value ?? "";
}

async function attachSnippets(root, targets) {
	for (const target of targets.slice(0, 60)) {
		try {
			const rel = relative(root, target.path);
			if (rel.startsWith("..")) continue;
			const file = await readFencedText(root, rel);
			if (file.kind !== "text") continue;
			const line = file.content.split("\n")[target.line - 1];
			if (line !== undefined) target.snippet = line.trim().slice(0, 240);
		} catch {}
	}
}

const servers = new Map(); // realpath(root) → LspServer

async function serverFor(root) {
	const key = await realpath(root);
	let server = servers.get(key);
	if (!server) {
		server = new LspServer(key);
		servers.set(key, server);
	}
	return server;
}

/**
 * Workspace root for one Go file: walk up from its directory to the session
 * cwd looking for go.mod / go.work, so gopls is per real module even when the
 * session opened a parent folder of several repos. Falls back to the cwd.
 */
async function findModuleRoot(filePath, sessionRoot) {
	let dir = dirname(filePath);
	for (;;) {
		for (const marker of ["go.mod", "go.work"]) {
			try {
				await access(join(dir, marker));
				return dir;
			} catch {}
		}
		if (dir === sessionRoot || dir === "/" || dir === dirname(dir)) return sessionRoot;
		dir = dirname(dir);
	}
}

/* ---------- routes ---------- */

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

function apply(ctx) {
	ctx.inject(["webServer"], (webCtx) => {
		const webServer = webCtx.webServer;
		ctx.effect(() => {
			const localServers = servers;
			return webServer.register({
				kind: "prefix",
				path: API_PREFIX,
				handler: async (req, res) => {
					const route = (req.url ?? "/").split("?")[0].slice(API_PREFIX.length + 1);
					if (req.method !== "POST" || !Object.hasOwn(routes, route)) {
						respondJson(res, 404, { ok: false, error: `unknown route: ${route}` });
						return;
					}
					try {
						const body = await readJsonBody(req);
						const value = await routes[route](body);
						respondJson(res, 200, { ok: true, value });
					} catch (error) {
						respondJson(res, 200, { ok: false, error: String(error?.message ?? error) });
					}
				},
			});
		}, "code-explorer: api route");
	});

	ctx.effect(() => () => {
		for (const server of servers.values()) server.stop("unload");
		servers.clear();
		textCache.clear();
	}, "code-explorer: servers lifetime");
}

export { apply };
