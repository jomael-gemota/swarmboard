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
  ownerId?: Types.ObjectId;
  agentType?: AgentType;
  modulePath?: string;
  claimedComplete: boolean;
  verifiedComplete: boolean;
  isStale: boolean;
  hasConflict: boolean;
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
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    agentType: {
      type: String,
      enum: ["cursor", "claude_code", "copilot", "windsurf", "other"],
    },
    modulePath: String,
    claimedComplete: { type: Boolean, default: false },
    verifiedComplete: { type: Boolean, default: false },
    isStale: { type: Boolean, default: false },
    hasConflict: { type: Boolean, default: false },
    prUrl: String,
    ciStatus: { type: String, enum: ["pending", "running", "passed", "failed"] },
    position: { type: Number, default: 0 },
  },
  { timestamps: true }
);

TaskSchema.index({ boardId: 1, status: 1 });
TaskSchema.index({ modulePath: 1 });

export const Task = model<ITask>("Task", TaskSchema);
