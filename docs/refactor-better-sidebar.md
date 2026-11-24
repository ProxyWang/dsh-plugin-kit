# 吸收 dsh-better-sidebar 的改造方案

> 对标版本：`dsh-better-sidebar` v0.32.1 ／ `dsh-plugin-kit` 2.4.0 ／ 宿主 DSH 0.2.2-rc.5
> 状态：设计文档，未施工。当前工作区有 20 个文件、约 850 行未提交改动，先提交再动代码。
> 结论：采纳 9 项（分 P0/P1/P2 三期），不采纳 5 项。

## 0. 一页结论

kit 的数据面（LSP、Git、DB、API 调试、浏览器、技能）已经比 better-sidebar 更深，缺的不是功能，而是 **契约化的传输与工程纪律**：

1. **错误可判定**：现在所有失败都回 HTTP 200 + 字符串；升级为 `{code, message}` + 4xx/5xx。
2. **准入统一**：所有路由首行过 `connection.requestRejection`，不再默认相信 `127.0.0.1`。
3. **写入原子**：`writeFile` 直改 → temp + rename，保留 `baseMtime` 乐观并发。
4. **作用域收敛**：已有三套 key 规则（session / cwd / global），提炼成一个 `storage.js`，规则写死。
5. **按需加载**：`client.js` 953KB → 核心 + 4 个 chunk，目标核心 < 400KB。
6. **可被消费**：`ctx.provide('pluginKit')` 暴露 openFile / openDiff / navigate / registerViewer。
7. **设置可运营**：先验证导出 `Config` 的宿主表单，再决定是否做卡片式分区。
8. **工程守护**：manifest 一致性、DSH 基线一致、真机挂载冒烟、`AGENTS.md` 红线表。
9. **文档即契约**：`host-contracts.md`、版本兼容矩阵、插件详情页。

不采纳：删工作区围栏、双 bundle 通道、TS 全量迁移、自绘底部工作台、五扩展点全量平台化。

## 1. 现状盘点（kit 2.4.0）

| 维度 | 现状 | 证据 |
|---|---|---|
| Host 入口 | `apply(ctx, config)`，单前缀 `/code-explorer/api`，仅 POST，59 条路由（`routes.js`）+ DB 驱动表 + browser/vault 两个存储端点 | `index.js`、`lib/host/routes.js` |
| Host 模块 | `lib/host/*` 32 个文件：fence / lsp / git / skills / db / vault / browser / tasks / watch / streams | `lib/host/` |
| 安全围栏 | realpath containment + symlink 拒绝 + `..` 拒绝；写仅限已存在普通文件 | `lib/host/fence.js` |
| 写文件 | `writeFile` 直接覆盖；有 `baseMtime` 冲突检测，无原子落盘 | `fence.js:writeFencedText` |
| 错误语义 | catch 后统一 `respondJson(res, 200, { ok: false, error: String(...) })` | `index.js`、`lib/host/http.js` |
| 准入 | 无 `connection` 校验，路由直接开放 | `index.js`（无 connection） |
| Client | 953KB 单产物 `client.js`，`src/client/**` 约 23k 行，esbuild 单入口 CJS | `scripts/build-client.mjs`、`client.js` |
| 作用域 | 三套并存：`dsh.plugin-kit.v1.<sid>`（code）、`dsh.ce.api.*.v2.<cwd>`（API）、全局偏好键 | `src/client/code.js:210`、`apistore.js`、`orphans.js` |
| 设置 | 无自绘设置页；已导出 `Config`（zod），表单是否由宿主生成待验证 | `index.js` |
| 对外能力 | 无 service；第三方只能自己重写 HTTP 调用 | 全仓无 `ctx.provide` |
| 测试 | 8 个 `test-*.mjs`（约 8.2k 行）+ `test-contract.mjs`；CI 两条 lane（Node 20 / Node 24 + gopls） | `test-*.mjs`、`.github/workflows/ci.yml` |
| 文档 | 内部设计 4 篇（db / driver / interaction / ui），无对外契约 | `docs/` |
| 版本 | 2.4.0，无兼容矩阵，无 manifest 守护 | `package.json` |

## 2. 对标决策表

| # | 能力 | better-sidebar 做法 | kit 现状 | 决策 |
|---|---|---|---|---|
| A1 | 错误语义 | `{code,message}` + 22 码 + 状态映射（`src/wire.ts`） | 200 + 字符串 | 采纳 |
| A2 | 准入 | 每路由首行 `ctx.connection.requestRejection`（`src/index.ts:1442`） | 无 | 采纳 |
| A3 | 原子写 | temp + rename，失败清理（`fs-operations.ts`） | 直接写 | 采纳 |
| A4 | 按需加载 | chunk factory + `ctx.modules` + 三档缓存（`client/chunk-loader.ts`） | 953KB 单文件 | 采纳（P2） |
| A5 | 设置 | `Config` → 宿主 forms；卡片式 `settings.section` | 有 Config，无 UI | 部分采纳 |
| A6 | 平台 | `ctx.betterSidebar` 五扩展点 + 生态 | 无 | 采纳精简版 |
| A7 | 会话隔离 | 单 store，`<prefix>:<sid>` + LRU | 三套 scope 并存 | 改造为统一 storage |
| A8 | 工程守护 | manifest/baseline/consumer-types/mount e2e | 有测试，无守护 | 采纳 |
| A9 | 文档契约 | host-contracts / external-guide / 版本矩阵 | 内部 docs | 采纳 |
| — | 删工作区围栏 | v0.23 已移除，README 声明"不能再当边界" | 保留更严围栏 | **不采纳**（反向优势） |
| — | 双 bundle 通道 | `client.js` + `client-registry.js` 二编 | 单通道 | 不采纳（历史包袱） |
| — | TS + 全套工具链 | tsc/tsdown/lint/consumer-types | 纯 JS | 不采纳（成本） |
| — | 自绘底部工作台 | 自建 xterm 面板 | 已有终端 tab（宿主 `webTerminals`） | 不采纳（重复造） |
| — | 五扩展点全量 | tab/viewer/icon/action/tabAction | 原生 `sidebarRightTabs` 已可注册 tab 类型 | 不采纳（先做数据面服务） |

## 3. 前置验证（施工第一天做完，各 15 分钟）

| # | 假设 | 验证方式 | 不成立时的备选 |
|---|---|---|---|
| V1 | 宿主 `connection` 服务可用且 `requestRejection(req)` 返回 undefined 表示放行 | 在 `index.js` 的 webServer 回调里打印 `ctx.connection`；或读 DSH host 包 | 退化：自检 Host 头 ∈ {127.0.0.1, localhost, [::1]} + `Origin` 同源，失败 403 |
| V2 | 导出 `Config` 会自动出现在 Settings 插件行表单 | 打开设置页看本插件行 | 自绘 `settings.section` + 自身路由读写 |
| V3 | 客户端可 inject `modules` 服务 | 客户端加 `modules` 后打印 `typeof ctx.modules` | 保持单文件，只做代码分割的构建优化 |
| V4 | 客户端可动态插 `<script>` 并取全局 factory | 与 V3 同一探针 | 放弃 A4，改为按需 `import()` 不可行则维持单文件 |

## 4. 改造项设计

### A1 错误语义：从字符串到可判定错误

**问题**：客户端拿到 `ok:false` 后只能展示字符串，无法区分"参数错 / 冲突 / 找不到 / 太大"，12 个消费点全靠猜。

**设计**：新增 `lib/host/errors.js`，路由层统一出口。

```js
// lib/host/errors.js（已实现）
const STATUS = {
  "bad-request": 400, forbidden: 403, "not-found": 404, "method-error": 405,
  conflict: 409, "too-large": 413, unavailable: 503, internal: 500,
};
export class ApiError extends Error {
  constructor(code, message, meta) { super(message); this.code = code; this.status = STATUS[code] ?? 400; this.meta = meta; }
}
// lib/host/http.js（已实现）
export function sendError(res, error) {
  const e = toApiError(error);                       // 含 errno 映射
  if (res.headersSent) { res.destroy(); return; }    // 不二次写头
  respondJson(res, e.status, { ok: false, error: e.message, code: e.code });
}
```

**实现取舍（与初版设计的差异）**：信封保留顶层 `error` 字符串并新增 `code`，而不是把 `error` 改成
`{code,message}` 对象。原因：12 个客户端消费点与 300+ 主机测试都按字符串断言，对象化会逼出一次全量
客户端改造却没有额外收益——`code` 已经能分支。对象化留到客户端统一改版时再做。

**改动清单**

| 文件 | 改动 |
|---|---|
| `lib/host/errors.js` | 新增：`ApiError` + 状态表 + `sendOk/sendError` |
| `lib/host/http.js` | `readJsonBody` 超限抛 `ApiError("too-large","request body too large")`，JSON 解析失败抛 `bad-request` |
| `index.js` | 前缀 handler：未知路由 `not-found`、非 POST `bad-request`（405 语义化）、catch 改 `sendError` |
| `lib/host/fence.js` | 围栏类错误换 `ApiError("forbidden"/"not-found"/"conflict")`；`baseMtime` 冲突用 `conflict` |
| `lib/host/routes.js` | git 非仓库 / ref 不存在 → `conflict`/`bad-request`；LSP 未就绪 → `unavailable` |
| `src/client/api.js` | 归一化：`return { ok:false, error: message, code }`，12 个消费点零改动 |
| `test-host.mjs` | 新增错误码表断言：每条错误路径 → 期望 status + code |

**验收**：`test-host.mjs` 覆盖 6 类错误的 HTTP 状态与 code；客户端 `res.code` 可用于分支；旧客户端在 `error` 字段仍拿到字符串（向后兼容）。

### A2 准入：所有路由过 connection fence

**问题**：`/code-explorer/api` 对任何能访问端口的进程开放（本机浏览器、其他用户、SSRF）。kit 的围栏只管路径，不管调用者。

**设计**：把 fence 提到最外层，与 better-sidebar 同构。

```js
// index.js（已实现）：请求时取连接策略，缺失则退化为 loopback Host 校验
function callerAllowed(req) {
  const connection = typeof ctx.get === "function" ? ctx.get("connection") : undefined;
  if (typeof connection?.requestRejection === "function") {
    try { return connection.requestRejection(req) === undefined; } catch { return false; }
  }
  const host = req.headers?.host;
  if (typeof host !== "string" || host === "") return true;   // 非浏览器调用
  const name = host.replace(/:\d+$/, "").toLowerCase();
  return name === "127.0.0.1" || name === "localhost" || name === "[::1]" || name === "::1";
}
// prefix handler 首行：
if (!callerAllowed(req)) { sendError(res, new ApiError("forbidden", "forbidden")); return; }
```

**实现取舍**：不用模块级 `inject: ['connection']`，改为请求时 `ctx.get` + 退化分支。原因：把注册绑在
`connection` 上会让缺少该服务的宿主（以及测试 harness）永远挂不上 API；退化到 loopback 校验保证
"服务缺失 ≠ 完全放开"。

**要点**：`webServer.register` 与 `connection` 在同一 `ctx.inject` 内注册，避免服务晚到；未来 WS upgrade（终端、watch）同样首行 fence；`storageDomain`/`skills` 等可选服务的注入分支保持不变。

**验收**：`curl -H 'Host: evil.example'` → 403；`curl` 默认 Host 127.0.0.1 → 200；`test-host.mjs` 增加 Host/Origin 表。

### A3 原子写：temp + rename

**问题**：`writeFile` 直接截断目标文件，进程被杀或磁盘满会留下半截文件；`baseMtime` 检查与写入之间有竞争窗口。

**设计**：

```js
const dir = dirname(target.filename);
const base = basename(target.filename);
const tmp = join(dir, `.${base}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`);
try {
  await writeFile(tmp, content, "utf8");
  const fresh = await lstat(target.filename);            // 写前再确认一次
  if (Number.isFinite(baseMtime) && fresh.mtimeMs !== baseMtime) throw new ApiError("conflict", "file changed on disk");
  await rename(tmp, target.filename);                     // 同目录 rename 原子
  const after = await lstat(target.filename);
  return { path: requestedPath, size, mtimeMs: after.mtimeMs };
} catch (error) {
  await unlink(tmp).catch(() => {});
  throw error;
}
```

**验收**：写入过程中 `kill -9` 后目录无 `.tmp` 残留、目标文件要么旧内容要么新内容；`baseMtime` 失配返回 409 `conflict`。

### A4 按需加载：核心 + chunk（P2，成本最高）

**约束**：DSH 每个客户端入口只注册一个 module id，`client.js` 必须是单入口产物。better-sidebar 的破法：chunk 不走模块系统，只把 factory 挂到 `globalThis.__dshChunks__`，由核心用 `<script>` 加载后拼 require 表。

**设计**：

1. 构建：`scripts/build-client.mjs` 增加多 entry，产出 `client.js` + `chunks/{mermaid,terminal,locale,db}.js`（IIFE，尾部 `globalThis.__dshChunks__["mermaid"]=factory`）。
2. Host：新增只读资源路由 `/code-explorer/asset/<name>.js`（fence + 白名单 name，`content-type: text/javascript`，`cache-control: no-cache` + ETag）。
3. Client：新增 `src/client/chunks.js`：

```js
const pending = new Map();
export function loadChunk(name) {
  if (pending.has(name)) return pending.get(name);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${ASSET}/${name}.js`;
    script.onload = () => resolve(globalThis.__dshChunks__[name]);
    script.onerror = () => { script.remove(); reject(new Error(`chunk ${name} failed`)); };
    document.head.append(script);
  });
  pending.set(name, promise);
  promise.catch(() => pending.delete(name));   // 失败可重试
  return promise;
}
```

4. 共享依赖：chunk 不打包 react，factory 接收核心注入的 `{ h, api }`；核心侧 `lazyComponent(loadChunk("mermaid"), shared)` 提供 loading / error + 重试。
5. 首批只拆最大且最低频的：`mermaid`（Markdown 预览）、`terminal`（xterm）、`locale`（19 语种不需要，kit 目前 zh/en 内联，可不动）。

**度量**：`client.js` 目标 < 400KB（未压缩）；首次打开文件树不触发任何 chunk。

**风险**：HMR 后旧 chunk 缓存需失效（ETag + `?v=<build>`）；CSP `script-src` 需允许同源；构建复杂度上升。**回滚**：保留 `--single` 构建开关，chunk 加载失败自动退回内联实现（首版可只做 mermaid 一个）。

### A5 设置：先验证宿主表单，再决定做不做卡片

**设计分两步**：

1. `Config` 已导出（`formatOnSave` / `liveRefresh` / `lspIdleMs` / `apiTimeoutMs` / `collectionDir` / `terminalApp` / `dbDefaultDriver`）。按更好侧栏的经验，宿主 Settings 会按插件行读 `Config` 生成表单——**先按 V2 验证**。若成立，只做：字段 `.describe()` 文案补全 + 敏感项默认保守 + `docs/` 说明。
2. 若要做「设置 → 侧边卡片」式分区：`ctx.slots.inject("settings.section")` 注册一节，卡片从自有注册表生成（不硬编码行），写入走插件自己的 fenced 路由 + `revision` 守卫 + 乐观回滚；**不直连宿主 settings RPC**。

**验收**：改 `liveRefresh` 关闭后刷新不再触发 watch 请求；设置持久化跨重启；非法值被 schema 拒绝并提示。

### A6 对外能力：精简版 service

**问题**：kit 的能力（跳转文件、看 diff、LSP 导航）只有自家 UI 能用；第三方重复实现 HTTP 调用，容易绕过围栏。

**设计**：客户端 `ctx.provide('pluginKit')`，先给 4 个动作，不做全量扩展点（原生 `sidebarRightTabs` 已负责 tab 注册）：

```js
ctx.provide("pluginKit", {
  version: 1,
  openFile(path, { line, column } = {}),
  openDiff(path, { scope = "working" } = {}),
  navigate({ path, line, column }),
  registerViewer({ ext, priority = 100, component }),   // 返回 disposer，内部 ctx.effect
});
```

配套：`docs/external-plugin-guide.md`（方法签名、示例 20 行、版本/capability 位、陷阱）；无插件装时不影响主流程。

**验收**：一个 20 行示例插件能调 `openFile` 打开文件并定位行；`registerViewer` 注册的预览器在文件树点击后生效；拆卸后无残留。

### A7 作用域收敛：一套存储规则（不重写 store）

**问题**：三套 key 规则并存，新增状态时容易选错作用域（API 草稿曾跨项目串数据，已有 v2 迁移）。

**设计**：`src/client/storage.js` 统一出口，**只换 key 生成与迁移，不动 store 结构**：

| 作用域 | 存什么 | key 形态 |
|---|---|---|
| session | 打开的文件、滚动/展开、当前 tab、调试中的请求 | `dsh.plugin-kit.<kind>.v3.s:<sid>` |
| workspace | API 草稿/历史/收藏/环境、集合目录 | `dsh.plugin-kit.<kind>.v3.w:<encodeURIComponent(cwd)>` |
| global | live/format 开关、面板宽度等偏好 | `dsh.plugin-kit.<kind>.v3.g` |

```js
export const scope = {
  session: (id) => `s:${id}`,
  workspace: (cwd) => `w:${encodeURIComponent(String(cwd ?? "").trim() || "global")}`,
  global: () => "g",
};
export function key(kind, scopeId) { return `dsh.plugin-kit.${kind}.v3.${scopeId}`; }
export function read(kind, scopeId) { /* try/catch + JSON */ }
export function write(kind, scopeId, value) { /* try/catch, quota 静默 */ }
export function removeScopes(predicate) { /* orphans 清理复用 */ }
```

迁移：`apistore` 的 `.v2.<cwd>`、`code.js` 的 `v1.<sid>`、browser tabs 的 `v2.<sid>.<tabId>` 各写一条一次性迁移（读旧写新、幂等、失败保留旧键）；`orphans.js` 改为调用 `removeScopes`。

**验收**：既有测试全过 + 新增"同项目双会话互不污染 / 不同项目互不污染 / 旧键迁移幂等"三组断言。

### A8 工程守护：三个零依赖脚本 + 红线表

| 新增 | 内容 | 灵感 |
|---|---|---|
| `scripts/check-manifest.mjs` | `exports`/`files` 指向的文件真实存在；`package.json` 与 `cordis.patch.yml` 的 id/版本一致；`client.js` banner 的模块 id 与 `dsh.client` 一致 | better-sidebar `tests/manifest-consistency.spec.ts` |
| `scripts/check-baseline.mjs` | README、CI、`package.json` 中声明的 DSH 版本区间一致 | `tests/dsh-baseline.spec.ts` |
| `scripts/smoke-mount.sh` | `pnpm pack` → 临时 profile → `dsh plugin add file:<tgz>` → `dsh web --port 0` → 首页 200 + 关键路由 200 + 无 stderr 崩溃 | `scripts/e2e-mount.sh` |
| `AGENTS.md` | 只放 5 条红线 + 「改什么跑什么」表（改 `client.js` 跑 build+test-client；改 host 跑 test-host；改 manifest 跑两个检查） | better-sidebar `AGENTS.md` |

**验收**：CI 加一条 `guard` job；故意改坏 manifest 时 check 退出码 1；冒烟脚本能抓到"装不上/一挂就崩"。

### A9 文档契约

| 文档 | 内容 |
|---|---|
| `docs/host-contracts.md` | 编号不变的宿主契约：路由前缀 / 仅 POST / envelope / cwd 语义 / fence / `baseMtime` / 错误码表 / 版本 |
| `docs/dsh-compat.md` | kit ↔ DSH 版本矩阵（从 2.4.0 / 0.2.2-rc.5 起），抬基线的 5 步清单 |
| `docs/external-plugin-guide.md` | A6 的完整参考（仅做 A6 时写） |
| `locale/*.json` | `meta.title` / `meta.description` / `meta.detail` |
| `detail/DETAIL.md` | 15 行功能说明 + 1 张隔离示意 SVG（可选） |
| `CHANGELOG.md` | 每条带"验证："行（跑了哪个测试/手工步骤） |

## 5. 分期计划

| 期 | 内容 | 改动文件 | 预估 | 风险 |
|---|---|---|---|---|
| P0 | A1 错误语义、A2 准入、A3 原子写、A8 三个脚本 + AGENTS.md、A9 host-contracts | `index.js`、`http.js`、`fence.js`、`errors.js`(新)、`api.js`、`scripts/*`、`tests` | 0.5~1 天 | 低：全部可由 test-host 覆盖 |
| P1 | A7 作用域收敛、A5 设置（先验证再决定）、A6 pluginKit 服务 | `storage.js`(新)、`apistore.js`、`code.js`、`orphans.js`、`index.js`(client) | 1~2 天 | 中：迁移必须幂等，旧键不能丢 |
| P2 | A4 chunk 拆分、真机挂载冒烟、A9 详情页/兼容矩阵 | `build-client.mjs`、`chunks.js`(新)、`index.js`(host 资源路由)、`docs/*` | 2~4 天 | 高：构建/缓存/HMR，保留回滚开关 |

**提交拆分**（每期内部仍按此粒度）：

1. `feat(host): 结构化错误码与状态映射`
2. `feat(host): 所有私有路由过 connection fence`
3. `feat(host): 写入改为 temp+rename 原子落盘`
4. `chore(guard): manifest/baseline 检查 + AGENTS.md`
5. `refactor(client): 统一作用域存储与迁移`
6. `feat(client): pluginKit 服务（openFile/openDiff/navigate/registerViewer）`
7. `perf(client): mermaid chunk 按需加载`
8. `docs: host-contracts / 兼容矩阵 / 插件详情页`

## 5.1 实施记录（P0 已完成，2026-11-24）

| 项 | 状态 | 提交 | 验证 |
|---|---|---|---|
| A1 错误语义 | 完成 | `feat(api): machine-readable failure codes and HTTP statuses` | `test-host.mjs` 325 通过（含 9 条状态/码断言） |
| A2 准入 fence | 完成 | `feat(api): gate every request on the Host connection policy` | 5 条 fallback/authoritative 断言 |
| A3 原子写 | 完成 | `feat(api): write files atomically with temp + rename` | 7 条内容/mode/无残留/冲突断言 |
| A8 工程守护 | 完成 | 随 P0 提交 | `check-manifest` 26 项、`check-contract` 11 项，均已接入 `pnpm test` |
| A9 契约文档 | 部分 | 随 P0 提交 | `docs/host-contracts.md` §1–§11；版本矩阵与详情页留待 P2 |
| A4/A5/A6/A7 | 未开始 | — | 见第 5 节 P1/P2 |

与初版设计的差异（已回写各节）：A1 保留 `error` 字符串 + 新增 `code`；A2 用请求时 `ctx.get` + loopback
退化，而不是模块级 inject。两个差异都是为了不破坏 12 个既有消费点与 300+ 既有断言，同时保住安全语义。

## 6. 风险与回滚

| 风险 | 应对 |
|---|---|
| 未提交改动冲突 | 施工前 `git commit`；每期单独分支 |
| `connection` 服务不可用（V1 失败） | 退化到 Host/Origin 白名单，并在 `docs/host-contracts.md` 标注 |
| 错误码改动破坏 12 个客户端消费点 | `api.js` 归一化层保持 `error` 为字符串；先合 host，再合 client |
| HMR 与新 host 混跑 | 首屏握手：`/code-explorer/api/health` 返回 `{apiVersion, build}`，client 版本不符时提示"刷新页面"而不是静默失败 |
| chunk 拆分引入回归 | 保留单文件构建开关；chunk 失败回退内联；先只拆 mermaid |
| 迁移丢用户数据 | 迁移先读后写、成功才删旧键；失败保留旧键并 warn；提供 `dsh.plugin-kit.migrated.v3` 标记 |

## 7. 验收度量

| 指标 | 现状 | 目标 | 测量 |
|---|---|---|---|
| `client.js` 体积 | 953KB（仓库内产物） | 核心 < 400KB | `ls -l client.js` |
| 错误可区分度 | 1 种 | 6 类 code + 状态码 | `test-host.mjs` 断言表 |
| 路由准入 | 无 | 100% 路由过 fence | 代码扫描 + 403 用例 |
| 写原子性 | 直接写 | 无 `.tmp` 残留 | 并发/中断用例 |
| 作用域规则 | 3 套 | 1 套 + 迁移 | `test-client.mjs` 断言 |
| 守护脚本 | 0 | 3 个进 CI | `ci.yml` guard job |
| 文档 | 内部 4 篇 | + 契约/兼容/详情 | `docs/` |

## 附录：参考实现映射

| better-sidebar 位置 | 借鉴点 | kit 落点 |
|---|---|---|
| `src/wire.ts` | 错误码 + 状态映射 + `headersSent` | `lib/host/errors.js` |
| `src/index.ts:1442` | `connection.requestRejection` funnel | `index.js` 路由入口 |
| `src/fs-operations.ts` | temp+rename + 冲突处理 | `lib/host/fence.js` |
| `src/client/chunk-loader.ts` | `globalThis.__dshChunks__` + 重试 + ETag | `src/client/chunks.js` + host 资源路由 |
| `src/client/state.ts` | 单 store + per-session 持久化 + LRU | `src/client/storage.js`（只取 scope 规则） |
| `src/client/SideCardSection.tsx` | 声明式设置 inventory | 可选，A5 第二步 |
| `tests/manifest-consistency.spec.ts` | manifest 守护 | `scripts/check-manifest.mjs` |
| `tests/dsh-baseline.spec.ts` | 版本基线守护 | `scripts/check-baseline.mjs` |
| `scripts/e2e-mount.sh` | 真机挂载冒烟 | `scripts/smoke-mount.sh` |
| `docs/host-contracts.md` | 编号契约 | `docs/host-contracts.md` |
| `docs/dsh-version-adaptation.md` | 版本矩阵与抬基线清单 | `docs/dsh-compat.md` |
| `AGENTS.md` | 5 条红线 + 门禁表 | `AGENTS.md` |
| `path-security.ts`（已删围栏） | **反例** | 保留 `fence.js` 现状并写进契约 |
