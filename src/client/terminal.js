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

// The host's xterm DOM renderer drops incremental row refreshes while its
// screen is off-viewport (IntersectionObserver pause during the dock slide-in,
// hidden tab toggles, pane resizes). The buffer stays correct — commands run
// fine — but erased cells keep their old glyphs until a FULL refresh lands.
// A real resize heals it (user-confirmed); so does DomRenderer.handleBlur,
// which repaints every row without touching PTY dimensions or shell state.
// Dispatching a synthetic `blur` FocusEvent on the xterm textarea is therefore
// a safe, side-effect-free full-refresh lever: no SIGWINCH, no prompt redraw,
// no focus steal (the event does not move document.activeElement).
const REFRESH_SETTLE_MS = 180;

/**
 * Force one full repaint of a host terminal screen via its textarea's blur
 * handler. Skips screens that are detached, hidden, or not yet connected.
 *
 * @param screen - a `[data-sidebar-terminal]` element.
 * @returns whether a repaint was requested.
 */
export function refreshHostTerminalScreen(screen, FE = globalThis.FocusEvent) {
	try {
		if (!screen || screen.isConnected === false) return false;
		if (screen.closest?.('[aria-hidden="true"], [hidden], [inert]')) return false;
		const textarea = screen.querySelector?.(".xterm textarea");
		if (!textarea) return false;
		const EventCtor = typeof FE === "function" ? FE : globalThis.Event;
		if (typeof EventCtor !== "function") return false;
		textarea.dispatchEvent(new EventCtor("blur"));
		return true;
	} catch {
		return false;
	}
}

/**
 * Watch host terminal screens and heal dropped refreshes at the moments they
 * happen: when a screen (re)enters the viewport, and shortly after window
 * resizes settle. One delayed blur per trigger burst; never polls, never
 * touches steady-state typing.
 *
 * @returns a disposer removing every observer/listener/timer.
 */
export function installTerminalRefreshGuard({
	doc = globalThis.document,
	view = globalThis.window,
	setTimer = (fn, ms) => setTimeout(fn, ms),
	clearTimer = (id) => clearTimeout(id),
	IO = globalThis.IntersectionObserver,
	MO = globalThis.MutationObserver,
} = {}) {
	if (typeof doc?.querySelectorAll !== "function") return () => {};
	let timer = null;
	const pending = new Set();
	const flush = () => {
		timer = null;
		for (const screen of pending) refreshHostTerminalScreen(screen);
		pending.clear();
	};
	const schedule = (screen) => {
		if (!screen) return;
		pending.add(screen);
		if (timer !== null) clearTimer(timer);
		timer = setTimer(flush, REFRESH_SETTLE_MS);
	};
	const visibleScreens = () => {
		try {
			return [...doc.querySelectorAll("[data-sidebar-terminal]")].filter((s) => s?.isConnected !== false && !s.closest?.('[aria-hidden="true"], [hidden], [inert]'));
		} catch {
			return [];
		}
	};
	// Intersection transitions: a screen becoming visible after the slide-in
	// or a tab switch is exactly when paused refreshes must be repaid.
	let io = null;
	const observed = new WeakSet();
	const observeAll = () => {
		if (!io) return;
		for (const screen of visibleScreens()) {
			if (observed.has(screen)) continue;
			observed.add(screen);
			io.observe(screen);
		}
	};
	if (typeof IO === "function") {
		io = new IO((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) schedule(entry.target);
			}
		}, { threshold: 0 });
		observeAll();
	}
	// New terminals mount after us; a light MutationObserver keeps IO coverage
	// current without polling. Only childList on the body subtree is needed.
	let mo = null;
	if (typeof MO === "function" && doc.body) {
		mo = new MO(() => observeAll());
		mo.observe(doc.body, { childList: true, subtree: true });
	}
	// Resize settle: the host fit may land mid-gesture; repay once it ends.
	const onResize = () => { for (const screen of visibleScreens()) schedule(screen); };
	if (typeof view?.addEventListener === "function") view.addEventListener("resize", onResize);
	return () => {
		if (timer !== null) clearTimer(timer);
		timer = null;
		pending.clear();
		io?.disconnect();
		mo?.disconnect();
		try { view?.removeEventListener?.("resize", onResize); } catch {}
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
