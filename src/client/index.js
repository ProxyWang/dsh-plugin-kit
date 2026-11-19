/* ---------------- module descriptor ---------------- */

import { h } from "./react.js";
import { NS, TAB_ID, TAB_KIND, SKILLS_TAB_ID, SKILLS_TAB_KIND, API_TAB_ID, API_TAB_KIND, DB_TAB_ID, DB_TAB_KIND, RPC_TAB_ID, RPC_TAB_KIND } from "./constants.js";
import { en, zh } from "./locale.js";
import { CodeBody, CodeTitle } from "./code.js";
import { definition, insertStyles, skillsDefinition, apiDefinition, dbDefinition, rpcDefinition } from "./register.js";
import { CallDiffRow } from "./calldiff.js";
import { SkillsTabBody, SkillsTitle } from "./skills.js";
import { ApiView, ApiTitle } from "./apiclient.js";
import { WorkbenchView, writeProtocol } from "./workbench.js";
import { migrateLegacyRpcTabs } from "./migrate.js";
import { DbView, DbTitle } from "./db.js";
import { RpcView, RpcTitle } from "./rpc.js";
import { installLeftTools, WorkspaceGuide } from "./lefttools.js";
import { registerToolCloseGuard } from "./closeguard.js";
import { installBrowser } from "./browserregister.js";
import { createTerminalEntry } from "./terminal.js";
import { installTerminalTab, TERM_TAB_KIND } from "./termtab.js";
import { installRightbarWidth } from "./rightbarwidth.js";
import { pruneOrphanKeys } from "./orphans.js";

export default {
	inject: ["slots", "locale", "sidebarRightTabs", "sidebarRight", "layout"],
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
		// Prune localStorage keys for sessions that no longer exist. Runs once
		// per activation; guarded so repeated mounts don't re-scan.
		safe("orphan cleanup", () => {
			ctx.inject(["sessions"], (sessionsCtx) => {
				if (!sessionsCtx.sessions) return;
				const live = new Set();
				try {
					const snap = sessionsCtx.sessions.getSnapshot?.();
					if (snap && typeof snap === "object") {
						for (const id of Object.keys(snap.byId ?? {})) live.add(id);
					}
				} catch { /* sessions unavailable: skip cleanup */ }
				pruneOrphanKeys([...live]);
			});
		});
		// The host opens the right column at 45% of the frame; this workspace is
		// an editor, so the first opening takes the widest the frame allows and a
		// manual drag stays the user's own width afterwards.
		safe("right sidebar width", () => installRightbarWidth({ layout: ctx.layout }));
		const bound = ctx.locale.bind(NS);
		safe("dictionaries", () => ctx.locale.register(NS, { zh, en }));
		// The workspace's terminal is this plugin's own emulator over DSH's
		// terminal service: the Host spawns the shell and streams frames, the
		// plugin owns the screen and its paint schedule. A composition without
		// the terminal controller simply does not get the tab.
		let builtinTerminal = false;
		ctx.inject(["webTerminals"], (terminalCtx) => {
			terminalCtx.effect(() => {
				const dispose = installTerminalTab(terminalCtx, bound);
				builtinTerminal = true;
				return () => {
					builtinTerminal = false;
					dispose();
				};
			}, "code-explorer: terminal tab");
		});
		// The system terminal stays available for the work a native window does
		// better; the Host owns the platform probe and the detached launch.
		const terminal = createTerminalEntry();
		const openBuiltinTerminal = () => {
			try {
				ctx.sidebarRight.openTab(TERM_TAB_KIND, { preferNewPane: true });
				return true;
			} catch {
				return false;
			}
		};
		ctx.inject(["workspaces"], (browserCtx) => {
			browserCtx.effect(() => installBrowser(browserCtx, bound), "toolbox: enhanced browser");
		});
		safe("tab type", () => ctx.sidebarRightTabs.register(definition(bound)));
		const Bound = (props) => h(CodeBody, { ...props, t: props.t ?? bound, terminal, openBuiltinTerminal, builtinTerminal: () => builtinTerminal });
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
		// Top-level request workbench: one tab for HTTP and gRPC. Both panes stay
		// mounted once visited, so switching protocol never discards a draft.
		safe("api tab type", () => ctx.sidebarRightTabs.register(apiDefinition(bound)));
		const ApiBound = (props) => h(WorkbenchView, {
			...props,
			t: props.t ?? bound,
			http: h(ApiView, { ...props, t: props.t ?? bound }),
			grpc: h(RpcView, { ...props, t: props.t ?? bound }),
		});
		safe("api tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
			name: "sidebar.right.pane.tab",
			key: API_TAB_ID,
			locale: NS,
		}, ApiBound)));
		for (const kind of [TAB_KIND, SKILLS_TAB_KIND]) {
			safe(`unsaved close guard: ${kind}`, () => registerToolCloseGuard(ctx.sidebarRight, kind, () => bound("editor.dirtyGuard")));
		}
		safe("api tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
			name: "sidebar.right.pane.tab.title",
			key: API_TAB_ID,
		}, ApiTitle)));
		// Top-level "Database" tab: local SQLite / MySQL / PostgreSQL workbench.
		safe("db tab type", () => ctx.sidebarRightTabs.register(dbDefinition(bound)));
		const DbBound = (props) => h(DbView, { ...props, t: props.t ?? bound });
		safe("db tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
			name: "sidebar.right.pane.tab",
			key: DB_TAB_ID,
			locale: NS,
		}, DbBound)));
		safe("db tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
			name: "sidebar.right.pane.tab.title",
			key: DB_TAB_ID,
		}, DbTitle)));
		// Legacy "RPC" pages are folded into the workbench once per session: the
		// preference starts on gRPC, the old page closes, the workbench opens.
		safe("legacy rpc tabs", () => ctx.effect(() => {
			const migrated = new Set();
			const run = () => {
				let tabs = [];
				try { tabs = ctx.sidebarRight.openTabs.getSnapshot(); } catch { return; }
				migrateLegacyRpcTabs({
					tabs,
					migrated,
					canOpen: () => Boolean(ctx.sidebarRightTabs.get(API_TAB_ID)),
					preferGrpc: () => { writeProtocol("grpc"); },
					close: (tab) => { ctx.sidebarRight.close(tab.id); },
					open: (sessionId) => { ctx.sidebarRight.openTabIn(sessionId, API_TAB_KIND, {}); },
				});
			};
			const off = ctx.sidebarRight.openTabs.subscribe(run);
			run();
			return () => off();
		}, "code-explorer: legacy rpc tabs"));
		// The type itself stays registered so an old layout opens before it moves.
		safe("rpc tab type", () => ctx.sidebarRightTabs.register(rpcDefinition(bound)));
		const RpcBound = (props) => h(RpcView, { ...props, t: props.t ?? bound });
		safe("rpc tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
			name: "sidebar.right.pane.tab",
			key: RPC_TAB_ID,
			locale: NS,
		}, RpcBound)));
		safe("rpc tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
			name: "sidebar.right.pane.tab.title",
			key: RPC_TAB_ID,
		}, RpcTitle)));
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
		// Left navigation owns all tool launchers; right pages remain session-bound.
		safe("left tool entries", () => installLeftTools(ctx, bound));
		const Guide = () => h(WorkspaceGuide, { t: bound });
		safe("workspace guide", () => ctx.slots.inject("sidebar.right.tab.guide", () => ctx.slots.register({
			name: "sidebar.right.tab.guide",
			order: -100,
			select: (owner) => owner && typeof owner === "object" ? true : null,
		}, Guide)));
	},
};
