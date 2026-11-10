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
const panel = ChangesPanel({
	cwd: "/w", t: (k) => k, git: fakeGit, repos: null, repoSel: null, onSelectRepo: noop,
	commitsOpen: false, setCommitsOpen: noop, onOpenCommit: noop, onOpenDiff: noop,
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
const commitBox = panelNodes.find((n) => n.props?.className === "ce-commitbox");
check("commit box rendered", Boolean(commitBox), null);
const commitBtn = collect(commitBox ?? []).find((n) => n.props?.className === "ce-commitbox-btn");
check("commit button targets the staged set", commitBtn && commitBtn.children.some((c) => String(c) === "✓ changes.commit"), commitBtn?.children);
const commitInput = collect(commitBox ?? []).find((n) => n.props?.className === "ce-input ce-commitbox-msg");
check("commit input placeholder for staged mode", commitInput?.props?.placeholder === "changes.commitPlaceholder", commitInput?.props);
const amendBtn = collect(commitBox ?? []).find((n) => n.type === "button" && n.props?.title === "changes.amendTitle");
check("commit box carries the amend toggle", Boolean(amendBtn) && amendBtn.children.includes("changes.amend"), amendBtn?.children);
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

// --- search match highlighting -----------------------------------------------------------------
const { matchRanges, highlightText } = await import("./src/client/overlays.js");
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
const { parseCurl, toCurl, substituteVars, buildEnvMap, shellQuote } = await import("./src/client/apiclient.js");
const c1 = parseCurl("curl -X POST 'https://a.b/c?d=1' -H 'Content-Type: application/json' -H 'X-T: v' --data '{\"x\":1}'");
check("parseCurl post json", c1.method === "POST" && c1.url === "https://a.b/c?d=1" && c1.headers.length === 2 && c1.body === '{"x":1}', c1);
const c2 = parseCurl("curl https://a.b/x \\\n  -H 'A: b' \\\n  -u user:pass");
check("parseCurl continuation + basic auth", c2.method === "GET" && c2.headers.some((hd) => hd.name === "Authorization" && hd.value.startsWith("Basic ")) && c2.headers.some((hd) => hd.name === "A" && hd.value === "b"), c2);
const c3 = parseCurl("curl -G https://a.b/s -d 'q=1' -d 'r=2'");
check("parseCurl -G appends query", c3.method === "GET" && c3.url === "https://a.b/s?q=1&r=2" && c3.body === "", c3);
const c4 = parseCurl("curl --json '{\"a\":1}' https://a.b/j");
check("parseCurl --json implies POST + content type", c4.method === "POST" && c4.headers.some((hd) => hd.name.toLowerCase() === "content-type" && hd.value === "application/json"), c4);

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
