"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, ExternalLink, FileSearch, ArrowRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { JURISDICTION_OPTIONS } from "@/lib/types/user";
import type { JurisdictionPriority } from "@/lib/types/user";

export interface JurisdictionData {
  code: string;
  score: number;
  regulationCount: number;
  velocity: "high" | "medium" | "low";
  velocityScore?: number;
  status: "compliant" | "at_risk" | "non_compliant";
  priority: JurisdictionPriority;
  auditCoverage: number;
  lastUpdateDate: string | null;
}

interface JurisdictionCardProps {
  data: JurisdictionData;
  onChangePriority: (code: string, priority: JurisdictionPriority) => void;
  onRemove: (code: string) => void;
}

const velocityConfig = {
  high: { label: "High", color: "text-red-400 bg-red-500/15" },
  medium: { label: "Med", color: "text-amber-400 bg-amber-500/15" },
  low: { label: "Low", color: "text-emerald-400 bg-emerald-500/15" },
};

const priorityLabels: Record<JurisdictionPriority, string> = {
  active: "Active Compliance",
  monitoring: "Monitoring",
  expansion: "Expansion Target",
};

export function JurisdictionCard({ data, onChangePriority, onRemove }: JurisdictionCardProps) {
  const jurisdiction = JURISDICTION_OPTIONS.find((j) => j.code === data.code);
  const vel = velocityConfig[data.velocity];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const otherPriorities = (["active", "monitoring", "expansion"] as JurisdictionPriority[]).filter(
    (p) => p !== data.priority
  );

  return (
    <div className="rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-accent/20 relative group">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/feed?jurisdiction=${data.code}`}
          className="flex items-center gap-2 min-w-0 flex-1"
        >
          <span className="text-base shrink-0">{jurisdiction?.flag ?? "🌐"}</span>
          <span className="font-medium text-sm truncate">
            {jurisdiction?.name ?? data.code}
          </span>
        </Link>

        {/* Action menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-50 w-48 rounded-lg border border-border bg-popover shadow-lg py-1 text-sm">
              <Link
                href={`/feed?jurisdiction=${data.code}`}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-popover-foreground"
                onClick={() => setMenuOpen(false)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Regulations
              </Link>
              <Link
                href="/audit"
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-popover-foreground"
                onClick={() => setMenuOpen(false)}
              >
                <FileSearch className="h-3.5 w-3.5" />
                Run Audit
              </Link>
              <div className="my-1 h-px bg-border" />
              {otherPriorities.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    onChangePriority(data.code, p);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent w-full text-left text-popover-foreground"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Move to {priorityLabels[p]}
                </button>
              ))}
              <div className="my-1 h-px bg-border" />
              <button
                onClick={() => {
                  onRemove(data.code);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-destructive/10 w-full text-left text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {/* Regulations + Velocity inline */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {data.regulationCount} regulation{data.regulationCount !== 1 ? "s" : ""}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", vel.color)}>
            {vel.label} {data.velocityScore != null ? `(${data.velocityScore})` : ""}
          </span>
        </div>

        {/* Audit coverage mini bar */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Audit Coverage</span>
            <span>{data.auditCoverage}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                data.auditCoverage >= 70
                  ? "bg-emerald-500"
                  : data.auditCoverage >= 40
                    ? "bg-amber-500"
                    : "bg-red-500"
              )}
              style={{ width: `${data.auditCoverage}%` }}
            />
          </div>
        </div>

        {/* Last update */}
        <div className="text-[10px] text-muted-foreground">
          {data.lastUpdateDate
            ? `Updated ${formatDistanceToNow(new Date(data.lastUpdateDate), { addSuffix: true })}`
            : "No recent changes"}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Categorized Jurisdictions Container                                 */
/* ------------------------------------------------------------------ */

const categoryConfig: Record<
  JurisdictionPriority,
  { label: string; accent: string; headerBg: string }
> = {
  active: {
    label: "Active Compliance",
    accent: "border-l-emerald-500",
    headerBg: "bg-emerald-500/10 text-emerald-400",
  },
  monitoring: {
    label: "Monitoring",
    accent: "border-l-amber-500",
    headerBg: "bg-amber-500/10 text-amber-400",
  },
  expansion: {
    label: "Expansion Targets",
    accent: "border-l-blue-500",
    headerBg: "bg-blue-500/10 text-blue-400",
  },
};

interface CategorizedJurisdictionsProps {
  jurisdictions: JurisdictionData[];
  onChangePriority: (code: string, priority: JurisdictionPriority) => void;
  onRemove: (code: string) => void;
}

export function CategorizedJurisdictions({
  jurisdictions,
  onChangePriority,
  onRemove,
}: CategorizedJurisdictionsProps) {
  const categories: JurisdictionPriority[] = ["active", "monitoring", "expansion"];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Tracked Jurisdictions</h3>

      {jurisdictions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No jurisdictions tracked yet.
        </p>
      ) : (
        <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
          {categories.map((cat) => {
            const items = jurisdictions.filter((j) => j.priority === cat);
            if (items.length === 0) return null;
            const cfg = categoryConfig[cat];

            return (
              <div key={cat} className={cn("border-l-2 pl-3", cfg.accent)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cfg.label}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      cfg.headerBg
                    )}
                  >
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((j) => (
                    <JurisdictionCard
                      key={j.code}
                      data={j}
                      onChangePriority={onChangePriority}
                      onRemove={onRemove}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
