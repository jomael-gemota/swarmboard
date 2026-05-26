import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orgsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";
export default function CreateWorkspacePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const createMutation = useMutation({
        mutationFn: () => orgsApi.create({ name: name.trim(), slug: slug.trim() }),
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
    const canSubmit = name.trim() && slug.trim() && !createMutation.isPending;
    return (_jsxs("div", { className: "page-shell w-full max-w-4xl mx-auto", children: [_jsxs("div", { className: "flex items-center gap-3 mb-6", children: [_jsx("div", { className: "w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center", children: _jsx(Building2, { className: "w-5 h-5 text-primary" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "New workspace" }), _jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "A workspace holds your team's boards, members, and agent tokens" })] })] }), _jsx("div", { className: "bg-card border rounded-xl p-6 md:p-7 shadow-sm", children: _jsxs("form", { onSubmit: (e) => {
                        e.preventDefault();
                        if (canSubmit)
                            createMutation.mutate();
                    }, className: "space-y-5", children: [_jsxs("div", { className: "grid gap-5 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "ws-name", children: "Workspace name" }), _jsx(Input, { id: "ws-name", placeholder: "Acme Engineering", value: name, onChange: (e) => handleNameChange(e.target.value), required: true, autoFocus: true })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "ws-slug", children: "Slug" }), _jsx("div", { className: "flex items-center gap-2", children: _jsx(Input, { id: "ws-slug", placeholder: "acme-engineering", value: slug, onChange: (e) => {
                                                    setSlug(e.target.value);
                                                    setSlugTouched(true);
                                                }, pattern: "^[a-z0-9\\-]+$", title: "Lowercase letters, numbers, and hyphens only", required: true, className: "font-mono" }) }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Lowercase letters, numbers, and hyphens only" })] })] }), createMutation.error && (_jsx("p", { className: "text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md", children: createMutation.error.message })), _jsxs("div", { className: "flex items-center gap-3 pt-1", children: [_jsx(Button, { type: "submit", disabled: !canSubmit, children: createMutation.isPending ? "Creating…" : "Create workspace" }), _jsx(Button, { type: "button", variant: "ghost", onClick: () => navigate(-1), children: "Cancel" })] })] }) })] }));
}
