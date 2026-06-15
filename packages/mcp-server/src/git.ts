/**
 * Local git inspection for the MCP server.
 *
 * The MCP server runs as a stdio subprocess inside the agent's repository, so it
 * can shell out to `git` to compute the current diff — additions/deletions and
 * changed line ranges — without the agent having to report anything by hand.
 *
 * Everything here is best-effort: if git is missing, the cwd is not a repo, or
 * there are no commits, functions return empty results instead of throwing.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Baseline to diff against. Defaults to the last commit (what an IDE's source
 * control view shows). Set e.g. `origin/main` for a PR-style diff. */
export const DIFF_BASE = process.env.SWARMBOARD_DIFF_BASE ?? "HEAD";

export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
  ranges: { start: number; end: number }[];
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

export function getRepoRoot(cwd: string = process.cwd()): string | null {
  try {
    return git(["rev-parse", "--show-toplevel"], cwd).trim() || null;
  } catch {
    return null;
  }
}

/** `git diff --numstat` encodes renames as `old => new`, optionally with a
 * common prefix/suffix in braces: `src/{a => b}/x.ts`. Resolve to the new path. */
function resolveRenamePath(raw: string): string {
  let path = raw.trim();
  if (path.includes("{") && path.includes("=>")) {
    path = path.replace(/\{[^}]*=>\s*([^}]*)\}/g, (_m, to: string) => to.trim());
    return path.replace(/\/\//g, "/");
  }
  if (path.includes("=>")) {
    return path.split("=>").pop()!.trim();
  }
  return path;
}

function parseNumstat(out: string): Map<string, { additions: number; deletions: number }> {
  const map = new Map<string, { additions: number; deletions: number }>();
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const [a, d, ...rest] = parts;
    const path = resolveRenamePath(rest.join("\t"));
    if (!path) continue;
    map.set(path, {
      additions: a === "-" ? 0 : Number.parseInt(a, 10) || 0,
      deletions: d === "-" ? 0 : Number.parseInt(d, 10) || 0,
    });
  }
  return map;
}

/** Parse `git diff --unified=0` hunk headers into added line ranges per file. */
function parseRanges(out: string): Map<string, { start: number; end: number }[]> {
  const map = new Map<string, { start: number; end: number }[]>();
  let current: string | null = null;
  for (const line of out.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim();
      current = target === "/dev/null" ? null : target.replace(/^b\//, "");
      continue;
    }
    if (current && line.startsWith("@@")) {
      // @@ -oldStart,oldLen +newStart,newLen @@
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      if (!m) continue;
      const start = Number.parseInt(m[1], 10);
      const len = m[2] === undefined ? 1 : Number.parseInt(m[2], 10);
      if (len <= 0) continue; // pure deletion, no added lines
      (map.get(current) ?? map.set(current, []).get(current)!).push({
        start,
        end: start + len - 1,
      });
    }
  }
  return map;
}

function countLines(content: string): number {
  if (!content) return 0;
  return content.replace(/\n$/, "").split("\n").length;
}

function collectUntracked(root: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  let listing: string;
  try {
    listing = git(["ls-files", "--others", "--exclude-standard"], root);
  } catch {
    return files;
  }
  for (const rel of listing.split("\n")) {
    const path = rel.trim();
    if (!path) continue;
    try {
      const content = readFileSync(join(root, path), "utf8");
      if (content.includes("\u0000")) {
        files.push({ path, additions: 0, deletions: 0, ranges: [] });
        continue;
      }
      const lines = countLines(content);
      files.push({
        path,
        additions: lines,
        deletions: 0,
        ranges: lines > 0 ? [{ start: 1, end: lines }] : [],
      });
    } catch {
      files.push({ path, additions: 0, deletions: 0, ranges: [] });
    }
  }
  return files;
}

/**
 * Compute the current set of changed files with additions/deletions and changed
 * line ranges, relative to `base` (default `HEAD`), including untracked files.
 * Returns `[]` if there is nothing to report or git is unavailable.
 */
export function collectGitChanges(base: string = DIFF_BASE): ChangedFile[] {
  const root = getRepoRoot();
  if (!root) return [];

  const byPath = new Map<string, ChangedFile>();

  let stats = new Map<string, { additions: number; deletions: number }>();
  try {
    stats = parseNumstat(git(["diff", "--numstat", "--no-color", base], root));
  } catch {
    stats = new Map();
  }

  let ranges = new Map<string, { start: number; end: number }[]>();
  try {
    ranges = parseRanges(git(["diff", "--unified=0", "--no-color", base], root));
  } catch {
    ranges = new Map();
  }

  for (const [path, s] of stats) {
    byPath.set(path, {
      path,
      additions: s.additions,
      deletions: s.deletions,
      ranges: ranges.get(path) ?? [],
    });
  }
  // Ranges without a numstat entry (rare) still count as touched files.
  for (const [path, r] of ranges) {
    if (!byPath.has(path)) {
      byPath.set(path, { path, additions: 0, deletions: 0, ranges: r });
    }
  }

  for (const f of collectUntracked(root)) {
    if (!byPath.has(f.path)) byPath.set(f.path, f);
  }

  return [...byPath.values()];
}
