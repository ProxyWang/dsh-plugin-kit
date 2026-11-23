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

/** Character budget for the always-visible row chip (the cell is ~16px tall). */
export const BRANCH_CHIP_MAX = 22;

/**
 * Shorten a branch name from the middle.
 *
 * The row cell is narrow and the host clips it; end-truncation kept only the
 * common prefix, so `feat/profile-match` and `feat/profile-matrix` looked the
 * same. Keeping both ends (and the full name in the hover card) makes the chip
 * identifiable at a glance.
 *
 * @param name - the branch name
 * @param max - the character budget
 * @returns the name unchanged when it fits, otherwise `head…tail`
 */
export function shortBranch(name, max = BRANCH_CHIP_MAX) {
	const text = String(name ?? "");
	if (text.length <= max) return text;
	const budget = max - 1; // the ellipsis
	const head = Math.ceil(budget * 0.45);
	const tail = budget - head;
	return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}

/**
 * Resolve a session's workspace from the slot's own `useSessions` prop.
 *
 * The slot contract hands every occupant `useSessions` (and says occupants must
 * address their data by Session id, not bind the Session), so the row itself
 * tells us which workspace to probe — no separate service injection needed.
 *
 * @param useSessions - the selector hook supplied by the host slot
 * @param sessionId - the row's session id
 * @returns the workspace path, or "" when it cannot be resolved
 */
export function sessionCwd(useSessions, sessionId) {
	const id = String(sessionId ?? "");
	if (id === "" || typeof useSessions !== "function") return "";
	const cwd = useSessions((select) => select?.byId?.[id]?.cwd);
	return String(cwd ?? "");
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
		h("span", { className: "ce-branch-name" }, shortBranch(label)));
}

/**
 * The full branch, shown in the session's hover card.
 *
 * The row cell is icon-sized (16px tall, narrow), so the always-visible chip has
 * to shorten; the hover card has room for words and is where the complete name
 * belongs.
 *
 * @param props - `{t, cwd}`; same contract as the chip
 */
export function SessionBranchCard({ t, cwd }) {
	const [state, setState] = useState({ repo: false, branch: "" });

	useEffect(() => {
		if (!cwd) return undefined;
		return watchBranch(cwd, setState);
	}, [cwd]);

	if (!state.repo || state.branch === "") return null;
	const label = state.branch === "HEAD" ? t("branch.detached") : state.branch;
	return h("div", { className: "ce-branch-card", title: label },
		h("span", { className: "ce-branch-glyph", "aria-hidden": "true" }, "⎇"),
		h("span", { className: "ce-branch-card-label" }, `${t("branch.current")} · `),
		h("span", { className: "ce-branch-card-name" }, label));
}
