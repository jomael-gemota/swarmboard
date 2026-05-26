import { Router } from "express";
import { Task, Board, Member, ActivityLog } from "../models/index.js";
import mongoose from "mongoose";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { emitToBoard } from "../lib/socket.js";
import { checkConflicts } from "../services/conflictDetection.js";
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
  agentType: z.enum(["cursor", "claude_code", "copilot", "windsurf", "other"]).optional(),
  modulePath: z.string().max(500).optional(),
  position: z.number().int().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(["backlog", "in_progress", "in_review", "verified", "deployed"]).optional(),
  ownerId: z.string().nullable().optional(),
  agentType: z.enum(["cursor", "claude_code", "copilot", "windsurf", "other"]).nullable().optional(),
  modulePath: z.string().max(500).nullable().optional(),
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

function taskToJson(task: unknown, owner?: unknown) {
  const t = task as Record<string, unknown>;
  return {
    ...t,
    id: String(t._id),
    boardId: String(t.boardId),
    ownerId: t.ownerId ? String(t.ownerId) : null,
    owner: owner ?? undefined,
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

  const userMap = await fetchAuthUsers(tasks.map((t) => t.ownerId));

  res.json(tasks.map((t) => taskToJson(t, serializeUser(t.ownerId, userMap))));
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
  const userMap = await fetchAuthUsers([obj.ownerId]);
  const json = taskToJson(obj, serializeUser(obj.ownerId, userMap));

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

  const updated = await Task.findByIdAndUpdate(
    taskId,
    { ...parsed.data, isStale: false },
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

  if (parsed.data.modulePath !== undefined) {
    await checkConflicts(boardId, taskId, parsed.data.modulePath ?? null);
  }

  const userMap = await fetchAuthUsers([updated.ownerId]);
  const json = taskToJson(updated, serializeUser(updated.ownerId, userMap));
  emitToBoard(boardId, "task:updated", json as never);
  res.json(json);
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

  await Task.findByIdAndDelete(taskId);
  emitToBoard(boardId, "task:deleted", taskId);
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
