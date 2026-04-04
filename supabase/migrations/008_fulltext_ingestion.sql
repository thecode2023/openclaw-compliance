-- ============================================================
-- Migration 008: Full-Text Legislative Ingestion
-- Extends chunk types for article-level RAG, adds full text
-- storage columns to regulations table
-- ============================================================

-- Update chunk_type CHECK constraint to include legislative chunk types
ALTER TABLE regulation_embeddings
  DROP CONSTRAINT IF EXISTS regulation_embeddings_chunk_type_check;

ALTER TABLE regulation_embeddings
  ADD CONSTRAINT regulation_embeddings_chunk_type_check
  CHECK (chunk_type IN (
    'summary', 'key_requirement', 'compliance_implication',
    'penalty_info', 'full_text', 'update_summary',
    'article', 'section', 'recital', 'annex', 'definition', 'preamble'
  ));

-- Add full text columns to regulations table
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS full_text_markdown TEXT;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS full_text_source TEXT;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS full_text_scraped_at TIMESTAMPTZ;
