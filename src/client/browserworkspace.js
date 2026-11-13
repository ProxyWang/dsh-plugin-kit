/* Match DSH's authoritative Workspace membership, not Session working-directory state. */
export async function resolveBrowserWorkspace(source, sessionId, signal) {
	if (!source) throw Error("Browser workspace service is unavailable");
	signal.throwIfAborted();
	if (source.getSnapshot().phase !== "ready") {
		await new Promise((resolve, reject) => {
			let stop = () => {};
			const abort = () => { stop(); reject(signal.reason ?? Error("Aborted")); };
			const check = () => {
				if (source.getSnapshot().phase !== "ready") return;
				stop(); signal.removeEventListener("abort", abort); resolve();
			};
			stop = source.subscribe(check);
			signal.addEventListener("abort", abort, { once: true });
			if (signal.aborted) abort(); else check();
		});
	}
	signal.throwIfAborted();
	const workspace = source.getSnapshot().items.find((item) => item.sessionIds.includes(sessionId));
	return workspace ? `cwd:${workspace.path}` : `session:${sessionId}`;
}
