// Drives the host half through a fake webServer to exercise every route.
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
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
	storageDomain: {
		async open(spec) {
			let value = structuredClone(spec.global.initial);
			return {
				global: {
					get: () => value,
					async set(next) { value = structuredClone(next); },
				},
				async close() {},
			};
		},
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

// --- git.revertHunk (single-hunk revert via apply -R) --------------------------------------------
writeFileSync(`${cwd}/hunky.txt`, "l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10\nl11\nl12\n");
git(["add", "hunky.txt"]);
git(["commit", "-qm", "add hunky"]);
writeFileSync(`${cwd}/hunky.txt`, "L1 changed\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10\nl11\nL12 changed\n");
const rh0 = await call("git.revertHunk", { cwd, path: "hunky.txt", hunkIndex: 0 });
check("revertHunk reverts the first hunk", rh0.ok && !rh0.value.error, rh0.value?.error);
const hunkyAfter = (await call("fs.read", { cwd, path: "hunky.txt" })).value.content;
check("revertHunk kept the far-away second hunk", hunkyAfter.startsWith("l1\n") && hunkyAfter.includes("L12 changed"), hunkyAfter);
const rh1 = await call("git.revertHunk", { cwd, path: "hunky.txt", hunkIndex: 0 });
const hunkyClean = (await call("fs.read", { cwd, path: "hunky.txt" })).value.content;
check("reverting the remaining hunk restores HEAD content", rh1.ok && !rh1.value.error && hunkyClean === "l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10\nl11\nl12\n", hunkyClean);
const rhRange = await call("git.revertHunk", { cwd, path: "hunky.txt", hunkIndex: 3 });
check("revertHunk out-of-range errors cleanly", rhRange.ok && /hunk not found/.test(rhRange.value?.error ?? ""), rhRange.value);
const rhNeg = await call("git.revertHunk", { cwd, path: "hunky.txt", hunkIndex: -1 });
check("revertHunk rejects invalid index", rhNeg.ok && rhNeg.value?.error === "invalid hunk index", rhNeg.value);
const rhEsc = await call("git.revertHunk", { cwd, path: "../evil.txt", hunkIndex: 0 });
check("revertHunk fenced", rhEsc.ok === false || Boolean(rhEsc.value?.error), rhEsc);

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

// --- audit regressions: symlink fences, enclosing repos, literal pathspecs ----------------------
// M2: create/rename must not escape through a symlinked directory inside the workspace.
mkdirSync("/tmp/ce-outside", { recursive: true });
symlinkSync("/tmp/ce-outside", `${cwd}/linkdir`);
const cLink = await call("fs.create", { cwd, path: "linkdir/evil.txt", kind: "file" });
check("fs.create refuses to write through symlinked dir", cLink.ok === false || Boolean(cLink.value?.error), cLink);
check("fs.create escape created nothing outside", !existsSync("/tmp/ce-outside/evil.txt"), null);
const rLink = await call("fs.rename", { cwd, path: "main.go", to: "linkdir/moved.go" });
check("fs.rename refuses to move through symlinked dir", rLink.ok === false || Boolean(rLink.value?.error), rLink);
check("fs.rename escape left both sides intact", existsSync(`${cwd}/main.go`) && !existsSync("/tmp/ce-outside/moved.go"), null);
rmSync(`${cwd}/linkdir`, { force: true });
rmSync("/tmp/ce-outside", { recursive: true, force: true });

// M3: hidden dirs under the extra read root (parent tree) stay unreadable.
mkdirSync("/tmp/.ce-audit-secret", { recursive: true });
writeFileSync("/tmp/.ce-audit-secret/key.txt", "secret\n");
const hiddenRead = await call("fs.read", { cwd, path: "../.ce-audit-secret/key.txt" });
check("hidden sibling dirs are not readable via extra roots", hiddenRead.ok === false, hiddenRead);
rmSync("/tmp/.ce-audit-secret", { recursive: true, force: true });

// M4: a repo ENCLOSING the workspace answers reads but refuses panel writes.
mkdirSync("/tmp/ce-enclosing/inner", { recursive: true });
execFileSync("git", ["-C", "/tmp/ce-enclosing", "init", "-q", "-b", "main"]);
execFileSync("git", ["-C", "/tmp/ce-enclosing", "config", "user.email", "t@t"]);
execFileSync("git", ["-C", "/tmp/ce-enclosing", "config", "user.name", "t"]);
writeFileSync("/tmp/ce-enclosing/inner/f.txt", "x\n");
execFileSync("git", ["-C", "/tmp/ce-enclosing", "add", "-A"]);
execFileSync("git", ["-C", "/tmp/ce-enclosing", "commit", "-qm", "c1"]);
writeFileSync("/tmp/ce-enclosing/inner/f.txt", "y\n");
const encStatus = await call("git.status", { cwd: "/tmp/ce-enclosing/inner" });
check("enclosing repo: status (read) still works", encStatus.ok && encStatus.value.repo === true, encStatus.value?.repo);
const encCommit = await call("git.commit", { cwd: "/tmp/ce-enclosing/inner", message: "nope" });
check("enclosing repo: commit refused by write fence", encCommit.ok === false && /larger repository/.test(encCommit.error ?? ""), encCommit);
const encStash = await call("git.stash.save", { cwd: "/tmp/ce-enclosing/inner" });
check("enclosing repo: stash.save refused", encStash.ok === false && /larger repository/.test(encStash.error ?? ""), encStash);
const encStage = await call("git.stage", { cwd: "/tmp/ce-enclosing/inner", path: "f.txt" });
check("enclosing repo: stage refused", encStage.ok === false, encStage);
rmSync("/tmp/ce-enclosing", { recursive: true, force: true });

// M5: revertHunk refuses a stale hunk header (file changed since render).
writeFileSync(`${cwd}/audit.txt`, "l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\n");
git(["add", "audit.txt"]);
git(["commit", "-qm", "audit base"]);
writeFileSync(`${cwd}/audit.txt`, "CHANGED\nl2\nl3\nl4\nl5\nl6\nl7\nl8\n");
const aDiff = await call("git.diff", { cwd, path: "audit.txt", scope: "working" });
const aHunk = aDiff.value.diff.split("\n").find((l) => l.startsWith("@@")) ?? "";
const rhMismatch = await call("git.revertHunk", { cwd, path: "audit.txt", hunkIndex: 0, hunkHeader: "@@ -99,3 +99,4 @@" });
check("revertHunk refuses stale hunk header", rhMismatch.ok && /diff has changed/.test(rhMismatch.value?.error ?? ""), rhMismatch.value);
check("refused stale revert left file dirty", readFileSync(`${cwd}/audit.txt`, "utf8").startsWith("CHANGED"), null);
const rhMatch = await call("git.revertHunk", { cwd, path: "audit.txt", hunkIndex: 0, hunkHeader: aHunk });
check("revertHunk with matching header succeeds", rhMatch.ok && !rhMatch.value.error && readFileSync(`${cwd}/audit.txt`, "utf8").startsWith("l1"), rhMatch.value);

// m-note: diffs without content hunks explain themselves instead of a bare "0 changed lines".
writeFileSync(`${cwd}/modenote.txt`, "m\n");
git(["add", "modenote.txt"]);
git(["commit", "-qm", "modenote base"]);
execFileSync("chmod", ["+x", `${cwd}/modenote.txt`]);
const mn = await call("git.diff", { cwd, path: "modenote.txt", scope: "working" });
check("mode-only diff carries an explanatory note", mn.ok && /模式/.test(mn.value.note ?? ""), mn.value?.note);
execFileSync("chmod", ["-x", `${cwd}/modenote.txt`]);

// m2: glob metacharacters in filenames stay literal pathspecs.
writeFileSync(`${cwd}/a*.txt`, "star\n");
writeFileSync(`${cwd}/a1.txt`, "one\n");
const stStar = await call("git.stage", { cwd, path: "a*.txt" });
const starW = (stStar.value?.status?.working ?? []).map((f) => `${f.xy}|${f.path}`);
check("stage of literal 'a*.txt' does not sweep a1.txt", starW.some((w) => w.includes("a*.txt") && w.trimStart().startsWith("A")) && starW.some((w) => w.includes("a1.txt") && w.includes("??")), starW);
await call("git.unstage", { cwd, path: "a*.txt" });
rmSync(`${cwd}/a*.txt`);
rmSync(`${cwd}/a1.txt`);

// m6: NaN limit falls back to the default instead of silently returning [].
const nanLimit = await call("search.files", { cwd, query: "main", limit: "abc" });
check("NaN limit falls back to default", nanLimit.ok && Array.isArray(nanLimit.value.matches) && nanLimit.value.matches.length > 0, nanLimit.value?.matches?.length);

// --- fence edges: symlinks refused, escapes refused -------------------------------------------
writeFileSync("/tmp/ce-fence-secret.txt", "secret\n");
symlinkSync("/tmp/ce-fence-secret.txt", `${cwd}/link.txt`);
const symRead = await call("fs.read", { cwd, path: "link.txt" });
check("fs.read follows escaping symlink (content visible but write-blocked)", symRead.ok && symRead.value?.content === "secret\n", symRead.value);
const symWrite = await call("fs.write", { cwd, path: "link.txt", content: "x" });
check("fs.write refuses any symlink (even in-fence)", symWrite.ok === false, symWrite);
const symDel = await call("fs.delete", { cwd, path: "link.txt" });
check("fs.delete refuses escaping symlink", symDel.ok === false, symDel);
check("fs.delete refusal left link and target intact", existsSync(`${cwd}/link.txt`) && existsSync("/tmp/ce-fence-secret.txt"), null);
rmSync(`${cwd}/link.txt`, { force: true });
rmSync("/tmp/ce-fence-secret.txt", { force: true });
// Symlinks that resolve INSIDE the fence are now visible (pnpm workspaces, monorepo links).
mkdirSync(`${cwd}/internal-target`, { recursive: true });
writeFileSync(`${cwd}/internal-target/file.txt`, "inside\n");
symlinkSync(`${cwd}/internal-target`, `${cwd}/internal-link`);
const intList = await call("fs.list", { cwd, path: "" });
check("fs.list shows in-fence symlinked directory", Array.isArray(intList.value?.entries) && intList.value.entries.some((e) => e.name === "internal-link" && e.type === "directory"), intList.value?.entries?.map((e) => e.name));
const intRead = await call("fs.read", { cwd, path: "internal-link/file.txt" });
check("fs.read follows in-fence symlink to file", intRead.ok && intRead.value?.content === "inside\n", intRead.value);
const intListInner = await call("fs.list", { cwd, path: "internal-link" });
check("fs.list reads through in-fence symlinked dir", Array.isArray(intListInner.value?.entries) && intListInner.value.entries.some((e) => e.name === "file.txt"), intListInner.value?.entries?.map((e) => e.name));
rmSync(`${cwd}/internal-link`, { force: true });
rmSync(`${cwd}/internal-target`, { recursive: true, force: true });
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

// M1: a symlinked skill dir must not smuggle reads/writes/deletes outside the roots.
mkdirSync("/tmp/ce-skill-outside", { recursive: true });
writeFileSync("/tmp/ce-skill-outside/secret.txt", "top-secret\n");
symlinkSync("/tmp/ce-skill-outside", `${cwd}/.agents/skills/evil-link`);
const evilRead = await call("skills.read", { cwd, path: `${cwd}/.agents/skills/evil-link/secret.txt` });
check("skills.read refuses symlinked-dir escape", evilRead.ok === false, evilRead);
const evilWrite = await call("skills.write", { cwd, path: `${cwd}/.agents/skills/evil-link/secret.txt`, content: "pwned" });
check("skills.write refuses symlinked-dir escape", evilWrite.ok === false && readFileSync("/tmp/ce-skill-outside/secret.txt", "utf8") === "top-secret\n", evilWrite);
const evilDel = await call("skills.delete", { cwd, path: `${cwd}/.agents/skills/evil-link/secret.txt` });
check("skills.delete refuses symlinked-dir escape", evilDel.ok === false && existsSync("/tmp/ce-skill-outside/secret.txt"), evilDel);
const evilCreate = await call("skills.create", { cwd, name: "evil-link", scope: "project" });
check("skills.create refuses symlinked dir", evilCreate.ok === false, evilCreate);
rmSync(`${cwd}/.agents/skills/evil-link`, { force: true });
rmSync("/tmp/ce-skill-outside", { recursive: true, force: true });
rmSync(`${cwd}-home`, { recursive: true, force: true });

// ---- live watch: baseline, debounced batches, .git ticks, cursor math ----
const { snapshotFor, hubs } = await import("./lib/host/watch.js");
const wBase = await call("watch.poll", { cwd });
check("watch.poll answers a baseline cursor on first contact", wBase.ok && typeof wBase.value.seq === "number" && wBase.value.baseline === true && wBase.value.supported !== false, wBase);
check("watch.poll requires cwd", (await call("watch.poll", {})).ok === false, null);
check("watch.poll reports a missing workspace as an error", (await call("watch.poll", { cwd: "/no-such-dir-ce-xyz" })).ok === false, null);
writeFileSync(`${cwd}/watch-live.txt`, "one\n");
const wOne = await call("watch.poll", { cwd, since: wBase.value.seq, waitMs: 6000 });
check("watch.poll delivers a created file path", wOne.ok && wOne.value.paths?.includes("watch-live.txt"), wOne);
appendFileSync(`${cwd}/watch-live.txt`, "two\nthree\n");
const wTwo = await call("watch.poll", { cwd, since: wOne.value.seq, waitMs: 6000 });
check("coalesced batches list a path at most once", wTwo.ok && wTwo.value.paths?.filter((p) => p === "watch-live.txt").length <= 1 && (wTwo.value.paths ?? []).includes("watch-live.txt"), wTwo);
git(["add", "watch-live.txt"]);
const wGit = await call("watch.poll", { cwd, since: wTwo.value.seq, waitMs: 6000 });
check("git-dir changes surface as a git tick, not file paths", wGit.ok && wGit.value.git === true && !(wGit.value.paths ?? []).some((p) => p.startsWith(".git")), wGit);
const wIdle = await call("watch.poll", { cwd, since: wGit.value.seq, waitMs: 300 });
check("a settled cursor beats back empty", wIdle.ok && Array.isArray(wIdle.value.paths) && wIdle.value.paths.length === 0 && wIdle.value.git === false, wIdle);
git(["reset", "-q"]);
rmSync(`${cwd}/watch-live.txt`, { force: true });
const fakeHub = { supported: true, seq: 5, lostBelow: 4, gitSeq: 5, paths: new Map([["a.go", 5], ["b.go", 3]]) };
check("watch: cursor older than retention forces a reset", snapshotFor(fakeHub, 2).value.reset === true, snapshotFor(fakeHub, 2));
check("watch: retained cursor receives only paths past it", snapshotFor(fakeHub, 3).value.paths.join() === "a.go", snapshotFor(fakeHub, 3));
check("watch: gitSeq drives the git flag", snapshotFor(fakeHub, 4).value.git === true, snapshotFor(fakeHub, 4));
check("watch: settled cursor is not ready", snapshotFor(fakeHub, 5).ready === false, snapshotFor(fakeHub, 5));
const fakeDead = { supported: false, seq: 2, lostBelow: 0, gitSeq: 0, paths: new Map() };
check("watch: unsupported hubs answer supported:false", snapshotFor(fakeDead, 0).value.supported === false, snapshotFor(fakeDead));
check("watch: a hub was materialized for the fixture root", hubs.size >= 1, hubs.size);

// ---- M2: workspace symbols + format-on-save ----
const { applyTextEdits } = await import("./lib/host/lsp.js");
check("applyTextEdits replaces a single range", applyTextEdits("hello world", [{ range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } }, newText: "there" }]) === "hello there", null);
check("applyTextEdits spans lines by absolute offset", applyTextEdits("a\nb\nc", [{ range: { start: { line: 0, character: 1 }, end: { line: 2, character: 1 } }, newText: "x" }]) === "ax", null);
check("applyTextEdits applies right-to-left for multiple edits", applyTextEdits("one two three", [
	{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, newText: "1" },
	{ range: { start: { line: 0, character: 8 }, end: { line: 0, character: 13 } }, newText: "3" },
]) === "1 two 3", null);
check("applyTextEdits skips an edit overlapping one already applied", applyTextEdits("abcdef", [
	{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 6 } }, newText: "Z" },
	{ range: { start: { line: 0, character: 3 }, end: { line: 0, character: 5 } }, newText: "Y" },
]) === "abcdZ", null);
check("applyTextEdits clamps end past EOF", applyTextEdits("ab\ncd", [{ range: { start: { line: 0, character: 0 }, end: { line: 9, character: 0 } }, newText: "x" }]) === "x", null);
if (goplsOn) {
	const ws = await call("lsp.workspaceSymbol", { cwd, query: "helper" });
	check("lsp.workspaceSymbol finds gopls symbols by fuzzy query", ws.ok && ws.value.symbols.some((s) => s.name === "helper" && typeof s.line === "number" && s.path !== ""), ws.value?.symbols?.slice(0, 3));
	const wsProbe = await call("lsp.workspaceSymbol", { cwd, query: "Greeter" });
	check("lsp.workspaceSymbol probes the workspace language without a document hint", wsProbe.ok && wsProbe.value.symbols.some((s) => s.name === "Greeter"), wsProbe.value?.symbols?.slice(0, 3));
	writeFileSync(`${cwd}/fmt-target.go`, "package main\n\nfunc  unformatted( a int ) int {\nreturn a\n}\n");
	const fmt = await call("fs.formatDraft", { cwd, path: "fmt-target.go", content: "package main\n\nfunc  unformatted( a int ) int {\nreturn a\n}\n" });
	check("fs.formatDraft writes the draft then gofmts it through the server", fmt.ok && fmt.value.formatted === true && fmt.value.content.includes("func unformatted(a int) int {") && fmt.value.content.includes("\treturn a"), fmt.value?.content);
	check("fs.formatDraft advances mtime to the formatted write", typeof fmt.value.mtimeMs === "number" && readFileSync(`${cwd}/fmt-target.go`, "utf8") === fmt.value.content, null);
	const fmtConflict = await call("fs.formatDraft", { cwd, path: "fmt-target.go", content: "package main\n\nfunc later(a int) int { return a }\n", baseMtime: 1 });
	check("fs.formatDraft refuses blind overwrite via baseMtime", fmtConflict.ok === false && /modified on disk/i.test(fmtConflict.error ?? ""), fmtConflict);
	check("the refused formatDraft left the formatted file intact", readFileSync(`${cwd}/fmt-target.go`, "utf8") === fmt.value.content, null);
	rmSync(`${cwd}/fmt-target.go`, { force: true });
} else {
	skipped += 5;
}

// ---- M3: compare refs, cherry-pick, conflict resolve + continue ----
const m3 = "/tmp/ce-m3";
try { rmSync(m3, { recursive: true, force: true }); } catch {}
mkdirSync(`${m3}/src`, { recursive: true });
writeFileSync(`${m3}/src/a.txt`, "line one\n");
execFileSync("git", ["init", "-q", "-b", "main", m3], { stdio: "ignore" });
const git3 = (args) => execFileSync("git", args, { cwd: m3, stdio: "ignore" });
git3(["config", "user.email", "t@t"]);
git3(["config", "user.name", "t"]);
git3(["add", "-A"]);
git3(["commit", "-qm", "base"]);
git3(["checkout", "-qb", "feat"]);
writeFileSync(`${m3}/src/a.txt`, "feat version\n");
writeFileSync(`${m3}/src/only-feat.txt`, "x\n");
git3(["add", "-A"]);
git3(["commit", "-qm", "feat work"]);
const featSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: m3 }).toString().trim();
git3(["checkout", "-q", "main"]);
writeFileSync(`${m3}/src/a.txt`, "main version\n");
git3(["commit", "-qam", "main work"]);
const cmp = await call("git.compare", { cwd: m3, base: "main", head: "feat" });
check("git.compare lists files changed on head side of the merge-base", cmp.ok && cmp.value.files.some((f) => f.path === "src/only-feat.txt" && f.status === "A") && cmp.value.files.some((f) => f.path === "src/a.txt" && f.status === "M"), cmp.value?.files);
check("git.compare reports commit count and shortstat", cmp.ok && cmp.value.commits >= 1 && typeof cmp.value.mergeBase === "string" && cmp.value.mergeBase !== "", cmp.value);
check("git.compare rejects unknown refs", (await call("git.compare", { cwd: m3, base: "nope-xyz", head: "HEAD" })).value?.error !== undefined, null);
check("git.compare rejects flag-shaped refs", /invalid reference/.test((await call("git.compare", { cwd: m3, base: "-Dmain", head: "HEAD" })).value?.error ?? ""), null);
const cmpDiff = await call("git.diff", { cwd: m3, path: "src/a.txt", scope: "compare", base: "main", head: "feat" });
check("git.diff compare scope renders the between-refs file diff", cmpDiff.ok && cmpDiff.value.scope === "compare" && /\+feat version/.test(cmpDiff.value.diff) && /-main version/.test(cmpDiff.value.diff), cmpDiff.value?.diff);
// Cherry-pick the conflicting feat commit onto main: the sequencer opens.
const cp = await call("git.cherryPick", { cwd: m3, sha: featSha });
check("conflicting cherry-pick opens the sequencer with conflicted files", cp.ok && cp.value.conflicted === true && cp.value.status.working.some((f) => f.xy.includes("U")), cp.value);
const cpBad = await call("git.cherryPick", { cwd: m3, sha: "main~2" });
check("cherry-pick rejects non-hex shas without running git", /invalid commit id/.test(cpBad.value?.error ?? ""), cpBad);
// Resolve the conflict taking one side, then continue the sequencer.
const rs = await call("git.resolve", { cwd: m3, path: "src/a.txt", side: "theirs" });
check("resolve-theirs takes the side and stages the file", rs.ok && rs.value.status.working.every((f) => !f.xy.includes("U")) && readFileSync(`${m3}/src/a.txt`, "utf8") === "feat version\n", rs.value);
check("resolve rejects unknown sides", (await call("git.resolve", { cwd: m3, path: "src/a.txt", side: "yours" })).value?.error !== undefined, null);
const cont = await call("git.sequencerContinue", { cwd: m3, kind: "cherry-pick" });
check("sequencerContinue finishes the resolved cherry-pick as a commit", cont.ok && cont.value.error === void 0 && cont.value.status.working.length === 0, cont.value);
const headLog = execFileSync("git", ["log", "--format=%s", "-1"], { cwd: m3 }).toString().trim();
check("the continued commit carries the original subject", headLog === "feat work", headLog);
// And the escape hatch: pick main's own diverging commit again (base blob
// differs from HEAD's) to reopen a conflict, then abort it.
const mainWorkSha = execFileSync("git", ["rev-parse", "HEAD~1"], { cwd: m3 }).toString().trim();
const cp2 = await call("git.cherryPick", { cwd: m3, sha: mainWorkSha });
check("second conflicting pick surfaces conflicts again", cp2.ok && cp2.value.conflicted === true, cp2.value);
const ab = await call("git.sequencerAbort", { cwd: m3, kind: "cherry-pick" });
check("sequencerAbort cleans the sequencer and the tree", ab.ok && ab.value.error === "" && ab.value.status.working.every((f) => !f.xy.includes("U")), ab.value);
const badKind = await call("git.sequencerAbort", { cwd: m3, kind: "rebase -i" });
check("sequencer helpers whitelist the kind", (badKind.value?.error ?? badKind.error) !== undefined, badKind);
try { rmSync(m3, { recursive: true, force: true }); } catch {}
const { parseNameStatusZ } = await import("./lib/host/git.js");
check("parseNameStatusZ threads renames through", JSON.stringify(parseNameStatusZ("M\0src/a.txt\0R100\0src/old.txt\0src/new.txt\0")) === JSON.stringify([{ status: "M", path: "src/a.txt" }, { status: "R", from: "src/old.txt", to: "src/new.txt", path: "src/new.txt" }]), parseNameStatusZ("M\0src/a.txt\0R100\0src/old.txt\0src/new.txt\0"));

// ---- M4: task runner over real npm ----
const hasNpm = (() => { try { return spawnSync("npm", ["--version"], { stdio: "ignore" }).status === 0; } catch { return false; } })();
if (hasNpm) {
	const tdir = "/tmp/ce-tasks";
	rmSync(tdir, { recursive: true, force: true });
	mkdirSync(tdir, { recursive: true });
	writeFileSync(`${tdir}/package.json`, JSON.stringify({ name: "ce-tasks", scripts: { greet: "echo task-greet-line && echo oops >&2 && exit 3", silent: "exit 0" } }));
	const tCwd = tdir;
	const tScripts = await call("task.scripts", { cwd: tCwd });
	check("task.scripts lists package.json scripts", tScripts.ok && Object.hasOwn(tScripts.value.scripts, "greet"), tScripts.value);
	const tUnknown = await call("task.start", { cwd: tCwd, script: "rm-rf" });
	check("task.start refuses scripts absent from package.json", tUnknown.ok && tUnknown.value.error !== undefined && !tUnknown.value.id, tUnknown.value);
	const tBad = await call("task.start", { cwd: tCwd, script: "--flag=x" });
	check("task.start shape-rejects flag-like names before any read", /invalid script name/.test(tBad.value?.error ?? ""), tBad);
	const tNone = await call("task.scripts", { cwd });
	check("task.scripts reports a workspace without package.json", tNone.ok === false || tNone.value.error !== undefined, tNone.value);
	const tStart = await call("task.start", { cwd: tCwd, script: "greet" });
	check("task.start launches a whitelisted script", tStart.ok && tStart.value.id !== undefined, tStart.value);
	let tPoll = await call("task.poll", { id: tStart.value.id, since: 0, waitMs: 20000 });
	const seenText = () => (tPoll.value.chunks ?? []).map((c) => c.text).join("");
	check("task.poll streams stdout once present", tPoll.ok && /task-greet-line/.test(seenText()), seenText());
	// keep polling until the job closes, accumulating everything it retained
	const allChunks = [...(tPoll.value.chunks ?? [])];
	let last = tPoll;
	for (let i = 0; i < 10 && !last.value.done; i++) {
		last = await call("task.poll", { id: tStart.value.id, since: last.value.seq, waitMs: 20000 });
		allChunks.push(...(last.value.chunks ?? []));
	}
	check("task.poll separates stderr chunks", allChunks.some((c) => c.stream === "err") && allChunks.some((c) => c.stream === "out"), allChunks.map((c) => c.stream));
	check("task.poll reports done with the script's exit code", last.value.done === true && last.value.code === 3, last.value);
	tPoll = last;
	const tKill = await call("task.kill", { id: tStart.value.id });
	check("task.kill on a finished job reports already", tKill.ok && tKill.value.already === true, tKill.value);
	const tGone = await call("task.poll", { id: "999", since: 0, waitMs: 200 });
	check("task.poll rejects unknown jobs", tGone.ok && tGone.value.error !== undefined, tGone.value);
	const tStop = await call("task.start", { cwd: tCwd, script: "silent" });
	const tKill2 = await call("task.kill", { id: tStop.value.id });
	check("task.kill requests SIGTERM on a running job", tKill2.ok && tKill2.value.ok === true && tKill2.value.already === void 0, tKill2.value);
	rmSync(tdir, { recursive: true, force: true });
} else {
	skipped += 9;
	console.log("  skip  task runner suite (npm unavailable)");
}

// ---- M5 SSE: event-stream responses switch to cursor-polled capture ----
{
	const { createServer } = await import("node:http");
	const sseSrv = createServer((req, res) => {
		res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
		res.write("data: one\n\n");
		setTimeout(() => {
			res.write("event: update\nid: 7\ndata: {\"n\":2}\n\n");
			res.end();
		}, 250);
	});
	await new Promise((resolvePromise) => sseSrv.listen(0, "127.0.0.1", resolvePromise));
	const sseUrl = `http://127.0.0.1:${sseSrv.address().port}/events`;
	try {
		const st = await call("api.send", { method: "GET", url: sseUrl });
		check("api.send switches event-stream responses to live capture", st.ok && st.value.streaming === true && typeof st.value.id === "string" && st.value.status === 200, st.value);
		const sid = st.value.id;
		let last = st.value;
		let collected = (last.chunks ?? []).map((c) => c.text).join("");
		for (let i = 0; i < 12 && last.done !== true; i++) {
			const env = await call("api.streamPoll", { id: sid, since: last.seq, waitMs: 4000 });
			if (!env.ok) break;
			last = env.value;
			collected += (last.chunks ?? []).map((c) => c.text).join("");
		}
		check("api.streamPoll streams frames until the server closes", last.done === true && /data: one/.test(collected) && /\"n\":2/.test(collected), [last, collected]);
		const gone = await call("api.streamPoll", { id: "nope", since: 0, waitMs: 100 });
		check("api.streamPoll rejects unknown streams", gone.ok && gone.value.error !== undefined, gone.value);
	} finally {
		sseSrv.close();
	}
}

// ---- M5 collection-on-disk ----
{
	const cdir = "/tmp/ce-coll";
	rmSync(cdir, { recursive: true, force: true });
	mkdirSync(`${cdir}/collection/ops`, { recursive: true });
	writeFileSync(`${cdir}/collection/a.bru`, "meta {\n  name: Alpha\n  type: http\n  seq: 1\n}\n\nget {\n  url: https://e.test/a\n}\n");
	writeFileSync(`${cdir}/collection/ops/b.bru`, "meta {\n  name: Bravo\n  type: http\n}\n\npost {\n  url: https://e.test/b\n}\n");
	writeFileSync(`${cdir}/collection/notes.txt`, "not a collection file");
	writeFileSync(`${cdir}/collection/.hidden.bru`, "skipped");
	const cl = await call("collection.load", { cwd: cdir, dir: "collection" });
	check("collection.load walks .bru files recursively with paths", cl.ok && cl.value.files.length === 2 && cl.value.files.some((f) => f.path === "ops/b.bru") && cl.value.files.some((f) => f.text.includes("Alpha")), cl.value?.files?.map((f) => f.path));
	check("collection.load hides dotfiles and non-bru entries", !(cl.value?.files ?? []).some((f) => f.path.includes(".hidden") || f.path.endsWith(".txt")), cl.value?.files?.map((f) => f.path));
	const clOut = await call("collection.load", { cwd: cdir, dir: "../escape" });
	check("collection.load refuses escaping the workspace", clOut.ok === false || clOut.value?.error !== undefined, clOut.value ?? clOut);
	const cs = await call("collection.save", { cwd: cdir, dir: "collection", name: "Gamma", text: "meta {\n  name: Gamma\n  type: http\n}\n\nget {\n  url: https://e.test/g\n}\n" });
	check("collection.save writes <name>.bru inside the directory", cs.ok && cs.value.created === true && cs.value.path === "collection/Gamma.bru" && existsSync(`${cdir}/collection/Gamma.bru`), cs.value);
	const csBad = await call("collection.save", { cwd: cdir, dir: "collection", name: "../evil", text: "x" });
	check("collection.save refuses path-shaped names", (csBad.value?.error ?? csBad.error ?? "").includes("invalid"), csBad);
	const csNoDir = await call("collection.save", { cwd: cdir, dir: "missing", name: "N", text: "x" });
	check("collection.save refuses a missing directory instead of creating it", csNoDir.value?.error !== undefined && !existsSync(`${cdir}/missing`), csNoDir.value);
	const again = await call("collection.load", { cwd: cdir, dir: "collection" });
	check("saved entry round-trips into the next load", again.ok && again.value.files.some((f) => f.path === "Gamma.bru" && f.text.includes("Gamma")), again.value?.files?.map((f) => f.path));
	rmSync(cdir, { recursive: true, force: true });
}

// ---- Changes delete: untracked has no revert path ----
{
	const ddir = "/tmp/ce-delcheck";
	rmSync(ddir, { recursive: true, force: true });
	mkdirSync(ddir, { recursive: true });
	writeFileSync(`${ddir}/tracked.txt`, "v1\n");
	execFileSync("git", ["init", "-q", ddir], { stdio: "ignore" });
	const gitD = (args) => execFileSync("git", args, { cwd: ddir, stdio: "ignore" });
	gitD(["config", "user.email", "t@t"]); gitD(["config", "user.name", "t"]);
	gitD(["add", "-A"]); gitD(["commit", "-qm", "init"]);
	writeFileSync(`${ddir}/untracked.txt`, "new\n");
	writeFileSync(`${ddir}/tracked.txt`, "v2\n");
	const discUntracked = await call("git.discard", { cwd: ddir, path: "untracked.txt", ch: "U" });
	check("git.discard refuses untracked with an explicit reason", discUntracked.ok && discUntracked.value.untracked === true && /no committed version/.test(discUntracked.value.error), discUntracked.value);
	check("the refused discard left the untracked file on disk", existsSync(`${ddir}/untracked.txt`), null);
	const discTracked = await call("git.discard", { cwd: ddir, path: "tracked.txt", ch: "M" });
	check("git.discard still reverts tracked modifications", discTracked.ok && discTracked.value.error === void 0 && readFileSync(`${ddir}/tracked.txt`, "utf8") === "v1\n", discTracked.value);
	const delUntracked = await call("fs.delete", { cwd: ddir, path: "untracked.txt" });
	check("fs.delete removes the untracked file through the fence", delUntracked.ok && !existsSync(`${ddir}/untracked.txt`), delUntracked.value);
	rmSync(ddir, { recursive: true, force: true });
}

for (const cleanup of cleanups) cleanup();

// --- database drivers: SQLite through node:sqlite ---------------------------------------
{
	const db = await import("./lib/host/db.js");
	let sqliteAvailable = false;
	try { await import("node:sqlite"); sqliteAvailable = true; } catch {}
	if (sqliteAvailable) {
		const file = `${cwd}-db.sqlite`;
		rmSync(file, { force: true });
		const conn = await db.connect({ driver: "sqlite", path: file });
		check("db.connect opens an SQLite file and returns its id", typeof conn.id === "string" && conn.driver === "sqlite", conn);
		check("db.connections lists the open connection", db.listConnections().some((entry) => entry.id === conn.id), null);
		await db.query(conn.id, "CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER)");
		await db.query(conn.id, "CREATE INDEX users_name ON users(name)");
		await db.query(conn.id, "INSERT INTO users(name, age) VALUES('Alice', 30), ('Bob', 25), ('Carol', 28)");

		const schema = await db.schema(conn.id);
		const table = schema.databases[0].tables.find((entry) => entry.name === "users");
		check("db.schema lists the table with its columns", Boolean(table) && table.columns.length === 3, table?.columns?.map((c) => c.name));
		check("db.schema marks the primary key and NOT NULL", table.columns.find((c) => c.name === "id").primaryKey === true && table.columns.find((c) => c.name === "name").nullable === false, table.columns);
		check("db.schema lists the index", table.indexes.some((index) => index.name === "users_name" && index.columns.includes("name")), table.indexes);

		const page = await db.rows(conn.id, "users", { limit: 2, offset: 0, order: "id", dir: "asc" });
		check("db.rows pages a table with the total", page.rows.length === 2 && page.total === 3 && page.columns.includes("name"), page);
		const second = await db.rows(conn.id, "users", { limit: 2, offset: 2, order: "id", dir: "asc" });
		check("db.rows returns the following page", second.rows.length === 1 && second.rows[0][1] === "Carol", second.rows);
		const desc = await db.rows(conn.id, "users", { limit: 1, offset: 0, order: "id", dir: "desc" });
		check("db.rows honours descending order", desc.rows[0][1] === "Carol", desc.rows);
		const filtered = await db.rows(conn.id, "users", { limit: 10, offset: 0, filter: "li" });
		check("db.rows filters across every column and counts the match", filtered.total === 1 && filtered.rows[0][1] === "Alice", filtered);
		const injected = await db.rows(conn.id, "users", { limit: 10, offset: 0, filter: "O'Reilly" });
		check("db.rows treats a quote in the filter as data", injected.total === 0, injected.total);

		const read = await db.query(conn.id, "SELECT name FROM users ORDER BY id");
		check("db.query returns columns and rows", read.columns[0] === "name" && read.rows.length === 3 && read.rows[0][0] === "Alice", read);
		const written = await db.query(conn.id, "UPDATE users SET age = age + 1");
		check("db.query reports the affected row count", written.changes === 3, written);
		const capped = await db.query(conn.id, "SELECT * FROM users", 1);
		check("db.query truncates at the limit and says so", capped.rows.length === 1 && capped.truncated === true, capped);
		check("db.query refuses an empty statement", await db.query(conn.id, "   ").then(() => false, () => true), null);

		// The same operations through the HTTP dispatcher the panel uses.
		const drivers = await call("db.drivers", {});
		check("db.drivers answers over the private API", drivers.ok && drivers.value.some((driver) => driver.id === "sqlite" && driver.ready), drivers.value);
		const viaApi = await call("db.connect", { driver: "sqlite", path: file });
		check("db.connect answers over the private API", viaApi.ok && typeof viaApi.value.id === "string", viaApi.value);
		const apiSchema = await call("db.schema", { id: viaApi.value.id });
		check("db.schema answers over the private API", apiSchema.ok && apiSchema.value.databases[0].tables.some((entry) => entry.name === "users"), apiSchema.value?.databases?.[0]?.tables?.map((t) => t.name));
		const apiRows = await call("db.rows", { id: viaApi.value.id, table: "users", limit: 2, offset: 0 });
		check("db.rows answers over the private API", apiRows.ok && apiRows.value.rows.length === 2 && apiRows.value.total === 3, apiRows.value);
		const apiQuery = await call("db.query", { id: viaApi.value.id, sql: "SELECT COUNT(*) FROM users" });
		check("db.query answers over the private API", apiQuery.ok && apiQuery.value.rows[0][0] === 3, apiQuery.value);
		await call("db.disconnect", { id: viaApi.value.id });

		check("SQLite runs in a worker so the Host stays responsive", conn.mode === "worker", conn.mode);

		// A relative path belongs to the session workspace, never to the Host's
		// own working directory.
		const relFile = `${cwd}-rel.sqlite`;
		rmSync(relFile, { force: true });
		const rel = await db.connect({ driver: "sqlite", path: "../ce-test-rel.sqlite", cwd });
		check("a relative SQLite path resolves against the session workspace", rel.path === relFile && existsSync(relFile), rel.path);
		db.disconnect(rel.id);
		const noBase = await db.connect({ driver: "sqlite", path: "rel.sqlite" }).then(() => null, (error) => error);
		check("a relative path without a workspace is refused", noBase !== null && /absolute path/.test(noBase.message), String(noBase));
		rmSync(relFile, { force: true });

		// A second connection for the cancellation path (cancelling ends it).
		const slowConn = await db.connect({ driver: "sqlite", path: file });
		let ticks = 0;
		const timer = setInterval(() => { ticks += 1; }, 5);
		const pendingToken = "slow-statement-1";
		const slow = db.query(slowConn.id, "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 4000000) SELECT count(*) FROM c", 5000, pendingToken);
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
		clearInterval(timer);
		check("a long SQLite query does not block the event loop", ticks >= 3, ticks);
		const pendingRejection = slow.then(() => null, (error) => error);
		// Cancelling names a statement: a stale token must not stop the connection.
		const wrongToken = await db.cancel(slowConn.id, "some-other-statement");
		check("cancelling with a stale token leaves the connection alone", wrongToken.cancelled === false && db.listConnections().some((entry) => entry.id === slowConn.id), wrongToken);
		const cancelled = await db.cancel(slowConn.id, pendingToken);
		check("db.cancel ends a running SQLite statement", cancelled.cancelled === true && cancelled.connectionClosed === true, cancelled);
		check("the cancelled statement rejects instead of hanging", (await pendingRejection) !== null, null);
		check("a cancelled connection is gone from the list", !db.listConnections().some((entry) => entry.id === slowConn.id), null);

		db.disconnect(conn.id);
		check("db.disconnect closes the connection", !db.listConnections().some((entry) => entry.id === conn.id), null);
		check("a closed connection refuses further queries", await db.query(conn.id, "SELECT 1").then(() => false, () => true), null);
		rmSync(file, { force: true });
	} else {
		console.log("  skip  db SQLite tests (node:sqlite unavailable on this Node version)");
		skipped += 13;
	}
}

// --- psql CSV parsing (NULL vs empty, embedded separators) ------------------------------
{
	const { parseCsv } = await import("./lib/host/db.js");
	const parsed = parseCsv('id,name,note\n1,"a,b","line\nbreak"\n2,"say ""hi""",\\N\n');
	check("parseCsv keeps a quoted comma in one cell", parsed[1][1] === "a,b", parsed[1]);
	check("parseCsv keeps an embedded newline in one cell", parsed[1][2] === "line\nbreak", parsed[1][2]);
	check("parseCsv unescapes doubled quotes", parsed[2][1] === 'say "hi"', parsed[2][1]);
	check("parseCsv maps the NULL marker to null", parsed[2][2] === null, parsed[2][2]);
	check("parseCsv drops the trailing newline row", parsed.length === 3, parsed.length);
}

// --- executable resolution (PATH, project-local, per-user installs) ---------------------
{
	const { binaryCandidates, findBinary, clearBinaryCache, findBinaries } = await import("./lib/host/binpath.js");
	const root = `${cwd}-binpath`;
	rmSync(root, { recursive: true, force: true });
	mkdirSync(`${root}/node_modules/.bin`, { recursive: true });
	mkdirSync(`${root}/.venv/bin`, { recursive: true });
	mkdirSync(`${root}-path`, { recursive: true });
	const fake = (path) => { writeFileSync(path, "#!/bin/sh\nexit 0\n", { mode: 0o755 }); };
	fake(`${root}/node_modules/.bin/typescript-language-server`);
	fake(`${root}/.venv/bin/pyright-langserver`);
	fake(`${root}-path/typescript-language-server`);

	clearBinaryCache();
	const local = findBinary("typescript-language-server", { root, env: { PATH: `${root}-path` } });
	check("a project-local server wins over a PATH one", local === `${root}/node_modules/.bin/typescript-language-server`, local);
	const pathOnly = findBinary("typescript-language-server", { root: `${cwd}-elsewhere`, env: { PATH: `${root}-path` } });
	check("PATH is searched when the project has none", pathOnly === `${root}-path/typescript-language-server`, pathOnly);
	const venv = findBinary("pyright-langserver", { root, env: { PATH: "" } });
	check("a project virtualenv is searched for Python servers", venv === `${root}/.venv/bin/pyright-langserver`, venv);
	check("a missing binary resolves to null", findBinary("definitely-not-installed-lsp", { root, env: { PATH: "" } }) === null, null);

	clearBinaryCache();
	const overridden = findBinary("typescript-language-server", { root, env: { PATH: `${root}-path`, DSH_TYPESCRIPT_LANGUAGE_SERVER_BIN: `${root}/.venv/bin/pyright-langserver` } });
	check("an explicit DSH_*_BIN override wins", overridden === `${root}/.venv/bin/pyright-langserver`, overridden);

	const candidates = binaryCandidates("pyright-langserver", { root, env: { PATH: `${root}-path` } });
	check("candidate order puts the project first and the bare name last", candidates[0].startsWith(root) && candidates.at(-1) === "pyright-langserver", [candidates[0], candidates.at(-1)]);
	check("findBinaries returns every available name", findBinaries(["pyright-langserver", "pylsp"], { root }).includes(`${root}/.venv/bin/pyright-langserver`), null);

	// The language-server table resolves through the same lookup.
	const { LANGUAGE_SERVERS } = await import("./lib/host/lsp.js");
	const ts = LANGUAGE_SERVERS.find((entry) => entry.id === "ts");
	const launchers = ts.launchers(root);
	check("the TypeScript server launcher prefers the project binary", launchers[0].command === `${root}/node_modules/.bin/typescript-language-server` && launchers[0].args[0] === "--stdio", launchers[0]);
	check("a missing server explains how to install it", typeof ts.install === "string" && ts.install.includes("typescript-language-server"), ts.install);
	rmSync(root, { recursive: true, force: true });
	rmSync(`${root}-path`, { recursive: true, force: true });
	clearBinaryCache();
}

// --- a project-local language server, started through its node interpreter ---------------
{
	// The exact regression: an npm-installed server is a `#!…node` script, and a
	// Desktop Host's PATH has no `node`, so spawning it directly fails with
	// ENOENT on a file that exists. The fake server below only works if the
	// plugin starts it with a real Node and speaks the framing correctly.
	const root = `${cwd}-lsp`;
	rmSync(root, { recursive: true, force: true });
	mkdirSync(`${root}/node_modules/.bin`, { recursive: true });
	writeFileSync(`${root}/tsconfig.json`, "{}\n");
	writeFileSync(`${root}/a.ts`, "export const a = 1;\n");
	writeFileSync(`${root}/node_modules/.bin/typescript-language-server`, `#!/usr/bin/env node
let buf = Buffer.alloc(0);
function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write("Content-Length: " + Buffer.byteLength(body) + "\\r\\n\\r\\n" + body);
}
function handle(message) {
  if (message.method === "initialize") {
    send({ jsonrpc: "2.0", id: message.id, result: { capabilities: { hoverProvider: true, referencesProvider: true } } });
    return;
  }
  if (message.method === "textDocument/hover") {
    send({ jsonrpc: "2.0", id: message.id, result: { contents: "fake hover" } });
    return;
  }
  if (message.method === "textDocument/references") {
    send({ jsonrpc: "2.0", id: message.id, result: [] });
    return;
  }
  if (message.id !== undefined) send({ jsonrpc: "2.0", id: message.id, result: null });
}
process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const sep = buf.indexOf("\\r\\n\\r\\n");
    if (sep < 0) return;
    const match = /Content-Length: (\\d+)/i.exec(buf.subarray(0, sep).toString());
    const length = Number(match && match[1]);
    if (buf.length < sep + 4 + length) return;
    const message = JSON.parse(buf.subarray(sep + 4, sep + 4 + length).toString());
    buf = buf.subarray(sep + 4 + length);
    handle(message);
  }
});
`, { mode: 0o755 });

	const { routes } = await import("./lib/host/routes.js");
	const hovered = await routes["lsp.request"]({ cwd: root, path: "a.ts", kind: "hover", line: 1, col: 5 });
	check("a project-local server starts through its node interpreter", hovered.status?.state === "ready" && hovered.hover === "fake hover", hovered);
	const refs = await routes["lsp.request"]({ cwd: root, path: "a.ts", kind: "references", line: 1, col: 5 });
	check("references go through the same project-local server", Array.isArray(refs.targets) && refs.targets.length === 0, refs);
	rmSync(root, { recursive: true, force: true });
}

// --- CLI drivers: keg-only discovery and an explicit client path -----------------------
{
	// Homebrew keeps mysql-client and postgresql@N out of the normal bin dir, so a
	// PATH scan alone reports "not installed" on a machine that has them.
	const brew = `${cwd}-brew`;
	rmSync(brew, { recursive: true, force: true });
	mkdirSync(`${brew}/opt/mysql-client/bin`, { recursive: true });
	writeFileSync(`${brew}/opt/mysql-client/bin/mysql`, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
	const { binaryCandidates, findBinary, clearBinaryCache, kegOnlyBins } = await import("./lib/host/binpath.js");
	clearBinaryCache();
	check("a keg-only Homebrew binary is discovered", findBinary("mysql", { env: { PATH: "" }, brewRoots: [brew] }) === `${brew}/opt/mysql-client/bin/mysql`, findBinary("mysql", { env: { PATH: "" }, brewRoots: [brew] }));
	check("keg-only candidates are tried before the bare PATH fallback", (() => {
		const list = binaryCandidates("mysql", { env: { PATH: "" }, brewRoots: [brew] });
		const keg = list.indexOf(`${brew}/opt/mysql-client/bin/mysql`);
		return keg !== -1 && keg < list.indexOf("mysql");
	})(), binaryCandidates("mysql", { env: { PATH: "" }, brewRoots: [brew] }).slice(0, 3));
	check("kegOnlyBins scans opt, Cellar and Postgres.app without throwing", Array.isArray(kegOnlyBins("psql", [brew])), null);

	// A client the dialog names by path is used instead of a PATH lookup: this is
	// what makes a keg-only or custom install (or a container's client) work.
	const fakeBin = `${brew}/fake-mysql`;
	writeFileSync(fakeBin, "#!/bin/sh\nprintf 'answer\\n1\\n'\n", { mode: 0o755 });
	const db = await import("./lib/host/db.js");
	const conn = await db.connect({ driver: "mysql", host: "example.test", user: "u", database: "d", clientPath: fakeBin });
	check("a connection can name its own client binary", conn?.driver === "mysql", conn);
	const queried = await db.query(conn.id, "SELECT 1");
	check("a path-backed client answers queries", queried.columns?.[0] === "answer" && queried.rows?.[0]?.[0] === "1", queried);
	db.disconnect(conn.id);

	const refused = await db.connect({ driver: "mysql", host: "example.test" }).then(() => null, (error) => error);
	check("a missing client is refused with an install hint", refused !== null && /install it/.test(refused.message) && /client path/.test(refused.message), String(refused));
	const drivers = await db.listDrivers();
	check("driver notes name the install command and the escape hatch", drivers.every((entry) => entry.ready || /client path/.test(entry.note) || /Node/.test(entry.note)), drivers);
	rmSync(brew, { recursive: true, force: true });
	clearBinaryCache();
}

// --- saved database connections (profiles + vault-held passwords) ------------------------
{
	const { createVaultService } = await import("./lib/host/vault.js");
	const { createDbProfileService } = await import("./lib/host/dbprofiles.js");
	const makeStorage = () => ({
		async open(spec) {
			let value = structuredClone(spec.global.initial);
			return { global: { get: () => value, async set(next) { value = structuredClone(next); } }, async close() {} };
		},
	});
	const vault = createVaultService(makeStorage());
	const profiles = createDbProfileService(makeStorage(), vault);

	const saved = await profiles.save({ label: "demo", driver: "sqlite", address: "/tmp/demo.sqlite", path: "/tmp/demo.sqlite", password: "s3cret" });
	check("a saved connection returns its profile", Boolean(saved.profile?.id) && saved.profile.label === "demo", saved);
	check("the profile never carries the password", !Object.hasOwn(saved.profile, "password") && saved.profile.secretId !== "", saved.profile);
	check("the saved list holds the profile", (await profiles.list()).profiles.length === 1, null);
	check("the password is resolved only on the host", (await profiles.resolve(saved.profile.id))?.password === "s3cret", null);

	const updated = await profiles.save({ id: saved.profile.id, label: "renamed" });
	check("saving without a password keeps the stored secret", updated.profile.secretId === saved.profile.secretId && (await profiles.passwordOf(saved.profile.id)) === "s3cret", updated.profile);
	check("saving keeps fields it was not given", updated.profile.path === "/tmp/demo.sqlite" && updated.profile.driver === "sqlite", updated.profile);

	const conflicted = await profiles.save({ id: saved.profile.id, label: "stale", baseRevision: 0 }).then(() => null, (error) => error);
	check("a stale revision is refused instead of overwriting", conflicted !== null && /conflict/i.test(conflicted.message), String(conflicted));

	const gone = await profiles.remove(saved.profile.id);
	const afterDelete = await vault.execute({ action: "get", ids: [saved.profile.secretId] });
	check("removing a profile removes it and its secret", gone.removed === true && (await profiles.list()).profiles.length === 0 && afterDelete.values[saved.profile.secretId] === undefined, gone);

	let sqliteAvailable = false;
	try { await import("node:sqlite"); sqliteAvailable = true; } catch {}
	if (sqliteAvailable) {
		const db = await import("./lib/host/db.js");
		db.setDbProfileService(profiles);
		const file = `${cwd}-profile.sqlite`;
		rmSync(file, { force: true });
		const made = await profiles.save({ label: "saved", driver: "sqlite", address: file, path: file });
		const conn = await db.connect({ profileId: made.profile.id });
		check("db.connect opens a saved connection by id", conn?.driver === "sqlite" && conn.mode === "worker", conn);
		const queried = await db.query(conn.id, "SELECT 1 AS one");
		check("a profile-backed connection answers queries", queried.rows[0][0] === 1, queried);
		db.disconnect(conn.id);
		db.setDbProfileService(null);
		const refused = await db.connect({ profileId: made.profile.id }).then(() => null, (error) => error);
		check("without the profile service a profile id is refused", refused !== null, String(refused));
		rmSync(file, { force: true });
	} else {
		skipped += 3;
	}
	await profiles.close();
	await vault.close();
}

// --- RPC: proto route and a real gRPC round trip ----------------------------------------
{
	const protoDir = `${cwd}-rpc`;
	rmSync(protoDir, { recursive: true, force: true });
	mkdirSync(protoDir, { recursive: true });
	writeFileSync(`${protoDir}/hello.proto`, `syntax = "proto3";
package hello;

message HelloRequest { string greeting = 1; int32 times = 2; }
message HelloReply { string message = 1; int32 served = 2; }

service HelloService {
  rpc SayHello (HelloRequest) returns (HelloReply);
}
`);
	// A second file importing the first: the request type lives across files.
	writeFileSync(`${protoDir}/common.proto`, 'syntax = "proto3";\npackage common;\nmessage Money { int64 cents = 1; }\n');
	writeFileSync(`${protoDir}/order.proto`, 'syntax = "proto3";\npackage shop;\nimport "common.proto";\nmessage Order { string id = 1; common.Money total = 2; }\nservice Orders { rpc Get (Order) returns (Order); }\n');
	const imported = await call("rpc.proto", { cwd: protoDir, path: "order.proto" });
	check("rpc.proto follows an import and lists its file", imported.ok && imported.value.files.includes("common.proto"), imported.value?.files ?? imported.error);
	check("rpc.proto resolves a type declared in the imported file", imported.ok && imported.value.methods[0].sample?.total?.cents === 0, imported.value?.methods?.[0]?.sample);
	rmSync(`${protoDir}/common.proto`, { force: true });
	rmSync(`${protoDir}/order.proto`, { force: true });

	const loaded = await call("rpc.proto", { cwd: protoDir, path: "hello.proto" });
	check("rpc.proto lists the service methods", loaded.ok && loaded.value.methods.length === 1, loaded.value?.methods ?? loaded.error);
	check("rpc.proto carries a ready-to-edit sample body", loaded.ok && loaded.value.methods[0].sample?.greeting === "", loaded.value?.methods?.[0]?.sample);
	const missing = await call("rpc.proto", { cwd: protoDir, path: "nope.proto" });
	check("rpc.proto reports a missing file instead of throwing", missing.ok === false || Boolean(missing.value?.error), missing);

	// A minimal in-process gRPC server: HTTP/2 plus the framing convention.
	const http2 = await import("node:http2");
	const { readFile: readTextFile } = await import("node:fs/promises");
	const { encodeMessage, decodeMessage } = await import("./lib/host/protobuf.js");
	const { parseProto } = await import("./lib/host/proto.js");
	const schema = parseProto(await readTextFile(`${protoDir}/hello.proto`, "utf8"));
	const server = http2.createServer();
	server.on("stream", (stream, headers) => {
		if (headers[":path"] !== "/hello.HelloService/SayHello") {
			stream.respond({ ":status": 200, "content-type": "application/grpc" }, { waitForTrailers: true });
			stream.on("wantTrailers", () => stream.sendTrailers({ "grpc-status": "12", "grpc-message": "unimplemented" }));
			stream.end();
			return;
		}
		const chunks = [];
		stream.on("data", (chunk) => chunks.push(chunk));
		stream.on("end", () => {
			const body = Buffer.concat(chunks);
			const payload = body.subarray(5, 5 + body.readUInt32BE(1));
			const request = decodeMessage(schema, "hello.HelloRequest", payload);
			const times = Math.max(1, Number(request.times) || 1);
			const reply = encodeMessage(schema, "hello.HelloReply", { message: `hi ${request.greeting}`, served: times });
			const frame = Buffer.alloc(5);
			frame[0] = 0;
			frame.writeUInt32BE(reply.length, 1);
			stream.respond({ ":status": 200, "content-type": "application/grpc" }, { waitForTrailers: true });
			stream.on("wantTrailers", () => stream.sendTrailers({ "grpc-status": "0", "grpc-message": "" }));
			stream.write(Buffer.concat([frame, reply]));
			stream.end();
		});
	});
	const port = await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", () => resolvePromise(server.address().port)));
	try {
		const reply = await call("rpc.call", {
			cwd: protoDir,
			proto: "hello.proto",
			method: "/hello.HelloService/SayHello",
			url: `grpc://127.0.0.1:${port}`,
			messages: [{ greeting: "ada", times: 2 }],
		});
		check("rpc.call reaches a real gRPC server", reply.ok && reply.value.status === 0 && reply.value.statusName === "OK", reply.value ?? reply.error);
		check("rpc.call decodes the protobuf reply", reply.ok && reply.value.messages?.[0]?.message === "hi ada" && reply.value.messages[0].served === 2, reply.value?.messages);
		check("rpc.call reports timing and trailers", reply.ok && typeof reply.value.ms === "number" && reply.value.trailers["grpc-status"] === "0", reply.value?.trailers);
		const unknown = await call("rpc.call", { cwd: protoDir, proto: "hello.proto", method: "/hello.Missing/Nope", url: `grpc://127.0.0.1:${port}` });
		check("rpc.call refuses an unknown method", unknown.ok && Boolean(unknown.value.error), unknown.value);
		const down = await call("rpc.call", { cwd: protoDir, proto: "hello.proto", method: "/hello.HelloService/SayHello", url: "grpc://127.0.0.1:1" });
		check("rpc.call surfaces a connection failure as an error", down.ok && Boolean(down.value.error), down.value);
	} finally {
		await new Promise((resolvePromise) => server.close(resolvePromise));
		rmSync(protoDir, { recursive: true, force: true });
	}
}

// --- gRPC reflection: discover a schema without a .proto --------------------------------
{
	const http2 = await import("node:http2");
	const { encodeMessage, decodeMessage } = await import("./lib/host/protobuf.js");
	const { REFLECTION_SCHEMA } = await import("./lib/host/grpc-reflect.js");
	const { schemaFromDescriptors } = await import("./lib/host/grpc-reflect.js");

	// The descriptor set a server would hand out, encoded exactly as protoc would.
	const descriptor = {
		name: "hello.proto",
		package: "hello",
		syntax: "proto3",
		message_type: [
			{ name: "HelloRequest", field: [{ name: "greeting", number: 1, label: 1, type: 9 }] },
			{ name: "HelloReply", field: [{ name: "message", number: 1, label: 1, type: 9 }] },
		],
		service: [{
			name: "HelloService",
			method: [{ name: "SayHello", input_type: ".hello.HelloRequest", output_type: ".hello.HelloReply" }],
		}],
	};
	const descriptorBytes = encodeMessage(REFLECTION_SCHEMA, "google.protobuf.FileDescriptorProto", descriptor);

	const reply = (stream, message) => {
		const payload = encodeMessage(REFLECTION_SCHEMA, "grpc.reflection.v1alpha.ServerReflectionResponse", message);
		const header = Buffer.alloc(5);
		header.writeUInt32BE(payload.length, 1);
		stream.respond({ ":status": 200, "content-type": "application/grpc" }, { waitForTrailers: true });
		stream.on("wantTrailers", () => stream.sendTrailers({ "grpc-status": "0" }));
		stream.write(Buffer.concat([header, payload]));
		stream.end();
	};

	const server = http2.createServer();
	server.on("stream", (stream) => {
		const chunks = [];
		stream.on("data", (chunk) => chunks.push(chunk));
		stream.on("end", () => {
			const body = Buffer.concat(chunks);
			const payload = body.subarray(5, 5 + body.readUInt32BE(1));
			const request = decodeMessage(REFLECTION_SCHEMA, "grpc.reflection.v1alpha.ServerReflectionRequest", payload);
			if (request.list_services !== undefined) {
				reply(stream, { list_services_response: { service: [{ name: "hello.HelloService" }] } });
				return;
			}
			if (request.file_containing_symbol === "hello.HelloService") {
				reply(stream, { file_descriptor_response: { file_descriptor_proto: [descriptorBytes] } });
				return;
			}
			reply(stream, { error_response: { error_code: 5, error_message: "not found" } });
		});
	});
	const port = await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", () => resolvePromise(server.address().port)));
	try {
		const found = await call("rpc.discover", { url: `grpc://127.0.0.1:${port}` });
		check("rpc.discover lists the server's services", found.ok && found.value.services?.includes("hello.HelloService"), found.value ?? found.error);
		check("rpc.discover reports the reflection version it used", /^grpc\.reflection\.v1\./.test(String(found.value?.reflection)), found.value?.reflection);
		check("rpc.discover builds the method list", found.ok && found.value.methods?.some((method) => method.name === "SayHello" && method.path === "/hello.HelloService/SayHello"), found.value?.methods);
		check("rpc.discover hands back an editable sample body", found.ok && found.value.methods[0]?.sample?.greeting === "", found.value?.methods?.[0]?.sample);
		check("rpc.discover keeps a schema id for the call route", typeof found.value?.schemaId === "string" && found.value.schemaId !== "", found.value?.schemaId);
		check("rpc.discover reports the services it could not describe", Array.isArray(found.value.skipped), found.value.skipped);
		const unknown = await call("rpc.call", { url: `grpc://127.0.0.1:${port}`, schemaId: "gone", method: "/hello.HelloService/SayHello" });
		check("rpc.call reports an expired discovered schema", unknown.ok && /Discover/.test(unknown.value.error ?? ""), unknown.value);
	} finally {
		await new Promise((resolvePromise) => server.close(resolvePromise));
	}

	// The descriptor fold itself: nested types, enums, maps and streaming flags.
	const folded = schemaFromDescriptors([
		{
			name: "svc.proto",
			package: "demo",
			message_type: [
				{
					name: "Outer",
					field: [
						{ name: "inner", number: 1, label: 1, type: 11, type_name: ".demo.Outer.Inner" },
						{ name: "tags", number: 2, label: 3, type: 9 },
						{ name: "attrs", number: 3, label: 3, type: 11, type_name: ".demo.Outer.AttrsEntry" },
					],
					nested_type: [
						{ name: "Inner", field: [{ name: "id", number: 1, label: 1, type: 5 }] },
						{
							name: "AttrsEntry",
							options: { map_entry: true },
							field: [
								{ name: "key", number: 1, label: 1, type: 9 },
								{ name: "value", number: 2, label: 1, type: 5 },
							],
						},
					],
				},
			],
			enum_type: [{ name: "Kind", value: [{ name: "A", number: 0 }, { name: "B", number: 1 }] }],
			service: [{ name: "Svc", method: [{ name: "Watch", input_type: ".demo.Outer", output_type: ".demo.Outer", server_streaming: true }] }],
		},
	]);
	check("descriptor fold keeps nested messages", Boolean(folded.messages["demo.Outer.Inner"]), Object.keys(folded.messages));
	check("descriptor fold declares a map field as a map", folded.messages["demo.Outer"].fields.attrs.map === true && folded.messages["demo.Outer"].fields.attrs.mapValue === "int32", folded.messages["demo.Outer"].fields.attrs);
	check("descriptor fold keeps repeated-ness", folded.messages["demo.Outer"].fields.tags.repeated === true, folded.messages["demo.Outer"].fields.tags);
	check("descriptor fold keeps enums", folded.enums["demo.Kind"]?.values?.B === 1, folded.enums["demo.Kind"]);
	check("descriptor fold keeps streaming flags", folded.services["demo.Svc"].methods[0].serverStreaming === true, folded.services["demo.Svc"]);
}

console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
process.exit(fail ? 1 : 0);
