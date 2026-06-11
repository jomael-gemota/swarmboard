import { Task, ActivityLog } from "../models/index.js";
import { emitToBoard } from "../lib/socket.js";
import { fetchAuthUsers, serializeUser } from "../lib/users.js";

const ACTIVE_STATUSES = ["in_progress", "in_review"] as const;

/**
 * Normalize a path/module string for comparison: forward slashes, no leading
 * `./` or `/`, no trailing slash, trimmed.
 */
export function normalizePath(p: string): string {
  return p
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

interface FootprintSource {
  modulePath?: string | null;
  declaredFiles?: string[] | null;
  changedFiles?: string[] | null;
}

/**
 * The set of normalized paths a task touches: its declared module path, the
 * files it declared at claim time, and the files actually changed by its
 * linked commits.
 */
export function taskFootprint(task: FootprintSource): string[] {
  const raw = [
    ...(task.modulePath ? [task.modulePath] : []),
    ...(task.declaredFiles ?? []),
    ...(task.changedFiles ?? []),
  ];
  const set = new Set<string>();
  for (const p of raw) {
    const n = normalizePath(p);
    if (n) set.add(n);
  }
  return [...set];
}

/**
 * Paths where two footprints overlap. Two paths overlap when they are equal or
 * one is an ancestor directory of the other (so a folder declaration collides
 * with a specific file changed beneath it). Returns the more specific path of
 * each overlapping pair.
 */
export function overlappingPaths(a: string[], b: string[]): string[] {
  const overlaps = new Set<string>();
  for (const x of a) {
    for (const y of b) {
      if (x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`)) {
        overlaps.add(x.length >= y.length ? x : y);
      }
    }
  }
  return [...overlaps];
}

function taskToJson(task: Record<string, unknown>, owner: unknown) {
  return {
    ...task,
    id: String(task._id),
    boardId: String(task.boardId),
    parentId: task.parentId ? String(task.parentId) : null,
    ownerId: task.ownerId ? String(task.ownerId) : null,
    owner: owner ?? undefined,
  };
}

/**
 * Recompute file-overlap conflicts across all active tasks on a board.
 *
 * A task conflicts when its footprint overlaps that of another active task.
 * Tasks whose `hasConflict` flag flips are persisted and broadcast; tasks that
 * newly enter conflict get a system activity log naming the overlapping files.
 */
export async function recomputeBoardConflicts(boardId: string): Promise<void> {
  const tasks = await Task.find({
    boardId,
    status: { $in: ACTIVE_STATUSES as unknown as string[] },
  }).lean();

  const entries = tasks.map((t) => ({
    id: String(t._id),
    doc: t as Record<string, unknown>,
    hadConflict: !!t.hasConflict,
    footprint: taskFootprint(t as FootprintSource),
  }));

  const overlapFilesById = new Map<string, Set<string>>();
  const partnersById = new Map<string, Set<string>>();

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const overlap = overlappingPaths(entries[i].footprint, entries[j].footprint);
      if (overlap.length === 0) continue;

      const a = entries[i].id;
      const b = entries[j].id;
      for (const id of [a, b]) {
        if (!overlapFilesById.has(id)) overlapFilesById.set(id, new Set());
        if (!partnersById.has(id)) partnersById.set(id, new Set());
      }
      overlap.forEach((f) => {
        overlapFilesById.get(a)!.add(f);
        overlapFilesById.get(b)!.add(f);
      });
      partnersById.get(a)!.add(b);
      partnersById.get(b)!.add(a);
    }
  }

  // Enrich owners for any tasks whose flag changes, so the broadcast task keeps
  // its owner avatar in the client cache.
  const changed = entries.filter((e) => overlapFilesById.has(e.id) !== e.hadConflict);
  if (changed.length === 0) return;

  const userMap = await fetchAuthUsers(changed.map((e) => e.doc.ownerId));

  for (const entry of changed) {
    const nowConflict = overlapFilesById.has(entry.id);

    const updated = await Task.findByIdAndUpdate(
      entry.id,
      { hasConflict: nowConflict },
      { new: true }
    ).lean();
    if (!updated) continue;

    emitToBoard(
      boardId,
      "task:updated",
      taskToJson(updated as Record<string, unknown>, serializeUser(updated.ownerId, userMap)) as never
    );

    if (nowConflict && !entry.hadConflict) {
      const files = [...(overlapFilesById.get(entry.id) ?? [])];
      const partners = [...(partnersById.get(entry.id) ?? [])];
      const shown = files.slice(0, 5).join(", ");
      const more = files.length > 5 ? ` (+${files.length - 5} more)` : "";

      await ActivityLog.create({
        taskId: entry.id,
        source: "system",
        content: `⚠️ Conflict: another active task is changing the same file(s): ${shown}${more}`,
        metadata: { conflictingTaskIds: partners, files },
      });

      for (const partner of partners) {
        emitToBoard(boardId, "conflict:detected", {
          taskId: entry.id,
          conflictingTaskId: partner,
          files,
        } as never);
      }
    }
  }
}
