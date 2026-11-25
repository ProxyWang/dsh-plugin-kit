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

import { z } from "zod";

import { API_PREFIX } from "./lib/host/constants.js";
import { readJsonBody, sendOk, sendError } from "./lib/host/http.js";
import { ApiError } from "./lib/host/errors.js";
import { textCache } from "./lib/host/fence.js";
import { servers, setLspOptions } from "./lib/host/lsp.js";
import { setProvisionOptions } from "./lib/host/provision.js";
import { routes } from "./lib/host/routes.js";
import { setSkillsRegistry } from "./lib/host/skills.js";
import { stopAllTasks } from "./lib/host/tasks.js";
import { stopAllWatchers } from "./lib/host/watch.js";
import { stopAllStreams } from "./lib/host/streams.js";
import { createBrowserService, browserTool } from "./lib/host/browser.js";
import { createVaultService } from "./lib/host/vault.js";
import { dbRoutes, closeAll as closeAllDb, setDbProfileService } from "./lib/host/db.js";
import { createDbProfileService } from "./lib/host/dbprofiles.js";
import { createToolboxTools } from "./lib/host/tools.js";
import { setExternalTerminalApp } from "./lib/host/external-terminal.js";
import { gitWorktreeRemove, reclaimArchivedCheckout } from "./lib/host/worktrees.js";
import { insideFence } from "./lib/host/fence.js";

/** Plugin configuration schema. Fields are read at apply time; changes require
 *  a plugin restart (non-volatile). Users override via cordis.patch.yml.
 *
 *  The Loader validates the entry's `config` through the Standard Schema
 *  protocol (`Config["~standard"].validate`), so this must be a real schema —
 *  a plain descriptor object is not one, and the Host rejects the plugin with
 *  "Cannot read properties of undefined (reading 'validate')". `prefault({})`
 *  keeps an entry that omits `config` valid; the field defaults then fill in. */
export const Config = z.object({
	formatOnSave: z.boolean().default(true).describe("Format Go/TS/JS/Python files on save via the language server."),
	liveRefresh: z.boolean().default(true).describe("Watch the workspace and live-refresh editor, tree and git status."),
	lspIdleMs: z.number().default(1_800_000).describe("Shut down idle LSP servers after this many milliseconds (default 30 minutes; the server is warmed when a file opens)."),
	lspMaxServers: z.number().default(4).describe("Most language-server roots kept resident per language; the least recently used is stopped first (worktrees multiply roots)."),
	goplsCommand: z.string().default("").describe("Go language server to run instead of the provisioned/PATH one: an absolute path to a newer gopls, a vendored build, or a fork. Empty means the plugin's own provisioned gopls."),
	provisionLanguageServers: z.boolean().default(true).describe("Install the Go language server (gopls) into the plugin's cache on first use. Requires the Go toolchain; TypeScript/Python servers ship as package dependencies."),
	apiTimeoutMs: z.number().default(30_000).describe("Default timeout for API workbench requests (1000–120000 ms)."),
	collectionDir: z.string().default("").describe("Workspace-relative .bru collection directory for the API workbench."),
	terminalApp: z.string().default("").describe("Terminal application opened by the External Terminal action (macOS app name, e.g. iTerm or Warp; empty probes iTerm then Terminal)."),
	dbDefaultDriver: z.string().default("sqlite").describe("Default database driver for new connections (sqlite, mysql, postgres)."),
}).prefault({});

function apply(ctx, config = {}) {
	// Language-server tuning lives in the LSP module; this is where the plugin's
	// config reaches it (see Config above).
	setLspOptions({ goplsCommand: config.goplsCommand ?? "", idleMs: config.lspIdleMs, maxServers: config.lspMaxServers });
	setProvisionOptions({ auto: config.provisionLanguageServers !== false });
	// Deployment preference for the External Terminal action; "" probes at open time.
	setExternalTerminalApp(typeof config?.terminalApp === "string" ? config.terminalApp : "");
	let browser;
	let vault;
	ctx.inject(["storageDomain"], (storageCtx) => {
		if (!storageCtx.storageDomain) return;
		const instance = createBrowserService(storageCtx.storageDomain);
		browser = instance;
		ctx.effect(() => () => { if (browser === instance) browser = undefined; return instance.close(); }, "toolbox: browser data lifetime");
		const vaultInstance = createVaultService(storageCtx.storageDomain);
		vault = vaultInstance;
		ctx.effect(() => () => { if (vault === vaultInstance) vault = undefined; return vaultInstance.close(); }, "toolbox: api secret vault lifetime");
		// Saved connections: the profile list is storage-backed, its passwords
		// live in the vault created just above.
		const profileInstance = createDbProfileService(storageCtx.storageDomain, vaultInstance);
		ctx.effect(() => () => { setDbProfileService(null); return profileInstance.close(); }, "toolbox: db profiles lifetime");
		setDbProfileService(profileInstance);
		ctx.inject(["tools"], (toolCtx) => {
			if (toolCtx.tools) {
				ctx.effect(() => toolCtx.tools.register(browserTool(instance)), "toolbox: browser bookmarks tool");
				for (const tool of createToolboxTools({ routes, dbRoutes })) {
					ctx.effect(() => toolCtx.tools.register(tool), `toolbox: ${tool.name} tool`);
				}
			}
		});
	});
	ctx.inject(["skills"], (skillsCtx) => {
		setSkillsRegistry(skillsCtx.skills);
	});
	/**
	 * Whether this request may use the private API.
	 *
	 * The Host's `connection` service owns deployment trust and authentication;
	 * ask it first and never infer the policy from flags. Hosts (and tests)
	 * without the service fall back to a loopback Host-header check, so the API
	 * is not open to a non-loopback Host just because the service is missing.
	 * A request with no Host header is not a browser request and is allowed.
	 */
	function callerAllowed(req) {
		const headers = req.headers ?? {};
		const host = headers.host;
		const loopbackHost = typeof host !== "string" || host === ""
			? true
			: ["127.0.0.1", "localhost", "[::1]", "::1"].includes(host.replace(/:\d+$/, "").toLowerCase());
		const connection = typeof ctx.get === "function" ? ctx.get("connection") : undefined;
		if (typeof connection?.requestRejection === "function") {
			let rejection;
			try {
				rejection = connection.requestRejection(req);
			} catch {
				return false;
			}
			if (rejection === undefined) return true;
			// The Host policy authenticates browser sessions. A local CLI caller
			// (curl, an agent shell) carries none of the browser markers: no
			// Origin, no Sec-Fetch-Site, no cookie. Let those through on a loopback
			// Host — this is the documented curl workflow, and a local process can
			// already read the workspace as the user. Browser-shaped requests
			// (any of those headers present) stay under the Host policy, which is
			// what defeats DNS rebinding and cross-site confused deputies.
			const browserShaped = headers.origin !== undefined || headers["sec-fetch-site"] !== undefined || headers.cookie !== undefined;
			return !browserShaped && loopbackHost;
		}
		return loopbackHost;
	}

	ctx.inject(["webServer"], (webCtx) => {
		const webServer = webCtx.webServer;
		ctx.effect(() => {
			const localServers = servers;
			return webServer.register({
				kind: "prefix",
				path: API_PREFIX,
				handler: async (req, res) => {
					if (!callerAllowed(req)) {
						sendError(res, new ApiError("forbidden", "forbidden"));
						return;
					}
					const route = (req.url ?? "/").split("?")[0].slice(API_PREFIX.length + 1);
					// Three owners of the prefix: this package's route table, the two
					// storage-backed endpoints, and the database driver table.
					const known = Object.hasOwn(routes, route) || Object.hasOwn(dbRoutes, route) || route === "browser.data" || route === "vault";
					if (!known) {
						sendError(res, new ApiError("not-found", `unknown route: ${route}`));
						return;
					}
					if (req.method !== "POST") {
						sendError(res, new ApiError("method-error", "POST required"));
						return;
					}
					try {
						const body = await readJsonBody(req);
						if (route === "browser.data" && !browser) throw new ApiError("unavailable", "Browser storage is unavailable in this profile");
						if (route === "vault" && !vault) throw new ApiError("unavailable", "Secret vault is unavailable in this profile");
						let value;
						if (route === "browser.data") value = await browser.execute(body);
						else if (route === "vault") value = await vault.execute(body);
						else if (Object.hasOwn(dbRoutes, route)) value = await dbRoutes[route](body);
						else value = await routes[route](body, { req, res });
						sendOk(res, value);
					} catch (error) {
						sendError(res, error);
					}
				},
			});
		}, "code-explorer: api route");
	});

	// Archive cleanup: a Session that lives in an `.agents/worktrees/` checkout
	// (how the branch-conversation flow starts one) gives that checkout back
	// when it is archived — but only when the checkout is ours, clean, and no
	// other live Session still stands in it. The branch always survives; only
	// the working tree goes. A Workspace record that pointed at the removed
	// checkout is dropped once nothing but archived Sessions remain in it.
	ctx.inject(["workspaceRegistry", "sessionQuery", "sessions"], (archiveCtx) => {
		// Compositions without the Workspace/Session providers simply have no
		// archive to clean up after.
		if (typeof archiveCtx.on !== "function" || typeof archiveCtx.sessions?.get !== "function" || typeof archiveCtx.sessionQuery?.listSessions !== "function" || archiveCtx.workspaceRegistry === undefined) return;
		const reclaim = (sessionId) => reclaimArchivedCheckout(sessionId, {
			cwdOf: async (id) => {
				const live = archiveCtx.sessions.get(id);
				if (typeof live?.header?.cwd === "string") return live.header.cwd;
				const records = await archiveCtx.sessionQuery.listSessions();
				return records.find((record) => record.header.id === id)?.header?.cwd;
			},
			referencedByOther: async (checkout, id) => {
				const records = await archiveCtx.sessionQuery.listSessions();
				const archived = new Set(archiveCtx.workspaceRegistry.archivedSessionIds ?? []);
				return records.some((record) => {
					const other = record.header.cwd;
					return record.header.id !== id && typeof other === "string" && !archived.has(record.header.id) && insideFence(checkout, other);
				});
			},
			remove: async (root, checkout) => { await gitWorktreeRemove(root, "", { path: checkout, force: false }); },
			workspaceAt: async (path) => archiveCtx.workspaceRegistry.resolveByPath?.(path),
			deleteWorkspace: async (workspaceId) => { await archiveCtx.workspaceRegistry.delete(workspaceId); },
			archivedIds: new Set(archiveCtx.workspaceRegistry.archivedSessionIds ?? []),
		}).catch((error) => {
			archiveCtx.logger?.warn?.("code-explorer: worktree reclaim skipped for %s: %s", sessionId, String(error?.message ?? error));
			return { removed: false, reason: "failed" };
		});
		archiveCtx.effect(() => {
			const off = archiveCtx.on("workspace/session-archived", ({ sessionId }) => { void reclaim(sessionId); });
			return () => { off?.(); };
		}, "code-explorer: worktree archive cleanup");
	});

	ctx.effect(() => () => {
		for (const server of servers.values()) server.stop("unload");
		servers.clear();
		stopAllWatchers();
		stopAllTasks();
		stopAllStreams();
		textCache.clear();
		closeAllDb();
	}, "code-explorer: servers lifetime");
}

export { apply };
