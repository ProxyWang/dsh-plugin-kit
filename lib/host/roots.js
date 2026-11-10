/**
 * Extra READ-ONLY roots for cross-repo and module-cache navigation.
 *
 * The session workspace fence stays authoritative for writes and directory
 * listings; reads additionally allow the workspace's sibling directory (mono
 * / multi-repo layouts like ~/Projects/*) and the Go toolchain roots, so gopls
 * jumps into dependencies and neighbour services work like in VSCode.
 */

import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

let cache = null;

function goEnv() {
	return new Promise((resolvePromise) => {
		execFile("go", ["env", "GOROOT", "GOPATH", "GOMODCACHE"], { timeout: 5000 }, (error, stdout) => {
			if (error) {
				resolvePromise(null);
				return;
			}
			const [goroot, gopath, modcache] = String(stdout).split("\n").map((s) => s.trim());
			resolvePromise({ goroot, gopath, modcache });
		});
	});
}

/** Sibling dir of the workspace plus Go module/GOPATH/GOROOT source roots. */
export async function extraReadRoots(workspaceRoot) {
	if (cache !== null) return cache;
	const out = [];
	try {
		out.push(dirname(await realpath(workspaceRoot)));
	} catch { /* unreadable workspace root: keep the go roots only */ }
	const gopath = process.env.GOPATH || join(homedir(), "go");
	const env = await goEnv();
	out.push(env?.modcache || join(gopath, "pkg", "mod"));
	out.push(join(gopath, "src"));
	if (env?.goroot) out.push(join(env.goroot, "src"));
	cache = out.filter(Boolean);
	return cache;
}
