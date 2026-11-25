# 引用面板加速方案（Find References）

> 场景：在 vas5 这类大仓里按 ⇧F12，引用面板要"加载半天"。本文给出实测数据、根因拆解、VSCode/JetBrains/gopls 的做法对照，以及按性价比排序的方案与推荐组合。
> 复现：`node scripts/bench-references.mjs --lsp <file> <line> <col>`（参考实现见该脚本）。

## 1. 实测数据

环境：macOS、本地 SSD、DSH 0.2.2-rc.5、gopls（Go 1.22 工具链）、仓库 `/Users/proxy/orca/vas5`（单 go.mod，40+ 服务）。
被测符号：`app/platform/profile/pkg/router/condparam/taishan.go:16:21` `BatchGetTaiShan`，引用 9 处。

| 阶段 | 耗时（多次实测区间） |
|---|---|
| gopls 进程启动 + `initialize` 握手 | **56–99 ms** |
| 首次 `textDocument/references`（首次冷缓存） | **22 241 ms** |
| 首查后重启进程再查（磁盘缓存已热） | **6 600–14 200 ms** |
| 同一进程内第二次查（热态） | **128–1 233 ms**（大仓波动明显） |
| Host 为 9 条引用附加片段（全文件读取，串行） | 63 ms（小文件集，冷）/ 3 ms（热） |
| 36 条引用 / 18 个最大 Go 文件（共 17.2 MB），串行读 | 86 ms（冷）/ 67 ms（热） |
| 同一批数据，按文件去重 + 并行读 | 49 ms（冷）/ 29 ms（热） |

结论很明确：**不是启动慢（握手 <100ms），也不是片段读取慢（几十 ms），而是"首个语义请求触发 gopls 加载整个工作区"**——剩余时间几乎全是 gopls 在为 `references` 建立包图/类型信息。当前又有一个放大器：`LSP_IDLE_MS = 5 分钟`会杀掉进程，用户隔一会儿再按 ⇧F12 就要再付 6–14 秒；即使是热进程，大仓里单次 references 也可能到 1 秒级，所以缓存同样必要。

## 2. 根因拆解（按影响排序）

| # | 根因 | 证据 | 影响 |
|---|---|---|---|
| R1 | 服务**懒启动**：第一次语义请求才拉起 gopls 并触发工作区加载 | 99ms 握手 + 22s 首个 references | 首次 ⇧F12 的 22s 全部暴露给用户 |
| R2 | **空闲 5 分钟就杀进程**，下次重付 9–14s | `LSP_IDLE_MS`、`touchIdle()` → `stop("idle")` | 一天里反复"变慢" |
| R3 | 大仓**无裁剪**：root 为整个 vas5，gopls 加载无关服务 | `findProjectRoot` 找到 go.mod 即停；无 `directoryFilters` | 冷加载时间被放大 |
| R4 | 引用面板**无缓存/无单飞/无取消**：同一符号重复查都重新走 LSP；快速移动光标会堆请求 | `lsp.request` 无缓存；`api()` 无 AbortSignal；Host 不处理 `req close` | 重复查询慢且积压 |
| R5 | **等待期无信息**：面板只有转圈，gopls 的 `$/progress` 已采集但没展示 | `progressLine()` 存在；`openPeek` busy 期间不读 status | 感知更慢（"以为卡死"） |
| R6 | 片段读取串行整文件 | `attachSnippets` 逐 target `readFencedText`；实测 17 MB/18 文件时串行 67–86 ms，并行去重 29–49 ms | 相对秒级 LSP 是小头，但在大文件集上可省一半以上，且实现成本极低 |

## 3. 参考：成熟 IDE 是怎么做的

| 机制 | VSCode（含 vscode-go / gopls） | JetBrains（GoLand 等） | 本插件现状 |
|---|---|---|---|
| 服务生命周期 | 语言服务器按工作区**常驻**，只在崩溃/配置变更时重启；打开该语言文件即启动 | 后台常驻索引进程 | 懒启动 + 5 分钟空闲杀 |
| 首次加载 | gopls `initialize` 返回后仍会后台加载包；VSCode 显示 `$/progress`（Loaded X packages…），请求**等待但不黑屏** | 索引构建期显示进度，索引完成前部分功能降级 | 只有转圈；预期 90s 超时兜底 |
| 引用查询 | `textDocument/references` + `CancellationToken`；关闭 peek/移动光标发 `$/cancelRequest` | 走本地索引，通常毫秒级 | 无取消、无并发去重 |
| 结果渲染 | 结果到达即渲染；peek 的每行内容来自**已打开的编辑器模型**或文件服务并行读取（不重复整文件串行读） | 索引里直接带上下文 | 等全部返回才渲染；片段串行读 |
| 大结果集 | 上限 + "and N more"，不阻塞 UI | 分页/过滤 | 已截断 60 条，但仍是全量后渲染 |
| 配置裁剪 | `build.directoryFilters` 排除无关目录；多仓库用 workspace folders 分别 root | 按项目范围建索引 | root 即整个仓库 |
| 多服务复用 | gopls 支持 `-remote=auto` 共享 daemon（一个 daemon 服务多个 root/客户端，需版本验证） | 原生共享索引 | 每个 root 一个进程，跨仓跳转要再加载 |

**取舍**：VSCode 的做法本质是"把加载成本藏进日常编辑"，并且"同一进程绝不为同一工作区重复付加载成本"；JetBrains 用自建索引换毫秒级查询，但代价是常驻内存和索引维护——对一个右栏插件过重，不建议复制。

## 4. 候选方案对比

| 方案 | 做法 | 预期收益 | 成本 | 风险 |
|---|---|---|---|---|
| **S1 预热 + 长驻** | 打开 Code 标签（或工作区激活）时发一次廉价语义请求触发加载；`LSP_IDLE_MS` 300000 → 1800000（或 = 工作区关闭才停），加配置开关 | 22s 加载与用户阅读重叠；同会话第二次起退化为"热态" | 0.5 天 | 常驻 gopls 占内存（数百 MB）；需开关与状态提示 |
| **S2 进度可见 + 两段渲染** | busy 期间每 ~800ms 拉 `lsp.status` 显示 `gopls: Loading packages 42%`；先渲染文件分组/行号骨架，snippets 后到再填 | 延迟不变但"可解释"；骨架让首屏有内容 | 0.5 天 | 轮询开销小；需避免与请求风暴叠加 |
| **S3 缓存 + 单飞 + 取消** | Host 侧按 `root+path+line+col+kind+mtime` 缓存结果 30s、合并 in-flight 同键请求；`api()` 支持 AbortSignal，Host 收到 `close` 发 `$/cancelRequest` | 重复查 <50ms；快速移动不堆积 | 0.5–1 天 | 缓存失效要跟文档版本；取消要防误杀已提交结果 |
| **S4 片段批量化/移出关键路径** | `attachSnippets` 改按文件去重 + 并行读 + 只取目标行；或默认不返回 snippet，由第二批 `lsp.snippets` 或客户端已有 buffer 补齐 | 热态省几十 ms；大文件场景更明显 | 0.5 天 | API 形状变更需同步客户端 |
| **S5 gopls 调参** | 每工作区配置 `build.directoryFilters` 裁剪无关服务；可选 `-remote=auto` 共享 daemon | 直接缩短 R1/R3 的 9–22s（幅度待实测） | 1–2 天 | 需要按仓配置；daemon 与多 root 兼容性、版本支持需验证 |
| **S6 自建引用索引** | JetBrains 式预索引 | 毫秒级 | 数周 | 与 gopls 重复、维护成本高、语义容易错 |
| **S7 客户端结果缓存 + 预取** | 光标停留时 prefetch definition/references（防抖 300ms），结果缓存复用 | 热路径再降 | 0.5 天 | 预取过多反而抢 gopls；要限流 |

## 5. 推荐：S1 + S2 + S4 先做，S3 跟上，S5 按仓可选，S6 否决

### P0（0.5–1 天）"让 22 秒消失，而不是变快"

1. **S1 预热**：Code 标签首次挂载时调 `lsp.warmup {cwd, path}`（内部 `ensureStarted()` + 对当前文件发一次 `hover`，触发工作区加载），状态栏显示"gopls 正在加载工作区"。`lspIdleMs` 默认 300000 → **1800000**，并在 `docs/settings.md` 说明；Config 加 `lspWarmupOnOpen`（默认 true）。
2. **S2 进度**：peek/overlay busy 期间轮询 `lsp.status`（800ms，结束即停），标题区显示 `status.progress`（gopls 的 `$/progress` 已被 `progressLine()` 采集）；先渲染"文件分组 + 行号"骨架。
3. **S4 片段**：`attachSnippets` 按文件去重、并行读、只保留目标行（实测 86→49 ms、67→29 ms）；条目仍限 60。可顺手把 snippet 改为可选参数（`snippets:false` 时客户端用已打开 buffer 的行，缺的再补）。

> 验收：打开一个引用多的文件后 2s 内 Network 出现 `lsp.warmup`；用户按 ⇧F12 时多数命中已热进程（热态 0.1–1.2 s，缓存上线后重复查询降到 100 ms 内）；冷态也能看到进度而不是纯转圈；同会话 30 分钟后再查不再重建进程。

### P1（0.5–1 天）"同一符号不该查两遍"

4. **S3 缓存/单飞/取消**：缓存键 `root + uri + line + col + kind + document mtime`，TTL 30s，有界（如 64 条）；同键 in-flight 合并；`api(route, body, {signal})` 透传 AbortController，Host 在 `req close` 时向 gopls 发 `$/cancelRequest`。顺带把 definition+references 并行请求合并为一次 host 调用（Host 内部并发，减少一次 HTTP 往返）。
5. **S7 预取**（可选）：光标在同一标识符上停留 300ms 时后台预取 definition，命中缓存后 F12 瞬时。

> 验收：30s 内重复 ⇧F12 <50ms 且无 LSP 请求；快速连续移动光标后 `pending` 数不增长；关闭面板后请求被取消。

### P2（1–2 天，按仓可选）"大仓专项"

6. **S5 gopls 裁剪/共享**：提供每工作区配置（如 `.dsh/lsp.json` 或插件 Config 的 `goplsArgs`）给 `directoryFilters`；验证 `-remote=auto` 在本机 gopls 版本是否可用，可用则做成开关。这一步对 vas5 这类单仓多服务收益最大，但要按仓调，不能默认开。

**否决 S6**：右栏插件自建 Go 索引等于重写 gopls，语义与增量维护都不可控。

## 6. 工程影响与改动点（预估）

| 位置 | 改动 |
|---|---|
| `lib/host/lsp.js` | `warm()`；请求级 AbortSignal 与 `$/cancelRequest`；结果缓存与单飞；`attachSnippets` 批量化 |
| `lib/host/routes.js` | `lsp.warmup`；`lsp.request` 增加 `{snippets, timeoutMs}` 选项；`req.on("close")` 取消 |
| `lib/host/constants.js` | `LSP_IDLE_MS` 默认 1800000；`LSP_WARM_*` 上限 |
| `index.js`（Config） | `lspWarmupOnOpen`、`lspIdleMs` 默认调整 |
| `src/client/code.js` | 标签挂载预热；busy 轮询状态；骨架渲染；缓存命中提示 |
| `src/client/api.js` | `fetch(..., { signal })` |
| 测试 | `test-host.mjs`：warmup 路由、取消、缓存命中/失效；`test-client.mjs`：busy 状态轮询、骨架、缓存渲染 |

## 7. 风险与回滚

- **内存**：常驻 gopls 在大仓可达数百 MB。用 `lspIdleMs` 配置兜底（保守用户可调回 5 分钟），状态栏常显 `gopls` 状态，必要时提供"停止语言服务"动作。
- **预热打满 CPU**：只在 Code 标签打开时预热一次；失败静默（不影响编辑）。
- **取消误伤**：只取消尚未返回的请求；已返回结果照常渲染。
- **缓存陈旧**：键里带文档 mtime；文件被外部修改时 keys 自然失效；30s TTL 兜底。
- **gopls 版本差异**：`-remote=auto`、`directoryFilters` 行为需在本机版本验证后再开。

## 8. 未验证

- `build.directoryFilters` 对 vas5 首次 references 的实际缩短幅度（需 P2 实测）。
- `-remote=auto` 在当前 gopls 版本的稳定性与多 root 行为。
- VSCode 侧的具体实现细节来自其公开机制（CancellationToken / `$/progress` / 编辑器模型复用文件内容），未逐行核对源码。

## 6. 落地状态（2026-11-25）

已实现：**S1 预热**（`lsp.warmup`，打开文件即预热；空闲淘汰 5 分钟 → 30 分钟）、**S3 结果缓存 + 单飞**
（键含文档 mtime，30 s TTL，同键 in-flight 合并）、**S4 片段并行**（按文件去重、并行读、只取目标行）、
按语言限制常驻 root 数（LRU，默认 4，工作树场景必需）、`lsp.stats` 观测（常驻数、请求/缓存命中、provision 状态）。

另外把 Trae 的做法本地化验证了一遍：Trae 用自编译 `trae-gopls v0.22.0+bd4` 走 VS Code 的
`go.alternateTools.gopls`，真正起作用的是 gopls v0.21+ 自带的**内容寻址持久 file cache**（本机
`~/Library/Caches/gopls/33f7eb11` 已 1.5 GB）；`-remote=auto` daemon 在 gopls v0.21/本机不可用
（`dial … no such file`）。因此插件采用“固定版本 + 首次使用自动安装 + 预热 + 常驻”的等价路线，
`gopls stats` 可作为后续的显式灌缓存手段。
