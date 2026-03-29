"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Table2,
  LayoutGrid,
  Activity,
  Clock,
  CalendarDays,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RegulationCard } from "@/components/feed/RegulationCard";
import { UpdateTimeline } from "@/components/feed/UpdateTimeline";
import type { Regulation, RegulatoryUpdate } from "@/lib/types/regulation";
import type { VelocityMap, VelocityResult } from "@/lib/utils/velocity";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

// Jurisdiction options are now passed as props from the server

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "enacted", label: "Enacted" },
  { value: "in_effect", label: "In Effect" },
  { value: "proposed", label: "Proposed" },
  { value: "under_review", label: "Under Review" },
  { value: "repealed", label: "Repealed" },
];

const categoryOptions = [
  { value: "all", label: "All Categories" },
  { value: "legislation", label: "Legislation" },
  { value: "executive_order", label: "Executive Order" },
  { value: "framework", label: "Framework" },
  { value: "guidance", label: "Guidance" },
  { value: "standard", label: "Standard" },
];

const statusColors: Record<string, string> = {
  enacted: "bg-green-500/15 text-green-400 border-green-500/30",
  in_effect: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  proposed: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  under_review: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  repealed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const categoryLabels: Record<string, string> = {
  legislation: "Legislation",
  executive_order: "Exec Order",
  framework: "Framework",
  guidance: "Guidance",
  standard: "Standard",
};

const velocityColors: Record<string, string> = {
  high: "text-red-400 bg-red-500/10",
  medium: "text-amber-400 bg-amber-500/10",
  low: "text-emerald-400 bg-emerald-500/10",
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type SortField =
  | "jurisdiction"
  | "title"
  | "status"
  | "category"
  | "effective_date"
  | "last_verified_at";
type SortDir = "asc" | "desc";

interface FeedClientProps {
  regulations: Regulation[];
  total: number;
  page: number;
  totalPages: number;
  updates: RegulatoryUpdate[];
  velocityScores: VelocityMap;
  jurisdictionOptions: { value: string; label: string }[];
  lastChecked: string | null;
  statusCounts: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FeedClient({
  regulations,
  total,
  page,
  totalPages,
  updates,
  velocityScores,
  jurisdictionOptions: jurisdictionOptionsProp,
  lastChecked,
  statusCounts,
}: FeedClientProps) {
  const jurisdictionOptions = useMemo(
    () => [{ value: "all", label: "All Jurisdictions" }, ...jurisdictionOptionsProp],
    [jurisdictionOptionsProp]
  );
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auto card view on mobile
  const [view, setView] = useState<"table" | "card">(
    typeof window !== "undefined" && window.innerWidth < 640 ? "card" : "table"
  );
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("last_verified_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("search") || "");

  // Active filters
  const activeJurisdiction = searchParams.get("jurisdiction") || "";
  const activeStatus = searchParams.get("status") || "";
  const activeCategory = searchParams.get("category") || "";
  const activeSearch = searchParams.get("search") || "";

  const activeFilterCount = [activeJurisdiction, activeStatus, activeCategory, activeSearch].filter(
    Boolean
  ).length;

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`/feed?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push("/feed");
    setSearchDraft("");
  }, [router]);

  const goToPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (p > 1) params.set("page", String(p));
      else params.delete("page");
      router.push(`/feed?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Client-side sort (the page-level data is already server-filtered)
  const sorted = useMemo(() => {
    const copy = [...regulations];
    copy.sort((a, b) => {
      let cmp = 0;
      const fa = a[sortField] ?? "";
      const fb = b[sortField] ?? "";
      if (fa < fb) cmp = -1;
      else if (fa > fb) cmp = 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [regulations, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-sm sm:text-base font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-bright)]">Regulatory Intelligence Feed</h1>
          <p className="text-xs font-mono text-[var(--text-tertiary)] mt-0.5 tabular-nums">
            {total} regulation{total !== 1 ? "s" : ""} tracked
          </p>
          {/* Status breakdown */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            {[
              { key: "enacted", label: "enacted", color: "text-emerald-400" },
              { key: "in_effect", label: "in effect", color: "text-blue-400" },
              { key: "proposed", label: "proposed", color: "text-yellow-400" },
              { key: "under_review", label: "under review", color: "text-orange-400" },
              { key: "repealed", label: "repealed", color: "text-red-400" },
            ].map(({ key, label, color }) =>
              statusCounts[key] ? (
                <span key={key} className="text-[10px] font-mono">
                  <span className={color}>{statusCounts[key]}</span>{" "}
                  <span className="text-[var(--text-tertiary)]">{label}</span>
                </span>
              ) : null
            )}
          </div>
          {/* Data freshness */}
          {lastChecked && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
              Last checked:{" "}
              <span className="font-mono tabular-nums">
                {format(new Date(lastChecked), "MMM d, yyyy")}
              </span>
              {" · Checks daily at 6:00 AM UTC"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1.5 text-xs transition-colors min-h-[36px]",
              view === "table"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
          <button
            onClick={() => setView("card")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1.5 text-xs transition-colors min-h-[36px]",
              view === "card"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* Filter Bar                                                     */}
      {/* ============================================================= */}
      <div className="rounded-lg glass sticky top-14 z-30 px-3 py-2">
        {/* Mobile: filter toggle + search */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="sm:hidden flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground min-h-[36px]"
          >
            <Search className="h-3 w-3" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[9px] text-primary-foreground font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Desktop: inline dropdowns */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap flex-1">
            <FilterSelect
              value={activeJurisdiction || "all"}
              options={jurisdictionOptions}
              onChange={(v) => updateParams("jurisdiction", v)}
            />
            <FilterSelect
              value={activeStatus || "all"}
              options={statusOptions}
              onChange={(v) => updateParams("status", v)}
            />
            <FilterSelect
              value={activeCategory || "all"}
              options={categoryOptions}
              onChange={(v) => updateParams("category", v)}
            />
          </div>

          <div className="flex-1 min-w-[120px]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") updateParams("search", searchDraft);
                }}
                onBlur={() => {
                  if (searchDraft !== activeSearch) updateParams("search", searchDraft);
                }}
                placeholder="Search..."
                className="h-8 sm:h-7 w-full rounded-md border border-input bg-transparent pl-7 pr-2 text-sm sm:text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
            {activeFilterCount > 0 && (
              <>
                <span>
                  Showing {regulations.length} of {total}
                </span>
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-0.5 text-primary hover:underline"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile: expanded filter dropdowns */}
        {filtersOpen && (
          <div className="sm:hidden mt-2 pt-2 border-t border-border space-y-2">
            <FilterSelect
              value={activeJurisdiction || "all"}
              options={jurisdictionOptions}
              onChange={(v) => updateParams("jurisdiction", v)}
            />
            <FilterSelect
              value={activeStatus || "all"}
              options={statusOptions}
              onChange={(v) => updateParams("status", v)}
            />
            <FilterSelect
              value={activeCategory || "all"}
              options={categoryOptions}
              onChange={(v) => updateParams("category", v)}
            />
            {activeFilterCount > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Showing {regulations.length} of {total}</span>
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-0.5 text-primary hover:underline min-h-[36px]"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* Table View                                                     */}
      {/* ============================================================= */}
      {view === "table" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          {regulations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-card/30">
              <p className="text-sm font-medium">No regulations found</p>
              <p className="text-xs mt-1">Adjust your filters or search terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <Th field="jurisdiction" label="Jurisdiction" sort={handleSort}>
                      <SortIcon field="jurisdiction" />
                    </Th>
                    <Th field="title" label="Regulation" sort={handleSort} wide>
                      <SortIcon field="title" />
                    </Th>
                    <Th field="status" label="Status" sort={handleSort}>
                      <SortIcon field="status" />
                    </Th>
                    <Th field="category" label="Category" sort={handleSort}>
                      <SortIcon field="category" />
                    </Th>
                    <Th field="effective_date" label="Effective" sort={handleSort}>
                      <SortIcon field="effective_date" />
                    </Th>
                    <Th field="last_verified_at" label="Verified" sort={handleSort}>
                      <SortIcon field="last_verified_at" />
                    </Th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                      Velocity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sorted.map((reg) => {
                    const vel = velocityScores[reg.jurisdiction];
                    const isExpanded = expandedRow === reg.id;

                    return (
                      <TableRow
                        key={reg.id}
                        reg={reg}
                        vel={vel}
                        isExpanded={isExpanded}
                        onToggle={() =>
                          setExpandedRow(isExpanded ? null : reg.id)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ============================================================= */
        /* Card View                                                      */
        /* ============================================================= */
        <div className="space-y-3">
          {regulations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm font-medium">No regulations found</p>
              <p className="text-xs mt-1">Adjust your filters or search terms.</p>
            </div>
          ) : (
            sorted.map((reg) => (
              <RegulationCard
                key={reg.id}
                regulation={reg}
                velocity={velocityScores[reg.jurisdiction]}
              />
            ))
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* Pagination                                                     */}
      {/* ============================================================= */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="h-7 px-2"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {generatePageNumbers(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p as number)}
                  className={cn(
                    "flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded text-xs tabular-nums transition-colors",
                    p === page
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {p}
                </button>
              )
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="h-7 px-2"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* Collapsible Updates Timeline                                   */}
      {/* ============================================================= */}
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setUpdatesOpen(!updatesOpen)}
          className="flex items-center justify-between w-full px-4 py-2.5 bg-card/50 hover:bg-accent/30 transition-colors"
        >
          <span className="text-xs font-semibold">
            Recent Updates{" "}
            <span className="text-muted-foreground font-normal">({updates.length})</span>
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              updatesOpen && "rotate-180"
            )}
          />
        </button>
        {updatesOpen && (
          <div className="p-4 border-t border-border">
            <UpdateTimeline updates={updates} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table Row + Expanded Detail                                         */
/* ------------------------------------------------------------------ */

function TableRow({
  reg,
  vel,
  isExpanded,
  onToggle,
}: {
  reg: Regulation;
  vel?: VelocityResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-all duration-150 border-l-2 border-l-transparent",
          isExpanded
            ? "bg-[var(--bg-tertiary)] border-l-[var(--accent-primary)]"
            : "hover:bg-[var(--bg-tertiary)] hover:border-l-[var(--accent-primary)]"
        )}
      >
        <td className="px-3 py-2 whitespace-nowrap">
          <span className="text-xs">{reg.jurisdiction_display}</span>
        </td>
        <td className="px-3 py-2 max-w-[340px]">
          <span className="font-medium text-foreground line-clamp-1">{reg.title}</span>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0", statusColors[reg.status])}
          >
            {reg.status.replace("_", " ")}
          </Badge>
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
          {categoryLabels[reg.category] ?? reg.category}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
          {reg.effective_date ? format(new Date(reg.effective_date), "MMM d, yy") : "\u2014"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
          {format(new Date(reg.last_verified_at), "MMM d, yyyy")}
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          {vel ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                velocityColors[vel.level]
              )}
            >
              <Activity className="h-2.5 w-2.5" />
              {vel.level === "high" ? "High" : vel.level === "medium" ? "Med" : "Low"}
            </span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </td>
      </tr>

      {/* Expanded inline detail */}
      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-accent/20 border-t border-border/40">
            <div className="px-4 py-3 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {reg.summary}
              </p>

              {reg.key_requirements && reg.key_requirements.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Key Requirements
                  </span>
                  <ul className="mt-1 space-y-0.5">
                    {reg.key_requirements.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-primary shrink-0">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reg.compliance_implications && reg.compliance_implications.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Compliance Implications
                  </span>
                  <ul className="mt-1 space-y-0.5">
                    {reg.compliance_implications.map((c, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-amber-500 shrink-0">•</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground pt-1">
                {reg.effective_date && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    Effective: {format(new Date(reg.effective_date), "MMM d, yyyy")}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Verified {format(new Date(reg.last_verified_at), "MMM d, yyyy")}
                </span>
                <a
                  href={reg.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  {reg.source_name}
                </a>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Table Header Cell                                                   */
/* ------------------------------------------------------------------ */

function Th({
  field,
  label,
  sort,
  children,
  wide,
}: {
  field: SortField;
  label: string;
  sort: (f: SortField) => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <th
      className={cn(
        "px-3 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors whitespace-nowrap border-b border-[var(--border-subtle)]",
        wide && "min-w-[240px]"
      )}
      onClick={() => sort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {children}
      </span>
    </th>
  );
}

/* ------------------------------------------------------------------ */
/* Filter Select (compact dropdown)                                    */
/* ------------------------------------------------------------------ */

function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 sm:h-7 w-full sm:w-auto rounded-md border border-input bg-transparent px-2 text-sm sm:text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer appearance-none pr-6"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 6px center",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination Helpers                                                  */
/* ------------------------------------------------------------------ */

function generatePageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
