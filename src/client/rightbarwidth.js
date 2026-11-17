/* ---------------- right sidebar: widest first opening ----------------
 *
 * The host right column opens at 45% of the frame and keeps whatever the user
 * drags it to afterwards (`RIGHTBAR_DEFAULT_RATIO` / `RIGHTBAR_MAX_RATIO` in
 * @deepseek-ai/dsh-client-ui-layout). For a code editor, an embedded browser
 * and a curl workbench, 45% is a first-open tax: the widest usable surface is
 * the point, so this plugin asks for the ceiling instead — and only for that
 * first opening, because a manual drag stays the user's own choice.
 *
 * The width lives in the root layout store as `layoutInfo.rightbar` (px, or
 * null before its first opening). `openRightbar` seeds it with `??=`, so a
 * write that lands before the first opening simply becomes that opening's
 * preference and the 45% default never applies. Writing it is exactly what the
 * frame's own drag handle does: `ctx.layout` delegates every geometry action
 * to the store's bound action set, kept on the controller as `panels`. That
 * field is the service's internals rather than the published `ILayout` face,
 * so the whole feature is a probe: without a callable `setRightbar` this
 * installs nothing and the host keeps its stock behavior.
 *
 * The store's clamp — `[300px, 70% of the frame]` — is what "maximum" means
 * here, so the request is deliberately absurd rather than a copied ratio: the
 * host then owns its own ceiling, and a future ratio change needs no edit.
 *
 * Dragging stays untouched: the handle writes the store directly, and the
 * rendered track is measured once the gesture settles so the user's own width
 * survives a reload (the host preference is in-memory only). From then on the
 * remembered px is what the first opening restores.
 */

// The user's own width, remembered across reloads; absent = "never dragged".
export const WIDTH_KEY = "dsh-kit.rightbar-width";
// The host floors the panel at 300px and caps the drag below that as junk.
export const MIN_WIDTH = 300;
// Any request past the host ceiling clamps onto it, so "maximum" is never a
// copied constant: 1e7 px is wider than any frame the host can measure.
export const MAX_REQUEST = 1e7;

/**
 * The host's width action, or null when this `ctx.layout` has no such seam.
 * @param layout - the host layout service (`ctx.layout`).
 * @returns a `px => boolean` writer, or null.
 */
export function rightbarWidthWriter(layout) {
	const actions = layout && layout.panels;
	if (typeof actions?.setRightbar !== "function") return null;
	return (px) => {
		try {
			actions.setRightbar(px);
			return true;
		} catch {
			return false;
		}
	};
}

/**
 * A remembered drag width, or null to fall back to the widest opening.
 * @param storage - a Web Storage-like area.
 * @returns the px preference, or null when absent or unusable.
 */
export function readRememberedWidth(storage = globalThis.localStorage) {
	let raw = null;
	try {
		raw = storage?.getItem(WIDTH_KEY);
	} catch {
		return null;
	}
	if (raw === null || raw === undefined) return null;
	const px = Math.round(Number(raw));
	return Number.isFinite(px) && px >= MIN_WIDTH ? px : null;
}

/**
 * Save the user's width; junk and a denied storage area are both ignored.
 * @param px - rendered panel width in px.
 * @param storage - a Web Storage-like area.
 * @returns whether the value was stored.
 */
export function rememberWidth(px, storage = globalThis.localStorage) {
	const width = Math.round(Number(px));
	if (!Number.isFinite(width) || width < MIN_WIDTH) return false;
	try {
		storage?.setItem(WIDTH_KEY, String(width));
		return true;
	} catch {
		return false;
	}
}

/**
 * The rendered width of the host's right column track.
 * @param doc - the owner document to measure in.
 * @returns px, or 0 while the column has no track (closed, fullscreen).
 */
export function measureRightbarWidth(doc = globalThis.document) {
	let box = null;
	try {
		box = doc?.querySelector?.("[data-rightbar-col]")?.getBoundingClientRect?.();
	} catch {
		return 0;
	}
	const width = box && Number.isFinite(box.width) ? Math.round(box.width) : 0;
	return width >= MIN_WIDTH ? width : 0;
}

// The pointerup handler runs before React commits the drag's final width, so
// the read waits for two frames and lands after the gesture settles.
const settle = (run) => {
	const raf = typeof globalThis.requestAnimationFrame === "function"
		? globalThis.requestAnimationFrame.bind(globalThis) : null;
	if (raf) raf(() => raf(run));
	else globalThis.setTimeout?.(run, 32);
};

// The frame draws the rightbar's resize handle only while the panel is shown at
// its normal width, which is exactly when its preference is on screen: a resize
// must not yank a panel the user is looking at, only pin the pending first one.
const shownOnScreen = (doc) => {
	try {
		return Boolean(doc?.querySelector?.('[data-side="rightbar"]'));
	} catch {
		return false;
	}
};

/**
 * Open the right sidebar at its widest, then keep the user's own width.
 * @param options - the host layout service, plus the document, storage area,
 *   resize target and settle scheduler to work in (all injectable for tests).
 * @returns a disposer that unhooks the drag memory and the resize pin.
 */
export function installRightbarWidth({
	layout,
	doc = globalThis.document,
	storage = globalThis.localStorage,
	view,
	afterDrag = settle,
} = {}) {
	const write = rightbarWidthWriter(layout);
	if (write === null) return () => {};
	// Before any opening: the host only seeds an unset preference, so this
	// becomes the first opening's width — the widest the frame allows, or the
	// width this user last dragged to.
	let chosen = readRememberedWidth(storage);
	write(chosen ?? MAX_REQUEST);
	if (typeof doc?.addEventListener !== "function") return () => {};
	const frame = view ?? doc.defaultView ?? globalThis.window;
	const onPointerUp = (event) => {
		const handle = event?.target?.closest?.('[data-side="rightbar"]');
		if (!handle) return;
		afterDrag(() => {
			const px = measureRightbarWidth(doc);
			if (px > 0) {
				// The choice stands for this session even where storage denied it.
				chosen = px;
				rememberWidth(px, storage);
			}
		});
	};
	// The ceiling is a fraction of the frame, so a window widened before the
	// first opening gets the new ceiling rather than the boot one. Once this
	// user has chosen a width, or a panel is on screen, the choice stands.
	const onResize = () => {
		if (chosen !== null || shownOnScreen(doc)) return;
		write(MAX_REQUEST);
	};
	doc.addEventListener("pointerup", onPointerUp, true);
	if (typeof frame?.addEventListener === "function") frame.addEventListener("resize", onResize);
	return () => {
		try {
			doc.removeEventListener("pointerup", onPointerUp, true);
		} catch {}
		try {
			frame?.removeEventListener?.("resize", onResize);
		} catch {}
	};
}
