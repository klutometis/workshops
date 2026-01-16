"""
Manual test cases for TSP functions
Demonstrates how mastery tests would work
"""

from tsp_manual import City, distance, tour_length, valid_tour, random_cities, Cities

# Test Suite for distance() function
# Concept: "Euclidean Distance"

def test_distance_basic():
    """Basic distance calculation (3-4-5 triangle)"""
    a = City(0, 0)
    b = City(3, 4)
    assert distance(a, b) == 5.0, "Distance of 3-4-5 triangle should be 5"
    print("✓ test_distance_basic: PASS")

def test_distance_symmetric():
    """Distance should be symmetric (A→B = B→A)"""
    a = City(10, 20)
    b = City(30, 40)
    d1 = distance(a, b)
    d2 = distance(b, a)
    assert d1 == d2, f"Distance should be symmetric: {d1} ≠ {d2}"
    print("✓ test_distance_symmetric: PASS")

def test_distance_zero():
    """Distance from a city to itself should be zero"""
    a = City(100, 200)
    assert distance(a, a) == 0.0, "Distance to self should be 0"
    print("✓ test_distance_zero: PASS")

# Test Suite for tour_length() function
# Concept: "Tour Metrics"

def test_tour_length_triangle():
    """Tour length for a triangle should be perimeter"""
    # 3-4-5 right triangle
    tour = [City(0, 0), City(3, 0), City(3, 4)]
    # Perimeter: 3 + 4 + 5 = 12
    length = tour_length(tour)
    assert abs(length - 12.0) < 0.01, f"Expected ~12, got {length}"
    print("✓ test_tour_length_triangle: PASS")

def test_tour_length_single_city():
    """Single city tour should have zero length"""
    tour = [City(50, 50)]
    assert tour_length(tour) == 0.0, "Single city tour should have 0 length"
    print("✓ test_tour_length_single_city: PASS")

# Test Suite for valid_tour() function
# Concept: "Tour Validation"

def test_valid_tour_correct():
    """A proper tour should validate"""
    cities = random_cities(5, seed=42)
    tour = list(cities)
    assert valid_tour(tour, cities), "Tour visiting all cities should be valid"
    print("✓ test_valid_tour_correct: PASS")

def test_valid_tour_missing_city():
    """Tour missing a city should be invalid"""
    cities = random_cities(5, seed=42)
    tour = list(cities)[:-1]  # Drop last city
    assert not valid_tour(tour, cities), "Tour missing a city should be invalid"
    print("✓ test_valid_tour_missing_city: PASS")

def test_valid_tour_duplicate():
    """Tour with duplicate city should be invalid"""
    cities = random_cities(5, seed=42)
    tour = list(cities)
    tour.append(tour[0])  # Add duplicate
    assert not valid_tour(tour, cities), "Tour with duplicate should be invalid"
    print("✓ test_valid_tour_duplicate: PASS")

if __name__ == "__main__":
    print("Running manual test suite...\n")
    
    print("Testing distance()...")
    test_distance_basic()
    test_distance_symmetric()
    test_distance_zero()
    
    print("\nTesting tour_length()...")
    test_tour_length_triangle()
    test_tour_length_single_city()
    
    print("\nTesting valid_tour()...")
    test_valid_tour_correct()
    test_valid_tour_missing_city()
    test_valid_tour_duplicate()
    
    print("\n✓ All 8 tests passed!")
