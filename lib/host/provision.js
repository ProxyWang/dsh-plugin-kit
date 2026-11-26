/**
 * Provisioning for the one external binary the Go language features need.
 *
 * Editors ship their own language server (Trae wires a pinned `trae-gopls`
 * through `go.alternateTools`); a plugin cannot rely on the user's PATH, and
 * Desktop hosts start with the short GUI environment. Installing `gopls` into
 * the plugin's own cache from the user's Go toolchain is the no-download,
 * license-clean equivalent: one command installs the plugin, and the first Go
 * file opened builds the server once (~30–60 s) into
 * `$DSH_HOME/cache/dsh-plugin-kit/gopls/<version>/`.
 *
 * The state machine is deliberately observable: `lsp.warmup` returns
 * `provisioning`, the status bar explains what is happening, and a failed
 * install records the last Git/Go output instead of silently dropping Go
 * support.
 */

import { execFile } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { findBinary } from "./binpath.js";

/** gopls release this plugin provisions; bump together with the plugin. */
export const GOPLS_VERSION = "v0.22.0";

const state = { state: "idle", message: "", error: "", version: GOPLS_VERSION, startedAt: 0, finishedAt: 0 };
let running = null;
let auto = true;

/**
 * Apply provisioning settings from the Host plugin's config.
 * @param next - `{auto}`; false disables the automatic install.
 */
export function setProvisionOptions(next = {}) {
	if (typeof next.auto === "boolean") auto = next.auto;
}

/** DSH home (`$DSH_HOME`, else `~/.dsh`). */
function dshHome() {
	const configured = process.env.DSH_HOME;
	return typeof configured === "string" && configured !== "" ? configured : join(homedir(), ".dsh");
}

/** Directory the provisioned gopls lives in. */
export function goplsCacheDir() {
	return join(dshHome(), "cache", "dsh-plugin-kit", "gopls", GOPLS_VERSION);
}

/** Absolute path of a provisioned gopls, or "" when it is not installed yet. */
export function provisionedGopls() {
	const file = join(goplsCacheDir(), process.platform === "win32" ? "gopls.exe" : "gopls");
	try {
		accessSync(file, constants.X_OK);
		return file;
	} catch {
		return process.platform === "win32" && existsSync(file) ? file : "";
	}
}

/** Current provisioning state (for `lsp.stats` and the status surface). */
export function goplsProvisionState() {
	// A ready binary on disk is the truth, even if this process never installed
	// it (a previous session, or the user dropped it into the cache).
	if (state.state !== "ready" && provisionedGopls() !== "") {
		state.state = "ready";
		state.message = provisionedGopls();
	}
	return { ...state, auto };
}

/**
 * Ensure gopls is installed in the plugin cache. Idempotent and single-flight:
 * concurrent callers share one `go install`. Returns immediately with the
 * current state; completion is observed through {@link goplsProvisionState}.
 */
export function provisionGopls() {
	if (!auto) {
		state.state = "disabled";
		state.message = "automatic gopls install is disabled (config: provisionLanguageServers)";
		return goplsProvisionState();
	}
	if (provisionedGopls() !== "") {
		if (state.state !== "ready") {
			state.state = "ready";
			state.message = provisionedGopls();
		}
		return goplsProvisionState();
	}
	if (running !== null) return goplsProvisionState();
	const go = findBinary("go", {});
	if (go === null) {
		state.state = "failed";
		state.error = "Go toolchain not found on PATH; install Go, restart Desktop, and Go language features will install gopls themselves";
		state.message = state.error;
		return goplsProvisionState();
	}
	state.state = "installing";
	state.message = `installing gopls ${GOPLS_VERSION} (one-time, 30–60 s)…`;
	state.startedAt = Date.now();
	state.finishedAt = 0;
	state.error = "";
	const cacheDir = goplsCacheDir();
	running = new Promise((resolve) => {
		try {
			mkdirSync(cacheDir, { recursive: true });
		} catch { /* the install reports the real failure */ }
		execFile(go, ["install", `golang.org/x/tools/gopls@${GOPLS_VERSION}`], {
			env: { ...process.env, GOBIN: cacheDir },
			timeout: 300_000,
			maxBuffer: 8 * 1024 * 1024,
		}, (error, stdout, stderr) => {
			running = null;
			state.finishedAt = Date.now();
			const installed = provisionedGopls();
			if (error !== null || installed === "") {
				const raw = String(stderr || stdout || error?.message || "").trim();
				// gopls releases pin a minimum Go version (v0.22 needs Go 1.26);
				// say so instead of surfacing a raw toolchain complaint.
				const needs = /requires go[^\n]*?(\d+\.\d+)/i.exec(raw);
				state.state = "failed";
				state.error = needs !== null
					? `gopls ${GOPLS_VERSION} needs Go >= ${needs[1]} (this machine has an older toolchain); upgrade Go, or point goplsCommand at an existing gopls`
					: raw.split("\n").slice(-3).join(" ");
				state.message = state.error === "" ? "gopls install failed" : state.error;
			} else {
				state.state = "ready";
				state.message = installed;
			}
			resolve(goplsProvisionState());
		});
	});
	return goplsProvisionState();
}
