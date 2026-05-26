import mongoose from "mongoose";
import { MongoClient } from "mongodb";

const uri = process.env.DATABASE_URL ?? "mongodb://localhost:27017/swarmboard";

// ─── Mongoose connection (used by all app models) ─────────────────────────────

let mongooseConnected = false;

export async function connectMongoose() {
  if (mongooseConnected) return;
  await mongoose.connect(uri);
  mongooseConnected = true;
  console.log("Mongoose connected to MongoDB");
}

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

// ─── Native MongoClient (used by Better Auth adapter) ────────────────────────

export const mongoClient = new MongoClient(uri);

export async function connectMongoClient() {
  await mongoClient.connect();
  console.log("MongoDB native client connected");
}

export function getAuthDb() {
  return mongoClient.db();
}
