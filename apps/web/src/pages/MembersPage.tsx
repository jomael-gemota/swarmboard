import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orgsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, UserPlus, Trash2, Crown, Shield } from "lucide-react";

const ROLE_LABELS = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };
const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3.5 h-3.5 text-amber-400" />,
  admin: <Shield className="w-3.5 h-3.5 text-blue-400" />,
  member: <Users className="w-3.5 h-3.5 text-muted-foreground" />,
  viewer: <Users className="w-3.5 h-3.5 text-muted-foreground opacity-50" />,
};

export default function MembersPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const { data: org, isLoading } = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => orgsApi.get(orgId!),
    enabled: !!orgId,
  });

  const inviteMutation = useMutation({
    mutationFn: () => orgsApi.inviteMember(orgId!, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", orgId] });
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("member");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      orgsApi.updateMemberRole(orgId!, memberId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org", orgId] }),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => orgsApi.removeMember(orgId!, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org", orgId] }),
  });

  return (
    <div className="p-6 max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage who has access to {org?.name}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
          Invite member
        </Button>
      </div>

      {/* Member list */}
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-secondary rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {org?.members?.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                {member.user?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{member.user?.name}</p>
                <p className="text-xs text-muted-foreground">{member.user?.email}</p>
              </div>

              <div className="flex items-center gap-2">
                {ROLE_ICONS[member.role]}
                {member.role !== "owner" ? (
                  <Select
                    value={member.role}
                    onValueChange={(role) =>
                      updateRoleMutation.mutate({ memberId: member.id, role })
                    }
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["admin", "member", "viewer"].map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground w-28 text-center">Owner</span>
                )}

                {member.role !== "owner" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`Remove ${member.user?.name}?`)) {
                        removeMutation.mutate(member.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                type="email"
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                They must already have a swarmboard account
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — can manage members and boards</SelectItem>
                  <SelectItem value="member">Member — can create and update tasks</SelectItem>
                  <SelectItem value="viewer">Viewer — read-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteMutation.error && (
              <p className="text-sm text-destructive">{inviteMutation.error.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? "Inviting…" : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
