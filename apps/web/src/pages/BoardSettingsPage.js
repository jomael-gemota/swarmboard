import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
function CopyButton({ value }) {
    const [copied, setCopied] = useState(false);
    async function handleCopy() {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    return (_jsx("button", { onClick: handleCopy, className: "text-muted-foreground hover:text-foreground transition-colors", title: "Copy to clipboard", children: copied ? (_jsx(Check, { className: "w-3.5 h-3.5 text-emerald-400" })) : (_jsx(Copy, { className: "w-3.5 h-3.5" })) }));
}
function ReadonlyField({ label, value, masked = false, hint, }) {
    const [revealed, setRevealed] = useState(false);
    return (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: label }), _jsx("div", { className: "flex items-center gap-2", children: _jsxs("div", { className: "flex-1 flex items-center gap-2 px-3 py-2 bg-secondary rounded-md font-mono text-sm", children: [_jsx("span", { className: "flex-1 truncate", children: masked && !revealed ? "•".repeat(Math.min(value.length, 40)) : value }), masked && (_jsx("button", { onClick: () => setRevealed((r) => !r), className: "text-muted-foreground hover:text-foreground transition-colors flex-shrink-0", title: revealed ? "Hide" : "Reveal", children: revealed ? _jsx(EyeOff, { className: "w-3.5 h-3.5" }) : _jsx(Eye, { className: "w-3.5 h-3.5" }) })), _jsx(CopyButton, { value: value })] }) }), hint && _jsx("p", { className: "text-xs text-muted-foreground", children: hint })] }));
}
export default function BoardSettingsPage() {
    const { orgId, boardId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: board, isLoading } = useQuery({
        queryKey: ["board", orgId, boardId],
        queryFn: () => boardsApi.get(orgId, boardId),
        enabled: !!orgId && !!boardId,
    });
    const [name, setName] = useState("");
    const [repoUrl, setRepoUrl] = useState("");
    const [repoProvider, setRepoProvider] = useState("none");
    const [dirty, setDirty] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    // Populate fields once board loads
    const [initialised, setInitialised] = useState(false);
    if (board && !initialised) {
        setName(board.name);
        setRepoUrl(board.repoUrl ?? "");
        setRepoProvider(board.repoProvider ?? "none");
        setInitialised(true);
    }
    const updateMutation = useMutation({
        mutationFn: () => boardsApi.update(orgId, boardId, {
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
        mutationFn: () => boardsApi.delete(orgId, boardId),
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
        return (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-muted-foreground" }) }));
    }
    return (_jsxs("div", { className: "page-shell w-full max-w-5xl mx-auto space-y-7", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Board settings" }), _jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: board?.name })] }), _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: "General" }), _jsxs("div", { className: "bg-card border rounded-xl p-5 space-y-4 shadow-sm", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "board-name", children: "Board name" }), _jsx(Input, { id: "board-name", value: name, onChange: (e) => { setName(e.target.value); setDirty(true); } })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: "Repository provider" }), _jsxs(Select, { value: repoProvider, onValueChange: (v) => { setRepoProvider(v); setDirty(true); }, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "none", children: "None" }), _jsx(SelectItem, { value: "github", children: "GitHub" }), _jsx(SelectItem, { value: "gitlab", children: "GitLab" })] })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "repo-url", children: "Repository URL" }), _jsx(Input, { id: "repo-url", placeholder: "https://github.com/org/repo", value: repoUrl, onChange: (e) => { setRepoUrl(e.target.value); setDirty(true); } })] }), updateMutation.error && (_jsx("p", { className: "text-sm text-destructive", children: updateMutation.error.message })), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { onClick: () => updateMutation.mutate(), disabled: !dirty || !name.trim() || updateMutation.isPending, children: updateMutation.isPending ? "Saving…" : "Save changes" }) })] })] }), _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: "Git webhook integration" }), _jsxs("div", { className: "bg-card border rounded-xl p-5 space-y-5 shadow-sm", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Add the webhook URL and secret to your GitHub or GitLab repository to automatically update tasks from commits, pull requests, and CI events." }), _jsx(ReadonlyField, { label: "GitHub webhook URL", value: webhookUrlGithub, hint: "Settings \u2192 Webhooks \u2192 Add webhook \u2192 Payload URL" }), _jsx(ReadonlyField, { label: "GitLab webhook URL", value: webhookUrlGitlab, hint: "Settings \u2192 Webhooks \u2192 URL" }), board?.webhookSecret ? (_jsx(ReadonlyField, { label: "Webhook secret", value: board.webhookSecret, masked: true, hint: "Paste this as the secret / token when registering the webhook." })) : (_jsx("p", { className: "text-sm text-muted-foreground italic", children: "Webhook secret not available \u2014 re-fetch the board or contact support." })), _jsxs("div", { className: "rounded-lg bg-secondary/60 px-4 py-3 text-sm space-y-1", children: [_jsx("p", { className: "font-medium", children: "Referencing tasks in commits and PRs" }), _jsx("p", { className: "text-muted-foreground", children: "Include a task ID in your commit message or PR title/body using either format:" }), _jsx("code", { className: "block text-xs mt-1", children: "[TASK-<id>]  e.g. [TASK-abc123] fix login redirect" }), _jsx("code", { className: "block text-xs", children: "#swb-<id>  e.g. #swb-abc123 implement OAuth" })] })] })] }), _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-destructive", children: "Danger zone" }), _jsxs("div", { className: cn("bg-card border rounded-xl p-5 space-y-3 shadow-sm", confirmDelete && "border-destructive/50"), children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: "Delete this board" }), _jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Permanently deletes the board and all its tasks. This cannot be undone." })] }), !confirmDelete ? (_jsxs(Button, { variant: "ghost", className: "text-destructive hover:text-destructive hover:bg-destructive/10", onClick: () => setConfirmDelete(true), children: [_jsx(Trash2, { className: "w-3.5 h-3.5 mr-1.5" }), "Delete board"] })) : (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("p", { className: "text-sm text-destructive font-medium", children: "Are you sure?" }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => deleteMutation.mutate(), disabled: deleteMutation.isPending, children: deleteMutation.isPending ? "Deleting…" : "Yes, delete it" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setConfirmDelete(false), children: "Cancel" })] }))] })] })] }));
}
