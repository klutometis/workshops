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
  markdown_content TEXT,  -- Full markdown content (for type='markdown')
  
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
-- 4. VIDEO_SEGMENTS TABLE
-- ============================================================================
-- Represents video segments with multimodal analysis

CREATE TABLE IF NOT EXISTS video_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  
  -- Segment identity
  segment_index INTEGER NOT NULL,
  
  -- Video timing
  segment_timestamp REAL NOT NULL,  -- seconds
  audio_start REAL NOT NULL,
  audio_end REAL NOT NULL,
  
  -- Content
  audio_text TEXT NOT NULL,  -- Transcript
  frame_path TEXT,  -- Path to video frame
  
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

CREATE INDEX IF NOT EXISTS idx_video_segments_library ON video_segments(library_id);
CREATE INDEX IF NOT EXISTS idx_video_segments_concept ON video_segments(library_id, mapped_concept_id) WHERE mapped_concept_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_segments_timestamp ON video_segments(library_id, segment_timestamp);

-- ============================================================================
-- 5. TEXT_CHUNKS TABLE
-- ============================================================================
-- Represents text chunks from markdown/documents

CREATE TABLE IF NOT EXISTS text_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  
  -- Chunk identity
  chunk_index INTEGER NOT NULL,
  chunk_id TEXT NOT NULL,  -- e.g., "chunk-1-introduction"
  
  -- Content
  content TEXT NOT NULL,
  title TEXT,
  type TEXT,  -- e.g., "paragraph", "code_block", "heading"
  
  -- Document structure
  section TEXT,
  start_line INTEGER,
  end_line INTEGER,
  
  -- Concept mapping
  mapped_concept_id TEXT,
  mapping_confidence REAL CHECK (mapping_confidence IS NULL OR (mapping_confidence >= 0 AND mapping_confidence <= 1)),
  secondary_concepts JSONB DEFAULT '[]'::jsonb,
  mapping_reasoning TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(library_id, chunk_index),
  UNIQUE(library_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_text_chunks_library ON text_chunks(library_id);
CREATE INDEX IF NOT EXISTS idx_text_chunks_concept ON text_chunks(library_id, mapped_concept_id) WHERE mapped_concept_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_text_chunks_section ON text_chunks(library_id, section) WHERE section IS NOT NULL;

-- ============================================================================
-- 6. EMBEDDINGS TABLE
-- ============================================================================
-- Stores vector embeddings for semantic search (references either video_segments OR text_chunks)

CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  
  -- Reference to source content (exactly one must be set)
  video_segment_id UUID REFERENCES video_segments(id) ON DELETE CASCADE,
  text_chunk_id UUID REFERENCES text_chunks(id) ON DELETE CASCADE,
  
  -- Embedding data
  embedding vector(1536),  -- Gemini embedding dimension (reduced to 1536 for pgvector compatibility)
  embedding_model TEXT NOT NULL,  -- e.g., "gemini-embedding-001"
  embedding_text TEXT NOT NULL,  -- What was actually embedded (for debugging)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint: exactly one source must be set
  CONSTRAINT embeddings_source_check CHECK (
    (video_segment_id IS NOT NULL AND text_chunk_id IS NULL) OR
    (video_segment_id IS NULL AND text_chunk_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_embeddings_library ON embeddings(library_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_video_segment ON embeddings(video_segment_id) WHERE video_segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_embeddings_text_chunk ON embeddings(text_chunk_id) WHERE text_chunk_id IS NOT NULL;

-- Vector similarity index (HNSW for fast approximate nearest neighbor search)
-- Note: HNSW has a 2000 dimension limit, so we use 1536 dimensions
-- HNSW provides better recall and query performance than IVFFlat
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings 
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Search for similar content using cosine similarity
-- Returns unified results from both video segments and text chunks
CREATE OR REPLACE FUNCTION search_segments(
  query_embedding vector(1536),
  search_library_id UUID DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  library_id UUID,
  content_type TEXT,
  index_num INTEGER,
  content_text TEXT,
  mapped_concept_id TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_results AS (
    -- Video segments
    SELECT 
      vs.id,
      vs.library_id,
      'video_segment'::TEXT as content_type,
      vs.segment_index as index_num,
      vs.audio_text as content_text,
      vs.mapped_concept_id,
      1 - (e.embedding <=> query_embedding) as similarity,
      jsonb_build_object(
        'segment_timestamp', vs.segment_timestamp,
        'audio_start', vs.audio_start,
        'audio_end', vs.audio_end,
        'frame_path', vs.frame_path,
        'visual_description', vs.visual_description,
        'code_content', vs.code_content,
        'slide_content', vs.slide_content,
        'key_concepts', vs.key_concepts
      ) as metadata
    FROM embeddings e
    JOIN video_segments vs ON e.video_segment_id = vs.id
    WHERE 
      (search_library_id IS NULL OR e.library_id = search_library_id)
      AND 1 - (e.embedding <=> query_embedding) > match_threshold
    
    UNION ALL
    
    -- Text chunks
    SELECT 
      tc.id,
      tc.library_id,
      'text_chunk'::TEXT as content_type,
      tc.chunk_index as index_num,
      tc.content as content_text,
      tc.mapped_concept_id,
      1 - (e.embedding <=> query_embedding) as similarity,
      jsonb_build_object(
        'chunk_id', tc.chunk_id,
        'title', tc.title,
        'type', tc.type,
        'section', tc.section,
        'start_line', tc.start_line,
        'end_line', tc.end_line
      ) as metadata
    FROM embeddings e
    JOIN text_chunks tc ON e.text_chunk_id = tc.id
    WHERE 
      (search_library_id IS NULL OR e.library_id = search_library_id)
      AND 1 - (e.embedding <=> query_embedding) > match_threshold
  )
  SELECT *
  FROM ranked_results
  ORDER BY similarity DESC
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
