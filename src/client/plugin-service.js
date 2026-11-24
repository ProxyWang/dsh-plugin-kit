/* ---------------- ctx.pluginKit: let other plugins drive the workspace tab ----------------
 *
 * One small service instead of a second file-viewer pipeline: an integration
 * can open a file, jump to a line, or open one file's diff in the Code tab.
 * Everything else (navigation stack, dirty drafts, LSP) stays owned by the
 * tab, so a caller cannot corrupt the editor state.
 *
 * The service is versioned; adding a method is a minor bump, changing one is
 * a major bump. `registerViewer` is intentionally absent until the panel owns
 * a viewer pipeline (today the tab itself decides image/markdown/text).
 */

import { emitAction } from "./actions.js";

export const PLUGIN_KIT_VERSION = 1;

function assertPath(method, path) {
	if (typeof path !== "string" || path.trim() === "") {
		throw new TypeError(`pluginKit.${method}(path): path must be a non-empty string`);
	}
}

/**
 * Build the service.
 * @param options - `openWorkspace` opens/raises the Code tab; `emit` is the
 *   action sink (injectable for tests); `delayMs` gives the tab time to become
 *   visible before the request lands.
 */
export function createPluginKitService({ openWorkspace, emit = emitAction, delayMs = 120 }) {
	const request = (action) => {
		openWorkspace();
		setTimeout(() => emit(action), delayMs);
		return true;
	};
	return {
		version: PLUGIN_KIT_VERSION,
		/** Open `path` in the Code tab, optionally at a 1-based line/column. */
		openFile(path, options = {}) {
			assertPath("openFile", path);
			return request({ type: "open-file", path, line: options.line, column: options.column });
		},
		/** Alias of openFile for callers that think in "navigate to a location". */
		navigate(target = {}) {
			assertPath("navigate", target.path);
			return request({ type: "open-file", path: target.path, line: target.line, column: target.column });
		},
		/** Open one file's diff (scope: working | staged | branch | commit). */
		openDiff(path, options = {}) {
			assertPath("openDiff", path);
			return request({ type: "open-diff", path, scope: options.scope ?? "working" });
		},
	};
}
