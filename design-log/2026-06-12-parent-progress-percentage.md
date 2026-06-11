# Parent Task Progress Percentage + Live Sub-task Status

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

Sub-tasks are now shown only nested inside their parent
(`2026-06-12-nest-subtasks-under-parent.md`). The parent card and drawer
previously communicated child progress only as a raw `done/total` count, which
treats every sub-task as binary (done vs not) and ignores partial progress
(claimed, in review, etc.). Users want an at-a-glance **percentage** so they
can gauge how far along a parent task is, and that percentage must reflect
sub-task status changes **live**.

## Decision

### Live sub-task status (no backend change required)

Every status-changing endpoint already emits `task:updated`:

- Human `PATCH /boards/:id/tasks/:taskId` (`routes/tasks.ts`)
- Agent `claim`, `block`, `complete` (`routes/agentApi.ts`)

`BoardPage` patches the React Query cache on `task:updated`, and both the
parent's `taskMeta` and the drawer's `children` are derived from the live
`tasks` array on every render. Therefore sub-task status (and the derived
percentage) already update live; the new percentage is computed in the same
reactive path so it inherits live behaviour.

### Weighted progress percentage

Add a shared helper `subtaskProgress(children)` in `apps/web/src/lib/utils.ts`
backed by a `STATUS_PROGRESS_WEIGHT` map, so the percentage reflects partial
progress rather than a binary count:

| Status        | Weight |
|---------------|--------|
| `backlog`     | 0.0    |
| `in_progress` | 0.4    |
| `in_review`   | 0.7    |
| `verified`    | 1.0    |
| `deployed`    | 1.0    |

`percent = round(sum(weights) / total * 100)`. The helper also returns
`done` (count of verified/deployed) and `total` so the UI can show
"`done/total` · `percent`%".

### UI surfaces

- **Parent card** (`TaskCard`): thin progress bar with `done/total done` and
  the percentage. Bar turns emerald at 100%.
- **Detail drawer** (`TaskDetailDrawer`): a larger progress bar above the
  Subtasks list with the same labels.

`taskMeta` gains a `percent` field; `KanbanColumn`'s `TaskMeta` type is updated
to match.

## Alternatives Considered

- **Binary done/total percentage** (`done/total*100`): simplest, but hides
  in-progress effort — a parent with all sub-tasks "in review" would read 0%.
- **Equal weight per status step** (0/25/50/75/100): rejected — `in_review`
  is closer to done than halfway, so the chosen weights skew toward later
  stages.
- **Server-computed progress field on the Task**: rejected — progress is a
  pure function of children already in the client cache; computing it server
  side adds writes and a denormalised field to keep in sync.

## Consequences

- The percentage is a heuristic, not a literal "X of Y done" — the `done/total`
  label is shown alongside it to avoid confusion.
- Weights live in one place (`utils.ts`) and can be tuned without touching
  components.
- No API/socket changes; existing real-time plumbing carries the updates.
