/* ---------------- git changes panel (working tree + branch + commits) ---------------- */

import { Fragment, h, useState } from "./react.js";
import { IconRefresh } from "./icons.js";
import { ChangeTree } from "./changetree.js";

export function ChangesPanel({ cwd, t, git, repos, repoSel, onSelectRepo, commitsOpen, setCommitsOpen, onOpenCommit, onOpenDiff, onDiscard, onDiscardDir, refresh }) {
	const [treeView, setTreeView] = useState(true);
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
	return h(
		"div",
		{ className: "ce-rail ce-scroll" },
		selector,
		h("div", { className: "ce-note" }, git.upstream
			? `${t("changes.vs")} ${git.upstream} · ↑${git.ahead ?? 0} ↓${git.behind ?? 0}${git.upstreamInferred ? " · auto" : ""}`
			: t("sync.noUpstream")),
		h(
			"div",
			{ className: "ce-section" },
			h("span", null, `${t("changes.working")} · ${git.working.length}`),
			h("button", { className: "ce-link", type: "button", title: treeView ? t("changes.toList") : t("changes.toTree"), onClick: () => setTreeView((v) => !v) }, treeView ? t("changes.toList") : t("changes.toTree")),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: t("refresh"), onClick: refresh }, h(IconRefresh)),
		),
		git.working.length === 0 && h("div", { className: "ce-note" }, t("changes.none")),
		treeView
			? h(ChangeTree, {
				items: git.working.map((f) => ({ path: f.path, ch: badge(f.xy), from: f.from ?? void 0 })),
				onOpen: (item) => onOpenDiff(item.path, "working"),
				onDiscard: (item) => onDiscard && onDiscard(item),
				onDiscardDir: (dirItems) => onDiscardDir && onDiscardDir(dirItems),
				keyPrefix: "w",
				t,
			})
			: git.working.map((file) =>
				h(
					"button",
					{ key: `w:${file.path}`, className: "ce-row", type: "button", title: file.path, onClick: () => onOpenDiff(file.path, "working") },
					h("span", { className: `ce-badge ce-badge-${badge(file.xy).toLowerCase()}` }, badge(file.xy)),
					h("span", { className: "ce-name" }, file.path),
				),
			),
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
