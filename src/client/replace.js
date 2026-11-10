/* ---------------- workspace search & replace (pure logic) ----------------
 *
 * Replacement mirrors the host search semantics: smart-case (an all-lowercase
 * query matches case-insensitively), optional regex mode and whole-word
 * boundaries. Literal queries are regex-escaped and replaced via a function
 * so "$" sequences in the replacement stay literal; regex mode passes the
 * replacement string through, enabling $1/$& capture references.
 */

/** Escape a literal string for use inside a RegExp. */
export function escapeReLocal(s) {
	return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the replacement RegExp for a workspace query (global, multiline).
 * Returns null on empty query or invalid regex (callers skip replacing).
 */
export function buildReplaceRe(query, opts) {
	if (!query) return null;
	const insensitive = String(query) === String(query).toLowerCase();
	let src = String(query);
	if (!opts?.regex) src = escapeReLocal(src);
	if (opts?.words) src = `\\b(?:${src})\\b`;
	try {
		return new RegExp(src, insensitive ? "gmi" : "gm");
	} catch {
		return null;
	}
}

/**
 * Replace every match in `text`. Returns {text, count}; count 0 means no
 * change (callers skip the write). Literal mode replaces via a function so
 * `$` sequences in the replacement stay literal; regex mode passes the
 * replacement string through, so $1/$& capture references work.
 */
export function replaceInText(text, query, replaceWith, opts) {
	const re = buildReplaceRe(query, opts);
	if (!re || typeof text !== "string") return { text, count: 0 };
	const replacement = String(replaceWith ?? "");
	if (opts?.regex) {
		const found = text.match(re);
		const count = found ? found.length : 0;
		if (count === 0) return { text, count: 0 };
		return { text: text.replace(re, replacement), count };
	}
	let count = 0;
	const out = text.replace(re, () => {
		count++;
		return replacement;
	});
	return { text: out, count };
}
