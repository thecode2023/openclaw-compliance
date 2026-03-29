import Parser from "rss-parser";
import type { SupabaseClient } from "@supabase/supabase-js";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "Complyze-Regulatory-Intelligence/1.0",
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml",
  },
});

export interface RSSFeedItem {
  title: string;
  link: string;
  contentSnippet: string;
  pubDate: string;
  source: string;
}

export interface RSSSource {
  name: string;
  url: string;
  category: string;
}

export interface FeedResult {
  items: RSSFeedItem[];
  errors: { source: string; error: string }[];
}

/**
 * Fetch feed sources from the database. Falls back to hardcoded list if DB unavailable.
 */
export async function getFeedSources(supabase: SupabaseClient): Promise<RSSSource[]> {
  const { data, error } = await supabase
    .from("feed_sources")
    .select("name, url, category")
    .eq("enabled", true);

  if (error || !data || data.length === 0) {
    // Fallback to hardcoded feeds if DB query fails
    console.warn("[RSS] Failed to load feed sources from DB, using fallback");
    return [
      { name: "Federal Register — AI and Technology", url: "https://www.federalregister.gov/api/v1/documents.rss?conditions%5Btopic_ids%5D%5B%5D=artificial-intelligence", category: "US Federal" },
      { name: "EUR-Lex — Parliament and Council Legislation", url: "https://eur-lex.europa.eu/EN/display-feed.rss?rssId=162", category: "EU" },
      { name: "EUR-Lex — Commission Proposals", url: "https://eur-lex.europa.eu/EN/display-feed.rss?rssId=161", category: "EU" },
    ];
  }

  return data;
}

export async function fetchRSSFeed(source: RSSSource): Promise<RSSFeedItem[]> {
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).slice(0, 10).map((item) => ({
      title: String(item.title || "Untitled"),
      link: String(item.link || ""),
      contentSnippet: String(item.contentSnippet || item.content || ""),
      pubDate: String(item.pubDate || new Date().toISOString()),
      source: source.name,
    }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[RSS] Failed to fetch "${source.name}" (${source.url}): ${msg}`);
    return [];
  }
}

/**
 * Update feed source status in the database after fetch attempt.
 */
export async function updateFeedStatus(
  supabase: SupabaseClient,
  url: string,
  success: boolean,
  error?: string
) {
  if (success) {
    await supabase
      .from("feed_sources")
      .update({
        last_fetched_at: new Date().toISOString(),
        last_error: null,
        consecutive_failures: 0,
      })
      .eq("url", url);
  } else {
    // Increment failures, auto-disable after 5 consecutive
    const { data } = await supabase
      .from("feed_sources")
      .select("consecutive_failures")
      .eq("url", url)
      .single();

    const failures = (data?.consecutive_failures ?? 0) + 1;
    await supabase
      .from("feed_sources")
      .update({
        last_error: error ?? "Unknown error",
        consecutive_failures: failures,
        enabled: failures < 5,
      })
      .eq("url", url);
  }
}

export async function fetchAllRSSFeeds(supabase: SupabaseClient): Promise<FeedResult> {
  const sources = await getFeedSources(supabase);
  const errors: { source: string; error: string }[] = [];

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      try {
        const items = await fetchRSSFeed(source);
        await updateFeedStatus(supabase, source.url, items.length > 0, items.length === 0 ? "No items returned" : undefined);
        if (items.length === 0) {
          errors.push({ source: source.name, error: "No items returned" });
        }
        return items;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ source: source.name, error: msg });
        await updateFeedStatus(supabase, source.url, false, msg);
        return [];
      }
    })
  );

  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  const successCount = results.filter(
    (r) => r.status === "fulfilled" && r.value.length > 0
  ).length;
  console.log(
    `[RSS] Fetched ${items.length} items from ${successCount}/${sources.length} feeds` +
    (errors.length > 0 ? ` (${errors.length} failed)` : "")
  );

  return { items, errors };
}
