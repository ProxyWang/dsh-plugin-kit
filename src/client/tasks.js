/* ---------------- task runner helpers (pure) ---------------- */

/**
 * Failure locators for the output panel: test runners print positions in a
 * handful of well-known shapes, and turning them into clickable jumps is the
 * difference between "an output pane" and a workflow. Deliberately
 * conservative: only real file extensions, only line numbers.
 */
const FAILURE_PATTERNS = [
	// go test: "\tmain_test.go:42:7: message" / "\t./x_test.go:3:"
	/^\t(?:\.\/)?([\w./@+\-[\]]+\.go):(\d+)(?::(\d+))?:/,
	// tsc: "src/x.ts(12,5): error TS2304: ..."
	/^(?:[\s>*-]*)([\w./@+\-[\]]+\.(?:ts|tsx|js|jsx|mjs|cjs))\((\d+),(\d+)\):/,
	// jest/eslint-ish: "  3:7  error  ...  src/x.js" — too loose; skip.
	// plain "file.ts:12:5: message" (eslint, some scripts)
	/^(?:[\s>*-]*)([\w./@+\-[\]]+\.(?:ts|tsx|js|jsx|mjs|cjs)):(\d+):(\d+)?[:-]/,
	// python: 'File "tests/x.py", line 12, in test_y'
	/^\s*File "([\w./@+\-[\]\s]+\.py)", line (\d+),/,
	// rustc: " --> src/x.rs:12:5"
	/^\s*--> ([\w./@+\-[\]]+\.rs):(\d+)(?::(\d+))?/,
];

export function failureAt(text) {
	for (const re of FAILURE_PATTERNS) {
		const m = re.exec(text);
		if (m) return { path: m[1].trim().replace(/^\.\//, ""), line: Number(m[2]) || 1, col: Number(m[3]) || 1 };
	}
	return null;
}

/**
 * Fold poll snapshots into the view model: `reset` replaces the retained
 * window (the runner dropped the head), otherwise chunks append. Returns the
 * next state plus nothing else — component code owns rendering.
 */
export function foldTaskOutput(state, snap) {
	const chunks = snap.reset ? snap.chunks : [...state.chunks, ...snap.chunks];
	return { chunks, lineCount: countLines(chunks), seq: snap.seq, done: snap.done === true, code: snap.code, dropped: snap.dropped === true, reset: snap.reset === true };
}

export function countLines(chunks) {
	let n = 0;
	for (const c of chunks) for (let i = 0; i < c.text.length; i++) if (c.text.charCodeAt(i) === 10) n++;
	return n + 1;
}
