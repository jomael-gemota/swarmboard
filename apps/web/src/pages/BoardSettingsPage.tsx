import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Eye, EyeOff, Check, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function ReadonlyField({
  label,
  value,
  masked = false,
  hint,
}: {
  label: string;
  value: string;
  masked?: boolean;
  hint?: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-secondary rounded-md font-mono text-sm">
          <span className="flex-1 truncate">
            {masked && !revealed ? "•".repeat(Math.min(value.length, 40)) : value}
          </span>
          {masked && (
            <button
              onClick={() => setRevealed((r) => !r)}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title={revealed ? "Hide" : "Reveal"}
            >
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
          <CopyButton value={value} />
        </div>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function BoardSettingsPage() {
  const { orgId, boardId } = useParams<{ orgId: string; boardId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: board, isLoading } = useQuery({
    queryKey: ["board", orgId, boardId],
    queryFn: () => boardsApi.get(orgId!, boardId!),
    enabled: !!orgId && !!boardId,
  });

  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [repoProvider, setRepoProvider] = useState<"github" | "gitlab" | "none">("none");
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate fields once board loads
  const [initialised, setInitialised] = useState(false);
  if (board && !initialised) {
    setName(board.name);
    setRepoUrl(board.repoUrl ?? "");
    setRepoProvider((board.repoProvider as "github" | "gitlab") ?? "none");
    setInitialised(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      boardsApi.update(orgId!, boardId!, {
        name: name.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
        repoProvider: repoProvider === "none" ? undefined : repoProvider,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", orgId, boardId] });
      queryClient.invalidateQueries({ queryKey: ["boards", orgId] });
      setDirty(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => boardsApi.delete(orgId!, boardId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards", orgId] });
      navigate(`/orgs/${orgId}`, { replace: true });
    },
  });

  const apiBase = window.location.origin.includes("5173")
    ? "http://localhost:3001"
    : window.location.origin;

  const webhookUrlGithub = `${apiBase}/webhooks/github/${boardId}`;
  const webhookUrlGitlab = `${apiBase}/webhooks/gitlab/${boardId}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Board settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{board?.name}</p>
      </div>

      {/* General */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          General
        </h2>
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="board-name">Board name</Label>
            <Input
              id="board-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Repository provider</Label>
            <Select
              value={repoProvider}
              onValueChange={(v) => { setRepoProvider(v as "github" | "gitlab" | "none"); setDirty(true); }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="github">GitHub</SelectItem>
                <SelectItem value="gitlab">GitLab</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repo-url">Repository URL</Label>
            <Input
              id="repo-url"
              placeholder="https://github.com/org/repo"
              value={repoUrl}
              onChange={(e) => { setRepoUrl(e.target.value); setDirty(true); }}
            />
          </div>

          {updateMutation.error && (
            <p className="text-sm text-destructive">{updateMutation.error.message}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!dirty || !name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </section>

      {/* Webhook integration */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Git webhook integration
        </h2>
        <div className="bg-card border rounded-xl p-5 space-y-5">
          <p className="text-sm text-muted-foreground">
            Add the webhook URL and secret to your GitHub or GitLab repository to automatically
            update tasks from commits, pull requests, and CI events.
          </p>

          <ReadonlyField
            label="GitHub webhook URL"
            value={webhookUrlGithub}
            hint="Settings → Webhooks → Add webhook → Payload URL"
          />

          <ReadonlyField
            label="GitLab webhook URL"
            value={webhookUrlGitlab}
            hint="Settings → Webhooks → URL"
          />

          {board?.webhookSecret ? (
            <ReadonlyField
              label="Webhook secret"
              value={board.webhookSecret}
              masked
              hint="Paste this as the secret / token when registering the webhook."
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Webhook secret not available — re-fetch the board or contact support.
            </p>
          )}

          <div className="rounded-lg bg-secondary/60 px-4 py-3 text-sm space-y-1">
            <p className="font-medium">Referencing tasks in commits and PRs</p>
            <p className="text-muted-foreground">
              Include a task ID in your commit message or PR title/body using either format:
            </p>
            <code className="block text-xs mt-1">
              [TASK-&lt;id&gt;]  e.g. [TASK-abc123] fix login redirect
            </code>
            <code className="block text-xs">
              #swb-&lt;id&gt;  e.g. #swb-abc123 implement OAuth
            </code>
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-destructive">
          Danger zone
        </h2>
        <div
          className={cn(
            "bg-card border rounded-xl p-5 space-y-3",
            confirmDelete && "border-destructive/50"
          )}
        >
          <div>
            <p className="text-sm font-medium">Delete this board</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Permanently deletes the board and all its tasks. This cannot be undone.
            </p>
          </div>

          {!confirmDelete ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete board
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-destructive font-medium">Are you sure?</p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting…" : "Yes, delete it"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
