/** Resolve an optional JS database driver module.
 *
 * The plugin ships no runtime dependency, so `mysql2` / `pg` are only usable
 * when the environment already has them: in the session workspace's
 * `node_modules` (a project that already talks to a database) or inside the
 * Host's own module tree.
 *
 * Resolving from the workspace is the same rule `binpath.js` uses for language
 * servers — the project's own tooling first — but the consequence is stronger:
 * loading a JS module runs its code inside the Host process, while spawning a
 * binary does not. So this module is deliberately narrow:
 *
 *   - only whitelisted package names, never a path or a relative specifier;
 *   - the workspace is searched only when the caller explicitly allows it;
 *   - the Host's own resolution is always allowed (it is our own dependency
 *     tree, not the user's).
 *
 * The result is a plain descriptor so callers never touch `require.resolve`.
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

/** Packages this plugin is willing to load. */
export const DRIVER_MODULES = new Set(["mysql2", "pg", "better-sqlite3", "sqlite3"]);

const hostRequire = createRequire(import.meta.url);

/** Read `version` out of a package directory, without importing it. */
function versionOf(packageDir) {
	try {
		return JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")).version ?? "";
	} catch {
		return "";
	}
}

/** Turn a resolved entry file into `{dir, version}` for the package that owns it. */
function packageOf(entryFile, name) {
	let dir = dirname(entryFile);
	// Walk up to the directory that actually declares this package.
	for (let depth = 0; depth < 8; depth++) {
		const manifest = join(dir, "package.json");
		if (existsSync(manifest)) {
			try {
				const parsed = JSON.parse(readFileSync(manifest, "utf8"));
				if (parsed.name === name) return { dir, version: String(parsed.version ?? "") };
			} catch { /* keep walking */ }
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return { dir: dirname(entryFile), version: "" };
}

/**
 * Resolve one whitelisted driver module.
 *
 * @param name - package name (must be in {@link DRIVER_MODULES})
 * @param options - `{ cwd, allowWorkspace, require: requireLike }`
 * @returns `{name, path, version, source: "workspace"|"host"|"config"}` or null
 */
export function resolveModule(name, options = {}) {
	if (!DRIVER_MODULES.has(String(name))) return null;
	const attempts = [];

	// 1. The session workspace, walking up like a bundler would. Only with
	//    explicit permission: this is the user's own code.
	if (options.allowWorkspace === true && typeof options.cwd === "string" && options.cwd !== "") {
		let dir = options.cwd;
		for (let depth = 0; depth < 8; depth++) {
			attempts.push({ specifier: join(dir, "node_modules", name), source: "workspace" });
			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
	}

	// 2. An explicit path (tests, or a deployment that vendors the driver).
	if (typeof options.modulePath === "string" && options.modulePath !== "") {
		attempts.push({ specifier: options.modulePath, source: "config" });
	}

	// 3. The Host's own tree — always allowed.
	attempts.push({ specifier: name, source: "host" });

	for (const attempt of attempts) {
		const specifier = attempt.specifier;
		if (isAbsolute(specifier) && !existsSync(specifier)) continue;
		try {
			const requireFrom = attempt.source === "workspace" || attempt.source === "config"
				? createRequire(join(options.cwd ?? process.cwd(), "noop.js"))
				: hostRequire;
			const entry = requireFrom.resolve(specifier);
			const real = realpathSync(entry);
			const { dir, version } = packageOf(real, name);
			return { name, path: real, dir, version, source: attempt.source };
		} catch {
			// Not resolvable from here; try the next candidate.
		}
	}
	return null;
}

/**
 * Every whitelisted module that is currently resolvable, for the driver catalog.
 *
 * @param options - see {@link resolveModule}
 * @returns a map of name → descriptor (absent names are not installed)
 */
export function availableModules(options = {}) {
	const found = {};
	for (const name of DRIVER_MODULES) {
		const resolved = resolveModule(name, options);
		if (resolved) found[name] = resolved;
	}
	return found;
}