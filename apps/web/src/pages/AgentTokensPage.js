import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentTokensApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Key, Plus, Trash2, Copy, Check, Clock } from "lucide-react";
import { formatDate, formatRelative } from "@/lib/utils";
export default function AgentTokensPage() {
    const { orgId } = useParams();
    const queryClient = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [newTokenName, setNewTokenName] = useState("");
    const [revealedToken, setRevealedToken] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const { data: tokens = [], isLoading } = useQuery({
        queryKey: ["agent-tokens", orgId],
        queryFn: () => agentTokensApi.list(orgId),
        enabled: !!orgId,
    });
    const createMutation = useMutation({
        mutationFn: (name) => agentTokensApi.create(orgId, { name }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["agent-tokens", orgId] });
            setRevealedToken(data.token);
            setShowCreate(false);
            setNewTokenName("");
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (tokenId) => agentTokensApi.delete(orgId, tokenId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-tokens", orgId] }),
    });
    async function copyToken(text, id) {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }
    return (_jsxs("div", { className: "page-shell page-content", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Agent Tokens" }), _jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Generate tokens so your AI agents can report into swarmboard" })] }), _jsxs(Button, { size: "sm", onClick: () => setShowCreate(true), children: [_jsx(Plus, { className: "w-3.5 h-3.5 mr-1.5" }), "New token"] })] }), revealedToken && (_jsxs("div", { className: "mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 shadow-sm", children: [_jsx("p", { className: "text-sm font-medium text-emerald-400 mb-2", children: "Token created \u2014 copy it now, it won't be shown again" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "flex-1 text-xs font-mono bg-secondary px-3 py-2 rounded-md truncate", children: revealedToken }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => copyToken(revealedToken, "revealed"), children: copiedId === "revealed" ? (_jsx(Check, { className: "w-3.5 h-3.5 text-emerald-400" })) : (_jsx(Copy, { className: "w-3.5 h-3.5" })) }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setRevealedToken(null), children: "Dismiss" })] })] })), isLoading ? (_jsx("div", { className: "space-y-3 animate-pulse", children: [1, 2].map((i) => (_jsx("div", { className: "h-16 bg-secondary rounded-xl" }, i))) })) : tokens.length === 0 ? (_jsxs("div", { className: "text-center py-16 text-muted-foreground", children: [_jsx(Key, { className: "w-8 h-8 mx-auto mb-3 opacity-30" }), _jsx("p", { className: "text-sm", children: "No agent tokens yet" }), _jsx("p", { className: "text-xs mt-1", children: "Create a token to let your AI agents report their status" })] })) : (_jsx("div", { className: "space-y-2", children: tokens.map((token) => (_jsxs("div", { className: "flex items-center gap-3 bg-card border rounded-xl px-4 py-3 shadow-sm", children: [_jsx(Key, { className: "w-4 h-4 text-muted-foreground flex-shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium", children: token.name }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-muted-foreground mt-0.5", children: [_jsxs("span", { children: ["Created ", formatDate(token.createdAt)] }), token.lastUsedAt && (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Clock, { className: "w-3 h-3" }), "Last used ", formatRelative(token.lastUsedAt)] })), token.user && _jsxs("span", { children: ["by ", token.user.name] })] })] }), _jsx(Button, { size: "icon", variant: "ghost", className: "text-destructive hover:text-destructive hover:bg-destructive/10", onClick: () => {
                                if (confirm(`Revoke token "${token.name}"?`)) {
                                    deleteMutation.mutate(token.id);
                                }
                            }, children: _jsx(Trash2, { className: "w-4 h-4" }) })] }, token.id))) })), _jsxs("div", { className: "mt-8 bg-card border rounded-xl p-5 shadow-sm", children: [_jsx("h3", { className: "text-sm font-semibold mb-3", children: "Using your token" }), _jsxs("div", { className: "space-y-4 text-sm", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-muted-foreground mb-2", children: [_jsx("strong", { className: "text-foreground", children: "Option A \u2014 MCP Server" }), " (recommended for Cursor, Claude Code)"] }), _jsx("code", { className: "block text-xs font-mono bg-secondary px-3 py-2 rounded-md", children: `// .cursor/mcp.json or mcp_config.json\n{\n  "mcpServers": {\n    "swarmboard": {\n      "command": "npx",\n      "args": ["-y", "@swarmboard/mcp-server"],\n      "env": {\n        "SWARMBOARD_TOKEN": "swb_your_token_here",\n        "SWARMBOARD_URL": "https://your-swarmboard.com"\n      }\n    }\n  }\n}` })] }), _jsxs("div", { children: [_jsx("p", { className: "text-muted-foreground mb-2", children: _jsx("strong", { className: "text-foreground", children: "Option B \u2014 REST API" }) }), _jsx("code", { className: "block text-xs font-mono bg-secondary px-3 py-2 rounded-md", children: `curl -X POST https://your-swarmboard.com/api/v1/tasks/{taskId}/update \\\n  -H "Authorization: Bearer swb_your_token_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message": "Refactored auth module"}'` })] })] })] }), _jsx(Dialog, { open: showCreate, onOpenChange: setShowCreate, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Create agent token" }) }), _jsx("div", { className: "space-y-4 py-2", children: _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "token-name", children: "Token name" }), _jsx(Input, { id: "token-name", placeholder: 'e.g. "My Cursor setup" or "Work laptop"', value: newTokenName, onChange: (e) => setNewTokenName(e.target.value), autoFocus: true })] }) }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "ghost", onClick: () => setShowCreate(false), children: "Cancel" }), _jsx(Button, { onClick: () => createMutation.mutate(newTokenName), disabled: !newTokenName.trim() || createMutation.isPending, children: createMutation.isPending ? "Creating…" : "Create token" })] })] }) })] }));
}
