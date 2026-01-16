"""
Test simple append approach (no monkey-patching needed!)
This simulates what will happen in the Pyodide scratchpad
"""

print("=== Simple Append Test: Student implements distance() ===\n")

# Step 1: Load complete program (including original distance)
print("Step 1: Loading complete program context...")
exec(open('tsp_manual.py').read())
print("✓ Complete TSP program loaded")
print("  - City, tour_length, random_cities, etc. available")
print("  - Original distance() also available\n")

# Step 2: Student writes their implementation
# (This simply redefines distance() in the same scope)
print("Step 2: Student writes their implementation...")
print("```python")
print("def distance(A, B):")
print('    """My implementation of Euclidean distance"""')
print("    return abs(A - B)")
print("```\n")

def distance(A, B):
    """My implementation of Euclidean distance"""
    return abs(A - B)

print("✓ Student's distance() defined (replaces original)\n")

# Step 3: Run tests
print("Step 3: Running tests...\n")

test_results = []

# Test 1: Basic correctness
try:
    a = City(0, 0)
    b = City(3, 4)
    result = distance(a, b)
    assert result == 5.0
    print("✓ test_basic_correctness: PASS")
    test_results.append(True)
except AssertionError as e:
    print(f"✗ test_basic_correctness: FAIL - {e}")
    test_results.append(False)

# Test 2: Symmetry
try:
    a = City(10, 20)
    b = City(30, 40)
    assert distance(a, b) == distance(b, a)
    print("✓ test_symmetry: PASS")
    test_results.append(True)
except AssertionError:
    print("✗ test_symmetry: FAIL - distance not symmetric")
    test_results.append(False)

# Test 3: Integration with tour_length
try:
    tour = [City(0, 0), City(3, 0), City(3, 4)]
    length = tour_length(tour)  # Uses student's distance()!
    assert abs(length - 12.0) < 0.01
    print("✓ test_integration_tour_length: PASS")
    test_results.append(True)
except AssertionError:
    print(f"✗ test_integration_tour_length: FAIL - expected 12, got {length}")
    test_results.append(False)

# Test 4: Works with algorithms
try:
    cities = random_cities(5, seed=42)
    tour = nearest_tsp(cities)  # This internally uses distance()!
    assert valid_tour(tour, cities)
    print("✓ test_integration_nearest_tsp: PASS")
    test_results.append(True)
except Exception as e:
    print(f"✗ test_integration_nearest_tsp: FAIL - {e}")
    test_results.append(False)

# Results
passed = sum(test_results)
total = len(test_results)

print(f"\n{'='*50}")
print(f"Score: {passed}/{total} tests passed")
print(f"{'='*50}")

if passed == total:
    print("\n🎉 Concept mastered! All tests passed.")
else:
    print(f"\n⚠️  {total - passed} test(s) failed. Keep trying!")

print("\nKey insight:")
print("- NO monkey-patching needed")
print("- Just load program, then student redefines function")
print("- Python's late binding handles the rest")
