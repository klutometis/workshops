-- ============================================================================
-- Little PAIPer - Database Schema
-- ============================================================================
-- Supabase PostgreSQL schema for learning content management
-- Run with: ./scripts/apply-schema.sh
--
-- ⚠️  DESTRUCTIVE: Drops all tables and recreates from scratch
--     Safe for development iteration, use with caution in production

-- ============================================================================
-- DROP EVERYTHING (in reverse dependency order)
-- ============================================================================

DROP TABLE IF EXISTS embeddings CASCADE;
DROP TABLE IF EXISTS segments CASCADE;
DROP TABLE IF EXISTS prerequisites CASCADE;
DROP TABLE IF EXISTS concepts CASCADE;
DROP TABLE IF EXISTS libraries CASCADE;

DROP FUNCTION IF EXISTS search_segments(vector, UUID, FLOAT, INT);
DROP FUNCTION IF EXISTS get_concept_graph(UUID);

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. LIBRARIES TABLE
-- ============================================================================
-- Represents a learning module (YouTube video, book, notebook, etc.)

CREATE TABLE IF NOT EXISTS libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic metadata
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('youtube', 'markdown', 'notebook')),
  slug TEXT UNIQUE NOT NULL,  -- Human-readable identifier for URLs (e.g., 'karpathy-transformers')
  
  -- Source information
  source_url TEXT,
  video_id TEXT UNIQUE,  -- YouTube video ID (if type='youtube') - UNIQUE for ON CONFLICT
  
  -- Stats
  total_duration INTEGER,  -- seconds (for videos)
  total_concepts INTEGER DEFAULT 0,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Optional metadata (JSONB for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_libraries_status ON libraries(status);
CREATE INDEX IF NOT EXISTS idx_libraries_type ON libraries(type);
CREATE INDEX IF NOT EXISTS idx_libraries_video_id ON libraries(video_id) WHERE video_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_libraries_slug ON libraries(slug);

-- ============================================================================
-- 2. CONCEPTS TABLE
-- ============================================================================
-- Represents a single concept/topic within a library

CREATE TABLE IF NOT EXISTS concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  
  -- Concept identity
  concept_id TEXT NOT NULL,  -- e.g., "attention_mechanism"
  name TEXT NOT NULL,  -- e.g., "Attention Mechanism"
  description TEXT NOT NULL,
  
  -- Learning metadata
  difficulty TEXT CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
  learning_objectives JSONB DEFAULT '[]'::jsonb,  -- Array of strings
  common_misconceptions JSONB DEFAULT '[]'::jsonb,  -- Array of strings
  mastery_indicators JSONB DEFAULT '[]'::jsonb,  -- Array of skill objects
  
  -- Video-specific (NULL for non-video sources)
  time_ranges JSONB DEFAULT '[]'::jsonb,  -- [{"start": 120, "end": 240}, ...]
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(library_id, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_concepts_library ON concepts(library_id);
CREATE INDEX IF NOT EXISTS idx_concepts_concept_id ON concepts(library_id, concept_id);

-- ============================================================================
-- 3. PREREQUISITES TABLE
-- ============================================================================
-- Represents prerequisite relationships between concepts (directed edges)

CREATE TABLE IF NOT EXISTS prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  
  -- Edge: from_concept → to_concept (from is prerequisite of to)
  from_concept_id TEXT NOT NULL,
  to_concept_id TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure concepts exist (enforced at application layer since we use concept_id not UUID)
  UNIQUE(library_id, from_concept_id, to_concept_id)
);

CREATE INDEX IF NOT EXISTS idx_prerequisites_library ON prerequisites(library_id);
CREATE INDEX IF NOT EXISTS idx_prerequisites_to ON prerequisites(library_id, to_concept_id);
CREATE INDEX IF NOT EXISTS idx_prerequisites_from ON prerequisites(library_id, from_concept_id);

-- ============================================================================
-- 4. SEGMENTS TABLE
-- ============================================================================
-- Represents video segments or text chunks with multimodal analysis

CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  
  -- Segment identity
  segment_index INTEGER NOT NULL,
  
  -- Video timing (NULL for non-video sources)
  segment_timestamp REAL,  -- seconds
  audio_start REAL,
  audio_end REAL,
  
  -- Content
  audio_text TEXT,  -- Transcript or text content
  frame_path TEXT,  -- Path to video frame (if applicable)
  
  -- Multimodal analysis
  visual_description TEXT,
  code_content TEXT,
  slide_content TEXT,
  visual_audio_alignment TEXT CHECK (
    visual_audio_alignment IS NULL OR 
    visual_audio_alignment IN ('highly_relevant', 'somewhat_relevant', 'transitional', 'unrelated')
  ),
  key_concepts JSONB DEFAULT '[]'::jsonb,  -- Array of concept mentions
  is_code_readable BOOLEAN,
  
  -- Concept mapping
  mapped_concept_id TEXT,  -- Primary concept this segment teaches
  mapping_confidence REAL CHECK (mapping_confidence IS NULL OR (mapping_confidence >= 0 AND mapping_confidence <= 1)),
  secondary_concepts JSONB DEFAULT '[]'::jsonb,  -- Array of secondary concept IDs
  mapping_reasoning TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(library_id, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_segments_library ON segments(library_id);
CREATE INDEX IF NOT EXISTS idx_segments_concept ON segments(library_id, mapped_concept_id) WHERE mapped_concept_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_segments_timestamp ON segments(library_id, segment_timestamp) WHERE segment_timestamp IS NOT NULL;

-- ============================================================================
-- 5. EMBEDDINGS TABLE
-- ============================================================================
-- Stores vector embeddings for semantic search

CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  
  -- Embedding data
  embedding vector(1536),  -- Gemini embedding dimension (reduced to 1536 for pgvector compatibility)
  embedding_model TEXT NOT NULL,  -- e.g., "gemini-embedding-001"
  embedding_text TEXT NOT NULL,  -- What was actually embedded (for debugging)
  content_type TEXT NOT NULL DEFAULT 'video_segment' CHECK (
    content_type IN ('video_segment', 'text_chunk', 'code_example')
  ),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(segment_id)  -- One embedding per segment
);

CREATE INDEX IF NOT EXISTS idx_embeddings_library ON embeddings(library_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_segment ON embeddings(segment_id);

-- Vector similarity index (HNSW for fast approximate nearest neighbor search)
-- Note: HNSW has a 2000 dimension limit, so we use 1536 dimensions
-- HNSW provides better recall and query performance than IVFFlat
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings 
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Search for similar segments using cosine similarity
-- Returns rich multimodal content for context assembly
CREATE OR REPLACE FUNCTION search_segments(
  query_embedding vector(1536),
  search_library_id UUID DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  segment_id UUID,
  library_id UUID,
  segment_index INTEGER,
  audio_text TEXT,
  segment_timestamp REAL,
  audio_start REAL,
  audio_end REAL,
  visual_description TEXT,
  code_content TEXT,
  slide_content TEXT,
  key_concepts JSONB,
  mapped_concept_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.library_id,
    s.segment_index,
    s.audio_text,
    s.segment_timestamp,
    s.audio_start,
    s.audio_end,
    s.visual_description,
    s.code_content,
    s.slide_content,
    s.key_concepts,
    s.mapped_concept_id,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM embeddings e
  JOIN segments s ON e.segment_id = s.id
  WHERE 
    (search_library_id IS NULL OR e.library_id = search_library_id)
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Get concept graph for a library
CREATE OR REPLACE FUNCTION get_concept_graph(search_library_id UUID)
RETURNS TABLE (
  concepts JSONB,
  prerequisites JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', concept_id,
        'name', name,
        'description', description,
        'difficulty', difficulty,
        'learning_objectives', learning_objectives,
        'common_misconceptions', common_misconceptions,
        'mastery_indicators', mastery_indicators,
        'time_ranges', time_ranges,
        'prerequisites', COALESCE((
          SELECT jsonb_agg(from_concept_id)
          FROM prerequisites p
          WHERE p.library_id = c.library_id 
          AND p.to_concept_id = c.concept_id
        ), '[]'::jsonb)
      )
    ) FROM concepts c WHERE library_id = search_library_id) as concepts,
    (SELECT jsonb_agg(
      jsonb_build_object(
        'from', from_concept_id,
        'to', to_concept_id
      )
    ) FROM prerequisites WHERE library_id = search_library_id) as prerequisites;
END;
$$;
