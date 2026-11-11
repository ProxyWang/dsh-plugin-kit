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
var ROW = 22;

// src/client/locale.js
var zh = {
  "type.label": "代码",
  "guide.title": "代码浏览器",
  "guide.description": "工作区代码浏览、当前分支变更、LSP 跳转定义/引用（Go/TS/Python）",
  "toolbar.files": "文件",
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
  "changes.pickRepo": "选择仓库…",
  loading: "加载中…",
  error: "失败",
  "tree.failed": "无法读取目录",
  "tree.empty": "空目录",
  "editor.placeholder": "从左侧文件树选择文件，或在“变更”中查看 diff",
  "editor.noSession": "没有可用会话：代码浏览器需要当前会话的工作目录。",
  "jump.noCursor": "先点击一个标识符（函数/变量/类型），再触发跳转",
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
  "changes.amend": "amend",
  "changes.amendTitle": "修补（amend）上一次提交：用当前信息替换其提交信息",
  "changes.amendCommit": "amend 提交",
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
  "apiGuide.title": "接口调试",
  "apiGuide.description": "curl 一键导入、编辑方法/URL/请求头/Body、发送并查看响应（Postman 基础能力）",
  "api.send": "发送",
  "api.sending": "发送中…",
  "api.import": "导入 curl",
  "api.importBtn": "导入",
  "api.importTitle": "粘贴 curl 命令一键导入",
  "api.headers": "请求头",
  "api.addHeader": "添加请求头",
  "api.params": "Query 参数",
  "api.addParam": "添加参数",
  "api.paramsHint": "发送时合并进 URL，同名覆盖",
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
  "api.restoreTitle": "点击回填到编辑器",
  "api.delete": "删除",
  "api.copyCurl": "复制为 curl",
  "api.copied": "已复制 ✓",
  "api.env": "环境变量",
  "api.envTitle": "发送时替换 URL、请求头与请求体中的双花括号变量；未定义的变量原样保留",
  "api.envEmpty": "暂无变量，点下方 + 添加",
  "api.addEnv": "添加变量",
  "toolrow.edit": "编辑",
  "toolrow.write": "写入",
  "toolrow.failed": "失败",
  "toolrow.running": "运行中…",
  "toolrow.nopath": "（无路径）",
  "toolrow.hint": "点击在右侧查看 diff",
  "toolbar.skills": "技能",
  "skills.title": "技能列表",
  "skills.project": "项目级",
  "skills.user": "用户级",
  "skills.bundled": "内置（只读）",
  "skills.other": "内置 / 插件提供（只读）",
  "skills.readonly": "只读",
  "skills.truncatedNoSave": "文件超过 1MB 已被截断，禁止保存以防丢失内容",
  "skills.truncatedChip": "已截断 · 禁止保存",
  "skills.refresh": "刷新",
  "skills.new": "新建 skill",
  "skills.createPlaceholder": "新 skill 名称（kebab-case）",
  "skills.empty": "没有发现 skill",
  "skills.noDesc": "（无描述）",
  "skills.scopeTitle": "新建到哪个根",
  "skills.copyPath": "点击复制路径",
  "skills.pathCopied": "路径已复制",
  "skills.pick": "选择左侧 skill 查看与编辑",
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
  "editor.closeTab": "关闭标签（中键点击亦可）",
  "editor.dirtyGuard": "有未保存的修改 — 请先保存（⌘S）或取消（Esc）",
  "editor.dirty": "未保存",
  "editor.tooBig": "文件过大，无法编辑",
  "editor.find": "文件内查找",
  "editor.wrap": "自动换行",
  "editor.wrapTooBig": "文件超过 {n} 行，暂不支持自动换行",
  "editor.wrapCapped": "文件过大，换行模式仅渲染前 {n} 行",
  "goto.placeholder": "跳转到行（1-{n}）",
  "goto.title": "跳转到行 (⌘G / Ctrl+G)",
  "editor.findPlaceholder": "查找…",
  "find.case": "区分大小写",
  "find.words": "全词匹配",
  "find.regex": "正则表达式",
  "find.badRegex": "正则无效",
  "editor.preview": "预览",
  "editor.raw": "原始",
  "editor.previewToggle": "预览 / 原始态切换",
  "skillsTab.label": "技能",
  "skillsGuide.title": "技能管理",
  "skillsGuide.description": "浏览、编辑、新建与删除已安装的 agent skills（SKILL.md）",
  "launcher.code": "代码与文件",
  "launcher.run": "终端与网页",
  "launcher.skills": "Agent 扩展",
  "launcher.more": "更多",
  "hover.loading": "…",
  close: "关闭",
  "shortcut.noSession": "请先选择会话",
  "toolbar.search": "查询",
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
  "quickopen.command": "快速打开文件（代码浏览器）"
};
var en = {
  "type.label": "Code",
  "guide.title": "Code Explorer",
  "guide.description": "Workspace browsing, branch changes, LSP definition/reference jumps (Go/TS/Python)",
  "toolbar.files": "Files",
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
  "changes.pickRepo": "Pick repository…",
  loading: "Loading…",
  error: "Failed",
  "tree.failed": "Cannot list directory",
  "tree.empty": "Empty directory",
  "editor.placeholder": "Pick a file in the tree, or open a diff under Changes",
  "editor.noSession": "No session: the code explorer needs the current session workspace.",
  "jump.noCursor": "Click an identifier first, then jump",
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
  "apiGuide.title": "API tester",
  "apiGuide.description": "One-click curl import, edit method/URL/headers/body, send and inspect responses (basic Postman)",
  "api.send": "Send",
  "api.sending": "Sending…",
  "api.import": "Import curl",
  "api.importBtn": "Import",
  "api.importTitle": "Paste a curl command to import",
  "api.headers": "Headers",
  "api.addHeader": "Add header",
  "api.params": "Query Params",
  "api.addParam": "Add param",
  "api.paramsHint": "Merged into the URL at send time; same names override",
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
  "api.restoreTitle": "Click to load into the editor",
  "api.delete": "Delete",
  "api.copyCurl": "Copy as curl",
  "api.copied": "Copied ✓",
  "api.env": "Environment",
  "api.envTitle": "Double-brace variables in URL, headers and body are substituted at send time; unknown names stay literal",
  "api.envEmpty": "No variables yet — add one with +",
  "api.addEnv": "Add variable",
  "toolrow.edit": "Edit",
  "toolrow.write": "Write",
  "toolrow.failed": "failed",
  "toolrow.running": "running…",
  "toolrow.nopath": "(no path)",
  "toolrow.hint": "Click to view diff in side panel",
  "toolbar.skills": "Skills",
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
  "skills.pick": "Pick a skill on the left to view or edit",
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
  "editor.closeTab": "Close tab (middle-click also works)",
  "editor.dirtyGuard": "Unsaved changes — save (⌘S) or cancel (Esc) first",
  "editor.dirty": "unsaved",
  "editor.tooBig": "File too large to edit",
  "editor.find": "Find in file",
  "editor.wrap": "Word wrap",
  "editor.wrapTooBig": "File exceeds {n} lines; word wrap unavailable",
  "editor.wrapCapped": "File too large; wrap mode renders the first {n} lines only",
  "goto.placeholder": "Go to line (1-{n})",
  "goto.title": "Go to line (⌘G / Ctrl+G)",
  "editor.findPlaceholder": "Find…",
  "find.case": "Match case",
  "find.words": "Match whole word",
  "find.regex": "Regular expression",
  "find.badRegex": "Invalid regex",
  "editor.preview": "Preview",
  "editor.raw": "Raw",
  "editor.previewToggle": "Toggle preview / raw",
  "skillsTab.label": "Skills",
  "skillsGuide.title": "Skills manager",
  "skillsGuide.description": "Browse, edit, create and delete installed agent skills (SKILL.md)",
  "launcher.code": "Code & files",
  "launcher.run": "Terminal & web",
  "launcher.skills": "Agent extensions",
  "launcher.more": "More",
  "hover.loading": "…",
  close: "Close",
  "shortcut.noSession": "Select a session first",
  "toolbar.search": "Search",
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
  "quickopen.command": "Quick Open File (Code Explorer)"
};

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
var IconArrowLeft = () => svg([h("path", { key: "p", d: "M20 12H5" }), h("path", { key: "q", d: "M11 6 5 12l6 6" })]);
var IconArrowRight = () => svg([h("path", { key: "p", d: "M4 12h15" }), h("path", { key: "q", d: "M13 6l6 6-6 6" })]);
var IconSearch = () => svg([h("circle", { key: "c", cx: 10.5, cy: 10.5, r: 6.5 }), h("path", { key: "p", d: "M16 16l5 5" })]);
var IconTextSearch = () => svg([h("path", { key: "a", d: "M4 5h16" }), h("path", { key: "b", d: "M4 10h11" }), h("path", { key: "c2", d: "M4 15h8" }), h("path", { key: "d", d: "M18 14.5l2.5 2.5" })]);

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
        { className: "ce-hunk-confirm" },
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
    { className: "ce-palette ce-bp" },
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
function ChangeTree({ items, onOpen, onDiscard, onDiscardDir, onStage, onStageDir, onUnstage, onUnstageDir, keyPrefix, t }) {
  const [collapsed, setCollapsed] = useState(() => /* @__PURE__ */ new Set());
  const [confirmPath, setConfirmPath] = useState(null);
  const [confirmDir, setConfirmDir] = useState(null);
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
        "button",
        {
          key: `d:${keyPrefix}:${id}`,
          type: "button",
          className: "ce-row cet-row cet-dir",
          style: { paddingLeft: `${4 + depth * 14}px`, ...guideStyle(depth) },
          title: `${dir.name}/ · ${dir.count}`,
          "aria-expanded": String(!isCollapsed),
          onClick: () => toggle(id)
        },
        h("span", { className: `cet-tw${isCollapsed ? "" : " cet-tw-open"}` }, "▶"),
        h("span", { className: "cet-fico cet-fico-dir" }, h(FolderGlyph)),
        h("span", { className: "ce-name cet-dirname" }, dir.name),
        h(
          "span",
          { className: "cet-right" },
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
            Fragment,
            null,
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
              setConfirmDir(id);
            }
          }, "⟲") : null,
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
        "button",
        {
          key: `f:${keyPrefix}:${file.path}`,
          type: "button",
          className: "ce-row cet-row",
          style: { paddingLeft: `${4 + depth * 14 + 14}px`, ...guideStyle(depth + 1) },
          title: file.from ? `${file.path} ← ${file.from}` : file.path,
          onClick: () => onOpen(file)
        },
        h("span", { className: `cet-fico ${fileTint(file.path)}` }, h(FileGlyph)),
        h(
          "span",
          { className: "ce-name" },
          base,
          dup ? h("span", { className: "cet-dirhint" }, dirPart) : null
        ),
        h(
          "span",
          { className: "cet-right" },
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
            Fragment,
            null,
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
              setConfirmPath(file.path);
            }
          }, "⟲") : null,
          h("span", { className: `cet-status cet-st-${String(file.ch).toLowerCase()}` }, file.ch)
        )
      ));
    }
  };
  walk(tree, 0, "");
  return h(Fragment, null, rows);
}

// src/client/tree.js
function TreePanel({ cwd, t, onOpenFile, activePath, revealPath, refreshKey, onNotify, onDeleted }) {
  const [listing, setListing] = useState({});
  const [expanded, setExpanded] = useState([]);
  const [action, setAction] = useState(null);
  const [dragPath, setDragPath] = useState(null);
  const [dropDir, setDropDir] = useState(null);
  const railRef = useRef(null);
  const lastRevealed = useRef(null);
  const revealTick = useRef(null);
  const loadDir = useCallback((path) => {
    setListing((current) => current[path]?.entries ? current : { ...current, [path]: { loading: true } });
    api("fs.list", { cwd, path }).then((res) => {
      setListing((current) => {
        if (!res.ok) return current[path]?.entries ? current : { ...current, [path]: { error: res.error } };
        return { ...current, [path]: res.value };
      });
    });
  }, [cwd]);
  useEffect(() => {
    setListing({});
    setExpanded([]);
    setAction(null);
    loadDir("");
  }, [cwd, refreshKey, loadDir]);
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
  const runDelete = (path) => {
    api("fs.delete", { cwd, path }).then((res) => {
      if (!res.ok || res.value?.error) {
        onNotify?.(`${t("error")}: ${res.value?.error ?? res.error}`, "error");
        setAction(null);
        return;
      }
      onNotify?.(t("tree.deleted"));
      onDeleted?.(path);
      loadDir(parentOf(path));
      setAction(null);
    });
  };
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
  const dragProps = (path) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragPath(path);
      try {
        e.dataTransfer.setData("text/plain", path);
        e.dataTransfer.effectAllowed = "move";
      } catch {
      }
    },
    onDragEnd: () => {
      setDragPath(null);
      setDropDir(null);
    }
  });
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
    const ok = () => onNotify?.(t("tree.copied"));
    const bad = () => onNotify?.(`${t("error")}: clipboard`, "error");
    try {
      const p = navigator.clipboard?.writeText(text);
      if (p && typeof p.then === "function") p.then(ok, bad);
      else ok();
    } catch {
      bad();
    }
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
    isDir ? h("button", {
      type: "button",
      className: "cet-act",
      title: t("tree.newFile"),
      onClick: (e) => {
        e.stopPropagation();
        if (!expanded.includes(path)) setExpanded([...expanded, path]);
        if (listing[path] === void 0) loadDir(path);
        setAction({ kind: "newfile", path, value: "" });
      }
    }, "+") : null,
    h("button", {
      type: "button",
      className: "cet-act",
      title: t("tree.copyPath"),
      onClick: (e) => {
        e.stopPropagation();
        copyPath(path, e);
      }
    }, "📋"),
    h("button", {
      type: "button",
      className: "cet-act",
      title: t("tree.rename"),
      onClick: (e) => {
        e.stopPropagation();
        setAction({ kind: "rename", path, value: path.split("/").pop() });
      }
    }, "✎"),
    action?.kind === "delete" && action.path === path ? h(
      Fragment,
      null,
      h("button", {
        type: "button",
        className: "cet-act cet-act-show cet-act-danger",
        onClick: (e) => {
          e.stopPropagation();
          runDelete(path);
        }
      }, t("changes.confirm")),
      h("button", {
        type: "button",
        className: "cet-act cet-act-show",
        onClick: (e) => {
          e.stopPropagation();
          setAction(null);
        }
      }, t("changes.cancel"))
    ) : h("button", {
      type: "button",
      className: "cet-act",
      title: t("tree.delete"),
      onClick: (e) => {
        e.stopPropagation();
        setAction({ kind: "delete", path });
      }
    }, "✕")
  );
  const renderLevel = (path, depth) => {
    const state = listing[path];
    if (!state) return null;
    if (state.loading) return h("div", { key: `${path}-l`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, t("loading"));
    if (state.error) return h("div", { key: `${path}-l`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, `${t("tree.failed")}: ${state.error}`);
    const entries = [...state.entries ?? []].sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
    const rows = [];
    for (const entry of entries) {
      const childPath = path === "" ? entry.name : `${path}/${entry.name}`;
      if (entry.type === "directory") {
        const open = expanded.includes(childPath);
        rows.push(
          h(
            "button",
            {
              key: childPath,
              "data-tp": childPath,
              className: `ce-row${dropDir === childPath ? " ce-row-drop" : ""}`,
              style: { paddingLeft: 6 + depth * 14 },
              onClick: () => toggle(childPath),
              type: "button",
              ...dragProps(childPath),
              ...dropProps(childPath)
            },
            h("span", { className: "ce-ico" }, h(IconFolder, { open })),
            h("span", { className: "ce-name" }, entry.name),
            acts(childPath, true)
          )
        );
        if (action?.kind === "rename" && action.path === childPath) rows.push(inputRow(childPath, "rename", t("tree.renamePlaceholder")));
        if (open && action?.kind === "newfile" && action.path === childPath) rows.push(inputRow(childPath, "file", t("tree.newFilePlaceholder")));
        if (open && action?.kind === "newdir" && action.path === childPath) rows.push(inputRow(childPath, "dir", t("tree.newDirPlaceholder")));
        if (open) rows.push(renderLevel(childPath, depth + 1));
      } else if (entry.type === "file") {
        rows.push(
          h(
            "button",
            {
              key: childPath,
              "data-tp": childPath,
              className: `ce-row${activePath && (activePath === childPath || activePath.endsWith(`/${childPath}`)) ? " ce-active" : ""}`,
              style: { paddingLeft: 6 + depth * 14 },
              type: "button",
              onClick: () => onOpenFile(childPath, 1, 1),
              ...dragProps(childPath),
              ...fileDropProps(childPath)
            },
            h("span", { className: `cet-fico ce-tree-ico ${fileTint(childPath)}` }, h(FileGlyph)),
            h("span", { className: "ce-name" }, entry.name),
            acts(childPath, false)
          )
        );
        if (action?.kind === "rename" && action.path === childPath) rows.push(inputRow(path, "rename", t("tree.renamePlaceholder")));
      }
    }
    if (!rows.length) rows.push(h("div", { key: `${path}-e`, className: "ce-note", style: { paddingLeft: 8 + depth * 14 } }, t("tree.empty")));
    return h(Fragment, { key: path }, rows);
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
      h("button", { type: "button", className: "cet-act cet-act-show", title: t("tree.newFileRoot"), onClick: () => setAction({ kind: "newfile", path: "", value: "" }) }, `+ ${t("tree.fileWord")}`),
      h("button", { type: "button", className: "cet-act cet-act-show", title: t("tree.newDirRoot"), onClick: () => setAction({ kind: "newdir", path: "", value: "" }) }, `+ ${t("tree.dirWord")}`)
    ),
    action !== null && (action.kind === "newfile" || action.kind === "newdir") && action.path === "" ? inputRow("", action.kind === "newdir" ? "dir" : "file", action.kind === "newdir" ? t("tree.newDirPlaceholder") : t("tree.newFilePlaceholder")) : null,
    renderLevel("", 0)
  );
}

// src/client/changes.js
function isStagedXy(xy) {
  return typeof xy === "string" && xy.length > 0 && xy[0] !== " " && xy[0] !== "?";
}
function ChangesPanel({ cwd, t, git, repos, repoSel, onSelectRepo, commitsOpen, setCommitsOpen, onOpenCommit, onOpenDiff, onDiscard, onDiscardDir, onStage, onStageDir, onUnstage, onUnstageDir, onCommit, committing, onNotify, refresh }) {
  const [treeView, setTreeView] = useState(true);
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [stashes, setStashes] = useState([]);
  const [stashOpen, setStashOpen] = useState(false);
  const [stashSaving, setStashSaving] = useState(false);
  const [stashMsg, setStashMsg] = useState("");
  const [stashUntracked, setStashUntracked] = useState(false);
  const [stashBusy, setStashBusy] = useState(false);
  const [stashConfirm, setStashConfirm] = useState(null);
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
  const badge = (xy) => xy === "??" ? "U" : xy.trim()[0] === "A" || xy.trim()[0] === "?" ? "A" : xy.trim()[0] || "M";
  const staged = git.working.filter((f) => isStagedXy(f.xy));
  const unstaged = git.working.filter((f) => !isStagedXy(f.xy));
  const flatRows = (files, prefix, scope) => files.map(
    (file) => h(
      "button",
      { key: `${prefix}:${file.path}`, className: "ce-row", type: "button", title: file.path, onClick: () => onOpenDiff(file.path, scope) },
      h("span", { className: `ce-badge ce-badge-${badge(file.xy).toLowerCase()}` }, badge(file.xy)),
      h("span", { className: "ce-name" }, file.path)
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
    h("div", { className: "ce-note" }, git.upstream ? `${t("changes.vs")} ${git.upstream} · ↑${git.ahead ?? 0} ↓${git.behind ?? 0}${git.upstreamInferred ? " · auto" : ""}` : t("sync.noUpstream")),
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
          h("span", null, `${t("changes.staged")} · ${staged.length}`),
          h("button", { className: "ce-link", type: "button", title: t("changes.unstageAll"), onClick: () => onUnstageDir && onUnstageDir("") }, t("changes.unstageAll"))
        ),
        treeView ? h(ChangeTree, {
          items: staged.map((f) => ({ path: f.path, ch: badge(f.xy), from: f.from ?? void 0 })),
          onOpen: (item) => onOpenDiff(item.path, "staged"),
          onUnstage: (item) => onUnstage && onUnstage(item),
          onUnstageDir: (dirPath) => onUnstageDir && onUnstageDir(dirPath),
          keyPrefix: "s",
          t
        }) : flatRows(staged, "s", "staged")
      ) : null,
      h(
        "div",
        { className: "ce-section" },
        h("span", null, `${t("changes.working")} · ${unstaged.length}`),
        unstaged.length > 0 ? h("button", { className: "ce-link", type: "button", title: t("changes.stageAll"), onClick: () => onStageDir && onStageDir("") }, t("changes.stageAll")) : null,
        h("button", { className: "ce-link", type: "button", title: treeView ? t("changes.toList") : t("changes.toTree"), onClick: () => setTreeView((v) => !v) }, treeView ? t("changes.toList") : t("changes.toTree")),
        h("button", { className: "ce-tool ce-tiny", type: "button", title: t("refresh"), onClick: refresh }, h(IconRefresh))
      ),
      git.working.length === 0 && h("div", { className: "ce-note" }, t("changes.none")),
      treeView ? h(ChangeTree, {
        items: unstaged.map((f) => ({ path: f.path, ch: badge(f.xy), from: f.from ?? void 0 })),
        onOpen: (item) => onOpenDiff(item.path, "working"),
        onDiscard: (item) => onDiscard && onDiscard(item),
        onDiscardDir: (dirItems) => onDiscardDir && onDiscardDir(dirItems),
        onStage: (item) => onStage && onStage(item),
        onStageDir: (dirPath) => onStageDir && onStageDir(dirPath),
        keyPrefix: "w",
        t
      }) : flatRows(unstaged, "w", "working")
    ),
    h(
      "section",
      { className: "ce-change-group" },
      h("div", { className: "ce-section" }, t("changes.branch")),
      git.base ? h(
        Fragment,
        null,
        h(
          "div",
          { className: "ce-note ce-note-line" },
          h("span", null, `${git.branch} ${t("changes.vs")} ${git.base.name} · ${git.branchFiles.length} files`),
          h(
            "button",
            { type: "button", className: "ce-link", title: t("changes.commitsToggle"), "aria-expanded": commitsOpen ? "true" : "false", onClick: () => setCommitsOpen((v) => !v) },
            `${git.commits.length} ${t("changes.commits")} ${commitsOpen ? "▾" : "▸"}`
          )
        ),
        commitsOpen ? git.commits.slice(0, 80).map((commit) => h(
          "button",
          { key: `c:${commit.hash}`, className: "ce-commit", type: "button", onClick: () => onOpenCommit(commit) },
          h("span", { className: "ce-chash" }, commit.hash),
          h("span", { className: "ce-csubject" }, commit.subject)
        )) : null,
        treeView ? h(ChangeTree, {
          items: git.branchFiles.map((p) => ({ path: p, ch: "C" })),
          onOpen: (item) => onOpenDiff(item.path, "branch"),
          keyPrefix: "b",
          t
        }) : git.branchFiles.map(
          (path) => h(
            "button",
            { key: `b:${path}`, className: "ce-row", type: "button", title: path, onClick: () => onOpenDiff(path, "branch") },
            h("span", { className: "ce-badge ce-badge-c" }, "C"),
            h("span", { className: "ce-name" }, path)
          )
        )
      ) : h("div", { className: "ce-note" }, t("changes.baseNone"))
    ),
    h(
      "section",
      { className: "ce-change-group" },
      h(
        "div",
        { className: "ce-section" },
        h("span", null, `${t("stash.title")}${stashes.length ? ` · ${stashes.length}` : ""}`),
        h("button", { className: "ce-link", type: "button", title: t("stash.saveTitle"), disabled: stashBusy, onClick: () => {
          setStashSaving((v) => !v);
          setStashOpen(true);
        } }, `+ ${t("stash.save")}`),
        h("button", { className: "ce-tool ce-tiny", type: "button", title: t("stash.toggle"), "aria-expanded": stashOpen ? "true" : "false", onClick: () => setStashOpen((v) => !v) }, stashOpen ? "▾" : "▸")
      ),
      stashSaving ? h(
        "div",
        { className: "ce-stash-save" },
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
            Fragment,
            null,
            h("button", { type: "button", className: "cet-act cet-act-show cet-act-danger", disabled: stashBusy, onClick: () => stashDrop(s.ref) }, t("stash.confirm")),
            h("button", { type: "button", className: "cet-act cet-act-show", onClick: () => setStashConfirm(null) }, t("stash.cancel"))
          ) : h(
            Fragment,
            null,
            h("button", { type: "button", className: "ce-link", disabled: stashBusy, title: t("stash.applyTitle"), onClick: () => stashApply(s.ref, false) }, t("stash.apply")),
            h("button", { type: "button", className: "ce-link", disabled: stashBusy, title: t("stash.popTitle"), onClick: () => stashApply(s.ref, true) }, t("stash.pop")),
            h("button", { type: "button", className: "ce-tool ce-tiny", title: t("stash.drop"), disabled: stashBusy, onClick: () => setStashConfirm(s.ref) }, "✕")
          )
        )
      )) : null
    )
  );
}

// src/client/overlays.js
function LocationList({ t, overlay, cwd, onPick, onClose }) {
  return h(
    "div",
    { className: "ce-overlay" },
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
function QuickOpen({ t, state, onQuery, onPick, onClose }) {
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
    { className: "ce-palette", onKeyDown },
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
        onKeyDown,
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
function RefsPeek({ t, cwd, peek, scroll, totalLines, onPick, onClose }) {
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
  const top = Math.max(6, Math.min(peek.anchorLine * ROW + 6 - scroll, totalLines * ROW));
  let ri = 0;
  return h(
    "div",
    { className: "ce-peek", style: { top }, onKeyDown, onMouseDown: (event) => event.stopPropagation() },
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
            h("span", { className: "ce-peek-lno" }, `${r.line}:${r.col}`),
            h("span", { className: "ce-peek-snippet" }, r.snippet ?? "")
          );
        });
        return h(
          Fragment,
          { key: `${g.path}-${gi}` },
          h("div", { className: "ce-peek-file" }, h("span", { className: "ce-peek-fpath" }, RelPath(cwd, g.path) || g.path)),
          fileRows
        );
      })
    )
  );
}
var SYMBOL_GLYPHS = { 2: "▣", 3: "ƒ", 4: "Ω", 5: "◆", 6: "ƒ", 7: "◆", 8: "◈", 9: "#", 10: "◈", 11: "▣", 12: "✓", 13: "▣", 14: "🛡", 15: "ω", 16: "◆", 17: "◆", 18: "≡", 19: "◦", 20: "◦", 21: "≡", 22: "◆", 23: "◆", 24: "▣", 25: "•", 26: "•" };
function SymbolPalette({ t, symbols, onPick, onClose }) {
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
    { className: "ce-palette", onKeyDown, onMouseDown: (event) => event.stopPropagation() },
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
        onKeyDown,
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
function GotoLinePalette({ t, totalLines, initial, onGo, onClose }) {
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
    { className: "ce-palette ce-goto", onMouseDown: (event) => event.stopPropagation() },
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
        onKeyDown,
        spellcheck: false,
        autoComplete: "off"
      }),
      h("button", { className: "ce-tool ce-tiny", type: "button", title: `${t("close")} (Esc)`, onClick: onClose }, "✕")
    )
  );
}
function FileHistoryOverlay({ t, hist, onPick, onClose }) {
  return h(
    "div",
    { className: "ce-overlay", onMouseDown: (event) => event.stopPropagation() },
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
function SearchPanel({ t, cwd, state, onQuery, onInclude, onToggleRegex, onToggleWords, onSubmit, onPick, onClose, onNotify }) {
  const inputRef = useRef(null);
  const [expanded, setExpanded] = useState(() => /* @__PURE__ */ new Set());
  const [ctxCache, setCtxCache] = useState({});
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceText, setReplaceText] = useState("");
  const [replaceBusy, setReplaceBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
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
  const runReplace = async (paths) => {
    if (replaceBusy || paths.length === 0) return;
    setReplaceBusy(true);
    let files = 0;
    let hits = 0;
    const errors = [];
    const capped = paths.slice(0, 200);
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
    if (paths.length > capped.length) onNotify?.(t("search.replaceCapped"), "error");
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
      { className: "ce-search-box" },
      h("button", { className: `ce-tool ce-tiny${replaceOpen ? " ce-tool-on" : ""}`, type: "button", title: t("search.replaceToggle"), onClick: () => setReplaceOpen((v) => !v) }, replaceOpen ? "▾" : "▸"),
      h("input", {
        ref: inputRef,
        className: "ce-input ce-search-q",
        type: "text",
        placeholder: t("search.placeholder"),
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
function buildTokenCells(text, lang, state, lineNo, flash) {
  const runs = tokenizeLine(text, lang, state);
  const jumpable = lang === "go" || lang === "js" || lang === "py";
  return runs.map((run, r) => {
    const marked = flash && flash.col != null && run.startCol === flash.col && flash.word && run.s === flash.word;
    return run.cls === "ce-id" || run.cls === "ce-type" || run.cls === "ce-kw" ? h(
      "span",
      {
        key: r,
        className: `ce-t ${run.cls}${jumpable ? " ce-jump" : ""}${marked ? " ce-mark" : ""}`,
        ...jumpable ? { "data-ce-l": lineNo, "data-ce-c": run.startCol ?? 1, "data-ce-w": run.word ?? "" } : {}
      },
      run.s
    ) : h("span", { key: r, className: `ce-t ${run.cls}${marked ? " ce-mark" : ""}` }, run.s);
  });
}
function computeVisible({ doc, scroll, viewport, diagByLine, flash, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit, onDelPreview }) {
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
    const cells = buildTokenCells(doc.lines[i], lang, doc.states[i], i + 1, lineFlash);
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
function computeGutter({ doc, scroll, viewport, cursor, findLines, diffMarks, delAnchors }) {
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
        { key: i, className: `ce-gline${cursor?.line === i + 1 ? " ce-gline-active" : ""}${findLines.has(i + 1) ? " ce-gline-find" : ""}${diffMarks !== null && diffMarks.has(i + 1) ? " ce-gline-changed" : ""}`, style: { transform: `translateY(${yOf(i)}px)` } },
        String(i + 1)
      )
    );
  }
  return rows;
}
var WRAP_LINE_CAP = 5e3;
function computeWrapRows({ doc, flash, diffMarks, delAnchors, delGroups, cursor, findLines, t, onDelPreview }) {
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
    const cells = buildTokenCells(doc.lines[i], lang, doc.states[i], lineNo, lineFlash);
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
    for (const item of dirItems) {
      const res = await api("git.discard", repo ? { cwd, path: item.path, repo, ch: item.ch } : { cwd, path: item.path, ch: item.ch });
      if (res.ok && !res.value?.error) okCount += 1;
      else errors.push(`${item.path}: ${res.value?.error ?? res.error}`);
    }
    if (okCount > 0) say(t("changes.discardedN", { n: okCount }));
    if (errors.length > 0) say(`${t("error")}: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1})` : ""}`, "error");
    refreshGit();
    const openPath = docRef.current?.path;
    if (openPath && dirItems.some((i) => i.path === openPath)) void loadFile(openPath, cursorRef.current?.line ?? 1, cursorRef.current?.col ?? 1);
  }, [cwd, say, t, refreshGit, loadFile]);
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
  }, [persistKey, doc, cursor, scroll, mode, railW, railVisible, wrapOn, findOpts, tabs, histTick]);
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
  const { useTabInfo, sessionId, useSessions, t } = props;
  const tabInfo = useTabInfo ? useTabInfo() : null;
  const tab = tabInfo?.tab;
  const cwd = useSessions ? useSessions((sessions) => sessionId ? sessions.byId[sessionId]?.cwd : void 0) : void 0;
  const [mode, setMode] = useState("files");
  const [doc, setDoc] = useState(null);
  const [diff, setDiff] = useState(null);
  const [git, setGit] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);
  const [overlay, setOverlay] = useState(null);
  const [hover, setHover] = useState(null);
  const [status, setStatus] = useState({ state: "off", message: "", progress: "" });
  const [notice, setNotice] = useState({ text: "", kind: "info" });
  const [treeKey, setTreeKey] = useState(0);
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
  const [showDiffView, setShowDiffView] = useState(true);
  const [railW, setRailW] = useState(230);
  const [railVisible, setRailVisible] = useState(true);
  const [symbols, setSymbols] = useState([]);
  const [symPalette, setSymPalette] = useState(null);
  const [commitsOpen, setCommitsOpen] = useState(false);
  const peekNonce = useRef(0);
  const paletteTimer = useRef(null);
  const searchTimer = useRef(null);
  const searchNonce = useRef(0);
  const symbolNonce = useRef(0);
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
  docRef.current = doc;
  cursorRef.current = cursor;
  peekRef.current = peek;
  wrapOnRef.current = wrapOn;
  const say = useCallback((text, kind = "info") => {
    setNotice({ text, kind });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (kind !== "error") noticeTimer.current = setTimeout(() => setNotice({ text: "", kind: "info" }), 3800);
  }, []);
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
  const loadFile = useCallback(
    async (path, line, col, mark, opts) => {
      if (!cwd) return null;
      const res = await api("fs.read", { cwd, path });
      if (!res.ok) {
        say(`${t("error")}: ${res.error}`, "error");
        return null;
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
      setDoc(entry);
      modeRef.current = "code";
      setDiff(null);
      const clampLine = Math.min(Math.max(1, line), Math.max(1, lines2.length));
      setCursor({ line: clampLine, col, word: wordAt(lines2[clampLine - 1] ?? "", col)?.word ?? "" });
      setDiagnostics([]);
      setOverlay(null);
      setHover(null);
      setSymbols([]);
      setScroll(0);
      if (codeRef.current) codeRef.current.scrollTop = 0;
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
      if (!opts?.noAutoMarks) {
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
      requestAnimationFrame(() => {
        scrollAreaToLine(Math.max(1, markLine));
        setFlash({ line: markLine, col: mark?.col, word: mark?.word });
        setTimeout(() => setFlash((f) => f && f.line === markLine ? null : f), 1800);
      });
      return entry;
    },
    [cwd, fetchDiagnostics, say, t, scrollAreaToLine]
  );
  const openFile = useCallback(
    async (path, line, col, record = true, mark) => {
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
    [loadFile]
  );
  const { sync, committing, doFetch, doPull, doPush, discardChange, discardMany, stageChange, unstageChange, commitChanges } = useGitActions({
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
  }, [openFile]);
  const goForward = useCallback(() => {
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
  }, [openFile]);
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
      if (diff && showDiffView && (diff.scope === "working" || diff.scope === "branch" || diff.scope === "staged")) setShowDiffView(false);
      return;
    }
    if (editing && editText !== (docRef.current?.raw ?? "")) {
      say(t("editor.dirtyGuard"), "error");
      return;
    }
    const saved = tabViewRef.current[path];
    void openFile(path, saved?.line ?? 1, saved?.col ?? 1, false);
  }, [editing, editText, openFile, say, t, diff, showDiffView]);
  const closeTab = useCallback((path) => {
    const current = docRef.current;
    if (editing && current?.path === path && editText !== (current?.raw ?? "")) {
      say(t("editor.dirtyGuard"), "error");
      return;
    }
    const idx = tabs.indexOf(path);
    if (idx < 0) return;
    const next = tabs.filter((p) => p !== path);
    setTabs(next);
    delete tabViewRef.current[path];
    if (current?.path === path) {
      const neighbor = next[Math.min(idx, next.length - 1)];
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
  }, [tabs, editing, editText, openFile, say, t]);
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
    setMode,
    setHistTick,
    setScroll
  });
  const revealPosition = useCallback((line, col, word) => {
    const current = docRef.current;
    if (!current) return;
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
  }, [scrollAreaToLine]);
  const openDiff = useCallback(
    async (path, scope) => {
      if (!cwd) return;
      const repo = repoSelRef.current;
      const res = await api("git.diff", repo ? { cwd, path, scope, repo } : { cwd, path, scope });
      const value = res.ok ? res.value : { error: res.error };
      modeRef.current = "diff";
      setShowDiffView(true);
      setDiff({ path, scope, text: value.diff ?? "", error: value.error, base: value.base, untracked: value.untracked, note: value.note });
      setOverlay(null);
      setHover(null);
    },
    [cwd]
  );
  const openChangeSource = useCallback(async (path, scope) => {
    if (!cwd) return;
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
    await loadFile(path, first, 1, null, { noAutoMarks: true });
    setDiffMarks(marks);
    setDelGroups(deletedGroups(text));
  }, [cwd, loadFile]);
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
      if (!cwd) return;
      const repo = repoSelRef.current;
      const res = await api("git.diff", repo ? { cwd, scope: "commit", sha: commit.hash, repo } : { cwd, scope: "commit", sha: commit.hash });
      const value = res.ok ? res.value : { error: res.error };
      if (value.error) {
        say(`${t("error")}: ${value.error}`, "error");
        return;
      }
      modeRef.current = "diff";
      setDiff({ path: `${t("diff.scopeCommit")} ${commit.hash}`, scope: "commit", commit: value.commit, text: value.diff ?? "" });
      setShowDiffView(true);
      setOverlay(null);
      setHover(null);
      setPeek(null);
    },
    [cwd, say, t]
  );
  const openFileHistory = useCallback(() => {
    const d = docRef.current;
    if (!cwd || !d) return;
    const path = d.path;
    setFileHist({ path, busy: true });
    const repo = repoSelRef.current;
    api("git.history", repo ? { cwd, path, repo } : { cwd, path }).then((res) => {
      setFileHist((cur) => {
        if (!cur || cur.path !== path) return cur;
        if (!res.ok) return { path, error: res.error };
        if (res.value?.error) return { path, error: res.value.error };
        return { path, commits: res.value?.commits ?? [] };
      });
    });
  }, [cwd]);
  const openHistCommit = useCallback(
    async (commit) => {
      const path = fileHist?.path;
      if (!cwd || !path || !commit?.hash) return;
      const repo = repoSelRef.current;
      const res = await api("git.diff", repo ? { cwd, path, scope: "commit", sha: commit.hash, repo } : { cwd, path, scope: "commit", sha: commit.hash });
      const value = res.ok ? res.value ?? {} : { error: res.error };
      if (value.error) {
        say(`${t("error")}: ${value.error}`, "error");
        return;
      }
      setFileHist(null);
      modeRef.current = "diff";
      setDiff({ path: `${commit.hash} · ${path}`, scope: "commit", commit: value.commit, text: value.diff ?? "" });
      setShowDiffView(true);
      setOverlay(null);
      setHover(null);
      setPeek(null);
    },
    [cwd, fileHist, say, t]
  );
  const openPalette = useCallback(() => {
    if (!cwd) return;
    setPalette({ query: "", results: [], busy: true });
    api("search.files", { cwd, query: "", limit: 80 }).then((res) => {
      setPalette((p) => p && p.query === "" ? { ...p, results: res.ok ? res.value.matches ?? [] : [], busy: false } : p);
    });
  }, [cwd]);
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
      api("search.text", { cwd, query, include: include || "", regex: opts?.regex === true, words: opts?.words === true }).then((res) => {
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
  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setSearch((s) => s ?? { query: "", include: "", regex: false, words: false, results: void 0, engine: "", truncated: false, busy: false });
  }, []);
  useEffect(() => {
    if (!searchOpen || !search) return void 0;
    const query = (search.query ?? "").trim();
    if (query.length < 2) {
      if (search.results !== void 0 && !search.busy) return void 0;
      setSearch((s) => s ? { ...s, results: [], engine: "", busy: false, error: void 0 } : s);
      return void 0;
    }
    const timer = setTimeout(() => runSearchNow(search.query, search.include, search), 400);
    return () => clearTimeout(timer);
  }, [searchOpen, search, runSearchNow]);
  const onSearchPick = useCallback(
    (r) => {
      void openFile(r.path, r.line, 1);
      setSearchOpen(false);
    },
    [openFile]
  );
  const openPeek = useCallback(
    async (symbol, line, col) => {
      if (!cwd || !LSP_RE.test(docRef.current?.path ?? "")) return;
      const path = docRef.current.path;
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
      setPeek({
        symbol,
        anchorLine: line,
        busy: false,
        def: dres.ok ? dres.value.targets ?? [] : [],
        refs: rres.ok ? rres.value.targets ?? [] : [],
        error: !dres.ok ? dres.error : !rres.ok ? rres.error : void 0
      });
    },
    [cwd]
  );
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
  const startEdit = useCallback(() => {
    if (!doc || doc.truncated || doc.image) return;
    if (doc.raw.length > 2 * 1024 * 1024 || doc.lines.length > 5e4) {
      say(t("editor.tooBig"), "error");
      return;
    }
    setEditText(doc.raw);
    setEditing(true);
  }, [doc, say, t]);
  const saveEdit = useCallback(() => {
    if (!doc || !editing) return;
    const payload = { cwd, path: doc.path, content: editText };
    if (typeof doc.mtimeMs === "number") payload.baseMtime = doc.mtimeMs;
    api("fs.write", payload).then((res) => {
      if (!res.ok) {
        say(/modified on disk/i.test(res.error ?? "") ? t("editor.conflict") : `${t("error")}: ${res.error}`, "error");
        return;
      }
      const lines2 = editText.split("\n");
      if (lines2.length > 1 && lines2[lines2.length - 1] === "") lines2.pop();
      setDoc({ ...doc, lines: lines2, states: buildLineStates(lines2, langFor(doc.path)), raw: editText, mtimeMs: res.value.mtimeMs ?? doc.mtimeMs });
      setEditing(false);
      say(t("editor.saved"));
    });
  }, [doc, editing, editText, cwd, say, t]);
  const cancelEdit = useCallback(() => setEditing(false), []);
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
  const onRootKeyDown = useCallback(
    (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === "KeyF" && !event.shiftKey) {
        if (modeRef.current === "code" && docRef.current && !editing) {
          event.preventDefault();
          setFindOpen((v) => !v);
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
          setSymPalette({});
        }
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
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.code === "KeyG") {
        if (modeRef.current === "code" && docRef.current && !editing) {
          event.preventDefault();
          setGotoOpen((v) => !v);
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
    [palette, closePalette, openPalette, openSearch, searchOpen, peek, closePeek, goBack, goForward, symPalette, editing, saveEdit, cancelEdit, findOpen, delPreview, gotoOpen, toggleWrap, fileHist]
  );
  const doJump = useCallback(
    async (kind, pos) => {
      if (!cwd || !docRef.current || !LSP_RE.test(docRef.current.path)) return;
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
        if (event.shiftKey) {
          const cur = cursorRef.current;
          if (cur) void openPeek(cur.word || "", cur.line, cur.col);
          else say(t("jump.noCursor"));
        } else {
          void doJump("definition");
        }
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
    [doJump, openPeek, say, t, goBack, goForward, hover, overlay]
  );
  const onEditorClick = useCallback(
    (event) => {
      const target = event.target?.closest?.("[data-ce-l]");
      setHover(null);
      if (!target || !docRef.current) return;
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
      else void openPeek(word, at.line, at.col);
    },
    [doJump, openPeek]
  );
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
    () => wrapOn ? null : computeVisible({ doc, scroll, viewport, diagByLine, flash, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit, onDelPreview: setDelPreview }),
    [wrapOn, doc, scroll, viewport, diagByLine, flash, diffMarks, delAnchors, delGroups, t, blameOn, blame, openCommit]
  );
  const gutter = useMemo(
    () => wrapOn ? null : computeGutter({ doc, scroll, viewport, cursor, findLines, diffMarks, delAnchors }),
    [wrapOn, doc, scroll, viewport, cursor, findLines, diffMarks, delAnchors]
  );
  const wrapDoc = useMemo(
    () => wrapOn ? computeWrapRows({ doc, flash, diffMarks, delAnchors, delGroups, cursor, findLines, t, onDelPreview: setDelPreview }) : null,
    [wrapOn, doc, flash, diffMarks, delAnchors, delGroups, cursor, findLines, t]
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
      if (!detail || typeof detail.text !== "string") return;
      setPeek(null);
      setOverlay(null);
      setHover(null);
      modeRef.current = "diff";
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
  }, []);
  if (!cwd) {
    return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
  }
  return h(
    "div",
    { className: "ce-root", onKeyDown: onRootKeyDown },
    h(
      "div",
      { className: "ce-toolbar" },
      h(
        "div",
        { className: "ce-seg" },
        h("button", { type: "button", className: `ce-seg-btn${mode === "files" ? " ce-seg-on" : ""}`, onClick: () => setMode("files") }, t("toolbar.files")),
        h("button", { type: "button", className: `ce-seg-btn${mode === "changes" ? " ce-seg-on" : ""}`, onClick: () => {
          setMode("changes");
          refreshGit();
        } }, `${t("toolbar.changes")}${git?.repo ? ` · ${git.working.length}` : ""}`)
      ),
      git?.repo ? h(
        "button",
        {
          type: "button",
          className: "ce-branch",
          disabled: sync.busy,
          title: `${t("branch.title")}${git.upstream ? ` · ${git.upstream}${git.upstreamInferred ? " · auto" : ""}` : ""}`,
          onClick: () => setBranchPickOpen(true)
        },
        h("span", null, `⎇ ${git.branch}`),
        sync.busy ? h("span", { className: "ce-spin ce-ico" }, h(IconRefresh)) : null,
        !sync.busy && git.ahead > 0 ? h("span", { className: "ce-ab ce-ab-ahead" }, `↑${git.ahead}`) : null,
        !sync.busy && git.behind > 0 ? h("span", { className: "ce-ab ce-ab-behind" }, `↓${git.behind}`) : null
      ) : null,
      h("span", { className: "ce-spacer" }),
      h("button", { type: "button", className: "ce-tool", title: `${t("quickopen.placeholder")} (⌘P / Ctrl+P)`, onClick: openPalette }, h(IconSearch)),
      h("button", { type: "button", className: "ce-tool", title: `${t("toolbar.search")} (⇧⌘F / Ctrl+Shift+F)`, onClick: openSearch }, h(IconTextSearch)),
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
    h(
      "div",
      { className: "ce-main", ref: mainRef },
      railVisible ? h("div", { className: "ce-rail-wrap", style: { width: `${railW}px` } }, mode === "files" ? h(TreePanel, {
        cwd,
        t,
        onOpenFile: (path, line, col) => void openFile(path, line, col),
        activePath: doc?.path ?? diff?.path,
        revealPath: doc?.path ?? null,
        refreshKey: treeKey,
        onNotify: (text, kind) => say(text, kind),
        onDeleted: (path) => {
          setTabs((prev) => prev.filter((p) => p !== path && !p.startsWith(`${path}/`)));
          const open = docRef.current?.path;
          if (open && (open === path || open.startsWith(`${path}/`))) {
            setDoc(null);
            setEditing(false);
            setDiffMarks(null);
          }
        }
      }) : h(ChangesPanel, {
        cwd,
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
        onOpenDiff: (path, scope) => void (scope === "commit" ? openDiff(path, scope) : openChangeSource(path, scope)),
        onDiscard: (item) => void discardChange(item),
        onDiscardDir: (dirItems) => void discardMany(dirItems),
        onStage: (item) => void stageChange(item.path),
        onStageDir: (dirPath) => void stageChange(dirPath),
        onUnstage: (item) => void unstageChange(item.path),
        onUnstageDir: (dirPath) => void unstageChange(dirPath),
        onCommit: (msg, stageAll, amend) => commitChanges(msg, stageAll, amend),
        committing,
        onNotify: (text, kind) => say(text, kind),
        refresh: refreshGit
      })) : null,
      railVisible ? h("div", { className: "ce-splitter", onMouseDown: startRailDrag, onDoubleClick: () => setRailVisible(false), title: "⇔ 拖动调宽 · 双击收起" }) : h("button", { type: "button", className: "ce-rail-tab", title: "展开侧栏 (⌘B / Ctrl+B)", onClick: () => setRailVisible(true) }, "▸"),
      h(
        "div",
        { className: "ce-editor" },
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
                className: `ce-tab${active ? " ce-tab-active" : ""}`,
                title: RelPath(cwd, p) || p,
                onClick: () => switchTab(p),
                onAuxClick: (e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(p);
                  }
                }
              },
              h("span", { className: `ce-tab-dot${dirty ? " ce-tab-dirty" : ""}` }, dirty ? "●" : ""),
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
            editing ? h("button", { type: "button", className: "ce-link", onClick: saveEdit }, t("editor.save")) : null,
            editing ? h("button", { type: "button", className: "ce-link", onClick: cancelEdit }, t("editor.cancel")) : null,
            editing && editText !== (doc?.raw ?? "") ? h("span", { className: "ce-chip ce-chip-warn" }, t("editor.dirty")) : null,
            doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${findOpen ? " ce-tool-on" : ""}`, title: `${t("editor.find")} (⌘F / Ctrl+F)`, onClick: () => setFindOpen((v) => !v) }, "⌕") : null,
            doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${wrapOn ? " ce-tool-on" : ""}`, title: `${t("editor.wrap")} (⌥Z / Alt+Z)`, onClick: toggleWrap }, "↩") : null,
            doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${blameOn ? " ce-tool-on" : ""}`, title: t("blame.toggle"), disabled: wrapOn, onClick: () => {
              setBlameOn((v) => !v);
              setBlame(null);
            } }, "B") : null,
            doc && !diff && !doc.image ? h("button", { type: "button", className: `ce-tool ce-tiny${fileHist ? " ce-tool-on" : ""}`, title: t("history.title"), onClick: openFileHistory }, "🕘") : null,
            h("span", { className: "ce-spacer" }),
            cursor ? h("button", { type: "button", className: "ce-pos ce-pos-btn", title: t("goto.title"), onClick: () => setGotoOpen(true) }, `Ln ${cursor.line}, Col ${cursor.col}${cursor.word ? ` · ${cursor.word}` : ""}`) : null,
            diagnostics.length ? h("span", { className: "ce-diag" }, `${diagnostics.length} ${t("diag.count")}`) : null
          ),
          findOpen && !editing ? h(
            "div",
            { className: "ce-find" },
            h("input", {
              className: "ce-input ce-find-input",
              placeholder: t("editor.findPlaceholder"),
              value: findQuery,
              autoFocus: true,
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
            findRe === false ? h("span", { className: "ce-find-count cea-err" }, t("find.badRegex")) : h("span", { className: "ce-find-count" }, findQuery ? `${findMatches.length === 0 ? 0 : Math.min(findIdx + 1, findMatches.length)}/${findMatches.length}` : ""),
            h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => jumpFind(-1) }, "↑"),
            h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => jumpFind(1) }, "↓"),
            h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setFindOpen(false) }, "✕")
          ) : null,
          h(
            "div",
            { className: "ce-code-wrap" },
            doc.image ? h(
              "div",
              { className: "ce-imgwrap ce-scroll" },
              doc.image.base64 ? h("img", { className: "ce-img", src: `data:${doc.image.mime};base64,${doc.image.base64}`, alt: doc.path }) : h("div", { className: "ce-note" }, t("image.tooBig")),
              h("div", { className: "ce-imgmeta" }, `${doc.image.mime} · ${(doc.image.size / 1024).toFixed(1)} KB${doc.image.truncated ? ` · ${t("image.tooBig")}` : ""}`)
            ) : editing ? h("textarea", { className: `ce-edit-ta${wrapOn ? " ce-edit-ta-wrap" : ""}`, value: editText, spellcheck: false, onChange: (e) => setEditText(e.target.value) }) : previewActive ? MD_RE.test(doc.path) ? h(MarkdownView, { text: doc.raw }) : SVG_RE.test(doc.path) ? h("div", { className: "ce-imgwrap ce-scroll" }, h("img", { className: "ce-img", src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc.raw)}`, alt: doc.path })) : h("iframe", { className: "ce-htmlprev", sandbox: "", srcDoc: doc.raw, title: doc.path }) : h(
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
                  onScroll: (event) => setScroll(event.currentTarget.scrollTop),
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
            peek ? h(RefsPeek, { t, cwd, peek, scroll, totalLines: doc.lines.length, onPick: pickPeek, onClose: closePeek }) : null,
            symPalette ? h(SymbolPalette, { t, symbols, onPick: (s) => {
              setSymPalette(null);
              revealPosition(s.line, s.col, s.name);
            }, onClose: () => setSymPalette(null) }) : null,
            delPreview ? h(
              "div",
              { className: "ce-overlay" },
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
        searchOpen && search ? h(SearchPanel, {
          t,
          cwd,
          state: search,
          onQuery: (q) => setSearch((s) => s ? { ...s, query: q } : s),
          onInclude: (v) => setSearch((s) => s ? { ...s, include: v } : s),
          onToggleRegex: () => setSearch((s) => s ? { ...s, regex: !s.regex } : s),
          onToggleWords: () => setSearch((s) => s ? { ...s, words: !s.words } : s),
          onSubmit: () => runSearchNow(search.query, search.include, search),
          onPick: onSearchPick,
          onClose: () => setSearchOpen(false),
          onNotify: (text, kind) => say(text, kind)
        }) : null
      )
    ),
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
.ce-peek{position:absolute;left:12px;width:min(660px,calc(100% - 24px));z-index:6;background:var(--dsw-alias-bg-layer-1,#1d2126);border:.5px solid var(--dsw-alias-border-l2,#454a52);border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.18);display:flex;flex-direction:column;max-height:340px;overflow:hidden}
.ce-peek-head{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.ce-peek-sym{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;font-size:12.5px;color:var(--dsw-alias-brand-primary,#6cb2ff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34%}
.ce-peek-meta{font-size:11px;color:var(--dsw-alias-label-secondary,#999);flex:none}
.ce-peek-hint{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#778);flex:none;margin-right:4px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-peek-body{min-height:0;padding-bottom:4px}
.ce-peek-file{position:sticky;top:0;z-index:1;display:flex;align-items:center;padding:4px 12px;background:var(--dsw-alias-bg-layer-2,#23272c);border-top:.5px solid var(--dsw-alias-border-l1,#333);border-bottom:.5px solid var(--dsw-alias-border-l1,#333)}
.ce-peek-fpath{direction:rtl;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#aab)}
.ce-peek-row{display:flex;gap:10px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:3px 12px 3px 18px;cursor:pointer;white-space:nowrap;border-left:2px solid transparent}
.ce-peek-row:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-peek-row-sel{background:var(--dsw-alias-interactive-bg-hover,#2b3038)}
.ce-peek-def{border-left:2px solid var(--dsw-alias-state-success-primary,#3fb950)}
.ce-peek-lno{min-width:52px;text-align:right;color:var(--dsw-alias-label-tertiary,#778);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;flex:none;user-select:none}
.ce-peek-def .ce-peek-lno{color:var(--dsw-alias-state-success-primary,#3fb950)}
.ce-peek-snippet{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-primary,#ccd);overflow:hidden;text-overflow:ellipsis;white-space:pre;min-width:0}
.ce-mark{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 34%,transparent);border-radius:3px;box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary,#59b7ff) 45%,transparent);text-decoration:none}
.ce-banner{flex:none;display:flex;align-items:center;gap:8px;margin:6px 10px 0;padding:6px 8px 6px 10px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 14%,transparent);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 40%,transparent);color:var(--dsw-alias-label-primary,#eee);font-size:12px}
.ce-banner-text{min-width:0;flex:1;white-space:pre-wrap;word-break:break-word}
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
.ce-commitbox{display:flex;flex-direction:column;gap:8px;align-items:stretch;padding:8px 12px 12px;min-width:0;flex:none}
.ce-commitbox-msg{flex:none;width:100%;box-sizing:border-box;min-width:0;font-size:12px;padding:7px 8px}
.ce-commitbox-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;min-width:0}
.ce-commitbox-amend{display:inline-flex;align-items:center;justify-content:center;flex:none;min-height:28px;border:.5px solid var(--dsw-alias-border-l2,#444);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#999);font:inherit;font-size:11px;padding:4px 8px;cursor:pointer}
.ce-commitbox-amend:hover{background:var(--dsw-alias-interactive-bg-hover,#262a30)}
.ce-commitbox-amend:disabled{opacity:.45;cursor:default}
.ce-commitbox-amend:focus-visible,.ce-commitbox-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#59b7ff);outline-offset:2px}
.ce-commitbox-btn{flex:0 1 auto;max-width:100%;min-height:28px;border:0;border-radius:6px;background:var(--dsw-alias-brand-primary,#2f81f7);color:#fff;font:inherit;font-size:11px;font-weight:600;padding:5px 10px;cursor:pointer;white-space:normal;overflow-wrap:anywhere;text-align:center}
.ce-commitbox-btn:hover{filter:brightness(1.12)}
.ce-commitbox-btn:disabled{opacity:.45;cursor:default;filter:none}
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
.ce-sk-root{flex:1;min-height:0;display:flex}
.ce-sk-list{width:320px;flex:none;border-right:.5px solid var(--dsw-alias-border-l1,#333);display:flex;flex-direction:column;overflow:auto}
.ce-sk-head2{display:flex;align-items:center;gap:6px;padding:8px 10px 4px;flex:none}
.ce-sk-title{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--dsw-alias-label-secondary,#999)}
.ce-sk-create{display:flex;gap:6px;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none;align-items:center}
.ce-sk-name-input{flex:1;min-width:0}
.ce-sk-scope{flex:none;width:auto;border:.5px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-secondary,#999);border-radius:6px;font:inherit;font-size:11px;padding:3px 6px}
.ce-sk-section{padding:10px 10px 3px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--dsw-alias-label-tertiary,#889)}
.ce-sk-row{display:flex;flex-direction:column;gap:2px;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:6px 10px 6px 12px;cursor:pointer;border-left:2px solid transparent}
.ce-sk-row:hover{background:var(--dsw-alias-interactive-bg-hover,#26292e)}
.ce-sk-row-on{background:var(--dsw-alias-interactive-bg-hover,#2c313a);border-left-color:var(--dsw-alias-brand-primary,#59b7ff)}
.ce-sk-row-name{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary,#ddd);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-sk-row-desc{font-size:11px;color:var(--dsw-alias-label-tertiary,#777);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-sk-edit{flex:1;min-width:0;display:flex;flex-direction:column}
.ce-sk-ta{flex:1;min-height:0;resize:none;border:0;outline:none;background:transparent;color:var(--dsw-alias-label-primary,#ddd);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;padding:10px 12px;white-space:pre;overflow:auto}
.ce-sk-btn{border:.5px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#24272c);color:var(--dsw-alias-label-primary,#ddd);border-radius:6px;font:inherit;font-size:11px;padding:3px 10px;cursor:pointer;flex:none}
.ce-sk-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.ce-sk-btn:disabled{opacity:.45;cursor:default}
.ce-sk-btn-danger{color:var(--dsw-alias-state-error-primary,#f85149);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 45%,transparent)}
.ce-sk-btn-ghost{background:transparent;color:var(--dsw-alias-label-secondary,#999)}
.ce-sk-path{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#777);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;padding:0 4px;cursor:pointer;min-width:0;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
.ce-edit-ta{flex:1;min-height:0;resize:none;border:0;outline:none;background:var(--dsw-alias-bg-base,#181818);color:var(--dsw-alias-label-primary,#ddd);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:${ROW}px;padding:8px 10px;white-space:pre;overflow:auto;tab-size:4}
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
.cet-act:hover{color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-interactive-bg-hover,#2b2b2b)}
.cet-act-danger{color:var(--dsw-alias-state-error-primary,#f85149);font-size:11px}
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
.cea-hts{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#778);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ce-htmlprev{flex:1;min-height:0;width:100%;border:0;background:#fff}
.ctp-tools{display:flex;gap:6px;padding:4px 8px;border-bottom:.5px solid var(--dsw-alias-border-l1,#333);flex:none}
.ctp-acts{margin-left:auto;display:inline-flex;gap:2px;opacity:0;transition:opacity .1s}
.ce-row:hover .ctp-acts{opacity:1}
.ctp-acts .cet-act{opacity:1}
.ctp-inputrow{cursor:default}
.ctp-inputrow:hover{background:transparent}
.ctp-inputrow .ce-input{flex:1;min-width:0}
`;

// src/client/register.js
var GuideIcon = () => h(
  "svg",
  { viewBox: "0 0 64 64", width: 40, height: 40, "aria-hidden": true, fill: "none", stroke: "#59b7ff", strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } },
  h("path", { d: "M22 20 8 32l14 12" }),
  h("path", { d: "M42 20 56 32 42 44" }),
  h("path", { stroke: "#7de3a4", d: "M36 12 28 52" })
);
var SkillsGuideIcon = () => h(
  "svg",
  { viewBox: "0 0 64 64", width: 40, height: 40, "aria-hidden": true, fill: "none", stroke: "#e3b341", strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } },
  h("path", { d: "M32 8 12 18v28l20 10 20-10V18L32 8Z" }),
  h("path", { d: "M32 8v48M12 18l20 10 20-10" })
);
var definition = (t) => ({
  id: TAB_ID,
  kind: TAB_KIND,
  priority: "extension",
  keepMounted: true,
  title: () => t("type.label"),
  guide: [
    {
      id: "code",
      commandId: "code.explorer",
      order: 15,
      title: () => t("guide.title"),
      description: () => t("guide.description"),
      icon: GuideIcon
    }
  ]
});
var skillsDefinition = (t) => ({
  id: SKILLS_TAB_ID,
  kind: SKILLS_TAB_KIND,
  priority: "extension",
  keepMounted: true,
  title: () => t("skillsTab.label"),
  guide: [
    {
      id: "skills",
      commandId: "code.skills",
      order: 16,
      title: () => t("skillsGuide.title"),
      description: () => t("skillsGuide.description"),
      icon: SkillsGuideIcon
    }
  ]
});
var apiDefinition = (t) => ({
  id: API_TAB_ID,
  kind: API_TAB_KIND,
  priority: "extension",
  keepMounted: true,
  title: () => t("api.label"),
  guide: [
    {
      id: "api",
      order: 17,
      title: () => t("apiGuide.title"),
      description: () => t("apiGuide.description"),
      icon: SkillsGuideIcon
    }
  ]
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
var SOURCE_ORDER = ["project-dsh", "project-agents", "user-dsh", "user-agents", "bundled", "other"];
function SkillsView({ cwd, t, say }) {
  const [skills, setSkills] = useState(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [newName, setNewName] = useState("");
  const [scope, setScope] = useState("user");
  const [editMode, setEditMode] = useState(false);
  const [contentTruncated, setContentTruncated] = useState(false);
  const readonly = sel !== null && (sel.source === "bundled" || sel.source === "other");
  const dirty = content !== savedContent;
  const load = useCallback(() => {
    setBusy(true);
    api("skills.list", { cwd }).then((res) => {
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        setSkills([]);
        return;
      }
      setError("");
      setSkills(res.value.skills ?? []);
    });
  }, [cwd]);
  useEffect(() => {
    load();
  }, [load]);
  const open = useCallback((skill) => {
    setSel(skill);
    setConfirmDel(false);
    setEditMode(false);
    if (!skill.path) {
      setContent("");
      setSavedContent("");
      setContentTruncated(false);
      return;
    }
    api("skills.read", { cwd, path: skill.path }).then((res) => {
      if (!res.ok) {
        say(`${t("error")}: ${res.error}`, "error");
        return;
      }
      setContent(res.value.content);
      setSavedContent(res.value.content);
      setContentTruncated(res.value.truncated === true);
      if (res.value.truncated === true) say(t("skills.truncatedNoSave"), "error");
    });
  }, [cwd, say, t]);
  const save = useCallback(() => {
    if (!sel || !dirty) return;
    if (contentTruncated) {
      say(t("skills.truncatedNoSave"), "error");
      return;
    }
    setBusy(true);
    api("skills.write", { cwd, path: sel.path, content }).then((res) => {
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
  }, [sel, dirty, content, contentTruncated, cwd, say, t, load]);
  const remove = useCallback(() => {
    if (!sel) return;
    setBusy(true);
    api("skills.delete", { cwd, path: sel.path }).then((res) => {
      setBusy(false);
      if (!res.ok) {
        say(`${t("error")}: ${res.error}`, "error");
        return;
      }
      setSel(null);
      setContent("");
      setSavedContent("");
      say(t("skills.deleted"));
      load();
    });
  }, [sel, cwd, say, t, load]);
  const create = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    api("skills.create", { cwd, name, scope }).then((res) => {
      setBusy(false);
      if (!res.ok) {
        say(`${t("error")}: ${res.error}`, "error");
        return;
      }
      setNewName("");
      load();
      if (res.value.skill) open(res.value.skill);
    });
  }, [newName, cwd, scope, say, t, load, open]);
  const onKeyDown = useCallback((event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  }, [save]);
  const grouped = useMemo(() => {
    const groups = [];
    for (const source of SOURCE_ORDER) {
      const items = (skills ?? []).filter((s) => s.source === source);
      if (items.length > 0) groups.push({ source, items });
    }
    return groups;
  }, [skills]);
  const sourceLabel = (source) => source.startsWith("project") ? t("skills.project") : source === "bundled" ? t("skills.bundled") : source === "other" ? t("skills.other") : t("skills.user");
  return h(
    "div",
    { className: "ce-sk-root" },
    h(
      "div",
      { className: "ce-sk-list ce-scroll" },
      h(
        "div",
        { className: "ce-sk-head2" },
        h("span", { className: "ce-sk-title" }, t("skills.title")),
        skills ? h("span", { className: "ce-chip" }, String(skills.length)) : null,
        h("span", { className: "ce-spacer" }),
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("skills.refresh"), onClick: load }, "⟳")
      ),
      h(
        "div",
        { className: "ce-sk-create" },
        h("input", {
          className: "ce-input ce-sk-name-input",
          placeholder: t("skills.createPlaceholder"),
          value: newName,
          onChange: (e) => setNewName(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") create();
          }
        }),
        h(
          "select",
          { className: "ce-sk-scope", value: scope, onChange: (e) => setScope(e.target.value), title: t("skills.scopeTitle") },
          h("option", { value: "user" }, t("skills.user")),
          h("option", { value: "project" }, t("skills.project"))
        ),
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("skills.new"), disabled: busy || newName.trim() === "", onClick: create }, "+")
      ),
      error ? h("div", { className: "ce-note" }, error) : null,
      skills === null ? h("div", { className: "ce-note" }, "…") : null,
      skills !== null && skills.length === 0 ? h("div", { className: "ce-empty" }, t("skills.empty")) : null,
      grouped.map((group) => h(
        "div",
        { key: group.source },
        h("div", { className: "ce-sk-section" }, `${sourceLabel(group.source)} · ${group.items.length}`),
        group.items.map((skill) => h(
          "button",
          {
            key: skill.path || skill.name,
            type: "button",
            className: `ce-sk-row${sel && sel.name === skill.name ? " ce-sk-row-on" : ""}`,
            onClick: () => open(skill),
            title: skill.provider ? `${skill.path || skill.name} · ${skill.provider}` : skill.path
          },
          h("span", { className: "ce-sk-row-name" }, skill.name),
          h("span", { className: "ce-sk-row-desc" }, skill.description || t("skills.noDesc"))
        ))
      ))
    ),
    h(
      "div",
      { className: "ce-sk-edit" },
      !sel ? h("div", { className: "ce-empty" }, t("skills.pick")) : h(
        Fragment,
        null,
        h(
          "div",
          { className: "ce-head" },
          h("span", { className: "ce-head-path", title: sel.path }, sel.name),
          h("span", { className: "ce-chip" }, sel.source),
          readonly ? h("span", { className: "ce-chip ce-chip-warn" }, t("skills.readonly")) : null,
          contentTruncated ? h("span", { className: "ce-chip ce-chip-warn", title: t("skills.truncatedNoSave") }, t("skills.truncatedChip")) : null,
          sel.dir || sel.path ? h("button", {
            type: "button",
            className: "ce-sk-path",
            title: `${sel.dir ?? sel.path} · ${t("skills.copyPath")}`,
            onClick: () => {
              try {
                void navigator.clipboard?.writeText(sel.dir ?? sel.path);
                say(t("skills.pathCopied"));
              } catch {
              }
            }
          }, sel.dir || sel.path) : null,
          dirty ? h("span", { className: "ce-chip ce-chip-warn" }, t("skills.dirty")) : null,
          h("span", { className: "ce-spacer" }),
          readonly ? null : editMode ? h(
            Fragment,
            null,
            h("button", { type: "button", className: "ce-sk-btn", disabled: !dirty || busy, title: "⌘S / Ctrl+S", onClick: save }, t("editor.save")),
            h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", onClick: () => {
              setContent(savedContent);
              setEditMode(false);
            } }, t("editor.cancel"))
          ) : h("button", { type: "button", className: "ce-sk-btn", onClick: () => setEditMode(true) }, t("editor.edit")),
          readonly ? null : confirmDel ? h(
            Fragment,
            null,
            h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-danger", disabled: busy, onClick: remove }, t("skills.deleteConfirm")),
            h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", onClick: () => setConfirmDel(false) }, t("skills.cancel"))
          ) : h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", onClick: () => setConfirmDel(true) }, t("skills.delete")),
          h("button", {
            type: "button",
            className: "ce-sk-btn",
            disabled: !dirty || busy,
            title: "⌘S / Ctrl+S",
            onClick: save
          }, t("skills.save"))
        ),
        h("textarea", {
          className: "ce-sk-ta",
          style: { display: editMode ? void 0 : "none" },
          value: content,
          spellcheck: false,
          onChange: (e) => setContent(e.target.value),
          onKeyDown
        }),
        editMode ? null : h(MarkdownView, { text: content })
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
function SkillsTabBody({ sessionId, useSessions, t }) {
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
    h(SkillsView, { cwd, t, say })
  );
}
function SkillsTitle({ useTabInfo }) {
  const tabInfo = useTabInfo ? useTabInfo() : null;
  return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(SkillsGlyph)), tabInfo?.tab?.title ?? "Skills");
}

// src/client/curl.js
var SUB_CT = { json: "application/json", text: "text/plain", html: "text/html", xml: "application/xml" };
function parseCurl(input) {
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
      if (ch === "\\" && quote === '"') {
        const cont2 = continuationLen(i);
        if (cont2 > 0) {
          i += cont2 - 1;
          continue;
        }
        if (i + 1 < joined.length) {
          cur += joined[++i];
          continue;
        }
        continue;
      }
      if (ch === quote) {
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
  let method = "";
  let url = "";
  let body = "";
  let hasBody = false;
  let asQuery = false;
  const headers = [];
  const form = [];
  const setHeader = (name, value) => {
    const existing = headers.find((hd) => hd.name.toLowerCase() === name.toLowerCase());
    if (existing) existing.value = value;
    else headers.push({ name, value });
  };
  const VALUE_FLAGS = /* @__PURE__ */ new Set(["-o", "--output", "--max-time", "-m", "--retry", "--connect-timeout", "-w", "--write-out", "--resolve", "--cacert", "--cert", "--key", "--proxy", "-x", "-c", "--cookie-jar", "-T", "--upload-file", "--url-query", "--retry-delay", "--retry-max-time", "--limit-rate", "--compressed-ssh"]);
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
      continue;
    }
    if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--data-urlencode") {
      const d = next();
      hasBody = true;
      body = body === "" ? d : `${body}&${d}`;
      continue;
    }
    if (t === "--json") {
      body = next();
      hasBody = true;
      setHeader("Content-Type", "application/json");
      continue;
    }
    if (t === "-F" || t === "--form") {
      form.push(next());
      hasBody = true;
      continue;
    }
    if (t === "-u" || t === "--user") {
      setHeader("Authorization", `Basic ${btoa(unescape(encodeURIComponent(next())))}`);
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
  if (asQuery && body !== "") {
    url = url + (url.includes("?") ? "&" : "?") + body;
    body = "";
    hasBody = false;
  }
  let multipart = null;
  if (form.length > 0) {
    multipart = form.map((f) => {
      const eq = f.indexOf("=");
      return eq > 0 ? { name: f.slice(0, eq), value: f.slice(eq + 1) } : { name: f, value: "" };
    });
  }
  if (hasBody && method === "") method = "POST";
  if (method === "") method = "GET";
  return multipart ? { method, url, headers, body, multipart } : { method, url, headers, body };
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
  const headers = (req?.headers ?? []).filter((hd) => String(hd?.name ?? "").trim() !== "");
  for (const hd of headers) parts.push(`-H ${shellQuote(`${String(hd.name).trim()}: ${hd.value ?? ""}`)}`);
  const hasCT = headers.some((hd) => String(hd.name).trim().toLowerCase() === "content-type");
  if (bodyType === "raw") {
    if (!hasCT) parts.push(`-H ${shellQuote(`Content-Type: ${SUB_CT[req?.rawSub] ?? "text/plain"}`)}`);
    parts.push(`--data-raw ${shellQuote(req?.body ?? "")}`);
  } else if (bodyType === "form") {
    for (const p of req?.formPairs ?? []) {
      const name = String(p?.name ?? "").trim();
      if (name) parts.push(`--data-urlencode ${shellQuote(`${name}=${p?.value ?? ""}`)}`);
    }
  } else if (bodyType === "multipart") {
    for (const p of req?.formPairs ?? []) {
      const name = String(p?.name ?? "").trim();
      if (name) parts.push(`-F ${shellQuote(`${name}=${p?.value ?? ""}`)}`);
    }
  }
  return parts.length <= 2 ? parts.join(" ") : parts.join(" \\\n  ");
}

// src/client/apiclient.js
var DRAFT_KEY = "dsh.ce.api.draft.v1";
function upsertHeader(list, name, value) {
  const found = list.find((hd) => hd.name.toLowerCase() === name.toLowerCase());
  if (found) found.value = value;
  else list.push({ name, value });
}
function statusClass(status) {
  if (status < 300) return "cea-ok";
  if (status < 400) return "cea-info";
  if (status < 500) return "cea-warn";
  return "cea-err";
}
function substituteVars(text, envMap) {
  if (typeof text !== "string" || !text.includes("{{")) return text;
  return text.replace(/\{\{\s*([A-Za-z0-9_.\-]+)\s*\}\}/g, (whole, name) => Object.prototype.hasOwnProperty.call(envMap, name) ? String(envMap[name]) : whole);
}
function buildEnvMap(pairs) {
  const map = {};
  for (const p of pairs ?? []) {
    const name = String(p?.name ?? "").trim();
    if (name) map[name] = p?.value ?? "";
  }
  return map;
}
function mergeParams(url, pairs) {
  const raw = String(url ?? "");
  const active = (pairs ?? []).filter((p) => String(p?.name ?? "").trim() !== "");
  if (active.length === 0) return raw;
  const hAt = raw.indexOf("#");
  const frag = hAt >= 0 ? raw.slice(hAt) : "";
  const work = hAt >= 0 ? raw.slice(0, hAt) : raw;
  const qAt = work.indexOf("?");
  const base = qAt >= 0 ? work.slice(0, qAt) : work;
  const params = new URLSearchParams(qAt >= 0 ? work.slice(qAt + 1) : "");
  for (const p of active) params.set(String(p.name).trim(), String(p.value ?? ""));
  const qs = params.toString();
  return `${base}${qs ? `?${qs}` : ""}${frag}`;
}
function prettySize(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
var HIST_KEY = "dsh.ce.api.history.v1";
var SAVED_KEY = "dsh.ce.api.saved.v1";
var ENV_KEY = "dsh.ce.api.env.v1";
var HIST_CAP = 30;
var SAVED_CAP = 50;
function pushEntry(list, entry, cap) {
  const base = Array.isArray(list) ? list.filter((e) => e && e.id !== entry.id) : [];
  return [entry, ...base].slice(0, cap);
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
function loadList(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function storeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
  }
}
function ApiView({ t }) {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState([]);
  const [bodyType, setBodyType] = useState("none");
  const [rawSub, setRawSub] = useState("json");
  const [formPairs, setFormPairs] = useState([]);
  const [beautifyErr, setBeautifyErr] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);
  const [showRespHeaders, setShowRespHeaders] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [histOpen, setHistOpen] = useState(false);
  const [histTab, setHistTab] = useState("history");
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [envPairs, setEnvPairs] = useState(() => loadList(ENV_KEY));
  const [envOpen, setEnvOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paramPairs, setParamPairs] = useState([]);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(3e4);
  useEffect(() => {
    storeList(ENV_KEY, envPairs);
  }, [envPairs]);
  useEffect(() => {
    setHistory(loadList(HIST_KEY));
    setSaved(loadList(SAVED_KEY));
  }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw === null) return;
      const d = JSON.parse(raw);
      if (typeof d.method === "string") setMethod(d.method);
      if (typeof d.url === "string") setUrl(d.url);
      if (Array.isArray(d.headers)) setHeaders(d.headers);
      if (typeof d.bodyType === "string") setBodyType(d.bodyType);
      if (typeof d.rawSub === "string") setRawSub(d.rawSub);
      if (Array.isArray(d.formPairs)) setFormPairs(d.formPairs);
      if (typeof d.body === "string") setBody(d.body);
      if (Array.isArray(d.paramPairs)) setParamPairs(d.paramPairs);
      if (Number.isFinite(d.timeoutMs) && d.timeoutMs >= 1e3) setTimeoutMs(Math.min(12e4, d.timeoutMs));
    } catch {
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs }));
    } catch {
    }
  }, [method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs]);
  const beautify = useCallback(() => {
    try {
      setBody(JSON.stringify(JSON.parse(body), null, 2));
      setBeautifyErr("");
    } catch {
      setBeautifyErr(t("api.beautifyErr"));
    }
  }, [body, t]);
  const snapshot = useCallback(
    () => ({ method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs }),
    [method, url, headers, bodyType, rawSub, formPairs, body, paramPairs, timeoutMs]
  );
  const restoreRequest = useCallback((req) => {
    if (!req || typeof req !== "object") return;
    if (typeof req.method === "string") setMethod(req.method);
    if (typeof req.url === "string") setUrl(req.url);
    if (Array.isArray(req.headers)) setHeaders(req.headers);
    if (typeof req.bodyType === "string") setBodyType(req.bodyType);
    if (typeof req.rawSub === "string") setRawSub(req.rawSub);
    if (Array.isArray(req.formPairs)) setFormPairs(req.formPairs);
    if (typeof req.body === "string") setBody(req.body);
    if (Array.isArray(req.paramPairs)) setParamPairs(req.paramPairs);
    if (Number.isFinite(req.timeoutMs) && req.timeoutMs >= 1e3) setTimeoutMs(Math.min(12e4, req.timeoutMs));
    setResponse(null);
    setHistOpen(false);
  }, []);
  const send = useCallback(() => {
    if (url.trim() === "" || sending) return;
    const envMap = buildEnvMap(envPairs);
    const sendHeaders = headers.filter((hd) => String(hd.name ?? "").trim() !== "").map((hd) => ({ name: String(hd.name).trim(), value: substituteVars(String(hd.value ?? ""), envMap) }));
    let sendBody;
    let multipart;
    if (bodyType === "raw") {
      sendBody = substituteVars(body, envMap);
      upsertHeader(sendHeaders, "Content-Type", SUB_CT[rawSub] ?? "text/plain");
    } else if (bodyType === "form") {
      sendBody = new URLSearchParams(formPairs.filter((p) => String(p.name ?? "").trim() !== "").map((p) => [p.name.trim(), substituteVars(String(p.value ?? ""), envMap)])).toString();
      upsertHeader(sendHeaders, "Content-Type", "application/x-www-form-urlencoded");
    } else if (bodyType === "multipart") {
      multipart = formPairs.filter((p) => String(p.name ?? "").trim() !== "").map((p) => ({ name: p.name.trim(), value: substituteVars(String(p.value ?? ""), envMap) }));
    }
    const sentMethod = method;
    const sentUrl = substituteVars(mergeParams(url.trim(), paramPairs), envMap);
    const sentSnapshot = snapshot();
    setSending(true);
    api("api.send", {
      method,
      url: sentUrl,
      headers: sendHeaders,
      body: sendBody,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : void 0,
      ...multipart ? { multipart } : {}
    }).then((res) => {
      setSending(false);
      const value = res.ok ? res.value : { error: res.error };
      setResponse(value);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        method: sentMethod,
        url: sentUrl,
        status: value?.status,
        ms: value?.ms,
        error: value?.error ?? void 0,
        request: sentSnapshot
      };
      setHistory((prev) => {
        const next = pushEntry(prev, entry, HIST_CAP);
        storeList(HIST_KEY, next);
        return next;
      });
    });
  }, [method, url, headers, bodyType, rawSub, formPairs, body, sending, snapshot, envPairs, paramPairs, timeoutMs]);
  const copyCurl = useCallback(() => {
    const text = toCurl({ method, url: mergeParams(url.trim(), paramPairs), headers, bodyType, rawSub, formPairs, body });
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
    try {
      const p = navigator.clipboard?.writeText(text);
      if (p && typeof p.then === "function") p.then(done, () => {
      });
      else done();
    } catch {
    }
  }, [method, url, headers, bodyType, rawSub, formPairs, body, paramPairs]);
  const doImport = useCallback(() => {
    const p = parseCurl(importText);
    setMethod(p.method);
    setUrl(p.url);
    if (p.headers.length > 0) setHeaders(p.headers);
    if (p.multipart) {
      setFormPairs(p.multipart);
      setBodyType("multipart");
    } else if (p.body !== "") {
      setBody(p.body);
      setBodyType("raw");
    }
    setImportText("");
    setImportOpen(false);
  }, [importText]);
  const doSaveFavorite = useCallback(() => {
    const name = saveName.trim();
    if (name === "") return;
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, ts: Date.now(), request: snapshot() };
    setSaved((prev) => {
      const next = [entry, ...prev.filter((e) => e && e.name !== name)].slice(0, SAVED_CAP);
      storeList(SAVED_KEY, next);
      return next;
    });
    setSaveName("");
    setSaveOpen(false);
    setHistTab("saved");
    setHistOpen(true);
  }, [saveName, snapshot]);
  const removeHistory = useCallback((id) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e && e.id !== id);
      storeList(HIST_KEY, next);
      return next;
    });
  }, []);
  const removeSaved = useCallback((id) => {
    setSaved((prev) => {
      const next = prev.filter((e) => e && e.id !== id);
      storeList(SAVED_KEY, next);
      return next;
    });
  }, []);
  const clearHistory = useCallback(() => {
    setHistory([]);
    storeList(HIST_KEY, []);
  }, []);
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
  const setHeaderAt = (index, patch) => setHeaders((prev) => prev.map((hd, i) => i === index ? { ...hd, ...patch } : hd));
  const activeParamCount = paramPairs.filter((p) => String(p?.name ?? "").trim() !== "").length;
  return h(
    "div",
    { className: "ce-root" },
    h(
      "div",
      { className: "cea-bar" },
      h(
        "select",
        { className: "cea-method", value: method, onChange: (e) => setMethod(e.target.value) },
        ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map((m) => h("option", { key: m, value: m }, m))
      ),
      h("input", {
        className: "ce-input cea-url",
        placeholder: t("api.urlPlaceholder"),
        value: url,
        onChange: (e) => setUrl(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") send();
        }
      }),
      h("button", { type: "button", className: "ce-sk-btn cea-send", disabled: sending || url.trim() === "", onClick: send }, sending ? t("api.sending") : t("api.send")),
      h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.importTitle"), onClick: () => {
        setImportOpen(true);
        setHistOpen(false);
        setSaveOpen(false);
        setEnvOpen(false);
      } }, t("api.import")),
      h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.copyCurl"), disabled: url.trim() === "", onClick: copyCurl }, copied ? t("api.copied") : "⧉ curl"),
      h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${envOpen ? " cea-btn-on" : ""}`, title: t("api.envTitle"), onClick: () => {
        setEnvOpen((v) => !v);
        setHistOpen(false);
        setSaveOpen(false);
        setImportOpen(false);
      } }, `{{}}${envPairs.length ? ` ${envPairs.length}` : ""}`),
      h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("api.saveTitle"), onClick: () => {
        setSaveOpen(true);
        setHistOpen(false);
        setImportOpen(false);
        setEnvOpen(false);
      } }, t("api.saveBtn")),
      h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${histOpen ? " cea-btn-on" : ""}`, title: t("api.history"), onClick: () => {
        setHistOpen((v) => !v);
        setSaveOpen(false);
        setImportOpen(false);
        setEnvOpen(false);
      } }, `${t("api.history")}${history.length ? ` ${history.length}` : ""}`)
    ),
    histOpen ? h(
      "div",
      { className: "cea-hist" },
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
      { className: "cea-scroll ce-scroll" },
      h(
        "div",
        { className: "cea-sec" },
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.params"), onClick: () => setParamsOpen((v) => !v) }, paramsOpen ? "▾" : "▸"),
        h("span", null, `${t("api.params")}${activeParamCount ? ` · ${activeParamCount}` : ""}`),
        h("span", { className: "ce-spacer" }),
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
        )
      ),
      paramsOpen ? h(
        Fragment,
        null,
        paramPairs.map((p, i) => h(
          "div",
          { key: i, className: "cea-hrow" },
          h("input", { className: "ce-input cea-hkey", placeholder: "name", value: p.name ?? "", onChange: (e) => setParamPairs((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x)) }),
          h("input", { className: "ce-input cea-hval", placeholder: "value", value: p.value ?? "", onChange: (e) => setParamPairs((prev) => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x)) }),
          h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setParamPairs((prev) => prev.filter((_, j) => j !== i)) }, "✕")
        )),
        h(
          "div",
          { className: "cea-hrow" },
          h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.addParam"), onClick: () => setParamPairs((prev) => [...prev, { name: "", value: "" }]) }, "+"),
          h("span", { className: "cea-hint" }, t("api.paramsHint"))
        )
      ) : null,
      h(
        "div",
        { className: "cea-sec" },
        h("span", null, t("api.headers")),
        h("span", { className: "ce-spacer" }),
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.addHeader"), onClick: () => setHeaders((prev) => [...prev, { name: "", value: "" }]) }, "+")
      ),
      headers.map((hd, i) => h(
        "div",
        { key: i, className: "cea-hrow" },
        h("input", { className: "ce-input cea-hkey", placeholder: "Header", value: hd.name ?? "", onChange: (e) => setHeaderAt(i, { name: e.target.value }) }),
        h("input", { className: "ce-input cea-hval", placeholder: "Value", value: hd.value ?? "", onChange: (e) => setHeaderAt(i, { value: e.target.value }) }),
        h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setHeaders((prev) => prev.filter((_, j) => j !== i)) }, "✕")
      )),
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
        ) : null,
        bodyType === "form" || bodyType === "multipart" ? h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.addHeader"), onClick: () => setFormPairs((prev) => [...prev, { name: "", value: "" }]) }, "+") : null
      ),
      bodyType === "form" || bodyType === "multipart" ? h(Fragment, null, formPairs.map((p, i) => h(
        "div",
        { key: i, className: "cea-hrow" },
        h("input", { className: "ce-input cea-hkey", placeholder: "key", value: p.name ?? "", onChange: (e) => setFormPairs((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x)) }),
        h("input", { className: "ce-input cea-hval", placeholder: "value", value: p.value ?? "", onChange: (e) => setFormPairs((prev) => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x)) }),
        h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setFormPairs((prev) => prev.filter((_, j) => j !== i)) }, "✕")
      ))) : null,
      bodyType === "raw" ? h("textarea", { className: "cea-body", value: body, spellcheck: false, onChange: (e) => {
        setBody(e.target.value);
        setBeautifyErr("");
      } }) : null,
      response ? h(
        Fragment,
        null,
        h("div", { className: "cea-sec" }, h("span", null, t("api.resp"))),
        h(
          "div",
          { className: "cea-status" },
          response.error ? h("span", { className: "cea-err" }, `${t("api.err")}: ${response.error}`) : h(
            Fragment,
            null,
            h("span", { className: statusClass(response.status) }, `${response.status} ${response.statusText ?? ""}`),
            h("span", { className: "cea-meta" }, `${response.ms ?? 0}ms · ${prettySize(response.size ?? 0)}${response.truncated ? " · truncated" : ""}`),
            h("span", { className: "ce-spacer" }),
            h("button", { type: "button", className: "ce-link", onClick: () => setShowRespHeaders((v) => !v) }, `${t("api.respHeaders")} ${showRespHeaders ? "▾" : "▸"}`)
          )
        ),
        showRespHeaders && !response.error ? h("div", { className: "cea-hlist" }, (response.headers ?? []).map((hd, i) => h("div", { key: i }, h("span", { className: "cea-hk" }, hd[0]), h("span", null, hd[1])))) : null,
        !response.error ? h("pre", { className: "cea-resp" }, respJson ?? response.text ?? "") : null
      ) : null
    ),
    importOpen ? h(
      "div",
      { className: "ce-overlay" },
      h(
        "div",
        { className: "ce-overlay-head" },
        h("span", null, t("api.importTitle")),
        h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setImportOpen(false) }, "✕")
      ),
      h("textarea", { className: "cea-body cea-import", value: importText, spellcheck: false, placeholder: "curl -X POST 'https://…' -H 'K: V' -d '{…}'", onChange: (e) => setImportText(e.target.value) }),
      h(
        "div",
        { className: "cea-bar" },
        h("span", { className: "ce-spacer" }),
        h("button", { type: "button", className: "ce-sk-btn", disabled: importText.trim() === "", onClick: doImport }, t("api.importBtn"))
      )
    ) : null,
    saveOpen ? h(
      "div",
      { className: "ce-overlay" },
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
          value: saveName,
          autoFocus: true,
          onChange: (e) => setSaveName(e.target.value),
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.key === "Enter") doSaveFavorite();
            else if (e.key === "Escape") setSaveOpen(false);
          }
        }),
        h("button", { type: "button", className: "ce-sk-btn", disabled: saveName.trim() === "", onClick: doSaveFavorite }, t("api.saveConfirm"))
      )
    ) : null,
    envOpen ? h(
      "div",
      { className: "ce-overlay" },
      h(
        "div",
        { className: "ce-overlay-head" },
        h("span", null, t("api.env")),
        h("button", { type: "button", className: "ce-tool ce-tiny", onClick: () => setEnvOpen(false) }, "✕")
      ),
      h("div", { className: "ce-note" }, t("api.envTitle")),
      h(
        "div",
        { className: "cea-scroll" },
        envPairs.length === 0 ? h("div", { className: "ce-note" }, t("api.envEmpty")) : null,
        envPairs.map((p, i) => h(
          "div",
          { key: i, className: "cea-hrow" },
          h("input", { className: "ce-input cea-hkey", placeholder: "name", value: p.name ?? "", onChange: (e) => setEnvPairs((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x)) }),
          h("input", { className: "ce-input cea-hval", placeholder: "value", value: p.value ?? "", onChange: (e) => setEnvPairs((prev) => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x)) }),
          h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.delete"), onClick: () => setEnvPairs((prev) => prev.filter((_, j) => j !== i)) }, "✕")
        ))
      ),
      h(
        "div",
        { className: "cea-bar" },
        h("button", { type: "button", className: "ce-tool ce-tiny", title: t("api.addEnv"), onClick: () => setEnvPairs((prev) => [...prev, { name: "", value: "" }]) }, "+"),
        h("span", { className: "ce-spacer" }),
        h("button", { type: "button", className: "ce-sk-btn", onClick: () => setEnvOpen(false) }, t("close"))
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

// src/client/launcher.js
var GROUPS = [
  { id: "skills", test: (kind) => /skill/.test(kind) },
  { id: "run", test: (kind) => /(terminal|shell|browser|web)/.test(kind) },
  { id: "code", test: (kind) => /^(files|code|document)/.test(kind) }
];
var GROUP_ORDER = ["code", "run", "skills", "more"];
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
    if (!def || typeof def !== "object") continue;
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
function shortcutCatalog(shortcuts) {
  if (!shortcuts || typeof shortcuts !== "object") return /* @__PURE__ */ new Map();
  for (const name of ["list", "catalog", "entries", "all"]) {
    const fn = shortcuts[name];
    if (typeof fn !== "function") continue;
    try {
      const value = fn.call(shortcuts);
      if (!Array.isArray(value)) continue;
      const map = /* @__PURE__ */ new Map();
      for (const item of value) {
        if (item && typeof item === "object" && typeof item.id === "string") map.set(item.id, item);
      }
      return map;
    } catch {
    }
  }
  return /* @__PURE__ */ new Map();
}
function bindingLabel(cat) {
  if (!cat) return "";
  for (const value of [cat.bindingLabel, cat.binding?.label, cat.binding, cat.accelerator, cat.keys, cat.currentLabel]) {
    if (typeof value === "string" && value !== "") return value;
  }
  return "";
}
function makeLauncher({ registry, sidebarRight, getShortcuts, t }) {
  return function Launcher() {
    const boxes = collectBoxes(registry);
    if (boxes.length === 0) return null;
    const catalog = shortcutCatalog(getShortcuts ? getShortcuts() : null);
    const sections = [];
    let currentGroup = null;
    for (const box of boxes) {
      if (box.group !== currentGroup) {
        currentGroup = box.group;
        sections.push(h("div", { key: `s:${currentGroup}`, className: "cel-section" }, t(`launcher.${currentGroup}`)));
      }
      const { entry, kind } = box;
      const icon = typeof entry.icon === "function" ? h(entry.icon, {}) : null;
      const kbd = bindingLabel(catalog.get(entry.commandId));
      sections.push(h(
        "button",
        {
          key: `${kind}:${entry.id}`,
          type: "button",
          className: "cel-row",
          title: typeof entry.description === "function" ? entry.description() : "",
          onClick: () => {
            try {
              sidebarRight.openTab(kind);
            } catch (error) {
              console.warn("code-explorer: launcher open failed", error);
            }
          }
        },
        h("span", { className: `cel-ico cel-ico-${box.group}` }, icon),
        h(
          "span",
          { className: "cel-mid" },
          h("span", { className: "cel-title" }, typeof entry.title === "function" ? entry.title() : String(entry.id)),
          typeof entry.description === "function" ? h("span", { className: "cel-desc" }, entry.description()) : null
        ),
        kbd ? h("kbd", { className: "cel-kbd" }, kbd) : null
      ));
    }
    return h("div", { className: "cel-root ce-scroll" }, sections);
  };
}

// src/client/index.js
var index_default = {
  inject: ["slots", "locale", "sidebarRightTabs", "sidebarRight"],
  apply(ctx) {
    const safe = (label, fn) => {
      try {
        ctx.effect(fn, label);
      } catch (error) {
        console.error(`code-explorer: ${label} failed`, error);
      }
    };
    safe("styles", insertStyles);
    const bound = ctx.locale.bind(NS);
    let shortcutsSvc = null;
    safe("dictionaries", () => ctx.locale.register(NS, { zh, en }));
    safe("tab type", () => ctx.sidebarRightTabs.register(definition(bound)));
    const Bound = (props) => h(CodeBody, { ...props, t: props.t ?? bound });
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
    const ApiBound = (props) => h(ApiView, { ...props, t: props.t ?? bound });
    safe("api tab body", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: API_TAB_ID,
      locale: NS
    }, ApiBound)));
    safe("api tab title", () => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
      name: "sidebar.right.pane.tab.title",
      key: API_TAB_ID
    }, ApiTitle)));
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
      shortcutsSvc = shortcutCtx.shortcuts;
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
    const Launcher = makeLauncher({
      registry: ctx.sidebarRightTabs,
      sidebarRight: ctx.sidebarRight,
      getShortcuts: () => shortcutsSvc,
      t: bound
    });
    safe("guide launcher", () => ctx.slots.inject("sidebar.right.tab.guide", () => ctx.slots.register({
      name: "sidebar.right.tab.guide",
      order: -100,
      select: (owner) => owner && typeof owner === "object" ? true : null
    }, Launcher)));
  }
};
		return module.exports;
	},
});
