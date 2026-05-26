import type {
  Organization,
  Board,
  Task,
  ActivityLog,
  AgentToken,
  Member,
} from "@swarmboard/shared";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Orgs ─────────────────────────────────────────────────────────────────────

export const orgsApi = {
  list: () => request<(Organization & { role: string })[]>("/orgs"),
  create: (data: { name: string; slug: string }) =>
    request<Organization>("/orgs", { method: "POST", body: JSON.stringify(data) }),
  get: (orgId: string) =>
    request<Organization & { members: (Member & { user: { name: string; email: string; image?: string } })[] }>(`/orgs/${orgId}`),
  inviteMember: (orgId: string, data: { email: string; role: string }) =>
    request<Member>(`/orgs/${orgId}/members`, { method: "POST", body: JSON.stringify(data) }),
  updateMemberRole: (orgId: string, memberId: string, role: string) =>
    request<Member>(`/orgs/${orgId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeMember: (orgId: string, memberId: string) =>
    request<void>(`/orgs/${orgId}/members/${memberId}`, { method: "DELETE" }),
};

// ─── Boards ───────────────────────────────────────────────────────────────────

export const boardsApi = {
  list: (orgId: string) => request<Board[]>(`/orgs/${orgId}/boards`),
  create: (orgId: string, data: { name: string; repoUrl?: string; repoProvider?: string }) =>
    request<Board>(`/orgs/${orgId}/boards`, { method: "POST", body: JSON.stringify(data) }),
  get: (orgId: string, boardId: string) =>
    request<Board>(`/orgs/${orgId}/boards/${boardId}`),
  update: (orgId: string, boardId: string, data: Partial<Board>) =>
    request<Board>(`/orgs/${orgId}/boards/${boardId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (orgId: string, boardId: string) =>
    request<void>(`/orgs/${orgId}/boards/${boardId}`, { method: "DELETE" }),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasksApi = {
  list: (boardId: string) => request<Task[]>(`/boards/${boardId}/tasks`),
  create: (boardId: string, data: Partial<Task>) =>
    request<Task>(`/boards/${boardId}/tasks`, { method: "POST", body: JSON.stringify(data) }),
  update: (boardId: string, taskId: string, data: Partial<Task>) =>
    request<Task>(`/boards/${boardId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (boardId: string, taskId: string) =>
    request<void>(`/boards/${boardId}/tasks/${taskId}`, { method: "DELETE" }),
  getActivity: (boardId: string, taskId: string) =>
    request<ActivityLog[]>(`/boards/${boardId}/tasks/${taskId}/activity`),
};

// ─── Agent Tokens ─────────────────────────────────────────────────────────────

export const agentTokensApi = {
  list: (orgId: string) => request<AgentToken[]>(`/orgs/${orgId}/agent-tokens`),
  create: (orgId: string, data: { name: string }) =>
    request<AgentToken & { token: string }>(`/orgs/${orgId}/agent-tokens`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (orgId: string, tokenId: string) =>
    request<void>(`/orgs/${orgId}/agent-tokens/${tokenId}`, { method: "DELETE" }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  get: (orgId: string) =>
    request<{
      tasksByStatus: { status: string; _count: number }[];
      staleTasks: Task[];
      conflictTasks: Task[];
      recentActivity: ActivityLog[];
      memberThroughput: Record<string, Record<string, number>>;
      moduleHeatmap: Record<string, number>;
    }>(`/orgs/${orgId}/dashboard`),
};
