/* ---------------- go / generic tokenizer ---------------- */

const KEYWORDS = {
	go: new Set(
		"break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false iota make len cap new append copy close delete panic recover".split(" "),
	),
	js: new Set(
		"async await break case catch class const continue debugger default delete do else export extends finally for from function get if import instanceof let new of return set static super switch this throw try typeof var void while with yield null undefined true false".split(" "),
	),
	py: new Set(
		"and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield None True False self".split(" "),
	),
};
const BLOCK_TYPES = new Set(["string", "error", "int", "int64", "float64", "bool", "byte", "rune", "any", "interface", "struct", "map", "chan", "func", "uint", "uint64", "rune"]);

export function langFor(path) {
	if (path.endsWith(".go")) return "go";
	if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)) return "js";
	if (/\.(py)$/.test(path)) return "py";
	return "text";
}

/** Per-line entry state: 0 clean, 1 inside /*-style block comment. */
export function buildLineStates(lines) {
	const states = new Uint8Array(lines.length);
	let state = 0;
	for (let i = 0; i < lines.length; i++) {
		states[i] = state;
		const line = lines[i];
		let j = 0;
		if (state) {
			const end = line.indexOf("*/");
			if (end < 0) continue;
			state = 0;
			j = end + 2;
		}
		let inString = 0;
		for (; j < line.length; j++) {
			const c = line.charCodeAt(j);
			if (inString) {
				if (c === 92) j++;
				else if (c === inString) inString = 0;
				continue;
			}
			if (c === 34 || c === 39 || c === 96) inString = c;
			else if (c === 47 && line.charCodeAt(j + 1) === 42) {
				const end = line.indexOf("*/", j + 2);
				if (end < 0) {
					state = 1;
					break;
				}
				j = end + 1;
			} else if (c === 47 && line.charCodeAt(j + 1) === 47) break;
		}
		if (inString === 96) inString = 0; // raw strings close at EOL for the state guess
	}
	return states;
}

const TOKEN_RE = /(\/\*.*?(?:\*\/|$)|\/\/.*$|"(?:[^"\\\n]|\\.)*(?:"|$)|'(?:\\.|[^'\\\n])*'?|`[^`\n]*`?|0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*)/g;

export function tokenizeLine(text, lang, entryState) {
	if (lang === "text") return [{ cls: "", s: text }];
	const runs = [];
	let rest = text;
	let consumed = 0;
	if (entryState === 1) {
		const end = rest.indexOf("*/");
		if (end < 0) return [{ cls: "ce-com", s: rest }];
		runs.push({ cls: "ce-com", s: rest.slice(0, end + 2) });
		consumed = end + 2;
		rest = rest.slice(end + 2);
	}
	const kws = KEYWORDS[lang] ?? KEYWORDS.js;
	let match;
	let index = 0;
	TOKEN_RE.lastIndex = 0;
	const pushPlain = (chunk, base) => {
		if (!chunk) return;
		let m;
		const ident = /[A-Za-z_][A-Za-z0-9_]*/g;
		let last = 0;
		while ((m = ident.exec(chunk))) {
			if (m.index > last) runs.push({ cls: "", s: chunk.slice(last, m.index) });
			const word = m[0];
			const cls = kws.has(word) ? "ce-kw" : lang === "go" && (BLOCK_TYPES.has(word) || /^[A-Z]/.test(word)) ? "ce-type" : "ce-id";
			runs.push({ cls, s: word, word, startCol: consumed + base + m.index + 1 });
			last = m.index + word.length;
		}
		if (last < chunk.length) runs.push({ cls: "", s: chunk.slice(last) });
	};
	while ((match = TOKEN_RE.exec(rest))) {
		if (match.index > index) pushPlain(rest.slice(index, match.index), index);
		const token = match[0];
		index = match.index + token.length;
		if (token.startsWith("//") || token.startsWith("/*")) runs.push({ cls: "ce-com", s: token });
		else if (/^["'`]/.test(token)) runs.push({ cls: "ce-str", s: token });
		else if (/^\d/.test(token)) runs.push({ cls: "ce-num", s: token });
		else if (/^[A-Za-z_]/.test(token)) {
			const cls = kws.has(token) ? "ce-kw" : lang === "go" && (BLOCK_TYPES.has(token) || /^[A-Z]/.test(token)) ? "ce-type" : "ce-id";
			runs.push({ cls, s: token, word: token, startCol: consumed + match.index + 1 });
		} else runs.push({ cls: "", s: token });
	}
	pushPlain(rest.slice(index), index);
	return runs;
}

export function wordAt(text, col) {
	const ident = /[A-Za-z_][A-Za-z0-9_]*/g;
	let match;
	while ((match = ident.exec(text))) {
		const start = match.index + 1;
		const end = start + match[0].length - 1;
		if (col >= start && col <= end + 1) return { word: match[0], col: start };
	}
	return null;
}
