# Track the AI Model an Agent Used

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

Tasks already record an `agentType` — the IDE/tool that did the work (`cursor`, `claude_code`, `copilot`, `windsurf`, `other`). That tells you *which tool* claimed a task, but not *which underlying model* produced the work (e.g. `claude-opus-4.8`, `gpt-5.3-codex`, `gemini-2.5-pro`).

Knowing the model is useful for reviewing quality, comparing model performance across tasks, and auditing what shipped. The capability must work with **any** AI-powered IDE, not just the four named tools.

## Decision

Add a new optional, **free-text** `agentModel` field to tasks.

- **Free text, not an enum.** Models change constantly and vary by vendor/IDE. A `string` (max 100 chars) lets any IDE report whatever identifier it knows without a schema change. `agentType` remains the coarse enum (with `other` as the catch-all) for the tool; `agentModel` is the fine-grained model string.
- **Captured at claim and at complete.** The model is reported via the existing `claim_task` and `complete_task` MCP tools (and their REST endpoints, which MCP wraps). Latest non-empty value wins, so an agent that only knows its model at completion still records it.
- **Surfaced in the UI.** The task detail drawer shows the model alongside the agent tool.

### Touch points

| Layer | Change |
|-------|--------|
| `apps/api/src/models/Task.ts` | `agentModel?: string` |
| `packages/shared/src/types.ts` | `agentModel` on `TaskSchema`; optional on `ClaimTaskPayload` + `CompleteTaskPayload` |
| `apps/api/src/routes/agentApi.ts` | Persist `agentModel` on claim + complete; include in activity metadata |
| `packages/mcp-server/src/index.ts` | `agent_model` param on `claim_task` + `complete_task` |
| `apps/api/src/lib/agentsMd.ts` | Instruct agents to report the model they are running as |
| `apps/web/.../TaskDetailDrawer.tsx` | Display the model |

## Alternatives Considered

- **Extend the `agentType` enum with model values** — rejected. Conflates tool with model and would require a code/schema change for every new model.
- **Infer the model server-side from the token or `agentType`** — rejected. A token isn't bound to a model, and one tool can run many models. Only the agent knows what it's running.
- **Store the model only in activity-log metadata** — rejected for the primary record. Metadata is good for history, but a first-class task field makes the current model easy to display and query. (We still also write it to the claim/complete activity metadata.)

## Consequences

- Existing tasks have no `agentModel`; the UI renders a neutral placeholder. No migration required.
- The MCP server gains an optional parameter; older configs keep working (the field is optional everywhere).
- Package version bumps are intentionally out of scope for this change (handled separately per repo policy).
