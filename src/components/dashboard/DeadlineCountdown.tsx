"use client";

import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export interface DeadlineItem {
  regulation_id: string;
  title: string;
  jurisdiction_display: string;
  effective_date: string;
  days_remaining: number;
  readiness: number;
}

function getDaysColor(days: number): string {
  if (days <= 0) return "text-red-400";
  if (days < 30) return "text-red-400";
  if (days < 90) return "text-amber-400";
  return "text-emerald-400";
}

function getBarColor(days: number): string {
  if (days <= 0) return "bg-red-500";
  if (days < 30) return "bg-red-500";
  if (days < 90) return "bg-amber-500";
  return "bg-emerald-500";
}

export function DeadlineCountdown({ deadlines }: { deadlines: DeadlineItem[] }) {
  if (deadlines.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-5 py-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="w-4 h-4" />
          No upcoming deadlines for your tracked jurisdictions.
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="w-4 h-4 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Upcoming Deadlines
        </h2>
        <Badge variant="secondary" className="text-[10px]">
          {deadlines.length}
        </Badge>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {deadlines.map((d) => {
          const isEffective = d.days_remaining <= 0;
          return (
            <div
              key={d.regulation_id}
              className="shrink-0 w-[220px] rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors"
            >
              <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">
                {d.title}
              </p>
              <Badge variant="outline" className="text-[10px] mb-3">
                {d.jurisdiction_display}
              </Badge>

              {isEffective ? (
                <div className="mb-2">
                  <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">
                    NOW IN EFFECT
                  </Badge>
                </div>
              ) : (
                <div className="mb-2">
                  <span className={`text-2xl font-bold tabular-nums ${getDaysColor(d.days_remaining)}`}>
                    {d.days_remaining}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">days</span>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground mb-2">
                Effective: {format(new Date(d.effective_date), "MMM d, yyyy")}
              </p>

              {/* Readiness bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Readiness</span>
                  <span className="font-medium">{d.readiness}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getBarColor(d.days_remaining)}`}
                    style={{ width: `${Math.min(d.readiness, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
