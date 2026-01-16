# Prototype: Function Extraction & Unit Testing

**Date:** 2026-01-16  
**Status:** Step 1 Complete ✅

## What We Built

Manual prototype validating the "extract coherent program + test individual functions" approach for the TSP project.

## Files

1. **`tsp_manual.py`** (120 lines)
   - Complete, executable TSP program
   - Manually extracted from `docs/TSP.ipynb`
   - Includes: imports, types, core functions, algorithms
   - Runs successfully with built-in smoke tests

2. **`test_tsp_manual.py`** (85 lines)
   - Manual test suite for 3 functions
   - `distance()` - 3 tests (Euclidean Distance concept)
   - `tour_length()` - 2 tests (Tour Metrics concept)
   - `valid_tour()` - 3 tests (Tour Validation concept)
   - All 8 tests pass ✅

3. **`test_simple_append.py`** (95 lines)
   - **Key discovery:** Tests simple function redefinition
   - Loads complete program, student redefines function
   - Python's late binding makes this work automatically
   - 4/4 integration tests pass ✅

## Key Discovery: No Monkey-Patching Needed!

Originally thought we'd need to:
- Remove target function from program
- Student writes implementation
- Manually wire up dependencies

**Actually:** Just do this:
```python
# Load complete program (with original function)
exec(open('tsp_manual.py').read())

# Student redefines the function
def distance(A, B):
    return abs(A - B)

# Tests automatically use student's version!
tour = [City(0,0), City(3,0), City(3,4)]
length = tour_length(tour)  # Calls student's distance()
```

**Why:** Python looks up function names at **call time**, not definition time.

## Validation Results

### Test Run 1: Basic Program
```bash
$ python tsp_manual.py
Testing TSP functions...
✓ exhaustive_tsp: 8 cities, length 24165.9
✓ nearest_tsp: 8 cities, length 28526.3
All tests passed!
```

### Test Run 2: Manual Test Suite
```bash
$ python test_tsp_manual.py
Running manual test suite...

Testing distance()...
✓ test_distance_basic: PASS
✓ test_distance_symmetric: PASS
✓ test_distance_zero: PASS

Testing tour_length()...
✓ test_tour_length_triangle: PASS
✓ test_tour_length_single_city: PASS

Testing valid_tour()...
✓ test_valid_tour_correct: PASS
✓ test_valid_tour_missing_city: PASS
✓ test_valid_tour_duplicate: PASS

✓ All 8 tests passed!
```

### Test Run 3: Simple Append Approach
```bash
$ python test_simple_append.py
=== Simple Append Test: Student implements distance() ===

✓ test_basic_correctness: PASS
✓ test_symmetry: PASS
✓ test_integration_tour_length: PASS
✓ test_integration_nearest_tsp: PASS

Score: 4/4 tests passed
🎉 Concept mastered! All tests passed.
```

## What This Proves

1. ✅ **Extracting coherent programs works** - TSP notebook → runnable Python file
2. ✅ **Tests can use program context** - `random_cities()`, `City`, `tour_length()` available
3. ✅ **Integration testing works** - Student's function integrates with rest of program
4. ✅ **Simple redefinition is sufficient** - No complex monkey-patching needed
5. ✅ **Ready for automation** - Pattern is clear, can now build LLM scripts

## Next Steps

**Step 2: Automate Program Extraction**
- Create `scripts/extract-program.ts`
- Use Gemini to extract complete program from notebook
- Add verification tests
- Target: `npx tsx scripts/extract-program.ts docs/TSP.ipynb` → working Python file

**Step 3: Automate Function Mapping**
- Create `scripts/map-functions-to-concepts.ts`
- Parse extracted program for functions
- Use Gemini to associate functions with concepts
- Generate test cases (3-5 per function)
- Target: JSON with function metadata + tests

## Architecture Simplified

Original plan had complex monkey-patching. New plan is simpler:

```
1. Extract complete program (includes all functions)
2. Store in library_programs table
3. For each exercise:
   - Load complete program in Pyodide
   - Show student target function signature
   - Student writes implementation (redefines function)
   - Run tests (automatically use student's version)
   - Score: X/Y tests passed
```

This is **much simpler** and more robust!
