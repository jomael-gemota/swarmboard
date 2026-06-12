import { Router } from "express";
import { Task, Board, Member, ActivityLog } from "../models/index.js";
import mongoose from "mongoose";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { emitToBoard } from "../lib/socket.js";
import { recomputeBoardConflicts } from "../services/conflictDetection.js";
import { fetchAuthUsers, serializeUser } from "../lib/users.js";
import { z } from "zod";

const router = Router({ mergeParams: true });

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: z
    .enum(["backlog", "in_progress", "in_review", "verified", "deployed"])
    .default("backlog"),
  ownerId: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  agentType: z.enum(["cursor", "claude_code", "copilot", "windsurf", "other"]).optional(),
  position: z.number().int().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(["backlog", "in_progress", "in_review", "verified", "deployed"]).optional(),
  ownerId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  agentType: z.enum(["cursor", "claude_code", "copilot", "windsurf", "other"]).nullable().optional(),
  declaredFiles: z.array(z.string().max(500)).max(200).optional(),
  blocked: z.boolean().optional(),
  position: z.number().int().optional(),
});

async function assertBoardAccess(userId: string, boardId: string) {
  if (!mongoose.isValidObjectId(boardId)) return null;
  const board = await Board.findById(boardId).lean();
  if (!board) return null;

  const member = await Member.findOne({
    userId,
    organizationId: String(board.organizationId),
  }).lean();

  return member ? { board, member } : null;
}

function taskToJson(task: unknown, owner?: unknown, assignee?: unknown) {
  const t = task as Record<string, unknown>;
  return {
    ...t,
    id: String(t._id),
    boardId: String(t.boardId),
    parentId: t.parentId ? String(t.parentId) : null,
    ownerId: t.ownerId ? String(t.ownerId) : null,
    assigneeId: t.assigneeId ? String(t.assigneeId) : null,
    owner: owner ?? undefined,
    assignee: assignee ?? undefined,
  };
}

// GET /boards/:boardId/tasks
router.get("/", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { boardId } = req.params;

  const access = await assertBoardAccess(userId, boardId);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const tasks = await Task.find({ boardId })
    .sort({ position: 1, createdAt: 1 })
    .lean();

  const userMap = await fetchAuthUsers([
    ...tasks.map((t) => t.ownerId),
    ...tasks.map((t) => t.assigneeId),
  ]);

  res.json(
    tasks.map((t) =>
      taskToJson(t, serializeUser(t.ownerId, userMap), serializeUser(t.assigneeId, userMap))
    )
  );
});

// POST /boards/:boardId/tasks
router.post("/", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { boardId } = req.params;

  const access = await assertBoardAccess(userId, boardId);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (access.member.role === "viewer") {
    res.status(403).json({ error: "Viewers cannot create tasks" });
    return;
  }

  const parsed = CreateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const task = await Task.create({ ...parsed.data, boardId });

  await ActivityLog.create({
    taskId: task._id,
    userId,
    source: "user",
    content: "Task created",
  });

  const obj = task.toObject();
  const userMap = await fetchAuthUsers([obj.ownerId, obj.assigneeId]);
  const json = taskToJson(
    obj,
    serializeUser(obj.ownerId, userMap),
    serializeUser(obj.assigneeId, userMap)
  );

  emitToBoard(boardId, "task:created", json as never);
  res.status(201).json(json);
});

// PATCH /boards/:boardId/tasks/:taskId
router.patch("/:taskId", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { boardId, taskId } = req.params;

  const access = await assertBoardAccess(userId, boardId);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (access.member.role === "viewer") {
    res.status(403).json({ error: "Viewers cannot update tasks" });
    return;
  }

  const parsed = UpdateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const prevTask = await Task.findOne({ _id: taskId, boardId }).lean();
  if (!prevTask) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Reassignment guard: don't let an actively-owned task (in_progress/in_review)
  // be reassigned to a different user while someone's agent is mid-flight — it
  // must go back to backlog first. Prevents an assignee/owner mismatch.
  if (parsed.data.assigneeId !== undefined) {
    const nextAssignee = parsed.data.assigneeId ? String(parsed.data.assigneeId) : null;
    const activelyOwned =
      (prevTask.status === "in_progress" || prevTask.status === "in_review") &&
      !!prevTask.ownerId;
    if (activelyOwned && nextAssignee !== String(prevTask.ownerId)) {
      res.status(409).json({
        error:
          "Can't reassign a task that's actively in progress. Move it back to backlog (or clear its owner) before reassigning.",
      });
      return;
    }
  }

  // Clearing the blocked flag also clears the stored reason.
  const blockUpdate =
    parsed.data.blocked === false ? { blockReason: null } : {};

  const updated = await Task.findByIdAndUpdate(
    taskId,
    { ...parsed.data, ...blockUpdate, isStale: false },
    { new: true }
  ).lean();

  if (!updated) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (parsed.data.status && parsed.data.status !== prevTask.status) {
    await ActivityLog.create({
      taskId,
      userId,
      source: "user",
      content: `Status changed from ${prevTask.status} to ${parsed.data.status}`,
    });
  }

  if (parsed.data.blocked === false && prevTask.blocked) {
    await ActivityLog.create({
      taskId,
      userId,
      source: "user",
      content: "✅ Blocker cleared",
    });
  }

  const assigneeChanged =
    parsed.data.assigneeId !== undefined &&
    String(parsed.data.assigneeId ?? "") !== String(prevTask.assigneeId ?? "");
  if (assigneeChanged) {
    await ActivityLog.create({
      taskId,
      userId,
      source: "user",
      content: parsed.data.assigneeId ? "Task reassigned" : "Task unassigned",
      metadata: { assigneeId: parsed.data.assigneeId ?? null },
    });
  }

  const userMap = await fetchAuthUsers([updated.ownerId, updated.assigneeId]);
  const json = taskToJson(
    updated,
    serializeUser(updated.ownerId, userMap),
    serializeUser(updated.assigneeId, userMap)
  );
  emitToBoard(boardId, "task:updated", json as never);
  res.json(json);

  // Footprint or active-status changes can create/clear conflicts.
  if (
    parsed.data.declaredFiles !== undefined ||
    (parsed.data.status && parsed.data.status !== prevTask.status)
  ) {
    await recomputeBoardConflicts(boardId);
  }
});

// DELETE /boards/:boardId/tasks/:taskId
router.delete("/:taskId", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { boardId, taskId } = req.params;

  const access = await assertBoardAccess(userId, boardId);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (access.member.role === "viewer" || access.member.role === "member") {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  const task = await Task.findOne({ _id: taskId, boardId }).lean();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Cascade-delete immediate child tasks and their activity logs
  const children = await Task.find({ parentId: taskId, boardId }).lean();
  if (children.length > 0) {
    const childIds = children.map((c) => c._id);
    await ActivityLog.deleteMany({ taskId: { $in: childIds } });
    await Task.deleteMany({ _id: { $in: childIds } });
    for (const child of children) {
      emitToBoard(boardId, "task:deleted", String(child._id));
    }
  }

  // Delete the parent task and its activity logs
  await ActivityLog.deleteMany({ taskId });
  await Task.findByIdAndDelete(taskId);
  emitToBoard(boardId, "task:deleted", taskId);

  // Removing a task may clear conflicts it was causing on others.
  await recomputeBoardConflicts(boardId);
  res.status(204).send();
});

// GET /boards/:boardId/tasks/:taskId/activity
router.get("/:taskId/activity", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { boardId, taskId } = req.params;

  const access = await assertBoardAccess(userId, boardId);
  if (!access) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const logs = await ActivityLog.find({ taskId })
    .sort({ createdAt: 1 })
    .lean();

  const userMap = await fetchAuthUsers(logs.map((l) => l.userId));

  res.json(
    logs.map((l) => ({
      ...l,
      id: String(l._id),
      taskId: String(l.taskId),
      user: serializeUser(l.userId, userMap),
    }))
  );
});

export default router;
