# Database panel: module map

The panel is split so that each file has one reason to change. Reading order is
top to bottom; the arrows show who imports whom.

## Host

```
lib/host/db.js                 facade: connect ladder, profiles, routes, re-exports
        │
        ├── db/registry.js     the live-connection map (connOf, list, close)
        ├── db/operations.js   schema / rows / query / columns / explain
        │        │
        │        └── db/cli.js   spawn mysql/psql, parse their output (cliQuery)
        │                 │
        │                 └── db/sql.js   quoting, CSV/mysql tag parsing, clauses
        │
        ├── drivers.js         the catalog shown in 驱动管理
        ├── modresolve.js      which mysql2/pg a project or the plugin provides
        ├── drivers/module-runner.js, db-worker.js, sqlite-ops.js
        ├── dbprofiles.js      saved connections (+ vault for passwords)
        ├── dbximport.js       one-way migration from dbx
        └── tunnel.js          ssh -L forward for a connection
```

**Extension points**

- **A new engine**: add an implementation file, register it in
  `drivers.js` with its `impl`/`capabilities`/`alternatives`, and make
  `db/operations.js` dispatch to it. Nothing else in the panel needs to know it
  exists; the dialog, the rail and the grid are driver-agnostic.
- **A new SQL helper**: `db/sql.js` (pure, no imports from the panel).
- **A new saved-connection field**: add it to `dbprofiles.js`'s schema and to the
  dialog's form; the `options` bag exists so TLS/tunnel/client settings do not
  each need a schema column.

## Client

```
src/client/db.js               DbView (state + orchestration) + definitions + re-exports
        │
        ├── db/rail.js         renderRail(): instances → databases → tables (no hooks)
        ├── db/grid.js         ResultGrid: virtualization, inline edit, row delete
        ├── db/dialogs.js      DriverManager, ErDiagram, ExplainPanel, Import, AddRow
        ├── db/format.js       PAGE_SIZE, toCsv, tableSql, requestToken, countOf
        ├── dbtools.js         pure SQL/CSV/ER helpers (also used by the host tests)
        └── dbconnect.js       address parsing (postgres://, mysql://, SQLite path)
```

`renderRail` is a plain function rather than an element: it has no hooks, and
calling it keeps the rendered tree flat, which is also how the existing tests
assert against the rail.

**Rules the code follows**

1. `db/grid.js` and `db/dialogs.js` are **presentational**: they take props and
   callbacks, never read connection state. That is also why they can be rendered
   in isolation by the tests.
2. `db.js` owns state and orchestration; it re-exports everything the tab
   registry and the tests import, so the file layout can change without touching
   callers.
3. Anything that talks to the Host goes through `api()` with a `db.*` route; a
   new route is added to the `dbRoutes` table and nowhere else.

## Testing

- `test-host.mjs` — the host modules in isolation (registry, parsing, paging,
  profiles, dbx import, tunnel validation).
- `test-client.mjs` — components rendered through `createHookRenderer`; the grid
  and dialog tests import from `src/client/db.js`, which is why the re-exports
  matter.
