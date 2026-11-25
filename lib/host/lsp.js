/** Language-server manager: a descriptor table (Go/TS-JS/Python), one lazily-spawned server per project root per language, JSON-RPC framing over stdio, document sync, diagnostics/progress tracking, and symbol requests. */

import { spawn } from "node:child_process";
import { access, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { LSP_FIRST_TIMEOUT_MS, LSP_IDLE_MS, LSP_TIMEOUT_MS } from "./constants.js";
import { binaryCandidates, findBinary } from "./binpath.js";
import { delimiter } from "node:path";
import { closeSync, existsSync, openSync, readSync, realpathSync } from "node:fs";
import { readFencedText, resolveReadTarget } from "./fence.js";
import { goplsProvisionState, provisionGopls, provisionedGopls } from "./provision.js";

/** Request-result cache: identical symbol queries inside this window reuse one answer. */
const SYMBOL_CACHE_TTL_MS = 30_000;
/** Bounded result cache per server (LRU-ish insertion order eviction). */
const SYMBOL_CACHE_LIMIT = 64;
/** How many roots a language keeps resident before the least recently used is stopped. */
const DEFAULT_MAX_SERVERS = 4;

/**
 * Process-wide language-server settings, filled from the Host plugin's config.
 * `goplsCommand` pins (or replaces) the Go server the way editors wire
 * `go.alternateTools.gopls`: a user-installed newer gopls, a vendored build, or
 * a fork. Empty means "whatever is on PATH".
 */
const options = { goplsCommand: "", idleMs: 0, maxServers: DEFAULT_MAX_SERVERS };

/**
 * Apply settings from the Host plugin's config (called once at apply time).
 * @param next - `{goplsCommand, idleMs, maxServers}`; omitted fields keep their value.
 */
export function setLspOptions(next = {}) {
	if (typeof next.goplsCommand === "string") options.goplsCommand = next.goplsCommand.trim();
	if (Number.isFinite(next.idleMs) && next.idleMs > 0) options.idleMs = next.idleMs;
	if (Number.isFinite(next.maxServers) && next.maxServers > 0) options.maxServers = Math.trunc(next.maxServers);
}

/** The idle timeout actually in force (config, else the module default). */
function idleMs() {
	return options.idleMs > 0 ? options.idleMs : LSP_IDLE_MS;
}

/** The `node` the interpreter itself runs on, resolved once. */
let nodeBinary;
function nodeExecutable() {
	if (nodeBinary !== undefined) return nodeBinary;
	nodeBinary = findBinary("node");
	return nodeBinary;
}

/** Whether a file starts with a `#!…node` shebang. */
function nodeShebang(file) {
	try {
		const fd = openSync(file, "r");
		const head = Buffer.alloc(96);
		const read = readSync(fd, head, 0, head.length, 0);
		closeSync(fd);
		const first = head.subarray(0, read).toString("utf8").split("\n")[0];
		return first.startsWith("#!") && /\bnode\b/.test(first);
	} catch {
		return false;
	}
}

/**
 * Turn a launcher into the argv actually spawned.
 *
 * An npm-installed language server is a `.mjs` shebang script. Running it
 * directly needs `env node` on the PATH, which a Desktop Host started from
 * Finder does not have — the spawn then fails with ENOENT on a file that
 * plainly exists. When the target is such a script, it is started with the
 * Node we resolved instead, so the interpreter is a concrete path.
 *
 * @param launcher - `{command, args}`
 * @returns `{command, args}` to hand to `spawn`
 */
function interpretLauncher(launcher) {
	const args = launcher.args ?? [];
	if (!nodeShebang(launcher.command)) return { command: launcher.command, args };
	const node = nodeExecutable();
	if (node === null) return { command: launcher.command, args };
	return { command: node, args: [launcher.command, ...args] };
}

/**
 * The environment a language server is spawned with.
 *
 * Two things matter here. The descriptor may add variables (`GOFLAGS`), and —
 * more subtly — an npm-installed server is a shebang script whose interpreter
 * is `#!/usr/bin/env node`. A Desktop Host started from Finder has a short
 * PATH without node, so the spawn fails with ENOENT even though the file is
 * right there. Putting the running runtime's own directory first makes
 * `env node` resolve to the Node the Host itself runs on.
 */
function spawnEnv(extra = {}) {
	const nodeDir = dirname(process.execPath);
	const path = `${nodeDir}${delimiter}${process.env.PATH ?? ""}`;
	return { ...process.env, PATH: path, ...extra };
}

/** Plugin package root (`lib/host/` → the package). */
const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Binaries installed as this plugin's own dependencies (`node_modules/.bin`) or
 * shipped with it. Language servers land here so the plugin is self-contained
 * after one install, without touching the user's global PATH.
 * @param name - executable name.
 * @returns candidate paths for the plugin-local copy.
 */
function pluginBinCandidates(name) {
	const bin = join(PLUGIN_ROOT, "node_modules", ".bin", name);
	const candidates = process.platform === "win32" ? [`${bin}.cmd`, `${bin}.exe`, bin] : [bin];
	// pnpm puts a package's own bins inside its virtual-store directory and the
	// package path is a symlink. A pnpm bin shim resolves its target relative to
	// its own directory, so running it through the symlink path breaks; run the
	// realstore copy instead.
	return candidates.map((candidate) => {
		try {
			return realpathSync(candidate);
		} catch {
			return candidate;
		}
	});
}

/** Go's own install locations, ahead of the generic lookup. */
function goplsExtras() {
	const home = homedir();
	const list = [];
	// The plugin-provisioned server wins: it is the pinned version whose file
	// cache and warm-up behaviour the rest of this module assumes.
	const provisioned = provisionedGopls();
	if (provisioned !== "") list.push(provisioned);
	for (const candidate of pluginBinCandidates("gopls")) list.push(candidate);
	if (process.env.GOBIN) list.push(join(process.env.GOBIN, "gopls"));
	if (process.env.GOPATH) {
		for (const part of String(process.env.GOPATH).split(":")) {
			if (part !== "") list.push(join(part, "bin", "gopls"));
		}
	}
	list.push(join(home, "gopath", "bin", "gopls"));
	list.push(join(home, "go", "bin", "gopls"));
	return list;
}

/**
 * Language server table. Launchers are tried in order; the first that spawns
 * and completes `initialize` wins. rootMarkers drive per-project rooting (a
 * server is shared by every file under one project root). exts gate which
 * file paths route to the server. Missing binaries degrade gracefully: the
 * server ends in state "error" and routes surface a note instead of hanging.
 */
const LANGUAGE_SERVERS = [
	{
		id: "go",
		label: "gopls",
		exts: new Set([".go"]),
		launchers: (root) => options.goplsCommand !== ""
			? [{ command: options.goplsCommand, args: ["serve"] }]
			: binaryCandidates("gopls", { root, extras: goplsExtras() }).map((command) => ({ command, args: ["serve"] })),
		env: () => ({ GOFLAGS: process.env.GOFLAGS ?? "" }),
		rootMarkers: ["go.mod", "go.work"],
		install: "go install golang.org/x/tools/gopls@latest",
	},
	{
		id: "ts",
		label: "typescript-language-server",
		exts: new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]),
		// A project-pinned server wins; the plugin's own dependency is the fallback
		// that makes the "one command install" self-contained.
		launchers: (root) => [
			...binaryCandidates("typescript-language-server", { root }).map((command) => ({ command, args: ["--stdio"] })),
			...pluginBinCandidates("typescript-language-server").map((command) => ({ command, args: ["--stdio"] })),
		],
		env: () => ({}),
		rootMarkers: ["package.json", "tsconfig.json", "jsconfig.json"],
		install: "npm i -g typescript-language-server typescript  (or add it to the project: npx --yes typescript-language-server --stdio)",
	},
	{
		id: "py",
		label: "pyright",
		exts: new Set([".py", ".pyi"]),
		launchers: (root) => [
			...binaryCandidates("pyright-langserver", { root }).map((command) => ({ command, args: ["--stdio"] })),
			...pluginBinCandidates("pyright-langserver").map((command) => ({ command, args: ["--stdio"] })),
			...binaryCandidates("pylsp", { root }).map((command) => ({ command, args: [] })),
			...pluginBinCandidates("pylsp").map((command) => ({ command, args: [] })),
		],
		env: () => ({}),
		rootMarkers: ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile"],
		install: "pip install pyright  (or: npm i -g pyright)",
	},
];

/** Descriptor for a file path's extension, or null when no server covers it. */
function descriptorForPath(path) {
	const dot = String(path).lastIndexOf(".");
	if (dot < 0) return null;
	const ext = String(path).slice(dot).toLowerCase();
	for (const descriptor of LANGUAGE_SERVERS) {
		if (descriptor.exts.has(ext)) return descriptor;
	}
	return null;
}

class LspServer {
	constructor(descriptor, root) {
		this.descriptor = descriptor;
		this.label = descriptor.label;
		this.root = root;
		this.rootUri = pathToFileURL(root).href;
		this.child = null;
		this.state = "off"; // off | starting | ready | error
		this.message = "";
		this.seq = 0;
		this.pending = new Map();
		this.buffer = Buffer.alloc(0);
		this.docs = new Map(); // uri → {version, mtimeMs, path}
		this.diagnostics = new Map(); // uri → items[]
		this.progress = new Map(); // token → {title, message, percentage}
		this.idleTimer = null;
		this.candidates = descriptor.launchers(root);
		this.candidateIndex = 0;
		this.command = "";
		this.createdAt = Date.now();
		this.lastUsed = Date.now();
		this.requests = 0;
		this.errors = 0;
		this.cacheHits = 0;
		this.cacheMisses = 0;
		this.cache = new Map(); // query key → {at, value}
		this.inflight = new Map(); // query key → promise
	}

	touchIdle() {
		this.lastUsed = Date.now();
		if (this.idleTimer) clearTimeout(this.idleTimer);
		this.idleTimer = setTimeout(() => this.stop("idle"), idleMs());
		this.idleTimer.unref?.();
	}

	async ensureStarted() {
		if (this.state === "ready") return;
		if (this.state === "starting") {
			await this.startPromise;
			return;
		}
		this.state = "starting";
		this.startPromise = this.start();
		try {
			await this.startPromise;
			this.state = "ready";
			this.message = "";
		} catch (error) {
			this.state = "error";
			this.message = String(error?.message ?? error);
			this.startPromise = null;
			throw error;
		}
	}

	async start() {
		// The most useful failure wins: a candidate that failed to spawn is just
		// "not this path", while a server that STARTED and then refused (a
		// missing `typescript`, an unsupported version) is the real answer. That
		// distinction used to be lost because the last error overwrote the first.
		let informative = null;
		let sawCandidate = false;
		for (let i = this.candidateIndex; i < this.candidates.length; i++) {
			const launcher = this.candidates[i];
			sawCandidate = true;
			try {
				await this.spawnAndInitialize(launcher);
				this.candidateIndex = i;
				return;
			} catch (error) {
				if (process.env.DSH_LSP_DEBUG) console.error("[lsp]", i, launcher.command, error?.code, error?.message);
				if (error?.code !== "ENOENT" && informative === null) informative = error;
			}
		}
		if (informative !== null) throw informative;
		const hint = this.descriptor.install ? ` — install it with: ${this.descriptor.install}` : "";
		throw new Error(`${this.label} is not installed (or not on PATH)${hint}${sawCandidate ? "" : " (no candidate path)"}`);
	}

	spawnAndInitialize(launcher) {
		return new Promise((resolvePromise, rejectPromise) => {
			let child;
			try {
				const launch = interpretLauncher(launcher);
				this.command = launch.command;
				child = spawn(launch.command, launch.args, {
					cwd: this.root,
					env: spawnEnv(this.descriptor.env()),
					stdio: ["pipe", "pipe", "pipe"],
				});
			} catch (error) {
				rejectPromise(error);
				return;
			}
			let settled = false;
			const fail = (error) => {
				if (settled) return;
				settled = true;
				try {
					child.kill("SIGKILL");
				} catch {}
				rejectPromise(error);
			};
			child.once("error", fail);
			this.child = child;
			child.stdout.on("data", (chunk) => this.onBytes(chunk));
			child.stderr.resume();
			child.on("exit", () => {
				if (this.child === child) {
					this.state = "off";
					this.child = null;
					for (const entry of this.pending.values()) entry.reject(new Error(`${this.label} exited`));
					this.pending.clear();
					this.docs.clear();
				}
				fail(new Error(`${this.label} exited before ready`));
			});
			const initId = this.nextId();
			this.pending.set(initId, {
				resolve: () => {
					this.notify("initialized", {});
					if (!settled) {
						settled = true;
						resolvePromise();
					}
				},
				reject: fail,
				timer: setTimeout(() => fail(new Error(`${this.label} initialize timeout`)), LSP_FIRST_TIMEOUT_MS),
			});
			this.write({
				jsonrpc: "2.0",
				id: initId,
				method: "initialize",
				params: {
					processId: null,
					clientInfo: { name: "dsh-code-explorer", version: "1.0.0" },
					rootUri: this.rootUri,
					capabilities: {
						textDocument: {
							definition: { linkSupport: false },
							typeDefinition: { linkSupport: false },
							implementation: { linkSupport: false },
							references: {},
							formatting: {},
							documentSymbol: { hierarchicalDocumentSymbolSupport: true },
							hover: { contentFormat: ["markdown", "plaintext"] },
							publishDiagnostics: { relatedInformation: true, versionSupport: false },
							synchronization: { dynamicRegistration: false },
						},
						window: { workDoneProgress: true },
						workspace: {
							didChangeWatchedFiles: { dynamicRegistration: false },
							configuration: false,
							symbol: {
								dynamicRegistration: false,
								symbolKind: { valueSet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26] },
								resolveSupport: { properties: ["location.range"] },
							},
						},
					},
					workspaceFolders: [{ uri: this.rootUri, name: basename(this.root) }],
					initializationOptions: {},
				},
			});
		});
	}

	nextId() {
		return ++this.seq;
	}

	write(message) {
		if (!this.child?.stdin?.writable) throw new Error(`${this.label} is not running`);
		const body = Buffer.from(JSON.stringify(message), "utf8");
		this.child.stdin.write(Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"));
		this.child.stdin.write(body);
	}

	notify(method, params) {
		try {
			this.write({ jsonrpc: "2.0", method, params });
		} catch {}
	}

	/**
	 * Notify the server that workspace files changed on disk (the watch hub's
	 * batch). gopls and typescript-language-server honour this to refresh their
	 * internal file cache so diagnostics/symbols reflect Agent or terminal edits
	 * without waiting for the next manual open.
	 */
	notifyWatchedFiles(changes) {
		if (!Array.isArray(changes) || changes.length === 0) return;
		const lspChanges = changes.map((c) => ({
			uri: pathToFileURL(c.path.startsWith("/") ? c.path : join(this.root, c.path)).href,
			type: c.type ?? 2, // 1=created, 2=changed, 3=deleted
		}));
		this.notify("workspace/didChangeWatchedFiles", { changes: lspChanges });
	}

	request(method, params, timeoutMs = LSP_TIMEOUT_MS) {
		return new Promise((resolvePromise, rejectPromise) => {
			let id;
			try {
				id = this.nextId();
				this.write({ jsonrpc: "2.0", id, method, params });
			} catch (error) {
				rejectPromise(error);
				return;
			}
			this.pending.set(id, {
				resolve: resolvePromise,
				reject: rejectPromise,
				timer: setTimeout(() => {
					this.pending.delete(id);
					this.errors += 1;
					rejectPromise(new Error(`LSP request "${method}" timed out`));
				}, timeoutMs),
			});
			this.requests += 1;
		});
	}

	onBytes(chunk) {
		this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
		for (;;) {
			const headerEnd = this.buffer.indexOf("\r\n\r\n", 0, "ascii");
			if (headerEnd < 0) return;
			const header = this.buffer.subarray(0, headerEnd).toString("ascii");
			const match = /content-length:\s*(\d+)/i.exec(header);
			if (!match) {
				this.buffer = this.buffer.subarray(headerEnd + 4);
				continue;
			}
			const length = Number(match[1]);
			const total = headerEnd + 4 + length;
			if (this.buffer.length < total) return;
			const body = this.buffer.subarray(headerEnd + 4, total);
			this.buffer = this.buffer.subarray(total);
			let message;
			try {
				message = JSON.parse(body.toString("utf8"));
			} catch {
				continue;
			}
			this.handleMessage(message);
		}
	}

	handleMessage(message) {
		if (message?.id !== undefined && message.method === undefined) {
			const entry = this.pending.get(message.id);
			if (entry) {
				this.pending.delete(message.id);
				clearTimeout(entry.timer);
				if (message.error) entry.reject(new Error(message.error.message ?? "LSP error"));
				else entry.resolve(message.result);
			}
			return;
		}
		if (message?.id !== undefined && message.method) {
			// Server-to-client request: decline politely.
			try {
				this.write({ jsonrpc: "2.0", id: message.id, result: message.method === "workspace/configuration" ? [] : null });
			} catch {}
			return;
		}
		if (message?.method === "$/progress") {
			const p = message.params ?? {};
			if (typeof p.token === "string" || typeof p.token === "number") {
				const kind = p.value?.kind;
				if (kind === "begin") this.progress.set(String(p.token), { title: String(p.value.title ?? "gopls"), message: p.value.message ? String(p.value.message) : "", percentage: Number.isFinite(p.value.percentage) ? p.value.percentage : undefined });
				else if (kind === "report") this.progress.set(String(p.token), { title: String(p.value.title ?? this.progress.get(String(p.token))?.title ?? "gopls"), message: p.value.message ? String(p.value.message) : "", percentage: Number.isFinite(p.value.percentage) ? p.value.percentage : undefined });
				else if (kind === "end") this.progress.delete(String(p.token));
			}
			return;
		}
		if (message?.method === "textDocument/publishDiagnostics") {
			const uri = message.params?.uri;
			if (typeof uri === "string") {
				this.diagnostics.set(
					uri,
					(message.params.diagnostics ?? []).map((item) => ({
						line: (item.range?.start?.line ?? 0) + 1,
						startCol: (item.range?.start?.character ?? 0) + 1,
						endCol: (item.range?.end?.character ?? item.range?.start?.character ?? 0) + 1,
						endLine: (item.range?.end?.line ?? item.range?.start?.line ?? 0) + 1,
						severity: item.severity ?? 1,
						message: String(item.message ?? "").split("\n")[0],
						source: item.source ?? "",
						code: item.code === undefined ? "" : String(item.code),
					})),
				);
			}
		}
	}

	/** One-line summary of active work-progress notifications, for status surfaces. */
	progressLine() {
		const parts = [];
		for (const item of this.progress.values()) {
			const pct = item.percentage === undefined ? "" : ` ${item.percentage}%`;
			parts.push(`${item.title}${item.message ? `: ${item.message}` : ""}${pct}`);
			if (parts.length >= 2) break;
		}
		const line = parts.join(" · ");
		return line.length > 220 ? `${line.slice(0, 220)}…` : line;
	}

	async ensureDocument(path) {
		const target = await resolveReadTarget(this.root, path);
		if (!target.stat.isFile()) throw new Error("not a regular file");
		const uri = pathToFileURL(target.filename).href;
		const known = this.docs.get(uri);
		if (known && known.mtimeMs === target.stat.mtimeMs && !known.stale) return { uri, path: target.filename };
		const file = await readFencedText(this.root, path);
		if (file.kind !== "text") throw new Error("binary file");
		const version = (known?.version ?? 0) + 1;
		if (known) {
			this.notify("textDocument/didChange", {
				textDocument: { uri, version },
				contentChanges: [{ text: file.content }],
			});
		} else {
			this.notify("textDocument/didOpen", {
				textDocument: { uri, languageId: languageIdFor(target.filename), version, text: file.content },
			});
		}
		this.docs.set(uri, { version, mtimeMs: target.stat.mtimeMs, path: target.filename, stale: false });
		return { uri, path: target.filename };
	}

	locationToEntry(location) {
		let uri = location.uri ?? location.targetUri;
		const range = location.range ?? location.targetSelectionRange ?? location.targetRange;
		if (typeof uri !== "string" || !range) return null;
		let path;
		try {
			path = fileURLToPath(uri);
		} catch {
			return null;
		}
		return {
			path,
			line: (range.start?.line ?? 0) + 1,
			col: (range.start?.character ?? 0) + 1,
			endLine: (range.end?.line ?? 0) + 1,
			endCol: (range.end?.character ?? 0) + 1,
		};
	}

	/** Format the (disk-current) document through the server's formatter. */
	async formatDocument(path) {
		const doc = await this.ensureDocument(path);
		const edits = await this.request("textDocument/formatting", { textDocument: { uri: doc.uri }, options: { tabSize: 4, insertSpaces: false } }, 8000);
		return Array.isArray(edits) ? edits : [];
	}

	/** Workspace-wide symbol query (VS Code ⌘T): server-side fuzzy list, capped. */
	async workspaceSymbol(query) {
		const result = await this.request("workspace/symbol", { query: String(query ?? "") }, 8000);
		const symbols = [];
		const seen = new Set();
		for (const item of Array.isArray(result) ? result : []) {
			if (!item || typeof item.name !== "string" || item.name === "") continue;
			let path = "";
			let line = 1;
			let col = 1;
			const loc = item.location;
			if (loc && (loc.uri ?? loc.targetUri)) {
				try {
					path = fileURLToPath(loc.uri ?? loc.targetUri);
				} catch {
					path = "";
				}
			}
			if (path === "") continue; // unresolvable WorkspaceSymbol without a location: not navigable
			const range = loc.range ?? loc.targetSelectionRange ?? loc.targetRange;
			if (range) {
				line = (range.start?.line ?? 0) + 1;
				col = (range.start?.character ?? 0) + 1;
			}
			const key = `${item.name}\u0000${path}\u0000${line}`;
			if (seen.has(key)) continue;
			seen.add(key);
			symbols.push({ name: item.name, kind: Number(item.kind ?? 0), container: String(item.containerName ?? ""), path, line, col });
			if (symbols.length >= 200) break;
		}
		return { symbols };
	}

	async symbolRequest(kind, path, line, col) {
		const doc = await this.ensureDocument(path);
		const mtime = this.docs.get(doc.uri)?.mtimeMs ?? 0;
		const key = `${kind}\u0000${doc.uri}\u0000${line}\u0000${col}\u0000${mtime}`;
		const hit = this.cache.get(key);
		if (hit !== undefined && Date.now() - hit.at < SYMBOL_CACHE_TTL_MS) {
			this.cacheHits += 1;
			return hit.value;
		}
		const running = this.inflight.get(key);
		if (running !== undefined) return await running;
		this.cacheMisses += 1;
		const query = this.computeSymbol(kind, doc, line, col).then((value) => {
			this.cache.set(key, { at: Date.now(), value });
			while (this.cache.size > SYMBOL_CACHE_LIMIT) {
				const oldest = this.cache.keys().next().value;
				if (oldest === undefined) break;
				this.cache.delete(oldest);
			}
			return value;
		}).finally(() => {
			this.inflight.delete(key);
		});
		this.inflight.set(key, query);
		return await query;
	}

	async computeSymbol(kind, doc, line, col) {
		if (kind === "symbol") {
			const result = await this.request("textDocument/documentSymbol", { textDocument: { uri: doc.uri } });
			const symbols = [];
			const walk = (node) => {
				if (!node || typeof node.name !== "string") return;
				const sel = node.selectionRange ?? node.range;
				if (node.location === void 0) {
					symbols.push({ name: node.name, kind: node.kind ?? 0, line: (sel?.start?.line ?? 0) + 1, col: (sel?.start?.character ?? 0) + 1 });
				} else {
					const entry = this.locationToEntry(node.location);
					if (entry) symbols.push({ name: node.name, kind: node.kind ?? 0, line: entry.line, col: entry.col, path: entry.path });
				}
				for (const child of node.children ?? []) walk(child);
			};
			for (const node of Array.isArray(result) ? result : []) walk(node);
			symbols.sort((a, b) => a.line - b.line);
			return { symbols };
		}
		const params = { textDocument: { uri: doc.uri }, position: { line: Math.max(0, line - 1), character: Math.max(0, col - 1) } };
		let result;
		if (kind === "hover") {
			result = await this.request("textDocument/hover", params);
			return { hover: hoverToText(result) };
		}
		if (kind === "references") {
			params.context = { includeDeclaration: true };
			result = await this.request("textDocument/references", params);
		} else if (kind === "implementation") {
			result = await this.request("textDocument/implementation", params);
		} else if (kind === "typeDefinition") {
			result = await this.request("textDocument/typeDefinition", params);
		} else {
			result = await this.request("textDocument/definition", params);
		}
		const list = Array.isArray(result) ? result : result ? [result] : [];
		const targets = [];
		for (const item of list) {
			const entry = this.locationToEntry(item);
			if (entry && !targets.some((t) => t.path === entry.path && t.line === entry.line && t.col === entry.col)) {
				targets.push(entry);
			}
		}
		await attachSnippets(this.root, targets);
		return { targets };
	}

	stop(reason) {
		if (this.idleTimer) clearTimeout(this.idleTimer);
		this.idleTimer = null;
		const child = this.child;
		this.child = null;
		this.state = "off";
		this.startPromise = null;
		this.docs.clear();
		this.diagnostics.clear();
		this.progress.clear();
		this.cache.clear();
		this.inflight.clear();
		if (!child) return;
		try {
			child.stdin.end();
		} catch {}
		setTimeout(() => {
			try {
				child.kill("SIGTERM");
				setTimeout(() => {
					try {
						child.kill("SIGKILL");
					} catch {}
				}, 2000).unref?.();
			} catch {}
		}, 200).unref?.();
		void reason;
	}
}

function languageIdFor(path) {
	const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
	if (ext === ".go") return "go";
	if (ext === ".ts" || ext === ".mts" || ext === ".cts") return "typescript";
	if (ext === ".tsx") return "typescriptreact";
	if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return "javascript";
	if (ext === ".jsx") return "javascriptreact";
	if (ext === ".py" || ext === ".pyi") return "python";
	if (ext === ".json") return "json";
	return "plaintext";
}

function hoverToText(hover) {
	if (!hover) return "";
	const contents = hover.contents;
	if (typeof contents === "string") return contents;
	if (Array.isArray(contents)) return contents.map((part) => (typeof part === "string" ? part : part?.value ?? "")).join("\n");
	return contents?.value ?? "";
}

async function attachSnippets(root, targets) {
	// One read per file, all files in parallel: references can span dozens of
	// files and reading them serially dominated the tail of a cold request.
	const groups = new Map();
	for (const target of targets.slice(0, 60)) {
		const rel = relative(root, target.path);
		if (rel.startsWith("..")) continue;
		const list = groups.get(rel);
		if (list === undefined) groups.set(rel, [target]);
		else list.push(target);
	}
	await Promise.all([...groups].map(async ([rel, list]) => {
		let file;
		try {
			file = await readFencedText(root, rel);
		} catch {
			return;
		}
		if (file.kind !== "text") return;
		const lines = file.content.split("\n");
		for (const target of list) {
			const line = lines[target.line - 1];
			if (line !== undefined) target.snippet = line.trim().slice(0, 240);
		}
	}));
}

const servers = new Map(); // `${descriptor.id}\u0000${realpath(root)}` → LspServer

/**
 * Stop the least recently used roots of one language when a worktree-heavy
 * workspace would otherwise keep one server per checkout alive forever.
 * @param descriptor - language whose servers are capped.
 */
function enforceServerCap(descriptor) {
	const live = [...servers.values()].filter((server) => server.descriptor.id === descriptor.id && server.state !== "off");
	if (live.length <= options.maxServers) return;
	live.sort((a, b) => a.lastUsed - b.lastUsed);
	for (const victim of live.slice(0, live.length - options.maxServers)) victim.stop("evicted");
}

async function serverFor(descriptor, root) {
	const realRoot = await realpath(root);
	const key = `${descriptor.id}\u0000${realRoot}`;
	let server = servers.get(key);
	if (!server) {
		server = new LspServer(descriptor, realRoot);
		servers.set(key, server);
		enforceServerCap(descriptor);
	}
	return server;
}

/**
 * Warm a workspace the way editors do: start the server, open one file, and
 * fire a cheap request so `gopls` loads its package graph (and populates its
 * persistent file cache) before the operator asks for a definition. Returns
 * immediately — `lsp.status` carries the progress.
 *
 * @param cwd - session workspace.
 * @param filePath - an absolute path or a workspace-relative file.
 * @returns `{state, label, root, progress, message}`.
 */
export async function warmupLsp(cwd, filePath) {
	const sessionRoot = await realpath(cwd);
	const requested = String(filePath ?? "");
	const absolute = requested === "" ? "" : (isAbsolute(requested) ? requested : join(sessionRoot, requested));
	const descriptor = absolute === "" ? null : descriptorForPath(absolute);
	if (descriptor === null) return { state: "unsupported", message: "open a file a language server covers" };
	let file;
	try {
		file = await realpath(absolute);
	} catch {
		return { state: "missing", message: "file not found" };
	}
	if (descriptor.id === "go" && !binaryCandidates("gopls", { extras: goplsExtras() }).some((candidate) => existsSync(candidate))) {
		const provision = provisionGopls();
		return { state: provision.state === "failed" ? "missing" : "provisioning", label: "gopls", root: "", progress: "", message: provision.message };
	}
	const root = await findProjectRoot(file, sessionRoot, descriptor.rootMarkers);
	const server = await serverFor(descriptor, root);
	if (server.state === "ready") {
		server.touchIdle();
		return { state: "ready", label: server.label, root: server.root, progress: server.progressLine(), message: server.message };
	}
	const key = `${descriptor.id}\u0000${server.root}`;
	if (!warming.has(key)) {
		const task = (async () => {
			try {
				await server.ensureStarted();
				const doc = await server.ensureDocument(file);
				await server.request("textDocument/hover", { textDocument: { uri: doc.uri }, position: { line: 0, character: 0 } }, 120_000);
				server.touchIdle();
			} catch {
				// Failures surface through lsp.status; warmup never throws at the caller.
			} finally {
				warming.delete(key);
			}
		})();
		warming.set(key, task);
	}
	return { state: "starting", label: server.label, root: server.root, progress: server.progressLine(), message: server.message };
}

/** Background warmups in flight, keyed by language + root. */
const warming = new Map();

/**
 * Snapshot of language-server health for the status bar and the bench script.
 * @returns `{servers, options}`; a server row carries state, progress, counters and cache hits.
 */
export function lspStats() {
	const rows = [];
	for (const server of servers.values()) {
		rows.push({
			root: server.root,
			label: server.label,
			state: server.state,
			message: server.message,
			progress: server.progressLine(),
			command: server.command,
			ageMs: Date.now() - server.createdAt,
			idleMs: Date.now() - server.lastUsed,
			requests: server.requests,
			errors: server.errors,
			cacheHits: server.cacheHits,
			cacheMisses: server.cacheMisses,
		});
	}
	return { servers: rows, provision: goplsProvisionState(), options: { goplsCommand: options.goplsCommand, idleMs: idleMs(), maxServers: options.maxServers } };
}

/**
 * Project root for one source file: walk up from its directory to the session
 * cwd looking for the descriptor's markers (go.mod, package.json, pyproject…),
 * so each language server is rooted per real project even when the session
 * opened a parent folder of several repos. Falls back to the cwd.
 */
async function findProjectRoot(filePath, sessionRoot, markers) {
	let dir = dirname(filePath);
	for (;;) {
		for (const marker of markers) {
			try {
				await access(join(dir, marker));
				return dir;
			} catch {}
		}
		if (dir === sessionRoot || dir === "/" || dir === dirname(dir)) return sessionRoot;
		dir = dirname(dir);
	}
}

/**
 * Apply LSP TextEdits to a UTF-16-indexed string. Edits are applied
 * right-to-left so earlier offsets stay valid; an edit that overlaps one
 * already applied is skipped (defensive against non-server-conforming lists).
 */
function applyTextEdits(text, edits) {
	if (!Array.isArray(edits) || edits.length === 0) return text;
	const lines = text.split("\n");
	const starts = [];
	let running = 0;
	for (const ln of lines) {
		starts.push(running);
		running += ln.length + 1;
	}
	const pos = (line, character) => {
		if (line >= lines.length) return text.length;
		return starts[line] + Math.min(Math.max(character, 0), lines[line].length);
	};
	const items = edits
		.map((e) => ({ s: pos(e.range?.start?.line ?? 0, e.range?.start?.character ?? 0), t: pos(e.range?.end?.line ?? 0, e.range?.end?.character ?? 0), n: typeof e.newText === "string" ? e.newText : "" }))
		.filter((it) => it.s <= it.t)
		.sort((a, b) => b.s - a.s || b.t - a.t);
	let out = text;
	let appliedFrom = Infinity;
	for (const it of items) {
		if (it.t > appliedFrom) continue;
		out = out.slice(0, it.s) + it.n + out.slice(it.t);
		appliedFrom = it.s;
	}
	return out;
}

export { servers, serverFor, findProjectRoot, descriptorForPath, LANGUAGE_SERVERS, applyTextEdits };
