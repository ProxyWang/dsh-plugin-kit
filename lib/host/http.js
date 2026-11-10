/** HTTP plumbing for the private JSON API: bounded body reader + JSON responder. */

import { BODY_CAP } from "./constants.js";

function respondJson(res, status, payload) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
	return new Promise((resolvePromise, rejectPromise) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			size += buf.length;
			if (size > BODY_CAP) {
				rejectPromise(new Error("request body too large"));
				req.destroy();
				return;
			}
			chunks.push(buf);
		});
		req.on("end", () => {
			try {
				const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				if (parsed === null || typeof parsed !== "object") throw new Error("body must be a JSON object");
				resolvePromise(parsed);
			} catch (error) {
				rejectPromise(error);
			}
		});
		req.on("error", rejectPromise);
	});
}

export { respondJson, readJsonBody };
