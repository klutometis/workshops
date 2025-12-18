-- ============================================================================
-- Migration 004: Add processing_logs Column
-- ============================================================================
-- Adds processing_logs JSONB column for real-time debugging and process supervision
-- Run with: ./scripts/apply-migration.sh 004-add-processing-logs

BEGIN;

-- Check if already applied
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '004-add-processing-logs') THEN
    RAISE EXCEPTION 'Migration 004-add-processing-logs already applied';
  END IF;
END $$;

-- ============================================================================
-- Add processing_logs column
-- ============================================================================

-- Add processing_logs column for tracking processing stages in real-time
-- Structure: [{"ts": "2024-12-16T10:30:00Z", "level": "info", "stage": "extract-concepts", "msg": "Starting..."}]
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS processing_logs JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN libraries.processing_logs IS 'Array of timestamped log entries during processing (for debugging and timeout detection)';

-- Create index for querying recent logs
CREATE INDEX IF NOT EXISTS idx_libraries_processing_logs ON libraries USING gin (processing_logs);

-- ============================================================================
-- Record migration
-- ============================================================================

INSERT INTO schema_migrations (migration_name) VALUES ('004-add-processing-logs');

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  'Migration 004 complete!' AS status,
  COUNT(*) AS total_libraries,
  COUNT(*) FILTER (WHERE processing_logs IS NOT NULL) AS with_processing_logs
FROM libraries;
