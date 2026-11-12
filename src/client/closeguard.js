/* Sidebar-page close guards share the host's synchronous cleanup contract. */
import { useEffect, useRef } from "./react.js";
export const BEFORE_TOOL_CLOSE = "dsh-plugin-kit/before-tool-close";

export function useToolCloseGuard({ sessionId, kind, dirty, onBlocked }) {
	const blocked = useRef(onBlocked);
	blocked.current = onBlocked;
	useEffect(() => {
		if (!sessionId || !dirty || typeof document === "undefined") return undefined;
		const beforeClose = (event) => {
			if (event.detail?.sessionId !== sessionId || event.detail?.kind !== kind) return;
			event.preventDefault();
			blocked.current?.();
		};
		document.addEventListener(BEFORE_TOOL_CLOSE, beforeClose);
		return () => document.removeEventListener(BEFORE_TOOL_CLOSE, beforeClose);
	}, [sessionId, kind, dirty]);
}

export function registerToolCloseGuard(sidebarRight, kind, message, doc = document) {
	return sidebarRight.registerCloseHandler(kind, (sessionId) => {
		const event = new CustomEvent(BEFORE_TOOL_CLOSE, { cancelable: true, detail: { sessionId, kind } });
		if (!doc.dispatchEvent(event)) throw new Error(message());
	});
}
