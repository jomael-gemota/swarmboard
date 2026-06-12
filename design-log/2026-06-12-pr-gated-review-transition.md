# PR-gated transition into `in_review`

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

Today a task can enter `in_review` via two independent, uncoordinated triggers:

1. **Agent** — the MCP `complete_task` tool (`POST /tasks/:id/complete`) flips the
   task to `in_review` and sets `claimedComplete = true`, regardless of whether
   any code was pushed or a PR exists. (`flag_blocker` also moves a task to
   `in_review`.)
2. **Git webhook** — a `pull_request` `opened`/`reopened` event flips the task to
   `in_review` and stamps `prUrl`.

`verified` is then reached by a merged PR, or by CI passing while
`claimedComplete` is true.

The problem: `in_review` is overloaded. The agent path can move a card into the
review column when there is **nothing to review yet** — no branch, no diff, no
PR. A human opening that card has no artifact to look at. Conversely, some boards
have no connected repo at all (local-only agents, scripts, non-PR workflows),
where the agent's word is the only completion signal available.

See related: `2026-06-12-file-based-conflict-detection.md` (active-status
semantics) and `2026-06-11-agent-self-service-task-pickup.md` (agent claim/
complete flow).

## Decision

Make the review transition a **per-board policy** rather than a single global
rule.

1. **New board field `requirePrForReview?: boolean`.**
   - Mirrored across the Mongoose `Board` model, `@swarmboard/shared`
     `BoardSchema`, and the board create/update routes.
   - **Effective policy** when unset: `requirePrForReview ?? !!repoUrl`. Boards
     with a connected repo default to requiring a PR; boards without one default
     to trusting the agent. (`webhookSecret` is always generated at board
     creation, so repo *connection* is keyed off `repoUrl`, not the secret.)

2. **`complete_task` honors the policy.**
   - If the effective policy is on **and** the task has no `prUrl` yet:
     keep `status = in_progress`, set `claimedComplete = true`, store the
     summary, and log "marked complete (awaiting PR before review)". The card
     does **not** move columns.
   - Otherwise: `status = in_review`, exactly as before.
   - The authoritative move into `in_review` for repo-backed boards is then the
     `pull_request opened` webhook, which already exists and already stamps
     `prUrl`.

3. **"Done · awaiting PR" badge.** A task that is `in_progress`,
   `claimedComplete`, and has no `prUrl` renders a distinct badge on the card and
   in the detail drawer, so the board shows the agent believes the work is done
   without implying it is reviewable. (Chosen over a new column/sub-state to
   avoid reshaping the board and the existing 5-status state machine.)

4. **Linking guidance.** Because the PR→task link depends on a `[TASK-<id>]` /
   `#swb-<id>` token in the PR title/body, the generated `AGENTS.md` now tells
   agents to include that token when opening a PR, and explains that on
   PR-gated boards `complete_task` marks the task done but leaves it in progress
   until the PR is opened.

## Alternatives Considered

- **Always require a PR globally.** Cleanest semantics for `in_review`, but
  strands boards with no repo/webhook — their tasks could never advance, since
  no `pull_request` event would ever fire. Rejected in favor of the per-board
  default.
- **Keep current behavior (agent moves to `in_review` immediately).** Simple,
  but leaves reviewers opening empty cards and keeps the two triggers
  contradictory.
- **Add a dedicated "ready/awaiting PR" column or status enum value.** More
  explicit, but expands the state machine (`TaskStatus` enum, board columns,
  webhook/CI logic, dashboard grouping) for a transient state that a badge on
  `in_progress` conveys adequately.
- **Block `flag_blocker` from using `in_review` too.** A blocked task is not
  "ready for review"; better modeled as a flag than the review column. Noted as
  follow-up, out of scope for this change.

## Consequences

- Repo-backed boards get a trustworthy `in_review` column: every card there has
  a PR (`prUrl`). Reviewers always have a diff.
- Repo-less boards are unchanged: `complete_task` still moves to `in_review`.
- Agents on PR-gated boards must include the task token in the PR for the card
  to advance; if they do not, the task remains `in_progress` with the
  "awaiting PR" badge until a human intervenes. This is a visible, recoverable
  state (not silent data loss), and is surfaced in `AGENTS.md`.
- Additive type/field change; `@swarmboard/shared` minor version bump. No
  migration needed — existing boards read the effective default.
- Follow-up: reconsider `flag_blocker` using `in_review`; consider a board
  column/filter for "awaiting PR" if the badge proves insufficient.
