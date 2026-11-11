/* ---------------- Code tab: stateful orchestrator (toolbar, rail, editor, diff, status) ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { ROW } from "./constants.js";
import { api } from "./api.js";
import { buildLineStates, langFor, wordAt } from "./highlight.js";
import { IconArrowLeft, IconArrowRight, IconCode, IconRefresh, IconSearch, IconTextSearch } from "./icons.js";
import { DiffView, changedNewLines, deletedGroups, changeBlobs } from "./diff.js";
import { MarkdownView } from "./markdown.js";
import { BranchPalette } from "./branchpick.js";
import { RelPath, toAbs } from "./pathtools.js";
import { TreePanel } from "./tree.js";
import { ChangesPanel } from "./changes.js";
import { LocationList, QuickOpen, RefsPeek, SymbolPalette, GotoLinePalette, FileHistoryOverlay } from "./overlays.js";
import { SearchPanel } from "./searchpanel.js";
import { computeGutter, computeVisible, computeWrapRows, compileFindRe, findRangesInLine, WRAP_LINE_CAP } from "./codeview.js";
import { useGitActions } from "./usegit.js";
import { useNavPersistence } from "./usepersistence.js";

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
	const { useTabInfo, sessionId, useSessions, t } = props;
	const tabInfo = useTabInfo ? useTabInfo() : null;
	const tab = tabInfo?.tab;
	const cwd = useSessions ? useSessions((sessions) => (sessionId ? sessions.byId[sessionId]?.cwd : undefined)) : undefined;

	const [mode, setMode] = useState("files");
	const [doc, setDoc] = useState(null); // {path, lines, states, truncated, error}
	const [diff, setDiff] = useState(null); // {path, scope, text, ...}
	const [git, setGit] = useState(null);
	const [cursor, setCursor] = useState(null); // {line, col, word}
	const [diagnostics, setDiagnostics] = useState([]);
	const [overlay, setOverlay] = useState(null);
	const [hover, setHover] = useState(null);
	const [status, setStatus] = useState({ state: "off", message: "", progress: "" });
	const [notice, setNotice] = useState({ text: "", kind: "info" });
	const [treeKey, setTreeKey] = useState(0);
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
	const [showDiffView, setShowDiffView] = useState(true); // {symbol, anchorLine, busy, def, refs, error}
	const [railW, setRailW] = useState(230);
	const [railVisible, setRailVisible] = useState(true);
	const [symbols, setSymbols] = useState([]);
	const [symPalette, setSymPalette] = useState(null); // {query}
	const [commitsOpen, setCommitsOpen] = useState(false);
	const peekNonce = useRef(0);
	const paletteTimer = useRef(null);
	const searchTimer = useRef(null);
	const searchNonce = useRef(0);
	const symbolNonce = useRef(0);

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

	docRef.current = doc;
	cursorRef.current = cursor;
	peekRef.current = peek;
	wrapOnRef.current = wrapOn;

	const say = useCallback((text, kind = "info") => {
		setNotice({ text, kind });
		if (noticeTimer.current) clearTimeout(noticeTimer.current);
		if (kind !== "error") noticeTimer.current = setTimeout(() => setNotice({ text: "", kind: "info" }), 3800);
	}, []);

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

	const loadFile = useCallback(
		async (path, line, col, mark, opts) => {
			if (!cwd) return null;
			const res = await api("fs.read", { cwd, path });
			if (!res.ok) {
				say(`${t("error")}: ${res.error}`, "error");
				return null;
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
			setDoc(entry);
			modeRef.current = "code";
			setDiff(null);
			const clampLine = Math.min(Math.max(1, line), Math.max(1, lines.length));
			setCursor({ line: clampLine, col, word: wordAt(lines[clampLine - 1] ?? "", col)?.word ?? "" });
			setDiagnostics([]);
			setOverlay(null);
			setHover(null);
			setSymbols([]);
			setScroll((0));
			if (codeRef.current) codeRef.current.scrollTop = 0;
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
			if (!opts?.noAutoMarks) {
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
			// reveal after layout; mark drives the exact-token highlight
			const markLine = mark?.line ?? clampLine;
			requestAnimationFrame(() => {
				scrollAreaToLine(Math.max(1, markLine));
				setFlash({ line: markLine, col: mark?.col, word: mark?.word });
				setTimeout(() => setFlash((f) => (f && f.line === markLine ? null : f)), 1800);
			});
			return entry;
		},
		[cwd, fetchDiagnostics, say, t, scrollAreaToLine],
	);

	const openFile = useCallback(
		async (path, line, col, record = true, mark) => {
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
		[loadFile],
	);


	// All mutating git operations (fetch/pull/push, discard, stage/commit)
	// live in the useGitActions hook; results fold back through setGit/say.
	const { sync, committing, doFetch, doPull, doPush, discardChange, discardMany, stageChange, unstageChange, commitChanges } = useGitActions({
		cwd, t, say, git, setGit, repoSelRef, refreshGit, loadFile, docRef, cursorRef, modeRef,
	});

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
	}, [openFile]);

	const goForward = useCallback(() => {
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
	}, [openFile]);

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
	}, [editing, editText, openFile, say, t, diff, showDiffView]);

	const closeTab = useCallback((path) => {
		const current = docRef.current;
		if (editing && current?.path === path && editText !== (current?.raw ?? "")) {
			say(t("editor.dirtyGuard"), "error");
			return;
		}
		const idx = tabs.indexOf(path);
		if (idx < 0) return;
		const next = tabs.filter((p) => p !== path);
		setTabs(next);
		delete tabViewRef.current[path];
		if (current?.path === path) {
			const neighbor = next[Math.min(idx, next.length - 1)];
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
	}, [tabs, editing, editText, openFile, say, t]);


	/* P0-1: per-session navigation state survives tab churn (usepersistence.js) */
	useNavPersistence({
		persistKey, cwd, doc, cursor, scroll, mode, railW, railVisible, wrapOn, findOpts, tabs, histTick,
		histRef, docRef, codeRef, loadFile,
		setRailW, setRailVisible, setWrapOn, setFindOpts, setTabs, setMode, setHistTick, setScroll,
	});

	const revealPosition = useCallback((line, col, word) => {
		const current = docRef.current;
		if (!current) return;
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
	}, [scrollAreaToLine]);

	const openDiff = useCallback(
		async (path, scope) => {
			if (!cwd) return;
			const repo = repoSelRef.current;
			const res = await api("git.diff", repo ? { cwd, path, scope, repo } : { cwd, path, scope });
			const value = res.ok ? res.value : { error: res.error };
			modeRef.current = "diff";
			setShowDiffView(true);
			setDiff({ path, scope, text: value.diff ?? "", error: value.error, base: value.base, untracked: value.untracked, note: value.note });
			setOverlay(null);
			setHover(null);
		},
		[cwd],
	);
	// Whole-file presentation: load the current file and mark the changed
	// new-side lines, keeping gopls jumps and edit mode available on top.
	const openChangeSource = useCallback(async (path, scope) => {
		if (!cwd) return;
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
		await loadFile(path, first, 1, null, { noAutoMarks: true });
		setDiffMarks(marks);
		setDelGroups(deletedGroups(text));
	}, [cwd, loadFile]);
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
			if (!cwd) return;
			const repo = repoSelRef.current;
			const res = await api("git.diff", repo ? { cwd, scope: "commit", sha: commit.hash, repo } : { cwd, scope: "commit", sha: commit.hash });
			const value = res.ok ? res.value : { error: res.error };
			if (value.error) {
				say(`${t("error")}: ${value.error}`, "error");
				return;
			}
			modeRef.current = "diff";
			setDiff({ path: `${t("diff.scopeCommit")} ${commit.hash}`, scope: "commit", commit: value.commit, text: value.diff ?? "" });
			setShowDiffView(true);
			setOverlay(null);
			setHover(null);
			setPeek(null);
		},
		[cwd, say, t],
	);

	// File history (🕘): commits that touched the open file, newest first.
	const openFileHistory = useCallback(() => {
		const d = docRef.current;
		if (!cwd || !d) return;
		const path = d.path;
		setFileHist({ path, busy: true });
		const repo = repoSelRef.current;
		api("git.history", repo ? { cwd, path, repo } : { cwd, path }).then((res) => {
			setFileHist((cur) => {
				if (!cur || cur.path !== path) return cur;
				if (!res.ok) return { path, error: res.error };
				if (res.value?.error) return { path, error: res.value.error };
				return { path, commits: res.value?.commits ?? [] };
			});
		});
	}, [cwd]);

	// Clicking a history row shows that commit's diff for this file only.
	const openHistCommit = useCallback(
		async (commit) => {
			const path = fileHist?.path;
			if (!cwd || !path || !commit?.hash) return;
			const repo = repoSelRef.current;
			const res = await api("git.diff", repo ? { cwd, path, scope: "commit", sha: commit.hash, repo } : { cwd, path, scope: "commit", sha: commit.hash });
			const value = res.ok ? res.value ?? {} : { error: res.error };
			if (value.error) {
				say(`${t("error")}: ${value.error}`, "error");
				return;
			}
			setFileHist(null);
			modeRef.current = "diff";
			setDiff({ path: `${commit.hash} · ${path}`, scope: "commit", commit: value.commit, text: value.diff ?? "" });
			setShowDiffView(true);
			setOverlay(null);
			setHover(null);
			setPeek(null);
		},
		[cwd, fileHist, say, t],
	);

	/* quick open (file picker) */

	const openPalette = useCallback(() => {
		if (!cwd) return;
		setPalette({ query: "", results: [], busy: true });
		api("search.files", { cwd, query: "", limit: 80 }).then((res) => {
			setPalette((p) => (p && p.query === "" ? { ...p, results: res.ok ? res.value.matches ?? [] : [], busy: false } : p));
		});
	}, [cwd]);

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
			api("search.text", { cwd, query, include: include || "", regex: opts?.regex === true, words: opts?.words === true }).then((res) => {
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

	const openSearch = useCallback(() => {
		setSearchOpen(true);
		setSearch((s) => s ?? { query: "", include: "", regex: false, words: false, results: undefined, engine: "", truncated: false, busy: false });
	}, []);

	// Debounced auto-search, VSCode-style, while the panel is open. Flag
	// toggles mutate the search object, so they retrigger this effect too.
	useEffect(() => {
		if (!searchOpen || !search) return undefined;
		const query = (search.query ?? "").trim();
		if (query.length < 2) {
			if (search.results !== undefined && !search.busy) return undefined;
			setSearch((s) => (s ? { ...s, results: [], engine: "", busy: false, error: undefined } : s));
			return undefined;
		}
		const timer = setTimeout(() => runSearchNow(search.query, search.include, search), 400);
		return () => clearTimeout(timer);
	}, [searchOpen, search, runSearchNow]);

	const onSearchPick = useCallback(
		(r) => {
			void openFile(r.path, r.line, 1);
			setSearchOpen(false);
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
	const startEdit = useCallback(() => {
		if (!doc || doc.truncated || doc.image) return;
		if (doc.raw.length > 2 * 1024 * 1024 || doc.lines.length > 50000) {
			say(t("editor.tooBig"), "error");
			return;
		}
		setEditText(doc.raw);
		setEditing(true);
	}, [doc, say, t]);
	const saveEdit = useCallback(() => {
		if (!doc || !editing) return;
		// baseMtime gives optimistic concurrency: the host refuses the write
		// when the file changed on disk since we loaded it.
		const payload = { cwd, path: doc.path, content: editText };
		if (typeof doc.mtimeMs === "number") payload.baseMtime = doc.mtimeMs;
		api("fs.write", payload).then((res) => {
			if (!res.ok) {
				say(/modified on disk/i.test(res.error ?? "") ? t("editor.conflict") : `${t("error")}: ${res.error}`, "error");
				return;
			}
			const lines = editText.split("\n");
			if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
			setDoc({ ...doc, lines, states: buildLineStates(lines, langFor(doc.path)), raw: editText, mtimeMs: res.value.mtimeMs ?? doc.mtimeMs });
			setEditing(false);
			say(t("editor.saved"));
		});
	}, [doc, editing, editText, cwd, say, t]);
	const cancelEdit = useCallback(() => setEditing(false), []);
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
	const onRootKeyDown = useCallback(
		(event) => {
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyF" && !event.shiftKey) {
				if (modeRef.current === "code" && docRef.current && !editing) {
					event.preventDefault();
					setFindOpen((v) => !v);
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
					setSymPalette({});
				}
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
			if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.code === "KeyG") {
				if (modeRef.current === "code" && docRef.current && !editing) {
					event.preventDefault();
					setGotoOpen((v) => !v);
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
		[palette, closePalette, openPalette, openSearch, searchOpen, peek, closePeek, goBack, goForward, symPalette, editing, saveEdit, cancelEdit, findOpen, delPreview, gotoOpen, toggleWrap, fileHist],
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

	const onEditorClick = useCallback(
		(event) => {
			const target = event.target?.closest?.("[data-ce-l]");
			setHover(null);
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
			if (mod) void doJump("definition", at);
			else void openPeek(word, at.line, at.col);
		},
		[doJump, openPeek, closePeek],
	);

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
		() => (wrapOn ? null : computeVisible({ doc, scroll, viewport, diagByLine, flash, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit, onDelPreview: setDelPreview })),
		[wrapOn, doc, scroll, viewport, diagByLine, flash, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit],
	);

	const gutter = useMemo(
		() => (wrapOn ? null : computeGutter({ doc, scroll, viewport, cursor, findLines, diffMarks, delAnchors })),
		[wrapOn, doc, scroll, viewport, cursor, findLines, diffMarks, delAnchors],
	);

	const wrapDoc = useMemo(
		() => (wrapOn ? computeWrapRows({ doc, flash, diffMarks, delAnchors, delGroups, cursor, findLines, t, onDelPreview: setDelPreview }) : null),
		[wrapOn, doc, flash, diffMarks, delAnchors, delGroups, cursor, findLines, t],
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
			if (!detail || typeof detail.text !== "string") return;
			setPeek(null);
			setOverlay(null);
			setHover(null);
			modeRef.current = "diff";
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
	}, []);

	if (!cwd) {
		return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
	}

	return h(
		"div",
		{ className: "ce-root", onKeyDown: onRootKeyDown },
		h(
			"div",
			{ className: "ce-toolbar" },
			h(
				"div",
				{ className: "ce-seg" },
				h("button", { type: "button", className: `ce-seg-btn${mode === "files" ? " ce-seg-on" : ""}`, onClick: () => setMode("files") }, t("toolbar.files")),
				h("button", { type: "button", className: `ce-seg-btn${mode === "changes" ? " ce-seg-on" : ""}`, onClick: () => { setMode("changes"); refreshGit(); } }, `${t("toolbar.changes")}${git?.repo ? ` · ${git.working.length}` : ""}`),
			),
			git?.repo
				? h(
					"button",
					{
						type: "button",
						className: "ce-branch",
						disabled: sync.busy,
						title: `${t("branch.title")}${git.upstream ? ` · ${git.upstream}${git.upstreamInferred ? " · auto" : ""}` : ""}`,
						onClick: () => setBranchPickOpen(true),
					},
					h("span", null, `⎇ ${git.branch}`),
					sync.busy ? h("span", { className: "ce-spin ce-ico" }, h(IconRefresh)) : null,
					!sync.busy && git.ahead > 0 ? h("span", { className: "ce-ab ce-ab-ahead" }, `↑${git.ahead}`) : null,
					!sync.busy && git.behind > 0 ? h("span", { className: "ce-ab ce-ab-behind" }, `↓${git.behind}`) : null,
				)
				: null,
			h("span", { className: "ce-spacer" }),
			h("button", { type: "button", className: "ce-tool", title: `${t("quickopen.placeholder")} (⌘P / Ctrl+P)`, onClick: openPalette }, h(IconSearch)),
			h("button", { type: "button", className: "ce-tool ce-workspace-search", title: `${t("search.workspaceHint")} (⇧⌘F / Ctrl+Shift+F)`, "aria-label": t("search.workspaceHint"), onClick: openSearch }, h(IconTextSearch), h("span", null, t("changes.searchWorkspace"))),
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
		h(
			"div",
			{ className: "ce-main", ref: mainRef },
			railVisible
				? h("div", { className: "ce-rail-wrap ce-rail-with-search", style: { width: `${railW}px` } },
					h("button", { type: "button", className: "ce-rail-search", title: `${t("search.workspaceHint")} (⇧⌘F / Ctrl+Shift+F)`, onClick: openSearch },
						h(IconTextSearch), h("span", null, t("changes.searchWorkspace")),
					),
					mode === "files"
					? h(TreePanel, {
						cwd,
						t,
						onOpenFile: (path, line, col) => void openFile(path, line, col),
						activePath: doc?.path ?? diff?.path,
						revealPath: doc?.path ?? null,
						refreshKey: treeKey,
						onNotify: (text, kind) => say(text, kind),
						onDeleted: (path) => {
							setTabs((prev) => prev.filter((p) => p !== path && !p.startsWith(`${path}/`)));
							const open = docRef.current?.path;
							if (open && (open === path || open.startsWith(`${path}/`))) {
								setDoc(null);
								setEditing(false);
								setDiffMarks(null);
							}
						},
					})
					: h(ChangesPanel, {
						cwd,
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
						onOpenDiff: (path, scope) => void (scope === "commit" ? openDiff(path, scope) : openChangeSource(path, scope)),
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
					}))
				: null,
			railVisible
				? h("div", { className: "ce-splitter", onMouseDown: startRailDrag, onDoubleClick: () => setRailVisible(false), title: "⇔ 拖动调宽 · 双击收起" })
				: h("button", { type: "button", className: "ce-rail-tab", title: "展开侧栏 (⌘B / Ctrl+B)", onClick: () => setRailVisible(true) }, "▸"),
			h(
				"div",
				{ className: "ce-editor" },
				tabs.length > 0
					? h("div", { className: "ce-tabs", ref: tabsRef },
						tabs.map((p) => {
							const active = doc?.path === p && (!diff || !showDiffView);
							const dirty = active && editing && editText !== (doc?.raw ?? "");
							return h(
								"div",
								{
									key: p,
									className: `ce-tab${active ? " ce-tab-active" : ""}`,
									title: RelPath(cwd, p) || p,
									onClick: () => switchTab(p),
									onAuxClick: (e) => {
										if (e.button === 1) {
											e.preventDefault();
											closeTab(p);
										}
									},
								},
								h("span", { className: `ce-tab-dot${dirty ? " ce-tab-dirty" : ""}` }, dirty ? "●" : ""),
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
							editing ? h("button", { type: "button", className: "ce-link", onClick: saveEdit }, t("editor.save")) : null,
							editing ? h("button", { type: "button", className: "ce-link", onClick: cancelEdit }, t("editor.cancel")) : null,
							editing && editText !== (doc?.raw ?? "") ? h("span", { className: "ce-chip ce-chip-warn" }, t("editor.dirty")) : null,
							doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${findOpen ? " ce-tool-on" : ""}`, title: `${t("editor.find")} (⌘F / Ctrl+F)`, onClick: () => setFindOpen((v) => !v) }, "⌕") : null,
							doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${wrapOn ? " ce-tool-on" : ""}`, title: `${t("editor.wrap")} (⌥Z / Alt+Z)`, onClick: toggleWrap }, "↩") : null,
							doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${blameOn ? " ce-tool-on" : ""}`, title: t("blame.toggle"), disabled: wrapOn, onClick: () => { setBlameOn((v) => !v); setBlame(null); } }, "B") : null,
							doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${fileHist ? " ce-tool-on" : ""}`, title: t("history.title"), onClick: openFileHistory }, "🕘") : null,
							h("span", { className: "ce-spacer" }),
							cursor ? h("button", { type: "button", className: "ce-pos ce-pos-btn", title: t("goto.title"), onClick: () => setGotoOpen(true) }, `Ln ${cursor.line}, Col ${cursor.col}${cursor.word ? ` · ${cursor.word}` : ""}`) : null,
							diagnostics.length ? h("span", { className: "ce-diag" }, `${diagnostics.length} ${t("diag.count")}`) : null,
						),
						findOpen && !editing ? h("div", { className: "ce-find" },
							h("input", {
								className: "ce-input ce-find-input",
								placeholder: t("editor.findPlaceholder"),
								value: findQuery,
								autoFocus: true,
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
							findRe === false
								? h("span", { className: "ce-find-count cea-err" }, t("find.badRegex"))
								: h("span", { className: "ce-find-count" }, findQuery ? `${findMatches.length === 0 ? 0 : Math.min(findIdx + 1, findMatches.length)}/${findMatches.length}` : ""),
							h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => jumpFind(-1) }, "↑"),
							h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => jumpFind(1) }, "↓"),
							h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setFindOpen(false) }, "✕"),
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
								? h("textarea", { className: `ce-edit-ta${wrapOn ? " ce-edit-ta-wrap" : ""}`, value: editText, spellcheck: false, onChange: (e) => setEditText(e.target.value) })
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
									onScroll: (event) => setScroll(event.currentTarget.scrollTop),
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
							symPalette ? h(SymbolPalette, { t, symbols, onPick: (s) => { setSymPalette(null); revealPosition(s.line, s.col, s.name); }, onClose: () => setSymPalette(null) }) : null,
							delPreview
								? h("div", { className: "ce-overlay" },
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
				searchOpen && search ? h(SearchPanel, {
					t,
					cwd,
					state: search,
					onQuery: (q) => setSearch((s) => (s ? { ...s, query: q } : s)),
					onInclude: (v) => setSearch((s) => (s ? { ...s, include: v } : s)),
					onToggleRegex: () => setSearch((s) => (s ? { ...s, regex: !s.regex } : s)),
					onToggleWords: () => setSearch((s) => (s ? { ...s, words: !s.words } : s)),
					onSubmit: () => runSearchNow(search.query, search.include, search),
					onPick: onSearchPick,
					onClose: () => setSearchOpen(false),
					onNotify: (text, kind) => say(text, kind),
				}) : null,
			),
		),
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
