/** The workbench's modal surfaces: drivers, ER diagram, plan, import, add row.
 *
 * Each one is a pure function of its props plus an `onDone` callback: they do not
 * read the connection state themselves, so they can be rendered in isolation
 * (which is also how they are tested).
 */

import { Fragment, h, useMemo, useState } from "../react.js";
import { api } from "../api.js";
import { erGraph, erLayout, parseDataText, planTree } from "../dbtools.js";

/** Driver manager: every implementation, its capabilities and where it lives. */
export function DriverManager({ t, drivers, dbxState, onImportDbx, onInstall, onCopy, onRedetect, onClose }) {
	const card = (driver) => {
		const head = h("div", { className: "cedb-driver-head" },
			h("strong", null, driver.label),
			driver.ready
				? h("span", { className: "cedb-ctx cedb-ctx-strong" }, driver.impl === "module" ? driver.version || "module" : String(driver.impl ?? "").toUpperCase())
				: h("span", { className: "cedb-ctx" }, t("db.notReady")));
		const caps = h("div", { className: "cedb-driver-caps" }, Object.entries(driver.capabilities ?? {}).map(([name, value]) => h("span", {
			key: name,
			className: `cedb-cap${value === true ? " cedb-cap-on" : ""}`,
			title: name,
		}, `${name}: ${typeof value === "boolean" ? (value ? "✓" : "—") : String(value)}`)));
		const altRow = (driverId, alt) => {
			const pkg = driverId === "mysql" ? "mysql2" : "pg";
			const status = alt.ready
				? h("span", { className: "cedb-driver-ok", title: alt.bin || alt.version }, alt.version || alt.bin || "ready")
				: h("span", { className: "cedb-driver-no", title: alt.note }, alt.note);
			const action = alt.ready
				? null
				: alt.impl === "module"
					? h("button", {
						type: "button",
						className: "ce-sk-btn ce-sk-btn-ghost ce-tiny",
						disabled: dbxState?.installing === pkg,
						title: t("db.installIntoProject"),
						onClick: () => void onInstall?.(pkg),
					}, dbxState?.installing === pkg ? t("loading") : t("db.install"))
					: h("button", {
						type: "button",
						className: "ce-sk-btn ce-sk-btn-ghost ce-tiny",
						title: t("db.copyInstallCommand"),
						onClick: () => void onCopy?.(String(alt.note ?? "").replace(/^.*?—\s*/, "") || "mysql"),
					}, t("db.copyCommand"));
			return h("div", { key: alt.impl, className: "cedb-driver-alt" }, h("span", { className: "cedb-driver-impl" }, alt.impl), status, action);
		};
		const alts = h("div", { className: "cedb-driver-alts" }, (driver.alternatives ?? []).map((alt) => altRow(driver.id, alt)));
		return h("div", { key: driver.id, className: "cedb-driver-card" }, head, caps, alts);
	};
	const importStrip = h("div", { className: "cedb-dbx" },
		h("span", { className: "cedb-dbx-title" }, t("db.importDbx")),
		dbxState?.error ? h("span", { className: "cedb-dbx-bad" }, dbxState.error) : null,
		dbxState?.imported !== undefined && dbxState.imported > 0
			? h("span", { className: "cedb-dbx-ok" }, `${t("db.importDbxDone")} ${dbxState.imported}`)
			: null,
		dbxState?.supported
			? h("span", { className: "cedb-dbx-info" }, `${dbxState.supported.length} ${t("db.importDbxFound")}${dbxState.withPassword > 0 ? ` · ${dbxState.withPassword} ${t("db.importDbxPassword")}` : ""}`)
			: null,
		h("span", { className: "ce-spacer" }),
		dbxState?.supported && dbxState.imported === undefined
			? h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", disabled: dbxState.busy, onClick: () => void onImportDbx?.(true) }, dbxState.busy ? t("loading") : t("db.importDbxApply"))
			: h("button", { type: "button", className: "ce-sk-btn", disabled: dbxState?.busy === true, onClick: () => void onImportDbx?.(false) }, dbxState?.busy ? t("loading") : t("db.importDbxScan")));
	return h("div", { className: "cedb-dialog cedb-dialog-wide", role: "dialog", "aria-label": t("db.driversButton") },
		h("h3", { className: "cedb-dialog-title" }, t("db.driversButton")),
		importStrip,
		h("div", { className: "cedb-driver-list ce-scroll" }, (drivers ?? []).map(card)),
		h("div", { className: "cedb-dialog-actions" },
			h("button", { type: "button", className: "ce-sk-btn", onClick: onRedetect }, t("db.redetect")),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: onClose }, t("close"))));
}

/** ER diagram: tables as boxes, foreign keys as curves; click a box to open it. */
export function ErDiagram({ t, schema, onOpenTable, onClose }) {
	const graph = erGraph(schema);
	const layout = erLayout(graph, { width: 820 });
	return h("div", { className: "cedb-dialog cedb-dialog-wide", role: "dialog", "aria-label": t("db.erButton") },
		h("h3", { className: "cedb-dialog-title" }, `${t("db.erButton")}${graph.database ? ` · ${graph.database}` : ""}`),
		graph.tables.length === 0
			? h("div", { className: "cedb-empty-result" }, h("div", { className: "cedb-empty-title" }, t("db.erEmpty")))
			: h("div", { className: "cedb-er-scroll ce-scroll" },
				h("svg", { className: "cedb-er", viewBox: `0 0 ${layout.width} ${layout.height}`, width: layout.width, height: layout.height, role: "img" },
					layout.links.map((link) => h("path", { key: `${link.from}->${link.to}`, d: link.path, className: "cedb-er-link" })),
					layout.boxes.map((box) => h("g", { key: box.name, className: "cedb-er-box", onClick: () => onOpenTable(box.name) },
						h("rect", { x: box.x, y: box.y, width: box.width, height: box.height, rx: 8 }),
						h("text", { x: box.x + 10, y: box.y + 20, className: "cedb-er-title" }, box.name),
						h("text", { x: box.x + 10, y: box.y + 38, className: "cedb-er-cols" },
							box.columns.slice(0, 3).join(", ") + (box.columns.length > 3 ? ", …" : "")))))),
		h("div", { className: "cedb-dialog-actions" }, h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: onClose }, t("close"))));
}

/** Execution plan: SQLite's tree, or a tabular plan from MySQL/PostgreSQL. */
export function ExplainPanel({ t, state, onClose }) {
	const rows = state.result?.rows ?? [];
	const tree = state.result?.tree ? planTree(state.result.columns, rows) : [];
	return h("div", { className: "cedb-dialog cedb-dialog-wide", role: "dialog", "aria-label": t("db.explain") },
		h("h3", { className: "cedb-dialog-title" }, t("db.explain")),
		state.busy ? h("div", { className: "cedb-empty-title" }, t("loading")) : null,
		state.error ? h("div", { className: "cedb-dialog-error", role: "alert" }, state.error) : null,
		!state.busy && !state.error
			? (tree.length > 0
				? h("div", { className: "cedb-plan ce-scroll" }, tree.map((node, index) => h("div", {
					key: index,
					className: "cedb-plan-row",
					style: { paddingLeft: `${10 + node.depth * 18}px` },
				}, node.depth > 0 ? "└ " : "", node.detail)))
				: h("div", { className: "cedb-plan ce-scroll" },
					h("table", { className: "cedb-grid" },
						h("thead", null, h("tr", null, (state.result?.columns ?? []).map((column) => h("th", { key: column }, column)))),
						h("tbody", null, rows.map((row, index) => h("tr", { key: index }, row.map((cell, cellIndex) => h("td", { key: cellIndex }, String(cell ?? "")))))))))
			: null,
		h("div", { className: "cedb-dialog-actions" }, h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", onClick: onClose }, t("close"))));
}

/** Import: paste CSV or JSON, preview the target, then insert row by row. */
export function ImportDialog({ t, table, driver, onInsert, onClose }) {
	const [text, setText] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const parsed = useMemo(() => parseDataText(text), [text]);
	return h("div", { className: "cedb-dialog cedb-dialog-wide", role: "dialog", "aria-label": t("db.import") },
		h("h3", { className: "cedb-dialog-title" }, `${t("db.import")} · ${table}`),
		h("p", { className: "cedb-dialog-hint" }, t("db.importHint")),
		h("textarea", {
			className: "cedb-sql cedb-import-text",
			value: text,
			rows: 6,
			spellCheck: false,
			placeholder: "id,name\n1,ada",
			onChange: (event) => { setText(event.target.value); setError(""); },
		}),
		parsed.error === "" && parsed.rows.length > 0
			? h("div", { className: "cedb-dialog-hint" }, `${parsed.columns.length} ${t("db.columns")} · ${parsed.rows.length} ${t("db.rows")}`)
			: null,
		error ? h("div", { className: "cedb-dialog-error", role: "alert" }, error) : null,
		h("div", { className: "cedb-dialog-actions" },
			h("button", {
				type: "button",
				className: "ce-sk-btn ce-sk-primary",
				disabled: busy || parsed.rows.length === 0,
				onClick: async () => {
					setBusy(true);
					const message = await onInsert(text);
					setBusy(false);
					if (message) setError(message);
				},
			}, busy ? t("loading") : t("db.importRun")),
			h("button", { type: "button", className: "ce-sk-btn", onClick: onClose }, t("close"))));
}

/** Insert one row: a field per column, empty fields left to the database. */
export function AddRowDialog({ t, table, columns, onInsert, onClose }) {
	const [values, setValues] = useState({});
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const filled = Object.values(values).filter((value) => value !== undefined && String(value).trim() !== "").length;
	return h("div", { className: "cedb-dialog cedb-dialog-wide", role: "dialog", "aria-label": t("db.addRow") },
		h("h3", { className: "cedb-dialog-title" }, `${t("db.addRow")} · ${table}`),
		h("p", { className: "cedb-dialog-hint" }, t("db.addRowHint")),
		h("div", { className: "cedb-field-row cedb-addrow" }, (columns ?? []).map((column) => h("label", { key: column.name, className: "cedb-field" },
			h("span", { className: "cedb-addrow-label" }, column.name, column.primaryKey ? h("span", { className: "cedb-pk" }, "PK") : null),
			h("input", {
				className: "ce-input",
				value: values[column.name] ?? "",
				placeholder: column.type,
				spellCheck: false,
				onChange: (event) => {
					const next = { ...values };
					if (event.target.value === "") delete next[column.name];
					else next[column.name] = event.target.value;
					setValues(next);
				},
			})))),
		error ? h("div", { className: "cedb-dialog-error", role: "alert" }, error) : null,
		h("div", { className: "cedb-dialog-actions" },
			h("button", {
				type: "button",
				className: "ce-sk-btn ce-sk-primary",
				disabled: busy || filled === 0,
				onClick: async () => {
					setBusy(true);
					const message = await onInsert(values);
					setBusy(false);
					if (message) setError(message);
				},
			}, busy ? t("loading") : t("db.insertRow")),
			h("button", { type: "button", className: "ce-sk-btn", onClick: onClose }, t("close"))));
}
