import { useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut, useSession } from "@/lib/auth-client";
import { orgsApi, boardsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bug,
  LayoutDashboard,
  Columns,
  Key,
  Users,
  ChevronDown,
  Plus,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { orgId, boardId } = useParams();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  const createBoardMutation = useMutation({
    mutationFn: (name: string) =>
      boardsApi.create(orgId!, { name }),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["boards", orgId] });
      setShowCreateBoard(false);
      setNewBoardName("");
      navigate(`/orgs/${orgId}/boards/${board.id}`);
    },
  });

  function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    createBoardMutation.mutate(newBoardName.trim());
  }

  const { data: orgs = [] } = useQuery({
    queryKey: ["orgs"],
    queryFn: orgsApi.list,
  });

  const { data: boards = [] } = useQuery({
    queryKey: ["boards", orgId],
    queryFn: () => boardsApi.list(orgId!),
    enabled: !!orgId,
  });

  const currentOrg = orgs.find((o) => o.id === orgId);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const navItem = (
    href: string,
    icon: React.ReactNode,
    label: string,
    options?: { exact?: boolean }
  ) => {
    const active = options?.exact
      ? location.pathname === href
      : location.pathname === href || location.pathname.startsWith(href + "/");
    return (
      <Link
        to={href}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
          active
            ? "bg-primary/15 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r bg-card flex flex-col">
        {/* Logo + Org switcher */}
        <div className="p-4 border-b">
          <Link to="/" className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
              <Bug className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-tight">swarmboard</span>
          </Link>

          {/* Org switcher */}
          <div className="relative">
            <button
              onClick={() => setOrgMenuOpen((o) => !o)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm bg-secondary hover:bg-accent transition-colors"
            >
              <span className="truncate font-medium">
                {currentOrg?.name ?? "Select workspace"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            </button>

            {orgMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 overflow-hidden">
                {orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      navigate(`/orgs/${org.id}`);
                      setOrgMenuOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                      org.id === orgId && "text-primary font-medium"
                    )}
                  >
                    {org.name}
                  </button>
                ))}
                <div className="border-t">
                  <button
                    onClick={() => {
                      navigate("/workspaces/new");
                      setOrgMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> New workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {orgId && (
            <>
              {navItem(`/orgs/${orgId}`, <LayoutDashboard className="w-4 h-4" />, "Dashboard", { exact: true })}
              {navItem(
                `/orgs/${orgId}/members`,
                <Users className="w-4 h-4" />,
                "Members"
              )}
              {navItem(
                `/orgs/${orgId}/agent-tokens`,
                <Key className="w-4 h-4" />,
                "Agent Tokens"
              )}
              {navItem(
                `/orgs/${orgId}/settings`,
                <Settings className="w-4 h-4" />,
                "Settings"
              )}

              {/* Boards */}
              <div className="pt-3 pb-1">
                <div className="flex items-center justify-between px-3 mb-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Boards
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={() => setShowCreateBoard(true)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                {boards.map((board) => (
                  <div key={board.id}>
                    {navItem(
                      `/orgs/${orgId}/boards/${board.id}`,
                      <Columns className="w-4 h-4" />,
                      board.name
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {orgs.length === 0 && location.pathname !== "/workspaces/new" && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              <Button size="sm" className="w-full" onClick={() => navigate("/workspaces/new")}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Create workspace
              </Button>
            </div>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Create board dialog */}
      <Dialog open={showCreateBoard} onOpenChange={setShowCreateBoard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBoard} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="board-name">Board name</Label>
              <Input
                id="board-name"
                placeholder="e.g. Sprint 12, Backend Refactor"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                autoFocus
              />
            </div>
            {createBoardMutation.error && (
              <p className="text-sm text-destructive">{createBoardMutation.error.message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreateBoard(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newBoardName.trim() || createBoardMutation.isPending}>
                {createBoardMutation.isPending ? "Creating…" : "Create board"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
