"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Bell, Check, X, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export interface ComplianceAlert {
  id: string;
  regulation_id: string;
  update_id: string | null;
  alert_type: string;
  title: string;
  summary: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  read: boolean;
  dismissed: boolean;
  created_at: string;
}

export interface WeeklyDigest {
  id: string;
  digest_content: {
    briefing: string;
    updates_count: number;
    period_label: string;
  };
  period_start: string;
  period_end: string;
  generated_at: string;
  read: boolean;
}

interface AlertsFeedProps {
  alerts: ComplianceAlert[];
  digest: WeeklyDigest | null;
  onAlertUpdate?: () => void;
}

const severityConfig = {
  critical: { color: "bg-red-500/15 text-red-500 border-red-500/30" },
  high: { color: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  medium: { color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  low: { color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  info: { color: "bg-muted text-muted-foreground border-border" },
};

type Filter = "all" | "unread" | "critical";

export function AlertsFeed({ alerts, digest, onAlertUpdate }: AlertsFeedProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [digestExpanded, setDigestExpanded] = useState(false);

  const filtered = alerts.filter((a) => {
    if (a.dismissed) return false;
    if (filter === "unread") return !a.read;
    if (filter === "critical") return a.severity === "critical";
    return true;
  });

  // Group alerts by date
  const grouped = filtered.reduce<Record<string, ComplianceAlert[]>>((acc, alert) => {
    const date = format(parseISO(alert.created_at), "yyyy-MM-dd");
    if (!acc[date]) acc[date] = [];
    acc[date].push(alert);
    return acc;
  }, {});

  async function markAsRead(alertIds: string[]) {
    const supabase = createClient();
    await supabase
      .from("compliance_alerts")
      .update({ read: true })
      .in("id", alertIds);
    onAlertUpdate?.();
  }

  async function dismissAlert(alertId: string) {
    const supabase = createClient();
    await supabase
      .from("compliance_alerts")
      .update({ dismissed: true })
      .eq("id", alertId);
    onAlertUpdate?.();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Activity Feed</h3>
        <div className="flex gap-1">
          {(["all", "unread", "critical"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors capitalize",
                filter === f
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly Digest Card */}
      {digest && (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">What Changed This Week</span>
            </div>
            <button
              onClick={() => setDigestExpanded(!digestExpanded)}
              className="text-muted-foreground hover:text-foreground"
            >
              {digestExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Generated {format(parseISO(digest.generated_at), "MMM d, yyyy")} · Covering{" "}
            {format(parseISO(digest.period_start), "MMM d")}–
            {format(parseISO(digest.period_end), "MMM d")} ·{" "}
            {digest.digest_content.updates_count} updates analyzed
          </p>
          <div className={cn("mt-3 text-sm leading-relaxed", !digestExpanded && "line-clamp-2")}>
            {digest.digest_content.briefing}
          </div>
          {!digestExpanded && (
            <button
              onClick={() => setDigestExpanded(true)}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              Read full briefing
            </button>
          )}
        </div>
      )}

      {/* Alerts */}
      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 px-4 text-center">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/5">
              <Bell className="h-7 w-7 text-primary/30" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500/50 ring-2 ring-card" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground/80">
            Your compliance feed is quiet
          </p>
          <p className="mt-1 text-xs text-muted-foreground max-w-[220px] leading-relaxed">
            Alerts will appear here when regulations change in your tracked jurisdictions.
          </p>
        </div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, dateAlerts]) => (
            <div key={date} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {format(parseISO(date), "MMMM d, yyyy")}
              </p>
              {dateAlerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onMarkRead={() => markAsRead([alert.id])}
                  onDismiss={() => dismissAlert(alert.id)}
                />
              ))}
            </div>
          ))
      )}
    </div>
  );
}

function AlertItem({
  alert,
  onMarkRead,
  onDismiss,
}: {
  alert: ComplianceAlert;
  onMarkRead: () => void;
  onDismiss: () => void;
}) {
  const sev = severityConfig[alert.severity];

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        alert.read ? "border-border bg-transparent" : "border-border bg-accent/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                sev.color
              )}
            >
              {alert.severity}
            </span>
            <span className={cn("text-sm font-medium truncate", !alert.read && "text-foreground")}>
              {alert.title}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{alert.summary}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {!alert.read && (
            <Button variant="ghost" size="sm" onClick={onMarkRead} className="h-7 w-7 p-0" title="Mark as read">
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDismiss} className="h-7 w-7 p-0" title="Dismiss">
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0" title="View regulation">
            <a href={`/feed`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
