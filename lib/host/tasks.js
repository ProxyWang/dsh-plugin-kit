/**
 * Workspace task runner: run a package.json script and stream its output to
 * the panel through the same long-poll pattern as watch.poll.
 *
 * Fences that matter:
 * - Only a script name that EXISTS in the workspace package.json "scripts"
 *   can start — the palette lists what the host read, the runner re-checks,
 *   so a hand-built request cannot smuggle an arbitrary command.
 * - `npm run <name>` spawns without a shell; the name is shape-checked first.
 * - Output is capped per job (ring buffer keeping the tail); a capped job
 *   reports `dropped` + a byte `baseSeq` so the panel re-renders rather than
 *   appending onto a partial view.
 * - Jobs die with the plugin effect; running npm wrappers are SIGTERM'd then
 *   SIGKILLed after a grace window.
 */

import { spawn } from "node:child_process";
import { realpath, readFile } from "node:fs/promises";
import { join } from "node:path";

const SCRIPT_RE = /^[A-Za-z0-9:._+-]{1,64}$/;
const OUT_CAP = 1024 * 1024; // retained bytes per job (tail)
const JOB_CAP = 12; // concurrent + retained finished jobs
const FINISHED_TTL_MS = 10 * 60_000;
const DEFAULT_WAIT_MS = 20_000;
const MAX_WAIT_MS = 29_000;

const jobs = new Map(); // id → job
let nextId = 1;

function wake(job) {
	for (const waiter of [...job.waiters]) {
		// A cursor older than the retained window can't be replayed: answer a
		// reset so the consumer re-renders from the tail it receives.
		if (waiter.since < job.baseSeq - 1 || job.outSeq > waiter.since || job.done) deliver(job, waiter);
	}
}

function deliver(job, waiter) {
	job.waiters.delete(waiter);
	waiter.cancel?.();
	waiter.resolve(snap(job, waiter.since, {}));
}

/** Byte-cursor snapshot: replay the parts after `since`, or everything on reset. */
function snap(job, since, extra) {
	const reset = since < job.baseSeq - 1;
	const chunks = [];
	if (reset) {
		for (const part of job.parts) chunks.push(part);
	} else {
		let consumed = 0;
		for (const part of job.parts) {
			if (consumed + part.text.length <= since - job.baseSeq) {
				consumed += part.text.length;
				continue;
			}
			const cut = Math.max(0, since - job.baseSeq - consumed);
			chunks.push(cut > 0 ? { stream: part.stream, text: part.text.slice(cut) } : part);
			consumed += part.text.length;
		}
	}
	return { id: job.id, script: job.script, seq: job.outSeq, baseSeq: job.baseSeq, done: job.done, code: job.code, dropped: job.dropped, reset, chunks, ...extra };
}

async function readScripts(root) {
	let raw;
	try {
		raw = await readFile(join(root, "package.json"), "utf8");
	} catch {
		return { error: "no package.json in this workspace" };
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { error: "package.json is not valid JSON" };
	}
	const scripts = parsed?.scripts;
	if (!scripts || typeof scripts !== "object") return { scripts: {} };
	const clean = {};
	for (const [name, command] of Object.entries(scripts)) {
		if (typeof command === "string") clean[name] = command;
	}
	return { scripts: clean };
}

function trimJobs() {
	const now = Date.now();
	for (const [id, job] of jobs) {
		if (job.done && now - (job.finishedAt ?? now) > FINISHED_TTL_MS && job.waiters.size === 0) jobs.delete(id);
	}
	while (jobs.size >= JOB_CAP) {
		const oldest = jobs.keys().next().value;
		const job = jobs.get(oldest);
		if (job && !job.done) {
			try {
				job.child?.kill("SIGTERM");
			} catch { /* gone */ }
		}
		jobs.delete(oldest);
	}
}

async function startTask(body) {
	const cwd = String(body.cwd ?? "");
	const script = String(body.script ?? "");
	if (cwd === "") throw new Error("cwd is required");
	if (!SCRIPT_RE.test(script)) return { error: "invalid script name" };
	const root = await realpath(cwd);
	const scripts = await readScripts(root);
	if (scripts.error) return scripts;
	if (!Object.hasOwn(scripts.scripts, script)) return { error: `script not found in package.json: ${script}` };
	trimJobs();
	const job = {
		id: String(nextId++),
		script,
		parts: [],
		bytes: 0,
		baseSeq: 0, // bytes dropped from the front of the retained window
		outSeq: 0, // bytes appended in total (the cursor the panel tracks)
		dropped: false,
		done: false,
		code: null,
		waiters: new Set(),
		child: null,
		finishedAt: null,
	};
	const append = (stream) => (buf) => {
		const text = buf.toString("utf8");
		if (text === "") return;
		job.parts.push({ stream, text });
		job.outSeq += text.length;
		job.bytes += text.length;
		while (job.bytes > OUT_CAP && job.parts.length > 1) {
			const droppedPart = job.parts.shift();
			job.bytes -= droppedPart.text.length;
			job.baseSeq += droppedPart.text.length;
			job.dropped = true;
		}
		wake(job);
	};
	let child;
	try {
		child = spawn("npm", ["run", script], { cwd: root, env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] });
	} catch (error) {
		return { error: `spawn failed: ${String(error?.message ?? error)}` };
	}
	job.child = child;
	child.stdout?.on?.("data", append("out"));
	child.stderr?.on?.("data", append("err"));
	child.on("error", (error) => {
		const text = `\n[spawn error] ${String(error?.message ?? error)}\n`;
		job.parts.push({ stream: "err", text });
		job.outSeq += text.length;
		job.done = true;
		job.code = -1;
		job.finishedAt = Date.now();
		wake(job);
	});
	child.on("close", (code) => {
		job.done = true;
		job.code = typeof code === "number" ? code : 130;
		job.finishedAt = Date.now();
		wake(job);
	});
	jobs.set(job.id, job);
	return { id: job.id, script };
}

async function pollTask(body, ctx) {
	const job = jobs.get(String(body.id ?? ""));
	if (!job) return { error: "unknown job" };
	const since = Number.isInteger(body.since) && body.since >= 0 ? body.since : 0;
	const wantWait = Math.min(Math.max(Number(body.waitMs) || DEFAULT_WAIT_MS, 1), MAX_WAIT_MS);
	if (since < job.baseSeq - 1 || job.outSeq > since || job.done) return snap(job, since, {});
	return new Promise((resolvePromise) => {
		const waiter = { since, resolve: resolvePromise, cancel: null };
		const hold = setTimeout(() => {
			if (!job.waiters.has(waiter)) return;
			job.waiters.delete(waiter);
			resolvePromise(snap(job, since, { beat: true }));
		}, wantWait);
		waiter.cancel = () => clearTimeout(hold);
		if (ctx?.res && typeof ctx.res.on === "function" && ctx.res.writableFinished === false) ctx.res.on("close", () => waiter.cancel());
		job.waiters.add(waiter);
	});
}

function killTask(body) {
	const job = jobs.get(String(body.id ?? ""));
	if (!job) return { error: "unknown job" };
	if (job.done) return { ok: true, already: true };
	try {
		job.child?.kill("SIGTERM");
	} catch { /* gone */ }
	const graced = setTimeout(() => {
		try {
			if (!job.done) job.child?.kill("SIGKILL");
		} catch { /* gone */ }
	}, 3000);
	graced.unref?.();
	return { ok: true };
}

async function scriptsFor(body) {
	const cwd = String(body.cwd ?? "");
	if (cwd === "") throw new Error("cwd is required");
	const root = await realpath(cwd);
	const scripts = await readScripts(root);
	if (scripts.error) return scripts;
	const running = {};
	for (const job of jobs.values()) if (!job.done) running[job.script] = (running[job.script] ?? 0) + 1;
	return { scripts: scripts.scripts, running };
}

function listJobs() {
	const out = [];
	for (const job of jobs.values()) out.push({ id: job.id, script: job.script, done: job.done, code: job.code });
	return out;
}

function stopAllTasks() {
	for (const job of jobs.values()) {
		try {
			if (!job.done) job.child?.kill("SIGTERM");
		} catch { /* gone */ }
		for (const waiter of [...job.waiters]) {
			job.waiters.delete(waiter);
			waiter.cancel?.();
			waiter.resolve(snap(job, waiter.since, { done: true }));
		}
	}
	jobs.clear();
}

export { startTask, pollTask, killTask, scriptsFor, listJobs, stopAllTasks, jobs, snap };
