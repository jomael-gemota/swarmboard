import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import AppShell from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import NewOrgPage from "@/pages/NewOrgPage";
import DashboardPage from "@/pages/DashboardPage";
import BoardPage from "@/pages/BoardPage";
import BoardSettingsPage from "@/pages/BoardSettingsPage";
import MembersPage from "@/pages/MembersPage";
import AgentTokensPage from "@/pages/AgentTokensPage";
import WorkspaceSettingsPage from "@/pages/WorkspaceSettingsPage";
import CreateWorkspacePage from "@/pages/CreateWorkspacePage";
import { orgsApi } from "@/lib/api";
import { Loader2 } from "lucide-react";
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30000,
            retry: 1,
        },
    },
});
function AuthGuard({ children }) {
    const { data: session, isPending } = useSession();
    if (isPending) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-muted-foreground" }) }));
    }
    if (!session?.user) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
function AppRoutes() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/new-org", element: _jsx(AuthGuard, { children: _jsx(NewOrgPage, {}) }) }), _jsx(Route, { path: "/workspaces/new", element: _jsx(AuthGuard, { children: _jsx(AppShell, { children: _jsx(CreateWorkspacePage, {}) }) }) }), _jsx(Route, { path: "/orgs/:orgId", element: _jsx(AuthGuard, { children: _jsx(AppShell, { children: _jsx(DashboardPage, {}) }) }) }), _jsx(Route, { path: "/orgs/:orgId/members", element: _jsx(AuthGuard, { children: _jsx(AppShell, { children: _jsx(MembersPage, {}) }) }) }), _jsx(Route, { path: "/orgs/:orgId/agent-tokens", element: _jsx(AuthGuard, { children: _jsx(AppShell, { children: _jsx(AgentTokensPage, {}) }) }) }), _jsx(Route, { path: "/orgs/:orgId/settings", element: _jsx(AuthGuard, { children: _jsx(AppShell, { children: _jsx(WorkspaceSettingsPage, {}) }) }) }), _jsx(Route, { path: "/orgs/:orgId/boards/:boardId", element: _jsx(AuthGuard, { children: _jsx(AppShell, { children: _jsx(BoardPage, {}) }) }) }), _jsx(Route, { path: "/orgs/:orgId/boards/:boardId/settings", element: _jsx(AuthGuard, { children: _jsx(AppShell, { children: _jsx(BoardSettingsPage, {}) }) }) }), _jsx(Route, { path: "/", element: _jsx(AuthGuard, { children: _jsx(RootRedirect, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}
function RootRedirect() {
    const { data: orgs, isPending } = useQuery({
        queryKey: ["orgs"],
        queryFn: orgsApi.list,
    });
    if (isPending) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-muted-foreground" }) }));
    }
    if (orgs && orgs.length > 0) {
        return _jsx(Navigate, { to: `/orgs/${orgs[0].id}`, replace: true });
    }
    return _jsx(Navigate, { to: "/workspaces/new", replace: true });
}
export default function App() {
    return (_jsx(QueryClientProvider, { client: queryClient, children: _jsx(BrowserRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true }, children: _jsx(AppRoutes, {}) }) }));
}
