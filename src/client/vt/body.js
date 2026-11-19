/* ---------------- terminal tab body: emulator + renderer + input ----------------
 *
 * This is the plugin's own terminal surface. DSH still owns the process: the
 * Host spawns the shell, keeps a headless screen and streams `snapshot` /
 * `output` frames, and `ctx.webTerminals` hands us that stream as a model
 * (`view.write`, `view.resize`, `view.acknowledge`). What we own is the screen
 * and, crucially, *when it is painted* — which is the part the embedded host
 * terminal could not give us.
 *
 * Paint policy, in one sentence: feed the emulator immediately, then paint at
 * most once per animation frame. Output arrives in frame-sized chunks (a
 * powerlevel10k redraw is dozens of sequences split across chunks), and painting
 * between them is what produces half-drawn prompts and double-typed text.
 * Batching the paint also means one row diff per frame instead of per chunk.
 *
 * Input policy: keys become bytes (`keys.js`), characters come from the hidden
 * textarea's `input` event so IME and dead keys work, and paste is wrapped in
 * the bracketed-paste markers when the shell asked for them.
 */

import { h, useEffect, useRef, useState } from "../react.js";
import { createScreen } from "./screen.js";
import { createRenderer } from "./render.js";
import { keyToBytes, pasteToBytes } from "./keys.js";
import { selectionRow, selectionText, selectAll, selectLine, selectWord } from "./selection.js";
import { encodeMouse, encodeWheel, mouseOwned, reportsMotion } from "./mouse.js";

/**
 * Apply one stream frame to the emulator.
 *
 * Kept out of the component so the snapshot/output contract can be asserted in
 * Node: a snapshot resets the screen, adopts the Host's grid and replays the
 * serialised screen; output appends. Either way the caller acknowledges the
 * revision afterwards.
 *
 * @param screen - the emulator.
 * @param render - `{ revision, frame }` from the terminal model.
 * @returns whether anything was written.
 */
export function applyRenderFrame(screen, render) {
	const payload = render?.frame;
	if (!payload) return false;
	if (payload.type === "snapshot") {
		screen.reset();
		const info = payload.info ?? {};
		if (Number.isFinite(info.cols) && Number.isFinite(info.rows)) screen.resize(info.cols, info.rows);
		screen.write(typeof payload.screen === "string" ? payload.screen : "");
		return true;
	}
	if (payload.type === "output") {
		screen.write(typeof payload.data === "string" ? payload.data : "");
		return true;
	}
	return false;
}

const DEFAULT_THEME = {
	fg: "#d4d4d4",
	bg: "#1e1e1e",
	fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
	fontSize: 13,
};

/** Resolve the theme passed by the host snapshot into renderer values. */
function themeOf(snapshot) {
	if (!snapshot || typeof snapshot !== "object") return DEFAULT_THEME;
	const family = snapshot.fontFamilies?.terminal ?? DEFAULT_THEME.fontFamily;
	const size = snapshot.fontSizes?.terminal ?? DEFAULT_THEME.fontSize;
	return {
		fg: DEFAULT_THEME.fg,
		bg: DEFAULT_THEME.bg,
		fontFamily: family === "" ? DEFAULT_THEME.fontFamily : `${family}, ${DEFAULT_THEME.fontFamily}`,
		fontSize: Number.isFinite(size) ? size : DEFAULT_THEME.fontSize,
	};
}

/**
 * Terminal tab body.
 *
 * @param props - the slot-injected model accessors, theme hook and copy.
 * @returns the screen element.
 */
export function TerminalBody({ useTabInfo, useTerminal, useTheme, view, t }) {
	const { tab } = useTabInfo();
	const model = view(tab.id);
	const state = useTerminal(tab.id);
	const themeSnapshot = useTheme ? useTheme((value) => value) : null;
	const theme = themeOf(themeSnapshot);

	const hostRef = useRef(null);
	const engine = useRef(null);
	const [engineReady, setEngineReady] = useState(0);
	const latest = useRef({ state, writable: false, theme });
	latest.current = { state, writable: Boolean(state?.writable), theme };

	// The Host holds the terminal process for this window while the tab exists.
	useEffect(() => model.mount(), [model]);

	// Build the emulator, painter, hidden input and observers exactly once.
	useEffect(() => {
		const host = hostRef.current;
		if (!host || typeof document === "undefined") return undefined;
		const screen = createScreen({
			cols: 80,
			rows: 24,
			scrollback: latest.current.state?.environment?.scrollback ?? 1000,
		});
		const renderer = createRenderer({
			container: host,
			theme: () => latest.current.theme,
			font: () => latest.current.theme,
		});
		renderer.measure();

		const input = document.createElement("textarea");
		input.className = "ce-term-input";
		input.setAttribute("aria-label", t("terminal.title"));
		input.autocapitalize = "off";
		input.autocomplete = "off";
		input.spellcheck = false;
		host.appendChild(input);

		let frame = 0;
		let offset = 0;
		let dirty = true;
		// Selection lives in buffer coordinates, so it survives scrolling; a drag
		// sets the head, a double click takes a word, a triple click a row.
		let selection = null;
		let dragKind = null;
		let clickCount = 0;
		let lastClick = { at: 0, row: -1, col: -1 };

		const rectsForSelection = () => {
			if (selection === null) return [];
			const first = screen.topRow(offset);
			const rects = [];
			for (let row = 0; row < screen.rows; row++) {
				const span = selectionRow(selection, first + row, screen.cols);
				if (span === null) continue;
				rects.push({
					left: span.from * renderer.cellWidth,
					top: row * renderer.rowHeight,
					width: Math.max(1, (span.to - span.from) * renderer.cellWidth),
					height: renderer.rowHeight,
				});
			}
			return rects;
		};

		const paint = () => {
			frame = 0;
			if (!dirty) return;
			dirty = false;
			renderer.paint(screen, { offset });
			renderer.paintSelection(rectsForSelection());
		};
		const schedule = () => {
			dirty = true;
			if (frame === 0) frame = requestAnimationFrame(paint);
		};

		const clearSelection = () => {
			if (selection === null) return;
			selection = null;
			schedule();
		};

		/** Fit the grid to the element and tell the Host when the size changed. */
		const fit = () => {
			const width = host.clientWidth;
			const height = host.clientHeight;
			if (width <= 0 || height <= 0) return;
			const cols = Math.max(2, Math.floor(width / renderer.cellWidth));
			const rows = Math.max(1, Math.floor(height / renderer.rowHeight));
			const changed = screen.resize(cols, rows);
			renderer.measure();
			renderer.invalidate();
			schedule();
			const info = latest.current.state?.info;
			if (changed && latest.current.writable && (info === undefined || info.cols !== cols || info.rows !== rows)) {
				model.resize(cols, rows);
			}
		};

		/** Copy the selection; used by the shortcut, the context menu path and tests. */
		const copySelection = async () => {
			if (selection === null) return false;
			const text = selectionText(selection, (row) => screen.lineAt(row), screen.cols);
			if (text === "") return false;
			try {
				await navigator.clipboard.writeText(text);
			} catch {
				return false;
			}
			return true;
		};

		/** Forward one pointer event to a program that owns the pointer. */
		const reportMouse = (action, event) => {
			if (!latest.current.writable) return false;
			const cell = renderer.cellAt(event.clientX, event.clientY);
			if (cell === null) return false;
			const bytes = encodeMouse({
				button: event.button === 2 ? "right" : event.button === 1 ? "middle" : "left",
				action,
				x: cell.x,
				y: cell.y,
				shiftKey: event.shiftKey,
				altKey: event.altKey,
				ctrlKey: event.ctrlKey,
			}, { protocol: screen.modes.sgrMouse ? "sgr" : "x10", mode: screen.modes.mouse });
			if (bytes === null) return false;
			model.write(bytes, true);
			return true;
		};

		// Keep the bytes out of the way of the browser's own shortcuts: only the
		// ones the terminal owns are consumed here.
		const onKeyDown = (event) => {
			if (event.isComposing || event.keyCode === 229) return;
			if (!latest.current.writable) return;
			const mod = event.metaKey || event.ctrlKey;
			// Copy, select-all and scrollback keys belong to the terminal surface,
			// not to the shell.
			if (mod && !event.altKey && (event.key === "c" || event.key === "C") && !event.shiftKey) {
				if (selection !== null) {
					event.preventDefault();
					void copySelection().then((copied) => { if (copied) clearSelection(); });
					return;
				}
				if (event.metaKey) return; // let the browser copy anything else
			}
			if (mod && event.shiftKey && (event.key === "c" || event.key === "C")) {
				if (selection !== null) {
					event.preventDefault();
					void copySelection().then((copied) => { if (copied) clearSelection(); });
					return;
				}
			}
			if (mod && !event.altKey && !event.shiftKey && (event.key === "a" || event.key === "A") && selection !== null) {
				event.preventDefault();
				selection = selectAll(screen.bufferRows, screen.cols);
				schedule();
				return;
			}
			if (event.metaKey && !event.altKey && !event.ctrlKey && (event.key === "a" || event.key === "A") && selection === null) {
				event.preventDefault();
				selection = selectAll(screen.bufferRows, screen.cols);
				schedule();
				return;
			}
			if (event.shiftKey && (event.key === "PageUp" || event.key === "PageDown" || event.key === "Home" || event.key === "End")) {
				event.preventDefault();
				const pages = Math.max(1, screen.rows - 1);
				if (event.key === "PageUp") offset = Math.min(offset + pages, screen.scrollbackRows);
				else if (event.key === "PageDown") offset = Math.max(0, offset - pages);
				else if (event.key === "Home") offset = screen.scrollbackRows;
				else offset = 0;
				schedule();
				return;
			}
			const bytes = keyToBytes(event, screen.modes);
			if (bytes === null) return;
			event.preventDefault();
			clearSelection();
			model.write(bytes, true);
			// Typing at the bottom resumes following the output.
			if (offset !== 0) { offset = 0; schedule(); }
		};
		const onInput = () => {
			if (!latest.current.writable) { input.value = ""; return; }
			const text = input.value;
			if (text === "") return;
			input.value = "";
			clearSelection();
			model.write(text, true);
			if (offset !== 0) { offset = 0; schedule(); }
		};
		const onPaste = (event) => {
			if (!latest.current.writable) return;
			const text = event.clipboardData?.getData("text") ?? "";
			if (text === "") return;
			event.preventDefault();
			clearSelection();
			model.write(pasteToBytes(text, screen.modes.bracketedPaste), true);
			if (offset !== 0) { offset = 0; schedule(); }
		};
		const onWheel = (event) => {
			// A full-screen program that owns the pointer also owns the wheel: vim
			// and less scroll themselves, and stealing those turns is worse than
			// ignoring them.
			if (mouseOwned(screen.modes) && !event.shiftKey && latest.current.writable) {
				const cell = renderer.cellAt(event.clientX, event.clientY);
				if (cell !== null) {
					const bytes = encodeWheel(
						{ deltaY: event.deltaY, x: cell.x, y: cell.y, shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey },
						{ protocol: screen.modes.sgrMouse ? "sgr" : "x10", mode: screen.modes.mouse },
					);
					if (bytes !== null) {
						event.preventDefault();
						model.write(bytes, true);
						return;
					}
				}
			}
			const step = event.deltaMode === 1 ? 1 : 3;
			const next = offset + (event.deltaY > 0 ? -step : step);
			const clamped = Math.max(0, Math.min(next, screen.scrollbackRows));
			if (clamped === offset) return;
			event.preventDefault();
			offset = clamped;
			schedule();
		};
		const onFocus = () => host.classList.add("ce-term-focused");
		const onBlur = () => host.classList.remove("ce-term-focused");
		const onPointerDown = (event) => {
			input.focus({ preventScroll: true });
			if (event.button !== 0) return;
			// Shift keeps selection working while a program owns the pointer.
			if (mouseOwned(screen.modes) && !event.shiftKey) {
				if (reportMouse("press", event)) {
					dragKind = "mouse";
					host.setPointerCapture?.(event.pointerId);
					return;
				}
			}
			const cell = renderer.cellAt(event.clientX, event.clientY);
			if (cell === null) return;
			const row = screen.topRow(offset) + cell.y;
			const now = typeof performance !== "undefined" ? performance.now() : Date.now();
			const repeat = lastClick.row === row && lastClick.col === cell.x && now - lastClick.at < 500;
			clickCount = repeat ? Math.min(3, clickCount + 1) : 1;
			lastClick = { at: now, row, col: cell.x };
			if (clickCount >= 3) selection = selectLine(row, screen.cols);
			else if (clickCount === 2) selection = selectWord(screen.lineAt(row), row, cell.x);
			else selection = { anchor: { row, col: cell.x }, head: { row, col: cell.x } };
			dragKind = "select";
			host.setPointerCapture?.(event.pointerId);
			schedule();
		};
		const onPointerMove = (event) => {
			if (dragKind === "mouse") {
				if (reportsMotion(screen.modes.mouse)) reportMouse("drag", event);
				return;
			}
			if (dragKind !== "select" || selection === null) return;
			const cell = renderer.cellAt(event.clientX, event.clientY);
			if (cell === null) return;
			const row = screen.topRow(offset) + cell.y;
			if (selection.head.row === row && selection.head.col === cell.x) return;
			selection = { anchor: selection.anchor, head: { row, col: cell.x } };
			// Dragging past the top or bottom edge scrolls the viewport.
			if (cell.y < 0 && offset < screen.scrollbackRows) offset += 1;
			else if (cell.y >= screen.rows && offset > 0) offset -= 1;
			schedule();
		};
		const onPointerUp = (event) => {
			if (dragKind === "mouse" && reportsMotion(screen.modes.mouse)) reportMouse("release", event);
			dragKind = null;
			host.releasePointerCapture?.(event.pointerId);
		};
		const onContextMenu = (event) => {
			// Right click copies a selection, or pastes when there is none — the two
			// things a terminal's context menu is used for most.
			event.preventDefault();
			if (selection !== null) {
				void copySelection().then((copied) => { if (copied) clearSelection(); });
				return;
			}
			input.focus({ preventScroll: true });
		};

		input.addEventListener("keydown", onKeyDown);
		input.addEventListener("input", onInput);
		input.addEventListener("paste", onPaste);
		input.addEventListener("focus", onFocus);
		input.addEventListener("blur", onBlur);
		host.addEventListener("wheel", onWheel, { passive: false });
		host.addEventListener("pointerdown", onPointerDown);
		host.addEventListener("pointermove", onPointerMove);
		host.addEventListener("pointerup", onPointerUp);
		host.addEventListener("pointercancel", onPointerUp);
		host.addEventListener("contextmenu", onContextMenu);

		const observer = new ResizeObserver(fit);
		observer.observe(host);
		fit();
		schedule();

		engine.current = {
			screen,
			renderer,
			input,
			fit,
			schedule,
			resetOffset() { offset = 0; },
			/** Apply one render frame and acknowledge it to the Host immediately. */
			copySelection,
			get selection() { return selection; },
			get scrollbackOffset() { return offset; },
			apply(render) {
				if (!render) return;
				const snapshot = render.frame?.type === "snapshot";
				applyRenderFrame(screen, render);
				if (snapshot) renderer.invalidate();
				offset = 0;
				schedule();
				model.acknowledge(render.revision);
			},
			measure: () => renderer.measure(),
			dispose() {
				observer.disconnect();
				if (frame !== 0) cancelAnimationFrame(frame);
				input.removeEventListener("keydown", onKeyDown);
				input.removeEventListener("input", onInput);
				input.removeEventListener("paste", onPaste);
				input.removeEventListener("focus", onFocus);
				input.removeEventListener("blur", onBlur);
				host.removeEventListener("wheel", onWheel);
				host.removeEventListener("pointerdown", onPointerDown);
				host.removeEventListener("pointermove", onPointerMove);
				host.removeEventListener("pointerup", onPointerUp);
				host.removeEventListener("pointercancel", onPointerUp);
				host.removeEventListener("contextmenu", onContextMenu);
				input.remove();
				renderer.dispose();
			},
		};
		setEngineReady((value) => value + 1);
		return () => {
			engine.current?.dispose();
			engine.current = undefined;
		};
		// Rebuilt only with the model; theme and size updates are applied in place.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [model]);

	// Theme swaps (light/dark, font size) re-measure and repaint without a rebuild.
	useEffect(() => {
		const current = engine.current;
		if (!current) return;
		const rows = current.screen.rows;
		current.measure();
		current.renderer.invalidate();
		current.fit();
		void rows;
	}, [theme.fontFamily, theme.fontSize, engineReady]);

	// Feed each stream frame into the emulator.
	useEffect(() => {
		engine.current?.apply(state?.render);
	}, [state?.render, engineReady]);

	// Focus the screen when it becomes visible and writable.
	useEffect(() => {
		if (!state?.writable || tab.visible === false) return;
		const input = engine.current?.input;
		input?.focus({ preventScroll: true });
	}, [state?.writable, tab.visible, engineReady]);

	// The host element is filled imperatively by the engine, so it must stay
	// childless from React's point of view: status lines are siblings drawn over
	// it, never React children that a re-render would try to reconcile.
	const failed = state?.phase === "failed" || state?.issue !== undefined;
	return h(
		"div",
		{ className: "ce-term-shell" },
		h("div", { className: "ce-term", ref: hostRef, "data-ce-terminal": "" }),
		state?.info === undefined && !failed
			? h("div", { className: "ce-term-status", role: "status" }, t("terminal.connecting"))
			: null,
		failed
			? h("div", { className: "ce-term-status ce-term-status-error", role: "alert" }, state?.error ?? t("terminal.failed"))
			: null,
	);
}
