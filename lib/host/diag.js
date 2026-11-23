/** TEMP(diag): append one line to a log the developer can read.
 *
 * Used only while diagnosing why a client registration does not appear; remove
 * together with its route and call sites.
 */

import { appendFile } from "node:fs/promises";

const LOG = "/tmp/dsh-plugin-kit-diag.log";

/** @param text - one diagnostic line (truncated) */
export async function diagNote(text) {
	try {
		await appendFile(LOG, `${new Date().toISOString()} ${String(text ?? "").slice(0, 500)}\n`);
	} catch { /* diagnostics must never break the caller */ }
}
