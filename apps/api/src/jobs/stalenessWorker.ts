import { Worker, Queue } from "bullmq";
import { redis } from "../lib/redis.js";
import { Task, ActivityLog } from "../models/index.js";
import { emitToBoard } from "../lib/socket.js";
import { summarizeActivityLogs } from "../services/summarization.js";

const QUEUE_NAME = "staleness";
const STALE_THRESHOLD_HOURS = 4;

export const stalenessQueue = new Queue(QUEUE_NAME, { connection: redis });

export async function scheduleStalenessCheck() {
  await stalenessQueue.add(
    "check",
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );
  console.log("Staleness check scheduled");
}

export function createStalenessWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const threshold = new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);

      const staleTasks = await Task.find({
        status: { $in: ["in_progress", "in_review"] },
        isStale: false,
        updatedAt: { $lt: threshold },
      }).lean();

      for (const task of staleTasks) {
        await Task.findByIdAndUpdate(task._id, { isStale: true });

        await ActivityLog.create({
          taskId: task._id,
          source: "system",
          content: `⏰ Task flagged as stale — no updates for ${STALE_THRESHOLD_HOURS}+ hours`,
        });

        emitToBoard(String(task.boardId), "task:stale", {
          taskId: String(task._id),
        } as never);
      }

      console.log(`Staleness check complete — flagged ${staleTasks.length} tasks`);
    },
    { connection: redis }
  );

  worker.on("failed", (job, err) => {
    console.error(`Staleness job ${job?.id} failed:`, err);
  });

  return worker;
}

// ─── Summarization Queue ──────────────────────────────────────────────────────

const SUMMARY_QUEUE_NAME = "summarization";
export const summarizationQueue = new Queue(SUMMARY_QUEUE_NAME, { connection: redis });

export function createSummarizationWorker() {
  const worker = new Worker(
    SUMMARY_QUEUE_NAME,
    async (job) => {
      const { taskId } = job.data as { taskId: string };

      const logs = await ActivityLog.find({
        taskId,
        source: { $in: ["agent", "git", "ci"] },
      })
        .sort({ createdAt: 1 })
        .lean();

      if (logs.length === 0) return;

      const summary = await summarizeActivityLogs(
        logs.map((l) => ({ source: l.source, content: l.content, createdAt: l.createdAt }))
      );

      const lastAgentLog = [...logs].reverse().find((l) => l.source === "agent");
      if (lastAgentLog) {
        await ActivityLog.findByIdAndUpdate(lastAgentLog._id, { summary });
      }

      console.log(`Summarized task ${taskId}`);
    },
    { connection: redis }
  );

  return worker;
}
