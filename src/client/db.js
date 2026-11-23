/* ---------------- Database workbench ------------------------------------------
 *
 * The panel is assembled from five parts, each with one reason to change:
 *
 *   db/state.js    useWorkbench() — every hook, effect and action (the only owner
 *                  of state; returns one object the views read)
 *   db/view.js     renderWorkbench(wb) — the panel's markup
 *   db/rail.js     renderRail(wb) — instances → databases → tables
 *   db/grid.js     ResultGrid — virtualized table, inline edit, row delete
 *   db/dialogs.js  the modal surfaces (drivers, ER, plan, import, add row)
 *
 * This file is the tab's public face: the definition, the title, and one thin
 * component that joins state to markup. Callers and tests import from here.
 */

import { Fragment, h } from "./react.js";
import { DB_TAB_ID, DB_TAB_KIND } from "./constants.js";
import { ToolGlyph } from "./lefttools.js";
import { useWorkbench } from "./db/state.js";
import { renderWorkbench } from "./db/view.js";

// The public surface stays on this module so callers (and the tests) never need
// to know how the panel is split internally.
export { formatCell, gridWindow, truncateCell, ResultGrid, GRID_ROW_H } from "./db/grid.js";
export { AddRowDialog, DriverManager, ErDiagram, ExplainPanel, ImportDialog } from "./db/dialogs.js";
export { CATEGORIES, CONNECTION_COLORS, defaultPort, implSuffix } from "./db/meta.js";
export { HISTORY_CAP, PAGE_SIZE, countOf, requestToken, tableSql, toCsv } from "./db/format.js";

export const dbDefinition = (t) => ({
	id: DB_TAB_ID,
	kind: DB_TAB_KIND,
	priority: "extension",
	keepMounted: true,
	title: () => t("db.label") || "数据库",
	guide: [],
});

/** The panel itself: one state hook, one pure render. */
export function DbView(props) {
	return renderWorkbench(useWorkbench(props));
}

/**
 * The database tab's label in the sidebar strip.
 *
 * It used to return null, and a registered title slot *replaces* the fallback
 * the host would otherwise draw — which is why the tab showed nothing but its ✕.
 */
export function DbTitle({ useTabInfo }) {
	const info = useTabInfo ? useTabInfo() : null;
	const title = info?.tab?.title;
	const label = typeof title === "string" && title !== "" ? title : "数据库";
	return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(ToolGlyph, { size: 14, glyph: "db" })), label);
}
