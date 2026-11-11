/* ---------------- floating overlays: location list, quick open, search, refs peek, symbol palette ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { ROW } from "./constants.js";
import { api } from "./api.js";
import { IconSearch } from "./icons.js";
import { RelPath } from "./pathtools.js";
import { replaceInText } from "./replace.js";

/**
 * Match ranges of `query` inside one result line, mirroring the host's
 * smart-case rule (all-lowercase query ⇒ case-insensitive). Regex mode
 * compiles the query with the same flags the engine used; an invalid
 * pattern simply yields no highlight. Exported for tests.
 */
export function matchRanges(text, query, regex) {
	const ranges = [];
	if (!text || !query) return ranges;
	const insensitive = query === query.toLowerCase();
	if (regex) {
		let re;
		try {
			re = new RegExp(query, insensitive ? "gi" : "g");
		} catch {
			return ranges;
		}
		let m;
		let guard = 0;
		while ((m = re.exec(text)) !== null && guard++ < 60) {
			if (m[0] === "") {
				re.lastIndex++;
				continue;
			}
			ranges.push([m.index, m.index + m[0].length]);
		}
		return ranges;
	}
	const hay = insensitive ? text.toLowerCase() : text;
	let at = hay.indexOf(query);
	let guard = 0;
	while (at !== -1 && guard++ < 60) {
		ranges.push([at, at + query.length]);
		at = hay.indexOf(query, at + query.length);
	}
	return ranges;
}

/** Split text into [plain, <b class=ce-shl>match</b>, …] children. Exported for tests. */
export function highlightText(text, ranges) {
	if (!ranges || ranges.length === 0) return text;
	const out = [];
	let last = 0;
	for (const [s, e] of ranges) {
		if (s < last) continue; // defensive: skip overlaps
		if (s > last) out.push(text.slice(last, s));
		out.push(h("b", { key: `m${s}`, className: "ce-shl" }, text.slice(s, e)));
		last = e;
	}
	if (last < text.length) out.push(text.slice(last));
	return out;
}

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

export function SearchPanel({ t, cwd, state, onQuery, onInclude, onToggleRegex, onToggleWords, onSubmit, onPick, onClose, onNotify }) {
	const inputRef = useRef(null);
	const [expanded, setExpanded] = useState(() => new Set());
	const [ctxCache, setCtxCache] = useState({}); // path -> {lines} | {loading} | {error}
	const [replaceOpen, setReplaceOpen] = useState(false);
	const [replaceText, setReplaceText] = useState("");
	const [replaceBusy, setReplaceBusy] = useState(false);
	const [confirmAll, setConfirmAll] = useState(false);
	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	// A new result set invalidates expansions; cached file contents may stay.
	useEffect(() => {
		setExpanded(new Set());
		setConfirmAll(false);
	}, [state.results]);
	const ctxKey = (r) => `${r.path}:${r.line}`;
	// Highlight a line's matches with the same smart-case rule the engine used.
	const hl = (text) => highlightText(text, matchRanges(text, state.query ?? "", state.regex === true));
	// VSCode-style grouping: results by file with a collapsible sticky header.
	const groups = useMemo(() => {
		const out = [];
		const byPath = new Map();
		for (const r of state.results ?? []) {
			let g = byPath.get(r.path);
			if (!g) {
				g = { path: r.path, items: [] };
				byPath.set(r.path, g);
				out.push(g);
			}
			g.items.push(r);
		}
		return out;
	}, [state.results]);
	const [collapsed, setCollapsed] = useState(() => new Set());
	useEffect(() => {
		setCollapsed(new Set());
	}, [state.results]);
	const toggleGroup = (path) => setCollapsed((prev) => {
		const next = new Set(prev);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		return next;
	});
	// Replace runner: per file read → replace → write with the mtime guard, so
	// an external edit between search and replace is never silently clobbered.
	// Literal queries keep "$" in the replacement literal; regex mode honors
	// $1/$& capture references (see replace.js).
	const runReplace = async (paths) => {
		if (replaceBusy || paths.length === 0) return;
		setReplaceBusy(true);
		let files = 0;
		let hits = 0;
		const errors = [];
		const capped = paths.slice(0, 200);
		for (const path of capped) {
			const res = await api("fs.read", { cwd, path });
			if (!res.ok || res.value.kind !== "text") {
				errors.push(path);
				continue;
			}
			if (res.value.truncated === true) {
				// fs.read capped at 4 MiB: writing the prefix back would silently
				// lop off everything past the cap. Never replace in truncated files.
				errors.push(`${path}: ${t("search.replaceTruncated")}`);
				continue;
			}
			const r = replaceInText(res.value.content, state.query, replaceText, { regex: state.regex === true, words: state.words === true });
			if (r.count === 0) continue;
			const w = await api("fs.write", { cwd, path, content: r.text, baseMtime: res.value.mtimeMs });
			if (!w.ok) {
				errors.push(`${path}: ${w.error}`);
				continue;
			}
			files += 1;
			hits += r.count;
		}
		setReplaceBusy(false);
		setConfirmAll(false);
		// Expanded context lines may now show pre-replace content — drop them.
		setCtxCache({});
		if (hits > 0) onNotify?.(t("search.replaceDone", { hits, files }));
		else onNotify?.(t("search.replaceNone"), "error");
		if (errors.length > 0) onNotify?.(`${t("search.replaceFail", { n: errors.length })}: ${errors[0]}`, "error");
		if (paths.length > capped.length) onNotify?.(t("search.replaceCapped"), "error");
		onSubmit(); // refresh the result set
	};
	const toggleCtx = (r) => {
		const key = ctxKey(r);
		const next = new Set(expanded);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
			if (!ctxCache[r.path]) {
				setCtxCache((c) => ({ ...c, [r.path]: { loading: true } }));
				api("fs.read", { cwd, path: r.path }).then((res) => {
					if (!res.ok || res.value.kind !== "text") {
						setCtxCache((c) => ({ ...c, [r.path]: { error: res.error ?? t("search.ctxFail") } }));
						return;
					}
					setCtxCache((c) => {
						// Bounded cache: evict oldest paths past 30 files.
						const next = { ...c, [r.path]: { lines: res.value.content.split("\n") } };
						const keys = Object.keys(next);
						while (keys.length > 30) delete next[keys.shift()];
						return next;
					});
				});
			}
		}
		setExpanded(next);
	};
	const renderCtx = (r) => {
		const entry = ctxCache[r.path];
		if (!entry || entry.loading) return h("div", { className: "ce-sctx-note" }, t("search.ctxLoad"));
		if (entry.error) return h("div", { className: "ce-sctx-note" }, `${t("search.ctxFail")}: ${entry.error}`);
		const from = Math.max(1, r.line - 3);
		const to = Math.min(entry.lines.length, r.line + 3);
		const rows = [];
		for (let n = from; n <= to; n++) {
			rows.push(h("button", {
				key: n,
				type: "button",
				className: `ce-sctx-line${n === r.line ? " ce-sctx-hit" : ""}`,
				title: `${r.path}:${n}`,
				onClick: () => onPick({ path: r.path, line: n }),
			},
			h("span", { className: "ce-sctx-no" }, String(n)),
			h("span", { className: "ce-sctx-text" }, hl(entry.lines[n - 1] ?? "")),
			));
		}
		return h("div", { className: "ce-sctx" }, rows);
	};
	return h(
		"div",
		{ className: "ce-search" },
		h(
			"div",
			{ className: "ce-search-box" },
			h("button", { className: `ce-tool ce-tiny${replaceOpen ? " ce-tool-on" : ""}`, type: "button", title: t("search.replaceToggle"), onClick: () => setReplaceOpen((v) => !v) }, replaceOpen ? "▾" : "▸"),
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
			h("button", { className: `ce-tool ce-tiny${state.regex ? " ce-tool-on" : ""}`, type: "button", title: t("search.regex"), onClick: onToggleRegex }, ".*"),
			h("button", { className: `ce-tool ce-tiny${state.words ? " ce-tool-on" : ""}`, type: "button", title: t("search.words"), onClick: onToggleWords }, "ab |"),
			h("button", { className: "ce-tool ce-tiny", type: "button", title: t("search.run"), onClick: onSubmit }, h(IconSearch)),
		),
		replaceOpen
			? h(
				"div",
				{ className: "ce-search-box" },
				h("input", {
					className: "ce-input ce-search-q",
					type: "text",
					placeholder: t("search.replacePlaceholder"),
					value: replaceText,
					onChange: (event) => { setReplaceText(event.target.value); setConfirmAll(false); },
					onKeyDown: (event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							if (groups.length > 0) void runReplace(groups.map((g) => g.path));
						} else if (event.key === "Escape") {
							event.stopPropagation();
							onClose();
						}
					},
					spellcheck: false,
					autoCapitalize: "off",
					autoComplete: "off",
				}),
				h("button", {
					className: "ce-sk-btn",
					type: "button",
					disabled: replaceBusy || groups.length === 0 || state.query.trim().length < 2,
					title: t("search.replaceAll"),
					onClick: () => {
						if (!confirmAll) {
							setConfirmAll(true);
							return;
						}
						void runReplace(groups.map((g) => g.path));
					},
				}, replaceBusy ? "…" : confirmAll ? t("search.replaceConfirm", { n: groups.length }) : t("search.replaceAll")),
			)
			: null,
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
			groups.map((g) => {
				const isCollapsed = collapsed.has(g.path);
				return h(
					Fragment,
					{ key: g.path },
					h(
						"div",
						{ className: "ce-sgroup-row" },
						h(
							"button",
							{
								type: "button",
								className: "ce-sgroup",
								title: g.path,
								"aria-expanded": isCollapsed ? "false" : "true",
								onClick: () => toggleGroup(g.path),
							},
							h("span", { className: `cet-tw${isCollapsed ? "" : " cet-tw-open"}` }, "▶"),
							h("span", { className: "ce-sgroup-path" }, RelPath(cwd, g.path) || g.path),
							h("span", { className: "ce-sgroup-count" }, String(g.items.length)),
						),
						replaceOpen
							? h("button", {
								type: "button",
								className: "ce-tool ce-tiny ce-sgroup-rep",
								title: t("search.replaceFile"),
								disabled: replaceBusy || state.query.trim().length < 2,
								onClick: () => void runReplace([g.path]),
							}, "⇄")
							: null,
					),
					isCollapsed
						? null
						: g.items.map((r) =>
							h(
								Fragment,
								{ key: `${r.path}:${r.line}` },
								h(
									"div",
									{ className: "ce-srow" },
									h("button", {
										type: "button",
										className: "ce-sctx-toggle",
										title: t("search.ctx"),
										"aria-expanded": expanded.has(ctxKey(r)) ? "true" : "false",
										onClick: () => toggleCtx(r),
									}, expanded.has(ctxKey(r)) ? "▾" : "▸"),
									h(
										"button",
										{ type: "button", className: "ce-sresult", onClick: () => onPick(r) },
										h("span", { className: "ce-sloc" }, `:${r.line}`),
										h("span", { className: "ce-stext" }, hl(r.text)),
									),
								),
								expanded.has(ctxKey(r)) ? renderCtx(r) : null,
							),
						),
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
