import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Task, TaskStatus } from "@swarmboard/shared";
import TaskCard from "./TaskCard";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, STATUS_COLORS, cn } from "@/lib/utils";
import { Plus } from "lucide-react";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}

export default function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onAddTask,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
              STATUS_COLORS[status]
            )}
          >
            {STATUS_LABELS[status]}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            {tasks.length}
          </span>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => onAddTask(status)}
          title={`Add task to ${STATUS_LABELS[status]}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Drop zone */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 space-y-2.5 p-2 rounded-xl min-h-[120px] transition-colors",
            isOver ? "bg-primary/5 ring-1 ring-primary/30" : "bg-secondary/30"
          )}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}

          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
