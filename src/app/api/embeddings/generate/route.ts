import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/auth/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  chunkRegulation,
  embedChunks,
  type EmbeddingChunk,
} from "@/lib/ai/embeddings";
import type { Regulation, RegulatoryUpdate } from "@/lib/types/regulation";

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const startTime = Date.now();

  try {
    // Fetch all regulations
    const { data: regulations, error: regError } = await supabase
      .from("regulations")
      .select("*");

    if (regError) throw new Error(`Failed to fetch regulations: ${regError.message}`);
    if (!regulations || regulations.length === 0) {
      return NextResponse.json({ status: "completed", message: "No regulations found" });
    }

    // Fetch all regulatory updates
    const { data: updates, error: updError } = await supabase
      .from("regulatory_updates")
      .select("*");

    if (updError) throw new Error(`Failed to fetch updates: ${updError.message}`);

    // Group updates by regulation_id
    const updatesByRegulation = new Map<string, RegulatoryUpdate[]>();
    for (const update of updates || []) {
      const existing = updatesByRegulation.get(update.regulation_id) || [];
      existing.push(update as RegulatoryUpdate);
      updatesByRegulation.set(update.regulation_id, existing);
    }

    // Chunk all regulations
    const allChunks: EmbeddingChunk[] = [];
    for (const reg of regulations as Regulation[]) {
      const regUpdates = updatesByRegulation.get(reg.id) || [];
      const chunks = chunkRegulation(reg, regUpdates);
      allChunks.push(...chunks);
    }

    console.log(
      `[embeddings] Chunked ${regulations.length} regulations into ${allChunks.length} chunks`
    );

    // Embed all chunks
    const embeddedChunks = await embedChunks(allChunks);

    console.log(`[embeddings] Generated ${embeddedChunks.length} embeddings`);

    // Upsert into regulation_embeddings in batches
    const UPSERT_BATCH_SIZE = 50;
    let upsertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < embeddedChunks.length; i += UPSERT_BATCH_SIZE) {
      const batch = embeddedChunks.slice(i, i + UPSERT_BATCH_SIZE);
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
        console.error(`[embeddings] Upsert batch error:`, upsertError.message);
        errorCount += batch.length;
      } else {
        upsertedCount += batch.length;
      }
    }

    // Clean up stale embeddings for each regulation
    const chunkCountByRegulation = new Map<string, number>();
    for (const chunk of allChunks) {
      const current = chunkCountByRegulation.get(chunk.regulation_id) || 0;
      chunkCountByRegulation.set(
        chunk.regulation_id,
        Math.max(current, chunk.chunk_index + 1)
      );
    }

    for (const [regId, maxIndex] of chunkCountByRegulation) {
      await supabase
        .from("regulation_embeddings")
        .delete()
        .eq("regulation_id", regId)
        .gte("chunk_index", maxIndex);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      status: "completed",
      regulations_processed: regulations.length,
      chunks_generated: allChunks.length,
      embeddings_upserted: upsertedCount,
      errors: errorCount,
      elapsed_seconds: elapsed,
    });
  } catch (error) {
    console.error("[embeddings] Pipeline error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
