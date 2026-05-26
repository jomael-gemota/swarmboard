import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TaskStatus } from "@swarmboard/shared";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRelative(date: string | Date): string {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = now - d;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  in_review: "In Review",
  verified: "Verified",
  deployed: "Deployed",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  verified: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  deployed: "bg-violet-500/20 text-violet-400 border-violet-500/30",
};

export const AGENT_LABELS: Record<string, string> = {
  cursor: "Cursor",
  claude_code: "Claude Code",
  copilot: "GitHub Copilot",
  windsurf: "Windsurf",
  other: "Other AI",
};

export const SOURCE_COLORS: Record<string, string> = {
  agent: "text-blue-400",
  git: "text-emerald-400",
  ci: "text-amber-400",
  system: "text-gray-400",
  user: "text-violet-400",
};

export const SOURCE_ICONS: Record<string, string> = {
  agent: "🤖",
  git: "📦",
  ci: "🔧",
  system: "⚙️",
  user: "👤",
};
