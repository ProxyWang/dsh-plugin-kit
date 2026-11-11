// A stand-in for the browser-only platform seed word "react" (see esm-react-hook.mjs).
// Only ever used by the tests: in the app, `require("react")` is served by the host.
export function createElement(type, props, ...children) {
	return { type, props: props ?? {}, children };
}

export const Fragment = Symbol.for("react.fragment");

// Opt-in stateful renders for handler tests. Effects are deliberately skipped:
// this verifies event/state transitions, not React lifecycle or browser layout.
let renderState = null;
export function createHookRenderer(component, props) {
	const state = { slots: [], cursor: 0 };
	return () => {
		state.cursor = 0;
		renderState = state;
		try { return component(props); } finally { renderState = null; }
	};
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

export function useEffect(effect) {
	if (renderState) return;
	return effect();
}

export function useRef(initial) {
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
