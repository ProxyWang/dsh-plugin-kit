/** File traversal and search: workspace walk, git-aware candidate lists for Quick Open, fuzzy scoring, and the ripgrep/grep text engine. */

import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

import { WALK_SKIP } from "./constants.js";
import { runGit } from "./git.js";

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

export { searchCandidates, fuzzyScore, textSearch };
