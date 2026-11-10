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
