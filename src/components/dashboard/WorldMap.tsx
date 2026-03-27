"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { backgroundLand, jurisdictionShapes } from "./map-paths";

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
/* Velocity color palette                                              */
/* ------------------------------------------------------------------ */

const DARK_FILL = "#141922";         // no-data land
const DARK_STROKE = "#1e2533";       // country outlines
const BG = "#0b0f15";               // ocean / background

const velocity = {
  high: {
    fill: "#7f1d1d",           // dark red fill
    fillTracked: "#991b1b",    // brighter red for tracked
    stroke: "#dc2626",
    glow: "#ef4444",
    pin: "#ef4444",
  },
  medium: {
    fill: "#78350f",           // dark amber fill
    fillTracked: "#92400e",    // brighter amber for tracked
    stroke: "#d97706",
    glow: "#f59e0b",
    pin: "#f59e0b",
  },
  low: {
    fill: "#064e3b",           // dark emerald fill
    fillTracked: "#065f46",    // brighter emerald for tracked
    stroke: "#059669",
    glow: "#10b981",
    pin: "#10b981",
  },
};

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

  const dataMap = useMemo(
    () => new Map(jurisdictions.map((j) => [j.code, j])),
    [jurisdictions]
  );

  const handleClick = useCallback(
    (code: string) => { router.push(`/feed?jurisdiction=${code}`); },
    [router]
  );

  const handleMouse = useCallback(
    (e: React.MouseEvent, code: string) => {
      const data = dataMap.get(code);
      if (!data) return;
      const svg = (e.currentTarget as SVGElement).closest("svg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, data });
    },
    [dataMap]
  );

  const clearTooltip = useCallback(() => setTooltip(null), []);

  return (
    <div className="hidden md:block rounded-lg border border-border overflow-hidden relative">
      {/* Dark ocean background */}
      <div className="absolute inset-0" style={{ backgroundColor: BG }} />
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/8 via-transparent to-cyan-950/5" />

      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 4px)",
        }}
      />

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-[10px] font-semibold text-cyan-400/80 uppercase tracking-[0.2em]">
              Regulatory Intelligence — Global Monitor
            </h3>
          </div>
          <div className="flex items-center gap-4 text-[9px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
              High
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
              Medium
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              Low
            </span>
          </div>
        </div>

        {/* SVG Map */}
        <div className="relative">
          <svg viewBox="0 0 1000 500" className="w-full h-auto" style={{ maxHeight: "340px" }}>
            <defs>
              {/* Glow filters for pin markers */}
              <filter id="glR" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feFlood floodColor="#ef4444" floodOpacity="0.7" result="c" />
                <feComposite in="c" in2="b" operator="in" result="g" />
                <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glA" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feFlood floodColor="#f59e0b" floodOpacity="0.7" result="c" />
                <feComposite in="c" in2="b" operator="in" result="g" />
                <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glG" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feFlood floodColor="#10b981" floodOpacity="0.7" result="c" />
                <feComposite in="c" in2="b" operator="in" result="g" />
                <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>

              {/* Subtle grid */}
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M50 0L0 0 0 50" fill="none" stroke="rgba(34,211,238,0.025)" strokeWidth="0.5" />
              </pattern>
            </defs>

            {/* Grid overlay */}
            <rect width="1000" height="500" fill="url(#grid)" />

            {/* Lat/lon reference lines */}
            {[100, 167, 250, 333, 400].map((y) => (
              <line key={`la${y}`} x1="0" y1={y} x2="1000" y2={y}
                stroke="rgba(34,211,238,0.02)" strokeWidth="0.5" strokeDasharray="4 12" />
            ))}
            {[167, 333, 500, 667, 833].map((x) => (
              <line key={`lo${x}`} x1={x} y1="0" x2={x} y2="500"
                stroke="rgba(34,211,238,0.02)" strokeWidth="0.5" strokeDasharray="4 12" />
            ))}

            {/* ====================================================== */}
            {/* Layer 1: Background landmasses (no regulation data)     */}
            {/* ====================================================== */}
            {backgroundLand.map((d, i) => (
              <path key={`bg${i}`} d={d} fill={DARK_FILL} stroke={DARK_STROKE} strokeWidth="0.5" />
            ))}

            {/* ====================================================== */}
            {/* Layer 2: Jurisdiction regions — velocity-colored fills  */}
            {/* ====================================================== */}
            {jurisdictionShapes.map((shape) => {
              if (shape.paths.length === 0) return null; // OECD — no fill
              const data = dataMap.get(shape.code);
              if (!data) {
                // Has shape data but no jurisdiction data — render dark
                return shape.paths.map((d, i) => (
                  <path key={`${shape.code}-${i}`} d={d} fill={DARK_FILL} stroke={DARK_STROKE} strokeWidth="0.5" />
                ));
              }

              const v = velocity[data.velocityLevel];
              const fill = data.isTracked ? v.fillTracked : v.fill;
              const stroke = v.stroke;

              return shape.paths.map((d, i) => (
                <path
                  key={`${shape.code}-${i}`}
                  d={d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={data.isTracked ? "1" : "0.5"}
                  strokeOpacity={data.isTracked ? 0.6 : 0.3}
                  className="cursor-pointer transition-colors duration-300 hover:brightness-125"
                  onClick={() => handleClick(shape.code)}
                  onMouseMove={(e) => handleMouse(e, shape.code)}
                  onMouseLeave={clearTooltip}
                />
              ));
            })}

            {/* ====================================================== */}
            {/* Layer 3: OECD dashed orbit                              */}
            {/* ====================================================== */}
            {dataMap.has("INTL") && (
              <ellipse
                cx="500" cy="250" rx="440" ry="200"
                fill="none" stroke="rgba(34,211,238,0.04)" strokeWidth="0.5" strokeDasharray="3 9"
              />
            )}

            {/* ====================================================== */}
            {/* Layer 4: Pin markers + pulse animations                 */}
            {/* ====================================================== */}
            {jurisdictionShapes.map((shape) => {
              const data = dataMap.get(shape.code);
              if (!data || shape.code === "INTL") return null;

              const v = velocity[data.velocityLevel];
              const { x, y } = shape.pin;
              const tracked = data.isTracked;
              const r = tracked ? 4 : 2;
              const glowFilter = data.velocityLevel === "high" ? "url(#glR)"
                : data.velocityLevel === "medium" ? "url(#glA)" : "url(#glG)";

              return (
                <g key={`pin-${shape.code}`}>
                  {/* Radar pulse for recent updates */}
                  {data.hasRecentUpdate && tracked && (
                    <>
                      <circle cx={x} cy={y} r="5" fill="none" stroke={v.glow} strokeWidth="1">
                        <animate attributeName="r" from="5" to="22" dur="2.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.6" to="0" dur="2.5s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={x} cy={y} r="5" fill="none" stroke={v.glow} strokeWidth="0.5">
                        <animate attributeName="r" from="5" to="22" dur="2.5s" begin="0.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.4" to="0" dur="2.5s" begin="0.8s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={x} cy={y} r="5" fill="none" stroke={v.glow} strokeWidth="0.3">
                        <animate attributeName="r" from="5" to="22" dur="2.5s" begin="1.6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.25" to="0" dur="2.5s" begin="1.6s" repeatCount="indefinite" />
                      </circle>
                    </>
                  )}

                  {/* Ambient glow halo */}
                  {tracked && (
                    <circle cx={x} cy={y} r={r + 6} fill={v.glow} opacity="0.08" className="pointer-events-none" />
                  )}

                  {/* Pin dot */}
                  <circle
                    cx={x} cy={y} r={r}
                    fill={v.pin}
                    opacity={tracked ? 1 : 0.35}
                    filter={tracked ? glowFilter : undefined}
                    className="cursor-pointer"
                    onClick={() => handleClick(shape.code)}
                    onMouseMove={(e) => handleMouse(e, shape.code)}
                    onMouseLeave={clearTooltip}
                  />

                  {/* Bright center dot */}
                  {tracked && (
                    <circle cx={x} cy={y} r="1.2" fill="#fff" opacity="0.85" className="pointer-events-none" />
                  )}

                  {/* Label */}
                  {tracked && (
                    <text
                      x={x} y={y - r - 5}
                      textAnchor="middle"
                      fill={v.pin} fontSize="7" fontWeight="700" fontFamily="monospace"
                      opacity="0.75" className="pointer-events-none select-none"
                    >
                      {shape.label}
                    </text>
                  )}

                  {/* Invisible hit area */}
                  <circle
                    cx={x} cy={y} r="14" fill="transparent" className="cursor-pointer"
                    onClick={() => handleClick(shape.code)}
                    onMouseMove={(e) => handleMouse(e, shape.code)}
                    onMouseLeave={clearTooltip}
                  />
                </g>
              );
            })}

            {/* HUD corner brackets */}
            <g stroke="rgba(34,211,238,0.1)" strokeWidth="1" fill="none">
              <polyline points="3,14 3,3 14,3" />
              <polyline points="986,14 986,3 975,3" />
              <polyline points="3,486 3,497 14,497" />
              <polyline points="986,486 986,497 975,497" />
            </g>

            {/* Status text */}
            <text x="12" y="493" fill="rgba(34,211,238,0.18)" fontSize="8" fontFamily="monospace">
              {jurisdictions.filter((j) => j.isTracked).length} TRACKED ·{" "}
              {jurisdictions.filter((j) => j.hasRecentUpdate).length} ACTIVE ·{" "}
              {jurisdictions.reduce((s, j) => s + j.regulationCount, 0)} REGS
            </text>
            {dataMap.has("INTL") && (
              <text x="988" y="493" textAnchor="end" fill="rgba(34,211,238,0.12)" fontSize="7" fontFamily="monospace">
                OECD/46
              </text>
            )}
          </svg>

          {/* ====================================================== */}
          {/* Tooltip                                                  */}
          {/* ====================================================== */}
          {tooltip && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: Math.min(Math.max(tooltip.x - 80, 8), 780),
                top: Math.max(tooltip.y - 112, 8),
              }}
            >
              <div className="rounded border border-cyan-900/50 bg-[#0c1017]/95 backdrop-blur-sm px-3 py-2.5 shadow-[0_0_24px_rgba(0,0,0,0.6)] min-w-[160px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: velocity[tooltip.data.velocityLevel].pin,
                      boxShadow: `0 0 8px ${velocity[tooltip.data.velocityLevel].glow}`,
                    }}
                  />
                  <span className="text-xs font-semibold text-slate-200">{tooltip.data.name}</span>
                </div>
                <div className="space-y-0.5 text-[10px] font-mono">
                  <Row label="REGS" value={String(tooltip.data.regulationCount)} />
                  <div className="flex justify-between gap-6">
                    <span className="text-slate-500">VELOCITY</span>
                    <span style={{ color: velocity[tooltip.data.velocityLevel].pin }}>
                      {tooltip.data.velocityLevel.toUpperCase()} ({tooltip.data.velocityScore})
                    </span>
                  </div>
                  <Row label="STATUS" value={tooltip.data.complianceStatus.toUpperCase()} />
                  {tooltip.data.hasRecentUpdate && (
                    <div className="text-cyan-400 mt-1 text-[9px]">● RECENT ACTIVITY</div>
                  )}
                  {!tooltip.data.isTracked && (
                    <div className="text-slate-600 mt-1 text-[9px] italic">NOT TRACKED</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300">{value}</span>
    </div>
  );
}
