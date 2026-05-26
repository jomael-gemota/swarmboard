import type { ActivityLog } from "@swarmboard/shared";
import { formatRelative, SOURCE_COLORS, SOURCE_ICONS } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ActivityFeedProps {
  logs: ActivityLog[];
}

export default function ActivityFeed({ logs }: ActivityFeedProps) {
  if (logs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No activity yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-2.5">
          {/* Source icon */}
          <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center mt-0.5">
            <span className="text-base leading-none">{SOURCE_ICONS[log.source]}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Summary (if available) */}
            {log.summary && (
              <div className="mb-1 text-xs bg-primary/10 border border-primary/20 text-primary px-2 py-1 rounded-md">
                <span className="font-medium">Summary: </span>
                {log.summary}
              </div>
            )}

            <p className={cn("text-sm leading-relaxed break-words", SOURCE_COLORS[log.source])}>
              {log.content}
            </p>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                {log.source}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatRelative(log.createdAt)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
