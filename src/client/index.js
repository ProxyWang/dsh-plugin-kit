/* ---------------- module descriptor ---------------- */

import { h } from "./react.js";
import { NS, TAB_ID, TAB_KIND, SKILLS_TAB_ID, SKILLS_TAB_KIND, API_TAB_ID, API_TAB_KIND } from "./constants.js";
import { en, zh } from "./locale.js";
import { CodeBody, CodeTitle } from "./code.js";
import { definition, insertStyles, skillsDefinition, apiDefinition } from "./register.js";
import { CallDiffRow } from "./calldiff.js";
import { SkillsTabBody, SkillsTitle } from "./skills.js";
import { ApiView, ApiTitle } from "./apiclient.js";
import { makeLauncher } from "./launcher.js";

export default {
	inject: ["slots", "locale", "sidebarRightTabs", "sidebarRight"],
	apply(ctx) {
		// One failing registration must not take the whole plugin down with it.
		const safe = (label, fn) => {
			try {
				ctx.effect(fn, label);
			} catch (error) {
				console.error(`code-explorer: ${label} failed`, error);
			}
		};
		safe("styles", insertStyles);
		const bound = ctx.locale.bind(NS);
		let shortcutsSvc = null;
		safe("dictionaries", () => ctx.locale.register(NS, { zh, en }));
		safe("tab type", () => ctx.sidebarRightTabs.register(definition(bound)));
		const Bound = (props) => h(CodeBody, { ...props, t: props.t ?? bound });
		safe("tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
			name: "sidebar.right.pane.tab",
			key: TAB_ID,
			locale: NS,
		}, Bound)));
		safe("tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
			name: "sidebar.right.pane.tab.title",
			key: TAB_ID,
		}, CodeTitle)));
		// Top-level "Skills" sidebar tab: its own picker card, body and title.
		safe("skills tab type", () => ctx.sidebarRightTabs.register(skillsDefinition(bound)));
		const SkillsBound = (props) => h(SkillsTabBody, { ...props, t: props.t ?? bound });
		safe("skills tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
			name: "sidebar.right.pane.tab",
			key: SKILLS_TAB_ID,
			locale: NS,
		}, SkillsBound)));
		safe("skills tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
			name: "sidebar.right.pane.tab.title",
			key: SKILLS_TAB_ID,
		}, SkillsTitle)));
		// Top-level "API" tab: curl-importable request editor + response viewer.
		safe("api tab type", () => ctx.sidebarRightTabs.register(apiDefinition(bound)));
		const ApiBound = (props) => h(ApiView, { ...props, t: props.t ?? bound });
		safe("api tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
			name: "sidebar.right.pane.tab",
			key: API_TAB_ID,
			locale: NS,
		}, ApiBound)));
		safe("api tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
			name: "sidebar.right.pane.tab.title",
			key: API_TAB_ID,
		}, ApiTitle)));
		// Compact chat rows for edit/write: clicking one opens this call's diff in
		// the side panel. Negative priority so unloading restores the stock rows.
		safe("call diff rows", () => ctx.slots.inject("tool.call.toolview", function* () {
			const bridge = {
				t: bound,
				openCallDiff: (payload, element) => {
					const target = ctx.sidebarRight.commandTarget(element);
					if (target === void 0) return false;
					ctx.sidebarRight.openTabFromTarget(TAB_KIND, target);
					setTimeout(() => document.dispatchEvent(new CustomEvent("dsh-ce-open-calldiff", { detail: payload })), 250);
					return true;
				},
			};
			yield ctx.slots.register({ name: "tool.call.toolview", key: "edit", priority: -1, inject: () => bridge }, CallDiffRow);
			yield ctx.slots.register({ name: "tool.call.toolview", key: "write", priority: -1, inject: () => bridge }, CallDiffRow);
		}));
		ctx.inject(["shortcuts"], (shortcutCtx) => {
			shortcutsSvc = shortcutCtx.shortcuts;
			try {
				shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
					id: "code.explorer",
					label: () => bound("guide.title"),
					aliases: ["code explorer", "code browser", "daima"],
					defaults: {
						"desktop:macos": { code: "KeyE", modifiers: ["primary"] },
						"desktop:windows": { code: "KeyE", modifiers: ["primary"] },
						"desktop:linux": { code: "KeyE", modifiers: ["primary"] },
						"web:macos": { code: "KeyE", modifiers: ["primary", "alt"] },
						"web:windows": { code: "KeyE", modifiers: ["primary", "alt"] },
						"web:linux": { code: "KeyE", modifiers: ["primary", "alt"] },
					},
					regions: ["page", "editable", "terminal"],
					modals: [],
					resolve: ({ target: element }) => {
						const target = ctx.sidebarRight.commandTarget(element);
						if (target === void 0) return { status: "blocked", reason: bound("shortcut.noSession") };
						return { status: "handled", run: () => ctx.sidebarRight.openTabFromTarget(TAB_KIND, target) };
					},
				}), "code-explorer: open shortcut");
			} catch (error) {
				console.warn("code-explorer: open shortcut not registered", error);
			}
			try {
				shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
					id: "code.quickopen",
					label: () => bound("quickopen.command"),
					aliases: ["quick open", "file picker", "kuai su da kai"],
					defaults: {
						"desktop:macos": { code: "KeyP", modifiers: ["primary", "alt"] },
						"desktop:windows": { code: "KeyP", modifiers: ["primary", "alt"] },
						"desktop:linux": { code: "KeyP", modifiers: ["primary", "alt"] },
						"web:macos": { code: "KeyP", modifiers: ["primary", "alt", "shift"] },
						"web:windows": { code: "KeyP", modifiers: ["primary", "alt", "shift"] },
						"web:linux": { code: "KeyP", modifiers: ["primary", "alt", "shift"] },
					},
					regions: ["page", "editable", "terminal"],
					modals: [],
					resolve: ({ target: element }) => {
						const target = ctx.sidebarRight.commandTarget(element);
						if (target === void 0) return { status: "blocked", reason: bound("shortcut.noSession") };
						return {
							status: "handled",
							run: () => {
								ctx.sidebarRight.openTabFromTarget(TAB_KIND, target);
								setTimeout(() => document.dispatchEvent(new CustomEvent("dsh-ce-quick-open")), 250);
							},
						};
					},
				}), "code-explorer: quick-open shortcut");
			} catch (error) {
				console.warn("code-explorer: quick-open shortcut not registered", error);
			}
			try {
				shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
					id: "code.skills",
					label: () => bound("skillsGuide.title"),
					aliases: ["skills", "skill manager", "jineng"],
					defaults: {
						"desktop:macos": { code: "KeyE", modifiers: ["primary", "shift"] },
						"desktop:windows": { code: "KeyE", modifiers: ["primary", "shift"] },
						"desktop:linux": { code: "KeyE", modifiers: ["primary", "shift"] },
						"web:macos": { code: "KeyE", modifiers: ["primary", "alt", "shift"] },
						"web:windows": { code: "KeyE", modifiers: ["primary", "alt", "shift"] },
						"web:linux": { code: "KeyE", modifiers: ["primary", "alt", "shift"] },
					},
					regions: ["page", "editable", "terminal"],
					modals: [],
					resolve: ({ target: element }) => {
						const target = ctx.sidebarRight.commandTarget(element);
						if (target === void 0) return { status: "blocked", reason: bound("shortcut.noSession") };
						return { status: "handled", run: () => ctx.sidebarRight.openTabFromTarget(SKILLS_TAB_KIND, target) };
					},
				}), "code-explorer: skills shortcut");
			} catch (error) {
				console.warn("code-explorer: skills shortcut not registered", error);
			}
		});
		// Redesigned "Start" picker via the official chain slot (contract per the
		// dsh-client-ui-sidebar-right 0.2.2 types): entries from the tab registry,
		// opens through sidebarRight.openTab(kind), shortcut chips from the
		// shortcuts catalog. Renders null when the registry is empty so the
		// shipped guide stays as the fallback.
		const Launcher = makeLauncher({
			registry: ctx.sidebarRightTabs,
			sidebarRight: ctx.sidebarRight,
			getShortcuts: () => shortcutsSvc,
			t: bound,
		});
		safe("guide launcher", () => ctx.slots.inject("sidebar.right.tab.guide", () => ctx.slots.register({
			name: "sidebar.right.tab.guide",
			order: -100,
			select: (owner) => (owner && typeof owner === "object" ? true : null),
		}, Launcher)));
	},
};
