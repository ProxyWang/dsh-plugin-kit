/* ---------------- terminal selection: an anchor and a head over the buffer ----------------
 *
 * A selection is two positions in the *buffer*, not on the screen, so it survives
 * scrolling: `anchor` is where the drag started, `head` follows the pointer, and
 * either may be above the other. Rows are absolute buffer indices (scrollback
 * included), columns are cell indices.
 *
 * Everything here is pure and DOM-free: given the screen's rows, a selection
 * answers "which cells are highlighted" and "what text gets copied". Wide
 * characters claim two cells but copy as one character, and a row that wrapped
 * joins its successor without a newline — the same rules the emulator uses when
 * it lays text out.
 */

/**
 * Normalise a selection into a top-to-bottom, left-to-right range.
 *
 * @param selection - `{ anchor, head }` in buffer coordinates, or null.
 * @returns `{ start, end, empty }` with `start` before `end` in reading order.
 */
export function normalizeSelection(selection) {
	if (!selection?.anchor || !selection?.head) return { start: null, end: null, empty: true };
	const { anchor, head } = selection;
	const anchorFirst = anchor.row < head.row || (anchor.row === head.row && anchor.col <= head.col);
	return {
		start: anchorFirst ? anchor : head,
		end: anchorFirst ? head : anchor,
		empty: anchor.row === head.row && anchor.col === head.col,
	};
}

/**
 * Cells of one row covered by the selection.
 *
 * @param selection - the selection.
 * @param row - absolute buffer row.
 * @param cols - the grid width, for "to end of line" heads.
 * @returns `{ from, to }` half-open cell range, or null when the row is outside.
 */
export function selectionRow(selection, row, cols) {
	const { start, end, empty } = normalizeSelection(selection);
	if (empty || start === null) return null;
	if (row < start.row || row > end.row) return null;
	const from = row === start.row ? start.col : 0;
	const to = row === end.row ? end.col : cols;
	return to > from ? { from, to: Math.min(to, cols) } : null;
}

/**
 * The visible text of one buffer row, without trailing padding.
 * @param line - a buffer line.
 * @returns its text.
 */
export function lineText(line) {
	if (!line?.cells) return "";
	let text = "";
	for (const cell of line.cells) {
		if (!cell || cell.w === 0) continue;
		text += cell.c;
	}
	return text.replace(/\s+$/u, "");
}

/**
 * The text a selection would copy.
 *
 * @param selection - the selection.
 * @param lineAt - `(row) => line` reader for the buffer.
 * @param cols - the grid width.
 * @returns the selected text; wrapped rows are joined without a newline and each
 *   row's trailing padding is dropped.
 */
export function selectionText(selection, lineAt, cols) {
	const { start, end, empty } = normalizeSelection(selection);
	if (empty || start === null) return "";
	const out = [];
	for (let row = start.row; row <= end.row; row++) {
		const line = lineAt(row);
		if (!line) continue;
		const span = selectionRow(selection, row, cols);
		if (!span) continue;
		let text = "";
		for (let col = span.from; col < span.to; col++) {
			const cell = line.cells[col];
			if (!cell || cell.w === 0) continue;
			text += cell.c;
		}
		const lastRow = row === end.row;
		if (!lastRow && line.wrapped) out.push(text); // continue the same logical line
		else out.push(lastRow ? text : `${text}\n`);
	}
	// Wrapped rows were pushed without a separator; join those, then the rest.
	return out.join("");
}

/** Characters that make up a "word" for double-click selection. */
const WORD_RE = /[\p{L}\p{N}_\-./\\:@~+]$/u;

/**
 * Word boundaries around a cell, for double-click.
 *
 * @param line - the row's line.
 * @param col - the clicked cell.
 * @returns `{ from, to }` half-open cell range; a blank cell answers its own cell.
 */
export function wordRange(line, col) {
	const cells = line?.cells ?? [];
	const charAt = (index) => {
		const cell = cells[index];
		if (!cell || cell.w === 0) return "";
		return cell.c;
	};
	if (!WORD_RE.test(charAt(col))) return { from: col, to: Math.min(col + 1, cells.length) };
	let from = col;
	while (from > 0 && WORD_RE.test(charAt(from - 1))) from--;
	let to = col + 1;
	while (to < cells.length && WORD_RE.test(charAt(to))) to++;
	return { from, to };
}

/**
 * Build a selection covering one word.
 * @param line - the row's line.
 * @param row - absolute buffer row.
 * @param col - the clicked cell.
 * @returns a selection.
 */
export function selectWord(line, row, col) {
	const { from, to } = wordRange(line, col);
	return { anchor: { row, col: from }, head: { row, col: to } };
}

/**
 * Build a selection covering one full row.
 * @param row - absolute buffer row.
 * @param cols - the grid width.
 * @returns a selection.
 */
export function selectLine(row, cols) {
	return { anchor: { row, col: 0 }, head: { row, col: cols } };
}

/**
 * Build a selection covering the whole retained buffer.
 * @param rows - total buffer rows.
 * @param cols - the grid width.
 * @returns a selection.
 */
export function selectAll(rows, cols) {
	return { anchor: { row: 0, col: 0 }, head: { row: Math.max(0, rows - 1), col: cols } };
}
