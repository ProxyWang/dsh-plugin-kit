/**
 * HTTP plumbing for the private JSON API: bounded body reader, JSON responder,
 * and the shared success/failure envelopes.
 *
 * A success is `{ ok: true, value }`. A failure is `{ ok: false, error, code }`
 * with the HTTP status taken from the code (see errors.js); the `error` string
 * stays for clients that predate codes. Once headers are committed the socket
 * is destroyed instead of attempting a second write.
 */

import { ApiError, toApiError } from "./errors.js";
import { BODY_CAP } from "./constants.js";

function respondJson(res, status, payload) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(payload));
}

function sendOk(res, value) {
	respondJson(res, 200, { ok: true, value });
}

function sendError(res, error) {
	const mapped = toApiError(error);
	if (res.headersSent) {
		try {
			res.destroy();
		} catch {
			/* socket already gone */
		}
		return;
	}
	const payload = { ok: false, error: mapped.message, code: mapped.code };
	if (mapped.meta !== undefined) payload.meta = mapped.meta;
	respondJson(res, mapped.status, payload);
}

function readJsonBody(req) {
	return new Promise((resolvePromise, rejectPromise) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			size += buf.length;
			if (size > BODY_CAP) {
				rejectPromise(new ApiError("too-large", "request body too large"));
				req.destroy();
				return;
			}
			chunks.push(buf);
		});
		req.on("end", () => {
			try {
				const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				if (parsed === null || typeof parsed !== "object") throw new ApiError("bad-request", "body must be a JSON object");
				resolvePromise(parsed);
			} catch (error) {
				rejectPromise(error instanceof ApiError ? error : new ApiError("bad-request", String(error?.message ?? error)));
			}
		});
		req.on("error", rejectPromise);
	});
}

export { respondJson, readJsonBody, sendOk, sendError };
