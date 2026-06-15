# MCP server auto-captures git diff stats

**Date:** 2026-06-15
**Status:** accepted
**Author:** collaborative
**Supersedes part of:** [2026-06-13-per-file-diff-stats](2026-06-13-per-file-diff-stats.md)

## Context

`2026-06-13-per-file-diff-stats.md` added an optional `fileStats`
(`+adds / -dels`) contract so the task drawer can show VS Code–style per-file
diff numbers. But populating it depended on the **agent** computing
`git diff --numstat` and passing `additions`/`deletions` into `report_changes`.
In practice agents declare files at claim time and rarely call `report_changes`,
so the numbers never appeared (the drawer showed "declared" rows only).

The user wants the counts captured **automatically** — every time the agent
edits files or completes a task — mirroring how IDEs (Cursor, Claude Code, etc.)
surface working-tree changes.

## Decision

Move diff computation **into the MCP server**, which already runs locally in the
agent's repo (stdio subprocess). It can shell out to `git` directly, so the
agent no longer has to compute or remember anything.

### Mechanics

- New `packages/mcp-server/src/git.ts`:
  - `getRepoRoot()` via `git rev-parse --show-toplevel`.
  - `collectGitChanges(base)` returns `{ path, additions, deletions, ranges }[]`:
    - tracked changes from `git diff --numstat <base>` (additions/deletions),
    - changed line ranges from `git diff --unified=0 <base>` hunk headers,
    - untracked files (`git ls-files --others --exclude-standard`) counted as
      all-additions, matching how IDE source control shows new files.
  - Fully best-effort: any git failure (no git, not a repo, no commits) returns
    `[]` and never throws.
- **Baseline:** `git diff HEAD` by default — the working tree vs the last commit,
  which is what an IDE's source-control view shows. Configurable via
  `SWARMBOARD_DIFF_BASE` (e.g. `origin/main` for a PR-style diff).
- `report_changes`: `files` becomes **optional**. When omitted, the server
  auto-collects from git. An explicit `files` payload still overrides (for
  non-git environments / manual control).
- `complete_task`: before marking complete, the server auto-collects the current
  git diff and POSTs it to `/tasks/:id/changes`, so a fresh `+/-` snapshot lands
  on every completion. Best-effort — a git failure never blocks completion.

## Alternatives Considered

- **Instruction-driven** (tell the agent to run numstat and call
  `report_changes`) — rejected as primary; relies on per-run LLM compliance.
- **Server-side (API) git** — impossible; the hosted API has no working copy.
- **Diff vs base branch by default** — rejected as default because it requires
  knowing the base branch; offered via `SWARMBOARD_DIFF_BASE` instead.

## Consequences

- Requires an MCP release (1.8.0) and an agent MCP restart to take effect.
- Still requires the API/web `fileStats` deploy (from the prior entry) to store
  and render the numbers.
- Line ranges are now also auto-populated, so line-level conflict detection
  improves without the agent doing anything.
- Untracked binary files are skipped (line counting is text-only).
