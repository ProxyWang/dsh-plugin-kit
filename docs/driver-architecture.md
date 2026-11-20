# 数据库驱动架构：零依赖的前提下做到 dbx 的连接质量

本文回答一个问题：**在不引入原生模块、不带 sidecar、不破坏"单包发布"的前提下，怎样把数据库连接做到接近 dbx？**

结论先给：**把驱动做成一个三层阶梯（embedded → module → cli），用同一套接口收敛，由能力矩阵驱动 UI。** 不抄 dbx 的 Rust 驱动，抄它的"能力协商 + 永不把缺依赖变成死状态"。

---

## 1. 硬约束（这些不是偏好）

| 约束 | 来源 | 对设计的影响 |
|---|---|---|
| 插件是 npm 包，`files` 只含 `index.js` / `client.js` / `lib/host/*.js` | `package.json` | 不能带二进制资产，不能有平台分包 |
| 运行时零依赖（仅 `zod`） | 既有约定 | 不能把 `mysql2`/`pg` 变成必装依赖 |
| 跑在 DSH Host（Electron 主进程） | 插件模型 | 同步驱动必须离开主线程；崩溃必须隔离 |
| 无原生模块 | 上述 | `better-sqlite3` 这类不可用；`node:sqlite` 是唯一"内置" |
| 所有能力走私有 HTTP 前缀，连接是 Host 侧状态 | `lib/host/routes.js` | 驱动实现只能作为 Host 内部模块，客户端只认 `db.*` |

现有可复用的接缝（这是方案能小步落地的基础）：

- `lib/host/sqlite-ops.js` —— 纯操作函数（`schema/columns/rows/query`），已经证明"操作"与"传输"可以分离；
- `lib/host/db-worker.js` —— 线程宿主，`{id, op, args}` ↔ `{id, ok, value|error}`；
- `lib/host/binpath.js` —— 外部可执行解析（PATH / keg-only / 项目 `node_modules/.bin`）；
- `runner.call(op, args)` —— `sqliteRunner` 已经是一个事实上的 Runner 接口。

---

## 2. 三层阶梯

同一个逻辑驱动（`mysql`）可以有多种**实现（impl）**，按顺序探测，第一个就绪的胜出：

```
                ┌─────────────────────────────────────────────┐
  mysql  ──────►│ 1. module   mysql2  (工作区或宿主可解析)     │  快、有事务、有类型
                │ 2. cli      mysql   (binpath 解析)           │  兜底，文本协议
                │ 3. none     —— 报告安装命令 + 客户端路径     │  永不"禁用"
                └─────────────────────────────────────────────┘

  postgres ────► 1. module  pg       2. cli  psql        3. none
  sqlite   ────► 1. embedded node:sqlite（内置，唯一实现）
```

**为什么是这个顺序**：`module` 在 Host 进程内、异步、可保持会话（事务）、能拿到真实类型；`cli` 每次调用是一个新进程，天然无法跨语句事务，但零安装成本。两者都缺时，UI 给出安装命令与手动路径（上一版已实现），而不是灰掉选项。

---

## 3. 接口设计

### 3.1 Runner（把现有形状正式化）

```js
/**
 * @typedef {object} Runner
 * @property {"worker"|"inline"|"module"} mode
 * @property {(op: string, args: object) => Promise<any>} call   // schema|columns|rows|query
 * @property {(reason?: string) => Promise<void>} [cancel]
 * @property {() => Promise<void>} close
 */
```

`call` 的 op 集合就是今天 worker 里那张表；新增 op 时三种实现一起扩展，客户端不动。

### 3.2 Driver

```js
/**
 * @typedef {object} Driver
 * @property {"sqlite"|"mysql"|"postgres"} id
 * @property {"embedded"|"module"|"cli"} impl
 * @property {string} label
 * @property {object} capabilities
 * @property {(ctx: Ctx, config: object) => Promise<{ready: boolean, note?: string, bin?: string, version?: string}>} detect
 * @property {(ctx: Ctx, config: object) => Promise<Runner>} open
 */

/** @typedef {object} Ctx
 *  @property {string} cwd            会话工作区（决定从哪找项目内模块）
 *  @property {object} env
 *  @property {(name: string) => Promise<string|null>} resolveModule
 *  @property {(name: string) => string|null} resolveBinary   // binpath.findBinary
 */
```

### 3.3 能力矩阵（驱动 UI，而不是靠 if 判断 driver 名字）

```js
capabilities: {
  transactions: boolean,   // 能否跨语句 BEGIN/COMMIT
  changes: boolean,        // 写语句能否返回影响行数
  typedValues: boolean,    // DATE/DECIMAL/JSON/BLOB 是否保留类型
  streaming: boolean,      // 大结果能否流式读取
  explain: boolean,        // EXPLAIN 结构化输出
  cancel: "statement" | "connection",
}
```

| impl | transactions | changes | typedValues | streaming | cancel |
|---|---|---|---|---|---|
| embedded (sqlite) | ✅（同连接） | ✅ | 部分 | ❌（同步 API） | connection（终止 worker） |
| module (mysql2/pg) | ✅ | ✅ | ✅ | ✅ | statement（连接级中断 + 丢弃结果） |
| cli (mysql/psql) | ❌ | ✅（管 tag 解析） | ❌ | ❌ | statement（kill 子进程） |

客户端只读这张表：没有 `transactions` 就不显示事务按钮，没有 `typedValues` 就把单元格当字符串。

---

## 4. 模块解析：为什么"从工作区解析"是对的

LSP 已经这么做了 —— `binpath.js` 逐级向上找 `node_modules/.bin`，语义就是"用户项目里的工具优先"。JS 驱动沿用同一规则：

```js
// lib/host/modresolve.js
import { createRequire } from "node:module";

export function resolveModule(name, cwd) {
  // 1) 会话工作区（逐级向上，到文件系统根为止）
  // 2) DSH 自身的 require 解析（即使宿主打包了 mysql2 也能用）
  // 3) 显式配置的 driverModule 路径
}
```

**这条规则比 CLI 更危险**：加载项目里的 JS 等于在 Host 进程里执行项目代码，而 `spawn` 只是跑一个可执行文件。因此加三道闸：

1. **默认不自动启用**：`db.drivers` 只报告"项目内 mysql2 可用"；需要用户在连接对话框勾选「允许使用项目内的驱动」，或设置 `DSH_DB_ALLOW_WORKSPACE_MODULES=1`。
2. **白名单包名**：`mysql2`、`pg`、`better-sqlite3`、`sqlite3`；不接受任意路径，不接受 `./xxx.js`。
3. **在 worker 里加载**：模块在 `db-worker.js` 线程内 `import()`，崩溃 / 死循环只毁那一个连接（`worker.terminate()` 已是既有取消语义）。

---

## 5. Worker 通用化（一次改造，三种实现共用）

现在 `db-worker.js` 写死了 `node:sqlite`。改成按 `workerData.kind` 分派：

```js
// workerData: { kind: "sqlite", path } | { kind: "module", entry, config }
const handlers = kind === "sqlite"
  ? sqliteOps(db)                       // 现有实现
  : await moduleOps(entry, config);     // import(entry) → 适配到同一张 ops 表
```

好处：取消语义统一（terminate）、内存上限统一、CLI 之外的实现都不碰主线程。

---

## 6. 分期（每期都能独立发布）

### P0 —— 抽契约，不改行为（~0.5 天）

- 新增 `lib/host/drivers/{index,sqlite,cli-mysql,cli-postgres}.js`，把 `db.js` 里的 if/else 搬进去；
- `db.drivers` 响应增加 `impl` / `alternatives` / `capabilities`（客户端忽略未知字段，向后兼容）；
- `db.connect` 接受可选 `impl`，默认走阶梯；
- 新增 `test-db-contract.mjs`：同一套断言对每个可用 impl 跑一遍（今天的 DB 测试直接升级成契约测试）。

**验收**：所有现有测试不改一行通过；`db.drivers` 多出的字段不影响旧面板。

### P1 —— MySQL 走 module（~1–2 天）

- `drivers/module-mysql.js`：`mysql2/promise` 的 `createConnection` → Runner（`schema` 用 `information_schema`，`rows` 用 `LIMIT/OFFSET`，`query` 用 `execute`）；
- `modresolve.js` + 同意开关 + 白名单；
- `db-worker.js` 支持 `kind: "module"`；
- 连接对话框显示来源：`驱动：项目内 mysql2@3.11`。

**验收**：装了 `mysql2` 的工作区里，`BEGIN → UPDATE → ROLLBACK` 跨语句生效；没装时行为与今天一致。

### P2 —— PostgreSQL 走 module（~1 天）

`pg` 的 `Client` 同样适配；注意 `pg` 的 `types` 配置（`int8`/`numeric` 默认返回字符串，正好与 `typedValues` 对齐）。

### P3 —— 能力矩阵进 UI（~1 天）

- 驱动来源 chip（内置 / 项目模块 / CLI）；
- 事务按钮（仅 `transactions`）；
- 单元格按 `typedValues` 渲染（日期、JSON、二进制分别展示）；
- EXPLAIN 面板（仅 `explain`）。

### P4 —— SSH 隧道（可选，零依赖）

用 `ssh -L` 子进程实现端口转发，复用 `binpath` 找 `ssh`：与 dbx 的隧道功能对齐，但不需要 `ssh2` 依赖。

---

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| 项目内 `mysql2` 版本过旧/过新 | 只用稳定 API（`createConnection`/`execute`/`query`），探测版本并写进 `note`，失败自动降级到 CLI |
| 加载项目模块导致 Host 风险 | 白名单 + 显式同意 + worker 隔离 |
| 大结果集撑爆内存 | JS 驱动用流式读取 + 现有 10k 上限；worker 内存上限已在 `STREAM_BYTES` 有先例 |
| 事务挂起锁表 | 连接空闲超时 + 面板「回滚」按钮 + 断开即回滚 |
| 模块解析到错误的包（同名） | 只接受白名单包名，且必须能被 `require.resolve` 解析到真实路径 |

---

## 8. 兼容性

- `db.*` 路由签名不变；`db.connect` 新增可选 `impl` / `allowModule`；
- `db.drivers` 只增字段，不删字段（旧客户端不受影响）；
- 没有 `mysql2` / `pg` 的机器上，行为与 v2.1.1 完全一致 —— 这一条要写进契约测试。

---

## 9. 为什么不直接抄 dbx 的驱动层

| dbx | 本插件 |
|---|---|
| Tauri + Rust，驱动编译进二进制（`crates/dbx-driver-*`） | Electron + JS 插件，随 npm 包发布 |
| 自带驱动商店、下载、签名（`plugins/` + `dbx-plugin-runtime`） | 无发布管线，只有 npm |
| 可以自由引入原生依赖 | 原生依赖会带来 ABI/平台矩阵/Electron 升级重编 |

抄它能抄的是**决策**（能力协商、永不禁用、来源可见、先测后连），不是代码。本方案把这三条落在同一套接口上，代价是"要么用户装了客户端，要么项目里装了 JS 驱动"——这也是零依赖架构的真实边界。
