// Drives the host half through a fake webServer to exercise every route.
import { Readable } from "node:stream";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const fixture = "/tmp/ce-test";
const cleanupFixture = () => { try { rmSync(fixture, { recursive: true, force: true }); } catch {} };
cleanupFixture();
mkdirSync(`${fixture}/pkg`, { recursive: true });
writeFileSync(`${fixture}/go.mod`, "module example.com/ce\n\ngo 1.22\n");
writeFileSync(`${fixture}/main.go`, 'package main\n\nimport "fmt"\n\n// helper adds two numbers.\nfunc helper(a, b int) int {\n\treturn a + b\n}\n\nfunc main() {\n\tfmt.Println(helper(1, 2))\n}\n');
writeFileSync(`${fixture}/pkg/svc.go`, 'package pkg\n\ntype Greeter struct{}\n\nfunc (Greeter) Hello() string { return "hello" }\n');
const git = (args) => execFileSync("git", args, { cwd: fixture, stdio: "ignore" });
git(["init", "-q"]);
git(["config", "user.email", "t@t"]);
git(["config", "user.name", "t"]);
git(["add", "-A"]);
git(["commit", "-qm", "init"]);
appendFileSync(`${fixture}/main.go`, "modified\n");
git(["add", "main.go"]);
git(["commit", "-qm", "second commit"]);
git(["checkout", "-qb", "feature"]);
appendFileSync(`${fixture}/pkg/svc.go`, "dirty\n");
appendFileSync(`${fixture}/main.go`, "\nvar version = \"0.1\"\n");
git(["add", "main.go"]);
git(["commit", "-qm", "add version var"]);
writeFileSync(`${fixture}/extra.txt`, "new untracked\n");
process.on("exit", cleanupFixture);

const registered = [];
const cleanups = [];

const ctx = {
	inject(names, cb) {
		cb(ctx);
	},
	effect(fn) {
		const cleanup = fn();
		if (typeof cleanup === "function") cleanups.push(cleanup);
		return () => {};
	},
	webServer: {
		register(route) {
			registered.push(route);
			return () => {};
		},
	},
	skills: {
		list: async () => [{ name: "registry-fake", description: "from registry", provider: "office-plugin" }],
	},
};

const { apply } = await import("./index.js");
apply(ctx);

if (registered.length !== 1) throw new Error(`expected one route, got ${registered.length}`);
const handler = registered[0].handler;
const PREFIX = registered[0].path;

function call(route, body) {
	return new Promise((resolvePromise) => {
		const req = Readable.from([JSON.stringify(body)]);
		req.method = "POST";
		req.url = `${PREFIX}/${route}`;
		req.destroy = req.destroy ?? (() => {});
		let out = null;
		const res = {
			writeHead() {},
			end(text) {
				out = text;
				resolvePromise(JSON.parse(out));
			},
		};
		handler(req, res);
	});
}

const cwd = "/tmp/ce-test";
let pass = 0;
let fail = 0;
let skipped = 0;
function check(name, cond, extra) {
	if (cond) {
		pass++;
		console.log(`  ok  ${name}`);
	} else {
		fail++;
		console.log(`FAIL  ${name}${extra ? ` → ${JSON.stringify(extra)}` : ""}`);
	}
}

// gopls-backed assertions skip instead of failing where gopls is not
// installed, so the suite runs anywhere; CI installs gopls to activate them.
function hasGopls() {
	try {
		if (spawnSync("gopls", ["version"], { stdio: "ignore" }).status === 0) return true;
	} catch {}
	const home = homedir();
	return [join(home, "gopath", "bin", "gopls"), join(home, "go", "bin", "gopls"), "/opt/homebrew/bin/gopls", "/usr/local/bin/gopls"].some((p) => existsSync(p));
}
const goplsOn = hasGopls();
function checkLsp(name, cond, extra) {
	if (!goplsOn) {
		skipped++;
		console.log(`  skip  ${name} (gopls not installed)`);
		return;
	}
	check(name, cond, extra);
}

const listing = await call("fs.list", { cwd, path: "" });
check("fs.list", listing.ok && listing.value.entries.some((e) => e.name === "main.go"), listing);

const read = await call("fs.read", { cwd, path: "main.go" });
check("fs.read text", read.ok && read.value.kind === "text" && read.value.content.includes("func main"), read);

const outside = await call("fs.read", { cwd, path: "../../etc/passwd" });
check("fs.read fence", outside.ok === false, outside);

const status = await call("git.status", { cwd });
check(
	"git.status",
	status.ok && status.value.repo === true && status.value.branch === "feature" && (status.value.base?.name === "master" || status.value.base?.name === "main") && status.value.working.some((f) => f.path === "extra.txt" && f.xy === "??") && status.value.working.some((f) => f.path === "pkg/svc.go") && status.value.branchFiles.includes("main.go"),
	status,
);

const diffWorking = await call("git.diff", { cwd, path: "extra.txt", scope: "working" });
check("git.diff untracked synthesized", diffWorking.ok && diffWorking.value.untracked === true && diffWorking.value.diff.includes("new untracked"), diffWorking);

const diffBranch = await call("git.diff", { cwd, path: "main.go", scope: "branch" });
check("git.diff vs base", diffBranch.ok && diffBranch.value.diff.includes("@@") && diffBranch.value.base, diffBranch);

const def = await call("lsp.request", { cwd, path: "main.go", kind: "definition", line: 11, col: 15 });
checkLsp(
	"lsp definition → helper",
	def.ok && Array.isArray(def.value.targets) && def.value.targets.some((t) => t.path.endsWith("main.go") && t.line === 6) && def.value.status?.state === "ready",
	def,
);

const refs = await call("lsp.request", { cwd, path: "main.go", kind: "references", line: 6, col: 6 });
checkLsp("lsp references helper", refs.ok && refs.value.targets.length >= 1 && refs.value.targets.every((t) => t.snippet !== undefined), refs);

const hov = await call("lsp.request", { cwd, path: "pkg/svc.go", kind: "hover", line: 5, col: 13 });
checkLsp("lsp hover hello", hov.ok && typeof hov.value.hover === "string", hov);

const nonGo = await call("lsp.request", { cwd, path: "go.mod", kind: "definition", line: 1, col: 1 });
check("lsp non-go guarded", nonGo.ok && nonGo.value.targets.length === 0, nonGo);

const diag = await call("lsp.diagnostics", { cwd, path: "main.go" });
check("lsp diagnostics shape", diag.ok && Array.isArray(diag.value.items), diag);

const stat = await call("lsp.status", { cwd });
checkLsp("lsp status ready", stat.ok && stat.value.state === "ready", stat);
check("lsp status carries progress field", stat.ok && typeof (stat.value.progress ?? "") === "string", stat);

const sym = await call("lsp.request", { cwd, path: "main.go", kind: "symbol", line: 1, col: 1 });
checkLsp("documentSymbol lists helper & main", sym.ok && sym.value.symbols.some((s) => s.name === "helper" && s.line === 6) && sym.value.symbols.some((s) => s.name === "main"), sym);
checkLsp("lsp status carries server label", stat.ok && typeof stat.value.label === "string" && stat.value.label.length > 0, stat.value);

// Multi-language gating: uncovered types get a note; covered-but-missing servers fail gracefully.
const mdLsp = await call("lsp.request", { cwd, path: "notes.md", kind: "definition", line: 1, col: 1 });
check("lsp.request uncovered type returns note without touching disk", mdLsp.ok && mdLsp.value.targets.length === 0 && typeof mdLsp.value.note === "string", mdLsp.value);
writeFileSync(`${cwd}/app.ts`, "export const x = 1;\n");
const tsLsp = await call("lsp.request", { cwd, path: "app.ts", kind: "definition", line: 1, col: 14 });
check(
	"lsp.request .ts: graceful error when no TS server installed, real answer otherwise",
	(tsLsp.ok === false && String(tsLsp.error).length > 0) || (tsLsp.ok === true && Array.isArray(tsLsp.value?.targets)),
	tsLsp.ok ? tsLsp.value : tsLsp.error,
);
const tsDiag = await call("lsp.diagnostics", { cwd, path: "app.ts" });
check("lsp.diagnostics .ts never throws", tsDiag.ok && Array.isArray(tsDiag.value.items), tsDiag);

const commits = (await call("git.status", { cwd })).value.commits;
const cShas = commits.map((c) => c.hash);
const cd = await call("git.diff", { cwd, path: "main.go", scope: "commit", sha: cShas[cShas.length - 1] });
check("commit diff of 'add version var'", cd.ok && cd.value.scope === "commit" && cd.value.diff.includes("+var version ="), cd);

const cBad = await call("git.diff", { cwd, path: "main.go", scope: "commit", sha: "deadbeefdeadbeef" });
check("unknown commit refused", cBad.ok && cBad.value.error === "unknown commit", cBad);

// --- fs.write (editor save) ---------------------------------------------------------------
const origMain = (await call("fs.read", { cwd, path: "main.go" })).value.content;
const wres = await call("fs.write", { cwd, path: "main.go", content: `${origMain}// edited\n` });
check("fs.write ok", wres.ok && wres.value.size > 0, wres);
const rback = await call("fs.read", { cwd, path: "main.go" });
check("fs.write roundtrip", rback.ok && rback.value.content.endsWith("// edited\n"), rback);
const wesc = await call("fs.write", { cwd, path: "../evil.go", content: "x" });
check("fs.write fenced", wesc.ok === false, wesc);
const wmiss = await call("fs.write", { cwd, path: "nope.go", content: "x" });
check("fs.write refuses missing file", wmiss.ok === false, wmiss);
await call("fs.write", { cwd, path: "main.go", content: origMain });

// --- fs.read image previews ------------------------------------------------------------------
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0xff]);
writeFileSync(`${cwd}/icon.png`, pngBytes);
const imgRes = await call("fs.read", { cwd, path: "icon.png" });
check(
	"fs.read png returns base64 image",
	imgRes.ok && imgRes.value.kind === "image" && imgRes.value.mime === "image/png" && imgRes.value.truncated === false && Buffer.from(imgRes.value.base64, "base64").equals(pngBytes) && imgRes.value.size === pngBytes.length,
	imgRes.value && { kind: imgRes.value.kind, mime: imgRes.value.mime, size: imgRes.value.size },
);
writeFileSync(`${cwd}/logo.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>\n');
const svgRes = await call("fs.read", { cwd, path: "logo.svg" });
check("fs.read svg stays text for source editing", svgRes.ok && svgRes.value.kind === "text" && svgRes.value.content.includes("<svg"), svgRes.value?.kind);
writeFileSync(`${cwd}/huge.png`, Buffer.alloc(11 * 1024 * 1024, 7));
const hugeRes = await call("fs.read", { cwd, path: "huge.png" });
check("fs.read oversize image reports kind without payload", hugeRes.ok && hugeRes.value.kind === "image" && hugeRes.value.truncated === true && hugeRes.value.base64 === undefined, hugeRes.value && Object.keys(hugeRes.value));
rmSync(`${cwd}/huge.png`);

// --- fs.write optimistic concurrency (mtime guard) ----------------------------------------------
const mRead = await call("fs.read", { cwd, path: "main.go" });
check("fs.read returns mtimeMs", mRead.ok && typeof mRead.value.mtimeMs === "number" && mRead.value.mtimeMs > 0, mRead.value && Object.keys(mRead.value));
const wStale = await call("fs.write", { cwd, path: "main.go", content: "stale clobber\n", baseMtime: mRead.value.mtimeMs - 5000 });
check("fs.write with stale baseMtime refused", wStale.ok === false && /modified on disk/i.test(wStale.error ?? ""), wStale);
const untouched = await call("fs.read", { cwd, path: "main.go" });
check("refused stale write left the file untouched", untouched.value.content === mRead.value.content && untouched.value.mtimeMs === mRead.value.mtimeMs, null);
const wOk = await call("fs.write", { cwd, path: "main.go", content: mRead.value.content, baseMtime: mRead.value.mtimeMs });
check("fs.write with fresh baseMtime succeeds and returns new mtime", wOk.ok && typeof wOk.value.mtimeMs === "number", wOk);
const wCompat = await call("fs.write", { cwd, path: "main.go", content: mRead.value.content });
check("fs.write without baseMtime stays backward compatible", wCompat.ok && wCompat.value.size > 0, wCompat);

// --- git.discard (revert changes, never delete) -------------------------------------------
const curMain = (await call("fs.read", { cwd, path: "main.go" })).value.content;
writeFileSync(`${cwd}/main.go`, `${curMain}// dirty again\n`);
const dRes = await call("git.discard", { cwd, path: "main.go", ch: "M" });
const dRead = await call("fs.read", { cwd, path: "main.go" });
check("git.discard restores HEAD content", dRes.ok && dRead.value.content === curMain, dRes);
writeFileSync(`${cwd}/staged.go`, "package main\n");
git(["add", "staged.go"]);
const aRes = await call("git.discard", { cwd, path: "staged.go", ch: "A" });
const aStatus = await call("git.status", { cwd });
check("git.discard unstages added file without deleting", aRes.ok && existsSync(`${cwd}/staged.go`) && aStatus.value.working.some((w) => w.path === "staged.go" && w.xy.trim() === "??"), aStatus.value.working);
const dEsc = await call("git.discard", { cwd, path: "../evil.go", ch: "M" });
check("git.discard fenced", dEsc.ok === false, dEsc);

// --- git.discard of a deleted file + repo-relative paths (regression) ------------------------
rmSync(`${cwd}/extra.txt`);
writeFileSync(`${cwd}/gone.txt`, "tracked\n");
git(["add", "gone.txt"]);
git(["commit", "-qm", "add gone"]);
rmSync(`${cwd}/gone.txt`);
const dGone = await call("git.discard", { cwd, path: "gone.txt", ch: "D" });
check("git.discard restores a deleted file", dGone.ok && !dGone.value?.error && existsSync(`${cwd}/gone.txt`), dGone);
writeFileSync(`${cwd}/extra.txt`, "new untracked\n");

// --- git.stage / git.unstage / git.commit ----------------------------------------------------
const stStage = await call("git.stage", { cwd, path: "staged.go" });
check("git.stage single file", stStage.ok && stStage.value.status.working.some((w) => w.path === "staged.go" && w.xy === "A "), stStage.value?.status?.working);
const stAll = await call("git.stage", { cwd, path: "" });
check("git.stage whole repo stages everything", stAll.ok && stAll.value.status.working.every((w) => w.xy !== "??" && w.xy[0] !== " "), stAll.value?.status?.working);
const unOne = await call("git.unstage", { cwd, path: "extra.txt" });
check("git.unstage returns entry to untracked", unOne.ok && unOne.value.status.working.some((w) => w.path === "extra.txt" && w.xy === "??"), unOne.value?.status?.working);
const cmt = await call("git.commit", { cwd, message: "test: commit staged" });
check(
	"git.commit commits only the staged set",
	cmt.ok && /test: commit staged/.test(cmt.value.commit ?? "") && cmt.value.status.working.length === 1 && cmt.value.status.working[0].path === "extra.txt",
	cmt.value,
);
const cmtEmpty = await call("git.commit", { cwd, message: "   " });
check("git.commit requires a message", cmtEmpty.ok && cmtEmpty.value?.error === "commit message is required", cmtEmpty);

// amend rewrites the previous commit instead of adding one
writeFileSync(`${cwd}/amend.txt`, "v1\n");
await call("git.stage", { cwd, path: "amend.txt" });
const cmtOrig = await call("git.commit", { cwd, message: "original subject" });
check("pre-amend commit landed", cmtOrig.ok && /original subject/.test(cmtOrig.value.commit ?? ""), cmtOrig.value);
writeFileSync(`${cwd}/amend.txt`, "v2\n");
await call("git.stage", { cwd, path: "amend.txt" });
const cmtAmend = await call("git.commit", { cwd, message: "amended subject", amend: true });
check("git.commit amend returns amended flag + new subject", cmtAmend.ok && !cmtAmend.value.error && cmtAmend.value.amended === true && /amended subject/.test(cmtAmend.value.commit ?? ""), cmtAmend.value);
const logTwo = execFileSync("git", ["-C", cwd, "log", "--format=%s", "-2"], { encoding: "utf8" });
check("amend replaced instead of adding a commit", !/original subject/.test(logTwo) && /amended subject/.test(logTwo), logTwo);
const amendedContent = execFileSync("git", ["-C", cwd, "show", "HEAD:amend.txt"], { encoding: "utf8" });
check("amend folded the newly staged content", amendedContent.trim() === "v2", amendedContent);
const cmtNone = await call("git.commit", { cwd, message: "nothing" });
check("git.commit with nothing staged fails", cmtNone.ok && Boolean(cmtNone.value?.error) && Boolean(cmtNone.value?.status), cmtNone.value?.error);
const stEsc = await call("git.stage", { cwd, path: "../evil.go" });
check("git.stage fenced", stEsc.ok === false || Boolean(stEsc.value?.error), stEsc);
const stAbs = await call("git.stage", { cwd, path: "/tmp/evil.go" });
check("git.stage refuses absolute path", stAbs.ok === false || Boolean(stAbs.value?.error), stAbs);

// Unborn HEAD (fresh repo): unstage must fall back to index removal; the worktree never changes.
mkdirSync(`${cwd}/fresh`, { recursive: true });
execFileSync("git", ["-C", `${cwd}/fresh`, "init", "-q", "-b", "main"]);
writeFileSync(`${cwd}/fresh/x.txt`, "x");
const fresh = `${cwd}/fresh`;
await call("git.stage", { cwd, repo: fresh, path: "x.txt" });
const unFresh = await call("git.unstage", { cwd, repo: fresh, path: "x.txt" });
check("git.unstage on unborn HEAD keeps worktree file", unFresh.ok && existsSync(`${fresh}/x.txt`) && unFresh.value.status.working.some((w) => w.path === "x.txt" && w.xy === "??"), unFresh.value?.status?.working);
const unFreshAll = await call("git.unstage", { cwd, repo: fresh, path: "" });
check("git.unstage whole repo with empty index is a no-op", unFreshAll.ok && !unFreshAll.value?.error, unFreshAll);
rmSync(fresh, { recursive: true, force: true });

// --- git.diff staged scope (index vs HEAD) ------------------------------------------------------
writeFileSync(`${cwd}/staged-scope.txt`, "v1\n");
await call("git.stage", { cwd, path: "staged-scope.txt" });
writeFileSync(`${cwd}/staged-scope.txt`, "v2 worktree\n");
const stDiff = await call("git.diff", { cwd, path: "staged-scope.txt", scope: "staged" });
check("git.diff staged shows index vs HEAD only", stDiff.ok && stDiff.value.scope === "staged" && stDiff.value.diff.includes("+v1") && !stDiff.value.diff.includes("v2 worktree"), stDiff.value?.diff);
const wkDiff = await call("git.diff", { cwd, path: "staged-scope.txt", scope: "working" });
check("git.diff working still spans HEAD to worktree", wkDiff.ok && wkDiff.value.diff.includes("v2 worktree"), wkDiff.value?.diff);
await call("git.unstage", { cwd, path: "staged-scope.txt" });
rmSync(`${cwd}/staged-scope.txt`);

// --- git.stash.* flow -------------------------------------------------------------------------
const stashEmpty = await call("git.stash.save", { cwd });
check("stash.save refused with untracked-only changes (no -u)", stashEmpty.ok && stashEmpty.value?.error === "no local changes to stash", stashEmpty.value);
appendFileSync(`${cwd}/main.go`, "// stash me\n");
const stashSave = await call("git.stash.save", { cwd, message: "wip" });
check(
	"stash.save clears the worktree and lists the stash",
	stashSave.ok && !stashSave.value.error && stashSave.value.stashes.length === 1 && /wip/.test(stashSave.value.stashes[0].message) && stashSave.value.stashes[0].ref === "stash@{0}" && !stashSave.value.status.working.some((f) => f.path === "main.go"),
	stashSave.value,
);
const mainAfterStash = await call("fs.read", { cwd, path: "main.go" });
check("stash.save restored HEAD content on disk", !mainAfterStash.value.content.includes("stash me"), null);
const stashList = await call("git.stash.list", { cwd });
check("stash.list shape", stashList.ok && stashList.value.stashes.length === 1 && stashList.value.stashes[0].ref === "stash@{0}", stashList.value);
const stashApply = await call("git.stash.apply", { cwd, ref: "stash@{0}" });
check("stash.apply brings changes back and keeps the stash", stashApply.ok && !stashApply.value.error && stashApply.value.status.working.some((f) => f.path === "main.go") && stashApply.value.stashes.length === 1, stashApply.value);
await call("git.discard", { cwd, path: "main.go", ch: "M" });
const stashBadRef = await call("git.stash.apply", { cwd, ref: "--all" });
check("stash.apply refuses flag-like ref", stashBadRef.ok && stashBadRef.value?.error === "invalid stash ref", stashBadRef);
const stashDrop = await call("git.stash.drop", { cwd, ref: "stash@{0}" });
check("stash.drop empties the list", stashDrop.ok && stashDrop.value.stashes.length === 0, stashDrop.value);
appendFileSync(`${cwd}/main.go`, "// pop me\n");
await call("git.stash.save", { cwd, message: "to-pop" });
const stashPop = await call("git.stash.pop", { cwd, ref: "stash@{0}" });
check("stash.pop applies and removes", stashPop.ok && !stashPop.value.error && stashPop.value.stashes.length === 0 && stashPop.value.status.working.some((f) => f.path === "main.go"), stashPop.value);
await call("git.discard", { cwd, path: "main.go", ch: "M" });
const stashU = await call("git.stash.save", { cwd, message: "with-untracked", includeUntracked: true });
check("stash.save -u sweeps untracked files", stashU.ok && !stashU.value.error && !existsSync(`${cwd}/extra.txt`) && stashU.value.stashes.length === 1, stashU.value);
const popU = await call("git.stash.pop", { cwd, ref: "stash@{0}" });
check("pop restores the untracked file", popU.ok && !popU.value.error && existsSync(`${cwd}/extra.txt`) && popU.value.stashes.length === 0, popU.value);

// --- git.branches / git.checkout ------------------------------------------------------------
const bList = await call("git.branches", { cwd });
check("git.branches lists locals with current flag", bList.ok && bList.value.branches.some((b) => b.name === "feature" && b.current === true) && bList.value.branches.some((b) => b.name === "master" && b.current === false), bList.value?.branches);
const bCo = await call("git.checkout", { cwd, branch: "master" });
check("git.checkout switches branch", bCo.ok && bCo.value.status.branch === "master", bCo);
const bBack = await call("git.checkout", { cwd, branch: "feature" });
check("git.checkout switches back", bBack.ok && bBack.value.status.branch === "feature", bBack);
const bBad = await call("git.checkout", { cwd, branch: "--help" });
check("git.checkout rejects flag-like names", bBad.ok === true && bBad.value?.error === "invalid branch name", bBad);

// --- git.blame ------------------------------------------------------------------------------
const blameRes = await call("git.blame", { cwd, path: "main.go" });
const mainContent = (await call("fs.read", { cwd, path: "main.go" })).value.content;
const expectedLines = mainContent.endsWith("\n") ? mainContent.split("\n").length - 1 : mainContent.split("\n").length;
check("git.blame per-line attribution", blameRes.ok && blameRes.value.lines.length === expectedLines && blameRes.value.lines.every((l) => l.author === "t" && /^[0-9a-f]{40}$/.test(l.sha)), blameRes.value?.lines?.slice(0, 2));

// --- git.history + commit-scope path filter -----------------------------------------------------
const hist = await call("git.history", { cwd, path: "main.go" });
check(
	"git.history lists commits for the file, newest first",
	hist.ok && Array.isArray(hist.value.commits) && hist.value.commits.length >= 3
		&& /add version var/.test(hist.value.commits[0].subject)
		&& hist.value.commits.some((c) => /second commit/.test(c.subject))
		&& hist.value.commits.every((c) => /^[0-9a-f]+$/.test(c.hash) && c.author === "t" && typeof c.when === "string"),
	hist.value?.commits?.slice(0, 3),
);
const histUntracked = await call("git.history", { cwd, path: "extra.txt" });
check("git.history untracked file → empty list", histUntracked.ok && histUntracked.value.commits.length === 0, histUntracked.value);
const histEscape = await call("git.history", { cwd, path: "../evil" });
check("git.history fenced", histEscape.ok === false || Boolean(histEscape.value?.error), histEscape);
const newest = hist.value.commits[0];
const fileDiff = await call("git.diff", { cwd, path: "main.go", scope: "commit", sha: newest.hash });
check("commit-scope diff filters to the requested path", fileDiff.ok && fileDiff.value.diff.includes("main.go") && !fileDiff.value.diff.includes("pkg/svc.go") && fileDiff.value.path === "main.go", fileDiff.value?.diff?.slice(0, 140));
const wholeDiff = await call("git.diff", { cwd, path: "", scope: "commit", sha: newest.hash });
check("commit-scope whole-tree diff still works", wholeDiff.ok && wholeDiff.value.diff.length > 0 && wholeDiff.value.path === undefined, wholeDiff.value?.error);

// --- api.send proxy -------------------------------------------------------------------------
const http = await import("node:http");
const srv = http.createServer((req, res) => {
	const chunks = [];
	req.on("data", (c) => chunks.push(c));
	req.on("end", () => {
		const received = Buffer.concat(chunks).toString("utf8");
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify({ method: req.method, body: received, header: req.headers["x-t"] ?? null, ct: req.headers["content-type"] ?? null }));
	});
});
await new Promise((resolveListen) => srv.listen(0, "127.0.0.1", resolveListen));
const echoPort = srv.address().port;
const sRes = await call("api.send", { method: "POST", url: `http://127.0.0.1:${echoPort}/echo`, headers: [{ name: "X-T", value: "v1" }], body: "{\"hi\":1}" });
check("api.send posts headers+body and reads json", sRes.ok && sRes.value.status === 200 && JSON.parse(sRes.value.text).header === "v1" && JSON.parse(sRes.value.text).body === "{\"hi\":1}", sRes);
const mRes = await call("api.send", {
	method: "POST",
	url: `http://127.0.0.1:${echoPort}/upload`,
	headers: [{ name: "Content-Type", value: "application/json" }],
	multipart: [{ name: "field", value: "hello world" }, { name: "note", value: "n2" }, { name: "", value: "skipped" }],
});
const mEcho = mRes.ok && mRes.value.status === 200 ? JSON.parse(mRes.value.text) : null;
check(
	"api.send multipart encodes fields with boundary",
	mEcho !== null && /name="field"/.test(mEcho.body) && mEcho.body.includes("hello world") && /name="note"/.test(mEcho.body) && !/name=""/.test(mEcho.body),
	mEcho && mEcho.body.slice(0, 200),
);
const mCt = mEcho?.ct ?? "";
check("api.send multipart sets its own content-type (user header dropped)", /multipart\/form-data; boundary=/i.test(mCt), mCt);
const sBad = await call("api.send", { method: "GET", url: "ftp://x/y" });
check("api.send rejects non-http schemes", sBad.ok === true && Boolean(sBad.value?.error), sBad);
srv.close();

// --- read scope: sibling roots allowed for reads, never for writes ------------------------
mkdirSync("/tmp/ce-sib", { recursive: true });
writeFileSync("/tmp/ce-sib/lib.go", "package sib\n");
const sibRead = await call("fs.read", { cwd, path: "../ce-sib/lib.go" });
check("fs.read allows sibling root", sibRead.ok && sibRead.value.content.includes("package sib"), sibRead);
const sibWrite = await call("fs.write", { cwd, path: "../ce-sib/lib.go", content: "x" });
check("fs.write stays workspace-only", sibWrite.ok === false, sibWrite);
const sibList = await call("fs.list", { cwd, path: "../ce-sib" });
check("fs.list stays workspace-only", sibList.ok === false, sibList);
rmSync("/tmp/ce-sib", { recursive: true, force: true });

// --- fs.create / fs.rename / fs.delete -------------------------------------------------------
const cNew = await call("fs.create", { cwd, path: "newdir/sub.txt", kind: "file" });
check("fs.create refuses missing parent", cNew.ok === false, cNew);
const cDir = await call("fs.create", { cwd, path: "newdir", kind: "dir" });
const cFile = await call("fs.create", { cwd, path: "newdir/sub.txt", kind: "file" });
check("fs.create dir+file", cDir.ok && cFile.ok, [cDir, cFile]);
const cDup = await call("fs.create", { cwd, path: "newdir/sub.txt", kind: "file" });
check("fs.create refuses existing", cDup.value?.error === "path already exists", cDup);
const rRen = await call("fs.rename", { cwd, path: "newdir/sub.txt", to: "newdir/renamed.txt" });
const rRead = await call("fs.read", { cwd, path: "newdir/renamed.txt" });
check("fs.rename moves file", rRen.ok && rRead.ok, rRen);
const rOver = await call("fs.rename", { cwd, path: "newdir/renamed.txt", to: "main.go" });
check("fs.rename refuses existing target", rOver.value?.error === "target already exists", rOver);
const dDel = await call("fs.delete", { cwd, path: "newdir" });
const dList = await call("fs.list", { cwd, path: "" });
check("fs.delete removes dir recursive", dDel.ok && !dList.value.entries.some((e) => e.name === "newdir"), dDel);
const dRoot = await call("fs.delete", { cwd, path: "." });
check("fs.delete refuses workspace root", dRoot.value?.error === "cannot delete the workspace root", dRoot);

// --- fence edges: symlinks refused, escapes refused -------------------------------------------
writeFileSync("/tmp/ce-fence-secret.txt", "secret\n");
symlinkSync("/tmp/ce-fence-secret.txt", `${cwd}/link.txt`);
const symRead = await call("fs.read", { cwd, path: "link.txt" });
check("fs.read refuses symlink", symRead.ok === false, symRead);
const symWrite = await call("fs.write", { cwd, path: "link.txt", content: "x" });
check("fs.write refuses symlink", symWrite.ok === false, symWrite);
const symDel = await call("fs.delete", { cwd, path: "link.txt" });
check("fs.delete refuses symlink", symDel.ok === false, symDel);
check("fs.delete refusal left link and target intact", existsSync(`${cwd}/link.txt`) && existsSync("/tmp/ce-fence-secret.txt"), null);
rmSync(`${cwd}/link.txt`, { force: true });
rmSync("/tmp/ce-fence-secret.txt", { force: true });
const cEsc = await call("fs.create", { cwd, path: "../evil.txt", kind: "file" });
check("fs.create refuses fence escape", cEsc.ok === false || Boolean(cEsc.value?.error), cEsc);
const rEsc = await call("fs.rename", { cwd, path: "main.go", to: "../stolen.go" });
check("fs.rename refuses fence escape", rEsc.ok === false || Boolean(rEsc.value?.error), rEsc);
check("fs.rename escape left source intact", existsSync(`${cwd}/main.go`) && !existsSync("/tmp/stolen.go"), null);

// --- skills manager routes ---------------------------------------------------------------
process.env.DSH_CE_HOME = `${cwd}-home`;
mkdirSync("/tmp/ce-bundled-skills/office-fake", { recursive: true });
writeFileSync("/tmp/ce-bundled-skills/office-fake/SKILL.md", "---\nname: office-fake\ndescription: \"bundled\"\n---\n");
process.env.DSH_BUNDLED_SKILL_DIR = "/tmp/ce-bundled-skills";
mkdirSync(`${cwd}/.agents/skills/demo-skill`, { recursive: true });
writeFileSync(`${cwd}/.agents/skills/demo-skill/SKILL.md`, "---\nname: demo-skill\ndescription: \"demo\"\n---\n\nbody\n");
mkdirSync(`${cwd}-home/.agents/skills/home-skill`, { recursive: true });
writeFileSync(`${cwd}-home/.agents/skills/home-skill/SKILL.md`, "---\nname: home-skill\ndescription: \"from home\"\n---\n\nhome body\n");
mkdirSync(`${cwd}/.agents/skills/block-skill`, { recursive: true });
writeFileSync(`${cwd}/.agents/skills/block-skill/SKILL.md`, "---\nname: block-skill\ndescription: >-\n  folded one\n  two lines\n---\n\nx\n");

const sList = await call("skills.list", { cwd });
check("skills.list finds project + user skills", sList.ok && sList.value.skills.some((s) => s.name === "demo-skill" && s.source === "project-agents") && sList.value.skills.some((s) => s.name === "home-skill" && s.source === "user-agents"), sList);
check("skills.list folds block-scalar descriptions", sList.ok && sList.value.skills.find((s) => s.name === "block-skill")?.description === "folded one two lines", sList.value.skills.find((s) => s.name === "block-skill"));
check("skills.list includes bundled root", sList.ok && sList.value.skills.some((s) => s.name === "office-fake" && s.source === "bundled"), sList.value.skills.find((s) => s.name === "office-fake"));
const bundledItem = sList.value.skills.find((s) => s.name === "office-fake");
const bWrite = await call("skills.write", { cwd, path: bundledItem.path, content: "x" });
check("bundled skills are read-only", bWrite.ok === false && /read-only/.test(bWrite.error ?? ""), bWrite);
check("skills.list merges registry-only entries as other", sList.ok && sList.value.skills.some((s) => s.name === "registry-fake" && s.source === "other" && s.provider === "office-plugin"), sList.value.skills.find((s) => s.name === "registry-fake"));
const demo = sList.value.skills.find((s) => s.name === "demo-skill");
const sRead = await call("skills.read", { cwd, path: demo.path });
check("skills.read returns content", sRead.ok && sRead.value.content.includes("name: demo-skill"), sRead);
const sWrite = await call("skills.write", { cwd, path: demo.path, content: `${sRead.value.content}more\n` });
const sRead2 = await call("skills.read", { cwd, path: demo.path });
check("skills.write persists", sWrite.ok && sRead2.ok && sRead2.value.content.endsWith("more\n"), sRead2);
const sCreate = await call("skills.create", { cwd, name: "fresh-skill", scope: "user" });
check("skills.create under home root", sCreate.ok && sCreate.value.path.startsWith(`${cwd}-home/`), sCreate);
const sEscape = await call("skills.read", { cwd, path: "/etc/hosts" });
check("skills.read fenced to roots", sEscape.ok === false, sEscape);
const sBadName = await call("skills.create", { cwd, name: "../evil" });
check("skills.create rejects bad name", sBadName.ok === false, sBadName);
const sDel = await call("skills.delete", { cwd, path: sCreate.value.path.replace(/\/SKILL\.md$/, "") });
const sList2 = await call("skills.list", { cwd });
check("skills.delete removes dir skill", sDel.ok && !sList2.value.skills.some((s) => s.name === "fresh-skill"), sList2);
const sDelCwd = await call("skills.delete", { cwd, path: cwd });
check("skills.delete refuses non-skill dir", sDelCwd.ok === false, sDelCwd);
const sDelByFile = await call("skills.delete", { cwd, path: demo.path });
const sList3 = await call("skills.list", { cwd });
check("skills.delete accepts SKILL.md locator", sDelByFile.ok && !sList3.value.skills.some((s) => s.name === "demo-skill"), sDelByFile);
mkdirSync(`${cwd}-home/.agents/skills/real-skill`, { recursive: true });
writeFileSync(`${cwd}-home/.agents/skills/real-skill/SKILL.md`, "---\nname: real-skill\n---\n");
symlinkSync(`${cwd}-home/.agents/skills/real-skill`, `${cwd}/.agents/skills/linked-skill`);
const sDelLink = await call("skills.delete", { cwd, path: `${cwd}/.agents/skills/linked-skill/SKILL.md` });
check("skills.delete on symlink removes link only", sDelLink.ok && !existsSync(`${cwd}/.agents/skills/linked-skill`) && existsSync(`${cwd}-home/.agents/skills/real-skill/SKILL.md`), sDelLink);
rmSync(`${cwd}-home`, { recursive: true, force: true });

for (const cleanup of cleanups) cleanup();
console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
process.exit(fail ? 1 : 0);
