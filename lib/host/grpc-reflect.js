/** gRPC server reflection: learn a server's schema without a `.proto` file.
 *
 * The reflection service answers with serialized `google.protobuf.FileDescriptor
 * Proto` messages, which is the same information protoc had when it generated
 * code. Two steps, both over the ordinary gRPC call path this plugin already
 * speaks:
 *
 *   1. `list_services` — the service names the server publishes;
 *   2. `file_containing_symbol` per service — every descriptor file it needs,
 *      including the imported ones (the server returns the transitive set).
 *
 * The descriptors are decoded with a hand-written schema (below), then folded
 * into the same shape `proto.js` produces, so the codec, the sample-message
 * builder and the panel need no special case for "discovered" methods.
 *
 * Both reflection service names are tried: `grpc.reflection.v1.ServerReflection`
 * first (current), then `v1alpha` (still what most servers expose).
 */

import { grpcCall } from "./grpc.js";
import { decodeMessage } from "./protobuf.js";

/** Minimal `descriptor.proto` subset — only what reconstructing messages needs. */
export const REFLECTION_SCHEMA = {
	enums: {},
	messages: {
		"google.protobuf.FileDescriptorProto": {
			fields: {
				name: { name: "name", number: 1, type: "string", repeated: false },
				package: { name: "package", number: 2, type: "string", repeated: false },
				dependency: { name: "dependency", number: 3, type: "string", repeated: true },
				message_type: { name: "message_type", number: 4, type: "google.protobuf.DescriptorProto", repeated: true },
				enum_type: { name: "enum_type", number: 5, type: "google.protobuf.EnumDescriptorProto", repeated: true },
				service: { name: "service", number: 6, type: "google.protobuf.ServiceDescriptorProto", repeated: true },
				syntax: { name: "syntax", number: 12, type: "string", repeated: false },
			},
		},
		"google.protobuf.DescriptorProto": {
			fields: {
				name: { name: "name", number: 1, type: "string", repeated: false },
				field: { name: "field", number: 2, type: "google.protobuf.FieldDescriptorProto", repeated: true },
				nested_type: { name: "nested_type", number: 3, type: "google.protobuf.DescriptorProto", repeated: true },
				enum_type: { name: "enum_type", number: 4, type: "google.protobuf.EnumDescriptorProto", repeated: true },
				options: { name: "options", number: 7, type: "google.protobuf.MessageOptions", repeated: false },
			},
		},
		"google.protobuf.FieldDescriptorProto": {
			fields: {
				name: { name: "name", number: 1, type: "string", repeated: false },
				number: { name: "number", number: 3, type: "int32", repeated: false },
				label: { name: "label", number: 4, type: "int32", repeated: false },
				type: { name: "type", number: 5, type: "int32", repeated: false },
				type_name: { name: "type_name", number: 6, type: "string", repeated: false },
				json_name: { name: "json_name", number: 10, type: "string", repeated: false },
			},
		},
		"google.protobuf.EnumDescriptorProto": {
			fields: {
				name: { name: "name", number: 1, type: "string", repeated: false },
				value: { name: "value", number: 2, type: "google.protobuf.EnumValueDescriptorProto", repeated: true },
			},
		},
		"google.protobuf.EnumValueDescriptorProto": {
			fields: {
				name: { name: "name", number: 1, type: "string", repeated: false },
				number: { name: "number", number: 2, type: "int32", repeated: false },
			},
		},
		"google.protobuf.ServiceDescriptorProto": {
			fields: {
				name: { name: "name", number: 1, type: "string", repeated: false },
				method: { name: "method", number: 2, type: "google.protobuf.MethodDescriptorProto", repeated: true },
			},
		},
		"google.protobuf.MethodDescriptorProto": {
			fields: {
				name: { name: "name", number: 1, type: "string", repeated: false },
				input_type: { name: "input_type", number: 2, type: "string", repeated: false },
				output_type: { name: "output_type", number: 3, type: "string", repeated: false },
				client_streaming: { name: "client_streaming", number: 5, type: "bool", repeated: false },
				server_streaming: { name: "server_streaming", number: 6, type: "bool", repeated: false },
			},
		},
		"google.protobuf.MessageOptions": {
			fields: {
				map_entry: { name: "map_entry", number: 7, type: "bool", repeated: false },
			},
		},
		// ---- reflection protocol ------------------------------------------------------
		"grpc.reflection.v1alpha.ServerReflectionRequest": {
			fields: {
				host: { name: "host", number: 1, type: "string", repeated: false },
				file_by_filename: { name: "file_by_filename", number: 3, type: "string", repeated: false },
				file_containing_symbol: { name: "file_containing_symbol", number: 4, type: "string", repeated: false },
				list_services: { name: "list_services", number: 7, type: "string", repeated: false },
			},
		},
		"grpc.reflection.v1alpha.ServerReflectionResponse": {
			fields: {
				valid_host: { name: "valid_host", number: 1, type: "string", repeated: false },
				original_request: { name: "original_request", number: 2, type: "grpc.reflection.v1alpha.ServerReflectionRequest", repeated: false },
				file_descriptor_response: { name: "file_descriptor_response", number: 4, type: "grpc.reflection.v1alpha.FileDescriptorResponse", repeated: false },
				list_services_response: { name: "list_services_response", number: 6, type: "grpc.reflection.v1alpha.ListServiceResponse", repeated: false },
				error_response: { name: "error_response", number: 7, type: "grpc.reflection.v1alpha.ErrorResponse", repeated: false },
			},
		},
		"grpc.reflection.v1alpha.FileDescriptorResponse": {
			fields: {
				file_descriptor_proto: { name: "file_descriptor_proto", number: 1, type: "bytes", repeated: true },
			},
		},
		"grpc.reflection.v1alpha.ListServiceResponse": {
			fields: {
				service: { name: "service", number: 1, type: "grpc.reflection.v1alpha.ServiceResponse", repeated: true },
			},
		},
		"grpc.reflection.v1alpha.ServiceResponse": {
			fields: { name: { name: "name", number: 1, type: "string", repeated: false } },
		},
		"grpc.reflection.v1alpha.ErrorResponse": {
			fields: {
				error_code: { name: "error_code", number: 1, type: "int32", repeated: false },
				error_message: { name: "error_message", number: 2, type: "string", repeated: false },
			},
		},
	},
};

/** FieldDescriptorProto.type → the proto type name this codec uses. */
const FIELD_TYPES = {
	1: "double", 2: "float", 3: "int64", 4: "uint64", 5: "int32", 6: "fixed64",
	7: "fixed32", 8: "bool", 9: "string", 10: "group", 11: "message", 12: "bytes",
	13: "uint32", 14: "enum", 15: "sfixed32", 16: "sfixed64", 17: "sint32", 18: "sint64",
};

const LIST_SERVICES = "list_services";

/** One reflection exchange; both sides use the same message shapes. */
async function reflectCall(url, target, request, insecureTls, timeoutMs) {
	const result = await grpcCall({
		url,
		path: `/${target}/ServerReflectionInfo`,
		schema: REFLECTION_SCHEMA,
		requestType: "grpc.reflection.v1alpha.ServerReflectionRequest",
		responseType: "grpc.reflection.v1alpha.ServerReflectionResponse",
		messages: [request],
		timeoutMs,
		rejectUnauthorized: insecureTls !== true,
	});
	const response = result.messages?.[0];
	if (!response) {
		throw new Error(result.status === 0 ? "the reflection service returned no message" : `reflection failed: ${result.statusName} ${result.message}`);
	}
	if (response.error_response) {
		throw new Error(response.error_response.error_message || `reflection error ${response.error_response.error_code}`);
	}
	return response;
}

/**
 * Ask a server for its schema.
 *
 * @param url - `grpc://` or `grpcs://` address
 * @param options - `{ insecureTls, timeoutMs }`
 * @returns `{ target, services, schema, files }` where `schema` matches `proto.js`
 */
export async function discover(url, options = {}) {
	const timeoutMs = Number(options.timeoutMs) || 10_000;
	let response;
	let target = "grpc.reflection.v1.ServerReflection";
	try {
		response = await reflectCall(url, target, { list_services: LIST_SERVICES }, options.insecureTls, timeoutMs);
	} catch (first) {
		target = "grpc.reflection.v1alpha.ServerReflection";
		try {
			response = await reflectCall(url, target, { list_services: LIST_SERVICES }, options.insecureTls, timeoutMs);
		} catch {
			throw first;
		}
	}

	const services = (response.list_services_response?.service ?? []).map((entry) => entry.name).filter(Boolean);
	const reflectionNames = new Set(["grpc.reflection.v1.ServerReflection", "grpc.reflection.v1alpha.ServerReflection"]);
	const usable = services.filter((name) => !reflectionNames.has(name));

	// Every service's descriptor set, deduped by file name (they overlap).
	const files = new Map();
	for (const service of usable) {
		const answer = await reflectCall(url, target, { file_containing_symbol: service }, options.insecureTls, timeoutMs);
		for (const buffer of answer.file_descriptor_response?.file_descriptor_proto ?? []) {
			const decoded = decodeFileDescriptor(buffer);
			if (decoded?.name) files.set(decoded.name, decoded);
		}
	}
	const schema = schemaFromDescriptors([...files.values()]);
	return { target, services: usable, files: [...files.keys()], schema };
}

/** Decode one `FileDescriptorProto` buffer. */
function decodeFileDescriptor(buffer) {
	// The bytes arrive base64 from the codec (it keeps `bytes` printable).
	const raw = typeof buffer === "string" ? Buffer.from(buffer, "base64") : Buffer.from(buffer);
	return decodeMessage(REFLECTION_SCHEMA, "google.protobuf.FileDescriptorProto", raw);
}

/** Fold descriptor protos into the `proto.js` schema shape. */
export function schemaFromDescriptors(descriptors) {
	const messages = {};
	const enums = {};
	const services = {};

	/** Fully qualified names of every `map<...>` entry message. */
	const mapEntries = new Set();
	const collectMapEntries = (descriptor, scope) => {
		const fullName = scope ? `${scope}.${descriptor.name}` : descriptor.name;
		if (descriptor.options?.map_entry === true) mapEntries.add(fullName);
		for (const nested of descriptor.nested_type ?? []) collectMapEntries(nested, fullName);
	};
	for (const descriptor of descriptors) {
		const scope = descriptor.package ?? "";
		for (const message of descriptor.message_type ?? []) collectMapEntries(message, scope);
	}

	/** Add one message and everything nested in it. */
	const addMessage = (descriptor, scope) => {
		const fullName = scope ? `${scope}.${descriptor.name}` : descriptor.name;
		const message = { name: fullName, fields: {} };
		messages[fullName] = message;
		// Nested types first: a field's map entry is declared beside it.
		for (const nested of descriptor.nested_type ?? []) addMessage(nested, fullName);
		for (const enumType of descriptor.enum_type ?? []) addEnum(enumType, fullName);
		for (const field of descriptor.field ?? []) {
			const typeName = String(field.type_name ?? "").replace(/^\./, "");
			const baseType = FIELD_TYPES[field.type] ?? "string";
			const repeated = field.label === 3;
			if (repeated && mapEntries.has(typeName)) {
				// `map<K,V>` is a repeated entry message: expose it as a map so the
				// panel edits an object rather than an array of key/value pairs.
				const entry = messages[typeName];
				message.fields[field.name] = {
					name: field.name,
					number: field.number,
					type: "message",
					repeated: false,
					map: true,
					mapKey: entry?.fields.key?.type ?? "string",
					mapValue: entry?.fields.value?.type ?? "string",
				};
				continue;
			}
			message.fields[field.name] = {
				name: field.name,
				number: field.number,
				type: baseType === "message" || baseType === "enum" ? typeName || "string" : baseType,
				repeated,
				map: false,
			};
		}
	};
	const addEnum = (descriptor, scope) => {
		const fullName = scope ? `${scope}.${descriptor.name}` : descriptor.name;
		const values = {};
		for (const value of descriptor.value ?? []) values[value.name] = value.number;
		enums[fullName] = { name: fullName, values };
	};

	for (const descriptor of descriptors) {
		const scope = descriptor.package ?? "";
		for (const message of descriptor.message_type ?? []) addMessage(message, scope);
		for (const enumType of descriptor.enum_type ?? []) addEnum(enumType, scope);
		for (const service of descriptor.service ?? []) {
			const fullName = scope ? `${scope}.${service.name}` : service.name;
			services[fullName] = {
				name: fullName,
				methods: (service.method ?? []).map((method) => ({
					name: method.name,
					request: String(method.input_type ?? "").replace(/^\./, ""),
					response: String(method.output_type ?? "").replace(/^\./, ""),
					clientStreaming: method.client_streaming === true,
					serverStreaming: method.server_streaming === true,
				})),
			};
		}
	}
	return { package: descriptors[0]?.package ?? "", messages, enums, services };
}

