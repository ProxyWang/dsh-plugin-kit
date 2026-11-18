/* ---------------- system terminal entry ----------------
 *
 * The workspace's terminal is the plugin's own emulator (see `vt/` and
 * `termtab.js`), so this module only carries the *other* half of the offer:
 * opening the operating system's terminal in the Session directory, for the
 * work a native window still does better (a remote shell, a GPU TUI, a second
 * monitor). The Host owns platform probing and the detached launch; the Client
 * only decides whether the entry is offered and reports the Host's own error.
 */

import { api } from "./api.js";

// A terminal window takes a moment to appear; a second click inside this window
// is a double-click, not a request for a second window.
const OPEN_DEBOUNCE_MS = 900;

/**
 * Whether the running Client can ask the Host for a system terminal.
 *
 * Desktop is the only runtime where the Host and the person share a screen and
 * an operating-system session, so a remote Web profile hides the entry instead
 * of opening a window on a machine nobody is looking at.
 *
 * @param desktop - the Desktop capability global (`window.dshDesktop`).
 * @returns whether the entry should be offered.
 */
export function externalTerminalAvailable(desktop = globalThis.dshDesktop) {
	return Boolean(desktop);
}

/**
 * Build the workspace-facing entry for the operating system's terminal.
 *
 * @param options - injectable Host call and clock (tests), plus the Desktop
 *   capability used for availability.
 * @returns `{ available, open }`; `open(cwd)` resolves to
 *   `{ ok: true, value }` or `{ ok: false, reason, error? }` with the reason
 *   `unavailable`, `noSession`, `busy` or `failed`.
 */
export function createTerminalEntry({
	call = api,
	desktop = globalThis.dshDesktop,
	now = () => Date.now(),
	debounceMs = OPEN_DEBOUNCE_MS,
} = {}) {
	let openedAt = Number.NEGATIVE_INFINITY;
	const available = () => externalTerminalAvailable(desktop);
	const open = async (cwd) => {
		if (!available()) return { ok: false, reason: "unavailable" };
		if (typeof cwd !== "string" || cwd === "") return { ok: false, reason: "noSession" };
		const at = now();
		if (at - openedAt < debounceMs) return { ok: false, reason: "busy" };
		openedAt = at;
		try {
			const res = await call("terminal.open", { cwd });
			if (res && res.ok) return { ok: true, value: res.value };
			return { ok: false, reason: "failed", error: String(res?.error ?? "") };
		} catch (error) {
			return { ok: false, reason: "failed", error: String(error?.message ?? error) };
		}
	};
	return { available, open };
}

/** Inert entry used when the host services are absent, so callers stay unconditional. */
export const inertTerminalEntry = {
	available: () => false,
	open: async () => ({ ok: false, reason: "unavailable" }),
};
