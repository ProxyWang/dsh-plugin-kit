/* ---------------- terminal search: literal, smart-case, buffer coordinates ----------------
 *
 * Search is deliberately literal. A terminal is read while things are moving:
 * errors, URLs, paths and command output are copied literally, and a regular
 * expression that can backtrack would turn a keystroke into a stalled frame.
 * The query is matched against each retained row and reported in cell columns,
 * so wide glyphs and wrapped rows keep the same geometry as selection/copy.
 */

/** Build the searchable text of one row plus the column of every code unit. */
export function lineSearchText(line) {
	const columns = [];
	const widths = [];
	let text = "";
	for (let col = 0; col < (line?.cells?.length ?? 0); col++) {
		const cell = line.cells[col];
		if (cell === undefined || cell.w === 0) continue;
		for (let i = 0; i < cell.c.length; i++) {
			columns.push(col);
			widths.push(cell.w || 1);
		}
		text += cell.c;
	}
	return { text, columns, widths };
}

/**
 * Find every literal occurrence in one row.
 *
 * @param line - a buffer row.
 * @param seq - that row's stable identity.
 * @param query - the literal query.
 * @param options - `{ caseSensitive }`; default is smart-case (an uppercase
 *   character in the query makes it case-sensitive).
 * @returns matches as `{ seq, col, width, text }` in reading order.
 */
export function findInLine(line, seq, query, { caseSensitive = false } = {}) {
	if (typeof query !== "string" || query === "" || !line?.cells) return [];
	const sensitive = caseSensitive || /[A-Z]/u.test(query);
	const { text, columns, widths } = lineSearchText(line);
	const haystack = sensitive ? text : text.toLocaleLowerCase();
	const needle = sensitive ? query : query.toLocaleLowerCase();
	const matches = [];
	let from = 0;
	while (from <= haystack.length) {
		const at = haystack.indexOf(needle, from);
		if (at < 0) break;
		const start = columns[at] ?? 0;
		const last = at + needle.length - 1;
		const end = (columns[last] ?? start) + (widths[last] ?? 1);
		matches.push({ seq, col: start, width: Math.max(1, end - start), text: text.slice(at, at + needle.length) });
		from = at + Math.max(1, needle.length);
	}
	return matches;
}

/**
 * Search the retained rows of a screen.
 *
 * @param screen - the emulator (uses `bufferRows`, `lineAt`, `lineSeqAt`).
 * @param query - literal query.
 * @param options - `{ caseSensitive, limit }`; `limit` caps pathological rows.
 * @returns matches in buffer order.
 */
export function searchScreen(screen, query, { caseSensitive = false, limit = 5000 } = {}) {
	if (typeof query !== "string" || query === "") return [];
	const total = screen.bufferRows;
	const matches = [];
	for (let index = 0; index < total && matches.length < limit; index++) {
		const line = screen.lineAt(index);
		if (!line) continue;
		for (const match of findInLine(line, line.seq, query, { caseSensitive })) {
			matches.push(match);
			if (matches.length >= limit) break;
		}
	}
	return matches;
}

/**
 * Offset (rows above the live bottom) that brings a buffer row into view.
 *
 * @param screen - the emulator.
 * @param index - absolute buffer index of the target row.
 * @param margin - rows of context above the target, clamped by the viewport.
 * @returns a non-negative scroll offset.
 */
export function offsetForRow(screen, index, margin = 2) {
	const maxOffset = Math.max(0, screen.bufferRows - screen.rows);
	const context = Math.min(Math.max(0, margin), Math.max(0, screen.rows - 1));
	const desiredStart = Math.max(0, Math.min(maxOffset, index - context));
	return Math.max(0, Math.min(maxOffset, screen.bufferRows - screen.rows - desiredStart));
}
