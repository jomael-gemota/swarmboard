import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut, useSession } from "@/lib/auth-client";
import { orgsApi, boardsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Bug, LayoutDashboard, Columns, Key, Users, ChevronDown, Plus, LogOut, Settings, } from "lucide-react";
import { cn } from "@/lib/utils";
export default function AppShell({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { orgId, boardId } = useParams();
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const [orgMenuOpen, setOrgMenuOpen] = useState(false);
    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [newBoardName, setNewBoardName] = useState("");
    const createBoardMutation = useMutation({
        mutationFn: (name) => boardsApi.create(orgId, { name }),
        onSuccess: (board) => {
            queryClient.invalidateQueries({ queryKey: ["boards", orgId] });
            setShowCreateBoard(false);
            setNewBoardName("");
            navigate(`/orgs/${orgId}/boards/${board.id}`);
        },
    });
    function handleCreateBoard(e) {
        e.preventDefault();
        if (!newBoardName.trim())
            return;
        createBoardMutation.mutate(newBoardName.trim());
    }
    const { data: orgs = [] } = useQuery({
        queryKey: ["orgs"],
        queryFn: orgsApi.list,
    });
    const { data: boards = [] } = useQuery({
        queryKey: ["boards", orgId],
        queryFn: () => boardsApi.list(orgId),
        enabled: !!orgId,
    });
    const currentOrg = orgs.find((o) => o.id === orgId);
    async function handleSignOut() {
        await signOut();
        navigate("/login");
    }
    const navItem = (href, icon, label, options) => {
        const active = options?.exact
            ? location.pathname === href
            : location.pathname === href || location.pathname.startsWith(href + "/");
        return (_jsxs(Link, { to: href, className: cn("flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors", active
                ? "bg-primary/15 text-primary font-medium shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.24)]"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/80"), children: [icon, label] }));
    };
    return (_jsxs("div", { className: "flex h-screen overflow-hidden bg-background", children: [_jsxs("aside", { className: "w-72 xl:w-80 flex-shrink-0 border-r border-border/80 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 flex flex-col", children: [_jsxs("div", { className: "px-5 py-5 border-b", children: [_jsxs(Link, { to: "/", className: "flex items-center gap-2.5 mb-4", children: [_jsx("div", { className: "w-8 h-8 bg-primary rounded-md flex items-center justify-center shadow-sm", children: _jsx(Bug, { className: "w-4 h-4 text-primary-foreground" }) }), _jsx("span", { className: "font-bold text-sm tracking-tight uppercase text-foreground/95", children: "swarmboard" })] }), _jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setOrgMenuOpen((o) => !o), className: "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-secondary hover:bg-accent transition-colors", children: [_jsx("span", { className: "truncate font-medium", children: currentOrg?.name ?? "Select workspace" }), _jsx(ChevronDown, { className: "w-3.5 h-3.5 text-muted-foreground flex-shrink-0" })] }), orgMenuOpen && (_jsxs("div", { className: "absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 overflow-hidden", children: [orgs.map((org) => (_jsx("button", { onClick: () => {
                                                    navigate(`/orgs/${org.id}`);
                                                    setOrgMenuOpen(false);
                                                }, className: cn("w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors", org.id === orgId && "text-primary font-medium"), children: org.name }, org.id))), _jsx("div", { className: "border-t", children: _jsxs("button", { onClick: () => {
                                                        navigate("/workspaces/new");
                                                        setOrgMenuOpen(false);
                                                    }, className: "w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors flex items-center gap-2", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), " New workspace"] }) })] }))] })] }), _jsxs("nav", { className: "flex-1 overflow-y-auto px-4 py-4 space-y-1.5", children: [orgId && (_jsxs(_Fragment, { children: [navItem(`/orgs/${orgId}`, _jsx(LayoutDashboard, { className: "w-4 h-4" }), "Dashboard", { exact: true }), navItem(`/orgs/${orgId}/members`, _jsx(Users, { className: "w-4 h-4" }), "Members"), navItem(`/orgs/${orgId}/agent-tokens`, _jsx(Key, { className: "w-4 h-4" }), "Agent Tokens"), navItem(`/orgs/${orgId}/settings`, _jsx(Settings, { className: "w-4 h-4" }), "Settings"), _jsxs("div", { className: "pt-4 pb-1", children: [_jsxs("div", { className: "flex items-center justify-between px-3 mb-1.5", children: [_jsx("span", { className: "text-xs text-muted-foreground font-medium uppercase tracking-wider", children: "Boards" }), _jsx(Button, { size: "icon", variant: "ghost", className: "h-5 w-5", onClick: () => setShowCreateBoard(true), children: _jsx(Plus, { className: "w-3 h-3" }) })] }), boards.map((board) => (_jsx("div", { children: navItem(`/orgs/${orgId}/boards/${board.id}`, _jsx(Columns, { className: "w-4 h-4" }), board.name) }, board.id)))] })] })), orgs.length === 0 && location.pathname !== "/workspaces/new" && (_jsx("div", { className: "px-3 py-2 text-sm text-muted-foreground", children: _jsxs(Button, { size: "sm", className: "w-full", onClick: () => navigate("/workspaces/new"), children: [_jsx(Plus, { className: "w-3.5 h-3.5 mr-1" }), " Create workspace"] }) }))] }), _jsx("div", { className: "px-4 py-3.5 border-t", children: _jsxs("div", { className: "flex items-center gap-3 px-2.5 py-2 rounded-lg bg-secondary/40", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0", children: session?.user?.name?.[0]?.toUpperCase() ?? "?" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium truncate", children: session?.user?.name }), _jsx("p", { className: "text-xs text-muted-foreground truncate", children: session?.user?.email })] }), _jsx("button", { onClick: handleSignOut, className: "text-muted-foreground hover:text-foreground transition-colors", title: "Sign out", children: _jsx(LogOut, { className: "w-4 h-4" }) })] }) })] }), _jsx("main", { className: "flex-1 min-w-0 overflow-y-auto bg-background/60", children: children }), _jsx(Dialog, { open: showCreateBoard, onOpenChange: setShowCreateBoard, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "New board" }) }), _jsxs("form", { onSubmit: handleCreateBoard, className: "space-y-4 py-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "board-name", children: "Board name" }), _jsx(Input, { id: "board-name", placeholder: "e.g. Sprint 12, Backend Refactor", value: newBoardName, onChange: (e) => setNewBoardName(e.target.value), autoFocus: true })] }), createBoardMutation.error && (_jsx("p", { className: "text-sm text-destructive", children: createBoardMutation.error.message })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "ghost", onClick: () => setShowCreateBoard(false), children: "Cancel" }), _jsx(Button, { type: "submit", disabled: !newBoardName.trim() || createBoardMutation.isPending, children: createBoardMutation.isPending ? "Creating…" : "Create board" })] })] })] }) })] }));
}
