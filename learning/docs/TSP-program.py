import functools
import itertools
import pathlib
import random
import time
import math
import re
import matplotlib.pyplot as plt
from collections import Counter, defaultdict, namedtuple
from statistics import mean, median, stdev
from typing import Set, List, Tuple, Iterable, Dict

City = complex  # e.g. City(300, 100)
Cities = frozenset  # A set of cities
Tour = list  # A list of cities visited, in order
TSP = callable  # A TSP algorithm is a callable function
Link = Tuple[City, City]  # A city-city link
Segment = list  # A portion of a tour; it does not loop back to the start.
TestSet = Tuple[Cities]

def distance(A: City, B: City) -> float:
    "Distance between two cities"
    return abs(A - B)

def tour_length(tour: Tour) -> float:
    "The total distances of each link in the tour, including the link from last back to first."
    return sum(distance(tour[i], tour[i - 1]) for i in range(len(tour)))

def valid_tour(tour: Tour, cities: Cities) -> bool:
    "Does `tour` visit every city in `cities` exactly once?"
    return Counter(tour) == Counter(cities)

def first(collection):
    """The first element of a collection."""
    return next(iter(collection))

def nearest_neighbor(A: City, cities) -> City:
    """Find the city C in cities that is nearest to city A."""
    return min(cities, key=lambda C: distance(C, A))

def possible_tours(cities) -> List[Tour]:
    "Return a list of non-redundant tours (permutations of cities with first city first)."
    start, *others = cities
    return [[start, *perm] for perm in itertools.permutations(others)]

def shortest(tours: Iterable[Tour]) -> Tour:
    "The tour with the smallest tour length."
    return min(tours, key=tour_length)

def random_cities(n, seed=1234, width=9999, height=6666) -> Cities:
    "Make a set of n cities, sampled uniformly from a (width x height) rectangle."
    random.seed(hash((n, seed)))  # To make `random_cities` reproducible
    return Cities(City(random.randrange(width), random.randrange(height))
                  for c in range(n))

def exhaustive_tsp(cities) -> Tour:
    "Generate all possible tours of the cities and choose the shortest one."
    return shortest(possible_tours(cities))

def Xs(cities) -> List[float]: "X coordinates"; return [c.real for c in cities]
def Ys(cities) -> List[float]: "Y coordinates"; return [c.imag for c in cities]

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

def parse_cities(text, skip=('AK', 'HI'), long_scale=-48, lat_scale=69) -> Cities:
    """Make a set of Cities from lines of text, skipping the specified states."""
    return Cities(City(int(long_scale * float(long)), int(lat_scale  * float(lat)))
                  for (lat, long, state) in re.findall(r'([\d.]+)\s+([\d.]+).+([A-Z][A-Z])', text)
                  if state not in skip)

def sample(population, n, seed=42) -> Iterable:
    "Return a list of n elements sampled from population. Set random.seed."
    random.seed(hash((n, seed)))
    return random.sample(population, min(n, len(population)))

def rep_nearest_tsp(cities, k=10):
    "Repeat nearest_tsp starting from k different cities; pick the shortest tour."
    return shortest(nearest_tsp(cities, start) for start in sample(cities, k))

def reversal_is_improvement(tour, i, j) -> bool:
    "Would reversing the segment `tour[i:j]` make the tour shorter?" 
    # Given tour [...A,B--C,D...], would reversing B--C make the tour shorter?
    A, B, C, D = tour[i-1], tour[i], tour[j-1], tour[j % len(tour)]
    return distance(A, B) + distance(C, D) > distance(A, C) + distance(B, D)

cache = functools.lru_cache(None) # Or just `functools.cache` in Python 3.9+
        
@cache # All tours of length N have the same subsegments, so cache them.
def subsegments(N) -> Tuple[Tuple[int, int]]:
    "Return (i, j) index pairs denoting tour[i:j] subsegments of a tour of length N."
    return tuple((i, i + length)
                 for length in reversed(range(2, N - 1))
                 for i in range(N - length))

def opt2(tour) -> Tour:
    "Perform 2-opt segment reversals to optimize tour."
    changed = False
    old_tour = list(tour) # make a copy
    for (i, j) in subsegments(len(tour)):
        if reversal_is_improvement(tour, i, j):
            tour[i:j] = reversed(tour[i:j])
            changed = True
    return (tour if not changed else opt2(tour))

class Result(namedtuple('_', 'tsp, opt, tour, cities, secs')):
    """A `Result` records the results of a `run` on a TSP."""
    def __repr__(self): 
        best = min([length(r) for r in all_results[self.cities]], default=length(self))
        return (f"{name(self.tsp, self.opt):>25}: length {round(length(self)):,d} tour "
                f"({length(self)/best:5.1%}) in {self.secs:6.3f} secs")   

all_results = defaultdict(list) # {cities: [tour, ...]}

def name(tsp, opt=None) -> str: return tsp.__name__ + (('+' + opt.__name__) if opt else '')
    
def length(result: Result) -> float: return tour_length(result.tour)

@cache
def run(tsp: TSP, cities: Cities, opt=None) -> Result:
    """Run a TSP algorithm on a set of cities and return results."""
    if opt: # recursively run unoptimized version; add .secs for that to opt(tour)
        res0  = run(tsp, cities, None)
        t0    = time.perf_counter()
        tour  = opt(Tour(res0.tour))
        t1    = time.perf_counter()
        secs  = res0.secs + t1 - t0
    else: # run the tsp
        t0    = time.perf_counter()
        tour  = tsp(cities)
        t1    = time.perf_counter()
        secs  = t1 - t0
    result = Result(tsp, opt, tour, cities, secs)
    all_results[cities].append(result)
    assert valid_tour(tour, cities)
    return result

def rep_opt2_nearest_tsp(cities, k=10) -> Tour: 
    """Apply 2-opt to *each* of the repeated nearest neighbors tours."""
    return shortest(opt2(nearest_tsp(cities, start)) for start in sample(cities, k))

def shortest_links_first(cities) -> List[Link]:
    "Return all links between cities, sorted shortest first."
    return sorted(itertools.combinations(cities, 2), key=lambda link: distance(*link))
            
def join_segments(endpoints, A, B):
    "Join segments [...,A] + [B,...] into one segment. Maintain `endpoints`."
    Aseg, Bseg = endpoints[A], endpoints[B]
    if Aseg[-1] is not A: Aseg.reverse()
    if Bseg[0]  is not B: Bseg.reverse()
    Aseg += Bseg
    del endpoints[A], endpoints[B] 
    endpoints[Aseg[0]] = endpoints[Aseg[-1]] = Aseg
    return Aseg

def greedy_tsp(cities):
    """Go through links, shortest first. If a link can join segments, do it."""
    endpoints = {C: [C] for C in cities} # A dict of {endpoint: segment}
    links = itertools.combinations(cities, 2)
    for (A, B) in shortest_links_first(cities):
        if A in endpoints and B in endpoints and endpoints[A] != endpoints[B]:
            joined_segment = join_segments(endpoints, A, B)
            if len(joined_segment) == len(cities):
                return joined_segment

def X_(city) -> int: "X coordinate"; return city.real
def Y_(city) -> int: "Y coordinate"; return city.imag

def extent(numbers) -> float: return max(numbers) - min(numbers)

def split_cities(cities) -> Tuple[List[City], List[City]]:
    "Split cities vertically if map is wider; horizontally if map is taller."
    coord  = (X_ if (extent(Xs(cities)) > extent(Ys(cities))) else Y_)
    cities = sorted(cities, key=coord)
    middle = len(cities) // 2
    return cities[:middle], cities[middle:]

def rotations(sequence):
    "All possible rotations of a sequence."
    # A rotation is some suffix of the sequence followed by the rest of the sequence.
    return [sequence[i:] + sequence[:i] for i in range(len(sequence))]

def join_tours(tour1, tour2):
    "Consider all ways of joining the two tours together, and pick the shortest."
    segments1, segments2 = rotations(tour1), rotations(tour2)
    return shortest(s1 + s3
                    for s1 in segments1
                    for s2 in segments2
                    for s3 in (s2, s2[::-1]))

def divide_tsp(cities, split=7) -> Tour:
    """Find a tour by divide and conquer: if number of cities is `split` or more, then split
    the cities in half, solve each half recursively, then join those two tours together.
    Otherwise solve with `exhaustive_tsp`."""
    if len(cities) < split:
        return exhaustive_tsp(cities)
    else:
        half1, half2 = split_cities(cities)
        return join_tours(divide_tsp(half1, split), divide_tsp(half2, split))

def mst(vertexes):
    """Given a set of vertexes, build a minimum spanning tree: a dict of the form 
    {parent: [child...]}, spanning all vertexes."""
    tree  = {first(vertexes): []} # the first city is the root of the tree.
    links = shortest_links_first(vertexes)
    while len(tree) < len(vertexes):
        (A, B) = first((A, B) for (A, B) in links if (A in tree) ^ (B in tree))
        if A not in tree: (A, B) = (B, A)
        tree[A].append(B)
        tree[B] = []
    return tree

def preorder_traversal(tree, root):
    "Traverse tree in pre-order, starting at root of tree."
    yield root
    for child in tree.get(root, ()):
        yield from preorder_traversal(tree, child)

def mst_tsp(cities) -> Tour:
    "Create a minimum spanning tree and walk it in pre-order."
    return Tour(preorder_traversal(mst(cities), first(cities)))

@cache
def shortest_segment(A, Bs, C) -> Segment:
    "The shortest segment starting at A, going through all Bs, and ending at C."
    if not Bs:
        return [A, C]
    else:
        return min((shortest_segment(A, Bs - {B}, B) + [C] for B in Bs),
                   key=segment_length)
            
def segment_length(segment):
    "The total of distances between each pair of consecutive cities in the segment."
    # Same as tour_length, but without distance(tour[0], tour[-1])
    return sum(distance(segment[i], segment[i-1]) 
               for i in range(1, len(segment)))

def held_karp_tsp(cities) -> Tour:
    """The Held-Karp shortest tour of this set of cities.
    For each end city C, find the shortest segment from A (the start) to C.
    Out of all these shortest segments, pick the one that is the shortest tour."""
    A = first(cities)
    shortest_segment.cache_clear() # Clear cache for a new problem
    return shortest(shortest_segment(A, cities - {A, C}, C)
                    for C in cities - {A})

def test_set(s: int, n: int) -> TestSet:
    "Return `s` different sets of `n` random cities."
    return tuple(random_cities(n, seed=(s, i)) for i in range(s))

@cache
def benchmark(algorithm, tests, opt=None, **kwds) -> List[run]:
    "Benchmark one TSP algorithm on a test suite; return a list of `run`s."
    return [run(algorithm, test, opt=opt, **kwds) for test in tests]

def boxplot_label(tsp, lengths, times, best):
    "A label for the bottom of the boxplot."
    return '{}\n{:.0f} ± {:.1f} msec\n{:,d} med len\n{:,d} ± {:,d} mean\n{:.2%} mean'.format(
           name(tsp), mean(times) * 1000, stdev(times) * 1000, 
           round(median(lengths)), round(mean(lengths)), round(stdev(lengths)), mean(lengths) / best)

def rankings(algorithms, tests: TestSet, opt=None, **kwds):
    "Print a table of how often each algorithm had each rank: you get a #1 if you were shortest."
    N = len(algorithms)
    runslists = [benchmark(tsp, tests, opt=opt, **kwds) for tsp in algorithms]
    lengthlists = [[round(length(r)) for r in runs] for runs in runslists]
    # ordered[i] is all tour lengths (for all algorithms) for the i-th problem, sorted
    ordered = [sorted(L) for L in zip(*lengthlists)]
    fmt = ('{:>4}' * len(algorithms) + ' | {}').format
    print(fmt(*['#' + str(i + 1) for i in range(N)], 'Algorithm'))
    print(' ---' * N + ' | ---------')
    for alg, lengths in zip(algorithms, lengthlists):
        ranks = Counter(ordered[i].index(lengths[i]) for i in range(len(tests)))
        print(fmt(*[ranks[i] for i in range(N)], name(alg)))

def runs(tsps, cities, opts=(None, opt2)) -> List[Result]:
    """Run each of the tsps on the cities, and return a list of all results on `cities`."""
    for tsp, opt in itertools.product(tsps, opts):
        run(tsp, cities, opt)
    all_results[cities].sort(key=length)
    return all_results[cities]

def compare(algorithms, tests=test_set(50, 200), opt=None):
    """Compare algorithms with boxplots and rankings."""
    rankings(algorithms, tests, opt=opt)

def plot_tour(tour: Tour, style='bo-', hilite='rs', title=''): 
    "Plot every city and link in the tour, and highlight the start city."
    scale = 1 + len(tour) ** 0.5 // 10
    plt.figure(figsize=((3 * scale, 2 * scale)))
    start = tour[0]
    plot_segment([*tour, start], style)
    plot_segment([start], hilite) 
    plt.title(title)

def plot_segment(segment: Segment, style='bo:'):
    "Plot every city and link in the segment."
    plt.plot(Xs(segment), Ys(segment), style, linewidth=2/3, markersize=4, clip_on=False)
    plt.axis('scaled'); plt.axis('off')

def boxplots(algorithms, tests: TestSet, opt=None, **kwds):
    "Draw a boxplot for each of the algorithms executing the tests."
    runslists = [benchmark(tsp, tests, opt=opt, **kwds) for tsp in algorithms]
    lengthlists = [[length(r) for r in runs] for runs in runslists]
    timelists   = [[r.secs for r in runs] for runs in runslists]
    best   = min(map(mean, lengthlists))
    labels = [boxplot_label(A, L, T, best) for (A, L, T) in zip(algorithms, lengthlists, timelists)]
    plt.figure(figsize=(15, 7.5))
    plt.grid(axis='y'); plt.ylabel('Mean Tour Length')
    plt.tick_params(axis='x', which='major', labelsize=12)
    plt.boxplot(lengthlists, labels=labels, showmeans=True, whis=(10, 90), sym='o', notch=True)
    plt.title(f"{len(tests)} sets of {len(tests[0])} cities with {opt.__name__ if opt else 'no'} optimization")

def greedy_tsp_generator(cities) -> Iterable[Dict[City, Segment]]:
    """Go through links, shortest first. If a link can join segments, do it.
    Yield the dict of {endpoint: segment} on each iteration."""
    endpoints = {C: [C] for C in cities} # A dict of {endpoint: segment}
    links = itertools.combinations(cities, 2)
    for (A, B) in sorted(links, key=lambda link: distance(*link)):
        if A in endpoints and B in endpoints and endpoints[A] != endpoints[B]:
            joined_segment = join_segments(endpoints, A, B)
            yield endpoints
            if len(joined_segment) == len(cities):
                return

def plot_greedy_tsp(cities, plot_sizes=(1000, 500, 250, 125, 60, 30, 15, 10, 5, 2, 1)):
    """Plot segments during the process of `greedy_tsp`, at specified plot_sizes."""
    for endpoints in greedy_tsp_generator(cities):
        segments = set(map(tuple, endpoints.values()))
        if len(segments) in plot_sizes:
            for s in segments:
                plot_segment(s, style='o-')
            plt.title(f'{len(segments)} segments:')
            plt.show()

def ensemble_tsp(cities, algorithms=[nearest_tsp, rep_nearest_tsp, greedy_tsp, divide_tsp, mst_tsp], opt=opt2):
    "Apply an ensemble of algorithms to cities and take the shortest resulting tour."
    return shortest(run(tsp, cities, opt=opt).tour for tsp in algorithms)

if __name__ == "__main__":
    # Basic smoke tests
    cities = random_cities(8)
    tour = exhaustive_tsp(cities)
    print(f"Exhaustive TSP tour length: {tour_length(tour)}")

    cities = random_cities(20)
    tour = nearest_tsp(cities)
    print(f"Nearest TSP tour length: {tour_length(tour)}")