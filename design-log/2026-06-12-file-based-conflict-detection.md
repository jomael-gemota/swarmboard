# File-Based Conflict Detection (Git-style)

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

Conflict detection currently keys off a single `modulePath` string per task and
flags a conflict only when two active tasks have an **exactly equal**
`modulePath` (`apps/api/src/services/conflictDetection.ts`). This is coarse: it
misses real overlap (`todo-app/src/components/` vs
`todo-app/src/components/Button.tsx` do not match), depends on everyone typing
the same string, and ignores what files agents/people are *actually* changing.

The user wants conflicts flagged the way Git surfaces them: when multiple
agents/people are working on — or have commits/changes on — the **same file**.

The codebase already has the raw material:

- GitHub/GitLab **push webhooks** (`apps/api/src/routes/webhooks.ts`) link
  commits to tasks via `[TASK-xxx]` / `#swb-xxx` tokens. Push payloads include
  each commit's `added` / `modified` / `removed` file arrays, which the code
  currently discards.
- Agents already pass intent via the `claim`/`create` `modulePath`.

Decisions confirmed with the user:

- **Source = combo**: real committed files from webhooks **and** files an agent
  declares at claim time (so conflicts surface before any commit, too).
- **Scope = active tasks only** (`in_progress` / `in_review`), matching today.

## Decision

### Task footprint

Each task gains two string-array fields:

- `declaredFiles: string[]` — files/paths an agent (or human) says they're
  touching, set at claim time (and editable via the human API).
- `changedFiles: string[]` — files actually changed by linked commits,
  accumulated from push webhooks (`$addToSet`).

A task's **footprint** = normalized, de-duplicated union of `modulePath`
(kept for backward compatibility), `declaredFiles`, and `changedFiles`.

Path normalization: trim, `\\`→`/`, strip leading `./` and `/`, strip trailing
`/`.

### Overlap rule (Git-like, path-aware)

Two footprints conflict if any pair of paths `(a, b)` satisfies
`a === b`, `a` is an ancestor dir of `b`, or `b` is an ancestor dir of `a`
(`a.startsWith(b + "/")`). This makes a folder declaration overlap with a
specific changed file beneath it — the case the old exact-match missed.

### Recompute, don't patch-in-place

Replace the pairwise `checkConflicts(boardId, taskId, modulePath)` with
`recomputeBoardConflicts(boardId)`:

1. Load all active tasks on the board, compute footprints.
2. Pairwise-compare; collect, per task, the overlapping files and partner task
   ids.
3. For each task whose `hasConflict` flips, update it and emit `task:updated`
   (so card borders/counts update live).
4. When a task **newly** enters conflict, write a `system` activity log naming
   the overlapping file(s) and emit `conflict:detected`.

Board task counts are small (kanban scale), so a full recompute per trigger is
cheap and avoids the stale-flag bugs of incremental updates (e.g. clearing a
conflict when only one of several overlaps resolves).

Triggers: human `PATCH` (status/modulePath/declaredFiles change) and `DELETE`,
agent `claim`, and the end of each push/PR webhook.

### Contract changes (`@swarmboard/shared`)

- `TaskSchema`: add `declaredFiles` / `changedFiles` (optional arrays — legacy
  docs may lack them; the model defaults to `[]`).
- `ClaimTaskPayload`: add optional `files: string[]`.
- `conflict:detected` event: replace `modulePath: string` with
  `files: string[]` (nothing in the web consumes this event today; the UI keys
  off the `hasConflict` flag and the activity message).

### Surfaces

- **MCP `claim_task`** gains a `files` array param ("files you'll be working
  in") alongside the existing `module_path`.
- **Web drawer** shows a read-only "Files touched" section (declared + from
  Git) so users can see *why* a task is flagged; the conflict banner is
  relabeled "File conflict". The amber card border and header conflict count
  are unchanged (still driven by `hasConflict`).

## Alternatives Considered

- **Path-overlap on `modulePath` only** (no git files): simpler but still
  intent-only; misses what's actually changing. Rejected per user (combo).
- **Pure post-commit (git only)**: wouldn't warn until something is pushed.
  Rejected — agents should collide on declared intent at claim time too.
- **Incremental pair updates**: kept the old shape but is bug-prone for
  clearing; full per-board recompute is simpler and fast enough.
- **Line-level conflicts** (true Git merge conflicts): out of scope; we don't
  have diffs/merge bases, only changed-file lists.

## Consequences

- Conflicts now reflect real file overlap, declared or committed, across agents
  and people.
- `modulePath` is retained and folded into the footprint, so existing behavior
  is a strict subset of the new behavior.
- Fidelity depends on commit messages carrying the task token (already required
  for commit↔task linking) and on agents passing `files`/`module_path`.
- Activity-log noise is bounded by only logging on the no-conflict→conflict
  transition; a task already flagged won't re-log when it starts overlapping an
  additional task (the new partner's task logs instead).
- Shared package contract is additive; no version bump performed here (publish
  can bump later, consistent with `2026-06-12-shared-and-mcp-package-sync.md`).
