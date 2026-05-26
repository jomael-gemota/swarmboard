import { Router } from "express";
import { Task, Board, ActivityLog } from "../models/index.js";
import { emitToBoard } from "../lib/socket.js";
import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import type { ActivitySource } from "../models/ActivityLog.js";

const router = Router();

const TASK_ID_PATTERN = /(?:\[TASK-([a-z0-9]+)\]|#swb-([a-z0-9]+))/gi;

function extractTaskIds(text: string): string[] {
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(TASK_ID_PATTERN.source, "gi");
  while ((match = re.exec(text)) !== null) {
    ids.push(match[1] ?? match[2]);
  }
  return [...new Set(ids)];
}

function verifyGithubSignature(req: Request, secret: string): boolean {
  const sig = req.headers["x-hub-signature-256"] as string;
  if (!sig) return false;
  const hmac = createHmac("sha256", secret);
  hmac.update(JSON.stringify(req.body));
  const expected = `sha256=${hmac.digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function verifyGitlabToken(req: Request, secret: string): boolean {
  return req.headers["x-gitlab-token"] === secret;
}

async function updateTaskFromGit(
  taskId: string,
  boardId: string,
  source: ActivitySource,
  content: string,
  metadata?: Record<string, unknown>
) {
  const task = await Task.findOne({ _id: taskId, boardId }).lean();
  if (!task) return null;

  const log = await ActivityLog.create({
    taskId,
    source,
    content,
    metadata: metadata ?? null,
  });

  await Task.findByIdAndUpdate(taskId, { isStale: false });

  emitToBoard(boardId, "activity:created", {
    ...log.toObject(),
    id: String(log._id),
    taskId,
  } as never);

  return log;
}

// POST /webhooks/github/:boardId
router.post("/github/:boardId", async (req: Request, res: Response) => {
  const { boardId } = req.params;

  const board = await Board.findById(boardId).lean();
  if (!board?.webhookSecret) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  if (!verifyGithubSignature(req, board.webhookSecret)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = req.headers["x-github-event"] as string;
  const payload = req.body;

  try {
    if (event === "push") {
      const commits: Array<{ id?: string; message: string; url: string; author: { name: string } }> =
        payload.commits ?? [];

      for (const commit of commits) {
        const ids = extractTaskIds(commit.message);
        for (const id of ids) {
          await updateTaskFromGit(id, boardId, "git", `Commit: ${commit.message}`, {
            commitUrl: commit.url,
            commitSha: commit.id,
            author: commit.author?.name,
          });
        }
      }
    } else if (event === "pull_request") {
      const pr = payload.pull_request;
      const prTitle: string = pr?.title ?? "";
      const prBody: string = pr?.body ?? "";
      const prAction: string = payload.action;
      const prUrl: string = pr?.html_url;

      const ids = [...extractTaskIds(prTitle), ...extractTaskIds(prBody)];
      for (const id of ids) {
        let content = `PR ${prAction}: "${prTitle}"`;
        const updates: Record<string, unknown> = { prUrl, isStale: false };

        if (prAction === "opened" || prAction === "reopened") {
          updates.status = "in_review";
          content = `PR opened: "${prTitle}"`;
        } else if (prAction === "closed" && pr?.merged) {
          updates.status = "verified";
          updates.verifiedComplete = true;
          content = `PR merged: "${prTitle}"`;
        }

        const task = await Task.findOne({ _id: id, boardId }).lean();
        if (task) {
          const updatedTask = await Task.findByIdAndUpdate(id, updates, { new: true }).lean();
          emitToBoard(boardId, "task:updated", {
            ...updatedTask,
            id: String(updatedTask?._id),
          } as never);
        }

        await updateTaskFromGit(id, boardId, "git", content, {
          prUrl,
          prAction,
          merged: pr?.merged,
        });
      }
    } else if (event === "check_run" || event === "status") {
      const ciPayload = event === "check_run" ? payload.check_run : payload;
      const state: string = event === "check_run" ? ciPayload?.conclusion : ciPayload?.state;
      const targetUrl: string = ciPayload?.details_url ?? ciPayload?.target_url;
      const sha: string = ciPayload?.head_sha ?? ciPayload?.sha;

      // Find recent git logs from this board that reference this commit SHA
      const recentLogs = await ActivityLog.find({
        source: "git",
      })
        .populate({
          path: "taskId",
          match: { boardId },
          select: "_id",
        })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      const ciStatusMap: Record<string, "pending" | "running" | "passed" | "failed"> = {
        success: "passed",
        failure: "failed",
        error: "failed",
        pending: "pending",
        in_progress: "running",
      };
      const ciStatus = ciStatusMap[state] ?? "pending";

      const seenTaskIds = new Set<string>();
      for (const log of recentLogs) {
        const meta = log.metadata as Record<string, unknown> | null;
        if (meta?.commitSha !== sha) continue;
        if (!log.taskId) continue;

        const taskId = String(log.taskId);
        if (seenTaskIds.has(taskId)) continue;
        seenTaskIds.add(taskId);

        const task = await Task.findOne({ _id: taskId, boardId }).lean();
        if (!task) continue;

        const updates: Record<string, unknown> = { ciStatus };
        if (ciStatus === "passed" && task.claimedComplete) {
          updates.verifiedComplete = true;
          updates.status = "verified";
        }

        const updatedTask = await Task.findByIdAndUpdate(taskId, updates, { new: true }).lean();
        emitToBoard(boardId, "task:updated", {
          ...updatedTask,
          id: String(updatedTask?._id),
        } as never);

        await updateTaskFromGit(
          taskId,
          boardId,
          "ci",
          `CI ${ciStatus}${targetUrl ? ` — ${targetUrl}` : ""}`,
          { sha, ciStatus, targetUrl }
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /webhooks/gitlab/:boardId
router.post("/gitlab/:boardId", async (req: Request, res: Response) => {
  const { boardId } = req.params;

  const board = await Board.findById(boardId).lean();
  if (!board?.webhookSecret) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  if (!verifyGitlabToken(req, board.webhookSecret)) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const event = req.headers["x-gitlab-event"] as string;
  const payload = req.body;

  try {
    if (event === "Push Hook") {
      const commits: Array<{ message: string; url: string; author: { name: string } }> =
        payload.commits ?? [];

      for (const commit of commits) {
        const ids = extractTaskIds(commit.message);
        for (const id of ids) {
          await updateTaskFromGit(id, boardId, "git", `Commit: ${commit.message}`, {
            commitUrl: commit.url,
            author: commit.author?.name,
          });
        }
      }
    } else if (event === "Merge Request Hook") {
      const mr = payload.object_attributes;
      const ids = extractTaskIds(`${mr.title} ${mr.description ?? ""}`);

      for (const id of ids) {
        let content = `MR ${mr.action}: "${mr.title}"`;
        if (mr.state === "merged") {
          await Task.findByIdAndUpdate(id, {
            status: "verified",
            verifiedComplete: true,
            prUrl: mr.url,
          });
          content = `MR merged: "${mr.title}"`;
        }
        await updateTaskFromGit(id, boardId, "git", content, {
          mrUrl: mr.url,
          state: mr.state,
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("GitLab webhook error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
