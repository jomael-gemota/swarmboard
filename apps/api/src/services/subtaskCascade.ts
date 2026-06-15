import { Task, ActivityLog } from "../models/index.js";
import { emitToBoard } from "../lib/socket.js";
import type { ActivitySource } from "../models/ActivityLog.js";

function taskJson(task: Record<string, unknown>) {
  return {
    ...task,
    id: String(task._id),
    boardId: String(task.boardId),
    parentId: task.parentId ? String(task.parentId) : null,
    ownerId: task.ownerId ? String(task.ownerId) : null,
    assigneeId: task.assigneeId ? String(task.assigneeId) : null,
  };
}

// A subtask is a breakdown of its parent, so it should follow the parent through
// the completion → PR → review → verified flow rather than being left behind in
// backlog. We never regress a subtask that's already at/past the target, so
// these are treated as terminal and skipped by default.
const TERMINAL_STATUSES = ["verified", "deployed"];

interface CascadeOptions {
  parentId: string;
  boardId: string;
  updates: Record<string, unknown>;
  activity?: { content: string; source: ActivitySource; userId?: string | null };
  // Include subtasks already verified/deployed (e.g. when the parent regresses).
  includeTerminal?: boolean;
}

/**
 * Apply a status/completion change to a parent task's direct subtasks and emit
 * the resulting `task:updated` (and optional `activity:created`) events so the
 * board reflects them live. Returns the number of subtasks updated.
 *
 * No-op when the task has no subtasks, so it's safe to call for any task.
 */
export async function cascadeToSubtasks(opts: CascadeOptions): Promise<number> {
  const { parentId, boardId, updates, activity, includeTerminal } = opts;

  const filter: Record<string, unknown> = { parentId, boardId };
  if (!includeTerminal) filter.status = { $nin: TERMINAL_STATUSES };

  const children = await Task.find(filter).select("_id").lean();

  for (const child of children) {
    const updated = await Task.findByIdAndUpdate(child._id, updates, { new: true }).lean();
    if (!updated) continue;

    emitToBoard(boardId, "task:updated", taskJson(updated as Record<string, unknown>) as never);

    if (activity) {
      const log = await ActivityLog.create({
        taskId: child._id,
        userId: activity.userId ?? null,
        source: activity.source,
        content: activity.content,
        metadata: { cascadedFromParent: parentId },
      });
      emitToBoard(boardId, "activity:created", {
        ...log.toObject(),
        id: String(log._id),
        taskId: String(child._id),
      } as never);
    }
  }

  return children.length;
}
