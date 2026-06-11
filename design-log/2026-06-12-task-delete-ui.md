# Task & Sub-task Delete UI

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

The API already exposes `DELETE /boards/:boardId/tasks/:taskId` (admin/owner only) and the shared `tasksApi.delete` client method exists. The board page also already handles the `task:deleted` socket event. However, there is no UI surface (button, confirmation flow) that lets a user trigger a deletion from the board or task drawer.

Sub-tasks (child tasks with `parentId`) are real `Task` documents. Deleting a parent without deleting its children would leave orphaned sub-tasks on the board. The API currently only deletes the requested task — it does not cascade to children.

## Decision

1. **API cascade delete**: When a task is deleted, also delete all immediate child tasks (tasks where `parentId === taskId`). Emit `task:deleted` for each deleted child so real-time clients stay in sync. Activity logs for deleted tasks are also cleaned up.

2. **Delete button in `TaskDetailDrawer`**: A trash-icon button is added to the drawer header (only in non-editing mode). Clicking it opens an inline confirmation dialog (using the existing `Dialog` component) that:
   - Names the task being deleted.
   - Warns "This will also delete N sub-task(s)" when the task has children.
   - Provides Cancel and Delete (destructive) actions.

3. **Drawer auto-close on socket delete**: `BoardPage` clears `selectedTask` when its ID appears in a `task:deleted` socket event — so if another session deletes a task that the current user has open, the drawer closes gracefully.

4. **Permission model**: The existing API gate (admin/owner only, viewers and members get 403) is preserved. The delete button is shown to all authenticated users; a 403 response will surface as an error state on the mutation without a change to the permission model in this iteration.

## Alternatives Considered

- **Inline confirm (no dialog)**: Replace the delete button with a two-step "Delete / Confirm" toggle directly in the header. Simpler but harder to convey the sub-task warning clearly.
- **Extend permissions to members**: Allow members to delete their own tasks. Deferred — requires owner-tracking logic and a separate design decision.
- **Deep cascade**: Recursively delete sub-sub-tasks. Not needed today as the agent plan structure is max 2 levels (parent + subtasks).

## Consequences

- Orphaned sub-tasks on deletion are eliminated.
- Sub-tasks listed in the drawer are now deletable individually (each has its own delete flow when opened).
- The API `DELETE` endpoint gains a small DB query overhead (find + delete children) but this is negligible for board-scale workloads.
- Board settings "delete board" copy ("deletes all tasks") remains accurate — board delete already cascades via org/board delete paths.
