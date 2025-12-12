# Pipeline Output → Database Mapping

This document shows how the current YouTube pipeline JSON outputs map to Supabase database tables.

## Overview

**Current Pipeline Flow (File-based):**
```
1. download-media.sh → audio.mp3, frames/
2. transcribe-audio.ts → audio-transcript.json
3. analyze-frames.ts → video-analysis.json
4. extract-concepts.ts → concept-graph.json
5. enrich-concepts.ts → concept-graph.json (updated)
6. map-segments-to-concepts.ts → segment-concept-mappings.json
7. embed-video-segments.ts → segment-embeddings.json
```

**New Pipeline Flow (Database-backed):**
```
1. POST /api/libraries/upload → creates library record
2. Process pipeline stages → write to database progressively
3. Update library.status → 'ready'
```

---

## Mapping: concept-graph.json → Database

### File Structure
```json
{
  "metadata": {
    "title": "Let's build GPT: from scratch, in code, spelled out",
    "author": "Andrej Karpathy",
    "source": "https://www.youtube.com/watch?v=kCc8FmEb1nY",
    "video_id": "kCc8FmEb1nY",
    "total_duration": 7260,
    "total_concepts": 24,
    "extracted_at": "2024-01-15T10:30:00Z",
    "enriched_at": "2024-01-15T11:00:00Z"
  },
  "nodes": [
    {
      "id": "attention_mechanism",
      "name": "Attention Mechanism",
      "description": "The core self-attention mechanism...",
      "prerequisites": ["token_embeddings", "positional_encoding"],
      "difficulty": "intermediate",
      "time_ranges": [{"start": 1200, "end": 2400}],
      "learning_objectives": ["Understand attention scores", "..."],
      "common_misconceptions": ["Attention is not just weighted sum", "..."]
    }
  ]
}
```

### Database Tables

#### 1. libraries table
```sql
INSERT INTO libraries (
  id,                    -- Generate UUID
  title,                 -- metadata.title
  author,                -- metadata.author
  type,                  -- 'youtube'
  source_url,            -- metadata.source
  video_id,              -- metadata.video_id
  total_duration,        -- metadata.total_duration
  total_concepts,        -- metadata.total_concepts
  status,                -- 'ready' (set when processing complete)
  processed_at           -- metadata.enriched_at or extracted_at
) VALUES (
  gen_random_uuid(),
  'Let''s build GPT: from scratch, in code, spelled out',
  'Andrej Karpathy',
  'youtube',
  'https://www.youtube.com/watch?v=kCc8FmEb1nY',
  'kCc8FmEb1nY',
  7260,
  24,
  'ready',
  '2024-01-15T11:00:00Z'
);
```

#### 2. concepts table (one row per node)
```sql
INSERT INTO concepts (
  library_id,              -- From libraries.id
  concept_id,              -- nodes[].id
  name,                    -- nodes[].name
  description,             -- nodes[].description
  difficulty,              -- nodes[].difficulty
  learning_objectives,     -- nodes[].learning_objectives (as JSONB)
  common_misconceptions,   -- nodes[].common_misconceptions (as JSONB)
  time_ranges              -- nodes[].time_ranges (as JSONB)
) VALUES (
  '<library-uuid>',
  'attention_mechanism',
  'Attention Mechanism',
  'The core self-attention mechanism...',
  'intermediate',
  '["Understand attention scores", "..."]'::jsonb,
  '["Attention is not just weighted sum", "..."]'::jsonb,
  '[{"start": 1200, "end": 2400}]'::jsonb
);
```

#### 3. prerequisites table (one row per edge)
```sql
-- For each prerequisite in nodes[].prerequisites
INSERT INTO prerequisites (
  library_id,         -- From libraries.id
  from_concept_id,    -- prerequisite ID
  to_concept_id       -- current node.id
) VALUES
  ('<library-uuid>', 'token_embeddings', 'attention_mechanism'),
  ('<library-uuid>', 'positional_encoding', 'attention_mechanism');
```

---

## Mapping: segment-concept-mappings.json → Database

### File Structure
```json
{
  "video_id": "kCc8FmEb1nY",
  "video_title": "Let's build GPT",
  "total_segments": 859,
  "mapped_segments": 859,
  "mapped_at": "2024-01-15T12:00:00Z",
  "segments": [
    {
      "segment_index": 0,
      "timestamp": 5.0,
      "audio_text": "Okay hello everyone, so by now...",
      "audio_start": 0.0,
      "audio_end": 10.48,
      "frame_path": "youtube/kCc8FmEb1nY/frames/frame_0005.jpg",
      "analysis": {
        "visual_description": "Shows VS Code with Python imports...",
        "code_content": "import torch\nimport torch.nn as nn",
        "slide_content": "",
        "visual_audio_alignment": "highly_relevant",
        "key_concepts": ["PyTorch basics", "Neural network imports"],
        "is_code_readable": true
      },
      "concept_mapping": {
        "concept_id": "pytorch_setup",
        "confidence": 0.95,
        "secondary_concepts": ["development_environment"],
        "reasoning": "Segment shows initial PyTorch setup"
      }
    }
  ]
}
```

### Database Table: segments

```sql
INSERT INTO segments (
  library_id,               -- From libraries.id
  segment_index,            -- segments[].segment_index
  timestamp,                -- segments[].timestamp
  audio_start,              -- segments[].audio_start
  audio_end,                -- segments[].audio_end
  audio_text,               -- segments[].audio_text
  frame_path,               -- segments[].frame_path
  visual_description,       -- segments[].analysis.visual_description
  code_content,             -- segments[].analysis.code_content
  slide_content,            -- segments[].analysis.slide_content
  visual_audio_alignment,   -- segments[].analysis.visual_audio_alignment
  key_concepts,             -- segments[].analysis.key_concepts (as JSONB)
  is_code_readable,         -- segments[].analysis.is_code_readable
  mapped_concept_id,        -- segments[].concept_mapping.concept_id
  mapping_confidence,       -- segments[].concept_mapping.confidence
  secondary_concepts,       -- segments[].concept_mapping.secondary_concepts (as JSONB)
  mapping_reasoning         -- segments[].concept_mapping.reasoning
) VALUES (
  '<library-uuid>',
  0,
  5.0,
  0.0,
  10.48,
  'Okay hello everyone, so by now...',
  'youtube/kCc8FmEb1nY/frames/frame_0005.jpg',
  'Shows VS Code with Python imports...',
  'import torch\nimport torch.nn as nn',
  '',
  'highly_relevant',
  '["PyTorch basics", "Neural network imports"]'::jsonb,
  true,
  'pytorch_setup',
  0.95,
  '["development_environment"]'::jsonb,
  'Segment shows initial PyTorch setup'
);
```

**Note:** For 859 segments, this will be 859 INSERT statements (can batch with VALUES lists).

---

## Mapping: segment-embeddings.json → Database

### File Structure
```json
{
  "video_id": "kCc8FmEb1nY",
  "video_title": "Let's build GPT",
  "segments": [
    {
      "segment_index": 0,
      "timestamp": 5.0,
      "audio_text": "Okay hello everyone...",
      "audio_start": 0.0,
      "audio_end": 10.48,
      "frame_path": "youtube/kCc8FmEb1nY/frames/frame_0005.jpg",
      "analysis": { ... },
      "concept_mapping": { ... },
      "video_id": "kCc8FmEb1nY",
      "embedding": [0.023, -0.045, 0.012, ... 768 values],
      "embedding_model": "gemini-embedding-001",
      "embedding_text": "Transcript: Okay hello everyone...\n\nVisual: Shows VS Code..."
    }
  ],
  "metadata": {
    "total_embeddings": 859,
    "embedded_at": "2024-01-15T13:00:00Z",
    "embedding_model": "gemini-embedding-001",
    "embedding_dimensions": 768,
    "source_file": "youtube/kCc8FmEb1nY/segment-concept-mappings.json"
  }
}
```

### Database Table: embeddings

**Challenge:** Need to join with segments table to get segment_id.

**Solution:** Insert segments first, then embeddings with a JOIN or subquery.

```sql
-- Strategy 1: Insert with subquery
INSERT INTO embeddings (
  library_id,
  segment_id,           -- Lookup from segments table
  embedding,            -- segments[].embedding (as vector)
  embedding_model,      -- segments[].embedding_model
  embedding_text,       -- segments[].embedding_text
  content_type
)
SELECT
  '<library-uuid>',
  s.id,
  '[0.023, -0.045, ...]'::vector(768),
  'gemini-embedding-001',
  'Transcript: Okay hello everyone...',
  'video_segment'
FROM segments s
WHERE s.library_id = '<library-uuid>'
  AND s.segment_index = 0;

-- Strategy 2: Batch insert with UNNEST (more efficient)
-- Prepare arrays of segment_indices and embeddings, then:
INSERT INTO embeddings (library_id, segment_id, embedding, embedding_model, embedding_text, content_type)
SELECT 
  '<library-uuid>',
  s.id,
  e.embedding,
  e.model,
  e.text,
  'video_segment'
FROM 
  UNNEST(
    ARRAY[0, 1, 2, ...],  -- segment_indices
    ARRAY['[...]'::vector(768), '[...]'::vector(768), ...],  -- embeddings
    ARRAY['gemini-embedding-001', ...],  -- models
    ARRAY['Transcript: ...', ...]  -- texts
  ) AS e(segment_idx, embedding, model, text)
JOIN segments s ON s.library_id = '<library-uuid>' AND s.segment_index = e.segment_idx;
```

---

## Key Transformations Required

### 1. JSON Arrays → JSONB
```typescript
// Before (JSON file)
"learning_objectives": ["Understand attention", "Implement from scratch"]

// After (Database)
learning_objectives: '["Understand attention", "Implement from scratch"]'::jsonb
```

### 2. Nested Objects → Flattened Columns
```typescript
// Before (JSON file)
{
  "analysis": {
    "visual_description": "Shows code",
    "code_content": "import torch"
  }
}

// After (Database)
visual_description: "Shows code"
code_content: "import torch"
```

### 3. Prerequisites Array → Separate Rows
```typescript
// Before (JSON file)
{
  "id": "attention_mechanism",
  "prerequisites": ["token_embeddings", "positional_encoding"]
}

// After (Database - 2 rows)
prerequisites: [
  { from: "token_embeddings", to: "attention_mechanism" },
  { from: "positional_encoding", to: "attention_mechanism" }
]
```

### 4. Number Arrays → pgvector
```typescript
// Before (JSON file)
"embedding": [0.023, -0.045, 0.012, ... 768 values]

// After (Database)
embedding: '[0.023, -0.045, 0.012, ...]'::vector(768)
```

---

## Processing Order

To maintain referential integrity, insert in this order:

```
1. libraries (creates library_id)
   ↓
2. concepts (references library_id)
   ↓
3. prerequisites (references library_id, concept_ids exist)
   ↓
4. segments (references library_id)
   ↓
5. embeddings (references library_id, segment_id)
```

---

## Migration Strategy

### Option A: Adapt Scripts to Write Directly to DB
**Pros:** No intermediate JSON files, real-time progress
**Cons:** Bigger refactor, harder to debug

### Option B: Keep JSON Files, Add Import Script
**Pros:** Minimal changes to pipeline, easy rollback
**Cons:** Still generates large JSON files, two-step process

### Recommendation: **Hybrid Approach**
1. **Workshop MVP**: Generate JSON, then import to DB (Option B)
2. **Post-workshop**: Refactor scripts to write directly (Option A)

This lets us ship quickly while leaving room for optimization.

---

## Next Steps

1. Create Supabase migration files for schema
2. Write import script: `scripts/import-youtube-to-db.ts`
   - Reads existing JSON files
   - Inserts into database
   - Validates referential integrity
3. Test with Karpathy video data
4. Adapt pipeline scripts to write directly to DB
5. Build API routes to query database
