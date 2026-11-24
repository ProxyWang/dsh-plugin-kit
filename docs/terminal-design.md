# 插件终端增强方案：功能、性能与实施路线

> 文档状态：设计稿（本文件只做方案，不修改终端实现）  
> 代码基线：`dsh-plugin-kit` 2.4.0，仓库提交 `5a5dafd`（2026-11-23）  
> 参考实现：`herdrdev/herdr` 0.9.5，提交 `e8d7d9705a7a2c89cef4dd42079379f05685af87`（Apache-2.0）  
> 参考代码位置：`/Users/proxy/orca/herdr`（GitHub：<https://github.com/herdrdev/herdr>）  
> 方案范围：插件自带终端（`src/client/vt/` 与 `src/client/termtab.js`），不包含 DSH 自带终端、系统终端入口和浏览器工具。
> 实现状态（2026-11-24）：P0 已落地；P1 的搜索、滚动条、OSC 8 链接、大粘贴分片、copy mode、BEL/OSC 9/777 通知、OSC 133/633 shell 集成、系统通知回退、明暗 ANSI 调色板与屏幕阅读器镜像已落地；解析时间片、500×200 DOM 实测和 P3 项仍在路线中。实现记录见文末 §13。

---

## 0. 结论摘要

插件终端已经跨过“能跑 shell 和全屏 TUI”的门槛：自有 VT 模拟器、行级重绘、中文/emoji 双格、鼠标上报、选择复制都可用。但它目前更像“会话期间可用的终端”，还达不到 herdr 那种“可以长期驻留、随时回看、搜索、复制、恢复”的开发终端体验。差距不在协议覆盖面本身，而在四个底座：

1. **屏幕数据没有稳定的行身份，也没有真正的增量 damage**。滚动用 `Array.shift()`，每次滚屏都改所有行版本，滚动成本随回滚深度线性增长。
2. **渲染与输出帧绑在 React 渲染上**。每个 output frame 都触发一次组件 render，隐藏页签也重绘；滚动时整屏重画，而不是移动行。
3. **交互状态没有独立模型**。用户向上翻页后，下一帧输出会把 `offset` 重置到底部；选择用绝对行号记录，回滚淘汰后会指向错误内容；没有搜索、复制模式、滚动条。
4. **缺少终端协议里影响真实体验的那一层**：同步输出（DECSET 2026）、焦点上报、OSC 8 链接、OSC 133/633 shell 集成、DECSCUSR 的闪烁位、IRM 插入模式、emoji 字素簇宽度、大粘贴分片。

本方案借鉴 herdr 的以下设计，而不是照搬它的服务端架构：

- **状态与运行时分离**：终端状态可独立测试，渲染只读状态；
- **damage/delta 驱动**：只发送、只绘制变化的区域，滚动作为“位移”而不是“重画”；
- **滚动与选择稳定**：选择、搜索、滚动锚点绑定稳定行身份，输出继续时不被踢走；
- **字节上限 + 可恢复历史**：回滚有明确内存预算，历史恢复默认关闭以保护敏感输出；
- **键盘与鼠标都是一等公民**：鼠标可选、Shift 是选择逃生口，复制模式提供纯键盘路径；
- **增量帧与同步输出**：一帧内合并重绘，用 `?2026` 包住中间态。

分四阶段落地：

| 阶段 | 目标 | 主要交付 | 预估 |
| --- | --- | --- | --- |
| P0 | 正确性与性能底座 | 行身份 + 环形回滚、damage/滚动位移、重排（reflow）、滚动锚点、React 解耦、隐藏页签不绘制、大粘贴分片、光标/IRM/2026 修正 | 3–4 人日 |
| P1 | 日常可用性 | 滚动条、搜索、复制模式、选择模型、右键菜单、OSC 8 链接、通知 | 5–7 人日 |
| P2 | 长期使用质量 | shell 集成标记、主题/字体/无障碍、内存压缩、性能 HUD、测试基线 | 4–6 人日 |
| P3 | 可选扩展 | 分屏工作区、可选历史持久化、Kitty 键盘子集/更完整的协议覆盖 | 研究后再定 |

P0–P2 不修改 DSH 宿主契约；只使用现有 `webTerminals` 的 `snapshot` / `output` / `state` / `ack` 通道。P3 中涉及 DSH 上游能力的部分单独列为“可选上游协作”，不作为本方案依赖。

---

## 1. 背景、边界与约束

### 1.1 现在谁拥有什么

| 层 | 归属 | 关键实现 | 生命周期 |
| --- | --- | --- | --- |
| PTY、进程、shell | DSH `terminalController` | `BrowserTerminal`、subprocess provider | 页签存在 + Host window hold；关闭页签才结束 |
| 无头屏幕、重连快照 | DSH | `@xterm/headless` + `SerializeAddon` | 与 PTY 同寿命 |
| 输出/输入通道 | DSH | `snapshot` / `output` / `state` / `ack` 帧，输入 `write` / `resize` | 每次 attach 一条流；输入独占 |
| 页签与进程持有 | 插件 | [`termtab.js`](../src/client/termtab.js) 注册 `kit-terminal` 类型，`retainTabs` 同时持有两种 kind | 页签关闭时释放 |
| 屏幕模拟、绘制、输入编码 | 插件 | [`src/client/vt/`](../src/client/vt/) | 与 tab body 的 DOM 生命周期一致，`keepMounted` 避免切页签重建 |

这个边界是正确的：PTY 和权限留在 DSH，插件只拥有“屏幕和交互”。herdr 的 server/client 分离也是同一方向，但 herdr 把终端运行时也放在自己的 server 里；插件不需要、也不应该复制这一层。

### 1.2 宿主契约的关键数值

以下是 DSH `terminal-controller` 的默认配置（部署可通过配置覆盖，插件必须以 `TerminalEnvironment` 返回值与实际帧为准）：

| 项 | 默认值 | 对插件的影响 |
| --- | --- | --- |
| `maxTerminals` | 8 / Session | 分屏/多终端上限，P3 分屏设计必须计入 |
| `maxCols` / `maxRows` | 500 / 200 | 最坏可见网格 100,000 格，必须按此设计帧预算 |
| `scrollback` | 1000 行 | Host 快照与插件回滚的上限；插件不能假设更多 |
| `maxBufferedBytes` | 2 MiB | 同时约束单个 output follower 的排队和未确认输入；解析慢或输入积压会被断开 |
| `maxInputBytes` | 64 KiB | 单条输入命令上限；大粘贴必须分片 |
| 快照内容 | `SerializeAddon.serialize()` 默认序列化 normal buffer 的全部行，并按需附加 alternate buffer | 重连时能带回 Host 侧回滚；但大屏 + 长回滚会产生大帧，插件要有字节预算和降级 |

`output` 帧是原始 PTY 字节，不是语义化的行 delta；`snapshot` 是完整基线。插件在 attach 时先清空屏幕再重放快照，之后按顺序追加输出。输入只有在该 attach 是 controller 时才可写，`ack` 是唯一的流控反馈。

### 1.3 目标

- **长时间可用**：连续运行数小时、输出数万行后，翻页、搜索、复制仍然即时。
- **不丢内容**：宽度变化不丢右侧内容；输出滚动不踢走用户的回滚位置；大粘贴不把终端打成只读。
- **可发现**：滚动条、搜索框、链接、右键菜单、快捷键提示符合桌面终端习惯。
- **可访问**：键盘可完成全部关键操作；屏幕阅读器能读到当前屏与状态变化；明暗主题都有足够对比度。
- **可测量**：有固定几何的基准和 CI 门槛，性能退化能被发现。
- **不越界**：不接管 PTY、不绕过 DSH 的权限与配额、不默认持久化可能含密钥的屏幕内容。

### 1.4 非目标

- 不实现 herdr 的常驻 server、跨客户端 detach/reattach、多机聚合；这些由 DSH 的进程与 hold 模型决定。
- 不实现 Kitty graphics / Sixel / 图片协议。宿主 headless xterm 和快照都不保证图像可重放，DOM 渲染也不是合适的图像通道。
- 不做基于进程树的 Agent 生命周期判定。插件拿不到 DSH 的 foreground process 信息；最多做 OSC 133/标题/静默期的“活动提示”，且必须标注为提示而非权威状态。
- 不在 P0–P2 改变 DSH 的协议、配置或服务端代码。

---

## 2. herdr 研究与可借鉴点

### 2.1 herdr 是什么

herdr 是一个 Rust 编写的终端工作区管理器（“the runtime your coding agents live on”）：一个后台 server 拥有 PTY 与终端状态，一个或多个 client 负责绘制；支持 workspace / tab / pane、detach 后进程继续运行、agent 状态（working / blocked / done / idle）、鼠标与键盘双路径、copy mode、插件、CLI/socket API。终端核心使用 vendored `libghostty-vt` 与 `portable-pty`。

它的关键不是“功能多”，而是把几个成本很高的路径做成了结构：

- **状态与运行时分离**：`AppState` 是纯数据，`PaneState` 与 `PaneRuntime` 分离，`render()` 只读状态；
- **渲染是纯函数**：`compute_view()` 负责几何与变更，渲染阶段不改状态；
- **性能是乘法路径**：render / layout 循环按 pane 数、tab 数、client 数放大，禁止在热路径里做格式化、进程树、文件 I/O 和聚合；
- **隐藏 pane 仍解析，但不做展示工作**；
- **frame 合并与增量**：`RenderSignal` 合并请求，surface delta / scroll codec 只发送变化行，ANSI blit 只写变化 cell；
- **同步输出**：把一帧包在 `CSI ? 2026 h/l` 里，避免中间光标和半帧；
- **滚动感知**：`surface_scroll` 把整屏滚动编码为一次位移 + 少数仍不同的行，接收端展开成普通 patch；
- **回滚按字节限制**，历史持久化默认关闭，因为屏幕内容可能含 token/密钥；
- **选择与搜索在输出继续时仍有效**：选择绑定内容而非冻结快照，复制时读取当前文本。

### 2.2 能力映射：哪些值得借鉴，哪些不适用

| herdr 能力 | herdr 的机制 | 对本插件的价值 | 落点 |
| --- | --- | --- | --- |
| 常驻 server / detach | server 拥有 pane，client 可断开 | 插件不能复制；DSH 已提供进程保留与快照重连 | 不采用；只利用 `keepMounted` + 快照 |
| workspace / tab / pane 分屏 | 布局树 + pane 运行时 | 可提升多任务体验，但受 8 终端上限与页签模型约束 | P3 可选 |
| Agent 状态与 blocked 提醒 | 前台进程 + 屏幕 manifest + 集成 hook | 插件无进程信息，只能做启发式提示；不要伪装成权威状态 | P3 / 实验 |
| copy mode + 搜索 | 键盘移动、smart-case 字面搜索、`n/N`、选择高亮 | 终端回看与复制的核心体验 | P1 |
| 鼠标优先 + Shift 逃生口 | 程序拥有鼠标时转发，Shift 保留选择 | 现有实现已有基础，需补 hover、链接、右键 | P0/P1 |
| 滚动条 | 轨道/滑块/拖拽，按 metrics 计算 | 长输出的可发现性 | P1 |
| 回滚字节上限 + 历史可选 | `scrollback_limit_bytes`，`pane_history` 默认 false | 防止大屏内存爆炸；隐私默认安全 | P0（字节上限）/P2（持久化可选） |
| damage / delta | 只发送变化行；滚动优先 | 插件侧对应为行 identity + damage + 滚动位移 | P0 |
| 帧合并 | RenderSignal、single wake | 插件侧为 rAF 合并 + 隐藏页签不绘制 | P0 |
| 同步输出 | `?2026h/l` 包住帧 | 避免半帧 prompt / 光标抖动 | P0 |
| 滚动感知 patch | 一次位移 + 残差行 | 对应 painter 的行元素轮转 | P0 |
| 选择在输出中存活 | 选择读当前文本，不冻结 | 修复回滚淘汰后选择漂移 | P0/P1 |
| OSC 8 链接 | 可见链接与命中测试 | 终端里点 URL / 文件路径 | P1 |
| Kitty graphics | 图像协议 | 宿主与 DOM 都不适合，明确不做 | 不做 |
| Kitty keyboard / modifyOtherKeys | 完整键盘协议 | 浏览器事件信息有限；可做子集，收益中等 | P3 可选 |
| 主题 / 字体 / 通知 | 主题、toast、声音 | 体验完善 | P1/P2 |

### 2.3 可以直接采纳的设计原则

1. **状态可测**：解析器、屏幕、选择、搜索都不碰 DOM；画家只读屏幕。
2. **行是身份，不是下标**：每行有稳定序号，选择和搜索绑定序号；回滚淘汰时钳制而不是漂移。
3. **滚动是位移**：全屏滚动只追加一行/淘汰一行，并记录一次 scroll damage；不要给所有行加版本号。
4. **只画变化**：行版本 + scroll damage + 可见性门控；隐藏页签只解析。
5. **预算化**：回滚按字节和行数双重上限；解析按时间片；绘制按帧预算。
6. **隐私默认关闭**：任何屏幕历史持久化都必须显式开启，并在关闭页签时清理。
7. **键盘和鼠标都能完成同一件事**：搜索、复制、滚动都要有键盘路径；鼠标是加速器，不是唯一入口。
8. **不猜测协议**：未知序列安全忽略；新增序列必须有测试和降级路径。

### 2.4 不照搬的部分

- 不引入 server/client 双进程、socket API、handoff、跨机器连接。
- 不复制 herdr 的 Rust 代码或 `ghostty-vt` 绑定；只借鉴结构与交互。若未来要移植代码，herdr 是 Apache-2.0，需要保留 NOTICE/许可证并做兼容性审查。
- 不把 agent 检测做成“看起来能用”的黑盒。没有进程信息时，宁可只显示“有输出 / 静默”，不要显示 `blocked`。

---

## 3. 现状审计

### 3.1 代码地图

| 文件 | 职责 | 规模 |
| --- | --- | --- |
| [`vt/screen.js`](../src/client/vt/screen.js) | 网格、主/备缓冲、回滚、光标、滚动区域、SGR、CSI/OSC/DCS 解析 | 727 行 |
| [`vt/render.js`](../src/client/vt/render.js) | 行 HTML、属性段合并、256 色、行版本缓存、光标/选择图层、单元格命中 | 305 行 |
| [`vt/body.js`](../src/client/vt/body.js) | React 组件、帧应用、rAF 绘制、fit、键盘/输入法/粘贴/鼠标/选择 | 476 行 |
| [`vt/keys.js`](../src/client/vt/keys.js) | 浏览器按键 → VT 字节、括号粘贴 | 124 行 |
| [`vt/mouse.js`](../src/client/vt/mouse.js) | X10 / SGR 鼠标编码、滚轮 | 98 行 |
| [`vt/selection.js`](../src/client/vt/selection.js) | 选择归一化、取词、取行、复制文本 | 151 行 |
| [`vt/width.js`](../src/client/vt/width.js) | East Asian Width / 零宽表 | 136 行 |
| [`termtab.js`](../src/client/termtab.js) | tab 类型、两个 slot、close handler、跨 kind hold | 128 行 |

### 3.2 实测基线

测试环境：Apple M1、macOS 14.5、Node v20.20.1。合成负载为 200×50、带 256 色与中文/emoji 的日志行，总计 8 MiB；另测 120×40 的滚动压力。这是相对基线，不是用户真实负载。

| 场景 | 结果 | 解释 |
| --- | --- | --- |
| 8 MiB 解析，`scrollback=0` | 266.5 ms，30.0 MiB/s | 纯解析上限约 30 MiB/s |
| 8 MiB 解析，`scrollback=1000` | 366.6 ms，21.8 MiB/s | 回滚让解析也变慢 |
| 8 MiB 解析，`scrollback=5000` | 529.8 ms，15.1 MiB/s | 随回滚深度线性退化 |
| 8 MiB 不换行长行 | 511.5 ms，未强制 GC 时 RSS 290.8 MiB | 每字符一个 cell 对象，分配压力大 |
| 全屏 200×50 行 HTML | 65.8 ms / 200 帧 = 0.33 ms/帧 | HTML 构造不是第一瓶颈；DOM 布局与整屏重绘才是 |
| 20 万行滚动，`scrollback=1000` | 629 ms | 约 31.8 万行/秒 |
| 20 万行滚动，`scrollback=5000` | 1026 ms | 随回滚深度变慢 |
| 20 万行滚动，`scrollback=20000` | 4269 ms | 约 4.7 万行/秒，`cat`/`yes` 会明显卡 |
| 保留 1050 行 × 200 列 | 强制 GC 后 RSS 32.5 → 107.2 MiB | 约 370 B/cell；500 列大屏会更快撞内存 |

补充实测：`resize(20→10→20)` 之后，原本换行的 `0123456789abcdefghijKLMNOP` 首行只剩 `0123456789`（第二行的 `KLMNOP` 尚在），右侧内容不可恢复；高度变化同样会改变保留行窗口并淘汰最早的行。这不是“视觉瑕疵”，是数据丢失。

### 3.3 问题清单

| ID | 问题 | 证据 | 影响 | 阶段 |
| --- | --- | --- | --- | --- |
| T1 | 宽度变化不 reflow，直接截断/补空 | `Buffer.resize()` 只改 `cells.length` 和行数（[`screen.js:56`](../src/client/vt/screen.js#L56)） | 拖侧栏、切窗口后右侧内容永久丢失；光标语义错误 | P0 |
| T2 | 每帧输出把回滚位置重置到底部 | `apply()` 无条件 `offset = 0`（[`body.js:407`](../src/client/vt/body.js#L407)） | 用户无法在输出继续时阅读回滚；这是最影响体感的缺陷 | P0 |
| T3 | 全屏滚动 O(回滚深度) | `scrollUp()` 每行 `push` + `shift()`（[`screen.js:191`](../src/client/vt/screen.js#L191)） | 大回滚下吞吐骤降；解析也受拖累 | P0 |
| T4 | 每字符新建 cell 对象，回滚无字节预算 | `put()` 每字符 `{c, fg, bg, fl, w, link}`（[`screen.js:138`](../src/client/vt/screen.js#L138)） | 500×200 + 1000 行可到数百 MB；GC 抖动 | P0 |
| T5 | 大粘贴不分片 | `onPaste` 一次 `model.write`（[`body.js`](../src/client/vt/body.js)）；Host 单条上限 64 KiB | 超过 64 KiB 的粘贴触发 `inputFull` 并断开 attach | P0 |
| T6 | 每个 output frame 触发 React render | `useTerminal()` + effect 应用帧（[`body.js:83`](../src/client/vt/body.js#L83)） | 高频输出时 React 调度与 diff 吃满主线程 | P0 |
| T7 | 隐藏页签仍绘制 | `paint()` 不检查 `tab.visible` | 多终端时后台页签持续消耗 CPU | P0 |
| T8 | 同步输出 `?2026` 未识别 | `setModes()` 没有 2026 分支（[`screen.js:451`](../src/client/vt/screen.js#L451)） | 应用已按同步输出发送，插件仍可能显示半帧 | P0 |
| T9 | DECSCUSR 的闪烁/稳态位被忽略 | `cursorBlink` 从不改变；`case "q"` 只映射形状 | 光标样式与应用请求不一致 | P0 |
| T10 | ANSI IRM（插入模式）永远不生效 | `setModes()` 对非 private 序列 `continue`；`modes.insert` 无入口 | 少数 TUI/行编辑场景字符覆盖而非插入 | P0 |
| T11 | 选择用绝对行号；回滚淘汰后漂移 | `selection` 存 `{row, col}`，`row` 是 buffer 下标 | 长输出时复制的可能不是用户选的内容 | P0/P1 |
| T12 | 缺少搜索与 copy mode | 没有 `vt/search.js`；只有鼠标选择 | 无法在 1000 行回滚里定位报错、复制命令输出 | P1 |
| T13 | 缺少滚动条与位置指示 | 只有 wheel / Shift+PageUp | 长输出不知道自己在哪、无法拖拽 | P1 |
| T14 | OSC 8 链接被丢弃 | `cell.link` 字段存在，但 `dispatchOsc()` 只处理 0/2（[`screen.js`](../src/client/vt/screen.js)） | 终端里的 PR/issue/文件链接不可点 | P1 |
| T15 | 焦点上报、鼠标 hover、alternate scroll 缺失 | `modes` 无 `focus`/`hover`/`altScroll`；`1003` 的 move 不发送 | vim/fzf 等程序收不到完整事件 | P1 |
| T16 | 没有通知/铃铛反馈 | `bell` 只计数 | 长任务结束、CI 失败没有提醒 | P1 |
| T17 | 固定 xterm 16 色，不随主题适配 | `BASE16` 固定（[`render.js`](../src/client/vt/render.js)） | 浅色主题下对比度差；品牌色不统一 | P2 |
| T18 | 字体测量只用 `MMMMMMMMMM`，无 CJK/emoji fallback | `measure()` 用 10 个 M 求平均（[`render.js:171`](../src/client/vt/render.js#L171)） | 不同字体 fallback 下格宽偏移、列错位 | P2 |
| T19 | 屏幕内容无无障碍镜像 | 只有隐藏 textarea，没有可见文本语义 | 屏幕阅读器难以读取终端输出 | P2 |
| T20 | 失败/断线没有重连入口 | `phase === failed` 只显示错误文本 | 用户只能关页签重开，丢失 Host 进程 | P1 |
| T21 | emoji 字素簇宽度不完整 | `width.js` 按 code point；ZWJ/肤色修饰符未处理 | 复合 emoji 占 4 格、光标错位 | P1/P2 |
| T22 | 快照重放不清选择/搜索/锚点 | `applyRenderFrame` 只 `reset` + `resize` + `write` | 重连后旧选择指向新内容 | P0 |

### 3.4 根因

- **数据结构**：定长数组 + `shift`，没有行序号和环形缓冲；
- **变更模型**：只有 `dirtyAll` 和行版本，没有“滚动了多少”的信息；
- **调度模型**：输出 → React state → effect → 解析 → rAF；解析和渲染都被 React 的更新节奏牵引；
- **交互模型**：选择、滚动、搜索没有独立状态机，全部挂在 body 的闭包变量上；
- **协议模型**：只解析“够用”的子集，未知序列安全忽略是对的，但缺少模式注册表和 OSC 事件出口；
- **资源模型**：没有字节预算，没有可见性门控，没有解析时间片。

---

## 4. 设计原则

1. **正确性优先于炫技**：不丢字节、不丢内容、不静默改变用户选择；任何优化都有降级路径。
2. **屏幕与 DOM 解耦**：解析器只产出数据和 damage；画家只消费数据；两者都能在 Node 测试。
3. **行身份稳定**：`seq` 是选择、搜索、滚动锚点、damage 的共同坐标；绝对下标只是派生值。
4. **滚动是位移**：全屏滚动 O(1)，滚动帧只移动行元素或只重画新暴露的行。
5. **预算化**：回滚按行数和字节双上限；解析按 6–8 ms 时间片；绘制按 8–16 ms 帧预算。
6. **键盘可达**：搜索、复制、滚动、跳转都有键盘路径；鼠标是加速器。
7. **隐藏不绘制**：隐藏页签继续解析（保持状态正确），但不做 DOM 工作和覆盖层计算。
8. **隐私默认关**：历史持久化必须显式开启；关闭页签清理；文档写明风险。
9. **不猜协议**：未知序列忽略；新增序列有单测、golden 和超时降级。
10. **可测量**：每个性能改动都有基准和 CI 门槛；不做“感觉更快”的优化。

---

## 5. 目标架构

### 5.1 分层

```text
DSH TerminalView.state
  snapshot / output / state / ack
            │
            ▼
┌──────────────────────────────────────────────────────┐
│ Frame intake                                         │
│  - 顺序校验、revision 去重、backlog 队列             │
│  - 解析完成后 ack；backlog 时按时间片继续             │
└──────────────────────┬───────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────┐
│ VT parser（纯函数）                                  │
│  - CSI / OSC / DCS / ESC / SGR / 控制字符            │
│  - 模式注册表、OSC 事件、字素簇分段                  │
└──────────────────────┬───────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────┐
│ Screen store                                         │
│  - 主/备缓冲；环形回滚；行 seq；wrapped；marks       │
│  - damage log：scrolls / rows / cursor / title / bell│
│  - 选择模型（seq + col）；搜索索引；链接表           │
└───────┬───────────────────────┬──────────────────────┘
        │                       │
        ▼                       ▼
┌───────────────┐       ┌──────────────────────────────┐
│ Viewport      │       │ Interaction                  │
│ 锚点/偏移     │       │ 键盘、鼠标、IME、搜索、复制   │
└───────┬───────┘       └──────────────┬───────────────┘
        └───────────────┬──────────────┘
                        ▼
┌──────────────────────────────────────────────────────┐
│ Painter（rAF，单帧一次）                             │
│  - 行元素轮转（scroll fast path）                    │
│  - 行版本缓存；可见性门控；光标/选择/滚动条图层      │
└──────────────────────────────────────────────────────┘
```

### 5.2 模块调整

| 模块 | 现状 | 方案 | 备注 |
| --- | --- | --- | --- |
| `vt/screen.js` | 解析 + 网格 + 模式 | 拆为 `vt/parser.js`（纯解析状态机）+ `vt/screen.js`（网格/缓冲/damage） | 拆分可以让解析器 fuzz 测试，不强迫一次完成；P0 可先内聚改造 |
| `vt/buffer.js`（新） | 无 | 环形行缓冲、`seq`、字节预算、reflow | P0 |
| `vt/damage.js`（新） | 无 | damage 记录、合并、滚动描述 | P0 |
| `vt/search.js`（新） | 无 | 字面搜索、smart-case、匹配范围、当前匹配 | P1 |
| `vt/links.js`（新） | 无 | OSC 8 / URL 识别、scheme 白名单、命中 | P1 |
| `vt/copy-mode.js`（新） | 无 | 键盘移动、选择、复制 | P1 |
| `vt/theme.js`（新） | 部分在 `render.js` | 明暗 ANSI 调色板、对比度、光标/选择色 | P2 |
| `vt/prefs.js`（新） | 无 | 本地偏好 schema、迁移、默认值 | P1/P2 |
| `vt/render.js` | 行 HTML + 行版本 | 行元素轮转、行缓存、overlay 图层、滚动条 | P0/P1 |
| `vt/body.js` | React 组件 + 全部交互 | 拆为 `terminal-controller.js`（帧/调度）+ 组件；交互拆到 `vt/interaction.js` | P0/P1 |
| `termtab.js` | 注册/持有/关闭 | 基本不变；若 P3 分屏则扩展子终端集合 | P3 |

### 5.3 帧接收与 ack

当前路径是 `useTerminal` → React render → effect → `apply`。目标路径：

```js
// 伪代码：在 body 挂载时建立，不经过 React
const unsubscribe = view.state.subscribe(() => {
  const state = view.state.getSnapshot();
  queue.push(state.render);      // 只接收新 revision
  ensurePump();
});
```

- **ack 时机**：解析完成后 `view.acknowledge(revision)`，不是绘制后。绘制可以晚一帧，但解析不能拖，否则 Host 的 2 MiB follower 队列会断。
- **去重**：记录 `lastAppliedRevision`；同一 revision 的重复通知忽略。
- **backlog**：若一次解析超过 6 ms，剩余字节留在队列，下一个 task 继续；期间不 ack 未完成帧。若 backlog 超过阈值（例如 4 MiB），暂停绘制并显示“正在追赶输出”，但绝不清空队列。
- **错误**：序列缺口/非法帧不再只显示错误，提供“重新连接”动作；`TerminalView.connect()` 可重建 attach 并拿到新快照。

### 5.4 屏幕存储：环形回滚 + 行身份

```js
// 概念结构
line = {
  seq: 42,             // 单调递增，淘汰不回收；选择和搜索绑定它
  cells: [...],        // 列数组，undefined 表示空白
  wrapped: true,       // 该行是逻辑行的一段
  version: 7,          // 单元格内容版本，用于 painter
  marks: null,         // OSC 133/633 的 prompt/command 标记（P2）
};

buffer = {
  slots: new Array(rows + scrollbackRows),
  head: 0,             // 最老行在 slots 中的位置
  count: 0,            // 当前行数
  firstSeq: 1,
  bytes: 0,            // 估算字节数，用于上限
};
```

- **全屏滚动**：追加一行空白并推进 `head`（或覆盖最老行），O(1)；不再 `shift()`。
- **区域滚动**（DECSTBM、IL/DL）：区域通常 ≤ 可见行数，可在区域内轮转；若区域覆盖整个屏幕，走全屏路径。
- **绝对行访问**：`lineAt(index)` 用 `(head + index) % capacity`；`seqAt(index)` 返回行序号。
- **字节预算**：每行记录 `approxBytes = cells.length * 16 + textBytes`；淘汰最老行直到低于预算，但至少保留 `rows` 行。默认 10 MiB，上限 50 MiB。
- **备缓冲**：没有回滚，容量 `rows`，不进字节预算；resize 时只补/截，不 reflow。
- **行版本**：只有实际改动的单元格所在行 `version++`；滚动不再给所有行加版本。

### 5.5 damage 模型

```js
damage = {
  full: false,                 // 全量失效（reset/alt 切换/reflow）
  scrolls: [{ top, bottom, shift }], // 绝对 seq 范围 + 位移（正=内容上移）
  rows: new Set(),             // 内容变化的行 seq
  cursor: true,
  title: false,
  bell: 0,
  modes: 0,
};
```

- 解析时把“滚动”记录为一次 scroll，而不是 `dirtyAll`；
- 同一帧多个 scroll 若区域不重叠，painter 可以依次应用；重叠则降级 `full`；
- `consumeDamage()` 在绘制开始时取走并清空；绘制中不再接受新帧（单线程天然满足）；
- 用户处于回滚状态时，滚动仍然影响 buffer，但 painter 以“锚点行 seq”重新计算视口；若锚点被淘汰，钳制到最老行并提示。

### 5.6 Painter：滚动感知与行复用

当前 `paint()` 按 slot 比较 `line.version`，滚动后所有 slot 都换了行，于是整屏重写（[`render.js:211`](../src/client/vt/render.js#L211)）。目标：

1. 维护 `rowEls[]`、`rowSeq[]`、`rowVersion[]`。
2. 若本帧只有一个全屏 scroll、`offset === 0`、且 `rows` 为空：
   - 把 `rowEls` 旋转 `shift` 个位置（`insertBefore` 或 `appendChild` 重排），同步 `rowSeq/rowVersion`；
   - 只绘制新暴露的行（通常 1–3 行）。
3. 否则逐 slot 比较 `seq + version`：
   - `seq` 相同且版本相同 → 跳过；
   - `seq` 相同、版本不同 → 重建该行；
   - `seq` 不同 → 复用/移动已有行元素，或重建。
4. 行 HTML 用 `WeakMap<line, {version, html}>` 缓存，滚动复用行时直接取回，避免重复 `rowHtml`。
5. 光标、选择、滚动条、搜索高亮都是独立 overlay，绝不进入行 HTML，避免高亮触发整行重绘。
6. 每帧返回统计：`{paintedRows, movedRows, ms}`，供性能 HUD 和测试使用。

**为什么先不做 canvas**：DOM 行 + 文本节点能保留浏览器原生文本选择、字体 fallback、主题变量和可访问性；在 500×200 的情况下，行级复用 + 滚动位移应能进预算。如果 P2 的基准显示 500×200 仍超 16 ms，再评估 canvas/WebGL 快路径，届时用离屏文本镜像补可访问性。

### 5.7 宽度变化与 reflow

宽度变化必须按逻辑行重排，而不是截断：

```text
逻辑行 = 连续的、后一行 wrapped=true 的行序列
新行 = 把逻辑行的 cell 序列按 newCols 重新切分
       - 宽字符不能跨行：若剩余 1 格放不下宽字符，补 1 个空白 cell 后换行
       - 保留每段的 wrapped 标记（除最后一段）
       - 光标位置映射为“逻辑行内 cell 偏移”，再落到新行/列
```

- **只在宽度变化时 reflow**；高度变化只调整可见行数与底部位置。
- **备缓冲不 reflow**：全屏应用会收到 SIGWINCH 并自行重绘；对 alt 做重排会破坏应用状态。
- **防抖与 Host 同批**：拖拽侧栏时宽度连续变化，`ResizeObserver` 用 80 ms 防抖；防抖期间保留旧网格，也**不调用 `model.resize`**，避免本地宽度与 PTY 宽度错位。防抖结束时在同一个 task 内完成本地 reflow 与 `model.resize`，保证下一帧输出到达前两边宽度一致；最后一次宽度变化必须 reflow。
- **滚动锚点**：用户回滚时锚定 `seq`；reflow 后按“逻辑行 + cell 偏移”映射回新行。若锚点所在行被淘汰，钳制到最老行。
- **与 Host 的一致性**：DSH 的 headless xterm 也会 reflow；插件重排算法要尽量与其一致。P0 用固定 fixture 验证常见场景（长行、宽字符、尾部空白、回滚中的换行行）；P2 可加一个可选交叉测试：若测试环境能解析 `@xterm/headless`，对同一输入比较 resize 前后的可见文本。

### 5.8 生命周期、可见性与主题

- **可见性**：`paint()` 和 `paintSelection()` 只在 `tab.visible !== false` 时执行；隐藏时只置 dirty，不创建/移动 DOM。重新可见时一次性补画。
- **主题变化**：主题快照变化时递增 `themeVersion`，`renderer.invalidate()` 并重绘；字体变化重新 `measure()` 并 `fit()`。
- **重连**：`phase === disconnected/failed` 时显示状态条和“重新连接”按钮，调用 `model.connect()` 或 `model.refresh()`；不要要求用户关闭页签。
- **快照**：`snapshot` 到达时清理选择、搜索、锚点和行缓存，再 `reset + resize + write`；快照是唯一权威基线。
- **关闭**：`termtab.js` 的 close handler 保持不变；P3 分屏时关闭父页签必须关闭其所有子终端。

---

## 6. 功能设计

### 6.1 回滚、滚动条与“不被输出踢走”

**现状**：滚轮和 Shift+PageUp 可用，但每一帧输出都会 `offset = 0`；没有滚动条。

**目标行为**：

- 用户向上滚动后，视口锚定到当前顶部行的 `seq`；输出继续时视口内容不跳，`offset` 自动增长；只有用户回到底部或主动“跟随输出”才回到实时。
- 底部时新输出照常跟随；在底部向上滚一行即进入“阅读模式”。
- 滚轮：3 行/格（触控板按像素折算，最小 1 行）；Shift+滚轮保留给程序或选择逃生口。
- 键盘：`Shift+PageUp/PageDown`、`Shift+Home/End` 保留；`Ctrl/Cmd+Home/End` 跳顶/底；`Esc` 在搜索/复制模式下关闭，不抢 shell 的 Esc。
- 滚动条：右侧 overlay，8 px；滑块长度 = `viewportRows / (maxOffset + viewportRows)`；拖拽/点击轨道映射到 offset；自动淡出，hover/拖拽时显示；**不改变列数**，避免触发 resize 循环。
- 位置提示：回滚时右下角显示 `↑ 123/1000`；点击回到底部。新输出到达而用户不在底部时，不闪、不抢焦点。
- 回滚上限：显示“已保留最近 N 行 / X MiB”，到达上限时静默淘汰最老行；P2 可在设置里调整。

**验收**：

- 输出持续 10 秒、用户在第 300 行时，视口内容不移动；底部出现“新输出”提示。
- 拖拽滚动条到任意位置，release 后 offset 与滑块一致；再次输出不跳。
- 200×50、1000 行回滚下，滚轮一格的绘制不超过 8 ms。

### 6.2 搜索与 copy mode

**搜索**：

- `Ctrl/Cmd+F` 打开终端内搜索条（不触发浏览器查找）；输入即时搜索，120 ms 防抖。
- 字面搜索（P1 不做正则，避免灾难性回溯）；大小写规则采用 smart-case：查询含大写则区分，否则不区分。
- 搜索范围：主缓冲回滚 + 当前视口；alternate 屏幕搜索可见内容。
- 匹配全部高亮（半透明底色），当前匹配更实；`Enter` 下一个、`Shift+Enter` 上一个、`Esc` 关闭并把焦点还给终端。
- 搜索到视口外时自动滚动到匹配，并保持“搜索模式”不跟随输出（除非用户按 `End` 回底）。
- 输出导致文本变化时，用 `{seq, col, textHash}` 重新校验当前匹配；不匹配则跳到下一个有效匹配。
- 显示 `3/27` 计数；无匹配显示 `0/0`，不阻塞输入。

**Copy mode（P1/P2）**：

- 入口：`Ctrl/Cmd+Shift+Space` 或命令中心“终端：复制模式”；搜索条也可进入。
- 移动：`h/j/k/l`、方向键、`w/b/e`、`W/B/E`、`{/}`、`PageUp/PageDown`、`g/G`（顶/底）。
- 选择：`v` 开始/结束，`Space` 选择，`y`/`Enter` 复制，`Esc` 取消；状态栏显示模式与按键提示。
- 复制模式不暂停解析；输出继续，选择保持；复制时读取当前文本（与 herdr 一致）。
- 鼠标拖选不进入 copy mode；右键菜单提供“复制 / 粘贴 / 全选 / 搜索 / 清屏”。

**验收**：

- 1000 行回滚中搜索报错串，`Enter` 循环 27 个匹配，当前匹配始终可见。
- 选择跨 50 行、输出继续 2 秒后复制，文本与选择时一致（除非所选行被淘汰；淘汰时明确提示/钳制）。
- 搜索 200×1000 的首次查询 < 30 ms，输入防抖后无可感卡顿。

### 6.3 选择、剪贴板与大粘贴

**选择模型**：

- `{ anchor: {seq, col}, head: {seq, col} }`；`seq` 不存在时（已被淘汰）钳制到最老行。
- 支持正向/反向、跨行、宽字符（一个宽字符占两格但复制一个字符）、wrapped 行不插换行。
- 双击选词（保留现有 `WORD_RE` 语义），三击选行；双击后拖动扩展按词；Alt+拖拽做列选择（P2）。
- 拖到视口边缘自动滚动，速度随距离递增；用 rAF 驱动，不用每个 pointermove 改 offset。
- 选择在输出、滚动、回滚淘汰时保持；快照/切 alt/resize 时清除。
- 复制：`Cmd/Ctrl+C`（有选择时）、`Ctrl+Shift+C`、右键菜单；无选择时 `Cmd+C` 不拦截，交给系统。
- 复制失败（非安全上下文/权限）显示一次轻提示，不静默失败。

**粘贴与 OSC 52**：

- 大粘贴按 **Host `maxInputBytes` 自适应分片（默认约 4 KiB）** 并节流写入，保持顺序；括号粘贴模式下，序列为 `ESC[200~` + chunks + `ESC[201~`，分片不能拆开标记。每片都是独立的 `write` 命令，受 Host 64 KiB 预算限制；同步连发多片会撞上“未确认输入”上限，所以片间留出 ack 排空时间。
- 粘贴前把 `\r\n` 归一为 `\r`；保留 `\n` 语义与末尾换行。
- OSC 52 写剪贴板默认 **拒绝**（可配置为 ask / allow）；读取剪贴板默认拒绝。终端程序请求写系统剪贴板是敏感操作，不能默认放行。
- 粘贴图片/文件（P3）：浏览器剪贴板 API 只能取文本；文件路径可走插件现有工作区能力，不在 P0 范围。

**验收**：

- 1 MiB 文本粘贴不触发 `inputFull`；开启括号粘贴时 shell 收到完整文本且只执行一次，未开启时按 shell 自身语义逐行处理。
- 选择在输出 2 秒后复制内容不漂移；回滚淘汰后钳制并提示。
- OSC 52 在默认配置下不写剪贴板；显式允许后才生效。

### 6.4 OSC 8 链接与可点击内容

- 解析 `OSC 8 ; params ; URI ST/BEL`，把 `link` 写到 cell；`OSC 8 ; ;` 结束当前链接。
- 渲染：链接文字加下划线（虚线/点线，遵循主题），hover 时显示 pointer；链接不与选择冲突：按住 Shift 或进入选择拖拽时优先选择。
- 点击：`Cmd/Ctrl+Click` 打开（避免普通点击误触）；scheme 白名单 `http:` / `https:` / `mailto:`；`file:` 默认不自动打开，转为“在编辑器中打开/复制路径”菜单项。
- 无 OSC 8 时，可选的正则识别 `https?://` 作为弱链接（默认关闭，避免误识别日志）。
- 链接目标做长度/控制字符清洗；不允许 `javascript:`、`data:`、`file:` 自动执行。
- 验收：OSC 8 示例可 hover/点击；恶意 scheme 被拒绝；链接跨越宽字符时命中正确。

### 6.5 通知、铃铛与状态提示

- `BEL`：可配置为视觉闪烁（tab 标题点）、系统提示音、或关闭；终端聚焦时不响。
- OSC 9 / 777 / 99（若实现）：标题 + 正文，去重、限频（例如 2 秒一条）、只显示最近若干条；点击聚焦对应 tab。
- 长任务提示：基于 OSC 133（P2）或“输出静默 + 曾运行超过 N 秒”的启发式；明确标注“可能完成”，不冒充 agent 状态。
- Tab 标题：OSC 0/2 标题优先，其次 shell 名/用户命名；状态点表示“有未读通知 / 正在输出 / 已退出”。
- 通知在页面不可见时走浏览器 Notification API（若权限已授予）；否则只做页内 badge，不主动弹权限请求。
- 验收：`printf '\a'` 触发一次视觉提示；连续 100 次 BEL 不产生 100 个 toast；后台 tab 的通知不抢焦点。

### 6.6 终端协议覆盖

按“影响真实 TUI 体验”排序，不追求全协议：

| 序列 / 模式 | 现状 | 方案 | 阶段 |
| --- | --- | --- | --- |
| `CSI ? 2026 h/l` 同步输出 | 忽略 | 解析为 `syncOutput`；期间照常解析、暂缓绘制，收到 `l` 或 150 ms 超时后绘制 | P0 |
| `CSI ? 1004 h/l` 焦点上报 | 忽略 | focus/blur 时发送 `ESC[I` / `ESC[O` | P1 |
| `CSI ? 1007 h/l` alternate scroll | 忽略 | alt 屏幕下滚轮发送方向键（按应用请求） | P1 |
| `CSI ? 9 h` X10 鼠标 | 忽略 | 并入现有鼠标模式 | P1 |
| `CSI ? 1015 h` urxvt 鼠标 | 忽略 | 可选，优先级低 | P3 |
| `CSI 4 h/l` IRM 插入 | 永远不生效 | `setModes` 处理 ANSI（非 private）模式 | P0 |
| `CSI Ps SP q` DECSCUSR | 形状对，闪烁位错 | 0–6 映射形状 + 闪烁；`prefers-reduced-motion` 下强制不闪 | P0 |
| `SGR 4:3/4:4` 曲线/双下划线 | 忽略 | 扩展 `fl` 位或 underline style 字段；painter 支持 | P2 |
| `SGR 53/55` overline、`58/59` underline color | 忽略 | 增加属性位与颜色 | P2 |
| `OSC 8` 链接 | 忽略 | 见 6.4 | P1 |
| `OSC 7` 当前目录 | 忽略 | 记录 cwd；标题/“在系统终端打开”可用；不自动执行 | P1 |
| `OSC 52` 剪贴板 | 忽略 | 默认拒绝，可显式允许写；读默认拒绝 | P1 |
| `OSC 133/633` shell 集成 | 忽略 | 记录 prompt/command 标记；跳转提示符、复制命令输出、通知 | P2 |
| `OSC 9/777/99` 通知 | 忽略 | 见 6.5 | P1/P2 |
| Kitty keyboard / `modifyOtherKeys` | 忽略 | 只做不破坏现有键位的子集；浏览器无法可靠拿到 release/physical key 时不承诺完整 | P3 |
| 字素簇宽度 | 按 code point | 非 ASCII 用 `Intl.Segmenter`（有则用）或内置扩展表；ZWJ/肤色/旗帜按 2 格 | P1/P2 |

所有新增模式都放进一个 `modes` 对象，并提供 `onMode` 事件；painter/input 只读模式，不各自解析序列。

### 6.7 主题、字体与无障碍

**主题**：

- 提供 `DARK_ANSI` / `LIGHT_ANSI` 两套 16 色；256 色与 truecolor 保持不变。
- 背景/前景优先用 DSH 主题变量；ANSI 色在浅色主题下做对比度校正（目标 ≥ 4.5:1，至少对普通文本）。
- 选择色、光标色、搜索高亮、链接色都用主题 token，不写死在 CSS 的 `#264f78`。
- 支持 `prefers-reduced-motion`：关闭光标闪烁、滚动动画、通知动画。
- 支持主题切换时重绘（不依赖下一次输出）。

**字体**：

- `measure()` 用 canvas 测量一组代表字符（M、i、W、中、😀）并取整数格宽；字体 fallback 链加入 `Apple Color Emoji` / `Noto Color Emoji` / CJK 字体。
- 字号缩放：`Cmd/Ctrl + =` / `-` / `0`；持久化到偏好；缩放后重新 measure + fit。
- 连字默认关闭（终端网格需要等宽）；允许用户开启 `font-variant-ligatures: contextual`，但提示可能破坏对齐。
- 行高、padding、光标宽度按 `devicePixelRatio` 取整，避免模糊。

**无障碍**：

- 隐藏 textarea 保留 `aria-label`；终端容器加 `role="application"`（或 `group`）和说明。
- 增加视觉隐藏的 `<pre class="ce-term-a11y">` 镜像当前视口文本，最多每 500 ms 更新一次；屏幕阅读器可读，不参与布局。
- `aria-live="polite"` 只播报状态变化（连接/断开/铃铛/搜索计数/命令完成），不逐帧播报屏幕。
- 所有快捷键在命令中心/帮助里列出；焦点环可见；搜索条、复制模式支持 Tab 导航与 Esc 退出。

### 6.8 可选扩展（P3，不在本期承诺）

**分屏工作区**：

- 一个插件 tab 内维护布局树（水平/垂直 split），每个叶子是一个 `TerminalView`；快捷键 `Cmd/Ctrl+Shift+D` 向右分、`Cmd/Ctrl+Shift+E` 向下分、方向键切换焦点、`Cmd/Ctrl+Shift+W` 关闭当前 pane。
- 受 DSH `maxTerminals=8` 限制；父页签的 close handler 必须关闭所有子终端，`retainTabs` 必须列出所有子终端 contentId。
- 每个 pane 独立 fit/search/scroll；标题显示 pane 数；焦点 pane 有边框。
- 风险：与 DSH 页签语义、hold 生命周期、快捷键冲突；先做原型和用户验证，不直接进主线。

**历史持久化**：

- 依赖 Host 快照已能带回 1000 行；插件本地持久化只在“需要超过 Host 回滚”时提供。
- 默认关闭；开启后存 IndexedDB，按 terminal id 分 key，最多 2 MiB/终端，关闭页签/清理缓存时删除；文档明确“屏幕可能含密钥”。
- 不做跨设备同步。

**Agent 活动提示**：

- 只基于 OSC 133/标题/静默期，不读取进程树；显示“输出中/静默 N 秒”，不显示 blocked/done 等生命周期结论。
- 与 DSH 的 Agent 状态区分命名，避免误导。

---

## 7. 性能设计

### 7.1 预算

| 指标 | 目标 | 测量方式 |
| --- | --- | --- |
| 解析吞吐 | 纯文本 ≥ 50 MiB/s，彩色 ≥ 30 MiB/s（200×50，M1/Node 20 基线） | 基准脚本，固定 chunk |
| 单帧解析 | 典型 ≤ 8 ms；超过则时间片，不阻塞输入 | 帧内计时 |
| 单帧绘制 | 200×50 ≤ 8 ms p95；500×200 ≤ 16 ms p95 | PerformanceObserver / 自测 |
| 输入到可见 | 本地 ≤ 50 ms p95 | 键盘事件到下一帧 |
| 回滚操作 | O(1) 全屏滚动；10k 行滚动 10k 次 ≤ 20 ms | 基准脚本 |
| 内存 | 保留行 ≤ 64 B/cell（目标），回滚 ≤ 10 MiB 默认 | `process.memoryUsage` / 浏览器 heap |
| 隐藏页签 | 不产生 DOM 写入；CPU 仅解析 | 计数/基准 |
| 大粘贴 | 1 MiB 成功；分片按 Host 预算自适应并节流 | 单测 + 真实终端 |

### 7.2 优化项与预期收益

| 优化 | 做法 | 预期 |
| --- | --- | --- |
| 环形回滚 | `head + count`，全屏滚动覆盖最老行 | 消除 O(n) shift；20000 行回滚不再线性退化 |
| 行身份 + damage | `seq` + scrolls/rows | 滚动只重画新行；选择和搜索稳定 |
| 滚动位移 | painter 轮转行元素 | 全屏滚动从整屏重写降到 1–3 行 |
| React 解耦 | 直接订阅 `view.state`，React 只处理连接状态/标题 | 每帧不再触发组件 render/diff |
| 可见性门控 | 隐藏时只解析 | 多终端后台 CPU 显著下降 |
| 解析快路径 | ASCII run、charCodeAt 循环、宽度预计算、避免 `for..of` | 纯文本解析目标 2–3× |
| 属性/单元格复用 | 属性 interning、淘汰行回收 cell 对象（P2） | 降低 GC 与每 cell 内存 |
| 字节预算 | 按估算字节淘汰 | 500×200 不再无界增长 |
| 大粘贴分片 | 自适应 chunk + 片间节流 + 括号标记 | 消除 `inputFull` 断流 |
| 帧合并/同步输出 | rAF + `?2026` | 无半帧、无光标抖动 |
| reflow 防抖 | 80 ms + 最后一次必做 | 拖拽侧栏不卡；结束时内容正确 |

### 7.3 解析快路径

当前 `write()` 的 ground 状态已经按可打印 run 切分，但仍在 `put()` 里逐字符做宽度判断和对象分配。目标：

1. **ASCII run 快速填充**：连续 `0x20..0x7e` 且 `attrs` 默认、无链接、不触发换行时，直接填充一行的一段；只有遇到宽字符、组合字符、控制字符或换行才回到通用路径。
2. **宽度预计算**：ASCII 直接 1；仅在 `code >= 0x80` 时调用 `cellWidth()`；对常见 CJK 区间用分支。
3. **字素簇**：非 ASCII 文本先按 `Intl.Segmenter('grapheme')` 分段；每段算一个宽度，组合标记附着到同一 cell。没有 Segmenter 时回退到 code point + 零宽表。
4. **减少函数调用**：`put` 的内联热路径；`lineAt` 在 run 内只取一次行对象。
5. **避免重复分配**：淘汰行时把 cell 对象放回 pool（P2）；或者把 cell 改为 `{c, styleIndex, w}`，style 表 interning（P2，需同步改测试/选择/搜索）。

### 7.4 绘制与调度

- **一帧一次**：`requestAnimationFrame` 合并；解析可以在 effect/订阅里立即做，但绘制只在 rAF。
- **解析时间片**：每帧最多 6 ms 解析；超出的字节留在 backlog，下一帧继续。ack 在整帧解析完成后发；不要为了绘制而提前 ack。
- **同步输出**：遇到 `?2026h` 时设置 `deferPaint`；`?2026l` 或 150 ms 超时后清空并绘制。不要无限等待。
- **滚动帧**：只移动行元素 + 画新行；选择/搜索/滚动条图层单独更新。
- **隐藏页签**：`schedule()` 置 dirty 但不申请 rAF；变为可见时强制一次全量/增量绘制。
- **光标**：单独元素，移动只改 transform；闪烁用 CSS animation，`prefers-reduced-motion` 关闭。
- **选择高亮**：矩形 overlay，不改行 HTML；拖拽时只更新矩形，避免整行失效。
- **滚动条**：CSS transform，拖拽时只更新 thumb，不触发终端 fit。
- **resize**：与 reflow 同批发送，不在 `ResizeObserver` 的每个事件里各发一次；避免 shell 收到一串 SIGWINCH。

### 7.5 回滚内存与压缩

- 默认 `scrollbackBytes = 10 MiB`，行数上限取 Host `environment.scrollback`（1000）；以先到者为准。
- 每行 `approxBytes` 按 `cells.length * 16 + 文本 UTF-16 字节` 估算；淘汰时从总字节中扣除。
- 选择/搜索引用被淘汰行时钳制；不为了保留选择而阻止淘汰（否则内存会泄漏）。
- P2 可评估“空闲时压缩”：把老行的 cell 数组压成 ANSI 文本/紧凑数组；解压只在搜索/复制时发生。herdr 在空闲时压缩回滚；插件可后做，不作为 P0。

### 7.6 性能验证

- 新增 `scripts/bench-terminal.mjs`（或 `test-terminal-perf.mjs`）：固定 200×50、500×200，测解析、滚动、绘制 HTML、reflow、搜索、内存；输出 JSON，CI 记录基线。
- 门槛用“相对基线 + 宽裕绝对上限”，避免 CI 抖动：例如解析不低于基线 0.8×，回滚 10k 次不超过 50 ms，500×200 单帧不超过 20 ms。
- 行为测试优先于墙钟：解析器用确定性断言，性能测试作为证据而不是唯一门禁（herdr 的 AGENTS.md 也强调这一点）。
- 性能 HUD（开发模式）：显示 `parse ms / paint ms / rows painted / backlog bytes / scrollback MiB / fps`；默认隐藏，命令中心可切换。

---

## 8. 接口与偏好设计

### 8.1 `createScreen` 扩展（保持向后兼容）

```js
const screen = createScreen({
  cols, rows,
  scrollback,          // 行上限（Host environment）
  scrollbackBytes,     // 新增，默认 10 MiB
});

screen.write(data);            // 不变
screen.resize(cols, rows);     // 语义改为“宽度 reflow / 高度调整”
screen.viewport();             // 不变，返回行引用
screen.viewportAt(offset);     // 不变
screen.lineAt(index);          // 不变
screen.bufferRows;             // 不变
screen.scrollbackRows;         // 不变

// 新增
screen.lineSeqAt(index);       // 绝对下标 -> seq
screen.indexOfSeq(seq);        // seq -> 当前绝对下标（不存在返回 -1）
screen.firstSeq;               // 最老行 seq
screen.damage;                 // 只读快照
screen.consumeDamage();        // painter 取走并清空
screen.reflow(width);          // 内部由 resize 调用；也可显式测试
screen.search(query, opts);    // 返回匹配范围（P1）
screen.linkAt(index, col);     // OSC 8 / 弱链接（P1）
screen.modes;                  // 增加 focus/syncOutput/altScroll/hover
screen.onOsc(listener);        // title/cwd/link/notification/clipboard 事件
screen.onMode(listener);       // 模式变化
```

### 8.2 `createRenderer` 扩展

```js
const renderer = createRenderer({ container, theme, font });
renderer.measure();
renderer.paint(screen, { offset, damage }); // damage 可选；缺省时退化到行版本比较
renderer.paintSelection(rects);
renderer.paintScrollbar({ offset, maxOffset, viewportRows });
renderer.paintSearch(matches, current);
renderer.invalidate();
renderer.stats;             // { paintedRows, movedRows, ms }
```

### 8.3 本地偏好

终端偏好是客户端行为，不需要重启 Host；沿用仓库已有的 localStorage 模式，键前缀 `dsh.plugin-kit.terminal.`，JSON + schema 校验，读取失败回默认值。

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `scrollbackMiB` | 10 | 本地回滚字节上限 |
| `copyOnSelect` | false | 选中即复制（受浏览器剪贴板权限限制） |
| `cursorBlink` | true | 尊重 `prefers-reduced-motion` |
| `fontSize` | 13 | 与主题字体大小合并；缩放快捷键修改 |
| `fontLigatures` | false | 终端网格默认关闭 |
| `bell` | `visual` | `off` / `visual` / `sound` |
| `notifyOnOsc` | true | OSC 9/777 通知 |
| `osc52` | `deny` | `deny` / `ask` / `allow` |
| `persistScrollback` | false | P3；开启时显示隐私提示 |
| `searchCaseSensitive` | false | `false` 时为 smart-case |

### 8.4 事件/工具面

- 终端内部事件（P1/P2）：`terminal.bell`、`terminal.notification`、`terminal.title`、`terminal.cwd`、`terminal.commandStarted/Finished`（OSC 133）。
- 如果未来需要 Agent 工具读取终端内容，应由 DSH 的 terminal controller 提供，而不是插件另开旁路；本方案不新增 Host 路由。

---

## 9. 实施路线

### P0：正确性与性能底座（3–4 人日）

**交付**

1. `vt/buffer.js`：环形缓冲、`seq`、字节预算；`screen.js` 改用新 buffer。
2. damage：scrolls / rows / cursor / title / bell；全屏滚动 O(1)。
3. `body.js`：直接订阅 `view.state`，移除每帧 React render；可见性门控；快照清理选择/搜索/锚点。
4. 滚动锚点：输出不再重置 offset；底部跟随/阅读模式。
5. 宽度 reflow + 高度调整；alt 不 reflow；防抖。
6. 大粘贴按 Host 预算自适应分片并节流；`inputFull` 给出可恢复提示。
7. 协议修正：IRM、DECSCUSR 闪烁、`?2026`、`?1004` 基础、OSC 8 解析（先存不渲染）。
8. 重连按钮；序列缺口/失败不再只能关页签。

**退出标准**

- resize 往返保留文本（fixture：长行、宽字符、回滚行）。
- 输出 10 秒、用户回滚 300 行，视口不动；回到底部恢复跟随。
- 20 万行滚动在 1000/5000 回滚下耗时接近常量（相对基线显著下降）。
- 1 MiB 粘贴成功，分片数正确、括号标记完整。
- 隐藏页签 DOM 写入为 0；输出帧不触发组件 render（测试计数）。
- `?2026` 中间态不绘制；`l` 或超时后绘制。
- 光标 steady/blink 与 DECSCUSR 一致；IRM 生效。

### P1：日常可用性（5–7 人日）

**交付**

1. 滚动条 overlay + 位置提示 + 拖拽/点击轨道。
2. 搜索条（smart-case、全部高亮、当前匹配、计数、Esc/Enter）。
3. copy mode（移动、选择、复制、状态栏）。
4. 选择模型改为 `seq`；双击拖动扩展、Alt 列选择（可选）。
5. 右键菜单：复制/粘贴/全选/搜索/清屏/重新连接。
6. OSC 8 链接 hover/点击 + scheme 白名单。
7. 通知/铃铛/tab 状态。
8. 焦点上报、鼠标 hover、`?1007` alternate scroll、`?9` X10。
9. 偏好存储与命令中心项（搜索、复制模式、清屏、字体缩放）。

**退出标准**

- 1000 行回滚搜索/复制可用，输出继续不漂移。
- 滚动条拖拽不改变列数、不触发 fit 循环。
- 链接只打开允许的 scheme；恶意 URI 被拒绝。
- 连续 BEL 限频；后台 tab 不抢焦点。

### P2：长期使用质量（4–6 人日）

**交付**

1. 主题：明暗 ANSI 调色板、对比度、选择/光标/搜索色、reduced motion。
2. 字体：canvas 测量、CJK/emoji fallback、缩放、DPR 取整。
3. 无障碍：屏幕文本镜像、状态 live region、焦点与键盘说明。
4. OSC 133/633 shell 集成：prompt 标记、跳转、命令输出复制、完成通知。
5. 内存：cell 对象池/属性 interning（按基准决定）、空闲压缩评估。
6. 性能 HUD + bench 脚本 + CI 门槛。
7. 可选：搜索正则（带长度/超时保护）、历史持久化原型。

**退出标准**

- 200×50/500×200 的帧预算达标；内存 ≤ 目标。
- 浅色/深色主题下 16 色对比度达标；reduced motion 下无闪烁。
- 屏幕阅读器能读到当前屏与连接/通知状态。
- 性能 HUD 能解释一次卡顿（parse/paint/backlog）。

### P3：可选扩展（研究后定）

- 分屏工作区（布局树、子终端 hold、close 传播）。
- Kitty keyboard 子集 / modifyOtherKeys。
- 历史持久化（IndexedDB、隐私提示、清理策略）。
- Agent 活动提示（OSC/静默期，非权威）。

---

## 10. 测试与验收

### 10.1 单元测试（Node）

- 解析器：CSI/OSC/DCS 拆分帧、非法序列、未知序列、参数默认值、SGR 16/256/truecolor、DEC 图形、IRM、DECSTBM、alt screen、DECSCUSR、2026、1004。
- 缓冲：环形回滚、seq 单调、淘汰、字节预算、reflow（长行/宽字符/尾部空白/多行逻辑行）、光标映射。
- damage：一次滚动只产生一个 scroll；重叠 scroll 降级 full；rows 只包含真正变化的 seq。
- 选择：正向/反向、宽字符、wrapped、淘汰钳制、输出中存活。
- 搜索：smart-case、跨行、宽字符列映射、当前匹配重校验。
- 粘贴：按 Host 预算自适应分片、片间节流、括号标记、CRLF 归一、1 MiB。
- 链接：OSC 8 开始/结束、scheme 白名单、跨格命中。
- fuzz：随机字节流不抛异常、光标不越界、单元格不出现 NaN/undefined 文本。

### 10.2 DOM/组件测试

- 行元素轮转：一次全屏滚动只重建新行，旧行元素被移动而非重写。
- 隐藏页签：`paint` 未调用、DOM 未变，可见后补画。
- 选择 overlay、滚动条拖拽、搜索高亮、右键菜单、重连按钮。
- 主题切换重绘；字体 measure 后 fit 正确。
- 无障碍镜像更新频率与内容。

### 10.3 集成测试（mock `webTerminals`）

- `snapshot` 基线、`output` 顺序、`state` 更新、`ack` 顺序。
- 序列缺口 → 重连路径。
- 输入分片顺序、resize 与输入顺序。
- `retainTabs` / close handler 不在本次改动中回归。

### 10.4 真实终端验收矩阵

| 场景 | 检查 |
| --- | --- |
| zsh + powerlevel10k | prompt 重绘无半帧、无残影；宽度变化 prompt 正确 |
| vim / lazygit / htop | 全屏进入/退出、鼠标、滚轮、窗口 resize |
| less / git diff | alternate screen、PageUp/PageDown、搜索 |
| fzf / rg --interactive | 焦点、键盘、粘贴、Ctrl-C |
| Claude Code / Codex TUI | 长时间输出、滚动回看、复制、通知 |
| 中文/emoji | 双格、ZWJ、组合字符、复制文本 |
| 1 MiB 粘贴 | 不中断、只执行一次 |
| 500×200 + 1000 行回滚 | 帧预算、内存、滚动条 |
| 浅色/深色 + 缩放 | 对比度、字体对齐、光标 |
| 屏幕阅读器 | 当前屏文本、状态播报 |

### 10.5 性能门槛

- 基准脚本固定几何和输入，输出 JSON；CI 与基线比较，阈值宽松以避免抖动。
- 行为断言优先：例如“一次滚动只产生一个 scroll damage”“隐藏页签零 DOM 写入”，比墙钟更稳定。
- 发布前跑 60 秒高负载（类似 herdr 的 `HERDR_PERF_SAMPLE_SECONDS=60`）：持续输出 + 滚动 + 搜索，观察 fps、backlog、内存增长。

---

## 11. 风险与取舍

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| reflow 与 DSH headless xterm 不完全一致 | 宽度变化后本地屏幕与 Host 快照可能有差异 | 固定 fixture + 可选交叉测试；差异明显时提示/重连；上游建议提供 resize 后快照 |
| DOM 在 500×200 下仍超预算 | 大屏卡顿 | P0 先做行复用；P2 用 HUD 验证，再评估 canvas 快路径 |
| 解析仍慢于极端输出（`yes`/大文件 cat） | backlog、Host 2 MiB 队列断开 | 快路径 + 时间片 + 明确“追赶输出”提示；不静默丢字节 |
| 搜索 1000 行成本 | 输入卡顿 | 防抖、按行缓存文本、只在需要时构建；不做正则默认 |
| 选择/搜索在淘汰时钳制 | 用户可能复制到不同内容 | 明确提示“起始行已滚出保留区”；复制前校验 textHash |
| OSC 52 / 链接 / 持久化的安全 | 剪贴板注入、钓鱼链接、密钥落盘 | 默认拒绝/询问、scheme 白名单、持久化默认关闭 |
| `?2026` 应用不发结束 | 画面冻结 | 150 ms 超时强制绘制 |
| 多终端 hold 与 close 语义 | 进程泄漏或误关 | P3 分屏前先补 hold/close 集成测试；父页签关闭传播 |
| 主题/字体 fallback 不可控 | 列错位 | canvas 测量 + 多字符采样 + 用户可调字体 |
| 与 DSH 升级的耦合 | 内部 API 变化 | 只依赖公开 `webTerminals` 契约；升级时跑契约测试 |

### 可选上游协作（不作为依赖）

如果未来 DSH 愿意开放以下能力，插件可以进一步接近 herdr：

1. **resize 后快照**或语义化行 delta（类似 `surface_delta` / `surface_scroll`），消除本地 reflow 与 Host 的差异。
2. **回滚读取接口**（按行/字节分页），让插件不必依赖完整快照。
3. **foreground process / agent 元数据**，用于权威的活动状态（仍应由 DSH 定义语义）。

在这些能力出现前，插件方案保持“客户端自足”。

---

## 12. 附录

### A. 基线测量方法

环境：Apple M1、macOS 14.5、Node v20.20.1。核心思路：

```js
const screen = createScreen({ cols: 200, rows: 50, scrollback: 1000 });
const chunk = Array.from({ length: 200 }, (_, i) =>
  `\x1b[38;5;${(i % 200) + 16}m${String(i).padStart(6)} ~/project/src \x1b[32m✓\x1b[0m build completed 中文字符测试 😀\r\n`
).join("");
// 重复 write(chunk) 直到 8 MiB，记录耗时与 RSS
```

滚动压力：120×40、每块 100 行、重复 2000 次，分别用 `scrollback=1000/5000/20000`；行 HTML：200×50 全屏重复 200 次；内存：1050 行 × 200 列后 `--expose-gc` 强制 GC 读取 RSS。

注意：这些数字用于相对比较和回归门槛，不代表真实用户负载；正式实施时应把脚本固化到仓库并在 CI 记录。

### B. herdr 参考位置

- 仓库：<https://github.com/herdrdev/herdr>，本地 `/Users/proxy/orca/herdr`
- 版本：0.9.5，提交 `e8d7d9705a7a2c89cef4dd42079379f05685af87`
- 重点文件：
  - `AGENTS.md`：状态/运行时分离、纯渲染、乘法性能路径、隐藏 pane 早退
  - `src/protocol/surface_delta.rs`、`src/protocol/surface_scroll.rs`：行级 delta 与滚动位移
  - `src/protocol/render_ansi.rs`：ANSI blit、同步输出、光标/IME
  - `src/render_signal.rs`：渲染请求合并
  - `src/terminal/history_read.rs`：回滚读取与视图相似度
  - `src/ui/scrollbar.rs`：滚动条几何
  - `src/pane/terminal.rs`、`src/pane/input.rs`、`src/pane/osc.rs`：终端模式、输入、OSC
  - `src/copy_mode.rs`、`src/selection.rs`：复制模式与选择
  - `src/terminal/state.rs`：agent 状态仲裁（插件不照搬）
  - `docs/next/website/src/content/docs/`：concepts / keyboard / session-state / agent-automation / configuration

### C. 术语

- **damage**：本帧需要处理的变更描述（滚动了多少、哪些行变了）。
- **reflow**：宽度变化后按逻辑行重新切分文本。
- **逻辑行**：被 `wrapped` 标记连接起来的多行，属于同一个视觉段落。
- **seq**：行的单调递增身份，回滚淘汰不回收；选择/搜索/锚点绑定它。
- **scrollback**：视口上方保留的历史行。
- **alt screen**：全屏程序使用的备用缓冲区，无回滚。
- **sync output**：`CSI ? 2026 h/l`，让终端把一帧作为整体提交。

---

## 13. 实施记录（2026-11-24）

本轮按 P0 + P1 的核心项改造，未修改 DSH 宿主契约：

| 项 | 状态 | 落点 |
| --- | --- | --- |
| 环形回滚 + 稳定 `seq` + 字节预算 | 完成 | `vt/screen.js` 的 `Buffer` |
| damage（rows / scrolls / bell / title）与滚动位移 | 完成 | `vt/screen.js`、`vt/render.js` |
| 宽度 reflow、宽字符、光标映射、尾部 padding 修剪 | 完成 | `vt/screen.js` |
| 快照重置解析器状态、备用屏边距/origin、双屏 seq 命名空间 | 完成 | `vt/screen.js`、`vt/body.js` |
| 区域滚动后的 seq 可寻址、回滚收缩时的光标校正 | 完成 | `vt/screen.js` |
| 行 HTML 的前导/内部空白列 | 完成 | `vt/render.js` |
| 滚动锚点、输出不踢回底部 | 完成 | `vt/body.js` |
| React 只订阅 chrome、body 直接消费帧、隐藏页签不绘制 | 完成 | `vt/body.js`、`termtab.js` |
| 自适应大粘贴分片、片间节流与括号标记 | 完成 | `vt/keys.js`、`vt/body.js` |
| IRM、DECSCUSR、`?2026`、`?1004`、`?1007`、`?9`、OSC 7/8 | 完成 | `vt/screen.js` |
| 字素簇宽度（ZWJ / 旗帜 / 肤色修饰符） | 完成 | `vt/width.js`、`vt/screen.js` |
| 搜索（smart-case、全部高亮、循环、滚动定位） | 完成 | `vt/search.js`、`vt/body.js` |
| 滚动条 overlay + 拖拽 | 完成 | `vt/render.js`、`vt/body.js`、`styles.js` |
| OSC 8 链接 hover/点击 + scheme 白名单 | 完成 | `vt/body.js` |
| copy mode（移动/选择/复制/状态栏） | 完成 | `vt/copy.js`、`vt/body.js`、`vt/render.js` |
| BEL 与 OSC 9/777 面板内通知（限频） | 完成 | `vt/body.js` |
| 明暗 ANSI 调色板、主题 token 前景/背景 | 完成 | `vt/render.js`、`vt/body.js` |
| 屏幕阅读器文本镜像、reduced motion | 完成 | `vt/body.js`、`styles.js` |
| OSC 133/633 提示符/命令标记、跳转、复制命令输出 | 完成 | `vt/body.js` |
| 页面隐藏时的系统通知回退（已授权才用） | 完成 | `vt/body.js` |
| 解析时间片 / 500×200 DOM 实测 / 分屏 / 历史持久化 | 未开始 | 路线 P2–P3 |

实施后基线（M1、Node 20.20.1、`node --expose-gc scripts/bench-terminal.mjs`）：

| 场景 | 改造前 | 改造后 |
| --- | --- | --- |
| 8 MiB 解析，1000 行回滚 | 21.8 MiB/s | 约 12–21 MiB/s（随负载波动） |
| 8 MiB 解析，5000 行回滚 | 15.1 MiB/s | 约 10–18 MiB/s（10 MiB 字节预算生效，随负载波动） |
| 20 万行滚动，20000 行回滚 | 4269 ms | 约 0.3–1.2 s（10 万行约 0.16–0.6 s） |
| 1050 行 × 200 列保留 | RSS 32.5 → 107.2 MiB | RSS 约 100–140 MiB（随 GC/几何波动），回滚字节 6.8 MiB |
| 全屏滚动绘制 | 整屏重写 | 只移动行元素 + 画新行；`stats.movedRows` 可断言 |
| 500×200 行 HTML | — | 约 1.4–1.7 ms/帧（200 行、500 列）；DOM 布局另计 |

解析吞吐与基线同量级（受机器负载影响约 12–21 MiB/s）；收益集中在滚动、内存上限、reflow 正确性和交互层。剩下的主要性能项是解析快路径/属性 interning、时间片 backlog 和 500×200 的帧预算验证，放在 P2。

本轮测试：`npm test` 全绿；`test-client.mjs` 增加 67 项终端检查（环形/伤害/reflow/字素/协议/搜索/滚动渲染/copy mode/BEL 与 OSC 9/OSC 133 命令标记/明暗调色板/无障碍镜像/body 搜索与滚动锚点/隐藏页签/大粘贴/fuzz），并新增 `scripts/bench-terminal.mjs`。

**下一步建议**：P2 优先做解析时间片与 500×200 的 DOM 帧验证；P3 再评估分屏和历史持久化。每个阶段完成后用同一套 bench 和 fixture 回归，避免“功能加了、终端变卡了”。
