/**
 * Git worktrees: one checkout per branch, created next to the repository as
 * `<repository>-<branch>` (for `~/Projects/vas` and branch `feat/login`, the
 * checkout is `~/Projects/vas-feat-login`).
 *
 * A branch is a single ref, but a checkout owns HEAD and the index, so "one
 * branch per conversation" needs one checkout per conversation. A worktree is
 * exactly that: the same object database, a separate working tree.
 *
 * Sibling naming is an explicit exception to the session write fence: the
 * checkout lands in the repository's parent directory, outside the workspace.
 * That is deliberate — a checkout pooled inside the repository pollutes the
 * parent checkout's status and reads as project content to every tool. The
 * exception is narrow: the target must be a direct sibling of the repository
 * root whose name starts with `<repository>-`, the name is generated here (no
 * caller-supplied path), and an existing path is never reused.
 *
 * Creation is strict: no flag-like branch names, no traversal, no second
 * checkout of a branch that is already checked out somewhere else (Git refuses
 * that too; we turn its message into an actionable one).
 */

import { access, lstat, realpath } from "node:fs/promises";
import { basename, dirname, join, sep } from "node:path";

import { ApiError } from "./errors.js";
import { fenceRepo, gitRepoRoot, runGit } from "./git.js";

/** A branch name: no leading dot/dash, no `..`, slash-separated segments. */
const BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9._-]+)*$/;
/** Longest generated directory-name tail (keeps the whole name well under NAME_MAX). */
const SLUG_MAX = 80;

/**
 * Directory-name tail for a branch: every separator and unsafe character
 * collapses to `-`, so `feat/login` becomes `feat-login`.
 * @param branch - validated branch name.
 * @returns one path segment usable next to the repository.
 */
export function worktreeSlug(branch) {
	const slug = String(branch).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "").replace(/[-.]+$/, "");
	return (slug === "" ? "worktree" : slug).slice(0, SLUG_MAX);
}

/**
 * Validate a branch name for the worktree routes.
 * @param branch - candidate name.
 * @returns empty string when valid, otherwise the reason.
 */
export function worktreeBranchError(branch) {
	const value = String(branch ?? "").trim();
	if (value === "") return "branch name is required";
	if (value.startsWith("-") || value.startsWith(".") || value.includes("..")) return "invalid branch name";
	if (!BRANCH_RE.test(value)) return "invalid branch name";
	return "";
}

/**
 * Sibling directory a branch gets: `<parent>/<repository>-<slug>`.
 * @param mainRoot - the repository's main checkout (not a linked worktree).
 * @param branch - validated branch name.
 * @returns absolute path; the caller still verifies it does not exist.
 */
export function checkoutPathFor(mainRoot, branch) {
	return join(dirname(mainRoot), `${basename(mainRoot)}-${worktreeSlug(branch)}`);
}

/** Repo root for worktree writes: the workspace root itself, or an explicitly hinted nested repo. */
async function writeRepoRoot(cwd, repoHint) {
	const root = repoHint ? await fenceRepo(cwd, repoHint) : await gitRepoRoot(cwd);
	if (!root) throw new ApiError("bad-request", "not a git repository");
	return root;
}

async function realpathOr(path, fallback) {
	try {
		return await realpath(path);
	} catch {
		return fallback;
	}
}

/** Canonical path even when the leaf is gone (resolve the parent instead). */
async function realpathOrParent(path) {
	const real = await realpathOr(path, "");
	if (real !== "") return real;
	const parent = await realpathOr(dirname(path), dirname(path));
	return join(parent, basename(path));
}

async function pathExists(path) {
	try {
		await lstat(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Canonical directory the earlier layout pooled checkouts in. Those checkouts
 * still exist on machines that used that release, and they still hold their
 * branch: if this module cannot see them, the branch can never be checked out
 * again and Manage cannot clean them up.
 *
 * @param mainRoot - canonical main checkout.
 * @returns the pool directory (canonical when it exists).
 */
async function legacyPool(mainRoot) {
	const pool = join(mainRoot, ".agents", "worktrees");
	return realpathOr(pool, pool);
}

/**
 * Whether a canonical path is a checkout this feature owns: a `<repository>-…`
 * sibling of the main checkout, or an entry in the legacy
 * `<repository>/.agents/worktrees/` pool.
 *
 * @param mainRoot - canonical main checkout.
 * @param path - canonical candidate checkout.
 * @returns true for a managed checkout (the main checkout itself is not one).
 */
async function managedCheckout(mainRoot, path) {
	if (path === "" || path === mainRoot) return false;
	if (dirname(path) === dirname(mainRoot) && basename(path).startsWith(`${basename(mainRoot)}-`)) return true;
	return dirname(path) === await legacyPool(mainRoot);
}

/** Legacy layout: a checkout this feature used to create inside `<root>/.agents/worktrees/`. */
function isLegacyPool(mainRoot, path) {
	const pool = join(mainRoot, ".agents", "worktrees");
	return path.startsWith(`${pool}${sep}`);
}

/** Main (first) checkout of the repository that owns `root`, canonicalized. */
async function mainCheckoutOf(root) {
	const res = await runGit(root, ["worktree", "list", "--porcelain"]);
	if (!res.ok) return root;
	for (const line of res.stdout.split("\n")) {
		if (!line.startsWith("worktree ")) continue;
		return await realpathOr(line.slice("worktree ".length), root);
	}
	return root;
}

/** Existing checkout path owning `branch`, or "" when nobody has it checked out. */
async function branchOccupant(root, branch) {
	const res = await runGit(root, ["worktree", "list", "--porcelain"]);
	if (!res.ok) return "";
	const wanted = `branch refs/heads/${branch}`;
	let path = "";
	for (const line of res.stdout.split("\n")) {
		if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
		else if (line === wanted) return path;
	}
	return "";
}

/**
 * Recognize a checkout this feature manages: a linked worktree that sits next
 * to the repository's main checkout and is named `<repository>-…`.
 *
 * @param checkout - absolute directory path (a Session cwd, typically).
 * @returns `{root, checkout}` with the main checkout as root, or null.
 */
export async function managedWorktreeOf(checkout) {
	const value = String(checkout ?? "");
	if (value === "") return null;
	const toplevel = await runGit(value, ["rev-parse", "--show-toplevel"]);
	if (!toplevel.ok) return null;
	const tree = await realpathOr(toplevel.stdout.trim(), "");
	if (tree === "") return null;
	const res = await runGit(tree, ["worktree", "list", "--porcelain"]);
	if (!res.ok) return null;
	let main = "";
	let current = "";
	for (const line of res.stdout.split("\n")) {
		if (line.startsWith("worktree ")) current = line.slice("worktree ".length);
		else if ((line === "bare" || line === "") && current !== "") {
			if (main === "") main = current;
			current = "";
		}
	}
	if (main === "") return null;
	const mainRoot = await realpathOr(main, "");
	const self = await realpathOr(tree, tree);
	if (mainRoot === "" || self === mainRoot) return null;
	if (!(await managedCheckout(mainRoot, self))) return null;
	return { root: mainRoot, checkout: self };
}

/**
 * Every checkout of the repository containing the session workspace.
 * @param cwd - session workspace.
 * @param repoHint - explicit repository root for multi-repo workspaces.
 * @returns `{repo, root, main, worktrees}` where each row is `{path, head, branch, detached, bare, locked, prunable, current, managed}`.
 */
export async function gitWorktrees(cwd, repoHint = "") {
	const root = repoHint ? await fenceRepo(cwd, String(repoHint)) : await gitRepoRoot(cwd);
	if (!root) return { repo: false, root: "", main: "", worktrees: [] };
	const res = await runGit(root, ["worktree", "list", "--porcelain"]);
	if (!res.ok) throw new ApiError("unavailable", (res.stderr || "git worktree list failed").trim());
	const worktrees = [];
	let row = null;
	for (const line of res.stdout.split("\n")) {
		if (line === "") {
			if (row !== null) worktrees.push(row);
			row = null;
			continue;
		}
		if (line.startsWith("worktree ")) {
			if (row !== null) worktrees.push(row);
			row = { path: line.slice("worktree ".length), head: "", branch: "", detached: false, bare: false, locked: false, prunable: false };
			continue;
		}
		if (row === null) continue;
		if (line.startsWith("HEAD ")) row.head = line.slice("HEAD ".length);
		else if (line.startsWith("branch ")) row.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
		else if (line === "detached") row.detached = true;
		else if (line === "bare") row.bare = true;
		else if (line.startsWith("locked")) row.locked = true;
		else if (line.startsWith("prunable")) row.prunable = true;
	}
	if (row !== null) worktrees.push(row);
	const sessionRoot = await realpathOr(cwd, cwd);
	const main = worktrees.length > 0 ? await realpathOr(worktrees[0].path, worktrees[0].path) : root;
	const pool = await legacyPool(main);
	for (const item of worktrees) {
		item.path = await realpathOr(item.path, item.path);
		item.current = item.path === sessionRoot;
		item.main = item.path === main;
		// Legacy entries stay removable: a checkout created before the sibling
		// layout would otherwise hold its branch hostage forever.
		item.legacy = item.path !== main && dirname(item.path) === pool;
		item.managed = item.legacy || (item.path !== main && dirname(item.path) === dirname(main) && basename(item.path).startsWith(`${basename(main)}-`));
	}
	return { repo: true, root, main, worktrees };
}

/**
 * Create one checkout for a branch (new branch, or an existing one).
 *
 * @param cwd - session workspace; the branch belongs to its repository.
 * @param repoHint - explicit repository root for multi-repo workspaces.
 * @param options - `branch`, `mode` (`new` | `existing`), `base` (start point), `remoteRef` (remote-only branch).
 * @returns `{root, path, branch, mode}`.
 * @throws ApiError for invalid names, occupied branches, and failed Git runs.
 */
export async function gitWorktreeCreate(cwd, repoHint = "", options = {}) {
	const branch = String(options.branch ?? "").trim();
	const mode = options.mode === "existing" ? "existing" : "new";
	const base = String(options.base ?? "").trim();
	const remoteRef = String(options.remoteRef ?? "").trim();
	const reason = worktreeBranchError(branch);
	if (reason !== "") throw new ApiError("bad-request", reason);
	if (base !== "") {
		const baseReason = worktreeBranchError(base);
		if (baseReason !== "") throw new ApiError("bad-request", `invalid start point: ${baseReason}`);
	}
	if (remoteRef !== "" && !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(remoteRef)) {
		throw new ApiError("bad-request", "invalid remote branch reference");
	}
	const root = await writeRepoRoot(cwd, repoHint);
	const mainRoot = await mainCheckoutOf(root);
	const target = checkoutPathFor(mainRoot, branch);
	// The sibling exception is narrow and generated, never caller-supplied: a
	// direct child of the repository's parent named `<repository>-…`.
	if (dirname(target) !== dirname(mainRoot) || !basename(target).startsWith(`${basename(mainRoot)}-`)) {
		throw new ApiError("bad-request", "invalid checkout target");
	}
	let exists = false;
	try {
		await lstat(target);
		exists = true;
	} catch {
		exists = false;
	}
	if (exists) throw new ApiError("conflict", `checkout directory already exists: ${target}; remove it or pick another branch name`);
	let occupant = await branchOccupant(mainRoot, branch);
	// A checkout deleted by hand leaves its admin entry behind; prune it instead
	// of blocking the branch on a directory nobody can reach any more.
	if (occupant !== "" && !(await pathExists(occupant))) {
		await runGit(mainRoot, ["worktree", "prune"]);
		occupant = await branchOccupant(mainRoot, branch);
	}
	if (occupant !== "") {
		throw new ApiError("conflict", `branch ${branch} is already checked out at ${occupant}; open that checkout, remove it from "Manage worktrees", or pick another branch`);
	}
	const existsRef = await runGit(mainRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
	const branchExists = existsRef.ok;
	if (mode === "new" && branchExists) throw new ApiError("conflict", `branch already exists: ${branch}; pick another name or use the existing branch`);
	if (mode === "existing" && !branchExists && remoteRef === "") throw new ApiError("not-found", `no such local branch: ${branch}`);
	let args;
	if (mode === "new") {
		args = ["worktree", "add", target, "-b", branch, base === "" ? "HEAD" : base];
	} else if (branchExists) {
		args = ["worktree", "add", target, branch];
	} else {
		// A branch that only exists on a remote is still usable: create the local
		// branch at the remote tip and let Git set its upstream.
		const remote = await runGit(mainRoot, ["rev-parse", "--verify", "--quiet", `refs/remotes/${remoteRef}`]);
		if (!remote.ok) throw new ApiError("not-found", `no such remote branch: ${remoteRef}`);
		args = ["worktree", "add", target, "-b", branch, remoteRef];
	}
	const res = await runGit(mainRoot, args, 60000);
	if (!res.ok) {
		const message = (res.stderr || res.stdout || "git worktree add failed").trim().split("\n").slice(-2).join(" ");
		throw new ApiError("conflict", message);
	}
	return { root: mainRoot, path: target, branch, mode };
}

/**
 * Remove one managed checkout — a `<repository>-…` sibling or a legacy
 * `<repository>/.agents/worktrees/` entry — keeping its branch.
 *
 * Checkouts a user created elsewhere are left alone. The checkout the calling
 * workspace stands in, and locked or dirty checkouts, are refused unless
 * `force` is set (which discards uncommitted changes by design).
 *
 * @param cwd - session workspace used to locate the repository.
 * @param repoHint - explicit repository root for multi-repo workspaces.
 * @param options - `path` (the checkout to remove) and `force`.
 * @returns `{root, path, removed: true}`.
 */
export async function gitWorktreeRemove(cwd, repoHint = "", options = {}) {
	const requested = String(options.path ?? "").trim();
	if (requested === "") throw new ApiError("bad-request", "path is required");
	const sessionRoot = await realpathOr(cwd, cwd);
	const target = await realpathOrParent(requested);
	// Refuse when this workspace stands *in* the checkout being removed. The
	// reverse containment is normal: a legacy pool entry lives inside the main
	// checkout, and sessions working at the repository root must still sweep it.
	if (target === sessionRoot || insideWorktree(target, sessionRoot)) {
		throw new ApiError("conflict", "cannot remove the checkout this workspace is in; open another workspace first");
	}
	const root = await writeRepoRoot(cwd, repoHint);
	const mainRoot = await mainCheckoutOf(root);
	if (!(await managedCheckout(mainRoot, target))) {
		throw new ApiError("forbidden", `only checkouts this feature created are managed here (${basename(mainRoot)}-… beside the repository, or ${basename(mainRoot)}/.agents/worktrees/…)`);
	}
	const list = await runGit(mainRoot, ["worktree", "list", "--porcelain"]);
	if (!list.ok) throw new ApiError("unavailable", (list.stderr || "git worktree list failed").trim());
	const registered = list.stdout.split("\n").some((line) => line === `worktree ${target}`);
	if (!registered) throw new ApiError("not-found", `no such checkout: ${requested}`);
	// A registration whose directory is gone is cleaned by prune; Git's remove
	// refuses a missing directory, and the caller still wants the branch freed.
	if (!(await pathExists(target))) {
		await runGit(mainRoot, ["worktree", "prune"]);
		return { root: mainRoot, path: target, removed: true };
	}
	const args = ["worktree", "remove"];
	if (options.force === true) args.push("--force");
	args.push(target);
	const res = await runGit(mainRoot, args, 60000);
	if (!res.ok) {
		const message = (res.stderr || res.stdout || "git worktree remove failed").trim().split("\n").slice(-2).join(" ");
		throw new ApiError("conflict", `${message}${options.force === true ? "" : "; the checkout may hold uncommitted changes — retry with force to discard them"}`);
	}
	await runGit(mainRoot, ["worktree", "prune"]);
	return { root: mainRoot, path: target, removed: true };
}

/** Whether `child` is `parent` or lies below it (canonical absolute paths). */
function insideWorktree(parent, child) {
	if (child === parent) return true;
	return child.startsWith(parent.endsWith(sep) ? parent : `${parent}${sep}`);
}

/**
 * Reclaim the managed checkout a Session lived in when that Session is archived.
 *
 * Policy (deliberately conservative — archiving must never destroy work):
 * only a sibling checkout named `<repository>-…` is touched; the branch always
 * survives; the checkout is removed without force, so Git refuses when it holds
 * uncommitted or untracked changes; and nothing happens while another
 * non-archived Session still points inside it. When the removed checkout was
 * the directory behind a Workspace record, that record is dropped once every
 * Session it lists is archived.
 *
 * Dependencies are injected so the policy is testable without a full Host
 * composition.
 *
 * @param sessionId - the Session that was just archived.
 * @param deps - `cwdOf`, `referencedByOther`, `remove`, `workspaceAt`, `deleteWorkspace`, `archivedIds`.
 * @returns `{removed, reason?}`; failures of `remove` propagate to the caller.
 */
export async function reclaimArchivedCheckout(sessionId, deps) {
	const cwd = await deps.cwdOf(sessionId);
	if (typeof cwd !== "string" || cwd === "") return { removed: false, reason: "no-cwd" };
	const managed = await managedWorktreeOf(cwd);
	if (managed === null) return { removed: false, reason: "not-managed" };
	if (await deps.referencedByOther(managed.checkout, sessionId)) return { removed: false, reason: "in-use" };
	await deps.remove(managed.root, managed.checkout);
	const workspace = await deps.workspaceAt?.(managed.checkout);
	if (workspace !== undefined && workspace !== null) {
		const archived = deps.archivedIds instanceof Set ? deps.archivedIds : new Set(deps.archivedIds ?? []);
		const ids = Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [];
		if (ids.every((id) => archived.has(id))) {
			await deps.deleteWorkspace?.(workspace.id ?? workspace.workspaceId);
		}
	}
	return { removed: true };
}
