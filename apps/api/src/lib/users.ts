import { ObjectId, type Filter } from "mongodb";
import { getAuthDb } from "./db.js";

export type AuthUserDoc = {
  _id: unknown;
  name?: string;
  email?: string;
  image?: string;
};

export type SerializedUser = {
  id: string;
  name: string | null;
  email: string | null;
  image?: string;
};

/**
 * Better Auth manages the `user` collection at the raw MongoDB level, so
 * Mongoose's `.populate("userId" | "ownerId", ...)` will throw
 * `MissingSchemaError: Schema hasn't been registered for model "User"`.
 * This helper looks the users up directly from the auth DB instead.
 */
export async function fetchAuthUsers(
  userIds: unknown[]
): Promise<Map<string, AuthUserDoc>> {
  const stringIds = [...new Set(userIds.filter(Boolean).map((id) => String(id)))];
  if (stringIds.length === 0) return new Map();

  const objectIds: ObjectId[] = [];
  for (const id of stringIds) {
    if (ObjectId.isValid(id)) objectIds.push(new ObjectId(id));
  }

  const filter = {
    $or: [
      { _id: { $in: objectIds } },
      { _id: { $in: stringIds } },
    ],
  } as unknown as Filter<AuthUserDoc>;

  const users = await getAuthDb()
    .collection<AuthUserDoc>("user")
    .find(filter)
    .toArray();

  const map = new Map<string, AuthUserDoc>();
  for (const u of users) map.set(String(u._id), u);
  return map;
}

export function serializeUser(
  userId: unknown,
  userMap: Map<string, AuthUserDoc>
): SerializedUser | null {
  if (!userId) return null;
  const key = String(userId);
  const u = userMap.get(key);
  if (!u) return { id: key, name: null, email: null };
  return {
    id: String(u._id),
    name: u.name ?? null,
    email: u.email ?? null,
    image: u.image,
  };
}
