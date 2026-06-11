# Line-Level Conflict Detection (agent-reported hunks)

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

Builds on [file-based conflict detection](./2026-06-12-file-based-conflict-detection.md)
and its [file-level overlap revision](./2026-06-12-conflict-overlap-file-level.md).
Conflicts are currently flagged when two active tasks touch the same file. The
user wants finer granularity: a true Git-style line-by-line conflict, so two
agents editing **different parts of the same file** are not flagged, while two
editing **overlapping lines** are.

We have no line-level data today: webhooks only give changed file *names*, and
the board stores no Git provider access token to fetch commit diffs. Decisions
confirmed with the user:

- **Source = agent-reported hunks.** A new MCP tool + API endpoint lets an
  agent post the files and line ranges it changed (from `git diff`). Works for
  any repo, needs no provider token, and fits swarmboard's "agents report
  status" model.
- **Fallback = file-level.** When a shared file has no line-range data on one or
  both sides, fall back to the existing file-level conflict.

## Decision

### Data

Add `lineRanges: { file, start, end }[]` to the `Task` model and
`TaskSchema`. A new agent endpoint `POST /api/v1/tasks/:taskId/changes`
(`ReportChangesPayload`) accepts:

```jsonc
{ "files": [ { "path": "src/app.ts", "ranges": [ { "start": 10, "end": 40 } ] } ] }
```

The report **replaces** the task's tracked `lineRanges` (each report is a full
snapshot of the current `git diff`) and `$addToSet`s the file paths into
`changedFiles`, so the file-level footprint stays in sync. It logs an activity
entry, emits `task:updated`, and triggers a board conflict recompute.

A matching MCP tool `report_changes` wraps the endpoint.

### Detection

`recomputeBoardConflicts` now considers line ranges. For each pair of active
tasks:

1. Compute candidate shared paths via the existing path overlap (exact file, or
   a concrete file inside a declared directory).
2. For each candidate file:
   - If **both** tasks have line ranges for it → conflict only if any ranges
     overlap (`a.start <= b.end && b.start <= a.end`).
   - Otherwise (no range data on a side) → **file-level fallback**: conflict.

A pair conflicts if at least one candidate file conflicts. Activity logs and
the `conflict:detected` event continue to name the conflicting file(s).

## Alternatives Considered

- **Fetch diffs from the Git provider** in the webhook: most automatic, but
  needs a stored access token (new secret) and provider API calls. Deferred.
- **No file-level fallback** (line-only): fewer false positives, but silently
  misses conflicts whenever line data is absent (e.g. human commits with no
  report). Rejected per user.
- **Track ranges incrementally** instead of replace-on-report: harder to keep
  consistent with the working tree; a snapshot is simpler and matches how
  `git diff` works.

## Consequences

- Two agents editing disjoint line ranges of the same file are no longer
  flagged; overlapping ranges are.
- Fidelity depends on agents calling `report_changes`; without it, behavior is
  unchanged (file-level).
- Ranges are a snapshot — an agent should report its full current diff each
  time; a stale report is corrected by the next one.
- Additive shared contract (`lineRanges`, `ReportChangesPayload`) and one new
  MCP tool (now 10).
