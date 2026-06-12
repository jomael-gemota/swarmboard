import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Task, TaskStatus } from "@swarmboard/shared";
import { tasksApi } from "@/lib/api";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { STATUS_LABELS } from "@/lib/utils";

export interface BoardMember {
  id: string;
  name: string | null;
  email: string | null;
}

interface CreateTaskDialogProps {
  boardId: string;
  defaultStatus: TaskStatus;
  members?: BoardMember[];
  onClose: () => void;
  onCreated: (task: Task) => void;
}

const STATUSES: TaskStatus[] = ["backlog", "in_progress", "in_review", "verified", "deployed"];
const UNASSIGNED = "__unassigned__";

export function memberLabel(m: BoardMember): string {
  return m.name ?? m.email ?? m.id;
}

export default function CreateTaskDialog({
  boardId,
  defaultStatus,
  members = [],
  onClose,
  onCreated,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [assigneeId, setAssigneeId] = useState<string>(UNASSIGNED);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Task>) => tasksApi.create(boardId, data),
    onSuccess: (task) => onCreated(task),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="[Feature]: Add OAuth login to settings page"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Format: [Type]: Action + object + context. Type ∈ Feature, Bug, Chore, Docs, Refactor.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assignee">Assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {memberLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              On boards that require assignment, agents can only claim tasks assigned to their user.
              Unassigned tasks can't be claimed by an agent.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              placeholder="Optional description…"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {createMutation.error && (
            <p className="text-sm text-destructive">
              {createMutation.error.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !title.trim()}>
              {createMutation.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
