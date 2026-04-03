-- ============================================================
-- Migration 007: Scrape Sources — FireCrawl Change Detection
-- ============================================================

CREATE TABLE scrape_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id UUID REFERENCES regulations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  scrape_type TEXT NOT NULL CHECK (scrape_type IN ('full_page', 'section', 'pdf')),
  css_selector TEXT,
  last_scraped_at TIMESTAMPTZ,
  last_content_hash TEXT,
  last_content_text TEXT,
  change_detected BOOLEAN DEFAULT FALSE,
  scrape_frequency TEXT DEFAULT 'weekly' CHECK (scrape_frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  enabled BOOLEAN DEFAULT TRUE,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scrape_sources_regulation ON scrape_sources(regulation_id);
CREATE INDEX idx_scrape_sources_enabled ON scrape_sources(enabled, scrape_frequency);

-- RLS: public read, service role write
ALTER TABLE scrape_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read scrape sources"
  ON scrape_sources FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage scrape sources"
  ON scrape_sources FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
