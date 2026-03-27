"use client";

import { cn } from "@/lib/utils";

interface ComplianceGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function ComplianceGauge({ score, size = "lg", label }: ComplianceGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));

  const dims = {
    sm: { w: 64, h: 64, stroke: 6, text: "text-lg", sub: "text-[10px]" },
    md: { w: 80, h: 80, stroke: 7, text: "text-xl", sub: "text-xs" },
    lg: { w: 100, h: 100, stroke: 8, text: "text-2xl sm:text-3xl", sub: "text-xs sm:text-sm" },
  }[size];

  const radius = (dims.w - dims.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedScore / 100) * circumference;

  const color =
    clampedScore > 70
      ? "text-emerald-500"
      : clampedScore > 40
        ? "text-amber-500"
        : "text-red-500";

  const trackColor =
    clampedScore > 70
      ? "stroke-emerald-500/15"
      : clampedScore > 40
        ? "stroke-amber-500/15"
        : "stroke-red-500/15";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: dims.w, height: dims.w }}>
        <svg
          width={dims.w}
          height={dims.w}
          viewBox={`0 0 ${dims.w} ${dims.w}`}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={dims.w / 2}
            cy={dims.w / 2}
            r={radius}
            fill="none"
            strokeWidth={dims.stroke}
            className={trackColor}
          />
          {/* Progress */}
          <circle
            cx={dims.w / 2}
            cy={dims.w / 2}
            r={radius}
            fill="none"
            strokeWidth={dims.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn("transition-all duration-700 ease-out", color.replace("text-", "stroke-"))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold", dims.text, color)}>{clampedScore}</span>
        </div>
      </div>
      {label && (
        <span className={cn("font-medium text-muted-foreground", dims.sub)}>{label}</span>
      )}
    </div>
  );
}
