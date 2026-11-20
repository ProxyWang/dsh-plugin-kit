/** gRPC client over Node's built-in HTTP/2 (no protobuf/grpc runtime deps).
 *
 * gRPC is ordinary HTTP/2 with a framing convention, so one request is:
 *   POST /<package.Service>/<Method>
 *   content-type: application/grpc, te: trailers, plus caller metadata
 *   body: [1 byte compressed=0][4 byte big-endian length][protobuf message]…
 * and the reply is the same framing, with `grpc-status` in the trailers.
 *
 * Supported: unary, server-streaming (messages collected up to a cap) and
 * client-streaming / bidi (the caller's message list is written, then the
 * stream half-closes). TLS is used for `grpcs://`; `grpc://` is plaintext
 * HTTP/2.
 */

import { connect as http2Connect } from "node:http2";
import { decodeMessage, encodeMessage } from "./protobuf.js";

/** Messages one server-streaming call may collect before it stops reading. */
const STREAM_CAP = 500;
/** Bytes one collected stream may hold before it is truncated. */
const STREAM_BYTES = 8 * 1024 * 1024;

/** Map a gRPC status code to its canonical name (for the UI). */
export const STATUS_NAMES = {
	0: "OK",
	1: "CANCELLED",
	2: "UNKNOWN",
	3: "INVALID_ARGUMENT",
	4: "DEADLINE_EXCEEDED",
	5: "NOT_FOUND",
	6: "ALREADY_EXISTS",
	7: "PERMISSION_DENIED",
	8: "RESOURCE_EXHAUSTED",
	9: "FAILED_PRECONDITION",
	10: "ABORTED",
	11: "OUT_OF_RANGE",
	12: "UNIMPLEMENTED",
	13: "INTERNAL",
	14: "UNAVAILABLE",
	15: "DATA_LOSS",
	16: "UNAUTHENTICATED",
};

/**
 * Metadata → HTTP/2 request headers.
 *
 * Keys are lowercased and pseudo-headers dropped. A `-bin` key must carry
 * base64 on the wire; a value that is already encoded is passed through when it
 * is written as `base64:<payload>`, so copying one from another client does not
 * encode it a second time.
 *
 * @param metadata - `{name: value}` as the panel sends it
 * @returns headers ready for `session.request`
 */
export function metadataHeaders(metadata) {
	const headers = {};
	for (const [name, value] of Object.entries(metadata ?? {})) {
		const key = String(name).toLowerCase().trim();
		if (key === "" || key.startsWith(":")) continue;
		const raw = String(value);
		headers[key] = !key.endsWith("-bin")
			? raw
			: raw.startsWith("base64:")
				? raw.slice("base64:".length)
				: Buffer.from(raw).toString("base64");
	}
	return headers;
}

/** Split `grpc://host:port` / `grpcs://host:port/prefix` into its parts. */
export function parseTarget(url) {
	const raw = String(url ?? "").trim();
	if (raw === "") throw new Error("a server address is required");
	const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)([^?#]*)/i.exec(raw);
	if (!match) throw new Error(`not a gRPC address: ${raw}`);
	const scheme = match[1].toLowerCase();
	if (scheme !== "grpc" && scheme !== "grpcs") throw new Error("the address must start with grpc:// or grpcs://");
	return { secure: scheme === "grpcs", authority: match[2], prefix: match[3].replace(/\/$/, "") };
}

/** Frame one protobuf payload the gRPC way. */
function frame(payload) {
	const header = Buffer.alloc(5);
	header[0] = 0; // not compressed
	header.writeUInt32BE(payload.length, 1);
	return Buffer.concat([header, payload]);
}

/** Pull complete frames out of a growing buffer; returns the remainder. */
function drainFrames(buffer, onMessage) {
	let rest = buffer;
	while (rest.length >= 5) {
		const length = rest.readUInt32BE(1);
		if (rest.length < 5 + length) break;
		const compressed = rest[0] === 1;
		const payload = rest.subarray(5, 5 + length);
		rest = rest.subarray(5 + length);
		onMessage(payload, compressed);
	}
	return rest;
}

/**
 * Perform one gRPC call.
 *
 * @param options - `{ url, path, schema, requestType, responseType, messages,
 *   metadata, timeoutMs, plaintext }`
 * @returns `{ status, statusName, message, messages, headers, trailers, ms, truncated }`
 */
export async function grpcCall(options) {
	const started = Date.now();
	const target = parseTarget(options.url);
	const path = String(options.path ?? "");
	if (!path.startsWith("/")) throw new Error("the method path must look like /package.Service/Method");
	const schema = options.schema ?? { messages: {}, enums: {} };
	const requestType = String(options.requestType ?? "");
	const responseType = String(options.responseType ?? "");
	const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 30_000;

	const authority = target.authority;
	const origin = `${target.secure ? "https" : "http"}://${authority}`;
	const session = http2Connect(origin, options.secure === false ? {} : {
		rejectUnauthorized: options.rejectUnauthorized !== false,
	});

	// A refused/failed connection surfaces as a session `error`, not a stream
	// one: without this listener the process would crash on ECONNREFUSED.
	let sessionFailure;
	const failed = new Promise((_, reject) => { sessionFailure = reject; });
	session.once("error", (error) => sessionFailure(error));

	const cleanup = () => {
		try { session.close(); } catch { /* already gone */ }
		try { session.destroy(); } catch { /* already gone */ }
	};

	try {
		const headers = {
			":method": "POST",
			":path": `${target.prefix}${path}`,
			"content-type": "application/grpc",
			te: "trailers",
			"grpc-timeout": `${Math.max(1, Math.round(timeoutMs))}m`,
			"user-agent": "dsh-plugin-kit/2.0",
		};
		Object.assign(headers, metadataHeaders(options.metadata ?? {}));

		const request = session.request(headers);
		let responseHeaders = {};
		const trailers = {};
		let pending = Buffer.alloc(0);
		const decoded = [];
		let truncated = false;
		let bytes = 0;

		let stopTimer = () => {};
		const done = new Promise((resolvePromise, rejectPromise) => {
			const timer = setTimeout(() => {
				try { request.close(8); } catch { /* ignore */ }
				rejectPromise(new Error(`the call timed out after ${timeoutMs} ms`));
			}, timeoutMs + 2000);

			request.on("response", (incoming) => {
				responseHeaders = incoming;
			});
			request.on("trailers", (incoming) => {
				Object.assign(trailers, incoming);
			});
			request.on("data", (chunk) => {
				bytes += chunk.length;
				if (bytes > STREAM_BYTES) { truncated = true; request.close(8); return; }
				pending = drainFrames(Buffer.concat([pending, chunk]), (payload) => {
					if (decoded.length >= STREAM_CAP) { truncated = true; return; }
					if (!responseType || !schema.messages?.[responseType]) {
						decoded.push({ _hex: payload.toString("hex") });
						return;
					}
					try {
						decoded.push(decodeMessage(schema, responseType, payload));
					} catch (error) {
						decoded.push({ _error: String(error?.message ?? error), _hex: payload.toString("hex") });
					}
				});
			});
			request.on("end", () => { clearTimeout(timer); resolvePromise(); });
			request.on("error", (error) => { clearTimeout(timer); rejectPromise(error); });
			request.on("aborted", () => { clearTimeout(timer); rejectPromise(new Error("the call was aborted")); });
			// A refused connection rejects through `failed`, which never touches
			// this timer: without an explicit stop it would keep the host's event
			// loop alive for the whole timeout after every failed call.
			stopTimer = () => clearTimeout(timer);
		});

		const list = Array.isArray(options.messages) ? options.messages : [];
		for (const message of list) {
			const payload = requestType && schema.messages?.[requestType]
				? encodeMessage(schema, requestType, message ?? {})
				: Buffer.from(JSON.stringify(message ?? {}), "utf8");
			request.write(frame(payload));
		}
		// Every supported shape closes the client side: a unary call sends one
		// message, and a client-streaming call sends its whole list then ends.
		request.end();

		try {
			await Promise.race([done, failed]);
		} catch (error) {
			stopTimer();
			throw error;
		}

		const status = Number(trailers["grpc-status"] ?? responseHeaders["grpc-status"] ?? 0);
		const message = String(trailers["grpc-message"] ?? responseHeaders["grpc-message"] ?? "");
		return {
			status,
			statusName: STATUS_NAMES[status] ?? `STATUS_${status}`,
			message: decodeURIComponent(message),
			// Unary calls answer one message; the array shape keeps streaming uniform.
			messages: decoded,
			headers: headerMap(responseHeaders),
			trailers: headerMap(trailers),
			ms: Date.now() - started,
			truncated,
		};
	} finally {
		cleanup();
	}
}

/** Flatten HTTP/2 headers into `{name: value}` (arrays joined). */
function headerMap(headers) {
	const out = {};
	for (const [name, value] of Object.entries(headers ?? {})) {
		if (name.startsWith(":")) continue;
		out[name] = Array.isArray(value) ? value.join(", ") : String(value ?? "");
	}
	return out;
}