-- ============================================================================
-- Migration 001: Add Users and Ownership
-- ============================================================================
-- Adds GitHub authentication and library ownership features
-- Run with: ./scripts/apply-migration.sh

BEGIN;

-- Track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Check if already applied
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '001-add-users') THEN
    RAISE EXCEPTION 'Migration 001-add-users already applied';
  END IF;
END $$;

-- ============================================================================
-- 1. Create users table
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  github_id TEXT UNIQUE NOT NULL,
  github_login TEXT UNIQUE NOT NULL,
  github_name TEXT,
  github_avatar TEXT,
  github_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_github_login ON users(github_login);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- ============================================================================
-- 2. Create system user for existing libraries
-- ============================================================================

INSERT INTO users (github_id, github_login, github_name, created_at)
VALUES ('0', 'system', 'System', NOW())
ON CONFLICT (github_id) DO NOTHING;

-- ============================================================================
-- 3. Add ownership columns to libraries
-- ============================================================================

-- Add user_id column (nullable initially)
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Add is_public column (default true for existing libraries)
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- ============================================================================
-- 4. Migrate existing libraries to system user
-- ============================================================================

UPDATE libraries 
SET user_id = (SELECT id FROM users WHERE github_login = 'system')
WHERE user_id IS NULL;

-- ============================================================================
-- 5. Drop old unique constraint on slug, add new per-user constraint
-- ============================================================================

-- Drop the global unique constraint on slug
ALTER TABLE libraries DROP CONSTRAINT IF EXISTS libraries_slug_key;

-- Add per-user unique constraint (allows different users to have same slug)
ALTER TABLE libraries ADD CONSTRAINT unique_user_slug UNIQUE (user_id, slug);

-- ============================================================================
-- 6. Add indexes for user queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_libraries_user_id ON libraries(user_id);
CREATE INDEX IF NOT EXISTS idx_libraries_public ON libraries(is_public);
CREATE INDEX IF NOT EXISTS idx_libraries_user_public ON libraries(user_id, is_public);

-- ============================================================================
-- 7. Record migration
-- ============================================================================

INSERT INTO schema_migrations (migration_name) VALUES ('001-add-users');

COMMIT;

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Show system user
SELECT id, github_login, github_name FROM users WHERE github_login = 'system';

-- Show library ownership summary
SELECT 
  u.github_login,
  COUNT(*) as library_count,
  SUM(CASE WHEN is_public THEN 1 ELSE 0 END) as public_count,
  SUM(CASE WHEN NOT is_public THEN 1 ELSE 0 END) as private_count
FROM libraries l
LEFT JOIN users u ON l.user_id = u.id
GROUP BY u.github_login;
