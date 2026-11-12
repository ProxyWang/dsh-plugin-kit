/* ---------------- skills manager: browse / inspect / edit / create / delete ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { api } from "./api.js";
import { SKILLS_TAB_KIND } from "./constants.js";
import { useToolCloseGuard } from "./closeguard.js";
import { MarkdownView } from "./markdown.js";
import { useDismissLayer } from "./dismiss.js";

/** Group installation sources into the three scopes users choose between. */
export function skillScope(source) {
	return String(source ?? "").startsWith("project") ? "project"
		: String(source ?? "").startsWith("user") ? "user" : "provided";
}

export function SkillsView({ cwd, t, say, visible, sessionId }) {
	const [skills, setSkills] = useState(null);
	const [error, setError] = useState("");
	const [sel, setSel] = useState(null);
	const [content, setContent] = useState("");
	const [savedContent, setSavedContent] = useState("");
	const [busy, setBusy] = useState(false);
	const [listing, setListing] = useState(false);
	const [reading, setReading] = useState(false);
	const [readError, setReadError] = useState("");
	const [confirmDel, setConfirmDel] = useState(false);
	const [newName, setNewName] = useState("");
	const [scope, setScope] = useState("user");
	const [createOpen, setCreateOpen] = useState(false);
	const createRef = useDismissLayer({ open: createOpen, onDismiss: () => setCreateOpen(false), ignoreSelector: '[data-ce-popup-trigger="skill-create"]' });
	const deleteRef = useDismissLayer({ open: confirmDel, onDismiss: () => setConfirmDel(false), ignoreSelector: '[data-ce-popup-trigger="skill-delete"]' });
	useEffect(() => {
		if (visible === false) { setCreateOpen(false); setConfirmDel(false); }
	}, [visible]);
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState("all");
	const [editMode, setEditMode] = useState(false);
	const [rawPreview, setRawPreview] = useState(false);
	const [contentTruncated, setContentTruncated] = useState(false);
	const readSeq = useRef(0);
	const listSeq = useRef(0);
	const readonly = sel !== null && skillScope(sel.source) === "provided";
	const dirty = content !== savedContent;
	useToolCloseGuard({ sessionId, kind: SKILLS_TAB_KIND, dirty, onBlocked: () => say(t("editor.dirtyGuard"), "error") });
	const sourceLabel = (source) => t(`skills.scope.${skillScope(source)}`);

	const load = useCallback(() => {
		const seq = ++listSeq.current;
		setListing(true);
		api("skills.list", { cwd }).then((res) => {
			if (seq !== listSeq.current) return;
			setListing(false);
			if (!res.ok) { setError(res.error); return; }
			setError("");
			setSkills(res.value.skills ?? []);
		});
	}, [cwd]);
	useEffect(() => {
		setSkills(null); setError(""); setSel(null); setContent(""); setSavedContent("");
		setEditMode(false); setReading(false); setReadError(""); setBusy(false);
		load();
		return () => { ++listSeq.current; ++readSeq.current; };
	}, [load]);

	const canLeave = () => {
		if (!dirty) return true;
		say(t("editor.dirtyGuard"), "error");
		return false;
	};
	const open = (skill) => {
		if (!canLeave()) return;
		const seq = ++readSeq.current;
		setSel(skill); setConfirmDel(false); setEditMode(false); setRawPreview(false);
		setContent(""); setSavedContent(""); setContentTruncated(false); setReadError("");
		if (!skill.path) { setReading(false); return; }
		setReading(true);
		api("skills.read", { cwd, path: skill.path }).then((res) => {
			// A slow response for the previous selection must never replace the current skill.
			if (seq !== readSeq.current) return;
			setReading(false);
			if (!res.ok) { setReadError(res.error); return; }
			setContent(res.value.content); setSavedContent(res.value.content);
			setContentTruncated(res.value.truncated === true);
		});
	};
	const save = () => {
		if (!sel || !editMode || readonly || reading || readError || contentTruncated || !dirty || busy) return;
		const seq = readSeq.current;
		setBusy(true);
		api("skills.write", { cwd, path: sel.path, content }).then((res) => {
			if (seq !== readSeq.current) return;
			setBusy(false);
			if (!res.ok) { say(`${t("error")}: ${res.error}`, "error"); return; }
			setSavedContent(content); setEditMode(false);
			say(t("skills.saved")); load();
		});
	};
	const remove = () => {
		if (!sel || readonly || busy || !confirmDel) return;
		const seq = readSeq.current;
		setBusy(true);
		api("skills.delete", { cwd, path: sel.path }).then((res) => {
			if (seq !== readSeq.current) return;
			setBusy(false);
			if (!res.ok) { say(`${t("error")}: ${res.error}`, "error"); return; }
			++readSeq.current;
			setSel(null); setContent(""); setSavedContent(""); setConfirmDel(false);
			say(t("skills.deleted")); load();
		});
	};
	const validName = /^[a-z0-9][a-z0-9._-]{0,63}$/.test(newName.trim());
	const create = () => {
		if (!validName || busy || !canLeave()) return;
		const seq = readSeq.current;
		setBusy(true);
		api("skills.create", { cwd, name: newName.trim(), scope }).then((res) => {
			if (seq !== readSeq.current) return;
			setBusy(false);
			if (!res.ok) { say(`${t("error")}: ${res.error}`, "error"); return; }
			setNewName(""); setCreateOpen(false); setQuery(""); setFilter("all"); load();
			if (res.value.skill) open(res.value.skill);
		});
	};
	const onKeyDown = (event) => {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
			event.preventDefault(); event.stopPropagation(); save();
		}
	};
	const grouped = useMemo(() => {
		const q = query.trim().toLowerCase();
		return ["project", "user", "provided"].map((group) => ({
			source: group,
			items: (skills ?? []).filter((skill) => skillScope(skill.source) === group
				&& (filter === "all" || filter === group)
				&& (!q || [skill.name, skill.description, skill.path, skill.provider].some((s) => String(s ?? "").toLowerCase().includes(q)))),
		})).filter((group) => group.items.length > 0);
	}, [skills, query, filter]);
	const visibleCount = grouped.reduce((sum, group) => sum + group.items.length, 0);
	const back = () => { if (canLeave()) { ++readSeq.current; setReading(false); setSel(null); setReadError(""); } };
	const cancelEdit = () => { setContent(savedContent); setEditMode(false); };

	return h("div", { className: `ce-sk-root${sel ? " ce-sk-has-selection" : ""}` },
		h("header", { className: "ce-sk-top" },
			h("div", { className: "ce-sk-heading" },
				h("h2", null, t("skills.manager")),
				h("span", { className: "ce-sk-total" }, skills === null ? "…" : t("skills.total", { n: skills.length })),
			),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", title: t("skills.refresh"), "aria-label": t("skills.refresh"), disabled: listing || busy, onClick: load }, "⟳"),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", "aria-expanded": createOpen, "data-ce-popup-trigger": "skill-create", disabled: busy, onClick: () => { if (canLeave()) { setConfirmDel(false); setCreateOpen((v) => !v); } } }, `+ ${t("skills.new")}`),
		),
		createOpen ? h("div", { className: "ce-sk-create", ref: createRef },
			h("input", { className: "ce-input ce-sk-name-input", "aria-label": t("skills.createPlaceholder"), placeholder: t("skills.createPlaceholder"), value: newName, disabled: busy, autoFocus: true,
				onChange: (e) => setNewName(e.target.value), onKeyDown: (e) => { e.stopPropagation(); if (e.key === "Enter") create(); if (e.key === "Escape") setCreateOpen(false); } }),
			h("select", { className: "ce-sk-scope", "aria-label": t("skills.scopeTitle"), value: scope, disabled: busy, onChange: (e) => setScope(e.target.value) },
				h("option", { value: "user" }, t("skills.user")), h("option", { value: "project" }, t("skills.project"))),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", disabled: busy || !validName, onClick: create }, busy ? "…" : t("skills.createAction")),
			h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: busy, onClick: () => setCreateOpen(false) }, t("skills.cancel")),
			newName.trim() && !validName ? h("span", { className: "ce-sk-name-hint", role: "status" }, t("skills.nameHint")) : null,
		) : null,
		h("div", { className: "ce-sk-workspace" },
			h("aside", { className: "ce-sk-list", "aria-label": t("skills.title") },
				h("div", { className: "ce-sk-searchbar" },
					h("input", { className: "ce-input", type: "search", "aria-label": t("skills.search"), placeholder: t("skills.search"), value: query, onChange: (e) => setQuery(e.target.value) }),
					h("select", { className: "ce-sk-scope", "aria-label": t("skills.filter"), value: filter, onChange: (e) => setFilter(e.target.value) },
						["all", "project", "user", "provided"].map((id) => h("option", { key: id, value: id }, t(`skills.scope.${id}`)))),
				),
				h("div", { className: "ce-sk-results ce-scroll", "aria-busy": listing },
					error ? h("div", { className: "ce-sk-feedback", role: "alert" }, error) : null,
					skills === null && !error ? h("div", { className: "ce-sk-feedback", role: "status" }, t("loading")) : null,
					skills !== null && visibleCount === 0 ? h("div", { className: "ce-sk-feedback" }, t(skills.length === 0 ? "skills.empty" : "skills.noMatch")) : null,
					grouped.map((group) => h("section", { key: group.source },
						h("h3", { className: "ce-sk-section" }, h("span", null, t(`skills.scope.${group.source}`)), h("span", null, String(group.items.length))),
						group.items.map((skill) => h("button", { key: skill.path || skill.name, type: "button", disabled: busy,
							className: `ce-sk-row${sel && (sel.path ? sel.path === skill.path : sel.name === skill.name) ? " ce-sk-row-on" : ""}`,
							"aria-pressed": Boolean(sel && (sel.path ? sel.path === skill.path : sel.name === skill.name)), onClick: () => open(skill), title: skill.description || skill.name },
							h("span", { className: "ce-sk-row-name" }, skill.name),
							h("span", { className: "ce-sk-row-desc" }, skill.description || t("skills.noDesc")),
						)),
					)),
				),
			),
			h("section", { className: "ce-sk-edit", "aria-label": sel?.name ?? t("skills.pick") },
				!sel ? h("div", { className: "ce-sk-welcome" },
					h(SkillsGlyph), h("h3", null, t("skills.welcome")), h("p", null, t("skills.pick")),
					h("p", { className: "ce-sk-welcome-note" }, t("skills.scopeHint")),
				) : h(Fragment, null,
					h("header", { className: "ce-sk-detail-head" },
						h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost ce-sk-back", onClick: back, disabled: busy }, `← ${t("skills.backList")}`),
						h("h3", { className: "ce-sk-detail-title" }, sel.name),
						h("div", { className: "ce-sk-meta" },
							h("span", null, sourceLabel(sel.source)),
							readonly ? h("span", { className: "ce-chip" }, t("skills.readonly")) : null,
							contentTruncated ? h("span", { className: "ce-chip ce-chip-warn" }, t("skills.truncatedChip")) : null,
							dirty ? h("span", { className: "ce-chip ce-chip-warn" }, t("skills.dirty")) : null,
						),
						h("details", { className: "ce-sk-install-details", key: sel.path || sel.name },
							h("summary", null, t("skills.details")),
						sel.description ? h("p", { className: "ce-sk-detail-desc" }, sel.description) : null,
						sel.dir || sel.path ? h("button", { type: "button", className: "ce-sk-path", title: t("skills.copyPath"), onClick: async () => {
							try { await navigator.clipboard.writeText(sel.dir ?? sel.path); say(t("skills.pathCopied")); }
							catch { say(t("skills.copyFailed"), "error"); }
						} }, sel.dir || sel.path) : null,
						),
					),
					h("div", { className: "ce-sk-detail-tools" },
						editMode ? h("span", { className: "ce-sk-edit-label" }, t("skills.editing")) : h("div", { className: "ce-sk-view-switch" },
							h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${!rawPreview ? " ce-sk-view-on" : ""}`, "aria-pressed": !rawPreview, onClick: () => setRawPreview(false) }, t("skills.preview")),
							h("button", { type: "button", className: `ce-sk-btn ce-sk-btn-ghost${rawPreview ? " ce-sk-view-on" : ""}`, "aria-pressed": rawPreview, onClick: () => setRawPreview(true) }, t("skills.source"))),
						!readonly && !reading && !readError && !contentTruncated ? (editMode ? h(Fragment, null,
							h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: busy, onClick: cancelEdit }, t("editor.cancel")),
							h("button", { type: "button", className: "ce-sk-btn ce-sk-primary", disabled: !dirty || busy, title: "⌘S / Ctrl+S", onClick: save }, t("editor.save")),
						) : h("button", { type: "button", className: "ce-sk-btn", disabled: busy, onClick: () => setEditMode(true) }, t("editor.edit"))) : null,
						!readonly && !editMode ? h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: busy, "data-ce-popup-trigger": "skill-delete", "aria-expanded": confirmDel, onClick: () => { setCreateOpen(false); setConfirmDel((v) => !v); } }, t("skills.delete")) : null,
					),
					confirmDel ? h("div", { className: "ce-sk-delete-confirm", ref: deleteRef, role: "alert" },
						h("span", null, t("skills.deleteQuestion", { name: sel.name })),
						h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-danger", disabled: busy, onClick: remove }, t("skills.deleteConfirm")),
						h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", disabled: busy, onClick: () => setConfirmDel(false) }, t("skills.cancel"))) : null,
					reading ? h("div", { className: "ce-sk-feedback", role: "status" }, t("loading"))
						: readError ? h("div", { className: "ce-sk-feedback", role: "alert" }, readError,
							h("button", { type: "button", className: "ce-sk-btn", onClick: () => open(sel) }, t("skills.retry")))
						: editMode ? h("textarea", { className: "ce-sk-ta", "aria-label": sel.name, value: content, disabled: busy, spellcheck: false, onChange: (e) => setContent(e.target.value), onKeyDown })
						: rawPreview ? h("pre", { className: "ce-sk-source ce-scroll" }, content)
						: h(MarkdownView, { text: content }),
				),
			),
		),
	);
}

/* ---------------- standalone sidebar tab wrappers ---------------- */

const SkillsGlyph = () => h("svg", { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } },
	h("path", { d: "M8 2 3 4.5v7L8 14l5-2.5v-7L8 2Z" }),
	h("path", { d: "M8 2v12M3 4.5 8 7l5-2.5" }),
);

/** Body of the top-level "Skills" sidebar tab: resolves the session cwd itself. */
export function SkillsTabBody({ sessionId, useSessions, useTabInfo, t }) {
	const hostTab = useTabInfo ? useTabInfo()?.tab : null;
	const cwd = useSessions ? useSessions((sessions) => (sessionId ? sessions.byId[sessionId]?.cwd : void 0)) : void 0;
	const [note, setNote] = useState(null);
	const timerRef = useRef(null);
	const say = useCallback((text, kind = "info") => {
		setNote({ text, kind });
		if (timerRef.current) clearTimeout(timerRef.current);
		if (kind !== "error") timerRef.current = setTimeout(() => setNote({ text: "", kind: "info" }), 3800);
	}, []);
	if (!cwd) return h("div", { className: "ce-root" }, h("div", { className: "ce-empty" }, t("editor.noSession")));
	return h("div", { className: "ce-root" },
		note && note.text ? h("div", { className: "ce-banner" }, h("span", { className: "ce-banner-text" }, note.text)) : null,
		h(SkillsView, { cwd, t, say, sessionId, visible: hostTab?.visible }),
	);
}

export function SkillsTitle({ useTabInfo }) {
	const tabInfo = useTabInfo ? useTabInfo() : null;
	return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(SkillsGlyph)), tabInfo?.tab?.title ?? "Skills");
}
