/**
 * Open the operating system's own terminal in a workspace directory.
 *
 * DSH's embedded terminal is an xterm.js screen inside the Web UI. That is the
 * right tool for a quick command, but the plugin cannot repair its host-side
 * renderer (dropped row repaints while the pane is off-viewport, repaired only
 * by a full repaint the Client cannot request), and a full-screen TUI — vim,
 * lazygit, htop, a nested `dsh` — is exactly the workload that exposes it. So
 * the workspace offers the platform terminal instead: a real, native window the
 * operating system owns, with no stream, no cell grid and no renderer to fall
 * behind.
 *
 * Two rules keep this safe:
 *   - the directory comes from the Session workspace and must be an existing
 *     directory; nothing here can create one or write into it;
 *   - selection is a probe, not a guess: an app or binary that cannot be found
 *     is never spawned, and the failure names what was tried so the Client can
 *     say so instead of silently doing nothing.
 *
 * Every launch is detached: the terminal window outlives the Host request, and
 * nothing in this module keeps the plugin's process alive.
 */

import { spawn } from "node:child_process";
import { constants as FS } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

/** Apps probed in order on macOS; the first installed one wins. */
const MAC_APPS = ["iTerm", "Terminal"];

/**
 * Linux terminals with a working-directory flag, most specific first. The
 * fallbacks take an `-e` command because they have no directory flag.
 */
const LINUX_TERMINALS = [
	{ bin: "kitty", args: (dir) => ["--directory", dir] },
	{ bin: "wezterm", args: (dir) => ["start", "--cwd", dir] },
	{ bin: "alacritty", args: (dir) => ["--working-directory", dir] },
	{ bin: "gnome-terminal", args: (dir) => [`--working-directory=${dir}`] },
	{ bin: "konsole", args: (dir) => ["--workdir", dir] },
	{ bin: "xfce4-terminal", args: (dir) => [`--working-directory=${dir}`] },
	{ bin: "x-terminal-emulator", args: (dir) => ["-e", ...shellIn(dir)] },
	{ bin: "xterm", args: (dir) => ["-e", ...shellIn(dir)] },
];

/** `sh -c` payload that changes into the directory and hands over to the user's shell. */
function shellIn(dir) {
	return ["/bin/sh", "-c", 'cd "$1" && exec "${SHELL:-/bin/sh}"', "sh", dir];
}

/** An explicit app name configured by the user, or "" to probe. */
let configuredApp = "";

/**
 * Record the terminal application the deployment prefers.
 * @param app - macOS application name, or "" to probe the default order.
 */
export function setExternalTerminalApp(app) {
	configuredApp = typeof app === "string" ? app.trim() : "";
}

/**
 * Spawn a detached helper and resolve with its exit code, without inheriting
 * stdio or tying the terminal window to this process.
 * @param bin - executable to run.
 * @param args - its arguments.
 * @returns exit code, or null when it could not be spawned.
 */
function runQuiet(bin, args) {
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn(bin, args, { stdio: "ignore", detached: false });
		} catch {
			resolve(null);
			return;
		}
		let settled = false;
		const done = (code) => {
			if (settled) return;
			settled = true;
			resolve(code);
		};
		child.on("error", () => done(null));
		child.on("close", (code) => done(code));
	});
}

/**
 * Launch a detached process that must outlive this request.
 * @param bin - executable to run.
 * @param args - its arguments.
 * @returns whether the spawn was accepted (a missing binary reports false).
 */
function launchDetached(spawnImpl, bin, args) {
	try {
		const child = spawnImpl(bin, args, { stdio: "ignore", detached: true });
		child.on("error", () => {});
		child.unref();
		return true;
	} catch {
		return false;
	}
}

/**
 * Whether an executable is reachable on PATH.
 * @param bin - command name.
 * @returns whether a matching regular file exists in PATH.
 */
async function onPath(bin) {
	const pathValue = process.env.PATH ?? "";
	const dirs = pathValue.split(process.platform === "win32" ? ";" : ":").filter(Boolean);
	for (const dir of dirs) {
		try {
			await access(join(dir, bin), FS.X_OK);
			return true;
		} catch { /* keep looking */ }
	}
	return false;
}

/**
 * Validate the requested directory without creating anything.
 * @param cwd - absolute directory supplied by the Client.
 * @returns its real path.
 * @throws Error when it is missing, relative, or not a directory.
 */
async function resolveDirectory(cwd) {
	if (typeof cwd !== "string" || cwd === "") throw new Error("cwd is required");
	const abs = await realpath(cwd);
	const info = await stat(abs);
	if (!info.isDirectory()) throw new Error(`not a directory: ${abs}`);
	return abs;
}

/**
 * Open the platform terminal in a directory.
 *
 * @param request - the workspace directory and an optional app override.
 * @returns the launcher used and the directory it opened in.
 * @throws Error when no terminal could be found or started.
 */
export async function openExternalTerminal({ cwd, app = "" } = {}, {
	platform = process.platform,
	spawnImpl = spawn,
	runProbe = runQuiet,
	hasBinary = onPath,
} = {}) {
	const dir = await resolveDirectory(cwd);
	const preferred = (typeof app === "string" && app.trim() !== "" ? app.trim() : configuredApp);
	if (platform === "darwin") {
		const candidates = preferred === "" ? MAC_APPS : [preferred, ...MAC_APPS.filter((name) => name !== preferred)];
		const tried = [];
		for (const name of candidates) {
			// `open -Ra` is LaunchServices' "where is this app" probe: exit 0 only
			// when the name resolves, and it never activates the application.
			if (await runProbe("open", ["-Ra", name]) !== 0) {
				tried.push(name);
				continue;
			}
			if (launchDetached(spawnImpl, "open", ["-a", name, dir])) return { app: name, cwd: dir, launcher: "open" };
			tried.push(name);
		}
		throw new Error(`no terminal application found (tried: ${tried.join(", ")})`);
	}
	if (platform === "win32") {
		// Windows Terminal when present, else a plain console window.
		if (await hasBinary("wt.exe") && launchDetached(spawnImpl, "wt.exe", ["-d", dir])) return { app: "Windows Terminal", cwd: dir, launcher: "wt.exe" };
		const command = `cd /d "${dir.replace(/"/g, '""')}"`;
		if (launchDetached(spawnImpl, "cmd.exe", ["/c", "start", "", "cmd.exe", "/K", command])) return { app: "Command Prompt", cwd: dir, launcher: "cmd.exe" };
		throw new Error("no terminal could be started (tried: wt.exe, cmd.exe)");
	}
	const tried = [];
	for (const candidate of LINUX_TERMINALS) {
		if (!(await hasBinary(candidate.bin))) {
			tried.push(candidate.bin);
			continue;
		}
		if (launchDetached(spawnImpl, candidate.bin, candidate.args(dir))) return { app: candidate.bin, cwd: dir, launcher: candidate.bin };
		tried.push(candidate.bin);
	}
	throw new Error(`no terminal emulator found (tried: ${tried.join(", ")})`);
}
