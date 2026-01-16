# Schema Changes for Function Extraction

**Migration:** `005-add-program-and-functions.sql`  
**Date:** 2026-01-16

## New Tables

### 1. `library_programs`

Stores the complete, coherent, runnable program extracted from a notebook/markdown.

**Key columns:**
- `library_id` - Foreign key to libraries (UNIQUE - one program per library)
- `program_code` - Complete Python program (can run standalone)
- `language` - Programming language (default: 'python')
- `verified` - Did verification smoke tests pass?
- `metadata` - JSONB for extraction info, verification results

**Example:**
```sql
INSERT INTO library_programs (library_id, program_code, verified) VALUES (
  'uuid-of-tsp-library',
  '-- Full 200-line TSP program here --',
  true
);
```

### 2. `concept_functions`

Maps individual functions to concepts with mastery tests.

**Key columns:**
- `library_id`, `concept_id` - Links to library and concept
- `function_name` - e.g., "distance", "nearest_neighbor"
- `function_signature` - e.g., "def distance(A: City, B: City) -> float:"
- `function_body` - Complete implementation
- `line_start`, `line_end` - Position in complete program
- `dependencies` - Array of functions this function calls
- `test_cases` - JSONB array of test objects

**Test case format:**
```json
[
  {
    "name": "test_basic_correctness",
    "setup": "cities = random_cities(10, seed=42)",
    "code": "tour = nearest_neighbor(cities)\nassert valid_tour(tour, cities)",
    "points": 1,
    "description": "Produces a valid tour visiting all cities"
  }
]
```

## New Helper Functions

### `get_concept_exercise(library_id, concept_id)`

Returns everything needed for a student exercise:
- Function signature and docstring
- Dependencies (what functions it calls)
- Test cases
- Complete program context (for loading in Pyodide)

**Used by:** `GET /api/concepts/[id]/exercise` endpoint

### `get_library_functions(library_id)`

Lists all functions available in a library with metadata:
- Concept association
- Difficulty level
- Number of tests
- Estimated completion time

**Used by:** Library overview page, function selector

## How It Fits Together

```
1. Import TSP notebook
   ↓
2. Extract complete program → library_programs table
   - Full Python code (120 lines)
   - Verified with smoke tests
   ↓
3. Parse & map functions → concept_functions table
   - distance() → "Euclidean Distance" concept (3 tests)
   - tour_length() → "Tour Metrics" concept (2 tests)
   - nearest_neighbor() → "Greedy Algorithms" concept (4 tests)
   ↓
4. Student clicks "I got this" on "Greedy Algorithms"
   ↓
5. Frontend calls get_concept_exercise()
   - Returns: nearest_neighbor signature + tests + complete program
   ↓
6. Pyodide loads complete program
   ↓
7. Student implements nearest_neighbor()
   ↓
8. Tests run (use student's version via redefinition)
   ↓
9. Score: 4/4 tests passed → Concept mastered!
```

## Migration Steps

1. **Apply migration:**
   ```bash
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
     -f scripts/migrations/005-add-program-and-functions.sql
   ```

2. **Verify tables created:**
   ```sql
   \d library_programs
   \d concept_functions
   ```

3. **Test with prototype data:**
   ```sql
   -- Insert TSP program
   INSERT INTO library_programs (library_id, program_code, verified, language)
   VALUES (
     (SELECT id FROM libraries WHERE slug = 'tsp' LIMIT 1),
     '-- tsp_manual.py content --',
     true,
     'python'
   );
   
   -- Insert a function
   INSERT INTO concept_functions 
     (library_id, concept_id, function_name, function_signature, function_body, test_cases)
   VALUES (
     (SELECT id FROM libraries WHERE slug = 'tsp' LIMIT 1),
     'euclidean-distance',
     'distance',
     'def distance(A: City, B: City) -> float:',
     'return abs(A - B)',
     '[{"name": "test_basic", "setup": "...", "code": "...", "points": 1}]'::jsonb
   );
   ```

4. **Rollback (if needed):**
   ```sql
   DROP TABLE concept_functions;
   DROP TABLE library_programs;
   DROP FUNCTION get_concept_exercise;
   DROP FUNCTION get_library_functions;
   ```

## Next Steps After Schema

1. **Build extraction scripts:**
   - `scripts/extract-program.ts` - Extract complete program from notebook
   - `scripts/map-functions-to-concepts.ts` - Parse functions and generate tests

2. **Update import pipeline:**
   - Add stages 5a (extract program) and 5b (map functions)
   - Store results in new tables

3. **Build API endpoints:**
   - `GET /api/libraries/[id]/program` - Fetch complete program
   - `GET /api/concepts/[id]/exercise` - Fetch exercise data

4. **Build UI:**
   - Code editor component
   - Test runner
   - "I got this" button integration
