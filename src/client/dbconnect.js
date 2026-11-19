/* ---------------- connection address: one field, the driver is inferred ----------------
 *
 * Nobody wants to answer "which driver?" before typing the thing they already
 * know — the target. A database client should read the target and decide:
 * `postgres://…` is PostgreSQL, `mysql://…` is MySQL, and anything that looks
 * like a file is SQLite. That is the whole point of this module, and it keeps
 * the answer in one place instead of spread through a form.
 *
 * The rules are deliberately boring and total:
 *
 *   postgres://, postgresql://        → postgres  (default port 5432)
 *   mysql://, mariadb://              → mysql     (default port 3306)
 *   sqlite://, file:                  → sqlite
 *   C:\…, ./…, /…, name.db, name     → sqlite (a path, not a URL)
 *
 * Anything else is reported as unrecognised rather than guessed: opening an
 * unrelated file as a database produces a confusing error much later, while
 * saying "I don't know what this is" is immediate and honest.
 */

/** Drivers this panel can open, in menu order. */
export const DRIVERS = ["sqlite", "mysql", "postgres"];

/** Default TCP port per server driver. */
const DEFAULT_PORT = { mysql: 3306, postgres: 5432 };

/** URI schemes that name a driver, mapped to it. */
const SCHEMES = {
	postgres: "postgres",
	postgresql: "postgres",
	mysql: "mysql",
	mariadb: "mysql",
	sqlite: "sqlite",
	sqlite3: "sqlite",
	file: "sqlite",
};

/** File suffixes that make a bare path obviously SQLite. */
const SQLITE_SUFFIX = /\.(sqlite3?|db|s3db|sl3)$/iu;

/** A Windows drive path is a file path, not a `c:` URI scheme. */
const WINDOWS_PATH = /^[a-z]:[\\/]/iu;

/**
 * Decode a URI component without throwing on malformed input.
 * @param value - encoded component.
 * @returns the decoded text, or the input when it is not valid encoding.
 */
function decode(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/**
 * Whether a string looks like a filesystem path rather than a URL.
 * @param input - the typed address.
 * @returns whether the SQLite rules apply.
 */
export function looksLikePath(input) {
	const value = String(input ?? "").trim();
	if (value === "") return false;
	if (WINDOWS_PATH.test(value)) return true;
	if (value.includes("/") || value.includes("\\")) return true;
	// A bare name is only a database when its suffix says so: "app.db" is a
	// target, "notes.txt" is a typo worth reporting immediately.
	return SQLITE_SUFFIX.test(value);
}

/**
 * Infer the driver from an address.
 * @param input - the typed address.
 * @returns a driver id, or "" when the address is empty or unrecognised.
 */
export function inferDriver(input) {
	const value = String(input ?? "").trim();
	if (value === "") return "";
	const scheme = /^([a-z][a-z0-9+.-]*):(\/\/)?/iu.exec(value);
	if (scheme !== null && !WINDOWS_PATH.test(value)) {
		const driver = SCHEMES[scheme[1].toLowerCase()];
		if (driver !== undefined) return driver;
		// `host:5432/db` has a "scheme" that is really a host name.
		if (scheme[2] !== "//" && looksLikePath(value)) return "sqlite";
		return "";
	}
	return looksLikePath(value) ? "sqlite" : "";
}

/**
 * Parse a connection address into driver and fields.
 *
 * @param input - `postgres://user:pass@host:5432/db`, `sqlite://./app.db`, a
 *   file path, or an empty string.
 * @returns `{ driver, path, host, port, user, password, database, error }` where
 *   `error` explains an unrecognised address and the other fields are filled
 *   only when they apply.
 */
export function parseConnectionAddress(input) {
	const value = String(input ?? "").trim();
	const empty = { driver: "", path: "", host: "", port: "", user: "", password: "", database: "", error: "" };
	if (value === "") return empty;
	const driver = inferDriver(value);
	if (driver === "") return { ...empty, error: "unrecognised address" };
	if (driver === "sqlite") {
		const scheme = /^(?:sqlite3?|file):(?:\/\/)?/iu.exec(value);
		const path = scheme === null ? value : value.slice(scheme[0].length);
		return { ...empty, driver, path: path === "" ? "" : path };
	}
	let url;
	try {
		url = new URL(value);
	} catch {
		return { ...empty, driver, error: "malformed URL" };
	}
	const port = url.port === "" ? DEFAULT_PORT[driver] : Number(url.port);
	return {
		driver,
		path: "",
		host: url.hostname,
		port: Number.isFinite(port) ? String(port) : String(DEFAULT_PORT[driver]),
		user: decode(url.username),
		password: decode(url.password),
		database: decode(url.pathname.replace(/^\//u, "")),
		error: "",
	};
}

/**
 * Render fields back into an address, for showing a connection's target.
 * @param config - a parsed address or a saved connection's config.
 * @returns an address string; a server driver always carries its scheme.
 */
export function formatConnectionAddress(config) {
	if (!config) return "";
	const driver = String(config.driver ?? "");
	if (driver === "sqlite") return String(config.path ?? "");
	if (driver === "mysql" || driver === "postgres") {
		const scheme = driver === "mysql" ? "mysql" : "postgres";
		const auth = config.user ? `${encodeURIComponent(config.user)}${config.password ? `:${encodeURIComponent(config.password)}` : ""}@` : "";
		const port = config.port ? String(config.port) : DEFAULT_PORT[driver];
		const database = config.database ? `/${config.database}` : "";
		return `${scheme}://${auth}${config.host || "localhost"}:${port}${database}`;
	}
	return "";
}

/**
 * Display name for a driver id.
 * @param driver - driver id.
 * @returns a short label, or the id itself when unknown.
 */
export function driverLabel(driver) {
	return { sqlite: "SQLite", mysql: "MySQL", postgres: "PostgreSQL" }[driver] ?? String(driver ?? "");
}
