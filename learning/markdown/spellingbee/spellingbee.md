<div style="text-align: right" align="right"><i>Peter Norvig, 3 Jan 2020</i></div>

# Spelling Bee Puzzle

The [3 Jan. 2020 edition of the **538 Riddler**](https://fivethirtyeight.com/features/can-you-solve-the-vexing-vexillology/) concerns the popular NYTimes  [**Spelling Bee**](https://www.nytimes.com/puzzles/spelling-bee) puzzle:

> In this game, seven letters are arranged in a **honeycomb** lattice, with one letter in the center. Here’s the lattice from Dec. 24, 2019:
> 
> <img src="https://fivethirtyeight.com/wp-content/uploads/2020/01/Screen-Shot-2019-12-24-at-5.46.55-PM.png" width="150">
> 
> The goal is to identify as many words as possible that meet the following criteria:
> 1. The word must be at least four letters long.
> 2. The word must include the central letter.
> 3. The word cannot include any letter beyond the seven given letters.
>
>Note that letters can be repeated. For example,  GAME and AMALGAM are both acceptable words. Four-letter words are worth 1 point each, while five-letter words are worth 5 points, six-letter words are worth 6 points, etc. Words that use all seven letters in the honeycomb are known as **pangrams** and earn 7 bonus points (in addition to the points for the length of the word). So in the above example, MEGAPLEX is worth 8 + 7 = 15 points.
>
> ***Which seven-letter honeycomb results in the highest possible score?*** To be a valid choice of seven letters, no letter can be repeated, it must not contain the letter S (that would be too easy) and there must be at least one pangram.
>
> For consistency, please use [this word list](https://norvig.com/ngrams/enable1.txt) to check your score.


Since the referenced word list came from [***my*** web site](https://norvig.com/ngrams), I felt  compelled to solve this puzzle.  (Note the word list is a standard public domain Scrabble® dictionary that I happen to host a copy of; I didn't curate it, Mendel Cooper and Alan Beale did.) 

I'll show you how I address the problem. First some imports:


```python
from collections import defaultdict
from dataclasses import dataclass
from itertools   import combinations
from typing      import List, Set, Dict, Tuple, Iterable 
```

# Letters, Words, Lettersets, and Pangrams

Let's start by defining the most basic terms:

- **Valid letter**: the valid letters are uppercase 'A' to 'Z', but not 'S'.
- **Word**: A string of letters.
- **Word list**: a list of valid words.
- **Valid word**: a word of at least 4 valid letters and not more than 7 distinct letters.
- **Letterset**: the set of distinct letters in a word; e.g. letterset('BOOBOO') = 'BO'.
- **Pangram**: a valid word with exactly 7 distinct letters.
- **Pangram letterset**: the letterset for a pangram.


```python
valid_letters = set('ABCDEFGHIJKLMNOPQR' + 'TUVWXYZ')
Letter    = str # A string of one letter
Word      = str # A string of multiple letters
Letterset = str # A sorted string of distinct letters

def word_list(text: str) -> List[Word]: 
    """All the valid words in a text."""
    return [w for w in text.upper().split() if is_valid(w)]

def is_valid(word) -> bool: 
    return len(word) >= 4 and valid_letters.issuperset(word) and len(set(word)) <= 7

def letterset(word) -> Letterset:
    """The set of distinct letters in a word, represented as a sorted str."""
    return ''.join(sorted(set(word)))

def is_pangram(word) -> bool: return len(set(word)) == 7

def pangram_lettersets(wordlist) -> Set[Letterset]:
    """All lettersets from the pangram words in wordlist."""
    return {letterset(w) for w in wordlist if is_pangram(w)}
```

Why did I  represent a `Letterset` as a sorted string of distinct letters, and not a `set`? Because:
- A `set` can't be the key of a dict.
- A `frozenset` could be a key, and would be a reasonable choice for `Letterset`, but it:
  - Takes up more memory than a `str`.
  - Is harder to read when debugging: `frozenset({'A', 'G', 'L', 'M'})` versus `'AGLM'`.


Here's a mini word list to experiment with:


```python
mini = word_list('amalgam amalgamation cacciatore erotica em game gem gems glam megaplex')
mini
```

```
['AMALGAM', 'CACCIATORE', 'EROTICA', 'GAME', 'GLAM', 'MEGAPLEX']
```

Note that `em` and `gem` are too short, `gems` has an `s`, and `amalgamation` has 8 distinct letters. We're left with six valid words out of the ten candidate words. The pangrams and their lettersets are as follows; there are three pangrams but only two pangram lettersets because CACCIATORE and EROTICA have the same letterset:


```python
assert len(pangram_lettersets(mini)) == 2

{w: letterset(w) for w in mini if is_pangram(w)}
```

```
{'CACCIATORE': 'ACEIORT', 'EROTICA': 'ACEIORT', 'MEGAPLEX': 'AEGLMPX'}
```

# Honeycombs and Scoring

- A **honeycomb** lattice consists of two attributes:
 - A letterset of seven distinct letters
 - A single distinguished center letter
- The **word score** is 1 point for a 4-letter word, or the word length for longer words, plus 7 bonus points for a pangram.
- The **total score** for a honeycomb is the sum of the word scores for the words that the honeycomb **can make**. 
- A honeycomb **can make** a word if the word contains the honeycomb's center, and every letter in the word is in the honeycomb. 


```python
@dataclass(frozen=True, order=True)
class Honeycomb:
    """A Honeycomb lattice, with 7 letters, 1 of which is the center."""
    letters: Letterset 
    center:  Letter
        
def word_score(word) -> int: 
    """The points for this word, including bonus for pangram."""
    return 1 if len(word) == 4 else (len(word) + 7 * is_pangram(word))

def total_score(honeycomb, wordlist) -> int:
    """The total score for this honeycomb."""
    return sum(word_score(w) for w in wordlist if can_make(honeycomb, w))

def can_make(honeycomb, word) -> bool:
    """Can the honeycomb make this word?"""
    return honeycomb.center in word and all(L in honeycomb.letters for L in word)
```

Here is the honeycomb from the diagram at the top of the notebook:


```python
hc = Honeycomb(letterset('LAPGEMX'), 'G')
hc
```

```
Honeycomb(letters='AEGLMPX', center='G')
```

The word scores, makeable words, and total score  for this honeycomb on the `mini` word list are as follows:


```python
{w: word_score(w) for w in mini}
```

```
{'AMALGAM': 7,
 'CACCIATORE': 17,
 'EROTICA': 14,
 'GAME': 1,
 'GLAM': 1,
 'MEGAPLEX': 15}
```

```python
{w for w in mini if can_make(hc, w)}
```

```
{'AMALGAM', 'GAME', 'GLAM', 'MEGAPLEX'}
```

```python
total_score(hc, mini) # 7 + 1 + 1 + 15
```

```
24
```

# Finding the Top-Scoring Honeycomb

A simple strategy for finding the top (highest total score) honeycomb is:
 - Compile a list of all valid candidate honeycombs.
 - For each honeycomb, compute the total score.
 - Return a (score, honeycomb) tuple for a honeycomb with the maximum score.


```python
def top_honeycomb(wordlist) -> Tuple[int, Honeycomb]: 
    """Find a (score, honeycomb) tuple with a highest-scoring honeycomb."""
    return max((total_score(h, wordlist), h) 
               for h in candidate_honeycombs(wordlist))
```

What are the possible candidate honeycombs? We could try all letters in all slots, but that's a **lot** of honeycombs:
- The center can be any valid letter (25 choices, because 'S' is not allowed).
- The outside can be any six of the remaining 24 letters.
- All together, that's 25 × (24 choose 6) = 3,364,900 candidate honeycombs.

Fortunately, we can use the constraint that  **there must be at least one pangram** in a valid honeycomb.  So the letters of any valid honeycomb must ***be*** the letterset of some pangram (and the center can be any one of the seven letters):


```python
def candidate_honeycombs(wordlist) -> List[Honeycomb]:
    """Valid honeycombs have pangram letters, with any center."""
    return [Honeycomb(letters, center) 
            for letters in pangram_lettersets(wordlist)
            for center in letters]
```

```python
candidate_honeycombs(mini) # 7 candidates for each of the 2 pangram lettersets
```

```
[Honeycomb(letters='AEGLMPX', center='A'),
 Honeycomb(letters='AEGLMPX', center='E'),
 Honeycomb(letters='AEGLMPX', center='G'),
 Honeycomb(letters='AEGLMPX', center='L'),
 Honeycomb(letters='AEGLMPX', center='M'),
 Honeycomb(letters='AEGLMPX', center='P'),
 Honeycomb(letters='AEGLMPX', center='X'),
 Honeycomb(letters='ACEIORT', center='A'),
 Honeycomb(letters='ACEIORT', center='C'),
 Honeycomb(letters='ACEIORT', center='E'),
 Honeycomb(letters='ACEIORT', center='I'),
 Honeycomb(letters='ACEIORT', center='O'),
 Honeycomb(letters='ACEIORT', center='R'),
 Honeycomb(letters='ACEIORT', center='T')]
```

Now we're ready to find the highest-scoring honeycomb with respect to the `mini` word list:


```python
top_honeycomb(mini)
```

```
(31, Honeycomb(letters='ACEIORT', center='T'))
```

The program appears to work. But that's just the mini word list. 

# Big Word List

Here's the big word list:


```python
! [ -e  enable1.txt ] || curl -O http://norvig.com/ngrams/enable1.txt
! head  enable1.txt
! wc -w enable1.txt
```

```
aa
aah
aahed
aahing
aahs
aal
aalii
aaliis
aals
aardvark
  172820 enable1.txt

```

```python
file = 'enable1.txt'
big  = word_list(open(file).read())
```

Here are some statistics:


```python
print(f"""172,820 total words
{len(big):7,d} valid Spelling Bee words
{sum(map(is_pangram, big)):7,d} pangram words
{len(pangram_lettersets(big)):7,d} distinct pangram lettersets
{len(candidate_honeycombs(big)):7,d} candidate honeycombs""")
```

```
172,820 total words
 44,585 valid Spelling Bee words
 14,741 pangram words
  7,986 distinct pangram lettersets
 55,902 candidate honeycombs

```

How long will it take to run `top_honeycomb(big)`? Most of the computation time is in `total_score`, which is called once for each of the 55,902 candidate honeycombs, so let's estimate the total time by first checking how long it takes to compute the total score of a single honeycomb:


```python
%timeit total_score(hc, big)
```

```
8.58 ms ± 28.3 µs per loop (mean ± std. dev. of 7 runs, 100 loops each)

```

Roughly 9 milliseconds for one honeycomb. For all 55,902 valid honeycombs:


```python
.009 * 55902
```

```
503.11799999999994
```

About 500 seconds, which is under 9 minutes. I could run `top_honeycomb(big)`, get a coffee, come back, and declare victory. 

But I think that a puzzle like this deserves a more elegant solution.  

# Faster Scoring: Points Table

Here's an idea to make `total_score` faster by doing some precomputation:

1. Do the following computation only once:
  - Compute the `letterset` and `word_score` for each word in the word list. 
  - Make a table of `{letterset: sum_of_word_scores}` giving the total score for each letterset. 
  - I call this a **points table**.
2. For each honeycomb, do the following:
  - Consider every **letter subset** of the honeycomb's 7 letters that includes the center letter.
  - Sum the points table entries for each of these letter subsets.

The resulting algorithm, `fast_total_score`, iterates over just 2<sup>6</sup> – 1 = 63 letter subsets; much fewer than 44,585 valid words. The function `top_honeycomb2` creates the points table and calls `fast_total_score`:


```python
def top_honeycomb2(wordlist) -> Tuple[int, Honeycomb]: 
    """Find a (score, honeycomb) tuple with a highest-scoring honeycomb."""
    table = PointsTable(wordlist)
    return max((fast_total_score(h, table), h) 
               for h in candidate_honeycombs(wordlist))

class PointsTable(dict):
    """A table of {letterset: points} from words."""
    def __init__(self, wordlist):
        for w in wordlist:
            self[letterset(w)] += word_score(w)
    def __missing__(self, key): return 0

def letter_subsets(honeycomb) -> List[Letterset]:
    """The 63 subsets of the letters in the honeycomb, each including the center letter."""
    return [letters 
            for n in range(2, 8) 
            for letters in map(''.join, combinations(honeycomb.letters, n))
            if honeycomb.center in letters]

def fast_total_score(honeycomb, points_table) -> int:
    """The total score for this honeycomb, using a points table."""
    return sum(points_table[s] for s in letter_subsets(honeycomb))
```

Here is the points table for the mini word list:


```python
table = PointsTable(mini)
table
```

```
{'AGLM': 8, 'ACEIORT': 31, 'AEGM': 1, 'AEGLMPX': 15}
```

The letterset `'AGLM'` gets 8 points (7 for AMALGAM and 1 for GLAM).  `'ACEIORT'` gets 31 points (17 for CACCIATORE and 14 for EROTICA). `'AEGM'` gets 1 for GAME and `'AEGLMPX'` gets 15 for MEGAPLEX. 


Here is the honeycomb `hc` again, and its 63 letter subsets:


```python
hc
```

```
Honeycomb(letters='AEGLMPX', center='G')
```

```python
print(letter_subsets(hc))
```

```
['AG', 'EG', 'GL', 'GM', 'GP', 'GX', 'AEG', 'AGL', 'AGM', 'AGP', 'AGX', 'EGL', 'EGM', 'EGP', 'EGX', 'GLM', 'GLP', 'GLX', 'GMP', 'GMX', 'GPX', 'AEGL', 'AEGM', 'AEGP', 'AEGX', 'AGLM', 'AGLP', 'AGLX', 'AGMP', 'AGMX', 'AGPX', 'EGLM', 'EGLP', 'EGLX', 'EGMP', 'EGMX', 'EGPX', 'GLMP', 'GLMX', 'GLPX', 'GMPX', 'AEGLM', 'AEGLP', 'AEGLX', 'AEGMP', 'AEGMX', 'AEGPX', 'AGLMP', 'AGLMX', 'AGLPX', 'AGMPX', 'EGLMP', 'EGLMX', 'EGLPX', 'EGMPX', 'GLMPX', 'AEGLMP', 'AEGLMX', 'AEGLPX', 'AEGMPX', 'AGLMPX', 'EGLMPX', 'AEGLMPX']

```

The total from `fast_total_score` is the sum of its letter subsets (only 3 of which are in `PointsTable(mini)`):


```python
assert fast_total_score(hc, table) == 24 == table['AGLM'] + table['AEGM'] + table['AEGLMPX']
```

# Finding the Top-Scoring Honeycomb


We can now solve the puzzle on the big word list:


```python
%time top_honeycomb2(big)
```

```
CPU times: user 1.59 s, sys: 3.69 ms, total: 1.59 s
Wall time: 1.59 s

```

```
(3898, Honeycomb(letters='AEGINRT', center='R'))
```

**Wow! 3898 is a high score!** And the whole computation took **less than 2 seconds**!


# Scoring Fewer Honeycombs: Branch and Bound

A run time of less than 2 seconds to find the top honeycomb is pretty good! Can we do even better?

The program would run faster if we scored fewer honeycombs. But if we want to be guaranteed of finding the top-scoring honeycomb, how can we skip any? Consider the pangram **JUKEBOX**. With the unusual letters  **J**, **K**,  and **X**, it scores poorly, regardless of the choice of center:


```python
jk = [Honeycomb(letterset('JUKEBOX'), C) for C in 'JUKEBOX']

{h: total_score(h, big) for h in jk}
```

```
{Honeycomb(letters='BEJKOUX', center='J'): 26,
 Honeycomb(letters='BEJKOUX', center='U'): 32,
 Honeycomb(letters='BEJKOUX', center='K'): 26,
 Honeycomb(letters='BEJKOUX', center='E'): 37,
 Honeycomb(letters='BEJKOUX', center='B'): 49,
 Honeycomb(letters='BEJKOUX', center='O'): 39,
 Honeycomb(letters='BEJKOUX', center='X'): 15}
```

We might be able to dismiss **JUKEBOX** in one call to `fast_total_score`, rather than seven, with this approach:
- Keep track of the top score found so far.
- For each pangram letterset, ask "if we weren't required to use the center letter, what would this letterset score?"
- Check if that score (which is an **upper bound** of the score using any one center letter) is higher than the top score so far.
  - If yes, then try the pangram letterset with all seven centers; 
  - If not then dismiss it without trying any centers.
- This is called a [**branch and bound**](https://en.wikipedia.org/wiki/Branch_and_bound) algorithm: prune a  **branch** of 7 honeycombs if an upper **bound** can't beat the top score.

*Note*: To represent a honeycomb with no center, I can just use `Honeycomb(p, '')`. This works because of a quirk of Python:  `letter_subsets` checks if `honeycomb.center in letters`; normally in Python the expression `e in s` means "*is* `e` *an element of the collection* `s`", but when `s` is a string it means "*is* `e` *a substring of* `s`", and the empty string is a substring of every string. 

I can rewrite `top_honeycomb` as follows:


```python
def top_honeycomb3(words) -> Tuple[int, Honeycomb]: 
    """Find a (score, honeycomb) tuple with a highest-scoring honeycomb."""
    table = PointsTable(words)
    top_score, top_honeycomb = -1, None
    pangrams = [s for s in table if len(s) == 7]
    for p in pangrams:
        if fast_total_score(Honeycomb(p, ''), table) > top_score:
            for center in p:
                honeycomb = Honeycomb(p, center)
                score = fast_total_score(honeycomb, table)
                if score > top_score:
                    top_score, top_honeycomb = score, honeycomb
    return top_score, top_honeycomb
```

```python
%time top_honeycomb3(big)
```

```
CPU times: user 350 ms, sys: 1.78 ms, total: 352 ms
Wall time: 351 ms

```

```
(3898, Honeycomb(letters='AEGINRT', center='R'))
```

Awesome! We get the correct answer, and it runs four times faster than `top_honeycomb2`.

# How many honeycombs does `top_honeycomb3` examine? 

We can use `functools.lru_cache` to make `Honeycomb` keep track:


```python
import functools
Honeycomb = functools.lru_cache(None)(Honeycomb)
top_honeycomb3(big)
Honeycomb.cache_info()
```

```
CacheInfo(hits=0, misses=8084, maxsize=None, currsize=8084)
```

`top_honeycomb3`  examined 8,084 honeycombs; a 6.9× reduction from the 55,902 examined by `top_honeycomb2`. Since there are 7,986 pangram lettersets, that means we had to look at all 7 centers for only (8084-7986)/7 = 14 of them.

How much faster is `fast_total_score` than `total_score` (which takes about 9 milliseconds per honeycomb)?


```python
table = PointsTable(big)

%timeit fast_total_score(hc, table)
```

```
26.4 µs ± 144 ns per loop (mean ± std. dev. of 7 runs, 10000 loops each)

```

We see that `fast_total_score` is about 300 times faster.


# Fancy Report

I'd like to see the actual words that each honeycomb can make, and I'm curious about how the words are divided up by letterset. Here's a function to provide such a report. This report turned out to be more complicated than I anticipated. I guess it is difficult to create a practical extraction and reporting tool. I feel you, [Larry Wall](http://www.wall.org/~larry/).


```python
from textwrap import fill

def report(honeycomb=None, words=big):
    """Print stats, words, and word scores for the given honeycomb (or the top
    honeycomb if no honeycomb is given) over the given word list."""
    bins    = group_by(words, key=letterset)
    if honeycomb is None:
        adj = "Top "
        score, honeycomb = top_honeycomb3(words)
    else:
        adj = ""
        score = total_score(honeycomb, words)
    subsets = letter_subsets(honeycomb)
    nwords  = sum(len(bins[s]) for s in subsets)
    print(f'{adj}{honeycomb}: {Ns(nwords, "word")} {Ns(score, "point")}',
          f'from a {len(words):,d} word list:\n')
    for s in sorted(subsets, key=lambda s: (-len(s), s)):
        if bins[s]:
            pts = sum(word_score(w) for w in bins[s])
            wcount = Ns(len(bins[s]), "pangram" if is_pangram(s) else "word")
            intro = f'{wcount:>8} {Ns(pts, "point"):>9} {{{s}}}: '
            groups= group_by(bins[s], key=word_score)
            strs  = [' '.join(w for w in sorted(groups[s])) + f' ({s})'
                     for s in reversed(sorted(groups))]
            print(fill(intro + ', '.join(strs), width=114, subsequent_indent=' '*4))
            
def Ns(n: int, noun: str) -> str:
    """A string with the int `n` followed by the plural or singular of noun:
    Ns(3, 'bear') => '3 bears'; Ns(1, 'world') => '1 world'"""  
    return f"{n:,d} {noun}{' ' if n == 1 else 's'}"

def group_by(items, key) -> dict:
    "Group items into bins of a dict by key: {key(item): [item, ...], ...}."
    bins = defaultdict(list)
    for item in items:
        bins[key(item)].append(item)
    return bins
```

Here are reports for the mini and full word lists:


```python
report(hc, mini)
```

```
Honeycomb(letters='AEGLMPX', center='G'): 4 words 24 points from a 6 word list:

1 pangram  15 points {AEGLMPX}: MEGAPLEX (15)
 1 word   1 point  {AEGM}: GAME (1)
 2 words  8 points {AGLM}: AMALGAM (7), GLAM (1)

```

```python
report(words=mini)
```

```
Top Honeycomb(letters='ACEIORT', center='A'): 2 words 31 points from a 6 word list:

2 pangrams 31 points {ACEIORT}: CACCIATORE (17), EROTICA (14)

```

```python
report()
```

```
Top Honeycomb(letters='AEGINRT', center='R'): 537 words 3,898 points from a 44,585 word list:

50 pangrams 832 points {AEGINRT}: REAGGREGATING REINTEGRATING (20), ENTERTAINING INTENERATING REGENERATING
    REINITIATING (19), AGGREGATING GRATINEEING INTEGRATING ITINERATING REATTAINING REINTEGRATE REITERATING
    RETARGETING (18), ENTRAINING ENTREATING GARNIERITE GENERATING GREATENING INGRATIATE INTERREGNA INTREATING
    REGRANTING RETRAINING RETREATING (17), ARGENTINE ARGENTITE GARTERING INTEGRATE INTERGANG ITERATING NATTERING
    RATTENING REGRATING RETAGGING RETAINING RETEARING TANGERINE TARGETING TATTERING (16), AERATING GNATTIER
    GRATINEE INTERAGE TREATING (15), GRANITE GRATINE INGRATE TANGIER TEARING (14)
35 words 270 points {AEGINR}: REARRANGING (11), ENGRAINING GANGRENING REENGAGING (10), GARNERING GREGARINE
    REEARNING REGAINING REGEARING (9), AGREEING ANEARING ANGERING ARGININE ENRAGING GRAINIER REGAINER (8), AGINNER
    ANERGIA ANGRIER EARNING EARRING ENGRAIN GEARING GRAINER GRANNIE NAGGIER NEARING RANGIER REARING REGINAE (7),
    EARING GAINER REAGIN REGAIN REGINA (6)
 5 words 34 points {AEGIRT}: AIGRETTE IRRIGATE (8), AIGRET GAITER TRIAGE (6)
13 words 94 points {AEGNRT}: REGENERATE (10), GENERATE TEENAGER (8), GRANTEE GRANTER GREATEN NEGATER REAGENT
    REGNANT REGRANT TANAGER (7), ARGENT GARNET (6)
30 words 232 points {AEINRT}: ENTERTAINER (11), INTENERATE REINITIATE (10), ENTERTAIN ENTRAINER ITINERANT
    ITINERATE (9), ATTAINER INERRANT INERTIAE REATTAIN RETAINER RETIRANT TRIENNIA (8), ARENITE ENTRAIN INERTIA
    INTREAT ITERANT NATTIER NITRATE RETINAE RETRAIN TERRAIN TERTIAN TRAINEE TRAINER (7), RATINE RETAIN RETINA (6)
21 words 167 points {AGINRT}: INGRATIATING (12), IRRIGATING IRRITATING (10), INTRIGANT NARRATING NITRATING
    TITRATING (9), ATTIRING GRANTING TRAINING TRIAGING (8), AIRTING GRANITA GRATING RANTING RATTING TARRING
    TARTING (7), GRATIN RATING TARING (6)
26 words 218 points {EGINRT}: REINTERRING (11), REENTERING REGREETING REGRETTING REIGNITING TRIGGERING (10),
    GETTERING INTERNING INTERRING RETINTING TEETERING TENTERING TITTERING (9), ENTERING GREETING REIGNITE RETIRING
    (8), GITTERN IGNITER INTEGER RENTING RETTING RINGENT TIERING TREEING (7), ENGIRT (6)
18 words 120 points {AEGNR}: GREENGAGE REARRANGE (9), ARRANGER GANGRENE REENGAGE (8), ARRANGE ENGAGER GRANGER (7),
    ENRAGE GANGER GARNER GENERA GRANGE NAGGER RANGER (6), ANGER RANGE REGNA (5)
19 words 123 points {AEGRT}: REAGGREGATE (11), AGGREGATE (9), RETARGET (8), ETAGERE GREATER REGATTA REGRATE (7),
    ERGATE GARGET GARRET GARTER GRATER TAGGER TARGET (6), GRATE GREAT RETAG TARGE TERGA (5)
 3 words 19 points {AEINR}: RAINIER (7), INANER NARINE (6)
20 words 135 points {AEIRT}: REITERATE (9), IRRITATE RETIARII TERRARIA (8), ARIETTA ARIETTE ATTRITE ITERATE
    RATTIER TARRIER TATTIER TEARIER TITRATE (7), ARTIER ATTIRE IRATER RATITE (6), IRATE RETIA TERAI (5)
19 words 132 points {AENRT}: RETREATANT (10), REENTRANT (9), ANTEATER NARRATER RATTENER (8), ENTRANT ENTREAT
    NARRATE RATTEEN TERNATE TERRANE (7), ENTERA ERRANT NATTER NEATER RANTER RATTEN TANNER (6), ANTRE (5)
19 words 138 points {AGINR}: ARRAIGNING INGRAINING (10), ARRANGING (9), AGRARIAN GARAGING GNARRING GRAINING (8),
    ANGARIA ARRAIGN GARRING INGRAIN RAGGING RAINING RANGING (7), AIRING RAGING RARING (6), GARNI GRAIN (5)
 1 word   5 points {AGIRT}: TRAGI (5)
 1 word   5 points {AGNRT}: GRANT (5)
 9 words 64 points {AINRT}: TRINITARIAN (11), ANTIARIN IRRITANT (8), ANTIAIR INTRANT TITRANT (7), ANTIAR (6),
    RIANT TRAIN (5)
24 words 186 points {EGINR}: REENGINEERING (13), ENGINEERING (11), REENGINEER REGREENING (10), GINGERING RENIGGING
    RERIGGING (9), ENGINEER GREENIER GREENING REIGNING RENEGING (8), GINNIER GREEING GREENIE GRINNER REINING (7),
    ERRING GINGER GINNER NIGGER RINGER (6), REIGN RENIG (5)
 4 words 27 points {EGIRT}: GRITTIER (8), TERGITE TRIGGER (7), TIGER (5)
 2 words 12 points {EGNRT}: GERENT REGENT (6)
29 words 190 points {EINRT}: INTERNEE INTERTIE RENITENT RETINENE RETINITE (8), INTERNE NETTIER NITERIE NITRITE
    NITTIER REINTER RENTIER TEENIER TENTIER TERRINE TINNIER (7), ENTIRE INTERN RETINE RETINT TINIER TINNER TINTER
    TRIENE (6), INERT INTER NITER NITRE TRINE (5)
 6 words 43 points {GINRT}: GRITTING TRIGGING (8), GIRTING RINGGIT TRINING (7), TIRING (6)
17 words 84 points {AEGR}: ARREARAGE (9), EAGERER (7), GAGGER GARAGE RAGGEE REGEAR REGGAE (6), AGGER AGREE EAGER
    EAGRE EGGAR GAGER RAGEE (5), AGER GEAR RAGE (1)
 4 words 22 points {AEIR}: AERIER AIRIER (6), AERIE AIRER (5)
 9 words 40 points {AENR}: EARNER NEARER REEARN (6), ANEAR ARENA RANEE RERAN (5), EARN NEAR (1)
24 words 127 points {AERT}: RETREATER (9), TARTRATE (8), RETREAT TREATER (7), AERATE ERRATA RATTER RETEAR TARTER
    TATTER TEARER TERRAE (6), ARETE EATER RATER REATA TARRE TATER TERRA TETRA TREAT (5), RATE TARE TEAR (1)
 2 words  6 points {AGIR}: AGRIA (5), RAGI (1)
 5 words 13 points {AGNR}: GNARR GRANA (5), GNAR GRAN RANG (1)
 3 words 13 points {AGRT}: RAGTAG TAGRAG (6), GRAT (1)
 4 words  8 points {AINR}: NAIRA (5), AIRN RAIN RANI (1)
 5 words 21 points {AIRT}: ATRIA RIATA TIARA TRAIT (5), AIRT (1)
10 words 50 points {ANRT}: TANTARA TARTANA (7), ARRANT RATTAN TANTRA TARTAN (6), ANTRA RATAN (5), RANT TARN (1)
 3 words 17 points {EGIR}: GREIGE RIGGER (6), RERIG (5)
 6 words 37 points {EGNR}: GREENER REGREEN RENEGER (7), RENEGE (6), GENRE GREEN (5)
 7 words 45 points {EGRT}: REGRETTER (9), GREETER REGREET (7), GETTER REGRET (6), EGRET GREET (5)
 4 words 17 points {EINR}: RENNIN (6), INNER RENIN (5), REIN (1)
17 words 87 points {EIRT}: TITTERER (8), RETIREE RETIRER TERRIER (7), RETIRE RITTER TERRIT TITTER TRITER (6),
    RETIE TITER TITRE TRIER TRITE (5), RITE TIER TIRE (1)
19 words 104 points {ENRT}: ENTERER REENTER TERREEN TERRENE (7), ENTREE ETERNE NETTER RENNET RENTER RETENE TEENER
    TENNER TENTER (6), ENTER RENTE TERNE TREEN (5), RENT TERN (1)
 9 words 44 points {GINR}: GRINNING (8), GIRNING RIGGING RINGING RINNING (7), IRING (5), GIRN GRIN RING (1)
 3 words  3 points {GIRT}: GIRT GRIT TRIG (1)
 7 words 25 points {AER}: ARREAR REARER (6), AREAE RARER (5), AREA RARE REAR (1)
 2 words  2 points {AGR}: AGAR RAGA (1)
 2 words  2 points {AIR}: ARIA RAIA (1)
 5 words 24 points {ART}: RATATAT (7), TARTAR (6), ATTAR TATAR (5), TART (1)
 4 words 15 points {EGR}: GREEGREE (8), EGGER (5), EGER GREE (1)
 2 words 11 points {EIR}: EERIER (6), EERIE (5)
 1 word   1 point  {ENR}: ERNE (1)
 7 words 27 points {ERT}: TEETER TERETE TERRET TETTER (6), RETE TREE TRET (1)
 2 words  7 points {GIR}: GRIGRI (6), GRIG (1)

```

# 'S' Words

What if we allowed honeycombs to have an 'S' in them? I'll make a new word list that doesn't exclude the 'S'-words, and report on it:


```python
valid_letters.add('S') # Make 'S' a legal letter

big_s = word_list(open(file).read())

report(words=big_s)
```

```
Top Honeycomb(letters='AEINRST', center='E'): 1,179 words 8,681 points from a 98,141 word list:

86 pangrams 1,381 points {AEINRST}: ENTERTAINERS INTERSTRAINS STRAITNESSES (19), INTENERATES INTERSTATES
    INTERSTRAIN IRATENESSES ITINERARIES REINITIATES RESTRAINERS TRISTEARINS (18), ANTISTRESS ARTINESSES ENTERTAINS
    ENTRAINERS ENTREATIES ERRANTRIES INTERSTATE INTRASTATE ITINERANTS ITINERATES REINSTATES RESISTANTS RESTRAINER
    RESTRAINTS SANITARIES STANNARIES STRAITNESS TANISTRIES TEARSTAINS TENANTRIES TRANSIENTS TRISTEARIN (17),
    ARSENITES ATTAINERS INSTANTER IRATENESS REATTAINS REINSTATE RESINATES RESISTANT RESTRAINS RESTRAINT RETAINERS
    RETIRANTS SEATRAINS STEARINES STRAINERS STRAITENS TANNERIES TEARSTAIN TERNARIES TRANSIENT (16), ANTISERA
    ARENITES ARSENITE ARTINESS ENTRAINS INERTIAS INTREATS NITRATES RAINIEST RATANIES RESINATE RESTRAIN RETRAINS
    RETSINAS SEATRAIN STAINERS STEARINE STEARINS STRAINER STRAITEN TERRAINS TERTIANS TRAINEES TRAINERS (15),
    ANESTRI ANTSIER NASTIER RATINES RETAINS RETINAS RETSINA STAINER STEARIN (14)
16 words 124 points {AEINRS}: AIRINESSES (10), ANSERINES INSNARERS SIRENIANS (9), AIRINESS ANSERINE INSNARER
    INSNARES SIRENIAN (8), ARSINES INSANER INSNARE SENARII SIERRAN (7), ARISEN ARSINE (6)
30 words 232 points {AEINRT}: ENTERTAINER (11), INTENERATE REINITIATE (10), ENTERTAIN ENTRAINER ITINERANT
    ITINERATE (9), ATTAINER INERRANT INERTIAE REATTAIN RETAINER RETIRANT TRIENNIA (8), ARENITE ENTRAIN INERTIA
    INTREAT ITERANT NATTIER NITRATE RETINAE RETRAIN TERRAIN TERTIAN TRAINEE TRAINER (7), RATINE RETAIN RETINA (6)
80 words 713 points {AEINST}: INSATIATENESSES INSTANTANEITIES (15), INSATIATENESS INSTANTNESSES (13), ASSASSINATES
    INNATENESSES INSTANTIATES (12), ASININITIES ASSASSINATE INSTANTIATE INSTANTNESS NASTINESSES NATTINESSES
    TASTINESSES TATTINESSES (11), INNATENESS INSANITIES INTESTATES SENTENTIAE TITANESSES (10), ANISETTES ANTISENSE
    ANTISTATE ASTATINES INANITIES INITIATES INSATIATE INSENSATE INTESTATE NASTINESS NATTINESS SANITATES SANITISES
    SENTENTIA STANNITES TAENIASES TAENIASIS TASTINESS TATTINESS TETANISES TITANATES TITANITES (9), ANISETTE
    ANTSIEST ASTATINE ENTASIAS ETESIANS INSANEST INSTATES ISATINES NASTIEST NATTIEST SANITATE SANITIES SANITISE
    SATINETS SESTINAS STANINES STANNITE TENIASES TENIASIS TETANIES TETANISE TITANESS (8), ENTASIA ENTASIS ETESIAN
    INANEST INSTATE ISATINE NASTIES SATINET SESTINA STANINE TAENIAS TANSIES TISANES (7), TENIAS TINEAS TISANE (6)
60 words 473 points {AEIRST}: TRAITRESSES (11), ARTISTRIES REITERATES TERTIARIES (10), ARTERITIS ASSISTERS
    IRRITATES SATIRISES SESTERTIA STARRIEST STRAITEST TRAITRESS TREATISES (9), ARIETTAS ARIETTES ARISTATE ARTERIES
    ARTISTES ARTSIEST ASSISTER ASTERIAS ATRESIAS EATERIES ITERATES RARITIES RATTIEST SATIRISE SERIATES STARRIER
    STRAITER STRIATES TARRIERS TARRIEST TARSIERS TEARIEST TITRATES TREATIES TREATISE TRISTATE (8), AERIEST AIRIEST
    ARISTAE ARTIEST ARTISTE ARTSIER ASTERIA ATRESIA ATTIRES IRATEST RATITES SATIRES SERIATE STRIATE TARRIES
    TARSIER TASTIER (7), AIREST SATIRE STRIAE TERAIS (6)
40 words 336 points {AENRST}: EARNESTNESSES (13), EARNESTNESS RETREATANTS (11), ARRESTANTS EASTERNERS REENTRANTS
    TARANTASES TARTNESSES (10), ANTEATERS ARRESTANT ARSENATES ASSENTERS EASTERNER NARRATERS RATTENERS SARSENETS
    SERENATAS (9), ARSENATE ASSENTER EARNESTS ENTRANTS ENTREATS NARRATES RATTEENS SARSENET SERENATA SERENATE
    TARTNESS TERRANES (8), EARNEST EASTERN ERRANTS NATTERS NEAREST RANTERS RATTENS TANNERS (7), ANTRES ASTERN
    STERNA (6)
70 words 582 points {EINRST}: SINISTERNESSES (14), ENTIRENESSES SINISTERNESS (12), ENTERITISES INERTNESSES
    TRITENESSES (11), ENTIRENESS ENTIRETIES ETERNITIES INTERNISTS SERENITIES (10), ENTERITIS ETERNISES INERTNESS
    INSERTERS INSETTERS INSISTERS INTERESTS INTERNEES INTERNIST INTERTIES REENTRIES REINSERTS RETINENES RETINITES
    RETINITIS STERNITES TEENTSIER TRINITIES TRITENESS (9), ETERNISE INSERTER INSETTER INSISTER INTENSER INTEREST
    INTERNES NITERIES NITRITES REINSERT REINTERS RENTIERS SENTRIES SINISTER STERNITE STINTERS TEENSIER TERRINES
    TRIENTES (8), ENTIRES ENTRIES ESTRINS INSERTS INTERNS RETINES RETINTS SINTERS STINTER TINNERS TINTERS TRIENES
    (7), ESTRIN INERTS INSERT INTERS NITERS NITRES SINTER TRIENS TRINES (6)
 3 words  19 points {AEINR}: RAINIER (7), INANER NARINE (6)
17 words 129 points {AEINS}: INSANENESSES (12), INANENESSES (11), EASINESSES INSANENESS (10), INANENESS (9),
    EASINESS (8), ASININE NANNIES SANSEIS SIENNAS (7), ANISES INANES INSANE SANIES SANSEI SIENNA (6), ANISE (5)
10 words  64 points {AEINT}: INITIATE TITANATE TITANITE (8), TAENIAE (7), INNATE TAENIA TENIAE (6), ENTIA TENIA
    TINEA (5)
17 words 106 points {AEIRS}: RERAISES (8), ARRISES RAISERS RERAISE SASSIER SIERRAS (7), AERIES AIRERS ARISES
    EASIER RAISER RAISES SERAIS SIERRA (6), ARISE RAISE SERAI (5)
20 words 135 points {AEIRT}: REITERATE (9), IRRITATE RETIARII TERRARIA (8), ARIETTA ARIETTE ATTRITE ITERATE
    RATTIER TARRIER TATTIER TEARIER TITRATE (7), ARTIER ATTIRE IRATER RATITE (6), IRATE RETIA TERAI (5)
15 words 112 points {AEIST}: SATIETIES STEATITES (9), SASSIEST SATIATES STEATITE TASTIEST TATTIEST (8), EASIEST
    ETATIST SATIATE SIESTAS TASSIES TATTIES (7), SIESTA TASSIE (6)
25 words 172 points {AENRS}: NEARNESSES RARENESSES (10), ENSNARERS (9), ENSNARER ENSNARES NEARNESS RARENESS
    RENNASES (8), EARNERS ENSNARE REEARNS RENNASE SARSENS SNARERS (7), ANEARS ARENAS RANEES SARSEN SNARER SNARES
    (6), EARNS NARES NEARS SANER SNARE (5)
19 words 132 points {AENRT}: RETREATANT (10), REENTRANT (9), ANTEATER NARRATER RATTENER (8), ENTRANT ENTREAT
    NARRATE RATTEEN TERNATE TERRANE (7), ENTERA ERRANT NATTER NEATER RANTER RATTEN TANNER (6), ANTRE (5)
32 words 217 points {AENST}: NEATNESSES (10), SETENANTS (9), ANATASES ANTENNAS NEATNESS SENSATES SETENANT TANNATES
    (8), ANATASE ANNATES ASSENTS ENTASES NEATENS NEATEST SATEENS SENATES SENSATE TANNEST TENANTS (7), ANENST
    ANSATE ASSENT ENATES SANEST SATEEN SENATE STANES (6), ANTES ETNAS NATES NEATS STANE (5)
85 words 604 points {AERST}: RETREATERS (10), ARRESTEES ARRESTERS ASSERTERS ATTESTERS ESTERASES REARRESTS
    REASSERTS STEARATES TARTRATES (9), ARRESTEE ARRESTER ASSERTER ATTESTER ESTERASE ESTREATS REARREST REASSERT
    RESTARTS RESTATES RETASTES RETREATS SERRATES STARTERS STEARATE STRASSES STRETTAS TERRASES TESSERAE TREATERS
    (8), AERATES ARRESTS ASSERTS EASTERS ERRATAS ESTREAT RASTERS RATTERS RESEATS RESTART RESTATE RETASTE RETEARS
    SEAREST SEATERS SERRATE STARERS STARETS STARTER STATERS STRETTA TARTEST TASTERS TATTERS TEARERS TEASERS
    TESSERA TRASSES (7), ARETES ARREST ASSERT ASTERS EASTER EATERS RAREST RASTER RATERS REATAS RESEAT SEATER
    STARER STARES STATER TARRES TASTER TATERS TEASER TERRAS TETRAS TREATS (6), ASTER RATES STARE TARES TEARS (5)
29 words 184 points {EINRS}: EERINESSES (10), EERINESS ESERINES (8), ESERINE RENNINS RERISEN RINSERS SEINERS
    SEREINS SERINES SINNERS (7), INNERS NEREIS RENINS RESINS RINSER RINSES SEINER SEREIN SERINE SERINS SINNER
    SIRENS (6), REINS RESIN RINSE RISEN SERIN SIREN (5)
29 words 190 points {EINRT}: INTERNEE INTERTIE RENITENT RETINENE RETINITE (8), INTERNE NETTIER NITERIE NITRITE
    NITTIER REINTER RENTIER TEENIER TENTIER TERRINE TINNIER (7), ENTIRE INTERN RETINE RETINT TINIER TINNER TINTER
    TRIENE (6), INERT INTER NITER NITRE TRINE (5)
58 words 469 points {EINST}: INTENSENESSES (13), INTENTNESSES (12), INTENSENESS INTENSITIES TESTINESSES
    TINNINESSES (11), INSENTIENT INTENTNESS INTESTINES SENSITISES TEENTSIEST TININESSES (10), EINSTEINS INSISTENT
    INTENSEST INTESTINE NINETEENS SENSITISE SENTIENTS TEENSIEST TENSITIES TESTINESS TINNINESS (9), EINSTEIN
    ENTITIES NETTIEST NINETIES NITTIEST SENTIENT SESTINES SIENITES TEENIEST TENNISES TENNISTS TENTIEST TININESS
    TINNIEST (8), INTENSE INTENTS INTINES SENNITS SESTINE SIENITE TENNIES TENNIST TINIEST (7), INSETS SENITI
    SENNIT SITTEN STEINS TENNIS (6), INSET NEIST NITES SENTI STEIN TINES (5)
38 words 262 points {EIRST}: RESISTERS TITTERERS TRESSIEST (9), IRITISES RESISTER RETIREES RETIRERS STIRRERS
    TERRIERS TRESSIER (8), EERIEST RESISTS RESITES RETIRES RETRIES RITTERS SISTERS SITTERS STIRRER STRETTI TERRIES
    TERRITS TESTIER TITTERS TRITEST (7), RESIST RESITE RETIES SISTER SITTER TITERS TITRES TRIERS TRISTE (6), RITES
    TIERS TIRES TRIES (5)
35 words 246 points {ENRST}: STERNNESSES TERSENESSES (11), STERNNESS TERSENESS (9), ENTERERS REENTERS SERENEST
    STERNEST TERREENS TERRENES (8), ENTREES NESTERS NETTERS RENESTS RENNETS RENTERS RESENTS RETENES STERNER
    TEENERS TENNERS TENTERS (7), ENTERS NESTER RENEST RENTES RESENT STERNS TENSER TERNES TREENS (6), NERTS RENTS
    STERN TERNS (5)
 2 words  11 points {AEIN}: NANNIE (6), INANE (5)
 4 words  22 points {AEIR}: AERIER AIRIER (6), AERIE AIRER (5)
 2 words  13 points {AEIS}: SASSIES (7), EASIES (6)
 1 word    6 points {AEIT}: TATTIE (6)
 9 words  40 points {AENR}: EARNER NEARER REEARN (6), ANEAR ARENA RANEE RERAN (5), EARN NEAR (1)
 9 words  46 points {AENS}: SANENESSES (10), SANENESS (8), SENNAS (6), ANSAE SANES SENNA SENSA (5), ANES SANE (1)
13 words  63 points {AENT}: ANTENNAE (8), ANTENNA TANNATE (7), ATTENT NEATEN TENANT (6), ANENT ANTAE EATEN ENATE
    (5), ANTE ETNA NEAT (1)
26 words 121 points {AERS}: REASSESSES (10), REASSESS (8), ARREARS ERASERS REARERS (7), ERASER ERASES RASERS
    SAREES SEARER (6), AREAS ARSES ERASE RARES RASER RASES REARS SAREE SEARS (5), ARES ARSE EARS ERAS RASE SEAR
    SERA (1)
24 words 127 points {AERT}: RETREATER (9), TARTRATE (8), RETREAT TREATER (7), AERATE ERRATA RATTER RETEAR TARTER
    TATTER TEARER TERRAE (6), ARETE EATER RATER REATA TARRE TATER TERRA TETRA TREAT (5), RATE TARE TEAR (1)
35 words 164 points {AEST}: TESTATES (8), ATTESTS ESTATES TASSETS TESTATE (7), ASSETS ATTEST ESTATE STASES STATES
    TASSES TASSET TASTES TEASES TESTAE (6), ASSET EASTS SATES SEATS SETAE STATE TASSE TASTE TATES TEASE TEATS
    TESTA (5), ATES EAST EATS ETAS SATE SEAT SETA TEAS (1)
 4 words  17 points {EINR}: RENNIN (6), INNER RENIN (5), REIN (1)
10 words  53 points {EINS}: NINNIES SEISINS (7), NISEIS SEINES SEISIN (6), NINES NISEI SEINE SINES (5), SINE (1)
 6 words  28 points {EINT}: NINETEEN (8), INTENT INTINE TENTIE (6), NITE TINE (1)
20 words 101 points {EIRS}: RERISES SEISERS SERRIES SIRREES SISSIER (7), IRISES RERISE RISERS SEISER SERIES SIREES
    SIRREE (6), RISER RISES SIREE SIRES (5), IRES REIS RISE SIRE (1)
17 words  87 points {EIRT}: TITTERER (8), RETIREE RETIRER TERRIER (7), RETIRE RITTER TERRIT TITTER TRITER (6),
    RETIE TITER TITRE TRIER TRITE (5), RITE TIER TIRE (1)
 8 words  41 points {EIST}: SISSIEST TESTIEST (8), TITTIES (7), TESTIS (6), SITES STIES (5), SITE TIES (1)
12 words  80 points {ENRS}: SERENENESSES (12), SERENENESS (10), SNEERERS (8), SERENER SERENES SNEERER (7), RESEEN
    SERENE SNEERS (6), ERNES SNEER (5), ERNS (1)
19 words 104 points {ENRT}: ENTERER REENTER TERREEN TERRENE (7), ENTREE ETERNE NETTER RENNET RENTER RETENE TEENER
    TENNER TENTER (6), ENTER RENTE TERNE TREEN (5), RENT TERN (1)
18 words  94 points {ENST}: TENSENESSES (11), TENSENESS (9), ENTENTES (8), SENNETS TENSEST (7), SENNET TENETS
    TENSES (6), NESTS NETTS SENTE TEENS TENSE TENTS (5), NEST NETS SENT TENS (1)
44 words 266 points {ERST}: RESTRESSES (10), RESETTERS (9), RESETTER RESTRESS STEERERS STRESSES (8), RESTERS
    RETESTS SETTERS STEERER STREETS STRETTE TEETERS TERRETS TERSEST TESTERS TETTERS TRESSES (7), ESTERS REESTS
    RESETS RESTER RETEST SEREST SETTER STEERS STERES STREET STRESS TERSER TESTER (6), ESTER REEST RESET RESTS
    STEER STERE TERSE TREES TRESS TRETS (5), ERST REST RETS (1)
 7 words  25 points {AER}: ARREAR REARER (6), AREAE RARER (5), AREA RARE REAR (1)
 8 words  33 points {AES}: ASSESSES (8), ASSESS SASSES (6), ASSES EASES (5), ASEA EASE SEAS (1)
 2 words   2 points {AET}: TATE TEAT (1)
 1 word    1 point  {EIN}: NINE (1)
 2 words  11 points {EIR}: EERIER (6), EERIE (5)
 7 words  35 points {EIS}: SISSIES (7), ISSEIS SEISES (6), ISSEI SEISE SISES (5), SEIS (1)
 1 word    6 points {EIT}: TITTIE (6)
 1 word    1 point  {ENR}: ERNE (1)
 6 words  20 points {ENS}: NESSES SENSES (6), SENSE (5), NESS SEEN SENE (1)
 5 words  15 points {ENT}: ENTENTE (7), TENET (5), NETT TEEN TENT (1)
13 words  52 points {ERS}: SEERESSES (9), SEERESS (7), RESEES (6), ERSES RESEE SEERS SERER SERES (5), ERRS REES
    SEER SERE SERS (1)
 7 words  27 points {ERT}: TEETER TERETE TERRET TETTER (6), RETE TREE TRET (1)
18 words  79 points {EST}: SESTETS SETTEES TESTEES TSETSES (7), SESTET SETTEE TESTEE TESTES TSETSE (6), SETTS
    STETS TESTS (5), SETS SETT STET TEES TEST TETS (1)
 1 word    1 point  {EN}: NENE (1)
 3 words   7 points {ES}: ESSES (5), ESES SEES (1)

```

Allowing 'S' more than doubles the length of the word list and the score of the top honeycomb!

Here are the highest-scoring honeycombs (with and without an S) with their stats and a pangram to remember them by:

<img src="http://norvig.com/honeycombs.png" width="350">
<center>
   537 words &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 1,179 words 
    <br>50 pangrams  &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 86 pangrams
    <br>3,898 points &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 8,681 points
    <br> &nbsp;  &nbsp; RETAINING &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ENTERTAINERS
</center>


# Summary

This notebook showed how to find the highest-scoring honeycomb, starting from a brute-force baseline approach (which we didn't actually run) and modifying the approach with three key improvements:

1. **Brute Force Enumeration**: Compute total score for every honeycomb; return the highest-scoring.
2. **Pangram Lettersets**: Compute total score for  honeycombs that are pangram lettersets (with all 7 centers).
3. **Points Table**: Precompute score for each letterset; for each candidate honeycomb, sum  63 letter subset scores.
4. **Branch and Bound**: Try all 7 centers only for lettersets that score better than the top score so far.

The key ideas paid off in efficiency improvements:


|Approach|Honeycombs|Reduction|`total_score` Time|Speedup|Overall  Time|Overall Speedup|
|--------|----------|--------|----|---|---|---|
|1. **Brute Force Enumeration**|3,364,900|——|9000 microseconds|——|8.5 hours (est.)|——|
|2. **Pangram Lettersets**|55,902|60×|9000 microseconds|——|500 sec (est.)|60×|
|3. **Points Table**|55,902|——|26 microseconds|300×|1.6 seconds|20,000×|
|4. **Branch and Bound**|8,084 |7×|26 microseconds|——|0.35 seconds|90,000×|



