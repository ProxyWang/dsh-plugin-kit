# Host contracts

本文件是 `dsh-plugin-kit` Host 半边对内的契约。条目编号保持稳定（代码与测试引用"§N"），改契约必须同批改本文件。

## §1 入口与路由

- 一个 prefix 路由：`/code-explorer/api`（`lib/host/constants.js` 的 `API_PREFIX`，客户端 `src/client/constants.js` 的 `API` 必须一致，`check-contract` 守护）。
- 路由表三个所有者：`lib/host/routes.js`、`lib/host/db.js` 的 `dbRoutes`、以及 `index.js` 里的两个存储端点 `browser.data` / `vault`。
- 未登记的路由回 `404 not-found`；前缀下只接受 POST，其它方法回 `405 method-error`。

## §2 响应信封

成功：

```json
{ "ok": true, "value": <any> }
```

失败：

```json
{ "ok": false, "error": "human readable", "code": "conflict", "meta": { } }
```

- `error` 是历史字段，保留给旧客户端；`code` 是稳定机器码，调用方按它分支。
- 路由内部的"业务性失败"（如 `git.status` 不是仓库、`lsp.status` 未启动）仍以 `value.error` 成功返回，这是既有路由表语义；**抛异常**只用于调用方错误或宿主错误，由统一出口映射。

## §3 错误码与 HTTP 状态

| code | HTTP | 含义 |
|---|---|---|
| `bad-request` | 400 | 参数缺失/类型错/JSON 解析失败/不是普通文件 |
| `forbidden` | 403 | 调用方被拒、路径逃出围栏、写 symlink |
| `not-found` | 404 | 未知路由、路径不存在 |
| `method-error` | 405 | 非 POST |
| `conflict` | 409 | `baseMtime` 过期、目标已存在 |
| `too-large` | 413 | 请求体或写入内容超限 |
| `unavailable` | 503 | 当前 profile 缺能力（browser storage、vault、LSP 未就绪） |
| `internal` | 500 | 未预期异常（bug、依赖异常），消息原样回传 |

errno 映射：`ENOENT/ENOTDIR→not-found`、`EEXIST/ENOTEMPTY→conflict`、`EACCES/EPERM→forbidden`、`EINVAL/EISDIR/ENAMETOOLONG→bad-request`。

## §4 调用方准入

- 每个请求先问 Host 的 `connection.requestRejection(req)`；服务接受即放行（面板带着浏览器会话，走这条路）。
- 服务拒绝时区分调用方形状：
  - **浏览器形状**（带 `Origin` / `Sec-Fetch-Site` / `Cookie` 任一）→ `403 forbidden`，完全交给 Host 策略；这是 DNS rebinding 与跨站 confused-deputy 的防线。
  - **本地 CLI 形状**（三者都没有）且 Host 是 loopback → 放行。这是文档化的 `curl` 工作流（技能 `dsh-code-explorer` 依赖它），本机进程本来就有同样的文件权限，不构成新增边界。
- 该服务缺失时（旧宿主、测试 harness）退化为 loopback Host 头校验；无 Host 头（非浏览器调用）放行。不得因为服务缺失而完全放开。
- 不要从启动参数或复制的信任列表推断准入策略。

## §5 路径围栏

- 所有 Host 侧路径解析经 `lib/host/fence.js`：`realpath(cwd)` 为根做词法 containment；`..` 逃逸、逃出围栏的 symlink 一律拒绝；写入拒绝任何 symlink（即使解析后仍在围栏内）。
- 读路径额外允许"兄弟仓库 + Go 工具链根"（`extraReadRoots`），但这些根不提供隐藏（点开头）路径，且**写入永不使用额外根**。
- `cwd` 必须是绝对路径的工作区根；路由把相对 `path` 解析到 `cwd` 下。

## §6 写入语义

- 只写已存在的普通文件；创建走 `fs.create`，重命名走 `fs.rename`，删除走 `fs.delete`，都过同一套围栏。
- 写入是原子的：同目录临时文件（`.` 开头）→ 继承目标 mode → 二次校验 `baseMtime` → `rename` 覆盖；失败清理临时文件。
- `baseMtime`（编辑器加载时的 mtimeMs）不匹配回 `409 conflict`，绝不覆盖磁盘上更新的编辑；不带 `baseMtime` 的写入是显式"盲写"，仅限内部/API 客户端使用。

## §7 可选能力

`webServer` 是唯一必需服务；`storageDomain`（browser/vault）、`skills`（技能注册表）、`connection`、`tools`（模型工具）均按需 `ctx.inject`，缺失时相关路由回 `503 unavailable` 或返回空集合，import 阶段不得因此崩溃。

## §8 资源生命周期

- 所有注册都包在 `ctx.effect` 里并返回清理：路由、LSP 进程、watch hub、任务子进程、流、DB 连接。
- 插件卸载时按注册逆序清理；`servers.clear()`、`stopAllWatchers()`、`stopAllTasks()`、`stopAllStreams()` 必须幂等。

## §9 上限

`BODY_CAP 1 MiB`、`READ_CAP 4 MiB`、`WRITE_CAP 8 MiB`、`DIFF_CAP 2 MiB`、`LIST_CAP 4000`、LSP 首次 90s / 常规 30s（`lib/host/constants.js`）。改上限要同步本文件与 `docs/` 说明。

## §10 测试与守护

- `scripts/check-manifest.mjs`：`exports`/`files` 指向的文件存在、patch 名称与 id 正确、patch 的 config 键在 `Config` 里、client bundle 注册了包名模块 id、zh/en 词典键一致。
- `scripts/check-contract.mjs`：前缀两半一致、路由键唯一且命名空间化、`ApiError` 码都已声明、API 走 `sendOk/sendError`。
- `test-host.mjs` 覆盖每条路由与错误码路径；`tests with no mention` 会在 `check-contract` 里以警告列名。
- 全部门禁：`pnpm check && pnpm test`。

## §11 版本与兼容

- 宿主版本基线：DSH 0.2.2-rc.5（`package.json` 的 `dsh.client` 与 CI 钉住）。
- 行为变更（错误码、信封、路由增删）视为契约变更：同批更新本文件、`CHANGELOG.md` 与相关测试。
- 客户端与 Host 同包发布，但 HMR 期间可能短暂新旧混跑；客户端遇到未知 `code` 应回退到展示 `error` 字符串。
