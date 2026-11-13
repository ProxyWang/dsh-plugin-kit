// A stand-in for the browser-only platform seed word "react" (see esm-react-hook.mjs).
// Only ever used by the tests: in the app, `require("react")` is served by the host.
export function createElement(type, props, ...children) {
	return { type, props: props ?? {}, children };
}

export const Fragment = Symbol.for("react.fragment");

// Opt-in stateful renders for handler tests. Effects are deliberately skipped:
// this verifies event/state transitions, not browser layout. Pass { effects: true }
// and flushEffects() after assigning refs to test listener lifecycle explicitly.
let renderState = null;
// Expand function-type elements (child components) depth-first while the render
// state is live, so their hooks join the one cursor in deterministic tree order,
// the way a real reconciler would give them their own frames.
function expand(node) {
	if (Array.isArray(node)) return node.flatMap(expand);
	if (!node || typeof node !== "object") return node;
	if (typeof node.type === "function") return expand(node.type(node.props));
	if (node.type === Fragment) return (node.children ?? []).flatMap(expand);
	return { ...node, children: (node.children ?? []).flatMap(expand) };
}
export function createHookRenderer(component, props, options = {}) {
	const state = { slots: [], cursor: 0, runEffects: options.effects === true, expand: options.expand === true, effects: new Map(), pending: new Map() };
	const render = () => {
		state.cursor = 0;
		renderState = state;
		try { return state.expand ? expand(component(props)) : component(props); } finally { renderState = null; }
	};
	render.flushEffects = () => {
		for (const [index, { effect, deps }] of [...state.pending]) {
			state.pending.delete(index);
			state.effects.get(index)?.cleanup?.();
			state.effects.set(index, { deps, cleanup: effect() });
		}
	};
	render.unmount = () => {
		state.pending.clear();
		for (const entry of state.effects.values()) entry.cleanup?.();
		state.effects.clear();
	};
	return render;
}

export function useState(initial) {
	if (renderState) {
		const state = renderState;
		const index = state.cursor++;
		if (!(index in state.slots)) state.slots[index] = typeof initial === "function" ? initial() : initial;
		return [state.slots[index], (next) => { state.slots[index] = typeof next === "function" ? next(state.slots[index]) : next; }];
	}
	const box = { value: typeof initial === "function" ? initial() : initial };
	return [box.value, (next) => { box.value = typeof next === "function" ? next(box.value) : next; return box.value; }];
}

export function useEffect(effect, deps) {
	if (renderState) {
		if (!renderState.runEffects) return;
		const index = renderState.cursor++;
		const previous = renderState.effects.get(index);
		if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) renderState.pending.set(index, { effect, deps });
		return;
	}
	return effect();
}

export function useRef(initial) {
	if (renderState) return useState(() => ({ current: initial }))[0];
	return { current: initial };
}

export function useCallback(fn) {
	return fn;
}

export function useMemo(factory) {
	return factory();
}

const React = { createElement, Fragment, useState, useEffect, useRef, useCallback, useMemo };

export { React };
export default React;
