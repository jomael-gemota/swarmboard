/**
 * Convert a Mongoose document (or lean object) to a plain JSON-safe object.
 * Maps _id → id and strips internal Mongoose fields.
 */
export function serialize<T extends { _id?: unknown; __v?: unknown; toObject?: () => unknown }>(
  doc: T
): Record<string, unknown> {
  const obj = (typeof doc.toObject === "function" ? doc.toObject() : doc) as Record<string, unknown>;
  if (obj._id) {
    obj.id = String(obj._id);
  }
  delete obj.__v;
  return obj;
}

export function serializeMany<T extends { _id?: unknown; __v?: unknown; toObject?: () => unknown }>(
  docs: T[]
): Record<string, unknown>[] {
  return docs.map(serialize);
}
