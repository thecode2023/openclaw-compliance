"use client";

import { formatDistanceToNow } from "date-fns";
import { Bell, RefreshCw, Gavel, AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface WeeklyUpdate {
  regulation_id: string;
  regulation_title: string;
  jurisdiction_display: string;
  update_type: string;
  detected_at: string;
}

const updateTypeConfig: Record<string, { icon: typeof Bell; label: string; color: string }> = {
  amendment: { icon: RefreshCw, label: "Amendment", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  enforcement_action: { icon: Gavel, label: "Enforcement", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  status_change: { icon: AlertTriangle, label: "Status Change", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  new_regulation: { icon: FileText, label: "New", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  guidance_update: { icon: RefreshCw, label: "Guidance", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

export function WeeklyUpdatesBanner({ updates }: { updates: WeeklyUpdate[] }) {
  if (updates.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bell className="w-3.5 h-3.5" />
          No regulatory changes this week. Next scan: Monday 6AM UTC.
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full bg-primary pulse-live" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Updated This Week
        </h2>
        <Badge variant="secondary" className="text-[10px]">
          {updates.length}
        </Badge>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {updates.map((update, i) => {
          const config = updateTypeConfig[update.update_type] || updateTypeConfig.amendment;
          const Icon = config.icon;
          return (
            <div
              key={`${update.regulation_id}-${i}`}
              className="shrink-0 w-[260px] rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors"
            >
              <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">
                {update.regulation_title}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  {update.jurisdiction_display}
                </Badge>
                <Badge variant="outline" className={`text-[10px] gap-1 ${config.color}`}>
                  <Icon className="w-2.5 h-2.5" />
                  {config.label}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(update.detected_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
