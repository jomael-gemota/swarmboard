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
  backlog: "bg-[#8b949e]/20 text-[#c2cad1] border-[#8b949e]/35",
  in_progress: "bg-[#5b5fd9]/22 text-[#c8c9f5] border-[#7b7fe8]/40",
  in_review: "bg-[#3078e8]/18 text-[#8fb8ff] border-[#3078e8]/40",
  verified: "bg-[#38b850]/16 text-[#88dda0] border-[#38b850]/38",
  deployed: "bg-[#a878e0]/18 text-[#d4b6f5] border-[#a878e0]/40",
};

export const AGENT_LABELS: Record<string, string> = {
  cursor: "Cursor",
  claude_code: "Claude Code",
  copilot: "GitHub Copilot",
  windsurf: "Windsurf",
  other: "Other AI",
};

export const SOURCE_COLORS: Record<string, string> = {
  agent: "text-[#7b7fe8]",
  git: "text-[#38b850]",
  ci: "text-[#a87818]",
  system: "text-[#8b949e]",
  user: "text-[#a878e0]",
};

export const SOURCE_ICONS: Record<string, string> = {
  agent: "🤖",
  git: "📦",
  ci: "🔧",
  system: "⚙️",
  user: "👤",
};
