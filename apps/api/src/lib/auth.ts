import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { organization } from "better-auth/plugins";
import { getAuthDb } from "./db.js";

export function createAuth() {
  return betterAuth({
    database: mongodbAdapter(getAuthDb()),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 5,
        membershipLimit: 100,
      }),
    ],
    trustedOrigins: [process.env.FRONTEND_URL ?? "http://localhost:5173"],
    secret: process.env.BETTER_AUTH_SECRET ?? "fallback-secret-change-in-production",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Lazily initialized after DB connection is established
let _auth: Auth | null = null;

export function getAuth(): Auth {
  if (!_auth) throw new Error("Auth not initialized — call initAuth() first");
  return _auth;
}

export function initAuth(): Auth {
  _auth = createAuth();
  return _auth;
}
