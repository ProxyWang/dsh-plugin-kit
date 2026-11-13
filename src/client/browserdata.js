/* Shared browser data semantics; independent of DOM and Electron. */
export const DEFAULT_BROWSER_SETTINGS = Object.freeze({ homeUrl: "https://www.doubao.com/", showBookmarksBar: true, startPage: "home" });
export function normalizeBrowserUrl(input, applicationOrigin) {
	const value = String(input ?? "").trim();
	if (!value || value.length > 16384) throw Error("browser.invalidUrl");
	const explicit = /^[A-Za-z][A-Za-z\d+.-]*:(?!\d+(?:[/?#]|$))/.test(value);
	let url;
	try { url = new URL(explicit ? value : `https://${value}`); } catch { throw Error("browser.invalidUrl"); }
	if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("browser.invalidUrl");
	if (applicationOrigin && applicationOrigin !== "null" && url.origin === applicationOrigin) throw Error("browser.applicationOrigin");
	return url.href;
}
export function emptyBrowserData() { return { revision: 0, bookmarks: [], settings: { ...DEFAULT_BROWSER_SETTINGS } }; }
export function changeBrowserData(state, request) {
	const action = request.action;
	if (action === "list") return state;
	if (action === "save") {
		const url = normalizeBrowserUrl(request.url);
		const existing = request.id ? state.bookmarks.find((entry) => entry.id === request.id) : state.bookmarks.find((entry) => entry.url === url);
		if (request.id && !existing) throw Error("browser.notFound");
		const title = String(request.title ?? "").trim().slice(0, 240) || new URL(url).hostname;
		const folder = String(request.folder ?? "").trim().slice(0, 80);
		if (state.bookmarks.some((entry) => entry.url === url && entry.id !== existing?.id)) throw Error("browser.duplicate");
		if (!existing && state.bookmarks.length >= 500) throw Error("browser.limit");
		const entry = { id: existing?.id ?? globalThis.crypto.randomUUID(), url, title, folder, favorite: request.favorite === undefined ? existing?.favorite ?? false : request.favorite === true, createdAt: existing?.createdAt ?? Date.now() };
		return { ...state, revision: state.revision + 1, bookmarks: existing ? state.bookmarks.map((old) => old.id === entry.id ? entry : old) : [...state.bookmarks, entry] };
	}
	if (action === "delete") {
		if (!state.bookmarks.some((entry) => entry.id === request.id)) throw Error("browser.notFound");
		return { ...state, revision: state.revision + 1, bookmarks: state.bookmarks.filter((entry) => entry.id !== request.id) };
	}
	if (action === "settings") {
		const settings = request.settings ?? {};
		return { ...state, revision: state.revision + 1, settings: {
			homeUrl: settings.homeUrl === undefined ? state.settings.homeUrl : normalizeBrowserUrl(settings.homeUrl),
			showBookmarksBar: settings.showBookmarksBar === undefined ? state.settings.showBookmarksBar : settings.showBookmarksBar === true,
			startPage: settings.startPage === undefined ? state.settings.startPage : settings.startPage === "bookmarks" ? "bookmarks" : "home",
		} };
	}
	throw Error("browser.invalidAction");
}
