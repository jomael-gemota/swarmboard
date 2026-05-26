import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const { orgId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: session } = useSession();
    const { data: org, isLoading } = useQuery({
        queryKey: ["org", orgId],
        queryFn: () => orgsApi.get(orgId),
        enabled: !!orgId,
    });
    const currentMember = org?.members?.find((m) => m.user?.email === session?.user?.email);
    const isOwner = currentMember?.role === "owner";
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmName, setConfirmName] = useState("");
    const deleteOrgMutation = useMutation({
        mutationFn: () => orgsApi.delete(orgId),
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
        return (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-muted-foreground" }) }));
    }
    return (_jsxs("div", { className: "page-shell w-full max-w-5xl mx-auto space-y-7", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Workspace settings" }), _jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: org?.name })] }), _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: "General" }), _jsxs("div", { className: "bg-card border rounded-xl p-5 space-y-4 shadow-sm", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: "Workspace name" }), _jsx(Input, { value: org?.name ?? "", readOnly: true, className: "bg-secondary/50 cursor-default" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: "Slug" }), _jsx(Input, { value: org?.slug ?? "", readOnly: true, className: "bg-secondary/50 cursor-default font-mono text-sm" })] })] })] }), isOwner && (_jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-destructive", children: "Danger zone" }), _jsxs("div", { className: cn("bg-card border rounded-xl p-5 space-y-3 shadow-sm", confirmDelete && "border-destructive/50"), children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: "Delete this workspace" }), _jsxs("p", { className: "text-sm text-muted-foreground mt-0.5", children: ["Permanently deletes", " ", _jsx("span", { className: "font-medium", children: org?.name }), " and all its boards, tasks, activity logs, and agent tokens. This cannot be undone."] })] }), !confirmDelete ? (_jsxs(Button, { variant: "ghost", className: "text-destructive hover:text-destructive hover:bg-destructive/10", onClick: () => setConfirmDelete(true), children: [_jsx(Trash2, { className: "w-3.5 h-3.5 mr-1.5" }), "Delete workspace"] })) : (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsxs(Label, { htmlFor: "confirm-name", children: ["Type ", _jsx("span", { className: "font-semibold", children: org?.name }), " to confirm"] }), _jsx(Input, { id: "confirm-name", placeholder: org?.name, value: confirmName, onChange: (e) => setConfirmName(e.target.value), autoFocus: true })] }), deleteOrgMutation.error && (_jsx("p", { className: "text-sm text-destructive", children: deleteOrgMutation.error.message })), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { variant: "destructive", size: "sm", onClick: () => deleteOrgMutation.mutate(), disabled: !deleteConfirmValid || deleteOrgMutation.isPending, children: deleteOrgMutation.isPending ? "Deleting…" : "Delete workspace" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                    setConfirmDelete(false);
                                                    setConfirmName("");
                                                }, children: "Cancel" })] })] }))] })] })), !isOwner && (_jsx("p", { className: "text-sm text-muted-foreground", children: "Only the workspace owner can manage these settings." }))] }));
}
