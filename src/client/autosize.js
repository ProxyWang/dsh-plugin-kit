/* ---------------- textareas that grow with their content ----------------
 *
 * A JSON body or a SQL statement is as long as it is; a fixed 70px box shows
 * four lines of a forty-line message and wastes the rest of the pane. This hook
 * measures the content and sets the element's height, leaving the ceiling to CSS
 * (`max-height`) so the split with the pane below is never broken.
 */

import { useEffect } from "./react.js";

/**
 * Keep a textarea's height equal to its content.
 *
 * @param ref - ref whose `current` is the textarea
 * @param value - the controlled value; a change re-measures
 * @param options - `{ min }` px floor (default 96), `extra` px of slack
 */
export function useAutoHeight(ref, value, options = {}) {
	const min = Number(options.min) > 0 ? Number(options.min) : 96;
	const extra = Number(options.extra) >= 0 ? Number(options.extra) : 2;
	useEffect(() => {
		const node = ref?.current;
		if (!node || typeof node.style !== "object" || typeof node.scrollHeight !== "number") return;
		// `auto` first: without it scrollHeight can only grow, never shrink.
		node.style.height = "auto";
		node.style.height = `${Math.max(min, node.scrollHeight + extra)}px`;
	}, [value, min, extra]);
}