/* ---------------- git actions hook: fetch/pull/push, discard, stage/unstage/commit ---------------- */

import { useCallback, useState } from "./react.js";
import { api } from "./api.js";

/**
 * Every mutating git operation of the Code panel, lifted out of the CodeBody
 * orchestrator. Each callback calls the host routes, folds the fresh status
 * back via setGit and reports through say(); `sync`/`committing` guard
 * re-entrancy. Pull and discard additionally reload the open document when it
 * was affected. repoSelRef carries the multi-repo selection.
 */
export function useGitActions({ cwd, t, say, git, setGit, repoSelRef, refreshGit, loadFile, docRef, cursorRef, modeRef }) {
	const [sync, setSync] = useState({ busy: false });
	const [committing, setCommitting] = useState(false);

	const doFetch = useCallback(async () => {
		if (!cwd || sync.busy) return;
		setSync({ busy: true });
		say(t("sync.fetching"));
		const res = await api("git.fetch", repoSelRef.current ? { cwd, repo: repoSelRef.current } : { cwd });
		setSync({ busy: false });
		if (!res.ok) {
			say(t("sync.fetchFail", { msg: res.error }), "error");
			return;
		}
		const st = res.value?.status;
		if (st) setGit(st);
		if (res.value?.error) {
			say(t("sync.fetchFail", { msg: res.value.error }), "error");
			return;
		}
		if (!st || !st.repo) return;
		say(st.behind > 0 ? t("sync.behind", { n: st.behind }) : st.ahead > 0 ? t("sync.localAhead", { n: st.ahead }) : t("sync.upToDate"));
	}, [cwd, sync.busy, say, t]);

	const doPull = useCallback(async () => {
		if (!cwd || sync.busy) return;
		setSync({ busy: true });
		say(t("sync.pulling"));
		const before = git?.behind ?? 0;
		const res = await api("git.pull", repoSelRef.current ? { cwd, repo: repoSelRef.current } : { cwd });
		setSync({ busy: false });
		if (!res.ok) {
			say(t("sync.pullFail", { msg: res.error }), "error");
			return;
		}
		const value = res.value ?? {};
		if (value.status) setGit(value.status);
		if (value.error) {
			const st = value.status;
			if (st && st.ahead > 0 && st.behind > 0) say(t("sync.diverged"), "error");
			else say(t("sync.pullFail", { msg: value.error }), "error");
			return;
		}
		if (/Already up to date/i.test(value.output ?? "")) {
			say(t("sync.upToDate"));
			return;
		}
		const n = value.behindBefore ?? before;
		say(n ? t("sync.pulled", { n }) : t("sync.upToDate"));
		const cur = docRef.current;
		if (cur && modeRef.current === "code") {
			const c = cursorRef.current;
			void loadFile(cur.path, c?.line ?? 1, c?.col ?? 1);
		}
	}, [cwd, sync.busy, git, say, t, loadFile]);

	// Push the current branch; when it has no upstream yet the host publishes
	// it with -u (VSCode's "Publish branch"). Never force-pushes.
	const doPush = useCallback(async () => {
		if (!cwd || sync.busy) return;
		setSync({ busy: true });
		say(t("sync.pushing"));
		const res = await api("git.push", repoSelRef.current ? { cwd, repo: repoSelRef.current } : { cwd });
		setSync({ busy: false });
		if (!res.ok) {
			say(t("sync.pushFail", { msg: res.error }), "error");
			return;
		}
		const value = res.value ?? {};
		if (value.status) setGit(value.status);
		if (value.error) {
			say(t("sync.pushFail", { msg: value.error }), "error");
			return;
		}
		say(value.published ? t("sync.published") : t("sync.pushed"));
	}, [cwd, sync.busy, say, t]);

	// Revert one working-tree change: tracked files restore HEAD, staged adds
	// unstage. Never deletes anything; the open doc reloads afterwards.
	const discardChange = useCallback(async (item) => {
		if (!cwd) return;
		const repo = repoSelRef.current;
		const res = await api("git.discard", repo ? { cwd, path: item.path, repo, ch: item.ch } : { cwd, path: item.path, ch: item.ch });
		if (!res.ok) {
			say(`${t("error")}: ${res.error}`, "error");
			return;
		}
		say(t("changes.discarded"));
		refreshGit();
		if (docRef.current?.path === item.path) void loadFile(item.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
	}, [cwd, say, t, refreshGit, loadFile]);
	// VSCode-style folder discard: revert every change under one directory.
	const discardMany = useCallback(async (dirItems) => {
		if (!cwd || !Array.isArray(dirItems) || dirItems.length === 0) return;
		const repo = repoSelRef.current;
		let okCount = 0;
		const errors = [];
		for (const item of dirItems) {
			const res = await api("git.discard", repo ? { cwd, path: item.path, repo, ch: item.ch } : { cwd, path: item.path, ch: item.ch });
			if (res.ok && !res.value?.error) okCount += 1;
			else errors.push(`${item.path}: ${res.value?.error ?? res.error}`);
		}
		if (okCount > 0) say(t("changes.discardedN", { n: okCount }));
		if (errors.length > 0) say(`${t("error")}: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1})` : ""}`, "error");
		refreshGit();
		const openPath = docRef.current?.path;
		if (openPath && dirItems.some((i) => i.path === openPath)) void loadFile(openPath, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
	}, [cwd, say, t, refreshGit, loadFile]);
	// Stage / unstage one path or a whole directory ("" = whole repo). Rows
	// moving between the Staged/Changes sections is the feedback; only errors
	// raise a notice.
	const stageChange = useCallback(async (path) => {
		if (!cwd) return false;
		const repo = repoSelRef.current;
		const res = await api("git.stage", repo ? { cwd, path, repo } : { cwd, path });
		if (!res.ok || res.value?.error) {
			say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
			return false;
		}
		if (res.value.status) setGit(res.value.status);
		return true;
	}, [cwd, say, t]);
	const unstageChange = useCallback(async (path) => {
		if (!cwd) return false;
		const repo = repoSelRef.current;
		const res = await api("git.unstage", repo ? { cwd, path, repo } : { cwd, path });
		if (!res.ok || res.value?.error) {
			say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
			return false;
		}
		if (res.value.status) setGit(res.value.status);
		return true;
	}, [cwd, say, t]);
	// Commit the staged set; when nothing is staged the panel asks for a
	// "stage all & commit" instead (stageAll), done here as two calls.
	// amend rewrites the previous commit (never combined with stageAll).
	const commitChanges = useCallback(async (message, stageAll, amend) => {
		if (!cwd || committing) return false;
		setCommitting(true);
		try {
			const repo = repoSelRef.current;
			if (stageAll) {
				const sres = await api("git.stage", repo ? { cwd, path: "", repo } : { cwd, path: "" });
				if (!sres.ok || sres.value?.error) {
					say(`${t("error")}: ${sres.value?.error ?? sres.error}`, "error");
					return false;
				}
				if (sres.value.status) setGit(sres.value.status);
			}
			const res = await api("git.commit", repo ? { cwd, message, amend: amend === true, repo } : { cwd, message, amend: amend === true });
			const value = res.ok ? res.value ?? {} : { error: res.error };
			if (value.status) setGit(value.status);
			if (!res.ok || value.error) {
				say(`${t("error")}: ${value.error ?? res.error}`, "error");
				return false;
			}
			say(t("changes.committed", { c: value.commit ?? "" }));
			return true;
		} finally {
			setCommitting(false);
		}
	}, [cwd, committing, say, t]);

	return { sync, committing, doFetch, doPull, doPush, discardChange, discardMany, stageChange, unstageChange, commitChanges };
}
