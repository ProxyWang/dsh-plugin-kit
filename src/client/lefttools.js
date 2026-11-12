/* Left-side tool navigation using the host's panel-list and layout contracts.
 * PanelRow selects a main key; the synchronous panelInfo subscriber routes our
 * keys back to Conversation before opening a right-side page. No DOM patching. */
import { h, useEffect, useState } from "./react.js";
import { NS, TAB_KIND, API_TAB_KIND, SKILLS_TAB_KIND } from "./constants.js";
import { IconCode } from "./icons.js";
import { collectBoxes, makeBrowserOpener } from "./launcher.js";

export const LEFT_TOOL_PREFIX = "dsh-plugin-kit/workspace/";
const OWN_TOOLS = [
	{ kind: TAB_KIND, label: "guide.title", description: "guide.description", glyph: "code" },
	{ kind: API_TAB_KIND, label: "apiGuide.title", description: "apiGuide.description", glyph: "api" },
	{ kind: SKILLS_TAB_KIND, label: "skillsGuide.title", description: "skillsGuide.description", glyph: "skills" },
];

export function ToolGlyph({ size = 16, glyph = "code" }) {
	if (glyph === "code") return h(IconCode, { size });
	return h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
		glyph === "api" ? [h("path", { key: "a", d: "M8 3v5m8-5v5M6 8h12v5a6 6 0 0 1-12 0V8Zm6 11v3" })]
			: [h("path", { key: "s", d: "m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 10 9-5M3 8l9 5v8" })],
	);
}

export function collectLeftTools(registry, t) {
	const definitions = registry.entries();
	const available = new Set(definitions.map((definition) => definition.kind));
	const ownKinds = new Set(OWN_TOOLS.map((tool) => tool.kind));
	const own = OWN_TOOLS.filter((tool) => available.has(tool.kind)).map((tool) => ({
		id: `${LEFT_TOOL_PREFIX}${encodeURIComponent(tool.kind)}`,
		kind: tool.kind,
		label: () => t(tool.label),
		description: () => t(tool.description),
		icon: (props) => h(ToolGlyph, { ...props, glyph: tool.glyph }),
	}));
	const seen = new Set();
	const others = collectBoxes(registry).filter(({ kind, entry }) => {
		const key = `${kind}/${entry.id}`;
		if (ownKinds.has(kind) || seen.has(key)) return false;
		seen.add(key);
		return true;
	}).map(({ kind, entry }) => ({
		id: `${LEFT_TOOL_PREFIX}${encodeURIComponent(kind)}/${encodeURIComponent(entry.id)}`,
		kind,
		label: typeof entry.title === "function" ? entry.title : () => String(entry.id),
		description: typeof entry.description === "function" ? entry.description : () => "",
		icon: typeof entry.icon === "function" ? entry.icon : IconCode,
	}));
	return [...own, ...others];
}

/** Route only this plugin's panel ids. Runs synchronously in a host store turn. */
export function makeLeftToolRouter({ layout, sidebarRight, getTools, report, t }) {
	let openBrowser = makeBrowserOpener(sidebarRight);
	let routing = false;
	return () => {
		if (routing) return;
		const id = layout.panelInfo.getSnapshot().activePanelId;
		const tool = getTools().find((entry) => entry.id === id);
		if (!tool) return;
		routing = true;
		try {
			// Host panelInfo updates its on-screen Session synchronously here.
			layout.selectPanel(null);
			const target = sidebarRight.commandTarget(null);
			if (target === undefined) { report(t("shortcut.noSession")); return; }
			report("");
			const inventory = () => typeof sidebarRight.tabsIn === "function"
				? sidebarRight.tabsIn(target.sessionId)
				: (sidebarRight.openTabs?.getSnapshot?.() ?? []).filter((tab) => tab.sessionId === target.sessionId);
			const matching = inventory().filter((tab) => tab.kind === tool.kind);
			const active = sidebarRight.active?.();
			const existing = matching.find((tab) => (tab.id ?? tab.tabId) === (active?.id ?? active?.tabId)) ?? matching.at(-1);
			if (existing) {
				const tabId = existing.id ?? existing.tabId;
				// A manually collapsed workspace is first revealed, rather than
				// silently deleting a tool that the user cannot currently see.
				if (sidebarRight.isExpanded() === false) {
					sidebarRight.toggleExpanded();
					sidebarRight.focus(tabId);
					return;
				}
				// Exact tab close runs native cleanup and unsaved-document guards.
				sidebarRight.close(tabId);
				const remaining = inventory().filter((tab) => tab.kind !== "guide" && (tab.id ?? tab.tabId) !== tabId);
				if (remaining.length === 0 && sidebarRight.isExpanded()) sidebarRight.toggleExpanded();
				if (tool.kind === "browser") openBrowser = makeBrowserOpener(sidebarRight);
				return;
			}
			if (tool.kind === "browser") openBrowser();
			else sidebarRight.openTabFromTarget(tool.kind, target);
		} catch (error) {
			report(`${t("left.openFailed")}: ${error?.message ?? error}`);
		} finally { routing = false; }
	};
}

export function WorkspaceGuide({ t }) {
	return h("div", { className: "ce-workspace-guide" },
		h("span", { className: "ce-workspace-guide-icon" }, h(IconCode, { size: 28 })),
		h("h2", null, t("left.workspace")),
		h("p", null, t("left.guide")),
	);
}

export function installLeftTools(ctx, t) {
	const registrations = new Map();
	let tools = [];
	let message = "";
	const listeners = new Set();
	const report = (next) => { message = next; for (const listener of listeners) listener(next); };
	function Notice() {
		const [text, setText] = useState(message);
		useEffect(() => { listeners.add(setText); setText(message); return () => listeners.delete(setText); }, []);
		useEffect(() => { if (!text) return undefined; const timer = setTimeout(() => report(""), 5000); return () => clearTimeout(timer); }, [text]);
		return text ? h("div", { className: "ce-left-notice", role: "status" }, h("span", null, text), h("button", { type: "button", "aria-label": t("close"), onClick: () => report("") }, "×")) : null;
	}
	const sync = () => {
		const next = collectLeftTools(ctx.sidebarRightTabs, t);
		const ids = new Set(next.map((tool) => tool.id));
		for (const [id, dispose] of registrations) if (!ids.has(id)) { dispose(); registrations.delete(id); }
		tools = next;
		for (const [index, tool] of next.entries()) {
			if (registrations.has(tool.id)) continue;
			// The host validates PanelRow ids against the main registry. This seat
			// is only a fallback: the subscriber restores Conversation in the same turn.
			const disposeMain = ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: tool.id, locale: NS }, () => h(WorkspaceGuide, { t })));
			const disposeNav = ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: tool.id, order: 20 + index, label: tool.label, locale: NS }, tool.icon));
			registrations.set(tool.id, () => { disposeNav(); disposeMain(); });
		}
	};
	const route = makeLeftToolRouter({ layout: ctx.layout, sidebarRight: ctx.sidebarRight, getTools: () => tools, report, t });
	const stopRouting = ctx.layout.panelInfo.subscribe(route);
	sync();
	const stopRegistry = ctx.sidebarRightTabs.subscribe(sync);
	const disposeNotice = ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "dsh-plugin-kit/tool-notice", order: 50 }, Notice));
	return () => {
		stopRegistry(); stopRouting(); disposeNotice();
		if (tools.some((tool) => tool.id === ctx.layout.panelInfo.getSnapshot().activePanelId)) ctx.layout.selectPanel(null);
		for (const dispose of registrations.values()) dispose();
		registrations.clear(); listeners.clear();
	};
}
