import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bug } from "lucide-react";
export default function LoginPage() {
    const navigate = useNavigate();
    const [mode, setMode] = useState("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            if (mode === "login") {
                const result = await signIn.email({ email, password });
                if (result.error)
                    throw new Error(result.error.message);
            }
            else {
                const result = await signUp.email({ email, password, name });
                if (result.error)
                    throw new Error(result.error.message);
            }
            navigate("/");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background px-4", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "flex items-center justify-center gap-2.5 mb-8", children: [_jsx("div", { className: "w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-sm", children: _jsx(Bug, { className: "w-5 h-5 text-primary-foreground" }) }), _jsx("span", { className: "text-xl font-bold tracking-tight uppercase", children: "swarmboard" })] }), _jsxs("div", { className: "bg-card border rounded-xl p-7 shadow-xl", children: [_jsx("h1", { className: "text-lg font-semibold mb-1", children: mode === "login" ? "Welcome back" : "Create an account" }), _jsx("p", { className: "text-sm text-muted-foreground mb-6", children: mode === "login"
                                ? "Sign in to your swarmboard workspace"
                                : "Start tracking your AI agent swarm" }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [mode === "signup" && (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "name", children: "Name" }), _jsx(Input, { id: "name", placeholder: "Your name", value: name, onChange: (e) => setName(e.target.value), required: true })] })), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "email", children: "Email" }), _jsx(Input, { id: "email", type: "email", placeholder: "you@example.com", value: email, onChange: (e) => setEmail(e.target.value), required: true })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "password", children: "Password" }), _jsx(Input, { id: "password", type: "password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 8 })] }), error && (_jsx("p", { className: "text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md", children: error })), _jsx(Button, { type: "submit", className: "w-full", disabled: loading, children: loading ? "Loading…" : mode === "login" ? "Sign in" : "Create account" })] }), _jsx("div", { className: "mt-4 text-center text-sm text-muted-foreground", children: mode === "login" ? (_jsxs(_Fragment, { children: ["Don't have an account?", " ", _jsx("button", { onClick: () => setMode("signup"), className: "text-primary hover:underline font-medium", children: "Sign up" })] })) : (_jsxs(_Fragment, { children: ["Already have an account?", " ", _jsx("button", { onClick: () => setMode("login"), className: "text-primary hover:underline font-medium", children: "Sign in" })] })) })] })] }) }));
}
