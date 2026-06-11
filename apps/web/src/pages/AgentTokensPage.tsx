import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentTokensApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { AgentToken } from "@swarmboard/shared";
import { Key, Plus, Trash2, Copy, Check, Clock } from "lucide-react";
import { formatDate, formatRelative } from "@/lib/utils";

export default function AgentTokensPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["agent-tokens", orgId],
    queryFn: () => agentTokensApi.list(orgId!),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => agentTokensApi.create(orgId!, { name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agent-tokens", orgId] });
      setRevealedToken((data as AgentToken & { token: string }).token);
      setShowCreate(false);
      setNewTokenName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tokenId: string) => agentTokensApi.delete(orgId!, tokenId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-tokens", orgId] }),
  });

  async function copyToken(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // The API the frontend actually talks to — used so the REST example is
  // copy-paste ready against this instance.
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

  const restExample = `curl -X POST ${apiBase}/api/v1/tasks/{taskId}/update \\
  -H "Authorization: Bearer swb_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "message": "Refactored auth module" }'`;

  return (
    <div className="page-shell page-content">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Agent Tokens</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate tokens so your AI agents can report into swarmboard
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New token
        </Button>
      </div>

      {/* Revealed token alert */}
      {revealedToken && (
        <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 shadow-sm">
          <p className="text-sm font-medium text-emerald-400 mb-2">
            Token created — copy it now, it won't be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-secondary px-3 py-2 rounded-md truncate">
              {revealedToken}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToken(revealedToken, "revealed")}
            >
              {copiedId === "revealed" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRevealedToken(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Token list */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-secondary rounded-xl" />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Key className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No agent tokens yet</p>
          <p className="text-xs mt-1">Create a token to let your AI agents report their status</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3 shadow-sm"
            >
              <Key className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{token.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>Created {formatDate(token.createdAt)}</span>
                  {token.lastUsedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last used {formatRelative(token.lastUsedAt)}
                    </span>
                  )}
                  {token.user && <span>by {token.user.name}</span>}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (confirm(`Revoke token "${token.name}"?`)) {
                    deleteMutation.mutate(token.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Usage instructions */}
      <div className="mt-8 bg-card border rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold">Using your token</h3>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">
          Pick one option. Replace{" "}
          <span className="font-mono">swb_your_token_here</span> with a token from
          above.
        </p>
        <div className="space-y-5 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-md bg-primary/15 text-primary px-2 py-0.5 text-xs font-semibold">
                Option A
              </span>
              <span className="text-muted-foreground text-xs">
                MCP Server — recommended for Cursor, Claude Code, Windsurf
              </span>
            </div>
            <CodeBlock
              filename=".cursor/mcp.json"
              code={mcpConfig}
              copied={copiedId === "mcp"}
              onCopy={() => copyToken(mcpConfig, "mcp")}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              The server points at the hosted instance by default. Running the API
              locally? Add{" "}
              <span className="font-mono">"SWARMBOARD_URL": "http://localhost:3001"</span>{" "}
              inside <span className="font-mono">env</span>.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-md bg-secondary text-foreground px-2 py-0.5 text-xs font-semibold border">
                Option B
              </span>
              <span className="text-muted-foreground text-xs">
                REST API — any script or process
              </span>
            </div>
            <CodeBlock
              filename="bash"
              code={restExample}
              copied={copiedId === "rest"}
              onCopy={() => copyToken(restExample, "rest")}
            />
          </div>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create agent token</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="token-name">Token name</Label>
              <Input
                id="token-name"
                placeholder='e.g. "My Cursor setup" or "Work laptop"'
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newTokenName)}
              disabled={!newTokenName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CodeBlock({
  filename,
  code,
  copied,
  onCopy,
}: {
  filename: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-lg border bg-secondary/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/70 bg-secondary/70">
        <span className="text-xs font-mono text-muted-foreground">{filename}</span>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}
