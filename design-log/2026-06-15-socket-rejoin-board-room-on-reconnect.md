# Re-join board room on socket reconnect

**Date:** 2026-06-15
**Status:** accepted
**Author:** collaborative

## Context

Users reported that the Kanban board stops updating in real time and only
refreshes after a full page reload. The real-time plumbing itself is correct:
status-changing endpoints emit `task:updated` / `task:created` / `task:deleted`
to the `board:${boardId}` room (`routes/tasks.ts`, `routes/agentApi.ts`,
`routes/agentBoards.ts`), and `BoardPage` patches the React Query cache on those
events.

The bug is in how the client joins the room. `BoardPage`'s effect emits
`board:join` exactly once, when the effect mounts:

```ts
const socket = getSocket();
socket.emit("board:join", boardId);
socket.on("connect", () => setConnected(true));
```

Socket.io rooms are **per-connection**. The shared client socket reconnects
automatically after any disconnect (network blip, API restart/redeploy, idle
timeout, laptop sleep). Each reconnect is a brand-new connection with a new id
that is **not** in `board:${boardId}`, so `emitToBoard(...)` no longer reaches
it. The socket looks "connected" but receives nothing — the only way back into
the room is to re-run the mount effect, i.e. reload the page. This matches the
reported symptom exactly.

## Decision

Make the room join idempotent and tied to the connection lifecycle instead of
the component mount:

1. Define a `joinBoard` handler that emits `board:join` and sets `connected`.
2. Call it immediately (buffered until the socket connects on first mount).
3. Register it as the `connect` listener so the client **re-joins on every
   (re)connect**.
4. On reconnect, also invalidate the `tasks` query so the board reconciles any
   events missed while disconnected (the optimistic socket-patch path only
   covers events received while subscribed).

Use named handler references with `socket.off(event, handler)` in cleanup so we
don't tear down listeners belonging to other components sharing the singleton
socket.

## Alternatives Considered

- **Auto-join on the server** (track the last board per socket and re-add on
  `connection`): the server can't know which board a freshly reconnected socket
  cares about without the client telling it — the client is the source of truth.
- **Poll / refetch on an interval**: defeats the purpose of the socket and adds
  load; only used here as a one-shot reconciliation on reconnect.
- **Recreate the socket on every board mount**: heavier, drops the shared
  connection used by the detail drawer, and doesn't address mid-session
  reconnects.

## Consequences

- The board survives API redeploys and network blips without a manual reload.
- `board:join` may be emitted twice on the very first connect (immediate +
  `connect` handler); joining a room is idempotent, so this is harmless.
- A `tasks` refetch fires on each reconnect — cheap and bounded, and guarantees
  the board is consistent after a gap. The detail drawer already refetches
  activity from its own `activity:created` subscription.
