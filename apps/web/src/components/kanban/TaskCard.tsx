import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@swarmboard/shared";
import { cn } from "@/lib/utils";
import { ListTree, FileCode, GitPullRequest, Ban } from "lucide-react";

interface TaskCardProps {
  task: Task;
  meta?: { subDone: number; subTotal: number; percent: number; parentTitle?: string };
  onClick: () => void;
}

const MAX_FILES_SHOWN = 3;

// Last two path segments keep the filename (and a bit of context) visible
// without overflowing the narrow card; the full path lives in the tooltip.
function shortPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments.slice(-2).join("/") || path;
}

export default function TaskCard({ task, meta, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const hasSubtasks = !!meta && meta.subTotal > 0;

  // Prefer the files actually changed (reported from git); before any changes
  // are reported, fall back to the files declared when the task was claimed.
  const touchedFiles =
    task.changedFiles && task.changedFiles.length > 0
      ? task.changedFiles
      : task.declaredFiles ?? [];
  const hasFiles = touchedFiles.length > 0;
  const isChanged = !!task.changedFiles && task.changedFiles.length > 0;
  const extraFiles = touchedFiles.length - MAX_FILES_SHOWN;

  // The agent reported the work done, but the board requires a PR before review
  // and none is linked yet — the task is held in In Progress.
  const awaitingPr = task.status === "in_progress" && task.claimedComplete && !task.prUrl;

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
        task.blocked && "border-red-500/60 bg-red-500/5",
        task.hasConflict && !task.blocked && "border-amber-500/60 bg-amber-500/5",
        task.isStale && "border-gray-500/40 opacity-75",
        isDragging && "shadow-2xl ring-1 ring-primary/50"
      )}
    >
      {/* Title + owner avatar */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2 min-w-0">
          {task.title}
        </p>
        {task.owner && (
          <div
            className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0"
            title={task.owner.name}
          >
            {task.owner.name[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Blocked — strongest attention signal, needs a human */}
      {task.blocked && (
        <div
          className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400"
          title={task.blockReason ?? "Blocked"}
        >
          <Ban className="w-2.5 h-2.5" />
          Blocked
        </div>
      )}

      {/* Files the agent touched (changed files, or declared if none reported) */}
      {hasFiles && (
        <div className="mt-1.5 space-y-0.5">
          {touchedFiles.slice(0, MAX_FILES_SHOWN).map((file) => (
            <div
              key={file}
              className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono min-w-0"
              title={`${file} (${isChanged ? "changed" : "declared"})`}
            >
              <FileCode className="w-2.5 h-2.5 flex-shrink-0 text-muted-foreground/70" />
              <span className="truncate">{shortPath(file)}</span>
            </div>
          ))}
          {extraFiles > 0 && (
            <div className="pl-3.5 text-[10px] text-muted-foreground/70">
              +{extraFiles} more file{extraFiles > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Agent done, but held in In Progress until a PR is opened */}
      {awaitingPr && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
          <GitPullRequest className="w-2.5 h-2.5" />
          Done · awaiting PR
        </div>
      )}

      {/* Subtask counter (progress bar lives in the detail drawer) */}
      {hasSubtasks && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <ListTree className="w-2.5 h-2.5" />
          {meta!.subDone}/{meta!.subTotal} subtasks
        </div>
      )}
    </div>
  );
}
