# DSH compatibility

本插件是 DSH 的 **bundle**（`package.json` 的 `dsh.bundle.patch` 挂载插件行），Host 与 Client 两半都依赖宿主包的接口。

## 支持矩阵

| 插件版本 | DSH 版本 | 状态 |
|---|---|---|
| 2.4.x | 0.2.2-rc.5 | **当前验证版本**（本仓库 CI 与本地全量套件） |
| 2.4.x | 0.2.2-rc.1 | 未验证：`dsh-plugin --profile web add` 的 CLI 安装版本是 rc.1，客户端 slot/服务面可能有差异 |
| < 2.4.0 | < 0.2.2-rc.1 | 不支持 |

判定依据不是 `package.json` 的 `peerDependencies` 声明（本包不声明 DSH peer），而是：
1. 客户端 `dsh.client.inject` 列出的宿主客户端包必须存在（`sidebar-right`、`sidebar-browser`、`sidebar`、`layout`、`shortcuts`、`workspace`）；
2. Host 侧依赖的 `webServer`、`storageDomain`、`skills`、`connection`、`webTerminals` 服务按存在性降级（`docs/host-contracts.md` §7）。

## 降级规则

| 缺失能力 | 行为 |
|---|---|
| `webTerminals` | 不注册内置终端页签，其余功能不受影响 |
| `storageDomain` | 浏览器收藏/接口密钥退回内存态并提示，不崩溃 |
| `skills` | 技能管理页只列文件系统技能 |
| `connection` | API 准入退回 loopback Host 校验（§4） |
| `sidebarRight`/`slots` | 页签不注册，插件其余部分仍可激活 |

## 抬 DSH 基线（每升一次宿主版本执行）

1. 读宿主 Release Notes，确认上述客户端包与服务没有改名/改签名；
2. `pnpm check && pnpm test` 全绿（守护脚本会抓 manifest/契约漂移）；
3. `pnpm smoke` 真机挂载冒烟（打包 → 临时 profile 安装 → 组合出插件行）；
4. 更新本矩阵、`CHANGELOG.md`、`package.json` 的 `dsh.client.inject`；
5. 在 setting 页手动确认插件行、页签与设置表单。

## 与宿主的契约边界

- 只使用宿主公开的服务与 slot（见 `docs/host-contracts.md`）；不 import 宿主内部路径，不复制宿主的鉴权/信任列表。
- 客户端与 Host 同包发布；HMR 期间可能短暂新旧混跑，客户端遇到未知错误码时回退展示 `error` 字符串（§3）。
