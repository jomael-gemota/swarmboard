# @swarmboard/shared

Shared TypeScript types and Zod validation schemas for the [swarmboard](https://github.com/jomael-gemota/swarmboard) kanban platform.

This package is the **single source of truth** for the data contracts used across every swarmboard component — the Express API, the React web client, and the MCP server. By centralising the type definitions and runtime schemas in one place, the server, browser, and any AI agent stay in sync at both compile-time and runtime.

You typically don't install this package directly — it ships as a transitive dependency of `@swarmboard/mcp-server`. Install it explicitly only if you're building a custom client, alternative web frontend, or another service that talks to the swarmboard API.

---

## What's inside

### Core entities (TypeScript types + Zod schemas)

| Export | Description |
|---|---|
| `Organization` / `OrganizationSchema` | A workspace — top-level tenant boundary |
| `User` / `UserSchema` | A swarmboard user (synced from Better Auth) |
| `Member` / `MemberSchema` | A user's role inside an organization |
| `Board` / `BoardSchema` | A kanban board, optionally linked to a git repository |
| `Task` / `TaskSchema` | A kanban card with status, owner, agent type, conflict flags, CI status, and PR link |
| `ActivityLog` / `ActivityLogSchema` | A log entry on a task (agent / git / ci / system / user source) |
| `AgentToken` / `AgentTokenSchema` | A per-developer API key used by AI agents to authenticate |

### Enums (Zod enums + types)

- `TaskStatus` — `"backlog" | "in_progress" | "in_review" | "verified" | "deployed"`
- `MemberRole` — `"owner" | "admin" | "member" | "viewer"`
- `AgentType` — `"cursor" | "claude_code" | "copilot" | "windsurf" | "other"`
- `ActivitySource` — `"agent" | "git" | "ci" | "system" | "user"`

### Agent API request payloads (used by the MCP server and `POST /api/v1/tasks/*`)

- `ClaimTaskPayload` — body for `POST /tasks/:id/claim`
- `UpdateTaskPayload` — body for `POST /tasks/:id/update`
- `SubtaskPayload` — body for `POST /tasks/:id/subtask`
- `BlockTaskPayload` — body for `POST /tasks/:id/block`
- `CompleteTaskPayload` — body for `POST /tasks/:id/complete`

### Socket.IO event contracts

- `ServerToClientEvents` — `task:created`, `task:updated`, `task:deleted`, `activity:created`, `conflict:detected`, `task:stale`
- `ClientToServerEvents` — `board:join`, `board:leave`

These interfaces give you fully typed `Socket<ServerToClientEvents, ClientToServerEvents>` instances on both ends of the wire.

---

## Installation

```bash
npm install @swarmboard/shared
# or
pnpm add @swarmboard/shared
# or
yarn add @swarmboard/shared
```

This package targets **ESM only** (`"type": "module"`). It requires Node.js 18+ or a modern bundler. Zod is a peer-friendly direct dependency — installing this package will pull in `zod@^3.25.76`.

---

## Usage

### TypeScript types

```ts
import type { Task, TaskStatus, ActivityLog, Board } from "@swarmboard/shared";

function isActive(task: Task): boolean {
  return task.status === "in_progress" || task.status === "in_review";
}
```

### Runtime validation with Zod

```ts
import { TaskSchema, ClaimTaskPayload } from "@swarmboard/shared";

// Validate an unknown payload before processing it
const result = TaskSchema.safeParse(unknownData);
if (!result.success) {
  console.error(result.error.flatten());
  return;
}
const task = result.data;

// Build a typed Agent API request body
const body: ClaimTaskPayload = ClaimTaskPayload.parse({
  agentType: "cursor",
  modulePath: "apps/api",
});
```

### Strongly-typed Socket.IO

```ts
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@swarmboard/shared";

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io("/");

socket.on("task:updated", (task) => {
  // `task` is fully typed as Task — no `any`, no manual casting
});

socket.emit("board:join", boardId);
```

---

## Related packages

- **[@swarmboard/mcp-server](https://www.npmjs.com/package/@swarmboard/mcp-server)** — MCP server that gives AI coding agents native task-tracking tools

---

## License

MIT
