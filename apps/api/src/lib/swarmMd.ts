interface BoardLike {
  _id: unknown;
  name: string;
  repoUrl?: string | null;
}

/**
 * The single line a developer adds to their existing `AGENTS.md` (or
 * `CLAUDE.md`) so any agent is pointed at the full swarmboard instructions in
 * `SWARM.md`. Worded to force a re-read on EVERY prompt — not just the first of
 * a session — since most IDEs/agents will not auto-open an external file again
 * once it appears earlier in the conversation, causing the instructions to be
 * skipped on later turns.
 */
export const SWARM_RULE =
  "RULE: SWARM.md holds mandatory workflow instructions for this repo. At the start of EVERY request — not only the first message of a session — open and read the FULL SWARM.md file again before taking any action, and follow it exactly. Re-read it every turn even if you already read it earlier in this conversation; never rely on memory, summarize, or skip this step.";

/**
 * Generate the standalone `SWARM.md` for a board. The result is plain markdown a
 * developer commits as a new file at their repo root.
 *
 * It intentionally contains NO token: the board ID is the only identifier and
 * is safe to commit. The agent token lives solely in the developer's local MCP
 * client config (`SWARMBOARD_TOKEN`).
 */
export function generateSwarmMarkdown({
  board,
  apiUrl,
}: {
  board: BoardLike;
  apiUrl: string;
}): string {
  const boardId = String(board._id);
  const url = apiUrl.replace(/\/$/, "");

  return `# Swarmboard task tracking

This repository is tracked on the swarmboard board **${board.name}** (board ID \`${boardId}\`).
Swarmboard is a real-time kanban board for AI-assisted development. You have
swarmboard MCP tools available — use them so the board reflects your work.

**At the start of a work session:**

1. Call \`list_board_tasks\` with \`board_id: "${boardId}"\` to see the pending
   (backlog) tasks on this board.
2. **If the board is empty (or has no task for what you've been asked to do):**
   collaborate with the human on a plan first. Once they have explicitly agreed
   on the plan, call \`create_plan\` with \`board_id: "${boardId}"\` to lay it
   out as tasks (each with optional subtasks) before you start building. Do not
   author a plan unprompted, and don't duplicate tasks that already exist. You
   can also add a single task with \`create_task\`. Name every task and subtask
   using the **Task title format** defined below. Tasks you create are
   automatically assigned to you.
3. Pick a task **assigned to you** and call \`claim_task\` with its
   \`task_id\`. This moves it to \`in_progress\`. Include \`agent_type\` (your
   IDE/tool) and \`agent_model\` (the AI model you are running as, e.g.
   \`claude-opus-4.8\`, \`gpt-5.3-codex\`, \`gemini-2.5-pro\`) so the board
   records what produced the work. Also pass \`files\` — the paths you expect to
   touch — so the board shows your footprint and can warn about conflicts early.

   **Assignment & ownership (multi-developer boards):** every task can be
   *assigned* to a specific person. If this board enforces assignment, you may
   only claim tasks assigned to **your** user — claiming an unassigned task, or
   one assigned to someone else, is rejected. Never try to take a teammate's
   task. If the work you need has no assignee (e.g. a human added it), ask the
   human to assign it to you before claiming. \`list_my_tasks\` shows the backlog
   tasks assigned to you that you can pick up next.

**While working:**

- Call \`update_task\` to post meaningful progress (what you just did, findings,
  what's next).
- Call \`report_changes\` whenever your set of edited files changes — pass each
  file you've actually modified (with line ranges when you can). This populates
  the task's "Files touched" list and powers line-level conflict detection, so
  keep it current as your diff grows.
- Discover the work needs to be broken down? Call \`create_task\` with
  \`parent_id\` set to the current task's ID to add a **real** subtask under it.
  (\`complete_subtask\` is only a lightweight checklist note in the activity feed
  — it does not create a subtask card. Use \`create_task\` for actual subtasks.)
- Call \`complete_subtask\` to log individual checklist steps as you finish them.
- Call \`flag_blocker\` if you are stuck or need human input — this flags the
  task as **blocked** (it stays in its current column) and alerts a human. The
  flag clears automatically when you resume work (claim it again, report changes,
  or complete it).

**When finished:**

- Call \`complete_task\` with a short summary (and your \`agent_model\` if you
  did not set it at claim time). This marks the task *claimed complete* — a
  human or CI verifies it before it is truly done. Do not assume your work is
  verified.
- **If you open a pull request**, put the task ID in the PR title or body so the
  board can link it: \`[TASK-<task_id>]\` or \`#swb-<task_id>\` (e.g.
  \`[TASK-abc123] fix login redirect\`). On boards that require a PR before
  review, \`complete_task\` keeps the task *in progress* and marked
  "done · awaiting PR" until that PR is opened — opening the PR is what moves it
  to \`in_review\`.

## Task title format

> **Maintainers: edit this section to set the title convention for this repo.**
> Agents must follow whatever format is written here. The default below is a
> sensible starting point — change it freely to match your team's style.

**Default format:** \`[Type]: Action + object + context\`

- **Type** — one of \`Feature\`, \`Bug\`, \`Chore\`, \`Docs\`, \`Refactor\`
  (Capitalized, in brackets).
- **Action** — imperative, sentence case, concise (≤ ~70 chars), no trailing
  period.
- **Example:** \`[Feature]: Add OAuth login to settings page\`

Apply the same convention to subtasks.

If you do not yet have a task ID and \`list_board_tasks\` returns nothing, ask
the human which task to work on rather than guessing.

> Setup: this requires the \`@swarmboard/mcp-server\` MCP server configured with
> a \`SWARMBOARD_TOKEN\` and \`SWARMBOARD_URL=${url}\`. The token is personal —
> keep it in your local MCP config, never commit it.
`;
}
