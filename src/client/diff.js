/* ---------------- diff views: unified + side-by-side, word-level marks, change navigation ---------------- */

import { Fragment, h, useEffect, useMemo, useRef, useState } from "./react.js";

const SBS_KEY = "dsh.ce.diff.sbs.v1";

function loadSbs() {
	try {
		return localStorage.getItem(SBS_KEY) === "1";
	} catch {
		return false;
	}
}

export function parseDiff(text) {
	const lines = text.split("\n");
	// Git diff text ends with a newline; drop the trailing empty segment so it
	// does not render as a phantom context row with a consumed line number.
	if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
	const rows = [];
	let oldLine = 0;
	let newLine = 0;
	for (const line of lines) {
		if (line.startsWith("@@")) {
			const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
			if (match) {
				oldLine = Number(match[1]);
				newLine = Number(match[2]);
			}
			rows.push({ kind: "hunk", text: line, newStart: match ? Number(match[2]) : void 0 });
			continue;
		}
		if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("new file") || line.startsWith("deleted file") || line.startsWith("similarity") || line.startsWith("rename")) {
			rows.push({ kind: "meta", text: line });
			continue;
		}
		if (line.startsWith("+")) {
			rows.push({ kind: "add", text: line.slice(1), newLine: newLine++ });
			continue;
		}
		if (line.startsWith("-")) {
			rows.push({ kind: "del", text: line.slice(1), oldLine: oldLine++ });
			continue;
		}
		if (line.startsWith("\\")) {
			rows.push({ kind: "meta", text: line });
			continue;
		}
		rows.push({ kind: "ctx", text: line.slice(1), oldLine: oldLine++, newLine: newLine++ });
	}
	return rows;
}

/** New-side line numbers a unified diff touches (adds and the new half of modifications). */
export function changedNewLines(text) {
	const rows = parseDiff(text ?? "");
	const set = new Set();
	for (const row of rows) {
		if (row.kind === "add" && row.newLine !== void 0) set.add(row.newLine);
	}
	return set;
}

/**
 * Group consecutive deleted lines and anchor each group to the new-side line
 * it disappeared before, so the whole-file view can insert a collapsed
 * "−N deleted" bar at the right place.
 */
export function deletedGroups(text) {
	const rows = parseDiff(text ?? "");
	const groups = new Map();
	let pending = [];
	let lastNew = 0;
	const flush = (anchor) => {
		if (pending.length === 0) return;
		const key = Math.max(1, anchor);
		const existing = groups.get(key);
		if (existing) existing.push(...pending);
		else groups.set(key, [...pending]);
		pending = [];
	};
	for (const row of rows) {
		if (row.kind === "del") {
			pending.push(row.text);
			continue;
		}
		if (row.kind === "add" || row.kind === "ctx") {
			const n = row.newLine ?? lastNew + 1;
			flush(n);
			lastNew = n;
			continue;
		}
		if (row.kind === "hunk") {
			flush(lastNew + 1);
			lastNew = row.newStart ?? lastNew;
		}
	}
	flush(lastNew + 1);
	return groups;
}

/**
 * Merge changed-line points into scrollbar blobs (VSCode diff-marker style):
 * points within 2 lines join into one blob; a blob touching a deletion renders red.
 */
export function changeBlobs(marks, delKeys) {
	const points = [];
	if (marks) for (const n of marks) points.push({ line: n, kind: "mod" });
	if (delKeys) for (const n of delKeys) points.push({ line: n, kind: "del" });
	points.sort((a, b) => a.line - b.line);
	const blobs = [];
	for (const p of points) {
		const last = blobs[blobs.length - 1];
		if (last !== void 0 && p.line - last.end <= 2) {
			last.end = Math.max(last.end, p.line);
			if (p.kind === "del") last.kind = "del";
		} else {
			blobs.push({ start: p.line, end: p.line, kind: p.kind });
		}
	}
	return blobs;
}

/**
 * Align unified rows for side-by-side rendering: a del-run directly followed
 * by an add-run pairs up index-by-index into "mod" rows (unmatched tails stay
 * pure del/add); ctx/hunk/meta rows span both sides. Left/right keep the
 * original row objects, so identity-keyed mark maps work in both views.
 */
export function pairRows(rows) {
	const out = [];
	let i = 0;
	while (i < rows.length) {
		const row = rows[i];
		if (row.kind === "del") {
			const dels = [];
			while (i < rows.length && rows[i].kind === "del") dels.push(rows[i++]);
			const adds = [];
			while (i < rows.length && rows[i].kind === "add") adds.push(rows[i++]);
			const n = Math.max(dels.length, adds.length);
			for (let j = 0; j < n; j++) {
				const left = dels[j] ?? null;
				const right = adds[j] ?? null;
				out.push({ kind: left && right ? "mod" : left ? "del" : "add", left, right });
			}
			continue;
		}
		if (row.kind === "add") {
			out.push({ kind: "add", left: null, right: row });
			i++;
			continue;
		}
		out.push({ kind: row.kind, left: row, right: row });
		i++;
	}
	return out;
}

/** Words / whitespace runs / single punctuation chars, for token-level diffing. */
function diffTokens(text) {
	return text.match(/[A-Za-z0-9_$]+|\s+|[^\sA-Za-z0-9_$]/g) ?? [];
}

/**
 * Word-level changed ranges between two versions of one line: trim the common
 * token prefix/suffix, then map back to character offsets. An empty range
 * (start === end) is a pure insertion point. Returns null for identical text.
 */
export function intraLineDelta(a, b) {
	if (typeof a !== "string" || typeof b !== "string" || a === b) return null;
	const ta = diffTokens(a);
	const tb = diffTokens(b);
	const min = Math.min(ta.length, tb.length);
	let p = 0;
	while (p < min && ta[p] === tb[p]) p++;
	let s = 0;
	while (s < min - p && ta[ta.length - 1 - s] === tb[tb.length - 1 - s]) s++;
	let prefixLen = 0;
	for (let k = 0; k < p; k++) prefixLen += ta[k].length;
	let suffixA = 0;
	for (let k = ta.length - s; k < ta.length; k++) suffixA += ta[k].length;
	let suffixB = 0;
	for (let k = tb.length - s; k < tb.length; k++) suffixB += tb[k].length;
	const oldStart = prefixLen;
	const oldEnd = a.length - suffixA;
	const newStart = prefixLen;
	const newEnd = b.length - suffixB;
	if (oldStart === oldEnd && newStart === newEnd) return null;
	return { oldStart, oldEnd, newStart, newEnd };
}

/**
 * Per-row intra-line mark ranges for a unified row list: consecutive del/add
 * runs pair index-by-index (like pairRows) and each paired couple gets its
 * word-level delta. Keyed by row-object identity so pairRows output (which
 * reuses the same row objects) can look marks up in either view mode.
 */
export function intraMarks(rows) {
	const marks = new Map();
	let i = 0;
	while (i < rows.length) {
		if (rows[i].kind !== "del") {
			i++;
			continue;
		}
		const dels = [];
		while (i < rows.length && rows[i].kind === "del") dels.push(rows[i++]);
		const adds = [];
		while (i < rows.length && rows[i].kind === "add") adds.push(rows[i++]);
		const n = Math.min(dels.length, adds.length);
		for (let j = 0; j < n; j++) {
			const d = intraLineDelta(dels[j].text, adds[j].text);
			if (!d) continue;
			marks.set(dels[j], { start: d.oldStart, end: d.oldEnd });
			marks.set(adds[j], { start: d.newStart, end: d.newEnd });
		}
	}
	return marks;
}

export function DiffView({ t, diff, onClose, onOpenSource, canSource }) {
	const rows = useMemo(() => parseDiff(diff.text ?? ""), [diff.text]);
	const shown = rows.length > 4000 ? rows.slice(0, 4000) : rows;
	const marks = useMemo(() => intraMarks(shown), [shown]);
	const [sbs, setSbs] = useState(loadSbs);
	const [navIdx, setNavIdx] = useState(-1);
	const containerRef = useRef(null);
	const paired = useMemo(() => (sbs ? pairRows(shown) : null), [sbs, shown]);
	// Change anchors for ↑↓ navigation: unified → start of each del/add run;
	// side-by-side → every aligned non-context row.
	const anchors = useMemo(() => {
		const out = [];
		if (sbs) {
			(paired ?? []).forEach((p, i) => {
				if (p.kind === "mod" || p.kind === "add" || p.kind === "del") out.push(i);
			});
			return out;
		}
		for (let i = 0; i < shown.length; i++) {
			const k = shown[i].kind;
			if ((k === "add" || k === "del") && (i === 0 || (shown[i - 1].kind !== "add" && shown[i - 1].kind !== "del"))) out.push(i);
		}
		return out;
	}, [sbs, paired, shown]);
	useEffect(() => {
		setNavIdx(-1);
	}, [diff.text, sbs]);
	const toggleSbs = () => {
		const next = !sbs;
		setSbs(next);
		try {
			localStorage.setItem(SBS_KEY, next ? "1" : "0");
		} catch { /* storage unavailable */ }
	};
	const navTo = (delta) => {
		if (anchors.length === 0) return;
		let next = navIdx + delta;
		if (next < 0) next = anchors.length - 1;
		if (next >= anchors.length) next = 0;
		setNavIdx(next);
		const c = containerRef.current;
		const node = c?.querySelector(`[data-dr="${anchors[next]}"]`);
		if (!c || !node) return;
		const nr = node.getBoundingClientRect();
		const cr = c.getBoundingClientRect();
		c.scrollTop += nr.top - cr.top - (c.clientHeight - nr.height) / 2;
	};
	// One line of text with its word-level changed range emphasized.
	const renderMarkedText = (row, withSign) => {
		const sign = withSign ? (row.kind === "add" ? "+ " : row.kind === "del" ? "− " : row.kind === "hunk" ? "" : " ") : "";
		const mark = marks.get(row);
		if (!mark) {
			const plain = `${sign}${row.text}`;
			return plain === "" ? " " : plain;
		}
		const cls = row.kind === "del" ? "ce-wd ce-wd-del" : "ce-wd ce-wd-add";
		const before = `${sign}${row.text.slice(0, mark.start)}`;
		const mid = row.text.slice(mark.start, mark.end);
		const after = row.text.slice(mark.end);
		return mid === ""
			? [before, h("span", { key: "m", className: `${cls} ce-wd-zero` }, ""), after]
			: [before, h("span", { key: "m", className: cls }, mid), after];
	};
	const renderUniRow = (row, i) => {
		const clickable = Boolean(onOpenSource) && (row.newLine !== void 0 || row.oldLine !== void 0);
		return h(
			"div",
			{
				key: i,
				"data-dr": i,
				className: `ce-dline ce-dline-${row.kind}${clickable ? " ce-dline-click" : ""}${anchors[navIdx] === i ? " ce-dnav" : ""}`,
				...(clickable ? { title: t("diff.openSourceTitle"), onClick: () => onOpenSource(row.newLine ?? row.oldLine) } : {}),
			},
			diff.gutter === false ? null : h("span", { className: "ce-dnum" }, row.oldLine ?? ""),
			diff.gutter === false ? null : h("span", { className: "ce-dnum" }, row.newLine ?? ""),
			h("span", { className: "ce-dtext" }, renderMarkedText(row, true)),
		);
	};
	const renderSbsRow = (p, i) => {
		const navCls = anchors[navIdx] === i ? " ce-dnav" : "";
		if (p.kind === "hunk" || p.kind === "meta") {
			return h("div", { key: i, "data-dr": i, className: `ce-sbsrow ce-sbsrow-full ce-dline-${p.kind}${navCls}` },
				h("span", { className: "ce-sbscell" }, p.left.text === "" ? " " : p.left.text));
		}
		const jumpLine = p.right?.newLine ?? p.left?.oldLine;
		const clickable = Boolean(onOpenSource) && jumpLine !== void 0;
		return h(
			"div",
			{
				key: i,
				"data-dr": i,
				className: `ce-sbsrow${clickable ? " ce-dline-click" : ""}${navCls}`,
				...(clickable ? { title: t("diff.openSourceTitle"), onClick: () => onOpenSource(jumpLine) } : {}),
			},
			h("span", { className: "ce-sbsnum" }, p.kind === "add" ? "" : p.left?.oldLine ?? ""),
			h("span", { className: `ce-sbscell${p.kind === "del" || p.kind === "mod" ? " ce-sbs-del" : ""}${p.left === null ? " ce-sbs-empty" : ""}` }, p.left ? renderMarkedText(p.left, false) : ""),
			h("span", { className: "ce-sbsnum" }, p.kind === "del" ? "" : p.right?.newLine ?? ""),
			h("span", { className: `ce-sbscell${p.kind === "add" || p.kind === "mod" ? " ce-sbs-add" : ""}${p.right === null ? " ce-sbs-empty" : ""}` }, p.right ? renderMarkedText(p.right, false) : ""),
		);
	};
	return h(
		Fragment,
		null,
		h(
			"div",
			{ className: "ce-head" },
			h("button", { type: "button", className: "ce-tool ce-tiny", title: `${t("diff.back")} (Esc)`, onClick: onClose }, "←"),
			h("span", { className: "ce-head-path" }, diff.path),
			h("span", { className: "ce-chip" }, diff.scope === "commit"
				? `${t("diff.scopeCommit")} ${diff.commit ?? ""}`
				: diff.scope === "branch" ? `${t("diff.scopeBranch")} ${diff.base ? `vs ${diff.base}` : ""}`
				: diff.scope === "staged" ? t("diff.scopeStaged")
				: diff.scope === "call" ? t("diff.scopeCall") : t("diff.scopeWorking")),
			diff.stats ? h("span", { className: "ce-chip" }, `+${diff.stats.add} −${diff.stats.del}`) : null,
			diff.untracked ? h("span", { className: "ce-chip" }, t("diff.untracked")) : null,
			diff.note ? h("span", { className: "ce-chip" }, diff.note) : null,
			h("span", { className: "ce-spacer" }),
			h("button", { type: "button", className: "ce-tool ce-tiny", title: t("diff.prevChange"), disabled: anchors.length === 0, onClick: () => navTo(-1) }, "↑"),
			h("button", { type: "button", className: "ce-tool ce-tiny", title: t("diff.nextChange"), disabled: anchors.length === 0, onClick: () => navTo(1) }, "↓"),
			h("button", { type: "button", className: `ce-tool ce-tiny${sbs ? " ce-tool-on" : ""}`, title: sbs ? t("diff.toUnified") : t("diff.toSide"), onClick: toggleSbs }, sbs ? "≡" : "▥"),
			canSource && typeof onOpenSource === "function"
				? h("button", { type: "button", className: "ce-link", title: t("diff.openSourceTitle"), onClick: () => onOpenSource(null) }, t("diff.openSource"))
				: null,
		),
		rows.length === 0
			? h("div", { className: "ce-empty" }, diff.text === "" ? t("diff.empty") : `${t("error")}: ${diff.error ?? ""}`)
			: h(
				"div",
				{ className: "ce-scroll ce-code-wrap" },
				h(
					"div",
					{ className: "ce-code", ref: containerRef },
					sbs
						? (paired ?? []).map(renderSbsRow)
						: shown.map(renderUniRow),
					shown.length < rows.length ? h("div", { className: "ce-dline ce-dline-meta" }, "… display truncated …") : null,
				),
			),
	);
}
