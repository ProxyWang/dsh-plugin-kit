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
 * scroll view and the word-wrap flow view. Go identifiers/types/keywords get
 * data-ce-* hooks for click-to-jump; `flash` marks one exact token occurrence.
 */
export function buildTokenCells(text, lang, state, lineNo, flash) {
	const runs = tokenizeLine(text, lang, state);
	const isGo = lang === "go";
	return runs.map((run, r) => {
		// word-level highlight when the flash names a token at this column
		const marked = flash && flash.col != null && run.startCol === flash.col && flash.word && run.s === flash.word;
		return run.cls === "ce-id" || run.cls === "ce-type" || run.cls === "ce-kw"
			? h(
				"span",
				{
					key: r,
					className: `ce-t ${run.cls}${isGo ? " ce-jump" : ""}${marked ? " ce-mark" : ""}`,
					...(isGo ? { "data-ce-l": lineNo, "data-ce-c": run.startCol ?? 1, "data-ce-w": run.word ?? "" } : {}),
				},
				run.s,
			)
			: h("span", { key: r, className: `ce-t ${run.cls}${marked ? " ce-mark" : ""}` }, run.s);
	});
}

/** Rows (syntax-highlighted lines + collapsed-deletion bars) and blame rows for the current viewport. */
export function computeVisible({ doc, scroll, viewport, diagByLine, flash, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit, onDelPreview }) {
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
		const cells = buildTokenCells(doc.lines[i], lang, doc.states[i], i + 1, lineFlash);
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
export function computeGutter({ doc, scroll, viewport, cursor, findLines, diffMarks, delAnchors }) {
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
export function computeWrapRows({ doc, flash, diffMarks, delAnchors, delGroups, cursor, findLines, t, onDelPreview }) {
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
		const cells = buildTokenCells(doc.lines[i], lang, doc.states[i], lineNo, lineFlash);
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
