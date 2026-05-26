import { Schema, model, type Document, type Types } from "mongoose";

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export interface IMember extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  role: MemberRole;
  createdAt: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    role: {
      type: String,
      enum: ["owner", "admin", "member", "viewer"],
      default: "member",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MemberSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const Member = model<IMember>("Member", MemberSchema);
