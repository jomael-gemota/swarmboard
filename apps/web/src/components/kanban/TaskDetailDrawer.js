import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ActivityFeed from "./ActivityFeed";
import { STATUS_LABELS, STATUS_COLORS, AGENT_LABELS, cn, formatDate } from "@/lib/utils";
import { X, ExternalLink, CheckCircle2, AlertTriangle, Clock, GitPullRequest, Bot, FolderOpen, Pencil, Save, } from "lucide-react";
export default function TaskDetailDrawer({ task, boardId, onClose }) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [editDesc, setEditDesc] = useState(task.description ?? "");
    const [editModule, setEditModule] = useState(task.modulePath ?? "");
    const [editStatus, setEditStatus] = useState(task.status);
    const { data: logs = [], refetch: refetchLogs } = useQuery({
        queryKey: ["activity", task.id],
        queryFn: () => tasksApi.getActivity(boardId, task.id),
    });
    const updateMutation = useMutation({
        mutationFn: (data) => tasksApi.update(boardId, task.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks", boardId] });
            setEditing(false);
        },
    });
    // Live activity via Socket.io
    useEffect(() => {
        const socket = getSocket();
        socket.emit("board:join", boardId);
        const handleActivity = (log) => {
            if (log.taskId === task.id) {
                refetchLogs();
            }
        };
        socket.on("activity:created", handleActivity);
        return () => {
            socket.off("activity:created", handleActivity);
        };
    }, [boardId, task.id, refetchLogs]);
    function handleSave() {
        updateMutation.mutate({
            title: editTitle,
            description: editDesc || undefined,
            modulePath: editModule || undefined,
            status: editStatus,
        });
    }
    const statuses = ["backlog", "in_progress", "in_review", "verified", "deployed"];
    return (_jsx("div", { className: "fixed inset-0 z-40 flex justify-end", onClick: onClose, children: _jsxs("div", { className: "w-full max-w-xl h-full bg-card border-l flex flex-col shadow-2xl", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between p-5 border-b gap-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [editing ? (_jsx(Input, { value: editTitle, onChange: (e) => setEditTitle(e.target.value), className: "text-base font-semibold", autoFocus: true })) : (_jsx("h2", { className: "text-base font-semibold leading-snug", children: task.title })), _jsxs("p", { className: "text-xs text-muted-foreground mt-1", children: ["Created ", formatDate(task.createdAt)] })] }), _jsxs("div", { className: "flex items-center gap-1.5 flex-shrink-0", children: [editing ? (_jsxs(_Fragment, { children: [_jsxs(Button, { size: "sm", onClick: handleSave, disabled: updateMutation.isPending, children: [_jsx(Save, { className: "w-3.5 h-3.5 mr-1" }), "Save"] }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setEditing(false), children: "Cancel" })] })) : (_jsxs(Button, { size: "sm", variant: "ghost", onClick: () => setEditing(true), children: [_jsx(Pencil, { className: "w-3.5 h-3.5 mr-1" }), "Edit"] })), _jsx(Button, { size: "icon", variant: "ghost", onClick: onClose, children: _jsx(X, { className: "w-4 h-4" }) })] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-5 space-y-5", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [editing ? (_jsxs(Select, { value: editStatus, onValueChange: (v) => setEditStatus(v), children: [_jsx(SelectTrigger, { className: "w-40 h-7 text-xs", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: statuses.map((s) => (_jsx(SelectItem, { value: s, children: STATUS_LABELS[s] }, s))) })] })) : (_jsx("span", { className: cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold", STATUS_COLORS[task.status]), children: STATUS_LABELS[task.status] })), task.claimedComplete && !task.verifiedComplete && (_jsxs("span", { className: "flex items-center gap-1 text-xs text-amber-400 border border-amber-400/40 px-2 py-0.5 rounded-md", children: [_jsx(Clock, { className: "w-3 h-3" }), " Claimed complete"] })), task.verifiedComplete && (_jsxs("span", { className: "flex items-center gap-1 text-xs text-emerald-400 border border-emerald-400/40 px-2 py-0.5 rounded-md", children: [_jsx(CheckCircle2, { className: "w-3 h-3" }), " Verified"] })), task.hasConflict && (_jsxs("span", { className: "flex items-center gap-1 text-xs text-amber-400 border border-amber-400/40 px-2 py-0.5 rounded-md", children: [_jsx(AlertTriangle, { className: "w-3 h-3" }), " Module conflict"] })), task.isStale && (_jsxs("span", { className: "flex items-center gap-1 text-xs text-gray-400 border border-gray-400/40 px-2 py-0.5 rounded-md", children: [_jsx(Clock, { className: "w-3 h-3" }), " Stale"] }))] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-xs text-muted-foreground mb-1.5 block", children: "Agent" }), _jsxs("div", { className: "flex items-center gap-1.5 text-sm", children: [_jsx(Bot, { className: "w-3.5 h-3.5 text-muted-foreground" }), task.agentType ? AGENT_LABELS[task.agentType] : "—"] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs text-muted-foreground mb-1.5 block", children: "Owner" }), _jsx("div", { className: "text-sm", children: task.owner?.name ?? "Unassigned" })] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs text-muted-foreground mb-1.5 block", children: "Module path" }), editing ? (_jsx(Input, { value: editModule, onChange: (e) => setEditModule(e.target.value), placeholder: "e.g. packages/auth", className: "font-mono text-xs" })) : (_jsxs("div", { className: "flex items-center gap-1.5 text-sm font-mono", children: [_jsx(FolderOpen, { className: "w-3.5 h-3.5 text-muted-foreground" }), task.modulePath ?? _jsx("span", { className: "text-muted-foreground", children: "\u2014" })] }))] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs text-muted-foreground mb-1.5 block", children: "Description" }), editing ? (_jsx(Textarea, { value: editDesc, onChange: (e) => setEditDesc(e.target.value), rows: 3, placeholder: "Task description\u2026" })) : (_jsx("p", { className: "text-sm text-muted-foreground leading-relaxed", children: task.description ?? "No description" }))] }), (task.prUrl || task.ciStatus) && (_jsxs("div", { className: "flex items-center gap-3", children: [task.prUrl && (_jsxs("a", { href: task.prUrl, target: "_blank", rel: "noopener noreferrer", className: "flex items-center gap-1.5 text-sm text-primary hover:underline", children: [_jsx(GitPullRequest, { className: "w-4 h-4" }), "View PR", _jsx(ExternalLink, { className: "w-3 h-3" })] })), task.ciStatus && (_jsxs("span", { className: "text-sm text-muted-foreground", children: ["CI:", " ", _jsx("span", { className: cn(task.ciStatus === "passed" && "text-emerald-400", task.ciStatus === "failed" && "text-red-400", task.ciStatus === "running" && "text-amber-400", task.ciStatus === "pending" && "text-gray-400"), children: task.ciStatus })] }))] })), _jsxs("div", { children: [_jsx("h3", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3", children: "Activity" }), _jsx(ActivityFeed, { logs: logs })] })] })] }) }));
}
