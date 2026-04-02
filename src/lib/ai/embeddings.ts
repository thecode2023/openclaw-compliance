import { genAI } from "./client";
import type { Regulation, RegulatoryUpdate } from "@/lib/types/regulation";

const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

export interface EmbeddingChunk {
  regulation_id: string;
  chunk_index: number;
  chunk_text: string;
  chunk_type: string;
  metadata: Record<string, unknown>;
}

function buildHeader(reg: Regulation): string {
  return `[${reg.title} | ${reg.jurisdiction_display} | ${reg.status}]`;
}

export function chunkRegulation(
  regulation: Regulation,
  updates: RegulatoryUpdate[]
): EmbeddingChunk[] {
  const chunks: EmbeddingChunk[] = [];
  const header = buildHeader(regulation);
  const meta = {
    regulation_id: regulation.id,
    title: regulation.title,
    jurisdiction: regulation.jurisdiction,
    jurisdiction_display: regulation.jurisdiction_display,
    source_url: regulation.source_url,
  };
  let index = 0;

  // Summary chunk
  chunks.push({
    regulation_id: regulation.id,
    chunk_index: index++,
    chunk_text: `${header}\nSummary: ${regulation.summary}`,
    chunk_type: "summary",
    metadata: meta,
  });

  // Key requirement chunks
  for (const req of regulation.key_requirements) {
    chunks.push({
      regulation_id: regulation.id,
      chunk_index: index++,
      chunk_text: `${header}\nKey Requirement: ${req}`,
      chunk_type: "key_requirement",
      metadata: meta,
    });
  }

  // Compliance implication chunks
  for (const impl of regulation.compliance_implications) {
    chunks.push({
      regulation_id: regulation.id,
      chunk_index: index++,
      chunk_text: `${header}\nCompliance Implication: ${impl}`,
      chunk_type: "compliance_implication",
      metadata: meta,
    });
  }

  // Penalty info chunk (synthesized)
  if (regulation.compliance_implications.length > 0) {
    chunks.push({
      regulation_id: regulation.id,
      chunk_index: index++,
      chunk_text: `${header}\nPenalty and Enforcement Information:\n- ${regulation.compliance_implications.join("\n- ")}`,
      chunk_type: "penalty_info",
      metadata: meta,
    });
  }

  // Update summary chunks
  for (const update of updates) {
    chunks.push({
      regulation_id: regulation.id,
      chunk_index: index++,
      chunk_text: `${header}\nRegulatory Update (${update.update_type}): ${update.title}\n${update.summary}`,
      chunk_type: "update_summary",
      metadata: meta,
    });
  }

  return chunks;
}

export async function batchEmbed(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await embeddingModel.batchEmbedContents({
          requests: batch.map((text) => ({
            content: { parts: [{ text }], role: "user" },
          })),
        });
        allEmbeddings.push(
          ...result.embeddings.map((e) => e.values)
        );
        lastError = null;
        break;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(String(error));
        if (
          lastError.message.includes("400") ||
          lastError.message.includes("401") ||
          lastError.message.includes("403")
        ) {
          throw lastError;
        }
        if (attempt < 2) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    if (lastError) throw lastError;
  }

  return allEmbeddings;
}

export async function embedChunks(
  chunks: EmbeddingChunk[]
): Promise<(EmbeddingChunk & { embedding: number[] })[]> {
  const texts = chunks.map((c) => c.chunk_text);
  const embeddings = await batchEmbed(texts);
  return chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i] }));
}
