/* Typed internal drag payloads: never interpret arbitrary text or OS files as moves. */
import { toAbs } from "./pathtools.js";
export const FILE_DRAG_TYPE = "application/x-dsh-toolbox-file";
function safePath(path) {
	return typeof path === "string" && path.length > 0 && path.length < 16384 && !/[\0\r\n]/.test(path) && !path.replace(/\\/g, "/").split("/").some((part) => part === ".." || part === ".");
}
export function fileDragProps({ cwd, path, source = "tree", kind = "file", scope, repo, sessionId }) {
	return {
		draggable: true,
		onDragStart(event) {
			if (!safePath(path) || !cwd) { event.preventDefault(); return; }
			if (event.target?.closest?.("button,input,textarea,select") && event.target.closest("button,input,textarea,select") !== event.currentTarget && !event.target.closest(".ctp-entry-open")) { event.preventDefault(); return; }
			event.stopPropagation();
			const value = { version: 1, cwd, path, kind, source, ...(scope ? { scope } : {}), ...(repo ? { repo } : {}), ...(sessionId ? { sessionId } : {}) };
			event.dataTransfer.setData(FILE_DRAG_TYPE, JSON.stringify(value));
			event.dataTransfer.setData("text/plain", path);
			// A copy drop opens a view. A move drop is reserved for TreePanel.
			event.dataTransfer.effectAllowed = source === "tree" ? "copyMove" : "copy";
		},
	};
}
export function hasFileDrag(transfer) { return Array.from(transfer?.types ?? []).includes(FILE_DRAG_TYPE); }
export function readFileDrag(transfer, cwd, sessionId) {
	try {
		const value = JSON.parse(transfer.getData(FILE_DRAG_TYPE));
		if (value.version !== 1 || value.cwd !== cwd || ((sessionId || value.sessionId) && value.sessionId !== sessionId) || !safePath(value.path)) return null;
		if (!["tree", "changes", "tab"].includes(value.source) || !["file", "directory"].includes(value.kind)) return null;
		if (value.source === "changes" && !["working", "staged", "branch"].includes(value.scope)) return null;
		if (value.repo && (!safePath(value.repo) || (value.repo !== cwd && !value.repo.startsWith(`${cwd.replace(/\/$/, "")}/`)))) return null;
		return value;
	} catch { return null; }
}
export function dragFilePath(value) { return value.source === "changes" ? toAbs(value.repo ?? value.cwd, value.path) : value.path; }
export function reorderFileTabs(tabs, from, before) {
	if (from === before || !tabs.includes(from) || (before && !tabs.includes(before))) return tabs;
	const next = tabs.filter((path) => path !== from);
	const index = before ? next.indexOf(before) : next.length;
	next.splice(index, 0, from);
	return next;
}
