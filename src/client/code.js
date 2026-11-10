/* ---------------- Code tab: stateful orchestrator (toolbar, rail, editor, diff, status) ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { ROW } from "./constants.js";
import { api } from "./api.js";
import { buildLineStates, wordAt } from "./highlight.js";
import { IconArrowLeft, IconArrowRight, IconCode, IconRefresh, IconSearch, IconTextSearch } from "./icons.js";
import { DiffView, changedNewLines, deletedGroups, changeBlobs } from "./diff.js";
import { MarkdownView } from "./markdown.js";
import { BranchPalette } from "./branchpick.js";
import { RelPath, toAbs } from "./pathtools.js";
import { TreePanel } from "./tree.js";
import { ChangesPanel } from "./changes.js";
import { LocationList, QuickOpen, SearchPanel, RefsPeek, SymbolPalette } from "./overlays.js";
import { computeGutter, computeVisible } from "./codeview.js";

/** Files that open in rendered preview by default: markdown and html. */
const PREVIEW_RE = /\.(md|markdown|html?)$/i;
const MD_RE = /\.(md|markdown)$/i;

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
	const [diffMarks, setDiffMarks] = useState(null);
	const [branchPickOpen, setBranchPickOpen] = useState(false);
	const [blameOn, setBlameOn] = useState(false);
	const [blame, setBlame] = useState(null);
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
	const saveTimer = useRef(null);
	const restoredFor = useRef(null);

	const codeRef = useRef(null);
	const mainRef = useRef(null);
	const histRef = useRef({ back: [], forward: [] });
	const [histTick, setHistTick] = useState(0);
	const docRef = useRef(null);
	const cursorRef = useRef(null);
	const modeRef = useRef("code"); // code | diff
	const openSeqRef = useRef(0);
	const noticeTimer = useRef(null);
	const latestPersistRef = useRef(null);
	const peekRef = useRef(null);

	docRef.current = doc;
	cursorRef.current = cursor;
	peekRef.current = peek;

	const say = useCallback((text, kind = "info") => {
		setNotice({ text, kind });
		if (noticeTimer.current) clearTimeout(noticeTimer.current);
		if (kind !== "error") noticeTimer.current = setTimeout(() => setNotice({ text: "", kind: "info" }), 3800);
	}, []);

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

	const [sync, setSync] = useState({ busy: false });
	const [repos, setRepos] = useState(null); // [{root, branch, dirtyCount}]
	const [repoSel, setRepoSel] = useState(null); // absolute root when the cwd is not a repo
	const repoSelRef = useRef(null);

	const fetchDiagnostics = useCallback((path, seq) => {
		if (!cwd || !path.endsWith(".go")) return;
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
		async (path, line, col, mark) => {
			if (!cwd) return null;
			const res = await api("fs.read", { cwd, path });
			if (!res.ok) {
				say(`${t("error")}: ${res.error}`, "error");
				return null;
			}
			if (res.value.kind !== "text") {
				say(t("binary"), "error");
				return null;
			}
			const text = res.value.content;
			const lines = text.split("\n");
			if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
			const entry = { path, lines, states: buildLineStates(lines), truncated: res.value.truncated, raw: text };
			const seq = ++openSeqRef.current;
			peekNonce.current++;
			setPeek(null);
			setEditing(false);
			setDiffMarks(null);
			setDelGroups(null);
			setDelPreview(null);
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
			if (path.endsWith(".go")) {
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
			// reveal after layout; mark drives the exact-token highlight
			const markLine = mark?.line ?? clampLine;
			requestAnimationFrame(() => {
				const area = codeRef.current;
				if (!area) return;
				const target = (Math.max(1, markLine) - 1) * ROW - area.clientHeight / 2;
				area.scrollTop = Math.max(0, target);
				setScroll(area.scrollTop);
				setFlash({ line: markLine, col: mark?.col, word: mark?.word });
				setTimeout(() => setFlash((f) => (f && f.line === markLine ? null : f)), 1800);
			});
			return entry;
		},
		[cwd, fetchDiagnostics, say, t],
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

	const doFetch = useCallback(async () => {
		if (!cwd || sync.busy) return;
		setSync({ busy: true });
		say(t("sync.fetching"));
		const res = await api("git.fetch", repoSelRef.current ? { cwd, repo: repoSelRef.current } : { cwd });
		setSync({ busy: false });
		if (!res.ok) {
			say(t("sync.fetchFail", { msg: res.error }), "error");
			return;
		}
		const st = res.value?.status;
		if (st) setGit(st);
		if (res.value?.error) {
			say(t("sync.fetchFail", { msg: res.value.error }), "error");
			return;
		}
		if (!st || !st.repo) return;
		say(st.behind > 0 ? t("sync.behind", { n: st.behind }) : st.ahead > 0 ? t("sync.localAhead", { n: st.ahead }) : t("sync.upToDate"));
	}, [cwd, sync.busy, say, t]);

	const doPull = useCallback(async () => {
		if (!cwd || sync.busy) return;
		setSync({ busy: true });
		say(t("sync.pulling"));
		const before = git?.behind ?? 0;
		const res = await api("git.pull", repoSelRef.current ? { cwd, repo: repoSelRef.current } : { cwd });
		setSync({ busy: false });
		if (!res.ok) {
			say(t("sync.pullFail", { msg: res.error }), "error");
			return;
		}
		const value = res.value ?? {};
		if (value.status) setGit(value.status);
		if (value.error) {
			const st = value.status;
			if (st && st.ahead > 0 && st.behind > 0) say(t("sync.diverged"), "error");
			else say(t("sync.pullFail", { msg: value.error }), "error");
			return;
		}
		if (/Already up to date/i.test(value.output ?? "")) {
			say(t("sync.upToDate"));
			return;
		}
		const n = value.behindBefore ?? before;
		say(n ? t("sync.pulled", { n }) : t("sync.upToDate"));
		const cur = docRef.current;
		if (cur && modeRef.current === "code") {
			const c = cursorRef.current;
			void loadFile(cur.path, c?.line ?? 1, c?.col ?? 1);
		}
	}, [cwd, sync.busy, git, say, t, loadFile]);

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

	/* P0-1: per-session navigation state survives tab churn */
	useEffect(() => {
		if (!persistKey || !cwd || restoredFor.current === persistKey) return;
		restoredFor.current = persistKey;
		let blob = null;
		try {
			blob = JSON.parse(localStorage.getItem(persistKey) || "null");
		} catch {}
		if (!blob) return;
		if (Number.isFinite(blob.railW)) setRailW(Math.max(150, Math.min(760, blob.railW)));
		if (typeof blob.railVisible === "boolean") setRailVisible(blob.railVisible);
		if (typeof blob.mode === "string") setMode(blob.mode === "skills" ? "files" : blob.mode);
		if (blob.path && !docRef.current) {
			histRef.current = { back: Array.isArray(blob.back) ? blob.back : [], forward: Array.isArray(blob.forward) ? blob.forward : [] };
			setHistTick((v) => v + 1);
			void loadFile(blob.path, blob.line ?? 1, blob.col ?? 1, null).then(() => {
				if (Number.isFinite(blob.scroll) && codeRef.current) {
					codeRef.current.scrollTop = blob.scroll;
					setScroll(blob.scroll);
				}
			});
		}
	}, [persistKey, cwd, loadFile]);

	useEffect(() => {
		if (!persistKey) return;
		const payload = {
			path: doc?.path,
			line: cursor?.line,
			col: cursor?.col,
			scroll,
			mode,
			railW,
			railVisible,
			back: histRef.current.back.slice(-40),
			forward: histRef.current.forward.slice(-40),
		};
		latestPersistRef.current = { key: persistKey, payload };
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			try {
				localStorage.setItem(persistKey, JSON.stringify(payload));
			} catch {}
		}, 700);
	}, [persistKey, doc, cursor, scroll, mode, railW, railVisible, histTick]);

	useEffect(() => () => {
		if (saveTimer.current) clearTimeout(saveTimer.current);
		const last = latestPersistRef.current;
		if (last) {
			try {
				localStorage.setItem(last.key, JSON.stringify(last.payload));
			} catch {}
		}
	}, []);

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
		const area = codeRef.current;
		if (area) {
			area.scrollTop = Math.max(0, (line - 1) * ROW - area.clientHeight / 2);
			setScroll(area.scrollTop);
			area.focus({ preventScroll: true });
		}
	}, []);

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
		setDiff({ path, scope, text, base: res.ok ? res.value.base : void 0 });
		setShowDiffView(false);
		modeRef.current = "code";
		await loadFile(path, first, 1);
		setDiffMarks(marks);
		setDelGroups(deletedGroups(text));
	}, [cwd, loadFile]);
	// Revert one working-tree change: tracked files restore HEAD, staged adds
	// unstage. Never deletes anything; the open doc reloads afterwards.
	const discardChange = useCallback(async (item) => {
		if (!cwd) return;
		const repo = repoSelRef.current;
		const res = await api("git.discard", repo ? { cwd, path: item.path, repo, ch: item.ch } : { cwd, path: item.path, ch: item.ch });
		if (!res.ok) {
			say(`${t("error")}: ${res.error}`, "error");
			return;
		}
		say(t("changes.discarded"));
		refreshGit();
		if (docRef.current?.path === item.path) void loadFile(item.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
	}, [cwd, say, t, refreshGit, loadFile]);
	// VSCode-style folder discard: revert every change under one directory.
	const discardMany = useCallback(async (dirItems) => {
		if (!cwd || !Array.isArray(dirItems) || dirItems.length === 0) return;
		const repo = repoSelRef.current;
		let okCount = 0;
		const errors = [];
		for (const item of dirItems) {
			const res = await api("git.discard", repo ? { cwd, path: item.path, repo, ch: item.ch } : { cwd, path: item.path, ch: item.ch });
			if (res.ok && !res.value?.error) okCount += 1;
			else errors.push(`${item.path}: ${res.value?.error ?? res.error}`);
		}
		if (okCount > 0) say(t("changes.discardedN", { n: okCount }));
		if (errors.length > 0) say(`${t("error")}: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1})` : ""}`, "error");
		refreshGit();
		const openPath = docRef.current?.path;
		if (openPath && dirItems.some((i) => i.path === openPath)) void loadFile(openPath, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
	}, [cwd, say, t, refreshGit, loadFile]);
	// Stage / unstage one path or a whole directory ("" = whole repo). Rows
	// moving between the Staged/Changes sections is the feedback; only errors
	// raise a notice.
	const stageChange = useCallback(async (path) => {
		if (!cwd) return false;
		const repo = repoSelRef.current;
		const res = await api("git.stage", repo ? { cwd, path, repo } : { cwd, path });
		if (!res.ok || res.value?.error) {
			say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
			return false;
		}
		if (res.value.status) setGit(res.value.status);
		return true;
	}, [cwd, say, t]);
	const unstageChange = useCallback(async (path) => {
		if (!cwd) return false;
		const repo = repoSelRef.current;
		const res = await api("git.unstage", repo ? { cwd, path, repo } : { cwd, path });
		if (!res.ok || res.value?.error) {
			say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
			return false;
		}
		if (res.value.status) setGit(res.value.status);
		return true;
	}, [cwd, say, t]);
	const [committing, setCommitting] = useState(false);
	// Commit the staged set; when nothing is staged the panel asks for a
	// "stage all & commit" instead (stageAll), done here as two calls.
	const commitChanges = useCallback(async (message, stageAll) => {
		if (!cwd || committing) return false;
		setCommitting(true);
		try {
			const repo = repoSelRef.current;
			if (stageAll) {
				const sres = await api("git.stage", repo ? { cwd, path: "", repo } : { cwd, path: "" });
				if (!sres.ok || sres.value?.error) {
					say(`${t("error")}: ${sres.value?.error ?? sres.error}`, "error");
					return false;
				}
				if (sres.value.status) setGit(sres.value.status);
			}
			const res = await api("git.commit", repo ? { cwd, message, repo } : { cwd, message });
			const value = res.ok ? res.value ?? {} : { error: res.error };
			if (value.status) setGit(value.status);
			if (!res.ok || value.error) {
				say(`${t("error")}: ${value.error ?? res.error}`, "error");
				return false;
			}
			say(t("changes.committed", { c: value.commit ?? "" }));
			return true;
		} finally {
			setCommitting(false);
		}
	}, [cwd, committing, say, t]);
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
		(query, include) => {
			if (!cwd) return;
			const nonce = ++searchNonce.current;
			setSearch((s) => (s ? { ...s, busy: true, error: undefined } : s));
			api("search.text", { cwd, query, include: include || "" }).then((res) => {
				if (searchNonce.current !== nonce) return;
				setSearch((s) => {
					if (!s) return s;
					if (!res.ok) return { ...s, results: [], busy: false, error: res.error };
					return { ...s, results: res.value.results ?? [], engine: res.value.engine ?? "", truncated: res.value.truncated === true, timedOut: res.value.timedOut === true, busy: false };
				});
			});
		},
		[cwd],
	);

	const openSearch = useCallback(() => {
		setSearchOpen(true);
		setSearch((s) => s ?? { query: "", include: "", results: undefined, engine: "", truncated: false, busy: false });
	}, []);

	// Debounced auto-search, VSCode-style, while the panel is open.
	useEffect(() => {
		if (!searchOpen || !search) return undefined;
		const query = (search.query ?? "").trim();
		if (query.length < 2) {
			if (search.results !== undefined && !search.busy) return undefined;
			setSearch((s) => (s ? { ...s, results: [], engine: "", busy: false, error: undefined } : s));
			return undefined;
		}
		const timer = setTimeout(() => runSearchNow(search.query, search.include), 400);
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
			if (!cwd || !docRef.current?.path.endsWith(".go")) return;
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

	const findMatches = useMemo(() => {
		if (!doc || !findQuery) return [];
		const out = [];
		for (let i = 0; i < doc.lines.length && out.length < 2000; i++) {
			let at = doc.lines[i].indexOf(findQuery);
			while (at !== -1 && out.length < 2000) {
				out.push({ line: i + 1, col: at + 1 });
				at = doc.lines[i].indexOf(findQuery, at + findQuery.length);
			}
		}
		return out;
	}, [doc, findQuery]);
	const findLines = useMemo(() => new Set(findMatches.map((m) => m.line)), [findMatches]);
	const jumpFind = useCallback((delta) => {
		if (findMatches.length === 0) return;
		const next = (findIdx + delta + findMatches.length) % findMatches.length;
		setFindIdx(next);
		const m = findMatches[next];
		setCursor((c) => ({ line: m.line, col: m.col, word: c?.word ?? "" }));
		const area = codeRef.current;
		if (area) {
			area.scrollTop = Math.max(0, (m.line - 1) * ROW - area.clientHeight / 2);
			setScroll(area.scrollTop);
		}
		setFlash({ line: m.line, col: m.col, word: findQuery });
		setTimeout(() => setFlash((f) => (f && f.line === m.line ? null : f)), 1200);
	}, [findMatches, findIdx, findQuery]);
	const startEdit = useCallback(() => {
		if (!doc || doc.truncated) return;
		if (doc.raw.length > 2 * 1024 * 1024 || doc.lines.length > 50000) {
			say(t("editor.tooBig"), "error");
			return;
		}
		setEditText(doc.raw);
		setEditing(true);
	}, [doc, say, t]);
	const saveEdit = useCallback(() => {
		if (!doc || !editing) return;
		api("fs.write", { cwd, path: doc.path, content: editText }).then((res) => {
			if (!res.ok) {
				say(`${t("error")}: ${res.error}`, "error");
				return;
			}
			const lines = editText.split("\n");
			if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
			setDoc({ ...doc, lines, states: buildLineStates(lines), raw: editText });
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
		const needLoad = !docRef.current || docRef.current.path !== path;
		const ready = needLoad ? loadFile(path, first, 1) : Promise.resolve();
		void ready.then(() => {
			setDiffMarks(marks);
			setDelGroups(deletedGroups(diff.text));
			if (!needLoad) revealPosition(first, 1, void 0);
		});
	}, [diff, loadFile, revealPosition]);
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
				if (docRef.current?.path.endsWith(".go")) {
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
			if (event.key === "Escape") {
				if (editing) {
					cancelEdit();
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
		[palette, closePalette, openPalette, openSearch, searchOpen, peek, closePeek, goBack, goForward, symPalette, editing, saveEdit, cancelEdit, findOpen, delPreview],
	);

	const doJump = useCallback(
		async (kind, pos) => {
			if (!cwd || !docRef.current || !docRef.current.path.endsWith(".go")) return;
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
			if (!target || !docRef.current) return;
			const line = Number(target.dataset.ceL);
			const col = Number(target.dataset.ceC);
			const text = docRef.current.lines[line - 1] ?? "";
			const hit = wordAt(text, col);
			const word = hit?.word ?? target.dataset.ceW ?? "";
			const at = { line, col: hit?.col ?? col };
			setCursor({ line: at.line, col: at.col, word });
			if (codeRef.current) codeRef.current.focus({ preventScroll: true });
			if (!docRef.current.path.endsWith(".go") || !word) {
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
		[doJump, openPeek],
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
	}, []);

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
		const area = codeRef.current;
		setCursor((c) => ({ line, col: 1, word: c?.word ?? "" }));
		if (area) {
			area.scrollTop = Math.max(0, (line - 1) * ROW - area.clientHeight / 2);
			setScroll(area.scrollTop);
		}
		setFlash({ line, col: 1, word: "" });
		setTimeout(() => setFlash((f) => (f && f.line === line ? null : f)), 1200);
	}, []);
	// Row building lives in codeview.js as pure functions; the memos only wire state.
	const visible = useMemo(
		() => computeVisible({ doc, scroll, viewport, diagByLine, flash, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit, onDelPreview: setDelPreview }),
		[doc, scroll, viewport, diagByLine, flash, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit],
	);

	const gutter = useMemo(
		() => computeGutter({ doc, scroll, viewport, cursor, findLines, diffMarks, delAnchors }),
		[doc, scroll, viewport, cursor, findLines, diffMarks, delAnchors],
	);

	const statusTitle = (status.state === "error" ? `${t("status.error")}: ${status.message}` : status.state === "starting" ? t("status.starting") : status.state === "ready" ? t("status.ready") : t("status.off")) + (status.progress ? ` · ${status.progress}` : "");
	const previewActive = previewOn && doc !== null && PREVIEW_RE.test(doc.path);
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
			h("button", { type: "button", className: "ce-tool", title: `${t("toolbar.search")} (⇧⌘F / Ctrl+Shift+F)`, onClick: openSearch }, h(IconTextSearch)),
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
				? h("div", { className: "ce-rail-wrap", style: { width: `${railW}px` } }, mode === "files"
					? h(TreePanel, {
						cwd,
						t,
						onOpenFile: (path, line, col) => void openFile(path, line, col),
						activePath: doc?.path ?? diff?.path,
						refreshKey: treeKey,
						onNotify: (text, kind) => say(text, kind),
						onDeleted: (path) => {
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
						onCommit: (msg, stageAll) => commitChanges(msg, stageAll),
						committing,
						refresh: refreshGit,
					}))
				: null,
			railVisible
				? h("div", { className: "ce-splitter", onMouseDown: startRailDrag, onDoubleClick: () => setRailVisible(false), title: "⇔ 拖动调宽 · 双击收起" })
				: h("button", { type: "button", className: "ce-rail-tab", title: "展开侧栏 (⌘B / Ctrl+B)", onClick: () => setRailVisible(true) }, "▸"),
			h(
				"div",
				{ className: "ce-editor" },
				diff && showDiffView
					? h(DiffView, {
						t,
						diff,
						onClose: () => { setDiff(null); if (docRef.current) modeRef.current = "code"; },
						onOpenSource: (line) => openDiffSource(line),
						canSource: diff.scope === "working" || diff.scope === "branch",
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
									{ type: "button", className: "ce-crumb", title: `${t("symbols.crumb")} (⌘⇧O)`, onClick: () => doc.path.endsWith(".go") && setSymPalette({}) },
									`› ${currentSymbol.name}`,
								)
								: null,
							doc.path.endsWith(".go") ? h("span", { className: "ce-chip" }, t("editor.lang.go")) : null,
							diffMarks
								? h("button", { type: "button", className: "ce-chip ce-chip-mark", title: t("diff.marksClear"), onClick: () => setDiffMarks(null) }, `${t("diff.marksChip")} ${diffMarks.size}`)
								: null,
							diff && !showDiffView && (diff.scope === "working" || diff.scope === "branch")
								? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("diff.showHunks"), onClick: () => setShowDiffView(true) }, "≡")
								: null,
							doc.truncated ? h("span", { className: "ce-chip" }, t("truncated")) : null,
							doc && !diff && PREVIEW_RE.test(doc.path)
								? h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("editor.previewToggle"), onClick: () => setPreviewOn((v) => !v) }, previewOn ? t("editor.raw") : t("editor.preview"))
								: null,
							doc && !diff && !editing ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("editor.edit"), onClick: startEdit }, "✎") : null,
							editing ? h("button", { type: "button", className: "ce-link", onClick: saveEdit }, t("editor.save")) : null,
							editing ? h("button", { type: "button", className: "ce-link", onClick: cancelEdit }, t("editor.cancel")) : null,
							editing && editText !== (doc?.raw ?? "") ? h("span", { className: "ce-chip ce-chip-warn" }, t("editor.dirty")) : null,
							doc && !diff ? h("button", { type: "button", className: `ce-tool ce-tiny${findOpen ? " ce-tool-on" : ""}`, title: `${t("editor.find")} (⌘F / Ctrl+F)`, onClick: () => setFindOpen((v) => !v) }, "⌕") : null,
							doc && !diff ? h("button", { type: "button", className: `ce-tool ce-tiny${blameOn ? " ce-tool-on" : ""}`, title: t("blame.toggle"), onClick: () => { setBlameOn((v) => !v); setBlame(null); } }, "B") : null,
							h("span", { className: "ce-spacer" }),
							cursor ? h("span", { className: "ce-pos" }, `Ln ${cursor.line}, Col ${cursor.col}${cursor.word ? ` · ${cursor.word}` : ""}`) : null,
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
							h("span", { className: "ce-find-count" }, findQuery ? `${findMatches.length === 0 ? 0 : Math.min(findIdx + 1, findMatches.length)}/${findMatches.length}` : ""),
							h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => jumpFind(-1) }, "↑"),
							h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => jumpFind(1) }, "↓"),
							h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setFindOpen(false) }, "✕"),
						) : null,
						h(
							"div",
							{ className: "ce-code-wrap" },
							editing
								? h("textarea", { className: "ce-edit-ta", value: editText, spellcheck: false, onChange: (e) => setEditText(e.target.value) })
								: previewActive
									? (MD_RE.test(doc.path)
										? h(MarkdownView, { text: doc.raw })
										: h("iframe", { className: "ce-htmlprev", sandbox: "", srcDoc: doc.raw, title: doc.path }))
									: h(
										Fragment,
										null,
										blameOn && blame !== null ? h("div", { className: "ce-blame" }, visible?.blameRows) : null,
										h("div", { className: "ce-gutter" }, h("div", { className: "ce-gutter-inner", style: { transform: `translateY(${-scroll}px)` } }, gutter)),
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
								h("div", { className: "ce-code-inner", style: { height: `${visible?.total ?? (doc.lines.length + 2) * ROW}px` } }, visible?.rows),
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
				searchOpen && search ? h(SearchPanel, {
					t,
					cwd,
					state: search,
					onQuery: (q) => setSearch((s) => (s ? { ...s, query: q } : s)),
					onInclude: (v) => setSearch((s) => (s ? { ...s, include: v } : s)),
					onSubmit: () => runSearchNow(search.query, search.include),
					onPick: onSearchPick,
					onClose: () => setSearchOpen(false),
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
			h("span", null, notice.kind === "info" ? notice.text || (doc && !diagnostics.length && doc.path.endsWith(".go") ? t("nodiag") : "") : ""),
			h("span", { className: "ce-spacer" }),
			h("span", { className: "ce-prog" }, status.progress || (status.state === "error" ? "gopls ✕" : status.state === "ready" ? "gopls ✓" : status.state === "starting" ? "gopls …" : "")),
		),
	);
}

export function CodeTitle({ useTabInfo }) {
	const tabInfo = useTabInfo ? useTabInfo() : null;
	return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(IconCode)), tabInfo?.tab?.title ?? "Code");
}
