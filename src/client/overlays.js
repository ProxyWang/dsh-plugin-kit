/* ---------------- floating overlays: location list, quick open, search, refs peek, symbol palette ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { ROW } from "./constants.js";
import { RelPath } from "./pathtools.js";
import { failureAt } from "./tasks.js";
import { useDismissLayer } from "./dismiss.js";

export function LocationList({ t, overlay, cwd, onPick, onClose }) {
	const panelRef = useDismissLayer({ onDismiss: onClose });
	return h(
		"div",
		{ className: "ce-overlay", ref: panelRef, role: "dialog", "aria-label": overlay.title },
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

export function CommandPalette({ t, commands, onClose }) {
	const [query, setQuery] = useState("");
	const [sel, setSel] = useState(0);
	const inputRef = useRef(null);
	const listRef = useRef(null);
	const panelRef = useDismissLayer({ onDismiss: onClose, ignoreSelector: ".ce-command-trigger" });
	const items = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (commands ?? []).filter((item) => !q || `${item.label} ${item.hint ?? ""}`.toLowerCase().includes(q));
	}, [commands, query]);
	useEffect(() => { setSel(0); }, [query]);
	useEffect(() => { inputRef.current?.focus(); }, []);

	useEffect(() => { listRef.current?.querySelector(`[data-command="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);
	const choose = (index) => {
		const item = items[index];
		if (!item) return;
		onClose();
		item.run();
	};
	const onKeyDown = (event) => {
		if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
		else if (event.key === "ArrowDown") { event.preventDefault(); setSel((value) => Math.min(Math.max(0, items.length - 1), value + 1)); }
		else if (event.key === "ArrowUp") { event.preventDefault(); setSel((value) => Math.max(0, value - 1)); }
		else if (event.key === "Enter") { event.preventDefault(); choose(sel); }
	};
	return h("div", { className: "ce-palette ce-command-palette", ref: panelRef, role: "dialog", "aria-label": t("command.title"), onKeyDown },
		h("div", { className: "ce-palette-head" },
			h("span", { className: "ce-command-mark", "aria-hidden": true }, ">_"),
			h("input", { ref: inputRef, className: "ce-input", type: "search", placeholder: t("command.placeholder"), "aria-label": t("command.placeholder"), value: query, onChange: (event) => setQuery(event.target.value), onKeyDown: (event) => { event.stopPropagation(); onKeyDown(event); }, autoComplete: "off" }),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		h("div", { className: "ce-palette-list ce-scroll", ref: listRef },
			items.length === 0 ? h("div", { className: "ce-note" }, t("command.empty")) : null,
			items.map((item, index) => h("button", { key: item.id, type: "button", "data-command": index, className: `ce-command-item${index === sel ? " ce-qitem-sel" : ""}`, onMouseEnter: () => setSel(index), onClick: () => choose(index) },
				h("span", { className: "ce-command-icon", "aria-hidden": true }, item.icon ?? "·"),
				h("span", { className: "ce-command-label" }, item.label),
				item.hint ? h("kbd", { className: "ce-command-hint" }, item.hint) : null,
			)),
		),
	);
}
export function QuickOpen({ t, state, onQuery, onPick, onClose }) {
	const panelRef = useDismissLayer({ onDismiss: onClose, ignoreSelector: ".ce-rail-quickopen" });
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
		{ className: "ce-palette", ref: panelRef, role: "dialog", "aria-label": t("quickopen.placeholder"), onKeyDown },
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
				onKeyDown: (event) => { event.stopPropagation(); onKeyDown(event); },
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

export function RefsPeek({ t, cwd, peek, scroll, totalLines, onPick, onClose }) {
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
	const panelRef = useDismissLayer({ onDismiss: onClose });
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
		{ className: "ce-peek", ref: panelRef, style: { top }, onKeyDown, onMouseDown: (event) => event.stopPropagation() },
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
						h("span", { className: "ce-peek-kind" }, r.isDef ? "◆" : "·"),
						h("span", { className: "ce-peek-lno" }, `${r.line}:${r.col}`),
						h("span", { className: "ce-peek-snippet" }, r.snippet ?? ""),
					);
				});
				return h(
					Fragment,
					{ key: `${g.path}-${gi}` },
					h("div", { className: "ce-peek-file" },
						h("span", { className: "ce-peek-file-icon", "aria-hidden": "true" }, "▤"),
						h("span", { className: "ce-peek-fpath", title: g.path }, RelPath(cwd, g.path) || g.path),
						h("span", { className: "ce-peek-file-count" }, String(g.rows.length)),
					),
					fileRows,
				);
			}),
		),
	);
}

const SYMBOL_GLYPHS = { 2: "▣", 3: "ƒ", 4: "Ω", 5: "◆", 6: "ƒ", 7: "◆", 8: "◈", 9: "#", 10: "◈", 11: "▣", 12: "✓", 13: "▣", 14: "🛡", 15: "ω", 16: "◆", 17: "◆", 18: "≡", 19: "◦", 20: "◦", 21: "≡", 22: "◆", 23: "◆", 24: "▣", 25: "•", 26: "•" };

export function SymbolPalette({ t, symbols, onPick, onClose }) {
	const panelRef = useDismissLayer({ onDismiss: onClose });
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
		{ className: "ce-palette", ref: panelRef, role: "dialog", "aria-label": t("symbols.placeholder"), onKeyDown, onMouseDown: (event) => event.stopPropagation() },
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
				onKeyDown: (event) => { event.stopPropagation(); onKeyDown(event); },
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

/**
 * Workspace symbol search (VS Code ⌘T shape): the query lives in the parent
 * because results come from the host's workspace/symbol with debounced
 * fetching; rows show kind glyph, name, container and the file:line.
 */
export function WorkspaceSymbolPalette({ t, cwd, state, onQuery, onPick, onClose }) {
	const panelRef = useDismissLayer({ onDismiss: onClose });
	const [sel, setSel] = useState(0);
	const inputRef = useRef(null);
	const listRef = useRef(null);
	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	const items = useMemo(() => (state.results ?? []).slice(0, 120), [state.results]);
	useEffect(() => {
		setSel(0);
	}, [state.query, state.results]);
	useEffect(() => {
		listRef.current?.querySelector(`[data-wi="${sel}"]`)?.scrollIntoView({ block: "nearest" });
	}, [sel]);
	const onKeyDown = (event) => {
		if (event.key === "ArrowDown") {
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
		{ className: "ce-palette", ref: panelRef, role: "dialog", "aria-label": t("wsym.placeholder"), onKeyDown, onMouseDown: (event) => event.stopPropagation() },
		h(
			"div",
			{ className: "ce-palette-head" },
			h("input", {
				ref: inputRef,
				className: "ce-input",
				type: "text",
				placeholder: t("wsym.placeholder"),
				value: state.query,
				onChange: (event) => onQuery(event.target.value),
				onKeyDown: (event) => { event.stopPropagation(); onKeyDown(event); },
				spellcheck: false,
			}),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		h(
			"div",
			{ className: "ce-palette-list ce-scroll", ref: listRef },
			state.busy && items.length === 0 ? h("div", { className: "ce-note" }, t("loading")) : null,
			!state.busy && state.error ? h("div", { className: "ce-note" }, state.error) : null,
			!state.busy && !state.error && items.length === 0 ? h("div", { className: "ce-note" }, state.query.trim() === "" ? t("wsym.needQuery") : t("wsym.none")) : null,
			items.map((s, i) =>
				h(
					"button",
					{
						key: `${s.name}-${s.path}-${s.line}-${i}`,
						type: "button",
						"data-wi": i,
						className: `ce-qitem${i === sel ? " ce-qitem-sel" : ""}`,
						onMouseEnter: () => setSel(i),
						onClick: () => onPick(s),
					},
					h("span", { className: "ce-symglyph" }, SYMBOL_GLYPHS[s.kind] ?? "•"),
					h("span", { className: "ce-qbase" }, s.container ? `${s.name} · ${s.container}` : s.name),
					h("span", { className: "ce-qdir" }, RelPath(cwd, s.path)),
					h("span", { className: "ce-qdir" }, `:${s.line}`),
				),
			),
		),
	);
}

/**
 * Compare-refs dialog: two ref fields plus the branch list (local then
 * remote). Clicking a ref fills the base first, then the head — the cheap
 * autocomplete VS Code's palette gets from its pickers.
 */
export function CompareRefsPalette({ t, busy, branches, onRun, onClose }) {
	const panelRef = useDismissLayer({ onDismiss: onClose });
	const [base, setBase] = useState("");
	const [head, setHead] = useState("HEAD");
	const inputRef = useRef(null);
	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	const fill = (name) => {
		if (base === "") setBase(name);
		else setHead(name);
	};
	return h(
		"div",
		{ className: "ce-palette ce-compare-box", ref: panelRef, role: "dialog", "aria-label": t("compare.title"), onKeyDown: (e) => { if (e.key === "Escape") onClose(); } },
		h("div", { className: "ce-palette-head" },
			h("span", { className: "ce-disclosure-summary" }, t("compare.title")),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		h("div", { className: "ce-compare-fields" },
			h("input", { ref: inputRef, className: "ce-input", type: "text", placeholder: t("compare.base"), value: base, onChange: (e) => setBase(e.target.value), spellcheck: false, autoComplete: "off" }),
			h("input", { className: "ce-input", type: "text", placeholder: t("compare.head"), value: head, onChange: (e) => setHead(e.target.value), spellcheck: false, autoComplete: "off" }),
			h("button", {
				type: "button",
				className: "ce-commitbox-btn",
				disabled: busy || base.trim() === "",
				onClick: () => onRun(base.trim(), head.trim() || "HEAD"),
			}, busy ? t("compare.busy") : t("compare.run")),
		),
		h("div", { className: "ce-palette-list ce-scroll" },
			branches.length === 0 ? h("div", { className: "ce-note" }, t("compare.noRefs")) : null,
			branches.map((b) =>
				h(
					"button",
					{ key: b.name, type: "button", className: "ce-qitem", title: b.remote ? "remote" : "local", onClick: () => fill(b.name) },
					h("span", { className: "ce-symglyph" }, b.remote ? "☁" : "⌂"),
					h("span", { className: "ce-qbase" }, b.name),
					b.current ? h("span", { className: "ce-qdir" }, "•") : null,
				),
			),
		),
	);
}

/**
 * Task list: package.json scripts with their commands; rows run on click and
 * mark in-flight jobs. Runs are the workspace's own npm scripts — no shell
 * field is ever editable here.
 */
export function TaskPalette({ t, state, onRun, onClose }) {
	const panelRef = useDismissLayer({ onDismiss: onClose });
	const names = useMemo(() => Object.keys(state.scripts ?? {}), [state.scripts]);
	return h(
		"div",
		{ className: "ce-palette", ref: panelRef, role: "dialog", "aria-label": t("task.title"), onKeyDown: (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } } },
		h("div", { className: "ce-palette-head" },
			h("span", { className: "ce-disclosure-summary" }, t("task.title")),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		h("div", { className: "ce-palette-list ce-scroll" },
			state.busy ? h("div", { className: "ce-note" }, t("loading")) : null,
			state.error ? h("div", { className: "ce-note" }, state.error) : null,
			!state.busy && !state.error && names.length === 0 ? h("div", { className: "ce-note" }, t("task.noScripts")) : null,
			names.map((name) =>
				h(
					"button",
					{ key: name, type: "button", className: "ce-qitem", onClick: () => onRun(name) },
					h("span", { className: "ce-symglyph" }, (state.running ?? {})[name] ? "●" : "‣"),
					h("span", { className: "ce-qbase" }, name),
					h("span", { className: "ce-qdir" }, state.scripts[name]),
				),
			),
		),
	);
}

/**
 * Task output: retained-tail log with per-line failure locators turned into
 * clickable jumps. The panel keeps polling while the job runs; Stop sends
 * SIGTERM (then SIGKILL after a grace) through the host.
 */
export function TaskOutputPanel({ t, state, onStop, onClose, onOpenFile, tail = 2000 }) {
	const panelRef = useDismissLayer({ onDismiss: onClose, ignoreSelector: '[data-ce-popup-trigger="task-stop"]' });
	const bodyRef = useRef(null);
	const lines = useMemo(() => {
		const all = [];
		for (const c of state.chunks) all.push(c);
		const text = all.map((c) => c.text).join("");
		const rows = text.split("\n");
		if (rows.length > tail) return rows.slice(-tail).map((line, i) => ({ line, n: rows.length - tail + i + 1 }));
		return rows.map((line, i) => ({ line, n: i + 1 }));
	}, [state.chunks, tail]);
	const scrolledTo = useRef(0);
	useEffect(() => {
		const el = bodyRef.current;
		if (el && state.seq !== scrolledTo.current) {
			scrolledTo.current = state.seq;
			el.scrollTop = el.scrollHeight;
		}
	}, [state.seq]);
	const status = state.done ? (state.code === 0 ? t("task.exited", { code: String(state.code) }) : t("task.failed", { code: String(state.code ?? "?") })) : t("task.running");
	return h(
		"div",
		{ className: "ce-palette ce-task-panel", ref: panelRef, role: "dialog", "aria-label": `${t("task.output")}: ${state.script}`, onKeyDown: (e) => { if (e.key === "Escape") onClose(); } },
		h("div", { className: "ce-palette-head" },
			h("span", { className: "ce-symglyph" }, "‣"),
			h("span", { className: "ce-disclosure-summary" }, state.script),
			h("span", { className: `ce-peek-meta${state.done && state.code !== 0 ? " ce-danger" : ""}` }, status),
			state.dropped ? h("span", { className: "ce-peek-meta", title: t("task.droppedHint") }, t("task.dropped")) : null,
			h("span", { className: "ce-spacer" }),
			!state.done ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("task.stop"), "data-ce-popup-trigger": "task-stop", onClick: onStop }, `■ ${t("task.stop")}`) : null,
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		h("div", { className: "ce-task-body ce-scroll", ref: bodyRef },
			lines.map((r) => {
				const loc = failureAt(r.line);
				return h(
					"div",
					{ key: `${r.n}`, className: "ce-task-line" },
					loc
						? h("button", { type: "button", className: "ce-task-jump", title: t("task.jumpHint"), onClick: () => onOpenFile(loc.path, loc.line, loc.col) }, r.line)
						: r.line,
				);
			}),
		),
	);
}

/** Minimal "go to line" palette (⌘G / Ctrl+G): one numeric input, Enter jumps. */export function GotoLinePalette({ t, totalLines, initial, onGo, onClose }) {
	const panelRef = useDismissLayer({ onDismiss: onClose });
	const [value, setValue] = useState(String(initial ?? ""));
	const inputRef = useRef(null);
	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);
	const submit = () => {
		const n = Number.parseInt(value, 10);
		if (Number.isFinite(n) && n >= 1) onGo(Math.min(n, totalLines));
		onClose();
	};
	const onKeyDown = (event) => {
		event.stopPropagation();
		if (event.key === "Enter") {
			event.preventDefault();
			submit();
		} else if (event.key === "Escape") {
			event.preventDefault();
			onClose();
		}
	};
	return h(
		"div",
		{ className: "ce-palette ce-goto", ref: panelRef, role: "dialog", "aria-label": t("goto.title"), onMouseDown: (event) => event.stopPropagation() },
		h(
			"div",
			{ className: "ce-palette-head" },
			h("input", {
				ref: inputRef,
				className: "ce-input",
				type: "text",
				inputMode: "numeric",
				placeholder: t("goto.placeholder", { n: totalLines }),
				value,
				onChange: (event) => setValue(event.target.value),
				onKeyDown: (event) => { event.stopPropagation(); onKeyDown(event); },
				spellcheck: false,
				autoComplete: "off",
			}),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
	);
}

/** File history overlay (🕘): commits that touched one file, newest first; clicking opens that commit's diff for the file. */
export function FileHistoryOverlay({ t, hist, onPick, onClose }) {
	const panelRef = useDismissLayer({ onDismiss: onClose });
	return h(
		"div",
		{ className: "ce-overlay", ref: panelRef, role: "dialog", "aria-label": t("history.title"), onMouseDown: (event) => event.stopPropagation() },
		h(
			"div",
			{ className: "ce-overlay-head" },
			h("span", null, `${t("history.title")}${hist.commits ? ` · ${hist.commits.length}` : ""}`),
			h("span", { className: "ce-histpath" }, hist.path),
			h("span", { className: "ce-spacer" }),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		h(
			"div",
			{ className: "ce-overlay-list ce-scroll" },
			hist.busy ? h("div", { className: "ce-note" }, t("loading")) : null,
			hist.error ? h("div", { className: "ce-note" }, `${t("error")}: ${hist.error}`) : null,
			!hist.busy && !hist.error && (hist.commits ?? []).length === 0
				? h("div", { className: "ce-note" }, t("history.none"))
				: null,
			(hist.commits ?? []).map((c) =>
				h(
					"button",
					{ key: c.hash, type: "button", className: "ce-histrow", title: `${c.hash} · ${c.author} · ${c.when}`, onClick: () => onPick(c) },
					h("span", { className: "ce-chash" }, c.hash),
					h("span", { className: "ce-csubject" }, c.subject),
					h("span", { className: "ce-histmeta" }, `${c.author} · ${c.when}`),
				),
			),
		),
	);
}

/** LSP severity → Problems-row glyph and class (1 error, 2 warning, 3 info, 4 hint). */
export function problemSeverity(severity) {
	if (severity === 1) return { glyph: "✕", cls: " ce-problem-err" };
	if (severity === 2) return { glyph: "⚠", cls: " ce-problem-warn" };
	if (severity === 3) return { glyph: "ℹ", cls: "" };
	return { glyph: "·", cls: "" };
}

/**
 * Problems panel (VS Code ⇧⌘M): the open file's LSP diagnostics sorted by
 * position; clicking a row closes the panel and reveals the line. The header
 * carries VS Code's severity filters (errors / warnings / infos) with counts.
 */
export function ProblemsPanel({ t, diagnostics, onPick, onClose, workspaceFiles }) {
	const panelRef = useDismissLayer({ onDismiss: onClose });
	const [filters, setFilters] = useState({ err: true, warn: true, info: true });
	// Flatten workspace-wide diagnostics (from lsp.workspaceDiagnostics) into the
	// same shape as the per-file list so the panel shows every open file's issues.
	const all = useMemo(() => {
		const items = [];
		if (Array.isArray(workspaceFiles)) {
			for (const file of workspaceFiles) {
				const rel = file.path?.split("/").slice(-2).join("/") ?? file.path ?? "";
				for (const item of file.items ?? []) items.push({ ...item, _file: rel });
			}
		} else {
			for (const item of diagnostics ?? []) items.push({ ...item, _file: "" });
		}
		return items.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.col ?? 0) - (b.col ?? 0));
	}, [diagnostics, workspaceFiles]);
	const bucketOf = (item) => (item?.severity === 1 ? "err" : item?.severity === 2 ? "warn" : "info");
	const counts = useMemo(() => {
		const c = { err: 0, warn: 0, info: 0 };
		for (const item of all) c[bucketOf(item)]++;
		return c;
	}, [all]);
	const items = all.filter((item) => filters[bucketOf(item)]);
	return h(
		"div",
		{ className: "ce-overlay ce-problems", ref: panelRef, role: "dialog", "aria-label": t("problems.title"), onMouseDown: (event) => event.stopPropagation() },
		h(
			"div",
			{ className: "ce-overlay-head" },
			h("span", null, `${t("problems.title")} · ${items.length}${items.length !== all.length ? `/${all.length}` : ""}`),
			h("span", { className: "ce-spacer" }),
			[["err", "✕", "problems.showErr"], ["warn", "⚠", "problems.showWarn"], ["info", "ℹ", "problems.showInfo"]].map(([key, glyph, label]) =>
				h("button", {
					type: "button",
					key,
					className: `ce-tool ce-tiny ce-problem-filter${filters[key] ? "" : " ce-problem-off"}`,
					"aria-pressed": filters[key],
					title: t(label),
					onClick: () => setFilters((f) => ({ ...f, [key]: !f[key] })),
				}, `${glyph} ${counts[key]}`)),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		h(
			"div",
			{ className: "ce-overlay-list ce-scroll" },
			items.length === 0 ? h("div", { className: "ce-note" }, all.length === 0 ? t("problems.empty") : t("problems.filtered")) : null,
			items.map((item, i) => {
				const sev = problemSeverity(item.severity);
				return h(
					"button",
					{ key: i, type: "button", className: "ce-loc", title: `${item._file ? `${item._file}:` : ""}${item.line}:${item.col}`, onClick: () => onPick(item) },
					h("span", { className: `ce-problem-sev${sev.cls}` }, sev.glyph),
					item._file ? h("span", { className: "ce-loc-path ce-loc-file" }, item._file) : null,
					h("span", { className: "ce-loc-path" }, `${item.line}:${item.col}`),
					h("span", { className: "ce-loc-snippet" }, `${item.source ? `${item.source}: ` : ""}${item.message ?? ""}`),
				);
			}),
		),
	);
}
