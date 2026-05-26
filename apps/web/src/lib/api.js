const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
const BASE = `${API_BASE}/api`;
async function request(path, options) {
    const res = await fetch(`${BASE}${path}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...options?.headers },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "Request failed");
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
// ─── Orgs ─────────────────────────────────────────────────────────────────────
export const orgsApi = {
    list: () => request("/orgs"),
    create: (data) => request("/orgs", { method: "POST", body: JSON.stringify(data) }),
    get: (orgId) => request(`/orgs/${orgId}`),
    delete: (orgId) => request(`/orgs/${orgId}`, { method: "DELETE" }),
    inviteMember: (orgId, data) => request(`/orgs/${orgId}/members`, { method: "POST", body: JSON.stringify(data) }),
    updateMemberRole: (orgId, memberId, role) => request(`/orgs/${orgId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
    }),
    removeMember: (orgId, memberId) => request(`/orgs/${orgId}/members/${memberId}`, { method: "DELETE" }),
};
// ─── Boards ───────────────────────────────────────────────────────────────────
export const boardsApi = {
    list: (orgId) => request(`/orgs/${orgId}/boards`),
    create: (orgId, data) => request(`/orgs/${orgId}/boards`, { method: "POST", body: JSON.stringify(data) }),
    get: (orgId, boardId) => request(`/orgs/${orgId}/boards/${boardId}`),
    update: (orgId, boardId, data) => request(`/orgs/${orgId}/boards/${boardId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    }),
    delete: (orgId, boardId) => request(`/orgs/${orgId}/boards/${boardId}`, { method: "DELETE" }),
};
// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasksApi = {
    list: (boardId) => request(`/boards/${boardId}/tasks`),
    create: (boardId, data) => request(`/boards/${boardId}/tasks`, { method: "POST", body: JSON.stringify(data) }),
    update: (boardId, taskId, data) => request(`/boards/${boardId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    }),
    delete: (boardId, taskId) => request(`/boards/${boardId}/tasks/${taskId}`, { method: "DELETE" }),
    getActivity: (boardId, taskId) => request(`/boards/${boardId}/tasks/${taskId}/activity`),
};
// ─── Agent Tokens ─────────────────────────────────────────────────────────────
export const agentTokensApi = {
    list: (orgId) => request(`/orgs/${orgId}/agent-tokens`),
    create: (orgId, data) => request(`/orgs/${orgId}/agent-tokens`, {
        method: "POST",
        body: JSON.stringify(data),
    }),
    delete: (orgId, tokenId) => request(`/orgs/${orgId}/agent-tokens/${tokenId}`, { method: "DELETE" }),
};
// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
    get: (orgId) => request(`/orgs/${orgId}/dashboard`),
};
