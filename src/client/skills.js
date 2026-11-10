/* ---------------- skills manager: list / view / edit / create / delete ---------------- */

import { Fragment, h, useCallback, useEffect, useMemo, useRef, useState } from "./react.js";
import { api } from "./api.js";
import { MarkdownView } from "./markdown.js";

const SOURCE_ORDER = ["project-dsh", "project-agents", "user-dsh", "user-agents", "bundled", "other"];

export function SkillsView({ cwd, t, say }) {
	const [skills, setSkills] = useState(null);
	const [error, setError] = useState("");
	const [sel, setSel] = useState(null);
	const [content, setContent] = useState("");
	const [savedContent, setSavedContent] = useState("");
	const [busy, setBusy] = useState(false);
	const [confirmDel, setConfirmDel] = useState(false);
	const [newName, setNewName] = useState("");
	const [scope, setScope] = useState("user");
	const [editMode, setEditMode] = useState(false);
	const readonly = sel !== null && (sel.source === "bundled" || sel.source === "other");
	const dirty = content !== savedContent;

	const load = useCallback(() => {
		setBusy(true);
		api("skills.list", { cwd }).then((res) => {
			setBusy(false);
			if (!res.ok) {
				setError(res.error);
				setSkills([]);
				return;
			}
			setError("");
			setSkills(res.value.skills ?? []);
		});
	}, [cwd]);
	useEffect(() => {
		load();
	}, [load]);

	const open = useCallback((skill) => {
		setSel(skill);
		setConfirmDel(false);
		setEditMode(false);
		if (!skill.path) {
			setContent("");
			setSavedContent("");
			return;
		}
		api("skills.read", { cwd, path: skill.path }).then((res) => {
			if (!res.ok) {
				say(`${t("error")}: ${res.error}`, "error");
				return;
			}
			setContent(res.value.content);
			setSavedContent(res.value.content);
		});
	}, [cwd, say, t]);

	const save = useCallback(() => {
		if (!sel || !dirty) return;
		setBusy(true);
		api("skills.write", { cwd, path: sel.path, content }).then((res) => {
			setBusy(false);
			if (!res.ok) {
				say(`${t("error")}: ${res.error}`, "error");
				return;
			}
			setSavedContent(content);
			setEditMode(false);
			say(t("skills.saved"));
			load();
		});
	}, [sel, dirty, content, cwd, say, t, load]);

	const remove = useCallback(() => {
		if (!sel) return;
		setBusy(true);
		api("skills.delete", { cwd, path: sel.path }).then((res) => {
			setBusy(false);
			if (!res.ok) {
				say(`${t("error")}: ${res.error}`, "error");
				return;
			}
			setSel(null);
			setContent("");
			setSavedContent("");
			say(t("skills.deleted"));
			load();
		});
	}, [sel, cwd, say, t, load]);

	const create = useCallback(() => {
		const name = newName.trim();
		if (!name) return;
		setBusy(true);
		api("skills.create", { cwd, name, scope }).then((res) => {
			setBusy(false);
			if (!res.ok) {
				say(`${t("error")}: ${res.error}`, "error");
				return;
			}
			setNewName("");
			load();
			if (res.value.skill) open(res.value.skill);
		});
	}, [newName, cwd, scope, say, t, load, open]);

	const onKeyDown = useCallback((event) => {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
			event.preventDefault();
			save();
		}
	}, [save]);

	const grouped = useMemo(() => {
		const groups = [];
		for (const source of SOURCE_ORDER) {
			const items = (skills ?? []).filter((s) => s.source === source);
			if (items.length > 0) groups.push({ source, items });
		}
		return groups;
	}, [skills]);
	const sourceLabel = (source) => (source.startsWith("project")
		? t("skills.project")
		: source === "bundled" ? t("skills.bundled")
		: source === "other" ? t("skills.other")
		: t("skills.user"));

	return h("div", { className: "ce-sk-root" },
		h("div", { className: "ce-sk-list ce-scroll" },
			h("div", { className: "ce-sk-head2" },
				h("span", { className: "ce-sk-title" }, t("skills.title")),
				skills ? h("span", { className: "ce-chip" }, String(skills.length)) : null,
				h("span", { className: "ce-spacer" }),
				h("button", { type: "button", className: "ce-tool ce-tiny", title: t("skills.refresh"), onClick: load }, "⟳"),
			),
			h("div", { className: "ce-sk-create" },
				h("input", {
					className: "ce-input ce-sk-name-input",
					placeholder: t("skills.createPlaceholder"),
					value: newName,
					onChange: (e) => setNewName(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") create();
					},
				}),
				h("select", { className: "ce-sk-scope", value: scope, onChange: (e) => setScope(e.target.value), title: t("skills.scopeTitle") },
					h("option", { value: "user" }, t("skills.user")),
					h("option", { value: "project" }, t("skills.project")),
				),
				h("button", { type: "button", className: "ce-tool ce-tiny", title: t("skills.new"), disabled: busy || newName.trim() === "", onClick: create }, "+"),
			),
			error ? h("div", { className: "ce-note" }, error) : null,
			skills === null ? h("div", { className: "ce-note" }, "…") : null,
			skills !== null && skills.length === 0 ? h("div", { className: "ce-empty" }, t("skills.empty")) : null,
			grouped.map((group) => h("div", { key: group.source },
				h("div", { className: "ce-sk-section" }, `${sourceLabel(group.source)} · ${group.items.length}`),
				group.items.map((skill) => h("button", {
					key: skill.path || skill.name,
					type: "button",
					className: `ce-sk-row${sel && sel.name === skill.name ? " ce-sk-row-on" : ""}`,
					onClick: () => open(skill),
					title: skill.provider ? `${skill.path || skill.name} · ${skill.provider}` : skill.path,
				},
				h("span", { className: "ce-sk-row-name" }, skill.name),
				h("span", { className: "ce-sk-row-desc" }, skill.description || t("skills.noDesc")),
				)),
			)),
		),
		h("div", { className: "ce-sk-edit" },
			!sel
				? h("div", { className: "ce-empty" }, t("skills.pick"))
				: h(
					Fragment,
					null,
					h("div", { className: "ce-head" },
						h("span", { className: "ce-head-path", title: sel.path }, sel.name),
						h("span", { className: "ce-chip" }, sel.source),
						readonly ? h("span", { className: "ce-chip ce-chip-warn" }, t("skills.readonly")) : null,
						sel.dir || sel.path ? h("button", {
							type: "button",
							className: "ce-sk-path",
							title: `${sel.dir ?? sel.path} · ${t("skills.copyPath")}`,
							onClick: () => {
								try {
									void navigator.clipboard?.writeText(sel.dir ?? sel.path);
									say(t("skills.pathCopied"));
								} catch { /* clipboard unavailable */ }
							},
						}, sel.dir || sel.path) : null,
						dirty ? h("span", { className: "ce-chip ce-chip-warn" }, t("skills.dirty")) : null,
						h("span", { className: "ce-spacer" }),
						readonly
							? null
							: editMode
								? h(Fragment, null,
									h("button", { type: "button", className: "ce-sk-btn", disabled: !dirty || busy, title: "⌘S / Ctrl+S", onClick: save }, t("editor.save")),
									h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", onClick: () => { setContent(savedContent); setEditMode(false); } }, t("editor.cancel")),
								)
								: h("button", { type: "button", className: "ce-sk-btn", onClick: () => setEditMode(true) }, t("editor.edit")),
						readonly
							? null
							: confirmDel
							? h(Fragment, null,
								h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-danger", disabled: busy, onClick: remove }, t("skills.deleteConfirm")),
								h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", onClick: () => setConfirmDel(false) }, t("skills.cancel")),
							)
							: h("button", { type: "button", className: "ce-sk-btn ce-sk-btn-ghost", onClick: () => setConfirmDel(true) }, t("skills.delete")),
						h("button", {
							type: "button",
							className: "ce-sk-btn",
							disabled: !dirty || busy,
							title: "⌘S / Ctrl+S",
							onClick: save,
						}, t("skills.save")),
					),
					h("textarea", {
						className: "ce-sk-ta",
						style: { display: editMode ? void 0 : "none" },
						value: content,
						spellcheck: false,
						onChange: (e) => setContent(e.target.value),
						onKeyDown,
					}),
					editMode ? null : h(MarkdownView, { text: content }),
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
export function SkillsTabBody({ sessionId, useSessions, t }) {
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
		h(SkillsView, { cwd, t, say }),
	);
}

export function SkillsTitle({ useTabInfo }) {
	const tabInfo = useTabInfo ? useTabInfo() : null;
	return h(Fragment, null, h("span", { className: "ce-title-ico" }, h(SkillsGlyph)), tabInfo?.tab?.title ?? "Skills");
}
