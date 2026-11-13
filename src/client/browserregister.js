import { h } from "./react.js";
import { NS } from "./constants.js";
import { EnhancedBrowser } from "./browser.js";
import { createBrowserDataModel } from "./browsermodel.js";

export const BROWSER_TAB_ID = "dsh-plugin-kit/browser";
export function installBrowser(ctx, t) {
	const native = ctx.sidebarRightTabs.get("browser");
	if (!native || native.priority === "extension") return () => {};
	const carrier = globalThis.dshDesktop;
	const bridge = carrier?.protocolVersion === 1 ? carrier.browser : undefined;
	const model = createBrowserDataModel();
	const definition = { id: BROWSER_TAB_ID, kind: "browser", priority: "extension", multiple: true, keepMounted: Boolean(bridge), title: () => t("browser.label"), guide: [{ id: "new", order: 30, title: () => t("browser.label"), description: () => t("browser.guide"), icon: BrowserIcon }] };
	const stopType = ctx.sidebarRightTabs.register(definition);
	const stopBody = ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
		name: "sidebar.right.pane.tab", key: BROWSER_TAB_ID, locale: NS,
		inject: () => ({ hooks: { browserLibrary: model }, desktopBridge: bridge, browserWorkspaces: ctx.workspaces?.list, loadLibrary: () => model.load(), changeLibrary: (request) => model.change(request) }),
	}, EnhancedBrowser));
	const stopTitle = ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: BROWSER_TAB_ID }, () => h("span", null, t("browser.label"))));
	return () => { stopTitle(); stopBody(); stopType(); };
}
function BrowserIcon({ size = 18 }) {
	return h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": true }, h("circle", { cx: 12, cy: 12, r: 9 }), h("path", { d: "M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" }));
}
