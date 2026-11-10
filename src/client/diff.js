/* ---------------- unified diff ---------------- */

import { Fragment, h, useMemo } from "./react.js";

export function parseDiff(text) {
	const lines = text.split("\n");
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

export function DiffView({ t, diff, onClose, onOpenSource, canSource }) {
	const rows = useMemo(() => parseDiff(diff.text ?? ""), [diff.text]);
	const shown = rows.length > 4000 ? rows.slice(0, 4000) : rows;
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
				: diff.scope === "call" ? t("diff.scopeCall") : t("diff.scopeWorking")),
			diff.stats ? h("span", { className: "ce-chip" }, `+${diff.stats.add} −${diff.stats.del}`) : null,
			diff.untracked ? h("span", { className: "ce-chip" }, t("diff.untracked")) : null,
			diff.note ? h("span", { className: "ce-chip" }, diff.note) : null,
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
					{ className: "ce-code" },
					shown.map((row, i) =>
						h(
							"div",
							{
								key: i,
								className: `ce-dline ce-dline-${row.kind}${onOpenSource && (row.newLine !== void 0 || row.oldLine !== void 0) ? " ce-dline-click" : ""}`,
								...(onOpenSource && (row.newLine !== void 0 || row.oldLine !== void 0)
									? { title: t("diff.openSourceTitle"), onClick: () => onOpenSource(row.newLine ?? row.oldLine) }
									: {}),
							},
							diff.gutter === false ? null : h("span", { className: "ce-dnum" }, row.oldLine ?? ""),
							diff.gutter === false ? null : h("span", { className: "ce-dnum" }, row.newLine ?? ""),
							h("span", { className: "ce-dtext" }, `${row.kind === "add" ? "+" : row.kind === "del" ? "−" : row.kind === "hunk" ? "" : " "} ${row.text}`),
						),
					),
					shown.length < rows.length ? h("div", { className: "ce-dline ce-dline-meta" }, "… display truncated …") : null,
				),
			),
	);
}
