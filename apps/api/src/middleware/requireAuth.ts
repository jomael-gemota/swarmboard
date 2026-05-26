import type { Request, Response, NextFunction } from "express";
import { getAuth } from "../lib/auth.js";
import { Member } from "../models/index.js";

export interface AuthenticatedRequest extends Request {
  userId: string;
  sessionId: string;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await getAuth().api.getSession({
      headers: req.headers as unknown as Headers,
    });
    if (!session?.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as AuthenticatedRequest).userId = session.user.id;
    (req as AuthenticatedRequest).sessionId = session.session.id;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export async function requireOrgMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { orgId } = req.params;

  const member = await Member.findOne({
    userId: authReq.userId,
    organizationId: orgId,
  }).lean();

  if (!member) {
    res.status(403).json({ error: "Not a member of this organization" });
    return;
  }

  next();
}
