import { Router } from "express";
import { Task, Board, ActivityLog } from "../models/index.js";
import { requireAgentToken, type AgentRequest } from "../middleware/requireAgentToken.js";
import { emitToBoard } from "../lib/socket.js";
import { TaskStatus, CreateAgentTaskPayload, CreatePlanPayload } from "@swarmboard/shared";

const router = Router();

function taskJson(task: Record<string, unknown>) {
  return {
    ...task,
    id: String(task._id),
    boardId: String(task.boardId),
    parentId: task.parentId ? String(task.parentId) : null,
    ownerId: task.ownerId ? String(task.ownerId) : null,
  };
}

async function getBoardForToken(boardId: string, organizationId: string) {
  return Board.findOne({ _id: boardId, organizationId }).lean();
}

async function nextBacklogPosition(boardId: unknown): Promise<number> {
  const last = await Task.findOne({ boardId }).sort({ position: -1 }).select("position").lean();
  return (last?.position ?? -1) + 1;
}

// GET /api/v1/boards/:boardId/tasks?status=backlog
// Lists tasks on a board for an agent to pick up. Scoped to the token's org.
router.get("/:boardId/tasks", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const board = await getBoardForToken(req.params.boardId, agentToken.organizationId);
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const statusParam = typeof req.query.status === "string" ? req.query.status : "backlog";
  const parsedStatus = TaskStatus.safeParse(statusParam);
  if (!parsedStatus.success) {
    res.status(400).json({ error: `Invalid status: ${statusParam}` });
    return;
  }

  const tasks = await Task.find({
    boardId: board._id,
    status: parsedStatus.data,
  })
    .sort({ position: 1, createdAt: 1 })
    .lean();

  res.json(tasks.map((t) => taskJson(t as Record<string, unknown>)));
});

// POST /api/v1/boards/:boardId/tasks — create a single backlog task
router.post("/:boardId/tasks", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const board = await getBoardForToken(req.params.boardId, agentToken.organizationId);
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const parsed = CreateAgentTaskPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  // If a parent is given, it must belong to the same board.
  if (parsed.data.parentId) {
    const parent = await Task.findOne({
      _id: parsed.data.parentId,
      boardId: board._id,
    })
      .select("_id")
      .lean();
    if (!parent) {
      res.status(400).json({ error: "parentId does not reference a task on this board" });
      return;
    }
  }

  const position = await nextBacklogPosition(board._id);
  const task = await Task.create({
    title: parsed.data.title,
    description: parsed.data.description,
    modulePath: parsed.data.modulePath,
    parentId: parsed.data.parentId,
    boardId: board._id,
    status: "backlog",
    position,
  });

  const log = await ActivityLog.create({
    taskId: task._id,
    userId: agentToken.userId,
    source: "agent",
    content: "Agent created this task",
  });

  const json = taskJson(task.toObject() as unknown as Record<string, unknown>);
  const boardId = String(board._id);
  emitToBoard(boardId, "task:created", json as never);
  emitToBoard(boardId, "activity:created", {
    ...log.toObject(),
    id: String(log._id),
    taskId: String(task._id),
  } as never);

  res.status(201).json(json);
});

// POST /api/v1/boards/:boardId/plan — create an agreed plan (tasks + subtasks)
router.post("/:boardId/plan", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const board = await getBoardForToken(req.params.boardId, agentToken.organizationId);
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const parsed = CreatePlanPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  let position = await nextBacklogPosition(board._id);
  const created: Record<string, unknown>[] = [];

  for (const item of parsed.data.tasks) {
    const parent = await Task.create({
      title: item.title,
      description: item.description,
      modulePath: item.modulePath,
      boardId: board._id,
      status: "backlog",
      position: position++,
    });
    await ActivityLog.create({
      taskId: parent._id,
      userId: agentToken.userId,
      source: "agent",
      content: "Agent created this task from a plan",
    });
    const parentJson = taskJson(parent.toObject() as unknown as Record<string, unknown>);
    created.push(parentJson);
    emitToBoard(String(board._id), "task:created", parentJson as never);

    for (const sub of item.subtasks ?? []) {
      const child = await Task.create({
        title: sub.title,
        description: sub.description,
        modulePath: sub.modulePath,
        parentId: parent._id,
        boardId: board._id,
        status: "backlog",
        position: position++,
      });
      await ActivityLog.create({
        taskId: child._id,
        userId: agentToken.userId,
        source: "agent",
        content: "Agent created this subtask from a plan",
      });
      const childJson = taskJson(child.toObject() as unknown as Record<string, unknown>);
      created.push(childJson);
      emitToBoard(String(board._id), "task:created", childJson as never);
    }
  }

  res.status(201).json({ created, count: created.length });
});

export default router;
