import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "Complyze-Regulatory-Intelligence/1.0",
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

export const rssSources: RSSSource[] = [
  {
    name: "Federal Register — AI and Technology",
    url: "https://www.federalregister.gov/api/v1/documents.rss?conditions%5Btopic_ids%5D%5B%5D=artificial-intelligence",
    category: "US Federal",
  },
  {
    name: "EUR-Lex — Parliament and Council Legislation",
    url: "https://eur-lex.europa.eu/EN/display-feed.rss?rssId=162",
    category: "EU",
  },
  {
    name: "EUR-Lex — Commission Proposals",
    url: "https://eur-lex.europa.eu/EN/display-feed.rss?rssId=161",
    category: "EU",
  },
  {
    name: "UK Legislation — New Legislation",
    url: "https://www.legislation.gov.uk/new/data.feed",
    category: "UK",
  },
];

export interface FeedResult {
  items: RSSFeedItem[];
  errors: { source: string; error: string }[];
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

export async function fetchAllRSSFeeds(): Promise<FeedResult> {
  const errors: { source: string; error: string }[] = [];

  const results = await Promise.allSettled(
    rssSources.map(async (source) => {
      try {
        return await fetchRSSFeed(source);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ source: source.name, error: msg });
        return [];
      }
    })
  );

  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  // Log summary
  const successCount = results.filter(
    (r) => r.status === "fulfilled" && r.value.length > 0
  ).length;
  console.log(
    `[RSS] Fetched ${items.length} items from ${successCount}/${rssSources.length} feeds` +
    (errors.length > 0 ? ` (${errors.length} failed)` : "")
  );

  return { items, errors };
}
