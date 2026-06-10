import { Router } from "express";
import { Task, Board } from "../models/index.js";
import { requireAgentToken, type AgentRequest } from "../middleware/requireAgentToken.js";
import { TaskStatus } from "@swarmboard/shared";

const router = Router();

function taskJson(task: Record<string, unknown>) {
  return { ...task, id: String(task._id), boardId: String(task.boardId) };
}

// GET /api/v1/boards/:boardId/tasks?status=backlog
// Lists tasks on a board for an agent to pick up. Scoped to the token's org.
router.get("/:boardId/tasks", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const board = await Board.findOne({
    _id: req.params.boardId,
    organizationId: agentToken.organizationId,
  }).lean();

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

export default router;
