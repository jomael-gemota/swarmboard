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

interface LineRange {
  start: number;
  end: number;
}

interface FootprintSource {
  declaredFiles?: string[] | null;
  changedFiles?: string[] | null;
  lineRanges?: { file: string; start: number; end: number }[] | null;
}

/**
 * The set of normalized paths a task touches: the files it declared at claim
 * time, and the files actually changed by its linked commits.
 */
export function taskFootprint(task: FootprintSource): string[] {
  const raw = [
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

/** A path points at a concrete file if its last segment contains a dot. */
function looksLikeFile(path: string): boolean {
  return (path.split("/").pop() ?? "").includes(".");
}

/**
 * Paths where two footprints overlap — true file-level matching.
 *
 * Two paths overlap only when they are exactly equal (the same file or the
 * same explicit path string), or one is an ancestor directory of the other AND
 * the descendant is a concrete file. A directory never conflicts with another
 * directory, so broad folder declarations (e.g. `src` vs `src/components`) are
 * not flagged.
 */
export function overlappingPaths(a: string[], b: string[]): string[] {
  const overlaps = new Set<string>();
  for (const x of a) {
    for (const y of b) {
      if (x === y) {
        overlaps.add(x);
      } else if (x.startsWith(`${y}/`) && looksLikeFile(x)) {
        overlaps.add(x);
      } else if (y.startsWith(`${x}/`) && looksLikeFile(y)) {
        overlaps.add(y);
      }
    }
  }
  return [...overlaps];
}

/** Map a task's reported line ranges by normalized file path. */
function rangeMap(task: FootprintSource): Map<string, LineRange[]> {
  const map = new Map<string, LineRange[]>();
  for (const r of task.lineRanges ?? []) {
    const file = normalizePath(r.file);
    if (!file) continue;
    const arr = map.get(file) ?? [];
    arr.push({ start: r.start, end: r.end });
    map.set(file, arr);
  }
  return map;
}

function rangesOverlap(a: LineRange[], b: LineRange[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (x.start <= y.end && y.start <= x.end) return true;
    }
  }
  return false;
}

/**
 * Files where two tasks actually conflict. A shared file conflicts when both
 * sides reported overlapping line ranges, OR when line-range data is missing on
 * either side (file-level fallback).
 */
export function conflictingFiles(
  pathsA: string[],
  rangesA: Map<string, LineRange[]>,
  pathsB: string[],
  rangesB: Map<string, LineRange[]>
): string[] {
  const result: string[] = [];
  for (const path of overlappingPaths(pathsA, pathsB)) {
    const ra = rangesA.get(path);
    const rb = rangesB.get(path);
    if (ra && rb) {
      if (rangesOverlap(ra, rb)) result.push(path);
    } else {
      result.push(path);
    }
  }
  return result;
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
 * A task conflicts when its footprint overlaps that of another active task
 * owned by a *different* agent/user — same-owner (or unowned) overlaps are not
 * flagged, since a single owner coordinates their own work. Tasks whose
 * `hasConflict` flag flips are persisted and broadcast; tasks that newly enter
 * conflict get a system activity log naming the overlapping files.
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
    ownerId: t.ownerId ? String(t.ownerId) : null,
    footprint: taskFootprint(t as FootprintSource),
    ranges: rangeMap(t as FootprintSource),
  }));

  const overlapFilesById = new Map<string, Set<string>>();
  const partnersById = new Map<string, Set<string>>();

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      // A conflict requires two *different* owners working at once. Tasks owned
      // by the same agent/user (or lacking an owner) are not flagged.
      const ownerA = entries[i].ownerId;
      const ownerB = entries[j].ownerId;
      if (!ownerA || !ownerB || ownerA === ownerB) continue;

      const overlap = conflictingFiles(
        entries[i].footprint,
        entries[i].ranges,
        entries[j].footprint,
        entries[j].ranges
      );
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
