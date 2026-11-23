/** SQLite operations, usable from the main thread or from a worker.
 *
 * `node:sqlite` is synchronous: a large `SELECT` or a slow `VACUUM` blocks
 * whatever thread calls it. The database panel therefore runs these functions
 * in a worker (`db-worker.js`) so the Host's event loop keeps serving every
 * other request; this module holds the actual work so the worker and the
 * inline fallback share one implementation.
 *
 * Every function takes the open `DatabaseSync` handle plus plain arguments and
 * returns JSON-serializable data.
 */

/** Rows a free query may return before it reports truncation. */
export const QUERY_CAP = 10_000;
/** Rows one table page may return. */
export const PAGE_CAP = 500;

/** Double-quote an SQLite identifier. */
export function quote(name) {
	return `"${String(name ?? "").replace(/"/g, '""')}"`;
}

/** Columns of one table, with the flags the structure view shows. */
export function columns(db, table) {
	return db.prepare(`PRAGMA table_info(${quote(table)})`).all().map((c) => ({
		name: c.name,
		type: c.type || "TEXT",
		nullable: c.notnull === 0,
		primaryKey: c.pk > 0,
		defaultValue: c.dflt_value ?? null,
	}));
}

/**
 * Foreign keys of one table.
 *
 * @param db - open handle
 * @param table - table name
 * @returns `[{columns, refTable, refColumns}]`, one entry per referenced table
 */
export function foreignKeys(db, table) {
	let rows = [];
	try {
		rows = db.prepare(`PRAGMA foreign_key_list(${quote(table)})`).all();
	} catch {
		return [];
	}
	// One row per column pair; grouping keeps a composite key a single edge.
	const grouped = new Map();
	for (const row of rows) {
		const key = `${row.table}\u0000${row.id}`;
		if (!grouped.has(key)) grouped.set(key, { refTable: row.table, columns: [], refColumns: [] });
		const entry = grouped.get(key);
		entry.columns.push(row.from);
		entry.refColumns.push(row.to ?? "");
	}
	return [...grouped.values()];
}

/** Databases, tables/views, their columns and their indexes. */
export function schema(db, { path = "" } = {}) {
	const objects = db.prepare(
		"SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name",
	).all();
	const tables = objects.map((row) => {
		const indexes = db.prepare(`PRAGMA index_list(${quote(row.name)})`).all().map((ix) => ({
			name: ix.name,
			unique: ix.unique === 1,
			columns: db.prepare(`PRAGMA index_info(${quote(ix.name)})`).all().map((c) => c.name).filter(Boolean),
		}));
		return {
			name: row.name,
			kind: row.type === "view" ? "view" : "table",
			columns: columns(db, row.name),
			indexes,
			// Foreign keys drive the ER diagram: without them it is a grid of boxes.
			foreignKeys: foreignKeys(db, row.name),
		};
	});
	let file = path;
	let size = 0;
	try {
		const main = db.prepare("PRAGMA database_list").all().find((entry) => entry.name === "main");
		if (main) file = main.file || file;
		const pages = Number(db.prepare("PRAGMA page_count").get()?.page_count ?? 0);
		const pageSize = Number(db.prepare("PRAGMA page_size").get()?.page_size ?? 0);
		size = pages * pageSize;
	} catch { /* pragmas are advisory, never fatal */ }
	return { driver: "sqlite", databases: [{ name: "main", tables }], current: "main", file, size };
}

/** One page of a table plus the total behind it. */
export function rows(db, table, options = {}) {
	const limit = Math.min(Math.max(Number(options.limit) || 100, 1), PAGE_CAP);
	const offset = Math.max(Number(options.offset) || 0, 0);
	const dir = String(options.dir).toLowerCase() === "desc" ? "DESC" : "ASC";
	const cols = columns(db, table);
	const raw = String(options.filter ?? "").trim();
	// Escape LIKE metacharacters so `_` in a table name matches literally, and
	// double quotes so the needle cannot end the literal.
	const needle = raw.replace(/[\\%_]/g, (ch) => `\\${ch}`).replace(/'/g, "''");
	const where = needle === "" || cols.length === 0
		? ""
		: ` WHERE (${cols.map((column) => `CAST(${quote(column.name)} AS TEXT) LIKE '%${needle}%' ESCAPE '\\'`).join(" OR ")})`;
	const orderColumn = typeof options.order === "string" && cols.some((column) => column.name === options.order)
		? options.order
		: "";
	const order = orderColumn === "" ? "" : ` ORDER BY ${quote(orderColumn)} ${dir}`;
	const all = db.prepare(`SELECT * FROM ${quote(table)}${where}${order} LIMIT ${limit} OFFSET ${offset}`).all();
	const total = Number(db.prepare(`SELECT COUNT(*) AS n FROM ${quote(table)}${where}`).get()?.n ?? 0);
	const names = all.length > 0 ? Object.keys(all[0]) : cols.map((column) => column.name);
	return { columns: names, rows: all.map((row) => names.map((name) => row[name])), total, offset, limit };
}

/** Run one statement: a result set, or a change count. */
export function query(db, sql, limit) {
	const text = String(sql ?? "").trim();
	if (text === "") throw new Error("the query is empty");
	const cap = Math.min(Math.max(Number(limit) || QUERY_CAP, 1), QUERY_CAP);
	const started = Date.now();
	const statement = db.prepare(text);
	// `PRAGMA` and `WITH … SELECT` return rows; `WITH … UPDATE` does not, so the
	// statement's own reader flag is the authority when the driver exposes it.
	const reader = typeof statement.columns === "function"
		? statement.columns().length > 0
		: /^\s*(select|pragma|explain|with)\b/i.test(text);
	if (!reader) {
		const info = statement.run();
		return { columns: [], rows: [], truncated: false, ms: Date.now() - started, changes: Number(info.changes ?? 0) };
	}
	const all = statement.all();
	const truncated = all.length > cap;
	const kept = truncated ? all.slice(0, cap) : all;
	const names = kept.length > 0 ? Object.keys(kept[0]) : [];
	return {
		columns: names,
		rows: kept.map((row) => names.map((name) => row[name])),
		truncated,
		ms: Date.now() - started,
	};
}
