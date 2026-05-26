import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { STATUS_LABELS } from "@/lib/utils";
const STATUSES = ["backlog", "in_progress", "in_review", "verified", "deployed"];
export default function CreateTaskDialog({ boardId, defaultStatus, onClose, onCreated, }) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState(defaultStatus);
    const [modulePath, setModulePath] = useState("");
    const createMutation = useMutation({
        mutationFn: (data) => tasksApi.create(boardId, data),
        onSuccess: (task) => onCreated(task),
    });
    function handleSubmit(e) {
        e.preventDefault();
        if (!title.trim())
            return;
        createMutation.mutate({
            title: title.trim(),
            description: description.trim() || undefined,
            status,
            modulePath: modulePath.trim() || undefined,
        });
    }
    return (_jsx(Dialog, { open: true, onOpenChange: onClose, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "New task" }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "title", children: "Title" }), _jsx(Input, { id: "title", placeholder: "Task title", value: title, onChange: (e) => setTitle(e.target.value), required: true, autoFocus: true })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "status", children: "Status" }), _jsxs(Select, { value: status, onValueChange: (v) => setStatus(v), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: STATUSES.map((s) => (_jsx(SelectItem, { value: s, children: STATUS_LABELS[s] }, s))) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "module", children: "Module path" }), _jsx(Input, { id: "module", placeholder: "e.g. packages/auth", value: modulePath, onChange: (e) => setModulePath(e.target.value), className: "font-mono text-sm" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "desc", children: "Description" }), _jsx(Textarea, { id: "desc", placeholder: "Optional description\u2026", rows: 3, value: description, onChange: (e) => setDescription(e.target.value) })] }), createMutation.error && (_jsx("p", { className: "text-sm text-destructive", children: createMutation.error.message })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "ghost", onClick: onClose, children: "Cancel" }), _jsx(Button, { type: "submit", disabled: createMutation.isPending || !title.trim(), children: createMutation.isPending ? "Creating…" : "Create task" })] })] })] }) }));
}
