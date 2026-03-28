import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedRegulations, seedUpdates } from "@/lib/seed/regulations";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Get existing regulation titles for dedup
    const { data: existingRegs } = await supabase
      .from("regulations")
      .select("id, title");

    const existingTitleMap = new Map(
      (existingRegs ?? []).map((r) => [r.title.toLowerCase(), r.id])
    );

    let created = 0;
    let skipped = 0;
    const insertedRegulations: { id: string; title: string }[] = [];

    // Insert regulations (skip duplicates by title)
    for (const reg of seedRegulations) {
      const existingId = existingTitleMap.get(reg.title.toLowerCase());
      if (existingId) {
        insertedRegulations.push({ id: existingId, title: reg.title });
        skipped++;
        continue;
      }

      const { data: inserted, error } = await supabase
        .from("regulations")
        .insert({
          title: reg.title,
          jurisdiction: reg.jurisdiction,
          jurisdiction_display: reg.jurisdiction_display,
          status: reg.status,
          category: reg.category,
          summary: reg.summary,
          key_requirements: reg.key_requirements,
          compliance_implications: reg.compliance_implications,
          effective_date: reg.effective_date,
          source_url: reg.source_url,
          source_name: reg.source_name,
          ai_classified: reg.ai_classified,
          ai_confidence: reg.ai_confidence,
          last_verified_at: new Date().toISOString(),
        })
        .select("id, title")
        .single();

      if (error) {
        console.error(`Failed to insert "${reg.title}":`, error.message);
        insertedRegulations.push({ id: "", title: reg.title });
        skipped++;
      } else {
        insertedRegulations.push(inserted);
        created++;
      }
    }

    // Insert regulatory updates
    let updatesCreated = 0;
    for (const update of seedUpdates) {
      const regRef = insertedRegulations[update.regulation_index];
      if (!regRef?.id) continue;

      // Check if update already exists by title
      const { count } = await supabase
        .from("regulatory_updates")
        .select("*", { count: "exact", head: true })
        .eq("title", update.title);

      if (count && count > 0) continue;

      const { error } = await supabase
        .from("regulatory_updates")
        .insert({
          regulation_id: regRef.id,
          update_type: update.update_type,
          title: update.title,
          summary: update.summary,
          source_url: update.source_url,
          verified: update.verified,
          verified_by: update.verified_by,
          verified_at: update.verified ? new Date().toISOString() : null,
          detected_at: new Date().toISOString(),
        });

      if (!error) updatesCreated++;
    }

    return NextResponse.json({
      message: "Seed completed",
      regulations_created: created,
      regulations_skipped: skipped,
      regulations_total: seedRegulations.length,
      updates_created: updatesCreated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
