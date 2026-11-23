// Reproducible README screenshots. Uses fictional fixtures only, with no live
// DSH connection, user workspace reads, credentials or business HTTP requests.
// One headless Chrome instance serves every scene through CDP: each shot is a
// navigation plus Page.captureScreenshot in the same tab, so six images cost
// one browser launch instead of six `--screenshot` processes.
import { register } from "node:module";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

register(new URL("../test-support/esm-react-hook.mjs", import.meta.url), import.meta.url);
const { createHookRenderer } = await import("../test-support/react-stub.mjs");
const { ApiView } = await import("../src/client/apiclient.js");
const { CodeBody } = await import("../src/client/code.js");
const { TreePanel } = await import("../src/client/tree.js");
const { SkillsView } = await import("../src/client/skills.js");
const { DbView } = await import("../src/client/db.js");
const { RpcView } = await import("../src/client/rpc.js");
const { RequestFields } = await import("../src/client/requestfields.js");
const { CSS } = await import("../src/client/styles.js");
const { zh } = await import("../src/client/locale.js");

const t = (key, args = {}) => String(zh[key] ?? key).replace(/\{(\w+)\}/g, (all, name) => args[name] ?? all);
const root = "/demo/workspace";
const code = [
 "type Project = {",
 "  id: number;",
 "  name: string;",
 "  status: \"active\" | \"archived\";",
 "};", "",
 "const projects: Project[] = [",
 "  { id: 1, name: \"Demo Website\", status: \"active\" },",
 "  { id: 2, name: \"Sample Service\", status: \"active\" },",
 "];", "",
 "export function findProject(id: number): Project | undefined {",
 "  return projects.find((project) => project.id === id);",
 "}", "",
 "export function activeProjects(): Project[] {",
 "  return projects.filter((project) => project.status === \"active\");",
 "}", "",
 "export function projectSummary(): string {",
 "  const active = activeProjects();",
 "  return `${active.length} demo projects are ready`;",
 "}", "",
 "console.log(projectSummary());", "",
].join("\n");
const skillContent = `---\nname: demo-code-review\ndescription: 检查示例项目的可读性、正确性与测试覆盖。\n---\n\n# 代码审查\n\n面向虚构示例项目的审查指南。先理解改动目标，再关注用户可见行为。\n\n## 审查重点\n\n- 正确性：检查输入边界、异常路径和异步状态。\n- 可读性：让命名表达意图，减少重复与过深的条件分支。\n- 可测试性：覆盖真实行为，避免只复述实现细节。\n- 兼容性：保持已有接口和持久化数据可用。\n\n## 建议流程\n\n1. 阅读变更与对应测试。\n2. 定位可复现的问题，并说明影响。\n3. 给出小范围、可验证的修复建议。\n\n## 输出约定\n\n按问题严重程度列出结论，并给出验证方法。没有发现问题时，说明已覆盖的检查范围。\n`;
const skills = [
 { name: "demo-code-review", description: "检查示例项目的可读性、正确性与测试覆盖。", source: "project-agents", path: "/demo/skills/demo-code-review/SKILL.md", dir: "/demo/skills/demo-code-review" },
 { name: "demo-api-check", description: "检查示例 API 的参数、状态码与错误响应。", source: "project-agents", path: "/demo/skills/demo-api-check/SKILL.md" },
 { name: "demo-docs", description: "为示例功能编写简洁的使用说明。", source: "user-agents", path: "/demo/skills/demo-docs/SKILL.md" },
];
const directories = {
 "": [{ name: "src", type: "directory" }, { name: "tests", type: "directory" }, { name: "README.md", type: "file" }, { name: "package.json", type: "file" }, { name: "tsconfig.json", type: "file" }],
 src: [{ name: "index.ts", type: "file" }, { name: "projects.ts", type: "file" }, { name: "utils.ts", type: "file" }],
};

// The only API implementation available to the components is this local table.
globalThis.fetch = async (route, options) => {
 const body = JSON.parse(options?.body ?? "{}");
 const kind = String(route).split("/").pop();
 let value;
 switch (kind) {
  case "git.status": value = { repo: true, root, branch: "demo", working: [], branchFiles: [], commits: [], base: null, ahead: 0, behind: 0 }; break;
  case "lsp.status": value = { state: "off", message: "", progress: "" }; break;
  case "lsp.request": value = { symbols: [], targets: [], status: { state: "off" } }; break;
  case "lsp.diagnostics": value = { items: [] }; break;
  case "fs.list": value = { entries: directories[body.path] ?? [], truncated: false }; break;
  case "fs.read": value = { kind: "text", content: code, mtimeMs: 1, size: code.length, truncated: false }; break;
  case "skills.list": value = { skills }; break;
  case "skills.read": value = { content: skillContent, path: body.path, truncated: false }; break;
  case "db.drivers": value = [
   { id: "sqlite", label: "SQLite", ready: true, note: "" },
   { id: "mysql", label: "MySQL", ready: false, note: "mysql CLI not on PATH" },
   { id: "postgres", label: "PostgreSQL", ready: false, note: "psql CLI not on PATH" },
  ]; break;
  case "db.connect": value = { id: "demo-conn", driver: "sqlite", label: "demo.sqlite", mode: "worker" }; break;
  // Saved connections: the rail renders these, so the preview must answer the
  // routes instead of tripping the fixture's allowlist.
  case "db.profile.list": value = { revision: 1, profiles: [] }; break;
  // One stable id: repeated saves in the preview replace the row instead of
  // stacking a column of identical entries in the screenshot.
  case "db.profile.save": value = { revision: 2, profile: { id: "saved-1", label: "demo.sqlite", driver: "sqlite", address: "/demo/demo.sqlite", path: "/demo/demo.sqlite", host: "", port: 0, user: "", database: "", secretId: "", updatedAt: 1763550000000 } }; break;
  case "db.cancel": value = { cancelled: false, connectionClosed: false }; break;
  case "db.schema": value = {
   driver: "sqlite",
   current: "main",
   databases: [{ name: "main", tables: [
    { name: "projects", kind: "table", indexes: [{ name: "projects_slug", unique: true, columns: ["slug"] }], columns: [
     { name: "id", type: "INTEGER", nullable: false, primaryKey: true },
     { name: "name", type: "TEXT", nullable: false, primaryKey: false },
     { name: "slug", type: "TEXT", nullable: false, primaryKey: false },
     { name: "status", type: "TEXT", nullable: true, primaryKey: false },
     { name: "created_at", type: "TEXT", nullable: true, primaryKey: false },
    ] },
    { name: "members", kind: "table", indexes: [], columns: [
     { name: "id", type: "INTEGER", nullable: false, primaryKey: true },
     { name: "project_id", type: "INTEGER", nullable: false, primaryKey: false },
     { name: "role", type: "TEXT", nullable: true, primaryKey: false },
    ] },
    { name: "active_projects", kind: "view", indexes: [], columns: [
     { name: "id", type: "INTEGER", nullable: true, primaryKey: false },
     { name: "name", type: "TEXT", nullable: true, primaryKey: false },
    ] },
   ] }],
  }; break;
  case "db.rows": value = {
   columns: ["id", "name", "slug", "status", "created_at"],
   rows: [
    [1, "Demo Website", "demo-website", "active", "2026-08-02"],
    [2, "Sample Service", "sample-service", "active", "2026-08-14"],
    [3, "Legacy Import", "legacy-import", "archived", "2026-07-21"],
    [4, "Design System", "design-system", "active", "2026-09-03"],
    [5, "Docs Portal", "docs-portal", null, "2026-09-19"],
   ],
   total: 5, offset: 0, limit: 100,
  }; break;
  case "db.query": value = {
   columns: ["status", "projects"],
   rows: [["active", 3], ["archived", 1], ["(null)", 1]],
   truncated: false, ms: 3,
  }; break;
  case "rpc.proto": value = {
   files: ["proto/greeter.proto"],
   package: "demo.v1",
   methods: [
    { service: "demo.v1.Greeter", name: "SayHello", path: "/demo.v1.Greeter/SayHello", request: "demo.v1.HelloRequest", response: "demo.v1.HelloReply", clientStreaming: false, serverStreaming: false, sample: { name: "", tags: [] } },
    { service: "demo.v1.Greeter", name: "Watch", path: "/demo.v1.Greeter/Watch", request: "demo.v1.HelloRequest", response: "demo.v1.HelloReply", clientStreaming: false, serverStreaming: true, sample: { name: "", tags: [] } },
    { service: "demo.v1.Greeter", name: "Chat", path: "/demo.v1.Greeter/Chat", request: "demo.v1.HelloRequest", response: "demo.v1.HelloReply", clientStreaming: true, serverStreaming: true, sample: { name: "", tags: [] } },
   ],
  }; break;
  case "rpc.call": value = {
   status: 0, statusName: "OK", message: "", ms: 12, truncated: false,
   messages: [{ message: "hello ada", served: 1 }],
   headers: { "content-type": "application/grpc" },
   trailers: { "grpc-status": "0", "grpc-message": "" },
  }; break;
  case "api.send": value = { status: 200, statusText: "OK", ms: 42, size: 174, headers: [["content-type", "application/json"]], text: JSON.stringify({ data: [{ id: 1, name: "Demo Website", status: "active" }, { id: 2, name: "Sample Service", status: "active" }], total: 2 }) }; break;
  default: throw new Error(`Fixture does not allow route: ${route}`);
 }
 return { json: async () => ({ ok: true, value }) };
};
globalThis.document = new EventTarget();
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
const nativeSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = () => 0;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const collect = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(collect) : [node, ...(node.children ?? []).flatMap(collect)];
const pick = (tree, predicate) => { const node = collect(tree).find(predicate); if (!node) throw Error("Missing preview control"); return node; };

async function apiPreview() {
 const draw = createHookRenderer(ApiView, { t });
 let tree = draw();
 // Bruno-style environment: create one, name it, and use its variable in the URL.
 pick(tree, (node) => node.props.className?.startsWith("cea-config-tab") && node.children[0] === t("api.environment")).props.onClick();
 tree = draw();
 pick(tree, (node) => node.props.title === t("api.envNewTitle")).props.onClick();
 tree = draw();
 pick(tree, (node) => node.props["aria-label"] === t("api.envName")).props.onChange({ target: { value: "演示环境" } });
 tree = draw();
 pick(tree, (node) => node.props["aria-label"] === t("api.envName")).props.onBlur();
 tree = draw();
 pick(tree, (node) => node.type === RequestFields).props.onChange([{ name: "base", value: "https://api.example.test", description: "示例服务地址" }]);
 tree = draw();
 pick(tree, (node) => node.props.className?.startsWith("cea-config-tab") && node.children[0] === t("api.params")).props.onClick();
 tree = draw();
 pick(tree, (node) => node.props.className === "ce-input cea-url").props.onChange({ target: { value: "{{base}}/v1/projects?limit=20&status=active" } });
 tree = draw();
 pick(tree, (node) => node.type === RequestFields).props.onChange([{ name: "limit", value: "20", description: "每页项目数量" }, { name: "status", value: "active", description: "筛选项目状态" }]);
 tree = draw();
 pick(tree, (node) => node.props.className?.startsWith("cea-config-tab") && node.children[0] === t("api.headers")).props.onClick();
 tree = draw();
 pick(tree, (node) => node.type === RequestFields).props.onChange([{ name: "Accept", value: "application/json", description: "响应数据格式" }, { name: "X-Demo-Mode", value: "true", description: "虚构示例标记" }, { name: "X-Debug", value: "verbose", description: "已停用的示例请求头", enabled: false }]);
 tree = draw();
 pick(tree, (node) => node.props.className?.startsWith("cea-config-tab") && node.children[0] === t("api.params")).props.onClick();
 tree = draw();
 pick(tree, (node) => node.props.className === "ce-sk-btn cea-send").props.onClick();
 await tick();
 return draw();
}

async function skillsPreview() {
 const draw = createHookRenderer(SkillsView, { cwd: root, t, say() {} }, { effects: true });
 let tree = draw(); draw.flushEffects(); await tick(); tree = draw();
 pick(tree, (node) => node.props.className?.startsWith("ce-sk-row") && node.props.title === skills[0].description).props.onClick();
 await tick(); tree = draw();
 draw.unmount();
 return { type: "div", props: { className: "ce-root" }, children: [tree] };
}

async function codePreview() {
 const draw = createHookRenderer(CodeBody, { sessionId: "demo-session", useSessions: (select) => select({ byId: { "demo-session": { cwd: root } } }), t }, { effects: true });
 let tree = draw(); draw.flushEffects(); await tick(); tree = draw();
 await pick(tree, (node) => node.type === TreePanel).props.onOpenFile("src/index.ts", 12, 1);
 await tick(); tree = draw(); draw.flushEffects(); await tick(); tree = draw();
 const treeNode = pick(tree, (node) => node.type === TreePanel);
 const drawTree = createHookRenderer(TreePanel, treeNode.props, { effects: true });
 let explorer = drawTree(); drawTree.flushEffects(); await tick(); explorer = drawTree();
 const srcRow = pick(explorer, (node) => node.props["data-tp"] === "src");
 const folder = collect(srcRow).find((node) => node.type?.name === "IconFolder");
 if (!folder?.props.open) srcRow.props.onClick();
 await tick(); explorer = drawTree();
 treeNode.type = "div"; treeNode.props = { className: "preview-explorer" }; treeNode.children = [explorer];
 drawTree.unmount(); draw.unmount();
 return tree;
}

const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const voids = new Set(["input", "col", "br", "hr", "img"]);
// Static HTML has no controlled <select value>: mark the matching option so
// Chrome screenshots show the component's real selection (env picker, method).
function withSelectedOption(node) {
 if (node?.type !== "select" || node.props?.value === undefined) return node;
 const mark = (child) => {
  if (Array.isArray(child)) return child.map(mark);
  if (!child || typeof child !== "object") return child;
  if (child.type === "option" && child.props?.value === node.props.value) return { ...child, props: { ...child.props, selected: true } };
  return child;
 };
 return { ...node, children: mark(node.children) };
}
function serialize(node) {
 if (node == null || typeof node === "boolean") return "";
 if (Array.isArray(node)) return node.map(serialize).join("");
 if (typeof node !== "object") return escape(node);
 if (typeof node.type === "function") return serialize(createHookRenderer(node.type, node.props)());
 if (typeof node.type === "symbol") return serialize(node.children);
 node = withSelectedOption(node);
 // File rows contain nested action buttons in React. Static HTML uses an inert
 // wrapper so the HTML parser cannot split those rows; this is a layout preview.
 const type = node.type === "button" && node.props.className?.split(" ").includes("ce-row") ? "div" : node.type;
 let attrs = "";
 for (let [key, value] of Object.entries(node.props)) {
  if (["ref", "key", "autoFocus"].includes(key) || key.startsWith("on") || value == null || value === false) continue;
  if (key === "className") key = "class";
  if (key === "style") value = Object.entries(value).map(([prop, val]) => `${prop.replace(/[A-Z]/g, (match) => "-" + match.toLowerCase())}:${typeof val === "number" && !["opacity", "zIndex", "flex", "fontWeight"].includes(prop) ? val + "px" : val}`).join(";");
  attrs += value === true ? ` ${key}` : ` ${key}="${escape(value)}"`;
 }
 // A controlled <textarea> keeps its text in `value`, which an attribute
 // cannot show; render it as content so the static preview matches the app.
 const inner = type === "textarea" && node.props.value !== undefined
 	? escape(node.props.value)
 	: serialize(node.children);
 return `<${type}${attrs}>${voids.has(type) ? "" : inner + `</${type}>`}`;
}

/** Minimal CDP client over the browser-level WebSocket (Node >= 22). */
function createCdpClient(socket) {
 let nextId = 1;
 const pending = new Map();
 const listeners = new Map();
 socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== undefined) {
   const entry = pending.get(message.id);
   if (!entry) return;
   pending.delete(message.id);
   if (message.error) entry.reject(Error(`${message.error.message} (${message.error.code})`));
   else entry.resolve(message.result ?? {});
   return;
  }
  for (const callback of listeners.get(message.method) ?? []) callback(message.params ?? {});
 });
 const closed = new Promise((_, reject) => socket.addEventListener("close", () => reject(Error("Chrome DevTools socket closed"))));
 return {
  send(method, params = {}, sessionId) {
   const id = nextId++;
   const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
   socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
   return Promise.race([result, closed]);
  },
  on(method, callback) {
   const list = listeners.get(method) ?? [];
   list.push(callback);
   listeners.set(method, list);
   return () => listeners.set(method, (listeners.get(method) ?? []).filter((entry) => entry !== callback));
  },
  close() { socket.close(); },
 };
}

/** Launch one headless Chrome with an ephemeral profile and return its CDP endpoint. */
async function launchChrome(chrome, profileDirectory) {
 const child = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${profileDirectory}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
 let stderr = "";
 const endpoint = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error(`Chrome did not expose a DevTools endpoint within 30s. ${stderr.slice(-400)}`)), 30_000);
  child.once("error", (error) => { clearTimeout(timer); reject(error); });
  child.once("exit", (code) => { clearTimeout(timer); reject(Error(`Chrome exited early (code ${code}). ${stderr.slice(-400)}`)); });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
   stderr += chunk;
   const match = /DevTools listening on (ws:\/\/\S+)/.exec(stderr);
   if (match) { clearTimeout(timer); resolve(match[1]); }
  });
 });
 return { child, endpoint };
}


/** Database workbench: connect to the demo file, browse a table, run a query. */
async function dbPreview() {
 const draw = createHookRenderer(DbView, { sessionId: "demo-session", useSessions: (select) => select({ byId: { "demo-session": { cwd: root } } }), t }, { effects: true });
 let tree = draw();
 draw.flushEffects();
 await tick();
 tree = draw();

 const button = (label) => pick(tree, (node) => node.type === "button" && String(node.children?.[0] ?? "").includes(label));

 button(t("db.connect")).props.onClick();
 tree = draw();
 // Step one: pick the engine, then continue.
 pick(tree, (node) => node.type === "button" && String(node.props.className ?? "").includes("cedb-pick-card")).props.onClick();
 tree = draw();
 pick(tree, (node) => node.type === "button" && node.children?.[0] === t("db.nextStep")).props.onClick();
 tree = draw();
 // Step two: the optional URL field fills the fields below it.
 pick(tree, (node) => node.props.className === "ce-input" && node.props.placeholder === t("db.addressPlaceholder")).props.onChange({ target: { value: "/demo/demo.sqlite" } });
 tree = draw();
 pick(tree, (node) => node.type === "button" && node.children?.[0] === t("db.saveAndConnect")).props.onClick();
 await tick();
 draw.flushEffects();
 tree = draw();

 // Open the projects table, then run a GROUP BY in a second tab.
 const row = pick(tree, (node) => node.props.className?.startsWith("cedb-table-row"));
 row.props.onClick();
 await tick();
 draw.flushEffects();
 tree = draw();

 button(t("db.newQuery")).props.onClick();
 tree = draw();
 pick(tree, (node) => node.props.className === "cedb-sql").props.onChange({ target: { value: "SELECT status, COUNT(*) AS projects\nFROM projects\nGROUP BY status\nORDER BY projects DESC;" } });
 tree = draw();
 pick(tree, (node) => node.type === "button" && node.props.className?.includes("cedb-run")).props.onClick();
 await tick();
 draw.flushEffects();
 tree = draw();
 // The result grid is what makes this readable; the schema tree stays open
 // beside it (the table row is expanded by the click above).
 return tree;
}

/** RPC workbench: load the demo proto, pick a unary method, invoke it. */
async function rpcPreview() {
 const draw = createHookRenderer(RpcView, { sessionId: "demo-session", useSessions: (select) => select({ byId: { "demo-session": { cwd: root } } }), t }, { effects: true });
 let tree = draw();
 draw.flushEffects();
 await tick();
 tree = draw();
 // The field holds host:port only; the scheme is the selector beside it.
 pick(tree, (node) => String(node.props.className ?? "").includes("cerpc-host")).props.onChange({ target: { value: "api.example.test:443" } });
 tree = draw();
 pick(tree, (node) => node.props["aria-label"] === t("rpc.scheme")).props.onChange({ target: { value: "grpcs://" } });
 tree = draw();
 pick(tree, (node) => node.props.className === "ce-input cerpc-input" && node.props.placeholder === "proto/hello.proto").props.onChange({ target: { value: "proto/greeter.proto" } });
 tree = draw();
 pick(tree, (node) => node.type === "button" && node.children?.[0] === t("rpc.load")).props.onClick();
 await tick();
 draw.flushEffects();
 tree = draw();
 pick(tree, (node) => node.props.className === "cedb-sql cerpc-json").props.onChange({ target: { value: '{\n  "name": "ada",\n  "tags": ["demo"]\n}' } });
 tree = draw();
 pick(tree, (node) => node.type === "button" && String(node.children?.[0] ?? "").includes(t("rpc.invoke"))).props.onClick();
 await tick();
 draw.flushEffects();
 return draw();
}

const scenes = { workspace: await codePreview(), api: await apiPreview(), skills: await skillsPreview(), db: await dbPreview(), rpc: await rpcPreview() };
// Fixture rendering stubs setTimeout; real timers are needed for CDP below.
globalThis.setTimeout = nativeSetTimeout;
if (typeof WebSocket !== "function") throw Error("This script needs Node >= 22 (global WebSocket). Run it with a newer Node, e.g. the DSH bundled runtime.");
const temporary = await mkdtemp(join(tmpdir(), "dsh-readme-preview-"));
const chrome = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const light = "--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#f7f8fa;--dsw-alias-bg-layer-2:#eff1f4;--dsw-alias-interactive-bg-hover:#e9edf3;--dsw-alias-label-primary:#202329;--dsw-alias-label-secondary:#555d68;--dsw-alias-label-tertiary:#697481;--dsw-alias-border-l1:#d5dae0;--dsw-alias-border-l2:#b8c1cc;--dsw-alias-button-primary-fill:#2463c7;--dsw-alias-label-primary-foreground:#fff;--dsw-alias-state-success-primary:#247449";
const dark = "--dsw-alias-bg-base:#111315;--dsw-alias-bg-layer-1:#181b1f;--dsw-alias-bg-layer-2:#20242a;--dsw-alias-interactive-bg-hover:#29313b;--dsw-alias-label-primary:#edf2f7;--dsw-alias-label-secondary:#aab5c1;--dsw-alias-label-tertiary:#7d8996;--dsw-alias-border-l1:#39414a;--dsw-alias-border-l2:#515b66;--dsw-alias-button-primary-fill:#b9d1ff;--dsw-alias-label-primary-foreground:#13243d";
// Write every fixture first so the privacy gate runs before any browser starts.
const shots = [];
for (const [scene, tree] of Object.entries(scenes)) {
 const markup = serialize(tree);
 if (/\/Users\/|\/home\/|bilibili|wang-jun|Bearer\s|localhost:\d|127\.0\.0\.1/i.test(markup)) throw Error(`Privacy check failed: ${scene}`);
 for (const theme of ["light", "dark"]) {
  const htmlPath = join(temporary, `${scene}-${theme}.html`);
  const imagePath = fileURLToPath(new URL(`../docs/images/readme-${scene}-${theme}.png`, import.meta.url));
  await writeFile(htmlPath, `<!doctype html><html lang="zh"><meta charset="utf-8"><style>html,body{margin:0;height:100%;width:1100px;font-family:system-ui,-apple-system,sans-serif;color-scheme:${theme};${theme === "light" ? light : dark}}body{display:flex;flex-direction:column}*{box-sizing:border-box}.preview-caption{height:28px;flex:none;display:flex;align-items:center;padding:0 14px;background:${theme === "light" ? "#f7f8fa" : "#181b1f"};color:${theme === "light" ? "#555d68" : "#aab5c1"};font-size:11px;border-bottom:1px solid ${theme === "light" ? "#d5dae0" : "#39414a"}}.preview-scene{flex:1;min-height:0;overflow:hidden}.preview-explorer{display:flex;flex:1;min-height:0}${CSS}</style><div class="preview-caption">DEMO · 完全虚构数据 / Fictional data · ${scene}</div><main class="preview-scene">${markup}</main></html>`);
  shots.push({ scene, theme, htmlPath, imagePath });
 }
}

const profileDirectory = join(temporary, "chrome-profile");
const { child, endpoint } = await launchChrome(chrome, profileDirectory);
let client;
try {
 const socket = new WebSocket(endpoint);
 await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", () => reject(Error("Chrome DevTools socket failed to connect")), { once: true }); });
 client = createCdpClient(socket);
 const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
 const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
 await client.send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 760, deviceScaleFactor: 1, mobile: false }, sessionId);
 await client.send("Page.enable", {}, sessionId);
 for (const { scene, theme, htmlPath, imagePath } of shots) {
  const loaded = new Promise((resolve, reject) => {
   const off = client.on("Page.loadEventFired", () => { clearTimeout(timer); off(); resolve(); });
   const timer = setTimeout(() => { off(); reject(Error(`Page load timed out: ${scene}-${theme}`)); }, 30_000);
  });
  const navigation = await client.send("Page.navigate", { url: `file://${htmlPath}` }, sessionId);
  if (navigation.errorText) throw Error(`Navigation failed for ${scene}-${theme}: ${navigation.errorText}`);
  await loaded;
  // Two animation frames let fonts and flex layout settle before capture.
  await client.send("Runtime.evaluate", { expression: "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))", awaitPromise: true }, sessionId);
  const { data } = await client.send("Page.captureScreenshot", { format: "png" }, sessionId);
  await writeFile(imagePath, Buffer.from(data, "base64"));
  const bytes = await readFile(imagePath);
  if (bytes.length < 5000) throw Error(`Screenshot appears empty: ${scene}`);
  console.log(`Created readme-${scene}-${theme}.png (${bytes.length} bytes)`);
 }
} finally {
 try { client?.close(); } catch { /* already closed */ }
 child.kill("SIGTERM");
 await new Promise((resolve) => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else { child.once("exit", resolve); setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 5000).unref(); } });
 await rm(temporary, { recursive: true, force: true }).catch(() => {});
}
