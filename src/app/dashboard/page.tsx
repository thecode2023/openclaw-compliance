import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";
import { computeVelocityScores } from "@/lib/utils/velocity";
import { estimateMaxExposure } from "@/lib/utils/cost-estimator";
import { computeCoverage } from "@/lib/utils/policy-coverage";
import type { ActionItem } from "@/components/dashboard/ActionItems";
import type { PolicyDocument } from "@/lib/types/policy";

export interface QuickStats {
  enactedCount: number;
  proposedCount: number;
  updatedThisMonth: number;
  nextDeadline: string | null;
  lastDataDate: string | null;
}

export interface CostExposure {
  total: number;
  jurisdictionsWithPenalties: number;
  hasCriminal: boolean;
}

export interface JurisdictionExtra {
  auditCoverage: number; // 0-100
  lastUpdateDate: string | null;
}

export default async function DashboardPage() {
  const supabase = await createServerComponentClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Check onboarding
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.onboarded) {
    redirect("/dashboard/onboarding");
  }

  // Fetch posture snapshots (last 30 days)
  let { data: snapshots } = await supabase
    .from("posture_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("snapshot_date", { ascending: false })
    .limit(30);

  // Fetch alerts (most recent 50, not dismissed)
  const { data: alerts } = await supabase
    .from("compliance_alerts")
    .select("*")
    .eq("user_id", user.id)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch latest digest
  const { data: digests } = await supabase
    .from("weekly_digests")
    .select("*")
    .eq("user_id", user.id)
    .order("period_end", { ascending: false })
    .limit(1);

  // Fetch all regulations with status, jurisdiction, effective_date, last_verified_at
  const { data: regulations } = await supabase
    .from("regulations")
    .select("id, title, jurisdiction, jurisdiction_display, status, effective_date, last_verified_at");

  // Count unread alerts
  const { count: unreadCount } = await supabase
    .from("compliance_alerts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false)
    .eq("dismissed", false);

  const userJurisdictions = new Set(profile.jurisdictions as string[]);
  const allRegs = regulations ?? [];
  const trackedRegs = allRegs.filter((r) => userJurisdictions.has(r.jurisdiction));

  // Build jurisdiction regulation counts
  const regCounts: Record<string, number> = {};
  allRegs.forEach((r) => {
    regCounts[r.jurisdiction] = (regCounts[r.jurisdiction] || 0) + 1;
  });

  const trackedRegCount = trackedRegs.length;

  // Quick stats
  const enactedCount = trackedRegs.filter(
    (r) => r.status === "enacted" || r.status === "in_effect"
  ).length;
  const proposedCount = trackedRegs.filter((r) => r.status === "proposed").length;

  // Updated this month: regulatory_updates in last 30 days for user's jurisdictions
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentUpdates } = await supabase
    .from("regulatory_updates")
    .select("id, regulation_id, detected_at")
    .gte("detected_at", thirtyDaysAgo.toISOString());

  // Map regulation_id -> jurisdiction
  const regIdToJurisdiction: Record<string, string> = {};
  allRegs.forEach((r) => {
    regIdToJurisdiction[r.id] = r.jurisdiction;
  });

  const userRecentUpdates = (recentUpdates ?? []).filter((u) => {
    const j = regIdToJurisdiction[u.regulation_id];
    return j && userJurisdictions.has(j);
  });

  // Next deadline: earliest future effective_date in user jurisdictions
  const now = new Date();
  const futureDeadlines = trackedRegs
    .filter((r) => r.effective_date && new Date(r.effective_date) > now)
    .map((r) => r.effective_date as string)
    .sort();
  const nextDeadline = futureDeadlines[0] ?? null;

  // Most recent last_verified_at from regulations as fallback date
  const lastVerifiedDates = allRegs
    .filter((r) => r.last_verified_at)
    .map((r) => r.last_verified_at as string)
    .sort()
    .reverse();
  const lastDataDate = lastVerifiedDates[0] ?? null;

  const quickStats: QuickStats = {
    enactedCount,
    proposedCount,
    updatedThisMonth: userRecentUpdates.length,
    nextDeadline,
    lastDataDate,
  };

  // Auto-generate initial posture snapshot if none exist
  if (!snapshots || snapshots.length === 0) {
    const jScores: Record<string, number> = {};
    for (const code of profile.jurisdictions as string[]) {
      const totalInJ = regCounts[code] ?? 0;
      const enactedInJ = allRegs.filter(
        (r) => r.jurisdiction === code && (r.status === "enacted" || r.status === "in_effect")
      ).length;
      jScores[code] = totalInJ > 0 ? Math.round((enactedInJ / totalInJ) * 80 + 20) : 60;
    }
    const avgScore = Object.values(jScores).length > 0
      ? Math.round(Object.values(jScores).reduce((a, b) => a + b, 0) / Object.values(jScores).length)
      : 65;

    await supabase.from("posture_snapshots").upsert({
      user_id: user.id,
      overall_score: avgScore,
      jurisdiction_scores: jScores,
      active_regulations: trackedRegCount,
      open_findings: 0,
      snapshot_date: new Date().toISOString().split("T")[0],
    }, { onConflict: "user_id,snapshot_date" });

    // Re-fetch so the UI has the data
    const { data: freshSnapshots } = await supabase
      .from("posture_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: false })
      .limit(30);
    snapshots = freshSnapshots;
  }

  // Jurisdiction extra data: audit coverage + last update date
  // Audit coverage: % of regulations in jurisdiction that have been audited
  const { data: auditReports } = await supabase
    .from("audit_reports")
    .select("regulations_checked, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastAuditRegCount = auditReports?.[0]?.regulations_checked ?? 0;

  // Build per-jurisdiction last update date from recent updates
  const jurisdictionLastUpdate: Record<string, string> = {};
  (recentUpdates ?? []).forEach((u) => {
    const j = regIdToJurisdiction[u.regulation_id];
    if (!j) return;
    if (!jurisdictionLastUpdate[j] || u.detected_at > jurisdictionLastUpdate[j]) {
      jurisdictionLastUpdate[j] = u.detected_at;
    }
  });

  // Build jurisdiction extras
  const jurisdictionExtras: Record<string, JurisdictionExtra> = {};
  for (const code of profile.jurisdictions as string[]) {
    const totalRegsInJ = regCounts[code] ?? 0;
    // Simple heuristic: if user has run an audit, coverage is proportional
    const coverage = totalRegsInJ > 0 && lastAuditRegCount > 0
      ? Math.min(100, Math.round((lastAuditRegCount / totalRegsInJ) * 100))
      : 0;
    jurisdictionExtras[code] = {
      auditCoverage: coverage,
      lastUpdateDate: jurisdictionLastUpdate[code] ?? null,
    };
  }

  // Compute velocity scores
  const velocityScores = await computeVelocityScores(supabase);

  // Cost exposure
  const costExposure = estimateMaxExposure(profile.jurisdictions as string[]);

  // Which jurisdictions had updates in last 7 days (for map pulse)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentUpdateJurisdictions = new Set<string>();
  (recentUpdates ?? []).forEach((u) => {
    const j = regIdToJurisdiction[u.regulation_id];
    if (j && new Date(u.detected_at) >= sevenDaysAgo) {
      recentUpdateJurisdictions.add(j);
    }
  });

  // Count pending regulations awaiting review
  const { count: pendingCount } = await supabase
    .from("pending_regulations")
    .select("*", { count: "exact", head: true })
    .in("review_status", ["pending", "uncertain"]);

  // Count requiring attention: jurisdictions with velocity high or score < 50
  const attentionCount = trackedRegs.filter(
    (r) =>
      (velocityScores[r.jurisdiction]?.level === "high") ||
      r.status === "proposed"
  ).length;

  // Compute deadlines for tracked regulations
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() - 30);
  const deadlineRegs = allRegs.filter(
    (r) =>
      r.effective_date &&
      new Date(r.effective_date) > thirtyDaysFromNow &&
      userJurisdictions.has(r.jurisdiction)
  );

  // Check if user has policies and audits for readiness
  const { data: userPolicies } = await supabase
    .from("policy_documents")
    .select("*")
    .eq("user_id", user.id);
  const policyRegIds = new Set((userPolicies || []).map((p: { regulation_id: string | null }) => p.regulation_id).filter(Boolean));
  const hasAudit = (auditReports?.length || 0) > 0;

  const deadlines = deadlineRegs
    .map((r) => {
      const daysRemaining = Math.ceil(
        (new Date(r.effective_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      let readiness = 20; // Base: tracked
      if (policyRegIds.has(r.id)) readiness += 40;
      if (hasAudit) readiness += 30;
      // Check for critical findings in this jurisdiction
      const hasCritical = (alerts ?? []).some(
        (a: { severity?: string; jurisdiction?: string }) =>
          a.jurisdiction === r.jurisdiction && (a.severity === "critical" || a.severity === "high")
      );
      if (!hasCritical) readiness += 10;
      return {
        regulation_id: r.id,
        title: (r as { title?: string }).title || "Unknown",
        jurisdiction_display: (r as { jurisdiction_display?: string }).jurisdiction_display || r.jurisdiction,
        effective_date: r.effective_date!,
        days_remaining: daysRemaining,
        readiness: Math.min(readiness, 100),
      };
    })
    .sort((a, b) => a.days_remaining - b.days_remaining)
    .slice(0, 10);

  // Compute policy coverage
  const allRegsFull = allRegs.map((r) => ({
    id: r.id,
    title: (r as { title?: string }).title || "",
    jurisdiction: r.jurisdiction,
    jurisdiction_display: (r as { jurisdiction_display?: string }).jurisdiction_display || r.jurisdiction,
  }));
  const coverage = computeCoverage(
    allRegsFull,
    (userPolicies || []) as PolicyDocument[],
    profile.jurisdictions as string[]
  );

  // Compute action items
  const actionItems: ActionItem[] = [];

  // 1. Upcoming deadlines with low readiness
  for (const dl of deadlines.filter((d) => d.days_remaining > 0 && d.days_remaining < 90 && d.readiness < 50)) {
    actionItems.push({
      id: `deadline-${dl.regulation_id}`,
      priority: dl.days_remaining < 30 ? "urgent" : "high",
      title: `${dl.title} takes effect in ${dl.days_remaining} days`,
      description: `Readiness: ${dl.readiness}%. Review compliance before the deadline.`,
      action_url: "/feed",
      action_label: "View Regulation",
      category: "deadline",
    });
  }

  // 2. Unread critical/high alerts
  const criticalAlerts = (alerts ?? []).filter(
    (a: { read: boolean; severity: string }) => !a.read && (a.severity === "critical" || a.severity === "high")
  );
  if (criticalAlerts.length > 0) {
    actionItems.push({
      id: "alerts-critical",
      priority: "urgent",
      title: `${criticalAlerts.length} critical alert${criticalAlerts.length > 1 ? "s" : ""} need attention`,
      description: "New enforcement actions or regulatory changes detected.",
      action_url: "/dashboard",
      action_label: "Review Alerts",
      category: "alert",
    });
  }

  // 3. Draft policies older than 7 days
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const staleDrafts = (userPolicies || []).filter(
    (p: { status?: string; updated_at?: string }) =>
      p.status === "draft" && p.updated_at && new Date(p.updated_at).getTime() < sevenDaysAgoMs
  );
  if (staleDrafts.length > 0) {
    actionItems.push({
      id: "stale-drafts",
      priority: "high",
      title: `${staleDrafts.length} draft polic${staleDrafts.length > 1 ? "ies" : "y"} awaiting review`,
      description: "Move draft policies to review or approved status.",
      action_url: "/policies",
      action_label: "Review Policies",
      category: "policy",
    });
  }

  // 4. Policy coverage below 50%
  if (coverage.percentage < 50 && coverage.total > 0) {
    actionItems.push({
      id: "coverage-gap",
      priority: "high",
      title: `Policy coverage is only ${coverage.percentage}%`,
      description: `${coverage.total - coverage.covered} of ${coverage.total} tracked regulations lack policies.`,
      action_url: "/policies?tab=coverage",
      action_label: "View Gaps",
      category: "coverage",
    });
  }

  // 5. Compliance score drop
  if (snapshots && snapshots.length >= 2) {
    const latest = snapshots[0]?.overall_score ?? 0;
    const previous = snapshots[1]?.overall_score ?? 0;
    if (latest < previous - 5) {
      actionItems.push({
        id: "score-drop",
        priority: "medium",
        title: `Compliance score dropped ${previous - latest} points`,
        description: `Score went from ${previous} to ${latest}. Check recent regulatory changes.`,
        action_url: "/dashboard",
        action_label: "View Details",
        category: "score",
      });
    }
  }

  // 6. Unread digest
  const latestDigest = digests?.[0];
  if (latestDigest && !latestDigest.read) {
    actionItems.push({
      id: "unread-digest",
      priority: "medium",
      title: "Weekly regulatory briefing is ready",
      description: "Review what changed across your tracked jurisdictions.",
      action_url: "/dashboard",
      action_label: "Read Digest",
      category: "digest",
    });
  }

  // 7. Stale audit (>30 days)
  if (auditReports && auditReports.length > 0) {
    const lastAuditDate = auditReports[0]?.created_at;
    if (lastAuditDate && Date.now() - new Date(lastAuditDate).getTime() > 30 * 24 * 60 * 60 * 1000) {
      actionItems.push({
        id: "stale-audit",
        priority: "low",
        title: "Audit may be outdated",
        description: "Regulations may have changed since your last audit. Consider re-running.",
        action_url: "/audit",
        action_label: "Run Audit",
        category: "audit",
      });
    }
  } else {
    actionItems.push({
      id: "no-audit",
      priority: "low",
      title: "No audits run yet",
      description: "Run your first compliance audit to identify gaps.",
      action_url: "/audit",
      action_label: "Run Audit",
      category: "audit",
    });
  }

  return (
    <DashboardClient
      profile={profile}
      snapshots={snapshots ?? []}
      alerts={alerts ?? []}
      digest={digests?.[0] ?? null}
      regCounts={regCounts}
      trackedRegCount={trackedRegCount}
      unreadCount={unreadCount ?? 0}
      velocityScores={velocityScores}
      quickStats={quickStats}
      jurisdictionExtras={jurisdictionExtras}
      attentionCount={attentionCount}
      costExposure={costExposure}
      recentUpdateJurisdictions={Array.from(recentUpdateJurisdictions)}
      allRegCounts={regCounts}
      pendingCount={pendingCount ?? 0}
      deadlines={deadlines}
      actionItems={actionItems}
      coverage={coverage}
    />
  );
}
