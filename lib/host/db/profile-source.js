/** The saved-connection service, injected by the plugin entry.
 *
 * A tiny holder so both the migration (write profiles) and the routes (list and
 * save profiles) reach the same service without importing each other.
 */

let service = null;

/** @param next - `createDbProfileService(...)`, or null to disable profiles. */
export function setProfileService(next) {
	service = next && typeof next.list === "function" ? next : null;
}

/** @returns the injected service */
export function profiles() {
	if (!service) throw new Error("saved connections are unavailable in this profile");
	return service;
}
