/** Module-boundary probes: keep the database panel's layering honest.
 *
 * Refactors rot silently: a view starts importing the Host API "just this once",
 * or the state owner grows a second home. These checks are cheap enough to run on
 * every test pass and fail with the exact file and rule, so the layout described
 * in docs/database-panel.md stays true.
 *
 * Run with: node test-structure.mjs
 */

import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
const check = (name, cond, extra) => {
	if (cond) { pass++; console.log(`  ok  ${name}`); }
	else { fail++; console.log(`FAIL  ${name}${extra !== undefined ? ` → ${JSON.stringify(extra).slice(0, 160)}` : ""}`); }
};

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const importsOf = (source) => [...source.matchAll(/^import\s+(?:[^"']*?)\s+from\s+"([^"]+)";/gm)].map((match) => match[1]);

// 1. Views never call the Host directly: only the state owner may import api.js.
const viewFiles = ["src/client/db/view.js", "src/client/db/rail.js", "src/client/db/grid.js", "src/client/db/dialogs.js", "src/client/db/format.js", "src/client/db/meta.js"];
for (const file of viewFiles) {
	const imports = importsOf(read(file));
	check(`${file} does not import the Host API`, !imports.some((path) => path.endsWith("api.js")), imports);
}

// 2. One state owner: only db/state.js may use the React state/effect hooks.
const stateOwner = read("src/client/db/state.js");
check("db/state.js owns useState", stateOwner.includes("useState"));
check("db/state.js owns useEffect", stateOwner.includes("useEffect"));
// Components may keep local UI state (an open cell editor, a half-filled form);
// the layout modules may not, because that state belongs to the workbench.
for (const file of ["src/client/db/view.js", "src/client/db/rail.js"]) {
	const source = read(file);
	check(`${file} holds no hook state`, !/\buse(State|Effect|Reducer)\(/.test(source), null);
}

// 3. The Host package imports downwards only: no module may import the facade.
for (const file of ["lib/host/db/sql.js", "lib/host/db/cli.js", "lib/host/db/registry.js", "lib/host/db/operations.js", "lib/host/db/migrate.js", "lib/host/db/install.js", "lib/host/db/profile-source.js", "src/client/branchchip.js"]) {
	const imports = importsOf(read(file));
	check(`${file} does not import the facade`, !imports.some((path) => path === "../db.js" || path === "./db.js"), imports);
}

// 4. Every split module explains itself on line one.
const documented = ["src/client/db/state.js", "src/client/db/view.js", "src/client/db/rail.js", "src/client/db/grid.js", "src/client/db/dialogs.js", "src/client/db/format.js", "src/client/db/meta.js", "lib/host/db/sql.js", "lib/host/db/cli.js", "lib/host/db/registry.js", "lib/host/db/operations.js", "lib/host/db/migrate.js", "lib/host/db/install.js", "lib/host/db/profile-source.js", "src/client/branchchip.js"];
for (const file of documented) {
	check(`${file} starts with a doc comment`, read(file).startsWith("/**"), read(file).slice(0, 40));
}

// 5. The sidebar chip registers into a slot the workspace panel declares, so that
//    package has to be loaded before this plugin's client module runs.
{
	const manifest = JSON.parse(read("package.json"));
	const inject = manifest?.dsh?.client?.inject ?? [];
	check("the manifest loads the workspace panel before registering into its slot", inject.includes("@deepseek-ai/dsh-client-ui-workspace"), inject);
	const chip = read("src/client/branchchip.js");
	check("the chip resolves its workspace from the slot's useSessions prop", chip.includes("useSessions"), null);
}

// 6. The public surface stays on the facade, so callers never chase files.
const facade = read("src/client/db.js");
for (const name of ["DbView", "DbTitle", "dbDefinition", "ResultGrid", "AddRowDialog", "toCsv", "tableSql", "CATEGORIES"]) {
	check(`db.js still exports ${name}`, new RegExp(`\\b${name}\\b`).test(facade), null);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
