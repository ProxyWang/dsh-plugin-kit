/** Executable lookup that actually finds the tools people install.
 *
 * `spawn("gopls")` only works when the Host's PATH happens to contain it — and
 * the Desktop app is launched from Finder, so its PATH is the short GUI one,
 * not the login shell's. That is why language servers "were installed" and the
 * editor still reported them missing.
 *
 * This module resolves a binary once, deterministically, from (in order):
 *
 *   1. an explicit override (`DSH_<NAME>_BIN`, e.g. `DSH_GOPLS_BIN`);
 *   2. the server's own extras (Go's `GOBIN`/`GOPATH/bin`);
 *   3. the project's own tool directories, walking up from the project root —
 *      `node_modules/.bin`, `.venv/bin`, `venv/bin`, `.bin` — which is how a
 *      project pins its own server;
 *   4. every `PATH` entry (so a terminal-launched Host behaves as expected);
 *   5. the well-known per-user install locations (npm/nvm/pnpm/bun/volta/asdf,
 *      pyenv/conda, Homebrew, `/usr/local/bin`).
 *
 * The first candidate that exists and is executable wins, and the answer is
 * cached per (name, project root) because the editor asks repeatedly.
 */

import { accessSync, constants, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";

const cache = new Map();

/** Whether `file` exists and is executable (or, on Windows, just exists). */
function executable(file) {
	try {
		accessSync(file, constants.X_OK);
		return true;
	} catch {
		return process.platform === "win32" ? existsSync(file) : false;
	}
}

/** `typescript-language-server` → `TYPESCRIPT_LANGUAGE_SERVER`. */
function overrideKey(name) {
	return `DSH_${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_BIN`;
}

/** Version-manager roots that hold one `bin` per installed version. */
function versionedBins(home) {
	const out = [];
	const scan = (base, suffix) => {
		try {
			for (const entry of readdirSync(base)) out.push(join(base, entry, suffix));
		} catch { /* the manager is not installed */ }
	};
	scan(join(home, ".nvm", "versions", "node"), "bin");
	scan(join(home, ".local", "share", "mise", "installs", "node"), "bin");
	scan(join(home, ".asdf", "installs", "nodejs"), "bin");
	return out;
}

/**
 * Ordered candidate paths for one binary.
 *
 * @param name - executable name (`gopls`, `typescript-language-server`, …)
 * @param options - `{ root, extras, env, home }`; `root` is the project root
 *   whose local tool directories are searched, `extras` are absolute paths to
 *   try before them
 * @returns absolute paths (the bare name is appended last as a PATH fallback)
 */
export function binaryCandidates(name, options = {}) {
	const env = options.env ?? process.env;
	const home = options.home ?? homedir();
	const out = [];
	const push = (value) => {
		if (typeof value === "string" && value !== "" && !out.includes(value)) out.push(value);
	};

	const override = env[overrideKey(name)];
	if (typeof override === "string" && override !== "") push(override);
	for (const extra of options.extras ?? []) push(extra);

	// The project's own tool directories, nearest first.
	if (options.root) {
		let dir = options.root;
		for (let depth = 0; depth < 8; depth++) {
			push(join(dir, "node_modules", ".bin", name));
			push(join(dir, ".venv", "bin", name));
			push(join(dir, "venv", "bin", name));
			push(join(dir, ".bin", name));
			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
	}

	// PATH, which is the answer on any Host launched from a terminal.
	for (const entry of String(env.PATH ?? "").split(delimiter)) {
		if (entry !== "") push(join(entry, name));
	}

	// Per-user installs that a GUI-launched Host never sees in PATH.
	push(join(home, ".local", "bin", name));
	push(join(home, ".npm-global", "bin", name));
	push(join(home, ".bun", "bin", name));
	push(join(home, ".yarn", "bin", name));
	push(join(home, "Library", "pnpm", name));
	push(join(home, ".volta", "bin", name));
	push(join(home, ".asdf", "shims", name));
	push(join(home, ".local", "share", "mise", "shims", name));
	push(join(home, ".pyenv", "shims", name));
	push(join(home, "miniconda3", "bin", name));
	push(join(home, "anaconda3", "bin", name));
	for (const bin of versionedBins(home)) push(join(bin, name));
	push(`/opt/homebrew/bin/${name}`);
	push(`/usr/local/bin/${name}`);
	push(`/opt/homebrew/Caskroom/miniconda/base/bin/${name}`);

	// Last resort: let the child's own PATH decide.
	push(name);
	return out;
}

/**
 * Resolve one binary to an absolute path.
 *
 * @param name - executable name
 * @param options - see {@link binaryCandidates}
 * @returns the first executable candidate, or null when none exists
 */
export function findBinary(name, options = {}) {
	const key = `${name}\u0000${options.root ?? ""}\u0000${options.env?.PATH ?? ""}`;
	const cached = cache.get(key);
	if (cached !== undefined) return cached;
	const found = binaryCandidates(name, options).find((candidate) => executable(candidate)) ?? null;
	cache.set(key, found);
	return found;
}

/** Drop the memo (tests, or after installing a server mid-session). */
export function clearBinaryCache() {
	cache.clear();
}

/**
 * Every candidate that exists, resolved — used where trying several names in
 * one table (`pyright-langserver`, then `pylsp`) is the point.
 */
export function findBinaries(names, options = {}) {
	const out = [];
	for (const name of names) {
		for (const candidate of binaryCandidates(name, options)) {
			if (candidate === name) continue; // the bare fallback is not a path
			if (executable(candidate) && !out.includes(candidate)) out.push(candidate);
		}
	}
	return out;
}