/* ---------------- git changes panel (commit box + staged/unstaged + branch + commits) ---------------- */

import { Fragment, h, useState } from "./react.js";
import { IconRefresh } from "./icons.js";
import { ChangeTree } from "./changetree.js";

/** Porcelain xy: the index (first) column decides whether the entry is staged. */
export function isStagedXy(xy) {
	return typeof xy === "string" && xy.length > 0 && xy[0] !== " " && xy[0] !== "?";
}

export function ChangesPanel({ cwd, t, git, repos, repoSel, onSelectRepo, commitsOpen, setCommitsOpen, onOpenCommit, onOpenDiff, onDiscard, onDiscardDir, onStage, onStageDir, onUnstage, onUnstageDir, onCommit, committing, refresh }) {
	const [treeView, setTreeView] = useState(true);
	const [message, setMessage] = useState("");
	const [amend, setAmend] = useState(false);
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
		{ className: "ce-rail ce-scroll" },
		selector,
		h("div", { className: "ce-note" }, git.upstream
			? `${t("changes.vs")} ${git.upstream} · ↑${git.ahead ?? 0} ↓${git.behind ?? 0}${git.upstreamInferred ? " · auto" : ""}`
			: t("sync.noUpstream")),
		h("div", { className: "ce-commitbox" },
			h("button", {
				type: "button",
				className: `ce-tool ce-tiny${amend ? " ce-tool-on" : ""}`,
				title: t("changes.amendTitle"),
				disabled: committing,
				onClick: () => setAmend((v) => !v),
			}, t("changes.amend")),
			h("input", {
				className: "ce-input ce-commitbox-msg",
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
			h("button", {
				type: "button",
				className: "ce-commitbox-btn",
				disabled: commitDisabled,
				title: amend ? t("changes.amendTitle") : staged.length > 0 ? t("changes.commit") : t("changes.commitAll"),
				onClick: submit,
			}, committing ? t("changes.commitBusy") : `✓ ${commitLabel}`),
		),
		staged.length > 0
			? h(
				Fragment,
				null,
				h(
					"div",
					{ className: "ce-section" },
					h("span", null, `${t("changes.staged")} · ${staged.length}`),
					h("button", { className: "ce-link", type: "button", title: t("changes.unstageAll"), onClick: () => onUnstageDir && onUnstageDir("") }, t("changes.unstageAll")),
				),
				treeView
					? h(ChangeTree, {
						items: staged.map((f) => ({ path: f.path, ch: badge(f.xy), from: f.from ?? void 0 })),
						onOpen: (item) => onOpenDiff(item.path, "staged"),
						onUnstage: (item) => onUnstage && onUnstage(item),
						onUnstageDir: (dirPath) => onUnstageDir && onUnstageDir(dirPath),
						keyPrefix: "s",
						t,
					})
					: flatRows(staged, "s", "staged"),
			)
			: null,
		h(
			"div",
			{ className: "ce-section" },
			h("span", null, `${t("changes.working")} · ${unstaged.length}`),
			unstaged.length > 0
				? h("button", { className: "ce-link", type: "button", title: t("changes.stageAll"), onClick: () => onStageDir && onStageDir("") }, t("changes.stageAll"))
				: null,
			h("button", { className: "ce-link", type: "button", title: treeView ? t("changes.toList") : t("changes.toTree"), onClick: () => setTreeView((v) => !v) }, treeView ? t("changes.toList") : t("changes.toTree")),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: t("refresh"), onClick: refresh }, h(IconRefresh)),
		),
		git.working.length === 0 && h("div", { className: "ce-note" }, t("changes.none")),
		treeView
			? h(ChangeTree, {
				items: unstaged.map((f) => ({ path: f.path, ch: badge(f.xy), from: f.from ?? void 0 })),
				onOpen: (item) => onOpenDiff(item.path, "working"),
				onDiscard: (item) => onDiscard && onDiscard(item),
				onDiscardDir: (dirItems) => onDiscardDir && onDiscardDir(dirItems),
				onStage: (item) => onStage && onStage(item),
				onStageDir: (dirPath) => onStageDir && onStageDir(dirPath),
				keyPrefix: "w",
				t,
			})
			: flatRows(unstaged, "w", "working"),
		h("div", { className: "ce-section" }, t("changes.branch")),
		git.base
			? h(
				Fragment,
				null,
				h(
					"div",
					{ className: "ce-note ce-note-line" },
					h("span", null, `${git.branch} ${t("changes.vs")} ${git.base.name} · ${git.branchFiles.length} files`),
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
						items: git.branchFiles.map((p) => ({ path: p, ch: "C" })),
						onOpen: (item) => onOpenDiff(item.path, "branch"),
						keyPrefix: "b",
						t,
					})
					: git.branchFiles.map((path) =>
						h(
							"button",
							{ key: `b:${path}`, className: "ce-row", type: "button", title: path, onClick: () => onOpenDiff(path, "branch") },
							h("span", { className: "ce-badge ce-badge-c" }, "C"),
							h("span", { className: "ce-name" }, path),
						),
					),
			)
			: h("div", { className: "ce-note" }, t("changes.baseNone")),
	);
}
