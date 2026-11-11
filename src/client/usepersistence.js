/* ---------------- per-session navigation persistence hook ---------------- */

import { useEffect, useRef } from "./react.js";

/**
 * Persists the Code panel's navigation state (open file + cursor + scroll,
 * mode, rail geometry, wrap & find options, tabs, back/forward stacks) under
 * a per-session localStorage key: debounced saves (700 ms), a final flush on
 * unmount, and a one-shot restore the first time the session gets a cwd.
 * All state itself stays in CodeBody; this hook only moves it to/from storage.
 */
export function useNavPersistence(params) {
	const {
		persistKey, cwd, doc, cursor, scroll, mode, railW, railVisible, wrapOn, findOpts, tabs, histTick,
		histRef, docRef, codeRef, loadFile,
		setRailW, setRailVisible, setWrapOn, setFindOpts, setTabs, setMode, setHistTick, setScroll,
	} = params;
	const restoredFor = useRef(null);
	const latestPersistRef = useRef(null);
	const saveTimer = useRef(null);

	/* P0-1: per-session navigation state survives tab churn */
	useEffect(() => {
		if (!persistKey || !cwd || restoredFor.current === persistKey) return;
		restoredFor.current = persistKey;
		let blob = null;
		try {
			blob = JSON.parse(localStorage.getItem(persistKey) || "null");
		} catch {}
		if (!blob) return;
		if (Number.isFinite(blob.railW)) setRailW(Math.max(150, Math.min(760, blob.railW)));
		if (typeof blob.railVisible === "boolean") setRailVisible(blob.railVisible);
		if (typeof blob.wrapOn === "boolean") setWrapOn(blob.wrapOn);
		if (blob.findOpts && typeof blob.findOpts === "object") setFindOpts({ regex: blob.findOpts.regex === true, caseSensitive: blob.findOpts.caseSensitive === true, words: blob.findOpts.words === true });
		if (Array.isArray(blob.tabs)) setTabs(blob.tabs.filter((p) => typeof p === "string" && p !== "").slice(0, 15));
		if (typeof blob.mode === "string") setMode(blob.mode === "skills" ? "files" : blob.mode);
		if (blob.path && !docRef.current) {
			histRef.current = { back: Array.isArray(blob.back) ? blob.back : [], forward: Array.isArray(blob.forward) ? blob.forward : [] };
			setHistTick((v) => v + 1);
			void loadFile(blob.path, blob.line ?? 1, blob.col ?? 1, null).then(() => {
				if (Number.isFinite(blob.scroll) && codeRef.current) {
					codeRef.current.scrollTop = blob.scroll;
					setScroll(blob.scroll);
				}
			});
		}
	}, [persistKey, cwd, loadFile]);

	useEffect(() => {
		if (!persistKey) return;
		const payload = {
			path: doc?.path,
			line: cursor?.line,
			col: cursor?.col,
			scroll,
			mode,
			railW,
			railVisible,
			wrapOn,
			findOpts,
			tabs,
			back: histRef.current.back.slice(-40),
			forward: histRef.current.forward.slice(-40),
		};
		latestPersistRef.current = { key: persistKey, payload };
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			try {
				localStorage.setItem(persistKey, JSON.stringify(payload));
			} catch {}
		}, 700);
	}, [persistKey, doc, cursor, scroll, mode, railW, railVisible, wrapOn, findOpts, tabs, histTick]);

	useEffect(() => () => {
		if (saveTimer.current) clearTimeout(saveTimer.current);
		const last = latestPersistRef.current;
		if (last) {
			try {
				localStorage.setItem(last.key, JSON.stringify(last.payload));
			} catch {}
		}
	}, []);

}
