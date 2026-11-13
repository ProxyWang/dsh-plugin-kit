// Browser service, carrier lifetime and UI regressions; no live browser requests.
import assert from "node:assert/strict";
import { register } from "node:module";
register(new URL("./test-support/esm-react-hook.mjs", import.meta.url), import.meta.url);
const { emptyBrowserData, changeBrowserData, normalizeBrowserUrl } = await import("./src/client/browserdata.js");
const { createBrowserService, browserTool } = await import("./lib/host/browser.js");
const { createBrowserCarrier } = await import("./src/client/browsercarrier.js");
const { createBrowserDataModel } = await import("./src/client/browsermodel.js");
const { EnhancedBrowser } = await import("./src/client/browser.js");
const { installBrowser, BROWSER_TAB_ID } = await import("./src/client/browserregister.js");
const { createHookRenderer } = await import("./test-support/react-stub.mjs");
let passed = 0;
async function test(name, body) { await body(); passed++; console.log(`  ok  ${name}`); }
const tick = () => new Promise((resolve) => setImmediate(resolve));
const collect = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(collect) : [node, ...(node.children ?? []).flatMap(collect)];
if (typeof globalThis.localStorage === "undefined") {
	const store = new Map();
	globalThis.localStorage = { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => { store.set(key, String(value)); }, removeItem: (key) => { store.delete(key); }, clear: () => store.clear() };
}

await test("browser URL normalization handles bare hosts and localhost ports", () => { assert.equal(normalizeBrowserUrl("example.test/path"), "https://example.test/path"); assert.equal(normalizeBrowserUrl("localhost:3000"), "https://localhost:3000/"); });
await test("browser rejects script file data credentials and DSH application origin", () => {
 for (const url of ["javascript:alert(1)", "file:///tmp/test", "data:text/html,x", "https://user:pass@example.test", "", "https://bad host", "x".repeat(17000)]) assert.throws(() => normalizeBrowserUrl(url));
 assert.throws(() => normalizeBrowserUrl("https://dsh.example.test/a", "https://dsh.example.test"));
});
let state = emptyBrowserData();
state = changeBrowserData(state, { action: "save", url: "https://example.test", title: "Example", folder: "Docs", favorite: true });
await test("bookmark save canonicalizes and remembers favorite and folder", () => { assert.equal(state.bookmarks[0].url, "https://example.test/"); assert.equal(state.bookmarks[0].favorite, true); assert.equal(state.bookmarks[0].folder, "Docs"); });
await test("saving same URL edits instead of duplicating", () => { state = changeBrowserData(state, { action: "save", url: "https://example.test/", title: "Edited", favorite: false }); assert.equal(state.bookmarks.length, 1); assert.equal(state.bookmarks[0].title, "Edited"); });
await test("missing bookmark ids refuse edit/delete", () => { assert.throws(() => changeBrowserData(state, { action: "delete", id: "gone" })); assert.throws(() => changeBrowserData(state, { action: "save", id: "gone", url: "https://example.test" })); });
await test("browser settings preserve omitted fields and reject unsafe home URLs", () => { const next = changeBrowserData(state, { action: "settings", settings: { showBookmarksBar: false } }); assert.equal(next.settings.homeUrl, state.settings.homeUrl); assert.equal(next.settings.showBookmarksBar, false); assert.throws(() => changeBrowserData(state, { action: "settings", settings: { homeUrl: "javascript:x" } })); });
let durable = emptyBrowserData(), writes = 0, closed = 0, failWrite = false;
const storage = { async open(spec) { spec.global.schema.parse(durable); return { global: { get: () => durable, async set(value) { if (failWrite) throw Error("disk full"); durable = structuredClone(value); writes++; } }, async close() { closed++; } }; } };
const service = createBrowserService(storage);
await test("UI and tool operations share one durable bookmark service", async () => {
 await service.execute({ action: "save", url: "https://ui.example.test", title: "UI" });
 const tool = browserTool(service); await tool.execute({ action: "save", url: "https://tool.example.test", title: "Tool", favorite: true });
 assert.equal((await service.execute({ action: "list" })).bookmarks.length, 2);
 const listed = JSON.parse((await tool.execute({ action: "list" })).data); assert.equal(listed.bookmarks[1].title, "Tool");
});
await test("storage conflicts refuse stale changes without replacing bookmarks", async () => { const current = await service.execute({ action: "list" }); await assert.rejects(service.execute({ action: "delete", id: current.bookmarks[0].id, baseRevision: 0 }), /conflict/); assert.equal(durable.bookmarks.length, 2); });
await test("concurrent mutations serialize without lost updates", async () => { await Promise.all([service.execute({ action: "save", url: "https://a.example.test" }), service.execute({ action: "save", url: "https://b.example.test" })]); assert.equal(durable.bookmarks.length, 4); });
await test("failed persistent write leaves memory intact and later operations work", async () => { const before = durable; failWrite = true; await assert.rejects(service.execute({ action: "settings", settings: { startPage: "bookmarks" } }), /disk full/); assert.equal(durable, before); failWrite = false; await service.execute({ action: "settings", settings: { startPage: "bookmarks" } }); });
await service.close();
await test("browser data survives service reopen", async () => { const next = createBrowserService(storage); assert.equal((await next.execute({ action: "list" })).settings.startPage, "bookmarks"); await next.close(); assert.equal(closed, 2); });

await test("storage initialization failure can be retried and closed service refuses new requests", async () => { let attempts = 0; const retry = createBrowserService({ async open(spec) { if (++attempts === 1) throw Error("temporary"); return storage.open(spec); } }); await assert.rejects(retry.execute({ action: "list" }), /temporary/); assert.ok(await retry.execute({ action: "list" })); assert.equal(attempts, 2); await retry.close(); await assert.rejects(retry.execute({ action: "list" }), /closed/); });

class Guest extends EventTarget {
 constructor(type) { super(); this.type = type; this.attributes = {}; this.dataset = {}; this.src = ""; this.removed = false; this.url = "about:blank"; this.loaded = []; this.backCalls = 0; this.reloadCalls = 0; }
 setAttribute(key, value) { this.attributes[key] = value; }
 remove() { this.removed = true; }
 loadURL(url) { this.loaded.push(url); this.url = url; return Promise.resolve(); }
 getURL() { return this.url; }
 getTitle() { return "Demo page"; }
 isLoading() { return false; }
 canGoBack() { return this.backCalls === 0; }
 canGoForward() { return false; }
 clearHistory() { this.cleared = true; }
 goBack() { this.backCalls++; }
 reload() { this.reloadCalls++; }
}
const guests = [], released = [], states = [], opened = [];
const host = { ownerDocument: { createElement(type) { const element = new Guest(type); guests.push(element); return element; } }, append(element) { this.child = element; } };
let openListener;
const bridge = { acquire: async (workspace) => ({ lease: `lease-${workspace}`, partition: "memory-workspace" }), release: async (lease) => { released.push(lease); }, onOpenRequested(_lease, callback) { openListener = callback; return () => { openListener = null; }; } };
const native = createBrowserCarrier({ host, bridge, workspace: "cwd:/demo", applicationOrigin: "https://dsh.example.test", onState: (value) => states.push(value), onOpen: (url) => opened.push(url) });
await test("carrier acquires DSH guest lazily with approved partition and bootstrap", async () => { assert.equal(guests.length, 0); native.load("https://example.test/one"); await tick(); assert.equal(host.child.type, "webview"); assert.equal(host.child.attributes.partition, "memory-workspace"); assert.equal(host.child.attributes.src, "about:blank#lease-cwd:/demo"); assert.equal(host.child.loaded.length, 0); });
await test("native navigation waits for dom-ready and observes real titles", () => { host.child.dispatchEvent(new Event("dom-ready")); assert.deepEqual(host.child.loaded, ["https://example.test/one"]); host.child.dispatchEvent(new Event("did-navigate")); assert.equal(states.at(-1).title, "Demo page"); assert.equal(states.at(-1).url, "https://example.test/one"); });
await test("loading old page does not overwrite requested navigation target", () => { const element = host.child; element.loadURL = function(url) { this.loaded.push(url); return Promise.resolve(); }; native.load("https://new.example.test/"); element.dispatchEvent(new Event("did-start-loading")); assert.equal(states.at(-1).url, "https://new.example.test/"); element.url = "https://new.example.test/"; element.dispatchEvent(new Event("did-navigate")); });
await test("native popups use validated browser tab callback", () => { openListener("https://popup.example.test/"); assert.equal(opened[0], "https://popup.example.test/"); openListener("javascript:x"); assert.equal(opened.length, 1); });
await test("native history reload and disposal delegate and release exactly once", async () => { const element = host.child; native.back(); native.reload(); assert.equal(element.backCalls, 1); assert.equal(element.reloadCalls, 1); await native.dispose(); await native.dispose(); assert.equal(released.length, 1); assert.equal(element.removed, true); assert.equal(openListener, null); const count = states.length; element.dispatchEvent(new Event("did-navigate")); assert.equal(states.length, count); });
await test("closing during async guest acquisition releases reservation without attaching", async () => { let finish; const pendingBridge = { ...bridge, acquire: () => new Promise((resolve) => { finish = resolve; }) }; const otherHost = { ...host, child: undefined }; const carrier = createBrowserCarrier({ host: otherHost, bridge: pendingBridge, workspace: "session:B", onState() {}, onOpen() {} }); carrier.load("https://example.test/"); const closing = carrier.dispose(); finish({ lease: "late", partition: "late-partition" }); await closing; assert.equal(otherHost.child, undefined); assert.equal(released.at(-1), "late"); });
await test("native renderer crash releases guest and reload reacquires", async () => { const crashHost = { ...host }; const carrier = createBrowserCarrier({ host: crashHost, bridge, workspace: "crash", onState() {}, onOpen() {} }); carrier.load("https://example.test/"); await tick(); const old = crashHost.child; old.dispatchEvent(new Event("dom-ready")); old.dispatchEvent(new Event("render-process-gone")); await tick(); carrier.reload(); await tick(); assert.notEqual(crashHost.child, old); crashHost.child.dispatchEvent(new Event("dom-ready")); assert.equal(crashHost.child.loaded[0], "https://example.test/"); await carrier.dispose(); });
const { resolveBrowserWorkspace } = await import("./src/client/browserworkspace.js");
await test("browser cookie partitions follow authoritative workspace membership", async () => { const source = { getSnapshot: () => ({ phase: "ready", items: [{ path: "/workspace", sessionIds: ["A"] }] }) }; const signal = new AbortController().signal; assert.equal(await resolveBrowserWorkspace(source, "A", signal), "cwd:/workspace"); assert.equal(await resolveBrowserWorkspace(source, "B", signal), "session:B"); });
await test("Web carrier marks later iframe navigation unknown and keeps fixed sandbox", async () => { const output = []; const frameHost = { ...host }; const carrier = createBrowserCarrier({ host: frameHost, workspace: "", onState: (value) => output.push(value), onOpen() {} }); carrier.load("https://example.test/"); assert.equal(frameHost.child.attributes.referrerpolicy, "no-referrer"); assert.match(frameHost.child.attributes.sandbox, /allow-scripts/); frameHost.child.dispatchEvent(new Event("load")); assert.equal(output.at(-1).unknown, false); frameHost.child.dispatchEvent(new Event("load")); assert.equal(output.at(-1).unknown, true); const before = frameHost.child; carrier.load("https://next.example.test/"); assert.equal(before.removed, true); before.dispatchEvent(new Event("load")); assert.equal(output.at(-1).url, "https://next.example.test/"); await carrier.dispose(); });

await test("browser model shares Host results and reports storage failure", async () => {
 let calls = 0;
 const model = createBrowserDataModel(async () => { calls++; return { ok: true, value: durable }; });
 await Promise.all([model.load(), model.load()]); assert.equal(calls, 1); assert.equal(model.getSnapshot().data.revision, durable.revision);
 const failed = createBrowserDataModel(async () => ({ ok: false, error: "offline" })); await failed.load(); assert.equal(failed.getSnapshot().error, "offline");
});
const uiData = { data: { ...emptyBrowserData(), bookmarks: [{ id: "one", url: "https://example.test/", title: "Example", folder: "Docs", favorite: true, createdAt: 1 }] }, error: "", busy: false };
const changes = [];
const renderBrowser = createHookRenderer(EnhancedBrowser, { sessionId: "demo", useSessions: (select) => select({ byId: { demo: { cwd: "/demo" } } }), useTabInfo: () => ({ tab: { id: "browser-demo", navigation: { revision: 0, params: {} }, signal: new AbortController().signal, actions: { openTab() {}, bindCommands() { return () => {}; } } } }), useBrowserLibrary: (select) => select(uiData), loadLibrary() {}, async changeLibrary(request) { changes.push(request); }, t: (key) => key }, { expand: true });
let tree = renderBrowser();
const node = (fn) => collect(tree).find(fn);
await test("browser exposes saved favorites and bookmark manager", () => { assert.ok(node((value) => value.props.className === "ceb-bookmarks-bar")); node((value) => value.props.title === "browser.bookmarks").props.onClick(); tree = renderBrowser(); assert.ok(node((value) => value.props.className === "ceb-bookmark-open")); });
await test("bookmark editor requires URL and offers favorite setting", () => { node((value) => value.type === "button" && value.children[0] === "browser.addBookmark").props.onClick(); tree = renderBrowser(); assert.ok(node((value) => value.props.className === "ceb-bookmark-editor")); assert.ok(node((value) => value.type === "input" && value.props.required)); node((value) => value.type === "input" && value.props.required).props.onChange({ target: { value: "https://new.example.test/" } }); tree = renderBrowser(); node((value) => value.props.className === "ceb-bookmark-editor").props.onSubmit({ preventDefault() {} }); });
await tick();
await test("bookmark editor uses Host mutation rather than local-only save", () => { assert.equal(changes[0].action, "save"); assert.equal(changes[0].url, "https://new.example.test/"); });
await test("browser settings distinguish extensions from toolbox preferences", () => { node((value) => value.props.title === "browser.settings").props.onClick(); tree = renderBrowser(); assert.ok(node((value) => value.type === "p" && value.children[0] === "browser.extensionsUnavailable")); assert.ok(node((value) => value.props.className === "ceb-settings-form")); });
await test("browser settings draft does not change current page until submitted", () => { const label = node((value) => value.type === "label" && value.children[0] === "browser.homeUrl"); label.children[1].props.onChange({ target: { value: "https://home.example.test/" } }); tree = renderBrowser(); assert.equal(changes.length, 1); node((value) => value.props.className === "ceb-settings-form").props.onSubmit({ preventDefault() {} }); });
await tick();
await test("browser settings are saved through shared service callback", () => { assert.equal(changes[1].settings.homeUrl, "https://home.example.test/"); });
await test("boolean-only settings update saves without requiring home URL", async () => { const form = node((value) => value.props.className === "ceb-settings-form"); const checkbox = collect(form).find((value) => value.type === "input" && value.props.type === "checkbox"); checkbox.props.onChange({ target: { checked: false } }); tree = renderBrowser(); node((value) => value.props.className === "ceb-settings-form").props.onSubmit({ preventDefault() {} }); await tick(); assert.equal(changes.at(-1).settings.showBookmarksBar, false); assert.equal(changes.at(-1).settings.homeUrl, undefined); });
const stripTab = { id: "strip-browser", navigation: { revision: 0, params: {} }, signal: new AbortController().signal, actions: { openTab() {}, bindCommands() { return () => {}; } } };
const chipsOf = (view) => collect(view).filter((node) => node.props.className === "ceb-sub" || node.props.className === "ceb-sub ceb-sub-active");
const subDocOf = (sessionId, tabId) => JSON.parse(localStorage.getItem(`dsh.plugin-kit.browser.tabs.v2.${sessionId}.${tabId}`) ?? "null");
await test("sub-tab strip adds focused pages inside one browser window", () => {
	localStorage.clear();
	const draw = createHookRenderer(EnhancedBrowser, { sessionId: "strip-session", useTabInfo: () => ({ tab: stripTab }), useBrowserLibrary: (select) => select(uiData), loadLibrary() {}, changeLibrary() {}, t: (key) => key }, { effects: true, expand: true });
	let view = draw();
	assert.equal(chipsOf(view).length, 1);
	collect(view).find((node) => node.props.className === "ceb-strip-add").props.onClick();
	view = draw();
	const chips = chipsOf(view);
	assert.equal(chips.length, 2, "the new page stays inside the same window");
	assert.equal(chips[1].props.className, "ceb-sub ceb-sub-active");
	assert.equal(collect(view).filter((node) => node.props.className === "ceb-toolbar").length, 1, "Web keeps only the foreground page alive");
	draw.flushEffects();
	const saved = subDocOf("strip-session", "strip-browser");
	assert.equal(saved.tabs.length, 2);
	assert.equal(saved.activeId, saved.tabs[1].id);
	draw.unmount();
});
await test("closing the active sub-tab activates its neighbour and last close resets", () => {
	const draw = createHookRenderer(EnhancedBrowser, { sessionId: "strip-session", useTabInfo: () => ({ tab: stripTab }), useBrowserLibrary: (select) => select(uiData), loadLibrary() {}, changeLibrary() {}, t: (key) => key }, { effects: true, expand: true });
	let view = draw();
	let chips = chipsOf(view);
	assert.equal(chips.length, 2, "the persisted window is restored");
	collect(chips[1]).find((node) => node.props.className === "ceb-sub-close").props.onClick();
	view = draw(); chips = chipsOf(view);
	assert.equal(chips.length, 1);
	assert.equal(chips[0].props.className, "ceb-sub ceb-sub-active");
	collect(chips[0]).find((node) => node.props.className === "ceb-sub-close").props.onClick();
	view = draw(); chips = chipsOf(view);
	assert.equal(chips.length, 1, "closing the last page leaves a fresh one");
	draw.flushEffects();
	assert.equal(subDocOf("strip-session", "strip-browser").tabs.length, 1);
	draw.unmount();
	localStorage.clear();
});
await test("page popups open as background sub-tabs and load on Desktop", async () => {
	localStorage.clear();
	const popupHostA = { ...host };
	const popupHostB = { ...host };
	const draw = createHookRenderer(EnhancedBrowser, { sessionId: "popup-session", useTabInfo: () => ({ tab: { ...stripTab, id: "popup-browser" } }), useBrowserLibrary: (select) => select(uiData), loadLibrary() {}, changeLibrary() {}, desktopBridge: bridge, browserWorkspaces: { getSnapshot: () => ({ phase: "ready", items: [] }) }, t: (key) => key }, { effects: true, expand: true });
	let view = draw();
	collect(view).find((node) => node.props.className === "ceb-viewport").props.ref.current = popupHostA;
	draw.flushEffects(); await tick();
	view = draw(); draw.flushEffects(); await tick();
	assert.ok(openListener, "carrier registers the popup route");
	openListener("https://popup.example.test/");
	view = draw();
	const chips = chipsOf(view);
	assert.equal(chips.length, 2);
	assert.equal(chips[0].props.className, "ceb-sub ceb-sub-active", "popups do not steal the foreground");
	const viewports = collect(view).filter((node) => node.props.className === "ceb-viewport");
	assert.equal(viewports.length, 2, "Desktop keeps every guest resident");
	viewports[1].props.ref.current = popupHostB;
	draw.flushEffects(); await tick(); view = draw(); draw.flushEffects(); await tick();
	popupHostB.child.dispatchEvent(new Event("dom-ready"));
	assert.equal(popupHostB.child.loaded[0], "https://popup.example.test/");
	draw.unmount(); await tick();
	localStorage.clear();
});
await test("legacy single-page checkpoint migrates into a restorable sub-tab", () => {
	localStorage.clear();
	localStorage.setItem("dsh.plugin-kit.browser.page.v1.legacy-session.legacy-browser", JSON.stringify({ url: "https://legacy.example.test/", title: "Legacy page", navigationRevision: 2, initialUrl: "https://legacy.example.test/" }));
	const draw = createHookRenderer(EnhancedBrowser, { sessionId: "legacy-session", useTabInfo: () => ({ tab: { ...stripTab, id: "legacy-browser" } }), useBrowserLibrary: (select) => select(uiData), loadLibrary() {}, changeLibrary() {}, t: (key) => key }, { expand: true });
	const view = draw();
	const chips = chipsOf(view);
	assert.equal(chips.length, 1);
	assert.equal(collect(chips[0]).find((node) => node.props.className === "ceb-sub-title").children[0], "Legacy page");
	assert.ok(collect(view).find((node) => node.type === "button" && node.children[0] === "browser.restoreAction"), "the migrated page offers restore instead of auto-loading");
	localStorage.clear();
});
await test("browser registration extends carrier kind and restores native on disposal", () => { const definitions = [], cells = new Map(); let removed = 0; const dispose = installBrowser({ sidebarRightTabs: { get: () => ({ priority: "builtin" }), register(definition) { definitions.push(definition); return () => removed++; } }, slots: { inject(_name, run) { return run(); }, register(options, component) { cells.set(options.key + options.name, component); return () => cells.delete(options.key + options.name); } } }, (key) => key); assert.equal(definitions[0].kind, "browser"); assert.equal(definitions[0].priority, "extension"); assert.equal(definitions[0].id, BROWSER_TAB_ID);
	const titleNode = cells.get(BROWSER_TAB_ID + "sidebar.right.pane.tab.title")({ useTabInfo: () => ({ tab: { title: "Some page" } }) });
	assert.equal(titleNode.children[0], "browser.label", "the host strip keeps the fixed browser label");
	dispose(); assert.equal(removed, 1); assert.equal(cells.size, 0); });
await test("address draft survives old page title and loading events but explicit navigation updates it", async () => {
 const stableTab = { id: "draft-browser", navigation: { revision: 0, params: { url: "https://old.example.test/" } }, signal: new AbortController().signal, actions: { openTab() {}, bindCommands() { return () => {}; } } };
 const draftHost = { ...host };
 const draw = createHookRenderer(EnhancedBrowser, { sessionId: "draft-session", useTabInfo: () => ({ tab: stableTab }), useBrowserLibrary: (select) => select(uiData), loadLibrary() {}, changeLibrary() {}, desktopBridge: bridge, browserWorkspaces: { getSnapshot: () => ({ phase: "ready", items: [] }) }, t: (key) => key }, { effects: true, expand: true });
 let view = draw(); collect(view).find((n) => n.props.className === "ceb-viewport").props.ref.current = draftHost;
 draw.flushEffects(); await tick(); view = draw(); draw.flushEffects(); await tick();
 const guest = draftHost.child; assert.ok(guest); guest.dispatchEvent(new Event("dom-ready")); guest.dispatchEvent(new Event("did-navigate")); view = draw();
 collect(view).find((n) => n.props.className === "ce-input ceb-address").props.onChange({ target: { value: "https://draft.example.test/new" } });
 guest.dispatchEvent(new Event("page-title-updated")); guest.dispatchEvent(new Event("did-start-loading")); guest.dispatchEvent(new Event("did-stop-loading"));
 view = draw(); assert.equal(collect(view).find((n) => n.props.className === "ce-input ceb-address").props.value, "https://draft.example.test/new");
 collect(view).find((n) => n.props.className === "ceb-toolbar").props.onSubmit({ preventDefault() {} });
 view = draw(); assert.equal(guest.loaded.at(-1), "https://draft.example.test/new");
 guest.url = "https://redirect.example.test/"; guest.dispatchEvent(new Event("did-navigate")); view = draw();
 assert.equal(collect(view).find((n) => n.props.className === "ce-input ceb-address").props.value, "https://redirect.example.test/");
 draw.unmount(); await tick();
});
console.log(`\n${passed} browser regressions passed`);
