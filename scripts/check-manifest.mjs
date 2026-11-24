/**
 * Manifest guard: the files the package promises to ship must exist, the
 * Loader row must point at this package, and the client bundle must register
 * the module id the Host expects.
 *
 * These are the mistakes that only surface after packing and installing
 * (entry file renamed, `files` entry stale, patch name drifted, bundle id
 * changed by a build edit), so they are checked before the suite instead of
 * after a user reports "the plugin does not load".
 *
 * Zero dependencies; exits 1 on the first failed contract.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (path) => relative(root, path);
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
		return undefined;
	}
}

/** Recursively list files under a package-relative directory. */
function walkFiles(dir, out = []) {
	let entries;
	try {
		entries = readdirSync(resolve(root, dir), { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const rel = `${dir}/${entry.name}`;
		if (entry.isDirectory()) walkFiles(rel, out);
		else out.push(rel);
	}
	return out;
}

/** Expand a manifest glob such as `lib/host/*.js` against the checkout. */
function matchesEntry(entry) {
	if (entry.endsWith("/**")) return walkFiles(entry.slice(0, -3));
	const star = entry.indexOf("*");
	if (star < 0) return existsSync(resolve(root, entry)) ? [entry] : [];
	const prefix = entry.slice(0, star);
	const suffix = entry.slice(star + 1);
	const dir = resolve(root, prefix.endsWith("/") ? prefix : dirname(prefix));
	if (!existsSync(dir)) return [];
	const base = prefix.endsWith("/") ? "" : prefix.slice(dirname(prefix).length + 1);
	return readdirSync(dir, { withFileTypes: true })
		.filter((entryDirent) => entryDirent.isFile())
		.map((entryDirent) => base + entryDirent.name)
		.filter((name) => name.endsWith(suffix))
		.map((name) => `${prefix.endsWith("/") ? prefix : dirname(prefix) + "/"}${name}`);
}

const pkgText = readText("package.json");
expect("package.json is readable", pkgText !== undefined);
const pkg = pkgText === undefined ? {} : JSON.parse(pkgText);

expect("package name is dsh-plugin-kit", pkg.name === "dsh-plugin-kit", String(pkg.name));
expect("package has a version", typeof pkg.version === "string" && pkg.version.length > 0);

for (const [specifier, target] of Object.entries(pkg.exports ?? {})) {
	expect(`exports ${specifier} ships ${target}`, matchesEntry(target).length > 0);
}

for (const entry of pkg.files ?? []) {
	expect(`files entry ${entry} matches something`, matchesEntry(entry).length > 0);
}

// Every runtime module must be covered by a `files` entry. A too-narrow glob
// (lib/host/*.js) silently drops nested runtime directories from the tarball,
// which only shows up after publish — so the coverage is walked, not assumed.
function patternMatches(pattern, path) {
	if (pattern === path) return true;
	if (pattern.endsWith("/**")) {
		const base = pattern.slice(0, -3);
		return path === base || path.startsWith(`${base}/`);
	}
	if (pattern === "docs") return path === "docs" || path.startsWith("docs/");
	const regex = new RegExp(`^${pattern.split("**").map((part) => part.split("*").map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")).join(".*")}$`);
	return regex.test(path);
}

const runtimeFiles = [...walkFiles("lib/host"), ...walkFiles("src/client"), "index.js", "client.js", "cordis.patch.yml", "icon.svg", ...walkFiles("locale"), ...walkFiles("docs")];
const uncovered = runtimeFiles.filter((file) => !(pkg.files ?? []).some((pattern) => patternMatches(pattern, file)));
expect("every runtime file is covered by files[]", uncovered.length === 0, uncovered.slice(0, 5).join(", "));

const patchPath = pkg.dsh?.bundle?.patch;
expect("dsh.bundle.patch is declared", typeof patchPath === "string", String(patchPath));
const patch = typeof patchPath === "string" ? readText(patchPath) : undefined;
expect("bundle patch file exists", typeof patch === "string", String(patchPath));
if (typeof patch === "string") {
	expect("patch mounts this package by name", patch.includes(`'${pkg.name}'`));
	expect("patch row has an id", /^\s*-\s*id:\s*\S+/m.test(patch));
	// Config keys the Loader validates must exist in the exported schema, or
	// activation fails with "Cannot read properties of undefined".
	const configBlock = patch.split(/^ {2}config:\s*$/m)[1] ?? "";
	const schema = readText("index.js") ?? "";
	for (const key of configBlock.match(/^ {8}([A-Za-z_]\w*):/gm)?.map((line) => line.trim().replace(/:$/, "")) ?? []) {
		expect(`patch config key ${key} exists in Config`, new RegExp(`^\\t${key}: z\\.`, "m").test(schema));
	}
}

const client = pkg.dsh?.client;
expect("dsh.client.platform is web", client?.platform === "web", String(client?.platform));
expect("dsh.client.inject is a non-empty list", Array.isArray(client?.inject) && client.inject.length > 0);
expect("client bundle is a shipped file", matchesEntry("./client.js").length > 0);

const bundle = readText("client.js");
expect("client bundle registers the package module id", typeof bundle === "string" && bundle.includes(`id: "${pkg.name}"`));

const zh = readText("locale/zh.json");
const en = readText("locale/en.json");
expect("locale/zh.json exists", typeof zh === "string");
expect("locale/en.json exists", typeof en === "string");
if (typeof zh === "string" && typeof en === "string") {
	const flatten = (value, prefix = "", out = []) => {
		for (const [key, child] of Object.entries(value ?? {})) {
			const path = prefix === "" ? key : `${prefix}.${key}`;
			if (child !== null && typeof child === "object" && !Array.isArray(child)) flatten(child, path, out);
			else out.push(path);
		}
		return out.sort();
	};
	const zhKeys = flatten(JSON.parse(zh));
	const enKeys = flatten(JSON.parse(en));
	const missingEn = zhKeys.filter((key) => !enKeys.includes(key));
	const missingZh = enKeys.filter((key) => !zhKeys.includes(key));
	expect("zh and en dictionaries carry the same keys", missingEn.length === 0 && missingZh.length === 0, JSON.stringify({ missingEn: missingEn.slice(0, 5), missingZh: missingZh.slice(0, 5) }));
}

console.log(`manifest: ${passes.length} checks passed`);
for (const failure of failures) console.log(`  FAIL ${failure}`);
if (failures.length > 0) process.exit(1);
