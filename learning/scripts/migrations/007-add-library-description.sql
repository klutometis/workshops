-- Migration 007: Add description column to libraries table
-- Date: 2026-02-02
-- Author: Peter Danenberg & Peter Norvig
--
-- Rationale: Allow library owners to add a description/abstract for their content

ALTER TABLE libraries 
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN libraries.description IS 'Optional description or abstract of the library content';
