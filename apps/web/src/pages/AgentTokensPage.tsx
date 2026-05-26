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
        <h3 className="text-sm font-semibold mb-3">Using your token</h3>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-2">
              <strong className="text-foreground">Option A — MCP Server</strong> (recommended for
              Cursor, Claude Code)
            </p>
            <code className="block text-xs font-mono bg-secondary px-3 py-2 rounded-md">
              {`// .cursor/mcp.json or mcp_config.json\n{\n  "mcpServers": {\n    "swarmboard": {\n      "command": "npx",\n      "args": ["-y", "@swarmboard/mcp-server"],\n      "env": {\n        "SWARMBOARD_TOKEN": "swb_your_token_here",\n        "SWARMBOARD_URL": "https://your-swarmboard.com"\n      }\n    }\n  }\n}`}
            </code>
          </div>
          <div>
            <p className="text-muted-foreground mb-2">
              <strong className="text-foreground">Option B — REST API</strong>
            </p>
            <code className="block text-xs font-mono bg-secondary px-3 py-2 rounded-md">
              {`curl -X POST https://your-swarmboard.com/api/v1/tasks/{taskId}/update \\\n  -H "Authorization: Bearer swb_your_token_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message": "Refactored auth module"}'`}
            </code>
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
