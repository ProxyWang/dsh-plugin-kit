/** Installing a driver module into the current project.
 *
 * `npm install --no-save <name>` runs in the session workspace, so the project's
 * manifest is never rewritten behind the user's back; the whitelist lives in
 * `modresolve.js` and an unknown package is refused before npm runs.
 */

import { execFile } from "node:child_process";
import { clearBinaryCache, findBinary } from "../binpath.js";
import { DRIVER_MODULES } from "../modresolve.js";

/**
 * Install one whitelisted driver module.
 *
 * @param body - `{name, cwd}`
 * @returns `{name, output}` with the tail of npm's output
 */
export async function installDriver(body = {}) {
	const name = String(body.name ?? "");
	if (!DRIVER_MODULES.has(name)) throw new Error(`not an installable driver: ${name || "(none)"}`);
	const cwd = String(body.cwd ?? "");
	if (cwd === "") throw new Error("an install needs the project directory");
	// A GUI-launched Host often has a PATH without npm (same reason the LSP
	// servers are resolved explicitly), so name the binary instead of hoping.
	const npm = (await findBinary("npm")) ?? "npm";
	const result = await new Promise((resolvePromise) => {
		execFile(npm, ["install", "--no-save", "--no-package-lock", name], { cwd, timeout: 180_000, maxBuffer: 8 * 1024 * 1024, encoding: "utf8" }, (error, stdout, stderr) => {
			resolvePromise({ error, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
		});
	});
	clearBinaryCache();
	const output = `${result.stdout}${result.stderr}`.trim().split("\n").slice(-6).join("\n");
	if (result.error) throw new Error(`npm install ${name} failed: ${(result.stderr || result.error.message).trim().split("\n").slice(-3).join(" ")}`);
	return { name, output };
}
