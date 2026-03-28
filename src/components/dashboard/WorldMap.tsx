"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const DARK_FILL = "#141922";
const DARK_STROKE = "#1e2533";

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
/* ISO 3166-1 numeric → jurisdiction code mapping                      */
/* ------------------------------------------------------------------ */

// EU 27 member states
const EU_CODES = new Set([
  "040", "056", "100", "191", "196", "203", "208", "233", "246", "250",
  "276", "300", "348", "372", "380", "428", "440", "442", "470", "528",
  "616", "620", "642", "703", "705", "724", "752",
]);

function isoToJurisdiction(isoNumeric: string): string | null {
  if (EU_CODES.has(isoNumeric)) return "EU";
  switch (isoNumeric) {
    case "840": return "US";
    case "124": return "CA";
    case "826": return "GB";
    case "076": return "BR";
    case "702": return "SG";
    case "360": return "ID";
    case "410": return "KR";
    case "392": return "JP";
    case "156": return "CN";
    case "036": return "AU";
    case "356": return "IN";
    case "682": return "SA";
    case "710": return "ZA";
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/* Pin marker locations [longitude, latitude]                          */
/* ------------------------------------------------------------------ */

const PIN_LOCATIONS: Record<string, { coords: [number, number]; label: string }> = {
  EU:      { coords: [9.7, 50.1],     label: "EU" },
  US:      { coords: [-98.5, 39.8],   label: "US" },
  "US-TX": { coords: [-100.0, 31.0],  label: "TX" },
  "US-CO": { coords: [-105.5, 39.0],  label: "CO" },
  "US-CA": { coords: [-119.4, 36.8],  label: "CA" },
  "US-IL": { coords: [-89.0, 40.0],   label: "IL" },
  "US-CT": { coords: [-72.7, 41.6],   label: "CT" },
  "US-UT": { coords: [-111.9, 39.3],  label: "UT" },
  "US-TN": { coords: [-86.6, 35.7],   label: "TN" },
  "US-NYC": { coords: [-74.0, 40.7],  label: "NYC" },
  "US-MD": { coords: [-76.6, 39.0],   label: "MD" },
  CA:      { coords: [-106.3, 56.1],  label: "CA" },
  GB:      { coords: [-3.4, 55.4],    label: "UK" },
  BR:      { coords: [-51.9, -14.2],  label: "BR" },
  SG:      { coords: [103.8, 1.35],   label: "SG" },
  ID:      { coords: [113.9, -0.8],   label: "ID" },
  KR:      { coords: [127.8, 36.5],   label: "KR" },
  JP:      { coords: [138.3, 36.2],   label: "JP" },
  CN:      { coords: [104.2, 35.9],   label: "CN" },
  AU:      { coords: [133.8, -25.3],  label: "AU" },
  IN:      { coords: [78.9, 20.6],    label: "IN" },
  SA:      { coords: [45.1, 23.9],    label: "SA" },
  ZA:      { coords: [25.7, -29.0],   label: "ZA" },
  INTL:    { coords: [2.3, 48.9],     label: "OECD" },
};

/* ------------------------------------------------------------------ */
/* Velocity colors                                                     */
/* ------------------------------------------------------------------ */

const VELOCITY_FILL = {
  high:   { tracked: "rgba(239,68,68,0.5)",  untracked: "rgba(239,68,68,0.25)"  },
  medium: { tracked: "rgba(245,158,11,0.5)", untracked: "rgba(245,158,11,0.25)" },
  low:    { tracked: "rgba(16,185,129,0.5)", untracked: "rgba(16,185,129,0.25)" },
};

const VELOCITY_STROKE = {
  high:   { tracked: "rgba(239,68,68,0.6)",  untracked: "rgba(239,68,68,0.3)"  },
  medium: { tracked: "rgba(245,158,11,0.6)", untracked: "rgba(245,158,11,0.3)" },
  low:    { tracked: "rgba(16,185,129,0.6)", untracked: "rgba(16,185,129,0.3)" },
};

const VELOCITY_PIN = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#10b981",
};

const VELOCITY_FILTER = {
  high:   "url(#glR)",
  medium: "url(#glA)",
  low:    "url(#glG)",
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
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export const WorldMap = memo(function WorldMap({ jurisdictions }: WorldMapProps) {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const dataMap = useMemo(
    () => new Map(jurisdictions.map((j) => [j.code, j])),
    [jurisdictions]
  );

  // For each ISO country, find its jurisdiction data (if any)
  const getCountryStyle = useCallback(
    (isoNumeric: string) => {
      const jCode = isoToJurisdiction(isoNumeric);
      if (!jCode) return { fill: DARK_FILL, stroke: DARK_STROKE, strokeWidth: 0.5 };

      const data = dataMap.get(jCode);
      if (!data) return { fill: DARK_FILL, stroke: DARK_STROKE, strokeWidth: 0.5 };

      const vf = VELOCITY_FILL[data.velocityLevel];
      const vs = VELOCITY_STROKE[data.velocityLevel];

      return {
        fill: data.isTracked ? vf.tracked : vf.untracked,
        stroke: data.isTracked ? vs.tracked : vs.untracked,
        strokeWidth: data.isTracked ? 0.8 : 0.5,
      };
    },
    [dataMap]
  );

  const handleClick = useCallback(
    (code: string) => { router.push(`/feed?jurisdiction=${code}`); },
    [router]
  );

  const handleGeoClick = useCallback(
    (isoNumeric: string) => {
      const jCode = isoToJurisdiction(isoNumeric);
      if (jCode && dataMap.has(jCode)) handleClick(jCode);
    },
    [dataMap, handleClick]
  );

  const handleGeoHover = useCallback(
    (e: React.MouseEvent, isoNumeric: string) => {
      const jCode = isoToJurisdiction(isoNumeric);
      if (!jCode) { setTooltip(null); return; }
      const data = dataMap.get(jCode);
      if (!data) { setTooltip(null); return; }
      const rect = (e.currentTarget as Element).closest(".rsm-svg, svg")?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, data });
    },
    [dataMap]
  );

  const handlePinHover = useCallback(
    (e: React.MouseEvent, code: string) => {
      const data = dataMap.get(code);
      if (!data) return;
      const rect = (e.currentTarget as Element).closest("svg")?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, data });
    },
    [dataMap]
  );

  return (
    <div className="hidden md:block rounded-lg border border-border overflow-hidden relative">
      {/* Dark ocean background */}
      <div className="absolute inset-0 bg-[#0b0f15]" />
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/[0.08] via-transparent to-cyan-950/[0.04]" />

      {/* Scanline */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.04) 3px,rgba(255,255,255,0.04) 4px)",
        }}
      />

      <div className="relative px-4 pt-4 pb-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-[10px] font-semibold text-cyan-400/80 uppercase tracking-[0.2em]">
              Regulatory Intelligence — Global Monitor
            </h3>
          </div>
          <div className="flex items-center gap-4 text-[9px] text-slate-500">
            <LegendDot color="#ef4444" label="High" />
            <LegendDot color="#f59e0b" label="Medium" />
            <LegendDot color="#10b981" label="Low" />
          </div>
        </div>

        {/* Map container */}
        <div className="relative max-h-[400px] overflow-hidden" onMouseLeave={() => setTooltip(null)}>
          {/* HUD corner brackets — overlaid via absolute positioning */}
          <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-cyan-500/10 pointer-events-none z-10" />
          <div className="absolute top-0 right-0 w-3 h-3 border-r border-t border-cyan-500/10 pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-cyan-500/10 pointer-events-none z-10" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-cyan-500/10 pointer-events-none z-10" />

          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 130, center: [20, 20] }}
            width={900}
            height={440}
            style={{ width: "100%", height: "auto" }}
          >
            {/* SVG defs for glow filters */}
            <defs>
              <filter id="glR" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" />
                <feFlood floodColor="#ef4444" floodOpacity="0.7" result="c" />
                <feComposite in="c" in2="SourceGraphic" operator="in" result="g" />
                <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glA" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" />
                <feFlood floodColor="#f59e0b" floodOpacity="0.7" result="c" />
                <feComposite in="c" in2="SourceGraphic" operator="in" result="g" />
                <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glG" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" />
                <feFlood floodColor="#10b981" floodOpacity="0.7" result="c" />
                <feComposite in="c" in2="SourceGraphic" operator="in" result="g" />
                <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* World countries */}
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso = geo.id;
                  const style = getCountryStyle(iso);
                  const jCode = isoToJurisdiction(iso);
                  const hasData = jCode && dataMap.has(jCode);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={style.strokeWidth}
                      style={{
                        default: { outline: "none" },
                        hover: {
                          outline: "none",
                          fill: hasData ? undefined : DARK_FILL,
                          filter: hasData ? "brightness(1.3)" : undefined,
                          cursor: hasData ? "pointer" : "default",
                        },
                        pressed: { outline: "none" },
                      }}
                      onClick={() => handleGeoClick(iso)}
                      onMouseMove={(e: React.MouseEvent) => handleGeoHover(e, iso)}
                    />
                  );
                })
              }
            </Geographies>

            {/* Pin markers for each jurisdiction */}
            {Object.entries(PIN_LOCATIONS).map(([code, { coords, label }]) => {
              const data = dataMap.get(code);
              if (!data) return null;

              const pinColor = VELOCITY_PIN[data.velocityLevel];
              const filterUrl = VELOCITY_FILTER[data.velocityLevel];
              const isTracked = data.isTracked;
              const r = isTracked ? 4 : 2;

              return (
                <Marker
                  key={code}
                  coordinates={coords}
                  onClick={() => handleClick(code)}
                  onMouseMove={(e: React.MouseEvent) => handlePinHover(e, code)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Radar pulse rings for recent updates */}
                  {data.hasRecentUpdate && isTracked && (
                    <>
                      <circle r="5" fill="none" stroke={pinColor} strokeWidth="1">
                        <animate attributeName="r" from="5" to="20" dur="2.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.6" to="0" dur="2.5s" repeatCount="indefinite" />
                      </circle>
                      <circle r="5" fill="none" stroke={pinColor} strokeWidth="0.6">
                        <animate attributeName="r" from="5" to="20" dur="2.5s" begin="0.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.4" to="0" dur="2.5s" begin="0.8s" repeatCount="indefinite" />
                      </circle>
                      <circle r="5" fill="none" stroke={pinColor} strokeWidth="0.3">
                        <animate attributeName="r" from="5" to="20" dur="2.5s" begin="1.6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.2" to="0" dur="2.5s" begin="1.6s" repeatCount="indefinite" />
                      </circle>
                    </>
                  )}

                  {/* Ambient halo */}
                  {isTracked && (
                    <circle r={r + 5} fill={pinColor} opacity={0.1} />
                  )}

                  {/* Core pin */}
                  <circle
                    r={r}
                    fill={pinColor}
                    opacity={isTracked ? 1 : 0.35}
                    filter={isTracked ? filterUrl : undefined}
                    style={{ cursor: "pointer" }}
                  />

                  {/* White center dot */}
                  {isTracked && <circle r={1.2} fill="#fff" opacity={0.85} />}

                  {/* Label */}
                  {isTracked && (
                    <text
                      y={-r - 5}
                      textAnchor="middle"
                      fill={pinColor}
                      fontSize={7}
                      fontWeight={700}
                      fontFamily="monospace"
                      opacity={0.8}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {label}
                    </text>
                  )}
                </Marker>
              );
            })}
          </ComposableMap>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: Math.min(Math.max(tooltip.x - 80, 8), 700),
                top: Math.max(tooltip.y - 115, 8),
              }}
            >
              <div className="rounded border border-cyan-900/50 bg-[#0c1017]/95 backdrop-blur-sm px-3 py-2.5 shadow-[0_0_24px_rgba(0,0,0,0.6)] min-w-[160px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: VELOCITY_PIN[tooltip.data.velocityLevel],
                      boxShadow: `0 0 8px ${VELOCITY_PIN[tooltip.data.velocityLevel]}`,
                    }}
                  />
                  <span className="text-xs font-semibold text-slate-200">{tooltip.data.name}</span>
                </div>
                <div className="space-y-0.5 text-[10px] font-mono">
                  <TRow label="REGS" value={String(tooltip.data.regulationCount)} />
                  <div className="flex justify-between gap-6">
                    <span className="text-slate-500">VELOCITY</span>
                    <span style={{ color: VELOCITY_PIN[tooltip.data.velocityLevel] }}>
                      {tooltip.data.velocityLevel.toUpperCase()} ({tooltip.data.velocityScore})
                    </span>
                  </div>
                  <TRow label="STATUS" value={tooltip.data.complianceStatus.toUpperCase()} />
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

        {/* Bottom status bar */}
        <div className="flex items-center justify-between px-1 pt-1 text-[8px] font-mono text-cyan-500/20">
          <span>
            {jurisdictions.filter((j) => j.isTracked).length} TRACKED ·{" "}
            {jurisdictions.filter((j) => j.hasRecentUpdate).length} ACTIVE ·{" "}
            {jurisdictions.reduce((s, j) => s + j.regulationCount, 0)} REGS
          </span>
          {dataMap.has("INTL") && <span>OECD/46</span>}
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Small helper components                                             */
/* ------------------------------------------------------------------ */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}99` }}
      />
      {label}
    </span>
  );
}

function TRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300">{value}</span>
    </div>
  );
}
