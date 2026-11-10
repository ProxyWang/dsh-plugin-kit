# dsh-plugin-kit

[English](README.en.md) | 简体中文

DeepSeek Harness（DSH）右侧边栏的综合开发工具箱插件。一个 bundle 提供三个顶层标签页 + 一个分组启动器：

## 功能

- **代码（Code）**
  - 工作区文件树：懒加载展开、快速打开（⌘P）、全文搜索（⇧⌘F，ripgrep，**正则 / 全词开关、多 glob 过滤（`!` 前缀排除）、结果按文件分组折叠、匹配文本高亮、▸ 展开上下文 ±3 行**）、**新建文件/文件夹、重命名、删除、📋 复制路径（⌥ 复制相对路径）**（悬停操作 + 两步确认）
  - VSCode 风格编辑器：虚拟滚动、**Go/TS/JS/Python/JSON/YAML/Shell/TOML/Rust/Java/C/SQL/CSS 语法着色**、**LSP 跳转定义/引用/实现/悬停（Go：gopls；TS/JS：typescript-language-server；Python：pyright/pylsp，装了哪个用哪个）**、前进后退栈、**✎ 编辑 + ⌘S 保存（磁盘外部修改时拒绝盲写）**、⌘F 文件内查找、**↩ 自动换行（⌥Z）**、**⌘G 跳转到行（Ln/Col 徽标可点击）**
  - **图片预览**：png/jpg/gif/webp/avif/bmp/ico 以 base64 dataURL 渲染（10 MiB 上限），棋盘格衬底 + mime/大小信息
  - **B 行追溯（blame）**：作者 · 相对时间列，点击跳提交 diff
  - Git 变更：VSCode 风格可折叠树（目录计数、状态字母、缩进参考线、重名消歧）、**树状/平铺切换**、单文件/目录**回退变更**（两步确认）；**打开任何有未提交变更的文件自动显示装订线标记**
  - **Git 提交闭环**：暂存（+/目录级）、取消暂存（−）、**暂存区/工作区分区展示**、提交框（Enter 提交；无暂存时显式「全部暂存并提交」；**amend 修补开关**）、**push（无上游自动 publish -u，绝不 force）**
  - 变更查看：**整文件 + 变更行标注**（绿底 + 左边条 + 删除行折叠红条 + 右侧变更导轨光斑点击跳转）；hunk 视图支持 **▥ 并排（side-by-side）/ ≡ 统一切换**、**词级行内高亮**、**↑↓ 变更导航**
  - 分支切换器：点分支 chip 弹出可搜索面板（本地/远程分组、fetch/pull ff-only/push）
  - Markdown / HTML / **SVG** 文件**默认渲染预览**，可切原始态
- **技能（Skills）**：已安装 agent skills 的浏览/编辑/新建/删除（SKILL.md 预览 + ⌘S 保存），含只读内置组；写入严格围栏在 skill 根目录内
- **接口（API）**：基础 Postman——curl 一键导入（**-F 解析为 multipart 字段**）与 **⧉ 一键导出 curl**、**环境变量 `{{var}}`（发送时替换 URL/头/体）**、方法/URL/Headers/Body（form-urlencoded / **multipart** / raw + JSON 格式化）编辑、Host 代理发送（无 CORS 问题）、状态/耗时/大小/响应头/JSON 美化展示、**请求历史（自动记录最近 30 条，一键回填）**、**命名收藏**
- **开始页启动器**：通过官方 chain 插槽把右侧边栏选择器重排为分组紧凑列表（代码与文件 / 终端与网页 / Agent 扩展 / 更多）
- 聊天内 edit/write 工具调用渲染为紧凑行，点击在侧栏打开该次调用的 diff

## 安装

DSH profile 内 link 安装（开发态）：

```sh
dsh plugin add /abs/path/to/dsh-plugin-kit   # 或插件管理器 install_bundle
```

从 git 安装：

```sh
git clone https://gitee.com/wang-jun-07/dsh-plugin-kit.git
# 插件管理器安装该目录
```

LSP 跳转按语言需要对应 server 在 Host 的 PATH（或常见全局 bin 目录）：Go 用 `gopls`，TS/JS 用 `typescript-language-server`，Python 用 `pyright-langserver` 或 `pylsp`。未安装时优雅降级（状态点提示，不影响其他功能）。

## 开发

```sh
pnpm install
pnpm run build   # src/client/** -> client.js（DSH 客户端模块格式）
pnpm test        # host 路由 + client 纯逻辑 + bundle 形状，6 个套件（gopls 缺失时 LSP 用例自动跳过）
```

CI：`.github/workflows/ci.yml`（Node 20 + pnpm + gopls，push/PR 触发）。

Host 路由前缀 `/code-explorer/api`：`fs.list fs.read fs.write fs.create fs.rename fs.delete git.status git.diff git.fetch git.pull git.push git.stage git.unstage git.commit git.discard git.branches git.checkout git.blame lsp.request lsp.diagnostics lsp.status search.files search.text skills.list skills.read skills.write skills.create skills.delete api.send`。所有文件类路由围栏在会话工作区内（读额外放行兄弟目录与 Go 工具链根以供跨仓跳转；写严格限工作区，且支持 `baseMtime` 乐观并发守卫——磁盘外部修改后拒绝盲写）；git 索引类路由的路径按**仓库根**解析并双重围栏，支持多仓工作区与已删除文件。

## 许可

MIT © 2026 wang-jun-07
