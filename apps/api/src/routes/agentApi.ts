import { Router } from "express";
import { Task, Board, ActivityLog } from "../models/index.js";
import { requireAgentToken, type AgentRequest } from "../middleware/requireAgentToken.js";
import { emitToBoard } from "../lib/socket.js";
import { recomputeBoardConflicts } from "../services/conflictDetection.js";
import { cascadeToSubtasks } from "../services/subtaskCascade.js";
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
    ownerId: task.ownerId ? String(task.ownerId) : null,
    assigneeId: task.assigneeId ? String(task.assigneeId) : null,
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

  // Per-board assignment policy: when on, an agent may only claim a task that is
  // explicitly assigned to its own token user. Unassigned tasks are not
  // claimable — a human must assign them first. Off (default) preserves the open
  // shared-backlog behavior. Pre-checked here for clear messaging; the assignee
  // condition is also enforced atomically in the claim filter below.
  const requireAssignee = board.requireAssigneeToClaim ?? false;
  if (requireAssignee) {
    if (!task.assigneeId) {
      res.status(403).json({
        error:
          "This board requires tasks to be assigned before an agent can claim them. Ask a human to assign this task to you.",
      });
      return;
    }
    if (String(task.assigneeId) !== agentToken.userId) {
      res.status(403).json({
        error: "This task is assigned to a different user and cannot be claimed by you.",
      });
      return;
    }
  }

  // Atomic claim guard: refuse if the task is *actively* owned by a different
  // user (in_progress / in_review), and — when the board requires it — if it is
  // not assigned to this user. Backlog, unowned, or self-owned tasks otherwise
  // remain claimable. Guarding inside the query filter prevents two agents
  // pulling from the same backlog from stealing it. Claiming also stamps
  // assigneeId so assignment stays consistent with ownership.
  const updatedTask = await Task.findOneAndUpdate(
    {
      _id: task._id,
      ...(requireAssignee && { assigneeId: agentToken.userId }),
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
      assigneeId: agentToken.userId,
      ...(parsed.data.agentType && { agentType: parsed.data.agentType }),
      ...(parsed.data.agentModel && { agentModel: parsed.data.agentModel }),
      ...(parsed.data.files && { declaredFiles: parsed.data.files }),
      isStale: false,
      claimedComplete: false,
      blocked: false,
      blockReason: null,
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
    metadata: {
      agentType: parsed.data.agentType,
      agentModel: parsed.data.agentModel,
    },
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
  // Only keep stats for files that reported at least one count.
  const fileStats = parsed.data.files
    .filter((f) => f.additions != null || f.deletions != null)
    .map((f) => ({
      file: f.path,
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
    }));

  // A report is a full snapshot of the current diff: replace lineRanges and
  // fileStats, and keep the cumulative changed-file list in sync for the
  // file-level fallback.
  const updatedTask = await Task.findByIdAndUpdate(
    found.task._id,
    {
      lineRanges,
      fileStats,
      isStale: false,
      blocked: false,
      blockReason: null,
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

  // A blocker is a transient "needs a human" condition, not a workflow stage.
  // Flag the task in place (it stays in its current column) rather than moving
  // it to in_review, which would imply the work is reviewable.
  const updatedTask = await Task.findByIdAndUpdate(
    found.task._id,
    { blocked: true, blockReason: parsed.data.reason, isStale: false },
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

  const { task, board } = found;

  // Per-board review policy: when a board requires a PR before review, an agent
  // completing a task without a linked PR is recorded as *claimed complete* but
  // stays in `in_progress` ("done · awaiting PR"). The authoritative move into
  // `in_review` is the `pull_request opened` webhook, which stamps `prUrl`.
  // Boards with no connected repo (or the policy explicitly off) trust the agent
  // and move straight to `in_review`, as before. Default: gate when a repo is
  // connected (`repoUrl` present).
  const requirePr = board.requirePrForReview ?? !!board.repoUrl;
  const awaitingPr = requirePr && !task.prUrl;
  const newStatus = awaitingPr ? "in_progress" : "in_review";

  const updatedTask = await Task.findByIdAndUpdate(
    task._id,
    {
      status: newStatus,
      claimedComplete: true,
      isStale: false,
      blocked: false,
      blockReason: null,
      ...(parsed.data.agentModel && { agentModel: parsed.data.agentModel }),
    },
    { new: true }
  ).lean();

  const content = awaitingPr
    ? parsed.data.summary
      ? `Agent marked complete (awaiting PR before review): ${parsed.data.summary}`
      : "Agent marked this task as complete — awaiting a PR before it moves to review"
    : parsed.data.summary
      ? `Agent marked complete: ${parsed.data.summary}`
      : "Agent marked this task as complete (pending verification)";

  const log = await ActivityLog.create({
    taskId: task._id,
    userId: agentToken.userId,
    source: "agent",
    content,
    metadata: { claimedComplete: true, awaitingPr, agentModel: parsed.data.agentModel },
  });

  const boardId = String(board._id);
  emitToBoard(boardId, "task:updated", taskJson(updatedTask as Record<string, unknown>) as never);
  emitToBoard(boardId, "activity:created", {
    ...log.toObject(),
    id: String(log._id),
    taskId: String(task._id),
  } as never);

  // Subtasks are a breakdown of the parent: completing the parent means its open
  // subtasks are done too. Mirror the parent's resulting state onto them so they
  // don't sit in backlog under a "done" parent — "Done · awaiting PR" when held
  // for a PR, otherwise straight to in_review.
  await cascadeToSubtasks({
    parentId: String(task._id),
    boardId,
    updates: {
      status: newStatus,
      claimedComplete: true,
      isStale: false,
      blocked: false,
      blockReason: null,
    },
    activity: {
      source: "agent",
      userId: agentToken.userId,
      content: awaitingPr
        ? "Marked done with parent task — awaiting PR before review"
        : "Marked done with parent task",
    },
  });

  res.json({ task: updatedTask, log });
});

// GET /api/v1/tasks — list active tasks for current agent user
router.get("/", requireAgentToken, async (req, res) => {
  const { agentToken } = req as AgentRequest;

  const boards = await Board.find({ organizationId: agentToken.organizationId })
    .select("_id")
    .lean();
  const boardIds = boards.map((b) => b._id);

  // Surface both what the agent is actively working (owned, in_progress/in_review)
  // and its claimable queue (backlog tasks assigned to this user).
  const tasks = await Task.find({
    boardId: { $in: boardIds },
    $or: [
      { ownerId: agentToken.userId, status: { $in: ["in_progress", "in_review"] } },
      { assigneeId: agentToken.userId, status: "backlog" },
    ],
  })
    .sort({ updatedAt: -1 })
    .lean();

  res.json(tasks.map((t) => taskJson(t as Record<string, unknown>)));
});

export default router;
