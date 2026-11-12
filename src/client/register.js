/* ---------------- module ---------------- */

import { TAB_ID, TAB_KIND, SKILLS_TAB_ID, SKILLS_TAB_KIND, API_TAB_ID, API_TAB_KIND } from "./constants.js";
import { CSS } from "./styles.js";

export const definition = (t) => ({
	id: TAB_ID,
	kind: TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("type.label"),
	guide: [],
});

export const skillsDefinition = (t) => ({
	id: SKILLS_TAB_ID,
	kind: SKILLS_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("skillsTab.label"),
	guide: [],
});

export const apiDefinition = (t) => ({
	id: API_TAB_ID,
	kind: API_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("api.label"),
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
