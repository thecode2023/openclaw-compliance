import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { chunkRegulation, embedChunks } from "../src/lib/ai/embeddings";
import type { Regulation } from "../src/lib/types/regulation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const entries = JSON.parse(
    readFileSync("regulation_entries.json", "utf-8")
  );

  console.log(`Inserting ${entries.length} regulations...`);

  // Insert regulations, returning the generated IDs
  const { data: inserted, error: insertError } = await supabase
    .from("regulations")
    .insert(
      entries.map((e: Record<string, unknown>) => ({
        title: e.title,
        jurisdiction: e.jurisdiction,
        jurisdiction_display: e.jurisdiction_display,
        status: e.status,
        category: e.category,
        summary: e.summary,
        key_requirements: e.key_requirements,
        compliance_implications: e.compliance_implications,
        effective_date: e.effective_date,
        source_url: e.source_url,
        source_name: e.source_name,
        ai_classified: e.ai_classified,
        ai_confidence: e.ai_confidence,
        last_verified_at: new Date().toISOString(),
      }))
    )
    .select("*");

  if (insertError) {
    console.error("Insert error:", insertError.message);
    process.exit(1);
  }

  console.log(`Inserted ${inserted!.length} regulations:`);
  for (const reg of inserted!) {
    console.log(`  ${reg.id} — ${reg.title}`);
  }

  // Generate embeddings for just the new regulations
  console.log("\nGenerating embeddings...");
  const allChunks = [];
  for (const reg of inserted as Regulation[]) {
    const chunks = chunkRegulation(reg, []);
    allChunks.push(...chunks);
  }

  console.log(`Chunked into ${allChunks.length} chunks, embedding...`);
  const embedded = await embedChunks(allChunks);

  // Upsert in batches
  const BATCH = 50;
  let upserted = 0;
  for (let i = 0; i < embedded.length; i += BATCH) {
    const batch = embedded.slice(i, i + BATCH);
    const rows = batch.map((c) => ({
      regulation_id: c.regulation_id,
      chunk_index: c.chunk_index,
      chunk_text: c.chunk_text,
      chunk_type: c.chunk_type,
      embedding: JSON.stringify(c.embedding),
      metadata: c.metadata,
    }));

    const { error } = await supabase
      .from("regulation_embeddings")
      .upsert(rows, { onConflict: "regulation_id,chunk_index" });

    if (error) {
      console.error(`Upsert batch error:`, error.message);
    } else {
      upserted += batch.length;
    }
  }

  console.log(`Upserted ${upserted} embeddings.`);

  // Verify total regulation count
  const { count, error: countError } = await supabase
    .from("regulations")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Count error:", countError.message);
  } else {
    console.log(`\nTotal regulations: ${count}`);
    if (count === 80) {
      console.log("✓ Verified: 80 regulations");
    } else {
      console.log(`✗ Expected 80, got ${count}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
