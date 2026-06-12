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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import ActivityFeed from "./ActivityFeed";
import { STATUS_LABELS, STATUS_COLORS, AGENT_LABELS, cn, formatDate, subtaskProgress } from "@/lib/utils";
import {
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  GitPullRequest,
  Bot,
  Cpu,
  FolderOpen,
  Pencil,
  Save,
  CornerDownRight,
  ListTree,
  Trash2,
  Ban,
} from "lucide-react";

interface TaskDetailDrawerProps {
  task: Task;
  boardId: string;
  allTasks?: Task[];
  onTaskClick?: (task: Task) => void;
  onClose: () => void;
}

export default function TaskDetailDrawer({
  task,
  boardId,
  allTasks = [],
  onTaskClick,
  onClose,
}: TaskDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description ?? "");
  const [editStatus, setEditStatus] = useState<TaskStatus>(task.status);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(boardId, task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", boardId] });
      onClose();
    },
    onError: (err: Error) => {
      setDeleteError(err.message ?? "Failed to delete task. You may not have permission.");
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
      status: editStatus,
    });
  }

  const statuses: TaskStatus[] = ["backlog", "in_progress", "in_review", "verified", "deployed"];

  const children = allTasks.filter((t) => t.parentId === task.id);
  const parent = task.parentId ? allTasks.find((t) => t.id === task.parentId) : undefined;
  const progress = subtaskProgress(children);

  const rangesByFile = (task.lineRanges ?? []).reduce<Record<string, { start: number; end: number }[]>>(
    (acc, r) => {
      (acc[r.file] ??= []).push({ start: r.start, end: r.end });
      return acc;
    },
    {}
  );
  const formatRanges = (ranges: { start: number; end: number }[]) =>
    ranges.map((r) => (r.start === r.end ? `L${r.start}` : `L${r.start}\u2013${r.end}`)).join(", ");

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
            {parent && (
              <button
                onClick={() => onTaskClick?.(parent)}
                className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-primary transition-colors min-w-0 max-w-full"
                title={parent.title}
              >
                <CornerDownRight className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Subtask of: {parent.title}</span>
              </button>
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
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
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
              task.status === "in_progress" && !task.prUrl ? (
                <span className="flex items-center gap-1 text-xs text-amber-400 border border-amber-400/40 px-2 py-0.5 rounded-md">
                  <GitPullRequest className="w-3 h-3" /> Done · awaiting PR
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-400 border border-amber-400/40 px-2 py-0.5 rounded-md">
                  <Clock className="w-3 h-3" /> Claimed complete
                </span>
              )
            )}
            {task.verifiedComplete && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 border border-emerald-400/40 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            )}
            {task.blocked && (
              <span className="flex items-center gap-1 text-xs text-red-400 border border-red-500/50 bg-red-500/10 px-2 py-0.5 rounded-md">
                <Ban className="w-3 h-3" /> Blocked
              </span>
            )}
            {task.hasConflict && (
              <span className="flex items-center gap-1 text-xs text-amber-400 border border-amber-400/40 px-2 py-0.5 rounded-md">
                <AlertTriangle className="w-3 h-3" /> File conflict
              </span>
            )}
            {task.isStale && (
              <span className="flex items-center gap-1 text-xs text-gray-400 border border-gray-400/40 px-2 py-0.5 rounded-md">
                <Clock className="w-3 h-3" /> Stale
              </span>
            )}
          </div>

          {/* Blocker callout — reason + unblock action */}
          {task.blocked && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Ban className="w-4 h-4 text-red-400 flex-shrink-0 mt-px" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-red-400">Blocked — needs a human</p>
                  {task.blockReason && (
                    <p className="text-sm text-muted-foreground mt-0.5 break-words">
                      {task.blockReason}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => updateMutation.mutate({ blocked: false })}
                disabled={updateMutation.isPending}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Clear blocker
              </Button>
            </div>
          )}

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Agent</Label>
              <div className="flex items-center gap-1.5 text-sm">
                <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                {task.agentType ? AGENT_LABELS[task.agentType] : "—"}
              </div>
              {task.agentModel && (
                <div
                  className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground font-mono min-w-0"
                  title={`Model: ${task.agentModel}`}
                >
                  <Cpu className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{task.agentModel}</span>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Owner</Label>
              <div className="text-sm">{task.owner?.name ?? "Unassigned"}</div>
            </div>
          </div>

          {/* Files touched (declared at claim time + changed via Git) */}
          {((task.declaredFiles?.length ?? 0) > 0 || (task.changedFiles?.length ?? 0) > 0) && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Files touched</Label>
              <div className="space-y-1">
                {(task.declaredFiles ?? []).map((f) => (
                  <div key={`declared-${f}`} className="flex items-center gap-1.5 text-xs font-mono min-w-0">
                    <FolderOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate" title={f}>{f}</span>
                    <span className="text-[10px] text-muted-foreground/60 font-sans flex-shrink-0">declared</span>
                  </div>
                ))}
                {(task.changedFiles ?? []).map((f) => {
                  const ranges = rangesByFile[f];
                  return (
                    <div key={`changed-${f}`} className="flex items-center gap-1.5 text-xs font-mono min-w-0">
                      <GitPullRequest className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate" title={f}>{f}</span>
                      {ranges?.length ? (
                        <span className="text-[10px] text-amber-300/80 font-sans flex-shrink-0" title="Reported changed lines">
                          {formatRanges(ranges)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60 font-sans flex-shrink-0">changed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

          {/* Subtasks */}
          {children.length > 0 && (
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                <ListTree className="w-3.5 h-3.5" />
                Subtasks ({children.length})
              </h3>
              {/* Progress */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="text-muted-foreground">
                    {progress.done}/{progress.total} complete
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {progress.percent}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      progress.percent >= 100 ? "bg-emerald-500" : "bg-primary"
                    )}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onTaskClick?.(child)}
                    className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-md bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <span
                      className={cn(
                        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold flex-shrink-0",
                        STATUS_COLORS[child.status]
                      )}
                    >
                      {STATUS_LABELS[child.status]}
                    </span>
                    <span className="text-sm truncate flex-1">{child.title}</span>
                    {child.verifiedComplete && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
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

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">"{task.title}"</span> will be
                  permanently deleted and cannot be recovered.
                </p>
                {children.length > 0 && (
                  <p className="flex items-start gap-1.5 text-amber-400">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" />
                    This will also delete {children.length} sub-task
                    {children.length > 1 ? "s" : ""}.
                  </p>
                )}
                {deleteError && (
                  <p className="text-red-400">{deleteError}</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
