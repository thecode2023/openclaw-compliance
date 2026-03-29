-- =========================================================
-- Migration 005: Pending Regulations + Feed Sources
-- =========================================================

-- 1. feed_sources — manages RSS/Atom feed URLs in the database
CREATE TABLE feed_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  last_fetched_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feed_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read feed sources"
  ON feed_sources FOR SELECT USING (true);

CREATE POLICY "Service role manages feed sources"
  ON feed_sources FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Seed existing feeds + new feeds
INSERT INTO feed_sources (name, url, category) VALUES
  ('Federal Register — AI and Technology', 'https://www.federalregister.gov/api/v1/documents.rss?conditions%5Btopic_ids%5D%5B%5D=artificial-intelligence', 'US Federal'),
  ('EUR-Lex — Parliament and Council Legislation', 'https://eur-lex.europa.eu/EN/display-feed.rss?rssId=162', 'EU'),
  ('EUR-Lex — Commission Proposals', 'https://eur-lex.europa.eu/EN/display-feed.rss?rssId=161', 'EU'),
  ('OECD AI Policy Observatory', 'https://wp.oecd.ai/feed/', 'Global'),
  ('Future of Life Institute', 'https://futureoflife.org/feed/', 'Global'),
  ('EU Parliament — IMCO Committee', 'https://www.europarl.europa.eu/rss/committee/imco/en.xml', 'EU'),
  ('EU Parliament — ITRE Committee', 'https://www.europarl.europa.eu/rss/committee/itre/en.xml', 'EU');

-- 2. pending_regulations — drafts awaiting human review
CREATE TABLE pending_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core regulation fields (mirrors regulations table)
  title TEXT NOT NULL,
  jurisdiction TEXT,
  jurisdiction_display TEXT,
  status TEXT CHECK (status IN ('enacted', 'proposed', 'in_effect', 'under_review', 'repealed')),
  category TEXT CHECK (category IN ('legislation', 'executive_order', 'framework', 'guidance', 'standard')),
  summary TEXT,
  key_requirements JSONB DEFAULT '[]',
  compliance_implications JSONB DEFAULT '[]',
  effective_date DATE,
  source_url TEXT NOT NULL,
  source_name TEXT,

  -- Classification metadata
  pass1_classification TEXT NOT NULL CHECK (pass1_classification IN ('new_regulation', 'update_to_existing', 'enforcement_action', 'guidance_update', 'noise')),
  pass1_confidence FLOAT NOT NULL,
  pass2_classification TEXT CHECK (pass2_classification IN ('agree', 'disagree', 'uncertain')),
  pass2_confidence FLOAT,

  -- Review status
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'dismissed', 'uncertain', 'expired')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  dismiss_reason TEXT,

  -- Source tracking
  feed_source TEXT,
  raw_title TEXT NOT NULL,
  raw_snippet TEXT,
  raw_link TEXT NOT NULL,

  -- Dedup
  content_hash TEXT NOT NULL,

  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_review_status ON pending_regulations(review_status);
CREATE INDEX idx_pending_detected ON pending_regulations(detected_at DESC);
CREATE INDEX idx_pending_content_hash ON pending_regulations(content_hash);
CREATE UNIQUE INDEX idx_pending_unique_content ON pending_regulations(content_hash) WHERE review_status = 'pending';

ALTER TABLE pending_regulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pending"
  ON pending_regulations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update pending"
  ON pending_regulations FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages pending"
  ON pending_regulations FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
