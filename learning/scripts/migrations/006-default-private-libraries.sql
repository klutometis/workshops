-- Migration 006: Change default library visibility to private
-- Date: 2026-02-02
-- Author: Peter Danenberg & Peter Norvig
--
-- Rationale: Libraries should be private by default. Only custodians/admins
-- should mark libraries as public for the homepage.

-- Change default for new libraries
ALTER TABLE libraries 
  ALTER COLUMN is_public SET DEFAULT false;

-- Note: This does NOT change existing libraries, only affects new inserts.
-- Existing public libraries remain public.
