# Conflict Overlap: True File-Level (revise ancestor rule)

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

Revises the overlap rule defined in
[2026-06-12-file-based-conflict-detection.md](./2026-06-12-file-based-conflict-detection.md).

That entry made two footprints conflict when "any pair of paths is equal **or
one is an ancestor directory of the other**". In practice this over-fires on
*directory* declarations: a task whose `modulePath` is the broad
`todo-app/src` was flagged as conflicting with every task working in a
subfolder (`todo-app/src/components`, `todo-app/src/hooks`, …), producing:

> Conflict: another active task is changing the same file(s):
> todo-app/src/hooks, todo-app/src/components, todo-app/src

None of those are the *same file* — they're nested folders. The user expects
file-by-file detection, not folder-contains-folder.

## Decision

Change `overlappingPaths` so a directory **never** conflicts with another
directory. Two footprint paths overlap only when:

1. they are **exactly equal** (same file, or the same explicit module/path
   string), or
2. one is an **ancestor directory** of the other **and the descendant is a
   concrete file** (its last segment contains a `.`, e.g. `Button.tsx`).

So:

- `todo-app/src` vs `todo-app/src/components` → descendant is a directory →
  **no conflict** (fixes the report).
- `todo-app/src` (declared) vs `todo-app/src/App.tsx` (changed) → descendant is
  a file → **conflict** (a real file is being changed inside a declared area).
- `App.tsx` vs `App.tsx` → equal → **conflict**.

`looksLikeFile(path)` = the last path segment contains a `.` (treats
`Button.tsx`, `.env` as files; rare extensionless files like `Makefile` are
not matched against a containing directory — acceptable edge case).

## Alternatives Considered

- **Strict equality only**: drop ancestor matching entirely. Simplest and fully
  predictable, but loses the genuinely useful "someone committed a file inside
  the folder I declared" case, which is core to the combo design.
- **Keep symmetric ancestor matching**: the current buggy behavior — rejected.
- **Drop `modulePath` (directories) from the footprint**: would also fix the
  report, but removes intent-based detection before any commit; the asymmetric
  rule keeps directories useful (as containers for concrete files) without the
  directory-vs-directory noise.

## Consequences

- Broad module-path declarations no longer collide with one another or with
  subfolder declarations; only real files (equal, or a file inside a declared
  directory) trigger conflicts.
- Extensionless files are not matched against a containing directory; they
  still conflict on exact equality.
- No schema or contract change; purely the comparison logic.
