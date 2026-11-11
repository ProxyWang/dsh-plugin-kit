import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync, symlinkSync, unlinkSync } from "node:fs";

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

// --- regex / whole-word / multi-glob / engine errors ------------------------------------------
const t5 = await call("search.text", { cwd, query: "Greet.r", regex: true });
check("regex mode matches pattern", t5.ok && t5.value.results.some((r) => r.path === "main.go"), t5);
const t6 = await call("search.text", { cwd, query: "Greet.r" });
check("fixed mode does not interpret regex", t6.ok && t6.value.results.length === 0, t6);
const t7 = await call("search.text", { cwd, query: "Greeter", words: true });
check("whole-word mode keeps exact token", t7.ok && t7.value.results.some((r) => r.path === "main.go"), t7);
const t8 = await call("search.text", { cwd, query: "([", regex: true });
check("invalid regex surfaces as value.error", t8.ok && Array.isArray(t8.value.results) && t8.value.results.length === 0 && typeof t8.value.error === "string" && t8.value.error.length > 0, t8.value);
const t9 = await call("search.text", { cwd, query: "untracked", include: "*.txt,*.md" });
check("multi-glob include", t9.ok && t9.value.results.some((r) => r.path === "u.txt"), t9);
const t10 = await call("search.text", { cwd, query: "Greeter", include: "!*.txt" });
check("negated glob excludes", t10.ok && t10.value.results.every((r) => !r.path.endsWith(".txt")), t10);

// Explicit search scopes must stay restrictive, including empty changes and literal filenames.
const git = (...args) => execFileSync("git", args, { cwd, stdio: "ignore" });
git("add", "-A"); git("commit", "-qm", "clean scope baseline");
const emptyChanges = await call("search.text", { cwd, query: "Greeter", scope: "changes", include: "*" });
check("empty changes never falls back to workspace search", emptyChanges.ok && emptyChanges.value.results.length === 0 && emptyChanges.value.scope?.files === 0, emptyChanges);
mkdirSync(`${cwd}/scope/nested`, { recursive: true });
mkdirSync(`${cwd}/scope-other`, { recursive: true });
writeFileSync(`${cwd}/scope/changed.txt`, "scopeNeedle base\n");
writeFileSync(`${cwd}/scope/unchanged.txt`, "scopeNeedle untouched\n");
writeFileSync(`${cwd}/scope/nested/deep.go`, "scopeNeedle nested\n");
writeFileSync(`${cwd}/scope-other/outside.txt`, "scopeNeedle sibling\n");
writeFileSync(`${cwd}/scope/a[,]*.txt`, "scopeNeedle literal\n");
writeFileSync(`${cwd}/scope/a1.txt`, "scopeNeedle unrelated\n");
writeFileSync(`${cwd}/scope/deleted.txt`, "scopeNeedle removed\n");
git("add", "-A"); git("commit", "-qm", "scope fixtures");
appendFileSync(`${cwd}/scope/changed.txt`, "scopeNeedle modified\n");
appendFileSync(`${cwd}/scope/a[,]*.txt`, "scopeNeedle modified literal\n");
writeFileSync(`${cwd}/scope/untracked.go`, "scopeNeedle untracked\n");
unlinkSync(`${cwd}/scope/deleted.txt`);
git("add", "--", "scope/changed.txt");
const scoped = await call("search.text", { cwd, query: "scopeNeedle", scope: "changes" });
const changedPaths = [...new Set(scoped.value?.results?.map((r) => r.path) ?? [])].sort();
check("changes search includes staged unstaged and untracked files only", scoped.ok && JSON.stringify(changedPaths) === JSON.stringify(["scope/a[,]*.txt", "scope/changed.txt", "scope/untracked.go"]), changedPaths);
check("deleted changed files are skipped without broadening search", scoped.ok && scoped.value.scope.files === 3, scoped);
const filterChanged = await call("search.text", { cwd, query: "scopeNeedle", scope: "changes", include: "*.go" });
check("user glob intersects mandatory changed-file set", filterChanged.ok && filterChanged.value.results.length === 1 && filterChanged.value.results[0].path === "scope/untracked.go", filterChanged);
const widen = await call("search.text", { cwd, query: "scopeNeedle", scope: "changes", include: "*,*.txt" });
check("include filters cannot widen changes scope to unrelated files", widen.ok && widen.value.results.every((r) => changedPaths.includes(r.path)), widen);
const directory = await call("search.text", { cwd, query: "scopeNeedle", scope: "directory", directory: "scope/nested" });
check("directory searches return workspace-relative paths", directory.ok && directory.value.results.length === 1 && directory.value.results[0].path === "scope/nested/deep.go", directory);
const directoryAll = await call("search.text", { cwd, query: "scopeNeedle", scope: "directory", directory: "scope" });
check("directory scope includes descendants but not similarly named sibling", directoryAll.ok && directoryAll.value.results.some((r) => r.path === "scope/nested/deep.go") && directoryAll.value.results.every((r) => r.path.startsWith("scope/")), directoryAll);
const workspaceAll = await call("search.text", { cwd, query: "scopeNeedle", scope: "workspace" });
check("workspace scope still searches unchanged files", workspaceAll.ok && workspaceAll.value.results.some((r) => r.path === "scope/unchanged.txt") && workspaceAll.value.results.some((r) => r.path === "scope-other/outside.txt"), workspaceAll);
const escapeScope = await call("search.text", { cwd, query: "scopeNeedle", scope: "directory", directory: "../" });
check("directory scope cannot escape the workspace", escapeScope.ok === false, escapeScope);
symlinkSync("/tmp", `${cwd}/scope-link`);
const linkScope = await call("search.text", { cwd, query: "scopeNeedle", scope: "directory", directory: "scope-link" });
check("directory search refuses symlink escape", linkScope.ok === false, linkScope);
const invalidScope = await call("search.text", { cwd, query: "scopeNeedle", scope: "anything" });
check("invalid search scope is rejected", invalidScope.ok === false, invalidScope);

// Repo-relative Git paths must map back to session-relative search results.
mkdirSync(`${cwd}/nested-repo`, { recursive: true });
const gitNested = (...args) => execFileSync("git", args, { cwd: `${cwd}/nested-repo`, stdio: "ignore" });
gitNested("init", "-q"); gitNested("config", "user.email", "t@t"); gitNested("config", "user.name", "t");
writeFileSync(`${cwd}/nested-repo/item.txt`, "scopeNeedle nested repo\n");
gitNested("add", "-A"); gitNested("commit", "-qm", "nested base");
appendFileSync(`${cwd}/nested-repo/item.txt`, "scopeNeedle edit\n");
const nestedScope = await call("search.text", { cwd, query: "scopeNeedle", scope: "changes", repo: `${cwd}/nested-repo` });
check("selected repository scope returns correct session-relative paths", nestedScope.ok && nestedScope.value.results.length > 0 && nestedScope.value.results.every((r) => r.path === "nested-repo/item.txt"), nestedScope);
const nestedEscape = await call("search.text", { cwd, query: "scopeNeedle", scope: "changes", repo: "/tmp" });
check("selected repository scope is fenced to the workspace", nestedEscape.ok === false, nestedEscape);
mkdirSync(`${cwd}/many`, { recursive: true });
for (let i = 0; i < 130; i++) writeFileSync(`${cwd}/many/${i}.txt`, "batchMarker\n");
const manyScope = await call("search.text", { cwd, query: "batchMarker", scope: "changes", limit: 200 });
check("changed-file search batches long literal argv lists without losing files", manyScope.ok && manyScope.value.results.length === 130 && !manyScope.value.truncated, manyScope.value?.results?.length);
const limitScope = await call("search.text", { cwd, query: "batchMarker", scope: "changes", limit: 3 });
check("result limit applies within the required scope", limitScope.ok && limitScope.value.results.length === 3 && limitScope.value.truncated, limitScope.value?.results?.length);

console.log(`\n${pass} passed, ${fail} failed`);
cleanup();
process.exit(fail ? 1 : 0);
