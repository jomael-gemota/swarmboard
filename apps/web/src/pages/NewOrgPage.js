import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orgsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bug, ArrowLeft } from "lucide-react";
export default function NewOrgPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const createMutation = useMutation({
        mutationFn: () => orgsApi.create({ name, slug }),
        onSuccess: (org) => {
            queryClient.invalidateQueries({ queryKey: ["orgs"] });
            navigate(`/orgs/${org.id}`);
        },
    });
    function handleNameChange(val) {
        setName(val);
        if (!slugTouched) {
            setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        }
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background px-4", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "flex items-center justify-center gap-2.5 mb-8", children: [_jsx("div", { className: "w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-sm", children: _jsx(Bug, { className: "w-5 h-5 text-primary-foreground" }) }), _jsx("span", { className: "text-xl font-bold tracking-tight uppercase", children: "swarmboard" })] }), _jsxs("div", { className: "bg-card border rounded-xl p-7 shadow-xl", children: [_jsxs("button", { onClick: () => navigate("/"), className: "flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors", children: [_jsx(ArrowLeft, { className: "w-3.5 h-3.5" }), " Back"] }), _jsx("h1", { className: "text-lg font-semibold mb-1", children: "Create a workspace" }), _jsx("p", { className: "text-sm text-muted-foreground mb-5", children: "A workspace is where your team's boards and agents live" }), _jsxs("form", { onSubmit: (e) => {
                                e.preventDefault();
                                createMutation.mutate();
                            }, className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "org-name", children: "Workspace name" }), _jsx(Input, { id: "org-name", placeholder: "Acme Engineering", value: name, onChange: (e) => handleNameChange(e.target.value), required: true, autoFocus: true })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "org-slug", children: "Slug" }), _jsx(Input, { id: "org-slug", placeholder: "acme-engineering", value: slug, onChange: (e) => {
                                                setSlug(e.target.value);
                                                setSlugTouched(true);
                                            }, pattern: "^[a-z0-9\\-]+$", title: "Lowercase letters, numbers, and hyphens only", required: true }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Lowercase letters, numbers, and hyphens only" })] }), createMutation.error && (_jsx("p", { className: "text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md", children: createMutation.error.message })), _jsx(Button, { type: "submit", className: "w-full", disabled: createMutation.isPending, children: createMutation.isPending ? "Creating…" : "Create workspace" })] })] })] }) }));
}
