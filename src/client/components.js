/* ---------------- components ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { ROW } from "./constants.js";
import { api } from "./api.js";
import { buildLineStates, langFor, tokenizeLine, wordAt } from "./highlight.js";
import { IconArrowLeft, IconArrowRight, IconBolt, IconCode, IconFile, IconFolder, IconRefresh, IconSearch, IconTextSearch } from "./icons.js";
import { DiffView, changedNewLines, deletedGroups, changeBlobs } from "./diff.js";
import { MarkdownView } from "./markdown.js";
import { ChangeTree } from "./changetree.js";
import { BranchPalette } from "./branchpick.js";

/** Files that open in rendered preview by default: markdown and html. */
const PREVIEW_RE = /\.(md|markdown|html?)$/i;
const MD_RE = /\.(md|markdown)$/i;

/** Compact author-time for the blame column: <1d / Nd / Nmo / Ny. */
function relTime(epoch) {
	const days = Math.floor((Date.now() / 1000 - (epoch || 0)) / 86400);
	if (days <= 0) return "<1d";
	if (days < 30) return `${days}d`;
	const months = Math.floor(days / 30);
	if (months < 18) return `${months}mo`;
	return `${Math.floor(months / 12)}y`;
}

function RelPath(cwd, path) {
	if (typeof path !== "string") return "";
	if (cwd && path.startsWith(cwd.endsWith("/") ? cwd : `${cwd}/`)) return path.slice(cwd.length + (cwd.endsWith("/") ? 0 : 1));
	return path;
}

function toAbs(cwd, path) {
	if (typeof path !== "string") return "";
	return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) ? path.replace(/\\/g, "/") : `${cwd.replace(/\/+$/, "")}/${path.replace(/\\/g, "/")}`;
}

function TreePanel({ cwd, t, onOpenFile, activePath, refreshKey, onNotify, onDeleted }) {
	const [listing, setListing] = useState({});
	const [expanded, setExpanded] = useState([]);
	const [action, setAction] = useState(null); // {kind: newfile|newdir|rename|delete, path, value}
	const loadDir = useCallback((path) => {
		setListing((current) => ({ ...current, [path]: { loading: true } }));
		api("fs.list", { cwd, path }).then((res) => {
			setListing((current) => ({ ...current, [path]: res.ok ? res.value : { error: res.error } }));
		});
	}, [cwd]);
	useEffect(() => {
		setListing({});
		setExpanded([]);
		setAction(null);
		loadDir("");
	}, [cwd, refreshKey, loadDir]);
	const toggle = (path) => {
		if (expanded.includes(path)) {
			setExpanded(expanded.filter((p) => p !== path));
			return;
		}
		setExpanded([...expanded, path]);
		if (listing[path] === undefined) loadDir(path);
	};
	const parentOf = (path) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
	const finish = (res, okMsg, touchedDir) => {
		if (!res.ok || res.value?.error) {
			onNotify?.(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
			return;
		}
		onNotify?.(okMsg);
		loadDir(touchedDir);
		setAction(null);
	};
	const cleanName = (name) => {
		const clean = String(name ?? "").trim();
		if (clean === "" || clean.includes("/") || clean === "." || clean === "..") {
			onNotify?.(`${t("error")}: ${t("tree.badName")}`, "error");
			return null;
		}
		return clean;
	};
	const runCreate = (dirPath, name, kind) => {
		const clean = cleanName(name);
		if (clean === null) return;
		api("fs.create", { cwd, path: dirPath === "" ? clean : `${dirPath}/${clean}`, kind }).then((res) => finish(res, t("tree.created"), dirPath));
	};
	const runRename = (path, newName) => {
		const clean = cleanName(newName);
		if (clean === null) return;
		const dir = parentOf(path);
		api("fs.rename", { cwd, path, to: dir === "" ? clean : `${dir}/${clean}` }).then((res) => finish(res, t("tree.renamed"), dir));
	};
	const runDelete = (path) => {
		api("fs.delete", { cwd, path }).then((res) => {
			if (!res.ok || res.value?.error) {
				onNotify?.(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
				setAction(null);
				return;
			}
			onNotify?.(t("tree.deleted"));
			onDeleted?.(path);
			loadDir(parentOf(path));
			setAction(null);
		});
	};
	const depthOf = (path) => (path === "" ? 0 : path.split("/").length);
	const inputRow = (dirPath, kind, placeholder) => h("div", {
		key: `inp:${dirPath}:${kind}`,
		className: "ce-row ctp-inputrow",
		style: { paddingLeft: 6 + depthOf(dirPath) * 14 },
	},
	h("input", {
		className: "ce-input",
		placeholder,
		autoFocus: true,
		value: action?.value ?? "",
		onChange: (e) => setAction({ ...action, value: e.target.value }),
		onKeyDown: (e) => {
			e.stopPropagation();
			if (e.key === "Enter") {
				if (kind === "rename") runRename(action.path, e.target.value);
				else runCreate(dirPath, e.target.value, kind);
			} else if (e.key === "Escape") setAction(null);
		},
	}),
	);
	const acts = (path, isDir) => h("span", { className: "ctp-acts" },
		isDir ? h("button", {
			type: "button",
			className: "cet-act",
			title: t("tree.newFile"),
			onClick: (e) => {
				e.stopPropagation();
				if (!expanded.includes(path)) setExpanded([...expanded, path]);
				if (listing[path] === undefined) loadDir(path);
				setAction({ kind: "newfile", path, value: "" });
			},
		}, "+") : null,
		h("button", {
			type: "button",
			className: "cet-act",
			title: t("tree.rename"),
			onClick: (e) => {
				e.stopPropagation();
				setAction({ kind: "rename", path, value: path.split("/").pop() });
			},
		}, "✎"),
		action?.kind === "delete" && action.path === path
			? h(Fragment, null,
				h("button", {
					type: "button",
					className: "cet-act cet-act-show cet-act-danger",
					onClick: (e) => {
						e.stopPropagation();
						runDelete(path);
					},
				}, t("changes.confirm")),
				h("button", {
					type: "button",
					className: "cet-act cet-act-show",
					onClick: (e) => {
						e.stopPropagation();
						setAction(null);
					},
				}, t("changes.cancel")),
			)
			: h("button", {
				type: "button",
				className: "cet-act",
				title: t("tree.delete"),
				onClick: (e) => {
					e.stopPropagation();
					setAction({ kind: "delete", path });
				},
			}, "✕"),
	);
	const renderLevel = (path, depth) => {
		const state = listing[path];
		if (!state) return null;
		if (state.loading) return h("div", { key: `${path}-l`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, t("loading"));
		if (state.error) return h("div", { key: `${path}-l`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, `${t("tree.failed")}: ${state.error}`);
		const entries = [...(state.entries ?? [])].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
		const rows = [];
		for (const entry of entries) {
			const childPath = path === "" ? entry.name : `${path}/${entry.name}`;
			if (entry.type === "directory") {
				const open = expanded.includes(childPath);
				rows.push(
					h(
						"button",
						{ key: childPath, className: "ce-row", style: { paddingLeft: 6 + depth * 14 }, onClick: () => toggle(childPath), type: "button" },
						h("span", { className: "ce-ico" }, h(IconFolder, { open })),
						h("span", { className: "ce-name" }, entry.name),
						acts(childPath, true),
					),
				);
				if (action?.kind === "rename" && action.path === childPath) rows.push(inputRow(childPath, "rename", t("tree.renamePlaceholder")));
				if (open && action?.kind === "newfile" && action.path === childPath) rows.push(inputRow(childPath, "file", t("tree.newFilePlaceholder")));
				if (open && action?.kind === "newdir" && action.path === childPath) rows.push(inputRow(childPath, "dir", t("tree.newDirPlaceholder")));
				if (open) rows.push(renderLevel(childPath, depth + 1));
			} else if (entry.type === "file") {
				rows.push(
					h(
						"button",
						{
							key: childPath,
							className: `ce-row${activePath && (activePath === childPath || activePath.endsWith(`/${childPath}`)) ? " ce-active" : ""}`,
							style: { paddingLeft: 6 + depth * 14 },
							type: "button",
							onClick: () => onOpenFile(childPath, 1, 1),
						},
						h("span", { className: "ce-ico" }, h(IconFile)),
						h("span", { className: "ce-name" }, entry.name),
						acts(childPath, false),
					),
				);
				if (action?.kind === "rename" && action.path === childPath) rows.push(inputRow(path, "rename", t("tree.renamePlaceholder")));
			}
		}
		if (!rows.length) rows.push(h("div", { key: `${path}-e`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, t("tree.empty")));
		return h(Fragment, { key: path }, rows);
	};
	return h("div", { className: "ce-scroll ce-rail" },
		h("div", { className: "ctp-tools" },
			h("button", { type: "button", className: "cet-act cet-act-show", title: t("tree.newFileRoot"), onClick: () => setAction({ kind: "newfile", path: "", value: "" }) }, `+ ${t("tree.fileWord")}`),
			h("button", { type: "button", className: "cet-act cet-act-show", title: t("tree.newDirRoot"), onClick: () => setAction({ kind: "newdir", path: "", value: "" }) }, `+ ${t("tree.dirWord")}`),
		),
		action !== null && (action.kind === "newfile" || action.kind === "newdir") && action.path === ""
			? inputRow("", action.kind === "newdir" ? "dir" : "file", action.kind === "newdir" ? t("tree.newDirPlaceholder") : t("tree.newFilePlaceholder"))
			: null,
		renderLevel("", 0),
	);
}

function ChangesPanel({ cwd, t, git, repos, repoSel, onSelectRepo, commitsOpen, setCommitsOpen, onOpenCommit, onOpenDiff, onDiscard, onDiscardDir, refresh }) {
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

function LocationList({ t, overlay, cwd, onPick, onClose }) {
	return h(
		"div",
		{ className: "ce-overlay" },
		h(
			"div",
			{ className: "ce-overlay-head" },
			h("span", null, `${overlay.title} · ${overlay.items.length}`),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: t("close"), onClick: onClose }, "✕"),
		),
		h(
			"div",
			{ className: "ce-overlay-list ce-scroll" },
			overlay.items.map((item, i) =>
				h(
					"button",
					{ key: i, className: "ce-loc", type: "button", onClick: () => onPick(item) },
					h("span", { className: "ce-loc-path" }, `${RelPath(cwd, item.path)}:${item.line}:${item.col}`),
					item.snippet ? h("span", { className: "ce-loc-snippet" }, item.snippet) : null,
				),
			),
		),
	);
}

function QuickOpen({ t, state, onQuery, onPick, onClose }) {
	const [sel, setSel] = useState(0);
	const inputRef = useRef(null);
	const listRef = useRef(null);
	useEffect(() => {
		setSel(0);
	}, [state.query]);
	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	const items = state.results ?? [];
	useEffect(() => {
		const node = listRef.current?.querySelector(`[data-qi="${sel}"]`);
		node?.scrollIntoView({ block: "nearest" });
	}, [sel]);
	const choose = useCallback((i) => {
		const item = items[i];
		if (item) onPick(item.path);
	}, [items, onPick]);
	const onKeyDown = (event) => {
		if (event.key === "Escape") {
			event.stopPropagation();
			onClose();
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			setSel((s) => Math.min(items.length - 1, s + 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setSel((s) => Math.max(0, s - 1));
		} else if (event.key === "Enter") {
			event.preventDefault();
			choose(sel);
		}
	};
	return h(
		"div",
		{ className: "ce-palette", onKeyDown },
		h(
			"div",
			{ className: "ce-palette-head" },
			h("input", {
				ref: inputRef,
				className: "ce-input",
				type: "text",
				placeholder: t("quickopen.placeholder"),
				value: state.query,
				onChange: (event) => onQuery(event.target.value),
				onKeyDown,
				spellcheck: false,
				autoCapitalize: "off",
				autoComplete: "off",
			}),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		h(
			"div",
			{ className: "ce-palette-list ce-scroll", ref: listRef },
			state.busy && items.length === 0 ? h("div", { className: "ce-note" }, t("quickopen.loading")) : null,
			!state.busy && items.length === 0 ? h("div", { className: "ce-note" }, state.query ? t("quickopen.empty") : t("loading")) : null,
			items.map((item, i) => {
				const slash = item.path.lastIndexOf("/");
				return h(
					"button",
					{
						key: item.path,
						type: "button",
						"data-qi": i,
						className: `ce-qitem${i === sel ? " ce-qitem-sel" : ""}`,
						onMouseEnter: () => setSel(i),
						onClick: () => choose(i),
					},
					h("span", { className: "ce-qbase" }, slash >= 0 ? item.path.slice(slash + 1) : item.path),
					slash >= 0 ? h("span", { className: "ce-qdir" }, item.path.slice(0, slash)) : null,
				);
			}),
		),
	);
}

function SearchPanel({ t, cwd, state, onQuery, onInclude, onSubmit, onPick, onClose }) {
	const inputRef = useRef(null);
	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	return h(
		"div",
		{ className: "ce-search" },
		h(
			"div",
			{ className: "ce-search-box" },
			h("input", {
				ref: inputRef,
				className: "ce-input ce-search-q",
				type: "text",
				placeholder: t("search.placeholder"),
				value: state.query,
				onChange: (event) => onQuery(event.target.value),
				onKeyDown: (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						onSubmit();
					} else if (event.key === "Escape") {
						event.stopPropagation();
						onClose();
					}
				},
				spellcheck: false,
				autoCapitalize: "off",
				autoComplete: "off",
			}),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: t("search.run"), onClick: onSubmit }, h(IconSearch)),
		),
		h("input", {
			className: "ce-input ce-search-include",
			type: "text",
			placeholder: t("search.include"),
			value: state.include,
			onChange: (event) => onInclude(event.target.value),
			onKeyDown: (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					onSubmit();
				}
			},
			spellcheck: false,
			autoCapitalize: "off",
			autoComplete: "off",
		}),
		h(
			"div",
			{ className: "ce-search-meta" },
			state.busy
				? t("search.searching")
				: state.results
					? `${state.results.length} ${t("search.results")}${state.engine ? ` · ${state.engine}` : ""}${state.truncated ? ` · ${t("search.truncated")}` : ""}`
					: state.query.trim().length < 2
						? t("search.empty")
						: t("search.none"),
		),
		state.error ? h("div", { className: "ce-note" }, `${t("search.failed")}: ${state.error}`) : null,
		h(
			"div",
			{ className: "ce-search-results ce-scroll" },
			(state.results ?? []).map((r, i) =>
				h(
					"button",
					{ key: i, type: "button", className: "ce-sresult", onClick: () => onPick(r) },
					h("span", { className: "ce-sloc" }, `${RelPath(cwd, r.path) || r.path}:${r.line}`),
					h("span", { className: "ce-stext" }, r.text),
				),
			),
		),
	);
}

function RefsPeek({ t, cwd, peek, scroll, totalLines, onPick, onClose }) {
	const defs = peek.def ?? [];
	const refs = (peek.refs ?? []).filter((r) => !defs.some((d) => d.path === r.path && d.line === r.line && d.col === r.col));
	const groups = [];
	const pushRow = (loc, isDef) => {
		let g = groups.find((x) => x.path === loc.path);
		if (!g) {
			g = { path: loc.path, rows: [] };
			groups.push(g);
		}
		g.rows.push({ ...loc, isDef });
	};
	defs.slice(0, 30).forEach((d) => pushRow(d, true));
	refs.slice(0, 60).forEach((r) => pushRow(r, false));
	const flat = [];
	for (const g of groups) flat.push(...g.rows);
	const [sel, setSel] = useState(0);
	const bodyRef = useRef(null);
	useEffect(() => {
		setSel(0);
	}, [peek.symbol, peek.busy]);
	useEffect(() => {
		bodyRef.current?.querySelector(`[data-ri="${sel}"]`)?.scrollIntoView({ block: "nearest" });
	}, [sel]);
	const onKeyDown = (event) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			event.stopPropagation();
			setSel((s) => Math.min(flat.length - 1, s + 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			event.stopPropagation();
			setSel((s) => Math.max(0, s - 1));
		} else if (event.key === "Enter") {
			event.preventDefault();
			event.stopPropagation();
			if (flat[sel]) onPick(flat[sel]);
		}
	};
	const top = Math.max(6, Math.min(peek.anchorLine * ROW + 6 - scroll, totalLines * ROW));
	let ri = 0;
	return h(
		"div",
		{ className: "ce-peek", style: { top }, onKeyDown, onMouseDown: (event) => event.stopPropagation() },
		h(
			"div",
			{ className: "ce-peek-head" },
			h("span", { className: "ce-peek-sym" }, peek.symbol),
			peek.busy
				? h("span", { className: "ce-peek-meta" }, t("loading"))
				: h("span", { className: "ce-peek-meta" }, `${t("peek.defs")} ${defs.length} · ${t("peek.refs")} ${refs.length}`),
			h("span", { className: "ce-spacer" }),
			h("span", { className: "ce-peek-hint" }, t("peek.hint")),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		peek.error ? h("div", { className: "ce-note" }, peek.error) : null,
		!peek.busy && flat.length === 0 && !peek.error ? h("div", { className: "ce-note" }, t("peek.empty")) : null,
		h(
			"div",
			{ className: "ce-peek-body ce-scroll", ref: bodyRef },
			groups.map((g, gi) => {
				const fileRows = g.rows.map((r) => {
					const i = ri++;
					return h(
						"button",
						{
							key: i,
							type: "button",
							"data-ri": i,
							className: `ce-peek-row${i === sel ? " ce-peek-row-sel" : ""}${r.isDef ? " ce-peek-def" : ""}`,
							onMouseEnter: () => setSel(i),
							onClick: () => onPick(r),
						},
						h("span", { className: "ce-peek-lno" }, `${r.line}:${r.col}`),
						h("span", { className: "ce-peek-snippet" }, r.snippet ?? ""),
					);
				});
				return h(
					Fragment,
					{ key: `${g.path}-${gi}` },
					h("div", { className: "ce-peek-file" }, h("span", { className: "ce-peek-fpath" }, RelPath(cwd, g.path) || g.path)),
					fileRows,
				);
			}),
		),
	);
}

const SYMBOL_GLYPHS = { 2: "▣", 3: "ƒ", 4: "Ω", 5: "◆", 6: "ƒ", 7: "◆", 8: "◈", 9: "#", 10: "◈", 11: "▣", 12: "✓", 13: "▣", 14: "🛡", 15: "ω", 16: "◆", 17: "◆", 18: "≡", 19: "◦", 20: "◦", 21: "≡", 22: "◆", 23: "◆", 24: "▣", 25: "•", 26: "•" };

function SymbolPalette({ t, symbols, onPick, onClose }) {
	const [query, setQuery] = useState("");
	const [sel, setSel] = useState(0);
	const inputRef = useRef(null);
	const listRef = useRef(null);
	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	const q = query.trim().toLowerCase();
	const items = useMemo(() => {
		const filtered = !q ? symbols : symbols.filter((s) => (s.name ?? "").toLowerCase().includes(q) || (s.name ?? "").toLowerCase().startsWith(q));
		return filtered.slice(0, 120);
	}, [symbols, q]);
	useEffect(() => {
		setSel(0);
	}, [query]);
	useEffect(() => {
		listRef.current?.querySelector(`[data-si="${sel}"]`)?.scrollIntoView({ block: "nearest" });
	}, [sel]);
	const onKeyDown = (event) => {
		if (event.key === "Escape") {
			event.stopPropagation();
			onClose();
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			setSel((s) => Math.min(items.length - 1, s + 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setSel((s) => Math.max(0, s - 1));
		} else if (event.key === "Enter") {
			event.preventDefault();
			if (items[sel]) onPick(items[sel]);
		}
	};
	return h(
		"div",
		{ className: "ce-palette", onKeyDown, onMouseDown: (event) => event.stopPropagation() },
		h(
			"div",
			{ className: "ce-palette-head" },
			h("input", {
				ref: inputRef,
				className: "ce-input",
				type: "text",
				placeholder: t("symbols.placeholder"),
				value: query,
				onChange: (event) => setQuery(event.target.value),
				onKeyDown,
				spellcheck: false,
			}),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		h(
			"div",
			{ className: "ce-palette-list ce-scroll", ref: listRef },
			items.length === 0 ? h("div", { className: "ce-note" }, t("symbols.none")) : null,
			items.map((s, i) =>
				h(
					"button",
					{
						key: `${s.name}-${s.line}-${i}`,
						type: "button",
						"data-si": i,
						className: `ce-qitem${i === sel ? " ce-qitem-sel" : ""}`,
						onMouseEnter: () => setSel(i),
						onClick: () => onPick(s),
					},
					h("span", { className: "ce-symglyph" }, SYMBOL_GLYPHS[s.kind] ?? "•"),
					h("span", { className: "ce-qbase" }, s.name),
					h("span", { className: "ce-qdir" }, `:${s.line}:${s.col}`),
				),
			),
		),
	);
}

export function CodeBody(props) {
	const { useTabInfo, sessionId, useSessions, t } = props;
	const tabInfo = useTabInfo ? useTabInfo() : null;
	const tab = tabInfo?.tab;
	const cwd = useSessions ? useSessions((sessions) => (sessionId ? sessions.byId[sessionId]?.cwd : undefined)) : undefined;

	const [mode, setMode] = useState("files");
	const [doc, setDoc] = useState(null); // {path, lines, states, truncated, error}
	const [diff, setDiff] = useState(null); // {path, scope, text, ...}
	const [git, setGit] = useState(null);
	const [cursor, setCursor] = useState(null); // {line, col, word}
	const [diagnostics, setDiagnostics] = useState([]);
	const [overlay, setOverlay] = useState(null);
	const [hover, setHover] = useState(null);
	const [status, setStatus] = useState({ state: "off", message: "", progress: "" });
	const [notice, setNotice] = useState({ text: "", kind: "info" });
	const [treeKey, setTreeKey] = useState(0);
	const [flash, setFlash] = useState(null); // {line, col, word}
	const [scroll, setScroll] = useState(0);
	const [viewport, setViewport] = useState(600);
	const [palette, setPalette] = useState(null); // {query, results, busy}
	const [search, setSearch] = useState(null); // {query, include, results, engine, truncated, busy, error}
	const [searchOpen, setSearchOpen] = useState(false);
	const [peek, setPeek] = useState(null);
	const [editing, setEditing] = useState(false);
	const [editText, setEditText] = useState("");
	const [findOpen, setFindOpen] = useState(false);
	const [findQuery, setFindQuery] = useState("");
	const [findIdx, setFindIdx] = useState(0);
	const [diffMarks, setDiffMarks] = useState(null);
	const [branchPickOpen, setBranchPickOpen] = useState(false);
	const [blameOn, setBlameOn] = useState(false);
	const [blame, setBlame] = useState(null);
	const [previewOn, setPreviewOn] = useState(false);
	const [delGroups, setDelGroups] = useState(null);
	const [delPreview, setDelPreview] = useState(null);
	const [showDiffView, setShowDiffView] = useState(true); // {symbol, anchorLine, busy, def, refs, error}
	const [railW, setRailW] = useState(230);
	const [railVisible, setRailVisible] = useState(true);
	const [symbols, setSymbols] = useState([]);
	const [symPalette, setSymPalette] = useState(null); // {query}
	const [commitsOpen, setCommitsOpen] = useState(false);
	const peekNonce = useRef(0);
	const paletteTimer = useRef(null);
	const searchTimer = useRef(null);
	const searchNonce = useRef(0);
	const symbolNonce = useRef(0);
	const saveTimer = useRef(null);
	const restoredFor = useRef(null);

	const codeRef = useRef(null);
	const mainRef = useRef(null);
	const histRef = useRef({ back: [], forward: [] });
	const [histTick, setHistTick] = useState(0);
	const docRef = useRef(null);
	const cursorRef = useRef(null);
	const modeRef = useRef("code"); // code | diff
	const openSeqRef = useRef(0);
	const noticeTimer = useRef(null);
	const latestPersistRef = useRef(null);
	const peekRef = useRef(null);

	docRef.current = doc;
	cursorRef.current = cursor;
	peekRef.current = peek;

	const say = useCallback((text, kind = "info") => {
		setNotice({ text, kind });
		if (noticeTimer.current) clearTimeout(noticeTimer.current);
		if (kind !== "error") noticeTimer.current = setTimeout(() => setNotice({ text: "", kind: "info" }), 3800);
	}, []);

	const persistKey = sessionId && cwd ? `dsh.plugin-kit.v1.${sessionId}` : null;

	/* P0-5: while gopls starts or indexes, poll its progress for the status surfaces */
	useEffect(() => {
		if (!cwd || (status.state !== "starting" && !status.progress)) return undefined;
		const timer = setInterval(() => {
			api("lsp.status", { cwd }).then((r) => r.ok && setStatus(r.value));
		}, 2500);
		return () => clearInterval(timer);
	}, [cwd, status.state, status.progress]);

	const refreshGit = useCallback(() => {
		if (!cwd) return;
		const repo = repoSelRef.current;				api("git.status", repo ? { cwd, repo } : { cwd }).then((res) => {
			if (!res.ok) {
				setGit({ error: res.error });
				return;
			}
			const v = res.value;
			if (v && v.repo === false && Array.isArray(v.repos)) {
				setRepos(v.repos);
				if (v.repos.length && !repo) {
					const abs = docRef.current ? toAbs(cwd, docRef.current.path) : "";
					const pick = v.repos.find((r) => abs && (abs === r.root || abs.startsWith(`${r.root}/`))) ?? v.repos[0];
					repoSelRef.current = pick.root;
					setRepoSel(pick.root);
				}
				if (!v.repos.length && !repo) setGit({ repo: false, repos: [] });
				return;
			}
			setGit(v);
		});
	}, [cwd]);

	const [sync, setSync] = useState({ busy: false });
	const [repos, setRepos] = useState(null); // [{root, branch, dirtyCount}]
	const [repoSel, setRepoSel] = useState(null); // absolute root when the cwd is not a repo
	const repoSelRef = useRef(null);

	const fetchDiagnostics = useCallback((path, seq) => {
		if (!cwd || !path.endsWith(".go")) return;
		const pull = () => {
			if (openSeqRef.current !== seq) return;
			api("lsp.diagnostics", { cwd, path }).then((res) => {
				if (res.ok && openSeqRef.current === seq) setDiagnostics(res.value.items ?? []);
			});
		};
		pull();
		setTimeout(pull, 1800);
		setTimeout(pull, 4500);
	}, [cwd]);

	const loadFile = useCallback(
		async (path, line, col, mark) => {
			if (!cwd) return null;
			const res = await api("fs.read", { cwd, path });
			if (!res.ok) {
				say(`${t("error")}: ${res.error}`, "error");
				return null;
			}
			if (res.value.kind !== "text") {
				say(t("binary"), "error");
				return null;
			}
			const text = res.value.content;
			const lines = text.split("\n");
			if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
			const entry = { path, lines, states: buildLineStates(lines), truncated: res.value.truncated, raw: text };
			const seq = ++openSeqRef.current;
			peekNonce.current++;
			setPeek(null);
			setEditing(false);
			setDiffMarks(null);
			setDelGroups(null);
			setDelPreview(null);
			setPreviewOn(PREVIEW_RE.test(path));
			setDoc(entry);
			modeRef.current = "code";
			setDiff(null);
			const clampLine = Math.min(Math.max(1, line), Math.max(1, lines.length));
			setCursor({ line: clampLine, col, word: wordAt(lines[clampLine - 1] ?? "", col)?.word ?? "" });
			setDiagnostics([]);
			setOverlay(null);
			setHover(null);
			setSymbols([]);
			setScroll((0));
			if (codeRef.current) codeRef.current.scrollTop = 0;
			if (path.endsWith(".go")) {
				fetchDiagnostics(path, seq);
				api("lsp.request", { cwd, path, kind: "hover", line: 1, col: 1 })
					.then((warm) => {
						if (warm.ok && warm.value.status) setStatus((s) => ({ ...s, ...warm.value.status }));
					})
					.catch(() => {});
				const snonce = ++symbolNonce.current;
				api("lsp.request", { cwd, path, kind: "symbol" }).then((r) => {
					if (openSeqRef.current === seq && symbolNonce.current === snonce && r.ok) setSymbols(r.value.symbols ?? []);
				});
			} else {
				symbolNonce.current++;
			}
			// reveal after layout; mark drives the exact-token highlight
			const markLine = mark?.line ?? clampLine;
			requestAnimationFrame(() => {
				const area = codeRef.current;
				if (!area) return;
				const target = (Math.max(1, markLine) - 1) * ROW - area.clientHeight / 2;
				area.scrollTop = Math.max(0, target);
				setScroll(area.scrollTop);
				setFlash({ line: markLine, col: mark?.col, word: mark?.word });
				setTimeout(() => setFlash((f) => (f && f.line === markLine ? null : f)), 1800);
			});
			return entry;
		},
		[cwd, fetchDiagnostics, say, t],
	);

	const openFile = useCallback(
		async (path, line, col, record = true, mark) => {
			const current = docRef.current;
			if (record && current && modeRef.current === "code") {
				const cur = cursorRef.current;
				histRef.current.back.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
				if (histRef.current.back.length > 80) histRef.current.back.shift();
				histRef.current.forward = [];
				setHistTick((v) => v + 1);
			}
			await loadFile(path, line, col, mark);
		},
		[loadFile],
	);

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

	// A repo selection re-fetches that repo's full status.
	useEffect(() => {
		repoSelRef.current = repoSel;
		if (repoSel) refreshGit();
	}, [repoSel, refreshGit]);

	// Opening a file inside a discovered repo switches the Changes view to it.
	useEffect(() => {
		if (!doc || !repos || repos.length === 0 || !cwd) return;
		const abs = toAbs(cwd, doc.path);
		const match = repos.find((r) => abs === r.root || abs.startsWith(`${r.root}/`));
		if (match && match.root !== repoSelRef.current) {
			repoSelRef.current = match.root;
			setRepoSel(match.root);
		}
	}, [doc, repos, cwd]);

	const goBack = useCallback(() => {
		const stack = histRef.current;
		if (!stack.back.length) return;
		const current = docRef.current;
		if (current && modeRef.current === "code") {
			const cur = cursorRef.current;
			stack.forward.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
		}
		const prev = stack.back.pop();
		setHistTick((v) => v + 1);
		void openFile(prev.path, prev.line, prev.col, false, prev.word ? { line: prev.line, col: prev.col, word: prev.word } : null);
	}, [openFile]);

	const goForward = useCallback(() => {
		const stack = histRef.current;
		if (!stack.forward.length) return;
		const current = docRef.current;
		if (current && modeRef.current === "code") {
			const cur = cursorRef.current;
			stack.back.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
		}
		const next = stack.forward.pop();
		setHistTick((v) => v + 1);
		void openFile(next.path, next.line, next.col, false, next.word ? { line: next.line, col: next.col, word: next.word } : null);
	}, [openFile]);

	/* P0-1: per-session navigation state survives tab churn */
	useEffect(() => {
		if (!persistKey || !cwd || restoredFor.current === persistKey) return;
		restoredFor.current = persistKey;
		let blob = null;
		try {
			blob = JSON.parse(localStorage.getItem(persistKey) || "null");
		} catch {}
		if (!blob) return;
		if (Number.isFinite(blob.railW)) setRailW(Math.max(150, Math.min(760, blob.railW)));
		if (typeof blob.railVisible === "boolean") setRailVisible(blob.railVisible);
		if (typeof blob.mode === "string") setMode(blob.mode === "skills" ? "files" : blob.mode);
		if (blob.path && !docRef.current) {
			histRef.current = { back: Array.isArray(blob.back) ? blob.back : [], forward: Array.isArray(blob.forward) ? blob.forward : [] };
			setHistTick((v) => v + 1);
			void loadFile(blob.path, blob.line ?? 1, blob.col ?? 1, null).then(() => {
				if (Number.isFinite(blob.scroll) && codeRef.current) {
					codeRef.current.scrollTop = blob.scroll;
					setScroll(blob.scroll);
				}
			});
		}
	}, [persistKey, cwd, loadFile]);

	useEffect(() => {
		if (!persistKey) return;
		const payload = {
			path: doc?.path,
			line: cursor?.line,
			col: cursor?.col,
			scroll,
			mode,
			railW,
			railVisible,
			back: histRef.current.back.slice(-40),
			forward: histRef.current.forward.slice(-40),
		};
		latestPersistRef.current = { key: persistKey, payload };
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			try {
				localStorage.setItem(persistKey, JSON.stringify(payload));
			} catch {}
		}, 700);
	}, [persistKey, doc, cursor, scroll, mode, railW, railVisible, histTick]);

	useEffect(() => () => {
		if (saveTimer.current) clearTimeout(saveTimer.current);
		const last = latestPersistRef.current;
		if (last) {
			try {
				localStorage.setItem(last.key, JSON.stringify(last.payload));
			} catch {}
		}
	}, []);

	const revealPosition = useCallback((line, col, word) => {
		const current = docRef.current;
		if (!current) return;
		const cur = cursorRef.current;
		histRef.current.back.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
		if (histRef.current.back.length > 80) histRef.current.back.shift();
		histRef.current.forward = [];
		setHistTick((v) => v + 1);
		setCursor({ line, col, word: word ?? wordAt(current.lines[line - 1] ?? "", col)?.word ?? "" });
		setFlash({ line, col, word });
		setTimeout(() => setFlash((f) => (f && f.line === line ? null : f)), 1800);
		const area = codeRef.current;
		if (area) {
			area.scrollTop = Math.max(0, (line - 1) * ROW - area.clientHeight / 2);
			setScroll(area.scrollTop);
			area.focus({ preventScroll: true });
		}
	}, []);

	const openDiff = useCallback(
		async (path, scope) => {
			if (!cwd) return;
			const repo = repoSelRef.current;
			const res = await api("git.diff", repo ? { cwd, path, scope, repo } : { cwd, path, scope });
			const value = res.ok ? res.value : { error: res.error };
			modeRef.current = "diff";
			setShowDiffView(true);
			setDiff({ path, scope, text: value.diff ?? "", error: value.error, base: value.base, untracked: value.untracked, note: value.note });
			setOverlay(null);
			setHover(null);
		},
		[cwd],
	);
	// Whole-file presentation: load the current file and mark the changed
	// new-side lines, keeping gopls jumps and edit mode available on top.
	const openChangeSource = useCallback(async (path, scope) => {
		if (!cwd) return;
		const repo = repoSelRef.current;
		const res = await api("git.diff", repo ? { cwd, path, scope, repo } : { cwd, path, scope });
		const text = res.ok ? res.value.diff ?? "" : "";
		const marks = changedNewLines(text);
		let first = Number.POSITIVE_INFINITY;
		for (const n of marks) if (n < first) first = n;
		if (first === Number.POSITIVE_INFINITY) first = 1;
		setDiff({ path, scope, text, base: res.ok ? res.value.base : void 0 });
		setShowDiffView(false);
		modeRef.current = "code";
		await loadFile(path, first, 1);
		setDiffMarks(marks);
		setDelGroups(deletedGroups(text));
	}, [cwd, loadFile]);
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
	// Blame column data: refetched per open file while the toggle is on.
	useEffect(() => {
		if (!blameOn || !doc || !cwd) return void 0;
		let alive = true;
		const repo = repoSelRef.current;
		api("git.blame", repo ? { cwd, path: doc.path, repo } : { cwd, path: doc.path }).then((res) => {
			if (!alive) return;
			if (!res.ok || res.value?.error) {
				setBlame(null);
				return;
			}
			const byLine = new Map();
			for (const item of res.value.lines ?? []) byLine.set(item.line, item);
			setBlame(byLine);
		});
		return () => {
			alive = false;
		};
	}, [blameOn, doc, cwd]);

	const openCommit = useCallback(
		async (commit) => {
			if (!cwd) return;
			const repo = repoSelRef.current;
			const res = await api("git.diff", repo ? { cwd, scope: "commit", sha: commit.hash, repo } : { cwd, scope: "commit", sha: commit.hash });
			const value = res.ok ? res.value : { error: res.error };
			if (value.error) {
				say(`${t("error")}: ${value.error}`, "error");
				return;
			}
			modeRef.current = "diff";
			setDiff({ path: `${t("diff.scopeCommit")} ${commit.hash}`, scope: "commit", commit: value.commit, text: value.diff ?? "" });
			setShowDiffView(true);
			setOverlay(null);
			setHover(null);
			setPeek(null);
		},
		[cwd, say, t],
	);

	/* quick open (file picker) */

	const openPalette = useCallback(() => {
		if (!cwd) return;
		setPalette({ query: "", results: [], busy: true });
		api("search.files", { cwd, query: "", limit: 80 }).then((res) => {
			setPalette((p) => (p && p.query === "" ? { ...p, results: res.ok ? res.value.matches ?? [] : [], busy: false } : p));
		});
	}, [cwd]);

	const onPaletteQuery = useCallback(
		(query) => {
			setPalette((p) => (p ? { ...p, query, busy: true } : p));
			if (paletteTimer.current) clearTimeout(paletteTimer.current);
			paletteTimer.current = setTimeout(() => {
				if (!cwd) return;
				api("search.files", { cwd, query, limit: 80 }).then((res) => {
					setPalette((p) => (p && p.query === query ? { ...p, results: res.ok ? res.value.matches ?? [] : [], busy: false } : p));
				});
			}, 140);
		},
		[cwd],
	);

	const closePalette = useCallback(() => {
		if (paletteTimer.current) clearTimeout(paletteTimer.current);
		setPalette(null);
	}, []);

	const onPalettePick = useCallback(
		(path) => {
			closePalette();
			void openFile(path, 1, 1);
		},
		[closePalette, openFile],
	);

	/* full-text search */

	const runSearchNow = useCallback(
		(query, include) => {
			if (!cwd) return;
			const nonce = ++searchNonce.current;
			setSearch((s) => (s ? { ...s, busy: true, error: undefined } : s));
			api("search.text", { cwd, query, include: include || "" }).then((res) => {
				if (searchNonce.current !== nonce) return;
				setSearch((s) => {
					if (!s) return s;
					if (!res.ok) return { ...s, results: [], busy: false, error: res.error };
					return { ...s, results: res.value.results ?? [], engine: res.value.engine ?? "", truncated: res.value.truncated === true, timedOut: res.value.timedOut === true, busy: false };
				});
			});
		},
		[cwd],
	);

	const openSearch = useCallback(() => {
		setSearchOpen(true);
		setSearch((s) => s ?? { query: "", include: "", results: undefined, engine: "", truncated: false, busy: false });
	}, []);

	// Debounced auto-search, VSCode-style, while the panel is open.
	useEffect(() => {
		if (!searchOpen || !search) return undefined;
		const query = (search.query ?? "").trim();
		if (query.length < 2) {
			if (search.results !== undefined && !search.busy) return undefined;
			setSearch((s) => (s ? { ...s, results: [], engine: "", busy: false, error: undefined } : s));
			return undefined;
		}
		const timer = setTimeout(() => runSearchNow(search.query, search.include), 400);
		return () => clearTimeout(timer);
	}, [searchOpen, search, runSearchNow]);

	const onSearchPick = useCallback(
		(r) => {
			void openFile(r.path, r.line, 1);
			setSearchOpen(false);
		},
		[openFile],
	);

	/* references peek (VSCode-style pop-up) */

	const openPeek = useCallback(
		async (symbol, line, col) => {
			if (!cwd || !docRef.current?.path.endsWith(".go")) return;
			const path = docRef.current.path;
			const nonce = ++peekNonce.current;
			setPeek({ symbol, anchorLine: line, busy: true, def: [], refs: [] });
			const [dres, rres] = await Promise.all([
				api("lsp.request", { cwd, path, kind: "definition", line, col }),
				api("lsp.request", { cwd, path, kind: "references", line, col }),
			]);
			if (peekNonce.current !== nonce) return;
			if (dres.ok && dres.value.status) setStatus(dres.value.status);
			if (!dres.ok && !rres.ok) {
				setPeek({ symbol, anchorLine: line, busy: false, def: [], refs: [], error: dres.error ?? rres.error });
				return;
			}
			setPeek({
				symbol,
				anchorLine: line,
				busy: false,
				def: dres.ok ? dres.value.targets ?? [] : [],
				refs: rres.ok ? rres.value.targets ?? [] : [],
				error: !dres.ok ? dres.error : !rres.ok ? rres.error : undefined,
			});
		},
		[cwd],
	);

	const closePeek = useCallback(() => {
		peekNonce.current++;
		setPeek(null);
	}, []);

	const pickPeek = useCallback(
		(loc) => {
			const word = peekRef.current?.symbol;
			closePeek();
			void openFile(loc.path, loc.line, loc.col, true, word ? { line: loc.line, col: loc.col, word } : null);
		},
		[closePeek, openFile],
	);

	const findMatches = useMemo(() => {
		if (!doc || !findQuery) return [];
		const out = [];
		for (let i = 0; i < doc.lines.length && out.length < 2000; i++) {
			let at = doc.lines[i].indexOf(findQuery);
			while (at !== -1 && out.length < 2000) {
				out.push({ line: i + 1, col: at + 1 });
				at = doc.lines[i].indexOf(findQuery, at + findQuery.length);
			}
		}
		return out;
	}, [doc, findQuery]);
	const findLines = useMemo(() => new Set(findMatches.map((m) => m.line)), [findMatches]);
	const jumpFind = useCallback((delta) => {
		if (findMatches.length === 0) return;
		const next = (findIdx + delta + findMatches.length) % findMatches.length;
		setFindIdx(next);
		const m = findMatches[next];
		setCursor((c) => ({ line: m.line, col: m.col, word: c?.word ?? "" }));
		const area = codeRef.current;
		if (area) {
			area.scrollTop = Math.max(0, (m.line - 1) * ROW - area.clientHeight / 2);
			setScroll(area.scrollTop);
		}
		setFlash({ line: m.line, col: m.col, word: findQuery });
		setTimeout(() => setFlash((f) => (f && f.line === m.line ? null : f)), 1200);
	}, [findMatches, findIdx, findQuery]);
	const startEdit = useCallback(() => {
		if (!doc || doc.truncated) return;
		if (doc.raw.length > 2 * 1024 * 1024 || doc.lines.length > 50000) {
			say(t("editor.tooBig"), "error");
			return;
		}
		setEditText(doc.raw);
		setEditing(true);
	}, [doc, say, t]);
	const saveEdit = useCallback(() => {
		if (!doc || !editing) return;
		api("fs.write", { cwd, path: doc.path, content: editText }).then((res) => {
			if (!res.ok) {
				say(`${t("error")}: ${res.error}`, "error");
				return;
			}
			const lines = editText.split("\n");
			if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
			setDoc({ ...doc, lines, states: buildLineStates(lines), raw: editText });
			setEditing(false);
			say(t("editor.saved"));
		});
	}, [doc, editing, editText, cwd, say, t]);
	const cancelEdit = useCallback(() => setEditing(false), []);
	// Switch an open working/branch diff to the whole-file source view with
	// changed lines marked; the hunk view stays one toggle away.
	const openDiffSource = useCallback((line) => {
		if (!diff || typeof diff.path !== "string" || diff.path === "") return;
		if (diff.scope === "commit" || diff.scope === "call") return;
		const marks = changedNewLines(diff.text);
		let first = line;
		if (first == null) {
			first = Number.POSITIVE_INFINITY;
			for (const n of marks) if (n < first) first = n;
			if (first === Number.POSITIVE_INFINITY) first = 1;
		}
		modeRef.current = "code";
		setShowDiffView(false);
		const path = diff.path;
		const needLoad = !docRef.current || docRef.current.path !== path;
		const ready = needLoad ? loadFile(path, first, 1) : Promise.resolve();
		void ready.then(() => {
			setDiffMarks(marks);
			setDelGroups(deletedGroups(diff.text));
			if (!needLoad) revealPosition(first, 1, void 0);
		});
	}, [diff, loadFile, revealPosition]);
	const onRootKeyDown = useCallback(
		(event) => {
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyF" && !event.shiftKey) {
				if (modeRef.current === "code" && docRef.current && !editing) {
					event.preventDefault();
					setFindOpen((v) => !v);
				}
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.code === "KeyS" && !event.shiftKey) {
				if (editing) {
					event.preventDefault();
					saveEdit();
				}
				return;
			}
			// Navigation: ⌘[ back, ⌘] forward (⌃- browser-zoom clash intentionally dropped).
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "BracketLeft") {
				event.preventDefault();
				goBack();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "BracketRight") {
				event.preventDefault();
				goForward();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyB" && !event.shiftKey) {
				event.preventDefault();
				setRailVisible((v) => !v);
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyO") {
				if (docRef.current?.path.endsWith(".go")) {
					event.preventDefault();
					setSymPalette({});
				}
				return;
			}
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyP") {
				event.preventDefault();
				if (palette) closePalette();
				else openPalette();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyF") {
				event.preventDefault();
				openSearch();
				return;
			}
			if (event.key === "Escape") {
				if (editing) {
					cancelEdit();
					return;
				}
				if (findOpen) {
					setFindOpen(false);
					return;
				}
				if (delPreview) {
					setDelPreview(null);
					return;
				}
				if (symPalette) {
					setSymPalette(null);
					return;
				}
				if (peek) {
					closePeek();
					return;
				}
				if (searchOpen) setSearchOpen(false);
			}
		},
		[palette, closePalette, openPalette, openSearch, searchOpen, peek, closePeek, goBack, goForward, symPalette, editing, saveEdit, cancelEdit, findOpen, delPreview],
	);

	const doJump = useCallback(
		async (kind, pos) => {
			if (!cwd || !docRef.current || !docRef.current.path.endsWith(".go")) return;
			const cur = pos ?? cursorRef.current;
			if (!cur) {
				say(t("jump.noCursor"));
				return;
			}
			say(t("status.starting"));
			const res = await api("lsp.request", { cwd, path: docRef.current.path, kind, line: cur.line, col: cur.col });
			setNotice({ text: "", kind: "info" });
			if (!res.ok) {
				say(res.error, "error");
				setStatus({ state: "error", message: res.error, progress: "" });
				return;
			}
			if (res.value.status) setStatus(res.value.status);
			if (kind === "hover") {
				setHover({ x: cur.col, y: cur.line, text: res.value.hover || "" });
				return;
			}
			const targets = res.value.targets ?? [];
			if (!targets.length) {
				say(res.value.note ?? t("jump.noTarget"), res.value.note ? "info" : "error");
				return;
			}
			if (targets.length === 1 && kind !== "references") {
				const item = targets[0];
				void openFile(item.path, item.line, item.col, true, { line: item.line, col: item.col, word: cur.word });
				return;
			}
			const title = kind === "references" ? t("jump.refsTitle") : kind === "implementation" ? t("jump.implTitle") : kind === "typeDefinition" ? t("jump.typeTitle") : t("jump.peekTitle");
			setOverlay({ title, items: targets });
		},
		[cwd, openFile, say, t],
	);

	const onKeyDown = useCallback(
		(event) => {
			const mod = event.metaKey || event.ctrlKey;
			if (event.key === "F12") {
				event.preventDefault();
				if (event.shiftKey) {
					const cur = cursorRef.current;
					if (cur) void openPeek(cur.word || "", cur.line, cur.col);
					else say(t("jump.noCursor"));
				} else {
					void doJump("definition");
				}
				return;
			}
			if (event.altKey && event.key === "ArrowLeft") {
				event.preventDefault();
				goBack();
				return;
			}
			if (event.altKey && event.key === "ArrowRight") {
				event.preventDefault();
				goForward();
				return;
			}
			if (event.key === "Escape") {
				if (overlay) setOverlay(null);
				else if (hover) setHover(null);
				return;
			}
			if ((event.key === "i" || event.key === "I") && mod && event.altKey) {
				event.preventDefault();
				void doJump("implementation");
				return;
			}
		},
		[doJump, openPeek, say, t, goBack, goForward, hover, overlay],
	);

	const onEditorClick = useCallback(
		(event) => {
			const target = event.target?.closest?.("[data-ce-l]");
			setHover(null);
			if (!target || !docRef.current) return;
			const line = Number(target.dataset.ceL);
			const col = Number(target.dataset.ceC);
			const text = docRef.current.lines[line - 1] ?? "";
			const hit = wordAt(text, col);
			const word = hit?.word ?? target.dataset.ceW ?? "";
			const at = { line, col: hit?.col ?? col };
			setCursor({ line: at.line, col: at.col, word });
			if (codeRef.current) codeRef.current.focus({ preventScroll: true });
			if (!docRef.current.path.endsWith(".go") || !word) {
				// VSCode-style: clicking blank space dismisses the reference overlay.
				setPeek(null);
				return;
			}
			if (target.classList?.contains("ce-kw")) {
				setPeek(null);
				return;
			}
			const mod = event.metaKey || event.ctrlKey;
			if (mod) void doJump("definition", at);
			else void openPeek(word, at.line, at.col);
		},
		[doJump, openPeek],
	);

	// session / cwd lifecycle
	useEffect(() => {
		if (!cwd) {
			setGit(null);
			return;
		}
		refreshGit();
		api("lsp.status", { cwd }).then((res) => {
			if (res.ok) setStatus(res.value);
		});
	}, [cwd, refreshGit]);

	useEffect(() => {
		if (!tab?.actions?.bindCommands) return;
		return tab.actions.bindCommands({
			refresh: () => {
				refreshGit();
				setTreeKey((k) => k + 1);
				if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
			},
		});
	}, [tab, refreshGit, loadFile]);

	useEffect(() => () => {
		if (noticeTimer.current) clearTimeout(noticeTimer.current);
	}, []);

	// autosize viewport
	useEffect(() => {
		const area = codeRef.current;
		if (!area) return;
		const observer = new ResizeObserver(() => setViewport(area.clientHeight || 600));
		observer.observe(area);
		setViewport(area.clientHeight || 600);
		return () => observer.disconnect();
	}, [doc, diff]);

	const diagByLine = useMemo(() => {
		const map = new Map();
		for (const item of diagnostics) {
			const row = map.get(item.line) ?? [];
			row.push(item);
			map.set(item.line, row);
		}
		return map;
	}, [diagnostics]);

	const delAnchors = useMemo(() => (delGroups === null ? [] : [...delGroups.keys()].sort((a, b) => a - b)), [delGroups]);
	const changeRailBlobs = useMemo(() => (doc ? changeBlobs(diffMarks, delGroups ? [...delGroups.keys()] : null) : []), [doc, diffMarks, delGroups]);
	const jumpToLine = useCallback((line) => {
		const area = codeRef.current;
		setCursor((c) => ({ line, col: 1, word: c?.word ?? "" }));
		if (area) {
			area.scrollTop = Math.max(0, (line - 1) * ROW - area.clientHeight / 2);
			setScroll(area.scrollTop);
		}
		setFlash({ line, col: 1, word: "" });
		setTimeout(() => setFlash((f) => (f && f.line === line ? null : f)), 1200);
	}, []);
	const visible = useMemo(() => {
		if (!doc) return null;
		const extraAt = (line) => {
			let n = 0;
			for (const a of delAnchors) {
				if (a <= line) n++;
				else break;
			}
			return n * ROW;
		};
		const yOf = (i) => i * ROW + extraAt(i + 1);
		let lo = 0;
		let hi = doc.lines.length;
		const topTarget = scroll - 8 * ROW;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (yOf(mid) < topTarget) lo = mid + 1;
			else hi = mid;
		}
		const start = Math.max(0, lo - 2);
		const lang = langFor(doc.path);
		const rows = [];
		const blameRows = [];
		for (let i = start; i < doc.lines.length && yOf(i) <= scroll + viewport + 8 * ROW; i++) {
			const runs = tokenizeLine(doc.lines[i], lang, doc.states[i]);
			const isGo = lang === "go";
			const lineFlash = flash && flash.line === i + 1 ? flash : null;
			const lineChanged = diffMarks !== null && diffMarks.has(i + 1);
			const cells = runs.map((run, r) => {
				// word-level highlight when the flash names a token at this column
				const marked = lineFlash && lineFlash.col != null && run.startCol === lineFlash.col && lineFlash.word && run.s === lineFlash.word;
				return run.cls === "ce-id" || run.cls === "ce-type" || run.cls === "ce-kw"
					? h(
						"span",
						{
							key: r,
							className: `ce-t ${run.cls}${isGo ? " ce-jump" : ""}${marked ? " ce-mark" : ""}`,
							...(isGo ? { "data-ce-l": i + 1, "data-ce-c": run.startCol ?? 1, "data-ce-w": run.word ?? "" } : {}),
						},
						run.s,
					)
					: h("span", { key: r, className: `ce-t ${run.cls}${marked ? " ce-mark" : ""}` }, run.s);
			});
			const lineDiags = diagByLine.get(i + 1);
			const underlines = (lineDiags ?? []).map((item, d) => {
				const endCol = item.endLine === item.line ? Math.min(item.endCol, item.startCol + 200) : item.startCol + 200;
				return h("span", {
					key: `u${d}`,
					className: `ce-underline${item.severity === 2 ? " ce-underline-warn" : ""}`,
					title: `${item.source ? `${item.source}: ` : ""}${item.message}`,
					style: { left: `${(item.startCol - 1) * 7.8}px`, width: `${Math.min(1600, Math.max(6, (endCol - item.startCol) * 7.8))}px` },
				});
			});
			rows.push(
				h(
					"div",
					{ key: i, className: `ce-line${lineFlash ? " ce-flash" : ""}${lineChanged ? " ce-line-changed" : ""}`, style: { transform: `translateY(${yOf(i)}px)` } },
					cells.length ? cells : h("span", { className: "ce-t" }, " "),
					...underlines,
				),
			);
			if (blameOn && blame !== null) {
				const info = blame.get(i + 1);
				const prevInfo = blame.get(i);
				const uncommitted = info !== void 0 && /^0{40}$/.test(info.sha);
				const first = info !== void 0 && (prevInfo === void 0 || prevInfo.sha !== info.sha);
				blameRows.push(h("button", {
					key: i,
					type: "button",
					className: `ce-bline${uncommitted ? " ce-bline-uncommitted" : ""}`,
					style: { transform: `translateY(${yOf(i)}px)` },
					title: info ? `${info.author ?? ""} ${info.mail ?? ""} · ${info.summary ?? ""} · ${info.sha.slice(0, 8)}` : "",
					...(info !== void 0 && !uncommitted ? { onClick: () => void openCommit({ hash: info.sha }) } : {}),
				}, uncommitted ? t("blame.uncommitted") : first ? `${info.author} · ${relTime(info.time)}` : ""));
			}
		}
		delAnchors.forEach((a, idx) => {
			const y = (a - 1) * ROW + idx * ROW;
			if (y + ROW < scroll - 60 || y > scroll + viewport + 60) return;
			const deleted = delGroups.get(a) ?? [];
			rows.push(h("button", {
				key: `del:${a}`,
				type: "button",
				className: "ce-delbar",
				style: { transform: `translateY(${y}px)` },
				title: t("diff.deletedAt"),
				onClick: () => setDelPreview({ anchor: a, lines: deleted }),
			}, `− ${deleted.length} ${t("diff.deletedLines")}`));
		});
		return { rows, blameRows, start, end: doc.lines.length, total: (doc.lines.length + 2) * ROW + delAnchors.length * ROW };
	}, [doc, scroll, viewport, diagByLine, flash, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit]);

	const gutter = useMemo(() => {
		if (!doc) return null;
		const extraAt = (line) => {
			let n = 0;
			for (const a of delAnchors) {
				if (a <= line) n++;
				else break;
			}
			return n * ROW;
		};
		const yOf = (i) => i * ROW + extraAt(i + 1);
		let lo = 0;
		let hi = doc.lines.length;
		const topTarget = scroll - 8 * ROW;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (yOf(mid) < topTarget) lo = mid + 1;
			else hi = mid;
		}
		const start = Math.max(0, lo - 2);
		const rows = [];
		for (let i = start; i < doc.lines.length && yOf(i) <= scroll + viewport + 8 * ROW; i++) {
			rows.push(
				h(
					"div",
					{ key: i, className: `ce-gline${cursor?.line === i + 1 ? " ce-gline-active" : ""}${findLines.has(i + 1) ? " ce-gline-find" : ""}${diffMarks !== null && diffMarks.has(i + 1) ? " ce-gline-changed" : ""}`, style: { transform: `translateY(${yOf(i)}px)` } },
					String(i + 1),
				),
			);
		}
		return rows;
	}, [doc, scroll, viewport, cursor, findLines, diffMarks, delAnchors]);

	const statusTitle = (status.state === "error" ? `${t("status.error")}: ${status.message}` : status.state === "starting" ? t("status.starting") : status.state === "ready" ? t("status.ready") : t("status.off")) + (status.progress ? ` · ${status.progress}` : "");
	const previewActive = previewOn && doc !== null && PREVIEW_RE.test(doc.path);
	const canBack = histRef.current.back.length > 0;
	const canForward = histRef.current.forward.length > 0;
	void histTick;

	// breadcrumb symbol: the innermost declared symbol at or above the cursor line
	const currentSymbol = useMemo(() => {
		if (!cursor || symbols.length === 0) return null;
		let best = null;
		for (const s of symbols) {
			if (s.line <= cursor.line && (best === null || s.line > best.line || (s.line === best.line && s.col <= best.col))) best = s;
		}
		return best;
	}, [symbols, cursor]);

	const startRailDrag = useCallback((event) => {
		event.preventDefault();
		const startX = event.clientX;
		const startW = railW;
		const move = (e) => setRailW(Math.max(150, Math.min(760, startW + (e.clientX - startX))));
		const up = () => {
			window.removeEventListener("mousemove", move);
			window.removeEventListener("mouseup", up);
		};
		window.addEventListener("mousemove", move);
		window.addEventListener("mouseup", up);
	}, [railW]);

	// P0-3: the global quick-open command raises the picker in the visible panel
	useEffect(() => {
		const handler = () => {
			if (!tab || tab.visible) openPalette();
		};
		document.addEventListener("dsh-ce-quick-open", handler);
		return () => document.removeEventListener("dsh-ce-quick-open", handler);
	}, [openPalette, tab]);

	// Chat call rows (edit/write) raise their synthesized diff here: show it in
	// the panel's diff view without touching git.
	useEffect(() => {
		const handler = (event) => {
			const detail = event.detail;
			if (!detail || typeof detail.text !== "string") return;
			setPeek(null);
			setOverlay(null);
			setHover(null);
			modeRef.current = "diff";
			setShowDiffView(true);
			setDiff({
				path: detail.path ?? "",
				scope: "call",
				text: detail.text,
				gutter: detail.gutter === false ? false : void 0,
				stats: detail.stats ?? void 0,
			});
		};
		document.addEventListener("dsh-ce-open-calldiff", handler);
		return () => document.removeEventListener("dsh-ce-open-calldiff", handler);
	}, []);

	if (!cwd) {
		return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
	}

	return h(
		"div",
		{ className: "ce-root", onKeyDown: onRootKeyDown },
		h(
			"div",
			{ className: "ce-toolbar" },
			h(
				"div",
				{ className: "ce-seg" },
				h("button", { type: "button", className: `ce-seg-btn${mode === "files" ? " ce-seg-on" : ""}`, onClick: () => setMode("files") }, t("toolbar.files")),
				h("button", { type: "button", className: `ce-seg-btn${mode === "changes" ? " ce-seg-on" : ""}`, onClick: () => { setMode("changes"); refreshGit(); } }, `${t("toolbar.changes")}${git?.repo ? ` · ${git.working.length}` : ""}`),
			),
			git?.repo
				? h(
					"button",
					{
						type: "button",
						className: "ce-branch",
						disabled: sync.busy,
						title: `${t("branch.title")}${git.upstream ? ` · ${git.upstream}${git.upstreamInferred ? " · auto" : ""}` : ""}`,
						onClick: () => setBranchPickOpen(true),
					},
					h("span", null, `⎇ ${git.branch}`),
					sync.busy ? h("span", { className: "ce-spin ce-ico" }, h(IconRefresh)) : null,
					!sync.busy && git.ahead > 0 ? h("span", { className: "ce-ab ce-ab-ahead" }, `↑${git.ahead}`) : null,
					!sync.busy && git.behind > 0 ? h("span", { className: "ce-ab ce-ab-behind" }, `↓${git.behind}`) : null,
				)
				: null,
			h("span", { className: "ce-spacer" }),
			h("button", { type: "button", className: "ce-tool", title: `${t("quickopen.placeholder")} (⌘P / Ctrl+P)`, onClick: openPalette }, h(IconSearch)),
			h("button", { type: "button", className: "ce-tool", title: `${t("toolbar.search")} (⇧⌘F / Ctrl+Shift+F)`, onClick: openSearch }, h(IconTextSearch)),
			h("button", { type: "button", className: "ce-tool", title: `${statusTitle}`, onClick: () => { refreshGit(); setTreeKey((k) => k + 1); if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1); } }, h(IconRefresh)),
			h("span", { className: `ce-dot ce-dot-${status.state}`, title: statusTitle }),
		),
		notice.kind === "error" && notice.text
			? h(
				"div",
				{ className: "ce-banner" },
				h("span", { className: "ce-banner-text" }, notice.text),
				h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => say("") }, "✕"),
			)
			: null,
		h(
			"div",
			{ className: "ce-main", ref: mainRef },
			railVisible
				? h("div", { className: "ce-rail-wrap", style: { width: `${railW}px` } }, mode === "files"
					? h(TreePanel, {
						cwd,
						t,
						onOpenFile: (path, line, col) => void openFile(path, line, col),
						activePath: doc?.path ?? diff?.path,
						refreshKey: treeKey,
						onNotify: (text, kind) => say(text, kind),
						onDeleted: (path) => {
							const open = docRef.current?.path;
							if (open && (open === path || open.startsWith(`${path}/`))) {
								setDoc(null);
								setEditing(false);
								setDiffMarks(null);
							}
						},
					})
					: h(ChangesPanel, {
						cwd,
						t,
						git,
						repos,
						repoSel,
						onSelectRepo: (root) => {
							repoSelRef.current = root;
							setRepoSel(root);
							if (!root) refreshGit();
						},
						commitsOpen,
						setCommitsOpen,
						onOpenCommit: (commit) => void openCommit(commit),
						onOpenDiff: (path, scope) => void (scope === "commit" ? openDiff(path, scope) : openChangeSource(path, scope)),
						onDiscard: (item) => void discardChange(item),
						onDiscardDir: (dirItems) => void discardMany(dirItems),
						refresh: refreshGit,
					}))
				: null,
			railVisible
				? h("div", { className: "ce-splitter", onMouseDown: startRailDrag, onDoubleClick: () => setRailVisible(false), title: "⇔ 拖动调宽 · 双击收起" })
				: h("button", { type: "button", className: "ce-rail-tab", title: "展开侧栏 (⌘B / Ctrl+B)", onClick: () => setRailVisible(true) }, "▸"),
			h(
				"div",
				{ className: "ce-editor" },
				diff && showDiffView
					? h(DiffView, {
						t,
						diff,
						onClose: () => { setDiff(null); if (docRef.current) modeRef.current = "code"; },
						onOpenSource: (line) => openDiffSource(line),
						canSource: diff.scope === "working" || diff.scope === "branch",
					})
					: doc
					? h(
						Fragment,
						null,
						h(
							"div",
							{ className: "ce-head" },
							h("button", { type: "button", className: "ce-tool ce-tiny", title: t("back"), disabled: !canBack, onClick: goBack }, h(IconArrowLeft)),
							h("button", { type: "button", className: "ce-tool ce-tiny", title: t("forward"), disabled: !canForward, onClick: goForward }, h(IconArrowRight)),
							h("span", { className: "ce-head-path" }, RelPath(cwd, doc.path) || doc.path),
							currentSymbol
								? h(
									"button",
									{ type: "button", className: "ce-crumb", title: `${t("symbols.crumb")} (⌘⇧O)`, onClick: () => doc.path.endsWith(".go") && setSymPalette({}) },
									`› ${currentSymbol.name}`,
								)
								: null,
							doc.path.endsWith(".go") ? h("span", { className: "ce-chip" }, t("editor.lang.go")) : null,
							diffMarks
								? h("button", { type: "button", className: "ce-chip ce-chip-mark", title: t("diff.marksClear"), onClick: () => setDiffMarks(null) }, `${t("diff.marksChip")} ${diffMarks.size}`)
								: null,
							diff && !showDiffView && (diff.scope === "working" || diff.scope === "branch")
								? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("diff.showHunks"), onClick: () => setShowDiffView(true) }, "≡")
								: null,
							doc.truncated ? h("span", { className: "ce-chip" }, t("truncated")) : null,
							doc && !diff && PREVIEW_RE.test(doc.path)
								? h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("editor.previewToggle"), onClick: () => setPreviewOn((v) => !v) }, previewOn ? t("editor.raw") : t("editor.preview"))
								: null,
							doc && !diff && !editing ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("editor.edit"), onClick: startEdit }, "✎") : null,
							editing ? h("button", { type: "button", className: "ce-link", onClick: saveEdit }, t("editor.save")) : null,
							editing ? h("button", { type: "button", className: "ce-link", onClick: cancelEdit }, t("editor.cancel")) : null,
							editing && editText !== (doc?.raw ?? "") ? h("span", { className: "ce-chip ce-chip-warn" }, t("editor.dirty")) : null,
							doc && !diff ? h("button", { type: "button", className: `ce-tool ce-tiny${findOpen ? " ce-tool-on" : ""}`, title: `${t("editor.find")} (⌘F / Ctrl+F)`, onClick: () => setFindOpen((v) => !v) }, "⌕") : null,
							doc && !diff ? h("button", { type: "button", className: `ce-tool ce-tiny${blameOn ? " ce-tool-on" : ""}`, title: t("blame.toggle"), onClick: () => { setBlameOn((v) => !v); setBlame(null); } }, "B") : null,
							h("span", { className: "ce-spacer" }),
							cursor ? h("span", { className: "ce-pos" }, `Ln ${cursor.line}, Col ${cursor.col}${cursor.word ? ` · ${cursor.word}` : ""}`) : null,
							diagnostics.length ? h("span", { className: "ce-diag" }, `${diagnostics.length} ${t("diag.count")}`) : null,
						),
						findOpen && !editing ? h("div", { className: "ce-find" },
							h("input", {
								className: "ce-input ce-find-input",
								placeholder: t("editor.findPlaceholder"),
								value: findQuery,
								autoFocus: true,
								onChange: (e) => { setFindQuery(e.target.value); setFindIdx(0); },
								onKeyDown: (e) => {
									e.stopPropagation();
									if (e.key === "Enter") { e.preventDefault(); jumpFind(e.shiftKey ? -1 : 1); }
									else if (e.key === "Escape") setFindOpen(false);
								},
							}),
							h("span", { className: "ce-find-count" }, findQuery ? `${findMatches.length === 0 ? 0 : Math.min(findIdx + 1, findMatches.length)}/${findMatches.length}` : ""),
							h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => jumpFind(-1) }, "↑"),
							h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => jumpFind(1) }, "↓"),
							h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setFindOpen(false) }, "✕"),
						) : null,
						h(
							"div",
							{ className: "ce-code-wrap" },
							editing
								? h("textarea", { className: "ce-edit-ta", value: editText, spellcheck: false, onChange: (e) => setEditText(e.target.value) })
								: previewActive
									? (MD_RE.test(doc.path)
										? h(MarkdownView, { text: doc.raw })
										: h("iframe", { className: "ce-htmlprev", sandbox: "", srcDoc: doc.raw, title: doc.path }))
									: h(
										Fragment,
										null,
										blameOn && blame !== null ? h("div", { className: "ce-blame" }, visible?.blameRows) : null,
										h("div", { className: "ce-gutter" }, h("div", { className: "ce-gutter-inner", style: { transform: `translateY(${-scroll}px)` } }, gutter)),
							h(
								"div",
								{
									className: "ce-code",
									tabIndex: 0,
									ref: codeRef,
									onKeyDown,
									onClick: onEditorClick,
									onScroll: (event) => setScroll(event.currentTarget.scrollTop),
									style: { outline: "none" },
								},
								h("div", { className: "ce-code-inner", style: { height: `${visible?.total ?? (doc.lines.length + 2) * ROW}px` } }, visible?.rows),
							),
								),
							!editing && !previewActive && changeRailBlobs.length > 0
								? h("div", { className: "ce-changerail" }, changeRailBlobs.map((b, i) => h("button", {
									key: i,
									type: "button",
									className: `ce-changeblob ce-changeblob-${b.kind}`,
									title: `L${b.start}${b.end > b.start ? `-${b.end}` : ""} · ${t("diff.marksChip")}`,
									style: {
										top: `${((b.start - 1) / Math.max(1, doc.lines.length)) * 100}%`,
										height: `${Math.max(0.6, ((b.end - b.start + 1) / Math.max(1, doc.lines.length)) * 100)}%`,
									},
									onClick: () => jumpToLine(b.start),
								}, null)))
								: null,
							peek ? h(RefsPeek, { t, cwd, peek, scroll, totalLines: doc.lines.length, onPick: pickPeek, onClose: closePeek }) : null,
							symPalette ? h(SymbolPalette, { t, symbols, onPick: (s) => { setSymPalette(null); revealPosition(s.line, s.col, s.name); }, onClose: () => setSymPalette(null) }) : null,
							delPreview
								? h("div", { className: "ce-overlay" },
									h("div", { className: "ce-overlay-head" },
										h("span", null, `${t("diff.deletedAt")} · L${delPreview.anchor}`),
										h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setDelPreview(null) }, "✕"),
									),
									h("div", { className: "ce-overlay-list" }, delPreview.lines.map((ln, j) =>
										h("div", { key: j, className: "ce-dline ce-dline-del" }, h("span", { className: "ce-dtext" }, `- ${ln}`)))),
								)
								: null,
						),
					)
						: h("div", { className: "ce-empty" }, t("editor.placeholder")),
				overlay ? h(LocationList, { t, overlay, cwd, onPick: (item) => { const word = cursorRef.current?.word; setOverlay(null); void openFile(item.path, item.line, item.col, true, word ? { line: item.line, col: item.col, word } : null); }, onClose: () => setOverlay(null) }) : null,
				palette ? h(QuickOpen, { t, state: palette, onQuery: onPaletteQuery, onPick: onPalettePick, onClose: closePalette }) : null,
				searchOpen && search ? h(SearchPanel, {
					t,
					cwd,
					state: search,
					onQuery: (q) => setSearch((s) => (s ? { ...s, query: q } : s)),
					onInclude: (v) => setSearch((s) => (s ? { ...s, include: v } : s)),
					onSubmit: () => runSearchNow(search.query, search.include),
					onPick: onSearchPick,
					onClose: () => setSearchOpen(false),
				}) : null,
			),
		),
		branchPickOpen && git?.repo
			? h(BranchPalette, {
				cwd,
				repo: repoSel,
				current: git.branch,
				t,
				onFetch: () => void doFetch(),
				onPull: () => void doPull(),
				onClose: () => setBranchPickOpen(false),
				onDone: (ok, err) => {
					setBranchPickOpen(false);
					if (!ok) {
						say(`${t("error")}: ${err}`, "error");
						return;
					}
					say(t("branch.checkedOut"));
					refreshGit();
					if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
				},
			})
			: null,
		h(
			"div",
			{ className: "ce-statusbar" },
			h("span", null, notice.kind === "info" ? notice.text || (doc && !diagnostics.length && doc.path.endsWith(".go") ? t("nodiag") : "") : ""),
			h("span", { className: "ce-spacer" }),
			h("span", { className: "ce-prog" }, status.progress || (status.state === "error" ? "gopls ✕" : status.state === "ready" ? "gopls ✓" : status.state === "starting" ? "gopls …" : "")),
		),
	);
}

export function CodeTitle({ useTabInfo }) {
	const tabInfo = useTabInfo ? useTabInfo() : null;
	return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(IconCode)), tabInfo?.tab?.title ?? "Code");
}
