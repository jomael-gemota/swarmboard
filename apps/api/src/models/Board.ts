import { Schema, model, type Document, type Types } from "mongoose";

export type RepoProvider = "github" | "gitlab";

export interface IBoard extends Document {
  _id: Types.ObjectId;
  name: string;
  organizationId: Types.ObjectId;
  repoUrl?: string;
  repoProvider?: RepoProvider;
  webhookSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BoardSchema = new Schema<IBoard>(
  {
    name: { type: String, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    repoUrl: String,
    repoProvider: { type: String, enum: ["github", "gitlab"] },
    webhookSecret: String,
  },
  { timestamps: true }
);

BoardSchema.index({ organizationId: 1 });

export const Board = model<IBoard>("Board", BoardSchema);
