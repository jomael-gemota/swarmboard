import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatRelative, SOURCE_COLORS, SOURCE_ICONS } from "@/lib/utils";
import { cn } from "@/lib/utils";
export default function ActivityFeed({ logs }) {
    if (logs.length === 0) {
        return (_jsx("div", { className: "text-sm text-muted-foreground text-center py-8", children: "No activity yet" }));
    }
    return (_jsx("div", { className: "space-y-3", children: logs.map((log) => (_jsxs("div", { className: "flex gap-2.5", children: [_jsx("div", { className: "w-6 h-6 flex-shrink-0 flex items-center justify-center mt-0.5", children: _jsx("span", { className: "text-base leading-none", children: SOURCE_ICONS[log.source] }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [log.summary && (_jsxs("div", { className: "mb-1 text-xs bg-primary/10 border border-primary/20 text-primary px-2 py-1 rounded-md", children: [_jsx("span", { className: "font-medium", children: "Summary: " }), log.summary] })), _jsx("p", { className: cn("text-sm leading-relaxed break-words", SOURCE_COLORS[log.source]), children: log.content }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("span", { className: "text-[10px] text-muted-foreground uppercase tracking-wide font-medium", children: log.source }), _jsx("span", { className: "text-[10px] text-muted-foreground", children: formatRelative(log.createdAt) })] })] })] }, log.id))) }));
}
