/* ---------------- floating overlays: location list, quick open, search, refs peek, symbol palette ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { ROW } from "./constants.js";
import { RelPath } from "./pathtools.js";

export function LocationList({ t, overlay, cwd, onPick, onClose }) {
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

export function QuickOpen({ t, state, onQuery, onPick, onClose }) {
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

/** Minimal "go to line" palette (⌘G / Ctrl+G): one numeric input, Enter jumps. */
export function GotoLinePalette({ t, totalLines, initial, onGo, onClose }) {
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
		{ className: "ce-palette ce-goto", onMouseDown: (event) => event.stopPropagation() },
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
				onKeyDown,
				spellcheck: false,
				autoComplete: "off",
			}),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
	);
}

/** File history overlay (🕘): commits that touched one file, newest first; clicking opens that commit's diff for the file. */
export function FileHistoryOverlay({ t, hist, onPick, onClose }) {
	return h(
		"div",
		{ className: "ce-overlay", onMouseDown: (event) => event.stopPropagation() },
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
