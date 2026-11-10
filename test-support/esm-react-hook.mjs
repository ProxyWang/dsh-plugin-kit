// Resolve the bare specifier "react" to a local stub.
//
// src/client/react.js imports "react" on purpose: that is the platform seed word the DSH
// client module system answers with require("react") inside the bundled factory, so the
// sources stay exactly what the browser runs. Node has no react package here, so the tests
// register this hook (node:module register()) before importing any src/client module.
export async function resolve(specifier, context, nextResolve) {
	if (specifier === "react") {
		return { url: new URL("./react-stub.mjs", import.meta.url).href, format: "module", shortCircuit: true };
	}
	return nextResolve(specifier, context);
}
