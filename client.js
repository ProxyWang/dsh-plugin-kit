/**
 * Client half of dsh-plugin-kit: a "Code" tab type in the Harness
 * right sidebar.
 *
 * - 文件树：逐层展开工作区目录（fs.list / fs.read 走本包 Host 半区的私有路由）。
 * - 编辑器：虚拟滚动的代码视图，Go 语法着色、gopls 转到定义 / 引用 / 悬停文档、
 *   前进后退导航栈（VSCode 行为：点击或 ⌘/Ctrl+点击跳转，F12 / ⇧F12，
 *   Alt+←/→ 与 ⌃-/⌃⇧- 后退前进）。
 * - 变更：当前分支变更列表（git status vs HEAD + 相对基线分支的已提交变更），
 *   点击文件看 unified diff。
 *
 * 样式使用宿主 --dsw-alias-* 主题 token；不依赖任何其它 Harness 包。
 */

// GENERATED from src/client/** by scripts/build-client.mjs — edit the sources, not this file.

window.__ModuleLoader__.load({
	id: "dsh-plugin-kit",
	factory(require) {
		var module = { exports: {} };
		var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.js
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/client/react.js
var import_react = __toESM(require("react"), 1);
var { createElement: h, Fragment, useState, useEffect, useRef, useCallback, useMemo } = import_react.default;

// src/client/constants.js
var NS = "codeExplorer";
var API = "/code-explorer/api";
var TAB_ID = "dsh-plugin-kit";
var TAB_KIND = "code";
var SKILLS_TAB_ID = "dsh-plugin-kit/skills";
var SKILLS_TAB_KIND = "code-skills";
var API_TAB_ID = "dsh-plugin-kit/api";
var API_TAB_KIND = "code-api";
var DB_TAB_ID = "dsh-plugin-kit/db";
var DB_TAB_KIND = "code-db";
var RPC_TAB_ID = "dsh-plugin-kit/rpc";
var RPC_TAB_KIND = "code-rpc";
var ROW = 22;

// src/client/locale.js
var zh = {
  "browser.navigation": "网页导航",
  "browser.tools": "浏览器工具",
  "browser.bookmarkCount": "{n} 个书签 · 常用页面，随时继续",
  "browser.settingsCaption": "管理主页、起始页与收藏栏",
  "changes.copyPath": "复制路径（Alt/⌥ 点击复制仓库相对路径）",
  "changes.copyFailed": "路径复制失败，请检查剪贴板权限后重试。",
  "tree.deleteDirQuestion": "删除文件夹「{name}」？",
  "tree.deleteFileQuestion": "删除文件「{name}」？",
  "tree.deleteDirHint": "此操作会删除该目录及全部内容，无法通过本插件撤销。",
  "tree.deleteFileHint": "此操作会从磁盘删除文件，无法通过本插件撤销。",
  "tree.deleting": "正在删除…",
  "tree.confirmDelete": "确认删除",
  "drag.openHere": "松开以打开文件或查看变更 · 拖动标签可调整顺序",
  "drag.unsupported": "请拖入当前会话的文件；不支持拖入目录或其他工作区。",
  "browser.retryStorage": "重新加载书签与设置",
  "browser.external": "在系统浏览器打开",
  "browser.label": "浏览器",
  "browser.guide": "DSH 内嵌浏览器、书签收藏与主页设置",
  "browser.invalidUrl": "请输入有效的 HTTP(S) 地址，不支持带账号密码的 URL。",
  "browser.applicationOrigin": "不能在内嵌浏览器中打开 DSH 自身地址。",
  "browser.notFound": "书签已不存在，请刷新后重试。",
  "browser.duplicate": "该地址已有书签。",
  "browser.limit": "最多支持 500 个书签。",
  "browser.invalidAction": "不支持的浏览器操作。",
  "browser.conflict": "数据已在其他页面更新，已刷新列表，请检查后重新保存。",
  "browser.saved": "已保存",
  "browser.initializing": "浏览器正在初始化，请稍后重试。",
  "browser.guestGone": "浏览器进程已结束，点击刷新可重新创建页面。",
  "browser.loadFailed": "网页加载失败，请检查地址并重试。",
  "browser.back": "后退",
  "browser.forward": "前进",
  "browser.reload": "刷新网页",
  "browser.home": "主页",
  "browser.newTab": "新建标签页",
  "browser.strip": "浏览器标签",
  "browser.untitled": "新标签页",
  "browser.closeTab": "关闭标签",
  "browser.tabLimit": "最多同时打开 10 个标签",
  "browser.address": "输入网址，如 https://example.com",
  "browser.go": "前往",
  "browser.editBookmark": "编辑书签",
  "browser.bookmarkPage": "收藏当前页面",
  "browser.bookmarks": "书签管理",
  "browser.settings": "浏览器设置",
  "browser.favorites": "收藏栏",
  "browser.unknown": "网页已在框架内跳转，当前真实地址不可读取。请从地址栏重新打开后再收藏。",
  "browser.restore": "恢复上次页面",
  "browser.restoreAction": "恢复页面",
  "browser.welcome": "内嵌浏览器",
  "browser.startHint": "输入网址开始浏览，也可以从书签管理打开已保存的页面。",
  "browser.searchBookmarks": "搜索书签名称、网址或分组…",
  "browser.folder": "分组",
  "browser.allFolders": "全部分组",
  "browser.favoritesOnly": "仅收藏",
  "browser.addBookmark": "添加书签",
  "browser.noMatch": "没有匹配的书签。",
  "browser.emptyBookmarks": "还没有书签。浏览网页后点击 ☆ 收藏，或手动添加网址。",
  "browser.confirmDelete": "确认删除",
  "browser.settingsScope": "书签与这些设置保存在当前 DSH profile，由该 Host 的工具页共享。修改主页不影响已打开的网页。",
  "browser.homeUrl": "主页地址",
  "browser.startPage": "新标签起始页",
  "browser.showBookmarksBar": "显示收藏栏",
  "browser.extensions": "浏览器扩展 / 插件",
  "browser.extensionsUnavailable": "当前 DSH 桌面桥接未提供 Chrome 扩展的安装、启用或配置接口，因此此处不能安装 CRX、加载本地扩展目录或导入系统浏览器扩展。工具箱设置不等同于 Chrome 扩展管理。",
  "browser.carrier": "浏览器运行方式",
  "browser.desktopPolicy": "使用 DSH 批准的 Chromium webview。网页隔离、弹窗、下载和权限由宿主管理；浏览器登录存储当前不保证跨应用重启保留。",
  "browser.webPolicy": "当前页面使用受限 iframe。部分网站禁止嵌入；跨域跳转后可能无法读取真实地址。此插件不绕过站点限制。",
  "browser.name": "名称",
  "browser.url": "网址",
  "browser.pinFavorite": "加入收藏栏",
  "left.workspace": "工作区",
  "left.guide": "从左侧选择开发工作台、接口调试、技能或其他工具，在这里继续工作。",
  "left.openFailed": "无法切换工具",
  "api.fieldEnabled": "启用",
  "api.fieldName": "名称",
  "api.fieldValue": "值",
  "api.fieldDescription": "说明",
  "api.fieldAddHint": "在末行输入以添加 · 取消勾选可停用",
  "search.inDirectory": "在此目录中搜索",
  "search.changesPlaceholder": "在当前变更文件中搜索代码…",
  "search.noChangedFiles": "当前没有可搜索的变更文件，不会扩大到整个工作区。",
  "search.directoryPlaceholder": "留空搜索整个工作区，如 src/client",
  "search.directoryLabel": "搜索目录",
  "search.workspaceScope": "当前工作区 · 所有文件",
  "search.directoryAction": "目录内搜索",
  "search.changesHint": "仅搜索当前暂存区与工作区变更文件",
  "search.changesAction": "搜索变更内容",
  "layout.backEditor": "返回代码",
  "layout.backFiles": "文件与变更",
  "changes.compose": "提交更改",
  "changes.aiMessage": "✦ AI 生成提交信息",
  "changes.readyCount": "已暂存 {n} 个文件",
  "changes.stageBeforeCommit": "填写信息后提交",
  "changes.noFilterMatches": "没有匹配此筛选条件的文件",
  "changes.allStaged": "所有更改已暂存",
  "api.resizePanels": "调整请求与响应区域高度",
  "api.resizeHint": "拖动调整高度 · 方向键微调 · 双击恢复",
  "skills.details": "说明与安装位置",
  "type.label": "开发工作台",
  "guide.title": "开发工作台",
  "guide.description": "文件浏览、代码编辑、搜索、Git 变更与 LSP 导航",
  "command.title": "命令中心",
  "command.placeholder": "输入命令名称…",
  "command.empty": "没有匹配的命令",
  "command.files": "打开资源管理器",
  "command.changes": "打开源码管理",
  "command.search": "搜索工作区代码",
  "command.quickOpen": "快速打开文件",
  "command.outline": "打开当前文件符号",
  "command.outlineUnavailable": "当前文件没有可用的语言服务",
  "command.wrap": "切换自动换行",
  "command.toggleRail": "显示或隐藏侧栏",
  "command.refresh": "刷新工作区",
  "command.terminal": "外部终端",
  "command.replace": "查找并替换",
  "command.replaceUnavailable": "当前视图不支持替换",
  "command.problems": "问题面板",
  "command.reopenTab": "重新打开已关闭的编辑器",
  "command.closeAllTabs": "关闭全部编辑器标签",
  "toolbar.terminal": "外部终端",
  "terminal.title": "终端",
  "terminal.guide": "插件自带的终端：DSH 提供 shell 与数据流，屏幕由插件渲染",
  "terminal.connecting": "正在连接终端…",
  "terminal.failed": "终端连接失败",
  "toolbar.terminal": "终端",
  "toolbar.terminalHint": "打开插件自带终端，在会话目录启动 shell",
  "command.terminal": "终端（插件渲染）",
  "command.externalTerminal": "在系统终端中打开",
  "toolbar.externalTerminal": "外部终端",
  "toolbar.externalTerminalHint": "在系统终端（iTerm/Terminal 等）中打开当前会话目录",
  "toolbar.terminalHint": "在系统终端（iTerm/Terminal 等）中打开当前会话目录",
  "terminal.fail.noSession": "没有当前会话，无法打开终端",
  "terminal.fail.unavailable": "当前环境无法打开系统终端",
  "terminal.fail.failed": "打开系统终端失败",
  "toolbar.files": "资源管理器",
  "toolbar.changes": "变更",
  refresh: "刷新",
  "clickJump.on": "点击弹引用：开（⌘点击直接跳定义）",
  "clickJump.off": "点击弹引用：关（⌥/⌘点击打开）",
  back: "后退 (⌘[)",
  forward: "前进 (⌘])",
  "status.ready": "语言服务器就绪",
  "status.starting": "语言服务器启动中…",
  "status.off": "语言服务器未启动",
  "status.error": "语言服务器错误",
  binary: "二进制文件，无法预览",
  "image.tooBig": "图片超过 10 MB，无法预览",
  truncated: "文件过大，已截断显示",
  "changes.working": "工作区变更（相对 HEAD）",
  "changes.branch": "分支已提交变更",
  "changes.commits": "提交",
  "changes.none": "没有变更",
  "changes.notRepo": "当前工作区不是 Git 仓库",
  "changes.baseNone": "未检测到基线分支（main/master/origin/HEAD）",
  "changes.vs": "vs",
  "changes.filterPlaceholder": "筛选当前变更文件…",
  "changes.searchWorkspace": "全文搜索",
  "changes.pickRepo": "选择仓库…",
  loading: "加载中…",
  error: "失败",
  "tree.failed": "无法读取目录",
  "tree.empty": "空目录",
  "editor.placeholder": "从左侧文件树选择文件，或在“变更”中查看 diff",
  "editor.noSession": "没有可用会话：代码 IDE 需要当前会话的工作目录。",
  "jump.noCursor": "先点击一个标识符（函数/变量/类型），再触发跳转",
  "command.definition": "转到定义",
  "command.references": "查找引用",
  "jump.unsupportedFile": "这个文件类型没有语言服务器（支持 Go / TypeScript / JavaScript / Python）",
  "jump.noTarget": "未找到定义",
  "jump.busy": "语言服务器正在索引，稍后重试…",
  "jump.peekTitle": "定义",
  "jump.refsTitle": "引用",
  "jump.implTitle": "实现",
  "jump.typeTitle": "类型定义",
  nodiag: "无诊断",
  "diag.count": "诊断",
  "diff.scopeWorking": "工作区",
  "diff.scopeStaged": "暂存区 vs HEAD",
  "diff.scopeBranch": "分支",
  "diff.untracked": "未跟踪的新文件",
  "diff.deleted": "已删除",
  "diff.empty": "无差异内容",
  "diff.scopeCall": "工具调用",
  "diff.openSource": "源文件标注",
  "diff.openSourceTitle": "在源文件视图中标出变更行",
  "diff.marksChip": "变更行",
  "diff.marksClear": "点击清除变更标注",
  "diff.showHunks": "只看 diff 片段",
  "diff.toSide": "并排视图",
  "diff.toUnified": "统一视图",
  "diff.prevChange": "上一处变更",
  "diff.nextChange": "下一处变更",
  "diff.revertHunk": "回退此变更块（git apply -R，仅工作区 diff）",
  "diff.revertConfirm": "确认回退此块?",
  "diff.hunkReverted": "已回退该变更块",
  "diff.deletedLines": "行被删除 · 点击查看",
  "diff.deletedAt": "此处删除的内容",
  "changes.discard": "回退变更（恢复到 HEAD）",
  "changes.confirm": "确认回退",
  "changes.cancel": "取消",
  "changes.discarded": "已回退变更",
  "changes.discardDir": "回退该目录下全部变更",
  "changes.discardedN": "已回退 {n} 个文件",
  "changes.deleteUntracked": "删除未跟踪文件（从磁盘移除，不可通过本插件撤销）",
  "changes.deleteDir": "删除该目录及其中全部未跟踪文件",
  "changes.confirmDelete": "再次点击确认删除",
  "changes.deleted": "已从磁盘删除 {path}",
  "changes.deletedN": "已从磁盘删除 {n} 个文件",
  "changes.untrackedSkip": "{n} 个未跟踪文件无法回退——请用删除按钮（🗑）",
  "changes.toList": "平铺",
  "changes.toTree": "树状",
  "changes.staged": "暂存的变更",
  "changes.stage": "暂存变更",
  "changes.stageDir": "暂存该目录下全部变更",
  "changes.unstage": "取消暂存",
  "changes.unstageDir": "取消暂存该目录下全部变更",
  "changes.stageAll": "全部暂存",
  "changes.unstageAll": "全部取消暂存",
  "changes.commit": "提交",
  "changes.commitAll": "全部暂存并提交",
  "changes.amend": "修补上次提交",
  "changes.amendTitle": "修补上一次提交：将暂存的改动合入上次提交，并更新提交信息",
  "changes.amendCommit": "确认修补",
  "changes.commitPlaceholder": "提交信息（Enter 提交已暂存变更）",
  "changes.commitAllPlaceholder": "提交信息（Enter 将暂存全部变更并提交）",
  "changes.commitBusy": "正在提交…",
  "changes.committed": "已提交 {c}",
  "stash.title": "贮藏",
  "stash.save": "贮藏",
  "stash.saveTitle": "贮藏当前变更（工作区恢复干净）",
  "stash.toggle": "展开 / 收起贮藏列表",
  "stash.msgPlaceholder": "贮藏信息（可空，Enter 确认）",
  "stash.untracked": "含未跟踪",
  "stash.untrackedTitle": "同时贮藏未跟踪文件（git stash -u）",
  "stash.none": "没有贮藏",
  "stash.apply": "应用",
  "stash.applyTitle": "应用贮藏（保留副本）",
  "stash.pop": "弹出",
  "stash.popTitle": "应用并删除贮藏",
  "stash.drop": "删除贮藏",
  "stash.confirm": "确认删除",
  "stash.cancel": "取消",
  "stash.saved": "已贮藏",
  "stash.applied": "已应用贮藏（副本保留）",
  "stash.popped": "已弹出贮藏",
  "stash.dropped": "已删除贮藏",
  "branch.title": "切换分支",
  "branch.search": "搜索分支…",
  "branch.local": "本地分支",
  "branch.remote": "远程分支",
  "branch.current": "当前",
  "branch.none": "没有匹配的分支",
  "branch.fetch": "fetch",
  "branch.pull": "pull",
  "branch.fetchTitle": "只取远端更新并刷新 ahead/behind，不改工作区与当前分支",
  "branch.pullTitle": "fetch 后快进合并到当前分支（ff-only，分叉时拒绝）",
  "branch.push": "push",
  "branch.pushTitle": "推送当前分支到远程（无上游时自动 publish -u；绝不 force）",
  "branch.checkedOut": "已切换分支",
  "blame.toggle": "行追溯（blame）：谁在何时改的每行",
  "blame.uncommitted": "未提交",
  "history.title": "文件历史",
  "history.none": "没有提交历史（文件可能未被跟踪）",
  "tree.newFile": "新建文件",
  "tree.copyAbsolute": "复制绝对路径",
  "tree.copyRelative": "复制相对路径",
  "tree.workspaceRoot": "工作区根目录",
  "tree.copyPath": "复制路径（⌥/Alt 点击复制相对路径）",
  "tree.copied": "路径已复制",
  "tree.moved": "已移动",
  "tree.newDir": "新建文件夹",
  "tree.newFileRoot": "根目录新建文件",
  "tree.newDirRoot": "根目录新建文件夹",
  "tree.rename": "重命名",
  "tree.delete": "删除",
  "tree.created": "已创建",
  "tree.renamed": "已重命名",
  "tree.deleted": "已删除",
  "tree.badName": "名称非法（不能为空、含 / 或为 . / ..）",
  "tree.newFilePlaceholder": "新文件名…",
  "tree.newDirPlaceholder": "新文件夹名…",
  "tree.renamePlaceholder": "新名称…",
  "tree.fileWord": "文件",
  "tree.dirWord": "文件夹",
  "api.label": "接口",
  "workbench.title": "接口调试",
  "workbench.history": "历史",
  "workbench.historyHint": "HTTP 与 gRPC 的调用记录，点击恢复到对应面板",
  "workbench.http": "HTTP",
  "workbench.grpc": "gRPC",
  "workbench.httpHint": "HTTP 请求：curl 导入、环境变量、批量集合、SSE 流",
  "workbench.grpcHint": "gRPC 调用：加载工作区里的 .proto，选择方法并发送",
  "db.label": "数据库",
  "dbGuide.title": "数据库",
  "dbGuide.description": "本地 SQLite / MySQL / PostgreSQL 查询与表浏览工作台",
  "db.connect": "新建连接",
  "db.disconnect": "断开连接",
  "db.newConnection": "新建数据库连接",
  "db.driver": "驱动",
  "db.address": "连接地址",
  "db.addressPlaceholder": "postgres://user:pass@host:5432/db，或 ./app.sqlite",
  "db.detected": "自动识别",
  "db.notDetected": "无法识别：粘贴 postgres:// / mysql:// 开头的地址，或指向一个数据库文件",
  "db.advanced": "手动填写字段（高级）",
  "db.clientPath": "客户端路径（可选，keg-only / 自定义安装时填）",
  "db.testAction": "测试连接",
  "db.testOk": "连接成功 · {ms} ms",
  "db.recentConnections": "已保存的连接",
  "db.useSaved": "点一个填入表单",
  "db.needAddress": "先填连接地址",
  "db.path": "数据库文件",
  "db.host": "主机",
  "db.port": "端口",
  "db.user": "用户名",
  "db.password": "密码",
  "db.database": "数据库",
  "db.connectAction": "连接",
  "db.connections": "连接",
  "db.noConnections": "暂无连接。点「新建连接」打开一个本地库：SQLite 只需要文件路径，MySQL / PostgreSQL 需要本机装有对应命令行客户端。",
  "db.objects": "对象",
  "db.search": "筛选表名…",
  "db.notLoaded": "未加载",
  "db.tables": "表",
  "db.views": "视图",
  "db.columns": "列",
  "db.rows": "行",
  "db.affected": "行受影响",
  "db.truncated": "结果已截断",
  "db.noRows": "没有数据",
  "db.row": "行",
  "db.newQuery": "新建查询",
  "db.queryTab": "查询",
  "db.sqlPlaceholder": "输入 SQL…（⌘/Ctrl+Enter 执行）",
  "db.run": "执行",
  "db.runHint": "执行后结果会显示在这里。",
  "db.stop": "停止",
  "db.savedConnections": "已保存",
  "db.connectSaved": "连接这个保存的连接",
  "db.forget": "删除保存的连接",
  "db.remember": "保存这个连接（密码存进凭据库）",
  "db.cancelled": "已取消执行",
  "db.notRunning": "这条语句已经结束，无需取消",
  "db.cancelledClosed": "已取消：SQLite 查询无法中途中断，该连接随之关闭。",
  "db.history": "历史",
  "db.export": "导出 CSV",
  "db.refresh": "刷新结构",
  "db.filterRows": "在该表的任意列中搜索…",
  "db.sqlForTable": "生成 SQL",
  "db.noConnection": "请先选择一个连接",
  "db.welcome": "选择一个表，或新建一个查询",
  "db.welcomeHint": "左侧列出当前连接里的库、表和列。点击表名浏览数据（支持排序、筛选与分页），双击表名直接生成一条 SELECT。",
  "rpc.label": "RPC",
  "rpcGuide.title": "RPC 调试",
  "rpcGuide.description": "用工作区里的 .proto 调用 gRPC 服务（含流式）",
  "rpc.address": "服务地址",
  "rpc.proto": ".proto 文件",
  "rpc.load": "加载",
  "rpc.protoRequired": "请先填写 .proto 路径",
  "rpc.discover": "反射发现",
  "rpc.discoverHint": "向服务器索取 schema，不需要 .proto 文件",
  "rpc.addressRequired": "请先填写服务地址",
  "rpc.reflectionUnavailable": "该服务未开启反射，请改用 .proto 文件",
  "rpc.skippedServices": "部分服务没有可用的描述符，已跳过",
  "rpc.browse": "选择文件",
  "rpc.scheme": "协议（grpc 明文 / grpcs TLS）",
  "rpc.browseHint": "从工作区里挑一个 .proto 文件",
  "rpc.pickProto": "选择 .proto 文件",
  "rpc.pickPlaceholder": "搜索 .proto 文件…",
  "rpc.noProto": "工作区里没有 .proto 文件",
  "rpc.protoCount": "个 .proto 文件",
  "rpc.noProtoHint": "可以直接在输入框粘贴路径，或用「反射发现」向服务器索取 schema",
  "rpc.noMethods": "还没有解析出方法。填写 .proto 路径后点「加载」。",
  "rpc.onboardTitle": "先加载一个 .proto",
  "rpc.onboardBody": "从工作区挑一个 proto 文件，或让服务器自己报出 schema。地址只需要填 host:port。",
  "rpc.recentProtos": "最近用过",
  "rpc.noResponse": "调用后响应会显示在这里",
  "rpc.request": "请求消息",
  "rpc.response": "响应",
  "rpc.metadata": "元数据",
  "rpc.noMetadata": "没有元数据。点 ＋ 添加（如 authorization）。",
  "rpc.messages": "条消息",
  "rpc.invoke": "调用",
  "rpc.timeout": "超时",
  "rpc.insecureTls": "跳过证书校验",
  "rpc.trailers": "Trailers",
  "rpc.emptyResponse": "调用成功，但没有返回消息",
  "rpc.welcome": "选择一个方法并发起调用",
  "rpc.welcomeHint": "填写 grpc:// 或 grpcs:// 地址与工作区内的 .proto 路径，加载后从左侧选择方法。请求体是该消息的 JSON 形式，⌘/Ctrl+Enter 直接调用。",
  "apiGuide.title": "接口调试",
  "apiGuide.description": "HTTP 与 gRPC 同一个工作台：curl 导入、环境变量、批量集合与 SSE；切到 gRPC 用工作区 .proto 调服务（含流式）",
  "api.send": "发送",
  "api.sending": "发送中…",
  "api.import": "导入 curl",
  "api.importBtn": "导入",
  "api.importFailed": "集合导入失败",
  "api.importEmpty": "文档里没有可用的操作",
  "api.importPlaceholderHint": "支持 curl、.bru、OpenAPI JSON 与 Postman 集合",
  "api.importTitle": "粘贴 curl 命令一键导入",
  "api.headers": "请求头",
  "api.addHeader": "添加请求头",
  "api.params": "Query 参数",
  "api.addParam": "添加参数",
  "api.paramsHint": "与 URL 查询串双向同步；取消勾选的行不发送",
  "api.method": "请求方法",
  "api.environment": "环境变量",
  "api.requestConfig": "请求配置",
  "api.settings": "设置",
  "api.sendShortcut": "⌘ / Ctrl + Enter 发送请求",
  "api.bodyEmpty": "此请求不发送请求体",
  "api.responseEmpty": "发送请求后，在这里查看响应",
  "api.copyResponse": "复制响应",
  "api.timeout": "超时 ms",
  "api.body": "请求体",
  "api.bodyNone": "无",
  "api.bodyForm": "form-urlencoded",
  "api.bodyMultipart": "multipart 表单",
  "api.bodyRaw": "raw",
  "api.beautify": "格式化 JSON",
  "api.beautifyErr": "JSON 解析失败",
  "api.resp": "响应",
  "api.respHeaders": "响应头",
  "api.urlPlaceholder": "https://…",
  "api.err": "请求失败",
  "api.history": "历史",
  "api.saved": "收藏",
  "api.saveBtn": "☆ 收藏",
  "api.saveTitle": "收藏当前请求",
  "api.savePlaceholder": "收藏名称",
  "api.saveConfirm": "保存",
  "api.histEmpty": "暂无请求历史",
  "api.savedEmpty": "暂无收藏",
  "api.clear": "清空",
  "api.clearConfirm": "再点一次清空",
  "api.restoreTitle": "点击回填到编辑器",
  "api.delete": "删除",
  "api.copyCurl": "复制为 curl",
  "api.copied": "已复制 ✓",
  "api.env": "环境变量",
  "api.envTitle": "发送时以当前环境替换 URL、请求头与请求体中的双花括号变量；未定义的变量原样保留",
  "api.envEmpty": "暂无变量，点下方 + 添加",
  "api.addEnv": "添加变量",
  "api.code": "代码",
  "api.codeTitle": "生成代码片段（变量按当前环境解析）",
  "api.codeItemTitle": "复制到剪贴板",
  "api.auth": "认证",
  "api.authNone": "无认证",
  "api.authBearer": "Bearer Token",
  "api.authBasic": "Basic Auth",
  "api.authToken": "令牌",
  "api.authTokenPlaceholder": "粘贴 Bearer token…",
  "api.authUser": "用户名",
  "api.authPass": "密码",
  "api.authPassPlaceholder": "密码",
  "api.authHint": "发送时生成 Authorization 请求头，并覆盖请求头表中的同名项",
  "api.envSelect": "环境变量集",
  "api.envNone": "无环境",
  "api.envName": "环境名称",
  "api.envNew": "新建",
  "api.envNewTitle": "新建环境变量集",
  "api.envDelete": "删除环境",
  "api.envDeleteConfirm": "确认删除？",
  "api.envNoActive": "未选择环境。点「＋ 新建」创建，或在工具栏右侧选择。",
  "api.respBody": "响应体",
  "api.timeline": "时间线",
  "api.timelineEmpty": "发送请求后，这里显示实际发出的请求明细",
  "api.pathParams": "路径参数",
  "api.pathParamsHint": "URL 中的 :name 段；发送时以取值替换（URL 编码）",
  "api.importPlaceholder": "curl / Bruno .bru / OpenAPI JSON / Postman 集合",
  "toolrow.edit": "编辑",
  "toolrow.write": "写入",
  "toolrow.failed": "失败",
  "toolrow.running": "运行中…",
  "toolrow.nopath": "（无路径）",
  "toolrow.hint": "点击在右侧查看 diff",
  "toolbar.skills": "技能",
  "skills.nameHint": "首字符为小写字母或数字；可包含 . _ -，最多 64 个字符。",
  "skills.manager": "技能管理",
  "skills.total": "{n} 个技能",
  "skills.scope.all": "全部来源",
  "skills.scope.project": "项目技能",
  "skills.scope.user": "用户技能",
  "skills.scope.provided": "内置与插件",
  "skills.search": "搜索技能名称或说明…",
  "skills.filter": "筛选技能来源",
  "skills.createAction": "创建",
  "skills.noMatch": "没有匹配的技能，试试其他关键词或来源。",
  "skills.welcome": "浏览你的技能库",
  "skills.scopeHint": "项目技能随工作区使用；用户技能跨项目可用。内置与插件技能支持预览和查看源文件。",
  "skills.backList": "技能列表",
  "skills.copyFailed": "复制失败，请重试",
  "skills.editing": "编辑中 · ⌘ / Ctrl + S 保存",
  "skills.preview": "预览",
  "skills.source": "源文件",
  "skills.deleteQuestion": "确认删除「{name}」？",
  "skills.retry": "重试加载",
  "skills.title": "技能列表",
  "skills.project": "项目级",
  "skills.user": "用户级",
  "skills.bundled": "内置（只读）",
  "skills.other": "内置 / 插件提供（只读）",
  "skills.readonly": "只读",
  "skills.truncatedNoSave": "文件超过 1MB 已被截断，禁止保存以防丢失内容",
  "skills.truncatedChip": "已截断 · 禁止保存",
  "skills.refresh": "刷新",
  "skills.new": "新建技能",
  "skills.createPlaceholder": "技能名称，例如 my-skill",
  "skills.empty": "没有发现 skill",
  "skills.noDesc": "（无描述）",
  "skills.scopeTitle": "新建到哪个根",
  "skills.copyPath": "点击复制路径",
  "skills.pathCopied": "路径已复制",
  "skills.pick": "从列表选择一个技能，查看说明或编辑内容。",
  "skills.save": "保存",
  "skills.saved": "已保存",
  "skills.deleted": "已删除",
  "skills.dirty": "未保存",
  "skills.delete": "删除",
  "skills.deleteConfirm": "确认删除",
  "skills.cancel": "取消",
  "editor.edit": "编辑",
  "editor.save": "保存",
  "editor.cancel": "取消",
  "editor.saved": "已保存",
  "editor.conflict": "磁盘上的文件已被外部修改，保存被拒绝 — 请刷新（⟳）后重试",
  "api.extracts": "响应提取",
  "api.extractHint": "发送后把响应中的值写回当前环境，供下一个请求用 {{变量}} 引用",
  "api.extractName": "变量名",
  "api.extractSource": "来源",
  "api.extractExpr": "表达式",
  "api.addExtract": "添加提取",
  "api.extractEmpty": "还没有提取规则",
  "api.extractNoEnv": "没有激活环境：先选择或新建一个环境",
  "api.extractMissed": "未命中",
  "api.extractAllMissed": "所有提取规则都未命中，未写入环境",
  "api.extractSrc.json": "JSON 路径",
  "api.extractSrc.header": "响应头",
  "api.extractSrc.status": "状态码",
  "api.extractSrc.body": "完整正文",
  "api.extractSrc.regex": "正则捕获",
  "api.extractSrc.query": "请求查询参数",
  "api.streamTab": "事件流",
  "api.streamStop": "停止流",
  "api.streamEmpty": "当前没有在监听的事件流",
  "api.streamEmptyDone": "流已结束，未收到事件",
  "api.streamEmptyWaiting": "等待服务端事件…",
  "api.streamDropped": "早期事件已截断（仅保留尾部）",
  "api.collectionDir": "集合目录",
  "api.collectionDirPlaceholder": "相对工作区，如 collection/",
  "api.collectionLoad": "读取集合",
  "api.collectionLoadFailed": "集合读取失败",
  "api.collectionEmpty": "目录里没有可解析的 .bru 文件",
  "api.collectionSaveFailed": "集合写入失败",
  "api.collectionSerializeFailed": "无法序列化为 .bru，请检查请求字段",
  "api.saveToCollection": "同时写入集合目录（.bru）",
  "api.collectionNoSession": "集合目录功能需要当前会话的工作区",
  "api.collectionLoaded": "已导入收藏",
  "watch.external": "「{path}」在磁盘上已被外部修改（可能来自终端或 Agent）",
  "watch.reloadDiscarding": "重新加载（放弃未保存）",
  "watch.keepEditing": "保持编辑",
  "watch.compareDisk": "对比磁盘版本",
  "watch.overwriteDraft": "以草稿覆盖磁盘",
  "watch.overwriteConfirm": "确认覆盖？",
  "watch.conflictTitle": "草稿 vs 磁盘 · {path}",
  "watch.conflictIdentical": "内容一致",
  "watch.conflictIdenticalHint": "草稿与磁盘内容一致（可能只是 mtime 变化），可直接保存。",
  "editor.savedOverwrite": "已保存（覆盖了磁盘上的外部修改）",
  "watch.fileGone": "文件已从磁盘消失，编辑器保留当前内容",
  "watch.on": "实时刷新已开启：编辑器、文件树与 Git 状态会跟随磁盘变化",
  "watch.off": "实时刷新已关闭",
  "watch.unsupported": "当前平台不支持文件实时监听，已退回手动刷新（⟳）",
  "command.live": "切换实时刷新",
  "watch.state.on": "开启",
  "watch.state.off": "关闭",
  "command.wsym": "工作区符号搜索",
  "wsym.placeholder": "输入符号名称（如函数、类型）…",
  "wsym.none": "没有匹配的符号",
  "wsym.needQuery": "输入名称以搜索工作区符号",
  "command.formatOnSave": "保存时格式化",
  "editor.formatOn": "保存时格式化已开启：写入前用语言服务器格式化",
  "editor.formatOff": "保存时格式化已关闭",
  "editor.savedFormatted": "已保存并格式化",
  "editor.formatSkipped": "已保存（语言服务器未格式化该文件）",
  "command.compare": "对比两个引用…",
  "compare.title": "引用对比",
  "compare.base": "基线引用（如 main）",
  "compare.head": "目标引用（默认 HEAD）",
  "compare.run": "对比",
  "compare.busy": "对比中…",
  "compare.noRefs": "没有可见分支引用",
  "compare.none": "两个引用之间没有差异",
  "changes.conflictTitle": "冲突解决",
  "changes.continue": "继续",
  "changes.continueTitle": "所有冲突解决后完成序列器",
  "changes.abort": "中止",
  "changes.abortTitle": "放弃进行中的 cherry-pick / merge / revert",
  "changes.ours": "当前侧",
  "changes.oursTitle": "保留本分支版本并标记已解决",
  "changes.theirs": "传入侧",
  "changes.theirsTitle": "采用被合入版本并标记已解决",
  "changes.pickTitle": "Cherry-pick 到当前分支（需干净工作区）",
  "changes.pickConfirm": "再次点击确认 cherry-pick",
  "changes.picked": "已挑选 {hash}",
  "changes.pickConflicted": "冲突文件已列出，选侧后可继续",
  "changes.resolved": "{path} 已采用{side}并暂存",
  "changes.sequencerDone": "序列器已完成",
  "changes.sequencerAborted": "序列器已中止",
  "command.tasks": "运行任务…",
  "task.title": "任务",
  "task.noScripts": "package.json 里没有 scripts",
  "task.output": "任务输出",
  "task.running": "运行中",
  "task.exited": "退出码 {code}",
  "task.failed": "失败 · 退出码 {code}",
  "task.stop": "停止",
  "task.stopRequested": "已请求停止（SIGTERM）",
  "task.dropped": "早期输出已截断",
  "task.droppedHint": "缓冲区只保留尾部，更早的输出已丢弃",
  "task.jumpHint": "点击跳转到该文件位置",
  "editor.closeTab": "关闭标签（中键点击亦可）",
  "editor.dirtyGuard": "有未保存的修改 — 请先保存（⌘S）或取消（Esc）",
  "editor.dirty": "未保存",
  "editor.tooBig": "文件过大，无法编辑",
  "editor.find": "文件内查找",
  "editor.noMatch": "无匹配",
  "editor.replace": "替换",
  "editor.replaceAll": "全部替换",
  "editor.replaceToggle": "切换替换",
  "editor.replacePlaceholder": "替换为…",
  "editor.replaceOneTitle": "替换当前匹配，结果进入编辑态，⌘S 保存",
  "editor.replaceAllTitle": "替换全部匹配，结果进入编辑态，⌘S 保存",
  "editor.noClosedTabs": "没有可恢复的已关闭编辑器",
  "editor.wrap": "自动换行",
  "editor.wrapTooBig": "文件超过 {n} 行，暂不支持自动换行",
  "editor.wrapCapped": "文件过大，换行模式仅渲染前 {n} 行",
  "goto.placeholder": "跳转到行（1-{n}）",
  "goto.title": "跳转到行 (⌘G / Ctrl+G)",
  "editor.findPlaceholder": "查找…",
  "find.case": "区分大小写",
  "find.words": "全词匹配",
  "find.regex": "正则表达式",
  "find.prev": "上一个匹配",
  "find.next": "下一个匹配",
  "find.preserveCase": "替换时保留大小写 (AB)",
  "replace.replacedOne": "已替换 {n} 处，进入编辑态，⌘S 保存生效",
  "replace.replacedAll": "已替换 {n} 处，进入编辑态，⌘S 保存生效",
  "replace.noMatch": "没有可替换的匹配",
  "problems.title": "问题",
  "problems.empty": "当前文件没有诊断问题",
  "problems.filtered": "当前筛选下没有问题",
  "problems.showErr": "显示或隐藏错误",
  "problems.showWarn": "显示或隐藏警告",
  "problems.showInfo": "显示或隐藏信息",
  "tabs.close": "关闭",
  "tabs.closeOthers": "关闭其他",
  "tabs.closeRight": "关闭右侧",
  "tabs.closeAll": "全部关闭",
  "tabs.pin": "固定标签",
  "tabs.unpin": "取消固定",
  "tabs.pinned": "已固定 · 批量关闭会跳过",
  "find.badRegex": "正则无效",
  "editor.preview": "预览",
  "editor.raw": "原始",
  "editor.previewToggle": "预览 / 原始态切换",
  "skillsTab.label": "技能",
  "skillsGuide.title": "技能管理",
  "skillsGuide.description": "浏览、编辑、新建与删除已安装的 agent skills（SKILL.md）",
  "launcher.code": "开发工作台",
  "launcher.run": "终端与网页",
  "launcher.skills": "Agent 扩展",
  "launcher.more": "更多",
  "hover.loading": "…",
  close: "关闭",
  "shortcut.noSession": "请先选择会话",
  "toolbar.search": "查询",
  "search.workspaceHint": "搜索整个工作区的代码内容（文件与变更页共用）",
  "quickopen.placeholder": "输入文件名以选择（模糊匹配）",
  "quickopen.empty": "无匹配文件",
  "quickopen.loading": "索引中…",
  "search.placeholder": "全文搜索",
  "search.include": "文件过滤，如 *.go,*.ts；!前缀排除",
  "search.run": "搜索",
  "search.empty": "输入至少 2 个字符",
  "search.none": "无结果",
  "search.results": "个结果",
  "search.engine": "引擎",
  "search.truncated": "结果过多，已截断",
  "search.searching": "搜索中…",
  "search.failed": "搜索失败",
  "search.regex": "正则表达式",
  "search.words": "全词匹配",
  "search.ctx": "展开/收起上下文",
  "search.ctxLoad": "加载上下文…",
  "search.ctxFail": "无法读取上下文",
  "search.replaceToggle": "替换模式",
  "search.replacePlaceholder": "替换为…（regex 模式支持 $1 引用）",
  "search.replaceAll": "全部替换",
  "search.replaceConfirm": "确认替换 {n} 个文件？",
  "search.replaceFile": "替换此文件中的全部匹配",
  "search.replaceDone": "已替换 {hits} 处（{files} 个文件）",
  "search.replaceNone": "没有可替换的匹配",
  "search.replaceFail": "{n} 个文件替换失败",
  "search.replaceCapped": "文件过多，仅处理前 200 个",
  "search.replaceTruncated": "文件过大（读取被截断），已跳过以防丢数据",
  "peek.defs": "定义",
  "peek.refs": "引用",
  "peek.tagDef": "声明",
  "peek.empty": "未找到定义或引用",
  "peek.hint": "↑↓ 选择 · Enter 跳转 · Esc 关闭",
  "sync.fetching": "正在 fetch 远程…",
  "sync.pulling": "正在拉取（--ff-only）…",
  "sync.upToDate": "已与远程同步 ✓",
  "sync.behind": "落后 {n} 个提交 — 再点一次拉取",
  "sync.pulled": "已快进更新 {n} 个提交 ✓",
  "sync.pullFail": "拉取失败：{msg}",
  "sync.fetchFail": "fetch 失败：{msg}",
  "sync.noUpstream": "尚无上游分支；点击后 fetch 并自动关联",
  "sync.clickFetch": "点击 fetch，检查远程更新",
  "sync.clickPull": "点击拉取 {n} 个提交（仅快进，不分叉合并）",
  "sync.localAhead": "本地领先 {n}，远程无新提交",
  "sync.detached": "分离 HEAD，不能拉取",
  "sync.diverged": "本地与远程已分叉：未做任何修改（本面板只做快进拉取，请用「变更」视图核对后自行 rebase/merge）",
  "sync.pushing": "正在推送到远程…",
  "sync.pushed": "已推送到远程 ✓",
  "sync.published": "已发布分支并建立跟踪 ✓",
  "sync.pushFail": "推送失败：{msg}",
  "symbols.placeholder": "跳转到符号（函数 / 类型）",
  "symbols.none": "无匹配符号（语言服务器可能仍在索引）",
  "symbols.crumb": "当前符号 — 打开符号列表",
  "diff.scopeCommit": "提交",
  "diff.back": "返回文件",
  "changes.commitsToggle": "展开 / 收起提交列表",
  "quickopen.command": "快速打开文件（代码 IDE）"
};
var en = {
  "browser.navigation": "Page navigation",
  "browser.tools": "Browser tools",
  "browser.bookmarkCount": "{n} bookmarks · Keep useful pages close",
  "browser.settingsCaption": "Home, start page and favorites bar",
  "changes.copyPath": "Copy path (Alt-click for repository-relative path)",
  "changes.copyFailed": "Could not copy the path. Check clipboard permissions and retry.",
  "tree.deleteDirQuestion": "Delete folder “{name}”?",
  "tree.deleteFileQuestion": "Delete file “{name}”?",
  "tree.deleteDirHint": "This deletes the folder and all its contents from disk. The toolbox cannot undo this action.",
  "tree.deleteFileHint": "This deletes the file from disk. The toolbox cannot undo this action.",
  "tree.deleting": "Deleting…",
  "tree.confirmDelete": "Confirm delete",
  "drag.openHere": "Drop to open file or diff · Drag tabs to reorder",
  "drag.unsupported": "Drag a file from this session. Folders and other workspaces are not supported here.",
  "browser.retryStorage": "Reload bookmarks and settings",
  "browser.external": "Open in system browser",
  "browser.label": "Browser",
  "browser.guide": "DSH embedded browser with bookmarks and home-page settings",
  "browser.invalidUrl": "Enter a valid HTTP(S) URL without embedded credentials.",
  "browser.applicationOrigin": "The DSH application origin cannot be opened here.",
  "browser.notFound": "Bookmark no longer exists. Refresh and try again.",
  "browser.duplicate": "This URL already has a bookmark.",
  "browser.limit": "Up to 500 bookmarks are supported.",
  "browser.invalidAction": "Unsupported browser operation.",
  "browser.conflict": "Another page updated the data. The list was refreshed; review and save again.",
  "browser.saved": "Saved",
  "browser.initializing": "The browser is initializing. Try again shortly.",
  "browser.guestGone": "Browser process ended. Reload to recreate the page.",
  "browser.loadFailed": "Page failed to load. Check the URL and retry.",
  "browser.back": "Back",
  "browser.forward": "Forward",
  "browser.reload": "Reload page",
  "browser.home": "Home",
  "browser.newTab": "New tab",
  "browser.strip": "Browser tabs",
  "browser.untitled": "New tab",
  "browser.closeTab": "Close tab",
  "browser.tabLimit": "Up to 10 tabs at once",
  "browser.address": "Enter a URL, e.g. https://example.com",
  "browser.go": "Go",
  "browser.editBookmark": "Edit bookmark",
  "browser.bookmarkPage": "Bookmark current page",
  "browser.bookmarks": "Bookmarks",
  "browser.settings": "Browser settings",
  "browser.favorites": "Favorites bar",
  "browser.unknown": "The frame navigated to an unreadable address. Open a known URL before bookmarking.",
  "browser.restore": "Restore previous page",
  "browser.restoreAction": "Restore page",
  "browser.welcome": "Embedded browser",
  "browser.startHint": "Enter a URL or open a saved bookmark.",
  "browser.searchBookmarks": "Search titles, URLs or folders…",
  "browser.folder": "Folder",
  "browser.allFolders": "All folders",
  "browser.favoritesOnly": "Favorites only",
  "browser.addBookmark": "Add bookmark",
  "browser.noMatch": "No matching bookmarks.",
  "browser.emptyBookmarks": "No bookmarks yet. Click ☆ on a page or add a URL manually.",
  "browser.confirmDelete": "Confirm delete",
  "browser.settingsScope": "Bookmarks and settings persist in this DSH profile and are shared by this Host’s tool pages. Changing Home does not navigate existing pages.",
  "browser.homeUrl": "Home-page URL",
  "browser.startPage": "New-tab start page",
  "browser.showBookmarksBar": "Show favorites bar",
  "browser.extensions": "Browser extensions / plugins",
  "browser.extensionsUnavailable": "The current DSH Desktop bridge exposes no Chrome extension installation, activation or configuration API. CRX installation, unpacked extensions and system-browser extension import are unavailable. Toolbox settings are separate from Chrome extension management.",
  "browser.carrier": "Browser carrier",
  "browser.desktopPolicy": "Uses a DSH-approved Chromium webview. The host owns isolation, popups, downloads and permissions. Browser sign-in storage is not guaranteed to survive app restart.",
  "browser.webPolicy": "Uses a restricted iframe in this client. Some sites refuse embedding, and cross-origin navigation can hide the actual URL. This plugin does not bypass site restrictions.",
  "browser.name": "Name",
  "browser.url": "URL",
  "browser.pinFavorite": "Add to favorites bar",
  "left.workspace": "Workspace",
  "left.guide": "Choose Dev Workspace, API Tester, Skills or another tool on the left to work here.",
  "left.openFailed": "Could not toggle tool",
  "api.fieldEnabled": "Enabled",
  "api.fieldName": "Name",
  "api.fieldValue": "Value",
  "api.fieldDescription": "Description",
  "api.fieldAddHint": "Type in the last row to add · Uncheck to disable",
  "search.inDirectory": "Find in this directory",
  "search.changesPlaceholder": "Search code in changed files…",
  "search.noChangedFiles": "No searchable changed files. The search will not expand to the workspace.",
  "search.directoryPlaceholder": "Empty = whole workspace, e.g. src/client",
  "search.directoryLabel": "Directory",
  "search.workspaceScope": "Current workspace · All files",
  "search.directoryAction": "Search in directory",
  "search.changesHint": "Only staged and working-tree changed files",
  "search.changesAction": "Search changed content",
  "layout.backEditor": "Back to editor",
  "layout.backFiles": "Files & Changes",
  "changes.compose": "Commit changes",
  "changes.aiMessage": "✦ AI generate commit message",
  "changes.readyCount": "{n} staged files",
  "changes.stageBeforeCommit": "Write a message to commit",
  "changes.noFilterMatches": "No files match this filter",
  "changes.allStaged": "All changes are staged",
  "api.resizePanels": "Resize request and response panes",
  "api.resizeHint": "Drag to resize · Arrow keys to adjust · Double-click to reset",
  "skills.details": "Description & installation",
  "type.label": "Dev Workspace",
  "guide.title": "Dev Workspace",
  "guide.description": "Explore files, edit code, search, review Git changes, and navigate with LSP",
  "command.title": "Command Center",
  "command.placeholder": "Type a command…",
  "command.empty": "No matching commands",
  "command.files": "Open Explorer",
  "command.changes": "Open Source Control",
  "command.search": "Search Workspace",
  "command.quickOpen": "Quick Open File",
  "command.outline": "Open Current File Symbols",
  "command.outlineUnavailable": "Language services are unavailable for this file",
  "command.wrap": "Toggle Word Wrap",
  "command.toggleRail": "Toggle Side Panel",
  "command.refresh": "Refresh Workspace",
  "command.terminal": "External Terminal",
  "command.replace": "Find and Replace",
  "command.replaceUnavailable": "Replace is unavailable in the current view",
  "command.problems": "Toggle Problems",
  "command.reopenTab": "Reopen Closed Editor",
  "command.closeAllTabs": "Close All Editors",
  "toolbar.terminal": "External Terminal",
  "terminal.title": "Terminal",
  "terminal.guide": "The plugin’s own terminal: DSH runs the shell and the stream, the plugin paints the screen",
  "terminal.connecting": "Connecting to the terminal…",
  "terminal.failed": "The terminal could not connect",
  "toolbar.terminal": "Terminal",
  "toolbar.terminalHint": "Open the plugin’s terminal, running a shell in the session directory",
  "command.terminal": "Terminal (plugin-rendered)",
  "command.externalTerminal": "Open in System Terminal",
  "toolbar.externalTerminal": "External Terminal",
  "toolbar.externalTerminalHint": "Open the session directory in the system terminal (iTerm/Terminal, …)",
  "toolbar.terminalHint": "Open the session directory in the system terminal (iTerm/Terminal, …)",
  "terminal.fail.noSession": "No session is on screen to open a terminal",
  "terminal.fail.unavailable": "This environment cannot open a system terminal",
  "terminal.fail.failed": "Could not open the system terminal",
  "toolbar.files": "Explorer",
  "toolbar.changes": "Changes",
  refresh: "Refresh",
  "clickJump.on": "Click pops references: on (⌘-click jumps to definition)",
  "clickJump.off": "Click pops references: off (⌥/⌘-click opens it)",
  back: "Back (⌘[)",
  forward: "Forward (⌘])",
  "status.ready": "Language server ready",
  "status.starting": "starting language server…",
  "status.off": "language server not started",
  "status.error": "language server error",
  binary: "Binary file, no preview",
  "image.tooBig": "Image exceeds the 10 MB preview cap",
  truncated: "File too large; display truncated",
  "changes.working": "Working tree (vs HEAD)",
  "changes.branch": "Committed on branch",
  "changes.commits": "commits",
  "changes.none": "No changes",
  "changes.notRepo": "Not a Git repository",
  "changes.baseNone": "No base branch detected (main/master/origin/HEAD)",
  "changes.vs": "vs",
  "changes.filterPlaceholder": "Filter changed files…",
  "changes.searchWorkspace": "Search workspace",
  "changes.pickRepo": "Pick repository…",
  loading: "Loading…",
  error: "Failed",
  "tree.failed": "Cannot list directory",
  "tree.empty": "Empty directory",
  "editor.placeholder": "Pick a file in the tree, or open a diff under Changes",
  "editor.noSession": "No session: the code explorer needs the current session workspace.",
  "jump.noCursor": "Click an identifier first, then jump",
  "command.definition": "Go to definition",
  "command.references": "Find references",
  "jump.unsupportedFile": "No language server covers this file type (Go / TypeScript / JavaScript / Python)",
  "jump.noTarget": "no definition found",
  "jump.busy": "language server is indexing; retry shortly…",
  "jump.peekTitle": "Definition",
  "jump.refsTitle": "References",
  "jump.implTitle": "Implementation",
  "jump.typeTitle": "Type definition",
  nodiag: "No diagnostics",
  "diag.count": "diagnostics",
  "diff.scopeWorking": "Working",
  "diff.scopeStaged": "Staged vs HEAD",
  "diff.scopeBranch": "Branch",
  "diff.untracked": "untracked new file",
  "diff.deleted": "deleted",
  "diff.empty": "No diff content",
  "diff.scopeCall": "Tool call",
  "diff.openSource": "Source with marks",
  "diff.openSourceTitle": "Mark changed lines in the source view",
  "diff.marksChip": "changed",
  "diff.marksClear": "Click to clear change marks",
  "diff.showHunks": "Hunk-only diff",
  "diff.toSide": "Side-by-side view",
  "diff.toUnified": "Unified view",
  "diff.prevChange": "Previous change",
  "diff.nextChange": "Next change",
  "diff.revertHunk": "Revert this hunk (git apply -R, working diffs only)",
  "diff.revertConfirm": "Revert this hunk?",
  "diff.hunkReverted": "Hunk reverted",
  "diff.deletedLines": "deleted lines · click to view",
  "diff.deletedAt": "Deleted here",
  "changes.discard": "Discard changes (restore HEAD)",
  "changes.confirm": "Confirm",
  "changes.cancel": "Cancel",
  "changes.discarded": "Changes reverted",
  "changes.discardDir": "Discard all changes in this folder",
  "changes.discardedN": "Reverted {n} files",
  "changes.deleteUntracked": "Delete untracked file (removed from disk; not undoable here)",
  "changes.deleteDir": "Delete this folder and all its untracked files",
  "changes.confirmDelete": "Click again to confirm deletion",
  "changes.deleted": "Deleted {path} from disk",
  "changes.deletedN": "Deleted {n} files from disk",
  "changes.untrackedSkip": "{n} untracked file(s) cannot be reverted — use the delete button (🗑)",
  "changes.toList": "List",
  "changes.toTree": "Tree",
  "changes.staged": "Staged Changes",
  "changes.stage": "Stage changes",
  "changes.stageDir": "Stage all changes in this directory",
  "changes.unstage": "Unstage",
  "changes.unstageDir": "Unstage all changes in this directory",
  "changes.stageAll": "Stage All",
  "changes.unstageAll": "Unstage All",
  "changes.commit": "Commit",
  "changes.commitAll": "Stage All & Commit",
  "changes.amend": "amend",
  "changes.amendTitle": "Amend the previous commit: replaces its message with this one",
  "changes.amendCommit": "Amend Commit",
  "changes.commitPlaceholder": "Message (Enter commits the staged changes)",
  "changes.commitAllPlaceholder": "Message (Enter stages all changes and commits)",
  "changes.commitBusy": "Committing…",
  "changes.committed": "Committed {c}",
  "stash.title": "Stash",
  "stash.save": "Stash",
  "stash.saveTitle": "Stash the current changes (the working tree becomes clean)",
  "stash.toggle": "Expand / collapse the stash list",
  "stash.msgPlaceholder": "Stash message (optional, Enter to confirm)",
  "stash.untracked": "incl. untracked",
  "stash.untrackedTitle": "Also stash untracked files (git stash -u)",
  "stash.none": "No stashes",
  "stash.apply": "Apply",
  "stash.applyTitle": "Apply the stash (keeps the copy)",
  "stash.pop": "Pop",
  "stash.popTitle": "Apply and drop the stash",
  "stash.drop": "Drop stash",
  "stash.confirm": "Confirm drop",
  "stash.cancel": "Cancel",
  "stash.saved": "Changes stashed",
  "stash.applied": "Stash applied (copy kept)",
  "stash.popped": "Stash popped",
  "stash.dropped": "Stash dropped",
  "branch.title": "Switch branch",
  "branch.search": "Search branches…",
  "branch.local": "Local",
  "branch.remote": "Remote",
  "branch.current": "current",
  "branch.none": "No matching branches",
  "branch.fetch": "fetch",
  "branch.pull": "pull",
  "branch.fetchTitle": "Fetch remote updates only; refreshes ahead/behind without touching the worktree or current branch",
  "branch.pullTitle": "Fetch then fast-forward the current branch (ff-only; refuses when diverged)",
  "branch.push": "push",
  "branch.pushTitle": "Push the current branch (publishes with -u when no upstream; never force)",
  "branch.checkedOut": "Branch checked out",
  "blame.toggle": "Toggle blame: who changed each line, when",
  "blame.uncommitted": "uncommitted",
  "history.title": "File History",
  "history.none": "No commit history (file may be untracked)",
  "tree.newFile": "New file",
  "tree.copyAbsolute": "Copy absolute path",
  "tree.copyRelative": "Copy relative path",
  "tree.workspaceRoot": "Workspace root",
  "tree.copyPath": "Copy path (⌥/Alt-click copies the relative path)",
  "tree.copied": "Path copied",
  "tree.moved": "Moved",
  "tree.newDir": "New folder",
  "tree.newFileRoot": "New file at root",
  "tree.newDirRoot": "New folder at root",
  "tree.rename": "Rename",
  "tree.delete": "Delete",
  "tree.created": "Created",
  "tree.renamed": "Renamed",
  "tree.deleted": "Deleted",
  "tree.badName": "Invalid name (empty, contains /, or . / ..)",
  "tree.newFilePlaceholder": "new file name…",
  "tree.newDirPlaceholder": "new folder name…",
  "tree.renamePlaceholder": "new name…",
  "tree.fileWord": "file",
  "tree.dirWord": "folder",
  "api.label": "API",
  "workbench.title": "Request Workbench",
  "workbench.history": "History",
  "workbench.historyHint": "HTTP and gRPC calls together; pick one to restore it in its pane",
  "workbench.http": "HTTP",
  "workbench.grpc": "gRPC",
  "workbench.httpHint": "HTTP requests: curl import, environments, collections, SSE streams",
  "workbench.grpcHint": "gRPC calls: load a .proto from the workspace, pick a method, send",
  "db.label": "Database",
  "dbGuide.title": "Database",
  "dbGuide.description": "Local SQLite / MySQL / PostgreSQL workbench: browse tables and run SQL",
  "db.connect": "New connection",
  "db.disconnect": "Disconnect",
  "db.newConnection": "New database connection",
  "db.driver": "Driver",
  "db.address": "Connection address",
  "db.addressPlaceholder": "postgres://user:pass@host:5432/db, or ./app.sqlite",
  "db.detected": "Detected",
  "db.notDetected": "Not recognised: paste a postgres:// or mysql:// address, or point at a database file",
  "db.advanced": "Fill the fields by hand (advanced)",
  "db.clientPath": "Client path (optional — keg-only or custom install)",
  "db.testAction": "Test connection",
  "db.testOk": "Connected · {ms} ms",
  "db.recentConnections": "Saved connections",
  "db.useSaved": "Pick one to fill the form",
  "db.needAddress": "Enter a connection address first",
  "db.path": "Database file",
  "db.host": "Host",
  "db.port": "Port",
  "db.user": "User",
  "db.password": "Password",
  "db.database": "Database",
  "db.connectAction": "Connect",
  "db.connections": "Connections",
  "db.noConnections": "No connections yet. Use “New connection”: SQLite needs only a file path; MySQL and PostgreSQL use the CLI client installed on this machine.",
  "db.objects": "Objects",
  "db.search": "Filter tables…",
  "db.notLoaded": "not loaded",
  "db.tables": "tables",
  "db.views": "views",
  "db.columns": "columns",
  "db.rows": "rows",
  "db.affected": "rows affected",
  "db.truncated": "truncated",
  "db.noRows": "No data",
  "db.row": "row",
  "db.newQuery": "New query",
  "db.queryTab": "Query",
  "db.sqlPlaceholder": "Enter SQL… (⌘/Ctrl+Enter to run)",
  "db.run": "Run",
  "db.runHint": "Results appear here after a statement runs.",
  "db.stop": "Stop",
  "db.savedConnections": "Saved",
  "db.connectSaved": "Connect to this saved connection",
  "db.forget": "Forget this saved connection",
  "db.remember": "Remember this connection (password goes to the secret vault)",
  "db.cancelled": "Cancelled",
  "db.notRunning": "That statement already finished",
  "db.cancelledClosed": "Cancelled. A SQLite statement cannot be interrupted in place, so that connection was closed.",
  "db.history": "History",
  "db.export": "Export CSV",
  "db.refresh": "Reload schema",
  "db.filterRows": "Search every column of this table…",
  "db.sqlForTable": "Generate SQL",
  "db.noConnection": "Pick a connection first",
  "db.welcome": "Pick a table, or start a query",
  "db.welcomeHint": "The rail lists databases, tables and columns. Click a table to browse it (sort, filter, page); double-click to generate a SELECT.",
  "rpc.label": "RPC",
  "rpcGuide.title": "RPC debugging",
  "rpcGuide.description": "Call gRPC services from a workspace .proto (streaming included)",
  "rpc.address": "Server address",
  "rpc.proto": ".proto file",
  "rpc.load": "Load",
  "rpc.protoRequired": "Enter a .proto path first",
  "rpc.discover": "Discover",
  "rpc.discoverHint": "Ask the server for its schema instead of reading a .proto file",
  "rpc.addressRequired": "Enter the server address first",
  "rpc.reflectionUnavailable": "This server does not expose reflection; use a .proto file instead",
  "rpc.skippedServices": "Some services have no descriptors and were skipped",
  "rpc.browse": "Choose file",
  "rpc.scheme": "Scheme (grpc plaintext / grpcs TLS)",
  "rpc.browseHint": "Pick a .proto file from the workspace",
  "rpc.pickProto": "Choose a .proto file",
  "rpc.pickPlaceholder": "Search .proto files…",
  "rpc.noProto": "No .proto files in this workspace",
  "rpc.protoCount": ".proto files",
  "rpc.noProtoHint": "Paste a path in the field, or use Discover to ask the server for its schema",
  "rpc.noMethods": "No methods yet. Fill in the .proto path and press Load.",
  "rpc.onboardTitle": "Load a .proto to start",
  "rpc.onboardBody": "Pick a proto file from the workspace, or ask the server for its schema. The address only needs host:port.",
  "rpc.recentProtos": "Recently used",
  "rpc.noResponse": "Responses appear here after a call",
  "rpc.request": "Request message",
  "rpc.response": "Response",
  "rpc.metadata": "Metadata",
  "rpc.noMetadata": "No metadata. Press + to add one (for example authorization).",
  "rpc.messages": "messages",
  "rpc.invoke": "Invoke",
  "rpc.timeout": "Timeout",
  "rpc.insecureTls": "Skip certificate check",
  "rpc.trailers": "Trailers",
  "rpc.emptyResponse": "The call succeeded but returned no message",
  "rpc.welcome": "Pick a method and invoke it",
  "rpc.welcomeHint": "Fill in a grpc:// or grpcs:// address and a workspace .proto path, then pick a method on the left. The body is that message as JSON; ⌘/Ctrl+Enter invokes.",
  "apiGuide.title": "Request Workbench",
  "apiGuide.description": "HTTP and gRPC in one workbench: curl import, environments, collections and SSE; switch to gRPC to call a workspace .proto (streaming included)",
  "api.send": "Send",
  "api.sending": "Sending…",
  "api.import": "Import curl",
  "api.importBtn": "Import",
  "api.importFailed": "collection import failed",
  "api.importEmpty": "no operations found in the document",
  "api.importPlaceholderHint": "accepts curl, .bru, OpenAPI JSON and Postman collections",
  "api.importTitle": "Paste a curl command to import",
  "api.headers": "Headers",
  "api.addHeader": "Add header",
  "api.params": "Query Params",
  "api.addParam": "Add param",
  "api.paramsHint": "Two-way synced with the URL query string; unchecked rows are not sent",
  "api.method": "Request method",
  "api.environment": "Environment",
  "api.requestConfig": "Request configuration",
  "api.settings": "Settings",
  "api.sendShortcut": "⌘ / Ctrl + Enter to send",
  "api.bodyEmpty": "This request has no body",
  "api.responseEmpty": "Send a request to see the response here",
  "api.copyResponse": "Copy response",
  "api.timeout": "Timeout ms",
  "api.body": "Body",
  "api.bodyNone": "none",
  "api.bodyForm": "form-urlencoded",
  "api.bodyMultipart": "multipart form",
  "api.bodyRaw": "raw",
  "api.beautify": "Beautify JSON",
  "api.beautifyErr": "Invalid JSON",
  "api.resp": "Response",
  "api.respHeaders": "Headers",
  "api.urlPlaceholder": "https://…",
  "api.err": "Request failed",
  "api.history": "History",
  "api.saved": "Saved",
  "api.saveBtn": "☆ Save",
  "api.saveTitle": "Save the current request",
  "api.savePlaceholder": "Favorite name",
  "api.saveConfirm": "Save",
  "api.histEmpty": "No requests yet",
  "api.savedEmpty": "No favorites yet",
  "api.clear": "Clear",
  "api.clearConfirm": "Click again to clear",
  "api.restoreTitle": "Click to load into the editor",
  "api.delete": "Delete",
  "api.copyCurl": "Copy as curl",
  "api.copied": "Copied ✓",
  "api.env": "Environment",
  "api.envTitle": "Double-brace variables in URL, headers and body resolve from the active environment at send time; unknown names stay literal",
  "api.envEmpty": "No variables yet — add one with +",
  "api.addEnv": "Add variable",
  "api.code": "Code",
  "api.codeTitle": "Generate a code snippet (variables resolved from the active environment)",
  "api.codeItemTitle": "Copy to clipboard",
  "api.auth": "Auth",
  "api.authNone": "No Auth",
  "api.authBearer": "Bearer Token",
  "api.authBasic": "Basic Auth",
  "api.authToken": "Token",
  "api.authTokenPlaceholder": "Paste bearer token…",
  "api.authUser": "Username",
  "api.authPass": "Password",
  "api.authPassPlaceholder": "Password",
  "api.authHint": "Generates the Authorization header at send time, overriding a same-named row in Headers",
  "api.envSelect": "Environment",
  "api.envNone": "No Environment",
  "api.envNew": "New",
  "api.envNewTitle": "Create a new environment",
  "api.envName": "Environment name",
  "api.envDelete": "Delete",
  "api.envDeleteConfirm": "Confirm delete?",
  "api.envNoActive": "No environment selected. Create one with ＋ New or pick one on the tool row.",
  "api.respBody": "Body",
  "api.timeline": "Timeline",
  "api.timelineEmpty": "Send a request to see the exact wire request here",
  "api.pathParams": "Path Params",
  "api.pathParamsHint": "`:name` segments from the URL; substituted (URL-encoded) at send time",
  "api.importPlaceholder": "curl / Bruno .bru / OpenAPI JSON / Postman collection",
  "toolrow.edit": "Edit",
  "toolrow.write": "Write",
  "toolrow.failed": "failed",
  "toolrow.running": "running…",
  "toolrow.nopath": "(no path)",
  "toolrow.hint": "Click to view diff in side panel",
  "toolbar.skills": "Skills",
  "skills.nameHint": "Start with a lowercase letter or digit; use . _ - if needed, up to 64 characters.",
  "skills.manager": "Skills",
  "skills.total": "{n} skills",
  "skills.scope.all": "All sources",
  "skills.scope.project": "Project skills",
  "skills.scope.user": "User skills",
  "skills.scope.provided": "Built-in & plugins",
  "skills.search": "Search names or descriptions…",
  "skills.filter": "Filter by source",
  "skills.createAction": "Create",
  "skills.noMatch": "No matching skills. Try another keyword or source.",
  "skills.welcome": "Explore your skill library",
  "skills.scopeHint": "Project skills belong to this workspace; user skills work across projects. Built-in and plugin skills can be previewed or viewed as source.",
  "skills.backList": "Skill list",
  "skills.copyFailed": "Could not copy. Please try again.",
  "skills.editing": "Editing · ⌘ / Ctrl + S to save",
  "skills.preview": "Preview",
  "skills.source": "Source",
  "skills.deleteQuestion": "Delete “{name}”?",
  "skills.retry": "Retry loading",
  "skills.title": "SKILLS",
  "skills.project": "Project",
  "skills.user": "User",
  "skills.bundled": "Bundled (read-only)",
  "skills.other": "Bundled / plugin-provided (read-only)",
  "skills.readonly": "read-only",
  "skills.truncatedNoSave": "File exceeds 1MB and was truncated; saving is blocked to prevent data loss",
  "skills.truncatedChip": "truncated · save blocked",
  "skills.refresh": "Refresh",
  "skills.new": "New skill",
  "skills.createPlaceholder": "new skill name (kebab-case)",
  "skills.empty": "No skills found",
  "skills.noDesc": "(no description)",
  "skills.scopeTitle": "Which root to create in",
  "skills.copyPath": "Click to copy path",
  "skills.pathCopied": "Path copied",
  "skills.pick": "Select a skill to read its instructions or edit its content.",
  "skills.save": "Save",
  "skills.saved": "Saved",
  "skills.deleted": "Deleted",
  "skills.dirty": "unsaved",
  "skills.delete": "Delete",
  "skills.deleteConfirm": "Confirm delete",
  "skills.cancel": "Cancel",
  "editor.edit": "Edit",
  "editor.save": "Save",
  "editor.cancel": "Cancel",
  "editor.saved": "Saved",
  "editor.conflict": "The file changed on disk; the save was refused — refresh (⟳) and retry",
  "api.extracts": "Extracts",
  "api.extractHint": "write values from the response back into the active environment for the next request's {{var}}",
  "api.extractName": "Variable",
  "api.extractSource": "Source",
  "api.extractExpr": "Expression",
  "api.addExtract": "Add extract",
  "api.extractEmpty": "No extract rules yet",
  "api.extractNoEnv": "No active environment: pick or create one first",
  "api.extractMissed": "not found",
  "api.extractAllMissed": "No extract matched; the environment was left unchanged",
  "api.extractSrc.json": "JSON path",
  "api.extractSrc.header": "Response header",
  "api.extractSrc.status": "Status code",
  "api.extractSrc.body": "Full body",
  "api.extractSrc.regex": "Regex capture",
  "api.extractSrc.query": "Request query",
  "api.streamTab": "Events",
  "api.streamStop": "Stop stream",
  "api.streamEmpty": "No stream is being captured right now",
  "api.streamEmptyDone": "Stream ended without events",
  "api.streamEmptyWaiting": "Waiting for server events…",
  "api.streamDropped": "early events dropped (tail retained)",
  "api.collectionDir": "Collection folder",
  "api.collectionDirPlaceholder": "workspace-relative, e.g. collection/",
  "api.collectionLoad": "Load collection",
  "api.collectionLoadFailed": "collection load failed",
  "api.collectionEmpty": "no parseable .bru files in the folder",
  "api.collectionSaveFailed": "collection write failed",
  "api.collectionSerializeFailed": "could not serialize to .bru — check the request fields",
  "api.saveToCollection": "also write to the collection folder (.bru)",
  "api.collectionNoSession": "the collection folder needs a current session workspace",
  "api.collectionLoaded": "imported into favorites",
  "watch.external": "“{path}” changed on disk (a terminal or the Agent may have edited it)",
  "watch.reloadDiscarding": "Reload (discard draft)",
  "watch.keepEditing": "Keep editing",
  "watch.compareDisk": "Compare with disk",
  "watch.overwriteDraft": "Overwrite disk with draft",
  "watch.overwriteConfirm": "Confirm overwrite?",
  "watch.conflictTitle": "Draft vs disk · {path}",
  "watch.conflictIdentical": "Identical",
  "watch.conflictIdenticalHint": "The draft matches the disk content (perhaps only mtime changed); saving is safe.",
  "editor.savedOverwrite": "Saved (overwrote external disk changes)",
  "watch.fileGone": "The file disappeared from disk; the editor keeps its current content",
  "watch.on": "Live refresh on: editor, file tree and Git status follow disk changes",
  "watch.off": "Live refresh off",
  "watch.unsupported": "File watching is unsupported on this platform; falling back to manual refresh (⟳)",
  "command.live": "Toggle Live Refresh",
  "watch.state.on": "On",
  "watch.state.off": "Off",
  "command.wsym": "Search Symbols in Workspace",
  "wsym.placeholder": "Type a symbol name (function, type…)",
  "wsym.none": "No matching symbols",
  "wsym.needQuery": "Type a name to search workspace symbols",
  "command.formatOnSave": "Format On Save",
  "editor.formatOn": "Format on save on: the language server formats before writing",
  "editor.formatOff": "Format on save off",
  "editor.savedFormatted": "Saved and formatted",
  "editor.formatSkipped": "Saved (the language server did not format this file)",
  "command.compare": "Compare References…",
  "compare.title": "Compare references",
  "compare.base": "Base ref (e.g. main)",
  "compare.head": "Head ref (default HEAD)",
  "compare.run": "Compare",
  "compare.busy": "comparing…",
  "compare.noRefs": "No visible branch refs",
  "compare.none": "No differences between the two refs",
  "changes.conflictTitle": "Resolve conflicts",
  "changes.continue": "Continue",
  "changes.continueTitle": "Finish the sequencer once every conflict is resolved",
  "changes.abort": "Abort",
  "changes.abortTitle": "Abandon the in-flight cherry-pick / merge / revert",
  "changes.ours": "ours",
  "changes.oursTitle": "Keep this branch's version and mark resolved",
  "changes.theirs": "theirs",
  "changes.theirsTitle": "Take the incoming version and mark resolved",
  "changes.pickTitle": "Cherry-pick onto the current branch (clean tree required)",
  "changes.pickConfirm": "Click again to confirm the cherry-pick",
  "changes.picked": "Cherry-picked {hash}",
  "changes.pickConflicted": "conflicted files listed below — pick a side, then continue",
  "changes.resolved": "{path} resolved with {side} and staged",
  "changes.sequencerDone": "Sequencer finished",
  "changes.sequencerAborted": "Sequencer aborted",
  "command.tasks": "Run Tasks…",
  "task.title": "Tasks",
  "task.noScripts": "No scripts in package.json",
  "task.output": "Task output",
  "task.running": "running",
  "task.exited": "exit code {code}",
  "task.failed": "failed · exit {code}",
  "task.stop": "Stop",
  "task.stopRequested": "Stop requested (SIGTERM)",
  "task.dropped": "early output dropped",
  "task.droppedHint": "only the tail is retained once the buffer fills",
  "task.jumpHint": "jump to this file position",
  "editor.closeTab": "Close tab (middle-click also works)",
  "editor.dirtyGuard": "Unsaved changes — save (⌘S) or cancel (Esc) first",
  "editor.dirty": "unsaved",
  "editor.tooBig": "File too large to edit",
  "editor.find": "Find in file",
  "editor.noMatch": "No matches",
  "editor.replace": "Replace",
  "editor.replaceAll": "Replace All",
  "editor.replaceToggle": "Toggle Replace",
  "editor.replacePlaceholder": "Replace with…",
  "editor.replaceOneTitle": "Replace the current match; the result enters edit mode (⌘S to save)",
  "editor.replaceAllTitle": "Replace all matches; the result enters edit mode (⌘S to save)",
  "editor.noClosedTabs": "No closed editor to reopen",
  "editor.wrap": "Word wrap",
  "editor.wrapTooBig": "File exceeds {n} lines; word wrap unavailable",
  "editor.wrapCapped": "File too large; wrap mode renders the first {n} lines only",
  "goto.placeholder": "Go to line (1-{n})",
  "goto.title": "Go to line (⌘G / Ctrl+G)",
  "editor.findPlaceholder": "Find…",
  "find.case": "Match case",
  "find.words": "Match whole word",
  "find.regex": "Regular expression",
  "find.prev": "Previous match",
  "find.next": "Next match",
  "find.preserveCase": "Preserve Case (AB)",
  "replace.replacedOne": "Replaced {n} match — now in edit mode; ⌘S saves",
  "replace.replacedAll": "Replaced {n} matches — now in edit mode; ⌘S saves",
  "replace.noMatch": "Nothing to replace",
  "problems.title": "Problems",
  "problems.empty": "No problems detected in the open file",
  "problems.filtered": "No problems under the current filters",
  "problems.showErr": "Toggle errors",
  "problems.showWarn": "Toggle warnings",
  "problems.showInfo": "Toggle infos",
  "tabs.close": "Close",
  "tabs.closeOthers": "Close Others",
  "tabs.closeRight": "Close to the Right",
  "tabs.closeAll": "Close All",
  "tabs.pin": "Pin Tab",
  "tabs.unpin": "Unpin Tab",
  "tabs.pinned": "Pinned — bulk closes skip it",
  "find.badRegex": "Invalid regex",
  "editor.preview": "Preview",
  "editor.raw": "Raw",
  "editor.previewToggle": "Toggle preview / raw",
  "skillsTab.label": "Skills",
  "skillsGuide.title": "Skills manager",
  "skillsGuide.description": "Browse, edit, create and delete installed agent skills (SKILL.md)",
  "launcher.code": "Dev Workspace",
  "launcher.run": "Terminal & web",
  "launcher.skills": "Agent extensions",
  "launcher.more": "More",
  "hover.loading": "…",
  close: "Close",
  "shortcut.noSession": "Select a session first",
  "toolbar.search": "Search",
  "search.workspaceHint": "Search code across the workspace (shared by Files and Changes)",
  "quickopen.placeholder": "Type a file name to open (fuzzy)",
  "quickopen.empty": "No matching files",
  "quickopen.loading": "Indexing…",
  "search.placeholder": "Search across files",
  "search.include": "files filter, e.g. *.go,*.ts; ! prefix excludes",
  "search.run": "Search",
  "search.empty": "Type at least 2 characters",
  "search.none": "No results",
  "search.results": "results",
  "search.engine": "engine",
  "search.truncated": "Too many results; truncated",
  "search.searching": "Searching…",
  "search.failed": "Search failed",
  "search.regex": "Regular expression",
  "search.words": "Match whole word",
  "search.ctx": "Toggle context lines",
  "search.ctxLoad": "Loading context…",
  "search.ctxFail": "Cannot load context",
  "search.replaceToggle": "Toggle replace",
  "search.replacePlaceholder": "Replace with… ($1 refs in regex mode)",
  "search.replaceAll": "Replace All",
  "search.replaceConfirm": "Replace in {n} files?",
  "search.replaceFile": "Replace all matches in this file",
  "search.replaceDone": "Replaced {hits} occurrence(s) in {files} file(s)",
  "search.replaceNone": "No replaceable matches",
  "search.replaceFail": "{n} file(s) failed",
  "search.replaceCapped": "Too many files; processed the first 200 only",
  "search.replaceTruncated": "file too large (read was truncated); skipped to prevent data loss",
  "peek.defs": "definition",
  "peek.refs": "references",
  "peek.tagDef": "decl",
  "peek.empty": "no definition or references found",
  "peek.hint": "↑↓ select · Enter jump · Esc close",
  "sync.fetching": "fetching remote…",
  "sync.pulling": "pulling (--ff-only)…",
  "sync.upToDate": "Up to date with remote ✓",
  "sync.behind": "Behind by {n} commits — click again to pull",
  "sync.pulled": "Fast-forwarded {n} commits ✓",
  "sync.pullFail": "Pull failed: {msg}",
  "sync.fetchFail": "Fetch failed: {msg}",
  "sync.noUpstream": "No upstream branch; click to fetch and attach one",
  "sync.clickFetch": "Click to fetch remote updates",
  "sync.clickPull": "Click to pull {n} commits (fast-forward only)",
  "sync.localAhead": "Local ahead by {n}; remote has nothing new",
  "sync.detached": "Detached HEAD; cannot pull",
  "sync.diverged": "Local and remote diverged; nothing was changed (this panel only fast-forwards — rebase or merge manually after reviewing Changes)",
  "sync.pushing": "Pushing to remote…",
  "sync.pushed": "Pushed to remote ✓",
  "sync.published": "Branch published with tracking ✓",
  "sync.pushFail": "Push failed: {msg}",
  "symbols.placeholder": "Go to symbol (function / type)",
  "symbols.none": "No matching symbols (server may still be indexing)",
  "symbols.crumb": "Current symbol — open symbol list",
  "diff.scopeCommit": "Commit",
  "diff.back": "Back to file",
  "changes.commitsToggle": "Show / hide commits",
  "quickopen.command": "Quick Open File (Code IDE)"
};

// src/client/closeguard.js
var BEFORE_TOOL_CLOSE = "dsh-plugin-kit/before-tool-close";
function useToolCloseGuard({ sessionId, kind, dirty, onBlocked }) {
  const blocked = useRef(onBlocked);
  blocked.current = onBlocked;
  useEffect(() => {
    if (!sessionId || !dirty || typeof document === "undefined") return void 0;
    const beforeClose = (event) => {
      if (event.detail?.sessionId !== sessionId || event.detail?.kind !== kind) return;
      event.preventDefault();
      blocked.current?.();
    };
    document.addEventListener(BEFORE_TOOL_CLOSE, beforeClose);
    return () => document.removeEventListener(BEFORE_TOOL_CLOSE, beforeClose);
  }, [sessionId, kind, dirty]);
}
function registerToolCloseGuard(sidebarRight, kind, message, doc = document) {
  return sidebarRight.registerCloseHandler(kind, (sessionId) => {
    const event = new CustomEvent(BEFORE_TOOL_CLOSE, { cancelable: true, detail: { sessionId, kind } });
    if (!doc.dispatchEvent(event)) throw new Error(message());
  });
}

// src/client/api.js
async function api(route, body) {
  try {
    const res = await fetch(`${API}/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {})
    });
    const data = await res.json();
    return data && typeof data === "object" ? data : { ok: false, error: "bad response" };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

// src/client/highlight.js
var KEYWORDS = {
  go: new Set(
    "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false iota make len cap new append copy close delete panic recover".split(" ")
  ),
  js: new Set(
    "async await break case catch class const continue debugger default delete do else export extends finally for from function get if import instanceof let new of return set static super switch this throw try typeof var void while with yield null undefined true false".split(" ")
  ),
  py: new Set(
    "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield None True False self".split(" ")
  ),
  json: /* @__PURE__ */ new Set(["true", "false", "null"]),
  yaml: /* @__PURE__ */ new Set(["true", "false", "null"]),
  toml: /* @__PURE__ */ new Set(["true", "false"]),
  sh: new Set(
    "if then else elif fi for while until do done case esac function select in time local export readonly declare typeset unset shift exit return source alias eval exec set trap wait true false".split(" ")
  ),
  rs: new Set(
    "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while union".split(" ")
  ),
  java: new Set(
    "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed".split(" ")
  ),
  c: new Set(
    "auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while NULL true false bool".split(" ")
  ),
  sql: new Set(
    "select from where insert into values update set delete create table alter drop index view join left right inner outer full cross on group by order having limit offset distinct as and or not null is in exists between like case when then else end union all primary key foreign references default constraint unique check".split(" ")
  ),
  css: /* @__PURE__ */ new Set(["important", "media", "supports", "keyframes", "import", "charset", "namespace"])
};
var BLOCK_TYPES = /* @__PURE__ */ new Set(["string", "error", "int", "int64", "float64", "bool", "byte", "rune", "any", "interface", "struct", "map", "chan", "func", "uint", "uint64", "rune"]);
var HASH_LANGS = /* @__PURE__ */ new Set(["py", "sh", "yaml", "toml"]);
var EXT_LANG = [
  [/\.go$/, "go"],
  [/\.(ts|tsx|js|jsx|mjs|cjs)$/, "js"],
  [/\.pyi?$/, "py"],
  [/\.jsonc?$/i, "json"],
  [/\.ya?ml$/i, "yaml"],
  [/\.(sh|bash|zsh|ksh)$/, "sh"],
  [/\.toml$/i, "toml"],
  [/\.rs$/i, "rs"],
  [/\.java$/i, "java"],
  [/\.(c|h|cc|cpp|cxx|hpp)$/i, "c"],
  [/\.sql$/i, "sql"],
  [/\.css$/i, "css"]
];
function langFor(path) {
  const p = String(path);
  for (const [re, lang] of EXT_LANG) if (re.test(p)) return lang;
  return "text";
}
function buildLineStates(lines2, lang = "") {
  const states = new Uint8Array(lines2.length);
  if (HASH_LANGS.has(lang)) return states;
  let state = 0;
  for (let i = 0; i < lines2.length; i++) {
    states[i] = state;
    const line = lines2[i];
    let j = 0;
    if (state) {
      const end = line.indexOf("*/");
      if (end < 0) continue;
      state = 0;
      j = end + 2;
    }
    let inString = 0;
    for (; j < line.length; j++) {
      const c = line.charCodeAt(j);
      if (inString) {
        if (c === 92) j++;
        else if (c === inString) inString = 0;
        continue;
      }
      if (c === 34 || c === 39 || c === 96) inString = c;
      else if (c === 47 && line.charCodeAt(j + 1) === 42) {
        const end = line.indexOf("*/", j + 2);
        if (end < 0) {
          state = 1;
          break;
        }
        j = end + 1;
      } else if (c === 47 && line.charCodeAt(j + 1) === 47) break;
    }
    if (inString === 96) inString = 0;
  }
  return states;
}
var TOKEN_RE = /\/\*.*?(?:\*\/|$)|\/\/.*$|"(?:[^"\\\n]|\\.)*(?:"|$)|'(?:\\.|[^'\\\n])*'?|`[^`\n]*`?|0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*/g;
var TOKEN_RE_HASH = /#.*$|"(?:[^"\\\n]|\\.)*(?:"|$)|'(?:\\.|[^'\\\n])*'?|`[^`\n]*`?|0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*/g;
function tokenizeLine(text, lang, entryState) {
  if (lang === "text") return [{ cls: "", s: text }];
  const hash = HASH_LANGS.has(lang);
  const re = hash ? TOKEN_RE_HASH : TOKEN_RE;
  const runs = [];
  let rest = text;
  let consumed = 0;
  if (entryState === 1) {
    const end = rest.indexOf("*/");
    if (end < 0) return [{ cls: "ce-com", s: rest }];
    runs.push({ cls: "ce-com", s: rest.slice(0, end + 2) });
    consumed = end + 2;
    rest = rest.slice(end + 2);
  }
  const kws = KEYWORDS[lang] ?? KEYWORDS.js;
  const kwClass = (word) => {
    if (kws.has(word)) return "ce-kw";
    if (lang === "sql" && kws.has(word.toLowerCase())) return "ce-kw";
    if (lang === "go" && (BLOCK_TYPES.has(word) || /^[A-Z]/.test(word))) return "ce-type";
    return "ce-id";
  };
  let match;
  let index = 0;
  re.lastIndex = 0;
  const pushPlain = (chunk, base) => {
    if (!chunk) return;
    let m;
    const ident = /[A-Za-z_][A-Za-z0-9_]*/g;
    let last = 0;
    while (m = ident.exec(chunk)) {
      if (m.index > last) runs.push({ cls: "", s: chunk.slice(last, m.index) });
      const word = m[0];
      runs.push({ cls: kwClass(word), s: word, word, startCol: consumed + base + m.index + 1 });
      last = m.index + word.length;
    }
    if (last < chunk.length) runs.push({ cls: "", s: chunk.slice(last) });
  };
  while (match = re.exec(rest)) {
    if (match.index > index) pushPlain(rest.slice(index, match.index), index);
    const token = match[0];
    index = match.index + token.length;
    if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("#")) runs.push({ cls: "ce-com", s: token });
    else if (/^["'`]/.test(token)) {
      const cls = lang === "json" && /^\s*:/.test(rest.slice(index)) ? "ce-prop" : "ce-str";
      runs.push({ cls, s: token });
    } else if (/^\d/.test(token)) runs.push({ cls: "ce-num", s: token });
    else if (/^[A-Za-z_]/.test(token)) {
      runs.push({ cls: kwClass(token), s: token, word: token, startCol: consumed + match.index + 1 });
    } else runs.push({ cls: "", s: token });
  }
  pushPlain(rest.slice(index), index);
  re.lastIndex = 0;
  return runs;
}
function wordAt(text, col) {
  const ident = /[A-Za-z_][A-Za-z0-9_]*/g;
  let match;
  while (match = ident.exec(text)) {
    const start = match.index + 1;
    const end = start + match[0].length - 1;
    if (col >= start && col <= end + 1) return { word: match[0], col: start };
  }
  return null;
}

// src/client/icons.js
function svg(children, size = 16) {
  return h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, children);
}
var IconCode = ({ size }) => svg([h("path", { key: "a", d: "M9 6 3.5 12 9 18" }), h("path", { key: "b", d: "M15 6 20.5 12 15 18" })], size ?? 16);
var IconFolder = ({ open }) => svg(open ? h("path", { key: "p", d: "M3 19 6 8h13l-3 11Z M6 8V5h5l2 3" }) : h("path", { key: "p", d: "M3 6h6l2 2h10v12H3Z" }));
var IconRefresh = () => svg([h("path", { key: "p", d: "M20 12a8 8 0 1 1-2.3-5.7" }), h("path", { key: "q", d: "M20 3v5h-5" })]);
var IconTerminal = () => svg([h("rect", { key: "r", x: 2.5, y: 4, width: 19, height: 16, rx: 2 }), h("path", { key: "p", d: "M6.5 9.5 10 12.5 6.5 15.5" }), h("path", { key: "c", d: "M12.5 16h5" })]);
var IconArrowLeft = () => svg([h("path", { key: "p", d: "M20 12H5" }), h("path", { key: "q", d: "M11 6 5 12l6 6" })]);
var IconArrowRight = () => svg([h("path", { key: "p", d: "M4 12h15" }), h("path", { key: "q", d: "M13 6l6 6-6 6" })]);
var IconSearch = () => svg([h("circle", { key: "c", cx: 10.5, cy: 10.5, r: 6.5 }), h("path", { key: "p", d: "M16 16l5 5" })]);
var IconTextSearch = () => svg([h("path", { key: "a", d: "M4 5h16" }), h("path", { key: "b", d: "M4 10h11" }), h("path", { key: "c2", d: "M4 15h8" }), h("path", { key: "d", d: "M18 14.5l2.5 2.5" })]);

// src/client/terminal.js
var OPEN_DEBOUNCE_MS = 900;
function externalTerminalAvailable(desktop = globalThis.dshDesktop) {
  return Boolean(desktop);
}
function createTerminalEntry({
  call = api,
  desktop = globalThis.dshDesktop,
  now = () => Date.now(),
  debounceMs = OPEN_DEBOUNCE_MS
} = {}) {
  let openedAt = Number.NEGATIVE_INFINITY;
  const available = () => externalTerminalAvailable(desktop);
  const open = async (cwd) => {
    if (!available()) return { ok: false, reason: "unavailable" };
    if (typeof cwd !== "string" || cwd === "") return { ok: false, reason: "noSession" };
    const at = now();
    if (at - openedAt < debounceMs) return { ok: false, reason: "busy" };
    openedAt = at;
    try {
      const res = await call("terminal.open", { cwd });
      if (res && res.ok) return { ok: true, value: res.value };
      return { ok: false, reason: "failed", error: String(res?.error ?? "") };
    } catch (error) {
      return { ok: false, reason: "failed", error: String(error?.message ?? error) };
    }
  };
  return { available, open };
}
var inertTerminalEntry = {
  available: () => false,
  open: async () => ({ ok: false, reason: "unavailable" })
};

// src/client/dismiss.js
var registries = /* @__PURE__ */ new WeakMap();
function containsEvent(node, event) {
  return Boolean(node && (event.composedPath?.().includes(node) || node.contains?.(event.target)));
}
function registerDismissLayer(doc, layer) {
  let registry = registries.get(doc);
  if (!registry) {
    const layers = [];
    const top = () => [...layers].reverse().find((entry) => {
      const node = entry.node();
      return node && node.isConnected !== false && (!node.getClientRects || node.getClientRects().length > 0);
    });
    const pointer = (event) => {
      if (typeof event.button === "number" && event.button !== 0) return;
      const entry = top();
      if (!entry || containsEvent(entry.node(), event) || entry.ignore?.(event)) return;
      entry.dismiss("outside");
    };
    const key = (event) => {
      if (event.key !== "Escape" || event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
      const entry = top();
      if (!entry) return;
      const inTerminal = Boolean(event.target?.closest?.("[data-sidebar-terminal], .xterm"));
      if (!inTerminal) {
        event.preventDefault();
        event.stopPropagation();
      }
      entry.dismiss(inTerminal ? "outside" : "escape");
    };
    registry = { layers, pointer, key };
    registries.set(doc, registry);
    doc.addEventListener("pointerdown", pointer, true);
    doc.addEventListener("keydown", key, true);
  }
  registry.layers.push(layer);
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    const index = registry.layers.indexOf(layer);
    if (index >= 0) registry.layers.splice(index, 1);
    if (registry.layers.length) return;
    doc.removeEventListener("pointerdown", registry.pointer, true);
    doc.removeEventListener("keydown", registry.key, true);
    registries.delete(doc);
  };
}
function useDismissLayer({ open = true, onDismiss, ignoreSelector } = {}) {
  const ref = useRef(null);
  const latest = useRef(null);
  latest.current = { onDismiss, ignoreSelector };
  useEffect(() => {
    if (!open || typeof document === "undefined") return void 0;
    const doc = ref.current?.ownerDocument ?? document;
    const active = doc.activeElement;
    const root = ref.current?.closest?.(".ce-root");
    const previousFocus = ref.current?.contains?.(active) ? (ignoreSelector ? root?.querySelector?.(ignoreSelector) : null) ?? root?.querySelector?.(".ce-code") : active;
    return registerDismissLayer(doc, {
      node: () => ref.current,
      ignore: (event) => {
        const trigger = latest.current.ignoreSelector && event.target?.closest?.(latest.current.ignoreSelector);
        return Boolean(trigger && trigger.closest?.(".ce-root") === ref.current?.closest?.(".ce-root"));
      },
      dismiss: (reason) => {
        latest.current.onDismiss?.(reason);
        if (reason !== "escape") return;
        const active2 = doc.activeElement;
        const insideLayer = Boolean(active2 && ref.current?.contains?.(active2));
        const orphaned = active2 == null || active2 === doc.body || active2 === doc.documentElement;
        if ((insideLayer || orphaned) && previousFocus?.isConnected !== false) previousFocus?.focus?.({ preventScroll: true });
      }
    });
  }, [open]);
  return ref;
}

// src/client/diff.js
var SBS_KEY = "dsh.ce.diff.sbs.v1";
function loadSbs() {
  try {
    return localStorage.getItem(SBS_KEY) === "1";
  } catch {
    return false;
  }
}
function parseDiff(text) {
  const lines2 = text.split("\n");
  if (lines2.length > 1 && lines2[lines2.length - 1] === "") lines2.pop();
  const rows = [];
  let oldLine = 0;
  let newLine = 0;
  for (const line of lines2) {
    if (line.startsWith("@@")) {
      const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
      }
      rows.push({ kind: "hunk", text: line, newStart: match ? Number(match[2]) : void 0 });
      continue;
    }
    if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("new file") || line.startsWith("deleted file") || line.startsWith("similarity") || line.startsWith("rename")) {
      rows.push({ kind: "meta", text: line });
      continue;
    }
    if (line.startsWith("+")) {
      rows.push({ kind: "add", text: line.slice(1), newLine: newLine++ });
      continue;
    }
    if (line.startsWith("-")) {
      rows.push({ kind: "del", text: line.slice(1), oldLine: oldLine++ });
      continue;
    }
    if (line.startsWith("\\")) {
      rows.push({ kind: "meta", text: line });
      continue;
    }
    rows.push({ kind: "ctx", text: line.slice(1), oldLine: oldLine++, newLine: newLine++ });
  }
  return rows;
}
function changedNewLines(text) {
  const rows = parseDiff(text ?? "");
  const set = /* @__PURE__ */ new Set();
  for (const row of rows) {
    if (row.kind === "add" && row.newLine !== void 0) set.add(row.newLine);
  }
  return set;
}
function deletedGroups(text) {
  const rows = parseDiff(text ?? "");
  const groups = /* @__PURE__ */ new Map();
  let pending = [];
  let lastNew = 0;
  const flush = (anchor) => {
    if (pending.length === 0) return;
    const key = Math.max(1, anchor);
    const existing = groups.get(key);
    if (existing) existing.push(...pending);
    else groups.set(key, [...pending]);
    pending = [];
  };
  for (const row of rows) {
    if (row.kind === "del") {
      pending.push(row.text);
      continue;
    }
    if (row.kind === "add" || row.kind === "ctx") {
      const n = row.newLine ?? lastNew + 1;
      flush(n);
      lastNew = n;
      continue;
    }
    if (row.kind === "hunk") {
      flush(lastNew + 1);
      lastNew = row.newStart ?? lastNew;
    }
  }
  flush(lastNew + 1);
  return groups;
}
function changeBlobs(marks, delKeys) {
  const points = [];
  if (marks) for (const n of marks) points.push({ line: n, kind: "mod" });
  if (delKeys) for (const n of delKeys) points.push({ line: n, kind: "del" });
  points.sort((a, b) => a.line - b.line);
  const blobs = [];
  for (const p of points) {
    const last = blobs[blobs.length - 1];
    if (last !== void 0 && p.line - last.end <= 2) {
      last.end = Math.max(last.end, p.line);
      if (p.kind === "del") last.kind = "del";
    } else {
      blobs.push({ start: p.line, end: p.line, kind: p.kind });
    }
  }
  return blobs;
}
function pairRows(rows) {
  const out = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row.kind === "del") {
      const dels = [];
      while (i < rows.length && rows[i].kind === "del") dels.push(rows[i++]);
      const adds = [];
      while (i < rows.length && rows[i].kind === "add") adds.push(rows[i++]);
      const n = Math.max(dels.length, adds.length);
      for (let j = 0; j < n; j++) {
        const left = dels[j] ?? null;
        const right = adds[j] ?? null;
        out.push({ kind: left && right ? "mod" : left ? "del" : "add", left, right });
      }
      continue;
    }
    if (row.kind === "add") {
      out.push({ kind: "add", left: null, right: row });
      i++;
      continue;
    }
    out.push({ kind: row.kind, left: row, right: row });
    i++;
  }
  return out;
}
function diffTokens(text) {
  return text.match(/[A-Za-z0-9_$]+|\s+|[^\sA-Za-z0-9_$]/g) ?? [];
}
function intraLineDelta(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a === b) return null;
  const ta = diffTokens(a);
  const tb = diffTokens(b);
  const min = Math.min(ta.length, tb.length);
  let p = 0;
  while (p < min && ta[p] === tb[p]) p++;
  let s = 0;
  while (s < min - p && ta[ta.length - 1 - s] === tb[tb.length - 1 - s]) s++;
  let prefixLen = 0;
  for (let k = 0; k < p; k++) prefixLen += ta[k].length;
  let suffixA = 0;
  for (let k = ta.length - s; k < ta.length; k++) suffixA += ta[k].length;
  let suffixB = 0;
  for (let k = tb.length - s; k < tb.length; k++) suffixB += tb[k].length;
  const oldStart = prefixLen;
  const oldEnd = a.length - suffixA;
  const newStart = prefixLen;
  const newEnd = b.length - suffixB;
  if (oldStart === oldEnd && newStart === newEnd) return null;
  return { oldStart, oldEnd, newStart, newEnd };
}
function intraMarks(rows) {
  const marks = /* @__PURE__ */ new Map();
  let i = 0;
  while (i < rows.length) {
    if (rows[i].kind !== "del") {
      i++;
      continue;
    }
    const dels = [];
    while (i < rows.length && rows[i].kind === "del") dels.push(rows[i++]);
    const adds = [];
    while (i < rows.length && rows[i].kind === "add") adds.push(rows[i++]);
    const n = Math.min(dels.length, adds.length);
    for (let j = 0; j < n; j++) {
      const d = intraLineDelta(dels[j].text, adds[j].text);
      if (!d) continue;
      marks.set(dels[j], { start: d.oldStart, end: d.oldEnd });
      marks.set(adds[j], { start: d.newStart, end: d.newEnd });
    }
  }
  return marks;
}
function DiffView({ t, diff, onClose, onOpenSource, canSource, onRevertHunk }) {
  const rows = useMemo(() => parseDiff(diff.text ?? ""), [diff.text]);
  const shown = rows.length > 4e3 ? rows.slice(0, 4e3) : rows;
  const marks = useMemo(() => intraMarks(shown), [shown]);
  const [sbs, setSbs] = useState(loadSbs);
  const [navIdx, setNavIdx] = useState(-1);
  const [confirmHunk, setConfirmHunk] = useState(-1);
  const confirmRef = useDismissLayer({ open: confirmHunk >= 0, onDismiss: () => setConfirmHunk(-1) });
  const containerRef = useRef(null);
  const paired = useMemo(() => sbs ? pairRows(shown) : null, [sbs, shown]);
  const hunkIdxOf = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    let n = 0;
    shown.forEach((row, i) => {
      if (row.kind === "hunk") map.set(i, n++);
    });
    return map;
  }, [shown]);
  const sbsHunkIdxOf = useMemo(() => {
    if (!paired) return null;
    const map = /* @__PURE__ */ new Map();
    let n = 0;
    paired.forEach((p, i) => {
      if (p.kind === "hunk") map.set(i, n++);
    });
    return map;
  }, [paired]);
  const anchors = useMemo(() => {
    const out = [];
    if (sbs) {
      (paired ?? []).forEach((p, i) => {
        if (p.kind === "mod" || p.kind === "add" || p.kind === "del") out.push(i);
      });
      return out;
    }
    for (let i = 0; i < shown.length; i++) {
      const k = shown[i].kind;
      if ((k === "add" || k === "del") && (i === 0 || shown[i - 1].kind !== "add" && shown[i - 1].kind !== "del")) out.push(i);
    }
    return out;
  }, [sbs, paired, shown]);
  useEffect(() => {
    setNavIdx(-1);
    setConfirmHunk(-1);
  }, [diff.text, sbs]);
  const toggleSbs = () => {
    const next = !sbs;
    setSbs(next);
    try {
      localStorage.setItem(SBS_KEY, next ? "1" : "0");
    } catch {
    }
  };
  const navTo = (delta) => {
    if (anchors.length === 0) return;
    let next = navIdx + delta;
    if (next < 0) next = anchors.length - 1;
    if (next >= anchors.length) next = 0;
    setNavIdx(next);
    const c = containerRef.current;
    const node = c?.querySelector(`[data-dr="${anchors[next]}"]`);
    if (!c || !node) return;
    const nr = node.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    c.scrollTop += nr.top - cr.top - (c.clientHeight - nr.height) / 2;
  };
  const renderMarkedText = (row, withSign) => {
    const sign = withSign ? row.kind === "add" ? "+ " : row.kind === "del" ? "− " : row.kind === "hunk" ? "" : " " : "";
    const mark = marks.get(row);
    if (!mark) {
      const plain = `${sign}${row.text}`;
      return plain === "" ? " " : plain;
    }
    const cls = row.kind === "del" ? "ce-wd ce-wd-del" : "ce-wd ce-wd-add";
    const before = `${sign}${row.text.slice(0, mark.start)}`;
    const mid = row.text.slice(mark.start, mark.end);
    const after = row.text.slice(mark.end);
    return mid === "" ? [before, h("span", { key: "m", className: `${cls} ce-wd-zero` }, ""), after] : [before, h("span", { key: "m", className: cls }, mid), after];
  };
  const renderHunkRevert = (hunkIdx, headerText) => {
    if (!onRevertHunk) return null;
    if (confirmHunk === hunkIdx) {
      return h(
        "span",
        { className: "ce-hunk-confirm", ref: confirmRef },
        h("button", {
          type: "button",
          className: "ce-tool ce-tiny ce-hunk-revert-on",
          onClick: (e) => {
            e.stopPropagation();
            setConfirmHunk(-1);
            onRevertHunk(hunkIdx, headerText);
          }
        }, t("diff.revertConfirm")),
        h("button", {
          type: "button",
          className: "ce-tool ce-tiny",
          onClick: (e) => {
            e.stopPropagation();
            setConfirmHunk(-1);
          }
        }, "✕")
      );
    }
    return h("button", {
      type: "button",
      className: "ce-tool ce-tiny ce-hunk-revert",
      title: t("diff.revertHunk"),
      onClick: (e) => {
        e.stopPropagation();
        setConfirmHunk(hunkIdx);
      }
    }, "⟲");
  };
  const renderUniRow = (row, i) => {
    const clickable = Boolean(onOpenSource) && (row.newLine !== void 0 || row.oldLine !== void 0);
    return h(
      "div",
      {
        key: i,
        "data-dr": i,
        className: `ce-dline ce-dline-${row.kind}${clickable ? " ce-dline-click" : ""}${anchors[navIdx] === i ? " ce-dnav" : ""}`,
        ...clickable ? { title: t("diff.openSourceTitle"), onClick: () => onOpenSource(row.newLine ?? row.oldLine) } : {}
      },
      diff.gutter === false ? null : h("span", { className: "ce-dnum" }, row.oldLine ?? ""),
      diff.gutter === false ? null : h("span", { className: "ce-dnum" }, row.newLine ?? ""),
      h("span", { className: "ce-dtext" }, renderMarkedText(row, true)),
      row.kind === "hunk" ? renderHunkRevert(hunkIdxOf.get(i) ?? 0, row.text) : null
    );
  };
  const renderSbsRow = (p, i) => {
    const navCls = anchors[navIdx] === i ? " ce-dnav" : "";
    if (p.kind === "hunk" || p.kind === "meta") {
      return h(
        "div",
        { key: i, "data-dr": i, className: `ce-sbsrow ce-sbsrow-full ce-dline-${p.kind}${navCls}` },
        h("span", { className: "ce-sbscell" }, p.left.text === "" ? " " : p.left.text),
        p.kind === "hunk" ? renderHunkRevert(sbsHunkIdxOf?.get(i) ?? 0, p.left.text) : null
      );
    }
    const jumpLine = p.right?.newLine ?? p.left?.oldLine;
    const clickable = Boolean(onOpenSource) && jumpLine !== void 0;
    return h(
      "div",
      {
        key: i,
        "data-dr": i,
        className: `ce-sbsrow${clickable ? " ce-dline-click" : ""}${navCls}`,
        ...clickable ? { title: t("diff.openSourceTitle"), onClick: () => onOpenSource(jumpLine) } : {}
      },
      h("span", { className: "ce-sbsnum" }, p.kind === "add" ? "" : p.left?.oldLine ?? ""),
      h("span", { className: `ce-sbscell${p.kind === "del" || p.kind === "mod" ? " ce-sbs-del" : ""}${p.left === null ? " ce-sbs-empty" : ""}` }, p.left ? renderMarkedText(p.left, false) : ""),
      h("span", { className: "ce-sbsnum" }, p.kind === "del" ? "" : p.right?.newLine ?? ""),
      h("span", { className: `ce-sbscell${p.kind === "add" || p.kind === "mod" ? " ce-sbs-add" : ""}${p.right === null ? " ce-sbs-empty" : ""}` }, p.right ? renderMarkedText(p.right, false) : "")
    );
  };
  return h(
    Fragment,
    null,
    h(
      "div",
      { className: "ce-head" },
      h("button", { type: "button", className: "ce-tool ce-tiny", title: `${t("diff.back")} (Esc)`, onClick: onClose }, "←"),
      h("span", { className: "ce-head-path" }, diff.path),
      h("span", { className: "ce-chip" }, diff.scope === "commit" ? `${t("diff.scopeCommit")} ${diff.commit ?? ""}` : diff.scope === "branch" ? `${t("diff.scopeBranch")} ${diff.base ? `vs ${diff.base}` : ""}` : diff.scope === "staged" ? t("diff.scopeStaged") : diff.scope === "call" ? t("diff.scopeCall") : t("diff.scopeWorking")),
      diff.stats ? h("span", { className: "ce-chip" }, `+${diff.stats.add} −${diff.stats.del}`) : null,
      diff.untracked ? h("span", { className: "ce-chip" }, t("diff.untracked")) : null,
      diff.note ? h("span", { className: "ce-chip" }, diff.note) : null,
      h("span", { className: "ce-spacer" }),
      h("button", { type: "button", className: "ce-tool ce-tiny", title: t("diff.prevChange"), disabled: anchors.length === 0, onClick: () => navTo(-1) }, "↑"),
      h("button", { type: "button", className: "ce-tool ce-tiny", title: t("diff.nextChange"), disabled: anchors.length === 0, onClick: () => navTo(1) }, "↓"),
      h("button", { type: "button", className: `ce-tool ce-tiny${sbs ? " ce-tool-on" : ""}`, title: sbs ? t("diff.toUnified") : t("diff.toSide"), onClick: toggleSbs }, sbs ? "≡" : "▥"),
      canSource && typeof onOpenSource === "function" ? h("button", { type: "button", className: "ce-link", title: t("diff.openSourceTitle"), onClick: () => onOpenSource(null) }, t("diff.openSource")) : null
    ),
    rows.length === 0 ? h("div", { className: "ce-empty" }, diff.text === "" ? t("diff.empty") : `${t("error")}: ${diff.error ?? ""}`) : h(
      "div",
      { className: "ce-scroll ce-code-wrap" },
      h(
        "div",
        { className: "ce-code", ref: containerRef },
        sbs ? (paired ?? []).map(renderSbsRow) : shown.map(renderUniRow),
        shown.length < rows.length ? h("div", { className: "ce-dline ce-dline-meta" }, "… display truncated …") : null
      )
    )
  );
}

// src/client/markdown.js
function stripFrontmatter(text) {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return text;
  const nl = text.indexOf("\n", end + 4);
  return nl === -1 ? "" : text.slice(nl + 1);
}
var TABLE_SEP = /^[\s|:-]*-[\s|:-]*$/;
var PARA_STOP = /^(#{1,6}\s|```|>|\||[-*+]\s|\d+[.)]\s)/;
function parseMarkdown(text) {
  const lines2 = stripFrontmatter(text ?? "").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines2.length) {
    const line = lines2[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = /^```(.*)$/.exec(line);
    if (fence !== null) {
      const buf2 = [];
      i++;
      while (i < lines2.length && !/^```/.test(lines2[i])) {
        buf2.push(lines2[i]);
        i++;
      }
      i++;
      blocks.push({ kind: "code", lang: fence[1].trim(), text: buf2.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines2.length && TABLE_SEP.test(lines2[i + 1].trim())) {
      const rows = [];
      while (i < lines2.length && lines2[i].trim().startsWith("|")) {
        rows.push(lines2[i].trim());
        i++;
      }
      const cells = (r) => r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      blocks.push({ kind: "table", head: cells(rows[0]), body: rows.slice(2).map(cells) });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf2 = [];
      while (i < lines2.length && /^>\s?/.test(lines2[i])) {
        buf2.push(lines2[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: buf2.join(" ") });
      continue;
    }
    if (/^[-*+]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const ordered = /^\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines2.length) {
        const m = ordered ? /^\d+[.)]\s+(.*)$/.exec(lines2[i]) : /^[-*+]\s+(.*)$/.exec(lines2[i]);
        if (m === null) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    const buf = [line];
    i++;
    while (i < lines2.length && lines2[i].trim() !== "" && !PARA_STOP.test(lines2[i])) {
      buf.push(lines2[i]);
      i++;
    }
    blocks.push({ kind: "p", text: buf.join(" ") });
  }
  return blocks;
}
function renderInline(text, keyPrefix) {
  const re = /(`[^`]+`)|(\*\*[^*]+?\*\*)|(\*[^*]+?\*)|(\[[^\]]*?\]\([^)\s]+?\))/g;
  const nodes = [];
  let last = 0;
  let k = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${k++}`;
    if (tok.startsWith("`")) nodes.push(h("code", { key, className: "ce-md-code" }, tok.slice(1, -1)));
    else if (tok.startsWith("**")) nodes.push(h("strong", { key }, tok.slice(2, -2)));
    else if (tok.startsWith("*")) nodes.push(h("em", { key }, tok.slice(1, -1)));
    else {
      const link = /\[([^\]]*)\]\(([^)\s]+)\)/.exec(tok);
      nodes.push(h("a", { key, className: "ce-md-a", href: link ? link[2] : "#", target: "_blank", rel: "noreferrer" }, link ? link[1] : tok));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
function MarkdownView({ text }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return h(
    "div",
    { className: "ce-md" },
    blocks.map((b, i) => {
      const key = String(i);
      switch (b.kind) {
        case "h":
          return h(`h${Math.min(6, b.level)}`, { key, className: `ce-md-h ce-md-h${Math.min(6, b.level)}` }, renderInline(b.text, key));
        case "code":
          return h("pre", { key, className: "ce-md-pre" }, h("code", null, b.text));
        case "list":
          return h(b.ordered ? "ol" : "ul", { key, className: "ce-md-list" }, b.items.map((item, j) => h("li", { key: String(j) }, renderInline(item, `${key}-${j}`))));
        case "quote":
          return h("blockquote", { key, className: "ce-md-quote" }, renderInline(b.text, key));
        case "hr":
          return h("hr", { key, className: "ce-md-hr" });
        case "table":
          return h(
            "table",
            { key, className: "ce-md-table" },
            h("thead", null, h("tr", null, b.head.map((c, j) => h("th", { key: String(j) }, renderInline(c, `${key}-h${j}`))))),
            h("tbody", null, b.body.map((row, j) => h("tr", { key: String(j) }, row.map((c, q) => h("td", { key: String(q) }, renderInline(c, `${key}-r${j}-${q}`))))))
          );
        default:
          return h("p", { key, className: "ce-md-p" }, renderInline(b.text, key));
      }
    })
  );
}

// src/client/branchpick.js
function BranchPalette({ cwd, repo, current, t, onDone, onClose, onFetch, onPull, onPush, canPush }) {
  const panelRef = useDismissLayer({ onDismiss: onClose, ignoreSelector: ".ce-branch" });
  const [query, setQuery] = useState("");
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api("git.branches", repo ? { cwd, repo } : { cwd }).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setError(res.error);
        setList([]);
        return;
      }
      setList(res.value.branches ?? []);
    });
    return () => {
      alive = false;
    };
  }, [cwd, repo]);
  const filtered = useMemo(() => {
    const all = list ?? [];
    const needle = query.trim().toLowerCase();
    const hit = needle === "" ? all : all.filter((b) => b.name.toLowerCase().includes(needle));
    return hit.slice(0, 200);
  }, [list, query]);
  const checkout = (branch) => {
    if (busy || !branch) return;
    setBusy(true);
    api("git.checkout", repo ? { cwd, repo, branch } : { cwd, branch }).then((res) => {
      setBusy(false);
      const ok = res.ok && !res.value?.error;
      onDone(ok, ok ? void 0 : res.value?.error ?? res.error);
    });
  };
  const pick = (b) => checkout(b.remote ? b.name.slice(b.name.indexOf("/") + 1) : b.name);
  const onKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSel((s) => Math.min(filtered.length - 1, s + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSel((s) => Math.max(0, s - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const b = filtered[sel];
      if (b && !b.current) pick(b);
    }
  };
  const locals = filtered.filter((b) => !b.remote);
  const remotes = filtered.filter((b) => b.remote);
  let index = -1;
  const row = (b) => {
    index += 1;
    const i = index;
    return h(
      "button",
      {
        key: b.name,
        type: "button",
        className: `ce-qitem${i === sel ? " ce-qitem-sel" : ""}`,
        onClick: () => b.current ? onClose() : pick(b),
        onMouseEnter: () => setSel(i)
      },
      h("span", { className: "ce-symglyph" }, b.current ? "•" : b.remote ? "☁" : "⎇"),
      h("span", { className: "ce-qbase" }, b.name),
      b.current ? h("span", { className: "ce-qdir" }, t("branch.current")) : h("span", { className: "ce-qdir" }, b.sha)
    );
  };
  return h(
    "div",
    { className: "ce-palette ce-bp", ref: panelRef, role: "dialog", "aria-label": t("branch.title") },
    h(
      "div",
      { className: "ce-palette-head" },
      h("input", {
        className: "ce-input",
        placeholder: t("branch.search"),
        value: query,
        autoFocus: true,
        onChange: (e) => {
          setQuery(e.target.value);
          setSel(0);
        },
        onKeyDown
      }),
      h("button", { type: "button", className: "ce-bp-act", title: t("branch.fetchTitle"), disabled: busy, onClick: onFetch }, t("branch.fetch")),
      h("button", { type: "button", className: "ce-bp-act", title: t("branch.pullTitle"), disabled: busy, onClick: onPull }, t("branch.pull")),
      onPush ? h("button", { type: "button", className: "ce-bp-act ce-bp-push", title: t("branch.pushTitle"), disabled: busy || canPush === false, onClick: onPush }, t("branch.push")) : null,
      h("button", { type: "button", className: "ce-tool ce-tiny", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-palette-list ce-scroll" },
      error ? h("div", { className: "ce-note" }, error) : null,
      list === null ? h("div", { className: "ce-note" }, "…") : null,
      list !== null && filtered.length === 0 ? h("div", { className: "ce-note" }, t("branch.none")) : null,
      locals.length > 0 ? h("div", { className: "ce-section" }, t("branch.local")) : null,
      locals.map(row),
      remotes.length > 0 ? h("div", { className: "ce-section" }, t("branch.remote")) : null,
      remotes.map(row)
    )
  );
}

// src/client/pathtools.js
function relTime(epoch) {
  const days = Math.floor((Date.now() / 1e3 - (epoch || 0)) / 86400);
  if (days <= 0) return "<1d";
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 18) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}
function RelPath(cwd, path) {
  if (typeof path !== "string") return "";
  if (cwd && path.startsWith(cwd.endsWith("/") ? cwd : `${cwd}/`)) return path.slice(cwd.length + (cwd.endsWith("/") ? 0 : 1));
  return path;
}
function toAbs(cwd, path) {
  if (typeof path !== "string") return "";
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) ? path.replace(/\\/g, "/") : `${cwd.replace(/\/+$/, "")}/${path.replace(/\\/g, "/")}`;
}
function ancestorDirs(path) {
  const out = [];
  const clean = String(path ?? "");
  let idx = clean.indexOf("/");
  while (idx > 0) {
    out.push(clean.slice(0, idx));
    idx = clean.indexOf("/", idx + 1);
  }
  return out;
}
function parentDir(path) {
  const clean = String(path ?? "");
  const at = clean.lastIndexOf("/");
  return at > 0 ? clean.slice(0, at) : "";
}
function canDropInto(dragPath, targetDir) {
  const from = String(dragPath ?? "");
  const to = String(targetDir ?? "");
  if (from === "" || to === from) return false;
  if (to === parentDir(from)) return false;
  if (to === from || to.startsWith(`${from}/`)) return false;
  return true;
}

// src/client/filedrag.js
var FILE_DRAG_TYPE = "application/x-dsh-toolbox-file";
function safePath(path) {
  return typeof path === "string" && path.length > 0 && path.length < 16384 && !/[\0\r\n]/.test(path) && !path.replace(/\\/g, "/").split("/").some((part) => part === ".." || part === ".");
}
function fileDragProps({ cwd, path, source = "tree", kind = "file", scope, repo, sessionId }) {
  return {
    draggable: true,
    onDragStart(event) {
      if (!safePath(path) || !cwd) {
        event.preventDefault();
        return;
      }
      if (event.target?.closest?.("button,input,textarea,select") && event.target.closest("button,input,textarea,select") !== event.currentTarget && !event.target.closest(".ctp-entry-open")) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      const value = { version: 1, cwd, path, kind, source, ...scope ? { scope } : {}, ...repo ? { repo } : {}, ...sessionId ? { sessionId } : {} };
      event.dataTransfer.setData(FILE_DRAG_TYPE, JSON.stringify(value));
      event.dataTransfer.setData("text/plain", path);
      event.dataTransfer.effectAllowed = source === "tree" ? "copyMove" : "copy";
    }
  };
}
function hasFileDrag(transfer) {
  return Array.from(transfer?.types ?? []).includes(FILE_DRAG_TYPE);
}
function readFileDrag(transfer, cwd, sessionId) {
  try {
    const value = JSON.parse(transfer.getData(FILE_DRAG_TYPE));
    if (value.version !== 1 || value.cwd !== cwd || (sessionId || value.sessionId) && value.sessionId !== sessionId || !safePath(value.path)) return null;
    if (!["tree", "changes", "tab"].includes(value.source) || !["file", "directory"].includes(value.kind)) return null;
    if (value.source === "changes" && !["working", "staged", "branch"].includes(value.scope)) return null;
    if (value.repo && (!safePath(value.repo) || value.repo !== cwd && !value.repo.startsWith(`${cwd.replace(/\/$/, "")}/`))) return null;
    return value;
  } catch {
    return null;
  }
}
function dragFilePath(value) {
  return value.source === "changes" ? toAbs(value.repo ?? value.cwd, value.path) : value.path;
}
function reorderFileTabs(tabs, from, before) {
  if (from === before || !tabs.includes(from) || before && !tabs.includes(before)) return tabs;
  const next = tabs.filter((path) => path !== from);
  const index = before ? next.indexOf(before) : next.length;
  next.splice(index, 0, from);
  return next;
}

// src/client/hint.js
var nextHintId = 0;
var dismissCurrent = null;
function HintButton({ hint, title: _nativeTitle, ...props }) {
  const timer = useRef(null);
  const active = useRef(null);
  const hide = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const current = active.current;
    if (!current) return;
    active.current = null;
    current.node.remove();
    if (current.previous) current.target.setAttribute("aria-describedby", current.previous);
    else current.target.removeAttribute("aria-describedby");
    document.removeEventListener("scroll", hide, true);
    window.removeEventListener("resize", hide);
    if (dismissCurrent === hide) dismissCurrent = null;
  }, []);
  useEffect(() => hide, [hide]);
  const show = (event, delay) => {
    hide();
    const target = event.currentTarget;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!target.isConnected || !hint) return;
      dismissCurrent?.();
      const node = document.createElement("span");
      node.className = "ce-fast-hint";
      node.id = `ce-fast-hint-${++nextHintId}`;
      node.setAttribute("role", "tooltip");
      node.textContent = hint;
      node.style.visibility = "hidden";
      document.body.appendChild(node);
      const anchor = target.getBoundingClientRect();
      const size = node.getBoundingClientRect();
      const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - size.width / 2, window.innerWidth - size.width - 8));
      const below = anchor.bottom + 6;
      const top = below + size.height <= window.innerHeight - 8 ? below : Math.max(8, anchor.top - size.height - 6);
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
      node.style.visibility = "visible";
      active.current = { node, target, previous: target.getAttribute("aria-describedby") };
      target.setAttribute("aria-describedby", [active.current.previous, node.id].filter(Boolean).join(" "));
      dismissCurrent = hide;
      document.addEventListener("scroll", hide, true);
      window.addEventListener("resize", hide);
    }, delay);
  };
  return h("button", {
    ...props,
    "aria-label": props["aria-label"] ?? hint,
    onMouseEnter: (e) => {
      show(e, 100);
      props.onMouseEnter?.(e);
    },
    onMouseLeave: (e) => {
      hide();
      props.onMouseLeave?.(e);
    },
    onFocus: (e) => {
      show(e, 0);
      props.onFocus?.(e);
    },
    onBlur: (e) => {
      hide();
      props.onBlur?.(e);
    },
    onPointerDown: (e) => {
      hide();
      props.onPointerDown?.(e);
    },
    onClick: (e) => {
      hide();
      props.onClick?.(e);
    },
    onKeyDown: (e) => {
      if (e.key === "Escape") {
        hide();
        e.stopPropagation();
      }
      props.onKeyDown?.(e);
    }
  }, props.children);
}

// src/client/copypath.js
async function copyChangePath({ cwd, repo, path, relative = false, onNotify, t }) {
  const value = relative ? path : toAbs(repo || cwd, path);
  try {
    if (typeof globalThis.navigator?.clipboard?.writeText !== "function") throw Error("Clipboard unavailable");
    await globalThis.navigator.clipboard.writeText(value);
    onNotify?.(t("tree.copied"));
    return true;
  } catch {
    onNotify?.(t("changes.copyFailed"), "error");
    return false;
  }
}
var CopyGlyph = () => h(
  "svg",
  { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.3, "aria-hidden": true },
  h("rect", { x: 5, y: 5, width: 8, height: 9, rx: 1.2 }),
  h("path", { d: "M10 4V2H2v9h2" })
);
var CheckGlyph = () => h(
  "svg",
  { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
  h("path", { d: "M3 8.5 6.5 12 13 4.5" })
);
function CopyChangePathButton({ path, onCopyPath, t }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return h("button", {
    type: "button",
    className: `cet-act cet-copy-path${copied ? " cet-act-done" : ""}`,
    title: copied ? t("tree.copied") : t("changes.copyPath"),
    "aria-label": `${t("changes.copyPath")} · ${path}`,
    onClick: (event) => {
      event.stopPropagation();
      const done = onCopyPath?.(path, event.altKey);
      if (done && typeof done.then === "function") {
        done.then((ok) => {
          if (ok === false) return;
          setCopied(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1400);
        });
      }
    }
  }, copied ? h(CheckGlyph) : h(CopyGlyph));
}

// src/client/changetree.js
function buildTree(items) {
  const root = { name: "", dirs: /* @__PURE__ */ new Map(), files: [], count: 0 };
  for (const item of items) {
    const segments = String(item.path).split("/");
    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      let next = node.dirs.get(segments[i]);
      if (next === void 0) {
        next = { name: segments[i], dirs: /* @__PURE__ */ new Map(), files: [], count: 0 };
        node.dirs.set(segments[i], next);
      }
      node = next;
    }
    node.files.push(item);
  }
  const finalize = (node, isRoot = false) => {
    let count = node.files.length;
    for (const child of node.dirs.values()) count += finalize(child);
    while (!isRoot && node.dirs.size === 1 && node.files.length === 0) {
      const child = [...node.dirs.values()][0];
      node.name = `${node.name}/${child.name}`;
      node.dirs = child.dirs;
      node.files = child.files;
      count = child.count;
    }
    node.count = count;
    return count;
  };
  finalize(root, true);
  return root;
}
var byName = (a, b) => a.name.localeCompare(b.name);
var byPath = (a, b) => a.path.localeCompare(b.path);
function filesUnder(node) {
  const out = [];
  const stack = [node];
  while (stack.length > 0) {
    const cur = stack.pop();
    out.push(...cur.files);
    for (const child of cur.dirs.values()) stack.push(child);
  }
  return out;
}
var EXT_TINT = {
  go: "cet-go",
  md: "cet-md",
  sql: "cet-sql",
  toml: "cet-toml",
  zip: "cet-zip",
  html: "cet-html",
  js: "cet-js",
  ts: "cet-js",
  json: "cet-json",
  yml: "cet-toml",
  yaml: "cet-toml"
};
function fileTint(path) {
  const dot = path.lastIndexOf(".");
  const ext = dot > 0 ? path.slice(dot + 1).toLowerCase() : "";
  return EXT_TINT[ext] ?? "cet-file";
}
var FolderGlyph = () => h(
  "svg",
  { viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": true },
  h("path", { d: "M1.5 3h4l1.2 1.5h7.8v8.5h-13z", opacity: 0.9 })
);
var FileGlyph = () => h(
  "svg",
  { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.2, "aria-hidden": true },
  h("path", { d: "M4 1.8h5.2L12.5 5v9.2H4z" }),
  h("path", { d: "M9.2 1.8V5h3.3" })
);
function guideStyle(depth) {
  if (depth <= 0) return {};
  const images = [];
  const sizes = [];
  for (let i = 0; i < depth; i++) {
    images.push("linear-gradient(var(--dsw-alias-border-l1,#333), var(--dsw-alias-border-l1,#333))");
    sizes.push("1px 100%");
  }
  return {
    backgroundImage: images.join(","),
    backgroundSize: sizes.join(","),
    backgroundRepeat: "no-repeat",
    backgroundPosition: images.map((_, i) => `${7 + i * 14}px 0`).join(",")
  };
}
function ChangeTree({ items, onOpen, onDiscard, onDiscardDir, onDelete, onDeleteDir, onStage, onStageDir, onUnstage, onUnstageDir, keyPrefix, t, cwd, repo, scope = "working", sessionId, onCopyPath }) {
  const [collapsed, setCollapsed] = useState(() => /* @__PURE__ */ new Set());
  const [confirmPath, setConfirmPath] = useState(null);
  const [confirmDir, setConfirmDir] = useState(null);
  const confirmRef = useDismissLayer({ open: confirmPath !== null || confirmDir !== null, onDismiss: () => {
    setConfirmPath(null);
    setConfirmDir(null);
  } });
  const [deletePath, setDeletePath] = useState(null);
  const [deleteDir, setDeleteDir] = useState(null);
  const deleteRef = useDismissLayer({ open: deletePath !== null || deleteDir !== null, onDismiss: () => {
    setDeletePath(null);
    setDeleteDir(null);
  } });
  const tree = useMemo(() => buildTree(items ?? []), [items]);
  const dupNames = useMemo(() => {
    const counts = /* @__PURE__ */ new Map();
    for (const item of items ?? []) {
      const base = String(item.path).split("/").pop();
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    return counts;
  }, [items]);
  const toggle = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const rows = [];
  const walk = (node, depth, prefix) => {
    for (const dir of [...node.dirs.values()].sort(byName)) {
      const id = prefix + dir.name;
      const isCollapsed = collapsed.has(id);
      rows.push(h(
        "div",
        {
          key: `d:${keyPrefix}:${id}`,
          className: "ce-row cet-row cet-dir",
          style: { paddingLeft: `${4 + depth * 14}px`, ...guideStyle(depth) },
          title: `${dir.name}/ · ${dir.count}`,
          "aria-expanded": String(!isCollapsed),
          onClick: () => toggle(id)
        },
        h(
          "button",
          { type: "button", className: "ctp-entry-open", "aria-expanded": !isCollapsed },
          h("span", { className: `cet-tw${isCollapsed ? "" : " cet-tw-open"}` }, "▶"),
          h("span", { className: "cet-fico cet-fico-dir" }, h(FolderGlyph)),
          h("span", { className: "ce-name cet-dirname" }, dir.name)
        ),
        h(
          "span",
          { className: "cet-right" },
          onCopyPath ? h(CopyChangePathButton, { path: id, onCopyPath, t }) : null,
          onStageDir ? h("button", {
            type: "button",
            className: "cet-act",
            title: t ? t("changes.stageDir") : "stage",
            onClick: (e) => {
              e.stopPropagation();
              onStageDir(id);
            }
          }, "+") : null,
          onUnstageDir ? h("button", {
            type: "button",
            className: "cet-act",
            title: t ? t("changes.unstageDir") : "unstage",
            onClick: (e) => {
              e.stopPropagation();
              onUnstageDir(id);
            }
          }, "−") : null,
          onDiscardDir ? confirmDir === id ? h(
            "span",
            { ref: confirmRef },
            h("button", {
              type: "button",
              className: "cet-act cet-act-show cet-act-danger",
              onClick: (e) => {
                e.stopPropagation();
                setConfirmDir(null);
                onDiscardDir(filesUnder(dir));
              }
            }, t ? t("changes.confirm") : "?"),
            h("button", {
              type: "button",
              className: "cet-act cet-act-show",
              onClick: (e) => {
                e.stopPropagation();
                setConfirmDir(null);
              }
            }, t ? t("changes.cancel") : "x")
          ) : h("button", {
            type: "button",
            className: "cet-act",
            title: t ? t("changes.discardDir") : "discard",
            onClick: (e) => {
              e.stopPropagation();
              setConfirmPath(null);
              setConfirmDir(id);
            }
          }, "⟲") : null,
          onDeleteDir && filesUnder(dir).every((f) => String(f.ch) === "U") ? deleteDir === id ? h(
            "span",
            { ref: deleteRef },
            h("button", {
              type: "button",
              className: "cet-act cet-act-show cet-act-danger",
              title: t ? t("changes.confirmDelete") : "confirm delete",
              onClick: (e) => {
                e.stopPropagation();
                setDeleteDir(null);
                onDeleteDir(id, filesUnder(dir));
              }
            }, t ? t("changes.confirm") : "?"),
            h("button", {
              type: "button",
              className: "cet-act cet-act-show",
              onClick: (e) => {
                e.stopPropagation();
                setDeleteDir(null);
              }
            }, t ? t("changes.cancel") : "x")
          ) : h("button", {
            type: "button",
            className: "cet-act cet-act-delete",
            title: t ? t("changes.deleteDir") : "delete folder",
            onClick: (e) => {
              e.stopPropagation();
              setConfirmPath(null);
              setConfirmDir(null);
              setDeleteDir(id);
            }
          }, "🗑") : null,
          h("span", { className: "cet-count" }, String(dir.count))
        )
      ));
      if (!isCollapsed) walk(dir, depth + 1, `${id}/`);
    }
    for (const file of [...node.files].sort(byPath)) {
      const base = file.path.split("/").pop();
      const dirPart = file.path.slice(0, file.path.length - base.length).replace(/\/$/, "");
      const dup = (dupNames.get(base) ?? 0) > 1 && dirPart !== "";
      rows.push(h(
        "div",
        {
          key: `f:${keyPrefix}:${file.path}`,
          ...fileDragProps({ cwd, repo, path: file.path, scope, source: "changes", sessionId }),
          className: "ce-row cet-row",
          style: { paddingLeft: `${4 + depth * 14 + 14}px`, ...guideStyle(depth + 1) },
          title: file.from ? `${file.path} ← ${file.from}` : file.path,
          onClick: () => onOpen(file)
        },
        h(
          "button",
          { type: "button", className: "ctp-entry-open" },
          h("span", { className: `cet-fico ${fileTint(file.path)}` }, h(FileGlyph)),
          h(
            "span",
            { className: "ce-name" },
            base,
            dup ? h("span", { className: "cet-dirhint" }, dirPart) : null
          )
        ),
        h(
          "span",
          { className: "cet-right" },
          onCopyPath ? h(CopyChangePathButton, { path: file.path, onCopyPath, t }) : null,
          onStage ? h("button", {
            type: "button",
            className: "cet-act",
            title: t ? t("changes.stage") : "stage",
            onClick: (e) => {
              e.stopPropagation();
              onStage(file);
            }
          }, "+") : null,
          onUnstage ? h("button", {
            type: "button",
            className: "cet-act",
            title: t ? t("changes.unstage") : "unstage",
            onClick: (e) => {
              e.stopPropagation();
              onUnstage(file);
            }
          }, "−") : null,
          onDiscard && ["M", "D", "A"].includes(String(file.ch)) ? confirmPath === file.path ? h(
            "span",
            { ref: confirmRef },
            h("button", {
              type: "button",
              className: "cet-act cet-act-show cet-act-danger",
              onClick: (e) => {
                e.stopPropagation();
                setConfirmPath(null);
                onDiscard(file);
              }
            }, t ? t("changes.confirm") : "?"),
            h("button", {
              type: "button",
              className: "cet-act cet-act-show",
              onClick: (e) => {
                e.stopPropagation();
                setConfirmPath(null);
              }
            }, t ? t("changes.cancel") : "x")
          ) : h("button", {
            type: "button",
            className: "cet-act",
            title: t ? t("changes.discard") : "discard",
            onClick: (e) => {
              e.stopPropagation();
              setConfirmDir(null);
              setConfirmPath(file.path);
            }
          }, "⟲") : null,
          onDelete && String(file.ch) === "U" ? deletePath === file.path ? h(
            "span",
            { ref: deleteRef },
            h("button", {
              type: "button",
              className: "cet-act cet-act-show cet-act-danger",
              title: t ? t("changes.confirmDelete") : "confirm delete",
              onClick: (e) => {
                e.stopPropagation();
                setDeletePath(null);
                onDelete(file);
              }
            }, t ? t("changes.confirm") : "?"),
            h("button", {
              type: "button",
              className: "cet-act cet-act-show",
              onClick: (e) => {
                e.stopPropagation();
                setDeletePath(null);
              }
            }, t ? t("changes.cancel") : "x")
          ) : h("button", {
            type: "button",
            className: "cet-act cet-act-delete",
            title: t ? t("changes.deleteUntracked") : "delete file",
            onClick: (e) => {
              e.stopPropagation();
              setConfirmPath(null);
              setConfirmDir(null);
              setDeletePath(file.path);
            }
          }, "🗑") : null,
          h("span", { className: `cet-status cet-st-${String(file.ch).toLowerCase()}` }, file.ch)
        )
      ));
    }
  };
  walk(tree, 0, "");
  return h(Fragment, null, rows);
}

// src/client/treemodel.js
function createDirectoryRequests() {
  let generation = 0;
  const latest = /* @__PURE__ */ new Map();
  return {
    reset() {
      generation++;
      latest.clear();
    },
    begin(path) {
      const epoch = generation;
      const token = {};
      latest.set(path, token);
      return () => epoch === generation && latest.get(path) === token;
    }
  };
}
function uniqueDirectoryEntries(entries) {
  const seen = /* @__PURE__ */ new Set();
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    if (!entry || typeof entry.name !== "string" || !entry.name || entry.name === "." || entry.name === ".." || entry.name.includes("/") || entry.name.includes("\0") || !["file", "directory"].includes(entry.type) || seen.has(entry.name)) return false;
    seen.add(entry.name);
    return true;
  });
}

// src/client/tree.js
function TreePanel({ cwd, t, onOpenFile, activePath, revealPath, refreshKey, staleTick, staleDirs, onNotify, onDeleted, onSearchDirectory, sessionId }) {
  const [listing, setListing] = useState({});
  const [expanded, setExpanded] = useState([]);
  const [action, setAction] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deletePending = useRef(false);
  const [dragPath, setDragPath] = useState(null);
  const [dropDir, setDropDir] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [copiedPath, setCopiedPath] = useState(null);
  const copiedTimer = useRef(null);
  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);
  const railRef = useRef(null);
  const contextMenuRef = useDismissLayer({ open: Boolean(contextMenu), onDismiss: () => setContextMenu(null) });
  const deleteRef = useDismissLayer({ open: action?.kind === "delete", onDismiss: () => {
    if (!deletePending.current) {
      setAction(null);
      setDeleteError("");
    }
  }, ignoreSelector: '[data-ce-popup-trigger="tree-delete"]' });
  const lastRevealed = useRef(null);
  const revealTick = useRef(null);
  const requestsRef = useRef(null);
  if (requestsRef.current === null) requestsRef.current = createDirectoryRequests();
  const loadDir = useCallback((path) => {
    const isCurrent = requestsRef.current.begin(path);
    setListing((current) => current[path]?.entries ? current : { ...current, [path]: { loading: true } });
    api("fs.list", { cwd, path }).then((res) => {
      if (!isCurrent()) return;
      setListing((current) => {
        if (!res.ok) return current[path]?.entries ? current : { ...current, [path]: { error: res.error } };
        return { ...current, [path]: res.value };
      });
    });
  }, [cwd]);
  useEffect(() => {
    requestsRef.current.reset();
    setListing({});
    setExpanded([]);
    setAction(null);
    setContextMenu(null);
    loadDir("");
  }, [cwd, refreshKey, loadDir]);
  const listingRef = useRef(listing);
  listingRef.current = listing;
  const lastStaleTick = useRef(0);
  useEffect(() => {
    if (!staleTick || staleTick === lastStaleTick.current) return;
    lastStaleTick.current = staleTick;
    const dirs = new Set(Array.isArray(staleDirs) ? staleDirs : []);
    dirs.add("");
    for (const d of dirs) if (listingRef.current[d]?.entries) loadDir(d);
  }, [staleTick, staleDirs, loadDir]);
  useEffect(() => {
    const p = typeof revealPath === "string" && revealPath !== "" ? revealPath : null;
    if (!p) return;
    const tick = `${refreshKey}`;
    if (p === lastRevealed.current && tick === revealTick.current) return;
    lastRevealed.current = p;
    revealTick.current = tick;
    const chain = ancestorDirs(p);
    if (chain.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const d of chain) next.add(d);
      return [...next];
    });
    for (const d of chain) loadDir(d);
  }, [revealPath, refreshKey, loadDir]);
  useEffect(() => {
    const p = typeof revealPath === "string" && revealPath !== "" ? revealPath : null;
    if (!p || typeof CSS === "undefined") return void 0;
    const raf = requestAnimationFrame(() => {
      try {
        railRef.current?.querySelector(`[data-tp="${CSS.escape(p)}"]`)?.scrollIntoView({ block: "nearest" });
      } catch {
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [revealPath, listing, expanded]);
  const toggle = (path) => {
    if (expanded.includes(path)) {
      setExpanded(expanded.filter((p) => p !== path));
      return;
    }
    setExpanded([...expanded, path]);
    if (listing[path] === void 0) loadDir(path);
  };
  const parentOf = (path) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const finish = (res, okMsg, touchedDir) => {
    if (!res.ok || res.value?.error) {
      onNotify?.(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
      return;
    }
    onNotify?.(okMsg);
    loadDir(touchedDir);
    setAction(null);
  };
  const cleanName = (name) => {
    const clean = String(name ?? "").trim();
    if (clean === "" || clean.includes("/") || clean === "." || clean === "..") {
      onNotify?.(`${t("error")}: ${t("tree.badName")}`, "error");
      return null;
    }
    return clean;
  };
  const runCreate = (dirPath, name, kind) => {
    const clean = cleanName(name);
    if (clean === null) return;
    api("fs.create", { cwd, path: dirPath === "" ? clean : `${dirPath}/${clean}`, kind }).then((res) => finish(res, t("tree.created"), dirPath));
  };
  const runRename = (path, newName) => {
    const clean = cleanName(newName);
    if (clean === null) return;
    const dir = parentOf(path);
    api("fs.rename", { cwd, path, to: dir === "" ? clean : `${dir}/${clean}` }).then((res) => finish(res, t("tree.renamed"), dir));
  };
  const runDelete = async (path) => {
    if (deletePending.current || action?.kind !== "delete" || action.path !== path) return;
    deletePending.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await api("fs.delete", { cwd, path });
      if (!res.ok || res.value?.error) {
        const text = `${t("error")}: ${res.value?.error ?? res.error}`;
        setDeleteError(text);
        onNotify?.(text, "error");
        return;
      }
      onNotify?.(t("tree.deleted"));
      onDeleted?.(path);
      loadDir(parentOf(path));
      setAction(null);
    } finally {
      deletePending.current = false;
      setDeleting(false);
    }
  };
  const requestDelete = (path, isDir) => {
    if (deletePending.current) return;
    setDeleteError("");
    setAction((current) => current?.kind === "delete" && current.path === path ? null : { kind: "delete", path, isDir });
  };
  const deleteRow = (path) => action?.kind === "delete" && action.path === path ? h(
    "section",
    {
      key: `delete-confirm:${path}`,
      ref: deleteRef,
      className: "ctp-delete-panel",
      role: "group",
      "aria-label": t("tree.delete")
    },
    h("strong", null, t(action.isDir ? "tree.deleteDirQuestion" : "tree.deleteFileQuestion", { name: path.split("/").pop() })),
    h("p", null, t(action.isDir ? "tree.deleteDirHint" : "tree.deleteFileHint")),
    deleteError ? h("p", { className: "ctp-delete-error", role: "alert" }, deleteError) : null,
    h(
      "div",
      { className: "ctp-delete-buttons" },
      h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-danger", disabled: deleting, onClick: () => void runDelete(path) }, deleting ? t("tree.deleting") : t("tree.confirmDelete")),
      h("button", { type: "button", className: "ce-sk-btn", disabled: deleting, onClick: () => {
        setAction(null);
        setDeleteError("");
      } }, t("changes.cancel"))
    )
  ) : null;
  const runMove = (from, toDir) => {
    const name = from.split("/").pop();
    const to = toDir === "" ? name : `${toDir}/${name}`;
    if (to === from) return;
    const srcDir = parentDir(from);
    api("fs.rename", { cwd, path: from, to }).then((res) => {
      if (!res.ok || res.value?.error) {
        onNotify?.(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
        return;
      }
      onNotify?.(t("tree.moved"));
      loadDir(srcDir);
      loadDir(toDir);
    });
  };
  const dragProps = (path, kind = "file") => {
    const props = fileDragProps({ cwd, path, kind, sessionId });
    return {
      ...props,
      onDragStart: (event) => {
        props.onDragStart(event);
        if (!event.defaultPrevented) setDragPath(path);
      },
      onDragEnd: () => {
        setDragPath(null);
        setDropDir(null);
      }
    };
  };
  const dropProps = (dirPath) => ({
    onDragOver: (e) => {
      if (!dragPath || !canDropInto(dragPath, dirPath)) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        e.dataTransfer.dropEffect = "move";
      } catch {
      }
      if (dropDir !== dirPath) setDropDir(dirPath);
    },
    onDragLeave: (e) => {
      e.stopPropagation();
      if (dropDir === dirPath) setDropDir(null);
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const from = dragPath;
      setDragPath(null);
      setDropDir(null);
      if (from && canDropInto(from, dirPath)) runMove(from, dirPath);
    }
  });
  const fileDropProps = (filePath) => {
    const dir = parentDir(filePath);
    return {
      onDragOver: (e) => {
        if (!dragPath || !canDropInto(dragPath, dir)) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          e.dataTransfer.dropEffect = "move";
        } catch {
        }
      },
      onDrop: (e) => {
        e.stopPropagation();
        if (!dragPath) return;
        e.preventDefault();
        const from = dragPath;
        setDragPath(null);
        setDropDir(null);
        if (canDropInto(from, dir)) runMove(from, dir);
      }
    };
  };
  const depthOf = (path) => path === "" ? 0 : path.split("/").length;
  const copyPath = (path, event) => {
    const text = event?.altKey ? path : toAbs(cwd, path);
    const ok = () => {
      setCopiedPath(path);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedPath(null), 1400);
      onNotify?.(t("tree.copied"));
    };
    const bad = () => onNotify?.(`${t("error")}: clipboard`, "error");
    try {
      const p = navigator.clipboard?.writeText(text);
      if (p && typeof p.then === "function") p.then(ok, bad);
      else ok();
    } catch {
      bad();
    }
  };
  const openContextMenu = (event, path, isDir) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      path,
      isDir,
      x: Math.max(8, Math.min(event.clientX, (window.innerWidth || 1e3) - 218)),
      y: Math.max(8, Math.min(event.clientY, (window.innerHeight || 800) - 260))
    });
  };
  const contextCopy = (relative) => {
    if (!contextMenu) return;
    copyPath(contextMenu.path, relative ? { altKey: true } : {});
    setContextMenu(null);
  };
  const contextRename = () => {
    if (!contextMenu) return;
    setAction({ kind: "rename", path: contextMenu.path, value: contextMenu.path.split("/").pop() });
    setContextMenu(null);
  };
  const contextDelete = () => {
    if (!contextMenu) return;
    requestDelete(contextMenu.path, contextMenu.isDir);
    setContextMenu(null);
  };
  const contextCreate = (kind) => {
    if (!contextMenu?.isDir) return;
    if (!expanded.includes(contextMenu.path)) setExpanded([...expanded, contextMenu.path]);
    if (listing[contextMenu.path] === void 0) loadDir(contextMenu.path);
    setAction({ kind, path: contextMenu.path, value: "" });
    setContextMenu(null);
  };
  const inputRow = (dirPath, kind, placeholder) => h(
    "div",
    {
      key: `inp:${dirPath}:${kind}`,
      className: "ce-row ctp-inputrow",
      style: { paddingLeft: 6 + depthOf(dirPath) * 14 }
    },
    h("input", {
      className: "ce-input",
      placeholder,
      autoFocus: true,
      value: action?.value ?? "",
      onChange: (e) => setAction({ ...action, value: e.target.value }),
      onKeyDown: (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          if (kind === "rename") runRename(action.path, e.target.value);
          else runCreate(dirPath, e.target.value, kind);
        } else if (e.key === "Escape") setAction(null);
      }
    })
  );
  const acts = (path, isDir) => h(
    "span",
    { className: "ctp-acts" },
    isDir ? h(HintButton, {
      type: "button",
      className: "cet-act",
      hint: t("tree.newFile"),
      onClick: (e) => {
        e.stopPropagation();
        if (!expanded.includes(path)) setExpanded([...expanded, path]);
        if (listing[path] === void 0) loadDir(path);
        setAction({ kind: "newfile", path, value: "" });
      }
    }, "+") : null,
    h(HintButton, {
      type: "button",
      className: copiedPath === path ? "cet-act cet-act-done" : "cet-act",
      hint: copiedPath === path ? t("tree.copied") : t("tree.copyPath"),
      onClick: (e) => {
        e.stopPropagation();
        copyPath(path, e);
      }
    }, copiedPath === path ? "✓" : "📋"),
    h(HintButton, {
      type: "button",
      className: "cet-act",
      hint: t("tree.rename"),
      onClick: (e) => {
        e.stopPropagation();
        setAction({ kind: "rename", path, value: path.split("/").pop() });
      }
    }, "✎"),
    h(HintButton, {
      type: "button",
      className: "cet-act",
      hint: t("tree.delete"),
      "data-ce-popup-trigger": "tree-delete",
      "aria-expanded": action?.kind === "delete" && action.path === path,
      disabled: deleting,
      onClick: (event) => {
        event.stopPropagation();
        requestDelete(path, isDir);
      }
    }, "✕")
  );
  const renderLevel = (path, depth) => {
    const state = listing[path];
    if (!state) return null;
    if (state.loading) return h("div", { key: `${path}-l`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, t("loading"));
    if (state.error) return h("div", { key: `${path}-l`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, `${t("tree.failed")}: ${state.error}`);
    const entries = uniqueDirectoryEntries(state.entries).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
    const rows = [];
    for (const entry of entries) {
      const childPath = path === "" ? entry.name : `${path}/${entry.name}`;
      if (entry.type === "directory") {
        const open = expanded.includes(childPath);
        rows.push(
          h(
            "div",
            {
              key: childPath,
              "data-tp": childPath,
              className: `ce-row${dropDir === childPath ? " ce-row-drop" : ""}`,
              style: { paddingLeft: 6 + depth * 14 },
              onClick: () => toggle(childPath),
              onContextMenu: (e) => openContextMenu(e, childPath, true),
              ...dragProps(childPath, "directory"),
              ...dropProps(childPath)
            },
            h(
              "button",
              { type: "button", className: "ctp-entry-open", "aria-expanded": open },
              h("span", { className: "ce-ico" }, h(IconFolder, { open })),
              h("span", { className: "ce-name" }, entry.name)
            ),
            acts(childPath, true)
          )
        );
        rows.push(deleteRow(childPath));
        if (action?.kind === "rename" && action.path === childPath) rows.push(inputRow(childPath, "rename", t("tree.renamePlaceholder")));
        if (open && action?.kind === "newfile" && action.path === childPath) rows.push(inputRow(childPath, "file", t("tree.newFilePlaceholder")));
        if (open && action?.kind === "newdir" && action.path === childPath) rows.push(inputRow(childPath, "dir", t("tree.newDirPlaceholder")));
        if (open) rows.push(renderLevel(childPath, depth + 1));
      } else if (entry.type === "file") {
        rows.push(
          h(
            "div",
            {
              key: childPath,
              "data-tp": childPath,
              className: `ce-row${activePath && (activePath === childPath || activePath.endsWith(`/${childPath}`)) ? " ce-active" : ""}`,
              style: { paddingLeft: 6 + depth * 14 },
              onClick: () => onOpenFile(childPath, 1, 1),
              onContextMenu: (e) => openContextMenu(e, childPath, false),
              ...dragProps(childPath),
              ...fileDropProps(childPath)
            },
            h(
              "button",
              { type: "button", className: "ctp-entry-open" },
              h("span", { className: `cet-fico ce-tree-ico ${fileTint(childPath)}` }, h(FileGlyph)),
              h("span", { className: "ce-name" }, entry.name)
            ),
            acts(childPath, false)
          )
        );
        rows.push(deleteRow(childPath));
        if (action?.kind === "rename" && action.path === childPath) rows.push(inputRow(path, "rename", t("tree.renamePlaceholder")));
      }
    }
    if (!rows.length) rows.push(h("div", { key: `${path}-e`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, t("tree.empty")));
    return h(Fragment, { key: `tree-level:${path || "root"}` }, rows);
  };
  return h(
    "div",
    {
      className: "ce-scroll ce-rail",
      ref: railRef,
      // Root drop only when the pointer is over the bare panel background —
      // drops that bubble up from rows must not teleport entries to the root.
      onDragOver: (e) => {
        if (e.target !== railRef.current || !dragPath || !canDropInto(dragPath, "")) return;
        e.preventDefault();
        try {
          e.dataTransfer.dropEffect = "move";
        } catch {
        }
      },
      onDrop: (e) => {
        if (e.target !== railRef.current || !dragPath) return;
        e.preventDefault();
        const from = dragPath;
        setDragPath(null);
        setDropDir(null);
        if (canDropInto(from, "")) runMove(from, "");
      }
    },
    h(
      "div",
      { className: "ctp-tools" },
      h(HintButton, { type: "button", className: "cet-act cet-act-show", hint: t("tree.newFileRoot"), onClick: () => setAction({ kind: "newfile", path: "", value: "" }) }, `+ ${t("tree.fileWord")}`),
      h(HintButton, { type: "button", className: "cet-act cet-act-show", hint: t("tree.newDirRoot"), onClick: () => setAction({ kind: "newdir", path: "", value: "" }) }, `+ ${t("tree.dirWord")}`)
    ),
    action !== null && (action.kind === "newfile" || action.kind === "newdir") && action.path === "" ? inputRow("", action.kind === "newdir" ? "dir" : "file", action.kind === "newdir" ? t("tree.newDirPlaceholder") : t("tree.newFilePlaceholder")) : null,
    renderLevel("", 0),
    contextMenu ? h(
      "div",
      { className: "cet-context", ref: contextMenuRef, style: { left: contextMenu.x, top: contextMenu.y }, role: "menu", onMouseDown: (e) => e.stopPropagation() },
      h("div", { className: "cet-context-path", title: contextMenu.path }, contextMenu.path || t("tree.workspaceRoot")),
      h("div", { className: "cet-context-rule" }),
      h("button", { type: "button", role: "menuitem", onClick: () => contextCopy(false) }, t("tree.copyAbsolute")),
      h("button", { type: "button", role: "menuitem", onClick: () => contextCopy(true) }, t("tree.copyRelative")),
      contextMenu.isDir ? h(
        Fragment,
        null,
        onSearchDirectory ? h("button", { type: "button", role: "menuitem", onClick: () => {
          onSearchDirectory(contextMenu.path);
          setContextMenu(null);
        } }, t("search.inDirectory")) : null,
        h("button", { type: "button", role: "menuitem", onClick: () => contextCreate("newfile") }, t("tree.newFile")),
        h("button", { type: "button", role: "menuitem", onClick: () => contextCreate("newdir") }, t("tree.newDir"))
      ) : null,
      h("button", { type: "button", role: "menuitem", onClick: contextRename }, t("tree.rename")),
      h("button", { type: "button", role: "menuitem", className: "cet-context-danger", onClick: contextDelete }, t("tree.delete"))
    ) : null
  );
}

// src/client/changes.js
function isStagedXy(xy) {
  return typeof xy === "string" && xy.length > 0 && xy[0] !== " " && xy[0] !== "?";
}
function ChangesPanel({ cwd, t, git, repos, repoSel, onSelectRepo, commitsOpen, setCommitsOpen, onOpenCommit, onOpenDiff, onDiscard, onDiscardDir, onDelete, onDeleteDir, onStage, onStageDir, onUnstage, onUnstageDir, onCommit, committing, onNotify, refresh, sessionId, onCherryPick, onResolve, onSequencer, compare, setCompare, seqDisabled, onAiMessage }) {
  const [treeView, setTreeView] = useState(true);
  const [message, setMessage] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [amend, setAmend] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [stashes, setStashes] = useState([]);
  const [stashOpen, setStashOpen] = useState(false);
  const [stashSaving, setStashSaving] = useState(false);
  const [stashMsg, setStashMsg] = useState("");
  const [stashUntracked, setStashUntracked] = useState(false);
  const [stashBusy, setStashBusy] = useState(false);
  const [stashConfirm, setStashConfirm] = useState(null);
  const [pickConfirm, setPickConfirm] = useState(null);
  const [flatDelete, setFlatDelete] = useState(null);
  const stashSaveRef = useDismissLayer({ open: stashSaving, onDismiss: () => setStashSaving(false), ignoreSelector: '[data-ce-popup-trigger="stash-save"]' });
  const stashConfirmRef = useDismissLayer({ open: stashConfirm !== null, onDismiss: () => setStashConfirm(null) });
  const repoArgs = repoSel ? { cwd, repo: repoSel } : { cwd };
  const isRepo = Boolean(git && git.repo);
  const refreshStashes = useCallback(() => {
    if (!cwd || !isRepo) return;
    api("git.stash.list", repoSel ? { cwd, repo: repoSel } : { cwd }).then((res) => {
      if (res.ok && Array.isArray(res.value?.stashes)) setStashes(res.value.stashes);
    }).catch(() => {
    });
  }, [cwd, repoSel, isRepo]);
  useEffect(refreshStashes, [refreshStashes]);
  const stashSave = () => {
    if (stashBusy) return;
    setStashBusy(true);
    api("git.stash.save", { ...repoArgs, message: stashMsg.trim(), includeUntracked: stashUntracked }).then((res) => {
      setStashBusy(false);
      const value = res.ok ? res.value ?? {} : { error: res.error };
      if (Array.isArray(value.stashes)) setStashes(value.stashes);
      setStashSaving(false);
      setStashMsg("");
      refresh?.();
      if (value.error) onNotify?.(`${t("error")}: ${value.error}`, "error");
      else onNotify?.(t("stash.saved"));
    }).catch(() => setStashBusy(false));
  };
  const stashApply = (ref, pop) => {
    if (stashBusy) return;
    setStashBusy(true);
    api(pop ? "git.stash.pop" : "git.stash.apply", { ...repoArgs, ref }).then((res) => {
      setStashBusy(false);
      const value = res.ok ? res.value ?? {} : { error: res.error };
      if (Array.isArray(value.stashes)) setStashes(value.stashes);
      refresh?.();
      if (value.error) onNotify?.(`${t("error")}: ${value.error}`, "error");
      else onNotify?.(pop ? t("stash.popped") : t("stash.applied"));
    }).catch(() => setStashBusy(false));
  };
  const stashDrop = (ref) => {
    if (stashBusy) return;
    setStashBusy(true);
    api("git.stash.drop", { ...repoArgs, ref }).then((res) => {
      setStashBusy(false);
      setStashConfirm(null);
      const value = res.ok ? res.value ?? {} : { error: res.error };
      if (Array.isArray(value.stashes)) setStashes(value.stashes);
      if (value.error) onNotify?.(`${t("error")}: ${value.error}`, "error");
      else onNotify?.(t("stash.dropped"));
    }).catch(() => setStashBusy(false));
  };
  const selector = repos && repos.length > 0 ? h(
    "select",
    { className: "ce-input ce-repo", value: repoSel ?? "", onChange: (event) => onSelectRepo(event.target.value || null) },
    h("option", { value: "" }, t("changes.pickRepo")),
    repos.map((r) => h("option", { key: r.root, value: r.root }, `${r.root.split("/").pop()} · ${r.branch}${r.dirtyCount ? ` · ~${r.dirtyCount}` : ""}`))
  ) : null;
  if (!git) return h("div", { className: "ce-rail ce-scroll" }, selector, h("div", { className: "ce-note" }, t("loading")));
  if (git.error) return h("div", { className: "ce-rail ce-scroll" }, selector, h("div", { className: "ce-note" }, git.error));
  if (!git.repo) return h("div", { className: "ce-rail ce-scroll" }, selector, repos && repos.length === 0 ? h("div", { className: "ce-note" }, t("changes.notRepo")) : null);
  const onCopyPath = (path, relative) => copyChangePath({ cwd, repo: git.root || repoSel, path, relative, onNotify, t });
  const badge = (xy) => xy === "??" ? "U" : xy.trim()[0] === "A" || xy.trim()[0] === "?" ? "A" : xy.trim()[0] || "M";
  const staged = git.working.filter((f) => isStagedXy(f.xy));
  const unstaged = git.working.filter((f) => !isStagedXy(f.xy));
  const q = filterQuery.trim().toLowerCase();
  const matchesPath = (value) => !q || String(value?.path ?? value ?? "").toLowerCase().includes(q);
  const visibleStaged = staged.filter(matchesPath);
  const visibleUnstaged = unstaged.filter(matchesPath);
  const visibleBranchFiles = (git.branchFiles ?? []).filter(matchesPath);
  const flatRows = (files, prefix, scope) => files.map(
    (file) => h(
      "div",
      { ...fileDragProps({ cwd, repo: git.root, path: file.path, scope, source: "changes", sessionId }), key: `${prefix}:${file.path}`, className: "ce-row cet-row", title: file.path },
      h(
        "button",
        { type: "button", className: "ctp-entry-open", onClick: () => onOpenDiff(file.path, scope) },
        h("span", { className: `ce-badge ce-badge-${badge(file.xy).toLowerCase()}` }, badge(file.xy)),
        h("span", { className: "ce-name" }, file.path)
      ),
      h(
        "span",
        { className: "cet-right" },
        onDelete && badge(file.xy) === "U" ? flatDelete === file.path ? h(
          Fragment,
          null,
          h("button", { type: "button", className: "cet-act cet-act-show cet-act-danger", title: t("changes.confirmDelete"), onClick: () => {
            setFlatDelete(null);
            onDelete({ path: file.path, ch: "U" });
          } }, t("changes.confirm")),
          h("button", { type: "button", className: "cet-act cet-act-show", onClick: () => setFlatDelete(null) }, t("changes.cancel"))
        ) : h("button", { type: "button", className: "cet-act cet-act-delete", title: t("changes.deleteUntracked"), onClick: () => setFlatDelete(file.path) }, "🗑") : null,
        h(CopyChangePathButton, { path: file.path, onCopyPath, t })
      )
    )
  );
  const submit = () => {
    const m = message.trim();
    if (!m || committing) return;
    if (!amend && git.working.length === 0) return;
    Promise.resolve(onCommit(m, !amend && staged.length === 0, amend)).then((ok) => {
      if (ok) setMessage("");
    });
  };
  const commitDisabled = message.trim() === "" || committing || !amend && git.working.length === 0;
  const commitLabel = amend ? t("changes.amendCommit") : staged.length > 0 ? t("changes.commit") : t("changes.commitAll");
  return h(
    "div",
    { className: "ce-rail ce-scroll ce-changes" },
    selector,
    // Sequencer banner: cherry-pick / merge / revert conflicts get their
    // own list — per-file ours/theirs plus Continue/Abort. Working rows
    // stay untouched so a conflicted file keeps its usual affordances.
    git.inProgress ? h(
      "section",
      { className: "ce-change-group ce-conflict" },
      h(
        "div",
        { className: "ce-section" },
        h("span", null, `${t("changes.conflictTitle")} · ${git.inProgress}`),
        h("button", { className: "ce-link", type: "button", disabled: seqDisabled, title: t("changes.continueTitle"), onClick: () => onSequencer("continue") }, t("changes.continue")),
        h("button", { className: "ce-link", type: "button", disabled: seqDisabled, title: t("changes.abortTitle"), onClick: () => onSequencer("abort") }, t("changes.abort"))
      ),
      (git.working ?? []).filter((f) => f.xy.includes("U")).map(
        (f) => h(
          "div",
          { key: `u:${f.path}`, className: "ce-row ce-conflict-row", title: f.path },
          h("span", { className: "ce-badge ce-badge-u" }, "U"),
          h("span", { className: "ce-name" }, f.path),
          h("button", { type: "button", className: "ce-tool ce-tiny", disabled: seqDisabled, title: t("changes.oursTitle"), onClick: () => onResolve(f.path, "ours") }, t("changes.ours")),
          h("button", { type: "button", className: "ce-tool ce-tiny", disabled: seqDisabled, title: t("changes.theirsTitle"), onClick: () => onResolve(f.path, "theirs") }, t("changes.theirs"))
        )
      )
    ) : null,
    compare && compare !== null ? h(
      "section",
      { className: "ce-change-group ce-compare" },
      h(
        "div",
        { className: "ce-section" },
        h("span", { title: `${compare.baseName ?? compare.base} → ${compare.headName ?? compare.head}` }, `${compare.baseName} → ${compare.headName} · ${compare.files?.length ?? 0}${compare.truncated ? `/${compare.total}` : ""}`),
        compare.shortstat ? h("span", { className: "ce-disclosure-meta" }, compare.shortstat) : null,
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setCompare(null) }, "✕")
      ),
      compare.error ? h("div", { className: "ce-note" }, compare.error) : null,
      !compare.error && (compare.files ?? []).length === 0 ? h("div", { className: "ce-note" }, t("compare.none")) : null,
      (compare.files ?? []).slice(0, 500).map(
        (f) => h(
          "div",
          {
            key: `cp:${f.path}`,
            className: "ce-row cet-row",
            title: f.from ? `${f.from} → ${f.path}` : f.path
          },
          h(
            "button",
            { className: "ctp-entry-open", type: "button", onClick: () => onOpenDiff(f.path, "compare", null, { base: compare.baseName, head: compare.headName }) },
            h("span", { className: `ce-badge ce-badge-${f.status.toLowerCase()}` }, f.status),
            h("span", { className: "ce-name" }, f.from ? `${f.from} → ${f.path}` : f.path)
          )
        )
      )
    ) : null,
    h("div", { className: "ce-note" }, git.upstream ? `${t("changes.vs")} ${git.upstream} · ↑${git.ahead ?? 0} ↓${git.behind ?? 0}${git.upstreamInferred ? " · auto" : ""}` : t("sync.noUpstream")),
    h(
      "div",
      { className: "ce-changes-search" },
      h("input", { className: "ce-input", type: "search", value: filterQuery, placeholder: t("changes.filterPlaceholder"), "aria-label": t("changes.filterPlaceholder"), onChange: (e) => setFilterQuery(e.target.value) })
    ),
    h(
      "section",
      { className: "ce-change-group" },
      staged.length > 0 ? h(
        Fragment,
        null,
        h(
          "div",
          { className: "ce-section" },
          h("span", null, `${t("changes.staged")} · ${visibleStaged.length}${visibleStaged.length !== staged.length ? `/${staged.length}` : ""}`),
          h("button", { className: "ce-link", type: "button", title: t("changes.unstageAll"), onClick: () => onUnstageDir && onUnstageDir("") }, t("changes.unstageAll"))
        ),
        treeView ? h(ChangeTree, {
          items: visibleStaged.map((f) => ({ path: f.path, ch: badge(f.xy), from: f.from ?? void 0 })),
          onOpen: (item) => onOpenDiff(item.path, "staged"),
          onUnstage: (item) => onUnstage && onUnstage(item),
          onUnstageDir: (dirPath) => onUnstageDir && onUnstageDir(dirPath),
          keyPrefix: "s",
          cwd,
          repo: git.root,
          scope: "staged",
          sessionId,
          onCopyPath,
          t
        }) : flatRows(visibleStaged, "s", "staged")
      ) : null,
      h(
        "div",
        { className: "ce-section" },
        h("span", null, `${t("changes.working")} · ${visibleUnstaged.length}${visibleUnstaged.length !== unstaged.length ? `/${unstaged.length}` : ""}`),
        unstaged.length > 0 ? h("button", { className: "ce-link", type: "button", title: t("changes.stageAll"), onClick: () => onStageDir && onStageDir("") }, t("changes.stageAll")) : null,
        h("button", { className: "ce-link", type: "button", title: treeView ? t("changes.toList") : t("changes.toTree"), onClick: () => setTreeView((v) => !v) }, treeView ? t("changes.toList") : t("changes.toTree")),
        h("button", { className: "ce-tool ce-tiny", type: "button", title: t("refresh"), onClick: refresh }, h(IconRefresh))
      ),
      visibleUnstaged.length === 0 && h("div", { className: "ce-note" }, t(q ? "changes.noFilterMatches" : unstaged.length === 0 && staged.length > 0 ? "changes.allStaged" : "changes.none")),
      treeView ? h(ChangeTree, {
        items: visibleUnstaged.map((f) => ({ path: f.path, ch: badge(f.xy), from: f.from ?? void 0 })),
        onOpen: (item) => onOpenDiff(item.path, "working"),
        onDiscard: (item) => onDiscard && onDiscard(item),
        onDiscardDir: (dirItems) => onDiscardDir && onDiscardDir(dirItems),
        onDelete: onDelete ? (item) => onDelete(item) : null,
        onDeleteDir: onDeleteDir ? (dirPath, dirItems) => onDeleteDir(dirPath, dirItems) : null,
        onStage: (item) => onStage && onStage(item),
        onStageDir: (dirPath) => onStageDir && onStageDir(dirPath),
        keyPrefix: "w",
        cwd,
        repo: git.root,
        scope: "working",
        sessionId,
        onCopyPath,
        t
      }) : flatRows(visibleUnstaged, "w", "working")
    ),
    h(
      "details",
      { className: "ce-commit-disclosure" },
      h(
        "summary",
        { className: "ce-disclosure-summary" },
        h("span", null, t("changes.compose")),
        h("span", { className: "ce-disclosure-meta" }, staged.length ? t("changes.readyCount", { n: staged.length }) : t("changes.stageBeforeCommit"))
      ),
      h(
        "div",
        { className: "ce-commitbox" },
        h("input", {
          className: "ce-input ce-commitbox-msg",
          "aria-label": t("changes.commitPlaceholder"),
          type: "text",
          placeholder: staged.length > 0 || amend ? t("changes.commitPlaceholder") : t("changes.commitAllPlaceholder"),
          value: message,
          disabled: committing,
          spellcheck: false,
          autoComplete: "off",
          onChange: (event) => setMessage(event.target.value),
          onKeyDown: (event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }
        }),
        h(
          "div",
          { className: "ce-commitbox-actions" },
          onAiMessage ? h("button", {
            type: "button",
            className: "ce-commitbox-ai",
            title: t("changes.aiMessage"),
            disabled: committing || aiBusy || staged.length === 0 && !amend,
            onClick: () => {
              setAiBusy(true);
              Promise.resolve(onAiMessage()).then((msg) => {
                if (typeof msg === "string" && msg.trim()) setMessage(msg.trim());
              }).catch(() => {
              }).finally(() => setAiBusy(false));
            }
          }, aiBusy ? t("loading") : "✦ AI") : null,
          h("button", {
            type: "button",
            className: `ce-commitbox-amend${amend ? " ce-tool-on" : ""}`,
            "aria-pressed": amend,
            title: t("changes.amendTitle"),
            disabled: committing,
            onClick: () => setAmend((v) => !v)
          }, t("changes.amend")),
          h("button", {
            type: "button",
            className: "ce-commitbox-btn",
            disabled: commitDisabled,
            title: amend ? t("changes.amendTitle") : staged.length > 0 ? t("changes.commit") : t("changes.commitAll"),
            onClick: submit
          }, committing ? t("changes.commitBusy") : `✓ ${commitLabel}`)
        )
      )
    ),
    h(
      "details",
      { className: "ce-change-group ce-branch-history", ...q ? { open: true } : {} },
      h("summary", { className: "ce-disclosure-summary" }, h("span", null, t("changes.branch")), h("span", { className: "ce-disclosure-meta" }, String(visibleBranchFiles.length))),
      git.base ? h(
        Fragment,
        null,
        h(
          "div",
          { className: "ce-note ce-note-line" },
          h("span", null, `${git.branch} ${t("changes.vs")} ${git.base.name} · ${visibleBranchFiles.length}${visibleBranchFiles.length !== git.branchFiles.length ? `/${git.branchFiles.length}` : ""} files`),
          h(
            "button",
            { type: "button", className: "ce-link", title: t("changes.commitsToggle"), "aria-expanded": commitsOpen ? "true" : "false", onClick: () => setCommitsOpen((v) => !v) },
            `${git.commits.length} ${t("changes.commits")} ${commitsOpen ? "▾" : "▸"}`
          )
        ),
        commitsOpen ? git.commits.slice(0, 80).map((commit) => h(
          "div",
          { key: `c:${commit.hash}`, className: "ce-commit-row" },
          h(
            "button",
            { className: "ce-commit", type: "button", onClick: () => onOpenCommit(commit) },
            h("span", { className: "ce-chash" }, commit.hash),
            h("span", { className: "ce-csubject" }, commit.subject)
          ),
          onCherryPick ? h(
            "button",
            {
              type: "button",
              className: `ce-tool ce-tiny${pickConfirm === commit.hash ? " ce-danger" : ""}`,
              disabled: seqDisabled,
              title: pickConfirm === commit.hash ? t("changes.pickConfirm") : t("changes.pickTitle"),
              onClick: () => {
                if (pickConfirm === commit.hash) {
                  setPickConfirm(null);
                  void onCherryPick(commit);
                } else {
                  setPickConfirm(commit.hash);
                }
              }
            },
            pickConfirm === commit.hash ? "✓" : "⤵"
          ) : null
        )) : null,
        treeView ? h(ChangeTree, {
          items: visibleBranchFiles.map((p) => ({ path: p, ch: "C" })),
          onOpen: (item) => onOpenDiff(item.path, "branch"),
          keyPrefix: "b",
          cwd,
          repo: git.root,
          scope: "branch",
          sessionId,
          onCopyPath,
          t
        }) : flatRows(visibleBranchFiles.map((path) => ({ path, xy: "C" })), "b", "branch")
      ) : h("div", { className: "ce-note" }, t("changes.baseNone"))
    ),
    h(
      "section",
      { className: "ce-change-group" },
      h(
        "div",
        { className: "ce-section" },
        h("span", null, `${t("stash.title")}${stashes.length ? ` · ${stashes.length}` : ""}`),
        h("button", { className: "ce-link", type: "button", title: t("stash.saveTitle"), "data-ce-popup-trigger": "stash-save", disabled: stashBusy, onClick: () => {
          setStashConfirm(null);
          setStashSaving((v) => !v);
          setStashOpen(true);
        } }, `+ ${t("stash.save")}`),
        h("button", { className: "ce-tool ce-tiny", type: "button", title: t("stash.toggle"), "aria-expanded": stashOpen ? "true" : "false", onClick: () => {
          setStashConfirm(null);
          setStashSaving(false);
          setStashOpen((v) => !v);
        } }, stashOpen ? "▾" : "▸")
      ),
      stashSaving ? h(
        "div",
        { className: "ce-stash-save", ref: stashSaveRef },
        h("input", {
          className: "ce-input",
          placeholder: t("stash.msgPlaceholder"),
          value: stashMsg,
          autoFocus: true,
          onChange: (e) => setStashMsg(e.target.value),
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.key === "Enter") stashSave();
            else if (e.key === "Escape") setStashSaving(false);
          }
        }),
        h(
          "label",
          { className: "ce-stash-u", title: t("stash.untrackedTitle") },
          h("input", { type: "checkbox", checked: stashUntracked, onChange: (e) => setStashUntracked(e.target.checked) }),
          t("stash.untracked")
        ),
        h("button", { className: "ce-sk-btn", type: "button", disabled: stashBusy, onClick: stashSave }, stashBusy ? "…" : t("stash.save"))
      ) : null,
      stashOpen ? stashes.length === 0 ? h("div", { className: "ce-note" }, t("stash.none")) : stashes.map((s) => h(
        "div",
        { key: s.ref, className: "ce-stashrow" },
        h("span", { className: "ce-stashref" }, s.ref.replace(/^stash@\{(\d+)\}$/, "#$1")),
        h("span", { className: "ce-stashmsg", title: s.message }, s.message || "—"),
        h(
          "span",
          { className: "ce-stashacts" },
          stashConfirm === s.ref ? h(
            "span",
            { ref: stashConfirmRef },
            h("button", { type: "button", className: "cet-act cet-act-show cet-act-danger", disabled: stashBusy, onClick: () => stashDrop(s.ref) }, t("stash.confirm")),
            h("button", { type: "button", className: "cet-act cet-act-show", onClick: () => setStashConfirm(null) }, t("stash.cancel"))
          ) : h(
            Fragment,
            null,
            h("button", { type: "button", className: "ce-link", disabled: stashBusy, title: t("stash.applyTitle"), onClick: () => stashApply(s.ref, false) }, t("stash.apply")),
            h("button", { type: "button", className: "ce-link", disabled: stashBusy, title: t("stash.popTitle"), onClick: () => stashApply(s.ref, true) }, t("stash.pop")),
            h("button", { type: "button", className: "ce-tool ce-tiny", title: t("stash.drop"), disabled: stashBusy, onClick: () => {
              setStashSaving(false);
              setStashConfirm(s.ref);
            } }, "✕")
          )
        )
      )) : null
    )
  );
}

// src/client/tasks.js
var FAILURE_PATTERNS = [
  // go test: "\tmain_test.go:42:7: message" / "\t./x_test.go:3:"
  /^\t(?:\.\/)?([\w./@+\-[\]]+\.go):(\d+)(?::(\d+))?:/,
  // tsc: "src/x.ts(12,5): error TS2304: ..."
  /^(?:[\s>*-]*)([\w./@+\-[\]]+\.(?:ts|tsx|js|jsx|mjs|cjs))\((\d+),(\d+)\):/,
  // jest/eslint-ish: "  3:7  error  ...  src/x.js" — too loose; skip.
  // plain "file.ts:12:5: message" (eslint, some scripts)
  /^(?:[\s>*-]*)([\w./@+\-[\]]+\.(?:ts|tsx|js|jsx|mjs|cjs)):(\d+):(\d+)?[:-]/,
  // python: 'File "tests/x.py", line 12, in test_y'
  /^\s*File "([\w./@+\-[\]\s]+\.py)", line (\d+),/,
  // rustc: " --> src/x.rs:12:5"
  /^\s*--> ([\w./@+\-[\]]+\.rs):(\d+)(?::(\d+))?/
];
function failureAt(text) {
  for (const re of FAILURE_PATTERNS) {
    const m = re.exec(text);
    if (m) return { path: m[1].trim().replace(/^\.\//, ""), line: Number(m[2]) || 1, col: Number(m[3]) || 1 };
  }
  return null;
}
function foldTaskOutput(state, snap) {
  const chunks = snap.reset ? snap.chunks : [...state.chunks, ...snap.chunks];
  return { chunks, lineCount: countLines(chunks), seq: snap.seq, done: snap.done === true, code: snap.code, dropped: snap.dropped === true, reset: snap.reset === true };
}
function countLines(chunks) {
  let n = 0;
  for (const c of chunks) for (let i = 0; i < c.text.length; i++) if (c.text.charCodeAt(i) === 10) n++;
  return n + 1;
}

// src/client/overlays.js
function LocationList({ t, overlay, cwd, onPick, onClose }) {
  const panelRef = useDismissLayer({ onDismiss: onClose });
  return h(
    "div",
    { className: "ce-overlay", ref: panelRef, role: "dialog", "aria-label": overlay.title },
    h(
      "div",
      { className: "ce-overlay-head" },
      h("span", null, `${overlay.title} · ${overlay.items.length}`),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: t("close"), onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-overlay-list ce-scroll" },
      overlay.items.map(
        (item, i) => h(
          "button",
          { key: i, className: "ce-loc", type: "button", onClick: () => onPick(item) },
          h("span", { className: "ce-loc-path" }, `${RelPath(cwd, item.path)}:${item.line}:${item.col}`),
          item.snippet ? h("span", { className: "ce-loc-snippet" }, item.snippet) : null
        )
      )
    )
  );
}
function CommandPalette({ t, commands, onClose }) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const panelRef = useDismissLayer({ onDismiss: onClose, ignoreSelector: ".ce-command-trigger" });
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (commands ?? []).filter((item) => !q || `${item.label} ${item.hint ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);
  useEffect(() => {
    setSel(0);
  }, [query]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    listRef.current?.querySelector(`[data-command="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);
  const choose = (index) => {
    const item = items[index];
    if (!item) return;
    onClose();
    item.run();
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSel((value) => Math.min(Math.max(0, items.length - 1), value + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSel((value) => Math.max(0, value - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(sel);
    }
  };
  return h(
    "div",
    { className: "ce-palette ce-command-palette", ref: panelRef, role: "dialog", "aria-label": t("command.title"), onKeyDown },
    h(
      "div",
      { className: "ce-palette-head" },
      h("span", { className: "ce-command-mark", "aria-hidden": true }, ">_"),
      h("input", { ref: inputRef, className: "ce-input", type: "search", placeholder: t("command.placeholder"), "aria-label": t("command.placeholder"), value: query, onChange: (event) => setQuery(event.target.value), onKeyDown: (event) => {
        event.stopPropagation();
        onKeyDown(event);
      }, autoComplete: "off" }),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-palette-list ce-scroll", ref: listRef },
      items.length === 0 ? h("div", { className: "ce-note" }, t("command.empty")) : null,
      items.map((item, index) => h(
        "button",
        { key: item.id, type: "button", "data-command": index, className: `ce-command-item${index === sel ? " ce-qitem-sel" : ""}`, onMouseEnter: () => setSel(index), onClick: () => choose(index) },
        h("span", { className: "ce-command-icon", "aria-hidden": true }, item.icon ?? "·"),
        h("span", { className: "ce-command-label" }, item.label),
        item.hint ? h("kbd", { className: "ce-command-hint" }, item.hint) : null
      ))
    )
  );
}
function QuickOpen({ t, state, onQuery, onPick, onClose }) {
  const panelRef = useDismissLayer({ onDismiss: onClose, ignoreSelector: ".ce-rail-quickopen" });
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => {
    setSel(0);
  }, [state.query]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const items = state.results ?? [];
  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-qi="${sel}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [sel]);
  const choose = useCallback((i) => {
    const item = items[i];
    if (item) onPick(item.path);
  }, [items, onPick]);
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(sel);
    }
  };
  return h(
    "div",
    { className: "ce-palette", ref: panelRef, role: "dialog", "aria-label": t("quickopen.placeholder"), onKeyDown },
    h(
      "div",
      { className: "ce-palette-head" },
      h("input", {
        ref: inputRef,
        className: "ce-input",
        type: "text",
        placeholder: t("quickopen.placeholder"),
        value: state.query,
        onChange: (event) => onQuery(event.target.value),
        onKeyDown: (event) => {
          event.stopPropagation();
          onKeyDown(event);
        },
        spellcheck: false,
        autoCapitalize: "off",
        autoComplete: "off"
      }),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-palette-list ce-scroll", ref: listRef },
      state.busy && items.length === 0 ? h("div", { className: "ce-note" }, t("quickopen.loading")) : null,
      !state.busy && items.length === 0 ? h("div", { className: "ce-note" }, state.query ? t("quickopen.empty") : t("loading")) : null,
      items.map((item, i) => {
        const slash = item.path.lastIndexOf("/");
        return h(
          "button",
          {
            key: item.path,
            type: "button",
            "data-qi": i,
            className: `ce-qitem${i === sel ? " ce-qitem-sel" : ""}`,
            onMouseEnter: () => setSel(i),
            onClick: () => choose(i)
          },
          h("span", { className: "ce-qbase" }, slash >= 0 ? item.path.slice(slash + 1) : item.path),
          slash >= 0 ? h("span", { className: "ce-qdir" }, item.path.slice(0, slash)) : null
        );
      })
    )
  );
}
var PEEK_MAX_HEIGHT = 390;
function RefsPeek({ t, cwd, peek, scroll, totalLines, viewport = 600, onPick, onClose }) {
  const defs = peek.def ?? [];
  const refs = (peek.refs ?? []).filter((r) => !defs.some((d) => d.path === r.path && d.line === r.line && d.col === r.col));
  const groups = [];
  const pushRow = (loc, isDef) => {
    let g = groups.find((x) => x.path === loc.path);
    if (!g) {
      g = { path: loc.path, rows: [] };
      groups.push(g);
    }
    g.rows.push({ ...loc, isDef });
  };
  defs.slice(0, 30).forEach((d) => pushRow(d, true));
  refs.slice(0, 60).forEach((r) => pushRow(r, false));
  const flat = [];
  for (const g of groups) flat.push(...g.rows);
  const [sel, setSel] = useState(0);
  const bodyRef = useRef(null);
  const panelRef = useDismissLayer({ onDismiss: onClose });
  useEffect(() => {
    panelRef.current?.focus?.({ preventScroll: true });
  }, []);
  useEffect(() => {
    setSel(0);
  }, [peek.symbol, peek.busy]);
  useEffect(() => {
    bodyRef.current?.querySelector(`[data-ri="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);
  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      setSel((s) => Math.min(flat.length - 1, s + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      setSel((s) => Math.max(0, s - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (flat[sel]) onPick(flat[sel]);
    }
  };
  const anchored = peek.anchorLine * ROW + 6 - scroll;
  const ceiling = Math.max(6, viewport - PEEK_MAX_HEIGHT - 8);
  const top = Math.max(6, Math.min(anchored, ceiling, totalLines * ROW));
  let ri = 0;
  return h(
    "div",
    { className: "ce-peek", ref: panelRef, tabIndex: -1, style: { top }, onKeyDown, onMouseDown: (event) => event.stopPropagation() },
    h(
      "div",
      { className: "ce-peek-head" },
      h("span", { className: "ce-peek-sym" }, peek.symbol),
      peek.busy ? h("span", { className: "ce-peek-meta" }, t("loading")) : h("span", { className: "ce-peek-meta" }, `${t("peek.defs")} ${defs.length} · ${t("peek.refs")} ${refs.length}`),
      h("span", { className: "ce-spacer" }),
      h("span", { className: "ce-peek-hint" }, t("peek.hint")),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    peek.error ? h("div", { className: "ce-note" }, peek.error) : null,
    !peek.busy && flat.length === 0 && !peek.error ? h("div", { className: "ce-note" }, t("peek.empty")) : null,
    h(
      "div",
      { className: "ce-peek-body ce-scroll", ref: bodyRef },
      groups.map((g, gi) => {
        const fileRows = g.rows.map((r) => {
          const i = ri++;
          return h(
            "button",
            {
              key: i,
              type: "button",
              "data-ri": i,
              className: `ce-peek-row${i === sel ? " ce-peek-row-sel" : ""}${r.isDef ? " ce-peek-def" : ""}`,
              onMouseEnter: () => setSel(i),
              onClick: () => onPick(r)
            },
            h("span", { className: "ce-peek-kind" }, r.isDef ? "◆" : "·"),
            h("span", { className: "ce-peek-lno" }, `${r.line}:${r.col}`),
            h("span", { className: "ce-peek-snippet" }, r.snippet ?? "")
          );
        });
        return h(
          Fragment,
          { key: `${g.path}-${gi}` },
          h(
            "div",
            { className: "ce-peek-file" },
            h("span", { className: "ce-peek-file-icon", "aria-hidden": "true" }, "▤"),
            h("span", { className: "ce-peek-fpath", title: g.path }, RelPath(cwd, g.path) || g.path),
            h("span", { className: "ce-peek-file-count" }, String(g.rows.length))
          ),
          fileRows
        );
      })
    )
  );
}
var SYMBOL_GLYPHS = { 2: "▣", 3: "ƒ", 4: "Ω", 5: "◆", 6: "ƒ", 7: "◆", 8: "◈", 9: "#", 10: "◈", 11: "▣", 12: "✓", 13: "▣", 14: "🛡", 15: "ω", 16: "◆", 17: "◆", 18: "≡", 19: "◦", 20: "◦", 21: "≡", 22: "◆", 23: "◆", 24: "▣", 25: "•", 26: "•" };
function SymbolPalette({ t, symbols, onPick, onClose }) {
  const panelRef = useDismissLayer({ onDismiss: onClose });
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const q = query.trim().toLowerCase();
  const items = useMemo(() => {
    const filtered = !q ? symbols : symbols.filter((s) => (s.name ?? "").toLowerCase().includes(q) || (s.name ?? "").toLowerCase().startsWith(q));
    return filtered.slice(0, 120);
  }, [symbols, q]);
  useEffect(() => {
    setSel(0);
  }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-si="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (items[sel]) onPick(items[sel]);
    }
  };
  return h(
    "div",
    { className: "ce-palette", ref: panelRef, role: "dialog", "aria-label": t("symbols.placeholder"), onKeyDown, onMouseDown: (event) => event.stopPropagation() },
    h(
      "div",
      { className: "ce-palette-head" },
      h("input", {
        ref: inputRef,
        className: "ce-input",
        type: "text",
        placeholder: t("symbols.placeholder"),
        value: query,
        onChange: (event) => setQuery(event.target.value),
        onKeyDown: (event) => {
          event.stopPropagation();
          onKeyDown(event);
        },
        spellcheck: false
      }),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-palette-list ce-scroll", ref: listRef },
      items.length === 0 ? h("div", { className: "ce-note" }, t("symbols.none")) : null,
      items.map(
        (s, i) => h(
          "button",
          {
            key: `${s.name}-${s.line}-${i}`,
            type: "button",
            "data-si": i,
            className: `ce-qitem${i === sel ? " ce-qitem-sel" : ""}`,
            onMouseEnter: () => setSel(i),
            onClick: () => onPick(s)
          },
          h("span", { className: "ce-symglyph" }, SYMBOL_GLYPHS[s.kind] ?? "•"),
          h("span", { className: "ce-qbase" }, s.name),
          h("span", { className: "ce-qdir" }, `:${s.line}:${s.col}`)
        )
      )
    )
  );
}
function WorkspaceSymbolPalette({ t, cwd, state, onQuery, onPick, onClose }) {
  const panelRef = useDismissLayer({ onDismiss: onClose });
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const items = useMemo(() => (state.results ?? []).slice(0, 120), [state.results]);
  useEffect(() => {
    setSel(0);
  }, [state.query, state.results]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-wi="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);
  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (items[sel]) onPick(items[sel]);
    }
  };
  return h(
    "div",
    { className: "ce-palette", ref: panelRef, role: "dialog", "aria-label": t("wsym.placeholder"), onKeyDown, onMouseDown: (event) => event.stopPropagation() },
    h(
      "div",
      { className: "ce-palette-head" },
      h("input", {
        ref: inputRef,
        className: "ce-input",
        type: "text",
        placeholder: t("wsym.placeholder"),
        value: state.query,
        onChange: (event) => onQuery(event.target.value),
        onKeyDown: (event) => {
          event.stopPropagation();
          onKeyDown(event);
        },
        spellcheck: false
      }),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-palette-list ce-scroll", ref: listRef },
      state.busy && items.length === 0 ? h("div", { className: "ce-note" }, t("loading")) : null,
      !state.busy && state.error ? h("div", { className: "ce-note" }, state.error) : null,
      !state.busy && !state.error && items.length === 0 ? h("div", { className: "ce-note" }, state.query.trim() === "" ? t("wsym.needQuery") : t("wsym.none")) : null,
      items.map(
        (s, i) => h(
          "button",
          {
            key: `${s.name}-${s.path}-${s.line}-${i}`,
            type: "button",
            "data-wi": i,
            className: `ce-qitem${i === sel ? " ce-qitem-sel" : ""}`,
            onMouseEnter: () => setSel(i),
            onClick: () => onPick(s)
          },
          h("span", { className: "ce-symglyph" }, SYMBOL_GLYPHS[s.kind] ?? "•"),
          h("span", { className: "ce-qbase" }, s.container ? `${s.name} · ${s.container}` : s.name),
          h("span", { className: "ce-qdir" }, RelPath(cwd, s.path)),
          h("span", { className: "ce-qdir" }, `:${s.line}`)
        )
      )
    )
  );
}
function CompareRefsPalette({ t, busy, branches, onRun, onClose }) {
  const panelRef = useDismissLayer({ onDismiss: onClose });
  const [base, setBase] = useState("");
  const [head, setHead] = useState("HEAD");
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const fill = (name) => {
    if (base === "") setBase(name);
    else setHead(name);
  };
  return h(
    "div",
    { className: "ce-palette ce-compare-box", ref: panelRef, role: "dialog", "aria-label": t("compare.title"), onKeyDown: (e) => {
      if (e.key === "Escape") onClose();
    } },
    h(
      "div",
      { className: "ce-palette-head" },
      h("span", { className: "ce-disclosure-summary" }, t("compare.title")),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-compare-fields" },
      h("input", { ref: inputRef, className: "ce-input", type: "text", placeholder: t("compare.base"), value: base, onChange: (e) => setBase(e.target.value), spellcheck: false, autoComplete: "off" }),
      h("input", { className: "ce-input", type: "text", placeholder: t("compare.head"), value: head, onChange: (e) => setHead(e.target.value), spellcheck: false, autoComplete: "off" }),
      h("button", {
        type: "button",
        className: "ce-commitbox-btn",
        disabled: busy || base.trim() === "",
        onClick: () => onRun(base.trim(), head.trim() || "HEAD")
      }, busy ? t("compare.busy") : t("compare.run"))
    ),
    h(
      "div",
      { className: "ce-palette-list ce-scroll" },
      branches.length === 0 ? h("div", { className: "ce-note" }, t("compare.noRefs")) : null,
      branches.map(
        (b) => h(
          "button",
          { key: b.name, type: "button", className: "ce-qitem", title: b.remote ? "remote" : "local", onClick: () => fill(b.name) },
          h("span", { className: "ce-symglyph" }, b.remote ? "☁" : "⌂"),
          h("span", { className: "ce-qbase" }, b.name),
          b.current ? h("span", { className: "ce-qdir" }, "•") : null
        )
      )
    )
  );
}
function TaskPalette({ t, state, onRun, onClose }) {
  const panelRef = useDismissLayer({ onDismiss: onClose });
  const names = useMemo(() => Object.keys(state.scripts ?? {}), [state.scripts]);
  return h(
    "div",
    { className: "ce-palette", ref: panelRef, role: "dialog", "aria-label": t("task.title"), onKeyDown: (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    } },
    h(
      "div",
      { className: "ce-palette-head" },
      h("span", { className: "ce-disclosure-summary" }, t("task.title")),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-palette-list ce-scroll" },
      state.busy ? h("div", { className: "ce-note" }, t("loading")) : null,
      state.error ? h("div", { className: "ce-note" }, state.error) : null,
      !state.busy && !state.error && names.length === 0 ? h("div", { className: "ce-note" }, t("task.noScripts")) : null,
      names.map(
        (name) => h(
          "button",
          { key: name, type: "button", className: "ce-qitem", onClick: () => onRun(name) },
          h("span", { className: "ce-symglyph" }, (state.running ?? {})[name] ? "●" : "‣"),
          h("span", { className: "ce-qbase" }, name),
          h("span", { className: "ce-qdir" }, state.scripts[name])
        )
      )
    )
  );
}
function TaskOutputPanel({ t, state, onStop, onClose, onOpenFile, tail = 2e3 }) {
  const panelRef = useDismissLayer({ onDismiss: onClose, ignoreSelector: '[data-ce-popup-trigger="task-stop"]' });
  const bodyRef = useRef(null);
  const lines2 = useMemo(() => {
    const all = [];
    for (const c of state.chunks) all.push(c);
    const text = all.map((c) => c.text).join("");
    const rows = text.split("\n");
    if (rows.length > tail) return rows.slice(-tail).map((line, i) => ({ line, n: rows.length - tail + i + 1 }));
    return rows.map((line, i) => ({ line, n: i + 1 }));
  }, [state.chunks, tail]);
  const scrolledTo = useRef(0);
  useEffect(() => {
    const el = bodyRef.current;
    if (el && state.seq !== scrolledTo.current) {
      scrolledTo.current = state.seq;
      el.scrollTop = el.scrollHeight;
    }
  }, [state.seq]);
  const status = state.done ? state.code === 0 ? t("task.exited", { code: String(state.code) }) : t("task.failed", { code: String(state.code ?? "?") }) : t("task.running");
  return h(
    "div",
    { className: "ce-palette ce-task-panel", ref: panelRef, role: "dialog", "aria-label": `${t("task.output")}: ${state.script}`, onKeyDown: (e) => {
      if (e.key === "Escape") onClose();
    } },
    h(
      "div",
      { className: "ce-palette-head" },
      h("span", { className: "ce-symglyph" }, "‣"),
      h("span", { className: "ce-disclosure-summary" }, state.script),
      h("span", { className: `ce-peek-meta${state.done && state.code !== 0 ? " ce-danger" : ""}` }, status),
      state.dropped ? h("span", { className: "ce-peek-meta", title: t("task.droppedHint") }, t("task.dropped")) : null,
      h("span", { className: "ce-spacer" }),
      !state.done ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("task.stop"), "data-ce-popup-trigger": "task-stop", onClick: onStop }, `■ ${t("task.stop")}`) : null,
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-task-body ce-scroll", ref: bodyRef },
      lines2.map((r) => {
        const loc = failureAt(r.line);
        return h(
          "div",
          { key: `${r.n}`, className: "ce-task-line" },
          loc ? h("button", { type: "button", className: "ce-task-jump", title: t("task.jumpHint"), onClick: () => onOpenFile(loc.path, loc.line, loc.col) }, r.line) : r.line
        );
      })
    )
  );
}
function GotoLinePalette({ t, totalLines, initial, onGo, onClose }) {
  const panelRef = useDismissLayer({ onDismiss: onClose });
  const [value, setValue] = useState(String(initial ?? ""));
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const submit = () => {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n) && n >= 1) onGo(Math.min(n, totalLines));
    onClose();
  };
  const onKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };
  return h(
    "div",
    { className: "ce-palette ce-goto", ref: panelRef, role: "dialog", "aria-label": t("goto.title"), onMouseDown: (event) => event.stopPropagation() },
    h(
      "div",
      { className: "ce-palette-head" },
      h("input", {
        ref: inputRef,
        className: "ce-input",
        type: "text",
        inputMode: "numeric",
        placeholder: t("goto.placeholder", { n: totalLines }),
        value,
        onChange: (event) => setValue(event.target.value),
        onKeyDown: (event) => {
          event.stopPropagation();
          onKeyDown(event);
        },
        spellcheck: false,
        autoComplete: "off"
      }),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    )
  );
}
function FileHistoryOverlay({ t, hist, onPick, onClose }) {
  const panelRef = useDismissLayer({ onDismiss: onClose });
  return h(
    "div",
    { className: "ce-overlay", ref: panelRef, role: "dialog", "aria-label": t("history.title"), onMouseDown: (event) => event.stopPropagation() },
    h(
      "div",
      { className: "ce-overlay-head" },
      h("span", null, `${t("history.title")}${hist.commits ? ` · ${hist.commits.length}` : ""}`),
      h("span", { className: "ce-histpath" }, hist.path),
      h("span", { className: "ce-spacer" }),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-overlay-list ce-scroll" },
      hist.busy ? h("div", { className: "ce-note" }, t("loading")) : null,
      hist.error ? h("div", { className: "ce-note" }, `${t("error")}: ${hist.error}`) : null,
      !hist.busy && !hist.error && (hist.commits ?? []).length === 0 ? h("div", { className: "ce-note" }, t("history.none")) : null,
      (hist.commits ?? []).map(
        (c) => h(
          "button",
          { key: c.hash, type: "button", className: "ce-histrow", title: `${c.hash} · ${c.author} · ${c.when}`, onClick: () => onPick(c) },
          h("span", { className: "ce-chash" }, c.hash),
          h("span", { className: "ce-csubject" }, c.subject),
          h("span", { className: "ce-histmeta" }, `${c.author} · ${c.when}`)
        )
      )
    )
  );
}
function problemSeverity(severity) {
  if (severity === 1) return { glyph: "✕", cls: " ce-problem-err" };
  if (severity === 2) return { glyph: "⚠", cls: " ce-problem-warn" };
  if (severity === 3) return { glyph: "ℹ", cls: "" };
  return { glyph: "·", cls: "" };
}
function ProblemsPanel({ t, diagnostics, onPick, onClose, workspaceFiles }) {
  const panelRef = useDismissLayer({ onDismiss: onClose });
  const [filters, setFilters] = useState({ err: true, warn: true, info: true });
  const all = useMemo(() => {
    const items2 = [];
    if (Array.isArray(workspaceFiles)) {
      for (const file of workspaceFiles) {
        const rel = file.path?.split("/").slice(-2).join("/") ?? file.path ?? "";
        for (const item of file.items ?? []) items2.push({ ...item, _file: rel });
      }
    } else {
      for (const item of diagnostics ?? []) items2.push({ ...item, _file: "" });
    }
    return items2.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.col ?? 0) - (b.col ?? 0));
  }, [diagnostics, workspaceFiles]);
  const bucketOf = (item) => item?.severity === 1 ? "err" : item?.severity === 2 ? "warn" : "info";
  const counts = useMemo(() => {
    const c = { err: 0, warn: 0, info: 0 };
    for (const item of all) c[bucketOf(item)]++;
    return c;
  }, [all]);
  const items = all.filter((item) => filters[bucketOf(item)]);
  return h(
    "div",
    { className: "ce-overlay ce-problems", ref: panelRef, role: "dialog", "aria-label": t("problems.title"), onMouseDown: (event) => event.stopPropagation() },
    h(
      "div",
      { className: "ce-overlay-head" },
      h("span", null, `${t("problems.title")} · ${items.length}${items.length !== all.length ? `/${all.length}` : ""}`),
      h("span", { className: "ce-spacer" }),
      [["err", "✕", "problems.showErr"], ["warn", "⚠", "problems.showWarn"], ["info", "ℹ", "problems.showInfo"]].map(([key, glyph, label]) => h("button", {
        type: "button",
        key,
        className: `ce-tool ce-tiny ce-problem-filter${filters[key] ? "" : " ce-problem-off"}`,
        "aria-pressed": filters[key],
        title: t(label),
        onClick: () => setFilters((f) => ({ ...f, [key]: !f[key] }))
      }, `${glyph} ${counts[key]}`)),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    ),
    h(
      "div",
      { className: "ce-overlay-list ce-scroll" },
      items.length === 0 ? h("div", { className: "ce-note" }, all.length === 0 ? t("problems.empty") : t("problems.filtered")) : null,
      items.map((item, i) => {
        const sev = problemSeverity(item.severity);
        return h(
          "button",
          { key: i, type: "button", className: "ce-loc", title: `${item._file ? `${item._file}:` : ""}${item.line}:${item.col}`, onClick: () => onPick(item) },
          h("span", { className: `ce-problem-sev${sev.cls}` }, sev.glyph),
          item._file ? h("span", { className: "ce-loc-path ce-loc-file" }, item._file) : null,
          h("span", { className: "ce-loc-path" }, `${item.line}:${item.col}`),
          h("span", { className: "ce-loc-snippet" }, `${item.source ? `${item.source}: ` : ""}${item.message ?? ""}`)
        );
      })
    )
  );
}

// src/client/replace.js
function escapeReLocal(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function buildReplaceRe(query, opts) {
  if (!query) return null;
  const insensitive = String(query) === String(query).toLowerCase();
  let src = String(query);
  if (!opts?.regex) src = escapeReLocal(src);
  if (opts?.words) src = `\\b(?:${src})\\b`;
  try {
    return new RegExp(src, insensitive ? "gmi" : "gm");
  } catch {
    return null;
  }
}
function replaceInText(text, query, replaceWith, opts) {
  const re = buildReplaceRe(query, opts);
  if (!re || typeof text !== "string") return { text, count: 0 };
  const replacement = String(replaceWith ?? "");
  if (opts?.regex) {
    const found = text.match(re);
    const count2 = found ? found.length : 0;
    if (count2 === 0) return { text, count: 0 };
    return { text: text.replace(re, replacement), count: count2 };
  }
  let count = 0;
  const out = text.replace(re, () => {
    count++;
    return replacement;
  });
  return { text: out, count };
}

// src/client/searchpanel.js
function matchRanges(text, query, regex) {
  const ranges = [];
  if (!text || !query) return ranges;
  const insensitive = query === query.toLowerCase();
  if (regex) {
    let re;
    try {
      re = new RegExp(query, insensitive ? "gi" : "g");
    } catch {
      return ranges;
    }
    let m;
    let guard2 = 0;
    while ((m = re.exec(text)) !== null && guard2++ < 60) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      ranges.push([m.index, m.index + m[0].length]);
    }
    return ranges;
  }
  const hay = insensitive ? text.toLowerCase() : text;
  let at = hay.indexOf(query);
  let guard = 0;
  while (at !== -1 && guard++ < 60) {
    ranges.push([at, at + query.length]);
    at = hay.indexOf(query, at + query.length);
  }
  return ranges;
}
function highlightText(text, ranges) {
  if (!ranges || ranges.length === 0) return text;
  const out = [];
  let last = 0;
  for (const [s, e] of ranges) {
    if (s < last) continue;
    if (s > last) out.push(text.slice(last, s));
    out.push(h("b", { key: `m${s}`, className: "ce-shl" }, text.slice(s, e)));
    last = e;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function SearchPanel({ t, cwd, state, onQuery, onInclude, onDirectory, onToggleRegex, onToggleWords, onSubmit, onPick, onClose, onNotify }) {
  const inputRef = useRef(null);
  const [expanded, setExpanded] = useState(() => /* @__PURE__ */ new Set());
  const [ctxCache, setCtxCache] = useState({});
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceText, setReplaceText] = useState("");
  const [replaceBusy, setReplaceBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const confirmRef = useDismissLayer({ open: confirmAll, onDismiss: () => setConfirmAll(false) });
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setExpanded(/* @__PURE__ */ new Set());
    setConfirmAll(false);
  }, [state.results]);
  const ctxKey = (r) => `${r.path}:${r.line}`;
  const hl = (text) => highlightText(text, matchRanges(text, state.query ?? "", state.regex === true));
  const groups = useMemo(() => {
    const out = [];
    const byPath2 = /* @__PURE__ */ new Map();
    for (const r of state.results ?? []) {
      let g = byPath2.get(r.path);
      if (!g) {
        g = { path: r.path, items: [] };
        byPath2.set(r.path, g);
        out.push(g);
      }
      g.items.push(r);
    }
    return out;
  }, [state.results]);
  const [collapsed, setCollapsed] = useState(() => /* @__PURE__ */ new Set());
  useEffect(() => {
    setCollapsed(/* @__PURE__ */ new Set());
  }, [state.results]);
  const toggleGroup = (path) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });
  const runReplace = async (paths2) => {
    if (replaceBusy || paths2.length === 0) return;
    setReplaceBusy(true);
    let files = 0;
    let hits = 0;
    const errors = [];
    const capped = paths2.slice(0, 200);
    for (const path of capped) {
      const res = await api("fs.read", { cwd, path });
      if (!res.ok || res.value.kind !== "text") {
        errors.push(path);
        continue;
      }
      if (res.value.truncated === true) {
        errors.push(`${path}: ${t("search.replaceTruncated")}`);
        continue;
      }
      const r = replaceInText(res.value.content, state.query, replaceText, { regex: state.regex === true, words: state.words === true });
      if (r.count === 0) continue;
      const w = await api("fs.write", { cwd, path, content: r.text, baseMtime: res.value.mtimeMs });
      if (!w.ok) {
        errors.push(`${path}: ${w.error}`);
        continue;
      }
      files += 1;
      hits += r.count;
    }
    setReplaceBusy(false);
    setConfirmAll(false);
    setCtxCache({});
    if (hits > 0) onNotify?.(t("search.replaceDone", { hits, files }));
    else onNotify?.(t("search.replaceNone"), "error");
    if (errors.length > 0) onNotify?.(`${t("search.replaceFail", { n: errors.length })}: ${errors[0]}`, "error");
    if (paths2.length > capped.length) onNotify?.(t("search.replaceCapped"), "error");
    onSubmit();
  };
  const toggleCtx = (r) => {
    const key = ctxKey(r);
    const next = new Set(expanded);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      if (!ctxCache[r.path]) {
        setCtxCache((c) => ({ ...c, [r.path]: { loading: true } }));
        api("fs.read", { cwd, path: r.path }).then((res) => {
          if (!res.ok || res.value.kind !== "text") {
            setCtxCache((c) => ({ ...c, [r.path]: { error: res.error ?? t("search.ctxFail") } }));
            return;
          }
          setCtxCache((c) => {
            const next2 = { ...c, [r.path]: { lines: res.value.content.split("\n") } };
            const keys = Object.keys(next2);
            while (keys.length > 30) delete next2[keys.shift()];
            return next2;
          });
        });
      }
    }
    setExpanded(next);
  };
  const renderCtx = (r) => {
    const entry = ctxCache[r.path];
    if (!entry || entry.loading) return h("div", { className: "ce-sctx-note" }, t("search.ctxLoad"));
    if (entry.error) return h("div", { className: "ce-sctx-note" }, `${t("search.ctxFail")}: ${entry.error}`);
    const from = Math.max(1, r.line - 3);
    const to = Math.min(entry.lines.length, r.line + 3);
    const rows = [];
    for (let n = from; n <= to; n++) {
      rows.push(h(
        "button",
        {
          key: n,
          type: "button",
          className: `ce-sctx-line${n === r.line ? " ce-sctx-hit" : ""}`,
          title: `${r.path}:${n}`,
          onClick: () => onPick({ path: r.path, line: n })
        },
        h("span", { className: "ce-sctx-no" }, String(n)),
        h("span", { className: "ce-sctx-text" }, hl(entry.lines[n - 1] ?? ""))
      ));
    }
    return h("div", { className: "ce-sctx" }, rows);
  };
  return h(
    "div",
    { className: "ce-search" },
    h(
      "div",
      { className: "ce-search-scope" },
      h("strong", null, t(state.scope?.kind === "changes" ? "search.changesAction" : state.scope?.kind === "directory" ? "search.directoryAction" : "changes.searchWorkspace")),
      h("span", null, state.scope?.kind === "changes" ? t("search.changesHint") : state.scope?.kind === "directory" ? state.scope.directory : t("search.workspaceScope")),
      h("button", { type: "button", className: "ce-tool", "aria-label": t("close"), title: t("close"), onClick: onClose }, "✕")
    ),
    state.scope?.kind !== "changes" ? h(
      "label",
      { className: "ce-search-directory" },
      h("span", null, t("search.directoryLabel")),
      h("input", { className: "ce-input", "aria-label": t("search.directoryLabel"), placeholder: t("search.directoryPlaceholder"), value: state.scope?.directory ?? "", onChange: (e) => onDirectory?.(e.target.value) })
    ) : null,
    state.scope?.kind === "changes" && state.scopeInfo?.files === 0 ? h("div", { className: "ce-note", role: "status" }, t("search.noChangedFiles")) : null,
    h(
      "div",
      { className: "ce-search-box" },
      h("button", { className: `ce-tool ce-tiny${replaceOpen ? " ce-tool-on" : ""}`, type: "button", title: t("search.replaceToggle"), onClick: () => setReplaceOpen((v) => !v) }, replaceOpen ? "▾" : "▸"),
      h("input", {
        ref: inputRef,
        className: "ce-input ce-search-q",
        type: "text",
        placeholder: t(state.scope?.kind === "changes" ? "search.changesPlaceholder" : "search.placeholder"),
        value: state.query,
        onChange: (event) => onQuery(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          } else if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        },
        spellcheck: false,
        autoCapitalize: "off",
        autoComplete: "off"
      }),
      h("button", { className: `ce-tool ce-tiny${state.regex ? " ce-tool-on" : ""}`, type: "button", title: t("search.regex"), onClick: onToggleRegex }, ".*"),
      h("button", { className: `ce-tool ce-tiny${state.words ? " ce-tool-on" : ""}`, type: "button", title: t("search.words"), onClick: onToggleWords }, "ab |"),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: t("search.run"), onClick: onSubmit }, h(IconSearch))
    ),
    replaceOpen ? h(
      "div",
      { className: "ce-search-box" },
      h("input", {
        className: "ce-input ce-search-q",
        type: "text",
        placeholder: t("search.replacePlaceholder"),
        value: replaceText,
        onChange: (event) => {
          setReplaceText(event.target.value);
          setConfirmAll(false);
        },
        onKeyDown: (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (groups.length > 0) void runReplace(groups.map((g) => g.path));
          } else if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        },
        spellcheck: false,
        autoCapitalize: "off",
        autoComplete: "off"
      }),
      h("button", {
        className: "ce-sk-btn",
        ref: confirmRef,
        type: "button",
        disabled: replaceBusy || groups.length === 0 || state.query.trim().length < 2,
        title: t("search.replaceAll"),
        onClick: () => {
          if (!confirmAll) {
            setConfirmAll(true);
            return;
          }
          void runReplace(groups.map((g) => g.path));
        }
      }, replaceBusy ? "…" : confirmAll ? t("search.replaceConfirm", { n: groups.length }) : t("search.replaceAll"))
    ) : null,
    h("input", {
      className: "ce-input ce-search-include",
      type: "text",
      placeholder: t("search.include"),
      value: state.include,
      onChange: (event) => onInclude(event.target.value),
      onKeyDown: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
      },
      spellcheck: false,
      autoCapitalize: "off",
      autoComplete: "off"
    }),
    h(
      "div",
      { className: "ce-search-meta" },
      state.busy ? t("search.searching") : state.results ? `${state.results.length} ${t("search.results")}${state.engine ? ` · ${state.engine}` : ""}${state.truncated ? ` · ${t("search.truncated")}` : ""}` : state.query.trim().length < 2 ? t("search.empty") : t("search.none")
    ),
    state.error ? h("div", { className: "ce-note" }, `${t("search.failed")}: ${state.error}`) : null,
    h(
      "div",
      { className: "ce-search-results ce-scroll" },
      groups.map((g) => {
        const isCollapsed = collapsed.has(g.path);
        return h(
          Fragment,
          { key: g.path },
          h(
            "div",
            { className: "ce-sgroup-row" },
            h(
              "button",
              {
                type: "button",
                className: "ce-sgroup",
                title: g.path,
                "aria-expanded": isCollapsed ? "false" : "true",
                onClick: () => toggleGroup(g.path)
              },
              h("span", { className: `cet-tw${isCollapsed ? "" : " cet-tw-open"}` }, "▶"),
              h("span", { className: "ce-sgroup-path" }, RelPath(cwd, g.path) || g.path),
              h("span", { className: "ce-sgroup-count" }, String(g.items.length))
            ),
            replaceOpen ? h("button", {
              type: "button",
              className: "ce-tool ce-tiny ce-sgroup-rep",
              title: t("search.replaceFile"),
              disabled: replaceBusy || state.query.trim().length < 2,
              onClick: () => void runReplace([g.path])
            }, "⇄") : null
          ),
          isCollapsed ? null : g.items.map(
            (r) => h(
              Fragment,
              { key: `${r.path}:${r.line}` },
              h(
                "div",
                { className: "ce-srow" },
                h("button", {
                  type: "button",
                  className: "ce-sctx-toggle",
                  title: t("search.ctx"),
                  "aria-expanded": expanded.has(ctxKey(r)) ? "true" : "false",
                  onClick: () => toggleCtx(r)
                }, expanded.has(ctxKey(r)) ? "▾" : "▸"),
                h(
                  "button",
                  { type: "button", className: "ce-sresult", onClick: () => onPick(r) },
                  h("span", { className: "ce-sloc" }, `:${r.line}`),
                  h("span", { className: "ce-stext" }, hl(r.text))
                )
              ),
              expanded.has(ctxKey(r)) ? renderCtx(r) : null
            )
          )
        );
      })
    )
  );
}

// src/client/codeview.js
function buildTokenCells(text, lang, state, lineNo, flash, current) {
  const runs = tokenizeLine(text, lang, state);
  const jumpable = lang === "go" || lang === "js" || lang === "py";
  const curStart = current && current.line === lineNo ? (current.col ?? 1) - 1 : null;
  const curEnd = curStart !== null ? curStart + String(current.text ?? "").length : null;
  const cells = [];
  runs.forEach((run, r) => {
    const marked = flash && flash.col != null && run.startCol === flash.col && flash.word && run.s === flash.word;
    const segments = curStart !== null ? splitRunAt(run, curStart, curEnd) : [{ s: run.s, in: false, offset: 0 }];
    for (const seg of segments) {
      const cls = `ce-t ${run.cls}${jumpable ? " ce-jump" : ""}${marked ? " ce-mark" : ""}${seg.in ? " ce-mark-cur" : ""}`;
      const hookable = run.cls === "ce-id" || run.cls === "ce-type" || run.cls === "ce-kw";
      cells.push(h(
        "span",
        {
          key: `${r}:${seg.offset}`,
          className: cls,
          ...hookable && jumpable ? { "data-ce-l": lineNo, "data-ce-c": (run.startCol ?? 1) + seg.offset, "data-ce-w": run.word ?? "" } : {}
        },
        seg.s
      ));
    }
  });
  return cells;
}
function splitRunAt(run, start, end) {
  const rs = (run.startCol ?? 1) - 1;
  const re = rs + run.s.length;
  if (end <= rs || start >= re) return [{ s: run.s, in: false, offset: 0 }];
  const from = Math.max(0, start - rs);
  const to = Math.min(run.s.length, end - rs);
  const out = [];
  if (from > 0) out.push({ s: run.s.slice(0, from), in: false, offset: 0 });
  if (to > from) out.push({ s: run.s.slice(from, to), in: true, offset: from });
  if (to < run.s.length) out.push({ s: run.s.slice(to), in: false, offset: to });
  return out;
}
function computeVisible({ doc, scroll, viewport, diagByLine, flash, current, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit, onDelPreview }) {
  if (!doc) return null;
  const extraAt = (line) => {
    let n = 0;
    for (const a of delAnchors) {
      if (a <= line) n++;
      else break;
    }
    return n * ROW;
  };
  const yOf = (i) => i * ROW + extraAt(i + 1);
  let lo = 0;
  let hi = doc.lines.length;
  const topTarget = scroll - 8 * ROW;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (yOf(mid) < topTarget) lo = mid + 1;
    else hi = mid;
  }
  const start = Math.max(0, lo - 2);
  const lang = langFor(doc.path);
  const rows = [];
  const blameRows = [];
  for (let i = start; i < doc.lines.length && yOf(i) <= scroll + viewport + 8 * ROW; i++) {
    const lineFlash = flash && flash.line === i + 1 ? flash : null;
    const lineChanged = diffMarks !== null && diffMarks.has(i + 1);
    const cells = buildTokenCells(doc.lines[i], lang, doc.states[i], i + 1, lineFlash, current);
    const lineDiags = diagByLine.get(i + 1);
    const underlines = (lineDiags ?? []).map((item, d) => {
      const endCol = item.endLine === item.line ? Math.min(item.endCol, item.startCol + 200) : item.startCol + 200;
      return h("span", {
        key: `u${d}`,
        className: `ce-underline${item.severity === 2 ? " ce-underline-warn" : ""}`,
        title: `${item.source ? `${item.source}: ` : ""}${item.message}`,
        style: { left: `${(item.startCol - 1) * 7.8}px`, width: `${Math.min(1600, Math.max(6, (endCol - item.startCol) * 7.8))}px` }
      });
    });
    rows.push(
      h(
        "div",
        { key: i, className: `ce-line${lineFlash ? " ce-flash" : ""}${lineChanged ? " ce-line-changed" : ""}`, style: { transform: `translateY(${yOf(i)}px)` } },
        cells.length ? cells : h("span", { className: "ce-t" }, " "),
        ...underlines
      )
    );
    if (blameOn && blame !== null) {
      const info = blame.get(i + 1);
      const prevInfo = blame.get(i);
      const uncommitted = info !== void 0 && /^0{40}$/.test(info.sha);
      const first = info !== void 0 && (prevInfo === void 0 || prevInfo.sha !== info.sha);
      blameRows.push(h("button", {
        key: i,
        type: "button",
        className: `ce-bline${uncommitted ? " ce-bline-uncommitted" : ""}`,
        style: { transform: `translateY(${yOf(i)}px)` },
        title: info ? `${info.author ?? ""} ${info.mail ?? ""} · ${info.summary ?? ""} · ${info.sha.slice(0, 8)}` : "",
        ...info !== void 0 && !uncommitted ? { onClick: () => void openCommit({ hash: info.sha }) } : {}
      }, uncommitted ? t("blame.uncommitted") : first ? `${info.author} · ${relTime(info.time)}` : ""));
    }
  }
  delAnchors.forEach((a, idx) => {
    const y = (a - 1) * ROW + idx * ROW;
    if (y + ROW < scroll - 60 || y > scroll + viewport + 60) return;
    const deleted = delGroups.get(a) ?? [];
    rows.push(h("button", {
      key: `del:${a}`,
      type: "button",
      className: "ce-delbar",
      style: { transform: `translateY(${y}px)` },
      title: t("diff.deletedAt"),
      onClick: () => onDelPreview({ anchor: a, lines: deleted })
    }, `− ${deleted.length} ${t("diff.deletedLines")}`));
  });
  return { rows, blameRows, start, end: doc.lines.length, total: (doc.lines.length + 2) * ROW + delAnchors.length * ROW };
}
function computeGutter({ doc, scroll, viewport, cursor, findLines, current, diffMarks, delAnchors }) {
  if (!doc) return null;
  const extraAt = (line) => {
    let n = 0;
    for (const a of delAnchors) {
      if (a <= line) n++;
      else break;
    }
    return n * ROW;
  };
  const yOf = (i) => i * ROW + extraAt(i + 1);
  let lo = 0;
  let hi = doc.lines.length;
  const topTarget = scroll - 8 * ROW;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (yOf(mid) < topTarget) lo = mid + 1;
    else hi = mid;
  }
  const start = Math.max(0, lo - 2);
  const rows = [];
  for (let i = start; i < doc.lines.length && yOf(i) <= scroll + viewport + 8 * ROW; i++) {
    rows.push(
      h(
        "div",
        { key: i, className: `ce-gline${cursor?.line === i + 1 ? " ce-gline-active" : ""}${findLines.has(i + 1) ? " ce-gline-find" : ""}${current?.line === i + 1 ? " ce-gline-find-cur" : ""}${diffMarks !== null && diffMarks.has(i + 1) ? " ce-gline-changed" : ""}`, style: { transform: `translateY(${yOf(i)}px)` } },
        String(i + 1)
      )
    );
  }
  return rows;
}
var WRAP_LINE_CAP = 5e3;
function computeWrapRows({ doc, flash, current, diffMarks, delAnchors, delGroups, cursor, findLines, t, onDelPreview }) {
  if (!doc) return null;
  const lang = langFor(doc.path);
  const total = doc.lines.length;
  const limit = Math.min(total, WRAP_LINE_CAP);
  const rows = [];
  let delIdx = 0;
  const pushDelBar = (anchor) => {
    const deleted = delGroups?.get(anchor) ?? [];
    rows.push(h("button", {
      key: `del:${anchor}`,
      type: "button",
      className: "ce-delbar ce-delbar-flow",
      title: t("diff.deletedAt"),
      onClick: () => onDelPreview({ anchor, lines: deleted })
    }, `− ${deleted.length} ${t("diff.deletedLines")}`));
  };
  for (let i = 0; i < limit; i++) {
    while (delIdx < delAnchors.length && delAnchors[delIdx] <= i + 1) pushDelBar(delAnchors[delIdx++]);
    const lineNo = i + 1;
    const lineFlash = flash && flash.line === lineNo ? flash : null;
    const lineChanged = diffMarks !== null && diffMarks.has(lineNo);
    const cells = buildTokenCells(doc.lines[i], lang, doc.states[i], lineNo, lineFlash, current);
    rows.push(h(
      "div",
      {
        key: i,
        "data-wl": lineNo,
        className: `ce-wline${lineFlash ? " ce-flash" : ""}${lineChanged ? " ce-line-changed" : ""}`
      },
      h("span", {
        className: `ce-wlineno${cursor?.line === lineNo ? " ce-wlineno-active" : ""}${findLines.has(lineNo) ? " ce-gline-find" : ""}${lineChanged ? " ce-gline-changed" : ""}`
      }, String(lineNo)),
      h("span", { className: "ce-wtext" }, cells.length ? cells : " ")
    ));
  }
  while (delIdx < delAnchors.length) pushDelBar(delAnchors[delIdx++]);
  return { rows, capped: total > limit };
}
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function compileFindRe(query, opts) {
  if (!query) return null;
  let src = String(query);
  if (!opts?.regex) src = escapeRe(src);
  if (opts?.words) src = `\\b(?:${src})\\b`;
  try {
    return new RegExp(src, opts?.caseSensitive ? "g" : "gi");
  } catch {
    return false;
  }
}
function findRangesInLine(line, re) {
  const out = [];
  if (!re || re === true || typeof re.exec !== "function") return out;
  re.lastIndex = 0;
  let m;
  let guard = 0;
  while ((m = re.exec(line)) !== null && guard++ < 500) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}
function preserveCaseReplace(matchText, pattern) {
  const match = String(matchText ?? "");
  const repl = String(pattern ?? "");
  if (match === "") return repl;
  const segmented = (sep) => match.includes(sep) && repl.includes(sep) && match.split(sep).length === repl.split(sep).length;
  const hasHyphens = segmented("-");
  const hasUnderscores = segmented("_");
  if (hasHyphens && !hasUnderscores) return segmentReplace(match, repl, "-");
  if (!hasHyphens && hasUnderscores) return segmentReplace(match, repl, "_");
  if (match.toUpperCase() === match) return repl.toUpperCase();
  if (match.toLowerCase() === match) return repl.toLowerCase();
  if (/[A-Z]/.test(match[0]) && repl.length > 0) return repl[0].toUpperCase() + repl.slice(1);
  if (match[0].toUpperCase() !== match[0] && repl.length > 0) return repl[0].toLowerCase() + repl.slice(1);
  return repl;
}
function segmentReplace(match, repl, sep) {
  const matchParts = match.split(sep);
  return repl.split(sep).map((part, i) => preserveCaseReplace(matchParts[i] ?? "", part)).join(sep);
}
function applyReplace(lines2, matches, replaceText, { all = false, index = 0, regexRe = null, preserveCase = false } = {}) {
  if (!Array.isArray(lines2) || !Array.isArray(matches) || matches.length === 0) return null;
  const targets = all ? matches : [matches[index]].filter(Boolean);
  if (targets.length === 0) return null;
  const replacementFor = (match) => {
    const text = String(replaceText ?? "");
    if (regexRe && typeof regexRe.source === "string" && text.includes("$")) {
      try {
        const flags = String(regexRe.flags ?? "").replace(/g/g, "");
        return String(match.text ?? "").replace(new RegExp(regexRe.source, flags), text);
      } catch {
        return text;
      }
    }
    return preserveCase ? preserveCaseReplace(match.text, text) : text;
  };
  const next = lines2.slice();
  const byLine = /* @__PURE__ */ new Map();
  for (const m of targets) {
    const rows = byLine.get(m.line) ?? [];
    rows.push(m);
    byLine.set(m.line, rows);
  }
  let count = 0;
  for (const [lineNo, rows] of byLine) {
    const at = lineNo - 1;
    if (at < 0 || at >= next.length) continue;
    let text = String(next[at] ?? "");
    rows.sort((a, b) => (b.col ?? 1) - (a.col ?? 1));
    for (const m of rows) {
      const start = Math.max(0, (m.col ?? 1) - 1);
      const len = String(m.text ?? "").length;
      if (len === 0 || text.slice(start, start + len) !== m.text) continue;
      text = text.slice(0, start) + replacementFor(m) + text.slice(start + len);
      count++;
    }
    next[at] = text;
  }
  if (count === 0) return null;
  return { lines: next, count };
}

// src/client/tabs.js
function closeOtherTabs(tabs, keep) {
  const list = Array.isArray(tabs) ? tabs : [];
  return list.filter((p) => p === keep);
}
function closeTabsToRight(tabs, anchor) {
  const list = Array.isArray(tabs) ? tabs : [];
  const at = list.indexOf(anchor);
  return at < 0 ? list : list.slice(0, at + 1);
}
function removedPaths(prev, next) {
  const kept = new Set(Array.isArray(next) ? next : []);
  return (Array.isArray(prev) ? prev : []).filter((p) => !kept.has(p));
}
function pushClosedTab(stack, entry, cap = 10) {
  const list = Array.isArray(stack) ? stack : [];
  if (!entry || typeof entry.path !== "string" || entry.path === "") return list;
  return [entry, ...list].slice(0, Math.max(1, cap));
}
function popClosedTab(stack) {
  const list = Array.isArray(stack) ? stack : [];
  return [list[0] ?? null, list.slice(1)];
}
function excludePinned(paths2, pinned) {
  const pins = new Set(Array.isArray(pinned) ? pinned : []);
  return (Array.isArray(paths2) ? paths2 : []).filter((p) => !pins.has(p));
}
function pinTab(tabs, path) {
  const list = Array.isArray(tabs) ? tabs : [];
  if (!list.includes(path)) return list;
  return [path, ...list.filter((p) => p !== path)];
}

// src/client/usegit.js
function useGitActions({ cwd, t, say, git, setGit, repoSelRef, refreshGit, loadFile, docRef, cursorRef, modeRef }) {
  const [sync, setSync] = useState({ busy: false });
  const [committing, setCommitting] = useState(false);
  const doFetch = useCallback(async () => {
    if (!cwd || sync.busy) return;
    setSync({ busy: true });
    say(t("sync.fetching"));
    const res = await api("git.fetch", repoSelRef.current ? { cwd, repo: repoSelRef.current } : { cwd });
    setSync({ busy: false });
    if (!res.ok) {
      say(t("sync.fetchFail", { msg: res.error }), "error");
      return;
    }
    const st = res.value?.status;
    if (st) setGit(st);
    if (res.value?.error) {
      say(t("sync.fetchFail", { msg: res.value.error }), "error");
      return;
    }
    if (!st || !st.repo) return;
    say(st.behind > 0 ? t("sync.behind", { n: st.behind }) : st.ahead > 0 ? t("sync.localAhead", { n: st.ahead }) : t("sync.upToDate"));
  }, [cwd, sync.busy, say, t]);
  const doPull = useCallback(async () => {
    if (!cwd || sync.busy) return;
    setSync({ busy: true });
    say(t("sync.pulling"));
    const before = git?.behind ?? 0;
    const res = await api("git.pull", repoSelRef.current ? { cwd, repo: repoSelRef.current } : { cwd });
    setSync({ busy: false });
    if (!res.ok) {
      say(t("sync.pullFail", { msg: res.error }), "error");
      return;
    }
    const value = res.value ?? {};
    if (value.status) setGit(value.status);
    if (value.error) {
      const st = value.status;
      if (st && st.ahead > 0 && st.behind > 0) say(t("sync.diverged"), "error");
      else say(t("sync.pullFail", { msg: value.error }), "error");
      return;
    }
    if (/Already up to date/i.test(value.output ?? "")) {
      say(t("sync.upToDate"));
      return;
    }
    const n = value.behindBefore ?? before;
    say(n ? t("sync.pulled", { n }) : t("sync.upToDate"));
    const cur = docRef.current;
    if (cur && modeRef.current === "code") {
      const c = cursorRef.current;
      void loadFile(cur.path, c?.line ?? 1, c?.col ?? 1);
    }
  }, [cwd, sync.busy, git, say, t, loadFile]);
  const doPush = useCallback(async () => {
    if (!cwd || sync.busy) return;
    setSync({ busy: true });
    say(t("sync.pushing"));
    const res = await api("git.push", repoSelRef.current ? { cwd, repo: repoSelRef.current } : { cwd });
    setSync({ busy: false });
    if (!res.ok) {
      say(t("sync.pushFail", { msg: res.error }), "error");
      return;
    }
    const value = res.value ?? {};
    if (value.status) setGit(value.status);
    if (value.error) {
      say(t("sync.pushFail", { msg: value.error }), "error");
      return;
    }
    say(value.published ? t("sync.published") : t("sync.pushed"));
  }, [cwd, sync.busy, say, t]);
  const discardChange = useCallback(async (item) => {
    if (!cwd) return;
    const repo = repoSelRef.current;
    const res = await api("git.discard", repo ? { cwd, path: item.path, repo, ch: item.ch } : { cwd, path: item.path, ch: item.ch });
    if (!res.ok) {
      say(`${t("error")}: ${res.error}`, "error");
      return;
    }
    say(t("changes.discarded"));
    refreshGit();
    if (docRef.current?.path === item.path) void loadFile(item.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
  }, [cwd, say, t, refreshGit, loadFile]);
  const discardMany = useCallback(async (dirItems) => {
    if (!cwd || !Array.isArray(dirItems) || dirItems.length === 0) return;
    const repo = repoSelRef.current;
    let okCount = 0;
    const errors = [];
    const revertable = dirItems.filter((item) => item?.ch !== "U");
    const skipped = dirItems.length - revertable.length;
    for (const item of revertable) {
      const res = await api("git.discard", repo ? { cwd, path: item.path, repo, ch: item.ch } : { cwd, path: item.path, ch: item.ch });
      if (res.ok && !res.value?.error) okCount += 1;
      else errors.push(`${item.path}: ${res.value?.error ?? res.error}`);
    }
    if (okCount > 0) say(t("changes.discardedN", { n: okCount }));
    if (errors.length > 0) say(`${t("error")}: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1})` : ""}`, "error");
    else if (skipped > 0 && okCount === 0) say(t("changes.untrackedSkip", { n: skipped }), "error");
    refreshGit();
    const openPath = docRef.current?.path;
    if (openPath && dirItems.some((i) => i.path === openPath)) void loadFile(openPath, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
  }, [cwd, say, t, refreshGit, loadFile]);
  const toRepoSafePath = (path) => {
    const clean = String(path ?? "");
    if (clean.startsWith("/")) return clean;
    const root = String(git?.root ?? "");
    return root === "" ? clean : `${root}/${clean}`;
  };
  const deleteUntracked = useCallback(async (item) => {
    if (!cwd || !item?.path) return false;
    const res = await api("fs.delete", { cwd, path: toRepoSafePath(item.path) });
    if (!res.ok || res.value?.error) {
      say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
      return false;
    }
    say(t("changes.deleted", { path: item.path }));
    refreshGit();
    if (docRef.current?.path === item.path) loadFile(item.path, 1, 1).catch(() => {
    });
    return true;
  }, [cwd, git, say, t, refreshGit, loadFile, docRef]);
  const deleteUntrackedMany = useCallback(async (dirPath, dirItems) => {
    if (!cwd) return 0;
    const targets = Array.isArray(dirItems) && dirItems.length > 0 ? dirItems : [{ path: dirPath }];
    let done = 0;
    for (const item of targets) {
      const res = await api("fs.delete", { cwd, path: toRepoSafePath(item.path) });
      if (!res.ok || res.value?.error) {
        say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
        continue;
      }
      done += 1;
      if (docRef.current?.path === item.path) loadFile(item.path, 1, 1).catch(() => {
      });
    }
    if (done > 0) {
      say(t("changes.deletedN", { n: done }));
      refreshGit();
    }
    return done;
  }, [cwd, git, say, t, refreshGit, loadFile, docRef]);
  const stageChange = useCallback(async (path) => {
    if (!cwd) return false;
    const repo = repoSelRef.current;
    const res = await api("git.stage", repo ? { cwd, path, repo } : { cwd, path });
    if (!res.ok || res.value?.error) {
      say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
      return false;
    }
    if (res.value.status) setGit(res.value.status);
    return true;
  }, [cwd, say, t]);
  const unstageChange = useCallback(async (path) => {
    if (!cwd) return false;
    const repo = repoSelRef.current;
    const res = await api("git.unstage", repo ? { cwd, path, repo } : { cwd, path });
    if (!res.ok || res.value?.error) {
      say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
      return false;
    }
    if (res.value.status) setGit(res.value.status);
    return true;
  }, [cwd, say, t]);
  const commitChanges = useCallback(async (message, stageAll, amend) => {
    if (!cwd || committing) return false;
    setCommitting(true);
    try {
      const repo = repoSelRef.current;
      if (stageAll) {
        const sres = await api("git.stage", repo ? { cwd, path: "", repo } : { cwd, path: "" });
        if (!sres.ok || sres.value?.error) {
          say(`${t("error")}: ${sres.value?.error ?? sres.error}`, "error");
          return false;
        }
        if (sres.value.status) setGit(sres.value.status);
      }
      const res = await api("git.commit", repo ? { cwd, message, amend: amend === true, repo } : { cwd, message, amend: amend === true });
      const value = res.ok ? res.value ?? {} : { error: res.error };
      if (value.status) setGit(value.status);
      if (!res.ok || value.error) {
        say(`${t("error")}: ${value.error ?? res.error}`, "error");
        return false;
      }
      say(t("changes.committed", { c: value.commit ?? "" }));
      return true;
    } finally {
      setCommitting(false);
    }
  }, [cwd, committing, say, t]);
  return { sync, committing, doFetch, doPull, doPush, discardChange, discardMany, stageChange, unstageChange, commitChanges };
}

// src/client/usepersistence.js
function useNavPersistence(params) {
  const {
    persistKey,
    cwd,
    doc,
    cursor,
    scroll,
    mode,
    railW,
    railVisible,
    wrapOn,
    findOpts,
    tabs,
    pinned,
    histTick,
    histRef,
    docRef,
    codeRef,
    loadFile,
    setRailW,
    setRailVisible,
    setWrapOn,
    setFindOpts,
    setTabs,
    setPinned,
    setMode,
    setHistTick,
    setScroll
  } = params;
  const restoredFor = useRef(null);
  const latestPersistRef = useRef(null);
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!persistKey || !cwd || restoredFor.current === persistKey) return;
    restoredFor.current = persistKey;
    let blob = null;
    try {
      blob = JSON.parse(localStorage.getItem(persistKey) || "null");
    } catch {
    }
    if (!blob) return;
    if (Number.isFinite(blob.railW)) setRailW(Math.max(150, Math.min(760, blob.railW)));
    if (typeof blob.railVisible === "boolean") setRailVisible(blob.railVisible);
    if (typeof blob.wrapOn === "boolean") setWrapOn(blob.wrapOn);
    if (blob.findOpts && typeof blob.findOpts === "object") setFindOpts({ regex: blob.findOpts.regex === true, caseSensitive: blob.findOpts.caseSensitive === true, words: blob.findOpts.words === true });
    if (Array.isArray(blob.tabs)) setTabs(blob.tabs.filter((p) => typeof p === "string" && p !== "").slice(0, 15));
    if (Array.isArray(blob.pinned) && setPinned) setPinned(blob.pinned.filter((p) => typeof p === "string" && p !== "").slice(0, 15));
    if (typeof blob.mode === "string") setMode(blob.mode === "skills" ? "files" : blob.mode);
    if (blob.path && !docRef.current) {
      histRef.current = { back: Array.isArray(blob.back) ? blob.back : [], forward: Array.isArray(blob.forward) ? blob.forward : [] };
      setHistTick((v) => v + 1);
      void loadFile(blob.path, blob.line ?? 1, blob.col ?? 1, null).then(() => {
        if (Number.isFinite(blob.scroll) && codeRef.current) {
          codeRef.current.scrollTop = blob.scroll;
          setScroll(blob.scroll);
        }
      });
    }
  }, [persistKey, cwd, loadFile]);
  useEffect(() => {
    if (!persistKey) return;
    const payload = {
      path: doc?.path,
      line: cursor?.line,
      col: cursor?.col,
      scroll,
      mode,
      railW,
      railVisible,
      wrapOn,
      findOpts,
      tabs,
      pinned,
      back: histRef.current.back.slice(-40),
      forward: histRef.current.forward.slice(-40)
    };
    latestPersistRef.current = { key: persistKey, payload };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(persistKey, JSON.stringify(payload));
      } catch {
      }
    }, 700);
  }, [persistKey, doc, cursor, scroll, mode, railW, railVisible, wrapOn, findOpts, tabs, pinned, histTick]);
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const last = latestPersistRef.current;
    if (last) {
      try {
        localStorage.setItem(last.key, JSON.stringify(last.payload));
      } catch {
      }
    }
  }, []);
}

// src/client/watch.js
function parentDirs(paths2) {
  const dirs = /* @__PURE__ */ new Set();
  for (const p of paths2) dirs.add(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
  return [...dirs];
}
function docAction(paths2, docPath, dirty) {
  if (!docPath || !paths2.includes(docPath)) return "ignore";
  return dirty ? "conflict" : "reload";
}
function createWatchLoop({ poll, onChanges, onReset, onUnsupported, schedule = (fn) => setTimeout(fn, 0), unschedule = clearTimeout, maxBackoffMs = 6e4, supportedRetryMs = 3e4 }) {
  let stopped = false;
  let since = -1;
  let timer = null;
  let backoff = 1e3;
  const tick = async () => {
    if (stopped) return;
    const res = await poll({ since, waitMs: 2e4 });
    if (stopped) return;
    const v = res && res.ok ? res.value : null;
    if (!v || typeof v.seq !== "number") {
      timer = schedule(tick, backoff);
      backoff = Math.min(backoff * 2, maxBackoffMs);
      return;
    }
    backoff = 1e3;
    since = v.seq;
    if (v.supported === false) {
      onUnsupported?.();
      timer = schedule(tick, supportedRetryMs);
      return;
    }
    if (v.baseline) {
      timer = schedule(tick, 0);
      return;
    }
    if (v.reset) onReset?.();
    else if (v.paths && v.paths.length || v.git) onChanges?.(v);
    timer = schedule(tick, 0);
  };
  void tick();
  return {
    stop() {
      stopped = true;
      if (timer !== null) unschedule(timer);
    }
  };
}

// src/client/draftdiff.js
function draftDiskDiff(oldText, newText, path = "") {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  if (oldText === newText) return { text: "", add: 0, del: 0, identical: true };
  const ops = a.length * b.length > 4e6 ? coarseOps(a, b) : lcsOps(a, b);
  let add = 0;
  let del = 0;
  for (const op of ops) {
    if (op.kind === "add") add++;
    else if (op.kind === "del") del++;
  }
  const name = path || "file";
  const out = [`--- a/${name}`, `+++ b/${name}`];
  const CTX = 3;
  let i = 0;
  while (i < ops.length) {
    if (ops[i].kind === "ctx") {
      i++;
      continue;
    }
    let start = i;
    let back = 0;
    while (start > 0 && ops[start - 1].kind === "ctx" && back < CTX) {
      start--;
      back++;
    }
    let end = i;
    let j = i;
    while (j < ops.length) {
      if (ops[j].kind !== "ctx") {
        end = j + 1;
        j++;
        continue;
      }
      let run = 0;
      let k = j;
      while (k < ops.length && ops[k].kind === "ctx") {
        run++;
        k++;
      }
      if (k < ops.length && run <= CTX * 2) {
        j = k;
        continue;
      }
      end = Math.min(ops.length, j + CTX);
      break;
    }
    if (end <= i) end = Math.min(ops.length, i + 1);
    let oldLine = 1;
    let newLine = 1;
    for (let k = 0; k < start; k++) {
      if (ops[k].kind !== "add") oldLine++;
      if (ops[k].kind !== "del") newLine++;
    }
    let oldCount = 0;
    let newCount = 0;
    for (let k = start; k < end; k++) {
      if (ops[k].kind !== "add") oldCount++;
      if (ops[k].kind !== "del") newCount++;
    }
    out.push(`@@ -${oldLine},${oldCount} +${newLine},${newCount} @@`);
    for (let k = start; k < end; k++) {
      const op = ops[k];
      out.push(op.kind === "add" ? `+${op.text}` : op.kind === "del" ? `-${op.text}` : ` ${op.text}`);
    }
    i = end;
  }
  return { text: out.join("\n"), add, del, identical: false };
}
function splitLines(text) {
  const s = String(text ?? "");
  if (s === "") return [];
  const lines2 = s.split("\n");
  if (lines2.length > 1 && lines2[lines2.length - 1] === "") lines2.pop();
  return lines2;
}
function lcsOps(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i2 = n - 1; i2 >= 0; i2--) {
    for (let j2 = m - 1; j2 >= 0; j2--) {
      dp[i2][j2] = a[i2] === b[j2] ? dp[i2 + 1][j2 + 1] + 1 : Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "ctx", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "del", text: a[i] });
      i++;
    } else {
      ops.push({ kind: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ kind: "del", text: a[i++] });
  }
  while (j < m) {
    ops.push({ kind: "add", text: b[j++] });
  }
  return ops;
}
function coarseOps(a, b) {
  const ops = [];
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) {
    ops.push({ kind: "ctx", text: a[p] });
    p++;
  }
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  for (let i = p; i < a.length - s; i++) ops.push({ kind: "del", text: a[i] });
  for (let j = p; j < b.length - s; j++) ops.push({ kind: "add", text: b[j] });
  for (let k = a.length - s; k < a.length; k++) ops.push({ kind: "ctx", text: a[k] });
  return ops;
}

// src/client/editmode.js
function buildEditGutter(lineCount) {
  const rows = [];
  for (let i = 1; i <= lineCount; i++) {
    rows.push({ line: i, top: (i - 1) * ROW });
  }
  return rows;
}
function handleTabIndent(text, start, end, shift) {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineEnd = after.indexOf("\n");
  const blockEnd = lineEnd < 0 ? text.length : start + selected.length + lineEnd;
  const block = text.slice(lineStart, blockEnd);
  const lines2 = block.split("\n");
  let delta = 0;
  const newLines = lines2.map((line) => {
    if (shift) {
      if (line.startsWith("	")) {
        delta--;
        return line.slice(1);
      }
      const m = /^( {1,4})/.exec(line);
      if (m) {
        delta -= m[1].length;
        return line.slice(m[1].length);
      }
      return line;
    }
    delta++;
    return `	${line}`;
  });
  const newBlock = newLines.join("\n");
  const newText = text.slice(0, lineStart) + newBlock + text.slice(blockEnd);
  const newStart = start === end ? Math.max(lineStart, start + (newLines[0].length - lines2[0].length)) : Math.max(lineStart, start + (newLines[0].length - lines2[0].length));
  const newEnd = start === end ? newStart : Math.max(lineStart, end + delta);
  return { text: newText, start: newStart, end: newEnd };
}
function findInText(text, query, opts = {}) {
  if (!query) return [];
  const flags = (opts.caseSensitive ? "" : "i") + (opts.regex ? "" : "");
  let pattern;
  try {
    const escaped = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wrapped = opts.words ? `\\b${escaped}\\b` : escaped;
    pattern = new RegExp(wrapped, flags + "g");
  } catch {
    return [];
  }
  const ranges = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
    if (m[0].length === 0) pattern.lastIndex++;
  }
  return ranges;
}
function replaceInText2(text, query, replacement, opts = {}, idx = 0, all = false) {
  const ranges = findInText(text, query, opts);
  if (ranges.length === 0) return { text, count: 0 };
  if (opts.regex && replacement.includes("$") && /\$\d/.test(replacement)) {
    try {
      const flags = (opts.caseSensitive ? "" : "i") + (all ? "g" : "");
      const pattern = new RegExp(query, flags);
      const result = all ? text.replace(pattern, replacement) : text.replace(pattern, replacement);
      const count = all ? (text.match(pattern) ?? []).length : result !== text ? 1 : 0;
      return { text: result, count };
    } catch {
    }
  }
  if (all) {
    let result = "";
    let pos = 0;
    let count = 0;
    for (const r2 of ranges) {
      result += text.slice(pos, r2.start);
      result += expandReplacement(replacement, text.slice(r2.start, r2.end), opts.regex);
      pos = r2.end;
      count++;
    }
    result += text.slice(pos);
    return { text: result, count };
  }
  if (idx < 0 || idx >= ranges.length) return { text, count: 0 };
  const r = ranges[idx];
  const before = text.slice(0, r.start);
  const after = text.slice(r.end);
  const expanded = expandReplacement(replacement, text.slice(r.start, r.end), opts.regex);
  return { text: before + expanded + after, count: 1 };
}
function expandReplacement(replacement, matched, isRegex) {
  if (!isRegex || !replacement.includes("$")) return replacement;
  return replacement.replace(/\$&/g, matched);
}

// src/client/code.js
var PREVIEW_RE = /\.(md|markdown|html?|svg)$/i;
var MD_RE = /\.(md|markdown)$/i;
var SVG_RE = /\.svg$/i;
var LSP_RE = /\.(go|ts|tsx|js|jsx|mjs|cjs|py|pyi)$/i;
function addTabPath(list, path, cap = 15) {
  const prev = Array.isArray(list) ? list : [];
  if (typeof path !== "string" || path === "" || prev.includes(path)) return prev;
  const next = [...prev, path];
  while (next.length > cap) next.shift();
  return next;
}
function CodeBody(props) {
  const { useTabInfo, sessionId, useSessions, t, terminal, openBuiltinTerminal, builtinTerminal } = props;
  const terminalEntry = terminal ?? inertTerminalEntry;
  const builtinAvailable = () => Boolean(builtinTerminal?.()) && typeof openBuiltinTerminal === "function";
  const tabInfo = useTabInfo ? useTabInfo() : null;
  const tab = tabInfo?.tab;
  const cwd = useSessions ? useSessions((sessions) => sessionId ? sessions.byId[sessionId]?.cwd : void 0) : void 0;
  const [mode, setMode] = useState("files");
  const [doc, setDoc] = useState(null);
  const [diff, setDiff] = useState(null);
  const [git, setGit] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);
  const [workspaceDiag, setWorkspaceDiag] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [hover, setHover] = useState(null);
  const [status, setStatus] = useState({ state: "off", message: "", progress: "" });
  const [notice, setNotice] = useState({ text: "", kind: "info" });
  const [treeKey, setTreeKey] = useState(0);
  const [stale, setStale] = useState({ tick: 0, dirs: [] });
  const [externalConflict, setExternalConflict] = useState(null);
  const [conflictDiff, setConflictDiff] = useState(null);
  const [overwriteArm, setOverwriteArm] = useState(false);
  const [liveOn, setLiveOn] = useState(() => {
    try {
      return localStorage.getItem("dsh.plugin-kit.live") !== "off";
    } catch {
      return true;
    }
  });
  const [flash, setFlash] = useState(null);
  const [scroll, setScroll] = useState(0);
  const [viewport, setViewport] = useState(600);
  const [palette, setPalette] = useState(null);
  const [search, setSearch] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [peek, setPeek] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIdx, setFindIdx] = useState(0);
  const [findOpts, setFindOpts] = useState({ regex: false, caseSensitive: false, words: false });
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceText, setReplaceText] = useState("");
  const [preserveCase, setPreserveCase] = useState(false);
  const [editFindOpen, setEditFindOpen] = useState(false);
  const [editFindQuery, setEditFindQuery] = useState("");
  const [editFindIdx, setEditFindIdx] = useState(0);
  const [editReplaceText, setEditReplaceText] = useState("");
  const [editFindOpts, setEditFindOpts] = useState({ regex: false, caseSensitive: false, words: false });
  const editFindMatches = useMemo(() => editing ? findInText(editText, editFindQuery, editFindOpts) : [], [editing, editText, editFindQuery, editFindOpts]);
  const editGutter = useMemo(() => editing ? buildEditGutter(editText.split("\n").length) : null, [editing, editText]);
  const editTaRef = useRef(null);
  const [diffMarks, setDiffMarks] = useState(null);
  const [branchPickOpen, setBranchPickOpen] = useState(false);
  const [blameOn, setBlameOn] = useState(false);
  const [blame, setBlame] = useState(null);
  const [wrapOn, setWrapOn] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [fileHist, setFileHist] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [previewOn, setPreviewOn] = useState(false);
  const [delGroups, setDelGroups] = useState(null);
  const [delPreview, setDelPreview] = useState(null);
  const delPreviewRef = useDismissLayer({ open: Boolean(delPreview), onDismiss: () => setDelPreview(null) });
  const [showDiffView, setShowDiffView] = useState(true);
  const [railW, setRailW] = useState(230);
  const [railVisible, setRailVisible] = useState(true);
  const [mobileView, setMobileView] = useState("files");
  const [symbols, setSymbols] = useState([]);
  const [symPalette, setSymPalette] = useState(null);
  const [wsym, setWsym] = useState(null);
  const [formatOnSave, setFormatOnSave] = useState(() => {
    try {
      return localStorage.getItem("dsh.plugin-kit.format") !== "off";
    } catch {
      return true;
    }
  });
  const [commandOpen, setCommandOpen] = useState(false);
  const [fileDropOver, setFileDropOver] = useState(false);
  const [tabDropOver, setTabDropOver] = useState(null);
  const [commitsOpen, setCommitsOpen] = useState(false);
  const [compare, setCompare] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBranches, setCompareBranches] = useState([]);
  const [compareBusy, setCompareBusy] = useState(false);
  const [tasks, setTasks] = useState(null);
  const [task, setTask] = useState(null);
  const [seqBusy, setSeqBusy] = useState(false);
  const [tabMenu, setTabMenu] = useState(null);
  const [pinned, setPinned] = useState([]);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const tabMenuRef = useDismissLayer({ open: Boolean(tabMenu), onDismiss: () => setTabMenu(null) });
  const peekNonce = useRef(0);
  const paletteTimer = useRef(null);
  const searchTimer = useRef(null);
  const searchNonce = useRef(0);
  const symbolNonce = useRef(0);
  const hoverTimer = useRef(null);
  const hoverNonce = useRef(0);
  const hoverAtRef = useRef(null);
  const codeRef = useRef(null);
  const mainRef = useRef(null);
  const histRef = useRef({ back: [], forward: [] });
  const [histTick, setHistTick] = useState(0);
  const docRef = useRef(null);
  const cursorRef = useRef(null);
  const modeRef = useRef("code");
  const openSeqRef = useRef(0);
  const noticeTimer = useRef(null);
  const peekRef = useRef(null);
  const wrapOnRef = useRef(false);
  const tabViewRef = useRef({});
  const autoMarksTimer = useRef(null);
  const tabsRef = useRef(null);
  const closedTabsRef = useRef([]);
  const dirtyRef = useRef(false);
  dirtyRef.current = editing && editText !== (doc?.raw ?? "");
  docRef.current = doc;
  cursorRef.current = cursor;
  const diffRef = useRef(null);
  diffRef.current = diff;
  peekRef.current = peek;
  wrapOnRef.current = wrapOn;
  const say = useCallback((text, kind = "info") => {
    setNotice({ text, kind });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (kind !== "error") noticeTimer.current = setTimeout(() => setNotice({ text: "", kind: "info" }), 3800);
  }, []);
  useToolCloseGuard({ sessionId, kind: TAB_KIND, dirty: dirtyRef.current, onBlocked: () => say(t("editor.dirtyGuard"), "error") });
  const scrollAreaToLine = useCallback((line) => {
    const area = codeRef.current;
    if (!area) return;
    if (wrapOnRef.current) {
      const node = area.querySelector(`[data-wl="${line}"]`);
      if (node) {
        const nr = node.getBoundingClientRect();
        const ar = area.getBoundingClientRect();
        area.scrollTop += nr.top - ar.top - (area.clientHeight - nr.height) / 2;
      }
      setScroll(area.scrollTop);
      return;
    }
    area.scrollTop = Math.max(0, (line - 1) * ROW - area.clientHeight / 2);
    setScroll(area.scrollTop);
  }, []);
  const toggleWrap = useCallback(() => {
    const d = docRef.current;
    if (!wrapOnRef.current && d && d.lines.length > WRAP_LINE_CAP) {
      say(t("editor.wrapTooBig", { n: WRAP_LINE_CAP }), "error");
      return;
    }
    setWrapOn((v) => !v);
  }, [say, t]);
  const persistKey = sessionId && cwd ? `dsh.plugin-kit.v1.${sessionId}` : null;
  useEffect(() => {
    if (!cwd || status.state !== "starting" && !status.progress) return void 0;
    const timer = setInterval(() => {
      api("lsp.status", { cwd }).then((r) => r.ok && setStatus(r.value));
    }, 2500);
    return () => clearInterval(timer);
  }, [cwd, status.state, status.progress]);
  const refreshGit = useCallback(() => {
    if (!cwd) return;
    const repo = repoSelRef.current;
    api("git.status", repo ? { cwd, repo } : { cwd }).then((res) => {
      if (!res.ok) {
        setGit({ error: res.error });
        return;
      }
      const v = res.value;
      if (v && v.repo === false && Array.isArray(v.repos)) {
        setRepos(v.repos);
        if (v.repos.length && !repo) {
          const abs = docRef.current ? toAbs(cwd, docRef.current.path) : "";
          const pick = v.repos.find((r) => abs && (abs === r.root || abs.startsWith(`${r.root}/`))) ?? v.repos[0];
          repoSelRef.current = pick.root;
          setRepoSel(pick.root);
        }
        if (!v.repos.length && !repo) setGit({ repo: false, repos: [] });
        return;
      }
      setGit(v);
    });
  }, [cwd]);
  const [repos, setRepos] = useState(null);
  const [repoSel, setRepoSel] = useState(null);
  const repoSelRef = useRef(null);
  const fetchDiagnostics = useCallback((path, seq) => {
    if (!cwd || !LSP_RE.test(path)) return;
    const pull = () => {
      if (openSeqRef.current !== seq) return;
      api("lsp.diagnostics", { cwd, path }).then((res) => {
        if (res.ok && openSeqRef.current === seq) setDiagnostics(res.value.items ?? []);
      });
    };
    pull();
    setTimeout(pull, 1800);
    setTimeout(pull, 4500);
  }, [cwd]);
  const dismissPanels = useCallback(() => {
    setSearchOpen(false);
    setPalette(null);
    if (paletteTimer.current) clearTimeout(paletteTimer.current);
    setCommandOpen(false);
    setBranchPickOpen(false);
    setOverlay(null);
    setPeek(null);
    ++peekNonce.current;
    setHover(null);
    setFileHist(null);
    setGotoOpen(false);
    setSymPalette(null);
    setWsym(null);
    setDelPreview(null);
    setTabMenu(null);
    setProblemsOpen(false);
    setCompareOpen(false);
  }, []);
  useEffect(() => {
    if (tab?.visible === false) dismissPanels();
  }, [tab?.visible, dismissPanels]);
  const canNavigate = useCallback(() => {
    if (!dirtyRef.current) return true;
    say(t("editor.dirtyGuard"), "error");
    return false;
  }, [say, t]);
  const forgetPath = useCallback((path) => {
    const clean = String(path ?? "");
    if (clean === "") return;
    setTabs((prev) => prev.filter((p) => p !== clean && !p.startsWith(`${clean}/`)));
    const open = docRef.current?.path;
    if (open && (open === clean || open.startsWith(`${clean}/`))) {
      setDoc(null);
      setEditing(false);
      setDiffMarks(null);
      setDelGroups(null);
    }
  }, []);
  const loadFile = useCallback(
    async (path, line, col, mark, opts) => {
      if (!cwd || !opts?.background && !canNavigate()) return null;
      if (!opts?.background) dismissPanels();
      const res = await api("fs.read", { cwd, path });
      if (!res.ok) {
        if (opts?.checkExternal) say(t("watch.fileGone"), "error");
        else say(`${t("error")}: ${res.error}`, "error");
        return null;
      }
      if (opts?.checkExternal && !opts.force) {
        const cur = docRef.current;
        if (cur && cur.path === path && !cur.image) {
          if (res.value.kind === "text" && res.value.mtimeMs === cur.mtimeMs) return null;
          if (dirtyRef.current) {
            setExternalConflict({ path });
            return null;
          }
        }
      }
      if (res.value.kind === "image") {
        openSeqRef.current++;
        peekNonce.current++;
        const entry2 = {
          path,
          lines: [],
          states: new Uint8Array(0),
          raw: "",
          truncated: false,
          image: {
            mime: res.value.mime ?? "application/octet-stream",
            base64: res.value.base64 ?? "",
            size: res.value.size ?? 0,
            truncated: res.value.truncated === true
          }
        };
        setPeek(null);
        setEditing(false);
        setDiffMarks(null);
        setDelGroups(null);
        setDelPreview(null);
        setFileHist(null);
        setGotoOpen(false);
        setSymPalette(null);
        setPreviewOn(true);
        setDoc(entry2);
        if (!opts?.background) setMobileView("editor");
        setExternalConflict(null);
        modeRef.current = "code";
        setDiff(null);
        setCursor(null);
        setDiagnostics([]);
        setOverlay(null);
        setHover(null);
        setSymbols([]);
        symbolNonce.current++;
        setScroll(0);
        if (codeRef.current) codeRef.current.scrollTop = 0;
        return entry2;
      }
      if (res.value.kind !== "text") {
        say(t("binary"), "error");
        return null;
      }
      const text = res.value.content;
      const lines2 = text.split("\n");
      if (lines2.length > 1 && lines2[lines2.length - 1] === "") lines2.pop();
      const entry = { path, lines: lines2, states: buildLineStates(lines2, langFor(path)), truncated: res.value.truncated, raw: text, mtimeMs: res.value.mtimeMs };
      const seq = ++openSeqRef.current;
      peekNonce.current++;
      setPeek(null);
      setEditing(false);
      setDiffMarks(null);
      setDelGroups(null);
      setDelPreview(null);
      setFileHist(null);
      setGotoOpen(false);
      setSymPalette(null);
      setPreviewOn(PREVIEW_RE.test(path));
      const keepScroll = opts?.background ? codeRef.current?.scrollTop ?? 0 : 0;
      setDoc(entry);
      if (!opts?.background) setMobileView("editor");
      setExternalConflict(null);
      modeRef.current = "code";
      setDiff(null);
      const clampLine = Math.min(Math.max(1, line), Math.max(1, lines2.length));
      setCursor({ line: clampLine, col, word: wordAt(lines2[clampLine - 1] ?? "", col)?.word ?? "" });
      setDiagnostics([]);
      setOverlay(null);
      setHover(null);
      setSymbols([]);
      setScroll(opts?.background ? keepScroll : 0);
      if (codeRef.current) codeRef.current.scrollTop = opts?.background ? keepScroll : 0;
      if (LSP_RE.test(path)) {
        fetchDiagnostics(path, seq);
        api("lsp.request", { cwd, path, kind: "hover", line: 1, col: 1 }).then((warm) => {
          if (warm.ok && warm.value.status) setStatus((s) => ({ ...s, ...warm.value.status }));
        }).catch(() => {
        });
        const snonce = ++symbolNonce.current;
        api("lsp.request", { cwd, path, kind: "symbol" }).then((r) => {
          if (openSeqRef.current === seq && symbolNonce.current === snonce && r.ok) setSymbols(r.value.symbols ?? []);
        });
      } else {
        symbolNonce.current++;
      }
      if (!opts?.noAutoMarks && !opts?.background) {
        const markSeq = seq;
        if (autoMarksTimer.current) clearTimeout(autoMarksTimer.current);
        autoMarksTimer.current = setTimeout(() => {
          autoMarksTimer.current = null;
          if (openSeqRef.current !== markSeq) return;
          const repo = repoSelRef.current;
          api("git.diff", repo ? { cwd, path, scope: "working", repo } : { cwd, path, scope: "working" }).then((gres) => {
            if (openSeqRef.current !== markSeq || modeRef.current !== "code") return;
            const gval = gres.ok ? gres.value ?? {} : {};
            if (gval.error || gval.untracked || !gval.diff) return;
            const marks = changedNewLines(gval.diff);
            const dels = deletedGroups(gval.diff);
            if (marks.size === 0 && dels.size === 0) return;
            setDiffMarks((cur) => cur === null ? marks : cur);
            setDelGroups((cur) => cur === null ? dels : cur);
          }).catch(() => {
          });
        }, 220);
      }
      const markLine = mark?.line ?? clampLine;
      if (!opts?.background) requestAnimationFrame(() => {
        scrollAreaToLine(Math.max(1, markLine));
        setFlash({ line: markLine, col: mark?.col, word: mark?.word });
        setTimeout(() => setFlash((f) => f && f.line === markLine ? null : f), 1800);
      });
      return entry;
    },
    [cwd, fetchDiagnostics, say, t, scrollAreaToLine, canNavigate, dismissPanels]
  );
  const openFile = useCallback(
    async (path, line, col, record = true, mark) => {
      if (!canNavigate()) return;
      const current = docRef.current;
      if (record && current && modeRef.current === "code") {
        const cur = cursorRef.current;
        histRef.current.back.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
        if (histRef.current.back.length > 80) histRef.current.back.shift();
        histRef.current.forward = [];
        setHistTick((v) => v + 1);
      }
      await loadFile(path, line, col, mark);
    },
    [loadFile, canNavigate]
  );
  const { sync, committing, doFetch, doPull, doPush, discardChange, discardMany, deleteUntracked, deleteUntrackedMany, stageChange, unstageChange, commitChanges } = useGitActions({
    cwd,
    t,
    say,
    git,
    setGit,
    repoSelRef,
    refreshGit,
    loadFile,
    docRef,
    cursorRef,
    modeRef
  });
  const generateCommitMessage = useCallback(async () => {
    if (!cwd) return "";
    const repo = repoSelRef.current;
    const diffRes = await api("git.diff", repo ? { cwd, path: "", scope: "staged", repo } : { cwd, path: "", scope: "staged" });
    const diffText = diffRes.ok ? diffRes.value?.diff ?? "" : "";
    if (!diffText.trim()) return "";
    const lines2 = diffText.split("\n");
    const adds = lines2.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const dels = lines2.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    const files = [...new Set(lines2.filter((l) => l.startsWith("diff --git")).map((l) => l.split(" b/")[1]?.trim()).filter(Boolean))];
    const summary = files.length <= 3 ? files.join(", ") : `${files.length} files`;
    return `chore: update ${summary} (+${adds} -${dels})`;
  }, [cwd]);
  useEffect(() => {
    repoSelRef.current = repoSel;
    if (repoSel) refreshGit();
  }, [repoSel, refreshGit]);
  useEffect(() => {
    if (!doc || !repos || repos.length === 0 || !cwd) return;
    const abs = toAbs(cwd, doc.path);
    const match = repos.find((r) => abs === r.root || abs.startsWith(`${r.root}/`));
    if (match && match.root !== repoSelRef.current) {
      repoSelRef.current = match.root;
      setRepoSel(match.root);
    }
  }, [doc, repos, cwd]);
  const goBack = useCallback(() => {
    if (!canNavigate()) return;
    const stack = histRef.current;
    if (!stack.back.length) return;
    const current = docRef.current;
    if (current && modeRef.current === "code") {
      const cur = cursorRef.current;
      stack.forward.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
    }
    const prev = stack.back.pop();
    setHistTick((v) => v + 1);
    void openFile(prev.path, prev.line, prev.col, false, prev.word ? { line: prev.line, col: prev.col, word: prev.word } : null);
  }, [openFile, canNavigate]);
  const goForward = useCallback(() => {
    if (!canNavigate()) return;
    const stack = histRef.current;
    if (!stack.forward.length) return;
    const current = docRef.current;
    if (current && modeRef.current === "code") {
      const cur = cursorRef.current;
      stack.back.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
    }
    const next = stack.forward.pop();
    setHistTick((v) => v + 1);
    void openFile(next.path, next.line, next.col, false, next.word ? { line: next.line, col: next.col, word: next.word } : null);
  }, [openFile, canNavigate]);
  useEffect(() => {
    const p = doc?.path;
    if (typeof p !== "string" || p === "") return;
    setTabs((prev) => addTabPath(prev, p));
  }, [doc]);
  useEffect(() => {
    const p = doc?.path;
    if (typeof p !== "string" || !cursor) return;
    tabViewRef.current[p] = { line: cursor.line, col: cursor.col, scroll };
  }, [doc, cursor, scroll]);
  const switchTab = useCallback((path) => {
    if (!path) return;
    if (path === docRef.current?.path) {
      dismissPanels();
      setMobileView("editor");
      if (diff && showDiffView && (diff.scope === "working" || diff.scope === "branch" || diff.scope === "staged")) setShowDiffView(false);
      return;
    }
    if (editing && editText !== (docRef.current?.raw ?? "")) {
      say(t("editor.dirtyGuard"), "error");
      return;
    }
    const saved = tabViewRef.current[path];
    void openFile(path, saved?.line ?? 1, saved?.col ?? 1, false);
  }, [editing, editText, openFile, say, t, diff, showDiffView, dismissPanels]);
  const closeTabs = useCallback((paths2, { respectPins = false } = {}) => {
    const candidates = respectPins ? excludePinned(paths2, pinned) : paths2;
    const remove = new Set((Array.isArray(candidates) ? candidates : []).filter((p) => typeof p === "string" && p !== ""));
    if (remove.size === 0) return;
    const current = docRef.current;
    if (editing && current && remove.has(current.path) && editText !== (current.raw ?? "")) {
      say(t("editor.dirtyGuard"), "error");
      return;
    }
    const firstIdx = tabs.findIndex((p) => remove.has(p));
    if (firstIdx < 0) return;
    let stack = closedTabsRef.current;
    for (const p of tabs) {
      if (!remove.has(p)) continue;
      const view = tabViewRef.current[p];
      stack = pushClosedTab(stack, { path: p, line: view?.line ?? 1, col: view?.col ?? 1 });
      delete tabViewRef.current[p];
    }
    closedTabsRef.current = stack;
    const next = tabs.filter((p) => !remove.has(p));
    setTabs(next);
    setPinned((prev) => prev.filter((p) => !remove.has(p)));
    setTabMenu(null);
    if (current && remove.has(current.path)) {
      const neighbor = next[Math.min(firstIdx, next.length - 1)];
      if (neighbor) {
        const saved = tabViewRef.current[neighbor];
        void openFile(neighbor, saved?.line ?? 1, saved?.col ?? 1, false);
      } else {
        setDoc(null);
        setEditing(false);
        setDiffMarks(null);
        setDelGroups(null);
        setDelPreview(null);
      }
    }
  }, [tabs, pinned, editing, editText, openFile, say, t]);
  const closeTab = useCallback((path) => closeTabs([path]), [closeTabs]);
  const togglePin = useCallback((path) => {
    const has = pinned.includes(path);
    setPinned(has ? pinned.filter((p) => p !== path) : [...pinned, path]);
    if (!has) setTabs((current) => pinTab(current, path));
    setTabMenu(null);
  }, [pinned]);
  const reopenClosedTab = useCallback(() => {
    if (!canNavigate()) return;
    const [entry, rest] = popClosedTab(closedTabsRef.current);
    if (!entry) {
      say(t("editor.noClosedTabs"));
      return;
    }
    closedTabsRef.current = rest;
    void openFile(entry.path, entry.line, entry.col, false);
  }, [canNavigate, openFile, say, t]);
  const openTabMenu = useCallback((event, path) => {
    event.preventDefault();
    event.stopPropagation();
    setTabMenu({
      path,
      x: Math.max(8, Math.min(event.clientX, (window.innerWidth || 1e3) - 218)),
      y: Math.max(8, Math.min(event.clientY, (window.innerHeight || 800) - 200))
    });
  }, []);
  useNavPersistence({
    persistKey,
    cwd,
    doc,
    cursor,
    scroll,
    mode,
    railW,
    railVisible,
    wrapOn,
    findOpts,
    tabs,
    pinned,
    histTick,
    histRef,
    docRef,
    codeRef,
    loadFile,
    setRailW,
    setRailVisible,
    setWrapOn,
    setFindOpts,
    setTabs,
    setPinned,
    setMode,
    setHistTick,
    setScroll
  });
  const revealPosition = useCallback((line, col, word) => {
    const current = docRef.current;
    if (!current) return;
    if (tab?.visible === false) return;
    const cur = cursorRef.current;
    histRef.current.back.push({ path: current.path, line: cur?.line ?? 1, col: cur?.col ?? 1, word: cur?.word });
    if (histRef.current.back.length > 80) histRef.current.back.shift();
    histRef.current.forward = [];
    setHistTick((v) => v + 1);
    setCursor({ line, col, word: word ?? wordAt(current.lines[line - 1] ?? "", col)?.word ?? "" });
    setFlash({ line, col, word });
    setTimeout(() => setFlash((f) => f && f.line === line ? null : f), 1800);
    scrollAreaToLine(line);
    codeRef.current?.focus({ preventScroll: true });
  }, [scrollAreaToLine, tab?.visible]);
  const openDiff = useCallback(
    async (path, scope, repoOverride, refs) => {
      if (!cwd || !canNavigate()) return;
      if (scope !== "compare") dismissPanels();
      const repo = repoOverride ?? repoSelRef.current;
      const body = repo ? { cwd, path, scope, repo } : { cwd, path, scope };
      if (scope === "compare") {
        body.base = refs?.base ?? "";
        body.head = refs?.head ?? "HEAD";
      }
      const res = await api("git.diff", body);
      const value = res.ok ? res.value : { error: res.error };
      modeRef.current = "diff";
      setMobileView("editor");
      setShowDiffView(true);
      setDiff({ path, scope, text: value.diff ?? "", error: value.error, base: value.base, head: value.head, untracked: value.untracked, note: value.note });
      setOverlay(null);
      setHover(null);
    },
    [cwd, canNavigate, dismissPanels]
  );
  const openChangeSource = useCallback(async (path, scope) => {
    if (!cwd || !canNavigate()) return;
    dismissPanels();
    const repo = repoSelRef.current;
    const res = await api("git.diff", repo ? { cwd, path, scope, repo } : { cwd, path, scope });
    const text = res.ok ? res.value.diff ?? "" : "";
    const marks = changedNewLines(text);
    let first = Number.POSITIVE_INFINITY;
    for (const n of marks) if (n < first) first = n;
    if (first === Number.POSITIVE_INFINITY) first = 1;
    setDiff({ path, scope, text, base: res.ok ? res.value.base : void 0, note: res.ok ? res.value.note : void 0 });
    setShowDiffView(false);
    modeRef.current = "code";
    const loaded = await loadFile(path, first, 1, null, { noAutoMarks: true });
    if (!loaded) return;
    setDiffMarks(marks);
    setDelGroups(deletedGroups(text));
  }, [cwd, loadFile, canNavigate, dismissPanels]);
  const gitDebounce = useRef(null);
  const scheduleGitRefresh = useCallback(() => {
    if (gitDebounce.current !== null) return;
    gitDebounce.current = setTimeout(() => {
      gitDebounce.current = null;
      refreshGit();
    }, 350);
  }, [refreshGit]);
  useEffect(() => () => {
    if (gitDebounce.current !== null) clearTimeout(gitDebounce.current);
  }, []);
  const backgroundReload = useCallback(async (force) => {
    const d = docRef.current;
    if (!d || d.image) return;
    const cur = cursorRef.current;
    await loadFile(d.path, cur?.line ?? 1, cur?.col ?? 1, null, { background: true, noAutoMarks: true, checkExternal: true, force });
  }, [loadFile]);
  const refreshOpenDiff = useCallback(async () => {
    const d = diffRef.current;
    if (!d || typeof d.path !== "string" || d.path === "" || d.scope !== "working" && d.scope !== "index" && d.scope !== "compare") return;
    const repo = repoSelRef.current;
    const body = repo ? { cwd, path: d.path, scope: d.scope, repo } : { cwd, path: d.path, scope: d.scope };
    if (d.scope === "compare") {
      body.base = d.base ?? "";
      body.head = d.head ?? "HEAD";
    }
    const res = await api("git.diff", body);
    const value = res.ok ? res.value ?? {} : {};
    setDiff((cur) => cur && cur.path === d.path && cur.scope === d.scope ? { ...cur, text: value.diff ?? "", error: value.error, untracked: value.untracked, note: value.note, base: value.base ?? cur.base, head: value.head ?? cur.head } : cur);
  }, [cwd]);
  const applyWatchBatch = useCallback((v, reset) => {
    const paths2 = reset ? [] : v.paths ?? [];
    if (reset || paths2.length > 0) {
      if (!reset) setStale((cur) => ({ tick: cur.tick + 1, dirs: parentDirs(paths2) }));
      const act = reset ? docRef.current ? dirtyRef.current ? "conflict" : "reload" : "ignore" : docAction(paths2, docRef.current?.path ?? "", dirtyRef.current);
      if (act === "reload") void backgroundReload(false);
      else if (act === "conflict") setExternalConflict({ path: docRef.current.path });
      if (modeRef.current === "diff") void refreshOpenDiff();
    }
    if (reset || paths2.length > 0 || v.git) scheduleGitRefresh();
  }, [backgroundReload, refreshOpenDiff, scheduleGitRefresh]);
  const unsupportedWarned = useRef(false);
  const watchHandlersRef = useRef(null);
  watchHandlersRef.current = { applyWatchBatch, say, t };
  useEffect(() => {
    if (!cwd || !liveOn || tab?.visible === false) return void 0;
    unsupportedWarned.current = false;
    const loop = createWatchLoop({
      poll: (body) => api("watch.poll", { cwd, ...body }),
      onChanges: (v) => watchHandlersRef.current?.applyWatchBatch(v, false),
      onReset: () => watchHandlersRef.current?.applyWatchBatch({ paths: [] }, true),
      onUnsupported: () => {
        if (unsupportedWarned.current) return;
        unsupportedWarned.current = true;
        say(t("watch.unsupported"), "error");
      }
    });
    return () => loop.stop();
  }, [cwd, liveOn, tab?.visible]);
  useEffect(() => {
    if (!wsym || !cwd) return void 0;
    const q = wsym.query.trim();
    if (q === "") return void 0;
    const { seq } = wsym;
    const timer = setTimeout(() => {
      api("lsp.workspaceSymbol", { cwd, query: q, path: docRef.current?.path ?? "" }).then((r) => {
        if (r.ok && r.value.status) setStatus((s) => ({ ...s, ...r.value.status }));
        setWsym((cur) => cur === null || cur.seq !== seq ? cur : {
          ...cur,
          busy: false,
          results: r.ok ? r.value.symbols ?? [] : [],
          error: r.ok ? String(r.value.error ?? r.value.note ?? "") : String(r.error ?? "")
        });
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [cwd, wsym?.query, wsym?.seq]);
  useEffect(() => {
    if (!blameOn || !doc || !cwd) return void 0;
    let alive = true;
    const repo = repoSelRef.current;
    api("git.blame", repo ? { cwd, path: doc.path, repo } : { cwd, path: doc.path }).then((res) => {
      if (!alive) return;
      if (!res.ok || res.value?.error) {
        setBlame(null);
        return;
      }
      const byLine = /* @__PURE__ */ new Map();
      for (const item of res.value.lines ?? []) byLine.set(item.line, item);
      setBlame(byLine);
    });
    return () => {
      alive = false;
    };
  }, [blameOn, doc, cwd]);
  const openCommit = useCallback(
    async (commit) => {
      if (!cwd || !canNavigate()) return;
      dismissPanels();
      const repo = repoSelRef.current;
      const res = await api("git.diff", repo ? { cwd, scope: "commit", sha: commit.hash, repo } : { cwd, scope: "commit", sha: commit.hash });
      const value = res.ok ? res.value : { error: res.error };
      if (value.error) {
        say(`${t("error")}: ${value.error}`, "error");
        return;
      }
      modeRef.current = "diff";
      setMobileView("editor");
      setDiff({ path: `${t("diff.scopeCommit")} ${commit.hash}`, scope: "commit", commit: value.commit, text: value.diff ?? "" });
      setShowDiffView(true);
      setOverlay(null);
      setHover(null);
      setPeek(null);
    },
    [cwd, say, t, canNavigate, dismissPanels]
  );
  const doCompare = useCallback(
    async (base, head) => {
      if (!cwd) return;
      setCompareBusy(true);
      const repo = repoSelRef.current;
      const res = await api("git.compare", repo ? { cwd, base, head, repo } : { cwd, base, head });
      setCompareBusy(false);
      if (!res.ok) {
        say(`${t("error")}: ${res.error}`, "error");
        return;
      }
      if (res.value.error) {
        setCompare({ ...res.value, files: [] });
        say(`${t("error")}: ${res.value.error}`, "error");
        return;
      }
      setCompare(res.value);
      setCompareOpen(false);
      setMode("changes");
      setRailVisible(true);
    },
    [cwd, say, t]
  );
  const openCompare = useCallback(async () => {
    if (!cwd) return;
    dismissPanels();
    setCompareOpen(true);
    const repo = repoSelRef.current;
    const res = await api("git.branches", repo ? { cwd, repo } : { cwd });
    if (res.ok && Array.isArray(res.value.branches)) setCompareBranches(res.value.branches);
  }, [cwd, dismissPanels]);
  const taskSeq = useRef(0);
  const openTasks = useCallback(async () => {
    if (!cwd) return;
    dismissPanels();
    setTasks({ scripts: {}, running: {}, busy: true, error: "" });
    const res = await api("task.scripts", { cwd });
    setTasks((cur) => cur === null ? cur : res.ok && !res.value.error ? { scripts: res.value.scripts ?? {}, running: res.value.running ?? {}, busy: false, error: "" } : { scripts: {}, running: {}, busy: false, error: res.value?.error ?? res.error ?? t("error") });
  }, [cwd, dismissPanels, t]);
  const startTask = useCallback(
    async (script) => {
      if (!cwd) return;
      const res = await api("task.start", { cwd, script });
      if (!res.ok || res.value.error) {
        say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
        return;
      }
      setTasks(null);
      taskSeq.current += 1;
      setTask({ id: res.value.id, script, chunks: [], seq: 0, baseSeq: 0, lineCount: 1, done: false, code: null, dropped: false, pollSeq: taskSeq.current });
    },
    [cwd, say, t]
  );
  const stopTask = useCallback(async () => {
    if (!task) return;
    const res = await api("task.kill", { id: task.id });
    if (!res.ok || res.value.error) say(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
    else say(t("task.stopRequested"));
  }, [task, say, t]);
  useEffect(() => {
    if (!task || task.done || !cwd) return void 0;
    const active = task.pollSeq;
    let cancelled = false;
    const { id } = task;
    let cursor2 = task.seq;
    const pump = async () => {
      while (!cancelled && cursor2 >= 0) {
        const res = await api("task.poll", { id, since: cursor2, waitMs: 18e3 });
        if (cancelled || active !== taskSeq.current) {
          cursor2 = -1;
          break;
        }
        if (!res.ok || res.value.error) {
          cursor2 = -1;
          break;
        }
        const snap = res.value;
        cursor2 = snap.seq;
        if (snap.done) cursor2 = -1;
        setTask((prev) => prev === null || prev.pollSeq !== active ? prev : { ...foldTaskOutput(prev, snap), id, script: prev.script, pollSeq: prev.pollSeq });
      }
    };
    void pump();
    return () => {
      cancelled = true;
    };
  }, [cwd, task?.id, task?.done, task?.pollSeq]);
  const pickCommit = useCallback(
    async (commit) => {
      if (!cwd || dirtyRef.current) {
        say(t("editor.dirtyGuard"), "error");
        return;
      }
      setSeqBusy(true);
      const repo = repoSelRef.current;
      const res = await api("git.cherryPick", repo ? { cwd, sha: commit.hash, repo } : { cwd, sha: commit.hash });
      setSeqBusy(false);
      const value = res.ok ? res.value ?? {} : { error: res.error };
      if (value.status) setGit(value.status);
      if (value.error) say(value.conflicted ? `${value.error} — ${t("changes.pickConflicted")}` : `${t("error")}: ${value.error}`, "error");
      else say(t("changes.picked", { hash: commit.hash }));
      if (!value.conflicted) refreshGit();
    },
    [cwd, say, t, refreshGit]
  );
  const resolveConflict = useCallback(
    async (path, side) => {
      if (!cwd) return;
      setSeqBusy(true);
      const repo = repoSelRef.current;
      const res = await api("git.resolve", repo ? { cwd, path, side, repo } : { cwd, path, side });
      setSeqBusy(false);
      const value = res.ok ? res.value ?? {} : { error: res.error };
      if (value.status) setGit(value.status);
      if (value.error) say(`${t("error")}: ${value.error}`, "error");
      else say(t("changes.resolved", { path, side: t(side === "ours" ? "changes.ours" : "changes.theirs") }));
    },
    [cwd, say, t]
  );
  const sequencerAction = useCallback(
    async (action) => {
      if (!cwd) return;
      const kind = git?.inProgress ?? "cherry-pick";
      setSeqBusy(true);
      const repo = repoSelRef.current;
      const res = await api(action === "continue" ? "git.sequencerContinue" : "git.sequencerAbort", repo ? { cwd, kind, repo } : { cwd, kind });
      setSeqBusy(false);
      const value = res.ok ? res.value ?? {} : { error: res.error };
      if (value.status) setGit(value.status);
      if (value.error) say(`${t("error")}: ${value.error}`, "error");
      else say(action === "continue" ? t("changes.sequencerDone") : t("changes.sequencerAborted"));
      refreshGit();
    },
    [cwd, git, say, t, refreshGit]
  );
  const openFileHistory = useCallback(() => {
    const d = docRef.current;
    if (!cwd || !d) return;
    dismissPanels();
    const path = d.path;
    setFileHist({ path, busy: true });
    const repo = repoSelRef.current;
    api("git.history", repo ? { cwd, path, repo } : { cwd, path }).then((res) => {
      setFileHist((cur) => {
        if (!cur || cur.path !== path) return cur;
        if (!res.ok) return { path, error: res.error };
        if (res.value?.error) return { path, error: res.value.error, scopeInfo: res.value.scope };
        return { path, commits: res.value?.commits ?? [] };
      });
    });
  }, [cwd, dismissPanels]);
  const openHistCommit = useCallback(
    async (commit) => {
      const path = fileHist?.path;
      if (!cwd || !path || !commit?.hash || !canNavigate()) return;
      dismissPanels();
      const repo = repoSelRef.current;
      const res = await api("git.diff", repo ? { cwd, path, scope: "commit", sha: commit.hash, repo } : { cwd, path, scope: "commit", sha: commit.hash });
      const value = res.ok ? res.value ?? {} : { error: res.error };
      if (value.error) {
        say(`${t("error")}: ${value.error}`, "error");
        return;
      }
      setFileHist(null);
      modeRef.current = "diff";
      setMobileView("editor");
      setDiff({ path: `${commit.hash} · ${path}`, scope: "commit", commit: value.commit, text: value.diff ?? "" });
      setShowDiffView(true);
      setOverlay(null);
      setHover(null);
      setPeek(null);
    },
    [cwd, fileHist, say, t, canNavigate, dismissPanels]
  );
  const openPalette = useCallback(() => {
    if (!cwd) return;
    dismissPanels();
    setMobileView("editor");
    setPalette({ query: "", results: [], busy: true });
    api("search.files", { cwd, query: "", limit: 80 }).then((res) => {
      setPalette((p) => p && p.query === "" ? { ...p, results: res.ok ? res.value.matches ?? [] : [], busy: false } : p);
    });
  }, [cwd, dismissPanels]);
  const onPaletteQuery = useCallback(
    (query) => {
      setPalette((p) => p ? { ...p, query, busy: true } : p);
      if (paletteTimer.current) clearTimeout(paletteTimer.current);
      paletteTimer.current = setTimeout(() => {
        if (!cwd) return;
        api("search.files", { cwd, query, limit: 80 }).then((res) => {
          setPalette((p) => p && p.query === query ? { ...p, results: res.ok ? res.value.matches ?? [] : [], busy: false } : p);
        });
      }, 140);
    },
    [cwd]
  );
  const closePalette = useCallback(() => {
    if (paletteTimer.current) clearTimeout(paletteTimer.current);
    setPalette(null);
  }, []);
  const onPalettePick = useCallback(
    (path) => {
      closePalette();
      void openFile(path, 1, 1);
    },
    [closePalette, openFile]
  );
  const runSearchNow = useCallback(
    (query, include, opts) => {
      if (!cwd) return;
      const nonce = ++searchNonce.current;
      setSearch((s) => s ? { ...s, busy: true, error: void 0 } : s);
      api("search.text", { cwd, query, include: include || "", regex: opts?.regex === true, words: opts?.words === true, scope: opts?.scope?.kind ?? "workspace", directory: opts?.scope?.directory, repo: opts?.scope?.repo }).then((res) => {
        if (searchNonce.current !== nonce) return;
        setSearch((s) => {
          if (!s) return s;
          if (!res.ok) return { ...s, results: [], busy: false, error: res.error };
          return { ...s, results: res.value.results ?? [], engine: res.value.engine ?? "", truncated: res.value.truncated === true, timedOut: res.value.timedOut === true, busy: false, error: res.value.error };
        });
      });
    },
    [cwd]
  );
  const openSearch = useCallback((requested) => {
    dismissPanels();
    const scope = requested?.kind === "directory" ? { kind: "directory", directory: requested.directory } : mode === "changes" ? { kind: "changes", repo: repoSelRef.current ?? void 0 } : { kind: "workspace" };
    ++searchNonce.current;
    setMobileView("editor");
    setSearchOpen(true);
    setSearch((s) => ({ ...s ?? { query: "", include: "", regex: false, words: false }, scope, results: void 0, engine: "", truncated: false, busy: false, error: void 0, scopeInfo: void 0 }));
  }, [mode, dismissPanels]);
  const changeSearch = useCallback((patch) => {
    ++searchNonce.current;
    setSearch((s) => s ? { ...s, ...patch, results: void 0, busy: false, error: void 0, scopeInfo: void 0 } : s);
  }, []);
  const searchQuery = search?.query ?? "";
  const searchInclude = search?.include ?? "";
  const searchRegex = search?.regex === true;
  const searchWords = search?.words === true;
  const searchScope = search?.scope;
  useEffect(() => {
    ++searchNonce.current;
    if (!searchOpen || searchQuery.trim().length < 2) return void 0;
    const timer = setTimeout(() => runSearchNow(searchQuery, searchInclude, { regex: searchRegex, words: searchWords, scope: searchScope }), 400);
    return () => clearTimeout(timer);
  }, [searchOpen, searchQuery, searchInclude, searchRegex, searchWords, searchScope, runSearchNow]);
  const onSearchPick = useCallback(
    (r) => {
      void openFile(r.path, r.line, 1);
    },
    [openFile]
  );
  const openPeek = useCallback(
    async (symbol, line, col) => {
      if (!cwd) {
        say(t("editor.noSession"), "error");
        return;
      }
      const open = docRef.current;
      if (!open) return;
      if (!LSP_RE.test(open.path)) {
        say(t("jump.unsupportedFile"), "error");
        return;
      }
      const path = open.path;
      const nonce = ++peekNonce.current;
      setPeek({ symbol, anchorLine: line, busy: true, def: [], refs: [] });
      const [dres, rres] = await Promise.all([
        api("lsp.request", { cwd, path, kind: "definition", line, col }),
        api("lsp.request", { cwd, path, kind: "references", line, col })
      ]);
      if (peekNonce.current !== nonce) return;
      if (dres.ok && dres.value.status) setStatus(dres.value.status);
      if (!dres.ok && !rres.ok) {
        setPeek({ symbol, anchorLine: line, busy: false, def: [], refs: [], error: dres.error ?? rres.error });
        return;
      }
      const note = (dres.ok ? dres.value.note : "") || (rres.ok ? rres.value.note : "");
      setPeek({
        symbol,
        anchorLine: line,
        busy: false,
        def: dres.ok ? dres.value.targets ?? [] : [],
        refs: rres.ok ? rres.value.targets ?? [] : [],
        error: note !== "" ? note : !dres.ok ? dres.error : !rres.ok ? rres.error : void 0
      });
    },
    [cwd]
  );
  const findReferences = useCallback((pos) => {
    const open = docRef.current;
    if (!open) {
      say(t("jump.noCursor"), "error");
      return;
    }
    if (!LSP_RE.test(open.path)) {
      say(t("jump.unsupportedFile"), "error");
      return;
    }
    const at = pos ?? cursorRef.current;
    if (!at) {
      say(t("jump.noCursor"), "error");
      return;
    }
    const line = open.lines[at.line - 1] ?? "";
    const hit = wordAt(line, at.col);
    const col = hit?.col ?? at.col;
    const word = hit?.word ?? at.word ?? "";
    if (word === "") {
      say(t("jump.noCursor"), "error");
      return;
    }
    void openPeek(word, at.line, col);
  }, [openPeek, say, t]);
  const closePeek = useCallback(() => {
    peekNonce.current++;
    setPeek(null);
  }, []);
  const pickPeek = useCallback(
    (loc) => {
      const word = peekRef.current?.symbol;
      closePeek();
      void openFile(loc.path, loc.line, loc.col, true, word ? { line: loc.line, col: loc.col, word } : null);
    },
    [closePeek, openFile]
  );
  const findRe = useMemo(() => compileFindRe(findQuery, findOpts), [findQuery, findOpts]);
  const findMatches = useMemo(() => {
    if (!doc || !findRe) return [];
    const out = [];
    for (let i = 0; i < doc.lines.length && out.length < 2e3; i++) {
      for (const r of findRangesInLine(doc.lines[i], findRe)) {
        out.push({ line: i + 1, col: r.start + 1, text: r.text });
        if (out.length >= 2e3) break;
      }
    }
    return out;
  }, [doc, findRe]);
  const findLines = useMemo(() => new Set(findMatches.map((m) => m.line)), [findMatches]);
  const currentFind = findOpen && !editing && findRe && findMatches.length > 0 ? findMatches[Math.min(findIdx, findMatches.length - 1)] : null;
  const jumpFind = useCallback((delta) => {
    if (findMatches.length === 0) return;
    const next = (findIdx + delta + findMatches.length) % findMatches.length;
    setFindIdx(next);
    const m = findMatches[next];
    setCursor((c) => ({ line: m.line, col: m.col, word: c?.word ?? "" }));
    scrollAreaToLine(m.line);
    setFlash({ line: m.line, col: m.col, word: m.text ?? findQuery });
    setTimeout(() => setFlash((f) => f && f.line === m.line ? null : f), 1200);
  }, [findMatches, findIdx, findQuery, scrollAreaToLine]);
  const doReplace = useCallback((all) => {
    const d = docRef.current;
    if (!d || !findQuery || findRe === false) return;
    const res = applyReplace(d.lines, findMatches, replaceText, {
      all,
      index: findIdx,
      regexRe: findRe && typeof findRe === "object" ? findRe : null,
      preserveCase
    });
    if (!res) {
      say(t("replace.noMatch"), "error");
      return;
    }
    let text = res.lines.join("\n");
    if (String(d.raw ?? "").endsWith("\n")) text += "\n";
    setEditText(text);
    setEditing(true);
    say(t(all ? "replace.replacedAll" : "replace.replacedOne", { n: res.count }));
  }, [findQuery, findRe, findMatches, findIdx, replaceText, preserveCase, say, t]);
  const startEdit = useCallback(() => {
    if (!doc || doc.truncated || doc.image) return;
    if (doc.raw.length > 2 * 1024 * 1024 || doc.lines.length > 5e4) {
      say(t("editor.tooBig"), "error");
      return;
    }
    setEditText(doc.raw);
    setEditing(true);
  }, [doc, say, t]);
  const saveEdit = useCallback((opts) => {
    if (!doc || !editing) return;
    const useFormat = formatOnSave && LSP_RE.test(doc.path);
    const payload = { cwd, path: doc.path, content: editText };
    if (typeof doc.mtimeMs === "number" && opts?.overwrite !== true) payload.baseMtime = doc.mtimeMs;
    api(useFormat ? "fs.formatDraft" : "fs.write", payload).then((res) => {
      if (!res.ok) {
        if (/modified on disk/i.test(res.error ?? "")) {
          setExternalConflict({ path: doc.path });
          say(t("editor.conflict"), "error");
        } else say(`${t("error")}: ${res.error}`, "error");
        return;
      }
      const finalText = useFormat && typeof res.value.content === "string" ? res.value.content : editText;
      const lines2 = finalText.split("\n");
      if (lines2.length > 1 && lines2[lines2.length - 1] === "") lines2.pop();
      setDoc({ ...doc, lines: lines2, states: buildLineStates(lines2, langFor(doc.path)), raw: finalText, mtimeMs: res.value.mtimeMs ?? doc.mtimeMs });
      setEditing(false);
      setExternalConflict(null);
      setConflictDiff(null);
      setOverwriteArm(false);
      if (opts?.overwrite === true) say(t("editor.savedOverwrite"));
      else if (res.value.formatted) say(t("editor.savedFormatted"));
      else if (useFormat) say(t("editor.formatSkipped"), "error");
      else say(t("editor.saved"));
    });
  }, [doc, editing, editText, cwd, say, t, formatOnSave]);
  const openConflictDiff = useCallback(async () => {
    const d = docRef.current;
    if (!d || !cwd) return;
    setConflictDiff({ path: d.path, text: "", add: 0, del: 0, busy: true, error: "" });
    const res = await api("fs.read", { cwd, path: d.path });
    if (!res.ok || res.value.kind !== "text") {
      setConflictDiff({ path: d.path, text: "", add: 0, del: 0, busy: false, error: res.ok ? t("binary") : String(res.error ?? "") });
      return;
    }
    const built = draftDiskDiff(res.value.content, editText, d.path);
    setConflictDiff({ path: d.path, ...built, busy: false, error: "" });
  }, [cwd, editText, t]);
  const cancelEdit = useCallback(() => {
    setEditing(false);
    setOverwriteArm(false);
  }, []);
  const openDiffSource = useCallback((line) => {
    if (!diff || typeof diff.path !== "string" || diff.path === "") return;
    if (diff.scope === "commit" || diff.scope === "call") return;
    const marks = changedNewLines(diff.text);
    let first = line;
    if (first == null) {
      first = Number.POSITIVE_INFINITY;
      for (const n of marks) if (n < first) first = n;
      if (first === Number.POSITIVE_INFINITY) first = 1;
    }
    modeRef.current = "code";
    setShowDiffView(false);
    const path = diff.path;
    const ready = loadFile(path, first, 1, null, { noAutoMarks: true });
    void ready.then(() => {
      setDiffMarks(marks);
      setDelGroups(deletedGroups(diff.text));
    });
  }, [diff, loadFile]);
  const revertHunk = useCallback(async (hunkIndex, hunkHeader) => {
    if (!cwd || !diff || diff.scope !== "working" || typeof diff.path !== "string" || diff.path === "") return;
    const path = diff.path;
    const repo = repoSelRef.current;
    const body = { cwd, path, hunkIndex };
    if (typeof hunkHeader === "string" && hunkHeader !== "") body.hunkHeader = hunkHeader;
    if (repo) body.repo = repo;
    const res = await api("git.revertHunk", body);
    const value = res.ok ? res.value ?? {} : { error: res.error };
    if (!res.ok || value.error) {
      say(`${t("error")}: ${value.error ?? res.error}`, "error");
      return;
    }
    say(t("diff.hunkReverted"));
    if (value.status) setGit(value.status);
    await openDiff(path, "working");
  }, [cwd, diff, say, t, openDiff]);
  const toggleCommand = useCallback(() => {
    const next = !commandOpen;
    dismissPanels();
    setCommandOpen(next);
  }, [commandOpen, dismissPanels]);
  const toggleProblems = useCallback(() => {
    const next = !problemsOpen;
    dismissPanels();
    setProblemsOpen(next);
    if (next && cwd) {
      api("lsp.workspaceDiagnostics", { cwd }).then((res) => {
        if (res.ok) setWorkspaceDiag(res.value.files ?? []);
      }).catch(() => {
      });
    }
  }, [problemsOpen, dismissPanels, cwd]);
  const onRootKeyDown = useCallback(
    (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyF" && !event.shiftKey) {
        if (modeRef.current === "code" && docRef.current && !editing) {
          event.preventDefault();
          setFindOpen((v) => !v);
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.altKey && !event.shiftKey && event.code === "KeyF") {
        if (modeRef.current === "code" && docRef.current && !editing) {
          event.preventDefault();
          setFindOpen(true);
          setReplaceOpen(true);
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.code === "KeyS" && !event.shiftKey) {
        if (editing) {
          event.preventDefault();
          saveEdit();
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "BracketLeft") {
        event.preventDefault();
        goBack();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "BracketRight") {
        event.preventDefault();
        goForward();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyB" && !event.shiftKey) {
        event.preventDefault();
        setRailVisible((v) => !v);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyO") {
        if (LSP_RE.test(docRef.current?.path ?? "")) {
          event.preventDefault();
          dismissPanels();
          setSymPalette({});
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === "KeyP") {
        event.preventDefault();
        toggleCommand();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === "KeyM") {
        event.preventDefault();
        toggleProblems();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === "KeyT") {
        event.preventDefault();
        reopenClosedTab();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyP") {
        event.preventDefault();
        if (palette) closePalette();
        else openPalette();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyF") {
        event.preventDefault();
        openSearch();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === "KeyO") {
        event.preventDefault();
        dismissPanels();
        if (cwd) setWsym({ query: "", results: [], busy: false, error: "", seq: 0 });
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.code === "KeyG") {
        if (modeRef.current === "code" && docRef.current && !editing) {
          event.preventDefault();
          const next = !gotoOpen;
          dismissPanels();
          setGotoOpen(next);
        }
        return;
      }
      if (event.altKey && !event.metaKey && !event.ctrlKey && event.code === "KeyZ") {
        if (modeRef.current === "code" && docRef.current && !editing) {
          event.preventDefault();
          toggleWrap();
        }
        return;
      }
      if (event.key === "Escape") {
        if (searchOpen || palette || commandOpen || branchPickOpen || fileHist || gotoOpen || symPalette || wsym || compareOpen || peek || overlay || problemsOpen || tabMenu) {
          event.preventDefault();
          event.stopPropagation();
          dismissPanels();
          return;
        }
        if (editing) {
          cancelEdit();
          return;
        }
        if (fileHist) {
          setFileHist(null);
          return;
        }
        if (gotoOpen) {
          setGotoOpen(false);
          return;
        }
        if (findOpen) {
          setFindOpen(false);
          return;
        }
        if (delPreview) {
          setDelPreview(null);
          return;
        }
        if (symPalette) {
          setSymPalette(null);
          return;
        }
        if (peek) {
          closePeek();
          return;
        }
        if (searchOpen) setSearchOpen(false);
      }
    },
    [palette, closePalette, openPalette, openSearch, searchOpen, peek, closePeek, goBack, goForward, symPalette, wsym, compareOpen, editing, saveEdit, cancelEdit, findOpen, delPreview, gotoOpen, toggleWrap, fileHist, toggleCommand, toggleProblems, reopenClosedTab, dismissPanels, commandOpen, branchPickOpen, overlay, problemsOpen, tabMenu]
  );
  const doJump = useCallback(
    async (kind, pos) => {
      if (!cwd) {
        say(t("editor.noSession"), "error");
        return;
      }
      if (!docRef.current) return;
      if (!LSP_RE.test(docRef.current.path)) {
        say(t("jump.unsupportedFile"), "error");
        return;
      }
      const cur = pos ?? cursorRef.current;
      if (!cur) {
        say(t("jump.noCursor"));
        return;
      }
      say(t("status.starting"));
      const res = await api("lsp.request", { cwd, path: docRef.current.path, kind, line: cur.line, col: cur.col });
      setNotice({ text: "", kind: "info" });
      if (!res.ok) {
        say(res.error, "error");
        setStatus({ state: "error", message: res.error, progress: "" });
        return;
      }
      if (res.value.status) setStatus(res.value.status);
      if (kind === "hover") {
        setHover({ x: cur.col, y: cur.line, text: res.value.hover || "" });
        return;
      }
      const targets = res.value.targets ?? [];
      if (!targets.length) {
        say(res.value.note ?? t("jump.noTarget"), res.value.note ? "info" : "error");
        return;
      }
      if (targets.length === 1 && kind !== "references") {
        const item = targets[0];
        void openFile(item.path, item.line, item.col, true, { line: item.line, col: item.col, word: cur.word });
        return;
      }
      const title = kind === "references" ? t("jump.refsTitle") : kind === "implementation" ? t("jump.implTitle") : kind === "typeDefinition" ? t("jump.typeTitle") : t("jump.peekTitle");
      setOverlay({ title, items: targets });
    },
    [cwd, openFile, say, t]
  );
  const onKeyDown = useCallback(
    (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (event.key === "F12") {
        event.preventDefault();
        if (event.shiftKey) findReferences();
        else void doJump("definition");
        return;
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
        return;
      }
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        goForward();
        return;
      }
      if (event.key === "Escape") {
        if (overlay) setOverlay(null);
        else if (hover) setHover(null);
        return;
      }
      if ((event.key === "i" || event.key === "I") && mod && event.altKey) {
        event.preventDefault();
        void doJump("implementation");
        return;
      }
    },
    [doJump, openPeek, findReferences, say, t, goBack, goForward, hover, overlay]
  );
  const cancelHover = useCallback(() => {
    hoverNonce.current++;
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    hoverAtRef.current = null;
    setHover(null);
  }, []);
  const onEditorClick = useCallback(
    (event) => {
      const target = event.target?.closest?.("[data-ce-l]");
      cancelHover();
      if (!target || !docRef.current) {
        closePeek();
        return;
      }
      const line = Number(target.dataset.ceL);
      const col = Number(target.dataset.ceC);
      const text = docRef.current.lines[line - 1] ?? "";
      const hit = wordAt(text, col);
      const word = hit?.word ?? target.dataset.ceW ?? "";
      const at = { line, col: hit?.col ?? col };
      setCursor({ line: at.line, col: at.col, word });
      if (codeRef.current) codeRef.current.focus({ preventScroll: true });
      if (!LSP_RE.test(docRef.current.path) || !word) {
        setPeek(null);
        return;
      }
      if (target.classList?.contains("ce-kw")) {
        setPeek(null);
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (mod) void doJump("definition", at);
      else setPeek(null);
    },
    [doJump, closePeek, cancelHover]
  );
  const onEditorMouseMove = useCallback((event) => {
    const target = event.target?.closest?.("[data-ce-l]");
    const d = docRef.current;
    if (!target || !d || !LSP_RE.test(d.path) || editing || modeRef.current !== "code") {
      if (hoverAtRef.current) cancelHover();
      return;
    }
    if (target.classList?.contains("ce-kw")) {
      if (hoverAtRef.current) cancelHover();
      return;
    }
    const line = Number(target.dataset.ceL);
    const col = Number(target.dataset.ceC);
    const word = target.dataset.ceW || wordAt(d.lines[line - 1] ?? "", col)?.word || "";
    if (!word) {
      if (hoverAtRef.current) cancelHover();
      return;
    }
    const prev = hoverAtRef.current;
    if (prev && prev.line === line && prev.col === col) return;
    hoverNonce.current++;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverAtRef.current = { line, col, word };
    setHover(null);
    const nonce = hoverNonce.current;
    const path = d.path;
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null;
      api("lsp.request", { cwd, path, kind: "hover", line, col }).then((res) => {
        if (hoverNonce.current !== nonce) return;
        const text = res.ok ? String(res.value.hover ?? "") : "";
        if (text.trim()) setHover({ x: col, y: line, text });
      }).catch(() => {
      });
    }, 350);
  }, [cwd, editing, cancelHover]);
  useEffect(() => {
    if (!cwd) {
      setGit(null);
      return;
    }
    refreshGit();
    api("lsp.status", { cwd }).then((res) => {
      if (res.ok) setStatus(res.value);
    });
  }, [cwd, refreshGit]);
  useEffect(() => {
    if (!tab?.actions?.bindCommands) return;
    return tab.actions.bindCommands({
      refresh: () => {
        refreshGit();
        setTreeKey((k) => k + 1);
        if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
      }
    });
  }, [tab, refreshGit, loadFile]);
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (autoMarksTimer.current) clearTimeout(autoMarksTimer.current);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      tabsRef.current?.querySelector?.(".ce-tab-active")?.scrollIntoView({ inline: "nearest", block: "nearest" });
    });
    return () => cancelAnimationFrame(raf);
  }, [doc, tabs]);
  useEffect(() => {
    const area = codeRef.current;
    if (!area) return;
    const observer = new ResizeObserver(() => setViewport(area.clientHeight || 600));
    observer.observe(area);
    setViewport(area.clientHeight || 600);
    return () => observer.disconnect();
  }, [doc, diff]);
  const diagByLine = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const item of diagnostics) {
      const row = map.get(item.line) ?? [];
      row.push(item);
      map.set(item.line, row);
    }
    return map;
  }, [diagnostics]);
  const delAnchors = useMemo(() => delGroups === null ? [] : [...delGroups.keys()].sort((a, b) => a - b), [delGroups]);
  const changeRailBlobs = useMemo(() => doc ? changeBlobs(diffMarks, delGroups ? [...delGroups.keys()] : null) : [], [doc, diffMarks, delGroups]);
  const jumpToLine = useCallback((line) => {
    setCursor((c) => ({ line, col: 1, word: c?.word ?? "" }));
    scrollAreaToLine(line);
    setFlash({ line, col: 1, word: "" });
    setTimeout(() => setFlash((f) => f && f.line === line ? null : f), 1200);
  }, [scrollAreaToLine]);
  const visible = useMemo(
    () => wrapOn ? null : computeVisible({ doc, scroll, viewport, diagByLine, flash, current: currentFind, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit, onDelPreview: setDelPreview }),
    [wrapOn, doc, scroll, viewport, diagByLine, flash, currentFind, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit]
  );
  const gutter = useMemo(
    () => wrapOn ? null : computeGutter({ doc, scroll, viewport, cursor, findLines, current: currentFind, diffMarks, delAnchors }),
    [wrapOn, doc, scroll, viewport, cursor, findLines, currentFind, diffMarks, delAnchors]
  );
  const wrapDoc = useMemo(
    () => wrapOn ? computeWrapRows({ doc, flash, current: currentFind, diffMarks, delAnchors, delGroups, cursor, findLines, t, onDelPreview: setDelPreview }) : null,
    [wrapOn, doc, flash, currentFind, diffMarks, delAnchors, delGroups, cursor, findLines, t]
  );
  const statusTitle = (status.state === "error" ? `${t("status.error")}: ${status.message}` : status.state === "starting" ? t("status.starting") : status.state === "ready" ? t("status.ready") : t("status.off")) + (status.progress ? ` · ${status.progress}` : "");
  const previewActive = previewOn && doc !== null && PREVIEW_RE.test(doc.path);
  const docLang = doc !== null && !doc.image ? langFor(doc.path) : "text";
  const canBack = histRef.current.back.length > 0;
  const canForward = histRef.current.forward.length > 0;
  void histTick;
  const currentSymbol = useMemo(() => {
    if (!cursor || symbols.length === 0) return null;
    let best = null;
    for (const s of symbols) {
      if (s.line <= cursor.line && (best === null || s.line > best.line || s.line === best.line && s.col <= best.col)) best = s;
    }
    return best;
  }, [symbols, cursor]);
  const openBuiltin = useCallback(() => {
    if (builtinAvailable() && openBuiltinTerminal()) {
      say("");
      return true;
    }
    return false;
  }, [say, openBuiltinTerminal, builtinTerminal]);
  const openTerminal = useCallback(async () => {
    const res = await terminalEntry.open(cwd);
    if (res.ok) {
      say("");
      return;
    }
    if (res.reason === "busy") return;
    const key = res.reason === "noSession" ? "terminal.fail.noSession" : res.reason === "unavailable" ? "terminal.fail.unavailable" : "terminal.fail.failed";
    say(res.error ? `${t(key)}: ${res.error}` : t(key), "error");
  }, [say, t, terminalEntry, cwd]);
  const commands = useMemo(() => [
    { id: "files", icon: "▱", label: t("command.files"), run: () => {
      setMode("files");
      dismissPanels();
      setRailVisible(true);
      setMobileView("files");
    } },
    { id: "changes", icon: "⑂", label: t("command.changes"), run: () => {
      setMode("changes");
      dismissPanels();
      setRailVisible(true);
      setMobileView("files");
      refreshGit();
    } },
    { id: "search", icon: "⌕", label: t("command.search"), hint: "⇧⌘F", run: () => openSearch() },
    { id: "compare", icon: "≷", label: t("command.compare"), run: () => void openCompare() },
    { id: "tasks", icon: "▶", label: t("command.tasks"), run: () => void openTasks() },
    { id: "quick-open", icon: "↗", label: t("command.quickOpen"), hint: "⌘P", run: () => openPalette() },
    { id: "outline", icon: "☷", label: t("command.outline"), hint: "⌘⇧O", run: () => {
      if (LSP_RE.test(docRef.current?.path ?? "")) setSymPalette({});
      else say(t("command.outlineUnavailable"), "error");
    } },
    { id: "definition", icon: "⇢", label: t("command.definition"), hint: "F12", run: () => void doJump("definition") },
    { id: "references", icon: "⌖", label: t("command.references"), hint: "⇧F12", run: () => findReferences() },
    { id: "wsym", icon: "#", label: t("command.wsym"), hint: "⌘⇧#", run: () => {
      if (!cwd) return;
      dismissPanels();
      setWsym({ query: "", results: [], busy: false, error: "", seq: 0 });
    } },
    { id: "replace", icon: "⇄", label: t("command.replace"), hint: "⌘⌥F", run: () => {
      if (modeRef.current === "code" && docRef.current && !editing && !docRef.current.image) {
        setFindOpen(true);
        setReplaceOpen(true);
      } else say(t("command.replaceUnavailable"), "error");
    } },
    { id: "problems", icon: "⚠", label: t("command.problems"), hint: "⇧⌘M", run: toggleProblems },
    { id: "reopen-tab", icon: "↺", label: t("command.reopenTab"), hint: "⌘⇧T", run: reopenClosedTab },
    { id: "close-all-tabs", icon: "✕", label: t("command.closeAllTabs"), run: () => closeTabs(tabs, { respectPins: true }) },
    { id: "wrap", icon: "↩", label: t("command.wrap"), hint: "⌥Z", run: () => toggleWrap() },
    { id: "toggle-rail", icon: "◧", label: t("command.toggleRail"), hint: "⌘B", run: () => setRailVisible((value) => !value) },
    { id: "refresh", icon: "⟳", label: t("command.refresh"), run: () => {
      refreshGit();
      setTreeKey((key) => key + 1);
      if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
    } },
    { id: "live", icon: liveOn ? "◉" : "○", label: `${t("command.live")} — ${t(liveOn ? "watch.state.on" : "watch.state.off")}`, run: () => {
      const next = !liveOn;
      setLiveOn(next);
      try {
        localStorage.setItem("dsh.plugin-kit.live", next ? "on" : "off");
      } catch {
      }
      say(t(next ? "watch.on" : "watch.off"));
    } },
    { id: "format", icon: "⌘.", label: `${t("command.formatOnSave")} — ${t(formatOnSave ? "watch.state.on" : "watch.state.off")}`, hint: "⌥⇧F", run: () => {
      const next = !formatOnSave;
      setFormatOnSave(next);
      try {
        localStorage.setItem("dsh.plugin-kit.format", next ? "on" : "off");
      } catch {
      }
      say(t(next ? "editor.formatOn" : "editor.formatOff"));
    } },
    ...builtinAvailable() ? [{ id: "terminal", icon: "‣", label: t("command.terminal"), run: () => {
      if (!openBuiltin()) void openTerminal();
    } }] : [],
    ...terminalEntry.available() ? [{ id: "terminal-external", icon: "↗", label: t("command.externalTerminal"), run: () => void openTerminal() }] : []
  ], [t, refreshGit, openSearch, openPalette, toggleWrap, say, loadFile, dismissPanels, openTerminal, openBuiltin, terminalEntry, builtinTerminal, openBuiltinTerminal, editing, toggleProblems, reopenClosedTab, closeTabs, tabs, liveOn, cwd, formatOnSave, openCompare, openTasks, findReferences, doJump]);
  const startRailDrag = useCallback((event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startW = railW;
    const move = (e) => setRailW(Math.max(150, Math.min(760, startW + (e.clientX - startX))));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [railW]);
  useEffect(() => {
    const handler = () => {
      if (!tab || tab.visible) openPalette();
    };
    document.addEventListener("dsh-ce-quick-open", handler);
    return () => document.removeEventListener("dsh-ce-quick-open", handler);
  }, [openPalette, tab]);
  useEffect(() => {
    const handler = (event) => {
      const detail = event.detail;
      if (!detail || typeof detail.text !== "string" || !canNavigate()) return;
      dismissPanels();
      modeRef.current = "diff";
      setMobileView("editor");
      setShowDiffView(true);
      setDiff({
        path: detail.path ?? "",
        scope: "call",
        text: detail.text,
        gutter: detail.gutter === false ? false : void 0,
        stats: detail.stats ?? void 0
      });
    };
    document.addEventListener("dsh-ce-open-calldiff", handler);
    return () => document.removeEventListener("dsh-ce-open-calldiff", handler);
  }, [canNavigate, dismissPanels]);
  const dropEditorFile = (event, before) => {
    if (!hasFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setFileDropOver(false);
    setTabDropOver(null);
    const value = readFileDrag(event.dataTransfer, cwd, sessionId);
    if (!value || value.kind !== "file") {
      say(t("drag.unsupported"), "error");
      return;
    }
    if (value.source === "tab") {
      setTabs((current) => reorderFileTabs(current, value.path, before));
      return;
    }
    if (!canNavigate()) return;
    if (value.source === "changes") void openDiff(value.path, value.scope, value.repo);
    else void openFile(dragFilePath(value), 1, 1);
  };
  const editorDropProps = (before) => ({
    onDragOver: (event) => {
      if (!hasFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      setFileDropOver(true);
      setTabDropOver(before ?? null);
    },
    onDragLeave: (event) => {
      if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
        setFileDropOver(false);
        setTabDropOver(null);
      }
    },
    onDrop: (event) => dropEditorFile(event, before)
  });
  if (!cwd) {
    return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
  }
  return h(
    "div",
    { className: "ce-root ce-code-root", "data-mobile-view": (doc || diff || searchOpen || palette) && (!railVisible || mobileView === "editor") ? "editor" : "files", onKeyDown: onRootKeyDown, onDragEnd: () => {
      setFileDropOver(false);
      setTabDropOver(null);
    } },
    h(
      "div",
      { className: "ce-toolbar" },
      h(
        "div",
        { className: "ce-seg" },
        h("button", { type: "button", className: `ce-seg-btn${mode === "files" ? " ce-seg-on" : ""}`, onClick: () => {
          setMode("files");
          dismissPanels();
          setRailVisible(true);
          setMobileView("files");
        } }, t("toolbar.files")),
        h("button", { type: "button", className: `ce-seg-btn${mode === "changes" ? " ce-seg-on" : ""}`, onClick: () => {
          setMode("changes");
          dismissPanels();
          setRailVisible(true);
          setMobileView("files");
          refreshGit();
        } }, `${t("toolbar.changes")}${git?.repo ? ` · ${git.working.length}` : ""}`)
      ),
      h("button", { type: "button", className: `ce-command-trigger${commandOpen ? " ce-tool-on" : ""}`, title: `${t("command.title")} (⌘⇧P / Ctrl+Shift+P)`, "aria-expanded": commandOpen, onClick: toggleCommand }, h("span", { className: "ce-command-mark", "aria-hidden": true }, ">_"), h("span", null, t("command.title")), h("kbd", null, "⌘⇧P")),
      doc || diff ? h("button", { type: "button", className: "ce-mobile-open-editor ce-link", onClick: () => {
        dismissPanels();
        setMobileView("editor");
      } }, t("layout.backEditor")) : null,
      git?.repo ? h(
        "button",
        {
          type: "button",
          className: "ce-branch",
          disabled: sync.busy,
          title: `${t("branch.title")}${git.upstream ? ` · ${git.upstream}${git.upstreamInferred ? " · auto" : ""}` : ""}`,
          onClick: () => {
            const next = !branchPickOpen;
            dismissPanels();
            setBranchPickOpen(next);
          }
        },
        h("span", null, `⎇ ${git.branch}`),
        sync.busy ? h("span", { className: "ce-spin ce-ico" }, h(IconRefresh)) : null,
        !sync.busy && git.ahead > 0 ? h("span", { className: "ce-ab ce-ab-ahead" }, `↑${git.ahead}`) : null,
        !sync.busy && git.behind > 0 ? h("span", { className: "ce-ab ce-ab-behind" }, `↓${git.behind}`) : null
      ) : null,
      h("span", { className: "ce-spacer" }),
      !railVisible ? h("button", { type: "button", className: "ce-tool", title: `${t("quickopen.placeholder")} (⌘P / Ctrl+P)`, onClick: () => palette ? closePalette() : openPalette() }, h(IconSearch)) : null,
      !railVisible ? h("button", { type: "button", className: "ce-tool ce-workspace-search", title: `${t(mode === "changes" ? "search.changesHint" : "search.workspaceHint")} (⇧⌘F / Ctrl+Shift+F)`, "aria-label": t(mode === "changes" ? "search.changesHint" : "search.workspaceHint"), onClick: openSearch }, h(IconTextSearch), h("span", null, t(mode === "changes" ? "search.changesAction" : "changes.searchWorkspace"))) : null,
      // The terminal sits with the tool icons: the command centre trigger
      // already reads as ">_", which would double the glyph. The built-in
      // tab is preferred; the system terminal is the fallback and its own
      // command entry.
      builtinAvailable() || terminalEntry.available() ? h("button", {
        type: "button",
        className: "ce-tool",
        title: builtinAvailable() ? t("toolbar.terminalHint") : t("toolbar.externalTerminalHint"),
        "aria-label": builtinAvailable() ? t("toolbar.terminal") : t("toolbar.externalTerminal"),
        onClick: () => {
          if (!openBuiltin()) void openTerminal();
        }
      }, h(IconTerminal)) : null,
      h("button", { type: "button", className: "ce-tool", title: `${statusTitle}`, onClick: () => {
        refreshGit();
        setTreeKey((k) => k + 1);
        if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
      } }, h(IconRefresh)),
      h("span", { className: `ce-dot ce-dot-${status.state}`, title: statusTitle })
    ),
    notice.kind === "error" && notice.text ? h(
      "div",
      { className: "ce-banner" },
      h("span", { className: "ce-banner-text" }, notice.text),
      h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => say("") }, "✕")
    ) : null,
    externalConflict ? h(
      "div",
      { className: "ce-banner ce-banner-warn" },
      h("span", { className: "ce-banner-text" }, t("watch.external", { path: externalConflict.path })),
      h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => void openConflictDiff() }, t("watch.compareDisk")),
      h("button", { type: "button", className: `ce-tool ce-tiny${overwriteArm ? " ce-tool-danger" : ""}`, onClick: () => {
        if (overwriteArm) {
          setOverwriteArm(false);
          saveEdit({ overwrite: true });
        } else setOverwriteArm(true);
      } }, overwriteArm ? t("watch.overwriteConfirm") : t("watch.overwriteDraft")),
      h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => {
        setExternalConflict(null);
        setConflictDiff(null);
        setOverwriteArm(false);
        void backgroundReload(true);
      } }, t("watch.reloadDiscarding")),
      h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => {
        setExternalConflict(null);
        setOverwriteArm(false);
      } }, t("watch.keepEditing"))
    ) : null,
    conflictDiff ? h(
      "div",
      { className: "ce-conflict-diff" },
      h(
        "div",
        { className: "ce-conflict-head" },
        h("span", { className: "ce-conflict-title" }, t("watch.conflictTitle", { path: conflictDiff.path })),
        conflictDiff.busy ? h("span", { className: "ce-conflict-meta" }, t("loading")) : null,
        !conflictDiff.busy && !conflictDiff.error ? h("span", { className: "ce-conflict-meta" }, conflictDiff.identical ? t("watch.conflictIdentical") : `+${conflictDiff.add} −${conflictDiff.del}`) : null,
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setConflictDiff(null) }, "✕")
      ),
      conflictDiff.error ? h("div", { className: "ce-note" }, conflictDiff.error) : conflictDiff.identical ? h("div", { className: "ce-note" }, t("watch.conflictIdenticalHint")) : h(DiffView, {
        t,
        diff: { path: conflictDiff.path, scope: "call", text: conflictDiff.text, gutter: false },
        onClose: () => setConflictDiff(null),
        canSource: false
      })
    ) : null,
    h(
      "div",
      { className: "ce-main", ref: mainRef },
      railVisible ? h(
        "div",
        { className: "ce-rail-wrap ce-rail-with-search", style: { width: `${railW}px` } },
        h(
          "div",
          { className: "ce-rail-navigation" },
          h("button", { type: "button", className: "ce-rail-search", title: `${t(mode === "changes" ? "search.changesHint" : "search.workspaceHint")} (⇧⌘F / Ctrl+Shift+F)`, onClick: openSearch }, h(IconTextSearch), h("span", null, t(mode === "changes" ? "search.changesAction" : "changes.searchWorkspace"))),
          h("button", { type: "button", className: "ce-tool ce-rail-quickopen", "aria-label": t("quickopen.placeholder"), title: `${t("quickopen.placeholder")} (⌘P / Ctrl+P)`, onClick: () => palette ? closePalette() : openPalette() }, h(IconSearch))
        ),
        mode === "files" ? h(TreePanel, {
          cwd,
          sessionId,
          t,
          onOpenFile: (path, line, col) => void openFile(path, line, col),
          onSearchDirectory: (directory) => openSearch({ kind: "directory", directory }),
          activePath: doc?.path ?? diff?.path,
          revealPath: doc?.path ?? null,
          refreshKey: treeKey,
          staleTick: stale.tick,
          staleDirs: stale.dirs,
          onNotify: (text, kind) => say(text, kind),
          onDeleted: forgetPath
        }) : h(ChangesPanel, {
          cwd,
          sessionId,
          onDelete: (item) => void deleteUntracked(item).then((ok) => {
            if (ok) forgetPath(item.path);
          }),
          onDeleteDir: (dirPath, dirItems) => void deleteUntrackedMany(dirPath, dirItems).then((n) => {
            if (n > 0) forgetPath(dirPath);
          }),
          t,
          git,
          repos,
          repoSel,
          onSelectRepo: (root) => {
            repoSelRef.current = root;
            setRepoSel(root);
            if (!root) refreshGit();
          },
          commitsOpen,
          setCommitsOpen,
          onOpenCommit: (commit) => void openCommit(commit),
          onOpenDiff: (path, scope, repoOverride, refs) => void (scope === "commit" || scope === "compare" ? openDiff(path, scope, repoOverride, refs) : openChangeSource(path, scope)),
          onDiscard: (item) => void discardChange(item),
          onDiscardDir: (dirItems) => void discardMany(dirItems),
          onStage: (item) => void stageChange(item.path),
          onStageDir: (dirPath) => void stageChange(dirPath),
          onUnstage: (item) => void unstageChange(item.path),
          onUnstageDir: (dirPath) => void unstageChange(dirPath),
          onCommit: (msg, stageAll, amend) => commitChanges(msg, stageAll, amend),
          committing,
          onNotify: (text, kind) => say(text, kind),
          refresh: refreshGit,
          onCherryPick: (commit) => void pickCommit(commit),
          onResolve: (path, side) => void resolveConflict(path, side),
          onSequencer: (action) => void sequencerAction(action),
          compare,
          setCompare,
          seqDisabled: seqBusy,
          onAiMessage: () => generateCommitMessage()
        })
      ) : null,
      railVisible ? h("div", { className: "ce-splitter", onMouseDown: startRailDrag, onDoubleClick: () => setRailVisible(false), title: "⇔ 拖动调宽 · 双击收起" }) : h("button", { type: "button", className: "ce-rail-tab", title: "展开侧栏 (⌘B / Ctrl+B)", onClick: () => setRailVisible(true) }, "▸"),
      h(
        "div",
        { className: `ce-editor${fileDropOver ? " ce-editor-file-drop" : ""}`, ...editorDropProps(), onDragEnd: () => {
          setFileDropOver(false);
          setTabDropOver(null);
        } },
        fileDropOver ? h("div", { className: "ce-file-drop-hint", role: "status" }, t("drag.openHere")) : null,
        h("button", { type: "button", className: "ce-mobile-back", onClick: () => {
          setSearchOpen(false);
          closePalette();
          setRailVisible(true);
          setMobileView("files");
        } }, `← ${t("layout.backFiles")}`),
        tabs.length > 0 ? h(
          "div",
          { className: "ce-tabs", ref: tabsRef },
          tabs.map((p) => {
            const active = doc?.path === p && (!diff || !showDiffView);
            const dirty = active && editing && editText !== (doc?.raw ?? "");
            return h(
              "div",
              {
                key: p,
                className: `ce-tab${active ? " ce-tab-active" : ""}${tabDropOver === p ? " ce-tab-drop-before" : ""}`,
                ...fileDragProps({ cwd, path: p, source: "tab", sessionId }),
                ...editorDropProps(p),
                onDragEnd: () => {
                  setFileDropOver(false);
                  setTabDropOver(null);
                },
                title: RelPath(cwd, p) || p,
                onClick: () => switchTab(p),
                onContextMenu: (e) => openTabMenu(e, p),
                onAuxClick: (e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(p);
                  }
                }
              },
              h("span", { className: `ce-tab-dot${dirty ? " ce-tab-dirty" : ""}` }, dirty ? "●" : ""),
              pinned.includes(p) ? h("span", { className: "ce-tab-pin", title: t("tabs.pinned"), "aria-label": t("tabs.pinned") }, "◉") : null,
              h("span", { className: "ce-tab-name" }, p.split("/").pop()),
              h("button", {
                type: "button",
                className: "ce-tab-x",
                title: t("editor.closeTab"),
                onClick: (e) => {
                  e.stopPropagation();
                  closeTab(p);
                }
              }, "✕")
            );
          })
        ) : null,
        // VS Code-style editor tab context menu: Close / Close Others /
        // Close to the Right / Close All, all through closeTabs().
        tabMenu ? h(
          "div",
          { className: "cet-context ce-tabmenu", ref: tabMenuRef, style: { left: tabMenu.x, top: tabMenu.y }, role: "menu", onMouseDown: (e) => e.stopPropagation() },
          h("div", { className: "cet-context-path" }, tabMenu.path.split("/").pop()),
          h("button", { type: "button", role: "menuitem", onClick: () => togglePin(tabMenu.path) }, pinned.includes(tabMenu.path) ? t("tabs.unpin") : t("tabs.pin")),
          h("div", { className: "cet-context-rule" }),
          h("button", { type: "button", role: "menuitem", onClick: () => closeTabs([tabMenu.path]) }, t("tabs.close")),
          h("button", { type: "button", role: "menuitem", disabled: tabs.length <= 1, onClick: () => closeTabs(removedPaths(tabs, closeOtherTabs(tabs, tabMenu.path)), { respectPins: true }) }, t("tabs.closeOthers")),
          h("button", { type: "button", role: "menuitem", disabled: closeTabsToRight(tabs, tabMenu.path).length >= tabs.length, onClick: () => closeTabs(removedPaths(tabs, closeTabsToRight(tabs, tabMenu.path)), { respectPins: true }) }, t("tabs.closeRight")),
          h("div", { className: "cet-context-rule" }),
          h("button", { type: "button", role: "menuitem", className: "cet-context-danger", onClick: () => closeTabs(tabs, { respectPins: true }) }, t("tabs.closeAll"))
        ) : null,
        diff && showDiffView ? h(DiffView, {
          t,
          diff,
          onClose: () => {
            setDiff(null);
            if (docRef.current) modeRef.current = "code";
          },
          onOpenSource: (line) => openDiffSource(line),
          canSource: diff.scope === "working" || diff.scope === "branch" || diff.scope === "staged",
          onRevertHunk: diff.scope === "working" && !diff.untracked && typeof diff.path === "string" && diff.path !== "" ? (idx, header) => void revertHunk(idx, header) : null
        }) : doc ? h(
          Fragment,
          null,
          h(
            "div",
            { className: "ce-head" },
            h("button", { type: "button", className: "ce-tool ce-tiny", title: t("back"), disabled: !canBack, onClick: goBack }, h(IconArrowLeft)),
            h("button", { type: "button", className: "ce-tool ce-tiny", title: t("forward"), disabled: !canForward, onClick: goForward }, h(IconArrowRight)),
            h("span", { className: "ce-head-path" }, RelPath(cwd, doc.path) || doc.path),
            currentSymbol ? h(
              "button",
              { type: "button", className: "ce-crumb", title: `${t("symbols.crumb")} (⌘⇧O)`, onClick: () => LSP_RE.test(doc.path) && setSymPalette({}) },
              `› ${currentSymbol.name}`
            ) : null,
            docLang !== "text" ? h("span", { className: "ce-chip" }, docLang) : null,
            diffMarks ? h("button", { type: "button", className: "ce-chip ce-chip-mark", title: t("diff.marksClear"), onClick: () => setDiffMarks(null) }, `${t("diff.marksChip")} ${diffMarks.size}`) : null,
            diffMarks && diffMarks.size === 0 && diff?.note && !showDiffView ? h("span", { className: "ce-chip", title: diff.note }, diff.note) : null,
            diff && !showDiffView && (diff.scope === "working" || diff.scope === "branch") ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("diff.showHunks"), onClick: () => setShowDiffView(true) }, "≡") : null,
            doc.truncated ? h("span", { className: "ce-chip" }, t("truncated")) : null,
            doc && !diff && PREVIEW_RE.test(doc.path) ? h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("editor.previewToggle"), onClick: () => setPreviewOn((v) => !v) }, previewOn ? t("editor.raw") : t("editor.preview")) : null,
            doc && !diff && !editing && !doc.image ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("editor.edit"), onClick: startEdit }, "✎") : null,
            editing ? h("button", { type: "button", className: "ce-link", onClick: () => saveEdit() }, t("editor.save")) : null,
            editing ? h("button", { type: "button", className: "ce-link", onClick: cancelEdit }, t("editor.cancel")) : null,
            editing && editText !== (doc?.raw ?? "") ? h("span", { className: "ce-chip ce-chip-warn" }, t("editor.dirty")) : null,
            doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${findOpen ? " ce-tool-on" : ""}`, title: `${t("editor.find")} (⌘F / Ctrl+F)`, onClick: () => setFindOpen((v) => !v) }, "⌕") : null,
            doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${wrapOn ? " ce-tool-on" : ""}`, title: `${t("editor.wrap")} (⌥Z / Alt+Z)`, onClick: toggleWrap }, "↩") : null,
            doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${blameOn ? " ce-tool-on" : ""}`, title: t("blame.toggle"), disabled: wrapOn, onClick: () => {
              setBlameOn((v) => !v);
              setBlame(null);
            } }, "B") : null,
            doc && !diff && !doc.image && LSP_RE.test(doc.path) ? h("button", { type: "button", className: "ce-tool ce-tiny", title: `${t("jump.refsTitle")} (⇧F12)`, "aria-label": t("jump.refsTitle"), onClick: () => findReferences() }, "⌖") : null,
            doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${fileHist ? " ce-tool-on" : ""}`, title: t("history.title"), onClick: openFileHistory }, "🕘") : null,
            h("span", { className: "ce-spacer" }),
            cursor ? h("button", { type: "button", className: "ce-pos ce-pos-btn", title: t("goto.title"), onClick: () => setGotoOpen(true) }, `Ln ${cursor.line}, Col ${cursor.col}${cursor.word ? ` · ${cursor.word}` : ""}`) : null,
            diagnostics.length ? h("button", { type: "button", className: `ce-diag ce-diag-btn${problemsOpen ? " ce-tool-on" : ""}`, title: `${t("problems.title")} (⇧⌘M / Ctrl+Shift+M)`, "aria-expanded": problemsOpen, onClick: toggleProblems }, `${diagnostics.length} ${t("diag.count")}`) : null
          ),
          findOpen && !editing ? h(
            Fragment,
            null,
            h(
              "div",
              { className: "ce-find" },
              h("input", {
                className: "ce-input ce-find-input",
                placeholder: t("editor.findPlaceholder"),
                value: findQuery,
                autoFocus: true,
                "aria-label": t("editor.findPlaceholder"),
                onChange: (e) => {
                  setFindQuery(e.target.value);
                  setFindIdx(0);
                },
                onKeyDown: (e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    jumpFind(e.shiftKey ? -1 : 1);
                  } else if (e.key === "Escape") setFindOpen(false);
                }
              }),
              h("button", { type: "button", className: `ce-tool ce-tiny${findOpts.caseSensitive ? " ce-tool-on" : ""}`, title: t("find.case"), onClick: () => {
                setFindOpts((o) => ({ ...o, caseSensitive: !o.caseSensitive }));
                setFindIdx(0);
              } }, "Aa"),
              h("button", { type: "button", className: `ce-tool ce-tiny${findOpts.words ? " ce-tool-on" : ""}`, title: t("find.words"), onClick: () => {
                setFindOpts((o) => ({ ...o, words: !o.words }));
                setFindIdx(0);
              } }, "ab|"),
              h("button", { type: "button", className: `ce-tool ce-tiny${findOpts.regex ? " ce-tool-on" : ""}`, title: t("find.regex"), onClick: () => {
                setFindOpts((o) => ({ ...o, regex: !o.regex }));
                setFindIdx(0);
              } }, ".*"),
              h("button", { type: "button", className: `ce-tool ce-tiny${replaceOpen ? " ce-tool-on" : ""}`, title: `${t("editor.replaceToggle")} (⌘⌥F / Ctrl+Alt+F)`, "aria-expanded": replaceOpen, onClick: () => setReplaceOpen((v) => !v) }, "⇄"),
              findRe === false ? h("span", { className: "ce-find-count cea-err" }, t("find.badRegex")) : h("span", { className: "ce-find-count" }, findQuery ? `${findMatches.length === 0 ? 0 : Math.min(findIdx + 1, findMatches.length)}/${findMatches.length}` : ""),
              h("button", { type: "button", className: "ce-tool ce-tiny", title: t("find.prev"), onClick: () => jumpFind(-1) }, "↑"),
              h("button", { type: "button", className: "ce-tool ce-tiny", title: t("find.next"), onClick: () => jumpFind(1) }, "↓"),
              h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setFindOpen(false) }, "✕")
            ),
            replaceOpen ? h(
              "div",
              { className: "ce-find ce-find-replace" },
              h("input", {
                className: "ce-input ce-find-input",
                placeholder: t("editor.replacePlaceholder"),
                "aria-label": t("editor.replace"),
                value: replaceText,
                onChange: (e) => setReplaceText(e.target.value),
                onKeyDown: (e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    doReplace(false);
                  } else if (e.key === "Escape") setReplaceOpen(false);
                }
              }),
              h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("editor.replaceOneTitle"), disabled: findMatches.length === 0 || findRe === false, onClick: () => doReplace(false) }, t("editor.replace")),
              h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("editor.replaceAllTitle"), disabled: findMatches.length === 0 || findRe === false, onClick: () => doReplace(true) }, t("editor.replaceAll")),
              h("button", { type: "button", className: `ce-tool ce-tiny${preserveCase ? " ce-tool-on" : ""}`, title: t("find.preserveCase"), "aria-pressed": preserveCase, onClick: () => setPreserveCase((v) => !v) }, "AB")
            ) : null
          ) : null,
          h(
            "div",
            { className: "ce-code-wrap" },
            doc.image ? h(
              "div",
              { className: "ce-imgwrap ce-scroll" },
              doc.image.base64 ? h("img", { className: "ce-img", src: `data:${doc.image.mime};base64,${doc.image.base64}`, alt: doc.path }) : h("div", { className: "ce-note" }, t("image.tooBig")),
              h("div", { className: "ce-imgmeta" }, `${doc.image.mime} · ${(doc.image.size / 1024).toFixed(1)} KB${doc.image.truncated ? ` · ${t("image.tooBig")}` : ""}`)
            ) : editing ? h(
              "div",
              { className: "ce-edit-wrap" },
              editGutter ? h("div", { className: "ce-gutter ce-edit-gutter" }, editGutter.map((g) => h("div", { key: g.line, className: "ce-gutter-row", style: { top: g.top } }, g.line))) : null,
              h("textarea", {
                ref: editTaRef,
                className: `ce-edit-ta${wrapOn ? " ce-edit-ta-wrap" : ""}`,
                value: editText,
                spellcheck: false,
                onChange: (e) => setEditText(e.target.value),
                onScroll: (e) => {
                  if (editGutter) {
                    const g = e.currentTarget.parentElement?.querySelector(".ce-edit-gutter");
                    if (g) g.scrollTop = e.currentTarget.scrollTop;
                  }
                },
                onKeyDown: (e) => {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const res = handleTabIndent(editText, ta.selectionStart, ta.selectionEnd, e.shiftKey);
                    setEditText(res.text);
                    requestAnimationFrame(() => {
                      ta.selectionStart = res.start;
                      ta.selectionEnd = res.end;
                    });
                    return;
                  }
                  if ((e.metaKey || e.ctrlKey) && e.code === "KeyF" && !e.shiftKey) {
                    e.preventDefault();
                    setEditFindOpen(true);
                    return;
                  }
                  if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === "KeyF") {
                    e.preventDefault();
                    setEditFindOpen(true);
                    return;
                  }
                }
              }),
              editFindOpen ? h(
                "div",
                { className: "ce-edit-find" },
                h("input", { className: "ce-input ce-edit-find-input", value: editFindQuery, placeholder: t("editor.find"), onChange: (e) => {
                  setEditFindQuery(e.target.value);
                  setEditFindIdx(0);
                }, onKeyDown: (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setEditFindIdx((i) => (i + 1) % Math.max(1, editFindMatches.length));
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditFindOpen(false);
                  }
                } }),
                h("span", { className: "ce-edit-find-count" }, editFindMatches.length > 0 ? `${editFindIdx + 1}/${editFindMatches.length}` : t("editor.noMatch")),
                h("button", { type: "button", className: "ce-tool ce-tiny", title: t("editor.replace"), onClick: () => {
                  const res = replaceInText2(editText, editFindQuery, editReplaceText, editFindOpts, editFindIdx, false);
                  if (res.count > 0) {
                    setEditText(res.text);
                    setEditFindIdx(Math.min(editFindIdx, Math.max(0, findInText(res.text, editFindQuery, editFindOpts).length - 1)));
                  }
                } }, "⇄"),
                h("button", { type: "button", className: "ce-tool ce-tiny", title: t("editor.replaceAll"), onClick: () => {
                  const res = replaceInText2(editText, editFindQuery, editReplaceText, editFindOpts, 0, true);
                  if (res.count > 0) {
                    setEditText(res.text);
                    say(t("replace.replacedAll", { n: res.count }));
                  }
                } }, t("editor.replaceAll")),
                h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setEditFindOpen(false) }, "✕")
              ) : null
            ) : previewActive ? MD_RE.test(doc.path) ? h(MarkdownView, { text: doc.raw }) : SVG_RE.test(doc.path) ? h("div", { className: "ce-imgwrap ce-scroll" }, h("img", { className: "ce-img", src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc.raw)}`, alt: doc.path })) : h("iframe", { className: "ce-htmlprev", sandbox: "", srcDoc: doc.raw, title: doc.path }) : h(
              Fragment,
              null,
              blameOn && blame !== null && !wrapOn ? h("div", { className: "ce-blame" }, visible?.blameRows) : null,
              wrapOn ? null : h("div", { className: "ce-gutter" }, h("div", { className: "ce-gutter-inner", style: { transform: `translateY(${-scroll}px)` } }, gutter)),
              h(
                "div",
                {
                  className: "ce-code",
                  tabIndex: 0,
                  ref: codeRef,
                  onKeyDown,
                  onClick: onEditorClick,
                  onMouseMove: onEditorMouseMove,
                  onMouseLeave: cancelHover,
                  onScroll: (event) => {
                    setScroll(event.currentTarget.scrollTop);
                    cancelHover();
                  },
                  style: { outline: "none" }
                },
                wrapOn ? h(
                  "div",
                  { className: "ce-wdoc" },
                  wrapDoc?.rows,
                  wrapDoc?.capped ? h("div", { className: "ce-note ce-wcap" }, t("editor.wrapCapped", { n: WRAP_LINE_CAP })) : null
                ) : h("div", { className: "ce-code-inner", style: { height: `${visible?.total ?? (doc.lines.length + 2) * ROW}px` } }, visible?.rows)
              )
            ),
            !editing && !previewActive && changeRailBlobs.length > 0 ? h("div", { className: "ce-changerail" }, changeRailBlobs.map((b, i) => h("button", {
              key: i,
              type: "button",
              className: `ce-changeblob ce-changeblob-${b.kind}`,
              title: `L${b.start}${b.end > b.start ? `-${b.end}` : ""} · ${t("diff.marksChip")}`,
              style: {
                top: `${(b.start - 1) / Math.max(1, doc.lines.length) * 100}%`,
                height: `${Math.max(0.6, (b.end - b.start + 1) / Math.max(1, doc.lines.length) * 100)}%`
              },
              onClick: () => jumpToLine(b.start)
            }, null))) : null,
            peek ? h(RefsPeek, { t, cwd, peek, scroll, viewport, totalLines: doc.lines.length, onPick: pickPeek, onClose: closePeek }) : null,
            hover && !editing ? h("div", {
              className: "ce-hover",
              role: "tooltip",
              style: { top: Math.max(4, hover.y * ROW - scroll + ROW + 4), left: 12 }
            }, hover.text) : null,
            symPalette ? h(SymbolPalette, { t, symbols, onPick: (s) => {
              setSymPalette(null);
              revealPosition(s.line, s.col, s.name);
            }, onClose: () => setSymPalette(null) }) : null,
            wsym ? h(WorkspaceSymbolPalette, {
              t,
              cwd,
              state: wsym,
              onQuery: (query) => setWsym((cur) => cur === null ? cur : { ...cur, query, busy: query.trim() !== "", seq: cur.seq + 1 }),
              onPick: (s) => {
                setWsym(null);
                if (typeof s.path === "string" && s.path !== "") void openFile(s.path, s.line, s.col, true, { line: s.line, col: s.col, word: s.name });
              },
              onClose: () => setWsym(null)
            }) : null,
            compareOpen ? h(CompareRefsPalette, {
              t,
              busy: compareBusy,
              branches: compareBranches,
              onRun: (base, head) => void doCompare(base, head),
              onClose: () => setCompareOpen(false)
            }) : null,
            tasks ? h(TaskPalette, {
              t,
              state: tasks,
              onRun: (script) => void startTask(script),
              onClose: () => setTasks(null)
            }) : null,
            task ? h(TaskOutputPanel, {
              t,
              state: task,
              onStop: () => void stopTask(),
              onClose: () => {
                taskSeq.current += 1;
                setTask(null);
              },
              onOpenFile: (path, line, col) => void openFile(path, line, col, true, { line, col })
            }) : null,
            delPreview ? h(
              "div",
              { className: "ce-overlay", ref: delPreviewRef, role: "dialog", "aria-label": t("diff.deletedAt") },
              h(
                "div",
                { className: "ce-overlay-head" },
                h("span", null, `${t("diff.deletedAt")} · L${delPreview.anchor}`),
                h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setDelPreview(null) }, "✕")
              ),
              h("div", { className: "ce-overlay-list" }, delPreview.lines.map((ln, j) => h("div", { key: j, className: "ce-dline ce-dline-del" }, h("span", { className: "ce-dtext" }, `- ${ln}`))))
            ) : null
          )
        ) : h("div", { className: "ce-empty" }, t("editor.placeholder")),
        overlay ? h(LocationList, { t, overlay, cwd, onPick: (item) => {
          const word = cursorRef.current?.word;
          setOverlay(null);
          void openFile(item.path, item.line, item.col, true, word ? { line: item.line, col: item.col, word } : null);
        }, onClose: () => setOverlay(null) }) : null,
        palette ? h(QuickOpen, { t, state: palette, onQuery: onPaletteQuery, onPick: onPalettePick, onClose: closePalette }) : null,
        gotoOpen && doc && !doc.image ? h(GotoLinePalette, { t, totalLines: wrapOn ? Math.min(doc.lines.length, WRAP_LINE_CAP) : doc.lines.length, initial: cursor?.line ?? 1, onGo: jumpToLine, onClose: () => setGotoOpen(false) }) : null,
        fileHist ? h(FileHistoryOverlay, { t, hist: fileHist, onPick: (c) => void openHistCommit(c), onClose: () => setFileHist(null) }) : null,
        problemsOpen ? h(ProblemsPanel, {
          t,
          diagnostics,
          workspaceFiles: workspaceDiag,
          onPick: (item) => {
            setProblemsOpen(false);
            if (item._file && cwd) {
              const parts = item._file.split("/");
              const path = parts.length >= 2 ? parts.slice(-2).join("/") : item._file;
              void openFile(path, item.line, item.col, true, { line: item.line, col: item.col, word: "" });
            } else revealPosition(item.line, item.col, "");
          },
          onClose: () => setProblemsOpen(false)
        }) : null,
        searchOpen && search ? h(SearchPanel, {
          t,
          cwd,
          state: search,
          onQuery: (q) => changeSearch({ query: q }),
          onInclude: (v) => changeSearch({ include: v }),
          onDirectory: (directory) => changeSearch({ scope: directory.trim() ? { kind: "directory", directory: directory.trim() } : { kind: "workspace" } }),
          onToggleRegex: () => changeSearch({ regex: !search.regex }),
          onToggleWords: () => changeSearch({ words: !search.words }),
          onSubmit: () => runSearchNow(search.query, search.include, search),
          onPick: onSearchPick,
          onClose: () => setSearchOpen(false),
          onNotify: (text, kind) => say(text, kind)
        }) : null
      )
    ),
    commandOpen ? h(CommandPalette, { t, commands, onClose: () => setCommandOpen(false) }) : null,
    branchPickOpen && git?.repo ? h(BranchPalette, {
      cwd,
      repo: repoSel,
      current: git.branch,
      t,
      onFetch: () => void doFetch(),
      onPull: () => void doPull(),
      onPush: () => void doPush(),
      onClose: () => setBranchPickOpen(false),
      onDone: (ok, err) => {
        setBranchPickOpen(false);
        if (!ok) {
          say(`${t("error")}: ${err}`, "error");
          return;
        }
        say(t("branch.checkedOut"));
        refreshGit();
        if (docRef.current) void loadFile(docRef.current.path, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
      }
    }) : null,
    h(
      "div",
      { className: "ce-statusbar" },
      h("span", null, notice.kind === "info" ? notice.text || (doc && !diagnostics.length && LSP_RE.test(doc.path) ? t("nodiag") : "") : ""),
      h("span", { className: "ce-spacer" }),
      h("span", { className: "ce-prog" }, status.progress || (status.state === "error" ? `${status.label ?? "lsp"} ✕` : status.state === "ready" ? `${status.label ?? "lsp"} ✓` : status.state === "starting" ? `${status.label ?? "lsp"} …` : ""))
    )
  );
}
function CodeTitle({ useTabInfo }) {
  const tabInfo = useTabInfo ? useTabInfo() : null;
  return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(IconCode)), tabInfo?.tab?.title ?? "Code");
}

// src/client/styles.js
var CSS2 = `
.ce-root{height:100%;min-height:0;display:flex;flex-direction:column;position:relative;color:var(--dsw-alias-label-primary,#ddd);font-size:13px;background:var(--dsw-alias-bg-base,#181818)}
.ce-toolbar{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.ce-tool.ce-workspace-search{width:auto;flex:none;gap:5px;padding:0 7px;white-space:nowrap;font:inherit;font-size:11px}
.ce-workspace-search svg{width:14px;height:14px;flex:none}
.ce-seg{display:flex;border-radius:var(--dsw-radius-sm,6px);overflow:hidden;border:.5px solid var(--dsw-alias-border-l2,#444)}
.ce-seg-btn{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#999);padding:3px 10px;cursor:pointer;font:inherit}
.ce-seg-on{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#eee)}
.ce-branch{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary,#9ab);font:inherit;font-size:12px;margin-left:2px;border:0;background:transparent;cursor:pointer;padding:2px 7px;border-radius:6px}
.ce-branch:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30);color:var(--dsw-alias-label-primary,#dde)}
.ce-branch:disabled{opacity:.6;cursor:default}
.ce-ab{font-size:10.5px;font-weight:700;letter-spacing:.02em}
.ce-ab-ahead{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-ab-behind{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-spin{display:inline-flex;animation:ce-spin .9s linear infinite}
.ce-spin svg{width:12px;height:12px}
@keyframes ce-spin{to{transform:rotate(360deg)}}
.ce-spacer{flex:1}
.ce-tool{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--dsw-radius-sm,6px);border:0;background:transparent;color:var(--dsw-alias-label-secondary,#999);cursor:pointer}
.ce-tool:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#eee)}
.ce-tool-on{color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-tool:disabled{opacity:.35;cursor:default}
.ce-tiny{width:20px;height:20px}
.ce-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary,#666)}
.ce-dot-ready{background:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-dot-starting{background:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-dot-error{background:var(--dsw-alias-state-error-primary,#f85149)}
.ce-main{flex:1;min-height:0;display:flex}
.ce-rail-wrap{width:230px;min-width:150px;flex:none;display:flex;border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-rail-with-search{flex-direction:column;min-height:0}
.ce-rail-with-search>.ce-rail{min-height:0}
.ce-rail-search{display:flex;align-items:center;gap:8px;flex:none;align-self:stretch;min-height:32px;margin:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l2,#444);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#1e2126);color:var(--dsw-alias-label-secondary,#aaa);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.ce-rail-search svg{width:14px;height:14px;flex:none}
.ce-rail-search:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e);color:var(--dsw-alias-label-primary,#ddd)}
.ce-rail-search:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:1px}
.ce-rail{flex:1;min-width:0}
.ce-scroll{overflow:auto;scrollbar-gutter:stable}
.ce-row{display:flex;align-items:center;gap:6px;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:4px 8px;cursor:pointer;border-radius:4px;min-width:0}
.ce-row:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-active{background:var(--dsw-alias-interactive-bg-hover,#2c313a)}
.ce-row-drop{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 18%,transparent);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#59b7ff)}
.ce-tree-ico{margin:0 1px}
.ce-ico{flex:none;display:inline-flex;color:var(--dsw-alias-label-tertiary,#777)}
.ce-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ce-note{color:var(--dsw-alias-label-tertiary,#777);padding:3px 10px;font-size:12px}
.ce-section{display:flex;align-items:center;justify-content:space-between;gap:4px;color:var(--dsw-alias-label-secondary,#999);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 8px 4px}
.ce-badge{flex:none;width:16px;height:16px;line-height:16px;text-align:center;border-radius:4px;font-size:10px;font-weight:700;background:var(--dsw-alias-interactive-bg-hover,#333);color:var(--dsw-alias-label-secondary,#999)}
.ce-badge-m{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-badge-a,.ce-badge-u{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-badge-d,.ce-badge-r{color:var(--dsw-alias-state-error-primary,#f85149)}
.ce-badge-c{color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-editor{flex:1;min-width:0;display:flex;flex-direction:column;position:relative}
.ce-tabs{display:flex;gap:2px;align-items:flex-end;flex:none;overflow-x:auto;overflow-y:hidden;padding:4px 6px 0;background:var(--dsw-alias-bg-base,#181818);border-bottom:.5px solid var(--dsw-alias-border-l1,#333);scrollbar-width:thin}
.ce-tab{display:flex;gap:4px;align-items:center;flex:none;max-width:170px;padding:3px 5px 3px 8px;border:.5px solid transparent;border-bottom:0;border-radius:6px 6px 0 0;cursor:pointer;color:var(--dsw-alias-label-tertiary,#889);background:transparent;font-size:11.5px}
.ce-tab:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-tab-active{background:var(--dsw-alias-bg-layer-1,#1e2126);color:var(--dsw-alias-label-primary,#ddd);border-color:var(--dsw-alias-border-l1,#333)}
.ce-tab-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-tab-dot{flex:none;width:9px;font-size:8px;line-height:1;color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-tab-x{border:0;background:transparent;color:inherit;font:inherit;font-size:9px;cursor:pointer;padding:1px 3px;border-radius:4px;opacity:.55;flex:none}
.ce-tab-x:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover,#3a3d42)}
.ce-head{display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none;min-width:0}
.ce-head-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary,#ddd)}
.ce-chip{font-size:11px;padding:1px 7px;border-radius:99px;background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-secondary,#999);flex:none}
.ce-pos{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#888);flex:none}
.ce-diag{font-size:11px;color:var(--dsw-alias-state-error-primary,#f85149);flex:none}
.ce-code-wrap{flex:1;min-height:0;display:flex;overflow:hidden;position:relative}
.ce-gutter{flex:none;width:52px;overflow:hidden;position:relative;background:var(--dsw-alias-bg-base,#181818);border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-gutter-inner{position:absolute;top:0;left:0;right:0}
.ce-gline{position:absolute;right:8px;height:${ROW}px;line-height:${ROW}px;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-tertiary,#667)}
.ce-gline-active{color:var(--dsw-alias-label-primary,#cde)}
.ce-code{flex:1;min-width:0;overflow:auto;position:relative}
.ce-code-inner{position:relative;min-width:max-content}
.ce-line{position:absolute;left:0;min-width:max-content;height:${ROW}px;line-height:${ROW}px;white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;padding-right:24px}
.ce-flash{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 18%,transparent);animation:ce-fade 1.4s ease-out}
@keyframes ce-fade{from{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 30%,transparent)}to{background:transparent}}
.ce-kw{color:var(--ce-kw,var(--dsw-alias-brand-primary,#6cb2ff))}
.ce-type{color:var(--ce-type,#7de3a4)}
.ce-str{color:var(--ce-str,#e6b56d)}
.ce-prop{color:var(--ce-prop,#9cdcfe)}
.ce-num{color:var(--ce-num,#d19a66)}
.ce-com{color:var(--ce-com,var(--dsw-alias-label-tertiary,#7a8490));font-style:italic}
.ce-jump{cursor:pointer;text-decoration:underline dotted transparent;text-underline-offset:3px}
.ce-jump:hover{text-decoration-color:var(--dsw-alias-label-tertiary,#889)}
.ce-underline{position:absolute;bottom:3px;height:2px;border-bottom:2px dotted var(--dsw-alias-state-error-primary,#f85149);pointer-events:auto;background:transparent}
.ce-underline-warn{border-bottom-color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-hover{position:absolute;z-index:5;max-width:420px;min-width:180px;background:var(--dsw-alias-bg-overlay,#232729);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:var(--dsw-radius-md,8px);padding:8px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;box-shadow:0 6px 22px rgba(0,0,0,.35);pointer-events:none;color:var(--dsw-alias-label-primary,#ddd)}
.ce-overlay{position:absolute;left:8px;right:8px;top:36px;z-index:6;background:var(--dsw-alias-bg-layer-2,#24272c);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:var(--dsw-radius-md,8px);box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;max-height:60%}
.ce-overlay-head{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);font-weight:600}
.ce-overlay-list{overflow:auto}
.ce-loc{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px;cursor:pointer;white-space:nowrap}
.ce-loc:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-loc-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-brand-primary,#6cb2ff);flex:none}
.ce-loc-file{color:var(--dsw-alias-label-tertiary,#777);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-loc-snippet{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-secondary,#999);overflow:hidden;text-overflow:ellipsis}
.ce-dline{display:flex;min-width:max-content;height:${ROW}px;line-height:${ROW}px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;white-space:pre;padding-right:24px}
.ce-dline-add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent)}
.ce-dline-del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 14%,transparent)}
.ce-dline-hunk{color:var(--dsw-alias-brand-primary,#6cb2ff)}
.ce-dline-meta{color:var(--dsw-alias-label-tertiary,#777);font-style:italic}
.ce-dnum{width:44px;flex:none;text-align:right;padding-right:8px;color:var(--dsw-alias-label-tertiary,#667);user-select:none}
.ce-dtext{min-width:0}
.ce-sbsrow{display:grid;grid-template-columns:40px minmax(0,1fr) 40px minmax(0,1fr)}
.ce-sbsrow-full{display:flex;align-items:center}
.ce-sbsrow-full .ce-sbscell{flex:1;min-width:0}
.ce-hunk-revert{margin-left:auto;flex:none;opacity:.6}
.ce-dline:hover .ce-hunk-revert,.ce-sbsrow-full:hover .ce-hunk-revert{opacity:1}
.ce-hunk-confirm{margin-left:auto;display:flex;gap:2px;align-items:center;flex:none}
.ce-hunk-revert-on{color:var(--dsw-alias-state-error-primary,#f85149);font-weight:700}
.ce-sbsnum{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:19px;color:var(--dsw-alias-label-tertiary,#667);text-align:right;padding:1px 6px 1px 0;user-select:none;background:rgba(128,128,128,.05);overflow:hidden}
.ce-sbscell{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:19px;white-space:pre-wrap;overflow-wrap:break-word;padding:1px 10px 1px 4px;min-width:0}
.ce-sbs-del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 12%,transparent)}
.ce-sbs-add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 12%,transparent)}
.ce-sbs-empty{background:rgba(128,128,128,.05)}
.ce-wd{border-radius:2px}
.ce-wd-del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 45%,transparent)}
.ce-wd-add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 45%,transparent)}
.ce-wd-zero{display:inline-block;width:0;overflow:hidden;vertical-align:baseline}
.ce-wd-zero.ce-wd-add{border-left:2px solid var(--dsw-alias-state-success-primary,#3fb950)}
.ce-wd-zero.ce-wd-del{border-left:2px solid var(--dsw-alias-state-error-primary,#f85149)}
.ce-dnav{outline:1.5px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:-1.5px}
.ce-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#7a8490);padding:24px;text-align:center}
.ce-statusbar{flex:none;display:flex;gap:8px;align-items:center;padding:3px 10px;border-top:.5px solid var(--dsw-alias-border-l1,#333);font-size:11px;color:var(--dsw-alias-label-tertiary,#889);min-height:22px}
.ce-title-ico{display:inline-flex;margin-right:2px}
.ce-peek{position:absolute;left:12px;width:min(720px,calc(100% - 24px));z-index:6;background:var(--dsw-alias-bg-layer-1,#1d2126);border:.5px solid var(--dsw-alias-border-l2,#454a52);border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.18);display:flex;flex-direction:column;max-height:390px;overflow:hidden}
.ce-peek-head{display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none;background:var(--dsw-alias-bg-layer-1,#1d2126)}
.ce-peek-sym{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:13px;color:var(--dsw-alias-label-primary,#eee);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42%}
.ce-peek-meta{font-size:11px;color:var(--dsw-alias-label-secondary,#999);flex:none;padding:2px 7px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,#252a31)}
.ce-peek-hint{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#778);flex:none;margin-right:4px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-peek-body{min-height:0;padding:4px 0 8px}
.ce-peek-file{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:7px;padding:6px 12px;background:var(--dsw-alias-bg-layer-2,#23272c);border-top:.5px solid var(--dsw-alias-border-l1,#333);border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-peek-file-icon{width:15px;flex:none;text-align:center;color:var(--dsw-alias-label-tertiary,#889);font-size:12px}
.ce-peek-fpath{direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary,#c3cbd5)}
.ce-peek-file-count{flex:none;min-width:20px;text-align:center;padding:1px 6px;border-radius:9px;background:var(--dsw-alias-bg-layer-1,#1d2126);color:var(--dsw-alias-label-tertiary,#889);font-size:10px;font-variant-numeric:tabular-nums}
.ce-peek-row{display:grid;grid-template-columns:16px 58px minmax(0,1fr);gap:8px;align-items:baseline;width:100%;text-align:left;border:0;border-left:3px solid transparent;background:transparent;color:inherit;font:inherit;padding:5px 12px 5px 11px;cursor:pointer;white-space:nowrap}
.ce-peek-row:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-peek-row-sel{background:var(--dsw-alias-interactive-bg-hover,#2b3038);border-left-color:var(--dsw-alias-brand-primary,#59b7ff);box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 24%,transparent)}
.ce-peek-def{border-left-color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-peek-kind{width:16px;text-align:center;color:var(--dsw-alias-label-tertiary,#778);font-size:10px}
.ce-peek-def .ce-peek-kind{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-peek-lno{min-width:0;text-align:right;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;flex:none;user-select:none}
.ce-peek-def .ce-peek-lno{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-peek-snippet{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-primary,#d5dbe3);overflow:hidden;text-overflow:ellipsis;white-space:pre;min-width:0}
.ce-mark{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 34%,transparent);border-radius:3px;box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent);text-decoration:none}
.ce-banner{flex:none;display:flex;align-items:center;gap:8px;margin:6px 10px 0;padding:6px 8px 6px 10px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 14%,transparent);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 40%,transparent);color:var(--dsw-alias-label-primary,#eee);font-size:12px}
.ce-banner-warn{background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#58a6ff) 14%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-button-info-fill,#58a6ff) 45%,transparent)}
.ce-banner-text{min-width:0;flex:1;white-space:pre-wrap;word-break:break-word}
.ce-tool-danger{color:var(--dsw-alias-state-error-primary,#f85149);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 45%,transparent)}
.ce-conflict-diff{flex:none;display:flex;flex-direction:column;max-height:46%;margin:6px 10px 0;border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:8px;overflow:auto;background:var(--dsw-alias-bg-layer-1,#1d2126)}
.ce-conflict-head{flex:none;display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-2,#232729);position:sticky;top:0;z-index:2}
.ce-conflict-title{flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#eee);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-conflict-meta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-splitter{flex:none;width:5px;cursor:col-resize;background:transparent;border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-splitter:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent)}
.ce-rail-tab{flex:none;width:16px;border:0;border-right:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#1d2126);color:var(--dsw-alias-label-tertiary,#889);cursor:pointer;font-size:10px;padding:0}
.ce-rail-tab:hover{color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-crumb{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#9ab);font:inherit;font-size:12px;cursor:pointer;padding:1px 6px;border-radius:5px;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.ce-crumb:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30);color:var(--dsw-alias-label-primary,#eee)}
.ce-note-line{display:flex;align-items:center;justify-content:space-between;gap:6px}
.ce-link{border:0;background:transparent;color:var(--dsw-alias-brand-primary,#6cb2ff);font:inherit;font-size:11px;cursor:pointer;padding:0 2px;flex:none}
.ce-link:hover{text-decoration:underline}
.ce-commit{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:3px 10px 3px 14px;cursor:pointer;border-radius:4px;white-space:nowrap}
.ce-commit-row{display:flex;align-items:center;gap:4px}.ce-commit-row .ce-commit{flex:1;min-width:0}.ce-commit-row .ce-tool{opacity:0;flex:none}
.ce-commit-row:hover .ce-tool,.ce-commit-row:focus-within .ce-tool{opacity:1}
.ce-conflict-row{display:flex;align-items:center;gap:6px}.ce-conflict-row .ce-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ce-conflict-row .ce-tiny{flex:none}
.ce-danger{color:var(--dsw-alias-state-error-primary,#f85149)}
.ce-compare{border-left:2px solid color-mix(in srgb,var(--dsw-alias-button-info-fill,#58a6ff) 55%,transparent)}
.ce-compare-box{width:min(560px,92vw)}.ce-compare-fields{display:flex;gap:6px;align-items:center;padding:8px 10px;flex-wrap:wrap}.ce-compare-fields .ce-input{flex:1;min-width:120px}
.ce-task-panel{display:flex;flex-direction:column;max-height:min(72vh,640px)}
.ce-task-body{flex:1;min-height:120px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.5;padding:6px 10px;background:var(--dsw-alias-bg-base,#0d1117)}
.ce-task-line{white-space:pre-wrap;word-break:break-word}
.cea-save-coll{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#9aa4af)}
.cea-stream{display:flex;flex-direction:column;gap:2px;padding:4px 0}.cea-sse-row{display:flex;gap:8px;align-items:baseline;white-space:pre-wrap;word-break:break-word;font-size:11.5px}.cea-sse-kind{flex:none;color:var(--dsw-alias-button-info-fill,#58a6ff);font-weight:600}.cea-sse-id,.cea-sse-retry{flex:none;color:var(--dsw-alias-label-tertiary,#8b949e);font-size:10.5px}.cea-sse-data{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.cea-sse-stop{flex:none;margin-right:6px}
.ce-task-jump{border:0;background:none;color:var(--dsw-alias-button-info-fill,#58a6ff);font:inherit;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.ce-commit:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-chash{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#778);flex:none}
.ce-histrow{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px;cursor:pointer;white-space:nowrap}
.ce-histrow:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-histrow .ce-csubject{flex:1}
.ce-histmeta{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#778)}
.ce-histpath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-left:8px}
.ce-csubject{color:var(--dsw-alias-label-secondary,#9ab);overflow:hidden;text-overflow:ellipsis;min-width:0}
.ce-symglyph{width:16px;flex:none;text-align:center;color:var(--dsw-alias-label-tertiary,#889);font-size:12px}
.ce-prog{font-size:11px;color:var(--dsw-alias-label-tertiary,#889);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:50%}
.ce-palette{position:absolute;top:40px;left:50%;transform:translateX(-50%);width:min(560px,calc(100% - 32px));z-index:8;display:flex;flex-direction:column;max-height:70%;background:var(--dsw-alias-bg-layer-2,#24272c);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:var(--dsw-radius-md,8px);box-shadow:0 14px 44px rgba(0,0,0,.45);overflow:hidden}
.ce-bp .ce-palette-head{background:var(--dsw-alias-bg-layer-1,#1e2126);border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-bp .ce-palette-list{background:var(--dsw-alias-bg-layer-2,#24272c)}
.ce-bp .ce-section{background:transparent;color:var(--dsw-alias-label-tertiary,#889)}
.ce-bp .ce-qitem{background:transparent}
.ce-bp .ce-qitem-sel{background:var(--dsw-alias-interactive-bg-hover,#2b3038)}
.ce-bp-act{flex:none;border:.5px solid var(--dsw-alias-border-l2,#444);background:transparent;color:var(--dsw-alias-label-secondary,#999);border-radius:6px;font:inherit;font-size:11px;padding:3px 9px;cursor:pointer}
.ce-bp-act:hover{color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-bp-act:disabled{opacity:.45;cursor:default}
.ce-bp-push{color:var(--dsw-alias-brand-primary,#6cb2ff);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent)}
.ce-palette-head{display:flex;align-items:center;gap:6px;padding:8px}
.ce-input{flex:1;min-width:0;background:var(--dsw-alias-bg-layer-1,#1e2126);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:6px;color:var(--dsw-alias-label-primary,#ddd);padding:6px 9px;font:inherit;outline:none}
.ce-input:focus{border-color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-palette-list{border-top:.5px solid var(--dsw-alias-border-l1,#333);padding:4px 0}
.ce-qitem{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:5px 12px;cursor:pointer}
.ce-qitem-sel{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-qbase{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62%;flex:none}
.ce-qdir{font-size:11px;color:var(--dsw-alias-label-tertiary,#778);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ce-search{position:absolute;inset:0;z-index:7;background:var(--dsw-alias-bg-base,#181818);display:flex;flex-direction:column;padding:10px;gap:8px}
.ce-search-box{display:flex;gap:6px;align-items:center;flex:none}
.ce-search-include{flex:none}
.ce-repo{width:calc(100% - 16px);margin:4px 8px 2px;font-size:11px;padding:4px 6px;flex:none;align-self:flex-start}
.ce-changes{overflow-x:hidden}
.ce-changes>.ce-note{padding:8px 12px 4px;overflow-wrap:anywhere}
.ce-change-group{min-width:0;padding:8px 0 12px;border-top:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-changes .ce-section{justify-content:flex-start;flex-wrap:wrap;gap:8px;padding:8px 12px;text-transform:none;letter-spacing:normal;color:var(--dsw-alias-label-primary,#ddd)}
.ce-changes .ce-section>span:first-child{flex:1;min-width:0}
.ce-changes .ce-section>.ce-link,.ce-changes .ce-section>.ce-tool{flex:none}
.ce-changes .ce-note{padding-left:12px;padding-right:12px;line-height:1.5}
.ce-changes .ce-note-line{align-items:flex-start;flex-wrap:wrap;gap:4px 8px}
.ce-changes .ce-note-line>span{flex:1 1 160px;min-width:0;overflow-wrap:anywhere}
.ce-changes .ce-note-line>.ce-link{flex:none}
.ce-changes-search{display:flex;gap:6px;align-items:center;padding:4px 12px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-changes-search .ce-input{flex:1;min-width:0;font-size:12px;padding:6px 8px}
.ce-changes-search .ce-sk-btn{flex:none;font-size:11px;white-space:nowrap}
.ce-commitbox{display:flex;flex-direction:column;gap:8px;align-items:stretch;padding:8px 12px 12px;min-width:0;flex:none}
.ce-commitbox-msg{flex:none;width:100%;box-sizing:border-box;min-width:0;font-size:12px;padding:7px 8px}
.ce-commitbox-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;min-width:0}
.ce-commitbox-amend{display:inline-flex;align-items:center;justify-content:center;flex:none;min-height:28px;border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#999);font:inherit;font-size:11px;padding:4px 8px;cursor:pointer}
.ce-commitbox-amend:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-commitbox-amend:disabled{opacity:.45;cursor:default}
.ce-commitbox-amend:focus-visible,.ce-commitbox-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:2px}
.ce-commitbox-btn{flex:0 1 auto;max-width:100%;min-height:28px;border:0;border-radius:6px;background:var(--dsw-alias-button-primary-fill,#2563eb);color:var(--dsw-alias-label-primary-foreground,#fff);font:inherit;font-size:11px;font-weight:600;padding:5px 10px;cursor:pointer;white-space:normal;overflow-wrap:anywhere;text-align:center}
.ce-commitbox-btn:hover:not(:disabled){filter:brightness(1.05)}
.ce-changes .ce-commitbox-btn:disabled{opacity:1;cursor:not-allowed;filter:none;background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-secondary,#b7c0cc);border:1px solid var(--dsw-alias-border-l2,#444)}
.ce-stash-save{display:flex;gap:5px;align-items:center;padding:4px 8px;flex-wrap:wrap}
.ce-stash-save .ce-input{flex:1;min-width:90px;font-size:11px;padding:4px 6px}
.ce-stash-u{display:flex;gap:3px;align-items:center;font-size:10px;color:var(--dsw-alias-label-tertiary,#889);flex:none;cursor:pointer;user-select:none}
.ce-stashrow{display:flex;gap:6px;align-items:center;padding:3px 8px;width:100%}
.ce-stashrow:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-stashref{flex:none;font-size:10px;font-weight:700;color:var(--dsw-alias-brand-primary,#6cb2ff);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-stashmsg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-secondary,#bcc)}
.ce-stashacts{flex:none;display:flex;gap:2px;align-items:center}
.ce-search-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#778);flex:none;min-height:14px}
.ce-search-results{flex:1;min-height:0;border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#1e2126)}
.ce-srow{display:flex;align-items:stretch;width:100%}
.ce-sgroup-row{display:flex;align-items:center;gap:2px;width:100%;position:sticky;top:0;z-index:1;background:var(--dsw-alias-bg-layer-1,#1e2126);border-bottom:.5px solid var(--dsw-alias-border-l1,#2a2a2a)}
.ce-sgroup{display:flex;gap:5px;align-items:center;flex:1;min-width:0;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 4px 3px 8px;cursor:pointer}
.ce-sgroup:hover .ce-sgroup-path{color:var(--dsw-alias-label-primary,#eee)}
.ce-sgroup-rep{flex:none;margin-right:6px}
.ce-sgroup-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary,#bcc);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-sgroup-count{flex:none;font-size:10px;color:var(--dsw-alias-label-secondary,#999);background:var(--dsw-alias-bg-layer-2,#2a2d33);border-radius:8px;padding:0 7px;line-height:16px}
.ce-shl{color:var(--dsw-alias-label-primary,#fff);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e3b341) 32%,transparent);border-radius:2px;font-weight:600}
.ce-sctx-toggle{flex:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#778);cursor:pointer;padding:4px 1px 4px 7px;font:inherit;font-size:10px;line-height:1}
.ce-sctx-toggle:hover{color:var(--dsw-alias-label-primary,#ddd)}
.ce-sresult{display:flex;gap:10px;align-items:baseline;flex:1;min-width:0;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:4px 10px 4px 5px;cursor:pointer;white-space:nowrap}
.ce-sresult:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-sctx{border-left:2px solid var(--dsw-alias-border-l2,#444);margin:0 6px 3px 15px;background:var(--dsw-alias-bg-layer-2,#1c1f24);border-radius:0 6px 6px 0;overflow:hidden}
.ce-sctx-line{display:flex;gap:8px;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:1px 8px;cursor:pointer;white-space:nowrap}
.ce-sctx-line:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-sctx-no{flex:none;min-width:30px;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--dsw-alias-label-tertiary,#667)}
.ce-sctx-text{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#999);overflow:hidden;text-overflow:ellipsis}
.ce-sctx-hit{background:rgba(47,129,247,.10)}
.ce-sctx-hit .ce-sctx-text{color:var(--dsw-alias-label-primary,#ddd)}
.ce-sctx-note{padding:3px 10px 5px 24px;font-size:11px;color:var(--dsw-alias-label-tertiary,#778)}
.ce-sloc{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-brand-primary,#6cb2ff);flex:none}
.ce-stext{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-secondary,#999);overflow:hidden;text-overflow:ellipsis}
.ce-calrow{display:flex;align-items:center;gap:8px;width:100%;border:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#1e2126);color:inherit;font:inherit;text-align:left;padding:4px 10px;cursor:pointer;border-radius:8px;margin:2px 0}
.ce-calrow:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-calrow:disabled{cursor:default;opacity:.7}
.ce-calrow-fail{opacity:.65}
.ce-calrow-run{cursor:default;border-style:dashed}
.ce-cal-label{flex:none;font-weight:600;font-size:12px;color:var(--dsw-alias-label-secondary,#9ab)}
.ce-cal-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-primary,#ddd)}
.ce-cal-stats{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.ce-cal-hint{flex:none;font-size:11px;color:var(--dsw-alias-brand-primary,#6cb2ff);opacity:0;transition:opacity .12s}
.ce-calrow:hover .ce-cal-hint{opacity:1}
.ce-cal-hint-on{opacity:1;color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-root{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;container-type:inline-size;overflow:hidden}
.ce-sk-top{display:flex;gap:8px;align-items:center;flex:none;padding:12px 16px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-sk-heading{display:flex;align-items:baseline;gap:8px;flex:1;min-width:0;flex-wrap:wrap}
.ce-sk-heading h2{font-size:14px;font-weight:600;margin:0;color:var(--dsw-alias-label-primary,#ddd)}
.ce-sk-total{font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-workspace{display:grid;grid-template-columns:clamp(210px,30%,280px) minmax(0,1fr);flex:1;min-height:0;min-width:0}
.ce-sk-list{min-width:0;min-height:0;border-right:.5px solid var(--dsw-alias-border-l1,#333);display:flex;flex-direction:column;overflow:hidden}
.ce-sk-searchbar{display:flex;flex-direction:column;gap:8px;padding:12px;flex:none;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-sk-searchbar .ce-input{width:100%;box-sizing:border-box;flex:none;font-size:12px;min-height:32px}
.ce-sk-scope{min-width:0;border:.5px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-1,#1e2126);color:var(--dsw-alias-label-secondary,#999);border-radius:6px;font:inherit;font-size:11px;padding:6px 8px;min-height:30px}
.ce-sk-results{flex:1;min-height:0;overflow:auto;padding-bottom:12px}
.ce-sk-section{display:flex;justify-content:space-between;gap:8px;margin:0;padding:16px 16px 8px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-section>span:last-child{font-weight:400;font-variant-numeric:tabular-nums}
.ce-sk-row{display:flex;flex-direction:column;gap:4px;width:calc(100% - 12px);margin:0 6px 4px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;padding:10px;cursor:pointer}
.ce-sk-row:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-sk-row-on{background:var(--dsw-alias-interactive-bg-hover,#2c313a)}
.ce-sk-row-on .ce-sk-row-name{color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-sk-row-name{max-width:100%;font-size:12px;line-height:1.4;font-weight:600;color:var(--dsw-alias-label-primary,#ddd);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-sk-row-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary,#999);overflow-wrap:anywhere}
.ce-sk-row:disabled{cursor:default;opacity:.65}
.ce-sk-edit{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.ce-sk-detail-head{flex:none;max-height:42%;overflow:auto;padding:20px 20px 12px}
.ce-sk-detail-title{margin:0 0 8px;font-size:18px;line-height:1.4;font-weight:600;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary,#ddd)}
.ce-sk-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-detail-desc{margin:12px 0 8px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,#999);overflow-wrap:anywhere}
.ce-sk-detail-tools{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 16px;border-top:.5px solid var(--dsw-alias-border-l1,#333);border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-sk-view-switch{display:flex;align-items:center;gap:2px;margin-right:auto}
.ce-sk-edit-label{margin-right:auto;font-size:12px;color:var(--dsw-alias-label-secondary,#999)}
.ce-sk-root .ce-sk-view-on{background:var(--dsw-alias-interactive-bg-hover,#2c313a);color:var(--dsw-alias-label-primary,#ddd)}
.ce-sk-root .ce-sk-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#2f81f7));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}
.ce-sk-root .ce-sk-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#2f81f7)));filter:none}
.ce-sk-root .ce-sk-btn{min-height:28px;white-space:normal}
.ce-sk-name-hint{flex-basis:100%;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary,#999)}
.ce-sk-edit .ce-md-pre,.ce-sk-edit .ce-md-code{background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-primary,#ddd)}
.ce-sk-back{display:none;margin-bottom:12px}
.ce-sk-create{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none;align-items:center}
.ce-sk-name-input{flex:1 1 180px;min-width:0;font-size:12px}
.ce-sk-welcome{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:12px;flex:1;padding:32px;max-width:440px;align-self:center;color:var(--dsw-alias-label-secondary,#999)}
.ce-sk-welcome>svg{width:28px;height:28px;color:var(--dsw-alias-label-tertiary,#889);margin-bottom:4px}
.ce-sk-welcome h3{margin:0;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary,#ddd)}
.ce-sk-welcome p{margin:0;font-size:12px;line-height:1.7}
.ce-sk-welcome-note{color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-feedback{padding:20px 16px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,#999);overflow-wrap:anywhere;display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
.ce-sk-delete-confirm{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:12px 16px;background:var(--dsw-alias-bg-layer-1,#1e2126);border-bottom:.5px solid var(--dsw-alias-border-l1,#333);font-size:12px}
.ce-sk-delete-confirm>span{flex:1 1 180px;overflow-wrap:anywhere}
.ce-sk-ta,.ce-sk-source{flex:1;min-height:0;resize:none;border:0;outline:none;margin:0;background:transparent;color:var(--dsw-alias-label-primary,#ddd);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;padding:16px 20px;white-space:pre;overflow:auto}
.ce-sk-root button:focus-visible,.ce-sk-root select:focus-visible,.ce-sk-root textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:-2px}
@container (max-width:620px){.ce-sk-workspace{grid-template-columns:minmax(0,1fr)}.ce-sk-list{border-right:0}.ce-sk-edit{display:none}.ce-sk-has-selection .ce-sk-list{display:none}.ce-sk-has-selection .ce-sk-edit{display:flex}.ce-sk-back{display:inline-flex}.ce-sk-searchbar{flex-direction:row;flex-wrap:wrap}.ce-sk-searchbar .ce-input{flex:1 1 160px;width:auto;min-width:0}.ce-sk-searchbar .ce-sk-scope{flex:1 1 100px}.ce-sk-top{padding:12px}.ce-sk-detail-head{padding:16px}.ce-sk-detail-title{font-size:16px}.ce-sk-name-input{flex-basis:100%}}
.ce-sk-btn{border:.5px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-primary,#ddd);border-radius:6px;font:inherit;font-size:11px;padding:3px 10px;cursor:pointer;flex:none}
.ce-sk-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-sk-btn:disabled{opacity:.45;cursor:default}
.ce-sk-btn-danger{color:var(--dsw-alias-state-error-primary,#f85149);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 45%,transparent)}
.ce-sk-btn-ghost{background:transparent;color:var(--dsw-alias-label-secondary,#999)}
.ce-sk-path{display:block;width:100%;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#777);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;padding:4px 0;cursor:pointer;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.ce-sk-path:hover{color:var(--dsw-alias-brand-primary,#6cb2ff);text-decoration:underline}
.ce-imgwrap{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px;overflow:auto}
.ce-img{max-width:100%;object-fit:contain;border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:6px;background:repeating-conic-gradient(#2b2b2b 0% 25%, #232323 0% 50%) 0 0/16px 16px}
.ce-imgmeta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,#778);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-md{flex:1;min-height:0;overflow:auto;padding:14px 18px;font-size:13px;line-height:1.7;color:var(--dsw-alias-label-primary,#ddd)}
.ce-md-h{font-weight:700;color:var(--dsw-alias-label-primary,#eee);margin:14px 0 6px}
.ce-md-h1{font-size:19px}
.ce-md-h2{font-size:16px}
.ce-md-h3{font-size:14px}
.ce-md-h4,.ce-md-h5,.ce-md-h6{font-size:13px}
.ce-md-p{margin:6px 0}
.ce-md-pre{background:var(--dsw-alias-markdown-code-block,#20242a);border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:8px;padding:8px 10px;overflow:auto;margin:8px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;white-space:pre}
.ce-md-code{background:var(--dsw-alias-markdown-code-block,#20242a);border-radius:4px;padding:1px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.ce-md-list{margin:6px 0;padding-left:22px}
.ce-md-list li{margin:2px 0}
.ce-md-quote{border-left:3px solid var(--dsw-alias-border-l2,#444);padding:2px 10px;margin:8px 0;color:var(--dsw-alias-label-secondary,#999)}
.ce-md-hr{border:0;border-top:.5px solid var(--dsw-alias-border-l1,#333);margin:12px 0}
.ce-md-table{border-collapse:collapse;margin:8px 0;font-size:12.5px}
.ce-md-table th,.ce-md-table td{border:.5px solid var(--dsw-alias-border-l1,#333);padding:4px 10px;text-align:left}
.ce-md-table th{background:var(--dsw-alias-bg-layer-2,#24272c);font-weight:600}
.ce-md-a{color:var(--dsw-alias-brand-primary,#6cb2ff);text-decoration:none}
.ce-md-a:hover{text-decoration:underline}
.cel-root{padding:14px 12px 20px;display:flex;flex-direction:column;gap:2px;height:100%;box-sizing:border-box}
.cel-section{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#889);padding:12px 4px 6px}
.cel-row{display:flex;align-items:center;gap:10px;width:100%;border:.5px solid transparent;background:transparent;color:inherit;font:inherit;text-align:left;padding:8px 10px;border-radius:10px;cursor:pointer}
.cel-row:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e);border-color:var(--dsw-alias-border-l1,#333)}
.cel-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:-2px}
.cel-ico{flex:none;width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 12%,transparent);color:var(--dsw-alias-brand-primary,#59b7ff)}
.cel-ico svg{width:16px;height:16px}
.cel-ico-skills{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e3b341) 14%,transparent);color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cel-ico-run{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 12%,transparent);color:var(--dsw-alias-state-success-primary,#3fb950)}
.cel-ico-more{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-secondary,#999)}
.cel-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.cel-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#ddd);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cel-desc{font-size:11.5px;line-height:1.45;color:var(--dsw-alias-label-tertiary,#777);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cel-kbd{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#999);background:var(--dsw-alias-bg-layer-2,#24272c);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:5px;padding:2px 6px}
.ce-chip-warn{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-sk-confirm{display:inline-flex;gap:8px;align-items:center}
.ce-link-danger{color:var(--dsw-alias-state-error-primary,#f85149)}
.ce-find{display:flex;gap:6px;align-items:center;padding:4px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.ce-find-input{flex:0 1 240px}
.ce-find-count{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#889);flex:none}
.ce-find-replace{border-top:0;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#1e2126) 55%,transparent)}
.ce-find-replace .ce-sk-btn{flex:none;font-size:11px;padding:3px 9px}
.ce-diag-btn{border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 45%,transparent);background:transparent;border-radius:6px;font:inherit;cursor:pointer;padding:1px 7px}
.ce-diag-btn:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 12%,transparent)}
.ce-problem-sev{flex:none;width:16px;text-align:center;font-weight:700;color:var(--dsw-alias-label-tertiary,#889)}
.ce-problem-err{color:var(--dsw-alias-state-error-primary,#f85149)}
.ce-problem-warn{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cet-context>button:disabled{opacity:.45;cursor:default}
.cet-context>button:disabled:hover{background:transparent}
.ce-tabmenu{min-width:170px}
.ce-tab-pin{flex:none;font-size:8px;line-height:1;color:var(--dsw-alias-brand-primary,#59b7ff);transform:translateY(-1px)}
.ce-mark-cur{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e3b341) 55%,transparent);border-radius:2px;box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e3b341) 70%,transparent)}
.ce-gline-find-cur{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e3b341) 30%,transparent);color:var(--dsw-alias-label-primary,#ddd);font-weight:700}
.ce-problem-filter{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px}
.ce-problem-off{opacity:.45;text-decoration:line-through}
.cea-request-panel .cea-fields+.cea-fields{margin-top:10px;border-top:.5px solid var(--dsw-alias-border-l1,#333);padding-top:6px}
.ce-edit-ta{flex:1;min-height:0;resize:none;border:0;outline:none;background:var(--dsw-alias-bg-base,#181818);color:var(--dsw-alias-label-primary,#ddd);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:${ROW}px;padding:8px 10px;white-space:pre;overflow:auto;tab-size:4}
.ce-edit-wrap{flex:1;min-height:0;display:flex;position:relative;overflow:hidden}
.ce-edit-gutter{flex:none;width:48px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#1d2126);border-right:.5px solid var(--dsw-alias-border-l1,#333);position:relative}
.ce-edit-gutter .ce-gutter-row{position:absolute;left:0;right:0;height:${ROW}px;line-height:${ROW}px;text-align:right;padding-right:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-tertiary,#777);user-select:none}
.ce-edit-find{position:absolute;top:4px;right:8px;z-index:5;display:flex;align-items:center;gap:4px;padding:4px 6px;background:var(--dsw-alias-bg-layer-1,#1d2126);border:.5px solid var(--dsw-alias-border-l2,#454a52);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.3)}
.ce-edit-find-input{width:160px;height:24px;padding:0 6px;font-size:12px;background:var(--dsw-alias-bg-base,#181818);color:var(--dsw-alias-label-primary,#eee);border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:4px;outline:none}
.ce-edit-find-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-width:40px;text-align:center}

/* Database workbench */
.cedb-root{display:flex;flex-direction:column;height:100%;overflow:hidden;position:relative}
.cedb-toolbar{flex:none;display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#1d2126)}
.cedb-chip{font-size:11px;padding:1px 7px;border-radius:9px;background:var(--dsw-alias-bg-layer-2,#2a2e35);color:var(--dsw-alias-label-tertiary,#99a);white-space:nowrap}
.cedb-chip-warn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e3b341) 22%,transparent);color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cedb-notice{font-size:11px;color:var(--dsw-alias-state-error-primary,#f85149);max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-body{flex:1;min-height:0;display:flex;overflow:hidden}
.cedb-rail{flex:none;width:240px;min-width:160px;display:flex;flex-direction:column;border-right:.5px solid var(--dsw-alias-border-l1,#333);overflow-y:auto;overflow-x:hidden;background:var(--dsw-alias-bg-layer-1,#181b1f)}
.cedb-rail-head{flex:none;padding:6px 10px 4px;font-size:11px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#778);position:sticky;top:0;background:var(--dsw-alias-bg-layer-1,#181b1f);z-index:2}
.cedb-rail-head-split{display:flex;flex-direction:column;gap:4px;padding-bottom:6px}
.cedb-rail-title{display:block}
.cedb-filter{height:24px;font-size:12px;width:100%}
.cedb-empty{padding:6px 12px 10px;font-size:12px;color:var(--dsw-alias-label-tertiary,#667);line-height:1.5}
.cedb-conn{display:flex;align-items:center;gap:2px;padding:2px 6px 2px 10px;border-left:2px solid transparent}
.cedb-conn-on{border-left-color:var(--dsw-alias-button-info-fill,#58a6ff);background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#58a6ff) 10%,transparent)}
.cedb-conn-main{flex:1;min-width:0;display:flex;align-items:center;gap:6px;padding:3px 2px;border:0;background:transparent;color:var(--dsw-alias-label-primary,#dde);font-size:12px;text-align:left;cursor:pointer}
.cedb-conn-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-driver{flex:none;font-size:9px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;padding:1px 4px;border-radius:3px;background:var(--dsw-alias-bg-layer-2,#2a2e35);color:var(--dsw-alias-label-tertiary,#889)}
.cedb-driver-sqlite{color:#4ea1ff}.cedb-driver-mysql{color:#e8a13a}.cedb-driver-postgres{color:#6fb3ff}
.cedb-rail-head-sub{padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l1,#2a2e35);margin-top:4px}
.cedb-saved .cedb-driver{opacity:.75}
.cedb-conn-bad{color:var(--dsw-alias-label-error,#f88);font-size:10px;flex:0 0 auto}
.cedb-saved-pick{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:2px 0 4px}
.cedb-saved-pick-title{font-size:11px;color:var(--dsw-alias-label-tertiary,#889);width:100%}
.cedb-saved-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border:.5px solid var(--dsw-alias-border-l1,#39414a);border-radius:999px;background:var(--dsw-alias-bg-layer-1,#1d2126);color:var(--dsw-alias-label-primary,#dde);font-size:11px;cursor:pointer;max-width:100%}
.cedb-saved-chip:hover{border-color:var(--dsw-alias-button-info-fill,#58a6ff)}
.cedb-saved-chip .cedb-driver{font-size:9px}
.cedb-dialog-test{font-size:11px;padding:4px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-1,#1d2126)}
.cedb-dialog-test-ok{color:var(--dsw-alias-label-primary,#dde)}
.cedb-dialog-test-bad{color:var(--dsw-alias-label-error,#f88)}
.cedb-redetect{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary,#99a);background:none;border:0;cursor:pointer;text-decoration:underline}
.cedb-bin{font-size:11px;color:var(--dsw-alias-label-secondary,#99a);word-break:break-all;margin-top:2px}
.cedb-remember{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-secondary,#99a);cursor:pointer;margin-top:2px}
.cedb-db,.cedb-table{padding:0}
.cedb-db-name{padding:8px 10px 2px;font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary,#aab);display:flex;align-items:center;gap:6px}
.cedb-db-hint{font-weight:400;font-size:10px;color:var(--dsw-alias-label-tertiary,#667)}
.cedb-table-row{display:flex;align-items:center;gap:6px;width:100%;padding:3px 10px 3px 14px;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#ccd);font-size:12px;text-align:left;cursor:pointer}
.cedb-table-row:hover{background:var(--dsw-alias-interactive-bg-hover,#2a2e35)}
.cedb-table-on{background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#58a6ff) 16%,transparent);color:var(--dsw-alias-label-primary,#fff)}
.cedb-kind{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#889)}
.cedb-table-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cedb-cols{margin:0;padding:0 0 4px 30px;list-style:none}
.cedb-col{display:flex;align-items:center;gap:6px;padding:1px 0;font-size:11px;color:var(--dsw-alias-label-tertiary,#99a);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cedb-col-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#bcc)}
.cedb-col-type{flex:none;font-size:10px;opacity:.75;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-pk,.cedb-nn{flex:none;font-size:9px;font-weight:700;padding:0 3px;border-radius:2px}
.cedb-pk{color:#e3b341;background:color-mix(in srgb,#e3b341 18%,transparent)}
.cedb-nn{color:#8b949e;background:color-mix(in srgb,#8b949e 16%,transparent)}
.cedb-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.cedb-tabs{flex:none;display:flex;align-items:stretch;gap:1px;padding:0 6px;overflow-x:auto;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#181b1f);scrollbar-width:thin}
.cedb-tab{display:flex;align-items:center;gap:2px;border-bottom:2px solid transparent;max-width:200px}
.cedb-tab-on{border-bottom-color:var(--dsw-alias-button-info-fill,#58a6ff);background:var(--dsw-alias-bg-base,#141618)}
.cedb-tab-label{display:flex;align-items:center;gap:5px;padding:7px 4px 6px 8px;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#aab);font-size:12px;cursor:pointer;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-tab-on .cedb-tab-label{color:var(--dsw-alias-label-primary,#eef)}
.cedb-tab-kind{font-size:10px;opacity:.7}
.cedb-tab-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#778);font-size:11px;cursor:pointer;padding:2px 4px;border-radius:3px}
.cedb-tab-close:hover{background:var(--dsw-alias-interactive-bg-hover,#2a2e35);color:var(--dsw-alias-label-primary,#fff)}
.cedb-tab-add{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#889);font-size:14px;cursor:pointer;padding:0 8px}
.cedb-tabbody{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.cedb-editor{flex:none;display:flex;flex-direction:column;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.cedb-editor-bar{display:flex;align-items:center;gap:6px;padding:6px 10px 4px}
.cedb-conn-select{height:26px;font-size:12px;max-width:240px;background:var(--dsw-alias-bg-layer-2,#22262c);color:var(--dsw-alias-label-primary,#dde);border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:5px;padding:0 6px}
.cedb-run{flex:none}
.cedb-kbd{font-size:10px;color:var(--dsw-alias-label-tertiary,#667);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cedb-sql{min-height:88px;max-height:34vh;resize:vertical;margin:0 10px 8px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:6px;background:var(--dsw-alias-bg-base,#141618);color:var(--dsw-alias-label-primary,#dde);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.5;outline:none;tab-size:2}
.cedb-sql:focus{border-color:var(--dsw-alias-button-info-fill,#58a6ff)}
.cedb-result-head{flex:none;display:flex;align-items:center;gap:6px;padding:4px 10px;font-size:11px;color:var(--dsw-alias-label-tertiary,#889);min-height:24px}
.cedb-result-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#667)}
.cedb-tablebar{flex:none;display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.cedb-tablebar-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#dde);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cedb-tablebar-filter{max-width:220px;height:26px;font-size:12px}
.cedb-grid-wrap{flex:1;min-height:0;overflow:auto;padding:0 10px 10px}
.cedb-grid{width:100%;border-collapse:collapse;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cedb-grid th{position:sticky;top:0;z-index:1;text-align:left;padding:5px 8px;background:var(--dsw-alias-bg-layer-1,#1d2126);border-bottom:1px solid var(--dsw-alias-border-l1,#39414a);color:var(--dsw-alias-label-secondary,#aab);font-weight:600;white-space:nowrap}
.cedb-grid-sortable{cursor:pointer}
.cedb-grid-sortable:hover{color:var(--dsw-alias-label-primary,#fff)}
.cedb-grid-sorted{color:var(--dsw-alias-button-info-fill,#58a6ff)}
.cedb-grid-gutter{color:var(--dsw-alias-label-tertiary,#667);text-align:right;padding-right:8px !important;user-select:none;white-space:nowrap;background:var(--dsw-alias-bg-layer-1,#1d2126)}
/* The virtual window (GRID_ROW_H in db.js) assumes exactly this height, so the
   cell padding is stated with a specificity that wins over the generic cell rule. */
.cedb-grid .cedb-grid-row td{height:24px;line-height:23px;padding-top:0;padding-bottom:0}
.cedb-grid-td{padding:3px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#2a2e35);color:var(--dsw-alias-label-primary,#dde);max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.cedb-grid tr:hover td{background:var(--dsw-alias-interactive-bg-hover,#23272d)}
.cedb-null{color:var(--dsw-alias-label-tertiary,#667);font-style:italic}
.cedb-pager{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:4px 12px;border-top:.5px solid var(--dsw-alias-border-l1,#333);font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.cedb-pager-text{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cedb-placeholder{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;text-align:center}
.cedb-placeholder-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-secondary,#aab)}
.cedb-placeholder-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,#667);max-width:320px;line-height:1.6}
.cedb-placeholder-small{flex:1;display:flex;align-items:center;justify-content:center;padding:20px;font-size:12px;color:var(--dsw-alias-label-tertiary,#667)}
.cedb-error{margin:6px 10px;padding:6px 10px;border-radius:6px;font-size:12px;white-space:pre-wrap;color:var(--dsw-alias-state-error-primary,#f85149);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 12%,transparent)}
.cedb-pad{padding:6px 10px}
.cedb-dialog{position:absolute;top:52px;left:50%;transform:translateX(-50%);width:min(420px,calc(100% - 32px));z-index:20;display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:10px;background:var(--dsw-alias-bg-layer-1,#1d2126);border:.5px solid var(--dsw-alias-border-l2,#454a52);box-shadow:0 16px 48px rgba(0,0,0,.45)}
.cedb-dialog-title{margin:0;font-size:14px;color:var(--dsw-alias-label-primary,#eef)}
.cedb-field{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--dsw-alias-label-secondary,#99a)}
.cedb-field-row{display:flex;gap:8px}
.cedb-field-row .cedb-field{flex:1}
.cedb-field-narrow{flex:0 0 90px !important}
.cedb-dialog-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:4px}
.cedb-history{position:absolute;right:10px;top:44px;bottom:10px;width:min(380px,60%);z-index:15;display:flex;flex-direction:column;border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#1d2126);border:.5px solid var(--dsw-alias-border-l2,#454a52);box-shadow:0 12px 32px rgba(0,0,0,.4)}
.cedb-history-head{flex:none;display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#aab)}
.cedb-history-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border:0;border-bottom:.5px solid var(--dsw-alias-border-l1,#2a2e35);background:transparent;color:var(--dsw-alias-label-secondary,#ccd);font-size:11px;text-align:left;cursor:pointer;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cedb-history-row:hover{background:var(--dsw-alias-interactive-bg-hover,#2a2e35)}
.cedb-history-sql{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cedb-history-ms{flex:none;color:var(--dsw-alias-label-tertiary,#778)}
.cedb-cell-detail{position:absolute;right:20px;bottom:20px;width:min(520px,calc(100% - 40px));max-height:50%;z-index:20;display:flex;flex-direction:column;border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-overlay,#232729);border:.5px solid var(--dsw-alias-border-l2,#454a52);box-shadow:0 16px 40px rgba(0,0,0,.45)}
.cedb-cell-head{flex:none;display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);font-size:12px;color:var(--dsw-alias-label-secondary,#aab)}
.cedb-cell-title{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cedb-cell-body{flex:1;min-height:0;overflow:auto;margin:0;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-all;color:var(--dsw-alias-label-primary,#dde)}
/* RPC (gRPC) workbench */
.cerpc-root{display:flex;flex-direction:column;height:100%;overflow:hidden}
.cerpc-toolbar{flex:none;display:flex;align-items:flex-end;gap:8px;padding:8px 10px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#1d2126);flex-wrap:wrap}
.cerpc-field{flex:1 1 200px;min-width:140px;display:flex;flex-direction:column;gap:3px}
.cerpc-label{font-size:10px;letter-spacing:.3px;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#778)}
.cerpc-input{height:26px;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
/* Onboarding: one card instead of an empty rail + empty request + empty response. */
.cerpc-onboard{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:32px 24px;text-align:center;background:var(--dsw-alias-bg-base,#141618)}
.cerpc-onboard-icon{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:16px;background:var(--dsw-alias-bg-layer-1,#1d2126);border:.5px solid var(--dsw-alias-border-l1,#39414a);color:var(--dsw-alias-label-secondary,#aab)}
.cerpc-onboard-title{margin:2px 0 0;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,#eee)}
.cerpc-onboard-body{margin:0;max-width:440px;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-tertiary,#889)}
.cerpc-onboard-actions{display:flex;gap:8px;margin-top:6px}
.cerpc-onboard-recent{display:flex;flex-direction:column;gap:2px;margin-top:14px;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l1,#2a2e35);width:min(440px,100%)}
.cerpc-onboard-recent-title{font-size:11px;color:var(--dsw-alias-label-tertiary,#778);margin-bottom:4px;text-align:left}
.cerpc-onboard-recent-row{display:flex;align-items:baseline;width:100%;padding:4px 8px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary,#ccd);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;text-align:left;cursor:pointer;overflow:hidden}
.cerpc-onboard-recent-row:hover{background:var(--dsw-alias-interactive-bg-hover,#2a2e35)}
.cerpc-resp-empty{display:flex;align-items:center;gap:6px;padding:8px 10px;font-size:12px;color:var(--dsw-alias-label-tertiary,#889)}
.cerpc-resp-empty-icon{font-size:14px}
.cerpc-body{flex:1;min-height:0;display:flex;overflow:hidden}
.cerpc-rail{flex:none;width:230px;min-width:150px;display:flex;flex-direction:column;gap:2px;overflow-y:auto;border-right:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#181b1f);padding:6px 0}
.cerpc-service{padding:0 0 4px}
.cerpc-service-name{padding:6px 10px 2px;font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary,#aab);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cerpc-method{display:flex;align-items:center;gap:6px;width:100%;padding:3px 10px 3px 16px;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#ccd);font-size:12px;text-align:left;cursor:pointer}
.cerpc-method:hover{background:var(--dsw-alias-interactive-bg-hover,#2a2e35)}
.cerpc-method-on{background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#58a6ff) 16%,transparent);color:var(--dsw-alias-label-primary,#fff)}
.cerpc-arrow{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#778);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cerpc-method-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cerpc-files{margin-top:auto;padding:8px 10px;border-top:.5px solid var(--dsw-alias-border-l1,#2a2e35)}
.cerpc-file{font-size:10px;color:var(--dsw-alias-label-tertiary,#667);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cerpc-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.cerpc-pane{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.cerpc-request{flex:0 0 auto;overflow:visible}
.cerpc-response{flex:1 1 auto}
.cerpc-response{border-top:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-base,#141618)}
.cerpc-pane-head{flex:none;display:flex;align-items:center;gap:6px;padding:5px 10px;font-size:11px;color:var(--dsw-alias-label-tertiary,#889);min-height:26px;flex-wrap:wrap}
.cerpc-pane-title{font-weight:600;color:var(--dsw-alias-label-secondary,#aab)}
.cerpc-address{display:flex;gap:4px;align-items:center;min-width:0}
.cerpc-scheme{width:96px;height:26px;font-size:12px;padding:0 4px;flex:0 0 auto}
.cerpc-host{min-width:0;flex:1 1 auto}
.cerpc-proto{position:relative}
.cerpc-proto-row{display:flex;gap:4px;align-items:center}
/* Wider than the field it hangs from: a path list at field width is unreadable. */
.cerpc-picker{position:absolute;top:100%;left:0;z-index:30;margin-top:4px;padding:8px;display:flex;flex-direction:column;gap:8px;width:min(600px,calc(100vw - 40px));background:var(--dsw-alias-bg-layer-1,#1d2126);border:.5px solid var(--dsw-alias-border-l1,#39414a);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.45)}
/* Fixed to the viewport so a wide list cannot make the workspace scroll. */
.cerpc-picker-floating{position:fixed;margin:0}
.cerpc-picker-input{height:30px;font-size:13px}
.cerpc-picker-list{max-height:340px;overflow:auto;display:flex;flex-direction:column;gap:1px}
.cerpc-picker-row{display:flex;align-items:baseline;gap:0;width:100%;min-height:26px;text-align:left;padding:5px 8px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary,#dde);font-size:12.5px;line-height:1.5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;cursor:pointer}
.cerpc-picker-dir{color:var(--dsw-alias-label-tertiary,#889);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto;min-width:0}
.cerpc-picker-name{color:var(--dsw-alias-label-primary,#dde);flex:0 0 auto;white-space:nowrap}
.cerpc-picker-row:hover,.cerpc-picker-row-on{background:var(--dsw-alias-interactive-bg-hover,#2a2e35)}
.cerpc-picker-empty{font-size:12px;color:var(--dsw-alias-label-tertiary,#889);padding:6px 8px;display:flex;flex-direction:column;gap:4px}
.cerpc-picker-empty-title{color:var(--dsw-alias-label-secondary,#aab)}
.cerpc-picker-empty-hint{font-size:11px;line-height:1.6}
.cerpc-picker-foot{font-size:11px;color:var(--dsw-alias-label-tertiary,#778);padding:0 4px}
.cerpc-inline{display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer}
.cerpc-timeout{width:70px;height:22px;font-size:11px;padding:0 4px}
/* The request pane is content-sized: the body grows with the message, the
   response keeps whatever is left, and the ceiling keeps the split usable. */
.cerpc-json{min-height:96px;max-height:52vh;overflow:auto;resize:vertical}
.cerpc-json-bad{border-color:var(--dsw-alias-state-error-primary,#f85149) !important}
.cerpc-json-error{padding:0 10px 6px;font-size:11px;color:var(--dsw-alias-state-error-primary,#f85149);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cerpc-meta-head{flex:none;display:flex;align-items:center;gap:8px;padding:4px 10px}
.cerpc-meta-empty{padding:0 10px 6px;font-size:11px;color:var(--dsw-alias-label-tertiary,#667)}
.cerpc-meta-list{flex:none;display:flex;flex-direction:column;gap:3px;padding:0 10px 4px;max-height:24vh;overflow:auto}
.cerpc-meta-row{display:flex;align-items:center;gap:5px}
.cerpc-meta-name{flex:0 0 150px;height:24px;font-size:11px}
.cerpc-meta-value{flex:1;height:24px;font-size:11px}
.cerpc-actions{flex:none;display:flex;align-items:center;gap:8px;padding:6px 10px 10px}
.cerpc-status-msg{font-size:11px;color:var(--dsw-alias-state-warn-primary,#e3b341);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40%}
.cerpc-result{flex:1;min-height:0;overflow:auto;padding:4px 10px 10px;display:flex;flex-direction:column;gap:8px}
.cerpc-message{border:.5px solid var(--dsw-alias-border-l1,#333);border-radius:6px;overflow:hidden}
.cerpc-message-head{padding:2px 8px;font-size:10px;color:var(--dsw-alias-label-tertiary,#778);background:var(--dsw-alias-bg-layer-1,#1d2126);border-bottom:.5px solid var(--dsw-alias-border-l1,#2a2e35)}
.cerpc-message-body{margin:0;padding:8px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary,#dde)}
.cerpc-trailers{border-top:.5px solid var(--dsw-alias-border-l1,#2a2e35);padding-top:6px;display:flex;flex-direction:column;gap:2px}
.cerpc-trailer{display:flex;gap:8px;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cerpc-trailer-name{flex:none;color:var(--dsw-alias-label-tertiary,#778);min-width:110px}
.cerpc-trailer-value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#bcc)}
.ce-gline-find{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.ce-line-changed{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 20%,transparent);box-shadow:inset 3px 0 0 0 var(--dsw-alias-state-success-primary,#3fb950)}
.ce-gline-changed{color:var(--dsw-alias-state-success-primary,#3fb950);font-weight:700;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent)}
.ce-delbar{position:absolute;left:0;right:0;width:100%;height:${ROW}px;display:flex;align-items:center;gap:6px;padding:0 10px;border:0;text-align:left;cursor:pointer;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 16%,transparent);color:var(--dsw-alias-state-error-primary,#f85149);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}
.ce-delbar:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 28%,transparent)}
.ce-wdoc{padding:4px 0 10px;min-width:0}
.ce-wline{display:flex;align-items:flex-start;padding-right:10px}
.ce-wlineno{flex:none;width:52px;box-sizing:border-box;padding-right:10px;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:${ROW}px;color:var(--dsw-alias-label-tertiary,#667);user-select:none}
.ce-wlineno-active{color:var(--dsw-alias-label-primary,#cde)}
.ce-wtext{flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:${ROW}px;tab-size:4}
.ce-delbar-flow{position:static;width:auto;height:${ROW}px;margin-left:52px;border-radius:4px}
.ce-wcap{padding:6px 12px}
.ce-goto{width:min(340px,calc(100% - 32px))}
.ce-edit-ta-wrap{white-space:pre-wrap;overflow-wrap:break-word}
.ce-pos-btn{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:0 2px;border-radius:4px}
.ce-pos-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#ddd)}
.ce-chip-mark{color:var(--dsw-alias-state-success-primary,#3fb950);cursor:pointer}
.ce-dline-click{cursor:pointer}
.ce-dline-click:hover{box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l2,#444)}
.ce-tree-dir{color:var(--dsw-alias-label-secondary,#999);font-weight:600}
.ce-tree-dir:hover{color:var(--dsw-alias-label-primary,#ddd)}
.ce-tree-chev{flex:none;width:10px;font-size:9px;color:var(--dsw-alias-label-tertiary,#777)}
.ce-tree-folder{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.ce-tree-count{background:transparent;color:var(--dsw-alias-label-tertiary,#889);font-weight:600}
.ce-tree-file .ce-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.cet-row{height:24px;min-height:24px;padding-top:0;padding-bottom:0;border-radius:0}
.cet-tw{flex:none;width:14px;font-size:8px;line-height:1;color:var(--dsw-alias-label-tertiary,#777);display:inline-flex;align-items:center;justify-content:center;transition:transform .12s ease}
.cet-tw-open{transform:rotate(90deg)}
.cet-fico{flex:none;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:#8a9199}
.cet-fico svg{width:14px;height:14px;display:block}
.cet-fico-dir{color:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 75%,#9aa0a6)}
.cet-go{color:#59b7ff}
.cet-md{color:#9aa0a6}
.cet-sql{color:#e3b341}
.cet-toml{color:#e39a5c}
.cet-zip{color:#b07fe0}
.cet-html{color:#e0876a}
.cet-js{color:#d7ba7d}
.cet-json{color:#7de3a4}
.cet-file{color:#8a9199}
.cet-dirname{font-weight:600;color:var(--dsw-alias-label-primary,#ccc)}
.cet-count{margin-left:0;flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#777)}
.cet-right{margin-left:auto;flex:none;display:inline-flex;align-items:center;gap:6px}
.cet-act{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#889);cursor:pointer;font:inherit;font-size:12px;line-height:1;padding:2px 5px;border-radius:4px;opacity:0;transition:opacity .1s}
.cet-row:hover .cet-act{opacity:1}
.cet-act-show{opacity:1}
.cet-act-delete:hover,.cet-act-danger{color:var(--dsw-alias-state-error-primary,#f85149)}
.cet-act:hover{color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.cet-act-danger{color:var(--dsw-alias-state-error-primary,#f85149);font-size:11px}.cet-context{position:fixed;z-index:100001;min-width:190px;max-width:260px;padding:4px;background:var(--dsw-alias-bg-layer-2,#24272c);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:7px;box-shadow:0 8px 24px rgba(0,0,0,.28);color:var(--dsw-alias-label-primary,#ddd)}
.cet-context-path{padding:6px 9px;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cet-context-rule{height:.5px;background:var(--dsw-alias-border-l1,#333);margin:3px 0}
.cet-context>button{display:block;width:100%;border:0;border-radius:4px;background:transparent;color:inherit;text-align:left;font:inherit;font-size:12px;padding:6px 9px;cursor:pointer}
.cet-context>button:hover,.cet-context>button:focus-visible{background:var(--dsw-alias-interactive-bg-hover,#2b3038);outline:0}
.cet-context-danger{color:var(--dsw-alias-state-error-primary,#f85149)!important}
.cet-act-done{color:var(--dsw-alias-state-success-primary,#3fb950)!important}

.cet-context{position:fixed;z-index:100001;min-width:190px;max-width:260px;padding:4px;background:var(--dsw-alias-bg-layer-2,#24272c);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:7px;box-shadow:0 8px 24px rgba(0,0,0,.28);color:var(--dsw-alias-label-primary,#ddd)}
.cet-context-path{padding:6px 9px;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cet-context-rule{height:.5px;background:var(--dsw-alias-border-l1,#333);margin:3px 0}
.cet-context>button{display:block;width:100%;border:0;border-radius:4px;background:transparent;color:inherit;text-align:left;font:inherit;font-size:12px;padding:6px 9px;cursor:pointer}
.cet-context>button:hover,.cet-context>button:focus-visible{background:var(--dsw-alias-interactive-bg-hover,#2b3038);outline:0}
.cet-context-danger{color:var(--dsw-alias-state-error-primary,#f85149)!important}
.cet-act-done{color:var(--dsw-alias-state-success-primary,#3fb950)!important}
.cet-status{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700}
.cet-st-m{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cet-st-u,.cet-st-a{color:var(--dsw-alias-state-success-primary,#3fb950)}
.cet-st-d{color:var(--dsw-alias-state-error-primary,#f85149)}
.cet-st-c{color:var(--dsw-alias-brand-primary,#59b7ff)}
.cet-st-r{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cet-dirhint{color:var(--dsw-alias-label-tertiary,#777);font-size:11px;margin-left:6px}
.ce-changerail{flex:none;width:12px;position:relative;border-left:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-changeblob{position:absolute;left:2px;right:2px;min-height:4px;border:0;padding:0;border-radius:2px;cursor:pointer}
.ce-changeblob-mod{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 80%,transparent)}
.ce-changeblob-del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 80%,transparent)}
.ce-changeblob:hover{filter:brightness(1.35)}
.ce-blame{flex:none;width:150px;overflow:hidden;position:relative;background:var(--dsw-alias-bg-layer-1,#1d2126);border-right:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-bline{position:absolute;left:0;right:0;height:${ROW}px;line-height:${ROW}px;border:0;background:transparent;text-align:left;font:inherit;font-size:11px;color:var(--dsw-alias-label-tertiary,#778);padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.ce-bline:hover{color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-bline-uncommitted{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cea-bar{display:flex;gap:6px;padding:8px;flex:none;align-items:center;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.cea-method{flex:none;width:88px;border:.5px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-secondary,#999);border-radius:6px;font:inherit;font-size:11px;padding:4px 6px}
.cea-url{flex:1;min-width:0}
.cea-send{color:var(--dsw-alias-brand-primary,#6cb2ff);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent)}
.cea-scroll{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto}
.cea-sec{display:flex;align-items:center;gap:6px;padding:10px 8px 4px;color:var(--dsw-alias-label-tertiary,#889);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;flex:none}
.cea-tmo{display:flex;gap:4px;align-items:center;font-size:10px;color:var(--dsw-alias-label-tertiary,#889);text-transform:none;letter-spacing:0;font-weight:400;flex:none}
.cea-tmo-in{width:64px;flex:none;font-size:11px;padding:2px 6px}
.cea-hint{font-size:10px;color:var(--dsw-alias-label-tertiary,#778);text-transform:none;letter-spacing:0;font-weight:400}
.cea-hrow{display:flex;gap:4px;padding:2px 8px;align-items:center;flex:none}
.cea-hkey{flex:0 0 36%;min-width:0}
.cea-hval{flex:1;min-width:0}
.cea-body{flex:none;min-height:110px;max-height:220px;width:100%;box-sizing:border-box;resize:vertical;border:0;outline:none;background:var(--dsw-alias-bg-layer-1,#1e2126);color:var(--dsw-alias-label-primary,#ddd);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;padding:8px;margin:2px 0 4px;border-top:.5px solid var(--dsw-alias-border-l1,#333);border-bottom:.5px solid var(--dsw-alias-border-l1,#333);white-space:pre;overflow:auto}
.cea-import{min-height:140px;max-height:none;flex:1;border:0}
.cea-status{display:flex;gap:8px;align-items:center;padding:4px 8px;font-size:12px;flex:none}
.cea-meta{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.cea-ok{color:var(--dsw-alias-state-success-primary,#3fb950);font-weight:700}
.cea-info{color:var(--dsw-alias-brand-primary,#6cb2ff);font-weight:700}
.cea-warn{color:var(--dsw-alias-state-warn-primary,#e3b341);font-weight:700}
.cea-err{color:var(--dsw-alias-state-error-primary,#f85149);font-weight:700}
.cea-hlist{padding:0 8px 6px;font-size:11px;color:var(--dsw-alias-label-secondary,#999)}
.cea-hlist div{display:flex;gap:6px;line-height:1.6}
.cea-hk{font-weight:600;color:var(--dsw-alias-label-primary,#ccc);flex:none}
.cea-resp{flex:none;margin:0;padding:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;white-space:pre;overflow:auto;color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-bg-base,#181818);border-top:.5px solid var(--dsw-alias-border-l1,#333)}
.cea-btn-on{color:var(--dsw-alias-brand-primary,#6cb2ff);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent)}
.cea-hist{position:absolute;top:44px;left:8px;right:8px;z-index:8;background:var(--dsw-alias-bg-layer-1,#1e2126);border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.45);display:flex;flex-direction:column;max-height:62%}
.cea-hist-tabs{display:flex;gap:4px;align-items:center;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.cea-tab{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#999);font:inherit;font-size:11px;padding:3px 9px;border-radius:6px;cursor:pointer;flex:none}
.cea-tab:hover{color:var(--dsw-alias-label-primary,#ddd)}
.cea-tab-on{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#ddd)}
.cea-hist-list{overflow:auto;min-height:0;padding:4px 6px}
.cea-hrow2{display:flex;align-items:center;gap:2px;border-radius:6px}
.cea-hrow2:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.cea-hmain{flex:1;min-width:0;display:flex;gap:8px;align-items:center;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:4px 6px;cursor:pointer}
.cea-mbadge{flex:none;font-size:9.5px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2,#2a2d33);color:var(--dsw-alias-label-secondary,#aaa)}
.cea-m-post{color:#7ee787}
.cea-m-put{color:#d2a8ff}
.cea-m-patch{color:#ffa657}
.cea-m-delete{color:#ff7b72}
.cea-hurl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-primary,#ccc);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cea-hname{flex:none;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cea-hstatus{flex:none;font-size:11px}
.cea-root{container-type:inline-size;overflow:hidden;min-width:0;width:100%;max-width:100%}
.cea-root>.cea-bar{display:grid;grid-template-columns:88px minmax(0,1fr) auto;gap:0;padding:12px 12px 8px;border:0}
.cea-root>.cea-bar .cea-request-method{width:88px;height:36px;border-radius:6px 0 0 6px;font-weight:700}
.cea-root>.cea-bar .cea-url{width:100%;height:36px;box-sizing:border-box;border-radius:0 6px 6px 0;border-left:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.cea-root>.cea-bar .cea-send{margin-left:8px;min-height:36px;padding:6px 16px;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#2f81f7));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:600}
.cea-root>.cea-bar .cea-send:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#2f81f7)))}
.cea-tools{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:0 12px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.cea-tools .ce-sk-btn{border-color:transparent;padding:4px 8px;font-size:11px}
.cea-tools .ce-sk-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.cea-request-tabs{display:flex;gap:16px;padding:0 12px;overflow-x:auto;flex:none;border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.cea-config-tab{display:inline-flex;align-items:center;gap:6px;flex:none;border:0;border-bottom:2px solid transparent;padding:10px 0 8px;background:transparent;color:var(--dsw-alias-label-secondary,#999);font:inherit;font-size:12px;cursor:pointer}
.cea-config-tab-on{color:var(--dsw-alias-label-primary,#ddd);border-bottom-color:var(--dsw-alias-brand-primary,#59b7ff);font-weight:600}
.cea-tab-count{font-size:10px;color:var(--dsw-alias-label-tertiary,#889)}
.cea-root button:focus-visible,.cea-root select:focus-visible,.cea-root textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:-2px}
.cea-request-panel{flex:0 0 auto;min-height:160px;max-height:55%;overflow:auto;padding:8px 4px 12px;box-sizing:border-box}
.cea-root .cea-sec{flex-wrap:wrap;padding:8px;color:var(--dsw-alias-label-secondary,#999);text-transform:none;letter-spacing:normal;font-weight:500}
.cea-settings{padding:12px 8px}
.cea-settings .cea-tmo{font-size:12px;gap:12px}
.cea-settings .cea-tmo-in{box-sizing:border-box;width:100px}
.cea-root .cea-body:not(.cea-import){min-height:180px;max-height:none;resize:vertical;border:0;margin:4px 0 0;padding:12px;background:var(--dsw-alias-bg-base,#181818)}
.cea-response{display:flex;flex-direction:column;flex:1 0 160px;min-height:160px;border-top:.5px solid var(--dsw-alias-border-l1,#333);position:relative}
.cea-response>.cea-sec{font-weight:600;flex:none}
.cea-response .cea-resp{flex:1;min-height:100px}
.cea-root .cea-status{flex-wrap:wrap;padding:4px 12px 8px}
.cea-response-wait{padding:8px 12px;color:var(--dsw-alias-brand-primary,#59b7ff);font-size:12px}
.cea-response[aria-busy="true"] .cea-resp{opacity:.5}
.cea-empty{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;min-height:110px;padding:16px;text-align:center;color:var(--dsw-alias-label-secondary,#999);font-size:12px;line-height:1.5}
.cea-empty strong{font-weight:500}
.cea-empty span{font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.cea-root .cea-hist{top:94px}
@container (max-width:380px){.cea-root>.cea-bar{grid-template-columns:76px minmax(0,1fr)}.cea-root>.cea-bar .cea-request-method{width:76px}.cea-root>.cea-bar .cea-send{grid-column:1/-1;margin:8px 0 0}.cea-tools{gap:2px}.cea-request-tabs{gap:12px}.cea-root .cea-hist{top:138px}}
.cea-hts{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#778);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
/* Bruno-style environments / auth / codegen / timeline additions */
.cea-env{width:auto;max-width:150px;min-width:96px}
.cea-envbar{display:flex;gap:6px;align-items:center;padding:4px 8px 8px;flex:none}
.cea-env-name{flex:1;min-width:0;font-size:12px}
.cea-envbar .ce-sk-btn{flex:none;font-size:11px;padding:4px 8px}
.cea-danger{color:var(--dsw-alias-state-error-primary,#f85149)!important;border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 45%,transparent)!important}
.cea-auth{display:flex;flex-direction:column;gap:8px;padding:4px 8px}
.cea-auth-row{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--dsw-alias-label-secondary,#999)}
.cea-auth-row>span{flex:0 0 88px}
.cea-auth-row .ce-input{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.cea-codemenu{max-width:260px;min-width:210px}
.cea-code-item{align-items:center}
.cea-code-label{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px}
.cea-code-copied{flex:none;font-size:11px}
.cea-resp-tabs{padding:2px 8px 0;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.cea-timeline{display:flex;flex-direction:column;gap:4px;padding:6px 4px}
.cea-tl-req{display:flex;gap:8px;align-items:center;padding:0 8px 2px}
.cea-tl-body{margin:0 8px;border-radius:6px;max-height:160px;overflow:auto}
.cea-tl-meta{padding:2px 8px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#889);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-htmlprev{flex:1;min-height:0;width:100%;border:0;background:#fff}
.ctp-tools{display:flex;gap:6px;padding:4px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.ctp-acts{margin-left:0;display:inline-flex;flex:none;gap:2px;width:0;overflow:hidden;visibility:hidden;pointer-events:none}
.ce-row[data-tp] .ce-name{flex:1}
.ce-row[data-tp]>.ce-ico,.ce-row[data-tp]>.ce-tree-ico{flex:none}
.ce-row[data-tp]{column-gap:0}
.ce-row[data-tp]>.ce-name{margin-left:6px}
.ce-row:hover .ctp-acts,.ce-row:focus-within .ctp-acts{margin-left:6px}
.ce-fast-hint{position:fixed;z-index:100000;pointer-events:none;max-width:min(260px,calc(100vw - 16px));box-sizing:border-box;padding:5px 8px;border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:5px;background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-primary,#ddd);font-family:system-ui,sans-serif;font-size:12px;font-weight:400;line-height:1.4;white-space:normal;overflow-wrap:anywhere;box-shadow:0 3px 10px rgba(0,0,0,.14)}
.ce-row:hover .ctp-acts,.ce-row:focus-within .ctp-acts,.ctp-acts:has(.cet-act-danger){width:auto;overflow:visible;visibility:visible;pointer-events:auto}
.ctp-acts .cet-act{opacity:1}
.ctp-inputrow{cursor:default}
.ctp-inputrow:hover{background:transparent}
.ctp-inputrow .ce-input{flex:1;min-width:0}
/* v1.5 visual system: calm surfaces, one interaction accent, readable density. */
.ce-root,.cel-root{
	--ce-surface-0:var(--dsw-alias-bg-base,#111315);
	--ce-surface-1:var(--dsw-alias-bg-layer-1,#181b1f);
	--ce-surface-2:var(--dsw-alias-bg-layer-2,#20242a);
	--ce-line:color-mix(in srgb,var(--dsw-alias-border-l1,#39414a) 72%,transparent);
	--ce-line-strong:var(--dsw-alias-border-l2,#515b66);
	--ce-fg:var(--dsw-alias-label-primary,#edf2f7);
	--ce-fg-2:var(--dsw-alias-label-secondary,#aab5c1);
	--ce-fg-3:var(--dsw-alias-label-tertiary,#7d8996);
	--ce-accent:var(--dsw-alias-button-info-fill,#4176e6);
	--ce-accent-soft:color-mix(in srgb,var(--ce-accent) 14%,transparent);
	--ce-radius:8px;
	background:var(--ce-surface-0);color:var(--ce-fg);font-size:13px;letter-spacing:.005em
}
.ce-root *{box-sizing:border-box}
.ce-root button{transition:background-color .12s ease,color .12s ease,border-color .12s ease,opacity .12s ease}
.ce-root button:focus-visible,.ce-root input:focus-visible,.ce-root select:focus-visible,.ce-root textarea:focus-visible{outline:2px solid var(--ce-accent);outline-offset:1px}
.ce-toolbar{min-height:42px;padding:7px 10px;background:var(--ce-surface-1);border-bottom:1px solid var(--ce-line);gap:7px}
.ce-seg{background:var(--ce-surface-0);border:1px solid var(--ce-line);border-radius:var(--ce-radius);padding:2px}
.ce-seg-btn{border-radius:6px;padding:5px 10px;color:var(--ce-fg-3)}
.ce-seg-on{background:var(--ce-accent-soft);color:var(--ce-fg);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ce-accent) 28%,transparent)}
.ce-tool{border-radius:6px;color:var(--ce-fg-2)}
.ce-tool:hover{background:var(--ce-accent-soft);color:var(--ce-fg)}
.ce-branch{background:var(--ce-surface-2);border:1px solid var(--ce-line);color:var(--ce-fg-2);padding:5px 8px}
.ce-rail-wrap{background:var(--ce-surface-0);border-right:1px solid var(--ce-line)}
.ce-rail-search{background:var(--ce-surface-1);border-color:var(--ce-line-strong);color:var(--ce-fg-2)}
.ce-rail-search:hover{background:var(--ce-accent-soft);border-color:color-mix(in srgb,var(--ce-accent) 45%,transparent)}
.ce-row{min-height:26px;border-radius:6px;padding:5px 9px;color:var(--ce-fg-2)}
.ce-row:hover{background:var(--ce-surface-2);color:var(--ce-fg)}
.ce-active{background:var(--ce-accent-soft);color:var(--ce-fg);box-shadow:inset 2px 0 0 var(--ce-accent)}
.ce-note{color:var(--ce-fg-3);padding:6px 12px;line-height:1.5}
.ce-section{padding:12px 12px 7px;color:var(--ce-fg-2);font-size:11px;letter-spacing:normal}
.ce-editor{background:var(--ce-surface-0)}
.ce-tabs{background:var(--ce-surface-0);border-bottom:1px solid var(--ce-line);padding:5px 8px 0}
.ce-tab{border-radius:7px 7px 0 0;padding:6px 8px;color:var(--ce-fg-3)}
.ce-tab-active{background:var(--ce-surface-1);border-color:var(--ce-line);color:var(--ce-fg);box-shadow:0 -1px 0 var(--ce-accent)}
.ce-head{min-height:36px;padding:7px 10px;background:var(--ce-surface-1);border-bottom:1px solid var(--ce-line)}
.ce-head-path{color:var(--ce-fg);font-weight:600}
.ce-chip{background:var(--ce-surface-2);border:1px solid var(--ce-line);color:var(--ce-fg-2);padding:2px 7px}
.ce-code-wrap,.ce-code,.ce-gutter{background:var(--ce-surface-0)}
.ce-gutter{border-right:1px solid var(--ce-line)}
.ce-line{font-size:13px;line-height:${ROW}px}
.ce-empty{color:var(--ce-fg-3);background:var(--ce-surface-0);line-height:1.6}
.ce-commitbox{background:var(--ce-surface-1);border-bottom:1px solid var(--ce-line);padding:10px 12px 12px}
.ce-commitbox-msg,.ce-input{background:var(--ce-surface-0);border:1px solid var(--ce-line-strong);color:var(--ce-fg);border-radius:7px}
.ce-commitbox-msg::placeholder,.ce-input::placeholder{color:var(--ce-fg-3)}
.ce-commitbox-msg:focus,.ce-input:focus{border-color:var(--ce-accent);box-shadow:0 0 0 3px var(--ce-accent-soft)}
.ce-commitbox-btn,.ce-sk-primary{background:var(--dsw-alias-button-primary-fill,var(--ce-accent));border:0;color:var(--dsw-alias-label-primary-foreground,#fff);border-radius:7px;min-height:30px}
.ce-commitbox-btn:hover,.ce-sk-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--ce-accent))}
.ce-changes-search{background:var(--ce-surface-1);border-bottom:1px solid var(--ce-line);padding:8px 12px}
.ce-change-group{border-top:1px solid var(--ce-line);padding-bottom:8px}
.ce-peek,.ce-overlay,.cea-hist,.cet-context{background:var(--ce-surface-1);border:1px solid var(--ce-line-strong);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.42)}
.ce-peek-head,.ce-overlay-head{background:var(--ce-surface-2);border-bottom:1px solid var(--ce-line);padding:9px 12px}
.ce-peek-file{background:var(--ce-surface-2);border-color:var(--ce-line);padding:7px 12px}
.ce-peek-head{flex-wrap:wrap;gap:6px 8px}
.ce-peek-sym{flex:1 1 120px;max-width:none;min-width:0}
.ce-peek-hint{flex:1 1 100%;order:1;font-size:10px}
.ce-peek-head>.ce-spacer{display:none}
.ce-peek-head>.ce-tool{flex:none}
.ce-peek-row-sel{background:var(--ce-accent-soft)}
.cea-root>.cea-bar{background:var(--ce-surface-1);border-bottom:1px solid var(--ce-line);padding:10px 12px}
.cea-root>.cea-bar .cea-request-method,.cea-root>.cea-bar .cea-url{height:38px;background:var(--ce-surface-0);border-color:var(--ce-line-strong)}
.cea-tools,.cea-request-tabs{background:var(--ce-surface-1);border-color:var(--ce-line)}
.cea-config-tab{color:var(--ce-fg-3);padding:11px 2px 9px}
.cea-config-tab-on{color:var(--ce-fg);border-bottom-color:var(--ce-accent)}
.cea-request-panel{background:var(--ce-surface-0)}
.cea-response{background:var(--ce-surface-0);border-top:1px solid var(--ce-line)}
.cea-resp{background:var(--ce-surface-1);border-color:var(--ce-line);border-radius:7px;margin:0 10px 10px}
.ce-sk-root{background:var(--ce-surface-0)}
.ce-sk-top,.ce-sk-detail-tools,.ce-sk-searchbar,.ce-sk-create{background:var(--ce-surface-1);border-color:var(--ce-line)}
.ce-sk-row-on{background:var(--ce-accent-soft);box-shadow:inset 2px 0 var(--ce-accent)}
.ce-sk-detail-title{letter-spacing:-.01em}
.ce-sk-source,.ce-sk-ta{background:var(--ce-surface-0);color:var(--ce-fg)}
.cel-root{background:var(--ce-surface-0);padding:20px 16px;gap:4px}
.cel-section{color:var(--ce-fg-3);padding:18px 10px 6px;font-size:11px;letter-spacing:normal;text-transform:none}
.cel-row{border-radius:8px;padding:10px;color:var(--ce-fg-2);gap:12px;min-height:60px}
.cel-row:hover{background:var(--ce-surface-1);color:var(--ce-fg)}
.cel-ico{background:var(--ce-surface-2);border:1px solid var(--ce-line);color:var(--ce-fg-2);width:32px;height:32px;border-radius:8px}
.cel-desc{color:var(--ce-fg-2);font-size:12px;line-height:1.5}
.cel-kbd{font-size:10px;color:var(--ce-fg-3);background:var(--ce-surface-1);border-color:var(--ce-line)}
.ce-changes .ce-section{font-size:12px;gap:6px}
.ce-changes .ce-section>.ce-link{font-size:10px;font-weight:400}
.ce-changes .ce-note-line{padding-top:6px;padding-bottom:8px;font-size:11px}
.ce-changes>.ce-note{font-size:11px;padding-top:10px;padding-bottom:8px}
.ce-commitbox-amend{font-size:11px;border-color:var(--ce-line);color:var(--ce-fg-2)}
.ce-toolbar{flex-wrap:wrap}
.ce-head{overflow-x:auto;scrollbar-width:thin}
.ce-command-trigger{display:inline-flex;align-items:center;gap:6px;min-width:0;border:1px solid var(--ce-line);border-radius:7px;background:var(--ce-surface-0);color:var(--ce-fg-2);padding:5px 8px;font:inherit;font-size:11px;cursor:pointer;white-space:nowrap}
.ce-command-trigger:hover,.ce-command-trigger.ce-tool-on{background:var(--ce-accent-soft);color:var(--ce-fg);border-color:color-mix(in srgb,var(--ce-accent) 45%,var(--ce-line))}
.ce-command-trigger kbd,.ce-command-hint{font:inherit;font-size:10px;color:var(--ce-fg-3);background:var(--ce-surface-1);border:1px solid var(--ce-line);border-radius:4px;padding:2px 5px}
.ce-command-mark{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ce-accent);font-weight:700;flex:none}
.ce-command-palette{top:46px;max-width:620px}
.ce-command-palette .ce-palette-head{gap:8px}
.ce-command-item{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:var(--ce-fg-2);font:inherit;text-align:left;padding:8px 12px;cursor:pointer}
.ce-command-item:hover,.ce-command-item.ce-qitem-sel{background:var(--ce-accent-soft);color:var(--ce-fg)}
.ce-command-icon{width:20px;text-align:center;color:var(--ce-accent);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-command-label{flex:1;min-width:0}
.ce-command-hint{flex:none}

/* Task layouts: review files first; reserve stable space for the active document. */
.ce-code-root{container-type:inline-size}
.ce-code-root .ce-toolbar{flex-wrap:nowrap;min-width:0}
.ce-code-root .ce-seg{flex:none}
.ce-code-root .ce-branch{min-width:0;max-width:220px;flex:0 1 auto}
.ce-code-root .ce-branch>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-code-root .ce-toolbar>.ce-tool{flex:none}
.ce-rail-navigation{display:flex;align-items:center;gap:4px;padding:8px;flex:none;border-bottom:1px solid var(--ce-line)}
.ce-rail-navigation .ce-rail-search{margin:0;flex:1;min-width:0;min-height:30px;font-size:11px}
.ce-rail-quickopen{flex:none}
.ce-rail-with-search{max-width:45%;min-width:170px}
.ce-mobile-back,.ce-mobile-open-editor{display:none}
.ce-changes>.ce-change-group:first-of-type{border-top:0;padding-top:0}
.ce-commit-disclosure{border-top:1px solid var(--ce-line);border-bottom:1px solid var(--ce-line);margin-top:8px}
.ce-disclosure-summary{cursor:pointer;padding:12px;list-style-position:inside;color:var(--ce-fg);font-size:12px;line-height:1.5}
.ce-disclosure-summary>span:first-child{font-weight:600}
.ce-disclosure-meta{display:block;margin-top:4px;margin-left:14px;font-size:11px;color:var(--ce-fg-3);font-weight:400}
.ce-disclosure-summary:hover{background:var(--ce-surface-1)}
.ce-disclosure-summary:focus-visible{outline:2px solid var(--ce-accent);outline-offset:-2px}
.ce-commit-disclosure .ce-commitbox{border:0}
.ce-branch-history{padding:0}
.ce-changes .ce-section{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}
.ce-changes .ce-section>span:first-child{flex:1 0 100%;line-height:1.5}
.ce-changes .ce-section>.ce-tool{margin-left:auto}
.ce-changes .ce-section>.ce-link{flex:none}
.cea-scroll.cea-workspace{display:grid;flex:1;min-height:0;overflow:hidden;gap:0}
.cea-request{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}
.cea-workspace .cea-request-panel{flex:1;min-height:0;max-height:none;overflow:auto;padding:8px}
.cea-workspace .cea-request-panel .cea-body{display:block;min-height:160px;max-height:none;resize:vertical}
.cea-workspace .cea-response{flex:none;min-height:0;min-width:0;border:0;overflow:hidden}
.cea-response-content{flex:1;min-height:0;min-width:0;overflow:auto}
.cea-response-content .cea-resp{min-height:0;margin:0;padding:12px;border:0;border-radius:0;overflow:visible;width:max-content;min-width:100%}
.cea-response-content .cea-hlist{padding:8px 12px;border-bottom:1px solid var(--ce-line)}
.cea-response-content .cea-hlist div{overflow-wrap:anywhere}
.cea-workspace .cea-response>.cea-empty{flex:1;min-height:0}
.cea-resizer{display:flex;align-items:center;justify-content:center;cursor:row-resize;touch-action:none;background:var(--ce-surface-1);border-block:1px solid var(--ce-line);min-height:10px}
.cea-resizer>span{width:32px;height:2px;border-radius:2px;background:var(--ce-line-strong)}
.cea-resizer:hover,.cea-resizer:focus-visible{background:var(--ce-accent-soft);outline:0}
.cea-resizer:focus-visible>span{background:var(--ce-accent)}
.ce-sk-detail-head{max-height:36%;padding:14px 16px 8px}
.ce-sk-detail-title{margin-bottom:6px;font-size:16px}
.ce-sk-install-details{margin-top:8px;font-size:11px;color:var(--ce-fg-3)}
.ce-sk-install-details>summary{cursor:pointer;padding:4px 0}
.ce-sk-install-details .ce-sk-detail-desc{font-size:12px;margin:6px 0;line-height:1.6}
.ce-sk-edit>.ce-md{padding:18px 24px;line-height:1.75}
.ce-sk-edit .ce-md-p,.ce-sk-edit .ce-md-list{max-width:76ch}
.ce-sk-searchbar{gap:6px;padding:10px 12px}
@container (max-width:620px){
 .ce-code-root .ce-rail-wrap{max-width:none;width:100%!important;min-width:0;border:0}
 .ce-code-root .ce-splitter,.ce-code-root .ce-rail-tab{display:none}
 .ce-code-root[data-mobile-view="files"] .ce-editor{display:none}
 .ce-code-root[data-mobile-view="editor"] .ce-rail-wrap{display:none}
 .ce-code-root[data-mobile-view="editor"] .ce-mobile-back{display:block;flex:none;text-align:left;padding:8px 12px;border:0;border-bottom:1px solid var(--ce-line);background:var(--ce-surface-1);color:var(--ce-fg-2);font:inherit;font-size:12px;cursor:pointer}
 .ce-code-root[data-mobile-view="files"] .ce-mobile-open-editor{display:block;flex:none;font-size:11px}
 .ce-code-root .ce-branch{max-width:120px}.ce-code-root .ce-command-trigger{padding:5px 7px}.ce-code-root .ce-command-trigger>span:not(.ce-command-mark),.ce-code-root .ce-command-trigger>kbd{display:none}
 .ce-code-root .ce-workspace-search{width:26px;padding:0}
 .ce-code-root .ce-workspace-search>span{display:none}
 .ce-sk-detail-head{max-height:34%;padding:12px 16px 6px}
 .ce-sk-back{margin-bottom:8px}
 .ce-sk-edit>.ce-md{padding:16px}
}
.ce-search-box>.ce-tool{flex:none;min-width:24px;padding:0;white-space:nowrap}
.ce-search-scope{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 8px;flex:none;padding-bottom:8px;border-bottom:1px solid var(--ce-line)}
.ce-search-scope strong{font-size:13px;font-weight:600}
.ce-search-scope>span{grid-row:2;font-size:11px;color:var(--ce-fg-3);overflow-wrap:anywhere}
.ce-search-scope>.ce-tool{grid-column:2;grid-row:1/3}
.ce-search-directory{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:11px;color:var(--ce-fg-2);flex:none}
.ce-search-directory .ce-input{flex:1 1 160px;font-size:12px;min-width:0}

/* Request builder: one primary request row, config tabs and editable tables. */
.cea-root>.cea-tools{padding:6px 12px;min-height:34px;border-bottom:1px solid var(--ce-line);background:var(--ce-surface-0);gap:4px}
.cea-root>.cea-bar{padding:14px 16px;background:var(--ce-surface-0);border-bottom:0}
.cea-root>.cea-bar .cea-request-method,.cea-root>.cea-bar .cea-url{height:42px;background:var(--ce-surface-0);font-size:13px}
.cea-root>.cea-bar .cea-request-method{border-right:0;border-radius:8px 0 0 8px;color:var(--dsw-alias-state-success-primary,#288252)}
.cea-root>.cea-bar .cea-url{border-left:0;border-radius:0 8px 8px 0;font-family:inherit}
.cea-root>.cea-bar .cea-send{height:42px;min-width:80px;margin-left:10px;border-radius:8px;font-size:13px}
.cea-root .cea-request-tabs{padding:0 16px;gap:24px;background:var(--ce-surface-0)}
.cea-root .cea-config-tab{padding:12px 0 10px;font-size:13px;color:var(--ce-fg-2)}
.cea-root .cea-config-tab-on{color:var(--ce-fg);border-bottom-color:var(--ce-accent)}
.cea-workspace .cea-request-panel{padding:16px}
.cea-fields{min-width:0}
.cea-fields-scroll{overflow:auto;border:1px solid var(--ce-line);border-radius:7px}
.cea-fields-table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:12px;color:var(--ce-fg)}
.cea-fields-check,.cea-fields-action{width:34px}
.cea-fields-name{width:25%}.cea-fields-description{width:25%}
.cea-fields-table th{font-weight:500;color:var(--ce-fg-2);background:var(--ce-surface-1);text-align:left;height:36px;padding:8px 10px}
.cea-fields-table td{height:38px;padding:0;border-top:1px solid var(--ce-line)}
.cea-fields-table th,.cea-fields-table td{border-right:1px solid var(--ce-line)}
.cea-fields-table th:last-child,.cea-fields-table td:last-child{border-right:0}
.cea-fields-table td:first-child{text-align:center}
.cea-fields-table input[type=checkbox]{accent-color:var(--ce-accent);width:15px;height:15px;cursor:pointer;margin:0}
.cea-fields-table input[type=checkbox]:disabled{opacity:.25;cursor:default}
.cea-field-input{width:100%;min-width:0;height:38px;border:0;border-radius:0;background:transparent;color:var(--ce-fg);padding:8px 10px;font:inherit;outline-offset:-2px!important}
.cea-field-input::placeholder{color:var(--ce-fg-3)}
.cea-field-input:focus{background:var(--ce-accent-soft)}
.cea-field-disabled .cea-field-input{color:var(--ce-fg-3)}
.cea-field-delete{width:30px;height:30px;margin:2px}
.cea-fields-footer{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:10px 0;color:var(--ce-fg-2);font-size:11px;line-height:1.5}
.cea-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
@container (max-width:560px){
 .cea-fields-description{display:none}
 .cea-fields-name{width:36%}
 .cea-root>.cea-bar{padding:10px}
 .cea-workspace .cea-request-panel{padding:10px}
 .cea-root .cea-request-tabs{padding:0 10px;gap:18px}
}

/* Entry points live in native left PanelRows; the right guide is a work area. */
.ce-workspace-guide{height:100%;min-height:180px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;color:var(--dsw-alias-label-secondary,#9aa4b0);font-family:inherit}
.ce-workspace-guide-icon{display:inline-flex;color:var(--dsw-alias-label-tertiary,#7b8794)}
.ce-workspace-guide h2{margin:0;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary,#ddd)}
.ce-workspace-guide p{margin:0;max-width:38ch;font-size:12px;line-height:1.7}
.ce-left-notice{position:fixed;z-index:1000;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;max-width:min(480px,calc(100vw - 32px));padding:10px 14px;border:1px solid var(--dsw-alias-border-l2,#48515e);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-primary,#ddd);font:inherit;font-size:13px;line-height:1.5;box-shadow:0 6px 24px #0002}
.ce-left-notice>span{min-width:0;overflow-wrap:anywhere}
.ce-left-notice>button{flex:none;width:28px;height:28px;border:0;border-radius:4px;background:transparent;color:inherit;font:inherit;font-size:18px;cursor:pointer}
.ce-left-notice>button:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#4176e6)}

/* Browser chrome: persistent carrier viewport with task pages above it. */
.ceb-root{container-type:inline-size;overflow:hidden}
.ceb-strip{display:flex;align-items:flex-end;gap:4px;flex:none;padding:6px 8px 0;background:var(--ce-surface-2);border-bottom:1px solid var(--ce-line);overflow-x:auto;overflow-y:hidden}
.ceb-sub{display:flex;align-items:center;flex:none;max-width:170px;min-width:56px;height:28px;border:1px solid var(--ce-line);border-bottom:0;border-radius:8px 8px 0 0;background:transparent;color:var(--ce-fg-2)}
.ceb-sub-active{background:var(--ce-surface-1);color:var(--ce-fg);border-color:var(--ce-line-strong);border-bottom:1px solid var(--ce-surface-1);margin-bottom:-1px}
.ceb-sub-open{flex:1;min-width:0;height:100%;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;text-align:left;padding:0 2px 0 10px;cursor:pointer}
.ceb-sub-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ceb-sub-close{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;margin:0 4px 0 2px;border:0;border-radius:5px;background:transparent;color:inherit;cursor:pointer;opacity:.65}
.ceb-sub-close:hover{background:var(--ce-accent-soft);color:var(--ce-accent);opacity:1}
.ceb-sub-close svg{width:12px;height:12px;display:block}
.ceb-strip-add{flex:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;margin:0 0 2px 2px;border:0;border-radius:6px;background:transparent;color:var(--ce-fg-2);cursor:pointer}
.ceb-strip-add:hover{background:var(--ce-accent-soft);color:var(--ce-accent)}
.ceb-strip-add svg{width:14px;height:14px;display:block}
.ceb-strip-note{flex:none;align-self:center;font-size:11px;color:var(--ce-fg-2);padding:0 6px}
.ceb-page{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0}
.ceb-toolbar{display:flex;align-items:center;gap:12px;flex:none;padding:10px 12px;background:var(--ce-surface-1);min-width:0}
.ceb-nav-group,.ceb-action-group{display:flex;align-items:center;gap:3px;flex:none}
.ceb-toolbar .ceb-tool{flex:none;width:30px;height:32px;border-radius:6px;color:var(--ce-fg-2)}
.ceb-toolbar .ceb-tool svg{width:16px;height:16px;display:block}
.ceb-toolbar .ceb-tool:disabled{opacity:.45;cursor:default}
.ceb-toolbar .ceb-tool[aria-pressed=true]{background:var(--ce-accent-soft);color:var(--ce-accent)}
.ceb-address-shell{display:flex;align-items:center;gap:4px;flex:1;min-width:80px;height:36px;padding:0 5px 0 10px;border:1px solid var(--ce-line-strong);border-radius:9px;background:var(--ce-surface-0);transition:border-color .15s ease}
.ceb-address-shell:focus-within{border-color:var(--ce-accent)}
.ceb-address-icon{display:inline-flex;flex:none;color:var(--ce-fg-3)}
.ceb-root .ceb-address{flex:1;min-width:0;width:100%;height:32px;padding:0 5px;border:0;border-radius:0;background:transparent;color:var(--ce-fg);font-family:inherit;font-size:12px;box-shadow:none;outline:none}
.ceb-root .ceb-address:focus-visible{outline:none;box-shadow:none}
.ceb-go{display:inline-flex;align-items:center;justify-content:center;flex:none;width:26px;height:26px;padding:0;border:0;border-radius:5px;background:var(--ce-accent-soft);color:var(--ce-accent);cursor:pointer}
.ceb-go:disabled{opacity:.3;cursor:default}
.ceb-toolbar .ceb-star{width:26px;height:26px}
.ceb-toolbar .ceb-star-saved{color:var(--ce-accent)}
.ceb-progress{position:relative;height:2px;flex:none;overflow:hidden;background:var(--ce-line)}
.ceb-progress>span{display:none}
.ceb-progress-active>span{display:block;position:absolute;inset:0 auto 0 0;width:35%;background:var(--ce-accent);animation:ceb-loading 1.3s ease-in-out infinite}
@keyframes ceb-loading{from{transform:translateX(-100%)}to{transform:translateX(390%)}}
@media(prefers-reduced-motion:reduce){.ceb-progress-active>span{animation:none;width:100%;opacity:.5}.ceb-address-shell{transition:none}}

.ceb-bookmarks-bar{display:flex;align-items:center;gap:5px;overflow:auto;flex:none;padding:5px 8px;border-bottom:1px solid var(--ce-line)}
.ceb-bookmarks-bar button{flex:none;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 8px;border:0;border-radius:4px;background:transparent;color:var(--ce-fg-2);font:inherit;font-size:11px;cursor:pointer}
.ceb-bookmarks-bar button:hover{background:var(--ce-accent-soft)}
.ceb-content{position:relative;flex:1;min-height:0;min-width:0;overflow:hidden}
.ceb-viewport{position:absolute;inset:0;display:flex;min-height:0;min-width:0}
.ceb-guest{flex:1;display:flex;width:100%;height:100%;border:0;background:var(--ce-surface-0)}
.ceb-panel{position:absolute;inset:0;background:var(--ce-surface-0);padding:24px clamp(16px,4%,40px);z-index:1}
.ceb-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px}
.ceb-panel-head h2,.ceb-start h2{margin:0;font-size:18px;line-height:1.4;font-weight:600;letter-spacing:-.02em}
.ceb-panel-caption{margin:5px 0 0;font-size:12px;line-height:1.6;color:var(--ce-fg-2)}
.ceb-start-icon{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:var(--ce-surface-1);border:1px solid var(--ce-line);color:var(--ce-fg-2);margin-bottom:6px}
.ceb-list-tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.ceb-list-tools>.ce-input{flex:1 1 180px;font-size:12px}
.ceb-list-tools label,.ceb-checkbox{display:flex;align-items:center;gap:6px;font-size:12px}
.ceb-bookmark-row{display:flex;align-items:center;gap:8px;padding:14px 0;border-bottom:1px solid var(--ce-line);min-width:0}
.ceb-bookmark-open{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:5px;border:0;background:transparent;text-align:left;color:var(--ce-fg);font:inherit;cursor:pointer}
.ceb-bookmark-open strong{font-size:13px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ceb-bookmark-open span{font-size:11px;color:var(--ce-fg-2);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ceb-bookmark-open .ceb-bookmark-title{display:flex;align-items:center;gap:8px;max-width:100%;color:var(--ce-fg)}
.ceb-bookmark-open .ceb-bookmark-glyph{display:inline-flex;flex:none;color:var(--ce-accent)}
.ceb-bookmark-open small{font-size:11px;color:var(--ce-fg-3)}
.ceb-confirm{display:inline-flex;align-items:center;gap:4px;flex:none}
.ceb-empty{padding:32px 12px;color:var(--ce-fg-2);font-size:13px;line-height:1.7}
.ceb-feedback:not([hidden]){padding:8px 12px;font-size:12px;line-height:1.5;background:var(--ce-surface-2);color:var(--ce-fg);overflow-wrap:anywhere;flex:none}
.ceb-loading{font-size:11px;color:var(--ce-fg-2);padding:3px 10px;flex:none}
.ceb-setting-hint,.ceb-capabilities p{font-size:12px;line-height:1.7;color:var(--ce-fg-2)}
.ceb-settings-form{padding:18px 0;border-block:1px solid var(--ce-line);display:flex;flex-direction:column;align-items:flex-start;gap:14px;margin:18px 0;max-width:620px}
.ceb-settings-form>label:not(.ceb-checkbox){display:flex;flex-direction:column;align-self:stretch;gap:7px;font-size:12px}
.ceb-settings-form .ce-input{flex:none}
.ceb-capabilities{border-top:1px solid var(--ce-line);margin-top:22px;padding-top:12px;max-width:76ch}
.ceb-capabilities h3{font-size:13px;margin:12px 0 6px}
.ceb-bookmark-editor{max-height:calc(100% - 58px);overflow:auto;position:absolute;z-index:8;top:48px;right:10px;width:min(400px,calc(100% - 20px));display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid var(--ce-line-strong);border-radius:8px;background:var(--ce-surface-1);box-shadow:0 8px 28px #0003}
.ceb-bookmark-editor header,.ceb-bookmark-editor footer{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px}
.ceb-bookmark-editor footer{justify-content:flex-end}
.ceb-bookmark-editor>label:not(.ceb-checkbox){display:flex;flex-direction:column;gap:5px;font-size:12px}
.ceb-bookmark-editor .ce-input{flex:none;font-size:12px}
.ceb-start{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:var(--ce-surface-0);color:var(--ce-fg-2);overflow:auto}
.ceb-start p{margin:0;font-size:12px;line-height:1.7;overflow-wrap:anywhere;max-width:100%}
.ceb-root input[type=checkbox]{accent-color:var(--ce-accent)}
@container (max-width:620px){.ceb-toolbar{display:grid;grid-template-columns:1fr auto;gap:7px;padding:8px 10px}.ceb-nav-group{grid-column:1;grid-row:1}.ceb-action-group{grid-column:2;grid-row:1}.ceb-address-shell{grid-column:1/-1;grid-row:2;min-width:0;width:100%}.ceb-bookmark-row{flex-wrap:wrap}.ceb-bookmark-open{flex:1 1 100%}.ceb-panel{padding:18px 14px}.ceb-bookmark-editor{top:94px;max-height:calc(100% - 104px)}}
@media(pointer:coarse){.ceb-toolbar .ceb-tool{min-width:36px;min-height:36px}.ceb-bookmark-editor .ceb-tool{min-width:36px;min-height:36px}}


.ce-editor-file-drop{outline:2px solid var(--ce-accent);outline-offset:-2px}
.ce-file-drop-hint{position:absolute;z-index:12;bottom:14px;left:50%;transform:translateX(-50%);max-width:calc(100% - 24px);padding:8px 12px;border:1px solid var(--ce-accent);border-radius:6px;background:var(--ce-surface-1);color:var(--ce-fg);font-size:12px;line-height:1.5;pointer-events:none;text-align:center}
.ce-tab-drop-before{box-shadow:inset 2px 0 0 var(--ce-accent)}

.ctp-entry-open{display:flex;align-items:center;gap:6px;flex:1;min-width:0;align-self:stretch;border:0;padding:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.ctp-entry-open>.ce-ico,.ctp-entry-open>.cet-fico{flex:none}
.ctp-entry-open>.ce-name{flex:1}
.ctp-delete-panel{margin:5px 8px 9px;padding:12px;border:1px solid var(--ce-line-strong);border-radius:6px;background:var(--ce-surface-1);color:var(--ce-fg);font-size:12px;line-height:1.6;overflow-wrap:anywhere}
.ctp-delete-panel strong{font-size:12px;font-weight:600}
.ctp-delete-panel p{margin:6px 0;color:var(--ce-fg-2)}
.ctp-delete-panel .ctp-delete-error{color:var(--dsw-alias-state-error-primary)}
.ctp-delete-buttons{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}

.cet-row:focus-within .cet-act,.cet-copy-path:focus-visible{opacity:1}
.cet-copy-path{display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px;padding:4px}
@media(hover:none){.cet-copy-path{opacity:1}}

/* ---------------- built-in terminal: our own emulator, our own paint ---------------- */
.ce-term-shell{position:relative;flex:1;min-height:0;min-width:0;display:flex}
.ce-term{position:relative;flex:1;min-height:0;min-width:0;overflow:hidden;box-sizing:border-box;padding:8px;background:var(--dsw-alias-bg-base,#1e1e1e);color:var(--dsw-alias-label-primary,#d4d4d4);cursor:text}
.ce-term-rows{position:relative;white-space:pre;letter-spacing:0;font-kerning:none;font-variant-ligatures:none;tab-size:8}
.ce-term-row{white-space:pre;overflow:hidden;overflow-wrap:normal}
.ce-term-row span{white-space:pre}
.ce-term-measure{position:absolute;top:0;left:-9999px;visibility:hidden;white-space:pre;display:inline-block}
.ce-term-selection{position:absolute;top:8px;left:8px;pointer-events:none}
.ce-term-selection-rect{position:absolute;top:0;left:0;background:var(--dsw-alias-interactive-bg-hover,#264f78);opacity:.55}
.ce-term-cursor{position:absolute;top:8px;left:8px;pointer-events:none;box-sizing:border-box}
.ce-term-cursor-block{background:var(--dsw-alias-label-primary,#d4d4d4);mix-blend-mode:difference}
.ce-term-cursor-underline{border-bottom:2px solid var(--dsw-alias-label-primary,#d4d4d4)}
.ce-term-cursor-bar{border-left:2px solid var(--dsw-alias-label-primary,#d4d4d4)}
.ce-term-focused .ce-term-cursor-blink{animation:ce-term-blink 1.06s step-end infinite}
@keyframes ce-term-blink{50%{opacity:0}}
.ce-term-input{position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;resize:none;overflow:hidden}
.ce-term-status{position:absolute;left:8px;bottom:6px;right:8px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#999);pointer-events:none}
.ce-term-status-error{color:var(--dsw-alias-state-error-primary,#f85149)}
.ce-term-title{display:inline-flex;align-items:center;gap:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
/* ---------------- request workbench: one tab, two protocols ---------------- */
.ce-wb{display:flex;flex-direction:column;height:100%;min-height:0}
.ce-wb-bar{display:flex;align-items:center;gap:8px;flex:none;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-base,#181818)}
.ce-wb-seg{display:flex;border-radius:var(--dsw-radius-sm,6px);overflow:hidden;border:.5px solid var(--dsw-alias-border-l2,#444)}
.ce-wb-btn{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#999);padding:2px 10px;cursor:pointer;font:inherit;font-size:11.5px}
.ce-wb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#eee)}
.ce-wb-on{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#eee)}
.ce-wb-on:focus-visible{outline:2px solid var(--ce-accent,#59b7ff);outline-offset:-2px}
.ce-wb-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#778);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ce-wb-pane{flex:1;min-height:0;min-width:0;display:flex}
.ce-wb-pane[hidden]{display:none}
.cedb-detect{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary,#999);margin:-2px 0 2px}
.cedb-detect-miss{color:var(--dsw-alias-state-warn-primary,#e3b341)}
.cedb-detect-note{color:var(--dsw-alias-state-error-primary,#f85149)}
.cedb-advanced{align-self:flex-start;border:0;background:transparent;color:var(--dsw-alias-brand-primary,#59b7ff);font:inherit;font-size:11.5px;cursor:pointer;padding:2px 0}
.cedb-dialog-error{font-size:11.5px;color:var(--dsw-alias-state-error-primary,#f85149);overflow-wrap:anywhere}
.ce-wb-hist{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#999);font:inherit;font-size:11.5px;padding:2px 8px;border-radius:5px;cursor:pointer}
.ce-wb-hist:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b);color:var(--dsw-alias-label-primary,#eee)}
.ce-wb-drawer{flex:none;max-height:46%;display:flex;flex-direction:column;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#1d2126)}
.ce-wb-drawer-head{display:flex;align-items:center;gap:8px;padding:6px 8px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#999)}
.ce-wb-drawer-hint{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#778);font-size:11px}
.ce-wb-drawer-list{min-height:0;overflow:auto;padding:0 4px 4px}
.ce-wb-drawer-empty{padding:10px 12px;font-size:12px;color:var(--dsw-alias-label-tertiary,#778)}
.cea-hist-item{display:flex;align-items:center;gap:4px}
.cea-hist-item .cea-hist-row{flex:1 1 auto;min-width:0}
.cea-hist-del{opacity:0}
.cea-hist-item:hover .cea-hist-del,.cea-hist-del:focus-visible{opacity:1}
.ce-wb-drawer-item{display:flex;align-items:center;gap:4px}
.ce-wb-drawer-item .ce-wb-drawer-row{flex:1 1 auto;min-width:0}
.ce-wb-drawer-del{opacity:0}
.ce-wb-drawer-item:hover .ce-wb-drawer-del,.ce-wb-drawer-del:focus-visible{opacity:1}
.ce-wb-drawer-row{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;text-align:left;padding:4px 6px;border-radius:5px;cursor:pointer}
.ce-wb-drawer-row:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-wb-proto{flex:none;font-size:9.5px;font-weight:700;letter-spacing:.04em;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover,#2b3038);color:var(--dsw-alias-label-secondary,#aaa)}
.ce-wb-proto-grpc{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 22%,transparent);color:var(--dsw-alias-brand-primary,#8ccfff)}
.ce-wb-drawer-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px}
.ce-wb-drawer-ms{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,#889)}
.cerpc-hist{margin:0 8px 8px}
.cerpc-title{display:inline-flex;align-items:center;gap:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px}
`;

// src/client/register.js
var definition = (t) => ({
  id: TAB_ID,
  kind: TAB_KIND,
  priority: "extension",
  keepMounted: true,
  title: () => t("type.label"),
  guide: []
});
var skillsDefinition = (t) => ({
  id: SKILLS_TAB_ID,
  kind: SKILLS_TAB_KIND,
  priority: "extension",
  keepMounted: true,
  title: () => t("skillsTab.label"),
  guide: []
});
var apiDefinition = (t) => ({
  id: API_TAB_ID,
  kind: API_TAB_KIND,
  priority: "extension",
  keepMounted: true,
  title: () => t("workbench.title"),
  guide: []
});
var dbDefinition = (t) => ({
  id: DB_TAB_ID,
  kind: DB_TAB_KIND,
  priority: "extension",
  keepMounted: true,
  title: () => t("db.label"),
  guide: []
});
var rpcDefinition = (t) => ({
  id: RPC_TAB_ID,
  kind: RPC_TAB_KIND,
  priority: "extension",
  keepMounted: true,
  title: () => t("rpc.label"),
  guide: []
});
function insertStyles() {
  const id = `${TAB_ID}/styles`;
  if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(id)}]`) === null) {
    const tag = document.createElement("style");
    tag.dataset.plugin = TAB_ID;
    tag.dataset.pluginCss = id;
    tag.textContent = CSS2;
    document.head.appendChild(tag);
    return () => tag.remove();
  }
  return () => {
  };
}

// src/client/calldiff.js
var str = (value) => typeof value === "string" ? value : "";
function parseHunks(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const hunks = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.path !== "string" || item.path === "") continue;
    if (typeof item.oldText !== "string" && typeof item.newText !== "string") continue;
    hunks.push({ path: item.path, oldText: str(item.oldText), newText: str(item.newText) });
  }
  return hunks.length > 0 ? hunks : null;
}
function lines(text) {
  return text === "" ? [] : text.split("\n");
}
function intendedHunk(call) {
  const args = call && call.args || {};
  const path = str(args.file_path);
  if (path === "") return null;
  if (/write/i.test(str(call && call.name))) return { path, oldText: "", newText: str(args.content) };
  return { path, oldText: str(args.old_string), newText: str(args.new_string) };
}
function hunksFromBlock(block) {
  if (!block || typeof block !== "object") return null;
  if (!("kind" in block)) {
    const intended = intendedHunk(block);
    return intended === null ? null : [intended];
  }
  const call = block.call && typeof block.call === "object" ? block.call : null;
  if (!block.isError) {
    const meta = block.meta;
    const fromMeta = meta && typeof meta === "object" ? parseHunks(meta.diffs) : null;
    if (fromMeta !== null) return fromMeta;
    for (const view of [block.resultView, block.callView]) {
      if (view && view.card === "diff") {
        const fromView = parseHunks(view.diffs);
        if (fromView !== null) return fromView;
      }
    }
    if (call && /write/i.test(str(call.name))) {
      const intended = intendedHunk(call);
      if (intended !== null) return [intended];
    }
    return null;
  }
  const attempted = call ? intendedHunk(call) : null;
  return attempted === null ? null : [attempted];
}
function unifiedFromHunks(hunks) {
  const files = [];
  const byPath2 = /* @__PURE__ */ new Map();
  for (const hunk of hunks) {
    let list = byPath2.get(hunk.path);
    if (list === void 0) {
      list = [];
      byPath2.set(hunk.path, list);
      files.push(hunk.path);
    }
    list.push(hunk);
  }
  let add = 0;
  let del = 0;
  const out = [];
  for (const path of files) {
    out.push(`--- a/${path}`, `+++ b/${path}`);
    for (const hunk of byPath2.get(path)) {
      out.push("@@");
      for (const line of lines(hunk.oldText)) {
        out.push(`-${line}`);
        del++;
      }
      for (const line of lines(hunk.newText)) {
        out.push(`+${line}`);
        add++;
      }
    }
  }
  return { text: out.join("\n"), stats: { add, del }, files };
}
function relativePath(path, cwd, home) {
  if (cwd && path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
  if (home && path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;
  return path;
}
function summarize(block) {
  const settled = Boolean(block && typeof block === "object" && "kind" in block);
  const hunks = hunksFromBlock(block);
  const call = block && typeof block === "object" ? settled ? block.call : block : null;
  const argsPath = str(call && call.args && call.args.file_path);
  const path = hunks && hunks[0].path || argsPath;
  const stats = hunks ? unifiedFromHunks(hunks).stats : { add: 0, del: 0 };
  return {
    hunks,
    path,
    add: stats.add,
    del: stats.del,
    settled,
    failed: Boolean(block && block.isError)
  };
}
function CallDiffRow(props) {
  const block = props ? props.block : null;
  const toolName = str(props && props.toolName);
  const info = useMemo(() => summarize(block), [block]);
  const t = props && props.t || ((key) => key);
  const label = /write/i.test(toolName) ? t("toolrow.write") : t("toolrow.edit");
  const display = info.path ? relativePath(info.path, props ? props.cwd : void 0, props ? props.home : void 0) : "";
  if (!info.settled) {
    return h(
      "div",
      { className: "ce-calrow ce-calrow-run" },
      h("span", { className: "ce-cal-label" }, label),
      h("span", { className: "ce-cal-path" }, display || t("toolrow.nopath")),
      h("span", { className: "ce-cal-hint ce-cal-hint-on" }, t("toolrow.running"))
    );
  }
  const clickable = info.hunks !== null && info.hunks.length > 0 && typeof props.openCallDiff === "function";
  const onClick = (event) => {
    if (!clickable) return;
    const { text, stats, files } = unifiedFromHunks(info.hunks);
    props.openCallDiff({
      path: files.length > 1 ? `${files.length} · ${display}` : display,
      text,
      stats,
      gutter: false
    }, event.currentTarget);
  };
  return h(
    "button",
    {
      type: "button",
      className: `ce-calrow${info.failed ? " ce-calrow-fail" : ""}`,
      title: clickable ? t("toolrow.hint") : void 0,
      disabled: !clickable,
      onClick
    },
    h("span", { className: "ce-cal-label" }, label),
    h("span", { className: "ce-cal-path", title: info.path }, display || t("toolrow.nopath")),
    info.failed ? h("span", { className: "ce-chip" }, t("toolrow.failed")) : null,
    h("span", { className: "ce-cal-stats" }, `+${info.add} −${info.del}`),
    h("span", { className: "ce-cal-hint" }, t("toolrow.hint"))
  );
}

// src/client/skills.js
function skillScope(source) {
  return String(source ?? "").startsWith("project") ? "project" : String(source ?? "").startsWith("user") ? "user" : "provided";
}
function SkillsView({ cwd, t, say, visible, sessionId }) {
  const [skills, setSkills] = useState(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [listing, setListing] = useState(false);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [newName, setNewName] = useState("");
  const [scope, setScope] = useState("user");
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useDismissLayer({ open: createOpen, onDismiss: () => setCreateOpen(false), ignoreSelector: '[data-ce-popup-trigger="skill-create"]' });
  const deleteRef = useDismissLayer({ open: confirmDel, onDismiss: () => setConfirmDel(false), ignoreSelector: '[data-ce-popup-trigger="skill-delete"]' });
  useEffect(() => {
    if (visible === false) {
      setCreateOpen(false);
      setConfirmDel(false);
    }
  }, [visible]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editMode, setEditMode] = useState(false);
  const [rawPreview, setRawPreview] = useState(false);
  const [contentTruncated, setContentTruncated] = useState(false);
  const readSeq = useRef(0);
  const listSeq = useRef(0);
  const readonly = sel !== null && skillScope(sel.source) === "provided";
  const dirty = content !== savedContent;
  useToolCloseGuard({ sessionId, kind: SKILLS_TAB_KIND, dirty, onBlocked: () => say(t("editor.dirtyGuard"), "error") });
  const sourceLabel = (source) => t(`skills.scope.${skillScope(source)}`);
  const load = useCallback(() => {
    const seq = ++listSeq.current;
    setListing(true);
    api("skills.list", { cwd }).then((res) => {
      if (seq !== listSeq.current) return;
      setListing(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError("");
      setSkills(res.value.skills ?? []);
    });
  }, [cwd]);
  useEffect(() => {
    setSkills(null);
    setError("");
    setSel(null);
    setContent("");
    setSavedContent("");
    setEditMode(false);
    setReading(false);
    setReadError("");
    setBusy(false);
    load();
    return () => {
      ++listSeq.current;
      ++readSeq.current;
    };
  }, [load]);
  const canLeave = () => {
    if (!dirty) return true;
    say(t("editor.dirtyGuard"), "error");
    return false;
  };
  const open = (skill) => {
    if (!canLeave()) return;
    const seq = ++readSeq.current;
    setSel(skill);
    setConfirmDel(false);
    setEditMode(false);
    setRawPreview(false);
    setContent("");
    setSavedContent("");
    setContentTruncated(false);
    setReadError("");
    if (!skill.path) {
      setReading(false);
      return;
    }
    setReading(true);
    api("skills.read", { cwd, path: skill.path }).then((res) => {
      if (seq !== readSeq.current) return;
      setReading(false);
      if (!res.ok) {
        setReadError(res.error);
        return;
      }
      setContent(res.value.content);
      setSavedContent(res.value.content);
      setContentTruncated(res.value.truncated === true);
    });
  };
  const save = () => {
    if (!sel || !editMode || readonly || reading || readError || contentTruncated || !dirty || busy) return;
    const seq = readSeq.current;
    setBusy(true);
    api("skills.write", { cwd, path: sel.path, content }).then((res) => {
      if (seq !== readSeq.current) return;
      setBusy(false);
      if (!res.ok) {
        say(`${t("error")}: ${res.error}`, "error");
        return;
      }
      setSavedContent(content);
      setEditMode(false);
      say(t("skills.saved"));
      load();
    });
  };
  const remove = () => {
    if (!sel || readonly || busy || !confirmDel) return;
    const seq = readSeq.current;
    setBusy(true);
    api("skills.delete", { cwd, path: sel.path }).then((res) => {
      if (seq !== readSeq.current) return;
      setBusy(false);
      if (!res.ok) {
        say(`${t("error")}: ${res.error}`, "error");
        return;
      }
      ++readSeq.current;
      setSel(null);
      setContent("");
      setSavedContent("");
      setConfirmDel(false);
      say(t("skills.deleted"));
      load();
    });
  };
  const validName = /^[a-z0-9][a-z0-9._-]{0,63}$/.test(newName.trim());
  const create = () => {
    if (!validName || busy || !canLeave()) return;
    const seq = readSeq.current;
    setBusy(true);
    api("skills.create", { cwd, name: newName.trim(), scope }).then((res) => {
      if (seq !== readSeq.current) return;
      setBusy(false);
      if (!res.ok) {
        say(`${t("error")}: ${res.error}`, "error");
        return;
      }
      setNewName("");
      setCreateOpen(false);
      setQuery("");
      setFilter("all");
      load();
      if (res.value.skill) open(res.value.skill);
    });
  };
  const onKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      save();
    }
  };
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ["project", "user", "provided"].map((group) => ({
      source: group,
      items: (skills ?? []).filter((skill) => skillScope(skill.source) === group && (filter === "all" || filter === group) && (!q || [skill.name, skill.description, skill.path, skill.provider].some((s) => String(s ?? "").toLowerCase().includes(q))))
    })).filter((group) => group.items.length > 0);
  }, [skills, query, filter]);
  const visibleCount = grouped.reduce((sum, group) => sum + group.items.length, 0);
  const back = () => {
    if (canLeave()) {
      ++readSeq.current;
      setReading(false);
      setSel(null);
      setReadError("");
    }
  };
  const cancelEdit = () => {
    setContent(savedContent);
    setEditMode(false);
  };
  return h(
    "div",
    { className: `ce-sk-root${sel ? " ce-sk-has-selection" : ""}` },
    h(
      "header",
      { className: "ce-sk-top" },
      h(
        "div",
        { className: "ce-sk-heading" },
        h("h2", null, t("skills.manager")),
        h("span", { className: "ce-sk-total" }, skills === null ? "…" : t("skills.total", { n: skills.length }))
      ),
      h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("skills.refresh"), "aria-label": t("skills.refresh"), disabled: listing || busy, onClick: load }, "⟳"),
      h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", "aria-expanded": createOpen, "data-ce-popup-trigger": "skill-create", disabled: busy, onClick: () => {
        if (canLeave()) {
          setConfirmDel(false);
          setCreateOpen((v) => !v);
        }
      } }, `+ ${t("skills.new")}`)
    ),
    createOpen ? h(
      "div",
      { className: "ce-sk-create", ref: createRef },
      h("input", {
        className: "ce-input ce-sk-name-input",
        "aria-label": t("skills.createPlaceholder"),
        placeholder: t("skills.createPlaceholder"),
        value: newName,
        disabled: busy,
        autoFocus: true,
        onChange: (e) => setNewName(e.target.value),
        onKeyDown: (e) => {
          e.stopPropagation();
          if (e.key === "Enter") create();
          if (e.key === "Escape") setCreateOpen(false);
        }
      }),
      h(
        "select",
        { className: "ce-sk-scope", "aria-label": t("skills.scopeTitle"), value: scope, disabled: busy, onChange: (e) => setScope(e.target.value) },
        h("option", { value: "user" }, t("skills.user")),
        h("option", { value: "project" }, t("skills.project"))
      ),
      h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", disabled: busy || !validName, onClick: create }, busy ? "…" : t("skills.createAction")),
      h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: busy, onClick: () => setCreateOpen(false) }, t("skills.cancel")),
      newName.trim() && !validName ? h("span", { className: "ce-sk-name-hint", role: "status" }, t("skills.nameHint")) : null
    ) : null,
    h(
      "div",
      { className: "ce-sk-workspace" },
      h(
        "aside",
        { className: "ce-sk-list", "aria-label": t("skills.title") },
        h(
          "div",
          { className: "ce-sk-searchbar" },
          h("input", { className: "ce-input", type: "search", "aria-label": t("skills.search"), placeholder: t("skills.search"), value: query, onChange: (e) => setQuery(e.target.value) }),
          h(
            "select",
            { className: "ce-sk-scope", "aria-label": t("skills.filter"), value: filter, onChange: (e) => setFilter(e.target.value) },
            ["all", "project", "user", "provided"].map((id) => h("option", { key: id, value: id }, t(`skills.scope.${id}`)))
          )
        ),
        h(
          "div",
          { className: "ce-sk-results ce-scroll", "aria-busy": listing },
          error ? h("div", { className: "ce-sk-feedback", role: "alert" }, error) : null,
          skills === null && !error ? h("div", { className: "ce-sk-feedback", role: "status" }, t("loading")) : null,
          skills !== null && visibleCount === 0 ? h("div", { className: "ce-sk-feedback" }, t(skills.length === 0 ? "skills.empty" : "skills.noMatch")) : null,
          grouped.map((group) => h(
            "section",
            { key: group.source },
            h("h3", { className: "ce-sk-section" }, h("span", null, t(`skills.scope.${group.source}`)), h("span", null, String(group.items.length))),
            group.items.map((skill) => h(
              "button",
              {
                key: skill.path || skill.name,
                type: "button",
                disabled: busy,
                className: `ce-sk-row${sel && (sel.path ? sel.path === skill.path : sel.name === skill.name) ? " ce-sk-row-on" : ""}`,
                "aria-pressed": Boolean(sel && (sel.path ? sel.path === skill.path : sel.name === skill.name)),
                onClick: () => open(skill),
                title: skill.description || skill.name
              },
              h("span", { className: "ce-sk-row-name" }, skill.name),
              h("span", { className: "ce-sk-row-desc" }, skill.description || t("skills.noDesc"))
            ))
          ))
        )
      ),
      h(
        "section",
        { className: "ce-sk-edit", "aria-label": sel?.name ?? t("skills.pick") },
        !sel ? h(
          "div",
          { className: "ce-sk-welcome" },
          h(SkillsGlyph),
          h("h3", null, t("skills.welcome")),
          h("p", null, t("skills.pick")),
          h("p", { className: "ce-sk-welcome-note" }, t("skills.scopeHint"))
        ) : h(
          Fragment,
          null,
          h(
            "header",
            { className: "ce-sk-detail-head" },
            h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost ce-sk-back", onClick: back, disabled: busy }, `← ${t("skills.backList")}`),
            h("h3", { className: "ce-sk-detail-title" }, sel.name),
            h(
              "div",
              { className: "ce-sk-meta" },
              h("span", null, sourceLabel(sel.source)),
              readonly ? h("span", { className: "ce-chip" }, t("skills.readonly")) : null,
              contentTruncated ? h("span", { className: "ce-chip ce-chip-warn" }, t("skills.truncatedChip")) : null,
              dirty ? h("span", { className: "ce-chip ce-chip-warn" }, t("skills.dirty")) : null
            ),
            h(
              "details",
              { className: "ce-sk-install-details", key: sel.path || sel.name },
              h("summary", null, t("skills.details")),
              sel.description ? h("p", { className: "ce-sk-detail-desc" }, sel.description) : null,
              sel.dir || sel.path ? h("button", { type: "button", className: "ce-sk-path", title: t("skills.copyPath"), onClick: async () => {
                try {
                  await navigator.clipboard.writeText(sel.dir ?? sel.path);
                  say(t("skills.pathCopied"));
                } catch {
                  say(t("skills.copyFailed"), "error");
                }
              } }, sel.dir || sel.path) : null
            )
          ),
          h(
            "div",
            { className: "ce-sk-detail-tools" },
            editMode ? h("span", { className: "ce-sk-edit-label" }, t("skills.editing")) : h(
              "div",
              { className: "ce-sk-view-switch" },
              h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${!rawPreview ? " ce-sk-view-on" : ""}`, "aria-pressed": !rawPreview, onClick: () => setRawPreview(false) }, t("skills.preview")),
              h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${rawPreview ? " ce-sk-view-on" : ""}`, "aria-pressed": rawPreview, onClick: () => setRawPreview(true) }, t("skills.source"))
            ),
            !readonly && !reading && !readError && !contentTruncated ? editMode ? h(
              Fragment,
              null,
              h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: busy, onClick: cancelEdit }, t("editor.cancel")),
              h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", disabled: !dirty || busy, title: "⌘S / Ctrl+S", onClick: save }, t("editor.save"))
            ) : h("button", { type: "button", className: "ce-sk-btn", disabled: busy, onClick: () => setEditMode(true) }, t("editor.edit")) : null,
            !readonly && !editMode ? h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: busy, "data-ce-popup-trigger": "skill-delete", "aria-expanded": confirmDel, onClick: () => {
              setCreateOpen(false);
              setConfirmDel((v) => !v);
            } }, t("skills.delete")) : null
          ),
          confirmDel ? h(
            "div",
            { className: "ce-sk-delete-confirm", ref: deleteRef, role: "alert" },
            h("span", null, t("skills.deleteQuestion", { name: sel.name })),
            h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-danger", disabled: busy, onClick: remove }, t("skills.deleteConfirm")),
            h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: busy, onClick: () => setConfirmDel(false) }, t("skills.cancel"))
          ) : null,
          reading ? h("div", { className: "ce-sk-feedback", role: "status" }, t("loading")) : readError ? h(
            "div",
            { className: "ce-sk-feedback", role: "alert" },
            readError,
            h("button", { type: "button", className: "ce-sk-btn", onClick: () => open(sel) }, t("skills.retry"))
          ) : editMode ? h("textarea", { className: "ce-sk-ta", "aria-label": sel.name, value: content, disabled: busy, spellcheck: false, onChange: (e) => setContent(e.target.value), onKeyDown }) : rawPreview ? h("pre", { className: "ce-sk-source ce-scroll" }, content) : h(MarkdownView, { text: content })
        )
      )
    )
  );
}
var SkillsGlyph = () => h(
  "svg",
  { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } },
  h("path", { d: "M8 2 3 4.5v7L8 14l5-2.5v-7L8 2Z" }),
  h("path", { d: "M8 2v12M3 4.5 8 7l5-2.5" })
);
function SkillsTabBody({ sessionId, useSessions, useTabInfo, t }) {
  const hostTab = useTabInfo ? useTabInfo()?.tab : null;
  const cwd = useSessions ? useSessions((sessions) => sessionId ? sessions.byId[sessionId]?.cwd : void 0) : void 0;
  const [note, setNote] = useState(null);
  const timerRef = useRef(null);
  const say = useCallback((text, kind = "info") => {
    setNote({ text, kind });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (kind !== "error") timerRef.current = setTimeout(() => setNote({ text: "", kind: "info" }), 3800);
  }, []);
  if (!cwd) return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
  return h(
    "div",
    { className: "ce-root" },
    note && note.text ? h("div", { className: "ce-banner" }, h("span", { className: "ce-banner-text" }, note.text)) : null,
    h(SkillsView, { cwd, t, say, sessionId, visible: hostTab?.visible })
  );
}
function SkillsTitle({ useTabInfo }) {
  const tabInfo = useTabInfo ? useTabInfo() : null;
  return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(SkillsGlyph)), tabInfo?.tab?.title ?? "Skills");
}

// src/client/curl.js
var SUB_CT = { json: "application/json", text: "text/plain", html: "text/html", xml: "application/xml" };
var SHORT_VALUE_FLAGS = "dHXuAebFTomxcwK";
var VALUE_FLAGS = /* @__PURE__ */ new Set([
  "-o",
  "--output",
  "--max-time",
  "-m",
  "--retry",
  "--connect-timeout",
  "-w",
  "--write-out",
  "--resolve",
  "--cacert",
  "--cert",
  "--key",
  "--proxy",
  "-x",
  "-c",
  "--cookie-jar",
  "-T",
  "--upload-file",
  "--retry-delay",
  "--retry-max-time",
  "--limit-rate",
  "--compressed-ssh",
  "-K",
  "--config",
  "--proto",
  "--max-redirs",
  "--ciphers",
  "--max-filesize"
]);
var ANSI_C_ESCAPES = { n: "\n", t: "	", r: "\r", a: "\x07", b: "\b", f: "\f", v: "\v", e: "\x1B", "\\": "\\", "'": "'", '"': '"' };
function tokenizeCurl(input) {
  const joined = String(input ?? "").trim();
  const tokens = [];
  let cur = "";
  let quote = null;
  let started = false;
  const continuationLen = (i) => {
    if (joined[i] !== "\\") return 0;
    if (joined[i + 1] === "\n") return 2;
    if (joined[i + 1] === "\r" && joined[i + 2] === "\n") return 3;
    return 0;
  };
  for (let i = 0; i < joined.length; i++) {
    const ch = joined[i];
    if (quote !== null) {
      if (ch === "\\" && quote !== "'") {
        const cont2 = continuationLen(i);
        if (cont2 > 0) {
          i += cont2 - 1;
          continue;
        }
        if (quote === "$'") {
          const esc = joined[i + 1];
          if (esc === "x") {
            const hex = joined.slice(i + 2, i + 4);
            if (/^[0-9a-fA-F]{1,2}$/.test(hex)) {
              const digits = /^[0-9a-fA-F]{2}$/.test(hex) ? 2 : 1;
              cur += String.fromCharCode(parseInt(hex.slice(0, digits), 16));
              i += 1 + digits;
              continue;
            }
          }
          if (esc !== void 0 && esc in ANSI_C_ESCAPES) {
            cur += ANSI_C_ESCAPES[esc];
            i += 1;
            continue;
          }
          if (i + 1 < joined.length) cur += joined[++i];
          continue;
        }
        if (i + 1 < joined.length) {
          cur += joined[++i];
          continue;
        }
        continue;
      }
      if (ch === quote[quote.length - 1]) {
        quote = null;
        continue;
      }
      cur += ch;
      continue;
    }
    const cont = continuationLen(i);
    if (cont > 0) {
      i += cont - 1;
      continue;
    }
    if (ch === "$" && joined[i + 1] === "'") {
      quote = "$'";
      started = true;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
      continue;
    }
    if (ch === "\\" && i + 1 < joined.length) {
      cur += joined[++i];
      started = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (started || cur !== "") {
        tokens.push(cur);
        cur = "";
        started = false;
      }
      continue;
    }
    cur += ch;
    started = true;
  }
  if (cur !== "" || started) tokens.push(cur);
  if (tokens.length > 0 && /^curl$/i.test(tokens[0])) tokens.shift();
  return tokens;
}
var ATTACHED_SHORT_RE = new RegExp(`^-([${SHORT_VALUE_FLAGS}])(.+)$`, "s");
var ATTACHED_LONG_RE = /^--([A-Za-z0-9-]+)=([\s\S]*)$/;
function expandShortFlags(tokens) {
  const out = [];
  for (const token of tokens) {
    const short = ATTACHED_SHORT_RE.exec(token);
    if (short) {
      out.push(`-${short[1]}`, short[2]);
      continue;
    }
    const long = ATTACHED_LONG_RE.exec(token);
    if (long) out.push(`--${long[1]}`, long[2]);
    else out.push(token);
  }
  return out;
}
function decodeFormBody(joined) {
  const pairs = [];
  for (const [name, value] of new URLSearchParams(joined)) pairs.push({ name, value });
  return pairs;
}
function parseCurl(input) {
  const tokens = expandShortFlags(tokenizeCurl(input));
  let method = "";
  let url = "";
  let body = "";
  let hasBody = false;
  let asQuery = false;
  let userPass = null;
  let hasJson = false;
  const headers = [];
  const form = [];
  const dataChunks = [];
  const urlQueries = [];
  const setHeader = (name, value) => {
    const existing = headers.find((hd) => hd.name.toLowerCase() === name.toLowerCase());
    if (existing) existing.value = value;
    else headers.push({ name, value });
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = () => {
      i += 1;
      return tokens[i] ?? "";
    };
    if (t === "-X" || t === "--request") {
      method = next().toUpperCase();
      continue;
    }
    if (t === "-H" || t === "--header") {
      const hv = next();
      const at = hv.indexOf(":");
      if (at > 0) setHeader(hv.slice(0, at).trim(), hv.slice(at + 1).trim());
      else if (hv.endsWith(";")) setHeader(hv.slice(0, -1).trim(), "");
      continue;
    }
    if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--data-ascii") {
      dataChunks.push(next());
      hasBody = true;
      continue;
    }
    if (t === "--data-urlencode") {
      dataChunks.push(next());
      hasBody = true;
      continue;
    }
    if (t === "--json") {
      dataChunks.push(next());
      hasBody = true;
      hasJson = true;
      setHeader("Content-Type", "application/json");
      continue;
    }
    if (t === "-F" || t === "--form" || t === "--form-string") {
      form.push(next());
      hasBody = true;
      continue;
    }
    if (t === "--url-query") {
      urlQueries.push(next());
      continue;
    }
    if (t === "-u" || t === "--user") {
      userPass = next();
      continue;
    }
    if (t === "-A" || t === "--user-agent") {
      setHeader("User-Agent", next());
      continue;
    }
    if (t === "-e" || t === "--referer") {
      setHeader("Referer", next());
      continue;
    }
    if (t === "-b" || t === "--cookie") {
      setHeader("Cookie", next());
      continue;
    }
    if (t === "-I" || t === "--head") {
      method = "HEAD";
      continue;
    }
    if (t === "-G" || t === "--get") {
      asQuery = true;
      continue;
    }
    if (t === "--url") {
      url = next();
      continue;
    }
    if (t.startsWith("-")) {
      if (VALUE_FLAGS.has(t)) next();
      continue;
    }
    if (url === "") url = t;
  }
  body = dataChunks.join("&");
  if (asQuery && body !== "") {
    url = url + (url.includes("?") ? "&" : "?") + body;
    body = "";
    hasBody = false;
  }
  for (const q of urlQueries) {
    url = url + (url.includes("?") ? "&" : "?") + q;
  }
  let auth;
  const authAt = headers.findIndex((hd) => hd.name.toLowerCase() === "authorization");
  if (authAt >= 0) {
    const value = String(headers[authAt].value ?? "");
    const bearer = /^Bearer\s+(.+)$/i.exec(value);
    const basic = /^Basic\s+\S+$/i.test(value) ? decodeBasicValue(value) : null;
    if (bearer) {
      auth = { mode: "bearer", token: bearer[1].trim() };
      headers.splice(authAt, 1);
    } else if (basic) {
      auth = { mode: "basic", user: basic.user, pass: basic.pass };
      headers.splice(authAt, 1);
    }
  } else if (userPass !== null) {
    const at = userPass.indexOf(":");
    auth = at >= 0 ? { mode: "basic", user: userPass.slice(0, at), pass: userPass.slice(at + 1) } : { mode: "basic", user: userPass, pass: "" };
  }
  let multipart = null;
  let formPairs = null;
  if (form.length > 0) {
    multipart = form.map((f) => {
      const eq = f.indexOf("=");
      return eq > 0 ? { name: f.slice(0, eq), value: f.slice(eq + 1) } : { name: f, value: "" };
    });
    body = "";
  } else if (body !== "") {
    const ct = headers.find((hd) => hd.name.toLowerCase() === "content-type")?.value ?? "";
    const isFormCt = /x-www-form-urlencoded/i.test(ct);
    const looksForm = !hasJson && dataChunks.every((chunk) => /^[^=&]+=/.test(chunk));
    if (isFormCt || !ct && looksForm) {
      formPairs = decodeFormBody(body);
      body = "";
    }
  }
  if (hasBody && method === "") method = "POST";
  if (method === "") method = "GET";
  const result = { method, url, headers, body };
  if (multipart) result.multipart = multipart;
  if (formPairs) result.form = formPairs;
  if (auth) result.auth = auth;
  return result;
}
function decodeBasicValue(value) {
  try {
    const plain = decodeURIComponent(escape(atob(String(value).replace(/^Basic\s+/i, "").trim())));
    const at = plain.indexOf(":");
    if (at < 0) return null;
    return { user: plain.slice(0, at), pass: plain.slice(at + 1) };
  } catch {
    return null;
  }
}
function shellQuote(s) {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}
function toCurl(req) {
  const parts = ["curl"];
  const method = String(req?.method || "GET").toUpperCase();
  const bodyType = req?.bodyType || "none";
  if (method !== "GET" || bodyType !== "none") parts.push(`-X ${method}`);
  parts.push(shellQuote(String(req?.url ?? "")));
  const auth = req?.auth && typeof req.auth === "object" ? req.auth : null;
  if (auth?.mode === "basic" && (String(auth.user ?? "") !== "" || String(auth.pass ?? "") !== "")) {
    parts.push(`-u ${shellQuote(`${auth.user ?? ""}:${auth.pass ?? ""}`)}`);
  }
  let headers = (req?.headers ?? []).filter((hd) => hd?.enabled !== false && String(hd?.name ?? "").trim() !== "");
  if (auth?.mode === "bearer" && String(auth.token ?? "").trim() !== "") {
    headers = [...headers.filter((hd) => String(hd.name).trim().toLowerCase() !== "authorization"), { name: "Authorization", value: `Bearer ${String(auth.token).trim()}` }];
  }
  for (const hd of headers) parts.push(`-H ${shellQuote(`${String(hd.name).trim()}: ${hd.value ?? ""}`)}`);
  const hasCT = headers.some((hd) => String(hd.name).trim().toLowerCase() === "content-type");
  if (bodyType === "raw") {
    if (!hasCT) parts.push(`-H ${shellQuote(`Content-Type: ${SUB_CT[req?.rawSub] ?? "text/plain"}`)}`);
    parts.push(`--data-raw ${shellQuote(req?.body ?? "")}`);
  } else if (bodyType === "form") {
    for (const p of req?.formPairs ?? []) {
      const name = String(p?.name ?? "").trim();
      if (name && p.enabled !== false) parts.push(`--data-urlencode ${shellQuote(`${name}=${p?.value ?? ""}`)}`);
    }
  } else if (bodyType === "multipart") {
    for (const p of req?.formPairs ?? []) {
      const name = String(p?.name ?? "").trim();
      if (name && p.enabled !== false) parts.push(`-F ${shellQuote(`${name}=${p?.value ?? ""}`)}`);
    }
  }
  return parts.length <= 2 ? parts.join(" ") : parts.join(" \\\n  ");
}

// src/client/brucol.js
var BODY_MODES = { json: "json", text: "text", xml: "xml", html: "text", form: "form-urlencoded", multipart: "multipart-form", none: "none" };
var MODE_TO_BODY = { json: ["raw", "json"], text: ["raw", "text"], xml: ["raw", "xml"], "form-urlencoded": ["form", null], "multipart-form": ["multipart", null], none: ["none", null] };
var METHOD_RE = /^(get|post|put|patch|delete|head|options)$/i;
function quoteKey(name) {
  const raw = String(name ?? "");
  if (raw === "" || /[\s":{}~]/.test(raw)) return JSON.stringify(raw);
  return raw;
}
function oneLine(value) {
  return String(value ?? "").replace(/\r?\n/g, " ");
}
function rowsBlock(title, rows) {
  const active = (rows ?? []).filter((r) => r && String(r.name ?? "").trim() !== "");
  if (active.length === 0) return [];
  const lines2 = [`${title} {`];
  for (const r of active) lines2.push(`  ${r.enabled === false ? "~" : ""}${quoteKey(r.name)}: ${oneLine(r.value)}`);
  lines2.push("}");
  return lines2;
}
function bruNameFor(url, method) {
  const noScheme = String(url ?? "").replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const pathPart = noScheme.includes("/") ? noScheme.slice(noScheme.indexOf("/")) : "/";
  const seg = pathPart.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() ?? "";
  const clean = seg.replace(/\.[a-z0-9]+$/i, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (clean !== "") return clean;
  return String(method || "request").toLowerCase();
}
function requestToBru(state) {
  const method = String(state?.method || "GET").toLowerCase();
  const bodyType = state?.bodyType || "none";
  const mode = BODY_MODES[bodyType === "raw" ? state?.rawSub ?? "json" : bodyType] ?? "none";
  const authMode = state?.auth?.mode === "basic" || state?.auth?.mode === "bearer" ? state.auth.mode : "none";
  const queryRows = (state?.paramPairs ?? []).filter((p) => p?.kind !== "path");
  const pathRows = (state?.paramPairs ?? []).filter((p) => p?.kind === "path");
  const lines2 = [
    "meta {",
    `  name: ${oneLine(bruNameFor(state?.url, method))}`,
    "  type: http",
    "}",
    "",
    `${method} {`,
    `  url: ${oneLine(state?.url ?? "")}`,
    `  body: ${mode}`,
    `  auth: ${authMode}`,
    "}"
  ];
  const push = (block) => {
    if (block.length === 0) return;
    lines2.push("", ...block);
  };
  push(rowsBlock("params:query", queryRows));
  push(rowsBlock("params:path", pathRows));
  push(rowsBlock("headers", state?.headers));
  if (authMode === "bearer") push(["", "auth:bearer {", `  token: ${oneLine(state?.auth?.token)}`, "}"]);
  if (authMode === "basic") push(["", "auth:basic {", `  username: ${oneLine(state?.auth?.user)}`, `  password: ${oneLine(state?.auth?.pass)}`, "}"]);
  if (mode === "form-urlencoded" || mode === "multipart-form") {
    push(rowsBlock(`body:${mode}`, state?.formPairs));
  } else if (mode !== "none" && String(state?.body ?? "") !== "") {
    push(["", `body:${mode} {`, String(state.body).split("\n").map((line) => line === "" ? "" : `  ${line}`).join("\n"), "}"]);
  }
  return `${lines2.join("\n")}
`;
}
function looksLikeBru(text) {
  const head = String(text ?? "").trimStart();
  return /^\s*meta\s*\{/m.test(head) || /^\s*(get|post|put|patch|delete|head|options)\s*\{/im.test(head);
}
function parseRow(line) {
  const m = /^(~?)("((?:[^"\\]|\\.)*)"|[^:]+):\s?(.*)$/.exec(line);
  if (!m) return null;
  const enabled = m[1] !== "~";
  const name = m[2].startsWith('"') ? JSON.parse(m[2]) : m[2].trim();
  return { name, value: m[4] ?? "", enabled, description: "", kind: "query" };
}
function parseBru(text) {
  const out = {
    name: "",
    method: "GET",
    url: "",
    headers: [],
    paramPairs: [],
    bodyType: "none",
    rawSub: "json",
    body: "",
    formPairs: [],
    auth: { mode: "none", token: "", user: "", pass: "" }
  };
  const lines2 = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const readBlock = (onLine) => {
    i++;
    for (; i < lines2.length; i++) {
      const line = lines2[i];
      if (line === "}") {
        i++;
        return;
      }
      onLine(line);
    }
  };
  const kv = (line) => {
    const at = line.indexOf(":");
    return at < 0 ? null : [line.slice(0, at).trim(), line.slice(at + 1).trim()];
  };
  for (; i < lines2.length; i++) {
    const line = lines2[i].trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line === "meta {") {
      readBlock((inner) => {
        const pair = kv(inner.trim());
        if (pair?.[0] === "name") out.name = pair[1];
      });
      continue;
    }
    const methodBlock = METHOD_RE.exec(line.replace(/\s*\{$/, ""));
    if (methodBlock && line.endsWith("{")) {
      out.method = methodBlock[1].toUpperCase();
      readBlock((inner) => {
        const pair = kv(inner.trim());
        if (!pair) return;
        if (pair[0] === "url") out.url = pair[1];
        if (pair[0] === "body" && MODE_TO_BODY[pair[1]]) {
          const [bodyType, rawSub] = MODE_TO_BODY[pair[1]];
          out.bodyType = bodyType;
          if (rawSub) out.rawSub = rawSub;
        }
        if (pair[0] === "auth" && (pair[1] === "basic" || pair[1] === "bearer")) out.auth.mode = pair[1];
      });
      continue;
    }
    if (line === "params:query {" || line === "params:path {") {
      const kind = line.startsWith("params:query") ? "query" : "path";
      readBlock((inner) => {
        const row = parseRow(inner.trim());
        if (row) out.paramPairs.push({ ...row, kind });
      });
      continue;
    }
    if (line === "headers {") {
      readBlock((inner) => {
        const row = parseRow(inner.trim());
        if (row) out.headers.push({ name: row.name, value: row.value, enabled: row.enabled, description: "" });
      });
      continue;
    }
    if (line === "auth:bearer {") {
      readBlock((inner) => {
        const pair = kv(inner.trim());
        if (pair?.[0] === "token") {
          out.auth.mode = "bearer";
          out.auth.token = pair[1];
        }
      });
      continue;
    }
    if (line === "auth:basic {") {
      readBlock((inner) => {
        const pair = kv(inner.trim());
        if (pair?.[0] === "username") {
          out.auth.mode = "basic";
          out.auth.user = pair[1];
        }
        if (pair?.[0] === "password") {
          out.auth.mode = "basic";
          out.auth.pass = pair[1];
        }
      });
      continue;
    }
    const bodyBlock = /^body:([\w-]+)\s*\{$/.exec(line);
    if (bodyBlock) {
      const mode = bodyBlock[1];
      const raw = [];
      readBlock((inner) => {
        if (MODE_TO_BODY[mode]) raw.push(inner);
      });
      if (!MODE_TO_BODY[mode]) continue;
      const [bodyType, rawSub] = MODE_TO_BODY[mode];
      if (bodyType === "raw") {
        out.bodyType = "raw";
        if (rawSub) out.rawSub = rawSub;
        out.body = raw.map((line2) => line2.startsWith("  ") ? line2.slice(2) : line2).join("\n");
      } else if (bodyType === "form" || bodyType === "multipart") {
        out.bodyType = bodyType;
        for (const inner of raw) {
          const row = parseRow(inner.trim());
          if (row) out.formPairs.push({ name: row.name, value: row.value, enabled: row.enabled, description: "" });
        }
      }
      continue;
    }
    if (line.endsWith("{")) {
      readBlock(() => {
      });
    }
  }
  return out;
}

// src/client/openimp.js
var METHODS = ["get", "put", "post", "patch", "delete", "options", "head", "trace"];
function sampleFromSchema(schema, depth = 0) {
  if (!schema || typeof schema !== "object" || depth > 3) return {};
  if (schema.example !== void 0) return schema.example;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  switch (schema.type) {
    case "string":
      return "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [sampleFromSchema(schema.items, depth + 1)];
    case "object": {
      const out = {};
      for (const [key, sub] of Object.entries(schema.properties ?? {})) out[key] = sampleFromSchema(sub, depth + 1);
      return out;
    }
    default:
      return {};
  }
}
function firstServer(doc) {
  const s = Array.isArray(doc.servers) ? doc.servers[0]?.url : void 0;
  return typeof s === "string" ? s.replace(/\/+$/, "") : "";
}
function openApiRequest(path, method, op, doc) {
  const url = `${firstServer(doc)}${path}`.replace(/[?&]$/, "");
  const urlOut = url.replace(/\{([^/}]+)\}/g, ":$1");
  const query = [];
  const pathParams = [];
  for (const p of Array.isArray(op?.parameters) ? op.parameters : []) {
    if (!p || typeof p.name !== "string") continue;
    const value = p.example ?? p.schema?.example ?? "";
    if (p.in === "query") query.push({ name: p.name, value: String(value), enabled: true });
    else if (p.in === "path") pathParams.push({ name: p.name, kind: "path", value: String(value), enabled: true });
  }
  const headers = [];
  let bodyType = "none";
  let rawSub = "json";
  let body = "";
  const content = op?.requestBody?.content;
  if (content && typeof content === "object") {
    const types = Object.keys(content);
    const jsonType = types.find((c) => c.includes("json"));
    const formType = types.find((c) => c.includes("form-urlencoded"));
    if (jsonType) {
      bodyType = "raw";
      rawSub = "json";
      const c = content[jsonType];
      const example = c?.example ?? c?.examples?.[Object.keys(c?.examples ?? {})[0]]?.value;
      body = JSON.stringify(example ?? sampleFromSchema(c?.schema) ?? {}, null, 2);
      headers.push({ name: "Content-Type", value: jsonType, enabled: true });
    } else if (formType) {
      bodyType = "form";
      const formPairs = [];
      const props = content[formType]?.schema?.properties ?? {};
      for (const [key, sub] of Object.entries(props)) formPairs.push({ name: key, value: String(sub?.example ?? sampleFromSchema(sub) ?? ""), enabled: true });
      body = JSON.stringify(formPairs);
      headers.push({ name: "Content-Type", value: "application/x-www-form-urlencoded", enabled: true });
    }
  }
  const name = op?.summary ?? op?.operationId ?? `${method.toUpperCase()} ${path}`;
  return { method: method.toUpperCase(), url: urlOut, headers, bodyType, rawSub, body, paramPairs: [...query, ...pathParams], name: String(name) };
}
function parseOpenApi(doc) {
  if (!doc || typeof doc !== "object" || typeof doc.openapi !== "string") return null;
  const out = [];
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!item || typeof item !== "object") continue;
    for (const [method, op] of Object.entries(item)) {
      if (!METHODS.includes(method.toLowerCase()) || op === null || typeof op !== "object") continue;
      out.push(openApiRequest(path, method.toLowerCase(), op, doc));
    }
  }
  if (out.length === 0) return { requests: [], error: "no operations found" };
  return { requests: out };
}
function postmanUrl(raw) {
  if (typeof raw === "string") return { url: raw, query: [] };
  if (raw && typeof raw === "object") {
    const query = (Array.isArray(raw.query) ? raw.query : []).filter((p) => p && typeof p.key === "string").map((p) => ({ name: p.key, value: String(p.value ?? ""), enabled: p.disabled !== true }));
    return { url: typeof raw.raw === "string" ? raw.raw : "", query };
  }
  return { url: "", query: [] };
}
function postmanItem(item, out) {
  if (!item || typeof item !== "object") return;
  if (Array.isArray(item.item)) {
    for (const sub of item.item) postmanItem(sub, out);
    return;
  }
  const req = item.request;
  if (!req || typeof req !== "object" || typeof req.method !== "string") return;
  const { url, query } = postmanUrl(req.url);
  const headers = (Array.isArray(req.header) ? req.header : []).filter((hd) => hd && typeof hd.key === "string").map((hd) => ({ name: hd.key, value: String(hd.value ?? ""), enabled: hd.disabled !== true }));
  let bodyType = "none";
  let rawSub = "json";
  let body = "";
  const b = req.body;
  if (b && typeof b === "object") {
    if (b.mode === "urlencoded" && Array.isArray(b.urlencoded)) {
      bodyType = "form";
      body = JSON.stringify(b.urlencoded.filter((p) => p && typeof p.key === "string").map((p) => ({ name: p.key, value: String(p.value ?? ""), enabled: p.disabled !== true })));
    } else if (b.mode === "formdata" && Array.isArray(b.formdata)) {
      bodyType = "multipart";
      body = JSON.stringify(b.formdata.filter((p) => p && typeof p.key === "string" && p.type !== "file").map((p) => ({ name: p.key, value: String(p.src ?? p.value ?? ""), enabled: p.disabled !== true })));
    } else if (typeof b.raw === "string") {
      bodyType = "raw";
      rawSub = b.options?.raw?.language ?? (/^\s*[{[]/.test(b.raw) ? "json" : "text");
      body = b.raw;
    }
  }
  out.push({ method: req.method.toUpperCase(), url, headers, bodyType, rawSub, body, paramPairs: query, name: String(item.name ?? req.method.toUpperCase()) });
}
function parsePostman(doc) {
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.item)) return null;
  if (typeof doc.info?.schema === "string" && !/collection/.test(doc.info.schema)) return null;
  const requests = [];
  for (const item of doc.item) postmanItem(item, requests);
  if (requests.length === 0) return { requests: [], error: "no requests found" };
  return { requests };
}
function detectCollectionImport(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed.startsWith("{")) return null;
  let doc;
  try {
    doc = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof doc?.openapi === "string") return parseOpenApi(doc);
  if (Array.isArray(doc?.item)) return parsePostman(doc);
  return null;
}

// src/client/sse.js
function parseSse(state, text) {
  const buf = state.buf + text;
  const events = [];
  let rest = buf;
  for (; ; ) {
    const idx = rest.search(/\r?\n\r?\n/);
    if (idx === -1) break;
    const frame = rest.slice(0, idx);
    const skip = rest.slice(idx).match(/^\r?\n\r?\n/)?.[0]?.length ?? 2;
    rest = rest.slice(idx + skip);
    let event = "message";
    let id = state.lastId;
    let retry;
    const dataLines = [];
    for (const rawLine of frame.split(/\r?\n/)) {
      const line = rawLine;
      if (line === "" || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "data") dataLines.push(value);
      else if (field === "event") event = value;
      else if (field === "id") id = value;
      else if (field === "retry" && /^\d+$/.test(value)) retry = Number(value);
    }
    if (dataLines.length === 0 && event === "message" && retry === void 0) continue;
    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join("\n"), id, retry });
    } else {
      events.push({ event, data: "", id, retry });
    }
    state.lastId = id;
  }
  return { events, state: { buf: rest, lastId: state.lastId } };
}
function emptySseState() {
  return { buf: "", lastId: "" };
}
function foldStream(state, snap) {
  const raw = snap.reset ? "" : state.raw;
  const texts = (snap.chunks ?? []).map((c) => c.text ?? "");
  const nextRaw = (snap.reset ? "" : raw) + texts.join("");
  const parsed = parseSse(snap.reset ? emptySseState() : state.sse ?? emptySseState(), texts.join(""));
  const events = snap.reset ? parsed.events : [...state.events, ...parsed.events];
  return {
    raw: nextRaw,
    sse: parsed.state,
    events: events.slice(-2e3),
    seq: snap.seq,
    baseSeq: snap.baseSeq ?? 0,
    done: snap.done === true,
    error: snap.error ?? "",
    dropped: snap.dropped === true
  };
}
function sseEventLabel(ev) {
  const first = String(ev.data ?? "").split("\n")[0];
  return first.length > 120 ? `${first.slice(0, 119)}…` : first;
}

// src/client/codegen.js
function resolvedToCurlRequest(resolved) {
  const req = {
    method: resolved?.method ?? "GET",
    url: resolved?.url ?? "",
    headers: resolved?.headers ?? [],
    bodyType: "none"
  };
  if (Array.isArray(resolved?.multipart)) {
    req.bodyType = "multipart";
    req.formPairs = resolved.multipart.map((f) => ({ name: f.name, value: f.value, enabled: true }));
  } else if (typeof resolved?.body === "string") {
    req.bodyType = "raw";
    req.body = resolved.body;
  }
  return req;
}
function toCurlSnippet(resolved) {
  return toCurl(resolvedToCurlRequest(resolved));
}
function toFetchSnippet(resolved) {
  const req = resolved ?? {};
  const lines2 = [];
  if (Array.isArray(req.multipart)) {
    lines2.push("const form = new FormData();");
    for (const f of req.multipart) lines2.push(`form.append(${JSON.stringify(String(f?.name ?? ""))}, ${JSON.stringify(String(f?.value ?? ""))});`);
    lines2.push("");
  }
  const opts = [`  method: ${JSON.stringify(String(req.method ?? "GET"))}`];
  const headers = req.headers ?? [];
  if (headers.length > 0) {
    opts.push("  headers: {");
    for (const hd of headers) opts.push(`    ${JSON.stringify(String(hd?.name ?? ""))}: ${JSON.stringify(String(hd?.value ?? ""))},`);
    opts.push("  }");
  }
  if (Array.isArray(req.multipart)) opts.push("  body: form");
  else if (typeof req.body === "string") opts.push(`  body: ${JSON.stringify(req.body)}`);
  if (Number.isFinite(req.timeoutMs) && req.timeoutMs > 0) opts.push(`  signal: AbortSignal.timeout(${req.timeoutMs})`);
  lines2.push(`const response = await fetch(${JSON.stringify(String(req.url ?? ""))}, {`);
  lines2.push(opts.join(",\n"));
  lines2.push("});");
  lines2.push("");
  lines2.push("console.log(response.status);");
  lines2.push("console.log(await response.text());");
  return lines2.join("\n");
}
function pyLiteral(value) {
  return JSON.stringify(String(value ?? ""));
}
function toPythonSnippet(resolved) {
  const req = resolved ?? {};
  const lines2 = ["import requests", ""];
  lines2.push(`url = ${pyLiteral(req.url)}`);
  const headers = req.headers ?? [];
  if (headers.length > 0) {
    lines2.push("headers = {");
    for (const hd of headers) lines2.push(`    ${pyLiteral(hd?.name)}: ${pyLiteral(hd?.value)},`);
    lines2.push("}");
  }
  const args = [pyLiteral(req.method ?? "GET"), "url"];
  if (headers.length > 0) args.push("headers=headers");
  if (Array.isArray(req.multipart)) {
    lines2.push("files = [");
    for (const f of req.multipart) lines2.push(`    (${pyLiteral(f?.name)}, (None, ${pyLiteral(f?.value)})),`);
    lines2.push("]");
    args.push("files=files");
  } else if (typeof req.body === "string") {
    lines2.push(`data = ${pyLiteral(req.body)}`);
    args.push("data=data");
  }
  if (Number.isFinite(req.timeoutMs) && req.timeoutMs > 0) args.push(`timeout=${Math.max(1, Math.round(req.timeoutMs / 1e3))}`);
  lines2.push("");
  lines2.push(`resp = requests.request(${args.join(", ")})`);
  lines2.push("");
  lines2.push("print(resp.status_code)");
  lines2.push("print(resp.text)");
  return lines2.join("\n");
}
var SNIPPET_KINDS = [
  { id: "curl", label: "curl", build: toCurlSnippet },
  { id: "fetch", label: "JavaScript · fetch", build: toFetchSnippet },
  { id: "python", label: "Python · requests", build: toPythonSnippet },
  // Bruno collection file: keeps {{var}} templates verbatim (the second
  // argument is the raw editor state), so the file stays environment-agnostic.
  { id: "bru", label: "Bruno · .bru", build: (_resolved, state) => requestToBru(state) }
];

// src/client/reqmodel.js
function substituteVars(text, envMap) {
  if (typeof text !== "string" || !text.includes("{{")) return text;
  return text.replace(/\{\{\s*([A-Za-z0-9_.\-]+)\s*\}\}/g, (whole, name) => Object.prototype.hasOwnProperty.call(envMap, name) ? String(envMap[name]) : whole);
}
function buildEnvMap(pairs) {
  const map = {};
  for (const p of pairs ?? []) {
    const name = String(p?.name ?? "").trim();
    if (name && p.enabled !== false) map[name] = p?.value ?? "";
  }
  return map;
}
function splitUrl(url) {
  const raw = String(url ?? "");
  const hAt = raw.indexOf("#");
  const fragment = hAt >= 0 ? raw.slice(hAt) : "";
  const work = hAt >= 0 ? raw.slice(0, hAt) : raw;
  const qAt = work.indexOf("?");
  return { base: qAt >= 0 ? work.slice(0, qAt) : work, query: qAt >= 0 ? work.slice(qAt + 1) : "", fragment };
}
function parseQueryPairs(query) {
  const rows = [];
  for (const [name, value] of new URLSearchParams(String(query ?? ""))) rows.push({ name, value });
  return rows;
}
function buildQuery(pairs) {
  const params = new URLSearchParams();
  for (const p of pairs ?? []) {
    const name = String(p?.name ?? "").trim();
    if (name && p.enabled !== false && (p.kind ?? "query") === "query") params.append(name, String(p?.value ?? ""));
  }
  return params.toString();
}
function parsePathParams(url) {
  const names = [];
  for (const segment of splitUrl(url).base.split("/")) {
    if (segment.startsWith(":") && segment.length > 1) names.push(segment.slice(1));
  }
  return names;
}
function syncParamsFromUrl(url, prevPairs) {
  const prev = (Array.isArray(prevPairs) ? prevPairs : []).filter((p) => p && String(p.name ?? "").trim() !== "");
  const isPath = (p) => p.kind === "path";
  const enabledPool = prev.filter((p) => !isPath(p) && p.enabled !== false);
  const disabledPool = prev.filter((p) => !isPath(p) && p.enabled === false);
  const used = /* @__PURE__ */ new Set();
  const queryRows = parseQueryPairs(splitUrl(url).query).map((row) => {
    const at = enabledPool.findIndex((p, i) => !used.has(i) && String(p.name).trim() === row.name);
    let description = "";
    if (at >= 0) {
      used.add(at);
      description = enabledPool[at].description ?? "";
    }
    return { ...row, enabled: true, description, kind: "query" };
  });
  const prevPath = prev.filter(isPath);
  const pathRows = parsePathParams(url).map((name) => {
    const existing = prevPath.find((p) => String(p.name).trim() === name);
    return existing ? { ...existing, enabled: existing.enabled !== false, kind: "path" } : { name, value: "", enabled: true, description: "", kind: "path" };
  });
  return [...queryRows, ...pathRows, ...disabledPool.map((p) => ({ name: String(p.name), value: String(p.value ?? ""), description: String(p.description ?? ""), ...p.enabled === false ? { enabled: false } : {}, kind: "query" }))];
}
function applyParamsToUrl(url, pairs) {
  const { base, fragment } = splitUrl(url);
  const qs = buildQuery(pairs);
  return `${base}${qs ? `?${qs}` : ""}${fragment}`;
}
function substitutePathParams(url, pairs) {
  const raw = String(url ?? "");
  const rows = (pairs ?? []).filter((p) => p?.kind === "path" && p.enabled !== false && String(p?.name ?? "").trim() !== "" && String(p?.value ?? "") !== "");
  if (rows.length === 0 || !raw.includes("/:")) return raw;
  return raw.split("/").map((segment) => {
    if (!segment.startsWith(":")) return segment;
    const row = rows.find((p) => String(p.name).trim() === segment.slice(1));
    return row ? encodeURIComponent(String(row.value)) : segment;
  }).join("/");
}
function mergeParams(url, pairs) {
  const raw = String(url ?? "");
  const active = (pairs ?? []).filter((p) => p?.enabled !== false && String(p?.name ?? "").trim() !== "");
  if (active.length === 0) return raw;
  const { base, fragment } = splitUrl(raw);
  const params = new URLSearchParams(splitUrl(raw).query);
  for (const p of active) params.set(String(p.name).trim(), String(p.value ?? ""));
  const qs = params.toString();
  return `${base}${qs ? `?${qs}` : ""}${fragment}`;
}
function normalizeUrlParams(url, pairs) {
  const merged = mergeParams(String(url ?? ""), Array.isArray(pairs) ? pairs : []);
  return { url: merged, pairs: syncParamsFromUrl(merged, pairs) };
}
var DEFAULT_ENV_ID = "env-default";
function sanitizeVars(vars) {
  return (Array.isArray(vars) ? vars : []).filter((v) => v && typeof v === "object").map((v) => ({ name: String(v.name ?? ""), value: String(v.value ?? ""), description: String(v.description ?? ""), ...v.enabled === false ? { enabled: false } : {} }));
}
function sanitizeEnv(env, fallbackId) {
  if (!env || typeof env !== "object") return null;
  const id = typeof env.id === "string" && env.id !== "" ? env.id : fallbackId;
  const name = typeof env.name === "string" && env.name.trim() !== "" ? env.name.trim() : "Environment";
  return { id, name, vars: sanitizeVars(env.vars) };
}
function normalizeEnvStore(raw) {
  if (Array.isArray(raw)) {
    const vars = sanitizeVars(raw);
    if (vars.length === 0) return { envs: [], activeId: null };
    return { envs: [{ id: DEFAULT_ENV_ID, name: "Default", vars }], activeId: DEFAULT_ENV_ID };
  }
  if (raw && typeof raw === "object" && Array.isArray(raw.envs)) {
    const envs = raw.envs.map((env, i) => sanitizeEnv(env, `env-${i + 1}`)).filter(Boolean);
    const ids = new Set(envs.map((e) => e.id));
    const activeId = typeof raw.activeId === "string" && ids.has(raw.activeId) ? raw.activeId : null;
    return { envs, activeId };
  }
  return { envs: [], activeId: null };
}
function emptyEnvStore() {
  return { envs: [], activeId: null };
}
function activeEnvOf(store) {
  if (!store || typeof store.activeId !== "string") return null;
  return (store.envs ?? []).find((e) => e.id === store.activeId) ?? null;
}
function envMapOf(store) {
  return buildEnvMap(activeEnvOf(store)?.vars);
}
function newEnvId() {
  return `env-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function nextName(store) {
  let n = (store.envs ?? []).length + 1;
  const names = new Set((store.envs ?? []).map((e) => e.name));
  while (names.has(`Environment ${n}`)) n++;
  return `Environment ${n}`;
}
function addEnv(store, { name, id } = {}) {
  const base = store ?? emptyEnvStore();
  const env = { id: typeof id === "string" && id !== "" ? id : newEnvId(), name: typeof name === "string" && name.trim() !== "" ? name.trim() : nextName(base), vars: [] };
  return { envs: [...base.envs ?? [], env], activeId: env.id };
}
function renameEnv(store, id, name) {
  const clean = typeof name === "string" ? name.trim() : "";
  if (clean === "") return store;
  return { ...store, envs: (store?.envs ?? []).map((e) => e.id === id ? { ...e, name: clean } : e) };
}
function removeEnv(store, id) {
  const envs = (store?.envs ?? []).filter((e) => e.id !== id);
  return { envs, activeId: store?.activeId === id ? null : store?.activeId ?? null };
}
function selectEnv(store, id) {
  const wanted = typeof id === "string" && id !== "" ? id : null;
  if (wanted !== null && !(store?.envs ?? []).some((e) => e.id === wanted)) return store;
  return { ...store, activeId: wanted };
}
function setEnvVars(store, id, vars) {
  return { ...store, envs: (store?.envs ?? []).map((e) => e.id === id ? { ...e, vars: sanitizeVars(vars) } : e) };
}
var AUTH_MODES = ["none", "bearer", "basic"];
function normalizeAuth(raw) {
  const mode = AUTH_MODES.includes(raw?.mode) ? raw.mode : "none";
  return {
    mode,
    token: typeof raw?.token === "string" ? raw.token : "",
    user: typeof raw?.user === "string" ? raw.user : "",
    pass: typeof raw?.pass === "string" ? raw.pass : ""
  };
}
function base64Encode(text) {
  return btoa(unescape(encodeURIComponent(String(text))));
}
function basicAuthValue(user, pass) {
  return `Basic ${base64Encode(`${user ?? ""}:${pass ?? ""}`)}`;
}
function authHeaders(auth) {
  if (auth?.mode === "bearer" && String(auth.token ?? "").trim() !== "") {
    return [{ name: "Authorization", value: `Bearer ${String(auth.token).trim()}` }];
  }
  if (auth?.mode === "basic" && (String(auth.user ?? "") !== "" || String(auth.pass ?? "") !== "")) {
    return [{ name: "Authorization", value: basicAuthValue(auth.user, auth.pass) }];
  }
  return [];
}
function applyAuth(headers, auth) {
  const generated = authHeaders(auth);
  if (generated.length === 0) return headers;
  return [...headers.filter((hd) => hd.name.toLowerCase() !== "authorization"), ...generated];
}
function guessRawSubType(headers, body) {
  const ct = String((headers ?? []).find((hd) => String(hd?.name ?? "").toLowerCase() === "content-type")?.value ?? "");
  if (/json/i.test(ct)) return "json";
  if (/xml/i.test(ct)) return "xml";
  if (/html/i.test(ct)) return "html";
  if (/^text\/plain/i.test(ct)) return "text";
  const text = String(body ?? "").trim();
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      JSON.parse(text);
      return "json";
    } catch {
    }
  }
  if (/^<\?xml/i.test(text)) return "xml";
  if (/^<!doctype html>/i.test(text)) return "html";
  return "text";
}
function activePairs(pairs) {
  return (pairs ?? []).filter((p) => p?.enabled !== false && String(p?.name ?? "").trim() !== "");
}
function upsertHeader(list, name, value) {
  const found = list.find((hd) => hd.name.toLowerCase() === name.toLowerCase());
  if (found) found.value = value;
  else list.push({ name, value });
}
function resolveRequest(state, envMap) {
  const env = envMap ?? {};
  const method = String(state?.method || "GET").toUpperCase();
  const url = substituteVars(substitutePathParams(String(state?.url ?? "").trim(), state?.paramPairs), env);
  const headers = (state?.headers ?? []).filter((hd) => hd?.enabled !== false && String(hd?.name ?? "").trim() !== "").map((hd) => ({ name: String(hd.name).trim(), value: substituteVars(String(hd.value ?? ""), env) }));
  let body;
  let multipart;
  const bodyType = state?.bodyType || "none";
  if (bodyType === "raw") {
    body = substituteVars(String(state?.body ?? ""), env);
    upsertHeader(headers, "Content-Type", SUB_CT[state?.rawSub] ?? "text/plain");
  } else if (bodyType === "form") {
    body = new URLSearchParams(activePairs(state?.formPairs).map((p) => [String(p.name).trim(), substituteVars(String(p.value ?? ""), env)])).toString();
    upsertHeader(headers, "Content-Type", "application/x-www-form-urlencoded");
  } else if (bodyType === "multipart") {
    multipart = activePairs(state?.formPairs).map((p) => ({ name: String(p.name).trim(), value: substituteVars(String(p.value ?? ""), env) }));
  }
  const timeoutMs = Number.isFinite(state?.timeoutMs) && state.timeoutMs > 0 ? state.timeoutMs : void 0;
  return {
    method,
    url,
    headers: applyAuth(headers, normalizeAuth(state?.auth)),
    ...body !== void 0 ? { body } : {},
    ...multipart ? { multipart } : {},
    ...timeoutMs !== void 0 ? { timeoutMs } : {}
  };
}
function relTimeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - (ts || 0)) / 1e3));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const hh = Math.floor(m / 60);
  if (hh < 24) return `${hh}h`;
  return `${Math.floor(hh / 24)}d`;
}
function pushEntry(list, entry, cap) {
  const base = Array.isArray(list) ? list.filter((e) => e && e.id !== entry.id) : [];
  return [entry, ...base].slice(0, cap);
}
function jsonPath(value, expr) {
  const src = String(expr ?? "").trim().replace(/^\$\.?/, "");
  if (src === "") return void 0;
  let cur = value;
  let i = 0;
  const readKey = (name) => {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return false;
    if (!Object.hasOwn(cur, name)) return false;
    cur = cur[name];
    return true;
  };
  while (i < src.length) {
    if (src.charCodeAt(i) === 46) i++;
    const dot = src.indexOf(".", i);
    const brack = src.indexOf("[", i);
    const segEnd = dot === -1 ? brack === -1 ? src.length : brack : brack === -1 ? dot : Math.min(dot, brack);
    if (segEnd > i) {
      const key = src.slice(i, segEnd);
      if (!readKey(key)) return void 0;
      i = segEnd;
      continue;
    }
    if (src.charCodeAt(i) !== 91) return void 0;
    const close = src.indexOf("]", i);
    if (close === -1) return void 0;
    const inner = src.slice(i + 1, close).trim();
    if (inner.startsWith('"') || inner.startsWith("'")) {
      if (!readKey(inner.slice(1, -1))) return void 0;
    } else if (/^\d+$/.test(inner)) {
      if (!Array.isArray(cur) || Number(inner) >= cur.length) return void 0;
      cur = cur[Number(inner)];
    } else {
      return void 0;
    }
    i = close + 1;
  }
  return cur;
}
function runExtract(rule, response, resolvedRequest) {
  if (!rule) return void 0;
  const source = rule.source ?? "json";
  if (source !== "status" && !rule.expr) return void 0;
  if (source === "status") return String(response?.status ?? "");
  if (source === "header") {
    const list = response?.headers ?? [];
    const want = String(rule.expr).toLowerCase();
    const hit = list.find(([k]) => String(k).toLowerCase() === want);
    return hit ? String(hit[1]) : void 0;
  }
  if (source === "body") return response?.text ?? void 0;
  if (source === "regex") {
    try {
      const re = new RegExp(rule.expr, "m");
      const m = re.exec(response?.text ?? "");
      if (!m) return void 0;
      return m[1] ?? m[0];
    } catch {
      return void 0;
    }
  }
  if (source === "query") {
    try {
      const u = new URL(resolvedRequest?.url ?? "", "http://example.invalid");
      const v = u.searchParams.get(rule.expr);
      return v === null ? void 0 : v;
    } catch {
      return void 0;
    }
  }
  let parsed;
  try {
    parsed = JSON.parse(response?.text ?? "");
  } catch {
    return void 0;
  }
  const found = jsonPath(parsed, rule.expr);
  if (found === void 0 || found === null) return void 0;
  return typeof found === "object" ? JSON.stringify(found) : String(found);
}
function applyExtracts(extracts, response, resolvedRequest, store) {
  const rules = (Array.isArray(extracts) ? extracts : []).filter((r) => r && r.enabled !== false && String(r.name ?? "").trim() && String(r.expr ?? "").trim());
  if (rules.length === 0) return { store, applied: [], missed: [] };
  const env = activeEnvOf(store);
  if (!env) return { store, applied: [], missed: rules.map((r) => String(r.name).trim()) };
  const applied = [];
  const missed = [];
  const vars = [...Array.isArray(env.vars) ? env.vars : []];
  for (const rule of rules) {
    const value = runExtract(rule, response, resolvedRequest);
    if (value === void 0) {
      missed.push(rule.name);
      continue;
    }
    const idx = vars.findIndex((v) => v.name === rule.name);
    const row = { name: rule.name, value, enabled: true };
    if (idx === -1) vars.push(row);
    else vars[idx] = row;
    applied.push(row);
  }
  if (applied.length === 0) return { store, applied, missed };
  return { store: setEnvVars(store, env.id, vars), applied, missed };
}

// src/client/requestfields.js
function RequestFields({ t, label, rows, onChange, hint }) {
  const values = Array.isArray(rows) ? rows : [];
  const isEmpty = (row) => !row.name && !row.value && !row.description;
  const visible = values.length && isEmpty(values.at(-1)) ? values : [...values, { name: "", value: "", description: "" }];
  const update = (index, patch) => onChange(index === values.length ? [...values, { enabled: true, name: "", value: "", ...patch }] : values.map((row, i) => i === index ? { ...row, ...patch } : row));
  return h(
    "div",
    { className: "cea-fields" },
    h(
      "div",
      { className: "cea-fields-scroll" },
      h(
        "table",
        { className: "cea-fields-table", "aria-label": label },
        h("colgroup", null, h("col", { className: "cea-fields-check" }), h("col", { className: "cea-fields-name" }), h("col", { className: "cea-fields-value" }), h("col", { className: "cea-fields-description" }), h("col", { className: "cea-fields-action" })),
        h("thead", null, h(
          "tr",
          null,
          h("th", { scope: "col" }, h("span", { className: "cea-sr-only" }, t("api.fieldEnabled"))),
          h("th", { scope: "col" }, t("api.fieldName")),
          h("th", { scope: "col" }, t("api.fieldValue")),
          h("th", { scope: "col", className: "cea-fields-description" }, t("api.fieldDescription")),
          h("th", { scope: "col" }, h("span", { className: "cea-sr-only" }, t("api.delete")))
        )),
        h("tbody", null, visible.map((row, index) => {
          const draft = index === values.length;
          return h(
            "tr",
            { key: index, className: !draft && row.enabled === false ? "cea-field-disabled" : void 0 },
            h("td", null, h("input", { type: "checkbox", checked: row.enabled !== false, disabled: draft || isEmpty(row), "aria-label": `${label} · ${t("api.fieldEnabled")} ${index + 1}`, onChange: (event) => update(index, { enabled: event.target.checked }) })),
            ...["name", "value", "description"].map((field) => h(
              "td",
              { key: field, className: field === "description" ? "cea-fields-description" : void 0 },
              h("input", { className: "cea-field-input", type: "text", spellCheck: false, autoComplete: "off", placeholder: t(`api.field${field[0].toUpperCase()}${field.slice(1)}`), "aria-label": `${label} · ${t(`api.field${field[0].toUpperCase()}${field.slice(1)}`)} ${index + 1}`, value: row[field] ?? "", onChange: (event) => update(index, { [field]: event.target.value }) })
            )),
            h("td", null, !draft ? h("button", { type: "button", className: "ce-tool cea-field-delete", title: t("api.delete"), "aria-label": `${t("api.delete")} ${label} ${index + 1}`, onClick: () => onChange(values.filter((_, i) => i !== index)) }, "×") : null)
          );
        }))
      )
    ),
    h("div", { className: "cea-fields-footer" }, hint ? h("span", null, hint) : null, h("span", null, t("api.fieldAddHint")))
  );
}

// src/client/apistore.js
var PREFIX = "dsh.ce.api";
var LEGACY_SUFFIX = { draft: "draft.v1", history: "history.v1", saved: "saved.v1", env: "env.v1", colldir: "colldir.v1" };
var MIGRATED_FLAG = "dsh.ce.api.migrated.v1";
function workspaceScope(cwd) {
  const clean = String(cwd ?? "").trim();
  if (clean === "") return "global";
  return encodeURIComponent(clean);
}
function apiKey(kind, cwd) {
  return `${PREFIX}.${kind}.v2.${workspaceScope(cwd)}`;
}
function legacyApiKey(kind) {
  return `${PREFIX}.${LEGACY_SUFFIX[kind] ?? kind}`;
}
function migrateLegacyApiStores(cwd, storage = globalThis.localStorage) {
  if (!cwd || !storage) return [];
  try {
    if (storage.getItem(MIGRATED_FLAG) !== null) return [];
  } catch {
    return [];
  }
  const moved = [];
  for (const kind of Object.keys(LEGACY_SUFFIX)) {
    let raw = null;
    try {
      raw = storage.getItem(legacyApiKey(kind));
    } catch {
      continue;
    }
    if (raw === null) continue;
    try {
      storage.setItem(apiKey(kind, cwd), raw);
      storage.removeItem(legacyApiKey(kind));
      moved.push(kind);
    } catch {
    }
  }
  try {
    storage.setItem(MIGRATED_FLAG, String(Date.now()));
  } catch {
  }
  return moved;
}
var SECRET_PREFIX = "secret:";
function isSecretRef(value) {
  return typeof value === "string" && value.startsWith(SECRET_PREFIX) && value.length > SECRET_PREFIX.length;
}
function secretRef(id) {
  return `${SECRET_PREFIX}${id}`;
}
function secretId(value) {
  return isSecretRef(value) ? value.slice(SECRET_PREFIX.length) : null;
}
function collectSecretRefs(shape) {
  const ids = /* @__PURE__ */ new Set();
  const visit = (value) => {
    if (isSecretRef(value)) ids.add(secretId(value));
  };
  if (shape && typeof shape === "object") {
    if (shape.auth && typeof shape.auth === "object") {
      visit(shape.auth.token);
      visit(shape.auth.pass);
    }
    if (Array.isArray(shape.envs)) {
      for (const env of shape.envs) for (const v of env?.vars ?? []) visit(v?.value);
    }
    if (Array.isArray(shape.vars)) for (const v of shape.vars) visit(v?.value);
  }
  return [...ids];
}
function resolveSecrets(shape, lookup) {
  const subst = (value) => isSecretRef(value) ? String(lookup?.[secretId(value)] ?? "") : value;
  if (!shape || typeof shape !== "object") return shape;
  const out = { ...shape };
  if (shape.auth && typeof shape.auth === "object") out.auth = { ...shape.auth, token: subst(shape.auth.token), pass: subst(shape.auth.pass) };
  if (Array.isArray(shape.envs)) out.envs = shape.envs.map((env) => ({ ...env, vars: (env?.vars ?? []).map((v) => ({ ...v, value: subst(v?.value) })) }));
  if (Array.isArray(shape.vars)) out.vars = shape.vars.map((v) => ({ ...v, value: subst(v?.value) }));
  return out;
}

// src/client/apiclient.js
var HIST_CAP = 30;
var SAVED_CAP = 50;
var SNAPSHOT_V = 2;
function statusClass(status) {
  if (status < 300) return "cea-ok";
  if (status < 400) return "cea-info";
  if (status < 500) return "cea-warn";
  return "cea-err";
}
function prettySize(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function loadList(key) {
  const value = loadJson(key);
  return Array.isArray(value) ? value : [];
}
function storeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}
function requestSnapshot(state) {
  return { v: SNAPSHOT_V, ...state };
}
function restoredUrlParams(req) {
  if (req?.v === SNAPSHOT_V) {
    return { url: typeof req.url === "string" ? req.url : "", pairs: Array.isArray(req.paramPairs) ? req.paramPairs : [] };
  }
  return normalizeUrlParams(req?.url ?? "", req?.paramPairs);
}
function ApiView({ t, useTabInfo, sessionId, useSessions, incoming }) {
  const cwd = useSessions ? useSessions((sessions) => sessionId ? sessions.byId[sessionId]?.cwd : void 0) : void 0;
  const hostTab = useTabInfo ? useTabInfo()?.tab : null;
  const scopeCwd = cwd ?? "";
  const keys = useMemo(() => ({
    draft: apiKey("draft", scopeCwd),
    history: apiKey("history", scopeCwd),
    saved: apiKey("saved", scopeCwd),
    env: apiKey("env", scopeCwd),
    colldir: apiKey("colldir", scopeCwd)
  }), [scopeCwd]);
  const migratedRef = useRef(false);
  if (!migratedRef.current && scopeCwd) {
    migratedRef.current = true;
    migrateLegacyApiStores(scopeCwd);
  }
  const [vaultReady, setVaultReady] = useState(false);
  const secretCacheRef = useRef({});
  const secretIdByKeyRef = useRef({});
  const vaultProbeRef = useRef(false);
  useEffect(() => {
    if (vaultProbeRef.current) return;
    vaultProbeRef.current = true;
    api("vault", { action: "get", ids: [] }).then((res) => {
      if (res.ok) setVaultReady(true);
    }).catch(() => {
    });
  }, []);
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState([]);
  const [bodyType, setBodyType] = useState("none");
  const [rawSub, setRawSub] = useState("json");
  const [formPairs, setFormPairs] = useState([]);
  const [beautifyErr, setBeautifyErr] = useState("");
  const [body, setBody] = useState("");
  const [auth, setAuth] = useState(() => normalizeAuth(null));
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);
  const [respTab, setRespTab] = useState("body");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importNote, setImportNote] = useState("");
  const [histOpen, setHistOpen] = useState(false);
  const [histTab, setHistTab] = useState("history");
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [collectionDir, setCollectionDir] = useState(() => {
    try {
      return localStorage.getItem(apiKey("colldir", scopeCwd)) ?? "";
    } catch {
      return "";
    }
  });
  const [saveToCollection, setSaveToCollection] = useState(true);
  const [codeMenuOpen, setCodeMenuOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");
  const [envStore, setEnvStore] = useState(() => normalizeEnvStore(loadJson(apiKey("env", scopeCwd))));
  const [envNameDraft, setEnvNameDraft] = useState(null);
  const [envDeleteArmed, setEnvDeleteArmed] = useState(false);
  const importRef = useDismissLayer({ open: importOpen, onDismiss: () => setImportOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-import"]' });
  const saveRef = useDismissLayer({ open: saveOpen, onDismiss: () => setSaveOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-save"]' });
  const historyRef = useDismissLayer({ open: histOpen, onDismiss: () => setHistOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-history"]' });
  const codeMenuRef = useDismissLayer({ open: codeMenuOpen, onDismiss: () => setCodeMenuOpen(false), ignoreSelector: '[data-ce-popup-trigger="api-code"]' });
  useEffect(() => {
    if (hostTab?.visible === false) {
      setImportOpen(false);
      setSaveOpen(false);
      setHistOpen(false);
      setCodeMenuOpen(false);
    }
  }, [hostTab?.visible]);
  const [copied, setCopied] = useState(false);
  const [paramPairs, setParamPairs] = useState([]);
  const [requestTab, setRequestTab] = useState("params");
  const [responseCopied, setResponseCopied] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(3e4);
  const [extracts, setExtracts] = useState([]);
  const [extractNote, setExtractNote] = useState("");
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null);
  streamRef.current = stream;
  const [requestShare, setRequestShare] = useState(42);
  const workspaceRef = useRef(null);
  const splitDrag = useRef(null);
  const copiedTimer = useRef(null);
  const setSplit = (value) => setRequestShare(Math.max(24, Math.min(72, value)));
  const splitPointer = (event) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= 0) return;
    setSplit((event.clientY - rect.top) / rect.height * 100);
  };
  const loadScopeRef = useRef(null);
  useEffect(() => {
    if (loadScopeRef.current === scopeCwd) return;
    loadScopeRef.current = scopeCwd;
    let cancelled = false;
    const draftRaw = loadJson(keys.draft);
    const envRaw = normalizeEnvStore(loadJson(keys.env));
    const histRaw = loadList(keys.history);
    const savedRaw = loadList(keys.saved);
    const applyStores = (lookup) => {
      if (cancelled) return;
      for (const [id, value] of Object.entries(lookup ?? {})) secretCacheRef.current[id] = value;
      setHistory(histRaw.map((row) => row?.request ? { ...row, request: resolveSecrets(row.request, lookup) } : row));
      setSaved(savedRaw.map((row) => row?.request ? { ...row, request: resolveSecrets(row.request, lookup) } : row));
      setEnvStore(resolveSecrets(envRaw, lookup));
      try {
        setCollectionDir(localStorage.getItem(keys.colldir) ?? "");
      } catch {
        setCollectionDir("");
      }
      if (draftRaw && typeof draftRaw === "object") {
        const d = resolveSecrets(draftRaw, lookup);
        if (typeof d.method === "string") setMethod(d.method);
        const restored = restoredUrlParams(d);
        setUrl(restored.url);
        setParamPairs(restored.pairs);
        if (Array.isArray(d.headers)) setHeaders(d.headers);
        if (typeof d.bodyType === "string") {
          setBodyType(d.bodyType);
          if (d.bodyType !== "none") setRequestTab("body");
        }
        if (typeof d.rawSub === "string") setRawSub(d.rawSub);
        if (Array.isArray(d.formPairs)) setFormPairs(d.formPairs);
        if (typeof d.body === "string") setBody(d.body);
        if (d.auth) setAuth(normalizeAuth(d.auth));
        if (Number.isFinite(d.timeoutMs) && d.timeoutMs >= 1e3) setTimeoutMs(Math.min(12e4, d.timeoutMs));
        if (Array.isArray(d.extracts)) setExtracts(d.extracts);
      } else {
        setMethod("GET");
        setUrl("");
        setParamPairs([]);
        setHeaders([]);
        setBodyType("none");
        setRawSub("json");
        setFormPairs([]);
        setBody("");
        setAuth(normalizeAuth(null));
        setTimeoutMs(3e4);
        setExtracts([]);
      }
    };
    const ids = [...collectSecretRefs(draftRaw), ...collectSecretRefs(envRaw), ...histRaw.flatMap((r) => collectSecretRefs(r?.request)), ...savedRaw.flatMap((r) => collectSecretRefs(r?.request))];
    if (ids.length === 0) {
      applyStores({});
      return () => {
        cancelled = true;
      };
    }
    api("vault", { action: "get", ids: [...new Set(ids)] }).then((res) => {
      applyStores(res.ok ? res.value.values ?? {} : {});
    }).catch(() => applyStores({}));
    return () => {
      cancelled = true;
    };
  }, [scopeCwd, keys]);
  const persistWithSecrets = useCallback(async (key, snapshot2, secretEntries) => {
    if (!vaultReady || secretEntries.length === 0) {
      storeJson(key, snapshot2);
      return;
    }
    const entries = secretEntries.map(({ stableKey, value }) => ({ key: stableKey, id: secretIdByKeyRef.current[stableKey], value }));
    const res = await api("vault", { action: "set", entries }).catch(() => null);
    if (!res?.ok) {
      storeJson(key, snapshot2);
      return;
    }
    for (const [stableKey, id] of Object.entries(res.value.ids ?? {})) {
      secretIdByKeyRef.current[stableKey] = id;
      secretCacheRef.current[id] = entries.find((e) => e.key === stableKey)?.value ?? "";
    }
    storeJson(key, snapshot2);
  }, [vaultReady]);
  useEffect(() => {
    const snapshot2 = requestSnapshot({ method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs, auth, extracts });
    const secretEntries = [];
    if (vaultReady) {
      if (auth.mode === "bearer" && String(auth.token ?? "") !== "" && !isSecretRef(auth.token)) {
        secretEntries.push({ stableKey: "auth.token", value: String(auth.token) });
      }
      if (auth.mode === "basic" && String(auth.pass ?? "") !== "" && !isSecretRef(auth.pass)) {
        secretEntries.push({ stableKey: "auth.pass", value: String(auth.pass) });
      }
    }
    if (secretEntries.length === 0) {
      storeJson(keys.draft, snapshot2);
      return;
    }
    const refSnapshot = { ...snapshot2, auth: { ...auth } };
    let pending = Promise.resolve();
    for (const { stableKey } of secretEntries) {
      const existing = secretIdByKeyRef.current[stableKey];
      if (existing) {
        if (stableKey === "auth.token") refSnapshot.auth.token = secretRef(existing);
        else refSnapshot.auth.pass = secretRef(existing);
      }
    }
    storeJson(keys.draft, refSnapshot);
    pending = persistWithSecrets(keys.draft, snapshot2, secretEntries).then(() => {
      const finalSnapshot = { ...snapshot2, auth: { ...auth } };
      if (secretIdByKeyRef.current["auth.token"] && auth.mode === "bearer") finalSnapshot.auth.token = secretRef(secretIdByKeyRef.current["auth.token"]);
      if (secretIdByKeyRef.current["auth.pass"] && auth.mode === "basic") finalSnapshot.auth.pass = secretRef(secretIdByKeyRef.current["auth.pass"]);
      storeJson(keys.draft, finalSnapshot);
    });
    void pending;
  }, [method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs, auth, extracts, keys.draft, vaultReady, persistWithSecrets]);
  useEffect(() => {
    if (!vaultReady) {
      storeJson(keys.env, envStore);
      return;
    }
    const entries = [];
    const refStore = { ...envStore, envs: envStore.envs.map((env) => ({ ...env, vars: (env.vars ?? []).map((v) => {
      const value = String(v?.value ?? "");
      if (value === "" || isSecretRef(value)) return v;
      const stableKey = `env:${env.id}:${v.name}`;
      entries.push({ stableKey, value });
      const existing = secretIdByKeyRef.current[stableKey];
      return existing ? { ...v, value: secretRef(existing) } : v;
    }) })) };
    storeJson(keys.env, refStore);
    if (entries.length === 0) return;
    void persistWithSecrets(keys.env, envStore, entries).then(() => {
      const finalStore = { ...envStore, envs: envStore.envs.map((env) => ({ ...env, vars: (env.vars ?? []).map((v) => {
        const stableKey = `env:${env.id}:${v.name}`;
        const id = secretIdByKeyRef.current[stableKey];
        return id && String(v?.value ?? "") !== "" ? { ...v, value: secretRef(id) } : v;
      }) })) };
      storeJson(keys.env, finalStore);
    });
  }, [envStore, keys.env, vaultReady, persistWithSecrets]);
  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);
  const beautify = useCallback(() => {
    try {
      setBody(JSON.stringify(JSON.parse(body), null, 2));
      setBeautifyErr("");
    } catch {
      setBeautifyErr(t("api.beautifyErr"));
    }
  }, [body, t]);
  const editorState = useCallback(
    () => ({ method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs, auth, extracts }),
    [method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs, auth, extracts]
  );
  const snapshot = useCallback(() => requestSnapshot(editorState()), [editorState]);
  const snapshotWithRefs = useCallback((snap) => {
    if (!vaultReady) return snap;
    const out = { ...snap, auth: { ...snap.auth } };
    const tokenId = secretIdByKeyRef.current["auth.token"];
    const passId = secretIdByKeyRef.current["auth.pass"];
    if (tokenId && out.auth?.mode === "bearer" && String(out.auth.token ?? "") !== "") out.auth.token = secretRef(tokenId);
    if (passId && out.auth?.mode === "basic" && String(out.auth.pass ?? "") !== "") out.auth.pass = secretRef(passId);
    return out;
  }, [vaultReady]);
  const restoreRequest = useCallback((req) => {
    if (!req || typeof req !== "object") return;
    const r = resolveSecrets(req, secretCacheRef.current);
    if (typeof r.method === "string") setMethod(r.method);
    const restored = restoredUrlParams(r);
    setUrl(restored.url);
    setParamPairs(restored.pairs);
    if (Array.isArray(r.headers)) setHeaders(r.headers);
    if (typeof r.bodyType === "string") {
      setBodyType(r.bodyType);
      setRequestTab(r.bodyType === "none" ? "params" : "body");
    }
    if (typeof r.rawSub === "string") setRawSub(r.rawSub);
    if (Array.isArray(r.formPairs)) setFormPairs(r.formPairs);
    if (typeof r.body === "string") setBody(r.body);
    setAuth(normalizeAuth(r.auth));
    if (Array.isArray(r.extracts)) setExtracts(r.extracts);
    else setExtracts([]);
    if (Number.isFinite(r.timeoutMs) && r.timeoutMs >= 1e3) setTimeoutMs(Math.min(12e4, r.timeoutMs));
    setResponse(null);
    setHistOpen(false);
  }, []);
  useEffect(() => {
    if (!incoming || incoming.protocol !== "http" || !incoming.entry) return;
    restoreRequest(incoming.entry.request);
  }, [incoming?.nonce]);
  const send = useCallback(() => {
    if (url.trim() === "" || sending) return;
    const resolved = resolveRequest(editorState(), envMapOf(envStore));
    const sentSnapshot = snapshotWithRefs(snapshot());
    setSending(true);
    setResponseCopied(false);
    api("api.send", resolved).then((res) => {
      setSending(false);
      const value = res.ok ? res.value : { error: res.error };
      if (value?.streaming) {
        setResponse({ ...value, sent: resolved, text: "" });
        setRespTab("stream");
        streamEpoch.current += 1;
        setStream({
          id: value.id,
          pollEpoch: streamEpoch.current,
          status: value.status,
          headers: value.headers ?? [],
          state: foldStream({ raw: "", events: [], seq: 0, baseSeq: 0, done: false, error: "", dropped: false, sse: emptySseState() }, { chunks: value.chunks ?? [], seq: value.seq ?? 0, baseSeq: value.baseSeq ?? 0, done: value.done === true, error: value.error ?? "", dropped: false, reset: false })
        });
      } else {
        if (streamRef.current) {
          void api("api.streamStop", { id: streamRef.current.id });
          streamEpoch.current += 1;
          setStream(null);
        }
        setResponse({ ...value, sent: resolved });
        if (value?.error) setRespTab("body");
      }
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        method: resolved.method,
        url: resolved.url,
        status: value?.status,
        ms: value?.ms,
        error: value?.error ?? void 0,
        request: sentSnapshot
      };
      setHistory((prev) => {
        const next = pushEntry(prev, entry, HIST_CAP);
        storeJson(keys.history, next);
        return next;
      });
      const { store: nextStore, applied, missed } = applyExtracts(extracts, value, resolved, envStore);
      if (applied.length > 0) setEnvStore(nextStore);
      if (applied.length + missed.length > 0) {
        setExtractNote(applied.length > 0 ? `${applied.map((a) => a.name).join(", ")}${missed.length > 0 ? ` · ${missed.map((m) => m).join(", ")} ${t("api.extractMissed")}` : ""}` : t("api.extractAllMissed"));
      } else {
        setExtractNote("");
      }
    });
  }, [url, sending, editorState, snapshot, snapshotWithRefs, envStore, extracts, t, keys.history]);
  const streamEpoch = useRef(0);
  useEffect(() => {
    if (!stream || stream.state.done) return void 0;
    const id = stream.id;
    const epoch = stream.pollEpoch;
    let stop = false;
    let cursor = stream.state.seq;
    const pump = async () => {
      while (!stop && cursor >= 0) {
        const res = await api("api.streamPoll", { id, since: cursor, waitMs: 18e3 });
        if (stop || epoch !== streamEpoch.current) break;
        if (!res.ok || res.value?.error) break;
        const snap = res.value;
        cursor = snap.done ? -1 : snap.seq;
        setStream((prev) => prev === null || prev.id !== id || prev.pollEpoch !== epoch ? prev : { ...prev, state: foldStream(prev.state, snap) });
      }
    };
    void pump();
    return () => {
      stop = true;
    };
  }, [stream?.id, stream?.pollEpoch, stream?.state.done]);
  const flashCopied = useCallback(() => {
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  }, []);
  const copyText = useCallback((text) => {
    try {
      const p = navigator.clipboard?.writeText(text);
      return p && typeof p.then === "function" ? p : Promise.resolve();
    } catch {
      return Promise.resolve();
    }
  }, []);
  const copyCurl = useCallback(() => {
    copyText(toCurl(editorState())).then(flashCopied);
  }, [copyText, editorState, flashCopied]);
  const copySnippet = useCallback((kind) => {
    const text = kind.build(resolveRequest(editorState(), envMapOf(envStore)), editorState());
    copyText(text).then(() => {
      setCopiedCode(kind.id);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedCode(""), 1500);
    });
  }, [copyText, editorState, envStore]);
  const doImport = useCallback(() => {
    let collection = null;
    try {
      collection = detectCollectionImport(importText);
    } catch {
      collection = null;
    }
    if (collection) {
      if (collection.error || collection.requests.length === 0) {
        setImportError(`${t("api.importFailed")}: ${collection.error ?? t("api.importEmpty")}`);
        return;
      }
      const entries = collection.requests.map((req, i) => ({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        name: req.name,
        ts: Date.now(),
        request: requestSnapshot({ method: req.method, url: req.url, headers: req.headers, bodyType: req.bodyType, rawSub: req.rawSub, formPairs: [], body: req.body, paramPairs: req.paramPairs, timeoutMs: 3e4, auth: normalizeAuth(null), extracts: [] })
      }));
      setSaved((prev) => {
        const names = new Set(entries.map((e) => e.name));
        const next = [...entries, ...prev.filter((e) => e && !names.has(e.name))].slice(0, SAVED_CAP);
        storeJson(keys.saved, next);
        return next;
      });
      const first = collection.requests[0];
      setMethod(first.method);
      setUrl(first.url);
      setParamPairs(syncParamsFromUrl(first.url, first.paramPairs));
      setHeaders(first.headers);
      setBody(first.body);
      setBodyType(first.bodyType);
      setRawSub(first.rawSub);
      setImportText("");
      setImportOpen(false);
      setHistTab("saved");
      setHistOpen(true);
      return;
    }
    const isBru = looksLikeBru(importText);
    const bru = isBru ? parseBru(importText) : null;
    const p = isBru ? {
      method: bru.method,
      url: bru.url,
      headers: bru.headers,
      auth: bru.auth,
      body: bru.bodyType === "raw" ? bru.body : "",
      multipart: bru.bodyType === "multipart" ? bru.formPairs : null,
      form: bru.bodyType === "form" ? bru.formPairs : null
    } : parseCurl(importText);
    const seedPairs = isBru ? bru.paramPairs : [];
    const syncedUrl = isBru ? applyParamsToUrl(p.url, seedPairs) : p.url;
    setMethod(p.method);
    setUrl(syncedUrl);
    setParamPairs(syncParamsFromUrl(syncedUrl, seedPairs));
    setHeaders(p.headers);
    setAuth(normalizeAuth(p.auth));
    setResponse(null);
    if (p.multipart) {
      setFormPairs(p.multipart);
      setBodyType("multipart");
      setRequestTab("body");
    } else if (p.form) {
      setFormPairs(p.form);
      setBodyType("form");
      setRequestTab("body");
    } else if (p.body !== "") {
      setBody(p.body);
      setRawSub(isBru ? bru.rawSub : guessRawSubType(p.headers, p.body));
      setBodyType("raw");
      setRequestTab("body");
    } else {
      setFormPairs([]);
      setBody(p.body ?? "");
      setBodyType("none");
      setRequestTab("params");
    }
    setImportText("");
    setImportOpen(false);
  }, [importText, t]);
  const loadCollection = useCallback(async () => {
    if (collectionDir.trim() === "") return;
    try {
      localStorage.setItem(keys.colldir, collectionDir);
    } catch {
    }
    const res = await api("collection.load", { cwd: cwd ?? "", dir: collectionDir.trim() });
    if (!res.ok || res.value.error) {
      setImportError(`${t("api.collectionLoadFailed")}: ${res.value?.error ?? res.error ?? ""}`);
      return;
    }
    const parsed = [];
    for (const f of res.value.files ?? []) {
      try {
        const bru = parseBru(f.text);
        parsed.push({ file: f.path, bru });
      } catch {
      }
    }
    if (parsed.length === 0) {
      setImportError(t("api.collectionEmpty"));
      return;
    }
    const entries = parsed.map(({ file, bru }, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      name: bru.name || file.replace(/\.bru$/, ""),
      ts: Date.now(),
      request: requestSnapshot({ method: bru.method, url: applyParamsToUrl(bru.url, bru.paramPairs), headers: bru.headers, bodyType: bru.bodyType, rawSub: bru.rawSub, formPairs: bru.formPairs ?? [], body: bru.bodyType === "raw" ? bru.body : "", paramPairs: syncParamsFromUrl(applyParamsToUrl(bru.url, bru.paramPairs), bru.paramPairs), timeoutMs: 3e4, auth: normalizeAuth(bru.auth), extracts: [] })
    }));
    setSaved((prev) => {
      const names = new Set(entries.map((e) => e.name));
      const next = [...entries, ...prev.filter((e) => e && !names.has(e.name))].slice(0, SAVED_CAP);
      storeJson(keys.saved, next);
      return next;
    });
    setImportNote(`${(res.value.files ?? []).length} · ${t("api.collectionLoaded")}`);
  }, [collectionDir, cwd, t]);
  const doSaveFavorite = useCallback(async () => {
    const name = saveName.trim();
    if (name === "") return;
    const snap = snapshot();
    let bruText = "";
    if (saveToCollection && collectionDir.trim() !== "" && cwd) {
      try {
        bruText = requestToBru({ ...snap, name });
      } catch (error) {
        bruText = "";
      }
      if (bruText === "") {
        setImportError(t("api.collectionSerializeFailed"));
        return;
      }
      const res = await api("collection.save", { cwd: cwd ?? "", dir: collectionDir, name, text: bruText });
      if (!res.ok || res.value.error) {
        setImportError(`${t("api.collectionSaveFailed")}: ${res.value?.error ?? res.error ?? ""}`);
        return;
      }
    }
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, ts: Date.now(), request: snapshotWithRefs(snap) };
    setSaved((prev) => {
      const next = [entry, ...prev.filter((e) => e && e.name !== name)].slice(0, SAVED_CAP);
      storeJson(keys.saved, next);
      return next;
    });
    setSaveName("");
    setSaveOpen(false);
    setHistTab("saved");
    setHistOpen(true);
  }, [saveName, snapshot, snapshotWithRefs, saveToCollection, collectionDir, cwd, keys.saved]);
  const removeHistory = useCallback((id) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e && e.id !== id);
      storeJson(keys.history, next);
      return next;
    });
  }, []);
  const removeSaved = useCallback((id) => {
    setSaved((prev) => {
      const next = prev.filter((e) => e && e.id !== id);
      storeJson(keys.saved, next);
      return next;
    });
  }, []);
  const clearHistory = useCallback(() => {
    setHistory([]);
    storeJson(keys.history, []);
  }, []);
  const activeEnv = activeEnvOf(envStore);
  const envDraftName = envNameDraft && activeEnv && envNameDraft.id === activeEnv.id ? envNameDraft.name : activeEnv?.name ?? "";
  const createEnv = useCallback(() => {
    setEnvStore((store) => addEnv(store));
    setEnvNameDraft(null);
    setEnvDeleteArmed(false);
  }, []);
  const commitEnvName = useCallback(() => {
    const draft = envNameDraft;
    setEnvNameDraft(null);
    if (draft) setEnvStore((store) => renameEnv(store, draft.id, draft.name));
  }, [envNameDraft]);
  const deleteActiveEnv = useCallback(() => {
    if (!envDeleteArmed) {
      setEnvDeleteArmed(true);
      return;
    }
    if (activeEnv) setEnvStore((store) => removeEnv(store, activeEnv.id));
    setEnvDeleteArmed(false);
    setEnvNameDraft(null);
  }, [envDeleteArmed, activeEnv]);
  const onUrlChange = useCallback((value) => {
    setUrl(value);
    setParamPairs((prev) => syncParamsFromUrl(value, prev));
  }, []);
  const onQueryPairsChange = useCallback((rows) => {
    const paths2 = paramPairs.filter((p) => p.kind === "path");
    const next = [...rows.map((r) => r.kind === "path" ? r : { ...r, kind: "query" }), ...paths2];
    setParamPairs(next);
    setUrl((prev) => applyParamsToUrl(prev, next));
  }, [paramPairs]);
  const onPathPairsChange = useCallback((rows) => {
    const queries = paramPairs.filter((p) => p.kind !== "path");
    setParamPairs([...queries, ...rows.map((r) => ({ ...r, kind: "path" }))]);
  }, [paramPairs]);
  const respJson = useMemo(() => {
    if (!response || response.error || typeof response.text !== "string") return null;
    const ct = (response.headers ?? []).find((hd) => hd[0].toLowerCase() === "content-type")?.[1] ?? "";
    if (!/json/i.test(ct)) return null;
    try {
      return JSON.stringify(JSON.parse(response.text), null, 2);
    } catch {
      return null;
    }
  }, [response]);
  const activeParamCount = paramPairs.filter((p) => p?.kind !== "path" && p?.enabled !== false && String(p?.name ?? "").trim() !== "").length;
  const pathPairs = paramPairs.filter((p) => p?.kind === "path");
  const activeEnvVarCount = (activeEnv?.vars ?? []).filter((p) => p?.enabled !== false && String(p?.name ?? "").trim() !== "").length;
  const sent = response?.sent;
  return h(
    "div",
    { className: "ce-root cea-root", onKeyDown: (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !importOpen && !saveOpen && !codeMenuOpen) {
        e.preventDefault();
        e.stopPropagation();
        send();
      }
    } },
    h(
      "div",
      { className: "cea-tools" },
      h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.importTitle"), "data-ce-popup-trigger": "api-import", "aria-expanded": importOpen, onClick: () => {
        setImportOpen((value) => !value);
        setHistOpen(false);
        setSaveOpen(false);
        setCodeMenuOpen(false);
      } }, t("api.import")),
      h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.copyCurl"), disabled: url.trim() === "", onClick: copyCurl }, copied ? t("api.copied") : "⧉ curl"),
      h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${codeMenuOpen ? " cea-btn-on" : ""}`, title: t("api.codeTitle"), disabled: url.trim() === "", "data-ce-popup-trigger": "api-code", "aria-expanded": codeMenuOpen, onClick: () => {
        setCodeMenuOpen((value) => !value);
        setHistOpen(false);
        setSaveOpen(false);
        setImportOpen(false);
      } }, copiedCode ? t("api.copied") : `</> ${t("api.code")}`),
      h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.saveTitle"), "data-ce-popup-trigger": "api-save", "aria-expanded": saveOpen, onClick: () => {
        setSaveOpen((value) => !value);
        setHistOpen(false);
        setImportOpen(false);
        setCodeMenuOpen(false);
      } }, t("api.saveBtn")),
      h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${histOpen ? " cea-btn-on" : ""}`, title: t("api.history"), "data-ce-popup-trigger": "api-history", "aria-expanded": histOpen, onClick: () => {
        setHistOpen((v) => !v);
        setSaveOpen(false);
        setImportOpen(false);
        setCodeMenuOpen(false);
      } }, `${t("api.history")}${history.length ? ` ${history.length}` : ""}`),
      h("span", { className: "ce-spacer" }),
      h(
        "select",
        {
          className: "cea-method cea-env",
          "aria-label": t("api.envSelect"),
          title: t("api.envSelect"),
          value: envStore.activeId ?? "",
          onChange: (e) => {
            setEnvStore((store) => selectEnv(store, e.target.value || null));
            setEnvDeleteArmed(false);
          }
        },
        h("option", { value: "" }, t("api.envNone")),
        envStore.envs.map((env) => h("option", { key: env.id, value: env.id }, env.name))
      )
    ),
    h(
      "div",
      { className: "cea-bar" },
      h(
        "select",
        { className: `cea-method cea-request-method cea-m-${method.toLowerCase()}`, "aria-label": t("api.method"), value: method, onChange: (e) => setMethod(e.target.value) },
        ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => h("option", { key: m, value: m }, m))
      ),
      h("input", {
        className: "ce-input cea-url",
        placeholder: t("api.urlPlaceholder"),
        "aria-label": t("api.urlPlaceholder"),
        value: url,
        onChange: (e) => onUrlChange(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            send();
          }
        }
      }),
      h("button", { type: "button", className: "ce-sk-btn cea-send", title: t("api.sendShortcut"), disabled: sending || url.trim() === "", onClick: send }, sending ? t("api.sending") : t("api.send"))
    ),
    codeMenuOpen ? h(
      "div",
      { className: "cea-hist cea-codemenu", ref: codeMenuRef, role: "dialog", "aria-label": t("api.codeTitle") },
      h(
        "div",
        { className: "cea-hist-tabs" },
        h("span", null, t("api.codeTitle")),
        h("span", { className: "ce-spacer" }),
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setCodeMenuOpen(false) }, "✕")
      ),
      h(
        "div",
        { className: "cea-hist-list ce-scroll" },
        SNIPPET_KINDS.map((kind) => h(
          "button",
          { key: kind.id, type: "button", className: "cea-hmain cea-code-item", title: t("api.codeItemTitle"), onClick: () => copySnippet(kind) },
          h("span", { className: "cea-code-label" }, kind.label),
          copiedCode === kind.id ? h("span", { className: "cea-ok cea-code-copied" }, "✓") : null
        ))
      )
    ) : null,
    histOpen ? h(
      "div",
      { className: "cea-hist", ref: historyRef, role: "dialog", "aria-label": t("api.history") },
      h(
        "div",
        { className: "cea-hist-tabs" },
        h("button", { type: "button", className: `cea-tab${histTab === "history" ? " cea-tab-on" : ""}`, onClick: () => setHistTab("history") }, `${t("api.history")} · ${history.length}`),
        h("button", { type: "button", className: `cea-tab${histTab === "saved" ? " cea-tab-on" : ""}`, onClick: () => setHistTab("saved") }, `${t("api.saved")} · ${saved.length}`),
        h("span", { className: "ce-spacer" }),
        histTab === "history" && history.length > 0 ? h("button", { type: "button", className: "ce-link", title: t("api.clear"), onClick: clearHistory }, t("api.clear")) : null,
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setHistOpen(false) }, "✕")
      ),
      h(
        "div",
        { className: "cea-hist-list ce-scroll" },
        histTab === "history" ? history.length === 0 ? h("div", { className: "ce-note" }, t("api.histEmpty")) : history.map((e) => h(
          "div",
          { key: e.id, className: "cea-hrow2" },
          h(
            "button",
            { type: "button", className: "cea-hmain", title: t("api.restoreTitle"), onClick: () => restoreRequest(e.request) },
            h("span", { className: `cea-mbadge cea-m-${String(e.method ?? "get").toLowerCase()}` }, e.method),
            h("span", { className: "cea-hurl" }, e.url),
            e.error ? h("span", { className: "cea-hstatus cea-err" }, "✕") : h("span", { className: `cea-hstatus ${statusClass(e.status ?? 0)}` }, String(e.status ?? "")),
            h("span", { className: "cea-hts" }, `${relTimeAgo(e.ts)}${e.ms != null ? ` · ${e.ms}ms` : ""}`)
          ),
          h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.delete"), onClick: () => removeHistory(e.id) }, "✕")
        )) : saved.length === 0 ? h("div", { className: "ce-note" }, t("api.savedEmpty")) : saved.map((e) => h(
          "div",
          { key: e.id, className: "cea-hrow2" },
          h(
            "button",
            { type: "button", className: "cea-hmain", title: t("api.restoreTitle"), onClick: () => restoreRequest(e.request) },
            h("span", { className: "cea-hname" }, `★ ${e.name}`),
            h("span", { className: `cea-mbadge cea-m-${String(e.request?.method ?? "get").toLowerCase()}` }, e.request?.method),
            h("span", { className: "cea-hurl" }, e.request?.url ?? "")
          ),
          h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.delete"), onClick: () => removeSaved(e.id) }, "✕")
        ))
      )
    ) : null,
    h(
      "div",
      { className: "cea-scroll cea-workspace", ref: workspaceRef, style: { gridTemplateRows: `minmax(0, ${requestShare}fr) 10px minmax(0, ${100 - requestShare}fr)` } },
      h(
        "section",
        { className: "cea-request", "aria-label": t("api.requestConfig") },
        h(
          "div",
          { className: "cea-request-tabs", role: "group", "aria-label": t("api.requestConfig") },
          [["params", t("api.params"), activeParamCount], ["headers", t("api.headers"), headers.filter((p) => p.enabled !== false && p.name?.trim()).length], ["body", t("api.body"), bodyType === "none" ? 0 : 1], ["auth", t("api.auth"), auth.mode === "none" ? 0 : 1], ["variables", t("api.environment"), activeEnvVarCount], ["extracts", t("api.extracts"), extracts.filter((r) => r && r.enabled !== false && String(r.name ?? "").trim() !== "" && String(r.expr ?? "").trim() !== "").length], ["settings", t("api.settings"), 0]].map(([id, label, count]) => h("button", { type: "button", key: id, className: `cea-config-tab${requestTab === id ? " cea-config-tab-on" : ""}`, "aria-pressed": requestTab === id, onClick: () => {
            setRequestTab(id);
            setEnvDeleteArmed(false);
          } }, label, count ? h("span", { className: "cea-tab-count" }, count) : null))
        ),
        h(
          "div",
          { className: "cea-request-panel" },
          requestTab === "settings" ? h(
            "div",
            { className: "cea-settings" },
            h(
              "label",
              { className: "cea-tmo" },
              t("api.timeout"),
              h("input", {
                className: "ce-input cea-tmo-in",
                type: "number",
                min: 1e3,
                max: 12e4,
                step: 1e3,
                value: timeoutMs,
                onChange: (e) => setTimeoutMs(Math.max(1e3, Math.min(12e4, Number(e.target.value) || 3e4)))
              })
            ),
            h(
              "label",
              { className: "cea-tmo" },
              t("api.collectionDir"),
              h("input", {
                className: "ce-input",
                type: "text",
                spellcheck: false,
                autoComplete: "off",
                placeholder: t("api.collectionDirPlaceholder"),
                value: collectionDir,
                onChange: (e) => setCollectionDir(e.target.value)
              }),
              h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: collectionDir.trim() === "" || cwd === void 0, title: t("api.collectionLoad"), onClick: () => void loadCollection() }, `⇪ ${t("api.collectionLoad")}`)
            ),
            cwd === void 0 ? h("div", { className: "cea-meta" }, t("api.collectionNoSession")) : null
          ) : null,
          requestTab === "params" ? h(
            Fragment,
            null,
            h(RequestFields, { t, label: t("api.params"), rows: paramPairs.filter((p) => p?.kind !== "path"), onChange: onQueryPairsChange, hint: t("api.paramsHint") }),
            pathPairs.length > 0 ? h(RequestFields, { t, label: t("api.pathParams"), rows: pathPairs, onChange: onPathPairsChange, hint: t("api.pathParamsHint") }) : null
          ) : null,
          requestTab === "headers" ? h(RequestFields, { t, label: t("api.headers"), rows: headers, onChange: setHeaders }) : null,
          requestTab === "variables" ? h(
            Fragment,
            null,
            h(
              "div",
              { className: "cea-envbar" },
              h("input", {
                className: "ce-input cea-env-name",
                "aria-label": t("api.envName"),
                placeholder: t("api.envName"),
                value: envDraftName,
                disabled: !activeEnv,
                spellCheck: false,
                onChange: (e) => activeEnv && setEnvNameDraft({ id: activeEnv.id, name: e.target.value }),
                onBlur: commitEnvName,
                onKeyDown: (e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    commitEnvName();
                    e.currentTarget?.blur?.();
                  }
                }
              }),
              h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.envNewTitle"), onClick: createEnv }, `＋ ${t("api.envNew")}`),
              activeEnv ? h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${envDeleteArmed ? " cea-danger" : ""}`, title: t("api.envDelete"), onClick: deleteActiveEnv }, envDeleteArmed ? t("api.envDeleteConfirm") : t("api.envDelete")) : null
            ),
            activeEnv ? h(RequestFields, { t, label: t("api.environment"), rows: activeEnv.vars, onChange: (rows) => setEnvStore((store) => setEnvVars(store, activeEnv.id, rows)), hint: t("api.envTitle") }) : h("div", { className: "cea-empty" }, h("span", null, t("api.envNoActive")))
          ) : null,
          requestTab === "extracts" ? h(
            Fragment,
            null,
            h("div", { className: "cea-fields-footer" }, h("span", null, t("api.extractHint"))),
            activeEnv === null ? h("div", { className: "cea-fields-footer" }, h("span", { className: "cea-warn" }, t("api.extractNoEnv"))) : null,
            h(
              "div",
              { className: "cea-fields" },
              h(
                "div",
                { className: "cea-fields-scroll" },
                h(
                  "table",
                  { className: "cea-fields-table", "aria-label": t("api.extracts") },
                  h("colgroup", null, h("col", { className: "cea-fields-check" }), h("col", { className: "cea-fields-name" }), h("col", { className: "cea-fields-value" }), h("col", { className: "cea-fields-description" }), h("col", { className: "cea-fields-action" })),
                  h(
                    "thead",
                    null,
                    h(
                      "tr",
                      null,
                      h("th", { scope: "col" }, h("span", { className: "cea-sr-only" }, t("api.fieldEnabled"))),
                      h("th", { scope: "col" }, t("api.extractName")),
                      h("th", { scope: "col" }, t("api.extractSource")),
                      h("th", { scope: "col" }, t("api.extractExpr")),
                      h("th", { scope: "col" }, h("span", { className: "cea-sr-only" }, t("api.delete")))
                    )
                  ),
                  h(
                    "tbody",
                    null,
                    extracts.map((rule, index) => h(
                      "tr",
                      { key: index, className: rule.enabled === false ? "cea-field-disabled" : void 0 },
                      h("td", null, h("input", { type: "checkbox", checked: rule.enabled !== false, "aria-label": `${t("api.extracts")} · ${t("api.fieldEnabled")} ${index + 1}`, onChange: (e) => setExtracts((prev) => prev.map((r, j) => j === index ? { ...r, enabled: e.target.checked } : r)) })),
                      h("td", null, h("input", { className: "cea-field-input", type: "text", spellCheck: false, autoComplete: "off", placeholder: t("api.extractName"), "aria-label": `${t("api.extracts")} · ${t("api.extractName")} ${index + 1}`, value: rule.name ?? "", onChange: (e) => setExtracts((prev) => prev.map((r, j) => j === index ? { ...r, name: e.target.value } : r)) })),
                      h("td", null, h("select", {
                        className: "cea-field-input",
                        "aria-label": `${t("api.extracts")} · ${t("api.extractSource")} ${index + 1}`,
                        value: rule.source ?? "json",
                        onChange: (e) => setExtracts((prev) => prev.map((r, j) => j === index ? { ...r, source: e.target.value } : r))
                      }, ["json", "header", "status", "body", "regex", "query"].map((s) => h("option", { key: s, value: s }, t(`api.extractSrc.${s}`))))),
                      h("td", null, h("input", { className: "cea-field-input", type: "text", spellCheck: false, autoComplete: "off", placeholder: t("api.extractExpr"), "aria-label": `${t("api.extracts")} · ${t("api.extractExpr")} ${index + 1}`, value: rule.expr ?? "", onChange: (e) => setExtracts((prev) => prev.map((r, j) => j === index ? { ...r, expr: e.target.value } : r)) })),
                      h("td", null, h("button", { type: "button", className: "ce-tool cea-field-delete", title: t("api.delete"), "aria-label": `${t("api.delete")} ${t("api.extracts")} ${index + 1}`, onClick: () => setExtracts((prev) => prev.filter((_, j) => j !== index)) }, "×"))
                    ))
                  )
                )
              ),
              h(
                "div",
                { className: "cea-fields-footer" },
                h("button", { type: "button", className: "ce-tool cea-link", onClick: () => setExtracts((prev) => [...prev, { name: "", source: "json", expr: "", enabled: true }]) }, `+ ${t("api.addExtract")}`),
                extracts.length === 0 ? h("span", null, t("api.extractEmpty")) : null
              )
            ),
            extractNote !== "" ? h("div", { className: "cea-fields-footer", role: "status" }, h("span", null, extractNote)) : null
          ) : null,
          requestTab === "auth" ? h(
            "div",
            { className: "cea-auth" },
            h(
              "div",
              { className: "cea-sec" },
              h("span", null, t("api.auth")),
              h(
                "select",
                { className: "cea-method", "aria-label": t("api.auth"), value: auth.mode, onChange: (e) => setAuth({ ...auth, mode: e.target.value }) },
                h("option", { value: "none" }, t("api.authNone")),
                h("option", { value: "bearer" }, t("api.authBearer")),
                h("option", { value: "basic" }, t("api.authBasic"))
              )
            ),
            auth.mode === "bearer" ? h(
              "label",
              { className: "cea-auth-row" },
              h("span", null, t("api.authToken")),
              h("input", { className: "ce-input", "aria-label": t("api.authToken"), placeholder: t("api.authTokenPlaceholder"), value: auth.token, spellCheck: false, autoComplete: "off", onChange: (e) => setAuth({ ...auth, token: e.target.value }) })
            ) : null,
            auth.mode === "basic" ? h(
              Fragment,
              null,
              h(
                "label",
                { className: "cea-auth-row" },
                h("span", null, t("api.authUser")),
                h("input", { className: "ce-input", "aria-label": t("api.authUser"), value: auth.user, spellCheck: false, autoComplete: "off", onChange: (e) => setAuth({ ...auth, user: e.target.value }) })
              ),
              h(
                "label",
                { className: "cea-auth-row" },
                h("span", null, t("api.authPass")),
                h("input", { className: "ce-input", "aria-label": t("api.authPass"), placeholder: t("api.authPassPlaceholder"), value: auth.pass, spellCheck: false, autoComplete: "off", onChange: (e) => setAuth({ ...auth, pass: e.target.value }) })
              )
            ) : null,
            h("div", { className: "cea-fields-footer" }, h("span", null, t("api.authHint")))
          ) : null,
          requestTab === "body" ? h(
            Fragment,
            null,
            h(
              "div",
              { className: "cea-sec" },
              h("span", null, t("api.body")),
              h(
                "select",
                { className: "cea-method", value: bodyType, onChange: (e) => setBodyType(e.target.value) },
                h("option", { value: "none" }, t("api.bodyNone")),
                h("option", { value: "form" }, t("api.bodyForm")),
                h("option", { value: "multipart" }, t("api.bodyMultipart")),
                h("option", { value: "raw" }, t("api.bodyRaw"))
              ),
              bodyType === "raw" ? h(
                Fragment,
                null,
                h(
                  "select",
                  { className: "cea-method", value: rawSub, onChange: (e) => setRawSub(e.target.value) },
                  ["json", "text", "html", "xml"].map((s) => h("option", { key: s, value: s }, s))
                ),
                rawSub === "json" ? h(
                  Fragment,
                  null,
                  h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", onClick: beautify }, t("api.beautify")),
                  beautifyErr ? h("span", { className: "cea-err" }, beautifyErr) : null
                ) : null
              ) : null
            ),
            bodyType === "form" || bodyType === "multipart" ? h(RequestFields, { t, label: t("api.body"), rows: formPairs, onChange: setFormPairs }) : null,
            bodyType === "raw" ? h("textarea", { className: "cea-body", "aria-label": t("api.body"), placeholder: rawSub === "json" ? '{\n  "key": "value"\n}' : t("api.body"), value: body, spellcheck: false, onKeyDown: (e) => {
              if (e.key !== "Tab" || e.shiftKey) return;
              e.preventDefault();
              const el = e.currentTarget;
              const start = el.selectionStart;
              const end = el.selectionEnd;
              setBody(body.slice(0, start) + "  " + body.slice(end));
              requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
            }, onChange: (e) => {
              setBody(e.target.value);
              setBeautifyErr("");
            } }) : null,
            bodyType === "none" ? h("div", { className: "cea-empty" }, t("api.bodyEmpty")) : null
          ) : null
        )
      ),
      h("div", {
        className: "cea-resizer",
        role: "separator",
        tabIndex: 0,
        "aria-label": t("api.resizePanels"),
        "aria-orientation": "horizontal",
        "aria-valuemin": 24,
        "aria-valuemax": 72,
        "aria-valuenow": Math.round(requestShare),
        title: t("api.resizeHint"),
        onPointerDown: (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          splitDrag.current = e.pointerId;
          splitPointer(e);
        },
        onPointerMove: (e) => {
          if (splitDrag.current === e.pointerId) splitPointer(e);
        },
        onPointerUp: (e) => {
          if (splitDrag.current !== e.pointerId) return;
          splitDrag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        },
        onLostPointerCapture: () => {
          splitDrag.current = null;
        },
        onDoubleClick: () => setRequestShare(42),
        onKeyDown: (e) => {
          if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          e.stopPropagation();
          setSplit(e.key === "Home" ? 24 : e.key === "End" ? 72 : requestShare + (e.key === "ArrowDown" ? 5 : -5));
        }
      }, h("span", { "aria-hidden": true })),
      h(
        "section",
        { className: "cea-response", "aria-label": t("api.resp"), "aria-busy": sending },
        sending ? h("div", { className: "cea-response-wait", role: "status" }, t("api.sending")) : null,
        response ? h(
          Fragment,
          null,
          h(
            "div",
            { className: "cea-sec" },
            h("span", null, t("api.resp")),
            h("span", { className: "ce-spacer" }),
            !response.error ? h("button", { type: "button", className: "ce-link", onClick: async () => {
              try {
                await navigator.clipboard.writeText(respJson ?? response.text ?? "");
                setResponseCopied(true);
              } catch {
                setResponseCopied(false);
              }
            } }, responseCopied ? t("api.copied") : t("api.copyResponse")) : null
          ),
          h(
            "div",
            { className: "cea-status" },
            response.error ? h("span", { className: "cea-err" }, `${t("api.err")}: ${response.error}`) : h(
              Fragment,
              null,
              h("span", { className: statusClass(response.status) }, `${response.status} ${response.statusText ?? ""}`),
              h("span", { className: "cea-meta" }, `${response.ms ?? 0}ms · ${prettySize(response.size ?? 0)}${response.truncated ? " · truncated" : ""}`)
            )
          ),
          h(
            "div",
            { className: "cea-hist-tabs cea-resp-tabs", role: "tablist", "aria-label": t("api.resp") },
            [["body", t("api.respBody")], ["headers", t("api.respHeaders")], ["timeline", t("api.timeline")], ...stream ? [["stream", `${t("api.streamTab")} · ${stream.state.events.length}${stream.state.done ? "" : " ●"}`]] : []].map(([id, label]) => h("button", { type: "button", role: "tab", key: id, className: `cea-tab${respTab === id ? " cea-tab-on" : ""}`, "aria-selected": respTab === id, onClick: () => setRespTab(id) }, label))
          ),
          h(
            "div",
            { className: "cea-response-content ce-scroll" },
            respTab === "headers" ? response.error ? h("div", { className: "ce-note" }, `${t("api.err")}: ${response.error}`) : h("div", { className: "cea-hlist" }, (response.headers ?? []).map((hd, i) => h("div", { key: i }, h("span", { className: "cea-hk" }, hd[0]), h("span", null, hd[1])))) : respTab === "stream" ? stream ? h(
              "div",
              { className: "cea-stream" },
              stream.state.error !== "" ? h("div", { className: "cea-err" }, `${t("api.err")}: ${stream.state.error}`) : null,
              stream.state.dropped ? h("div", { className: "cea-meta" }, t("api.streamDropped")) : null,
              stream.state.events.length === 0 && !stream.state.error ? h("div", { className: "ce-note" }, stream.state.done ? t("api.streamEmptyDone") : t("api.streamEmptyWaiting")) : null,
              stream.state.events.slice(-300).map((ev, i) => h(
                "div",
                { className: "cea-sse-row", key: `${stream.state.seq}-${i}` },
                h("span", { className: "cea-sse-kind" }, ev.event),
                typeof ev.retry === "number" ? h("span", { className: "cea-sse-retry" }, `${ev.retry}ms`) : null,
                ev.id ? h("span", { className: "cea-sse-id" }, `#${ev.id}`) : null,
                h("span", { className: "cea-sse-data" }, sseEventLabel(ev))
              ))
            ) : h("div", { className: "ce-note" }, t("api.streamEmpty")) : respTab === "timeline" ? sent ? h(
              "div",
              { className: "cea-timeline" },
              h(
                "div",
                { className: "cea-tl-req" },
                h("span", { className: `cea-mbadge cea-m-${String(sent.method).toLowerCase()}` }, sent.method),
                h("span", { className: "cea-hurl" }, sent.url)
              ),
              h("div", { className: "cea-hlist" }, (sent.headers ?? []).map((hd, i) => h("div", { key: i }, h("span", { className: "cea-hk" }, hd.name), h("span", null, hd.value)))),
              Array.isArray(sent.multipart) ? h("div", { className: "cea-hlist" }, sent.multipart.map((f, i) => h("div", { key: i }, h("span", { className: "cea-hk" }, `[form] ${f.name}`), h("span", null, f.value)))) : null,
              typeof sent.body === "string" && sent.body !== "" ? h("pre", { className: "cea-resp cea-tl-body" }, sent.body) : null,
              h("div", { className: "cea-tl-meta" }, `${t("api.timeout")}: ${sent.timeoutMs ?? 3e4}ms${response.error ? "" : ` · ${response.status} · ${response.ms ?? 0}ms · ${prettySize(response.size ?? 0)}`}`)
            ) : h("div", { className: "ce-note" }, t("api.timelineEmpty")) : h("pre", { className: "cea-resp" }, !response.error ? respJson ?? response.text ?? "" : `${t("api.err")}: ${response.error}`)
          )
        ) : h("div", { className: "cea-empty" }, h("strong", null, t("api.responseEmpty")), h("span", null, t("api.sendShortcut")))
      )
    ),
    importOpen ? h(
      "div",
      { className: "ce-overlay", ref: importRef, role: "dialog", "aria-label": t("api.importTitle") },
      h(
        "div",
        { className: "ce-overlay-head" },
        h("span", null, t("api.importTitle")),
        h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setImportOpen(false) }, "✕")
      ),
      h("textarea", { className: "cea-body cea-import", autoFocus: true, "aria-label": t("api.importTitle"), value: importText, spellcheck: false, placeholder: t("api.importPlaceholder"), onChange: (e) => {
        setImportText(e.target.value);
        if (importError !== "") setImportError("");
      } }),
      importError !== "" ? h("div", { className: "cea-bar" }, h("span", { className: "cea-warn", role: "status" }, importError)) : null,
      importNote !== "" ? h("div", { className: "cea-bar" }, h("span", { role: "status" }, importNote)) : null,
      h(
        "div",
        { className: "cea-bar" },
        h("span", { className: "ce-spacer" }),
        h("button", { type: "button", className: "ce-sk-btn", disabled: importText.trim() === "", onClick: doImport }, t("api.importBtn"))
      )
    ) : null,
    saveOpen ? h(
      "div",
      { className: "ce-overlay", ref: saveRef, role: "dialog", "aria-label": t("api.saveTitle") },
      h(
        "div",
        { className: "ce-overlay-head" },
        h("span", null, t("api.saveTitle")),
        h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setSaveOpen(false) }, "✕")
      ),
      h(
        "div",
        { className: "cea-bar" },
        h("input", {
          className: "ce-input",
          placeholder: t("api.savePlaceholder"),
          "aria-label": t("api.savePlaceholder"),
          value: saveName,
          autoFocus: true,
          onChange: (e) => setSaveName(e.target.value),
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.key === "Enter") doSaveFavorite();
            else if (e.key === "Escape") setSaveOpen(false);
          }
        }),
        h(
          "label",
          { className: "cea-save-coll" },
          h("input", {
            type: "checkbox",
            checked: saveToCollection && collectionDir.trim() !== "" && cwd !== void 0,
            disabled: collectionDir.trim() === "" || cwd === void 0,
            onChange: (e) => setSaveToCollection(e.target.checked)
          }),
          h("span", null, t("api.saveToCollection"))
        ),
        h("button", { type: "button", className: "ce-sk-btn", disabled: saveName.trim() === "", onClick: doSaveFavorite }, t("api.saveConfirm"))
      )
    ) : null
  );
}
var ApiGlyph = () => h(
  "svg",
  { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } },
  h("path", { d: "M6 2v4M10 2v4" }),
  h("path", { d: "M4 6h8v3a4 4 0 0 1-8 0z" }),
  h("path", { d: "M8 13v1.5" })
);
function ApiTitle({ useTabInfo }) {
  const tabInfo = useTabInfo ? useTabInfo() : null;
  return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(ApiGlyph)), tabInfo?.tab?.title ?? "API");
}

// src/client/apientries.js
var PROTOCOLS = ["http", "grpc"];
var HISTORY_CAP = 60;
function entryProtocol(entry) {
  return entry?.protocol === "grpc" ? "grpc" : "http";
}
function withProtocol(entry, protocol) {
  return protocol === "grpc" ? { ...entry, protocol: "grpc" } : entry;
}
function filterByProtocol(list, protocol) {
  const wanted = PROTOCOLS.includes(protocol) ? protocol : "http";
  return (Array.isArray(list) ? list : []).filter((entry) => entryProtocol(entry) === wanted);
}
function mergeProtocols(...lists) {
  const rows = lists.flatMap((list) => Array.isArray(list) ? list : []);
  return rows.slice().sort((a, b) => Number(b?.ts ?? 0) - Number(a?.ts ?? 0));
}
function entryLabel(entry) {
  if (entryProtocol(entry) === "grpc") {
    const request = entry.request ?? {};
    const method2 = String(request.method ?? "").trim();
    const address = String(request.address ?? "").trim();
    return `${method2 || "(method)"}${address ? ` → ${address}` : ""}`;
  }
  const method = String(entry.method ?? entry.request?.method ?? "").toUpperCase();
  const url = String(entry.url ?? entry.request?.url ?? "");
  return `${method}${url ? ` ${url}` : ""}`.trim();
}
function interpolateVariables(text, variables) {
  if (typeof text !== "string" || text === "") return text;
  const source = variables && typeof variables === "object" ? variables : {};
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/gu, (all, name) => {
    const value = source[name];
    return value === void 0 || value === null ? all : String(value);
  });
}
function interpolateDeep(value, variables) {
  if (typeof value === "string") return interpolateVariables(value, variables);
  if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, variables));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = interpolateDeep(item, variables);
    return out;
  }
  return value;
}
function activeVariables(envStore) {
  const active = (envStore?.envs ?? []).find((env) => env.id === envStore?.activeId);
  const vars = {};
  for (const row of active?.vars ?? []) {
    if (row && row.enabled !== false && typeof row.name === "string" && row.name !== "") vars[row.name] = row.value ?? "";
  }
  return vars;
}
function removeHistoryEntry(key, id, storage = globalThis.localStorage) {
  const rows = readArray(key, storage);
  if (rows === null) return null;
  const next = rows.filter((entry) => entry?.id !== String(id));
  writeArray(key, next, storage);
  return next;
}
function clearHistoryEntries(key, storage = globalThis.localStorage) {
  writeArray(key, [], storage);
  return [];
}
function readArray(key, storage) {
  try {
    const raw = storage?.getItem?.(key);
    if (raw === null || raw === void 0) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
function writeArray(key, rows, storage) {
  try {
    storage?.setItem?.(key, JSON.stringify(rows));
  } catch {
  }
}

// src/client/workbench.js
var PROTOCOL_KEY = "dsh.plugin-kit.workbench.protocol";
var PROTOCOLS2 = ["http", "grpc"];
function readProtocol(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(PROTOCOL_KEY);
    return PROTOCOLS2.includes(value) ? value : "http";
  } catch {
    return "http";
  }
}
function writeProtocol(protocol, storage = globalThis.localStorage) {
  if (!PROTOCOLS2.includes(protocol)) return false;
  try {
    storage?.setItem(PROTOCOL_KEY, protocol);
    return true;
  } catch {
    return false;
  }
}
function clonePane(pane, incoming) {
  if (!pane || typeof pane !== "object") return null;
  return { ...pane, props: { ...pane.props, incoming } };
}
function WorkbenchView({ t, http, grpc, initialProtocol, sessionId, useSessions }) {
  const cwd = useSessions ? useSessions((sessions) => sessionId ? sessions.byId[sessionId]?.cwd : void 0) : void 0;
  const [protocol, setProtocol] = useState(() => PROTOCOLS2.includes(initialProtocol) ? initialProtocol : readProtocol());
  const seen = useRef({ http: protocol === "http", grpc: protocol === "grpc" });
  seen.current[protocol] = true;
  const choose = (next) => {
    if (next === protocol) return;
    setProtocol(next);
    writeProtocol(next);
  };
  const historyKey = useMemo(() => apiKey("history", cwd ?? ""), [cwd]);
  const [history, setHistory] = useState([]);
  const lastHistory = useRef("");
  const readHistory = useCallback(() => {
    let rows;
    try {
      const raw = JSON.parse(localStorage.getItem(historyKey) ?? "null");
      rows = mergeProtocols(filterByProtocol(raw, "http"), filterByProtocol(raw, "grpc"));
    } catch {
      rows = [];
    }
    const fingerprint = rows.map((row) => row?.id).join("|");
    if (fingerprint === lastHistory.current) return;
    lastHistory.current = fingerprint;
    setHistory(rows);
  }, [historyKey]);
  useEffect(() => {
    readHistory();
    const timer = setInterval(readHistory, 4e3);
    return () => clearInterval(timer);
  }, [readHistory]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const drawerRef = useDismissLayer({ open: drawerOpen, onDismiss: () => setDrawerOpen(false), ignoreSelector: '[data-ce-popup-trigger="workbench-history"]' });
  const [incoming, setIncoming] = useState(null);
  const openEntry = (entry) => {
    const target = entryProtocol(entry);
    choose(target);
    setIncoming({ protocol: target, entry, nonce: Date.now() + Math.random() });
    setDrawerOpen(false);
  };
  const removeEntry = (entry) => {
    removeHistoryEntry(historyKey, entry.id);
    lastHistory.current = "";
    readHistory();
  };
  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearHistoryEntries(historyKey);
    lastHistory.current = "";
    readHistory();
    setConfirmClear(false);
  };
  return h(
    "div",
    { className: "ce-wb" },
    h(
      "div",
      { className: "ce-wb-bar" },
      h(
        "div",
        { className: "ce-wb-seg", role: "tablist", "aria-label": t("workbench.title") },
        PROTOCOLS2.map((id) => h("button", {
          key: id,
          type: "button",
          role: "tab",
          "aria-selected": protocol === id,
          className: `ce-wb-btn${protocol === id ? " ce-wb-on" : ""}`,
          title: t(`workbench.${id}Hint`),
          onClick: () => choose(id)
        }, t(`workbench.${id}`)))
      ),
      h("span", { className: "ce-spacer" }),
      h("span", { className: "ce-wb-hint" }, t(protocol === "http" ? "workbench.httpHint" : "workbench.grpcHint")),
      h("button", {
        type: "button",
        className: `ce-wb-hist${drawerOpen ? " ce-wb-on" : ""}`,
        "data-ce-popup-trigger": "workbench-history",
        "aria-expanded": drawerOpen,
        title: t("workbench.historyHint"),
        onClick: () => {
          readHistory();
          setDrawerOpen((open) => !open);
        }
      }, `${t("workbench.history")} ${history.length}`)
    ),
    drawerOpen ? h(
      "div",
      { className: "ce-wb-drawer", ref: drawerRef, role: "dialog", "aria-label": t("workbench.history") },
      h(
        "div",
        { className: "ce-wb-drawer-head" },
        h("span", null, t("workbench.history")),
        h("span", { className: "ce-wb-drawer-hint" }, t("workbench.historyHint")),
        h("span", { className: "ce-spacer" }),
        history.length > 0 ? h("button", { type: "button", className: "ce-link", title: t("api.clear"), onClick: clearAll }, confirmClear ? t("api.clearConfirm") : t("api.clear")) : null,
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => {
          setDrawerOpen(false);
          setConfirmClear(false);
        } }, "✕")
      ),
      history.length === 0 ? h("div", { className: "ce-wb-drawer-empty" }, t("api.histEmpty")) : h("div", { className: "ce-wb-drawer-list ce-scroll" }, history.map((entry) => h(
        "div",
        { key: entry.id, className: "ce-wb-drawer-item" },
        h(
          "button",
          {
            type: "button",
            className: "ce-wb-drawer-row",
            title: entryLabel(entry),
            onClick: () => openEntry(entry)
          },
          h("span", { className: `ce-wb-proto ce-wb-proto-${entryProtocol(entry)}` }, entryProtocol(entry) === "grpc" ? "gRPC" : "HTTP"),
          h("span", { className: "ce-wb-drawer-label" }, entryLabel(entry)),
          h("span", { className: "ce-wb-drawer-ms" }, entry.status === void 0 ? "" : String(entry.status))
        ),
        h("button", {
          type: "button",
          className: "ce-tool ce-tiny ce-wb-drawer-del",
          title: t("api.delete"),
          "aria-label": t("api.delete"),
          onClick: () => removeEntry(entry)
        }, "✕")
      )))
    ) : null,
    h("div", { className: "ce-wb-pane", hidden: protocol !== "http" }, seen.current.http ? clonePane(http, incoming) : null),
    h("div", { className: "ce-wb-pane", hidden: protocol !== "grpc" }, seen.current.grpc ? clonePane(grpc, incoming) : null)
  );
}

// src/client/migrate.js
function migrateLegacyRpcTabs({
  tabs,
  migrated,
  canOpen,
  preferGrpc,
  close,
  open
} = {}) {
  const rows = Array.isArray(tabs) ? tabs : [];
  let count = 0;
  for (const tab of rows) {
    if (tab?.kind !== "code-rpc") continue;
    const key = `${tab.sessionId}:${tab.id}`;
    if (migrated?.has?.(key)) continue;
    if (typeof canOpen === "function" && canOpen() === false) continue;
    migrated?.add?.(key);
    try {
      preferGrpc?.();
      close?.(tab);
      open?.(tab.sessionId);
      count += 1;
    } catch {
    }
  }
  return count;
}

// src/client/autosize.js
function useAutoHeight(ref, value, options = {}) {
  const min = Number(options.min) > 0 ? Number(options.min) : 96;
  const extra = Number(options.extra) >= 0 ? Number(options.extra) : 2;
  useEffect(() => {
    const node = ref?.current;
    if (!node || typeof node.style !== "object" || typeof node.scrollHeight !== "number") return;
    node.style.height = "auto";
    node.style.height = `${Math.max(min, node.scrollHeight + extra)}px`;
  }, [value, min, extra]);
}

// src/client/dbconnect.js
var DRIVERS = ["sqlite", "mysql", "postgres"];
var DEFAULT_PORT = { mysql: 3306, postgres: 5432 };
var SCHEMES = {
  postgres: "postgres",
  postgresql: "postgres",
  mysql: "mysql",
  mariadb: "mysql",
  sqlite: "sqlite",
  sqlite3: "sqlite",
  file: "sqlite"
};
var SQLITE_SUFFIX = /\.(sqlite3?|db|s3db|sl3)$/iu;
var WINDOWS_PATH = /^[a-z]:[\\/]/iu;
function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
function looksLikePath(input) {
  const value = String(input ?? "").trim();
  if (value === "") return false;
  if (WINDOWS_PATH.test(value)) return true;
  if (value.includes("/") || value.includes("\\")) return true;
  return SQLITE_SUFFIX.test(value);
}
function inferDriver(input) {
  const value = String(input ?? "").trim();
  if (value === "") return "";
  const scheme = /^([a-z][a-z0-9+.-]*):(\/\/)?/iu.exec(value);
  if (scheme !== null && !WINDOWS_PATH.test(value)) {
    const driver = SCHEMES[scheme[1].toLowerCase()];
    if (driver !== void 0) return driver;
    if (scheme[2] !== "//" && /^\d+(\/|$)/u.test(value.slice(scheme[0].length))) return "";
    if (scheme[2] !== "//" && looksLikePath(value)) return "sqlite";
    return "";
  }
  return looksLikePath(value) ? "sqlite" : "";
}
function parseConnectionAddress(input) {
  const value = String(input ?? "").trim();
  const empty = { driver: "", path: "", host: "", port: "", user: "", password: "", database: "", error: "" };
  if (value === "") return empty;
  const driver = inferDriver(value);
  if (driver === "") return { ...empty, error: "unrecognised address" };
  if (driver === "sqlite") {
    const scheme = /^(?:sqlite3?|file):(?:\/\/)?/iu.exec(value);
    const path = scheme === null ? value : value.slice(scheme[0].length);
    return { ...empty, driver, path: path === "" ? "" : path };
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return { ...empty, driver, error: "malformed URL" };
  }
  const port = url.port === "" ? DEFAULT_PORT[driver] : Number(url.port);
  return {
    driver,
    path: "",
    host: url.hostname,
    port: Number.isFinite(port) ? String(port) : String(DEFAULT_PORT[driver]),
    user: decode(url.username),
    password: decode(url.password),
    database: decode(url.pathname.replace(/^\//u, "")),
    error: ""
  };
}
function driverLabel(driver) {
  return { sqlite: "SQLite", mysql: "MySQL", postgres: "PostgreSQL" }[driver] ?? String(driver ?? "");
}

// src/client/db.js
var PAGE_SIZE = 100;
var HISTORY_CAP2 = 40;
function formatCell(value) {
  if (value === null) return "NULL";
  if (value === void 0) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function truncateCell(value, max = 120) {
  const text = formatCell(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function toCsv(columns, rows) {
  const quote = (value) => {
    const text = value === null || value === void 0 ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines2 = [columns.map(quote).join(",")];
  for (const row of rows) lines2.push(row.map(quote).join(","));
  return lines2.join("\n");
}
function tableSql(table, { order, dir, limit, offset, filter, columns, driver }) {
  const q = (name) => driver === "mysql" ? `\`${String(name).replace(/`/g, "``")}\`` : `"${String(name).replace(/"/g, '""')}"`;
  const quote = q(table);
  const where = filter && filter.trim() && columns?.length ? ` WHERE (${columns.map((column) => `CAST(${q(column.name)} AS TEXT) LIKE '%${filter.trim().replace(/'/g, "''")}%'`).join(" OR ")})` : "";
  const sorting = order ? ` ORDER BY ${q(order)} ${dir === "desc" ? "DESC" : "ASC"}` : "";
  return `SELECT * FROM ${quote}${where}${sorting} LIMIT ${limit} OFFSET ${offset}`;
}
function requestToken(prefix = "r") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function countOf(schema) {
  let tables = 0;
  let views = 0;
  for (const database of schema?.databases ?? []) {
    for (const entry of database.tables ?? []) {
      if (entry.kind === "view") views++;
      else tables++;
    }
  }
  return { tables, views };
}
function DbView({ t, useTabInfo, sessionId, useSessions }) {
  const cwd = useSessions ? useSessions((sessions) => sessionId ? sessions.byId[sessionId]?.cwd : void 0) : void 0;
  const [drivers, setDrivers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeConn, setActiveConn] = useState("");
  const [schema, setSchema] = useState(null);
  const [schemaBusy, setSchemaBusy] = useState(false);
  const [schemaError, setSchemaError] = useState("");
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(() => /* @__PURE__ */ new Set());
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [history, setHistory] = useState([]);
  const [connectOpen, setConnectOpen] = useState(false);
  const [form, setForm] = useState({ address: "", driver: "", path: "", host: "localhost", port: "", user: "", password: "", database: "", clientPath: "" });
  const [advanced, setAdvanced] = useState(false);
  const [cellDetail, setCellDetail] = useState(null);
  const [notice, setNotice] = useState("");
  const [profiles, setProfiles] = useState([]);
  const profileRevision = useRef(0);
  const [profileErrors, setProfileErrors] = useState({});
  const [saveProfile, setSaveProfile] = useState(true);
  const [testState, setTestState] = useState({ busy: false, ok: null, text: "" });
  const [addressTouched, setAddressTouched] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const detailRef = useDismissLayer({ open: Boolean(cellDetail), onDismiss: () => setCellDetail(null) });
  const connectRef = useDismissLayer({ open: connectOpen, onDismiss: () => setConnectOpen(false) });
  useEffect(() => {
    api("db.profile.list", {}).then((res) => {
      if (!res.ok) return;
      profileRevision.current = res.value.revision ?? 0;
      setProfiles(res.value.profiles ?? []);
    }).catch(() => {
    });
  }, []);
  const probeDrivers = useCallback(async (refresh = false) => {
    const res = await api("db.drivers", refresh ? { refresh: true } : {});
    if (res.ok) setDrivers(res.value ?? []);
  }, []);
  useEffect(() => {
    void probeDrivers();
  }, [probeDrivers]);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const sqlRef = useRef(null);
  useAutoHeight(sqlRef, activeTab?.sql ?? "", { min: 88 });
  const patchTab = useCallback((id, patch) => {
    setTabs((current) => current.map((tab) => tab.id === id ? { ...tab, ...typeof patch === "function" ? patch(tab) : patch } : tab));
  }, []);
  const openTab = useCallback((tab) => {
    const existing = tabs.find((entry) => entry.key === tab.key);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
  }, [tabs]);
  const closeTab = useCallback((id) => {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      const next = current.filter((tab) => tab.id !== id);
      if (id === activeTabId) setActiveTabId(next[Math.max(0, index - 1)]?.id ?? next[0]?.id ?? "");
      return next;
    });
  }, [activeTabId]);
  const refreshSchema = useCallback(async (id = activeConn) => {
    if (!id) {
      setSchema(null);
      return;
    }
    setSchemaBusy(true);
    setSchemaError("");
    const res = await api("db.schema", { id });
    setSchemaBusy(false);
    if (res.ok) setSchema(res.value);
    else {
      setSchema(null);
      setSchemaError(res.error);
    }
  }, [activeConn]);
  const openConnect = useCallback(() => {
    setNotice("");
    setAddressTouched(false);
    setTestState({ busy: false, ok: null, text: "" });
    setConnectOpen(true);
  }, []);
  const useSavedProfile = useCallback((profile) => {
    const parsed = parseConnectionAddress(profile.address || profile.path || "");
    setForm({
      address: profile.address || profile.path || "",
      driver: profile.driver,
      path: profile.path ?? parsed.path,
      host: profile.host || parsed.host || "localhost",
      port: profile.port ? String(profile.port) : parsed.port,
      user: profile.user ?? parsed.user,
      password: "",
      database: profile.database ?? parsed.database,
      clientPath: ""
    });
    setAddressTouched(true);
    setNotice(parsed.error ?? "");
    setTestState({ busy: false, ok: null, text: "" });
  }, []);
  const applyAddress = useCallback((value) => {
    const parsed = parseConnectionAddress(value);
    setForm((current) => ({
      ...current,
      address: value,
      driver: parsed.driver,
      path: parsed.driver === "sqlite" ? parsed.path : current.path,
      host: parsed.driver === "sqlite" ? current.host : parsed.host || current.host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database
    }));
    if (addressTouched) setNotice(parsed.error);
    setTestState({ busy: false, ok: null, text: "" });
  }, [addressTouched]);
  const driverReady = drivers.find((entry) => entry.id === form.driver)?.ready ?? true;
  const canConnect = form.driver !== "" && (form.driver === "sqlite" ? form.path.trim() !== "" : form.host.trim() !== "");
  const rememberConnection = useCallback(async (draft) => {
    const defaultPort = draft.driver === "mysql" ? 3306 : draft.driver === "postgres" ? 5432 : 0;
    const label = draft.driver === "sqlite" ? String(draft.path).split(/[\\/]/).pop() || draft.path : `${draft.host}:${Number(draft.port) || defaultPort}${draft.database ? `/${draft.database}` : ""}`;
    const absolute = draft.driver === "sqlite" && draft.path !== "" && !/^(\/|~|[A-Za-z]:[\\/])/.test(draft.path) && cwd ? `${cwd.replace(/\/+$/, "")}/${draft.path.replace(/^\.\//, "")}` : draft.path;
    const res = await api("db.profile.save", {
      baseRevision: profileRevision.current,
      label,
      driver: draft.driver,
      address: draft.address,
      path: absolute,
      host: draft.host,
      port: Number(draft.port) || defaultPort,
      user: draft.user,
      database: draft.database,
      ...draft.password ? { password: draft.password } : {}
    });
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    profileRevision.current = res.value.revision ?? profileRevision.current;
    setProfiles((current) => [res.value.profile, ...current.filter((entry) => entry.id !== res.value.profile.id)]);
  }, [cwd]);
  const connectProfile = useCallback(async (profile) => {
    const res = await api("db.connect", { profileId: profile.id, cwd });
    if (!res.ok) {
      setNotice(res.error);
      setProfileErrors((current) => ({ ...current, [profile.id]: res.error }));
      return;
    }
    setProfileErrors((current) => {
      if (!(profile.id in current)) return current;
      const next = { ...current };
      delete next[profile.id];
      return next;
    });
    setConnections((current) => [...current.filter((entry) => entry.id !== res.value.id), res.value]);
    setActiveConn(res.value.id);
    setNotice("");
    await refreshSchema(res.value.id);
  }, [refreshSchema, cwd]);
  const forgetProfile = useCallback(async (profile) => {
    await api("db.profile.delete", { id: profile.id });
    setProfiles((current) => current.filter((entry) => entry.id !== profile.id));
  }, []);
  const connectParams = useCallback(() => {
    const params = { driver: form.driver, cwd };
    if (form.driver === "sqlite") params.path = form.path.trim();
    else {
      params.host = form.host.trim();
      params.port = form.port ? Number(form.port) : void 0;
      params.user = form.user;
      params.password = form.password;
      params.database = form.database.trim();
      if (String(form.clientPath ?? "").trim() !== "") params.clientPath = form.clientPath.trim();
    }
    return params;
  }, [form, cwd]);
  const doTest = useCallback(async () => {
    if (!canConnect) return;
    setTestState({ busy: true, ok: null, text: "" });
    const res = await api("db.test", connectParams());
    if (!res.ok) {
      setTestState({ busy: false, ok: false, text: res.error });
      return;
    }
    if (res.value?.error) {
      setTestState({ busy: false, ok: false, text: res.value.error });
      return;
    }
    setTestState({ busy: false, ok: true, text: t("db.testOk").replace("{ms}", String(res.value.ms ?? 0)) });
  }, [canConnect, connectParams, t]);
  const doConnect = useCallback(async () => {
    if (!canConnect) return;
    const params = connectParams();
    const res = await api("db.connect", params);
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setConnections((current) => [...current.filter((entry) => entry.id !== res.value.id), res.value]);
    setActiveConn(res.value.id);
    setConnectOpen(false);
    setNotice("");
    if (saveProfile) await rememberConnection(form);
    await refreshSchema(res.value.id);
  }, [connectParams, refreshSchema, saveProfile, rememberConnection]);
  const doDisconnect = useCallback(async (id) => {
    await api("db.disconnect", { id });
    setConnections((current) => current.filter((entry) => entry.id !== id));
    setTabs((current) => current.filter((tab) => tab.conn !== id));
    if (activeConn === id) {
      setActiveConn("");
      setSchema(null);
    }
  }, [activeConn]);
  const fetchRows = useCallback(async (tab) => {
    const token = requestToken("rows");
    patchTab(tab.id, { loading: true, error: "", runToken: token });
    const res = await api("db.rows", {
      id: tab.conn,
      token,
      table: tab.table,
      database: tab.database,
      limit: PAGE_SIZE,
      offset: tab.offset,
      order: tab.order,
      dir: tab.dir,
      filter: tab.filter
    });
    if (!res.ok) {
      patchTab(tab.id, { loading: false, error: res.error });
      return;
    }
    patchTab(tab.id, { loading: false, result: res.value, error: "", runToken: "" });
  }, [patchTab]);
  const loadRows = useCallback((tabId, override) => {
    const tab = tabs.find((entry) => entry.id === tabId);
    if (!tab || tab.kind !== "table") return;
    return fetchRows({ ...tab, ...override });
  }, [tabs, fetchRows]);
  const openTable = useCallback((connectionId, database, entry) => {
    const key = `table:${connectionId}:${database}:${entry.name}`;
    openTab({
      id: `tab-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      key,
      kind: "table",
      title: entry.name,
      conn: connectionId,
      database,
      table: entry.name,
      columns: entry.columns ?? [],
      offset: 0,
      order: "",
      dir: "asc",
      filter: "",
      loading: false,
      error: "",
      result: null
    });
  }, [openTab]);
  const fetched = useRef(/* @__PURE__ */ new Set());
  useEffect(() => {
    const target = tabs.find((tab) => tab.kind === "table" && !tab.result && !tab.loading && !fetched.current.has(tab.id));
    if (!target) return;
    fetched.current.add(target.id);
    void fetchRows(target);
  }, [tabs, fetchRows]);
  const sortBy = useCallback((id, column) => {
    const target = tabs.find((tab) => tab.id === id);
    if (!target) return;
    const dir = target.order === column && target.dir === "asc" ? "desc" : "asc";
    patchTab(id, { order: column, dir, offset: 0 });
    void loadRows(id, { order: column, dir, offset: 0 });
  }, [tabs, patchTab, loadRows]);
  const openQueryTab = useCallback((sql = "") => {
    const id = `tab-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    openTab({
      id,
      key: `query:${id}`,
      kind: "query",
      title: t("db.queryTab"),
      sql,
      conn: activeConn,
      loading: false,
      error: "",
      result: null,
      ms: 0
    });
    return id;
  }, [openTab, activeConn, t]);
  const runQuery = useCallback(async (id) => {
    const tab = tabs.find((entry) => entry.id === id);
    if (!tab || tab.kind !== "query") return;
    const sql = String(tab.sql ?? "").trim();
    if (sql === "") return;
    const conn = tab.conn || activeConn;
    if (!conn) {
      patchTab(id, { error: t("db.noConnection"), result: null });
      return;
    }
    const token = requestToken("query");
    patchTab(id, { loading: true, error: "", runToken: token });
    const started = Date.now();
    const res = await api("db.query", { id: conn, token, sql, limit: 5e3 });
    const ms = Date.now() - started;
    if (!res.ok) {
      patchTab(id, { loading: false, error: res.error, result: null });
      return;
    }
    patchTab(id, { loading: false, result: res.value, error: "", ms, runToken: "" });
    setHistory((current) => [{ sql, at: Date.now(), ms, ok: !res.value.error }, ...current.filter((entry) => entry.sql !== sql)].slice(0, HISTORY_CAP2));
    if (/^\s*(create|drop|alter)\b/i.test(sql)) void refreshSchema(conn);
  }, [tabs, activeConn, patchTab, refreshSchema, t]);
  const cancelQuery = useCallback(async (tab) => {
    const conn = tab.conn || activeConn;
    if (!conn) return;
    const res = await api("db.cancel", { id: conn, ...tab.runToken ? { token: tab.runToken } : {} });
    const value = res.ok ? res.value : null;
    if (!value?.cancelled) {
      patchTab(tab.id, { loading: false, error: "" });
      setNotice(res.ok ? t("db.notRunning") : res.error);
      return;
    }
    patchTab(tab.id, { loading: false, error: t("db.cancelled") });
    if (value.connectionClosed) {
      setConnections((current) => current.filter((entry) => entry.id !== conn));
      setTabs((current) => current.filter((entry) => entry.conn !== conn));
      if (activeConn === conn) {
        setActiveConn("");
        setSchema(null);
      }
      setNotice(t("db.cancelledClosed"));
    }
  }, [activeConn, patchTab, t]);
  const exportResult = useCallback((result, name) => {
    if (!result?.columns?.length) return;
    const csv = toCsv(result.columns, result.rows ?? []);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name || "result"}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 4e3);
  }, []);
  const tree = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const databases = (schema?.databases ?? []).map((database) => {
      const entries = (database.tables ?? []).filter((entry) => !needle || entry.name.toLowerCase().includes(needle));
      return { ...database, tables: entries };
    });
    return needle ? databases.filter((database) => database.tables.length > 0) : databases;
  }, [schema, filter]);
  const counts = countOf(schema);
  const toggleTable = (key) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const onKeyDown = useCallback((event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (activeTab?.kind === "query") void runQuery(activeTab.id);
    }
  }, [activeTab, runQuery]);
  if (!cwd) {
    return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
  }
  return h(
    "div",
    { className: "ce-root cedb-root", onKeyDown },
    // ---- toolbar -------------------------------------------------------------------
    h(
      "div",
      { className: "cedb-toolbar" },
      h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: openConnect }, `＋ ${t("db.connect")}`),
      h("button", { type: "button", className: "ce-sk-btn", onClick: () => openQueryTab("") }, t("db.newQuery")),
      activeConn ? h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("db.refresh"), onClick: () => void refreshSchema() }, "⟳") : null,
      h("span", { className: "ce-spacer" }),
      schema ? h("span", { className: "cedb-chip" }, `${counts.tables} ${t("db.tables")}`) : null,
      schema ? h("span", { className: "cedb-chip" }, `${counts.views} ${t("db.views")}`) : null,
      notice && !connectOpen ? h("span", { className: "cedb-notice" }, notice) : null
    ),
    h(
      "div",
      { className: "cedb-body" },
      // ---- rail ------------------------------------------------------------------
      h(
        "aside",
        { className: "cedb-rail" },
        profiles.length > 0 ? h(
          Fragment,
          null,
          h(
            "div",
            { className: "cedb-rail-head cedb-rail-head-sub" },
            h("span", { className: "cedb-rail-title" }, t("db.savedConnections"))
          ),
          profiles.map((profile) => h(
            "div",
            { key: profile.id, className: "cedb-conn cedb-saved" },
            h(
              "button",
              {
                type: "button",
                className: "cedb-conn-main",
                title: `${profile.address || profile.path} — ${t("db.connectSaved")}`,
                onClick: () => void connectProfile(profile)
              },
              h("span", { className: `cedb-driver cedb-driver-${profile.driver}` }, profile.driver),
              h("span", { className: "cedb-conn-label" }, profile.label),
              profileErrors[profile.id] ? h("span", { className: "cedb-conn-bad", title: profileErrors[profile.id], "aria-label": profileErrors[profile.id] }, "⚠") : null
            ),
            h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.forget"), onClick: () => void forgetProfile(profile) }, "✕")
          ))
        ) : null,
        h(
          "div",
          { className: "cedb-rail-head" },
          h("span", { className: "cedb-rail-title" }, t("db.connections"))
        ),
        connections.length === 0 ? h("div", { className: "cedb-empty" }, t("db.noConnections")) : connections.map((connection) => h(
          "div",
          { key: connection.id, className: `cedb-conn${connection.id === activeConn ? " cedb-conn-on" : ""}` },
          h(
            "button",
            {
              type: "button",
              className: "cedb-conn-main",
              title: connection.path || connection.label,
              onClick: () => {
                setActiveConn(connection.id);
                void refreshSchema(connection.id);
              }
            },
            h("span", { className: `cedb-driver cedb-driver-${connection.driver}` }, connection.driver),
            h("span", { className: "cedb-conn-label" }, connection.label)
          ),
          h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.disconnect"), onClick: () => void doDisconnect(connection.id) }, "✕")
        )),
        schema ? h(
          Fragment,
          null,
          h(
            "div",
            { className: "cedb-rail-head cedb-rail-head-split" },
            h("span", { className: "cedb-rail-title" }, t("db.objects")),
            h("input", {
              className: "ce-input cedb-filter",
              placeholder: t("db.search"),
              value: filter,
              onChange: (event) => setFilter(event.target.value)
            })
          ),
          schemaBusy ? h("div", { className: "cedb-empty" }, t("loading")) : null,
          schemaError ? h("div", { className: "cedb-error cedb-pad" }, schemaError) : null,
          tree.map((database) => h(
            "div",
            { key: database.name, className: "cedb-db" },
            h("div", { className: "cedb-db-name" }, database.name, database.tables.length === 0 ? h("span", { className: "cedb-db-hint" }, t("db.notLoaded")) : null),
            database.tables.map((entry) => {
              const key = `${database.name}:${entry.name}`;
              const open = expanded.has(key);
              return h(
                "div",
                { key, className: "cedb-table" },
                h(
                  "button",
                  {
                    type: "button",
                    className: `cedb-table-row${activeTab?.key === `table:${activeConn}:${database.name}:${entry.name}` ? " cedb-table-on" : ""}`,
                    title: `${entry.name} · ${entry.columns?.length ?? 0} ${t("db.columns")}`,
                    onClick: () => {
                      toggleTable(key);
                      openTable(activeConn, database.name, entry);
                    },
                    onDoubleClick: () => openQueryTab(`SELECT * FROM "${entry.name.replace(/"/g, '""')}" LIMIT 100;`)
                  },
                  h("span", { className: `cedb-kind cedb-kind-${entry.kind}` }, entry.kind === "view" ? "◇" : "▤"),
                  h("span", { className: "cedb-table-name" }, entry.name)
                ),
                open && entry.columns?.length ? h("ul", { className: "cedb-cols" }, entry.columns.map((column) => h(
                  "li",
                  { key: column.name, className: "cedb-col" },
                  h("span", { className: "cedb-col-name" }, column.name),
                  h("span", { className: "cedb-col-type" }, column.type),
                  column.primaryKey ? h("span", { className: "cedb-pk" }, "PK") : null,
                  column.nullable === false ? h("span", { className: "cedb-nn" }, "NN") : null
                ))) : null
              );
            })
          ))
        ) : null
      ),
      // ---- main ------------------------------------------------------------------
      h(
        "section",
        { className: "cedb-main" },
        h(
          "div",
          { className: "cedb-tabs", role: "tablist" },
          tabs.map((tab) => h(
            "div",
            { key: tab.id, className: `cedb-tab${tab.id === activeTabId ? " cedb-tab-on" : ""}` },
            h(
              "button",
              { type: "button", className: "cedb-tab-label", role: "tab", "aria-selected": tab.id === activeTabId, onClick: () => setActiveTabId(tab.id), title: tab.kind === "table" ? `${tab.table} · ${tab.database}` : tab.sql },
              h("span", { className: "cedb-tab-kind" }, tab.kind === "table" ? "▤" : "⌘"),
              tab.title
            ),
            h("button", { type: "button", className: "cedb-tab-close", title: t("close"), onClick: () => closeTab(tab.id) }, "✕")
          )),
          h("button", { type: "button", className: "cedb-tab-add", title: t("db.newQuery"), onClick: () => openQueryTab("") }, "＋")
        ),
        activeTab === null ? h(
          "div",
          { className: "cedb-placeholder" },
          h("div", { className: "cedb-placeholder-title" }, t("db.welcome")),
          h("div", { className: "cedb-placeholder-hint" }, t("db.welcomeHint"))
        ) : h(
          "div",
          { className: "cedb-tabbody" },
          // ---- query tab ----
          activeTab.kind === "query" ? h(
            Fragment,
            null,
            h(
              "div",
              { className: "cedb-editor" },
              h(
                "div",
                { className: "cedb-editor-bar" },
                h("select", {
                  className: "cedb-conn-select",
                  value: activeTab.conn || activeConn,
                  onChange: (event) => patchTab(activeTab.id, { conn: event.target.value }),
                  "aria-label": t("db.connections")
                }, connections.map((connection) => h("option", { key: connection.id, value: connection.id }, `${connection.driver} · ${connection.label}`))),
                activeTab.loading ? h("button", { type: "button", className: "ce-sk-btn cedb-run cedb-stop", onClick: () => void cancelQuery(activeTab) }, `■ ${t("db.stop")}`) : h("button", {
                  type: "button",
                  className: "ce-sk-btn ce-sk-primary cedb-run",
                  disabled: !String(activeTab.sql ?? "").trim(),
                  onClick: () => void runQuery(activeTab.id)
                }, `▶ ${t("db.run")}`),
                h("button", { type: "button", className: "ce-sk-btn", title: t("db.history"), onClick: () => setHistoryOpen((v) => !v) }, t("db.history")),
                h("span", { className: "ce-spacer" }),
                h("span", { className: "cedb-kbd" }, "⌘/Ctrl+Enter")
              ),
              h("textarea", {
                className: "cedb-sql",
                ref: sqlRef,
                rows: 4,
                value: activeTab.sql ?? "",
                placeholder: t("db.sqlPlaceholder"),
                spellCheck: false,
                onChange: (event) => patchTab(activeTab.id, { sql: event.target.value })
              })
            ),
            h(
              "div",
              { className: "cedb-result-head" },
              activeTab.result ? h(
                Fragment,
                null,
                h("span", { className: "cedb-chip" }, `${activeTab.result.rows?.length ?? 0} ${t("db.rows")}`),
                h("span", { className: "cedb-chip" }, `${activeTab.ms || activeTab.result.ms || 0} ms`),
                activeTab.result.truncated ? h("span", { className: "cedb-chip cedb-chip-warn" }, t("db.truncated")) : null,
                activeTab.result.changes !== void 0 ? h("span", { className: "cedb-chip" }, `${activeTab.result.changes} ${t("db.affected")}`) : null,
                activeTab.result.columns?.length ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.export"), onClick: () => exportResult(activeTab.result, activeTab.title) }, "⤓ CSV") : null
              ) : h("span", { className: "cedb-result-hint" }, t("db.runHint"))
            ),
            activeTab.error ? h("div", { className: "cedb-error" }, activeTab.error) : null,
            activeTab.result ? h(ResultGrid, { t, result: activeTab.result, onCell: setCellDetail }) : h("div", { className: "cedb-placeholder-small" }, t("db.runHint"))
          ) : h(
            Fragment,
            null,
            h(
              "div",
              { className: "cedb-tablebar" },
              h("span", { className: "cedb-tablebar-name" }, `${activeTab.database}.${activeTab.table}`),
              h("input", {
                className: "ce-input cedb-tablebar-filter",
                placeholder: t("db.filterRows"),
                value: activeTab.filter,
                onChange: (event) => patchTab(activeTab.id, { filter: event.target.value, offset: 0 }),
                onKeyDown: (event) => {
                  if (event.key === "Enter") void loadRows(activeTab.id, { filter: event.currentTarget.value, offset: 0 });
                }
              }),
              h("button", { type: "button", className: "ce-sk-btn", disabled: activeTab.loading, onClick: () => void loadRows(activeTab.id) }, activeTab.loading ? t("loading") : "⟳"),
              h("button", { type: "button", className: "ce-sk-btn", title: t("db.sqlForTable"), onClick: () => openQueryTab(`${tableSql(activeTab.table, { ...activeTab, limit: PAGE_SIZE, driver: connections.find((entry) => entry.id === activeTab.conn)?.driver }).replace(/;\s*$/, "")};`) }, "SQL"),
              h("span", { className: "ce-spacer" }),
              activeTab.result ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.export"), onClick: () => exportResult(activeTab.result, activeTab.table) }, "⤓ CSV") : null
            ),
            activeTab.error ? h("div", { className: "cedb-error" }, activeTab.error) : null,
            activeTab.result ? h(ResultGrid, { t, result: activeTab.result, onCell: setCellDetail, onSort: (column) => sortBy(activeTab.id, column), order: activeTab.order, dir: activeTab.dir }) : h("div", { className: "cedb-placeholder-small" }, activeTab.loading ? t("loading") : t("db.noRows")),
            h(
              "div",
              { className: "cedb-pager" },
              h("button", {
                type: "button",
                className: "ce-tool ce-tiny",
                disabled: activeTab.offset === 0 || activeTab.loading,
                onClick: () => {
                  const offset = Math.max(0, activeTab.offset - PAGE_SIZE);
                  patchTab(activeTab.id, { offset });
                  void loadRows(activeTab.id, { offset });
                }
              }, "←"),
              h(
                "span",
                { className: "cedb-pager-text" },
                `${activeTab.offset + 1}–${Math.min(activeTab.offset + PAGE_SIZE, activeTab.result?.total ?? 0)} / ${activeTab.result?.total ?? 0}`
              ),
              h("button", {
                type: "button",
                className: "ce-tool ce-tiny",
                disabled: activeTab.loading || activeTab.offset + PAGE_SIZE >= (activeTab.result?.total ?? 0),
                onClick: () => {
                  const offset = activeTab.offset + PAGE_SIZE;
                  patchTab(activeTab.id, { offset });
                  void loadRows(activeTab.id, { offset });
                }
              }, "→")
            )
          )
        )
      )
    ),
    // ---- connect dialog ---------------------------------------------------------------
    connectOpen ? h(
      "div",
      { className: "cedb-dialog", ref: connectRef, role: "dialog", "aria-label": t("db.newConnection") },
      h("h3", { className: "cedb-dialog-title" }, t("db.newConnection")),
      profiles.length === 0 ? null : h(
        "div",
        { className: "cedb-saved-pick" },
        h("span", { className: "cedb-saved-pick-title" }, `${t("db.recentConnections")} · ${t("db.useSaved")}`),
        profiles.map((profile) => h("button", {
          key: profile.id,
          type: "button",
          className: "cedb-saved-chip",
          title: profile.address || profile.path,
          onClick: () => useSavedProfile(profile)
        }, h("span", { className: `cedb-driver cedb-driver-${profile.driver}` }, profile.driver), profile.label))
      ),
      h(
        "label",
        { className: "cedb-field" },
        t("db.address"),
        h("input", {
          className: "ce-input",
          value: form.address,
          placeholder: t("db.addressPlaceholder"),
          autoFocus: true,
          spellcheck: false,
          autoComplete: "off",
          onChange: (event) => applyAddress(event.target.value),
          onBlur: () => {
            setAddressTouched(true);
            setNotice(parseConnectionAddress(form.address).error);
          }
        })
      ),
      h(
        "div",
        { className: `cedb-detect${form.driver === "" ? " cedb-detect-miss" : ""}` },
        h("span", null, form.driver === "" ? t("db.notDetected") : `${t("db.detected")}: ${driverLabel(form.driver)}${implSuffix(drivers.find((entry) => entry.id === form.driver), t)}`),
        driverReady || form.driver === "" ? null : h("span", { className: "cedb-detect-note" }, drivers.find((entry) => entry.id === form.driver)?.note ?? ""),
        form.driver === "" ? null : h("button", {
          type: "button",
          className: "cedb-redetect",
          title: t("db.redetectHint"),
          onClick: () => void probeDrivers(true)
        }, t("db.redetect"))
      ),
      // Say which binary will actually run: a keg-only install answers
      // "installed where?" without the user opening a shell.
      (form.driver === "mysql" || form.driver === "postgres") && String(form.clientPath ?? "").trim() === "" ? h(
        "div",
        { className: "cedb-bin" },
        drivers.find((entry) => entry.id === form.driver)?.bin ? `${t("db.clientBin")}: ${drivers.find((entry) => entry.id === form.driver).bin}` : t("db.clientBinMissing")
      ) : null,
      advanced ? h(
        Fragment,
        null,
        h(
          "label",
          { className: "cedb-field" },
          t("db.driver"),
          h("select", {
            className: "ce-input",
            value: form.driver,
            onChange: (event) => setForm({ ...form, driver: event.target.value })
            // Always populated: an unprobed deployment still shows the
            // drivers it could open, instead of an empty box.
          }, DRIVERS.map((id) => {
            const known = drivers.find((entry) => entry.id === id);
            return h("option", { key: id, value: id }, known && !known.ready ? `${known.label} — ${known.note}` : driverLabel(id));
          }))
        ),
        form.driver === "sqlite" ? h(
          "label",
          { className: "cedb-field" },
          t("db.path"),
          h("input", { className: "ce-input", value: form.path, placeholder: "/path/to/app.sqlite", onChange: (event) => setForm({ ...form, path: event.target.value }) })
        ) : h(
          Fragment,
          null,
          h(
            "div",
            { className: "cedb-field-row" },
            h("label", { className: "cedb-field" }, t("db.host"), h("input", { className: "ce-input", value: form.host, onChange: (event) => setForm({ ...form, host: event.target.value }) })),
            h("label", { className: "cedb-field cedb-field-narrow" }, t("db.port"), h("input", { className: "ce-input", type: "number", value: form.port, placeholder: form.driver === "mysql" ? "3306" : "5432", onChange: (event) => setForm({ ...form, port: event.target.value }) }))
          ),
          h("label", { className: "cedb-field" }, t("db.database"), h("input", { className: "ce-input", value: form.database, onChange: (event) => setForm({ ...form, database: event.target.value }) })),
          h(
            "div",
            { className: "cedb-field-row" },
            h("label", { className: "cedb-field" }, t("db.user"), h("input", { className: "ce-input", value: form.user, onChange: (event) => setForm({ ...form, user: event.target.value }) })),
            h("label", { className: "cedb-field" }, t("db.password"), h("input", { className: "ce-input", type: "password", value: form.password, onChange: (event) => setForm({ ...form, password: event.target.value }) }))
          ),
          h(
            "label",
            { className: "cedb-field" },
            t("db.clientPath"),
            h("input", {
              className: "ce-input",
              value: form.clientPath,
              placeholder: form.driver === "mysql" ? "/opt/homebrew/opt/mysql-client/bin/mysql" : "/opt/homebrew/opt/postgresql@16/bin/psql",
              spellCheck: false,
              onChange: (event) => setForm({ ...form, clientPath: event.target.value })
            })
          )
        )
      ) : h("button", {
        type: "button",
        className: "cedb-advanced",
        "aria-expanded": advanced,
        onClick: () => setAdvanced(true)
      }, t("db.advanced")),
      notice !== "" && connectOpen ? h("div", { className: "cedb-dialog-error", role: "alert" }, notice) : null,
      h(
        "label",
        { className: "cedb-remember" },
        h("input", { type: "checkbox", checked: saveProfile, onChange: (event) => setSaveProfile(event.target.checked) }),
        t("db.remember")
      ),
      testState.ok !== null || testState.text !== "" ? h("div", { className: `cedb-dialog-test${testState.ok === true ? " cedb-dialog-test-ok" : " cedb-dialog-test-bad"}`, role: "status" }, testState.text) : null,
      h(
        "div",
        { className: "cedb-dialog-actions" },
        h("button", { type: "button", className: "ce-sk-btn", disabled: !canConnect || testState.busy, onClick: () => void doTest() }, testState.busy ? t("loading") : t("db.testAction")),
        h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", disabled: !canConnect, onClick: () => void doConnect() }, t("db.connectAction")),
        h("button", { type: "button", className: "ce-sk-btn", onClick: () => setConnectOpen(false) }, t("editor.cancel"))
      )
    ) : null,
    // ---- history drawer ---------------------------------------------------------------
    historyOpen && history.length > 0 ? h(
      "div",
      { className: "cedb-history" },
      h(
        "div",
        { className: "cedb-history-head" },
        h("span", null, t("db.history")),
        h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setHistoryOpen(false) }, "✕")
      ),
      history.map((entry, index) => h(
        "button",
        {
          key: `${entry.at}-${index}`,
          type: "button",
          className: "cedb-history-row",
          title: entry.sql,
          onClick: () => {
            const id = openQueryTab(entry.sql);
            setHistoryOpen(false);
            setActiveTabId(id);
          }
        },
        h("span", { className: "cedb-history-sql" }, entry.sql.slice(0, 120)),
        h("span", { className: "cedb-history-ms" }, `${entry.ms} ms`)
      ))
    ) : null,
    // ---- cell detail ------------------------------------------------------------------
    cellDetail ? h(
      "div",
      { className: "cedb-cell-detail", ref: detailRef, role: "dialog", "aria-label": cellDetail.title },
      h(
        "div",
        { className: "cedb-cell-head" },
        h("span", { className: "cedb-cell-title" }, cellDetail.title),
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setCellDetail(null) }, "✕")
      ),
      h("pre", { className: "cedb-cell-body" }, formatCell(cellDetail.value))
    ) : null
  );
}
function DbTitle() {
  return null;
}
function implSuffix(driver, t) {
  if (!driver || !driver.impl) return "";
  if (driver.impl === "module") return ` · ${driver.version || t("db.implModule")}`;
  if (driver.impl === "cli") return ` · ${t("db.implCli")}`;
  return ` · ${t("db.implEmbedded")}`;
}
var GRID_ROW_H = 24;
function gridWindow(input = {}) {
  const count = Math.max(0, Math.floor(Number(input.count) || 0));
  const rawRowHeight = Number(input.rowHeight);
  const rowHeight = Number.isFinite(rawRowHeight) && rawRowHeight > 0 ? rawRowHeight : GRID_ROW_H;
  const rawOverscan = Number(input.overscan);
  const overscan = Number.isFinite(rawOverscan) ? Math.max(0, Math.floor(rawOverscan)) : 8;
  const viewport = Math.max(0, Number(input.viewport) || 0);
  const scrollTop = Math.max(0, Number(input.scrollTop) || 0);
  const span = Math.ceil(viewport / rowHeight) + overscan * 2;
  const start = Math.min(count, Math.max(0, Math.floor(scrollTop / rowHeight) - overscan));
  const end = Math.min(count, start + span);
  return { start, end, topPad: start * rowHeight, bottomPad: Math.max(0, (count - end) * rowHeight) };
}
function ResultGrid({ t, result, onCell, onSort, order, dir }) {
  const columns = result.columns ?? [];
  const rows = result.rows ?? [];
  const wrapRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(360);
  useEffect(() => {
    setScrollTop(0);
    if (wrapRef.current) wrapRef.current.scrollTop = 0;
  }, [result]);
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return void 0;
    const measure = () => setViewport(node.clientHeight || 360);
    measure();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    }
    return void 0;
  }, [columns.length]);
  if (columns.length === 0) return h("div", { className: "cedb-placeholder-small" }, t("db.noRows"));
  const window_ = gridWindow({ count: rows.length, scrollTop, viewport });
  const slice = rows.slice(window_.start, window_.end);
  const pad = (height, key) => height > 0 ? h("tr", { key, className: "cedb-grid-pad", "aria-hidden": "true" }, h("td", { colSpan: columns.length + 1, style: { height: `${height}px`, padding: 0, border: 0 } })) : null;
  return h(
    "div",
    { className: "cedb-grid-wrap", ref: wrapRef, onScroll: (event) => setScrollTop(event.currentTarget.scrollTop) },
    h(
      "table",
      { className: "cedb-grid" },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { className: "cedb-grid-gutter" }, "#"),
          columns.map((column, index) => h("th", {
            key: `${column}-${index}`,
            className: `cedb-grid-th${onSort ? " cedb-grid-sortable" : ""}${order === column ? " cedb-grid-sorted" : ""}`,
            onClick: onSort ? () => onSort(column) : void 0,
            title: column
          }, column, order === column ? dir === "desc" ? " ↓" : " ↑" : ""))
        )
      ),
      h(
        "tbody",
        null,
        pad(window_.topPad, "pad-top"),
        slice.map((row, offset) => {
          const rowIndex = window_.start + offset;
          return h(
            "tr",
            { key: rowIndex, className: "cedb-grid-row" },
            h("td", { className: "cedb-grid-gutter" }, rowIndex + 1),
            row.map((cell, cellIndex) => h("td", {
              key: cellIndex,
              className: `cedb-grid-td${cell === null ? " cedb-null" : ""}`,
              title: formatCell(cell),
              onClick: () => onCell?.({ title: `${columns[cellIndex]} · ${t("db.row")} ${rowIndex + 1}`, value: cell })
            }, truncateCell(cell)))
          );
        }),
        pad(window_.bottomPad, "pad-bottom")
      )
    )
  );
}

// src/client/grpcaddr.js
var GRPC_SCHEMES = ["grpc://", "grpcs://"];
function splitAddress(value) {
  const text = String(value ?? "").trim();
  const lower = text.toLowerCase();
  for (const scheme of GRPC_SCHEMES) {
    if (lower.startsWith(scheme)) return { scheme, host: text.slice(scheme.length) };
  }
  return { scheme: "grpc://", host: text };
}
function joinAddress(scheme, host) {
  const known = GRPC_SCHEMES.includes(scheme) ? scheme : "grpc://";
  const text = String(host ?? "").trim();
  if (text === "") return "";
  const inner = splitAddress(text);
  if (inner.host !== text) return `${inner.scheme}${inner.host}`;
  return `${known}${text}`;
}

// src/client/rpc.js
function parseJsonText(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed === "") return { value: {}, error: "" };
  try {
    return { value: JSON.parse(trimmed), error: "" };
  } catch (error) {
    return { value: null, error: String(error?.message ?? error) };
  }
}
function methodArrows(method) {
  if (method?.clientStreaming && method?.serverStreaming) return "↔";
  if (method?.clientStreaming) return "→|";
  if (method?.serverStreaming) return "|→";
  return "→";
}
function groupMethods(methods) {
  const groups = /* @__PURE__ */ new Map();
  for (const method of methods ?? []) {
    if (!groups.has(method.service)) groups.set(method.service, []);
    groups.get(method.service).push(method);
  }
  return [...groups.entries()].map(([service, entries]) => ({ service, methods: entries }));
}
function splitProtoPath(path) {
  const text = String(path ?? "");
  const cut = text.lastIndexOf("/");
  return cut < 0 ? { dir: "", name: text } : { dir: text.slice(0, cut + 1), name: text.slice(cut + 1) };
}
function ProtoPicker({ t, cwd, box, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [busy, setBusy] = useState(true);
  const [index, setIndex] = useState(0);
  const panelRef = useDismissLayer({ open: true, onDismiss: onClose, ignoreSelector: '[data-ce-popup-trigger="rpc-proto"]' });
  useEffect(() => {
    let alive = true;
    setBusy(true);
    const timer = setTimeout(() => {
      api("search.files", { cwd, query, suffix: ".proto", limit: 200 }).then((res) => {
        if (!alive) return;
        setBusy(false);
        const paths2 = (res.ok ? res.value.matches ?? [] : []).map((entry) => entry.path).filter((path) => typeof path === "string" && path.toLowerCase().endsWith(".proto"));
        setMatches(query.trim() === "" ? paths2.sort((a, b) => a.localeCompare(b)) : paths2);
        setIndex(0);
      });
    }, 120);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [cwd, query]);
  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((value) => Math.min(matches.length - 1, value + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((value) => Math.max(0, value - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (matches[index]) onPick(matches[index]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };
  return h(
    "div",
    {
      className: "cerpc-picker cerpc-picker-floating",
      ref: panelRef,
      role: "dialog",
      "aria-label": t("rpc.pickProto"),
      style: box ? { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px` } : void 0,
      onKeyDown
    },
    h("input", {
      className: "ce-input cerpc-picker-input",
      value: query,
      autoFocus: true,
      spellCheck: false,
      placeholder: t("rpc.pickPlaceholder"),
      onChange: (event) => setQuery(event.target.value)
    }),
    matches.length === 0 ? h(
      "div",
      { className: "cerpc-picker-empty" },
      busy ? t("loading") : h(
        Fragment,
        null,
        h("div", { className: "cerpc-picker-empty-title" }, t("rpc.noProto")),
        h("div", { className: "cerpc-picker-empty-hint" }, t("rpc.noProtoHint"))
      )
    ) : h(
      Fragment,
      null,
      h("div", { className: "cerpc-picker-list ce-scroll" }, matches.map((path, position) => {
        const parts = splitProtoPath(path);
        return h(
          "button",
          {
            key: path,
            type: "button",
            className: `cerpc-picker-row${position === index ? " cerpc-picker-row-on" : ""}`,
            title: path,
            onMouseEnter: () => setIndex(position),
            onClick: () => onPick(path)
          },
          h("span", { className: "cerpc-picker-dir" }, parts.dir),
          h("span", { className: "cerpc-picker-name" }, parts.name)
        );
      })),
      h("div", { className: "cerpc-picker-foot" }, `${matches.length} ${t("rpc.protoCount")}`)
    )
  );
}
function RpcView({ t, useTabInfo, sessionId, useSessions, incoming }) {
  const cwd = useSessions ? useSessions((sessions) => sessionId ? sessions.byId[sessionId]?.cwd : void 0) : void 0;
  const [address, setAddress] = useState("");
  const [protoPath, setProtoPath] = useState("");
  const [methods, setMethods] = useState([]);
  const [protoError, setProtoError] = useState("");
  const [protoFiles, setProtoFiles] = useState([]);
  const [protoBusy, setProtoBusy] = useState(false);
  const [schemaId, setSchemaId] = useState("");
  const requestRef = useRef(null);
  const [selected, setSelected] = useState("");
  const [requestText, setRequestText] = useState("{}");
  const [metadata, setMetadata] = useState([]);
  const [response, setResponse] = useState(null);
  const [busy, setBusy] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(3e4);
  const [insecureTls, setInsecureTls] = useState(false);
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]);
  const [envStore, setEnvStore] = useState({ envs: [], activeId: null });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("history");
  const [confirmClear, setConfirmClear] = useState(false);
  const drawerRef = useDismissLayer({ open: drawerOpen, onDismiss: () => setDrawerOpen(false), ignoreSelector: '[data-ce-popup-trigger="rpc-history"]' });
  const keys = useMemo(() => ({
    history: apiKey("history", cwd ?? ""),
    saved: apiKey("saved", cwd ?? ""),
    env: apiKey("env", cwd ?? "")
  }), [cwd]);
  const readStored = useCallback(() => {
    const read = (key) => {
      try {
        const raw = localStorage.getItem(key);
        const value = raw === null ? null : JSON.parse(raw);
        return Array.isArray(value) ? value : null;
      } catch {
        return null;
      }
    };
    if (cwd) migrateLegacyApiStores(cwd);
    setHistory(filterByProtocol(read(keys.history), "grpc"));
    setSaved(filterByProtocol(read(keys.saved), "grpc"));
    try {
      const env = JSON.parse(localStorage.getItem(keys.env) ?? "null");
      setEnvStore(env && typeof env === "object" && Array.isArray(env.envs) ? env : { envs: [], activeId: null });
    } catch {
      setEnvStore({ envs: [], activeId: null });
    }
  }, [cwd, keys]);
  useEffect(() => {
    readStored();
  }, [readStored]);
  const writeMerged = useCallback((key, entry, cap = Number.POSITIVE_INFINITY) => {
    let rows = [];
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      if (Array.isArray(raw)) rows = raw;
    } catch {
      rows = [];
    }
    const next = [entry, ...rows.filter((row) => row?.id !== entry.id)].slice(0, cap);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
    }
    return next;
  }, []);
  const applyEntry = useCallback((entry) => {
    const request2 = entry?.request ?? {};
    if (typeof request2.address === "string") setAddress(request2.address);
    if (typeof request2.proto === "string") setProtoPath(request2.proto);
    if (typeof request2.method === "string") setSelected(request2.method);
    if (request2.body !== void 0) setRequestText(JSON.stringify(request2.body, null, 2));
    if (Array.isArray(request2.metadata)) setMetadata(request2.metadata.map((row) => ({ ...row })));
    setResponse(null);
    setDrawerOpen(false);
  }, []);
  useEffect(() => {
    if (!incoming || incoming.protocol !== "grpc" || !incoming.entry) return;
    applyEntry(incoming.entry);
  }, [incoming?.nonce]);
  const selectedMethod = useMemo(() => methods.find((method) => method.path === selected) ?? null, [methods, selected]);
  const groups = useMemo(() => groupMethods(methods), [methods]);
  const request = useMemo(() => parseJsonText(requestText), [requestText]);
  useAutoHeight(requestRef, requestText, { min: 96 });
  const loadProto = useCallback(async (overridePath) => {
    const path = String(overridePath ?? protoPath).trim();
    if (path === "") {
      setProtoError(t("rpc.protoRequired"));
      return;
    }
    setProtoBusy(true);
    setProtoError("");
    const res = await api("rpc.proto", { cwd, path });
    setProtoBusy(false);
    if (!res.ok) {
      setProtoError(res.error);
      setMethods([]);
      return;
    }
    if (res.value?.error) {
      setProtoError(res.value.error);
      setMethods([]);
      return;
    }
    setMethods(res.value.methods ?? []);
    setProtoFiles(res.value.files ?? []);
    setSchemaId("");
    const first = res.value.methods?.[0];
    if (first) {
      setSelected(first.path);
      setRequestText(JSON.stringify(first.sample ?? {}, null, 2));
    }
  }, [cwd, protoPath, t]);
  const discoverSchema = useCallback(async () => {
    const target = address.trim();
    if (target === "") {
      setProtoError(t("rpc.addressRequired"));
      return;
    }
    setProtoBusy(true);
    setProtoError("");
    const res = await api("rpc.discover", { url: target, insecureTls, timeoutMs });
    setProtoBusy(false);
    const value = res.ok ? res.value : { error: res.error };
    if (value.error) {
      setProtoError(`${t("rpc.reflectionUnavailable")}: ${value.error}`);
      return;
    }
    setMethods(value.methods ?? []);
    setProtoFiles(value.files ?? []);
    setSchemaId(value.schemaId ?? "");
    const skipped = value.skipped ?? [];
    if (skipped.length > 0) {
      setProtoError(`${t("rpc.skippedServices")}: ${skipped.map((entry) => entry.service ?? entry).join(", ")}`);
    }
    const first = value.methods?.[0];
    if (first) {
      setSelected(first.path);
      setRequestText(JSON.stringify(first.sample ?? {}, null, 2));
    }
  }, [address, insecureTls, timeoutMs, t]);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    if (!pickerOpen) return void 0;
    const close = () => setPickerOpen(false);
    globalThis.addEventListener?.("resize", close);
    globalThis.addEventListener?.("scroll", close, true);
    return () => {
      globalThis.removeEventListener?.("resize", close);
      globalThis.removeEventListener?.("scroll", close, true);
    };
  }, [pickerOpen]);
  const protoAnchor = useRef(null);
  const [pickerBox, setPickerBox] = useState(null);
  const openPicker = useCallback(() => {
    const rect = protoAnchor.current?.getBoundingClientRect?.();
    if (rect) {
      const viewport = Number(globalThis.innerWidth) || 1200;
      const left = Math.max(8, Math.min(rect.left, viewport - 320));
      setPickerBox({ left, top: rect.bottom + 6, width: Math.min(560, Math.max(320, viewport - left - 16)) });
    }
    setPickerOpen(true);
  }, []);
  const recentProtos = useMemo(() => {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const entry of history) {
      const path = entry?.request?.proto;
      if (typeof path !== "string" || path === "" || seen.has(path)) continue;
      seen.add(path);
      out.push(path);
      if (out.length >= 4) break;
    }
    return out;
  }, [history]);
  const addressParts = splitAddress(address);
  const pickProto = useCallback((path) => {
    setPickerOpen(false);
    setProtoPath(path);
    void loadProto(path);
  }, [loadProto]);
  const removeEntry = useCallback((entry) => {
    removeHistoryEntry(drawerTab === "history" ? keys.history : keys.saved, entry.id);
    readStored();
  }, [drawerTab, keys.history, keys.saved, readStored]);
  const clearEntries = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearHistoryEntries(drawerTab === "history" ? keys.history : keys.saved);
    readStored();
    setConfirmClear(false);
  }, [confirmClear, drawerTab, keys.history, keys.saved, readStored]);
  const chooseMethod = useCallback((method) => {
    setSelected(method.path);
    if (requestText.trim() === "{}" || requestText.trim() === "") setRequestText(JSON.stringify(method.sample ?? {}, null, 2));
  }, [requestText]);
  const invoke = useCallback(async () => {
    if (!selectedMethod || busy) return;
    if (request.error) return;
    setBusy(true);
    setResponse(null);
    const vars = activeVariables(envStore);
    const meta = {};
    for (const row of metadata) {
      const name = interpolateVariables(String(row.name ?? "").trim(), vars);
      if (name !== "" && row.enabled !== false) meta[name] = interpolateVariables(String(row.value ?? ""), vars);
    }
    const body = interpolateDeep(request.value, vars);
    const target = interpolateVariables(address.trim(), vars);
    const res = await api("rpc.call", {
      cwd,
      proto: protoPath.trim(),
      ...schemaId ? { schemaId } : {},
      method: selectedMethod.path,
      url: target,
      messages: [body],
      metadata: meta,
      timeoutMs,
      insecureTls
    });
    setBusy(false);
    const value = res.ok ? res.value : { error: res.error };
    setResponse(value);
    const entry = withProtocol({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      status: value?.status,
      ms: value?.ms,
      error: value?.error ?? void 0,
      request: {
        address: target,
        proto: protoPath.trim(),
        method: selectedMethod.path,
        body,
        metadata: metadata.filter((row) => String(row.name ?? "").trim() !== "" && row.enabled !== false).map((row) => ({ ...row }))
      }
    }, "grpc");
    const merged = writeMerged(keys.history, entry, HISTORY_CAP);
    setHistory(filterByProtocol(merged, "grpc"));
  }, [busy, cwd, protoPath, selectedMethod, address, request, metadata, timeoutMs, insecureTls, envStore, keys.history]);
  const saveFavorite = useCallback(() => {
    if (!selectedMethod) return;
    const name = `${selectedMethod.name} → ${interpolateVariables(address.trim(), activeVariables(envStore)) || "?"}`;
    const entry = withProtocol({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      name,
      request: {
        address: address.trim(),
        proto: protoPath.trim(),
        method: selectedMethod.path,
        body: request.value ?? {},
        metadata: metadata.filter((row) => String(row.name ?? "").trim() !== "" && row.enabled !== false).map((row) => ({ ...row }))
      }
    }, "grpc");
    const merged = writeMerged(keys.saved, entry).filter((row) => row?.name !== name || row.id === entry.id);
    try {
      localStorage.setItem(keys.saved, JSON.stringify(merged));
    } catch {
    }
    setSaved(filterByProtocol(merged, "grpc"));
  }, [selectedMethod, address, envStore, protoPath, request, metadata, keys.saved]);
  const onKeyDown = useCallback((event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void invoke();
    }
  }, [invoke]);
  if (!cwd) {
    return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
  }
  const okStatus = response && !response.error && response.status === 0;
  return h(
    "div",
    { className: "ce-root cerpc-root", onKeyDown },
    // ---- toolbar ---------------------------------------------------------------------
    h(
      "div",
      { className: "cerpc-toolbar" },
      h(
        "label",
        { className: "cerpc-field" },
        h("span", { className: "cerpc-label" }, t("rpc.address")),
        h(
          "div",
          { className: "cerpc-address" },
          h("select", {
            className: "ce-input cerpc-scheme",
            value: addressParts.scheme,
            "aria-label": t("rpc.scheme"),
            onChange: (event) => setAddress(joinAddress(event.target.value, addressParts.host))
          }, GRPC_SCHEMES.map((scheme) => h("option", { key: scheme, value: scheme }, scheme))),
          h("input", {
            className: "ce-input cerpc-input cerpc-host",
            value: addressParts.host,
            spellCheck: false,
            placeholder: "10.0.0.1:50051",
            onChange: (event) => setAddress(joinAddress(addressParts.scheme, event.target.value))
          })
        )
      ),
      h(
        "div",
        { className: "cerpc-field cerpc-proto" },
        h("span", { className: "cerpc-label" }, t("rpc.proto")),
        h(
          "div",
          { className: "cerpc-proto-row", ref: protoAnchor },
          h("input", { className: "ce-input cerpc-input", value: protoPath, spellCheck: false, placeholder: "proto/hello.proto", onChange: (event) => setProtoPath(event.target.value) }),
          h("button", {
            type: "button",
            className: "ce-sk-btn",
            "data-ce-popup-trigger": "rpc-proto",
            "aria-expanded": pickerOpen,
            title: t("rpc.browseHint"),
            onClick: () => pickerOpen ? setPickerOpen(false) : openPicker()
          }, t("rpc.browse"))
        ),
        pickerOpen ? h(ProtoPicker, { t, cwd, box: pickerBox, onPick: pickProto, onClose: () => setPickerOpen(false) }) : null
      ),
      h("button", { type: "button", className: "ce-sk-btn", disabled: protoBusy, onClick: () => void loadProto() }, protoBusy ? t("loading") : t("rpc.load")),
      h("button", {
        type: "button",
        className: "ce-sk-btn ce-sk-btn-ghost",
        disabled: protoBusy || address.trim() === "",
        title: t("rpc.discoverHint"),
        onClick: () => void discoverSchema()
      }, t("rpc.discover")),
      h("button", {
        type: "button",
        className: `ce-sk-btn ce-sk-btn-ghost${drawerOpen ? " cea-btn-on" : ""}`,
        "data-ce-popup-trigger": "rpc-history",
        "aria-expanded": drawerOpen,
        title: t("api.history"),
        onClick: () => setDrawerOpen((open) => !open)
      }, `${t("api.history")} ${history.length}`),
      h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: !selectedMethod, title: t("api.saveTitle"), onClick: saveFavorite }, t("api.saveBtn"))
    ),
    protoError ? h("div", { className: "cedb-error" }, protoError) : null,
    drawerOpen ? h(
      "div",
      { className: "cea-hist cerpc-hist", ref: drawerRef, role: "dialog", "aria-label": t("api.history") },
      h(
        "div",
        { className: "cea-hist-tabs" },
        h("button", { type: "button", className: `cea-tab${drawerTab === "history" ? " cea-tab-on" : ""}`, onClick: () => setDrawerTab("history") }, `${t("api.history")} · ${history.length}`),
        h("button", { type: "button", className: `cea-tab${drawerTab === "saved" ? " cea-tab-on" : ""}`, onClick: () => setDrawerTab("saved") }, `${t("api.saved")} · ${saved.length}`),
        h("span", { className: "ce-spacer" }),
        (drawerTab === "history" ? history : saved).length > 0 ? h("button", { type: "button", className: "ce-link", title: t("api.clear"), onClick: clearEntries }, confirmClear ? t("api.clearConfirm") : t("api.clear")) : null,
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => {
          setDrawerOpen(false);
          setConfirmClear(false);
        } }, "✕")
      ),
      h(
        "div",
        { className: "cea-hist-list ce-scroll" },
        (drawerTab === "history" ? history : saved).length === 0 ? h("div", { className: "cea-he" }, t("api.histEmpty")) : (drawerTab === "history" ? history : saved).map((entry) => h(
          "div",
          { key: entry.id, className: "cea-hist-item" },
          h(
            "button",
            {
              type: "button",
              className: "cea-hist-row",
              title: entryLabel(entry),
              onClick: () => {
                applyEntry(entry);
                setDrawerTab("history");
              }
            },
            h("span", { className: "cedb-chip" }, entry.status ?? "—"),
            h("span", { className: "cea-hist-url" }, entryLabel(entry)),
            h("span", { className: "cea-hist-ms" }, entry.ms === void 0 ? "" : `${entry.ms} ms`)
          ),
          h("button", {
            type: "button",
            className: "ce-tool ce-tiny cea-hist-del",
            title: t("api.delete"),
            "aria-label": t("api.delete"),
            onClick: () => removeEntry(entry)
          }, "✕")
        ))
      )
    ) : null,
    methods.length === 0 && !protoBusy ? h(
      "div",
      { className: "cerpc-onboard" },
      h(
        "div",
        { className: "cerpc-onboard-icon", "aria-hidden": "true" },
        h(
          "svg",
          { viewBox: "0 0 24 24", width: 30, height: 30, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M6 4v6a4 4 0 0 0 4 4h4" }),
          h("path", { d: "M18 4v6a4 4 0 0 1-4 4h-4" }),
          h("circle", { cx: 6, cy: 3, r: 1.6 }),
          h("circle", { cx: 18, cy: 3, r: 1.6 })
        )
      ),
      h("h3", { className: "cerpc-onboard-title" }, t("rpc.onboardTitle")),
      h("p", { className: "cerpc-onboard-body" }, t("rpc.onboardBody")),
      h(
        "div",
        { className: "cerpc-onboard-actions" },
        h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: openPicker }, t("rpc.browse")),
        h("button", { type: "button", className: "ce-sk-btn", disabled: address.trim() === "" || protoBusy, title: t("rpc.discoverHint"), onClick: () => void discoverSchema() }, t("rpc.discover"))
      ),
      recentProtos.length === 0 ? null : h(
        "div",
        { className: "cerpc-onboard-recent" },
        h("div", { className: "cerpc-onboard-recent-title" }, t("rpc.recentProtos")),
        recentProtos.map((path) => h("button", {
          key: path,
          type: "button",
          className: "cerpc-onboard-recent-row",
          title: path,
          onClick: () => pickProto(path)
        }, splitProtoPath(path).dir, h("span", { className: "cerpc-picker-name" }, splitProtoPath(path).name)))
      )
    ) : h(
      "div",
      { className: "cerpc-body" },
      // ---- method rail ------------------------------------------------------------
      h(
        "aside",
        { className: "cerpc-rail" },
        methods.length === 0 ? h("div", { className: "cedb-empty" }, t("rpc.noMethods")) : groups.map((group) => h(
          "div",
          { key: group.service, className: "cerpc-service" },
          h("div", { className: "cerpc-service-name", title: group.service }, group.service.split(".").pop()),
          group.methods.map((method) => h(
            "button",
            {
              key: method.path,
              type: "button",
              className: `cerpc-method${method.path === selected ? " cerpc-method-on" : ""}`,
              title: `${method.request} → ${method.response}`,
              onClick: () => chooseMethod(method)
            },
            h("span", { className: "cerpc-arrow" }, methodArrows(method)),
            h("span", { className: "cerpc-method-name" }, method.name)
          ))
        )),
        protoFiles.length > 0 ? h("div", { className: "cerpc-files" }, protoFiles.map((file) => h("div", { key: file, className: "cerpc-file" }, file))) : null
      ),
      // ---- request / response -----------------------------------------------------
      h(
        "section",
        { className: "cerpc-main" },
        h(
          "div",
          { className: "cerpc-pane" },
          h(
            "div",
            { className: "cerpc-pane-head" },
            h("span", { className: "cerpc-pane-title" }, t("rpc.request")),
            selectedMethod ? h("span", { className: "cedb-chip" }, selectedMethod.request) : null,
            h("span", { className: "ce-spacer" }),
            h(
              "label",
              { className: "cerpc-inline" },
              h("input", { type: "checkbox", checked: insecureTls, onChange: (event) => setInsecureTls(event.target.checked) }),
              t("rpc.insecureTls")
            ),
            h("input", {
              className: "ce-input cerpc-timeout",
              type: "number",
              value: timeoutMs,
              "aria-label": t("rpc.timeout"),
              onChange: (event) => setTimeoutMs(Number(event.target.value) || 3e4)
            }),
            h("span", { className: "cedb-kbd" }, "ms")
          ),
          h("textarea", {
            className: `cedb-sql cerpc-json${request.error ? " cerpc-json-bad" : ""}`,
            ref: requestRef,
            rows: 6,
            value: requestText,
            spellCheck: false,
            onChange: (event) => setRequestText(event.target.value)
          }),
          request.error ? h("div", { className: "cerpc-json-error" }, request.error) : null,
          h(
            "div",
            { className: "cerpc-meta-head" },
            h("span", { className: "cerpc-pane-title" }, t("rpc.metadata")),
            h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setMetadata((current) => [...current, { name: "", value: "", enabled: true }]) }, "＋")
          ),
          metadata.length === 0 ? h("div", { className: "cerpc-meta-empty" }, t("rpc.noMetadata")) : h("div", { className: "cerpc-meta-list" }, metadata.map((row, index) => h(
            "div",
            { key: index, className: "cerpc-meta-row" },
            h("input", { type: "checkbox", checked: row.enabled !== false, onChange: (event) => setMetadata((cur) => cur.map((entry, i) => i === index ? { ...entry, enabled: event.target.checked } : entry)) }),
            h("input", { className: "ce-input cerpc-meta-name", value: row.name, placeholder: "authorization", spellCheck: false, onChange: (event) => setMetadata((cur) => cur.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry)) }),
            h("input", { className: "ce-input cerpc-meta-value", value: row.value, placeholder: "Bearer …", spellCheck: false, onChange: (event) => setMetadata((cur) => cur.map((entry, i) => i === index ? { ...entry, value: event.target.value } : entry)) }),
            h("button", { type: "button", className: "ce-tool ce-tiny", title: t("close"), onClick: () => setMetadata((cur) => cur.filter((_, i) => i !== index)) }, "✕")
          ))),
          h(
            "div",
            { className: "cerpc-actions" },
            h("button", {
              type: "button",
              className: "ce-sk-btn ce-sk-primary",
              disabled: busy || !selectedMethod || Boolean(request.error),
              onClick: () => void invoke()
            }, busy ? t("loading") : `▶ ${t("rpc.invoke")}`),
            h("span", { className: "cedb-kbd" }, "⌘/Ctrl+Enter")
          )
        ),
        // ---- response ---------------------------------------------------------
        h(
          "div",
          { className: "cerpc-pane cerpc-response" },
          h(
            "div",
            { className: "cerpc-pane-head" },
            h("span", { className: "cerpc-pane-title" }, t("rpc.response")),
            response && !response.error ? h(
              Fragment,
              null,
              h("span", { className: `cedb-chip${okStatus ? "" : " cedb-chip-warn"}` }, `${response.status} ${response.statusName}`),
              response.message ? h("span", { className: "cerpc-status-msg" }, response.message) : null,
              h("span", { className: "cedb-chip" }, `${response.ms} ms`),
              h("span", { className: "cedb-chip" }, `${response.messages?.length ?? 0} ${t("rpc.messages")}`),
              response.truncated ? h("span", { className: "cedb-chip cedb-chip-warn" }, t("db.truncated")) : null
            ) : null
          ),
          response?.error ? h("div", { className: "cedb-error" }, response.error) : response ? h(
            "div",
            { className: "cerpc-result" },
            (response.messages ?? []).map((message, index) => h(
              "div",
              { key: index, className: "cerpc-message" },
              h("div", { className: "cerpc-message-head" }, `#${index + 1}`),
              h("pre", { className: "cerpc-message-body" }, JSON.stringify(message, null, 2))
            )),
            (response.messages ?? []).length === 0 ? h(
              "div",
              { className: "cerpc-resp-empty" },
              h("span", { className: "cerpc-resp-empty-icon", "aria-hidden": "true" }, "◌"),
              h("span", null, t("rpc.emptyResponse"))
            ) : null,
            Object.keys(response.trailers ?? {}).length > 0 ? h(
              "div",
              { className: "cerpc-trailers" },
              h("div", { className: "cerpc-pane-title" }, t("rpc.trailers")),
              Object.entries(response.trailers).map(([name, value]) => h(
                "div",
                { key: name, className: "cerpc-trailer" },
                h("span", { className: "cerpc-trailer-name" }, name),
                h("span", { className: "cerpc-trailer-value" }, value)
              ))
            ) : null
          ) : h(
            "div",
            { className: "cedb-placeholder" },
            h("div", { className: "cedb-placeholder-title" }, t("rpc.welcome")),
            h("div", { className: "cedb-placeholder-hint" }, t("rpc.welcomeHint"))
          )
        )
      )
    )
  );
}
function RpcTitle({ useTabInfo }) {
  const info = useTabInfo ? useTabInfo() : null;
  const title = info?.tab?.title;
  const label = typeof title === "string" && title !== "" ? title : "gRPC";
  return h("span", { className: "cerpc-title" }, `>_ ${label}`);
}

// src/client/launcher.js
var GROUPS = [
  { id: "skills", test: (kind) => /skill/.test(kind) },
  { id: "run", test: (kind) => /(terminal|shell|browser|web)/.test(kind) },
  { id: "code", test: (kind) => /^(files|code|document)/.test(kind) }
];
var GROUP_ORDER = ["code", "run", "skills", "more"];
function isRedundantWorkspaceFiles(def) {
  return String(def?.kind ?? "") === "files";
}
function groupOf(kind) {
  return GROUPS.find((g) => g.test(String(kind)))?.id ?? "more";
}
function collectBoxes(registry) {
  let defs = [];
  try {
    defs = registry.entries();
  } catch {
    return [];
  }
  const boxes = [];
  for (const def of defs ?? []) {
    if (!def || typeof def !== "object" || isRedundantWorkspaceFiles(def)) continue;
    for (const entry of def.guide ?? []) {
      if (!entry || typeof entry !== "object") continue;
      boxes.push({ kind: def.kind, entry, group: groupOf(def.kind) });
    }
  }
  boxes.sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.group);
    const gb = GROUP_ORDER.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    return (a.entry.order ?? 0) - (b.entry.order ?? 0);
  });
  return boxes;
}
function makeBrowserOpener(sidebarRight, now = Date.now) {
  let pendingSession;
  let openedAt = -Infinity;
  return () => {
    const sessionId = sidebarRight.mounted?.getSnapshot?.();
    if (sessionId !== void 0 && typeof sidebarRight.focus === "function") {
      const tabs = typeof sidebarRight.tabsIn === "function" ? sidebarRight.tabsIn(sessionId) : sidebarRight.openTabs?.getSnapshot?.()?.filter((tab) => tab.sessionId === sessionId) ?? [];
      const existing = tabs.find((tab) => tab.kind === "browser");
      if (existing) {
        if (sidebarRight.isExpanded?.() === false) sidebarRight.toggleExpanded();
        sidebarRight.focus(existing.id ?? existing.tabId);
        return;
      }
    }
    const time = now();
    if (pendingSession === sessionId && time - openedAt < 500) return;
    pendingSession = sessionId;
    openedAt = time;
    try {
      sidebarRight.openTab("browser");
    } catch (error) {
      openedAt = -Infinity;
      throw error;
    }
  };
}

// src/client/lefttools.js
var LEFT_TOOL_PREFIX = "dsh-plugin-kit/workspace/";
var LEFT_TOOL_HIDDEN_KINDS = ["code-rpc"];
function isHiddenLeftToolKind(kind) {
  return LEFT_TOOL_HIDDEN_KINDS.includes(String(kind));
}
var OWN_TOOLS = [
  { kind: TAB_KIND, label: "guide.title", description: "guide.description", glyph: "code" },
  // HTTP and gRPC are one workbench entry; the old RPC entry is gone.
  { kind: API_TAB_KIND, label: "apiGuide.title", description: "apiGuide.description", glyph: "api" },
  { kind: SKILLS_TAB_KIND, label: "skillsGuide.title", description: "skillsGuide.description", glyph: "skills" },
  { kind: DB_TAB_KIND, label: "dbGuide.title", description: "dbGuide.description", glyph: "db" }
];
function ToolGlyph({ size = 16, glyph = "code" }) {
  if (glyph === "code") return h(IconCode, { size });
  if (glyph === "rpc") return h(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
    h("path", { key: "a", d: "M4 7h16M4 17h16" }),
    h("circle", { key: "b", cx: 8, cy: 7, r: 2 }),
    h("circle", { key: "c", cx: 16, cy: 17, r: 2 }),
    h("path", { key: "d", d: "M10 7h4a2 2 0 0 1 2 2v6" })
  );
  if (glyph === "db") return h(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
    h("ellipse", { key: "t", cx: 12, cy: 5, rx: 8, ry: 3 }),
    h("path", { key: "m", d: "M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" }),
    h("path", { key: "b", d: "M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" })
  );
  return h(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
    glyph === "api" ? [h("path", { key: "a", d: "M8 3v5m8-5v5M6 8h12v5a6 6 0 0 1-12 0V8Zm6 11v3" })] : [h("path", { key: "s", d: "m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 10 9-5M3 8l9 5v8" })]
  );
}
function collectLeftTools(registry, t) {
  const definitions = registry.entries();
  const available = new Set(definitions.map((definition2) => definition2.kind));
  const ownKinds = new Set(OWN_TOOLS.map((tool) => tool.kind));
  const own = OWN_TOOLS.filter((tool) => available.has(tool.kind)).map((tool) => ({
    id: `${LEFT_TOOL_PREFIX}${encodeURIComponent(tool.kind)}`,
    kind: tool.kind,
    label: () => t(tool.label),
    description: () => t(tool.description),
    icon: (props) => h(ToolGlyph, { ...props, glyph: tool.glyph })
  }));
  const seen = /* @__PURE__ */ new Set();
  const others = collectBoxes(registry).filter(({ kind, entry }) => {
    const key = `${kind}/${entry.id}`;
    if (ownKinds.has(kind) || isHiddenLeftToolKind(kind) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(({ kind, entry }) => ({
    id: `${LEFT_TOOL_PREFIX}${encodeURIComponent(kind)}/${encodeURIComponent(entry.id)}`,
    kind,
    label: typeof entry.title === "function" ? entry.title : () => String(entry.id),
    description: typeof entry.description === "function" ? entry.description : () => "",
    icon: typeof entry.icon === "function" ? entry.icon : IconCode
  }));
  return [...own, ...others];
}
function makeLeftToolRouter({ layout, sidebarRight, getTools, report, t }) {
  let openBrowser = makeBrowserOpener(sidebarRight);
  let routing = false;
  return () => {
    if (routing) return;
    const id = layout.panelInfo.getSnapshot().activePanelId;
    const tool = getTools().find((entry) => entry.id === id);
    if (!tool) {
      if (typeof id === "string" && id.startsWith(LEFT_TOOL_PREFIX)) {
        routing = true;
        try {
          layout.selectPanel(null);
        } finally {
          routing = false;
        }
      }
      return;
    }
    routing = true;
    try {
      layout.selectPanel(null);
      const target = sidebarRight.commandTarget(null);
      if (target === void 0) {
        report(t("shortcut.noSession"));
        return;
      }
      report("");
      const inventory = () => typeof sidebarRight.tabsIn === "function" ? sidebarRight.tabsIn(target.sessionId) : (sidebarRight.openTabs?.getSnapshot?.() ?? []).filter((tab) => tab.sessionId === target.sessionId);
      const matching = inventory().filter((tab) => tab.kind === tool.kind);
      const active = sidebarRight.active?.();
      const existing = matching.find((tab) => (tab.id ?? tab.tabId) === (active?.id ?? active?.tabId)) ?? matching.at(-1);
      if (existing) {
        const tabId = existing.id ?? existing.tabId;
        if (sidebarRight.isExpanded() === false) sidebarRight.toggleExpanded();
        sidebarRight.focus(tabId);
        if (tool.kind === "browser") openBrowser = makeBrowserOpener(sidebarRight);
        return;
      }
      if (tool.kind === "browser") openBrowser();
      else sidebarRight.openTabFromTarget(tool.kind, target);
    } catch (error) {
      report(`${t("left.openFailed")}: ${error?.message ?? error}`);
    } finally {
      routing = false;
    }
  };
}
function WorkspaceGuide({ t }) {
  return h(
    "div",
    { className: "ce-workspace-guide" },
    h("span", { className: "ce-workspace-guide-icon" }, h(IconCode, { size: 28 })),
    h("h2", null, t("left.workspace")),
    h("p", null, t("left.guide"))
  );
}
function installLeftTools(ctx, t) {
  const registrations = /* @__PURE__ */ new Map();
  let tools = [];
  let message = "";
  const listeners = /* @__PURE__ */ new Set();
  const report = (next) => {
    message = next;
    for (const listener of listeners) listener(next);
  };
  function Notice() {
    const [text, setText] = useState(message);
    useEffect(() => {
      listeners.add(setText);
      setText(message);
      return () => listeners.delete(setText);
    }, []);
    useEffect(() => {
      if (!text) return void 0;
      const timer = setTimeout(() => report(""), 5e3);
      return () => clearTimeout(timer);
    }, [text]);
    return text ? h("div", { className: "ce-left-notice", role: "status" }, h("span", null, text), h("button", { type: "button", "aria-label": t("close"), onClick: () => report("") }, "×")) : null;
  }
  const sync = () => {
    const next = collectLeftTools(ctx.sidebarRightTabs, t);
    const ids = new Set(next.map((tool) => tool.id));
    for (const [id, dispose] of registrations) if (!ids.has(id)) {
      dispose();
      registrations.delete(id);
    }
    tools = next;
    for (const [index, tool] of next.entries()) {
      if (registrations.has(tool.id)) continue;
      const disposeMain = ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: tool.id, locale: NS }, () => h(WorkspaceGuide, { t })));
      const disposeNav = ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: tool.id, order: 20 + index, label: tool.label, locale: NS }, tool.icon));
      registrations.set(tool.id, () => {
        disposeNav();
        disposeMain();
      });
    }
  };
  const route = makeLeftToolRouter({ layout: ctx.layout, sidebarRight: ctx.sidebarRight, getTools: () => tools, report, t });
  const stopRouting = ctx.layout.panelInfo.subscribe(route);
  sync();
  const stopRegistry = ctx.sidebarRightTabs.subscribe(sync);
  const disposeNotice = ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "dsh-plugin-kit/tool-notice", order: 50 }, Notice));
  return () => {
    stopRegistry();
    stopRouting();
    disposeNotice();
    if (tools.some((tool) => tool.id === ctx.layout.panelInfo.getSnapshot().activePanelId)) ctx.layout.selectPanel(null);
    for (const dispose of registrations.values()) dispose();
    registrations.clear();
    listeners.clear();
  };
}

// src/client/browserdata.js
var DEFAULT_BROWSER_SETTINGS = Object.freeze({ homeUrl: "https://www.doubao.com/", showBookmarksBar: true, startPage: "home" });
function normalizeBrowserUrl(input, applicationOrigin) {
  const value = String(input ?? "").trim();
  if (!value || value.length > 16384) throw Error("browser.invalidUrl");
  const explicit = /^[A-Za-z][A-Za-z\d+.-]*:(?!\d+(?:[/?#]|$))/.test(value);
  let url;
  try {
    url = new URL(explicit ? value : `https://${value}`);
  } catch {
    throw Error("browser.invalidUrl");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("browser.invalidUrl");
  if (applicationOrigin && applicationOrigin !== "null" && url.origin === applicationOrigin) throw Error("browser.applicationOrigin");
  return url.href;
}

// src/client/browsercarrier.js
function createBrowserCarrier({ host, bridge, workspace, applicationOrigin, onState, onOpen }) {
  let disposed = false, element, reservation, offOpen, acquiring, ready = false, pending, lastUrl = "", firstDocument = true;
  let state = { url: "", title: "", loading: false, unknown: false, canBack: false, canForward: false, error: "" };
  const removers = [];
  const releases = /* @__PURE__ */ new Set();
  const release = (lease) => {
    const done = Promise.resolve().then(() => bridge.release(lease)).catch((error) => fail(error)).finally(() => releases.delete(done));
    releases.add(done);
    return done;
  };
  const dropGuest = () => {
    for (const remove of removers.splice(0)) remove();
    offOpen?.();
    offOpen = void 0;
    const guest = element;
    element = void 0;
    ready = false;
    guest?.remove();
    const lease = reservation;
    reservation = void 0;
    return lease ? release(lease.lease) : Promise.resolve();
  };
  const publish = (patch) => {
    if (!disposed) {
      state = { ...state, ...patch };
      onState(state);
    }
  };
  const listen = (node, type, callback) => {
    node.addEventListener(type, callback);
    removers.push(() => node.removeEventListener(type, callback));
  };
  const fail = (error) => publish({ loading: false, error: String(error?.message ?? error) });
  const validate = (url) => normalizeBrowserUrl(url, applicationOrigin);
  const observe = (committed = true) => {
    if (!ready || !element || disposed) return;
    try {
      let url;
      try {
        if (committed) url = validate(element.getURL());
      } catch {
      }
      if (url && firstDocument) {
        element.clearHistory();
        firstDocument = false;
      }
      if (url) element.setAttribute("aria-label", element.getTitle() || new URL(url).hostname);
      publish({ ...url ? { url, title: element.getTitle() || new URL(url).hostname, unknown: false } : {}, loading: element.isLoading(), canBack: element.canGoBack(), canForward: element.canGoForward() });
    } catch (error) {
      fail(error);
    }
  };
  const loadPending = () => {
    if (!ready || !pending || disposed) return;
    const url = pending;
    pending = void 0;
    const guest = element;
    try {
      Promise.resolve(guest.loadURL(url)).catch((error) => {
        if (element === guest && state.url === url && error?.code !== "ERR_ABORTED") fail(error);
      });
    } catch (error) {
      fail(error);
    }
  };
  const initializeDesktop = () => {
    if (acquiring || element || disposed) return;
    acquiring = bridge.acquire(workspace).then(async (lease) => {
      if (disposed) {
        await release(lease.lease);
        return;
      }
      reservation = lease;
      element = host.ownerDocument.createElement("webview");
      element.className = "ceb-guest";
      element.dataset.sidebarBrowserFrame = "webview";
      element.setAttribute("name", lease.lease);
      element.setAttribute("partition", lease.partition);
      element.setAttribute("allowpopups", "");
      element.setAttribute("src", `about:blank#${lease.lease}`);
      offOpen = bridge.onOpenRequested(lease.lease, (url) => {
        if (!disposed) {
          try {
            onOpen(validate(url));
          } catch (error) {
            fail(error);
          }
        }
      });
      listen(element, "dom-ready", () => {
        ready = true;
        observe(!pending);
        loadPending();
      });
      listen(element, "did-navigate", () => observe(true));
      listen(element, "page-title-updated", () => observe(!state.loading));
      for (const name of ["did-start-loading", "did-stop-loading"]) listen(element, name, () => observe(false));
      listen(element, "did-navigate-in-page", (event) => {
        if (event.isMainFrame) observe();
      });
      listen(element, "did-start-navigation", (event) => {
        if (event.isMainFrame) publish({ loading: true, error: "" });
      });
      listen(element, "did-fail-load", (event) => {
        if (event.isMainFrame && event.errorCode !== -3) fail(`${event.errorCode}: ${event.errorDescription}`);
      });
      listen(element, "render-process-gone", () => {
        void dropGuest();
        firstDocument = true;
        fail("browser.guestGone");
      });
      host.append(element);
    }).catch(async (error) => {
      await dropGuest();
      fail(error);
    }).finally(() => {
      acquiring = void 0;
    });
  };
  const load = (input) => {
    try {
      const url = validate(input);
      lastUrl = url;
      publish({ url, title: new URL(url).hostname, loading: true, unknown: false, error: "" });
      if (bridge) {
        pending = url;
        initializeDesktop();
        loadPending();
      } else {
        element?.remove();
        for (const remove of removers.splice(0)) remove();
        const frame = host.ownerDocument.createElement("iframe");
        element = frame;
        frame.className = "ceb-guest";
        frame.title = new URL(url).hostname;
        frame.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox");
        frame.setAttribute("referrerpolicy", "no-referrer");
        let loaded = false;
        listen(frame, "load", () => {
          if (frame !== element) return;
          publish({ loading: false, unknown: loaded, canBack: false, canForward: false });
          loaded = true;
        });
        listen(frame, "error", () => {
          if (frame === element) fail("browser.loadFailed");
        });
        frame.src = url;
        host.append(frame);
      }
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  };
  return {
    load,
    reload() {
      if (bridge && ready) {
        try {
          element.reload();
        } catch (error) {
          fail(error);
        }
      } else if (lastUrl) load(lastUrl);
    },
    back() {
      if (bridge && ready && state.canBack) {
        try {
          element.goBack();
        } catch (error) {
          fail(error);
        }
      }
    },
    forward() {
      if (bridge && ready && state.canForward) {
        try {
          element.goForward();
        } catch (error) {
          fail(error);
        }
      }
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      pending = void 0;
      await dropGuest();
      await acquiring;
      await Promise.all(releases);
    }
  };
}

// src/client/browserworkspace.js
async function resolveBrowserWorkspace(source, sessionId, signal) {
  if (!source) throw Error("Browser workspace service is unavailable");
  signal.throwIfAborted();
  if (source.getSnapshot().phase !== "ready") {
    await new Promise((resolve, reject) => {
      let stop = () => {
      };
      const abort = () => {
        stop();
        reject(signal.reason ?? Error("Aborted"));
      };
      const check = () => {
        if (source.getSnapshot().phase !== "ready") return;
        stop();
        signal.removeEventListener("abort", abort);
        resolve();
      };
      stop = source.subscribe(check);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      else check();
    });
  }
  signal.throwIfAborted();
  const workspace = source.getSnapshot().items.find((item) => item.sessionIds.includes(sessionId));
  return workspace ? `cwd:${workspace.path}` : `session:${sessionId}`;
}

// src/client/browsersubs.js
var MAX_SUBTABS = 10;
var subDocKey = (sessionId, tabId) => `dsh.plugin-kit.browser.tabs.v2.${sessionId}.${tabId}`;
var legacyPageKey = (sessionId, tabId) => `dsh.plugin-kit.browser.page.v1.${sessionId}.${tabId}`;
function newSubId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
var cleanEntry = (entry) => ({
  id: String(entry?.id ?? newSubId()),
  url: entry?.url ? String(entry.url) : "",
  title: String(entry?.title ?? "").slice(0, 240)
});
function loadSubDoc(sessionId, tabId) {
  try {
    const raw = JSON.parse(localStorage.getItem(subDocKey(sessionId, tabId)) ?? "null");
    if (raw && Array.isArray(raw.tabs) && raw.tabs.length) {
      const tabs = raw.tabs.slice(0, MAX_SUBTABS).map(cleanEntry);
      const activeId = tabs.some((entry) => entry.id === raw.activeId) ? String(raw.activeId) : tabs[0].id;
      return { tabs, activeId, navigationRevision: raw.navigationRevision, initialUrl: raw.initialUrl, restored: true };
    }
    const legacy = JSON.parse(localStorage.getItem(legacyPageKey(sessionId, tabId)) ?? "null");
    if (legacy?.url) {
      const only = cleanEntry(legacy);
      return { tabs: [only], activeId: only.id, navigationRevision: legacy.navigationRevision, initialUrl: legacy.initialUrl, restored: true };
    }
  } catch {
  }
  return null;
}
function saveSubDoc(sessionId, tabId, doc) {
  try {
    localStorage.setItem(subDocKey(sessionId, tabId), JSON.stringify({
      tabs: doc.tabs.map((entry) => ({ id: entry.id, url: entry.url, title: entry.title })),
      activeId: doc.activeId,
      navigationRevision: doc.navigationRevision,
      initialUrl: doc.initialUrl
    }));
  } catch {
  }
}
function clearSubDoc(sessionId, tabId) {
  try {
    localStorage.removeItem(subDocKey(sessionId, tabId));
  } catch {
  }
  try {
    localStorage.removeItem(legacyPageKey(sessionId, tabId));
  } catch {
  }
}

// src/client/browsericons.js
var paths = {
  home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
  external: "M14 3h7v7M21 3 10 14M11 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6",
  star: "m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9L12 3Z",
  bookmarks: "M6 3h12v18l-6-4-6 4V3Z",
  globe: "M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M18 6 6 18"
};
function BrowserGlyph({ name, filled = false, size = 16 }) {
  const children = name === "settings" ? [h("path", { key: "gear", d: "m9 3-.6 2.4-2 1.2L4 6l-2 3.5 1.8 1.7v2.4L2 15.3l2 3.5 2.4-.6 2 1.2L9 22h4l.6-2.6 2-1.2 2.4.6 2-3.5-1.8-1.7v-2.4L20 9l-2-3.5-2.4.6-2-1.2L13 3H9Z" }), h("circle", { key: "center", cx: 11, cy: 12.5, r: 3 })] : [name === "globe" ? h("circle", { key: "circle", cx: 12, cy: 12, r: 9 }) : null, h("path", { key: "path", d: paths[name] ?? paths.globe })];
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: filled ? "currentColor" : "none", stroke: "currentColor", strokeWidth: 1.65, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, children);
}

// src/client/browser.js
var hostLabel = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};
function EnhancedBrowser({ sessionId, useSessions, useTabInfo, useBrowserLibrary, loadLibrary, changeLibrary, desktopBridge, browserWorkspaces, t }) {
  const info = useTabInfo();
  const tab = info.tab;
  const library = useBrowserLibrary((value) => value);
  const [doc, setDoc] = useState(() => {
    const loaded = loadSubDoc(sessionId, tab.id);
    if (loaded) return loaded;
    const id = newSubId();
    return { tabs: [{ id, url: "", title: "" }], activeId: id, restored: false };
  });
  const docRef = useRef(doc);
  docRef.current = doc;
  const liveRef = useRef(/* @__PURE__ */ new Set());
  const [stripNotice, setStripNotice] = useState("");
  useEffect(() => {
    if (!stripNotice) return void 0;
    const timer = setTimeout(() => setStripNotice(""), 4e3);
    return () => clearTimeout(timer);
  }, [stripNotice]);
  useEffect(() => {
    saveSubDoc(sessionId, tab.id, doc);
  }, [doc, sessionId, tab.id]);
  useEffect(() => () => {
    if (tab.signal.aborted) clearSubDoc(sessionId, tab.id);
  }, [sessionId, tab.id, tab.signal]);
  const addSub = (url, activate = true) => {
    const current = docRef.current;
    if (current.tabs.length >= MAX_SUBTABS) {
      setStripNotice(t("browser.tabLimit"));
      return void 0;
    }
    const id = newSubId();
    setDoc({ ...current, tabs: [...current.tabs, { id, url: url ?? "", title: "" }], activeId: activate ? id : current.activeId });
    return id;
  };
  const closeSub = (id) => {
    const current = docRef.current;
    const index = current.tabs.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    liveRef.current.delete(id);
    if (current.tabs.length === 1) {
      const fresh = newSubId();
      setDoc({ ...current, tabs: [{ id: fresh, url: "", title: "" }], activeId: fresh });
      return;
    }
    const tabs = current.tabs.filter((entry) => entry.id !== id);
    const activeId = current.activeId === id ? tabs[Math.min(index, tabs.length - 1)].id : current.activeId;
    const next = { ...current, tabs, activeId };
    setDoc(next);
  };
  const activateSub = (id) => {
    const current = docRef.current;
    if (current.activeId === id) return;
    setDoc({ ...current, activeId: id });
  };
  const patchSub = (id, patch) => {
    const { url, title, navigationRevision, initialUrl } = patch;
    setDoc((current) => ({
      ...current,
      tabs: current.tabs.map((entry) => entry.id === id ? { ...entry, ...url !== void 0 ? { url } : {}, ...title !== void 0 ? { title } : {} } : entry),
      ...navigationRevision !== void 0 ? { navigationRevision, initialUrl } : {}
    }));
  };
  return h(
    "div",
    { className: "ce-root ceb-root" },
    h(
      "div",
      { className: "ceb-strip", role: "tablist", "aria-label": t("browser.strip") },
      doc.tabs.map((sub) => {
        const active = sub.id === doc.activeId;
        return h(
          "div",
          { key: sub.id, className: active ? "ceb-sub ceb-sub-active" : "ceb-sub", role: "tab", "aria-selected": active },
          h(
            "button",
            { type: "button", className: "ceb-sub-open", title: sub.title || sub.url || t("browser.untitled"), onClick: () => activateSub(sub.id) },
            h("span", { className: "ceb-sub-title" }, sub.title || hostLabel(sub.url) || t("browser.untitled"))
          ),
          h("button", { type: "button", className: "ceb-sub-close", title: t("browser.closeTab"), "aria-label": t("browser.closeTab"), onClick: () => closeSub(sub.id) }, h(BrowserGlyph, { name: "close", size: 12 }))
        );
      }),
      h("button", { type: "button", className: "ceb-strip-add", title: t("browser.newTab"), "aria-label": t("browser.newTab"), onClick: () => addSub("") }, h(BrowserGlyph, { name: "plus", size: 14 })),
      stripNotice ? h("span", { className: "ceb-strip-note", role: "status" }, stripNotice) : null
    ),
    doc.tabs.map((sub) => {
      const active = sub.id === doc.activeId;
      if (!desktopBridge && !active) return null;
      return h(BrowserPage, {
        key: sub.id,
        sessionId,
        tab,
        sub,
        active,
        confirmRestore: Boolean(doc.restored && sub.url && !liveRef.current.has(sub.id)),
        envelope: { navigationRevision: doc.navigationRevision, initialUrl: doc.initialUrl },
        library,
        loadLibrary,
        changeLibrary,
        desktopBridge,
        browserWorkspaces,
        t,
        onPopup: (url) => addSub(url, false),
        onPage: patchSub,
        onLive: (id) => {
          liveRef.current.add(id);
        }
      });
    })
  );
}
function BrowserPage({ sessionId, tab, sub, active, confirmRestore, envelope, library, loadLibrary, changeLibrary, desktopBridge, browserWorkspaces, t, onPopup, onPage, onLive }) {
  const settings = library.data?.settings ?? DEFAULT_BROWSER_SETTINGS;
  const bookmarks = library.data?.bookmarks ?? [];
  const [page, setPage] = useState({ url: "", title: "", loading: false, unknown: false, canBack: false, canForward: false, error: "" });
  const [address, setAddress] = useState("");
  const [panel, setPanel] = useState(null);
  const [filter, setFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [folder, setFolder] = useState("");
  const [editor, setEditor] = useState(null);
  const editorCurrent = useRef(null);
  editorCurrent.current = editor;
  const bookmarkDraft = useRef(null);
  if (editor) bookmarkDraft.current = editor;
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const settingsBase = useRef(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const hostRef = useRef(null);
  const carrierRef = useRef(null);
  const startRef = useRef(false);
  const lastTarget = useRef("");
  const [restore, setRestore] = useState(confirmRestore ? { url: sub.url, title: sub.title } : null);
  const alive = useRef(true);
  const editorRef = useDismissLayer({ open: editor !== null, onDismiss: () => setEditor(null), ignoreSelector: '[data-ce-browser-action="bookmark"]' });
  const removeRef = useDismissLayer({ open: confirmDelete !== null, onDismiss: () => setConfirmDelete(null) });
  const origin = typeof window === "undefined" ? void 0 : window.location.origin;
  const envelopeRef = useRef(envelope);
  const textError = (error) => {
    const message = String(error?.message ?? error);
    return message.startsWith("browser.") ? t(message) : message;
  };
  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);
  useEffect(() => {
    if (!notice) return void 0;
    const timer = setTimeout(() => setNotice(""), 5e3);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    alive.current = true;
    const host = hostRef.current;
    if (!host) return void 0;
    const lifetime = new AbortController();
    let carrier;
    const initialize = async () => {
      const workspace = desktopBridge ? await resolveBrowserWorkspace(browserWorkspaces, sessionId, lifetime.signal) : `session:${sessionId}`;
      if (lifetime.signal.aborted) return;
      carrier = createBrowserCarrier({
        host,
        bridge: desktopBridge,
        workspace,
        applicationOrigin: origin,
        onOpen: (url) => onPopup(url),
        onState: (next) => {
          setPage(next);
          if (!next.unknown) {
            if (next.url !== lastTarget.current) setAddress(next.url);
            lastTarget.current = next.url;
            if (next.url) onPage(sub.id, { url: next.url, title: next.title, navigationRevision: tab.navigation?.revision, initialUrl: tab.navigation?.params?.url });
          }
        }
      });
      carrierRef.current = carrier;
      if (lastTarget.current) carrier.load(lastTarget.current);
      setEpoch((value) => value + 1);
    };
    void initialize().catch((error) => {
      if (!lifetime.signal.aborted) setNotice(textError(error));
    });
    return () => {
      alive.current = false;
      lifetime.abort();
      carrierRef.current = null;
      void carrier?.dispose().catch((error) => console.error("toolbox browser release", error));
    };
  }, [sessionId, sub.id, tab.signal, browserWorkspaces, desktopBridge]);
  const navigate = (input) => {
    try {
      const url = normalizeBrowserUrl(input, origin);
      if (!carrierRef.current) {
        setNotice(t("browser.initializing"));
        return;
      }
      setAddress(url);
      if (carrierRef.current.load(url)) {
        setPanel(null);
        setEditor(null);
        setConfirmDelete(null);
        setRestore(null);
        setNotice("");
        onLive(sub.id);
      }
    } catch (error) {
      setNotice(textError(error));
    }
  };
  useEffect(() => {
    if (!carrierRef.current || startRef.current) return;
    if (!tab.navigation?.params?.url && !library.data && !library.error) return;
    startRef.current = true;
    const supplied = tab.navigation?.params?.url;
    const env = envelopeRef.current;
    if (active && supplied && (!env || env.navigationRevision !== tab.navigation?.revision || env.initialUrl !== supplied)) navigate(supplied);
    else if (!restore && sub.url) navigate(sub.url);
    else if (!restore && !sub.url) {
      if (settings.startPage === "bookmarks") setPanel("bookmarks");
      else navigate(settings.homeUrl);
    }
  }, [epoch, library.data, library.error, settings.startPage, settings.homeUrl, active]);
  const seenRevision = useRef(tab.navigation?.revision);
  useEffect(() => {
    if (!active) {
      seenRevision.current = tab.navigation?.revision;
      return;
    }
    if (seenRevision.current === tab.navigation?.revision || !carrierRef.current) return;
    seenRevision.current = tab.navigation?.revision;
    if (tab.navigation?.params?.url) navigate(tab.navigation.params.url);
  }, [tab.navigation?.revision, epoch, active]);
  useEffect(() => {
    if (!active) return void 0;
    return tab.actions.bindCommands?.({ refresh: () => carrierRef.current?.reload() });
  }, [tab.actions, active]);
  useEffect(() => {
    if (tab.visible === false) {
      setEditor(null);
      setConfirmDelete(null);
    }
  }, [tab.visible]);
  const mutate = async (request, done) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      if (request.action === "save") normalizeBrowserUrl(request.url, origin);
      if (request.action === "settings" && request.settings.homeUrl !== void 0) normalizeBrowserUrl(request.settings.homeUrl, origin);
      await changeLibrary(request);
      if (alive.current) {
        done?.();
        setNotice(t("browser.saved"));
      }
    } catch (error) {
      if (alive.current) setNotice(textError(error));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const currentBookmark = bookmarks.find((entry) => entry.url === page.url);
  const openBookmark = () => {
    if (editor) {
      setEditor(null);
      return;
    }
    if (!page.url || page.unknown) return;
    setEditor(bookmarkDraft.current?.url === page.url ? bookmarkDraft.current : currentBookmark ? { ...currentBookmark } : { title: page.title || new URL(page.url).hostname, url: page.url, folder: "", favorite: true });
  };
  const choosePanel = (next) => {
    setPanel((current) => current === next ? null : next);
    setEditor(null);
    setConfirmDelete(null);
    if (next === "settings") {
      settingsBase.current = { ...settings };
      setSettingsDraft({ ...settings });
    }
  };
  const visibleBookmarks = bookmarks.filter((entry) => (!favoritesOnly || entry.favorite) && (!folder || entry.folder === folder) && (!filter.trim() || `${entry.title} ${entry.url} ${entry.folder}`.toLowerCase().includes(filter.trim().toLowerCase())));
  const tool = (label, child, click, disabled = false, extra = {}) => h("button", { type: "button", className: "ce-tool ceb-tool", title: label, "aria-label": label, disabled, onClick: click, ...extra }, child);
  return h(
    "div",
    { className: "ceb-page", style: { display: active ? "flex" : "none" }, onKeyDown: (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.code === "KeyL") {
        event.preventDefault();
        event.currentTarget.querySelector(".ceb-address")?.focus();
      }
      if (event.key === "Escape" && !event.isComposing && panel && !editor && !confirmDelete) {
        event.preventDefault();
        event.stopPropagation();
        setPanel(null);
      }
    } },
    h(
      "form",
      { className: "ceb-toolbar", onSubmit: (event) => {
        event.preventDefault();
        navigate(address);
      } },
      h(
        "div",
        { className: "ceb-nav-group", role: "group", "aria-label": t("browser.navigation") },
        tool(t("browser.back"), h(IconArrowLeft), () => carrierRef.current?.back(), !page.canBack),
        tool(t("browser.forward"), h(IconArrowRight), () => carrierRef.current?.forward(), !page.canForward),
        tool(t("browser.reload"), h(IconRefresh), () => restore ? navigate(restore.url) : carrierRef.current?.reload(), !page.url && !restore)
      ),
      h(
        "div",
        { className: "ceb-address-shell" },
        h("span", { className: "ceb-address-icon" }, h(BrowserGlyph, { name: "globe", size: 15 })),
        h("input", { className: "ce-input ceb-address", "aria-label": t("browser.address"), placeholder: t("browser.address"), value: address, spellCheck: false, autoComplete: "off", onFocus: (event) => event.target.select(), onChange: (event) => setAddress(event.target.value) }),
        tool(t(currentBookmark ? "browser.editBookmark" : "browser.bookmarkPage"), h(BrowserGlyph, { name: "star", filled: Boolean(currentBookmark) }), openBookmark, !library.data || !page.url || page.unknown || page.loading, { className: `ce-tool ceb-tool ceb-star${currentBookmark ? " ceb-star-saved" : ""}`, "data-ce-browser-action": "bookmark", "aria-expanded": editor !== null, "aria-pressed": Boolean(currentBookmark) }),
        h("button", { className: "ceb-go", type: "submit", disabled: !address.trim(), title: t("browser.go"), "aria-label": t("browser.go") }, h(BrowserGlyph, { name: "arrow" }))
      ),
      h(
        "div",
        { className: "ceb-action-group", role: "group", "aria-label": t("browser.tools") },
        tool(t("browser.home"), h(BrowserGlyph, { name: "home" }), () => navigate(settings.homeUrl)),
        tool(t("browser.external"), h(BrowserGlyph, { name: "external" }), () => {
          try {
            window.open(normalizeBrowserUrl(page.url, origin), "_blank", "noopener,noreferrer");
          } catch (error) {
            setNotice(textError(error));
          }
        }, !page.url || page.unknown),
        tool(t("browser.bookmarks"), h(BrowserGlyph, { name: "bookmarks" }), () => choosePanel("bookmarks"), false, { "aria-expanded": panel === "bookmarks", "aria-pressed": panel === "bookmarks" }),
        tool(t("browser.settings"), h(BrowserGlyph, { name: "settings" }), () => choosePanel("settings"), false, { "aria-expanded": panel === "settings", "aria-pressed": panel === "settings" })
      )
    ),
    settings.showBookmarksBar && bookmarks.some((entry) => entry.favorite) ? h("nav", { className: "ceb-bookmarks-bar", "aria-label": t("browser.favorites") }, bookmarks.filter((entry) => entry.favorite).map((entry) => h("button", { key: entry.id, type: "button", title: entry.url, onClick: () => navigate(entry.url) }, entry.title))) : null,
    h("div", { className: "ceb-feedback", role: "status", hidden: !notice && !library.error && !page.error }, textError(page.error || library.error) || notice),
    library.error ? h("button", { type: "button", className: "ce-link", onClick: () => void loadLibrary() }, t("browser.retryStorage")) : null,
    h("div", { className: `ceb-progress${page.loading && !panel ? " ceb-progress-active" : ""}`, role: page.loading && !panel ? "progressbar" : void 0, "aria-label": page.loading && !panel ? t("loading") : void 0 }, h("span")),
    page.unknown ? h("div", { className: "ce-note" }, t("browser.unknown")) : null,
    h(
      "div",
      { className: "ceb-content" },
      h("div", { className: "ceb-viewport", ref: hostRef, style: { visibility: panel || editor || restore ? "hidden" : "visible" }, "aria-hidden": Boolean(panel || editor || restore) }),
      !panel && restore ? h("section", { className: "ceb-start" }, h("span", { className: "ceb-start-icon" }, h(BrowserGlyph, { name: "globe", size: 30 })), h("h2", null, t("browser.restore")), h("p", null, restore.title), h("p", null, restore.url), h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: () => navigate(restore.url) }, t("browser.restoreAction"))) : null,
      !panel && !restore && !page.url && !page.loading ? h("div", { className: "ceb-start" }, h("span", { className: "ceb-start-icon" }, h(BrowserGlyph, { name: "globe", size: 30 })), h("h2", null, t("browser.welcome")), h("p", null, t("browser.startHint"))) : null,
      panel ? h(
        "section",
        { className: "ceb-panel ce-scroll", "aria-label": t(panel === "bookmarks" ? "browser.bookmarks" : "browser.settings") },
        h("header", { className: "ceb-panel-head" }, h("div", null, h("h2", null, t(panel === "bookmarks" ? "browser.bookmarks" : "browser.settings")), h("p", { className: "ceb-panel-caption" }, panel === "bookmarks" ? t("browser.bookmarkCount", { n: bookmarks.length }) : t("browser.settingsCaption"))), tool(t("close"), h(BrowserGlyph, { name: "close" }), () => setPanel(null))),
        panel === "bookmarks" ? h(
          Fragment,
          null,
          h(
            "div",
            { className: "ceb-list-tools" },
            h("input", { type: "search", className: "ce-input", "aria-label": t("browser.searchBookmarks"), placeholder: t("browser.searchBookmarks"), value: filter, onChange: (event) => setFilter(event.target.value) }),
            h("select", { className: "ce-sk-scope", "aria-label": t("browser.folder"), value: folder, onChange: (event) => setFolder(event.target.value) }, h("option", { value: "" }, t("browser.allFolders")), [...new Set(bookmarks.map((entry) => entry.folder).filter(Boolean))].map((name) => h("option", { key: name, value: name }, name))),
            h("label", null, h("input", { type: "checkbox", checked: favoritesOnly, onChange: (event) => setFavoritesOnly(event.target.checked) }), t("browser.favoritesOnly")),
            h("button", { type: "button", className: "ce-sk-btn", disabled: !library.data, onClick: () => setEditor(bookmarkDraft.current ?? { title: "", url: "", folder: "", favorite: false }) }, t("browser.addBookmark"))
          ),
          !library.data ? h("p", null, t("loading")) : !visibleBookmarks.length ? h("div", { className: "ceb-empty" }, t(bookmarks.length ? "browser.noMatch" : "browser.emptyBookmarks")) : visibleBookmarks.map((entry) => h(
            "article",
            { key: entry.id, className: "ceb-bookmark-row" },
            h("button", { type: "button", className: "ceb-bookmark-open", onClick: () => navigate(entry.url), title: entry.url }, h("span", { className: "ceb-bookmark-title" }, h("span", { className: "ceb-bookmark-glyph" }, h(BrowserGlyph, { name: entry.favorite ? "star" : "globe", size: 15 })), h("strong", null, entry.title)), h("span", null, entry.url), entry.folder ? h("small", null, entry.folder) : null),
            h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", "aria-label": `${t("editor.edit")} ${entry.title}`, onClick: () => setEditor({ ...entry }) }, t("editor.edit")),
            confirmDelete === entry.id ? h("span", { ref: removeRef, className: "ceb-confirm" }, h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-danger", disabled: busy, onClick: () => void mutate({ action: "delete", id: entry.id }, () => setConfirmDelete(null)) }, t("browser.confirmDelete")), h("button", { type: "button", className: "ce-sk-btn", onClick: () => setConfirmDelete(null) }, t("editor.cancel"))) : h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", "aria-label": `${t("skills.delete")} ${entry.title}`, onClick: () => setConfirmDelete(entry.id) }, t("skills.delete"))
          ))
        ) : h(
          Fragment,
          null,
          h("p", { className: "ceb-setting-hint" }, t("browser.settingsScope")),
          h(
            "form",
            { className: "ceb-settings-form", onSubmit: (event) => {
              event.preventDefault();
              void mutate({ action: "settings", settings: Object.fromEntries(Object.entries(settingsDraft ?? settings).filter(([key, value]) => value !== settingsBase.current?.[key])) }, () => {
                settingsBase.current = { ...settingsDraft ?? settings };
              });
            } },
            h("label", null, t("browser.homeUrl"), h("input", { className: "ce-input", value: (settingsDraft ?? settings).homeUrl, onChange: (event) => setSettingsDraft({ ...settingsDraft ?? settings, homeUrl: event.target.value }) })),
            h("label", null, t("browser.startPage"), h("select", { className: "ce-sk-scope", value: (settingsDraft ?? settings).startPage, onChange: (event) => setSettingsDraft({ ...settingsDraft ?? settings, startPage: event.target.value }) }, h("option", { value: "home" }, t("browser.home")), h("option", { value: "bookmarks" }, t("browser.bookmarks")))),
            h("label", { className: "ceb-checkbox" }, h("input", { type: "checkbox", checked: (settingsDraft ?? settings).showBookmarksBar, onChange: (event) => setSettingsDraft({ ...settingsDraft ?? settings, showBookmarksBar: event.target.checked }) }), t("browser.showBookmarksBar")),
            h("button", { type: "submit", className: "ce-sk-btn ce-sk-primary", disabled: busy || !library.data }, t("editor.save"))
          ),
          h("section", { className: "ceb-capabilities" }, h("h3", null, t("browser.extensions")), h("p", null, t("browser.extensionsUnavailable")), h("h3", null, t("browser.carrier")), h("p", null, t(desktopBridge ? "browser.desktopPolicy" : "browser.webPolicy")))
        )
      ) : null
    ),
    editor ? h(
      "form",
      { className: "ceb-bookmark-editor", ref: editorRef, role: "dialog", "aria-label": t("browser.editBookmark"), onSubmit: (event) => {
        event.preventDefault();
        const saving = editor;
        void mutate({ action: "save", ...saving }, () => {
          if (editorCurrent.current === saving) {
            bookmarkDraft.current = null;
            setEditor(null);
          }
        });
      } },
      h("header", null, h("strong", null, t(editor.id ? "browser.editBookmark" : "browser.addBookmark")), tool(t("close"), h(BrowserGlyph, { name: "close" }), () => setEditor(null))),
      ...[["title", "browser.name"], ["url", "browser.url"], ["folder", "browser.folder"]].map(([key, label]) => h("label", { key }, t(label), h("input", { className: "ce-input", autoFocus: key === "title", value: editor[key], required: key === "url", onChange: (event) => setEditor({ ...editor, [key]: event.target.value }) }))),
      h("label", { className: "ceb-checkbox" }, h("input", { type: "checkbox", checked: editor.favorite, onChange: (event) => setEditor({ ...editor, favorite: event.target.checked }) }), t("browser.pinFavorite")),
      h("footer", null, h("button", { type: "button", className: "ce-sk-btn", onClick: () => setEditor(null) }, t("editor.cancel")), h("button", { type: "submit", className: "ce-sk-btn ce-sk-primary", disabled: busy || !editor.url.trim() }, t("editor.save")))
    ) : null
  );
}

// src/client/browsermodel.js
function createBrowserDataModel(call = api) {
  let snapshot = { data: null, error: "", busy: false };
  const listeners = /* @__PURE__ */ new Set();
  let refresh;
  const publish = (patch) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  const accept = (data) => {
    if (!snapshot.data || data.revision >= snapshot.data.revision) publish({ data, error: "" });
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load() {
      if (refresh) return refresh;
      publish({ busy: true });
      refresh = call("browser.data", { action: "list" }).then((result) => {
        if (!result.ok) throw Error(result.error);
        accept(result.value);
      }).catch((error) => publish({ error: error.message })).finally(() => {
        refresh = void 0;
        publish({ busy: false });
      });
      return refresh;
    },
    async change(request) {
      const result = await call("browser.data", { ...request, baseRevision: snapshot.data?.revision });
      if (!result.ok) {
        if (result.error === "browser.conflict") await this.load();
        throw Error(result.error);
      }
      accept(result.value);
    }
  };
}

// src/client/browserregister.js
var BROWSER_TAB_ID = "dsh-plugin-kit/browser";
function installBrowser(ctx, t) {
  const native = ctx.sidebarRightTabs.get("browser");
  if (!native || native.priority === "extension") return () => {
  };
  const carrier = globalThis.dshDesktop;
  const bridge = carrier?.protocolVersion === 1 ? carrier.browser : void 0;
  const model = createBrowserDataModel();
  const definition2 = { id: BROWSER_TAB_ID, kind: "browser", priority: "extension", multiple: true, keepMounted: Boolean(bridge), title: () => t("browser.label"), guide: [{ id: "new", order: 30, title: () => t("browser.label"), description: () => t("browser.guide"), icon: BrowserIcon }] };
  const stopType = ctx.sidebarRightTabs.register(definition2);
  const stopBody = ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: BROWSER_TAB_ID,
    locale: NS,
    inject: () => ({ hooks: { browserLibrary: model }, desktopBridge: bridge, browserWorkspaces: ctx.workspaces?.list, loadLibrary: () => model.load(), changeLibrary: (request) => model.change(request) })
  }, EnhancedBrowser));
  const stopTitle = ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: BROWSER_TAB_ID }, () => h("span", null, t("browser.label"))));
  return () => {
    stopTitle();
    stopBody();
    stopType();
  };
}
function BrowserIcon({ size = 18 }) {
  return h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": true }, h("circle", { cx: 12, cy: 12, r: 9 }), h("path", { d: "M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" }));
}

// src/client/vt/width.js
var WIDE = [
  4352,
  4447,
  // Hangul Jamo init. consonants
  11904,
  12350,
  // CJK radicals, Kangxi, CJK symbols (before 0x303f)
  12353,
  13311,
  // Hiragana .. CJK compatibility
  13312,
  19903,
  // CJK extension A
  19968,
  40959,
  // CJK unified ideographs
  40960,
  42191,
  // Yi
  43360,
  43391,
  // Hangul Jamo extended-A
  44032,
  55203,
  // Hangul syllables
  63744,
  64255,
  // CJK compatibility ideographs
  65040,
  65049,
  // vertical forms
  65072,
  65135,
  // CJK compatibility forms
  65280,
  65376,
  // full-width forms
  65504,
  65510,
  // full-width signs
  94176,
  94180,
  94208,
  100343,
  // Tangut
  100352,
  101589,
  110592,
  111355,
  // Kana supplement/extended
  126980,
  126980,
  // mahjong red dragon
  127183,
  127183,
  // joker
  127374,
  127374,
  127377,
  127386,
  127488,
  127776,
  // enclosed ideographs, emoji
  127789,
  127797,
  127799,
  127868,
  127870,
  127891,
  127904,
  127946,
  127951,
  127955,
  127968,
  127984,
  127988,
  127988,
  127992,
  128062,
  128064,
  128064,
  128066,
  128252,
  128255,
  128317,
  128331,
  128334,
  128336,
  128359,
  128378,
  128378,
  128405,
  128406,
  128420,
  128420,
  128507,
  128591,
  128640,
  128709,
  128716,
  128716,
  128720,
  128722,
  128725,
  128727,
  128747,
  128748,
  128756,
  128764,
  128992,
  129003,
  129292,
  129338,
  129340,
  129349,
  129351,
  129535,
  129648,
  129652,
  129656,
  129658,
  129664,
  129670,
  129680,
  129704,
  129712,
  129718,
  129728,
  129730,
  129744,
  129750,
  131072,
  196605,
  // CJK extension B and beyond
  196608,
  262141
];
var ZERO = [
  768,
  879,
  // combining diacritics
  1155,
  1161,
  1425,
  1469,
  1552,
  1562,
  1611,
  1631,
  2304,
  2306,
  2364,
  2364,
  2369,
  2376,
  2385,
  2391,
  3633,
  3633,
  3636,
  3642,
  3655,
  3662,
  6832,
  6911,
  // combining diacritical marks extended
  7616,
  7679,
  // combining diacritical marks supplement
  8203,
  8207,
  // zero width space .. RTL mark
  8232,
  8238,
  // line/paragraph separators, bidi controls
  8400,
  8432,
  // combining marks for symbols
  65024,
  65039,
  // variation selectors
  65056,
  65071,
  // combining half marks
  65279,
  65279,
  // zero width no-break space
  917760,
  917999
  // variation selectors supplement
];
function inRanges(code, table) {
  let low = 0;
  let high = table.length / 2 - 1;
  while (low <= high) {
    const mid = low + high >> 1;
    const start = table[mid * 2];
    const end = table[mid * 2 + 1];
    if (code < start) high = mid - 1;
    else if (code > end) low = mid + 1;
    else return true;
  }
  return false;
}
function cellWidth(code) {
  if (code < 32 || code >= 127 && code < 160) return 1;
  if (code >= 55296 && code <= 57343) return 1;
  if (code < 768) return 1;
  if (inRanges(code, ZERO)) return 0;
  if (inRanges(code, WIDE)) return 2;
  return 1;
}

// src/client/vt/screen.js
var FLAG = { bold: 1, dim: 2, italic: 4, underline: 8, blink: 16, inverse: 32, invisible: 64, strike: 128 };
var DEFAULT_ATTR = { fg: -1, bg: -1, fl: 0, link: null };
var TRUECOLOR = 1 << 24;
var DEC_GRAPHICS = {
  "`": "◆",
  a: "▒",
  b: "␉",
  c: "␌",
  d: "␍",
  e: "␊",
  f: "°",
  g: "±",
  h: "␤",
  i: "␋",
  j: "┘",
  k: "┐",
  l: "┌",
  m: "└",
  n: "┼",
  o: "⎺",
  p: "⎻",
  q: "─",
  r: "⎼",
  s: "⎽",
  t: "├",
  u: "┤",
  v: "┴",
  w: "┬",
  x: "│",
  y: "≤",
  z: "≥",
  "{": "π",
  "|": "≠",
  "}": "£",
  "~": "·"
};
function blankLine(cols) {
  return { cells: new Array(cols).fill(void 0), wrapped: false, version: 1 };
}
var Buffer2 = class {
  constructor(cols, rows, scrollback) {
    this.cols = cols;
    this.rows = rows;
    this.scrollback = scrollback;
    this.lines = [];
    for (let i = 0; i < rows; i++) this.lines.push(blankLine(cols));
  }
  /** Grow/shrink the grid, keeping the bottom `rows` rows on screen. */
  resize(cols, rows) {
    for (const line of this.lines) {
      if (line.cells.length !== cols) line.cells.length = cols;
      line.version++;
    }
    while (this.lines.length < rows) this.lines.push(blankLine(cols));
    while (this.lines.length > rows + this.scrollback) this.lines.shift();
    this.cols = cols;
    this.rows = rows;
  }
};
function createScreen({ cols = 80, rows = 24, scrollback = 1e3 } = {}) {
  const primary = new Buffer2(cols, rows, scrollback);
  const alternate = new Buffer2(cols, rows, 0);
  let buffer = primary;
  let alt = false;
  let x = 0;
  let y = 0;
  let saved = { x: 0, y: 0, attrs: { ...DEFAULT_ATTR }, origin: false };
  let attrs = { ...DEFAULT_ATTR };
  let scrollTop = 0;
  let scrollBottom = rows - 1;
  let tabs = defaultTabs(cols);
  let modes = {
    wrap: true,
    origin: false,
    insert: false,
    cursor: true,
    appCursor: false,
    alt: false,
    bracketedPaste: false,
    mouse: "off",
    sgrMouse: false,
    echo: true
  };
  let cursorStyle = "block";
  let cursorBlink = true;
  let title = "";
  let bell = 0;
  let dirtyAll = true;
  let charsetG0 = "ascii";
  const listeners = { title: [], bell: [] };
  let state = "ground";
  let params = "";
  let prefix = "";
  let intermediate = "";
  let osc = "";
  let dcsSkip = false;
  function defaultTabs(width) {
    const stops = /* @__PURE__ */ new Set();
    for (let i = 8; i < width; i += 8) stops.add(i);
    return stops;
  }
  const absRow = (row = y) => buffer.lines.length - buffer.rows + row;
  function lineAt(row) {
    const index = absRow(row);
    if (index < 0) return null;
    return buffer.lines[index] ?? null;
  }
  function touch(row) {
    const line = lineAt(row);
    if (line) line.version++;
  }
  function touchAll() {
    dirtyAll = true;
    for (const line of buffer.lines) line.version++;
  }
  function blankCell() {
    return attrs.bg === -1 && attrs.fl === 0 ? void 0 : { c: " ", fg: -1, bg: attrs.bg, fl: attrs.fl & FLAG.underline ? 0 : 0, w: 1, link: null };
  }
  function put(codePoint, text) {
    const width = cellWidth(codePoint);
    const line = lineAt();
    if (!line) return;
    if (width === 0) {
      const col = Math.max(0, x - 1);
      const cell = line.cells[col];
      if (cell) {
        cell.c = cell.c + text;
        line.version++;
      }
      return;
    }
    if (modes.wrap && x + width > buffer.cols) {
      line.wrapped = true;
      x = 0;
      indexDown();
    }
    if (x + width > buffer.cols) x = buffer.cols - width;
    if (modes.insert) insertCells(width);
    const target = lineAt();
    if (!target) return;
    if (width === 2 && x + 1 < buffer.cols) {
      target.cells[x + 1] = { c: "", fg: attrs.fg, bg: attrs.bg, fl: attrs.fl, w: 0, link: attrs.link };
    }
    target.cells[x] = { c: text, fg: attrs.fg, bg: attrs.bg, fl: attrs.fl, w: width, link: attrs.link };
    target.version++;
    x += width;
  }
  function indexDown() {
    if (y === scrollBottom) scrollUp(1);
    else y = Math.min(buffer.rows - 1, y + 1);
  }
  function indexUp() {
    if (y === scrollTop) scrollDown(1);
    else y = Math.max(0, y - 1);
  }
  function scrollUp(count2) {
    const top = absRow(scrollTop);
    const bottom = absRow(scrollBottom);
    if (top < 0 || bottom >= buffer.lines.length) return;
    const whole = scrollTop === 0 && scrollBottom === buffer.rows - 1;
    for (let i = 0; i < count2; i++) {
      if (whole) buffer.lines.push(blankLine(buffer.cols));
      else buffer.lines.splice(top, 0, blankLine(buffer.cols));
      if (!whole) buffer.lines.splice(bottom + 1, 1);
      while (buffer.lines.length > buffer.rows + buffer.scrollback) buffer.lines.shift();
    }
    dirtyAll = true;
  }
  function scrollDown(count2) {
    const top = absRow(scrollTop);
    const bottom = absRow(scrollBottom);
    if (top < 0 || bottom >= buffer.lines.length) return;
    for (let i = 0; i < count2; i++) {
      buffer.lines.splice(bottom, 1);
      buffer.lines.splice(top, 0, blankLine(buffer.cols));
    }
    dirtyAll = true;
  }
  function carriageReturn() {
    x = 0;
  }
  function lineFeed() {
    indexDown();
    if (modes.echo) {
    }
  }
  function eraseCells(row, from, to) {
    const line = lineAt(row);
    if (!line) return;
    const blank = blankCell();
    for (let col = Math.max(0, from); col < Math.min(buffer.cols, to); col++) line.cells[col] = blank;
    line.version++;
  }
  function eraseInLine(mode) {
    if (mode === 0) eraseCells(y, x, buffer.cols);
    else if (mode === 1) eraseCells(y, 0, x + 1);
    else eraseCells(y, 0, buffer.cols);
  }
  function eraseInDisplay(mode) {
    if (mode === 0) {
      eraseCells(y, x, buffer.cols);
      for (let row = y + 1; row < buffer.rows; row++) eraseCells(row, 0, buffer.cols);
    } else if (mode === 1) {
      for (let row = 0; row < y; row++) eraseCells(row, 0, buffer.cols);
      eraseCells(y, 0, x + 1);
    } else if (mode === 2) {
      for (let row = 0; row < buffer.rows; row++) eraseCells(row, 0, buffer.cols);
    } else if (mode === 3) {
      const keep = Math.max(0, buffer.lines.length - buffer.rows);
      buffer.lines.splice(0, keep);
      dirtyAll = true;
    }
  }
  function insertCells(count2) {
    const line = lineAt();
    if (!line) return;
    const head = line.cells.slice(0, x);
    const rest = line.cells.slice(x, Math.max(0, buffer.cols - count2));
    line.cells = head.concat(new Array(count2).fill(void 0), rest).slice(0, buffer.cols);
    while (line.cells.length < buffer.cols) line.cells.push(void 0);
    line.version++;
  }
  function deleteCells(count2) {
    const line = lineAt();
    if (!line) return;
    const head = line.cells.slice(0, x);
    const rest = line.cells.slice(x + count2);
    line.cells = head.concat(rest, new Array(count2).fill(void 0)).slice(0, buffer.cols);
    while (line.cells.length < buffer.cols) line.cells.push(void 0);
    line.version++;
  }
  function enterAlternate(clear) {
    if (!alt) {
      alt = true;
      modes.alt = true;
      buffer = alternate;
      if (clear) alternate.lines = Array.from({ length: alternate.rows }, () => blankLine(alternate.cols));
      dirtyAll = true;
    } else if (clear) {
      alternate.lines = Array.from({ length: alternate.rows }, () => blankLine(alternate.cols));
      dirtyAll = true;
    }
  }
  function leaveAlternate() {
    if (!alt) return;
    alt = false;
    modes.alt = false;
    buffer = primary;
    scrollTop = 0;
    scrollBottom = primary.rows - 1;
    dirtyAll = true;
  }
  function setColor(target, params2, index) {
    const kind = Number(params2[index + 1]);
    if (kind === 5) {
      const n = Number(params2[index + 2]);
      if (Number.isFinite(n) && n >= 0 && n < 256) {
        attrs[target] = n;
        return 3;
      }
      return 2;
    }
    if (kind === 2) {
      const r = Number(params2[index + 2]);
      const g = Number(params2[index + 3]);
      const b = Number(params2[index + 4]);
      if ([r, g, b].every((value) => Number.isFinite(value))) {
        attrs[target] = TRUECOLOR | clamp(r) << 16 | clamp(g) << 8 | clamp(b);
        return 5;
      }
      return 4;
    }
    return 1;
  }
  function clamp(value) {
    return Math.max(0, Math.min(255, Math.trunc(value)));
  }
  function applySgr(list2) {
    for (let i = 0; i < list2.length; i++) {
      const code = list2[i];
      switch (code) {
        case 0:
          attrs = { ...DEFAULT_ATTR };
          break;
        case 1:
          attrs.fl |= FLAG.bold;
          break;
        case 2:
          attrs.fl |= FLAG.dim;
          break;
        case 3:
          attrs.fl |= FLAG.italic;
          break;
        case 4:
          attrs.fl |= FLAG.underline;
          break;
        case 5:
        case 6:
          attrs.fl |= FLAG.blink;
          break;
        case 7:
          attrs.fl |= FLAG.inverse;
          break;
        case 8:
          attrs.fl |= FLAG.invisible;
          break;
        case 9:
          attrs.fl |= FLAG.strike;
          break;
        case 21:
        case 22:
          attrs.fl &= ~(FLAG.bold | FLAG.dim);
          break;
        case 23:
          attrs.fl &= ~FLAG.italic;
          break;
        case 24:
          attrs.fl &= ~FLAG.underline;
          break;
        case 25:
          attrs.fl &= ~FLAG.blink;
          break;
        case 27:
          attrs.fl &= ~FLAG.inverse;
          break;
        case 28:
          attrs.fl &= ~FLAG.invisible;
          break;
        case 29:
          attrs.fl &= ~FLAG.strike;
          break;
        case 38:
          i += setColor("fg", list2, i);
          break;
        case 48:
          i += setColor("bg", list2, i);
          break;
        case 39:
          attrs.fg = -1;
          break;
        case 49:
          attrs.bg = -1;
          break;
        default:
          if (code >= 30 && code <= 37) attrs.fg = code - 30;
          else if (code >= 40 && code <= 47) attrs.bg = code - 40;
          else if (code >= 90 && code <= 97) attrs.fg = code - 90 + 8;
          else if (code >= 100 && code <= 107) attrs.bg = code - 100 + 8;
          break;
      }
    }
  }
  function count(paramIndex = 0, fallback = 1) {
    const value = Number(Number.isFinite(list[paramIndex]) ? list[paramIndex] : fallback);
    return value === 0 ? fallback : value;
  }
  let list = [];
  function csi(final) {
    const params0 = list[0];
    switch (final) {
      case "@":
        insertCells(count());
        break;
      case "A":
        y = Math.max(scrollTop, y - count());
        break;
      case "B":
        y = Math.min(scrollBottom, y + count());
        break;
      case "C":
        x = Math.min(buffer.cols - 1, x + count());
        break;
      case "D":
        x = Math.max(0, x - count());
        break;
      case "E":
        x = 0;
        y = Math.min(scrollBottom, y + count());
        break;
      case "F":
        x = 0;
        y = Math.max(scrollTop, y - count());
        break;
      case "G":
      case "`":
        x = clampCol(count() - 1);
        break;
      case "H":
      case "f":
        y = clampRow((Number.isFinite(list[0]) ? list[0] : 1) - 1 + (modes.origin ? scrollTop : 0));
        x = clampCol((Number.isFinite(list[1]) ? list[1] : 1) - 1);
        break;
      case "I":
        for (let i = 0; i < count(); i++) x = nextTab(x);
        break;
      case "J":
        eraseInDisplay(Number.isFinite(params0) ? params0 : 0);
        break;
      case "K":
        eraseInLine(Number.isFinite(params0) ? params0 : 0);
        break;
      case "L":
        scrollDownAt(count());
        break;
      case "M":
        scrollUpAt(count());
        break;
      case "P":
        deleteCells(count());
        break;
      case "S":
        scrollUp(count());
        break;
      case "T":
        scrollDown(count());
        break;
      case "X":
        eraseCells(y, x, x + count());
        break;
      case "Z":
        for (let i = 0; i < count(); i++) x = previousTab(x);
        break;
      case "a":
        x = clampCol(x + count());
        break;
      case "b": {
        const line = lineAt();
        const previous = line?.cells[x - 1];
        if (previous) for (let i = 0; i < count(); i++) put(previous.c.codePointAt(0) ?? 32, previous.c);
        break;
      }
      case "d":
        y = clampRow(count() - 1);
        break;
      case "e":
        y = Math.min(scrollBottom, y + count());
        break;
      case "g":
        if (Number.isFinite(params0) && params0 === 3) tabs.clear();
        else tabs.delete(x);
        break;
      case "h":
        setModes(true);
        break;
      case "l":
        setModes(false);
        break;
      case "m":
        applySgr(list.length === 0 ? [0] : list);
        break;
      case "n":
        break;
      // status reports are answered by the host side, not us
      case "q":
        cursorStyle = ["block", "block", "block", "underline", "underline", "bar", "bar"][Number.isFinite(params0) ? params0 : 0] ?? "block";
        break;
      case "r": {
        const top = (Number.isFinite(list[0]) ? list[0] : 1) - 1;
        const bottom = (Number.isFinite(list[1]) ? list[1] : buffer.rows) - 1;
        if (top < bottom && bottom < buffer.rows) {
          scrollTop = Math.max(0, top);
          scrollBottom = bottom;
          y = modes.origin ? scrollTop : 0;
          x = 0;
        }
        break;
      }
      case "s":
        saved = { x, y, attrs: { ...attrs }, origin: modes.origin };
        break;
      case "u":
        x = saved.x;
        y = saved.y;
        attrs = { ...saved.attrs };
        break;
      case "t":
        break;
      // window manipulation: ignored on purpose
      default:
        break;
    }
  }
  function scrollDownAt(countLines2) {
    const top = absRow(y);
    const bottom = absRow(scrollBottom);
    if (top < 0 || bottom >= buffer.lines.length) return;
    for (let i = 0; i < countLines2; i++) {
      buffer.lines.splice(bottom, 1);
      buffer.lines.splice(top, 0, blankLine(buffer.cols));
    }
    dirtyAll = true;
  }
  function scrollUpAt(countLines2) {
    const top = absRow(y);
    const bottom = absRow(scrollBottom);
    if (top < 0 || bottom >= buffer.lines.length) return;
    for (let i = 0; i < countLines2; i++) {
      buffer.lines.splice(top, 1);
      buffer.lines.splice(bottom, 0, blankLine(buffer.cols));
    }
    dirtyAll = true;
  }
  function setModes(on) {
    const isPrivate = prefix === "?";
    for (const value of list) {
      if (!isPrivate) continue;
      switch (value) {
        case 1:
          modes.appCursor = on;
          break;
        case 6:
          modes.origin = on;
          y = on ? scrollTop : 0;
          x = 0;
          break;
        case 7:
          modes.wrap = on;
          break;
        case 4:
          modes.insert = on;
          break;
        case 25:
          modes.cursor = on;
          break;
        case 47:
        case 1047:
          if (on) enterAlternate(false);
          else leaveAlternate();
          break;
        case 1049:
          if (on) {
            saved = { x, y, attrs: { ...attrs }, origin: modes.origin };
            enterAlternate(true);
            x = 0;
            y = 0;
          } else {
            leaveAlternate();
            x = saved.x;
            y = saved.y;
          }
          break;
        case 1e3:
        case 1002:
        case 1003:
          modes.mouse = on ? String(value) : "off";
          break;
        case 1006:
          modes.sgrMouse = on;
          break;
        case 2004:
          modes.bracketedPaste = on;
          break;
        default:
          break;
      }
    }
  }
  function clampCol(value) {
    return Math.max(0, Math.min(buffer.cols - 1, value));
  }
  function clampRow(value) {
    return Math.max(0, Math.min(buffer.rows - 1, value));
  }
  function nextTab(from) {
    for (let col = from + 1; col < buffer.cols; col++) if (tabs.has(col)) return col;
    return buffer.cols - 1;
  }
  function previousTab(from) {
    for (let col = from - 1; col >= 0; col--) if (tabs.has(col)) return col;
    return 0;
  }
  function escape2(final) {
    switch (final) {
      case "D":
        indexDown();
        break;
      case "E":
        x = 0;
        indexDown();
        break;
      case "M":
        indexUp();
        break;
      case "7":
        saved = { x, y, attrs: { ...attrs }, origin: modes.origin };
        break;
      case "8":
        x = saved.x;
        y = saved.y;
        attrs = { ...saved.attrs };
        break;
      case "c":
        reset();
        break;
      case "H":
        tabs.add(x);
        break;
      default:
        break;
    }
  }
  function reset() {
    alt = false;
    modes.alt = false;
    buffer = primary;
    primary.lines = Array.from({ length: primary.rows }, () => blankLine(primary.cols));
    alternate.lines = Array.from({ length: alternate.rows }, () => blankLine(alternate.cols));
    x = 0;
    y = 0;
    attrs = { ...DEFAULT_ATTR };
    scrollTop = 0;
    scrollBottom = primary.rows - 1;
    tabs = defaultTabs(primary.cols);
    modes = { ...modes, wrap: true, origin: false, insert: false, cursor: true, appCursor: false, bracketedPaste: false, mouse: "off", sgrMouse: false };
    dirtyAll = true;
  }
  function dispatchOsc(payload) {
    const semicolon = payload.indexOf(";");
    const command = semicolon === -1 ? payload : payload.slice(0, semicolon);
    const body = semicolon === -1 ? "" : payload.slice(semicolon + 1);
    if (command === "0" || command === "2") {
      title = body;
      for (const listener of listeners.title) listener(title);
    }
  }
  function write(data) {
    if (typeof data !== "string" || data === "") return;
    const length = data.length;
    let i = 0;
    while (i < length) {
      if (state === "ground") {
        let end = i;
        while (end < length) {
          const code2 = data.charCodeAt(end);
          if (code2 < 32 || code2 === 127 || code2 === 27) break;
          end++;
        }
        if (end > i) {
          writeText(data.slice(i, end), end - i === 0);
          i = end;
          continue;
        }
        const ch = data[i];
        const code = data.charCodeAt(i);
        i++;
        if (code === 27) {
          state = "escape";
          intermediate = "";
          continue;
        }
        if (code === 13) {
          carriageReturn();
          continue;
        }
        if (code === 10 || code === 11 || code === 12) {
          lineFeed();
          continue;
        }
        if (code === 8) {
          x = Math.max(0, x - 1);
          continue;
        }
        if (code === 9) {
          x = nextTab(x);
          continue;
        }
        if (code === 7) {
          bell++;
          for (const listener of listeners.bell) listener();
          continue;
        }
        void ch;
        continue;
      }
      if (state === "escape") {
        const ch = data[i++];
        if (ch === "[") {
          state = "csi";
          params = "";
          prefix = "";
          intermediate = "";
          continue;
        }
        if (ch === "]") {
          state = "osc";
          osc = "";
          continue;
        }
        if (ch === "P" || ch === "^" || ch === "_") {
          state = "dcs";
          dcsSkip = true;
          continue;
        }
        if (ch === "(" || ch === ")" || ch === "*" || ch === "+") {
          state = "charset";
          intermediate = ch;
          continue;
        }
        if (ch === "#") {
          state = "hash";
          continue;
        }
        state = "ground";
        escape2(ch);
        continue;
      }
      if (state === "charset") {
        const ch = data[i++];
        state = "ground";
        if (intermediate === "(") charsetG0 = ch === "0" ? "dec" : "ascii";
        continue;
      }
      if (state === "hash") {
        i++;
        state = "ground";
        continue;
      }
      if (state === "csi") {
        const ch = data[i++];
        const code = ch.charCodeAt(0);
        if (code >= 48 && code <= 59) {
          params += ch;
          continue;
        }
        if (code >= 60 && code <= 63) {
          prefix = ch;
          continue;
        }
        if (code >= 32 && code <= 47) {
          intermediate += ch;
          continue;
        }
        if (code >= 64 && code <= 126) {
          state = "ground";
          list = parseParams(params);
          csi(ch);
          params = "";
          prefix = "";
          intermediate = "";
          continue;
        }
        state = "ground";
        continue;
      }
      if (state === "osc") {
        const ch = data[i++];
        if (ch === "\x07") {
          state = "ground";
          dispatchOsc(osc);
          osc = "";
          continue;
        }
        if (ch === "\x1B") {
          state = "oscEsc";
          continue;
        }
        osc += ch;
        if (osc.length > 4096) {
          state = "ground";
          osc = "";
        }
        continue;
      }
      if (state === "oscEsc") {
        const ch = data[i++];
        state = "ground";
        if (ch === "\\") dispatchOsc(osc);
        osc = "";
        continue;
      }
      if (state === "dcs") {
        const ch = data[i++];
        if (ch === "\x1B") {
          state = "dcsEsc";
          continue;
        }
        continue;
      }
      if (state === "dcsEsc") {
        const ch = data[i++];
        state = "ground";
        void ch;
        dcsSkip = false;
        continue;
      }
    }
  }
  function parseParams(raw) {
    if (raw === "") return [];
    const out = [];
    for (const part of raw.replace(/[:]/gu, ";").split(";")) {
      out.push(part === "" ? Number.NaN : Number(part));
    }
    return out;
  }
  function writeText(text, _unused) {
    if (charsetG0 === "dec") {
      for (const ch of text) {
        const mapped = DEC_GRAPHICS[ch];
        if (mapped) put(mapped.codePointAt(0), mapped);
        else put(ch.codePointAt(0), ch);
      }
      return;
    }
    for (const ch of text) {
      const code = ch.codePointAt(0);
      if (code === void 0) continue;
      if (code < 32) continue;
      put(code, ch);
    }
  }
  function viewport() {
    const start = Math.max(0, buffer.lines.length - buffer.rows);
    return buffer.lines.slice(start, start + buffer.rows);
  }
  function viewportAt(offset = 0) {
    const maxOffset = buffer === primary ? Math.max(0, buffer.lines.length - buffer.rows) : 0;
    const fromBottom = Math.min(Math.max(0, offset), maxOffset);
    const start = Math.max(0, buffer.lines.length - buffer.rows - fromBottom);
    if (fromBottom === 0) return viewport();
    return buffer.lines.slice(start, start + buffer.rows);
  }
  return {
    write,
    reset,
    resize(cols2, rows2) {
      if (cols2 === buffer.cols && rows2 === buffer.rows) return false;
      primary.resize(cols2, rows2);
      alternate.resize(cols2, rows2);
      scrollTop = 0;
      scrollBottom = rows2 - 1;
      tabs = defaultTabs(cols2);
      x = clampCol(x);
      y = clampRow(y);
      dirtyAll = true;
      return true;
    },
    viewport,
    viewportAt,
    /** Absolute buffer index of the viewport's first row, at a scrollback offset. */
    topRow(offset = 0) {
      const maxOffset = buffer === primary ? Math.max(0, buffer.lines.length - buffer.rows) : 0;
      const fromBottom = Math.min(Math.max(0, offset), maxOffset);
      return Math.max(0, buffer.lines.length - buffer.rows - fromBottom);
    },
    /** One row by absolute buffer index, for selection and copy. */
    lineAt(index) {
      return buffer.lines[index] ?? null;
    },
    /** Total rows held, scrollback included. */
    get bufferRows() {
      return buffer.lines.length;
    },
    get cols() {
      return buffer.cols;
    },
    get rows() {
      return buffer.rows;
    },
    get alt() {
      return alt;
    },
    get title() {
      return title;
    },
    get bellCount() {
      return bell;
    },
    get modes() {
      return { ...modes };
    },
    get cursor() {
      return { x, y, visible: modes.cursor, style: cursorStyle, blink: cursorBlink };
    },
    get attrs() {
      return { ...attrs };
    },
    get scrollbackRows() {
      return buffer === primary ? Math.max(0, buffer.lines.length - buffer.rows) : 0;
    },
    get dirtyAll() {
      return dirtyAll;
    },
    clearDirty() {
      dirtyAll = false;
    },
    onTitle(listener) {
      listeners.title.push(listener);
      return () => {
        const i = listeners.title.indexOf(listener);
        if (i >= 0) listeners.title.splice(i, 1);
      };
    },
    onBell(listener) {
      listeners.bell.push(listener);
      return () => {
        const i = listeners.bell.indexOf(listener);
        if (i >= 0) listeners.bell.splice(i, 1);
      };
    }
  };
}

// src/client/vt/render.js
var TRUECOLOR2 = 1 << 24;
var FLAG2 = { bold: 1, dim: 2, italic: 4, underline: 8, blink: 16, inverse: 32, invisible: 64, strike: 128 };
var BASE16 = [
  "#000000",
  "#cd0000",
  "#00cd00",
  "#cdcd00",
  "#0000ee",
  "#cd00cd",
  "#00cdcd",
  "#e5e5e5",
  "#7f7f7f",
  "#ff0000",
  "#00ff00",
  "#ffff00",
  "#5c5cff",
  "#ff00ff",
  "#00ffff",
  "#ffffff"
];
var paletteCache = null;
function palette256() {
  if (paletteCache) return paletteCache;
  const colors = BASE16.slice();
  const steps = [0, 95, 135, 175, 215, 255];
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) colors.push(rgbHex(steps[r], steps[g], steps[b]));
    }
  }
  for (let i = 0; i < 24; i++) {
    const level = 8 + i * 10;
    colors.push(rgbHex(level, level, level));
  }
  paletteCache = colors;
  return colors;
}
function rgbHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
function colorCss(value, fallback) {
  if (value === -1 || value === void 0 || value === null) return fallback;
  if (value & TRUECOLOR2) {
    const rgb = value & 16777215;
    return rgbHex(rgb >> 16 & 255, rgb >> 8 & 255, rgb & 255);
  }
  return palette256()[value] ?? fallback;
}
function escapeHtml(text) {
  if (text === "&") return "&amp;";
  if (text === "<") return "&lt;";
  if (text === ">") return "&gt;";
  if (text === '"') return "&quot;";
  if (text === "'") return "&#39;";
  return text;
}
function signature(cell, theme) {
  const inverse = (cell.fl & FLAG2.inverse) !== 0;
  const fg = colorCss(inverse ? cell.bg : cell.fg, inverse ? theme.bg : theme.fg);
  const bg = colorCss(inverse ? cell.fg : cell.bg, inverse ? theme.fg : theme.bg);
  const parts = [];
  if (cell.fl & FLAG2.bold) parts.push("font-weight:600");
  if (cell.fl & FLAG2.dim) parts.push("opacity:.65");
  if (cell.fl & FLAG2.italic) parts.push("font-style:italic");
  if (cell.fl & FLAG2.underline) parts.push("text-decoration:underline");
  if (cell.fl & FLAG2.strike) parts.push("text-decoration:line-through");
  if (cell.fl & FLAG2.invisible) parts.push("visibility:hidden");
  if (cell.bg !== -1 || inverse) parts.push(`background:${bg}`);
  parts.push(`color:${fg}`);
  return parts.join(";");
}
function rowHtml(line, theme) {
  const cells = line?.cells ?? [];
  let html = "";
  let run = "";
  let runStyle = null;
  let pendingBlanks = 0;
  const flushBlanks = () => {
    if (pendingBlanks > 0 && runStyle !== null) run += " ".repeat(pendingBlanks);
    pendingBlanks = 0;
  };
  const flush = () => {
    if (run !== "") html += `<span style="${runStyle}">${run}</span>`;
    run = "";
    pendingBlanks = 0;
  };
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell) {
      pendingBlanks++;
      continue;
    }
    if (cell.w === 0) continue;
    const style = signature(cell, theme);
    if (style !== runStyle) {
      flush();
      runStyle = style;
    }
    flushBlanks();
    run += escapeHtml(cell.c);
  }
  flush();
  return html;
}
function createRenderer({ container, doc = globalThis.document, theme = () => ({ fg: "#d4d4d4", bg: "#1e1e1e" }), font = () => ({ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }) } = {}) {
  const rowsEl = doc.createElement("div");
  rowsEl.className = "ce-term-rows";
  const selectionEl = doc.createElement("div");
  selectionEl.className = "ce-term-selection";
  const cursorEl = doc.createElement("div");
  cursorEl.className = "ce-term-cursor";
  const measureEl = doc.createElement("span");
  measureEl.className = "ce-term-measure";
  measureEl.textContent = "MMMMMMMMMM";
  container.appendChild(rowsEl);
  container.appendChild(selectionEl);
  container.appendChild(cursorEl);
  container.appendChild(measureEl);
  let cellWidth2 = 8;
  let rowHeight = 16;
  let rowEls = [];
  const versions = [];
  let themeValue = theme();
  let lastCursor = null;
  function measure() {
    const { fontFamily, fontSize } = font();
    const css = `${fontSize}px ${fontFamily}`;
    measureEl.style.font = css;
    rowsEl.style.font = css;
    rowsEl.style.fontKerning = "none";
    const width = measureEl.getBoundingClientRect().width / 10;
    if (width > 0) cellWidth2 = width;
    const style2 = doc.defaultView?.getComputedStyle?.(rowsEl);
    const lineHeight = style2 ? Number.parseFloat(style2.lineHeight) : Number.NaN;
    rowHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : Math.ceil(font().fontSize * 1.2);
    for (const el of rowEls) {
      el.style.height = `${rowHeight}px`;
      el.style.lineHeight = `${rowHeight}px`;
    }
    return { cellWidth: cellWidth2, rowHeight };
  }
  function ensureRows(count) {
    while (rowEls.length < count) {
      const el = doc.createElement("div");
      el.className = "ce-term-row";
      el.style.height = `${rowHeight}px`;
      el.style.lineHeight = `${rowHeight}px`;
      rowsEl.appendChild(el);
      rowEls.push(el);
      versions.push(-1);
    }
    while (rowEls.length > count) {
      const el = rowEls.pop();
      el.remove();
      versions.pop();
    }
  }
  function paint(screen, { offset = 0 } = {}) {
    themeValue = theme();
    const lines2 = screen.viewportAt(offset);
    ensureRows(lines2.length);
    for (let i = 0; i < lines2.length; i++) {
      const line = lines2[i];
      const version = line?.version ?? 0;
      if (versions[i] === version) continue;
      versions[i] = version;
      rowEls[i].innerHTML = rowHtml(line, themeValue);
    }
    const cursor = screen.cursor;
    const show = cursor.visible && offset === 0;
    cursorEl.style.display = show ? "block" : "none";
    if (show) {
      const style = cursor.style === "bar" ? "ce-term-cursor-bar" : cursor.style === "underline" ? "ce-term-cursor-underline" : "ce-term-cursor-block";
      if (lastCursor !== style) {
        cursorEl.className = `ce-term-cursor ${style}${cursor.blink ? " ce-term-cursor-blink" : ""}`;
        lastCursor = style;
      }
      cursorEl.style.transform = `translate(${cursor.x * cellWidth2}px, ${cursor.y * rowHeight}px)`;
      cursorEl.style.width = `${cellWidth2}px`;
      cursorEl.style.height = `${rowHeight}px`;
    }
  }
  function cellAt(clientX, clientY) {
    const box = rowsEl.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;
    const x = Math.floor((clientX - box.left) / cellWidth2);
    const y = Math.floor((clientY - box.top) / rowHeight);
    if (x < 0 || y < 0) return null;
    return { x: Math.min(x, Math.max(0, Math.round(box.width / cellWidth2) - 1)), y };
  }
  function invalidate() {
    for (let i = 0; i < versions.length; i++) versions[i] = -1;
  }
  function paintSelection(rects) {
    const wanted = Array.isArray(rects) ? rects : [];
    while (selectionEl.children.length < wanted.length) {
      const el = doc.createElement("div");
      el.className = "ce-term-selection-rect";
      selectionEl.appendChild(el);
    }
    while (selectionEl.children.length > wanted.length) {
      selectionEl.children[selectionEl.children.length - 1].remove();
    }
    for (let i = 0; i < wanted.length; i++) {
      const rect = wanted[i];
      const style = selectionEl.children[i].style;
      style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      style.width = `${rect.width}px`;
      style.height = `${rect.height}px`;
    }
  }
  return {
    measure,
    cellAt,
    paint,
    paintSelection,
    invalidate,
    get cellWidth() {
      return cellWidth2;
    },
    get rowHeight() {
      return rowHeight;
    },
    /** Size in device pixels consumed by the current grid. */
    gridSize(cols, rows) {
      return { width: cols * cellWidth2, height: rows * rowHeight };
    },
    dispose() {
      rowsEl.remove();
      selectionEl.remove();
      cursorEl.remove();
      measureEl.remove();
      rowEls = [];
      versions.length = 0;
    }
  };
}

// src/client/vt/keys.js
function modifierFor(event) {
  let value = 1;
  if (event.shiftKey) value += 1;
  if (event.altKey) value += 2;
  if (event.ctrlKey) value += 4;
  if (event.metaKey) value += 8;
  return value;
}
var CURSOR_KEYS = {
  ArrowUp: ["A", "A"],
  ArrowDown: ["B", "B"],
  ArrowRight: ["C", "C"],
  ArrowLeft: ["D", "D"],
  Home: ["H", "H"],
  End: ["F", "F"]
};
var TILDE_KEYS = {
  Insert: 2,
  Delete: 3,
  PageUp: 5,
  PageDown: 6,
  F5: 15,
  F6: 17,
  F7: 18,
  F8: 19,
  F9: 20,
  F10: 21,
  F11: 23,
  F12: 24
};
var SS3_KEYS = { F1: "P", F2: "Q", F3: "R", F4: "S" };
function keyToBytes(event, modes = {}) {
  const { key, ctrlKey, altKey, metaKey, shiftKey } = event;
  if (key === void 0) return null;
  const modified = modifierFor(event) !== 1;
  if (ctrlKey && !altKey && !metaKey && key.length === 1) {
    const upper = key.toUpperCase();
    if (upper >= "A" && upper <= "Z") return String.fromCharCode(upper.charCodeAt(0) - 64);
    if (key === " ") return "\0";
    if (key === "[") return "\x1B";
    if (key === "\\") return "";
    if (key === "]") return "";
    if (key === "^") return "";
    if (key === "_" || key === "-") return "";
    if (key === "?") return "";
    if (key === "@") return "\0";
    return null;
  }
  if (key === "Enter") return altKey ? "\x1B\r" : "\r";
  if (key === "Tab") return shiftKey ? "\x1B[Z" : "	";
  if (key === "Backspace") return ctrlKey ? "\b" : "";
  if (key === "Escape") return "\x1B";
  if (key === " ") return ctrlKey ? "\0" : null;
  const cursor = CURSOR_KEYS[key];
  if (cursor) {
    const [final, ss32] = cursor;
    if (!modified && modes.appCursor) return `\x1BO${ss32}`;
    if (!modified) return `\x1B[${final}`;
    return `\x1B[1;${modifierFor(event)}${final}`;
  }
  const tilde = TILDE_KEYS[key];
  if (tilde !== void 0) {
    return modified ? `\x1B[${tilde};${modifierFor(event)}~` : `\x1B[${tilde}~`;
  }
  const ss3 = SS3_KEYS[key];
  if (ss3) {
    return modified ? `\x1B[1;${modifierFor(event)}${ss3}` : `\x1BO${ss3}`;
  }
  return null;
}
function pasteToBytes(text, bracketed) {
  if (typeof text !== "string" || text === "") return "";
  const normalised = text.replace(/\r\n/gu, "\r").replace(/\n/gu, "\r");
  return bracketed ? `\x1B[200~${normalised}\x1B[201~` : normalised;
}

// src/client/vt/selection.js
function normalizeSelection(selection) {
  if (!selection?.anchor || !selection?.head) return { start: null, end: null, empty: true };
  const { anchor, head } = selection;
  const anchorFirst = anchor.row < head.row || anchor.row === head.row && anchor.col <= head.col;
  return {
    start: anchorFirst ? anchor : head,
    end: anchorFirst ? head : anchor,
    empty: anchor.row === head.row && anchor.col === head.col
  };
}
function selectionRow(selection, row, cols) {
  const { start, end, empty } = normalizeSelection(selection);
  if (empty || start === null) return null;
  if (row < start.row || row > end.row) return null;
  const from = row === start.row ? start.col : 0;
  const to = row === end.row ? end.col : cols;
  return to > from ? { from, to: Math.min(to, cols) } : null;
}
function selectionText(selection, lineAt, cols) {
  const { start, end, empty } = normalizeSelection(selection);
  if (empty || start === null) return "";
  const out = [];
  for (let row = start.row; row <= end.row; row++) {
    const line = lineAt(row);
    if (!line) continue;
    const span = selectionRow(selection, row, cols);
    if (!span) continue;
    let text = "";
    for (let col = span.from; col < span.to; col++) {
      const cell = line.cells[col];
      if (!cell || cell.w === 0) continue;
      text += cell.c;
    }
    const lastRow = row === end.row;
    if (!lastRow && line.wrapped) out.push(text);
    else out.push(lastRow ? text : `${text}
`);
  }
  return out.join("");
}
var WORD_RE = /[\p{L}\p{N}_\-./\\:@~+]$/u;
function wordRange(line, col) {
  const cells = line?.cells ?? [];
  const charAt = (index) => {
    const cell = cells[index];
    if (!cell || cell.w === 0) return "";
    return cell.c;
  };
  if (!WORD_RE.test(charAt(col))) return { from: col, to: Math.min(col + 1, cells.length) };
  let from = col;
  while (from > 0 && WORD_RE.test(charAt(from - 1))) from--;
  let to = col + 1;
  while (to < cells.length && WORD_RE.test(charAt(to))) to++;
  return { from, to };
}
function selectWord(line, row, col) {
  const { from, to } = wordRange(line, col);
  return { anchor: { row, col: from }, head: { row, col: to } };
}
function selectLine(row, cols) {
  return { anchor: { row, col: 0 }, head: { row, col: cols } };
}
function selectAll(rows, cols) {
  return { anchor: { row: 0, col: 0 }, head: { row: Math.max(0, rows - 1), col: cols } };
}

// src/client/vt/mouse.js
var BUTTON = { left: 0, middle: 1, right: 2, wheelUp: 64, wheelDown: 65, wheelLeft: 66, wheelRight: 67 };
var MOTION = 32;
function modifierBits(event) {
  return (event.shiftKey ? 4 : 0) | (event.altKey ? 8 : 0) | (event.ctrlKey ? 16 : 0);
}
function mouseOwned(modes) {
  return modes?.mouse !== void 0 && modes.mouse !== "off";
}
function reportsMotion(mode) {
  return mode === "1002" || mode === "1003";
}
function reportsHover(mode) {
  return mode === "1003";
}
function encodeMouse(event, { protocol = "x10", mode = "1000" } = {}) {
  const { action } = event;
  if (action === "move" && !reportsHover(mode)) return null;
  if (action === "drag" && !reportsMotion(mode)) return null;
  if (action === "press" && mode === "off") return null;
  const button = action === "move" ? 3 : BUTTON[event.button] ?? 0;
  let code = button + modifierBits(event);
  if (action === "drag" || action === "move") code += MOTION;
  const wheel = button >= 64;
  const column = Math.max(0, Math.trunc(event.x));
  const row = Math.max(0, Math.trunc(event.y));
  if (protocol === "sgr") {
    const final = action === "release" && !wheel ? "m" : "M";
    return `\x1B[<${code};${column + 1};${row + 1}${final}`;
  }
  if (column > 222 || row > 222) return null;
  const released = action === "release" ? 3 : code;
  const bytes = [32 + released, 33 + Math.min(column, 222), 33 + Math.min(row, 222)];
  return `\x1B[M${String.fromCharCode(...bytes)}`;
}
function encodeWheel(event, options) {
  if (!mouseOwned({ mouse: options?.mode })) return null;
  return encodeMouse({ ...event, button: event.deltaY < 0 ? "wheelUp" : "wheelDown", action: "press" }, options);
}

// src/client/vt/body.js
function applyRenderFrame(screen, render) {
  const payload = render?.frame;
  if (!payload) return false;
  if (payload.type === "snapshot") {
    screen.reset();
    const info = payload.info ?? {};
    if (Number.isFinite(info.cols) && Number.isFinite(info.rows)) screen.resize(info.cols, info.rows);
    screen.write(typeof payload.screen === "string" ? payload.screen : "");
    return true;
  }
  if (payload.type === "output") {
    screen.write(typeof payload.data === "string" ? payload.data : "");
    return true;
  }
  return false;
}
var DEFAULT_THEME = {
  fg: "#d4d4d4",
  bg: "#1e1e1e",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 13
};
function themeOf(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return DEFAULT_THEME;
  const family = snapshot.fontFamilies?.terminal ?? DEFAULT_THEME.fontFamily;
  const size = snapshot.fontSizes?.terminal ?? DEFAULT_THEME.fontSize;
  return {
    fg: DEFAULT_THEME.fg,
    bg: DEFAULT_THEME.bg,
    fontFamily: family === "" ? DEFAULT_THEME.fontFamily : `${family}, ${DEFAULT_THEME.fontFamily}`,
    fontSize: Number.isFinite(size) ? size : DEFAULT_THEME.fontSize
  };
}
function TerminalBody({ useTabInfo, useTerminal, useTheme, view, t }) {
  const { tab } = useTabInfo();
  const model = view(tab.id);
  const state = useTerminal(tab.id);
  const themeSnapshot = useTheme ? useTheme((value) => value) : null;
  const theme = themeOf(themeSnapshot);
  const hostRef = useRef(null);
  const engine = useRef(null);
  const [engineReady, setEngineReady] = useState(0);
  const latest = useRef({ state, writable: false, theme });
  latest.current = { state, writable: Boolean(state?.writable), theme };
  useEffect(() => model.mount(), [model]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof document === "undefined") return void 0;
    const screen = createScreen({
      cols: 80,
      rows: 24,
      scrollback: latest.current.state?.environment?.scrollback ?? 1e3
    });
    const renderer = createRenderer({
      container: host,
      theme: () => latest.current.theme,
      font: () => latest.current.theme
    });
    renderer.measure();
    const input = document.createElement("textarea");
    input.className = "ce-term-input";
    input.setAttribute("aria-label", t("terminal.title"));
    input.autocapitalize = "off";
    input.autocomplete = "off";
    input.spellcheck = false;
    host.appendChild(input);
    let frame = 0;
    let offset = 0;
    let dirty = true;
    let selection = null;
    let dragKind = null;
    let clickCount = 0;
    let lastClick = { at: 0, row: -1, col: -1 };
    const rectsForSelection = () => {
      if (selection === null) return [];
      const first = screen.topRow(offset);
      const rects = [];
      for (let row = 0; row < screen.rows; row++) {
        const span = selectionRow(selection, first + row, screen.cols);
        if (span === null) continue;
        rects.push({
          left: span.from * renderer.cellWidth,
          top: row * renderer.rowHeight,
          width: Math.max(1, (span.to - span.from) * renderer.cellWidth),
          height: renderer.rowHeight
        });
      }
      return rects;
    };
    const paint = () => {
      frame = 0;
      if (!dirty) return;
      dirty = false;
      renderer.paint(screen, { offset });
      renderer.paintSelection(rectsForSelection());
    };
    const schedule = () => {
      dirty = true;
      if (frame === 0) frame = requestAnimationFrame(paint);
    };
    const clearSelection = () => {
      if (selection === null) return;
      selection = null;
      schedule();
    };
    const fit = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width <= 0 || height <= 0) return;
      const cols = Math.max(2, Math.floor(width / renderer.cellWidth));
      const rows = Math.max(1, Math.floor(height / renderer.rowHeight));
      const changed = screen.resize(cols, rows);
      renderer.measure();
      renderer.invalidate();
      schedule();
      const info = latest.current.state?.info;
      if (changed && latest.current.writable && (info === void 0 || info.cols !== cols || info.rows !== rows)) {
        model.resize(cols, rows);
      }
    };
    const copySelection = async () => {
      if (selection === null) return false;
      const text = selectionText(selection, (row) => screen.lineAt(row), screen.cols);
      if (text === "") return false;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return false;
      }
      return true;
    };
    const reportMouse = (action, event) => {
      if (!latest.current.writable) return false;
      const cell = renderer.cellAt(event.clientX, event.clientY);
      if (cell === null) return false;
      const bytes = encodeMouse({
        button: event.button === 2 ? "right" : event.button === 1 ? "middle" : "left",
        action,
        x: cell.x,
        y: cell.y,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey
      }, { protocol: screen.modes.sgrMouse ? "sgr" : "x10", mode: screen.modes.mouse });
      if (bytes === null) return false;
      model.write(bytes, true);
      return true;
    };
    const onKeyDown = (event) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (!latest.current.writable) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey && (event.key === "c" || event.key === "C") && !event.shiftKey) {
        if (selection !== null) {
          event.preventDefault();
          void copySelection().then((copied) => {
            if (copied) clearSelection();
          });
          return;
        }
        if (event.metaKey) return;
      }
      if (mod && event.shiftKey && (event.key === "c" || event.key === "C")) {
        if (selection !== null) {
          event.preventDefault();
          void copySelection().then((copied) => {
            if (copied) clearSelection();
          });
          return;
        }
      }
      if (mod && !event.altKey && !event.shiftKey && (event.key === "a" || event.key === "A") && selection !== null) {
        event.preventDefault();
        selection = selectAll(screen.bufferRows, screen.cols);
        schedule();
        return;
      }
      if (event.metaKey && !event.altKey && !event.ctrlKey && (event.key === "a" || event.key === "A") && selection === null) {
        event.preventDefault();
        selection = selectAll(screen.bufferRows, screen.cols);
        schedule();
        return;
      }
      if (event.shiftKey && (event.key === "PageUp" || event.key === "PageDown" || event.key === "Home" || event.key === "End")) {
        event.preventDefault();
        const pages = Math.max(1, screen.rows - 1);
        if (event.key === "PageUp") offset = Math.min(offset + pages, screen.scrollbackRows);
        else if (event.key === "PageDown") offset = Math.max(0, offset - pages);
        else if (event.key === "Home") offset = screen.scrollbackRows;
        else offset = 0;
        schedule();
        return;
      }
      const bytes = keyToBytes(event, screen.modes);
      if (bytes === null) return;
      event.preventDefault();
      clearSelection();
      model.write(bytes, true);
      if (offset !== 0) {
        offset = 0;
        schedule();
      }
    };
    const onInput = () => {
      if (!latest.current.writable) {
        input.value = "";
        return;
      }
      const text = input.value;
      if (text === "") return;
      input.value = "";
      clearSelection();
      model.write(text, true);
      if (offset !== 0) {
        offset = 0;
        schedule();
      }
    };
    const onPaste = (event) => {
      if (!latest.current.writable) return;
      const text = event.clipboardData?.getData("text") ?? "";
      if (text === "") return;
      event.preventDefault();
      clearSelection();
      model.write(pasteToBytes(text, screen.modes.bracketedPaste), true);
      if (offset !== 0) {
        offset = 0;
        schedule();
      }
    };
    const onWheel = (event) => {
      if (mouseOwned(screen.modes) && !event.shiftKey && latest.current.writable) {
        const cell = renderer.cellAt(event.clientX, event.clientY);
        if (cell !== null) {
          const bytes = encodeWheel(
            { deltaY: event.deltaY, x: cell.x, y: cell.y, shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey },
            { protocol: screen.modes.sgrMouse ? "sgr" : "x10", mode: screen.modes.mouse }
          );
          if (bytes !== null) {
            event.preventDefault();
            model.write(bytes, true);
            return;
          }
        }
      }
      const step = event.deltaMode === 1 ? 1 : 3;
      const next = offset + (event.deltaY > 0 ? -step : step);
      const clamped = Math.max(0, Math.min(next, screen.scrollbackRows));
      if (clamped === offset) return;
      event.preventDefault();
      offset = clamped;
      schedule();
    };
    const onFocus = () => host.classList.add("ce-term-focused");
    const onBlur = () => host.classList.remove("ce-term-focused");
    const onPointerDown = (event) => {
      input.focus({ preventScroll: true });
      if (event.button !== 0) return;
      if (mouseOwned(screen.modes) && !event.shiftKey) {
        if (reportMouse("press", event)) {
          dragKind = "mouse";
          host.setPointerCapture?.(event.pointerId);
          return;
        }
      }
      const cell = renderer.cellAt(event.clientX, event.clientY);
      if (cell === null) return;
      const row = screen.topRow(offset) + cell.y;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const repeat = lastClick.row === row && lastClick.col === cell.x && now - lastClick.at < 500;
      clickCount = repeat ? Math.min(3, clickCount + 1) : 1;
      lastClick = { at: now, row, col: cell.x };
      if (clickCount >= 3) selection = selectLine(row, screen.cols);
      else if (clickCount === 2) selection = selectWord(screen.lineAt(row), row, cell.x);
      else selection = { anchor: { row, col: cell.x }, head: { row, col: cell.x } };
      dragKind = "select";
      host.setPointerCapture?.(event.pointerId);
      schedule();
    };
    const onPointerMove = (event) => {
      if (dragKind === "mouse") {
        if (reportsMotion(screen.modes.mouse)) reportMouse("drag", event);
        return;
      }
      if (dragKind !== "select" || selection === null) return;
      const cell = renderer.cellAt(event.clientX, event.clientY);
      if (cell === null) return;
      const row = screen.topRow(offset) + cell.y;
      if (selection.head.row === row && selection.head.col === cell.x) return;
      selection = { anchor: selection.anchor, head: { row, col: cell.x } };
      if (cell.y < 0 && offset < screen.scrollbackRows) offset += 1;
      else if (cell.y >= screen.rows && offset > 0) offset -= 1;
      schedule();
    };
    const onPointerUp = (event) => {
      if (dragKind === "mouse" && reportsMotion(screen.modes.mouse)) reportMouse("release", event);
      dragKind = null;
      host.releasePointerCapture?.(event.pointerId);
    };
    const onContextMenu = (event) => {
      event.preventDefault();
      if (selection !== null) {
        void copySelection().then((copied) => {
          if (copied) clearSelection();
        });
        return;
      }
      input.focus({ preventScroll: true });
    };
    input.addEventListener("keydown", onKeyDown);
    input.addEventListener("input", onInput);
    input.addEventListener("paste", onPaste);
    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    host.addEventListener("wheel", onWheel, { passive: false });
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("contextmenu", onContextMenu);
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    fit();
    schedule();
    engine.current = {
      screen,
      renderer,
      input,
      fit,
      schedule,
      resetOffset() {
        offset = 0;
      },
      /** Apply one render frame and acknowledge it to the Host immediately. */
      copySelection,
      get selection() {
        return selection;
      },
      get scrollbackOffset() {
        return offset;
      },
      apply(render) {
        if (!render) return;
        const snapshot = render.frame?.type === "snapshot";
        applyRenderFrame(screen, render);
        if (snapshot) renderer.invalidate();
        offset = 0;
        schedule();
        model.acknowledge(render.revision);
      },
      measure: () => renderer.measure(),
      dispose() {
        observer.disconnect();
        if (frame !== 0) cancelAnimationFrame(frame);
        input.removeEventListener("keydown", onKeyDown);
        input.removeEventListener("input", onInput);
        input.removeEventListener("paste", onPaste);
        input.removeEventListener("focus", onFocus);
        input.removeEventListener("blur", onBlur);
        host.removeEventListener("wheel", onWheel);
        host.removeEventListener("pointerdown", onPointerDown);
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerup", onPointerUp);
        host.removeEventListener("pointercancel", onPointerUp);
        host.removeEventListener("contextmenu", onContextMenu);
        input.remove();
        renderer.dispose();
      }
    };
    setEngineReady((value) => value + 1);
    return () => {
      engine.current?.dispose();
      engine.current = void 0;
    };
  }, [model]);
  useEffect(() => {
    const current = engine.current;
    if (!current) return;
    const rows = current.screen.rows;
    current.measure();
    current.renderer.invalidate();
    current.fit();
    void rows;
  }, [theme.fontFamily, theme.fontSize, engineReady]);
  useEffect(() => {
    engine.current?.apply(state?.render);
  }, [state?.render, engineReady]);
  useEffect(() => {
    if (!state?.writable || tab.visible === false) return;
    const input = engine.current?.input;
    input?.focus({ preventScroll: true });
  }, [state?.writable, tab.visible, engineReady]);
  const failed = state?.phase === "failed" || state?.issue !== void 0;
  return h(
    "div",
    { className: "ce-term-shell" },
    h("div", { className: "ce-term", ref: hostRef, "data-ce-terminal": "" }),
    state?.info === void 0 && !failed ? h("div", { className: "ce-term-status", role: "status" }, t("terminal.connecting")) : null,
    failed ? h("div", { className: "ce-term-status ce-term-status-error", role: "alert" }, state?.error ?? t("terminal.failed")) : null
  );
}

// src/client/termtab.js
var TERM_TAB_ID = "dsh-plugin-kit/terminal";
var TERM_TAB_KIND = "kit-terminal";
var HELD_KINDS = [TERM_TAB_KIND, "terminal"];
function terminalDefinition(t) {
  return {
    id: TERM_TAB_ID,
    kind: TERM_TAB_KIND,
    priority: "extension",
    multiple: true,
    keepMounted: true,
    title: () => t("terminal.title"),
    guide: [{ id: "new", order: 20, title: () => t("terminal.title"), description: () => t("terminal.guide") }]
  };
}
function TerminalTitle({ useTabInfo, t }) {
  const info = useTabInfo ? useTabInfo() : null;
  return h("span", { className: "ce-term-title" }, `>_ ${info?.tab?.title ?? (t ? t("terminal.title") : "Terminal")}`);
}
function canInstallTerminalTab(ctx) {
  try {
    return typeof ctx?.webTerminals?.view === "function" && typeof ctx.webTerminals.retainTabs === "function" && typeof ctx?.sidebarRightTabs?.register === "function" && typeof ctx?.sidebarRight?.registerCloseHandler === "function";
  } catch {
    return false;
  }
}
function installTerminalTab(ctx, t) {
  if (!canInstallTerminalTab(ctx)) return () => {
  };
  const occurrenceOf = (sessionId, key) => ctx.sidebarRight.tabDomain.occurrence(sessionId, { id: key });
  const paramsOf = (sessionId, key) => occurrenceOf(sessionId, key).navigation.getSnapshot().params;
  const terminalIdOf = (sessionId, key) => {
    const params = paramsOf(sessionId, key);
    return params !== void 0 && "terminalId" in params ? params.terminalId : void 0;
  };
  const viewFor = (sessionId, key) => {
    const navigation = occurrenceOf(sessionId, key).navigation.getSnapshot();
    const params = navigation.params;
    const shellPath = params !== void 0 && "shellPath" in params ? params.shellPath : void 0;
    return ctx.webTerminals.view(sessionId, key, navigation.address, void 0, shellPath);
  };
  const theme = ctx.theme === void 0 ? void 0 : {
    getSnapshot: () => ctx.theme.getTheme(),
    subscribe: (listener) => ctx.on("theme/change", listener)
  };
  const injectBody = (sessionId) => ({
    view: (key) => viewFor(sessionId, key),
    keyedHooks: { terminal: (key) => viewFor(sessionId, key).state },
    ...theme === void 0 ? {} : { hooks: { theme } }
  });
  const disposers = [];
  disposers.push(ctx.sidebarRightTabs.register(terminalDefinition(t)));
  disposers.push(ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: TERM_TAB_ID,
    locale: NS,
    inject: injectBody
  }, TerminalBody)));
  disposers.push(ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
    name: "sidebar.right.pane.tab.title",
    key: TERM_TAB_ID,
    locale: NS
  }, TerminalTitle)));
  disposers.push(ctx.sidebarRight.registerCloseHandler(TERM_TAB_KIND, (sessionId, tab) => {
    ctx.webTerminals.close(sessionId, tab.id, tab.contentId, terminalIdOf(sessionId, tab.id));
  }));
  ctx.effect(() => {
    const held = () => ctx.sidebarRight.openTabs.getSnapshot().filter((tab) => HELD_KINDS.includes(tab.kind));
    const sync = () => ctx.webTerminals.retainTabs(held());
    const off = ctx.sidebarRight.openTabs.subscribe(sync);
    sync();
    return () => {
      off();
      ctx.webTerminals.retainTabs(ctx.sidebarRight.openTabs.getSnapshot().filter((tab) => tab.kind === "terminal"));
    };
  }, "code-explorer: terminal holds");
  return () => {
    for (const dispose of disposers) dispose();
  };
}

// src/client/rightbarwidth.js
var WIDTH_KEY = "dsh-kit.rightbar-width";
var MIN_WIDTH = 300;
var MAX_REQUEST = 1e7;
function rightbarWidthWriter(layout) {
  const actions = layout && layout.panels;
  if (typeof actions?.setRightbar !== "function") return null;
  return (px) => {
    try {
      actions.setRightbar(px);
      return true;
    } catch {
      return false;
    }
  };
}
function readRememberedWidth(storage = globalThis.localStorage) {
  let raw = null;
  try {
    raw = storage?.getItem(WIDTH_KEY);
  } catch {
    return null;
  }
  if (raw === null || raw === void 0) return null;
  const px = Math.round(Number(raw));
  return Number.isFinite(px) && px >= MIN_WIDTH ? px : null;
}
function rememberWidth(px, storage = globalThis.localStorage) {
  const width = Math.round(Number(px));
  if (!Number.isFinite(width) || width < MIN_WIDTH) return false;
  try {
    storage?.setItem(WIDTH_KEY, String(width));
    return true;
  } catch {
    return false;
  }
}
function measureRightbarWidth(doc = globalThis.document) {
  let box = null;
  try {
    box = doc?.querySelector?.("[data-rightbar-col]")?.getBoundingClientRect?.();
  } catch {
    return 0;
  }
  const width = box && Number.isFinite(box.width) ? Math.round(box.width) : 0;
  return width >= MIN_WIDTH ? width : 0;
}
var settle = (run) => {
  const raf = typeof globalThis.requestAnimationFrame === "function" ? globalThis.requestAnimationFrame.bind(globalThis) : null;
  if (raf) raf(() => raf(run));
  else globalThis.setTimeout?.(run, 32);
};
var shownOnScreen = (doc) => {
  try {
    return Boolean(doc?.querySelector?.('[data-side="rightbar"]'));
  } catch {
    return false;
  }
};
function installRightbarWidth({
  layout,
  doc = globalThis.document,
  storage = globalThis.localStorage,
  view,
  afterDrag = settle
} = {}) {
  const write = rightbarWidthWriter(layout);
  if (write === null) return () => {
  };
  let chosen = readRememberedWidth(storage);
  write(chosen ?? MAX_REQUEST);
  if (typeof doc?.addEventListener !== "function") return () => {
  };
  const frame = view ?? doc.defaultView ?? globalThis.window;
  const onPointerUp = (event) => {
    const handle = event?.target?.closest?.('[data-side="rightbar"]');
    if (!handle) return;
    afterDrag(() => {
      const px = measureRightbarWidth(doc);
      if (px > 0) {
        chosen = px;
        rememberWidth(px, storage);
      }
    });
  };
  const onResize = () => {
    if (chosen !== null || shownOnScreen(doc)) return;
    write(MAX_REQUEST);
  };
  doc.addEventListener("pointerup", onPointerUp, true);
  if (typeof frame?.addEventListener === "function") frame.addEventListener("resize", onResize);
  return () => {
    try {
      doc.removeEventListener("pointerup", onPointerUp, true);
    } catch {
    }
    try {
      frame?.removeEventListener?.("resize", onResize);
    } catch {
    }
  };
}

// src/client/orphans.js
var NAV_PREFIX = "dsh.plugin-kit.v1.";
var BROWSER_PREFIX = "dsh.plugin-kit.browser.tabs.v2.";
var CLEANED_FLAG = "dsh.plugin-kit.orphans.cleaned";
function pruneOrphanKeys(liveSessionIds, storage = globalThis.localStorage) {
  if (!storage || typeof storage.key !== "function") return 0;
  try {
    if (storage.getItem(CLEANED_FLAG) !== null) return 0;
  } catch {
    return 0;
  }
  const live = new Set(Array.isArray(liveSessionIds) ? liveSessionIds : []);
  let removed = 0;
  const toRemove = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    if (key.startsWith(NAV_PREFIX)) {
      const sid = key.slice(NAV_PREFIX.length);
      if (!live.has(sid)) toRemove.push(key);
    } else if (key.startsWith(BROWSER_PREFIX)) {
      const rest = key.slice(BROWSER_PREFIX.length);
      const dot = rest.indexOf(".");
      const sid = dot >= 0 ? rest.slice(0, dot) : rest;
      if (!live.has(sid)) toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    try {
      storage.removeItem(key);
      removed++;
    } catch {
    }
  }
  try {
    storage.setItem(CLEANED_FLAG, String(Date.now()));
  } catch {
  }
  return removed;
}

// src/client/index.js
var index_default = {
  inject: ["slots", "locale", "sidebarRightTabs", "sidebarRight", "layout"],
  apply(ctx) {
    const safe = (label, fn) => {
      try {
        ctx.effect(fn, label);
      } catch (error) {
        console.error(`code-explorer: ${label} failed`, error);
      }
    };
    safe("styles", insertStyles);
    safe("orphan cleanup", () => {
      ctx.inject(["sessions"], (sessionsCtx) => {
        if (!sessionsCtx.sessions) return;
        const live = /* @__PURE__ */ new Set();
        try {
          const snap = sessionsCtx.sessions.getSnapshot?.();
          if (snap && typeof snap === "object") {
            for (const id of Object.keys(snap.byId ?? {})) live.add(id);
          }
        } catch {
        }
        pruneOrphanKeys([...live]);
      });
    });
    safe("right sidebar width", () => installRightbarWidth({ layout: ctx.layout }));
    const bound = ctx.locale.bind(NS);
    safe("dictionaries", () => ctx.locale.register(NS, { zh, en }));
    let builtinTerminal = false;
    ctx.inject(["webTerminals"], (terminalCtx) => {
      terminalCtx.effect(() => {
        const dispose = installTerminalTab(terminalCtx, bound);
        builtinTerminal = true;
        return () => {
          builtinTerminal = false;
          dispose();
        };
      }, "code-explorer: terminal tab");
    });
    const terminal = createTerminalEntry();
    const openBuiltinTerminal = () => {
      try {
        ctx.sidebarRight.openTab(TERM_TAB_KIND, { preferNewPane: true });
        return true;
      } catch {
        return false;
      }
    };
    ctx.inject(["workspaces"], (browserCtx) => {
      browserCtx.effect(() => installBrowser(browserCtx, bound), "toolbox: enhanced browser");
    });
    safe("tab type", () => ctx.sidebarRightTabs.register(definition(bound)));
    const Bound = (props) => h(CodeBody, { ...props, t: props.t ?? bound, terminal, openBuiltinTerminal, builtinTerminal: () => builtinTerminal });
    safe("tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: TAB_ID,
      locale: NS
    }, Bound)));
    safe("tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
      name: "sidebar.right.pane.tab.title",
      key: TAB_ID
    }, CodeTitle)));
    safe("skills tab type", () => ctx.sidebarRightTabs.register(skillsDefinition(bound)));
    const SkillsBound = (props) => h(SkillsTabBody, { ...props, t: props.t ?? bound });
    safe("skills tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: SKILLS_TAB_ID,
      locale: NS
    }, SkillsBound)));
    safe("skills tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
      name: "sidebar.right.pane.tab.title",
      key: SKILLS_TAB_ID
    }, SkillsTitle)));
    safe("api tab type", () => ctx.sidebarRightTabs.register(apiDefinition(bound)));
    const ApiBound = (props) => h(WorkbenchView, {
      ...props,
      t: props.t ?? bound,
      http: h(ApiView, { ...props, t: props.t ?? bound }),
      grpc: h(RpcView, { ...props, t: props.t ?? bound })
    });
    safe("api tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: API_TAB_ID,
      locale: NS
    }, ApiBound)));
    for (const kind of [TAB_KIND, SKILLS_TAB_KIND]) {
      safe(`unsaved close guard: ${kind}`, () => registerToolCloseGuard(ctx.sidebarRight, kind, () => bound("editor.dirtyGuard")));
    }
    safe("api tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
      name: "sidebar.right.pane.tab.title",
      key: API_TAB_ID
    }, ApiTitle)));
    safe("db tab type", () => ctx.sidebarRightTabs.register(dbDefinition(bound)));
    const DbBound = (props) => h(DbView, { ...props, t: props.t ?? bound });
    safe("db tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: DB_TAB_ID,
      locale: NS
    }, DbBound)));
    safe("db tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
      name: "sidebar.right.pane.tab.title",
      key: DB_TAB_ID
    }, DbTitle)));
    safe("legacy rpc tabs", () => ctx.effect(() => {
      const migrated = /* @__PURE__ */ new Set();
      const run = () => {
        let tabs = [];
        try {
          tabs = ctx.sidebarRight.openTabs.getSnapshot();
        } catch {
          return;
        }
        migrateLegacyRpcTabs({
          tabs,
          migrated,
          canOpen: () => Boolean(ctx.sidebarRightTabs.get(API_TAB_ID)),
          preferGrpc: () => {
            writeProtocol("grpc");
          },
          close: (tab) => {
            ctx.sidebarRight.close(tab.id);
          },
          open: (sessionId) => {
            ctx.sidebarRight.openTabIn(sessionId, API_TAB_KIND, {});
          }
        });
      };
      const off = ctx.sidebarRight.openTabs.subscribe(run);
      run();
      return () => off();
    }, "code-explorer: legacy rpc tabs"));
    safe("rpc tab type", () => ctx.sidebarRightTabs.register(rpcDefinition(bound)));
    const RpcBound = (props) => h(RpcView, { ...props, t: props.t ?? bound });
    safe("rpc tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: RPC_TAB_ID,
      locale: NS
    }, RpcBound)));
    safe("rpc tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
      name: "sidebar.right.pane.tab.title",
      key: RPC_TAB_ID
    }, RpcTitle)));
    safe("call diff rows", () => ctx.slots.inject("tool.call.toolview", function* () {
      const bridge = {
        t: bound,
        openCallDiff: (payload, element) => {
          const target = ctx.sidebarRight.commandTarget(element);
          if (target === void 0) return false;
          ctx.sidebarRight.openTabFromTarget(TAB_KIND, target);
          setTimeout(() => document.dispatchEvent(new CustomEvent("dsh-ce-open-calldiff", { detail: payload })), 250);
          return true;
        }
      };
      yield ctx.slots.register({ name: "tool.call.toolview", key: "edit", priority: -1, inject: () => bridge }, CallDiffRow);
      yield ctx.slots.register({ name: "tool.call.toolview", key: "write", priority: -1, inject: () => bridge }, CallDiffRow);
    }));
    ctx.inject(["shortcuts"], (shortcutCtx) => {
      try {
        shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
          id: "code.explorer",
          label: () => bound("guide.title"),
          aliases: ["code explorer", "code browser", "daima"],
          defaults: {
            "desktop:macos": { code: "KeyE", modifiers: ["primary"] },
            "desktop:windows": { code: "KeyE", modifiers: ["primary"] },
            "desktop:linux": { code: "KeyE", modifiers: ["primary"] },
            "web:macos": { code: "KeyE", modifiers: ["primary", "alt"] },
            "web:windows": { code: "KeyE", modifiers: ["primary", "alt"] },
            "web:linux": { code: "KeyE", modifiers: ["primary", "alt"] }
          },
          regions: ["page", "editable", "terminal"],
          modals: [],
          resolve: ({ target: element }) => {
            const target = ctx.sidebarRight.commandTarget(element);
            if (target === void 0) return { status: "blocked", reason: bound("shortcut.noSession") };
            return { status: "handled", run: () => ctx.sidebarRight.openTabFromTarget(TAB_KIND, target) };
          }
        }), "code-explorer: open shortcut");
      } catch (error) {
        console.warn("code-explorer: open shortcut not registered", error);
      }
      try {
        shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
          id: "code.quickopen",
          label: () => bound("quickopen.command"),
          aliases: ["quick open", "file picker", "kuai su da kai"],
          defaults: {
            "desktop:macos": { code: "KeyP", modifiers: ["primary", "alt"] },
            "desktop:windows": { code: "KeyP", modifiers: ["primary", "alt"] },
            "desktop:linux": { code: "KeyP", modifiers: ["primary", "alt"] },
            "web:macos": { code: "KeyP", modifiers: ["primary", "alt", "shift"] },
            "web:windows": { code: "KeyP", modifiers: ["primary", "alt", "shift"] },
            "web:linux": { code: "KeyP", modifiers: ["primary", "alt", "shift"] }
          },
          regions: ["page", "editable", "terminal"],
          modals: [],
          resolve: ({ target: element }) => {
            const target = ctx.sidebarRight.commandTarget(element);
            if (target === void 0) return { status: "blocked", reason: bound("shortcut.noSession") };
            return {
              status: "handled",
              run: () => {
                ctx.sidebarRight.openTabFromTarget(TAB_KIND, target);
                setTimeout(() => document.dispatchEvent(new CustomEvent("dsh-ce-quick-open")), 250);
              }
            };
          }
        }), "code-explorer: quick-open shortcut");
      } catch (error) {
        console.warn("code-explorer: quick-open shortcut not registered", error);
      }
      try {
        shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
          id: "code.skills",
          label: () => bound("skillsGuide.title"),
          aliases: ["skills", "skill manager", "jineng"],
          defaults: {
            "desktop:macos": { code: "KeyE", modifiers: ["primary", "shift"] },
            "desktop:windows": { code: "KeyE", modifiers: ["primary", "shift"] },
            "desktop:linux": { code: "KeyE", modifiers: ["primary", "shift"] },
            "web:macos": { code: "KeyE", modifiers: ["primary", "alt", "shift"] },
            "web:windows": { code: "KeyE", modifiers: ["primary", "alt", "shift"] },
            "web:linux": { code: "KeyE", modifiers: ["primary", "alt", "shift"] }
          },
          regions: ["page", "editable", "terminal"],
          modals: [],
          resolve: ({ target: element }) => {
            const target = ctx.sidebarRight.commandTarget(element);
            if (target === void 0) return { status: "blocked", reason: bound("shortcut.noSession") };
            return { status: "handled", run: () => ctx.sidebarRight.openTabFromTarget(SKILLS_TAB_KIND, target) };
          }
        }), "code-explorer: skills shortcut");
      } catch (error) {
        console.warn("code-explorer: skills shortcut not registered", error);
      }
    });
    safe("left tool entries", () => installLeftTools(ctx, bound));
    const Guide = () => h(WorkspaceGuide, { t: bound });
    safe("workspace guide", () => ctx.slots.inject("sidebar.right.tab.guide", () => ctx.slots.register({
      name: "sidebar.right.tab.guide",
      order: -100,
      select: (owner) => owner && typeof owner === "object" ? true : null
    }, Guide)));
  }
};
		return module.exports;
	},
});
