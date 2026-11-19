/** Host contract probes: verify the DSH host seams this plugin depends on.
 *
 * These tests run against the installed DSH app.asar and assert that the
 * internal APIs the plugin relies on (layout.panels.setRightbar, sidebarRight
 * navigation, storageDomain schema, webServer prefix registration) still exist
 * in the current host version. When a seam breaks after a DSH upgrade, these
 * probes fail immediately instead of silently degrading at runtime.
 *
 * Run with: ELECTRON_RUN_AS_NODE=1 "$DSH_NODE_EXECUTABLE" test-contract.mjs
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// DSH packages live inside app.asar; native fs.existsSync cannot traverse it.
// Use the Electron runtime (ELECTRON_RUN_AS_NODE) for asar-aware reads.
const DSH_PKG_BASE = "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai";
const ASAR_ROOT = "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar";

let pass = 0;
let fail = 0;
const check = (name, cond, extra) => {
	if (cond) { pass++; console.log(`  ok  ${name}`); }
	else { fail++; console.log(`FAIL  ${name}${extra !== undefined ? ` → ${JSON.stringify(extra).slice(0, 120)}` : ""}`); }
};

function asarExists(relPath) {
	try { readFileSync(join(DSH_PKG_BASE, relPath)); return true; } catch { return false; }
}
function asarRead(relPath) {
	return readFileSync(join(DSH_PKG_BASE, relPath), "utf8");
}

// 1. Verify key packages exist in the installation.
const requiredPackages = [
	"dsh-client-ui-sidebar-right",
	"dsh-client-ui-layout",
	"dsh-desktop-host",
	"dsh-tool-web",
	"dsh-tool-skill",
];
for (const pkg of requiredPackages) {
	check(`package @deepseek-ai/${pkg} exists`, asarExists(`${pkg}/package.json`), pkg);
}

// 2. Verify sidebarRight bundle exposes openTab/openTabFromTarget/isTargetCurrent.
try {
	const sidebarBundle = asarRead("dsh-client-ui-sidebar-right/lib/client.js");
	check("sidebarRight.openTab exists in bundle", sidebarBundle.includes("openTab(kind,options"), null);
	check("sidebarRight.openTabFromTarget exists in bundle", sidebarBundle.includes("openTabFromTarget(kind,target)"), null);
	check("sidebarRight.isTargetCurrent exists in bundle", sidebarBundle.includes("isTargetCurrent(target)"), null);
	check("sidebarRight.navigate writes params", sidebarBundle.includes("tabDomain.navigate(sessionId,tabId,{address,params})"), null);
} catch (e) {
	check("sidebarRight bundle readable", false, e.message.slice(0, 80));
}

// 3. Verify layout bundle exposes setRightbar seam (used by rightbarwidth.js).
try {
	const layoutBundle = asarRead("dsh-client-ui-layout/lib/client.js");
	check("layout.setRightbar seam exists", layoutBundle.includes("setRightbar"), null);
} catch (e) {
	check("layout bundle readable", false, e.message.slice(0, 80));
}

// 4. Verify desktop host bundle exposes WebContentsView and shell.openExternal.
try {
	const mainBundle = readFileSync(join(ASAR_ROOT, "lib/main.js"), "utf8");
	check("desktop host uses WebContentsView", mainBundle.includes("WebContentsView"), null);
	check("desktop host shell.openExternal for http(s)", mainBundle.includes("shell.openExternal(url)"), null);
	check("desktop host denies webview attachment in platform view", mainBundle.includes("will-attach-webview"), null);
} catch (e) {
	check("desktop host main.js readable", false, e.message.slice(0, 80));
}

// 5. Verify storageDomain injection point (directory exists in asar).
check("storageDomain packages directory available", asarExists("dsh/package.json"), null);

// 6. Verify this package's Config is a Standard Schema. Cordis validates the
//    Loader entry's config through Config["~standard"].validate at activation;
//    a plain descriptor object throws "Cannot read properties of undefined
//    (reading 'validate')" and takes the whole Host half down with it.
try {
	const { Config } = await import("./index.js");
	check("Config exposes ~standard.validate", typeof Config?.["~standard"]?.validate === "function", null);
	const parsed = Config["~standard"].validate({});
	check("Config fills defaults for an empty entry config", !parsed.issues && parsed.value?.apiTimeoutMs === 30_000, parsed.issues?.[0]?.message);
} catch (error) {
	check("Config importable from index.js", false, error.message.slice(0, 80));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);