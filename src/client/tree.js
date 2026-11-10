/* ---------------- workspace file tree panel ---------------- */

import { Fragment, h, useCallback, useEffect, useState } from "./react.js";
import { api } from "./api.js";
import { IconFile, IconFolder } from "./icons.js";
import { toAbs } from "./pathtools.js";

export function TreePanel({ cwd, t, onOpenFile, activePath, refreshKey, onNotify, onDeleted }) {
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
	// Clipboard copy: plain click → absolute path, ⌥/Alt-click → workspace-relative.
	const copyPath = (path, event) => {
		const text = event?.altKey ? path : toAbs(cwd, path);
		const ok = () => onNotify?.(t("tree.copied"));
		const bad = () => onNotify?.(`${t("error")}: clipboard`, "error");
		try {
			const p = navigator.clipboard?.writeText(text);
			if (p && typeof p.then === "function") p.then(ok, bad);
			else ok();
		} catch {
			bad();
		}
	};
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
			title: t("tree.copyPath"),
			onClick: (e) => {
				e.stopPropagation();
				copyPath(path, e);
			},
		}, "📋"),
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
