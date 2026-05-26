import { Task, ActivityLog } from "../models/index.js";
import { emitToBoard } from "../lib/socket.js";

export async function checkConflicts(
  boardId: string,
  taskId: string,
  modulePath: string | null
): Promise<void> {
  if (!modulePath) {
    await Task.findByIdAndUpdate(taskId, { hasConflict: false });
    return;
  }

  const conflicting = await Task.find({
    boardId,
    modulePath,
    _id: { $ne: taskId },
    status: { $in: ["in_progress", "in_review"] },
  }).lean();

  if (conflicting.length > 0) {
    const conflictingIds = conflicting.map((t) => t._id);

    await Task.updateMany(
      { _id: { $in: [taskId, ...conflictingIds] } },
      { hasConflict: true }
    );

    for (const conflict of conflicting) {
      emitToBoard(boardId, "conflict:detected", {
        taskId,
        conflictingTaskId: String(conflict._id),
        modulePath,
      } as never);

      await ActivityLog.create({
        taskId,
        source: "system",
        content: `⚠️ Conflict: Another agent is working on the same module (${modulePath}). Task: ${String(conflict._id)}`,
        metadata: { conflictingTaskId: String(conflict._id), modulePath },
      });

      await ActivityLog.create({
        taskId: conflict._id,
        source: "system",
        content: `⚠️ Conflict: Another agent is working on the same module (${modulePath}). Task: ${taskId}`,
        metadata: { conflictingTaskId: taskId, modulePath },
      });
    }
  } else {
    await Task.findByIdAndUpdate(taskId, { hasConflict: false });
  }
}
