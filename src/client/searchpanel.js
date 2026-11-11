/* ---------------- workspace search panel: query UI, match highlighting, context expansion, replace ---------------- */

import { Fragment, h, useEffect, useMemo, useRef, useState } from "./react.js";
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

export function SearchPanel({ t, cwd, state, onQuery, onInclude, onDirectory, onToggleRegex, onToggleWords, onSubmit, onPick, onClose, onNotify }) {
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
		h("div", { className: "ce-search-scope" },
			h("strong", null, t(state.scope?.kind === "changes" ? "search.changesAction" : state.scope?.kind === "directory" ? "search.directoryAction" : "changes.searchWorkspace")),
			h("span", null, state.scope?.kind === "changes"
				? t("search.changesHint")
				: state.scope?.kind === "directory" ? state.scope.directory : t("search.workspaceScope")),
			h("button", { type: "button", className: "ce-tool", "aria-label": t("close"), title: t("close"), onClick: onClose }, "✕"),
		),
		state.scope?.kind !== "changes" ? h("label", { className: "ce-search-directory" },
			h("span", null, t("search.directoryLabel")),
			h("input", { className: "ce-input", "aria-label": t("search.directoryLabel"), placeholder: t("search.directoryPlaceholder"), value: state.scope?.directory ?? "", onChange: (e) => onDirectory?.(e.target.value) }),
		) : null,
		state.scope?.kind === "changes" && state.scopeInfo?.files === 0 ? h("div", { className: "ce-note", role: "status" }, t("search.noChangedFiles")) : null,

		h(
			"div",
			{ className: "ce-search-box" },
			h("button", { className: `ce-tool ce-tiny${replaceOpen ? " ce-tool-on" : ""}`, type: "button", title: t("search.replaceToggle"), onClick: () => setReplaceOpen((v) => !v) }, replaceOpen ? "▾" : "▸"),
			h("input", {
				ref: inputRef,
				className: "ce-input ce-search-q",
				type: "text",
				placeholder: t(state.scope?.kind === "changes" ? "search.changesPlaceholder" : "search.placeholder"),
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
