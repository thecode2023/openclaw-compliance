import type { AuditFinding } from "@/lib/types/audit";

/* ------------------------------------------------------------------ */
/* Penalty Structures (real data from seeded regulations)              */
/* ------------------------------------------------------------------ */

export interface PenaltyStructure {
  max_fine_fixed: number | null;       // USD
  max_fine_percentage: number | null;   // decimal (0.07 = 7%)
  fine_basis: string;
  criminal_penalties: boolean;
  enforcement_body: string;
  jurisdiction_display: string;
}

// All amounts in USD (approximate conversions where needed)
export const penaltyData: Record<string, PenaltyStructure> = {
  EU: {
    max_fine_fixed: 38_500_000,         // €35M ≈ $38.5M
    max_fine_percentage: 0.07,           // 7% of global turnover
    fine_basis: "global annual turnover",
    criminal_penalties: false,
    enforcement_body: "National Market Surveillance Authorities",
    jurisdiction_display: "European Union",
  },
  "US-TX": {
    max_fine_fixed: 200_000,             // per violation
    max_fine_percentage: null,
    fine_basis: "per violation ($10K–$200K)",
    criminal_penalties: false,
    enforcement_body: "Texas Attorney General",
    jurisdiction_display: "United States — Texas",
  },
  "US-CO": {
    max_fine_fixed: null,                // enforced under CCPA-like framework
    max_fine_percentage: null,
    fine_basis: "enforcement begins 2026 (TBD)",
    criminal_penalties: false,
    enforcement_body: "Colorado Attorney General",
    jurisdiction_display: "United States — Colorado",
  },
  "US-IL": {
    max_fine_fixed: 5_000,               // per violation (intentional)
    max_fine_percentage: null,
    fine_basis: "per violation ($1K–$5K, class actions reach hundreds of millions)",
    criminal_penalties: false,
    enforcement_body: "Private right of action + Illinois AG",
    jurisdiction_display: "United States — Illinois",
  },
  "US-CA": {
    max_fine_fixed: null,
    max_fine_percentage: null,
    fine_basis: "penalties under CCPA enforcement",
    criminal_penalties: false,
    enforcement_body: "California Attorney General",
    jurisdiction_display: "United States — California",
  },
  US: {
    max_fine_fixed: null,
    max_fine_percentage: null,
    fine_basis: "voluntary (NIST RMF)",
    criminal_penalties: false,
    enforcement_body: "N/A (voluntary framework)",
    jurisdiction_display: "United States (Federal)",
  },
  ID: {
    max_fine_fixed: null,
    max_fine_percentage: 0.02,           // 2% annual revenue
    fine_basis: "annual revenue",
    criminal_penalties: true,
    enforcement_body: "Ministry of Communication and Informatics",
    jurisdiction_display: "Indonesia",
  },
  BR: {
    max_fine_fixed: 10_000_000,          // R$50M ≈ $10M
    max_fine_percentage: 0.02,           // 2% revenue
    fine_basis: "company revenue",
    criminal_penalties: false,
    enforcement_body: "ANPD (National Data Protection Authority)",
    jurisdiction_display: "Brazil",
  },
  SG: {
    max_fine_fixed: null,
    max_fine_percentage: null,
    fine_basis: "voluntary (no penalties)",
    criminal_penalties: false,
    enforcement_body: "IMDA (voluntary)",
    jurisdiction_display: "Singapore",
  },
  GB: {
    max_fine_fixed: null,
    max_fine_percentage: null,
    fine_basis: "voluntary currently (AI Bill expected May 2026)",
    criminal_penalties: false,
    enforcement_body: "Sector regulators (FCA, ICO, etc.)",
    jurisdiction_display: "United Kingdom",
  },
  CA: {
    max_fine_fixed: null,
    max_fine_percentage: null,
    fine_basis: "no AI legislation (AIDA died)",
    criminal_penalties: false,
    enforcement_body: "N/A (bill died)",
    jurisdiction_display: "Canada",
  },
  INTL: {
    max_fine_fixed: null,
    max_fine_percentage: null,
    fine_basis: "voluntary (OECD principles)",
    criminal_penalties: false,
    enforcement_body: "N/A (non-binding)",
    jurisdiction_display: "International (OECD)",
  },
};

/* ------------------------------------------------------------------ */
/* Cost Estimation Logic                                               */
/* ------------------------------------------------------------------ */

const REMEDIATION_COST: Record<string, number> = {
  critical: 15_000,
  high: 10_000,
  medium: 5_000,
  low: 1_000,
  info: 0,
};

export interface JurisdictionCostBreakdown {
  jurisdiction: string;
  jurisdiction_display: string;
  max_fine_fixed: number;
  max_fine_percentage_based: number;
  max_penalty: number;
  remediation_cost: number;
  finding_count: number;
  has_criminal: boolean;
  fine_basis: string;
  enforcement_body: string;
}

export interface CostEstimate {
  total_penalty_exposure: number;
  total_remediation_cost: number;
  jurisdictions_with_penalties: number;
  total_jurisdictions: number;
  has_criminal_risk: boolean;
  breakdown: JurisdictionCostBreakdown[];
  revenue_used: number | null;
}

/**
 * Estimate compliance costs from audit findings.
 * @param findings - Audit findings from an audit report
 * @param annualRevenue - Optional annual revenue for percentage-based calculations
 */
export function estimateCosts(
  findings: AuditFinding[],
  annualRevenue: number | null = null
): CostEstimate {
  // Group findings by jurisdiction
  const byJurisdiction: Record<string, AuditFinding[]> = {};
  for (const f of findings) {
    if (!byJurisdiction[f.jurisdiction]) byJurisdiction[f.jurisdiction] = [];
    byJurisdiction[f.jurisdiction].push(f);
  }

  const breakdown: JurisdictionCostBreakdown[] = [];
  let totalPenalty = 0;
  let totalRemediation = 0;
  let hasCriminal = false;

  for (const [jurisdiction, jFindings] of Object.entries(byJurisdiction)) {
    const penalty = penaltyData[jurisdiction];
    if (!penalty) continue;

    const fixedFine = penalty.max_fine_fixed ?? 0;
    const percentageFine =
      penalty.max_fine_percentage && annualRevenue
        ? annualRevenue * penalty.max_fine_percentage
        : 0;
    const maxPenalty = Math.max(fixedFine, percentageFine);

    const remediationCost = jFindings.reduce(
      (sum, f) => sum + (REMEDIATION_COST[f.severity] ?? 0),
      0
    );

    if (penalty.criminal_penalties) hasCriminal = true;

    breakdown.push({
      jurisdiction,
      jurisdiction_display: penalty.jurisdiction_display,
      max_fine_fixed: fixedFine,
      max_fine_percentage_based: percentageFine,
      max_penalty: maxPenalty,
      remediation_cost: remediationCost,
      finding_count: jFindings.length,
      has_criminal: penalty.criminal_penalties,
      fine_basis: penalty.fine_basis,
      enforcement_body: penalty.enforcement_body,
    });

    totalPenalty += maxPenalty;
    totalRemediation += remediationCost;
  }

  // Sort by max penalty descending
  breakdown.sort((a, b) => b.max_penalty - a.max_penalty);

  return {
    total_penalty_exposure: totalPenalty,
    total_remediation_cost: totalRemediation,
    jurisdictions_with_penalties: breakdown.filter((b) => b.max_penalty > 0).length,
    total_jurisdictions: breakdown.length,
    has_criminal_risk: hasCriminal,
    breakdown,
    revenue_used: annualRevenue,
  };
}

/**
 * Estimate maximum penalty exposure for a set of jurisdictions (no findings needed).
 * Used for the dashboard card.
 */
export function estimateMaxExposure(
  jurisdictions: string[],
  annualRevenue: number | null = null
): { total: number; jurisdictionsWithPenalties: number; hasCriminal: boolean } {
  let total = 0;
  let count = 0;
  let hasCriminal = false;

  for (const j of jurisdictions) {
    const penalty = penaltyData[j];
    if (!penalty) continue;

    const fixedFine = penalty.max_fine_fixed ?? 0;
    const percentageFine =
      penalty.max_fine_percentage && annualRevenue
        ? annualRevenue * penalty.max_fine_percentage
        : 0;
    const maxPenalty = Math.max(fixedFine, percentageFine);

    if (maxPenalty > 0) {
      total += maxPenalty;
      count++;
    }
    if (penalty.criminal_penalties) hasCriminal = true;
  }

  return { total, jurisdictionsWithPenalties: count, hasCriminal };
}

/**
 * Format a dollar amount compactly.
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  if (amount === 0) return "$0";
  return `$${amount.toLocaleString()}`;
}
