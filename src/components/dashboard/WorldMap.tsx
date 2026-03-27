"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { VelocityResult } from "@/lib/utils/velocity";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface JurisdictionMapData {
  code: string;
  name: string;
  regulationCount: number;
  velocityLevel: "high" | "medium" | "low";
  velocityScore: number;
  isTracked: boolean;
  hasRecentUpdate: boolean;
  complianceStatus: string;
}

interface WorldMapProps {
  jurisdictions: JurisdictionMapData[];
}

/* ------------------------------------------------------------------ */
/* SVG Paths — simplified outlines for tracked regions                 */
/* ------------------------------------------------------------------ */

const regionPaths: Record<string, { d: string; cx: number; cy: number }> = {
  // Western Europe (EU)
  EU: {
    d: "M480,95 L510,85 L530,95 L540,110 L535,130 L520,145 L505,155 L490,150 L475,135 L465,115 L470,100 Z",
    cx: 505, cy: 120,
  },
  // UK
  GB: {
    d: "M455,85 L465,80 L470,90 L468,102 L460,105 L452,98 L450,90 Z",
    cx: 460, cy: 93,
  },
  // US mainland
  US: {
    d: "M120,120 L220,110 L240,115 L250,130 L245,150 L220,160 L180,165 L140,160 L115,145 L110,130 Z",
    cx: 180, cy: 138,
  },
  // Texas
  "US-TX": {
    d: "M170,158 L190,155 L195,165 L188,175 L175,178 L168,170 Z",
    cx: 180, cy: 167,
  },
  // Colorado
  "US-CO": {
    d: "M155,135 L170,134 L171,145 L156,146 Z",
    cx: 163, cy: 140,
  },
  // California
  "US-CA": {
    d: "M115,130 L125,125 L130,140 L128,155 L118,155 L112,145 Z",
    cx: 122, cy: 140,
  },
  // Illinois
  "US-IL": {
    d: "M200,125 L210,123 L212,135 L208,145 L200,143 L198,133 Z",
    cx: 205, cy: 134,
  },
  // Canada
  CA: {
    d: "M100,60 L240,55 L260,70 L250,95 L230,105 L130,110 L105,100 L90,80 Z",
    cx: 175, cy: 82,
  },
  // Brazil
  BR: {
    d: "M260,210 L300,195 L320,210 L325,240 L310,265 L285,275 L260,260 L250,235 Z",
    cx: 288, cy: 238,
  },
  // Singapore (small dot)
  SG: {
    d: "M700,215 L710,212 L715,218 L710,224 L703,222 Z",
    cx: 708, cy: 218,
  },
  // Indonesia
  ID: {
    d: "M690,235 L730,230 L750,238 L745,250 L720,255 L695,250 L688,242 Z",
    cx: 720, cy: 242,
  },
};

// Simplified world background (continents outline)
const worldBg = `M80,55 L260,48 L270,65 L265,100 L250,115 L240,120 L250,135 L248,160 L225,170 L185,178
L170,185 L155,175 L120,165 L105,150 L95,130 L90,105 L85,80 Z
M260,195 L305,185 L330,200 L335,240 L320,270 L295,285 L265,270 L248,240 L252,210 Z
M440,55 L480,48 L520,55 L555,70 L570,95 L560,130 L545,155 L520,165 L500,160 L480,150
L460,140 L445,115 L430,85 L435,65 Z
M580,85 L620,80 L660,75 L700,80 L740,90 L760,110 L770,140 L765,170 L750,195 L730,210
L710,220 L695,225 L670,215 L650,200 L620,185 L600,170 L585,145 L575,120 L578,100 Z
M680,230 L720,225 L755,230 L770,245 L755,260 L730,265 L700,260 L685,248 Z
M770,270 L810,260 L840,275 L830,310 L800,330 L775,320 L765,295 Z`;

/* ------------------------------------------------------------------ */
/* Color utilities                                                     */
/* ------------------------------------------------------------------ */

function getVelocityFill(level: "high" | "medium" | "low", isTracked: boolean): string {
  const opacity = isTracked ? 1 : 0.35;
  const colors = {
    high: `rgba(239,68,68,${opacity})`,      // red
    medium: `rgba(245,158,11,${opacity})`,    // amber
    low: `rgba(16,185,129,${opacity})`,       // emerald
  };
  return colors[level];
}

function getVelocityStroke(level: "high" | "medium" | "low", isTracked: boolean): string {
  if (!isTracked) return "rgba(255,255,255,0.1)";
  const colors = {
    high: "rgba(239,68,68,0.7)",
    medium: "rgba(245,158,11,0.7)",
    low: "rgba(16,185,129,0.7)",
  };
  return colors[level];
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

interface TooltipState {
  x: number;
  y: number;
  data: JurisdictionMapData;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function WorldMap({ jurisdictions }: WorldMapProps) {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const dataMap = new Map(jurisdictions.map((j) => [j.code, j]));

  const handleClick = useCallback(
    (code: string) => {
      router.push(`/feed?jurisdiction=${code}`);
    },
    [router]
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, code: string) => {
      const data = dataMap.get(code);
      if (!data) return;
      const rect = (e.currentTarget as SVGElement).closest("svg")?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 10,
        data,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jurisdictions]
  );

  return (
    <div className="hidden md:block rounded-lg border border-border bg-card/50 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Global Regulatory Map
        </h3>
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> High Velocity
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Low
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 900 360"
          className="w-full h-auto"
          style={{ maxHeight: "280px" }}
        >
          {/* Grid lines for reference */}
          <defs>
            <pattern id="mapGrid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="hsl(var(--border))" strokeWidth="0.3" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="900" height="360" fill="url(#mapGrid)" opacity="0.5" />

          {/* World background continents */}
          <path
            d={worldBg}
            fill="hsl(var(--muted))"
            opacity="0.15"
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
          />

          {/* INTL indicator (OECD) — subtle ring around the globe */}
          {dataMap.has("INTL") && (
            <circle
              cx="450"
              cy="180"
              r="155"
              fill="none"
              stroke={getVelocityStroke(
                dataMap.get("INTL")!.velocityLevel,
                dataMap.get("INTL")!.isTracked
              )}
              strokeWidth="1"
              strokeDasharray="4 6"
              opacity="0.4"
            />
          )}

          {/* Jurisdiction regions */}
          {Object.entries(regionPaths).map(([code, { d, cx, cy }]) => {
            const data = dataMap.get(code);
            if (!data) {
              // Not in DB — show as gray
              return (
                <path
                  key={code}
                  d={d}
                  fill="hsl(var(--muted))"
                  opacity="0.08"
                  stroke="hsl(var(--border))"
                  strokeWidth="0.5"
                />
              );
            }

            const fill = getVelocityFill(data.velocityLevel, data.isTracked);
            const stroke = getVelocityStroke(data.velocityLevel, data.isTracked);

            return (
              <g key={code}>
                <path
                  d={d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={data.isTracked ? "1.5" : "0.5"}
                  className={cn(
                    "cursor-pointer transition-all duration-200",
                    data.isTracked && "hover:brightness-125"
                  )}
                  onClick={() => handleClick(code)}
                  onMouseEnter={(e) => handleMouseEnter(e, code)}
                  onMouseLeave={() => setTooltip(null)}
                />
                {/* Pulse animation for recent updates */}
                {data.hasRecentUpdate && data.isTracked && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="6"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="2"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="r"
                      from="4"
                      to="14"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.6"
                      to="0"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {/* Label dot for tracked */}
                {data.isTracked && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="2.5"
                    fill="white"
                    opacity="0.8"
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}

          {/* INTL label */}
          {dataMap.has("INTL") && (
            <text
              x="450"
              y="348"
              textAnchor="middle"
              className="fill-muted-foreground text-[8px] pointer-events-none"
            >
              OECD — 46 Countries
            </text>
          )}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 pointer-events-none rounded-md border border-border bg-popover px-2.5 py-2 shadow-lg text-xs"
            style={{
              left: Math.min(tooltip.x, 700),
              top: tooltip.y - 80,
            }}
          >
            <div className="font-semibold text-popover-foreground">{tooltip.data.name}</div>
            <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
              <div>{tooltip.data.regulationCount} regulation{tooltip.data.regulationCount !== 1 ? "s" : ""}</div>
              <div>
                Velocity:{" "}
                <span
                  className={cn(
                    "font-medium",
                    tooltip.data.velocityLevel === "high"
                      ? "text-red-400"
                      : tooltip.data.velocityLevel === "medium"
                        ? "text-amber-400"
                        : "text-emerald-400"
                  )}
                >
                  {tooltip.data.velocityLevel} ({tooltip.data.velocityScore})
                </span>
              </div>
              <div>Status: {tooltip.data.complianceStatus}</div>
              {tooltip.data.hasRecentUpdate && (
                <div className="text-primary font-medium">Recent regulatory activity</div>
              )}
              {!tooltip.data.isTracked && (
                <div className="text-muted-foreground/60 italic">Not tracked</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
