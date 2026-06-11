import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  BookOpen,
  MousePointerClick,
  CheckCircle2,
  Bot,
  Key,
  FileCode,
  GitBranch,
  ListChecks,
  Copy,
  Check,
  Terminal,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Syntax Highlighting ──────────────────────────────────────────────────────

function highlightJson(code: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Tokenize JSON: object keys, string values, booleans/null, numbers, punctuation
  const re =
    /("(?:[^"\\]|\\.)*")\s*(?=:)|("(?:[^"\\]|\\.)*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])|(\n)|( +)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = re.exec(code)) !== null) {
    if (match.index > last) {
      parts.push(code.slice(last, match.index));
    }
    if (match[1] !== undefined) {
      // object key
      parts.push(
        <span key={idx++} className="text-sky-400">
          {match[1]}
        </span>
      );
      // also consume the `:` that follows — it's outside the match
      const afterKey = match.index + match[0].length;
      const colon = code.slice(afterKey, afterKey + 1);
      if (colon === ":") {
        parts.push(
          <span key={idx++} className="text-zinc-400">
            :
          </span>
        );
        re.lastIndex = afterKey + 1;
        last = afterKey + 1;
        continue;
      }
    } else if (match[2] !== undefined) {
      // string value
      parts.push(
        <span key={idx++} className="text-emerald-400">
          {match[2]}
        </span>
      );
    } else if (match[3] !== undefined) {
      // boolean/null
      parts.push(
        <span key={idx++} className="text-violet-400">
          {match[3]}
        </span>
      );
    } else if (match[4] !== undefined) {
      // number
      parts.push(
        <span key={idx++} className="text-amber-400">
          {match[4]}
        </span>
      );
    } else if (match[5] !== undefined) {
      // punctuation
      parts.push(
        <span key={idx++} className="text-zinc-400">
          {match[5]}
        </span>
      );
    } else if (match[6] !== undefined) {
      parts.push("\n");
    } else if (match[7] !== undefined) {
      parts.push(match[7]);
    }
    last = re.lastIndex;
  }
  if (last < code.length) parts.push(code.slice(last));
  return parts;
}

function highlightBash(code: string): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.flatMap((line, li): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    const lineKey = `l${li}`;

    if (line.trimStart().startsWith("#")) {
      nodes.push(
        <span key={lineKey} className="text-zinc-500 italic">
          {line}
        </span>
      );
    } else {
      // Tokenize within a bash line
      const re =
        /\b(curl|npx)\b|(POST|GET|PUT|PATCH|DELETE)(?=\s)|(-[A-Za-z]+\b)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(https?:\/\/\S+)|(\\$)/g;
      let last = 0;
      let idx = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        if (m.index > last) {
          nodes.push(
            <span key={`${lineKey}-t${idx++}`}>{line.slice(last, m.index)}</span>
          );
        }
        if (m[1]) {
          nodes.push(
            <span key={`${lineKey}-t${idx++}`} className="text-sky-400 font-semibold">
              {m[1]}
            </span>
          );
        } else if (m[2]) {
          const methodColors: Record<string, string> = {
            POST: "text-emerald-400",
            GET: "text-sky-400",
            PUT: "text-amber-400",
            PATCH: "text-amber-400",
            DELETE: "text-red-400",
          };
          nodes.push(
            <span
              key={`${lineKey}-t${idx++}`}
              className={cn("font-semibold", methodColors[m[2]] ?? "text-foreground")}
            >
              {m[2]}
            </span>
          );
        } else if (m[3]) {
          nodes.push(
            <span key={`${lineKey}-t${idx++}`} className="text-amber-400">
              {m[3]}
            </span>
          );
        } else if (m[4]) {
          nodes.push(
            <span key={`${lineKey}-t${idx++}`} className="text-emerald-400">
              {m[4]}
            </span>
          );
        } else if (m[5]) {
          nodes.push(
            <span key={`${lineKey}-t${idx++}`} className="text-sky-300">
              {m[5]}
            </span>
          );
        } else if (m[6]) {
          nodes.push(
            <span key={`${lineKey}-t${idx++}`} className="text-zinc-500">
              {m[6]}
            </span>
          );
        }
        last = re.lastIndex;
      }
      if (last < line.length) {
        nodes.push(<span key={`${lineKey}-tail`}>{line.slice(last)}</span>);
      }
    }

    if (li < lines.length - 1) nodes.push("\n");
    return nodes;
  });
}

// ─── CodeBlock ────────────────────────────────────────────────────────────────

function CodeBlock({
  filename,
  lang,
  code,
}: {
  filename: string;
  lang: "json" | "bash";
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const highlighted = lang === "json" ? highlightJson(code) : highlightBash(code);

  return (
    <div className="rounded-lg border border-border/70 bg-zinc-950/80 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/50 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">{filename}</span>
        </div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-zinc-300">
        <code>{highlighted}</code>
      </pre>
    </div>
  );
}

// ─── API Endpoint Doc ─────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ParamDef {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

interface EndpointDef {
  method: HttpMethod;
  path: string;
  description: string;
  params?: ParamDef[];
}

const METHOD_STYLES: Record<HttpMethod, { badge: string; border: string }> = {
  GET: {
    badge: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
    border: "border-l-sky-500/50",
  },
  POST: {
    badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    border: "border-l-emerald-500/50",
  },
  PUT: {
    badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    border: "border-l-amber-500/50",
  },
  PATCH: {
    badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    border: "border-l-amber-500/50",
  },
  DELETE: {
    badge: "bg-red-500/15 text-red-400 border border-red-500/30",
    border: "border-l-red-500/50",
  },
};

function ApiEndpointRow({ endpoint }: { endpoint: EndpointDef }) {
  const [open, setOpen] = useState(false);
  const styles = METHOD_STYLES[endpoint.method];

  const pathParts = endpoint.path.split(/(:[\w]+)/g);

  return (
    <div
      className={cn(
        "border border-border/60 rounded-lg overflow-hidden transition-colors",
        open && "border-border"
      )}
    >
      <button
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left bg-card hover:bg-secondary/40 transition-colors border-l-2",
          styles.border
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={cn(
            "flex-shrink-0 inline-flex items-center rounded px-2 py-0.5 text-xs font-bold font-mono w-14 justify-center",
            styles.badge
          )}
        >
          {endpoint.method}
        </span>
        <span className="flex-1 text-xs font-mono text-foreground/90">
          {pathParts.map((part, i) =>
            part.startsWith(":") ? (
              <span key={i} className="text-amber-400">
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </span>
        <span className="text-xs text-muted-foreground hidden sm:block">
          {endpoint.description}
        </span>
        <svg
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150",
            open && "rotate-180"
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pt-3 pb-4 bg-secondary/20 border-t border-border/50 space-y-3">
          <p className="text-sm text-muted-foreground">{endpoint.description}</p>
          {endpoint.params && endpoint.params.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Request Body
              </p>
              <div className="rounded-md border border-border/60 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/60 border-b border-border/60">
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                        Field
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                        Type
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                        Required
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.params.map((p, i) => (
                      <tr
                        key={p.name}
                        className={cn(
                          "border-b border-border/40 last:border-0",
                          i % 2 === 0 ? "bg-transparent" : "bg-secondary/20"
                        )}
                      >
                        <td className="px-3 py-2 font-mono text-sky-400">{p.name}</td>
                        <td className="px-3 py-2 font-mono text-amber-400">{p.type}</td>
                        <td className="px-3 py-2">
                          {p.required ? (
                            <span className="text-emerald-400 font-medium">yes</span>
                          ) : (
                            <span className="text-zinc-500">no</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared layout helpers ────────────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border rounded-xl p-5 md:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="text-primary">{icon}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
        {badge}
      </div>
      {subtitle && (
        <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>
      )}
      <div className={cn("space-y-3 text-sm leading-relaxed", !subtitle && "mt-4")}>
        {children}
      </div>
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 pt-0.5 text-muted-foreground">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const API_ENDPOINTS: EndpointDef[] = [
  {
    method: "POST",
    path: "/api/v1/tasks/:id/claim",
    description: "Claim a task and start working on it. Moves it to In Progress.",
    params: [
      {
        name: "agentType",
        type: "string",
        required: true,
        description: 'The agent doing the work, e.g. "cursor", "claude-code", "windsurf".',
      },
      {
        name: "modulePath",
        type: "string",
        required: false,
        description: "The repo sub-path this agent is working in (optional context).",
      },
    ],
  },
  {
    method: "POST",
    path: "/api/v1/tasks/:id/update",
    description: "Post a progress message to the task's activity log.",
    params: [
      {
        name: "message",
        type: "string",
        required: true,
        description: "A short human-readable progress note.",
      },
    ],
  },
  {
    method: "POST",
    path: "/api/v1/tasks/:id/subtask",
    description: "Log a completed subtask step inside the task.",
    params: [
      {
        name: "title",
        type: "string",
        required: true,
        description: "Label for the subtask step.",
      },
      {
        name: "done",
        type: "boolean",
        required: false,
        description: "Mark the subtask as complete (defaults to true).",
      },
    ],
  },
  {
    method: "POST",
    path: "/api/v1/tasks/:id/block",
    description: "Flag a blocker. Moves the task to In Review so a human can unblock it.",
    params: [
      {
        name: "reason",
        type: "string",
        required: true,
        description: "Describe what is blocking progress.",
      },
    ],
  },
  {
    method: "POST",
    path: "/api/v1/tasks/:id/complete",
    description:
      "Mark a task as claimed complete. Moves it to In Review pending human verification.",
    params: [
      {
        name: "summary",
        type: "string",
        required: true,
        description: "A brief summary of what was done.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/tasks",
    description: "List all tasks currently claimed by this token's agent.",
  },
  {
    method: "GET",
    path: "/api/v1/boards/:boardId/tasks",
    description: "List all tasks on a specific board.",
  },
  {
    method: "POST",
    path: "/api/v1/boards/:boardId/plan",
    description: "Submit a structured plan for a board (creates tasks from an agent-generated plan).",
    params: [
      {
        name: "tasks",
        type: "object[]",
        required: true,
        description: "Array of task objects with title, description, and optional subtasks.",
      },
    ],
  },
];

export default function DocumentationPage() {
  const { orgId } = useParams<{ orgId: string }>();

  const apiBase =
    import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
    (window.location.origin.includes("5173")
      ? "http://localhost:3001"
      : window.location.origin);

  const mcpConfig = `{
  "mcpServers": {
    "swarmboard": {
      "command": "npx",
      "args": ["-y", "@swarmboard/mcp-server"],
      "env": {
        "SWARMBOARD_TOKEN": "swb_your_token_here"
      }
    }
  }
}`;

  const restExample = `# Claim a task
curl -X POST ${apiBase}/api/v1/tasks/<taskId>/claim \\
  -H "Authorization: Bearer swb_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "agentType": "cursor", "modulePath": "apps/api" }'

# Post a progress update
curl -X POST ${apiBase}/api/v1/tasks/<taskId>/update \\
  -H "Authorization: Bearer swb_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "message": "Refactored auth, all tests passing" }'

# Mark complete (pending verification)
curl -X POST ${apiBase}/api/v1/tasks/<taskId>/complete \\
  -H "Authorization: Bearer swb_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "summary": "Implemented OAuth login, 12 tests passing" }'`;

  return (
    <div className="page-shell page-content space-y-7">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold">Overview</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Swarmboard is built for AI agents — they drive the board autonomously
          while you watch, review, and ship.
        </p>
      </div>

      {/* What it is */}
      <Section
        icon={<BookOpen className="w-5 h-5" />}
        title="What is swarmboard?"
        subtitle="A real-time kanban board built for AI-assisted development teams."
      >
        <p className="text-muted-foreground">
          You manage work as cards on a board, just like any kanban tool. The
          difference is that AI agents (Cursor, Claude Code, Windsurf, etc.) can
          read the board, claim tasks, and report their progress automatically —
          so you always know what's happening across the codebase without asking.
        </p>
        <p className="text-muted-foreground">
          The primary way to use swarmboard is to let agents do the work. You
          create tasks, agents pick them up, and you review and ship. You can
          also drive it manually when needed.
        </p>
      </Section>

      {/* ── Primary workflow: AI agents ── */}
      <Section
        icon={<Bot className="w-5 h-5" />}
        title="Letting AI agents do the work"
        subtitle="The primary workflow — agents connect over an API and drive the board autonomously."
        badge={
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 text-primary px-2 py-0.5 text-xs font-semibold">
            <Zap className="w-3 h-3" />
            Recommended
          </span>
        }
      >
        <p className="text-muted-foreground">
          Once set up, an agent can list pending tasks, claim one, post progress
          updates, log subtasks, flag blockers, and mark work complete — all
          shown live on the board for you to watch.
        </p>

        {/* Step 1: Token */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">
              Step 1 — Create an agent token
            </h3>
          </div>
          <Step n={1}>
            Go to{" "}
            <a
              href={orgId ? `/orgs/${orgId}/agent-tokens` : "#"}
              className="text-primary hover:underline font-medium"
            >
              Agent Tokens
            </a>{" "}
            in the sidebar.
          </Step>
          <Step n={2}>
            Click <strong className="text-foreground">New token</strong>, name
            it, and copy the{" "}
            <span className="font-mono text-xs">swb_…</span> value. It's only
            shown once.
          </Step>
        </div>

        {/* Step 2: MCP */}
        <div className="pt-3">
          <div className="flex items-center gap-2 mb-2">
            <FileCode className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">
              Step 2 — Connect via MCP{" "}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                (recommended for Cursor, Claude Code, Windsurf)
              </span>
            </h3>
          </div>
          <p className="text-muted-foreground mb-3">
            Add swarmboard to your MCP client config (e.g.{" "}
            <span className="font-mono text-xs">.cursor/mcp.json</span>). Drop
            in your token — the server already points at the hosted instance:
          </p>
          <CodeBlock filename=".cursor/mcp.json" lang="json" code={mcpConfig} />
          <p className="text-xs text-muted-foreground mt-2">
            Running locally? Add{" "}
            <span className="font-mono text-xs">
              "SWARMBOARD_URL": "http://localhost:3001"
            </span>{" "}
            inside the <span className="font-mono text-xs">env</span> block.
          </p>
          <p className="text-muted-foreground mt-2">
            Restart the agent and it gains tools:{" "}
            <span className="font-mono text-xs">list_board_tasks</span>,{" "}
            <span className="font-mono text-xs">claim_task</span>,{" "}
            <span className="font-mono text-xs">update_task</span>,{" "}
            <span className="font-mono text-xs">complete_task</span>.
          </p>
        </div>

        {/* Step 3: AGENTS.md */}
        <div className="pt-3">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">
              Step 3 — Let agents find their own work
            </h3>
          </div>
          <p className="text-muted-foreground">
            Open a board's{" "}
            <strong className="text-foreground">
              ⚙ settings → Agent integration
            </strong>{" "}
            and copy the generated{" "}
            <span className="font-mono text-xs">AGENTS.md</span> block into
            your repo. It carries the board ID (no secret — safe to commit)
            plus workflow instructions, so any agent reading it can pick up
            pending tasks automatically.
          </p>
        </div>

        {/* Agent loop */}
        <div className="pt-3">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">The agent's loop</h3>
          </div>
          <Step n={1}>
            Pick a task from Backlog and claim it → moves to In Progress.
          </Step>
          <Step n={2}>
            Post progress updates and tick off subtasks as it works.
          </Step>
          <Step n={3}>
            Flag a blocker if it gets stuck → moves to In Review.
          </Step>
          <Step n={4}>
            Mark complete when done → moves to In Review, claimed complete.
          </Step>
          <Step n={5}>
            You review, verify, and move it to Verified / Deployed.
          </Step>
        </div>
      </Section>

      {/* ── REST API ── */}
      <Section
        icon={<Terminal className="w-5 h-5" />}
        title="REST API"
        subtitle="Use the same agent token from any script, CI pipeline, or process."
      >
        <p className="text-muted-foreground">
          Send the token as a{" "}
          <span className="font-mono text-xs">Bearer</span> header to the{" "}
          <span className="font-mono text-xs">/api/v1</span> endpoints. The
          base URL for this instance is{" "}
          <span className="font-mono text-xs">{apiBase}</span>.
        </p>

        {/* Quick-start example */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Quick-start examples
          </p>
          <CodeBlock filename="bash" lang="bash" code={restExample} />
        </div>

        {/* Endpoint reference */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-2">
            Endpoint reference{" "}
            <span className="normal-case font-normal text-muted-foreground/60">
              — click any row to expand
            </span>
          </p>
          <div className="space-y-2">
            {API_ENDPOINTS.map((ep) => (
              <ApiEndpointRow
                key={`${ep.method}-${ep.path}`}
                endpoint={ep}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-secondary/40 border p-3.5 flex gap-2.5">
          <Key className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground text-xs">
            <strong className="text-foreground">Authentication.</strong> All
            endpoints require{" "}
            <span className="font-mono">
              Authorization: Bearer swb_your_token_here
            </span>
            . Tokens are scoped to an organization and created on the Agent
            Tokens page.
          </p>
        </div>
      </Section>

      {/* ── Secondary workflow: manual kanban ── */}
      <Section
        icon={<MousePointerClick className="w-5 h-5" />}
        title="Using it as a traditional kanban board"
        subtitle="No agents required — everything works by hand when you need direct control."
      >
        <Step n={1}>
          <strong className="text-foreground">Create a board.</strong> In the
          sidebar, click the{" "}
          <span className="font-mono text-xs">+</span> next to <em>Boards</em>{" "}
          and give it a name (e.g. "Sprint 12").
        </Step>
        <Step n={2}>
          <strong className="text-foreground">Add tasks.</strong> Open the
          board and click <span className="font-mono text-xs">+</span> at the
          top of the <em>Backlog</em> column. Give each card a title and
          description. You can add subtasks to break larger items down.
        </Step>
        <Step n={3}>
          <strong className="text-foreground">
            Move cards as work happens.
          </strong>{" "}
          Drag a card from one column to the next — Backlog → In Progress → In
          Review — exactly like a normal kanban board.
        </Step>
        <Step n={4}>
          <strong className="text-foreground">Track progress.</strong> Click
          any card to open its detail panel. There you can edit fields, tick
          off subtasks, and read the activity log.
        </Step>
        <Step n={5}>
          <strong className="text-foreground">Verify and ship.</strong> When
          work in <em>In Review</em> looks good, mark it verified and move it
          to <em>Verified</em>, then <em>Deployed</em> once it's live.
        </Step>
        <div className="rounded-lg bg-secondary/40 border p-3.5 mt-2 flex gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            <strong className="text-foreground">Claimed vs. verified.</strong>{" "}
            "Claimed complete" means whoever did the work says it's done.
            "Verified complete" means a human (or CI) confirmed it. A card can
            be claimed but not yet verified — that's why the{" "}
            <em>In Review</em> column exists.
          </p>
        </div>
      </Section>

      <p className="text-xs text-muted-foreground/60 text-center pb-2">
        Need more detail? The full reference lives in the project README.
      </p>
    </div>
  );
}
