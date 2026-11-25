# 同一个仓库、不同会话、不同分支：可行方案调研

结论：**可以，但不是"一个检出目录里按会话切分支"——那是 Git 本身做不到的。正确形态是 `git worktree`：一个对象库、多个检出目录，每个会话落在自己的检出里。** 本插件的 Git / Code 面板与侧栏分支 chip 按**会话目录**取数，所以只要每个会话的目录不同，分支 chip、diff、提交就天然隔离。差别只在于"会话目录"取的是哪一份：本插件目前读会话列表里的 `cwd`（= 不可变的 `SessionHeader.cwd`），所以最稳的用法是**把每个 worktree 开成独立工作区**；若想"一个工作区、多个会话各自 `cd`"，需要把取数改成会话投影里的有效目录（见 §2，六处取数统一）。

## 1. 为什么"同目录按会话切分支"不成立

一个检出目录只有一份 `HEAD`、一份 index、一份工作树。`git checkout` 改的是这份共享状态，任何进程（任何 DSH 会话）看到的分支和 diff 会一起变。会话之间没有可切的"自己的分支"，只有"当前分支"。

DSH 侧的事实（0.2.2-rc.5）：

- `SessionHeader.cwd` 在创建时确定且**不可变**，工作区（workspace）用它做成员校验与分组（`dsh-workspace`，见安装目录 `docs/subsystems/workspace.zh.md`）。会话列表的 `cwd` 字段也来自它（`dsh-api-session-controller/src/list.ts:380`）。
- 会话还有一份**有效**目录：`@deepseek-ai/dsh-working-directory` 注册的 `workingDirectory` 投影，初始值就是 `header.cwd`，`working-directory/change` 事件把它改掉（`src/index.ts:105-107`）；`working_directory` 工具改的就是它，改动进日志、可回放，子进程保持自己的目录。
- 这份有效目录会随会话摘要下发到客户端（`dsh-api-session-controller/src/client/sessions/service.ts:655-659` 的 `projectionValues`，键名即投影 key；投影默认 `summary: true`，`workingDirectory` 没有声明 `summary: false`）。
- 因此：**会话可以各自 `cd` 到不同目录，同时仍归属原工作区**（header 不变）。这正是"同一仓库不同对话不同分支"的支点。

## 2. 本插件已经具备的部分

核心能力全部以会话目录为作用域：

| 位置 | 行为 |
|---|---|
| `src/client/code.js:57` | Code 面板的 `cwd` = `sessions.byId[sessionId].cwd`（会话列表的 `cwd`，即 header 值） |
| `src/client/branchchip.js:102` | 侧栏每个会话行的分支 chip，按该目录轮询 `git.branch`，4s 一次 |
| `lib/host/git.js` | 状态 / diff（working、branch、commit、compare 四种 scope）/ stage / commit / pull 全在同一个 cwd 上 |
| `src/client/usegit.js`、`branchpick.js` | fetch / pull / push / 切分支，全部带上会话目录 |

所以只要每个会话的目录落在不同 worktree，**分支 chip、diff、提交、推送、并发多个会话互不干扰**。剩下的问题只有两个：怎么把 worktree 建出来，以及让插件读到的目录已经是那个 worktree。

**要让"同一工作区里 `cd` 换 worktree"也生效，插件需要改六处取数**（现在全部读 header，`cd` 之后不会变）：

| 位置 | 影响 |
|---|---|
| `src/client/branchchip.js:105`（`sessionCwd`） | 侧栏分支 chip、会话卡片 |
| `src/client/code.js:57` | Code 面板：文件树、diff、状态、提交、LSP |
| `src/client/rpc.js:162` | gRPC proto 发现与调用 |
| `src/client/apiclient.js:85` | HTTP 调试的按工作区分作用域的草稿/历史 |
| `src/client/skills.js:242` | 技能列表的 cwd |
| `src/client/workbench.js:81` | 调试台历史 |

统一成一个取值（`projectionValues` 来自会话摘要，键名即投影 key；投影默认 `summary: true`）：

```js
const cwd = useSessions((select) => {
  const row = select?.byId?.[sessionId];
  return row?.projectionValues?.workingDirectory ?? row?.cwd;
});
```

这不是插件自创的读法：DSH 自己的消费方都读同一份投影——聊天的文件链接（`dsh-client-ui-chat/client/file-path.ts`）、工具卡片的文件菜单（`dsh-client-ui-tool/client/tool/file-menu.ts`）、技能目录（`dsh-api-session-controller/skill-catalog.ts:45`）、终端（`dsh-api-terminal-controller/index.ts:437`）都是 `workingDirectory` 优先、header 兜底。插件的六处是唯一的例外。

实时性也没有问题：`working-directory/change` 作为 projection 帧下发，客户端 `handleControlFrame` 收到后 `markDirty()`，列表快照重建时带上新的 `projectionValues`（`dsh-api-session-controller/src/client/sessions/manager.ts:624-633`、`753-768`），所以 `cd` 之后 chip、diff、文件树当场切换，不需要重载。

不改这六处、只把每个 worktree 开成独立工作区，则不需要任何代码改动。

## 3. 方案对比

| 方案 | 额外空间 | 分支隔离 | 每会话 diff | 代价 / 风险 |
|---|---|---|---|---|
| 现状：复制整个仓库 | 每份 `.git` + 工作文件 + `node_modules` | 有 | 有 | 最浪费；多份 remote/分支各自漂移 |
| 同目录 `git checkout` | 0 | **无**（HEAD 共享） | **无** | 只适合"同一时刻只有一个会话动代码" |
| **`git worktree`** | **仅工作文件**（对象库共享） | 有 | 有 | 同分支不能两处检出；未跟踪文件/依赖不共享；部分脚本假设 `.git` 是目录 |
| `git clone --shared/--reference` | 对象引用源仓库 | 有 | 有 | 源仓库 prune/gc 后副本损坏，不适合长期并行 |
| APFS `cp -c`（clonefile） | 初始近 0（块级 CoW），写入后按块复制 | 有 | 有 | 副本互相独立，refs/远程各自漂移；不适合"一份仓库多分支"的语义 |
| `jj workspace add` | 对象库共享 | 有 | 有 | 需要团队改用 Jujutsu；纯 git 流程不适用 |

推荐 worktree：它恰好是 Git 为"一个仓库多个并行检出"设计的东西，语义、`git status`、`git diff`、hook、LFS 缓存全部照旧。

## 4. 空间账（实测）

本仓库实测（2026-11-24）：

```
.git              51M     ← 对象库，worktree 之间共享，只有一份
tracked files    5.1M     ← 每份 worktree 复制这一份
node_modules      24M     ← 未跟踪，worktree 里不会自动出现
```

- 现在"复制 3 份"≈ 3 × (51 + 5.1 + 24) ≈ **240M**
- 改成 3 个 worktree ≈ 51 + 3 × (5.1 + 24) ≈ **138M**（`.git` 只留一份）
- 历史越重收益越大：`.git` 1G 的仓库，3 份复制 3G+，worktree 仍然 1G + 3×工作文件
- 依赖不是白送的：每个 worktree 要自己 `pnpm install`。好处是 pnpm 硬链到全局 store，真实新增字节远小于 `node_modules` 的 du；Rust 的 `target/`、Node 的构建缓存各自一份，这部分省不掉

`/tmp` 里的隔离实验（4 个检出、3 个分支）：

```
git count-objects -vH     → size: 17.32 MiB（4 个检出合计只有这一份）
git -C wt-b rev-parse --git-common-dir → .../src/.git        （共享）
git -C wt-b rev-parse --git-dir        → .../src/.git/worktrees/wt-b（每检出独立 HEAD/index）
git -C src worktree add ../wt-dup2 feat-b → 致命错误：'feat-b' 已经被工作区 '.../wt-b' 使用
```

## 5. 三种落地档位

### A. 手动 worktree（今天就能用，零安装）

检出目录放在**仓库同级**、命名 `<仓库名>-<分支>`（插件入口就是这么建的：`vas` + `feat/login` → `vas-feat-login`）：

```sh
git worktree add ../vas-feat-a -b feat-a        # 新分支
git worktree add ../vas-release release/2.3     # 检出已有分支
git worktree add --detach ../vas-probe <sha>    # 临时只读排查
git worktree list                               # 人看
git worktree list --porcelain                   # 机器读
git worktree remove ../vas-feat-a               # 删检出，分支保留
git worktree prune                              # 手工删过目录后清登记
```

同级目录不在仓库内，所以不需要往 `.git/info/exclude` 写规则。注意手工在会话里执行会被 DSH 的 `workspace-write` 挡（写仓库外需要提权）；插件的 Host 路由做了这条窄例外的写入，直接在菜单里建即可。

#### 新建分支 vs 接管已有分支

`git worktree add` 本身不是"新建分支"，它是"新建一个检出"；分支怎么来由参数决定：

| 写法 | 结果 |
|---|---|
| `git worktree add <dir> -b <新名> [起点]` | 新建分支（等价 `checkout -b`），起点默认 `HEAD` |
| `git worktree add <dir> <已有分支>` | 检出该已有分支，**不新建**——这就是"切到已有分支给新对话" |
| `git worktree add <dir> <commit>` | detached HEAD，只读排查用 |

硬约束：**一个分支同一时刻只能被一个检出占用**，且是全局的（主检出也算）。所以接管已有分支前先看它现在在哪：

```sh
git worktree list | grep '\[release/2.3\]'   # 有输出 = 被占用，看路径
git switch main                               # 主检出停在它上面时，先腾位置
git worktree add .agents/worktrees/rel-23 release/2.3
```

- 分支没被任何检出占用（只在 refs 里）→ 直接 add。
- 被**主检出**占用（最常见）→ 先把主检出 `switch` 到别的分支或 detach，再 add；之后想让主检出回到该分支，先 `git worktree remove` 那个检出。
- 被**别的检出**占用 → 那个检出必须先删或先挪走。
- 确实要两份 → `--detach`（HEAD 分离，可以读、可以跑，但提交不落在分支上）。

另外两点容易踩：接管分支**不带未提交改动**（脏工作区留在原检出，不会跟着分支走）；检出里的提交推进的是**同一个分支 ref**，主检出再看到时已经是新提交。本地还没有该分支时，`git worktree add <dir> -b release/2.3 origin/release/2.3` 一次建好跟踪分支。

进到检出里有两条路，按要不要改插件分：

- **每个检出开成独立工作区（零改动，最稳）**：新建会话时选该目录，`SessionHeader.cwd` 就是 worktree，插件所有面板、LSP、搜索、终端全部正确，侧栏会多出一个同名工作区（这是它在 DSH 里的真实身份）。
- **一个工作区、多个会话各自 `cd`（要改上面那六处取数）**：会话仍归在原仓库工作区下，侧栏只有一组、每个会话行显示自己的分支 chip；但插件现在读 header，不先按 §2 改成 `projectionValues.workingDirectory` 就会一直看主检出的分支和 diff。

注意：已经开着的终端/后台进程不会跟着 `cd`，需要新开或自己在里面 `cd`。

### B. 官方实验 bundle（省掉"建 + 切"）

这两个包在安装目录里就有（`0.2.2-rc.5`），只是当前 profile 没启用：

| bundle | 得到什么 |
|---|---|
| `@deepseek-ai/dsh-experimental-tool-worktree` | 模型工具 `create_worktree({name?, from?})`：从本地提交/分支建**新分支** + 检出 + 把本会话的有效 cwd 切过去；检出在 `.agents/worktrees/`；会话归档时清理干净未引用的检出、保留分支 |
| `@deepseek-ai/dsh-experimental-forge-bundle` | 上面全部 + New Session 界面的"New worktree"（先选基线分支，首条消息在检出就绪后开始）+ Changes/PR 面板 + 会话列表图标 + 归档清理 |

两条硬限制，正好对应你的场景：

- `create_worktree` **只建新分支**（默认从 `HEAD`），不能切到已有分支；要检出已有分支，用 A 里的 `git worktree add <已有分支>`。
- 从"本身就是一个 linked worktree"的目录里，forge 的 New worktree 会禁用（检出或 `.git` 在会话可写根之外）。

另外 `create_worktree` 会改当前会话的有效 cwd；要离开用 `working_directory({cd})`，检出和分支都留着。

### C. 插件里做 Worktrees 区块（产品化）

**已实现**：工作区「⋯」菜单里的 `以分支开新对话…`（`contextMenus` 的 `workspace` 目标，order 150）与 `管理工作树…`。前者在仓库同级建 `<仓库名>-<分支>` 检出后把目录注册成独立工作区（标题=分支名）、开一个空会话并打开；后者列出这些检出、支持删除（分支保留，脏检出需显式勾选丢弃），并随会话归档自动回收干净检出；多仓库父目录通过仓库选择器同样可用。

如果希望"在 kit 里一眼看到这个仓库有哪些检出、谁在哪个分支、一键删除或开新会话"，加一小块 UI 即可，数据全是现成的：

- Host：`git.worktrees`（`worktree list --porcelain`）、`git.worktreeCreate`、`git.worktreeRemove`；全部经 `lib/host/fence.js` 校验目标路径，写操作沿用原子写与 `baseMtime` 冲突检测；错误走 `sendOk` / `sendError`，路由登记进 `lib/host/routes.js` 并在 `test-host.mjs` 补断言。
- Client：Code 面板 Git 区加一节，列出 `path / branch / HEAD / bare / locked`，未在当前会话的检出给"在新会话打开"或"切到该检出"两个动作。
- 不需要重写 diff：每个会话已经在自己的检出上，diff 自动隔离。

**`worktreeCreate` 必须有两个模式**，因为"开始一个新工作"和"接管已有分支"是两件事：

| 模式 | 入参 | 行为 |
|---|---|---|
| 新建 | `branch` + `base` | `git worktree add <dir> -b <branch> <base>` |
| 接管 | `branch`（只给名字） | `git worktree add <dir> <branch>`；分支被占用时返回可操作错误，而不是失败 |

接管模式要先把占用情况说清楚：谁占着（主检出 / 哪个 worktree），并给"把主检出切到 main 后再试"的动作。原生 `create_worktree` 只覆盖"新建"，所以"接管已有分支"是 kit 面板相对官方的增量价值，也是这类需求最容易卡住的地方。

## 6. 坑清单

1. **同一分支不能在两个 worktree 同时检出**（实测 `git worktree add` 直接报错）。确实要两处同分支，用 `--detach`。
2. **未跟踪文件不共享**：`.env`、`node_modules`、构建产物、本地配置在每个检出里都要各来一份；`.git/info/exclude` 里的规则共享。
3. **`.git` 在 worktree 里是文件不是目录**：写死 `<repo>/.git/...` 的脚本、部分 IDE 插件、某些 hook 会踩坑。
4. **submodule 不会自动初始化**，每个检出各自 `git submodule update --init`。
5. **嵌套 worktree 不可取**：检出里再建检出，路径和登记都会很脆；forge 也直接禁用。
6. **分支被删/改名后**，对应检出的 HEAD 变脏，`git worktree list` 仍会显示，需要手动处理或 `prune`。
7. **手动删目录不会清登记**，必须 `git worktree prune`；反过来 `git worktree remove` 会拒绝有未提交改动或锁定的检出。
8. **归档清理只有 forge 提供**；手动/工具档位需要自己写清理策略（一般 `git worktree remove` + 保留分支即可）。
9. **端口/锁/缓存冲突**：同机多个检定跑 dev server、测试库、watch 进程时会抢端口和缓存目录，这跟复制仓库时一样，不因 worktree 变小。

## 7. 建议

1. **先按 A 试一个仓库**：建两个检出，各自开成工作区，两个会话同时改，确认分支 chip 与 diff 按会话隔离、互不干扰。
2. 如果更想要"一个工作区、多会话多分支"的形态，先落 §2 那六处取数改动（`projectionValues.workingDirectory` 优先），再用 `working_directory` 切检出。
3. 日常"开新分支干活"的会话，用 B 的 `tool-worktree`（或 forge）省掉手敲两条命令。
4. 若团队会频繁切已有分支、需要一眼看清所有检出，再投入 C，把 worktree 管理收进 kit。

验证方式：本调研的结论来自本机实测（`git 2.49.0`）、安装目录里的 `dsh-experimental-worktree` / `dsh-experimental-tool-worktree` / `dsh-experimental-client-ui-forge` 的 README 与 `docs/config-catalog.zh.md`，以及本仓库按会话 cwd 取数的源码位置（上表）。

## 8. 开发完成后的能力评估

判断标准是用户的原话："同一个仓库，不同对话切不同分支，各自看自己的 diff，不再复制几份仓库。"

**能实现，但"六处取数"只解决"看得对"，不解决"有分支可用"。** 完整的闭环是三件事，缺一件体验都回不到能删复制品的程度：

| 环节 | 由谁负责 | 现状 |
|---|---|---|
| 建：给一个对话准备一个检出 | 工作区菜单「以分支开新对话…」/ 官方 forge bundle / 模型 `create_worktree` | **已做**（新建/已有分支；含列表、删除、归档回收、多仓库） |
| 进：该对话的目录切到检出 | `working_directory` 工具（`cd`）或开成独立工作区 | 原生已有 |
| 看：面板按该目录显示分支与 diff | 本插件六处取数 | 未做；改完即与原生面板一致 |

逐条核对能力边界：

**会成立**

- 一个仓库、N 个对话，每个对话在自己的检出上，`branch chip` / Code 面板 / diff（working、branch、commit、compare 四种 scope）/ stage / commit / push 全部只作用于该检出。
- 在某个检出里 `git checkout` 别的分支，只影响那个对话——因为 HEAD/index 是每检出独立的。
- 会话仍归在原仓库工作区下（header 不变），侧栏不会碎成 N 个同名工作区（若选独立工作区方案则会，两者都可用）。
- 检出目录被删或丢失时，会话自动回落到原项目，不会卡死。
- 并发写不同分支互不冲突；`git status` 用 `.git/info/exclude` 保持干净。

**不会成立（方案边界，不是实现缺陷）**

- 同一个分支上两个对话各自有未提交改动：Git 不允许同一分支两处检出（要就 `--detach`，但那不是"同一个分支"）。
- 不 `cd`、不开独立工作区的对话仍然共享主检出的 HEAD：只要还有人在主检出上改，隔离就破了。习惯上应把主检出当"只读门厅"。
- `.env`、`node_modules`、构建产物、开发服务器端口在各检出之间不共享：每份要自己装、自己起，端口也要错开。
- 检出目录在仓库同级（`<仓库名>-<分支>`）：手工在会话里建会被 `workspace-write` 挡，插件入口由 Host 生成并经校验后写入（围栏的窄例外）；`cd`/开成工作区后可写根切换为该检出，主仓库反而写不进去（这算优点）。
- **同名分支只有一份 ref**：现在几份复制仓库里各自演化过的"同一个" `feature/x`，没法原样搬进 worktree 世界；迁移时要么改名（`feature/x-a`、`feature/x-b`），要么先把差异提交再合并。

**验收方式**（做完就该能跑）

1. 两个 worktree 各开一个会话，同一文件在两处改成不同内容，两只 Code 面板的 diff 互不串台，`git status` 各报各的。
2. 会话 A `cd` 到 worktree-a、会话 B 留在主检出，A 的分支 chip 立刻变（不等重载），B 仍是主分支。
3. 在 A 里提交、push，B 的分支不受影响；`git worktree list` 与面板列表一致。
4. 删掉 A 的检出目录，A 的会话自动退回主检出且不报错。

结论：**技术路径没有未解的死结，剩下的都是产品决定**——"建"的入口放在 kit 还是交给官方 forge bundle、以及是否接受"一个对话 = 一个检出 = 一个分支"这条纪律。先落六处取数（立刻可验证），再定"建"的归属，就可以开始退役那几份复制的仓库了。
