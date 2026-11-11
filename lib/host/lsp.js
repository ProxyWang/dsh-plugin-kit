/** Language-server manager: a descriptor table (Go/TS-JS/Python), one lazily-spawned server per project root per language, JSON-RPC framing over stdio, document sync, diagnostics/progress tracking, and symbol requests. */

import { spawn } from "node:child_process";
import { access, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { LSP_FIRST_TIMEOUT_MS, LSP_IDLE_MS, LSP_TIMEOUT_MS } from "./constants.js";
import { readFencedText, resolveReadTarget } from "./fence.js";

function goplsCandidates() {
	const home = homedir();
	const list = [];
	if (process.env.GOBIN) list.push(join(process.env.GOBIN, "gopls"));
	if (process.env.GOPATH) {
		for (const part of process.env.GOPATH.split(isAbsolute("/gopls") ? ":" : ";")) {
			if (part) list.push(join(part, "bin", "gopls"));
		}
	}
	list.push(join(home, "gopath", "bin", "gopls"));
	list.push(join(home, "go", "bin", "gopls"));
	list.push("/opt/homebrew/bin/gopls");
	list.push("/usr/local/bin/gopls");
	list.push("gopls");
	return list;
}

/** Common global bin locations for npm/pipx-style installs, PATH last. */
function binCandidates(name) {
	const home = homedir();
	return [
		join(home, ".npm-global", "bin", name),
		join(home, ".bun", "bin", name),
		join(home, ".yarn", "bin", name),
		join(home, ".local", "bin", name),
		`/opt/homebrew/bin/${name}`,
		`/usr/local/bin/${name}`,
		name,
	];
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
		launchers: () => goplsCandidates().map((command) => ({ command, args: ["serve"] })),
		env: () => ({ GOFLAGS: process.env.GOFLAGS ?? "" }),
		rootMarkers: ["go.mod", "go.work"],
	},
	{
		id: "ts",
		label: "typescript-language-server",
		exts: new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]),
		launchers: () => binCandidates("typescript-language-server").map((command) => ({ command, args: ["--stdio"] })),
		env: () => ({}),
		rootMarkers: ["package.json", "tsconfig.json", "jsconfig.json"],
	},
	{
		id: "py",
		label: "pyright",
		exts: new Set([".py", ".pyi"]),
		launchers: () => [
			...binCandidates("pyright-langserver").map((command) => ({ command, args: ["--stdio"] })),
			...binCandidates("pylsp").map((command) => ({ command, args: [] })),
		],
		env: () => ({}),
		rootMarkers: ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile"],
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
		this.candidates = descriptor.launchers();
		this.candidateIndex = 0;
	}

	touchIdle() {
		if (this.idleTimer) clearTimeout(this.idleTimer);
		this.idleTimer = setTimeout(() => this.stop("idle"), LSP_IDLE_MS);
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
		let lastError = null;
		for (let i = this.candidateIndex; i < this.candidates.length; i++) {
			const launcher = this.candidates[i];
			try {
				await this.spawnAndInitialize(launcher);
				this.candidateIndex = i;
				return;
			} catch (error) {
				lastError = error;
			}
		}
		throw lastError ?? new Error(`${this.label} not found`);
	}

	spawnAndInitialize(launcher) {
		return new Promise((resolvePromise, rejectPromise) => {
			let child;
			try {
				child = spawn(launcher.command, launcher.args ?? [], {
					cwd: this.root,
					env: { ...process.env, ...this.descriptor.env() },
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
							documentSymbol: { hierarchicalDocumentSymbolSupport: true },
							hover: { contentFormat: ["markdown", "plaintext"] },
							publishDiagnostics: { relatedInformation: true, versionSupport: false },
							synchronization: { dynamicRegistration: false },
						},
						window: { workDoneProgress: true },
						workspace: { didChangeWatchedFiles: { dynamicRegistration: false }, configuration: false },
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
					rejectPromise(new Error(`LSP request "${method}" timed out`));
				}, timeoutMs),
			});
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

	async symbolRequest(kind, path, line, col) {
		const doc = await this.ensureDocument(path);
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
	for (const target of targets.slice(0, 60)) {
		try {
			const rel = relative(root, target.path);
			if (rel.startsWith("..")) continue;
			const file = await readFencedText(root, rel);
			if (file.kind !== "text") continue;
			const line = file.content.split("\n")[target.line - 1];
			if (line !== undefined) target.snippet = line.trim().slice(0, 240);
		} catch {}
	}
}

const servers = new Map(); // `${descriptor.id}\u0000${realpath(root)}` → LspServer

async function serverFor(descriptor, root) {
	const realRoot = await realpath(root);
	const key = `${descriptor.id}\u0000${realRoot}`;
	let server = servers.get(key);
	if (!server) {
		server = new LspServer(descriptor, realRoot);
		servers.set(key, server);
	}
	return server;
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

export { servers, serverFor, findProjectRoot, descriptorForPath, LANGUAGE_SERVERS };
