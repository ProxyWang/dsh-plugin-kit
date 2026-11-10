/**
 * Shared host-side tunables: API prefix, byte/count caps, LSP timeouts, the
 * git log cap, and the directory-skip set.
 *
 * Leaf module (no imports). WALK_SKIP lives here rather than in the search
 * module because the git repo discovery and the file walker/search both
 * consult it; leaving it in either consumer would create a git<->search
 * import cycle.
 */

export const API_PREFIX = "/code-explorer/api";
export const READ_CAP = 4 * 1024 * 1024;
export const WRITE_CAP = 8 * 1024 * 1024;
export const DIFF_CAP = 2 * 1024 * 1024;
export const BODY_CAP = 1 * 1024 * 1024;
export const LIST_CAP = 4000;
export const LSP_TIMEOUT_MS = 30000;
export const LSP_FIRST_TIMEOUT_MS = 90000;
export const LSP_IDLE_MS = 5 * 60 * 1000;
export const GIT_LOG_CAP = 200;

export const WALK_SKIP = new Set([".git", "node_modules", "dist", "build", "vendor", "target", "out", "__pycache__", ".venv", "venv", "coverage", ".next", ".cache", ".idea"]);
