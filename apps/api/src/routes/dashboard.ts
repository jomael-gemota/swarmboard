import { Router } from "express";
import { Task, Board, Member, ActivityLog } from "../models/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import type { Types } from "mongoose";

const router = Router({ mergeParams: true });

// GET /orgs/:orgId/dashboard
router.get("/", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId } = req.params;

  const member = await Member.findOne({ userId, organizationId: orgId }).lean();
  if (!member) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const boards = await Board.find({ organizationId: orgId }).select("_id").lean();
  const boardIds: Types.ObjectId[] = boards.map((b) => b._id as Types.ObjectId);

  const [tasksByStatus, staleTasks, conflictTasks, recentActivity, memberStats] =
    await Promise.all([
      // Task count grouped by status
      Task.aggregate([
        { $match: { boardId: { $in: boardIds } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Stale tasks
      Task.find({ boardId: { $in: boardIds }, isStale: true })
        .populate("ownerId", "name email")
        .populate("boardId", "name")
        .sort({ updatedAt: 1 })
        .limit(20)
        .lean(),

      // Conflict tasks
      Task.find({ boardId: { $in: boardIds }, hasConflict: true })
        .populate("ownerId", "name email")
        .populate("boardId", "name")
        .limit(20)
        .lean(),

      // Recent activity (last 50 events)
      ActivityLog.find({ taskId: { $exists: true } })
        .populate({
          path: "taskId",
          match: { boardId: { $in: boardIds } },
          select: "title boardId",
        })
        .populate("userId", "name")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),

      // Per-member task stats
      Task.aggregate([
        {
          $match: {
            boardId: { $in: boardIds },
            ownerId: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: { ownerId: "$ownerId", status: "$status" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  // Build per-developer throughput map
  const memberThroughput: Record<string, Record<string, number>> = {};
  for (const row of memberStats) {
    const oid = String(row._id.ownerId);
    if (!memberThroughput[oid]) memberThroughput[oid] = {};
    memberThroughput[oid][row._id.status] = row.count;
  }

  // Active module heatmap
  const activeTasks = await Task.find({
    boardId: { $in: boardIds },
    status: { $in: ["in_progress", "in_review"] },
    modulePath: { $exists: true, $ne: null },
  })
    .select("modulePath")
    .lean();

  const moduleHeatmap: Record<string, number> = {};
  for (const t of activeTasks) {
    if (t.modulePath) {
      moduleHeatmap[t.modulePath] = (moduleHeatmap[t.modulePath] ?? 0) + 1;
    }
  }

  // Filter recentActivity to only include logs whose task belongs to a board in this org
  const filteredActivity = recentActivity
    .filter((l) => l.taskId != null)
    .map((l) => ({
      ...l,
      id: String(l._id),
      taskId: String(l.taskId),
    }));

  res.json({
    tasksByStatus: tasksByStatus.map((r) => ({ status: r._id, _count: r.count })),
    staleTasks: staleTasks.map((t) => ({ ...t, id: String(t._id) })),
    conflictTasks: conflictTasks.map((t) => ({ ...t, id: String(t._id) })),
    recentActivity: filteredActivity,
    memberThroughput,
    moduleHeatmap,
  });
});

export default router;
