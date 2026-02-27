-- ============================================================================
-- Migration 008: Add chapters support
-- ============================================================================
-- Chapters group libraries into ordered collections (e.g., PAIP chapters).
-- A library may optionally belong to a chapter.

-- 1. Create chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership (optional – NULL means a global/system chapter)
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Identity
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,

  -- Ordering within a "book" / top-level collection
  -- NULL means no explicit order
  order_index INTEGER,

  -- Visibility
  is_public BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_chapter_slug UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_chapters_user_id  ON chapters(user_id);
CREATE INDEX IF NOT EXISTS idx_chapters_public   ON chapters(is_public);
CREATE INDEX IF NOT EXISTS idx_chapters_slug     ON chapters(slug);

-- 2. Add chapter_id FK + per-chapter ordering to libraries
ALTER TABLE libraries
  ADD COLUMN IF NOT EXISTS chapter_id    UUID REFERENCES chapters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chapter_order INTEGER;  -- position of this library within its chapter

CREATE INDEX IF NOT EXISTS idx_libraries_chapter_id ON libraries(chapter_id) WHERE chapter_id IS NOT NULL;
