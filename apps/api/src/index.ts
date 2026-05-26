import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { toNodeHandler } from "better-auth/node";

import { connectMongoose, connectMongoClient } from "./lib/db.js";
import { initAuth, getAuth } from "./lib/auth.js";
import { createSocketServer } from "./lib/socket.js";
import {
  scheduleStalenessCheck,
  createStalenessWorker,
  createSummarizationWorker,
} from "./jobs/stalenessWorker.js";

import orgRoutes from "./routes/organizations.js";
import boardRoutes from "./routes/boards.js";
import taskRoutes from "./routes/tasks.js";
import agentApiRoutes from "./routes/agentApi.js";
import agentTokenRoutes from "./routes/agentTokens.js";
import webhookRoutes from "./routes/webhooks.js";
import dashboardRoutes from "./routes/dashboard.js";

async function bootstrap() {
  // ─── Connect to MongoDB ─────────────────────────────────────────────────────
  await connectMongoClient();
  await connectMongoose();

  // ─── Initialize Better Auth (requires DB connection) ───────────────────────
  initAuth();

  const app = express();
  const httpServer = createServer(app);

  // ─── Global Middleware ──────────────────────────────────────────────────────
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(morgan("dev"));
  app.use("/webhooks", express.json());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── Better Auth Handler ────────────────────────────────────────────────────
  app.all("/api/auth/*", toNodeHandler(getAuth()));

  // ─── API Routes ─────────────────────────────────────────────────────────────
  app.use("/api/orgs", orgRoutes);
  app.use("/api/orgs/:orgId/boards", boardRoutes);
  app.use("/api/boards/:boardId/tasks", taskRoutes);
  app.use("/api/orgs/:orgId/agent-tokens", agentTokenRoutes);
  app.use("/api/orgs/:orgId/dashboard", dashboardRoutes);
  app.use("/api/v1/tasks", agentApiRoutes);
  app.use("/webhooks", webhookRoutes);

  // ─── Health Check ───────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  // ─── Global Error Handler ────────────────────────────────────────────────────
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  // ─── Socket.io ──────────────────────────────────────────────────────────────
  createSocketServer(httpServer);

  // ─── Background Jobs ─────────────────────────────────────────────────────────
  createStalenessWorker();
  createSummarizationWorker();
  scheduleStalenessCheck().catch(console.error);

  // ─── Start ──────────────────────────────────────────────────────────────────
  const PORT = parseInt(process.env.PORT ?? "3001", 10);
  httpServer.listen(PORT, () => {
    console.log(`🐜 Swarmboard API running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
