/* ---------------- module ---------------- */

import { TAB_ID, TAB_KIND, SKILLS_TAB_ID, SKILLS_TAB_KIND, API_TAB_ID, API_TAB_KIND, DB_TAB_ID, DB_TAB_KIND, RPC_TAB_ID, RPC_TAB_KIND } from "./constants.js";
import { CSS } from "./styles.js";

export const definition = (t) => ({
	id: TAB_ID,
	kind: TAB_KIND,
	priority: "extension",
	keepMounted: true,
	// The host snapshots `title(address)` when a tab is created, so a locale that
	// has not loaded yet would store an empty title for the tab's whole life.
	title: () => t("type.label") || "开发工作台",
	guide: [],
});

export const skillsDefinition = (t) => ({
	id: SKILLS_TAB_ID,
	kind: SKILLS_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("skillsTab.label") || "技能",
	guide: [],
});

/**
 * the merged request workbench: HTTP and gRPC in one tab. It keeps the API
 * tab's identity so an already-saved layout reopens as the workbench.
 */
export const apiDefinition = (t) => ({
	id: API_TAB_ID,
	kind: API_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("workbench.title") || "接口调试",
	guide: [],
});

export const dbDefinition = (t) => ({
	id: DB_TAB_ID,
	kind: DB_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("db.label") || "数据库",
	guide: [],
});

export const rpcDefinition = (t) => ({
	id: RPC_TAB_ID,
	kind: RPC_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("rpc.label") || "RPC",
	guide: [],
});

export function insertStyles() {
	const id = `${TAB_ID}/styles`;
	if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(id)}]`) === null) {
		const tag = document.createElement("style");
		tag.dataset.plugin = TAB_ID;
		tag.dataset.pluginCss = id;
		tag.textContent = CSS;
		document.head.appendChild(tag);
		return () => tag.remove();
	}
	return () => {};
}
