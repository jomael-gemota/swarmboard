import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@swarmboard/shared";
import { Badge } from "@/components/ui/badge";
import { AGENT_LABELS, cn, formatRelative } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  GitPullRequest,
  Bot,
  FolderOpen,
  CornerDownRight,
  ListTree,
} from "lucide-react";

interface TaskCardProps {
  task: Task;
  meta?: { subDone: number; subTotal: number; parentTitle?: string };
  onClick: () => void;
}

const CI_STATUS_ICONS = {
  passed: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
  failed: <AlertTriangle className="w-3 h-3 text-red-400" />,
  running: <Clock className="w-3 h-3 text-amber-400 animate-pulse" />,
  pending: <Clock className="w-3 h-3 text-gray-400" />,
};

export default function TaskCard({ task, meta, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group bg-card border rounded-lg px-2.5 py-2 cursor-pointer select-none",
        "hover:border-primary/50 transition-all duration-150",
        task.hasConflict && "border-amber-500/60 bg-amber-500/5",
        task.isStale && "border-gray-500/40 opacity-75",
        isDragging && "shadow-2xl ring-1 ring-primary/50"
      )}
    >
      {/* Conflict / Stale warnings */}
      {(task.hasConflict || task.isStale) && (
        <div className="flex gap-1.5 mb-1">
          {task.hasConflict && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-2.5 h-2.5" />
              Conflict
            </span>
          )}
          {task.isStale && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-400/10 px-1.5 py-0.5 rounded">
              <Clock className="w-2.5 h-2.5" />
              Stale
            </span>
          )}
        </div>
      )}

      {/* Parent reference (subtask) */}
      {meta?.parentTitle && (
        <div className="flex items-center gap-1 mb-0.5 text-[10px] text-muted-foreground/70 min-w-0">
          <CornerDownRight className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate" title={meta.parentTitle}>
            {meta.parentTitle}
          </span>
        </div>
      )}

      {/* Title */}
      <p className="text-xs font-medium leading-snug mb-1.5 group-hover:text-primary transition-colors line-clamp-2">
        {task.title}
      </p>

      {/* Subtask progress + module path (inline row) */}
      {(meta?.subTotal ?? 0) > 0 || task.modulePath ? (
        <div className="flex items-center gap-2 mb-1.5">
          {meta && meta.subTotal > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <ListTree className="w-2.5 h-2.5" />
              {meta.subDone}/{meta.subTotal}
            </span>
          )}
          {task.modulePath && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono truncate min-w-0">
              <FolderOpen className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{task.modulePath}</span>
            </span>
          )}
        </div>
      ) : null}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-1.5 mt-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.owner && (
            <div
              className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0"
              title={task.owner.name}
            >
              {task.owner.name[0]?.toUpperCase()}
            </div>
          )}
          {task.agentType && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Bot className="w-2.5 h-2.5" />
              {AGENT_LABELS[task.agentType] ?? task.agentType}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {task.ciStatus && CI_STATUS_ICONS[task.ciStatus]}
          {task.prUrl && (
            <a
              href={task.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground"
              title="View PR"
            >
              <GitPullRequest className="w-2.5 h-2.5" />
            </a>
          )}
          {task.verifiedComplete && (
            <span title="Verified complete">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            </span>
          )}
          {task.claimedComplete && !task.verifiedComplete && (
            <span
              className="text-[9px] text-amber-400 border border-amber-400/40 px-1 rounded"
              title="Agent claimed complete — awaiting verification"
            >
              claimed
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {formatRelative(task.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
