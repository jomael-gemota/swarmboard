import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Task, TaskStatus } from "@swarmboard/shared";
import { tasksApi, boardsApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import KanbanColumn from "@/components/kanban/KanbanColumn";
import TaskDetailDrawer from "@/components/kanban/TaskDetailDrawer";
import CreateTaskDialog from "@/components/kanban/CreateTaskDialog";
import { STATUS_LABELS } from "@/lib/utils";
import { Loader2, Wifi, WifiOff, Settings } from "lucide-react";

const STATUSES: TaskStatus[] = ["backlog", "in_progress", "in_review", "verified", "deployed"];

export default function BoardPage() {
  const { orgId, boardId } = useParams<{ orgId: string; boardId: string }>();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const [connected, setConnected] = useState(true);

  const { data: board } = useQuery({
    queryKey: ["board", orgId, boardId],
    queryFn: () => boardsApi.get(orgId!, boardId!),
    enabled: !!orgId && !!boardId,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", boardId],
    queryFn: () => tasksApi.list(boardId!),
    enabled: !!boardId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Partial<Task> }) =>
      tasksApi.update(boardId!, taskId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", boardId] }),
  });

  // Socket.io real-time updates
  useEffect(() => {
    if (!boardId) return;
    const socket = getSocket();
    socket.emit("board:join", boardId);

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("task:updated", (updatedTask) => {
      queryClient.setQueryData<Task[]>(["tasks", boardId], (old) =>
        old?.map((t) => (t.id === updatedTask.id ? (updatedTask as Task) : t)) ?? []
      );
      // Sync selected task if open
      setSelectedTask((prev) =>
        prev?.id === updatedTask.id ? (updatedTask as Task) : prev
      );
    });

    socket.on("task:created", (newTask) => {
      queryClient.setQueryData<Task[]>(["tasks", boardId], (old) => [
        ...(old ?? []),
        newTask as Task,
      ]);
    });

    socket.on("task:deleted", (taskId) => {
      queryClient.setQueryData<Task[]>(["tasks", boardId], (old) =>
        old?.filter((t) => t.id !== taskId) ?? []
      );
    });

    return () => {
      socket.emit("board:leave", boardId);
      socket.off("task:updated");
      socket.off("task:created");
      socket.off("task:deleted");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [boardId, queryClient]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const newStatus = over.id as TaskStatus;
    if (!STATUSES.includes(newStatus)) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    queryClient.setQueryData<Task[]>(["tasks", boardId], (old) =>
      old?.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)) ?? []
    );

    updateMutation.mutate({ taskId: task.id, data: { status: newStatus } });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tasksByStatus = STATUSES.reduce<Record<TaskStatus, Task[]>>(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>
  );

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Board header */}
      <div className="flex items-center justify-between px-5 md:px-6 xl:px-8 py-4 border-b flex-shrink-0 bg-card/60">
        <div>
          <h1 className="text-xl font-semibold">{board?.name ?? "Board"}</h1>
          {board?.repoUrl && (
            <a
              href={board.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {board.repoUrl}
            </a>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {connected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
            )}
            {connected ? "Live" : "Disconnected"}
          </div>

          {/* Task counts */}
          <div className="flex items-center gap-2">
            {tasks.filter((t) => t.isStale).length > 0 && (
              <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                {tasks.filter((t) => t.isStale).length} stale
              </span>
            )}
            {tasks.filter((t) => t.hasConflict).length > 0 && (
              <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                {tasks.filter((t) => t.hasConflict).length} conflicts
              </span>
            )}
          </div>

          {/* Board settings */}
          <Link
            to={`/orgs/${orgId}/boards/${boardId}/settings`}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Board settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-5 md:p-6 xl:p-8 h-full">
            {STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status]}
                onTaskClick={setSelectedTask}
                onAddTask={(s) => setCreateStatus(s)}
              />
            ))}
          </div>
        </DndContext>
      </div>

      {/* Task detail drawer */}
      {selectedTask && boardId && (
        <TaskDetailDrawer
          task={selectedTask}
          boardId={boardId}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Create task dialog */}
      {createStatus && boardId && (
        <CreateTaskDialog
          boardId={boardId}
          defaultStatus={createStatus}
          onClose={() => setCreateStatus(null)}
          onCreated={(task) => {
            queryClient.setQueryData<Task[]>(["tasks", boardId], (old) => [
              ...(old ?? []),
              task,
            ]);
            setCreateStatus(null);
          }}
        />
      )}
    </div>
  );
}
