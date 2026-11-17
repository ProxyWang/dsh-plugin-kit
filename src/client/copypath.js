import { h, useEffect, useRef, useState } from "./react.js";
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

const CopyGlyph = () => h("svg", { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.3, "aria-hidden": true },
	h("rect", { x: 5, y: 5, width: 8, height: 9, rx: 1.2 }), h("path", { d: "M10 4V2H2v9h2" }));
const CheckGlyph = () => h("svg", { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
	h("path", { d: "M3 8.5 6.5 12 13 4.5" }));

/**
 * Copy-path row action. The clipboard result flips the glyph to a check for
 * ~1.4 s so success is visible at the click site — the status-bar notice alone
 * was easy to miss next to the tree rows.
 */
export function CopyChangePathButton({ path, onCopyPath, t }) {
	const [copied, setCopied] = useState(false);
	const timer = useRef(null);
	useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
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
		},
	}, copied ? h(CheckGlyph) : h(CopyGlyph));
}
