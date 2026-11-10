// Session cwd is the PARENT of the go module: gopls must attach to repo/ (module root).
import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";

const root = "/tmp/ce-parent";
const cleanup = () => { try { execFileSync("rm", ["-rf", root]); } catch {} };
cleanup();
execFileSync("sh", ["-c", `mkdir -p ${root}/repo/internal/svc && cd ${root}/repo && printf 'module example.com/nested\\n\\ngo 1.22\\n' > go.mod && printf 'package svc\\n\\nfunc Double(n int) int { return n * 2 }\\n' > internal/svc/svc.go && printf 'package main\\n\\nimport \\"example.com/nested/internal/svc\\"\\n\\nfunc main() { _ = svc.Double(2) }\\n' > main.go`]);
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

let pass = 0, fail = 0;
const check = (n, c, x) => { c ? (pass++, console.log("  ok ", n)) : (fail++, console.log("FAIL ", n, JSON.stringify(x))); };

// Double is defined at repo/internal/svc/svc.go line 3.
const d = await call("lsp.request", { cwd: "/tmp/ce-parent", path: "repo/main.go", kind: "definition", line: 5, col: 25 });
check("cross-dir definition to svc.go:3", d.ok && d.value.targets.some((t) => t.path.replace(/\/private\/tmp/, "/tmp").endsWith("internal/svc/svc.go") && t.line === 3), d);

const r = await call("lsp.request", { cwd: "/tmp/ce-parent", path: "repo/internal/svc/svc.go", kind: "references", line: 3, col: 6 });
check("references across dirs", r.ok && r.value.targets.length >= 2, r);

const st = await call("lsp.status", { cwd: "/tmp/ce-parent" });
check("status aggregated under cwd", st.ok && st.value.state === "ready", st);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
