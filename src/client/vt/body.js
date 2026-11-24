/* ---------------- terminal tab body: emulator + renderer + input ----------------
 *
 * DSH owns the process and the stream; this module owns the screen and when it
 * is painted. Output frames are consumed from the raw terminal store without
 * going through React: a frame is parsed immediately and acknowledged, while
 * paint is coalesced into one animation frame. React only sees connection
 * chrome (phase, writable, title), so a busy shell cannot re-render the tab.
 *
 * Input policy: keys become bytes (`keys.js`), characters come from the hidden
 * textarea's `input` event so IME and dead keys work, and paste is wrapped in
 * bracketed-paste markers when the shell asked for them. Large pastes are
 * chunked; one oversized write would be refused by the Host and detach the
 * terminal.
 */

import { h, useEffect, useRef, useState } from "../react.js";
import { createScreen } from "./screen.js";
import { createRenderer } from "./render.js";
import { keyToBytes, pasteChunks } from "./keys.js";
import { lineText, selectionRow, selectionText, selectAll, selectLine, selectWord } from "./selection.js";
import { encodeMouse, encodeWheel, mouseOwned, reportsMotion, reportsHover } from "./mouse.js";
import { offsetForRow, searchScreen } from "./search.js";
import { copyRows, copyStart, copyText, lineSelection, moveCopy, normalizeCopyPosition } from "./copy.js";

const DEFAULT_THEME = {
	fg: "var(--dsw-alias-label-primary, #d4d4d4)",
	bg: "var(--dsw-alias-bg-base, #1e1e1e)",
	fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
	fontSize: 13,
	dark: true,
};

const SEARCH_DEBOUNCE_MS = 140;
const SYNC_OUTPUT_TIMEOUT_MS = 150;
const FIT_DEBOUNCE_MS = 80;
const PASTE_DELAY_MS = 10;

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
		// The theme service resolves `system` before publishing the snapshot, so
		// this is the effective palette, not the persisted preference.
		dark: snapshot.active?.colorScheme !== "light",
	};
}

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

/**
 * Terminal tab body.
 *
 * @param props - slot-injected model accessors, chrome hook, theme hook and copy.
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
	const searchInputRef = useRef(null);
	const searchOpenRef = useRef(false);
	const [engineReady, setEngineReady] = useState(0);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInfo, setSearchInfo] = useState({ index: 0, count: 0 });
	const [copyInfo, setCopyInfo] = useState(null);
	const [notice, setNotice] = useState("");
	const [a11yText, setA11yText] = useState("");
	searchOpenRef.current = searchOpen;
	const latest = useRef({ state, writable: Boolean(state?.writable), theme, visible: tab.visible !== false });
	latest.current = { state, writable: Boolean(state?.writable), theme, visible: tab.visible !== false };

	// The Host holds the terminal process for this window while the tab exists.
	useEffect(() => model.mount(), [model]);

	// Build the emulator, painter, hidden input and observers exactly once.
	useEffect(() => {
		const host = hostRef.current;
		if (!host || typeof document === "undefined") return undefined;
		const environment = latest.current.state?.environment;
		const screen = createScreen({
			cols: 80,
			rows: 24,
			scrollback: environment?.scrollback ?? 1000,
			scrollbackBytes: 10 * 1024 * 1024,
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
		let fitTimer = 0;
		let syncTimer = 0;
		let searchTimer = 0;
		let pasteTimer = 0;
		let pasteQueue = [];
		let offset = 0;
		let anchorSeq = null;
		let dirty = true;
		let visible = latest.current.visible;
		let lastRevision = -1;
		let selection = null;
		let dragKind = null;
		let scrollDrag = false;
		let clickCount = 0;
		let lastClick = { at: 0, row: -1, col: -1 };
		let search = { query: "", matches: [], index: -1 };
		let copy = null;
		let copyInfoKey = "";
		let noticeTimer = 0;
		let a11yTimer = 0;
		let lastNotice = { text: "", at: 0 };
		let marks = new Map();
		let promptSeqs = [];
		let lastCommand = null;
		let commandStartedAt = 0;
		let markFirstSeq = screen.firstSeq;
		let lastAlt = screen.alt;

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
		const maxOffset = () => (screen.alt ? 0 : screen.scrollbackRows);
		const updateA11y = () => {
			if (!visible) return;
			const first = screen.topRow(offset);
			const lines = [];
			for (let row = 0; row < screen.rows; row++) lines.push(lineText(screen.lineAt(first + row)));
			const text = lines.join("\n").replace(/\s+$/u, "");
			setA11yText((previous) => (previous === text ? previous : text));
		};

		const toRows = () => {
			if (selection === null) return null;
			const toRow = (position) => {
				const index = screen.indexOfSeq(position.seq);
				if (index >= 0) return index;
				return position.seq < screen.firstSeq ? 0 : Math.max(0, screen.bufferRows - 1);
			};
			return {
				anchor: { row: toRow(selection.anchor), col: selection.anchor.col },
				head: { row: toRow(selection.head), col: selection.head.col },
			};
		};
		const rowsToSelection = (rows) => {
			if (rows === null) return null;
			const toPosition = (position) => ({
				seq: screen.lineSeqAt(position.row),
				col: position.col,
			});
			return { anchor: toPosition(rows.anchor), head: toPosition(rows.head) };
		};

		const rectsForRows = (rows) => {
			const first = screen.topRow(offset);
			const rects = [];
			for (let row = 0; row < screen.rows; row++) {
				const span = selectionRow(rows, first + row, screen.cols);
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
		const rectsForSelection = () => {
			const rects = [];
			const mouse = toRows();
			if (mouse !== null) rects.push(...rectsForRows(mouse));
			if (copy?.anchor) rects.push(...rectsForRows(copyRows(screen, copy.anchor, copy.cursor)));
			return rects;
		};

		const searchRects = () => {
			if (search.query === "" || search.matches.length === 0) return [];
			const first = screen.topRow(offset);
			const rects = [];
			for (let i = 0; i < search.matches.length && rects.length < 400; i++) {
				const match = search.matches[i];
				const index = screen.indexOfSeq(match.seq);
				if (index < first || index >= first + screen.rows) continue;
				rects.push({
					left: match.col * renderer.cellWidth,
					top: (index - first) * renderer.rowHeight,
					width: Math.max(1, match.width * renderer.cellWidth),
					height: renderer.rowHeight,
					current: i === search.index,
				});
			}
			return rects;
		};

		const paint = () => {
			frame = 0;
			if (!dirty || !visible) return;
			dirty = false;
			const damage = screen.consumeDamage();
			renderer.paint(screen, { offset, damage, hideCursor: copy !== null });
			renderer.paintSelection(rectsForSelection());
			renderer.paintCopyCursor(copyCursorRect());
			renderer.paintSearch(searchRects());
			renderer.paintScrollbar({
				offset,
				maxOffset: maxOffset(),
				viewportRows: screen.rows,
				trackHeight: screen.rows * renderer.rowHeight,
			});
		};
		const schedule = () => {
			dirty = true;
			if (!visible) {
				// Hidden output still parses; collapse its damage into one full
				// repaint so a background shell cannot grow an unbounded set.
				screen.markFull();
				return;
			}
			if (screen.modes.syncOutput) {
				if (frame !== 0) {
					cancelAnimationFrame(frame);
					frame = 0;
				}
				if (syncTimer === 0) {
					syncTimer = setTimeout(() => {
						syncTimer = 0;
						schedule();
					}, SYNC_OUTPUT_TIMEOUT_MS);
				}
				return;
			}
			if (syncTimer !== 0) {
				clearTimeout(syncTimer);
				syncTimer = 0;
			}
			if (frame === 0) frame = requestAnimationFrame(paint);
		};

		const clearSelection = () => {
			if (selection === null) return;
			selection = null;
			schedule();
		};

		const setOffset = (next) => {
			const limit = maxOffset();
			const clamped = Math.max(0, Math.min(limit, Math.trunc(next)));
			if (clamped === offset) return false;
			offset = clamped;
			anchorSeq = clamped === 0 ? null : screen.lineSeqAt(screen.topRow(clamped));
			schedule();
			return true;
		};

		const followOutput = () => {
			if (anchorSeq === null) {
				offset = 0;
				return;
			}
			const index = screen.indexOfSeq(anchorSeq);
			const limit = maxOffset();
			if (index < 0) {
				offset = Math.min(limit, Math.max(0, offset));
				anchorSeq = screen.lineSeqAt(screen.topRow(offset));
				return;
			}
			offset = Math.max(0, Math.min(limit, limit - index));
			if (offset === 0) anchorSeq = null;
		};

		const clearSearch = () => {
			search = { query: "", matches: [], index: -1 };
			if (searchTimer !== 0) {
				clearTimeout(searchTimer);
				searchTimer = 0;
			}
			setSearchInfo({ index: 0, count: 0 });
			schedule();
		};

		const reportSearch = () => {
			setSearchInfo({ index: search.index >= 0 ? search.index + 1 : 0, count: search.matches.length });
		};

		const goToMatch = (index) => {
			if (search.matches.length === 0) return;
			const count = search.matches.length;
			search.index = ((index % count) + count) % count;
			const match = search.matches[search.index];
			const row = screen.indexOfSeq(match.seq);
			if (row >= 0) {
				const next = offsetForRow(screen, row, 2);
				offset = next;
				anchorSeq = next === 0 ? null : screen.lineSeqAt(screen.topRow(next));
			}
			reportSearch();
			schedule();
		};

		const refreshSearch = () => {
			if (search.query === "") return;
			const previous = search.matches[search.index];
			const matches = searchScreen(screen, search.query);
			search.matches = matches;
			if (previous !== undefined) {
				const at = matches.findIndex((match) => match.seq === previous.seq && match.col === previous.col);
				search.index = at >= 0 ? at : Math.min(search.index, matches.length - 1);
			} else {
				search.index = matches.length > 0 ? 0 : -1;
			}
			reportSearch();
			schedule();
		};

		const scheduleSearchRefresh = () => {
			if (search.query === "" || searchTimer !== 0) return;
			searchTimer = setTimeout(() => {
				searchTimer = 0;
				refreshSearch();
			}, SEARCH_DEBOUNCE_MS);
		};

		const setSearch = (query) => {
			search.query = query;
			if (searchTimer !== 0) {
				clearTimeout(searchTimer);
				searchTimer = 0;
			}
			if (query === "") {
				search.matches = [];
				search.index = -1;
				reportSearch();
				schedule();
				return;
			}
			search.matches = searchScreen(screen, query);
			search.index = search.matches.length > 0 ? 0 : -1;
			if (search.index >= 0) {
				const match = search.matches[0];
				const row = screen.indexOfSeq(match.seq);
				if (row >= 0) {
					const next = offsetForRow(screen, row, 2);
					offset = next;
					anchorSeq = next === 0 ? null : screen.lineSeqAt(screen.topRow(next));
				}
			}
			reportSearch();
			schedule();
		};

		const openSearch = () => {
			setSearchOpen(true);
		};
		const closeSearch = () => {
			setSearchOpen(false);
			setSearchQuery("");
			clearSearch();
		};

		const announce = (text, { system = false } = {}) => {
			if (typeof text !== "string" || text === "") return;
			const trimmed = text.slice(0, 160);
			const at = now();
			if (trimmed === lastNotice.text && at - lastNotice.at < 1200) return;
			lastNotice = { text: trimmed, at };
			setNotice(trimmed);
			if (noticeTimer !== 0) clearTimeout(noticeTimer);
			noticeTimer = setTimeout(() => {
				noticeTimer = 0;
				setNotice("");
			}, 2600);
			if (system && typeof Notification !== "undefined" && Notification.permission === "granted" && globalThis.document?.hidden === true) {
				try { new Notification("DSH terminal", { body: trimmed }); } catch { /* notification permission or platform refused */ }
			}
		};

		const currentSeq = () => screen.lineSeqAt(screen.topRow(0) + screen.cursor.y);
		const mark = (seq, field, value) => {
			if (seq < 0) return null;
			let entry = marks.get(seq);
			if (entry === undefined) {
				entry = {};
				marks.set(seq, entry);
			}
			entry[field] = value ?? true;
			return entry;
		};
		const rememberPrompt = (seq) => {
			if (seq < 0 || promptSeqs.includes(seq)) return;
			promptSeqs.push(seq);
			// Keep the oldest marks bounded; the screen itself already bounds rows.
			if (promptSeqs.length > 500) promptSeqs = promptSeqs.slice(-500);
		};
		const pruneMarks = () => {
			if (screen.alt) return;
			const first = screen.firstSeq;
			if (first === markFirstSeq) return;
			markFirstSeq = first;
			promptSeqs = promptSeqs.filter((seq) => seq >= first);
			for (const seq of marks.keys()) if (seq < first) marks.delete(seq);
		};
		const lastPromptBefore = (seq) => {
			const current = screen.indexOfSeq(seq);
			let best = null;
			let bestRow = -1;
			for (const prompt of promptSeqs) {
				const row = screen.indexOfSeq(prompt);
				if (row >= 0 && row <= current && row > bestRow) {
					best = prompt;
					bestRow = row;
				}
			}
			return best ?? seq;
		};
		const handleShellMark = (payload) => {
			const parts = payload.split(";");
			const kind = (parts[0] ?? "").toUpperCase();
			const seq = currentSeq();
			if (kind === "A") {
				mark(seq, "prompt");
				rememberPrompt(seq);
				lastCommand = null;
			} else if (kind === "B") {
				mark(seq, "command");
			} else if (kind === "C") {
				mark(seq, "output");
				commandStartedAt = now();
			} else if (kind === "D") {
				const code = Number.parseInt(parts[1] ?? "0", 10);
				const exitCode = Number.isFinite(code) ? code : 0;
				const elapsed = commandStartedAt === 0 ? 0 : now() - commandStartedAt;
				mark(seq, "exit", exitCode);
				lastCommand = { startSeq: lastPromptBefore(seq), endSeq: seq };
				commandStartedAt = 0;
				if (elapsed >= 5000 || exitCode !== 0) {
					announce(t("terminal.commandDone", { seconds: Math.max(0, Math.round(elapsed / 1000)), code: exitCode }), { system: true });
				}
			}
		};
		const jumpPrompt = (direction) => {
			if (promptSeqs.length === 0) return false;
			const rows = promptSeqs
				.map((seq) => ({ seq, row: screen.indexOfSeq(seq) }))
				.filter((entry) => entry.row >= 0)
				.sort((a, b) => a.row - b.row);
			if (rows.length === 0) return false;
			const top = screen.topRow(offset);
			const target = direction < 0
				? [...rows].reverse().find((entry) => entry.row < top)
				: rows.find((entry) => entry.row >= top + screen.rows);
			if (target === undefined) return false;
			const next = offsetForRow(screen, target.row, 1);
			offset = next;
			anchorSeq = next === 0 ? null : screen.lineSeqAt(screen.topRow(next));
			schedule();
			return true;
		};
		const copyLastCommand = async () => {
			if (lastCommand === null) {
				announce(t("terminal.commandNone"));
				return false;
			}
			const text = copyText(screen, { seq: lastCommand.startSeq, col: 0 }, { seq: lastCommand.endSeq, col: screen.cols });
			if (text === "") {
				announce(t("terminal.commandNone"));
				return false;
			}
			try {
				await navigator.clipboard.writeText(text);
			} catch {
				announce(t("terminal.copyFailed"));
				return false;
			}
			announce(t("terminal.copyDone"));
			return true;
		};

		const syncCopyInfo = () => {
			if (copy === null) {
				if (copyInfoKey !== "") {
					copyInfoKey = "";
					setCopyInfo(null);
				}
				return;
			}
			const key = `${copy.anchor === null ? "0" : "1"}:${copy.cursor.seq}:${copy.cursor.col}`;
			if (key === copyInfoKey) return;
			copyInfoKey = key;
			setCopyInfo({ selecting: copy.anchor !== null, row: screen.indexOfSeq(copy.cursor.seq), col: copy.cursor.col });
		};
		const ensureCopyVisible = () => {
			if (copy === null) return;
			const index = screen.indexOfSeq(copy.cursor.seq);
			if (index < 0) return;
			const top = screen.topRow(offset);
			if (index < top) setOffset(offset - (top - index));
			else if (index >= top + screen.rows) setOffset(offset + (index - (top + screen.rows) + 1));
		};
		const enterCopyMode = () => {
			if (copy !== null) return;
			if (searchOpenRef.current) closeSearch();
			copy = { cursor: copyStart(screen, offset), anchor: null };
			ensureCopyVisible();
			syncCopyInfo();
			schedule();
			input.focus({ preventScroll: true });
		};
		const exitCopyMode = () => {
			if (copy === null) return;
			copy = null;
			syncCopyInfo();
			schedule();
			input.focus({ preventScroll: true });
		};
		const yankCopy = async () => {
			if (copy === null) return false;
			const text = copy.anchor !== null
				? copyText(screen, copy.anchor, copy.cursor)
				: copyText(screen, lineSelection(screen, copy.cursor).anchor, lineSelection(screen, copy.cursor).head);
			if (text === "") {
				exitCopyMode();
				return false;
			}
			try {
				await navigator.clipboard.writeText(text);
			} catch {
				announce(t("terminal.copyFailed"));
				return false;
			}
			announce(t("terminal.copyDone"));
			exitCopyMode();
			return true;
		};
		const copyMove = (action) => {
			if (copy === null) return;
			const next = moveCopy(screen, copy.cursor, action, { page: Math.max(1, screen.rows - 1) });
			if (next === null) return;
			copy.cursor = normalizeCopyPosition(screen, next);
			ensureCopyVisible();
			syncCopyInfo();
			schedule();
		};
		const toggleCopySelection = () => {
			if (copy === null) return;
			copy.anchor = copy.anchor === null ? copy.cursor : null;
			syncCopyInfo();
			schedule();
		};
		const selectCopyLine = () => {
			if (copy === null) return;
			const line = lineSelection(screen, copy.cursor);
			copy.anchor = line.anchor;
			copy.cursor = line.head;
			ensureCopyVisible();
			syncCopyInfo();
			schedule();
		};
		const copyCursorRect = () => {
			if (copy === null) return null;
			const index = screen.indexOfSeq(copy.cursor.seq);
			if (index < 0) return null;
			const row = index - screen.topRow(offset);
			if (row < 0 || row >= screen.rows) return null;
			return {
				left: copy.cursor.col * renderer.cellWidth,
				top: row * renderer.rowHeight,
				width: renderer.cellWidth,
				height: renderer.rowHeight,
			};
		};
		const handleCopyKey = (event) => {
			if (copy === null) return false;
			const key = event.key;
			if (key === "Escape" || key === "q") {
				exitCopyMode();
				return true;
			}
			if (key === "y" || key === "Enter") {
				void yankCopy();
				return true;
			}
			if (key === "v" || key === " ") {
				toggleCopySelection();
				return true;
			}
			if (key === "V") {
				selectCopyLine();
				return true;
			}
			if ((event.ctrlKey || event.metaKey) && key === "Home") {
				copyMove("top");
				return true;
			}
			if ((event.ctrlKey || event.metaKey) && key === "End") {
				copyMove("bottom");
				return true;
			}
			const motions = {
				ArrowUp: "up", k: "up",
				ArrowDown: "down", j: "down",
				ArrowLeft: "left", h: "left",
				ArrowRight: "right", l: "right",
				PageUp: "page-up", PageDown: "page-down",
				Home: "line-start", End: "line-end",
				"0": "line-start", "$": "line-end",
				g: "top", G: "bottom",
				w: "word", b: "word-back", e: "word-end",
				W: "big-word", B: "big-word-back", E: "big-word-end",
				"{": "paragraph-back", "}": "paragraph",
			};
			const action = motions[key];
			if (action !== undefined) {
				copyMove(action);
				return true;
			}
			return true;
		};

		const fitNow = () => {
			if (fitTimer !== 0) {
				clearTimeout(fitTimer);
				fitTimer = 0;
			}
			const width = host.clientWidth;
			const height = host.clientHeight;
			if (width <= 0 || height <= 0) return;
			const cols = Math.max(2, Math.floor(width / renderer.cellWidth));
			const rows = Math.max(1, Math.floor(height / renderer.rowHeight));
			const widthChanged = cols !== screen.cols;
			const anchor = anchorSeq;
			const changed = screen.resize(cols, rows);
			renderer.measure();
			renderer.invalidate();
			if (changed) selection = null;
			if (changed && widthChanged) {
				// Reflow assigns new row identities; the old anchor cannot be
				// mapped, so the reader starts again at the live bottom.
				offset = 0;
				anchorSeq = null;
				if (copy !== null) {
					copy = null;
					syncCopyInfo();
				}
			} else if (changed && anchor !== null) {
				const index = screen.indexOfSeq(anchor);
				if (index < 0) {
					offset = 0;
					anchorSeq = null;
				} else {
					offset = Math.max(0, Math.min(maxOffset(), maxOffset() - index));
					if (offset === 0) anchorSeq = null;
				}
			}
			if (search.query !== "") scheduleSearchRefresh();
			schedule();
			const info = latest.current.state?.info;
			if (changed && latest.current.writable && (info === undefined || info.cols !== cols || info.rows !== rows)) {
				model.resize(cols, rows);
			}
		};
		const scheduleFit = () => {
			if (fitTimer !== 0) return;
			fitTimer = setTimeout(() => {
				fitTimer = 0;
				fitNow();
			}, FIT_DEBOUNCE_MS);
		};

		const copySelection = async () => {
			const rows = toRows();
			if (rows === null) return false;
			const text = selectionText(rows, (row) => screen.lineAt(row), screen.cols);
			if (text === "") return false;
			try {
				await navigator.clipboard.writeText(text);
			} catch {
				return false;
			}
			return true;
		};

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

		const linkAt = (cell) => {
			const line = screen.lineAt(screen.topRow(offset) + cell.y);
			if (!line) return null;
			let col = cell.x;
			while (col >= 0 && line.cells[col]?.w === 0) col--;
			return line.cells[col]?.link ?? null;
		};

		const openLink = (uri) => {
			if (typeof uri !== "string" || !/^(https?:|mailto:)/iu.test(uri)) return;
			const target = globalThis.window;
			if (target?.open) target.open(uri, "_blank", "noopener,noreferrer");
		};

		const onKeyDown = (event) => {
			if (event.isComposing || event.keyCode === 229) return;
			if (copy !== null) {
				event.preventDefault();
				event.stopPropagation?.();
				handleCopyKey(event);
				return;
			}
			if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === " " || event.code === "Space")) {
				event.preventDefault();
				event.stopPropagation?.();
				enterCopyMode();
				return;
			}
			if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
				event.preventDefault();
				jumpPrompt(event.key === "ArrowUp" ? -1 : 1);
				return;
			}
			if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === "y" || event.key === "Y" || event.key === "o" || event.key === "O")) {
				event.preventDefault();
				void copyLastCommand();
				return;
			}
			if (!latest.current.writable) return;
			const mod = event.metaKey || event.ctrlKey;
			if ((event.metaKey || (event.ctrlKey && event.shiftKey)) && !event.altKey && (event.key === "f" || event.key === "F")) {
				event.preventDefault();
				openSearch();
				return;
			}
			if (event.key === "Escape" && searchOpenRef.current) {
				event.preventDefault();
				closeSearch();
				return;
			}
			// Copy, select-all and scrollback keys belong to the terminal surface,
			// not to the shell.
			if (mod && !event.altKey && (event.key === "c" || event.key === "C") && !event.shiftKey) {
				if (selection !== null) {
					event.preventDefault();
					void copySelection().then((copied) => { if (copied) clearSelection(); });
					return;
				}
				if (event.metaKey) return;
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
				selection = rowsToSelection(selectAll(screen.bufferRows, screen.cols));
				schedule();
				return;
			}
			if (event.metaKey && !event.altKey && !event.ctrlKey && (event.key === "a" || event.key === "A") && selection === null) {
				event.preventDefault();
				selection = rowsToSelection(selectAll(screen.bufferRows, screen.cols));
				schedule();
				return;
			}
			if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && (event.key === "Home" || event.key === "End")) {
				event.preventDefault();
				setOffset(event.key === "Home" ? maxOffset() : 0);
				return;
			}
			if (event.shiftKey && (event.key === "PageUp" || event.key === "PageDown" || event.key === "Home" || event.key === "End")) {
				event.preventDefault();
				const pages = Math.max(1, screen.rows - 1);
				if (event.key === "PageUp") setOffset(Math.min(offset + pages, maxOffset()));
				else if (event.key === "PageDown") setOffset(Math.max(0, offset - pages));
				else if (event.key === "Home") setOffset(maxOffset());
				else setOffset(0);
				return;
			}
			const bytes = keyToBytes(event, screen.modes);
			if (bytes === null) return;
			event.preventDefault();
			clearSelection();
			model.write(bytes, true);
			if (offset !== 0) {
				offset = 0;
				anchorSeq = null;
				schedule();
			}
		};
		const onInput = () => {
			if (copy !== null || !latest.current.writable) { input.value = ""; return; }
			const text = input.value;
			if (text === "") return;
			input.value = "";
			clearSelection();
			model.write(text, true);
			if (offset !== 0) {
				offset = 0;
				anchorSeq = null;
				schedule();
			}
		};
		const pasteChunkSize = () => {
			const configured = Number(latest.current.state?.environment?.maxInputBytes);
			const budget = Number.isFinite(configured) && configured > 0 ? configured : 64 * 1024;
			// Keep several chunks below the Host's unacknowledged-input window;
			// the delay gives the ack frames a chance to drain between writes.
			return Math.max(1024, Math.min(8192, Math.floor(budget / 16)));
		};
		const pumpPaste = () => {
			pasteTimer = 0;
			if (!latest.current.writable) {
				pasteQueue = [];
				return;
			}
			const chunk = pasteQueue.shift();
			if (chunk === undefined) return;
			model.write(chunk, true);
			if (pasteQueue.length > 0) pasteTimer = setTimeout(pumpPaste, PASTE_DELAY_MS);
		};
		const onPaste = (event) => {
			if (copy !== null || !latest.current.writable) return;
			const text = event.clipboardData?.getData("text") ?? "";
			if (text === "") return;
			event.preventDefault();
			clearSelection();
			pasteQueue.push(...pasteChunks(text, screen.modes.bracketedPaste, pasteChunkSize()));
			if (pasteTimer === 0) pumpPaste();
			if (offset !== 0) {
				offset = 0;
				anchorSeq = null;
				schedule();
			}
		};
		const onWheel = (event) => {
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
			if (screen.alt && screen.modes.altScroll && !event.shiftKey && latest.current.writable) {
				event.preventDefault();
				model.write(event.deltaY < 0 ? "\x1b[A" : "\x1b[B", true);
				return;
			}
			const step = event.deltaMode === 1 ? 1 : 3;
			const next = offset + (event.deltaY > 0 ? -step : step);
			if (setOffset(next)) event.preventDefault();
		};
		const onFocus = () => {
			host.classList.add("ce-term-focused");
			if (!searchOpenRef.current && latest.current.writable && screen.modes.focus) model.write("\x1b[I", true);
		};
		const onBlur = () => {
			host.classList.remove("ce-term-focused");
			if (!searchOpenRef.current && latest.current.writable && screen.modes.focus) model.write("\x1b[O", true);
		};
		const isScrollbarTarget = (target) => {
			let node = target;
			while (node) {
				if (typeof node.className === "string" && node.className.includes("ce-term-scrollbar")) return true;
				node = node.parent;
			}
			return false;
		};
		const scrollToClientY = (clientY) => {
			const track = renderer.scrollbarElement;
			const box = track?.getBoundingClientRect?.();
			if (!box || box.height <= 0) return;
			const ratio = Math.max(0, Math.min(1, 1 - (clientY - box.top) / box.height));
			setOffset(Math.round(ratio * maxOffset()));
		};
		const onPointerDown = (event) => {
			if (copy !== null) exitCopyMode();
			input.focus({ preventScroll: true });
			if (isScrollbarTarget(event.target)) {
				scrollDrag = true;
				host.setPointerCapture?.(event.pointerId);
				scrollToClientY(event.clientY);
				event.preventDefault?.();
				return;
			}
			if (event.button !== 0) return;
			if ((event.metaKey || event.ctrlKey) && !event.altKey) {
				const cell = renderer.cellAt(event.clientX, event.clientY);
				const link = cell === null ? null : linkAt(cell);
				if (link) {
					event.preventDefault?.();
					openLink(link);
					return;
				}
			}
			if (mouseOwned(screen.modes) && !event.shiftKey) {
				if (reportMouse("press", event)) {
					dragKind = "mouse";
					host.setPointerCapture?.(event.pointerId);
					return;
				}
			}
			const cell = renderer.cellAt(event.clientX, event.clientY);
			if (cell === null) return;
			const row = Math.max(0, Math.min(screen.bufferRows - 1, screen.topRow(offset) + cell.y));
			const at = now();
			const repeat = lastClick.row === row && lastClick.col === cell.x && at - lastClick.at < 500;
			clickCount = repeat ? Math.min(3, clickCount + 1) : 1;
			lastClick = { at, row, col: cell.x };
			if (clickCount >= 3) selection = rowsToSelection(selectLine(row, screen.cols));
			else if (clickCount === 2) selection = rowsToSelection(selectWord(screen.lineAt(row), row, cell.x));
			else selection = rowsToSelection({ anchor: { row, col: cell.x }, head: { row, col: cell.x } });
			dragKind = "select";
			host.setPointerCapture?.(event.pointerId);
			schedule();
		};
		const onPointerMove = (event) => {
			if (scrollDrag) {
				scrollToClientY(event.clientY);
				return;
			}
			if (dragKind === "mouse") {
				if (reportsMotion(screen.modes.mouse)) reportMouse("drag", event);
				return;
			}
			if (dragKind !== "select" || selection === null) {
				const cell = renderer.cellAt(event.clientX, event.clientY);
				const link = cell === null ? null : linkAt(cell);
				host.style.cursor = link ? "pointer" : "text";
				if (cell !== null && reportsHover(screen.modes.mouse) && latest.current.writable) reportMouse("move", event);
				return;
			}
			const cell = renderer.cellAt(event.clientX, event.clientY);
			if (cell === null) return;
			const row = Math.max(0, Math.min(screen.bufferRows - 1, screen.topRow(offset) + cell.y));
			if (selection.head.seq === screen.lineSeqAt(row) && selection.head.col === cell.x) return;
			selection = { anchor: selection.anchor, head: { seq: screen.lineSeqAt(row), col: cell.x } };
			if (cell.y < 0 && offset < maxOffset()) setOffset(offset + 1);
			else if (cell.y >= screen.rows && offset > 0) setOffset(offset - 1);
			schedule();
		};
		const onPointerUp = (event) => {
			if (scrollDrag) {
				scrollDrag = false;
				host.releasePointerCapture?.(event.pointerId);
				return;
			}
			if (dragKind === "mouse") reportMouse("release", event);
			dragKind = null;
			host.releasePointerCapture?.(event.pointerId);
		};
		const onContextMenu = (event) => {
			event.preventDefault();
			if (selection !== null) {
				void copySelection().then((copied) => { if (copied) clearSelection(); });
				return;
			}
			input.focus({ preventScroll: true });
		};

		const apply = (render) => {
			if (!render) return;
			const snapshot = render.frame?.type === "snapshot";
			// The store keeps the last render after acknowledgement; a chrome-only
			// patch can re-deliver it. Replaying a snapshot would reset the screen.
			if (render.revision === lastRevision) return;
			applyRenderFrame(screen, render);
			lastRevision = render.revision;
			if (snapshot) {
				selection = null;
				marks.clear();
				promptSeqs = [];
				lastCommand = null;
				commandStartedAt = 0;
				markFirstSeq = screen.firstSeq;
				if (copy !== null) {
					copy = null;
					syncCopyInfo();
				}
				offset = 0;
				anchorSeq = null;
				renderer.invalidate();
				// The Host's initial grid is a bootstrap size, not the pane's
				// measured size; fit after replaying the baseline so the bottom
				// rows are not clipped until the next resize.
				fitNow();
				if (search.query !== "") scheduleSearchRefresh();
			} else {
				followOutput();
				pruneMarks();
				if (copy !== null) {
					copy.cursor = normalizeCopyPosition(screen, copy.cursor);
					ensureCopyVisible();
					syncCopyInfo();
				}
			}
			schedule();
			model.acknowledge(render.revision);
		};

		const offMode = screen.onMode((modes) => {
			if (modes.alt === lastAlt) return;
			lastAlt = modes.alt;
			selection = null;
			// Prompt marks are per-row identities; alternate-screen rows use a
			// disjoint seq namespace, so keep the primary marks for the return.
			lastCommand = null;
			commandStartedAt = 0;
			if (copy !== null) {
				copy = null;
				syncCopyInfo();
			}
			offset = 0;
			anchorSeq = null;
			if (search.query !== "") scheduleSearchRefresh();
			schedule();
		});

		const offBell = screen.onBell(() => announce(t("terminal.bell")));
		const offOsc = screen.onOsc(({ command, body }) => {
			if (command === "133" || command === "633") {
				handleShellMark(body);
				return;
			}
			if (command !== "9" && command !== "777") return;
			const text = command === "777" && body.startsWith("notify;")
				? body.slice("notify;".length).replace(/;/gu, " ")
				: body;
			if (text !== "") announce(text);
		});

		let offState = null;
		if (typeof model.state?.subscribe === "function") {
			const onState = () => {
				const current = model.state.getSnapshot();
				if (current?.render) apply(current.render);
			};
			offState = model.state.subscribe(onState);
			const initial = model.state.getSnapshot();
			if (initial?.render) apply(initial.render);
		}

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

		const observer = new ResizeObserver(scheduleFit);
		observer.observe(host);
		fitNow();
		schedule();
		a11yTimer = setInterval(updateA11y, 600);
		updateA11y();

		engine.current = {
			screen,
			renderer,
			input,
			fit: fitNow,
			schedule,
			copySelection,
			get selection() { return selection; },
			get scrollbackOffset() { return offset; },
			setVisible(next) {
				visible = next !== false;
				if (!visible) {
					if (frame !== 0) cancelAnimationFrame(frame);
					frame = 0;
					return;
				}
				dirty = true;
				fitNow();
				schedule();
			},
			apply,
			setSearch,
			nextMatch() { goToMatch(search.index + 1); },
			previousMatch() { goToMatch(search.index - 1); },
			clearSearch,
			openSearch,
			closeSearch,
			refreshSearch,
			measureAndFit() {
				renderer.measure();
				renderer.invalidate();
				fitNow();
			},
			dispose() {
				observer.disconnect();
				if (frame !== 0) cancelAnimationFrame(frame);
				if (fitTimer !== 0) clearTimeout(fitTimer);
				if (syncTimer !== 0) clearTimeout(syncTimer);
				if (searchTimer !== 0) clearTimeout(searchTimer);
				if (pasteTimer !== 0) clearTimeout(pasteTimer);
				if (noticeTimer !== 0) clearTimeout(noticeTimer);
				if (a11yTimer !== 0) clearInterval(a11yTimer);
				pasteQueue = [];
				offState?.();
				offMode();
				offBell();
				offOsc();
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
		current.measureAndFit();
	}, [theme.fontFamily, theme.fontSize, theme.fg, theme.bg, theme.dark, engineReady]);

	// Hidden tabs still parse, but they do not touch the DOM.
	useEffect(() => {
		engine.current?.setVisible(tab.visible !== false);
	}, [tab.visible, engineReady]);

	// Focus the screen when it becomes visible and writable, unless search owns focus.
	useEffect(() => {
		if (state?.writable) engine.current?.fit();
		if (!state?.writable || tab.visible === false || searchOpen) return;
		const input = engine.current?.input;
		input?.focus({ preventScroll: true });
	}, [state?.writable, tab.visible, engineReady, searchOpen]);

	// Test and non-store compositions feed frames through the chrome hook; the
	// production store is subscribed directly by the engine.
	useEffect(() => {
		if (typeof model.state?.subscribe === "function") return;
		engine.current?.apply(state?.render);
	}, [state?.render, model, engineReady]);

	useEffect(() => {
		if (!searchOpen) return;
		const input = searchInputRef.current;
		input?.focus({ preventScroll: true });
	}, [searchOpen]);

	const failed = state?.phase === "failed" || state?.issue !== undefined;
	const disconnected = state?.phase === "disconnected";
	const searchBar = searchOpen
		? h("div", { className: "ce-term-find", role: "search" },
			h("input", {
				ref: searchInputRef,
				className: "ce-input ce-term-find-input",
				value: searchQuery,
				placeholder: t("terminal.searchPlaceholder"),
				"aria-label": t("terminal.searchPlaceholder"),
				onChange: (event) => {
					const value = event.target.value;
					setSearchQuery(value);
					engine.current?.setSearch(value);
				},
				onKeyDown: (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						event.stopPropagation?.();
						if (event.shiftKey) engine.current?.previousMatch();
						else engine.current?.nextMatch();
					} else if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation?.();
						engine.current?.closeSearch();
					}
				},
			}),
			h("span", { className: "ce-term-find-count" }, searchInfo.count === 0 ? t("terminal.searchNone") : `${searchInfo.index}/${searchInfo.count}`),
			h("button", { type: "button", className: "ce-term-find-btn", "aria-label": t("terminal.searchPrevious"), onClick: () => engine.current?.previousMatch() }, "↑"),
			h("button", { type: "button", className: "ce-term-find-btn", "aria-label": t("terminal.searchNext"), onClick: () => engine.current?.nextMatch() }, "↓"),
			h("button", { type: "button", className: "ce-term-find-btn", "aria-label": t("terminal.searchClose"), onClick: () => engine.current?.closeSearch() }, "✕"),
		)
		: null;

	const copyBar = copyInfo
		? h("div", { className: "ce-term-copybar", role: "status" },
			h("span", { className: "ce-term-copy-mode" }, copyInfo.selecting ? t("terminal.copyVisual") : t("terminal.copyMode")),
			h("span", { className: "ce-term-copy-hint" }, t("terminal.copyHint")),
		)
		: null;
	const noticeBar = notice === "" ? null : h("div", { className: "ce-term-notice", role: "status" }, notice);

	// The host element is filled imperatively by the engine, so it must stay
	// childless from React's point of view: status lines and search are siblings.
	return h(
		"div",
		{ className: "ce-term-shell" },
		h("div", { className: "ce-term", ref: hostRef, "data-ce-terminal": "" }),
		searchBar,
		copyBar,
		noticeBar,
		h("pre", { className: "ce-term-a11y", "aria-label": t("terminal.screenReader") }, a11yText),
		state?.info === undefined && !failed
			? h("div", { className: "ce-term-status", role: "status" }, t("terminal.connecting"))
			: null,
		failed
			? h("div", { className: "ce-term-status ce-term-status-error", role: "alert" }, state?.error ?? t("terminal.failed"))
			: null,
		(disconnected || state?.phase === "failed") && typeof model.connect === "function"
			? h("button", { type: "button", className: "ce-term-reconnect", onClick: () => model.connect() }, t("terminal.reconnect"))
			: null,
	);
}
