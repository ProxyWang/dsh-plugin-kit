import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";

// Self-contained fixture: recreate before use, drop on exit (success or crash).
const root = "/tmp/ce-search";
const mk = (args, cwd) => execFileSync("sh", ["-c", args], { cwd, stdio: "ignore" });
const cleanup = () => { try { execFileSync("rm", ["-rf", root]); } catch {} };
cleanup();
mk(`mkdir -p ${root} && cd ${root} && git init -q && git config user.email t@t && git config user.name t && printf 'module example.com/s\\n\\ngo 1.22\\n' > go.mod && printf 'package main\\n\\nimport \\"fmt\\"\\n\\nfunc Greeter() string { return \\"hi\\" }\\n\\nfunc main() { fmt.Println(Greeter()) }\\n' > main.go && mkdir -p node_modules/junk && echo 'should be skipped' > node_modules/junk/x.go && git add -A && git commit -qm x && echo untracked > u.txt`, "/tmp");
process.on("exit", cleanup);

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

const cwd = "/tmp/ce-search";
let pass = 0, fail = 0;
const check = (n, c, x) => { c ? (pass++, console.log("  ok ", n)) : (fail++, console.log("FAIL ", n, JSON.stringify(x))); };

// File selection (Quick Open): fuzzy match by basename, must skip node_modules.
const f1 = await call("search.files", { cwd, query: "main" });
check("files fuzzy main.go", f1.ok && f1.value.matches.some((m) => m.path === "main.go"), f1);
const f2 = await call("search.files", { cwd, query: "gr" });
check("files fuzzy gr→Greeter-ish", f2.ok && Array.isArray(f2.value.matches), f2);
const f3 = await call("search.files", { cwd, query: "junk" });
check("files skips node_modules", f3.ok && !f3.value.matches.some((m) => m.path.includes("node_modules")), f3);
const f4 = await call("search.files", { cwd, query: "u.txt" });
check("files includes untracked", f4.ok && f4.value.matches.some((m) => m.path === "u.txt"), f4);

// Full-text query: match in main.go, node_modules excluded.
const t1 = await call("search.text", { cwd, query: "Greeter" });
check("text finds Greeter", t1.ok && t1.value.results.some((r) => r.path === "main.go" && r.line >= 5), t1);
check("text engine", t1.ok && (t1.value.engine === "ripgrep" || t1.value.engine === "grep"), t1);
const t2 = await call("search.text", { cwd, query: "should be skipped" });
check("text skips node_modules", t2.ok && !t2.value.results.some((r) => r.path.includes("node_modules")), t2);
const t3 = await call("search.text", { cwd, query: "zzz_no_such" });
check("text no-match ok", t3.ok && t3.value.results.length === 0, t3);
const t4 = await call("search.text", { cwd, query: "fmt", include: "*.go" });
check("text include filter", t4.ok && t4.value.results.every((r) => r.path.endsWith(".go")), t4);

console.log(`\n${pass} passed, ${fail} failed`);
cleanup();
process.exit(fail ? 1 : 0);
