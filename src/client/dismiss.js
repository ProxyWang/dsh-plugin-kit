/* Non-modal transient layers share dismissal, without swallowing outside clicks. */
import { useEffect, useRef } from "./react.js";

const registries = new WeakMap();

function containsEvent(node, event) {
	return Boolean(node && (event.composedPath?.().includes(node) || node.contains?.(event.target)));
}

/** Exported for DOM/event regression tests. One listener pair per owner document. */
export function registerDismissLayer(doc, layer) {
	let registry = registries.get(doc);
	if (!registry) {
		const layers = [];
		const top = () => [...layers].reverse().find((entry) => {
			const node = entry.node();
			return node && node.isConnected !== false && (!node.getClientRects || node.getClientRects().length > 0);
		});
		const pointer = (event) => {
			if (typeof event.button === "number" && event.button !== 0) return;
			const entry = top();
			if (!entry || containsEvent(entry.node(), event) || entry.ignore?.(event)) return;
			entry.dismiss("outside");
		};
		const key = (event) => {
			if (event.key !== "Escape" || event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
			const entry = top();
			if (!entry) return;
			event.preventDefault();
			event.stopPropagation();
			entry.dismiss("escape");
		};
		registry = { layers, pointer, key };
		registries.set(doc, registry);
		doc.addEventListener("pointerdown", pointer, true);
		doc.addEventListener("keydown", key, true);
	}
	registry.layers.push(layer);
	let registered = true;
	return () => {
		if (!registered) return;
		registered = false;
		const index = registry.layers.indexOf(layer);
		if (index >= 0) registry.layers.splice(index, 1);
		if (registry.layers.length) return;
		doc.removeEventListener("pointerdown", registry.pointer, true);
		doc.removeEventListener("keydown", registry.key, true);
		registries.delete(doc);
	};
}

export function useDismissLayer({ open = true, onDismiss, ignoreSelector } = {}) {
	const ref = useRef(null);
	const latest = useRef(null);
	latest.current = { onDismiss, ignoreSelector };
	useEffect(() => {
		if (!open || typeof document === "undefined") return undefined;
		const doc = ref.current?.ownerDocument ?? document;
		const active = doc.activeElement;
		const root = ref.current?.closest?.(".ce-root");
		const previousFocus = ref.current?.contains?.(active)
			? (ignoreSelector ? root?.querySelector?.(ignoreSelector) : null) ?? root?.querySelector?.(".ce-code")
			: active;
		return registerDismissLayer(doc, {
			node: () => ref.current,
			ignore: (event) => {
				const trigger = latest.current.ignoreSelector && event.target?.closest?.(latest.current.ignoreSelector);
				return Boolean(trigger && trigger.closest?.(".ce-root") === ref.current?.closest?.(".ce-root"));
			},
			dismiss: (reason) => {
				latest.current.onDismiss?.(reason);
				// Pointer dismissal must leave focus to the clicked destination.
				if (reason === "escape" && previousFocus?.isConnected !== false) previousFocus?.focus?.({ preventScroll: true });
			},
		});
	}, [open]);
	return ref;
}
