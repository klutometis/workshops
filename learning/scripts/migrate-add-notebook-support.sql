-- ============================================================================
-- Migration: Add Notebook Support
-- ============================================================================
-- Adds source_type and notebook_data columns to libraries table
-- Safe to run multiple times (uses IF NOT EXISTS)
--
-- Run with: psql $DATABASE_URL < scripts/migrate-add-notebook-support.sql

-- Add source_type column (defaults to 'markdown' for existing rows)
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'markdown';

-- Add notebook_data column for storing original .ipynb content
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS notebook_data JSONB;

-- Add check constraint (only if column was just added)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'libraries_source_type_check'
  ) THEN
    ALTER TABLE libraries ADD CONSTRAINT libraries_source_type_check 
      CHECK (source_type IN ('markdown', 'youtube', 'notebook'));
  END IF;
END $$;

-- Add index for source_type queries
CREATE INDEX IF NOT EXISTS idx_libraries_source_type ON libraries(source_type);

-- Report results
SELECT 
  'Migration complete!' AS status,
  COUNT(*) AS total_libraries,
  COUNT(*) FILTER (WHERE source_type = 'markdown') AS markdown_count,
  COUNT(*) FILTER (WHERE source_type = 'youtube') AS youtube_count,
  COUNT(*) FILTER (WHERE source_type = 'notebook') AS notebook_count
FROM libraries;
