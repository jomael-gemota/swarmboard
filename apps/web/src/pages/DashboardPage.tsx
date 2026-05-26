import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { STATUS_LABELS, STATUS_COLORS, SOURCE_ICONS, formatRelative, cn } from "@/lib/utils";
import { AlertTriangle, Clock, Activity, TrendingUp, Layers } from "lucide-react";
import type { TaskStatus } from "@swarmboard/shared";

const STATUS_ORDER: TaskStatus[] = ["backlog", "in_progress", "in_review", "verified", "deployed"];

export default function DashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", orgId],
    queryFn: () => dashboardApi.get(orgId!),
    enabled: !!orgId,
    refetchInterval: 30_000,
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
    return (
      <div className="page-shell page-content space-y-6 animate-pulse">
        <div className="h-6 bg-secondary rounded w-44" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-secondary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const statusMap = Object.fromEntries(
    data.tasksByStatus.map((row) => [row.status, row._count])
  );

  const totalActive =
    (statusMap["in_progress"] ?? 0) + (statusMap["in_review"] ?? 0);

  return (
    <div className="page-shell page-content space-y-7">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Real-time overview of your AI agent swarm
        </p>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="bg-card border rounded-xl p-4 shadow-sm">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold mb-2",
                STATUS_COLORS[status]
              )}
            >
              {STATUS_LABELS[status]}
            </span>
            <p className="text-3xl font-bold">{statusMap[status] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Alerts row */}
      {(data.staleTasks.length > 0 || data.conflictTasks.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Stale tasks */}
          {data.staleTasks.length > 0 && (
            <div className="bg-card border border-amber-500/30 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-amber-400">
                  Stale tasks ({data.staleTasks.length})
                </h2>
              </div>
              <div className="space-y-2">
                {data.staleTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="text-sm text-muted-foreground truncate">
                    {task.title}
                  </div>
                ))}
                {data.staleTasks.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    +{data.staleTasks.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Conflict tasks */}
          {data.conflictTasks.length > 0 && (
            <div className="bg-card border border-red-500/30 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-semibold text-red-400">
                  Module conflicts ({data.conflictTasks.length})
                </h2>
              </div>
              <div className="space-y-2">
                {data.conflictTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="text-sm">
                    <span className="text-muted-foreground truncate block">{task.title}</span>
                    {task.modulePath && (
                      <span className="text-xs font-mono text-red-400/70">{task.modulePath}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Module heatmap */}
      {Object.keys(data.moduleHeatmap).length > 0 && (
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Active modules</h2>
            <span className="text-xs text-muted-foreground">
              — currently being worked on
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.moduleHeatmap)
              .sort(([, a], [, b]) => b - a)
              .map(([mod, count]) => (
                <div
                  key={mod}
                  className="flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded-md"
                  style={{ opacity: Math.min(0.4 + count * 0.3, 1) }}
                >
                  <span className="text-xs font-mono text-foreground">{mod}</span>
                  <span className="text-xs text-muted-foreground font-medium">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent activity feed */}
      <div className="bg-card border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Recent activity</h2>
        </div>
        <div className="space-y-3">
          {data.recentActivity.slice(0, 20).map((log) => (
            <div key={log.id} className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5 flex-shrink-0">
                {SOURCE_ICONS[log.source]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground line-clamp-1">{log.content}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {formatRelative(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
          {data.recentActivity.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
