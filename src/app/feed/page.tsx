import { createAdminClient } from "@/lib/supabase/admin";
import { createServerComponentClient } from "@/lib/supabase/server";
import { FeedClient } from "@/components/feed/FeedClient";
import { computeVelocityScores } from "@/lib/utils/velocity";
import type { Regulation, RegulatoryUpdate } from "@/lib/types/regulation";
import type { WeeklyUpdate } from "@/components/feed/WeeklyUpdatesBanner";

export const dynamic = "force-dynamic";

interface FeedPageProps {
  searchParams: Promise<{
    jurisdiction?: string;
    status?: string;
    category?: string;
    search?: string;
    page?: string;
  }>;
}

async function getRegulations(params: {
  jurisdiction?: string;
  status?: string;
  category?: string;
  search?: string;
  page?: string;
}) {
  const supabase = createAdminClient();
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase.from("regulations").select("*", { count: "exact" });

  if (params.jurisdiction) {
    query = query.eq("jurisdiction", params.jurisdiction);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.category) {
    query = query.eq("category", params.category);
  }
  if (params.search) {
    const sanitized = params.search.replace(/[%_\\,().|]/g, "").slice(0, 200);
    if (sanitized) {
      query = query.or(
        `title.ilike.%${sanitized}%,summary.ilike.%${sanitized}%,jurisdiction_display.ilike.%${sanitized}%`
      );
    }
  }

  query = query.order("effective_date", { ascending: false, nullsFirst: false });
  query = query.range(offset, offset + limit - 1);

  const { data, count } = await query;

  return {
    regulations: (data || []) as Regulation[],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

async function getRecentUpdates() {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("regulatory_updates")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(10);

  return (data || []) as RegulatoryUpdate[];
}

async function getDistinctJurisdictions() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("regulations")
    .select("jurisdiction, jurisdiction_display");

  if (!data) return [];

  const seen = new Map<string, string>();
  for (const r of data) {
    if (!seen.has(r.jurisdiction)) {
      seen.set(r.jurisdiction, r.jurisdiction_display);
    }
  }

  return Array.from(seen.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function getFeedMeta() {
  const supabase = createAdminClient();
  const [lastRunRes, allRegsRes] = await Promise.all([
    // Use ingestion_logs to find when the pipeline last ran successfully
    supabase
      .from("ingestion_logs")
      .select("completed_at")
      .eq("source_name", "ingestion_run")
      .eq("status", "success")
      .order("completed_at", { ascending: false })
      .limit(1)
      .single(),
    supabase.from("regulations").select("status"),
  ]);

  const statusCounts: Record<string, number> = {};
  (allRegsRes.data ?? []).forEach((r: { status: string }) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  return {
    lastChecked: lastRunRes.data?.completed_at ?? null,
    statusCounts,
  };
}

async function getWeeklyUpdates(): Promise<{ updates: WeeklyUpdate[]; regIds: string[] }> {
  const supabase = createAdminClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data } = await supabase
    .from("regulatory_updates")
    .select("regulation_id, update_type, detected_at, title")
    .gte("detected_at", sevenDaysAgo.toISOString())
    .order("detected_at", { ascending: false })
    .limit(20);

  if (!data || data.length === 0) return { updates: [], regIds: [] };

  const regIds = [...new Set(data.map((u: { regulation_id: string }) => u.regulation_id))];

  const { data: regs } = await supabase
    .from("regulations")
    .select("id, title, jurisdiction_display")
    .in("id", regIds);

  const regMap = new Map(
    (regs || []).map((r: { id: string; title: string; jurisdiction_display: string }) => [r.id, r])
  );

  const updates: WeeklyUpdate[] = data.map(
    (u: { regulation_id: string; update_type: string; detected_at: string }) => {
      const reg = regMap.get(u.regulation_id);
      return {
        regulation_id: u.regulation_id,
        regulation_title: reg?.title || "Unknown",
        jurisdiction_display: reg?.jurisdiction_display || "Unknown",
        update_type: u.update_type,
        detected_at: u.detected_at,
      };
    }
  );

  return { updates, regIds };
}

async function getUserJurisdictions(): Promise<string[] | undefined> {
  try {
    const supabase = await createServerComponentClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("jurisdictions")
      .eq("id", user.id)
      .single();
    return (profile?.jurisdictions as string[]) || [];
  } catch {
    return undefined;
  }
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const [
    { regulations, total, page, totalPages },
    updates,
    velocityScores,
    jurisdictionOptions,
    feedMeta,
    weeklyData,
    userJurisdictions,
  ] = await Promise.all([
    getRegulations(params),
    getRecentUpdates(),
    computeVelocityScores(supabase),
    getDistinctJurisdictions(),
    getFeedMeta(),
    getWeeklyUpdates(),
    getUserJurisdictions(),
  ]);

  return (
    <FeedClient
      regulations={regulations}
      total={total}
      page={page}
      totalPages={totalPages}
      updates={updates}
      velocityScores={velocityScores}
      jurisdictionOptions={jurisdictionOptions}
      lastChecked={feedMeta.lastChecked}
      statusCounts={feedMeta.statusCounts}
      weeklyUpdates={weeklyData.updates}
      recentlyUpdatedRegIds={weeklyData.regIds}
      userJurisdictions={userJurisdictions}
    />
  );
}
