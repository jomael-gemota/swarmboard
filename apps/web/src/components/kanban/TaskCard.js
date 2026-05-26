import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AGENT_LABELS, cn, formatRelative } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, GitPullRequest, Bot, FolderOpen, } from "lucide-react";
const CI_STATUS_ICONS = {
    passed: _jsx(CheckCircle2, { className: "w-3 h-3 text-emerald-400" }),
    failed: _jsx(AlertTriangle, { className: "w-3 h-3 text-red-400" }),
    running: _jsx(Clock, { className: "w-3 h-3 text-amber-400 animate-pulse" }),
    pending: _jsx(Clock, { className: "w-3 h-3 text-gray-400" }),
};
export default function TaskCard({ task, onClick }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };
    return (_jsxs("div", { ref: setNodeRef, style: style, ...attributes, ...listeners, onClick: onClick, className: cn("group bg-card border rounded-lg p-3 cursor-pointer select-none", "hover:border-primary/50 transition-all duration-150", task.hasConflict && "border-amber-500/60 bg-amber-500/5", task.isStale && "border-gray-500/40 opacity-75", isDragging && "shadow-2xl ring-1 ring-primary/50"), children: [(task.hasConflict || task.isStale) && (_jsxs("div", { className: "flex gap-2 mb-2", children: [task.hasConflict && (_jsxs("span", { className: "flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded", children: [_jsx(AlertTriangle, { className: "w-2.5 h-2.5" }), "Conflict"] })), task.isStale && (_jsxs("span", { className: "flex items-center gap-1 text-xs text-gray-400 bg-gray-400/10 px-1.5 py-0.5 rounded", children: [_jsx(Clock, { className: "w-2.5 h-2.5" }), "Stale"] }))] })), _jsx("p", { className: "text-sm font-medium leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2", children: task.title }), task.modulePath && (_jsxs("div", { className: "flex items-center gap-1 mb-2", children: [_jsx(FolderOpen, { className: "w-3 h-3 text-muted-foreground flex-shrink-0" }), _jsx("span", { className: "text-xs text-muted-foreground font-mono truncate max-w-[160px]", children: task.modulePath })] })), _jsxs("div", { className: "flex items-center justify-between gap-2 mt-2", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [task.owner && (_jsx("div", { className: "w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0", title: task.owner.name, children: task.owner.name[0]?.toUpperCase() })), task.agentType && (_jsxs("span", { className: "flex items-center gap-1 text-xs text-muted-foreground", children: [_jsx(Bot, { className: "w-3 h-3" }), AGENT_LABELS[task.agentType] ?? task.agentType] }))] }), _jsxs("div", { className: "flex items-center gap-1.5 flex-shrink-0", children: [task.ciStatus && CI_STATUS_ICONS[task.ciStatus], task.prUrl && (_jsx("a", { href: task.prUrl, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), className: "text-muted-foreground hover:text-foreground", title: "View PR", children: _jsx(GitPullRequest, { className: "w-3 h-3" }) })), task.verifiedComplete && (_jsx("span", { title: "Verified complete", children: _jsx(CheckCircle2, { className: "w-3.5 h-3.5 text-emerald-400" }) })), task.claimedComplete && !task.verifiedComplete && (_jsx("span", { className: "text-[10px] text-amber-400 border border-amber-400/40 px-1 rounded", title: "Agent claimed complete \u2014 awaiting verification", children: "claimed" })), _jsx("span", { className: "text-[10px] text-muted-foreground", children: formatRelative(task.updatedAt) })] })] })] }));
}
