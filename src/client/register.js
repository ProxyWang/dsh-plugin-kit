/* ---------------- module ---------------- */

import { h } from "./react.js";
import { TAB_ID, TAB_KIND, SKILLS_TAB_ID, SKILLS_TAB_KIND, API_TAB_ID, API_TAB_KIND } from "./constants.js";
import { CSS } from "./styles.js";

const GuideIcon = () => h("svg", { viewBox: "0 0 64 64", width: 40, height: 40, "aria-hidden": true, fill: "none", stroke: "#59b7ff", strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } },
	h("path", { d: "M22 20 8 32l14 12" }),
	h("path", { d: "M42 20 56 32 42 44" }),
	h("path", { stroke: "#7de3a4", d: "M36 12 28 52" }),
);

const SkillsGuideIcon = () => h("svg", { viewBox: "0 0 64 64", width: 40, height: 40, "aria-hidden": true, fill: "none", stroke: "#e3b341", strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } },
	h("path", { d: "M32 8 12 18v28l20 10 20-10V18L32 8Z" }),
	h("path", { d: "M32 8v48M12 18l20 10 20-10" }),
);

export const definition = (t) => ({
	id: TAB_ID,
	kind: TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("type.label"),
	guide: [
		{
			id: "code",
			commandId: "code.explorer",
			order: 15,
			title: () => t("guide.title"),
			description: () => t("guide.description"),
			icon: GuideIcon,
		},
	],
});

export const skillsDefinition = (t) => ({
	id: SKILLS_TAB_ID,
	kind: SKILLS_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("skillsTab.label"),
	guide: [
		{
			id: "skills",
			commandId: "code.skills",
			order: 16,
			title: () => t("skillsGuide.title"),
			description: () => t("skillsGuide.description"),
			icon: SkillsGuideIcon,
		},
	],
});

export const apiDefinition = (t) => ({
	id: API_TAB_ID,
	kind: API_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("api.label"),
	guide: [
		{
			id: "api",
			order: 17,
			title: () => t("apiGuide.title"),
			description: () => t("apiGuide.description"),
			icon: SkillsGuideIcon,
		},
	],
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
