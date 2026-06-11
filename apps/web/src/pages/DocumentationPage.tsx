import { useParams } from "react-router-dom";
import {
  BookOpen,
  Columns,
  MousePointerClick,
  CheckCircle2,
  Bot,
  Key,
  FileCode,
  GitBranch,
  ListChecks,
} from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS, cn } from "@/lib/utils";
import type { TaskStatus } from "@swarmboard/shared";

const STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "in_progress",
  "in_review",
  "verified",
  "deployed",
];

const STATUS_MEANING: Record<TaskStatus, string> = {
  backlog: "Not started yet. Anyone — a person or an agent — can pick it up.",
  in_progress: "Actively being worked on. The owner is shown on the card.",
  in_review: "Work is claimed complete and is waiting for a human (or CI) to check it.",
  verified: "Reviewed and confirmed correct.",
  deployed: "Shipped to production.",
};

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border rounded-xl p-5 md:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="text-primary">{icon}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
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

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-secondary/60 border rounded-lg p-3.5 overflow-x-auto text-xs font-mono text-foreground/90 leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export default function DocumentationPage() {
  const { orgId } = useParams<{ orgId: string }>();

  // The API the frontend actually talks to. In split deployments (separate
  // API/web domains) VITE_API_URL is the source of truth; otherwise fall back
  // to the current origin (same-origin deploy) or the :3001 dev API.
  const apiBase =
    import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
    (window.location.origin.includes("5173")
      ? "http://localhost:3001"
      : window.location.origin);

  return (
    <div className="page-shell page-content space-y-7">
      <div>
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold">Documentation</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          A quick guide to running your board — both as a traditional kanban
          board and with AI agents doing the work.
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
          You can use it as a plain board, let agents drive it, or mix both. Pick
          whichever fits the task.
        </p>
      </Section>

      {/* The columns */}
      <Section
        icon={<Columns className="w-5 h-5" />}
        title="The columns"
        subtitle="Every board has the same five columns. A card moves left to right as work progresses."
      >
        <div className="space-y-2.5">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="flex items-start gap-3">
              <span
                className={cn(
                  "inline-flex flex-shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-semibold mt-0.5 w-24 justify-center",
                  STATUS_COLORS[status]
                )}
              >
                {STATUS_LABELS[status]}
              </span>
              <span className="text-muted-foreground flex-1">
                {STATUS_MEANING[status]}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Traditional kanban */}
      <Section
        icon={<MousePointerClick className="w-5 h-5" />}
        title="Using it as a traditional kanban board"
        subtitle="No agents required. Everything works by hand."
      >
        <Step n={1}>
          <strong className="text-foreground">Create a board.</strong> In the
          sidebar, click the <span className="font-mono text-xs">+</span> next to{" "}
          <em>Boards</em> and give it a name (e.g. "Sprint 12").
        </Step>
        <Step n={2}>
          <strong className="text-foreground">Add tasks.</strong> Open the board
          and click <span className="font-mono text-xs">+</span> at the top of the{" "}
          <em>Backlog</em> column. Give each card a title and description. You can
          add subtasks to break larger items down.
        </Step>
        <Step n={3}>
          <strong className="text-foreground">Move cards as work happens.</strong>{" "}
          Drag a card from one column to the next — Backlog → In Progress → In
          Review — exactly like a normal kanban board.
        </Step>
        <Step n={4}>
          <strong className="text-foreground">Track progress.</strong> Click any
          card to open its detail panel. There you can edit fields, tick off
          subtasks, and read the activity log.
        </Step>
        <Step n={5}>
          <strong className="text-foreground">Verify and ship.</strong> When work
          in <em>In Review</em> looks good, mark it verified and move it to{" "}
          <em>Verified</em>, then <em>Deployed</em> once it's live.
        </Step>
        <div className="rounded-lg bg-secondary/40 border p-3.5 mt-2 flex gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            <strong className="text-foreground">Claimed vs. verified.</strong>{" "}
            "Claimed complete" means whoever did the work says it's done. "Verified
            complete" means a human (or CI) confirmed it. A card can be claimed but
            not yet verified — that's why the <em>In Review</em> column exists.
          </p>
        </div>
      </Section>

      {/* AI agents */}
      <Section
        icon={<Bot className="w-5 h-5" />}
        title="Letting AI agents do the work"
        subtitle="Agents connect over an API. They never touch the web UI — they read and update the board through tools."
      >
        <p className="text-muted-foreground">
          Once set up, an agent can list pending tasks, claim one, post progress
          updates, log subtasks, flag blockers, and mark work complete — all of
          which show up live on the board for you to watch.
        </p>

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
            Click <strong className="text-foreground">New token</strong>, name it,
            and copy the <span className="font-mono text-xs">swb_…</span> value.
            It's only shown once.
          </Step>
        </div>

        <div className="pt-3">
          <div className="flex items-center gap-2 mb-2">
            <FileCode className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">
              Step 2 — Connect the agent (MCP, recommended)
            </h3>
          </div>
          <p className="text-muted-foreground mb-2">
            Add swarmboard to your MCP client config (e.g.{" "}
            <span className="font-mono text-xs">.cursor/mcp.json</span>). Just drop
            in your own token — the server already points at the hosted instance:
          </p>
          <Code>{`{
  "mcpServers": {
    "swarmboard": {
      "command": "npx",
      "args": ["-y", "@swarmboard/mcp-server"],
      "env": {
        "SWARMBOARD_TOKEN": "swb_your_token_here"
      }
    }
  }
}`}</Code>
          <p className="text-muted-foreground mt-2 text-xs">
            Running the API locally? Add{" "}
            <span className="font-mono">
              "SWARMBOARD_URL": "http://localhost:3001"
            </span>{" "}
            to the <span className="font-mono">env</span> block to point at your
            local server instead.
          </p>
          <p className="text-muted-foreground mt-2">
            Restart the agent and it gains tools like{" "}
            <span className="font-mono text-xs">list_board_tasks</span>,{" "}
            <span className="font-mono text-xs">claim_task</span>,{" "}
            <span className="font-mono text-xs">update_task</span>, and{" "}
            <span className="font-mono text-xs">complete_task</span>.
          </p>
        </div>

        <div className="pt-3">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">
              Step 3 — Let agents find their own work
            </h3>
          </div>
          <p className="text-muted-foreground">
            Open a board's{" "}
            <strong className="text-foreground">⚙ settings → Agent integration</strong>{" "}
            and copy the generated <span className="font-mono text-xs">AGENTS.md</span>{" "}
            block into your repo. It carries the board ID (no secret — safe to
            commit) plus workflow instructions, so any agent reading it can pick up
            pending tasks without you pasting an ID each time.
          </p>
        </div>

        <div className="pt-3">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">
              The agent's loop
            </h3>
          </div>
          <Step n={1}>Pick a task from Backlog and claim it → moves to In Progress.</Step>
          <Step n={2}>Post progress updates and tick off subtasks as it works.</Step>
          <Step n={3}>Flag a blocker if it gets stuck → moves to In Review.</Step>
          <Step n={4}>Mark complete when done → moves to In Review, claimed complete.</Step>
          <Step n={5}>
            You review it, verify, and move it to Verified / Deployed.
          </Step>
        </div>
      </Section>

      {/* REST alternative */}
      <Section
        icon={<FileCode className="w-5 h-5" />}
        title="Prefer plain HTTP? Use the REST API"
        subtitle="Any script or process can drive the board with the same token."
      >
        <p className="text-muted-foreground">
          Send the token as a <span className="font-mono text-xs">Bearer</span>{" "}
          header to the <span className="font-mono text-xs">/api/v1</span> endpoints:
        </p>
        <Code>{`# Claim a task
curl -X POST ${apiBase}/api/v1/tasks/<taskId>/claim \\
  -H "Authorization: Bearer swb_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "agentType": "cursor", "modulePath": "apps/api" }'

# Post a progress update
curl -X POST ${apiBase}/api/v1/tasks/<taskId>/update \\
  -H "Authorization: Bearer swb_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "message": "Refactored auth, all tests passing" }'

# Mark complete (claimed — pending verification)
curl -X POST ${apiBase}/api/v1/tasks/<taskId>/complete \\
  -H "Authorization: Bearer swb_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "summary": "Implemented OAuth login, 12 tests passing" }'`}</Code>
        <div className="space-y-1.5 pt-1">
          <p className="text-muted-foreground font-mono text-xs">POST /api/v1/tasks/:id/claim — start working on a task</p>
          <p className="text-muted-foreground font-mono text-xs">POST /api/v1/tasks/:id/update — post a progress message</p>
          <p className="text-muted-foreground font-mono text-xs">POST /api/v1/tasks/:id/subtask — log a subtask step</p>
          <p className="text-muted-foreground font-mono text-xs">POST /api/v1/tasks/:id/block — flag a blocker</p>
          <p className="text-muted-foreground font-mono text-xs">POST /api/v1/tasks/:id/complete — mark complete (claimed)</p>
          <p className="text-muted-foreground font-mono text-xs">GET&nbsp;&nbsp;/api/v1/tasks — list your active tasks</p>
          <p className="text-muted-foreground font-mono text-xs">GET&nbsp;&nbsp;/api/v1/boards/:boardId/tasks — list a board's tasks</p>
          <p className="text-muted-foreground font-mono text-xs">POST /api/v1/boards/:boardId/plan — create an agreed plan</p>
        </div>
      </Section>

      <p className="text-xs text-muted-foreground/60 text-center pb-2">
        Need more detail? The full reference lives in the project README.
      </p>
    </div>
  );
}
