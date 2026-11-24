/* ---------------- terminal cell width ----------------
 *
 * A terminal is a grid of fixed cells, so every code point has to answer one
 * question before it can be drawn: how many cells does it occupy? Getting this
 * wrong is what turns a Chinese filename or an emoji into a broken prompt.
 *
 * Three answers are possible:
 *   0 — the code point is drawn *onto the previous cell* (combining marks,
 *       variation selectors, zero-width joiners);
 *   1 — a normal half-width cell;
 *   2 — a full-width cell, which also claims the next cell as a continuation
 *       (East Asian Wide/Fullwidth: CJK, Hangul, full-width forms, most emoji).
 *
 * The wide ranges below are the East Asian Width `W`/`F` classes as Unicode
 * defines them, compressed into starts/ends so the table stays small. Control
 * characters never reach this module: the parser consumes them separately.
 */

/** Inclusive ranges of full-width code points (East Asian Wide and Fullwidth). */
const WIDE = [
	0x1100, 0x115f, // Hangul Jamo init. consonants
	0x2e80, 0x303e, // CJK radicals, Kangxi, CJK symbols (before 0x303f)
	0x3041, 0x33ff, // Hiragana .. CJK compatibility
	0x3400, 0x4dbf, // CJK extension A
	0x4e00, 0x9fff, // CJK unified ideographs
	0xa000, 0xa4cf, // Yi
	0xa960, 0xa97f, // Hangul Jamo extended-A
	0xac00, 0xd7a3, // Hangul syllables
	0xf900, 0xfaff, // CJK compatibility ideographs
	0xfe10, 0xfe19, // vertical forms
	0xfe30, 0xfe6f, // CJK compatibility forms
	0xff00, 0xff60, // full-width forms
	0xffe0, 0xffe6, // full-width signs
	0x16fe0, 0x16fe4,
	0x17000, 0x187f7, // Tangut
	0x18800, 0x18cd5,
	0x1b000, 0x1b2fb, // Kana supplement/extended
	0x1f004, 0x1f004, // mahjong red dragon
	0x1f0cf, 0x1f0cf, // joker
	0x1f18e, 0x1f18e,
	0x1f191, 0x1f19a,
	0x1f200, 0x1f320, // enclosed ideographs, emoji
	0x1f32d, 0x1f335,
	0x1f337, 0x1f37c,
	0x1f37e, 0x1f393,
	0x1f3a0, 0x1f3ca,
	0x1f3cf, 0x1f3d3,
	0x1f3e0, 0x1f3f0,
	0x1f3f4, 0x1f3f4,
	0x1f3f8, 0x1f43e,
	0x1f440, 0x1f440,
	0x1f442, 0x1f4fc,
	0x1f4ff, 0x1f53d,
	0x1f54b, 0x1f54e,
	0x1f550, 0x1f567,
	0x1f57a, 0x1f57a,
	0x1f595, 0x1f596,
	0x1f5a4, 0x1f5a4,
	0x1f5fb, 0x1f64f,
	0x1f680, 0x1f6c5,
	0x1f6cc, 0x1f6cc,
	0x1f6d0, 0x1f6d2,
	0x1f6d5, 0x1f6d7,
	0x1f6eb, 0x1f6ec,
	0x1f6f4, 0x1f6fc,
	0x1f7e0, 0x1f7eb,
	0x1f90c, 0x1f93a,
	0x1f93c, 0x1f945,
	0x1f947, 0x1f9ff,
	0x1fa70, 0x1fa74,
	0x1fa78, 0x1fa7a,
	0x1fa80, 0x1fa86,
	0x1fa90, 0x1faa8,
	0x1fab0, 0x1fab6,
	0x1fac0, 0x1fac2,
	0x1fad0, 0x1fad6,
	0x20000, 0x2fffd, // CJK extension B and beyond
	0x30000, 0x3fffd,
];

/** Code points that are drawn onto the preceding cell and claim none. */
const ZERO = [
	0x0300, 0x036f, // combining diacritics
	0x0483, 0x0489,
	0x0591, 0x05bd,
	0x0610, 0x061a,
	0x064b, 0x065f,
	0x0900, 0x0902,
	0x093c, 0x093c,
	0x0941, 0x0948,
	0x0951, 0x0957,
	0x0e31, 0x0e31,
	0x0e34, 0x0e3a,
	0x0e47, 0x0e4e,
	0x1ab0, 0x1aff, // combining diacritical marks extended
	0x1dc0, 0x1dff, // combining diacritical marks supplement
	0x200b, 0x200f, // zero width space .. RTL mark
	0x2028, 0x202e, // line/paragraph separators, bidi controls
	0x20d0, 0x20f0, // combining marks for symbols
	0xfe00, 0xfe0f, // variation selectors
	0x1f3fb, 0x1f3ff, // emoji skin-tone modifiers
	0xfe20, 0xfe2f, // combining half marks
	0xfeff, 0xfeff, // zero width no-break space
	0xe0100, 0xe01ef, // variation selectors supplement
];

/** Binary search over a flat inclusive [start, end, start, end, …] table. */
function inRanges(code, table) {
	let low = 0;
	let high = table.length / 2 - 1;
	while (low <= high) {
		const mid = (low + high) >> 1;
		const start = table[mid * 2];
		const end = table[mid * 2 + 1];
		if (code < start) high = mid - 1;
		else if (code > end) low = mid + 1;
		else return true;
	}
	return false;
}

/**
 * Cells a code point occupies.
 *
 * @param code - Unicode code point.
 * @returns 0 for a combining/zero-width mark, 2 for East Asian Wide/Fullwidth,
 *   1 otherwise. Surrogates and unassigned code points count as 1 so a broken
 *   sequence still advances instead of collapsing onto the cursor.
 */
export function cellWidth(code) {
	if (code < 0x20 || (code >= 0x7f && code < 0xa0)) return 1; // defensive: controls are parsed out
	if (code >= 0xd800 && code <= 0xdfff) return 1; // lone surrogate
	if (code < 0x300) return 1; // Latin, Greek, Cyrillic, Hebrew, Arabic letters
	if (inRanges(code, ZERO)) return 0;
	if (inRanges(code, WIDE)) return 2;
	return 1;
}

/** Regional-indicator code points form one two-cell flag when paired. */
function isRegionalIndicator(code) {
	return code >= 0x1f1e6 && code <= 0x1f1ff;
}

/**
 * Cells one grapheme cluster occupies.
 *
 * A wide base wins over everything else; a ZWJ sequence with two emoji is one
 * two-cell glyph, not two separate glyphs. A pair of regional indicators is a
 * flag and also occupies two cells, even though each half is one cell alone.
 *
 * @param text - one user-perceived character (a grapheme cluster).
 * @returns 0 for a lone combining mark, 2 for a wide glyph or flag, 1 otherwise.
 */
export function graphemeWidth(text) {
	if (typeof text !== "string" || text === "") return 0;
	const codes = Array.from(text, (char) => char.codePointAt(0));
	if (codes.length === 2 && isRegionalIndicator(codes[0]) && isRegionalIndicator(codes[1])) return 2;
	let width = 0;
	for (const code of codes) {
		if (code === undefined) continue;
		const cells = cellWidth(code);
		if (cells === 2) return 2;
		if (cells === 1) width = 1;
	}
	return width;
}
