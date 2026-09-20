<div style="text-align:right"><i>Peter Norvig<br>2006, 2021</i></div>

# Solving Any Sudoku Puzzle

The rules of <a href="http://en.wikipedia.org/wiki/Sudoku">Sudoku</a> are simple and finite: fill in the empty squares in the puzzle so that each column, row, and 3×3 box contains all the digits from 1 to 9 with no repeats. For example:

|Puzzle|-|Solution|
|---|--|---|
|![](https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Sudoku_Puzzle_by_L2G-20050714_standardized_layout.svg/361px-Sudoku_Puzzle_by_L2G-20050714_standardized_layout.svg.png)|&nbsp;&nbsp;|![](https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Sudoku_Puzzle_by_L2G-20050714_solution_standardized_layout.svg/361px-Sudoku_Puzzle_by_L2G-20050714_solution_standardized_layout.svg.png)|

This notebook develops a program to solve any Sudoku puzzle, in about 80 lines of Python. You can also see:
  - The [original 2006 version of this program](http://norvig.com/sudoku.html); it has some obsolete Python idioms.
  - [A Java program for Sudoku](SudokuJava.ipynb) that is less clear but faster, solving over 100,000 puzzles per second.
  - [A Python program for Star Battle](StarBattle.ipynb), a related fill-in-the-grid puzzle.
  - [A Python program for KenKen](KenKen.ipynb), a related fill-in-the-grid puzzle.


# Sudoku: Implementing Basic Concepts 

Here are the key concepts and the Python implementation choices I made. Types are in Uppercase and constants in lowercase:

- **Digit**: the digits are the characters `'1'` to `'9'`. 
- **Digit set**: when several digits could fill a square, use `'123'` to mean  1, 2, or 3 are possible.
- **rows**: by convention the 9 rows have labels `'A'` to `'I'` (top to bottom). 
- **columns**: by convention the 9 columns have labels `'1'` to `'9'` (left to right).
- **Square**: a square is named by the concatenation of its row and column labels, e.g. `'A9'` is the upper-rightmost square.
  - `squares` is a tuple of all 81 squares.
- **Grid**: a grid of 81 squares is represented as a dict of `{Square: DigitSet}` such as `{'A9': '123', ...}`.
- **Boxes**: the 9 boxes are 3×3 squares within the grid (outlined with heavy black lines in the diagram). 
  - `all_boxes` is a list of all 9 boxes
- **Unit**: a unit is a row, column, or box; each unit is a tuple of 9 squares. 
  - `all_units` is a list of all 27 units.
  - `units` is a dict such that `units[s]` is a tuple of the 3 units that square `s` is a part of.
- **Peers**: the squares that share a unit are called peers. 
  - `peers` is a dict such that `peers[s]` is a set of 20 squares that are in some unit with `s`.
- **None**: If a puzzle has no solution, we represent that with `None`.
- **Picture**: for input and output, a string is used to describe the grid (details described below).
- **Solution**: A grid is a valid solution to a puzzle if every unit is filled with all nine digits, one to a square, with no repeats, and each square that was filled with a digit in the puzzle has the same digit in the solution.


```python
import re
from typing import Dict, Optional

def cross(A, B) -> tuple:
    "Cross product of strings in A and strings in B."
    return tuple(a + b for a in A for b in B)

Digit     = str  # e.g. '1'
digits    = '123456789'
DigitSet  = str  # e.g. '123'
rows      = 'ABCDEFGHI'
cols      = digits
Square    = str  # e.g. 'A9'
squares   = cross(rows, cols)
Grid      = Dict[Square, DigitSet] # E.g. {'A9': '123', ...}
all_boxes = [cross(rs, cs)  for rs in ('ABC','DEF','GHI') for cs in ('123','456','789')]
all_units = [cross(rows, c) for c in cols] + [cross(r, cols) for r in rows] + all_boxes
units     = {s: tuple(u for u in all_units if s in u) for s in squares}
peers     = {s: set().union(*units[s]) - {s} for s in squares}
Picture   = str 

def is_solution(solution: Grid, puzzle: Grid) -> bool:
    "Is this proposed solution to the puzzle actually valid?"
    return (solution is not None and
            all(solution[s] in puzzle[s] for s in squares) and
            all({solution[s] for s in unit} == set(digits) for unit in all_units))
```

For example,
here are the three units (and the 20 peers) for the square <b><tt  style="color:red">C2</tt></b>:

<pre>
.  A2 . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .         A1 A2 A3|.  .  . |.  .  .  
.  B2 . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .         B1 B2 B3|.  .  . |.  .  .  
.  <b style="color:red">C2</b> . |.  .  . |.  .  .         C1 <b style="color:red">C2</b> C3|C4 C5 C6|C7 C8 C9        C1 <b style="color:red">C2</b> C3|.  .  . |.  .  .  
--------+--------+--------        --------+--------+--------        --------+--------+-------- 
.  D2 . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .  
.  E2 . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .  
.  F2 . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .  
--------+--------+--------        --------+--------+--------        --------+--------+-------- 
.  G2 . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .  
.  H2 . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .  
.  I2 . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  .         .  .  . |.  .  . |.  .  . 
</pre>

  

 


```python
units['C2']
```

```
(('A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2', 'H2', 'I2'),
 ('C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'),
 ('A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'))
```

```python
peers['C2']
```

```
{'A1',
 'A2',
 'A3',
 'B1',
 'B2',
 'B3',
 'C1',
 'C3',
 'C4',
 'C5',
 'C6',
 'C7',
 'C8',
 'C9',
 'D2',
 'E2',
 'F2',
 'G2',
 'H2',
 'I2'}
```

# Constraint Propagation

Sudoku players know these two key strategies:

1. If a square has only one possible digit, then **eliminate** that digit as a possibility for each of the square's peers.
2. If a unit has only one possible square that can hold a digit, then **fill** the square with the digit.</i>

This suggests  two  functions:
1. `eliminate(grid, s, d)` to eliminate digit `d` as a possibility for square `s`
2. `fill(grid, s, d)` to fill square `s` with the digit `d`.  

You might think that `fill` is the most fundamental operation, and that it could be implemented with `grid[s] = d`. But it turns out the code is simpler if we think of `eliminate` as the fundamental operation, and implement `fill` as  "eliminate all the digits except for `d` from `s`." Both functions mutate the grid they are passed, and return the mutated grid if they can perform the operation, or return `None` if there is a contradiction.

We say that these two strategies constitute [constraint propagation](http://en.wikipedia.org/wiki/Constraint_satisfaction): "constraint" because they constrain what values can go in what squares, and "propagation" because a `fill` of one square can lead to an `eliminate` in other squares, which can in turn cause a `fill` of yet another square, and so on. 

The function `constrain` starts the whole process off. We initialize a new grid, `result`, (so that the original puzzle is not mutated), where `result` is filled with the known digits from the original grid. 

Here is the code:


```python
def constrain(grid) -> Grid:
    "Propagate constraints on a copy of grid to yield a new constrained Grid."
    result: Grid = {s: digits for s in squares}
    for s in grid:
        if len(grid[s]) == 1:
            fill(result, s,  grid[s])
    return result

def fill(grid: Grid, s: Square, d: Digit) -> Optional[Grid]:
    """Eliminate all the digits except d from grid[s]."""
    if grid[s] == d or all(eliminate(grid, s, d2) for d2 in grid[s] if d2 != d):
        return grid
    else:
        return None

def eliminate(grid: Grid, s: Square, d: Digit) -> Optional[Grid]:
    """Eliminate d from grid[s]; implement the two constraint propagation strategies."""
    if d not in grid[s]:
        return grid        ## Already eliminated
    grid[s] = grid[s].replace(d, '')
    if not grid[s]:
        return None        ## None: no legal digit left
    elif len(grid[s]) == 1:
        # 1. If a square has only one possible digit, then eliminate that digit as a possibility for each of the square's peers.
        d2 = grid[s]
        if not all(eliminate(grid, s2, d2) for s2 in peers[s]):
            return None    ## None: can't eliminate d2 from some square
    for u in units[s]:
        dplaces = [s for s in u if d in grid[s]]
        # 2. If a unit has only one possible square that can hold a digit, then fill the square with the digit.
        if not dplaces or (len(dplaces) == 1 and not fill(grid, dplaces[0], d)):
            return None    ## None: no place in u for d
    return grid
```

# Input and Output: Pictures and Grids

To show how constraint propagation works, we will need to read in a string representing a puzzle (what we call a `Picture`), convert that picture to a `Grid`, apply constraint propagation, convert the solution back to a picture, and display the picture.  Conventions for `Picture`:
- A filled square is represented by a single digit, e.g.: `5`.
- A blank square is represented by a period: `.`.
- Spaces, newlines, and dashes/bars to separate boxes are included on output, but are optional (and ignored) on input.
- An uncertain square is represented by a DigitSet in braces, e.g.: `{123}`.


```python
def parse(picture) -> Grid:
    """Convert a Picture to a Grid."""
    vals = re.findall(r"[.1-9]|[{][1-9]+[}]", picture)
    assert len(vals) == 81
    return {s: digits if v == '.' else re.sub(r"[{}]", '', v) 
            for s, v in zip(squares, vals)}

def picture(grid) -> Picture:
    """Convert a Grid to a Picture string, one line at a time."""
    if grid is None: 
        return "None"
    def val(d: DigitSet) -> str: return '.' if d == digits else d if len(d) == 1 else '{' + d + '}'
    maxwidth = max(len(val(grid[s])) for s in grid)
    dash1 = '-' * (maxwidth * 3 + 2)
    dash3 = '\n' + '+'.join(3 * [dash1])
    def cell(r, c): return val(grid[r + c]).center(maxwidth) + ('|'  if c in '36' else ' ')
    def line(r): return ''.join(cell(r, c) for c in cols)    + (dash3 if r in 'CF' else '')
    return '\n'.join(map(line, rows))
```

Here we parse a picture string into a grid, and then print the grid's picture:


```python
pic1 = "53..7.... 6..195... .98....6. 8...6...3 4..8.3..1 7...2...6 .6....28. ...419..5 ....8..79"
grid1 = parse(pic1)
print(picture(grid1))
```

```
5 3 .|. 7 .|. . . 
6 . .|1 9 5|. . . 
. 9 8|. . .|. 6 . 
-----+-----+-----
8 . .|. 6 .|. . 3 
4 . .|8 . 3|. . 1 
7 . .|. 2 .|. . 6 
-----+-----+-----
. 6 .|. . .|2 8 . 
. . .|4 1 9|. . 5 
. . .|. 8 .|. 7 9 

```

In a grid, filled squares (like `A1`, the upper left corner of `grid1`) have one possible digit, and unfilled squares (like `A9`, the upper right corner of `grid1`) have all 9 possible digits:


```python
grid1['A1']
```

```
'5'
```

```python
grid1['A9']
```

```
'123456789'
```

To see how this all works, let's look again at `grid1`:


```python
print(picture(grid1))
```

```
5 3 .|. 7 .|. . . 
6 . .|1 9 5|. . . 
. 9 8|. . .|. 6 . 
-----+-----+-----
8 . .|. 6 .|. . 3 
4 . .|8 . 3|. . 1 
7 . .|. 2 .|. . 6 
-----+-----+-----
. 6 .|. . .|2 8 . 
. . .|4 1 9|. . 5 
. . .|. 8 .|. 7 9 

```

Constraint propagation will at some point consider the square `E5`, in the center of the center box.  It is in a row with the digits 4, 8, 3, 1, and in a column with the digits 7, 9, 6, 2, 1, 8. If according to strategy 1 we call `eliminate(grid1, 'E5', d)` for each of these digits, then we're left with only one possible digit, `5`, for `E5`. Thus, we would next call `eliminate(grid1, s2, '5')` for each peer `s2` of 'E5'. This would lead to the square three columns to the left, `E2`, only having one remaining possible digit, `2`. Constraint propagation continues in this fashion.




Many puzzles can be completely solved by `constrain` alone, for example:


```python
print(picture(constrain(grid1)))
```

```
5 3 4|6 7 8|9 1 2 
6 7 2|1 9 5|3 4 8 
1 9 8|3 4 2|5 6 7 
-----+-----+-----
8 5 9|7 6 1|4 2 3 
4 2 6|8 5 3|7 9 1 
7 1 3|9 2 4|8 5 6 
-----+-----+-----
9 6 1|5 3 7|2 8 4 
2 8 7|4 1 9|6 3 5 
3 4 5|2 8 6|1 7 9 

```

But for other puzzles, `constrain` is not enough:


```python
grid2 = parse("4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......")
print(picture(grid2))
```

```
4 . .|. . .|8 . 5 
. 3 .|. . .|. . . 
. . .|7 . .|. . . 
-----+-----+-----
. 2 .|. . .|. 6 . 
. . .|. 8 .|4 . . 
. . .|. 1 .|. . . 
-----+-----+-----
. . .|6 . 3|. 7 . 
5 . .|2 . .|. . . 
1 . 4|. . .|. . . 

```

```python
print(picture(constrain(grid2)))
```

```
    4       {1679}   {12679} |  {139}     {2369}    {269}  |    8       {1239}      5     
 {26789}      3     {1256789}| {14589}   {24569}   {245689}| {12679}    {1249}   {124679} 
  {2689}   {15689}   {125689}|    7      {234569}  {245689}| {12369}   {12349}   {123469} 
-----------------------------+-----------------------------+-----------------------------
  {3789}      2      {15789} |  {3459}   {34579}    {4579} | {13579}      6      {13789}  
  {3679}   {15679}   {15679} |  {359}       8      {25679} |    4      {12359}   {12379}  
 {36789}      4      {56789} |  {359}       1      {25679} | {23579}   {23589}   {23789}  
-----------------------------+-----------------------------+-----------------------------
  {289}      {89}     {289}  |    6       {459}       3    |  {1259}      7      {12489}  
    5       {6789}      3    |    2       {479}       1    |   {69}     {489}     {4689}  
    1       {6789}      4    |  {589}     {579}     {5789} | {23569}   {23589}   {23689}  

```

We see that some progress has been made: the `grid2` puzzle has 17 squares filled in, and after constraint propagation, 20 are filled in. But that leaves 61 squares to go.   We could try to add [additional constraint propagation strategies](https://bestofsudoku.com/sudoku-strategy), but there are many strategies, each one complicates the code, and even if we implemented them all, we wouldn't be *guaranteed* they could solve *any* puzzle. 


# Search Strategy

We need a strategy that will **search** through all possibile solutions, systematically and efficiently, until the solution is found.  (A  well-formed Sudoku puzzle has  exactly  one solution). 

A naive search can be slow. Consider a brute force search that tries every possible combination of digits. In the constrained `grid2` above, `A2` has 4 possibilities, `{1679}`, `A3` has 5, `{12679}`, and if we keep going and multiply all the choices together, [we get over 10<sup>38</sup>](http://www.google.com/search?hl=en&q=4*5*3*4*3*4*5*7*5*5*6*5*4*6*4*5*6*6*6*5*5*6*4*5*4*5*4*5*5*4*5*5*3*5*5*5*5*5*3*5*5*5*5*3*2*3*3*4*5*4*3*2*3*4*4*3*3*4*5*5*5) possibilities for the whole
puzzle.  Suppose we have a
very efficient implementation that takes only ten CPU instructions to evaluate a
position, and that we have access to next-generation computers
with 1024–core CPUs running at 100 GHz, and let's say
we could afford a million of them, and while we're shopping, let's also pick up a time machine and go back 13 billion years to the origin of the universe and start our program running.  We can then [estimate](http://www.google.com/search?&q=100+GHz/10+*+1024+*+1+million+*+13+billion+years+%2F+4.6e38+in+percent)
that we'd be almost 1% done with this one puzzle by now! Brute force is not the search you're looking for.

It is too slow to do constraint propagation first and then search. A smarter strategy is to **interleave** constraint propagation and search as follows:
  - If a previous step of the search on this branch returned `None`, then pass the `None` along.
  - If there are no squares with multiple possibilities in the puzzle, then return the completed grid.
  - Otherwise choose one of the not-yet-determined squares, *s*. 
  - For each digit *d* that could possibly fill square *s*:
    - Initiate constraint propagation by calling `fill` on *s* and *d* and a copy of the grid.
    - Recursively search for a solution to the puzzle from there.
        - If the guess was right, we will get a solution.
        - If the guess was wrong, continue on to the next digit *d*.

Because we give up as soon as we get a contradiction, we examine far fewer possibilities than brute force search. Here is the implementation:


```python
def search(grid) -> Grid:
    "Depth-first search with constraint propagation to find a solution."
    if grid is None: 
        return None
    s = min((s for s in squares if len(grid[s]) > 1), 
            default=None, key=lambda s: len(grid[s]))
    if s is None: # No squares with multiple possibilities; the search has succeeded
        return grid
    for d in grid[s]:
        solution = search(fill(grid.copy(), s, d))
        if solution:
            return solution
    return None
```

There are two choices we have to make in implementing the search:
**variable ordering** (which square do we try first?) and **value
ordering** (which digit do we try first for the square?).  For
variable ordering, I used a common heuristic called **minimum
remaining values**, which means that we choose a 
square with the minimum number of possible values. Why?  Consider 
`grid2` above. Suppose we chose `B3` first.  It has 7
possibilities, `{1256789}`, so we'd expect to guess wrong with
probability 6/7.  If instead we chose `G2`, which only has 2
possibilities, `{89}`, we'd expect to be wrong with probability
only 1/2.  Thus we choose the square with the fewest possibilities and
the best chance of guessing right.  For value ordering we won't do
anything special; we'll consider the digits in numeric order.

Note we create a new **copy** of `grid` for each recursive call to `search`. This way
each branch of the search tree is independent, and mutations to `grid` done by constraint propagation in one branch do not  confuse other branches. When it is time to back up and try a different digit, we have the original unaltered `grid` ready to go.

We could call `search` directly, but I'll define the helper function `solve_puzzles(puzzles)` to call `constrain` and then `search` on each puzzle, and then verify that the solution is correct with `is_solution`, and finally print the puzzle and the solution side by side:


```python
def solve_puzzles(puzzles, verbose=True) -> int:
    "Solve and verify each puzzle, and if `verbose`, print puzzle and solution."
    for puzzle in puzzles:
        solution = search(constrain(puzzle))
        assert is_solution(solution, puzzle)
        if verbose:
            print_side_by_side('\nPuzzle:\n' + picture(puzzle), 
                               '\nSolution:\n' + picture(solution))
    return len(puzzles)

def print_side_by_side(left, right, width=20):
    """Print two strings side-by-side, line-by-line, each side `width` wide."""
    for L, R in zip(left.splitlines(), right.splitlines()):
        print(L.ljust(width), R.ljust(width))     
```

```python
solve_puzzles([grid1, grid2])
```

```
                                         
Puzzle:              Solution:           
5 3 .|. 7 .|. . .    5 3 4|6 7 8|9 1 2   
6 . .|1 9 5|. . .    6 7 2|1 9 5|3 4 8   
. 9 8|. . .|. 6 .    1 9 8|3 4 2|5 6 7   
-----+-----+-----    -----+-----+-----   
8 . .|. 6 .|. . 3    8 5 9|7 6 1|4 2 3   
4 . .|8 . 3|. . 1    4 2 6|8 5 3|7 9 1   
7 . .|. 2 .|. . 6    7 1 3|9 2 4|8 5 6   
-----+-----+-----    -----+-----+-----   
. 6 .|. . .|2 8 .    9 6 1|5 3 7|2 8 4   
. . .|4 1 9|. . 5    2 8 7|4 1 9|6 3 5   
. . .|. 8 .|. 7 9    3 4 5|2 8 6|1 7 9   
                                         
Puzzle:              Solution:           
4 . .|. . .|8 . 5    4 1 7|3 6 9|8 2 5   
. 3 .|. . .|. . .    6 3 2|1 5 8|9 4 7   
. . .|7 . .|. . .    9 5 8|7 2 4|3 1 6   
-----+-----+-----    -----+-----+-----   
. 2 .|. . .|. 6 .    8 2 5|4 3 7|1 6 9   
. . .|. 8 .|4 . .    7 9 1|5 8 6|4 3 2   
. . .|. 1 .|. . .    3 4 6|9 1 2|7 5 8   
-----+-----+-----    -----+-----+-----   
. . .|6 . 3|. 7 .    2 8 9|6 4 3|5 7 1   
5 . .|2 . .|. . .    5 7 3|2 9 1|6 8 4   
1 . 4|. . .|. . .    1 6 4|8 7 5|2 9 3   

```

```
2
```

We see that `search` is effective at solving the previously-unsolved `grid2`.

Computer scientists call this a [depth-first search](http://en.wikipedia.org/wiki/Depth-first_search) because it (recursively) considers all possible continuations from the grid with *d* in square *s* before it backs up and considers a different digit in *s*. Sudoku players call this the  [Nishio strategy](https://www.sudokuonline.io/tips/advanced-sudoku-strategies), after professional puzzle player Tetsuya Nishio, although Nishio only applied it when there were just two remaining possibilities for a square. We can apply it with any number of possibilities; we can even find a solution for the completely empty puzzle where every square has 9 possibilities:


```python
empty = parse('.' * 81)
              
solve_puzzles([empty])
```

```
                                         
Puzzle:              Solution:           
. . .|. . .|. . .    1 2 3|4 5 6|7 8 9   
. . .|. . .|. . .    4 5 6|7 8 9|1 2 3   
. . .|. . .|. . .    7 8 9|1 2 3|4 5 6   
-----+-----+-----    -----+-----+-----   
. . .|. . .|. . .    2 3 1|6 7 4|8 9 5   
. . .|. . .|. . .    8 7 5|9 1 2|3 6 4   
. . .|. . .|. . .    6 9 4|5 3 8|2 1 7   
-----+-----+-----    -----+-----+-----   
. . .|. . .|. . .    3 1 7|2 6 5|9 4 8   
. . .|. . .|. . .    5 4 2|8 9 7|6 3 1   
. . .|. . .|. . .    9 6 8|3 4 1|5 7 2   

```

```
1
```

# Verifying the Program

We had success in solving `grid1`, `grid2`, and `empty`, but we are left with some questions:
- Can the program solve *any* puzzle? 
  - We'll test it on some more `puzzles`, taken from some files. The more we test, the more confidence we have.
  - Theoretically, the program should be able to solve any puzzle, but we haven't determined a bound on how long it would take.
- Are the components of the program correct? 
  - We'll run some `unit_tests` to give us some confidence/ There should be more tests.
- How long does it take to solve a puzzle?
  - We can measure that with the `%time` magic command.
  - For a more complete investigation of run times, see the [Java version](SudokuJava.ipynb).


```python
def unit_tests():
    "A suite of unit tests."
    assert len(squares) == 81
    assert len(all_units) == 27
    assert cross('AB', '12') == ('A1', 'A2', 'B1', 'B2')
    for s in squares:
        assert len(units[s]) == 3
        assert len(peers[s]) == 20
    assert units['C2'] == (('A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2', 'H2', 'I2'),
                           ('C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'),
                           ('A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'))
    assert peers['C2'] == {'A2', 'B2',       'D2', 'E2', 'F2', 'G2', 'H2', 'I2',
                           'C1',       'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9',
                           'A1', 'A3', 'B1', 'B3'}
    return 'pass'

def parse_grids(pictures):
    """Parse an iterable of picture lines into a list of grids."""
    return [parse(p) for p in pictures if p]

hardest  = parse_grids(open('hardest.txt'))
grids10k = parse_grids(open('sudoku10k.txt'))

unit_tests()
```

```
'pass'
```

We can solve 10,000 puzzles, verifying that each solution is correct (but not printing them):


```python
%time solve_puzzles(grids10k, verbose=False)
```

```
CPU times: user 27.2 s, sys: 17.1 ms, total: 27.2 s
Wall time: 27.4 s

```

```
10000
```

That took less than 3 milliseconds per puzzle, or over 350 puzzles per second. (The [Java version](SudokuJava.ipynb) does over 100,000 puzzles per second. It benefits from being able to run 20 threads in parallel, from using more efficient data structures, and from the Java JVM being more efficient than Python's bytecode interpreter.)

The ten allegedly hardest puzzles also take about 3 milliseconds per puzzle on average:


```python
%time solve_puzzles(hardest, verbose=False)
```

```
CPU times: user 33.8 ms, sys: 1.08 ms, total: 34.9 ms
Wall time: 34.3 ms

```

```
10
```

We can see the puzzles and their solutions:


```python
solve_puzzles(hardest)
```

```
                                         
Puzzle:              Solution:           
8 5 .|. . 2|4 . .    8 5 9|6 1 2|4 3 7   
7 2 .|. . .|. . 9    7 2 3|8 5 4|1 6 9   
. . 4|. . .|. . .    1 6 4|3 7 9|5 2 8   
-----+-----+-----    -----+-----+-----   
. . .|1 . 7|. . 2    9 8 6|1 4 7|3 5 2   
3 . 5|. . .|9 . .    3 7 5|2 6 8|9 1 4   
. 4 .|. . .|. . .    2 4 1|5 9 3|7 8 6   
-----+-----+-----    -----+-----+-----   
. . .|. 8 .|. 7 .    4 3 2|9 8 1|6 7 5   
. 1 7|. . .|. . .    6 1 7|4 2 5|8 9 3   
. . .|. 3 6|. 4 .    5 9 8|7 3 6|2 4 1   
                                         
Puzzle:              Solution:           
. . 5|3 . .|. . .    1 4 5|3 2 7|6 9 8   
8 . .|. . .|. 2 .    8 3 9|6 5 4|1 2 7   
. 7 .|. 1 .|5 . .    6 7 2|9 1 8|5 4 3   
-----+-----+-----    -----+-----+-----   
4 . .|. . 5|3 . .    4 9 6|1 8 5|3 7 2   
. 1 .|. 7 .|. . 6    2 1 8|4 7 3|9 5 6   
. . 3|2 . .|. 8 .    7 5 3|2 9 6|4 8 1   
-----+-----+-----    -----+-----+-----   
. 6 .|5 . .|. . 9    3 6 7|5 4 2|8 1 9   
. . 4|. . .|. 3 .    9 8 4|7 6 1|2 3 5   
. . .|. . 9|7 . .    5 2 1|8 3 9|7 6 4   
                                         
Puzzle:              Solution:           
1 2 .|. 4 .|. . .    1 2 8|5 4 7|6 3 9   
. . 5|. 6 9|. 1 .    3 4 5|8 6 9|2 1 7   
. . 9|. . .|5 . .    6 7 9|2 1 3|5 4 8   
-----+-----+-----    -----+-----+-----   
. . .|. . .|. 7 .    9 1 2|4 8 6|3 7 5   
7 . .|. 5 2|. 9 .    7 8 4|3 5 2|1 9 6   
. 3 .|. . .|. . 2    5 3 6|7 9 1|4 8 2   
-----+-----+-----    -----+-----+-----   
. 9 .|6 . .|. 5 .    8 9 1|6 2 4|7 5 3   
4 . .|9 . .|8 . 1    4 6 7|9 3 5|8 2 1   
. . 3|. . .|9 . 4    2 5 3|1 7 8|9 6 4   
                                         
Puzzle:              Solution:           
. . .|5 7 .|. 3 .    6 2 4|5 7 8|1 3 9   
1 . .|. . .|. 2 .    1 3 5|4 9 6|8 2 7   
7 . .|. 2 3|4 . .    7 8 9|1 2 3|4 5 6   
-----+-----+-----    -----+-----+-----   
. . .|. 8 .|. . 4    2 1 6|3 8 5|7 9 4   
. . 7|. . 4|. . .    8 5 7|9 6 4|2 1 3   
4 9 .|. . .|6 . 5    4 9 3|2 1 7|6 8 5   
-----+-----+-----    -----+-----+-----   
. 4 2|. . .|3 . .    9 4 2|6 5 1|3 7 8   
. . .|7 . .|9 . .    5 6 8|7 3 2|9 4 1   
. . 1|8 . .|. . .    3 7 1|8 4 9|5 6 2   
                                         
Puzzle:              Solution:           
1 . .|. . 7|. 9 .    1 6 2|8 5 7|4 9 3   
. 3 .|. 2 .|. . 8    5 3 4|1 2 9|6 7 8   
. . 9|6 . .|5 . .    7 8 9|6 4 3|5 2 1   
-----+-----+-----    -----+-----+-----   
. . 5|3 . .|9 . .    4 7 5|3 1 2|9 8 6   
. 1 .|. 8 .|. . 2    9 1 3|5 8 6|7 4 2   
6 . .|. . 4|. . .    6 2 8|7 9 4|1 3 5   
-----+-----+-----    -----+-----+-----   
3 . .|. . .|. 1 .    3 5 6|4 7 8|2 1 9   
. 4 .|. . .|. . 7    2 4 1|9 3 5|8 6 7   
. . 7|. . .|3 . .    8 9 7|2 6 1|3 5 4   
                                         
Puzzle:              Solution:           
1 . .|. 3 4|. 8 .    1 5 2|9 3 4|6 8 7   
. . .|8 . .|5 . .    7 6 3|8 2 1|5 4 9   
. . 4|. 6 .|. 2 1    9 8 4|5 6 7|3 2 1   
-----+-----+-----    -----+-----+-----   
. 1 8|. . .|. . .    6 1 8|4 9 3|2 7 5   
3 . .|1 . 2|. . 6    3 7 5|1 8 2|4 9 6   
. . .|. . .|8 1 .    2 4 9|7 5 6|8 1 3   
-----+-----+-----    -----+-----+-----   
5 2 .|. 7 .|9 . .    5 2 1|3 7 8|9 6 4   
. . 6|. . 9|. . .    4 3 6|2 1 9|7 5 8   
. 9 .|6 4 .|. . 2    8 9 7|6 4 5|1 3 2   
                                         
Puzzle:              Solution:           
. . .|9 2 .|. . .    3 8 7|9 2 6|4 1 5   
. . 6|8 . 3|. . .    5 4 6|8 1 3|9 7 2   
1 9 .|. 7 .|. . 6    1 9 2|4 7 5|8 3 6   
-----+-----+-----    -----+-----+-----   
2 3 .|. 4 .|1 . .    2 3 5|7 4 9|1 6 8   
. . 1|. . .|7 . .    9 6 1|2 5 8|7 4 3   
. . 8|. 3 .|. 2 9    4 7 8|6 3 1|5 2 9   
-----+-----+-----    -----+-----+-----   
7 . .|. 8 .|. 9 1    7 5 4|3 8 2|6 9 1   
. . .|5 . 7|2 . .    6 1 3|5 9 7|2 8 4   
. . .|. 6 4|. . .    8 2 9|1 6 4|3 5 7   
                                         
Puzzle:              Solution:           
. 6 .|5 . 4|. 3 .    8 6 9|5 7 4|1 3 2   
1 . .|. 9 .|. . 8    1 2 4|3 9 6|7 5 8   
. . .|. . .|. . .    3 7 5|1 2 8|6 9 4   
-----+-----+-----    -----+-----+-----   
9 . .|. 5 .|. . 6    9 3 2|8 5 7|4 1 6   
. 4 .|6 . 2|. 7 .    5 4 1|6 3 2|8 7 9   
7 . .|. 4 .|. . 5    7 8 6|9 4 1|3 2 5   
-----+-----+-----    -----+-----+-----   
. . .|. . .|. . .    2 1 7|4 6 9|5 8 3   
4 . .|. 8 .|. . 1    4 9 3|7 8 5|2 6 1   
. 5 .|2 . 3|. 4 .    6 5 8|2 1 3|9 4 7   
                                         
Puzzle:              Solution:           
7 . .|. . .|4 . .    7 9 8|6 3 5|4 2 1   
. 2 .|. 7 .|. 8 .    1 2 6|9 7 4|5 8 3   
. . 3|. . 8|. 7 9    4 5 3|2 1 8|6 7 9   
-----+-----+-----    -----+-----+-----   
9 . .|5 . .|3 . .    9 7 2|5 8 6|3 1 4   
. 6 .|. 2 .|. 9 .    5 6 4|1 2 3|8 9 7   
. . 1|. 9 7|. . 6    3 8 1|4 9 7|2 5 6   
-----+-----+-----    -----+-----+-----   
. . .|3 . .|9 . .    6 1 7|3 5 2|9 4 8   
. 3 .|. 4 .|. 6 .    8 3 5|7 4 9|1 6 2   
. . 9|. . 1|. 3 5    2 4 9|8 6 1|7 3 5   
                                         
Puzzle:              Solution:           
. . .|. 7 .|. 2 .    5 9 4|8 7 6|1 2 3   
8 . .|. . .|. . 6    8 2 3|9 1 4|7 5 6   
. 1 .|2 . 5|. . .    6 1 7|2 3 5|8 9 4   
-----+-----+-----    -----+-----+-----   
9 . 5|4 . .|. . 8    9 6 5|4 2 1|3 7 8   
. . .|. . .|. . .    7 8 1|6 5 3|9 4 2   
3 . .|. . 8|5 . 1    3 4 2|7 9 8|5 6 1   
-----+-----+-----    -----+-----+-----   
. . .|3 . 2|. 8 .    1 5 9|3 4 2|6 8 7   
4 . .|. . .|. . 9    4 3 6|5 8 7|2 1 9   
. 7 .|. 6 .|. . .    2 7 8|1 6 9|4 3 5   

```

```
10
```

## Roads not taken

I made my implementation choices for clarity and ease of debugging. There are alternative choices I could have made:
- **Digit**: could have been an `int`, but:
  - There is no need to do arithmetic on digits (all that matters is that they are unique).
  - I wanted the compact DigitSet representation.
- **Digit set**: I considered two other options:
  - `set` of digits: a good choice, but:
    - I would then need to do a `deepcopy` of each grid, not just a copy.
    - The printed representation `'123'` is shorter and easier to read than `{'1', '2', '3'}` when debugging.
  - `int` bitset: each digit is represented by a bit; a DigitSet is a 9-bit binary int.
    - Efficient, but obfuscating. Used in the [Java version](SudokuJava.ipynb) for efficiency.
- **Grid**: I considered three other options: 
  - `defaultdict`: the default is the DigitSet `'123456789'`.
    - I thought that the top levels in the search tree would have only a few entries, so this would save space. 
    - But the first round of constraint propagation touches almost all the squares anyway.
  - `list` of 9 rows, each a `list` of 9 squares (or a numpy 2D array):
    - Then a `Square` is a pair of coordinates, like `(1, 2)` rather than the simpler string `C2`.
    - Copying a grid would again require a `deepcopy`. 
  - `list` of 81 squares: 
    - Then a `Square` is an integer from 0 to 81.
    - Efficient, but for debugging it is clear that `C2` is in the third row and second column; it is not obvious that `19` is.



# Why?

Why did I do this? As computer security expert [Ben Laurie](http://en.wikipedia.org/wiki/Ben_Laurie) has
stated, Sudoku is "a denial of service attack on human intellect." 
Several people I know (including my
wife) were victims of the attack, and I thought maybe this would
demonstrate that they didn't need to spend any more time on Sudoku.  It
didn't work for my friends (although my wife has since independently
kicked the habit without my help), but at least one stranger wrote
and said this page worked for them, so I've made the world more
productive. And perhaps along the way I've taught something about
Python, constraint propagation, search, problem solving, and Sudoku.

