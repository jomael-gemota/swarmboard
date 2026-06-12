import { Schema, model, type Document, type Types } from "mongoose";

export type TaskStatus = "backlog" | "in_progress" | "in_review" | "verified" | "deployed";
export type AgentType = "cursor" | "claude_code" | "copilot" | "windsurf" | "other";
export type CiStatus = "pending" | "running" | "passed" | "failed";

export interface ITask extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  boardId: Types.ObjectId;
  parentId?: Types.ObjectId;
  ownerId?: Types.ObjectId;
  assigneeId?: Types.ObjectId;
  agentType?: AgentType;
  agentModel?: string;
  declaredFiles: string[];
  changedFiles: string[];
  lineRanges: { file: string; start: number; end: number }[];
  claimedComplete: boolean;
  verifiedComplete: boolean;
  isStale: boolean;
  hasConflict: boolean;
  blocked: boolean;
  blockReason?: string;
  prUrl?: string;
  ciStatus?: CiStatus;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: String,
    status: {
      type: String,
      enum: ["backlog", "in_progress", "in_review", "verified", "deployed"],
      default: "backlog",
    },
    boardId: { type: Schema.Types.ObjectId, ref: "Board", required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Task" },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    agentType: {
      type: String,
      enum: ["cursor", "claude_code", "copilot", "windsurf", "other"],
    },
    agentModel: String,
    declaredFiles: { type: [String], default: [] },
    changedFiles: { type: [String], default: [] },
    lineRanges: {
      type: [{ file: String, start: Number, end: Number, _id: false }],
      default: [],
    },
    claimedComplete: { type: Boolean, default: false },
    verifiedComplete: { type: Boolean, default: false },
    isStale: { type: Boolean, default: false },
    hasConflict: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false },
    blockReason: String,
    prUrl: String,
    ciStatus: { type: String, enum: ["pending", "running", "passed", "failed"] },
    position: { type: Number, default: 0 },
  },
  { timestamps: true }
);

TaskSchema.index({ boardId: 1, status: 1 });
TaskSchema.index({ boardId: 1, assigneeId: 1, status: 1 });
TaskSchema.index({ parentId: 1 });
TaskSchema.index({ boardId: 1, changedFiles: 1 });
TaskSchema.index({ boardId: 1, declaredFiles: 1 });

export const Task = model<ITask>("Task", TaskSchema);
