"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Globe,
  BookOpen,
  Bell,
  FileSearch,
  Newspaper,
  UserCog,
  Info,
  Clock,
  Gavel,
  FileText,
  RefreshCw,
  CalendarClock,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ComplianceGauge } from "@/components/dashboard/ComplianceGauge";
import { ComplianceTrend, type PostureSnapshot } from "@/components/dashboard/ComplianceTrend";
import {
  JurisdictionCommandCenter,
  type JurisdictionData,
} from "@/components/dashboard/JurisdictionCard";
import dynamic from "next/dynamic";
import { JURISDICTION_OPTIONS } from "@/lib/types/user";

const WorldMap = dynamic(() => import("@/components/dashboard/WorldMap").then((m) => m.WorldMap), {
  ssr: false,
  loading: () => (
    <div className="hidden md:block rounded-lg border border-border bg-[#0b0f15] h-[340px] animate-pulse" />
  ),
});
import { AlertsFeed, type ComplianceAlert, type WeeklyDigest } from "@/components/dashboard/AlertsFeed";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";
import type { UserProfile, JurisdictionPriority } from "@/lib/types/user";
import type { VelocityMap } from "@/lib/utils/velocity";
import { formatCurrency } from "@/lib/utils/cost-estimator";
import type { QuickStats, JurisdictionExtra, CostExposure } from "./page";

interface DashboardClientProps {
  profile: UserProfile;
  snapshots: PostureSnapshot[];
  alerts: ComplianceAlert[];
  digest: WeeklyDigest | null;
  regCounts: Record<string, number>;
  trackedRegCount: number;
  unreadCount: number;
  velocityScores: VelocityMap;
  quickStats: QuickStats;
  jurisdictionExtras: Record<string, JurisdictionExtra>;
  attentionCount: number;
  costExposure: CostExposure;
  recentUpdateJurisdictions: string[];
  allRegCounts: Record<string, number>;
}

export function DashboardClient({
  profile,
  snapshots,
  alerts,
  digest,
  regCounts,
  trackedRegCount,
  unreadCount,
  velocityScores,
  quickStats,
  jurisdictionExtras,
  attentionCount,
  costExposure,
  recentUpdateJurisdictions,
  allRegCounts,
}: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const showTestDigest = searchParams.get("test") === "true" || process.env.NODE_ENV === "development";

  const latestSnapshot = snapshots[0];
  const overallScore = latestSnapshot?.overall_score ?? 65;

  const jurisdictionScores: Record<string, number> =
    latestSnapshot?.jurisdiction_scores
      ? (typeof latestSnapshot.jurisdiction_scores === "string"
          ? JSON.parse(latestSnapshot.jurisdiction_scores)
          : latestSnapshot.jurisdiction_scores)
      : {};

  const priorities: Record<string, JurisdictionPriority> =
    profile.jurisdiction_priorities ?? {};

  const jurisdictionData: JurisdictionData[] = profile.jurisdictions.map((code) => {
    const score = jurisdictionScores[code] ?? 60;
    const regCount = regCounts[code] ?? 0;
    const velocity: "high" | "medium" | "low" = velocityScores[code]?.level ?? "low";
    const velocityScore = velocityScores[code]?.score ?? 0;
    const status: "compliant" | "at_risk" | "non_compliant" =
      score > 70 ? "compliant" : score > 40 ? "at_risk" : "non_compliant";
    const priority: JurisdictionPriority = priorities[code] ?? "active";
    const extra = jurisdictionExtras[code];
    return {
      code,
      score,
      regulationCount: regCount,
      velocity,
      velocityScore,
      status,
      priority,
      auditCoverage: extra?.auditCoverage ?? 0,
      lastUpdateDate: extra?.lastUpdateDate ?? null,
    };
  });

  const handleChangePriority = useCallback(
    async (code: string, newPriority: JurisdictionPriority) => {
      const updated = { ...priorities, [code]: newPriority };
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jurisdiction_priorities: updated }),
      });
      router.refresh();
    },
    [priorities, router]
  );

  const handleRemoveJurisdiction = useCallback(
    async (code: string) => {
      const newJurisdictions = profile.jurisdictions.filter((j) => j !== code);
      const newPriorities = { ...priorities };
      delete newPriorities[code];
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jurisdictions: newJurisdictions,
          jurisdiction_priorities: newPriorities,
        }),
      });
      router.refresh();
    },
    [profile.jurisdictions, priorities, router]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-4">
      {/* ============================================================= */}
      {/* 1. Compliance Overview Bar                                     */}
      {/* ============================================================= */}
      <div className="relative rounded-xl border border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-card to-card" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative shrink-0">
              <ComplianceGauge score={overallScore} size="lg" label="Overall Score" />
              <ScoreInfoButton />
            </div>
            <div className="flex-1 w-full space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
                <StatCard icon={Globe} label="Jurisdictions" value={profile.jurisdictions.length} accent="blue" />
                <StatCard icon={BookOpen} label="Regulations" value={trackedRegCount} accent="purple" />
                <StatCard
                  icon={Bell}
                  label="Unread Alerts"
                  value={unreadCount}
                  accent={unreadCount > 0 ? "red" : "muted"}
                />
                <StatCard
                  icon={Clock}
                  label="Last Updated"
                  displayValue={
                    quickStats.lastDataDate
                      ? format(new Date(quickStats.lastDataDate), "MMM d")
                      : latestSnapshot
                        ? format(new Date(latestSnapshot.snapshot_date), "MMM d")
                        : "\u2014"
                  }
                  accent="green"
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tracking{" "}
                <span className="font-semibold text-foreground">{trackedRegCount}</span>{" "}
                regulation{trackedRegCount !== 1 ? "s" : ""} across{" "}
                <span className="font-semibold text-foreground">
                  {profile.jurisdictions.length}
                </span>{" "}
                jurisdiction{profile.jurisdictions.length !== 1 ? "s" : ""}.
                {attentionCount > 0 ? (
                  <>
                    {" "}
                    <span className="font-semibold text-amber-500">{attentionCount}</span> require
                    attention.
                  </>
                ) : (
                  " All systems nominal."
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 2. Quick Stats Pills                                           */}
      {/* ============================================================= */}
      <div className="flex flex-wrap gap-2">
        <StatPill icon={Gavel} label={`${quickStats.enactedCount} enacted`} color="text-emerald-500" />
        <StatPill icon={FileText} label={`${quickStats.proposedCount} proposed`} color="text-amber-500" />
        <StatPill
          icon={RefreshCw}
          label={`${quickStats.updatedThisMonth} updated this month`}
          color="text-blue-500"
        />
        <StatPill
          icon={CalendarClock}
          label={
            quickStats.nextDeadline
              ? `Next deadline: ${format(new Date(quickStats.nextDeadline), "MMM d, yyyy")}`
              : "No upcoming deadlines"
          }
          color={quickStats.nextDeadline ? "text-red-500" : "text-muted-foreground"}
        />
        {costExposure.total > 0 && (
          <StatPill
            icon={DollarSign}
            label={`${formatCurrency(costExposure.total)} max exposure across ${costExposure.jurisdictionsWithPenalties} jurisdiction${costExposure.jurisdictionsWithPenalties !== 1 ? "s" : ""}`}
            color="text-red-500"
          />
        )}
      </div>

      {/* ============================================================= */}
      {/* 3. World Map — full width, hidden on mobile                    */}
      {/* ============================================================= */}
      <WorldMap
        jurisdictions={(() => {
          const allCodes = [
            "EU", "GB", "US", "US-TX", "US-CO", "US-CA", "US-IL",
            "US-CT", "US-UT", "US-TN", "US-NYC", "US-MD",
            "CA", "BR", "SG", "ID", "KR", "JP", "CN", "AU", "IN",
            "SA", "ZA", "INTL",
          ];
          const trackedSet = new Set(profile.jurisdictions);
          const recentSet = new Set(recentUpdateJurisdictions);
          return allCodes.map((code) => {
            const jOpt = JURISDICTION_OPTIONS.find((j) => j.code === code);
            return {
              code,
              name: jOpt?.name ?? code,
              regulationCount: allRegCounts[code] ?? 0,
              velocityLevel: velocityScores[code]?.level ?? "low",
              velocityScore: velocityScores[code]?.score ?? 0,
              isTracked: trackedSet.has(code),
              hasRecentUpdate: recentSet.has(code),
              complianceStatus: trackedSet.has(code)
                ? (jurisdictionData.find((j) => j.code === code)?.status ?? "unknown").replace("_", " ")
                : "not tracked",
            };
          });
        })()}
      />

      {/* ============================================================= */}
      {/* 4. Compliance Trend — full width                               */}
      {/* ============================================================= */}
      <div className="rounded-lg border border-border bg-card p-4">
        <ComplianceTrend snapshots={snapshots} />
      </div>

      {/* ============================================================= */}
      {/* 4. Jurisdiction Command Center — full width 3-col kanban       */}
      {/* ============================================================= */}
      <JurisdictionCommandCenter
        jurisdictions={jurisdictionData}
        onChangePriority={handleChangePriority}
        onRemove={handleRemoveJurisdiction}
      />

      {/* ============================================================= */}
      {/* 5. Activity Feed — full width                                  */}
      {/* ============================================================= */}
      <div className="rounded-lg border border-border bg-card p-4">
        <AlertsFeed
          alerts={alerts}
          digest={digest}
          onAlertUpdate={() => router.refresh()}
          showTestDigest={showTestDigest}
        />
      </div>

      {/* ============================================================= */}
      {/* 6. Quick Actions                                               */}
      {/* ============================================================= */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap gap-2.5 justify-center sm:justify-start">
          <Button variant="outline" size="sm" asChild>
            <a href="/audit">
              <FileSearch className="mr-1.5 h-3.5 w-3.5" />
              Run Audit
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/feed">
              <Newspaper className="mr-1.5 h-3.5 w-3.5" />
              Regulations
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setProfileEditorOpen(true)}>
            <UserCog className="mr-1.5 h-3.5 w-3.5" />
            Edit Profile
          </Button>
        </div>
      </div>

      <ProfileEditor
        profile={profile}
        open={profileEditorOpen}
        onOpenChange={setProfileEditorOpen}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat Card                                                           */
/* ------------------------------------------------------------------ */

const accentStyles = {
  blue: { border: "border-l-blue-500", icon: "text-blue-500 bg-blue-500/10", value: "text-foreground" },
  purple: { border: "border-l-purple-500", icon: "text-purple-500 bg-purple-500/10", value: "text-foreground" },
  red: { border: "border-l-red-500", icon: "text-red-500 bg-red-500/10", value: "text-red-500" },
  green: { border: "border-l-emerald-500", icon: "text-emerald-500 bg-emerald-500/10", value: "text-foreground" },
  muted: { border: "border-l-muted-foreground/30", icon: "text-muted-foreground bg-muted", value: "text-muted-foreground" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  displayValue,
  accent = "muted",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  displayValue?: string;
  accent?: keyof typeof accentStyles;
}) {
  const s = accentStyles[accent];
  return (
    <div className={cn("flex items-center gap-2.5 rounded-lg border border-border border-l-[3px] bg-card/50 px-2.5 py-2", s.border)}>
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", s.icon)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className={cn("text-base font-bold leading-tight tabular-nums", s.value)}>
          {displayValue ?? value}
        </div>
        <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat Pill                                                           */
/* ------------------------------------------------------------------ */

function StatPill({
  icon: Icon,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 text-[11px]">
      <Icon className={cn("h-3 w-3", color)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Score Info Popover                                                   */
/* ------------------------------------------------------------------ */

function ScoreInfoButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute -top-1 -right-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Score info"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-50 w-56 rounded-md border border-border bg-popover p-2.5 shadow-lg text-[11px] text-popover-foreground">
            <p className="font-medium mb-1">How is this calculated?</p>
            <p className="text-muted-foreground leading-relaxed">
              Based on regulation coverage, audit findings, and enacted regulation
              ratio across your tracked jurisdictions. Updates daily.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
