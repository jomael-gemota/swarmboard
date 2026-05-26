import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, ActivityLog, TaskStatus } from "@swarmboard/shared";
import { tasksApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ActivityFeed from "./ActivityFeed";
import { STATUS_LABELS, STATUS_COLORS, AGENT_LABELS, cn, formatDate } from "@/lib/utils";
import {
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  GitPullRequest,
  Bot,
  FolderOpen,
  Pencil,
  Save,
} from "lucide-react";

interface TaskDetailDrawerProps {
  task: Task;
  boardId: string;
  onClose: () => void;
}

export default function TaskDetailDrawer({ task, boardId, onClose }: TaskDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description ?? "");
  const [editModule, setEditModule] = useState(task.modulePath ?? "");
  const [editStatus, setEditStatus] = useState<TaskStatus>(task.status);

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["activity", task.id],
    queryFn: () => tasksApi.getActivity(boardId, task.id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Task>) => tasksApi.update(boardId, task.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", boardId] });
      setEditing(false);
    },
  });

  // Live activity via Socket.io
  useEffect(() => {
    const socket = getSocket();
    socket.emit("board:join", boardId);

    const handleActivity = (log: ActivityLog & { taskId: string }) => {
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

  const statuses: TaskStatus[] = ["backlog", "in_progress", "in_review", "verified", "deployed"];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full bg-card border-l flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b gap-3">
          <div className="flex-1 min-w-0">
            {editing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-base font-semibold"
                autoFocus
              />
            ) : (
              <h2 className="text-base font-semibold leading-snug">{task.title}</h2>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Created {formatDate(task.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {editing ? (
              <>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status + signals row */}
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as TaskStatus)}>
                <SelectTrigger className="w-40 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold", STATUS_COLORS[task.status])}>
                {STATUS_LABELS[task.status]}
              </span>
            )}

            {task.claimedComplete && !task.verifiedComplete && (
              <span className="flex items-center gap-1 text-xs text-amber-400 border border-amber-400/40 px-2 py-0.5 rounded-md">
                <Clock className="w-3 h-3" /> Claimed complete
              </span>
            )}
            {task.verifiedComplete && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 border border-emerald-400/40 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            )}
            {task.hasConflict && (
              <span className="flex items-center gap-1 text-xs text-amber-400 border border-amber-400/40 px-2 py-0.5 rounded-md">
                <AlertTriangle className="w-3 h-3" /> Module conflict
              </span>
            )}
            {task.isStale && (
              <span className="flex items-center gap-1 text-xs text-gray-400 border border-gray-400/40 px-2 py-0.5 rounded-md">
                <Clock className="w-3 h-3" /> Stale
              </span>
            )}
          </div>

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Agent</Label>
              <div className="flex items-center gap-1.5 text-sm">
                <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                {task.agentType ? AGENT_LABELS[task.agentType] : "—"}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Owner</Label>
              <div className="text-sm">{task.owner?.name ?? "Unassigned"}</div>
            </div>
          </div>

          {/* Module path */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Module path</Label>
            {editing ? (
              <Input
                value={editModule}
                onChange={(e) => setEditModule(e.target.value)}
                placeholder="e.g. packages/auth"
                className="font-mono text-xs"
              />
            ) : (
              <div className="flex items-center gap-1.5 text-sm font-mono">
                <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                {task.modulePath ?? <span className="text-muted-foreground">—</span>}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Description</Label>
            {editing ? (
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                placeholder="Task description…"
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {task.description ?? "No description"}
              </p>
            )}
          </div>

          {/* PR / CI */}
          {(task.prUrl || task.ciStatus) && (
            <div className="flex items-center gap-3">
              {task.prUrl && (
                <a
                  href={task.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <GitPullRequest className="w-4 h-4" />
                  View PR
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {task.ciStatus && (
                <span className="text-sm text-muted-foreground">
                  CI:{" "}
                  <span
                    className={cn(
                      task.ciStatus === "passed" && "text-emerald-400",
                      task.ciStatus === "failed" && "text-red-400",
                      task.ciStatus === "running" && "text-amber-400",
                      task.ciStatus === "pending" && "text-gray-400"
                    )}
                  >
                    {task.ciStatus}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* Activity feed */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Activity
            </h3>
            <ActivityFeed logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
