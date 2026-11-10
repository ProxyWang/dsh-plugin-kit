/* ---------------- redesigned right-sidebar guide launcher ----------------
 * Replaces the shipped "Start" card list through the official
 * `sidebar.right.tab.guide` chain slot (contract read from
 * @deepseek-ai/dsh-client-ui-sidebar-right 0.2.2-rc.1 types):
 *   - entries come from ctx.sidebarRightTabs.entries()[].guide[]
 *     ({id, order, title(), description?(), icon?, commandId?}, kind on the definition)
 *   - picking a card is ctx.sidebarRight.openTab(kind) — acts on the on-screen session
 *   - shortcut chips come from the shortcuts catalog when it exposes one
 * Renders grouped compact rows; bails to null (shipped guide stays) when the
 * registry is unreadable or empty.
 */

import { h } from "./react.js";

const GROUPS = [
	{ id: "skills", test: (kind) => /skill/.test(kind) },
	{ id: "run", test: (kind) => /(terminal|shell|browser|web)/.test(kind) },
	{ id: "code", test: (kind) => /^(files|code|document)/.test(kind) },
];
const GROUP_ORDER = ["code", "run", "skills", "more"];

export function groupOf(kind) {
	return GROUPS.find((g) => g.test(String(kind)))?.id ?? "more";
}

/** Flatten registry definitions into grouped, ordered guide boxes. */
export function collectBoxes(registry) {
	let defs = [];
	try {
		defs = registry.entries();
	} catch {
		return [];
	}
	const boxes = [];
	for (const def of defs ?? []) {
		if (!def || typeof def !== "object") continue;
		for (const entry of def.guide ?? []) {
			if (!entry || typeof entry !== "object") continue;
			boxes.push({ kind: def.kind, entry, group: groupOf(def.kind) });
		}
	}
	boxes.sort((a, b) => {
		const ga = GROUP_ORDER.indexOf(a.group);
		const gb = GROUP_ORDER.indexOf(b.group);
		if (ga !== gb) return ga - gb;
		return (a.entry.order ?? 0) - (b.entry.order ?? 0);
	});
	return boxes;
}

function shortcutCatalog(shortcuts) {
	if (!shortcuts || typeof shortcuts !== "object") return new Map();
	for (const name of ["list", "catalog", "entries", "all"]) {
		const fn = shortcuts[name];
		if (typeof fn !== "function") continue;
		try {
			const value = fn.call(shortcuts);
			if (!Array.isArray(value)) continue;
			const map = new Map();
			for (const item of value) {
				if (item && typeof item === "object" && typeof item.id === "string") map.set(item.id, item);
			}
			return map;
		} catch { /* probe the next candidate */ }
	}
	return new Map();
}

function bindingLabel(cat) {
	if (!cat) return "";
	for (const value of [cat.bindingLabel, cat.binding?.label, cat.binding, cat.accelerator, cat.keys, cat.currentLabel]) {
		if (typeof value === "string" && value !== "") return value;
	}
	return "";
}

export function makeLauncher({ registry, sidebarRight, getShortcuts, t }) {
	return function Launcher() {
		const boxes = collectBoxes(registry);
		if (boxes.length === 0) return null;
		const catalog = shortcutCatalog(getShortcuts ? getShortcuts() : null);
		const sections = [];
		let currentGroup = null;
		for (const box of boxes) {
			if (box.group !== currentGroup) {
				currentGroup = box.group;
				sections.push(h("div", { key: `s:${currentGroup}`, className: "cel-section" }, t(`launcher.${currentGroup}`)));
			}
			const { entry, kind } = box;
			const icon = typeof entry.icon === "function" ? h(entry.icon, {}) : null;
			const kbd = bindingLabel(catalog.get(entry.commandId));
			sections.push(h("button", {
				key: `${kind}:${entry.id}`,
				type: "button",
				className: "cel-row",
				title: typeof entry.description === "function" ? entry.description() : "",
				onClick: () => {
					try {
						sidebarRight.openTab(kind);
					} catch (error) {
						console.warn("code-explorer: launcher open failed", error);
					}
				},
			},
			h("span", { className: `cel-ico cel-ico-${box.group}` }, icon),
			h("span", { className: "cel-mid" },
				h("span", { className: "cel-title" }, typeof entry.title === "function" ? entry.title() : String(entry.id)),
				typeof entry.description === "function" ? h("span", { className: "cel-desc" }, entry.description()) : null,
			),
			kbd ? h("kbd", { className: "cel-kbd" }, kbd) : null,
			));
		}
		return h("div", { className: "cel-root ce-scroll" }, sections);
	};
}
