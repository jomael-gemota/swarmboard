# Sync @swarmboard/shared and @swarmboard/mcp-server with the live app

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

The two published packages had drifted from the app's actual behaviour after
recent work landed in `apps/api` and `apps/web`:

- The `Task` model gained a `position: number` field (commit `485c1cd`, board
  ordering) plus `parentId` (commit `2ef699b`). `parentId` was mirrored into
  `@swarmboard/shared` (`2f78312`) but **`position` never was** — so the shared
  `Task` type/`TaskSchema` no longer matched the API's serialized task shape.
- The live API also returns `Board.updatedAt` (Mongoose `timestamps: true`) and,
  on activity endpoints, `ActivityLog.userId` + an enriched `user` object — none
  of which were reflected in the shared schemas.
- `@swarmboard/mcp-server`'s README was stale: it advertised "six tools" (there
  are now nine — `list_board_tasks`, `create_task`, `create_plan` were added in
  `5220b57`/`eafffd3`) and documented the old `SWARMBOARD_URL` default of
  `http://localhost:3001`, which `15d9a17` changed to the hosted instance.
- `@swarmboard/shared`'s README omitted the `CreateAgentTaskPayload` /
  `CreatePlanPayload` exports added in `2f78312`.

The MCP server's runtime code already covers every agent endpoint (9 tools ↔ 9
endpoints), so no tool logic changes were required — only metadata/docs.

## Decision

1. **Make `@swarmboard/shared` an accurate mirror of the live API contract.**
   - `TaskSchema`: add `position: z.number()`.
   - `BoardSchema`: add `updatedAt: z.string().datetime()`.
   - `ActivityLogSchema`: add `userId` (nullable/optional) and
     `user: UserSchema.optional()`, matching the activity/dashboard serializers
     (consistent with the existing `Task.owner` convention).
   These are purely additive type-level fields; the entity schemas are not used
   for runtime `.parse()` anywhere in the app, so there is no validation-behaviour
   risk, and `Partial<Task>` consumers in the web client are unaffected.

2. **Refresh both package READMEs** to match reality: nine MCP tools, correct
   `SWARMBOARD_URL` default (hosted, optional, token-only config), and the new
   shared payload exports / `parentId`+`position` fields.

3. **Minor version bump to `1.2.0` for both packages**, kept in lockstep with the
   existing convention (both were `1.1.0`). The change is additive and
   backward-compatible.

## Alternatives Considered

- **Only add `position` and skip Board/ActivityLog fields.** Smaller, but leaves
  the shared package an incomplete mirror; the extra fields are already on the
  wire today, so syncing them now avoids a future drift report. Chosen the fuller
  sync.
- **Bump only `@swarmboard/shared`.** The MCP README fixes are real package
  changes and the repo versions the two packages together, so both are bumped.
- **Refactor the MCP server to import types from `@swarmboard/shared`.** Out of
  scope; the server defines its own inline tool input schemas and works today.

## Consequences

- Published consumers of `@swarmboard/shared` get accurate `Task`/`Board`/
  `ActivityLog` types including `position`.
- No runtime behaviour change in the API, web, or MCP server.
- `position` is typed as required (mirrors the Mongoose model interface); legacy
  documents created before the field existed may lack it until backfilled — a
  data concern, not a type concern.
