/* ---------------- tiny markdown preview (dependency-free) ---------------- */

import { h, useMemo } from "./react.js";

/** Drop a leading YAML frontmatter block so the preview shows the body only. */
function stripFrontmatter(text) {
	if (!text.startsWith("---")) return text;
	const end = text.indexOf("\n---", 3);
	if (end === -1) return text;
	const nl = text.indexOf("\n", end + 4);
	return nl === -1 ? "" : text.slice(nl + 1);
}

const TABLE_SEP = /^[\s|:-]*-[\s|:-]*$/;
const PARA_STOP = /^(#{1,6}\s|```|>|\||[-*+]\s|\d+[.)]\s)/;

/** Parse markdown into a flat block list: h/p/code/list/quote/table/hr. */
export function parseMarkdown(text) {
	const lines = stripFrontmatter(text ?? "").split("\n");
	const blocks = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (line.trim() === "") {
			i++;
			continue;
		}
		const fence = /^```(.*)$/.exec(line);
		if (fence !== null) {
			const buf = [];
			i++;
			while (i < lines.length && !/^```/.test(lines[i])) {
				buf.push(lines[i]);
				i++;
			}
			i++;
			blocks.push({ kind: "code", lang: fence[1].trim(), text: buf.join("\n") });
			continue;
		}
		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		if (heading !== null) {
			blocks.push({ kind: "h", level: heading[1].length, text: heading[2] });
			i++;
			continue;
		}
		if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
			blocks.push({ kind: "hr" });
			i++;
			continue;
		}
		if (line.trim().startsWith("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1].trim())) {
			const rows = [];
			while (i < lines.length && lines[i].trim().startsWith("|")) {
				rows.push(lines[i].trim());
				i++;
			}
			const cells = (r) => r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
			blocks.push({ kind: "table", head: cells(rows[0]), body: rows.slice(2).map(cells) });
			continue;
		}
		if (/^>\s?/.test(line)) {
			const buf = [];
			while (i < lines.length && /^>\s?/.test(lines[i])) {
				buf.push(lines[i].replace(/^>\s?/, ""));
				i++;
			}
			blocks.push({ kind: "quote", text: buf.join(" ") });
			continue;
		}
		if (/^[-*+]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
			const ordered = /^\d+[.)]\s+/.test(line);
			const items = [];
			while (i < lines.length) {
				const m = ordered ? /^\d+[.)]\s+(.*)$/.exec(lines[i]) : /^[-*+]\s+(.*)$/.exec(lines[i]);
				if (m === null) break;
				items.push(m[1]);
				i++;
			}
			blocks.push({ kind: "list", ordered, items });
			continue;
		}
		const buf = [line];
		i++;
		while (i < lines.length && lines[i].trim() !== "" && !PARA_STOP.test(lines[i])) {
			buf.push(lines[i]);
			i++;
		}
		blocks.push({ kind: "p", text: buf.join(" ") });
	}
	return blocks;
}

/** Inline spans: `code`, **bold**, *italic*, [text](url). Everything else stays text. */
function renderInline(text, keyPrefix) {
	const re = /(`[^`]+`)|(\*\*[^*]+?\*\*)|(\*[^*]+?\*)|(\[[^\]]*?\]\([^)\s]+?\))/g;
	const nodes = [];
	let last = 0;
	let k = 0;
	let m;
	while ((m = re.exec(text)) !== null) {
		if (m.index > last) nodes.push(text.slice(last, m.index));
		const tok = m[0];
		const key = `${keyPrefix}-${k++}`;
		if (tok.startsWith("`")) nodes.push(h("code", { key, className: "ce-md-code" }, tok.slice(1, -1)));
		else if (tok.startsWith("**")) nodes.push(h("strong", { key }, tok.slice(2, -2)));
		else if (tok.startsWith("*")) nodes.push(h("em", { key }, tok.slice(1, -1)));
		else {
			const link = /\[([^\]]*)\]\(([^)\s]+)\)/.exec(tok);
			nodes.push(h("a", { key, className: "ce-md-a", href: link ? link[2] : "#", target: "_blank", rel: "noreferrer" }, link ? link[1] : tok));
		}
		last = m.index + tok.length;
	}
	if (last < text.length) nodes.push(text.slice(last));
	return nodes;
}

export function MarkdownView({ text }) {
	const blocks = useMemo(() => parseMarkdown(text), [text]);
	return h(
		"div",
		{ className: "ce-md" },
		blocks.map((b, i) => {
			const key = String(i);
			switch (b.kind) {
				case "h":
					return h(`h${Math.min(6, b.level)}`, { key, className: `ce-md-h ce-md-h${Math.min(6, b.level)}` }, renderInline(b.text, key));
				case "code":
					return h("pre", { key, className: "ce-md-pre" }, h("code", null, b.text));
				case "list":
					return h(b.ordered ? "ol" : "ul", { key, className: "ce-md-list" }, b.items.map((item, j) => h("li", { key: String(j) }, renderInline(item, `${key}-${j}`))));
				case "quote":
					return h("blockquote", { key, className: "ce-md-quote" }, renderInline(b.text, key));
				case "hr":
					return h("hr", { key, className: "ce-md-hr" });
				case "table":
					return h("table", { key, className: "ce-md-table" },
						h("thead", null, h("tr", null, b.head.map((c, j) => h("th", { key: String(j) }, renderInline(c, `${key}-h${j}`))))),
						h("tbody", null, b.body.map((row, j) => h("tr", { key: String(j) }, row.map((c, q) => h("td", { key: String(q) }, renderInline(c, `${key}-r${j}-${q}`)))))),
					);
				default:
					return h("p", { key, className: "ce-md-p" }, renderInline(b.text, key));
			}
		}),
	);
}
