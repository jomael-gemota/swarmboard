# SWARM.md standalone file + one-line AGENTS.md pointer

**Date:** 2026-06-13
**Status:** accepted
**Author:** collaborative

## Context

Today the board's "Agent integration" section generates a swarmboard block that
developers paste **into** their repo's `AGENTS.md` (see
`2026-06-11-agent-self-service-task-pickup.md`). In practice most repos already
have a substantial `AGENTS.md` with unrelated, project-specific guidance.
Appending a large swarmboard block there is intrusive, easy to get out of sync,
and noisy in diffs.

## Decision

Split the integration into two artifacts:

1. **`SWARM.md`** — a standalone file at the repo root that holds the full
   swarmboard workflow instructions (board ID, the agent loop, blocker/PR
   behavior, MCP setup note). This is what the board generates and what the
   developer commits as a new file. No secret — safe to commit.

2. **A one-line rule for the existing `AGENTS.md`** — instead of pasting the full
   block, the developer adds a single pointer line to whatever `AGENTS.md` they
   already have:

   > `RULE: Before making any code changes, always read the SWARM.md file first. Do not skip this step.`

   This keeps their `AGENTS.md` essentially untouched while still guaranteeing
   agents discover the swarmboard instructions.

### Surfaces

- **API:** rename `generateAgentsMarkdown` → `generateSwarmMarkdown`
  (`lib/agentsMd.ts` → `lib/swarmMd.ts`), export a shared `SWARM_RULE` constant,
  and change the endpoint `GET …/agents-md` → `GET …/swarm-md` returning
  `{ markdown, rule }`.
- **Board settings:** the section becomes a clear two-step guide — (1) add the
  one-line rule to your existing `AGENTS.md`, (2) create `SWARM.md` and paste the
  generated content. Each has its own copy control.
- **Overview page:** rewrite "Step 3 — Let agents find their own work" to teach
  the same two-step flow in plain language.

The instruction content itself is unchanged from the current generator; only the
delivery (standalone file + pointer) changes. The opening `<!-- swarmboard:start
board=… -->` / `…:end` markers (only ever emitted, never parsed) are dropped
since a standalone file does not need block delimiters.

## Alternatives Considered

- **Keep appending the full block to `AGENTS.md`.** Status quo; intrusive for
  repos with existing `AGENTS.md`. Rejected per the motivating problem.
- **Generate the rule pointing at `AGENTS.md` itself** (i.e. keep one file).
  Defeats the purpose — the goal is to avoid bloating the existing file.
- **Use a dotfile (`.swarm.md`) or `.swarmboard/`.** `SWARM.md` at root is the
  most discoverable and matches the `AGENTS.md`/`CLAUDE.md` convention agents
  already look for. Chosen.

## Consequences

- Cleaner adoption: existing `AGENTS.md` files gain a single line; the bulk lives
  in a dedicated, regenerable `SWARM.md`.
- Endpoint/response shape change is internal (single web consumer updated in
  lockstep); no external API consumers.
- Repos that previously pasted the old block can leave it or replace it with the
  one-liner + `SWARM.md`; both work, and the block was never parsed.
- Follow-up: the README still references the `AGENTS.md` block flow and should be
  refreshed separately.
