/* ---------------- host terminal entry: open a terminal beside the workspace ----------------
 *
 * The workspace never renders a terminal of its own. It asks the host's
 * `terminal` tab type (`@deepseek-ai/dsh-client-ui-sidebar-terminal`) to open,
 * through the public sidebar navigation controller, so xterm.js, input
 * ownership, window holds, reload bindings, theme and the user-terminal
 * permission model stay the product's business.
 *
 * Two host contract facts shape this module:
 *   - `preferNewPane: true` asks the focused docked pane to *split* under the
 *     host's two-pane and room rules, and falls back to a tab inside that pane
 *     when there is no room. So "beside the workspace" is a preference, not a
 *     guarantee, and the copy says so.
 *   - The `terminal` type declares `multiple: true`: every open is a new
 *     instance with its own content address, and the host never reveals an
 *     existing one. The Session quota (`maxTerminals`, default 8) is reported
 *     by the terminal tab itself, so this entry does not second-guess it.
 *
 * Availability is a registry probe, not a guess: profiles without the terminal
 * tab type hide the affordance entirely. Methods return result objects instead
 * of throwing, because callers sit in React event handlers.
 */

const TERMINAL_KIND = "terminal";

// The host focuses a terminal's xterm textarea only when its `visible` or
// `writable` state flips (TerminalScreen in dsh-client-ui-sidebar-terminal).
// Opening beside an already-focused workspace pane can leave both unchanged —
// a second terminal in the same pane, or a fast reconnect — so the keyboard
// stays wherever it was and typing goes nowhere. Hand focus over explicitly
// once the new screen exists; retries stop at the first success or the deadline.
const FOCUS_RETRY_MS = 120;
const FOCUS_DEADLINE_MS = 3000;

/**
 * Focus the newest live host terminal screen in the product document.
 *
 * Only `[data-sidebar-terminal]` sections are touched, so the workspace never
 * grabs focus for itself here. A screen without an `.xterm` child has not
 * connected yet (guide / loading / error states) and is skipped, not forced.
 *
 * @param doc - the product document (injectable for tests).
 * @returns whether a terminal textarea took focus.
 */
export function focusHostTerminal(doc = globalThis.document) {
	try {
		const screens = doc?.querySelectorAll?.("[data-sidebar-terminal]") ?? [];
		for (let i = screens.length - 1; i >= 0; i--) {
			const screen = screens[i];
			if (screen?.isConnected === false) continue;
			if (screen.closest?.('[aria-hidden="true"], [hidden], [inert]')) continue;
			const xterm = screen.querySelector?.(".xterm");
			if (!xterm) continue;
			const textarea = xterm.querySelector?.("textarea");
			if (!textarea || textarea.disabled) continue;
			textarea.focus({ preventScroll: true });
			return doc.activeElement === textarea;
		}
	} catch { /* focus is best-effort; the host still owns input */ }
	return false;
}

/**
 * Retry {@link focusHostTerminal} until the host screen mounts and connects.
 * Creation plus stream attachment usually settles within a few hundred ms;
 * the deadline keeps a failed terminal from polling forever.
 *
 * @returns a cancel function (also self-cancels on success or deadline).
 */
export function scheduleTerminalFocus({
	doc = globalThis.document,
	setTimer = (fn, ms) => setTimeout(fn, ms),
	clearTimer = (id) => clearTimeout(id),
	now = () => Date.now(),
} = {}) {
	const deadline = now() + FOCUS_DEADLINE_MS;
	let timer = null;
	let done = false;
	const attempt = () => {
		timer = null;
		if (done) return;
		if (focusHostTerminal(doc)) { done = true; return; }
		if (now() >= deadline) { done = true; return; }
		timer = setTimer(attempt, FOCUS_RETRY_MS);
	};
	timer = setTimer(attempt, FOCUS_RETRY_MS);
	return () => {
		done = true;
		if (timer !== null) clearTimer(timer);
	};
}

/** Whether the host registers the interactive terminal tab type in this profile. */
export function terminalKindRegistered(tabs) {
	try {
		const entries = typeof tabs?.entries === "function" ? tabs.entries() : [];
		return (entries ?? []).some((def) => String(def?.kind ?? "") === TERMINAL_KIND);
	} catch {
		return false;
	}
}

/**
 * Build the workspace-facing terminal entry.
 *
 * @param options - the injected host services.
 * @param options.sidebarRight - host right-sidebar navigation controller.
 * @param options.sidebarRightTabs - host tab-type registry, probed for availability.
 * @returns `{ available, open }`.
 */
export function createTerminalEntry({ sidebarRight, sidebarRightTabs } = {}) {
	const available = () => Boolean(sidebarRight && sidebarRightTabs) && terminalKindRegistered(sidebarRightTabs);
	const currentSession = () => {
		try {
			return sidebarRight?.mounted?.getSnapshot?.();
		} catch {
			return undefined;
		}
	};

	/**
	 * Open a new terminal, split beside the workspace when there is room.
	 *
	 * @returns `{ ok: true, sessionId }`, or `{ ok: false, reason }` where the
	 *   reason is `unavailable`, `noSession` or `failed`.
	 */
	const open = () => {
		if (!available()) return { ok: false, reason: "unavailable" };
		const sessionId = currentSession();
		if (!sessionId) return { ok: false, reason: "noSession" };
		try {
			// The kind is a string literal in the host contract, so no runtime
			// import of the terminal package is needed here.
			sidebarRight.openTab(TERMINAL_KIND, { preferNewPane: true });
		} catch {
			return { ok: false, reason: "failed" };
		}
		// A `multiple: true` kind always yields a new tab, and the host expands
		// the column and reveals it. Diffing the tab list here would only turn a
		// real anomaly into a silent success, so the outcome is trusted — but
		// keyboard focus is not part of that contract (see scheduleTerminalFocus),
		// so the workspace hands it to the new screen once it exists.
		scheduleTerminalFocus();
		return { ok: true, sessionId };
	};

	return { available, open };
}

/** Inert entry used when the host services are absent, so callers stay unconditional. */
export const inertTerminalEntry = {
	available: () => false,
	open: () => ({ ok: false, reason: "unavailable" }),
};
