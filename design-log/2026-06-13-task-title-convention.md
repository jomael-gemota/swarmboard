# Standard task title naming convention

**Date:** 2026-06-13
**Status:** accepted
**Author:** collaborative

## Context

Task titles are free-form strings authored from several surfaces, and the
guidance for each is inconsistent:

- MCP `create_task` / `create_plan` (parent): "Short, action-oriented task title"
- MCP `create_plan` (subtask): "Subtask title" (no convention)
- MCP `complete_subtask`: "Short description of the subtask that was completed"
- Human web `CreateTaskDialog`: placeholder "Task title" (no convention)
- `SWARM.md`: nothing about titles

The result is mixed styles on a board (e.g. "Fix login", "login bug",
"Implementing the new feature…"). We want a single, consistent convention.

## Decision

Make the per-repo **`SWARM.md`** the single source of truth for the title
convention, with a sensible default that teams can edit. `SWARM.md` is generated
by swarmboard but committed and owned by each repo, so it is the natural place
for a convention developers may want to customize.

**Default format (shipped in the generator):**

> **`[Type]: Action + object + context`** — where `Type` is one of `Feature`,
> `Bug`, `Chore`, `Docs`, `Refactor` (Capitalized, in brackets). The action is
> imperative/verb-first, sentence case, concise (≤ ~70 chars), no trailing
> period. Example: `[Feature]: Add OAuth login to settings page`.

The `Type` vocabulary is product-friendly (rather than git's `feat`/`fix`/…) so
non-engineers reading the board recognize it at a glance, while still mirroring
the spirit of the repo's Conventional Commits.

Surfaces:

- **`SWARM.md`** (`apps/api/src/lib/swarmMd.ts`): a dedicated, clearly-marked
  **"Task title format"** section holds the convention. It opens with a
  maintainer note ("edit this section to set the title convention for this repo")
  so developers know it is theirs to change, and agents are told to follow
  whatever is written there.
- **MCP tool descriptions** (`packages/mcp-server/src/index.ts`): `create_task`
  and `create_plan` (task + subtask) titles **defer to the repo's SWARM.md** as
  the source of truth and only state the default as a fallback. This avoids the
  shared npm package hardcoding a format that would conflict with a repo that
  customized its `SWARM.md`.
- **Human `CreateTaskDialog`** (`apps/web/src/components/kanban/CreateTaskDialog.tsx`):
  shows the default format as an example placeholder + hint. The web app does not
  read a repo's `SWARM.md`, so it reflects the shipped default; teams that
  customize do so for the agent/MCP path.

This is guidance only — no programmatic validation/normalization. The shared
schema keeps `min(1).max(500)`; enforcing format in code would reject otherwise
valid titles, fight the human editor, and make per-repo customization
impossible.

## Alternatives Considered

- **Programmatically normalize titles** (strip trailing period, capitalize).
  Surprising for humans editing titles and lossy for legitimate cases (proper
  nouns, code identifiers). Rejected.
- **Hard-validate the format** (regex requiring a leading verb). Brittle, hard to
  define across languages/phrasings, and rejects reasonable titles. Rejected.
- **Leave each surface's wording as-is.** That is the status quo that produced
  the inconsistency. Rejected.

## Consequences

- New tasks created by agents and humans trend toward a uniform style.
- Each repo can adopt its own format by editing one section of its `SWARM.md`,
  without code changes or a new release of the MCP package.
- Existing titles are unchanged (no migration); they can be edited over time.
- The web `CreateTaskDialog` hint can drift from a repo that customized its
  `SWARM.md`, since the web app has no access to that file. Acceptable: the web
  hint is advisory and reflects the default. A future option is to surface a
  board-level title-format setting the web UI can read.
