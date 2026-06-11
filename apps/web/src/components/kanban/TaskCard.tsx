import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@swarmboard/shared";
import { cn } from "@/lib/utils";
import { ListTree } from "lucide-react";

interface TaskCardProps {
  task: Task;
  meta?: { subDone: number; subTotal: number; percent: number; parentTitle?: string };
  onClick: () => void;
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
