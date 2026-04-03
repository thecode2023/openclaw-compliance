import type { PolicyDocument } from "@/lib/types/policy";

export interface CoverageItem {
  regulation_id: string;
  regulation_title: string;
  jurisdiction: string;
  jurisdiction_display: string;
  has_policy: boolean;
  policy_count: number;
  policy_statuses: string[];
  policy_titles: string[];
}

export interface CoverageReport {
  total: number;
  covered: number;
  percentage: number;
  items: CoverageItem[];
}

export function computeCoverage(
  regulations: { id: string; title: string; jurisdiction: string; jurisdiction_display: string }[],
  policies: PolicyDocument[],
  userJurisdictions: string[]
): CoverageReport {
  // Filter regulations to user's tracked jurisdictions
  const tracked = regulations.filter((r) =>
    userJurisdictions.includes(r.jurisdiction)
  );

  // Build a map of regulation_id -> policies
  const policyByRegId = new Map<string, PolicyDocument[]>();
  for (const p of policies) {
    if (p.regulation_id) {
      const existing = policyByRegId.get(p.regulation_id) || [];
      existing.push(p);
      policyByRegId.set(p.regulation_id, existing);
    }
  }

  // Also check policy metadata for regulation references
  for (const p of policies) {
    const meta = p.metadata as Record<string, unknown> | null;
    if (meta?.regulation_ids && Array.isArray(meta.regulation_ids)) {
      for (const regId of meta.regulation_ids as string[]) {
        const existing = policyByRegId.get(regId) || [];
        if (!existing.some((e) => e.id === p.id)) {
          existing.push(p);
          policyByRegId.set(regId, existing);
        }
      }
    }
  }

  const items: CoverageItem[] = tracked.map((reg) => {
    const regPolicies = policyByRegId.get(reg.id) || [];
    return {
      regulation_id: reg.id,
      regulation_title: reg.title,
      jurisdiction: reg.jurisdiction,
      jurisdiction_display: reg.jurisdiction_display,
      has_policy: regPolicies.length > 0,
      policy_count: regPolicies.length,
      policy_statuses: regPolicies.map((p) => p.status),
      policy_titles: regPolicies.map((p) => p.title),
    };
  });

  const covered = items.filter((i) => i.has_policy).length;

  return {
    total: items.length,
    covered,
    percentage: items.length > 0 ? Math.round((covered / items.length) * 100) : 0,
    items: items.sort((a, b) => {
      // Gaps first, then covered
      if (a.has_policy !== b.has_policy) return a.has_policy ? 1 : -1;
      return a.regulation_title.localeCompare(b.regulation_title);
    }),
  };
}
