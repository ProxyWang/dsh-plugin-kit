/* ---------------- Code tab: stateful orchestrator (toolbar, rail, editor, diff, status) ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { ROW, TAB_KIND } from "./constants.js";
import { useToolCloseGuard } from "./closeguard.js";
import { api } from "./api.js";
import { buildLineStates, langFor, wordAt } from "./highlight.js";
import { IconArrowLeft, IconArrowRight, IconCode, IconRefresh, IconSearch, IconTerminal, IconTextSearch } from "./icons.js";
import { inertTerminalEntry } from "./terminal.js";
import { DiffView, changedNewLines, deletedGroups, changeBlobs } from "./diff.js";
import { MarkdownView } from "./markdown.js";
import { BranchPalette } from "./branchpick.js";
import { RelPath, toAbs } from "./pathtools.js";
import { TreePanel } from "./tree.js";
import { ChangesPanel } from "./changes.js";
import { LocationList, QuickOpen, CommandPalette, RefsPeek, SymbolPalette, WorkspaceSymbolPalette, CompareRefsPalette, TaskPalette, TaskOutputPanel, GotoLinePalette, FileHistoryOverlay, ProblemsPanel } from "./overlays.js";
import { foldTaskOutput } from "./tasks.js";
import { SearchPanel } from "./searchpanel.js";
import { applyReplace, computeGutter, computeVisible, computeWrapRows, compileFindRe, findRangesInLine, WRAP_LINE_CAP } from "./codeview.js";
import { closeOtherTabs, closeTabsToRight, excludePinned, pinTab, popClosedTab, pushClosedTab, removedPaths } from "./tabs.js";
import { useGitActions } from "./usegit.js";
import { useNavPersistence } from "./usepersistence.js";
import { fileDragProps, hasFileDrag, readFileDrag, dragFilePath, reorderFileTabs } from "./filedrag.js";
import { createWatchLoop, docAction, parentDirs } from "./watch.js";
import { draftDiskDiff } from "./draftdiff.js";
import { buildEditGutter, handleTabIndent, findInText, replaceInText } from "./editmode.js";
import { useDismissLayer } from "./dismiss.js";

/** Files that open in rendered preview by default: markdown, html and svg. */
const PREVIEW_RE = /\.(md|markdown|html?|svg)$/i;
const MD_RE = /\.(md|markdown)$/i;
const SVG_RE = /\.svg$/i;
/** File types with a host-side language server (Go, TS/JS, Python). */
const LSP_RE = /\.(go|ts|tsx|js|jsx|mjs|cjs|py|pyi)$/i;

/** Append a path to the open-tab list: dedup, oldest dropped past the cap. Exported for tests. */
export function addTabPath(list, path, cap = 15) {
	const prev = Array.isArray(list) ? list : [];
	if (typeof path !== "string" || path === "" || prev.includes(path)) return prev;
	const next = [...prev, path];
	while (next.length > cap) next.shift();
	return next;
}

export function CodeBody(props) {
	const { useTabInfo, sessionId, useSessions, t, terminal, openBuiltinTerminal, builtinTerminal } = props;
	// Two terminals, both optional: the plugin's own rendered tab when the
	// terminal service is present, and the system terminal that the Host
	// launches in the session directory. Each hides when its capability is
	// absent instead of failing at click time.
	const terminalEntry = terminal ?? inertTerminalEntry;
	const builtinAvailable = () => Boolean(builtinTerminal?.()) && typeof openBuiltinTerminal === "function";
	const tabInfo = useTabInfo ? useTabInfo() : null;
	const tab = tabInfo?.tab;
	const cwd = useSessions ? useSessions((sessions) => (sessionId ? sessions.byId[sessionId]?.cwd : undefined)) : undefined;

	const [mode, setMode] = useState("files");
	const [doc, setDoc] = useState(null); // {path, lines, states, truncated, error}
	const [diff, setDiff] = useState(null); // {path, scope, text, ...}
	const [git, setGit] = useState(null);
	const [cursor, setCursor] = useState(null); // {line, col, word}
	const [diagnostics, setDiagnostics] = useState([]);
	const [workspaceDiag, setWorkspaceDiag] = useState(null); // [{path, items}] from lsp.workspaceDiagnostics
	const [overlay, setOverlay] = useState(null);
	const [hover, setHover] = useState(null);
	const [status, setStatus] = useState({ state: "off", message: "", progress: "" });
	const [notice, setNotice] = useState({ text: "", kind: "info" });
	const [treeKey, setTreeKey] = useState(0);
	const [stale, setStale] = useState({ tick: 0, dirs: [] }); // live-refresh tree invalidation
	const [externalConflict, setExternalConflict] = useState(null); // {path} while a draft is open
	const [conflictDiff, setConflictDiff] = useState(null); // {path,text,add,del,busy,error} draft-vs-disk view
	const [overwriteArm, setOverwriteArm] = useState(false); // two-step "save over disk" confirmation
	const [liveOn, setLiveOn] = useState(() => {
		try { return localStorage.getItem("dsh.plugin-kit.live") !== "off"; } catch { return true; }
	});
	const [flash, setFlash] = useState(null); // {line, col, word}
	const [scroll, setScroll] = useState(0);
	const [viewport, setViewport] = useState(600);
	const [palette, setPalette] = useState(null); // {query, results, busy}
	const [search, setSearch] = useState(null); // {query, include, results, engine, truncated, busy, error}
	const [searchOpen, setSearchOpen] = useState(false);
	const [peek, setPeek] = useState(null);
	const [editing, setEditing] = useState(false);
	const [editText, setEditText] = useState("");
	const [findOpen, setFindOpen] = useState(false);
	const [findQuery, setFindQuery] = useState("");
	const [findIdx, setFindIdx] = useState(0);
	const [findOpts, setFindOpts] = useState({ regex: false, caseSensitive: false, words: false });
	const [replaceOpen, setReplaceOpen] = useState(false);
	const [replaceText, setReplaceText] = useState("");
	const [preserveCase, setPreserveCase] = useState(false);
	const [editFindOpen, setEditFindOpen] = useState(false); // find/replace inside the edit textarea
	const [editFindQuery, setEditFindQuery] = useState("");
	const [editFindIdx, setEditFindIdx] = useState(0);
	const [editReplaceText, setEditReplaceText] = useState("");
	const [editFindOpts, setEditFindOpts] = useState({ regex: false, caseSensitive: false, words: false });
	const editFindMatches = useMemo(() => editing ? findInText(editText, editFindQuery, editFindOpts) : [], [editing, editText, editFindQuery, editFindOpts]);
	const editGutter = useMemo(() => editing ? buildEditGutter(editText.split("\n").length) : null, [editing, editText]);
	const editTaRef = useRef(null);
	const [diffMarks, setDiffMarks] = useState(null);
	const [branchPickOpen, setBranchPickOpen] = useState(false);
	const [blameOn, setBlameOn] = useState(false);
	const [blame, setBlame] = useState(null);
	const [wrapOn, setWrapOn] = useState(false);
	const [gotoOpen, setGotoOpen] = useState(false);
	const [fileHist, setFileHist] = useState(null); // {path, commits?, busy?, error?}
	const [tabs, setTabs] = useState([]); // open editor tabs, left-to-right
	const [previewOn, setPreviewOn] = useState(false);
	const [delGroups, setDelGroups] = useState(null);
	const [delPreview, setDelPreview] = useState(null);
	const delPreviewRef = useDismissLayer({ open: Boolean(delPreview), onDismiss: () => setDelPreview(null) });
	const [showDiffView, setShowDiffView] = useState(true); // {symbol, anchorLine, busy, def, refs, error}
	const [railW, setRailW] = useState(230);
	const [railVisible, setRailVisible] = useState(true);
	const [mobileView, setMobileView] = useState("files");
	const [symbols, setSymbols] = useState([]);
	const [symPalette, setSymPalette] = useState(null); // {query}
	const [wsym, setWsym] = useState(null); // workspace-symbol palette state {query, results, busy, error, seq}
	const [formatOnSave, setFormatOnSave] = useState(() => {
		try { return localStorage.getItem("dsh.plugin-kit.format") !== "off"; } catch { return true; }
	});
	const [commandOpen, setCommandOpen] = useState(false);
	const [fileDropOver, setFileDropOver] = useState(false);
	const [tabDropOver, setTabDropOver] = useState(null);
	const [commitsOpen, setCommitsOpen] = useState(false);
	const [compare, setCompare] = useState(null); // {base,head,files,shortstat,error}
	const [compareOpen, setCompareOpen] = useState(false);
	const [compareBranches, setCompareBranches] = useState([]);
	const [compareBusy, setCompareBusy] = useState(false);
	const [tasks, setTasks] = useState(null); // palette state {scripts, running, busy, error}
	const [task, setTask] = useState(null); // output state {id, script, chunks, seq, lineCount, done, code, dropped}
	const [seqBusy, setSeqBusy] = useState(false);
	const [tabMenu, setTabMenu] = useState(null); // {path, x, y} — editor-tab context menu
	const [pinned, setPinned] = useState([]); // sticky tabs: bulk closes skip them (VS Code)
	const [problemsOpen, setProblemsOpen] = useState(false);
	const tabMenuRef = useDismissLayer({ open: Boolean(tabMenu), onDismiss: () => setTabMenu(null) });
	const peekNonce = useRef(0);
	const paletteTimer = useRef(null);
	const searchTimer = useRef(null);
	const searchNonce = useRef(0);
	const symbolNonce = useRef(0);
	const hoverTimer = useRef(null);
	const hoverNonce = useRef(0);
	const hoverAtRef = useRef(null); // {line,col,word} of the token under the pointer

	const codeRef = useRef(null);
	const mainRef = useRef(null);
	const histRef = useRef({ back: [], forward: [] });
	const [histTick, setHistTick] = useState(0);
	const docRef = useRef(null);
	const cursorRef = useRef(null);
	const modeRef = useRef("code"); // code | diff
	const openSeqRef = useRef(0);
	const noticeTimer = useRef(null);
	const peekRef = useRef(null);
	const wrapOnRef = useRef(false);
	const tabViewRef = useRef({}); // path → {line, col, scroll} restored when switching tabs
	const autoMarksTimer = useRef(null);
	const tabsRef = useRef(null);
	const closedTabsRef = useRef([]); // most-recently-closed editor stack for ⌘⇧T (VS Code "Reopen Closed Editor")
	const dirtyRef = useRef(false);
	dirtyRef.current = editing && editText !== (doc?.raw ?? "");

	docRef.current = doc;
	cursorRef.current = cursor;
	const diffRef = useRef(null);
	diffRef.current = diff;
	peekRef.current = peek;
	wrapOnRef.current = wrapOn;

	const say = useCallback((text, kind = "info") => {
		setNotice({ text, kind });
		if (noticeTimer.current) clearTimeout(noticeTimer.current);
		if (kind !== "error") noticeTimer.current = setTimeout(() => setNotice({ text: "", kind: "info" }), 3800);
	}, []);

	useToolCloseGuard({ sessionId, kind: TAB_KIND, dirty: dirtyRef.current, onBlocked: () => say(t("editor.dirtyGuard"), "error") });

	// Center `line` in the code area. Word-wrap mode has variable row heights,
	// so it locates the flow node by its data-wl marker instead of ROW math;
	// rect-delta scrolling avoids scrollIntoView moving outer containers.
	const scrollAreaToLine = useCallback((line) => {
		const area = codeRef.current;
		if (!area) return;
		if (wrapOnRef.current) {
			const node = area.querySelector(`[data-wl="${line}"]`);
			if (node) {
				const nr = node.getBoundingClientRect();
				const ar = area.getBoundingClientRect();
				area.scrollTop += nr.top - ar.top - (area.clientHeight - nr.height) / 2;
			}
			setScroll(area.scrollTop);
			return;
		}
		area.scrollTop = Math.max(0, (line - 1) * ROW - area.clientHeight / 2);
		setScroll(area.scrollTop);
	}, []);

	// Word wrap renders the whole document in flow, so it stays off for very
	// large files (the toggle says why).
	const toggleWrap = useCallback(() => {
		const d = docRef.current;
		if (!wrapOnRef.current && d && d.lines.length > WRAP_LINE_CAP) {
			say(t("editor.wrapTooBig", { n: WRAP_LINE_CAP }), "error");
			return;
		}
		setWrapOn((v) => !v);
	}, [say, t]);

	const persistKey = sessionId && cwd ? `dsh.plugin-kit.v1.${sessionId}` : null;

	/* P0-5: while gopls starts or indexes, poll its progress for the status surfaces */
	useEffect(() => {
		if (!cwd || (status.state !== "starting" && !status.progress)) return undefined;
		const timer = setInterval(() => {
			api("lsp.status", { cwd }).then((r) => r.ok && setStatus(r.value));
		}, 2500);
		return () => clearInterval(timer);
	}, [cwd, status.state, status.progress]);

	const refreshGit = useCallback(() => {
		if (!cwd) return;
		const repo = repoSelRef.current;				api("git.status", repo ? { cwd, repo } : { cwd }).then((res) => {
			if (!res.ok) {
				setGit({ error: res.error });
				return;
			}
			const v = res.value;
			if (v && v.repo === false && Array.isArray(v.repos)) {
				setRepos(v.repos);
				if (v.repos.length && !repo) {
					const abs = docRef.current ? toAbs(cwd, docRef.current.path) : "";
					const pick = v.repos.find((r) => abs && (abs === r.root || abs.startsWith(`${r.root}/`))) ?? v.repos[0];
					repoSelRef.current = pick.root;
					setRepoSel(pick.root);
				}
				if (!v.repos.length && !repo) setGit({ repo: false, repos: [] });
				return;
			}
			setGit(v);
		});
	}, [cwd]);

	const [repos, setRepos] = useState(null); // [{root, branch, dirtyCount}]
	const [repoSel, setRepoSel] = useState(null); // absolute root when the cwd is not a repo
	const repoSelRef = useRef(null);

	const fetchDiagnostics = useCallback((path, seq) => {
		if (!cwd || !LSP_RE.test(path)) return;
		const pull = () => {
			if (openSeqRef.current !== seq) return;
			api("lsp.diagnostics", { cwd, path }).then((res) => {
				if (res.ok && openSeqRef.current === seq) setDiagnostics(res.value.items ?? []);
			});
		};
		pull();
		setTimeout(pull, 1800);
		setTimeout(pull, 4500);
	}, [cwd]);

	// Navigation owns the editor surface: dismiss transient panels, retaining
	// search inputs so reopening search does not discard the user's query.
	const dismissPanels = useCallback(() => {
		setSearchOpen(false);
		setPalette(null);
		if (paletteTimer.current) clearTimeout(paletteTimer.current);
		setCommandOpen(false);
		setBranchPickOpen(false);
		setOverlay(null);
		setPeek(null);
		++peekNonce.current;
		setHover(null);
		setFileHist(null);
		setGotoOpen(false);
		setSymPalette(null);
		setWsym(null);
		setDelPreview(null);
		setTabMenu(null);
		setProblemsOpen(false);
		setCompareOpen(false);
	}, []);
	useEffect(() => {
		if (tab?.visible === false) dismissPanels();
	}, [tab?.visible, dismissPanels]);
	const canNavigate = useCallback(() => {
		if (!dirtyRef.current) return true;
		say(t("editor.dirtyGuard"), "error");
		return false;
	}, [say, t]);

	// A path that left the disk (Explorer delete, Changes untracked delete) must
	// not linger as a tab or an open buffer: saving it would only fail.
	const forgetPath = useCallback((path) => {
		const clean = String(path ?? "");
		if (clean === "") return;
		setTabs((prev) => prev.filter((p) => p !== clean && !p.startsWith(`${clean}/`)));
		const open = docRef.current?.path;
		if (open && (open === clean || open.startsWith(`${clean}/`))) {
			setDoc(null);
			setEditing(false);
			setDiffMarks(null);
			setDelGroups(null);
		}
	}, []);

	const loadFile = useCallback(
		async (path, line, col, mark, opts) => {
			if (!cwd || (!opts?.background && !canNavigate())) return null;
			if (!opts?.background) dismissPanels();
			const res = await api("fs.read", { cwd, path });
			if (!res.ok) {
				// Watch-triggered check: deleted/unreadable keeps the buffer.
				if (opts?.checkExternal) say(t("watch.fileGone"), "error");
				else say(`${t("error")}: ${res.error}`, "error");
				return null;
			}
			if (opts?.checkExternal && !opts.force) {
				const cur = docRef.current;
				if (cur && cur.path === path && !cur.image) {
					if (res.value.kind === "text" && res.value.mtimeMs === cur.mtimeMs) return null; // touched, not changed
					if (dirtyRef.current) {
						setExternalConflict({ path });
						return null; // never auto-discard a draft
					}
				}
			}
			if (res.value.kind === "image") {
				// Raster image: no text lines, rendered as <img> from base64.
				// Bumping openSeq invalidates any in-flight diagnostics pulls.
				openSeqRef.current++;
				peekNonce.current++;
				const entry = {
					path,
					lines: [],
					states: new Uint8Array(0),
					raw: "",
					truncated: false,
					image: {
						mime: res.value.mime ?? "application/octet-stream",
						base64: res.value.base64 ?? "",
						size: res.value.size ?? 0,
						truncated: res.value.truncated === true,
					},
				};
				setPeek(null);
				setEditing(false);
				setDiffMarks(null);
				setDelGroups(null);
				setDelPreview(null);
				setFileHist(null);
				setGotoOpen(false);
				setSymPalette(null);
				setPreviewOn(true);
				setDoc(entry);
				if (!opts?.background) setMobileView("editor");
				setExternalConflict(null);
				modeRef.current = "code";
				setDiff(null);
				setCursor(null);
				setDiagnostics([]);
				setOverlay(null);
				setHover(null);
				setSymbols([]);
				symbolNonce.current++;
				setScroll(0);
				if (codeRef.current) codeRef.current.scrollTop = 0;
				return entry;
			}
			if (res.value.kind !== "text") {
				say(t("binary"), "error");
				return null;
			}
			const text = res.value.content;
			const lines = text.split("\n");
			if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
			const entry = { path, lines, states: buildLineStates(lines, langFor(path)), truncated: res.value.truncated, raw: text, mtimeMs: res.value.mtimeMs };
			const seq = ++openSeqRef.current;
			peekNonce.current++;
			setPeek(null);
			setEditing(false);
			setDiffMarks(null);
			setDelGroups(null);
			setDelPreview(null);
			setFileHist(null);
			setGotoOpen(false);
			setSymPalette(null);
			setPreviewOn(PREVIEW_RE.test(path));
			const keepScroll = opts?.background ? codeRef.current?.scrollTop ?? 0 : 0;
			setDoc(entry);
			if (!opts?.background) setMobileView("editor");
			setExternalConflict(null);
			modeRef.current = "code";
			setDiff(null);
			const clampLine = Math.min(Math.max(1, line), Math.max(1, lines.length));
			setCursor({ line: clampLine, col, word: wordAt(lines[clampLine - 1] ?? "", col)?.word ?? "" });
			setDiagnostics([]);
			setOverlay(null);
			setHover(null);
			setSymbols([]);
			setScroll(opts?.background ? keepScroll : 0);
			if (codeRef.current) codeRef.current.scrollTop = opts?.background ? keepScroll : 0;
			if (LSP_RE.test(path)) {
				fetchDiagnostics(path, seq);
				api("lsp.request", { cwd, path, kind: "hover", line: 1, col: 1 })
					.then((warm) => {
						if (warm.ok && warm.value.status) setStatus((s) => ({ ...s, ...warm.value.status }));
					})
					.catch(() => {});
				const snonce = ++symbolNonce.current;
				api("lsp.request", { cwd, path, kind: "symbol" }).then((r) => {
					if (openSeqRef.current === seq && symbolNonce.current === snonce && r.ok) setSymbols(r.value.symbols ?? []);
				});
			} else {
				symbolNonce.current++;
			}
			// VSCode parity: opening a file with uncommitted working-tree changes
			// shows gutter marks right away, without going through the Changes
			// list. Untracked files are skipped (whole-file green is noise).
			// Debounced so rapid tab switching doesn't spawn git processes for
			// files that are only passed through.
			if (!opts?.noAutoMarks && !opts?.background) {
				const markSeq = seq;
				if (autoMarksTimer.current) clearTimeout(autoMarksTimer.current);
				autoMarksTimer.current = setTimeout(() => {
					autoMarksTimer.current = null;
					if (openSeqRef.current !== markSeq) return;
					const repo = repoSelRef.current;
					api("git.diff", repo ? { cwd, path, scope: "working", repo } : { cwd, path, scope: "working" })
						.then((gres) => {
							if (openSeqRef.current !== markSeq || modeRef.current !== "code") return;
							const gval = gres.ok ? gres.value ?? {} : {};
							if (gval.error || gval.untracked || !gval.diff) return;
							const marks = changedNewLines(gval.diff);
							const dels = deletedGroups(gval.diff);
							if (marks.size === 0 && dels.size === 0) return;
							setDiffMarks((cur) => (cur === null ? marks : cur));
							setDelGroups((cur) => (cur === null ? dels : cur));
						})
						.catch(() => {});
				}, 220);
			}
			// reveal after layout; mark drives the exact-token highlight.
			// Background reloads keep the reader exactly where they were.
			const markLine = mark?.line ?? clampLine;
			if (!opts?.background) requestAnimationFrame(() => {
				scrollAreaToLine(Math.max(1, markLine));
				setFlash({ line: markLine, col: mark?.col, word: mark?.word });
				setTimeout(() => setFlash((f) => (f && f.line === markLine ? null : f)), 1800);
			});
			return entry;
		},
		[cwd, fetchDiagnostics, say, t, scrollAreaToLine, canNavigate, dismissPanels],
	);

	const openFile = useCallback(
		async (path, line, col, record = true, mark) => {
			if (!canNavigate()) return;
			const current = docRef.current;
			if (record && current && modeRef.current === "code") {
				const cur = cursorRef.current;
				histRef.current.back.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
				if (histRef.current.back.length > 80) histRef.current.back.shift();
				histRef.current.forward = [];
				setHistTick((v) => v + 1);
			}
			await loadFile(path, line, col, mark);
		},
		[loadFile, canNavigate],
	);


	// All mutating git operations (fetch/pull/push, discard, stage/commit)
	// live in the useGitActions hook; results fold back through setGit/say.
	const { sync, committing, doFetch, doPull, doPush, discardChange, discardMany, deleteUntracked, deleteUntrackedMany, stageChange, unstageChange, commitChanges } = useGitActions({
		cwd, t, say, git, setGit, repoSelRef, refreshGit, loadFile, docRef, cursorRef, modeRef,
	});

	/**
	 * Generate a commit message from the staged diff using the current session's
	 * LLM. The agent reads the staged changes and returns a concise conventional
	 * commit message. Falls back to an empty string on failure so the user can
	 * still type manually.
	 */
	const generateCommitMessage = useCallback(async () => {
		if (!cwd) return "";
		const repo = repoSelRef.current;
		const diffRes = await api("git.diff", repo ? { cwd, path: "", scope: "staged", repo } : { cwd, path: "", scope: "staged" });
		const diffText = diffRes.ok ? (diffRes.value?.diff ?? "") : "";
		if (!diffText.trim()) return "";
		// Ask the host to run the agent with a focused prompt. We use the
		// existing api.send route as a lightweight proxy: the client dispatches
		// a CustomEvent that the chat layer can intercept. For now, return a
		// heuristic summary so the button is functional without deep agent
		// integration; a full agent.inject path lands in phase 2.1.
		const lines = diffText.split("\n");
		const adds = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
		const dels = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
		const files = [...new Set(lines.filter((l) => l.startsWith("diff --git")).map((l) => l.split(" b/")[1]?.trim()).filter(Boolean))];
		const summary = files.length <= 3 ? files.join(", ") : `${files.length} files`;
		return `chore: update ${summary} (+${adds} -${dels})`;
	}, [cwd]);

	// A repo selection re-fetches that repo's full status.
	useEffect(() => {
		repoSelRef.current = repoSel;
		if (repoSel) refreshGit();
	}, [repoSel, refreshGit]);

	// Opening a file inside a discovered repo switches the Changes view to it.
	useEffect(() => {
		if (!doc || !repos || repos.length === 0 || !cwd) return;
		const abs = toAbs(cwd, doc.path);
		const match = repos.find((r) => abs === r.root || abs.startsWith(`${r.root}/`));
		if (match && match.root !== repoSelRef.current) {
			repoSelRef.current = match.root;
			setRepoSel(match.root);
		}
	}, [doc, repos, cwd]);

	const goBack = useCallback(() => {
		if (!canNavigate()) return;
		const stack = histRef.current;
		if (!stack.back.length) return;
		const current = docRef.current;
		if (current && modeRef.current === "code") {
			const cur = cursorRef.current;
			stack.forward.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
		}
		const prev = stack.back.pop();
		setHistTick((v) => v + 1);
		void openFile(prev.path, prev.line, prev.col, false, prev.word ? { line: prev.line, col: prev.col, word: prev.word } : null);
	}, [openFile, canNavigate]);

	const goForward = useCallback(() => {
		if (!canNavigate()) return;
		const stack = histRef.current;
		if (!stack.forward.length) return;
		const current = docRef.current;
		if (current && modeRef.current === "code") {
			const cur = cursorRef.current;
			stack.back.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
		}
		const next = stack.forward.pop();
		setHistTick((v) => v + 1);
		void openFile(next.path, next.line, next.col, false, next.word ? { line: next.line, col: next.col, word: next.word } : null);
	}, [openFile, canNavigate]);

	// Editor tabs: every loaded doc joins the strip (deduped, capped); the
	// per-path view state lets a tab switch restore cursor and scroll.
	useEffect(() => {
		const p = doc?.path;
		if (typeof p !== "string" || p === "") return;
		setTabs((prev) => addTabPath(prev, p));
	}, [doc]);
	useEffect(() => {
		const p = doc?.path;
		if (typeof p !== "string" || !cursor) return;
		tabViewRef.current[p] = { line: cursor.line, col: cursor.col, scroll };
	}, [doc, cursor, scroll]);

	const switchTab = useCallback((path) => {
		if (!path) return;
		if (path === docRef.current?.path) {
			dismissPanels();
			setMobileView("editor");
			// Clicking the active tab while its diff is shown returns to the source view.
			if (diff && showDiffView && (diff.scope === "working" || diff.scope === "branch" || diff.scope === "staged")) setShowDiffView(false);
			return;
		}
		if (editing && editText !== (docRef.current?.raw ?? "")) {
			say(t("editor.dirtyGuard"), "error");
			return;
		}
		const saved = tabViewRef.current[path];
		void openFile(path, saved?.line ?? 1, saved?.col ?? 1, false);
	}, [editing, editText, openFile, say, t, diff, showDiffView, dismissPanels]);

	/**
	 * Close a set of editor tabs (VS Code tab model: Close / Close Others /
	 * Close to the Right / Close All all funnel through here). Refuses when the
	 * dirty document would be closed; closed paths join the most-recently-
	 * closed stack so ⌘⇧T can bring them back with their view position.
	 * Bulk operations pass respectPins: sticky tabs survive them, exactly like
	 * VS Code's excludeSticky, while an explicit single Close still closes.
	 */
	const closeTabs = useCallback((paths, { respectPins = false } = {}) => {
		const candidates = respectPins ? excludePinned(paths, pinned) : paths;
		const remove = new Set((Array.isArray(candidates) ? candidates : []).filter((p) => typeof p === "string" && p !== ""));
		if (remove.size === 0) return;
		const current = docRef.current;
		if (editing && current && remove.has(current.path) && editText !== (current.raw ?? "")) {
			say(t("editor.dirtyGuard"), "error");
			return;
		}
		const firstIdx = tabs.findIndex((p) => remove.has(p));
		if (firstIdx < 0) return;
		let stack = closedTabsRef.current;
		for (const p of tabs) {
			if (!remove.has(p)) continue;
			const view = tabViewRef.current[p];
			stack = pushClosedTab(stack, { path: p, line: view?.line ?? 1, col: view?.col ?? 1 });
			delete tabViewRef.current[p];
		}
		closedTabsRef.current = stack;
		const next = tabs.filter((p) => !remove.has(p));
		setTabs(next);
		setPinned((prev) => prev.filter((p) => !remove.has(p)));
		setTabMenu(null);
		if (current && remove.has(current.path)) {
			// VS Code activates the nearest remaining neighbour tab.
			const neighbor = next[Math.min(firstIdx, next.length - 1)];
			if (neighbor) {
				const saved = tabViewRef.current[neighbor];
				void openFile(neighbor, saved?.line ?? 1, saved?.col ?? 1, false);
			} else {
				setDoc(null);
				setEditing(false);
				setDiffMarks(null);
				setDelGroups(null);
				setDelPreview(null);
			}
		}
	}, [tabs, pinned, editing, editText, openFile, say, t]);

	const closeTab = useCallback((path) => closeTabs([path]), [closeTabs]);

	/** Pin/unpin (VS Code sticky): pinned tabs move to the front of the strip. */
	const togglePin = useCallback((path) => {
		const has = pinned.includes(path);
		setPinned(has ? pinned.filter((p) => p !== path) : [...pinned, path]);
		if (!has) setTabs((current) => pinTab(current, path));
		setTabMenu(null);
	}, [pinned]);

	/** ⌘⇧T — reopen the most recently closed editor (VS Code parity). */
	const reopenClosedTab = useCallback(() => {
		if (!canNavigate()) return;
		const [entry, rest] = popClosedTab(closedTabsRef.current);
		if (!entry) {
			say(t("editor.noClosedTabs"));
			return;
		}
		closedTabsRef.current = rest;
		void openFile(entry.path, entry.line, entry.col, false);
	}, [canNavigate, openFile, say, t]);

	// Editor-tab context menu (VS Code): fixed-position menu near the click.
	const openTabMenu = useCallback((event, path) => {
		event.preventDefault();
		event.stopPropagation();
		setTabMenu({
			path,
			x: Math.max(8, Math.min(event.clientX, (window.innerWidth || 1000) - 218)),
			y: Math.max(8, Math.min(event.clientY, (window.innerHeight || 800) - 200)),
		});
	}, []);


	/* P0-1: per-session navigation state survives tab churn (usepersistence.js) */
	useNavPersistence({
		persistKey, cwd, doc, cursor, scroll, mode, railW, railVisible, wrapOn, findOpts, tabs, pinned, histTick,
		histRef, docRef, codeRef, loadFile,
		setRailW, setRailVisible, setWrapOn, setFindOpts, setTabs, setPinned, setMode, setHistTick, setScroll,
	});

	const revealPosition = useCallback((line, col, word) => {
		const current = docRef.current;
		if (!current) return;
		// A kept-mounted hidden tab must not steal keyboard focus from the
		// visible pane (e.g. a host terminal beside the workspace).
		if (tab?.visible === false) return;
		const cur = cursorRef.current;
		histRef.current.back.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
		if (histRef.current.back.length > 80) histRef.current.back.shift();
		histRef.current.forward = [];
		setHistTick((v) => v + 1);
		setCursor({ line, col, word: word ?? wordAt(current.lines[line - 1] ?? "", col)?.word ?? "" });
		setFlash({ line, col, word });
		setTimeout(() => setFlash((f) => (f && f.line === line ? null : f)), 1800);
		scrollAreaToLine(line);
		codeRef.current?.focus({ preventScroll: true });
	}, [scrollAreaToLine, tab?.visible]);

	const openDiff = useCallback(
		async (path, scope, repoOverride, refs) => {
			if (!cwd || !canNavigate()) return;
			if (scope !== "compare") dismissPanels();
			const repo = repoOverride ?? repoSelRef.current;
			const body = repo ? { cwd, path, scope, repo } : { cwd, path, scope };
			if (scope === "compare") {
				body.base = refs?.base ?? "";
				body.head = refs?.head ?? "HEAD";
			}
			const res = await api("git.diff", body);
			const value = res.ok ? res.value : { error: res.error };
			modeRef.current = "diff";
			setMobileView("editor");
			setShowDiffView(true);
			setDiff({ path, scope, text: value.diff ?? "", error: value.error, base: value.base, head: value.head, untracked: value.untracked, note: value.note });
			setOverlay(null);
			setHover(null);
		},
		[cwd, canNavigate, dismissPanels],
	);
	// Whole-file presentation: load the current file and mark the changed
	// new-side lines, keeping gopls jumps and edit mode available on top.
	const openChangeSource = useCallback(async (path, scope) => {
		if (!cwd || !canNavigate()) return;
		dismissPanels();
		const repo = repoSelRef.current;
		const res = await api("git.diff", repo ? { cwd, path, scope, repo } : { cwd, path, scope });
		const text = res.ok ? res.value.diff ?? "" : "";
		const marks = changedNewLines(text);
		let first = Number.POSITIVE_INFINITY;
		for (const n of marks) if (n < first) first = n;
		if (first === Number.POSITIVE_INFINITY) first = 1;
		setDiff({ path, scope, text, base: res.ok ? res.value.base : void 0, note: res.ok ? res.value.note : void 0 });
		setShowDiffView(false);
		modeRef.current = "code";
		const loaded = await loadFile(path, first, 1, null, { noAutoMarks: true });
		if (!loaded) return;
		setDiffMarks(marks);
		setDelGroups(deletedGroups(text));
	}, [cwd, loadFile, canNavigate, dismissPanels]);

	/* Live refresh: fold the host watch.poll batches into the open surfaces.
	 * Clean documents reload in place (cursor & scroll kept), a dirty draft
	 * NEVER auto-discards — it raises the external-change banner instead,
	 * consistent with the ⌘S mtime conflict guard. */
	const gitDebounce = useRef(null);
	const scheduleGitRefresh = useCallback(() => {
		if (gitDebounce.current !== null) return;
		gitDebounce.current = setTimeout(() => {
			gitDebounce.current = null;
			refreshGit();
		}, 350);
	}, [refreshGit]);
	useEffect(() => () => { if (gitDebounce.current !== null) clearTimeout(gitDebounce.current); }, []);

	const backgroundReload = useCallback(async (force) => {
		const d = docRef.current;
		if (!d || d.image) return;
		const cur = cursorRef.current;
		// One merged read inside loadFile: mtime equal → touch nothing; dirty
		// without force → the banner; otherwise swap in the disk file.
		await loadFile(d.path, cur?.line ?? 1, cur?.col ?? 1, null, { background: true, noAutoMarks: true, checkExternal: true, force });
	}, [loadFile]);

	const refreshOpenDiff = useCallback(async () => {
		const d = diffRef.current;
		if (!d || typeof d.path !== "string" || d.path === "" || (d.scope !== "working" && d.scope !== "index" && d.scope !== "compare")) return;
		const repo = repoSelRef.current;
		const body = repo ? { cwd, path: d.path, scope: d.scope, repo } : { cwd, path: d.path, scope: d.scope };
		if (d.scope === "compare") {
			body.base = d.base ?? "";
			body.head = d.head ?? "HEAD";
		}
		const res = await api("git.diff", body);
		const value = res.ok ? res.value ?? {} : {};
		setDiff((cur) => (cur && cur.path === d.path && cur.scope === d.scope
			? { ...cur, text: value.diff ?? "", error: value.error, untracked: value.untracked, note: value.note, base: value.base ?? cur.base, head: value.head ?? cur.head }
			: cur));
	}, [cwd]);

	const applyWatchBatch = useCallback((v, reset) => {
		const paths = reset ? [] : v.paths ?? [];
		if (reset || paths.length > 0) {
			if (!reset) setStale((cur) => ({ tick: cur.tick + 1, dirs: parentDirs(paths) }));
			const act = reset ? (docRef.current ? (dirtyRef.current ? "conflict" : "reload") : "ignore") : docAction(paths, docRef.current?.path ?? "", dirtyRef.current);
			if (act === "reload") void backgroundReload(false);
			else if (act === "conflict") setExternalConflict({ path: docRef.current.path });
			if (modeRef.current === "diff") void refreshOpenDiff();
		}
		if (reset || paths.length > 0 || v.git) scheduleGitRefresh();
	}, [backgroundReload, refreshOpenDiff, scheduleGitRefresh]);

	const unsupportedWarned = useRef(false);
	// Handlers travel through a ref so the poll loop keys off cwd/live/visibility
	// only: per-render callback identity churn must never restart the cycle.
	const watchHandlersRef = useRef(null);
	watchHandlersRef.current = { applyWatchBatch, say, t };
	useEffect(() => {
		if (!cwd || !liveOn || tab?.visible === false) return undefined;
		unsupportedWarned.current = false;
		const loop = createWatchLoop({
			poll: (body) => api("watch.poll", { cwd, ...body }),
			onChanges: (v) => watchHandlersRef.current?.applyWatchBatch(v, false),
			onReset: () => watchHandlersRef.current?.applyWatchBatch({ paths: [] }, true),
			onUnsupported: () => {
				if (unsupportedWarned.current) return;
				unsupportedWarned.current = true;
				say(t("watch.unsupported"), "error");
			},
		});
		return () => loop.stop();
	}, [cwd, liveOn, tab?.visible]);

	/* Workspace symbol palette: debounced host query. Every keystroke bumps
	 * the local seq so a slow in-flight answer is discarded on arrival. */
	useEffect(() => {
		if (!wsym || !cwd) return undefined;
		const q = wsym.query.trim();
		if (q === "") return undefined;
		const { seq } = wsym;
		const timer = setTimeout(() => {
			api("lsp.workspaceSymbol", { cwd, query: q, path: docRef.current?.path ?? "" }).then((r) => {
				if (r.ok && r.value.status) setStatus((s) => ({ ...s, ...r.value.status }));
				setWsym((cur) => (cur === null || cur.seq !== seq ? cur : {
					...cur,
					busy: false,
					results: r.ok ? r.value.symbols ?? [] : [],
					error: r.ok ? String(r.value.error ?? r.value.note ?? "") : String(r.error ?? ""),
				}));
			});
		}, 220);
		return () => clearTimeout(timer);
	}, [cwd, wsym?.query, wsym?.seq]);
	// Blame column data: refetched per open file while the toggle is on.
	useEffect(() => {
		if (!blameOn || !doc || !cwd) return void 0;
		let alive = true;
		const repo = repoSelRef.current;
		api("git.blame", repo ? { cwd, path: doc.path, repo } : { cwd, path: doc.path }).then((res) => {
			if (!alive) return;
			if (!res.ok || res.value?.error) {
				setBlame(null);
				return;
			}
			const byLine = new Map();
			for (const item of res.value.lines ?? []) byLine.set(item.line, item);
			setBlame(byLine);
		});
		return () => {
			alive = false;
		};
	}, [blameOn, doc, cwd]);

	const openCommit = useCallback(
		async (commit) => {
			if (!cwd || !canNavigate()) return;
			dismissPanels();
			const repo = repoSelRef.current;
			const res = await api("git.diff", repo ? { cwd, scope: "commit", sha: commit.hash, repo } : { cwd, scope: "commit", sha: commit.hash });
			const value = res.ok ? res.value : { error: res.error };
			if (value.error) {
				say(`${t("error")}: ${value.error}`, "error");
				return;
			}
			modeRef.current = "diff";
			setMobileView("editor");
			setDiff({ path: `${t("diff.scopeCommit")} ${commit.hash}`, scope: "commit", commit: value.commit, text: value.diff ?? "" });
			setShowDiffView(true);
			setOverlay(null);
			setHover(null);
			setPeek(null);
		},
		[cwd, say, t, canNavigate, dismissPanels],
	);

	/* M3: ref compare + cherry-pick + conflict resolution ------------------ */
	const doCompare = useCallback(
		async (base, head) => {
			if (!cwd) return;
			setCompareBusy(true);
			const repo = repoSelRef.current;
			const res = await api("git.compare", repo ? { cwd, base, head, repo } : { cwd, base, head });
			setCompareBusy(false);
			if (!res.ok) {
				say(`${t("error")}: ${res.error}`, "error");
				return;
			}
			if (res.value.error) {
				setCompare({ ...res.value, files: [] });
				say(`${t("error")}: ${res.value.error}`, "error");
				return;
			}
			setCompare(res.value);
			setCompareOpen(false);
			setMode("changes");
			setRailVisible(true);
		},
		[cwd, say, t],
	);
	const openCompare = useCallback(async () => {
		if (!cwd) return;
		dismissPanels();
		setCompareOpen(true);
		const repo = repoSelRef.current;
		const res = await api("git.branches", repo ? { cwd, repo } : { cwd });
		if (res.ok && Array.isArray(res.value.branches)) setCompareBranches(res.value.branches);
	}, [cwd, dismissPanels]);

	/* Task runner: list scripts, start a job, stream its long-polled output. */
	const taskSeq = useRef(0);
	const openTasks = useCallback(async () => {
		if (!cwd) return;
		dismissPanels();
		setTasks({ scripts: {}, running: {}, busy: true, error: "" });
		const res = await api("task.scripts", { cwd });
		setTasks((cur) => (cur === null ? cur : res.ok && !res.value.error
			? { scripts: res.value.scripts ?? {}, running: res.value.running ?? {}, busy: false, error: "" }
			: { scripts: {}, running: {}, busy: false, error: res.value?.error ?? res.error ?? t("error") }));
	}, [cwd, dismissPanels, t]);
	const startTask = useCallback(
		async (script) => {
			if (!cwd) return;
			const res = await api("task.start", { cwd, script });
			if (!res.ok || res.value.error) {
				say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
				return;
			}
			setTasks(null);
			taskSeq.current += 1;
			setTask({ id: res.value.id, script, chunks: [], seq: 0, baseSeq: 0, lineCount: 1, done: false, code: null, dropped: false, pollSeq: taskSeq.current });
		},
		[cwd, say, t],
	);
	const stopTask = useCallback(async () => {
		if (!task) return;
		const res = await api("task.kill", { id: task.id });
		if (!res.ok || res.value.error) say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
		else say(t("task.stopRequested"));
	}, [task, say, t]);

	// Long-poll loop for the active task. A fresh pollSeq restarts cleanly; a
	// superseded response (older seq) is dropped so stopping/starting cannot
	// write into the current job's output.
	useEffect(() => {
		if (!task || task.done || !cwd) return undefined;
		const active = task.pollSeq;
		let cancelled = false;
		const { id } = task;
		let cursor = task.seq;
		const pump = async () => {
			while (!cancelled && cursor >= 0) {
				const res = await api("task.poll", { id, since: cursor, waitMs: 18000 });
				if (cancelled || active !== taskSeq.current) { cursor = -1; break; }
				if (!res.ok || res.value.error) { cursor = -1; break; }
				const snap = res.value;
				cursor = snap.seq;
				if (snap.done) cursor = -1;
				// Fold inside the updater: two answers can land before a
				// repaint, and prev — not a render-time ref — is the truth.
				// Identity fields (script/pollSeq) survive the fold shape.
				setTask((prev) => (prev === null || prev.pollSeq !== active ? prev : { ...foldTaskOutput(prev, snap), id, script: prev.script, pollSeq: prev.pollSeq }));
			}
		};
		void pump();
		return () => { cancelled = true; };
	}, [cwd, task?.id, task?.done, task?.pollSeq]);
	const pickCommit = useCallback(
		async (commit) => {
			if (!cwd || dirtyRef.current) {
				say(t("editor.dirtyGuard"), "error");
				return;
			}
			setSeqBusy(true);
			const repo = repoSelRef.current;
			const res = await api("git.cherryPick", repo ? { cwd, sha: commit.hash, repo } : { cwd, sha: commit.hash });
			setSeqBusy(false);
			const value = res.ok ? res.value ?? {} : { error: res.error };
			if (value.status) setGit(value.status);
			if (value.error) say(value.conflicted ? `${value.error} — ${t("changes.pickConflicted")}` : `${t("error")}: ${value.error}`, "error");
			else say(t("changes.picked", { hash: commit.hash }));
			if (!value.conflicted) refreshGit();
		},
		[cwd, say, t, refreshGit],
	);
	const resolveConflict = useCallback(
		async (path, side) => {
			if (!cwd) return;
			setSeqBusy(true);
			const repo = repoSelRef.current;
			const res = await api("git.resolve", repo ? { cwd, path, side, repo } : { cwd, path, side });
			setSeqBusy(false);
			const value = res.ok ? res.value ?? {} : { error: res.error };
			if (value.status) setGit(value.status);
			if (value.error) say(`${t("error")}: ${value.error}`, "error");
			else say(t("changes.resolved", { path, side: t(side === "ours" ? "changes.ours" : "changes.theirs") }));
		},
		[cwd, say, t],
	);
	const sequencerAction = useCallback(
		async (action) => {
			if (!cwd) return;
			const kind = git?.inProgress ?? "cherry-pick";
			setSeqBusy(true);
			const repo = repoSelRef.current;
			const res = await api(action === "continue" ? "git.sequencerContinue" : "git.sequencerAbort", repo ? { cwd, kind, repo } : { cwd, kind });
			setSeqBusy(false);
			const value = res.ok ? res.value ?? {} : { error: res.error };
			if (value.status) setGit(value.status);
			if (value.error) say(`${t("error")}: ${value.error}`, "error");
			else say(action === "continue" ? t("changes.sequencerDone") : t("changes.sequencerAborted"));
			refreshGit();
		},
		[cwd, git, say, t, refreshGit],
	);

	// File history (🕘): commits that touched the open file, newest first.
	const openFileHistory = useCallback(() => {
		const d = docRef.current;
		if (!cwd || !d) return;
		dismissPanels();
		const path = d.path;
		setFileHist({ path, busy: true });
		const repo = repoSelRef.current;
		api("git.history", repo ? { cwd, path, repo } : { cwd, path }).then((res) => {
			setFileHist((cur) => {
				if (!cur || cur.path !== path) return cur;
				if (!res.ok) return { path, error: res.error };
				if (res.value?.error) return { path, error: res.value.error, scopeInfo: res.value.scope };
				return { path, commits: res.value?.commits ?? [] };
			});
		});
	}, [cwd, dismissPanels]);

	// Clicking a history row shows that commit's diff for this file only.
	const openHistCommit = useCallback(
		async (commit) => {
			const path = fileHist?.path;
			if (!cwd || !path || !commit?.hash || !canNavigate()) return;
			dismissPanels();
			const repo = repoSelRef.current;
			const res = await api("git.diff", repo ? { cwd, path, scope: "commit", sha: commit.hash, repo } : { cwd, path, scope: "commit", sha: commit.hash });
			const value = res.ok ? res.value ?? {} : { error: res.error };
			if (value.error) {
				say(`${t("error")}: ${value.error}`, "error");
				return;
			}
			setFileHist(null);
			modeRef.current = "diff";
			setMobileView("editor");
			setDiff({ path: `${commit.hash} · ${path}`, scope: "commit", commit: value.commit, text: value.diff ?? "" });
			setShowDiffView(true);
			setOverlay(null);
			setHover(null);
			setPeek(null);
		},
		[cwd, fileHist, say, t, canNavigate, dismissPanels],
	);

	/* quick open (file picker) */

	const openPalette = useCallback(() => {
		if (!cwd) return;
		dismissPanels();
		setMobileView("editor");
		setPalette({ query: "", results: [], busy: true });
		api("search.files", { cwd, query: "", limit: 80 }).then((res) => {
			setPalette((p) => (p && p.query === "" ? { ...p, results: res.ok ? res.value.matches ?? [] : [], busy: false } : p));
		});
	}, [cwd, dismissPanels]);

	const onPaletteQuery = useCallback(
		(query) => {
			setPalette((p) => (p ? { ...p, query, busy: true } : p));
			if (paletteTimer.current) clearTimeout(paletteTimer.current);
			paletteTimer.current = setTimeout(() => {
				if (!cwd) return;
				api("search.files", { cwd, query, limit: 80 }).then((res) => {
					setPalette((p) => (p && p.query === query ? { ...p, results: res.ok ? res.value.matches ?? [] : [], busy: false } : p));
				});
			}, 140);
		},
		[cwd],
	);

	const closePalette = useCallback(() => {
		if (paletteTimer.current) clearTimeout(paletteTimer.current);
		setPalette(null);
	}, []);

	const onPalettePick = useCallback(
		(path) => {
			closePalette();
			void openFile(path, 1, 1);
		},
		[closePalette, openFile],
	);

	/* full-text search */

	const runSearchNow = useCallback(
		(query, include, opts) => {
			if (!cwd) return;
			const nonce = ++searchNonce.current;
			setSearch((s) => (s ? { ...s, busy: true, error: undefined } : s));
			api("search.text", { cwd, query, include: include || "", regex: opts?.regex === true, words: opts?.words === true, scope: opts?.scope?.kind ?? "workspace", directory: opts?.scope?.directory, repo: opts?.scope?.repo }).then((res) => {
				if (searchNonce.current !== nonce) return;
				setSearch((s) => {
					if (!s) return s;
					if (!res.ok) return { ...s, results: [], busy: false, error: res.error };
					return { ...s, results: res.value.results ?? [], engine: res.value.engine ?? "", truncated: res.value.truncated === true, timedOut: res.value.timedOut === true, busy: false, error: res.value.error };
				});
			});
		},
		[cwd],
	);

	const openSearch = useCallback((requested) => {
		dismissPanels();
		const scope = requested?.kind === "directory"
			? { kind: "directory", directory: requested.directory }
			: mode === "changes" ? { kind: "changes", repo: repoSelRef.current ?? undefined } : { kind: "workspace" };
		++searchNonce.current;
		setMobileView("editor");
		setSearchOpen(true);
		setSearch((s) => ({ ...(s ?? { query: "", include: "", regex: false, words: false }), scope, results: undefined, engine: "", truncated: false, busy: false, error: undefined, scopeInfo: undefined }));
	}, [mode, dismissPanels]);
	const changeSearch = useCallback((patch) => {
		++searchNonce.current;
		setSearch((s) => s ? { ...s, ...patch, results: undefined, busy: false, error: undefined, scopeInfo: undefined } : s);
	}, []);

	// Only request inputs retrigger search. Busy/results changes must not start
	// another request, and scope changes invalidate in-flight results immediately.
	const searchQuery = search?.query ?? "";
	const searchInclude = search?.include ?? "";
	const searchRegex = search?.regex === true;
	const searchWords = search?.words === true;
	const searchScope = search?.scope;
	useEffect(() => {
		++searchNonce.current;
		if (!searchOpen || searchQuery.trim().length < 2) return undefined;
		const timer = setTimeout(() => runSearchNow(searchQuery, searchInclude, { regex: searchRegex, words: searchWords, scope: searchScope }), 400);
		return () => clearTimeout(timer);
	}, [searchOpen, searchQuery, searchInclude, searchRegex, searchWords, searchScope, runSearchNow]);

	const onSearchPick = useCallback(
		(r) => {
			void openFile(r.path, r.line, 1);
		},
		[openFile],
	);

	/* references peek (VSCode-style pop-up) */

	const openPeek = useCallback(
		async (symbol, line, col) => {
			if (!cwd || !LSP_RE.test(docRef.current?.path ?? "")) return;
			const path = docRef.current.path;
			const nonce = ++peekNonce.current;
			setPeek({ symbol, anchorLine: line, busy: true, def: [], refs: [] });
			const [dres, rres] = await Promise.all([
				api("lsp.request", { cwd, path, kind: "definition", line, col }),
				api("lsp.request", { cwd, path, kind: "references", line, col }),
			]);
			if (peekNonce.current !== nonce) return;
			if (dres.ok && dres.value.status) setStatus(dres.value.status);
			if (!dres.ok && !rres.ok) {
				setPeek({ symbol, anchorLine: line, busy: false, def: [], refs: [], error: dres.error ?? rres.error });
				return;
			}
			setPeek({
				symbol,
				anchorLine: line,
				busy: false,
				def: dres.ok ? dres.value.targets ?? [] : [],
				refs: rres.ok ? rres.value.targets ?? [] : [],
				error: !dres.ok ? dres.error : !rres.ok ? rres.error : undefined,
			});
		},
		[cwd],
	);

	const closePeek = useCallback(() => {
		peekNonce.current++;
		setPeek(null);
	}, []);

	const pickPeek = useCallback(
		(loc) => {
			const word = peekRef.current?.symbol;
			closePeek();
			void openFile(loc.path, loc.line, loc.col, true, word ? { line: loc.line, col: loc.col, word } : null);
		},
		[closePeek, openFile],
	);

	// Find-widget matcher: literal by default, with VSCode-style Aa / ab| / .*
	// toggles. compileFindRe returns false for an invalid regex (hint shown).
	const findRe = useMemo(() => compileFindRe(findQuery, findOpts), [findQuery, findOpts]);
	const findMatches = useMemo(() => {
		if (!doc || !findRe) return [];
		const out = [];
		for (let i = 0; i < doc.lines.length && out.length < 2000; i++) {
			for (const r of findRangesInLine(doc.lines[i], findRe)) {
				out.push({ line: i + 1, col: r.start + 1, text: r.text });
				if (out.length >= 2000) break;
			}
		}
		return out;
	}, [doc, findRe]);
	const findLines = useMemo(() => new Set(findMatches.map((m) => m.line)), [findMatches]);
	// VS Code keeps a solid highlight on the active find match while the
	// widget is open; the other matches stay in the lighter gutter color.
	const currentFind = findOpen && !editing && findRe && findMatches.length > 0 ? findMatches[Math.min(findIdx, findMatches.length - 1)] : null;
	const jumpFind = useCallback((delta) => {
		if (findMatches.length === 0) return;
		const next = (findIdx + delta + findMatches.length) % findMatches.length;
		setFindIdx(next);
		const m = findMatches[next];
		setCursor((c) => ({ line: m.line, col: m.col, word: c?.word ?? "" }));
		scrollAreaToLine(m.line);
		setFlash({ line: m.line, col: m.col, word: m.text ?? findQuery });
		setTimeout(() => setFlash((f) => (f && f.line === m.line ? null : f)), 1200);
	}, [findMatches, findIdx, findQuery, scrollAreaToLine]);
	// Find-widget replace (VS Code ⌘⌥F replace row). The result lands in the
	// edit buffer, so replacements are always reviewed and saved with ⌘S
	// under the existing mtime conflict guard — never written blindly.
	const doReplace = useCallback((all) => {
		const d = docRef.current;
		if (!d || !findQuery || findRe === false) return;
		const res = applyReplace(d.lines, findMatches, replaceText, {
			all,
			index: findIdx,
			regexRe: findRe && typeof findRe === "object" ? findRe : null,
			preserveCase,
		});
		if (!res) {
			say(t("replace.noMatch"), "error");
			return;
		}
		let text = res.lines.join("\n");
		if (String(d.raw ?? "").endsWith("\n")) text += "\n";
		setEditText(text);
		setEditing(true);
		say(t(all ? "replace.replacedAll" : "replace.replacedOne", { n: res.count }));
	}, [findQuery, findRe, findMatches, findIdx, replaceText, preserveCase, say, t]);
	const startEdit = useCallback(() => {
		if (!doc || doc.truncated || doc.image) return;
		if (doc.raw.length > 2 * 1024 * 1024 || doc.lines.length > 50000) {
			say(t("editor.tooBig"), "error");
			return;
		}
		setEditText(doc.raw);
		setEditing(true);
	}, [doc, say, t]);
	const saveEdit = useCallback((opts) => {
		if (!doc || !editing) return;
		const useFormat = formatOnSave && LSP_RE.test(doc.path);
		// baseMtime gives optimistic concurrency: the host refuses the write
		// when the file changed on disk since we loaded it. An explicit
		// overwrite (two-step confirmed in the conflict banner) drops the
		// guard — the user has seen both sides and chose the draft.
		const payload = { cwd, path: doc.path, content: editText };
		if (typeof doc.mtimeMs === "number" && opts?.overwrite !== true) payload.baseMtime = doc.mtimeMs;
		api(useFormat ? "fs.formatDraft" : "fs.write", payload).then((res) => {
			if (!res.ok) {
				if (/modified on disk/i.test(res.error ?? "")) {
					// Keep-editing is no longer a dead end: surface the conflict
					// banner with compare/overwrite paths instead of a toast loop.
					setExternalConflict({ path: doc.path });
					say(t("editor.conflict"), "error");
				} else say(`${t("error")}: ${res.error}`, "error");
				return;
			}
			// The formatter may have rewritten the draft; adopt the disk shape.
			const finalText = useFormat && typeof res.value.content === "string" ? res.value.content : editText;
			const lines = finalText.split("\n");
			if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
			setDoc({ ...doc, lines, states: buildLineStates(lines, langFor(doc.path)), raw: finalText, mtimeMs: res.value.mtimeMs ?? doc.mtimeMs });
			setEditing(false);
			setExternalConflict(null);
			setConflictDiff(null);
			setOverwriteArm(false);
			if (opts?.overwrite === true) say(t("editor.savedOverwrite"));
			else if (res.value.formatted) say(t("editor.savedFormatted"));
			else if (useFormat) say(t("editor.formatSkipped"), "error");
			else say(t("editor.saved"));
		});
	}, [doc, editing, editText, cwd, say, t, formatOnSave]);
	/** Fetch the disk side and open the draft-vs-disk diff (conflict banner). */
	const openConflictDiff = useCallback(async () => {
		const d = docRef.current;
		if (!d || !cwd) return;
		setConflictDiff({ path: d.path, text: "", add: 0, del: 0, busy: true, error: "" });
		const res = await api("fs.read", { cwd, path: d.path });
		if (!res.ok || res.value.kind !== "text") {
			setConflictDiff({ path: d.path, text: "", add: 0, del: 0, busy: false, error: res.ok ? t("binary") : String(res.error ?? "") });
			return;
		}
		const built = draftDiskDiff(res.value.content, editText, d.path);
		setConflictDiff({ path: d.path, ...built, busy: false, error: "" });
	}, [cwd, editText, t]);
	const cancelEdit = useCallback(() => { setEditing(false); setOverwriteArm(false); }, []);
	// Switch an open working/branch diff to the whole-file source view with
	// changed lines marked; the hunk view stays one toggle away.
	const openDiffSource = useCallback((line) => {
		if (!diff || typeof diff.path !== "string" || diff.path === "") return;
		if (diff.scope === "commit" || diff.scope === "call") return;
		const marks = changedNewLines(diff.text);
		let first = line;
		if (first == null) {
			first = Number.POSITIVE_INFINITY;
			for (const n of marks) if (n < first) first = n;
			if (first === Number.POSITIVE_INFINITY) first = 1;
		}
		modeRef.current = "code";
		setShowDiffView(false);
		const path = diff.path;
		// Always reload from the host (cheap via its mtime LRU) so the source
		// view never shows stale content after a hunk revert or external edit.
		const ready = loadFile(path, first, 1, null, { noAutoMarks: true });
		void ready.then(() => {
			setDiffMarks(marks);
			setDelGroups(deletedGroups(diff.text));
		});
	}, [diff, loadFile]);
	// Revert one hunk of the working diff (host re-derives the patch fresh and
	// runs git apply -R). The hunk view refreshes afterwards; the source view
	// always reloads, so no stale document can linger.
	const revertHunk = useCallback(async (hunkIndex, hunkHeader) => {
		if (!cwd || !diff || diff.scope !== "working" || typeof diff.path !== "string" || diff.path === "") return;
		const path = diff.path;
		const repo = repoSelRef.current;
		const body = { cwd, path, hunkIndex };
		if (typeof hunkHeader === "string" && hunkHeader !== "") body.hunkHeader = hunkHeader;
		if (repo) body.repo = repo;
		const res = await api("git.revertHunk", body);
		const value = res.ok ? res.value ?? {} : { error: res.error };
		if (!res.ok || value.error) {
			say(`${t("error")}: ${value.error ?? res.error}`, "error");
			return;
		}
		say(t("diff.hunkReverted"));
		if (value.status) setGit(value.status);
		await openDiff(path, "working");
	}, [cwd, diff, say, t, openDiff]);
	const toggleCommand = useCallback(() => {
		const next = !commandOpen;
		dismissPanels();
		setCommandOpen(next);
	}, [commandOpen, dismissPanels]);

	// Problems panel (VS Code ⇧⌘M): workspace-wide diagnostics when available,
	// falling back to the open file's list. Fetches the aggregate on toggle.
	const toggleProblems = useCallback(() => {
		const next = !problemsOpen;
		dismissPanels();
		setProblemsOpen(next);
		if (next && cwd) {
			api("lsp.workspaceDiagnostics", { cwd }).then((res) => {
				if (res.ok) setWorkspaceDiag(res.value.files ?? []);
			}).catch(() => {});
		}
	}, [problemsOpen, dismissPanels, cwd]);

	const onRootKeyDown = useCallback(
		(event) => {
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyF" && !event.shiftKey) {
				if (modeRef.current === "code" && docRef.current && !editing) {
					event.preventDefault();
					setFindOpen((v) => !v);
				}
				return;
			}
			// ⌘⌥F / Ctrl+Alt+F opens the find widget with its replace row (VS Code).
			if ((event.metaKey || event.ctrlKey) && event.altKey && !event.shiftKey && event.code === "KeyF") {
				if (modeRef.current === "code" && docRef.current && !editing) {
					event.preventDefault();
					setFindOpen(true);
					setReplaceOpen(true);
				}
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.code === "KeyS" && !event.shiftKey) {
				if (editing) {
					event.preventDefault();
					saveEdit();
				}
				return;
			}
			// Navigation: ⌘[ back, ⌘] forward (⌃- browser-zoom clash intentionally dropped).
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "BracketLeft") {
				event.preventDefault();
				goBack();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "BracketRight") {
				event.preventDefault();
				goForward();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyB" && !event.shiftKey) {
				event.preventDefault();
				setRailVisible((v) => !v);
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyO") {
				if (LSP_RE.test(docRef.current?.path ?? "")) {
					event.preventDefault();
					dismissPanels();
					setSymPalette({});
				}
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === "KeyP") {
				event.preventDefault();
				toggleCommand();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === "KeyM") {
				event.preventDefault();
				toggleProblems();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === "KeyT") {
				event.preventDefault();
				reopenClosedTab();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyP") {
				event.preventDefault();
				if (palette) closePalette();
				else openPalette();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyF") {
				event.preventDefault();
				openSearch();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === "KeyO") {
				// Workspace symbol search — the file-scoped outline keeps ⇧⌘O.
				event.preventDefault();
				dismissPanels();
				if (cwd) setWsym({ query: "", results: [], busy: false, error: "", seq: 0 });
				return;
			}
			if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.code === "KeyG") {
				if (modeRef.current === "code" && docRef.current && !editing) {
					event.preventDefault();
					const next = !gotoOpen;
					dismissPanels();
					setGotoOpen(next);
				}
				return;
			}
			if (event.altKey && !event.metaKey && !event.ctrlKey && event.code === "KeyZ") {
				if (modeRef.current === "code" && docRef.current && !editing) {
					event.preventDefault();
					toggleWrap();
				}
				return;
			}
			if (event.key === "Escape") {
				if (searchOpen || palette || commandOpen || branchPickOpen || fileHist || gotoOpen || symPalette || wsym || compareOpen || peek || overlay || problemsOpen || tabMenu) {
					event.preventDefault();
					event.stopPropagation();
					dismissPanels();
					return;
				}
				if (editing) {
					cancelEdit();
					return;
				}
				if (fileHist) {
					setFileHist(null);
					return;
				}
				if (gotoOpen) {
					setGotoOpen(false);
					return;
				}
				if (findOpen) {
					setFindOpen(false);
					return;
				}
				if (delPreview) {
					setDelPreview(null);
					return;
				}
				if (symPalette) {
					setSymPalette(null);
					return;
				}
				if (peek) {
					closePeek();
					return;
				}
				if (searchOpen) setSearchOpen(false);
			}
		},
		[palette, closePalette, openPalette, openSearch, searchOpen, peek, closePeek, goBack, goForward, symPalette, wsym, compareOpen, editing, saveEdit, cancelEdit, findOpen, delPreview, gotoOpen, toggleWrap, fileHist, toggleCommand, toggleProblems, reopenClosedTab, dismissPanels, commandOpen, branchPickOpen, overlay, problemsOpen, tabMenu],
	);

	const doJump = useCallback(
		async (kind, pos) => {
			if (!cwd || !docRef.current || !LSP_RE.test(docRef.current.path)) return;
			const cur = pos ?? cursorRef.current;
			if (!cur) {
				say(t("jump.noCursor"));
				return;
			}
			say(t("status.starting"));
			const res = await api("lsp.request", { cwd, path: docRef.current.path, kind, line: cur.line, col: cur.col });
			setNotice({ text: "", kind: "info" });
			if (!res.ok) {
				say(res.error, "error");
				setStatus({ state: "error", message: res.error, progress: "" });
				return;
			}
			if (res.value.status) setStatus(res.value.status);
			if (kind === "hover") {
				setHover({ x: cur.col, y: cur.line, text: res.value.hover || "" });
				return;
			}
			const targets = res.value.targets ?? [];
			if (!targets.length) {
				say(res.value.note ?? t("jump.noTarget"), res.value.note ? "info" : "error");
				return;
			}
			if (targets.length === 1 && kind !== "references") {
				const item = targets[0];
				void openFile(item.path, item.line, item.col, true, { line: item.line, col: item.col, word: cur.word });
				return;
			}
			const title = kind === "references" ? t("jump.refsTitle") : kind === "implementation" ? t("jump.implTitle") : kind === "typeDefinition" ? t("jump.typeTitle") : t("jump.peekTitle");
			setOverlay({ title, items: targets });
		},
		[cwd, openFile, say, t],
	);

	const onKeyDown = useCallback(
		(event) => {
			const mod = event.metaKey || event.ctrlKey;
			if (event.key === "F12") {
				event.preventDefault();
				if (event.shiftKey) {
					const cur = cursorRef.current;
					if (cur) void openPeek(cur.word || "", cur.line, cur.col);
					else say(t("jump.noCursor"));
				} else {
					void doJump("definition");
				}
				return;
			}
			if (event.altKey && event.key === "ArrowLeft") {
				event.preventDefault();
				goBack();
				return;
			}
			if (event.altKey && event.key === "ArrowRight") {
				event.preventDefault();
				goForward();
				return;
			}
			if (event.key === "Escape") {
				if (overlay) setOverlay(null);
				else if (hover) setHover(null);
				return;
			}
			if ((event.key === "i" || event.key === "I") && mod && event.altKey) {
				event.preventDefault();
				void doJump("implementation");
				return;
			}
		},
		[doJump, openPeek, say, t, goBack, goForward, hover, overlay],
	);

	/** Cancel any pending hover request and hide the tooltip. */
	const cancelHover = useCallback(() => {
		hoverNonce.current++;
		if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
		hoverAtRef.current = null;
		setHover(null);
	}, []);

	const onEditorClick = useCallback(
		(event) => {
			const target = event.target?.closest?.("[data-ce-l]");
			cancelHover();
			if (!target || !docRef.current) { closePeek(); return; }
			const line = Number(target.dataset.ceL);
			const col = Number(target.dataset.ceC);
			const text = docRef.current.lines[line - 1] ?? "";
			const hit = wordAt(text, col);
			const word = hit?.word ?? target.dataset.ceW ?? "";
			const at = { line, col: hit?.col ?? col };
			setCursor({ line: at.line, col: at.col, word });
			if (codeRef.current) codeRef.current.focus({ preventScroll: true });
			if (!LSP_RE.test(docRef.current.path) || !word) {
				// VSCode-style: clicking blank space dismisses the reference overlay.
				setPeek(null);
				return;
			}
			if (target.classList?.contains("ce-kw")) {
				setPeek(null);
				return;
			}
			const mod = event.metaKey || event.ctrlKey;
			// VS Code click model: plain click only places the cursor (selecting
			// text to copy must not pop a panel or fire LSP requests); ⌘/Ctrl+click
			// jumps to definition; the refs peek lives on ⇧F12 / hover / palette.
			if (mod) void doJump("definition", at);
			else setPeek(null);
		},
		[doJump, closePeek, cancelHover],
	);

	/**
	 * VS Code-style mouse hover: resting on an LSP-backed identifier for 350 ms
	 * asks the server for its hover document. Moving to another token restarts
	 * the delay; leaving the code area cancels. A nonce drops late answers so a
	 * slow response never paints over a newer position.
	 */
	const onEditorMouseMove = useCallback((event) => {
		const target = event.target?.closest?.("[data-ce-l]");
		const d = docRef.current;
		if (!target || !d || !LSP_RE.test(d.path) || editing || modeRef.current !== "code") {
			if (hoverAtRef.current) cancelHover();
			return;
		}
		if (target.classList?.contains("ce-kw")) { if (hoverAtRef.current) cancelHover(); return; }
		const line = Number(target.dataset.ceL);
		const col = Number(target.dataset.ceC);
		const word = target.dataset.ceW || wordAt(d.lines[line - 1] ?? "", col)?.word || "";
		if (!word) { if (hoverAtRef.current) cancelHover(); return; }
		const prev = hoverAtRef.current;
		if (prev && prev.line === line && prev.col === col) return; // same token: keep timer/tooltip
		hoverNonce.current++;
		if (hoverTimer.current) clearTimeout(hoverTimer.current);
		hoverAtRef.current = { line, col, word };
		setHover(null);
		const nonce = hoverNonce.current;
		const path = d.path;
		hoverTimer.current = setTimeout(() => {
			hoverTimer.current = null;
			api("lsp.request", { cwd, path, kind: "hover", line, col }).then((res) => {
				if (hoverNonce.current !== nonce) return;
				const text = res.ok ? String(res.value.hover ?? "") : "";
				if (text.trim()) setHover({ x: col, y: line, text });
			}).catch(() => {});
		}, 350);
	}, [cwd, editing, cancelHover]);

	// session / cwd lifecycle
	useEffect(() => {
		if (!cwd) {
			setGit(null);
			return;
		}
		refreshGit();
		api("lsp.status", { cwd }).then((res) => {
			if (res.ok) setStatus(res.value);
		});
	}, [cwd, refreshGit]);

	useEffect(() => {
		if (!tab?.actions?.bindCommands) return;
		return tab.actions.bindCommands({
			refresh: () => {
				refreshGit();
				setTreeKey((k) => k + 1);
				if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
			},
		});
	}, [tab, refreshGit, loadFile]);

	useEffect(() => () => {
		if (noticeTimer.current) clearTimeout(noticeTimer.current);
		if (autoMarksTimer.current) clearTimeout(autoMarksTimer.current);
		if (hoverTimer.current) clearTimeout(hoverTimer.current);
	}, []);

	// Keep the active tab visible in the (horizontally scrollable) strip.
	useEffect(() => {
		const raf = requestAnimationFrame(() => {
			tabsRef.current?.querySelector?.(".ce-tab-active")?.scrollIntoView({ inline: "nearest", block: "nearest" });
		});
		return () => cancelAnimationFrame(raf);
	}, [doc, tabs]);

	// autosize viewport
	useEffect(() => {
		const area = codeRef.current;
		if (!area) return;
		const observer = new ResizeObserver(() => setViewport(area.clientHeight || 600));
		observer.observe(area);
		setViewport(area.clientHeight || 600);
		return () => observer.disconnect();
	}, [doc, diff]);

	const diagByLine = useMemo(() => {
		const map = new Map();
		for (const item of diagnostics) {
			const row = map.get(item.line) ?? [];
			row.push(item);
			map.set(item.line, row);
		}
		return map;
	}, [diagnostics]);

	const delAnchors = useMemo(() => (delGroups === null ? [] : [...delGroups.keys()].sort((a, b) => a - b)), [delGroups]);
	const changeRailBlobs = useMemo(() => (doc ? changeBlobs(diffMarks, delGroups ? [...delGroups.keys()] : null) : []), [doc, diffMarks, delGroups]);
	const jumpToLine = useCallback((line) => {
		setCursor((c) => ({ line, col: 1, word: c?.word ?? "" }));
		scrollAreaToLine(line);
		setFlash({ line, col: 1, word: "" });
		setTimeout(() => setFlash((f) => (f && f.line === line ? null : f)), 1200);
	}, [scrollAreaToLine]);
	// Row building lives in codeview.js as pure functions; the memos only wire
	// state. Word-wrap mode swaps the virtual-scroll builders for the flow
	// builder and skips them entirely.
	const visible = useMemo(
		() => (wrapOn ? null : computeVisible({ doc, scroll, viewport, diagByLine, flash, current: currentFind, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit, onDelPreview: setDelPreview })),
		[wrapOn, doc, scroll, viewport, diagByLine, flash, currentFind, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit],
	);

	const gutter = useMemo(
		() => (wrapOn ? null : computeGutter({ doc, scroll, viewport, cursor, findLines, current: currentFind, diffMarks, delAnchors })),
		[wrapOn, doc, scroll, viewport, cursor, findLines, currentFind, diffMarks, delAnchors],
	);

	const wrapDoc = useMemo(
		() => (wrapOn ? computeWrapRows({ doc, flash, current: currentFind, diffMarks, delAnchors, delGroups, cursor, findLines, t, onDelPreview: setDelPreview }) : null),
		[wrapOn, doc, flash, currentFind, diffMarks, delAnchors, delGroups, cursor, findLines, t],
	);

	const statusTitle = (status.state === "error" ? `${t("status.error")}: ${status.message}` : status.state === "starting" ? t("status.starting") : status.state === "ready" ? t("status.ready") : t("status.off")) + (status.progress ? ` · ${status.progress}` : "");
	const previewActive = previewOn && doc !== null && PREVIEW_RE.test(doc.path);
	const docLang = doc !== null && !doc.image ? langFor(doc.path) : "text";
	const canBack = histRef.current.back.length > 0;
	const canForward = histRef.current.forward.length > 0;
	void histTick;

	// breadcrumb symbol: the innermost declared symbol at or above the cursor line
	const currentSymbol = useMemo(() => {
		if (!cursor || symbols.length === 0) return null;
		let best = null;
		for (const s of symbols) {
			if (s.line <= cursor.line && (best === null || s.line > best.line || (s.line === best.line && s.col <= best.col))) best = s;
		}
		return best;
	}, [symbols, cursor]);

	// The built-in entry opens the plugin's own terminal tab: DSH runs the shell,
	// the plugin paints the screen. A refused open (no session, or the kind went
	// away with its plugin) falls back to the system terminal.
	const openBuiltin = useCallback(() => {
		if (builtinAvailable() && openBuiltinTerminal()) { say(""); return true; }
		return false;
	}, [say, openBuiltinTerminal, builtinTerminal]);

	// The External Terminal entry launches the operating system's terminal in the
	// Session directory, so a full-screen TUI runs in a native window instead of
	// inside the Web UI's cell grid. Every failure mode has its own sentence:
	// no Session on screen, a runtime without a shared desktop, a double-click
	// inside the debounce window, or the Host naming the launchers it tried.
	const openTerminal = useCallback(async () => {
		const res = await terminalEntry.open(cwd);
		// Success is its own feedback: the OS window appears in front. Clearing
		// the banner matters because an earlier failure never expires on its own.
		if (res.ok) { say(""); return; }
		if (res.reason === "busy") return;
		const key = res.reason === "noSession" ? "terminal.fail.noSession" : res.reason === "unavailable" ? "terminal.fail.unavailable" : "terminal.fail.failed";
		say(res.error ? `${t(key)}: ${res.error}` : t(key), "error");
	}, [say, t, terminalEntry, cwd]);

	const commands = useMemo(() => [
		{ id: "files", icon: "▱", label: t("command.files"), run: () => { setMode("files"); dismissPanels(); setRailVisible(true); setMobileView("files"); } },
		{ id: "changes", icon: "⑂", label: t("command.changes"), run: () => { setMode("changes"); dismissPanels(); setRailVisible(true); setMobileView("files"); refreshGit(); } },
		{ id: "search", icon: "⌕", label: t("command.search"), hint: "⇧⌘F", run: () => openSearch() },
		{ id: "compare", icon: "≷", label: t("command.compare"), run: () => void openCompare() },
		{ id: "tasks", icon: "▶", label: t("command.tasks"), run: () => void openTasks() },
		{ id: "quick-open", icon: "↗", label: t("command.quickOpen"), hint: "⌘P", run: () => openPalette() },
		{ id: "outline", icon: "☷", label: t("command.outline"), hint: "⌘⇧O", run: () => { if (LSP_RE.test(docRef.current?.path ?? "")) setSymPalette({}); else say(t("command.outlineUnavailable"), "error"); } },
		{ id: "wsym", icon: "#", label: t("command.wsym"), hint: "⌘⇧#", run: () => { if (!cwd) return; dismissPanels(); setWsym({ query: "", results: [], busy: false, error: "", seq: 0 }); } },
		{ id: "replace", icon: "⇄", label: t("command.replace"), hint: "⌘⌥F", run: () => { if (modeRef.current === "code" && docRef.current && !editing && !docRef.current.image) { setFindOpen(true); setReplaceOpen(true); } else say(t("command.replaceUnavailable"), "error"); } },
		{ id: "problems", icon: "⚠", label: t("command.problems"), hint: "⇧⌘M", run: toggleProblems },
		{ id: "reopen-tab", icon: "↺", label: t("command.reopenTab"), hint: "⌘⇧T", run: reopenClosedTab },
		{ id: "close-all-tabs", icon: "✕", label: t("command.closeAllTabs"), run: () => closeTabs(tabs, { respectPins: true }) },
		{ id: "wrap", icon: "↩", label: t("command.wrap"), hint: "⌥Z", run: () => toggleWrap() },
		{ id: "toggle-rail", icon: "◧", label: t("command.toggleRail"), hint: "⌘B", run: () => setRailVisible((value) => !value) },
		{ id: "refresh", icon: "⟳", label: t("command.refresh"), run: () => { refreshGit(); setTreeKey((key) => key + 1); if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1); } },
		{ id: "live", icon: liveOn ? "◉" : "○", label: `${t("command.live")} — ${t(liveOn ? "watch.state.on" : "watch.state.off")}`, run: () => {
			const next = !liveOn;
			setLiveOn(next);
			try { localStorage.setItem("dsh.plugin-kit.live", next ? "on" : "off"); } catch { /* storage may be denied */ }
			say(t(next ? "watch.on" : "watch.off"));
		} },
		{ id: "format", icon: "⌘.", label: `${t("command.formatOnSave")} — ${t(formatOnSave ? "watch.state.on" : "watch.state.off")}`, hint: "⌥⇧F", run: () => {
			const next = !formatOnSave;
			setFormatOnSave(next);
			try { localStorage.setItem("dsh.plugin-kit.format", next ? "on" : "off"); } catch { /* storage may be denied */ }
			say(t(next ? "editor.formatOn" : "editor.formatOff"));
		} },
		...(builtinAvailable() ? [{ id: "terminal", icon: "‣", label: t("command.terminal"), run: () => { if (!openBuiltin()) void openTerminal(); } }] : []),
		...(terminalEntry.available() ? [{ id: "terminal-external", icon: "↗", label: t("command.externalTerminal"), run: () => void openTerminal() }] : []),
	], [t, refreshGit, openSearch, openPalette, toggleWrap, say, loadFile, dismissPanels, openTerminal, openBuiltin, terminalEntry, builtinTerminal, openBuiltinTerminal, editing, toggleProblems, reopenClosedTab, closeTabs, tabs, liveOn, cwd, formatOnSave, openCompare, openTasks]);

	const startRailDrag = useCallback((event) => {
		event.preventDefault();
		const startX = event.clientX;
		const startW = railW;
		const move = (e) => setRailW(Math.max(150, Math.min(760, startW + (e.clientX - startX))));
		const up = () => {
			window.removeEventListener("mousemove", move);
			window.removeEventListener("mouseup", up);
		};
		window.addEventListener("mousemove", move);
		window.addEventListener("mouseup", up);
	}, [railW]);

	// P0-3: the global quick-open command raises the picker in the visible panel
	useEffect(() => {
		const handler = () => {
			if (!tab || tab.visible) openPalette();
		};
		document.addEventListener("dsh-ce-quick-open", handler);
		return () => document.removeEventListener("dsh-ce-quick-open", handler);
	}, [openPalette, tab]);

	// Chat call rows (edit/write) raise their synthesized diff here: show it in
	// the panel's diff view without touching git.
	useEffect(() => {
		const handler = (event) => {
			const detail = event.detail;
			if (!detail || typeof detail.text !== "string" || !canNavigate()) return;
			dismissPanels();
			modeRef.current = "diff";
			setMobileView("editor");
			setShowDiffView(true);
			setDiff({
				path: detail.path ?? "",
				scope: "call",
				text: detail.text,
				gutter: detail.gutter === false ? false : void 0,
				stats: detail.stats ?? void 0,
			});
		};
		document.addEventListener("dsh-ce-open-calldiff", handler);
		return () => document.removeEventListener("dsh-ce-open-calldiff", handler);
	}, [canNavigate, dismissPanels]);

	const dropEditorFile = (event, before) => {
		if (!hasFileDrag(event.dataTransfer)) return;
		event.preventDefault(); event.stopPropagation();
		setFileDropOver(false); setTabDropOver(null);
		const value = readFileDrag(event.dataTransfer, cwd, sessionId);
		if (!value || value.kind !== "file") { say(t("drag.unsupported"), "error"); return; }
		if (value.source === "tab") {
			setTabs((current) => reorderFileTabs(current, value.path, before));
			return;
		}
		if (!canNavigate()) return;
		if (value.source === "changes") void openDiff(value.path, value.scope, value.repo);
		else void openFile(dragFilePath(value), 1, 1);
	};
	const editorDropProps = (before) => ({
		onDragOver: (event) => {
			if (!hasFileDrag(event.dataTransfer)) return;
			event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "copy";
			setFileDropOver(true); setTabDropOver(before ?? null);
		},
		onDragLeave: (event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) { setFileDropOver(false); setTabDropOver(null); } },
		onDrop: (event) => dropEditorFile(event, before),
	});

	if (!cwd) {
		return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
	}

	return h(
		"div",
		{ className: "ce-root ce-code-root", "data-mobile-view": (doc || diff || searchOpen || palette) && (!railVisible || mobileView === "editor") ? "editor" : "files", onKeyDown: onRootKeyDown, onDragEnd: () => { setFileDropOver(false); setTabDropOver(null); } },
		h(
			"div",
			{ className: "ce-toolbar" },
			h(
				"div",
				{ className: "ce-seg" },
				h("button", { type: "button", className: `ce-seg-btn${mode === "files" ? " ce-seg-on" : ""}`, onClick: () => { setMode("files"); dismissPanels(); setRailVisible(true); setMobileView("files"); } }, t("toolbar.files")),
				h("button", { type: "button", className: `ce-seg-btn${mode === "changes" ? " ce-seg-on" : ""}`, onClick: () => { setMode("changes"); dismissPanels(); setRailVisible(true); setMobileView("files"); refreshGit(); } }, `${t("toolbar.changes")}${git?.repo ? ` · ${git.working.length}` : ""}`),
			),
			 h("button", { type: "button", className: `ce-command-trigger${commandOpen ? " ce-tool-on" : ""}`, title: `${t("command.title")} (⌘⇧P / Ctrl+Shift+P)`, "aria-expanded": commandOpen, onClick: toggleCommand }, h("span", { className: "ce-command-mark", "aria-hidden": true }, ">_"), h("span", null, t("command.title")), h("kbd", null, "⌘⇧P")),
			(doc || diff) ? h("button", { type: "button", className: "ce-mobile-open-editor ce-link", onClick: () => { dismissPanels(); setMobileView("editor"); } }, t("layout.backEditor")) : null,

			git?.repo
				? h(
					"button",
					{
						type: "button",
						className: "ce-branch",
						disabled: sync.busy,
						title: `${t("branch.title")}${git.upstream ? ` · ${git.upstream}${git.upstreamInferred ? " · auto" : ""}` : ""}`,
						onClick: () => { const next = !branchPickOpen; dismissPanels(); setBranchPickOpen(next); },
					},
					h("span", null, `⎇ ${git.branch}`),
					sync.busy ? h("span", { className: "ce-spin ce-ico" }, h(IconRefresh)) : null,
					!sync.busy && git.ahead > 0 ? h("span", { className: "ce-ab ce-ab-ahead" }, `↑${git.ahead}`) : null,
					!sync.busy && git.behind > 0 ? h("span", { className: "ce-ab ce-ab-behind" }, `↓${git.behind}`) : null,
				)
				: null,
			h("span", { className: "ce-spacer" }),
			!railVisible ? h("button", { type: "button", className: "ce-tool", title: `${t("quickopen.placeholder")} (⌘P / Ctrl+P)`, onClick: () => palette ? closePalette() : openPalette() }, h(IconSearch)) : null,
			!railVisible ? h("button", { type: "button", className: "ce-tool ce-workspace-search", title: `${t(mode === "changes" ? "search.changesHint" : "search.workspaceHint")} (⇧⌘F / Ctrl+Shift+F)`, "aria-label": t(mode === "changes" ? "search.changesHint" : "search.workspaceHint"), onClick: openSearch }, h(IconTextSearch), h("span", null, t(mode === "changes" ? "search.changesAction" : "changes.searchWorkspace"))) : null,
			// The terminal sits with the tool icons: the command centre trigger
			// already reads as ">_", which would double the glyph. The built-in
			// tab is preferred; the system terminal is the fallback and its own
			// command entry.
			builtinAvailable() || terminalEntry.available()
				? h("button", {
					type: "button",
					className: "ce-tool",
					title: builtinAvailable() ? t("toolbar.terminalHint") : t("toolbar.externalTerminalHint"),
					"aria-label": builtinAvailable() ? t("toolbar.terminal") : t("toolbar.externalTerminal"),
					onClick: () => { if (!openBuiltin()) void openTerminal(); },
				}, h(IconTerminal))
				: null,
			h("button", { type: "button", className: "ce-tool", title: `${statusTitle}`, onClick: () => { refreshGit(); setTreeKey((k) => k + 1); if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1); } }, h(IconRefresh)),
			h("span", { className: `ce-dot ce-dot-${status.state}`, title: statusTitle }),
		),
		notice.kind === "error" && notice.text
			? h(
				"div",
				{ className: "ce-banner" },
				h("span", { className: "ce-banner-text" }, notice.text),
				h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => say("") }, "✕"),
			)
			: null,
		externalConflict
			? h(
				"div",
				{ className: "ce-banner ce-banner-warn" },
				h("span", { className: "ce-banner-text" }, t("watch.external", { path: externalConflict.path })),
				h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => void openConflictDiff() }, t("watch.compareDisk")),
				h("button", { type: "button", className: `ce-tool ce-tiny${overwriteArm ? " ce-tool-danger" : ""}`, onClick: () => { if (overwriteArm) { setOverwriteArm(false); saveEdit({ overwrite: true }); } else setOverwriteArm(true); } }, overwriteArm ? t("watch.overwriteConfirm") : t("watch.overwriteDraft")),
				h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => { setExternalConflict(null); setConflictDiff(null); setOverwriteArm(false); void backgroundReload(true); } }, t("watch.reloadDiscarding")),
				h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => { setExternalConflict(null); setOverwriteArm(false); } }, t("watch.keepEditing")),
			)
			: null,
		conflictDiff
			? h(
				"div",
				{ className: "ce-conflict-diff" },
				h("div", { className: "ce-conflict-head" },
					h("span", { className: "ce-conflict-title" }, t("watch.conflictTitle", { path: conflictDiff.path })),
					conflictDiff.busy ? h("span", { className: "ce-conflict-meta" }, t("loading")) : null,
					!conflictDiff.busy && !conflictDiff.error ? h("span", { className: "ce-conflict-meta" }, conflictDiff.identical ? t("watch.conflictIdentical") : `+${conflictDiff.add} −${conflictDiff.del}`) : null,
					h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setConflictDiff(null) }, "✕"),
				),
				conflictDiff.error
					? h("div", { className: "ce-note" }, conflictDiff.error)
					: conflictDiff.identical
						? h("div", { className: "ce-note" }, t("watch.conflictIdenticalHint"))
						: h(DiffView, {
							t,
							diff: { path: conflictDiff.path, scope: "call", text: conflictDiff.text, gutter: false },
							onClose: () => setConflictDiff(null),
							canSource: false,
						}),
			)
			: null,
		h(
			"div",
			{ className: "ce-main", ref: mainRef },
			railVisible
				? h("div", { className: "ce-rail-wrap ce-rail-with-search", style: { width: `${railW}px` } },
					h("div", { className: "ce-rail-navigation" },
						h("button", { type: "button", className: "ce-rail-search", title: `${t(mode === "changes" ? "search.changesHint" : "search.workspaceHint")} (⇧⌘F / Ctrl+Shift+F)`, onClick: openSearch }, h(IconTextSearch), h("span", null, t(mode === "changes" ? "search.changesAction" : "changes.searchWorkspace"))),
						h("button", { type: "button", className: "ce-tool ce-rail-quickopen", "aria-label": t("quickopen.placeholder"), title: `${t("quickopen.placeholder")} (⌘P / Ctrl+P)`, onClick: () => palette ? closePalette() : openPalette() }, h(IconSearch)),
					),
					mode === "files"
					? h(TreePanel, {
						cwd, sessionId,
						t,
						onOpenFile: (path, line, col) => void openFile(path, line, col),
						onSearchDirectory: (directory) => openSearch({ kind: "directory", directory }),
						activePath: doc?.path ?? diff?.path,
						revealPath: doc?.path ?? null,
						refreshKey: treeKey,
						staleTick: stale.tick,
						staleDirs: stale.dirs,
						onNotify: (text, kind) => say(text, kind),
						onDeleted: forgetPath,
					})
					: h(ChangesPanel, {
						cwd, sessionId,
						onDelete: (item) => void deleteUntracked(item).then((ok) => { if (ok) forgetPath(item.path); }),
						onDeleteDir: (dirPath, dirItems) => void deleteUntrackedMany(dirPath, dirItems).then((n) => { if (n > 0) forgetPath(dirPath); }),
						t,
						git,
						repos,
						repoSel,
						onSelectRepo: (root) => {
							repoSelRef.current = root;
							setRepoSel(root);
							if (!root) refreshGit();
						},
						commitsOpen,
						setCommitsOpen,
						onOpenCommit: (commit) => void openCommit(commit),
						onOpenDiff: (path, scope, repoOverride, refs) => void (scope === "commit" || scope === "compare" ? openDiff(path, scope, repoOverride, refs) : openChangeSource(path, scope)),
						onDiscard: (item) => void discardChange(item),
						onDiscardDir: (dirItems) => void discardMany(dirItems),
						onStage: (item) => void stageChange(item.path),
						onStageDir: (dirPath) => void stageChange(dirPath),
						onUnstage: (item) => void unstageChange(item.path),
						onUnstageDir: (dirPath) => void unstageChange(dirPath),
						onCommit: (msg, stageAll, amend) => commitChanges(msg, stageAll, amend),
						committing,
						onNotify: (text, kind) => say(text, kind),
						refresh: refreshGit,
						onCherryPick: (commit) => void pickCommit(commit),
						onResolve: (path, side) => void resolveConflict(path, side),
						onSequencer: (action) => void sequencerAction(action),
						compare,
						setCompare,
						seqDisabled: seqBusy,
						onAiMessage: () => generateCommitMessage(),
					}))
				: null,
			railVisible
				? h("div", { className: "ce-splitter", onMouseDown: startRailDrag, onDoubleClick: () => setRailVisible(false), title: "⇔ 拖动调宽 · 双击收起" })
				: h("button", { type: "button", className: "ce-rail-tab", title: "展开侧栏 (⌘B / Ctrl+B)", onClick: () => setRailVisible(true) }, "▸"),
			h(
				"div",
				{ className: `ce-editor${fileDropOver ? " ce-editor-file-drop" : ""}`, ...editorDropProps(), onDragEnd: () => { setFileDropOver(false); setTabDropOver(null); } },
				fileDropOver ? h("div", { className: "ce-file-drop-hint", role: "status" }, t("drag.openHere")) : null,
				h("button", { type: "button", className: "ce-mobile-back", onClick: () => { setSearchOpen(false); closePalette(); setRailVisible(true); setMobileView("files"); } }, `← ${t("layout.backFiles")}`),
				tabs.length > 0
					? h("div", { className: "ce-tabs", ref: tabsRef },
						tabs.map((p) => {
							const active = doc?.path === p && (!diff || !showDiffView);
							const dirty = active && editing && editText !== (doc?.raw ?? "");
							return h(
								"div",
								{
									key: p,
									className: `ce-tab${active ? " ce-tab-active" : ""}${tabDropOver === p ? " ce-tab-drop-before" : ""}`,
									...fileDragProps({ cwd, path: p, source: "tab", sessionId }),
									...editorDropProps(p),
									onDragEnd: () => { setFileDropOver(false); setTabDropOver(null); },
									title: RelPath(cwd, p) || p,
									onClick: () => switchTab(p),
									onContextMenu: (e) => openTabMenu(e, p),
									onAuxClick: (e) => {
										if (e.button === 1) {
											e.preventDefault();
											closeTab(p);
										}
									},
								},
								h("span", { className: `ce-tab-dot${dirty ? " ce-tab-dirty" : ""}` }, dirty ? "●" : ""),
								pinned.includes(p) ? h("span", { className: "ce-tab-pin", title: t("tabs.pinned"), "aria-label": t("tabs.pinned") }, "◉") : null,
								h("span", { className: "ce-tab-name" }, p.split("/").pop()),
								h("button", {
									type: "button",
									className: "ce-tab-x",
									title: t("editor.closeTab"),
									onClick: (e) => {
										e.stopPropagation();
										closeTab(p);
									},
								}, "✕"),
							);
						}),
					)
					: null,
				// VS Code-style editor tab context menu: Close / Close Others /
				// Close to the Right / Close All, all through closeTabs().
				tabMenu
					? h("div", { className: "cet-context ce-tabmenu", ref: tabMenuRef, style: { left: tabMenu.x, top: tabMenu.y }, role: "menu", onMouseDown: (e) => e.stopPropagation() },
						h("div", { className: "cet-context-path" }, tabMenu.path.split("/").pop()),
						h("button", { type: "button", role: "menuitem", onClick: () => togglePin(tabMenu.path) }, pinned.includes(tabMenu.path) ? t("tabs.unpin") : t("tabs.pin")),
						h("div", { className: "cet-context-rule" }),
						h("button", { type: "button", role: "menuitem", onClick: () => closeTabs([tabMenu.path]) }, t("tabs.close")),
						h("button", { type: "button", role: "menuitem", disabled: tabs.length <= 1, onClick: () => closeTabs(removedPaths(tabs, closeOtherTabs(tabs, tabMenu.path)), { respectPins: true }) }, t("tabs.closeOthers")),
						h("button", { type: "button", role: "menuitem", disabled: closeTabsToRight(tabs, tabMenu.path).length >= tabs.length, onClick: () => closeTabs(removedPaths(tabs, closeTabsToRight(tabs, tabMenu.path)), { respectPins: true }) }, t("tabs.closeRight")),
						h("div", { className: "cet-context-rule" }),
						h("button", { type: "button", role: "menuitem", className: "cet-context-danger", onClick: () => closeTabs(tabs, { respectPins: true }) }, t("tabs.closeAll")),
					)
					: null,
				diff && showDiffView
					? h(DiffView, {
						t,
						diff,
						onClose: () => { setDiff(null); if (docRef.current) modeRef.current = "code"; },
						onOpenSource: (line) => openDiffSource(line),
						canSource: diff.scope === "working" || diff.scope === "branch" || diff.scope === "staged",
						onRevertHunk: diff.scope === "working" && !diff.untracked && typeof diff.path === "string" && diff.path !== ""
							? (idx, header) => void revertHunk(idx, header)
							: null,
					})
					: doc
					? h(
						Fragment,
						null,
						h(
							"div",
							{ className: "ce-head" },
							h("button", { type: "button", className: "ce-tool ce-tiny", title: t("back"), disabled: !canBack, onClick: goBack }, h(IconArrowLeft)),
							h("button", { type: "button", className: "ce-tool ce-tiny", title: t("forward"), disabled: !canForward, onClick: goForward }, h(IconArrowRight)),
							h("span", { className: "ce-head-path" }, RelPath(cwd, doc.path) || doc.path),
							currentSymbol
								? h(
									"button",
									{ type: "button", className: "ce-crumb", title: `${t("symbols.crumb")} (⌘⇧O)`, onClick: () => LSP_RE.test(doc.path) && setSymPalette({}) },
									`› ${currentSymbol.name}`,
								)
								: null,
							docLang !== "text" ? h("span", { className: "ce-chip" }, docLang) : null,
							diffMarks
								? h("button", { type: "button", className: "ce-chip ce-chip-mark", title: t("diff.marksClear"), onClick: () => setDiffMarks(null) }, `${t("diff.marksChip")} ${diffMarks.size}`)
								: null,
							diffMarks && diffMarks.size === 0 && diff?.note && !showDiffView
								? h("span", { className: "ce-chip", title: diff.note }, diff.note)
								: null,
							diff && !showDiffView && (diff.scope === "working" || diff.scope === "branch")
								? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("diff.showHunks"), onClick: () => setShowDiffView(true) }, "≡")
								: null,
							doc.truncated ? h("span", { className: "ce-chip" }, t("truncated")) : null,
							doc && !diff && PREVIEW_RE.test(doc.path)
								? h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("editor.previewToggle"), onClick: () => setPreviewOn((v) => !v) }, previewOn ? t("editor.raw") : t("editor.preview"))
								: null,
							doc && !diff && !editing && !doc.image ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("editor.edit"), onClick: startEdit }, "✎") : null,
							editing ? h("button", { type: "button", className: "ce-link", onClick: () => saveEdit() }, t("editor.save")) : null,
							editing ? h("button", { type: "button", className: "ce-link", onClick: cancelEdit }, t("editor.cancel")) : null,
							editing && editText !== (doc?.raw ?? "") ? h("span", { className: "ce-chip ce-chip-warn" }, t("editor.dirty")) : null,
							doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${findOpen ? " ce-tool-on" : ""}`, title: `${t("editor.find")} (⌘F / Ctrl+F)`, onClick: () => setFindOpen((v) => !v) }, "⌕") : null,
							doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${wrapOn ? " ce-tool-on" : ""}`, title: `${t("editor.wrap")} (⌥Z / Alt+Z)`, onClick: toggleWrap }, "↩") : null,
							doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${blameOn ? " ce-tool-on" : ""}`, title: t("blame.toggle"), disabled: wrapOn, onClick: () => { setBlameOn((v) => !v); setBlame(null); } }, "B") : null,
							doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${fileHist ? " ce-tool-on" : ""}`, title: t("history.title"), onClick: openFileHistory }, "🕘") : null,
							h("span", { className: "ce-spacer" }),
							cursor ? h("button", { type: "button", className: "ce-pos ce-pos-btn", title: t("goto.title"), onClick: () => setGotoOpen(true) }, `Ln ${cursor.line}, Col ${cursor.col}${cursor.word ? ` · ${cursor.word}` : ""}`) : null,
							diagnostics.length ? h("button", { type: "button", className: `ce-diag ce-diag-btn${problemsOpen ? " ce-tool-on" : ""}`, title: `${t("problems.title")} (⇧⌘M / Ctrl+Shift+M)`, "aria-expanded": problemsOpen, onClick: toggleProblems }, `${diagnostics.length} ${t("diag.count")}`) : null,
						),
						findOpen && !editing ? h(Fragment, null,
						h("div", { className: "ce-find" },
							h("input", {
								className: "ce-input ce-find-input",
								placeholder: t("editor.findPlaceholder"),
								value: findQuery,
								autoFocus: true,
								"aria-label": t("editor.findPlaceholder"),
								onChange: (e) => { setFindQuery(e.target.value); setFindIdx(0); },
								onKeyDown: (e) => {
									e.stopPropagation();
									if (e.key === "Enter") { e.preventDefault(); jumpFind(e.shiftKey ? -1 : 1); }
									else if (e.key === "Escape") setFindOpen(false);
								},
							}),
							h("button", { type: "button", className: `ce-tool ce-tiny${findOpts.caseSensitive ? " ce-tool-on" : ""}`, title: t("find.case"), onClick: () => { setFindOpts((o) => ({ ...o, caseSensitive: !o.caseSensitive })); setFindIdx(0); } }, "Aa"),
							h("button", { type: "button", className: `ce-tool ce-tiny${findOpts.words ? " ce-tool-on" : ""}`, title: t("find.words"), onClick: () => { setFindOpts((o) => ({ ...o, words: !o.words })); setFindIdx(0); } }, "ab|"),
							h("button", { type: "button", className: `ce-tool ce-tiny${findOpts.regex ? " ce-tool-on" : ""}`, title: t("find.regex"), onClick: () => { setFindOpts((o) => ({ ...o, regex: !o.regex })); setFindIdx(0); } }, ".*"),
							h("button", { type: "button", className: `ce-tool ce-tiny${replaceOpen ? " ce-tool-on" : ""}`, title: `${t("editor.replaceToggle")} (⌘⌥F / Ctrl+Alt+F)`, "aria-expanded": replaceOpen, onClick: () => setReplaceOpen((v) => !v) }, "⇄"),
							findRe === false
								? h("span", { className: "ce-find-count cea-err" }, t("find.badRegex"))
								: h("span", { className: "ce-find-count" }, findQuery ? `${findMatches.length === 0 ? 0 : Math.min(findIdx + 1, findMatches.length)}/${findMatches.length}` : ""),
							h("button", { type: "button", className: "ce-tool ce-tiny", title: t("find.prev"), onClick: () => jumpFind(-1) }, "↑"),
							h("button", { type: "button", className: "ce-tool ce-tiny", title: t("find.next"), onClick: () => jumpFind(1) }, "↓"),
							h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setFindOpen(false) }, "✕"),
						),
						replaceOpen ? h("div", { className: "ce-find ce-find-replace" },
							h("input", {
								className: "ce-input ce-find-input",
								placeholder: t("editor.replacePlaceholder"),
								"aria-label": t("editor.replace"),
								value: replaceText,
								onChange: (e) => setReplaceText(e.target.value),
								onKeyDown: (e) => {
									e.stopPropagation();
									if (e.key === "Enter") { e.preventDefault(); doReplace(false); }
									else if (e.key === "Escape") setReplaceOpen(false);
								},
							}),
							h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("editor.replaceOneTitle"), disabled: findMatches.length === 0 || findRe === false, onClick: () => doReplace(false) }, t("editor.replace")),
							h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("editor.replaceAllTitle"), disabled: findMatches.length === 0 || findRe === false, onClick: () => doReplace(true) }, t("editor.replaceAll")),
							h("button", { type: "button", className: `ce-tool ce-tiny${preserveCase ? " ce-tool-on" : ""}`, title: t("find.preserveCase"), "aria-pressed": preserveCase, onClick: () => setPreserveCase((v) => !v) }, "AB"),
						) : null,
						) : null,
						h(
							"div",
							{ className: "ce-code-wrap" },
							doc.image
								? h("div", { className: "ce-imgwrap ce-scroll" },
									doc.image.base64
										? h("img", { className: "ce-img", src: `data:${doc.image.mime};base64,${doc.image.base64}`, alt: doc.path })
										: h("div", { className: "ce-note" }, t("image.tooBig")),
									h("div", { className: "ce-imgmeta" }, `${doc.image.mime} · ${(doc.image.size / 1024).toFixed(1)} KB${doc.image.truncated ? ` · ${t("image.tooBig")}` : ""}`),
								)
								: editing
								? h("div", { className: "ce-edit-wrap" },
									editGutter ? h("div", { className: "ce-gutter ce-edit-gutter" }, editGutter.map((g) => h("div", { key: g.line, className: "ce-gutter-row", style: { top: g.top } }, g.line))) : null,
									h("textarea", {
										ref: editTaRef,
										className: `ce-edit-ta${wrapOn ? " ce-edit-ta-wrap" : ""}`,
										value: editText,
										spellcheck: false,
										onChange: (e) => setEditText(e.target.value),
										onScroll: (e) => { if (editGutter) { const g = e.currentTarget.parentElement?.querySelector(".ce-edit-gutter"); if (g) g.scrollTop = e.currentTarget.scrollTop; } },
										onKeyDown: (e) => {
											if (e.key === "Tab") {
												e.preventDefault();
												const ta = e.currentTarget;
												const res = handleTabIndent(editText, ta.selectionStart, ta.selectionEnd, e.shiftKey);
												setEditText(res.text);
												requestAnimationFrame(() => { ta.selectionStart = res.start; ta.selectionEnd = res.end; });
												return;
											}
											if ((e.metaKey || e.ctrlKey) && e.code === "KeyF" && !e.shiftKey) {
												e.preventDefault();
												setEditFindOpen(true);
												return;
											}
											if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === "KeyF") {
												e.preventDefault();
												setEditFindOpen(true);
												return;
											}
										},
									}),
									editFindOpen ? h("div", { className: "ce-edit-find" },
										h("input", { className: "ce-input ce-edit-find-input", value: editFindQuery, placeholder: t("editor.find"), onChange: (e) => { setEditFindQuery(e.target.value); setEditFindIdx(0); }, onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); setEditFindIdx((i) => (i + 1) % Math.max(1, editFindMatches.length)); } if (e.key === "Escape") { e.preventDefault(); setEditFindOpen(false); } } }),
										h("span", { className: "ce-edit-find-count" }, editFindMatches.length > 0 ? `${editFindIdx + 1}/${editFindMatches.length}` : t("editor.noMatch")),
										h("button", { type: "button", className: "ce-tool ce-tiny", title: t("editor.replace"), onClick: () => { const res = replaceInText(editText, editFindQuery, editReplaceText, editFindOpts, editFindIdx, false); if (res.count > 0) { setEditText(res.text); setEditFindIdx(Math.min(editFindIdx, Math.max(0, findInText(res.text, editFindQuery, editFindOpts).length - 1))); } } }, "⇄"),
										h("button", { type: "button", className: "ce-tool ce-tiny", title: t("editor.replaceAll"), onClick: () => { const res = replaceInText(editText, editFindQuery, editReplaceText, editFindOpts, 0, true); if (res.count > 0) { setEditText(res.text); say(t("replace.replacedAll", { n: res.count })); } } }, t("editor.replaceAll")),
										h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setEditFindOpen(false) }, "✕"),
									) : null,
								)
								: previewActive
									? (MD_RE.test(doc.path)
										? h(MarkdownView, { text: doc.raw })
										: SVG_RE.test(doc.path)
											? h("div", { className: "ce-imgwrap ce-scroll" }, h("img", { className: "ce-img", src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc.raw)}`, alt: doc.path }))
											: h("iframe", { className: "ce-htmlprev", sandbox: "", srcDoc: doc.raw, title: doc.path }))
									: h(
										Fragment,
										null,
										blameOn && blame !== null && !wrapOn ? h("div", { className: "ce-blame" }, visible?.blameRows) : null,
										wrapOn ? null : h("div", { className: "ce-gutter" }, h("div", { className: "ce-gutter-inner", style: { transform: `translateY(${-scroll}px)` } }, gutter)),
							h(
								"div",
								{
									className: "ce-code",
									tabIndex: 0,
									ref: codeRef,
									onKeyDown,
									onClick: onEditorClick,
									onMouseMove: onEditorMouseMove,
									onMouseLeave: cancelHover,
									onScroll: (event) => { setScroll(event.currentTarget.scrollTop); cancelHover(); },
									style: { outline: "none" },
								},
								wrapOn
									? h("div", { className: "ce-wdoc" },
										wrapDoc?.rows,
										wrapDoc?.capped ? h("div", { className: "ce-note ce-wcap" }, t("editor.wrapCapped", { n: WRAP_LINE_CAP })) : null,
									)
									: h("div", { className: "ce-code-inner", style: { height: `${visible?.total ?? (doc.lines.length + 2) * ROW}px` } }, visible?.rows),
							),
								),
							!editing && !previewActive && changeRailBlobs.length > 0
								? h("div", { className: "ce-changerail" }, changeRailBlobs.map((b, i) => h("button", {
									key: i,
									type: "button",
									className: `ce-changeblob ce-changeblob-${b.kind}`,
									title: `L${b.start}${b.end > b.start ? `-${b.end}` : ""} · ${t("diff.marksChip")}`,
									style: {
										top: `${((b.start - 1) / Math.max(1, doc.lines.length)) * 100}%`,
										height: `${Math.max(0.6, ((b.end - b.start + 1) / Math.max(1, doc.lines.length)) * 100)}%`,
									},
									onClick: () => jumpToLine(b.start),
								}, null)))
								: null,
							peek ? h(RefsPeek, { t, cwd, peek, scroll, totalLines: doc.lines.length, onPick: pickPeek, onClose: closePeek }) : null,
							hover && !editing
								? h("div", {
									className: "ce-hover",
									role: "tooltip",
									style: { top: Math.max(4, hover.y * ROW - scroll + ROW + 4), left: 12 },
								}, hover.text)
								: null,
							symPalette ? h(SymbolPalette, { t, symbols, onPick: (s) => { setSymPalette(null); revealPosition(s.line, s.col, s.name); }, onClose: () => setSymPalette(null) }) : null,
							wsym ? h(WorkspaceSymbolPalette, {
								t,
								cwd,
								state: wsym,
								onQuery: (query) => setWsym((cur) => (cur === null ? cur : { ...cur, query, busy: query.trim() !== "", seq: cur.seq + 1 })),
								onPick: (s) => {
									setWsym(null);
									if (typeof s.path === "string" && s.path !== "") void openFile(s.path, s.line, s.col, true, { line: s.line, col: s.col, word: s.name });
								},
								onClose: () => setWsym(null),
							}) : null,
							compareOpen ? h(CompareRefsPalette, {
								t,
								busy: compareBusy,
								branches: compareBranches,
								onRun: (base, head) => void doCompare(base, head),
								onClose: () => setCompareOpen(false),
							}) : null,
							tasks ? h(TaskPalette, {
								t,
								state: tasks,
								onRun: (script) => void startTask(script),
								onClose: () => setTasks(null),
							}) : null,
							task ? h(TaskOutputPanel, {
								t,
								state: task,
								onStop: () => void stopTask(),
								onClose: () => { taskSeq.current += 1; setTask(null); },
								onOpenFile: (path, line, col) => void openFile(path, line, col, true, { line, col }),
							}) : null,
							delPreview
								? h("div", { className: "ce-overlay", ref: delPreviewRef, role: "dialog", "aria-label": t("diff.deletedAt") },
									h("div", { className: "ce-overlay-head" },
										h("span", null, `${t("diff.deletedAt")} · L${delPreview.anchor}`),
										h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setDelPreview(null) }, "✕"),
									),
									h("div", { className: "ce-overlay-list" }, delPreview.lines.map((ln, j) =>
										h("div", { key: j, className: "ce-dline ce-dline-del" }, h("span", { className: "ce-dtext" }, `- ${ln}`)))),
								)
								: null,
						),
					)
						: h("div", { className: "ce-empty" }, t("editor.placeholder")),
				overlay ? h(LocationList, { t, overlay, cwd, onPick: (item) => { const word = cursorRef.current?.word; setOverlay(null); void openFile(item.path, item.line, item.col, true, word ? { line: item.line, col: item.col, word } : null); }, onClose: () => setOverlay(null) }) : null,
				palette ? h(QuickOpen, { t, state: palette, onQuery: onPaletteQuery, onPick: onPalettePick, onClose: closePalette }) : null,
				gotoOpen && doc && !doc.image
					? h(GotoLinePalette, { t, totalLines: wrapOn ? Math.min(doc.lines.length, WRAP_LINE_CAP) : doc.lines.length, initial: cursor?.line ?? 1, onGo: jumpToLine, onClose: () => setGotoOpen(false) })
					: null,
				fileHist
					? h(FileHistoryOverlay, { t, hist: fileHist, onPick: (c) => void openHistCommit(c), onClose: () => setFileHist(null) })
					: null,
				problemsOpen
					? h(ProblemsPanel, {
						t,
						diagnostics,
						workspaceFiles: workspaceDiag,
						onPick: (item) => { setProblemsOpen(false); if (item._file && cwd) { const parts = item._file.split("/"); const path = parts.length >= 2 ? parts.slice(-2).join("/") : item._file; void openFile(path, item.line, item.col, true, { line: item.line, col: item.col, word: "" }); } else revealPosition(item.line, item.col, ""); },
						onClose: () => setProblemsOpen(false),
					})
					: null,
				searchOpen && search ? h(SearchPanel, {
					t,
					cwd,
					state: search,
					onQuery: (q) => changeSearch({ query: q }),
					onInclude: (v) => changeSearch({ include: v }),
					onDirectory: (directory) => changeSearch({ scope: directory.trim() ? { kind: "directory", directory: directory.trim() } : { kind: "workspace" } }),
					onToggleRegex: () => changeSearch({ regex: !search.regex }),
					onToggleWords: () => changeSearch({ words: !search.words }),
					onSubmit: () => runSearchNow(search.query, search.include, search),
					onPick: onSearchPick,
					onClose: () => setSearchOpen(false),
					onNotify: (text, kind) => say(text, kind),
				}) : null,
			),
		),
		commandOpen ? h(CommandPalette, { t, commands, onClose: () => setCommandOpen(false) }) : null,
		branchPickOpen && git?.repo
			? h(BranchPalette, {
				cwd,
				repo: repoSel,
				current: git.branch,
				t,
				onFetch: () => void doFetch(),
				onPull: () => void doPull(),
				onPush: () => void doPush(),
				onClose: () => setBranchPickOpen(false),
				onDone: (ok, err) => {
					setBranchPickOpen(false);
					if (!ok) {
						say(`${t("error")}: ${err}`, "error");
						return;
					}
					say(t("branch.checkedOut"));
					refreshGit();
					if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
				},
			})
			: null,
		h(
			"div",
			{ className: "ce-statusbar" },
			h("span", null, notice.kind === "info" ? notice.text || (doc && !diagnostics.length && LSP_RE.test(doc.path) ? t("nodiag") : "") : ""),
			h("span", { className: "ce-spacer" }),
			h("span", { className: "ce-prog" }, status.progress || (status.state === "error" ? `${status.label ?? "lsp"} ✕` : status.state === "ready" ? `${status.label ?? "lsp"} ✓` : status.state === "starting" ? `${status.label ?? "lsp"} …` : "")),
		),
	);
}

export function CodeTitle({ useTabInfo }) {
	const tabInfo = useTabInfo ? useTabInfo() : null;
	return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(IconCode)), tabInfo?.tab?.title ?? "Code");
}
