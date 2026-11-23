/** The rail: saved connections plus one tree of instances → databases → tables.
 *
 * Presentational on purpose. It receives the derived trees and the callbacks it
 * fires; the workbench owns the state. That keeps the rail renderable in a test
 * with three props instead of a live connection.
 */

import { Fragment, h } from "../react.js";

/**
 * Rendered as a plain function rather than an element: the rail has no hooks, and
 * calling it keeps the tree flat, which is what the tests already assert against.
 *
 * @param props - `{t, profiles, connections, databasesFor, openConns, collapsedDbs,
 *   expanded, activeConn, activeDb, activeTableKey, profileErrors, schemaBusy,
 *   schemaError, filter, onFilter, onConnect, onForget, onToggleConn,
 *   onDisconnect, onSelectDatabase, onSelectTable, onOpenQuery}`
 */
export function renderRail(props) {
	const {
		t, profiles, connections, databasesFor, openConns, collapsedDbs, expanded,
		activeConn, activeDb, activeTableKey, profileErrors, schemaBusy, schemaError, filter,
		onFilter, onConnect, onForget, onToggleConn, onDisconnect, onSelectDatabase,
		onSelectTable, onOpenQuery,
	} = props;
	// A comment between `return` and the value would be an ASI hazard, so the tree
	// starts on the return line.
	return h("aside", { className: "cedb-rail" },
	profiles.length > 0
		? h(Fragment, null,
			h("div", { className: "cedb-rail-head cedb-rail-head-sub" },
				h("span", { className: "cedb-rail-title" }, t("db.savedConnections"))),
			profiles.map((profile) => h("div", { key: profile.id, className: "cedb-conn cedb-saved" },
				h("button", {
					type: "button",
					className: "cedb-conn-main",
					title: `${profile.address || profile.path} — ${t("db.connectSaved")}`,
					onClick: () => void onConnect(profile),
				},
				profile.color ? h("span", { className: "cedb-color-dot", style: { background: profile.color }, "aria-hidden": "true" }) : null,
				h("span", { className: `cedb-driver cedb-driver-${profile.driver}` }, profile.driver),
				h("span", { className: "cedb-conn-label" }, profile.label),
				profile.note ? h("span", { className: "cedb-conn-note", title: profile.note }, "…") : null,
				profileErrors[profile.id] ? h("span", { className: "cedb-conn-bad", title: profileErrors[profile.id], "aria-label": profileErrors[profile.id] }, "⚠") : null),
				h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.forget"), onClick: () => void onForget(profile) }, "✕"),
			)))
		: null,
	h("div", { className: "cedb-rail-head cedb-rail-head-split" },
		h("span", { className: "cedb-rail-title" }, t("db.connections")),
		h("input", {
			className: "ce-input cedb-filter",
			placeholder: t("db.search"),
			value: filter,
			onChange: (event) => onFilter(event.target.value),
		}),
	),
	connections.length === 0
		? h("div", { className: "cedb-empty" }, t("db.noConnections"))
		: connections.map((connection) => {
			const open = openConns[connection.id] === true;
			const loaded = schemas[connection.id];
			return h("div", { key: connection.id, className: `cedb-instance${connection.id === activeConn ? " cedb-instance-on" : ""}` },
				h("div", { className: "cedb-conn" },
					h("button", {
						type: "button",
						className: "cedb-conn-main",
						title: connection.path || connection.label,
						"aria-expanded": open,
						onClick: () => {
							onToggleConn(connection, !open)
						},
					},
					h("span", { className: "cedb-caret" }, open ? "▾" : "▸"),
					h("span", { className: `cedb-driver cedb-driver-${connection.driver}` }, connection.driver),
					h("span", { className: "cedb-conn-label" }, connection.label),
					connection.impl === "module" ? h("span", { className: "cedb-ctx cedb-ctx-dim" }, "module") : null),
					h("button", { type: "button", className: "ce-tool ce-tiny", title: t("db.disconnect"), onClick: () => void onDisconnect(connection.id) }, "✕")),
				open
					? h("div", { className: "cedb-instance-body" },
						schemaBusy && !loaded ? h("div", { className: "cedb-empty" }, t("loading")) : null,
						schemaError && connection.id === activeConn ? h("div", { className: "cedb-error cedb-pad" }, schemaError) : null,
						databasesFor(connection.id).map((database) => {
							const dbKey = `${connection.id}:${database.name}`;
							const selected = activeDb.conn === connection.id && activeDb.database === database.name;
							const collapsed = collapsedDbs[dbKey] === true;
							return h("div", { key: database.name, className: "cedb-db" },
							h("button", {
								type: "button",
								className: `cedb-db-name${selected ? " cedb-db-on" : ""}`,
								"aria-expanded": !collapsed,
								title: `${database.name} · ${database.tables.length} ${t("db.tables")}`,
								onClick: () => {
									onSelectDatabase(connection.id, database.name)
								},
							},
							h("span", { className: "cedb-caret" }, collapsed ? "▸" : "▾"),
							h("span", { className: "cedb-db-label" }, database.name),
							database.tables.length === 0 ? h("span", { className: "cedb-db-hint" }, t("db.notLoaded")) : null),
							collapsed ? null : database.tables.map((entry) => {
								const key = `${connection.id}:${database.name}:${entry.name}`;
								const expandedTable = expanded.has(key);
								const tabKey = `table:${connection.id}:${database.name}:${entry.name}`;
								return h("div", { key, className: "cedb-table" },
									h("button", {
										type: "button",
										className: `cedb-table-row${activeTableKey === tabKey ? " cedb-table-on" : ""}`,
										title: `${entry.name} · ${entry.columns?.length ?? 0} ${t("db.columns")}`,
										onClick: () => { onSelectTable(connection.id, database.name, entry) },
										onDoubleClick: () => onOpenQuery(entry.name),
									},
									h("span", { className: `cedb-kind cedb-kind-${entry.kind}` }, entry.kind === "view" ? "◇" : "▤"),
									h("span", { className: "cedb-table-name" }, entry.name)),
									expandedTable && entry.columns?.length
										? h("ul", { className: "cedb-cols" }, entry.columns.map((column) => h("li", { key: column.name, className: "cedb-col" },
											h("span", { className: "cedb-col-name" }, column.name),
											h("span", { className: "cedb-col-type" }, column.type),
											column.primaryKey ? h("span", { className: "cedb-pk" }, "PK") : null,
											column.nullable === false ? h("span", { className: "cedb-nn" }, "NN") : null,
										)))
										: null,
								);
							}));
						}),
					)
					: null,
			);
		}),
	);
}

