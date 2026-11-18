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

// --- vault service: secret persistence for the API workbench ---------------------------
{
	const { createVaultService } = await import("./lib/host/vault.js");
	let stored;
	const fakeStorageDomain = {
		async open(spec) {
			stored = structuredClone(spec.global.initial);
			return { global: { get: () => stored, async set(next) { stored = structuredClone(next); } }, async close() {} };
		},
	};
	const vault = createVaultService(fakeStorageDomain);
	const set1 = await vault.execute({ action: "set", entries: [{ key: "auth.token", value: "sk-secret-123" }] });
	check("vault.set mints an id and stores the secret", typeof set1.ids["auth.token"] === "string" && set1.revision === 1, set1);
	const got = await vault.execute({ action: "get", ids: [set1.ids["auth.token"]] });
	check("vault.get returns the stored plaintext", got.values[set1.ids["auth.token"]] === "sk-secret-123", got.values);
	const set2 = await vault.execute({ action: "set", entries: [{ key: "env.var", value: "DB_PASS=secret" }] });
	check("vault.set mints a second independent id", set2.ids["env.var"] !== set1.ids["auth.token"], set2.ids);
	const reSet = await vault.execute({ action: "set", entries: [{ key: "auth.token", id: set1.ids["auth.token"], value: "sk-updated" }] });
	check("vault.set with existing id updates in place", reSet.ids["auth.token"] === set1.ids["auth.token"], reSet.ids);
	const gotUpdated = await vault.execute({ action: "get", ids: [set1.ids["auth.token"]] });
	check("vault.get returns the updated value", gotUpdated.values[set1.ids["auth.token"]] === "sk-updated", gotUpdated.values);
	const del = await vault.execute({ action: "delete", ids: [set1.ids["auth.token"]] });
	check("vault.delete removes the entry", !Object.hasOwn(stored.secrets, set1.ids["auth.token"]), null);
	const gotAfterDel = await vault.execute({ action: "get", ids: [set1.ids["auth.token"]] });
	check("vault.get after delete returns nothing for that id", !Object.hasOwn(gotAfterDel.values, set1.ids["auth.token"]), gotAfterDel.values);
	await vault.close();
	await assert.rejects(vault.execute({ action: "get", ids: [] }), /closed/, "vault refuses after close");
}

console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
process.exit(fail ? 1 : 0);
