import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/auth/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeUrl } from "@/lib/firecrawl/client";
import { parseLegislativeText } from "@/lib/firecrawl/legislative-parser";
import { embedChunks, type EmbeddingChunk } from "@/lib/ai/embeddings";

// Top 5 priority regulations for full-text ingestion
const PRIORITY_REGULATIONS = [
  "EU Artificial Intelligence Act (Regulation 2024/1689)",
  "EU General Data Protection Regulation (GDPR) — AI Provisions",
  "EU Digital Operational Resilience Act (DORA)",
  "Colorado AI Act (SB 24-205)",
  "NIST AI Risk Management Framework (AI RMF 1.0)",
];

const LEGISLATIVE_CHUNK_OFFSET = 1000;
const UPSERT_BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const startTime = Date.now();

  // Accept optional regulation_ids in body
  let targetIds: string[] | null = null;
  try {
    const body = await request.json().catch(() => null);
    if (body?.regulation_ids?.length > 0) {
      targetIds = body.regulation_ids;
    }
  } catch {
    // No body — use priority list
  }

  let regulationsProcessed = 0;
  let totalChunks = 0;
  let totalEmbeddings = 0;
  let creditsUsed = 0;
  const errors: string[] = [];

  try {
    // Get target regulations
    let regulations;
    if (targetIds) {
      const { data } = await supabase
        .from("regulations")
        .select("id, title, jurisdiction, jurisdiction_display, category")
        .in("id", targetIds);
      regulations = data;
    } else {
      // Match priority titles
      const { data: allRegs } = await supabase
        .from("regulations")
        .select("id, title, jurisdiction, jurisdiction_display, category");

      regulations = (allRegs || []).filter((r: { title: string }) =>
        PRIORITY_REGULATIONS.some(
          (p) => r.title.toLowerCase() === p.toLowerCase() || r.title.includes(p) || p.includes(r.title)
        )
      );
    }

    if (!regulations || regulations.length === 0) {
      return NextResponse.json({ status: "completed", message: "No matching regulations found" });
    }

    // Get scrape source URLs
    const regIds = regulations.map((r: { id: string }) => r.id);
    const { data: scrapeSources } = await supabase
      .from("scrape_sources")
      .select("regulation_id, url")
      .in("regulation_id", regIds);

    const sourceUrlMap = new Map(
      (scrapeSources || []).map((s: { regulation_id: string; url: string }) => [s.regulation_id, s.url])
    );

    for (const reg of regulations as { id: string; title: string; jurisdiction: string; jurisdiction_display: string; category: string }[]) {
      const sourceUrl = sourceUrlMap.get(reg.id);
      if (!sourceUrl) {
        errors.push(`No scrape source for: ${reg.title}`);
        continue;
      }

      console.log(`[fulltext] Scraping: ${reg.title}`);
      creditsUsed++;

      // Scrape the full text
      const result = await scrapeUrl({
        url: sourceUrl,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 60000,
      });

      if (!result.success || !result.data?.markdown) {
        errors.push(`Scrape failed for ${reg.title}: ${result.error || "No content"}`);
        continue;
      }

      const fullText = result.data.markdown;

      // Store full text on the regulation
      await supabase
        .from("regulations")
        .update({
          full_text_markdown: fullText.slice(0, 500000),
          full_text_source: sourceUrl,
          full_text_scraped_at: new Date().toISOString(),
        })
        .eq("id", reg.id);

      // Parse into legislative chunks
      const legislativeChunks = parseLegislativeText(
        fullText,
        reg.title,
        reg.jurisdiction,
        reg.category
      );

      if (legislativeChunks.length === 0) {
        errors.push(`No chunks parsed for ${reg.title} (parser returned empty)`);
        continue;
      }

      console.log(`[fulltext] Parsed ${legislativeChunks.length} chunks from ${reg.title}`);

      // Convert to EmbeddingChunks with offset indices
      const embeddingChunks: EmbeddingChunk[] = legislativeChunks.map((lc, i) => ({
        regulation_id: reg.id,
        chunk_index: LEGISLATIVE_CHUNK_OFFSET + i,
        chunk_text: lc.chunk_text,
        chunk_type: lc.chunk_type,
        metadata: {
          regulation_id: reg.id,
          title: reg.title,
          jurisdiction: reg.jurisdiction,
          jurisdiction_display: reg.jurisdiction_display,
          chunk_reference: lc.chunk_reference,
          chunk_title: lc.chunk_title,
          hierarchy_path: lc.hierarchy_path,
          parent_reference: lc.parent_reference,
        },
      }));

      totalChunks += embeddingChunks.length;

      // Embed all chunks
      try {
        const embedded = await embedChunks(embeddingChunks);

        // Upsert in batches
        for (let i = 0; i < embedded.length; i += UPSERT_BATCH_SIZE) {
          const batch = embedded.slice(i, i + UPSERT_BATCH_SIZE);
          const rows = batch.map((chunk) => ({
            regulation_id: chunk.regulation_id,
            chunk_index: chunk.chunk_index,
            chunk_text: chunk.chunk_text,
            chunk_type: chunk.chunk_type,
            embedding: JSON.stringify(chunk.embedding),
            metadata: chunk.metadata,
          }));

          const { error: upsertError } = await supabase
            .from("regulation_embeddings")
            .upsert(rows, { onConflict: "regulation_id,chunk_index" });

          if (upsertError) {
            errors.push(`Upsert error for ${reg.title}: ${upsertError.message}`);
          } else {
            totalEmbeddings += batch.length;
          }
        }

        // Clean up stale legislative chunks for this regulation
        const maxNewIndex = LEGISLATIVE_CHUNK_OFFSET + embeddingChunks.length;
        await supabase
          .from("regulation_embeddings")
          .delete()
          .eq("regulation_id", reg.id)
          .gte("chunk_index", maxNewIndex)
          .lt("chunk_index", 100000); // Only delete legislative-range chunks

        regulationsProcessed++;
        console.log(`[fulltext] Embedded ${embedded.length} chunks for ${reg.title}`);
      } catch (embedError) {
        errors.push(
          `Embedding failed for ${reg.title}: ${embedError instanceof Error ? embedError.message : "Unknown"}`
        );
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      status: "completed",
      regulations_processed: regulationsProcessed,
      chunks_created: totalChunks,
      embeddings_generated: totalEmbeddings,
      credits_used: creditsUsed,
      elapsed_seconds: elapsed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[fulltext] Pipeline error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Full-text pipeline failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
