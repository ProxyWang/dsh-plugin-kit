// Session cwd = PARENT of several repos: discovery, per-repo status/diff, fences.
import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const root = "/tmp/ce-parent2";
const cleanup = () => { try { rmSync(root, { recursive: true, force: true }); } catch {} };
cleanup();
const git = (args, cwd) => execFileSync("git", args, { cwd, stdio: "ignore" });
const mkRepo = (dir, file, firstMsg) => {
	mkdirSync(dir, { recursive: true });
	git(["init", "-q"], dir);
	git(["config", "user.email", "t@t"], dir);
	git(["config", "user.name", "t"], dir);
	writeFileSync(`${dir}/${file}`, "v1\n");
	git(["add", "-A"], dir);
	git(["commit", "-qm", firstMsg], dir);
};
mkRepo(`${root}/repoX`, "a.txt", "c1");
mkRepo(`${root}/group/repoY`, "b.txt", "c1");
mkRepo(`${root}/node_modules/fakepkg`, "n.txt", "c1"); // must be skipped by discovery

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

const s0 = await call("git.status", { cwd: root });
const repos = s0.value?.repos ?? [];
check("parent cwd → repo:false + repos[]", s0.ok && s0.value.repo === false && repos.length === 2, s0);
check("discovery finds X and group/repoY, skips node_modules", repos.some((r) => r.root.endsWith("/repoX")) && repos.some((r) => r.root.endsWith("/repoY")) && !repos.some((r) => r.root.includes("node_modules")), repos);
check("summary carries branch + dirty 0", repos.every((r) => typeof r.branch === "string" && r.dirtyCount === 0), repos);

writeFileSync(`${root}/repoX/a.txt`, "v2 dirty\n");
writeFileSync(`${root}/repoX/new.txt`, "fresh\n");
const sX = await call("git.status", { cwd: root, repo: `${root}/repoX` });
check("per-repo status: modified + untracked", sX.ok && sX.value.repo === true && sX.value.working.some((f) => f.path === "a.txt" && f.xy.includes("M")) && sX.value.working.some((f) => f.path === "new.txt" && f.xy === "??"), sX);

const dX = await call("git.diff", { cwd: root, repo: `${root}/repoX`, path: "a.txt", scope: "working" });
check("per-repo diff of modified file", dX.ok && dX.value.diff.includes("-v1") && dX.value.diff.includes("+v2"), dX);
const dNew = await call("git.diff", { cwd: root, repo: `${root}/repoX`, path: "new.txt", scope: "working" });
check("untracked synthesized with repo ctx", dNew.ok && dNew.value.untracked === true && dNew.value.diff.includes("+fresh"), dNew);

const esc = await call("git.status", { cwd: root, repo: "/tmp" });
check("repo fence: outside workspace refused", esc.ok === false && /outside/i.test(esc.error), esc);
const notRepo = await call("git.status", { cwd: root, repo: `${root}/group` });
check("repo fence: non-repo refused", notRepo.ok === false && /not a git/i.test(notRepo.error), notRepo);

const fN = await call("git.fetch", { cwd: root, repo: `${root}/repoX` });
check("fetch on remote-less repo → graceful error + status", fN.ok && fN.value.error && fN.value.status?.repo === true, fN);

cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
