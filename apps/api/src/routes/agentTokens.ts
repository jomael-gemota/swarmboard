import { Router } from "express";
import { AgentToken, Member } from "../models/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";

const router = Router({ mergeParams: true });

const CreateTokenSchema = z.object({
  name: z.string().min(1).max(100),
});

// GET /orgs/:orgId/agent-tokens
router.get("/", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId } = req.params;

  const member = await Member.findOne({ userId, organizationId: orgId }).lean();
  if (!member) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const query =
    member.role === "member" || member.role === "viewer"
      ? { organizationId: orgId, userId }
      : { organizationId: orgId };

  const tokens = await AgentToken.find(query)
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    tokens.map(({ tokenHash: _h, ...t }) => ({
      ...t,
      id: String(t._id),
      userId: String(t.userId),
    }))
  );
});

// POST /orgs/:orgId/agent-tokens
router.post("/", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId } = req.params;

  const member = await Member.findOne({ userId, organizationId: orgId }).lean();
  if (!member || member.role === "viewer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const rawToken = `swb_${randomBytes(32).toString("hex")}`;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const token = await AgentToken.create({
    name: parsed.data.name,
    tokenHash,
    organizationId: orgId,
    userId,
  });

  res.status(201).json({
    id: String(token._id),
    name: token.name,
    organizationId: orgId,
    userId,
    createdAt: token.createdAt,
    token: rawToken,
  });
});

// DELETE /orgs/:orgId/agent-tokens/:tokenId
router.delete("/:tokenId", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId, tokenId } = req.params;

  const member = await Member.findOne({ userId, organizationId: orgId }).lean();
  if (!member) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const token = await AgentToken.findOne({ _id: tokenId, organizationId: orgId }).lean();
  if (!token) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (
    String(token.userId) !== userId &&
    member.role !== "owner" &&
    member.role !== "admin"
  ) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  await AgentToken.findByIdAndDelete(tokenId);
  res.status(204).send();
});

export default router;
