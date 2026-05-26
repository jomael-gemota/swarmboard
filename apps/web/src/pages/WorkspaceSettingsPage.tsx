import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orgsApi } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WorkspaceSettingsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const { data: org, isLoading } = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => orgsApi.get(orgId!),
    enabled: !!orgId,
  });

  const currentMember = org?.members?.find(
    (m) => m.user?.email === session?.user?.email
  );
  const isOwner = currentMember?.role === "owner";

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const deleteOrgMutation = useMutation({
    mutationFn: () => orgsApi.delete(orgId!),
    onSuccess: () => {
      // Remove (not just invalidate) so RootRedirect does a fresh fetch
      // and doesn't redirect back to the now-deleted org.
      queryClient.removeQueries({ queryKey: ["orgs"] });
      queryClient.removeQueries({ queryKey: ["org", orgId] });
      queryClient.removeQueries({ queryKey: ["boards", orgId] });
      navigate("/", { replace: true });
    },
  });

  const deleteConfirmValid = confirmName.trim() === org?.name;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-shell w-full max-w-5xl mx-auto space-y-7">
      <div>
        <h1 className="text-2xl font-semibold">Workspace settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{org?.name}</p>
      </div>

      {/* General info (read-only for now) */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          General
        </h2>
        <div className="bg-card border rounded-xl p-5 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <Label>Workspace name</Label>
            <Input value={org?.name ?? ""} readOnly className="bg-secondary/50 cursor-default" />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input value={org?.slug ?? ""} readOnly className="bg-secondary/50 cursor-default font-mono text-sm" />
          </div>
        </div>
      </section>

      {/* Danger zone — owner only */}
      {isOwner && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-destructive">
            Danger zone
          </h2>
          <div
            className={cn(
              "bg-card border rounded-xl p-5 space-y-3 shadow-sm",
              confirmDelete && "border-destructive/50"
            )}
          >
            <div>
              <p className="text-sm font-medium">Delete this workspace</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Permanently deletes{" "}
                <span className="font-medium">{org?.name}</span> and all its boards, tasks,
                activity logs, and agent tokens. This cannot be undone.
              </p>
            </div>

            {!confirmDelete ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete workspace
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-name">
                    Type <span className="font-semibold">{org?.name}</span> to confirm
                  </Label>
                  <Input
                    id="confirm-name"
                    placeholder={org?.name}
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    autoFocus
                  />
                </div>
                {deleteOrgMutation.error && (
                  <p className="text-sm text-destructive">{deleteOrgMutation.error.message}</p>
                )}
                <div className="flex items-center gap-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteOrgMutation.mutate()}
                    disabled={!deleteConfirmValid || deleteOrgMutation.isPending}
                  >
                    {deleteOrgMutation.isPending ? "Deleting…" : "Delete workspace"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setConfirmDelete(false);
                      setConfirmName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {!isOwner && (
        <p className="text-sm text-muted-foreground">
          Only the workspace owner can manage these settings.
        </p>
      )}
    </div>
  );
}
