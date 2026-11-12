// Reproducible README screenshots. Uses fictional fixtures only, with no live
// DSH connection, user workspace reads, credentials or business HTTP requests.
import { register } from "node:module";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

register(new URL("../test-support/esm-react-hook.mjs", import.meta.url), import.meta.url);
const { createHookRenderer } = await import("../test-support/react-stub.mjs");
const { ApiView } = await import("../src/client/apiclient.js");
const { CodeBody } = await import("../src/client/code.js");
const { TreePanel } = await import("../src/client/tree.js");
const { SkillsView } = await import("../src/client/skills.js");
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
 pick(tree, (node) => node.props.className === "ce-input cea-url").props.onChange({ target: { value: "https://api.example.test/v1/projects" } });
 tree = draw();
 pick(tree, (node) => node.type === RequestFields).props.onChange([{ name: "limit", value: "20", description: "每页项目数量" }, { name: "status", value: "active", description: "筛选项目状态" }]);
 tree = draw();
 pick(tree, (node) => node.props.className?.startsWith("cea-config-tab") && node.children[0] === t("api.headers")).props.onClick();
 tree = draw();
 pick(tree, (node) => node.type === RequestFields).props.onChange([{ name: "Accept", value: "application/json", description: "响应数据格式" }, { name: "X-Demo-Mode", value: "true", description: "虚构示例标记" }, { name: "X-Debug", value: "verbose", description: "已停用的示例请求头", enabled: false }]);
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
function serialize(node) {
 if (node == null || typeof node === "boolean") return "";
 if (Array.isArray(node)) return node.map(serialize).join("");
 if (typeof node !== "object") return escape(node);
 if (typeof node.type === "function") return serialize(createHookRenderer(node.type, node.props)());
 if (typeof node.type === "symbol") return serialize(node.children);
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
 return `<${type}${attrs}>${voids.has(type) ? "" : serialize(node.children) + `</${type}>`}`;
}

const scenes = { workspace: await codePreview(), api: await apiPreview(), skills: await skillsPreview() };
const temporary = await mkdtemp(join(tmpdir(), "dsh-readme-preview-"));
const chrome = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const light = "--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#f7f8fa;--dsw-alias-bg-layer-2:#eff1f4;--dsw-alias-interactive-bg-hover:#e9edf3;--dsw-alias-label-primary:#202329;--dsw-alias-label-secondary:#555d68;--dsw-alias-label-tertiary:#697481;--dsw-alias-border-l1:#d5dae0;--dsw-alias-border-l2:#b8c1cc;--dsw-alias-button-primary-fill:#2463c7;--dsw-alias-label-primary-foreground:#fff;--dsw-alias-state-success-primary:#247449";
const dark = "--dsw-alias-bg-base:#111315;--dsw-alias-bg-layer-1:#181b1f;--dsw-alias-bg-layer-2:#20242a;--dsw-alias-interactive-bg-hover:#29313b;--dsw-alias-label-primary:#edf2f7;--dsw-alias-label-secondary:#aab5c1;--dsw-alias-label-tertiary:#7d8996;--dsw-alias-border-l1:#39414a;--dsw-alias-border-l2:#515b66;--dsw-alias-button-primary-fill:#b9d1ff;--dsw-alias-label-primary-foreground:#13243d";
for (const [scene, tree] of Object.entries(scenes)) {
 const markup = serialize(tree);
 if (/\/Users\/|\/home\/|bilibili|wang-jun|Bearer\s|localhost:\d|127\.0\.0\.1/i.test(markup)) throw Error(`Privacy check failed: ${scene}`);
 for (const theme of ["light", "dark"]) {
  const htmlPath = join(temporary, `${scene}-${theme}.html`);
  const imagePath = fileURLToPath(new URL(`../docs/images/readme-${scene}-${theme}.png`, import.meta.url));
  await writeFile(htmlPath, `<!doctype html><html lang="zh"><meta charset="utf-8"><style>html,body{margin:0;height:100%;width:1100px;font-family:system-ui,-apple-system,sans-serif;color-scheme:${theme};${theme === "light" ? light : dark}}body{display:flex;flex-direction:column}*{box-sizing:border-box}.preview-caption{height:28px;flex:none;display:flex;align-items:center;padding:0 14px;background:${theme === "light" ? "#f7f8fa" : "#181b1f"};color:${theme === "light" ? "#555d68" : "#aab5c1"};font-size:11px;border-bottom:1px solid ${theme === "light" ? "#d5dae0" : "#39414a"}}.preview-scene{flex:1;min-height:0;overflow:hidden}.preview-explorer{display:flex;flex:1;min-height:0}${CSS}</style><div class="preview-caption">DEMO · 完全虚构数据 / Fictional data · ${scene}</div><main class="preview-scene">${markup}</main></html>`);
  const result = spawnSync(chrome, ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--window-size=1100,760", `--screenshot=${imagePath}`, `file://${htmlPath}`], { encoding: "utf8" });
  if (result.status !== 0) throw Error(result.stderr || "Chrome screenshot failed");
  const bytes = await readFile(imagePath);
  if (bytes.length < 5000) throw Error(`Screenshot appears empty: ${scene}`);
  console.log(`Created readme-${scene}-${theme}.png (${bytes.length} bytes)`);
 }
}
globalThis.setTimeout = nativeSetTimeout;
