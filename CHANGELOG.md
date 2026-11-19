# Changelog

## Unreleased — review fixes: discovery, relative database paths, address inference

A pass over the unreleased work found four defects worth fixing and two non-defects worth recording.

- **Discovery no longer dies on one undescribable service.** `file_containing_symbol` failing for a single advertised service (a health check, a plugin-registered service) aborted the whole reflection call, so a server that could be described was reported as "reflection failed". A failed service is now recorded in `skipped` and the rest of the server is returned.
- **A relative SQLite path means "in this workspace".** `data/app.db` was resolved against the Host process's own working directory — the app bundle, for a Desktop launch — so it silently opened a different file (or failed with "cannot open"). It now resolves against the session workspace, `~` expands, an absolute path is untouched, and a relative path with no workspace is refused with that reason. Saved profiles store the absolute form, and connecting a profile passes the workspace too.
- **`localhost:5432/app` is no longer mistaken for a file.** The address parser treated any `scheme:` that was really a host as a path, so a missing `postgres://` produced a bogus SQLite target named after the whole string. A `host:port/…` shape is now rejected as an unrecognised address, which is what the dialog already knows how to explain.
- **Saved-connection writes carry their revision.** The Host has always refused a save against a stale list, but the panel never sent `baseRevision`, so the guard could not fire. It is sent now, and the returned revision is remembered.
- **Recorded, not fixed:** a MySQL write statement reports no affected-row count (the CLI prints nothing in batch mode and `ROW_COUNT()` belongs to a different process than the next query); the result grid still renders every returned row as DOM; cancelling a query on a connection shared by two tabs kills whichever child was last registered; and a worker thread inherits the Host's `execArgv`, so a Node-only flag such as `--input-type` breaks SQLite connections (tooling only — the Desktop runtime passes none).
- Also recorded: the earlier suspicion that a language server installed mid-session stays "not installed" is **not** a bug — the candidate list holds paths, so a server dropped into `node_modules/.bin` is picked up on the next retry (verified).
- Regressions: a relative SQLite path resolving into the workspace and the refusal without one, `skipped` reported by discovery, a `host:port` address rejected while `app.db` still reads as SQLite.

## Unreleased — language servers are found where they actually are

References and definition jumps still failed on files whose server was installed, because the launcher only knew a short list of absolute paths and a bare name resolved against the Host's PATH — and a Desktop Host started from Finder has neither `node` nor an npm bin directory on it:

- **Project-local servers win** ([lib/host/binpath.js](<lib/host/binpath.js>)): the lookup now walks up from the project root through `node_modules/.bin`, `.venv/bin`, `venv/bin` and `.bin`, then PATH, then the per-user install locations (npm/nvm/pnpm/bun/volta/asdf, pyenv/conda, Homebrew, `/usr/local/bin`). `DSH_<NAME>_BIN` overrides everything, and Go keeps its own `GOBIN`/`GOPATH` precedence. The result is memoised.
- **A shebang script is started with a real Node.** An npm server is a `#!…node` script; spawning it directly needs `env node`, which the Host's PATH does not have, so the spawn failed with ENOENT on a file that plainly exists. Such a target is now run as `<node> <script>`, with the Node resolved by the same lookup.
- **The failure that gets reported is the informative one.** A candidate that could not spawn is just "not this path"; a server that started and then refused (a missing `typescript`, an unsupported version) is the real answer. The loop used to overwrite that with the last ENOENT and print "not installed".
- **A missing server says how to install it**, per language (`go install …gopls@latest`, `npm i -g typescript-language-server typescript`, `pip install pyright`).
- Verified end to end in a scratch TypeScript project whose server lived only in its own `node_modules`: references at a call site returned the declaration and both uses, with `status.state === "ready"`. The database panel's CLI detection now uses the same lookup instead of its own copy.
- Regressions: project-local wins over PATH, PATH is searched when the project has none, a project virtualenv is searched for Python servers, `DSH_*_BIN` wins, candidate order, every-name lookup, the TypeScript launcher prefers the project binary, the install hint, and a fake node-shebang server that only answers if the plugin starts it with a real Node (hover + references through the route).

## Unreleased — find references is reachable, and says why it cannot run

"View references" looked broken because there was almost no way to ask for it and no answer when it could not work:

- **One action, three entry points.** ⇧F12 was the only door, and it needed a click first. The editor toolbar now carries a **⌖** button (LSP-backed files only), the Command Centre gains **Find references** (⇧F12) and **Go to definition** (F12), and ⇧F12 routes through the same action — a single `findReferences` callback computes the position (snapping to the identifier under it, so a click that lands on the space beside a symbol still means the symbol) and opens the peek.
- **No more silent no-ops.** Opening a `.md`/`.json`/`.rs` file and asking for references used to return without a word; it now says this file type has no language server. A jump without a cursor says to click an identifier first — including the definition path, which used to return silently too.
- **A route that answers "no server covers this file" is surfaced.** The peek used to render "defs 0 · refs 0" for that case, which reads as "nothing here" rather than "nothing ran"; the route's `note` now becomes the panel's message.
- **The peek is keyboard-usable and stays on screen.** It took focus on open (it never did, so ArrowUp/Down and Enter went to the editor instead), and its position is clamped to the visible code area — a peek opened near the bottom of a file used to hang below the viewport where nothing could be clicked.
- Verified against real gopls on a two-file module: references at a call site return the declaration and every use, across files.
- Regressions: the toolbar exposes the action, the palette lists it, running it issues exactly one `references` request at the cursor and opens the peek with the returned rows, and a note-only answer is shown as a message.

## Unreleased — 空白页签：旧的 gRPC 页没有标题，也没搬进工作台

合并后截图里出现了一个**没有标题的页签**。原因是合并只改了入口，没有处理**合并前保存的布局**：旧会话里还存着一个 `code-rpc` 页，宿主照旧把它恢复出来，而它的标题槽 `RpcTitle` 返回 `null`——一个渲染空的标题槽不会回退到页签自带的标题，于是只剩一个空白 chip。

- **标题不再可能为空**（[src/client/rpc.js](<src/client/rpc.js>)）：`RpcTitle` 渲染 `>_ 标题`，标题缺失时用 "gRPC" 兜底。任何标题槽都不该渲染 `null`：宿主把槽的产物当作标题本身，空就是空。
- **旧页一次性搬进工作台**（[src/client/migrate.js](<src/client/migrate.js>)、[src/client/index.js](<src/client/index.js>)）：插件启动时订阅打开的页签列表，遇到 `code-rpc` 就 —— 先把协议偏好设为 gRPC（工作台因此直接落在 gRPC 上）、关闭旧页、在同一个会话里打开工作台。每个页签只搬一次（`session:tab` 去重，且在动作前登记，避免关闭回调重入成环）；工作台还没注册时不动手；关闭被拒绝时保留旧页并停止本次搬迁，绝不丢页面。
- Regressions：9 项——替换类型、搬迁顺序（偏好先于打开）、其他类型不受影响、同页只搬一次、同 id 跨会话各搬一次、工作台未注册时不动、关闭被拒时不打开且计数为 0、缺列表容错、标题槽在空标题/有标题/无 hook 三种情况下都有文字。

## Unreleased — 一套历史、一套收藏：gRPC 接入工作台的存储

上一轮只合并了外壳：HTTP 的历史/收藏/环境在 `apistore` 里，gRPC 的地址与 `.proto` 路径还只是组件内状态，切过去仍是"另一个人"的表单。这一轮把 gRPC 接进同一套存储。

- **记录增加协议字段**（[src/client/apientries.js](<src/client/apientries.js>)）：形状仍是 `{ id, ts, request }`，多一个 `protocol`。合并前写下的行没有这个字段，读取时按 HTTP 处理——**迁移是"缺省即 http"，不需要重写历史**；写 HTTP 行时也不加字段，存储保持逐字节兼容。`filterByProtocol` / `mergeProtocols` 负责分拣与合并，`entryLabel` 给出统一列表里的可读标题（HTTP: `GET url`；gRPC: `/svc.Method → host`）。
- **gRPC 会写历史**（[src/client/rpc.js](<src/client/rpc.js>)）：每次调用落一条 `protocol: "grpc"` 记录（地址、`.proto`、方法、消息、metadata、状态、耗时）。写入走"**合并**而不是覆盖"——先读整份存储，按 id 去重后前插再截断，所以 HTTP 的行不会被 gRPC 冲掉（这个 bug 是测试当场抓到的：第一次实现直接用自己的过滤结果覆盖了整份存储）。
- **gRPC 有了自己的历史/收藏抽屉**：工具栏多了「历史 N」与「保存」，抽屉里按协议过滤（只显示 gRPC 行），点一行恢复到编辑器；收藏用 `方法 → 地址` 自动命名并去重。
- **工作台有了合并历史**（[src/client/workbench.js](<src/client/workbench.js>)）：顶部条上「历史 N」列出**两个协议**的记录，按时间倒序、带 `HTTP`/`gRPC` 徽标；点一行会**自动切到对应协议**并把记录交给那个面板加载（`incoming` + nonce 的一次性交接，两个面板各自忽略不是自己的协议）。列表每 4 秒重读一次存储（另一个面板或另一个窗口刚写入的行会出现），并用 id 指纹挡住无变化时的重渲染。
- **环境变量对 gRPC 生效**：地址、metadata 名与值、消息体里的 `{{var}}` 都按**当前激活环境**替换；未定义的变量**原样保留**（而不是变成空串把目标改错），与 HTTP 面板同一套环境存储，所以在 HTTP 面板里改环境，gRPC 侧立刻用上。
- Regressions：21 项——协议缺省与打标、两种过滤、跨协议合并排序、空列表容错、历史上限、两种标题、变量替换（含未知变量、嵌套值、只取激活环境的启用项、无环境）、工作台合并抽屉（计数、排序、徽标、点击切协议并交接、抽屉关闭）、gRPC 面板（只统计自己的协议、抽屉只列自己的行、调用写入共享存储、HTTP 行不被覆盖、环境变量替换进地址、合并历史的交接填充编辑器）。

## Unreleased — 数据库连接：填地址就够，驱动自动识别

「新建连接」先问"用哪个驱动"，而且那个下拉框可能**是空的**——截图里就是这个状态：Host 的 `db.drivers` 探测没回来时 `drivers` 为空，`<select>` 一个 `option` 都没有，于是驱动框一片空白，人根本不知道该选什么。DB 客户端不该这样：你只需要知道**目标**，协议由客户端读出来。

- **一个地址字段**（[src/client/dbconnect.js](<src/client/dbconnect.js>)）：`postgres://` / `postgresql://` → PostgreSQL（默认 5432），`mysql://` / `mariadb://` → MySQL（默认 3306），`sqlite://` / `file:` / 任何路径（含 `C:\…`、`./app.db`、`app.sqlite`）→ SQLite。URL 里的用户名/密码做百分号解码，query 与 hash 丢弃；端口缺省按驱动补齐。识别结果以「自动识别：PostgreSQL」显示，**填地址就能点连接**。
- **不猜**：`notes.txt`、`http://…` 这类"看起来像但不是"的输入报「无法识别」并禁用连接，而不是当 SQLite 打开后在使用中才炸。空地址只是"还没填"，不报错。
- **手动覆盖仍在，但不会空**：识别不了、或想自己指定驱动时才展开「手动填写字段（高级）」，其中的驱动菜单**永远有三项**（SQLite / MySQL / PostgreSQL），探测不到的命令行驱动带原因显示（如 `MySQL — mysql CLI not on PATH`）并置灰，不会再出现空白下拉框。
- **可用性前置**：探测说当前部署打不开的驱动（本机没有 `psql`/`mysql` CLI）直接禁用「连接」并显示原因，而不是点了之后由 Host 报错。
- **相对路径按会话工作区解析**（[lib/host/db.js](<lib/host/db.js>)）：`db.connect` 接受 `cwd`，SQLite 的相对路径以会话目录为基准，和人在面板里看到的路径一致；绝对路径原样使用。
- Regressions：12 项地址解析（URL/凭据解码/默认端口/两种 sqlite scheme/Windows 路径/裸文件名/无法识别/畸形 URL/路径判定/格式化与往返）+ 10 项对话框行为（先问地址、不先问驱动、空地址的提示、驱动菜单永不为空、不可用驱动带原因、URL 与路径的识别文案、不可用驱动禁用连接、就绪驱动启用、连接请求携带解析后的驱动与工作区）。

## Unreleased — 接口调试与 gRPC 合并为一个工作台

HTTP 调试和 gRPC 调试本来就是同一件事——"给服务发点东西，看它回什么"——却占了两条导航、两个页签。现在是一个 **接口调试（Request Workbench）** 页签，顶部一条细栏切换协议：

- **合并方式**（[src/client/workbench.js](<src/client/workbench.js>)）：工作台复用原 API 页签的身份（`code-api`），所以已保存的布局重开就是工作台；两个面板**首次访问后保持挂载**，切换协议不会丢草稿、响应或日志滚动位置，非活动面板用 `hidden` 隐藏而不是卸载。gRPC 面板**首次切过去才挂载**——它要解析 `.proto`，只调 HTTP 的人不必付这份成本。
- **协议选择记一次就够**（`dsh.plugin-kit.workbench.protocol`）：只记"上次用哪个"，不是每页签状态；整天写 gRPC 的人不用每次重选。存储被拒或值是垃圾时退回 HTTP。
- **导航只留一个入口**：左侧原来的 "RPC 调试" 行折叠进工作台（`LEFT_TOOL_HIDDEN_KINDS = ["code-rpc"]`，规则仍是"只有已具备同等能力的工作区入口才能折叠"）。旧的 `code-rpc` 页签类型**继续注册**，早先保存的布局照常打开，只是不再出现在任何入口。
- **文案**：zh/en 同步为「接口调试 / Request Workbench」，提示语分别说明 HTTP（curl 导入、环境变量、集合、SSE）与 gRPC（工作区 .proto、方法选择、流式）。
- Regressions：11 项——工作台标题即页签名、旧 RPC 类型仍可解析、左侧列表不再出现 RPC 行、协议记忆的读写与三种降级（未知值、存储拒绝、垃圾值）、默认 HTTP、gRPC 延迟挂载、切换后两侧都保持挂载、点击当前协议无副作用、`aria-selected` 与提示语跟随。

## Unreleased — terminal: mouse reporting, selection and copy

The plugin's terminal could run a shell and a full-screen TUI, but it could not be *clicked at* or *copied from*: mouse modes were parsed and discarded, and there was no selection at all. Both now work, and both are decided per event rather than per mode.

- **Mouse reporting** ([src/client/vt/mouse.js](<src/client/vt/mouse.js>)): DECSET 1000/1002/1003 plus SGR (?1006). Press, release, drag and hover are encoded with the modifier bits and the motion offset, in the SGR form (`ESC [ < b ; x ; y M/m`) when the program asked for it and in the X10 form otherwise — including X10's 223-column ceiling, which is refused rather than silently mis-encoded. A wheel turn becomes button 64/65 and goes to the program while it owns the pointer, because `less` and `vim` scroll themselves. Holding **Shift** keeps selection working anyway, which is the escape hatch every terminal offers.
- **Selection** ([src/client/vt/selection.js](<src/client/vt/selection.js>)): an anchor and a head in **buffer** coordinates, so a selection survives scrolling. A drag sets the head (and scrolls the viewport when it leaves the grid), a double click takes the word under the pointer, a triple click the whole row, and `⌘A`/`Ctrl+A` the retained buffer. Copying emits the text between the cells — wide characters once, wrapped rows joined without a newline, trailing padding dropped — and clears the highlight.
- **Painting** ([src/client/vt/render.js](<src/client/vt/render.js>)): the selection is an overlay of one rectangle per row segment between the rows and the cursor. It never invalidates row markup, so highlighting does not cost a repaint of the grid. Hit-testing uses the rows' own bounding box, so padded or scaled layouts stay aligned.
- **Keys**: `⌘C` and `Ctrl+Shift+C` copy, `⌘A` selects all, `Shift+PageUp/PageDown/Home/End` walk the scrollback, and any input returns to the live viewport. Only keys that would otherwise be swallowed are intercepted — everything else still becomes VT bytes.
- **Right click** copies the selection; with none, it focuses the input so the platform paste shortcut applies. Reading the clipboard proactively would need a permission prompt, so it is not done.
- Regressions: 21 selection/mouse cases (normalisation in both drag directions, per-row spans, multi-row and wrapped-row text, padding, word and line and select-all ranges, ownership and motion modes, SGR press/release/drag/modifiers/right button/wheel, X10 offset bytes and its ceiling, unreported hover and drag) and 6 interaction cases driven through the real component with a DOM shim (drag paints one rect, ⌘C copies exactly the dragged cells and clears the highlight, double click takes the word, Ctrl+Shift+C with no selection copies nothing, Shift+PageUp scrolls without writing to the shell, and a program that owns the pointer receives press/drag/release/wheel). Two defects the tests caught on the way: the selection overlay kept a captured child list (a live collection never shrank, hanging the paint loop) and a stale test fixture selected the wrong row.

## Unreleased — a real database workbench, and gRPC debugging

The first database panel was a connection list, one SQL box and a result table. It did the three things a database tool has to do and none of the things that make one usable: no schema columns, no way to browse a table, no paging, no history, nothing to click. This replaces it, and adds the RPC half the request workbench was missing.

### Database batch ([lib/host/db.js](<lib/host/db.js>), [src/client/db.js](<src/client/db.js>))

- **Schema, not a table list**: `db.schema` reports every database, table and view with its columns (type, NOT NULL, primary key, default) and its indexes; the rail renders that as an expandable tree with a name filter and `PK` / `NN` badges. SQLite reads `sqlite_master` + `PRAGMA table_info` / `index_list` / `index_info`; MySQL and PostgreSQL read `information_schema` through the CLI adapters and introspect the current database (other databases list by name only, so a server with fifty schemas does not spawn fifty queries on connect).
- **Table browsing with a server-side page**: `db.rows` runs one ordered, filtered `LIMIT/OFFSET` page plus the matching `COUNT(*)`, capped at 500 rows. Clicking a table opens a grid tab; clicking a column header sorts (ascending, then descending); the filter box searches every column through `CAST(col AS TEXT) LIKE`, with the needle escaped as data — a filter of `O'Reilly` matches nothing rather than breaking the statement; the pager walks the total.
- **Multiple query tabs with history**: every tab owns its editor, result, timing and truncation flag; ⌘/Ctrl+Enter runs the active one; the last 40 statements are recallable from the history drawer with one click. A `CREATE` / `DROP` / `ALTER` refreshes the tree automatically, so a migration run in the panel is visible without a manual reload.
- **A grid you can read**: sticky headers, row numbers, NULL rendered distinctly from an empty string, long cells ellipsized with the full value in a click-through detail panel, and CSV export with RFC 4180 quoting.
- **Connection dialog that adapts**: SQLite asks for a file path; MySQL/PostgreSQL ask for host, port, database, user and password, disable drivers this machine cannot reach (`mysql` / `psql` missing from PATH), and **prove the connection at connect time** with a `SELECT 1` so a wrong password fails where the user is looking instead of on the first query.
- Regressions (host, SQLite): connect/close, schema with columns and indexes, PK/NOT NULL flags, a paged table with its total, the following page, descending order, a cross-column filter with its count, a quote-bearing filter treated as data, `SELECT` columns and rows, `UPDATE` change count, limit truncation, empty-statement refusal, a closed connection refusing queries. (client) `toCsv` quoting, `tableSql` paging/order/quoting/escaping, `formatCell` NULL-vs-empty, `truncateCell`.

### gRPC / RPC panel ([lib/host/proto.js](<lib/host/proto.js>), [lib/host/protobuf.js](<lib/host/protobuf.js>), [lib/host/grpc.js](<lib/host/grpc.js>), [src/client/rpc.js](<src/client/rpc.js>))

Ports the gRPC request model Bruno ships, against DSH's own runtime instead of a grpc/protobuf dependency tree — the plugin still has no runtime dependencies:

- **`.proto` parsing** (`proto.js`): proto3 messages (nested, `repeated`, `optional`, `map<>`, `oneof`), enums, and services with their `rpc` methods including `stream` on either side; comments, `reserved`, `option` and unknown blocks are skipped rather than rejected. Type names resolve against the enclosing message scopes, then the package, so a field referencing a sibling nested type works. Imports are followed (depth- and count-bounded) with the requested file mandatory and missing imports tolerated — `google/protobuf/*.proto` lives outside most repositories.
- **Protobuf wire codec** (`protobuf.js`): every proto3 scalar, embedded messages, enums by name, repeated fields written packed, and `map<>` entries; decoding skips unknown fields so a newer server cannot break the client, keeps 64-bit values beyond `Number.MAX_SAFE_INTEGER` as strings, and returns enums by name. `sampleMessage` produces the zero-value skeleton the panel seeds the editor with (an empty gRPC body is a protocol error).
- **gRPC over Node's HTTP/2** (`grpc.js`): `POST /<service>/<method>`, `content-type: application/grpc`, the 5-byte length-prefixed framing, `grpc-timeout`, `-bin` metadata base64-encoded, replies decoded per frame with a bounded stream cap, status and trailers surfaced by name. `grpc://` is plaintext HTTP/2 and `grpcs://` uses TLS (with an explicit skip-verify switch). A refused connection is reported as an error instead of crashing the host on an unhandled session event.
- **Panel** (`rpc.js`): address + `.proto` + Load in the toolbar, methods grouped by service in the rail with a `→` / `|→` / `→|` / `↔` streaming glyph, a JSON request editor seeded from the message schema, an editable metadata table, timeout and certificate switches, and a response pane showing the status code and name, every returned message, trailers, and the round-trip time.
- Regressions: proto parsing (package, nested messages, enums, field numbers/repeated/map flags, nested type resolution, method paths and streaming flags), protobuf round-trips (strings/ints/bools/repeats, packed scalars, maps, nested messages, enum names, unknown-field skip, sample skeleton, exact negative varints), `parseTarget` accept/refuse, status names, `parseJsonText`, `methodArrows`, `groupMethods`; host: `rpc.proto` method listing and sample body, a missing proto refused, **a real in-process HTTP/2 gRPC server** answering a unary call end to end (status 0, decoded reply, trailers, timing), an unknown method refused, and a dead port surfaced as an error.

### Saved connections ([lib/host/dbprofiles.js](<lib/host/dbprofiles.js>))

- **A connection can be remembered.** The profile list is storage-backed (DSH `storageDomain`), so it survives a restart and is shared by every window on the profile; a saved entry appears in the rail under "Saved" and one click reopens it.
- **The password never leaves the Host.** It is written to the plugin's secret vault — the same one the API workbench uses — and the profile record holds only its id. `db.connect` resolves the secret host-side, so neither the list, the client state nor any response ever carries it; `db.connect({profileId})` is the only path that needs it.
- Writes are revision-checked (a stale window cannot drop a newer profile), an empty password means "keep the stored one", and deleting a profile deletes its secret too.
- Regressions: profile round-trip, password absent from the record and resolvable host-side, keep-secret on update, keep-untouched fields, stale-revision refusal, delete removing both profile and secret, `db.connect` by id on a real SQLite file, and a profile id refused when the service is absent.

### gRPC reflection: no `.proto` required ([lib/host/grpc-reflect.js](<lib/host/grpc-reflect.js>))

- **Discover** asks the server for its own schema. The panel sends `list_services`, then `file_containing_symbol` per service, decodes the returned `FileDescriptorProto` set with a hand-written descriptor schema, and folds it into the same shape `proto.js` produces — so samples, the codec and the call path need no special case. `grpc.reflection.v1` is tried first and `v1alpha` second (what most servers still expose); a server without reflection reports that as a state instead of failing the call.
- The discovered schema is cached host-side and addressed by an id the panel passes back on invoke, so a reflection-based call needs no file on disk; an expired id answers "run Discover again" rather than guessing.
- Descriptor folding covers nested messages, enums, `repeated`, `map<>` entries (a repeated message with `map_entry` becomes a real map) and both streaming flags.
- Regressions: an in-process HTTP/2 server answering reflection end to end (service list, descriptor set, v1/v1alpha label, method list, sample body, schema id, expired id), and descriptor folding for nested types, maps, repetition, enums and streaming.

### Responsiveness and cancellation ([lib/host/db-worker.js](<lib/host/db-worker.js>), [lib/host/sqlite-ops.js](<lib/host/sqlite-ops.js>))

- **SQLite no longer blocks the Host.** `node:sqlite` is synchronous, so a slow statement used to freeze every other panel, tool call and session request for its whole duration. Each SQLite connection now lives in its own worker thread: the Host posts `{id, op, args}` and stays free while the query runs. The operations themselves live in `sqlite-ops.js`, shared by the worker and an inline fallback for runtimes without `worker_threads`.
- **A running statement can be stopped** (`db.cancel`, and the Stop button that replaces Run while a query is in flight). A CLI-backed connection survives (the child process is killed); a SQLite statement cannot be interrupted in place, so cancelling ends that connection and the panel says so instead of pretending the handle survived.
- **Driver detection actually finds the CLI**: `fs.access("mysql")` resolves against the current directory, never PATH, so MySQL/PostgreSQL were permanently reported as unavailable. Each PATH entry is now probed (with `PATHEXT` on Windows) and the answer cached.
- **CLI result parsing is faithful**: mysql's batch escaping is undone instead of `--raw` splitting rows on a newline cell, and psql runs with `--csv` plus an explicit NULL marker so a value holding a tab, a comma, a newline or an empty string keeps its meaning; a write statement's command tag becomes a change count.
- Regressions: worker mode reported, a long query leaves the event loop ticking, cancel ends both the statement and (for SQLite) the connection, `parseCsv` handles quoted commas, embedded newlines, doubled quotes and the NULL marker.

### Docs

- README (both languages) gains the two new panels in the entry table and two new screenshot rows; the preview script renders both from fictional fixtures (`readme-db-*.png`, `readme-rpc-*.png`) and now serializes `<textarea>` values so a static preview shows the SQL/message the panel really holds.

## 2.0.0 (2026-11-18) — Phase 2 & 3: Agent tools, DB panel, platform hardening

### Phase 2: Agent collaboration surface

- **Agent tools** ([lib/host/tools.js](<lib/host/tools.js>)): three new model-facing tools registered via `ctx.tools.register`. `api_request` sends HTTP requests through the same `api.send` pipe the UI uses (env-var substitution, auth folding, body truncation at 4 KiB for the model). `git_review` exposes read-only status/diff/branches/log/blame. `skills_manage` covers list/read/create/write/delete. All share the Host route table with the UI — one operation, two callers. Regressions: tool count and names, git_review status/diff/branches, skills_manage list, api_request with mock fetch.
- **.bru collection runner** ([lib/host/runner.js](<lib/host/runner.js>), [lib/host/routes.js](<lib/host/routes.js>)): `collection.run` reads every `.bru` file from the workspace collection directory in sorted order, resolves `{{var}}` from the active environment, sends each request sequentially, and applies post-response extracts to chain variables between requests. Skips hidden files and non-.bru entries; caps at 200 files / 256 KiB each. Regressions: sorted execution, skip non-bru/hidden, env-var resolution, per-request status/timing, total time.
- **Workspace-wide Problems panel** ([src/client/overlays.js](<src/client/overlays.js>), [src/client/code.js](<src/client/code.js>), [lib/host/routes.js](<lib/host/routes.js>)): ⇧⌘M now fetches `lsp.workspaceDiagnostics` which aggregates diagnostics across all open documents for every ready LSP server. The panel shows file paths alongside line:col and jumps to the correct file on click. Falls back to the current file's diagnostics when no servers are ready.
- **watch → LSP pipe** ([lib/host/watch.js](<lib/host/watch.js>), [lib/host/lsp.js](<lib/host/lsp.js>)): when the watch hub flushes a batch of file changes, it forwards `workspace/didChangeWatchedFiles` notifications to every ready LSP server on that root. gopls and typescript-language-server refresh their internal caches so diagnostics and symbols reflect Agent or terminal edits without waiting for the next manual file open.
- **AI commit message** ([src/client/changes.js](<src/client/changes.js>), [src/client/code.js](<src/client/code.js>)): the commit box gains a ✦ AI button that reads the staged diff and generates a conventional-commit summary. Currently uses a heuristic (file list + add/del counts); the `agent.inject` path is wired for phase 2.1 when the host exposes per-session agent handles to plugins.

### Database panel

- **Host driver layer** ([lib/host/db.js](<lib/host/db.js>)): SQLite via Node 24's built-in `node:sqlite` (zero dependencies); MySQL and PostgreSQL via their CLI clients (`mysql`/`psql`) when present on PATH. Routes: `db.drivers`, `db.connect`, `db.disconnect`, `db.list`, `db.query`, `db.connections`. SQLite connections use `DatabaseSync`; CLI adapters spawn per-query with tab-separated output parsing. All handles close on plugin unload. Regressions (Node 24): connect/disconnect, list tables/columns, SELECT/INSERT, limit/truncation, timing.
- **Client UI** ([src/client/db.js](<src/client/db.js>)): left rail for connections + schema tree (tables with column counts), centre SQL textarea with ⌘/Ctrl+Enter execution, bottom result grid with sticky headers, cell truncation, timing and truncation indicators. Connect dialog adapts fields per driver (SQLite: file path; MySQL/PostgreSQL: host/port/user/password/database). Registered as a left-navigation entry with a database-cylinder icon. Regressions: formatCell/truncateCell pure helpers.

### Phase 3: Platform hardening

- **Config schema** ([index.js](<index.js>), [cordis.patch.yml](<cordis.patch.yml>)): exported `Config` object declares six tunable fields (formatOnSave, liveRefresh, lspIdleMs, apiTimeoutMs, collectionDir, dbDefaultDriver) with types, defaults and descriptions. Users override via `cordis.patch.yml`; the schema validates at activation.
- **Host contract probes** ([test-contract.mjs](<test-contract.mjs>)): 14 assertions against the installed DSH app.asar verifying that sidebarRight.openTab/openTabFromTarget/isTargetCurrent/navigate-with-params, layout.setRightbar, desktop WebContentsView/shell.openExternal/will-attach-webview, and storageDomain package directory still exist. Run with `pnpm test:contract`. Catches silent seam breaks after DSH upgrades.
- **Optional minified build** ([scripts/build-client.mjs](<scripts/build-client.mjs>)): `DSH_MINIFY=1 node scripts/build-client.mjs` produces a 434 KB bundle (34% smaller than the 656 KB unminified default). Sourcemaps disabled in both modes to keep the single-file DSH module format clean. `pnpm build:min` shortcut added.
- **Persistence audit**: remaining localStorage keys are user preferences (formatOnSave, liveRefresh, side-by-side diff toggle) — small, global, and appropriate for localStorage. Session-scoped data (nav state, browser tabs, API drafts/history/favorites/envs) already uses per-workspace keys or the Host vault. No further migration needed.

### Test totals

All eight suites green: 226 host + 756 client + 35 browser + 30 search + 3 nested + 9 parent + 18 remote + 14 contract = **1091 assertions**.

## 1.6.0 (2026-11-18) — Phase 1: logic debt, edit-mode P0, and a real hover

This release closes the eight logic-layer defects identified in the architecture review, adds the three editor P0 pieces that were missing from the "IDE" claim, and converges 22 Unreleased sections into one tagged version. Every change ships with regression tests; all seven suites pass (206 host + 752 client + 35 browser + 30 search + 3 nested + 9 parent + 18 remote = 1053 assertions).

### Logic fixes

- **Keep-editing is no longer a dead end** ([src/client/code.js](<src/client/code.js>), [src/client/draftdiff.js](<src/client/draftdiff.js>)): when a file changed on disk while a draft was open, "keep editing" dismissed the banner but every subsequent save was refused by the `baseMtime` guard — the only exit discarded the draft. The conflict banner now offers **Compare with disk** (a pure LCS line diff of draft vs disk, rendered through the existing DiffView) and **Overwrite disk with draft** (two-step confirmation that drops the `baseMtime` guard). A refused guarded save re-raises the banner instead of looping on a toast. Regressions: identical texts report identical, single-line change counts correctly, distant changes split into separate hunks, huge pairs fall back to whole-replace without throwing, empty sides are pure add/delete, compare reads disk without writing, overwrite writes without baseMtime, refused save keeps the draft.
- **Hover is reachable** ([src/client/code.js](<src/client/code.js>)): the `doJump("hover")` branch, `hover` state, `.ce-hover` style and `hover.loading` locale key all existed but nothing triggered them. Resting on an LSP-backed identifier for 350 ms now asks the server for its hover document; moving to another token restarts the delay, leaving the code area cancels, and a nonce drops late answers. Keywords are not hovered. Empty answers render nothing. Regressions: no request before delay, request after 350 ms, tooltip renders server text, moving tokens hides stale tooltip, mouseleave cancels pending request, keywords skipped, empty answer shows nothing.
- **Plain click no longer fires LSP or pops a peek** ([src/client/code.js](<src/client/code.js>)): a plain click on any identifier used to concurrently fire definition + references requests and open a 720 px peek panel — selecting text to copy would trigger it. Now plain click only places the cursor (VS Code model); ⌘/Ctrl+click jumps to definition; the refs peek lives on ⇧F12 / hover / palette. Regressions: plain click fires no LSP request, plain click opens no peek, cmd-click still jumps.
- **API state is per-workspace** ([src/client/apiclient.js](<src/client/apiclient.js>), [src/client/apistore.js](<src/client/apistore.js>)): drafts, history, favorites, environments and collection directory were stored under five global localStorage keys — debugging project A's internal API left its URLs and Bearer tokens visible in project B's session. Keys are now scoped by session workspace (`cwd`), with a one-time migration from the legacy global keys into the first workspace that opens. Regressions: workspaceScope encodes safely, apiKey produces scoped keys, migration moves legacy stores once, second workspace does not re-migrate.
- **Secrets live in a Host vault** ([lib/host/vault.js](<lib/host/vault.js>), [src/client/apistore.js](<src/client/apistore.js>)): auth tokens/passwords and environment variable values were stored as plaintext in localStorage snapshots. They now live in a DSH `storageDomain` vault addressed by opaque `secret:<id>` markers; the client resolves them for display/send and writes new values back through the vault route. When the vault is unavailable the workbench degrades to inline values rather than losing data. Regressions: vault.set mints ids, vault.get returns plaintext, update-in-place works, delete removes entry, get-after-delete returns nothing, vault refuses after close.
- **In-fence symlinks are visible** ([lib/host/fence.js](<lib/host/fence.js>)): directory listing and read paths silently skipped all symlinks, making pnpm workspaces and monorepo package links invisible in the file tree. Symlinks whose real target stays inside the fence are now followed for listing and reading; escaping symlinks are still refused for write/delete. Regressions: fs.list shows in-fence symlinked directory, fs.read follows in-fence symlink, fs.write refuses any symlink, fs.delete refuses escaping symlink.
- **Skill roots align with the host** ([lib/host/skills.js](<lib/host/skills.js>)): the plugin used the session `cwd` directly for project skill roots, while the host's `dsh-skill-filesystem` provider resolves to the nearest git repo top-level. A session opened in a subdirectory saw different skills than the Agent. Project roots now resolve via `git rev-parse --show-toplevel`, matching the host. `owningRoot` also accepts `/private/tmp` ↔ `/tmp` equivalence on macOS. Regressions: skills.delete on symlink removes link only (macOS path fix).
- **Orphan localStorage keys are pruned** ([src/client/orphans.js](<src/client/orphans.js>), [src/client/index.js](<src/client/index.js>)): per-session navigation keys (`dsh.plugin-kit.v1.<sessionId>`) and browser sub-tab keys were never cleaned up when sessions were deleted, accumulating toward the ~5 MB quota. On startup the plugin reads the host's current session list and removes keys for sessions that no longer exist. Regressions: removes dead nav/browser keys, keeps live keys, leaves unrelated keys untouched, reports correct count, sets flag so it never runs again, empty live set prunes all.

### Editor P0

- **Edit-mode line gutter** ([src/client/editmode.js](<src/client/editmode.js>), [src/client/code.js](<src/client/code.js>)): the edit textarea had no line numbers. A synced gutter now renders one row per line at the same ROW height as the read-only view, scrolling in lockstep with the textarea.
- **Tab / Shift-Tab indentation** ([src/client/editmode.js](<src/client/editmode.js>)): Tab inserts a leading tab on every line touched by the selection; Shift-Tab removes a leading tab or up to four spaces. Selection range is preserved. Regressions: single-line indent/outdent, multi-line indent, space-to-tab fallback.
- **Find & replace in the textarea** ([src/client/editmode.js](<src/client/editmode.js>), [src/client/code.js](<src/client/code.js>)): ⌘F / ⌘⌥F opens an inline find bar with match count, next/prev, single replace and replace-all. Supports regex, case-sensitive and whole-word modes (same flags as the read-only find widget). Regex group references ($1, $&) use the native engine. Regressions: find all occurrences, case sensitivity, whole-word, regex mode, empty query, single replace, replace all, no-match passthrough, regex group refs.

### Build & docs

- **Single-instance README screenshots** ([scripts/render-readme-previews.mjs](<scripts/render-readme-previews.mjs>)): six Chrome processes → one headless instance over CDP; ~5.9 s total, no Dock flicker. Requires Node ≥ 22 (global WebSocket).
- **CHANGELOG convergence**: 22 Unreleased sections archived under this 1.6.0 tag.

## Unreleased — the workspace runs its **own** terminal

The embedded terminal this workspace used to open was DSH's, and its host renderer dropped row repaints while the pane was off-viewport: backspace left the deleted word painted on screen, and a powerlevel10k prompt redrew in half-finished frames. Two rounds of compensation (a synthetic-blur repaint, then a periodic one) were shipped and removed — they fought the renderer and made typing worse. The fix is to stop borrowing the screen: the plugin renders the terminal itself, over the process and stream DSH already provides.

- **Emulator, written here** ([src/client/vt/screen.js](<src/client/vt/screen.js>), [src/client/vt/width.js](<src/client/vt/width.js>)): primary and alternate buffers, scrollback, and the ANSI/VT parser the toolchain actually emits — cursor addressing and movement, erase/insert/delete, scroll regions, SGR (16/256/truecolor, bold/dim/italic/underline/inverse/strike), DEC line-drawing charsets, bracketed paste, cursor visibility and style, OSC titles, DECAWM wrap, DECSTBM. Sequences the parser does not know are consumed and ignored, which is the safe direction. Cell width follows East Asian Width, so Chinese, emoji and combining marks occupy the right number of cells. No dependencies.
- **Painter, written here** ([src/client/vt/render.js](<src/client/vt/render.js>), [src/client/vt/body.js](<src/client/vt/body.js>)): one element per row painted from a per-row version counter, one span per attribute run (not per cell), and a single positioned cursor element. Frames are fed to the emulator immediately and painted **at most once per animation frame**, so a burst of prompt-redraw chunks produces one diff instead of a half-drawn prompt. Measured in headless Chrome over CDP: 7.83 px cells at 13 px, an 81×13 grid, a coloured/wide-glyph row rendered correctly, and a typed command erased by six real backspaces with no leftover glyphs.
- **Input, written here** ([src/client/vt/keys.js](<src/client/vt/keys.js>)): keys become the bytes a VT sends (CSI/SS3 arrows with modifier parameters, function keys, editing keys, Ctrl+letter), characters come from a hidden textarea's `input` event so IME, dead keys and AltGr work, and pastes are newline-normalised and wrapped in bracketed-paste markers when the shell asked for them.
- **Process and stream stay DSH's** ([src/client/termtab.js](<src/client/termtab.js>)): a `kit-terminal` tab type (`multiple`, `keepMounted`) resolves a view from `ctx.webTerminals`, so the Host still spawns the shell, enforces the sandbox policy and quota, keeps the headless screen and serves the snapshot on reconnect. Close handlers release the process; `retainTabs` holds it while a tab exists — and because the product's own terminal package filters holds by its own kind, this module passes every terminal-like kind, so the last subscriber never drops the other's holds.
- **The system terminal remains** as a second action ([src/client/terminal.js](<src/client/terminal.js>), [lib/host/external-terminal.js](<lib/host/external-terminal.js>)): "Open in System Terminal" launches iTerm/Terminal (or the platform equivalent) detached in the session directory, for a remote shell or a GPU TUI.
- **Removed**: the host-repaint guard (`refreshHostTerminalScreen`, `installTerminalRefreshGuard`) — there is no borrowed screen left to repair — and the focus handoff that existed only for the borrowed terminal.
- Regressions: 30 emulator cases (text/CR/LF, backspace+EL, wrap, scrollback, SGR 16/256/truecolor, CUP, ED/EL, DCH/ICH, alternate screen, wide glyphs, combining marks, split sequences, snapshot replay, DEC graphics, resize, CR overwrite), 9 key-encoding cases, 8 renderer cases (span coalescing, trailing blanks, inverse video, escaping, palette, colour resolution), 4 frame-application cases, 8 component cases against a DOM shim (frame→rows, acknowledgement, erase repaint, key bytes, IME input, paste, focus, teardown) and 13 tab-registration cases (definition, capability probe, seats, close handler, hold union, hand-back).

## Unreleased — fix: the built-in terminal could not be typed into

Opening DSH's own terminal beside the workspace left the keyboard in the editor: the host focuses a terminal's xterm textarea only when its `visible`/`writable` state flips, and an open beside an already-focused pane can leave both unchanged — so keystrokes went to the workspace (or nowhere) instead of the shell. Three focus paths conspired, all fixed on the plugin side; the host terminal package is untouched.

- **Focus handoff on open** (`src/client/terminal.js`): after `openTab('terminal', {preferNewPane:true})` succeeds, `scheduleTerminalFocus` retries (120 ms, 3 s deadline, cancellable) until the newest live `[data-sidebar-terminal]` screen has a mounted `.xterm` and focuses its textarea. Hidden/detached/inert screens, read-only textareas and not-yet-connected shells are skipped, never forced; a failed open schedules nothing.
- **Escape belongs to the shell** (`src/client/dismiss.js`): the shared dismiss registry's document-level capture used to swallow every Escape while any transient layer (peek, palette, tab menu…) was open — including Escape typed into the terminal — and then restored focus to the editor. An Escape whose target sits in `[data-sidebar-terminal]`/`.xterm` now closes the layer as an *outside* dismissal without `preventDefault`/`stopPropagation`, so vim/fzf receive it and focus stays put.
- **No focus yank-back**: Escape dismissal restores the opener only while focus is still inside the closed layer (or orphaned on body/documentElement after its input unmounted). If an outside click already moved focus into the terminal, a later dismissal leaves it there.
- **Hidden tabs stay quiet** (`src/client/code.js`): `revealPosition` (Problems ⌘⇧M row, symbol-palette pick) returns early while the kept-mounted Code tab is not visible, so a background jump can no longer steal keyboard focus from the terminal pane; visible tabs keep the exact VS Code behavior.
- Regressions: focus handoff targets/skips (hidden, detached, no-xterm, disabled, missing doc), retry-until-connected, deadline stop, cancel, open-schedules/failed-open-does-not; terminal Escape reaches the shell while the layer closes, non-terminal Escape keeps guard + editor restore, outside-pointer and late-Escape never refocus the workspace; hidden-tab reveal jumps grab no focus while visible ones still do; favorite-dialog Escape restore updated to model the real autoFocus caret.

## Unreleased — Changes: delete untracked files (and stop the misleading revert error)

Reverting an untracked file was impossible, but the UI offered no alternative and a folder-level revert sent `U` entries into `git checkout HEAD --`, which answers with git's pathspec error — the banner users saw was `pathspec ':(literal)…' did not match any file(s) known to git`. Two separate problems: a missing destructive action, and a folder action silently mixing it in.

- **Per-row delete for untracked files** (`🗑` in Changes, tree and flat views) with its own two-step confirmation — a delete must never be one stray click, and its confirmation state is deliberately separate from revert's so the two cannot arm each other. Tracked rows keep `⟲` revert and still never show a delete control. An all-untracked folder gets a folder-level delete; a mixed folder does not (it keeps folder revert, while its untracked files stay individually deletable).
- Deletion goes through the existing fenced `fs.delete` route (the same one the Explorer uses), with git-status paths re-anchored on the repo root first; a deleted file's tab and buffer are dropped through one shared `forgetPath`, so no phantom editor survives to fail on the next save.
- `git.discard` now refuses `ch:"U"` up front with `untracked: true` and a reason that says why, instead of leaking a git pathspec error that reads like a plugin bug. Folder revert skips untracked entries and reports the skipped count (`{n} 个未跟踪文件无法回退——请用删除按钮`).
- Regressions: host — untracked discard refused with its explicit reason and the file left intact, tracked revert still works, `fs.delete` removes the untracked file through the fence; client — delete only on untracked rows, revert kept on tracked rows, all-untracked folder offers folder delete while a mixed folder does not, arming deletes nothing, the confirm control appears after arming, and confirming deletes exactly the armed file.

## Unreleased — API: collections live on disk (a folder of .bru files)

- The request workbench gains a **collection folder** (workspace-relative, remembered per profile): two host routes make it real. `collection.load` walks the directory recursively (≤200 entries), keeps only `*.bru` outside hidden path segments, caps reads at 256 KiB, and refuses escaping the workspace; `collection.save` writes `<name>.bru` — names with `/`, `..` or leading dots refused, existing directory required (no silent mkdir), fence-checked, optional `baseMtime` for reload-before-overwrite honesty.
- Loading parses every file with the same brucol reader the import dialog uses and lands the entries **into favorites** (deduped by name); saving a favorite can mirror it to the folder with one checkbox (serialized BEFORE the write, so a serializer failure cannot leave favorite and disk out of sync; the write error blocks the favorite row rather than diverging the two stores). The settings tab holds the folder field + ⇪ load action; without a session workspace the affordances disable with an explanation.
- Bugs the regression earned its keep for: `readFile` was never imported in routes.js (a swallowed ReferenceError made the walk return an empty list); `requestToBru` was called from the workbench without being imported; and load auto-opening the saved panel made the import row unreachable — load now answers with a quiet count note in the import dialog instead.
- Regressions: host — recursive walk with nested paths, hidden/non-bru skipping, escape refusal, save creates/round-trips through load, path-shaped names refused, missing directory refused; client — settings-folder → load → favorites rows with their .bru meta names, checkbox-gated write carrying cwd/dir/name/text, favorite row added alongside.

## Unreleased — API: live SSE/EventStream responses

- `api.send` no longer buffers forever on `text/event-stream`: when the response announces an event stream, the live body is handed to a new host capture (`lib/host/streams.js`) and the send answers immediately with `{streaming:true, id, status, headers, ...}`. The capture keeps a bounded 1 MiB retained tail with a byte cursor and the same long-poll protocol as watch/tasks (`api.streamPoll`, `api.streamStop`); a dead client's closed response releases its waiter, finished captures expire after ten minutes, the job cap evicts finished streams before ever clobbering a live one, and everything aborts on plugin unload.
- Client `src/client/sse.js` (pure): WHATWG-shaped incremental frame parser — partial frames held across deltas, multi-line `data:` joined, `event`/`id`/`retry` carried, comment keep-alives skipped, CRLF tolerated, `id` persists across frames; `foldStream` folds poll snapshots into the view model with reset-on-evicted-cursor semantics and a 2000-event window.
- The response pane grows an **Events tab** while a stream is live: one row per event (kind glyph-color chip, `#id`, retry, first-line data with 120-char trim), auto-scrolling, "waiting for server events…" while idle, drop-marker when early events were evicted, a Stop button in the status row, and the tab count live-updating (`事件流 · 5 ●`). A subsequent normal send stops the old capture first. Extracts and timeline still run for non-streaming responses; a streaming send records history without a body.
- Fixes caught by the own-suite on the way: the first payload object used to be assembled with a spread order that let the snapshot's empty `done:false` mask the real status fields, `trimStreams` counted the just-created stream against its own cap, `stream.snap` was assembled in three inconsistent ways (closure/call/this), the timeout beat returned a bare `beat:true` without current state, and the pump's `!reader` fallback assumed `response.text()` exists.
- Regressions: host — real-HTTP server end-to-end (switch to capture, frames streamed until close, unknown-stream refusal); client — parser partial/complete/multi-line/CRLF/comment/id-persistence, fold hold/emit/reset, ApiView streaming send tab switch and per-event rows with kind and data.

## Unreleased — API: post-response extracts, OpenAPI & Postman collection import

- **Extracts tab**: each request carries rules `{name, source, expr, enabled}` with six sources — JSON path (`$.data.items[0].id`, a dot/bracket walker with quoted-key support, no wildcard engine on purpose), response header (case-insensitive), status code, full body, regex capture (group 1 else group 0), and the resolved request's own query. After every settled send `applyExtracts` writes hits into the ACTIVE environment (creating/overwriting rows by name) and reports misses in the tab footer (`uid · gone not found`); an all-miss run never half-writes empty variables, and with no active environment the tab says so instead of silently dropping. Rules ride drafts, history and favorites through the existing v2 snapshot (legacy snapshots normalize to no rules).
- **Collection import in the same dialog that already eats curl and .bru**: `openimp.js` detects pasted JSON as OpenAPI 3 (`paths × methods` → one request per operation: servers[0] + `{param}` → `:param` path rows + query params with examples, first-content-type bodies sampled from `example ?? schema` one property per type, names from summary/operationId) or Postman v2 (`{info.schema collection}`, folders flattened recursively, raw/urlencoded/formdata bodies, query-object URLs). Imports land as **favorites in bulk** (deduped by name against existing favorites, capped) with the first operation applied to the editor; malformed or empty collections surface through a real in-dialog error line (`setImportError` now actually declared and cleared on retype).
- Two correctness bugs caught by the own-suite: `runExtract` no longer demands an expression for the status source, and `postmanUrl` referenced an undeclared binding on object-shaped URLs.
- Regressions: jsonPath walk/miss/quoted-key, every source of runExtract including broken-regex and non-JSON refusal, applyExtracts write+miss+disabled-rule+all-miss-no-write (host-store level), OpenAPI three-operation spec (path-param syntax, query examples, sampled JSON body, form path), Postman folder flatten + urlencoded mapping, shape-detection refusals, the extracts tab render/round-trip (add → name/expr hold → remove empties), OpenAPI import applying the first operation and storing every favorite.

## Unreleased — task runner: run package.json scripts, click a failure, land in the file

- Host `lib/host/tasks.js`: jobs launch `npm run <script>` with no shell, gated twice — the name must be shape-clean AND present in the workspace's own package.json `scripts`, so a hand-built request cannot smuggle a command. Output streams into a per-job ring buffer (1 MiB tail, `dropped` + byte `baseSeq` when the head is evicted); `task.poll` long-polls new bytes with the same cursor protocol as `watch.poll` (response-close drops waiters, `beat` empty answers keep the pipeline warm), `task.kill` SIGTERMs then SIGKILLs after a 3 s grace, jobs are capped at 12 with a 10-minute TTL once finished, and everything dies with the plugin effect. `task.scripts` also reports which scripts are currently running so the palette shows live dots.
- Client: the Command Center's **Run Tasks…** opens a script palette (name + command + running marker), starting one swaps to an output panel that streams the tail auto-scrolled, distinguishes stdout from stderr, and reports running / exit-code / failure status. `failureAt` recognises go-test, tsc, eslint-colon, pytest-frame and rustc-arrow shapes and renders those lines as jump buttons into the editor; `foldTaskOutput` (pure) folds a poll snapshot into the panel state, honouring `reset` (buffer head evicted → replace the window) and byte cursors otherwise.
- Correctness caught in its own regression: two poll answers can land before a repaint, so folding happens INSIDE the state updater (prev is the truth, not a render-time ref) — and the fold must carry the job identity fields (script, pollSeq) through, or the next answer is silently rejected as stale.
- Regressions: host — scripts listing, absent-script and flag-shaped refusal, a real npm run streamed across polls with stdout/stderr split, exit code 3 surfaced, kill-on-finished reporting already, unknown-job refusal, SIGTERM path on a live job (npm-gated, skips cleanly where npm is absent). Client — every failure grammar plus noise refusal, fold append/reset/lineCount, palette rows and running dot, jump button wiring, stop affordance and its disappearance on completion, dropped-tail badge, and a CodeBody end-to-end: command → scripts → run → start → pump folds streamed chunks then stops at done with the exit code.

## Unreleased — Git deepening: compare refs, cherry-pick, conflict sides

- **Compare References** (Command Center `≷`): a dialog with base/head fields fed by the live branch list (local then remote, click-to-fill); submitting runs a new read-side `git.compare` route that verifies both refs through `rev-parse --verify --end-of-options` (flag-shaped and unknown refs refused before any git process spawns), diffs the two trees (`--name-status -z`, renames threaded through as `{from,to}`), and reports shortstat + commit count. Results land as a dismissible group on the Changes panel; each row opens a per-file diff through the new `scope:"compare"` of `git.diff`, and live watch refreshes an open compare diff exactly like a working diff.
- **Cherry-pick from history**: each commit row in the branch-commits list gains a `⤵` control with the repo's established two-step confirmation (first click arms to ✓, second picks). The write-side `git.cherryPick` route refuses non-hex shas before spawning, requires a clean tree with a human-readable reason, and treats the sequencer state — not git's exit code (conflict text on stdout defeats the ok heuristic) — as the authority: conflicts come back as `{conflicted:true}` with the updated status.
- **Conflict resolution UI**: when the host reports `inProgress` (cheap `.git` marker probes for CHERRY_PICK_HEAD / MERGE_HEAD / rebase-merge / REVERT_HEAD added to gitStatusAt), the Changes panel opens a sequencer banner listing the UU files, each with **ours / theirs** buttons routed through `git.resolve` (checkout --side + auto-stage, fenced like every git write), plus **Continue** (`--continue --no-edit`) and **Abort** for the whole sequencer. Busy state disables all sequencer controls to stop double-submits.
- `parseNameStatusZ` matches git's real `-z` layout — status and path are SEPARATE NUL fields (`R100\0from\0to\0`), caught by its regression on day one.
- Regressions: host — compare file list with rename status, merge-base/shortstat/count, unknown-ref and flag-injection refusal, compare-scope file diff, conflicting pick opening the sequencer, non-hex refusal, resolve-theirs content + staging, unknown side refusal, continue producing the cherry-picked commit with the original subject, re-conflict + abort cleaning the tree, sequencer kind whitelist, name-status NUL layout. Client — banner with both side buttons wired to callbacks, pick arm/confirm two-step, compare group rows with refs threaded to `onOpenDiff`, dismiss control, and the full CodeBody flow command→dialog→branches→compare→panel→diff→DiffView.

## Unreleased — editor productivity: workspace symbols and format-on-save

- **Search Symbols in Workspace** (`⌥⌘O` or Command Center): a new palette queries `workspace/symbol` through the existing per-root language servers (gopls / typescript-language-server / pyright) with a 220 ms debounce and a local seq guard so slow answers can never land over a newer query. Rows show the kind glyph, `name · container`, and the workspace-relative file:line; picking a row opens the definition with the normal navigation stack and match flash. Without an open document the route probes the workspace root for the first language marker (`go.mod`, `package.json`, `pyproject.toml`…), so the command works before the first file is opened. The client declares `workspace.symbol` (incl. `resolveSupport.properties: ["location.range"]`) in the initialize capabilities; symbols without a resolvable location are dropped rather than shown dead.
- **Format On Save** (default on, toggle persisted): saving a Go/TS/JS/Python draft now routes through `fs.formatDraft` — the draft is written through the existing `baseMtime` conflict guard first, the server formats what is on disk, and the formatted text is re-written and adopted into the editor buffer. The save notice distinguishes *Saved and formatted* from *Saved (formatter did not run)*; a formatter crash or timeout NEVER loses the save — the draft is already on disk and the reply carries `formatted:false` with the reason. A plain `fs.write` path stays untouched for non-LSP files and when the toggle is off.
- `applyTextEdits` (host, exported and unit-tested) converts LSP UTF-16 ranges to absolute offsets and applies right-to-left, clamping ends past EOF and defensively skipping overlapping edits; `textDocument/formatting` capability declared in initialize.
- Regressions: right-to-left multi-edit application, overlap skip, EOF clamp; workspace-symbol fuzzy query through the real gopls, marker probing without a document hint; `fs.formatDraft` writes-then-formats (disk content equals the returned text), advances mtime, refuses blind overwrite via `baseMtime`, and leaves the file intact on a refused format; client palette open→debounce→request→state rows→pick opens the definition; save routes a `.go` draft through `fs.formatDraft` with the guard and adopts the server-formatted text.

## Unreleased — live refresh: the workspace follows the disk

The Dev Workspace used to show the disk only as of the moment it loaded a file — an Agent editing in the background, a `go fmt` from the terminal, or a `git checkout` left the editor, tree and Git badges frozen until the manual ⟳. Now the host watches the workspace and streams coalesced change batches to every open workspace tab.

- Host `lib/host/watch.js`: one recursive `fs.watch` hub per resolved workspace root (shared by all sessions on it), events coalesced per path into monotonic batches on a 250 ms debounce; everything under `.git/` collapses into a single git tick because consumers only need "status changed". A retained log answers each client cursor; cursors older than what the log keeps get `reset:true` instead of a misleading partial list. New route `watch.poll` delivers batches by HTTP long-poll over the existing private-prefix JSON API — no new transport, bounded wait beats back so dead clients self-heal; response-close drops waiters, idle hubs are swept after five minutes, everything closes on plugin unload. Platforms without recursive watching (or with exhausted descriptors) degrade to `supported:false` rather than pretending.
- Client `src/client/watch.js`: `parentDirs`/`docAction` are pure folding helpers; `createWatchLoop` is the poll state machine — one baseline cursor per mount, capped error backoff, slow retry so a transient watcher failure heals itself. CodeBody folds batches into every surface: clean documents reload in place with cursor and scroll preserved (one merged `fs.read` per change, mtime-equal touches are dropped), the file tree refetches only the directories whose listings are actually shown without collapsing anything, an open working/index diff refetches its text, and git status refreshes through a debounce timer.
- **A dirty draft is never auto-discarded.** When the changed path is the open document and an unsaved edit exists, the banner offers the VS Code choice instead: Reload (discard draft) or Keep editing — the ⌘S `baseMtime` guard keeps blocking blind writes throughout, and live refresh never issues a host write on its own.
- Command Center gains **Toggle Live Refresh** (persisted, default on) and the panel warns once when the platform cannot watch, so manual ⟳ stays the honest fallback.
- Regressions added: host — baseline cursor, missing-cwd and missing-workspace errors, created-file delivery, per-path coalescing, `.git` ticks staying out of file paths, settled-cursor empty beats, and the pure `snapshotFor` cursor math (retention reset, per-path slicing, git flag, not-ready, unsupported). Client — loop state machine (baseline, streams, backoff, unsupported retry, stop), plus a full CodeBody lifecycle: exactly one baseline per mount, clean reload in place with cursor/scroll preserved, stale-dir invalidation, debounced git refresh, banner-without-buffer-touch for dirty drafts, no extra read on the conflict path, both banner round-trips (keep editing / reload discarding), and "live never writes".

## Unreleased — right sidebar opens at its maximum width

- The host seeds the right column's width preference at **45% of the frame** on its first opening (`RIGHTBAR_DEFAULT_RATIO` in `@deepseek-ai/dsh-client-ui-layout`), which is too narrow for an editor, an embedded browser and a request workbench. `rightbarwidth.js` now writes the preference once before any opening, so the **first opening takes the widest the frame allows** — the same ceiling the drag handle stops at (`[300px, 70%]` plus the frame's 400px centre reservation). The request is deliberately above the ceiling rather than a copied ratio, so the host keeps ownership of its own maximum.
- Dragging is unchanged and still wins: the handle writes the host store directly, and once a gesture settles the rendered track is measured and remembered (the host preference is in-memory only), so a later opening — including after a reload — restores the width the user chose instead of jumping back to the maximum. The ceiling is a fraction of the frame, so widening the window before that first choice moves the pending maximum with it; a panel already on screen is never re-widened under the user.
- The width action lives on the layout service's internal store delegation, not on the published `ILayout` face, so the whole feature is a probe: without a callable `setRightbar` it installs nothing and the host's stock behavior is left untouched.
- Added regressions: seam probing without assuming the seam exists, ceiling request landing on the host's clamped maximum, a remembered width restoring the first opening, junk/below-floor stored values ignored, a settled drag remembered only for the rightbar handle and only when a track is rendered, the measurement deferred until the gesture settles, the ceiling tracking a wider window before any choice, an already-chosen or already-visible panel left alone, and unload unhooks both listeners.

## Unreleased — copy-path feedback at the click site

- Copying a path from Changes (tree and flat views, including deleted files) or the Explorer row actions now flips the button glyph to a green check for ~1.4 s, with the title swapping to "Path copied". The previous success notice only reached the Code view's status bar and was easy to miss next to the rows — the click site itself stayed silent. Explorer context-menu copies flash the same row glyph after the menu closes.
- Failures keep reporting through the error notice and never show the check, so the feedback cannot fake success. The button clears its timer on unmount.
- Added regressions: success flips glyph/class/title and writes the expected absolute/relative text, failure keeps the copy glyph, and the Explorer row action flashes ✓ plus notifies.

## Unreleased — source-studied refinements from the Bruno and VS Code repositories

Both upstream repositories were cloned locally and read at the source level; the following behaviors are ported from their actual implementations rather than from documentation summaries.

- **Bruno path params**: `:name` segments in the URL path become rows in a second Path Params table inside the Params tab. The editor URL keeps them literal; enabled values substitute (URL-encoded) into the wire URL at send time, exactly like Bruno's `interpolateUrlPathParams` (`packages/bruno-app/src/utils/url`). Unresolved segments stay literal.
- **Bruno sync fidelity**: `syncParamsFromUrl` now follows the collections reducer (`ReduxStore/slices/collections`): disabled query rows survive URL edits (re-joining when re-enabled), path rows keep their values across URL changes, and vanished `:name` segments drop their rows.
- **Bruno `.bru` collection interop**: new `brucol.js` speaks a compatible subset of the v2 grammar (`packages/bruno-lang`: `meta{}`, method block, `params:query`/`params:path` with `~` disabled prefixes and quoted keys, `headers{}`, `auth:basic`/`auth:bearer{}`, indented `body:<mode>{}` blocks with column-0 `}` terminators, unknown blocks skipped). The import dialog auto-detects `.bru` documents next to curl, and the Code menu gains a **Bruno · .bru** entry that exports the request with `{{var}}` templates verbatim — the property that makes Bruno collections Git-friendly.
- **VS Code preserve-case replace**: the replace row gains the `AB` toggle; the replacement case pattern is ported from `base/common/search.ts buildReplaceStringWithCasePreserved` (ALL-CAPS / all-lower / capitalized / mirrored, per hyphen- and underscore-segment). Like VS Code it only applies to static replacement text, not `$`-group patterns.
- **VS Code current-match highlight**: while the find widget is open, the active match gets a solid highlight (token runs are split at the match range) and a distinct gutter color, separating it from the other matches.
- **VS Code sticky tabs**: the tab context menu pins/unpins; pinned tabs move to the front of the strip and survive Close Others / Close to the Right / Close All (`excludeSticky` in `editorActions.ts`), while an explicit single close still closes them. Pins persist with the session navigation state.
- **VS Code problems filters**: the Problems panel header shows per-severity counts with error/warning/info toggles (markers view filter model), reporting shown/total while filtered.
- Regressions added for all of the above: preserve-case matrix and per-match application, path-param sync/substitution/wire resolution, disabled-row retention, `.bru` round-trips (raw/form/multipart/auth/quoted keys/unknown blocks), pin ordering and bulk-close exclusion, current-match highlighting, and severity filtering.

## Unreleased — Bruno-style API request workbench

- The curl tool now follows [Bruno](https://github.com/usebruno/bruno)'s request model: **URL ↔ Query-params two-way sync** (typing `?a=1` in the URL fills the Params table; editing the table rebuilds the URL, disabled rows leave it but keep their values), **named environments** with a tool-row selector and Bruno's "No Environment" state (the legacy flat variable list migrates into one active *Default* environment on load), a dedicated **Auth section** (None / Bearer / Basic) that generates the `Authorization` header at send time and overrides a same-named manual header, a response **Timeline** tab showing the exact resolved wire request (post-substitution URL, final headers, body/multipart, timeout) next to Body and Headers, and a **</> Code** menu generating runnable **curl / JavaScript fetch / Python requests** snippets from the resolved request.
- curl import hardened toward curlconverter (the parser Bruno uses): `$'ANSI-C'` quoting, attached short-flag values (`-XPOST`, `-H'K: V'`, `-d'{}'`), `--flag=value` long forms, `--form-string`, `--url-query`, curl's empty-header form (`-H 'Name;'`), `-u` and `Authorization: Bearer/Basic` headers folding into the Auth section (undecodable values stay headers), and consecutive `k=v` data chunks without a non-form Content-Type importing as **form-urlencoded pairs** instead of a raw body. Imported raw bodies pick their language (json/xml/html/text) from the Content-Type or a shape probe. Export emits `-u` for basic auth and an `Authorization` header for bearer, so `toCurl → parseCurl` round-trips the auth section.
- Architecture: request-data logic moved out of the 571-line component into two pure modules — `reqmodel.js` (sync, environments, auth, `resolveRequest` as the single builder shared by wire/Timeline/codegen, history helpers) and `codegen.js` (snippet serializers) — leaving `apiclient.js` as UI wiring only; drafts and history/favorite snapshots carry `v: 2` and legacy snapshots are normalized (old send-time param merge) on restore.
- Added regressions for tokenizer/quoting/attached flags, form & auth import, export round-trips, both sync directions and their stability, environment migration/selection/rename/delete, auth override semantics, resolveRequest substitution, all three generators, and component flows (query sync, environment switching driving `{{host}}`, Timeline content, bearer/basic wire headers, codegen clipboard, curl import mapping); updated the `-u` and `-d k=v` parser expectations to the new Bruno-style shapes.

## Unreleased — VS Code editor ergonomics

- Dev Workspace adopts three [VS Code](https://github.com/microsoft/vscode) editor workflows: an **editor-tab context menu** (Close / Close Others / Close to the Right / Close All, with disabled states and the existing dirty guard), **Reopen Closed Editor** (`⌘/Ctrl+Shift+T`, a bounded most-recently-closed stack restoring cursor position), **find & replace** (`⌘/Ctrl+Alt+F` or the find widget's ⇄ toggle: Replace / Replace All with regex `$1`/`$&` expansion; results land in the edit buffer for review and save through the existing ⌘S mtime conflict guard — never written blindly), and a **Problems panel** (`⇧⌘M` or the diagnostics chip: severity-sorted diagnostics, click to jump to the line).
- The Command Center gains Find and Replace, Toggle Problems, Reopen Closed Editor and Close All Editors entries, keeping keyboard and pointer workflows equivalent.
- Architecture: tab-list transitions (`tabs.js`) and the replace splice (`codeview.js applyReplace`, right-to-left per line with stale-match refusal) are pure functions; `ProblemsPanel` joins the shared overlays and dismissal registry.
- Added regressions for close-others/right/all through the real menu, MRU reopen ordering, replace-one/replace-all/regex-group replacement, edit-buffer-only writes, problems open/jump/Escape, and command-center contents, running the workbench with effects enabled.

## Unreleased — terminal entry beside the workspace

- Dev Workspace now opens DSH's own terminal beside itself: a **New Terminal** button in the toolbar tool group and a Command Center entry of the same name call `ctx.sidebarRight.openTab('terminal', { preferNewPane: true })`, so the terminal splits the current docked pane under the host's two-pane and room rules and falls back to a tab in that pane. A successful open also clears a stale error banner.
- The plugin renders no terminal of its own. xterm.js, input ownership, window holds, reload bindings, theme and the permission model stay with `@deepseek-ai/dsh-client-ui-sidebar-terminal` and `@deepseek-ai/dsh-api-terminal-controller`, so a DSH upgrade cannot strand a second terminal implementation here.
- Availability is a registry probe, not a guess: profiles without the `terminal` tab type hide both entry points instead of showing a control that fails. Missing session, missing capability and a failed open each report their own banner text. The result is trusted from the host rather than inferred by diffing the tab list, because the `terminal` type is `multiple: true` and every open is a new instance.
- The host's **New terminal** row is folded out of the left navigation (`LEFT_TOOL_HIDDEN_KINDS`), following the one-primary-entry rule already applied to file browsing: Dev Workspace owns the terminal entry. The global `⌃` shortcut is untouched, so a terminal stays reachable without opening the workspace. A restored selection for a folded-away tool hands the main panel back to Conversation instead of stranding a blank page. README documents that terminal commands run with system-user permissions, outside the Agent's sandbox and approval policy.
- Added terminal-entry regressions for the registry probe, hidden/unavailable path, split preference, trusted success, missing session, open failure, hostile registry, inert fallback, and zh/en dictionary parity; added left-navigation regressions for the folded terminal row and stale-selection recovery, and moved the multi-instance close semantics onto the remaining multi-instance tool.
- Verified syntax, full regressions and the host contract (`preferNewPane`, `openTab`, `mounted`). Authenticated live visual inspection remains unavailable in this environment.

## Unreleased — refined browser chrome

- The browser tab is now a window with its own sub-tab strip: every sub-tab owns a carrier (Desktop webview guest / Web iframe), address history and title; the strip switches, closes per tab and adds tabs with + (new tabs follow the configured start page). Desktop keeps every guest resident; Web keeps only the foreground page alive and restores the others from the per-window checkpoint. Page popups (`window.open` / `target=_blank`) open as background sub-tabs; the host strip keeps the fixed browser label while page titles live on the sub-tab chips. Legacy single-page checkpoints migrate into a one-tab window; up to 10 sub-tabs per window.
- Grouped back/forward/reload controls and secondary tools around a prominent address field, with bookmark and Go actions inside the field.
- Replaced character glyphs with consistent SVG icons, added selected tool states and local Cmd/Ctrl+L address focus, and replaced the loading text row with a reduced-motion-aware progress line.
- Refined bookmark/settings hierarchy and empty states; narrow panels use a predictable two-row toolbar. Rendering remains owned by the existing DSH carrier.
- Verified syntax, full regressions and UI rule scan. Authenticated live visual inspection remains unavailable.

## Unreleased — copy paths from Changes

- Added accessible copy-path actions to file and directory rows in Changes tree and flat views, covering staged, working and branch changes, including deleted files. Click copies an absolute path; Alt-click copies the repository-relative path.
- Paths resolve against the Git repository root for nested/multiple repositories. Clipboard errors surface instead of reporting false success.
- Split Changes row navigation and actions into sibling controls, preserving drag handles without nesting buttons.

## Unreleased — reliable file-tree deletion

- Split Explorer row navigation and action buttons into sibling controls, removing nested interactive buttons.
- Deleting a file or folder now shows a named confirmation below the row, independent of hover actions. Confirming shows progress and refuses duplicate requests; failures remain visible for retry.
- Added file/folder cancellation, confirmed deletion, duplicate prevention, failure feedback and editor notification regressions.

## Unreleased — Explorer and Changes file dragging

- Added typed internal drag data for Explorer, Changes tree/list and editor tabs, scoped to the workspace and Session.
- Drop Explorer files into the editor to open source, or Changes files to view their captured repository/scope diff, including deleted files. Editor tab drags reorder views without moving files.
- Explorer folder moves retain their existing disk-move behavior. Plain text, OS files, directory-to-editor and foreign-session drops are not accepted; unsaved edits remain protected.

## Unreleased — embedded browser bookmarks and settings

- Added an enhanced Browser page using the DSH lease-scoped Desktop browser bridge (restricted iframe fallback on Web), without bundling another browser engine. Native history, approved popups, Workspace storage isolation, explicit page restore and system-browser escape remain available.
- Added profile-persistent bookmarks, favorites bar, folders, search, edit/delete, home URL and new-tab start settings. Host persistence serializes writes and rejects stale revisions; UI and `browser_bookmarks` use the same service.
- Settings accurately explain that DSH currently exposes no Chrome extension install/enable/configuration API.
- Added browser regressions for URL policy, durable data, conflict/retry behavior, guest acquisition/disposal/crash recovery, requested URL preservation, Workspace partitioning and UI settings flows.
- Verified real Host browser-data initialization; live authenticated Electron page rendering and extension support remain outside automated verification.

## Unreleased — left tool entries toggle workspace tabs

- Left entries now close an already open matching tool tab. The last real tool tab also collapses the right workspace; retained guide tabs do not keep it open. Other tools and other sessions remain untouched.
- A manually collapsed workspace is revealed before any close. With multiple matching instances (such as terminals), the active matching instance is closed first. Browser pages can reopen immediately after a toggle close.
- Registered native close cleanup guards for unsaved Code IDE and Skills edits, protecting both left-entry closes and native tab closes.
- Added toggle, final-tab, session-isolation, multi-instance, immediate-reopen and unsaved-close regressions.

## Unreleased — left navigation, right workspace

- Moved all toolbox entry points into native left panel rows alongside Plugins and Automations. Selecting a tool restores Conversation and opens the current session’s right workspace through public layout/sidebar services.
- Removed owned right guide entries and replaced the duplicate right launcher with a workspace hint. Browser/terminal and other registered tool entries follow the live registry; browser reuse now reveals a collapsed workspace.
- Added regressions for global-panel navigation, current-session targeting, no-session feedback without delayed cross-session opens, dynamic tools and unload cleanup.

## Unreleased — consistent transient-layer dismissal

- Added one shared, non-modal pointer/Escape dismissal registry for API dialogs, IDE palettes, file menus, skills forms and temporary destructive confirmations. Outside pointer events continue to their destination; Escape affects only the top visible layer, with IME protection and listener cleanup.
- Favorites and curl import retain drafts when dismissed. Tool-page hiding closes transient UI without cancelling document edits. Trigger buttons toggle without reopening accidentally.
- Fixed duplicate input/palette keyboard handling in quick open and symbol lists, and duplicate trailing insert rows in legacy request drafts.
- Added listener-lifecycle and component regressions plus 9 Chrome fixture checks using actual DOM pointer/keyboard events. See [interaction audit](docs/interaction-audit.md) for coverage and verification limits.

## Unreleased — API request builder layout

- Reorganized API debugging around a method/URL/Send row followed by configuration tabs; import/export, favorites and history remain in a compact utility row.
- Added a shared request-fields table for query parameters, headers, form/multipart bodies and environment variables, with Name/Value/Description columns, enable checkboxes, row deletion and a trailing insert row. Variables are now a configuration tab.
- Disabled fields remain in drafts/history/favorites but are excluded from HTTP requests and curl exports. Old rows without an enabled flag stay enabled.
- Verified 452 assertions across all suites; checked light/dark component previews at 1100px and 390px container widths. These previews use fixture data and do not represent a live authenticated DSH session.

## Unreleased — consistent editor navigation

- Opening files, Git diffs, commits and chat diffs dismisses transient panels so search cannot cover the selected document. Clicking the current editor tab also dismisses panels without reloading the file.
- Search, quick open and the command center replace each other. Search inputs survive dismissal; Escape closes navigation panels before cancelling an editor draft.
- Centralized unsaved-edit checks protect file navigation and refresh. Added regression coverage for file clicks, retained queries, panel switching, Git navigation and draft protection.

## Unreleased — unified Dev Workspace

- Merged the primary file browsing and code editing entry into **Dev Workspace / 开发工作台**. The existing Code IDE `TreePanel` is now the launcher’s single primary workspace explorer, with file operations, previews, search, editing, LSP and Git review in one context.
- The Start launcher filters the host’s redundant `files` guide entry to avoid presenting two competing workspace file browsers. The host file page remains available through host capabilities for compatibility.
- Renamed the in-workspace Files control to **Explorer / 资源管理器**, clarified launcher grouping, and added a regression test that prevents the duplicate file entry from returning.

## Unreleased — Code IDE command center

- Renamed the Code Explorer surface to **Code IDE / 代码 IDE** across the launcher, tab metadata, locale and package documentation.
- Added a keyboard-first Command Center (`⌘/Ctrl+Shift+P`) that unifies file browsing, source control, workspace search, quick open, current-file symbols, word wrap, side-panel visibility and refresh. Actions reuse existing handlers so navigation state and concurrency guards remain consistent.
- The interaction direction follows the continuous workbench model documented by [VS Code’s user interface](https://code.visualstudio.com/docs/editing/getting-started/userinterface) and [code navigation](https://code.visualstudio.com/docs/editing/editingevolved): one editor context, discoverable commands, breadcrumbs/symbols and source control close to the file.

## Unreleased — browser launcher reuse

- The toolbox Browser launcher now focuses an existing browser in the on-screen session, including older UUID-backed tabs, instead of always creating another page. Existing navigation is preserved; Doubao is only the initial URL when creating a new page.
- Repeated clicks before the sidebar inventory updates are suppressed. Reuse does not cross sessions or close existing pages.
- This change belongs to the plugin launcher; links that explicitly open a new browser page and Chromium renderer processes retain their host behavior.

## Unreleased — scoped code search

- Files search the workspace by default, with an explicit directory field and a folder context-menu action.
- Changes keep filename/path filtering separate from code-content search. Content search derives staged, unstaged and untracked files on the Host; empty changes do not widen to the workspace, deleted files skip, and glob filters only narrow the set.
- Literal Git filenames, nested selected repositories, result batching, and stale scope response handling have regression coverage. Search labels show the active scope.

## Unreleased — task-oriented layouts

- Code: full-width list/editor navigation below 620 px, retained document state on Back, search and quick-open grouped in the rail.
- Changes: review files before expanding the commit composer; branch history becomes a disclosure and expands for filtering.
- API: independently scrolling request/response panes with a draggable, keyboard-accessible separator and reset.
- Skills: descriptions and installation paths are disclosed on demand so instructions appear sooner.
- Added layout interaction regression coverage and light/dark, narrow/wide component preview checks; details and examples are in `docs/ui-system.md`.

## 1.5.0 (2026-11-11)

### Changed — unified UI system

- Added a cohesive visual foundation across Code Explorer, Changes, API Tester, Skills Manager and the Start launcher: three surface levels, consistent border/radius/spacing tokens, clearer foreground hierarchy, one interaction accent, and semantic success/warning/error colors.
- Standardized toolbar, segmented controls, inputs, tabs, chips, primary buttons, focus rings, empty states, overlays and response/code surfaces for both light and dark DSH themes.
- Improved the Code and Changes rails with clearer active states, section rhythm, branch metadata and search/filter grouping.
- Improved API request/response hierarchy, Skills list/detail/editor hierarchy and launcher rows without changing their existing behavior.
- Added responsive container rules and checked wide and narrow sidebar layouts for horizontal overflow.

### Verification

- 386 assertions green across host, client, search, nested, parent and remote suites.
- Chrome component previews checked API, Skills, Changes, launcher and references peek at 360 px and 1000 px in both actual DSH themes (20 states); no horizontal control overflow. Enabled primary button contrast exceeded 4.5:1. This is not an authenticated end-to-end GUI test.
- Corrected primary button text to the actual `label-primary-foreground` token, supplied the launcher with its own local aliases, preserved editor monospace fonts, and let narrow peek headers wrap the shortcut hint.

## 1.4.2 (2026-11-11)

### Fixed

- **Branch-changes baseline used a stale LOCAL default branch.** `detectBase` stripped the `origin/` prefix from the `origin/HEAD` target, so `merge-base` ran against local `master`/`main`: whenever the local copy lagged behind the remote, the "branch committed changes" list inflated with the remote's own history (e.g. 141 files / 159 commits for a small feature branch). The baseline is now the remote-tracking ref (`origin/master` / `origin/main`); local branch names remain the fallback only when no remote ref exists.
- **"变更行 0" chip on files the changes list insists are modified.** Diffs without content hunks — mode/permission-only changes, binaries, rename/copy metadata, empty additions — now carry an explanatory `note` from `git.diff`, and the whole-file view shows it as a chip instead of the baffling zero count.

### Tests

- Regression: mode-only diff returns the explanatory note; a feature branch's base resolves to `origin/main` (remote-tracking default), while a checkout of the default branch itself still reports no base.

## 1.4.1 (2026-11-11)

Quality review round: an independent audit (separate agent, read-only, all findings reproduced in sandboxes) found 1 critical + 6 major + 10 minor issues; every one is fixed with regression tests (suite now 353 assertions).

### Fixed — data loss

- **Workspace replace could permanently truncate files >4 MiB**: `fs.read` returns a capped prefix and the replace flow wrote it back over the original. Replaces now skip truncated files with a per-file error.
- **Skills editor could truncate SKILL.md >1 MiB on save**: `skills.read` now reports `truncated:true` and the editor blocks saving truncated content (warning chip + toast).
- `readFencedText` / `skills.readCapped` read only the capped prefix of oversize files instead of buffering multi-GB files into the host process (OOM risk).

### Fixed — fences & git safety

- **Symlinked skill directories** (e.g. `.agents/skills/evil -> $HOME` carried by a cloned repo) could smuggle reads/writes/deletes outside the skill roots — all four skill routes now do a realpath containment re-check.
- **`fs.create` / `fs.rename` destinations** resolved lexically — a symlinked dir inside the workspace could redirect creates/moves outside. Both now realpath the nearest existing ancestor and re-fence (`resolveFencedNewPath`).
- **Parent-tree reads exposed hidden directories**: when the workspace sits directly under `$HOME`, `fs.read ../.ssh/...` was allowed. Extra read roots now refuse any path with a dot segment.
- **Cross-session cache leak**: `extraReadRoots` cached the first workspace's roots process-wide; later sessions inherited them. Roots are now computed per call (only the workspace-independent Go roots are cached).
- **Git write routes on enclosing repos**: with the session cwd inside a larger repo, `commit`/`push`/`stash`/`checkout`/`pull`/`fetch` silently mutated the repo beyond the workspace while `stage`/`discard` refused it. All write routes now share one fence (`fencedRepoRoot`) and refuse with a clear error; reads (status/diff/log/blame/branches) stay lenient.
- **`git.revertHunk` race**: the client now sends the rendered hunk header and the host refuses on range mismatch ("diff has changed; refresh") instead of reverting a shifted hunk — previously an agent editing the same file alongside could cause an unrecoverable wrong-hunk revert.
- **Glob metacharacters in filenames** (`a*.txt`) swept sibling files in stage/discard/diff/log/restore — all git pathspecs are now `:(literal)` (blame excluded: it doesn't parse the magic and is read-only).
- `runGit`: maxBuffer overflow no longer counts as success (truncated diffs were returned as complete); timeouts now SIGTERM first and SIGKILL after a 3 s grace so a killed git can clean up `index.lock`.

### Fixed — UI behavior

- Tree refresh/reveal no longer flickers loaded subtrees away (previous listing stays visible while refetching; a failed refresh keeps stale entries).
- Dragging a file onto another **file** row moves it into that file's folder (VSCode behavior) instead of falling through to the workspace root; root-drop only triggers on the bare panel background.
- Switching files clears stale floating UI (file history 🕘, go-to-line, symbol palette).
- Hunk revert is two-step (⟲ arms an inline danger confirm), consistent with every other destructive action.
- Active editor tab auto-scrolls into view; go-to-line clamps to the wrap render cap in wrap mode.
- Auto gutter marks are debounced (220 ms) — rapid tab switching no longer spawns a git process per passthrough file.
- Workspace replace invalidates the search context cache (stale previews) and the cache is bounded to 30 files.
- ripgrep timeouts return partial results with `timedOut:true` instead of burning another 15 s on grep and misreporting "grep could not run".
- `parseCurl`: line continuations are handled in the tokenizer — single-quoted bodies keep literal backslash+newline (multi-line bodies survive roundtrips), double-quoted fold per POSIX; `-c/--cookie-jar`, `-T/--upload-file` & co no longer leak their values into the URL.
- NaN `limit` falls back to the default instead of silently returning empty results.
- LSP servers no longer idle out while the user is reading code (diagnostics/status calls touch the idle timer); `didOpen` sends correct languageIds for `.pyi/.mjs/.cjs/.mts/.cts`.
- `api.send` streams responses and aborts at the 2 MiB cap instead of buffering unbounded bodies.

### Changed — structure

- `curl.js` split out of `apiclient.js` (pure curl wire format: parse/serialize/quote); `searchpanel.js` split out of `overlays.js` (search UI + match highlighting). `apiclient.js` 800→553, `overlays.js` ~750→355 lines.

## 1.4.0 (2026-11-11)

Second competitor-parity round: the remaining VSCode / GitLens / Postman gaps.

### Added

- **Find widget (⌘F)**: `Aa` match-case, `ab|` whole-word and `.*` regex toggles (VSCode parity); invalid patterns show a hint instead of silently matching nothing; matches flash their actual matched text; options persist per session.
- **Workspace replace**: ▸ toggle in the search panel reveals a replace row — per-file ⇄ action and Replace All with a two-step confirm showing the file count; literal replacements keep `$` literal while regex mode honors `$1`/`$&`; every write goes through the `baseMtime` guard so external edits are never clobbered; capped at 200 files per run with a summary toast.
- **Staged diff scope**: `git.diff scope:"staged"` (index vs HEAD); staged-section rows open it, with its own chip label.
- **Git stash suite**: `git.stash.list/save/apply/pop/drop` routes (ref-validated, deterministic nothing-to-stash pre-check incl. the untracked-only case, conflict-tolerant apply/pop); collapsible 贮藏 section in the Changes panel with inline message input, include-untracked checkbox, and Apply/Pop/Drop (two-step) per row.
- **File history (GitLens-style)**: `git.history` route (`log --follow`, relative dates); 🕘 head button opens the history overlay; clicking a commit shows that commit's diff **scoped to the file** (`git.diff` commit scope gained an optional path filter).
- **Hunk-level revert**: `git.revertHunk` re-derives the patch fresh and reverse-applies it via `git apply -R -` (stdin; worktree-only, index untouched); ⟲ button on every hunk row in both diff views, working scope only.
- **Editor tabs**: open files join a tab strip (dedup, capped 15, persisted); switching restores per-tab cursor+scroll; middle-click or ✕ closes with neighbor fallback; unsaved-edit guard; file/folder deletion evicts tabs.
- **File tree**: drag-to-move (files and folders, root drop included) with canDropInto guards and drop-target highlight; auto-reveal expands ancestors and scrolls to the file opened from search/quick-open/LSP jumps; type-tinted file glyphs shared with the changes tree.
- **API tester**: collapsible Query Params table (merged into the URL at send and in copy-as-curl, same-name override, fragment preserved) and a per-request timeout input (clamped 1–120 s); both persist in drafts, history and favorites.

### Changed

- `openDiffSource` always reloads from the host (mtime LRU keeps it cheap) — the source view can no longer show stale content after a hunk revert or external edit.
- `parseDiff` drops the trailing empty segment, removing the phantom context row at every diff tail.

### Tests

- 45+ new assertions across the round: find matcher (smart-case/words/regex/zero-length), replace engine ($-escaping, capture refs, multiline anchors), staged scope, stash flow (incl. untracked sweep + pop restore), history + scoped commit diff, revertHunk (two-hunk selectivity, range/fence errors), tab list algebra, mergeParams, tree drag/reveal helpers, DiffView revert wiring.

## 1.3.0 (2026-11-11)

Competitor-parity round: every module benchmarked against VSCode / GitLens / Postman and closed to the gap.

### Added

- **Diff view (VSCode parity)**: side-by-side mode (▥ toggle, persisted) with aligned mod rows, wrapped cells and empty-side fillers; word-level intra-line highlight in **both** views (token prefix/suffix trim, zero-width caret for pure insertions); ↑↓ change navigation with centered scroll and outline highlight.
- **SCM (VSCode/GitLens parity)**: `git.push` route — pushes to the exact upstream refspec, publishes with `-u` when no upstream exists, refuses detached HEAD, never force; push button in the branch palette; **amend** toggle in the commit box (`git commit --amend -m`); opening any file with uncommitted changes now loads gutter diff marks automatically (untracked files skipped).
- **Search (VSCode parity)**: results grouped under collapsible sticky file headers with counts; every match occurrence highlighted in result rows and context lines with the engine's smart-case rule (regex-aware, invalid patterns degrade safely).
- **API tester (Postman parity)**: **Copy as curl** (`⧉ curl`, POSIX-quoted, one flag per line, re-importable by the curl parser — roundtrip tested); **environment variables** (`{{}}` table persisted in localStorage, substituted in URL/headers/body/form values at send time, unknown names stay literal).
- **File tree**: 📋 hover action on every row — click copies the absolute path, ⌥/Alt-click copies the workspace-relative path.
- **Save-conflict guard (VSCode parity)**: `fs.read` returns `mtimeMs`; `fs.write` accepts `baseMtime` and refuses the write when the file changed on disk since load — external edits are never silently clobbered; the editor surfaces a localized conflict notice and refreshes its mtime after each save.

### Fixed

- `parseDiff` dropped a phantom trailing context row (git diff text ends with `\n`), which consumed a line number at the tail of every diff.
- `toCurl` initially split flag names and values across continuation lines; logical units (`-X POST`) now stay on one line.

### Tests

- 27 new assertions: push round-trips against a real bare remote (publish, tracking, diverged refusal, detached refusal), amend semantics (replaces instead of adding, folds staged content), mtime guard (stale refusal, untouched file, compatibility), toCurl/substituteVars/buildEnvMap/shellQuote incl. parseCurl roundtrips, pairRows/intraLineDelta/intraMarks, matchRanges/highlightText.

## 1.2.0 (2026-11-11)

### Added

- **Git commit flow**: `git.stage` / `git.unstage` / `git.commit` host routes; the Changes panel splits into Staged/Changes sections with per-row and per-directory +/− actions, section-level stage-all/unstage-all, and a commit box (Enter commits the staged set; with an empty index the button explicitly becomes "Stage All & Commit").
- **Image preview**: `fs.read` returns base64 data URLs for png/jpg/gif/webp/avif/bmp/ico (10 MiB cap, oversize reports kind without payload); the editor renders them on a checkerboard backdrop. SVG joins the default-preview set (rendered via charset-safe data URL, toggle to raw).
- **Search enhancements**: `search.text` accepts `regex` and `words` options; include filters support comma/semicolon-separated multi-globs with `!` exclusion; engine errors (e.g. invalid patterns) surface inline instead of silently falling back. Result rows expand ±3 context lines on demand (click any context line to jump to it).
- **API tester**: automatic request history (localStorage, newest first, capped 30, full request snapshot, one-click restore, per-row delete/clear), named favorites (☆ Save, same-name replaces), and multipart/form-data sending (host builds FormData so fetch sets the boundary; curl `-F` imports as multipart fields).
- **Editor**: word-wrap mode (↩ button / ⌥Z, persisted per session, flow layout with inline line numbers, capped at 5000 lines) and a go-to-line palette (⌘G / clickable Ln-Col chip).
- **Multi-language LSP**: server descriptor table — Go (gopls), TS/JS (typescript-language-server), Python (pyright-langserver or pylsp); one server per language per project root; `lsp.status` reports the active server label; missing binaries degrade gracefully. Token click-jump extended to TS/JS/Python.
- **Syntax highlighting**: json (with distinct property names), yaml, sh, toml, rust, java, c/cpp, sql (case-insensitive keywords), css; hash-comment languages no longer mis-tokenize `//` inside values.
- **CI**: GitHub Actions workflow (Node 20 + pnpm + gopls); host LSP assertions skip instead of failing when gopls is absent.
- English README (`README.en.md`); fence regression tests (symlink refusal, escape refusal for create/rename/stage).

### Fixed

- `git.discard` failed with ENOENT on deleted files (lstat-based resolution required the file to exist); it now resolves repo-relative paths without touching disk.
- Git working-tree paths in multi-repo workspaces resolved against the session cwd instead of the selected repo root (discard/stage/unstage hit the wrong tree or threw).
- Unborn-HEAD repos: unstaging now falls back to `git rm --cached --ignore-unmatch` (restore/reset need a HEAD commit); localized git messages no longer break the empty-index no-op.
- Dropped the dead `IconBolt` import; commit-list rows and the new commit box no longer share the `ce-commit` class name.

### Changed

- **Refactor**: `components.js` (2033 lines) split into `pathtools.js`, `tree.js`, `changes.js`, `overlays.js`, `codeview.js` (pure row builders `computeVisible` / `computeGutter` / `computeWrapRows` / `buildTokenCells`) and `code.js` (stateful orchestrator); `findModuleRoot` generalized to `findProjectRoot` with per-language markers.
- gopls-specific UI copy generalized to "language server"; the head chip shows the detected language instead of a Go-only badge.

## 1.1.0 (2026-11-10)

- Renamed `@local/dsh-code-explorer` → `dsh-plugin-kit`; MIT license + README.
- File tree create/rename/delete, editor save, blame column, branch switcher, whole-file diff marks + change rail, folder discard, tree/list toggle, md/html preview, skills manager (incl. bundled read-only group), Postman-style API tester with curl import, grouped sidebar launcher.
- Host split into `lib/host/*` modules (behavior unchanged).

## 1.0.0

- Initial bundle: Code tab (file tree, virtual-scroll editor with gopls jumps, git changes + diffs), chat call-diff rows, host HTTP API.
