// Real remote round-trip: behind→fetch→pull ff; diverged→pull refused; no-upstream inferred.
import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";

const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const root = "/tmp/ce-remote";
try { sh("rm", ["-rf", root]); } catch {}
sh("mkdir", ["-p", root]);
// bare origin
sh("git", ["init", "-q", "--bare", `${root}/origin.git`]);
// seed via work clone
sh("mkdir", ["-p", `${root}/seed`]);
sh("git", ["init", "-q"], `${root}/seed`);
sh("git", ["config", "user.email", "t@t"], `${root}/seed`);
sh("git", ["config", "user.name", "t"], `${root}/seed`);
sh("sh", ["-c", "printf 'package m\\n\\nvar A = 1\\n' > a.go"], `${root}/seed`);
sh("git", ["add", "a.go"], `${root}/seed`);
sh("git", ["commit", "-qm", "c1"], `${root}/seed`);
sh("git", ["branch", "-M", "main"], `${root}/seed`);
sh("git", ["remote", "add", "origin", `${root}/origin.git`], `${root}/seed`);
sh("git", ["push", "-q", "origin", "main"], `${root}/seed`);
// cloneA: tracks main
sh("git", ["clone", "-q", "-b", "main", `${root}/origin.git`, `${root}/A`]);
// cloneB forked at c1 (before origin advances) → will diverge after both move
sh("git", ["clone", "-q", "-b", "main", `${root}/origin.git`, `${root}/B`]);
sh("git", ["config", "user.email", "t@t"], `${root}/B`);
sh("git", ["config", "user.name", "t"], `${root}/B`);
// origin advances (via seed) → A and B behind by 1
sh("sh", ["-c", "printf 'package m\\n\\nvar A = 1\\nvar B = 2\\n' > a.go"], `${root}/seed`);
sh("git", ["commit", "-qam", "c2"], `${root}/seed`);
sh("git", ["push", "-q", "origin", "main"], `${root}/seed`);
// B also commits locally on top of c1 → diverged once it fetches c2
sh("sh", ["-c", "printf 'package m\\n\\nvar A = 1\\nvar C = 3\\n' > a.go"], `${root}/B`);
sh("git", ["commit", "-qam", "local-only"], `${root}/B`);

const registered = [];
const ctx = {
	inject(n, cb) { cb(ctx); },
	effect(fn) { fn(); return () => {}; },
	webServer: { register(r) { registered.push(r); return () => {}; } },
};
const { apply } = await import("./index.js");
apply(ctx);
const handler = registered[0].handler;
const PREFIX = registered[0].path;
const call = (route, body) => new Promise((res) => {
	const req = Readable.from([JSON.stringify(body)]);
	req.method = "POST";
	req.url = `${PREFIX}/${route}`;
	req.destroy = () => {};
	handler(req, { writeHead() {}, end(t) { res(JSON.parse(t)); } });
});

let pass = 0, fail = 0;
const check = (n, c, x) => { c ? (pass++, console.log("  ok ", n)) : (fail++, console.log("FAIL ", n, JSON.stringify(x))); };

// A: status before fetch shows no change (origin/main ref is local, stale).
const stA0 = await call("git.status", { cwd: `${root}/A` });
check("A status upstream=origin/main", stA0.ok && stA0.value.upstream === "origin/main" && stA0.value.ahead === 0, stA0);

// Fetch reveals A behind 1.
const fA = await call("git.fetch", { cwd: `${root}/A` });
check("A fetch → behind 1", fA.ok && !fA.value.error && fA.value.status.behind === 1 && fA.value.status.ahead === 0, fA);

// Pull fast-forwards A to c2.
const pA = await call("git.pull", { cwd: `${root}/A` });
check("A pull ff → behind 0", pA.ok && !pA.value.error && pA.value.status.behind === 0 && /var B = 2/.test(pA.value.status.working.map((f) => f.path).join()) === false, pA);
const aFile = sh("cat", [`${root}/A/a.go`]);
check("A working tree now has c2", /var B = 2/.test(aFile), aFile);

// B diverged: fetch → behind1 ahead1, pull refused.
const fB = await call("git.fetch", { cwd: `${root}/B` });
check("B fetch → ahead1 behind1", fB.ok && fB.value.status.behind === 1 && fB.value.status.ahead === 1, fB);
const pB = await call("git.pull", { cwd: `${root}/B` });
check("B pull refused (ff-only)", pB.ok && !!pB.value.error && pB.value.status.behind === 1 && pB.value.status.ahead === 1, pB);
const bFile = sh("cat", [`${root}/B/a.go`]);
check("B working tree untouched by refused pull", /var C = 3/.test(bFile), bFile);

// Inferred upstream: B on a fresh branch with matching remote branch (create via seed push).
sh("git", ["branch", "-m", "renamed"], `${root}/B`);
sh("git", ["push", "-q", "origin", "renamed:main2"], `${root}/B`);
sh("git", ["checkout", "-q", "-b", "main2", "origin/main2", "--no-track"], `${root}/B`);
const stB2 = await call("git.status", { cwd: `${root}/B` });
check("B inferred upstream origin/main2 auto", stB2.ok && stB2.value.upstream === "origin/main2" && stB2.value.upstreamInferred === true, stB2);

// detached HEAD pull refused cleanly.
sh("git", ["checkout", "-q", "--detach"], `${root}/A`);
const pdet = await call("git.pull", { cwd: `${root}/A` });
check("detached HEAD pull refused", pdet.ok && /detached/i.test(pdet.value.error || ""), pdet);

try { sh("rm", ["-rf", root]); } catch {}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
