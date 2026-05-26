# swarmboard

A real-time kanban board built for AI-assisted development teams. Tracks what every agent is working on, what's been completed, and what's been verified — so project managers always know what's happening across the codebase, without asking.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB + Mongoose |
| Real-time | Socket.io |
| Background jobs | BullMQ + Redis |
| Auth | Better Auth |
| AI summarization | OpenAI (optional) |
| MCP integration | `@modelcontextprotocol/sdk` |

## Monorepo structure

```
swarmboard/
├── apps/
│   ├── web/           # React + Vite frontend
│   └── api/           # Express + Socket.io backend
├── packages/
│   ├── shared/        # Shared TypeScript types (Zod schemas)
│   └── mcp-server/    # MCP server for native AI agent integration
└── pnpm-workspace.yaml
```

## Getting started

### Prerequisites
- Node.js 20+
- pnpm 9+
- MongoDB (local or Atlas)
- Redis (local or Docker)

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set DATABASE_URL, REDIS_URL, and BETTER_AUTH_SECRET

# Build shared packages
pnpm --filter @swarmboard/shared build
pnpm --filter @swarmboard/mcp-server build

# Start everything
pnpm dev
```

The frontend runs on `http://localhost:5173` and the API on `http://localhost:3001`.

### Redis via Docker (quick start)

```bash
docker run -d --name swarmboard-redis -p 6379:6379 redis:alpine
```

---

## Features

### Phase 1 — Foundation ✅
- Multi-tenant workspaces with role-based access (owner / admin / member / viewer)
- Real-time kanban board with drag-and-drop
- Git webhook integration (GitHub & GitLab) — auto-update tasks from commits, PRs, and CI
- Socket.io live updates

### Phase 2 — Agent API ✅
- REST Agent API for AI agents to report status
- MCP server for native integration with Cursor, Claude Code, Windsurf, etc.
- Agent token management (per-developer API keys)
- Activity log feed per task (source-labelled: agent / git / ci / system)
- Conflict detection — warns when two agents touch the same module
- `claimed_complete` vs `verified_complete` trust model

### Phase 3 — Intelligence ✅
- BullMQ staleness detection — flags tasks inactive for 4+ hours
- AI activity log summarization (requires `OPENAI_API_KEY`)
- PM dashboard with module heatmap, conflict/stale alerts, org-wide activity feed

---

## Agent tokens

Agent tokens let AI agents (or any automated process) authenticate against the Agent API. Each token is scoped to the user and organization that created it.

### Creating a token

1. Sign in to swarmboard
2. Navigate to your workspace → **Agent Tokens**
3. Click **New token**, give it a name, and copy the `swb_…` value — it is only shown once

---

## Agent integration

### Option A — MCP Server (recommended for Cursor, Claude Code, Windsurf)

The MCP server must be built before it can be used:

```bash
pnpm --filter @swarmboard/mcp-server build
```

Then add the following to your MCP client config (e.g. `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "swarmboard": {
      "command": "node",
      "args": ["<absolute-path-to-repo>/packages/mcp-server/dist/index.js"],
      "env": {
        "SWARMBOARD_TOKEN": "swb_your_token_here",
        "SWARMBOARD_URL": "http://localhost:3001"
      }
    }
  }
}
```

> Replace `<absolute-path-to-repo>` with the full path to this repository on your machine.  
> Change `SWARMBOARD_URL` if the API is deployed somewhere other than `localhost:3001`.

Once connected, the following tools become available to the AI agent:

| Tool | Description |
|---|---|
| `claim_task` | Claim a task when you start working on it — moves it to `in_progress` |
| `update_task` | Post a progress message to the task's activity feed |
| `complete_subtask` | Log an individual step as ✅ done or ⬜ not done |
| `flag_blocker` | Report a blocker — moves the task to `in_review` |
| `complete_task` | Mark the task as claimed-complete, awaiting human verification |
| `list_my_tasks` | List all tasks currently assigned to you |

### Option B — REST API

Send the token as a `Bearer` header to any `/api/v1/tasks/*` endpoint:

```bash
# Claim a task (moves to in_progress, assigns to your token's user)
curl -X POST http://localhost:3001/api/v1/tasks/<taskId>/claim \
  -H "Authorization: Bearer swb_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{ "agentType": "cursor", "modulePath": "apps/api" }'

# Post a progress update
curl -X POST http://localhost:3001/api/v1/tasks/<taskId>/update \
  -H "Authorization: Bearer swb_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{ "message": "Refactored the auth module, all tests passing" }'

# Log a subtask step
curl -X POST http://localhost:3001/api/v1/tasks/<taskId>/subtask \
  -H "Authorization: Bearer swb_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Write unit tests for login handler", "done": true }'

# Flag a blocker
curl -X POST http://localhost:3001/api/v1/tasks/<taskId>/block \
  -H "Authorization: Bearer swb_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Missing API credentials for the payment gateway" }'

# Mark task complete (claimed — pending human verification)
curl -X POST http://localhost:3001/api/v1/tasks/<taskId>/complete \
  -H "Authorization: Bearer swb_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{ "summary": "Implemented OAuth login, added 12 tests, all passing" }'

# List your active tasks
curl http://localhost:3001/api/v1/tasks \
  -H "Authorization: Bearer swb_your_token_here"
```

The `taskId` is the MongoDB `_id` of the task — visible in the task detail panel or the board URL.

#### Full endpoint reference

```
POST /api/v1/tasks/:id/claim      — Start working on a task
POST /api/v1/tasks/:id/update     — Post a progress message
POST /api/v1/tasks/:id/subtask    — Log a subtask step
POST /api/v1/tasks/:id/block      — Flag a blocker
POST /api/v1/tasks/:id/complete   — Mark task complete (claimed)
GET  /api/v1/tasks                — List your active tasks
```

---

## Git webhook integration

In your board settings, copy the webhook URL and secret, then add it to GitHub or GitLab.

Reference task IDs in commit messages or PR titles using:
- `[TASK-<id>]` — e.g. `[TASK-abc123] fix login redirect`
- `#swb-<id>` — e.g. `#swb-abc123 implement OAuth`

The board will auto-update task status when PRs are opened, merged, or CI passes/fails.
