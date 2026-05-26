# @swarmboard/mcp-server

MCP (Model Context Protocol) server for [swarmboard](https://github.com/jomael-gemota/swarmboard) — a real-time kanban board built for AI-assisted development teams.

This package exposes swarmboard task management as **native MCP tools**, so AI coding agents like Cursor, Claude Code, GitHub Copilot, and Windsurf can claim tasks, post progress updates, log subtasks, flag blockers, and mark work complete — without any manual prompt engineering. The result: a kanban board that updates itself as your AI agents work.

The server uses the standard MCP stdio transport, so it works with any MCP-compatible client. You don't need to install it locally — `npx -y @swarmboard/mcp-server` is enough.

---

## Quick start

### 1. Get an agent token

In your swarmboard workspace, go to **Agent Tokens → New token**, give it a name, and copy the `swb_…` value. The token is shown only once.

### 2. Add the MCP server to your editor

**Cursor** (`.cursor/mcp.json` or workspace `.cursor/mcp.json`):

```json
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

**Claude Code** (`~/.config/claude-code/mcp.json` or equivalent):

```json
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

**Windsurf**, **VS Code MCP extension**, and any other MCP-compatible client follow the same pattern — a `command`/`args`/`env` config block.

Set `SWARMBOARD_URL` to `http://localhost:3001` for local development, or to your deployed swarmboard instance.

### 3. Reload your editor

The agent now has six new tools available. Most agents will discover them automatically and call them when relevant. You can also prompt explicitly, e.g. *"Claim task abc123 from swarmboard"*.

---

## Available tools

| Tool | What it does | Resulting board state |
|---|---|---|
| `claim_task` | Claims a task when the agent starts working on it. Records which agent (`cursor`, `claude_code`, `copilot`, `windsurf`, `other`) and which module path is being touched. | Status → `in_progress`, ownerId → token's user |
| `update_task` | Posts a progress message to the task's activity feed — what was just done, what's next, findings, etc. | Adds an `agent`-sourced activity log entry; clears stale flag |
| `complete_subtask` | Logs an individual step or checklist item as ✅ done or ⬜ not done. | Adds an `agent`-sourced activity entry tagged with the subtask |
| `flag_blocker` | Reports a blocker — missing credentials, environment issues, a test the agent can't resolve, anything needing human input. | Status → `in_review`, blocker note added to feed |
| `complete_task` | Marks the task as claimed-complete, optionally with a summary of what was accomplished. Awaits human/CI verification. | Status → `in_review`, `claimedComplete` → true |
| `list_my_tasks` | Lists the agent's currently assigned `in_progress` and `in_review` tasks. | Read-only |

All status changes broadcast over Socket.IO in real time, so the kanban board updates live for every viewer.

### Trust model: `claimed_complete` vs `verified_complete`

When `complete_task` is called, swarmboard marks the task **`claimedComplete`** — the agent thinks it's done. A human teammate (or CI pipeline + a verifying webhook event) then promotes it to **`verifiedComplete`** with status `verified`. This two-stage handshake means an over-confident AI agent can't single-handedly close a ticket without review.

---

## Configuration

| Env var | Required | Default | Description |
|---|---|---|---|
| `SWARMBOARD_TOKEN` | ✅ | — | Agent token (`swb_…`) created in the swarmboard UI |
| `SWARMBOARD_URL` | optional | `http://localhost:3001` | Base URL of the swarmboard API |

The MCP server authenticates every request with `Authorization: Bearer $SWARMBOARD_TOKEN` against the swarmboard `/api/v1/tasks/*` endpoints.

---

## Architecture

```
┌────────────────┐   stdio MCP    ┌────────────────────┐   HTTPS + Bearer   ┌──────────────────┐
│  Cursor / IDE  │ ◄────────────► │ @swarmboard/       │ ─────────────────► │  swarmboard API  │
│   (MCP host)   │                │  mcp-server (this) │                    │  /api/v1/tasks/* │
└────────────────┘                └────────────────────┘                    └──────────────────┘
                                                                                       │
                                                                            Socket.IO  │
                                                                                       ▼
                                                                          ┌──────────────────┐
                                                                          │ swarmboard web   │
                                                                          │ (live updates)   │
                                                                          └──────────────────┘
```

The MCP server runs as a short-lived stdio process spawned by your editor. It translates incoming MCP tool calls into authenticated REST requests against the swarmboard Agent API, then surfaces the result as MCP responses. Other teammates watching the board see the change instantly via Socket.IO.

---

## Use cases

- **Multi-agent visibility** — when several developers each have their own AI agent working in parallel, swarmboard shows who's touching which module right now, surfacing conflicts before they hit code review
- **Agent accountability** — every task has a full activity feed of what the agent did, said, and ran
- **PM dashboards** — staleness detection, module heatmaps, and per-agent throughput, all driven by data the agents post themselves
- **Trust through verification** — agents can't mark their own work as done; CI passes and human reviewers gate the final state

---

## Running from source

If you want to contribute or run a local build instead of the published version:

```bash
git clone https://github.com/jomael-gemota/swarmboard.git
cd swarmboard
pnpm install
pnpm --filter @swarmboard/shared build
pnpm --filter @swarmboard/mcp-server build
```

Then point your MCP client at the local entry point:

```json
{
  "mcpServers": {
    "swarmboard": {
      "command": "node",
      "args": ["/absolute/path/to/swarmboard/packages/mcp-server/dist/index.js"],
      "env": {
        "SWARMBOARD_TOKEN": "swb_your_token_here",
        "SWARMBOARD_URL": "http://localhost:3001"
      }
    }
  }
}
```

---

## Related packages

- **[@swarmboard/shared](https://www.npmjs.com/package/@swarmboard/shared)** — the underlying TypeScript types and Zod schemas

---

## License

MIT
