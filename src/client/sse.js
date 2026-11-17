/* ---------------- server-sent events view model (pure) ---------------- */

/**
 * Incremental SSE frame parser per the WHATWG event-stream rules, minus the
 * reconnection machinery (the panel only displays). Feed raw text deltas;
 * get back decoded events plus the retained tail for the next call.
 *
 * Frames are separated by a blank line; `data:` lines join with \n; a line
 * `data:` with empty value still counts; other fields: event / id / retry.
 * Comment lines (":...") are ignored, \r and \r\n tolerated.
 */
export function parseSse(state, text) {
	const buf = state.buf + text;
	const events = [];
	let rest = buf;
	for (;;) {
		const idx = rest.search(/\r?\n\r?\n/);
		if (idx === -1) break;
		const frame = rest.slice(0, idx);
		const skip = rest.slice(idx).match(/^\r?\n\r?\n/)?.[0]?.length ?? 2;
		rest = rest.slice(idx + skip);
		let event = "message";
		let id = state.lastId;
		let retry;
		const dataLines = [];
		for (const rawLine of frame.split(/\r?\n/)) {
			const line = rawLine;
			if (line === "" || line.startsWith(":")) continue;
			const colon = line.indexOf(":");
			const field = colon === -1 ? line : line.slice(0, colon);
			let value = colon === -1 ? "" : line.slice(colon + 1);
			if (value.startsWith(" ")) value = value.slice(1);
			if (field === "data") dataLines.push(value);
			else if (field === "event") event = value;
			else if (field === "id") id = value;
			else if (field === "retry" && /^\d+$/.test(value)) retry = Number(value);
		}
		if (dataLines.length === 0 && event === "message" && retry === void 0) continue; // comment-only frame
		if (dataLines.length > 0) {
			events.push({ event, data: dataLines.join("\n"), id, retry });
		} else {
			events.push({ event, data: "", id, retry });
		}
		state.lastId = id;
	}
	return { events, state: { buf: rest, lastId: state.lastId } };
}

export function emptySseState() {
	return { buf: "", lastId: "" };
}

/**
 * Fold one stream-poll snapshot into the panel state: byte cursor over
 * retained chunks, then the incremental SSE parse. `reset` (head evicted)
 * restarts the parse buffer from the retained tail.
 */
export function foldStream(state, snap) {
	const raw = snap.reset ? "" : state.raw;
	const texts = (snap.chunks ?? []).map((c) => c.text ?? "");
	const nextRaw = (snap.reset ? "" : raw) + texts.join("");
	const parsed = parseSse(snap.reset ? emptySseState() : state.sse ?? emptySseState(), texts.join(""));
	const events = snap.reset ? parsed.events : [...state.events, ...parsed.events];
	return {
		raw: nextRaw,
		sse: parsed.state,
		events: events.slice(-2000),
		seq: snap.seq,
		baseSeq: snap.baseSeq ?? 0,
		done: snap.done === true,
		error: snap.error ?? "",
		dropped: snap.dropped === true,
	};
}

/** Pretty one event for the list: try JSON once for json-ish payloads. */
export function sseEventLabel(ev) {
	const first = String(ev.data ?? "").split("\n")[0];
	return first.length > 120 ? `${first.slice(0, 119)}…` : first;
}
