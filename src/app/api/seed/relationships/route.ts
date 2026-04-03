import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/auth/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { REGULATION_RELATIONSHIPS } from "@/lib/seed/regulation-relationships";

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createAdminClient();

  // Fetch all regulations to map titles to IDs
  const { data: regulations, error: regError } = await supabase
    .from("regulations")
    .select("id, title");

  if (regError || !regulations) {
    return NextResponse.json({ error: "Failed to fetch regulations" }, { status: 500 });
  }

  // Build title->id map (case-insensitive partial match)
  const titleMap = new Map<string, string>();
  for (const reg of regulations) {
    titleMap.set(reg.title.toLowerCase(), reg.id);
  }

  const findId = (title: string): string | null => {
    // Exact match first
    const exact = titleMap.get(title.toLowerCase());
    if (exact) return exact;
    // Partial match
    for (const [key, id] of titleMap) {
      if (key.includes(title.toLowerCase()) || title.toLowerCase().includes(key)) {
        return id;
      }
    }
    return null;
  };

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const rel of REGULATION_RELATIONSHIPS) {
    const sourceId = findId(rel.source_title);
    const targetId = findId(rel.target_title);

    if (!sourceId) {
      errors.push(`Source not found: "${rel.source_title}"`);
      skipped++;
      continue;
    }
    if (!targetId) {
      errors.push(`Target not found: "${rel.target_title}"`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from("regulation_relationships")
      .upsert(
        {
          source_regulation_id: sourceId,
          target_regulation_id: targetId,
          relationship_type: rel.relationship_type,
          description: rel.description,
          strength: rel.strength,
        },
        { onConflict: "source_regulation_id,target_regulation_id,relationship_type" }
      );

    if (error) {
      errors.push(`Insert failed: ${rel.source_title} → ${rel.target_title}: ${error.message}`);
      skipped++;
    } else {
      inserted++;
    }
  }

  return NextResponse.json({
    status: "completed",
    total: REGULATION_RELATIONSHIPS.length,
    inserted,
    skipped,
    errors: errors.slice(0, 20),
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
