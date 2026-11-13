import { api } from "./api.js";

/** Shared profile-wide UI mirror. Host owns durability and mutation ordering. */
export function createBrowserDataModel(call = api) {
	let snapshot = { data: null, error: "", busy: false };
	const listeners = new Set();
	let refresh;
	const publish = (patch) => { snapshot = { ...snapshot, ...patch }; for (const listener of listeners) listener(); };
	const accept = (data) => { if (!snapshot.data || data.revision >= snapshot.data.revision) publish({ data, error: "" }); };
	return {
		getSnapshot: () => snapshot,
		subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
		load() {
			if (refresh) return refresh;
			publish({ busy: true });
			refresh = call("browser.data", { action: "list" }).then((result) => {
				if (!result.ok) throw Error(result.error);
				accept(result.value);
			}).catch((error) => publish({ error: error.message })).finally(() => { refresh = undefined; publish({ busy: false }); });
			return refresh;
		},
		async change(request) {
			const result = await call("browser.data", { ...request, baseRevision: snapshot.data?.revision });
			if (!result.ok) { if (result.error === "browser.conflict") await this.load(); throw Error(result.error); }
			accept(result.value);
		},
	};
}
