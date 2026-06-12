# Remove the Module Path Field

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative
**Supersedes:** the `modulePath` portions of [file-based conflict detection](2026-06-12-file-based-conflict-detection.md) and [touched files on task cards](2026-06-12-task-card-files-touched.md).

## Context

Tasks carried a single `modulePath` string — a coarse folder declaration (e.g. `apps/api`). Once agents began reporting the concrete files they touch (`declaredFiles` at claim, `changedFiles` via `report_changes`), the folder path became redundant and less useful: cards and the drawer now show real files. The earlier file-based conflict design kept `modulePath` "for backward compatibility", but it no longer earns its place.

The user decided to remove it entirely (not just from the UI).

## Decision

Remove `modulePath` across the whole stack:

- **Model:** drop the `agentModel`-adjacent `modulePath` field and its index from `Task`.
- **Shared schemas:** remove `modulePath` from `TaskSchema`, `ClaimTaskPayload`, `CreateAgentTaskPayload`, and `PlanTaskItem` (parent + subtasks).
- **API routes:** remove it from the agent `claim` route, agent `create`/`plan` routes, and the human `tasks` create/update schemas (and the PATCH conflict-recompute trigger).
- **Conflict detection:** drop `modulePath` from a task's footprint. Footprint = `declaredFiles` ∪ `changedFiles` (+ reported line ranges). This is strictly file-based now.
- **MCP server:** remove the `module_path` parameter from `claim_task`, `create_task`, and `create_plan`. Agents declare scope via `files` (on claim) and `report_changes`.
- **Dashboard:** remove the "active module heatmap" (its only data source was `modulePath`). The web `dashboardApi` type drops `moduleHeatmap`; no page consumed it.
- **UI:** remove the module path field from the create-task dialog and the task detail drawer.
- **Docs:** update `README.md`, `packages/shared/README.md`, and `packages/mcp-server/README.md` examples.

## Alternatives Considered

- **UI-only removal** — rejected by the user. Would leave a dead field that agents still populate and that powers an invisible heatmap.
- **Rework the dashboard heatmap to aggregate by touched files** — rejected for now; the heatmap isn't surfaced in any page, so it was removed rather than reworked. Can be reintroduced later keyed off `changedFiles` if a dashboard view is built.

## Consequences

- Conflict detection is now purely file-based. Tasks that only ever declared a folder (and no files) no longer contribute a footprint — acceptable, since file/line reporting is the supported path and is more precise.
- Existing tasks with a stored `modulePath` simply stop surfacing it; no migration is required (the field is ignored and can be dropped lazily).
- Older MCP configs passing `module_path` keep working at the protocol level (extra args are ignored by the tool schema), but the parameter is no longer advertised.
- The dashboard response shrinks; if a heatmap is wanted later, base it on `changedFiles`.
