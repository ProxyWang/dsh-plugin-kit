/** SSH tunnel for database connections, built on the system `ssh`.
 *
 * dbx opens a tunnel from inside its own Rust process. A plugin that shells out
 * to `mysql`/`psql` gets the same result with the `ssh` binary the machine
 * already has: `ssh -N -L 127.0.0.1:<local>:<dbHost>:<dbPort> user@bastion`
 * forwards the database port to a loopback port, and the driver connects there.
 *
 * No `ssh2` dependency, no private keys touched by JavaScript: `ssh -i` reads
 * the file itself, so the plugin never handles key material.
 */

import { spawn } from "node:child_process";
import { createServer, connect } from "node:net";

/** How long to wait for the forwarded port to accept a connection. */
const READY_TIMEOUT_MS = 10_000;

/** Ask the OS for a free loopback port. */
function freePort() {
	return new Promise((resolvePromise, rejectPromise) => {
		const server = createServer();
		server.once("error", rejectPromise);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			server.close(() => resolvePromise(port));
		});
	});
}

/** Whether something accepts TCP connections on the port. */
function probe(port, host = "127.0.0.1") {
	return new Promise((resolvePromise) => {
		const socket = connect({ port, host });
		const done = (value) => { socket.destroy(); resolvePromise(value); };
		socket.setTimeout(300);
		socket.once("connect", () => done(true));
		socket.once("timeout", () => done(false));
		socket.once("error", () => done(false));
	});
}

/**
 * Open a tunnel to a database server.
 *
 * @param options - `{bastion, bastionPort, user, keyPath, targetHost, targetPort}`
 * @returns `{localPort, command, close()}` once the forward is accepting
 */
export async function openTunnel(options) {
	const bastion = String(options.bastion ?? "").trim();
	if (bastion === "") throw new Error("a tunnel needs a jump host");
	const bastionPort = Number(options.bastionPort) || 22;
	const targetHost = String(options.targetHost ?? "").trim();
	if (targetHost === "") throw new Error("a tunnel needs the database host it forwards to");
	const targetPort = Number(options.targetPort) || 0;
	if (!targetPort) throw new Error("a tunnel needs the database port it forwards to");
	const localPort = Number(options.localPort) || await freePort();

	const args = [
		"-N",
		"-o", "ExitOnForwardFailure=yes",
		"-o", "BatchMode=yes",
		"-o", "StrictHostKeyChecking=accept-new",
		"-L", `127.0.0.1:${localPort}:${targetHost}:${targetPort}`,
		"-p", String(bastionPort),
	];
	if (String(options.keyPath ?? "").trim() !== "") args.push("-i", String(options.keyPath).trim());
	const destination = String(options.user ?? "").trim() === "" ? bastion : `${String(options.user).trim()}@${bastion}`;
	args.push(destination);

	const child = spawn("ssh", args, { stdio: ["ignore", "ignore", "pipe"] });
	let stderr = "";
	child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
	const exited = new Promise((resolvePromise) => child.once("exit", (code) => resolvePromise(code)));

	// `spawn` reports a missing binary asynchronously; surface it as a rejection.
	const spawnError = new Promise((_, rejectPromise) => child.once("error", (error) => rejectPromise(new Error(`ssh failed: ${String(error?.message ?? error)}`))));

	const deadline = Date.now() + READY_TIMEOUT_MS;
	const ready = (async () => {
		while (Date.now() < deadline) {
			if (child.exitCode !== null) return false;
			if (await probe(localPort)) return true;
			await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
		}
		return false;
	})();

	let ok;
	try {
		ok = await Promise.race([ready, spawnError.then(() => false)]);
	} catch (error) {
		try { child.kill("SIGKILL"); } catch { /* already gone */ }
		throw error;
	}
	if (!ok) {
		try { child.kill("SIGKILL"); } catch { /* already gone */ }
		const code = await Promise.race([exited, new Promise((r) => setTimeout(() => r(null), 500))]);
		throw new Error(`ssh tunnel did not come up${code === null ? "" : ` (ssh exit ${code})`}${stderr.trim() === "" ? "" : `: ${stderr.trim().split("\n")[0]}`}`);
	}

	return {
		localPort,
		command: `ssh ${args.join(" ")}`,
		close() {
			try { child.kill("SIGTERM"); } catch { /* already gone */ }
		},
	};
}