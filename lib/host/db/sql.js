/** Pure SQL helpers: quoting, parsing CLI output, building clauses.
 *
 * Nothing here opens a connection or spawns a process, so a new engine can reuse
 * them without importing the workbench — which is what keeps engines small.
 */

/** The marker `psql -P null=` prints for SQL NULL (an empty string is data). */
export const PSQL_NULL = "\\N";

/** Quote an identifier for the active driver (doubling embedded quotes). */
export function quoteIdent(driver, name) {
	const clean = String(name ?? "");
	if (driver === "mysql") return `\`${clean.replace(/`/g, "``")}\``;
	return `"${clean.replace(/"/g, '""')}"`;
}

/** `Query OK, 2 rows affected` / `Rows matched: 2` from mysql's verbose output. */
export function parseMysqlTag(output) {
	const text = String(output ?? "");
	const affected = /Query OK,\s+(\d+)\s+rows? affected/i.exec(text);
	if (affected) return Number(affected[1]);
	const matched = /Rows matched:\s*(\d+)/i.exec(text);
	if (matched) return Number(matched[1]);
	return null;
}

/** mysql's batch mode escapes these; `--raw` would break rows on a newline cell. */
export function unescapeMysql(cell) {
	if (cell === "NULL") return null;
	if (!cell.includes("\\")) return cell;
	return cell.replace(/\\(.)/g, (_all, ch) => (ch === "n" ? "\n" : ch === "t" ? "\t" : ch === "0" ? "\0" : ch));
}

/** Parse CSV the way psql emits it: quotes, doubled quotes, embedded newlines. */
export function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = "";
	let quoted = false;
	const source = String(text ?? "");
	for (let i = 0; i < source.length; i++) {
		const ch = source[i];
		if (quoted) {
			if (ch === '"') {
				if (source[i + 1] === '"') { field += '"'; i++; }
				else quoted = false;
			} else field += ch;
			continue;
		}
		if (ch === '"') { quoted = true; continue; }
		if (ch === ",") { row.push(field); field = ""; continue; }
		if (ch === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			continue;
		}
		if (ch === "\r") continue;
		field += ch;
	}
	if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
	// psql writes a trailing newline: drop the empty final row it produces.
	if (rows.length > 0 && rows.at(-1).length === 1 && rows.at(-1)[0] === "") rows.pop();
	return rows.map((cells) => cells.map((cell) => (cell === PSQL_NULL ? null : cell)));
}

/** WHERE clause the grid may add: only a literal substring filter, never raw SQL. */
/** A LIKE pattern that matches `needle` literally, as SQL text.
 *
 * `%` and `_` are wildcards and `_` appears in most table names, so an unescaped
 * filter silently matches more than the user asked for. The pattern is escaped
 * (`ESCAPE` says which byte does it), quotes are doubled, and MySQL additionally
 * gets its literal backslashes doubled because it treats a backslash as an escape.
 *
 * @param driver - mysql | postgres | sqlite
 * @param needle - what the user typed
 * @returns the text to put between the quotes of the LIKE pattern
 */
export function likePattern(driver, needle) {
	const escaped = String(needle).replace(/[\\%_]/g, (ch) => `\\${ch}`);
	const literal = driver === "mysql" ? escaped.replace(/\\/g, "\\\\") : escaped;
	return literal.replace(/'/g, "''");
}

/** The `ESCAPE` clause that pairs with `likePattern`. */
export function likeEscape(driver) {
	return driver === "mysql" ? "ESCAPE '\\\\'" : "ESCAPE '\\'";
}

export function filterClause(driver, columns, filter) {
	const needle = String(filter ?? "").trim();
	if (needle === "" || columns.length === 0) return null;
	// MySQL has no TEXT cast target (CHAR, SIGNED, DECIMAL, …), so the filter would
	// be a syntax error on the one driver that needs it most.
	const castType = driver === "mysql" ? "CHAR" : "TEXT";
	const parts = columns.map((column) => `CAST(${quoteIdent(driver, column.name)} AS ${castType}) LIKE '%${likePattern(driver, needle)}%' ${likeEscape(driver)}`);
	return `(${parts.join(" OR ")})`;
}

/** Whether a statement can be wrapped in a paging subquery. */
export function pageable(text) {
	const trimmed = text.replace(/;\s*$/, "").trim();
	if (!/^(select|with)\b/i.test(trimmed)) return false;
	// A second statement means a script, not one result set.
	if (trimmed.includes(";")) return false;
	// `WITH … SELECT` is pageable, `WITH … DELETE|UPDATE|INSERT` is not: wrapping a
	// data-changing CTE in `SELECT * FROM (…)` is a syntax error. The main verb is
	// the first word after the last closing parenthesis of the CTE list.
	if (/^with\b/i.test(trimmed)) {
		const lastClose = trimmed.lastIndexOf(")");
		const rest = lastClose === -1 ? "" : trimmed.slice(lastClose + 1).trim();
		return /^select\b/i.test(rest);
	}
	return true;
}
