/**
 * Host↔client contract guard: the two halves are built and tested from
 * different roots, so the shared facts are pinned here instead of by memory.
 *
 * Checks:
 *  - the API prefix is identical in lib/host/constants.js, src/client/constants.js
 *    and the built client.js;
 *  - the route table has unique, well-formed keys;
 *  - every ApiError code is declared in STATUS (an undeclared code silently
 *    becomes a 400, losing the HTTP status the caller branches on);
 *  - the API keeps answering through sendOk/sendError rather than the old
 *    ad-hoc `respondJson(res, 200, {ok:false})` shape;
 *  - routes with no test mention are reported (warning, not a failure).
 *
 * Zero dependencies; exits 1 on a failed contract.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const passes = [];

function expect(label, condition, detail) {
	if (condition) passes.push(label);
	else failures.push(detail === undefined ? label : `${label} — ${detail}`);
}

function readText(path) {
	try {
		return readFileSync(resolve(root, path), "utf8");
	} catch {
		return "";
	}
}

const host = await import(pathToFileURL(resolve(root, "lib/host/constants.js")).href);
const client = await import(pathToFileURL(resolve(root, "src/client/constants.js")).href);
const errors = await import(pathToFileURL(resolve(root, "lib/host/errors.js")).href);

expect("host and client share one API prefix", host.API_PREFIX === client.API, `${host.API_PREFIX} vs ${client.API}`);
expect("prefix is absolute and namespaced", /^\/[a-z-]+\/api$/.test(host.API_PREFIX), host.API_PREFIX);
expect("built client carries the API prefix", readText("client.js").includes(host.API_PREFIX));

const routesSource = readText("lib/host/routes.js");
const routeKeys = [...routesSource.matchAll(/^[ \t]+(?:async[ \t]+)?"([a-z][a-zA-Z.]*)"\(body/gm)].map((match) => match[1]);
const dbSource = readText("lib/host/db.js");
const dbKeys = [...dbSource.matchAll(/^[ \t]+["']([a-z][a-zA-Z.]*)["']\s*:\s*\(body/gm)].map((match) => match[1]);
expect("route table is non-empty", routeKeys.length > 0, String(routeKeys.length));
expect("route keys are unique", new Set(routeKeys).size === routeKeys.length);
expect("every route key is namespaced (verb.noun[.detail])", routeKeys.every((key) => /^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$/.test(key)), routeKeys.find((key) => !/^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$/.test(key)));
expect("database routes are declared", dbKeys.length > 0, String(dbKeys.length));

const declaredCodes = new Set(Object.keys(errors.STATUS));
const usedCodes = new Set(
	[...`${readText("index.js")}\n${readText("lib/host/fence.js")}\n${readText("lib/host/http.js")}`.matchAll(/new ApiError\("([a-z-]+)"/g)].map((match) => match[1]),
);
const undeclared = [...usedCodes].filter((code) => !declaredCodes.has(code));
expect("every ApiError code is declared in STATUS", undeclared.length === 0, undeclared.join(", "));
expect("internal errors stay internal", errors.STATUS.internal === 500);

const indexSource = readText("index.js");
expect("API answers through sendOk/sendError", indexSource.includes("sendOk(") && indexSource.includes("sendError("));
expect("no ad-hoc 200 failure envelope left", !/respondJson\(res,\s*200,\s*\{\s*ok:\s*false/.test(indexSource));

const allTests = readdirSync(root, { withFileTypes: true })
	.filter((entry) => entry.isFile() && /^test-.*\.mjs$/.test(entry.name))
	.map((entry) => readText(entry.name))
	.join("\n");
const untested = routeKeys.filter((key) => !allTests.includes(`"${key}"`) && !allTests.includes(`'${key}'`));

console.log(`contract: ${passes.length} checks passed`);
for (const failure of failures) console.log(`  FAIL ${failure}`);
if (untested.length > 0) console.log(`  warn routes with no test mention: ${untested.join(", ")}`);
if (failures.length > 0) process.exit(1);
