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
 *   - an absolute row for the primary buffer is `lines.length - rows + y`.
 */

import { cellWidth } from "./width.js";

/** Cell attribute bits; a small bitmask keeps equality checks cheap. */
export const FLAG = { bold: 1, dim: 2, italic: 4, underline: 8, blink: 16, inverse: 32, invisible: 64, strike: 128 };

/** Default attributes. `-1` means "use the theme's default colour". */
const DEFAULT_ATTR = { fg: -1, bg: -1, fl: 0, link: null };

/** Truecolor values are stored above the 256 palette indices. */
const TRUECOLOR = 1 << 24;

/** DEC special graphics (ESC ( 0) to Unicode, for TUIs that draw boxes. */
const DEC_GRAPHICS = {
	"`": "◆", a: "▒", b: "␉", c: "␌", d: "␍", e: "␊", f: "°", g: "±", h: "␤", i: "␋",
	j: "┘", k: "┐", l: "┌", m: "└", n: "┼", o: "⎺", p: "⎻", q: "─", r: "⎼", s: "⎽",
	t: "├", u: "┤", v: "┴", w: "┬", x: "│", y: "≤", z: "≥", "{": "π", "|": "≠", "}": "£", "~": "·",
};

/** A blank line: the cells array is sparse, so an untouched row costs one array. */
function blankLine(cols) {
	return { cells: new Array(cols).fill(undefined), wrapped: false, version: 1 };
}

/** One buffer: the primary screen with scrollback, or the alternate screen. */
class Buffer {
	constructor(cols, rows, scrollback) {
		this.cols = cols;
		this.rows = rows;
		this.scrollback = scrollback;
		this.lines = [];
		for (let i = 0; i < rows; i++) this.lines.push(blankLine(cols));
	}

	/** Grow/shrink the grid, keeping the bottom `rows` rows on screen. */
	resize(cols, rows) {
		for (const line of this.lines) {
			if (line.cells.length !== cols) line.cells.length = cols;
			line.version++;
		}
		while (this.lines.length < rows) this.lines.push(blankLine(cols));
		while (this.lines.length > rows + this.scrollback) this.lines.shift();
		this.cols = cols;
		this.rows = rows;
	}
}

/**
 * Create one terminal screen.
 *
 * @param options - initial grid size and retained scrollback rows.
 * @returns the emulator: `write`, `resize`, viewport/cursor readers and the
 *   parser's saved state (so a frame boundary mid-sequence is harmless).
 */
export function createScreen({ cols = 80, rows = 24, scrollback = 1000 } = {}) {
	const primary = new Buffer(cols, rows, scrollback);
	const alternate = new Buffer(cols, rows, 0);
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
		alt: false, bracketedPaste: false, mouse: "off", echo: true,
	};
	let cursorStyle = "block";
	let cursorBlink = true;
	let title = "";
	let bell = 0;
	let dirtyAll = true;
	let charsetG0 = "ascii";
	const listeners = { title: [], bell: [] };

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

	const absRow = (row = y) => buffer.lines.length - buffer.rows + row;

	function lineAt(row) {
		const index = absRow(row);
		if (index < 0) return null;
		return buffer.lines[index] ?? null;
	}

	function touch(row) {
		const line = lineAt(row);
		if (line) line.version++;
	}

	function touchAll() {
		dirtyAll = true;
		for (const line of buffer.lines) line.version++;
	}

	/* ---------------- writes ---------------- */

	/** Blank cells carry the current background colour (BCE). */
	function blankCell() {
		return attrs.bg === -1 && attrs.fl === 0 ? undefined : { c: " ", fg: -1, bg: attrs.bg, fl: attrs.fl & FLAG.underline ? 0 : 0, w: 1, link: null };
	}

	function put(codePoint, text) {
		const width = cellWidth(codePoint);
		const line = lineAt();
		if (!line) return;
		if (width === 0) {
			// Combining mark: attach to the previous cell, or drop it at column 0.
			const col = Math.max(0, x - 1);
			const cell = line.cells[col];
			if (cell) {
				cell.c = cell.c + text;
				line.version++;
			}
			return;
		}
		if (modes.wrap && x + width > buffer.cols) {
			line.wrapped = true;
			x = 0;
			indexDown();
		}
		if (x + width > buffer.cols) x = buffer.cols - width;
		if (modes.insert) insertCells(width);
		const target = lineAt();
		if (!target) return;
		if (width === 2 && x + 1 < buffer.cols) {
			// The continuation cell keeps the grid rectangular for erases.
			target.cells[x + 1] = { c: "", fg: attrs.fg, bg: attrs.bg, fl: attrs.fl, w: 0, link: attrs.link };
		}
		target.cells[x] = { c: text, fg: attrs.fg, bg: attrs.bg, fl: attrs.fl, w: width, link: attrs.link };
		target.version++;
		x += width;
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

	/**
	 * Scroll the region up.
	 *
	 * The viewport is the last `rows` lines of the buffer, so a full-screen
	 * scroll only has to append a blank line: the line that leaves the viewport
	 * keeps sitting above it as scrollback. A region scroll (DECSTBM, IL/DL) has
	 * to discard its top line instead, because nothing outside the region may
	 * move.
	 */
	function scrollUp(count) {
		const top = absRow(scrollTop);
		const bottom = absRow(scrollBottom);
		if (top < 0 || bottom >= buffer.lines.length) return;
		const whole = scrollTop === 0 && scrollBottom === buffer.rows - 1;
		for (let i = 0; i < count; i++) {
			if (whole) buffer.lines.push(blankLine(buffer.cols));
			else buffer.lines.splice(top, 0, blankLine(buffer.cols));
			if (!whole) buffer.lines.splice(bottom + 1, 1);
			while (buffer.lines.length > buffer.rows + buffer.scrollback) buffer.lines.shift();
		}
		dirtyAll = true;
	}

	function scrollDown(count) {
		const top = absRow(scrollTop);
		const bottom = absRow(scrollBottom);
		if (top < 0 || bottom >= buffer.lines.length) return;
		for (let i = 0; i < count; i++) {
			buffer.lines.splice(bottom, 1);
			buffer.lines.splice(top, 0, blankLine(buffer.cols));
		}
		dirtyAll = true;
	}

	function carriageReturn() { x = 0; }
	function lineFeed() { indexDown(); if (modes.echo) { /* column kept: VT semantics */ } }

	/* ---------------- erasing ---------------- */

	function eraseCells(row, from, to) {
		const line = lineAt(row);
		if (!line) return;
		const blank = blankCell();
		for (let col = Math.max(0, from); col < Math.min(buffer.cols, to); col++) line.cells[col] = blank;
		line.version++;
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
			// `clear` (ED 3) also drops the scrollback above the viewport.
			const keep = Math.max(0, buffer.lines.length - buffer.rows);
			buffer.lines.splice(0, keep);
			dirtyAll = true;
		}
	}

	function insertCells(count) {
		const line = lineAt();
		if (!line) return;
		const head = line.cells.slice(0, x);
		const rest = line.cells.slice(x, Math.max(0, buffer.cols - count));
		line.cells = head.concat(new Array(count).fill(undefined), rest).slice(0, buffer.cols);
		while (line.cells.length < buffer.cols) line.cells.push(undefined);
		line.version++;
	}

	function deleteCells(count) {
		const line = lineAt();
		if (!line) return;
		const head = line.cells.slice(0, x);
		const rest = line.cells.slice(x + count);
		line.cells = head.concat(rest, new Array(count).fill(undefined)).slice(0, buffer.cols);
		while (line.cells.length < buffer.cols) line.cells.push(undefined);
		line.version++;
	}

	/* ---------------- alternate screen ---------------- */

	function enterAlternate(clear) {
		if (!alt) {
			alt = true;
			modes.alt = true;
			buffer = alternate;
			if (clear) alternate.lines = Array.from({ length: alternate.rows }, () => blankLine(alternate.cols));
			dirtyAll = true;
		} else if (clear) {
			alternate.lines = Array.from({ length: alternate.rows }, () => blankLine(alternate.cols));
			dirtyAll = true;
		}
	}

	function leaveAlternate() {
		if (!alt) return;
		alt = false;
		modes.alt = false;
		buffer = primary;
		scrollTop = 0;
		scrollBottom = primary.rows - 1;
		dirtyAll = true;
	}

	/* ---------------- SGR ---------------- */

	function setColor(target, params, index) {
		// 38;5;n / 38;2;r;g;b (and the `:` sub-parameter form, normalised upstream).
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
				case 21: case 22: attrs.fl &= ~(FLAG.bold | FLAG.dim); break;
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
				const previous = line?.cells[x - 1];
				if (previous) for (let i = 0; i < count(); i++) put(previous.c.codePointAt(0) ?? 32, previous.c);
				break;
			}
			case "d": y = clampRow(count() - 1); break;
			case "e": y = Math.min(scrollBottom, y + count()); break;
			case "g": if (Number.isFinite(params0) && params0 === 3) tabs.clear(); else tabs.delete(x); break;
			case "h": setModes(true); break;
			case "l": setModes(false); break;
			case "m": applySgr(list.length === 0 ? [0] : list); break;
			case "n": break; // status reports are answered by the host side, not us
			case "q": cursorStyle = ["block", "block", "block", "underline", "underline", "bar", "bar"][Number.isFinite(params0) ? params0 : 0] ?? "block"; break;
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
			case "u": x = saved.x; y = saved.y; attrs = { ...saved.attrs }; break;
			case "t": break; // window manipulation: ignored on purpose
			default: break;
		}
	}

	/** IL/DL scroll only the region below the cursor. */
	function scrollDownAt(countLines) {
		const top = absRow(y);
		const bottom = absRow(scrollBottom);
		if (top < 0 || bottom >= buffer.lines.length) return;
		for (let i = 0; i < countLines; i++) {
			buffer.lines.splice(bottom, 1);
			buffer.lines.splice(top, 0, blankLine(buffer.cols));
		}
		dirtyAll = true;
	}

	function scrollUpAt(countLines) {
		const top = absRow(y);
		const bottom = absRow(scrollBottom);
		if (top < 0 || bottom >= buffer.lines.length) return;
		for (let i = 0; i < countLines; i++) {
			buffer.lines.splice(top, 1);
			buffer.lines.splice(bottom, 0, blankLine(buffer.cols));
		}
		dirtyAll = true;
	}

	function setModes(on) {
		const isPrivate = prefix === "?";
		for (const value of list) {
			if (!isPrivate) continue;
			switch (value) {
				case 1: modes.appCursor = on; break;
				case 6: modes.origin = on; y = on ? scrollTop : 0; x = 0; break;
				case 7: modes.wrap = on; break;
				case 4: modes.insert = on; break;
				case 25: modes.cursor = on; break;
				case 47: case 1047: if (on) enterAlternate(false); else leaveAlternate(); break;
				case 1049:
					if (on) { saved = { x, y, attrs: { ...attrs }, origin: modes.origin }; enterAlternate(true); x = 0; y = 0; }
					else { leaveAlternate(); x = saved.x; y = saved.y; }
					break;
				case 1000: case 1002: case 1003: modes.mouse = on ? String(value) : "off"; break;
				case 2004: modes.bracketedPaste = on; break;
				default: break;
			}
		}
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
			case "8": x = saved.x; y = saved.y; attrs = { ...saved.attrs }; break;
			case "c": reset(); break;
			case "H": tabs.add(x); break;
			default: break;
		}
	}

	function reset() {
		alt = false;
		modes.alt = false;
		buffer = primary;
		primary.lines = Array.from({ length: primary.rows }, () => blankLine(primary.cols));
		alternate.lines = Array.from({ length: alternate.rows }, () => blankLine(alternate.cols));
		x = 0;
		y = 0;
		attrs = { ...DEFAULT_ATTR };
		scrollTop = 0;
		scrollBottom = primary.rows - 1;
		tabs = defaultTabs(primary.cols);
		modes = { ...modes, wrap: true, origin: false, insert: false, cursor: true, appCursor: false, bracketedPaste: false, mouse: "off" };
		dirtyAll = true;
	}

	function dispatchOsc(payload) {
		const semicolon = payload.indexOf(";");
		const command = semicolon === -1 ? payload : payload.slice(0, semicolon);
		const body = semicolon === -1 ? "" : payload.slice(semicolon + 1);
		if (command === "0" || command === "2") {
			title = body;
			for (const listener of listeners.title) listener(title);
		}
		// 7 (cwd), 8 (hyperlinks), 10-19 (colours): consumed, not rendered here.
	}

	/** Feed one frame of output. A sequence split across frames resumes here. */
	function write(data) {
		if (typeof data !== "string" || data === "") return;
		const length = data.length;
		let i = 0;
		while (i < length) {
			if (state === "ground") {
				// Fast path: copy the printable run in one go.
				let end = i;
				while (end < length) {
					const code = data.charCodeAt(end);
					if (code < 0x20 || code === 0x7f || code === 0x1b) break;
					end++;
				}
				if (end > i) {
					writeText(data.slice(i, end), end - i === 0);
					i = end;
					continue;
				}
				const ch = data[i];
				const code = data.charCodeAt(i);
				i++;
				if (code === 0x1b) { state = "escape"; intermediate = ""; continue; }
				if (code === 0x0d) { carriageReturn(); continue; }
				if (code === 0x0a || code === 0x0b || code === 0x0c) { lineFeed(); continue; }
				if (code === 0x08) { x = Math.max(0, x - 1); continue; }
				if (code === 0x09) { x = nextTab(x); continue; }
				if (code === 0x07) { bell++; for (const listener of listeners.bell) listener(); continue; }
				void ch;
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
				// Malformed: drop the sequence rather than guess.
				state = "ground";
				continue;
			}
			if (state === "osc") {
				const ch = data[i++];
				if (ch === "\u0007") { state = "ground"; dispatchOsc(osc); osc = ""; continue; }
				if (ch === "\u001b") { state = "oscEsc"; continue; }
				osc += ch;
				if (osc.length > 4096) { state = "ground"; osc = ""; }
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
				const ch = data[i++];
				state = "ground";
				void ch;
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

	/** Write a run of printable characters, applying the DEC graphics mapping. */
	function writeText(text, _unused) {
		if (charsetG0 === "dec") {
			for (const ch of text) {
				const mapped = DEC_GRAPHICS[ch];
				if (mapped) put(mapped.codePointAt(0), mapped);
				else put(ch.codePointAt(0), ch);
			}
			return;
		}
		for (const ch of text) {
			const code = ch.codePointAt(0);
			if (code === undefined) continue;
			if (code < 0x20) continue;
			put(code, ch);
		}
	}

	/* ---------------- readers ---------------- */

	/** Rows the renderer should paint: the viewport, oldest first. */
	function viewport() {
		const start = Math.max(0, buffer.lines.length - buffer.rows);
		return buffer.lines.slice(start, start + buffer.rows);
	}

	/**
	 * The viewport shifted into scrollback.
	 * @param offset - rows above the bottom, 0 for the live viewport.
	 * @returns that many lines higher, clamped to the retained scrollback.
	 */
	function viewportAt(offset = 0) {
		const maxOffset = buffer === primary ? Math.max(0, buffer.lines.length - buffer.rows) : 0;
		const fromBottom = Math.min(Math.max(0, offset), maxOffset);
		const start = Math.max(0, buffer.lines.length - buffer.rows - fromBottom);
		if (fromBottom === 0) return viewport();
		return buffer.lines.slice(start, start + buffer.rows);
	}

	return {
		write,
		reset,
		resize(cols, rows) {
			if (cols === buffer.cols && rows === buffer.rows) return false;
			primary.resize(cols, rows);
			alternate.resize(cols, rows);
			scrollTop = 0;
			scrollBottom = rows - 1;
			tabs = defaultTabs(cols);
			x = clampCol(x);
			y = clampRow(y);
			dirtyAll = true;
			return true;
		},
		viewport,
		viewportAt,
		get cols() { return buffer.cols; },
		get rows() { return buffer.rows; },
		get alt() { return alt; },
		get title() { return title; },
		get bellCount() { return bell; },
		get modes() { return { ...modes }; },
		get cursor() { return { x, y, visible: modes.cursor, style: cursorStyle, blink: cursorBlink }; },
		get attrs() { return { ...attrs }; },
		get scrollbackRows() { return buffer === primary ? Math.max(0, buffer.lines.length - buffer.rows) : 0; },
		get dirtyAll() { return dirtyAll; },
		clearDirty() { dirtyAll = false; },
		onTitle(listener) { listeners.title.push(listener); return () => { const i = listeners.title.indexOf(listener); if (i >= 0) listeners.title.splice(i, 1); }; },
		onBell(listener) { listeners.bell.push(listener); return () => { const i = listeners.bell.indexOf(listener); if (i >= 0) listeners.bell.splice(i, 1); }; },
	};
}
