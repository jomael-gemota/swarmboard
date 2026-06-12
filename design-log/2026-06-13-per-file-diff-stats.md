# Per-file diff stats (+adds / -dels) on tasks

**Date:** 2026-06-13
**Status:** accepted
**Author:** collaborative

## Context

The task detail drawer's "Files touched" section lists declared and changed
files (see `2026-06-12-task-card-files-touched.md`) and, for changed files, the
reported line ranges (see `2026-06-12-line-level-conflict-detection.md`). It does
not show VS Code–style additions/deletions counts (`+3 -2`) per file. The user
asked to surface those numbers next to each touched file.

We previously stored only `lineRanges` (`{ file, start, end }`), which describe
*where* a file changed but not *how many* lines were added vs removed. Deriving
add/del from ranges is impossible (a range covers both), so we need agents to
report the real `git diff --numstat` counts.

## Decision

Add an optional, additive per-file stat to the contract end-to-end.

### Data

- New `Task.fileStats: { file, additions, deletions }[]` field (Mongo model +
  shared `TaskSchema`). Like `lineRanges`, a `report_changes` call is a full
  snapshot and **replaces** the stored `fileStats`.
- `ReportChangesPayload.files[]` gains optional `additions` and `deletions`
  (non-negative ints). Omitting them preserves today's behavior.
- The `report_changes` MCP tool exposes `additions`/`deletions` per file,
  instructing agents to source them from `git diff --numstat`.

### UI

- The drawer renders `+A` (emerald) and `-D` (red) next to each changed file
  when stats exist, alongside the existing line-range badge. Files without
  reported stats render unchanged.

## Alternatives Considered

- **Derive a single changed-line count from `lineRanges`** — rejected by the
  user in favor of true, VS Code–style split counts. A range cannot distinguish
  additions from deletions, so the number would be an approximation.
- **Reuse `lineRanges` to carry counts** — rejected; ranges and stats are
  distinct concerns (conflict detection vs. surface-area display) and overloading
  the shape would complicate the conflict service.

## Consequences

- Fidelity depends on agents passing `additions`/`deletions`; existing tasks and
  agents that don't report them show no numbers until they re-report (graceful).
- Additive shared contract change — no breaking changes to existing fields.
- Conflict detection is untouched; it continues to use `lineRanges`.
