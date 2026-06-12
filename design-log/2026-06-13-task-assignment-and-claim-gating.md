# Task Assignment & Assignee-Gated Claiming

**Date:** 2026-06-13
**Status:** accepted
**Author:** collaborative

## Context

Supersedes the claim/ownership portion of
[Agent self-service task pickup](./2026-06-11-agent-self-service-task-pickup.md).

Today tasks live in a **shared backlog** with no owner until an agent claims one.
The atomic claim guard only prevents stealing a task that is *actively* owned
(`in_progress`/`in_review`) by a different user. That leaves two gaps for
multi-developer boards:

1. Newly created tasks have no owner, so **any** developer's agent can claim
   **any** backlog task — there is no way to reserve work for a specific person.
2. There is no "this is mine, hands off" concept before a claim happens.

We want a model where:

- Agent-created tasks default to the user behind the agent's token.
- Humans can assign (or leave unassigned) tasks they create.
- Agents only claim tasks assigned to their own token user.
- Unassigned tasks are **not** claimable by agents (they must be assigned first).

This is a deliberate reversal of the open-backlog model, so it is opt-in per
board to avoid breaking existing boards / solo "anyone grabs the next thing"
workflows.

## Decision

### 1. Separate `assigneeId` from `ownerId`

Add `Task.assigneeId` (ref User), distinct from `ownerId`:

- `assigneeId` — **who the task is reserved for** (set on assignment or at
  agent-create time). Exists before a claim.
- `ownerId` — **who is actively working it** (set at claim, unchanged).
  Remains the axis for conflict detection and `list_my_tasks`.

On claim we set both `ownerId` and `assigneeId` to the claiming user, so
assignment stays populated and consistent in both policy modes.

### 2. Per-board policy `requireAssigneeToClaim`

Add `Board.requireAssigneeToClaim?: boolean`, mirroring the existing
`requirePrForReview` opt-in pattern. Effective value: `?? false` (backward
compatible — existing boards keep the open backlog).

- **Off (default):** today's behavior. Any backlog/unowned task is claimable.
- **On:** an agent may only claim a task whose `assigneeId` equals its token
  user. A task with **no assignee is not claimable** (returns 403 with guidance
  to have a human assign it first). The existing different-owner steal guard
  still applies on top.

### 3. Auto-assignment on agent-create

- `create_task` → `assigneeId = token user`. A subtask created under another
  person's parent is still assigned to the **creator** (the token user doing the
  work), not the parent's owner.
- `create_plan` → conservative: assign **top-level** plan tasks to the creator,
  leave **subtasks unassigned** so a human can fan them out across the team.
  This honors "the agent that authored the work owns it" without locking an
  entire multi-task plan to one developer.

### 4. Human assignment + reassignment guard (edge case)

- Human task create/update accepts `assigneeId` (nullable).
- **Reassignment of an actively-owned task is blocked**: if a task is
  `in_progress`/`in_review` with an `ownerId`, changing `assigneeId` to a
  different user returns 409 ("move it back to backlog first"). Prevents an
  assignee/owner mismatch while someone's agent is mid-flight.

### 5. Discovery matches the rule (edge case)

- Tasks now serialize `assigneeId` + `assignee` (resolved user) everywhere
  `owner` is serialized.
- Agent board listing (`GET /boards/:id/tasks`): when the policy is on, the
  **backlog** listing is filtered to tasks assigned to the token user, so the
  agent only sees work it can actually claim. Non-backlog statuses still return
  everything for context.
- `list_my_tasks` (`GET /tasks`) additionally returns **backlog tasks assigned
  to me**, so an agent can discover its queue, not just what it already owns.
- MCP tool descriptions + the generated `SWARM.md` are updated to tell agents:
  only claim tasks assigned to you; never claim an unassigned task — ask a human
  to assign it.

### 6. Same-user, multiple agents (edge case)

Re-claiming a task you already own remains allowed — this is required by the
resume/unblock workflow (`SWARM.md` says claiming again clears a blocker). The
benign "two of my own agents grab the same task" race is accepted: attribution
is still correct (same user) and same-owner pairs never trigger conflicts. We
deliberately do **not** hard-block self re-claims.

## Alternatives Considered

- **Overload `ownerId` for backlog reservation.** Rejected — blurs "reserved
  for" vs "actively working," and would break conflict detection / `list_my_tasks`
  semantics that key off `ownerId`.
- **Make assignment global (not per-board).** Rejected — silently breaks every
  existing board and solo/open-swarm workflows. Per-board opt-in preserves both.
- **Auto-assign the entire `create_plan` tree to the author.** Rejected — locks
  a whole plan to one developer; top-level-only assignment keeps subtasks
  distributable.
- **Hard-block same-user re-claim to stop self-races.** Rejected — would break
  the documented resume/unblock-by-reclaim flow; the race is low-harm.

## Consequences

- New boards behave unchanged until an admin enables
  `requireAssigneeToClaim`; when enabled, unassigned tasks stall until assigned
  (intended safety — assignment becomes a required step, surfaced in the UI).
- Schema additions only (`Task.assigneeId`, `Board.requireAssigneeToClaim`);
  no migration needed — both default to "absent" which means current behavior.
- Cross-developer task stealing is closed at the server (claim guard), not by
  agent etiquette.
- Follow-up (not in this change): per-assignee workload view on the dashboard,
  and optional auto-assignment of round-robin backlog.
