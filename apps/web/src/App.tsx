import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import AppShell from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import NewOrgPage from "@/pages/NewOrgPage";
import DashboardPage from "@/pages/DashboardPage";
import BoardPage from "@/pages/BoardPage";
import MembersPage from "@/pages/MembersPage";
import AgentTokensPage from "@/pages/AgentTokensPage";
import { orgsApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/new-org" element={<AuthGuard><NewOrgPage /></AuthGuard>} />

      <Route
        path="/orgs/:orgId"
        element={
          <AuthGuard>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </AuthGuard>
        }
      />
      <Route
        path="/orgs/:orgId/members"
        element={
          <AuthGuard>
            <AppShell>
              <MembersPage />
            </AppShell>
          </AuthGuard>
        }
      />
      <Route
        path="/orgs/:orgId/agent-tokens"
        element={
          <AuthGuard>
            <AppShell>
              <AgentTokensPage />
            </AppShell>
          </AuthGuard>
        }
      />
      <Route
        path="/orgs/:orgId/boards/:boardId"
        element={
          <AuthGuard>
            <AppShell>
              <BoardPage />
            </AppShell>
          </AuthGuard>
        }
      />

      {/* Root redirect */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <RootRedirect />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RootRedirect() {
  const { data: orgs, isPending } = useQuery({
    queryKey: ["orgs"],
    queryFn: orgsApi.list,
  });

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orgs && orgs.length > 0) {
    return <Navigate to={`/orgs/${orgs[0].id}`} replace />;
  }

  return <Navigate to="/new-org" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
