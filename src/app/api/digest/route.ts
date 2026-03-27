import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerComponentClient } from "@/lib/supabase/server";
import { callGeminiWithRetry } from "@/lib/ai/client";
import { subDays, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

interface DigestUser {
  id: string;
  display_name: string | null;
  industry: string | null;
  jurisdictions: string[];
  ai_use_cases: string[];
}

async function generateDigestForUser(
  supabase: SupabaseClient,
  user: DigestUser,
  periodStart: string,
  periodEnd: string,
  now: Date
): Promise<{ briefing: string; updates_count: number }> {
  const { data: allUpdates } = await supabase
    .from("regulatory_updates")
    .select("*, regulations!inner(jurisdiction, jurisdiction_display, title)")
    .gte("detected_at", periodStart);

  const relevantUpdates = (allUpdates ?? []).filter((u) => {
    const reg = u.regulations as { jurisdiction: string } | null;
    return reg && user.jurisdictions.includes(reg.jurisdiction);
  });

  if (relevantUpdates.length === 0) {
    const digestContent = {
      briefing: "No regulatory changes affecting your profile this week. All monitored jurisdictions remain stable — a good time to review existing compliance documentation or run a proactive audit.",
      updates_count: 0,
      period_label: `${format(subDays(now, 7), "MMM d")}–${format(now, "MMM d, yyyy")}`,
    };
    await supabase.from("weekly_digests").insert({
      user_id: user.id,
      digest_content: digestContent,
      period_start: periodStart,
      period_end: periodEnd,
    });
    return { briefing: digestContent.briefing, updates_count: 0 };
  }

  const updateSummaries = relevantUpdates.map((u) => {
    const reg = u.regulations as {
      jurisdiction: string;
      jurisdiction_display: string;
      title: string;
    };
    return `- [${reg.jurisdiction_display}] ${reg.title}: ${u.title} — ${u.summary}`;
  });

  const industryLabel = user.industry ?? "technology";
  const jurisdictionNames = user.jurisdictions.join(", ");

  const prompt = `You are a regulatory intelligence analyst. Synthesize the following regulatory updates into a concise executive briefing for a ${industryLabel} company operating in ${jurisdictionNames}.

Updates from the past week:
${updateSummaries.join("\n")}

Format:
- Lead with the single most important change
- For each update, explain: what changed, why it matters for their industry, and what action they should take
- Close with a 1-sentence outlook for the coming week
- Keep the total briefing under 300 words
- Write for a VP of Compliance audience — clear, direct, no jargon

CRITICAL: Only reference regulations that appear in the provided updates. Do not invent or hallucinate regulatory information.`;

  const briefing = await callGeminiWithRetry(prompt);
  const trimmedBriefing = briefing.trim();

  const digestContent = {
    briefing: trimmedBriefing,
    updates_count: relevantUpdates.length,
    period_label: `${format(subDays(now, 7), "MMM d")}–${format(now, "MMM d, yyyy")}`,
  };

  await supabase.from("weekly_digests").insert({
    user_id: user.id,
    digest_content: digestContent,
    period_start: periodStart,
    period_end: periodEnd,
  });

  return { briefing: trimmedBriefing, updates_count: relevantUpdates.length };
}

// POST: Generate weekly digests
// ?test=true → generate for current authenticated user only (dev/testing)
// Otherwise → generate for all onboarded users (requires CRON_SECRET)
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const isTestMode = url.searchParams.get("test") === "true";

  if (isTestMode) {
    const authSupabase = await createServerComponentClient();
    const {
      data: { user: authUser },
    } = await authSupabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const periodEnd = format(now, "yyyy-MM-dd");
    const periodStart = format(subDays(now, 7), "yyyy-MM-dd");

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, display_name, industry, jurisdictions, ai_use_cases")
      .eq("id", authUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    try {
      const digest = await generateDigestForUser(supabase, profile, periodStart, periodEnd, now);
      return NextResponse.json({ status: "completed", digest });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Production mode
  const cronSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const periodEnd = format(now, "yyyy-MM-dd");
  const periodStart = format(subDays(now, 7), "yyyy-MM-dd");

  const { data: users, error: usersError } = await supabase
    .from("user_profiles")
    .select("id, display_name, industry, jurisdictions, ai_use_cases")
    .eq("onboarded", true);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  let digestsGenerated = 0;
  let digestsSkipped = 0;

  for (const user of users ?? []) {
    try {
      await generateDigestForUser(supabase, user, periodStart, periodEnd, now);
      digestsGenerated++;
    } catch (err) {
      console.error(`Digest generation failed for user ${user.id}:`, err);
      digestsSkipped++;
    }
  }

  return NextResponse.json({
    status: "completed",
    period: { start: periodStart, end: periodEnd },
    users_processed: (users ?? []).length,
    digests_generated: digestsGenerated,
    digests_skipped: digestsSkipped,
  });
}

// GET: Returns the authenticated user's most recent digest
export async function GET() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: digest, error } = await supabase
    .from("weekly_digests")
    .select("*")
    .eq("user_id", user.id)
    .order("period_end", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json(digest);
}
