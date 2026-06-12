# SWARM.md guidance: declare/report files and create real subtasks

**Date:** 2026-06-13
**Status:** accepted
**Author:** collaborative

## Context

Two features built into the product are effectively dormant because the
agent-facing instructions never tell agents to use them:

1. **Touched/modified files** — the data model has `declaredFiles` (set via
   `claim_task`'s `files` param), `changedFiles` + `lineRanges` (set via
   `report_changes`), and the task drawer renders a "Files touched" section
   (`apps/web/src/components/kanban/TaskDetailDrawer.tsx`). But the section is
   conditional on those arrays being non-empty, and they stay empty because
   `SWARM.md` never mentions the `files` param on claim nor the `report_changes`
   tool. Checking the git history (`91eec67`), neither the old `agentsMd.ts` nor
   the current `swarmMd.ts` ever instructed agents to declare or report files.

2. **Subtasks** — real subtasks are child `Task` documents created via
   `create_plan` or `create_task` with `parent_id` (see
   `2026-06-11-agent-plan-and-task-creation.md`). The drawer's "Subtasks" section
   reads children by `parentId`. But the `SWARM.md` "While working" section only
   tells agents to call `complete_subtask`, which writes an activity-log line and
   creates **no** task and no `parentId`. `create_plan` is gated to session start
   (empty board + agreed plan), and mid-work subtask creation via `create_task` +
   `parent_id` is never mentioned. So once a board has tasks, agents stop
   producing real subtasks; the drawer's Subtasks section stays empty.

Net effect: users report "agents aren't creating subtasks anymore" and "I don't
see the files agents touched in the task drawer." Both are instruction gaps, not
bugs in the MCP tools, API, or UI.

## Decision

Update `generateSwarmMarkdown` (`apps/api/src/lib/swarmMd.ts`) so the workflow
instructions exercise the existing tools:

- **Claim step:** tell agents to pass `files` to `claim_task` with the files they
  expect to touch (populates `declaredFiles` and enables early conflict
  detection).
- **While working:**
  - Add `report_changes` — call it as the diff evolves to record the files and
    line ranges actually changed (populates `changedFiles` / `lineRanges`, drives
    line-level conflict detection, and surfaces in the drawer).
  - Clarify that `complete_subtask` is just a lightweight checklist note (logged
    to activity), and that to add a **real** subtask that shows up under the
    parent, agents use `create_task` with `parent_id`.

Instruction content only; no API, schema, or UI changes. The generated `SWARM.md`
is regenerable, so existing boards pick up the new guidance on next copy.

## Alternatives Considered

- **Change the UI to always render empty "Files touched"/"Subtasks" sections.**
  Makes the absence visible but does not fix the underlying cause (no data). May
  add as a minor follow-up, but it is not the fix.
- **Make `complete_subtask` create a real child task.** Conflates a checklist
  note with a claimable task and would retroactively change semantics other
  flows rely on. Rejected; keep the two concepts distinct and document the
  difference instead.
- **Auto-derive touched files from git webhooks only.** Already supported for
  tagged commits, but requires PRs/commits and misses pre-PR work; agent-side
  `report_changes` is the primary, real-time path. Keep both.

## Consequences

- Drawer "Files touched" and "Subtasks" sections populate during normal agent
  work, matching the product's intent.
- Slightly longer `SWARM.md`; the extra steps are the ones that make the board
  reflect reality.
- Conflict detection (file- and line-level) gets real input, so the
  conflict/staleness signals become meaningful.
- Note: subtasks are intentionally hidden from board columns since
  `2026-06-12-nest-subtasks-under-parent.md`; they appear nested in the parent's
  drawer. This entry does not change that — it just ensures they get created.
- Follow-up (optional): empty-state hints in the drawer to make absence obvious.
