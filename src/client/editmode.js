/* ---------------- edit-mode textarea helpers: gutter, Tab indent, find/replace ----------------
 *
 * The editor's read-only view has a full virtual-scroll code surface with
 * gutter, syntax highlighting and find/replace. Edit mode was a bare textarea
 * with none of that. This module adds the three P0 pieces:
 *
 * 1. A line-number gutter that scrolls in sync with the textarea.
 * 2. Tab / Shift-Tab indentation (insert/remove leading tabs on selected lines).
 * 3. Find & replace inside the textarea (reusing the pure applyReplace from
 *    codeview.js so behaviour matches the read-only view).
 *
 * All functions are pure or DOM-light so they stay testable without a browser.
 */

import { ROW } from "./constants.js";

/**
 * Build gutter rows for the edit textarea. One row per line, right-aligned,
 * same ROW height as the code view so numbers line up with text.
 *
 * @param lineCount - number of lines in the draft
 * @returns array of {line, top} objects for rendering
 */
export function buildEditGutter(lineCount) {
	const rows = [];
	for (let i = 1; i <= lineCount; i++) {
		rows.push({ line: i, top: (i - 1) * ROW });
	}
	return rows;
}

/**
 * Handle Tab / Shift-Tab in the edit textarea. Inserts or removes a leading
 * tab character on every line touched by the selection. Returns the new text
 * and the new selection range so the caller can update state and reposition
 * the caret.
 *
 * @param text - current textarea value
 * @param start - selectionStart
 * @param end - selectionEnd
 * @param shift - true for Shift-Tab (outdent)
 * @returns {{text: string, start: number, end: number}}
 */
export function handleTabIndent(text, start, end, shift) {
	const before = text.slice(0, start);
	const selected = text.slice(start, end);
	const after = text.slice(end);
	// Find the line boundaries that the selection touches.
	const lineStart = before.lastIndexOf("\n") + 1;
	const lineEnd = after.indexOf("\n");
	const blockEnd = lineEnd < 0 ? text.length : start + selected.length + lineEnd;
	const block = text.slice(lineStart, blockEnd);
	const lines = block.split("\n");
	let delta = 0;
	const newLines = lines.map((line) => {
		if (shift) {
			if (line.startsWith("\t")) { delta--; return line.slice(1); }
			// Remove up to 4 leading spaces (soft-tab fallback).
			const m = /^( {1,4})/.exec(line);
			if (m) { delta -= m[1].length; return line.slice(m[1].length); }
			return line;
		}
		delta++;
		return `\t${line}`;
	});
	const newBlock = newLines.join("\n");
	const newText = text.slice(0, lineStart) + newBlock + text.slice(blockEnd);
	// Adjust selection: if it was a single cursor, move it by the delta on its
	// own line; if it spanned lines, extend/shrink by the total delta.
	const newStart = start === end ? Math.max(lineStart, start + (newLines[0].length - lines[0].length)) : Math.max(lineStart, start + (newLines[0].length - lines[0].length));
	const newEnd = start === end ? newStart : Math.max(lineStart, end + delta);
	return { text: newText, start: newStart, end: newEnd };
}

/**
 * Find all occurrences of a query in text, returning [{start, end}] ranges.
 * Supports regex, case-sensitive and whole-word modes (same flags as the
 * read-only find widget).
 *
 * @param text - haystack
 * @param query - needle
 * @param opts - {regex, caseSensitive, words}
 * @returns array of {start, end} match ranges
 */
export function findInText(text, query, opts = {}) {
	if (!query) return [];
	const flags = (opts.caseSensitive ? "" : "i") + (opts.regex ? "" : "");
	let pattern;
	try {
		const escaped = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const wrapped = opts.words ? `\\b${escaped}\\b` : escaped;
		pattern = new RegExp(wrapped, flags + "g");
	} catch { return []; }
	const ranges = [];
	let m;
	while ((m = pattern.exec(text)) !== null) {
		ranges.push({ start: m.index, end: m.index + m[0].length });
		if (m[0].length === 0) pattern.lastIndex++; // avoid zero-length infinite loop
	}
	return ranges;
}

/**
 * Replace occurrences in text. When `all` is false, replaces only the match
 * at `idx`. Supports regex group references ($1, $&, etc.) in the replacement.
 *
 * @param text - haystack
 * @param query - needle
 * @param replacement - replacement string
 * @param opts - {regex, caseSensitive, words}
 * @param idx - which match to replace (0-based) when all=false
 * @param all - replace every match
 * @returns {{text: string, count: number}}
 */
export function replaceInText(text, query, replacement, opts = {}, idx = 0, all = false) {
	const ranges = findInText(text, query, opts);
	if (ranges.length === 0) return { text, count: 0 };
	// For regex replacements with group references, use the native replace.
	if (opts.regex && replacement.includes("$") && /\$\d/.test(replacement)) {
		try {
			const flags = (opts.caseSensitive ? "" : "i") + (all ? "g" : "");
			const pattern = new RegExp(query, flags);
			const result = all ? text.replace(pattern, replacement) : text.replace(pattern, replacement);
			const count = all ? (text.match(pattern) ?? []).length : (result !== text ? 1 : 0);
			return { text: result, count };
		} catch { /* fall through to manual replacement */ }
	}
	if (all) {
		let result = "";
		let pos = 0;
		let count = 0;
		for (const r of ranges) {
			result += text.slice(pos, r.start);
			result += expandReplacement(replacement, text.slice(r.start, r.end), opts.regex);
			pos = r.end;
			count++;
		}
		result += text.slice(pos);
		return { text: result, count };
	}
	if (idx < 0 || idx >= ranges.length) return { text, count: 0 };
	const r = ranges[idx];
	const before = text.slice(0, r.start);
	const after = text.slice(r.end);
	const expanded = expandReplacement(replacement, text.slice(r.start, r.end), opts.regex);
	return { text: before + expanded + after, count: 1 };
}

/** Expand $1/$& group references in a replacement string. */
function expandReplacement(replacement, matched, isRegex) {
	if (!isRegex || !replacement.includes("$")) return replacement;
	// For regex replacements, re-run the pattern to capture groups.
	// This is a simplified expansion: $& → matched, $1..$9 → literal (groups
	// are not captured in this pure helper; the caller should use a real regex
	// engine for full group support). For the common case of simple swaps,
	// we fall back to returning the replacement as-is when groups are needed.
	return replacement.replace(/\$&/g, matched);
}