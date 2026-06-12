# Model "blocked" as a task flag, not a status column

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

`flag_blocker` (MCP tool → `POST /tasks/:id/block`) currently moves a task to
`status: "in_review"` and logs the blocker reason. This conflates two unrelated
meanings of the review column: "completed work awaiting review" vs. "stuck, needs
a human to unblock." A blocked task is not reviewable — it surfaces in the wrong
column and looks done when it is actually halted.

This was flagged as follow-up in
`2026-06-12-pr-gated-review-transition.md`.

The codebase already has a consistent convention: every transient "needs
attention" condition — `isStale`, `hasConflict`, `claimedComplete`,
`verifiedComplete` — is modeled as a **boolean flag** rendered as a badge (and,
for stale/conflict, a dashboard attention list). The `TaskStatus` enum
(`backlog → in_progress → in_review → verified → deployed`) is reserved for the
workflow lifecycle. `isStale` resets to `false` on any agent interaction.

## Decision

Model "blocked" the same way the other attention conditions are modeled.

1. **New task fields** `blocked: boolean` (default `false`) and
   `blockReason?: string`, mirrored across the Mongoose `Task` model and the
   `@swarmboard/shared` `TaskSchema`.

2. **`flag_blocker` stops changing `status`.** It sets `blocked = true`,
   `blockReason = reason`, leaves the task in its current column (typically
   `in_progress`), and logs the blocker as before.

3. **Clearing the flag (unblock):**
   - **Auto-clear when the agent resumes work** — `claim`, `report_changes`, and
     `complete` set `blocked = false` / `blockReason = null`, mirroring how those
     same endpoints already reset `isStale`.
   - **`update_task` does NOT clear it** — an agent can post progress notes
     (including "still blocked") without lifting the block.
   - **Humans can clear it from the UI** — the task `PATCH` route accepts
     `blocked`, and clearing it nulls `blockReason`. The detail drawer gets an
     "Unblock" action.

4. **Surfacing:**
   - A prominent **red "Blocked"** badge on the card and in the drawer (stronger
     than the amber stale/conflict badges), with the reason in the drawer.
   - The dashboard endpoint returns a `blockedTasks` attention list alongside
     `staleTasks` / `conflictTasks` (no dashboard page is built yet; this keeps
     the contract ready and consistent).

## Alternatives Considered

- **Add a `blocked` status / column.** Explicit, but expands the `TaskStatus`
  enum and ripples into board columns, webhook/CI transitions, dashboard
  grouping, and progress weighting — and the task loses its place in its real
  column. Same column-explosion reasoning we used to reject a column for
  "awaiting PR." Rejected.
- **Keep moving to `in_review` but add a flag.** Still pollutes the review
  column with non-reviewable work. Rejected.
- **Auto-clear on ANY agent action (incl. `update_task`).** Simplest, but a
  "still stuck" progress note would silently unblock the task. Rejected in favor
  of clearing only on resume signals (claim/report/complete) + manual.

## Consequences

- `in_review` regains a single clear meaning. Blocked work stays visible in
  `in_progress` with an unmistakable badge and is recoverable by humans or by the
  agent resuming.
- Additive type/field change; `@swarmboard/shared` minor version bump. No
  migration — existing tasks default to `blocked: false`.
- Behavior change for `flag_blocker`: previously it visibly moved the card to
  In Review; now it flags in place. Documented in the generated `AGENTS.md` and
  the MCP tool description.
- The staleness worker still only targets `in_progress`/`in_review`; a blocked
  task remaining in `in_progress` can still be flagged stale, which is desirable
  (a long-blocked task with no human action is worth surfacing twice).
