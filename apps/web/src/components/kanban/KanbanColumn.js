import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TaskCard from "./TaskCard";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, STATUS_COLORS, cn } from "@/lib/utils";
import { Plus } from "lucide-react";
export default function KanbanColumn({ status, tasks, onTaskClick, onAddTask, }) {
    const { setNodeRef, isOver } = useDroppable({ id: status });
    return (_jsxs("div", { className: "flex flex-col w-72 flex-shrink-0", children: [_jsxs("div", { className: "flex items-center justify-between mb-3 px-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold", STATUS_COLORS[status]), children: STATUS_LABELS[status] }), _jsx("span", { className: "text-xs text-muted-foreground font-medium", children: tasks.length })] }), _jsx(Button, { size: "icon", variant: "ghost", className: "h-6 w-6 text-muted-foreground hover:text-foreground", onClick: () => onAddTask(status), title: `Add task to ${STATUS_LABELS[status]}`, children: _jsx(Plus, { className: "w-3.5 h-3.5" }) })] }), _jsx(SortableContext, { items: tasks.map((t) => t.id), strategy: verticalListSortingStrategy, children: _jsxs("div", { ref: setNodeRef, className: cn("flex-1 space-y-2.5 p-2 rounded-xl min-h-[120px] transition-colors", isOver ? "bg-primary/5 ring-1 ring-primary/30" : "bg-secondary/30"), children: [tasks.map((task) => (_jsx(TaskCard, { task: task, onClick: () => onTaskClick(task) }, task.id))), tasks.length === 0 && (_jsx("div", { className: "flex items-center justify-center h-20 text-xs text-muted-foreground/50", children: "Drop tasks here" }))] }) })] }));
}
