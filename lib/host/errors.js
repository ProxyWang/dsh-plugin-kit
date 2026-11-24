/**
 * Failure semantics for the private JSON API.
 *
 * Every failure now carries a stable machine code and an HTTP status while
 * keeping the historical `error` string, so older clients keep working:
 *
 *   { ok: false, error: "file was modified on disk; reload before saving",
 *     code: "conflict" }                                    → HTTP 409
 *
 * Codes are a closed set: unknown failures (a bug, a missing dependency) map to
 * `internal`/500 and are distinct from state or input problems the caller can
 * act on. `meta` carries structured context without changing the message.
 *
 * Leaf module: no imports, so http.js can depend on it without a cycle.
 */

const STATUS = {
	"bad-request": 400,
	forbidden: 403,
	"not-found": 404,
	"method-error": 405,
	conflict: 409,
	"too-large": 413,
	unavailable: 503,
	internal: 500,
};

/** File-system errno values the API reports as caller-facing states. */
const ERRNO = {
	ENOENT: "not-found",
	ENOTDIR: "not-found",
	EEXIST: "conflict",
	EACCES: "forbidden",
	EPERM: "forbidden",
	ENAMETOOLONG: "bad-request",
	EINVAL: "bad-request",
	EISDIR: "bad-request",
	ENOTEMPTY: "conflict",
};

class ApiError extends Error {
	constructor(code, message, meta) {
		super(message);
		this.name = "ApiError";
		this.code = code;
		this.status = STATUS[code] ?? 400;
		this.meta = meta;
	}
}

/** Map any thrown value to an ApiError; unknown throws stay internal/500. */
function toApiError(error) {
	if (error instanceof ApiError) return error;
	const errno = typeof error?.code === "string" ? ERRNO[error.code] : undefined;
	const message = String(error?.message ?? error);
	if (errno !== undefined) return new ApiError(errno, message);
	return new ApiError("internal", message);
}

export { ApiError, STATUS, toApiError };
