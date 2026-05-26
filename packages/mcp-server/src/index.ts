#!/usr/bin/env node
/**
 * Swarmboard MCP Server
 *
 * Exposes swarmboard task management as native MCP tools so AI agents
 * (Cursor, Claude Code, Windsurf, etc.) can report their status without
 * any manual prompt engineering.
 *
 * Configuration via environment variables:
 *   SWARMBOARD_TOKEN  — agent token (required)
 *   SWARMBOARD_URL    — base URL (default: http://localhost:3001)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SWARMBOARD_URL = process.env.SWARMBOARD_URL ?? "http://localhost:3001";
const SWARMBOARD_TOKEN = process.env.SWARMBOARD_TOKEN;

if (!SWARMBOARD_TOKEN) {
  console.error("Error: SWARMBOARD_TOKEN environment variable is required");
  process.exit(1);
}

async function callApi(path: string, method: string, body?: unknown) {
  const res = await fetch(`${SWARMBOARD_URL}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SWARMBOARD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `API error ${res.status}`);
  }

  return data;
}

const server = new McpServer({
  name: "swarmboard",
  version: "0.0.1",
});

// ─── Tools ────────────────────────────────────────────────────────────────────

server.tool(
  "claim_task",
  "Claim a task from swarmboard when you start working on it. Call this as soon as you begin working on a task.",
  {
    task_id: z.string().describe("The swarmboard task ID to claim"),
    agent_type: z
      .enum(["cursor", "claude_code", "copilot", "windsurf", "other"])
      .optional()
      .describe("Which AI agent is claiming this task"),
    module_path: z
      .string()
      .optional()
      .describe("The module or package path you will be working in (e.g. packages/auth)"),
  },
  async ({ task_id, agent_type, module_path }) => {
    try {
      await callApi(`/tasks/${task_id}/claim`, "POST", {
        agentType: agent_type,
        modulePath: module_path,
      });
      return {
        content: [
          {
            type: "text",
            text: `Task ${task_id} claimed successfully. Status: in_progress.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to claim task: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "update_task",
  "Post a progress update to swarmboard. Use this to report what you just did, what you're about to do, or any relevant findings.",
  {
    task_id: z.string().describe("The swarmboard task ID"),
    message: z
      .string()
      .describe(
        "A clear, concise description of what you just did or what is happening (e.g. 'Refactored auth module to use JWT', 'Found 3 failing tests in packages/api')"
      ),
  },
  async ({ task_id, message }) => {
    try {
      await callApi(`/tasks/${task_id}/update`, "POST", { message });
      return {
        content: [{ type: "text", text: `Progress update posted for task ${task_id}.` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to update task: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "complete_subtask",
  "Mark a subtask or step as complete on a swarmboard task. Use this for individual steps within a larger task.",
  {
    task_id: z.string().describe("The swarmboard task ID"),
    title: z.string().describe("Short description of the subtask that was completed"),
    done: z.boolean().default(true).describe("Whether the subtask is done (default: true)"),
  },
  async ({ task_id, title, done }) => {
    try {
      await callApi(`/tasks/${task_id}/subtask`, "POST", { title, done });
      return {
        content: [
          {
            type: "text",
            text: `Subtask "${title}" marked as ${done ? "done" : "not done"} on task ${task_id}.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to mark subtask: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "flag_blocker",
  "Flag a blocker on a swarmboard task. Use this when you are stuck, need human input, or cannot proceed without external action.",
  {
    task_id: z.string().describe("The swarmboard task ID"),
    reason: z
      .string()
      .describe(
        "A clear description of what is blocking you (e.g. 'Missing API credentials for service X', 'Failing test in packages/auth that I cannot resolve without human review')"
      ),
  },
  async ({ task_id, reason }) => {
    try {
      await callApi(`/tasks/${task_id}/block`, "POST", { reason });
      return {
        content: [
          {
            type: "text",
            text: `Blocker flagged on task ${task_id}. A human has been notified.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to flag blocker: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "complete_task",
  "Mark a swarmboard task as complete. Call this when you believe the task is fully done. Note: this marks it as 'claimed complete' — a human or CI verification step will confirm it as 'verified'.",
  {
    task_id: z.string().describe("The swarmboard task ID"),
    summary: z
      .string()
      .optional()
      .describe(
        "Optional summary of what was accomplished (e.g. 'Implemented OAuth login, added 12 tests, all passing')"
      ),
  },
  async ({ task_id, summary }) => {
    try {
      await callApi(`/tasks/${task_id}/complete`, "POST", { summary });
      return {
        content: [
          {
            type: "text",
            text: `Task ${task_id} marked as complete (claimed). Awaiting verification.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to complete task: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_my_tasks",
  "List your currently assigned in-progress and in-review tasks from swarmboard.",
  {},
  async () => {
    try {
      const tasks = await callApi("/tasks", "GET");
      const list = tasks as Array<{ id: string; title: string; status: string; modulePath?: string }>;

      if (list.length === 0) {
        return {
          content: [{ type: "text", text: "No active tasks assigned to you." }],
        };
      }

      const formatted = list
        .map(
          (t) =>
            `• [${t.id}] ${t.title} — ${t.status}${t.modulePath ? ` (${t.modulePath})` : ""}`
        )
        .join("\n");

      return {
        content: [{ type: "text", text: `Your active tasks:\n${formatted}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to list tasks: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
