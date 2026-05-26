import { Router } from "express";
import { Organization, Member } from "../models/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { serialize } from "../lib/serialize.js";
import { fetchAuthUsers, serializeUser } from "../lib/users.js";
import { z } from "zod";

const router = Router();

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
});

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

// GET /orgs — list orgs the current user belongs to
router.get("/", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;

  const members = await Member.find({ userId }).populate("organizationId").lean();

  res.json(
    members.map((m) => {
      const org = m.organizationId as unknown as Record<string, unknown>;
      return { ...org, id: String(org._id), role: m.role };
    })
  );
});

// POST /orgs — create organization
router.post("/", requireAuth, async (req, res) => {
  const parsed = CreateOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const userId = (req as AuthenticatedRequest).userId;
  const { name, slug } = parsed.data;

  const existing = await Organization.findOne({ slug });
  if (existing) {
    res.status(409).json({ error: "Slug already taken" });
    return;
  }

  const org = await Organization.create({ name, slug });

  await Member.create({
    userId,
    organizationId: org._id,
    role: "owner",
  });

  res.status(201).json(serialize(org));
});

// GET /orgs/:orgId — get org details with members
router.get("/:orgId", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId } = req.params;

  const membership = await Member.findOne({ userId, organizationId: orgId });
  if (!membership) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const org = await Organization.findById(orgId).lean();
  if (!org) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const members = await Member.find({ organizationId: orgId }).lean();

  const userMap = await fetchAuthUsers(members.map((m) => m.userId));

  res.json({
    ...org,
    id: String(org._id),
    members: members.map((m) => ({
      id: String(m._id),
      role: m.role,
      user: serializeUser(m.userId, userMap),
    })),
  });
});

// POST /orgs/:orgId/members — invite member by email
router.post("/:orgId/members", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId } = req.params;

  const caller = await Member.findOne({ userId, organizationId: orgId });
  if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  const parsed = InviteMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, role } = parsed.data;

  // Better Auth stores users in its own collection — query via native mongo
  // We look up by email in the "user" collection (Better Auth convention)
  const { getAuthDb } = await import("../lib/db.js");
  const invitee = await getAuthDb().collection("user").findOne({ email });
  if (!invitee) {
    res.status(404).json({ error: "No user found with that email" });
    return;
  }

  const existingMember = await Member.findOne({
    userId: String(invitee._id),
    organizationId: orgId,
  });
  if (existingMember) {
    res.status(409).json({ error: "Already a member" });
    return;
  }

  const newMember = await Member.create({
    userId: String(invitee._id),
    organizationId: orgId,
    role,
  });

  res.status(201).json({
    id: String(newMember._id),
    role: newMember.role,
    user: { name: invitee.name, email: invitee.email, image: invitee.image },
  });
});

// PATCH /orgs/:orgId/members/:memberId — update member role
router.patch("/:orgId/members/:memberId", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId, memberId } = req.params;

  const caller = await Member.findOne({ userId, organizationId: orgId });
  if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  const RoleSchema = z.object({ role: z.enum(["admin", "member", "viewer"]) });
  const parsed = RoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const updated = await Member.findByIdAndUpdate(
    memberId,
    { role: parsed.data.role },
    { new: true }
  ).lean();

  if (!updated) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const userMap = await fetchAuthUsers([updated.userId]);

  res.json({
    id: String(updated._id),
    role: updated.role,
    user: serializeUser(updated.userId, userMap),
  });
});

// DELETE /orgs/:orgId/members/:memberId — remove member
router.delete("/:orgId/members/:memberId", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orgId, memberId } = req.params;

  const caller = await Member.findOne({ userId, organizationId: orgId });
  if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  await Member.findByIdAndDelete(memberId);
  res.status(204).send();
});

export default router;
