import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, } from "@dnd-kit/core";
import { tasksApi, boardsApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import KanbanColumn from "@/components/kanban/KanbanColumn";
import TaskDetailDrawer from "@/components/kanban/TaskDetailDrawer";
import CreateTaskDialog from "@/components/kanban/CreateTaskDialog";
import { Loader2, Wifi, WifiOff, Settings } from "lucide-react";
const STATUSES = ["backlog", "in_progress", "in_review", "verified", "deployed"];
export default function BoardPage() {
    const { orgId, boardId } = useParams();
    const queryClient = useQueryClient();
    const [selectedTask, setSelectedTask] = useState(null);
    const [createStatus, setCreateStatus] = useState(null);
    const [connected, setConnected] = useState(true);
    const { data: board } = useQuery({
        queryKey: ["board", orgId, boardId],
        queryFn: () => boardsApi.get(orgId, boardId),
        enabled: !!orgId && !!boardId,
    });
    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ["tasks", boardId],
        queryFn: () => tasksApi.list(boardId),
        enabled: !!boardId,
    });
    const updateMutation = useMutation({
        mutationFn: ({ taskId, data }) => tasksApi.update(boardId, taskId, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", boardId] }),
    });
    // Socket.io real-time updates
    useEffect(() => {
        if (!boardId)
            return;
        const socket = getSocket();
        socket.emit("board:join", boardId);
        socket.on("connect", () => setConnected(true));
        socket.on("disconnect", () => setConnected(false));
        socket.on("task:updated", (updatedTask) => {
            queryClient.setQueryData(["tasks", boardId], (old) => old?.map((t) => (t.id === updatedTask.id ? updatedTask : t)) ?? []);
            // Sync selected task if open
            setSelectedTask((prev) => prev?.id === updatedTask.id ? updatedTask : prev);
        });
        socket.on("task:created", (newTask) => {
            queryClient.setQueryData(["tasks", boardId], (old) => [
                ...(old ?? []),
                newTask,
            ]);
        });
        socket.on("task:deleted", (taskId) => {
            queryClient.setQueryData(["tasks", boardId], (old) => old?.filter((t) => t.id !== taskId) ?? []);
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
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    function handleDragEnd(event) {
        const { active, over } = event;
        if (!over || active.id === over.id)
            return;
        const newStatus = over.id;
        if (!STATUSES.includes(newStatus))
            return;
        const task = tasks.find((t) => t.id === active.id);
        if (!task || task.status === newStatus)
            return;
        // Optimistic update
        queryClient.setQueryData(["tasks", boardId], (old) => old?.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)) ?? []);
        updateMutation.mutate({ taskId: task.id, data: { status: newStatus } });
    }
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-muted-foreground" }) }));
    }
    const tasksByStatus = STATUSES.reduce((acc, status) => {
        acc[status] = tasks.filter((t) => t.status === status);
        return acc;
    }, {});
    return (_jsxs("div", { className: "flex flex-col h-full min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between px-5 md:px-6 xl:px-8 py-4 border-b flex-shrink-0 bg-card/60", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold", children: board?.name ?? "Board" }), board?.repoUrl && (_jsx("a", { href: board.repoUrl, target: "_blank", rel: "noopener noreferrer", className: "text-xs text-muted-foreground hover:text-primary transition-colors", children: board.repoUrl }))] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs text-muted-foreground", children: [connected ? (_jsx(Wifi, { className: "w-3.5 h-3.5 text-emerald-400" })) : (_jsx(WifiOff, { className: "w-3.5 h-3.5 text-red-400" })), connected ? "Live" : "Disconnected"] }), _jsxs("div", { className: "flex items-center gap-2", children: [tasks.filter((t) => t.isStale).length > 0 && (_jsxs("span", { className: "text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full", children: [tasks.filter((t) => t.isStale).length, " stale"] })), tasks.filter((t) => t.hasConflict).length > 0 && (_jsxs("span", { className: "text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full", children: [tasks.filter((t) => t.hasConflict).length, " conflicts"] }))] }), _jsx(Link, { to: `/orgs/${orgId}/boards/${boardId}/settings`, className: "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors", title: "Board settings", children: _jsx(Settings, { className: "w-4 h-4" }) })] })] }), _jsx("div", { className: "flex-1 overflow-x-auto overflow-y-hidden", children: _jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx("div", { className: "flex gap-4 p-5 md:p-6 xl:p-8 h-full", children: STATUSES.map((status) => (_jsx(KanbanColumn, { status: status, tasks: tasksByStatus[status], onTaskClick: setSelectedTask, onAddTask: (s) => setCreateStatus(s) }, status))) }) }) }), selectedTask && boardId && (_jsx(TaskDetailDrawer, { task: selectedTask, boardId: boardId, onClose: () => setSelectedTask(null) })), createStatus && boardId && (_jsx(CreateTaskDialog, { boardId: boardId, defaultStatus: createStatus, onClose: () => setCreateStatus(null), onCreated: (task) => {
                    queryClient.setQueryData(["tasks", boardId], (old) => [
                        ...(old ?? []),
                        task,
                    ]);
                    setCreateStatus(null);
                } }))] }));
}
