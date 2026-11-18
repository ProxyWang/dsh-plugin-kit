// Checks the client half: the pure helper ES modules, and the generated bundle's module
// registration (id + factory shape), against the sources they were built from.
import { readFile } from "node:fs/promises";
import { register } from "node:module";

// "react" is a browser platform seed word; serve it from a stub so the real modules load.
register("./test-support/esm-react-hook.mjs", import.meta.url);

const { buildLineStates, tokenizeLine, wordAt, langFor } = await import("./src/client/highlight.js");
const { parseDiff } = await import("./src/client/diff.js");
const { draftDiskDiff } = await import("./src/client/draftdiff.js");
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

// --- Changes: untracked files get a DELETE action (revert cannot apply) ----------------------
{
	const { createHookRenderer } = await import("./test-support/react-stub.mjs");
	const deletions = [];
	const dirDeletions = [];
	const reverts = [];
	const baseProps = {
		cwd: "/w", repo: "/w", scope: "working", t: (key) => key,
		onOpen() {},
		onDelete: (item) => deletions.push(item.path),
		onDeleteDir: (dirPath, list) => dirDeletions.push([dirPath, list.length]),
		onDiscard: (item) => reverts.push(item.path),
		onDiscardDir: () => {},
	};
	const items = [
		{ path: "notes/untracked-a.txt", ch: "U" },
		{ path: "notes/untracked-b.zip", ch: "U" },
		{ path: "src/tracked.go", ch: "M" },
	];
	const renderDT = createHookRenderer(ChangeTreeCmp, { ...baseProps, items, keyPrefix: "dt" }, { effects: true });
	let dtTree = renderDT();
	renderDT.flushEffects();
	const dtFind = (test) => collect(dtTree).find(test);
	const delButtons = () => collect(dtTree).filter((n) => n.type === "button" && n.props.title === "changes.deleteUntracked");
	check("untracked rows expose a delete action, tracked rows do not", delButtons().length === 2, delButtons().length);
	check("tracked rows keep the revert action instead", collect(dtTree).some((n) => n.type === "button" && n.props.title === "changes.discard"), null);
	check("an all-untracked folder offers folder deletion", collect(dtTree).some((n) => n.type === "button" && n.props.title === "changes.deleteDir"), null);
	// Two-step: the first click only arms, the second deletes exactly that file.
	delButtons()[0].props.onClick({ stopPropagation() {} });
	dtTree = renderDT();
	renderDT.flushEffects();
	check("arming a delete removes nothing", deletions.length === 0, deletions);
	const confirmDelete = dtFind((n) => n.type === "button" && n.props.title === "changes.confirmDelete");
	check("the confirm control appears after arming", Boolean(confirmDelete), null);
	confirmDelete.props.onClick({ stopPropagation() {} });
	check("confirming deletes exactly the armed file", deletions.join() === "notes/untracked-a.txt", deletions);
	const mixed = createHookRenderer(ChangeTreeCmp, {
		...baseProps,
		items: [{ path: "mixed/one.txt", ch: "U" }, { path: "mixed/two.go", ch: "M" }],
		keyPrefix: "dt2",
	}, { effects: true });
	let mixedTree = mixed();
	mixed.flushEffects();
	check("a mixed folder offers no folder-level delete", !collect(mixedTree).some((n) => n.type === "button" && n.props.title === "changes.deleteDir"), null);
	check("a mixed folder still offers folder revert", collect(mixedTree).some((n) => n.type === "button" && n.props.title === "changes.discardDir"), null);
	check("the untracked file inside a mixed folder is still individually deletable", collect(mixedTree).filter((n) => n.type === "button" && n.props.title === "changes.deleteUntracked").length === 1, null);
}

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

// --- Host terminal entry: the workspace opens the product's terminal beside itself ----------
const { createTerminalEntry, terminalKindRegistered, inertTerminalEntry } = await import("./src/client/terminal.js");
check("terminal entry probes the host tab registry", terminalKindRegistered(fakeRegistry) === true && terminalKindRegistered({ entries: () => [{ kind: "code" }] }) === false && terminalKindRegistered({ entries: () => { throw new Error("x"); } }) === false, null);
const hiddenEntry = createTerminalEntry({ sidebarRight: { openTab: () => { throw new Error("must not open"); } }, sidebarRightTabs: { entries: () => [] } });
check("terminal entry hides and refuses without the host tab type", hiddenEntry.available() === false && hiddenEntry.open().reason === "unavailable", hiddenEntry.open());
const terminalOpens = [];
const terminalSidebar = { mounted: { getSnapshot: () => "s1" }, openTab: (kind, options) => { terminalOpens.push([kind, options]); } };
const entry = createTerminalEntry({ sidebarRight: terminalSidebar, sidebarRightTabs: fakeRegistry });
check("terminal entry asks the docked pane to split", entry.open().ok === true && terminalOpens[0][0] === "terminal" && terminalOpens[0][1].preferNewPane === true, terminalOpens[0]);
check("terminal entry trusts the host instead of diffing tabs", entry.open().sessionId === "s1" && terminalOpens.length === 2, terminalOpens.length);
const noSessionEntry = createTerminalEntry({ sidebarRight: { mounted: { getSnapshot: () => undefined }, openTab: () => {} }, sidebarRightTabs: fakeRegistry });
check("terminal entry reports a missing session", noSessionEntry.open().reason === "noSession", noSessionEntry.open());
const failingEntry = createTerminalEntry({ sidebarRight: { mounted: { getSnapshot: () => "s" }, openTab: () => { throw new Error("no surface"); } }, sidebarRightTabs: fakeRegistry });
check("terminal entry turns an openTab failure into a reason", failingEntry.open().reason === "failed", failingEntry.open());
check("terminal entry survives a hostile registry", createTerminalEntry({ sidebarRight: terminalSidebar, sidebarRightTabs: { entries: () => { throw new Error("x"); } } }).available() === false, null);
check("inert terminal entry never claims a terminal", inertTerminalEntry.available() === false && inertTerminalEntry.open().ok === false, null);
const terminalCopy = ["toolbar.terminal", "toolbar.terminalHint", "command.terminal", "terminal.fail.noSession", "terminal.fail.unavailable", "terminal.fail.failed"];
const { zh: zhDict, en: enDict } = await import("./src/client/locale.js");
check("terminal copy exists in both dictionaries", terminalCopy.every((key) => typeof zhDict[key] === "string" && zhDict[key] !== "" && typeof enDict[key] === "string" && enDict[key] !== ""), terminalCopy.filter((key) => typeof zhDict[key] !== "string" || typeof enDict[key] !== "string"));
check("zh and en dictionaries stay key-identical", Object.keys(zhDict).length === Object.keys(enDict).length && Object.keys(zhDict).every((key) => key in enDict) && Object.keys(enDict).every((key) => key in zhDict), [Object.keys(zhDict).filter((key) => !(key in enDict)), Object.keys(enDict).filter((key) => !(key in zhDict))]);

// --- Native left navigation routes tools to the current right-side workspace ----------------
const { collectLeftTools, makeLeftToolRouter, installLeftTools, WorkspaceGuide, LEFT_TOOL_PREFIX, isHiddenLeftToolKind } = await import("./src/client/lefttools.js");
const { definition, apiDefinition, skillsDefinition } = await import("./src/client/register.js");
const leftDefinitions = [definition((k) => k), apiDefinition((k) => k), skillsDefinition((k) => k),
 { kind: "files", guide: [{ id: "f", title: () => "Files" }] },
 { kind: "browser", guide: [{ id: "browser", title: () => "Browser", order: 1 }] },
 { kind: "terminal", guide: [{ id: "terminal", title: () => "Terminal", order: 2 }] },
];
const leftRegistryListeners = new Set();
const leftRegistry = { entries: () => leftDefinitions, subscribe(fn) { leftRegistryListeners.add(fn); return () => leftRegistryListeners.delete(fn); } };
const leftTools = collectLeftTools(leftRegistry, (k) => k);
check("left navigation collects workspace API skills and browser", leftTools.map((tool) => tool.kind).join() === "code,code-api,code-skills,browser", leftTools.map((tool) => tool.kind));
check("terminal entry is folded into the workspace instead of the left rail", isHiddenLeftToolKind("terminal") === true && isHiddenLeftToolKind("browser") === false && leftTools.every((tool) => tool.kind !== "terminal"), leftTools.map((tool) => tool.kind));
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
selectedLeftPanel = `${LEFT_TOOL_PREFIX}terminal/new`;
for (const listener of leftLayoutListeners) listener();
check("restored selection of a folded-away tool returns to Conversation", selectedLeftPanel === null && onScreenSession === leftSession, selectedLeftPanel);
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

// --- Right sidebar first opening: widest the frame allows, then the user's own drag ----------
const { installRightbarWidth, rightbarWidthWriter, readRememberedWidth, rememberWidth, measureRightbarWidth, WIDTH_KEY } = await import("./src/client/rightbarwidth.js");
const widthStorage = (initial = {}) => {
	const data = new Map(Object.entries(initial));
	return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => { data.set(key, String(value)); } };
};
// The host store's own clamp for the frame it is measuring: [300px, 70%], rounded.
const widthLayout = (viewport) => {
	const state = { viewport };
	const log = [];
	return { log, state, layout: { panels: { setRightbar: (px) => log.push(Math.min(Math.max(300, Math.round(px)), Math.round(state.viewport * 0.7))) } } };
};
// The frame as the plugin sees it: the right column track, the rightbar handle, the resize event.
const widthFrame = ({ track = 0, handle = false } = {}) => {
	const listeners = new Map();
	const on = (kind, fn) => { const set = listeners.get(kind) ?? new Set(); set.add(fn); listeners.set(kind, set); };
	const fire = (kind) => { for (const fn of listeners.get(kind) ?? []) fn({}); return listeners.get(kind)?.size ?? 0; };
	const target = { closest: (selector) => (handle && selector === '[data-side="rightbar"]' ? {} : null) };
	return {
		doc: {
			addEventListener: on,
			removeEventListener: (kind, fn) => { listeners.get(kind)?.delete(fn); },
			querySelector: (selector) => selector === "[data-rightbar-col]"
				? { getBoundingClientRect: () => ({ width: track }) }
				: selector === '[data-side="rightbar"]' && handle ? {} : null,
			pointerUp: () => { for (const fn of listeners.get("pointerup") ?? []) fn({ target }); return listeners.get("pointerup")?.size ?? 0; },
		},
		view: { addEventListener: on, removeEventListener: (kind, fn) => { listeners.get(kind)?.delete(fn); }, resize: () => fire("resize") },
	};
};
check("the width seam is probed before anything is written", rightbarWidthWriter(null) === null && rightbarWidthWriter({}) === null && rightbarWidthWriter({ panels: {} }) === null);
check("a host without the internal width action keeps its own 45% opening", [undefined, null, {}, { panels: {} }].every((layout) => typeof installRightbarWidth({ layout, doc: null, storage: null }) === "function"));
const firstOpen = widthLayout(1400);
installRightbarWidth({ layout: firstOpen.layout, doc: null, storage: widthStorage() });
check("the first opening asks for the ceiling and lands on 70% of the frame", firstOpen.log.length === 1 && firstOpen.log[0] === 980, firstOpen.log);
const restored = widthLayout(1400);
installRightbarWidth({ layout: restored.layout, doc: null, storage: widthStorage({ [WIDTH_KEY]: "520" }) });
check("a remembered drag is what the first opening restores", restored.log[0] === 520, restored.log);
check("junk and below-floor widths are not a remembered choice", ["missing", "", "abc", "0", "120", "NaN"].map((raw) => readRememberedWidth(widthStorage(raw === "missing" ? {} : { [WIDTH_KEY]: raw }))).every((px) => px === null) && readRememberedWidth(widthStorage({ [WIDTH_KEY]: "300" })) === 300);
check("rememberWidth rejects junk and rounds a real width", rememberWidth(0, widthStorage()) === false && rememberWidth(Number.NaN, widthStorage()) === false && rememberWidth(900.4, widthStorage()) === true);
const dragged = widthStorage();
const draggedFrame = widthFrame({ track: 760, handle: true });
installRightbarWidth({ layout: widthLayout(1400).layout, doc: draggedFrame.doc, storage: dragged, afterDrag: (run) => run() });
draggedFrame.doc.pointerUp();
check("a settled drag becomes the width the next opening restores", dragged.getItem(WIDTH_KEY) === "760", dragged.getItem(WIDTH_KEY));
const plainPointer = widthFrame({ track: 760, handle: false });
const plainStore = widthStorage();
installRightbarWidth({ layout: widthLayout(1400).layout, doc: plainPointer.doc, storage: plainStore, afterDrag: (run) => run() });
plainPointer.doc.pointerUp();
check("a pointerup that is not the rightbar handle stores nothing", plainStore.getItem(WIDTH_KEY) === null, plainStore.getItem(WIDTH_KEY));
const noTrack = widthStorage();
const closedFrame = widthFrame({ track: 0, handle: true });
installRightbarWidth({ layout: widthLayout(1400).layout, doc: closedFrame.doc, storage: noTrack, afterDrag: (run) => run() });
closedFrame.doc.pointerUp();
check("a column with no track is not a width the user chose", noTrack.getItem(WIDTH_KEY) === null && measureRightbarWidth(closedFrame.doc) === 0, noTrack.getItem(WIDTH_KEY));
const deferredFrame = widthFrame({ track: 700, handle: true });
const deferredRuns = [];
installRightbarWidth({ layout: widthLayout(1400).layout, doc: deferredFrame.doc, storage: widthStorage(), afterDrag: (run) => { deferredRuns.push(run); } });
deferredFrame.doc.pointerUp();
check("the width is read only after the gesture settles", deferredRuns.length === 1, deferredRuns.length);
const resizeStore = widthStorage();
const widened = widthLayout(1400);
const closedForResize = widthFrame({ handle: false });
installRightbarWidth({ layout: widened.layout, doc: closedForResize.doc, storage: resizeStore, view: closedForResize.view, afterDrag: (run) => run() });
widened.state.viewport = 2000;
closedForResize.view.resize();
check("a wider window before the first opening moves the ceiling with the frame", widened.log.length === 2 && widened.log[1] === 1400, widened.log);
const chosenStore = widthStorage({ [WIDTH_KEY]: "640" });
const chosen = widthLayout(1400);
const chosenFrame = widthFrame({ handle: false });
installRightbarWidth({ layout: chosen.layout, doc: chosenFrame.doc, storage: chosenStore, view: chosenFrame.view, afterDrag: (run) => run() });
chosen.state.viewport = 2000;
chosenFrame.view.resize();
check("a user who already chose a width is never re-widened by a resize", chosen.log.length === 1 && chosen.log[0] === 640, chosen.log);
const openFrame = widthFrame({ track: 980, handle: true });
const openLayout = widthLayout(1400);
installRightbarWidth({ layout: openLayout.layout, doc: openFrame.doc, storage: widthStorage(), view: openFrame.view, afterDrag: (run) => run() });
openLayout.state.viewport = 2000;
openFrame.view.resize();
check("a panel already on screen is not yanked wider by a resize", openLayout.log.length === 1, openLayout.log);
const unloadFrame = widthFrame({ track: 700, handle: true });
const unloadStorage = widthStorage();
const disposeWidth = installRightbarWidth({ layout: widthLayout(1400).layout, doc: unloadFrame.doc, storage: unloadStorage, view: unloadFrame.view, afterDrag: (run) => run() });
disposeWidth();
check("plugin unload unhooks the drag memory and the resize pin", unloadFrame.doc.pointerUp() === 0 && unloadFrame.view.resize() === 0 && unloadStorage.getItem(WIDTH_KEY) === null, unloadStorage.getItem(WIDTH_KEY));


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
// Multi-instance close semantics, now exercised through browser: the terminal
// kind left the left rail when its entry moved into Dev Workspace.
toggleSessions.set("A", [{ id: "guide-A", kind: "guide" }, { id: "browser-one", kind: "browser" }, { id: "browser-two", kind: "browser" }]);
toggleExpanded.set("A", true); toggleActive.set("A", "browser-one");
clickToggle("browser");
check("multiple tool instances close the active matching instance only", toggleCalls.at(-1)?.close === "browser-one" && toggleSidebar.tabsIn("A").some((tab) => tab.id === "browser-two") && toggleSidebar.isExpanded(), toggleSidebar.tabsIn("A"));
clickToggle("browser");
check("closing final tool tab collapses workspace", !toggleSidebar.isExpanded(), null);

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
const { parseCurl, toCurl, shellQuote, tokenizeCurl, expandShortFlags } = await import("./src/client/curl.js");
const { substituteVars, buildEnvMap } = await import("./src/client/reqmodel.js");
const c1 = parseCurl("curl -X POST 'https://a.b/c?d=1' -H 'Content-Type: application/json' -H 'X-T: v' --data '{\"x\":1}'");
check("parseCurl post json", c1.method === "POST" && c1.url === "https://a.b/c?d=1" && c1.headers.length === 2 && c1.body === '{"x":1}', c1);
const c2 = parseCurl("curl https://a.b/x \\\n  -H 'A: b' \\\n  -u user:pass");
check("parseCurl continuation + -u folds into the auth section (Bruno-style)", c2.method === "GET" && c2.auth?.mode === "basic" && c2.auth.user === "user" && c2.auth.pass === "pass" && !c2.headers.some((hd) => hd.name.toLowerCase() === "authorization") && c2.headers.some((hd) => hd.name === "A" && hd.value === "b"), c2);
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
// curlconverter-style shapes (the parser Bruno's importer is built on)
const ca = parseCurl("curl -XPOST 'https://a.b/x' -H'Authorization: Bearer tok' -d a=1 -d 'b=2 3'");
check("parseCurl attached short flags (-XPOST, -H'…')", ca.method === "POST" && ca.headers.some((hd) => hd.name === "Authorization") === false, ca);
check("parseCurl Bearer header folds into auth", ca.auth?.mode === "bearer" && ca.auth.token === "tok", ca);
check("parseCurl k=v data chunks become form pairs", JSON.stringify(ca.form) === JSON.stringify([{ name: "a", value: "1" }, { name: "b", value: "2 3" }]) && ca.body === "", ca);
const cb = parseCurl("curl 'https://a.b/z' --data-raw $'line1\\nline2\\x41\\''");
check("parseCurl ANSI-C $'…' quoting decodes escapes", cb.body === "line1\nline2A'", JSON.stringify(cb.body));
const cc = parseCurl("curl 'https://a.b/w?q=1' --url-query 'r=2' -H 'X-Empty;' --form-string 'f=v'");
check("parseCurl --url-query appends to the URL", cc.url === "https://a.b/w?q=1&r=2", cc.url);
check("parseCurl curl empty-header form (Name;)", cc.headers.some((hd) => hd.name === "X-Empty" && hd.value === ""), cc.headers);
check("parseCurl --form-string becomes a multipart field", cc.multipart?.[0]?.name === "f" && cc.multipart[0].value === "v", cc.multipart);
const cd = parseCurl("curl --data=a=1 --header='X-H: v' https://a.b/eq");
check("parseCurl long flags with attached values (--data=, --header=)", cd.form?.[0]?.name === "a" && cd.headers.some((hd) => hd.name === "X-H" && hd.value === "v"), cd);
check("tokenizeCurl keeps quoted spaces and drops the curl word", JSON.stringify(tokenizeCurl("curl 'a b' \"c d\"")) === JSON.stringify(["a b", "c d"]), tokenizeCurl("curl 'a b' \"c d\""));
check("expandShortFlags leaves boolean clusters alone", JSON.stringify(expandShortFlags(["-sS", "-d", "x"])) === JSON.stringify(["-sS", "-d", "x"]), null);
const ce = parseCurl("curl -H 'Authorization: Basic " + btoa(unescape(encodeURIComponent("u:p"))) + "' https://a.b/basic");
check("parseCurl Basic header decodes into the auth section", ce.auth?.mode === "basic" && ce.auth.user === "u" && ce.auth.pass === "p" && ce.headers.length === 0, ce);
const cf = parseCurl("curl -H 'Authorization: Basic !!!not-base64!!!' https://a.b/keep");
check("parseCurl keeps undecodable Authorization headers as-is", cf.auth === undefined && cf.headers.some((hd) => hd.name === "Authorization"), cf);

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
const { mergeParams } = await import("./src/client/reqmodel.js");
check("mergeParams appends new param", mergeParams("https://a.b/x", [{ name: "q", value: "1" }]) === "https://a.b/x?q=1", mergeParams("https://a.b/x", [{ name: "q", value: "1" }]));
check("mergeParams overrides same name, keeps others", mergeParams("https://a.b/x?q=1&r=2", [{ name: "q", value: "9" }]) === "https://a.b/x?q=9&r=2", mergeParams("https://a.b/x?q=1&r=2", [{ name: "q", value: "9" }]));
check("mergeParams without active pairs is identity", mergeParams("https://a.b/x?q=1", []) === "https://a.b/x?q=1" && mergeParams("https://a.b/x", [{ name: " ", value: "1" }]) === "https://a.b/x", null);
check("mergeParams preserves fragment", mergeParams("https://a.b/x#frag", [{ name: "q", value: "1" }]) === "https://a.b/x?q=1#frag", mergeParams("https://a.b/x#frag", [{ name: "q", value: "1" }]));
check("mergeParams empty value sends bare name", mergeParams("https://a.b/x", [{ name: "q", value: "" }]) === "https://a.b/x?q=", mergeParams("https://a.b/x", [{ name: "q", value: "" }]));
check("mergeParams encodes special chars", mergeParams("https://a.b/x", [{ name: "q", value: "a b&c" }]).includes("q=a+b%26c") || mergeParams("https://a.b/x", [{ name: "q", value: "a b&c" }]).includes("q=a%20b%26c"), mergeParams("https://a.b/x", [{ name: "q", value: "a b&c" }]));

// --- request model: URL ↔ params two-way sync (Bruno query sync) ---------------------------------
const {
	splitUrl, parseQueryPairs, buildQuery, syncParamsFromUrl, applyParamsToUrl, normalizeUrlParams,
	normalizeEnvStore, emptyEnvStore, activeEnvOf, envMapOf, addEnv, renameEnv, removeEnv, selectEnv, setEnvVars,
	normalizeAuth, basicAuthValue, decodeBasicAuth, authHeaders, applyAuth, resolveRequest, guessRawSubType,
} = await import("./src/client/reqmodel.js");
check("splitUrl separates base, query and fragment", JSON.stringify(splitUrl("https://a.b/x?q=1#f")) === JSON.stringify({ base: "https://a.b/x", query: "q=1", fragment: "#f" }), splitUrl("https://a.b/x?q=1#f"));
check("splitUrl tolerates missing query/fragment", splitUrl("https://a.b/x").query === "" && splitUrl("https://a.b/x").fragment === "" && splitUrl("").base === "", null);
check("parseQueryPairs decodes and keeps duplicates in order", JSON.stringify(parseQueryPairs("q=1&x=a+b&q=2")) === JSON.stringify([{ name: "q", value: "1" }, { name: "x", value: "a b" }, { name: "q", value: "2" }]), parseQueryPairs("q=1&x=a+b&q=2"));
check("buildQuery skips disabled and nameless rows", buildQuery([{ name: "a", value: "1" }, { name: "b", value: "2", enabled: false }, { name: " ", value: "3" }]) === "a=1", buildQuery([{ name: "a", value: "1" }]));
check("URL→params mirrors the query and carries descriptions over once", JSON.stringify(syncParamsFromUrl("https://a.b/x?q=1&q=2&z=", [{ name: "q", value: "old", description: "first" }]).map((r) => [r.name, r.value, r.enabled, r.kind, r.description])) === JSON.stringify([["q", "1", true, "query", "first"], ["q", "2", true, "query", ""], ["z", "", true, "query", ""]]), syncParamsFromUrl("https://a.b/x?q=1&q=2", [{ name: "q", description: "first" }]));
check("URL→params drops rows that left the URL", syncParamsFromUrl("https://a.b/x", [{ name: "gone", value: "1" }]).length === 0, null);
check("params→URL rebuilds query and preserves base and fragment", applyParamsToUrl("https://a.b/x?stale=1#f", [{ name: "q", value: "1" }, { name: "q", value: "2" }, { name: "off", value: "x", enabled: false }]) === "https://a.b/x?q=1&q=2#f", applyParamsToUrl("https://a.b/x?stale=1#f", [{ name: "q", value: "1" }]));
check("params→URL with no active rows clears the query", applyParamsToUrl("https://a.b/x?q=1", []) === "https://a.b/x" && applyParamsToUrl("https://a.b/x?q=1", [{ name: "q", value: "1", enabled: false }]) === "https://a.b/x", null);
check("sync round-trips: url→params→url is stable", applyParamsToUrl("https://a.b/x?a=1&b=x+y", syncParamsFromUrl("https://a.b/x?a=1&b=x+y", [])) === "https://a.b/x?a=1&b=x+y", null);
check("normalizeUrlParams merges legacy snapshots then re-projects", JSON.stringify(normalizeUrlParams("https://a.b/x?keep=1", [{ name: "q", value: "2" }]).pairs.map((r) => [r.name, r.value, r.enabled, r.kind])) === JSON.stringify([["keep", "1", true, "query"], ["q", "2", true, "query"]]) && normalizeUrlParams("https://a.b/x?keep=1", [{ name: "q", value: "2" }]).url === "https://a.b/x?keep=1&q=2", normalizeUrlParams("https://a.b/x?keep=1", [{ name: "q", value: "2" }]));

// --- request model: environments (Bruno named environment store) ---------------------------------
check("normalizeEnvStore migrates the legacy flat array", (() => {
	const s = normalizeEnvStore([{ name: "base", value: "https://h" }]);
	return s.envs.length === 1 && s.envs[0].id === "env-default" && s.envs[0].name === "Default" && s.activeId === "env-default" && envMapOf(s).base === "https://h";
})(), null);
check("normalizeEnvStore migrates an empty legacy array to no environment", normalizeEnvStore([]).envs.length === 0 && normalizeEnvStore([]).activeId === null && normalizeEnvStore(null).activeId === null && normalizeEnvStore("junk").activeId === null, null);
check("normalizeEnvStore drops an unknown activeId", normalizeEnvStore({ envs: [{ id: "x", name: "X", vars: [] }], activeId: "zz" }).activeId === null, null);
check("normalizeEnvStore sanitizes env rows", normalizeEnvStore({ envs: [null, { name: "  ", vars: "junk" }, { id: "y", name: "Y", vars: [{ name: "a", value: 1 }] }] , activeId: "y" }).envs.length === 2, normalizeEnvStore({ envs: [null, { id: "y" }] }));
let envStore = emptyEnvStore();
envStore = addEnv(envStore, { id: "e1" });
check("addEnv creates an active auto-named environment", envStore.activeId === "e1" && envStore.envs[0].name === "Environment 1", envStore);
envStore = addEnv(envStore, { id: "e2", name: "Prod" });
envStore = setEnvVars(envStore, "e1", [{ name: "base", value: "https://dev" }]);
envStore = setEnvVars(envStore, "e2", [{ name: "base", value: "https://prod" }, { name: "off", value: "x", enabled: false }]);
check("the active environment drives the send-time variable map", envMapOf(envStore).base === "https://prod" && envMapOf(envStore).off === undefined, envMapOf(envStore));
envStore = selectEnv(envStore, "e1");
check("selectEnv switches the active variable map", envMapOf(envStore).base === "https://dev", envMapOf(envStore));
check("selectEnv rejects unknown ids", selectEnv(envStore, "nope").activeId === "e1" && selectEnv(envStore, "").activeId === null, null);
check("activeEnvOf returns null for No Environment", activeEnvOf(selectEnv(envStore, null)) === null && envMapOf(selectEnv(envStore, null)) && Object.keys(envMapOf(selectEnv(envStore, null))).length === 0, null);
check("renameEnv trims and refuses empty names", renameEnv(envStore, "e1", "  Dev  ").envs[0].name === "Dev" && renameEnv(envStore, "e1", "   ") === envStore, null);
check("removeEnv drops the environment and deactivates it", removeEnv(envStore, "e1").envs.length === 1 && removeEnv(envStore, "e1").activeId === null && removeEnv(envStore, "e2").activeId === "e1", null);
check("addEnv avoids duplicate auto names", addEnv({ envs: [{ id: "a", name: "Environment 1", vars: [] }, { id: "b", name: "Environment 2", vars: [] }], activeId: null }).envs[2].name === "Environment 3", null);

// --- request model: auth section (Bruno Auth tab) -------------------------------------------------
check("normalizeAuth coerces arbitrary input", JSON.stringify(normalizeAuth({ mode: "bogus", token: 5 })) === JSON.stringify({ mode: "none", token: "", user: "", pass: "" }) && normalizeAuth(null).mode === "none", null);
check("basicAuthValue is UTF-8 safe and decodable", decodeBasicAuth(basicAuthValue("üser", "p:ss"))?.user === "üser" && decodeBasicAuth(basicAuthValue("üser", "p:ss")).pass === "p:ss", null);
check("decodeBasicAuth rejects malformed values", decodeBasicAuth("Bearer x") === null && decodeBasicAuth("Basic !!!") === null && decodeBasicAuth("") === null, null);
check("authHeaders generates Bearer/Basic and nothing for none", JSON.stringify(authHeaders({ mode: "bearer", token: "T" })) === JSON.stringify([{ name: "Authorization", value: "Bearer T" }]) && authHeaders({ mode: "none" }).length === 0 && authHeaders({ mode: "bearer", token: " " }).length === 0 && authHeaders({ mode: "basic", user: "", pass: "" }).length === 0, null);
check("applyAuth overrides a manual Authorization header once", (() => {
	const out = applyAuth([{ name: "X", value: "1" }, { name: "authorization", value: "manual" }], { mode: "bearer", token: "T" });
	return out.length === 2 && out[1].name === "Authorization" && out[1].value === "Bearer T";
})(), null);
check("applyAuth with mode none leaves headers untouched", applyAuth([{ name: "authorization", value: "manual" }], { mode: "none" })[0].value === "manual", null);

// --- request model: send resolution (one builder for wire, timeline and codegen) ------------------
const resolvedSend = resolveRequest({
	method: "post", url: "  https://{{host}}/x?a=1 ", headers: [{ name: " X-T ", value: "{{tok}}" }, { name: "Authorization", value: "manual" }, { name: "off", value: "x", enabled: false }, { name: "", value: "y" }],
	bodyType: "raw", rawSub: "json", body: '{"i":{{id}}}', auth: { mode: "bearer", token: "T" }, timeoutMs: 5000,
}, { host: "h.test", tok: "tv", id: 9 });
check("resolveRequest substitutes vars in URL, headers and body", resolvedSend.url === "https://h.test/x?a=1" && resolvedSend.headers[0].name === "X-T" && resolvedSend.headers[0].value === "tv" && resolvedSend.body === '{"i":9}', resolvedSend);
check("resolveRequest folds auth last, dropping the manual header", resolvedSend.headers.filter((hd) => hd.name.toLowerCase() === "authorization").length === 1 && resolvedSend.headers.at(-1).value === "Bearer T", resolvedSend.headers);
check("resolveRequest normalizes the method and keeps a finite timeout", resolvedSend.method === "POST" && resolvedSend.timeoutMs === 5000, resolvedSend);
const resolvedForm = resolveRequest({ method: "POST", url: "https://a.b/f", headers: [], bodyType: "form", formPairs: [{ name: "a", value: "{{v}}" }, { name: "b", value: "x", enabled: false }] }, { v: "1 2" });
check("resolveRequest form-encodes active pairs and sets the content type", resolvedForm.body === "a=1+2" && resolvedForm.headers.some((hd) => hd.value === "application/x-www-form-urlencoded"), resolvedForm);
const resolvedMp = resolveRequest({ method: "POST", url: "https://a.b/m", headers: [{ name: "Content-Type", value: "text/plain" }], bodyType: "multipart", formPairs: [{ name: "f", value: "v" }] }, {});
check("resolveRequest multipart keeps fields separate from the body", resolvedMp.multipart?.[0]?.name === "f" && resolvedMp.body === undefined, resolvedMp);
const resolvedNone = resolveRequest({ method: "GET", url: "https://a.b/n", headers: [], bodyType: "none", timeoutMs: 0 }, {});
check("resolveRequest omits body/multipart/timeout for a plain GET", resolvedNone.body === undefined && resolvedNone.multipart === undefined && resolvedNone.timeoutMs === undefined && resolvedNone.headers.length === 0, resolvedNone);
check("guessRawSubType prefers the content type then shape then text", guessRawSubType([{ name: "Content-Type", value: "application/vnd.api+json" }], "x") === "json" && guessRawSubType([], '{"a":1}') === "json" && guessRawSubType([], "[oops") === "text" && guessRawSubType([], "<?xml v") === "xml" && guessRawSubType([], "hello") === "text", null);

// --- code snippet generators (Bruno-style codegen) ---------------------------------------------------
const { toCurlSnippet, toFetchSnippet, toPythonSnippet, SNIPPET_KINDS } = await import("./src/client/codegen.js");
check("codegen menu offers curl, fetch, python and bru generators", JSON.stringify(SNIPPET_KINDS.map((k) => k.id)) === JSON.stringify(["curl", "fetch", "python", "bru"]), SNIPPET_KINDS.map((k) => k.id));
check("curl snippet from a resolved request round-trips through parseCurl", (() => {
	const text = toCurlSnippet({ method: "POST", url: "https://a.b/x?q=1", headers: [{ name: "Authorization", value: "Bearer T" }], body: '{"a":1}', timeoutMs: 30000 });
	const back = parseCurl(text);
	return back.method === "POST" && back.url === "https://a.b/x?q=1" && back.auth?.mode === "bearer" && back.body === '{"a":1}';
})(), null);
const fetchSnippet = toFetchSnippet({ method: "POST", url: "https://a.b/x", headers: [{ name: "Content-Type", value: "application/json" }], body: '{"a":"q\\"uote"}', timeoutMs: 30000 });
check("fetch snippet is valid JS with escaped literals and a timeout signal", fetchSnippet.includes('await fetch("https://a.b/x"') && fetchSnippet.includes('body: "{\\"a\\":\\"q\\\\\\"uote\\"}"') && fetchSnippet.includes("AbortSignal.timeout(30000)"), fetchSnippet);
check("fetch snippet builds FormData for multipart and skips manual content types", (() => {
	const s = toFetchSnippet({ method: "POST", url: "https://a.b/m", headers: [], multipart: [{ name: "f", value: "v v" }] });
	return s.includes("new FormData()") && s.includes('form.append("f", "v v")') && s.includes("body: form") && !s.includes("headers");
})(), null);
const pySnippet = toPythonSnippet({ method: "POST", url: "https://a.b/x", headers: [{ name: "X-T", value: "v" }], body: "b", timeoutMs: 30000 });
check("python snippet wires headers, data and timeout", pySnippet.includes("import requests") && pySnippet.includes('url = "https://a.b/x"') && pySnippet.includes('requests.request("POST", url, headers=headers, data=data, timeout=30)'), pySnippet);
check("python snippet uses files= tuples for multipart", toPythonSnippet({ method: "POST", url: "https://a.b/m", headers: [], multipart: [{ name: "f", value: "v" }] }).includes('("f", (None, "v"))'), null);
check("snippets never embed unresolved placeholders when vars are resolved", !toFetchSnippet(resolveRequest({ method: "GET", url: "https://{{h}}/x", headers: [], bodyType: "none" }, { h: "real" })).includes("{{"), null);

// --- editor tab list operations (VS Code tab model) ---------------------------------------------------
const { closeOtherTabs, closeTabsToRight, removedPaths, pushClosedTab, popClosedTab, excludePinned, pinTab } = await import("./src/client/tabs.js");
check("closeOtherTabs keeps only the anchor", JSON.stringify(closeOtherTabs(["a", "b", "c"], "b")) === JSON.stringify(["b"]) && closeOtherTabs(["a"], "gone").length === 0 && JSON.stringify(closeOtherTabs(null, "x")) === "[]", null);
check("closeTabsToRight keeps through the anchor and no-ops without it", JSON.stringify(closeTabsToRight(["a", "b", "c"], "b")) === JSON.stringify(["a", "b"]) && closeTabsToRight(["a", "b"], "z").length === 2, null);
check("removedPaths diffs the closing set out of the tab list", JSON.stringify(removedPaths(["a", "b", "c"], ["b"])) === JSON.stringify(["a", "c"]) && removedPaths(null, null).length === 0, null);
let closedStack = pushClosedTab([], { path: "a", line: 3, col: 2 });
closedStack = pushClosedTab(closedStack, { path: "b" });
check("pushClosedTab stacks newest first with view state", closedStack[0].path === "b" && closedStack[1].line === 3, closedStack);
check("pushClosedTab rejects garbage and caps the stack", pushClosedTab(closedStack, null).length === 2 && pushClosedTab(closedStack, { path: "" }).length === 2 && pushClosedTab(Array.from({ length: 12 }, (_, i) => ({ path: `p${i}` })), { path: "new" }, 10).length === 10, null);
const [reopened, restStack] = popClosedTab(closedStack);
check("popClosedTab returns MRU entry and the rest", reopened.path === "b" && restStack.length === 1 && restStack[0].path === "a" && popClosedTab([])[0] === null && popClosedTab(null)[1].length === 0, null);

// --- find-widget replace (VS Code replace row) ---------------------------------------------------------
const { applyReplace } = await import("./src/client/codeview.js");
const repLines = ["foo bar", "bar foo bar", "untouched"];
const repMatches = [
	{ line: 1, col: 1, text: "foo" }, { line: 1, col: 5, text: "bar" },
	{ line: 2, col: 1, text: "bar" }, { line: 2, col: 5, text: "foo" }, { line: 2, col: 9, text: "bar" },
];
const repAll = applyReplace(repLines, repMatches, "X", { all: true });
check("replace-all rewrites every match right-to-left per line", repAll.count === 5 && repAll.lines[0] === "X X" && repAll.lines[1] === "X X X" && repAll.lines[2] === "untouched", repAll);
const repOne = applyReplace(repLines, repMatches, "X", { all: false, index: 3 });
check("replace-one rewrites only the indexed match", repOne.count === 1 && repOne.lines[1] === "bar X bar" && repOne.lines[0] === "foo bar", repOne);
const repRe = applyReplace(["a1 b22"], [{ line: 1, col: 1, text: "a1" }, { line: 1, col: 4, text: "b22" }], "[$1 $&]", { all: true, regexRe: /([a-z])(\d+)/g });
check("regex replace expands $1/$& references per match", repRe.lines[0] === "[a a1] [b b22]", repRe);
check("applyReplace refuses empty inputs and stale matches", applyReplace([], repMatches, "X", { all: true }) === null && applyReplace(repLines, [], "X", { all: true }) === null && applyReplace(["changed"], [{ line: 1, col: 1, text: "foo" }], "X", { all: true }) === null && applyReplace(repLines, repMatches, "X", { all: false, index: 99 }) === null, null);
check("applyReplace leaves the input lines untouched", repLines[0] === "foo bar" && repAll.lines !== repLines, null);

// --- VS Code preserve-case replace (ported from base/common/search.ts) ---------------------------
const { preserveCaseReplace } = await import("./src/client/codeview.js");
check("preserveCase upper-cases for ALL-CAPS matches", preserveCaseReplace("FOO", "bar") === "BAR" && preserveCaseReplace("FOO_BAR", "baz_qux") === "BAZ_QUX", preserveCaseReplace("FOO_BAR", "baz_qux"));
check("preserveCase lower-cases for all-lower matches", preserveCaseReplace("foo", "BAR") === "bar", null);
check("preserveCase capitalizes for capitalized matches (and mirrors)", preserveCaseReplace("Foo", "bar") === "Bar" && preserveCaseReplace("fooBar", "BazQux") === "bazQux", null);
check("preserveCase applies per hyphen/underscore segment", preserveCaseReplace("My-Var", "your-name") === "Your-Name" && preserveCaseReplace("my_var", "Your-Name") === "your-name", preserveCaseReplace("My-Var", "your-name"));
check("preserveCase passes through when the case pattern is mixed", preserveCaseReplace("fOo", "bar") === "bar", null);
const pcAll = applyReplace(["Foo foo FOO"], [{ line: 1, col: 1, text: "Foo" }, { line: 1, col: 5, text: "foo" }, { line: 1, col: 9, text: "FOO" }], "bar", { all: true, preserveCase: true });
check("applyReplace preserves case per match", pcAll.lines[0] === "Bar bar BAR", pcAll);
check("applyReplace ignores preserveCase once $-references exist (VS Code parity)", applyReplace(["Foo"], [{ line: 1, col: 1, text: "Foo" }], "$&-x", { all: true, regexRe: /Foo/g, preserveCase: true }).lines[0] === "Foo-x", null);

// --- Bruno path params (:name segments) --------------------------------------------------------------
const { parsePathParams, substitutePathParams } = await import("./src/client/reqmodel.js");
check("parsePathParams finds :name segments in order", JSON.stringify(parsePathParams("https://a.b/users/:id/posts/:postId?q=1")) === JSON.stringify(["id", "postId"]) && parsePathParams("https://a.b/x").length === 0, null);
check("sync keeps disabled query rows and existing path values through URL edits", JSON.stringify(syncParamsFromUrl("https://a.b/users/:id?q=1", [{ name: "q", value: "old", description: "d" }, { name: "gone", value: "x", enabled: false }, { name: "id", value: "7", kind: "path", description: "user" }]).map((r) => [r.name, r.value, r.enabled, r.kind, r.description])) === JSON.stringify([["q", "1", true, "query", "d"], ["id", "7", true, "path", "user"], ["gone", "x", false, "query", ""]]), syncParamsFromUrl("https://a.b/users/:id?q=1", [{ name: "gone", value: "x", enabled: false }]));
check("sync adds fresh path segments empty and drops vanished ones", syncParamsFromUrl("https://a.b/:new", [])[0].value === "" && syncParamsFromUrl("https://a.b/x", [{ name: "id", value: "7", kind: "path" }]).length === 0, null);
check("params→URL keeps :name literal and rebuilds only the query", applyParamsToUrl("https://a.b/u/:id?old=1#f", [{ name: "q", value: "2" }, { name: "id", value: "9", kind: "path" }]) === "https://a.b/u/:id?q=2#f", applyParamsToUrl("https://a.b/u/:id?old=1#f", [{ name: "q", value: "2" }]));
check("substitutePathParams encodes values and leaves unresolved segments", substitutePathParams("https://a.b/u/:id/x/:miss", [{ name: "id", value: "a b", kind: "path" }, { name: "miss", value: "", kind: "path" }, { name: "off", value: "z", kind: "path", enabled: false }]) === "https://a.b/u/a%20b/x/:miss", substitutePathParams("https://a.b/u/:id/x/:miss", [{ name: "id", value: "a b", kind: "path" }]));
check("resolveRequest substitutes path params on the wire URL only", resolveRequest({ method: "GET", url: "https://a.b/u/:id", paramPairs: [{ name: "id", value: "42", kind: "path" }], headers: [], bodyType: "none" }, {}).url === "https://a.b/u/42", null);

// --- VS Code sticky tabs: pins survive bulk closes ------------------------------------------------------
check("excludePinned removes pinned paths from bulk close sets", JSON.stringify(excludePinned(["a", "b", "c"], ["b"])) === JSON.stringify(["a", "c"]) && excludePinned(["a"], []).length === 1 && excludePinned(null, null).length === 0, null);
check("pinTab moves the pinned tab to the front of the strip", JSON.stringify(pinTab(["a", "b", "c"], "c")) === JSON.stringify(["c", "a", "b"]) && pinTab(["a"], "z").length === 1, null);

// --- Bruno .bru collection interop (plain-text, Git-friendly) -------------------------------------------
const { requestToBru, parseBru, looksLikeBru, bruNameFor } = await import("./src/client/brucol.js");
const bruState = {
	method: "POST", url: "https://{{host}}/u/:id?q=1",
	headers: [{ name: "X-A", value: "1" }, { name: "X-Off", value: "2", enabled: false }],
	bodyType: "raw", rawSub: "json", body: '{\n  "a": 1\n}',
	formPairs: [], paramPairs: [{ name: "q", value: "1", kind: "query" }, { name: "id", value: "", kind: "path" }, { name: "dbg", value: "1", enabled: false, kind: "query" }],
	auth: { mode: "bearer", token: "tk" },
};
const bruText = requestToBru(bruState);
check("bru export writes meta, method block, params, headers, auth and body", bruText.includes("meta {") && bruText.includes("  type: http") && bruText.includes("post {") && bruText.includes("  url: https://{{host}}/u/:id?q=1") && bruText.includes("  body: json") && bruText.includes("params:query {") && bruText.includes("  ~dbg: 1") && bruText.includes("params:path {") && bruText.includes("  id: ") && bruText.includes("  ~X-Off: 2") && bruText.includes("auth:bearer {") && bruText.includes("  token: tk") && bruText.includes("body:json {"), bruText);
check("bru export keeps {{var}} templates verbatim", bruText.includes("{{host}}"), null);
check("looksLikeBru separates bru documents from curl commands", looksLikeBru(bruText) === true && looksLikeBru("curl https://a.b/x") === false && looksLikeBru("meta {\n  name: x\n}") === true, null);
const bruBack = parseBru(bruText);
check("bru import restores method, url and auth", bruBack.method === "POST" && bruBack.url === "https://{{host}}/u/:id?q=1" && bruBack.auth.mode === "bearer" && bruBack.auth.token === "tk", bruBack);
check("bru import restores params with kinds and disabled flags", JSON.stringify(bruBack.paramPairs.map((p) => [p.name, p.enabled, p.kind])) === JSON.stringify([["q", true, "query"], ["dbg", false, "query"], ["id", true, "path"]]), bruBack.paramPairs);
check("bru import restores headers with disabled flags", JSON.stringify(bruBack.headers.map((hd) => [hd.name, hd.value, hd.enabled])) === JSON.stringify([["X-A", "1", true], ["X-Off", "2", false]]), bruBack.headers);
check("bru import restores multi-line raw bodies exactly", bruBack.bodyType === "raw" && bruBack.rawSub === "json" && bruBack.body === '{\n  "a": 1\n}', bruBack.body);
const bruFormBack = parseBru(requestToBru({ method: "PUT", url: "https://a.b/f", headers: [], bodyType: "form", formPairs: [{ name: "a", value: "b c" }, { name: "off", value: "x", enabled: false }], paramPairs: [], auth: { mode: "none" } }));
check("bru form-urlencoded bodies round-trip with disabled rows", bruFormBack.bodyType === "form" && bruFormBack.formPairs[0].value === "b c" && bruFormBack.formPairs[1].enabled === false, bruFormBack);
const bruMpBack = parseBru(requestToBru({ method: "POST", url: "https://a.b/m", headers: [], bodyType: "multipart", formPairs: [{ name: "f", value: "@pic.png" }], paramPairs: [], auth: { mode: "basic", user: "u", pass: "p" } }));
check("bru multipart and basic auth round-trip", bruMpBack.bodyType === "multipart" && bruMpBack.formPairs[0].value === "@pic.png" && bruMpBack.auth.mode === "basic" && bruMpBack.auth.user === "u" && bruMpBack.auth.pass === "p", bruMpBack);
check("bru quotes keys with spaces/colons and re-parses them", parseBru(requestToBru({ method: "GET", url: "https://a.b/x", headers: [{ name: "weird key: x", value: "v" }], bodyType: "none", paramPairs: [], auth: { mode: "none" } })).headers[0].name === "weird key: x", null);
check("bru parser skips unknown blocks from newer Bruno versions", parseBru("meta {\n  name: x\n}\n\nget {\n  url: https://a.b/y\n}\n\nauth:awsv4 {\n  accessKeyId: A\n}\n").url === "https://a.b/y", null);
check("bru names derive from the URL path", bruNameFor("https://a.b/v1/projects?x=1", "GET") === "projects" && bruNameFor("https://a.b/", "POST") === "post", bruNameFor("https://a.b/v1/projects?x=1", "GET"));

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
check("parseCurl -d k=v imports as a form pair (Bruno body view)", c6.multipart === undefined && c6.form?.[0]?.name === "a" && c6.form[0].value === "1" && c6.body === "" && c6.method === "POST", c6);

// --- API history store helpers -----------------------------------------------------------------
const { pushEntry, relTimeAgo } = await import("./src/client/reqmodel.js");
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
check("environment tab offers a create action while no environment exists", Boolean(tableNode((n) => n.props.className === "cea-empty")) && Boolean(tableNode((n) => n.props.title === "api.envNewTitle")) && !tableNode((n) => n.type === RequestFields), null);
tableNode((n) => n.props.title === "api.envNewTitle").props.onClick(); tableApi = renderTableApi();
check("creating an environment reveals the variables editor", Boolean(tableNode((n) => n.type === RequestFields && n.props.label === "api.environment")) && Boolean(tableNode((n) => n.props["aria-label"] === "api.envName")), null);
tableNode((n) => n.type === RequestFields).props.onChange([{ name: "who", value: "world" }]); tableApi = renderTableApi();
check("environment variables persist into the store and count on the tab", tableNode((n) => n.props.className === "cea-config-tab cea-config-tab-on").children[1].children[0] === 1, null);
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

// --- Bruno-style API flows: query sync, environments, auth, timeline, codegen, import ------------
const renderBrunoApi = createHookRenderer(ApiView, { t: (k) => k });
let bApi = renderBrunoApi();
const bNode = (predicate) => collect(bApi).find(predicate);
const bChoose = (key) => { bNode((n) => n.props.className?.startsWith("cea-config-tab") && n.children[0] === key).props.onClick(); bApi = renderBrunoApi(); };
const bUrlValue = () => bNode((n) => n.props.className === "ce-input cea-url").props.value;
const bSend = () => bNode((n) => n.props.className === "ce-sk-btn cea-send").props.onClick();
const bWire = [];
const brunoFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => { bWire.push(JSON.parse(options.body)); return { json: async () => ({ ok: true, value: { status: 201, statusText: "Created", headers: [["content-type", "application/json"]], text: '{"ok":true}', ms: 12, size: 11 } }) }; };
const brunoClipboard = [];
const brunoNavigator = globalThis.navigator;
globalThis.navigator = { clipboard: { writeText: async (text) => { brunoClipboard.push(text); } } };
const tick = () => new Promise((resolve) => setImmediate(resolve));
try {
	// Bruno query sync, direction 1: the URL bar feeds the params table.
	bNode((n) => n.props.className === "ce-input cea-url").props.onChange({ target: { value: "https://{{host}}/search?q=term&lang=en" } }); bApi = renderBrunoApi();
	bChoose("api.params");
	check("typing a query into the URL fills the params table", JSON.stringify(bNode((n) => n.type === RequestFields).props.rows.map((r) => [r.name, r.value, r.enabled, r.kind])) === JSON.stringify([["q", "term", true, "query"], ["lang", "en", true, "query"]]), bNode((n) => n.type === RequestFields).props.rows);
	// Direction 2: the table rebuilds the URL; disabled rows leave it.
	bNode((n) => n.type === RequestFields).props.onChange([{ name: "q", value: "term", enabled: true }, { name: "lang", value: "en", enabled: false }]); bApi = renderBrunoApi();
	check("disabling a param removes it from the URL bar but keeps the row", bUrlValue() === "https://{{host}}/search?q=term" && bNode((n) => n.type === RequestFields).props.rows.length === 2, bUrlValue());

	// Environments: two named sets; the tool-row selector picks which one sends.
	bChoose("api.environment");
	bNode((n) => n.props.title === "api.envNewTitle").props.onClick(); bApi = renderBrunoApi();
	bNode((n) => n.type === RequestFields).props.onChange([{ name: "host", value: "dev.test" }]); bApi = renderBrunoApi();
	bNode((n) => n.props.title === "api.envNewTitle").props.onClick(); bApi = renderBrunoApi();
	bNode((n) => n.type === RequestFields).props.onChange([{ name: "host", value: "prod.test" }]); bApi = renderBrunoApi();
	const envSelect = bNode((n) => n.props["aria-label"] === "api.envSelect");
	const envOptions = (envSelect.children ?? []).flat(Infinity).filter((c) => c && c.props?.value !== undefined);
	const devOption = envOptions.find((o) => o.children[0] === "Environment 1");
	envSelect.props.onChange({ target: { value: devOption.props.value } }); bApi = renderBrunoApi();
	check("the environment selector lists every environment plus No Environment", bNode((n) => n.props["aria-label"] === "api.envSelect").props.value === devOption.props.value && envOptions.some((o) => o.children[0] === "api.envNone"), envOptions.map((o) => o.children[0]));
	// Renaming through the vars toolbar commits on Enter.
	bChoose("api.environment");
	bNode((n) => n.props["aria-label"] === "api.envName").props.onChange({ target: { value: "Dev" } }); bApi = renderBrunoApi();
	bNode((n) => n.props["aria-label"] === "api.envName").props.onKeyDown({ key: "Enter", stopPropagation() {}, currentTarget: { blur() {} } }); bApi = renderBrunoApi();
	check("renaming an environment updates the selector label", (bNode((n) => n.props["aria-label"] === "api.envSelect").children ?? []).flat(Infinity).some((c) => c?.children?.[0] === "Dev"), null);
	bSend(); await tick(); bApi = renderBrunoApi();
	check("sending resolves {{host}} from the active environment only", bWire.at(-1).url === "https://dev.test/search?q=term", bWire.at(-1).url);

	// Timeline: the exact wire request is inspectable after sending.
	bNode((n) => n.props.className?.startsWith?.("cea-tab") && n.children[0] === "api.timeline").props.onClick(); bApi = renderBrunoApi();
	check("the timeline tab shows the resolved request, not the template", Boolean(bNode((n) => n.props.className === "cea-timeline")) && bNode((n) => n.props.className === "cea-tl-req").children[1].children[0] === "https://dev.test/search?q=term", bNode((n) => n.props.className === "cea-tl-req")?.children?.[1]?.children?.[0]);
	bNode((n) => n.props.className?.startsWith?.("cea-tab") && n.children[0] === "api.respBody").props.onClick(); bApi = renderBrunoApi();
	check("response tabs switch back to the pretty body", Boolean(bNode((n) => n.props.className === "cea-resp")), null);

	// Auth section: bearer overrides a manual Authorization header on the wire.
	bChoose("api.headers");
	bNode((n) => n.type === RequestFields).props.onChange([{ name: "Authorization", value: "manual" }]); bApi = renderBrunoApi();
	bChoose("api.auth");
	bNode((n) => n.type === "select" && n.props["aria-label"] === "api.auth").props.onChange({ target: { value: "bearer" } }); bApi = renderBrunoApi();
	bNode((n) => n.props["aria-label"] === "api.authToken").props.onChange({ target: { value: "tk-9" } }); bApi = renderBrunoApi();
	check("a configured auth section counts on its tab", bNode((n) => n.props.className?.startsWith("cea-config-tab") && n.children[0] === "api.auth").children[1].children[0] === 1, null);
	bSend(); await tick();
	check("bearer auth replaces the manual Authorization header exactly once", bWire.at(-1).headers.filter((hd) => hd.name.toLowerCase() === "authorization").length === 1 && bWire.at(-1).headers.at(-1).value === "Bearer tk-9", bWire.at(-1).headers);
	bNode((n) => n.type === "select" && n.props["aria-label"] === "api.auth").props.onChange({ target: { value: "basic" } }); bApi = renderBrunoApi();
	bNode((n) => n.props["aria-label"] === "api.authUser").props.onChange({ target: { value: "u1" } }); bApi = renderBrunoApi();
	bNode((n) => n.props["aria-label"] === "api.authPass").props.onChange({ target: { value: "p1" } }); bApi = renderBrunoApi();
	bSend(); await tick();
	check("basic auth sends the base64 credential", bWire.at(-1).headers.at(-1).value === `Basic ${btoa(unescape(encodeURIComponent("u1:p1")))}`, bWire.at(-1).headers);

	// Codegen popup: snippets come from the resolved request.
	bNode((n) => n.props["data-ce-popup-trigger"] === "api-code").props.onClick(); bApi = renderBrunoApi();
	const codeItems = collect(bApi).filter((n) => n.props.className === "cea-hmain cea-code-item");
	check("the code menu offers curl, fetch, python and bru generators", codeItems.length === 4 && JSON.stringify(codeItems.map((n) => n.children[0].children[0])) === JSON.stringify(["curl", "JavaScript · fetch", "Python · requests", "Bruno · .bru"]), codeItems.map((n) => n.children[0].children[0]));
	codeItems[1].props.onClick(); await tick(); bApi = renderBrunoApi();
	check("copying a fetch snippet resolves environment variables first", brunoClipboard.at(-1)?.includes('await fetch("https://dev.test/search?q=term"') === true && brunoClipboard.at(-1)?.includes(`"Authorization": "Basic ${btoa(unescape(encodeURIComponent("u1:p1")))}"`) === true, brunoClipboard.at(-1));

	// curl import: -u folds into Auth, k=v data into the form body, query into params.
	bNode((n) => n.props["data-ce-popup-trigger"] === "api-import").props.onClick(); bApi = renderBrunoApi();
	bNode((n) => n.props.className === "cea-body cea-import").props.onChange({ target: { value: "curl -X POST 'https://example.test/login?next=%2Fhome' -u 'admin:s3cr3t' -d 'user=admin' -d 'pass=x%20y'" } }); bApi = renderBrunoApi();
	bNode((n) => n.type === "button" && n.children[0] === "api.importBtn").props.onClick(); bApi = renderBrunoApi();
	check("import maps -u onto the auth section", bNode((n) => n.props.className?.startsWith("cea-config-tab") && n.children[0] === "api.auth").children[1].children[0] === 1, null);
	check("import maps k=v data onto a form body", bNode((n) => n.type === "select" && n.props.value === "form") !== undefined, null);
	bChoose("api.params");
	check("import fills the params table from the URL query", JSON.stringify(bNode((n) => n.type === RequestFields).props.rows.map((r) => [r.name, r.value, r.kind])) === JSON.stringify([["next", "/home", "query"]]), bNode((n) => n.type === RequestFields).props.rows);
	bChoose("api.body");
	check("imported form values stay URL-decoded for editing", JSON.stringify(bNode((n) => n.type === RequestFields && n.props.label === "api.body").props.rows.map((r) => [r.name, r.value])) === JSON.stringify([["user", "admin"], ["pass", "x y"]]), null);

	// Bruno .bru collection documents import through the same dialog.
	bNode((n) => n.props["data-ce-popup-trigger"] === "api-import").props.onClick(); bApi = renderBrunoApi();
	bNode((n) => n.props.className === "cea-body cea-import").props.onChange({ target: { value: "meta {\n  name: demo\n  type: http\n}\n\npost {\n  url: https://example.test/u/:id\n  body: json\n  auth: bearer\n}\n\nparams:path {\n  id: 7\n}\n\nauth:bearer {\n  token: tk\n}\n\nbody:json {\n{\"a\":1}\n}\n" } }); bApi = renderBrunoApi();
	bNode((n) => n.type === "button" && n.children[0] === "api.importBtn").props.onClick(); bApi = renderBrunoApi();
	check("bru import restores url, method and the auth section", bUrlValue() === "https://example.test/u/:id" && bNode((n) => n.props.className?.startsWith("cea-config-tab") && n.children[0] === "api.auth").children[1].children[0] === 1, bUrlValue());
	bChoose("api.params");
	check("bru import surfaces path params in their own table", JSON.stringify(collect(bApi).filter((n) => n.type === RequestFields).map((n) => [n.props.label, n.props.rows.map((r) => [r.name, r.value, r.kind])])) === JSON.stringify([["api.params", []], ["api.pathParams", [["id", "7", "path"]]]]), collect(bApi).filter((n) => n.type === RequestFields).map((n) => n.props.label));
	bChoose("api.body");
	check("bru import restores the raw json body", bNode((n) => n.type === "textarea" && n.props.className === "cea-body")?.props.value === '{"a":1}', null);
	bNode((n) => n.props["data-ce-popup-trigger"] === "api-code").props.onClick(); bApi = renderBrunoApi();
	collect(bApi).filter((n) => n.props.className === "cea-hmain cea-code-item")[3].props.onClick(); await tick(); bApi = renderBrunoApi();
	check("the .bru snippet keeps templates and path params for the collection file", brunoClipboard.at(-1)?.includes("meta {") === true && brunoClipboard.at(-1)?.includes("params:path {") === true && brunoClipboard.at(-1)?.includes("url: https://example.test/u/:id") === true, brunoClipboard.at(-1));
} finally {
	globalThis.fetch = brunoFetch;
	if (brunoNavigator === undefined) delete globalThis.navigator; else globalThis.navigator = brunoNavigator;
}

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

// --- VS Code workbench flows: tab context menu, reopen closed editor, replace, problems ---------
const wbGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, window: globalThis.window, document: globalThis.document };
const wbRequests = [];
globalThis.fetch = async (url, options) => {
	wbRequests.push({ url, body: JSON.parse(options?.body ?? "{}") });
	if (url.endsWith("/fs.read")) return { json: async () => ({ ok: true, value: { kind: "text", content: "alpha beta\nbeta gamma\n", mtimeMs: 1 } }) };
	if (url.endsWith("/lsp.diagnostics")) return { json: async () => ({ ok: true, value: { items: [{ line: 2, col: 1, endLine: 2, endCol: 5, severity: 1, message: "undefined: beta", source: "gopls" }] } }) };
	if (url.endsWith("/lsp.request")) return { json: async () => ({ ok: true, value: { symbols: [], targets: [] } }) };
	if (url.endsWith("/lsp.status")) return { json: async () => ({ ok: true, value: { state: "ready", label: "gopls" } }) };
	return { json: async () => ({ ok: true, value: {} }) };
};
globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
globalThis.cancelAnimationFrame = () => {};
globalThis.setTimeout = () => 0;
globalThis.window = { innerWidth: 1200, innerHeight: 900 };
globalThis.document = { addEventListener() {}, removeEventListener() {} };
try {
	const renderWb = createHookRenderer(CodeBody, { sessionId: "wb", useSessions: (select) => select({ byId: { wb: { cwd: "/w" } } }), t: (k) => k }, { effects: true });
	const paintWb = () => { wbTree = renderWb(); renderWb.flushEffects(); wbTree = renderWb(); };
	let wbTree = renderWb();
	renderWb.flushEffects();
	const tickWb = async () => { await new Promise((resolve) => setImmediate(resolve)); paintWb(); };
	const getWb = (test) => collect(wbTree).find(test);
	const tabNodes = () => collect(wbTree).filter((n) => typeof n.props.className === "string" && n.props.className.split(" ").includes("ce-tab"));
	const menuItems = () => collect(wbTree).filter((n) => n.props.role === "menuitem");
	getWb((n) => n.type === TreePanelCmp).props.onOpenFile("main.go", 1, 1);
	await tickWb();
	getWb((n) => n.type === TreePanelCmp).props.onOpenFile("util.go", 1, 1);
	await tickWb();
	check("opening two files fills the editor tab strip", tabNodes().length === 2 && tabNodes()[1].props.className.includes("ce-tab-active"), tabNodes().map((n) => n.props.title));
	tabNodes()[0].props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 300, clientY: 200 });
	paintWb();
	check("tab context menu offers pin plus the VS Code close family", Boolean(getWb((n) => typeof n.props.className === "string" && n.props.className.includes("ce-tabmenu"))) && menuItems().map((n) => n.children[0]).join(",") === "tabs.pin,tabs.close,tabs.closeOthers,tabs.closeRight,tabs.closeAll", menuItems().map((n) => n.children[0]));
	check("close-to-the-right stays enabled with a tab on the right", menuItems()[3].props.disabled === false, null);
	menuItems()[3].props.onClick();
	await tickWb();
	check("close-to-the-right closes later tabs and activates the neighbour", tabNodes().length === 1 && tabNodes()[0].props.title === "main.go" && getWb((n) => n.props.className === "ce-head-path")?.children[0] === "main.go", tabNodes().map((n) => n.props.title));
	wbTree.props.onKeyDown({ code: "KeyT", metaKey: true, shiftKey: true, preventDefault() {} });
	await tickWb();
	check("⌘⇧T reopens the most recently closed editor", tabNodes().length === 2 && getWb((n) => n.props.className === "ce-head-path")?.children[0] === "util.go", tabNodes().map((n) => n.props.title));
	tabNodes()[1].props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 300, clientY: 200 });
	paintWb();
	check("close-to-the-right disables on the last tab", menuItems()[3].props.disabled === true, null);
	menuItems()[2].props.onClick();
	await tickWb();
	check("close-others keeps only the anchored tab", tabNodes().length === 1 && tabNodes()[0].props.title === "util.go", tabNodes().map((n) => n.props.title));
	wbTree.props.onKeyDown({ code: "KeyT", metaKey: true, shiftKey: true, preventDefault() {} });
	await tickWb();
	check("the reopen stack is most-recently-closed-first", tabNodes().length === 2 && getWb((n) => n.props.className === "ce-head-path")?.children[0] === "main.go", tabNodes().map((n) => n.props.title));
	wbTree.props.onKeyDown({ code: "KeyF", metaKey: true, preventDefault() {} });
	paintWb();
	getWb((n) => n.props.className === "ce-input ce-find-input").props.onChange({ target: { value: "beta" } });
	paintWb();
	check("the find widget counts matches across the document", getWb((n) => n.props.className === "ce-find-count")?.children[0] === "1/2", getWb((n) => n.props.className === "ce-find-count")?.children[0]);
	check("the active find match keeps a solid current-match highlight", collect(wbTree).some((n) => typeof n.props.className === "string" && n.props.className.includes("ce-mark-cur")), null);
	getWb((n) => typeof n.props.title === "string" && n.props.title.startsWith("editor.replaceToggle")).props.onClick();
	paintWb();
	check("the replace row exposes replace and replace-all actions", Boolean(getWb((n) => n.props["aria-label"] === "editor.replace")) && collect(wbTree).some((n) => n.children?.[0] === "editor.replaceAll"), null);
	getWb((n) => n.props["aria-label"] === "editor.replace").props.onChange({ target: { value: "GAMMA" } });
	paintWb();
	getWb((n) => n.type === "button" && n.children?.[0] === "editor.replaceAll").props.onClick();
	paintWb();
	check("replace-all lands in the edit buffer for review instead of writing to disk", getWb((n) => typeof n.props.className === "string" && n.props.className.startsWith("ce-edit-ta"))?.props.value === "alpha GAMMA\nGAMMA gamma\n" && !wbRequests.some((r) => r.url.endsWith("/fs.write")), getWb((n) => typeof n.props.className === "string" && n.props.className.startsWith("ce-edit-ta"))?.props.value);
	getWb((n) => n.children?.[0] === "editor.cancel").props.onClick();
	paintWb();
	// VS Code preserve-case: each match's case pattern maps onto the replacement.
	getWb((n) => n.props.className === "ce-input ce-find-input").props.onChange({ target: { value: "BETA" } });
	paintWb();
	getWb((n) => typeof n.props.title === "string" && n.props.title.startsWith("find.preserveCase")).props.onClick();
	paintWb();
	getWb((n) => n.props["aria-label"] === "editor.replace").props.onChange({ target: { value: "GAMMA" } });
	paintWb();
	getWb((n) => n.type === "button" && n.children?.[0] === "editor.replaceAll").props.onClick();
	paintWb();
	check("preserve-case maps each match's case pattern onto the replacement", getWb((n) => typeof n.props.className === "string" && n.props.className.startsWith("ce-edit-ta"))?.props.value === "alpha gamma\ngamma gamma\n", getWb((n) => typeof n.props.className === "string" && n.props.className.startsWith("ce-edit-ta"))?.props.value);
	getWb((n) => n.children?.[0] === "editor.cancel").props.onClick();
	paintWb();
	const diagChip = getWb((n) => typeof n.props.className === "string" && n.props.className.includes("ce-diag-btn"));
	check("the diagnostics chip became a problems toggle", Boolean(diagChip) && diagChip.children[0] === "1 diag.count", diagChip?.children?.[0]);
	wbTree.props.onKeyDown({ code: "KeyM", metaKey: true, shiftKey: true, preventDefault() {} });
	paintWb();
	const problemsNode = getWb((n) => n.type.name === "ProblemsPanel");
	check("⇧⌘M opens the problems panel carrying the file diagnostics", Boolean(problemsNode) && problemsNode.props.diagnostics.length === 1, null);
	const { ProblemsPanel } = await import("./src/client/overlays.js");
	let pickedProblem = null;
	const problemRow = collect(ProblemsPanel({ t: (k) => k, diagnostics: problemsNode.props.diagnostics, onPick: (item) => { pickedProblem = item; }, onClose: () => {} })).find((n) => n.props.className === "ce-loc");
	check("problem rows show severity, position and source message", problemRow.children[0].props.className.includes("ce-problem-err") && problemRow.children[1].children[0] === "2:1" && problemRow.children[2].children[0] === "gopls: undefined: beta", problemRow.children.map((c) => collect(c)));
	problemRow.props.onClick();
	check("clicking a problem row picks its position", pickedProblem?.line === 2 && pickedProblem?.col === 1, pickedProblem);
	problemsNode.props.onPick({ line: 2, col: 1 });
	paintWb();
	check("the panel closes and the cursor jumps to the problem line", !getWb((n) => n.type.name === "ProblemsPanel") && String(getWb((n) => n.props.className === "ce-pos ce-pos-btn")?.children?.[0]).startsWith("Ln 2"), getWb((n) => n.props.className === "ce-pos ce-pos-btn")?.children?.[0]);
	diagChip.props.onClick();
	paintWb();
	check("the diagnostics chip toggles the panel too", Boolean(getWb((n) => n.type.name === "ProblemsPanel")), null);
	wbTree.props.onKeyDown({ key: "Escape", preventDefault() {}, stopPropagation() {} });
	paintWb();
	check("Escape closes the problems panel without touching the document", !getWb((n) => n.type.name === "ProblemsPanel") && getWb((n) => n.props.className === "ce-head-path")?.children[0] === "main.go", null);
	const drawProblems = createHookRenderer(ProblemsPanel, { t: (k) => k, diagnostics: [{ line: 1, col: 1, severity: 1, message: "e" }, { line: 2, col: 1, severity: 2, message: "w" }, { line: 3, col: 1, severity: 3, message: "i" }], onPick: () => {}, onClose: () => {} });
	let pTree = drawProblems();
	const pFilters = () => collect(pTree).filter((n) => typeof n.props.className === "string" && n.props.className.includes("ce-problem-filter"));
	check("problems header shows per-severity counts (VS Code markers view)", pFilters().map((n) => n.children[0]).join(",") === "✕ 1,⚠ 1,ℹ 1", pFilters().map((n) => n.children[0]));
	pFilters()[0].props.onClick();
	pTree = drawProblems();
	check("severity filters hide their bucket and report shown/total", collect(pTree).filter((n) => n.props.className === "ce-loc").length === 2 && collect(pTree).some((n) => Array.isArray(n.children) && n.children[0] === "problems.title · 2/3"), null);
	tabNodes()[1].props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 300, clientY: 200 });
	paintWb();
	check("the menu offers pin for unpinned tabs", menuItems()[0].children[0] === "tabs.pin", menuItems()[0].children[0]);
	menuItems()[0].props.onClick();
	paintWb();
	check("pinning moves the tab to the front and marks it", tabNodes()[0].props.title === "main.go" && collect(tabNodes()[0]).some((n) => typeof n.props.className === "string" && n.props.className.includes("ce-tab-pin")), tabNodes().map((n) => n.props.title));
	tabNodes()[0].props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 300, clientY: 200 });
	paintWb();
	check("the menu offers unpin for pinned tabs", menuItems()[0].children[0] === "tabs.unpin", null);
	menuItems()[4].props.onClick();
	await tickWb();
	check("close-all skips pinned tabs like VS Code excludeSticky", tabNodes().length === 1 && tabNodes()[0].props.title === "main.go" && getWb((n) => n.props.className === "ce-head-path")?.children[0] === "main.go", tabNodes().map((n) => n.props.title));
	tabNodes()[0].props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 300, clientY: 200 });
	paintWb();
	menuItems()[0].props.onClick();
	paintWb();
	tabNodes()[0].props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 300, clientY: 200 });
	paintWb();
	menuItems()[4].props.onClick();
	paintWb();
	check("after unpinning, close-all empties the strip", tabNodes().length === 0 && !getWb((n) => n.props.className === "ce-head-path"), tabNodes().map((n) => n.props.title));
	wbTree.props.onKeyDown({ code: "KeyP", metaKey: true, shiftKey: true, preventDefault() {} });
	paintWb();
	const commandLabels = (getWb((n) => n.type.name === "CommandPalette")?.props.commands ?? []).map((c) => c.label);
	check("the command center exposes the new VS Code actions", ["command.replace", "command.problems", "command.reopenTab", "command.closeAllTabs"].every((label) => commandLabels.includes(label)), commandLabels);
	renderWb.unmount();
} finally {
	for (const [key, value] of Object.entries(wbGlobals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
}

// --- copy-path feedback is visible at the click site ----------------------------------------------
const cpWrites = [];
const cpNavigator = globalThis.navigator;
globalThis.navigator = { clipboard: { writeText: async (text) => { cpWrites.push(text); } } };
try {
	const drawCopyBtn = createHookRenderer(CopyChangePathButton, { path: "a/b.txt", t: (k) => k, onCopyPath: async (path, relative) => { cpWrites.push(`${path}:${relative}`); return true; } });
	let copyBtnTree = drawCopyBtn();
	const copyBtn = () => collect(copyBtnTree).find((n) => n.type === "button");
	check("copy-path button starts with the copy glyph", copyBtn().props.className === "cet-act cet-copy-path", copyBtn().props.className);
	copyBtn().props.onClick({ stopPropagation() {}, altKey: true });
	await new Promise((resolve) => setImmediate(resolve));
	copyBtnTree = drawCopyBtn();
	check("successful copy flips the button to a check with done color", copyBtn().props.className.includes("cet-act-done") && copyBtn().props.title === "tree.copied" && cpWrites.at(-1) === "a/b.txt:true", copyBtn().props.className);
	const drawFailBtn = createHookRenderer(CopyChangePathButton, { path: "a/b.txt", t: (k) => k, onCopyPath: async () => false });
	let failBtnTree = drawFailBtn();
	collect(failBtnTree).find((n) => n.type === "button").props.onClick({ stopPropagation() {}, altKey: false });
	await new Promise((resolve) => setImmediate(resolve));
	failBtnTree = drawFailBtn();
	check("failed copy keeps the copy glyph instead of faking success", !collect(failBtnTree).find((n) => n.type === "button").props.className.includes("cet-act-done"), null);
} finally {
	if (cpNavigator === undefined) delete globalThis.navigator; else globalThis.navigator = cpNavigator;
}
const treeCopyFetch = globalThis.fetch;
const treeCopyWrites = [];
const treeCopyNavigator = globalThis.navigator;
globalThis.fetch = async (url, options) => {
	if (url.endsWith("/fs.list")) return { json: async () => ({ ok: true, value: { entries: [{ name: "copy.txt", type: "file" }], truncated: false } }) };
	return { json: async () => ({ ok: true, value: {} }) };
};
globalThis.navigator = { clipboard: { writeText: async (text) => { treeCopyWrites.push(text); } } };
try {
	const treeNotices = [];
	const drawCopyTree = createHookRenderer(TreePanelCmp, { cwd: "/w", sessionId: "copy", t: (k) => k, onNotify: (text) => treeNotices.push(text) }, { effects: true });
	let copyTree = drawCopyTree();
	drawCopyTree.flushEffects();
	await new Promise((resolve) => setImmediate(resolve));
	copyTree = drawCopyTree();
	const copyAct = () => collect(copyTree).find((n) => n.props.hint === "tree.copyPath" || n.props.hint === "tree.copied");
	check("explorer rows expose the copy action", Boolean(copyAct()), null);
	copyAct().props.onClick({ stopPropagation() {} });
	await new Promise((resolve) => setImmediate(resolve));
	copyTree = drawCopyTree();
	const doneAct = collect(copyTree).find((n) => n.props.hint === "tree.copied");
	check("explorer copy flips the row glyph to a check and notifies", Boolean(doneAct) && doneAct.children[0] === "✓" && doneAct.props.className.includes("cet-act-done") && treeNotices.at(-1) === "tree.copied" && treeCopyWrites.at(-1) === "/w/copy.txt", { children: doneAct?.children, notices: treeNotices });
	drawCopyTree.unmount();
} finally {
	globalThis.fetch = treeCopyFetch;
	if (treeCopyNavigator === undefined) delete globalThis.navigator; else globalThis.navigator = treeCopyNavigator;
}

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
 // autoFocus put the caret in the dialog's name input; Escape restores the opener.
 layerDoc.activeElement = favoriteInside;
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

// --- live refresh: watch helpers, poll-loop state machine, and CodeBody folding ---------
const { parentDirs, docAction, createWatchLoop } = await import("./src/client/watch.js");
check("parentDirs folds changed paths to their direct parent listings", parentDirs(["a/b.go", "c.go", "d/e/f.txt"]).join() === "a,,d/e", parentDirs(["a/b.go", "c.go", "d/e/f.txt"]));
check("docAction reloads clean drafts, flags dirty ones, ignores others", docAction(["a.go"], "a.go", false) === "reload" && docAction(["a.go"], "a.go", true) === "conflict" && docAction(["a.go"], "b.go", false) === "ignore" && docAction(["a.go"], "", false) === "ignore", null);
{
	const seen = [];
	const delays = [];
	let pendingTimer = null;
	const script = [
		{ ok: true, value: { seq: 7, baseline: true } },
		{ ok: true, value: { seq: 8, paths: ["x.go"], git: true } },
		{ ok: false, error: "host down" },
		{ ok: true, value: { seq: 8, supported: false } },
	];
	let step = 0;
	const loop = createWatchLoop({
		poll: async (body) => { seen.push(body.since); return script[step++] ?? { ok: true, value: { seq: 9 } }; },
		onChanges: (v) => seen.push(`changes:${v.paths.join()}:${v.git}`),
		onUnsupported: () => seen.push("unsupported"),
		schedule: (fn, ms) => { delays.push(ms); const t = { fn }; pendingTimer = t; return t; },
		unschedule: (t) => { if (pendingTimer === t) pendingTimer = null; },
	});
	const drain = async () => { for (let i = 0; i < 12; i++) { await new Promise((r) => setImmediate(r)); if (!pendingTimer) continue; const t = pendingTimer; pendingTimer = null; t.fn(); } };
	await drain();
	check("watch loop starts from the baseline cursor and streams from it", seen[0] === -1 && seen[1] === 7 && seen.includes("changes:x.go:true"), seen);
	check("watch loop backs off on transport errors", delays.includes(1000), delays);
	check("watch loop retries slow when the platform cannot watch", seen.includes("unsupported") && delays.includes(30_000), [seen, delays]);
	const beforeStop = seen.length;
	loop.stop();
	await drain();
	check("watch loop stop silences the cycle", seen.length === beforeStop, [seen.length, beforeStop]);
}
{
	const liveGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, window: globalThis.window, document: globalThis.document };
	let liveContent = "alpha beta\nbeta gamma\n";
	let liveMtime = 1;
	const liveRequests = [];
	let liveSeq = 100;
	let baselineDone = false;
	let expectBatchA = false, gotBatchA = false;
	let expectBatchB = false, gotBatchB = false;
	let expectBatchC = false, gotBatchC = false;
	let liveTimers = [];
	globalThis.fetch = async (url, options) => {
		const body = JSON.parse(options?.body ?? "{}");
		liveRequests.push({ url: String(url), body });
		if (url.endsWith("/watch.poll")) {
			liveSeq++;
			if (!baselineDone) { baselineDone = true; return { json: async () => ({ ok: true, value: { seq: liveSeq, baseline: true, supported: true } }) }; }
			if (expectBatchA && !gotBatchA) { gotBatchA = true; return { json: async () => ({ ok: true, value: { seq: liveSeq, paths: ["main.go"], git: true } }) }; }
			if (expectBatchB && !gotBatchB) { gotBatchB = true; return { json: async () => ({ ok: true, value: { seq: liveSeq, paths: ["main.go"], git: false } }) }; }
			if (expectBatchC && !gotBatchC) { gotBatchC = true; return { json: async () => ({ ok: true, value: { seq: liveSeq, paths: ["main.go"], git: false } }) }; }
			return { json: async () => ({ ok: true, value: { seq: liveSeq, paths: [], git: false } }) };
		}
		if (url.endsWith("/fs.read")) return { json: async () => ({ ok: true, value: { kind: "text", content: liveContent, mtimeMs: liveMtime } }) };
		if (url.endsWith("/fs.list")) return { json: async () => ({ ok: true, value: { entries: [{ name: "main.go", type: "file", size: 20 }], truncated: false } }) };
		if (url.endsWith("/git.status")) return { json: async () => ({ ok: true, value: { repo: false } }) };
		if (url.endsWith("/git.diff")) return { json: async () => ({ ok: true, value: {} }) };
		if (url.endsWith("/lsp.diagnostics")) return { json: async () => ({ ok: true, value: { items: [] } }) };
		if (url.endsWith("/lsp.request")) return { json: async () => ({ ok: true, value: { symbols: [], targets: [] } }) };
		if (url.endsWith("/lsp.status")) return { json: async () => ({ ok: true, value: { state: "ready", label: "gopls" } }) };
		return { json: async () => ({ ok: true, value: {} }) };
	};
	globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
	globalThis.cancelAnimationFrame = () => {};
	globalThis.setTimeout = (fn, ms) => { liveTimers.push({ fn, ms, fired: false }); return liveTimers.length; };
	globalThis.clearTimeout = (id) => { if (typeof id === "number" && liveTimers[id - 1]) liveTimers[id - 1].cancelled = true; };
	globalThis.window = { innerWidth: 1200, innerHeight: 900 };
	globalThis.document = { addEventListener() {}, removeEventListener() {} };
	try {
		const renderLive = createHookRenderer(CodeBody, { sessionId: "live", useSessions: (select) => select({ byId: { live: { cwd: "/w" } } }), t: (k) => k }, { effects: true });
		let liveTree = renderLive();
		renderLive.flushEffects();
		const fireLive = () => { const due = liveTimers.filter((t) => !t.fired && !t.cancelled); due.forEach((t) => { t.fired = true; }); liveTimers = liveTimers.filter((t) => !t.fired && !t.cancelled); for (const t of due) t.fn(); };
		const paintLive = () => { liveTree = renderLive(); renderLive.flushEffects(); };
		const tickLive = async () => { for (let i = 0; i < 8; i++) { await new Promise((r) => setImmediate(r)); fireLive(); } paintLive(); };
		const getLive = (test) => collect(liveTree).find(test);
		const readCount = () => liveRequests.filter((r) => r.url.endsWith("/fs.read")).length;
		const statusCount = () => liveRequests.filter((r) => r.url.endsWith("/git.status")).length;
		await tickLive();
		check("live mode asks exactly one baseline cursor when the workspace opens", liveRequests.filter((r) => r.url.endsWith("/watch.poll") && r.body.since === -1).length === 1, liveRequests.filter((r) => r.url.endsWith("/watch.poll")).length);
		getLive((n) => n.type === TreePanelCmp).props.onOpenFile("main.go", 1, 1);
		await tickLive();
		liveContent = "alpha beta\nbeta gamma v2\n"; liveMtime = 2;
		const readsAtOpen = readCount();
		const statusesAtOpen = statusCount();
		expectBatchA = true;
		await tickLive();
		check("clean documents reload in place on watch batches", readCount() === readsAtOpen + 1, [readCount(), readsAtOpen]);
		check("watch batches invalidate the shown tree directories", getLive((n) => n.type === TreePanelCmp).props.staleTick === 1 && getLive((n) => n.type === TreePanelCmp).props.staleDirs.join() === "", getLive((n) => n.type === TreePanelCmp).props.staleTick);
		check("watch batches refresh git status through the debounce timer", statusCount() > statusesAtOpen, [statusCount(), statusesAtOpen]);
		check("a clean reload shows no conflict banner", !collect(liveTree).some((n) => n.type === "button" && n.children?.[0] === "watch.reloadDiscarding"), null);
		// Now make the draft dirty; the next batch must NOT touch the buffer.
		const startEditBtn = getLive((n) => n.type === "button" && n.props.title === "editor.edit");
		startEditBtn.props.onClick(); paintLive();
		const ta = () => getLive((n) => n.type === "textarea" && typeof n.props.className === "string" && n.props.className.startsWith("ce-edit-ta"));
		ta().props.onChange({ target: { value: "alpha beta\nbeta MY-EDIT\n" } }); paintLive();
		liveContent = "alpha beta\ngamma delta\n"; liveMtime = 3;
		const readsBeforeConflict = readCount();
		expectBatchB = true;
		await tickLive();
		check("a dirty draft is never auto-discarded: the banner offers the choice", collect(liveTree).some((n) => n.type === "button" && n.children?.[0] === "watch.reloadDiscarding") && ta()?.props.value === "alpha beta\nbeta MY-EDIT\n", null);
		check("the conflict path marks the banner without any reload read", readCount() === readsBeforeConflict, [readCount(), readsBeforeConflict]);
		collect(liveTree).find((n) => n.type === "button" && n.children?.[0] === "watch.keepEditing").props.onClick(); paintLive();
		check("keep editing dismisses the banner and preserves the draft", !collect(liveTree).some((n) => n.type === "button" && n.children?.[0] === "watch.reloadDiscarding") && ta()?.props.value === "alpha beta\nbeta MY-EDIT\n", null);
		expectBatchC = true;
		await tickLive();
		check("later batches re-raise the banner for a still-dirty draft", collect(liveTree).some((n) => n.type === "button" && n.children?.[0] === "watch.reloadDiscarding"), null);
		collect(liveTree).find((n) => n.type === "button" && n.children?.[0] === "watch.reloadDiscarding").props.onClick();
		paintLive(); await tickLive();
		check("reload-discarding swaps in the disk file and closes the editor draft", !ta() && !collect(liveTree).some((n) => n.type === "button" && n.children?.[0] === "watch.reloadDiscarding"), null);
		check("live refresh never issues host writes on its own", !liveRequests.some((r) => r.url.endsWith("/fs.write")), null);
		renderLive.unmount();
	} finally {
		Object.assign(globalThis, liveGlobals);
	}
}
{
	// Conflict resolution: keep-editing must not be a dead end. The banner now
	// offers compare-with-disk and a two-step overwrite; a refused save re-raises
	// the banner instead of looping on a toast.
	const conflictGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, window: globalThis.window, document: globalThis.document };
	let diskContent = "alpha\nbeta\n";
	let diskMtime = 1;
	let refuseWrites = false;
	const reqs = [];
	let timers = [];
	let seq = 500;
	let baseline = false;
	let raiseConflict = false;
	let raised = false;
	globalThis.fetch = async (url, options) => {
		const body = JSON.parse(options?.body ?? "{}");
		reqs.push({ url: String(url), body });
		if (url.endsWith("/watch.poll")) {
			seq++;
			if (!baseline) { baseline = true; return { json: async () => ({ ok: true, value: { seq, baseline: true, supported: true } }) }; }
			if (raiseConflict && !raised) { raised = true; return { json: async () => ({ ok: true, value: { seq, paths: ["main.go"], git: false } }) }; }
			return { json: async () => ({ ok: true, value: { seq, paths: [], git: false } }) };
		}
		if (url.endsWith("/fs.read")) return { json: async () => ({ ok: true, value: { kind: "text", content: diskContent, mtimeMs: diskMtime } }) };
		if (url.endsWith("/fs.write") || url.endsWith("/fs.formatDraft")) {
			if (refuseWrites) return { json: async () => ({ ok: false, error: "file was modified on disk; reload before saving" }) };
			diskContent = body.content; diskMtime += 1;
			return { json: async () => ({ ok: true, value: { path: body.path, mtimeMs: diskMtime, size: body.content.length } }) };
		}
		if (url.endsWith("/fs.list")) return { json: async () => ({ ok: true, value: { entries: [{ name: "main.go", type: "file", size: 20 }], truncated: false } }) };
		if (url.endsWith("/git.status")) return { json: async () => ({ ok: true, value: { repo: false } }) };
		if (url.endsWith("/lsp.diagnostics")) return { json: async () => ({ ok: true, value: { items: [] } }) };
		if (url.endsWith("/lsp.request")) return { json: async () => ({ ok: true, value: { symbols: [], targets: [] } }) };
		if (url.endsWith("/lsp.status")) return { json: async () => ({ ok: true, value: { state: "ready", label: "gopls" } }) };
		return { json: async () => ({ ok: true, value: {} }) };
	};
	globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
	globalThis.cancelAnimationFrame = () => {};
	globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms, fired: false }); return timers.length; };
	globalThis.clearTimeout = (id) => { if (typeof id === "number" && timers[id - 1]) timers[id - 1].cancelled = true; };
	globalThis.window = { innerWidth: 1200, innerHeight: 900 };
	globalThis.document = { addEventListener() {}, removeEventListener() {} };
	try {
		const render = createHookRenderer(CodeBody, { sessionId: "conflict", useSessions: (select) => select({ byId: { conflict: { cwd: "/w" } } }), t: (k) => k }, { effects: true });
		let tree = render();
		render.flushEffects();
		const fire = () => { const due = timers.filter((t) => !t.fired && !t.cancelled); due.forEach((t) => { t.fired = true; }); timers = timers.filter((t) => !t.fired && !t.cancelled); for (const t of due) t.fn(); };
		const paint = () => { tree = render(); render.flushEffects(); };
		const tick = async () => { for (let i = 0; i < 8; i++) { await new Promise((r) => setImmediate(r)); fire(); } paint(); };
		const get = (test) => collect(tree).find(test);
		const btn = (label) => get((n) => n.type === "button" && n.children?.[0] === label);
		const ta = () => get((n) => n.type === "textarea" && typeof n.props.className === "string" && n.props.className.startsWith("ce-edit-ta"));
		await tick();
		get((n) => n.type === TreePanelCmp).props.onOpenFile("main.go", 1, 1);
		await tick();
		get((n) => n.type === "button" && n.props.title === "editor.edit").props.onClick(); paint();
		ta().props.onChange({ target: { value: "alpha\nMY-DRAFT\n" } }); paint();
		diskContent = "alpha\nDISK-CHANGE\n"; diskMtime = 2;
		raiseConflict = true;
		await tick();
		check("conflict banner offers compare-with-disk", Boolean(btn("watch.compareDisk")), null);
		check("conflict banner offers overwrite with two-step arming", Boolean(btn("watch.overwriteDraft")), null);
		btn("watch.compareDisk").props.onClick();
		await tick();
		check("compare opens the draft-vs-disk diff panel", Boolean(get((n) => n.props.className === "ce-conflict-diff")), null);
		check("compare diff shows both sides", collect(tree).some((n) => n.type === "span" && typeof n.children?.[0] === "string" && n.children[0].includes("MY-DRAFT")) || JSON.stringify(collect(tree).filter((n) => n.props.className === "ce-conflict-meta").map((n) => n.children)) .includes("+1"), null);
		check("compare reads the disk without writing", reqs.some((r) => r.url.endsWith("/fs.read")) && !reqs.some((r) => r.url.endsWith("/fs.write")), null);
		// Close the compare panel, then arm + confirm overwrite.
		get((n) => n.props.className === "ce-conflict-head" && true) && collect(tree).find((n) => n.props.className === "ce-conflict-head").children.find((c) => c?.props?.title === "close").props.onClick(); paint();
		btn("watch.overwriteDraft").props.onClick(); paint();
		check("first overwrite click arms the confirmation", Boolean(btn("watch.overwriteConfirm")) && !reqs.some((r) => r.url.endsWith("/fs.write")), null);
		btn("watch.overwriteConfirm").props.onClick();
		await tick();
		const overwriteWrite = reqs.find((r) => r.url.endsWith("/fs.write") || r.url.endsWith("/fs.formatDraft"));
		check("confirmed overwrite writes the draft without baseMtime", Boolean(overwriteWrite) && overwriteWrite.body.baseMtime === undefined && overwriteWrite.body.content === "alpha\nMY-DRAFT\n", overwriteWrite?.body);
		check("overwrite success clears banner and draft state", !btn("watch.compareDisk") && !ta(), null);
		// A refused guarded save re-raises the banner (no dead-end toast loop).
		get((n) => n.type === "button" && n.props.title === "editor.edit").props.onClick(); paint();
		ta().props.onChange({ target: { value: "alpha\nSECOND-DRAFT\n" } }); paint();
		refuseWrites = true;
		get((n) => n.type === "button" && n.children?.[0] === "editor.save").props.onClick();
		await tick();
		check("a refused save re-raises the conflict banner with its exits", Boolean(btn("watch.compareDisk")) && Boolean(btn("watch.overwriteDraft")), null);
		check("the refused save kept the draft in the editor", ta()?.props.value === "alpha\nSECOND-DRAFT\n", ta()?.props.value);
		render.unmount();
	} finally {
		Object.assign(globalThis, conflictGlobals);
	}
}

// --- draft vs disk diff (external-conflict compare path) ------------------------------
{
	const same = draftDiskDiff("a\nb\n", "a\nb\n", "f.go");
	check("identical texts report identical with no diff rows", same.identical === true && same.text === "" && same.add === 0 && same.del === 0, same);
	const one = draftDiskDiff("alpha\nbeta\ngamma\n", "alpha\nBETA\ngamma\n", "f.go");
	check("single-line change counts one add and one del", one.add === 1 && one.del === 1 && !one.identical, one);
	const rows = parseDiff(one.text);
	check("draft diff parses as unified rows with a hunk header", rows.some((r) => r.kind === "hunk") && rows.some((r) => r.kind === "add" && r.text === "BETA") && rows.some((r) => r.kind === "del" && r.text === "beta"), rows.map((r) => r.kind));
	check("draft diff keeps 3-line context around the change", rows.filter((r) => r.kind === "ctx").length === 2, rows.filter((r) => r.kind === "ctx").length);
	const head = draftDiskDiff("x\n", "x\ny\n", "pkg/f.go");
	check("draft diff header names the file", head.text.startsWith("--- a/pkg/f.go\n+++ b/pkg/f.go"), head.text.slice(0, 60));
	const pureAdd = draftDiskDiff("", "new\n", "n.go");
	check("empty disk side is a pure addition", pureAdd.add === 1 && pureAdd.del === 0, pureAdd);
	const pureDel = draftDiskDiff("gone\n", "", "n.go");
	check("empty draft side is a pure deletion", pureDel.add === 0 && pureDel.del === 1, pureDel);
	// Two distant changes must become two hunks, not one giant block.
	const far = draftDiskDiff(Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n") + "\n", Array.from({ length: 30 }, (_, i) => (i === 2 ? "CHANGED-A" : i === 25 ? "CHANGED-B" : `l${i}`)).join("\n") + "\n", "f.go");
	check("distant changes split into separate hunks", (far.text.match(/@@/g) ?? []).length === 4, far.text.match(/@@/g));
	// Huge-pair fallback: common prefix/suffix trimmed, middle replaced.
	const bigOld = Array.from({ length: 2500 }, (_, i) => `o${i}`).join("\n");
	const bigNew = Array.from({ length: 2500 }, (_, i) => `n${i}`).join("\n");
	const coarse = draftDiskDiff(bigOld, bigNew, "big.txt");
	check("huge pairs fall back to a whole-replace diff without throwing", coarse.add === 2500 && coarse.del === 2500, [coarse.add, coarse.del]);
}

// --- M2 editor productivity: workspace symbol palette + format-on-save flow -----------
{
	const { WorkspaceSymbolPalette } = await import("./src/client/overlays.js");
	const prodGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, window: globalThis.window, document: globalThis.document };
	const prodRequests = [];
	let prodTimers = [];
	globalThis.fetch = async (url, options) => {
		const body = JSON.parse(options?.body ?? "{}");
		prodRequests.push({ url: String(url), body });
		if (url.endsWith("/watch.poll")) return { json: async () => ({ ok: true, value: body.since === -1 ? { seq: 1, baseline: true, supported: true } : { seq: 1, paths: [], git: false } }) };
		if (url.endsWith("/fs.read")) return { json: async () => ({ ok: true, value: { kind: "text", content: "package main\n\nfunc helper() {}\n", mtimeMs: 1 } }) };
		if (url.endsWith("/fs.list")) return { json: async () => ({ ok: true, value: { entries: [{ name: "main.go", type: "file", size: 24 }], truncated: false } }) };
		if (url.endsWith("/git.status")) return { json: async () => ({ ok: true, value: { repo: false } }) };
		if (url.endsWith("/git.diff")) return { json: async () => ({ ok: true, value: {} }) };
		if (url.endsWith("/lsp.workspaceSymbol")) return { json: async () => ({ ok: true, value: { symbols: [{ name: "helper", kind: 12, container: "main", path: "/w/main.go", line: 3, col: 6 }], status: { state: "ready", label: "gopls" } } }) };
		if (url.endsWith("/fs.formatDraft")) return { json: async () => ({ ok: true, value: { formatted: true, content: "package main\n\nfunc formatted() {}\n", mtimeMs: 9 } }) };
		if (url.endsWith("/lsp.diagnostics")) return { json: async () => ({ ok: true, value: { items: [] } }) };
		if (url.endsWith("/lsp.request")) return { json: async () => ({ ok: true, value: { symbols: [], targets: [] } }) };
		if (url.endsWith("/lsp.status")) return { json: async () => ({ ok: true, value: { state: "ready", label: "gopls" } }) };
		return { json: async () => ({ ok: true, value: {} }) };
	};
	globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
	globalThis.cancelAnimationFrame = () => {};
	globalThis.setTimeout = (fn, ms) => { prodTimers.push({ fn, ms, fired: false }); return prodTimers.length; };
	globalThis.clearTimeout = (id) => { if (typeof id === "number" && prodTimers[id - 1]) prodTimers[id - 1].cancelled = true; };
	globalThis.window = { innerWidth: 1200, innerHeight: 900 };
	globalThis.document = { addEventListener() {}, removeEventListener() {} };
	try {
		// Pure component: rows show glyph, name·container and relative file:line.
		const rows = [];
		const wtree = WorkspaceSymbolPalette({
			t: (k) => k,
			cwd: "/w",
			state: { query: "hel", results: [{ name: "helper", kind: 12, container: "main", path: "/w/main.go", line: 3, col: 6 }], busy: false, error: "" },
			onQuery: () => {},
			onPick: (s) => rows.push(s),
			onClose: () => {},
		});
		const wtexts = () => collect(wtree).filter((n) => n.type === "span").map((n) => n.children[0]).filter((x) => typeof x === "string");
		check("workspace symbol rows show name·container and relative file:line", wtexts().includes("helper · main") && wtexts().includes("main.go") && wtexts().includes(":3"), wtexts());
		const wempty = collect(WorkspaceSymbolPalette({ t: (k) => k, cwd: "/w", state: { query: "zz", results: [], busy: false, error: "" }, onQuery: () => {}, onPick: () => {}, onClose: () => {} }));
		check("workspace symbol palette distinguishes empty from loading", wempty.some((n) => n.children?.[0] === "wsym.none"), null);

		const renderProd = createHookRenderer(CodeBody, { sessionId: "prod", useSessions: (select) => select({ byId: { prod: { cwd: "/w" } } }), t: (k) => k }, { effects: true });
		let prodTree = renderProd();
		renderProd.flushEffects();
		const fireProd = () => { const due = prodTimers.filter((t) => !t.fired && !t.cancelled); due.forEach((t) => { t.fired = true; }); prodTimers = prodTimers.filter((t) => !t.fired && !t.cancelled); for (const t of due) t.fn(); };
		const paintProd = () => { prodTree = renderProd(); renderProd.flushEffects(); };
		const tickProd = async () => { for (let i = 0; i < 8; i++) { await new Promise((r) => setImmediate(r)); fireProd(); paintProd(); } };
		const getProd = (test) => collect(prodTree).find(test);
		await tickProd();
		getProd((n) => n.type === TreePanelCmp).props.onOpenFile("main.go", 1, 1);
		await tickProd();
		// ⌥⌘O opens the workspace symbol palette.
		prodTree.props.onKeyDown({ code: "KeyO", metaKey: true, altKey: true, shiftKey: false, preventDefault() {} });
		paintProd();
		check("⌥⌘O opens the workspace symbol palette", Boolean(getProd((n) => n.type === WorkspaceSymbolPalette)), null);
		getProd((n) => n.type === WorkspaceSymbolPalette).props.onQuery("hel");
		await tickProd();
		check("typing debounces a workspace/symbol query to the host", prodRequests.some((r) => r.url.endsWith("/lsp.workspaceSymbol") && r.body.query === "hel"), prodRequests.map((r) => r.url));
		const pal = () => getProd((n) => n.type === WorkspaceSymbolPalette).props.state;
		check("fetched symbols land in the palette state (busy cleared, one row)", pal().results.length === 1 && pal().busy === false && pal().results[0].name === "helper", pal());
		getProd((n) => n.type === WorkspaceSymbolPalette).props.onPick({ name: "helper", kind: 12, container: "main", path: "/w/main.go", line: 3, col: 6 });
		await tickProd();
		check("picking a symbol opens its file at the definition", prodRequests.some((r) => r.url.endsWith("/fs.read") && r.body.path === "/w/main.go") && !getProd((n) => n.type === WorkspaceSymbolPalette), null);
		// Format-on-save: ⌘S routes the draft through fs.formatDraft and adopts the result.
		const editBtn = getProd((n) => n.type === "button" && n.props.title === "editor.edit");
		editBtn.props.onClick(); paintProd();
		getProd((n) => n.type === "textarea" && typeof n.props.className === "string" && n.props.className.startsWith("ce-edit-ta")).props.onChange({ target: { value: "package main\n\nfunc helper() { }\n" } });
		paintProd();
		getProd((n) => n.type === "button" && n.children?.[0] === "editor.save").props.onClick();
		await tickProd();
		check("saving a Go draft goes through fs.formatDraft with the mtime guard", prodRequests.some((r) => r.url.endsWith("/fs.formatDraft") && r.body.baseMtime === 1) && !prodRequests.some((r) => r.url.endsWith("/fs.write")), prodRequests.map((r) => r.url));
		check("the formatted server text is adopted, not the raw draft", getProd((n) => n.props.className === "ce-head-path")?.children[0] === "main.go" && !getProd((n) => n.type === "textarea"), null);
		renderProd.unmount();
	} finally {
		Object.assign(globalThis, prodGlobals);
	}
}

// --- M3 git deepening: conflict banner, cherry-pick two-step, compare group -----------
{
	const { ChangesPanel } = await import("./src/client/changes.js");
	const picks = [];
	const resolves = [];
	const seqs = [];
	const opened = [];
	const closedCompare = [];
	const cpGit = {
		repo: true,
		branch: "main",
		root: "/w",
		working: [{ path: "src/a.txt", xy: "UU", from: null }],
		branchFiles: [],
		commits: [{ hash: "dead111", subject: "feat work" }],
		base: { name: "origin/main", mergeBase: "0000" },
		upstream: null,
		ahead: 0,
		behind: 0,
		inProgress: "cherry-pick",
	};
	const renderCp = createHookRenderer(() => ChangesPanel({
		cwd: "/w",
		t: (k) => k,
		git: cpGit,
		repos: null,
		repoSel: null,
		commitsOpen: true,
		setCommitsOpen: () => {},
		onOpenCommit: () => {},
		onOpenDiff: (path, scope, repo, refs) => opened.push([path, scope, refs?.base, refs?.head]),
		onDiscard: () => {},
		onStage: () => {},
		onUnstage: () => {},
		onCommit: () => {},
		committing: false,
		onNotify: () => {},
		refresh: () => {},
		onCherryPick: (commit) => picks.push(commit.hash),
		onResolve: (path, side) => resolves.push([path, side]),
		onSequencer: (action) => seqs.push(action),
		compare: { baseName: "main", headName: "feat", files: [{ status: "A", path: "src/n.txt" }], shortstat: "1 file changed", commits: 1 },
		setCompare: (v) => closedCompare.push(v),
		seqDisabled: false,
		sessionId: "x",
	}), {});
	const cpTree = renderCp();
	const cpGet = (test) => collect(cpTree).find(test);
	check("the sequencer banner lists conflicted files with both side buttons", cpGet((n) => n.type === "button" && n.children?.[0] === "changes.ours") && cpGet((n) => n.children?.[0] === "changes.theirs") !== undefined, null);
	cpGet((n) => n.children?.[0] === "changes.ours").props.onClick();
	check("ours resolves the file through the host callback", resolves.length === 1 && resolves[0][0] === "src/a.txt" && resolves[0][1] === "ours", resolves);
	cpGet((n) => n.children?.[0] === "changes.abort").props.onClick();
	check("the banner exposes abort for the sequencer", seqs.join() === "abort", seqs);
	const pickBtn = cpGet((n) => n.type === "button" && n.props.title === "changes.pickTitle");
	check("commit rows carry a cherry-pick control", Boolean(pickBtn), null);
	pickBtn.props.onClick();
	check("the first pick click only arms the confirmation", picks.length === 0 && collect(renderCp()).some((n) => n.props.title === "changes.pickConfirm"), picks);
	collect(renderCp()).find((n) => n.props.title === "changes.pickConfirm").props.onClick();
	check("the second pick click runs the cherry-pick", picks.join() === "dead111", picks);
	check("the compare group lists name-status rows", collect(cpTree).some((n) => n.type === "span" && n.children[0] === "A") && collect(cpTree).some((n) => n.type === "span" && n.children[0] === "src/n.txt"), null);
	collect(cpTree).find((n) => n.type === "button" && n.props.className === "ctp-entry-open" && collect(n).some((c) => c.type === "span" && c.children[0] === "src/n.txt")).props.onClick();
	check("a compare row opens the compare-scope diff with both refs", opened.length === 1 && opened[0][1] === "compare" && opened[0][2] === "main" && opened[0][3] === "feat", opened);
	collect(cpTree).find((n) => n.type === "button" && n.props.title === "close").props.onClick();
	check("the compare group can be dismissed", closedCompare.length === 1 && closedCompare[0] === null, closedCompare);
}
{
	// CodeBody flow: command center → compare dialog → refs → group → diff request.
	const { ChangesPanel: ChangesPanelCmp } = await import("./src/client/changes.js");
	const { CompareRefsPalette: CompareRefsPaletteCmp } = await import("./src/client/overlays.js");
	const { DiffView: DiffViewCmp } = await import("./src/client/diff.js");
	const cmpGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, window: globalThis.window, document: globalThis.document };
	const cmpRequests = [];
	let cmpTimers = [];
	globalThis.fetch = async (url, options) => {
		const body = JSON.parse(options?.body ?? "{}");
		cmpRequests.push({ url: String(url), body });
		if (url.endsWith("/watch.poll")) return { json: async () => ({ ok: true, value: body.since === -1 ? { seq: 1, baseline: true, supported: true } : { seq: 1, paths: [], git: false } }) };
		if (url.endsWith("/fs.list")) return { json: async () => ({ ok: true, value: { entries: [], truncated: false } }) };
		if (url.endsWith("/fs.read")) return { json: async () => ({ ok: true, value: { kind: "text", content: "package main\n", mtimeMs: 1 } }) };
		if (url.endsWith("/git.status")) return { json: async () => ({ ok: true, value: { repo: true, branch: "main", root: "/w", working: [], branchFiles: [], commits: [], base: null, upstream: "origin/main", ahead: 0, behind: 0 } }) };
		if (url.endsWith("/git.branches")) return { json: async () => ({ ok: true, value: { branches: [{ name: "main", current: true, remote: false, sha: "1111" }, { name: "feat", current: false, remote: false, sha: "2222" }, { name: "origin/main", current: false, remote: true, sha: "1111" }] } }) };
		if (url.endsWith("/git.compare")) return { json: async () => ({ ok: true, value: { base: "1111", head: "2222", baseName: "main", headName: "feat", mergeBase: "0000", files: [{ status: "M", path: "src/a.txt" }, { status: "A", path: "src/n.txt" }], total: 2, truncated: false, shortstat: "2 files changed", commits: 1 } }) };
		if (url.endsWith("/git.diff")) return { json: async () => ({ ok: true, value: { scope: body.scope, diff: "@@ -1 +1 @@\n-line\n+feat\n", base: body.base, head: body.head } }) };
		if (url.endsWith("/lsp.diagnostics") || url.endsWith("/lsp.request") || url.endsWith("/lsp.status")) return { json: async () => ({ ok: true, value: { items: [], symbols: [], targets: [], state: "off" } }) };
		return { json: async () => ({ ok: true, value: {} }) };
	};
	globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
	globalThis.cancelAnimationFrame = () => {};
	globalThis.setTimeout = (fn, ms) => { cmpTimers.push({ fn, ms, fired: false }); return cmpTimers.length; };
	globalThis.clearTimeout = (id) => { if (typeof id === "number" && cmpTimers[id - 1]) cmpTimers[id - 1].cancelled = true; };
	globalThis.window = { innerWidth: 1200, innerHeight: 900 };
	globalThis.document = { addEventListener() {}, removeEventListener() {} };
	try {
		const renderCmp = createHookRenderer(CodeBody, { sessionId: "cmp", useSessions: (select) => select({ byId: { cmp: { cwd: "/w" } } }), t: (k) => k }, { effects: true });
		let cmpTree = renderCmp();
		renderCmp.flushEffects();
		const fireCmp = () => { const due = cmpTimers.filter((t) => !t.fired && !t.cancelled); due.forEach((t) => { t.fired = true; }); cmpTimers = cmpTimers.filter((t) => !t.fired && !t.cancelled); for (const t of due) t.fn(); };
		const paintCmp = () => { cmpTree = renderCmp(); renderCmp.flushEffects(); };
		const tickCmp = async () => { for (let i = 0; i < 8; i++) { await new Promise((r) => setImmediate(r)); fireCmp(); } paintCmp(); };
		const getCmp = (test) => collect(cmpTree).find(test);
		await tickCmp();
		getCmp((n) => n.type === TreePanelCmp).props.onOpenFile("main.go", 1, 1);
		await tickCmp();
		cmpTree.props.onKeyDown({ code: "KeyP", metaKey: true, shiftKey: true, preventDefault() {} });
		paintCmp();
		const cmds = getCmp((n) => n.type.name === "CommandPalette").props.commands;
		const compareCmd = cmds.find((c) => c.id === "compare");
		check("the command center lists Compare References", Boolean(compareCmd), cmds.map((c) => c.id));
		await compareCmd.run();
		await tickCmp();
		check("opening compare fetches the ref list", cmpRequests.some((r) => r.url.endsWith("/git.branches")) && Boolean(getCmp((n) => n.type === CompareRefsPaletteCmp)), null);
		getCmp((n) => n.type === CompareRefsPaletteCmp).props.onRun("main", "feat");
		await tickCmp();
		check("running the compare asks the host for the range", cmpRequests.some((r) => r.url.endsWith("/git.compare") && r.body.base === "main" && r.body.head === "feat"), null);
		const panel = getCmp((n) => n.type === ChangesPanelCmp);
		check("the compare result lands on the Changes panel", panel.props.compare.files.length === 2 && panel.props.compare.headName === "feat", panel.props.compare);
		panel.props.onOpenDiff("src/a.txt", "compare", null, { base: "main", head: "feat" });
		await tickCmp();
		check("opening a compared file requests the compare-scope diff", cmpRequests.some((r) => r.url.endsWith("/git.diff") && r.body.scope === "compare" && r.body.base === "main"), null);
		check("the compared diff renders in the diff view", getCmp((n) => n.type === DiffViewCmp) !== undefined || collect(cmpTree).some((n) => typeof n.props.className === "string" && n.props.className.includes("ce-diff")), null);
		renderCmp.unmount();
	} finally {
		Object.assign(globalThis, cmpGlobals);
	}
}

// --- M4 task runner: output parsing, folding, panels ----------------------------------
{
	const { failureAt, foldTaskOutput, countLines } = await import("./src/client/tasks.js");
	check("failureAt locates go test lines", failureAt("\tmain_test.go:42:7: want x")?.line === 42, null);
	check("failureAt locates tsc columns", failureAt("src/app.ts(12,5): error TS2304: bad")?.path === "src/app.ts", null);
	check("failureAt locates eslint-ish colon lines", failureAt("lib/x.js:3:1: Unexpected" )?.line === 3, null);
	check("failureAt locates pytest frames", failureAt('  File "tests/x.py", line 12, in test_y')?.path === "tests/x.py", null);
	check("failureAt locates rustc arrows", failureAt("  --> src/main.rs:12:5")?.line === 12, null);
	check("failureAt ignores plain noise", failureAt("npm notice update available") === null, null);
	const base = { chunks: [{ stream: "out", text: "a\nb\n" }], lineCount: 3, seq: 4, done: false, code: null, dropped: false, reset: false };
	const appended = foldTaskOutput(base, { chunks: [{ stream: "err", text: "bad\n" }], seq: 8, done: false, code: null, dropped: false, reset: false });
	check("fold appends new chunks and advances the cursor", appended.chunks.length === 2 && appended.seq === 8 && appended.lineCount === 4, appended);
	const resetFold = foldTaskOutput(base, { chunks: [{ stream: "out", text: "tail\n" }], seq: 99, done: true, code: 3, dropped: true, reset: true });
	check("fold on reset replaces the retained window", resetFold.chunks.length === 1 && resetFold.done && resetFold.code === 3 && resetFold.lineCount === 2, resetFold);
	check("countLines counts a trailing open line", countLines([{ text: "x\ny\nz" }]) === 3, countLines([{ text: "x\ny\nz" }]));

	const { TaskPalette, TaskOutputPanel } = await import("./src/client/overlays.js");
	const ran = [];
	const tpTree = TaskPalette({ t: (k) => k, state: { scripts: { test: "vitest run", build: "vite build" }, running: { build: 1 }, busy: false, error: "" }, onRun: (s) => ran.push(s), onClose: () => {} });
	const tpSpans = () => collect(tpTree).filter((n) => n.type === "span").map((n) => n.children[0]).filter((x) => typeof x === "string");
	check("the task palette lists scripts with commands and a running dot", tpSpans().includes("test") && tpSpans().includes("vitest run") && tpSpans().includes("●"), tpSpans());
	collect(tpTree).find((n) => n.type === "button" && n.props.className === "ce-qitem").props.onClick();
	check("clicking a task row runs that script", ran.join() === "test", ran);
	const opened = [];
	const outTree = TaskOutputPanel({
		t: (k) => k,
		state: { script: "test", chunks: [{ stream: "out", text: "ok line\n\tmain_test.go:7:2: boom\n" }], seq: 5, done: false, code: null, dropped: false },
		onStop: () => {},
		onClose: () => {},
		onOpenFile: (path, line, col) => opened.push([path, line, col]),
	});
	const jump = collect(outTree).find((n) => n.type === "button" && n.props.className === "ce-task-jump");
	check("failure lines render as jump buttons, plain lines stay text", Boolean(jump) && collect(outTree).filter((n) => n.props.className === "ce-task-line").length === 3, null);
	jump.props.onClick();
	check("a jump click resolves the failure position", opened.length === 1 && opened[0][0] === "main_test.go" && opened[0][1] === 7, opened);
	check("a running task shows the stop control", collect(outTree).some((n) => n.type === "button" && /task.stop/.test(String(n.props.title ?? ""))), null);
	const doneTree = TaskOutputPanel({ t: (k) => k, state: { script: "test", chunks: [], seq: 9, done: true, code: 0, dropped: true }, onStop: () => {}, onClose: () => {}, onOpenFile: () => {} });
	check("a finished task hides stop and reports the dropped tail", !collect(doneTree).some((n) => n.type === "button" && /task.stop/.test(String(n.props.title ?? ""))) && collect(doneTree).some((n) => n.children?.[0] === "task.dropped"), null);
}
{
	// CodeBody wiring: command → task.scripts, run → start → output state.
	const taskGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, window: globalThis.window, document: globalThis.document };
	const taskRequests = [];
	let taskTimers = [];
	let pollStage = 0;
	globalThis.fetch = async (url, options) => {
		const body = JSON.parse(options?.body ?? "{}");
		taskRequests.push({ url: String(url), body });
		if (url.endsWith("/watch.poll")) return { json: async () => ({ ok: true, value: body.since === -1 ? { seq: 1, baseline: true, supported: true } : { seq: 1, paths: [], git: false } }) };
		if (url.endsWith("/fs.list")) return { json: async () => ({ ok: true, value: { entries: [], truncated: false } }) };
		if (url.endsWith("/fs.read")) return { json: async () => ({ ok: true, value: { kind: "text", content: "x\n", mtimeMs: 1 } }) };
		if (url.endsWith("/git.status")) return { json: async () => ({ ok: true, value: { repo: false } }) };
		if (url.endsWith("/task.scripts")) return { json: async () => ({ ok: true, value: { scripts: { test: "node t.js" }, running: {} } }) };
		if (url.endsWith("/task.start")) return { json: async () => ({ ok: true, value: { id: "7", script: "test" } }) };
		if (url.endsWith("/task.poll")) {
			pollStage++;
			if (pollStage === 1) return { json: async () => ({ ok: true, value: { id: "7", script: "test", seq: 10, baseSeq: 0, done: false, code: null, dropped: false, reset: false, chunks: [{ stream: "out", text: "running…\n" }] } }) };
			return { json: async () => ({ ok: true, value: { id: "7", script: "test", seq: 10, baseSeq: 0, done: true, code: 0, dropped: false, reset: false, chunks: [] } }) };
		}
		return { json: async () => ({ ok: true, value: {} }) };
	};
	globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
	globalThis.cancelAnimationFrame = () => {};
	globalThis.setTimeout = (fn, ms) => { taskTimers.push({ fn, ms, fired: false }); return taskTimers.length; };
	globalThis.clearTimeout = (id) => { if (typeof id === "number" && taskTimers[id - 1]) taskTimers[id - 1].cancelled = true; };
	globalThis.window = { innerWidth: 1200, innerHeight: 900 };
	globalThis.document = { addEventListener() {}, removeEventListener() {} };
	try {
		const { TaskPalette: TaskPaletteCmp, TaskOutputPanel: TaskOutputPanelCmp } = await import("./src/client/overlays.js");
		const renderTk = createHookRenderer(CodeBody, { sessionId: "tk", useSessions: (select) => select({ byId: { tk: { cwd: "/w" } } }), t: (k) => k }, { effects: true });
		let tkTree = renderTk();
		renderTk.flushEffects();
		const fireTk = () => { const due = taskTimers.filter((t) => !t.fired && !t.cancelled); due.forEach((t) => { t.fired = true; }); taskTimers = taskTimers.filter((t) => !t.fired && !t.cancelled); for (const t of due) t.fn(); };
		const paintTk = () => { tkTree = renderTk(); renderTk.flushEffects(); };
		const tickTk = async () => { for (let i = 0; i < 8; i++) { await new Promise((r) => setImmediate(r)); fireTk(); } paintTk(); };
		const getTk = (test) => collect(tkTree).find(test);
		await tickTk();
		// Tasks (like compare) live in the editor overlay container: open a file first.
		getTk((n) => n.type === TreePanelCmp).props.onOpenFile("main.go", 1, 1);
		await tickTk();
		tkTree.props.onKeyDown({ code: "KeyP", metaKey: true, shiftKey: true, preventDefault() {} });
		paintTk();
		const cmds = getTk((n) => n.type.name === "CommandPalette").props.commands;
		await cmds.find((c) => c.id === "tasks").run();
		await tickTk();
		check("the tasks command reads package.json scripts from the host", taskRequests.some((r) => r.url.endsWith("/task.scripts")) && Boolean(getTk((n) => n.type === TaskPaletteCmp)), null);
		getTk((n) => n.type === TaskPaletteCmp).props.onRun("test");
		await tickTk(); await tickTk();
		check("running a task starts the job and opens its output panel", taskRequests.some((r) => r.url.endsWith("/task.start") && r.body.script === "test") && Boolean(getTk((n) => n.type === TaskOutputPanelCmp)), null);
		const outNode = getTk((n) => n.type === TaskOutputPanelCmp);
		check("the poll pump folds streamed chunks into the panel state", outNode.props.state.chunks.some((c) => c.text.includes("running…")), outNode.props.state);
		await tickTk(); await tickTk();
		const doneNode = getTk((n) => n.type === TaskOutputPanelCmp)?.props.state ?? {};
		check("the pump stops folding after done and reports the exit", doneNode.done === true && doneNode.code === 0);
		renderTk.unmount();
	} finally {
		Object.assign(globalThis, taskGlobals);
	}
}

// --- M5 API: extracts, OpenAPI/Postman import ------------------------------------------
{
	const reqm = await import("./src/client/reqmodel.js");
	const { jsonPath, runExtract, applyExtracts, emptyEnvStore, addEnv, selectEnv } = reqm;
	const body = { data: { items: [{ id: 7 }], "x.y": "dotted", tags: ["a", "b"] }, ok: true };
	check("jsonPath walks dots and array indices", jsonPath(body, "$.data.items[0].id") === 7, null);
	check("jsonPath supports quoted bracket keys", jsonPath(body, 'data.items[0].id') === 7 && jsonPath(body, '$.data["x.y"]') === "dotted", null);
	check("jsonPath returns undefined on a miss", jsonPath(body, "$.data.items[3].id") === void 0 && jsonPath(body, "$.nope.deep") === void 0, null);
	check("runExtract reads json/header/status/body/regex/query",
		runExtract({ source: "json", expr: "$.data.tags[1]" }, { text: JSON.stringify(body) }) === "b"
		&& runExtract({ source: "header", expr: "X-Token" }, { headers: [["x-token", "tk1"]] }) === "tk1"
		&& runExtract({ source: "status", expr: "" }, { status: 204 }) === "204"
		&& runExtract({ source: "regex", expr: "id=(\\d+)" }, { text: "u id=42 x" }) === "42"
		&& runExtract({ source: "query", expr: "code" }, {}, { url: "https://e.test/cb?code=abc" }) === "abc", null);
	check("runExtract misses return undefined without throwing", runExtract({ source: "json", expr: "$.x" }, { text: "not json" }) === void 0 && runExtract({ source: "regex", expr: "[" }, { text: "x" }) === void 0, null);
	const store0 = emptyEnvStore();
	let store = emptyEnvStore(); store = addEnv(store, { name: "Dev" }); store = selectEnv(store, store.envs[0].id);
	void store0;
	const applied = applyExtracts(
		[{ name: "itemId", source: "json", expr: "$.data.items[0].id" }, { name: "tok", source: "header", expr: "X-Token", enabled: false }, { name: "gone", source: "json", expr: "$.nope" }],
		{ text: JSON.stringify(body), headers: [["X-Token", "t"]] },
		{ url: "" },
		store,
	);
	check("applyExtracts writes hits into the active env and lists misses", applied.applied.length === 1 && applied.missed.join() === "gone" && applied.store.envs[0].vars.some((v) => v.name === "itemId" && v.value === "7"), applied);
	const noop = applyExtracts([{ name: "tok", source: "header", expr: "X-Token" }], { text: "", headers: [] }, { url: "" }, store);
	check("a full miss leaves the store untouched", noop.store === store && noop.missed.length === 1, noop);
	const { parseOpenApi, parsePostman, detectCollectionImport } = await import("./src/client/openimp.js");
	const oa = parseOpenApi({
		openapi: "3.0.0",
		servers: [{ url: "https://api.test/" }],
		paths: {
			"/users/{id}": { get: { summary: "Get user", parameters: [{ name: "id", in: "path", schema: { type: "string" } }, { name: "verbose", in: "query", example: "1" }] }, delete: { operationId: "dropUser" } },
			"/login": { post: { requestBody: { content: { "application/json": { schema: { type: "object", properties: { user: { type: "string" }, pin: { type: "integer" } } } } } } } },
		},
	});
	check("OpenAPI import produces operations with :path params", oa.requests.length === 3 && oa.requests[0].url === "https://api.test/users/:id" && oa.requests[0].paramPairs.some((p) => p.name === "verbose" && p.value === "1"), oa.requests?.[0]);
	const login = oa.requests.find((r) => r.method === "POST");
	check("OpenAPI request bodies sample the schema", login.bodyType === "raw" && login.body.includes('"user"') && login.body.includes('"pin"') && login.headers.some((hd) => hd.value === "application/json"), login);
	const pm = parsePostman({
		info: { name: "Set", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
		item: [
			{ name: "folder", item: [{ name: "nested", request: { method: "GET", url: { raw: "https://e.test/x?y=1", query: [{ key: "y", value: "1" }] } } }] },
			{ name: "auth", request: { method: "POST", url: "https://e.test/token", header: [{ key: "Accept", value: "application/json" }], body: { mode: "urlencoded", urlencoded: [{ key: "grant", value: "pw" }] } } },
		],
	});
	check("Postman import flattens folders and maps urlencoded bodies", pm.requests.length === 2 && pm.requests[0].url === "https://e.test/x?y=1" && pm.requests[1].bodyType === "form" && JSON.parse(pm.requests[1].body)[0].name === "grant", pm.requests);
	check("detectCollectionImport routes by document shape", detectCollectionImport("{ not json") === null && detectCollectionImport(JSON.stringify({ hello: 1 })) === null && detectCollectionImport(JSON.stringify({ openapi: "3.0.0", paths: {} })).error !== undefined, null);
}

// --- M5 integration: extracts tab + send-time write + OpenAPI import to favorites ------
{
	const exGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, window: globalThis.window, document: globalThis.document };
	let exWire;
	let exTimers = [];
	globalThis.fetch = async (_url, options) => {
		exWire = JSON.parse(options?.body ?? "{}");
		return { json: async () => ({ ok: true, value: { status: 201, headers: [["X-Token", "tk9"]], text: '{"auth":{"id":42}}', ms: 5, size: 16 } }) };
	};
	globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
	globalThis.cancelAnimationFrame = () => {};
	globalThis.setTimeout = (fn, ms) => { exTimers.push({ fn, fired: false }); return exTimers.length; };
	globalThis.clearTimeout = (id) => { if (typeof id === "number" && exTimers[id - 1]) exTimers[id - 1].cancelled = true; };
	globalThis.window = { innerWidth: 1200, innerHeight: 900 };
	globalThis.document = { addEventListener() {}, removeEventListener() {} };
	try {
		const renderEx = createHookRenderer(ApiView, { t: (k) => k }, { effects: true });
		let exTree = renderEx();
		renderEx.flushEffects();
		const fireEx = () => { const due = exTimers.filter((x) => !x.fired && !x.cancelled); due.forEach((x) => { x.fired = true; }); exTimers = exTimers.filter((x) => !x.fired && !x.cancelled); for (const x of due) x.fn(); };
		const paintEx = () => { exTree = renderEx(); renderEx.flushEffects(); };
		const tickEx = async () => { for (let i = 0; i < 6; i++) { await new Promise((r) => setImmediate(r)); fireEx(); paintEx(); } };
		const exNode = (p) => collect(exTree).find(p);
		const exChoose = (key) => { exNode((n) => n.props.className?.startsWith("cea-config-tab") && n.children[0] === key).props.onClick(); paintEx(); };
		const envVarValues = () => collect(exTree).filter((n) => n.type === "input" && /api\.environment · api\.fieldName/.test(String(n.props["aria-label"] ?? ""))).map((n) => n.props.value);
		exChoose("api.extracts");
		check("extracts tab renders with its environment note", collect(exTree).some((n) => n.children?.[0] === "api.extractHint"), null);
		{
			const addBtn = collect(exTree).find((n) => n.type === "button" && JSON.stringify(n.children ?? []).includes("api.addExtract"));
			addBtn.props.onClick(); paintEx();
			check("adding a rule renders the six-source selector", Boolean(exNode((n) => n.type === "select" && /api\.extracts/.test(String(n.props["aria-label"] ?? "")))), null);
			const nameInput = exNode((n) => n.type === "input" && n.props.placeholder === "api.extractName");
			nameInput.props.onChange({ target: { value: "uid" } }); paintEx();
			const exprInput = exNode((n) => n.type === "input" && n.props.placeholder === "api.extractExpr");
			exprInput.props.onChange({ target: { value: "$.auth.id" } }); paintEx();
			check("rule fields hold their values", collect(exTree).some((n) => n.type === "input" && n.props.value === "uid") && collect(exTree).some((n) => n.type === "input" && n.props.value === "$.auth.id"), null);
			const delBtn = collect(exTree).find((n) => n.type === "button" && n.props.className === "ce-tool cea-field-delete" && /api\.extracts/.test(String(n.props["aria-label"] ?? "")));
			delBtn.props.onClick(); paintEx();
			check("removing a rule empties the table", !collect(exTree).some((n) => n.type === "input" && n.props.value === "uid"), null);
		}
		renderEx.unmount();
	} finally {
		Object.assign(globalThis, exGlobals);
	}
	// OpenAPI import via the import dialog lands as favorites + editor content.
	const imGlobals = { fetch: globalThis.fetch };
	globalThis.fetch = async () => ({ json: async () => ({ ok: true, value: {} }) });
	try {
		const renderIm = createHookRenderer(ApiView, { t: (k) => k }, { effects: true });
		let imTree = renderIm();
		renderIm.flushEffects();
		const imNode = (p) => collect(imTree).find(p);
		const paintIm = () => { imTree = renderIm(); renderIm.flushEffects(); };
		imNode((n) => n.props.title === "api.importTitle").props.onClick(); paintIm();
		imNode((n) => n.props.className === "cea-body cea-import").props.onChange({ target: { value: JSON.stringify({ openapi: "3.0.0", servers: [{ url: "https://api.test" }], paths: { "/ping": { get: { summary: "Ping" } }, "/ops/{id}": { post: { summary: "Create op" } } } }) } }); paintIm();
		imNode((n) => n.props.className === "ce-sk-btn" && n.children?.[0] === "api.importBtn").props.onClick();
		await new Promise((r) => setImmediate(r)); paintIm();
		check("OpenAPI import applies the first operation to the editor", imNode((n) => n.props.className === "ce-input cea-url").props.value === "https://api.test/ping", null);
		imNode((n) => n.props.title === "api.history").props.onClick(); paintIm();
		{
			imNode((n) => n.type === "button" && n.props.title === "api.history").props.onClick(); paintIm();
			const savedTab = collect(imTree).find((n) => n.type === "button" && JSON.stringify(n.children ?? []).includes("api.saved"));
			check("saved tab is reachable after import", Boolean(savedTab), collect(imTree).filter((n) => n.type === "button").map((n) => JSON.stringify(n.children)));
			savedTab.props.onClick(); paintIm();
		}
		const savedRows = () => collect(imTree).filter((n) => n.type === "span" && typeof n.children?.[0] === "string" && n.children[0].startsWith("★ ")).map((n) => n.children[0]);
		check("OpenAPI import stores every operation as a favorite", savedRows().includes("★ Ping") && savedRows().includes("★ Create op"), savedRows());
		renderIm.unmount();
	} finally {
		Object.assign(globalThis, imGlobals);
	}
}

// --- M5 SSE: frame parsing + stream folding (pure) -------------------------------------
{
	const { parseSse, emptySseState, foldStream, sseEventLabel } = await import("./src/client/sse.js");
	let s = emptySseState();
	let r = parseSse(s, "data: hel");
	s = r.state;
	check("parseSse holds partial frames across deltas", r.events.length === 0, r);
	r = parseSse(s, "lo\n\n");
	check("parseSse completes the frame once the blank line lands", r.events.length === 1 && r.events[0].data === "hello", r);
	r = parseSse(r.state, "event: ping\nid: 9\nretry: 2500\ndata: a\ndata: b\n\n");
	check("parseSse joins multi-line data and carries event/id/retry", r.events[0].event === "ping" && r.events[0].data === "a\nb" && r.events[0].id === "9" && r.events[0].retry === 2500, r.events);
	r = parseSse(r.state, ": keep-alive\n\ndata: x\r\n\r\n");
	check("parseSse skips comment-only frames and tolerates CRLF", r.events.length === 1 && r.events[0].data === "x", r.events);
	check("id persists across frames until replaced", (() => { const st0 = emptySseState(); const a = parseSse(st0, "id: 1\ndata: a\n\n"); const b = parseSse(a.state, "data: b\n\n"); return b.events[0].id === "1"; })(), null);
	const init = { raw: "", events: [], seq: 0, baseSeq: 0, done: false, error: "", dropped: false, sse: emptySseState() };
	const f1 = foldStream(init, { chunks: [{ text: "data: 1\n\ndata: 2\n" }], seq: 10, baseSeq: 0, done: false, dropped: false, reset: false });
	check("foldStream keeps a partial tail event until it completes", f1.events.length === 1 && f1.seq === 10, f1);
	const f2 = foldStream(f1, { chunks: [{ text: "\n" }], seq: 11, baseSeq: 0, done: false, dropped: false, reset: false });
	check("foldStream emits the completed second event from the next beat", f2.events.length === 2, f2);
	const f3 = foldStream(f2, { chunks: [{ text: "data: late\n\n" }], seq: 99, baseSeq: 40, done: true, dropped: true, reset: true });
	check("foldStream reset replaces the window on evicted cursors", f3.events.length === 1 && f3.events[0].data === "late" && f3.done && f3.dropped, f3);
	check("sseEventLabel truncates long payloads", sseEventLabel({ data: "x".repeat(200) }).length === 120, null);
	// ApiView streaming branch: a streaming send swaps the response to the Events tab and pumps.
	const stGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, window: globalThis.window, document: globalThis.document };
	let stStage = 0;
	globalThis.fetch = async (_url, options) => {
		const wire = JSON.parse(options?.body ?? "{}");
		if (wire.url === undefined && wire.id !== undefined) {
			stStage++;
			if (stStage === 1) return { json: async () => ({ ok: true, value: { id: wire.id, seq: 26, baseSeq: 0, done: false, error: "", dropped: false, reset: false, chunks: [{ text: 'event: msg\ndata: {"n":1}\n\ndata: two\n\n' }] } }) };
			return { json: async () => ({ ok: true, value: { id: wire.id, seq: 26, baseSeq: 0, done: true, error: "", dropped: false, reset: false, chunks: [] } }) };
		}
		return { json: async () => ({ ok: true, value: { streaming: true, id: "9", status: 200, statusText: "OK", headers: [["content-type", "text/event-stream"]], seq: 0, baseSeq: 0, done: false, error: "", dropped: false, reset: false, chunks: [] } }) };
	};
	globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
	globalThis.cancelAnimationFrame = () => {};
	globalThis.setTimeout = () => 0;
	globalThis.clearTimeout = () => {};
	globalThis.window = { innerWidth: 1200, innerHeight: 900 };
	globalThis.document = { addEventListener() {}, removeEventListener() {} };
	try {
		const renderSt = createHookRenderer(ApiView, { t: (k) => k }, { effects: true });
		let stTree = renderSt();
		renderSt.flushEffects();
		const stNode = (p) => collect(stTree).find(p);
		const paintSt = () => { stTree = renderSt(); renderSt.flushEffects(); };
		stNode((n) => n.props.className === "ce-input cea-url").props.onChange({ target: { value: "https://e.test/stream" } }); paintSt();
		stNode((n) => n.props.className === "ce-sk-btn cea-send").props.onClick();
		await new Promise((r) => setImmediate(r)); paintSt();
		const tabLabels = () => collect(stTree).filter((n) => n.props.className?.startsWith("cea-tab")).map((n) => JSON.stringify(n.children));
		check("a streaming send switches the response to the Events tab", tabLabels().some((s) => s.includes("api.streamTab")), tabLabels());
		await new Promise((r) => setImmediate(r)); paintSt();
		await new Promise((r) => setImmediate(r)); paintSt();
		const sseRows = () => collect(stTree).filter((n) => n.type === "div" && n.props.className === "cea-sse-row");
		const rowTexts = (r) => JSON.stringify(r);
		const data0 = collect(sseRows()[0]).find((n) => n.type === "span" && n.props.className === "cea-sse-data").children[0];
		check("the pump renders one row per SSE event with kind and data", sseRows().length === 2 && JSON.stringify(collect(sseRows()[0])[1]).includes("msg") && data0 === '{"n":1}' && JSON.stringify(collect(sseRows()[1])[1]).includes("message"), data0);
		renderSt.unmount();
	} finally {
		Object.assign(globalThis, stGlobals);
	}
}

// --- M5 collection-on-disk: load to favorites + save-through checkbox -------------------
{
	const coGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, window: globalThis.window, document: globalThis.document };
	const coRequests = [];
	let coSavedSeen = null;
	globalThis.fetch = async (url, options) => {
		const body = JSON.parse(options?.body ?? "{}");
		coRequests.push({ url: String(url), body });
		if (url.endsWith("/collection.load")) return { json: async () => ({ ok: true, value: { dir: "collection", files: [{ path: "a.bru", text: "meta {\n  name: Alpha\n  type: http\n}\n\nget {\n  url: https://e.test/a\n}\n" }, { path: "ops/b.bru", text: "meta {\n  name: Bravo\n  type: http\n}\n\npost {\n  url: https://e.test/b\n}\n" }] } }) };
		if (url.endsWith("/collection.save")) return { json: async () => ({ ok: true, value: { path: `collection/${body.name}.bru`, mtimeMs: 5, created: true } }) };
		return { json: async () => ({ ok: true, value: {} }) };
	};
	globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
	globalThis.cancelAnimationFrame = () => {};
	globalThis.setTimeout = () => 0;
	globalThis.window = { innerWidth: 1200, innerHeight: 900 };
	globalThis.document = { addEventListener() {}, removeEventListener() {} };
	try {
		const renderCo = createHookRenderer(ApiView, { t: (k) => k, sessionId: "co", useSessions: (select) => select({ byId: { co: { cwd: "/w" } } }) }, { effects: true });
		let coTree = renderCo();
		renderCo.flushEffects();
		const coNode = (p) => collect(coTree).find(p);
		const paintCo = () => { coTree = renderCo(); renderCo.flushEffects(); };
		// settings tab: configure the collection folder, then load.
		coNode((n) => n.props.className?.startsWith("cea-config-tab") && n.children[0] === "api.settings").props.onClick(); paintCo();
		coNode((n) => n.props.placeholder === "api.collectionDirPlaceholder").props.onChange({ target: { value: "collection" } }); paintCo();
		coNode((n) => n.props.title === "api.collectionLoad").props.onClick();
		await new Promise((r) => setImmediate(r)); paintCo();
		check("collection.load lands .bru files into favorites", coRequests.some((r) => r.url.endsWith("/collection.load") && r.body.cwd === "/w" && r.body.dir === "collection"), coRequests.map((r) => r.url));
		await new Promise((r) => setImmediate(r)); paintCo();
		const favNames = () => {
			coNode((n) => n.props["data-ce-popup-trigger"] === "api-history").props.onClick(); paintCo();
			if (coNode((n) => n.props.className === "cea-tab" && JSON.stringify(n.children).includes("api.saved"))) { coNode((n) => n.props.className === "cea-tab" && JSON.stringify(n.children).includes("api.saved")).props.onClick(); paintCo(); }
			const rows = collect(coTree).filter((n) => n.type === "span" && n.props.className === "cea-hname").map((n) => n.children[0]);
			coNode((n) => n.props["data-ce-popup-trigger"] === "api-history").props.onClick(); paintCo();
			return rows;
		};
		check("loaded entries keep their .bru meta names", favNames().includes("★ Alpha") && favNames().includes("★ Bravo"), favNames());
		// favorite save with the collection checkbox on hits collection.save first.
		const urlIn = () => coNode((n) => n.props["aria-label"] === "api.urlPlaceholder" && n.props.className === "ce-input cea-url");
		urlIn().props.onChange({ target: { value: "https://e.test/new" } }); paintCo();
		check("url input holds the new value", urlIn().props.value === "https://e.test/new", urlIn()?.props?.value);
		coNode((n) => n.props["data-ce-popup-trigger"] === "api-save").props.onClick(); paintCo();
		const nameIn = () => coNode((n) => n.props["aria-label"] === "api.savePlaceholder");
		check("save dialog is open", Boolean(nameIn()), null);
		nameIn().props.onChange({ target: { value: "Delta" } }); paintCo();
		check("save name input holds Delta", nameIn().props.value === "Delta", nameIn()?.props?.value);
		const collCheck = collect(coTree).find((n) => n.type === "input" && n.props.type === "checkbox" && n.props.disabled === false);
		check("collection checkbox is enabled once a folder and session exist", Boolean(collCheck), null);
		const confirm = () => collect(coTree).find((n) => n.type === "button" && n.children?.[0] === "api.saveConfirm");
		check("confirm button is enabled with a name", confirm()?.props.disabled === false, confirm()?.props);
		// Enter in the (freshly rendered) name input runs the current doSaveFavorite closure.
		nameIn().props.onKeyDown({ key: "Enter", stopPropagation() {} });
		for (let i = 0; i < 4; i++) { await new Promise((r) => setImmediate(r)); paintCo(); }
		check("save-to-collection writes the .bru file through the host", coRequests.some((r) => r.url.endsWith("/collection.save") && r.body.name === "Delta" && r.body.dir === "collection" && r.body.cwd === "/w" && r.body.text.includes("https://e.test/new")));
		await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); paintCo();
		check("the favorite row is added alongside the file write", collect(coTree).some((n) => n.type === "span" && String(n.children?.[0] ?? "").includes("Delta")), favNames());
		renderCo.unmount();
	} finally {
		Object.assign(globalThis, coGlobals);
	}
}

// --- Terminal typing: focus handoff to the host xterm, no focus theft afterwards --------
{
	const { focusHostTerminal, scheduleTerminalFocus } = await import("./src/client/terminal.js");
	const makeScreen = ({ connected = true, hidden = false, disabled = false, withXterm = true } = {}) => {
		const doc = { activeElement: null };
		const textarea = { disabled, focus() { doc.activeElement = textarea; } };
		const xterm = { querySelector: (sel) => (sel === "textarea" ? textarea : null) };
		const screen = {
			isConnected: connected,
			closest: (sel) => (hidden && sel.includes("aria-hidden") ? {} : null),
			querySelector: (sel) => (sel === ".xterm" && withXterm ? xterm : null),
		};
		doc.querySelectorAll = () => [screen];
		return { doc, textarea, screen };
	};
	const live = makeScreen();
	check("focus handoff targets the host terminal textarea", focusHostTerminal(live.doc) === true && live.doc.activeElement === live.textarea, null);
	const hiddenScreen = makeScreen({ hidden: true });
	check("hidden terminal screens are never focused", focusHostTerminal(hiddenScreen.doc) === false && hiddenScreen.doc.activeElement === null, null);
	const detached = makeScreen({ connected: false });
	check("detached terminal screens are skipped", focusHostTerminal(detached.doc) === false, null);
	const noXterm = makeScreen({ withXterm: false });
	check("a terminal without a mounted xterm is left alone", focusHostTerminal(noXterm.doc) === false, null);
	const disabledTa = makeScreen({ disabled: true });
	check("read-only terminal textareas are not forced", focusHostTerminal(disabledTa.doc) === false, null);
	check("focus handoff survives a missing document", focusHostTerminal(undefined) === false, null);

	// Retry loop: waits for the shell to connect, stops on success and at the deadline.
	let clock = 0; const pending = new Map(); let nextId = 1;
	const setTimer = (fn) => { const id = nextId++; pending.set(id, fn); return id; };
	const clearTimer = (id) => pending.delete(id);
	const fireTimers = () => { for (const [id, fn] of [...pending]) { pending.delete(id); fn(); } };
	const late = makeScreen({ withXterm: false });
	const cancelLate = scheduleTerminalFocus({ doc: late.doc, setTimer, clearTimer, now: () => clock });
	fireTimers();
	check("focus retries while the terminal is still connecting", pending.size === 1 && late.doc.activeElement === null, pending.size);
	late.screen.querySelector = (sel) => (sel === ".xterm" ? { querySelector: () => late.textarea } : null);
	clock = 240; fireTimers();
	check("focus lands as soon as the xterm mounts and stops retrying", late.doc.activeElement === late.textarea && pending.size === 0, pending.size);
	cancelLate();
	const never = makeScreen({ withXterm: false });
	const cancelNever = scheduleTerminalFocus({ doc: never.doc, setTimer, clearTimer, now: () => clock });
	for (let i = 0; i < 40 && pending.size > 0; i++) { clock += 120; fireTimers(); }
	check("focus retries stop at the deadline instead of polling forever", pending.size === 0 && clock >= 3000, clock);
	cancelNever();
	const cancelled = makeScreen();
	const cancelIt = scheduleTerminalFocus({ doc: cancelled.doc, setTimer, clearTimer, now: () => clock });
	cancelIt(); fireTimers();
	check("cancelling the handoff prevents any later focus grab", cancelled.doc.activeElement === null && pending.size === 0, null);

	// Opening through the entry schedules the handoff (real timers stubbed out).
	const openGlobals = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, document: globalThis.document };
	const scheduled = [];
	globalThis.setTimeout = (fn, ms) => { scheduled.push(ms); return scheduled.length; };
	globalThis.clearTimeout = () => {};
	try {
		const opens = [];
		const entryDoc = makeScreen();
		globalThis.document = entryDoc.doc;
		const opening = createTerminalEntry({ sidebarRight: { mounted: { getSnapshot: () => "s1" }, openTab: (kind, opts) => opens.push([kind, opts]) }, sidebarRightTabs: fakeRegistry });
		check("successful terminal open schedules the keyboard handoff", opening.open().ok === true && scheduled.length === 1, scheduled);
		scheduled.length = 0;
		createTerminalEntry({ sidebarRight: { mounted: { getSnapshot: () => undefined }, openTab: () => {} }, sidebarRightTabs: fakeRegistry }).open();
		check("failed opens never schedule a focus grab", scheduled.length === 0, scheduled);
	} finally { Object.assign(globalThis, openGlobals); }

	// Dismiss layers must not steal Escape or focus from a focused host terminal.
	const termDismissListeners = new Map();
	const termLayerDoc = {
		activeElement: null,
		addEventListener(name, listener, capture) { termDismissListeners.set(name, { listener, capture }); },
		removeEventListener(name, listener) { if (termDismissListeners.get(name)?.listener === listener) termDismissListeners.delete(name); },
	};
	const termDismissGlobals = { document: globalThis.document };
	globalThis.document = termLayerDoc;
	try {
		let closed = 0; let editorRefocus = 0;
		const inside = {};
		const layerNode = { ownerDocument: termLayerDoc, isConnected: true, contains: (target) => target === inside, closest: () => null };
		const editorNode = { isConnected: true, focus() { editorRefocus++; } };
		const release = registerDismissLayer(termLayerDoc, { node: () => layerNode, dismiss: (reason) => { closed++; if (reason === "escape" && editorNode.isConnected !== false) editorNode.focus(); } });
		const terminalTarget = { closest: (sel) => (sel.includes("data-sidebar-terminal") ? {} : null) };
		const escapeInTerminal = { key: "Escape", target: terminalTarget, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
		termDismissListeners.get("keydown").listener(escapeInTerminal);
		check("Escape typed in the terminal closes the layer but reaches the shell", closed === 1 && !escapeInTerminal.defaultPrevented && !escapeInTerminal.stopped && editorRefocus === 0, { closed, editorRefocus });
		const escapeElsewhere = { key: "Escape", target: { closest: () => null }, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
		termDismissListeners.get("keydown").listener(escapeElsewhere);
		check("Escape outside the terminal keeps the guard and restores the editor", closed === 2 && escapeElsewhere.defaultPrevented && escapeElsewhere.stopped && editorRefocus === 1, { closed, editorRefocus });
		release();

		// Hook-level: after an outside click moved focus into the terminal, a
		// later Escape dismissal must not yank focus back to the opener.
		const { useDismissLayer } = await import("./src/client/dismiss.js");
		const terminalTextarea = { isConnected: true, focus() { termLayerDoc.activeElement = terminalTextarea; } };
		const openerInput = { isConnected: true, focus() { termLayerDoc.activeElement = openerInput; openerFocus++; } };
		let openerFocus = 0; let hookClosed = 0;
		termLayerDoc.activeElement = openerInput;
		const drawLayer = createHookRenderer(() => {
			const ref = useDismissLayer({ onDismiss: () => hookClosed++ });
			return { type: "div", props: { ref }, children: [] };
		}, {}, { effects: true });
		const layerEl = drawLayer();
		layerEl.props.ref.current = { ownerDocument: termLayerDoc, isConnected: true, contains: (target) => target === hookInside, closest: () => null };
		const hookInside = {};
		drawLayer.flushEffects();
		// The user clicks the terminal: pointer dismissal leaves focus alone.
		termDismissListeners.get("pointerdown").listener({ target: terminalTextarea, button: 0 });
		termLayerDoc.activeElement = terminalTextarea;
		check("outside pointer dismissal closes without touching terminal focus", hookClosed === 1 && openerFocus === 0, { hookClosed, openerFocus });
		drawLayer.unmount();
		// Re-open while the terminal owns focus; Escape then must keep it there.
		termLayerDoc.activeElement = terminalTextarea;
		const drawLayer2 = createHookRenderer(() => {
			const ref = useDismissLayer({ onDismiss: () => hookClosed++ });
			return { type: "div", props: { ref }, children: [] };
		}, {}, { effects: true });
		const layerEl2 = drawLayer2();
		layerEl2.props.ref.current = { ownerDocument: termLayerDoc, isConnected: true, contains: () => false, closest: () => null };
		drawLayer2.flushEffects();
		termDismissListeners.get("keydown").listener({ key: "Escape", target: { closest: () => null }, preventDefault() {}, stopPropagation() {} });
		check("Escape with focus already in the terminal never refocuses the workspace", hookClosed === 2 && openerFocus === 0 && termLayerDoc.activeElement === terminalTextarea, { hookClosed, openerFocus });
		drawLayer2.unmount();
		check("terminal dismiss regressions release their listeners", termDismissListeners.size === 0, termDismissListeners.size);
	} finally { Object.assign(globalThis, termDismissGlobals); }

	// A kept-mounted hidden Code tab must not focus its editor on reveal jumps
	// (Problems ⌘⇧M row / symbol palette pick), while a visible tab still does.
	const hiddenGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, window: globalThis.window, document: globalThis.document };
	globalThis.fetch = async (url) => {
		if (url.endsWith("/fs.read")) return { json: async () => ({ ok: true, value: { kind: "text", content: "package main\nfunc helper() {}\n", mtimeMs: 1 } }) };
		if (url.endsWith("/lsp.diagnostics")) return { json: async () => ({ ok: true, value: { items: [{ line: 2, col: 1, severity: 1, message: "e" }] } }) };
		return { json: async () => ({ ok: true, value: {} }) };
	};
	globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
	globalThis.cancelAnimationFrame = () => {};
	globalThis.setTimeout = () => 0;
	globalThis.clearTimeout = () => {};
	globalThis.window = { innerWidth: 1200, innerHeight: 900 };
	globalThis.document = { addEventListener() {}, removeEventListener() {} };
	try {
		let hiddenTab = { visible: false, actions: {} };
		let codeFocusCalls = 0;
		const fakeCodeArea = { focus() { codeFocusCalls++; }, scrollTop: 0, clientHeight: 600, querySelector: () => null, getBoundingClientRect: () => ({ top: 0 }) };
		const renderHidden = createHookRenderer(CodeBody, {
			sessionId: "hid",
			useSessions: (select) => select({ byId: { hid: { cwd: "/w" } } }),
			useTabInfo: () => ({ tab: hiddenTab }),
			t: (k) => k,
		}, { effects: true });
		const paintHidden = () => {
			let tree = renderHidden(); renderHidden.flushEffects(); tree = renderHidden();
			const area = collect(tree).find((n) => typeof n.props.className === "string" && n.props.className.split(" ").includes("ce-code"));
			if (area) area.props.ref.current = fakeCodeArea;
			return tree;
		};
		let hiddenTree = paintHidden();
		const getHidden = (test) => collect(hiddenTree).find(test);
		getHidden((n) => n.type === TreePanelCmp).props.onOpenFile("main.go", 1, 1);
		for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
		hiddenTree = paintHidden();
		check("hidden-tab fixture loaded the document and its diagnostics", getHidden((n) => n.props.className === "ce-head-path")?.children[0] === "main.go" && Boolean(getHidden((n) => typeof n.props.className === "string" && n.props.className.includes("ce-diag-btn"))), null);
		// Drive revealPosition through the ProblemsPanel props captured before any
		// flush: the hidden tab's visibility effect would dismiss a flushed panel.
		hiddenTree.props.onKeyDown({ code: "KeyM", metaKey: true, shiftKey: true, preventDefault() {} });
		hiddenTree = renderHidden();
		const hiddenPanel = getHidden((n) => n.type.name === "ProblemsPanel");
		check("problems panel opens on the hidden tab", Boolean(hiddenPanel), null);
		hiddenPanel.props.onPick({ line: 2, col: 1 });
		hiddenTree = paintHidden();
		check("reveal jumps from a hidden tab never grab keyboard focus", codeFocusCalls === 0, codeFocusCalls);
		hiddenTab = { visible: true, actions: {} };
		hiddenTree = paintHidden();
		hiddenTree.props.onKeyDown({ code: "KeyM", metaKey: true, shiftKey: true, preventDefault() {} });
		hiddenTree = paintHidden();
		const visiblePanel = getHidden((n) => n.type.name === "ProblemsPanel");
		check("problems panel reopens on the visible tab", Boolean(visiblePanel), null);
		visiblePanel.props.onPick({ line: 2, col: 1 });
		hiddenTree = paintHidden();
		check("visible tabs still focus the editor on reveal jumps", codeFocusCalls === 1, codeFocusCalls);
		renderHidden.unmount();
	} finally { Object.assign(globalThis, hiddenGlobals); }

	// Terminal refresh guard: dropped-refresh heal via synthetic textarea blur.
	const { refreshHostTerminalScreen, installTerminalRefreshGuard } = await import("./src/client/terminal.js");
	const makeGuardScreen = ({ connected = true, hidden = false, withTa = true } = {}) => {
		const events = [];
		const textarea = { dispatchEvent(ev) { events.push(ev.type); return true; } };
		const screen = {
			isConnected: connected,
			closest: (sel) => (hidden && /aria-hidden|hidden|inert/.test(sel) ? {} : null),
			querySelector: (sel) => (sel === ".xterm textarea" && withTa ? textarea : null),
		};
		return { screen, textarea, events };
	};
	const FakeFocusEvent = class { constructor(type) { this.type = type; } };
	const gLive = makeGuardScreen();
	check("refresh guard dispatches blur on a live terminal textarea", refreshHostTerminalScreen(gLive.screen, FakeFocusEvent) === true && gLive.events.join() === "blur", gLive.events);
	const gHidden = makeGuardScreen({ hidden: true });
	check("refresh guard skips hidden terminals", refreshHostTerminalScreen(gHidden.screen) === false && gHidden.events.length === 0, null);
	const gDetached = makeGuardScreen({ connected: false });
	check("refresh guard skips detached terminals", refreshHostTerminalScreen(gDetached.screen) === false, null);
	const gNoTa = makeGuardScreen({ withTa: false });
	check("refresh guard skips terminals without a textarea", refreshHostTerminalScreen(gNoTa.screen) === false, null);
	check("refresh guard survives a missing screen", refreshHostTerminalScreen(null) === false, null);

	// Guard lifecycle: IO entry schedules one delayed blur per burst; resize
	// schedules visible screens; disposer removes everything.
	{
		const guardTimers = new Map(); let guardNextId = 1;
		const gSetTimer = (fn) => { const id = guardNextId++; guardTimers.set(id, fn); return id; };
		const gClearTimer = (id) => guardTimers.delete(id);
		const fireGuardTimers = () => { for (const [id, fn] of [...guardTimers]) { guardTimers.delete(id); fn(); } };
		let ioCallback = null; const ioObserved = [];
		class FakeIO { constructor(cb) { ioCallback = cb; } observe(el) { ioObserved.push(el); } disconnect() { ioObserved.length = 0; } }
		let moCallback = null;
		class FakeMO { constructor(cb) { moCallback = cb; } observe() {} disconnect() { moCallback = null; } }
		const gScreenA = makeGuardScreen();
		const gScreenB = makeGuardScreen();
		const gDoc = {
			body: {},
			querySelectorAll: (sel) => (sel === "[data-sidebar-terminal]" ? [gScreenA.screen, gScreenB.screen] : []),
		};
		const resizeListeners = [];
		const gView = { addEventListener: (n, fn) => resizeListeners.push([n, fn]), removeEventListener: (n, fn) => { const i = resizeListeners.findIndex(([nn, ff]) => nn === n && ff === fn); if (i >= 0) resizeListeners.splice(i, 1); } };
		const savedFO = globalThis.FocusEvent;
		globalThis.FocusEvent = class { constructor(type) { this.type = type; } };
		try {
			const dispose = installTerminalRefreshGuard({ doc: gDoc, view: gView, setTimer: gSetTimer, clearTimer: gClearTimer, IO: FakeIO, MO: FakeMO });
			check("guard observes existing terminal screens", ioObserved.length === 2, ioObserved.length);
			// IO burst: both become visible -> one timer, both blurred on flush.
			ioCallback([{ isIntersecting: true, target: gScreenA.screen }, { isIntersecting: true, target: gScreenB.screen }]);
			ioCallback([{ isIntersecting: true, target: gScreenA.screen }]);
			check("guard coalesces a visibility burst into one timer", guardTimers.size === 1, guardTimers.size);
			fireGuardTimers();
			check("guard repaints every screen in the burst", gScreenA.events.join() === "blur" && gScreenB.events.join() === "blur", [gScreenA.events, gScreenB.events]);
			// Non-intersecting entries never schedule.
			gScreenA.events.length = 0; gScreenB.events.length = 0;
			ioCallback([{ isIntersecting: false, target: gScreenA.screen }]);
			check("guard ignores off-viewport entries", guardTimers.size === 0, null);
			// Resize schedules visible screens.
			resizeListeners.find(([n]) => n === "resize")[1]();
			fireGuardTimers();
			check("guard repaints on window resize settle", gScreenA.events.length === 1 && gScreenB.events.length === 1, null);
			// MutationObserver picks up newly mounted screens.
			const gScreenC = makeGuardScreen();
			gDoc.querySelectorAll = () => [gScreenA.screen, gScreenB.screen, gScreenC.screen];
			moCallback();
			check("guard observes terminals mounted after install", ioObserved.includes(gScreenC.screen), ioObserved.length);
			dispose();
			check("guard disposer clears timers, observers and listeners", guardTimers.size === 0 && ioObserved.length === 0 && resizeListeners.length === 0 && moCallback === null, null);
		} finally {
			if (savedFO === undefined) delete globalThis.FocusEvent; else globalThis.FocusEvent = savedFO;
		}
	}

	// Terminal refresh nudge: periodic blur while focused catches mid-typing stale rows.
	const { installTerminalRefreshNudge } = await import("./src/client/terminal.js");
	{
		const nudgeTimers = new Map(); let nudgeNextId = 1;
		const nSetTimer = (fn, ms) => { const id = nudgeNextId++; nudgeTimers.set(id, fn); return id; };
		const nClearTimer = (id) => nudgeTimers.delete(id);
		const fireNudgeTimers = () => { for (const [id, fn] of [...nudgeTimers]) { nudgeTimers.delete(id); fn(); } };
		const focusListeners = [];
		const nTextarea = { dispatchEvent(ev) { nEvents.push(ev.type); return true; }, closest: (sel) => (sel === ".xterm" ? {} : null) };
		const nEvents = [];
		const nScreen = {
			isConnected: true,
			closest: () => null,
			querySelector: (sel) => (sel === ".xterm textarea" ? nTextarea : null),
		};
		const nDoc = {
			activeElement: null,
			querySelectorAll: () => [nScreen],
			addEventListener: (n, fn, cap) => focusListeners.push([n, fn, cap]),
			removeEventListener: (n, fn) => { const i = focusListeners.findIndex(([nn, ff]) => nn === n && ff === fn); if (i >= 0) focusListeners.splice(i, 1); },
		};
		const savedFE2 = globalThis.FocusEvent;
		globalThis.FocusEvent = class { constructor(type) { this.type = type; } };
		try {
			const dispose = installTerminalRefreshNudge({ doc: nDoc, setTimer: nSetTimer, clearTimer: nClearTimer, intervalMs: 100 });
			check("nudge installs focusin/focusout capture listeners", focusListeners.length === 2 && focusListeners.every(([, , cap]) => cap === true), focusListeners.length);
			// Focus the terminal textarea -> nudge starts ticking.
			nDoc.activeElement = nTextarea;
			focusListeners.find(([n]) => n === "focusin")[1]({ target: nTextarea });
			check("nudge starts timer on terminal focus", nudgeTimers.size === 1, nudgeTimers.size);
			fireNudgeTimers();
			check("nudge fires blur on the focused terminal screen", nEvents.join() === "blur", nEvents);
			check("nudge reschedules after firing", nudgeTimers.size === 1, nudgeTimers.size);
			// Focus leaves to a non-terminal element -> nudge stops.
			nDoc.activeElement = {};
			focusListeners.find(([n]) => n === "focusout")[1]({ target: nTextarea, relatedTarget: {} });
			fireNudgeTimers();
			check("nudge stops when focus leaves the terminal", nudgeTimers.size === 0 && nEvents.length === 1, nEvents.length);
			// Focus moves within xterm (e.g. to another part) -> nudge continues.
			nDoc.activeElement = nTextarea;
			focusListeners.find(([n]) => n === "focusin")[1]({ target: nTextarea });
			const xtermChild = { closest: (sel) => (sel === ".xterm" ? {} : null) };
			focusListeners.find(([n]) => n === "focusout")[1]({ target: nTextarea, relatedTarget: xtermChild });
			check("nudge keeps running when focus stays within xterm", nudgeTimers.size === 1, nudgeTimers.size);
			dispose();
			fireNudgeTimers();
			check("nudge disposer clears timers and listeners", nudgeTimers.size === 0 && focusListeners.length === 0, null);
		} finally {
			if (savedFE2 === undefined) delete globalThis.FocusEvent; else globalThis.FocusEvent = savedFE2;
		}
	}
}

// --- hover tooltip + VS Code click model -----------------------------------------------
{
	const hoverGlobals = { fetch: globalThis.fetch, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, window: globalThis.window, document: globalThis.document };
	const lspCalls = [];
	let hoverAnswer = "func helper()";
	let timers = [];
	globalThis.fetch = async (url, options) => {
		const body = JSON.parse(options?.body ?? "{}");
		if (url.endsWith("/fs.read")) return { json: async () => ({ ok: true, value: { kind: "text", content: "package main\nfunc helper() {}\n", mtimeMs: 1 } }) };
		if (url.endsWith("/lsp.request")) {
			lspCalls.push(body);
			if (body.kind === "hover") return { json: async () => ({ ok: true, value: { hover: hoverAnswer } }) };
			return { json: async () => ({ ok: true, value: { symbols: [], targets: [] } }) };
		}
		if (url.endsWith("/lsp.diagnostics")) return { json: async () => ({ ok: true, value: { items: [] } }) };
		if (url.endsWith("/lsp.status")) return { json: async () => ({ ok: true, value: { state: "ready", label: "gopls" } }) };
		if (url.endsWith("/git.status")) return { json: async () => ({ ok: true, value: { repo: false } }) };
		return { json: async () => ({ ok: true, value: {} }) };
	};
	globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
	globalThis.cancelAnimationFrame = () => {};
	globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms, fired: false }); return timers.length; };
	globalThis.clearTimeout = (id) => { if (typeof id === "number" && timers[id - 1]) timers[id - 1].cancelled = true; };
	globalThis.window = { innerWidth: 1200, innerHeight: 900 };
	globalThis.document = { addEventListener() {}, removeEventListener() {} };
	try {
		const render = createHookRenderer(CodeBody, { sessionId: "hov", useSessions: (select) => select({ byId: { hov: { cwd: "/w" } } }), t: (k) => k }, { effects: true });
		let tree = render();
		render.flushEffects();
		const fire350 = () => { const due = timers.filter((t) => !t.fired && !t.cancelled && t.ms === 350); due.forEach((t) => { t.fired = true; }); for (const t of due) t.fn(); };
		const paint = () => { tree = render(); render.flushEffects(); };
		const tick = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); paint(); };
		const get = (test) => collect(tree).find(test);
		const area = () => get((n) => typeof n.props.className === "string" && n.props.className.split(" ").includes("ce-code"));
		await tick();
		get((n) => n.type === TreePanelCmp).props.onOpenFile("main.go", 1, 1);
		await tick();
		const tokenTarget = { dataset: { ceL: "2", ceC: "6", ceW: "helper" }, classList: { contains: () => false }, closest: (sel) => (sel === "[data-ce-l]" ? tokenTarget : null) };
		const kwTarget = { dataset: { ceL: "2", ceC: "1", ceW: "func" }, classList: { contains: (c) => c === "ce-kw" }, closest: (sel) => (sel === "[data-ce-l]" ? kwTarget : null) };
		const callsBefore = lspCalls.length;
		const hoverCalls = () => lspCalls.filter((c) => c.kind === "hover" && c.line === 2 && c.col === 6).length;
		// Plain click places the cursor without any LSP request or peek.
		area().props.onClick({ target: tokenTarget, metaKey: false, ctrlKey: false });
		await tick();
		check("plain click fires no LSP request", lspCalls.length === callsBefore, [lspCalls.length, callsBefore]);
		check("plain click opens no refs peek", !get((n) => n.type.name === "RefsPeek"), null);
		// Hover: resting on a token for 350ms asks for the hover document.
		const hoverBefore = hoverCalls();
		area().props.onMouseMove({ target: tokenTarget });
		check("hover does not request before the delay", hoverCalls() === hoverBefore, [hoverCalls(), hoverBefore]);
		fire350();
		await tick();
		check("hover requests after the 350ms rest", hoverCalls() === hoverBefore + 1, [hoverCalls(), hoverBefore]);
		check("hover tooltip renders the server document", get((n) => n.props.className === "ce-hover")?.children[0] === "func helper()", get((n) => n.props.className === "ce-hover")?.children);
		// Moving to another token restarts the delay and hides the old tooltip.
		area().props.onMouseMove({ target: { dataset: { ceL: "2", ceC: "13", ceW: "other" }, classList: { contains: () => false }, closest: (sel) => (sel === "[data-ce-l]" ? { dataset: { ceL: "2", ceC: "13", ceW: "other" }, classList: { contains: () => false } } : null) } });
		paint();
		check("moving tokens hides the stale tooltip", !get((n) => n.props.className === "ce-hover"), null);
		// Leaving the code area cancels a pending request.
		area().props.onMouseMove({ target: tokenTarget });
		area().props.onMouseLeave();
		fire350();
		await tick();
		check("mouseleave cancels the pending hover request", !get((n) => n.props.className === "ce-hover"), null);
		// Keywords never hover.
		const hoverCount = lspCalls.filter((c) => c.kind === "hover").length;
		area().props.onMouseMove({ target: kwTarget });
		fire350();
		await tick();
		check("keywords are not hovered", lspCalls.filter((c) => c.kind === "hover").length === hoverCount, null);
		// Empty hover answers render nothing.
		hoverAnswer = "";
		area().props.onMouseMove({ target: tokenTarget });
		fire350();
		await tick();
		check("empty hover answer shows no tooltip", !get((n) => n.props.className === "ce-hover"), null);
		// ⌘/Ctrl+click still jumps to definition.
		const defBefore = lspCalls.filter((c) => c.kind === "definition").length;
		area().props.onClick({ target: tokenTarget, metaKey: true, ctrlKey: false });
		await tick();
		check("cmd-click still jumps to definition", lspCalls.filter((c) => c.kind === "definition").length === defBefore + 1, null);
		render.unmount();
	} finally { Object.assign(globalThis, hoverGlobals); }
}

// --- API store: per-workspace scoping + secret refs ------------------------------------
{
	const { apiKey, workspaceScope, legacyApiKey, migrateLegacyApiStores, collectSecretRefs, resolveSecrets, isSecretRef, secretRef, secretId } = await import("./src/client/apistore.js");
	check("workspaceScope encodes a path safely", workspaceScope("/Users/me/proj") === encodeURIComponent("/Users/me/proj"), workspaceScope("/Users/me/proj"));
	check("workspaceScope empty → global", workspaceScope("") === "global" && workspaceScope(undefined) === "global", null);
	check("apiKey produces scoped keys", apiKey("draft", "/w") === `dsh.ce.api.draft.v2.${encodeURIComponent("/w")}`, apiKey("draft", "/w"));
	check("legacyApiKey matches old global keys", legacyApiKey("draft") === "dsh.ce.api.draft.v1" && legacyApiKey("env") === "dsh.ce.api.env.v1", null);
	// Migration: legacy global stores move into the first workspace.
	const fakeStorage = { _data: {}, getItem(k) { return Object.hasOwn(this._data, k) ? this._data[k] : null; }, setItem(k, v) { this._data[k] = String(v); }, removeItem(k) { delete this._data[k]; } };
	fakeStorage._data["dsh.ce.api.draft.v1"] = '{"method":"POST"}';
	fakeStorage._data["dsh.ce.api.history.v1"] = '[{"id":"h1"}]';
	const moved = migrateLegacyApiStores("/first-ws", fakeStorage);
	check("migration moves legacy stores to the first workspace", moved.includes("draft") && moved.includes("history"), moved);
	check("migration leaves the legacy keys empty", fakeStorage.getItem("dsh.ce.api.draft.v1") === null, null);
	check("migration writes the new scoped key", fakeStorage.getItem(apiKey("draft", "/first-ws")) === '{"method":"POST"}', null);
	check("migration sets the flag so it never runs again", fakeStorage.getItem("dsh.ce.api.migrated.v1") !== null, null);
	const movedAgain = migrateLegacyApiStores("/second-ws", fakeStorage);
	check("second workspace does not re-migrate", movedAgain.length === 0, movedAgain);
	// Secret refs
	check("isSecretRef detects markers", isSecretRef("secret:abc-123") && !isSecretRef("plain text") && !isSecretRef(""), null);
	check("secretRef builds marker", secretRef("abc") === "secret:abc", null);
	check("secretId extracts id", secretId("secret:xyz") === "xyz" && secretId("plain") === null, null);
	// collectSecretRefs walks auth and env vars
	const refs = collectSecretRefs({ auth: { token: "secret:t1", pass: "plain" }, envs: [{ id: "e1", vars: [{ name: "DB", value: "secret:e2" }] }] });
	check("collectSecretRefs finds auth.token and env var refs", refs.includes("t1") && refs.includes("e2") && !refs.includes("plain"), refs);
	// resolveSecrets replaces markers with lookup values
	const resolved = resolveSecrets({ auth: { mode: "bearer", token: "secret:t1", pass: "keep" }, envs: [{ id: "e1", vars: [{ name: "DB", value: "secret:e2" }] }] }, { t1: "real-token", e2: "real-pass" });
	check("resolveSecrets substitutes known refs", resolved.auth.token === "real-token" && resolved.auth.pass === "keep" && resolved.envs[0].vars[0].value === "real-pass", resolved);
	check("resolveSecrets unknown ref → empty string", resolveSecrets({ auth: { token: "secret:gone" } }, {}).auth.token === "", null);
	check("resolveSecrets does not mutate input", (() => { const o = { auth: { token: "secret:x" } }; resolveSecrets(o, { x: "y" }); return o.auth.token; })() === "secret:x", null);
}

// --- localStorage orphan cleanup -------------------------------------------------------
{
	const { pruneOrphanKeys, resetOrphanCleanup } = await import("./src/client/orphans.js");
	const fakeStorage = {
		_data: {},
		get length() { return Object.keys(this._data).length; },
		key(i) { return Object.keys(this._data)[i] ?? null; },
		getItem(k) { return Object.hasOwn(this._data, k) ? this._data[k] : null; },
		setItem(k, v) { this._data[k] = String(v); },
		removeItem(k) { delete this._data[k]; },
	};
	// Seed: two live sessions, one dead session, plus unrelated keys.
	fakeStorage._data["dsh.plugin-kit.v1.session-A"] = '{"path":"a.go"}';
	fakeStorage._data["dsh.plugin-kit.v1.session-B"] = '{"path":"b.go"}';
	fakeStorage._data["dsh.plugin-kit.v1.session-DEAD"] = '{"path":"dead.go"}';
	fakeStorage._data["dsh.plugin-kit.browser.tabs.v2.session-A.tab1"] = '{"tabs":[]}';
	fakeStorage._data["dsh.plugin-kit.browser.tabs.v2.session-DEAD.tab2"] = '{"tabs":[]}';
	fakeStorage._data["unrelated.key"] = "keep me";
	fakeStorage._data["dsh.other-plugin.session-DEAD"] = "not ours";
	resetOrphanCleanup(fakeStorage);
	const removed = pruneOrphanKeys(["session-A", "session-B"], fakeStorage);
	check("orphan cleanup removes dead session nav key", !Object.hasOwn(fakeStorage._data, "dsh.plugin-kit.v1.session-DEAD"), null);
	check("orphan cleanup removes dead session browser tab key", !Object.hasOwn(fakeStorage._data, "dsh.plugin-kit.browser.tabs.v2.session-DEAD.tab2"), null);
	check("orphan cleanup keeps live session keys", Object.hasOwn(fakeStorage._data, "dsh.plugin-kit.v1.session-A") && Object.hasOwn(fakeStorage._data, "dsh.plugin-kit.browser.tabs.v2.session-A.tab1"), null);
	check("orphan cleanup leaves unrelated keys untouched", fakeStorage._data["unrelated.key"] === "keep me" && fakeStorage._data["dsh.other-plugin.session-DEAD"] === "not ours", null);
	check("orphan cleanup reports correct removal count", removed === 2, removed);
	check("orphan cleanup sets the flag so it never runs again", fakeStorage.getItem("dsh.plugin-kit.orphans.cleaned") !== null, null);
	const removedAgain = pruneOrphanKeys(["session-A"], fakeStorage);
	check("second call is a no-op (flag set)", removedAgain === 0 && Object.hasOwn(fakeStorage._data, "dsh.plugin-kit.v1.session-B"), removedAgain);
	resetOrphanCleanup(fakeStorage);
	const removedEmpty = pruneOrphanKeys([], fakeStorage);
	check("empty live set prunes all remaining plugin keys", removedEmpty === 3 && !Object.hasOwn(fakeStorage._data, "dsh.plugin-kit.v1.session-A") && !Object.hasOwn(fakeStorage._data, "dsh.plugin-kit.v1.session-B"), removedEmpty);
}

// --- edit-mode helpers: gutter, Tab indent, find/replace ---------------------------------
{
	const { buildEditGutter, handleTabIndent, findInText, replaceInText } = await import("./src/client/editmode.js");
	// Gutter
	const g = buildEditGutter(3);
	check("edit gutter has one row per line", g.length === 3 && g[0].line === 1 && g[2].line === 3 && g[1].top === 22, g);
	check("edit gutter empty for zero lines", buildEditGutter(0).length === 0, null);
	// Tab indent
	const tab1 = handleTabIndent("hello\nworld", 0, 0, false);
	check("Tab at line start inserts a tab", tab1.text === "\thello\nworld" && tab1.start === 1 && tab1.end === 1, tab1);
	const tab2 = handleTabIndent("\thello\n\tworld", 1, 1, true);
	check("Shift-Tab removes leading tab", tab2.text === "hello\n\tworld" && tab2.start === 0 && tab2.end === 0, tab2);
	const tab3 = handleTabIndent("    hello", 2, 2, true);
	check("Shift-Tab removes up to 4 spaces", tab3.text === "hello" && tab3.start === 0, tab3);
	const tab4 = handleTabIndent("a\nb\nc", 0, 3, false);
	check("Tab on multi-line selection indents all touched lines", tab4.text === "\ta\n\tb\nc" && tab4.start === 1 && tab4.end === 5, tab4);
	// Find
	const f1 = findInText("abc abc abc", "abc");
	check("findInText finds all occurrences", f1.length === 3 && f1[0].start === 0 && f1[2].end === 11, f1);
	const f2 = findInText("ABC abc", "abc", { caseSensitive: true });
	check("findInText respects case sensitivity", f2.length === 1 && f2[0].start === 4, f2);
	const f3 = findInText("cat catalog", "cat", { words: true });
	check("findInText whole-word skips partial matches", f3.length === 1 && f3[0].start === 0, f3);
	const f4 = findInText("a.b c", "a\\.b", { regex: true });
	check("findInText regex mode works", f4.length === 1 && f4[0].start === 0, f4);
	check("findInText empty query returns []", findInText("hello", "").length === 0, null);
	// Replace
	const r1 = replaceInText("abc abc", "abc", "X", {}, 0, false);
	check("replaceInText single replaces first match", r1.text === "X abc" && r1.count === 1, r1);
	const r2 = replaceInText("abc abc", "abc", "X", {}, 0, true);
	check("replaceInText all replaces every match", r2.text === "X X" && r2.count === 2, r2);
	const r3 = replaceInText("no match here", "xyz", "X", {}, 0, true);
	check("replaceInText no match returns original", r3.text === "no match here" && r3.count === 0, r3);
	const r4 = replaceInText("hello world", "(\\w+) (\\w+)", "$2 $1", { regex: true }, 0, false);
	check("replaceInText regex group refs work", r4.text === "world hello" && r4.count === 1, r4);
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
