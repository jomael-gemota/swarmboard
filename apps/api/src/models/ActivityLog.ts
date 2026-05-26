import { Schema, model, type Document, type Types } from "mongoose";

export type ActivitySource = "agent" | "git" | "ci" | "system" | "user";

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  userId?: Types.ObjectId;
  source: ActivitySource;
  content: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    source: {
      type: String,
      enum: ["agent", "git", "ci", "system", "user"],
      required: true,
    },
    content: { type: String, required: true },
    summary: String,
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ taskId: 1, createdAt: 1 });

export const ActivityLog = model<IActivityLog>("ActivityLog", ActivityLogSchema);
