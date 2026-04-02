import { batchEmbed } from "./embeddings";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SearchResult {
  id: string;
  chunk_text: string;
  chunk_type: string;
  regulation_id: string;
  similarity: number;
  metadata: Record<string, unknown>;
  title: string;
  jurisdiction: string;
  jurisdiction_display: string;
  source_url: string;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  jurisdictions?: string[];
  chunk_types?: string[];
}

export async function semanticSearch(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const [queryEmbedding] = await batchEmbed([query]);
  const supabase = createAdminClient();

  const { data: matches, error: rpcError } = await supabase.rpc(
    "match_regulations",
    {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: options?.threshold ?? 0.7,
      match_count: options?.limit ?? 8,
      filter_jurisdictions: options?.jurisdictions ?? null,
      filter_chunk_types: options?.chunk_types ?? null,
    }
  );

  if (rpcError) {
    console.error("[search] RPC error:", rpcError.message);
    throw new Error(`Semantic search failed: ${rpcError.message}`);
  }

  if (!matches || matches.length === 0) return [];

  // Get unique regulation IDs and fetch their details
  const regulationIds = [
    ...new Set(matches.map((m: { regulation_id: string }) => m.regulation_id)),
  ];

  const { data: regulations, error: regError } = await supabase
    .from("regulations")
    .select("id, title, jurisdiction, jurisdiction_display, source_url")
    .in("id", regulationIds);

  if (regError) {
    console.error("[search] Regulation fetch error:", regError.message);
    throw new Error(`Failed to fetch regulation details: ${regError.message}`);
  }

  const regMap = new Map(
    (regulations || []).map((r: { id: string; title: string; jurisdiction: string; jurisdiction_display: string; source_url: string }) => [r.id, r])
  );

  return matches.map(
    (match: {
      id: string;
      regulation_id: string;
      chunk_text: string;
      chunk_type: string;
      similarity: number;
      metadata: Record<string, unknown>;
    }) => {
      const reg = regMap.get(match.regulation_id) || {
        title: "Unknown",
        jurisdiction: "Unknown",
        jurisdiction_display: "Unknown",
        source_url: "",
      };
      return {
        id: match.id,
        chunk_text: match.chunk_text,
        chunk_type: match.chunk_type,
        regulation_id: match.regulation_id,
        similarity: match.similarity,
        metadata: match.metadata,
        title: reg.title,
        jurisdiction: reg.jurisdiction,
        jurisdiction_display: reg.jurisdiction_display,
        source_url: reg.source_url,
      };
    }
  );
}
