import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orgsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Users, UserPlus, Trash2, Crown, Shield } from "lucide-react";
const ROLE_LABELS = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };
const ROLE_ICONS = {
    owner: _jsx(Crown, { className: "w-3.5 h-3.5 text-amber-400" }),
    admin: _jsx(Shield, { className: "w-3.5 h-3.5 text-blue-400" }),
    member: _jsx(Users, { className: "w-3.5 h-3.5 text-muted-foreground" }),
    viewer: _jsx(Users, { className: "w-3.5 h-3.5 text-muted-foreground opacity-50" }),
};
export default function MembersPage() {
    const { orgId } = useParams();
    const queryClient = useQueryClient();
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");
    const { data: org, isLoading } = useQuery({
        queryKey: ["org", orgId],
        queryFn: () => orgsApi.get(orgId),
        enabled: !!orgId,
    });
    const inviteMutation = useMutation({
        mutationFn: () => orgsApi.inviteMember(orgId, { email: inviteEmail, role: inviteRole }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["org", orgId] });
            setShowInvite(false);
            setInviteEmail("");
            setInviteRole("member");
        },
    });
    const updateRoleMutation = useMutation({
        mutationFn: ({ memberId, role }) => orgsApi.updateMemberRole(orgId, memberId, role),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org", orgId] }),
    });
    const removeMutation = useMutation({
        mutationFn: (memberId) => orgsApi.removeMember(orgId, memberId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org", orgId] }),
    });
    return (_jsxs("div", { className: "page-shell page-content space-y-7", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Members" }), _jsxs("p", { className: "text-sm text-muted-foreground mt-0.5", children: ["Manage who has access to ", org?.name] })] }), _jsxs(Button, { size: "sm", onClick: () => setShowInvite(true), children: [_jsx(UserPlus, { className: "w-3.5 h-3.5 mr-1.5" }), "Invite member"] })] }), isLoading ? (_jsx("div", { className: "space-y-2 animate-pulse", children: [1, 2, 3].map((i) => (_jsx("div", { className: "h-14 bg-secondary rounded-xl" }, i))) })) : (_jsx("div", { className: "space-y-2", children: org?.members?.map((member) => (_jsxs("div", { className: "flex items-center gap-3 bg-card border rounded-xl px-4 py-3 shadow-sm", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0", children: member.user?.name?.[0]?.toUpperCase() ?? "?" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium", children: member.user?.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: member.user?.email })] }), _jsxs("div", { className: "flex items-center gap-2", children: [ROLE_ICONS[member.role], member.role !== "owner" ? (_jsxs(Select, { value: member.role, onValueChange: (role) => updateRoleMutation.mutate({ memberId: member.id, role }), children: [_jsx(SelectTrigger, { className: "h-7 w-28 text-xs", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: ["admin", "member", "viewer"].map((r) => (_jsx(SelectItem, { value: r, className: "text-xs", children: ROLE_LABELS[r] }, r))) })] })) : (_jsx("span", { className: "text-xs text-muted-foreground w-28 text-center", children: "Owner" })), member.role !== "owner" && (_jsx(Button, { size: "icon", variant: "ghost", className: "h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10", onClick: () => {
                                        if (confirm(`Remove ${member.user?.name}?`)) {
                                            removeMutation.mutate(member.id);
                                        }
                                    }, children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) }))] })] }, member.id))) })), _jsx(Dialog, { open: showInvite, onOpenChange: setShowInvite, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Invite team member" }) }), _jsxs("div", { className: "space-y-4 py-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: "Email address" }), _jsx(Input, { type: "email", placeholder: "teammate@company.com", value: inviteEmail, onChange: (e) => setInviteEmail(e.target.value), autoFocus: true }), _jsx("p", { className: "text-xs text-muted-foreground", children: "They must already have a swarmboard account" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: "Role" }), _jsxs(Select, { value: inviteRole, onValueChange: setInviteRole, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "admin", children: "Admin \u2014 can manage members and boards" }), _jsx(SelectItem, { value: "member", children: "Member \u2014 can create and update tasks" }), _jsx(SelectItem, { value: "viewer", children: "Viewer \u2014 read-only access" })] })] })] }), inviteMutation.error && (_jsx("p", { className: "text-sm text-destructive", children: inviteMutation.error.message }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "ghost", onClick: () => setShowInvite(false), children: "Cancel" }), _jsx(Button, { onClick: () => inviteMutation.mutate(), disabled: !inviteEmail.trim() || inviteMutation.isPending, children: inviteMutation.isPending ? "Inviting…" : "Send invite" })] })] }) })] }));
}
