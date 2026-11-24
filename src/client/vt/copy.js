/* ---------------- keyboard copy mode: a cursor over stable row identities ----------------
 *
 * Copy mode is the keyboard-only counterpart to mouse selection. It walks the
 * same retained buffer and reports positions as `{ seq, col }`; output keeps
 * arriving while it is open, and eviction only clamps the cursor instead of
 * retargeting it to unrelated text.
 *
 * Motions are deliberately tmux-shaped: h/j/k/l, w/b/e and W/B/E, {/},
 * PageUp/PageDown, g/G, 0/$. A selection starts with v or Space and is yielded
 * with y or Enter. The module is pure (it only reads the screen), so every
 * motion can be asserted in Node.
 */

import { lineSearchText } from "./search.js";
import { selectionText } from "./selection.js";

const WORD = /[\p{L}\p{N}_]/u;

function infoAt(screen, index) {
	const line = screen.lineAt(index);
	return { index, line, ...lineSearchText(line) };
}

function clampIndex(screen, index) {
	return Math.max(0, Math.min(screen.bufferRows - 1, index));
}

/** The last cell column that carries text on a line. */
function lastCol(info) {
	if (info.text.length === 0) return 0;
	const index = info.text.length - 1;
	return (info.columns[index] ?? 0) + (info.widths[index] ?? 1) - 1;
}

/** First text index at or after a cell column. */
function textIndexAt(info, col) {
	for (let i = 0; i < info.columns.length; i++) if (info.columns[i] >= col) return i;
	return info.text.length;
}

function colAt(info, textIndex) {
	if (info.text.length === 0) return 0;
	const index = Math.max(0, Math.min(info.text.length - 1, textIndex));
	return info.columns[index] ?? 0;
}

/**
 * Clamp a copy-mode position to a live row and a valid column.
 * @param screen - the emulator.
 * @param position - `{ seq, col }`.
 * @returns a position that maps to the current buffer.
 */
export function normalizeCopyPosition(screen, position) {
	let index = screen.indexOfSeq(position.seq);
	if (index < 0) index = position.seq < screen.firstSeq ? 0 : clampIndex(screen, screen.bufferRows - 1);
	const info = infoAt(screen, index);
	const col = Math.max(0, Math.min(lastCol(info), Number.isFinite(position.col) ? position.col : 0));
	return { seq: screen.lineSeqAt(index), col };
}

/** Start at the live terminal cursor, or the top row when it is unavailable. */
export function copyStart(screen, offset) {
	const row = clampIndex(screen, screen.topRow(offset) + Math.min(screen.rows - 1, screen.cursor.y));
	const info = infoAt(screen, row);
	return { seq: screen.lineSeqAt(row), col: Math.min(screen.cursor.x, lastCol(info)) };
}

/** Move one row up/down, preserving the column where possible. */
export function moveVertical(screen, position, delta) {
	const index = clampIndex(screen, screen.indexOfSeq(position.seq) + delta);
	const info = infoAt(screen, index);
	return { seq: screen.lineSeqAt(index), col: Math.min(position.col, lastCol(info)) };
}

/** Move one character left/right, crossing line boundaries. */
export function moveHorizontal(screen, position, delta) {
	let index = screen.indexOfSeq(position.seq);
	if (index < 0) return normalizeCopyPosition(screen, position);
	let info = infoAt(screen, index);
	let at = textIndexAt(info, position.col) + delta;
	if (at < 0) {
		index = clampIndex(screen, index - 1);
		info = infoAt(screen, index);
		at = Math.max(0, info.text.length - 1);
	} else if (at >= info.text.length) {
		index = clampIndex(screen, index + 1);
		info = infoAt(screen, index);
		at = 0;
	}
	return { seq: screen.lineSeqAt(index), col: colAt(info, at) };
}

/** Character class used by word motions; big words treat punctuation as word. */
function classAt(char, big) {
	if (char === undefined || /\s/u.test(char)) return 0;
	if (big) return 1;
	return WORD.test(char) ? 1 : 2;
}

function nextWordStart(screen, position, big) {
	const origin = position;
	let index = screen.indexOfSeq(position.seq);
	let info = infoAt(screen, index);
	let at = textIndexAt(info, position.col);
	const startClass = classAt(info.text[at], big);
	if (at < info.text.length) at++;
	while (true) {
		while (at < info.text.length && classAt(info.text[at], big) === startClass && startClass !== 0) at++;
		while (at < info.text.length && classAt(info.text[at], big) === 0) at++;
		if (at < info.text.length) return { seq: screen.lineSeqAt(index), col: colAt(info, at) };
		index = clampIndex(screen, index + 1);
		info = infoAt(screen, index);
		at = 0;
		while (at < info.text.length && classAt(info.text[at], big) === 0) at++;
		if (at < info.text.length) return { seq: screen.lineSeqAt(index), col: colAt(info, at) };
		if (index >= screen.bufferRows - 1) return origin;
	}
}

function previousWordStart(screen, position, big) {
	let index = screen.indexOfSeq(position.seq);
	let info = infoAt(screen, index);
	let at = textIndexAt(info, position.col);
	if (at > 0) at--;
	while (true) {
		while (at > 0 && classAt(info.text[at], big) === 0) at--;
		if (at > 0 || (at === 0 && classAt(info.text[0], big) !== 0)) {
			const cls = classAt(info.text[at], big);
			while (at > 0 && classAt(info.text[at - 1], big) === cls) at--;
			return { seq: screen.lineSeqAt(index), col: colAt(info, at) };
		}
		index = clampIndex(screen, index - 1);
		info = infoAt(screen, index);
		at = Math.max(0, info.text.length - 1);
		if (index === 0 && info.text.length === 0) return { seq: screen.lineSeqAt(index), col: 0 };
	}
}

function nextWordEnd(screen, position, big) {
	const origin = position;
	let index = screen.indexOfSeq(position.seq);
	let info = infoAt(screen, index);
	let at = textIndexAt(info, position.col) + 1;
	while (true) {
		while (at < info.text.length && classAt(info.text[at], big) === 0) at++;
		if (at < info.text.length) {
			const cls = classAt(info.text[at], big);
			while (at + 1 < info.text.length && classAt(info.text[at + 1], big) === cls) at++;
			return { seq: screen.lineSeqAt(index), col: colAt(info, at) };
		}
		index = clampIndex(screen, index + 1);
		info = infoAt(screen, index);
		at = 0;
		if (index >= screen.bufferRows - 1) return origin;
	}
}

/** Previous/next paragraph (blank row). */
export function moveParagraph(screen, position, direction) {
	let index = screen.indexOfSeq(position.seq);
	for (let i = index + direction; i >= 0 && i < screen.bufferRows; i += direction) {
		const info = infoAt(screen, i);
		if (info.text.trim() === "") return { seq: screen.lineSeqAt(i), col: 0 };
	}
	return direction < 0 ? { seq: screen.lineSeqAt(0), col: 0 } : { seq: screen.lineSeqAt(screen.bufferRows - 1), col: 0 };
}

/** Dispatch one copy-mode motion; unknown keys return null. */
export function moveCopy(screen, position, action, { page = screen.rows - 1 } = {}) {
	switch (action) {
		case "up": return moveVertical(screen, position, -1);
		case "down": return moveVertical(screen, position, 1);
		case "left": return moveHorizontal(screen, position, -1);
		case "right": return moveHorizontal(screen, position, 1);
		case "page-up": return moveVertical(screen, position, -Math.max(1, page));
		case "page-down": return moveVertical(screen, position, Math.max(1, page));
		case "top": return { seq: screen.lineSeqAt(0), col: position.col };
		case "bottom": return { seq: screen.lineSeqAt(screen.bufferRows - 1), col: position.col };
		case "line-start": return { seq: position.seq, col: 0 };
		case "line-end": {
			const info = infoAt(screen, screen.indexOfSeq(position.seq));
			return { seq: position.seq, col: lastCol(info) };
		}
		case "word": return nextWordStart(screen, position, false);
		case "big-word": return nextWordStart(screen, position, true);
		case "word-back": return previousWordStart(screen, position, false);
		case "big-word-back": return previousWordStart(screen, position, true);
		case "word-end": return nextWordEnd(screen, position, false);
		case "big-word-end": return nextWordEnd(screen, position, true);
		case "paragraph-back": return moveParagraph(screen, position, -1);
		case "paragraph": return moveParagraph(screen, position, 1);
		default: return null;
	}
}

/** Normalise an anchor/head pair into selectable rows. */
export function copyRows(screen, anchor, head) {
	const toRow = (position) => {
		const index = screen.indexOfSeq(position.seq);
		return index < 0 ? (position.seq < screen.firstSeq ? 0 : clampIndex(screen, screen.bufferRows - 1)) : index;
	};
	return {
		anchor: { row: toRow(anchor), col: anchor.col },
		head: { row: toRow(head), col: head.col },
	};
}

/** The text a copy-mode selection would yield. */
export function copyText(screen, anchor, head) {
	return selectionText(copyRows(screen, anchor, head), (row) => screen.lineAt(row), screen.cols);
}

/** A whole-line selection from one position. */
export function lineSelection(screen, position) {
	const info = infoAt(screen, screen.indexOfSeq(position.seq));
	return { anchor: { seq: position.seq, col: 0 }, head: { seq: position.seq, col: lastCol(info) + 1 } };
}
