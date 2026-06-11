# Conflicts Require Different Owners

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

Refines conflict detection from
[file-based](./2026-06-12-file-based-conflict-detection.md),
[file-level overlap](./2026-06-12-conflict-overlap-file-level.md), and
[line-level](./2026-06-12-line-level-conflict-detection.md).

`recomputeBoardConflicts` compared every pair of active tasks regardless of
ownership, so two tasks owned by the **same** agent/user touching the same
file/lines were flagged as conflicting. A conflict should mean *different*
workers colliding — one owner naturally coordinates their own tasks.

## Decision

A pair of active tasks is only eligible to conflict when both have an owner
(`ownerId`) and the owners **differ**. Same-owner pairs, and pairs where either
task is unowned, are skipped before the footprint/line-range overlap check.

`ownerId` is the axis (the user behind a human session or an agent token), so
"same user" — even across different agent tools — is not a conflict, matching
the reported expectation.

## Alternatives Considered

- **Owner + agentType axis**: treat the same user running two different agent
  tools as conflicting. Rejected — the user framed same-user work as
  non-conflicting.
- **Flag when owners differ OR one is unowned**: would catch an owned vs
  unowned overlap, but an unowned active task has no identifiable second worker,
  risking false positives. Chose to require both owners present.

## Consequences

- Conflicts now fire only for genuinely concurrent, different-owner work on
  overlapping files/lines.
- An active but unowned task never triggers a conflict until it is claimed
  (gets an owner); this is acceptable since active tasks are normally owned via
  claim.
- No schema/contract change; purely the recompute eligibility rule.
