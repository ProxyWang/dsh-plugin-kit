// Bundles src/client/** into the single client.js the DSH client module system requires.
//
// DSH registers exactly one module id per client entry, so the runtime artifact must stay a
// single file: `window.__ModuleLoader__.load({ id, factory(require) { … } })`, with `react`
// resolved through the platform seed word instead of being bundled. Everything else — the ES
// modules under src/client — is what you should edit.
import { build } from "esbuild";

const BANNER = `/**
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
		var exports = module.exports;`;

const FOOTER = `		return module.exports;
	},
});`;

const result = await build({
	entryPoints: ["src/client/index.js"],
	outfile: "client.js",
	bundle: true,
	format: "cjs",
	platform: "browser",
	external: ["react"],
	minify: false,
	sourcemap: false,
	charset: "utf8", // keep the CJK copy as written instead of \uXXXX escapes
	legalComments: "none",
	target: "es2022",
	banner: { js: BANNER },
	footer: { js: FOOTER },
	logLevel: "silent",
});

if (result.errors.length > 0) {
	console.error(result.errors);
	process.exit(1);
}
console.log("built client.js from src/client/**");
