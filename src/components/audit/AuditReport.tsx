"use client";

import { useState, useMemo } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Database,
  ChevronDown,
  Lightbulb,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FindingCard } from "./FindingCard";
import { CostAnalysis } from "./CostAnalysis";
import { formatDistanceToNow } from "date-fns";
import type {
  AuditReport as AuditReportType,
  AuditFinding,
} from "@/lib/types/audit";

const riskLevelConfig = {
  critical: {
    icon: ShieldAlert,
    color: "text-red-400",
    ringColor: "stroke-red-400",
    bgColor: "bg-red-500/10",
  },
  high: {
    icon: AlertTriangle,
    color: "text-orange-400",
    ringColor: "stroke-orange-400",
    bgColor: "bg-orange-500/10",
  },
  medium: {
    icon: Shield,
    color: "text-yellow-400",
    ringColor: "stroke-yellow-400",
    bgColor: "bg-yellow-500/10",
  },
  low: {
    icon: ShieldCheck,
    color: "text-green-400",
    ringColor: "stroke-green-400",
    bgColor: "bg-green-500/10",
  },
};

const jurisdictionStatusConfig: Record<string, string> = {
  compliant: "bg-green-500/15 text-green-400 border-green-500/30",
  at_risk: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  non_compliant: "bg-red-500/15 text-red-400 border-red-500/30",
  review_needed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const severityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const severityColors: Record<string, { text: string; bg: string }> = {
  critical: { text: "text-red-400", bg: "bg-red-500/15 border-red-500/30" },
  high: {
    text: "text-orange-400",
    bg: "bg-orange-500/15 border-orange-500/30",
  },
  medium: {
    text: "text-yellow-400",
    bg: "bg-yellow-500/15 border-yellow-500/30",
  },
  low: { text: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  info: { text: "text-muted-foreground", bg: "bg-muted border-border" },
};

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low" | "info";

export function AuditReportDisplay({
  report,
}: {
  report: AuditReportType;
}) {
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(
    new Set()
  );
  const [collapsedJurisdictions, setCollapsedJurisdictions] = useState<
    Set<string>
  >(new Set());
  const [activeTab, setActiveTab] = useState<"findings" | "recommendations" | "costs">(
    "findings"
  );
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("all");
  const [copied, setCopied] = useState(false);

  const riskConfig = riskLevelConfig[report.risk_level];
  const RiskIcon = riskConfig.icon;

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    for (const f of report.findings) {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    }
    return counts;
  }, [report.findings]);

  // Group findings by jurisdiction, sorted by severity within each group
  const findingsByJurisdiction = useMemo(() => {
    const groups: Record<string, AuditFinding[]> = {};
    for (const f of report.findings) {
      if (severityFilter !== "all" && f.severity !== severityFilter) continue;
      const key = f.jurisdiction;
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    // Sort findings within each group by severity
    for (const key of Object.keys(groups)) {
      groups[key].sort(
        (a, b) =>
          (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5)
      );
    }
    return groups;
  }, [report.findings, severityFilter]);

  const toggleFinding = (id: string) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleJurisdiction = (jurisdiction: string) => {
    setCollapsedJurisdictions((prev) => {
      const next = new Set(prev);
      if (next.has(jurisdiction)) next.delete(jurisdiction);
      else next.add(jurisdiction);
      return next;
    });
  };

  const copyReport = () => {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Build a lookup from jurisdiction code -> jurisdiction result
  const jurisdictionResultMap = useMemo(() => {
    const map: Record<string, (typeof report.jurisdiction_results)[number]> =
      {};
    for (const jr of report.jurisdiction_results) {
      map[jr.jurisdiction] = jr;
    }
    return map;
  }, [report.jurisdiction_results]);

  // Determine jurisdiction display order: sort by worst compliance score first
  const jurisdictionOrder = useMemo(() => {
    return Object.keys(findingsByJurisdiction).sort((a, b) => {
      const aScore = jurisdictionResultMap[a]?.compliance_score ?? 100;
      const bScore = jurisdictionResultMap[b]?.compliance_score ?? 100;
      return aScore - bScore;
    });
  }, [findingsByJurisdiction, jurisdictionResultMap]);

  const filteredFindingsCount = Object.values(findingsByJurisdiction).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card className={riskConfig.bgColor}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            {/* Risk Score Ring */}
            <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0">
              <svg className="h-20 w-20 sm:h-24 sm:w-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  className="text-muted/30"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  className={riskConfig.ringColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(report.overall_risk_score / 100) * 264} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${riskConfig.color}`}>
                  {report.overall_risk_score}
                </span>
                <span className="text-[10px] text-muted-foreground">RISK</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <RiskIcon className={`h-5 w-5 ${riskConfig.color}`} />
                <Badge
                  variant="outline"
                  className={`${riskConfig.color} border-current`}
                >
                  {report.risk_level.toUpperCase()} RISK
                </Badge>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{report.findings.length} findings</span>
                <span>
                  {report.jurisdiction_results.length} jurisdictions
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {report.regulations_checked} regulations checked
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Data freshness:{" "}
                  {formatDistanceToNow(new Date(report.data_freshness), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Findings | Recommendations */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("findings")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "findings"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Findings ({report.findings.length})
        </button>
        <button
          onClick={() => setActiveTab("costs")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "costs"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-xs">$</span>
          Cost Analysis
        </button>
        <button
          onClick={() => setActiveTab("recommendations")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "recommendations"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          Recommendations ({report.recommendations.length})
        </button>
      </div>

      {/* Findings Tab */}
      {activeTab === "findings" && (
        <div className="space-y-4">
          {/* Severity Filter Bar */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={() =>
                setSeverityFilter(severityFilter === "all" ? "all" : "all")
              }
              className={`px-2.5 py-1.5 sm:py-1 rounded-md text-xs font-medium border transition-colors min-h-[36px] sm:min-h-0 ${
                severityFilter === "all"
                  ? "bg-accent text-accent-foreground border-border"
                  : "text-muted-foreground border-transparent hover:border-border"
              }`}
            >
              All ({report.findings.length})
            </button>
            {(
              ["critical", "high", "medium", "low", "info"] as const
            ).map((sev) =>
              severityCounts[sev] > 0 ? (
                <button
                  key={sev}
                  onClick={() =>
                    setSeverityFilter(
                      severityFilter === sev ? "all" : sev
                    )
                  }
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    severityFilter === sev
                      ? `${severityColors[sev].bg} ${severityColors[sev].text}`
                      : `${severityColors[sev].text} border-transparent hover:border-border`
                  }`}
                >
                  {severityCounts[sev]} {sev}
                </button>
              ) : null
            )}
            {severityFilter !== "all" && (
              <span className="text-[11px] text-muted-foreground ml-1">
                Showing {filteredFindingsCount} of {report.findings.length}
              </span>
            )}
          </div>

          {/* Jurisdiction Sections */}
          {jurisdictionOrder.map((jurisdiction) => {
            const findings = findingsByJurisdiction[jurisdiction];
            if (!findings || findings.length === 0) return null;

            const jr = jurisdictionResultMap[jurisdiction];
            const isCollapsed = collapsedJurisdictions.has(jurisdiction);
            const displayName =
              jr?.jurisdiction_display || jurisdiction;
            const complianceScore = jr?.compliance_score ?? null;
            const status = jr?.status;

            return (
              <div
                key={jurisdiction}
                className="border border-border rounded-lg overflow-hidden"
              >
                {/* Jurisdiction Header */}
                <button
                  onClick={() => toggleJurisdiction(jurisdiction)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                    <span className="text-sm font-semibold">
                      {displayName}
                    </span>
                    {status && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${jurisdictionStatusConfig[status] || ""}`}
                      >
                        {status.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {complianceScore !== null && (
                      <span>
                        Compliance:{" "}
                        <span
                          className={
                            complianceScore >= 80
                              ? "text-green-400"
                              : complianceScore >= 50
                                ? "text-yellow-400"
                                : "text-red-400"
                          }
                        >
                          {complianceScore}%
                        </span>
                      </span>
                    )}
                    <span>{findings.length} findings</span>
                  </div>
                </button>

                {/* Findings within jurisdiction */}
                {!isCollapsed && (
                  <div className="p-3 space-y-2">
                    {findings.map((finding) => (
                      <FindingCard
                        key={finding.id}
                        finding={finding}
                        isExpanded={expandedFindings.has(finding.id)}
                        onToggle={() => toggleFinding(finding.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {filteredFindingsCount === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No findings match the selected filter.
            </div>
          )}
        </div>
      )}

      {/* Cost Analysis Tab */}
      {activeTab === "costs" && (
        <CostAnalysis findings={report.findings} />
      )}

      {/* Recommendations Tab */}
      {activeTab === "recommendations" && (
        <div className="space-y-3">
          {report.recommendations.map((rec, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-3">
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground leading-relaxed pt-0.5">
                    {rec}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      {/* Export */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={copyReport}>
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy Report as JSON
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
