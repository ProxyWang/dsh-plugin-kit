/**
 * Benchmarks for the find-references path, so performance claims in
 * docs/references-performance.md can be reproduced.
 *
 *   node scripts/bench-references.mjs                 # snippet attachment on this repo
 *   node scripts/bench-references.mjs --repo /path    # …on another workspace
 *   node scripts/bench-references.mjs --lsp <file> <line> <col>
 *                                                     # gopls cold vs warm references
 *
 * The snippet mode compares what the Host does today (one whole-file read per
 * target, serially) with the deduped/parallel shape, on the largest Go files
 * it can find. The LSP mode drives a real server through lib/host/lsp.js; the
 * first request on a large module pays gopls' workspace load, which is the
 * number this document is about.
 */

import { readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
	const at = args.indexOf(name);
	return at === -1 ? undefined : args[at + 1];
};
const repo = flag("--repo") ?? process.cwd();
const lspAt = args.indexOf("--lsp");

function walk(dir, out = []) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (entry.name === "node_modules" || entry.name === ".git") continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) walk(path, out);
		else if (entry.name.endsWith(".go")) out.push(path);
	}
	return out;
}

async function benchSnippets() {
	const { textCache, readFencedText } = await import("../lib/host/fence.js");
	const files = walk(repo)
		.map((path) => ({ path, size: statSync(path).size }))
		.sort((a, b) => b.size - a.size)
		.slice(0, 18);
	if (files.length === 0) {
		console.log("no .go files found; pass --repo");
		return;
	}
	const targets = [];
	for (const file of files) targets.push({ path: file.path, line: 10 }, { path: file.path, line: 30 });
	const now = () => performance.now();

	const serial = async (list) => {
		for (const target of list) {
			const file = await readFencedText(repo, relative(repo, target.path));
			void file.content.split("\n")[target.line - 1];
		}
	};
	const deduped = async (list) => {
		const byFile = new Map();
		for (const target of list) {
			if (!byFile.has(target.path)) byFile.set(target.path, []);
			byFile.get(target.path).push(target.line);
		}
		await Promise.all([...byFile.entries()].map(async ([path, lines]) => {
			const file = await readFencedText(repo, relative(repo, path));
			const rows = file.content.split("\n");
			for (const line of lines) void rows[line - 1];
		}));
	};

	const rows = [];
	for (const [label, run, cold] of [["serial/cold", serial, true], ["serial/warm", serial, false], ["deduped-parallel/cold", deduped, true], ["deduped-parallel/warm", deduped, false]]) {
		if (cold) textCache.clear();
		const started = now();
		await run(targets);
		rows.push({ label, ms: +(now() - started).toFixed(1) });
	}
	console.log(JSON.stringify({ mode: "snippets", files: files.length, targets: targets.length, mb: +(files.reduce((sum, file) => sum + file.size, 0) / 1048576).toFixed(2), rows }, null, 1));
}

async function benchLsp(file, line, col) {
	const { descriptorForPath, findProjectRoot, serverFor, servers } = await import("../lib/host/lsp.js");
	const absolute = file.startsWith("/") ? file : join(process.cwd(), file);
	const sessionRoot = flag("--repo") ?? process.cwd();
	const root = await findProjectRoot(absolute, sessionRoot, descriptorForPath(absolute).rootMarkers);
	const descriptor = descriptorForPath(absolute);
	const now = () => performance.now();
	const rows = [];
	for (let cycle = 1; cycle <= 2; cycle++) {
		for (const [key, server] of servers) if (server.root === root) { server.stop("bench"); servers.delete(key); }
		const server = await serverFor(descriptor, root);
		const startAt = now();
		await server.ensureStarted();
		const startMs = now() - startAt;
		const firstAt = now();
		const first = await server.symbolRequest("references", absolute, line, col);
		const firstMs = now() - firstAt;
		const warmAt = now();
		const warm = await server.symbolRequest("references", absolute, line, col);
		const warmMs = now() - warmAt;
		rows.push({ cycle, startMs: +startMs.toFixed(0), firstRefsMs: +firstMs.toFixed(0), warmRefsMs: +warmMs.toFixed(0), targets: first.targets.length, snippets: first.targets.filter((target) => target.snippet !== undefined).length, root: basename(root) });
		server.stop("bench");
		await new Promise((resolve) => setTimeout(resolve, 300));
	}
	console.log(JSON.stringify({ mode: "lsp", file: absolute, line, col, rows }, null, 1));
}

if (lspAt !== -1) {
	const [file, line, col] = args.slice(lspAt + 1, lspAt + 4);
	await benchLsp(file, Number(line ?? 1), Number(col ?? 1));
} else {
	await benchSnippets();
}
process.exit(0);
