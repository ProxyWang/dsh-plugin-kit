/**
 * Client half of @local/dsh-code-explorer: a "Code" tab type in the Harness
 * right sidebar.
 *
 * - 文件树：逐层展开工作区目录（fs.list / fs.read 走本包 Host 半区的私有路由）。
 * - 编辑器：虚拟滚动的代码视图，Go 语法着色、gopls 转到定义 / 引用 / 悬停文档、
 *   前进后退导航栈（VSCode 行为：点击或 ⌘/Ctrl+点击跳转，F12 / ⇧F12，
 *   Alt+←/→ 与 ⌃-/⌃⇧- 后退前进）。
 * - 变更：当前分支变更列表（git status vs HEAD + 相对基线分支的已提交变更），
 *   点击文件看 unified diff。
 *
 * 样式使用宿主 --dsw-alias-* 主题 token；不依赖任何其它 Harness 包。
 */

window.__ModuleLoader__.load({
	id: "@local/dsh-code-explorer",
	factory(require) {
		const React = require("react");
		const { createElement: h, Fragment, useState, useEffect, useRef, useCallback, useMemo } = React;

		const NS = "codeExplorer";
		const API = "/code-explorer/api";
		const TAB_ID = "@local/dsh-code-explorer";
		const TAB_KIND = "code";
		const ROW = 22;

		/* ---------------- locale ---------------- */

		const zh = {
			"type.label": "代码",
			"guide.title": "代码浏览器",
			"guide.description": "工作区代码浏览、当前分支变更、gopls 跳转定义/引用",
			"toolbar.files": "文件",
			"toolbar.changes": "变更",
			refresh: "刷新",
			"clickJump.on": "点击弹引用：开（⌘点击直接跳定义）",
			"clickJump.off": "点击弹引用：关（⌥/⌘点击打开）",
			back: "后退 (⌘[)",
			forward: "前进 (⌘])",
			"status.ready": "gopls 就绪",
			"status.starting": "gopls 启动中…",
			"status.off": "gopls 未启动",
			"status.error": "gopls 错误",
			binary: "二进制文件，无法预览",
			truncated: "文件过大，已截断显示",
			"changes.working": "工作区变更（相对 HEAD）",
			"changes.branch": "分支已提交变更",
			"changes.commits": "提交",
			"changes.none": "没有变更",
			"changes.notRepo": "当前工作区不是 Git 仓库",
			"changes.baseNone": "未检测到基线分支（main/master/origin/HEAD）",
			"changes.vs": "vs",
			"changes.pickRepo": "选择仓库…",
			loading: "加载中…",
			error: "失败",
			"tree.failed": "无法读取目录",
			"tree.empty": "空目录",
			"editor.placeholder": "从左侧文件树选择文件，或在“变更”中查看 diff",
			"editor.noSession": "没有可用会话：代码浏览器需要当前会话的工作目录。",
			"jump.noCursor": "先点击一个标识符（函数/变量/类型），再触发跳转",
			"jump.noTarget": "gopls：未找到定义",
			"jump.busy": "gopls 正在索引，稍后重试…",
			"jump.peekTitle": "定义",
			"jump.refsTitle": "引用",
			"jump.implTitle": "实现",
			"jump.typeTitle": "类型定义",
			nodiag: "无诊断",
			"diag.count": "诊断",
			"diff.scopeWorking": "工作区",
			"diff.scopeBranch": "分支",
			"diff.untracked": "未跟踪的新文件",
			"diff.deleted": "已删除",
			"diff.empty": "无差异内容",
			"hover.loading": "…",
			"editor.lang.go": "Go · gopls",
			close: "关闭",
			"shortcut.noSession": "请先选择会话",
			"toolbar.search": "查询",
			"quickopen.placeholder": "输入文件名以选择（模糊匹配）",
			"quickopen.empty": "无匹配文件",
			"quickopen.loading": "索引中…",
			"search.placeholder": "全文搜索",
			"search.include": "文件过滤，如 *.go",
			"search.run": "搜索",
			"search.empty": "输入至少 2 个字符",
			"search.none": "无结果",
			"search.results": "个结果",
			"search.engine": "引擎",
			"search.truncated": "结果过多，已截断",
			"search.searching": "搜索中…",
			"search.failed": "搜索失败",
			"peek.defs": "定义",
			"peek.refs": "引用",
			"peek.tagDef": "声明",
			"peek.empty": "gopls：未找到定义或引用",
			"peek.hint": "↑↓ 选择 · Enter 跳转 · Esc 关闭",
			"sync.fetching": "正在 fetch 远程…",
			"sync.pulling": "正在拉取（--ff-only）…",
			"sync.upToDate": "已与远程同步 ✓",
			"sync.behind": "落后 {n} 个提交 — 再点一次拉取",
			"sync.pulled": "已快进更新 {n} 个提交 ✓",
			"sync.pullFail": "拉取失败：{msg}",
			"sync.fetchFail": "fetch 失败：{msg}",
			"sync.noUpstream": "尚无上游分支；点击后 fetch 并自动关联",
			"sync.clickFetch": "点击 fetch，检查远程更新",
			"sync.clickPull": "点击拉取 {n} 个提交（仅快进，不分叉合并）",
			"sync.localAhead": "本地领先 {n}，远程无新提交",
			"sync.detached": "分离 HEAD，不能拉取",
			"sync.diverged": "本地与远程已分叉：未做任何修改（本面板只做快进拉取，请用「变更」视图核对后自行 rebase/merge）",
			"symbols.placeholder": "跳转到符号（函数 / 类型）",
			"symbols.none": "无匹配符号（gopls 可能仍在索引）",
			"symbols.crumb": "当前符号 — 打开符号列表",
			"diff.scopeCommit": "提交",
			"diff.back": "返回文件",
			"changes.commitsToggle": "展开 / 收起提交列表",
			"quickopen.command": "快速打开文件（代码浏览器）",
		};
		const en = {
			"type.label": "Code",
			"guide.title": "Code Explorer",
			"guide.description": "Workspace browsing, branch changes, gopls definition/reference jumps",
			"toolbar.files": "Files",
			"toolbar.changes": "Changes",
			refresh: "Refresh",
			"clickJump.on": "Click pops references: on (⌘-click jumps to definition)",
			"clickJump.off": "Click pops references: off (⌥/⌘-click opens it)",
			back: "Back (⌘[)",
			forward: "Forward (⌘])",
			"status.ready": "gopls ready",
			"status.starting": "starting gopls…",
			"status.off": "gopls not started",
			"status.error": "gopls error",
			binary: "Binary file, no preview",
			truncated: "File too large; display truncated",
			"changes.working": "Working tree (vs HEAD)",
			"changes.branch": "Committed on branch",
			"changes.commits": "commits",
			"changes.none": "No changes",
			"changes.notRepo": "Not a Git repository",
			"changes.baseNone": "No base branch detected (main/master/origin/HEAD)",
			"changes.vs": "vs",
			"changes.pickRepo": "Pick repository…",
			loading: "Loading…",
			error: "Failed",
			"tree.failed": "Cannot list directory",
			"tree.empty": "Empty directory",
			"editor.placeholder": "Pick a file in the tree, or open a diff under Changes",
			"editor.noSession": "No session: the code explorer needs the current session workspace.",
			"jump.noCursor": "Click an identifier first, then jump",
			"jump.noTarget": "gopls: no definition found",
			"jump.busy": "gopls is indexing; retry shortly…",
			"jump.peekTitle": "Definition",
			"jump.refsTitle": "References",
			"jump.implTitle": "Implementation",
			"jump.typeTitle": "Type definition",
			nodiag: "No diagnostics",
			"diag.count": "diagnostics",
			"diff.scopeWorking": "Working",
			"diff.scopeBranch": "Branch",
			"diff.untracked": "untracked new file",
			"diff.deleted": "deleted",
			"diff.empty": "No diff content",
			"hover.loading": "…",
			"editor.lang.go": "Go · gopls",
			close: "Close",
			"shortcut.noSession": "Select a session first",
			"toolbar.search": "Search",
			"quickopen.placeholder": "Type a file name to open (fuzzy)",
			"quickopen.empty": "No matching files",
			"quickopen.loading": "Indexing…",
			"search.placeholder": "Search across files",
			"search.include": "files filter, e.g. *.go",
			"search.run": "Search",
			"search.empty": "Type at least 2 characters",
			"search.none": "No results",
			"search.results": "results",
			"search.engine": "engine",
			"search.truncated": "Too many results; truncated",
			"search.searching": "Searching…",
			"search.failed": "Search failed",
			"peek.defs": "definition",
			"peek.refs": "references",
			"peek.tagDef": "decl",
			"peek.empty": "gopls: no definition or references found",
			"peek.hint": "↑↓ select · Enter jump · Esc close",
			"sync.fetching": "fetching remote…",
			"sync.pulling": "pulling (--ff-only)…",
			"sync.upToDate": "Up to date with remote ✓",
			"sync.behind": "Behind by {n} commits — click again to pull",
			"sync.pulled": "Fast-forwarded {n} commits ✓",
			"sync.pullFail": "Pull failed: {msg}",
			"sync.fetchFail": "Fetch failed: {msg}",
			"sync.noUpstream": "No upstream branch; click to fetch and attach one",
			"sync.clickFetch": "Click to fetch remote updates",
			"sync.clickPull": "Click to pull {n} commits (fast-forward only)",
			"sync.localAhead": "Local ahead by {n}; remote has nothing new",
			"sync.detached": "Detached HEAD; cannot pull",
			"sync.diverged": "Local and remote diverged; nothing was changed (this panel only fast-forwards — rebase or merge manually after reviewing Changes)",
			"symbols.placeholder": "Go to symbol (function / type)",
			"symbols.none": "No matching symbols (gopls may still be indexing)",
			"symbols.crumb": "Current symbol — open symbol list",
			"diff.scopeCommit": "Commit",
			"diff.back": "Back to file",
			"changes.commitsToggle": "Show / hide commits",
			"quickopen.command": "Quick Open File (Code Explorer)",
		};

		/* ---------------- api ---------------- */

		async function api(route, body) {
			try {
				const res = await fetch(`${API}/${route}`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body ?? {}),
				});
				const data = await res.json();
				return data && typeof data === "object" ? data : { ok: false, error: "bad response" };
			} catch (error) {
				return { ok: false, error: String(error?.message ?? error) };
			}
		}

		/* ---------------- go / generic tokenizer ---------------- */

		const KEYWORDS = {
			go: new Set(
				"break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false iota make len cap new append copy close delete panic recover".split(" "),
			),
			js: new Set(
				"async await break case catch class const continue debugger default delete do else export extends finally for from function get if import instanceof let new of return set static super switch this throw try typeof var void while with yield null undefined true false".split(" "),
			),
			py: new Set(
				"and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield None True False self".split(" "),
			),
		};
		const BLOCK_TYPES = new Set(["string", "error", "int", "int64", "float64", "bool", "byte", "rune", "any", "interface", "struct", "map", "chan", "func", "uint", "uint64", "rune"]);

		function langFor(path) {
			if (path.endsWith(".go")) return "go";
			if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)) return "js";
			if (/\.(py)$/.test(path)) return "py";
			return "text";
		}

		/** Per-line entry state: 0 clean, 1 inside /*-style block comment. */
		function buildLineStates(lines) {
			const states = new Uint8Array(lines.length);
			let state = 0;
			for (let i = 0; i < lines.length; i++) {
				states[i] = state;
				const line = lines[i];
				let j = 0;
				if (state) {
					const end = line.indexOf("*/");
					if (end < 0) continue;
					state = 0;
					j = end + 2;
				}
				let inString = 0;
				for (; j < line.length; j++) {
					const c = line.charCodeAt(j);
					if (inString) {
						if (c === 92) j++;
						else if (c === inString) inString = 0;
						continue;
					}
					if (c === 34 || c === 39 || c === 96) inString = c;
					else if (c === 47 && line.charCodeAt(j + 1) === 42) {
						const end = line.indexOf("*/", j + 2);
						if (end < 0) {
							state = 1;
							break;
						}
						j = end + 1;
					} else if (c === 47 && line.charCodeAt(j + 1) === 47) break;
				}
				if (inString === 96) inString = 0; // raw strings close at EOL for the state guess
			}
			return states;
		}

		const TOKEN_RE = /(\/\*.*?(?:\*\/|$)|\/\/.*$|"(?:[^"\\\n]|\\.)*(?:"|$)|'(?:\\.|[^'\\\n])*'?|`[^`\n]*`?|0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*)/g;

		function tokenizeLine(text, lang, entryState) {
			if (lang === "text") return [{ cls: "", s: text }];
			const runs = [];
			let rest = text;
			let consumed = 0;
			if (entryState === 1) {
				const end = rest.indexOf("*/");
				if (end < 0) return [{ cls: "ce-com", s: rest }];
				runs.push({ cls: "ce-com", s: rest.slice(0, end + 2) });
				consumed = end + 2;
				rest = rest.slice(end + 2);
			}
			const kws = KEYWORDS[lang] ?? KEYWORDS.js;
			let match;
			let index = 0;
			TOKEN_RE.lastIndex = 0;
			const pushPlain = (chunk, base) => {
				if (!chunk) return;
				let m;
				const ident = /[A-Za-z_][A-Za-z0-9_]*/g;
				let last = 0;
				while ((m = ident.exec(chunk))) {
					if (m.index > last) runs.push({ cls: "", s: chunk.slice(last, m.index) });
					const word = m[0];
					const cls = kws.has(word) ? "ce-kw" : lang === "go" && (BLOCK_TYPES.has(word) || /^[A-Z]/.test(word)) ? "ce-type" : "ce-id";
					runs.push({ cls, s: word, word, startCol: consumed + base + m.index + 1 });
					last = m.index + word.length;
				}
				if (last < chunk.length) runs.push({ cls: "", s: chunk.slice(last) });
			};
			while ((match = TOKEN_RE.exec(rest))) {
				if (match.index > index) pushPlain(rest.slice(index, match.index), index);
				const token = match[0];
				index = match.index + token.length;
				if (token.startsWith("//") || token.startsWith("/*")) runs.push({ cls: "ce-com", s: token });
				else if (/^["'`]/.test(token)) runs.push({ cls: "ce-str", s: token });
				else if (/^\d/.test(token)) runs.push({ cls: "ce-num", s: token });
				else if (/^[A-Za-z_]/.test(token)) {
					const cls = kws.has(token) ? "ce-kw" : lang === "go" && (BLOCK_TYPES.has(token) || /^[A-Z]/.test(token)) ? "ce-type" : "ce-id";
					runs.push({ cls, s: token, word: token, startCol: consumed + match.index + 1 });
				} else runs.push({ cls: "", s: token });
			}
			pushPlain(rest.slice(index), index);
			return runs;
		}

		function wordAt(text, col) {
			const ident = /[A-Za-z_][A-Za-z0-9_]*/g;
			let match;
			while ((match = ident.exec(text))) {
				const start = match.index + 1;
				const end = start + match[0].length - 1;
				if (col >= start && col <= end + 1) return { word: match[0], col: start };
			}
			return null;
		}

		/* ---------------- icons ---------------- */

		function svg(children, size = 16) {
			return h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, children);
		}
		const IconCode = ({ size }) => svg([h("path", { key: "a", d: "M9 6 3.5 12 9 18" }), h("path", { key: "b", d: "M15 6 20.5 12 15 18" })], size ?? 16);
		const IconFolder = ({ open }) => svg(open ? h("path", { key: "p", d: "M3 19 6 8h13l-3 11Z M6 8V5h5l2 3" }) : h("path", { key: "p", d: "M3 6h6l2 2h10v12H3Z" }));
		const IconFile = () => svg(h("path", { key: "p", d: "M6 2h8l4 4v16H6Z M14 2v4h4" }));
		const IconRefresh = () => svg([h("path", { key: "p", d: "M20 12a8 8 0 1 1-2.3-5.7" }), h("path", { key: "q", d: "M20 3v5h-5" })]);
		const IconArrowLeft = () => svg([h("path", { key: "p", d: "M20 12H5" }), h("path", { key: "q", d: "M11 6 5 12l6 6" })]);
		const IconArrowRight = () => svg([h("path", { key: "p", d: "M4 12h15" }), h("path", { key: "q", d: "M13 6l6 6-6 6" })]);
		const IconBolt = ({ on }) => svg(h("path", { key: "p", d: "M13 2 4 14h6l-1 8 9-12h-6Z", fill: on ? "currentColor" : "none" }));
		const IconSearch = () => svg([h("circle", { key: "c", cx: 10.5, cy: 10.5, r: 6.5 }), h("path", { key: "p", d: "M16 16l5 5" })]);
		const IconTextSearch = () => svg([h("path", { key: "a", d: "M4 5h16" }), h("path", { key: "b", d: "M4 10h11" }), h("path", { key: "c2", d: "M4 15h8" }), h("path", { key: "d", d: "M18 14.5l2.5 2.5" })]);

		/* ---------------- components ---------------- */

		function RelPath(cwd, path) {
			if (typeof path !== "string") return "";
			if (cwd && path.startsWith(cwd.endsWith("/") ? cwd : `${cwd}/`)) return path.slice(cwd.length + (cwd.endsWith("/") ? 0 : 1));
			return path;
		}

		function toAbs(cwd, path) {
			if (typeof path !== "string") return "";
			return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) ? path.replace(/\\/g, "/") : `${cwd.replace(/\/+$/, "")}/${path.replace(/\\/g, "/")}`;
		}

		function TreePanel({ cwd, t, onOpenFile, activePath, refreshKey }) {
			const [listing, setListing] = useState({});
			const [expanded, setExpanded] = useState([]);
			useEffect(() => {
				let live = true;
				setListing({});
				api("fs.list", { cwd, path: "" }).then((res) => {
					if (live) setListing({ "": res.ok ? res.value : { error: res.error } });
				});
				return () => {
					live = false;
				};
			}, [cwd, refreshKey]);
			const toggle = (path) => {
				if (expanded.includes(path)) {
					setExpanded(expanded.filter((p) => p !== path));
					return;
				}
				setExpanded([...expanded, path]);
				if (listing[path] === undefined) {
					setListing({ ...listing, [path]: { loading: true } });
					api("fs.list", { cwd, path }).then((res) => {
						setListing((current) => ({ ...current, [path]: res.ok ? res.value : { error: res.error } }));
					});
				}
			};
			const renderLevel = (path, depth) => {
				const state = listing[path];
				if (!state) return null;
				if (state.loading) return h("div", { key: `${path}-l`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, t("loading"));
				if (state.error) return h("div", { key: `${path}-l`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, `${t("tree.failed")}: ${state.error}`);
				const entries = [...(state.entries ?? [])].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
				const rows = [];
				for (const entry of entries) {
					const childPath = path === "" ? entry.name : `${path}/${entry.name}`;
					if (entry.type === "directory") {
						const open = expanded.includes(childPath);
						rows.push(
							h(
								"button",
								{ key: childPath, className: "ce-row", style: { paddingLeft: 6 + depth * 14 }, onClick: () => toggle(childPath), type: "button" },
								h("span", { className: "ce-ico" }, h(IconFolder, { open })),
								h("span", { className: "ce-name" }, entry.name),
							),
						);
						if (open) rows.push(renderLevel(childPath, depth + 1));
					} else if (entry.type === "file") {
						rows.push(
							h(
								"button",
								{
									key: childPath,
									className: `ce-row${activePath && (activePath === childPath || activePath.endsWith(`/${childPath}`)) ? " ce-active" : ""}`,
									style: { paddingLeft: 6 + depth * 14 },
									type: "button",
									onClick: () => onOpenFile(childPath, 1, 1),
								},
								h("span", { className: "ce-ico" }, h(IconFile)),
								h("span", { className: "ce-name" }, entry.name),
							),
						);
					}
				}
				if (!rows.length) rows.push(h("div", { key: `${path}-e`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, t("tree.empty")));
				return h(Fragment, { key: path }, rows);
			};
			return h("div", { className: "ce-scroll ce-rail" }, renderLevel("", 0));
		}

		function ChangesPanel({ cwd, t, git, repos, repoSel, onSelectRepo, commitsOpen, setCommitsOpen, onOpenCommit, onOpenDiff, refresh }) {
			const selector = repos && repos.length > 0
				? h(
					"select",
					{ className: "ce-input ce-repo", value: repoSel ?? "", onChange: (event) => onSelectRepo(event.target.value || null) },
					h("option", { value: "" }, t("changes.pickRepo")),
					repos.map((r) => h("option", { key: r.root, value: r.root }, `${r.root.split("/").pop()} · ${r.branch}${r.dirtyCount ? ` · ~${r.dirtyCount}` : ""}`)),
				)
				: null;
			if (!git) return h("div", { className: "ce-rail ce-scroll" }, selector, h("div", { className: "ce-note" }, t("loading")));
			if (git.error) return h("div", { className: "ce-rail ce-scroll" }, selector, h("div", { className: "ce-note" }, git.error));
			if (!git.repo) return h("div", { className: "ce-rail ce-scroll" }, selector, repos && repos.length === 0 ? h("div", { className: "ce-note" }, t("changes.notRepo")) : null);
			const badge = (xy) => (xy === "??" ? "U" : xy.trim()[0] === "A" || xy.trim()[0] === "?" ? "A" : xy.trim()[0] || "M");
			return h(
				"div",
				{ className: "ce-rail ce-scroll" },
				selector,
				h("div", { className: "ce-note" }, git.upstream
					? `${t("changes.vs")} ${git.upstream} · ↑${git.ahead ?? 0} ↓${git.behind ?? 0}${git.upstreamInferred ? " · auto" : ""}`
					: t("sync.noUpstream")),
				h(
					"div",
					{ className: "ce-section" },
					h("span", null, `${t("changes.working")} · ${git.working.length}`),
					h("button", { className: "ce-tool ce-tiny", type: "button", title: t("refresh"), onClick: refresh }, h(IconRefresh)),
				),
				git.working.length === 0 && h("div", { className: "ce-note" }, t("changes.none")),
				git.working.map((file) =>
					h(
						"button",
						{ key: `w:${file.path}`, className: "ce-row", type: "button", onClick: () => onOpenDiff(file.path, "working") },
						h("span", { className: `ce-badge ce-badge-${badge(file.xy).toLowerCase()}` }, badge(file.xy)),
						h("span", { className: "ce-name" }, file.path),
					),
				),
				h("div", { className: "ce-section" }, t("changes.branch")),
				git.base
					? h(
						Fragment,
						null,
						h(
							"div",
							{ className: "ce-note ce-note-line" },
							h("span", null, `${git.branch} ${t("changes.vs")} ${git.base.name} · ${git.branchFiles.length} files`),
							h(
								"button",
								{ type: "button", className: "ce-link", title: t("changes.commitsToggle"), "aria-expanded": commitsOpen ? "true" : "false", onClick: () => setCommitsOpen((v) => !v) },
								`${git.commits.length} ${t("changes.commits")} ${commitsOpen ? "▾" : "▸"}`,
							),
						),
						commitsOpen
							? git.commits.slice(0, 80).map((commit) =>
								h(
									"button",
									{ key: `c:${commit.hash}`, className: "ce-commit", type: "button", onClick: () => onOpenCommit(commit) },
									h("span", { className: "ce-chash" }, commit.hash),
									h("span", { className: "ce-csubject" }, commit.subject),
								))
							: null,
						git.branchFiles.map((path) =>
							h(
								"button",
								{ key: `b:${path}`, className: "ce-row", type: "button", onClick: () => onOpenDiff(path, "branch") },
								h("span", { className: "ce-badge ce-badge-c" }, "C"),
								h("span", { className: "ce-name" }, path),
							),
						),
					)
					: h("div", { className: "ce-note" }, t("changes.baseNone")),
			);
		}

		function parseDiff(text) {
			const lines = text.split("\n");
			const rows = [];
			let oldLine = 0;
			let newLine = 0;
			for (const line of lines) {
				if (line.startsWith("@@")) {
					const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
					if (match) {
						oldLine = Number(match[1]);
						newLine = Number(match[2]);
					}
					rows.push({ kind: "hunk", text: line });
					continue;
				}
				if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("new file") || line.startsWith("deleted file") || line.startsWith("similarity") || line.startsWith("rename")) {
					rows.push({ kind: "meta", text: line });
					continue;
				}
				if (line.startsWith("+")) {
					rows.push({ kind: "add", text: line.slice(1), newLine: newLine++ });
					continue;
				}
				if (line.startsWith("-")) {
					rows.push({ kind: "del", text: line.slice(1), oldLine: oldLine++ });
					continue;
				}
				if (line.startsWith("\\")) {
					rows.push({ kind: "meta", text: line });
					continue;
				}
				rows.push({ kind: "ctx", text: line.slice(1), oldLine: oldLine++, newLine: newLine++ });
			}
			return rows;
		}

		function DiffView({ t, diff, onClose }) {
			const rows = useMemo(() => parseDiff(diff.text ?? ""), [diff.text]);
			const shown = rows.length > 4000 ? rows.slice(0, 4000) : rows;
			return h(
				Fragment,
				null,
				h(
					"div",
					{ className: "ce-head" },
					h("button", { type: "button", className: "ce-tool ce-tiny", title: `${t("diff.back")} (Esc)`, onClick: onClose }, "←"),
					h("span", { className: "ce-head-path" }, diff.path),
					h("span", { className: "ce-chip" }, diff.scope === "commit"
						? `${t("diff.scopeCommit")} ${diff.commit ?? ""}`
						: diff.scope === "branch" ? `${t("diff.scopeBranch")} ${diff.base ? `vs ${diff.base}` : ""}` : t("diff.scopeWorking")),
					diff.untracked ? h("span", { className: "ce-chip" }, t("diff.untracked")) : null,
					diff.note ? h("span", { className: "ce-chip" }, diff.note) : null,
				),
				rows.length === 0
					? h("div", { className: "ce-empty" }, diff.text === "" ? t("diff.empty") : `${t("error")}: ${diff.error ?? ""}`)
					: h(
						"div",
						{ className: "ce-scroll ce-code-wrap" },
						h(
							"div",
							{ className: "ce-code" },
							shown.map((row, i) =>
								h(
									"div",
									{ key: i, className: `ce-dline ce-dline-${row.kind}` },
									h("span", { className: "ce-dnum" }, row.oldLine ?? ""),
									h("span", { className: "ce-dnum" }, row.newLine ?? ""),
									h("span", { className: "ce-dtext" }, `${row.kind === "add" ? "+" : row.kind === "del" ? "−" : row.kind === "hunk" ? "" : " "} ${row.text}`),
								),
							),
							shown.length < rows.length ? h("div", { className: "ce-dline ce-dline-meta" }, "… display truncated …") : null,
						),
					),
			);
		}

		function LocationList({ t, overlay, cwd, onPick, onClose }) {
			return h(
				"div",
				{ className: "ce-overlay" },
				h(
					"div",
					{ className: "ce-overlay-head" },
					h("span", null, `${overlay.title} · ${overlay.items.length}`),
					h("button", { className: "ce-tool ce-tiny", type: "button", title: t("close"), onClick: onClose }, "✕"),
				),
				h(
					"div",
					{ className: "ce-overlay-list ce-scroll" },
					overlay.items.map((item, i) =>
						h(
							"button",
							{ key: i, className: "ce-loc", type: "button", onClick: () => onPick(item) },
							h("span", { className: "ce-loc-path" }, `${RelPath(cwd, item.path)}:${item.line}:${item.col}`),
							item.snippet ? h("span", { className: "ce-loc-snippet" }, item.snippet) : null,
						),
					),
				),
			);
		}

		function QuickOpen({ t, state, onQuery, onPick, onClose }) {
			const [sel, setSel] = useState(0);
			const inputRef = useRef(null);
			const listRef = useRef(null);
			useEffect(() => {
				setSel(0);
			}, [state.query]);
			useEffect(() => {
				inputRef.current?.focus();
			}, []);
			const items = state.results ?? [];
			useEffect(() => {
				const node = listRef.current?.querySelector(`[data-qi="${sel}"]`);
				node?.scrollIntoView({ block: "nearest" });
			}, [sel]);
			const choose = useCallback((i) => {
				const item = items[i];
				if (item) onPick(item.path);
			}, [items, onPick]);
			const onKeyDown = (event) => {
				if (event.key === "Escape") {
					event.stopPropagation();
					onClose();
				} else if (event.key === "ArrowDown") {
					event.preventDefault();
					setSel((s) => Math.min(items.length - 1, s + 1));
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					setSel((s) => Math.max(0, s - 1));
				} else if (event.key === "Enter") {
					event.preventDefault();
					choose(sel);
				}
			};
			return h(
				"div",
				{ className: "ce-palette", onKeyDown },
				h(
					"div",
					{ className: "ce-palette-head" },
					h("input", {
						ref: inputRef,
						className: "ce-input",
						type: "text",
						placeholder: t("quickopen.placeholder"),
						value: state.query,
						onChange: (event) => onQuery(event.target.value),
						onKeyDown,
						spellcheck: false,
						autoCapitalize: "off",
						autoComplete: "off",
					}),
					h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
				),
				h(
					"div",
					{ className: "ce-palette-list ce-scroll", ref: listRef },
					state.busy && items.length === 0 ? h("div", { className: "ce-note" }, t("quickopen.loading")) : null,
					!state.busy && items.length === 0 ? h("div", { className: "ce-note" }, state.query ? t("quickopen.empty") : t("loading")) : null,
					items.map((item, i) => {
						const slash = item.path.lastIndexOf("/");
						return h(
							"button",
							{
								key: item.path,
								type: "button",
								"data-qi": i,
								className: `ce-qitem${i === sel ? " ce-qitem-sel" : ""}`,
								onMouseEnter: () => setSel(i),
								onClick: () => choose(i),
							},
							h("span", { className: "ce-qbase" }, slash >= 0 ? item.path.slice(slash + 1) : item.path),
							slash >= 0 ? h("span", { className: "ce-qdir" }, item.path.slice(0, slash)) : null,
						);
					}),
				),
			);
		}

		function SearchPanel({ t, cwd, state, onQuery, onInclude, onSubmit, onPick, onClose }) {
			const inputRef = useRef(null);
			useEffect(() => {
				inputRef.current?.focus();
			}, []);
			return h(
				"div",
				{ className: "ce-search" },
				h(
					"div",
					{ className: "ce-search-box" },
					h("input", {
						ref: inputRef,
						className: "ce-input ce-search-q",
						type: "text",
						placeholder: t("search.placeholder"),
						value: state.query,
						onChange: (event) => onQuery(event.target.value),
						onKeyDown: (event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								onSubmit();
							} else if (event.key === "Escape") {
								event.stopPropagation();
								onClose();
							}
						},
						spellcheck: false,
						autoCapitalize: "off",
						autoComplete: "off",
					}),
					h("button", { className: "ce-tool ce-tiny", type: "button", title: t("search.run"), onClick: onSubmit }, h(IconSearch)),
				),
				h("input", {
					className: "ce-input ce-search-include",
					type: "text",
					placeholder: t("search.include"),
					value: state.include,
					onChange: (event) => onInclude(event.target.value),
					onKeyDown: (event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							onSubmit();
						}
					},
					spellcheck: false,
					autoCapitalize: "off",
					autoComplete: "off",
				}),
				h(
					"div",
					{ className: "ce-search-meta" },
					state.busy
						? t("search.searching")
						: state.results
							? `${state.results.length} ${t("search.results")}${state.engine ? ` · ${state.engine}` : ""}${state.truncated ? ` · ${t("search.truncated")}` : ""}`
							: state.query.trim().length < 2
								? t("search.empty")
								: t("search.none"),
				),
				state.error ? h("div", { className: "ce-note" }, `${t("search.failed")}: ${state.error}`) : null,
				h(
					"div",
					{ className: "ce-search-results ce-scroll" },
					(state.results ?? []).map((r, i) =>
						h(
							"button",
							{ key: i, type: "button", className: "ce-sresult", onClick: () => onPick(r) },
							h("span", { className: "ce-sloc" }, `${RelPath(cwd, r.path) || r.path}:${r.line}`),
							h("span", { className: "ce-stext" }, r.text),
						),
					),
				),
			);
		}

		function RefsPeek({ t, cwd, peek, scroll, totalLines, onPick, onClose }) {
			const defs = peek.def ?? [];
			const refs = (peek.refs ?? []).filter((r) => !defs.some((d) => d.path === r.path && d.line === r.line && d.col === r.col));
			const groups = [];
			const pushRow = (loc, isDef) => {
				let g = groups.find((x) => x.path === loc.path);
				if (!g) {
					g = { path: loc.path, rows: [] };
					groups.push(g);
				}
				g.rows.push({ ...loc, isDef });
			};
			defs.slice(0, 30).forEach((d) => pushRow(d, true));
			refs.slice(0, 60).forEach((r) => pushRow(r, false));
			const flat = [];
			for (const g of groups) flat.push(...g.rows);
			const [sel, setSel] = useState(0);
			const bodyRef = useRef(null);
			useEffect(() => {
				setSel(0);
			}, [peek.symbol, peek.busy]);
			useEffect(() => {
				bodyRef.current?.querySelector(`[data-ri="${sel}"]`)?.scrollIntoView({ block: "nearest" });
			}, [sel]);
			const onKeyDown = (event) => {
				if (event.key === "ArrowDown") {
					event.preventDefault();
					event.stopPropagation();
					setSel((s) => Math.min(flat.length - 1, s + 1));
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					event.stopPropagation();
					setSel((s) => Math.max(0, s - 1));
				} else if (event.key === "Enter") {
					event.preventDefault();
					event.stopPropagation();
					if (flat[sel]) onPick(flat[sel]);
				}
			};
			const top = Math.max(6, Math.min(peek.anchorLine * ROW + 6 - scroll, totalLines * ROW));
			let ri = 0;
			return h(
				"div",
				{ className: "ce-peek", style: { top }, onKeyDown, onMouseDown: (event) => event.stopPropagation() },
				h(
					"div",
					{ className: "ce-peek-head" },
					h("span", { className: "ce-peek-sym" }, peek.symbol),
					peek.busy
						? h("span", { className: "ce-peek-meta" }, t("loading"))
						: h("span", { className: "ce-peek-meta" }, `${t("peek.defs")} ${defs.length} · ${t("peek.refs")} ${refs.length}`),
					h("span", { className: "ce-spacer" }),
					h("span", { className: "ce-peek-hint" }, t("peek.hint")),
					h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
				),
				peek.error ? h("div", { className: "ce-note" }, peek.error) : null,
				!peek.busy && flat.length === 0 && !peek.error ? h("div", { className: "ce-note" }, t("peek.empty")) : null,
				h(
					"div",
					{ className: "ce-peek-body ce-scroll", ref: bodyRef },
					groups.map((g, gi) => {
						const fileRows = g.rows.map((r) => {
							const i = ri++;
							return h(
								"button",
								{
									key: i,
									type: "button",
									"data-ri": i,
									className: `ce-peek-row${i === sel ? " ce-peek-row-sel" : ""}${r.isDef ? " ce-peek-def" : ""}`,
									onMouseEnter: () => setSel(i),
									onClick: () => onPick(r),
								},
								h("span", { className: "ce-peek-lno" }, `${r.line}:${r.col}`),
								h("span", { className: "ce-peek-snippet" }, r.snippet ?? ""),
							);
						});
						return h(
							Fragment,
							{ key: `${g.path}-${gi}` },
							h("div", { className: "ce-peek-file" }, h("span", { className: "ce-peek-fpath" }, RelPath(cwd, g.path) || g.path)),
							fileRows,
						);
					}),
				),
			);
		}

		const SYMBOL_GLYPHS = { 2: "▣", 3: "ƒ", 4: "Ω", 5: "◆", 6: "ƒ", 7: "◆", 8: "◈", 9: "#", 10: "◈", 11: "▣", 12: "✓", 13: "▣", 14: "🛡", 15: "ω", 16: "◆", 17: "◆", 18: "≡", 19: "◦", 20: "◦", 21: "≡", 22: "◆", 23: "◆", 24: "▣", 25: "•", 26: "•" };

		function SymbolPalette({ t, symbols, onPick, onClose }) {
			const [query, setQuery] = useState("");
			const [sel, setSel] = useState(0);
			const inputRef = useRef(null);
			const listRef = useRef(null);
			useEffect(() => {
				inputRef.current?.focus();
			}, []);
			const q = query.trim().toLowerCase();
			const items = useMemo(() => {
				const filtered = !q ? symbols : symbols.filter((s) => (s.name ?? "").toLowerCase().includes(q) || (s.name ?? "").toLowerCase().startsWith(q));
				return filtered.slice(0, 120);
			}, [symbols, q]);
			useEffect(() => {
				setSel(0);
			}, [query]);
			useEffect(() => {
				listRef.current?.querySelector(`[data-si="${sel}"]`)?.scrollIntoView({ block: "nearest" });
			}, [sel]);
			const onKeyDown = (event) => {
				if (event.key === "Escape") {
					event.stopPropagation();
					onClose();
				} else if (event.key === "ArrowDown") {
					event.preventDefault();
					setSel((s) => Math.min(items.length - 1, s + 1));
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					setSel((s) => Math.max(0, s - 1));
				} else if (event.key === "Enter") {
					event.preventDefault();
					if (items[sel]) onPick(items[sel]);
				}
			};
			return h(
				"div",
				{ className: "ce-palette", onKeyDown, onMouseDown: (event) => event.stopPropagation() },
				h(
					"div",
					{ className: "ce-palette-head" },
					h("input", {
						ref: inputRef,
						className: "ce-input",
						type: "text",
						placeholder: t("symbols.placeholder"),
						value: query,
						onChange: (event) => setQuery(event.target.value),
						onKeyDown,
						spellcheck: false,
					}),
					h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
				),
				h(
					"div",
					{ className: "ce-palette-list ce-scroll", ref: listRef },
					items.length === 0 ? h("div", { className: "ce-note" }, t("symbols.none")) : null,
					items.map((s, i) =>
						h(
							"button",
							{
								key: `${s.name}-${s.line}-${i}`,
								type: "button",
								"data-si": i,
								className: `ce-qitem${i === sel ? " ce-qitem-sel" : ""}`,
								onMouseEnter: () => setSel(i),
								onClick: () => onPick(s),
							},
							h("span", { className: "ce-symglyph" }, SYMBOL_GLYPHS[s.kind] ?? "•"),
							h("span", { className: "ce-qbase" }, s.name),
							h("span", { className: "ce-qdir" }, `:${s.line}:${s.col}`),
						),
					),
				),
			);
		}

		function CodeBody(props) {
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
			const [clickJump, setClickJump] = useState(true);
			const [treeKey, setTreeKey] = useState(0);
			const [flash, setFlash] = useState(null); // {line, col, word}
			const [scroll, setScroll] = useState(0);
			const [viewport, setViewport] = useState(600);
			const [palette, setPalette] = useState(null); // {query, results, busy}
			const [search, setSearch] = useState(null); // {query, include, results, engine, truncated, busy, error}
			const [searchOpen, setSearchOpen] = useState(false);
			const [peek, setPeek] = useState(null); // {symbol, anchorLine, busy, def, refs, error}
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
			const hoverTimer = useRef(null);
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

			const persistKey = sessionId && cwd ? `dsh.code-explorer.v1.${sessionId}` : null;

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
					const entry = { path, lines, states: buildLineStates(lines), truncated: res.value.truncated };
					const seq = ++openSeqRef.current;
					peekNonce.current++;
					setPeek(null);
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
				if (typeof blob.mode === "string") setMode(blob.mode);
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
					setDiff({ path, scope, text: value.diff ?? "", error: value.error, base: value.base, untracked: value.untracked, note: value.note });
					setOverlay(null);
					setHover(null);
				},
				[cwd],
			);

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

			const onRootKeyDown = useCallback(
				(event) => {
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
				[palette, closePalette, openPalette, openSearch, searchOpen, peek, closePeek, goBack, goForward, symPalette],
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

			const requestHover = useCallback(
				(line, col, x, y) => {
					if (!cwd || !docRef.current || !docRef.current.path.endsWith(".go")) return;
					api("lsp.request", { cwd, path: docRef.current.path, kind: "hover", line, col }).then((res) => {
						if (!res.ok || !res.value.hover) return;
						if (res.value.status) setStatus(res.value.status);
						setHover({ x, y, text: res.value.hover });
					});
				},
				[cwd],
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
					if (!docRef.current.path.endsWith(".go") || !word) return;
					if (target.classList?.contains("ce-kw")) return;
					const mod = event.metaKey || event.ctrlKey;
					if (mod) void doJump("definition", at);
					else if (event.altKey || clickJump) void openPeek(word, at.line, at.col);
				},
				[clickJump, doJump, openPeek],
			);

			const onEditorMouseMove = useCallback(
				(event) => {
					const target = event.target?.closest?.("[data-ce-w]");
					if (hoverTimer.current) {
						clearTimeout(hoverTimer.current);
						hoverTimer.current = null;
					}
					if (!target || !docRef.current?.path.endsWith(".go")) {
						return;
					}
					const rect = codeRef.current?.getBoundingClientRect();
					const x = event.clientX - (rect?.left ?? 0) + 14;
					const y = event.clientY - (rect?.top ?? 0) + 26;
					const line = Number(target.dataset.ceL);
					const col = Number(target.dataset.ceC);
					hoverTimer.current = setTimeout(() => requestHover(line, col, x, y), 450);
				},
				[requestHover],
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
				if (hoverTimer.current) clearTimeout(hoverTimer.current);
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

			const visible = useMemo(() => {
				if (!doc) return null;
				const start = Math.max(0, Math.floor(scroll / ROW) - 6);
				const end = Math.min(doc.lines.length, Math.ceil((scroll + viewport) / ROW) + 6);
				const lang = langFor(doc.path);
				const rows = [];
				for (let i = start; i < end; i++) {
					const runs = tokenizeLine(doc.lines[i], lang, doc.states[i]);
					const isGo = lang === "go";
					const lineFlash = flash && flash.line === i + 1 ? flash : null;
					const cells = runs.map((run, r) => {
						// word-level highlight when the flash names a token at this column
						const marked = lineFlash && lineFlash.col != null && run.startCol === lineFlash.col && lineFlash.word && run.s === lineFlash.word;
						return run.cls === "ce-id" || run.cls === "ce-type" || run.cls === "ce-kw"
							? h(
								"span",
								{
									key: r,
									className: `ce-t ${run.cls}${isGo ? " ce-jump" : ""}${marked ? " ce-mark" : ""}`,
									...(isGo ? { "data-ce-l": i + 1, "data-ce-c": run.startCol ?? 1, "data-ce-w": run.word ?? "" } : {}),
								},
								run.s,
							)
							: h("span", { key: r, className: `ce-t ${run.cls}${marked ? " ce-mark" : ""}` }, run.s);
					});
					const lineDiags = diagByLine.get(i + 1);
					const underlines = (lineDiags ?? []).map((item, d) => {
						const endCol = item.endLine === item.line ? Math.min(item.endCol, item.startCol + 200) : item.startCol + 200;
						return h("span", {
							key: `u${d}`,
							className: `ce-underline${item.severity === 2 ? " ce-underline-warn" : ""}`,
							title: `${item.source ? `${item.source}: ` : ""}${item.message}`,
							style: { left: `${(item.startCol - 1) * 7.8}px`, width: `${Math.min(1600, Math.max(6, (endCol - item.startCol) * 7.8))}px` },
						});
					});
					rows.push(
						h(
							"div",
							{ key: i, className: `ce-line${lineFlash ? " ce-flash" : ""}`, style: { transform: `translateY(${i * ROW}px)` } },
							cells.length ? cells : h("span", { className: "ce-t" }, " "),
							...underlines,
						),
					);
				}
				return { rows, start, end };
			}, [doc, scroll, viewport, diagByLine, flash]);

			const gutter = useMemo(() => {
				if (!doc) return null;
				const start = Math.max(0, Math.floor(scroll / ROW) - 6);
				const end = Math.min(doc.lines.length, Math.ceil((scroll + viewport) / ROW) + 6);
				const rows = [];
				for (let i = start; i < end; i++) {
					rows.push(
						h(
							"div",
							{ key: i, className: `ce-gline${cursor?.line === i + 1 ? " ce-gline-active" : ""}`, style: { transform: `translateY(${i * ROW}px)` } },
							String(i + 1),
						),
					);
				}
				return rows;
			}, [doc, scroll, viewport, cursor]);

			const statusTitle = (status.state === "error" ? `${t("status.error")}: ${status.message}` : status.state === "starting" ? t("status.starting") : status.state === "ready" ? t("status.ready") : t("status.off")) + (status.progress ? ` · ${status.progress}` : "");
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
								title: git.branch === "HEAD"
									? t("sync.detached")
									: !git.upstream
										? t("sync.noUpstream")
										: `${git.upstream}${git.upstreamInferred ? " · auto" : ""} — ${git.behind > 0 ? t("sync.clickPull", { n: git.behind }) : t("sync.clickFetch")}`,
								onClick: () => (git.behind > 0 ? doPull() : doFetch()),
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
					h("button", { type: "button", className: `ce-tool${clickJump ? " ce-tool-on" : ""}`, title: clickJump ? t("clickJump.on") : t("clickJump.off"), "aria-pressed": clickJump, onClick: () => setClickJump((v) => !v) }, h(IconBolt, { on: clickJump })),
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
							? h(TreePanel, { cwd, t, onOpenFile: (path, line, col) => void openFile(path, line, col), activePath: doc?.path ?? diff?.path, refreshKey: treeKey })
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
								onOpenDiff: (path, scope) => void openDiff(path, scope),
								refresh: refreshGit,
							}))
						: null,
					railVisible
						? h("div", { className: "ce-splitter", onMouseDown: startRailDrag, onDoubleClick: () => setRailVisible(false), title: "⇔ 拖动调宽 · 双击收起" })
						: h("button", { type: "button", className: "ce-rail-tab", title: "展开侧栏 (⌘B / Ctrl+B)", onClick: () => setRailVisible(true) }, "▸"),
					h(
						"div",
						{ className: "ce-editor" },
						diff
							? h(DiffView, { t, diff, onClose: () => { setDiff(null); if (docRef.current) modeRef.current = "code"; } })
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
									doc.truncated ? h("span", { className: "ce-chip" }, t("truncated")) : null,
									h("span", { className: "ce-spacer" }),
									cursor ? h("span", { className: "ce-pos" }, `Ln ${cursor.line}, Col ${cursor.col}${cursor.word ? ` · ${cursor.word}` : ""}`) : null,
									diagnostics.length ? h("span", { className: "ce-diag" }, `${diagnostics.length} ${t("diag.count")}`) : null,
								),
								h(
									"div",
									{ className: "ce-code-wrap" },
									h("div", { className: "ce-gutter" }, h("div", { className: "ce-gutter-inner", style: { transform: `translateY(${-scroll}px)` } }, gutter)),
									h(
										"div",
										{
											className: "ce-code",
											tabIndex: 0,
											ref: codeRef,
											onKeyDown,
											onMouseLeave: () => setHover(null),
											onClick: onEditorClick,
											onMouseMove: onEditorMouseMove,
											onScroll: (event) => setScroll(event.currentTarget.scrollTop),
											style: { outline: "none" },
										},
										h("div", { className: "ce-code-inner", style: { height: `${(doc.lines.length + 2) * ROW}px` } }, visible?.rows),
									),
									peek ? h(RefsPeek, { t, cwd, peek, scroll, totalLines: doc.lines.length, onPick: pickPeek, onClose: closePeek }) : null,
									symPalette ? h(SymbolPalette, { t, symbols, onPick: (s) => { setSymPalette(null); revealPosition(s.line, s.col, s.name); }, onClose: () => setSymPalette(null) }) : null,
								),
								hover && hover.text
									? h(
										"div",
										{ className: "ce-hover", style: { left: Math.min(hover.x, 320), top: hover.y } },
										hover.text.split("\n").map((line, i) => h("div", { key: i }, line)),
									)
									: null,
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
				h(
					"div",
					{ className: "ce-statusbar" },
					h("span", null, notice.kind === "info" ? notice.text || (doc && !diagnostics.length && doc.path.endsWith(".go") ? t("nodiag") : "") : ""),
					h("span", { className: "ce-spacer" }),
					h("span", { className: "ce-prog" }, status.progress || (status.state === "error" ? "gopls ✕" : status.state === "ready" ? "gopls ✓" : status.state === "starting" ? "gopls …" : "")),
				),
			);
		}

		function CodeTitle({ useTabInfo }) {
			const tabInfo = useTabInfo ? useTabInfo() : null;
			return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(IconCode)), tabInfo?.tab?.title ?? "Code");
		}

		/* ---------------- styles ---------------- */

		const CSS = `
.ce-root{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary,#ddd);font-size:13px;background:var(--dsw-alias-bg-base,#181818)}
.ce-toolbar{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.ce-seg{display:flex;border-radius:var(--dsw-radius-sm,6px);overflow:hidden;border:.5px solid var(--dsw-alias-border-l2,#444)}
.ce-seg-btn{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#999);padding:3px 10px;cursor:pointer;font:inherit}
.ce-seg-on{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#eee)}
.ce-branch{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary,#9ab);font:inherit;font-size:12px;margin-left:2px;border:0;background:transparent;cursor:pointer;padding:2px 7px;border-radius:6px}
.ce-branch:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30);color:var(--dsw-alias-label-primary,#dde)}
.ce-branch:disabled{opacity:.6;cursor:default}
.ce-ab{font-size:10.5px;font-weight:700;letter-spacing:.02em}
.ce-ab-ahead{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-ab-behind{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-spin{display:inline-flex;animation:ce-spin .9s linear infinite}
.ce-spin svg{width:12px;height:12px}
@keyframes ce-spin{to{transform:rotate(360deg)}}
.ce-spacer{flex:1}
.ce-tool{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--dsw-radius-sm,6px);border:0;background:transparent;color:var(--dsw-alias-label-secondary,#999);cursor:pointer}
.ce-tool:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#eee)}
.ce-tool-on{color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-tool:disabled{opacity:.35;cursor:default}
.ce-tiny{width:20px;height:20px}
.ce-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary,#666)}
.ce-dot-ready{background:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-dot-starting{background:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-dot-error{background:var(--dsw-alias-state-error-primary,#f85149)}
.ce-main{flex:1;min-height:0;display:flex}
.ce-rail-wrap{width:230px;min-width:150px;flex:none;display:flex;border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-rail{flex:1;min-width:0}
.ce-scroll{overflow:auto;scrollbar-gutter:stable}
.ce-row{display:flex;align-items:center;gap:6px;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:4px 8px;cursor:pointer;border-radius:4px;min-width:0}
.ce-row:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-active{background:var(--dsw-alias-interactive-bg-hover,#2c313a)}
.ce-ico{flex:none;display:inline-flex;color:var(--dsw-alias-label-tertiary,#777)}
.ce-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ce-note{color:var(--dsw-alias-label-tertiary,#777);padding:3px 10px;font-size:12px}
.ce-section{display:flex;align-items:center;justify-content:space-between;gap:4px;color:var(--dsw-alias-label-secondary,#999);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 8px 4px}
.ce-badge{flex:none;width:16px;height:16px;line-height:16px;text-align:center;border-radius:4px;font-size:10px;font-weight:700;background:var(--dsw-alias-interactive-bg-hover,#333);color:var(--dsw-alias-label-secondary,#999)}
.ce-badge-m{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-badge-a,.ce-badge-u{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-badge-d,.ce-badge-r{color:var(--dsw-alias-state-error-primary,#f85149)}
.ce-badge-c{color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-editor{flex:1;min-width:0;display:flex;flex-direction:column;position:relative}
.ce-head{display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none;min-width:0}
.ce-head-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary,#ddd)}
.ce-chip{font-size:11px;padding:1px 7px;border-radius:99px;background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-secondary,#999);flex:none}
.ce-pos{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#888);flex:none}
.ce-diag{font-size:11px;color:var(--dsw-alias-state-error-primary,#f85149);flex:none}
.ce-code-wrap{flex:1;min-height:0;display:flex;overflow:hidden;position:relative}
.ce-gutter{flex:none;width:52px;overflow:hidden;position:relative;background:var(--dsw-alias-bg-base,#181818);border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-gutter-inner{position:absolute;top:0;left:0;right:0}
.ce-gline{position:absolute;right:8px;height:${ROW}px;line-height:${ROW}px;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-tertiary,#667)}
.ce-gline-active{color:var(--dsw-alias-label-primary,#cde)}
.ce-code{flex:1;min-width:0;overflow:auto;position:relative}
.ce-code-inner{position:relative;min-width:max-content}
.ce-line{position:absolute;left:0;min-width:max-content;height:${ROW}px;line-height:${ROW}px;white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;padding-right:24px}
.ce-flash{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 18%,transparent);animation:ce-fade 1.4s ease-out}
@keyframes ce-fade{from{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 30%,transparent)}to{background:transparent}}
.ce-kw{color:var(--ce-kw,var(--dsw-alias-brand-primary,#6cb2ff))}
.ce-type{color:var(--ce-type,#7de3a4)}
.ce-str{color:var(--ce-str,#e6b56d)}
.ce-num{color:var(--ce-num,#d19a66)}
.ce-com{color:var(--ce-com,var(--dsw-alias-label-tertiary,#7a8490));font-style:italic}
.ce-jump{cursor:pointer;text-decoration:underline dotted transparent;text-underline-offset:3px}
.ce-jump:hover{text-decoration-color:var(--dsw-alias-label-tertiary,#889)}
.ce-underline{position:absolute;bottom:3px;height:2px;border-bottom:2px dotted var(--dsw-alias-state-error-primary,#f85149);pointer-events:auto;background:transparent}
.ce-underline-warn{border-bottom-color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-hover{position:absolute;z-index:5;max-width:420px;min-width:180px;background:var(--dsw-alias-bg-overlay,#232729);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:var(--dsw-radius-md,8px);padding:8px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;box-shadow:0 6px 22px rgba(0,0,0,.35);pointer-events:none;color:var(--dsw-alias-label-primary,#ddd)}
.ce-overlay{position:absolute;left:8px;right:8px;top:36px;z-index:6;background:var(--dsw-alias-bg-overlay,#232729);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:var(--dsw-radius-md,8px);box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;max-height:60%}
.ce-overlay-head{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);font-weight:600}
.ce-overlay-list{overflow:auto}
.ce-loc{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px;cursor:pointer;white-space:nowrap}
.ce-loc:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-loc-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-brand-primary,#6cb2ff);flex:none}
.ce-loc-snippet{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-secondary,#999);overflow:hidden;text-overflow:ellipsis}
.ce-dline{display:flex;min-width:max-content;height:${ROW}px;line-height:${ROW}px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;white-space:pre;padding-right:24px}
.ce-dline-add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent)}
.ce-dline-del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 14%,transparent)}
.ce-dline-hunk{color:var(--dsw-alias-brand-primary,#6cb2ff)}
.ce-dline-meta{color:var(--dsw-alias-label-tertiary,#777);font-style:italic}
.ce-dnum{width:44px;flex:none;text-align:right;padding-right:8px;color:var(--dsw-alias-label-tertiary,#667);user-select:none}
.ce-dtext{min-width:0}
.ce-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#7a8490);padding:24px;text-align:center}
.ce-statusbar{flex:none;display:flex;gap:8px;align-items:center;padding:3px 10px;border-top:.5px solid var(--dsw-alias-border-l1,#333);font-size:11px;color:var(--dsw-alias-label-tertiary,#889);min-height:22px}
.ce-title-ico{display:inline-flex;margin-right:2px}
.ce-peek{position:absolute;left:12px;width:min(660px,calc(100% - 24px));z-index:6;background:var(--dsw-alias-bg-layer-1,#1d2126);border:.5px solid var(--dsw-alias-border-l2,#454a52);border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.18);display:flex;flex-direction:column;max-height:340px;overflow:hidden}
.ce-peek-head{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.ce-peek-sym{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;font-size:12.5px;color:var(--dsw-alias-brand-primary,#6cb2ff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34%}
.ce-peek-meta{font-size:11px;color:var(--dsw-alias-label-secondary,#999);flex:none}
.ce-peek-hint{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#778);flex:none;margin-right:4px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-peek-body{min-height:0;padding-bottom:4px}
.ce-peek-file{position:sticky;top:0;z-index:1;display:flex;align-items:center;padding:4px 12px;background:var(--dsw-alias-bg-layer-2,#23272c);border-top:.5px solid var(--dsw-alias-border-l1,#333);border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-peek-fpath{direction:rtl;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#aab)}
.ce-peek-row{display:flex;gap:10px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:3px 12px 3px 18px;cursor:pointer;white-space:nowrap;border-left:2px solid transparent}
.ce-peek-row:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-peek-row-sel{background:var(--dsw-alias-interactive-bg-hover,#2b3038)}
.ce-peek-def{border-left:2px solid var(--dsw-alias-state-success-primary,#3fb950)}
.ce-peek-lno{min-width:52px;text-align:right;color:var(--dsw-alias-label-tertiary,#778);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;flex:none;user-select:none}
.ce-peek-def .ce-peek-lno{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-peek-snippet{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-primary,#ccd);overflow:hidden;text-overflow:ellipsis;white-space:pre;min-width:0}
.ce-mark{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 34%,transparent);border-radius:3px;box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent);text-decoration:none}
.ce-banner{flex:none;display:flex;align-items:center;gap:8px;margin:6px 10px 0;padding:6px 8px 6px 10px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 14%,transparent);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 40%,transparent);color:var(--dsw-alias-label-primary,#eee);font-size:12px}
.ce-banner-text{min-width:0;flex:1;white-space:pre-wrap;word-break:break-word}
.ce-splitter{flex:none;width:5px;cursor:col-resize;background:transparent;border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-splitter:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent)}
.ce-rail-tab{flex:none;width:16px;border:0;border-right:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#1d2126);color:var(--dsw-alias-label-tertiary,#889);cursor:pointer;font-size:10px;padding:0}
.ce-rail-tab:hover{color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-crumb{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#9ab);font:inherit;font-size:12px;cursor:pointer;padding:1px 6px;border-radius:5px;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.ce-crumb:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30);color:var(--dsw-alias-label-primary,#eee)}
.ce-note-line{display:flex;align-items:center;justify-content:space-between;gap:6px}
.ce-link{border:0;background:transparent;color:var(--dsw-alias-brand-primary,#6cb2ff);font:inherit;font-size:11px;cursor:pointer;padding:0 2px;flex:none}
.ce-link:hover{text-decoration:underline}
.ce-commit{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:3px 10px 3px 14px;cursor:pointer;border-radius:4px;white-space:nowrap}
.ce-commit:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-chash{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#778);flex:none}
.ce-csubject{color:var(--dsw-alias-label-secondary,#9ab);overflow:hidden;text-overflow:ellipsis;min-width:0}
.ce-symglyph{width:16px;flex:none;text-align:center;color:var(--dsw-alias-label-tertiary,#889);font-size:12px}
.ce-prog{font-size:11px;color:var(--dsw-alias-label-tertiary,#889);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:50%}
.ce-palette{position:absolute;top:40px;left:50%;transform:translateX(-50%);width:min(560px,calc(100% - 32px));z-index:8;display:flex;flex-direction:column;max-height:70%;background:var(--dsw-alias-bg-overlay,#232729);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:var(--dsw-radius-md,8px);box-shadow:0 14px 44px rgba(0,0,0,.45);overflow:hidden}
.ce-palette-head{display:flex;align-items:center;gap:6px;padding:8px}
.ce-input{flex:1;min-width:0;background:var(--dsw-alias-bg-layer-1,#1e2126);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:6px;color:var(--dsw-alias-label-primary,#ddd);padding:6px 9px;font:inherit;outline:none}
.ce-input:focus{border-color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-palette-list{border-top:.5px solid var(--dsw-alias-border-l1,#333);padding:4px 0}
.ce-qitem{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:5px 12px;cursor:pointer}
.ce-qitem-sel{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-qbase{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62%;flex:none}
.ce-qdir{font-size:11px;color:var(--dsw-alias-label-tertiary,#778);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ce-search{position:absolute;inset:0;z-index:7;background:var(--dsw-alias-bg-base,#181818);display:flex;flex-direction:column;padding:10px;gap:8px}
.ce-search-box{display:flex;gap:6px;align-items:center;flex:none}
.ce-search-include{flex:none}
.ce-repo{width:calc(100% - 16px);margin:4px 8px 2px;font-size:11px;padding:4px 6px;flex:none;align-self:flex-start}
.ce-search-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#778);flex:none;min-height:14px}
.ce-search-results{flex:1;min-height:0;border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#1e2126)}
.ce-sresult{display:flex;gap:10px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px;cursor:pointer;white-space:nowrap}
.ce-sresult:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-sloc{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-brand-primary,#6cb2ff);flex:none}
.ce-stext{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-secondary,#999);overflow:hidden;text-overflow:ellipsis}
`;

		/* ---------------- module ---------------- */

		const GuideIcon = () => h("svg", { viewBox: "0 0 64 64", width: 40, height: 40, "aria-hidden": true, fill: "none", stroke: "#59b7ff", strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } },
			h("path", { d: "M22 20 8 32l14 12" }),
			h("path", { d: "M42 20 56 32 42 44" }),
			h("path", { stroke: "#7de3a4", d: "M36 12 28 52" }),
		);

		const definition = (t) => ({
			id: TAB_ID,
			kind: TAB_KIND,
			priority: "extension",
			keepMounted: true,
			title: () => t("type.label"),
			guide: [
				{
					id: "code",
					commandId: "code.explorer",
					order: 15,
					title: () => t("guide.title"),
					description: () => t("guide.description"),
					icon: GuideIcon,
				},
			],
		});

		function insertStyles() {
			const id = `${TAB_ID}/styles`;
			if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(id)}]`) === null) {
				const tag = document.createElement("style");
				tag.dataset.plugin = TAB_ID;
				tag.dataset.pluginCss = id;
				tag.textContent = CSS;
				document.head.appendChild(tag);
				return () => tag.remove();
			}
			return () => {};
		}

		return {
			inject: ["slots", "locale", "sidebarRightTabs", "sidebarRight"],
			apply(ctx) {
				// One failing registration must not take the whole plugin down with it.
				const safe = (label, fn) => {
					try {
						ctx.effect(fn, label);
					} catch (error) {
						console.error(`code-explorer: ${label} failed`, error);
					}
				};
				safe("styles", insertStyles);
				const bound = ctx.locale.bind(NS);
				safe("dictionaries", () => ctx.locale.register(NS, { zh, en }));
				safe("tab type", () => ctx.sidebarRightTabs.register(definition(bound)));
				const Bound = (props) => h(CodeBody, { ...props, t: props.t ?? bound });
				safe("tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
					name: "sidebar.right.pane.tab",
					key: TAB_ID,
					locale: NS,
				}, Bound)));
				safe("tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
					name: "sidebar.right.pane.tab.title",
					key: TAB_ID,
				}, CodeTitle)));
				ctx.inject(["shortcuts"], (shortcutCtx) => {
					try {
						shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
							id: "code.explorer",
							label: () => bound("guide.title"),
							aliases: ["code explorer", "code browser", "daima"],
							defaults: {
								"desktop:macos": { code: "KeyE", modifiers: ["primary"] },
								"desktop:windows": { code: "KeyE", modifiers: ["primary"] },
								"desktop:linux": { code: "KeyE", modifiers: ["primary"] },
								"web:macos": { code: "KeyE", modifiers: ["primary", "alt"] },
								"web:windows": { code: "KeyE", modifiers: ["primary", "alt"] },
								"web:linux": { code: "KeyE", modifiers: ["primary", "alt"] },
							},
							regions: ["page", "editable", "terminal"],
							modals: [],
							resolve: ({ target: element }) => {
								const target = ctx.sidebarRight.commandTarget(element);
								if (target === void 0) return { status: "blocked", reason: bound("shortcut.noSession") };
								return { status: "handled", run: () => ctx.sidebarRight.openTabFromTarget(TAB_KIND, target) };
							},
						}), "code-explorer: open shortcut");
					} catch (error) {
						console.warn("code-explorer: open shortcut not registered", error);
					}
					try {
						shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
							id: "code.quickopen",
							label: () => bound("quickopen.command"),
							aliases: ["quick open", "file picker", "kuai su da kai"],
							defaults: {
								"desktop:macos": { code: "KeyP", modifiers: ["primary", "alt"] },
								"desktop:windows": { code: "KeyP", modifiers: ["primary", "alt"] },
								"desktop:linux": { code: "KeyP", modifiers: ["primary", "alt"] },
								"web:macos": { code: "KeyP", modifiers: ["primary", "alt", "shift"] },
								"web:windows": { code: "KeyP", modifiers: ["primary", "alt", "shift"] },
								"web:linux": { code: "KeyP", modifiers: ["primary", "alt", "shift"] },
							},
							regions: ["page", "editable", "terminal"],
							modals: [],
							resolve: ({ target: element }) => {
								const target = ctx.sidebarRight.commandTarget(element);
								if (target === void 0) return { status: "blocked", reason: bound("shortcut.noSession") };
								return {
									status: "handled",
									run: () => {
										ctx.sidebarRight.openTabFromTarget(TAB_KIND, target);
										setTimeout(() => document.dispatchEvent(new CustomEvent("dsh-ce-quick-open")), 250);
									},
								};
							},
						}), "code-explorer: quick-open shortcut");
					} catch (error) {
						console.warn("code-explorer: quick-open shortcut not registered", error);
					}
				});
			},
		};
	},
});
