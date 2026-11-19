/* ---------------- mouse reporting: pointer events -> the bytes a program expects ----------------
 *
 * When a full-screen program turns mouse reporting on (DECSET 1000/1002/1003),
 * the terminal must stop using the pointer for selection and start forwarding
 * it: vim's click-to-position, lazygit's rows and htop's buttons all arrive as
 * `ESC [ M …` bytes. Two encodings exist and the program chooses:
 *
 *   - normal (X10): `ESC [ M` followed by three offset bytes, which cannot
 *     address columns past 223;
 *   - SGR (?1006): `ESC [ < b ; x ; y M` for a press and `… m` for a release,
 *     with 1-based coordinates and no upper bound. This is what modern programs
 *     ask for, so it is preferred whenever the program enabled it.
 *
 * Shift is the usual escape hatch: holding it selects text even while the
 * program owns the pointer, which is why the caller decides between reporting
 * and selecting *before* encoding.
 */

/** Button numbers in the wire protocol. */
const BUTTON = { left: 0, middle: 1, right: 2, wheelUp: 64, wheelDown: 65, wheelLeft: 66, wheelRight: 67 };

/** Motion adds this to the button number. */
const MOTION = 32;

/** Modifier bits: shift 4, alt 8, ctrl 16. */
export function modifierBits(event) {
	return (event.shiftKey ? 4 : 0) | (event.altKey ? 8 : 0) | (event.ctrlKey ? 16 : 0);
}

/**
 * Whether a program currently owns the pointer.
 * @param modes - the screen's modes.
 * @returns whether reports should be sent instead of selecting.
 */
export function mouseOwned(modes) {
	return modes?.mouse !== undefined && modes.mouse !== "off";
}

/**
 * Whether this mode reports motion (only 1002 and 1003 do).
 * @param mode - the screen's mouse mode.
 * @returns whether dragging is reported.
 */
export function reportsMotion(mode) {
	return mode === "1002" || mode === "1003";
}

/**
 * Whether this mode reports motion without a button held (1003 only).
 * @param mode - the screen's mouse mode.
 * @returns whether hovering is reported.
 */
export function reportsHover(mode) {
	return mode === "1003";
}

/**
 * Encode one mouse event.
 *
 * @param event - `{ button, action, x, y, shiftKey, altKey, ctrlKey }` where
 *   `x`/`y` are 0-based cells, `action` is `press`, `release`, `drag` or `move`,
 *   and `button` names a {@link BUTTON} key (ignored for `move`).
 * @param options - `{ protocol, mode }`; `protocol` is `sgr` when ?1006 is on.
 * @returns the bytes to send, or null when this event must not be reported.
 */
export function encodeMouse(event, { protocol = "x10", mode = "1000" } = {}) {
	const { action } = event;
	if (action === "move" && !reportsHover(mode)) return null;
	if (action === "drag" && !reportsMotion(mode)) return null;
	if (action === "press" && mode === "off") return null;
	const button = action === "move" ? 3 : (BUTTON[event.button] ?? 0);
	let code = button + modifierBits(event);
	if (action === "drag" || action === "move") code += MOTION;
	// A wheel turn is a press with no matching release.
	const wheel = button >= 64;
	const column = Math.max(0, Math.trunc(event.x));
	const row = Math.max(0, Math.trunc(event.y));
	if (protocol === "sgr") {
		const final = action === "release" && !wheel ? "m" : "M";
		return `\x1b[<${code};${column + 1};${row + 1}${final}`;
	}
	// X10 cannot address past column/row 223, and cannot repeat the button on release.
	if (column > 222 || row > 222) return null;
	const released = action === "release" ? 3 : code;
	const bytes = [32 + released, 33 + Math.min(column, 222), 33 + Math.min(row, 222)];
	return `\x1b[M${String.fromCharCode(...bytes)}`;
}

/**
 * Encode a wheel event as a mouse report.
 * @param event - `{ deltaY, x, y, ...modifiers }`.
 * @param options - `{ protocol, mode }`.
 * @returns the bytes, or null when the program does not own the wheel.
 */
export function encodeWheel(event, options) {
	if (!mouseOwned({ mouse: options?.mode })) return null;
	return encodeMouse({ ...event, button: event.deltaY < 0 ? "wheelUp" : "wheelDown", action: "press" }, options);
}
