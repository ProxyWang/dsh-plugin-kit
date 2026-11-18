/* ---------------- key encoding: browser event -> bytes the shell expects ----------------
 *
 * A terminal does not send keys, it sends the bytes a VT would. This module is
 * that translation table, kept pure so every mapping can be asserted in Node
 * without a browser: a wrong arrow key or a swallowed Ctrl-C is invisible in a
 * screenshot and obvious in a test.
 *
 * Two rules follow xterm's own behaviour, because shells and vim depend on it:
 *   - arrows and Home/End switch to SS3 (`ESC O x`) while the application
 *     cursor-key mode (?1h) is on, which is how vim gets its own arrows;
 *   - modified keys use the CSI form `ESC [ 1 ; <mod> <final>`, where the
 *     modifier is 1 + shift(1) + alt(2) + ctrl(4) + meta(8).
 */

/** Modifier bit for the CSI parameter form. */
function modifierFor(event) {
	let value = 1;
	if (event.shiftKey) value += 1;
	if (event.altKey) value += 2;
	if (event.ctrlKey) value += 4;
	if (event.metaKey) value += 8;
	return value;
}

/** Final byte per cursor key, and its SS3 letter for application mode. */
const CURSOR_KEYS = {
	ArrowUp: ["A", "A"],
	ArrowDown: ["B", "B"],
	ArrowRight: ["C", "C"],
	ArrowLeft: ["D", "D"],
	Home: ["H", "H"],
	End: ["F", "F"],
};

/** Tilde-form keys: Insert, Delete, PageUp, PageDown, F5-F12. */
const TILDE_KEYS = {
	Insert: 2,
	Delete: 3,
	PageUp: 5,
	PageDown: 6,
	F5: 15,
	F6: 17,
	F7: 18,
	F8: 19,
	F9: 20,
	F10: 21,
	F11: 23,
	F12: 24,
};

/** SS3-form function keys F1-F4. */
const SS3_KEYS = { F1: "P", F2: "Q", F3: "R", F4: "S" };

/**
 * Encode a keydown into the bytes a shell expects.
 *
 * Printable characters deliberately return `null`: they are produced by the
 * hidden textarea's `input` event instead, which is the only path that gets
 * IME composition, dead keys and AltGr right.
 *
 * @param event - a KeyboardEvent-like object.
 * @param modes - the screen's modes (`appCursor`), for arrow-key form.
 * @returns bytes to send, or null to let the textarea handle the key.
 */
export function keyToBytes(event, modes = {}) {
	const { key, ctrlKey, altKey, metaKey, shiftKey } = event;
	if (key === undefined) return null;
	const modified = modifierFor(event) !== 1;

	// Ctrl+letter and the control punctuation. Command (meta) stays for the UI.
	if (ctrlKey && !altKey && !metaKey && key.length === 1) {
		const upper = key.toUpperCase();
		if (upper >= "A" && upper <= "Z") return String.fromCharCode(upper.charCodeAt(0) - 64);
		if (key === " ") return "\x00";
		if (key === "[") return "\x1b";
		if (key === "\\") return "\x1c";
		if (key === "]") return "\x1d";
		if (key === "^") return "\x1e";
		if (key === "_" || key === "-" ) return "\x1f";
		if (key === "?") return "\x7f";
		if (key === "@") return "\x00";
		return null;
	}

	if (key === "Enter") return altKey ? "\x1b\r" : "\r";
	if (key === "Tab") return shiftKey ? "\x1b[Z" : "\t";
	if (key === "Backspace") return ctrlKey ? "\x08" : "\x7f";
	if (key === "Escape") return "\x1b";
	if (key === " ") return ctrlKey ? "\x00" : null;

	const cursor = CURSOR_KEYS[key];
	if (cursor) {
		const [final, ss3] = cursor;
		if (!modified && modes.appCursor) return `\x1bO${ss3}`;
		if (!modified) return `\x1b[${final}`;
		return `\x1b[1;${modifierFor(event)}${final}`;
	}
	const tilde = TILDE_KEYS[key];
	if (tilde !== undefined) {
		return modified ? `\x1b[${tilde};${modifierFor(event)}~` : `\x1b[${tilde}~`;
	}
	const ss3 = SS3_KEYS[key];
	if (ss3) {
		return modified ? `\x1b[1;${modifierFor(event)}${ss3}` : `\x1bO${ss3}`;
	}
	return null;
}

/**
 * Wrap pasted text for the shell.
 *
 * Bracketed paste (?2004) is how a shell tells "this is a paste, do not execute
 * it line by line"; without it a multi-line paste runs each line as a command.
 *
 * @param text - clipboard text.
 * @param bracketed - whether the terminal is in bracketed-paste mode.
 * @returns the bytes to send.
 */
export function pasteToBytes(text, bracketed) {
	if (typeof text !== "string" || text === "") return "";
	// Normalise newlines: a pasted CRLF is one Enter, not two.
	const normalised = text.replace(/\r\n/gu, "\r").replace(/\n/gu, "\r");
	return bracketed ? `\x1b[200~${normalised}\x1b[201~` : normalised;
}
