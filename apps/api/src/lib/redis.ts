import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

export const redisSubscriber = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on("error", (err) => console.error("[redis] connection error:", err.message));
redisSubscriber.on("error", (err) => console.error("[redis:sub] connection error:", err.message));
