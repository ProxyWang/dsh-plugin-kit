/** Small, stable facts about the panel: engine categories, colour tags, ports.
 *
 * They are constants plus two pure functions, kept apart from both the state and
 * the markup so either can import them without a cycle.
 */

export const CATEGORIES = [
	{ id: "all", key: "db.catAll", ids: null },
	{ id: "relational", key: "db.catRelational", ids: ["mysql", "postgres"] },
	{ id: "file", key: "db.catFile", ids: ["sqlite"] },
];

/** Colour tags a connection can carry ("" means none). */
export const CONNECTION_COLORS = ["", "#e5484d", "#f5a524", "#3fb950", "#58a6ff", "#a371f7"];

/**
 * The port a driver uses when the field is left empty.
 *
 * @param driver - `sqlite` | `mysql` | `postgres`
 * @returns the port as a string, or "" for a file-backed driver
 */
export function defaultPort(driver) {
	if (driver === "mysql") return "3306";
	if (driver === "postgres") return "5432";
	return "";
}

/**
 * Which implementation of a driver will run, in one short suffix.
 *
 * The catalog prefers a project module over the CLI, so the dialog has to say
 * which one it picked — "MySQL" alone no longer identifies what will execute.
 *
 * @param driver - one entry from `db.drivers`
 * @param t - translator
 * @returns a suffix like ` · mysql2@3.11` or ` · CLI`, or ""
 */
export function implSuffix(driver, t) {
	if (!driver || !driver.impl) return "";
	if (driver.impl === "module") return ` · ${driver.version || t("db.implModule")}`;
	if (driver.impl === "cli") return ` · ${t("db.implCli")}`;
	return ` · ${t("db.implEmbedded")}`;
}
