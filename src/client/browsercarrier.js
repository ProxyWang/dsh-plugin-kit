/* Browser page transport uses DSH's public, lease-scoped DesktopBrowserBridge.
 * DOM attachment stays inside our own committed viewport. No Node/Electron
 * objects or privileges are exposed to visited pages. */
import { normalizeBrowserUrl } from "./browserdata.js";

export function createBrowserCarrier({ host, bridge, workspace, applicationOrigin, onState, onOpen }) {
	let disposed = false, element, reservation, offOpen, acquiring, ready = false, pending, lastUrl = "", firstDocument = true;
	let state = { url: "", title: "", loading: false, unknown: false, canBack: false, canForward: false, error: "" };
	const removers = [];
	const releases = new Set();
	const release = (lease) => {
		const done = Promise.resolve().then(() => bridge.release(lease)).catch((error) => fail(error)).finally(() => releases.delete(done));
		releases.add(done); return done;
	};
	const dropGuest = () => {
		for (const remove of removers.splice(0)) remove();
		offOpen?.(); offOpen = undefined;
		const guest = element; element = undefined; ready = false;
		guest?.remove();
		const lease = reservation; reservation = undefined;
		return lease ? release(lease.lease) : Promise.resolve();
	};
	const publish = (patch) => { if (!disposed) { state = { ...state, ...patch }; onState(state); } };
	const listen = (node, type, callback) => { node.addEventListener(type, callback); removers.push(() => node.removeEventListener(type, callback)); };
	const fail = (error) => publish({ loading: false, error: String(error?.message ?? error) });
	const validate = (url) => normalizeBrowserUrl(url, applicationOrigin);
	const observe = (committed = true) => {
		if (!ready || !element || disposed) return;
		try {
			let url;
			try { if (committed) url = validate(element.getURL()); } catch { /* about:blank bootstrap is not a bookmarkable address */ }
			if (url && firstDocument) { element.clearHistory(); firstDocument = false; }
			if (url) element.setAttribute("aria-label", element.getTitle() || new URL(url).hostname);
			publish({ ...(url ? { url, title: element.getTitle() || new URL(url).hostname, unknown: false } : {}), loading: element.isLoading(), canBack: element.canGoBack(), canForward: element.canGoForward() });
		} catch (error) { fail(error); }
	};
	const loadPending = () => {
		if (!ready || !pending || disposed) return;
		const url = pending; pending = undefined;
		const guest = element;
		try { Promise.resolve(guest.loadURL(url)).catch((error) => { if (element === guest && state.url === url && error?.code !== "ERR_ABORTED") fail(error); }); }
		catch (error) { fail(error); }
	};
	const initializeDesktop = () => {
		if (acquiring || element || disposed) return;
		acquiring = bridge.acquire(workspace).then(async (lease) => {
			if (disposed) { await release(lease.lease); return; }
			reservation = lease;
			element = host.ownerDocument.createElement("webview");
			element.className = "ceb-guest";
			element.dataset.sidebarBrowserFrame = "webview";
			element.setAttribute("name", lease.lease);
			element.setAttribute("partition", lease.partition);
			element.setAttribute("allowpopups", "");
			element.setAttribute("src", `about:blank#${lease.lease}`);
			offOpen = bridge.onOpenRequested(lease.lease, (url) => { if (!disposed) { try { onOpen(validate(url)); } catch (error) { fail(error); } } });
			listen(element, "dom-ready", () => { ready = true; observe(!pending); loadPending(); });
			listen(element, "did-navigate", () => observe(true));
			listen(element, "page-title-updated", () => observe(!state.loading));
			for (const name of ["did-start-loading", "did-stop-loading"]) listen(element, name, () => observe(false));
			listen(element, "did-navigate-in-page", (event) => { if (event.isMainFrame) observe(); });
			listen(element, "did-start-navigation", (event) => { if (event.isMainFrame) publish({ loading: true, error: "" }); });
			listen(element, "did-fail-load", (event) => { if (event.isMainFrame && event.errorCode !== -3) fail(`${event.errorCode}: ${event.errorDescription}`); });
			listen(element, "render-process-gone", () => { void dropGuest(); firstDocument = true; fail("browser.guestGone"); });
			host.append(element);
		}).catch(async (error) => { await dropGuest(); fail(error); }).finally(() => { acquiring = undefined; });
	};
	const load = (input) => {
		try {
			const url = validate(input); lastUrl = url;
			publish({ url, title: new URL(url).hostname, loading: true, unknown: false, error: "" });
			if (bridge) { pending = url; initializeDesktop(); loadPending(); }
			else {
				// A new iframe per controlled navigation disambiguates old load events.
				element?.remove();
				for (const remove of removers.splice(0)) remove();
				const frame = host.ownerDocument.createElement("iframe"); element = frame;
				frame.className = "ceb-guest";
				frame.title = new URL(url).hostname;
				frame.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox");
				frame.setAttribute("referrerpolicy", "no-referrer");
				let loaded = false;
				listen(frame, "load", () => {
					if (frame !== element) return;
					publish({ loading: false, unknown: loaded, canBack: false, canForward: false }); loaded = true;
				});
				listen(frame, "error", () => { if (frame === element) fail("browser.loadFailed"); });
				frame.src = url; host.append(frame);
			}
			return true;
		} catch (error) { fail(error); return false; }
	};
	return {
		load,
		reload() { if (bridge && ready) { try { element.reload(); } catch (error) { fail(error); } } else if (lastUrl) load(lastUrl); },
		back() { if (bridge && ready && state.canBack) { try { element.goBack(); } catch (error) { fail(error); } } },
		forward() { if (bridge && ready && state.canForward) { try { element.goForward(); } catch (error) { fail(error); } } },
		async dispose() {
			if (disposed) return;
			disposed = true; pending = undefined;
			await dropGuest();
			await acquiring;
			await Promise.all(releases);
		},
	};
}
