/* Shared request-field editor: params, headers, forms and environment variables. */
import { h } from "./react.js";

export function RequestFields({ t, label, rows, onChange, hint }) {
	const values = Array.isArray(rows) ? rows : [];
	const isEmpty = (row) => !row.name && !row.value && !row.description;
	const visible = values.length && isEmpty(values.at(-1)) ? values : [...values, { name: "", value: "", description: "" }];
	const update = (index, patch) => onChange(index === values.length
		? [...values, { enabled: true, name: "", value: "", ...patch }]
		: values.map((row, i) => i === index ? { ...row, ...patch } : row));
	return h("div", { className: "cea-fields" },
		h("div", { className: "cea-fields-scroll" },
			h("table", { className: "cea-fields-table", "aria-label": label },
				h("colgroup", null, h("col", { className: "cea-fields-check" }), h("col", { className: "cea-fields-name" }), h("col", { className: "cea-fields-value" }), h("col", { className: "cea-fields-description" }), h("col", { className: "cea-fields-action" })),
				h("thead", null, h("tr", null,
					h("th", { scope: "col" }, h("span", { className: "cea-sr-only" }, t("api.fieldEnabled"))),
					h("th", { scope: "col" }, t("api.fieldName")),
					h("th", { scope: "col" }, t("api.fieldValue")),
					h("th", { scope: "col", className: "cea-fields-description" }, t("api.fieldDescription")),
					h("th", { scope: "col" }, h("span", { className: "cea-sr-only" }, t("api.delete"))),
				)),
				h("tbody", null, visible.map((row, index) => {
					const draft = index === values.length;
					return h("tr", { key: index, className: !draft && row.enabled === false ? "cea-field-disabled" : undefined },
						h("td", null, h("input", { type: "checkbox", checked: row.enabled !== false, disabled: draft || isEmpty(row), "aria-label": `${label} · ${t("api.fieldEnabled")} ${index + 1}`, onChange: (event) => update(index, { enabled: event.target.checked }) })),
						...["name", "value", "description"].map((field) => h("td", { key: field, className: field === "description" ? "cea-fields-description" : undefined },
							h("input", { className: "cea-field-input", type: "text", spellCheck: false, autoComplete: "off", placeholder: t(`api.field${field[0].toUpperCase()}${field.slice(1)}`), "aria-label": `${label} · ${t(`api.field${field[0].toUpperCase()}${field.slice(1)}`)} ${index + 1}`, value: row[field] ?? "", onChange: (event) => update(index, { [field]: event.target.value }) }))),
						h("td", null, !draft ? h("button", { type: "button", className: "ce-tool cea-field-delete", title: t("api.delete"), "aria-label": `${t("api.delete")} ${label} ${index + 1}`, onClick: () => onChange(values.filter((_, i) => i !== index)) }, "×") : null),
					);
				})),
			),
		),
		h("div", { className: "cea-fields-footer" }, hint ? h("span", null, hint) : null, h("span", null, t("api.fieldAddHint"))),
	);
}
