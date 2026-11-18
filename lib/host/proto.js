/** `.proto` parser (proto3 subset, zero dependencies).
 *
 * Recognizes what a request client has to know: `syntax`, `package`, `import`,
 * `message` (including nested messages and `repeated` / `optional` / `map<>` /
 * `oneof` fields), `enum`, and `service` with its `rpc` methods (unary or
 * `stream` on either side). Comments, `reserved`, `option` and unknown blocks
 * are skipped — an unrecognized construct must never reject a file that a real
 * protoc would accept.
 *
 * The output is flat maps keyed by fully qualified name, which is exactly what
 * the wire codec (`protobuf.js`) indexes into:
 *
 *   { package, messages: { "pkg.Msg": { fields } }, enums: { "pkg.Msg.E": {...} },
 *     services: { "pkg.Svc": { methods: [ { name, request, response,
 *     clientStreaming, serverStreaming } ] } } }
 */

/** Tokenize proto source: identifiers, strings, numbers and punctuation. */
function tokenize(source) {
	const tokens = [];
	const text = String(source ?? "");
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		// Whitespace
		if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") { i++; continue; }
		// Comments
		if (ch === "/" && text[i + 1] === "/") {
			while (i < text.length && text[i] !== "\n") i++;
			continue;
		}
		if (ch === "/" && text[i + 1] === "*") {
			i += 2;
			while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
			i += 2;
			continue;
		}
		// Strings (with escapes; used by syntax/package/option values)
		if (ch === '"' || ch === "'") {
			const quote = ch;
			let value = "";
			i++;
			while (i < text.length && text[i] !== quote) {
				if (text[i] === "\\") {
					const next = text[i + 1];
					value += next === "n" ? "\n" : next === "t" ? "\t" : next;
					i += 2;
					continue;
				}
				value += text[i++];
			}
			i++;
			tokens.push({ kind: "string", value });
			continue;
		}
		// Numbers (field numbers, enum values, and option digits)
		if (/[0-9]/.test(ch)) {
			let value = "";
			while (i < text.length && /[0-9.eE+-]/.test(text[i]) && !(text[i] === "-" && value === "")) {
				// '-' only belongs to an exponent (1e-3); a leading minus is a separate token
				if (text[i] === "-" && !/[eE]/.test(value.at(-1) ?? "")) break;
				value += text[i++];
			}
			tokens.push({ kind: "number", value });
			continue;
		}
		// Identifiers / keywords (dots are separate so qualified names split cleanly)
		if (/[A-Za-z_.]/.test(ch)) {
			let value = "";
			while (i < text.length && /[A-Za-z0-9_.]/.test(text[i])) value += text[i++];
			tokens.push({ kind: "ident", value });
			continue;
		}
		// Punctuation
		tokens.push({ kind: "punct", value: ch });
		i++;
	}
	return tokens;
}

class Parser {
	constructor(tokens) {
		this.tokens = tokens;
		this.pos = 0;
	}
	peek(offset = 0) {
		return this.tokens[this.pos + offset];
	}
	next() {
		return this.tokens[this.pos++];
	}
	/** Consume the next token when it matches, else leave the cursor alone. */
	eat(value) {
		const token = this.peek();
		if (token && token.value === value) {
			this.pos++;
			return true;
		}
		return false;
	}
	expect(value) {
		const token = this.next();
		if (!token || token.value !== value) {
			throw new Error(`expected "${value}" but found ${token ? `"${token.value}"` : "end of file"}`);
		}
		return token;
	}
	/** Skip a balanced `{ ... }` block without interpreting it. */
	skipBlock() {
		this.expect("{");
		let depth = 1;
		while (depth > 0 && this.pos < this.tokens.length) {
			const token = this.next();
			if (token.value === "{") depth++;
			else if (token.value === "}") depth--;
		}
	}
	/** Skip to the end of the current statement (a `;` at depth 0). */
	skipStatement() {
		let depth = 0;
		while (this.pos < this.tokens.length) {
			const token = this.next();
			if (token.value === "{") depth++;
			else if (token.value === "}") {
				if (depth === 0) { this.pos--; return; }
				depth--;
			} else if (token.value === ";" && depth === 0) return;
		}
	}
}

/**
 * Parse proto source into a flat schema.
 *
 * @param source - `.proto` text
 * @returns {{package:string, messages:object, enums:object, services:object}}
 */
export function parseProto(source) {
	const parser = new Parser(tokenize(source));
	const schema = { package: "", messages: {}, enums: {}, services: {} };
	/** Enclosing scope stack for relative-name resolution. */
	const scope = [];

	const qualify = (name) => {
		if (!name) return name;
		if (name.startsWith(".")) return name.slice(1);
		if (name.includes(".") && schema.messages[name]) return name;
		// Try the innermost scope first, then walk outward, then the package.
		for (let i = scope.length; i >= 0; i--) {
			const candidate = [...scope.slice(0, i), name].filter(Boolean).join(".");
			if (schema.messages[candidate] || schema.enums[candidate]) return candidate;
		}
		const packaged = [schema.package, name].filter(Boolean).join(".");
		return schema.messages[packaged] || schema.enums[packaged] ? packaged : packaged;
	};

	const readFieldType = () => {
		const token = parser.next();
		if (!token) throw new Error("unexpected end of file in a field type");
		return token.value;
	};

	/** Parse one `type name = number;` field (shared by message and oneof bodies). */
	const parseField = (into) => {
		let repeated = false;
		if (parser.eat("repeated")) repeated = true;
		else if (parser.eat("optional")) repeated = false;
		else if (parser.eat("required")) repeated = false; // proto2 files still parse
		let type = readFieldType();
		let mapKey = null;
		let mapValue = null;
		if (type === "map" && parser.peek()?.value === "<") {
			parser.next();
			mapKey = readFieldType();
			parser.expect(",");
			mapValue = readFieldType();
			parser.expect(">");
			type = "message";
		}
		const nameToken = parser.next();
		if (!nameToken) throw new Error("unexpected end of file in a field name");
		const name = nameToken.value;
		parser.expect("=");
		const numberToken = parser.next();
		const number = Number(numberToken?.value);
		// Field options (`[deprecated = true]`) are skipped.
		if (parser.peek()?.value === "[") {
			while (parser.pos < parser.tokens.length && parser.next().value !== "]") { /* skip */ }
		}
		parser.eat(";");
		into[name] = {
			name,
			number,
			type: mapValue ? "message" : type,
			repeated,
			map: Boolean(mapValue),
			mapKey,
			mapValue,
		};
	};

	/** Fully qualified definition name: package + enclosing messages + this name. */
	const defName = (name) => [schema.package, ...scope, name].filter(Boolean).join(".");

	const parseEnum = (name) => {
		const fullName = defName(name);
		parser.expect("{");
		const values = {};
		while (!parser.eat("}")) {
			const token = parser.next();
			if (!token) break;
			if (token.value === "option" || token.value === "reserved") { parser.skipStatement(); continue; }
			if (parser.peek()?.value === "=") {
				parser.next();
				const numberToken = parser.next();
				const number = Number(numberToken?.value);
				values[token.value] = Number.isFinite(number) ? number : 0;
				if (parser.peek()?.value === "[") {
					while (parser.pos < parser.tokens.length && parser.next().value !== "]") { /* skip */ }
				}
				parser.eat(";");
			}
		}
		schema.enums[fullName] = { name: fullName, values };
	};

	const parseMessage = (name) => {
		const fullName = defName(name);
		scope.push(name);
		const message = { name: fullName, fields: {} };
		schema.messages[fullName] = message;
		parser.expect("{");
		while (!parser.eat("}")) {
			const token = parser.peek();
			if (!token) break;
			if (token.value === "message") { parser.next(); parseMessage(parser.next().value); continue; }
			if (token.value === "enum") { parser.next(); parseEnum(parser.next().value); continue; }
			if (token.value === "oneof") {
				parser.next();
				parser.next(); // oneof name
				parser.expect("{");
				while (!parser.eat("}")) {
					if (!parser.peek()) break;
					parseField(message.fields);
				}
				continue;
			}
			if (["option", "reserved", "extensions", "extend"].includes(token.value)) {
				parser.next();
				parser.skipStatement();
				continue;
			}
			parseField(message.fields);
		}
		scope.pop();
	};

	const parseService = (name) => {
		const fullName = defName(name);
		const methods = [];
		parser.expect("{");
		while (!parser.eat("}")) {
			const token = parser.peek();
			if (!token) break;
			if (token.value !== "rpc") { parser.next(); parser.skipStatement(); continue; }
			parser.next();
			const methodName = parser.next().value;
			parser.expect("(");
			const clientStreaming = parser.eat("stream");
			const request = parser.next().value;
			parser.expect(")");
			if (!parser.eat("returns")) parser.skipStatement();
			parser.expect("(");
			const serverStreaming = parser.eat("stream");
			const response = parser.next().value;
			parser.expect(")");
			// Method options are skipped; the method may also end with `;`.
			if (parser.peek()?.value === "{") parser.skipBlock();
			else parser.eat(";");
			methods.push({
				name: methodName,
				request: request.startsWith(".") ? request.slice(1) : request,
				response: response.startsWith(".") ? response.slice(1) : response,
				clientStreaming,
				serverStreaming,
			});
		}
		schema.services[fullName] = { name: fullName, methods };
	};

	// Top level: syntax / package / import / message / enum / service / option.
	while (parser.pos < parser.tokens.length) {
		const token = parser.next();
		if (!token) break;
		if (!token.value || token.kind === "string") continue;
		if (token.value === "syntax" || token.value === "package") {
			parser.eat("=");
			const value = parser.next();
			if (token.value === "package") schema.package = value?.value ?? "";
			parser.eat(";");
			continue;
		}
		if (token.value === "import" || token.value === "option") { parser.skipStatement(); continue; }
		if (token.value === "message") { parseMessage(parser.next().value); continue; }
		if (token.value === "enum") { parseEnum(parser.next().value); continue; }
		if (token.value === "service") { parseService(parser.next().value); continue; }
		if (token.value === "extend") { parser.next(); parser.skipBlock(); continue; }
	}
	// Resolve request/response names now that every message exists.
	for (const service of Object.values(schema.services)) {
		for (const method of service.methods) {
			method.request = qualify(method.request);
			method.response = qualify(method.response);
		}
	}
	// Resolve field type names too (they may be relative to their own scope).
	for (const [fullName, message] of Object.entries(schema.messages)) {
		const parts = fullName.split(".");
		for (const field of Object.values(message.fields)) {
			if (!field.type || field.type in schema.enums) continue;
			// The message itself is the innermost scope: a nested type is
			// referenced by its short name from a sibling field.
			field.type = resolveFieldType(schema, field.type, parts);
		}
	}
	return schema;
}

/** Resolve one field type against the enclosing scopes, then the package root. */
function resolveFieldType(schema, type, scopes) {
	if (!type) return type;
	if (type.startsWith(".")) return type.slice(1);
	if (schema.messages[type] || schema.enums[type]) return type;
	for (let i = scopes.length; i >= 0; i--) {
		const candidate = [...scopes.slice(0, i), type].filter(Boolean).join(".");
		if (schema.messages[candidate] || schema.enums[candidate]) return candidate;
	}
	// A well-known type (google.protobuf.*) keeps its literal name; the codec
	// then reports it as unknown rather than silently guessing.
	return type;
}

/**
 * Resolve field types across a MERGED schema (several files, one map).
 *
 * `parseProto` resolves names inside its own file only, so a field whose type
 * is declared in an imported file stays a short name. This pass re-resolves
 * every remaining field against the whole message set: the enclosing scopes
 * first (the normal case), then a unique short-name match anywhere (the
 * cross-package import case). Ambiguous short names are left alone rather than
 * guessed, so a wrong pick can never silently encode the wrong message.
 *
 * @param schema - merged schema, mutated in place
 * @returns the same schema
 */
export function resolveSchemaTypes(schema) {
	const messages = schema.messages ?? {};
	const enums = schema.enums ?? {};
	const known = (name) => Boolean(messages[name] || enums[name]);
	const shortIndex = new Map();
	for (const name of [...Object.keys(messages), ...Object.keys(enums)]) {
		const short = name.split(".").pop();
		if (!shortIndex.has(short)) shortIndex.set(short, []);
		shortIndex.get(short).push(name);
	}
	const resolve = (type, scopes) => {
		if (!type || type in messages || type in enums) return type;
		if (isScalarName(type)) return type;
		if (type.startsWith(".")) return type.slice(1);
		for (let i = scopes.length; i >= 0; i--) {
			const candidate = [...scopes.slice(0, i), type].filter(Boolean).join(".");
			if (known(candidate)) return candidate;
		}
		const matches = shortIndex.get(type) ?? [];
		return matches.length === 1 ? matches[0] : type;
	};
	for (const [fullName, message] of Object.entries(messages)) {
		const scopes = fullName.split(".");
		for (const field of Object.values(message.fields ?? {})) {
			field.type = resolve(field.type, scopes);
			if (field.map) {
				field.mapKey = resolve(field.mapKey, scopes);
				field.mapValue = resolve(field.mapValue, scopes);
			}
		}
	}
	for (const service of Object.values(schema.services ?? {})) {
		for (const method of service.methods) {
			method.request = resolve(method.request, []);
			method.response = resolve(method.response, []);
		}
	}
	return schema;
}

const SCALAR_NAMES = new Set([
	"double", "float", "int32", "int64", "uint32", "uint64", "sint32", "sint64",
	"fixed32", "fixed64", "sfixed32", "sfixed64", "bool", "string", "bytes",
]);

function isScalarName(type) {
	return SCALAR_NAMES.has(type);
}

/** Every service with its methods, for the client's method picker. */
export function listMethods(schema) {
	const out = [];
	for (const [serviceName, service] of Object.entries(schema.services ?? {})) {
		for (const method of service.methods) {
			out.push({
				service: serviceName,
				name: method.name,
				path: `/${serviceName}/${method.name}`,
				request: method.request,
				response: method.response,
				clientStreaming: method.clientStreaming,
				serverStreaming: method.serverStreaming,
			});
		}
	}
	return out;
}