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
export const FLAG = { bold: 1, dim: 2, italic: 4, underline: 8, blink: 16, inverse: 32, invisible: 64, strike: 128, overline: 256 };

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
	if (cell.fl & FLAG.overline) parts.push("text-decoration:overline");
	if (cell.link) parts.push("cursor:pointer", "text-decoration:underline");
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
		// the panel edge would paint its background across the whole row. Keep
		// pendingBlanks though: a style change must re-emit leading/interior
		// spaces under the new run, or the row shifts left.
		if (run !== "") html += `<span style="${runStyle}">${run}</span>`;
		run = "";
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
 * @param options - container element, document, and theme/font accessors.
 * @returns `{ measure, paint, paintScrollbar, paintSearch, cellAt, stats, … }`.
 */
export function createRenderer({ container, doc = globalThis.document, theme = () => ({ fg: "#d4d4d4", bg: "#1e1e1e" }), font = () => ({ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }) } = {}) {
	const rowsEl = doc.createElement("div");
	rowsEl.className = "ce-term-rows";
	const selectionEl = doc.createElement("div");
	selectionEl.className = "ce-term-selection";
	const cursorEl = doc.createElement("div");
	cursorEl.className = "ce-term-cursor";
	const measureEl = doc.createElement("span");
	measureEl.className = "ce-term-measure";
	measureEl.textContent = "MMMMMMMMMM";
	container.appendChild(rowsEl);
	container.appendChild(selectionEl);
	container.appendChild(cursorEl);
	container.appendChild(measureEl);

	let cellWidth = 8;
	let rowHeight = 16;
	const rowEls = [];
	const versions = [];
	const seqs = [];
	const cache = new WeakMap();
	let themeValue = theme();
	let themeKey = signatureTheme(themeValue);
	let generation = 0;
	let lastCursor = null;
	let scrollbar = null;
	let searchLayer = null;
	let copyCursor = null;
	let searchRects = [];
	let stats = { paintedRows: 0, movedRows: 0, ms: 0 };

	function signatureTheme(value) {
		return `${value.fg ?? ""}|${value.bg ?? ""}|${value.selection ?? ""}`;
	}

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
			seqs.push(-1);
		}
		while (rowEls.length > count) {
			const el = rowEls.pop();
			el.remove();
			versions.pop();
			seqs.pop();
		}
	}

	/** Reuse the DOM nodes that scrolled off the top as the newly exposed rows. */
	function rotateRows(shift) {
		const count = rowEls.length;
		if (count === 0) return 0;
		const amount = ((shift % count) + count) % count;
		if (amount === 0) return 0;
		const movedEls = rowEls.splice(0, amount);
		for (const el of movedEls) rowsEl.appendChild(el);
		rowEls.push(...movedEls);
		const movedVersions = versions.splice(0, amount);
		versions.push(...movedVersions);
		const movedSeqs = seqs.splice(0, amount);
		seqs.push(...movedSeqs);
		for (let i = count - amount; i < count; i++) {
			versions[i] = -1;
			seqs[i] = -1;
		}
		return amount;
	}

	function lineHtml(line, key) {
		const cached = cache.get(line);
		if (cached !== undefined && cached.version === line.version && cached.key === key) return cached.html;
		const html = rowHtml(line, themeValue);
		cache.set(line, { version: line.version, key, html });
		return html;
	}

	/**
	 * Paint one screen state.
	 * @param screen - the emulator.
	 * @param options - `{ offset, damage }`; `damage` may be omitted.
	 * @returns paint statistics for the HUD and tests.
	 */
	function paint(screen, { offset = 0, damage = null } = {}) {
		const started = typeof performance !== "undefined" ? performance.now() : Date.now();
		themeValue = theme();
		const nextThemeKey = signatureTheme(themeValue);
		const themeChanged = nextThemeKey !== themeKey;
		if (themeChanged) {
			themeKey = nextThemeKey;
			invalidate();
		}
		const lines = screen.viewportAt(offset);
		ensureRows(lines.length);
		if (damage?.full) invalidate();
		let moved = 0;
		const scrolls = damage?.scrolls ?? [];
		const canScroll = damage !== null
			&& !damage.full
			&& offset === 0
			&& scrolls.length > 0
			&& scrolls.every((entry) => entry.whole === true);
		if (canScroll) moved = rotateRows(scrolls.reduce((sum, entry) => sum + entry.shift, 0));
		let painted = 0;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const seq = line?.seq ?? -1;
			const version = line?.version ?? 0;
			if (seqs[i] === seq && versions[i] === version && !themeChanged) continue;
			const html = line === undefined ? "" : lineHtml(line, `${themeKey}:${generation}`);
			if (rowEls[i].innerHTML !== html) rowEls[i].innerHTML = html;
			seqs[i] = seq;
			versions[i] = version;
			painted++;
		}
		const cursor = screen.cursor;
		const show = cursor.visible && offset === 0;
		cursorEl.style.display = show ? "block" : "none";
		if (show) {
			const style = cursor.style === "bar" ? "ce-term-cursor-bar" : cursor.style === "underline" ? "ce-term-cursor-underline" : "ce-term-cursor-block";
			const cursorClass = `${style}${cursor.blink ? " ce-term-cursor-blink" : ""}`;
			if (lastCursor !== cursorClass) {
				cursorEl.className = `ce-term-cursor ${cursorClass}`;
				lastCursor = cursorClass;
			}
			cursorEl.style.transform = `translate(${cursor.x * cellWidth}px, ${cursor.y * rowHeight}px)`;
			cursorEl.style.width = `${cellWidth}px`;
			cursorEl.style.height = `${rowHeight}px`;
		}
		stats = {
			paintedRows: painted,
			movedRows: moved,
			ms: (typeof performance !== "undefined" ? performance.now() : Date.now()) - started,
		};
		return stats;
	}

	/**
	 * Draw the scrollbar. Hidden when there is no retained history.
	 * @param metrics - `{ offset, maxOffset, viewportRows, trackHeight }`.
	 */
	function paintScrollbar(metrics) {
		const maxOffset = Math.max(0, metrics?.maxOffset ?? 0);
		if (maxOffset <= 0 && scrollbar === null) return null;
		if (scrollbar === null) {
			const track = doc.createElement("div");
			track.className = "ce-term-scrollbar";
			const thumb = doc.createElement("div");
			thumb.className = "ce-term-scrollbar-thumb";
			track.appendChild(thumb);
			container.appendChild(track);
			scrollbar = { track, thumb };
		}
		const { track, thumb } = scrollbar;
		if (maxOffset <= 0) {
			track.style.display = "none";
			return null;
		}
		const viewportRows = Math.max(1, metrics.viewportRows ?? 1);
		const trackHeight = Math.max(1, metrics.trackHeight ?? viewportRows * rowHeight);
		const thumbHeight = Math.max(12, Math.round((viewportRows / (maxOffset + viewportRows)) * trackHeight));
		const travel = Math.max(0, trackHeight - thumbHeight);
		const ratio = Math.min(1, Math.max(0, (metrics?.offset ?? 0) / maxOffset));
		track.style.display = "block";
		thumb.style.height = `${thumbHeight}px`;
		thumb.style.transform = `translateY(${Math.round((1 - ratio) * travel)}px)`;
		return { thumbHeight, trackHeight, travel };
	}

	/**
	 * Draw search highlights as overlay rectangles.
	 * @param rects - `[{ left, top, width, height, current }]` in cell pixels.
	 */
	function paintSearch(rects) {
		const requested = Array.isArray(rects) ? rects : [];
		if (requested.length === 0 && searchLayer === null) return;
		if (searchLayer === null) {
			searchLayer = doc.createElement("div");
			searchLayer.className = "ce-term-search-layer";
			container.appendChild(searchLayer);
		}
		const wanted = requested;
		while (searchLayer.children.length < wanted.length) {
			const el = doc.createElement("div");
			el.className = "ce-term-search-rect";
			searchLayer.appendChild(el);
			searchRects.push(el);
		}
		while (searchLayer.children.length > wanted.length) {
			const el = searchLayer.children[searchLayer.children.length - 1];
			el.remove();
			searchRects.pop();
		}
		for (let i = 0; i < wanted.length; i++) {
			const rect = wanted[i];
			const el = searchRects[i];
			el.className = `ce-term-search-rect${rect.current ? " ce-term-search-current" : ""}`;
			el.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
			el.style.width = `${rect.width}px`;
			el.style.height = `${rect.height}px`;
		}
	}

	/**
	 * Cell under a viewport point.
	 * @param clientX - pointer x in client coordinates.
	 * @param clientY - pointer y in client coordinates.
	 * @returns `{ x, y }` in cells, or null outside the grid.
	 */
	function cellAt(clientX, clientY) {
		const box = rowsEl.getBoundingClientRect();
		if (box.width <= 0 || box.height <= 0) return null;
		const x = Math.floor((clientX - box.left) / cellWidth);
		const y = Math.floor((clientY - box.top) / rowHeight);
		if (x < 0 || y < 0) return null;
		return { x: Math.min(x, Math.max(0, Math.round(box.width / cellWidth) - 1)), y };
	}

	/** Invalidate every cached row so the next paint rewrites all of them. */
	function invalidate() {
		for (let i = 0; i < versions.length; i++) versions[i] = -1;
		// WeakMap has no clear(); a generation bump retires every cached row.
		generation++;
	}

	/**
	 * Draw the copy-mode cursor (a hollow cell) without touching the grid.
	 * @param rect - `{ left, top, width, height }` or null to hide.
	 */
	function paintCopyCursor(rect) {
		if (rect === null || rect === undefined) {
			if (copyCursor !== null) copyCursor.style.display = "none";
			return;
		}
		if (copyCursor === null) {
			copyCursor = doc.createElement("div");
			copyCursor.className = "ce-term-copy-cursor";
			container.appendChild(copyCursor);
		}
		copyCursor.style.display = "block";
		copyCursor.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
		copyCursor.style.width = `${rect.width}px`;
		copyCursor.style.height = `${rect.height}px`;
	}

	/**
	 * Draw the selection as one rectangle per row segment.
	 * @param rects - rectangles in cell pixels: `{ left, top, width, height }`.
	 */
	function paintSelection(rects) {
		const wanted = Array.isArray(rects) ? rects : [];
		while (selectionEl.children.length < wanted.length) {
			const el = doc.createElement("div");
			el.className = "ce-term-selection-rect";
			selectionEl.appendChild(el);
		}
		while (selectionEl.children.length > wanted.length) {
			selectionEl.children[selectionEl.children.length - 1].remove();
		}
		for (let i = 0; i < wanted.length; i++) {
			const rect = wanted[i];
			const style = selectionEl.children[i].style;
			style.transform = `translate(${rect.left}px, ${rect.top}px)`;
			style.width = `${rect.width}px`;
			style.height = `${rect.height}px`;
		}
	}

	return {
		measure,
		cellAt,
		paint,
		paintSelection,
		paintCopyCursor,
		paintScrollbar,
		paintSearch,
		invalidate,
		get cellWidth() { return cellWidth; },
		get rowHeight() { return rowHeight; },
		get stats() { return stats; },
		get scrollbarElement() { return scrollbar?.track ?? null; },
		/** Size in device pixels consumed by the current grid. */
		gridSize(cols, rows) { return { width: cols * cellWidth, height: rows * rowHeight }; },
		dispose() {
			rowsEl.remove();
			selectionEl.remove();
			cursorEl.remove();
			measureEl.remove();
			scrollbar?.track.remove();
			searchLayer?.remove();
			copyCursor?.remove();
			rowEls.length = 0;
			versions.length = 0;
			seqs.length = 0;
			searchRects.length = 0;
		},
	};
}
