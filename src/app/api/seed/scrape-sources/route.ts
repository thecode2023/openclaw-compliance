import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/auth/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { SCRAPE_SOURCES } from "@/lib/seed/scrape-sources";

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createAdminClient();

  const { data: regulations, error: regError } = await supabase
    .from("regulations")
    .select("id, title");

  if (regError || !regulations) {
    return NextResponse.json({ error: "Failed to fetch regulations" }, { status: 500 });
  }

  // Build title lookup maps
  const exactMap = new Map<string, string>();
  const lowerMap = new Map<string, string>();
  for (const reg of regulations) {
    exactMap.set(reg.title, reg.id);
    lowerMap.set(reg.title.toLowerCase(), reg.id);
  }

  const findId = (title: string): string | null => {
    if (exactMap.has(title)) return exactMap.get(title)!;
    const lower = title.toLowerCase();
    if (lowerMap.has(lower)) return lowerMap.get(lower)!;
    for (const [dbLower, id] of lowerMap) {
      if (dbLower.includes(lower) || lower.includes(dbLower)) return id;
    }
    const seedWords = lower.split(/[\s\-—()/,]+/).filter((w) => w.length > 3);
    for (const [dbLower, id] of lowerMap) {
      const matchCount = seedWords.filter((w) => dbLower.includes(w)).length;
      if (matchCount >= 3) return id;
    }
    return null;
  };

  // Clear existing seed data and re-insert fresh
  await supabase.from("scrape_sources").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const source of SCRAPE_SOURCES) {
    const regId = findId(source.regulation_title);

    if (!regId) {
      errors.push(`Not found: "${source.regulation_title}"`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from("scrape_sources")
      .insert({
        regulation_id: regId,
        url: source.url,
        source_name: source.source_name,
        scrape_type: source.scrape_type,
        enabled: true,
      });

    if (error) {
      errors.push(`Insert failed: ${source.regulation_title}: ${error.message}`);
      skipped++;
    } else {
      inserted++;
    }
  }

  return NextResponse.json({
    status: "completed",
    total: SCRAPE_SOURCES.length,
    inserted,
    skipped,
    errors: errors.slice(0, 20),
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
