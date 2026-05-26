import { Schema, model, type Document, type Types } from "mongoose";

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    logoUrl: String,
  },
  { timestamps: true }
);

export const Organization = model<IOrganization>("Organization", OrganizationSchema);
