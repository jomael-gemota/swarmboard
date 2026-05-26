import { Schema, model, type Document, type Types } from "mongoose";

export interface IAgentToken extends Document {
  _id: Types.ObjectId;
  name: string;
  tokenHash: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  lastUsedAt?: Date;
  createdAt: Date;
}

const AgentTokenSchema = new Schema<IAgentToken>(
  {
    name: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastUsedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AgentTokenSchema.index({ organizationId: 1 });

export const AgentToken = model<IAgentToken>("AgentToken", AgentTokenSchema);
