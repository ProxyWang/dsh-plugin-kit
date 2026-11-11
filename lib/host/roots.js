/**
 * Extra READ-ONLY roots for cross-repo and module-cache navigation.
 *
 * The session workspace fence stays authoritative for writes and directory
 * listings; reads additionally allow the workspace's parent tree (mono /
 * multi-repo layouts like ~/Projects/* — hidden directories are excluded at
 * the fence level so ~/.ssh & co are never served) and the Go toolchain
 * roots, so gopls jumps into dependencies and neighbour services work like
 * in VSCode.
 *
 * Roots are computed per call from the given workspaceRoot: an earlier
 * module-level cache leaked the FIRST workspace's parent tree into every
 * later session served by the same host process. Only the (workspace-
 * independent) Go roots are cached.
 */

import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

let goRootsCache = null;

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

/** Go module cache / GOPATH src / GOROOT src — workspace independent, cached once. */
async function goRoots() {
	if (goRootsCache !== null) return goRootsCache;
	const gopath = process.env.GOPATH || join(homedir(), "go");
	const env = await goEnv();
	const roots = [env?.modcache || join(gopath, "pkg", "mod"), join(gopath, "src")];
	if (env?.goroot) roots.push(join(env.goroot, "src"));
	goRootsCache = roots.filter(Boolean);
	return goRootsCache;
}

/** Parent tree of THIS workspace plus the Go source roots. Never cached across workspaces. */
export async function extraReadRoots(workspaceRoot) {
	const goList = await goRoots();
	let parent = null;
	try {
		parent = dirname(await realpath(workspaceRoot));
	} catch { /* unreadable workspace root: keep the go roots only */ }
	return parent === null ? [...goList] : [parent, ...goList];
}
