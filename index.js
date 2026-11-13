/**
 * Host half of dsh-plugin-kit.
 *
 * Serves one JSON API prefix `/code-explorer/api` for this package's Client
 * half (private-route pattern: one prefix handler dispatching a route table):
 *
 *   POST fs.list        {cwd, path}   → directory entries (workspace-fenced)
 *   POST fs.read        {cwd, path}   → bounded text (workspace-fenced)
 *   POST git.status     {cwd}         → repo/branch/base/working/branch files/commits
 *   POST git.diff       {cwd, path, scope} → unified diff text for one file
 *   POST lsp.request    {cwd, path, kind, line, col} → definition / implementation /
 *                                       typeDefinition / references / hover results,
 *                                       positions converted to 1-based
 *   POST lsp.diagnostics {cwd, path}  → latest gopls diagnostics for an open doc
 *   POST lsp.status     {cwd}         → {state:'off'|'starting'|'ready'|'error', message}
 *
 * LSP: one lazily-spawned `gopls` process per resolved workspace root, speaking
 * JSON-RPC over stdio. Documents are opened from disk on demand and re-synced
 * when their mtime changes. Servers idle for LSP_IDLE_MS are shut down; all
 * servers die with this plugin's effect.
 */

import { API_PREFIX } from "./lib/host/constants.js";
import { readJsonBody, respondJson } from "./lib/host/http.js";
import { textCache } from "./lib/host/fence.js";
import { servers } from "./lib/host/lsp.js";
import { routes } from "./lib/host/routes.js";
import { setSkillsRegistry } from "./lib/host/skills.js";
import { createBrowserService, browserTool } from "./lib/host/browser.js";

function apply(ctx) {
	let browser;
	ctx.inject(["storageDomain"], (storageCtx) => {
		if (!storageCtx.storageDomain) return;
		const instance = createBrowserService(storageCtx.storageDomain);
		browser = instance;
		ctx.effect(() => () => { if (browser === instance) browser = undefined; return instance.close(); }, "toolbox: browser data lifetime");
		ctx.inject(["tools"], (toolCtx) => {
			if (toolCtx.tools) ctx.effect(() => toolCtx.tools.register(browserTool(instance)), "toolbox: browser bookmarks tool");
		});
	});
	ctx.inject(["skills"], (skillsCtx) => {
		setSkillsRegistry(skillsCtx.skills);
	});
	ctx.inject(["webServer"], (webCtx) => {
		const webServer = webCtx.webServer;
		ctx.effect(() => {
			const localServers = servers;
			return webServer.register({
				kind: "prefix",
				path: API_PREFIX,
				handler: async (req, res) => {
					const route = (req.url ?? "/").split("?")[0].slice(API_PREFIX.length + 1);
					if (req.method !== "POST" || (!Object.hasOwn(routes, route) && route !== "browser.data")) {
						respondJson(res, 404, { ok: false, error: `unknown route: ${route}` });
						return;
					}
					try {
						const body = await readJsonBody(req);
						if (route === "browser.data" && !browser) throw new Error("Browser storage is unavailable in this profile");
						const value = route === "browser.data" ? await browser.execute(body) : await routes[route](body);
						respondJson(res, 200, { ok: true, value });
					} catch (error) {
						respondJson(res, 200, { ok: false, error: String(error?.message ?? error) });
					}
				},
			});
		}, "code-explorer: api route");
	});

	ctx.effect(() => () => {
		for (const server of servers.values()) server.stop("unload");
		servers.clear();
		textCache.clear();
	}, "code-explorer: servers lifetime");
}

export { apply };
