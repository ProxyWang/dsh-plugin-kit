/* Each async listing belongs to one workspace generation and directory request. */
export function createDirectoryRequests() {
	let generation = 0;
	const latest = new Map();
	return {
		reset() { generation++; latest.clear(); },
		begin(path) {
			const epoch = generation;
			const token = {};
			latest.set(path, token);
			return () => epoch === generation && latest.get(path) === token;
		},
	};
}

/** fs.list names are direct basenames. One entry per basename, regardless of type. */
export function uniqueDirectoryEntries(entries) {
	const seen = new Set();
	return (Array.isArray(entries) ? entries : []).filter((entry) => {
		if (!entry || typeof entry.name !== "string" || !entry.name || entry.name === "." || entry.name === ".." || entry.name.includes("/") || entry.name.includes("\0") || !["file", "directory"].includes(entry.type) || seen.has(entry.name)) return false;
		seen.add(entry.name); return true;
	});
}
