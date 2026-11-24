/* ---------------- terminal screen: emulator state, no DOM ----------------
 *
 * The plugin renders its own terminal, so this module is the emulator: a
 * fixed grid of cells, the primary and alternate buffers, scrollback, and the
 * ANSI/VT parser that turns the byte stream from DSH's host terminal into cells.
 * Nothing here touches the DOM, which is what makes the whole thing testable in
 * Node and lets the renderer decide *when* to paint rather than being told by a
 * library.
 *
 * Scope is deliberate: the sequences a shell, a pager, vim, git and the common
 * TUI toolkits actually emit, and nothing else. Unknown CSI/OSC/DCS sequences
 * are consumed and ignored — the safe direction, because a terminal that
 * guesses is worse than one that ignores.
 *
 * Coordinate model:
 *   - buffer rows are 0-based and include scrollback; the viewport is the last
 *     `rows` of them (or an alternate buffer with no scrollback at all);
 *   - the cursor is 0-based, `x` in columns and `y` relative to the viewport;
 *   - every retained row carries a monotonic `seq`; selections, search hits
 *     and scroll anchors refer to it, so eviction never silently retargets
 *   - an absolute row for the primary buffer is `count - rows + y`.
 */

import { cellWidth, graphemeWidth } from "./width.js";

/** Cell attribute bits; a small bitmask keeps equality checks cheap. */
export const FLAG = {
	bold: 1, dim: 2, italic: 4, underline: 8, blink: 16,
	inverse: 32, invisible: 64, strike: 128, overline: 256,
};

/** Default attributes. `-1` means "use the theme's default colour". */
const DEFAULT_ATTR = { fg: -1, bg: -1, fl: 0, link: null };

/** Truecolor values are stored above the 256 palette indices. */
const TRUECOLOR = 1 << 24;

/** Conservative per-cell accounting for the scrollback byte budget. */
const CELL_BYTES = 32;
const LINE_OVERHEAD = 64;

/** DEC special graphics (ESC ( 0) to Unicode, for TUIs that draw boxes. */
const DEC_GRAPHICS = {
	"`": "◆", a: "▒", b: "␉", c: "␌", d: "␍", e: "␊", f: "°", g: "±", h: "␤", i: "␋",
	j: "┘", k: "┐", l: "┌", m: "└", n: "┼", o: "⎺", p: "⎻", q: "─", r: "⎼", s: "⎽",
	t: "├", u: "┤", v: "┴", w: "┬", x: "│", y: "≤", z: "≥", "{": "π", "|": "≠", "}": "£", "~": "·",
};

/** One blank row; the cells array is sparse, so untouched cells cost nothing. */
function blankLine(cols, seq, cells = null, wrapped = false) {
	return {
		cells: cells ?? new Array(cols).fill(undefined),
		wrapped,
		version: 1,
		seq,
		bytes: cols * CELL_BYTES + LINE_OVERHEAD,
	};
}

/** The second half of a wide glyph; erases and layout stay rectangular. */
function continuation(cell) {
	return { c: "", fg: cell.fg, bg: cell.bg, fl: cell.fl, w: 0, link: cell.link };
}

/** Split a logical line into rows at `cols`, keeping wide glyphs intact. */
function wrapCells(cells, cols) {
	const rows = [];
	let row = [];
	const flush = () => {
		while (row.length < cols) row.push(undefined);
		rows.push(row);
		row = [];
	};
	for (const cell of cells) {
		const width = cell === undefined ? 1 : (cell.w === 0 ? 0 : cell.w || 1);
		if (width === 0) {
			// A combining mark belongs to the preceding base cell. Reflow keeps
			// the cluster intact; a mark with no base is dropped.
			const base = row[row.length - 1];
			if (base !== undefined) base.c += cell.c;
			continue;
		}
		if (row.length + width > cols) flush();
		row.push(cell);
		if (width === 2) row.push(continuation(cell));
	}
	if (row.length > 0 || rows.length === 0) flush();
	return rows;
}

/** One ordered ring of rows: O(1) append/evict instead of Array.shift(). */
class Buffer {
	constructor(cols, rows, scrollback, maxBytes, seqBase = 0) {
		this.cols = cols;
		this.rows = rows;
		this.scrollback = Math.max(0, scrollback);
		this.maxBytes = maxBytes;
		this.seqBase = seqBase;
		this.reset();
	}

	get capacity() {
		return Math.max(this.rows, this.rows + this.scrollback);
	}

	reset() {
		this.slots = new Array(this.capacity).fill(null);
		this.head = 0;
		this.count = 0;
		this.bytes = 0;
		this.nextSeq = this.seqBase;
		this.firstSeq = this.seqBase;
		for (let i = 0; i < this.rows; i++) this.pushBlank();
	}

	at(index) {
		if (index < 0 || index >= this.count) return null;
		return this.slots[(this.head + index) % this.slots.length];
	}

	toArray() {
		return this.slice(0, this.count);
	}

	slice(start, count) {
		const out = new Array(count);
		for (let i = 0; i < count; i++) out[i] = this.at(start + i);
		return out;
	}

	indexOfSeq(seq) {
		// Region scrolls can insert a fresh seq in the middle, so physical order
		// is not always seq order. The retained buffer is bounded, so a scan is
		// cheaper and safer than maintaining a shifting index map.
		for (let i = 0; i < this.count; i++) if (this.at(i).seq === seq) return i;
		return -1;
	}

	pushBlank() {
		this.pushLine(blankLine(this.cols, this.nextSeq++));
	}

	pushLine(line) {
		const length = this.slots.length;
		if (this.count < length) {
			this.slots[(this.head + this.count) % length] = line;
			this.count++;
		} else {
			const victim = this.slots[this.head];
			this.bytes -= victim?.bytes ?? 0;
			this.slots[this.head] = line;
			this.head = (this.head + 1) % length;
			this.firstSeq = this.at(0)?.seq ?? victim.seq + 1;
		}
		this.bytes += line.bytes ?? 0;
		this.nextSeq = Math.max(this.nextSeq, (line.seq ?? 0) + 1);
		if (this.count === 1) this.firstSeq = line.seq;
		this.firstSeq = this.at(0)?.seq ?? this.firstSeq;
		this.trimBytes();
	}

	dropOldest() {
		const victim = this.at(0);
		if (victim === null) return;
		this.bytes -= victim.bytes ?? 0;
		this.slots[this.head] = null;
		this.head = (this.head + 1) % this.slots.length;
		this.count--;
		this.firstSeq = this.at(0)?.seq ?? victim.seq + 1;
	}

	trimBytes() {
		while (this.bytes > this.maxBytes && this.count > this.rows) this.dropOldest();
	}

	rebuild(cols, rows, scrollback, lines) {
		this.cols = cols;
		this.rows = rows;
		this.scrollback = Math.max(0, scrollback);
		const capacity = this.capacity;
		this.slots = new Array(capacity).fill(null);
		this.head = 0;
		this.count = 0;
		this.bytes = 0;
		this.nextSeq = this.seqBase;
		for (const line of lines) this.nextSeq = Math.max(this.nextSeq, (line.seq ?? 0) + 1);
		for (const line of lines) this.pushLine(line);
		while (this.count < rows) this.pushBlank();
		this.firstSeq = this.at(0)?.seq ?? 1;
	}

	setRows(rows) {
		const lines = this.toArray();
		this.rebuild(this.cols, rows, this.scrollback, lines);
	}

	/** Alternate screen is top-anchored: shrinking drops rows from the bottom. */
	resizeKeepTop(cols, rows) {
		let lines = this.toArray();
		if (cols !== this.cols) {
			for (const line of lines) {
				line.cells.length = cols;
				line.version++;
				line.bytes = cols * CELL_BYTES + LINE_OVERHEAD;
			}
		}
		if (lines.length > rows) lines = lines.slice(0, rows);
		this.rebuild(cols, rows, 0, lines);
	}

	readRegion(top, bottom) {
		const out = [];
		for (let i = top; i <= bottom; i++) out.push(this.at(i));
		return out;
	}

	writeRegion(top, lines) {
		for (let i = 0; i < lines.length; i++) {
			const physical = (this.head + top + i) % this.slots.length;
			const previous = this.slots[physical];
			this.bytes -= previous?.bytes ?? 0;
			this.slots[physical] = lines[i];
			this.bytes += lines[i].bytes ?? 0;
		}
		if (top === 0) this.firstSeq = this.at(0)?.seq ?? this.firstSeq;
	}

	dropScrollback() {
		while (this.count > this.rows) this.dropOldest();
	}
}

/** An empty damage record; every frame starts from this shape. */
function emptyDamage() {
	return { full: true, scrolls: [], rows: new Set(), bell: 0, title: false, modes: 0 };
}

/**
 * Create one terminal screen.
 *
 * @param options - initial grid size, retained scrollback rows and byte budget.
 * @returns the emulator: `write`, `resize`, viewport/cursor readers, damage and
 *   the parser's saved state (so a frame boundary mid-sequence is harmless).
 */
export function createScreen({ cols = 80, rows = 24, scrollback = 1000, scrollbackBytes = 10 * 1024 * 1024 } = {}) {
	cols = Math.max(2, Math.trunc(Number(cols) || 80));
	rows = Math.max(1, Math.trunc(Number(rows) || 24));
	scrollback = Math.max(0, Math.trunc(Number(scrollback) || 0));
	scrollbackBytes = Math.max(0, Number(scrollbackBytes) || 0);
	const primary = new Buffer(cols, rows, scrollback, scrollbackBytes);
	// A distinct namespace keeps a stale selection/search hit from pointing at
	// an unrelated alternate-screen row when seqs would otherwise collide.
	const alternate = new Buffer(cols, rows, 0, Number.POSITIVE_INFINITY, 1_000_000_000);
	let buffer = primary;
	let alt = false;
	let x = 0;
	let y = 0;
	let saved = { x: 0, y: 0, attrs: { ...DEFAULT_ATTR }, origin: false };
	let attrs = { ...DEFAULT_ATTR };
	let scrollTop = 0;
	let scrollBottom = rows - 1;
	let tabs = defaultTabs(cols);
	let modes = {
		wrap: true, origin: false, insert: false, cursor: true, appCursor: false,
		alt: false, bracketedPaste: false, mouse: "off", sgrMouse: false, echo: true,
		focus: false, syncOutput: false, altScroll: false,
	};
	let cursorStyle = "block";
	let cursorBlink = true;
	let title = "";
	let cwd = "";
	let bell = 0;
	let currentLink = null;
	let damage = emptyDamage();
	let charsetG0 = "ascii";
	const listeners = { title: [], bell: [], osc: [], mode: [] };

	// Parser state that must survive a frame boundary.
	let state = "ground";
	let params = "";
	let prefix = "";
	let intermediate = "";
	let osc = "";
	let dcsSkip = false;

	function defaultTabs(width) {
		const stops = new Set();
		for (let i = 8; i < width; i += 8) stops.add(i);
		return stops;
	}

	const absRow = (row = y) => buffer.count - buffer.rows + row;

	function lineAt(row) {
		return buffer.at(absRow(row));
	}

	function mark(line) {
		if (line === null || line === undefined) return;
		line.version++;
		if (damage.full) return;
		damage.rows.add(line.seq);
		if (damage.rows.size > 4096) markAll();
	}

	function recordScroll(shift) {
		damage.scrolls.push({ whole: true, shift });
		if (damage.scrolls.length > 64) markAll();
	}

	function markAll() {
		damage.full = true;
		damage.rows.clear();
		damage.scrolls.length = 0;
	}

	function emitMode() {
		for (const listener of listeners.mode) listener({ ...modes });
	}

	/* ---------------- writes ---------------- */

	/** Blank cells carry the current background colour (BCE). */
	function blankCell() {
		if (attrs.bg === -1 && attrs.fl === 0 && attrs.link === null) return undefined;
		return { c: " ", fg: -1, bg: attrs.bg, fl: 0, w: 1, link: null };
	}

	function makeCell(text, width) {
		return { c: text, fg: attrs.fg, bg: attrs.bg, fl: attrs.fl, w: width, link: currentLink };
	}

	/** Place one grapheme cluster; width 0 attaches it to the previous base. */
	function putCluster(text, width) {
		const line = lineAt();
		if (!line) return;
		if (width === 0) {
			let col = x - 1;
			while (col >= 0 && line.cells[col]?.w === 0) col--;
			const base = col >= 0 ? line.cells[col] : undefined;
			if (base !== undefined) {
				// Blank cells from an erase share one object; clone so the mark
				// cannot appear on every cell of the erased range.
				line.cells[col] = { ...base, c: base.c + text };
				mark(line);
			}
			return;
		}
		if (modes.wrap && x + width > buffer.cols) {
			line.wrapped = true;
			x = 0;
			indexDown();
		}
		if (x + width > buffer.cols) x = Math.max(0, buffer.cols - width);
		if (modes.insert) insertCells(width);
		const target = lineAt();
		if (!target) return;
		if (width === 2 && x + 1 < buffer.cols) {
			target.cells[x + 1] = continuation(makeCell("", 2));
		}
		target.cells[x] = makeCell(text, width);
		mark(target);
		x += width;
	}

	/** Bulk ASCII path: default printable runs skip the grapheme machinery. */
	function writeAsciiRun(data, start, end) {
		let pos = start;
		while (pos < end) {
			const line = lineAt();
			if (!line) return;
			if (modes.insert) {
				putCluster(data[pos], 1);
				pos++;
				continue;
			}
			if (x >= buffer.cols) {
				if (!modes.wrap) {
					x = buffer.cols - 1;
				} else {
					line.wrapped = true;
					x = 0;
					indexDown();
					continue;
				}
			}
			const available = buffer.cols - x;
			const wanted = Math.min(end - pos, available);
			for (let k = 0; k < wanted; k++) line.cells[x + k] = makeCell(data[pos + k], 1);
			mark(line);
			x += wanted;
			pos += wanted;
			if (pos < end && modes.wrap) {
				line.wrapped = true;
				x = 0;
				indexDown();
			}
		}
	}

	/** Write a run of non-ASCII text, one grapheme cluster at a time. */
	function writeText(text) {
		if (charsetG0 === "dec") {
			for (const ch of text) {
				const mapped = DEC_GRAPHICS[ch];
				if (mapped) putCluster(mapped, cellWidth(mapped.codePointAt(0) ?? 32));
				else putCluster(ch, cellWidth(ch.codePointAt(0) ?? 32));
			}
			return;
		}
		// The segmenter is only needed when a cluster joins several base
		// glyphs (ZWJ emoji). CJK, combining marks and skin-tone modifiers are
		// already handled by per-code-point widths, and skipping the segmenter
		// keeps plain CJK output at the fast-path rate.
		if (segmenter !== null && text.includes("\u200d")) {
			for (const part of segmenter.segment(text)) {
				putCluster(part.segment, graphemeWidth(part.segment));
			}
			return;
		}
		for (const ch of text) {
			const code = ch.codePointAt(0);
			if (code === undefined || code < 0x20) continue;
			putCluster(ch, graphemeWidth(ch));
		}
	}

	/* ---------------- cursor and scrolling ---------------- */

	function indexDown() {
		if (y === scrollBottom) scrollUp(1);
		else y = Math.min(buffer.rows - 1, y + 1);
	}

	function indexUp() {
		if (y === scrollTop) scrollDown(1);
		else y = Math.max(0, y - 1);
	}

	function newSeq() {
		return buffer.nextSeq++;
	}

	/**
	 * Scroll the optional scroll region up.
	 *
	 * A full-screen scroll appends one blank row to the ring; the row that
	 * leaves the viewport simply stays above it as scrollback. A region scroll
	 * cannot touch anything outside its rows, so it rewrites that small region.
	 */
	function scrollUp(count) {
		const top = absRow(scrollTop);
		const bottom = absRow(scrollBottom);
		if (top < 0 || bottom >= buffer.count) return;
		const whole = scrollTop === 0 && scrollBottom === buffer.rows - 1;
		let lines = Math.min(count, buffer.rows);
		if (lines <= 0) return;
		if (whole) {
			while (lines-- > 0) buffer.pushBlank();
			recordScroll(count);
			return;
		}
		const region = buffer.readRegion(top, bottom);
		const moves = Math.min(count, region.length);
		for (let i = 0; i < moves; i++) {
			region.shift();
			region.push(blankLine(buffer.cols, newSeq()));
		}
		buffer.writeRegion(top, region);
		for (const line of region) damage.rows.add(line.seq);
	}

	function scrollDown(count) {
		const top = absRow(scrollTop);
		const bottom = absRow(scrollBottom);
		if (top < 0 || bottom >= buffer.count) return;
		const region = buffer.readRegion(top, bottom);
		const lines = Math.min(count, region.length);
		for (let i = 0; i < lines; i++) {
			region.pop();
			region.unshift(blankLine(buffer.cols, newSeq()));
		}
		buffer.writeRegion(top, region);
		for (const line of region) damage.rows.add(line.seq);
	}

	function carriageReturn() { x = 0; }
	function lineFeed() { indexDown(); }

	/* ---------------- erasing ---------------- */

	function eraseCells(row, from, to) {
		const line = lineAt(row);
		if (!line) return;
		const blank = blankCell();
		for (let col = Math.max(0, from); col < Math.min(buffer.cols, to); col++) line.cells[col] = blank;
		mark(line);
	}

	function eraseInLine(mode) {
		if (mode === 0) eraseCells(y, x, buffer.cols);
		else if (mode === 1) eraseCells(y, 0, x + 1);
		else eraseCells(y, 0, buffer.cols);
	}

	function eraseInDisplay(mode) {
		if (mode === 0) {
			eraseCells(y, x, buffer.cols);
			for (let row = y + 1; row < buffer.rows; row++) eraseCells(row, 0, buffer.cols);
		} else if (mode === 1) {
			for (let row = 0; row < y; row++) eraseCells(row, 0, buffer.cols);
			eraseCells(y, 0, x + 1);
		} else if (mode === 2) {
			for (let row = 0; row < buffer.rows; row++) eraseCells(row, 0, buffer.cols);
		} else if (mode === 3) {
			buffer.dropScrollback();
			markAll();
		}
	}

	function insertCells(count) {
		const line = lineAt();
		if (!line) return;
		const head = line.cells.slice(0, x);
		const rest = line.cells.slice(x, Math.max(0, buffer.cols - count));
		line.cells = head.concat(new Array(count).fill(undefined), rest).slice(0, buffer.cols);
		while (line.cells.length < buffer.cols) line.cells.push(undefined);
		mark(line);
	}

	function deleteCells(count) {
		const line = lineAt();
		if (!line) return;
		const head = line.cells.slice(0, x);
		const rest = line.cells.slice(x + count);
		line.cells = head.concat(rest, new Array(count).fill(undefined)).slice(0, buffer.cols);
		while (line.cells.length < buffer.cols) line.cells.push(undefined);
		mark(line);
	}

	/* ---------------- alternate screen ---------------- */

	function enterAlternate(clear) {
		if (!alt) {
			alt = true;
			modes.alt = true;
			buffer = alternate;
			scrollTop = 0;
			scrollBottom = alternate.rows - 1;
			modes.origin = false;
			if (clear) alternate.reset();
			markAll();
		} else if (clear) {
			alternate.reset();
			markAll();
		}
	}

	function leaveAlternate() {
		if (!alt) return;
		alt = false;
		modes.alt = false;
		buffer = primary;
		modes.origin = false;
		scrollTop = 0;
		scrollBottom = primary.rows - 1;
		markAll();
	}

	/* ---------------- SGR ---------------- */

	function setColor(target, params, index) {
		const kind = Number(params[index + 1]);
		if (kind === 5) {
			const n = Number(params[index + 2]);
			if (Number.isFinite(n) && n >= 0 && n < 256) {
				attrs[target] = n;
				return 3;
			}
			return 2;
		}
		if (kind === 2) {
			const r = Number(params[index + 2]);
			const g = Number(params[index + 3]);
			const b = Number(params[index + 4]);
			if ([r, g, b].every((value) => Number.isFinite(value))) {
				attrs[target] = TRUECOLOR | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
				return 5;
			}
			return 4;
		}
		return 1;
	}

	function clamp(value) {
		return Math.max(0, Math.min(255, Math.trunc(value)));
	}

	function applySgr(list) {
		for (let i = 0; i < list.length; i++) {
			const code = list[i];
			switch (code) {
				case 0: attrs = { ...DEFAULT_ATTR }; break;
				case 1: attrs.fl |= FLAG.bold; break;
				case 2: attrs.fl |= FLAG.dim; break;
				case 3: attrs.fl |= FLAG.italic; break;
				case 4: attrs.fl |= FLAG.underline; break;
				case 5: case 6: attrs.fl |= FLAG.blink; break;
				case 7: attrs.fl |= FLAG.inverse; break;
				case 8: attrs.fl |= FLAG.invisible; break;
				case 9: attrs.fl |= FLAG.strike; break;
				case 21: attrs.fl &= ~FLAG.bold; break;
				case 22: attrs.fl &= ~(FLAG.bold | FLAG.dim); break;
				case 23: attrs.fl &= ~FLAG.italic; break;
				case 24: attrs.fl &= ~FLAG.underline; break;
				case 25: attrs.fl &= ~FLAG.blink; break;
				case 27: attrs.fl &= ~FLAG.inverse; break;
				case 28: attrs.fl &= ~FLAG.invisible; break;
				case 29: attrs.fl &= ~FLAG.strike; break;
				case 38: i += setColor("fg", list, i); break;
				case 48: i += setColor("bg", list, i); break;
				case 39: attrs.fg = -1; break;
				case 49: attrs.bg = -1; break;
				case 53: attrs.fl |= FLAG.overline; break;
				case 55: attrs.fl &= ~FLAG.overline; break;
				default:
					if (code >= 30 && code <= 37) attrs.fg = code - 30;
					else if (code >= 40 && code <= 47) attrs.bg = code - 40;
					else if (code >= 90 && code <= 97) attrs.fg = code - 90 + 8;
					else if (code >= 100 && code <= 107) attrs.bg = code - 100 + 8;
					break;
			}
		}
	}

	/* ---------------- CSI dispatch ---------------- */

	function count(paramIndex = 0, fallback = 1) {
		const value = Number(Number.isFinite(list[paramIndex]) ? list[paramIndex] : fallback);
		return value === 0 ? fallback : value;
	}

	let list = [];

	function csi(final) {
		// `CSI > …` is the keyboard-protocol query namespace (kitty /
		// modifyOtherKeys). Its finals overlap legacy SGR/cursor commands, so
		// consume it instead of guessing.
		if (prefix === ">") return;
		const params0 = list[0];
		switch (final) {
			case "@": insertCells(count()); break;
			case "A": y = Math.max(scrollTop, y - count()); break;
			case "B": y = Math.min(scrollBottom, y + count()); break;
			case "C": x = Math.min(buffer.cols - 1, x + count()); break;
			case "D": x = Math.max(0, x - count()); break;
			case "E": x = 0; y = Math.min(scrollBottom, y + count()); break;
			case "F": x = 0; y = Math.max(scrollTop, y - count()); break;
			case "G": case "`": x = clampCol(count() - 1); break;
			case "H": case "f":
				y = clampRow((Number.isFinite(list[0]) ? list[0] : 1) - 1 + (modes.origin ? scrollTop : 0));
				x = clampCol((Number.isFinite(list[1]) ? list[1] : 1) - 1);
				break;
			case "I": for (let i = 0; i < count(); i++) x = nextTab(x); break;
			case "J": eraseInDisplay(Number.isFinite(params0) ? params0 : 0); break;
			case "K": eraseInLine(Number.isFinite(params0) ? params0 : 0); break;
			case "L": scrollDownAt(count()); break;
			case "M": scrollUpAt(count()); break;
			case "P": deleteCells(count()); break;
			case "S": scrollUp(count()); break;
			case "T": scrollDown(count()); break;
			case "X": eraseCells(y, x, x + count()); break;
			case "Z": for (let i = 0; i < count(); i++) x = previousTab(x); break;
			case "a": x = clampCol(x + count()); break;
			case "b": {
				const line = lineAt();
				let col = x - 1;
				while (col >= 0 && line?.cells[col]?.w === 0) col--;
				const previous = col >= 0 ? line?.cells[col] : undefined;
				if (previous) for (let i = 0; i < count(); i++) putCluster(previous.c, previous.w || 1);
				break;
			}
			case "d": y = clampRow(count() - 1); break;
			case "e": y = Math.min(scrollBottom, y + count()); break;
			case "g": if (Number.isFinite(params0) && params0 === 3) tabs.clear(); else tabs.delete(x); break;
			case "h": setModes(true); break;
			case "l": setModes(false); break;
			case "m": applySgr(list.length === 0 ? [0] : list); break;
			case "n": break; // status reports are answered by the host side, not us
			case "q": {
				const style = Number.isFinite(params0) ? params0 : 0;
				const shapes = ["block", "block", "block", "underline", "underline", "bar", "bar"];
				cursorStyle = shapes[style] ?? "block";
				cursorBlink = style === 0 || style % 2 === 1;
				break;
			}
			case "r": {
				const top = (Number.isFinite(list[0]) ? list[0] : 1) - 1;
				const bottom = (Number.isFinite(list[1]) ? list[1] : buffer.rows) - 1;
				if (top < bottom && bottom < buffer.rows) {
					scrollTop = Math.max(0, top);
					scrollBottom = bottom;
					y = modes.origin ? scrollTop : 0;
					x = 0;
				}
				break;
			}
			case "s": saved = { x, y, attrs: { ...attrs }, origin: modes.origin }; break;
			case "u": x = clampCol(saved.x); y = clampRow(saved.y); attrs = { ...saved.attrs }; break;
			case "t": break; // window manipulation: ignored on purpose
			default: break;
		}
	}

	/** IL/DL scroll only the region below the cursor. */
	function scrollDownAt(countLines) {
		const top = absRow(y);
		const bottom = absRow(scrollBottom);
		if (top < 0 || bottom >= buffer.count) return;
		const region = buffer.readRegion(top, bottom);
		const lines = Math.min(countLines, region.length);
		for (let i = 0; i < lines; i++) {
			region.pop();
			region.unshift(blankLine(buffer.cols, newSeq()));
		}
		buffer.writeRegion(top, region);
		for (const line of region) damage.rows.add(line.seq);
	}

	function scrollUpAt(countLines) {
		const top = absRow(y);
		const bottom = absRow(scrollBottom);
		if (top < 0 || bottom >= buffer.count) return;
		const region = buffer.readRegion(top, bottom);
		const lines = Math.min(countLines, region.length);
		for (let i = 0; i < lines; i++) {
			region.shift();
			region.push(blankLine(buffer.cols, newSeq()));
		}
		buffer.writeRegion(top, region);
		for (const line of region) damage.rows.add(line.seq);
	}

	function setModes(on) {
		const isPrivate = prefix === "?";
		if (!isPrivate) {
			for (const value of list) if (value === 4) modes.insert = on;
			return;
		}
		for (const value of list) {
			switch (value) {
				case 1: modes.appCursor = on; break;
				case 6: modes.origin = on; y = on ? scrollTop : 0; x = 0; break;
				case 7: modes.wrap = on; break;
				case 9: modes.mouse = on ? "9" : "off"; break;
				case 12: cursorBlink = on; break;
				case 25: modes.cursor = on; break;
				case 47: case 1047: if (on) enterAlternate(false); else leaveAlternate(); break;
				case 1000: case 1002: case 1003: modes.mouse = on ? String(value) : "off"; break;
				case 1004: modes.focus = on; break;
				case 1006: modes.sgrMouse = on; break;
				case 1007: modes.altScroll = on; break;
				case 1049:
					if (on) {
						saved = { x, y, attrs: { ...attrs }, origin: modes.origin };
						enterAlternate(true);
						x = 0;
						y = 0;
					} else {
						leaveAlternate();
						x = clampCol(saved.x);
						y = clampRow(saved.y);
						attrs = { ...saved.attrs };
						modes.origin = saved.origin;
					}
					break;
				case 2004: modes.bracketedPaste = on; break;
				case 2026: modes.syncOutput = on; break;
				default: break;
			}
		}
		emitMode();
	}

	function clampCol(value) {
		return Math.max(0, Math.min(buffer.cols - 1, value));
	}

	function clampRow(value) {
		return Math.max(0, Math.min(buffer.rows - 1, value));
	}

	function nextTab(from) {
		for (let col = from + 1; col < buffer.cols; col++) if (tabs.has(col)) return col;
		return buffer.cols - 1;
	}

	function previousTab(from) {
		for (let col = from - 1; col >= 0; col--) if (tabs.has(col)) return col;
		return 0;
	}

	/* ---------------- parser ---------------- */

	function escape(final) {
		switch (final) {
			case "D": indexDown(); break;
			case "E": x = 0; indexDown(); break;
			case "M": indexUp(); break;
			case "7": saved = { x, y, attrs: { ...attrs }, origin: modes.origin }; break;
			case "8": x = clampCol(saved.x); y = clampRow(saved.y); attrs = { ...saved.attrs }; break;
			case "c": reset(); break;
			case "H": tabs.add(x); break;
			default: break;
		}
	}

	function reset() {
		// A snapshot can arrive mid-sequence; do not feed it into a stale OSC,
		// CSI parameter list or DEC graphics state from the previous stream.
		state = "ground";
		params = "";
		prefix = "";
		intermediate = "";
		osc = "";
		dcsSkip = false;
		charsetG0 = "ascii";
		list = [];
		alt = false;
		modes.alt = false;
		buffer = primary;
		primary.reset();
		alternate.reset();
		x = 0;
		y = 0;
		attrs = { ...DEFAULT_ATTR };
		saved = { x: 0, y: 0, attrs: { ...DEFAULT_ATTR }, origin: false };
		currentLink = null;
		scrollTop = 0;
		scrollBottom = primary.rows - 1;
		tabs = defaultTabs(primary.cols);
		cursorStyle = "block";
		cursorBlink = true;
		modes = {
			...modes, wrap: true, origin: false, insert: false, cursor: true,
			appCursor: false, bracketedPaste: false, mouse: "off", sgrMouse: false,
			focus: false, syncOutput: false, altScroll: false,
		};
		markAll();
	}

	function dispatchOsc(payload) {
		const semicolon = payload.indexOf(";");
		const command = semicolon === -1 ? payload : payload.slice(0, semicolon);
		const body = semicolon === -1 ? "" : payload.slice(semicolon + 1);
		for (const listener of listeners.osc) listener({ command, body });
		if (command === "0" || command === "2") {
			title = body;
			damage.title = true;
			for (const listener of listeners.title) listener(title);
			return;
		}
		if (command === "7") {
			cwd = fileUriToPath(body) ?? body;
			return;
		}
		if (command === "8") {
			const split = body.indexOf(";");
			const uri = split === -1 ? "" : body.slice(split + 1);
			currentLink = uri === "" ? null : uri;
		}
	}

	/** Feed one frame of output. A sequence split across frames resumes here. */
	function write(data) {
		if (typeof data !== "string" || data === "") return;
		const length = data.length;
		let i = 0;
		while (i < length) {
			if (state === "ground") {
				let asciiEnd = i;
				while (asciiEnd < length) {
					const code = data.charCodeAt(asciiEnd);
					if (code < 0x20 || code >= 0x7f || code === 0x1b) break;
					asciiEnd++;
				}
				if (asciiEnd > i) {
					if (charsetG0 === "ascii") writeAsciiRun(data, i, asciiEnd);
					else writeText(data.slice(i, asciiEnd));
					i = asciiEnd;
					continue;
				}
				let wideEnd = i;
				while (wideEnd < length) {
					const code = data.charCodeAt(wideEnd);
					if (code < 0x20 || code === 0x7f || code === 0x1b || code <= 0x7e) break;
					wideEnd++;
				}
				if (wideEnd > i) {
					writeText(data.slice(i, wideEnd));
					i = wideEnd;
					continue;
				}
				const code = data.charCodeAt(i);
				i++;
				if (code === 0x1b) { state = "escape"; intermediate = ""; continue; }
				if (code === 0x0d) { carriageReturn(); continue; }
				if (code === 0x0a || code === 0x0b || code === 0x0c) { lineFeed(); continue; }
				if (code === 0x08) { x = Math.max(0, x - 1); continue; }
				if (code === 0x09) { x = nextTab(x); continue; }
				if (code === 0x07) {
					bell++;
					damage.bell++;
					for (const listener of listeners.bell) listener();
					continue;
				}
				continue;
			}
			if (state === "escape") {
				const ch = data[i++];
				if (ch === "[") { state = "csi"; params = ""; prefix = ""; intermediate = ""; continue; }
				if (ch === "]") { state = "osc"; osc = ""; continue; }
				if (ch === "P" || ch === "^" || ch === "_") { state = "dcs"; dcsSkip = true; continue; }
				if (ch === "(" || ch === ")" || ch === "*" || ch === "+") { state = "charset"; intermediate = ch; continue; }
				if (ch === "#") { state = "hash"; continue; }
				state = "ground";
				escape(ch);
				continue;
			}
			if (state === "charset") {
				const ch = data[i++];
				state = "ground";
				if (intermediate === "(") charsetG0 = ch === "0" ? "dec" : "ascii";
				continue;
			}
			if (state === "hash") {
				i++;
				state = "ground";
				continue;
			}
			if (state === "csi") {
				const ch = data[i++];
				const code = ch.charCodeAt(0);
				if (code >= 0x30 && code <= 0x3b) { params += ch; continue; }
				if (code >= 0x3c && code <= 0x3f) { prefix = ch; continue; }
				if (code >= 0x20 && code <= 0x2f) { intermediate += ch; continue; }
				if (code >= 0x40 && code <= 0x7e) {
					state = "ground";
					list = parseParams(params);
					csi(ch);
					params = "";
					prefix = "";
					intermediate = "";
					continue;
				}
				state = "ground";
				continue;
			}
			if (state === "osc") {
				const ch = data[i++];
				if (ch === "\u0007") { state = "ground"; dispatchOsc(osc); osc = ""; continue; }
				if (ch === "\u001b") { state = "oscEsc"; continue; }
				osc += ch;
				if (osc.length > 8192) { state = "ground"; osc = ""; }
				continue;
			}
			if (state === "oscEsc") {
				const ch = data[i++];
				state = "ground";
				if (ch === "\\") dispatchOsc(osc);
				osc = "";
				continue;
			}
			if (state === "dcs") {
				const ch = data[i++];
				if (ch === "\u001b") { state = "dcsEsc"; continue; }
				continue;
			}
			if (state === "dcsEsc") {
				i++;
				state = "ground";
				dcsSkip = false;
				continue;
			}
		}
	}

	function parseParams(raw) {
		if (raw === "") return [];
		const out = [];
		for (const part of raw.replace(/[:]/gu, ";").split(";")) {
			out.push(part === "" ? Number.NaN : Number(part));
		}
		return out;
	}

	/* ---------------- resize and reflow ---------------- */

	function restoreCursor(cursorAbs, cursorX, evicted = 0) {
		y = clampRow(cursorAbs - evicted - (buffer.count - buffer.rows));
		x = clampCol(cursorX);
	}

	/** Reflow the primary buffer at a new width, preserving the logical lines. */
	function reflowPrimary(nextCols, nextRows, cursorAbs, cursorX) {
		const lines = primary.toArray();
		const output = [];
		let cursorOut = null;
		let lastContentRow = -1;
		let index = 0;
		while (index < lines.length) {
			const start = index;
			const group = [];
			while (index < lines.length) {
				group.push(lines[index]);
				const more = lines[index].wrapped;
				index++;
				if (!more) break;
			}
			const cells = [];
			for (const line of group) {
				const limit = Math.min(line.cells.length, primary.cols);
				for (let col = 0; col < limit; col++) {
					const cell = line.cells[col];
					if (cell !== undefined && cell.w === 0) continue;
					cells.push(cell);
				}
			}
			while (cells.length > 0 && cells[cells.length - 1] === undefined) cells.pop();
			const rows = wrapCells(cells, nextCols);
			if (cursorAbs >= start && cursorAbs < index) {
				const rowInGroup = cursorAbs - start;
				let offset = 0;
				const advance = (cell) => (cell === undefined ? 1 : (cell.w === 0 ? 0 : cell.w || 1));
				for (let r = 0; r < rowInGroup; r++) {
					for (let col = 0; col < group[r].cells.length; col++) offset += advance(group[r].cells[col]);
				}
				for (let col = 0; col < Math.min(cursorX, group[rowInGroup].cells.length); col++) offset += advance(group[rowInGroup].cells[col]);
				let remaining = offset;
				for (let r = 0; r < rows.length && cursorOut === null; r++) {
					for (let col = 0; col < nextCols; col++) {
						const cell = rows[r][col];
						const width = cell === undefined ? 1 : (cell.w === 0 ? 0 : cell.w || 1);
						if (remaining < width) {
							cursorOut = { row: output.length + r, col };
							break;
						}
						remaining -= width;
					}
				}
				if (cursorOut === null) cursorOut = { row: output.length + rows.length - 1, col: nextCols - 1 };
			}
			for (let r = 0; r < rows.length; r++) {
				if (rows[r].some((cell) => cell !== undefined)) lastContentRow = output.length;
				output.push(blankLine(nextCols, primary.nextSeq++, rows[r], r < rows.length - 1));
			}
		}
		// Trailing empty rows are padding, not history. Reflowing a wide screen
		// would otherwise push real content into scrollback behind a blank tail.
		const keep = Math.max(lastContentRow + 1, cursorOut === null ? 0 : cursorOut.row + 1, Math.min(nextRows, output.length));
		if (keep > 0 && keep < output.length) output.length = keep;
		primary.rebuild(nextCols, nextRows, primary.scrollback, output);
		if (cursorOut !== null) {
			const evicted = Math.max(0, output.length - primary.count);
			y = clampRow(cursorOut.row - evicted - (primary.count - nextRows));
			x = clampCol(cursorOut.col);
		} else {
			y = clampRow(y);
			x = clampCol(x);
		}
	}

	function resizeAlt(nextCols, nextRows, cursorAbs, cursorX) {
		alternate.resizeKeepTop(nextCols, nextRows);
		if (buffer === alternate && cursorAbs >= 0) {
			alternate.rows = nextRows;
			y = clampRow(cursorAbs);
			x = clampCol(cursorX);
		}
	}

	return {
		write,
		reset,
		resize(cols, rows) {
			cols = Math.max(2, Math.trunc(Number(cols) || primary.cols));
			rows = Math.max(1, Math.trunc(Number(rows) || primary.rows));
			if (cols === primary.cols && rows === primary.rows) return false;
			const active = buffer;
			const cursorAbs = active.count - active.rows + y;
			const cursorX = x;
			const widthChanged = cols !== primary.cols;
			if (widthChanged) {
				if (active === primary) reflowPrimary(cols, rows, cursorAbs, cursorX);
				else reflowPrimary(cols, rows, -1, 0);
				resizeAlt(cols, rows, active === alternate ? cursorAbs : -1, cursorX);
			} else if (rows !== active.rows) {
				if (active === primary) {
					const previousCount = primary.count;
					primary.setRows(rows);
					restoreCursor(cursorAbs, cursorX, Math.max(0, previousCount - primary.count));
					alternate.rows = rows;
					alternate.setRows(rows);
				} else {
					alternate.resizeKeepTop(alternate.cols, rows);
					restoreCursor(cursorAbs, cursorX);
					primary.setRows(rows);
				}
			}
			scrollTop = 0;
			scrollBottom = rows - 1;
			tabs = defaultTabs(cols);
			x = clampCol(x);
			y = clampRow(y);
			markAll();
			return true;
		},
		viewport,
		viewportAt,
		/** Absolute buffer index of the viewport's first row, at a scrollback offset. */
		topRow(offset = 0) {
			const maxOffset = buffer === primary ? Math.max(0, buffer.count - buffer.rows) : 0;
			const fromBottom = Math.min(Math.max(0, offset), maxOffset);
			return Math.max(0, buffer.count - buffer.rows - fromBottom);
		},
		/** One row by absolute buffer index, for selection and copy. */
		lineAt(index) {
			return buffer.at(index);
		},
		lineSeqAt(index) {
			return buffer.at(index)?.seq ?? -1;
		},
		indexOfSeq(seq) {
			return buffer.indexOfSeq(seq);
		},
		/** Total rows held, scrollback included. */
		get bufferRows() { return buffer.count; },
		get cols() { return buffer.cols; },
		get rows() { return buffer.rows; },
		get alt() { return alt; },
		get title() { return title; },
		get cwd() { return cwd; },
		get bellCount() { return bell; },
		get modes() { return { ...modes }; },
		get cursor() { return { x, y, visible: modes.cursor, style: cursorStyle, blink: cursorBlink }; },
		get attrs() { return { ...attrs }; },
		get scrollbackRows() { return buffer === primary ? Math.max(0, buffer.count - buffer.rows) : 0; },
		get scrollbackBytes() { return buffer.bytes; },
		get firstSeq() { return buffer.firstSeq; },
		get dirtyAll() { return damage.full; },
		get damage() { return damage; },
		markFull() { markAll(); },
		consumeDamage() {
			const out = damage;
			damage = emptyDamage();
			damage.full = false;
			return out;
		},
		clearDirty() { damage.full = false; damage.rows.clear(); damage.scrolls.length = 0; },
		onTitle(listener) { listeners.title.push(listener); return () => { const i = listeners.title.indexOf(listener); if (i >= 0) listeners.title.splice(i, 1); }; },
		onBell(listener) { listeners.bell.push(listener); return () => { const i = listeners.bell.indexOf(listener); if (i >= 0) listeners.bell.splice(i, 1); }; },
		onOsc(listener) { listeners.osc.push(listener); return () => { const i = listeners.osc.indexOf(listener); if (i >= 0) listeners.osc.splice(i, 1); }; },
		onMode(listener) { listeners.mode.push(listener); return () => { const i = listeners.mode.indexOf(listener); if (i >= 0) listeners.mode.splice(i, 1); }; },
	};

	function viewport() {
		const start = Math.max(0, buffer.count - buffer.rows);
		return buffer.slice(start, buffer.rows);
	}

	function viewportAt(offset = 0) {
		const maxOffset = buffer === primary ? Math.max(0, buffer.count - buffer.rows) : 0;
		const fromBottom = Math.min(Math.max(0, offset), maxOffset);
		const start = Math.max(0, buffer.count - buffer.rows - fromBottom);
		return buffer.slice(start, buffer.rows);
	}
}

/** The parser runs one grapheme at a time; Intl.Segmenter is optional. */
const segmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
	? new Intl.Segmenter(undefined, { granularity: "grapheme" })
	: null;

/** OSC 7 reports a file URI; show the path, not the encoding. */
function fileUriToPath(value) {
	if (!value.startsWith("file://")) return null;
	try {
		const url = new URL(value);
		return decodeURIComponent(url.pathname);
	} catch {
		return null;
	}
}
