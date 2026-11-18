/* ---------------- terminal tab type: our screen, DSH's process ----------------
 *
 * Registers the plugin's own terminal tab. The Host keeps owning the shell, the
 * screen snapshot and the retention rules (`ctx.webTerminals`), while the tab
 * body renders with the emulator in `vt/` instead of the product's embedded
 * terminal — which is what removes the renderer that dropped repaints.
 *
 * Three host contracts are used, none of them patched:
 *   - `sidebarRightTabs.register` declares the tab type (`multiple`, so every
 *     open is its own terminal, and `keepMounted`, so switching tabs does not
 *     tear the screen down and re-parse a snapshot);
 *   - `sidebarRight.registerCloseHandler` closes the process when the tab is
 *     closed, the same way the product does for its own terminal;
 *   - `webTerminals.retainTabs` holds the process for as long as a tab exists.
 *     The product's terminal package filters tabs by its own kind, so this
 *     module passes every terminal-like kind: the last subscriber wins, and a
 *     hold set that omits the other kind would let its process be reclaimed.
 *
 * Availability is a probe: a composition without the terminal controller keeps
 * the tab type unregistered instead of failing at open time.
 */

import { h } from "./react.js";
import { TerminalBody } from "./vt/body.js";
import { NS } from "./constants.js";

export const TERM_TAB_ID = "dsh-plugin-kit/terminal";
export const TERM_TAB_KIND = "kit-terminal";
/** Kinds whose processes this plugin's hold set must keep alive. */
const HELD_KINDS = [TERM_TAB_KIND, "terminal"];

/** Tab definition: one instance per open, body kept while inactive. */
export function terminalDefinition(t) {
	return {
		id: TERM_TAB_ID,
		kind: TERM_TAB_KIND,
		priority: "extension",
		multiple: true,
		keepMounted: true,
		title: () => t("terminal.title"),
		guide: [{ id: "new", order: 20, title: () => t("terminal.title"), description: () => t("terminal.guide") }],
	};
}

/** Tab title chip. */
export function TerminalTitle({ useTabInfo, t }) {
	const info = useTabInfo ? useTabInfo() : null;
	return h("span", { className: "ce-term-title" }, `>_ ${info?.tab?.title ?? (t ? t("terminal.title") : "Terminal")}`);
}

/**
 * Whether this client can host the plugin's terminal tab.
 * @param ctx - client context with the sidebar registry and terminal service.
 * @returns whether both services expose the methods the tab needs.
 */
export function canInstallTerminalTab(ctx) {
	try {
		return typeof ctx?.webTerminals?.view === "function"
			&& typeof ctx.webTerminals.retainTabs === "function"
			&& typeof ctx?.sidebarRightTabs?.register === "function"
			&& typeof ctx?.sidebarRight?.registerCloseHandler === "function";
	} catch {
		return false;
	}
}

/**
 * Register the terminal tab type, its two seats, the process hold and close.
 *
 * @param ctx - client context (`sidebarRight`, `sidebarRightTabs`, `webTerminals`, `theme`).
 * @param t - locale-bound translator.
 * @returns a disposer releasing every registration.
 */
export function installTerminalTab(ctx, t) {
	if (!canInstallTerminalTab(ctx)) return () => {};

	const occurrenceOf = (sessionId, key) => ctx.sidebarRight.tabDomain.occurrence(sessionId, { id: key });
	const paramsOf = (sessionId, key) => occurrenceOf(sessionId, key).navigation.getSnapshot().params;
	const terminalIdOf = (sessionId, key) => {
		const params = paramsOf(sessionId, key);
		return params !== undefined && "terminalId" in params ? params.terminalId : undefined;
	};
	const viewFor = (sessionId, key) => {
		const navigation = occurrenceOf(sessionId, key).navigation.getSnapshot();
		const params = navigation.params;
		const shellPath = params !== undefined && "shellPath" in params ? params.shellPath : undefined;
		return ctx.webTerminals.view(sessionId, key, navigation.address, undefined, shellPath);
	};
	const theme = ctx.theme === undefined ? undefined : {
		getSnapshot: () => ctx.theme.getTheme(),
		subscribe: (listener) => ctx.on("theme/change", listener),
	};
	const injectBody = (sessionId) => ({
		view: (key) => viewFor(sessionId, key),
		keyedHooks: { terminal: (key) => viewFor(sessionId, key).state },
		...(theme === undefined ? {} : { hooks: { theme } }),
	});

	const disposers = [];
	disposers.push(ctx.sidebarRightTabs.register(terminalDefinition(t)));
	disposers.push(ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
		name: "sidebar.right.pane.tab", key: TERM_TAB_ID, locale: NS, inject: injectBody,
	}, TerminalBody)));
	disposers.push(ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
		name: "sidebar.right.pane.tab.title", key: TERM_TAB_ID, locale: NS,
	}, TerminalTitle)));
	disposers.push(ctx.sidebarRight.registerCloseHandler(TERM_TAB_KIND, (sessionId, tab) => {
		ctx.webTerminals.close(sessionId, tab.id, tab.contentId, terminalIdOf(sessionId, tab.id));
	}));

	// Window holds: recomputed from the open-tab list on every change.
	ctx.effect(() => {
		const held = () => ctx.sidebarRight.openTabs.getSnapshot().filter((tab) => HELD_KINDS.includes(tab.kind));
		const sync = () => ctx.webTerminals.retainTabs(held());
		const off = ctx.sidebarRight.openTabs.subscribe(sync);
		sync();
		return () => {
			off();
			// Hand the hold set back to the product's own terminals rather than
			// clearing it, which would drop their holds too.
			ctx.webTerminals.retainTabs(ctx.sidebarRight.openTabs.getSnapshot().filter((tab) => tab.kind === "terminal"));
		};
	}, "code-explorer: terminal holds");

	return () => {
		for (const dispose of disposers) dispose();
	};
}
