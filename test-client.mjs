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
check("fileTint maps extensions", fileTint("x.go") === "cet-go" && fileTint("y.json") === "cet-json" && fileTint("z.unknown") === "cet-file", [fileTint("x.go"), fileTint("z.unknown")]);

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
const Launch = makeLauncher({ registry: fakeRegistry, sidebarRight: { openTab: () => {} }, getShortcuts: () => null, t: (k) => k });
check("launcher renders element", Launch({}) != null, null);
check("launcher null on empty registry", makeLauncher({ registry: { entries: () => [] }, sidebarRight: { openTab: () => {} }, getShortcuts: () => null, t: (k) => k })({}) === null, null);

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
		JSON.stringify(descriptor?.inject) === JSON.stringify(["slots", "locale", "sidebarRightTabs", "sidebarRight"]),
	descriptor?.inject,
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
