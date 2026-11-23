/** The result grid: a virtualized table with optional inline editing.
 *
 * It knows rows, columns and cells — not connections or SQL. The workbench hands
 * it a result plus callbacks, which is what keeps the grid reusable and small.
 */

import { h, useEffect, useRef, useState } from "../react.js";

/** One row's height, in pixels: virtualization depends on it. */
export const GRID_ROW_H = 24;

/** The visible cell, with NULLs and objects made printable. */
export function formatCell(value) {
	if (value === null) return "NULL";
	// `undefined` is a missing column, which is not the same as SQL NULL.
	if (value === undefined) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

/** What the cell shows before it is expanded in the detail popover. */
export function truncateCell(value, max = 120) {
	const text = formatCell(value);
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Which rows a virtualized grid should render.
 *
 * A query may return thousands of rows; rendering them all puts the same number
 * of `<tr>` elements in the DOM and the panel stops scrolling smoothly. Only the
 * window the viewport can show (plus a little overscan) is rendered, and two
 * spacer rows keep the scrollbar honest.
 *
 * @param input - `{count, scrollTop, viewport, rowHeight, overscan}`
 * @returns `{start, end, topPad, bottomPad}` with `[start, end)` half-open
 */
export function gridWindow(input = {}) {
	const count = Math.max(0, Math.floor(Number(input.count) || 0));
	const rawRowHeight = Number(input.rowHeight);
	const rowHeight = Number.isFinite(rawRowHeight) && rawRowHeight > 0 ? rawRowHeight : GRID_ROW_H;
	// `Number(undefined)` is NaN, and NaN survives `??`: without an explicit
	// finite check every unset option turned the whole window into NaN.
	const rawOverscan = Number(input.overscan);
	const overscan = Number.isFinite(rawOverscan) ? Math.max(0, Math.floor(rawOverscan)) : 8;
	const viewport = Math.max(0, Number(input.viewport) || 0);
	const scrollTop = Math.max(0, Number(input.scrollTop) || 0);
	const span = Math.ceil(viewport / rowHeight) + overscan * 2;
	const start = Math.min(count, Math.max(0, Math.floor(scrollTop / rowHeight) - overscan));
	const end = Math.min(count, start + span);
	return { start, end, topPad: start * rowHeight, bottomPad: Math.max(0, (count - end) * rowHeight) };
}

/** The result grid: sticky header, sortable columns, row numbers, cell inspection. */
export function ResultGrid({ t, result, onCell, onSort, order, dir, pkColumn = "", onEditCell, onDeleteRow, pendingDelete = -1 }) {
	const columns = result.columns ?? [];
	const rows = result.rows ?? [];
	const wrapRef = useRef(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewport, setViewport] = useState(360);
	// Inline edit state: one cell at a time, like every data grid.
	const [editing, setEditing] = useState(null);

	// The visible height drives the window, and the panel can be resized by the
	// splitter at any time, so it is measured rather than assumed.
	// A new result (or a re-sorted page) starts at the top: keeping the previous
	// scroll offset against a shorter result put the window past the last row,
	// which rendered an empty grid under a spacer.
	useEffect(() => {
		setScrollTop(0);
		if (wrapRef.current) wrapRef.current.scrollTop = 0;
	}, [result]);

	useEffect(() => {
		const node = wrapRef.current;
		if (!node) return undefined;
		const measure = () => setViewport(node.clientHeight || 360);
		measure();
		if (typeof ResizeObserver === "function") {
			const observer = new ResizeObserver(measure);
			observer.observe(node);
			return () => observer.disconnect();
		}
		return undefined;
	}, [columns.length]);

	if (columns.length === 0) return h("div", { className: "cedb-placeholder-small" }, t("db.noRows"));
	const window_ = gridWindow({ count: rows.length, scrollTop, viewport });
	const slice = rows.slice(window_.start, window_.end);
	const pad = (height, key) => (height > 0 ? h("tr", { key, className: "cedb-grid-pad", "aria-hidden": "true" }, h("td", { colSpan: columns.length + 1, style: { height: `${height}px`, padding: 0, border: 0 } })) : null);
	return h("div", { className: "cedb-grid-wrap", ref: wrapRef, onScroll: (event) => setScrollTop(event.currentTarget.scrollTop) },
		h("table", { className: "cedb-grid" },
			h("thead", null,
				h("tr", null,
					h("th", { className: "cedb-grid-gutter" }, "#"),
					columns.map((column, index) => h("th", {
						key: `${column}-${index}`,
						className: `cedb-grid-th${onSort ? " cedb-grid-sortable" : ""}${order === column ? " cedb-grid-sorted" : ""}`,
						onClick: onSort ? () => onSort(column) : undefined,
						title: column }, column, order === column ? (dir === "desc" ? " ↓" : " ↑") : "")))),
				onDeleteRow ? h("th", { className: "cedb-grid-gutter", title: t("db.deleteRow") }, "") : null,
			h("tbody", null,
				pad(window_.topPad, "pad-top"),
				slice.map((row, offset) => {
					const rowIndex = window_.start + offset;
					const editable = Boolean(onEditCell) && pkColumn !== "";
					return h("tr", { key: rowIndex, className: "cedb-grid-row" },
						h("td", { className: "cedb-grid-gutter" }, rowIndex + 1),
						row.map((cell, cellIndex) => {
							const isEditing = editing?.rowIndex === rowIndex && editing?.cellIndex === cellIndex;
							if (isEditing) {
								return h("td", { key: cellIndex, className: "cedb-grid-td cedb-grid-editing" },
									h("input", {
										className: "ce-input cedb-cell-input",
										autoFocus: true,
										value: editing.value,
										placeholder: editing.wasNull ? "NULL" : "",
										spellCheck: false,
										onChange: (event) => setEditing({ ...editing, value: event.target.value }),
										onKeyDown: (event) => {
											event.stopPropagation();
											if (event.key === "Enter") {
												// A NULL cell the user left empty stays NULL; typing
												// anything turns it into that text. Seeding the input with
												// "NULL" used to write the four-letter string instead.
												const next = editing.wasNull && editing.value.trim() === "" ? null : editing.value;
												onEditCell?.(rowIndex, columns[cellIndex], next);
												setEditing(null);
											}
											else if (event.key === "Escape") setEditing(null);
										},
										onBlur: () => setEditing(null) }));
							}
							return h("td", {
								key: cellIndex,
								className: `cedb-grid-td${cell === null ? " cedb-null" : ""}${editable ? " cedb-grid-editable" : ""}`,
								title: editable ? `${formatCell(cell)} · ${t("db.editHint")}` : formatCell(cell),
								onClick: () => onCell?.({ title: `${columns[cellIndex]} · ${t("db.row")} ${rowIndex + 1}`, value: cell }),
								onDoubleClick: editable ? () => setEditing({ rowIndex, cellIndex, value: cell === null || cell === undefined ? "" : formatCell(cell), wasNull: cell === null }) : undefined }, truncateCell(cell));
						}),
						onDeleteRow
							? h("td", { className: "cedb-grid-gutter" },
								h("button", {
									type: "button",
									className: `ce-tool ce-tiny${pendingDelete === rowIndex ? " cedb-del-armed" : ""}`,
									title: t("db.deleteRow"),
									onClick: () => onDeleteRow(rowIndex) }, "✕"))
							: null);
				}),
				pad(window_.bottomPad, "pad-bottom")),
		),
	);
}
