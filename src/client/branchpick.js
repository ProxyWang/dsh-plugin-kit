/* ---------------- branch switcher palette (search + checkout) ---------------- */

import { h, useEffect, useMemo, useState } from "./react.js";
import { api } from "./api.js";
import { useDismissLayer } from "./dismiss.js";

export function BranchPalette({ cwd, repo, current, t, onDone, onClose, onFetch, onPull, onPush, canPush }) {
	const panelRef = useDismissLayer({ onDismiss: onClose, ignoreSelector: ".ce-branch" });
	const [query, setQuery] = useState("");
	const [list, setList] = useState(null);
	const [error, setError] = useState("");
	const [sel, setSel] = useState(0);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let alive = true;
		api("git.branches", repo ? { cwd, repo } : { cwd }).then((res) => {
			if (!alive) return;
			if (!res.ok) {
				setError(res.error);
				setList([]);
				return;
			}
			setList(res.value.branches ?? []);
		});
		return () => {
			alive = false;
		};
	}, [cwd, repo]);

	const filtered = useMemo(() => {
		const all = list ?? [];
		const needle = query.trim().toLowerCase();
		const hit = needle === "" ? all : all.filter((b) => b.name.toLowerCase().includes(needle));
		return hit.slice(0, 200);
	}, [list, query]);

	const checkout = (branch) => {
		if (busy || !branch) return;
		setBusy(true);
		api("git.checkout", repo ? { cwd, repo, branch } : { cwd, branch }).then((res) => {
			setBusy(false);
			const ok = res.ok && !res.value?.error;
			onDone(ok, ok ? void 0 : (res.value?.error ?? res.error));
		});
	};

	const pick = (b) => checkout(b.remote ? b.name.slice(b.name.indexOf("/") + 1) : b.name);

	const onKeyDown = (event) => {
		event.stopPropagation();
		if (event.key === "Escape") {
			onClose();
			return;
		}
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setSel((s) => Math.min(filtered.length - 1, s + 1));
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setSel((s) => Math.max(0, s - 1));
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const b = filtered[sel];
			if (b && !b.current) pick(b);
		}
	};

	const locals = filtered.filter((b) => !b.remote);
	const remotes = filtered.filter((b) => b.remote);
	let index = -1;
	const row = (b) => {
		index += 1;
		const i = index;
		return h("button", {
			key: b.name,
			type: "button",
			className: `ce-qitem${i === sel ? " ce-qitem-sel" : ""}`,
			onClick: () => (b.current ? onClose() : pick(b)),
			onMouseEnter: () => setSel(i),
		},
		h("span", { className: "ce-symglyph" }, b.current ? "•" : b.remote ? "☁" : "⎇"),
		h("span", { className: "ce-qbase" }, b.name),
		b.current ? h("span", { className: "ce-qdir" }, t("branch.current")) : h("span", { className: "ce-qdir" }, b.sha),
		);
	};

	return h("div", { className: "ce-palette ce-bp", ref: panelRef, role: "dialog", "aria-label": t("branch.title") },
		h("div", { className: "ce-palette-head" },
			h("input", {
				className: "ce-input",
				placeholder: t("branch.search"),
				value: query,
				autoFocus: true,
				onChange: (e) => {
					setQuery(e.target.value);
					setSel(0);
				},
				onKeyDown,
			}),
			h("button", { type: "button", className: "ce-bp-act", title: t("branch.fetchTitle"), disabled: busy, onClick: onFetch }, t("branch.fetch")),
			h("button", { type: "button", className: "ce-bp-act", title: t("branch.pullTitle"), disabled: busy, onClick: onPull }, t("branch.pull")),
			onPush
				? h("button", { type: "button", className: "ce-bp-act ce-bp-push", title: t("branch.pushTitle"), disabled: busy || canPush === false, onClick: onPush }, t("branch.push"))
				: null,
			h("button", { type: "button", className: "ce-tool ce-tiny", title: `${t("close")} (Esc)`, onClick: onClose }, "✕"),
		),
		h("div", { className: "ce-palette-list ce-scroll" },
			error ? h("div", { className: "ce-note" }, error) : null,
			list === null ? h("div", { className: "ce-note" }, "…") : null,
			list !== null && filtered.length === 0 ? h("div", { className: "ce-note" }, t("branch.none")) : null,
			locals.length > 0 ? h("div", { className: "ce-section" }, t("branch.local")) : null,
			locals.map(row),
			remotes.length > 0 ? h("div", { className: "ce-section" }, t("branch.remote")) : null,
			remotes.map(row),
		),
	);
}
