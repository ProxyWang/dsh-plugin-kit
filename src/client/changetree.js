/* ---------------- collapsible path tree for change lists ----------------
 * VSCode-SCM-flavoured rows: rotating twistie + folder glyph on directories,
 * tinted file glyph + basename (+ dir hint on duplicate names) on files,
 * colored status letter right-aligned, indent guide lines, compact rows.
 */

import { Fragment, h, useMemo, useState } from "./react.js";

/**
 * Nest flat repo-relative paths into a directory tree. Single-child directory
 * chains compress into one node ("a/b/c"), like VSCode's compact folders.
 * Items carry {path, ch} where ch is the one-letter status badge.
 */
export function buildTree(items) {
	const root = { name: "", dirs: new Map(), files: [], count: 0 };
	for (const item of items) {
		const segments = String(item.path).split("/");
		let node = root;
		for (let i = 0; i < segments.length - 1; i++) {
			let next = node.dirs.get(segments[i]);
			if (next === void 0) {
				next = { name: segments[i], dirs: new Map(), files: [], count: 0 };
				node.dirs.set(segments[i], next);
			}
			node = next;
		}
		node.files.push(item);
	}
	const finalize = (node, isRoot = false) => {
		let count = node.files.length;
		for (const child of node.dirs.values()) count += finalize(child);
		while (!isRoot && node.dirs.size === 1 && node.files.length === 0) {
			const child = [...node.dirs.values()][0];
			node.name = `${node.name}/${child.name}`;
			node.dirs = child.dirs;
			node.files = child.files;
			count = child.count;
		}
		node.count = count;
		return count;
	};
	finalize(root, true);
	return root;
}

const byName = (a, b) => a.name.localeCompare(b.name);
const byPath = (a, b) => a.path.localeCompare(b.path);

/** Every file item in a directory subtree (for folder-level discard). */
export function filesUnder(node) {
	const out = [];
	const stack = [node];
	while (stack.length > 0) {
		const cur = stack.pop();
		out.push(...cur.files);
		for (const child of cur.dirs.values()) stack.push(child);
	}
	return out;
}

const EXT_TINT = {
	go: "cet-go",
	md: "cet-md",
	sql: "cet-sql",
	toml: "cet-toml",
	zip: "cet-zip",
	html: "cet-html",
	js: "cet-js",
	ts: "cet-js",
	json: "cet-json",
	yml: "cet-toml",
	yaml: "cet-toml",
};

function fileTint(path) {
	const dot = path.lastIndexOf(".");
	const ext = dot > 0 ? path.slice(dot + 1).toLowerCase() : "";
	return EXT_TINT[ext] ?? "cet-file";
}

const FolderGlyph = () => h("svg", { viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": true },
	h("path", { d: "M1.5 3h4l1.2 1.5h7.8v8.5h-13z", opacity: 0.9 }),
);
const FileGlyph = () => h("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.2, "aria-hidden": true },
	h("path", { d: "M4 1.8h5.2L12.5 5v9.2H4z" }),
	h("path", { d: "M9.2 1.8V5h3.3" }),
);

/** Indent guide lines as layered 1px backgrounds, one per ancestor level. */
function guideStyle(depth) {
	if (depth <= 0) return {};
	const images = [];
	const sizes = [];
	for (let i = 0; i < depth; i++) {
		images.push("linear-gradient(var(--dsw-alias-border-l1,#333), var(--dsw-alias-border-l1,#333))");
		sizes.push("1px 100%");
	}
	return {
		backgroundImage: images.join(","),
		backgroundSize: sizes.join(","),
		backgroundRepeat: "no-repeat",
		backgroundPosition: images.map((_, i) => `${7 + i * 14}px 0`).join(","),
	};
}

/** Renders the tree as indented rows; folders toggle collapse, files call onOpen.
 * Optional row actions: onStage/onUnstage per file, onStageDir/onUnstageDir per
 * folder (called with the folder's repo-relative path), and the two-step-confirm
 * onDiscard/onDiscardDir pair. */
export function ChangeTree({ items, onOpen, onDiscard, onDiscardDir, onStage, onStageDir, onUnstage, onUnstageDir, keyPrefix, t }) {
	const [collapsed, setCollapsed] = useState(() => new Set());
	const [confirmPath, setConfirmPath] = useState(null);
	const [confirmDir, setConfirmDir] = useState(null);
	const tree = useMemo(() => buildTree(items ?? []), [items]);
	const dupNames = useMemo(() => {
		const counts = new Map();
		for (const item of items ?? []) {
			const base = String(item.path).split("/").pop();
			counts.set(base, (counts.get(base) ?? 0) + 1);
		}
		return counts;
	}, [items]);
	const toggle = (id) => setCollapsed((prev) => {
		const next = new Set(prev);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		return next;
	});
	const rows = [];
	const walk = (node, depth, prefix) => {
		// VSCode-SCM ordering: folders first, then files, each alphabetical.
		for (const dir of [...node.dirs.values()].sort(byName)) {
			const id = prefix + dir.name;
			const isCollapsed = collapsed.has(id);
			rows.push(h("button", {
				key: `d:${keyPrefix}:${id}`,
				type: "button",
				className: "ce-row cet-row cet-dir",
				style: { paddingLeft: `${4 + depth * 14}px`, ...guideStyle(depth) },
				title: `${dir.name}/ · ${dir.count}`,
				"aria-expanded": String(!isCollapsed),
				onClick: () => toggle(id),
			},
			h("span", { className: `cet-tw${isCollapsed ? "" : " cet-tw-open"}` }, "▶"),
			h("span", { className: "cet-fico cet-fico-dir" }, h(FolderGlyph)),
			h("span", { className: "ce-name cet-dirname" }, dir.name),
			h("span", { className: "cet-right" },
				onStageDir
					? h("button", {
						type: "button",
						className: "cet-act",
						title: t ? t("changes.stageDir") : "stage",
						onClick: (e) => {
							e.stopPropagation();
							onStageDir(id);
						},
					}, "+")
					: null,
				onUnstageDir
					? h("button", {
						type: "button",
						className: "cet-act",
						title: t ? t("changes.unstageDir") : "unstage",
						onClick: (e) => {
							e.stopPropagation();
							onUnstageDir(id);
						},
					}, "−")
					: null,
				onDiscardDir
					? (confirmDir === id
						? h(Fragment, null,
							h("button", {
								type: "button",
								className: "cet-act cet-act-show cet-act-danger",
								onClick: (e) => {
									e.stopPropagation();
									setConfirmDir(null);
									onDiscardDir(filesUnder(dir));
								},
							}, t ? t("changes.confirm") : "?"),
							h("button", {
								type: "button",
								className: "cet-act cet-act-show",
								onClick: (e) => {
									e.stopPropagation();
									setConfirmDir(null);
								},
							}, t ? t("changes.cancel") : "x"),
						)
						: h("button", {
							type: "button",
							className: "cet-act",
							title: t ? t("changes.discardDir") : "discard",
							onClick: (e) => {
								e.stopPropagation();
								setConfirmDir(id);
							},
						}, "⟲"))
					: null,
				h("span", { className: "cet-count" }, String(dir.count)),
			),
			));
			if (!isCollapsed) walk(dir, depth + 1, `${id}/`);
		}
		for (const file of [...node.files].sort(byPath)) {
			const base = file.path.split("/").pop();
			const dirPart = file.path.slice(0, file.path.length - base.length).replace(/\/$/, "");
			const dup = (dupNames.get(base) ?? 0) > 1 && dirPart !== "";
			rows.push(h("button", {
				key: `f:${keyPrefix}:${file.path}`,
				type: "button",
				className: "ce-row cet-row",
				style: { paddingLeft: `${4 + depth * 14 + 14}px`, ...guideStyle(depth + 1) },
				title: file.from ? `${file.path} ← ${file.from}` : file.path,
				onClick: () => onOpen(file),
			},
			h("span", { className: `cet-fico ${fileTint(file.path)}` }, h(FileGlyph)),
			h("span", { className: "ce-name" },
				base,
				dup ? h("span", { className: "cet-dirhint" }, dirPart) : null,
			),
			h("span", { className: "cet-right" },
				onStage
					? h("button", {
						type: "button",
						className: "cet-act",
						title: t ? t("changes.stage") : "stage",
						onClick: (e) => {
							e.stopPropagation();
							onStage(file);
						},
					}, "+")
					: null,
				onUnstage
					? h("button", {
						type: "button",
						className: "cet-act",
						title: t ? t("changes.unstage") : "unstage",
						onClick: (e) => {
							e.stopPropagation();
							onUnstage(file);
						},
					}, "−")
					: null,
				onDiscard && ["M", "D", "A"].includes(String(file.ch))
					? (confirmPath === file.path
						? h(Fragment, null,
							h("button", {
								type: "button",
								className: "cet-act cet-act-show cet-act-danger",
								onClick: (e) => {
									e.stopPropagation();
									setConfirmPath(null);
									onDiscard(file);
								},
							}, t ? t("changes.confirm") : "?"),
							h("button", {
								type: "button",
								className: "cet-act cet-act-show",
								onClick: (e) => {
									e.stopPropagation();
									setConfirmPath(null);
								},
							}, t ? t("changes.cancel") : "x"),
						)
						: h("button", {
							type: "button",
							className: "cet-act",
							title: t ? t("changes.discard") : "discard",
							onClick: (e) => {
								e.stopPropagation();
								setConfirmPath(file.path);
							},
						}, "⟲"))
					: null,
				h("span", { className: `cet-status cet-st-${String(file.ch).toLowerCase()}` }, file.ch),
			),
			));
		}
	};
	walk(tree, 0, "");
	return h(Fragment, null, rows);
}
