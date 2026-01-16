-- ============================================================================
-- Migration 005: Add Program & Function Extraction Support
-- ============================================================================
-- Date: 2026-01-16
-- Purpose: Store complete extracted programs and map functions to concepts
--
-- Usage: psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/005_add_program_and_functions.sql

-- ============================================================================
-- 1. LIBRARY_PROGRAMS TABLE
-- ============================================================================
-- Stores the complete, coherent, runnable program extracted from a library

CREATE TABLE IF NOT EXISTS library_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL UNIQUE REFERENCES libraries(id) ON DELETE CASCADE,
  
  -- Program code
  program_code TEXT NOT NULL,  -- Complete runnable program
  language TEXT NOT NULL DEFAULT 'python',
  
  -- Metadata
  extraction_method TEXT,  -- e.g., "gemini-manual", "gemini-auto"
  verified BOOLEAN DEFAULT false,  -- Did verification tests pass?
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  
  -- Optional metadata
  metadata JSONB DEFAULT '{}'::jsonb  -- version, extracted_at, verification_results, etc.
);

CREATE INDEX IF NOT EXISTS idx_library_programs_library ON library_programs(library_id);
CREATE INDEX IF NOT EXISTS idx_library_programs_language ON library_programs(language);

COMMENT ON TABLE library_programs IS 'Complete, coherent programs extracted from notebooks/markdown';
COMMENT ON COLUMN library_programs.program_code IS 'Full Python program that can run standalone';
COMMENT ON COLUMN library_programs.verified IS 'Whether verification smoke tests passed during extraction';

-- ============================================================================
-- 2. CONCEPT_FUNCTIONS TABLE
-- ============================================================================
-- Maps individual functions from the program to concepts

CREATE TABLE IF NOT EXISTS concept_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL,  -- Must match concepts.concept_id
  
  -- Function identity
  function_name TEXT NOT NULL,
  function_signature TEXT NOT NULL,  -- e.g., "def distance(A: City, B: City) -> float:"
  function_body TEXT NOT NULL,  -- Complete function implementation
  docstring TEXT,  -- Extracted docstring
  
  -- Position in complete program
  line_start INTEGER,  -- Starting line in library_programs.program_code
  line_end INTEGER,    -- Ending line
  
  -- Dependencies
  dependencies TEXT[] DEFAULT '{}',  -- Array of function names this function calls
  called_by TEXT[] DEFAULT '{}',     -- Array of function names that call this function
  
  -- Mastery tests (3-5 tests per function)
  test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of test case objects
  
  -- Metadata
  difficulty TEXT CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
  estimated_time_minutes INTEGER,  -- How long to implement (for student planning)
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_library_function UNIQUE (library_id, function_name)
);

CREATE INDEX IF NOT EXISTS idx_concept_functions_library ON concept_functions(library_id);
CREATE INDEX IF NOT EXISTS idx_concept_functions_concept ON concept_functions(library_id, concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_functions_name ON concept_functions(library_id, function_name);

COMMENT ON TABLE concept_functions IS 'Individual functions mapped to concepts with mastery tests';
COMMENT ON COLUMN concept_functions.test_cases IS 'Array of test objects: [{name, setup, code, points, description}]';
COMMENT ON COLUMN concept_functions.dependencies IS 'Functions this function calls (e.g., nearest_neighbor calls distance)';

-- ============================================================================
-- 3. HELPER FUNCTIONS
-- ============================================================================

-- Get exercise data for a concept (function + test cases)
CREATE OR REPLACE FUNCTION get_concept_exercise(
  search_library_id UUID,
  search_concept_id TEXT
)
RETURNS TABLE (
  function_name TEXT,
  function_signature TEXT,
  docstring TEXT,
  dependencies TEXT[],
  test_cases JSONB,
  program_context TEXT  -- Complete program MINUS the target function
)
LANGUAGE plpgsql
AS $$
DECLARE
  target_function RECORD;
  complete_program TEXT;
BEGIN
  -- Get the function details
  SELECT cf.function_name, cf.function_signature, cf.docstring, 
         cf.dependencies, cf.test_cases, cf.line_start, cf.line_end
  INTO target_function
  FROM concept_functions cf
  WHERE cf.library_id = search_library_id 
    AND cf.concept_id = search_concept_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Get the complete program
  SELECT lp.program_code INTO complete_program
  FROM library_programs lp
  WHERE lp.library_id = search_library_id;
  
  -- Note: In production, we'd strip out the target function here
  -- For now, return complete program (student redefinition works anyway)
  
  RETURN QUERY SELECT 
    target_function.function_name,
    target_function.function_signature,
    target_function.docstring,
    target_function.dependencies,
    target_function.test_cases,
    complete_program as program_context;
END;
$$;

COMMENT ON FUNCTION get_concept_exercise IS 'Fetch exercise data for a concept (function + tests + program context)';

-- Get all functions for a library (for overview/selection)
CREATE OR REPLACE FUNCTION get_library_functions(search_library_id UUID)
RETURNS TABLE (
  concept_id TEXT,
  concept_name TEXT,
  function_name TEXT,
  function_signature TEXT,
  difficulty TEXT,
  test_count INTEGER,
  estimated_time_minutes INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cf.concept_id,
    c.name as concept_name,
    cf.function_name,
    cf.function_signature,
    cf.difficulty,
    jsonb_array_length(cf.test_cases) as test_count,
    cf.estimated_time_minutes
  FROM concept_functions cf
  JOIN concepts c ON cf.library_id = c.library_id AND cf.concept_id = c.concept_id
  WHERE cf.library_id = search_library_id
  ORDER BY c.name, cf.function_name;
END;
$$;

COMMENT ON FUNCTION get_library_functions IS 'List all functions available for a library with metadata';

-- ============================================================================
-- GRANT PERMISSIONS (if using RLS)
-- ============================================================================

-- Grant access to authenticated users (adjust as needed)
-- ALTER TABLE library_programs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE concept_functions ENABLE ROW LEVEL SECURITY;

-- Example policy (uncomment if using RLS):
-- CREATE POLICY "Public libraries readable by all" ON library_programs
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM libraries l 
--       WHERE l.id = library_programs.library_id 
--       AND l.is_public = true
--     )
--   );
