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
 *   SWARMBOARD_URL    — base URL (optional; defaults to the hosted instance).
 *                       Set to http://localhost:3001 when running the API locally.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SWARMBOARD_URL =
  process.env.SWARMBOARD_URL ?? "https://swarmboardapi-production.up.railway.app";
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
      .describe("Which AI tool/IDE is claiming this task"),
    agent_model: z
      .string()
      .optional()
      .describe(
        "The underlying AI model you are running as, e.g. 'claude-opus-4.8', 'gpt-5.3-codex', 'gemini-2.5-pro'. Report your actual model identifier so the board records what produced the work."
      ),
    files: z
      .array(z.string())
      .optional()
      .describe(
        "Specific files/paths you will be changing (e.g. ['apps/api/src/routes/tasks.ts']). Used to flag conflicts when another active task touches the same file."
      ),
  },
  async ({ task_id, agent_type, agent_model, files }) => {
    try {
      await callApi(`/tasks/${task_id}/claim`, "POST", {
        agentType: agent_type,
        agentModel: agent_model,
        files,
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
  "report_changes",
  "Report the files and line ranges you have changed on a task (from `git diff`), so swarmboard can flag line-level conflicts with other agents touching the same lines. Call this after making edits and whenever your diff changes; each call replaces the previously reported set with your current full diff.",
  {
    task_id: z.string().describe("The swarmboard task ID"),
    files: z
      .array(
        z.object({
          path: z.string().describe("Repo-relative file path (e.g. apps/api/src/routes/tasks.ts)"),
          ranges: z
            .array(
              z.object({
                start: z.number().int().describe("First changed line (1-based)"),
                end: z.number().int().describe("Last changed line (1-based)"),
              })
            )
            .optional()
            .describe("Changed line ranges in this file. Omit for file-level only."),
        })
      )
      .describe("The files you changed, each with its changed line ranges"),
  },
  async ({ task_id, files }) => {
    try {
      await callApi(`/tasks/${task_id}/changes`, "POST", { files });
      const fileCount = files.length;
      const rangeCount = files.reduce((n, f) => n + (f.ranges?.length ?? 0), 0);
      return {
        content: [
          {
            type: "text",
            text: `Reported ${fileCount} file(s)${
              rangeCount ? ` and ${rangeCount} line range(s)` : ""
            } for task ${task_id}.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to report changes: ${(err as Error).message}` }],
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
  "Flag a blocker on a swarmboard task. Use this when you are stuck, need human input, or cannot proceed without external action. This marks the task as 'blocked' in place (it stays in its current column, it is NOT moved to review) and alerts a human. The blocked flag clears automatically when you resume — claim the task again, report changes, or complete it.",
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
  "Mark a swarmboard task as complete. Call this when you believe the task is fully done. Note: this marks it as 'claimed complete' — a human or CI verification step will confirm it as 'verified'. On boards that require a PR before review, the task stays in 'in_progress' (marked 'done, awaiting PR') until you open a pull request that references the task ID ([TASK-<id>] or #swb-<id>); opening that PR moves it to 'in_review'.",
  {
    task_id: z.string().describe("The swarmboard task ID"),
    summary: z
      .string()
      .optional()
      .describe(
        "Optional summary of what was accomplished (e.g. 'Implemented OAuth login, added 12 tests, all passing')"
      ),
    agent_model: z
      .string()
      .optional()
      .describe(
        "The underlying AI model that completed this task, e.g. 'claude-opus-4.8', 'gpt-5.3-codex', 'gemini-2.5-pro'. Report your actual model identifier."
      ),
  },
  async ({ task_id, summary, agent_model }) => {
    try {
      const result = (await callApi(`/tasks/${task_id}/complete`, "POST", {
        summary,
        agentModel: agent_model,
      })) as { task?: { status?: string } };
      const status = result.task?.status;
      const text =
        status === "in_progress"
          ? `Task ${task_id} marked complete, but this board requires a PR before review — it stays in progress ("done, awaiting PR"). Open a pull request referencing the task ([TASK-${task_id}] or #swb-${task_id}) to move it to review.`
          : `Task ${task_id} marked as complete (claimed). Awaiting verification.`;
      return {
        content: [{ type: "text", text }],
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
  "create_task",
  "Create a single task on a swarmboard board (in backlog). Only do this once the human has agreed on the work. Optionally nest it under a parent task via parent_id to make it a subtask.",
  {
    board_id: z.string().describe("The swarmboard board ID (found in the repo's AGENTS.md)"),
    title: z
      .string()
      .describe(
        "Task title. Follow the 'Task title format' defined in the repo's SWARM.md (it is the source of truth and may be customized per repo). Default if SWARM.md is unavailable: '[Type]: Action + object + context' where Type is one of Feature, Bug, Chore, Docs, Refactor — e.g. '[Feature]: Add OAuth login to settings page'."
      ),
    description: z.string().optional().describe("What the task involves and any acceptance criteria"),
    parent_id: z
      .string()
      .optional()
      .describe("If this is a subtask, the parent task's ID (must be on the same board)"),
  },
  async ({ board_id, title, description, parent_id }) => {
    try {
      const task = (await callApi(`/boards/${board_id}/tasks`, "POST", {
        title,
        description,
        parentId: parent_id,
      })) as { id: string };
      return {
        content: [
          { type: "text", text: `Created task ${task.id} "${title}" on board ${board_id}.` },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to create task: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "create_plan",
  "Lay out an agreed plan on a swarmboard board in one call: a list of tasks, each with optional subtasks. Use this AFTER you and the human have agreed on the plan — do not author a plan unprompted. Check list_board_tasks first to avoid duplicating existing work. All items are created in backlog.",
  {
    board_id: z.string().describe("The swarmboard board ID (found in the repo's AGENTS.md)"),
    tasks: z
      .array(
        z.object({
          title: z
            .string()
            .describe(
              "Task title. Follow the 'Task title format' defined in the repo's SWARM.md (source of truth, customizable per repo). Default: '[Type]: Action + object + context' where Type is one of Feature, Bug, Chore, Docs, Refactor — e.g. '[Feature]: Add OAuth login to settings page'."
            ),
          description: z.string().optional().describe("What the task involves"),
          subtasks: z
            .array(
              z.object({
                title: z
                  .string()
                  .describe(
                    "Subtask title. Follow the same 'Task title format' as tasks (see the repo's SWARM.md). Default convention: '[Type]: Action + object + context'."
                  ),
                description: z.string().optional(),
              })
            )
            .optional()
            .describe("Independently claimable subtasks of this task"),
        })
      )
      .describe("The plan: top-level tasks, each optionally broken into subtasks"),
  },
  async ({ board_id, tasks }) => {
    try {
      const payload = {
        tasks: tasks.map((t) => ({
          title: t.title,
          description: t.description,
          subtasks: t.subtasks?.map((s) => ({
            title: s.title,
            description: s.description,
          })),
        })),
      };
      const result = (await callApi(`/boards/${board_id}/plan`, "POST", payload)) as {
        count: number;
      };
      return {
        content: [
          {
            type: "text",
            text: `Created ${result.count} task(s)/subtask(s) on board ${board_id} from the plan.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to create plan: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_board_tasks",
  "List tasks on a swarmboard board so you can pick one to work on. Use the board_id from the repo's AGENTS.md. Defaults to pending (backlog) tasks. Call this at the start of a work session before claiming a task.",
  {
    board_id: z.string().describe("The swarmboard board ID (found in the repo's AGENTS.md)"),
    status: z
      .enum(["backlog", "in_progress", "in_review", "verified", "deployed"])
      .optional()
      .describe("Which task status to list (default: backlog — the pending tasks to pick up)"),
  },
  async ({ board_id, status }) => {
    try {
      const query = status ? `?status=${status}` : "";
      const tasks = await callApi(`/boards/${board_id}/tasks${query}`, "GET");
      const list = tasks as Array<{
        id: string;
        title: string;
        status: string;
        description?: string;
        parentId?: string | null;
      }>;

      if (list.length === 0) {
        return {
          content: [
            { type: "text", text: `No ${status ?? "backlog"} tasks on board ${board_id}.` },
          ],
        };
      }

      const byId = new Map(list.map((t) => [t.id, t]));
      const childrenOf = new Map<string, typeof list>();
      for (const t of list) {
        if (t.parentId && byId.has(t.parentId)) {
          const siblings = childrenOf.get(t.parentId) ?? [];
          siblings.push(t);
          childrenOf.set(t.parentId, siblings);
        }
      }

      type Task = (typeof list)[number];
      const line = (t: Task, indent: string) =>
        `${indent}• [${t.id}] ${t.title} — ${t.status}${
          t.description ? `\n${indent}    ${t.description}` : ""
        }`;

      // Top level = tasks with no parent, or whose parent isn't in this list
      // (e.g. filtered out by status). Sub-tasks nest beneath their parent.
      const formatted = list
        .filter((t) => !t.parentId || !byId.has(t.parentId))
        .map((parent) => {
          const subtasks = childrenOf.get(parent.id) ?? [];
          const head = line(parent, "");
          if (subtasks.length === 0) return head;
          const nested = subtasks.map((s) => line(s, "  ")).join("\n");
          return `${head}\n${nested}`;
        })
        .join("\n");

      return {
        content: [{ type: "text", text: `Tasks on board ${board_id}:\n${formatted}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to list board tasks: ${(err as Error).message}` }],
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
      const list = tasks as Array<{ id: string; title: string; status: string }>;

      if (list.length === 0) {
        return {
          content: [{ type: "text", text: "No active tasks assigned to you." }],
        };
      }

      const formatted = list
        .map((t) => `• [${t.id}] ${t.title} — ${t.status}`)
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
