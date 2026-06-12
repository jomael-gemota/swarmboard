# Show Touched Files on Task Cards

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

Kanban cards (`TaskCard.tsx`) showed only the title, owner avatar, and a subtask counter. The module path (a single folder) lived only in the detail drawer. A folder path is coarse — at a glance it doesn't tell you what the agent actually worked on. Agents already report the concrete files they touch (`declaredFiles` at claim, `changedFiles` via `report_changes`), so we can surface that directly on the card.

## Decision

Render a compact "files touched" list on each task card instead of relying on a folder path.

- **Source preference:** show `changedFiles` (the files actually changed, from git) when present; otherwise fall back to `declaredFiles` (declared at claim time, before any diff is reported).
- **Compactness:** show at most 3 files, then a `+N more file(s)` line. Each row shows the last two path segments (e.g. `routes/agentApi.ts`) so the filename stays visible in the narrow card; the full repo-relative path and a `changed`/`declared` qualifier are in the row tooltip.
- The detail drawer keeps the full, authoritative breakdown (declared vs changed, with line ranges). The card is a glanceable summary.

## Alternatives Considered

- **Keep the module path on the card** — rejected. The user found a folder path less helpful than the concrete file list.
- **Show full paths** — rejected for cards; they overflow the narrow column. Truncating to the last two segments keeps the filename legible. Full path remains available on hover and in the drawer.
- **Show every touched file** — rejected for cards; large diffs would make cards huge. Capped with `+N more`; the drawer shows all.

## Consequences

- Cards now reflect real work surface area at a glance.
- Tasks with no declared/changed files render exactly as before (the section is omitted).
- Subtask cards behave the same — each shows its own touched files; opening a task in the drawer still shows the complete list.
