"""
TSP (Traveling Salesperson Problem) - Complete Program
Manually extracted from TSP.ipynb for prototyping
"""

# Imports
import functools
import itertools
import pathlib
import random
import time  
import math
import re
import matplotlib.pyplot as plt      
from collections import Counter, defaultdict, namedtuple
from statistics  import mean, median, stdev
from typing      import Set, List, Tuple, Iterable, Dict

# Type Aliases
City   = complex   # e.g. City(300, 100)
Cities = frozenset # A set of cities
Tour   = list      # A list of cities visited, in order
TSP    = callable  # A TSP algorithm is a callable function
Link   = Tuple[City, City] # A city-city link
Segment = list # A portion of a tour; it does not loop back to the start.

# Core Functions

def distance(A: City, B: City) -> float: 
    "Distance between two cities"
    return abs(A - B)

def shortest(tours: Iterable[Tour]) -> Tour: 
    "The tour with the smallest tour length."
    return min(tours, key=tour_length)

def tour_length(tour: Tour) -> float:
    "The total distances of each link in the tour, including the link from last back to first."
    return sum(distance(tour[i], tour[i - 1]) for i in range(len(tour)))

def valid_tour(tour: Tour, cities: Cities) -> bool:
    "Does `tour` visit every city in `cities` exactly once?"
    return Counter(tour) == Counter(cities)

def random_cities(n, seed=1234, width=9999, height=6666) -> Cities:
    "Make a set of n cities, sampled uniformly from a (width x height) rectangle."
    random.seed(seed * 10000 + n) # To make `random_cities` reproducible
    return Cities(City(random.randrange(width), random.randrange(height))
                  for c in range(n))

# Visualization Functions

def Xs(cities) -> List[float]: 
    "X coordinates"
    return [c.real for c in cities]

def Ys(cities) -> List[float]: 
    "Y coordinates"
    return [c.imag for c in cities]

def plot_segment(segment: Segment, style='bo:'):
    "Plot every city and link in the segment."
    plt.plot(Xs(segment), Ys(segment), style, linewidth=2/3, markersize=4, clip_on=False)
    plt.axis('scaled')
    plt.axis('off')

def plot_tour(tour: Tour, style='bo-', hilite='rs', title=''): 
    "Plot every city and link in the tour, and highlight the start city."
    scale = 1 + len(tour) ** 0.5 // 10
    plt.figure(figsize=((3 * scale, 2 * scale)))
    start = tour[0]
    plot_segment([*tour, start], style)
    plot_segment([start], hilite) 
    plt.title(title)

# Utility Functions

def first(collection): 
    "The first element of a collection."
    return next(iter(collection))

def possible_tours(cities) -> List[Tour]:
    "Return a list of non-redundant tours (permutations of cities with first city first)."
    start, *others = cities
    return [[start, *perm] for perm in itertools.permutations(others)]

# TSP Algorithms

def exhaustive_tsp(cities) -> Tour:
    "Generate all possible tours of the cities and choose the shortest one."
    return shortest(possible_tours(cities))

def nearest_neighbor(A: City, cities) -> City:
    "Find the city C in cities that is nearest to city A."
    return min(cities, key=lambda C: distance(C, A))

def nearest_tsp(cities, start=None) -> Tour:
    """Create a partial tour that initially is just the start city. 
    At each step extend the partial tour to the nearest unvisited neighbor 
    of the last city in the partial tour, while there are unvisited cities remaining."""
    start = start or first(cities)
    tour = [start]
    unvisited = set(cities) - {start}
    def extend_to(C): tour.append(C); unvisited.remove(C)
    while unvisited:
        extend_to(nearest_neighbor(tour[-1], unvisited))
    return tour

# Test/Demo function
def run(tsp: callable, cities: Cities):
    """Run a TSP algorithm on a set of cities and print results."""
    t0   = time.perf_counter()
    tour = tsp(cities)
    t1   = time.perf_counter()
    L    = tour_length(tour)
    print(f"length {round(L):,d} tour of {len(cities)} cities in {t1 - t0:.3f} secs")
    return tour

if __name__ == "__main__":
    # Quick smoke test
    print("Testing TSP functions...")
    
    # Test with small set of cities
    cities = random_cities(8)
    
    # Test exhaustive algorithm
    tour = exhaustive_tsp(cities)
    assert valid_tour(tour, cities), "Exhaustive TSP failed validation"
    print(f"✓ exhaustive_tsp: {len(tour)} cities, length {tour_length(tour):.1f}")
    
    # Test nearest neighbor algorithm
    tour = nearest_tsp(cities)
    assert valid_tour(tour, cities), "Nearest neighbor TSP failed validation"
    print(f"✓ nearest_tsp: {len(tour)} cities, length {tour_length(tour):.1f}")
    
    print("\nAll tests passed!")
