"use client";

import Link from "next/link";
import { Shield, ArrowRight } from "lucide-react";
import type { CoverageReport } from "@/lib/utils/policy-coverage";

export function PolicyCoverage({ coverage }: { coverage: CoverageReport }) {
  const gaps = coverage.items.filter((i) => !i.has_policy).slice(0, 3);
  const pct = coverage.percentage;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const ringColor = pct >= 70 ? "#34D399" : pct >= 40 ? "#FBBF24" : "#F87171";

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        {/* Progress ring */}
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40" cy="40" r="36"
              fill="none" stroke="currentColor"
              className="text-muted/30" strokeWidth="6"
            />
            <circle
              cx="40" cy="40" r="36"
              fill="none" stroke={ringColor}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold">{pct}%</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Policy Coverage</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {coverage.covered} of {coverage.total} tracked regulations have policies
          </p>

          {gaps.length > 0 && (
            <div className="space-y-1 mb-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Top Gaps
              </p>
              {gaps.map((g) => (
                <p key={g.regulation_id} className="text-xs text-foreground truncate">
                  {g.regulation_title}
                </p>
              ))}
            </div>
          )}

          <Link
            href="/policies?tab=coverage"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View All Gaps <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
