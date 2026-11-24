/* ---------------- terminal hot-path benchmark ----------------
 *
 * Fixed geometry and fixed byte volume make before/after comparisons honest:
 * parse throughput by retained-scrollback depth, full-screen scroll cost, row
 * HTML construction and retained memory. This is not a user workload; it is
 * the regression baseline referenced by docs/terminal-design.md.
 *
 * Run: node scripts/bench-terminal.mjs
 *      node --expose-gc scripts/bench-terminal.mjs   (retained RSS)
 */

import { createScreen } from "../src/client/vt/screen.js";
import { rowHtml } from "../src/client/vt/render.js";

const MiB = 1024 * 1024;
const now = () => Number(process.hrtime.bigint()) / 1e6;
const mib = (value) => Number((value / MiB).toFixed(1));

function coloredLine(i) {
	return `\x1b[38;5;${(i % 200) + 16}m${String(i).padStart(6)} \x1b[1m~/project/src\x1b[0m \x1b[32m✓\x1b[0m build completed in ${(i % 900) + 100}ms 中文字符测试 😀\r\n`;
}

function parseCase(scrollback, targetMiB = 4) {
	const screen = createScreen({ cols: 200, rows: 50, scrollback });
	const chunk = Array.from({ length: 200 }, (_, i) => coloredLine(i)).join("");
	const bytes = Buffer.byteLength(chunk);
	let written = 0;
	const started = now();
	while (written < targetMiB * MiB) {
		screen.write(chunk);
		written += bytes;
	}
	const elapsed = now() - started;
	return {
		scrollback,
		mib: mib(written),
		ms: Number(elapsed.toFixed(1)),
		mibPerSecond: mib(written / (elapsed / 1000)),
		retainedRows: screen.bufferRows,
		scrollbackBytes: screen.scrollbackBytes,
	};
}

function parseUnwrapped(scrollback) {
	const screen = createScreen({ cols: 200, rows: 50, scrollback });
	const chunk = "x".repeat(4000);
	const started = now();
	for (let i = 0; i < 1000; i++) screen.write(chunk);
	return { scrollback, mib: 4, ms: Number((now() - started).toFixed(1)), retainedRows: screen.bufferRows };
}

function scrollCase(scrollback) {
	const screen = createScreen({ cols: 120, rows: 40, scrollback });
	const chunk = Array.from({ length: 100 }, (_, i) => `line ${i} ${"x".repeat(60)}\r\n`).join("");
	screen.write(chunk);
	const started = now();
	for (let i = 0; i < 1000; i++) screen.write(chunk);
	return { scrollback, lines: 100_000, ms: Number((now() - started).toFixed(1)) };
}

function paintCase() {
	const screen = createScreen({ cols: 200, rows: 50, scrollback: 1000 });
	for (let i = 0; i < 100; i++) screen.write(coloredLine(i));
	const lines = screen.viewport();
	const started = now();
	let chars = 0;
	for (let n = 0; n < 100; n++) for (const line of lines) chars += rowHtml(line, { fg: "#fff", bg: "#000" }).length;
	return { ms: Number((now() - started).toFixed(1)), chars, msPerFrame: Number(((now() - started) / 100).toFixed(3)) };
}

function memoryCase() {
	const screen = createScreen({ cols: 200, rows: 50, scrollback: 1000 });
	const chunk = Array.from({ length: 200 }, (_, i) => coloredLine(i)).join("");
	for (let i = 0; i < 400; i++) screen.write(chunk);
	if (typeof globalThis.gc === "function") globalThis.gc();
	return { rssMiB: mib(process.memoryUsage().rss), rows: screen.bufferRows, scrollbackBytes: screen.scrollbackBytes };
}

const report = {
	node: process.version,
	platform: `${process.platform} ${process.arch}`,
	parse: [0, 1000, 5000].map((depth) => parseCase(depth)),
	unwrapped: [parseUnwrapped(0), parseUnwrapped(1000)],
	scroll: [1000, 5000, 20000].map(scrollCase),
	paint: paintCase(),
	memory: memoryCase(),
};

console.log(JSON.stringify(report, null, 2));
