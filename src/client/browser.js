/* Enhanced chrome over DSH's approved browser carrier; no browser engine is bundled.
 * One host browser tab is a window: it keeps a strip of sub-tabs, each owning its
 * own carrier (Desktop webview guest / Web iframe), address history and title. */
import { h, Fragment, useEffect, useRef, useState } from "./react.js";
import { IconArrowLeft, IconArrowRight, IconRefresh } from "./icons.js";
import { useDismissLayer } from "./dismiss.js";
import { normalizeBrowserUrl, DEFAULT_BROWSER_SETTINGS } from "./browserdata.js";
import { createBrowserCarrier } from "./browsercarrier.js";
import { resolveBrowserWorkspace } from "./browserworkspace.js";
import { loadSubDoc, saveSubDoc, clearSubDoc, newSubId, MAX_SUBTABS } from "./browsersubs.js";

import { BrowserGlyph } from "./browsericons.js";

const hostLabel = (url) => { try { return new URL(url).hostname; } catch { return ""; } };

export function EnhancedBrowser({ sessionId, useSessions, useTabInfo, useBrowserLibrary, loadLibrary, changeLibrary, desktopBridge, browserWorkspaces, t }) {
	const info = useTabInfo();
	const tab = info.tab;
	const library = useBrowserLibrary((value) => value);
	const [doc, setDoc] = useState(() => {
		const loaded = loadSubDoc(sessionId, tab.id);
		if (loaded) return loaded;
		const id = newSubId();
		return { tabs: [{ id, url: "", title: "" }], activeId: id, restored: false };
	});
	const docRef = useRef(doc);
	docRef.current = doc;
	const liveRef = useRef(new Set());
	const [stripNotice, setStripNotice] = useState("");
	useEffect(() => { if (!stripNotice) return undefined; const timer = setTimeout(() => setStripNotice(""), 4000); return () => clearTimeout(timer); }, [stripNotice]);
	useEffect(() => { saveSubDoc(sessionId, tab.id, doc); }, [doc, sessionId, tab.id]);
	useEffect(() => () => { if (tab.signal.aborted) clearSubDoc(sessionId, tab.id); }, [sessionId, tab.id, tab.signal]);

	const addSub = (url, activate = true) => {
		const current = docRef.current;
		if (current.tabs.length >= MAX_SUBTABS) { setStripNotice(t("browser.tabLimit")); return undefined; }
		const id = newSubId();
		setDoc({ ...current, tabs: [...current.tabs, { id, url: url ?? "", title: "" }], activeId: activate ? id : current.activeId });
		return id;
	};
	const closeSub = (id) => {
		const current = docRef.current;
		const index = current.tabs.findIndex((entry) => entry.id === id);
		if (index < 0) return;
		liveRef.current.delete(id);
		if (current.tabs.length === 1) {
			const fresh = newSubId();
			setDoc({ ...current, tabs: [{ id: fresh, url: "", title: "" }], activeId: fresh });
			return;
		}
		const tabs = current.tabs.filter((entry) => entry.id !== id);
		const activeId = current.activeId === id ? tabs[Math.min(index, tabs.length - 1)].id : current.activeId;
		const next = { ...current, tabs, activeId };
		setDoc(next);
	};
	const activateSub = (id) => {
		const current = docRef.current;
		if (current.activeId === id) return;
		setDoc({ ...current, activeId: id });
	};
	const patchSub = (id, patch) => {
		const { url, title, navigationRevision, initialUrl } = patch;
		setDoc((current) => ({
			...current,
			tabs: current.tabs.map((entry) => entry.id === id ? { ...entry, ...(url !== undefined ? { url } : {}), ...(title !== undefined ? { title } : {}) } : entry),
			...(navigationRevision !== undefined ? { navigationRevision, initialUrl } : {}),
		}));
	};

	return h("div", { className: "ce-root ceb-root" },
		h("div", { className: "ceb-strip", role: "tablist", "aria-label": t("browser.strip") },
			doc.tabs.map((sub) => {
				const active = sub.id === doc.activeId;
				return h("div", { key: sub.id, className: active ? "ceb-sub ceb-sub-active" : "ceb-sub", role: "tab", "aria-selected": active },
					h("button", { type: "button", className: "ceb-sub-open", title: sub.title || sub.url || t("browser.untitled"), onClick: () => activateSub(sub.id) },
						h("span", { className: "ceb-sub-title" }, sub.title || hostLabel(sub.url) || t("browser.untitled"))),
					h("button", { type: "button", className: "ceb-sub-close", title: t("browser.closeTab"), "aria-label": t("browser.closeTab"), onClick: () => closeSub(sub.id) }, h(BrowserGlyph, { name: "close", size: 12 })),
				);
			}),
			h("button", { type: "button", className: "ceb-strip-add", title: t("browser.newTab"), "aria-label": t("browser.newTab"), onClick: () => addSub("") }, h(BrowserGlyph, { name: "plus", size: 14 })),
			stripNotice ? h("span", { className: "ceb-strip-note", role: "status" }, stripNotice) : null,
		),
		doc.tabs.map((sub) => {
			const active = sub.id === doc.activeId;
			// Web keeps only the foreground page alive; Desktop keeps every guest resident.
			if (!desktopBridge && !active) return null;
			return h(BrowserPage, {
				key: sub.id, sessionId, tab, sub, active,
				confirmRestore: Boolean(doc.restored && sub.url && !liveRef.current.has(sub.id)),
				envelope: { navigationRevision: doc.navigationRevision, initialUrl: doc.initialUrl },
				library, loadLibrary, changeLibrary, desktopBridge, browserWorkspaces, t,
				onPopup: (url) => addSub(url, false),
				onPage: patchSub,
				onLive: (id) => { liveRef.current.add(id); },
			});
		}),
	);
}

function BrowserPage({ sessionId, tab, sub, active, confirmRestore, envelope, library, loadLibrary, changeLibrary, desktopBridge, browserWorkspaces, t, onPopup, onPage, onLive }) {
	const settings = library.data?.settings ?? DEFAULT_BROWSER_SETTINGS;
	const bookmarks = library.data?.bookmarks ?? [];
	const [page, setPage] = useState({ url: "", title: "", loading: false, unknown: false, canBack: false, canForward: false, error: "" });
	const [address, setAddress] = useState("");
	const [panel, setPanel] = useState(null);
	const [filter, setFilter] = useState("");
	const [favoritesOnly, setFavoritesOnly] = useState(false);
	const [folder, setFolder] = useState("");
	const [editor, setEditor] = useState(null);
	const editorCurrent = useRef(null);
	editorCurrent.current = editor;
	const bookmarkDraft = useRef(null);
	if (editor) bookmarkDraft.current = editor;
	const [confirmDelete, setConfirmDelete] = useState(null);
	const [settingsDraft, setSettingsDraft] = useState(null);
	const settingsBase = useRef(null);
	const [notice, setNotice] = useState("");
	const [busy, setBusy] = useState(false);
	const [epoch, setEpoch] = useState(0);
	const hostRef = useRef(null);
	const carrierRef = useRef(null);
	const startRef = useRef(false);
	const lastTarget = useRef("");
	const [restore, setRestore] = useState(confirmRestore ? { url: sub.url, title: sub.title } : null);
	const alive = useRef(true);
	const editorRef = useDismissLayer({ open: editor !== null, onDismiss: () => setEditor(null), ignoreSelector: '[data-ce-browser-action="bookmark"]' });
	const removeRef = useDismissLayer({ open: confirmDelete !== null, onDismiss: () => setConfirmDelete(null) });
	const origin = typeof window === "undefined" ? undefined : window.location.origin;
	const envelopeRef = useRef(envelope);
	const textError = (error) => {
		const message = String(error?.message ?? error);
		return message.startsWith("browser.") ? t(message) : message;
	};
	useEffect(() => { void loadLibrary(); }, [loadLibrary]);
	useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(""), 5000); return () => clearTimeout(timer); }, [notice]);
	useEffect(() => {
		alive.current = true;
		const host = hostRef.current;
		if (!host) return undefined;
		const lifetime = new AbortController();
		let carrier;
		const initialize = async () => {
			const workspace = desktopBridge ? await resolveBrowserWorkspace(browserWorkspaces, sessionId, lifetime.signal) : `session:${sessionId}`;
			if (lifetime.signal.aborted) return;
			carrier = createBrowserCarrier({ host, bridge: desktopBridge, workspace, applicationOrigin: origin,
				onOpen: (url) => onPopup(url),
				onState: (next) => {
					setPage(next);
					if (!next.unknown) {
						// Title/loading observations must not overwrite an unsubmitted URL draft.
						if (next.url !== lastTarget.current) setAddress(next.url);
						lastTarget.current = next.url;
						if (next.url) onPage(sub.id, { url: next.url, title: next.title, navigationRevision: tab.navigation?.revision, initialUrl: tab.navigation?.params?.url });
					}
				},
			});
			carrierRef.current = carrier;
			if (lastTarget.current) carrier.load(lastTarget.current);
			setEpoch((value) => value + 1);
		};
		void initialize().catch((error) => { if (!lifetime.signal.aborted) setNotice(textError(error)); });
		return () => { alive.current = false; lifetime.abort(); carrierRef.current = null; void carrier?.dispose().catch((error) => console.error("toolbox browser release", error)); };
	}, [sessionId, sub.id, tab.signal, browserWorkspaces, desktopBridge]);

	const navigate = (input) => {
		try {
			const url = normalizeBrowserUrl(input, origin);
			if (!carrierRef.current) { setNotice(t("browser.initializing")); return; }
			setAddress(url);
			if (carrierRef.current.load(url)) { setPanel(null); setEditor(null); setConfirmDelete(null); setRestore(null); setNotice(""); onLive(sub.id); }
		} catch (error) { setNotice(textError(error)); }
	};
	useEffect(() => {
		if (!carrierRef.current || startRef.current) return;
		if (!tab.navigation?.params?.url && !library.data && !library.error) return;
		startRef.current = true;
		const supplied = tab.navigation?.params?.url;
		const env = envelopeRef.current;
		if (active && supplied && (!env || env.navigationRevision !== tab.navigation?.revision || env.initialUrl !== supplied)) navigate(supplied);
		else if (!restore && sub.url) navigate(sub.url);
		else if (!restore && !sub.url) { if (settings.startPage === "bookmarks") setPanel("bookmarks"); else navigate(settings.homeUrl); }
	}, [epoch, library.data, library.error, settings.startPage, settings.homeUrl, active]);
	const seenRevision = useRef(tab.navigation?.revision);
	useEffect(() => {
		if (!active) { seenRevision.current = tab.navigation?.revision; return; }
		if (seenRevision.current === tab.navigation?.revision || !carrierRef.current) return;
		seenRevision.current = tab.navigation?.revision;
		if (tab.navigation?.params?.url) navigate(tab.navigation.params.url);
	}, [tab.navigation?.revision, epoch, active]);
	useEffect(() => {
		if (!active) return undefined;
		return tab.actions.bindCommands?.({ refresh: () => carrierRef.current?.reload() });
	}, [tab.actions, active]);
	useEffect(() => { if (tab.visible === false) { setEditor(null); setConfirmDelete(null); } }, [tab.visible]);
	const mutate = async (request, done) => {
		if (busy) return;
		setBusy(true); setNotice("");
		try { if (request.action === "save") normalizeBrowserUrl(request.url, origin);
			if (request.action === "settings" && request.settings.homeUrl !== undefined) normalizeBrowserUrl(request.settings.homeUrl, origin);
			await changeLibrary(request); if (alive.current) { done?.(); setNotice(t("browser.saved")); } }
		catch (error) { if (alive.current) setNotice(textError(error)); }
		finally { if (alive.current) setBusy(false); }
	};
	const currentBookmark = bookmarks.find((entry) => entry.url === page.url);
	const openBookmark = () => {
		if (editor) { setEditor(null); return; }
		if (!page.url || page.unknown) return;
		setEditor(bookmarkDraft.current?.url === page.url ? bookmarkDraft.current : currentBookmark ? { ...currentBookmark } : { title: page.title || new URL(page.url).hostname, url: page.url, folder: "", favorite: true });
	};
	const choosePanel = (next) => {
		setPanel((current) => current === next ? null : next); setEditor(null); setConfirmDelete(null);
		if (next === "settings") { settingsBase.current = { ...settings }; setSettingsDraft({ ...settings }); }
	};
	const visibleBookmarks = bookmarks.filter((entry) => (!favoritesOnly || entry.favorite) && (!folder || entry.folder === folder) && (!filter.trim() || `${entry.title} ${entry.url} ${entry.folder}`.toLowerCase().includes(filter.trim().toLowerCase())));
	const tool = (label, child, click, disabled = false, extra = {}) => h("button", { type: "button", className: "ce-tool ceb-tool", title: label, "aria-label": label, disabled, onClick: click, ...extra }, child);
	return h("div", { className: "ceb-page", style: { display: active ? "flex" : "none" }, onKeyDown: (event) => { if ((event.ctrlKey || event.metaKey) && !event.altKey && event.code === "KeyL") { event.preventDefault(); event.currentTarget.querySelector(".ceb-address")?.focus(); } if (event.key === "Escape" && !event.isComposing && panel && !editor && !confirmDelete) { event.preventDefault(); event.stopPropagation(); setPanel(null); } } },
		h("form", { className: "ceb-toolbar", onSubmit: (event) => { event.preventDefault(); navigate(address); } },
			h("div", { className: "ceb-nav-group", role: "group", "aria-label": t("browser.navigation") },
				tool(t("browser.back"), h(IconArrowLeft), () => carrierRef.current?.back(), !page.canBack),
				tool(t("browser.forward"), h(IconArrowRight), () => carrierRef.current?.forward(), !page.canForward),
				tool(t("browser.reload"), h(IconRefresh), () => restore ? navigate(restore.url) : carrierRef.current?.reload(), !page.url && !restore),
			),
			h("div", { className: "ceb-address-shell" },
				h("span", { className: "ceb-address-icon" }, h(BrowserGlyph, { name: "globe", size: 15 })),
				h("input", { className: "ce-input ceb-address", "aria-label": t("browser.address"), placeholder: t("browser.address"), value: address, spellCheck: false, autoComplete: "off", onFocus: (event) => event.target.select(), onChange: (event) => setAddress(event.target.value) }),
				tool(t(currentBookmark ? "browser.editBookmark" : "browser.bookmarkPage"), h(BrowserGlyph, { name: "star", filled: Boolean(currentBookmark) }), openBookmark, !library.data || !page.url || page.unknown || page.loading, { className: `ce-tool ceb-tool ceb-star${currentBookmark ? " ceb-star-saved" : ""}`, "data-ce-browser-action": "bookmark", "aria-expanded": editor !== null, "aria-pressed": Boolean(currentBookmark) }),
				h("button", { className: "ceb-go", type: "submit", disabled: !address.trim(), title: t("browser.go"), "aria-label": t("browser.go") }, h(BrowserGlyph, { name: "arrow" })),
			),
			h("div", { className: "ceb-action-group", role: "group", "aria-label": t("browser.tools") },
				tool(t("browser.home"), h(BrowserGlyph, { name: "home" }), () => navigate(settings.homeUrl)),
				tool(t("browser.external"), h(BrowserGlyph, { name: "external" }), () => { try { window.open(normalizeBrowserUrl(page.url, origin), "_blank", "noopener,noreferrer"); } catch (error) { setNotice(textError(error)); } }, !page.url || page.unknown),
				tool(t("browser.bookmarks"), h(BrowserGlyph, { name: "bookmarks" }), () => choosePanel("bookmarks"), false, { "aria-expanded": panel === "bookmarks", "aria-pressed": panel === "bookmarks" }),
				tool(t("browser.settings"), h(BrowserGlyph, { name: "settings" }), () => choosePanel("settings"), false, { "aria-expanded": panel === "settings", "aria-pressed": panel === "settings" }),
			),
		),
		settings.showBookmarksBar && bookmarks.some((entry) => entry.favorite) ? h("nav", { className: "ceb-bookmarks-bar", "aria-label": t("browser.favorites") }, bookmarks.filter((entry) => entry.favorite).map((entry) => h("button", { key: entry.id, type: "button", title: entry.url, onClick: () => navigate(entry.url) }, entry.title))) : null,
		h("div", { className: "ceb-feedback", role: "status", hidden: !notice && !library.error && !page.error }, textError(page.error || library.error) || notice),
		library.error ? h("button", { type: "button", className: "ce-link", onClick: () => void loadLibrary() }, t("browser.retryStorage")) : null,
		h("div", { className: `ceb-progress${page.loading && !panel ? " ceb-progress-active" : ""}`, role: page.loading && !panel ? "progressbar" : undefined, "aria-label": page.loading && !panel ? t("loading") : undefined }, h("span")),
		page.unknown ? h("div", { className: "ce-note" }, t("browser.unknown")) : null,
		h("div", { className: "ceb-content" },
			h("div", { className: "ceb-viewport", ref: hostRef, style: { visibility: panel || editor || restore ? "hidden" : "visible" }, "aria-hidden": Boolean(panel || editor || restore) }),
			!panel && restore ? h("section", { className: "ceb-start" }, h("span", { className: "ceb-start-icon" }, h(BrowserGlyph, { name: "globe", size: 30 })), h("h2", null, t("browser.restore")), h("p", null, restore.title), h("p", null, restore.url), h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: () => navigate(restore.url) }, t("browser.restoreAction"))) : null,
			!panel && !restore && !page.url && !page.loading ? h("div", { className: "ceb-start" }, h("span", { className: "ceb-start-icon" }, h(BrowserGlyph, { name: "globe", size: 30 })), h("h2", null, t("browser.welcome")), h("p", null, t("browser.startHint"))) : null,
			panel ? h("section", { className: "ceb-panel ce-scroll", "aria-label": t(panel === "bookmarks" ? "browser.bookmarks" : "browser.settings") },
				h("header", { className: "ceb-panel-head" }, h("div", null, h("h2", null, t(panel === "bookmarks" ? "browser.bookmarks" : "browser.settings")), h("p", { className: "ceb-panel-caption" }, panel === "bookmarks" ? t("browser.bookmarkCount", { n: bookmarks.length }) : t("browser.settingsCaption"))), tool(t("close"), h(BrowserGlyph, { name: "close" }), () => setPanel(null))),
				panel === "bookmarks" ? h(Fragment, null,
					h("div", { className: "ceb-list-tools" }, h("input", { type: "search", className: "ce-input", "aria-label": t("browser.searchBookmarks"), placeholder: t("browser.searchBookmarks"), value: filter, onChange: (event) => setFilter(event.target.value) }),
						h("select", { className: "ce-sk-scope", "aria-label": t("browser.folder"), value: folder, onChange: (event) => setFolder(event.target.value) }, h("option", { value: "" }, t("browser.allFolders")), [...new Set(bookmarks.map((entry) => entry.folder).filter(Boolean))].map((name) => h("option", { key: name, value: name }, name))),
						h("label", null, h("input", { type: "checkbox", checked: favoritesOnly, onChange: (event) => setFavoritesOnly(event.target.checked) }), t("browser.favoritesOnly")),
						h("button", { type: "button", className: "ce-sk-btn", disabled: !library.data, onClick: () => setEditor(bookmarkDraft.current ?? { title: "", url: "", folder: "", favorite: false }) }, t("browser.addBookmark"))),
					!library.data ? h("p", null, t("loading")) : !visibleBookmarks.length ? h("div", { className: "ceb-empty" }, t(bookmarks.length ? "browser.noMatch" : "browser.emptyBookmarks")) : visibleBookmarks.map((entry) => h("article", { key: entry.id, className: "ceb-bookmark-row" },
						h("button", { type: "button", className: "ceb-bookmark-open", onClick: () => navigate(entry.url), title: entry.url }, h("span", { className: "ceb-bookmark-title" }, h("span", { className: "ceb-bookmark-glyph" }, h(BrowserGlyph, { name: entry.favorite ? "star" : "globe", size: 15 })), h("strong", null, entry.title)), h("span", null, entry.url), entry.folder ? h("small", null, entry.folder) : null),
						h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", "aria-label": `${t("editor.edit")} ${entry.title}`, onClick: () => setEditor({ ...entry }) }, t("editor.edit")),
						confirmDelete === entry.id ? h("span", { ref: removeRef, className: "ceb-confirm" }, h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-danger", disabled: busy, onClick: () => void mutate({ action: "delete", id: entry.id }, () => setConfirmDelete(null)) }, t("browser.confirmDelete")), h("button", { type: "button", className: "ce-sk-btn", onClick: () => setConfirmDelete(null) }, t("editor.cancel"))) : h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", "aria-label": `${t("skills.delete")} ${entry.title}`, onClick: () => setConfirmDelete(entry.id) }, t("skills.delete")),
					)),
				) : h(Fragment, null,
					h("p", { className: "ceb-setting-hint" }, t("browser.settingsScope")),
					h("form", { className: "ceb-settings-form", onSubmit: (event) => { event.preventDefault(); void mutate({ action: "settings", settings: Object.fromEntries(Object.entries(settingsDraft ?? settings).filter(([key, value]) => value !== settingsBase.current?.[key])) }, () => { settingsBase.current = { ...(settingsDraft ?? settings) }; }); } },
						h("label", null, t("browser.homeUrl"), h("input", { className: "ce-input", value: (settingsDraft ?? settings).homeUrl, onChange: (event) => setSettingsDraft({ ...(settingsDraft ?? settings), homeUrl: event.target.value }) })),
						h("label", null, t("browser.startPage"), h("select", { className: "ce-sk-scope", value: (settingsDraft ?? settings).startPage, onChange: (event) => setSettingsDraft({ ...(settingsDraft ?? settings), startPage: event.target.value }) }, h("option", { value: "home" }, t("browser.home")), h("option", { value: "bookmarks" }, t("browser.bookmarks")))),
						h("label", { className: "ceb-checkbox" }, h("input", { type: "checkbox", checked: (settingsDraft ?? settings).showBookmarksBar, onChange: (event) => setSettingsDraft({ ...(settingsDraft ?? settings), showBookmarksBar: event.target.checked }) }), t("browser.showBookmarksBar")),
						h("button", { type: "submit", className: "ce-sk-btn ce-sk-primary", disabled: busy || !library.data }, t("editor.save"))),
					h("section", { className: "ceb-capabilities" }, h("h3", null, t("browser.extensions")), h("p", null, t("browser.extensionsUnavailable")), h("h3", null, t("browser.carrier")), h("p", null, t(desktopBridge ? "browser.desktopPolicy" : "browser.webPolicy"))),
				),
			) : null,
		),
		editor ? h("form", { className: "ceb-bookmark-editor", ref: editorRef, role: "dialog", "aria-label": t("browser.editBookmark"), onSubmit: (event) => { event.preventDefault(); const saving = editor; void mutate({ action: "save", ...saving }, () => { if (editorCurrent.current === saving) { bookmarkDraft.current = null; setEditor(null); } }); } },
			h("header", null, h("strong", null, t(editor.id ? "browser.editBookmark" : "browser.addBookmark")), tool(t("close"), h(BrowserGlyph, { name: "close" }), () => setEditor(null))),
			...[ ["title", "browser.name"], ["url", "browser.url"], ["folder", "browser.folder"] ].map(([key, label]) => h("label", { key }, t(label), h("input", { className: "ce-input", autoFocus: key === "title", value: editor[key], required: key === "url", onChange: (event) => setEditor({ ...editor, [key]: event.target.value }) }))),
			h("label", { className: "ceb-checkbox" }, h("input", { type: "checkbox", checked: editor.favorite, onChange: (event) => setEditor({ ...editor, favorite: event.target.checked }) }), t("browser.pinFavorite")),
			h("footer", null, h("button", { type: "button", className: "ce-sk-btn", onClick: () => setEditor(null) }, t("editor.cancel")), h("button", { type: "submit", className: "ce-sk-btn ce-sk-primary", disabled: busy || !editor.url.trim() }, t("editor.save"))),
		) : null,
	);
}
