import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { STATUS_LABELS, STATUS_COLORS, SOURCE_ICONS, formatRelative, cn } from "@/lib/utils";
import { AlertTriangle, Clock, Activity, Layers } from "lucide-react";
const STATUS_ORDER = ["backlog", "in_progress", "in_review", "verified", "deployed"];
export default function DashboardPage() {
    const { orgId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data, isLoading, error } = useQuery({
        queryKey: ["dashboard", orgId],
        queryFn: () => dashboardApi.get(orgId),
        enabled: !!orgId,
        refetchInterval: 30000,
        retry: false,
    });
    // If the org no longer exists (403/404), clear stale cache and go home
    useEffect(() => {
        if (error) {
            queryClient.removeQueries({ queryKey: ["orgs"] });
            queryClient.removeQueries({ queryKey: ["org", orgId] });
            queryClient.removeQueries({ queryKey: ["boards", orgId] });
            navigate("/", { replace: true });
        }
    }, [error, orgId, queryClient, navigate]);
    if (isLoading || !data) {
        return (_jsxs("div", { className: "page-shell page-content space-y-6 animate-pulse", children: [_jsx("div", { className: "h-6 bg-secondary rounded w-44" }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-24 bg-secondary rounded-xl" }, i))) })] }));
    }
    const statusMap = Object.fromEntries(data.tasksByStatus.map((row) => [row.status, row._count]));
    const totalActive = (statusMap["in_progress"] ?? 0) + (statusMap["in_review"] ?? 0);
    return (_jsxs("div", { className: "page-shell page-content space-y-7", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Dashboard" }), _jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Real-time overview of your AI agent swarm" })] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3", children: STATUS_ORDER.map((status) => (_jsxs("div", { className: "bg-card border rounded-xl p-4 shadow-sm", children: [_jsx("span", { className: cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold mb-2", STATUS_COLORS[status]), children: STATUS_LABELS[status] }), _jsx("p", { className: "text-3xl font-bold", children: statusMap[status] ?? 0 })] }, status))) }), (data.staleTasks.length > 0 || data.conflictTasks.length > 0) && (_jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-2 gap-4", children: [data.staleTasks.length > 0 && (_jsxs("div", { className: "bg-card border border-amber-500/30 rounded-xl p-4 shadow-sm", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(Clock, { className: "w-4 h-4 text-amber-400" }), _jsxs("h2", { className: "text-sm font-semibold text-amber-400", children: ["Stale tasks (", data.staleTasks.length, ")"] })] }), _jsxs("div", { className: "space-y-2", children: [data.staleTasks.slice(0, 5).map((task) => (_jsx("div", { className: "text-sm text-muted-foreground truncate", children: task.title }, task.id))), data.staleTasks.length > 5 && (_jsxs("p", { className: "text-xs text-muted-foreground", children: ["+", data.staleTasks.length - 5, " more"] }))] })] })), data.conflictTasks.length > 0 && (_jsxs("div", { className: "bg-card border border-red-500/30 rounded-xl p-4 shadow-sm", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(AlertTriangle, { className: "w-4 h-4 text-red-400" }), _jsxs("h2", { className: "text-sm font-semibold text-red-400", children: ["Module conflicts (", data.conflictTasks.length, ")"] })] }), _jsx("div", { className: "space-y-2", children: data.conflictTasks.slice(0, 5).map((task) => (_jsxs("div", { className: "text-sm", children: [_jsx("span", { className: "text-muted-foreground truncate block", children: task.title }), task.modulePath && (_jsx("span", { className: "text-xs font-mono text-red-400/70", children: task.modulePath }))] }, task.id))) })] }))] })), Object.keys(data.moduleHeatmap).length > 0 && (_jsxs("div", { className: "bg-card border rounded-xl p-5 shadow-sm", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Layers, { className: "w-4 h-4 text-muted-foreground" }), _jsx("h2", { className: "text-sm font-semibold", children: "Active modules" }), _jsx("span", { className: "text-xs text-muted-foreground", children: "\u2014 currently being worked on" })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: Object.entries(data.moduleHeatmap)
                            .sort(([, a], [, b]) => b - a)
                            .map(([mod, count]) => (_jsxs("div", { className: "flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded-md", style: { opacity: Math.min(0.4 + count * 0.3, 1) }, children: [_jsx("span", { className: "text-xs font-mono text-foreground", children: mod }), _jsx("span", { className: "text-xs text-muted-foreground font-medium", children: count })] }, mod))) })] })), _jsxs("div", { className: "bg-card border rounded-xl p-5 shadow-sm", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Activity, { className: "w-4 h-4 text-muted-foreground" }), _jsx("h2", { className: "text-sm font-semibold", children: "Recent activity" })] }), _jsxs("div", { className: "space-y-3", children: [data.recentActivity.slice(0, 20).map((log) => (_jsxs("div", { className: "flex items-start gap-2.5", children: [_jsx("span", { className: "text-base leading-none mt-0.5 flex-shrink-0", children: SOURCE_ICONS[log.source] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm text-muted-foreground line-clamp-1", children: log.content }), _jsx("p", { className: "text-xs text-muted-foreground/60 mt-0.5", children: formatRelative(log.createdAt) })] })] }, log.id))), data.recentActivity.length === 0 && (_jsx("p", { className: "text-sm text-muted-foreground text-center py-4", children: "No recent activity" }))] })] })] }));
}
