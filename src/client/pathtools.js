/* ---------------- shared helpers: relative paths, absolute join, compact time ---------------- */

/** Compact author-time for the blame column: <1d / Nd / Nmo / Ny. */
export function relTime(epoch) {
	const days = Math.floor((Date.now() / 1000 - (epoch || 0)) / 86400);
	if (days <= 0) return "<1d";
	if (days < 30) return `${days}d`;
	const months = Math.floor(days / 30);
	if (months < 18) return `${months}mo`;
	return `${Math.floor(months / 12)}y`;
}

export function RelPath(cwd, path) {
	if (typeof path !== "string") return "";
	if (cwd && path.startsWith(cwd.endsWith("/") ? cwd : `${cwd}/`)) return path.slice(cwd.length + (cwd.endsWith("/") ? 0 : 1));
	return path;
}

export function toAbs(cwd, path) {
	if (typeof path !== "string") return "";
	return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) ? path.replace(/\\/g, "/") : `${cwd.replace(/\/+$/, "")}/${path.replace(/\\/g, "/")}`;
}

/** Ancestor directory paths of a workspace-relative path, outermost first. "" (root) has none. */
export function ancestorDirs(path) {
	const out = [];
	const clean = String(path ?? "");
	let idx = clean.indexOf("/");
	while (idx > 0) {
		out.push(clean.slice(0, idx));
		idx = clean.indexOf("/", idx + 1);
	}
	return out;
}

/** Parent of a workspace-relative path ("" for top-level entries). */
export function parentDir(path) {
	const clean = String(path ?? "");
	const at = clean.lastIndexOf("/");
	return at > 0 ? clean.slice(0, at) : "";
}

/** Drag-and-drop guard: a path can move into dir unless it is the dir itself, inside itself, or already there. */
export function canDropInto(dragPath, targetDir) {
	const from = String(dragPath ?? "");
	const to = String(targetDir ?? "");
	if (from === "" || to === from) return false;
	if (to === parentDir(from)) return false; // same folder: no-op
	if (to === from || to.startsWith(`${from}/`)) return false; // into itself
	return true;
}
