import { z } from "zod";
import { changeBrowserData, emptyBrowserData, normalizeBrowserUrl } from "../../src/client/browserdata.js";

const address = z.string().max(16384).refine((value) => { try { normalizeBrowserUrl(value); return true; } catch { return false; } });
const schema = z.object({
	revision: z.number().int().nonnegative(),
	bookmarks: z.array(z.object({ id: z.string().max(100), url: address, title: z.string().max(240), folder: z.string().max(80), favorite: z.boolean(), createdAt: z.number() })).max(500),
	settings: z.object({ homeUrl: address, showBookmarksBar: z.boolean(), startPage: z.enum(["home", "bookmarks"]) }),
});

export function createBrowserService(storageDomain) {
	let domain;
	let opening;
	let tail = Promise.resolve();
	let closed = false;
	const open = () => opening ??= storageDomain.open({ name: "dsh_plugin_kit_browser", version: 1, tables: {}, global: { schema, initial: emptyBrowserData() } }).then((value) => { domain = value; return value; }).catch((error) => { opening = undefined; throw error; });
	return {
		execute(request) {
			if (closed) return Promise.reject(Error("Browser storage is closed"));
			const result = tail.then(async () => {
				const handle = await open();
				const current = handle.global.get();
				if (request.action !== "list" && request.baseRevision !== undefined && request.baseRevision !== current.revision) throw Error("browser.conflict");
				const next = changeBrowserData(current, request);
				if (next !== current) await handle.global.set(schema.parse(next));
				return next;
			});
			tail = result.catch(() => {});
			return result;
		},
		async close() { closed = true; await tail; if (opening) await opening.catch(() => {}); await domain?.close(); },
	};
}

export function browserTool(service) {
	return {
		name: "browser_bookmarks",
		description: "List, save or delete toolbox browser bookmarks and update its home-page settings. Shares the browser UI's persistent store.",
		parameters: {
			action: { type: "string", enum: ["list", "save", "delete", "settings"], required: true },
			id: { type: "string", description: "Bookmark id for editing or deleting." },
			url: { type: "string", description: "HTTP(S) bookmark URL for save." },
			title: { type: "string" }, folder: { type: "string" }, favorite: { type: "boolean" },
			homeUrl: { type: "string", description: "HTTP(S) home-page URL for settings." },
			showBookmarksBar: { type: "boolean" }, startPage: { type: "string", enum: ["home", "bookmarks"] },
		},
		output: { schema: { type: "object", properties: { data: { type: "string", required: true } }, additionalProperties: false }, render: (_args, value) => [{ type: "text", text: value.data }] },
		async execute(args) {
			const request = args.action === "settings" ? { action: args.action, settings: { homeUrl: args.homeUrl, showBookmarksBar: args.showBookmarksBar, startPage: args.startPage } } : args;
			return { data: JSON.stringify(await service.execute(request)) };
		},
	};
}
