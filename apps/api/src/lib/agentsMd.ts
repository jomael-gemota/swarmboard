interface BoardLike {
  _id: unknown;
  name: string;
  repoUrl?: string | null;
}

/**
 * Generate the swarmboard `AGENTS.md` block for a board. The result is plain
 * markdown a developer commits into their repo (root `AGENTS.md`, or appended
 * to an existing one — `CLAUDE.md` for Claude Code also works).
 *
 * It intentionally contains NO token: the board ID is the only identifier and
 * is safe to commit. The agent token lives solely in the developer's local MCP
 * client config (`SWARMBOARD_TOKEN`).
 */
export function generateAgentsMarkdown({
  board,
  apiUrl,
}: {
  board: BoardLike;
  apiUrl: string;
}): string {
  const boardId = String(board._id);
  const url = apiUrl.replace(/\/$/, "");

  return `<!-- swarmboard:start board=${boardId} -->
## Swarmboard task tracking

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
   can also add a single task with \`create_task\`.
3. Pick the task you are going to work on and call \`claim_task\` with its
   \`task_id\`. This moves it to \`in_progress\`.

**While working:**

- Call \`update_task\` to post meaningful progress (what you just did, findings,
  what's next).
- Call \`complete_subtask\` for individual steps as you finish them.
- Call \`flag_blocker\` if you are stuck or need human input — this moves the
  task to \`in_review\`.

**When finished:**

- Call \`complete_task\` with a short summary. This marks the task
  *claimed complete* — a human or CI verifies it before it is truly done. Do
  not assume your work is verified.

If you do not yet have a task ID and \`list_board_tasks\` returns nothing, ask
the human which task to work on rather than guessing.

> Setup: this requires the \`@swarmboard/mcp-server\` MCP server configured with
> a \`SWARMBOARD_TOKEN\` and \`SWARMBOARD_URL=${url}\`. The token is personal —
> keep it in your local MCP config, never commit it.
<!-- swarmboard:end -->
`;
}
