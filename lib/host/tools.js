/** Agent tools for the toolbox: API request, git review, skills management.
 *
 * Each tool wraps an existing Host route so the UI and the agent share one
 * code path (DSH user-actions pattern). Parameters mirror the UI's inputs;
 * results are JSON-serializable strings the model can reason about.
 */

import { z } from "zod";

const sqlSafe = z.string().max(64 * 1024);

export function createToolboxTools({ routes, dbRoutes }) {
	return [
		{
			name: "api_request",
			description: "Send an HTTP request through the toolbox API workbench. Supports GET/POST/PUT/DELETE/PATCH with headers, body, auth and environment variable substitution. Returns status, headers, body (truncated) and timing.",
			parameters: {
				method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"], required: true },
				url: { type: "string", description: "Full URL including query string. {{var}} placeholders are resolved from the active environment.", required: true },
				headers: { type: "array", description: "Array of {name, value} header objects.", items: { type: "object" } },
				body: { type: "string", description: "Request body for POST/PUT/PATCH." },
				bodyType: { type: "string", enum: ["none", "raw", "form", "multipart"] },
				auth: { type: "object", description: "{mode:'bearer'|'basic', token?, user?, pass?}" },
				timeoutMs: { type: "number", description: "Timeout in ms (1000–120000). Default 30000." },
				envVars: { type: "array", description: "Environment variables [{name,value}] for {{var}} substitution.", items: { type: "object" } },
			},
			output: { schema: { type: "object", properties: { data: { type: "string", required: true } }, additionalProperties: false }, render: (_args, value) => [{ type: "text", text: value.data }] },
			async execute(args) {
				const body = {
					method: args.method,
					url: args.url,
					headers: Array.isArray(args.headers) ? args.headers : [],
					body: typeof args.body === "string" ? args.body : "",
					bodyType: args.bodyType ?? "none",
					auth: args.auth ?? null,
					timeoutMs: Number(args.timeoutMs) || 30000,
				};
				// Resolve {{var}} placeholders from envVars before sending.
				if (Array.isArray(args.envVars) && args.envVars.length > 0) {
					const map = new Map(args.envVars.filter((v) => v?.name).map((v) => [v.name, String(v.value ?? "")]));
					body.url = body.url.replace(/\{\{(\w+)\}\}/g, (_, k) => map.get(k) ?? `{{${k}}}`);
					body.headers = body.headers.map((h) => ({ ...h, value: String(h.value ?? "").replace(/\{\{(\w+)\}\}/g, (_, k) => map.get(k) ?? `{{${k}}}`) }));
					if (typeof body.body === "string") body.body = body.body.replace(/\{\{(\w+)\}\}/g, (_, k) => map.get(k) ?? `{{${k}}}`);
				}
				const res = await routes["api.send"](body, {});
				const truncated = res.text && res.text.length > 4096 ? res.text.slice(0, 4096) + "\n…[truncated]" : res.text ?? "";
				return { data: JSON.stringify({ status: res.status, statusText: res.statusText, ms: res.ms, size: res.size, headers: res.headers, body: truncated, error: res.error }) };
			},
		},
		{
			name: "db_describe",
			description: "List the database connections the toolbox has open and describe their schema (databases, tables/views, columns, primary keys). Call this before writing SQL so column and table names are real, not guessed.",
			parameters: {
				connection: { type: "string", description: "Connection id to describe. Omit to list every open connection." },
				table: { type: "string", description: "Only describe this table (implies a connection)." },
			},
			output: { schema: { type: "object", properties: { data: { type: "string", required: true } }, additionalProperties: false }, render: (_args, value) => [{ type: "text", text: value.data }] },
			async execute(args) {
				const open = await dbRoutes["db.connections"]();
				if (!open || open.length === 0) {
					return { data: JSON.stringify({ error: "no database connection is open — open one in the toolbox database panel first" }) };
				}
				const id = String(args.connection ?? "") || open[0].id;
				const known = open.find((entry) => entry.id === id);
				if (!known) return { data: JSON.stringify({ error: `unknown connection: ${id}`, connections: open.map((entry) => ({ id: entry.id, driver: entry.driver, label: entry.label })) }) };
				if (typeof args.table === "string" && args.table !== "") {
					const columns = await dbRoutes["db.columns"]({ id, table: args.table });
					return { data: JSON.stringify({ connection: { id, driver: known.driver, label: known.label }, table: args.table, columns }) };
				}
				const schema = await dbRoutes["db.schema"]({ id });
				// Tables and columns are the useful part; indexes would swamp the model.
				const compact = {
					connection: { id, driver: known.driver, label: known.label },
					current: schema?.current ?? "",
					databases: (schema?.databases ?? []).map((database) => ({
						name: database.name,
						tables: (database.tables ?? []).map((table) => ({
							name: table.name,
							kind: table.kind,
							columns: (table.columns ?? []).map((column) => `${column.name} ${column.type}${column.primaryKey ? " PK" : ""}${column.nullable === false ? " NOT NULL" : ""}`),
						})),
					})),
				};
				return { data: JSON.stringify(compact) };
			},
		},
		{
			name: "db_query",
			description: "Run a read-only SQL statement against an open toolbox database connection and return the rows. Use db_describe first to learn the schema. Writes (INSERT/UPDATE/DELETE/DDL) are refused: this tool is for reading.",
			parameters: {
				sql: { type: "string", description: "A single SELECT / WITH / SHOW / DESCRIBE / EXPLAIN / PRAGMA statement.", required: true },
				connection: { type: "string", description: "Connection id from db_describe. Omit to use the first open connection." },
				limit: { type: "number", description: "Maximum rows to return (1–1000, default 200)." },
			},
			output: { schema: { type: "object", properties: { data: { type: "string", required: true } }, additionalProperties: false }, render: (_args, value) => [{ type: "text", text: value.data }] },
			async execute(args) {
				const sql = String(args.sql ?? "").trim();
				if (sql === "") return { data: JSON.stringify({ error: "the statement is empty" }) };
				if (!/^\s*(select|with|show|describe|desc|explain|pragma)\b/i.test(sql)) {
					return { data: JSON.stringify({ error: "only read-only statements are allowed here (SELECT / WITH / SHOW / DESCRIBE / EXPLAIN / PRAGMA)" }) };
				}
				const open = await dbRoutes["db.connections"]();
				if (!open || open.length === 0) {
					return { data: JSON.stringify({ error: "no database connection is open — open one in the toolbox database panel first" }) };
				}
				const id = String(args.connection ?? "") || open[0].id;
				const limit = Math.min(Math.max(Number(args.limit) || 200, 1), 1000);
				const res = await dbRoutes["db.query"]({ id, sql, limit });
				return { data: JSON.stringify({ connection: id, columns: res.columns, rows: res.rows, truncated: res.truncated === true, ms: res.ms, changes: res.changes }) };
			},
		},
		{
			name: "git_review",
			description: "Review git repository state: status (branch, staged/working/untracked files), diff for a file or scope, branch list, commit log, or blame. Read-only — never mutates the repo.",
			parameters: {
				action: { type: "string", enum: ["status", "diff", "branches", "log", "blame"], required: true },
				cwd: { type: "string", description: "Workspace directory.", required: true },
				path: { type: "string", description: "File path for diff/blame." },
				scope: { type: "string", enum: ["working", "staged", "branch", "commit"] },
				repo: { type: "string", description: "Repo root hint for multi-repo workspaces." },
				limit: { type: "number", description: "Max commits for log action. Default 20." },
			},
			output: { schema: { type: "object", properties: { data: { type: "string", required: true } }, additionalProperties: false }, render: (_args, value) => [{ type: "text", text: value.data }] },
			async execute(args) {
				const cwd = String(args.cwd ?? "");
				if (args.action === "status") {
					const res = await routes["git.status"]({ cwd, repo: args.repo });
					return { data: JSON.stringify(res) };
				}
				if (args.action === "diff") {
					const res = await routes["git.diff"]({ cwd, path: args.path ?? "", scope: args.scope ?? "working", repo: args.repo });
					const diff = res.diff ?? "";
					const truncated = diff.length > 8192 ? diff.slice(0, 8192) + "\n…[truncated]" : diff;
					return { data: JSON.stringify({ ...res, diff: truncated }) };
				}
				if (args.action === "branches") {
					const res = await routes["git.branches"]({ cwd, repo: args.repo });
					return { data: JSON.stringify(res) };
				}
				if (args.action === "log") {
					// No dedicated git.log route; use git.status which includes
					// the recent commit list, or fall back to a raw git log call.
					const status = await routes["git.status"]({ cwd, repo: args.repo });
					return { data: JSON.stringify({ commits: status.commits ?? [], branch: status.branch }) };
				}
				if (args.action === "blame") {
					const res = await routes["git.blame"]({ cwd, path: args.path ?? "", repo: args.repo });
					return { data: JSON.stringify(res) };
				}
				return { data: JSON.stringify({ error: `unknown action: ${args.action}` }) };
			},
		},
		{
			name: "skills_manage",
			description: "List, read, create, write or delete agent skills. Project skills live under .agents/skills or .dsh/skills; user skills under ~/.agents/skills or ~/.dsh/skills. Bundled and registry skills are read-only.",
			parameters: {
				action: { type: "string", enum: ["list", "read", "create", "write", "delete"], required: true },
				cwd: { type: "string", description: "Workspace directory.", required: true },
				name: { type: "string", description: "Skill name for create (kebab-case)." },
				path: { type: "string", description: "Skill file path for read/write/delete." },
				content: { type: "string", description: "SKILL.md content for write/create." },
				scope: { type: "string", enum: ["project", "user"], description: "Where to create: project (.agents/skills) or user (~/.agents/skills)." },
			},
			output: { schema: { type: "object", properties: { data: { type: "string", required: true } }, additionalProperties: false }, render: (_args, value) => [{ type: "text", text: value.data }] },
			async execute(args) {
				const cwd = String(args.cwd ?? "");
				if (args.action === "list") {
					const res = await routes["skills.list"]({ cwd });
					return { data: JSON.stringify(res) };
				}
				if (args.action === "read") {
					const res = await routes["skills.read"]({ cwd, path: args.path ?? "" });
					return { data: JSON.stringify(res) };
				}
				if (args.action === "create") {
					const res = await routes["skills.create"]({ cwd, name: args.name ?? "", scope: args.scope ?? "project" });
					return { data: JSON.stringify(res) };
				}
				if (args.action === "write") {
					const res = await routes["skills.write"]({ cwd, path: args.path ?? "", content: args.content ?? "" });
					return { data: JSON.stringify(res) };
				}
				if (args.action === "delete") {
					const res = await routes["skills.delete"]({ cwd, path: args.path ?? "" });
					return { data: JSON.stringify(res) };
				}
				return { data: JSON.stringify({ error: `unknown action: ${args.action}` }) };
			},
		},
	];
}