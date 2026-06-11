# Nest Sub-tasks Under Their Parent (Board + Agents)

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

Sub-tasks are full `Task` documents linked to a parent via `parentId` (see
`2026-06-11-agent-plan-and-task-creation.md`). Both surfaces currently render
sub-tasks as first-class, top-level entries:

- **Web kanban** (`BoardPage`): `tasksByStatus` groups *every* task by status,
  so each sub-task becomes its own column card. With plans that fan out into
  many sub-tasks, columns become crowded and the parent/child relationship is
  hard to read.
- **Agent MCP** (`list_board_tasks`): prints a flat bullet list that mixes
  parents and sub-tasks at the same level.

The parent already communicates child progress (`subDone/subTotal` badge on the
card) and the task drawer already lists the children, so standalone sub-task
cards are redundant on the board.

## Decision

Sub-tasks are shown **only nested inside their parent**, never as standalone
top-level entries.

1. **Web board** — `BoardPage` excludes tasks with a `parentId` from the
   column grouping (`tasksByStatus`). The `taskMeta` computation continues to
   iterate over *all* tasks so parent cards still show accurate
   `subDone/subTotal`. Sub-tasks remain fully accessible: open the parent card →
   drawer → "Subtasks" list (each child opens in its own drawer).

2. **Agent MCP `list_board_tasks`** — group the returned tasks so parents are
   listed at the top level with their sub-tasks indented beneath them. A
   sub-task whose parent is absent from the current status filter is still shown
   (so nothing becomes unclaimable) but flagged as a sub-task.

The agent task **list API** (`GET /api/v1/boards/:boardId/tasks`) is left
returning a flat array — agents must still be able to claim individual
sub-tasks, and nesting is purely a presentation concern handled in the MCP
formatter.

## Alternatives Considered

- **Hide sub-tasks from agents entirely**: rejected — plans create
  "independently claimable sub-tasks", so agents must still see and claim them.
- **Filter sub-tasks out in the API** (`GET /tasks`): rejected — the same
  endpoint feeds agent claiming and would make sub-tasks unreachable; keeping
  the filter in the presentation layer (board grouping, MCP formatter) is less
  invasive and reversible.
- **Collapsible sub-task cards inside columns**: heavier UI change for little
  gain given the drawer already lists children.

## Consequences

- Columns show only parent (top-level) tasks; counts reflect parent tasks only.
- A sub-task with a status differing from its parent no longer appears in its
  own status column — its progress is surfaced via the parent's badge and the
  drawer. Header "stale/conflict" counts still tally all tasks (including
  hidden sub-tasks) so nothing is silently ignored.
- Agent listings read as a plan outline (parent → children) rather than a flat
  dump.
