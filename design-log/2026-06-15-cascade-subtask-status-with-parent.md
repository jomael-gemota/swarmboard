# Cascade subtask status with the parent through completion → PR → review

**Date:** 2026-06-15
**Status:** accepted
**Author:** collaborative

## Context

A parent task showed "Done · awaiting PR" while its three subtasks stayed in
`backlog` (`0/3`), which read like a bug. Inspecting the work, the parent's
"Files touched" (`types.ts`, `useLists.ts`, `Sidebar.tsx`) mapped one-to-one
onto the three subtask titles: the agent created the subtasks as a *planning
breakdown* (`routes/agentBoards.ts`), did all the coding in a single pass under
the parent, then marked the **parent** complete — never moving the subtask
cards. So the code was done; only the subtask *status* was stale.

The user's desired model: when the subtasks' work is done they should read as
"Done", and when the PR is created the parent **and** its subtasks should move
to In Review together (and on to Verified on merge).

## Decision

Cascade the parent's status transitions down to its direct subtasks via a new
`cascadeToSubtasks()` service (`apps/api/src/services/subtaskCascade.ts`). It
applies an update to every direct child, emits `task:updated` /
`activity:created` per child, and **never regresses** a child already
`verified`/`deployed` (treated as terminal, skipped by default).

Wired into the three places the parent advances automatically:

1. **Agent `/complete`** (`routes/agentApi.ts`): children get the parent's
   resulting status + `claimedComplete: true` — `in_progress` ("Done · awaiting
   PR") when the board holds for a PR, else `in_review`.
2. **GitHub `pull_request` opened/reopened → `in_review`; merged →
   `verified`** (`routes/webhooks.ts`): children follow the PR-driven status.
3. **GitLab MR merged → `verified`**: same, for parity.

UI: the detail drawer's subtask rows now show a "Done" (awaiting PR) marker when
a child is `in_progress + claimedComplete + no prUrl`, so a held subtask reads as
done rather than "In Progress". This supersedes the earlier same-session draft
that instead surfaced an "N subtasks unfinished" warning badge (reverted).

## Alternatives Considered

- **Warning badge only** (earlier draft, now reverted): surfaces the
  inconsistency but leaves subtasks stuck in backlog; the user wants them to
  actually move with the parent.
- **Block completing a parent with open subtasks**: contradicts reality here —
  the work was already done — and forces busywork ticking off each subtask.
- **Human PATCH cascade** (drag a parent card → move children): deliberately
  excluded. Cascade is tied to the automated completion/PR flow; manual column
  moves stay scoped to the single card to avoid surprising bulk changes.
- **Server-stored rollup status**: rejected — the transitions already happen at
  known choke points; a denormalised field would need separate upkeep.

## Consequences

- Subtasks no longer linger in backlog under a completed parent; they ride the
  same completion → PR → review → verified path, live via existing sockets.
- Cascade only touches **direct** children and skips terminal ones, so already
  verified/deployed subtasks and independently-tracked work aren't clobbered.
- "Done" for a subtask in the awaiting-PR state is presentational
  (`claimedComplete` + `in_progress`); the weighted `subtaskProgress` heuristic
  is unchanged, so a held subtask still contributes partial (not full) progress
  until it reaches verified/deployed — consistent with the rest of the board.
