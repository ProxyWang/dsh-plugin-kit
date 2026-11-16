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
		// the column and focuses it. Diffing the tab list here would only turn a
		// real anomaly into a silent success, so the outcome is trusted.
		return { ok: true, sessionId };
	};

	return { available, open };
}

/** Inert entry used when the host services are absent, so callers stay unconditional. */
export const inertTerminalEntry = {
	available: () => false,
	open: () => ({ ok: false, reason: "unavailable" }),
};
