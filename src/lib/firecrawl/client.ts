// FireCrawl REST API client
// Free tier: 500 credits/month (1 scrape = 1 credit)
// Docs: https://docs.firecrawl.dev

export interface FireCrawlScrapeOptions {
  url: string;
  formats?: ("markdown" | "html" | "text")[];
  onlyMainContent?: boolean;
  waitFor?: number;
  timeout?: number;
  cssSelector?: string;
}

export interface FireCrawlScrapeResult {
  success: boolean;
  data?: {
    markdown: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
    };
  };
  error?: string;
}

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";

export async function scrapeUrl(
  options: FireCrawlScrapeOptions
): Promise<FireCrawlScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return { success: false, error: "FIRECRAWL_API_KEY is not set" };
  }

  try {
    const body: Record<string, unknown> = {
      url: options.url,
      formats: options.formats || ["markdown"],
      onlyMainContent: options.onlyMainContent ?? true,
      waitFor: options.waitFor || 3000,
      timeout: options.timeout || 30000,
    };

    if (options.cssSelector) {
      body.includeTags = [options.cssSelector];
    }

    const response = await fetch(FIRECRAWL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `FireCrawl API ${response.status}: ${errText.slice(0, 200)}`,
      };
    }

    const result = await response.json();
    return result as FireCrawlScrapeResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Scrape request failed",
    };
  }
}
