/* ---------------- draft vs disk: line diff for the external-conflict path ----------------
 *
 * When the file changed on disk while a draft is open, "keep editing" used to
 * be a dead end: every later save was refused by the baseMtime guard and the
 * only way out discarded the draft. This module builds the unified diff the
 * conflict banner now offers ("compare with disk"), so the user can see both
 * sides before choosing. Pure functions only — the view reuses DiffView.
 */

/**
 * Line-level LCS diff between two texts, emitted as unified-diff rows with
 * @@ hunk headers and 3 lines of context (git's default). Inputs are capped
 * by the caller (the editor refuses drafts over 2 MiB / 50k lines); the LCS
 * table is O(n·m) memory, so very large pairs fall back to a whole-file
 * replace hunk instead of allocating a giant table.
 *
 * @param oldText - disk content (the "a" side)
 * @param newText - draft content (the "b" side)
 * @param path - display path for the ---/+++ header
 * @returns {{text: string, add: number, del: number, identical: boolean}}
 */
export function draftDiskDiff(oldText, newText, path = "") {
	const a = splitLines(oldText);
	const b = splitLines(newText);
	if (oldText === newText) return { text: "", add: 0, del: 0, identical: true };
	const ops = a.length * b.length > 4_000_000 ? coarseOps(a, b) : lcsOps(a, b);
	let add = 0;
	let del = 0;
	for (const op of ops) {
		if (op.kind === "add") add++;
		else if (op.kind === "del") del++;
	}
	const name = path || "file";
	const out = [`--- a/${name}`, `+++ b/${name}`];
	// Group ops into hunks with 3 lines of shared context.
	const CTX = 3;
	let i = 0;
	while (i < ops.length) {
		if (ops[i].kind === "ctx") { i++; continue; }
		// Hunk start: back up to CTX context lines.
		let start = i;
		let back = 0;
		while (start > 0 && ops[start - 1].kind === "ctx" && back < CTX) { start--; back++; }
		// Hunk end: extend through changes separated by <= 2*CTX context lines.
		let end = i;
		let j = i;
		while (j < ops.length) {
			if (ops[j].kind !== "ctx") { end = j + 1; j++; continue; }
			let run = 0;
			let k = j;
			while (k < ops.length && ops[k].kind === "ctx") { run++; k++; }
			if (k < ops.length && run <= CTX * 2) { j = k; continue; }
			end = Math.min(ops.length, j + CTX);
			break;
		}
		if (end <= i) end = Math.min(ops.length, i + 1);
		let oldLine = 1;
		let newLine = 1;
		for (let k = 0; k < start; k++) {
			if (ops[k].kind !== "add") oldLine++;
			if (ops[k].kind !== "del") newLine++;
		}
		let oldCount = 0;
		let newCount = 0;
		for (let k = start; k < end; k++) {
			if (ops[k].kind !== "add") oldCount++;
			if (ops[k].kind !== "del") newCount++;
		}
		out.push(`@@ -${oldLine},${oldCount} +${newLine},${newCount} @@`);
		for (let k = start; k < end; k++) {
			const op = ops[k];
			out.push(op.kind === "add" ? `+${op.text}` : op.kind === "del" ? `-${op.text}` : ` ${op.text}`);
		}
		i = end;
	}
	return { text: out.join("\n"), add, del, identical: false };
}

function splitLines(text) {
	const s = String(text ?? "");
	if (s === "") return [];
	const lines = s.split("\n");
	if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
	return lines;
}

/** Classic LCS backtrack → ctx/del/add op list in order. */
function lcsOps(a, b) {
	const n = a.length;
	const m = b.length;
	// dp[i][j] = LCS length of a[i:] and b[j:]
	const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}
	const ops = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] === b[j]) { ops.push({ kind: "ctx", text: a[i] }); i++; j++; }
		else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ kind: "del", text: a[i] }); i++; }
		else { ops.push({ kind: "add", text: b[j] }); j++; }
	}
	while (i < n) { ops.push({ kind: "del", text: a[i++] }); }
	while (j < m) { ops.push({ kind: "add", text: b[j++] }); }
	return ops;
}

/** Fallback for huge pairs: trim common prefix/suffix, replace the middle. */
function coarseOps(a, b) {
	const ops = [];
	let p = 0;
	while (p < a.length && p < b.length && a[p] === b[p]) { ops.push({ kind: "ctx", text: a[p] }); p++; }
	let s = 0;
	while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
	for (let i = p; i < a.length - s; i++) ops.push({ kind: "del", text: a[i] });
	for (let j = p; j < b.length - s; j++) ops.push({ kind: "add", text: b[j] });
	for (let k = a.length - s; k < a.length; k++) ops.push({ kind: "ctx", text: a[k] });
	return ops;
}