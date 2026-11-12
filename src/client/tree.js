/* ---------------- workspace file tree panel ---------------- */

import { Fragment, h, useCallback, useEffect, useRef, useState } from "./react.js";
import { api } from "./api.js";
import { useDismissLayer } from "./dismiss.js";
import { HintButton } from "./hint.js";
import { IconFolder } from "./icons.js";
import { FileGlyph, fileTint } from "./changetree.js";
import { ancestorDirs, canDropInto, parentDir, toAbs } from "./pathtools.js";

export function TreePanel({ cwd, t, onOpenFile, activePath, revealPath, refreshKey, onNotify, onDeleted, onSearchDirectory }) {
	const [listing, setListing] = useState({});
	const [expanded, setExpanded] = useState([]);
	const [action, setAction] = useState(null); // {kind: newfile|newdir|rename|delete, path, value}
	const [dragPath, setDragPath] = useState(null); // path being dragged (move source)
	const [dropDir, setDropDir] = useState(null); // dir currently highlighted as drop target
	const [contextMenu, setContextMenu] = useState(null); // {path, isDir, x, y}
	const railRef = useRef(null);
	const contextMenuRef = useDismissLayer({ open: Boolean(contextMenu), onDismiss: () => setContextMenu(null) });
	const deleteRef = useDismissLayer({ open: action?.kind === "delete", onDismiss: () => setAction(null) });
	const lastRevealed = useRef(null);
	const revealTick = useRef(null);
	const loadDir = useCallback((path) => {
		// Keep showing the previous listing while refetching — replacing it with
		// a loading state made every reveal/refresh flicker the subtree away.
		setListing((current) => (current[path]?.entries ? current : { ...current, [path]: { loading: true } }));
		api("fs.list", { cwd, path }).then((res) => {
			setListing((current) => {
				if (!res.ok) return current[path]?.entries ? current : { ...current, [path]: { error: res.error } };
				return { ...current, [path]: res.value };
			});
		});
	}, [cwd]);

	useEffect(() => {
		setListing({});
		setExpanded([]);
		setAction(null);
		setContextMenu(null);
		loadDir("");
	}, [cwd, refreshKey, loadDir]);

	// VSCode-style auto reveal: opening a file (from search, quick-open, an LSP
	// jump…) expands its ancestor chain and scrolls the row into view. Runs
	// once per path/refresh — reloads the chain so it also works right after
	// a tree refresh cleared the listings.
	useEffect(() => {
		const p = typeof revealPath === "string" && revealPath !== "" ? revealPath : null;
		if (!p) return;
		const tick = `${refreshKey}`;
		if (p === lastRevealed.current && tick === revealTick.current) return;
		lastRevealed.current = p;
		revealTick.current = tick;
		const chain = ancestorDirs(p);
		if (chain.length === 0) return;
		setExpanded((prev) => {
			const next = new Set(prev);
			for (const d of chain) next.add(d);
			return [...next];
		});
		for (const d of chain) loadDir(d);
	}, [revealPath, refreshKey, loadDir]);
	// Scroll once the rows exist: retried whenever listings/expansion settle.
	useEffect(() => {
		const p = typeof revealPath === "string" && revealPath !== "" ? revealPath : null;
		if (!p || typeof CSS === "undefined") return undefined;
		const raf = requestAnimationFrame(() => {
			try {
				railRef.current?.querySelector(`[data-tp="${CSS.escape(p)}"]`)?.scrollIntoView({ block: "nearest" });
			} catch { /* escape unsupported */ }
		});
		return () => cancelAnimationFrame(raf);
	}, [revealPath, listing, expanded]);
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
	// Drag-move: drop onto a folder (or the panel background for the root)
	// renames the entry into it; both directories refresh afterwards.
	const runMove = (from, toDir) => {
		const name = from.split("/").pop();
		const to = toDir === "" ? name : `${toDir}/${name}`;
		if (to === from) return;
		const srcDir = parentDir(from);
		api("fs.rename", { cwd, path: from, to }).then((res) => {
			if (!res.ok || res.value?.error) {
				onNotify?.(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
				return;
			}
			onNotify?.(t("tree.moved"));
			loadDir(srcDir);
			loadDir(toDir);
		});
	};
	const dragProps = (path) => ({
		draggable: true,
		onDragStart: (e) => {
			setDragPath(path);
			try {
				e.dataTransfer.setData("text/plain", path);
				e.dataTransfer.effectAllowed = "move";
			} catch { /* older browsers */ }
		},
		onDragEnd: () => {
			setDragPath(null);
			setDropDir(null);
		},
	});
	const dropProps = (dirPath) => ({
		onDragOver: (e) => {
			if (!dragPath || !canDropInto(dragPath, dirPath)) return;
			e.preventDefault();
			e.stopPropagation();
			try {
				e.dataTransfer.dropEffect = "move";
			} catch {}
			if (dropDir !== dirPath) setDropDir(dirPath);
		},
		onDragLeave: (e) => {
			e.stopPropagation();
			if (dropDir === dirPath) setDropDir(null);
		},
		onDrop: (e) => {
			e.preventDefault();
			e.stopPropagation();
			const from = dragPath;
			setDragPath(null);
			setDropDir(null);
			if (from && canDropInto(from, dirPath)) runMove(from, dirPath);
		},
	});
	// Dropping onto a file row targets that file's folder (VSCode behavior);
	// the drop event never falls through to the root handler.
	const fileDropProps = (filePath) => {
		const dir = parentDir(filePath);
		return {
			onDragOver: (e) => {
				if (!dragPath || !canDropInto(dragPath, dir)) return;
				e.preventDefault();
				e.stopPropagation();
				try {
					e.dataTransfer.dropEffect = "move";
				} catch {}
			},
			onDrop: (e) => {
				e.stopPropagation();
				if (!dragPath) return;
				e.preventDefault();
				const from = dragPath;
				setDragPath(null);
				setDropDir(null);
				if (canDropInto(from, dir)) runMove(from, dir);
			},
		};
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
	const openContextMenu = (event, path, isDir) => {
		event.preventDefault();
		event.stopPropagation();
		setContextMenu({
			path,
			isDir,
			x: Math.max(8, Math.min(event.clientX, (window.innerWidth || 1000) - 218)),
			y: Math.max(8, Math.min(event.clientY, (window.innerHeight || 800) - 260)),
		});
	};
	const contextCopy = (relative) => {
		if (!contextMenu) return;
		copyPath(contextMenu.path, relative ? { altKey: true } : {});
		setContextMenu(null);
	};
	const contextRename = () => {
		if (!contextMenu) return;
		setAction({ kind: "rename", path: contextMenu.path, value: contextMenu.path.split("/").pop() });
		setContextMenu(null);
	};
	const contextDelete = () => {
		if (!contextMenu) return;
		setAction({ kind: "delete", path: contextMenu.path });
		setContextMenu(null);
	};
	const contextCreate = (kind) => {
		if (!contextMenu?.isDir) return;
		if (!expanded.includes(contextMenu.path)) setExpanded([...expanded, contextMenu.path]);
		if (listing[contextMenu.path] === undefined) loadDir(contextMenu.path);
		setAction({ kind, path: contextMenu.path, value: "" });
		setContextMenu(null);
	};
	const inputRow = (dirPath, kind, placeholder) => h("div", {		key: `inp:${dirPath}:${kind}`,
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
		isDir ? h(HintButton, {
			type: "button",
			className: "cet-act",
			hint: t("tree.newFile"),
			onClick: (e) => {
				e.stopPropagation();
				if (!expanded.includes(path)) setExpanded([...expanded, path]);
				if (listing[path] === undefined) loadDir(path);
				setAction({ kind: "newfile", path, value: "" });
			},
		}, "+") : null,
		h(HintButton, {
			type: "button",
			className: "cet-act",
			hint: t("tree.copyPath"),
			onClick: (e) => {
				e.stopPropagation();
				copyPath(path, e);
			},
		}, "📋"),
		h(HintButton, {
			type: "button",
			className: "cet-act",
			hint: t("tree.rename"),
			onClick: (e) => {
				e.stopPropagation();
				setAction({ kind: "rename", path, value: path.split("/").pop() });
			},
		}, "✎"),
		action?.kind === "delete" && action.path === path
			? h("span", { ref: deleteRef },
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
			: h(HintButton, {
				type: "button",
				className: "cet-act",
				hint: t("tree.delete"),
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
						{
							key: childPath,
							"data-tp": childPath,
							className: `ce-row${dropDir === childPath ? " ce-row-drop" : ""}`,
							style: { paddingLeft: 6 + depth * 14 },
							onClick: () => toggle(childPath),
							onContextMenu: (e) => openContextMenu(e, childPath, true),
							type: "button",
							...dragProps(childPath),
							...dropProps(childPath),
						},
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
							"data-tp": childPath,
							className: `ce-row${activePath && (activePath === childPath || activePath.endsWith(`/${childPath}`)) ? " ce-active" : ""}`,
							style: { paddingLeft: 6 + depth * 14 },
							type: "button",
							onClick: () => onOpenFile(childPath, 1, 1),
							onContextMenu: (e) => openContextMenu(e, childPath, false),
							...dragProps(childPath),
							...fileDropProps(childPath),
						},
						h("span", { className: `cet-fico ce-tree-ico ${fileTint(childPath)}` }, h(FileGlyph)),
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
	return h("div", {
		className: "ce-scroll ce-rail",
		ref: railRef,
		// Root drop only when the pointer is over the bare panel background —
		// drops that bubble up from rows must not teleport entries to the root.
		onDragOver: (e) => {
			if (e.target !== railRef.current || !dragPath || !canDropInto(dragPath, "")) return;
			e.preventDefault();
			try {
				e.dataTransfer.dropEffect = "move";
			} catch {}
		},
		onDrop: (e) => {
			if (e.target !== railRef.current || !dragPath) return;
			e.preventDefault();
			const from = dragPath;
			setDragPath(null);
			setDropDir(null);
			if (canDropInto(from, "")) runMove(from, "");
		},
	},
	h("div", { className: "ctp-tools" },
		h(HintButton, { type: "button", className: "cet-act cet-act-show", hint: t("tree.newFileRoot"), onClick: () => setAction({ kind: "newfile", path: "", value: "" }) }, `+ ${t("tree.fileWord")}`),
		h(HintButton, { type: "button", className: "cet-act cet-act-show", hint: t("tree.newDirRoot"), onClick: () => setAction({ kind: "newdir", path: "", value: "" }) }, `+ ${t("tree.dirWord")}`),
	),
	action !== null && (action.kind === "newfile" || action.kind === "newdir") && action.path === ""
		? inputRow("", action.kind === "newdir" ? "dir" : "file", action.kind === "newdir" ? t("tree.newDirPlaceholder") : t("tree.newFilePlaceholder"))
		: null,
	renderLevel("", 0),
		contextMenu
			? h("div", { className: "cet-context", ref: contextMenuRef, style: { left: contextMenu.x, top: contextMenu.y }, role: "menu", onMouseDown: (e) => e.stopPropagation() },
				h("div", { className: "cet-context-path", title: contextMenu.path }, contextMenu.path || t("tree.workspaceRoot")),
				h("div", { className: "cet-context-rule" }),
				h("button", { type: "button", role: "menuitem", onClick: () => contextCopy(false) }, t("tree.copyAbsolute")),
				h("button", { type: "button", role: "menuitem", onClick: () => contextCopy(true) }, t("tree.copyRelative")),
				contextMenu.isDir ? h(Fragment, null,
					onSearchDirectory ? h("button", { type: "button", role: "menuitem", onClick: () => { onSearchDirectory(contextMenu.path); setContextMenu(null); } }, t("search.inDirectory")) : null,
					h("button", { type: "button", role: "menuitem", onClick: () => contextCreate("newfile") }, t("tree.newFile")),
					h("button", { type: "button", role: "menuitem", onClick: () => contextCreate("newdir") }, t("tree.newDir")),
				) : null,
				h("button", { type: "button", role: "menuitem", onClick: contextRename }, t("tree.rename")),
				h("button", { type: "button", role: "menuitem", className: "cet-context-danger", onClick: contextDelete }, t("tree.delete")),
			) : null,
	);
}
