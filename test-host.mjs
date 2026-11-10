// Drives the host half through a fake webServer to exercise every route.
import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";

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
function check(name, cond, extra) {
	if (cond) {
		pass++;
		console.log(`  ok  ${name}`);
	} else {
		fail++;
		console.log(`FAIL  ${name}${extra ? ` → ${JSON.stringify(extra)}` : ""}`);
	}
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
check(
	"lsp definition → helper",
	def.ok && Array.isArray(def.value.targets) && def.value.targets.some((t) => t.path.endsWith("main.go") && t.line === 6) && def.value.status?.state === "ready",
	def,
);

const refs = await call("lsp.request", { cwd, path: "main.go", kind: "references", line: 6, col: 6 });
check("lsp references helper", refs.ok && refs.value.targets.length >= 1 && refs.value.targets.every((t) => t.snippet !== undefined), refs);

const hov = await call("lsp.request", { cwd, path: "pkg/svc.go", kind: "hover", line: 5, col: 13 });
check("lsp hover hello", hov.ok && typeof hov.value.hover === "string", hov);

const nonGo = await call("lsp.request", { cwd, path: "go.mod", kind: "definition", line: 1, col: 1 });
check("lsp non-go guarded", nonGo.ok && nonGo.value.targets.length === 0, nonGo);

const diag = await call("lsp.diagnostics", { cwd, path: "main.go" });
check("lsp diagnostics shape", diag.ok && Array.isArray(diag.value.items), diag);

const stat = await call("lsp.status", { cwd });
check("lsp status ready", stat.ok && stat.value.state === "ready", stat);
check("lsp status carries progress field", stat.ok && typeof (stat.value.progress ?? "") === "string", stat);

const sym = await call("lsp.request", { cwd, path: "main.go", kind: "symbol", line: 1, col: 1 });
check("documentSymbol lists helper & main", sym.ok && sym.value.symbols.some((s) => s.name === "helper" && s.line === 6) && sym.value.symbols.some((s) => s.name === "main"), sym);

const commits = (await call("git.status", { cwd })).value.commits;
const cShas = commits.map((c) => c.hash);
const cd = await call("git.diff", { cwd, path: "main.go", scope: "commit", sha: cShas[cShas.length - 1] });
check("commit diff of 'add version var'", cd.ok && cd.value.scope === "commit" && cd.value.diff.includes("+var version ="), cd);

const cBad = await call("git.diff", { cwd, path: "main.go", scope: "commit", sha: "deadbeefdeadbeef" });
check("unknown commit refused", cBad.ok && cBad.value.error === "unknown commit", cBad);

for (const cleanup of cleanups) cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
