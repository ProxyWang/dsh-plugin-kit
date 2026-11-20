/** The driver catalog: every logical driver, the implementations that can serve
 * it, and what those implementations can do.
 *
 * This is the seam the database panel reads instead of asking "is mysql
 * installed?". A logical driver (`mysql`) has an ordered ladder of
 * implementations — a JS module first, the CLI client second — and each one is
 * probed independently. The panel can then say *which* implementation will run
 * and which capabilities come with it, rather than showing a dead option.
 *
 * Connection code still lives in `db.js`; this module only describes and
 * resolves, so the catalog can grow (new impls) without touching the routes.
 *
 * @see docs/driver-architecture.md
 */

import { binaryCandidates, findBinary } from "./binpath.js";
import { availableModules } from "./modresolve.js";

/**
 * What an implementation can do. The panel shows controls from this table, so a
 * missing capability hides the control instead of failing at request time.
 *
 * @typedef {object} Capabilities
 * @property {boolean} transactions  statements can share BEGIN/COMMIT
 * @property {boolean} changes       a write reports its affected row count
 * @property {boolean} typedValues   dates/decimals/json keep their type
 * @property {boolean} streaming     large results can be read incrementally
 * @property {"statement"|"connection"} cancel  what cancelling costs
 */

const CLI_CAPABILITIES = {
	transactions: false,
	changes: true,
	typedValues: false,
	streaming: false,
	cancel: "statement",
};

const MODULE_CAPABILITIES = {
	transactions: true,
	changes: true,
	typedValues: true,
	streaming: true,
	cancel: "statement",
};

const EMBEDDED_CAPABILITIES = {
	transactions: true,
	changes: true,
	typedValues: false,
	streaming: false,
	cancel: "connection",
};

/** Logical drivers, each with its implementation ladder. */
const DRIVERS = [
	{
		id: "sqlite",
		label: "SQLite",
		implementations: [
			{
				impl: "embedded",
				label: "node:sqlite",
				capabilities: EMBEDDED_CAPABILITIES,
				async detect() {
					try {
						await import("node:sqlite");
						return { ready: true };
					} catch {
						return { ready: false, note: "needs Node ≥ 22.5" };
					}
				},
			},
		],
	},
	{
		id: "mysql",
		label: "MySQL",
		implementations: [
			{
				impl: "module",
				label: "mysql2",
				capabilities: MODULE_CAPABILITIES,
				async detect(context) {
					const found = context.modules?.mysql2;
					if (!found) return { ready: false, note: "mysql2 is not resolvable here" };
					return { ready: true, version: `mysql2@${found.version || "?"}`, source: found.source };
				},
			},
			{
				impl: "cli",
				label: "mysql client",
				capabilities: CLI_CAPABILITIES,
				async detect(context) {
					const bin = context.findBinary("mysql");
					if (bin === null) return { ready: false, note: "mysql client not found — install it (brew install mysql-client) or set a client path" };
					return { ready: true, bin };
				},
			},
		],
	},
	{
		id: "postgres",
		label: "PostgreSQL",
		implementations: [
			{
				impl: "module",
				label: "pg",
				capabilities: MODULE_CAPABILITIES,
				async detect(context) {
					const found = context.modules?.pg;
					if (!found) return { ready: false, note: "pg is not resolvable here" };
					return { ready: true, version: `pg@${found.version || "?"}`, source: found.source };
				},
			},
			{
				impl: "cli",
				label: "psql client",
				capabilities: CLI_CAPABILITIES,
				async detect(context) {
					const bin = context.findBinary("psql");
					if (bin === null) return { ready: false, note: "psql client not found — install it (brew install postgresql@16) or set a client path" };
					return { ready: true, bin };
				},
			},
		],
	},
];

/**
 * Describe every driver and probe its implementations.
 *
 * @param options - `{ cwd, allowWorkspace }`; the workspace is only searched for
 *   driver modules when `allowWorkspace` is true
 * @returns one entry per logical driver, with `ready`/`impl`/`capabilities` and
 *   the full `alternatives` list
 */
export async function driverCatalog(options = {}) {
	const modules = availableModules({ cwd: options.cwd, allowWorkspace: options.allowWorkspace === true });
	const context = { modules, findBinary: (name) => findBinary(name), candidates: (name) => binaryCandidates(name) };
	const catalog = [];
	for (const driver of DRIVERS) {
		const alternatives = [];
		for (const implementation of driver.implementations) {
			let probe;
			try {
				probe = await implementation.detect(context);
			} catch (error) {
				probe = { ready: false, note: String(error?.message ?? error) };
			}
			alternatives.push({
				impl: implementation.impl,
				label: implementation.label,
				ready: probe.ready === true,
				note: probe.note ?? "",
				bin: probe.bin ?? "",
				version: probe.version ?? "",
				source: probe.source ?? "",
				capabilities: implementation.capabilities,
			});
		}
		const preferred = alternatives.find((entry) => entry.ready) ?? null;
		catalog.push({
			id: driver.id,
			label: driver.label,
			ready: preferred !== null,
			impl: preferred?.impl ?? "",
			bin: preferred?.bin ?? "",
			version: preferred?.version ?? "",
			note: preferred?.note ?? alternatives.map((entry) => entry.note).filter(Boolean).join(" · "),
			capabilities: preferred?.capabilities ?? alternatives[0].capabilities,
			alternatives,
		});
	}
	return catalog;
}

/** The logical driver ids the catalog knows about. */
export function driverIds() {
	return DRIVERS.map((driver) => driver.id);
}