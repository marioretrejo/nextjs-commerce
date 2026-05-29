-- ══════════════════════════════════════════════════════════
-- 023 · pgvector RAG — Knowledge Bases & Document Chunks
-- ══════════════════════════════════════════════════════════

-- 1. Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Workspace-level knowledge base groups
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 3. Chunked document storage with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id        uuid    NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  workspace_id uuid    NOT NULL,             -- denormalised for RLS + fast queries
  source_name  text    NOT NULL DEFAULT '',  -- document / file name this chunk came from
  chunk_index  integer NOT NULL DEFAULT 0,
  content      text    NOT NULL,
  embedding    vector(1536),                 -- OpenAI text-embedding-3-small
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 4. HNSW index — works on empty tables, low-latency ANN search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 5. Semantic similarity RPC used by the LiveKit token endpoint
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding  vector(1536),
  p_workspace_id   uuid,
  match_threshold  float   DEFAULT 0.40,
  match_count      integer DEFAULT 6
)
RETURNS TABLE (
  id           uuid,
  content      text,
  source_name  text,
  similarity   float,
  kb_name      text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    dc.id,
    dc.content,
    dc.source_name,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    kb.name                                AS kb_name
  FROM document_chunks dc
  JOIN knowledge_bases  kb ON kb.id = dc.kb_id
  WHERE dc.workspace_id = p_workspace_id
    AND dc.embedding    IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 6. Row-Level Security
ALTER TABLE knowledge_bases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks  ENABLE ROW LEVEL SECURITY;

-- Workspace members (or owner) can manage their own KBs
CREATE POLICY "kb_workspace_access" ON knowledge_bases
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "chunks_workspace_access" ON document_chunks
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );
