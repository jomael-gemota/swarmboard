# Agent self-service task pickup via per-board AGENTS.md

**Date:** 2026-06-11
**Status:** accepted
**Author:** collaborative

## Context

Today an AI agent can report status to swarmboard through the MCP server
(`claim_task`, `update_task`, `complete_subtask`, `flag_blocker`,
`complete_task`, `list_my_tasks`). But two gaps make day-to-day use clunky:

1. **The agent never knows which task it is working on.** A developer has to
   manually hand the agent a task ID every session. The MCP server has no
   board concept, and `list_my_tasks` only returns tasks the agent already
   *owns* (`ownerId == token user` and status `in_progress`/`in_review`) — it
   cannot surface the board's open/backlog work.
2. **Rules files are not wired up.** `AGENTS.md` / `CLAUDE.md` are read by most
   agents (Cursor, Claude Code, Copilot, Codex, Windsurf), but nothing in
   swarmboard generates a board-specific instruction block, so each developer
   would have to hand-write one.

The proposal: swarmboard generates a per-board `AGENTS.md` block (containing the
board ID + workflow instructions, **no secrets**) that a developer commits into
their repo. An agent reading it can then *discover* the board's pending tasks
itself and pick one up, instead of being spoon-fed an ID.

## Decision

Implement four pieces:

1. **Board-scoped "pending tasks" endpoint (agent auth).**
   `GET /api/v1/boards/:boardId/tasks?status=backlog` authenticated with an
   agent token. Verifies the board belongs to the token's organization (same
   org-scoping the existing agent endpoints use), and returns the board's tasks
   filtered by status (default `backlog`). This is what "retrieve pending tasks
   from that board" maps to. Implemented in a new `routes/agentBoards.ts`
   mounted at `/api/v1/boards` (sibling to the existing `/api/v1/tasks`).

2. **`list_board_tasks` MCP tool.** Takes `board_id` (read from `AGENTS.md`) and
   an optional `status` (default `backlog`), calls the new endpoint, and returns
   `id`, `title`, `description`, `status`, `modulePath` so the agent has enough
   context to choose and start work.

3. **Atomic claim guard.** `claim_task` currently overwrites `ownerId`
   unconditionally, so two agents pulling from the same backlog could silently
   steal a task from each other. Change the claim to a guarded
   `findOneAndUpdate`: reject (HTTP 409) if the task is already actively owned
   (`status` in `in_progress`/`in_review`) by a *different* user. Claiming a
   `backlog` task, an unowned task, or re-claiming your own task still works.

4. **Per-board `AGENTS.md` generator.** A backend helper
   `generateAgentsMarkdown({ board, apiUrl })` plus an authenticated endpoint
   `GET /api/orgs/:orgId/boards/:boardId/agents-md` returning `{ markdown }`.
   Surfaced in the Board settings page with a copy button. The generated block
   contains the board ID and the agent workflow; it deliberately contains **no
   token** (the token lives only in the developer's local `mcp.json`), so it is
   safe to commit.

## Alternatives Considered

- **Board-scoped tokens.** Could scope the agent token to a single board so the
  board is implicit. Rejected: tokens are org+user scoped today, used across all
  the developer's boards; embedding the board ID in `AGENTS.md` is less
  disruptive and keeps one token per developer.
- **Putting the board ID in MCP `env`.** Would force a separate MCP server
  entry per board. Passing `board_id` as a tool argument (sourced from
  `AGENTS.md`) lets one MCP config serve every board in the org.
- **Auto-claiming the top backlog task.** Rejected for now — let the agent (and
  human) choose which task to pick up; auto-assignment can come later.

## Consequences

- Agents can now self-discover and pull work given only a committed `AGENTS.md`;
  the manual "here is the task ID" handoff is no longer required every session.
- The claim guard changes behavior: a claim against a task actively owned by
  someone else now fails with 409 instead of silently stealing it. This is the
  intended trust/safety improvement but is a behavioral change to note.
- `AGENTS.md` is safe to commit (no secret); the token stays in local config.
- Follow-up (not in this change): optional `get_task` detail tool, auto-pickup
  mode, and emitting richer task context (acceptance criteria) in the listing.
- Discovery is still probabilistic: a rules file makes the agent *aware* of the
  tools but does not guarantee it acts without a nudge.
