/* ---------------- git changes panel (commit box + staged/unstaged + branch + commits + stash) ---------------- */

import { Fragment, h, useCallback, useEffect, useState } from "./react.js";
import { api } from "./api.js";
import { IconRefresh } from "./icons.js";
import { ChangeTree } from "./changetree.js";

/** Porcelain xy: the index (first) column decides whether the entry is staged. */
export function isStagedXy(xy) {
	return typeof xy === "string" && xy.length > 0 && xy[0] !== " " && xy[0] !== "?";
}

export function ChangesPanel({ cwd, t, git, repos, repoSel, onSelectRepo, commitsOpen, setCommitsOpen, onOpenCommit, onOpenDiff, onDiscard, onDiscardDir, onStage, onStageDir, onUnstage, onUnstageDir, onCommit, committing, onNotify, refresh }) {
	const [treeView, setTreeView] = useState(true);
	const [message, setMessage] = useState("");
	const [amend, setAmend] = useState(false);
	const [filterQuery, setFilterQuery] = useState("");
	// Stash section state — all hooks must run before the early returns below.
	const [stashes, setStashes] = useState([]);
	const [stashOpen, setStashOpen] = useState(false);
	const [stashSaving, setStashSaving] = useState(false);
	const [stashMsg, setStashMsg] = useState("");
	const [stashUntracked, setStashUntracked] = useState(false);
	const [stashBusy, setStashBusy] = useState(false);
	const [stashConfirm, setStashConfirm] = useState(null);
	const repoArgs = repoSel ? { cwd, repo: repoSel } : { cwd };
	const isRepo = Boolean(git && git.repo);
	const refreshStashes = useCallback(() => {
		if (!cwd || !isRepo) return;
		api("git.stash.list", repoSel ? { cwd, repo: repoSel } : { cwd })
			.then((res) => {
				if (res.ok && Array.isArray(res.value?.stashes)) setStashes(res.value.stashes);
			})
			.catch(() => {});
	}, [cwd, repoSel, isRepo]);
	useEffect(refreshStashes, [refreshStashes]);
	const stashSave = () => {
		if (stashBusy) return;
		setStashBusy(true);
		api("git.stash.save", { ...repoArgs, message: stashMsg.trim(), includeUntracked: stashUntracked })
			.then((res) => {
				setStashBusy(false);
				const value = res.ok ? res.value ?? {} : { error: res.error };
				if (Array.isArray(value.stashes)) setStashes(value.stashes);
				setStashSaving(false);
				setStashMsg("");
				refresh?.();
				if (value.error) onNotify?.(`${t("error")}: ${value.error}`, "error");
				else onNotify?.(t("stash.saved"));
			})
			.catch(() => setStashBusy(false));
	};
	const stashApply = (ref, pop) => {
		if (stashBusy) return;
		setStashBusy(true);
		api(pop ? "git.stash.pop" : "git.stash.apply", { ...repoArgs, ref })
			.then((res) => {
				setStashBusy(false);
				const value = res.ok ? res.value ?? {} : { error: res.error };
				if (Array.isArray(value.stashes)) setStashes(value.stashes);
				refresh?.();
				if (value.error) onNotify?.(`${t("error")}: ${value.error}`, "error");
				else onNotify?.(pop ? t("stash.popped") : t("stash.applied"));
			})
			.catch(() => setStashBusy(false));
	};
	const stashDrop = (ref) => {
		if (stashBusy) return;
		setStashBusy(true);
		api("git.stash.drop", { ...repoArgs, ref })
			.then((res) => {
				setStashBusy(false);
				setStashConfirm(null);
				const value = res.ok ? res.value ?? {} : { error: res.error };
				if (Array.isArray(value.stashes)) setStashes(value.stashes);
				if (value.error) onNotify?.(`${t("error")}: ${value.error}`, "error");
				else onNotify?.(t("stash.dropped"));
			})
			.catch(() => setStashBusy(false));
	};
	const selector = repos && repos.length > 0
		? h(
			"select",
			{ className: "ce-input ce-repo", value: repoSel ?? "", onChange: (event) => onSelectRepo(event.target.value || null) },
			h("option", { value: "" }, t("changes.pickRepo")),
			repos.map((r) => h("option", { key: r.root, value: r.root }, `${r.root.split("/").pop()} · ${r.branch}${r.dirtyCount ? ` · ~${r.dirtyCount}` : ""}`)),
		)
		: null;
	if (!git) return h("div", { className: "ce-rail ce-scroll" }, selector, h("div", { className: "ce-note" }, t("loading")));
	if (git.error) return h("div", { className: "ce-rail ce-scroll" }, selector, h("div", { className: "ce-note" }, git.error));
	if (!git.repo) return h("div", { className: "ce-rail ce-scroll" }, selector, repos && repos.length === 0 ? h("div", { className: "ce-note" }, t("changes.notRepo")) : null);
	const badge = (xy) => (xy === "??" ? "U" : xy.trim()[0] === "A" || xy.trim()[0] === "?" ? "A" : xy.trim()[0] || "M");
	const staged = git.working.filter((f) => isStagedXy(f.xy));
	const unstaged = git.working.filter((f) => !isStagedXy(f.xy));
	const q = filterQuery.trim().toLowerCase();
	const matchesPath = (value) => !q || String(value?.path ?? value ?? "").toLowerCase().includes(q);
	const visibleStaged = staged.filter(matchesPath);
	const visibleUnstaged = unstaged.filter(matchesPath);
	const visibleBranchFiles = (git.branchFiles ?? []).filter(matchesPath);
	const flatRows = (files, prefix, scope) => files.map((file) =>
		h(
			"button",
			{ key: `${prefix}:${file.path}`, className: "ce-row", type: "button", title: file.path, onClick: () => onOpenDiff(file.path, scope) },
			h("span", { className: `ce-badge ce-badge-${badge(file.xy).toLowerCase()}` }, badge(file.xy)),
			h("span", { className: "ce-name" }, file.path),
		),
	);
	// Enter (or the button) commits; with an empty index the button stages
	// everything first, labelled explicitly so the behavior is no surprise.
	// Amend mode rewrites the previous commit instead (never stage-all then).
	const submit = () => {
		const m = message.trim();
		if (!m || committing) return;
		if (!amend && git.working.length === 0) return;
		Promise.resolve(onCommit(m, !amend && staged.length === 0, amend)).then((ok) => {
			if (ok) setMessage("");
		});
	};
	const commitDisabled = message.trim() === "" || committing || (!amend && git.working.length === 0);
	const commitLabel = amend ? t("changes.amendCommit") : staged.length > 0 ? t("changes.commit") : t("changes.commitAll");
	return h(
		"div",
		{ className: "ce-rail ce-scroll ce-changes" },
		selector,
		h("div", { className: "ce-note" }, git.upstream
			? `${t("changes.vs")} ${git.upstream} · ↑${git.ahead ?? 0} ↓${git.behind ?? 0}${git.upstreamInferred ? " · auto" : ""}`
			: t("sync.noUpstream")),
		h("div", { className: "ce-changes-search" },
			h("input", { className: "ce-input", type: "search", value: filterQuery, placeholder: t("changes.filterPlaceholder"), "aria-label": t("changes.filterPlaceholder"), onChange: (e) => setFilterQuery(e.target.value) }),
		),
		h("div", { className: "ce-commitbox" },
			h("input", {
				className: "ce-input ce-commitbox-msg",
				"aria-label": t("changes.commitPlaceholder"),
				type: "text",
				placeholder: staged.length > 0 || amend ? t("changes.commitPlaceholder") : t("changes.commitAllPlaceholder"),
				value: message,
				disabled: committing,
				spellcheck: false,
				autoComplete: "off",
				onChange: (event) => setMessage(event.target.value),
				onKeyDown: (event) => {
					event.stopPropagation();
					if (event.key === "Enter") {
						event.preventDefault();
						submit();
					}
				},
			}),
			h("div", { className: "ce-commitbox-actions" },
			h("button", {
				type: "button",
				className: `ce-commitbox-amend${amend ? " ce-tool-on" : ""}`,
				"aria-pressed": amend,
				title: t("changes.amendTitle"),
				disabled: committing,
				onClick: () => setAmend((v) => !v),
			}, t("changes.amend")),
			h("button", {
				type: "button",
				className: "ce-commitbox-btn",
				disabled: commitDisabled,
				title: amend ? t("changes.amendTitle") : staged.length > 0 ? t("changes.commit") : t("changes.commitAll"),
				onClick: submit,
			}, committing ? t("changes.commitBusy") : `✓ ${commitLabel}`),
			),
		),
		h("section", { className: "ce-change-group" },
		staged.length > 0
			? h(
				Fragment,
				null,
				h(
					"div",
					{ className: "ce-section" },
					h("span", null, `${t("changes.staged")} · ${visibleStaged.length}${visibleStaged.length !== staged.length ? `/${staged.length}` : ""}`),
					h("button", { className: "ce-link", type: "button", title: t("changes.unstageAll"), onClick: () => onUnstageDir && onUnstageDir("") }, t("changes.unstageAll")),
				),
				treeView
					? h(ChangeTree, {
						items: visibleStaged.map((f) => ({ path: f.path, ch: badge(f.xy), from: f.from ?? void 0 })),
						onOpen: (item) => onOpenDiff(item.path, "staged"),
						onUnstage: (item) => onUnstage && onUnstage(item),
						onUnstageDir: (dirPath) => onUnstageDir && onUnstageDir(dirPath),
						keyPrefix: "s",
						t,
					})
					: flatRows(visibleStaged, "s", "staged"),
			)
			: null,
		h(
			"div",
			{ className: "ce-section" },
			h("span", null, `${t("changes.working")} · ${visibleUnstaged.length}${visibleUnstaged.length !== unstaged.length ? `/${unstaged.length}` : ""}`),
			unstaged.length > 0
				? h("button", { className: "ce-link", type: "button", title: t("changes.stageAll"), onClick: () => onStageDir && onStageDir("") }, t("changes.stageAll"))
				: null,
			h("button", { className: "ce-link", type: "button", title: treeView ? t("changes.toList") : t("changes.toTree"), onClick: () => setTreeView((v) => !v) }, treeView ? t("changes.toList") : t("changes.toTree")),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: t("refresh"), onClick: refresh }, h(IconRefresh)),
		),
		git.working.length === 0 && h("div", { className: "ce-note" }, t("changes.none")),
		treeView
			? h(ChangeTree, {
				items: visibleUnstaged.map((f) => ({ path: f.path, ch: badge(f.xy), from: f.from ?? void 0 })),
				onOpen: (item) => onOpenDiff(item.path, "working"),
				onDiscard: (item) => onDiscard && onDiscard(item),
				onDiscardDir: (dirItems) => onDiscardDir && onDiscardDir(dirItems),
				onStage: (item) => onStage && onStage(item),
				onStageDir: (dirPath) => onStageDir && onStageDir(dirPath),
				keyPrefix: "w",
				t,
			})
			: flatRows(visibleUnstaged, "w", "working"),
		),
		h("section", { className: "ce-change-group" },
		h("div", { className: "ce-section" }, t("changes.branch")),
		git.base
			? h(
				Fragment,
				null,
				h(
					"div",
					{ className: "ce-note ce-note-line" },
					h("span", null, `${git.branch} ${t("changes.vs")} ${git.base.name} · ${visibleBranchFiles.length}${visibleBranchFiles.length !== git.branchFiles.length ? `/${git.branchFiles.length}` : ""} files`),
					h(
						"button",
						{ type: "button", className: "ce-link", title: t("changes.commitsToggle"), "aria-expanded": commitsOpen ? "true" : "false", onClick: () => setCommitsOpen((v) => !v) },
						`${git.commits.length} ${t("changes.commits")} ${commitsOpen ? "▾" : "▸"}`,
					),
				),
				commitsOpen
					? git.commits.slice(0, 80).map((commit) =>
						h(
							"button",
							{ key: `c:${commit.hash}`, className: "ce-commit", type: "button", onClick: () => onOpenCommit(commit) },
							h("span", { className: "ce-chash" }, commit.hash),
							h("span", { className: "ce-csubject" }, commit.subject),
						))
					: null,
				treeView
					? h(ChangeTree, {
						items: visibleBranchFiles.map((p) => ({ path: p, ch: "C" })),
						onOpen: (item) => onOpenDiff(item.path, "branch"),
						keyPrefix: "b",
						t,
					})
					: visibleBranchFiles.map((path) =>
						h(
							"button",
							{ key: `b:${path}`, className: "ce-row", type: "button", title: path, onClick: () => onOpenDiff(path, "branch") },
							h("span", { className: "ce-badge ce-badge-c" }, "C"),
							h("span", { className: "ce-name" }, path),
						),
					),
			)
			: h("div", { className: "ce-note" }, t("changes.baseNone")),
		),
		h("section", { className: "ce-change-group" },
		h(
			"div",
			{ className: "ce-section" },
			h("span", null, `${t("stash.title")}${stashes.length ? ` · ${stashes.length}` : ""}`),
			h("button", { className: "ce-link", type: "button", title: t("stash.saveTitle"), disabled: stashBusy, onClick: () => { setStashSaving((v) => !v); setStashOpen(true); } }, `+ ${t("stash.save")}`),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: t("stash.toggle"), "aria-expanded": stashOpen ? "true" : "false", onClick: () => setStashOpen((v) => !v) }, stashOpen ? "▾" : "▸"),
		),
		stashSaving
			? h("div", { className: "ce-stash-save" },
				h("input", {
					className: "ce-input",
					placeholder: t("stash.msgPlaceholder"),
					value: stashMsg,
					autoFocus: true,
					onChange: (e) => setStashMsg(e.target.value),
					onKeyDown: (e) => {
						e.stopPropagation();
						if (e.key === "Enter") stashSave();
						else if (e.key === "Escape") setStashSaving(false);
					},
				}),
				h("label", { className: "ce-stash-u", title: t("stash.untrackedTitle") },
					h("input", { type: "checkbox", checked: stashUntracked, onChange: (e) => setStashUntracked(e.target.checked) }),
					t("stash.untracked"),
				),
				h("button", { className: "ce-sk-btn", type: "button", disabled: stashBusy, onClick: stashSave }, stashBusy ? "…" : t("stash.save")),
			)
			: null,
		stashOpen
			? (stashes.length === 0
				? h("div", { className: "ce-note" }, t("stash.none"))
				: stashes.map((s) => h("div", { key: s.ref, className: "ce-stashrow" },
					h("span", { className: "ce-stashref" }, s.ref.replace(/^stash@\{(\d+)\}$/, "#$1")),
					h("span", { className: "ce-stashmsg", title: s.message }, s.message || "—"),
					h("span", { className: "ce-stashacts" },
						stashConfirm === s.ref
							? h(Fragment, null,
								h("button", { type: "button", className: "cet-act cet-act-show cet-act-danger", disabled: stashBusy, onClick: () => stashDrop(s.ref) }, t("stash.confirm")),
								h("button", { type: "button", className: "cet-act cet-act-show", onClick: () => setStashConfirm(null) }, t("stash.cancel")),
							)
							: h(Fragment, null,
								h("button", { type: "button", className: "ce-link", disabled: stashBusy, title: t("stash.applyTitle"), onClick: () => stashApply(s.ref, false) }, t("stash.apply")),
								h("button", { type: "button", className: "ce-link", disabled: stashBusy, title: t("stash.popTitle"), onClick: () => stashApply(s.ref, true) }, t("stash.pop")),
								h("button", { type: "button", className: "ce-tool ce-tiny", title: t("stash.drop"), disabled: stashBusy, onClick: () => setStashConfirm(s.ref) }, "✕"),
							),
					),
				)))
			: null,
		),
	);
}
