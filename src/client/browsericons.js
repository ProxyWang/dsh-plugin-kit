import { h } from "./react.js";
const paths = {
 home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
 external: "M14 3h7v7M21 3 10 14M11 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6",
 star: "m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9L12 3Z",
 bookmarks: "M6 3h12v18l-6-4-6 4V3Z",
 globe: "M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
 arrow: "M5 12h14m-6-6 6 6-6 6",
 close: "m6 6 12 12M18 6 6 18",
};
export function BrowserGlyph({ name, filled = false, size = 16 }) {
 const children = name === "settings"
  ? [h("path", { key: "gear", d: "m9 3-.6 2.4-2 1.2L4 6l-2 3.5 1.8 1.7v2.4L2 15.3l2 3.5 2.4-.6 2 1.2L9 22h4l.6-2.6 2-1.2 2.4.6 2-3.5-1.8-1.7v-2.4L20 9l-2-3.5-2.4.6-2-1.2L13 3H9Z" }), h("circle", { key: "center", cx: 11, cy: 12.5, r: 3 })]
  : [name === "globe" ? h("circle", { key: "circle", cx: 12, cy: 12, r: 9 }) : null, h("path", { key: "path", d: paths[name] ?? paths.globe })];
 return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: filled ? "currentColor" : "none", stroke: "currentColor", strokeWidth: 1.65, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, children);
}
