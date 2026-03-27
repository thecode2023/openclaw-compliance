"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Shield,
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
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ComplianceGauge } from "@/components/dashboard/ComplianceGauge";
import { ComplianceTrend, type PostureSnapshot } from "@/components/dashboard/ComplianceTrend";
import {
  CategorizedJurisdictions,
  type JurisdictionData,
} from "@/components/dashboard/JurisdictionCard";
import { AlertsFeed, type ComplianceAlert, type WeeklyDigest } from "@/components/dashboard/AlertsFeed";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";
import { JURISDICTION_OPTIONS } from "@/lib/types/user";
import type { UserProfile, JurisdictionPriority } from "@/lib/types/user";
import type { VelocityMap } from "@/lib/utils/velocity";
import type { QuickStats, JurisdictionExtra } from "./page";

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
}: DashboardClientProps) {
  const router = useRouter();
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  // Derive overall score from latest snapshot, or a default
  const latestSnapshot = snapshots[0];
  const overallScore = latestSnapshot?.overall_score ?? 65;

  // Build jurisdiction data from profile
  const jurisdictionScores: Record<string, number> =
    latestSnapshot?.jurisdiction_scores
      ? (typeof latestSnapshot.jurisdiction_scores === "string"
          ? JSON.parse(latestSnapshot.jurisdiction_scores)
          : latestSnapshot.jurisdiction_scores)
      : {};

  // Resolve priorities — default to "active" if not set
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

  // Persist priority changes
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

  function handleAlertUpdate() {
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      {/* ============================================================= */}
      {/* Overview Bar — gradient background                             */}
      {/* ============================================================= */}
      <div className="relative rounded-xl border border-border overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-card to-card" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <ComplianceGauge score={overallScore} size="lg" label="Overall Score" />
              <ScoreInfoButton />
            </div>

            <div className="flex-1 w-full space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                <StatCard
                  icon={Globe}
                  label="Jurisdictions"
                  value={profile.jurisdictions.length}
                  accent="blue"
                />
                <StatCard
                  icon={BookOpen}
                  label="Regulations"
                  value={trackedRegCount}
                  accent="purple"
                />
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
                    latestSnapshot
                      ? format(new Date(latestSnapshot.snapshot_date), "MMM d, yyyy")
                      : "\u2014"
                  }
                  accent="green"
                />
              </div>

              {/* Compliance snapshot sentence */}
              <p className="text-xs text-muted-foreground leading-relaxed pl-0.5">
                You are tracking{" "}
                <span className="font-semibold text-foreground">{trackedRegCount}</span>{" "}
                regulation{trackedRegCount !== 1 ? "s" : ""} across{" "}
                <span className="font-semibold text-foreground">
                  {profile.jurisdictions.length}
                </span>{" "}
                jurisdiction{profile.jurisdictions.length !== 1 ? "s" : ""}.
                {attentionCount > 0 ? (
                  <>
                    {" "}
                    <span className="font-semibold text-amber-500">
                      {attentionCount}
                    </span>{" "}
                    require attention.
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
      {/* Quick Stats Pills                                              */}
      {/* ============================================================= */}
      <div className="flex flex-wrap gap-2">
        <StatPill
          icon={Gavel}
          label={`${quickStats.enactedCount} enacted`}
          color="text-emerald-500"
        />
        <StatPill
          icon={FileText}
          label={`${quickStats.proposedCount} proposed`}
          color="text-amber-500"
        />
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
      </div>

      {/* ============================================================= */}
      {/* Main Grid                                                      */}
      {/* ============================================================= */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Column 1: Compliance Trend */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5 md:col-span-2 lg:col-span-1">
          <ComplianceTrend snapshots={snapshots} />
        </div>

        {/* Column 2: Categorized Jurisdiction Cards */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <CategorizedJurisdictions
            jurisdictions={jurisdictionData}
            onChangePriority={handleChangePriority}
            onRemove={handleRemoveJurisdiction}
          />
        </div>

        {/* Column 3: Activity Feed */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5 md:col-span-2 lg:col-span-1">
          <AlertsFeed
            alerts={alerts}
            digest={digest}
            onAlertUpdate={handleAlertUpdate}
          />
        </div>
      </div>

      {/* ============================================================= */}
      {/* Quick Actions Bar                                              */}
      {/* ============================================================= */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
          <Button variant="outline" asChild>
            <a href="/audit">
              <FileSearch className="mr-2 h-4 w-4" />
              Run New Audit
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/feed">
              <Newspaper className="mr-2 h-4 w-4" />
              Browse Regulations
            </a>
          </Button>
          <Button variant="outline" onClick={() => setProfileEditorOpen(true)}>
            <UserCog className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Profile Editor Sheet */}
      <ProfileEditor
        profile={profile}
        open={profileEditorOpen}
        onOpenChange={setProfileEditorOpen}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat Card (overview bar)                                            */
/* ------------------------------------------------------------------ */

const accentStyles = {
  blue: {
    border: "border-l-blue-500",
    icon: "text-blue-500 bg-blue-500/10",
    value: "text-foreground",
  },
  purple: {
    border: "border-l-purple-500",
    icon: "text-purple-500 bg-purple-500/10",
    value: "text-foreground",
  },
  red: {
    border: "border-l-red-500",
    icon: "text-red-500 bg-red-500/10",
    value: "text-red-500",
  },
  green: {
    border: "border-l-emerald-500",
    icon: "text-emerald-500 bg-emerald-500/10",
    value: "text-foreground",
  },
  muted: {
    border: "border-l-muted-foreground/30",
    icon: "text-muted-foreground bg-muted",
    value: "text-muted-foreground",
  },
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
  const style = accentStyles[accent];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border border-l-[3px] bg-card/50 p-3 transition-colors",
        style.border
      )}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", style.icon)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className={cn("text-lg font-bold leading-tight", style.value)}>
          {displayValue ?? value}
        </div>
        <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quick Stat Pill                                                     */
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
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs">
      <Icon className={cn("h-3 w-3", color)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Score Info Button                                                    */
/* ------------------------------------------------------------------ */

function ScoreInfoButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute -top-1 -right-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="How is this score calculated?"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg text-xs text-popover-foreground">
            <p className="font-medium mb-1">How is this calculated?</p>
            <p className="text-muted-foreground leading-relaxed">
              Your compliance score is based on regulation coverage across your
              tracked jurisdictions, findings from your most recent audit, and the
              ratio of enacted regulations you&apos;re subject to. It updates daily.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
