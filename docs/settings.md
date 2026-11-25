# Settings

本插件的配置来自 `index.js` 导出的 `Config`（zod schema），由 Host 的 Loader 在激活时校验，非 volatile 字段改动需要重载插件。

## 字段

| 字段 | 默认值 | 作用 |
|---|---|---|
| `formatOnSave` | `true` | 保存时用语言服务器格式化 Go/TS/JS/Python |
| `liveRefresh` | `true` | 监听工作区，实时刷新编辑器、文件树与 Git 状态 |
| `lspIdleMs` | `1800000` | 空闲多久关闭 LSP 进程（毫秒，默认 30 分钟；打开文件会预热服务器） |
| `lspMaxServers` | `4` | 每种语言最多常驻几个 workspace root（工作树会成倍增加 root，超出按最久未用淘汰） |
| `goplsCommand` | 空 | 指定 Go 语言服务器（绝对路径）；空 = 插件缓存里自动安装的 gopls → PATH/GOBIN/GOPATH |
| `provisionLanguageServers` | `true` | 首次打开 Go 文件时把 gopls 安装进 `$DSH_HOME/cache/dsh-plugin-kit/gopls/<version>/`（需要本机 Go 工具链） |
| `apiTimeoutMs` | `30000` | 接口调试默认超时（1000–120000 毫秒） |
| `collectionDir` | `""` | 工作区相对的 `.bru` 集合目录 |
| `terminalApp` | `""` | 外部终端应用（macOS 应用名；空字符串在打开时探测 iTerm/Terminal） |
| `dbDefaultDriver` | `"sqlite"` | 新建数据库连接的默认驱动 |

## 在哪里改

DSH 设置 → 插件 → `dsh-plugin-kit` 行。值的持久化由宿主 `dsh-config-editor` 负责：写入 profile 的 patch 层（`cordis.patch.yml` 的插件行 `config`），下次激活时由 Loader 合并并校验。插件本身不写 profile，也不自建设置存储。

## 决策记录（A5）

- **不自绘设置页。** 字段只有 7 个，宿主插件行的表单/编辑器已经覆盖读写与校验；自绘 `settings.section` 要复制一套 UI、再自建写路径与冲突处理，收益不足。
- **保留卡片式分区作为可选后续**：当设置项超过 ~12 个或需要按功能分组时再评估，届时用声明式 inventory（从 `Config` 生成行）+ 插件自己的 fenced 路由写值，避免直连宿主 settings RPC。
- **默认值偏保守**：`liveRefresh` 与 `formatOnSave` 默认开（多数人需要），会动用户文件或起外部进程的项（`terminalApp`）默认空并按需探测。
- **语言服务开箱可用**：TypeScript/JavaScript（`typescript-language-server`）与 Python（`pyright`）作为插件依赖随包安装；Go 的 `gopls` 在首次使用时安装到插件缓存（`provisionLanguageServers`），不污染全局环境。

## 验证

- 自动化：`Config` 由 `index.js` 单测/加载测试覆盖（`test-host.mjs` 的插件激活路径）。
- 手工：设置页把 `liveRefresh` 关掉 → 面板不再发起 `watch.poll`；改 `apiTimeoutMs` 后新请求生效。
- 未验证：设置页的渲染形态（CLI 侧无法观察 GUI）；以「设置 → 插件」实际打开为准。
