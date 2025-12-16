-- ============================================================================
-- Migration 003: Add progress_message Column
-- ============================================================================
-- Adds progress_message column to libraries table for tracking processing status
-- Run with: ./scripts/apply-migration.sh 003-add-progress-message

BEGIN;

-- Check if already applied
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '003-add-progress-message') THEN
    RAISE EXCEPTION 'Migration 003-add-progress-message already applied';
  END IF;
END $$;

-- ============================================================================
-- Add progress_message column
-- ============================================================================

-- Add progress_message column for tracking processing status updates
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS progress_message TEXT;

COMMENT ON COLUMN libraries.progress_message IS 'Human-readable progress message during processing';

-- ============================================================================
-- Record migration
-- ============================================================================

INSERT INTO schema_migrations (migration_name) VALUES ('003-add-progress-message');

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  'Migration 003 complete!' AS status,
  COUNT(*) AS total_libraries,
  COUNT(*) FILTER (WHERE progress_message IS NOT NULL) AS with_progress_message
FROM libraries;
