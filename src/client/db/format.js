/** Pure formatting and SQL text for the workbench.
 *
 * No hooks, no state, no Host calls: these functions are why the panel's view
 * code stays readable, and they are unit-tested directly.
 */

/** Rows per table page. */
export const PAGE_SIZE = 100;
/** Page size for free-form SQL tabs (larger than a table page). */
export const QUERY_PAGE = 200;
/** Remembered queries in the history drawer. */
export const HISTORY_CAP = 40;

/** Pure: one CSV document from a result (RFC 4180 quoting). */
export function toCsv(columns, rows) {
	const quote = (value) => {
		const text = value === null || value === undefined ? "" : String(value);
		return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	};
	const lines = [columns.map(quote).join(",")];
	for (const row of rows) lines.push(row.map(quote).join(","));
	return lines.join("\n");
}

/** Pure: the SQL a table tab runs for the current page/order/filter. */
export function tableSql(table, { order, dir, limit, offset, filter, columns, driver }) {
	// MySQL only accepts backticks (unless ANSI_QUOTES is on), so the generated
	// SELECT has to use the driver's own identifier quoting to be runnable.
	const q = (name) => (driver === "mysql"
		? `\`${String(name).replace(/`/g, "``")}\``
		: `"${String(name).replace(/"/g, '""')}"`);
	const quote = q(table);
	const where = filter && filter.trim() && columns?.length
		? ` WHERE (${columns.map((column) => `CAST(${q(column.name)} AS TEXT) LIKE '%${filter.trim().replace(/'/g, "''")}%'`).join(" OR ")})`
		: "";
	const sorting = order ? ` ORDER BY ${q(order)} ${dir === "desc" ? "DESC" : "ASC"}` : "";
	return `SELECT * FROM ${quote}${where}${sorting} LIMIT ${limit} OFFSET ${offset}`;
}

/**
 * One request token. A connection can serve several tabs at once, so a cancel
 * has to name the statement it means — killing "whatever is running on this
 * connection" stops the wrong one.
 */
export function requestToken(prefix = "r") {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Count rows and messages for the header chips. */
export function countOf(schema) {
	let tables = 0;
	let views = 0;
	for (const database of schema?.databases ?? []) {
		for (const entry of database.tables ?? []) {
			if (entry.kind === "view") views++;
			else tables++;
		}
	}
	return { tables, views };
}
