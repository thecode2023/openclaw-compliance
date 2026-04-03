"use client";

import Link from "next/link";
import {
  CalendarClock,
  Bell,
  FileText,
  Shield,
  TrendingDown,
  Newspaper,
  FileSearch,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ActionItem {
  id: string;
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  description: string;
  action_url: string;
  action_label: string;
  category: "deadline" | "alert" | "policy" | "score" | "audit" | "digest" | "coverage";
}

const priorityConfig: Record<string, { color: string; border: string; label: string }> = {
  urgent: { color: "text-red-400", border: "border-l-red-500", label: "Urgent" },
  high: { color: "text-orange-400", border: "border-l-orange-500", label: "High" },
  medium: { color: "text-amber-400", border: "border-l-amber-500", label: "Medium" },
  low: { color: "text-blue-400", border: "border-l-blue-500", label: "Low" },
};

const categoryIcons: Record<string, typeof Bell> = {
  deadline: CalendarClock,
  alert: Bell,
  policy: FileText,
  score: TrendingDown,
  audit: FileSearch,
  digest: Newspaper,
  coverage: Shield,
};

export function ActionItems({ items }: { items: ActionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-5 py-6 mb-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        <p className="text-sm font-medium mb-1">You&apos;re up to date</p>
        <p className="text-xs text-muted-foreground">
          No action items right now. Next regulatory scan: Monday 6AM UTC.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Action Items
        </h2>
        <Badge variant="secondary" className="text-[10px]">
          {items.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const config = priorityConfig[item.priority];
          const Icon = categoryIcons[item.category] || Bell;
          return (
            <div
              key={item.id}
              className={`rounded-lg border border-border bg-card p-4 border-l-4 ${config.border} flex items-start gap-3`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${config.color} border-current/30`}
                  >
                    {config.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Link
                href={item.action_url}
                className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
              >
                {item.action_label}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
