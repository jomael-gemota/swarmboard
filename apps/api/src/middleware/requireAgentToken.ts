import type { Request, Response, NextFunction } from "express";
import { AgentToken } from "../models/index.js";
import { createHash } from "crypto";

export interface AgentRequest extends Request {
  agentToken: {
    id: string;
    userId: string;
    organizationId: string;
  };
}

export async function requireAgentToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing agent token" });
    return;
  }

  const rawToken = authHeader.slice(7);
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const agentToken = await AgentToken.findOne({ tokenHash }).lean();

  if (!agentToken) {
    res.status(401).json({ error: "Invalid agent token" });
    return;
  }

  // Update last used timestamp (fire-and-forget)
  AgentToken.findByIdAndUpdate(agentToken._id, { lastUsedAt: new Date() }).catch(() => {});

  (req as AgentRequest).agentToken = {
    id: String(agentToken._id),
    userId: String(agentToken.userId),
    organizationId: String(agentToken.organizationId),
  };

  next();
}
