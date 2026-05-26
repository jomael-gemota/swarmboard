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
  ChevronRight,
} from "lucide-react";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const CI_STATUS_ICONS = {
  passed: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
  failed: <AlertTriangle className="w-3 h-3 text-red-400" />,
  running: <Clock className="w-3 h-3 text-amber-400 animate-pulse" />,
  pending: <Clock className="w-3 h-3 text-gray-400" />,
};

export default function TaskCard({ task, onClick }: TaskCardProps) {
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
        "group bg-card border rounded-lg p-3 cursor-pointer select-none",
        "hover:border-primary/50 transition-all duration-150",
        task.hasConflict && "border-amber-500/60 bg-amber-500/5",
        task.isStale && "border-gray-500/40 opacity-75",
        isDragging && "shadow-2xl ring-1 ring-primary/50"
      )}
    >
      {/* Conflict / Stale warnings */}
      {(task.hasConflict || task.isStale) && (
        <div className="flex gap-2 mb-2">
          {task.hasConflict && (
            <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-2.5 h-2.5" />
              Conflict
            </span>
          )}
          {task.isStale && (
            <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-400/10 px-1.5 py-0.5 rounded">
              <Clock className="w-2.5 h-2.5" />
              Stale
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {task.title}
      </p>

      {/* Module path */}
      {task.modulePath && (
        <div className="flex items-center gap-1 mb-2">
          <FolderOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
            {task.modulePath}
          </span>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Owner avatar */}
          {task.owner && (
            <div
              className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0"
              title={task.owner.name}
            >
              {task.owner.name[0]?.toUpperCase()}
            </div>
          )}

          {/* Agent type */}
          {task.agentType && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Bot className="w-3 h-3" />
              {AGENT_LABELS[task.agentType] ?? task.agentType}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* CI status */}
          {task.ciStatus && CI_STATUS_ICONS[task.ciStatus]}

          {/* PR link */}
          {task.prUrl && (
            <a
              href={task.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground"
              title="View PR"
            >
              <GitPullRequest className="w-3 h-3" />
            </a>
          )}

          {/* Verified badge */}
          {task.verifiedComplete && (
            <span title="Verified complete"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /></span>
          )}

          {/* Claimed (not verified) */}
          {task.claimedComplete && !task.verifiedComplete && (
            <span
              className="text-[10px] text-amber-400 border border-amber-400/40 px-1 rounded"
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
