/* ---------------- database tools: export formats, ER graph, plan tree ----------------
 *
 * Everything here is pure: a result set in, a string or a layout out. The panel
 * renders it, the tests drive it without a DOM. Keeping the SQL generation here
 * means the quoting rules for each driver live in one place instead of being
 * re-derived at every call site.
 */

/** Quote an identifier the way the driver expects. */
export function quoteIdent(driver, name) {
	return driver === "mysql"
		? `\`${String(name).replace(/`/g, "``")}\``
		: `"${String(name).replace(/"/g, '""')}"`;
}

/** Render one value as a SQL literal. */
export function sqlLiteral(driver, value) {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
	if (typeof value === "boolean") return value ? (driver === "sqlite" ? "1" : "TRUE") : (driver === "sqlite" ? "0" : "FALSE");
	const text = String(value).replace(/'/g, "''");
	return `'${text}'`;
}

/**
 * Rows as an array of objects.
 *
 * @param result - `{columns, rows}`
 * @returns a pretty-printed JSON string
 */
export function toJsonRows(result) {
	const columns = result?.columns ?? [];
	const rows = result?.rows ?? [];
	const objects = rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null])));
	return JSON.stringify(objects, null, 2);
}

/**
 * Multi-row INSERT statements.
 *
 * @param result - `{columns, rows}`
 * @param table - target table
 * @param driver - `sqlite` | `mysql` | `postgres`
 * @param options - `{chunk}` rows per statement (default 100)
 * @returns one statement per chunk, newline separated
 */
export function toInsertSql(result, table, driver, options = {}) {
	const columns = result?.columns ?? [];
	const rows = result?.rows ?? [];
	if (columns.length === 0 || rows.length === 0) return "";
	const chunk = Math.max(1, Number(options.chunk) || 100);
	const target = quoteIdent(driver, table);
	const head = `INSERT INTO ${target} (${columns.map((column) => quoteIdent(driver, column)).join(", ")}) VALUES`;
	const statements = [];
	for (let start = 0; start < rows.length; start += chunk) {
		const values = rows.slice(start, start + chunk)
			.map((row) => `  (${columns.map((_, index) => sqlLiteral(driver, row[index])).join(", ")})`)
			.join(",\n");
		statements.push(`${head}\n${values};`);
	}
	return statements.join("\n\n");
}

/**
 * Tables and foreign-key edges for the ER diagram.
 *
 * Only the current database is drawn: an edge to a table in another database
 * has nowhere to land on the canvas.
 *
 * @param schema - the `db.schema` payload
 * @returns `{database, tables, edges}` where an edge is `{from, to, columns}`
 */
export function erGraph(schema) {
	const database = (schema?.databases ?? []).find((entry) => entry.name === schema?.current) ?? (schema?.databases ?? [])[0];
	const tables = (database?.tables ?? []).filter((table) => table.kind !== "view");
	const names = new Set(tables.map((table) => table.name));
	const edges = [];
	for (const table of tables) {
		for (const fk of table.foreignKeys ?? []) {
			if (!names.has(fk.refTable)) continue;
			edges.push({
				from: table.name,
				to: fk.refTable,
				columns: (fk.columns ?? []).join(", "),
				refColumns: (fk.refColumns ?? []).join(", "),
			});
		}
	}
	return { database: database?.name ?? "", tables, edges };
}

/**
 * Lay the graph out on a grid and compute edge paths.
 *
 * @param graph - the `erGraph` result
 * @param options - `{width, boxWidth, boxHeight, gapX, gapY, perRow}`
 * @returns `{width, height, boxes, links}` ready for SVG
 */
export function erLayout(graph, options = {}) {
	const boxWidth = Number(options.boxWidth) || 190;
	const boxHeight = Number(options.boxHeight) || 74;
	const gapX = Number(options.gapX) || 56;
	const gapY = Number(options.gapY) || 46;
	const width = Number(options.width) || 900;
	const perRow = Math.max(1, Math.floor((width + gapX) / (boxWidth + gapX)));
	const tables = graph?.tables ?? [];
	const positions = new Map();
	const boxes = tables.map((table, index) => {
		const column = index % perRow;
		const row = Math.floor(index / perRow);
		const box = {
			name: table.name,
			columns: (table.columns ?? []).map((entry) => entry.name),
			x: 24 + column * (boxWidth + gapX),
			y: 24 + row * (boxHeight + gapY),
			width: boxWidth,
			height: boxHeight,
		};
		positions.set(table.name, box);
		return box;
	});
	const links = (graph?.edges ?? []).flatMap((edge) => {
		const from = positions.get(edge.from);
		const to = positions.get(edge.to);
		if (!from || !to) return [];
		// Start at the right edge of the source and end at the left edge of the
		// target; a same-column pair curves out and back so it stays visible.
		const x1 = from.x + from.width / 2;
		const y1 = from.y + from.height;
		const x2 = to.x + to.width / 2;
		const y2 = to.y;
		const mid = (y1 + y2) / 2;
		return [{ ...edge, path: `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}` }];
	});
	const rows = Math.ceil(boxes.length / perRow);
	return { width, height: 48 + rows * (boxHeight + gapY), boxes, links };
}

/**
 * Turn SQLite's `EXPLAIN QUERY PLAN` rows into an indented list.
 *
 * @param columns - result column names
 * @param rows - result rows
 * @returns `[{depth, detail}]` in display order, or [] when the shape is unknown
 */
export function planTree(columns, rows) {
	const idIndex = (columns ?? []).indexOf("id");
	const parentIndex = (columns ?? []).indexOf("parent");
	const detailIndex = (columns ?? []).findIndex((column) => String(column).toLowerCase() === "detail");
	if (idIndex < 0 || parentIndex < 0 || detailIndex < 0) return [];
	const children = new Map();
	const roots = [];
	for (const row of rows ?? []) {
		const entry = { id: row[idIndex], parent: row[parentIndex], detail: String(row[detailIndex] ?? "") };
		if (entry.parent === null || entry.parent === undefined || entry.parent === 0) roots.push(entry);
		else {
			if (!children.has(entry.parent)) children.set(entry.parent, []);
			children.get(entry.parent).push(entry);
		}
	}
	const flat = [];
	const walk = (nodes, depth) => {
		for (const node of nodes) {
			flat.push({ depth, detail: node.detail });
			walk(children.get(node.id) ?? [], depth + 1);
		}
	};
	walk(roots, 0);
	// A plan whose roots never matched (unusual ids) still renders flat.
	if (flat.length === 0) return (rows ?? []).map((row) => ({ depth: 0, detail: String(row[detailIndex] ?? "") }));
	return flat;
}
/**
 * Parse pasted data into columns and rows.
 *
 * Accepts a JSON array of objects (`[{"id":1}]`) or delimited text whose first
 * line is a header (`id,name`). CSV quoting is honoured, tabs are accepted.
 *
 * @param text - pasted content
 * @returns `{columns, rows, error}`
 */
export function parseDataText(text) {
	const source = String(text ?? "").trim();
	if (source === "") return { columns: [], rows: [], error: "empty" };
	if (source.startsWith("[") || source.startsWith("{")) {
		try {
			const parsed = JSON.parse(source);
			const list = Array.isArray(parsed) ? parsed : [parsed];
			const columns = [...new Set(list.flatMap((entry) => Object.keys(entry ?? {})))];
			return { columns, rows: list.map((entry) => columns.map((column) => (entry ?? {})[column] ?? null)), error: "" };
		} catch (error) {
			return { columns: [], rows: [], error: String(error?.message ?? error) };
		}
	}
	const rows = [];
	let row = [];
	let field = "";
	let quoted = false;
	const delimiter = source.includes("\t") && !source.includes(",") ? "\t" : ",";
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
		if (ch === delimiter) { row.push(field); field = ""; continue; }
		if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
		if (ch === "\r") continue;
		field += ch;
	}
	if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
	if (rows.length < 2) return { columns: rows[0] ?? [], rows: [], error: "no data rows" };
	const columns = rows[0];
	return { columns, rows: rows.slice(1), error: "" };
}
