# `ctx.pluginKit`（Client 服务 v1）

其他浏览器侧插件不必自行实现"打开文件/看 diff"，通过这个服务驱动本插件的代码工作台。服务只排队一个导航请求，编辑器状态（导航栈、草稿、LSP）仍由工作台独占，调用方无法破坏它。

## 用法

```js
export const inject = ["pluginKit"];

export function apply(ctx) {
  // 打开并定位（行/列从 1 开始）
  ctx.pluginKit.openFile("app/main.go", { line: 42, column: 3 });
  // 等价写法
  ctx.pluginKit.navigate({ path: "app/main.go", line: 42 });
  // 打开某个文件的 diff：scope = working | staged | branch | commit
  ctx.pluginKit.openDiff("app/main.go", { scope: "staged" });
}
```

## 契约

| 成员 | 说明 |
|---|---|
| `version` | 当前为 `1`；新增方法升 minor，改签名/语义升 major |
| `openFile(path, {line, column})` | 打开 Code 标签并载入文件；路径为空抛 `TypeError`；返回 `true` |
| `navigate({path, line, column})` | `openFile` 的别名，语义更直观 |
| `openDiff(path, {scope})` | 打开该文件的 diff，默认 `working` |
| `registerViewer` | **尚未提供**：面板自己决定图片/Markdown/文本的呈现，等有独立 viewer 管线再加 |

## 实现要点

- 服务在 `src/client/plugin-service.js`，由 `src/client/index.js` 注册到 `ctx.pluginKit`。
- 请求走 `src/client/actions.js` 的 action bus：标签未挂载时缓冲一条，120ms 内重放到第一个订阅者，保证"先请求后开标签"也能生效。
- 调用方只传路径与位置；相对路径按工作区解析，围栏与保存冲突仍由 Host 侧负责（见 `docs/host-contracts.md`）。
