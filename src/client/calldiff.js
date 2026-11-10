/* ---------------- chat call rows: click-to-side-panel diff ---------------- */

import { h, useMemo } from "./react.js";

const str = (value) => (typeof value === "string" ? value : "");

/** Keep only well-formed hunk records from a kernel/view diffs array. */
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

/** Intended change of one call from its arguments (write replaces the file). */
function intendedHunk(call) {
	const args = (call && call.args) || {};
	const path = str(args.file_path);
	if (path === "") return null;
	if (/write/i.test(str(call && call.name))) return { path, oldText: "", newText: str(args.content) };
	return { path, oldText: str(args.old_string), newText: str(args.new_string) };
}

/**
 * Hunks one row should show: settled calls prefer the kernel's meta.diffs
 * (what actually landed), then diff card views; writes without applied diffs,
 * failed calls, and still-running calls fall back to the intended argument
 * diff so the row always names the file it touches.
 */
export function hunksFromBlock(block) {
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

/** Group hunks by file (order preserved) and emit unified-diff text plus stats. */
export function unifiedFromHunks(hunks) {
	const files = [];
	const byPath = new Map();
	for (const hunk of hunks) {
		let list = byPath.get(hunk.path);
		if (list === void 0) {
			list = [];
			byPath.set(hunk.path, list);
			files.push(hunk.path);
		}
		list.push(hunk);
	}
	let add = 0;
	let del = 0;
	const out = [];
	for (const path of files) {
		out.push(`--- a/${path}`, `+++ b/${path}`);
		for (const hunk of byPath.get(path)) {
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

/** Relativize against the session cwd first, then the host home. */
function relativePath(path, cwd, home) {
	if (cwd && path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
	if (home && path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;
	return path;
}

function summarize(block) {
	const settled = Boolean(block && typeof block === "object" && "kind" in block);
	const hunks = hunksFromBlock(block);
	const call = block && typeof block === "object" ? (settled ? block.call : block) : null;
	const argsPath = str(call && call.args && call.args.file_path);
	const path = (hunks && hunks[0].path) || argsPath;
	const stats = hunks ? unifiedFromHunks(hunks).stats : { add: 0, del: 0 };
	return {
		hunks,
		path,
		add: stats.add,
		del: stats.del,
		settled,
		failed: Boolean(block && block.isError),
	};
}

/**
 * Compact chat row for edit/write tool calls: one click opens this call's diff
 * in the code explorer side panel (event bridge wired in index.js). Replaces
 * the stock expandable row for these two tools at priority -1.
 */
export function CallDiffRow(props) {
	const block = props ? props.block : null;
	const toolName = str(props && props.toolName);
	const info = useMemo(() => summarize(block), [block]);
	const t = (props && props.t) || ((key) => key);
	const label = /write/i.test(toolName) ? t("toolrow.write") : t("toolrow.edit");
	const display = info.path ? relativePath(info.path, props ? props.cwd : void 0, props ? props.home : void 0) : "";
	if (!info.settled) {
		return h("div", { className: "ce-calrow ce-calrow-run" },
			h("span", { className: "ce-cal-label" }, label),
			h("span", { className: "ce-cal-path" }, display || t("toolrow.nopath")),
			h("span", { className: "ce-cal-hint ce-cal-hint-on" }, t("toolrow.running")));
	}
	const clickable = info.hunks !== null && info.hunks.length > 0 && typeof props.openCallDiff === "function";
	const onClick = (event) => {
		if (!clickable) return;
		const { text, stats, files } = unifiedFromHunks(info.hunks);
		props.openCallDiff({
			path: files.length > 1 ? `${files.length} · ${display}` : display,
			text,
			stats,
			gutter: false,
		}, event.currentTarget);
	};
	return h("button", {
		type: "button",
		className: `ce-calrow${info.failed ? " ce-calrow-fail" : ""}`,
		title: clickable ? t("toolrow.hint") : void 0,
		disabled: !clickable,
		onClick,
	},
	h("span", { className: "ce-cal-label" }, label),
	h("span", { className: "ce-cal-path", title: info.path }, display || t("toolrow.nopath")),
	info.failed ? h("span", { className: "ce-chip" }, t("toolrow.failed")) : null,
	h("span", { className: "ce-cal-stats" }, `+${info.add} −${info.del}`),
	h("span", { className: "ce-cal-hint" }, t("toolrow.hint")));
}
