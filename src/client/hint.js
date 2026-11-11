/* Fast action hints rendered outside scroll containers so tree edges cannot clip them. */
import { h, useCallback, useEffect, useRef } from "./react.js";

let nextHintId = 0;
let dismissCurrent = null;

export function HintButton({ hint, title: _nativeTitle, ...props }) {
	const timer = useRef(null);
	const active = useRef(null);
	const hide = useCallback(() => {
		if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
		const current = active.current;
		if (!current) return;
		active.current = null;
		current.node.remove();
		if (current.previous) current.target.setAttribute("aria-describedby", current.previous);
		else current.target.removeAttribute("aria-describedby");
		document.removeEventListener("scroll", hide, true);
		window.removeEventListener("resize", hide);
		if (dismissCurrent === hide) dismissCurrent = null;
	}, []);
	useEffect(() => hide, [hide]);

	const show = (event, delay) => {
		hide();
		const target = event.currentTarget;
		timer.current = setTimeout(() => {
			timer.current = null;
			if (!target.isConnected || !hint) return;
			dismissCurrent?.();
			const node = document.createElement("span");
			node.className = "ce-fast-hint";
			node.id = `ce-fast-hint-${++nextHintId}`;
			node.setAttribute("role", "tooltip");
			node.textContent = hint;
			node.style.visibility = "hidden";
			document.body.appendChild(node);
			const anchor = target.getBoundingClientRect();
			const size = node.getBoundingClientRect();
			const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - size.width / 2, window.innerWidth - size.width - 8));
			const below = anchor.bottom + 6;
			const top = below + size.height <= window.innerHeight - 8 ? below : Math.max(8, anchor.top - size.height - 6);
			node.style.left = `${left}px`;
			node.style.top = `${top}px`;
			node.style.visibility = "visible";
			active.current = { node, target, previous: target.getAttribute("aria-describedby") };
			target.setAttribute("aria-describedby", [active.current.previous, node.id].filter(Boolean).join(" "));
			dismissCurrent = hide;
			document.addEventListener("scroll", hide, true);
			window.addEventListener("resize", hide);
		}, delay);
	};

	return h("button", {
		...props,
		"aria-label": props["aria-label"] ?? hint,
		onMouseEnter: (e) => { show(e, 100); props.onMouseEnter?.(e); },
		onMouseLeave: (e) => { hide(); props.onMouseLeave?.(e); },
		onFocus: (e) => { show(e, 0); props.onFocus?.(e); },
		onBlur: (e) => { hide(); props.onBlur?.(e); },
		onPointerDown: (e) => { hide(); props.onPointerDown?.(e); },
		onClick: (e) => { hide(); props.onClick?.(e); },
		onKeyDown: (e) => { if (e.key === "Escape") { hide(); e.stopPropagation(); } props.onKeyDown?.(e); },
	}, props.children);
}
