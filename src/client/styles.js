/* Style entry: the rules live in ./css/* one module per surface.
 *
 * Every color, radius and line in those modules comes from the token block in
 * ./css/tokens.js, which maps the host's --dsw-alias-* theme tokens. A surface
 * therefore works in both DSH themes without a second stylesheet.
 */

import { TOKENS_CSS } from "./css/tokens.js";
import { SHELL_CSS } from "./css/shell.js";
import { EDITOR_CSS } from "./css/editor.js";
import { API_CSS } from "./css/api.js";
import { DATA_CSS } from "./css/data.js";
import { SKILLS_CSS } from "./css/skills.js";
import { CHROME_CSS } from "./css/browser.js";
import { WORKTREE_CSS } from "./css/worktree.js";

export const CSS = [
	TOKENS_CSS,
	SHELL_CSS,
	EDITOR_CSS,
	API_CSS,
	DATA_CSS,
	SKILLS_CSS,
	CHROME_CSS,
	WORKTREE_CSS,
].join("\n");
