-- ============================================================
-- Migration 006: Phase 4 — Intelligent Features
-- RAG vector store, chat sessions, policy documents,
-- regulation dependency graph, RLS policies, RPC functions
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Enable pgvector extension
-- ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ────────────────────────────────────────────────────────────
-- 2. regulation_embeddings (vector store for RAG)
-- ────────────────────────────────────────────────────────────

CREATE TABLE regulation_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id UUID REFERENCES regulations(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_type TEXT NOT NULL CHECK (chunk_type IN (
    'summary', 'key_requirement', 'compliance_implication',
    'penalty_info', 'full_text', 'update_summary'
  )),
  embedding vector(768) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(regulation_id, chunk_index)
);

-- HNSW index for fast cosine similarity search
CREATE INDEX idx_embeddings_vector ON regulation_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_embeddings_regulation ON regulation_embeddings(regulation_id);
CREATE INDEX idx_embeddings_type ON regulation_embeddings(chunk_type);

-- ────────────────────────────────────────────────────────────
-- 3. chat_sessions & chat_messages (conversation history)
-- ────────────────────────────────────────────────────────────

CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at ASC);

-- ────────────────────────────────────────────────────────────
-- 4. policy_documents (generated compliance policies)
-- ────────────────────────────────────────────────────────────

CREATE TABLE policy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  regulation_id UUID REFERENCES regulations(id) ON DELETE SET NULL,
  industry TEXT,
  jurisdictions TEXT[] DEFAULT '{}',
  content_markdown TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policies_user ON policy_documents(user_id, updated_at DESC);
CREATE INDEX idx_policies_regulation ON policy_documents(regulation_id);

-- ────────────────────────────────────────────────────────────
-- 5. regulation_relationships (dependency graph)
-- ────────────────────────────────────────────────────────────

CREATE TABLE regulation_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_regulation_id UUID REFERENCES regulations(id) ON DELETE CASCADE,
  target_regulation_id UUID REFERENCES regulations(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'triggers', 'requires', 'conflicts_with', 'supplements', 'supersedes', 'references'
  )),
  description TEXT,
  strength TEXT DEFAULT 'strong' CHECK (strength IN ('strong', 'moderate', 'weak')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_regulation_id, target_regulation_id, relationship_type)
);

CREATE INDEX idx_relationships_source ON regulation_relationships(source_regulation_id);
CREATE INDEX idx_relationships_target ON regulation_relationships(target_regulation_id);

-- ────────────────────────────────────────────────────────────
-- 6. RPC: match_regulations (vector similarity search)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_regulations(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  filter_jurisdictions TEXT[] DEFAULT NULL,
  filter_chunk_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  regulation_id UUID,
  chunk_text TEXT,
  chunk_type TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.id,
    re.regulation_id,
    re.chunk_text,
    re.chunk_type,
    1 - (re.embedding <=> query_embedding) AS similarity,
    re.metadata
  FROM regulation_embeddings re
  WHERE 1 - (re.embedding <=> query_embedding) > match_threshold
    AND (filter_jurisdictions IS NULL OR
         EXISTS (
           SELECT 1 FROM regulations r
           WHERE r.id = re.regulation_id
           AND r.jurisdiction = ANY(filter_jurisdictions)
         ))
    AND (filter_chunk_types IS NULL OR re.chunk_type = ANY(filter_chunk_types))
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 7. Row Level Security
-- ────────────────────────────────────────────────────────────

-- regulation_embeddings: public read (same as regulations)
ALTER TABLE regulation_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read regulation embeddings"
  ON regulation_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage regulation embeddings"
  ON regulation_embeddings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- chat_sessions: users can only access their own
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
  ON chat_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions"
  ON chat_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- chat_messages: users can only access messages in their own sessions
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat messages"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      WHERE cs.id = chat_messages.session_id
      AND cs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own sessions"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      WHERE cs.id = chat_messages.session_id
      AND cs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in own sessions"
  ON chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      WHERE cs.id = chat_messages.session_id
      AND cs.user_id = auth.uid()
    )
  );

-- policy_documents: users can only CRUD their own
ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own policies"
  ON policy_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own policies"
  ON policy_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own policies"
  ON policy_documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own policies"
  ON policy_documents FOR DELETE
  USING (auth.uid() = user_id);

-- regulation_relationships: public read, service role write
ALTER TABLE regulation_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read regulation relationships"
  ON regulation_relationships FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage regulation relationships"
  ON regulation_relationships FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
