/* ---------------- gRPC address: the scheme is a choice, not typing ----------------
 *
 * A person debugging a service knows the host and port; typing `grpc://` in
 * front of it every time is noise, and forgetting it is a failed call. The
 * field therefore shows only `host:port` and the scheme lives in a selector
 * beside it. `address` keeps the full form internally, so the call path, the
 * history and environment interpolation are unchanged.
 */

/** Schemes this panel can speak. */
export const GRPC_SCHEMES = ["grpc://", "grpcs://"];

/**
 * Split a full address into its scheme and the part the user edits.
 *
 * @param value - `grpc://host:port`, `grpcs://host:port`, or a bare `host:port`
 * @returns `{scheme, host}`; an unknown or missing scheme means plaintext gRPC
 */
export function splitAddress(value) {
	const text = String(value ?? "").trim();
	const lower = text.toLowerCase();
	for (const scheme of GRPC_SCHEMES) {
		if (lower.startsWith(scheme)) return { scheme, host: text.slice(scheme.length) };
	}
	return { scheme: "grpc://", host: text };
}

/**
 * Put a scheme back in front of a host.
 *
 * @param scheme - one of {@link GRPC_SCHEMES}
 * @param host - what the user typed; a pasted full address keeps its own scheme
 * @returns the full address, or "" when nothing was typed
 */
export function joinAddress(scheme, host) {
	const known = GRPC_SCHEMES.includes(scheme) ? scheme : "grpc://";
	const text = String(host ?? "").trim();
	if (text === "") return "";
	const inner = splitAddress(text);
	// A pasted `grpcs://…` wins over whichever scheme was selected.
	if (inner.host !== text) return `${inner.scheme}${inner.host}`;
	return `${known}${text}`;
}

/**
 * The scheme an address actually uses (also after a paste).
 *
 * @param value - any accepted address form
 * @returns `"grpc://"` or `"grpcs://"`
 */
export function schemeOf(value) {
	return splitAddress(value).scheme;
}