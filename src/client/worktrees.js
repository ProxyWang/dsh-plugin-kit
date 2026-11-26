/* Branch conversations: a workspace context-menu entry that starts a new
 * conversation in its own Git worktree, plus the management dialog for the
 * checkouts created under `<repo>/.agents/worktrees/`.
 *
 * One branch is one ref, but a checkout owns HEAD and the index — so "a
 * conversation per branch" means a checkout per conversation. The Host creates
 * it; here we ask for it, then register the new directory as a Workspace (the
 * sidebar groups Sessions by their header cwd, so a separate directory is a
 * separate group) and open a blank Session there. Every panel already reads the
 * Session's cwd, so nothing else needs to know about worktrees.
 *
 * The dialogs are plain DOM on purpose: the client bundle resolves only
 * `react`, so there is no portal to borrow, and the menu action runs outside
 * any slot. Branch picking is a filtered list rather than a native <select>: a
 * repository carries hundreds of branches, and prefix-only jumping is not good
 * enough.
 */

import { h } from "./react.js";
import { api } from "./api.js";

/** Icon key shared by the menu actions and their `contextMenu.icon` registration. */
const ICON_KEY = "kit.worktree";

/** Same shape the Host enforces, so the dialog can name the problem early. */
const BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9._-]+)*$/;

/**
 * Validation shared with the Host: branch names never start with a dash or a
 * dot and never contain `..` (both read as an option or a traversal in Git).
 * @param name - candidate branch name.
 * @returns "" when usable, `needs-name` or `invalid` otherwise.
 */
export function worktreeNameError(name) {
	const value = String(name ?? "").trim();
	if (value === "") return "needs-name";
	if (value.startsWith("-") || value.startsWith(".") || value.includes("..")) return "invalid";
	return BRANCH_RE.test(value) ? "" : "invalid";
}

/**
 * Rank a branch against a typed query: case-insensitive subsequence match, so
 * `fads` finds `feat/ads-…` and `rel23` finds `release/2.3`. Word boundaries
 * (start, `/`, `-`, `_`, `.`) and contiguous runs score higher, so an exact
 * prefix always wins over a scattered match.
 *
 * @param query - what the operator typed; empty matches everything equally.
 * @param name - branch name (or any label).
 * @returns a score (higher is better), or null when the query is not a subsequence.
 */
export function branchScore(query, name) {
	const needle = String(query ?? "").trim().toLowerCase();
	const haystack = String(name ?? "").toLowerCase();
	if (needle === "") return 0;
	let index = 0;
	let last = -1;
	let score = 0;
	for (let i = 0; i < haystack.length && index < needle.length; i += 1) {
		if (haystack[i] !== needle[index]) continue;
		let bonus = 1;
		if (index === 0) bonus += 3;
		if (i === 0) bonus += 6;
		if (i > 0 && "/-_.".includes(haystack[i - 1])) bonus += 4;
		if (last >= 0 && i === last + 1) bonus += 2;
		score += bonus;
		last = i;
		index += 1;
	}
	if (index !== needle.length) return null;
	// Shorter names break ties: `master` before `master-backup` for query `master`.
	return score - haystack.length * 0.01;
}

/**
 * Human label for a repository root inside a workspace: the relative tail when
 * nested, the absolute path otherwise (a multi-repo workspace usually is the
 * parent of both).
 * @param cwd - workspace directory.
 * @param root - repository root.
 * @returns short display text.
 */
export function repoLabel(cwd, root) {
	const base = String(cwd ?? "");
	const value = String(root ?? "");
	if (base !== "" && value.startsWith(`${base}/`)) return value.slice(base.length + 1);
	return value;
}

/** Tail of a path below its repository root, or the path itself. */
function pathLabel(root, path) {
	const base = String(root ?? "");
	const value = String(path ?? "");
	return base !== "" && value.startsWith(`${base}/`) ? value.slice(base.length + 1) : value;
}

/**
 * Whether this Host annotates merged branches — the marker shipped together
 * with the remote-branch checkout support, so an unannotated response means the
 * Host half is older than the page and must be reloaded once.
 * @param branches - rows from `git.branches` requested with `annotateMerged`.
 * @returns true when the Host answered with the newer branch shape.
 */
export function hostAnnotatesMerged(branches) {
	return Array.isArray(branches) && branches.length > 0 && branches.some((branch) => Object.hasOwn(branch, "merged"));
}

/**
 * Rows for the branch picker: local branches first, then branches that exist
 * only on a remote (checking one out creates the local branch at its tip).
 * Locals already merged into the repository's shared base are hidden unless the
 * caller asks for them — a merged branch is rarely what a new conversation
 * needs, but it stays reachable for inspection.
 *
 * @param branches - rows from `git.branches` (`annotateMerged` on).
 * @param options - occupied map (branch -> checkout path), merged visibility, locals only.
 * @returns picker rows `{name, current, merged, remoteRef, occupied, occupiedPath}`.
 */
export function branchPickerRows(branches, { occupied = new Map(), showMerged = false, onlyLocal = false } = {}) {
	const rows = [];
	const locals = new Set();
	for (const branch of branches) {
		if (branch.remote === true) continue;
		locals.add(branch.name);
		if (!showMerged && branch.merged === true && branch.current !== true) continue;
		rows.push({
			name: branch.name,
			current: branch.current === true,
			merged: branch.merged === true,
			remoteRef: "",
			occupied: occupied.has(branch.name),
			occupiedPath: occupied.get(branch.name) ?? "",
		});
	}
	if (onlyLocal) return rows;
	const seen = new Set();
	for (const branch of branches) {
		if (branch.remote !== true) continue;
		const short = branch.name.slice(branch.name.indexOf("/") + 1);
		if (short === "" || short === "HEAD" || locals.has(short) || seen.has(short)) continue;
		seen.add(short);
		rows.push({
			name: short,
			current: false,
			merged: false,
			remoteRef: branch.name,
			occupied: occupied.has(short),
			occupiedPath: occupied.get(short) ?? "",
		});
	}
	return rows;
}

/**
 * Where a Workspace created for a checkout belongs in the sidebar: directly
 * under the Workspace it was started from, so generated rows group with their
 * repository instead of jumping to the top (the registry prepends new records).
 *
 * @param items - current Workspace rows in display order.
 * @param sourceId - the Workspace the branch conversation was started from.
 * @param newId - the Workspace that was just created.
 * @returns `{before}` (undefined means "append last"), or null when the source
 *   is not in the list and the order must be left alone.
 */
export function placementBefore(items, sourceId, newId) {
	const rows = Array.isArray(items) ? items : [];
	const index = rows.findIndex((row) => String(row?.workspaceId ?? "") === String(sourceId ?? ""));
	if (index < 0) return null;
	const successor = rows.slice(index + 1).find((row) => String(row?.workspaceId ?? "") !== String(newId ?? ""));
	return { before: successor?.workspaceId };
}

/**
 * Workspace title for a branch conversation: `<repository>-<branch>`, matching
 * what the directory is called on disk for branches without separators
 * (`vas` + `release_vip_uat` → `vas-release_vip_uat`). The branch keeps its
 * slashes in the title so the row still reads like a branch name.
 *
 * @param repoRoot - main checkout path of the repository.
 * @param branch - branch name.
 * @returns the sidebar title (branch alone when the repository name is unknown).
 */
export function checkoutTitle(repoRoot, branch) {
	const repo = String(repoRoot ?? "").split(/[\\/]/).filter(Boolean).pop() ?? "";
	const name = String(branch ?? "").trim();
	// Same slug the Host puts in the directory name, so row and directory match.
	const slug = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "").replace(/[-.]+$/, "").slice(0, 80);
	if (repo === "") return slug === "" ? name : slug;
	return slug === "" ? repo : `${repo}-${slug}`;
}

/** Optional client service; absent services must degrade instead of throwing. */
function service(ctx, name) {
	try {
		return typeof ctx.get === "function" ? ctx.get(name) : undefined;
	} catch {
		return undefined;
	}
}

function el(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

/** Branch icon for the context menu (the Host menu renders it 16–18px). */
function WorktreeIcon({ size = 16 }) {
	return h(
		"svg",
		{ viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.7, "aria-hidden": true },
		h("circle", { cx: 6, cy: 5, r: 2.1 }),
		h("circle", { cx: 6, cy: 19, r: 2.1 }),
		h("circle", { cx: 18, cy: 12, r: 2.1 }),
		h("path", { d: "M6 7.1v9.8M8.1 5h4.4a3 3 0 0 1 3 3v1.9M8.1 19h4.4a3 3 0 0 0 3-3v-1.9" }),
	);
}

/**
 * Add "New conversation on a branch…" and "Manage worktrees…" to the workspace
 * menu, for workspaces that are a Git checkout or contain one.
 *
 * @param ctx - client context with `contextMenus` (and `slots` for the icon).
 * @param t - locale translator bound to this plugin's namespace.
 * @returns disposer removing both registrations.
 */
export function installBranchConversations(ctx, t) {
	const stopIcon = ctx.slots.inject("contextMenu.icon", () => ctx.slots.register({ name: "contextMenu.icon", key: ICON_KEY }, WorktreeIcon));
	const stopMenu = ctx.contextMenus.register({
		id: "kit.branch-conversation",
		target: "workspace",
		order: 150,
		resolve: async (target) => {
			const cwd = String(target?.path ?? "");
			const sourceWorkspaceId = String(target?.workspaceId ?? "");
			if (cwd === "") return [];
			// The menu aborts an async provider after one second, so this probe is a
			// directory scan (`git.repos`), never a `git status` on a large repository.
			let probe;
			try {
				probe = await api("git.repos", { cwd });
			} catch {
				return [];
			}
			if (!probe.ok) return [];
			const value = probe.value ?? {};
			// A Workspace record can point at a directory that was renamed or moved
			// away; say so instead of leaving the menu silent.
			if (value.missing === true) {
				return [{ id: "missing-directory", label: t("worktree.missingDir", { path: cwd }), disabled: true }];
			}
			// The workspace itself, or the repositories discovered below it — a
			// monorepo parent is a perfectly good place to start one.
			const repos = value.repo === true
				? [""]
				: Array.isArray(value.repos) ? value.repos.map((root) => String(root ?? "")).filter((root) => root !== "") : [];
			if (repos.length === 0) return [];
			return [
				{
					id: "branch-conversation",
					label: t("worktree.menu"),
					icon: { key: ICON_KEY },
					run: () => { void openBranchDialog(ctx, t, { cwd, repos, sourceWorkspaceId }); },
				},
				{
					id: "manage-worktrees",
					label: t("worktree.manageMenu"),
					icon: { key: ICON_KEY },
					run: () => { void openManageDialog(ctx, t, { cwd, repos }); },
				},
			];
		},
	});
	return () => {
		stopMenu();
		if (typeof stopIcon === "function") stopIcon();
	};
}

/**
 * Modal shell shared by both dialogs: overlay, card, error and status lines.
 * Esc and a backdrop click close it; each dialog adds its own actions.
 */
function createFrame(t, ariaLabel) {
	const overlay = el("div", "ce-root ce-wt-overlay");
	const card = el("div", "ce-wt-card");
	card.setAttribute("role", "dialog");
	card.setAttribute("aria-modal", "true");
	card.setAttribute("aria-label", ariaLabel);
	const head = el("div", "ce-wt-head");
	const title = el("div", "ce-wt-title", ariaLabel);
	const close = el("button", "ce-wt-close", "×");
	close.type = "button";
	close.setAttribute("aria-label", t("worktree.cancel"));
	head.append(title, close);
	const body = el("div", "ce-wt-body");
	const errorLine = el("div", "ce-wt-error");
	errorLine.hidden = true;
	const status = el("div", "ce-wt-status");
	status.hidden = true;
	const foot = el("div", "ce-wt-foot");
	card.append(head, body, errorLine, status, foot);
	overlay.append(card);
	let closed = false;
	const closeDialog = () => {
		if (closed) return;
		closed = true;
		document.removeEventListener("keydown", onKey, true);
		overlay.remove();
	};
	const onKey = (event) => {
		if (event.key === "Escape") {
			event.stopPropagation();
			closeDialog();
		}
	};
	document.addEventListener("keydown", onKey, true);
	overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeDialog(); });
	close.addEventListener("click", closeDialog);
	document.body.append(overlay);
	return {
		body,
		foot,
		card,
		close,
		closeDialog,
		isClosed: () => closed,
		setError: (text) => {
			errorLine.textContent = text ?? "";
			errorLine.hidden = !text;
		},
		setStatus: (text) => {
			status.textContent = text ?? "";
			status.hidden = !text;
		},
	};
}

/**
 * Searchable list: input + ranked rows, arrow keys to move, the active
 * (non-occupied) row is the value. Occupied branches stay visible with their
 * checkout path so the refusal is explained before creating anything.
 */
function createPicker(t, placeholder, onChange, emptyHint = "", onReuse = null) {
	/** Rows drawn at once; a big repository has thousands of branches. */
	const MAX_RENDERED = 300;
	const wrap = el("div", "ce-wt-picker");
	const input = el("input", "ce-wt-input ce-wt-search");
	input.type = "text";
	input.placeholder = placeholder;
	input.autocomplete = "off";
	input.spellcheck = false;
	const list = el("div", "ce-wt-list");
	list.setAttribute("role", "listbox");
	wrap.append(input, list);
	const state = { rows: [], filtered: [], active: 0, disabled: false };

	const render = () => {
		list.replaceChildren();
		if (state.filtered.length === 0) {
			list.append(el("div", "ce-wt-empty", t(state.rows.length === 0 ? "worktree.noLocal" : "worktree.empty")));
			if (state.rows.length > 0 && emptyHint !== "") list.append(el("div", "ce-wt-more", emptyHint));
			return;
		}
		const shown = state.filtered.slice(0, MAX_RENDERED);
		for (const [index, row] of shown.entries()) {
			const option = el("div", row.occupied ? "ce-wt-option is-occupied" : "ce-wt-option");
			option.append(el("span", "ce-wt-option-name", row.label ?? row.name));
			const note = row.occupied
				? t("worktree.occupiedNote", { path: row.occupiedPath })
				: row.remoteRef !== "" ? t("worktree.remoteNote", { ref: row.remoteRef })
					: row.merged === true ? t("worktree.mergedNote") : "";
			if (note !== "") option.append(el("span", "ce-wt-option-note", note));
			// An occupied branch is not a dead end: its checkout still exists (or
			// the branch could not be listed), so offer to open a conversation in
			// that directory instead of forcing a Git command by hand.
			if (row.occupied && typeof onReuse === "function") {
				const reuse = el("button", "ce-wt-option-open", t("worktree.openCheckout"));
				reuse.type = "button";
				reuse.title = row.occupiedPath;
				reuse.addEventListener("mousedown", (event) => event.stopPropagation());
				reuse.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); onReuse(row); });
				option.append(reuse);
			}
			option.setAttribute("role", "option");
			if (row.occupied) option.setAttribute("aria-disabled", "true");
			option.classList.toggle("is-active", index === state.active);
			option.addEventListener("mousedown", (event) => {
				event.preventDefault();
				if (state.disabled || row.occupied) return;
				state.active = index;
				render();
				onChange?.(row.name);
			});
			list.append(option);
		}
		if (state.filtered.length > shown.length) {
			list.append(el("div", "ce-wt-more", t("worktree.moreRows", { n: state.filtered.length - shown.length })));
		}
		const active = list.querySelector(".ce-wt-option.is-active");
		active?.scrollIntoView?.({ block: "nearest" });
	};
	const filter = () => {
		const query = input.value;
		const scored = [];
		for (const row of state.rows) {
			const score = branchScore(query, row.label ?? row.name);
			if (score === null) continue;
			scored.push({ row, score });
		}
		if (String(query).trim() !== "") scored.sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name));
		state.filtered = scored.map((entry) => entry.row);
		const free = state.filtered.findIndex((row) => !row.occupied);
		state.active = free < 0 ? 0 : free;
		render();
	};

	input.addEventListener("input", filter);
	input.addEventListener("keydown", (event) => {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		event.preventDefault();
		if (state.filtered.length === 0) return;
		const delta = event.key === "ArrowDown" ? 1 : -1;
		let next = state.active;
		for (let step = 0; step < state.filtered.length; step += 1) {
			next = (next + delta + state.filtered.length) % state.filtered.length;
			if (!state.filtered[next].occupied) break;
		}
		state.active = next;
		render();
		onChange?.(state.filtered[next].name);
	});

	return {
		element: wrap,
		setRows: (rows, preferred = "") => {
			state.rows = rows;
			filter();
			if (preferred === "") return;
			const index = state.filtered.findIndex((row) => row.name === preferred && !row.occupied);
			if (index < 0) return;
			state.active = index;
			render();
		},
		value: () => {
			const row = state.filtered[state.active];
			return row !== undefined && !row.occupied ? row.name : "";
		},
		selected: () => {
			const row = state.filtered[state.active];
			return row !== undefined && !row.occupied ? row : null;
		},
		/** The highlighted row even when it is occupied (its checkout is usable). */
		activeRow: () => state.filtered[state.active] ?? null,
		setDisabled: (disabled) => {
			state.disabled = disabled;
			input.disabled = disabled;
		},
		focus: () => input.focus({ preventScroll: true }),
	};
}

/**
 * Repository selector for a workspace that holds more than one checkout.
 * @returns `{element, value, onChange}`; `element` is null for a single repository.
 */
function createRepoField(t, cwd, repos) {
	if (repos.length <= 1) return { element: null, value: () => repos[0] ?? "", onChange: () => {} };
	const listeners = [];
	const field = el("div", "ce-wt-field");
	field.append(el("span", "ce-wt-label", t("worktree.repo")));
	const picker = createPicker(t, t("worktree.search"), (value) => {
		for (const listener of listeners) listener(value);
	});
	picker.setRows(repos.map((root) => ({ name: root, label: repoLabel(cwd, root), occupied: false, occupiedPath: "" })), repos[0]);
	field.append(picker.element);
	return {
		element: field,
		value: () => picker.value() || repos[0] || "",
		onChange: (listener) => { listeners.push(listener); },
	};
}

/**
 * Ask for a branch (new or existing), create its checkout, then open a blank
 * conversation in a Workspace pointing at it.
 *
 * @param ctx - client context; `workspaces`, `sessions`, `uiWorkspace` are used when present.
 * @param t - locale translator.
 * @param target - `{cwd, repos}` from the workspace menu (`repos` may be `[""]`).
 */
export async function openBranchDialog(ctx, t, target) {
	if (typeof document === "undefined") return;
	const cwd = String(target?.cwd ?? "");
	const repos = Array.isArray(target?.repos) && target.repos.length > 0 ? target.repos : [""];
	const sourceWorkspaceId = String(target?.sourceWorkspaceId ?? "");
	const frame = createFrame(t, t("worktree.title"));
	const { body, foot, setError, setStatus } = frame;

	const repoField = createRepoField(t, cwd, repos);
	if (repoField.element !== null) body.append(repoField.element);

	const modes = el("div", "ce-wt-modes");
	const modeExisting = el("button", "ce-wt-mode", t("worktree.modeExisting"));
	const modeNew = el("button", "ce-wt-mode", t("worktree.modeNew"));
	modeExisting.type = "button";
	modeNew.type = "button";
	modes.append(modeExisting, modeNew);

	const existingField = el("div", "ce-wt-field");
	const existingHead = el("div", "ce-wt-field-head");
	existingHead.append(el("span", "ce-wt-label", t("worktree.existing")));
	const fetchButton = el("button", "ce-wt-link", t("worktree.fetch"));
	fetchButton.type = "button";
	existingHead.append(fetchButton);
	const existingPicker = createPicker(t, t("worktree.search"), undefined, t("worktree.tryFetch"), (row) => { void reuseCheckout(row); });
	existingField.append(existingHead, existingPicker.element);
	const mergedRow = el("label", "ce-wt-check");
	const mergedToggle = el("input");
	mergedToggle.type = "checkbox";
	mergedRow.append(mergedToggle, el("span", "", t("worktree.showMerged")));
	existingField.append(mergedRow);

	const nameField = el("label", "ce-wt-field");
	nameField.append(el("span", "ce-wt-label", t("worktree.branchName")));
	const nameInput = el("input", "ce-wt-input");
	nameInput.type = "text";
	nameInput.placeholder = t("worktree.placeholder");
	nameInput.autocomplete = "off";
	nameInput.spellcheck = false;
	nameField.append(nameInput);

	const baseField = el("div", "ce-wt-field");
	baseField.append(el("span", "ce-wt-label", t("worktree.base")));
	const basePicker = createPicker(t, t("worktree.search"));
	baseField.append(basePicker.element);

	const hint = el("div", "ce-wt-hint", t("worktree.poolHint"));
	const hostNote = el("div", "ce-wt-note", t("worktree.hostOld"));
	hostNote.hidden = true;
	body.append(modes, existingField, nameField, baseField, hint, hostNote);

	const cancel = el("button", "ce-wt-btn", t("worktree.cancel"));
	const create = el("button", "ce-wt-btn ce-wt-primary", t("worktree.create"));
	cancel.type = "button";
	create.type = "button";
	foot.append(cancel, create);

	// Which repository this dialog acts on: a multi-repo workspace picks one, and
	// even a single repository is worth naming so the branch list is unambiguous.
	const subLine = el("div", "ce-wt-sub", cwd);
	body.prepend(subLine);

	const state = { mode: "existing", busy: false, branches: [], occupied: new Map(), showMerged: false, root: "", hostStale: false };
	const repo = () => repoField.value();

	const setBusy = (busy) => {
		state.busy = busy;
		create.disabled = busy;
		cancel.disabled = busy;
		modeExisting.disabled = busy;
		modeNew.disabled = busy;
		nameInput.disabled = busy;
		existingPicker.setDisabled(busy);
		basePicker.setDisabled(busy);
		create.textContent = busy ? t("worktree.creating") : t("worktree.create");
	};
	const paint = () => {
		modeExisting.classList.toggle("is-active", state.mode === "existing");
		modeNew.classList.toggle("is-active", state.mode === "new");
		existingField.hidden = state.mode !== "existing";
		nameField.hidden = state.mode !== "new";
		baseField.hidden = state.mode !== "new";
	};

	const fillBranches = () => {
		const rows = branchPickerRows(state.branches, { occupied: state.occupied, showMerged: state.showMerged });
		const baseRows = branchPickerRows(state.branches, { onlyLocal: true, showMerged: true });
		existingPicker.setRows(rows);
		// A new branch needs a start point; default to the checked-out one.
		const current = baseRows.find((row) => row.current)?.name ?? "";
		basePicker.setRows(baseRows.map((row) => ({ ...row, occupied: false, occupiedPath: "" })), current);
		if (rows.length > 0 && rows.every((row) => row.occupied)) state.mode = "new";
		// The "merged" switch and remote-branch checkout share one Host release;
		// an older Host gets the control hidden and a visible note instead of a
		// confusing Git error later.
		state.hostStale = state.branches.length > 0 && !hostAnnotatesMerged(state.branches);
		mergedRow.hidden = state.hostStale;
		hostNote.hidden = !state.hostStale;
		if (state.branches.filter((branch) => !branch.remote).length === 0) setError(t("worktree.noLocal"));
		paint();
	};

	const load = async () => {
		setError("");
		setStatus(t("worktree.loading"));
		state.branches = [];
		state.occupied = new Map();
		const hint = repo() === "" ? { cwd } : { cwd, repo: repo() };
		const [branches, worktrees] = await Promise.all([
			api("git.branches", { ...hint, annotateMerged: true }),
			api("git.worktrees", hint),
		]);
		setStatus("");
		if (!branches.ok) {
			setError(t("worktree.fail", { msg: branches.error ?? "?" }));
			return;
		}
		state.branches = Array.isArray(branches.value?.branches) ? branches.value.branches : [];
		if (worktrees.ok) {
			state.root = String(worktrees.value?.main ?? worktrees.value?.root ?? "");
			for (const row of Array.isArray(worktrees.value?.worktrees) ? worktrees.value.worktrees : []) {
				if (typeof row.branch === "string" && row.branch !== "") state.occupied.set(row.branch, row.path);
			}
		}
		subLine.textContent = t("worktree.inRepo", { repo: state.root === "" ? cwd : repoLabel(cwd, state.root) });
		fillBranches();
	};

	/**
	 * Open a conversation in a checkout directory: adopt it as a Workspace
	 * (idempotent by path), title it with the branch, and start a blank Session.
	 * Used both for a freshly created checkout and for a branch that is already
	 * checked out somewhere.
	 */
	const enterCheckout = async (path, branch) => {
		const workspaces = service(ctx, "workspaces");
		const sessions = service(ctx, "sessions");
		if (typeof workspaces?.create !== "function" || typeof sessions?.create !== "function") {
			throw new Error(t("worktree.noServices"));
		}
		const rows = typeof workspaces.list?.getSnapshot === "function" ? workspaces.list.getSnapshot()?.items : undefined;
		const existed = Array.isArray(rows) && rows.some((row) => row.path === path);
		const view = await workspaces.create({ path });
		const workspaceId = view?.workspaceId;
		if (workspaceId === undefined) throw new Error(t("worktree.noServices"));
		// The row reads `<repository>-<branch>`, matching the directory on disk.
		try { await workspaces.rename?.(workspaceId, checkoutTitle(state.root, branch)); } catch { /* title is cosmetic */ }
		// A brand-new record is prepended by the registry; move it back under the
		// Workspace this conversation was started from. An existing record keeps
		// whatever order the operator gave it.
		if (!existed) {
			const placement = placementBefore(rows, sourceWorkspaceId, workspaceId);
			if (placement !== null) {
				try { await workspaces.insertBefore?.(workspaceId, placement.before); } catch { /* order is cosmetic */ }
			}
		}
		const sessionId = await sessions.create({ workspaceId });
		try { service(ctx, "uiWorkspace")?.openSession?.(sessionId); } catch { /* the row is still there to click */ }
	};

	/** Open the checkout an occupied branch already lives in (no Git mutation). */
	const reuseCheckout = async (row) => {
		if (state.busy) return;
		setError("");
		setBusy(true);
		setStatus(t("worktree.opening"));
		try {
			await enterCheckout(row.occupiedPath, row.name);
			frame.closeDialog();
			ctx.contextMenus.notify(t("worktree.reused", { branch: row.name }), true);
		} catch (failure) {
			setBusy(false);
			setStatus("");
			setError(t("worktree.openFail", { path: row.occupiedPath, msg: String(failure?.message ?? failure) }));
		}
	};

	const submit = async () => {
		if (state.busy) return;
		const mode = state.mode;
		const picked = mode === "new" ? null : existingPicker.selected();
		const branch = mode === "new" ? nameInput.value.trim() : picked?.name ?? "";
		if (mode === "new") {
			const reason = worktreeNameError(branch);
			if (reason !== "") {
				setError(t(reason === "needs-name" ? "worktree.needsName" : "worktree.nameInvalid"));
				return;
			}
		} else if (branch === "") {
			const active = existingPicker.activeRow();
			setError(active?.occupied ? t("worktree.occupiedPick", { path: active.occupiedPath }) : t("worktree.pickOne"));
			return;
		}
		if (mode === "existing" && picked?.remoteRef && state.hostStale) {
			setError(t("worktree.hostOld"));
			return;
		}
		setError("");
		setBusy(true);
		setStatus(t("worktree.creatingCheckout"));
		const payload = { cwd, branch, mode, base: mode === "new" ? basePicker.value() : "" };
		if (repo() !== "") payload.repo = repo();
		if (mode === "existing" && picked?.remoteRef) payload.remoteRef = picked.remoteRef;
		const res = await api("git.worktreeCreate", payload);
		if (!res.ok) {
			setBusy(false);
			setStatus("");
			setError(t("worktree.fail", { msg: res.error ?? "?" }));
			return;
		}
		const created = res.value ?? {};
		setStatus(t("worktree.opening"));
		try {
			await enterCheckout(created.path, created.branch);
			frame.closeDialog();
			ctx.contextMenus.notify(t("worktree.created", { branch: created.branch }), true);
		} catch (failure) {
			setBusy(false);
			setStatus("");
			// The checkout exists; keep the path on screen so it is not lost.
			setError(t("worktree.partial", { path: created.path ?? "", msg: String(failure?.message ?? failure) }));
		}
	};

	const refreshFromRemote = async () => {
		if (state.busy || fetchButton.disabled) return;
		fetchButton.disabled = true;
		setError("");
		setStatus(t("worktree.fetching"));
		const hint = repo() === "" ? { cwd } : { cwd, repo: repo() };
		const res = await api("git.fetch", hint);
		setStatus("");
		fetchButton.disabled = false;
		const failure = !res.ok ? res.error : res.value?.error;
		if (typeof failure === "string" && failure !== "") {
			setError(t("worktree.fetchFail", { msg: failure }));
			return;
		}
		await load();
	};
	fetchButton.addEventListener("click", () => { void refreshFromRemote(); });
	mergedToggle.addEventListener("change", () => {
		state.showMerged = mergedToggle.checked;
		fillBranches();
		existingPicker.focus();
	});
	modeExisting.addEventListener("click", () => { if (!state.busy) { state.mode = "existing"; setError(""); paint(); existingPicker.focus(); } });
	modeNew.addEventListener("click", () => { if (!state.busy) { state.mode = "new"; setError(""); paint(); nameInput.focus({ preventScroll: true }); } });
	cancel.addEventListener("click", () => { if (!state.busy) frame.closeDialog(); });
	create.addEventListener("click", () => { void submit(); });
	repoField.onChange(() => { if (!state.busy) void load(); });
	frame.card.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" || state.busy || event.isComposing) return;
		if (event.target === create || event.target === cancel || event.target === frame.close) return;
		event.preventDefault();
		void submit();
	});
	paint();
	setBusy(false);
	existingPicker.focus();
	await load();
}

/**
 * List the pool checkouts of one repository and remove the ones that are no
 * longer needed. The main checkout, the checkout the calling workspace stands
 * in, and locked checkouts cannot be removed; a dirty checkout needs the
 * explicit "discard" switch. Branches always survive.
 *
 * @param ctx - client context (`contextMenus.notify` for feedback).
 * @param t - locale translator.
 * @param target - `{cwd, repos}` from the workspace menu.
 */
export async function openManageDialog(ctx, t, target) {
	if (typeof document === "undefined") return;
	const cwd = String(target?.cwd ?? "");
	const repos = Array.isArray(target?.repos) && target.repos.length > 0 ? target.repos : [""];
	const frame = createFrame(t, t("worktree.manageTitle"));
	const { body, foot, setError, setStatus } = frame;

	const repoField = createRepoField(t, cwd, repos);
	if (repoField.element !== null) body.append(repoField.element);

	const list = el("div", "ce-wt-wt-list");
	const hint = el("div", "ce-wt-hint", t("worktree.branchKept"));
	const discardRow = el("label", "ce-wt-check");
	const discard = el("input");
	discard.type = "checkbox";
	discardRow.append(discard, el("span", "", t("worktree.force")));
	body.append(list, hint, discardRow);

	const close = el("button", "ce-wt-btn", t("worktree.close"));
	close.type = "button";
	foot.append(close);
	close.addEventListener("click", () => frame.closeDialog());

	const state = { busy: false, worktrees: [], root: "", main: "" };

	const remove = async (row) => {
		if (state.busy) return;
		state.busy = true;
		setError("");
		setStatus(t("worktree.removing"));
		const payload = { cwd, path: row.path };
		if (repoField.value() !== "") payload.repo = repoField.value();
		if (discard.checked) payload.force = true;
		const res = await api("git.worktreeRemove", payload);
		state.busy = false;
		setStatus("");
		if (!res.ok) {
			setError(t("worktree.removeFail", { msg: res.error ?? "?" }));
			return;
		}
		ctx.contextMenus.notify(t("worktree.removed", { path: pathLabel(state.main === "" ? state.root : state.main, row.path) }), true);
		discard.checked = false;
		await load();
	};

	const render = () => {
		list.replaceChildren();
		const rows = state.worktrees.filter((row) => row.managed === true);
		if (rows.length === 0) {
			list.append(el("div", "ce-wt-empty", t("worktree.emptyList")));
			return;
		}
		for (const row of rows) {
			const item = el("div", "ce-wt-wt-row");
			const text = el("div", "ce-wt-wt-text");
			const head = el("div", "ce-wt-wt-branch");
			head.append(el("span", "ce-wt-option-name", row.detached ? t("worktree.detached") : row.branch));
			if (row.path === cwd) head.append(el("span", "ce-wt-badge", t("worktree.currentCheckout")));
			if (row.locked) head.append(el("span", "ce-wt-badge", t("worktree.locked")));
			text.append(head, el("div", "ce-wt-wt-path", pathLabel(state.main === "" ? state.root : state.main, row.path)));
			const action = el("button", "ce-wt-btn ce-wt-danger", t("worktree.remove"));
			action.type = "button";
			const blocked = row.path === cwd || row.locked;
			action.disabled = blocked;
			action.title = blocked ? t("worktree.removeBlocked") : t("worktree.remove");
			action.addEventListener("click", () => { void remove(row); });
			item.append(text, action);
			list.append(item);
		}
	};

	const load = async () => {
		setError("");
		setStatus(t("worktree.loading"));
		const hint = repoField.value() === "" ? { cwd } : { cwd, repo: repoField.value() };
		const res = await api("git.worktrees", hint);
		setStatus("");
		if (!res.ok) {
			setError(t("worktree.fail", { msg: res.error ?? "?" }));
			return;
		}
		state.root = String(res.value?.root ?? "");
		state.main = String(res.value?.main ?? "");
		state.worktrees = Array.isArray(res.value?.worktrees) ? res.value.worktrees : [];
		render();
	};

	repoField.onChange(() => { if (!state.busy) void load(); });
	await load();
}
