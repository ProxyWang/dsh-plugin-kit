/* ---------------- virtual-scroll row builders for the code view ----------------
 *
 * Pure render computations extracted from CodeBody's memos so they stay testable
 * and the orchestrator component keeps only state wiring. Both builders share the
 * same y-layout: ROW per source line plus one ROW per collapsed deletion anchor
 * at or above the line (delAnchors must be sorted ascending).
 */

import { h } from "./react.js";
import { ROW } from "./constants.js";
import { langFor, tokenizeLine } from "./highlight.js";
import { relTime } from "./pathtools.js";

/**
 * Syntax-highlighted token spans for one source line, shared by the virtual
 * scroll view and the word-wrap flow view. Identifiers of LSP-backed languages
 * (Go, TS/JS, Python) get data-ce-* hooks for click-to-jump; `flash` marks one
 * exact token occurrence; `current` (the find widget's active match) splits the
 * overlapping token runs so the range gets a solid current-match highlight,
 * the way VS Code distinguishes the current match from the other matches.
 */
export function buildTokenCells(text, lang, state, lineNo, flash, current) {
	const runs = tokenizeLine(text, lang, state);
	const jumpable = lang === "go" || lang === "js" || lang === "py";
	const curStart = current && current.line === lineNo ? (current.col ?? 1) - 1 : null;
	const curEnd = curStart !== null ? curStart + String(current.text ?? "").length : null;
	const cells = [];
	runs.forEach((run, r) => {
		// word-level highlight when the flash names a token at this column
		const marked = flash && flash.col != null && run.startCol === flash.col && flash.word && run.s === flash.word;
		const segments = curStart !== null ? splitRunAt(run, curStart, curEnd) : [{ s: run.s, in: false, offset: 0 }];
		for (const seg of segments) {
			const cls = `ce-t ${run.cls}${jumpable ? " ce-jump" : ""}${marked ? " ce-mark" : ""}${seg.in ? " ce-mark-cur" : ""}`;
			const hookable = run.cls === "ce-id" || run.cls === "ce-type" || run.cls === "ce-kw";
			cells.push(h(
				"span",
				{
					key: `${r}:${seg.offset}`,
					className: cls,
					...(hookable && jumpable ? { "data-ce-l": lineNo, "data-ce-c": (run.startCol ?? 1) + seg.offset, "data-ce-w": run.word ?? "" } : {}),
				},
				seg.s,
			));
		}
	});
	return cells;
}

/** Split one token run around [start, end) character offsets; empty parts drop. */
function splitRunAt(run, start, end) {
	const rs = (run.startCol ?? 1) - 1;
	const re = rs + run.s.length;
	if (end <= rs || start >= re) return [{ s: run.s, in: false, offset: 0 }];
	const from = Math.max(0, start - rs);
	const to = Math.min(run.s.length, end - rs);
	const out = [];
	if (from > 0) out.push({ s: run.s.slice(0, from), in: false, offset: 0 });
	if (to > from) out.push({ s: run.s.slice(from, to), in: true, offset: from });
	if (to < run.s.length) out.push({ s: run.s.slice(to), in: false, offset: to });
	return out;
}

/** Rows (syntax-highlighted lines + collapsed-deletion bars) and blame rows for the current viewport. */
export function computeVisible({ doc, scroll, viewport, diagByLine, flash, current, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit, onDelPreview }) {
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
		const lineFlash = flash && flash.line === i + 1 ? flash : null;
		const lineChanged = diffMarks !== null && diffMarks.has(i + 1);
		const cells = buildTokenCells(doc.lines[i], lang, doc.states[i], i + 1, lineFlash, current);
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
			onClick: () => onDelPreview({ anchor: a, lines: deleted }),
		}, `− ${deleted.length} ${t("diff.deletedLines")}`));
	});
	return { rows, blameRows, start, end: doc.lines.length, total: (doc.lines.length + 2) * ROW + delAnchors.length * ROW };
}

/** Line-number gutter rows for the current viewport, mirroring computeVisible's y-layout. */
export function computeGutter({ doc, scroll, viewport, cursor, findLines, current, diffMarks, delAnchors }) {
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
				{ key: i, className: `ce-gline${cursor?.line === i + 1 ? " ce-gline-active" : ""}${findLines.has(i + 1) ? " ce-gline-find" : ""}${current?.line === i + 1 ? " ce-gline-find-cur" : ""}${diffMarks !== null && diffMarks.has(i + 1) ? " ce-gline-changed" : ""}`, style: { transform: `translateY(${yOf(i)}px)` } },
				String(i + 1),
			),
		);
	}
	return rows;
}

/** Word-wrap rendering cap: beyond this the flow layout stays off (perf). */
export const WRAP_LINE_CAP = 5000;

/**
 * Word-wrap mode rows: a plain document flow (no absolute positioning, no
 * virtualization) where each source line is a flex row with an inline line
 * number, so wrapped visual lines keep their gutter aligned for free.
 * Collapsed-deletion bars interleave at their anchors. `capped` reports
 * whether the document exceeds WRAP_LINE_CAP and only its head is rendered.
 */
export function computeWrapRows({ doc, flash, current, diffMarks, delAnchors, delGroups, cursor, findLines, t, onDelPreview }) {
	if (!doc) return null;
	const lang = langFor(doc.path);
	const total = doc.lines.length;
	const limit = Math.min(total, WRAP_LINE_CAP);
	const rows = [];
	let delIdx = 0;
	const pushDelBar = (anchor) => {
		const deleted = delGroups?.get(anchor) ?? [];
		rows.push(h("button", {
			key: `del:${anchor}`,
			type: "button",
			className: "ce-delbar ce-delbar-flow",
			title: t("diff.deletedAt"),
			onClick: () => onDelPreview({ anchor, lines: deleted }),
		}, `− ${deleted.length} ${t("diff.deletedLines")}`));
	};
	for (let i = 0; i < limit; i++) {
		while (delIdx < delAnchors.length && delAnchors[delIdx] <= i + 1) pushDelBar(delAnchors[delIdx++]);
		const lineNo = i + 1;
		const lineFlash = flash && flash.line === lineNo ? flash : null;
		const lineChanged = diffMarks !== null && diffMarks.has(lineNo);
		const cells = buildTokenCells(doc.lines[i], lang, doc.states[i], lineNo, lineFlash, current);
		rows.push(h("div", {
			key: i,
			"data-wl": lineNo,
			className: `ce-wline${lineFlash ? " ce-flash" : ""}${lineChanged ? " ce-line-changed" : ""}`,
		},
		h("span", {
			className: `ce-wlineno${cursor?.line === lineNo ? " ce-wlineno-active" : ""}${findLines.has(lineNo) ? " ce-gline-find" : ""}${lineChanged ? " ce-gline-changed" : ""}`,
		}, String(lineNo)),
		h("span", { className: "ce-wtext" }, cells.length ? cells : " "),
		));
	}
	while (delIdx < delAnchors.length) pushDelBar(delAnchors[delIdx++]);
	return { rows, capped: total > limit };
}

/* ---------------- find-in-file matcher (⌘F widget) ---------------- */

/** Escape a literal string for use inside a RegExp. */
export function escapeRe(s) {
	return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compile the find-widget query into a global RegExp.
 * opts: {regex, caseSensitive, words}. Literal queries are escaped; `words`
 * wraps the pattern in \b boundaries (both modes); case-insensitive unless
 * caseSensitive. Returns null for an empty query, false for an invalid
 * regex (the UI shows a hint instead of matching), else the RegExp.
 */
export function compileFindRe(query, opts) {
	if (!query) return null;
	let src = String(query);
	if (!opts?.regex) src = escapeRe(src);
	if (opts?.words) src = `\\b(?:${src})\\b`;
	try {
		return new RegExp(src, opts?.caseSensitive ? "g" : "gi");
	} catch {
		return false;
	}
}

/** All non-overlapping match ranges [{start, end, text}] in one line; zero-length matches are skipped. */
export function findRangesInLine(line, re) {
	const out = [];
	if (!re || re === true || typeof re.exec !== "function") return out;
	re.lastIndex = 0;
	let m;
	let guard = 0;
	while ((m = re.exec(line)) !== null && guard++ < 500) {
		if (m[0] === "") {
			re.lastIndex++;
			continue;
		}
		out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
	}
	return out;
}

/**
 * Preserve-case replacement, ported from VS Code's base/common/search.ts
 * (buildReplaceStringWithCasePreserved): ALL-CAPS matches upper-case the
 * replacement, all-lower lower-cases it, capitalized matches capitalize it
 * (mirrored for lower-first); hyphen/underscore segmented identifiers apply
 * the same rules per segment. Applied per match and only to static
 * replacement text — once $-group references exist VS Code ignores it too.
 */
export function preserveCaseReplace(matchText, pattern) {
	const match = String(matchText ?? "");
	const repl = String(pattern ?? "");
	if (match === "") return repl;
	const segmented = (sep) => match.includes(sep) && repl.includes(sep) && match.split(sep).length === repl.split(sep).length;
	const hasHyphens = segmented("-");
	const hasUnderscores = segmented("_");
	if (hasHyphens && !hasUnderscores) return segmentReplace(match, repl, "-");
	if (!hasHyphens && hasUnderscores) return segmentReplace(match, repl, "_");
	if (match.toUpperCase() === match) return repl.toUpperCase();
	if (match.toLowerCase() === match) return repl.toLowerCase();
	if (/[A-Z]/.test(match[0]) && repl.length > 0) return repl[0].toUpperCase() + repl.slice(1);
	if (match[0].toUpperCase() !== match[0] && repl.length > 0) return repl[0].toLowerCase() + repl.slice(1);
	return repl;
}

function segmentReplace(match, repl, sep) {
	const matchParts = match.split(sep);
	return repl.split(sep).map((part, i) => preserveCaseReplace(matchParts[i] ?? "", part)).join(sep);
}

/**
 * Find-widget replacement (VS Code's ⌘F replace row): apply `replaceText` to
 * the find matches. With `all` every match is replaced, otherwise only
 * matches[index]. For regex finds with $-references each match text is re-run
 * through the pattern so $1/$& expand; otherwise literal finds insert
 * `replaceText` verbatim, or case-preserved per match when `preserveCase` is
 * on (VS Code's AB toggle). Rows are spliced right-to-left per line so earlier
 * column offsets stay valid. Returns {lines, count} or null when nothing was
 * replaced (no matches, bad index, or stale positions after external change).
 */
export function applyReplace(lines, matches, replaceText, { all = false, index = 0, regexRe = null, preserveCase = false } = {}) {
	if (!Array.isArray(lines) || !Array.isArray(matches) || matches.length === 0) return null;
	const targets = all ? matches : [matches[index]].filter(Boolean);
	if (targets.length === 0) return null;
	const replacementFor = (match) => {
		const text = String(replaceText ?? "");
		if (regexRe && typeof regexRe.source === "string" && text.includes("$")) {
			try {
				const flags = String(regexRe.flags ?? "").replace(/g/g, "");
				return String(match.text ?? "").replace(new RegExp(regexRe.source, flags), text);
			} catch {
				return text;
			}
		}
		return preserveCase ? preserveCaseReplace(match.text, text) : text;
	};
	const next = lines.slice();
	const byLine = new Map();
	for (const m of targets) {
		const rows = byLine.get(m.line) ?? [];
		rows.push(m);
		byLine.set(m.line, rows);
	}
	let count = 0;
	for (const [lineNo, rows] of byLine) {
		const at = lineNo - 1;
		if (at < 0 || at >= next.length) continue;
		let text = String(next[at] ?? "");
		rows.sort((a, b) => (b.col ?? 1) - (a.col ?? 1));
		for (const m of rows) {
			const start = Math.max(0, (m.col ?? 1) - 1);
			const len = String(m.text ?? "").length;
			if (len === 0 || text.slice(start, start + len) !== m.text) continue; // stale match — skip
			text = text.slice(0, start) + replacementFor(m) + text.slice(start + len);
			count++;
		}
		next[at] = text;
	}
	if (count === 0) return null;
	return { lines: next, count };
}
