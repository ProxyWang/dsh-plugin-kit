/**
 * Skill discovery and editing for the panel's Skills view.
 *
 * Mirrors the dsh-skill-filesystem roots (project `.dsh/skills` and
 * `.agents/skills`, then the same two under the home directory) so the list
 * matches what agents see, and exposes read/write/create/delete fenced to
 * those roots: a path must lexically live under one root, write targets must
 * be regular existing files (never symlinks), creates only make
 * `<root>/<kebab-name>/SKILL.md`, and deletes only remove a directory that
 * directly contains SKILL.md or a flat `.md` skill sitting directly in a root.
 */

import { lstat, mkdir, open, readFile, readdir, realpath, rm, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, normalize, resolve, sep } from "node:path";

const READ_CAP = 1 * 1024 * 1024;
const FRONTMATTER_CAP = 64 * 1024;
const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** Host skill registry (same source the '/' menu reads), captured at apply. */
let skillsRegistry = null;
export function setSkillsRegistry(value) {
	skillsRegistry = value && typeof value.list === "function" ? value : null;
}
export function getSkillsRegistry() {
	return skillsRegistry;
}

/** Home override exists so tests can point the user roots at a fixture. */
function homeRoot() {
	return process.env.DSH_CE_HOME || homedir();
}

/**
 * Roots in priority order (project beats user), same order as the agent scan,
 * plus the app-shipped bundled skill dir (read-only group in the UI).
 */
export function skillRoots(cwd) {
	const home = homeRoot();
	const roots = [
		{ path: resolve(cwd, ".dsh/skills"), source: "project-dsh" },
		{ path: resolve(cwd, ".agents/skills"), source: "project-agents" },
		{ path: resolve(home, ".dsh/skills"), source: "user-dsh" },
		{ path: resolve(home, ".agents/skills"), source: "user-agents" },
	];
	const bundled = process.env.DSH_BUNDLED_SKILL_DIR;
	if (typeof bundled === "string" && bundled !== "") roots.push({ path: resolve(bundled), source: "bundled" });
	return roots;
}

/** Lexical containment under any root; returns the owning root or null. */
function owningRoot(roots, target) {
	const clean = normalize(target);
	for (const root of roots) {
		const base = normalize(root.path);
		if (clean === base || clean.startsWith(base + sep)) return root;
	}
	return null;
}

/**
 * Minimal YAML frontmatter reader: `name:` and `description:` values, either
 * single-line (optionally quoted) or block scalars (`>-`, `>`, `|-`, `|`)
 * whose indented continuation lines are folded/joined.
 */
function parseFrontmatter(text) {
	const lines = text.split("\n");
	if ((lines[0] ?? "").trim() !== "---") return {};
	const out = {};
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "---") break;
		const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
		if (match === null) continue;
		let value = match[2].trim();
		if (value === ">-" || value === ">" || value === "|-" || value === "|") {
			const folded = value.startsWith(">");
			const block = [];
			for (let j = i + 1; j < lines.length; j++) {
				const cont = lines[j];
				if (cont.trim() === "") {
					block.push("");
					i = j;
					continue;
				}
				if (!/^\s/.test(cont)) break;
				block.push(cont.trim());
				i = j;
			}
			out[match[1]] = folded ? block.join(" ").replace(/\s+/g, " ").trim() : block.join("\n");
			continue;
		}
		if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
			value = value.slice(1, -1);
		}
		out[match[1]] = value;
	}
	return out;
}

/** Read at most `cap` bytes; never buffers the whole file (skills can reference huge files). */
async function readCapped(path, cap) {
	const st = await stat(path);
	if (st.size <= cap) return { text: (await readFile(path)).toString("utf8"), truncated: false };
	const fh = await open(path, "r");
	try {
		const buf = Buffer.alloc(cap);
		const { bytesRead } = await fh.read(buf, 0, cap, 0);
		return { text: buf.subarray(0, bytesRead).toString("utf8"), truncated: true };
	} finally {
		await fh.close();
	}
}

/**
 * Realpath containment: a path that lexically lives under a root must also
 * RESOLVE under it — otherwise a symlinked skill dir (e.g. evil -> $HOME,
 * which a cloned repo can carry) smuggles reads/writes anywhere the link
 * reaches. Returns the resolved path.
 */
async function assertInsideRoot(rootPath, target) {
	const realRoot = await realpath(rootPath);
	const real = await realpath(target);
	if (real !== realRoot && !real.startsWith(realRoot + sep)) {
		throw new Error("path resolves outside the skill root");
	}
	return real;
}

/** Discover directory-bundle and flat-markdown skills, project roots first. */
export async function listSkills(cwd) {
	const seen = new Map();
	for (const root of skillRoots(cwd)) {
		let entries;
		try {
			entries = await readdir(root.path, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.name.startsWith(".")) continue;
			const full = join(root.path, entry.name);
			if (entry.isDirectory() || entry.isSymbolicLink()) {
				const skillFile = join(full, "SKILL.md");
				let st;
				try {
					st = await stat(skillFile);
				} catch {
					continue;
				}
				if (!st.isFile()) continue;
				const fm = parseFrontmatter((await readCapped(skillFile, FRONTMATTER_CAP)).text);
				const name = fm.name || entry.name;
				if (seen.has(name)) continue;
				seen.set(name, { name, description: fm.description ?? "", path: skillFile, dir: full, source: root.source });
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				const fm = parseFrontmatter((await readCapped(full, FRONTMATTER_CAP)).text);
				const name = fm.name || entry.name.slice(0, -3);
				if (seen.has(name)) continue;
				seen.set(name, { name, description: fm.description ?? "", path: full, dir: root.path, source: root.source });
			}
		}
	}
	const skills = [...seen.values()];
	// Append registry-only skills (bundled dir, programmatic providers) as a
	// read-only "other" group so the manager matches the '/' menu catalog.
	const registry = getSkillsRegistry();
	if (registry !== null) {
		try {
			const summaries = await registry.list({ cwd });
			for (const sum of summaries ?? []) {
				if (!sum || typeof sum.name !== "string" || seen.has(sum.name)) continue;
				seen.set(sum.name, true);
				skills.push({
					name: sum.name,
					description: typeof sum.description === "string" ? sum.description : "",
					path: typeof sum.path === "string" ? sum.path : "",
					dir: "",
					source: "other",
					provider: typeof sum.provider === "string" ? sum.provider : "",
				});
			}
		} catch { /* registry unavailable: fs roots only */ }
	}
	return skills;
}

export async function readSkill(cwd, path) {
	const root = owningRoot(skillRoots(cwd), path);
	if (root === null) {
		// Registry-provided skills live outside the editable roots: exact-path reads only.
		let allowed = false;
		const registry = getSkillsRegistry();
		if (registry !== null && path !== "") {
			try {
				const summaries = await registry.list({ cwd });
				allowed = (summaries ?? []).some((s) => s && s.path === path);
			} catch {
				allowed = false;
			}
		}
		if (!allowed) throw new Error("path is outside the skill roots");
	} else {
		await assertInsideRoot(root.path, path);
	}
	const st = await lstat(path);
	if (st.isSymbolicLink() || !st.isFile()) throw new Error("not a regular file");
	const { text, truncated } = await readCapped(path, READ_CAP);
	return { content: text, truncated, path };
}

export async function writeSkill(cwd, path, content) {
	const roots = skillRoots(cwd);
	const root = owningRoot(roots, path);
	if (root === null) throw new Error("path is outside the skill roots");
	if (root.source === "bundled") throw new Error("bundled skills are read-only");
	const st = await lstat(path).catch(() => null);
	if (st === null) throw new Error("file does not exist");
	if (st.isSymbolicLink() || !st.isFile()) throw new Error("not a regular file");
	await assertInsideRoot(root.path, path);
	await writeFile(path, content, "utf8");
	return { path };
}

export async function createSkill(cwd, name, scope) {
	const clean = String(name ?? "").trim();
	if (!NAME_RE.test(clean)) throw new Error("invalid skill name (kebab-case: a-z 0-9 - . _)");
	const roots = skillRoots(cwd);
	const root = roots.find((r) => r.source === (scope === "project" ? "project-agents" : "user-agents"));
	const dir = join(root.path, clean);
	const dirStat = await lstat(dir).catch(() => null);
	if (dirStat !== null && dirStat.isSymbolicLink()) throw new Error("skill directory is a symlink");
	await mkdir(dir, { recursive: true });
	const file = join(dir, "SKILL.md");
	const exists = await lstat(file).then(() => true, () => false);
	if (exists) throw new Error("skill already exists");
	await writeFile(file, `---\nname: ${clean}\ndescription: ""\n---\n\n# ${clean}\n\n`, "utf8");
	return { path: file, skill: { name: clean, description: "", path: file, dir, source: root.source } };
}

export async function deleteSkill(cwd, path) {
	const roots = skillRoots(cwd);
	const root = owningRoot(roots, path);
	if (root === null) throw new Error("path is outside the skill roots");
	if (root.source === "bundled") throw new Error("bundled skills are read-only");
	// The panel passes the SKILL.md locator; unwrap to its owning directory.
	let target = path;
	let probe = await lstat(target);
	if (probe.isFile() && target.endsWith(`${sep}SKILL.md`)) {
		target = dirname(target);
		probe = await lstat(target);
	}
	// Symlinked skill dir: remove the link only, never the link target's tree.
	if (probe.isSymbolicLink()) {
		await unlink(target);
		return { path: target };
	}
	// Everything below deletes real content: the resolved location must stay
	// inside the resolved root (symlinked ancestors must not smuggle the rm).
	await assertInsideRoot(root.path, target);
	// Flat markdown skill sitting directly in a root.
	if (probe.isFile() && target.endsWith(".md") && normalize(dirname(target)) === normalize(root.path)) {
		await unlink(target);
		return { path: target };
	}
	const skillFile = join(target, "SKILL.md");
	const fst = await lstat(skillFile).catch(() => null);
	if (!probe.isDirectory() || fst === null || !fst.isFile()) throw new Error("not a skill directory");
	await rm(target, { recursive: true, force: true });
	return { path: target };
}
