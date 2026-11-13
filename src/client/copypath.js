import { h } from "./react.js";
import { toAbs } from "./pathtools.js";

/** Git paths are repo-relative, including deleted files; no disk read is needed. */
export async function copyChangePath({ cwd, repo, path, relative = false, onNotify, t }) {
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

export function CopyChangePathButton({ path, onCopyPath, t }) {
	return h("button", {
		type: "button", className: "cet-act cet-copy-path", title: t("changes.copyPath"),
		"aria-label": `${t("changes.copyPath")} · ${path}`,
		onClick: (event) => { event.stopPropagation(); void onCopyPath?.(path, event.altKey); },
	}, h("svg", { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.3, "aria-hidden": true },
		h("rect", { x: 5, y: 5, width: 8, height: 9, rx: 1.2 }), h("path", { d: "M10 4V2H2v9h2" })));
}
