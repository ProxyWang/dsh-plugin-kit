/** The current git branch, shown next to sessions in the sidebar.
 *
 * The workspace list belongs to the Host, which exposes session rows but no
 * project-header slot — so the branch rides on the session row, where the props
 * carry the session id and we can resolve its workspace.
 *
 * One probe serves every row of the same workspace: the store below keeps a
 * single timer per `cwd`, so ten rows of one project cost one `rev-parse` every
 * few seconds instead of ten. A checkout shows up without a reload.
 */

import { h, useEffect, useState } from "./react.js";
import { api } from "./api.js";

/** How often each workspace re-reads its branch while a row is visible. */
const POLL_MS = 4000;

/** cwd → `{branch, repo, listeners, timer}`; one entry per mounted workspace. */
const branches = new Map();

/** Read one workspace's branch and push it to its listeners. */
async function readBranch(cwd, entry) {
	const res = await api("git.branch", { cwd });
	const value = res.ok ? res.value : null;
	entry.repo = value?.repo === true;
	entry.branch = entry.repo ? String(value.branch ?? "") : "";
	for (const listener of entry.listeners) listener({ repo: entry.repo, branch: entry.branch });
}

/**
 * Watch one workspace's branch.
 *
 * @param cwd - the workspace to probe
 * @param listener - called with `{repo, branch}` on every refresh
 * @returns an unsubscribe function; the timer stops with the last listener
 */
export function watchBranch(cwd, listener) {
	let entry = branches.get(cwd);
	if (!entry) {
		entry = { repo: false, branch: "", listeners: new Set(), timer: null };
		branches.set(cwd, entry);
		// The callback returns the read promise so a test can await one tick.
		entry.timer = setInterval(() => readBranch(cwd, entry), POLL_MS);
		void readBranch(cwd, entry);
	}
	entry.listeners.add(listener);
	listener({ repo: entry.repo, branch: entry.branch });
	return () => {
		entry.listeners.delete(listener);
		if (entry.listeners.size > 0) return;
		clearInterval(entry.timer);
		branches.delete(cwd);
	};
}

/**
 * @param props - `{t, cwd}`; `cwd` is the session workspace, empty when unknown
 * @returns the branch chip, or null when the workspace is not a repository
 */
export function SessionBranch({ t, cwd }) {
	const [state, setState] = useState({ repo: false, branch: "" });

	useEffect(() => {
		if (!cwd) return undefined;
		const stop = watchBranch(cwd, setState);
		const onFocus = () => {
			const entry = branches.get(cwd);
			if (entry) void readBranch(cwd, entry);
		};
		if (typeof window !== "undefined" && typeof window.addEventListener === "function") window.addEventListener("focus", onFocus);
		return () => {
			stop();
			if (typeof window !== "undefined" && typeof window.removeEventListener === "function") window.removeEventListener("focus", onFocus);
		};
	}, [cwd]);

	if (!state.repo || state.branch === "") return null;
	const label = state.branch === "HEAD" ? t("branch.detached") : state.branch;
	return h("span", { className: "ce-branch-chip", title: `${t("branch.current")}: ${label}` },
		h("span", { className: "ce-branch-glyph", "aria-hidden": "true" }, "⎇"),
		h("span", { className: "ce-branch-name" }, label));
}
