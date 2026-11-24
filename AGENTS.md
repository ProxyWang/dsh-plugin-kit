# AGENTS.md

本文件只写"每次动手都要守"的红线与门禁；背景与设计见 `docs/`。

## 五条红线

1. **`client.js` 是构建产物，不手改。** 只改 `src/client/**`，跑 `pnpm build`（即 `node scripts/build-client.mjs`）重新生成。
2. **Host 路由的失败必须走统一出口。** 用 `sendOk` / `sendError`（错误码 + HTTP 状态）；不要新写 `respondJson(res, 200, { ok: false })`，也不要吞掉错误只回 200。
3. **新路由要登记并测试。** 路由写进 `lib/host/routes.js`（或 `dbRoutes`），并在 `test-host.mjs` 里加断言；API 只接受 POST。路由键用 `动词.名词[.细节]`。
4. **路径必须过围栏。** 所有文件读写经 `lib/host/fence.js`（realpath containment + 拒绝 symlink 逃逸 + 拒绝 `..`）；写文件只用 `writeFencedText`（原子写 + `baseMtime` 冲突检测），不要直接 `writeFile` 到用户路径。
5. **客户端状态按作用域落盘。** UI 状态跟 session，项目数据跟 workspace(cwd)，偏好全局；密码/token 只进 Host vault，不进 localStorage。

## 改什么跑什么

| 改动位置 | 必跑 |
|---|---|
| `src/client/**` | `node scripts/build-client.mjs && node test-client.mjs` |
| `index.js`、`lib/host/**` | `node test-host.mjs` |
| `package.json`、`cordis.patch.yml`、`locale/*.json`、`exports`/`files` | `node scripts/check-manifest.mjs` |
| `lib/host/constants.js`、`src/client/constants.js`、`lib/host/errors.js`、`routes.js` | `node scripts/check-contract.mjs` |
| `lib/host/fence.js` | `node test-host.mjs`（含 fence / 原子写 / 冲突用例） |
| 任何提交前 | `pnpm check && pnpm test` |

`pnpm check` = manifest 守护 + host/client 契约守护；`pnpm test` 已包含 `check`、构建与全部套件。

## 提交与发布

- 一次改动一个主题；CHANGELOG 的 `Unreleased` 段落写清行为变化，并附"验证："说明跑了什么。
- 发版前确认：`package.json` 版本、`cordis.patch.yml` 引用、`client.js` 产物均为最新构建。
- 改了 `lib/host/**` 的公开路由或错误码，同步更新 `docs/host-contracts.md`。
