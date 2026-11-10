/* ---------------- icons ---------------- */

import { h } from "./react.js";

function svg(children, size = 16) {
	return h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, children);
}
export const IconCode = ({ size }) => svg([h("path", { key: "a", d: "M9 6 3.5 12 9 18" }), h("path", { key: "b", d: "M15 6 20.5 12 15 18" })], size ?? 16);
export const IconFolder = ({ open }) => svg(open ? h("path", { key: "p", d: "M3 19 6 8h13l-3 11Z M6 8V5h5l2 3" }) : h("path", { key: "p", d: "M3 6h6l2 2h10v12H3Z" }));
export const IconFile = () => svg(h("path", { key: "p", d: "M6 2h8l4 4v16H6Z M14 2v4h4" }));
export const IconRefresh = () => svg([h("path", { key: "p", d: "M20 12a8 8 0 1 1-2.3-5.7" }), h("path", { key: "q", d: "M20 3v5h-5" })]);
export const IconArrowLeft = () => svg([h("path", { key: "p", d: "M20 12H5" }), h("path", { key: "q", d: "M11 6 5 12l6 6" })]);
export const IconArrowRight = () => svg([h("path", { key: "p", d: "M4 12h15" }), h("path", { key: "q", d: "M13 6l6 6-6 6" })]);
export const IconBolt = ({ on }) => svg(h("path", { key: "p", d: "M13 2 4 14h6l-1 8 9-12h-6Z", fill: on ? "currentColor" : "none" }));
export const IconSearch = () => svg([h("circle", { key: "c", cx: 10.5, cy: 10.5, r: 6.5 }), h("path", { key: "p", d: "M16 16l5 5" })]);
export const IconTextSearch = () => svg([h("path", { key: "a", d: "M4 5h16" }), h("path", { key: "b", d: "M4 10h11" }), h("path", { key: "c2", d: "M4 15h8" }), h("path", { key: "d", d: "M18 14.5l2.5 2.5" })]);
