import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const TaskStatus = z.enum([
  "backlog",
  "in_progress",
  "in_review",
  "verified",
  "deployed",
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const MemberRole = z.enum(["owner", "admin", "member", "viewer"]);
export type MemberRole = z.infer<typeof MemberRole>;

export const AgentType = z.enum([
  "cursor",
  "claude_code",
  "copilot",
  "windsurf",
  "other",
]);
export type AgentType = z.infer<typeof AgentType>;

export const ActivitySource = z.enum(["agent", "git", "ci", "system", "user"]);
export type ActivitySource = z.infer<typeof ActivitySource>;

// ─── Core Entities ────────────────────────────────────────────────────────────

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string().datetime(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const MemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  role: MemberRole,
  user: UserSchema.optional(),
});
export type Member = z.infer<typeof MemberSchema>;

export const BoardSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  repoUrl: z.string().nullable().optional(),
  repoProvider: z.enum(["github", "gitlab"]).nullable().optional(),
  webhookSecret: z.string().nullable().optional(),
  requirePrForReview: z.boolean().nullable().optional(),
  requireAssigneeToClaim: z.boolean().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Board = z.infer<typeof BoardSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatus,
  boardId: z.string(),
  parentId: z.string().nullable().optional(),
  ownerId: z.string().nullable(),
  assigneeId: z.string().nullable().optional(),
  agentType: AgentType.nullable(),
  agentModel: z.string().nullable().optional(),
  declaredFiles: z.array(z.string()).optional(),
  changedFiles: z.array(z.string()).optional(),
  lineRanges: z
    .array(z.object({ file: z.string(), start: z.number(), end: z.number() }))
    .optional(),
  claimedComplete: z.boolean(),
  verifiedComplete: z.boolean(),
  isStale: z.boolean(),
  hasConflict: z.boolean(),
  blocked: z.boolean(),
  blockReason: z.string().nullable().optional(),
  prUrl: z.string().nullable(),
  ciStatus: z.enum(["pending", "running", "passed", "failed"]).nullable(),
  position: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  owner: UserSchema.optional(),
  assignee: UserSchema.optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const ActivityLogSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  userId: z.string().nullable().optional(),
  source: ActivitySource,
  content: z.string(),
  summary: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  user: UserSchema.optional(),
});
export type ActivityLog = z.infer<typeof ActivityLogSchema>;

export const AgentTokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  token: z.string().optional(),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  user: UserSchema.optional(),
});
export type AgentToken = z.infer<typeof AgentTokenSchema>;

// ─── API Payloads ─────────────────────────────────────────────────────────────

export const ClaimTaskPayload = z.object({
  agentType: AgentType.optional(),
  agentModel: z.string().max(100).optional(),
  files: z.array(z.string().max(500)).max(200).optional(),
});
export type ClaimTaskPayload = z.infer<typeof ClaimTaskPayload>;

export const UpdateTaskPayload = z.object({
  message: z.string().min(1).max(2000),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateTaskPayload = z.infer<typeof UpdateTaskPayload>;

export const ReportChangesPayload = z.object({
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(500),
        ranges: z
          .array(
            z.object({
              start: z.number().int().min(1),
              end: z.number().int().min(1),
            })
          )
          .max(1000)
          .optional(),
      })
    )
    .max(200),
});
export type ReportChangesPayload = z.infer<typeof ReportChangesPayload>;

export const SubtaskPayload = z.object({
  title: z.string().min(1).max(500),
  done: z.boolean().default(true),
});
export type SubtaskPayload = z.infer<typeof SubtaskPayload>;

export const BlockTaskPayload = z.object({
  reason: z.string().min(1).max(2000),
});
export type BlockTaskPayload = z.infer<typeof BlockTaskPayload>;

export const CompleteTaskPayload = z.object({
  summary: z.string().max(2000).optional(),
  agentModel: z.string().max(100).optional(),
});
export type CompleteTaskPayload = z.infer<typeof CompleteTaskPayload>;

export const CreateAgentTaskPayload = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  parentId: z.string().optional(),
});
export type CreateAgentTaskPayload = z.infer<typeof CreateAgentTaskPayload>;

export const PlanTaskItem = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  subtasks: z
    .array(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(5000).optional(),
      })
    )
    .max(50)
    .optional(),
});
export type PlanTaskItem = z.infer<typeof PlanTaskItem>;

export const CreatePlanPayload = z.object({
  tasks: z.array(PlanTaskItem).min(1).max(50),
});
export type CreatePlanPayload = z.infer<typeof CreatePlanPayload>;

// ─── Socket.io Events ─────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  "task:updated": (task: Task) => void;
  "task:created": (task: Task) => void;
  "task:deleted": (taskId: string) => void;
  "activity:created": (log: ActivityLog & { taskId: string }) => void;
  "conflict:detected": (data: { taskId: string; conflictingTaskId: string; files: string[] }) => void;
  "task:stale": (data: { taskId: string }) => void;
}

export interface ClientToServerEvents {
  "board:join": (boardId: string) => void;
  "board:leave": (boardId: string) => void;
}
