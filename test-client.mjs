// Checks the client half: the pure helper ES modules, and the generated bundle's module
// registration (id + factory shape), against the sources they were built from.
import { readFile } from "node:fs/promises";
import { register } from "node:module";

// "react" is a browser platform seed word; serve it from a stub so the real modules load.
register("./test-support/esm-react-hook.mjs", import.meta.url);

const { buildLineStates, tokenizeLine, wordAt, langFor } = await import("./src/client/highlight.js");
const { parseDiff } = await import("./src/client/diff.js");
const sourceDescriptor = (await import("./src/client/index.js")).default;
const ReactStub = (await import("./test-support/react-stub.mjs")).default;

let pass = 0;
let fail = 0;
const check = (name, cond, extra) => {
	if (cond) {
		pass++;
		console.log(`  ok  ${name}`);
	} else {
		fail++;
		console.log(`FAIL  ${name}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ""}`);
	}
};

// block comment spanning lines
const lines = ["package main", "/* start", "middle", "end */", "func main() {}"];
const states = buildLineStates(lines);
check("state before comment", states[1] === 0, states);
check("state inside comment", states[2] === 1 && states[3] === 1, states);
check("state after comment", states[4] === 0, states);

const commentRuns = tokenizeLine("end */ fmt.Println", "go", 1);
check("closing comment run", commentRuns[0].cls === "ce-com" && commentRuns[0].s === "end */", commentRuns);
check("post-close identifier clickable", commentRuns.some((r) => r.word === "fmt" && r.cls === "ce-id" && r.startCol === 8), commentRuns);

const declRuns = tokenizeLine("func main() {}", "go", 0);
check("func keyword", declRuns[0].cls === "ce-kw" && declRuns[0].startCol === 1, declRuns);
check("main ident col", declRuns.some((r) => r.word === "main" && r.startCol === 6 && r.cls === "ce-id"), declRuns);

const strRuns = tokenizeLine(`\tname := "a\\"b" // tail`, "go", 0);
check("string with escape", strRuns.some((r) => r.cls === "ce-str" && r.s.includes("a\\\"b")), strRuns);
check("line comment after string", strRuns.some((r) => r.cls === "ce-com" && r.s === "// tail"), strRuns);

const blockOnLine = tokenizeLine("x := /* c */ y", "go", 0);
check("inline block comment not identifiers", !blockOnLine.some((r) => (r.cls === "ce-id" || r.cls === "ce-kw") && (r.word === "c")), blockOnLine);

const constRuns = tokenizeLine("const Greeter = 0x1F", "go", 0);
check("hex number", constRuns.some((r) => r.cls === "ce-num" && r.s === "0x1F"), constRuns);
check("type capitalized", constRuns.some((r) => r.word === "Greeter" && r.cls === "ce-type"), constRuns);

check("wordAt hit", wordAt("fmt.Println(helper(1))", 14)?.word === "helper", wordAt("fmt.Println(helper(1))", 14));
check("wordAt on last char", wordAt("helper(x)", 6)?.word === "helper", wordAt("helper(x)", 6));
check("wordAt after-boundary", wordAt("helper(x)", 7)?.word === "helper", wordAt("helper(x)", 7));
check("wordAt miss", wordAt("1 + 2", 3) === null, wordAt("1 + 2", 3));

check("langFor mapping", langFor("a/b/main.go") === "go" && langFor("x.ts") === "js" && langFor("readme.md") === "text", [langFor("a/b/main.go"), langFor("x.ts"), langFor("readme.md")]);
check(
	"langFor extended mapping",
	langFor("a.json") === "json" && langFor("b.yaml") === "yaml" && langFor("c.yml") === "yaml" && langFor("d.sh") === "sh" && langFor("e.toml") === "toml" && langFor("f.rs") === "rs" && langFor("g.java") === "java" && langFor("h.cpp") === "c" && langFor("i.sql") === "sql" && langFor("j.css") === "css" && langFor("k.pyi") === "py",
	[langFor("a.json"), langFor("b.yaml"), langFor("d.sh"), langFor("k.pyi")],
);

// json: property names distinct from string values, literals as keywords
const jsonRuns = tokenizeLine('{"name": "kit", "ok": true}', "json", 0);
check("json property name class", jsonRuns.some((r) => r.cls === "ce-prop" && r.s === '"name"'), jsonRuns);
check("json string value stays ce-str", jsonRuns.some((r) => r.cls === "ce-str" && r.s === '"kit"'), jsonRuns);
check("json literal keyword", jsonRuns.some((r) => r.cls === "ce-kw" && r.s === "true"), jsonRuns);

// yaml/sh: hash comments, and "http://" must NOT become a comment in hash langs
const yamlRuns = tokenizeLine("url: http://example.com # trailing", "yaml", 0);
check("yaml hash comment", yamlRuns.some((r) => r.cls === "ce-com" && r.s.includes("trailing")), yamlRuns);
check("yaml url slashes are not a comment", !yamlRuns.some((r) => r.cls === "ce-com" && r.s.includes("example")), yamlRuns);
const shRuns = tokenizeLine("if [ -f x ]; then echo hi; fi # done", "sh", 0);
check("sh keywords", shRuns.filter((r) => r.cls === "ce-kw").length >= 3, shRuns.filter((r) => r.cls === "ce-kw"));
check("sh hash comment", shRuns.some((r) => r.cls === "ce-com" && r.s === "# done"), shRuns);

// sql: case-insensitive keywords
const sqlRuns = tokenizeLine("SELECT name FROM users", "sql", 0);
check("sql uppercase keywords", sqlRuns.some((r) => r.cls === "ce-kw" && r.s === "SELECT") && sqlRuns.some((r) => r.cls === "ce-kw" && r.s === "FROM"), sqlRuns);

// buildLineStates: hash-comment langs never carry block-comment state
check("hash lang states stay zero", buildLineStates(["x /* unclosed", "next line"], "sh").every((s) => s === 0), buildLineStates(["x /* unclosed", "next line"], "sh"));
check("c-style lang still tracks block comments", buildLineStates(["x /* unclosed", "next line"], "go")[1] === 1, buildLineStates(["x /* unclosed", "next line"], "go"));

const diff = `diff --git a/main.go b/main.go
index 111..222 100644
--- a/main.go
+++ b/main.go
@@ -10,6 +10,8 @@ func main() {
 	fmt.Println(helper(1, 2))
+	var version = "0.1"
+
 }
-	old line
`;
const rows = parseDiff(diff);
check("diff meta skipped as meta", rows[0].kind === "meta");
check("diff hunk row", rows.some((r) => r.kind === "hunk"));
check("diff add numbered", rows.some((r) => r.kind === "add" && r.newLine === 11 && r.text.includes("version")), rows.filter((r) => r.kind === "add"));
check("diff del numbered", rows.some((r) => r.kind === "del" && r.oldLine != null));
check("diff context", rows.some((r) => r.kind === "ctx" && r.text.includes("Println")));

// --- call-diff synthesis (chat row -> side panel) ---------------------------------------
const { hunksFromBlock, unifiedFromHunks } = await import("./src/client/calldiff.js");
const settledBlock = {
	kind: "toolCall",
	call: { name: "edit", args: { file_path: "/w/a.go", old_string: "x", new_string: "y" } },
	meta: { diffs: [{ path: "/w/a.go", oldText: "x\nold2", newText: "y" }] },
};
const metaHunks = hunksFromBlock(settledBlock);
check("meta.diffs hunks win", metaHunks?.length === 1 && metaHunks[0].oldText === "x\nold2", metaHunks);
const uni = unifiedFromHunks(metaHunks);
check("unified text shape", uni.text === "--- a//w/a.go\n+++ b//w/a.go\n@@\n-x\n-old2\n+y", uni.text);
check("unified stats", uni.stats.add === 1 && uni.stats.del === 2, uni.stats);
const writeBlock = { kind: "toolCall", call: { name: "write", args: { file_path: "/w/b.txt", content: "c1\nc2" } }, meta: {} };
const writeHunks = hunksFromBlock(writeBlock);
check("write fallback hunk", writeHunks?.[0]?.newText === "c1\nc2" && writeHunks[0].oldText === "", writeHunks);
const failedBlock = { kind: "toolCall", isError: true, call: { name: "edit", args: { file_path: "/w/a.go", old_string: "o", new_string: "n" } } };
check("failed shows attempted", hunksFromBlock(failedBlock)?.[0]?.newText === "n", null);
const runningBlock = { name: "edit", args: { file_path: "/w/a.go", old_string: "o", new_string: "n" } };
check("running block intended hunks", hunksFromBlock(runningBlock)?.length === 1, null);
check("null block safe", hunksFromBlock(null) === null, null);

// --- markdown preview parser -------------------------------------------------------------
const { parseMarkdown } = await import("./src/client/markdown.js");
const md = "---\nname: x\ndescription: >-\n  folded\n---\n\n# Title\n\npara one\nline two\n\n```sh\nls -la\n```\n\n- a\n- b\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> quoted\n\n---\n";
const blocks = parseMarkdown(md);
check("md frontmatter stripped", blocks[0]?.kind === "h" && blocks[0].text === "Title", blocks[0]);
check("md paragraph folds lines", blocks[1]?.kind === "p" && blocks[1].text === "para one line two", blocks[1]);
check("md code fence", blocks[2]?.kind === "code" && blocks[2].lang === "sh" && blocks[2].text === "ls -la", blocks[2]);
check("md list", blocks[3]?.kind === "list" && !blocks[3].ordered && blocks[3].items.join() === "a,b", blocks[3]);
check("md table", blocks[4]?.kind === "table" && blocks[4].head.join() === "A,B" && blocks[4].body[0].join() === "1,2", blocks[4]);
check("md quote", blocks[5]?.kind === "quote" && blocks[5].text === "quoted", blocks[5]);
check("md hr", blocks[6]?.kind === "hr", blocks[6]);

// --- diff -> source marks -----------------------------------------------------------------
const { changedNewLines } = await import("./src/client/diff.js");
const markDiff = "@@ -1,3 +1,4 @@\n ctx1\n-old\n+new\n+added\n ctx2\n";
const marks = changedNewLines(markDiff);
check("changedNewLines picks new-side lines", marks.size === 2 && marks.has(2) && marks.has(3), [...marks]);
check("changedNewLines empty diff", changedNewLines("").size === 0, null);
const { changeBlobs } = await import("./src/client/diff.js");
const blobs = changeBlobs(new Set([5, 50, 51]), [52]);
check("changeBlobs merges near lines", blobs.length === 2 && blobs[0].start === 5 && blobs[1].start === 50 && blobs[1].end === 52 && blobs[1].kind === "del", blobs);
check("changeBlobs empty", changeBlobs(null, null).length === 0, null);
const { deletedGroups } = await import("./src/client/diff.js");
const delGroups = deletedGroups("@@ -1,4 +1,3 @@\n ctx\n-old1\n-old2\n+new\n tail\n");
check("deletedGroups anchors before next kept line", delGroups.size === 1 && delGroups.get(2)?.join() === "old1,old2", [...delGroups.entries()]);

// --- side-by-side pairing + word-level marks --------------------------------------------------
const { pairRows, intraLineDelta, intraMarks } = await import("./src/client/diff.js");
const sbsRows = parseDiff("@@ -1,3 +1,4 @@\n ctx\n-old line\n+new line\n+added\n");
const paired = pairRows(sbsRows);
check("pairRows pairs del+add into mod", paired.length === 4 && paired[2].kind === "mod" && paired[2].left.text === "old line" && paired[2].right.text === "new line", paired.map((p) => p.kind));
check("pairRows keeps unmatched add right-only", paired[3].kind === "add" && paired[3].left === null && paired[3].right.text === "added", paired[3]);
check("pairRows ctx spans both sides with same row", paired[1].kind === "ctx" && paired[1].left === paired[1].right, paired[1].kind);
const paired2 = pairRows(parseDiff("@@\n-a\n-b\n+c\n"));
check("pairRows unbalanced dels leave right empty", paired2.length === 3 && paired2[0].kind === "hunk" && paired2[1].kind === "mod" && paired2[2].kind === "del" && paired2[2].right === null, paired2.map((p) => p.kind));
const d1 = intraLineDelta("foo bar", "foo baz");
check("intraLineDelta isolates the changed word", d1.oldStart === 4 && d1.oldEnd === 7 && d1.newStart === 4 && d1.newEnd === 7, d1);
check("intraLineDelta identical lines → null", intraLineDelta("same", "same") === null, null);
const d2 = intraLineDelta("x z", "x y z");
check("intraLineDelta pure insertion → empty old range", d2.oldStart === d2.oldEnd && d2.newEnd > d2.newStart && "x y z".slice(d2.newStart, d2.newEnd) === "y ", d2);
const d3 = intraLineDelta("aaa", "bbb");
check("intraLineDelta full replace spans both lines", d3.oldStart === 0 && d3.oldEnd === 3 && d3.newStart === 0 && d3.newEnd === 3, d3);
const mkRows = parseDiff("@@\n-hello world\n+hello there\n");
const mk = intraMarks(mkRows);
check("intraMarks marks both sides of a pair", mk.size === 2, [...mk.values()]);
const mkDel = mk.get(mkRows.find((r) => r.kind === "del"));
const mkAdd = mk.get(mkRows.find((r) => r.kind === "add"));
check("intraMarks ranges cover the changed words", mkDel.start === 6 && mkDel.end === 11 && mkAdd.start === 6 && mkAdd.end === 11, { mkDel, mkAdd });
check("intraMarks skips unpaired rows", intraMarks(parseDiff("@@\n+only add\n")).size === 0, null);

// --- change tree ---------------------------------------------------------------------------
const { buildTree } = await import("./src/client/changetree.js");
const tree = buildTree([{ path: "a/b/c.go", ch: "M" }, { path: "a/b/d.go", ch: "M" }, { path: "a/x/e.go", ch: "U" }, { path: "top.go", ch: "M" }]);
check("tree root counts", tree.count === 4 && tree.files.length === 1, tree.count);
check("tree nests dirs", tree.dirs.get("a")?.count === 3 && tree.dirs.get("a").dirs.size === 2, tree.dirs.get("a"));
const chain = buildTree([{ path: "m/n/o/f.go", ch: "M" }]);
check("tree compresses single-child chains", chain.dirs.get("m")?.name === "m/n/o" && chain.dirs.get("m").files.length === 1, [...chain.dirs.values()].map((d) => d.name));
const { filesUnder } = await import("./src/client/changetree.js");
check("filesUnder collects subtree items", filesUnder(tree).length === 4 && filesUnder(tree.dirs.get("a")).length === 3, filesUnder(tree).length);

// --- tree drag & reveal helpers ------------------------------------------------------------------
const { ancestorDirs, parentDir, canDropInto } = await import("./src/client/pathtools.js");
check("ancestorDirs outermost first", JSON.stringify(ancestorDirs("a/b/c.txt")) === JSON.stringify(["a", "a/b"]), ancestorDirs("a/b/c.txt"));
check("ancestorDirs top-level file has none", ancestorDirs("top.txt").length === 0, ancestorDirs("top.txt"));
check("parentDir", parentDir("a/b/c.txt") === "a/b" && parentDir("top.txt") === "", [parentDir("a/b/c.txt"), parentDir("top.txt")]);
check("canDropInto allows cross-folder and to-root moves", canDropInto("a/x.txt", "b") === true && canDropInto("a/x.txt", "") === true, null);
check("canDropInto refuses self, descendant and same-folder", canDropInto("a", "a") === false && canDropInto("a", "a/b") === false && canDropInto("a/x.txt", "a") === false, null);
check("canDropInto refuses root no-op for top-level file", canDropInto("top.txt", "") === false, null);
const { fileTint } = await import("./src/client/changetree.js");
const { uniqueDirectoryEntries, createDirectoryRequests } = await import("./src/client/treemodel.js");
const duplicateDirectoryEntries = uniqueDirectoryEntries([{ name: "app", type: "directory" }, { name: "app", type: "directory" }, { name: "app", type: "file" }, { name: "bad/name", type: "directory" }, { name: "..", type: "directory" }]);
check("workspace listing dedupes duplicate directory names and unsafe entries", duplicateDirectoryEntries.length === 1 && duplicateDirectoryEntries[0].name === "app", duplicateDirectoryEntries);
const directoryRequests = createDirectoryRequests();
const oldDirectory = directoryRequests.begin("src"); directoryRequests.reset(); const newDirectory = directoryRequests.begin("src");
check("old directory request becomes stale after workspace reset", !oldDirectory() && newDirectory(), null);

// --- changes panel: staged/unstaged split + commit box --------------------------------------
const { ChangesPanel, isStagedXy } = await import("./src/client/changes.js");
const { ChangeTree: ChangeTreeCmp } = await import("./src/client/changetree.js");
check(
	"isStagedXy classifies porcelain xy",
	isStagedXy("M ") && isStagedXy("A ") && isStagedXy("MM") && isStagedXy("D ") && !isStagedXy(" M") && !isStagedXy(" D") && !isStagedXy("??"),
	null,
);
const fakeGit = {
	repo: true, root: "/w", branch: "main", base: null,
	working: [
		{ path: "a.go", xy: "M ", from: null },
		{ path: "b.go", xy: " M", from: null },
		{ path: "c.txt", xy: "??", from: null },
	],
	branchFiles: [], commits: [], upstream: null, ahead: 0, behind: 0,
};
const noop = () => {};
const openedDiffs = [];
const panel = ChangesPanel({
	cwd: "/w", t: (k) => k, git: fakeGit, repos: null, repoSel: null, onSelectRepo: noop,
	commitsOpen: false, setCommitsOpen: noop, onOpenCommit: noop, onOpenDiff: (p, s) => openedDiffs.push([p, s]),
	onDiscard: noop, onDiscardDir: noop, onStage: noop, onStageDir: noop,
	onUnstage: noop, onUnstageDir: noop, onCommit: () => true, committing: false, refresh: noop,
});
const collect = (node, out = []) => {
	if (Array.isArray(node)) { for (const n of node) collect(n, out); return out; }
	if (!node || typeof node !== "object") return out;
	if (node.type !== undefined) out.push(node);
	collect(node.children, out);
	return out;
};
const panelNodes = collect(panel);
const trees = panelNodes.filter((n) => n.type === ChangeTreeCmp);
const stagedTree = trees.find((n) => n.props.keyPrefix === "s");
const workingTree = trees.find((n) => n.props.keyPrefix === "w");
check("staged section tree has only the staged file", stagedTree && stagedTree.props.items.length === 1 && stagedTree.props.items[0].path === "a.go", stagedTree?.props?.items);
check("staged tree offers unstage but not stage/discard", stagedTree && stagedTree.props.onUnstage && !stagedTree.props.onStage && !stagedTree.props.onDiscard, Object.keys(stagedTree?.props ?? {}));
check("working tree has the two unstaged files", workingTree && workingTree.props.items.length === 2, workingTree?.props?.items);
check("working tree offers stage + discard", workingTree && workingTree.props.onStage && workingTree.props.onDiscard, Object.keys(workingTree?.props ?? {}));
stagedTree.props.onOpen({ path: "a.go" });
workingTree.props.onOpen({ path: "b.go" });
check(
	"staged rows open the staged diff, working rows the working diff",
	JSON.stringify(openedDiffs) === JSON.stringify([["a.go", "staged"], ["b.go", "working"]]),
	openedDiffs,
);
const commitBox = panelNodes.find((n) => n.props?.className === "ce-commitbox");
check("commit box rendered", Boolean(commitBox), null);
const commitBtn = collect(commitBox ?? []).find((n) => n.props?.className === "ce-commitbox-btn");
check("commit button targets the staged set", commitBtn && commitBtn.children.some((c) => String(c) === "✓ changes.commit"), commitBtn?.children);
const commitInput = collect(commitBox ?? []).find((n) => n.props?.className === "ce-input ce-commitbox-msg");
check("commit input placeholder for staged mode", commitInput?.props?.placeholder === "changes.commitPlaceholder", commitInput?.props);
const amendBtn = collect(commitBox ?? []).find((n) => n.type === "button" && n.props?.title === "changes.amendTitle");
check("commit box carries the amend toggle", Boolean(amendBtn) && amendBtn.children.includes("changes.amend"), amendBtn?.children);
const sections = panelNodes.filter((n) => n.props?.className === "ce-section");
check("changes panel renders the stash section", sections.some((s) => JSON.stringify(s.children ?? []).includes("stash.title")), sections.length);

const changesSearch = panelNodes.find((n) => n.props?.className === "ce-changes-search");
check("changes panel keeps path filtering separate from shared toolbar search", Boolean(changesSearch) && collect(changesSearch).some((n) => n.type === "input" && n.props.type === "search") && !collect(changesSearch).some((n) => n.type === "button"), null);

// --- Changes path copying in tree/list and staged/working/branch sections -------------------
const { copyChangePath, CopyChangePathButton } = await import("./src/client/copypath.js");
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const copiedChangePaths = [], copyFeedback = [];
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (path) => copiedChangePaths.push(path) } } });
try {
 await copyChangePath({ cwd: "/workspace", repo: "/workspace/nested-repo", path: "src/deleted.go", t: (key) => key, onNotify: (text) => copyFeedback.push(text) });
 check("changes absolute copy resolves against repository root including deleted files", copiedChangePaths.at(-1) === "/workspace/nested-repo/src/deleted.go", copiedChangePaths);
 await copyChangePath({ cwd: "/workspace", repo: "/workspace/nested-repo", path: "src/deleted.go", relative: true, t: (key) => key });
 check("changes relative copy retains repo-relative path", copiedChangePaths.at(-1) === "src/deleted.go", copiedChangePaths);
 const copyTree = collect(ChangeTreeCmp({ items: [{ path: "src/deep/deleted.go", ch: "D" }], cwd: "/workspace", repo: "/workspace/nested-repo", scope: "working", t: (key) => key, onCopyPath: (path, relative) => copyChangePath({ cwd: "/workspace", repo: "/workspace/nested-repo", path, relative, t: (key) => key }), onOpen() { throw Error("copy must not open diff"); } }));
 const copies = copyTree.filter((n) => n.type === CopyChangePathButton);
 check("change tree exposes copy on compressed directories and files", copies.some((n) => n.props.path === "src/deep") && copies.some((n) => n.props.path === "src/deep/deleted.go"), copies.map((n) => n.props.path));
 let copyStopped = false;
 const directoryCopy = CopyChangePathButton(copies.find((n) => n.props.path === "src/deep").props);
 directoryCopy.props.onClick({ altKey: false, stopPropagation() { copyStopped = true; } });
 await new Promise((resolve) => setImmediate(resolve));
 check("directory copy does not expand row and copies absolute path", copyStopped && copiedChangePaths.at(-1) === "/workspace/nested-repo/src/deep", copiedChangePaths);
 const fileCopy = CopyChangePathButton(copies.find((n) => n.props.path.endsWith("deleted.go")).props);
 fileCopy.props.onClick({ altKey: true, stopPropagation() {} }); await new Promise((resolve) => setImmediate(resolve));
 check("Alt-click on file copy chooses relative path", copiedChangePaths.at(-1) === "src/deep/deleted.go", copiedChangePaths);
 check("copy-enabled change rows contain no nested buttons", copyTree.filter((n) => n.type === "button").every((n) => !collect(n.children).some((child) => child.type === "button")), null);
 const { createHookRenderer: createCopyRenderer } = await import("./test-support/react-stub.mjs");
 const renderCopyPanel = createCopyRenderer(ChangesPanel, { cwd: "/workspace", t: (key) => key, git: { ...fakeGit, root: "/workspace/nested-repo", base: { name: "origin/main" }, branchFiles: ["committed.go"] }, onOpenDiff() {}, onSelectRepo() {} });
 let copyPanel = renderCopyPanel();
 check("staged working and branch trees receive copy callbacks", collect(copyPanel).filter((n) => n.type === ChangeTreeCmp).length === 3 && collect(copyPanel).filter((n) => n.type === ChangeTreeCmp).every((n) => typeof n.props.onCopyPath === "function"), null);
 collect(copyPanel).find((n) => n.props.title === "changes.toList").props.onClick(); copyPanel = renderCopyPanel();
 const listCopyNodes = collect(copyPanel).filter((n) => n.type === CopyChangePathButton);
 check("flat changes list exposes copy for all change scopes", ["a.go", "b.go", "c.txt", "committed.go"].every((path) => listCopyNodes.some((n) => n.props.path === path)), listCopyNodes.map((n) => n.props.path));
 globalThis.navigator.clipboard.writeText = async () => { throw Error("permission denied"); };
 const copied = await copyChangePath({ cwd: "/workspace", path: "a.go", t: (key) => key, onNotify: (text, kind) => copyFeedback.push({ text, kind }) });
 check("clipboard failure reports an error rather than false success", copied === false && copyFeedback.at(-1).text === "changes.copyFailed" && copyFeedback.at(-1).kind === "error", copyFeedback);
} finally { if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor); else delete globalThis.navigator; }

// --- file history overlay ------------------------------------------------------------------------
const { FileHistoryOverlay } = await import("./src/client/overlays.js");
let pickedCommit = null;
const histEl = FileHistoryOverlay({
	t: (k) => k,
	hist: { path: "a/b.go", commits: [{ hash: "abc1234", when: "2 days ago", author: "t", subject: "fix thing" }] },
	onPick: (c) => { pickedCommit = c; },
	onClose: () => {},
});
const histNodes = collect(histEl);
const histRow = histNodes.find((n) => n.props?.className === "ce-histrow");
check("history overlay renders commit rows", Boolean(histRow) && JSON.stringify(histRow.children).includes("fix thing") && JSON.stringify(histRow.children).includes("t · 2 days ago"), histRow?.children);
histRow.props.onClick();
check("clicking a history row picks its commit", pickedCommit?.hash === "abc1234", pickedCommit);
const histBusy = collect(FileHistoryOverlay({ t: (k) => k, hist: { path: "x", busy: true }, onPick: () => {}, onClose: () => {} }));
check("history overlay shows loading while busy", histBusy.some((n) => (n.children ?? []).includes?.("loading")) || JSON.stringify(histBusy).includes('"loading"'), null);
const histEmpty = collect(FileHistoryOverlay({ t: (k) => k, hist: { path: "x", commits: [] }, onPick: () => {}, onClose: () => {} }));
check("history overlay empty state", JSON.stringify(histEmpty).includes("history.none"), null);
const panelNoStaged = ChangesPanel({
	cwd: "/w", t: (k) => k,
	git: { ...fakeGit, working: fakeGit.working.filter((f) => f.xy !== "M ") },
	repos: null, repoSel: null, onSelectRepo: noop, commitsOpen: false, setCommitsOpen: noop,
	onOpenCommit: noop, onOpenDiff: noop, onDiscard: noop, onDiscardDir: noop,
	onStage: noop, onStageDir: noop, onUnstage: noop, onUnstageDir: noop,
	onCommit: () => true, committing: false, refresh: noop,
});
const btnAll = collect(panelNoStaged).find((n) => n.props?.className === "ce-commitbox-btn");
check("nothing staged → stage-all-and-commit label", btnAll && btnAll.children.some((c) => String(c) === "✓ changes.commitAll"), btnAll?.children);

// --- code view row builders -------------------------------------------------------------------
const { buildTokenCells, computeWrapRows, WRAP_LINE_CAP } = await import("./src/client/codeview.js");
const goCells = buildTokenCells("func main() {}", "go", 0, 7, null);
check("buildTokenCells tags go identifiers with jump hooks", goCells.some((c) => c.props["data-ce-w"] === "main" && c.props["data-ce-l"] === 7 && String(c.props.className).includes("ce-jump")), goCells.map((c) => c.props));
const flashCells = buildTokenCells("x := helper(1)", "go", 0, 1, { line: 1, col: 6, word: "helper" });
check("buildTokenCells flash marks the exact token", flashCells.some((c) => String(c.props.className).includes("ce-mark")), flashCells.map((c) => c.props.className));
const textCells = buildTokenCells("hello world", "text", 0, 1, null);
check("buildTokenCells plain text has no jump hooks", textCells.every((c) => c.props["data-ce-l"] === undefined), textCells.map((c) => c.props));
const jsCells = buildTokenCells("const kit = 1;", "js", 0, 3, null);
check("buildTokenCells js identifiers are jumpable", jsCells.some((c) => c.props["data-ce-w"] === "kit" && String(c.props.className).includes("ce-jump")), jsCells.map((c) => c.props));
const jsonCells = buildTokenCells('{"a": 1}', "json", 0, 1, null);
check("buildTokenCells json tokens are not jumpable", jsonCells.every((c) => c.props["data-ce-l"] === undefined), jsonCells.map((c) => c.props));
const wrapDoc = { path: "a.go", lines: ["aa", "bb", "cc"], states: buildLineStates(["aa", "bb", "cc"]) };
const wrap = computeWrapRows({ doc: wrapDoc, flash: null, diffMarks: null, delAnchors: [], delGroups: null, cursor: { line: 2 }, findLines: new Set(), t: (k) => k, onDelPreview: () => {} });
check("computeWrapRows builds one flow row per line", wrap.rows.length === 3 && wrap.capped === false, wrap.rows.length);
check("computeWrapRows rows carry data-wl markers", wrap.rows[1].props["data-wl"] === 2, wrap.rows[1].props);
check("computeWrapRows cursor line number highlighted", String(wrap.rows[1].children[0].props.className).includes("ce-wlineno-active"), wrap.rows[1].children[0].props);
const wrapDel = computeWrapRows({ doc: { path: "a.go", lines: ["keep1", "keep2"], states: buildLineStates(["keep1", "keep2"]) }, flash: null, diffMarks: new Set([2]), delAnchors: [2], delGroups: new Map([[2, ["gone"]]]), cursor: null, findLines: new Set([1]), t: (k) => k, onDelPreview: () => {} });
check("computeWrapRows interleaves deletion bars at anchors", wrapDel.rows.length === 3 && String(wrapDel.rows[1].props.className).includes("ce-delbar"), wrapDel.rows.map((r) => r.props.className));
check("computeWrapRows propagates find + changed marks", String(wrapDel.rows[0].children[0].props.className).includes("ce-gline-find") && String(wrapDel.rows[2].props.className).includes("ce-line-changed"), [wrapDel.rows[0].children[0].props.className, wrapDel.rows[2].props.className]);
check("WRAP_LINE_CAP is a sane perf cap", WRAP_LINE_CAP >= 1000 && WRAP_LINE_CAP <= 20000, WRAP_LINE_CAP);

// --- find-in-file matcher -------------------------------------------------------------------------
const { compileFindRe, findRangesInLine, escapeRe } = await import("./src/client/codeview.js");
check("escapeRe neutralizes metachars", escapeRe("a.b*c") === "a\\.b\\*c", escapeRe("a.b*c"));
check("compileFindRe empty query → null", compileFindRe("", {}) === null, null);
check("compileFindRe invalid regex → false", compileFindRe("([", { regex: true }) === false, null);
const litRe = compileFindRe("Foo", {});
check("literal default is case-insensitive", findRangesInLine("foo FOO bar", litRe).length === 2, findRangesInLine("foo FOO bar", litRe));
const csRe = compileFindRe("Foo", { caseSensitive: true });
check("caseSensitive matches exact case only", findRangesInLine("foo FOO Foo", csRe).length === 1, findRangesInLine("foo FOO Foo", csRe));
const wRe = compileFindRe("cat", { words: true });
check("whole word skips substrings", findRangesInLine("cat concat cat", wRe).length === 2, findRangesInLine("cat concat cat", wRe));
const rxRe = compileFindRe("f\\d+", { regex: true });
const rxHits = findRangesInLine("f1 f22 x", rxRe);
check("regex mode finds pattern matches", rxHits.length === 2 && rxHits[1].text === "f22" && rxHits[1].start === 3, rxHits);
check("zero-length regex cannot loop", findRangesInLine("abc", compileFindRe("x*", { regex: true })).length === 0, null);
const litMeta = compileFindRe("a.c", {});
check("literal mode treats metachars literally", findRangesInLine("abc a.c", litMeta).length === 1 && findRangesInLine("abc a.c", litMeta)[0].start === 4, findRangesInLine("abc a.c", litMeta));

// --- workspace replace ---------------------------------------------------------------------------
const { replaceInText, buildReplaceRe, escapeReLocal } = await import("./src/client/replace.js");
check("escapeReLocal neutralizes metachars", escapeReLocal("a.b$c") === "a\\.b\\$c", escapeReLocal("a.b$c"));
check("buildReplaceRe empty → null", buildReplaceRe("", {}) === null && buildReplaceRe("([", { regex: true }) === null, null);
let rp = replaceInText("foo bar foo", "foo", "FOO", {});
check("literal replace-all with smart-case", rp.count === 2 && rp.text === "FOO bar FOO", rp);
rp = replaceInText("Foo foo", "Foo", "X", {});
check("uppercase query stays case-sensitive", rp.count === 1 && rp.text === "X foo", rp);
rp = replaceInText("price $5", "$5", "€5", {});
check("literal $ in query is escaped", rp.count === 1 && rp.text === "price €5", rp);
rp = replaceInText("x", "x", "$&$&", {});
check("literal mode keeps $ literal in replacement", rp.count === 1 && rp.text === "$&$&", rp);
rp = replaceInText("cat concat", "cat", "dog", { words: true });
check("whole-word replace skips substrings", rp.count === 1 && rp.text === "dog concat", rp);
rp = replaceInText("a1 b2", "(\\w)(\\d)", "$2$1", { regex: true });
check("regex mode supports capture refs", rp.count === 2 && rp.text === "1a 2b", rp);
rp = replaceInText("l1\nfoo\nl2", "^foo$", "bar", { regex: true });
check("multiline anchors work across lines in regex mode", rp.count === 1 && rp.text === "l1\nbar\nl2", rp);
rp = replaceInText("l1\n^foo$\nl2", "^foo$", "bar", {});
check("literal mode treats anchors as text", rp.count === 1 && rp.text === "l1\nbar\nl2", rp);
rp = replaceInText("abc", "zzz", "x", {});
check("no match leaves text untouched", rp.count === 0 && rp.text === "abc", rp);
rp = replaceInText("abc", "([", "x", { regex: true });
check("invalid regex replace is a no-op", rp.count === 0 && rp.text === "abc", rp);

// --- search match highlighting -----------------------------------------------------------------
const { matchRanges, highlightText } = await import("./src/client/searchpanel.js");
check("matchRanges literal smart-case finds all", JSON.stringify(matchRanges("foo Bar foo", "foo", false)) === JSON.stringify([[0, 3], [8, 11]]), matchRanges("foo Bar foo", "foo", false));
check("matchRanges uppercase query is case-sensitive", matchRanges("foo bar", "Foo", false).length === 0, matchRanges("foo bar", "Foo", false));
check("matchRanges regex mode", JSON.stringify(matchRanges("abc abc", "a.c", true)) === JSON.stringify([[0, 3], [4, 7]]), matchRanges("abc abc", "a.c", true));
check("matchRanges invalid regex degrades to none", matchRanges("abc", "([", true).length === 0, null);
check("matchRanges zero-length regex cannot loop", matchRanges("abc", "x*", true).length <= 60, null);
check("matchRanges empty inputs", matchRanges("", "a", false).length === 0 && matchRanges("a", "", false).length === 0, null);
const hlOut = highlightText("aXa", [[1, 2]]);
check("highlightText splits into before/mark/after", Array.isArray(hlOut) && hlOut.length === 3 && hlOut[0] === "a" && hlOut[1].props.className === "ce-shl" && hlOut[1].children[0] === "X" && hlOut[2] === "a", hlOut);
check("highlightText no ranges returns raw string", highlightText("plain", []) === "plain", null);
const hlFull = highlightText("xx", [[0, 2]]);
check("highlightText full-range has no empty tails", Array.isArray(hlFull) && hlFull.length === 1, hlFull);

// --- Internal file drags keep opening, tab ordering and disk moves distinct ----------------
const { FILE_DRAG_TYPE, fileDragProps, readFileDrag, hasFileDrag, reorderFileTabs, dragFilePath } = await import("./src/client/filedrag.js");
const makeTransfer = () => ({ data: new Map(), types: [], effectAllowed: "", setData(type, value) { this.data.set(type, value); this.types = [...this.data.keys()]; }, getData(type) { return this.data.get(type) ?? ""; } });
const fileTransfer = makeTransfer();
fileDragProps({ cwd: "/w", path: "src/file.ts", sessionId: "A" }).onDragStart({ dataTransfer: fileTransfer, stopPropagation() {}, preventDefault() {} });
check("tree drag publishes typed payload and allows open or move", hasFileDrag(fileTransfer) && readFileDrag(fileTransfer, "/w", "A")?.source === "tree" && fileTransfer.effectAllowed === "copyMove", null);
check("file drop refuses another session or workspace", readFileDrag(fileTransfer, "/w", "B") === null && readFileDrag(fileTransfer, "/other", "A") === null, null);
check("plain text external files are never treated as internal drags", !hasFileDrag({ types: ["text/plain", "Files"] }) && readFileDrag({ getData: () => "src/file.ts" }, "/w", "A") === null, null);
const traversalTransfer = makeTransfer(); traversalTransfer.setData(FILE_DRAG_TYPE, JSON.stringify({ version: 1, cwd: "/w", path: "../secret", kind: "file", source: "tree" }));
check("typed drop refuses parent traversal", readFileDrag(traversalTransfer, "/w", "A") === null, null);
const changeTransfer = makeTransfer();
fileDragProps({ cwd: "/w", repo: "/w/nested", path: "deleted.ts", scope: "staged", source: "changes", sessionId: "A" }).onDragStart({ dataTransfer: changeTransfer, stopPropagation() {}, preventDefault() {} });
check("changes drag retains exact repo and diff scope", readFileDrag(changeTransfer, "/w", "A")?.scope === "staged" && dragFilePath(readFileDrag(changeTransfer, "/w", "A")) === "/w/nested/deleted.ts" && changeTransfer.effectAllowed === "copy", null);
const order = ["a", "b", "c"];
check("editor tab drop reorders without adding duplicate tabs", reorderFileTabs(order, "c", "a").join() === "c,a,b" && reorderFileTabs(order, "a").join() === "b,c,a" && reorderFileTabs(order, "b", "b") === order, null);
const dragChangeNodes = collect(ChangeTreeCmp({ items: [{ path: "deleted.ts", ch: "D" }], cwd: "/w", repo: "/w/repo", scope: "working", sessionId: "A", onOpen() {}, t: (key) => key }));
const deletedDragRow = dragChangeNodes.find((value) => value.props.title === "deleted.ts");
check("deleted change files remain draggable for diff viewing", deletedDragRow?.props.draggable === true && typeof deletedDragRow.props.onDragStart === "function", null);

// --- guide launcher contract ---------------------------------------------------------------
const { collectBoxes, groupOf, makeLauncher } = await import("./src/client/launcher.js");
check("groupOf mapping", groupOf("files") === "code" && groupOf("code-skills") === "skills" && groupOf("terminal") === "run" && groupOf("weird") === "more", [groupOf("files"), groupOf("code-skills"), groupOf("terminal"), groupOf("weird")]);
const fakeRegistry = {
	entries: () => [
		{ kind: "terminal", guide: [{ id: "t", order: 5, title: () => "Terminal" }] },
		{ kind: "code", guide: [{ id: "c", order: 1, title: () => "Code", description: () => "d" }] },
		{ kind: "code-skills", guide: [{ id: "s", order: 2, title: () => "Skills" }] },
	],
};
const boxes = collectBoxes(fakeRegistry);
check("collectBoxes groups and orders", boxes.map((b) => b.group).join() === "code,run,skills", boxes.map((b) => b.group));
check("collectBoxes bad registry", collectBoxes({ entries: () => { throw new Error("x"); } }).length === 0, null);
const filteredBoxes = collectBoxes({ entries: () => [{ kind: "files", guide: [{ id: "files", title: () => "Workspace files" }] }, ...fakeRegistry.entries()] });
check("launcher hides redundant workspace files entry", filteredBoxes.every((box) => box.kind !== "files") && filteredBoxes.length === boxes.length, filteredBoxes.map((box) => box.kind));
const Launch = makeLauncher({ registry: fakeRegistry, sidebarRight: { openTab: () => {} }, getShortcuts: () => null, t: (k) => k });
check("launcher renders element", Launch({}) != null, null);
check("launcher null on empty registry", makeLauncher({ registry: { entries: () => [] }, sidebarRight: { openTab: () => {} }, getShortcuts: () => null, t: (k) => k })({}) === null, null);

// --- Native left navigation routes tools to the current right-side workspace ----------------
const { collectLeftTools, makeLeftToolRouter, installLeftTools, WorkspaceGuide } = await import("./src/client/lefttools.js");
const { definition, apiDefinition, skillsDefinition } = await import("./src/client/register.js");
const leftDefinitions = [definition((k) => k), apiDefinition((k) => k), skillsDefinition((k) => k),
 { kind: "files", guide: [{ id: "f", title: () => "Files" }] },
 { kind: "browser", guide: [{ id: "browser", title: () => "Browser", order: 1 }] },
 { kind: "terminal", guide: [{ id: "terminal", title: () => "Terminal", order: 2 }] },
];
const leftRegistryListeners = new Set();
const leftRegistry = { entries: () => leftDefinitions, subscribe(fn) { leftRegistryListeners.add(fn); return () => leftRegistryListeners.delete(fn); } };
const leftTools = collectLeftTools(leftRegistry, (k) => k);
check("left navigation collects workspace API skills browser and terminal", leftTools.map((tool) => tool.kind).join() === "code,code-api,code-skills,browser,terminal", leftTools.map((tool) => tool.kind));
check("owned tools have no duplicate right guide entries", leftDefinitions.slice(0,3).every((entry) => entry.guide.length === 0), null);
check("right workspace guide contains no launcher buttons", !collect(WorkspaceGuide({ t: (k) => k })).some((node) => node.type === "button"), null);
let selectedLeftPanel = null;
let leftSession = "session-A";
let onScreenSession = "session-A";
let rightExpanded = false;
const leftNavigationCalls = [], leftNavigationNotices = [], leftLayoutListeners = new Set();
const leftSlots = new Map();
const leftLayout = {
 panelInfo: { getSnapshot: () => ({ activePanelId: selectedLeftPanel }), subscribe(fn) { leftLayoutListeners.add(fn); return () => leftLayoutListeners.delete(fn); } },
 selectPanel(id) {
  if (id !== null && !leftSlots.has(`main:${id}`)) throw Error(`Missing main seat: ${id}`);
  selectedLeftPanel = id; onScreenSession = id === null ? leftSession : undefined;
  for (const listener of leftLayoutListeners) listener();
 },
};
const leftSidebar = {
 mounted: { getSnapshot: () => onScreenSession },
 commandTarget(element) { check("left tool target uses restored Conversation instead of sidebar DOM", element === null && selectedLeftPanel === null, null); return onScreenSession ? { sessionId: onScreenSession, paneId: "right" } : undefined; },
 openTabFromTarget(kind, target) { leftNavigationCalls.push({ kind, sessionId: target.sessionId }); rightExpanded = true; },
 tabsIn(sessionId) { return sessionId === "session-A" ? [{ id: "browser-A", kind: "browser" }] : []; },
 focus(id) { leftNavigationCalls.push({ focus: id, sessionId: onScreenSession }); },
 isExpanded: () => rightExpanded,
 toggleExpanded() { rightExpanded = !rightExpanded; },
 openTab(kind, options) { leftNavigationCalls.push({ kind, options, sessionId: onScreenSession }); },
};
const contextLeft = {
 layout: leftLayout, sidebarRight: leftSidebar, sidebarRightTabs: leftRegistry,
 slots: {
  inject(_name, register) { return register(); },
  register(options, component) { const key = `${options.name}:${options.key ?? options.id}`; leftSlots.set(key, { options, component }); return () => leftSlots.delete(key); },
 },
};
const disposeLeftTools = installLeftTools(contextLeft, (k) => k);
check("tools use native same-level panel rows with matching main seats", leftTools.every((tool) => leftSlots.has(`sidebar.panellist:${tool.id}`) && leftSlots.has(`main:${tool.id}`)), [...leftSlots.keys()]);
for (const kind of ["code", "code-api", "code-skills"]) {
 leftLayout.selectPanel(leftTools.find((tool) => tool.kind === kind).id);
 check(`left ${kind} opens in current right workspace and preserves Conversation`, selectedLeftPanel === null && leftNavigationCalls.at(-1)?.kind === kind && leftNavigationCalls.at(-1)?.sessionId === "session-A", leftNavigationCalls.at(-1));
}
onScreenSession = undefined; selectedLeftPanel = "plugins";
leftLayout.selectPanel(leftTools.find((tool) => tool.kind === "code-api").id);
check("tool click from global Plugins returns to conversation and opens right API", selectedLeftPanel === null && leftNavigationCalls.at(-1)?.kind === "code-api", leftNavigationCalls.at(-1));
leftSession = "session-B";
leftLayout.selectPanel(leftTools.find((tool) => tool.kind === "code-skills").id);
check("left tool click follows current session instead of captured old session", leftNavigationCalls.at(-1)?.sessionId === "session-B", leftNavigationCalls.at(-1));
leftSession = "session-A"; rightExpanded = false;
leftLayout.selectPanel(leftTools.find((tool) => tool.kind === "browser").id);
check("left browser entry reuses existing page and reveals collapsed workspace", rightExpanded && leftNavigationCalls.at(-1)?.focus === "browser-A", leftNavigationCalls.at(-1));
const leftBeforeMissing = leftNavigationCalls.length;
leftSession = undefined;
leftLayout.selectPanel(leftTools.find((tool) => tool.kind === "code").id);
check("no-session tool click preserves Conversation and opens no unrelated session", selectedLeftPanel === null && leftNavigationCalls.length === leftBeforeMissing, null);
leftSession = "later-session";
for (const listener of leftLayoutListeners) listener();
check("missing-session tool click is not queued into a future session", leftNavigationCalls.length === leftBeforeMissing, null);
// Independent router reports failures through visible notices, without keeping a stale target.
const reportRouter = makeLeftToolRouter({ layout: leftLayout, sidebarRight: leftSidebar, getTools: () => leftTools, report: (text) => leftNavigationNotices.push(text), t: (k) => k });
selectedLeftPanel = leftTools[0].id; leftSession = undefined; reportRouter();
check("missing session produces clear navigation feedback", leftNavigationNotices.at(-1) === "shortcut.noSession", leftNavigationNotices);
selectedLeftPanel = "schedules"; reportRouter();
check("native automation panel selection remains untouched", selectedLeftPanel === "schedules", selectedLeftPanel);
selectedLeftPanel = null;
leftDefinitions.push({ kind: "new-tool", guide: [{ id: "new", title: () => "New Tool" }] });
for (const listener of leftRegistryListeners) listener();
check("newly registered tools receive a left entry dynamically", [...leftSlots.values()].some(({ options }) => options.name === "sidebar.panellist" && options.label?.() === "New Tool"), null);
leftDefinitions.pop(); for (const listener of leftRegistryListeners) listener();
check("removed tools release left entries and main seats", ![...leftSlots.values()].some(({ options }) => options.label?.() === "New Tool"), null);
disposeLeftTools();
check("plugin unload releases all left registrations and subscriptions", leftSlots.size === 0 && leftLayoutListeners.size === 0 && leftRegistryListeners.size === 0, { slots: leftSlots.size, layout: leftLayoutListeners.size, registry: leftRegistryListeners.size });

// --- Tool toggle closes exact current-session tabs; sole guide is not a tool -----------------
let toggleSession = "A", togglePanel = null, toggleBlocked = false;
let toggleSerial = 0;
const toggleSessions = new Map([["A", [{ id: "guide-A", kind: "guide" }]], ["B", [{ id: "foreign-code", kind: "code" }]]]);
const toggleExpanded = new Map([["A", false], ["B", true]]);
const toggleActive = new Map();
const toggleCalls = [], toggleNotices = [];
const toggleLayout = { panelInfo: { getSnapshot: () => ({ activePanelId: togglePanel }) }, selectPanel: (id) => { togglePanel = id; } };
const toggleSidebar = {
 mounted: { getSnapshot: () => toggleSession },
 commandTarget: () => toggleSession ? { sessionId: toggleSession, paneId: "dock" } : undefined,
 tabsIn: (id) => toggleSessions.get(id) ?? [],
 active: () => (toggleSessions.get(toggleSession) ?? []).find((tab) => tab.id === toggleActive.get(toggleSession)),
 isExpanded: () => toggleExpanded.get(toggleSession) ?? false,
 toggleExpanded: () => { toggleExpanded.set(toggleSession, !toggleExpanded.get(toggleSession)); },
 focus: (id) => { toggleActive.set(toggleSession, id); toggleCalls.push({ focus: id }); },
 openTabFromTarget(kind, target) {
  const id = `${kind}-${++toggleSerial}`;
  toggleSessions.set(target.sessionId, [...this.tabsIn(target.sessionId), { id, kind }]);
  toggleActive.set(target.sessionId, id); toggleExpanded.set(target.sessionId, true); toggleCalls.push({ open: kind, id });
 },
 openTab(kind) { this.openTabFromTarget(kind, { sessionId: toggleSession }); },
 close(id) {
  if (toggleBlocked) throw Error("unsaved changes");
  toggleSessions.set(toggleSession, this.tabsIn(toggleSession).filter((tab) => tab.id !== id));
  toggleCalls.push({ close: id });
 },
};
const routeToggle = makeLeftToolRouter({ layout: toggleLayout, sidebarRight: toggleSidebar, getTools: () => leftTools, report: (text) => toggleNotices.push(text), t: (key) => key });
const clickToggle = (kind) => { togglePanel = leftTools.find((tool) => tool.kind === kind).id; routeToggle(); };
clickToggle("code");
const firstToggleCode = toggleSidebar.tabsIn("A").find((tab) => tab.kind === "code").id;
check("first tool click opens and expands workspace", toggleSidebar.isExpanded() && toggleCalls.at(-1)?.open === "code", toggleCalls);
clickToggle("code-api");
clickToggle("code");
check("clicking existing inactive tool closes only its tab", toggleCalls.at(-1)?.close === firstToggleCode && toggleSidebar.tabsIn("A").some((tab) => tab.kind === "code-api") && toggleSidebar.isExpanded(), toggleCalls);
clickToggle("code-api");
check("last tool close collapses sidebar despite retained guide", !toggleSidebar.isExpanded() && toggleSidebar.tabsIn("A").every((tab) => tab.kind === "guide"), toggleSidebar.tabsIn("A"));
check("tool close never affects another session", toggleSidebar.tabsIn("B")[0]?.id === "foreign-code", toggleSidebar.tabsIn("B"));
clickToggle("code");
toggleSidebar.toggleExpanded(); const beforeHiddenToggle = toggleCalls.length;
clickToggle("code");
check("clicking hidden tool reveals it instead of deleting it", toggleSidebar.isExpanded() && toggleCalls.length === beforeHiddenToggle + 1 && Boolean(toggleCalls.at(-1)?.focus) && toggleSidebar.tabsIn("A").some((tab) => tab.kind === "code"), toggleCalls);
toggleBlocked = true; const tabsBeforeVeto = toggleSidebar.tabsIn("A");
clickToggle("code");
check("close veto preserves tab and expanded workspace", toggleSidebar.tabsIn("A") === tabsBeforeVeto && toggleSidebar.isExpanded() && toggleNotices.at(-1)?.includes("unsaved changes"), toggleNotices);
toggleBlocked = false; clickToggle("code");
clickToggle("browser"); clickToggle("browser"); const browserBeforeReopen = toggleSerial;
clickToggle("browser");
check("browser can reopen immediately after being toggled closed", toggleSerial === browserBeforeReopen + 1 && toggleSidebar.tabsIn("A").some((tab) => tab.kind === "browser"), toggleCalls);
clickToggle("browser");
toggleSessions.set("A", [{ id: "guide-A", kind: "guide" }, { id: "terminal-one", kind: "terminal" }, { id: "terminal-two", kind: "terminal" }]);
toggleExpanded.set("A", true); toggleActive.set("A", "terminal-one");
clickToggle("terminal");
check("multiple terminals close the active matching instance only", toggleCalls.at(-1)?.close === "terminal-one" && toggleSidebar.tabsIn("A").some((tab) => tab.id === "terminal-two") && toggleSidebar.isExpanded(), toggleSidebar.tabsIn("A"));
clickToggle("terminal");
check("closing final terminal collapses workspace", !toggleSidebar.isExpanded(), null);

// --- browser launch reuse, including existing multi-instance tabs ------------------------------
const { makeBrowserOpener } = await import("./src/client/launcher.js");
let browserSession = "A";
let browserTime = 0;
const browserTabs = new Map([["A", []], ["B", []]]);
const browserOpens = [];
const browserFocuses = [];
const browserSidebar = {
	mounted: { getSnapshot: () => browserSession },
	tabsIn: (id) => browserTabs.get(id),
	focus: (id) => browserFocuses.push(id),
	openTab: (kind, options) => browserOpens.push({ session: browserSession, kind, options }),
};
const openBrowser = makeBrowserOpener(browserSidebar, () => browserTime);
openBrowser(); openBrowser();
check("rapid browser clicks allocate only one page before inventory catches up", browserOpens.length === 1 && browserOpens[0].options === undefined, browserOpens);
browserTabs.set("A", [{ id: "existing-browser", kind: "browser", contentId: "sidebar://browser/old-uuid" }]);
browserTime = 1000; openBrowser();
check("browser launcher reuses historical UUID tab without resetting its URL", browserOpens.length === 1 && browserFocuses.at(-1) === "existing-browser", browserFocuses);
browserSession = "B"; openBrowser();
check("browser reuse is scoped to the current session", browserOpens.length === 2 && browserOpens[1].session === "B", browserOpens);
browserSession = "A"; browserTabs.set("A", []); browserTime = 2000; openBrowser();
check("closing existing browser permits a new browser launch", browserOpens.length === 3, browserOpens);
const inventoryFocus = [];
const inventoryOpen = makeBrowserOpener({ mounted: { getSnapshot: () => "A" }, openTabs: { getSnapshot: () => [{ sessionId: "B", kind: "browser", tabId: "foreign" }, { sessionId: "A", kind: "browser", tabId: "floated" }] }, focus: (id) => inventoryFocus.push(id), openTab: () => { throw new Error("must focus existing browser"); } });
inventoryOpen();
check("browser reuse falls back to public open-tab inventory", inventoryFocus[0] === "floated", inventoryFocus);
let browserAttempts = 0;
const retryBrowser = makeBrowserOpener({ openTab: () => { if (++browserAttempts === 1) throw new Error("not ready"); } }, () => 0);
try { retryBrowser(); } catch {}
retryBrowser();
check("failed browser open can retry immediately", browserAttempts === 2, browserAttempts);

// --- curl parser -----------------------------------------------------------------------------
const { parseCurl, toCurl, shellQuote } = await import("./src/client/curl.js");
const { substituteVars, buildEnvMap } = await import("./src/client/apiclient.js");
const c1 = parseCurl("curl -X POST 'https://a.b/c?d=1' -H 'Content-Type: application/json' -H 'X-T: v' --data '{\"x\":1}'");
check("parseCurl post json", c1.method === "POST" && c1.url === "https://a.b/c?d=1" && c1.headers.length === 2 && c1.body === '{"x":1}', c1);
const c2 = parseCurl("curl https://a.b/x \\\n  -H 'A: b' \\\n  -u user:pass");
check("parseCurl continuation + basic auth", c2.method === "GET" && c2.headers.some((hd) => hd.name === "Authorization" && hd.value.startsWith("Basic ")) && c2.headers.some((hd) => hd.name === "A" && hd.value === "b"), c2);
const c3 = parseCurl("curl -G https://a.b/s -d 'q=1' -d 'r=2'");
check("parseCurl -G appends query", c3.method === "GET" && c3.url === "https://a.b/s?q=1&r=2" && c3.body === "", c3);
const c4 = parseCurl("curl --json '{\"a\":1}' https://a.b/j");
check("parseCurl --json implies POST + content type", c4.method === "POST" && c4.headers.some((hd) => hd.name.toLowerCase() === "content-type" && hd.value === "application/json"), c4);
const c7 = parseCurl("curl -c jar.txt https://a.b/x");
check("parseCurl skips -c cookie-jar value (not the URL)", c7.url === "https://a.b/x", c7);
const c8 = parseCurl("curl --data-raw 'line1\\\nline2' https://a.b/y");
check("parseCurl keeps literal backslash+newline in single-quoted body", c8.body === "line1\\\nline2", JSON.stringify(c8.body));
const c9 = parseCurl("curl -H \"X-A: 1 \\\n2\" https://a.b/z");
check("parseCurl folds double-quoted line continuations", c9.headers.some((hd) => hd.name === "X-A" && hd.value === "1 2"), c9.headers);

// --- curl export + env variables ----------------------------------------------------------------
check("shellQuote escapes single quotes", shellQuote("it's") === `'it'\\''s'`, shellQuote("it's"));
const curlGet = toCurl({ method: "GET", url: "https://a.b/x", headers: [], bodyType: "none" });
check("toCurl plain GET has no -X", curlGet === "curl 'https://a.b/x'", curlGet);
const curlPost = toCurl({ method: "POST", url: "https://a.b/j", headers: [{ name: "X-T", value: "v" }], bodyType: "raw", rawSub: "json", body: '{"a":1}' });
check("toCurl POST raw json", curlPost.includes("-X POST") && curlPost.includes("-H 'X-T: v'") && curlPost.includes("-H 'Content-Type: application/json'") && curlPost.includes(`--data-raw '{"a":1}'`), curlPost);
const curlUserCT = toCurl({ method: "POST", url: "https://a.b/j", headers: [{ name: "content-type", value: "text/xml" }], bodyType: "raw", rawSub: "json", body: "x" });
check("toCurl keeps user Content-Type without duplicating", (curlUserCT.match(/Content-Type|content-type/gi) ?? []).length === 1, curlUserCT);
const rt = parseCurl(toCurl({ method: "POST", url: "https://a.b/r?q=1", headers: [{ name: "A", value: "b c" }], bodyType: "raw", rawSub: "json", body: '{"k":"v v"}' }));
check("toCurl → parseCurl roundtrip preserves request", rt.method === "POST" && rt.url === "https://a.b/r?q=1" && rt.headers.some((hd) => hd.name === "A" && hd.value === "b c") && rt.body === '{"k":"v v"}', rt);
const rtMp = parseCurl(toCurl({ method: "POST", url: "https://a.b/u", headers: [], bodyType: "multipart", formPairs: [{ name: "f", value: "hello world" }] }));
check("toCurl multipart roundtrips as -F pairs", rtMp.multipart?.[0]?.name === "f" && rtMp.multipart[0].value === "hello world" && rtMp.method === "POST", rtMp);
check("substituteVars replaces known names", substituteVars("{{base}}/x/{{ id }}", { base: "https://h", id: 7 }) === "https://h/x/7", substituteVars("{{base}}/x/{{ id }}", { base: "https://h", id: 7 }));
check("substituteVars keeps unknown literal", substituteVars("{{nope}}/x", { base: "b" }) === "{{nope}}/x", null);
check("substituteVars passthrough without braces", substituteVars("plain", {}) === "plain" && substituteVars(null, {}) === null, null);
check("buildEnvMap skips empty names, last wins", JSON.stringify(buildEnvMap([{ name: "", value: "x" }, { name: "a", value: "1" }, { name: "a", value: "2" }])) === JSON.stringify({ a: "2" }), buildEnvMap([{ name: "a", value: "1" }, { name: "a", value: "2" }]));

// --- query params merge ---------------------------------------------------------------------------
const { mergeParams } = await import("./src/client/apiclient.js");
check("mergeParams appends new param", mergeParams("https://a.b/x", [{ name: "q", value: "1" }]) === "https://a.b/x?q=1", mergeParams("https://a.b/x", [{ name: "q", value: "1" }]));
check("mergeParams overrides same name, keeps others", mergeParams("https://a.b/x?q=1&r=2", [{ name: "q", value: "9" }]) === "https://a.b/x?q=9&r=2", mergeParams("https://a.b/x?q=1&r=2", [{ name: "q", value: "9" }]));
check("mergeParams without active pairs is identity", mergeParams("https://a.b/x?q=1", []) === "https://a.b/x?q=1" && mergeParams("https://a.b/x", [{ name: " ", value: "1" }]) === "https://a.b/x", null);
check("mergeParams preserves fragment", mergeParams("https://a.b/x#frag", [{ name: "q", value: "1" }]) === "https://a.b/x?q=1#frag", mergeParams("https://a.b/x#frag", [{ name: "q", value: "1" }]));
check("mergeParams empty value sends bare name", mergeParams("https://a.b/x", [{ name: "q", value: "" }]) === "https://a.b/x?q=", mergeParams("https://a.b/x", [{ name: "q", value: "" }]));
check("mergeParams encodes special chars", mergeParams("https://a.b/x", [{ name: "q", value: "a b&c" }]).includes("q=a+b%26c") || mergeParams("https://a.b/x", [{ name: "q", value: "a b&c" }]).includes("q=a%20b%26c"), mergeParams("https://a.b/x", [{ name: "q", value: "a b&c" }]));

// --- editor tabs ----------------------------------------------------------------------------------
const { addTabPath } = await import("./src/client/code.js");
const tabBase = ["a", "b"];
check("addTabPath appends new paths", JSON.stringify(addTabPath(tabBase, "c")) === JSON.stringify(["a", "b", "c"]), addTabPath(tabBase, "c"));
check("addTabPath dedupes by identity", addTabPath(tabBase, "a") === tabBase, null);
check("addTabPath rejects empty/non-string", addTabPath(tabBase, "") === tabBase && addTabPath(tabBase, null) === tabBase, null);
check("addTabPath tolerates garbage list", JSON.stringify(addTabPath(null, "x")) === JSON.stringify(["x"]), null);
check("addTabPath caps and drops the oldest", JSON.stringify(addTabPath(["1", "2", "3"], "4", 3)) === JSON.stringify(["2", "3", "4"]), addTabPath(["1", "2", "3"], "4", 3));

// --- diff view hunk revert -------------------------------------------------------------------------
const { DiffView } = await import("./src/client/diff.js");
let revertedIdx = null;
const dvNodes = collect(DiffView({
	t: (k) => k,
	diff: { path: "a.txt", scope: "working", text: "@@ -1,3 +1,3 @@\n ctx\n-old\n+new\n" },
	onClose: () => {},
	onOpenSource: null,
	canSource: false,
	onRevertHunk: (i) => { revertedIdx = i; },
}));
const revertBtn = dvNodes.find((n) => typeof n.props?.className === "string" && n.props.className.includes("ce-hunk-revert"));
check("working-scope hunk row shows the revert button", Boolean(revertBtn), null);
revertBtn?.props?.onClick({ stopPropagation: () => {} });
check("revert ⟲ arms a confirm instead of reverting immediately", revertedIdx === null, revertedIdx);
const dvCommit = collect(DiffView({
	t: (k) => k,
	diff: { path: "c", scope: "commit", commit: "abc", text: "@@ -1 +1 @@\n-a\n+b\n" },
	onClose: () => {},
	onOpenSource: null,
	canSource: false,
	onRevertHunk: null,
}));
check("no revert button when the scope cannot revert", !dvCommit.some((n) => typeof n.props?.className === "string" && String(n.props.className).includes("ce-hunk-revert")), null);
const c5 = parseCurl("curl -F 'field=hello world' -F 'file=@/tmp/a.png' https://a.b/upload");
check(
	"parseCurl -F becomes multipart pairs",
	c5.method === "POST" && Array.isArray(c5.multipart) && c5.multipart.length === 2 && c5.multipart[0].name === "field" && c5.multipart[0].value === "hello world" && c5.multipart[1].value === "@/tmp/a.png" && !c5.headers.some((hd) => hd.name.toLowerCase() === "content-type"),
	c5,
);
const c6 = parseCurl("curl -d 'a=1' https://a.b/x");
check("parseCurl -d has no multipart", c6.multipart === undefined && c6.body === "a=1", c6);

// --- API history store helpers -----------------------------------------------------------------
const { pushEntry, relTimeAgo } = await import("./src/client/apiclient.js");
const h1 = pushEntry([], { id: "a", ts: 1 }, 30);
const h2 = pushEntry(h1, { id: "b", ts: 2 }, 30);
check("pushEntry prepends newest first", h2[0].id === "b" && h2[1].id === "a" && h2.length === 2, h2);
const h3 = pushEntry(h2, { id: "a", ts: 3 }, 30);
check("pushEntry dedupes by id", h3.length === 2 && h3[0].id === "a" && h3[0].ts === 3 && h3[1].id === "b", h3);
const big = Array.from({ length: 40 }, (_, i) => ({ id: `x${i}` }));
check("pushEntry caps the list", pushEntry(big, { id: "new" }, 30).length === 30, null);
check("pushEntry tolerates garbage list", pushEntry(null, { id: "z" }, 30).length === 1, null);
check("relTimeAgo buckets", relTimeAgo(Date.now() - 5000) === "5s" && relTimeAgo(Date.now() - 5 * 60000) === "5m" && relTimeAgo(Date.now() - 3 * 3600000) === "3h" && relTimeAgo(Date.now() - 2 * 86400000) === "2d", [relTimeAgo(Date.now() - 5000), relTimeAgo(Date.now() - 5 * 60000)]);

// --- API event/state regressions (effects skipped; real browser layout checked separately) ----
const { createHookRenderer } = await import("./test-support/react-stub.mjs");
const { ApiView } = await import("./src/client/apiclient.js");
const renderApi = createHookRenderer(ApiView, { t: (k) => k });
let apiTree = renderApi();
const apiNodes = () => collect(apiTree);
const apiNode = (predicate) => apiNodes().find(predicate);
check("API request toolbar reserves one row for method/url/send", apiNode((n) => n.props.className === "cea-bar")?.children.length === 3, null);
// The splitter changes pane proportions without changing request data or sending it.
const resizeKey = (key) => ({ key, preventDefault() {}, stopPropagation() {} });
apiNode((n) => n.props.role === "separator").props.onKeyDown(resizeKey("ArrowDown"));
apiTree = renderApi();
check("API separator keyboard resizes request region", apiNode((n) => n.props.role === "separator")?.props["aria-valuenow"] === 47, null);
apiNode((n) => n.props.role === "separator").props.onKeyDown(resizeKey("Home")); apiTree = renderApi();
check("API resize preserves minimum response and request space", apiNode((n) => n.props.role === "separator")?.props["aria-valuenow"] === 24, null);
apiNode((n) => n.props.className === "cea-scroll cea-workspace").props.ref.current = { getBoundingClientRect: () => ({ top: 100, height: 400 }) };
let captured = false;
const splitterTarget = { setPointerCapture() { captured = true; }, releasePointerCapture() { captured = false; } };
apiNode((n) => n.props.role === "separator").props.onPointerDown({ button: 0, pointerId: 3, clientY: 900, currentTarget: splitterTarget, preventDefault() {} });
apiTree = renderApi();
check("API pointer resize clamps large drag and captures pointer", captured && apiNode((n) => n.props.role === "separator")?.props["aria-valuenow"] === 72, null);
apiNode((n) => n.props.role === "separator").props.onPointerUp({ pointerId: 3, currentTarget: splitterTarget });
apiNode((n) => n.props.role === "separator").props.onPointerMove({ pointerId: 3, clientY: 0 }); apiTree = renderApi();
check("API resize stops when pointer is released", !captured && apiNode((n) => n.props.role === "separator")?.props["aria-valuenow"] === 72, null);
apiNode((n) => n.props.role === "separator").props.onDoubleClick(); apiTree = renderApi();
check("API splitter resets to useful default without clearing URL", apiNode((n) => n.props.role === "separator")?.props["aria-valuenow"] === 42 && apiNode((n) => n.props.className === "ce-input cea-url")?.props.value === "", null);
apiNode((n) => n.props.className?.startsWith("cea-config-tab") && n.children[0] === "api.body").props.onClick();
apiTree = renderApi();
check("API config tabs show only the selected editor", !apiNode((n) => n.props.placeholder === "Header") && Boolean(apiNode((n) => n.type === "select" && n.props.value === "none")), null);
apiNode((n) => n.type === "select" && n.props.value === "none").props.onChange({ target: { value: "raw" } });
apiTree = renderApi();
apiNode((n) => n.type === "textarea" && n.props.className === "cea-body").props.onChange({ target: { value: '{"old":true}' } });
apiTree = renderApi();
apiNode((n) => n.props.title === "api.importTitle").props.onClick();
apiTree = renderApi();
apiNode((n) => n.props.className === "cea-body cea-import").props.onChange({ target: { value: "curl https://example.test/new" } });
apiTree = renderApi();
apiNode((n) => n.type === "button" && n.children[0] === "api.importBtn").props.onClick();
apiTree = renderApi();
check("curl GET import returns to params and removes stale body configuration", apiNode((n) => n.props.className === "ce-input cea-url")?.props.value === "https://example.test/new" && apiNode((n) => n.props.className === "cea-config-tab cea-config-tab-on")?.children[0] === "api.params", null);
const savedFetch = globalThis.fetch;
const sentApiRequests = [];
globalThis.fetch = async (_url, opts) => {
	sentApiRequests.push(JSON.parse(opts.body));
	return { json: async () => ({ ok: true, value: { status: 200, text: "ok", headers: [], ms: 1, size: 2 } }) };
};
try {
	let stopped = false;
	const keyboardEvent = { key: "Enter", ctrlKey: true, preventDefault() {}, stopPropagation() { stopped = true; } };
	apiNode((n) => n.props.className === "ce-input cea-url").props.onKeyDown(keyboardEvent);
	if (!stopped) apiTree.props.onKeyDown(keyboardEvent);
	check("Ctrl+Enter in URL sends exactly once instead of bubbling twice", stopped && sentApiRequests.length === 1, sentApiRequests.length);
	check("imported GET does not send the previous raw request body", sentApiRequests[0]?.body === undefined, sentApiRequests[0]);
	apiTree = renderApi();
	check("in-flight API request disables Send", apiNode((n) => n.props.className === "ce-sk-btn cea-send")?.props.disabled === true, null);
	await new Promise((resolve) => setImmediate(resolve));
	apiTree = renderApi();
	check("settled API response appears and Send becomes available", Boolean(apiNode((n) => n.props.className === "cea-resp")) && apiNode((n) => n.props.className === "ce-sk-btn cea-send")?.props.disabled === false, null);
} finally { globalThis.fetch = savedFetch; }

// --- Request builder tables and enabled-row wire behavior ---------------------------------
const { RequestFields } = await import("./src/client/requestfields.js");
let tableRows = [{ name: "X-Trace", value: "abc", description: "Trace id" }];
const drawFields = () => RequestFields({ t: (k) => k, label: "Headers", rows: tableRows, onChange: (rows) => { tableRows = rows; } });
let fieldNodes = collect(drawFields());
check("request fields render real table headers", fieldNodes.filter((n) => n.type === "th").length === 5, null);
fieldNodes.find((n) => n.type === "input" && n.props.type === "checkbox" && !n.props.disabled).props.onChange({ target: { checked: false } });
check("disabling request row retains its value and description", tableRows[0].enabled === false && tableRows[0].value === "abc" && tableRows[0].description === "Trace id", tableRows);
fieldNodes = collect(drawFields());
fieldNodes.filter((n) => n.type === "input" && n.props.placeholder === "api.fieldName").at(-1).props.onChange({ target: { value: "X-New" } });
check("typing in trailing row appends an enabled field", tableRows.length === 2 && tableRows[1].name === "X-New" && tableRows[1].enabled === true, tableRows);
fieldNodes = collect(drawFields());
fieldNodes.find((n) => n.type === "button").props.onClick();
check("request table delete removes only selected row", tableRows.length === 1 && tableRows[0].name === "X-New", tableRows);
check("disabled params do not override URL parameters", mergeParams("https://example.test/?q=original", [{ name: "q", value: "disabled", enabled: false }]) === "https://example.test/?q=original", null);
check("disabled environment variables are excluded", buildEnvMap([{ name: "key", value: "old", enabled: false }]).key === undefined, null);
for (const bodyType of ["form", "multipart"]) {
 const exported = toCurl({ url: "https://example.test/", bodyType, headers: [{ name: "X-Off", value: "secret", enabled: false }], formPairs: [{ name: "off", value: "hidden", enabled: false }, { name: "on", value: "visible" }] });
 check(`curl ${bodyType} omits disabled headers and fields`, !exported.includes("secret") && !exported.includes("hidden") && exported.includes("visible"), null);
}
const renderTableApi = createHookRenderer(ApiView, { t: (k) => k });
let tableApi = renderTableApi();
const tableNode = (predicate) => collect(tableApi).find(predicate);
const chooseApiTab = (key) => { tableNode((n) => n.props.className?.startsWith("cea-config-tab") && n.children[0] === key).props.onClick(); tableApi = renderTableApi(); };
tableNode((n) => n.props.className === "ce-input cea-url").props.onChange({ target: { value: "https://example.test/" } }); tableApi = renderTableApi();
tableNode((n) => n.type === RequestFields).props.onChange([{ name: "on", value: "1" }, { name: "off", value: "2", enabled: false }]); tableApi = renderTableApi();
chooseApiTab("api.headers");
tableNode((n) => n.type === RequestFields).props.onChange([{ name: "X-On", value: "yes" }, { name: "X-Off", value: "no", enabled: false }]); tableApi = renderTableApi();
check("header tab count includes enabled named fields only", collect(tableApi).find((n) => n.props.className === "cea-config-tab cea-config-tab-on").children[1].children[0] === 1, null);
chooseApiTab("api.environment");
check("environment editor is a configuration tab", Boolean(tableNode((n) => n.type === RequestFields && n.props.label === "api.environment")), null);
const tableFetch = globalThis.fetch;
let tableWire;
globalThis.fetch = async (_url, options) => { tableWire = JSON.parse(options.body); return { json: async () => ({ ok: true, value: { status: 200, headers: [], text: "ok" } }) }; };
try {
 tableNode((n) => n.props.className === "ce-sk-btn cea-send").props.onClick();
 await new Promise((resolve) => setImmediate(resolve)); tableApi = renderTableApi();
 check("API sends only enabled parameters and headers", tableWire.url === "https://example.test/?on=1" && tableWire.headers.length === 1 && tableWire.headers[0].name === "X-On", tableWire);
 tableNode((n) => n.props.title === "api.history").props.onClick(); tableApi = renderTableApi();
 tableNode((n) => n.props.title === "api.restoreTitle").props.onClick(); tableApi = renderTableApi();
 chooseApiTab("api.headers");
 check("request history restores disabled fields without losing metadata", tableNode((n) => n.type === RequestFields).props.rows[1].enabled === false, null);
} finally { globalThis.fetch = tableFetch; }

// --- Task layout: narrow code navigation and review-first changes ---------------------------
const { CodeBody } = await import("./src/client/code.js");
const { TreePanel: TreePanelCmp } = await import("./src/client/tree.js");
const navGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, setTimeout: globalThis.setTimeout };
const navRequests = [];
globalThis.fetch = async (url, options) => {
	navRequests.push({ url, body: JSON.parse(options.body) });
	return { json: async () => ({ ok: true, value: { kind: "text", content: "hello\nworld\n", mtimeMs: 1 } }) };
};
globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
globalThis.setTimeout = () => 0;
try {
	const renderCode = createHookRenderer(CodeBody, { sessionId: "layout", useSessions: (select) => select({ byId: { layout: { cwd: "/w" } } }), t: (k) => k });
	let codeTree = renderCode();
	const getCode = (test) => collect(codeTree).find(test);
	check("narrow code navigation starts on file list with one search entry", codeTree.props["data-mobile-view"] === "files" && collect(codeTree).filter((n) => n.props.className === "ce-rail-search").length === 1 && !getCode((n) => n.props.className === "ce-tool ce-workspace-search"), null);
	getCode((n) => n.props.className === "ce-rail-search").props.onClick({ type: "click" }); codeTree = renderCode();
	check("workspace search remains reachable before opening any document on narrow panels", codeTree.props["data-mobile-view"] === "editor" && Boolean(getCode((n) => n.type.name === "SearchPanel")), null);
	check("search button click never puts a mouse event in the include filter", getCode((n) => n.type.name === "SearchPanel")?.props.state.include === "", null);
	getCode((n) => n.props.className === "ce-mobile-back").props.onClick(); codeTree = renderCode();
	check("returning to file list closes the narrow search overlay", codeTree.props["data-mobile-view"] === "files" && !getCode((n) => n.type.name === "SearchPanel"), null);

	getCode((n) => n.type === TreePanelCmp).props.onOpenFile("readme.txt", 1, 1);
	await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	check("opening a file switches narrow workspace to editor", codeTree.props["data-mobile-view"] === "editor", codeTree.props["data-mobile-view"]);
	const editTransfer = makeTransfer();
	fileDragProps({ cwd: "/w", path: "drop-open.txt", sessionId: "layout" }).onDragStart({ dataTransfer: editTransfer, stopPropagation() {}, preventDefault() {} });
	const beforeEditorDrop = navRequests.length;
	getCode((n) => n.props.className === "ce-editor").props.onDrop({ dataTransfer: editTransfer, preventDefault() {}, stopPropagation() {} });
	await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	check("editor drop opens file without filesystem mutation", getCode((n) => n.props.className === "ce-head-path")?.children[0] === "drop-open.txt" && navRequests.slice(beforeEditorDrop).some((request) => request.url.endsWith("/fs.read")) && !navRequests.slice(beforeEditorDrop).some((request) => /fs\.(rename|write|delete)$/.test(request.url)), null);
	const scopedTransfer = makeTransfer();
	fileDragProps({ cwd: "/w", repo: "/w/nested", path: "deleted.ts", scope: "staged", source: "changes", sessionId: "layout" }).onDragStart({ dataTransfer: scopedTransfer, stopPropagation() {}, preventDefault() {} });
	getCode((n) => n.props.className === "ce-editor").props.onDrop({ dataTransfer: scopedTransfer, preventDefault() {}, stopPropagation() {} });
	await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	check("changes drop requests captured repository diff including deleted file", navRequests.at(-1)?.url.endsWith("/git.diff") && navRequests.at(-1).body.repo === "/w/nested" && navRequests.at(-1).body.scope === "staged" && navRequests.at(-1).body.path === "deleted.ts", navRequests.at(-1));

	getCode((n) => n.props.className === "ce-mobile-back").props.onClick(); codeTree = renderCode();
	check("back to files retains the open editor document", codeTree.props["data-mobile-view"] === "files" && Boolean(getCode((n) => n.props.className === "ce-mobile-open-editor ce-link")), null);
	getCode((n) => n.props.className === "ce-mobile-open-editor ce-link").props.onClick(); codeTree = renderCode();
	check("return to editor does not reload or lose current document", codeTree.props["data-mobile-view"] === "editor" && navRequests.filter((r) => r.url.endsWith("/fs.read")).length === 2, navRequests);
	getCode((n) => n.props.className === "ce-mobile-back").props.onClick(); codeTree = renderCode();
	// File navigation must reclaim the editor from search/quick-open overlays.
	getCode((n) => n.props.className === "ce-rail-search").props.onClick(); codeTree = renderCode();
	getCode((n) => n.type.name === "SearchPanel").props.onQuery("keep-query"); codeTree = renderCode();
	getCode((n) => n.type === TreePanelCmp).props.onOpenFile("other.txt", 1, 1);
	codeTree = renderCode();
	check("tree file click dismisses search immediately", !getCode((n) => n.type.name === "SearchPanel"), null);
	await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	check("file navigation displays the selected document", getCode((n) => n.props.className === "ce-head-path")?.children[0] === "other.txt", null);
	getCode((n) => n.props.className === "ce-rail-search").props.onClick(); codeTree = renderCode();
	check("reopening search preserves the query", getCode((n) => n.type.name === "SearchPanel")?.props.state.query === "keep-query", null);
	getCode((n) => n.type.name === "SearchPanel").props.onClose(); codeTree = renderCode();
	getCode((n) => n.props.className === "ce-rail-search").props.onClick(); codeTree = renderCode();
	codeTree.props.onKeyDown({ code: "KeyP", ctrlKey: true, preventDefault() {} }); codeTree = renderCode();
	check("quick open replaces search instead of stacking", Boolean(getCode((n) => n.type.name === "QuickOpen")) && !getCode((n) => n.type.name === "SearchPanel"), null);
	getCode((n) => n.props.className === "ce-rail-search").props.onClick(); codeTree = renderCode();
	check("search replaces quick open instead of stacking", Boolean(getCode((n) => n.type.name === "SearchPanel")) && !getCode((n) => n.type.name === "QuickOpen"), null);
	getCode((n) => n.type === TreePanelCmp).props.onOpenFile("other.txt", 1, 1);
	await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	getCode((n) => n.type === "button" && n.props.title === "editor.edit").props.onClick(); codeTree = renderCode();
	getCode((n) => n.type === "textarea" && n.props.className.startsWith("ce-edit-ta")).props.onChange({ target: { value: "unsaved draft" } }); codeTree = renderCode();
	const readsBeforeDirtyNavigation = navRequests.filter((r) => r.url.endsWith("/fs.read")).length;
	const blockedDrop = makeTransfer(); fileDragProps({ cwd: "/w", path: "blocked-drop.txt", sessionId: "layout" }).onDragStart({ dataTransfer: blockedDrop, preventDefault() {}, stopPropagation() {} });
	getCode((n) => n.props.className === "ce-editor").props.onDrop({ dataTransfer: blockedDrop, preventDefault() {}, stopPropagation() {} });
	await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	check("file drop preserves unsaved draft and issues no reload", getCode((n) => n.type === "textarea" && n.props.className.startsWith("ce-edit-ta"))?.props.value === "unsaved draft" && navRequests.filter((r) => r.url.endsWith("/fs.read")).length === readsBeforeDirtyNavigation, null);

	getCode((n) => n.type === TreePanelCmp).props.onOpenFile("blocked.txt", 1, 1);
	await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	check("tree navigation preserves unsaved draft and refuses reload", getCode((n) => n.type === "textarea" && n.props.className.startsWith("ce-edit-ta"))?.props.value === "unsaved draft" && navRequests.filter((r) => r.url.endsWith("/fs.read")).length === readsBeforeDirtyNavigation, null);
	getCode((n) => n.props.className === "ce-rail-search").props.onClick(); codeTree = renderCode();
	codeTree.props.onKeyDown({ key: "Escape", preventDefault() {}, stopPropagation() {} }); codeTree = renderCode();
	check("Escape closes search before cancelling an editor draft", !getCode((n) => n.type.name === "SearchPanel") && getCode((n) => n.type === "textarea" && n.props.className.startsWith("ce-edit-ta"))?.props.value === "unsaved draft", null);
	getCode((n) => n.type === "button" && n.children[0] === "editor.cancel").props.onClick(); codeTree = renderCode();
	getCode((n) => n.props.className === "ce-rail-search").props.onClick(); codeTree = renderCode();
	getCode((n) => n.props.className.startsWith("ce-command-trigger")).props.onClick(); codeTree = renderCode();
	check("command center replaces search", Boolean(getCode((n) => n.type.name === "CommandPalette")) && !getCode((n) => n.type.name === "SearchPanel"), null);
	getCode((n) => n.type.name === "CommandPalette").props.commands.find((command) => command.id === "changes").run(); codeTree = renderCode();
	check("source control command dismisses command center", !getCode((n) => n.type.name === "CommandPalette"), null);
	getCode((n) => n.props.className === "ce-rail-search").props.onClick(); codeTree = renderCode();
	getCode((n) => n.type.name === "ChangesPanel").props.onOpenCommit({ hash: "abc" }); codeTree = renderCode();
	check("Git commit navigation dismisses search immediately", !getCode((n) => n.type.name === "SearchPanel"), null);
	await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	getCode((n) => n.type === "button" && n.children[0] === "toolbar.files").props.onClick(); codeTree = renderCode();
	getCode((n) => n.type === TreePanelCmp).props.onSearchDirectory("src/client"); codeTree = renderCode();
	check("directory action selects an explicit directory scope", getCode((n) => n.type.name === "SearchPanel")?.props.state.scope.directory === "src/client", null);
	getCode((n) => n.type.name === "SearchPanel").props.onQuery("needle"); codeTree = renderCode();
	getCode((n) => n.type.name === "SearchPanel").props.onSubmit(); await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	check("directory search request carries the selected scope to Host", navRequests.at(-1)?.body.scope === "directory" && navRequests.at(-1)?.body.directory === "src/client", navRequests.at(-1));
	getCode((n) => n.type.name === "SearchPanel").props.onDirectory(""); codeTree = renderCode();
	check("clearing search directory restores workspace scope", getCode((n) => n.type.name === "SearchPanel")?.props.state.scope.kind === "workspace", null);
	getCode((n) => n.type === "button" && n.children[0] === "toolbar.changes").props.onClick(); await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	getCode((n) => n.props.className === "ce-rail-search").props.onClick({ type: "click" }); codeTree = renderCode();
	check("Changes view search targets current changes regardless of empty Git state", getCode((n) => n.type.name === "SearchPanel")?.props.state.scope.kind === "changes" && JSON.stringify(getCode((n) => n.props.className === "ce-rail-search").children).includes("search.changesAction"), null);
	getCode((n) => n.type.name === "SearchPanel").props.onSubmit(); await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	check("changes content search uses Host scope instead of CSV filename globs", navRequests.at(-1)?.body.scope === "changes" && navRequests.at(-1)?.body.include === "", navRequests.at(-1));
	getCode((n) => n.type === "button" && n.children[0] === "toolbar.files").props.onClick(); codeTree = renderCode();
	getCode((n) => n.props.className === "ce-rail-search").props.onClick(); codeTree = renderCode();
	check("switching back to Files never leaves changes or directory scope behind", getCode((n) => n.type.name === "SearchPanel")?.props.state.scope.kind === "workspace", null);
	let resolveOldSearch;
	globalThis.fetch = async () => ({ json: () => new Promise((resolve) => { resolveOldSearch = resolve; }) });
	getCode((n) => n.type.name === "SearchPanel").props.onSubmit(); await new Promise((resolve) => setImmediate(resolve));
	getCode((n) => n.type.name === "SearchPanel").props.onDirectory("new-dir"); codeTree = renderCode();
	check("changing scope clears old matches before the debounce completes", getCode((n) => n.type.name === "SearchPanel")?.props.state.results === undefined, null);
	globalThis.fetch = async () => ({ json: async () => ({ ok: true, value: { results: [{ path: "new-dir/current.txt", line: 1, text: "needle" }] } }) });
	getCode((n) => n.type.name === "SearchPanel").props.onSubmit(); await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	resolveOldSearch({ ok: true, value: { results: [{ path: "unrelated/old.txt", line: 1, text: "needle" }] } }); await new Promise((resolve) => setImmediate(resolve)); codeTree = renderCode();
	check("late results from previous scope never overwrite current scope", getCode((n) => n.type.name === "SearchPanel")?.props.state.results?.[0]?.path === "new-dir/current.txt", null);
} finally {
	for (const [key, value] of Object.entries(navGlobals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
}
const composerDetails = panelNodes.find((n) => n.type === "details" && n.props.className === "ce-commit-disclosure");
check("changes review shows file tree before collapsed commit form", Boolean(composerDetails) && !composerDetails.props.open && panelNodes.indexOf(workingTree) < panelNodes.indexOf(composerDetails), null);

// --- File-tree deletion has explicit visible confirmation and reliable sibling controls ------
const savedDeleteFetch = globalThis.fetch;
const deleteCalls = [], deleteNotices = [], deletedPaths = [];
let deleteFailure = true, deleteFinish;
const deleteEntries = [{ name: "demo-folder", type: "directory" }, { name: "demo.txt", type: "file" }];
globalThis.fetch = async (url, options) => {
 const body = JSON.parse(options.body); deleteCalls.push({ url, body });
 if (url.endsWith("/fs.list")) return { json: async () => ({ ok: true, value: { entries: body.path === "" ? deleteEntries : [] } }) };
 if (url.endsWith("/fs.delete")) return { json: () => new Promise((resolve) => { deleteFinish = resolve; }) };
 throw Error("unexpected deletion fixture route");
};
try {
 const drawDeleteTree = createHookRenderer(TreePanelCmp, { cwd: "/demo", sessionId: "delete-session", t: (key, values) => values ? `${key}:${values.name}` : key, onNotify: (text) => deleteNotices.push(text), onDeleted: (path) => deletedPaths.push(path) }, { effects: true });
 let deleteTree = drawDeleteTree(); drawDeleteTree.flushEffects(); await new Promise((resolve) => setImmediate(resolve)); deleteTree = drawDeleteTree();
 const findDeleteNode = (predicate) => collect(deleteTree).find(predicate);
 const folderRow = () => findDeleteNode((n) => n.props["data-tp"] === "demo-folder");
 const clickRowDelete = (row) => collect(row).find((n) => n.props.hint === "tree.delete").props.onClick({ stopPropagation() {} });
 check("file and directory rows keep action buttons outside open buttons", collect(deleteTree).filter((n) => n.props["data-tp"]).every((row) => row.type === "div" && collect(row).filter((n) => n.type === "button").every((button) => !collect(button.children).some((child) => child.type === "button"))), null);
 clickRowDelete(folderRow()); deleteTree = drawDeleteTree();
 check("first directory delete click displays named confirmation without deleting", Boolean(findDeleteNode((n) => n.props.className === "ctp-delete-panel")) && collect(deleteTree).some((n) => n.type === "strong" && n.children[0] === "tree.deleteDirQuestion:demo-folder") && !deleteCalls.some((call) => call.url.endsWith("/fs.delete")), null);
 findDeleteNode((n) => n.type === "button" && n.children[0] === "changes.cancel").props.onClick(); deleteTree = drawDeleteTree();
 check("cancelling directory delete removes confirmation without request", !findDeleteNode((n) => n.props.className === "ctp-delete-panel") && !deleteCalls.some((call) => call.url.endsWith("/fs.delete")), null);
 clickRowDelete(folderRow()); deleteTree = drawDeleteTree();
 const confirmDirectoryDelete = findDeleteNode((n) => n.type === "button" && n.children[0] === "tree.confirmDelete");
 confirmDirectoryDelete.props.onClick(); confirmDirectoryDelete.props.onClick(); deleteTree = drawDeleteTree();
 check("confirmed directory delete sends exactly one request and shows progress", deleteCalls.filter((call) => call.url.endsWith("/fs.delete")).length === 1 && findDeleteNode((n) => n.type === "button" && n.children[0] === "tree.deleting")?.props.disabled === true, deleteCalls);
 await new Promise((resolve) => setImmediate(resolve));
 deleteFinish({ ok: false, error: "permission denied" }); await new Promise((resolve) => setImmediate(resolve)); deleteTree = drawDeleteTree();
 check("failed delete stays visible and reports the actual error", findDeleteNode((n) => n.props.role === "alert")?.children[0].includes("permission denied") && deletedPaths.length === 0 && Boolean(findDeleteNode((n) => n.children[0] === "tree.confirmDelete")), null);
 findDeleteNode((n) => n.type === "button" && n.children[0] === "tree.confirmDelete").props.onClick(); await new Promise((resolve) => setImmediate(resolve)); deleteFinish({ ok: true, value: { path: "demo-folder" } }); await new Promise((resolve) => setImmediate(resolve)); deleteTree = drawDeleteTree();
 check("successful directory delete notifies editor and closes confirmation", deletedPaths[0] === "demo-folder" && !findDeleteNode((n) => n.props.className === "ctp-delete-panel") && deleteCalls.filter((call) => call.url.endsWith("/fs.delete")).at(-1).body.path === "demo-folder", null);
 const fileRow = findDeleteNode((n) => n.props["data-tp"] === "demo.txt"); clickRowDelete(fileRow); deleteTree = drawDeleteTree();
 check("file delete also uses a visible named confirmation", collect(deleteTree).some((n) => n.type === "strong" && n.children[0] === "tree.deleteFileQuestion:demo.txt"), null);
 drawDeleteTree.unmount();
} finally { globalThis.fetch = savedDeleteFetch; }

// --- Skills navigation, read races, and editor protections -----------------------------------
const { SkillsView, skillScope } = await import("./src/client/skills.js");
const { MarkdownView } = await import("./src/client/markdown.js");
check("skill scopes combine installation roots without making provided skills editable", skillScope("project-agents") === "project" && skillScope("user-dsh") === "user" && skillScope("other") === "provided", null);
const skillFixtures = [
	{ name: "alpha", source: "user-agents", path: "/skills/alpha/SKILL.md", description: "HTTP request tools" },
	{ name: "beta", source: "project-agents", path: "/skills/beta/SKILL.md", description: "Project conventions" },
	{ name: "office", source: "other", path: "/skills/office/SKILL.md", description: "Office documents" },
];
const pendingSkillReads = new Map();
const skillRequests = [];
const skillNotices = [];
const previousSkillsFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
	const body = JSON.parse(opts.body);
	skillRequests.push({ url, body });
	if (url.endsWith("/skills.list")) return { json: async () => ({ ok: true, value: { skills: skillFixtures } }) };
	if (url.endsWith("/skills.read")) return { json: () => new Promise((resolve) => pendingSkillReads.set(body.path, resolve)) };
	return { json: async () => ({ ok: true, value: { path: body.path } }) };
};
const renderSkills = createHookRenderer(SkillsView, { cwd: "/skills", t: (k) => k, say: (...args) => skillNotices.push(args) });
let skillsTree = renderSkills();
const skillNode = (test) => collect(skillsTree).find(test);
const skillRow = (name) => skillNode((n) => n.props.className?.startsWith("ce-sk-row") && n.type === "button" && n.children[0]?.children?.[0] === name);
const settleSkills = async () => { await new Promise((resolve) => setImmediate(resolve)); skillsTree = renderSkills(); };
try {
	check("skills creation form is hidden until explicitly opened", !skillNode((n) => n.props.className === "ce-sk-create"), null);
	skillNode((n) => n.props.title === "skills.refresh").props.onClick();
	await settleSkills();
	check("skills list loads project user and provided entries", Boolean(skillRow("alpha") && skillRow("beta") && skillRow("office")), null);
	skillRow("alpha").props.onClick(); await settleSkills();
	check("pending skill read clears the previous preview", !skillNode((n) => n.type === MarkdownView), null);
	skillRow("beta").props.onClick(); await settleSkills();
	pendingSkillReads.get(skillFixtures[1].path)({ ok: true, value: { content: "# Beta", truncated: false } });
	await settleSkills();
	pendingSkillReads.get(skillFixtures[0].path)({ ok: true, value: { content: "# Stale Alpha", truncated: false } });
	await settleSkills();
	check("late previous selection cannot overwrite the selected skill", skillNode((n) => n.type === MarkdownView)?.props.text === "# Beta", null);
	const installDetails = skillNode((n) => n.props.className === "ce-sk-install-details");
	check("skill metadata is collapsed without hiding the preview", installDetails?.type === "details" && !installDetails.props.open && Boolean(skillNode((n) => n.type === MarkdownView)), null);
	skillNode((n) => n.type === "button" && n.children[0] === "editor.edit").props.onClick(); skillsTree = renderSkills();
	skillNode((n) => n.props.className === "ce-sk-ta").props.onChange({ target: { value: "# Beta edited" } }); skillsTree = renderSkills();
	skillRow("alpha").props.onClick(); skillsTree = renderSkills();
	check("skills navigation guards unsaved edits", skillNode((n) => n.props.className === "ce-sk-ta")?.props.value === "# Beta edited" && skillNotices.at(-1)?.[0] === "editor.dirtyGuard", skillNotices);
	skillNode((n) => n.type === "button" && n.children[0] === "editor.save").props.onClick(); await settleSkills();
	check("skills save writes the edited file and returns to preview", skillRequests.some((r) => r.url.endsWith("/skills.write") && r.body.path === skillFixtures[1].path && r.body.content === "# Beta edited") && skillNode((n) => n.type === MarkdownView)?.props.text === "# Beta edited", null);
	skillRow("alpha").props.onClick(); await settleSkills();
	pendingSkillReads.get(skillFixtures[0].path)({ ok: true, value: { content: "# Prefix", truncated: true } }); await settleSkills();
	check("truncated skills expose no edit or save action", !skillNode((n) => n.type === "button" && ["editor.edit", "editor.save"].includes(n.children[0])), null);
	skillRow("office").props.onClick(); await settleSkills();
	pendingSkillReads.get(skillFixtures[2].path)({ ok: true, value: { content: "# Office", truncated: false } }); await settleSkills();
	check("provided skills offer preview and source without write/delete actions", Boolean(skillNode((n) => n.type === "button" && n.children[0] === "skills.source")) && !skillNode((n) => n.type === "button" && ["editor.edit", "skills.delete", "editor.save"].includes(n.children[0])), null);
	skillNode((n) => n.props.type === "search").props.onChange({ target: { value: "HTTP" } }); skillsTree = renderSkills();
	check("skill search matches descriptions as well as names", Boolean(skillRow("alpha")) && !skillRow("beta") && !skillRow("office"), null);
	skillNode((n) => n.type === "select" && n.props.value === "all").props.onChange({ target: { value: "provided" } }); skillsTree = renderSkills();
	check("skill scope filter combines with search and presents no-match state", !skillRow("alpha") && Boolean(skillNode((n) => n.children[0] === "skills.noMatch")), null);
	skillNode((n) => n.type === "button" && n.props["aria-expanded"] === false).props.onClick(); skillsTree = renderSkills();
	skillNode((n) => n.props.className === "ce-input ce-sk-name-input").props.onChange({ target: { value: "Invalid Name" } }); skillsTree = renderSkills();
	check("invalid skill names show feedback and disable create", skillNode((n) => n.type === "button" && n.children[0] === "skills.createAction")?.props.disabled === true && Boolean(skillNode((n) => n.props.className === "ce-sk-name-hint")), null);
	skillNode((n) => n.props.className === "ce-input ce-sk-name-input").props.onChange({ target: { value: "my-skill" } }); skillsTree = renderSkills();
	skillNode((n) => n.type === "select" && n.props.value === "user").props.onChange({ target: { value: "project" } }); skillsTree = renderSkills();
	skillNode((n) => n.type === "button" && n.children[0] === "skills.createAction").props.onClick(); await settleSkills();
	check("inline creation uses the chosen scope and collapses after success", skillRequests.some((r) => r.url.endsWith("/skills.create") && r.body.name === "my-skill" && r.body.scope === "project") && !skillNode((n) => n.props.className === "ce-sk-create"), null);
} finally { globalThis.fetch = previousSkillsFetch; }

// --- Fast hints: controlled delay, viewport placement, dismissal and accessible labels --------
const { HintButton } = await import("./src/client/hint.js");
const oldHintGlobals = { document: globalThis.document, window: globalThis.window, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const hintTimers = new Map();
const hintNodes = [];
const hintListeners = new Set();
let hintTimerId = 0;
const hintTargetAttrs = new Map([["aria-describedby", "existing-description"]]);
const hintTarget = { isConnected: true, getBoundingClientRect: () => ({ left: 290, top: 170, bottom: 190, width: 20 }),
	getAttribute: (k) => hintTargetAttrs.get(k) ?? null, setAttribute: (k, v) => hintTargetAttrs.set(k, v), removeAttribute: (k) => hintTargetAttrs.delete(k) };
globalThis.setTimeout = (callback, delay) => { hintTimers.set(++hintTimerId, { callback, delay }); return hintTimerId; };
globalThis.clearTimeout = (id) => hintTimers.delete(id);
globalThis.document = {
	createElement: () => ({ style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getBoundingClientRect: () => ({ width: 100, height: 24 }), remove() { this.removed = true; } }),
	body: { appendChild: (node) => hintNodes.push(node) },
	addEventListener: (kind) => hintListeners.add(kind), removeEventListener: (kind) => hintListeners.delete(kind),
};
globalThis.window = { innerWidth: 320, innerHeight: 200, addEventListener: (kind) => hintListeners.add(kind), removeEventListener: (kind) => hintListeners.delete(kind) };
const fireHint = () => { const [id, timer] = hintTimers.entries().next().value; hintTimers.delete(id); timer.callback(); };
try {
	let hintClicks = 0;
	const hintButton = HintButton({ hint: "新建文件", title: "native title must be removed", children: "+", onClick: () => hintClicks++ });
	check("fast hint replaces native title and retains accessible button name", hintButton.props.title === undefined && hintButton.props["aria-label"] === "新建文件", null);
	hintButton.props.onMouseEnter({ currentTarget: hintTarget });
	check("tree hints appear after 100ms instead of browser-native delay", hintNodes.length === 0 && [...hintTimers.values()][0]?.delay === 100, null);
	fireHint();
	check("hint clamps to viewport and moves above the bottom edge", hintNodes[0].style.left === "212px" && hintNodes[0].style.top === "140px" && hintNodes[0].attrs.role === "tooltip", hintNodes[0].style);
	hintButton.props.onMouseLeave({});
	check("leaving hides hint and restores existing accessibility description", hintNodes[0].removed && hintTargetAttrs.get("aria-describedby") === "existing-description" && hintListeners.size === 0, null);
	hintButton.props.onFocus({ currentTarget: hintTarget });
	check("keyboard focus shows hint without hover delay", [...hintTimers.values()][0]?.delay === 0, null);
	fireHint();
	let hintEscapeStopped = false;
	hintButton.props.onKeyDown({ key: "Escape", stopPropagation: () => { hintEscapeStopped = true; } });
	check("Escape dismisses visible hint", hintEscapeStopped && hintNodes[1].removed && hintListeners.size === 0, null);
	hintButton.props.onMouseEnter({ currentTarget: hintTarget });
	hintButton.props.onClick({});
	check("click cancels pending hints and preserves the action", hintTimers.size === 0 && hintClicks === 1, null);
} finally {
	for (const [key, value] of Object.entries(oldHintGlobals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
}

// --- Refs peek dismisses on outside pointer input, including loading/error states ------------
const { RefsPeek } = await import("./src/client/overlays.js");
const originalPeekDocument = globalThis.document;
const peekListeners = new Map();
globalThis.document = { addEventListener: (name, handler, capture) => peekListeners.set(name, { handler, capture }), removeEventListener: () => {} };
try {
	let peekClosed = 0;
	const peekPanel = RefsPeek({ t: (k) => k, cwd: "/w", peek: { symbol: "example", anchorLine: 1, busy: true, def: [], refs: [] }, scroll: 0, totalLines: 10, onPick: () => {}, onClose: () => peekClosed++ });
	const insideTarget = {};
	peekPanel.props.ref.current = { contains: (target) => target === insideTarget };
	peekListeners.get("pointerdown").handler({ target: insideTarget });
	check("peek keeps internal pointer interactions open", peekClosed === 0, peekClosed);
	let preventedOutside = false;
	peekListeners.get("pointerdown").handler({ target: {}, preventDefault: () => { preventedOutside = true; } });
	check("peek closes on outside pointer without swallowing the next action", peekClosed === 1 && !preventedOutside && peekListeners.get("pointerdown").capture === true, peekClosed);
	let stoppedPeekEscape = false;
	peekListeners.get("keydown").handler({ key: "Escape", preventDefault() {}, stopPropagation: () => { stoppedPeekEscape = true; } });
	check("peek Escape works even while focus remains on the editor", peekClosed === 2 && stoppedPeekEscape, peekClosed);
} finally { if (originalPeekDocument === undefined) delete globalThis.document; else globalThis.document = originalPeekDocument; }

// --- Shared dismiss lifecycle: actual capture listeners and component state -----------------
const { registerDismissLayer } = await import("./src/client/dismiss.js");
const dismissalDocument = globalThis.document;
const dismissalFetch = globalThis.fetch;
const dismissalListeners = new Map();
const layerDoc = {
 activeElement: null,
 addEventListener(name, listener, capture) { dismissalListeners.set(name, { listener, capture }); },
 removeEventListener(name, listener) { if (dismissalListeners.get(name)?.listener === listener) dismissalListeners.delete(name); },
};
const outsideNode = {};
const eventFor = (target, patch = {}) => ({ target, button: 0, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...patch });
const dispatchLayer = (name, event) => dismissalListeners.get(name)?.listener(event);
const makeLayerNode = (inside) => ({ ownerDocument: layerDoc, contains: (target) => target === inside, isConnected: true });
globalThis.document = layerDoc;
globalThis.fetch = async () => ({ json: async () => ({ ok: true, value: { branches: [] } }) });
try {
 let lowerClosed = 0, upperClosed = 0;
 const lowerInside = {}, upperInside = {};
 const lower = registerDismissLayer(layerDoc, { node: () => makeLayerNode(lowerInside), dismiss: () => lowerClosed++ });
 const upper = registerDismissLayer(layerDoc, { node: () => makeLayerNode(upperInside), dismiss: () => upperClosed++ });
 dispatchLayer("pointerdown", eventFor(upperInside));
 check("dismiss registry keeps clicks inside top layer open", upperClosed === 0 && lowerClosed === 0, null);
 const clickOutside = eventFor(outsideNode);
 dispatchLayer("pointerdown", clickOutside);
 check("outside dismissal affects only top layer and preserves destination click", upperClosed === 1 && lowerClosed === 0 && !clickOutside.defaultPrevented && !clickOutside.stopped, null);
 dispatchLayer("pointerdown", eventFor(outsideNode, { button: 2 }));
 check("right click does not dismiss a transient layer", upperClosed === 1, null);
 dispatchLayer("keydown", eventFor(outsideNode, { key: "Escape", isComposing: true }));
 check("IME Escape does not dismiss a transient layer", upperClosed === 1, null);
 const escapeTop = eventFor(outsideNode, { key: "Escape" }); dispatchLayer("keydown", escapeTop);
 check("Escape closes only top layer and protects underlying editor", upperClosed === 2 && lowerClosed === 0 && escapeTop.defaultPrevented && escapeTop.stopped, null);
 upper(); lower();
 check("last layer unmount removes both global listeners", dismissalListeners.size === 0, dismissalListeners.size);
 const removed = registerDismissLayer(layerDoc, { node: () => ({ isConnected: false }), dismiss: () => { throw Error("hidden layer dismissed"); } });
 dispatchLayer("pointerdown", eventFor(outsideNode)); removed();
 check("detached layers cannot intercept page interaction", dismissalListeners.size === 0, null);

 const popupCases = [
  ["LocationList", { overlay: { title: "Targets", items: [] }, cwd: "/w", onPick() {} }],
  ["QuickOpen", { state: { query: "", results: [] }, onQuery() {}, onPick() {} }],
  ["SymbolPalette", { symbols: [], onPick() {} }],
  ["GotoLinePalette", { totalLines: 10, initial: 1, onGo() {} }],
  ["FileHistoryOverlay", { hist: { path: "a.txt", commits: [] }, onPick() {} }],
  ["CommandPalette", { commands: [] }],
 ];
 const allOverlays = await import("./src/client/overlays.js");
 const { BranchPalette } = await import("./src/client/branchpick.js");
 popupCases.push(["BranchPalette", { cwd: "/w", current: "main", onDone() {} }]);
 for (const [name, props] of popupCases) {
  let closes = 0;
  const renderer = createHookRenderer(name === "BranchPalette" ? BranchPalette : allOverlays[name], { t: (k) => k, ...props, onClose: () => closes++ }, { effects: true });
  const panel = renderer(); const inside = {};
  panel.props.ref.current = makeLayerNode(inside); renderer.flushEffects();
  dispatchLayer("pointerdown", eventFor(inside));
  dispatchLayer("pointerdown", eventFor(outsideNode));
  check(`${name} dismisses outside while retaining internal controls`, closes === 1, closes);
  dispatchLayer("keydown", eventFor(inside, { key: "Escape" }));
  check(`${name} responds to captured Escape`, closes === 2, closes);
  renderer.unmount();
  check(`${name} cleans up dismissal listeners`, dismissalListeners.size === 0, dismissalListeners.size);
 }
 let restoredFocus = 0;
 const opener = { isConnected: true, focus() { restoredFocus++; } };
 layerDoc.activeElement = opener;
 const popupApi = createHookRenderer(ApiView, { t: (k) => k }, { effects: true });
 let popupTree = popupApi(); popupApi.flushEffects(); popupTree = popupApi();
 const findPopup = (predicate) => collect(popupTree).find(predicate);
 const paintPopup = () => { popupTree = popupApi(); return popupTree; };
 findPopup((n) => n.props["data-ce-popup-trigger"] === "api-save").props.onClick(); paintPopup();
 const favoriteInside = {};
 findPopup((n) => n.props["aria-label"] === "api.saveTitle").props.ref.current = makeLayerNode(favoriteInside); popupApi.flushEffects();
 findPopup((n) => n.props.placeholder === "api.savePlaceholder").props.onChange({ target: { value: "Keep favorite draft" } }); paintPopup();
 dispatchLayer("pointerdown", eventFor(favoriteInside)); paintPopup();
 check("favorite dialog stays open while editing inside", Boolean(findPopup((n) => n.props.placeholder === "api.savePlaceholder")), null);
 dispatchLayer("pointerdown", eventFor(outsideNode)); paintPopup(); popupApi.flushEffects();
 check("favorite dialog closes on outside click without stealing focus", !findPopup((n) => n.props.placeholder === "api.savePlaceholder") && restoredFocus === 0, null);
 findPopup((n) => n.props["data-ce-popup-trigger"] === "api-save").props.onClick(); paintPopup();
 findPopup((n) => n.props["aria-label"] === "api.saveTitle").props.ref.current = makeLayerNode(favoriteInside); popupApi.flushEffects();
 check("reopening favorite retains the unsaved name", findPopup((n) => n.props.placeholder === "api.savePlaceholder")?.props.value === "Keep favorite draft", null);
 dispatchLayer("keydown", eventFor(favoriteInside, { key: "Escape" })); paintPopup(); popupApi.flushEffects();
 check("favorite Escape dismisses and restores prior focus", !findPopup((n) => n.props.placeholder === "api.savePlaceholder") && restoredFocus === 1, restoredFocus);
 findPopup((n) => n.props["data-ce-popup-trigger"] === "api-import").props.onClick(); paintPopup();
 const importInside = {};
 findPopup((n) => n.props["aria-label"] === "api.importTitle" && n.props.role === "dialog").props.ref.current = makeLayerNode(importInside); popupApi.flushEffects();
 findPopup((n) => n.props.className === "cea-body cea-import").props.onChange({ target: { value: "curl https://example.test/keep" } }); paintPopup();
 dispatchLayer("keydown", eventFor(importInside, { key: "Escape" })); paintPopup(); popupApi.flushEffects();
 findPopup((n) => n.props["data-ce-popup-trigger"] === "api-import").props.onClick(); paintPopup();
 findPopup((n) => n.props["aria-label"] === "api.importTitle" && n.props.role === "dialog").props.ref.current = makeLayerNode(importInside); popupApi.flushEffects();
 check("curl import retains draft after Escape", findPopup((n) => n.props.className === "cea-body cea-import")?.props.value === "curl https://example.test/keep", null);
 findPopup((n) => n.props["data-ce-popup-trigger"] === "api-history").props.onClick(); paintPopup(); popupApi.flushEffects();
 const historyInside = {};
 findPopup((n) => n.props.className === "cea-hist").props.ref.current = makeLayerNode(historyInside); popupApi.flushEffects();
 check("opening API history replaces import dialog", !findPopup((n) => n.props.className === "cea-body cea-import") && Boolean(findPopup((n) => n.props.className === "cea-hist")), null);
 dispatchLayer("pointerdown", eventFor(outsideNode)); paintPopup(); popupApi.flushEffects();
 check("API history also dismisses on outside input", !findPopup((n) => n.props.className === "cea-hist"), null);
 // Skills form dismissal closes the form but retains the draft name/scope.
 const newSkillView = createHookRenderer(SkillsView, { cwd: "/w", t: (k) => k, say() {} }, { effects: true });
 let newSkillTree = newSkillView(); newSkillView.flushEffects();
 const skillNode = (fn) => collect(newSkillTree).find(fn);
 skillNode((n) => n.props["data-ce-popup-trigger"] === "skill-create").props.onClick(); newSkillTree = newSkillView();
 const skillInside = {};
 skillNode((n) => n.props.className === "ce-sk-create").props.ref.current = makeLayerNode(skillInside); newSkillView.flushEffects();
 skillNode((n) => n.props.className === "ce-input ce-sk-name-input").props.onChange({ target: { value: "retained-name" } }); newSkillTree = newSkillView();
 dispatchLayer("pointerdown", eventFor(outsideNode)); newSkillTree = newSkillView(); newSkillView.flushEffects();
 check("skill creation closes outside without creating anything", !skillNode((n) => n.props.className === "ce-sk-create"), null);
 skillNode((n) => n.props["data-ce-popup-trigger"] === "skill-create").props.onClick(); newSkillTree = newSkillView();
 check("skill creation retains name after outside dismissal", skillNode((n) => n.props.className === "ce-input ce-sk-name-input")?.props.value === "retained-name", null);
 newSkillView.unmount();
 // A hunk confirmation only disarms; outside clicks never execute revert.
 let actualReverts = 0;
 const confirmDiff = createHookRenderer(DiffView, { t: (k) => k, diff: { text: "@@ -1 +1 @@\n-old\n+new\n", scope: "working" }, onRevertHunk: () => actualReverts++, onClose() {} }, { effects: true });
 let confirmTree = confirmDiff(); confirmDiff.flushEffects(); confirmTree = confirmDiff();
 collect(confirmTree).find((n) => n.props.title === "diff.revertHunk").props.onClick({ stopPropagation() {} }); confirmTree = confirmDiff();
 collect(confirmTree).find((n) => n.props.className === "ce-hunk-confirm").props.ref.current = makeLayerNode({}); confirmDiff.flushEffects();
 dispatchLayer("pointerdown", eventFor(outsideNode)); confirmTree = confirmDiff(); confirmDiff.flushEffects();
 check("outside hunk confirmation cancels without reverting", !collect(confirmTree).some((n) => n.props.className === "ce-hunk-confirm") && actualReverts === 0, null);
 confirmDiff.unmount();
 popupApi.unmount();
 check("API unmount releases its capture listeners", dismissalListeners.size === 0, null);
} finally {
 globalThis.fetch = dismissalFetch;
 if (dismissalDocument === undefined) delete globalThis.document; else globalThis.document = dismissalDocument;
}

// --- Host close cleanup refuses to discard a matching unsaved tool document -----------------
const { useToolCloseGuard, registerToolCloseGuard } = await import("./src/client/closeguard.js");
const closeDocument = globalThis.document, closeCustomEvent = globalThis.CustomEvent;
const guardDocument = new EventTarget();
globalThis.document = guardDocument;
if (typeof globalThis.CustomEvent === "undefined") globalThis.CustomEvent = class extends Event { constructor(type, init) { super(type, init); this.detail = init.detail; } };
const cleanupHandlers = new Map();
const guardedSidebar = { registerCloseHandler(kind, handler) { cleanupHandlers.set(kind, handler); return () => cleanupHandlers.delete(kind); } };
let closeBlockedCount = 0;
try {
 const guardProps = { sessionId: "A", kind: "code", dirty: true, onBlocked: () => closeBlockedCount++ };
 const drawGuard = createHookRenderer(() => { useToolCloseGuard(guardProps); return null; }, {}, { effects: true });
 drawGuard(); drawGuard.flushEffects();
 const stopGuard = registerToolCloseGuard(guardedSidebar, "code", () => "save first", guardDocument);
 let refused = false; try { cleanupHandlers.get("code")("A"); } catch (error) { refused = error.message === "save first"; }
 check("native sidebar close handler vetoes unsaved code tab", refused && closeBlockedCount === 1, closeBlockedCount);
 cleanupHandlers.get("code")("B");
 check("unsaved close guard is scoped to its session", closeBlockedCount === 1, closeBlockedCount);
 guardProps.dirty = false; drawGuard(); drawGuard.flushEffects(); cleanupHandlers.get("code")("A");
 check("saving removes sidebar close veto", closeBlockedCount === 1, closeBlockedCount);
 drawGuard.unmount(); stopGuard();
 check("close guard handlers clean up on plugin unload", cleanupHandlers.size === 0, cleanupHandlers.size);
} finally {
 if (closeDocument === undefined) delete globalThis.document; else globalThis.document = closeDocument;
 if (closeCustomEvent === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = closeCustomEvent;
}

// --- the generated bundle: registration + factory --------------------------------------

const bundle = await readFile(new URL("./client.js", import.meta.url), "utf8");

// The bundle is a classic script for the DSH client module system: it must register exactly
// one module id and hand back a factory that materializes the plugin descriptor.
let registered = null;
globalThis.window = { __ModuleLoader__: { load: (m) => (registered = m) } };
new Function(bundle)();
check("bundle registers the plugin module id", registered?.id === "dsh-plugin-kit", registered?.id);
check("bundle registers a factory function", typeof registered?.factory === "function", typeof registered?.factory);

const requireReact = (spec) => {
	if (spec !== "react") throw new Error(`unexpected require: ${spec}`);
	return ReactStub;
};
const exported = registered.factory(requireReact);
// Same normalization the host loader applies before mounting a client module.
const descriptor = exported?.__esModule ? exported.default : exported;
check(
	"factory returns { inject: [...], apply(ctx) }",
	Array.isArray(descriptor?.inject) && typeof descriptor?.apply === "function",
	descriptor && Object.keys(descriptor),
);
check(
	"bundle inject list matches the source descriptor",
	JSON.stringify(descriptor?.inject) === JSON.stringify(sourceDescriptor.inject) &&
		JSON.stringify(descriptor?.inject) === JSON.stringify(["slots", "locale", "sidebarRightTabs", "sidebarRight", "layout"]),
	descriptor?.inject,
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
