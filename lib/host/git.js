/** Git layer: repo root/base detection, porcelain status parsing, repo discovery inside the session fence, and diff plumbing (working/branch/commit scopes). */

import { execFile } from "node:child_process";
import { lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { DIFF_CAP, GIT_LOG_CAP, WALK_SKIP } from "./constants.js";
import { insideFence, readFencedText } from "./fence.js";

function runGit(cwd, args, timeoutMs, input) {
	return new Promise((resolvePromise) => {
		// No execFile `timeout` on purpose: it SIGKILLs immediately, which can
		// leave a stale .git/index.lock behind. Two-stage instead: SIGTERM
		// gives git a chance to clean up, SIGKILL only after a grace period.
		const child = execFile("git", ["-C", cwd, ...args], { maxBuffer: 32 * 1024 * 1024, encoding: "utf8", killSignal: "SIGKILL" }, (error, stdout, stderr) => {
			clearTimeout(termTimer);
			if (killTimer !== null) clearTimeout(killTimer);
			const maxBufHit = error !== null && (error.code === "ERR_CHILD_PROCESS_STDOUT_MAXBUFFER" || /maxBuffer/.test(String(error.message)));
			resolvePromise({
				ok: !error || (stdout !== "" && !maxBufHit),
				failed: !!error,
				stdout: stdout ?? "",
				stderr: stderr ?? "",
				code: typeof error?.code === "number" ? error.code : error ? 1 : 0,
				timedOut,
			});
		});
		let timedOut = false;
		let killTimer = null;
		const termTimer = setTimeout(() => {
			timedOut = true;
			try {
				child.kill("SIGTERM");
			} catch {}
			killTimer = setTimeout(() => {
				try {
					child.kill("SIGKILL");
				} catch {}
			}, 3000);
			killTimer.unref?.();
		}, timeoutMs ?? 10000);
		termTimer.unref?.();
		if (typeof input === "string") {
			child.stdin?.on?.("error", () => {}); // ignore EPIPE when git exits early
			child.stdin?.end(input);
		}
	});
}

/**
 * Wrap a repo-relative path as a literal pathspec. Without this, a filename
 * containing glob metacharacters (a*.txt) would make git match sibling files
 * too — with destructive verbs like discard that reverts the wrong files.
 */
function litPathspec(rel) {
	return `:(literal)${rel}`;
}

/**
 * Extract the file header plus the nth hunk (0-based) from a unified diff,
 * producing a minimal patch that `git apply` accepts. Returns null when the
 * index is out of range.
 */
function extractHunk(diffText, index) {
	const lines = String(diffText ?? "").split("\n");
	const header = [];
	let seen = -1;
	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i];
		if (l.startsWith("@@")) {
			seen++;
			if (seen === index) {
				start = i;
				break;
			}
			continue;
		}
		if (seen === -1 && /^(diff |index |--- |\+\+\+ |old mode|new mode|deleted file|new file|similarity|rename )/.test(l)) header.push(l);
	}
	if (start < 0) return null;
	const out = [...header];
	for (let i = start; i < lines.length; i++) {
		if (i > start && lines[i].startsWith("@@")) break;
		out.push(lines[i]);
	}
	while (out.length > 0 && out[out.length - 1] === "") out.pop();
	return `${out.join("\n")}\n`;
}

async function gitRepoRoot(cwd) {
	const result = await runGit(cwd, ["rev-parse", "--show-toplevel"]);
	if (!result.ok) return null;
	return result.stdout.trim() || null;
}

async function detectBase(cwd, branch) {
	// Preferred: the remote HEAD symbolic ref — kept UNSTRIPPED ("origin/master")
	// so the merge-base is computed against the remote-tracking baseline, not a
	// possibly-stale local copy of it. Stripping the prefix used to silently
	// resolve "master" to the local branch and inflate the branch-changes list
	// with the remote's own history whenever the local copy lagged.
	let res = await runGit(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
	if (res.ok) {
		const name = res.stdout.trim();
		if (name && name !== branch && name !== `origin/${branch}`) return name;
	}
	for (const candidate of ["origin/main", "main", "origin/master", "master"]) {
		if (candidate === branch || `origin/${branch}` === candidate) continue;
		res = await runGit(cwd, ["rev-parse", "--verify", "--quiet", candidate]);
		if (res.ok && res.stdout.trim()) return candidate;
	}
	return null;
}

/**
 * Explain diffs that list a path but carry no content hunks — mode-only
 * changes, binaries, rename/copy metadata, empty additions. Without this the
 * panel shows a baffling "变更行 0" chip for files the changes list insists
 * are modified.
 */
function noContentNote(diffText) {
	const text = String(diffText ?? "");
	if (text === "" || text.startsWith("@@") || text.includes("\n@@")) return void 0;
	if (/^old mode /m.test(text) || /^new mode /m.test(text)) return "仅模式(权限)变更，无内容差异";
	if (/Binary files /m.test(text) || /^GIT binary patch/m.test(text)) return "二进制文件，无文本差异";
	if (/^rename from /m.test(text) || /^copy from /m.test(text) || /^similarity index /m.test(text)) return "重命名/复制元数据变更，无内容差异";
	if (/^new file mode /m.test(text)) return "新增空文件";
	return "无内容行差异";
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

/**
 * Resolve a repo-relative path for index/worktree operations (stage, unstage,
 * discard). Unlike resolveFencedTarget the file need not exist on disk (staged
 * deletions), and the path resolves against the repo root — status paths are
 * repo-relative even when the session cwd is a multi-repo parent. Fenced twice:
 * the repo root inside the session workspace, the path inside the repo.
 * Empty path (or ".") means the whole repo and returns "".
 */
async function repoRelPath(cwd, root, requestedPath) {
	const sessionRoot = await realpath(cwd);
	if (root !== sessionRoot && !insideFence(sessionRoot, root)) throw new Error("repo is outside the session workspace");
	const wanted = String(requestedPath ?? "").replace(/\\/g, "/");
	if (wanted === "" || wanted === ".") return "";
	if (isAbsolute(wanted)) throw new Error("path must be repo-relative");
	const candidate = resolve(root, wanted);
	if (!insideFence(root, candidate)) throw new Error("path is outside the repository");
	return relative(root, candidate).split(/[\\/]/).join("/");
}

function synthesizeAddDiff(text, path) {
	const lines = text.split("\n");
	const endsWithNewline = lines.length > 0 && lines[lines.length - 1] === "";
	if (endsWithNewline) lines.pop();
	const count = lines.length;
	const body = lines.map((line) => `+${line}`).join("\n");
	// The "no newline" marker only belongs there when the file really lacks one.
	const tail = count === 0 ? "\n" : endsWithNewline ? "\n" : "\n\\ No newline at end of file\n";
	return `--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${count} @@\n${body}${tail}`;
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
		// Optional path filter: the file-history overlay asks for one file's
		// change in one commit; empty path keeps the whole-tree diff.
		const args = ["diff", "--no-color", "-U3", from, sha];
		let relFilter = "";
		if (requestedPath !== "") {
			relFilter = relative(root, resolve(root, requestedPath)).split(/[\\/]/).join("/");
			if (!relFilter || relFilter.startsWith("..")) return { error: "path is outside the repository" };
			args.push("--", relFilter);
		}
		const res = await runGit(root, args);
		const info = await runGit(root, ["log", "-1", "--format=%h %s", sha]);
		if (!res.ok) return { error: res.stderr || "git diff failed" };
		return { diff: truncate(res.stdout, DIFF_CAP), scope: "commit", commit: info.ok ? info.stdout.trim() : sha, note: noContentNote(res.stdout), ...(relFilter ? { path: relFilter } : {}) };
	}
	const relPath = relative(root, resolve(root, requestedPath)).split(/[\\/]/).join("/");
	if (!relPath || relPath.startsWith("..")) return { error: "path is outside the repository" };
	if (scope === "staged") {
		// Index vs HEAD: exactly what a commit would record right now.
		const res = await runGit(root, ["diff", "--no-color", "-U3", "--cached", "--", relPath]);
		if (!res.ok) return { error: res.stderr || "git diff failed" };
		return { diff: truncate(res.stdout, DIFF_CAP), scope: "staged", note: noContentNote(res.stdout) };
	}
	if (scope === "branch") {
		const status = await gitStatusAt(root);
		if (!status.base) return { error: "no base branch detected" };
		const res = await runGit(root, ["diff", "--no-color", "-U3", status.base.mergeBase, "HEAD", "--", litPathspec(relPath)]);
		if (!res.ok) return { error: res.stderr || "git diff failed" };
		return { diff: truncate(res.stdout, DIFF_CAP), scope: "branch", base: status.base.name, note: noContentNote(res.stdout) };
	}
	const statusRes = await runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", litPathspec(relPath)]);
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
	const res = await runGit(root, ["diff", "--no-color", "-U3", "HEAD", "--", litPathspec(relPath)]);
	if (!res.ok) return { error: res.stderr || "git diff failed" };
	return { diff: truncate(res.stdout, DIFF_CAP), scope: "working", note: noContentNote(res.stdout) };
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

/**
 * Per-line blame in final-line order via `--line-porcelain`.
 * @returns array of {sha, line, author, mail, time, summary}, or null on failure.
 */
async function gitBlame(root, relPath) {
	// NOTE: git blame does not parse the :(literal) pathspec magic (it treats
	// it as part of the filename), so the raw path is passed. blame is
	// read-only: a glob-metachar filename at worst errors out or blames the
	// literal match — never corrupts anything.
	const res = await runGit(root, ["blame", "--line-porcelain", "--", relPath], 60000);
	if (!res.ok) return null;
	const lines = [];
	let cur = null;
	for (const line of res.stdout.split("\n")) {
		const m = /^([0-9a-f]{40}) (\d+) (\d+)( \d+)?$/.exec(line);
		if (m !== null) {
			cur = { sha: m[1], line: Number(m[3]) };
			continue;
		}
		if (cur === null) continue;
		if (line.startsWith("\t")) {
			lines.push(cur);
			cur = null;
			continue;
		}
		if (line.startsWith("author ")) cur.author = line.slice(7);
		else if (line.startsWith("author-mail ")) cur.mail = line.slice(12);
		else if (line.startsWith("author-time ")) cur.time = Number(line.slice(12));
		else if (line.startsWith("summary ")) cur.summary = line.slice(8);
	}
	lines.sort((a, b) => a.line - b.line);
	return lines;
}

export { parsePorcelainZ, runGit, gitRepoRoot, gitStatusAt, gitStatus, fenceRepo, repoRelPath, litPathspec, gitDiff, gitBlame, extractHunk };
