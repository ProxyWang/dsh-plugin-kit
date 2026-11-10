/* ---------------- api ---------------- */

import { API } from "./constants.js";

export async function api(route, body) {
	try {
		const res = await fetch(`${API}/${route}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body ?? {}),
		});
		const data = await res.json();
		return data && typeof data === "object" ? data : { ok: false, error: "bad response" };
	} catch (error) {
		return { ok: false, error: String(error?.message ?? error) };
	}
}
