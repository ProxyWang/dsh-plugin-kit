/**
 * SSE / streaming response capture for api.send.
 *
 * When a response says `text/event-stream` the plain send path would buffer
 * forever (SSE never closes). Instead api.send hands the live body to this
 * module: a background pump appends decoded chunks to a bounded retained
 * window and the panel drains it with byte-cursor polls (same protocol shape
 * as the task runner). Non-SSE responses never touch this file.
 */

const STREAM_CAP = 1024 * 1024; // retained bytes per stream (tail)
const STREAM_TTL_MS = 10 * 60_000; // finished streams retained this long
const DEFAULT_WAIT_MS = 20_000;
const MAX_WAIT_MS = 29_000;

const streams = new Map(); // id → stream
let nextId = 1;

function isEventStream(headers) {
	try {
		const ctype = String(headers?.get?.("content-type") ?? "").toLowerCase();
		return ctype.includes("text/event-stream") || ctype.includes("stream");
	} catch {
		return false;
	}
}

function textOf(stream, since) {
	if (since < stream.baseSeq - 1) return { chunks: stream.chunks, reset: true };
	const chunks = [];
	let consumed = 0;
	for (const part of stream.chunks) {
		if (consumed + part.text.length <= since - stream.baseSeq) { consumed += part.text.length; continue; }
		const cut = Math.max(0, since - stream.baseSeq - consumed);
		chunks.push(cut > 0 ? { text: part.text.slice(cut) } : part);
		consumed += part.text.length;
	}
	return { chunks, reset: false };
}

function snap(stream, since, extra) {
	const { chunks, reset } = textOf(stream, since);
	return {
		id: stream.id,
		seq: stream.outSeq,
		baseSeq: stream.baseSeq,
		dropped: stream.dropped,
		done: stream.done,
		error: stream.error,
		chunks,
		reset,
		...extra,
	};
}

function wake(stream) {
	for (const waiter of [...stream.waiters]) {
		if (waiter.since < stream.baseSeq - 1 || stream.outSeq > waiter.since || stream.done) {
			stream.waiters.delete(waiter);
			waiter.cancel?.();
			waiter.resolve(snap(stream, waiter.since, {}));
		}
	}
}

function appendText(stream, text) {
	if (text === "") return;
	stream.chunks.push({ text });
	stream.outSeq += text.length;
	stream.bytes += text.length;
	while (stream.bytes > STREAM_CAP && stream.chunks.length > 1) {
		const dropped = stream.chunks.shift();
		stream.bytes -= dropped.text.length;
		stream.baseSeq += dropped.text.length;
		stream.dropped = true;
	}
	wake(stream);
}

function finish(stream, error) {
	if (stream.done) return;
	stream.done = true;
	stream.error = error ?? "";
	stream.finishedAt = Date.now();
	wake(stream);
}

/**
 * Take over a live fetch Response. `ctrl` lets stop() abort the transfer.
 * Returns the first payload for api.send's reply without waiting for any
 * particular byte — a fast empty first beat is fine, the panel keeps polling.
 */
function startStream(response, ctrl, meta) {
	trimStreams();
	const stream = {
		id: String(nextId++),
		chunks: [],
		bytes: 0,
		baseSeq: 0,
		outSeq: 0,
		dropped: false,
		done: false,
		error: "",
		waiters: new Set(),
		ctrl,
		finishedAt: null,
	};
	streams.set(stream.id, stream);
	const pump = async () => {
		try {
			const reader = typeof response.body?.getReader === "function" ? response.body.getReader() : null;
			if (!reader) {
				const whole = typeof response.text === "function" ? await response.text() : "";
				appendText(stream, whole);
				finish(stream, "");
				return;
			}
			const decoder = new TextDecoder("utf8");
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				appendText(stream, decoder.decode(value, { stream: true }));
			}
			appendText(stream, decoder.decode());
			finish(stream, "");
		} catch (error) {
			// An abort from stop() is the user closing the panel, not a fault.
			finish(stream, ctrl?.signal?.aborted ? "" : String(error?.message ?? error));
		}
	};
	void pump();
	const first = snap(stream, 0, {});
	return {
		streaming: true,
		id: stream.id,
		status: response.status,
		statusText: response.statusText,
		headers: [...response.headers.entries()],
		seq: first.seq,
		baseSeq: first.baseSeq,
		dropped: first.dropped,
		done: first.done,
		error: first.error,
		chunks: first.chunks,
		reset: first.reset,
		...meta,
	};
}

function trimStreams() {
	const now = Date.now();
	for (const [id, stream] of streams) {
		if (stream.done && now - (stream.finishedAt ?? now) > STREAM_TTL_MS && stream.waiters.size === 0) streams.delete(id);
	}
	// Evict finished ones first so the cap never clobbers live captures.
	let guard = 0;
	while (streams.size >= 8 && guard++ < 64) {
		const doneOldest = [...streams.entries()].find(([, s]) => s.done);
		if (!doneOldest) break;
		streams.delete(doneOldest[0]);
	}
	while (streams.size >= 8) {
		const oldest = streams.keys().next().value;
		const stream = streams.get(oldest);
		try {
			stream?.ctrl?.abort?.();
		} catch { /* gone */ }
		streams.delete(oldest);
	}
}

function pollStream(body, ctx) {
	const stream = streams.get(String(body.id ?? ""));
	if (!stream) return { error: "unknown stream" };
	const since = Number.isInteger(body.since) && body.since >= 0 ? body.since : 0;
	const wantWait = Math.min(Math.max(Number(body.waitMs) || DEFAULT_WAIT_MS, 1), MAX_WAIT_MS);
	if (since < stream.baseSeq - 1 || stream.outSeq > since || stream.done) return snap(stream, since, {});
	return new Promise((resolvePromise) => {
		const waiter = { since, resolve: resolvePromise, cancel: null };
		const hold = setTimeout(() => {
			if (!stream.waiters.has(waiter)) return;
			stream.waiters.delete(waiter);
			resolvePromise(snap(stream, since, { beat: true }));
		}, wantWait);
		waiter.cancel = () => clearTimeout(hold);
		if (ctx?.res && typeof ctx.res.on === "function" && ctx.res.writableFinished === false) ctx.res.on("close", () => waiter.cancel());
		stream.waiters.add(waiter);
	});
}

function stopStream(body) {
	const stream = streams.get(String(body.id ?? ""));
	if (!stream) return { error: "unknown stream" };
	try {
		stream.ctrl?.abort?.();
	} catch { /* gone */ }
	finish(stream, "");
	return { ok: true };
}

function stopAllStreams() {
	for (const stream of streams.values()) {
		try {
			stream.ctrl?.abort?.();
		} catch { /* gone */ }
		for (const waiter of [...stream.waiters]) {
			stream.waiters.delete(waiter);
			waiter.cancel?.();
			waiter.resolve(snap(stream, waiter.since, { done: true }));
		}
	}
	streams.clear();
}

export { isEventStream, startStream, pollStream, stopStream, stopAllStreams, streams };
