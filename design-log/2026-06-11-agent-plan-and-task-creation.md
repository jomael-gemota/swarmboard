# Agent plan authoring: task & subtask creation

**Date:** 2026-06-11
**Status:** accepted
**Author:** collaborative

## Context

Builds on [agent self-service task pickup](./2026-06-11-agent-self-service-task-pickup.md).
That change let agents *discover and claim* a board's pending tasks — but it
assumes tasks already exist. A brand-new repo/board is empty, so unless a human
hand-creates cards, an agent has nothing to pick up.

Today only humans can create tasks: `POST /boards/:boardId/tasks` is
`requireAuth` and role-gated (viewers blocked). The agent API has no creation
verb. Separately, "subtasks" are not real entities — `complete_subtask` only
writes an activity-log line; there is no `subtasks` field or child-task concept,
so a plan cannot be laid out as trackable units ahead of time.

Desired workflow (from the developer): a developer and their agent collaborate
on a plan in chat; once the PM/developer **agree** on it, the agent writes the
plan onto the board as tasks (with subtasks) *before* it starts building.
Humans can still add tasks manually at any time.

## Decision

1. **Subtasks are real, independently-claimable tasks (parent/child).**
   Add an optional `parentId` (ref `Task`) to the `Task` model. A subtask is a
   task whose `parentId` points at its parent. This makes subtasks first-class:
   each can be claimed, updated, and completed by any agent/teammate via the
   existing flow — so a plan becomes parallelizable, distributable work. Chosen
   over a checklist-array field because the developer explicitly wants subtasks
   distributable across agents.

2. **Agent task creation lands directly in `backlog`, audited via activity log.**
   No "proposed/approval" status. The agreement is a human-in-the-loop step that
   happens in the agent chat, not enforced by swarmboard. Every agent-created
   task gets an `agent`-sourced `ActivityLog` entry ("Agent created this task")
   so origin is visible. Low-risk and easily deleted; matches the existing trust
   model (the gate is on *completion*, not *creation*).

3. **Two agent endpoints + tools.**
   - `POST /api/v1/boards/:boardId/tasks` (agent token) → create one task,
     optional `parentId`. MCP tool `create_task`.
   - `POST /api/v1/boards/:boardId/plan` (agent token) → create a whole agreed
     plan in one call: an array of tasks, each with optional nested `subtasks`.
     MCP tool `create_plan`. This is the primary path — the agent submits the
     full agreed plan atomically after the human signs off.
   Both verify the board belongs to the token's organization and emit
   `task:created` over Socket.IO so boards update live.

4. **Plan-first guidance in `AGENTS.md` and tool copy.** The generated
   `AGENTS.md` and the `create_plan`/`create_task` tool descriptions instruct the
   agent to (a) check existing tasks first, (b) only author a plan once the human
   has agreed, and (c) not duplicate work already on the board.

5. **Board UI renders the hierarchy.** Child tasks still appear as cards in their
   status column (they are real tasks), but: a parent card shows a subtask
   progress badge (done/total), a child card shows a "↳ parent" reference, and
   the task detail drawer lists a task's subtasks (and a child's parent link).

## Alternatives Considered

- **Checklist-array subtasks on a task.** Simpler schema, subtasks live inside a
  card — but they can't be claimed/distributed independently, which is the
  developer's stated goal. Rejected.
- **Flat tasks only (no hierarchy).** Smallest change, but loses the
  plan→subtask structure the developer wants. Rejected.
- **"Proposed" approval state for agent-created tasks.** Adds a status + review
  UI; deemed unnecessary since creation is low-risk and the agreement already
  happens in chat. Rejected for now (could revisit if agents over-create).

## Consequences

- New `parentId` field; all task JSON serializers must stringify it. A
  `{ parentId: 1 }` index supports child lookups.
- Deleting a parent currently orphans its children (children keep a dangling
  `parentId`). Acceptable for now; follow-up: cascade-delete or re-parent on
  delete.
- Agents can now write to the board, not just read/claim. Abuse is bounded
  (backlog only, audited, deletable) but it is a new capability surface.
- The "agreement" gate is process/prompt-enforced, not system-enforced. If teams
  want a hard gate later, add a `proposed` status (see rejected alternative).
- Follow-up: bulk operations don't yet validate cross-references or dedupe
  against existing backlog titles; agents are instructed to check first instead.
