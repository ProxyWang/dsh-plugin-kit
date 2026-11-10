// A stand-in for the browser-only platform seed word "react" (see esm-react-hook.mjs).
// Only ever used by the tests: in the app, `require("react")` is served by the host.
export function createElement(type, props, ...children) {
	return { type, props: props ?? {}, children };
}

export const Fragment = Symbol.for("react.fragment");

export function useState(initial) {
	const box = { value: typeof initial === "function" ? initial() : initial };
	return [box.value, (next) => { box.value = typeof next === "function" ? next(box.value) : next; return box.value; }];
}

export function useEffect(effect) {
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
