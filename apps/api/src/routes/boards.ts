import { Router } from "express";
import { Board, Member } from "../models/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { serialize } from "../lib/serialize.js";
import { randomBytes } from "crypto";
import { z } from "zod";

const router = Router({ mergeParams: true });

const CreateBoardSchema = z.object({
  name: z.string().min(1).max(100),
  repoUrl: z.string().url().optional(),
  repoProvider: z.enum(["github", "gitlab"]).optional(),
});

const UpdateBoardSchema = CreateBoardSchema.partial();

async function assertMember(userId: string, orgId: string, minRole?: string) {
  const member = await Member.findOne({ userId, organizationId: orgId }).lean();
  if (!member) return null;
  if (minRole === "admin" && (member.role === "viewer" || member.role === "member")) return null;
  return member;
}

// GET /orgs/:orgId/boards
router.get("/", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId } = req.params;

  if (!(await assertMember(userId, orgId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const boards = await Board.find({ organizationId: orgId }).sort({ createdAt: 1 }).lean();
  res.json(boards.map((b) => ({ ...b, id: String(b._id) })));
});

// POST /orgs/:orgId/boards
router.post("/", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId } = req.params;

  const caller = await assertMember(userId, orgId, "admin");
  if (!caller) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  const parsed = CreateBoardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const webhookSecret = randomBytes(32).toString("hex");
  const board = await Board.create({
    ...parsed.data,
    organizationId: orgId,
    webhookSecret,
  });

  res.status(201).json(serialize(board));
});

// GET /orgs/:orgId/boards/:boardId
router.get("/:boardId", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId, boardId } = req.params;

  if (!(await assertMember(userId, orgId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const board = await Board.findOne({ _id: boardId, organizationId: orgId }).lean();
  if (!board) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ ...board, id: String(board._id) });
});

// PATCH /orgs/:orgId/boards/:boardId
router.patch("/:boardId", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId, boardId } = req.params;

  if (!(await assertMember(userId, orgId, "admin"))) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  const parsed = UpdateBoardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const board = await Board.findByIdAndUpdate(boardId, parsed.data, { new: true }).lean();
  if (!board) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ ...board, id: String(board._id) });
});

// DELETE /orgs/:orgId/boards/:boardId
router.delete("/:boardId", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId, boardId } = req.params;

  if (!(await assertMember(userId, orgId, "admin"))) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  await Board.findByIdAndDelete(boardId);
  res.status(204).send();
});

export default router;
