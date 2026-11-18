/* ---------------- terminal renderer: rows, diffing, cursor ----------------
 *
 * The emulator in `screen.js` owns state; this module owns paint. Splitting the
 * two is the whole point of rendering the terminal ourselves: the emulator can
 * be exercised in Node, and the painter can decide *when* to draw instead of
 * being scheduled by a library.
 *
 * The paint model is deliberately simple and fast enough for a terminal:
 *   - the viewport is one element per row, painted from a row's version
 *     counter, so an unchanged row is never touched;
 *   - a row becomes a handful of spans (one per attribute run) rather than one
 *     span per cell, which keeps the DOM small during heavy coloured redraws
 *     (a powerlevel10k prompt is dozens of SGR changes per line);
 *   - the cursor is a single positioned element, so moving it never rewrites
 *     the grid.
 */

const TRUECOLOR = 1 << 24;
export const FLAG = { bold: 1, dim: 2, italic: 4, underline: 8, blink: 16, inverse: 32, invisible: 64, strike: 128 };

/** Standard xterm 256-colour palette; the first 16 are the ANSI set. */
const BASE16 = [
	"#000000", "#cd0000", "#00cd00", "#cdcd00", "#0000ee", "#cd00cd", "#00cdcd", "#e5e5e5",
	"#7f7f7f", "#ff0000", "#00ff00", "#ffff00", "#5c5cff", "#ff00ff", "#00ffff", "#ffffff",
];

let paletteCache = null;

/** The 256-entry palette, computed once. */
export function palette256() {
	if (paletteCache) return paletteCache;
	const colors = BASE16.slice();
	const steps = [0, 95, 135, 175, 215, 255];
	for (let r = 0; r < 6; r++) {
		for (let g = 0; g < 6; g++) {
			for (let b = 0; b < 6; b++) colors.push(rgbHex(steps[r], steps[g], steps[b]));
		}
	}
	for (let i = 0; i < 24; i++) {
		const level = 8 + i * 10;
		colors.push(rgbHex(level, level, level));
	}
	paletteCache = colors;
	return colors;
}

function rgbHex(r, g, b) {
	return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Resolve a stored colour to CSS.
 * @param value - -1 for the theme default, a palette index, or TRUECOLOR|rgb.
 * @param fallback - CSS colour for the theme default.
 * @returns a CSS colour string.
 */
export function colorCss(value, fallback) {
	if (value === -1 || value === undefined || value === null) return fallback;
	if (value & TRUECOLOR) {
		const rgb = value & 0xffffff;
		return rgbHex((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
	}
	return palette256()[value] ?? fallback;
}

/** Escape the five characters that could break out of a text node. */
function escapeHtml(text) {
	if (text === "&") return "&amp;";
	if (text === "<") return "&lt;";
	if (text === ">") return "&gt;";
	if (text === '"') return "&quot;";
	if (text === "'") return "&#39;";
	return text;
}

/**
 * Attribute signature of one cell, so runs can be coalesced by string compare.
 * @param cell - a screen cell.
 * @param theme - `{ fg, bg }` defaults.
 * @returns `[fgCss, bgCss, styleCss]`.
 */
function signature(cell, theme) {
	const inverse = (cell.fl & FLAG.inverse) !== 0;
	const fg = colorCss(inverse ? cell.bg : cell.fg, inverse ? theme.bg : theme.fg);
	const bg = colorCss(inverse ? cell.fg : cell.bg, inverse ? theme.fg : theme.bg);
	const parts = [];
	if (cell.fl & FLAG.bold) parts.push("font-weight:600");
	if (cell.fl & FLAG.dim) parts.push("opacity:.65");
	if (cell.fl & FLAG.italic) parts.push("font-style:italic");
	if (cell.fl & FLAG.underline) parts.push("text-decoration:underline");
	if (cell.fl & FLAG.strike) parts.push("text-decoration:line-through");
	if (cell.fl & FLAG.invisible) parts.push("visibility:hidden");
	if (cell.bg !== -1 || inverse) parts.push(`background:${bg}`);
	parts.push(`color:${fg}`);
	return parts.join(";");
}

/**
 * Render one row to HTML: one span per attribute run.
 * @param line - a buffer line.
 * @param theme - default colours.
 * @returns the row's inner HTML.
 */
export function rowHtml(line, theme) {
	const cells = line?.cells ?? [];
	let html = "";
	let run = "";
	let runStyle = null;
	let pendingBlanks = 0;
	const flushBlanks = () => {
		if (pendingBlanks > 0 && runStyle !== null) run += " ".repeat(pendingBlanks);
		pendingBlanks = 0;
	};
	const flush = () => {
		// Trailing blanks are dropped, not flushed: a coloured span that reaches
		// the panel edge would paint its background across the whole row.
		if (run !== "") html += `<span style="${runStyle}">${run}</span>`;
		run = "";
		pendingBlanks = 0;
	};
	for (let i = 0; i < cells.length; i++) {
		const cell = cells[i];
		if (!cell) {
			// Blank trailing cells cost nothing; interior blanks become spaces.
			pendingBlanks++;
			continue;
		}
		if (cell.w === 0) continue; // continuation of a wide glyph
		const style = signature(cell, theme);
		if (style !== runStyle) {
			flush();
			runStyle = style;
		}
		flushBlanks();
		run += escapeHtml(cell.c);
	}
	// Trailing blanks are dropped so the row box does not paint a background
	// across the whole width; the container's background already matches.
	flush();
	return html;
}

/**
 * Create a painter bound to one container element.
 *
 * @param options - container element, document, and theme accessors.
 * @returns `{ measure, paint, cursor, rowHeight, cellWidth, dispose }`.
 */
export function createRenderer({ container, doc = globalThis.document, theme = () => ({ fg: "#d4d4d4", bg: "#1e1e1e" }), font = () => ({ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }) } = {}) {
	const rowsEl = doc.createElement("div");
	rowsEl.className = "ce-term-rows";
	const cursorEl = doc.createElement("div");
	cursorEl.className = "ce-term-cursor";
	const measureEl = doc.createElement("span");
	measureEl.className = "ce-term-measure";
	measureEl.textContent = "MMMMMMMMMM";
	container.appendChild(rowsEl);
	container.appendChild(cursorEl);
	container.appendChild(measureEl);

	let cellWidth = 8;
	let rowHeight = 16;
	let rowEls = [];
	const versions = [];
	let themeValue = theme();
	let lastCursor = null;

	function measure() {
		const { fontFamily, fontSize } = font();
		const css = `${fontSize}px ${fontFamily}`;
		measureEl.style.font = css;
		rowsEl.style.font = css;
		rowsEl.style.fontKerning = "none";
		const width = measureEl.getBoundingClientRect().width / 10;
		if (width > 0) cellWidth = width;
		const style2 = doc.defaultView?.getComputedStyle?.(rowsEl);
		const lineHeight = style2 ? Number.parseFloat(style2.lineHeight) : Number.NaN;
		rowHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : Math.ceil(font().fontSize * 1.2);
		for (const el of rowEls) {
			el.style.height = `${rowHeight}px`;
			el.style.lineHeight = `${rowHeight}px`;
		}
		return { cellWidth, rowHeight };
	}

	function ensureRows(count) {
		while (rowEls.length < count) {
			const el = doc.createElement("div");
			el.className = "ce-term-row";
			el.style.height = `${rowHeight}px`;
			el.style.lineHeight = `${rowHeight}px`;
			rowsEl.appendChild(el);
			rowEls.push(el);
			versions.push(-1);
		}
		while (rowEls.length > count) {
			const el = rowEls.pop();
			el.remove();
			versions.pop();
		}
	}

	/**
	 * Paint one screen state.
	 * @param screen - the emulator.
	 * @param options - `{ offset }` scrollback offset in rows (0 = bottom).
	 */
	function paint(screen, { offset = 0 } = {}) {
		themeValue = theme();
		const lines = screen.viewportAt(offset);
		ensureRows(lines.length);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const version = line?.version ?? 0;
			if (versions[i] === version) continue;
			versions[i] = version;
			rowEls[i].innerHTML = rowHtml(line, themeValue);
		}
		const cursor = screen.cursor;
		const show = cursor.visible && offset === 0;
		cursorEl.style.display = show ? "block" : "none";
		if (show) {
			const style = cursor.style === "bar" ? "ce-term-cursor-bar" : cursor.style === "underline" ? "ce-term-cursor-underline" : "ce-term-cursor-block";
			if (lastCursor !== style) {
				cursorEl.className = `ce-term-cursor ${style}${cursor.blink ? " ce-term-cursor-blink" : ""}`;
				lastCursor = style;
			}
			cursorEl.style.transform = `translate(${cursor.x * cellWidth}px, ${cursor.y * rowHeight}px)`;
			cursorEl.style.width = `${cellWidth}px`;
			cursorEl.style.height = `${rowHeight}px`;
		}
	}

	/** Invalidate every cached row so the next paint rewrites all of them. */
	function invalidate() {
		for (let i = 0; i < versions.length; i++) versions[i] = -1;
	}

	return {
		measure,
		paint,
		invalidate,
		get cellWidth() { return cellWidth; },
		get rowHeight() { return rowHeight; },
		/** Size in device pixels consumed by the current grid. */
		gridSize(cols, rows) { return { width: cols * cellWidth, height: rows * rowHeight }; },
		dispose() {
			rowsEl.remove();
			cursorEl.remove();
			measureEl.remove();
			rowEls = [];
			versions.length = 0;
		},
	};
}
