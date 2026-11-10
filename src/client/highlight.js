/* ---------------- syntax tokenizer ----------------
 *
 * One generic regex-driven tokenizer shared by all languages, with two regex
 * families: C-style comments (slash-star blocks and double-slash lines) and
 * hash-comment languages ("#" to end of line, with no slash comment forms —
 * a bare "http://x" in yaml must not turn into a comment). Keyword sets per
 * language; Go additionally colors built-in types and capitalized
 * identifiers as types; JSON colors property names (a string directly
 * followed by a colon) distinctly.
 */

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
	json: new Set(["true", "false", "null"]),
	yaml: new Set(["true", "false", "null"]),
	toml: new Set(["true", "false"]),
	sh: new Set(
		"if then else elif fi for while until do done case esac function select in time local export readonly declare typeset unset shift exit return source alias eval exec set trap wait true false".split(" "),
	),
	rs: new Set(
		"as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while union".split(" "),
	),
	java: new Set(
		"abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed".split(" "),
	),
	c: new Set(
		"auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while NULL true false bool".split(" "),
	),
	sql: new Set(
		"select from where insert into values update set delete create table alter drop index view join left right inner outer full cross on group by order having limit offset distinct as and or not null is in exists between like case when then else end union all primary key foreign references default constraint unique check".split(" "),
	),
	css: new Set(["important", "media", "supports", "keyframes", "import", "charset", "namespace"]),
};
const BLOCK_TYPES = new Set(["string", "error", "int", "int64", "float64", "bool", "byte", "rune", "any", "interface", "struct", "map", "chan", "func", "uint", "uint64", "rune"]);

/** Languages whose only comment form is "#" to end of line. */
const HASH_LANGS = new Set(["py", "sh", "yaml", "toml"]);

const EXT_LANG = [
	[/\.go$/, "go"],
	[/\.(ts|tsx|js|jsx|mjs|cjs)$/, "js"],
	[/\.pyi?$/, "py"],
	[/\.jsonc?$/i, "json"],
	[/\.ya?ml$/i, "yaml"],
	[/\.(sh|bash|zsh|ksh)$/, "sh"],
	[/\.toml$/i, "toml"],
	[/\.rs$/i, "rs"],
	[/\.java$/i, "java"],
	[/\.(c|h|cc|cpp|cxx|hpp)$/i, "c"],
	[/\.sql$/i, "sql"],
	[/\.css$/i, "css"],
];

export function langFor(path) {
	const p = String(path);
	for (const [re, lang] of EXT_LANG) if (re.test(p)) return lang;
	return "text";
}

/** Per-line entry state: 0 clean, 1 inside /*-style block comment. Hash-comment languages never carry state. */
export function buildLineStates(lines, lang = "") {
	const states = new Uint8Array(lines.length);
	if (HASH_LANGS.has(lang)) return states;
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

const TOKEN_RE = /\/\*.*?(?:\*\/|$)|\/\/.*$|"(?:[^"\\\n]|\\.)*(?:"|$)|'(?:\\.|[^'\\\n])*'?|`[^`\n]*`?|0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*/g;
const TOKEN_RE_HASH = /#.*$|"(?:[^"\\\n]|\\.)*(?:"|$)|'(?:\\.|[^'\\\n])*'?|`[^`\n]*`?|0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*/g;

export function tokenizeLine(text, lang, entryState) {
	if (lang === "text") return [{ cls: "", s: text }];
	const hash = HASH_LANGS.has(lang);
	const re = hash ? TOKEN_RE_HASH : TOKEN_RE;
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
	const kwClass = (word) => {
		if (kws.has(word)) return "ce-kw";
		if (lang === "sql" && kws.has(word.toLowerCase())) return "ce-kw";
		if (lang === "go" && (BLOCK_TYPES.has(word) || /^[A-Z]/.test(word))) return "ce-type";
		return "ce-id";
	};
	let match;
	let index = 0;
	re.lastIndex = 0;
	const pushPlain = (chunk, base) => {
		if (!chunk) return;
		let m;
		const ident = /[A-Za-z_][A-Za-z0-9_]*/g;
		let last = 0;
		while ((m = ident.exec(chunk))) {
			if (m.index > last) runs.push({ cls: "", s: chunk.slice(last, m.index) });
			const word = m[0];
			runs.push({ cls: kwClass(word), s: word, word, startCol: consumed + base + m.index + 1 });
			last = m.index + word.length;
		}
		if (last < chunk.length) runs.push({ cls: "", s: chunk.slice(last) });
	};
	while ((match = re.exec(rest))) {
		if (match.index > index) pushPlain(rest.slice(index, match.index), index);
		const token = match[0];
		index = match.index + token.length;
		if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("#")) runs.push({ cls: "ce-com", s: token });
		else if (/^["'`]/.test(token)) {
			// JSON property names: a string directly followed by ":".
			const cls = lang === "json" && /^\s*:/.test(rest.slice(index)) ? "ce-prop" : "ce-str";
			runs.push({ cls, s: token });
		} else if (/^\d/.test(token)) runs.push({ cls: "ce-num", s: token });
		else if (/^[A-Za-z_]/.test(token)) {
			runs.push({ cls: kwClass(token), s: token, word: token, startCol: consumed + match.index + 1 });
		} else runs.push({ cls: "", s: token });
	}
	pushPlain(rest.slice(index), index);
	re.lastIndex = 0;
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
