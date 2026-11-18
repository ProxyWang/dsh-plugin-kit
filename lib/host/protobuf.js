/** Protobuf wire codec (schema-driven, zero dependencies).
 *
 * Only what a debugging client needs: the scalar types of proto3, embedded
 * messages, enums, repeated fields (packed and unpacked), and `map<>` entries.
 * The schema comes from `proto.js`; this module never parses `.proto` text.
 *
 * Wire format reference: protobuf.dev/programming-guides/encoding.
 */

const WIRE_VARINT = 0;
const WIRE_64BIT = 1;
const WIRE_LEN = 2;
const WIRE_32BIT = 5;

/** Scalar type → [wire type, reader/writer family]. */
const SCALARS = {
	double: { wire: WIRE_64BIT, kind: "double" },
	float: { wire: WIRE_32BIT, kind: "float" },
	int32: { wire: WIRE_VARINT, kind: "varint", signed: true },
	int64: { wire: WIRE_VARINT, kind: "varint", signed: true, big: true },
	uint32: { wire: WIRE_VARINT, kind: "varint" },
	uint64: { wire: WIRE_VARINT, kind: "varint", big: true },
	sint32: { wire: WIRE_VARINT, kind: "varint", zigzag: true },
	sint64: { wire: WIRE_VARINT, kind: "varint", zigzag: true, big: true },
	fixed32: { wire: WIRE_32BIT, kind: "fixed32" },
	fixed64: { wire: WIRE_64BIT, kind: "fixed64", big: true },
	sfixed32: { wire: WIRE_32BIT, kind: "sfixed32" },
	sfixed64: { wire: WIRE_64BIT, kind: "sfixed64", big: true },
	bool: { wire: WIRE_VARINT, kind: "bool" },
	string: { wire: WIRE_LEN, kind: "string" },
	bytes: { wire: WIRE_LEN, kind: "bytes" },
};

/** Whether a type name is a protobuf scalar. */
export function isScalar(type) {
	return Object.hasOwn(SCALARS, type);
}

// --- writer ------------------------------------------------------------------------------

class Writer {
	constructor() {
		this.buffer = Buffer.allocUnsafe(256);
		this.length = 0;
	}
	ensure(extra) {
		if (this.length + extra <= this.buffer.length) return;
		let size = this.buffer.length * 2;
		while (size < this.length + extra) size *= 2;
		const next = Buffer.allocUnsafe(size);
		this.buffer.copy(next, 0, 0, this.length);
		this.buffer = next;
	}
	varint(value) {
		let v = typeof value === "bigint" ? value : BigInt(Math.trunc(Number(value) || 0));
		if (v < 0n) v += 1n << 64n; // negative ints are encoded as 10-byte two's complement
		this.ensure(10);
		while (v > 0x7fn) {
			this.buffer[this.length++] = Number((v & 0x7fn) | 0x80n);
			v >>= 7n;
		}
		this.buffer[this.length++] = Number(v);
	}
	tag(fieldNumber, wireType) {
		this.varint((fieldNumber << 3) | wireType);
	}
	fixed32(value) {
		this.ensure(4);
		this.buffer.writeUInt32LE(Number(value) >>> 0, this.length);
		this.length += 4;
	}
	fixed64(value) {
		this.ensure(8);
		this.buffer.writeBigUInt64LE(BigInt(Math.trunc(Number(value) || 0)), this.length);
		this.length += 8;
	}
	float(value) {
		this.ensure(4);
		this.buffer.writeFloatLE(Number(value) || 0, this.length);
		this.length += 4;
	}
	double(value) {
		this.ensure(8);
		this.buffer.writeDoubleLE(Number(value) || 0, this.length);
		this.length += 8;
	}
	bytesView(value) {
		const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
		this.varint(buf.length);
		this.ensure(buf.length);
		buf.copy(this.buffer, this.length);
		this.length += buf.length;
	}
	finish() {
		return this.buffer.subarray(0, this.length);
	}
}

// --- reader ------------------------------------------------------------------------------

class Reader {
	constructor(buffer) {
		this.buffer = buffer;
		this.pos = 0;
	}
	varint() {
		let result = 0n;
		let shift = 0n;
		for (;;) {
			if (this.pos >= this.buffer.length) throw new Error("truncated varint");
			const byte = this.buffer[this.pos++];
			result |= BigInt(byte & 0x7f) << shift;
			if ((byte & 0x80) === 0) break;
			shift += 7n;
			if (shift > 63n) throw new Error("varint over 10 bytes");
		}
		return result;
	}
	uint32() {
		return Number(this.varint() & 0xffffffffn);
	}
	bytes() {
		const length = Number(this.varint());
		if (this.pos + length > this.buffer.length) throw new Error("truncated length-delimited field");
		const slice = this.buffer.subarray(this.pos, this.pos + length);
		this.pos += length;
		return slice;
	}
	fixed32() {
		const value = this.buffer.readUInt32LE(this.pos);
		this.pos += 4;
		return value;
	}
	fixed64() {
		const value = this.buffer.readBigUInt64LE(this.pos);
		this.pos += 8;
		return value;
	}
	float() {
		const value = this.buffer.readFloatLE(this.pos);
		this.pos += 4;
		return value;
	}
	double() {
		const value = this.buffer.readDoubleLE(this.pos);
		this.pos += 8;
		return value;
	}
	skip(wireType) {
		switch (wireType) {
			case WIRE_VARINT: this.varint(); return;
			case WIRE_64BIT: this.pos += 8; return;
			case WIRE_LEN: this.bytes(); return;
			case WIRE_32BIT: this.pos += 4; return;
			default: throw new Error(`unsupported wire type ${wireType}`);
		}
	}
}

// --- encoding ----------------------------------------------------------------------------

/** Zigzag-encode a signed integer (sint32/sint64). */
function zigzagEncode(value) {
	const v = BigInt(Math.trunc(Number(value) || 0));
	return (v << 1n) ^ (v >> 63n);
}

function writeScalar(writer, type, value) {
	const spec = SCALARS[type];
	switch (spec.kind) {
		case "varint":
			if (spec.zigzag) writer.varint(zigzagEncode(value));
			else writer.varint(value);
			return;
		case "bool": writer.varint(value ? 1 : 0); return;
		case "string": writer.bytesView(Buffer.from(String(value ?? ""), "utf8")); return;
		case "bytes": writer.bytesView(Buffer.from(value ?? "")); return;
		case "fixed32": writer.fixed32(value); return;
		case "sfixed32": writer.fixed32(Number(value) | 0); return;
		case "fixed64":
		case "sfixed64": writer.fixed64(value); return;
		case "float": writer.float(value); return;
		case "double": writer.double(value); return;
		default: throw new Error(`unsupported scalar: ${type}`);
	}
}

/**
 * Encode one message.
 *
 * @param schema - parsed proto schema (`proto.js`)
 * @param typeName - fully qualified message name (no leading dot)
 * @param value - plain JS object keyed by PROTO field names
 * @returns Buffer with the wire bytes
 */
export function encodeMessage(schema, typeName, value) {
	const message = schema.messages[typeName];
	if (!message) throw new Error(`unknown message type: ${typeName}`);
	const writer = new Writer();
	for (const field of Object.values(message.fields)) {
		const raw = value?.[field.name];
		if (raw === undefined || raw === null) continue;
		if (field.repeated) {
			const list = Array.isArray(raw) ? raw : [];
			if (list.length === 0) continue;
			// Packed encoding for repeated scalars: one length-delimited field.
			const scalar = isScalar(field.type) && SCALARS[field.type].wire !== WIRE_LEN;
			if (scalar) {
				const inner = new Writer();
				for (const item of list) writeScalar(inner, field.type, item);
				writer.tag(field.number, WIRE_LEN);
				writer.bytesView(inner.finish());
			} else {
				for (const item of list) writeField(writer, schema, field, item);
			}
			continue;
		}
		if (field.map) {
			const entries = Object.entries(raw ?? {});
			for (const [key, value_] of entries) {
				const inner = new Writer();
				const keyField = { name: "key", number: 1, type: field.mapKey, repeated: false };
				const valueField = { name: "value", number: 2, type: field.mapValue, repeated: false };
				writeField(inner, schema, keyField, castMapKey(key, field.mapKey));
				writeField(inner, schema, valueField, value_);
				writer.tag(field.number, WIRE_LEN);
				writer.bytesView(inner.finish());
			}
			continue;
		}
		writeField(writer, schema, field, raw);
	}
	return writer.finish();
}

/** Map keys arrive as JS object keys (strings); coerce to the declared type. */
function castMapKey(key, type) {
	if (type === "bool") return key === "true";
	if (["int32", "int64", "uint32", "uint64", "sint32", "sint64", "fixed32", "fixed64", "sfixed32", "sfixed64"].includes(type)) {
		return Number(key);
	}
	return key;
}

function writeField(writer, schema, field, value) {
	if (field.type in SCALARS) {
		writer.tag(field.number, SCALARS[field.type].wire);
		writeScalar(writer, field.type, value);
		return;
	}
	if (schema.messages[field.type]) {
		writer.tag(field.number, WIRE_LEN);
		writer.bytesView(encodeMessage(schema, field.type, value));
		return;
	}
	if (schema.enums[field.type]) {
		const number = enumNumber(schema, field.type, value);
		writer.tag(field.number, WIRE_VARINT);
		writer.varint(number);
		return;
	}
	throw new Error(`unknown field type: ${field.type}`);
}

/** Enum value name → number (accepts a number or a known name). */
function enumNumber(schema, typeName, value) {
	const enumDef = schema.enums[typeName];
	if (typeof value === "number") return value;
	const entry = Object.entries(enumDef.values).find(([name]) => name === String(value));
	if (!entry) throw new Error(`unknown enum value ${JSON.stringify(value)} for ${typeName}`);
	return entry[1];
}

// --- decoding ----------------------------------------------------------------------------

function readScalar(reader, type) {
	const spec = SCALARS[type];
	switch (spec.kind) {
		case "varint": {
			const raw = reader.varint();
			if (spec.zigzag) return Number((raw >> 1n) ^ -(raw & 1n));
			// A negative int32/int64 arrives as a 10-byte two's-complement
			// value; subtracting in BigInt keeps small negatives exact (doing
			// it in Number loses every bit below 1.8e19).
			if (spec.signed && raw >= 1n << 63n) return Number(raw - (1n << 64n));
			// Values past Number.MAX_SAFE_INTEGER keep full precision as a string.
			if (spec.big && raw > BigInt(Number.MAX_SAFE_INTEGER)) return raw.toString();
			return Number(raw);
		}
		case "bool": return reader.varint() !== 0n;
		case "string": return reader.bytes().toString("utf8");
		case "bytes": return reader.bytes().toString("base64");
		case "fixed32": return reader.fixed32();
		case "sfixed32": return reader.fixed32() | 0;
		case "fixed64": return reader.fixed64().toString();
		case "sfixed64": return reader.fixed64().toString();
		case "float": return reader.float();
		case "double": return reader.double();
		default: throw new Error(`unsupported scalar: ${type}`);
	}
}

/**
 * Decode one message. Unknown fields are skipped, so a newer server cannot
 * break a client with an older schema.
 *
 * @param schema - parsed proto schema
 * @param typeName - fully qualified message name
 * @param buffer - wire bytes
 * @returns plain JS object keyed by proto field names
 */
export function decodeMessage(schema, typeName, buffer) {
	const message = schema.messages[typeName];
	if (!message) throw new Error(`unknown message type: ${typeName}`);
	const byNumber = new Map(Object.values(message.fields).map((field) => [field.number, field]));
	const reader = new Reader(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
	const out = {};
	while (reader.pos < reader.buffer.length) {
		const tag = reader.varint();
		const fieldNumber = Number(tag >> 3n);
		const wireType = Number(tag & 7n);
		const field = byNumber.get(fieldNumber);
		if (!field) {
			reader.skip(wireType);
			continue;
		}
		if (field.map) {
			const entryBuffer = reader.bytes();
			const entry = decodeMapEntry(schema, field, entryBuffer);
			out[field.name] ??= {};
			out[field.name][String(entry.key)] = entry.value;
			continue;
		}
		if (field.repeated) {
			const list = (out[field.name] ??= []);
			if (wireType === WIRE_LEN && isScalar(field.type) && SCALARS[field.type].wire !== WIRE_LEN) {
				// Packed repeated scalar.
				const packed = new Reader(reader.bytes());
				while (packed.pos < packed.buffer.length) list.push(readScalar(packed, field.type));
			} else {
				list.push(readValue(reader, schema, field, wireType));
			}
			continue;
		}
		out[field.name] = readValue(reader, schema, field, wireType);
	}
	return out;
}

function decodeMapEntry(schema, field, buffer) {
	const reader = new Reader(buffer);
	let key;
	let value;
	while (reader.pos < reader.buffer.length) {
		const tag = reader.varint();
		const number = Number(tag >> 3n);
		const wire = Number(tag & 7n);
		if (number === 1) key = readValue(reader, schema, { type: field.mapKey, number: 1 }, wire);
		else if (number === 2) value = readValue(reader, schema, { type: field.mapValue, number: 2 }, wire);
		else reader.skip(wire);
	}
	return { key: key ?? defaultScalar(field.mapKey), value: value ?? defaultScalar(field.mapValue) };
}

function defaultScalar(type) {
	if (type === "bool") return false;
	if (type === "string") return "";
	if (type === "bytes") return "";
	return 0;
}

function readValue(reader, schema, field, wireType) {
	if (field.type in SCALARS) return readScalar(reader, field.type);
	if (schema.messages[field.type]) return decodeMessage(schema, field.type, reader.bytes());
	if (schema.enums[field.type]) {
		const number = Number(reader.varint());
		const entry = Object.entries(schema.enums[field.type].values).find(([, value]) => value === number);
		return entry ? entry[0] : number;
	}
	reader.skip(wireType);
	return undefined;
}

/** Default JSON skeleton for a message: every field at its zero value. */
export function sampleMessage(schema, typeName, depth = 0) {
	const message = schema.messages[typeName];
	if (!message || depth > 8) return {};
	const out = {};
	for (const field of Object.values(message.fields)) {
		if (field.repeated) {
			out[field.name] = [];
			continue;
		}
		if (field.map) {
			out[field.name] = {};
			continue;
		}
		if (schema.messages[field.type]) out[field.name] = sampleMessage(schema, field.type, depth + 1);
		else if (schema.enums[field.type]) out[field.name] = Object.keys(schema.enums[field.type].values)[0] ?? 0;
		else if (field.type === "bool") out[field.name] = false;
		else if (field.type === "string" || field.type === "bytes") out[field.name] = "";
		else out[field.name] = 0;
	}
	return out;
}