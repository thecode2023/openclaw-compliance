"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { DollarSign, AlertTriangle, Shield, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  estimateCosts,
  formatCurrency,
  type CostEstimate,
} from "@/lib/utils/cost-estimator";
import type { AuditFinding } from "@/lib/types/audit";

interface CostAnalysisProps {
  findings: AuditFinding[];
}

const barColors = [
  "#ef4444", "#f97316", "#f59e0b", "#3b82f6", "#8b5cf6", "#06b6d4",
  "#10b981", "#ec4899", "#6366f1", "#14b8a6",
];

export function CostAnalysis({ findings }: CostAnalysisProps) {
  const [revenueInput, setRevenueInput] = useState("");
  const [appliedRevenue, setAppliedRevenue] = useState<number | null>(null);

  const estimate = useMemo(
    () => estimateCosts(findings, appliedRevenue),
    [findings, appliedRevenue]
  );

  function applyRevenue() {
    const parsed = parseFloat(revenueInput.replace(/[,$\s]/g, ""));
    if (!isNaN(parsed) && parsed > 0) {
      setAppliedRevenue(parsed);
    }
  }

  const chartData = estimate.breakdown
    .filter((b) => b.max_penalty > 0)
    .map((b) => ({
      name: b.jurisdiction_display.length > 18
        ? b.jurisdiction_display.slice(0, 16) + "…"
        : b.jurisdiction_display,
      penalty: b.max_penalty,
      remediation: b.remediation_cost,
    }));

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <CostCard
          icon={DollarSign}
          label="Total Penalty Exposure"
          value={formatCurrency(estimate.total_penalty_exposure)}
          subtext={`across ${estimate.jurisdictions_with_penalties} jurisdiction${estimate.jurisdictions_with_penalties !== 1 ? "s" : ""}`}
          accent="red"
        />
        <CostCard
          icon={TrendingDown}
          label="Est. Remediation Cost"
          value={formatCurrency(estimate.total_remediation_cost)}
          subtext={`for ${findings.length} finding${findings.length !== 1 ? "s" : ""}`}
          accent="amber"
        />
        <CostCard
          icon={Shield}
          label="Compliance ROI"
          value={
            estimate.total_penalty_exposure > 0
              ? `${Math.round(estimate.total_penalty_exposure / Math.max(1, estimate.total_remediation_cost))}x`
              : "N/A"
          }
          subtext={
            estimate.total_penalty_exposure > 0
              ? `Spend ${formatCurrency(estimate.total_remediation_cost)} to avoid ${formatCurrency(estimate.total_penalty_exposure)}`
              : "No monetary penalties in tracked jurisdictions"
          }
          accent="green"
        />
      </div>

      {/* Criminal risk warning */}
      {estimate.has_criminal_risk && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            Criminal penalties (imprisonment) may apply in some jurisdictions. Consult legal counsel.
          </span>
        </div>
      )}

      {/* Revenue input */}
      <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Enter your annual revenue for precise percentage-based penalty estimates.
        </p>
        <div className="flex gap-2">
          <Input
            value={revenueInput}
            onChange={(e) => setRevenueInput(e.target.value)}
            placeholder="e.g. 50000000"
            className="h-8 text-xs max-w-[200px]"
          />
          <Button size="sm" variant="outline" onClick={applyRevenue} className="h-8 text-xs">
            Calculate
          </Button>
          {appliedRevenue && (
            <span className="text-xs text-muted-foreground self-center">
              Using {formatCurrency(appliedRevenue)} revenue
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Penalty Exposure by Jurisdiction
          </h4>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "11px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(value) => [formatCurrency(value as number), "Max Penalty"]}
                />
                <Bar dataKey="penalty" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={barColors[i % barColors.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Per-jurisdiction breakdown table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Jurisdiction</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Max Penalty</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Remediation</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Basis</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Enforcer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {estimate.breakdown.map((b) => (
                <tr key={b.jurisdiction} className="hover:bg-accent/10">
                  <td className="px-3 py-2 font-medium">
                    {b.jurisdiction_display}
                    {b.has_criminal && (
                      <span className="ml-1 text-red-400 text-[9px]">CRIMINAL</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {b.max_penalty > 0 ? formatCurrency(b.max_penalty) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(b.remediation_cost)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">
                    {b.fine_basis}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">
                    {b.enforcement_body}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CostCard({
  icon: Icon,
  label,
  value,
  subtext,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext: string;
  accent: "red" | "amber" | "green";
}) {
  const styles = {
    red: { bg: "bg-red-500/10", icon: "text-red-500", value: "text-red-400" },
    amber: { bg: "bg-amber-500/10", icon: "text-amber-500", value: "text-amber-400" },
    green: { bg: "bg-emerald-500/10", icon: "text-emerald-500", value: "text-emerald-400" },
  }[accent];

  return (
    <div className={cn("rounded-lg border border-border p-3 space-y-1", styles.bg)}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", styles.icon)} />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className={cn("text-xl font-bold", styles.value)}>{value}</div>
      <p className="text-[10px] text-muted-foreground">{subtext}</p>
    </div>
  );
}
