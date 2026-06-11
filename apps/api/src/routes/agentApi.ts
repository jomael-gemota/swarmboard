import { Router } from "express";
import { Task, Board, ActivityLog } from "../models/index.js";
import { requireAgentToken, type AgentRequest } from "../middleware/requireAgentToken.js";
import { emitToBoard } from "../lib/socket.js";
import { recomputeBoardConflicts } from "../services/conflictDetection.js";
import {
  ClaimTaskPayload,
  UpdateTaskPayload,
  SubtaskPayload,
  BlockTaskPayload,
  CompleteTaskPayload,
  ReportChangesPayload,
} from "@swarmboard/shared";

const router = Router();

async function getTaskWithBoard(taskId: string, organizationId: string) {
  const task = await Task.findById(taskId).lean();
  if (!task) return null;

  const board = await Board.findOne({
    _id: String(task.boardId),
    organizationId,
  }).lean();

  return board ? { task, board } : null;
}

function taskJson(task: Record<string, unknown>) {
  return {
    ...task,
    id: String(task._id),
    boardId: String(task.boardId),
    parentId: task.parentId ? String(task.parentId) : null,
  };
}

// POST /api/v1/tasks/:taskId/claim
router.post("/:taskId/claim", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const parsed = ClaimTaskPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const found = await getTaskWithBoard(req.params.taskId, agentToken.organizationId);
  if (!found) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const { task, board } = found;

  // Atomic claim guard: only refuse if the task is *actively* owned by a
  // different user (in_progress / in_review). Backlog, unowned, or
  // self-owned tasks remain claimable. Guarding inside the query filter
  // prevents two agents pulling from the same backlog from stealing it.
  const updatedTask = await Task.findOneAndUpdate(
    {
      _id: task._id,
      $nor: [
        {
          status: { $in: ["in_progress", "in_review"] },
          ownerId: { $nin: [null, agentToken.userId] },
        },
      ],
    },
    {
      status: "in_progress",
      ownerId: agentToken.userId,
      ...(parsed.data.agentType && { agentType: parsed.data.agentType }),
      ...(parsed.data.modulePath && { modulePath: parsed.data.modulePath }),
      ...(parsed.data.files && { declaredFiles: parsed.data.files }),
      isStale: false,
      claimedComplete: false,
    },
    { new: true }
  ).lean();

  if (!updatedTask) {
    res.status(409).json({ error: "Task is already claimed by another user" });
    return;
  }

  const log = await ActivityLog.create({
    taskId: task._id,
    userId: agentToken.userId,
    source: "agent",
    content: "Agent claimed this task",
    metadata: { agentType: parsed.data.agentType, modulePath: parsed.data.modulePath },
  });

  const boardId = String(board._id);
  emitToBoard(boardId, "task:updated", taskJson(updatedTask as Record<string, unknown>) as never);
  emitToBoard(boardId, "activity:created", {
    ...log.toObject(),
    id: String(log._id),
    taskId: String(task._id),
  } as never);

  res.json({ task: updatedTask, log });

  // Re-evaluate file-overlap conflicts now that this task is active and has a
  // declared footprint (module path / files).
  await recomputeBoardConflicts(boardId);
});

// POST /api/v1/tasks/:taskId/update
router.post("/:taskId/update", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const parsed = UpdateTaskPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const found = await getTaskWithBoard(req.params.taskId, agentToken.organizationId);
  if (!found) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await Task.findByIdAndUpdate(found.task._id, { isStale: false });

  const log = await ActivityLog.create({
    taskId: found.task._id,
    userId: agentToken.userId,
    source: "agent",
    content: parsed.data.message,
    metadata: parsed.data.metadata ?? null,
  });

  emitToBoard(String(found.board._id), "activity:created", {
    ...log.toObject(),
    id: String(log._id),
    taskId: String(found.task._id),
  } as never);

  res.json({ log });
});

// POST /api/v1/tasks/:taskId/changes — report changed files + line ranges
router.post("/:taskId/changes", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const parsed = ReportChangesPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const found = await getTaskWithBoard(req.params.taskId, agentToken.organizationId);
  if (!found) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const lineRanges = parsed.data.files.flatMap((f) =>
    (f.ranges ?? []).map((r) => ({ file: f.path, start: r.start, end: r.end }))
  );
  const filePaths = parsed.data.files.map((f) => f.path);

  // A report is a full snapshot of the current diff: replace lineRanges, and
  // keep the cumulative changed-file list in sync for file-level fallback.
  const updatedTask = await Task.findByIdAndUpdate(
    found.task._id,
    {
      lineRanges,
      isStale: false,
      ...(filePaths.length > 0 && { $addToSet: { changedFiles: { $each: filePaths } } }),
    },
    { new: true }
  ).lean();

  const log = await ActivityLog.create({
    taskId: found.task._id,
    userId: agentToken.userId,
    source: "agent",
    content: `Agent reported changes to ${filePaths.length} file(s)${
      lineRanges.length ? ` (${lineRanges.length} line range(s))` : ""
    }`,
    metadata: { files: filePaths, lineRanges },
  });

  const boardId = String(found.board._id);
  emitToBoard(boardId, "task:updated", taskJson(updatedTask as Record<string, unknown>) as never);
  emitToBoard(boardId, "activity:created", {
    ...log.toObject(),
    id: String(log._id),
    taskId: String(found.task._id),
  } as never);

  res.json({ task: updatedTask, log });

  // Line ranges feed line-level overlap detection.
  await recomputeBoardConflicts(boardId);
});

// POST /api/v1/tasks/:taskId/subtask
router.post("/:taskId/subtask", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const parsed = SubtaskPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const found = await getTaskWithBoard(req.params.taskId, agentToken.organizationId);
  if (!found) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const status = parsed.data.done ? "✅" : "⬜";
  const log = await ActivityLog.create({
    taskId: found.task._id,
    userId: agentToken.userId,
    source: "agent",
    content: `${status} Subtask: ${parsed.data.title}`,
    metadata: { subtask: parsed.data.title, done: parsed.data.done },
  });

  await Task.findByIdAndUpdate(found.task._id, { isStale: false });

  emitToBoard(String(found.board._id), "activity:created", {
    ...log.toObject(),
    id: String(log._id),
    taskId: String(found.task._id),
  } as never);

  res.json({ log });
});

// POST /api/v1/tasks/:taskId/block
router.post("/:taskId/block", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const parsed = BlockTaskPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const found = await getTaskWithBoard(req.params.taskId, agentToken.organizationId);
  if (!found) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const updatedTask = await Task.findByIdAndUpdate(
    found.task._id,
    { status: "in_review", isStale: false },
    { new: true }
  ).lean();

  const log = await ActivityLog.create({
    taskId: found.task._id,
    userId: agentToken.userId,
    source: "agent",
    content: `🚫 Blocker: ${parsed.data.reason}`,
    metadata: { blocker: true, reason: parsed.data.reason },
  });

  const boardId = String(found.board._id);
  emitToBoard(boardId, "task:updated", taskJson(updatedTask as Record<string, unknown>) as never);
  emitToBoard(boardId, "activity:created", {
    ...log.toObject(),
    id: String(log._id),
    taskId: String(found.task._id),
  } as never);

  res.json({ task: updatedTask, log });
});

// POST /api/v1/tasks/:taskId/complete
router.post("/:taskId/complete", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const parsed = CompleteTaskPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const found = await getTaskWithBoard(req.params.taskId, agentToken.organizationId);
  if (!found) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const updatedTask = await Task.findByIdAndUpdate(
    found.task._id,
    { status: "in_review", claimedComplete: true, isStale: false },
    { new: true }
  ).lean();

  const content = parsed.data.summary
    ? `Agent marked complete: ${parsed.data.summary}`
    : "Agent marked this task as complete (pending verification)";

  const log = await ActivityLog.create({
    taskId: found.task._id,
    userId: agentToken.userId,
    source: "agent",
    content,
    metadata: { claimedComplete: true },
  });

  const boardId = String(found.board._id);
  emitToBoard(boardId, "task:updated", taskJson(updatedTask as Record<string, unknown>) as never);
  emitToBoard(boardId, "activity:created", {
    ...log.toObject(),
    id: String(log._id),
    taskId: String(found.task._id),
  } as never);

  res.json({ task: updatedTask, log });
});

// GET /api/v1/tasks — list active tasks for current agent user
router.get("/", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const boards = await Board.find({ organizationId: agentToken.organizationId })
    .select("_id")
    .lean();
  const boardIds = boards.map((b) => b._id);

  const tasks = await Task.find({
    ownerId: agentToken.userId,
    boardId: { $in: boardIds },
    status: { $in: ["in_progress", "in_review"] },
  })
    .sort({ updatedAt: -1 })
    .lean();

  res.json(tasks.map((t) => taskJson(t as Record<string, unknown>)));
});

export default router;
