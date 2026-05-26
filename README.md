# swarmboard

A real-time kanban board built for AI-assisted development teams. Tracks what every agent is working on, what's been completed, and what's been verified — so project managers always know what's happening across the codebase, without asking.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express + TypeScript + Prisma |
| Database | PostgreSQL |
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
- PostgreSQL
- Redis

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your DATABASE_URL and REDIS_URL

# Generate Prisma client and run migrations
pnpm --filter @swarmboard/api db:generate
pnpm --filter @swarmboard/api db:migrate

# Start everything
pnpm dev
```

The frontend runs on `http://localhost:5173` and the API on `http://localhost:3001`.

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

## Agent integration

### Option A — MCP Server (recommended for Cursor, Claude Code)

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "swarmboard": {
      "command": "npx",
      "args": ["-y", "@swarmboard/mcp-server"],
      "env": {
        "SWARMBOARD_TOKEN": "swb_your_token_here",
        "SWARMBOARD_URL": "https://your-swarmboard.com"
      }
    }
  }
}
```

Available MCP tools: `claim_task`, `update_task`, `complete_subtask`, `flag_blocker`, `complete_task`, `list_my_tasks`

### Option B — REST API

Authenticate with `Authorization: Bearer swb_your_token_here`:

```
POST /api/v1/tasks/:id/claim      # Agent starts a task
POST /api/v1/tasks/:id/update     # Post progress message
POST /api/v1/tasks/:id/subtask    # Mark subtask done
POST /api/v1/tasks/:id/block      # Flag a blocker
POST /api/v1/tasks/:id/complete   # Mark task complete (claimed)
GET  /api/v1/tasks                # List your active tasks
```

### Git webhook integration

In your board settings, copy the webhook URL and secret, then add it to GitHub/GitLab.

Reference task IDs in commit messages or PR titles using:
- `[TASK-<id>]` — e.g. `[TASK-abc123] fix login redirect`
- `#swb-<id>` — e.g. `#swb-abc123 implement OAuth`

The board will auto-update task status when PRs are opened, merged, or CI passes/fails.
