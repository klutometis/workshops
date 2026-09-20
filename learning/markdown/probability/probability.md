<div style="text-align: right">Peter Norvig, 12 Feb 2016<br>Python 3 updates 2025</div>

# A Concrete Introduction to Probability (using Python)

In 1814, Pierre-Simon Laplace provided a classic [definition](https://en.wikipedia.org/wiki/Classical_definition_of_probability) of probability:

>*Probability theory is nothing but common sense reduced to calculation. ... [Probability] is thus simply a fraction whose numerator is the number of favorable cases and whose denominator is the number of all the cases possible ... when nothing leads us to expect that any one of these cases should occur more than any other.*

| |
|--|
|![Laplace](https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/AduC_197_Laplace_%28P.S.%2C_marquis_de%2C_1749-1827%29.JPG/180px-AduC_197_Laplace_%28P.S.%2C_marquis_de%2C_1749-1827%29.JPG)|
|<a href="https://en.wikipedia.org/wiki/Pierre-Simon_Laplace">Pierre-Simon Laplace</a> (1749–1827)|


Laplace nailed it. To untangle a probability problem, all you have to do is define exactly what the cases are, and carefully count the favorable and total cases. Let's be clear on our vocabulary words:


- **[Trial](https://en.wikipedia.org/wiki/Experiment_%28probability_theory%29):**
  A single occurrence with an outcome that is uncertain until it happens.
  <br>*For example, rolling a single die.*
- **[Outcome](https://en.wikipedia.org/wiki/Outcome_%28probability%29):**
  A possible result of a trial; one particular state of the world. What Laplace calls a **case.**
  <br>*For example: the die comes up as* `4`.
- **[Sample Space](https://en.wikipedia.org/wiki/Sample_space):**
  The set of all possible outcomes for the trial.
  <br>*For example,* `{1, 2, 3, 4, 5, 6}`.
- **[Event](https://en.wikipedia.org/wiki/Event_%28probability_theory%29):**
  A subset of the sample space, a set of outcomes that together have some property we are interested in.
  <br>*For example, the event "even die roll" is the set of outcomes* `{2, 4, 6}`.
- **[Probability](https://en.wikipedia.org/wiki/Probability_theory):**
  As Laplace said, the probability of an event with respect to a sample space is the "number of favorable cases" (outcomes from the sample space that are in the event) divided by the "number of all the cases" in the sample space, assuming "nothing leads us to expect that any one of these cases should occur more than any other." Since this is a proper fraction, probability will always be a number between 0 (representing an impossible event) and 1 (representing a certain event).
<br>*For example, the probability of an even die roll is 3/6 = 1/2.*

This notebook will explore these concepts in a concrete way using Python code. The code is meant to be succint and explicit, and fast enough to handle sample spaces with millions of outcomes. If you need to handle trillions, you'll want a more efficient implementation. I also have  [another notebook](http://nbviewer.jupyter.org/url/norvig.com/ipython/ProbabilityParadox.ipynb) that covers  paradoxes in Probability Theory.

First some imports we will need later, and some type definitions:


```python
from fractions import Fraction
from itertools import combinations, product
from typing import *
import math

Space = set # A sample space is a set of all possible outcomes
Event = set # An event is a subset of the sample space
```

# P is for Probability

The code below implements Laplace's quote directly: *Probability is thus simply a fraction whose numerator is the number of favorable cases and whose denominator is the number of all the cases possible.*


```python
def P(event: Event, cases: Space) -> Fraction:
    """The probability of an event: the number of favorable cases divided by the number of cases."""
    return Fraction(number(favorable(event, cases)),
                    number(cases))
```

The number of cases is just the `len` of a set, and the favorable cases are those that are in the event and in the sample space.


```python
number = len # The number of cases is the length, or size, of a set

def favorable(event: Event, cases: Space) -> Event: 
    """The cases that are in the event."""
    return event.intersection(cases)
```


# Warm-up Problem: Die Roll


What's the probability of an even number with a single roll of a six-sided fair die? 

Mathematicians traditionally use a single capital letter to denote a sample space; I'll use `D` for the die:


```python
D = {1, 2, 3, 4, 5, 6} # the sample space for the die
```

I can then define the event of rolling an even number, and ask for the probability of that event:


```python
even = {2, 4, 6} # the event of an even roll

P(even, D)
```

```
Fraction(1, 2)
```

Good to confirm what we already knew. We can explore some other events:


```python
odd = {1, 3, 5, 7, 9, 11, 13}

P(odd, D)
```

```
Fraction(1, 2)
```

```python
prime = {2, 3, 5, 7, 11, 13}

P((even | prime), D) # The probability of an even or prime die roll
```

```
Fraction(5, 6)
```

```python
P((odd & prime), D) # The probability of an odd prime die roll
```

```
Fraction(1, 3)
```

# Card Problems

Consider a deck of playiong cards. An individual card has a rank and  suit, and will be represented as a string, like `'A♥'` for the Ace of Hearts. There are 4 suits and 13 ranks, so there are 52 cards in a deck:


```python
suits = '♥♠♦♣'
ranks = 'AKQJT98765432'
deck  = [r + s for r in ranks for s in suits]
len(deck)
```

```
52
```

Now I want to define `Hands` as the sample space of all possible 5-card hands that could be dealt  from a deck. The function `itertools.combinations` does most of the work; we than concatenate the combinations into space-separateds string using `joins`:


```python
def joins(strings: Set[tuple], sep=' ') -> Set[str]: 
    """Join each of the tuples into strings."""
    return {sep.join(s) for s in strings}

Hands = joins(combinations(deck, 5))

len(Hands)
```

```
2598960
```

There are over 2.5 million hands; too many to look at them all, but we can sample a few:


```python
list(Hands)[::250000]
```

```
['J♥ 9♣ 6♥ 6♦ 4♣',
 'K♣ T♦ 9♠ 5♠ 3♥',
 'Q♣ J♥ 9♠ 4♥ 4♣',
 'K♥ 9♣ 6♣ 3♥ 2♠',
 'A♦ J♠ 4♥ 4♦ 2♣',
 'Q♣ J♥ J♦ 9♠ 4♦',
 'K♠ K♣ 7♣ 6♥ 4♠',
 'K♦ Q♥ 9♠ 8♦ 3♠',
 'K♦ Q♠ T♠ 3♥ 2♦',
 'J♣ T♦ 8♣ 7♥ 3♦',
 'A♣ J♣ 9♥ 8♦ 7♦']
```

Now we can answer questions like the probability of being dealt a flush (5 cards of the same suit):


```python
flush = {hand for hand in Hands if any(hand.count(suit) == 5 for suit in suits)}

P(flush, Hands)
```

```
Fraction(33, 16660)
```

Or the probability of four of a kind:


```python
four_kind = {hand for hand in Hands if any(hand.count(rank) == 4 for rank in ranks)}

P(four_kind, Hands)
```

```
Fraction(1, 4165)
```

To make these calculations we need to go through all 2.5 million  hands, so this is not the fastest way to compute probabilities, but it is straightforward.


# Urn Problems

Around 1700, Jacob Bernoulli wrote about removing colored balls from an urn in his landmark treatise *[Ars Conjectandi](https://en.wikipedia.org/wiki/Ars_Conjectandi)*, and ever since then, explanations of probability have relied on [urn problems](https://www.google.com/search?q=probability+ball+urn). (You'd think the urns would be empty by now.)

| |
|---|
|![Jacob Bernoulli](https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Jakob_Bernoulli.jpg/205px-Jakob_Bernoulli.jpg)|
|<a href="https://en.wikipedia.org/wiki/Jacob_Bernoulli">Jacob Bernoulli</a> (1655–1705)|

For example, here is a three-part problem [adapted](http://mathforum.org/library/drmath/view/69151.html)  from mathforum.org:

> *An urn contains 6 blue, 9 red, and 8 white balls.  We select six balls at random. What is the probability of each of these  outcomes:*
>
> - *All balls are red*.
> - *3 are blue, and 1 is red, and 2 are white*.
> - *Exactly 4 balls are white*.

We'll start by defining the contents of the urn. We will need a way to name the balls so that we call tell blue from red, but also tell one red ball from another red ball. I'll use the function call `balls('R', 9)` to create 9 red balls:


```python
def balls(name: str, n) -> List[str]:
    """A list of `n` distinct balls."""
    return [name + str(i) for i in range(1, n + 1)]

urn = balls('B', 6) + balls('R', 9) + balls('W', 8)
urn
```

```
['B1',
 'B2',
 'B3',
 'B4',
 'B5',
 'B6',
 'R1',
 'R2',
 'R3',
 'R4',
 'R5',
 'R6',
 'R7',
 'R8',
 'R9',
 'W1',
 'W2',
 'W3',
 'W4',
 'W5',
 'W6',
 'W7',
 'W8']
```

Now we can define the sample space, `U6`, as the set of all combinations of 6 balls:  


```python
U6 = joins(combinations(urn, 6))

list(U6)[::10_000] # A sample from the U6 set
```

```
['B3 R6 W4 W5 W6 W7',
 'B2 R2 R7 R8 W3 W4',
 'B1 R2 R4 R5 R9 W5',
 'B2 R2 R4 W3 W4 W6',
 'B6 R2 R4 R8 W1 W6',
 'R2 R5 R7 W1 W7 W8',
 'B5 R8 R9 W1 W2 W7',
 'B3 B4 B6 R8 W1 W4',
 'B4 B6 R4 R6 W1 W6',
 'B1 B3 B4 B5 R3 R9',
 'R1 R3 R4 R7 W7 W8']
```

Now I will define  `select('R', 6)` to be the event of picking exactly 6 red balls from the urn:


```python
def select(color, n, space=U6) -> set:
    "The subset of the sample space with exactly `n` balls of given `color`."
    return {s for s in space if s.count(color) == n}
```

Now I can answer the three questions:


```python
Q1 = select('R', 6)                                   # all 6 balls are red.
Q2 = select('B', 3) & select('R', 1) & select('W', 2) # 3 balls are blue, 1 is red, and 2 are white
Q3 = select('W', 4)                                   # exactly 4 balls are white
```

```python
P(Q1, U6)
```

```
Fraction(4, 4807)
```

```python
P(Q2, U6)
```

```
Fraction(240, 4807)
```

```python
P(Q3, U6)
```

```
Fraction(350, 4807)
```

## Urn problems via arithmetic

Let's verify these calculations using basic arithmetic, rather than exhaustive counting. First, how many ways can I choose 6 out of 9 red balls? It could be any of the 9 for the first ball, any of 8 remaining for the second, and  so on down to any of the remaining 4 for the sixth and final ball. But we don't care about the *order* of the six balls, so divide that product by the number of permutations of 6 things, which is 6!, giving us
9 &times; 8 &times; 7 &times; 6 &times; 5 &times; 4 / 6! = 84. In general, the number of ways of choosing *k* out of *n* items is (*n* choose *k*) = *n*! / ((*n* - *k*)! &times; *k*!).
In Python 3.8+ that is provided as the `math.comb` function.


Now we can verify the answers to the three problems. (Since `P` computes a ratio and `choose` computes a count,
I multiply the left-hand-side by `N`, the length of the sample space, to make both sides be counts.)


```python
N = len(U6)

assert N * P(Q1, U6) == math.comb(9, 6)
assert N * P(Q2, U6) == math.comb(6, 3) * math.comb(8, 2) * math.comb(9, 1)
assert N * P(Q3, U6) == math.comb(8, 4) * math.comb(6 + 9, 2)  # (6 + 9 non-white balls)
```

# Non-Equiprobable Outcomes

So far, we have accepted Laplace's assumption that *nothing leads us to expect that any one of these cases should occur more than any other*.
In real life, we often get outcomes that are not equiprobable--for example, a loaded die favors one side over the others.  We will introduce three more vocabulary items:

* [Frequency](https://en.wikipedia.org/wiki/Frequency_%28statistics%29): a non-negative number describing how often an outcome occurs. It can be a count like 5, or a ratio like 1/6.
* [Distribution](http://mathworld.wolfram.com/StatisticalDistribution.html): A mapping from outcome to frequency of that outcome. From here on, we will allow a sample space to be either a set (of equi-probable outcomes) or a distribution.
* [Probability Distribution](https://en.wikipedia.org/wiki/Probability_distribution): A probability distribution
is a distribution whose frequencies sum to 1, and are each between 0 and 1, inclusive.


I'll implemet `Dist` as a subclass of `Counter`, and re-define the type `Space` to be either a set or a `Dist`.


```python
class Dist(Counter):
    "A Distribution of {outcome: frequency} pairs."

Space = Union[set, Dist]
```

Because a `Dist` is a `Counter`, we can initialize it three different ways:
- With a collection of outcomes (equiprobable or not).
- With a mapping of `{outcome: frequency}` pairs.
- With keyword arguments, each being assigned a frequency number.

You can get the same result with any of the three ways:


```python
assert Dist('THHHTTHHT')  ==  Dist({'H': 5, 'T': 4})  ==  Dist(H=5, T=4)
```

Now I will modify the code to handle distributions.
Here's my plan:

- The function `P` is unchanged. Laplace's advice still stands!
- A sample space can be either a set or a distribution, so I will redefine three helper functions:
  - `number` now either takes the length of a set or the sum of the values of a `Dist`.
  - `favorable` now returns a `Dist` of favorable outcomes and their frequencies (not a `set`).
  - `Fraction` now uses `"/"`, not `fractions.Fraction`, because frequencies might be floats.


```python
def number(cases: Space) -> float:
    """The total frequency of all the cases in the sample space."""
    return len(cases) if isinstance(cases, set) else sum(cases.values())

def favorable(event: Event, cases: Space) -> Dist:
    """A distribution of outcomes from the sample space that are in the event."""
    return Dist({x: 1 if isinstance(cases, set) else cases[x] 
                 for x in cases if x in event})

def Fraction(n, d): "n/d"; return n / d
```

For example, here's the probability of rolling an even number with a crooked die that is loaded to prefer 6:


```python
Crooked = Dist({1: 0.1, 2: 0.1, 3: 0.1, 4: 0.1, 5: 0.1, 6: 0.5})

P(even, Crooked)
```

```
0.7
```

## Example: Birth Counts

As another example, an [article](http://people.kzoo.edu/barth/math105/moreboys.pdf) gives the following counts for two-child families in Denmark, where `GB` means a family where the first-born child is a girl and the second a boy (I'm aware that not all births can be classified as the binary "boy" or "girl," but this particular data set was reported that way):


```python
DK = Dist(GG=121801, GB=126840,
          BG=127123, BB=135138)
```

I can define some events:


```python
first_girl  = {'GG', 'GB'}
second_girl = {'GG', 'BG'}
first_boy   = {'BB', 'BG'}
second_boy  = {'BB', 'GB'}
same        = {'GG', 'BB'}
```

And ask for the probability that, say, the first or second child is a girl, or that the two children have the same sex:


```python
P(first_girl, DK)
```

```
0.48667063350701306
```

```python
P(second_girl, DK)
```

```
0.4872245557856497
```

```python
P(same, DK)
```

```
0.5029124959385557
```

The numbers say that you are slighltly more likely to have a second child of the same sex, but only by about 0.3%.


# Events as Implicit Sets

To calculate the probability of an even die roll, I originally said

    even = {2, 4, 6}
    
But that's inelegant–I had to explicitly enumerate all the even numbers from one to six. If I ever wanted to deal with a twelve or twenty-sided die, I would have to go back and redefine `even`.  I would prefer to define `even` once and for all like this:


```python
def even(n: int) -> bool: return n % 2 == 0
```

But that `even` is a function, and an event has to be a `set`. However, we can turn a function into a set with a [decorator](https://peps.python.org/pep-0318/). By annotating `even` with an `ImplicitSet` decorator, we make it act like a set–at least with respect to the set membership and intersection operators.


```python
class ImplicitSet(set):
    """An ImplicitSet is defined by a set-membership predicate. 
    Membership and intersection operations are supported; you could add more operators."""
    def __init__(self, predicate):           self.predicate = predicate
    def __contains__(self, outcome) -> bool: return self.predicate(outcome)
    def intersection(self, other) -> set:    return {x for x in other if x in self}
```

Now we can make `even` be an implicit set and use it like this:


```python
@ImplicitSet
def even(n: int) -> bool: return n % 2 == 0
```

```python
1_000_000_000 in even
```

```
True
```

```python
1_000_000_001 in even
```

```
False
```

```python
even.intersection(D) # Remember: D == {1, 2, 3, 4, 5, 6}
```

```
{2, 4, 6}
```

```python
P(even, D)
```

```
0.5
```

```python
P(even, set(range(100_000)))
```

```
0.5
```

```python
favorable(even, D)
```

```
Dist({2: 1, 4: 1, 6: 1})
```

I'll define `die(s)` to make a sample space for an *s*-sided die, and `roll(r, s)` to make a sample space for the sum of rolling *r* *s*-sided dice:


```python
def die(s: int) -> Space: 
    """The sample space for an s-sided die."""
    return set(range(1, s + 1))

def roll(n: int, s: int) -> Space:
    """The sample space for rolling `n` s-sided dice and summing them."""
    return Dist(map(sum, product(die(s), repeat=n)))
```

For example, here's the distribution for the sum of two six-sided dice:


```python
roll(2, 6)
```

```
Dist({7: 6, 6: 5, 8: 5, 5: 4, 9: 4, 4: 3, 10: 3, 3: 2, 11: 2, 2: 1, 12: 1})
```

We can check if various dice-related sample spaces are odd or even, or prime:


```python
@ImplicitSet
def is_prime(n) -> bool: return (n > 1 and not any(n % i == 0 for i in range(2, n)))
```

```python
P(even, die(12))
```

```
0.5
```

```python
P(even, die(11))
```

```
0.45454545454545453
```

```python
P(prime, die(6))
```

```
0.5
```

```python
P(prime, roll(2, 6))
```

```
0.4166666666666667
```

```python
P(prime, die(12))
```

```
0.4166666666666667
```

```python
P(prime, die(20))
```

```
0.3
```

```python
P(prime, roll(2, 20))
```

```
0.0875
```

```python
P(prime, roll(4, 20))
```

```
0.002275
```

# Conditional Probability

Conditional Probability is used to answer questions of the form "What is the probability of event *X*, given that event *Y* has occurred?" The "given *Y* has occurred" part makes a new sample space, one that is *favorable* to the event *Y*.  So I'll define `given` to be the same function as `favorable`:


```python
given = favorable
```

For example, what's the probability that the second child is a girl, given that the first is a girl (with the Denmark data)? And how does that compare to the case where the first is a boy, or is unspecified?


```python
P(second_girl, given(first_girl, DK))
```

```
0.4898669165584115
```

```python
P(second_girl, given(first_boy, DK))
```

```
0.48471942072973107
```

```python
P(second_girl, DK)
```

```
0.4872245557856497
```

# Fermat and Pascal: The Unfinished Game

<table>
<tr><td><img width="142" src="https://upload.wikimedia.org/wikipedia/commons/f/f3/Pierre_de_Fermat.jpg"><center><a href="https://en.wikipedia.org/wiki/Pierre_de_Fermat">Pierre de Fermat</a> (1607–1665)
<td><img width=162 src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Blaise_Pascal_Versailles.JPG/440px-Blaise_Pascal_Versailles.JPG"><center><a href="https://en.wikipedia.org/wiki/Blaise_Pascal">Blaise Pascal</a> (1623–1662)
</table>

Consider a two-player gambling game consisting of tossing a coin repeatedly. Player H wins as soon as a total of 10 heads come up, but player T wins if a total of 10 tails come up first. If the game is interrupted when H has 8 heads and T has 7 tails, how should the pot of money (which happens to be 100 Francs) be split?  Here are some proposals, and arguments against them:
- It is uncertain, so just split the pot 50-50.
<br>*No, because surely H is more likely to win and thus deserves more.*
- In proportion to each player's current score, so H gets a 8/(8+7) share.
<br>*No, because if the score was 0 heads to 1 tail, H should surely deserve more than 0/1.*
- In proportion to how many tosses the opponent needs to win, so H gets 3/(3+2).
<br>*No, because if H is 10 away from winning and T is only 1 away, then it seems that giving H a 1/11 share is too generous.*

In 1654, Blaise Pascal and Pierre de Fermat corresponded on this problem, with Fermat [writing](http://mathforum.org/isaac/problems/prob1.html):

>Dearest Blaise,
>
>As to the problem of how to divide the 100 Francs, I think I have found a solution that you will find to be fair. Seeing as I needed only two points to win the game, and you needed 3, I think we can establish that after four more tosses of the coin, the game would have been over. For, in those four tosses, if you did not get the necessary 3 points for your victory, this would imply that I had in fact gained the necessary 2 points for my victory. In a similar manner, if I had not achieved the necessary 2 points for my victory, this would imply that you had in fact achieved at least 3 points and had therefore won the game. Thus, I believe the following list of possible endings to the game is exhaustive. I have denoted 'heads' by an 'h', and tails by a 't.' I have starred the outcomes that indicate a win for myself.
>
>       h h h h *       h h h t *       h h t h *       h h t t *
>       h t h h *       h t h t *       h t t h *       h t t t
>       t h h h *       t h h t *       t h t h *       t h t t
>       t t h h *       t t h t         t t t h         t t t t
>          
>
>I think you will agree that all of these outcomes are equally likely. Thus I believe that we should divide the stakes by the ratio 11:5 in my favor, that is, I should receive (11/16)&times;100 = 68.75 Francs, while you should receive 31.25 Francs.
>
>
>I hope all is well in Paris,
>
>Your friend and colleague,
>
>Pierre

Pascal agreed with this solution, and [replied](http://mathforum.org/isaac/problems/prob2.html) with a generalization that made use of his previous invention, Pascal's Triangle. There's even [a book](https://smile.amazon.com/Unfinished-Game-Pascal-Fermat-Seventeenth-Century/dp/0465018963?sa-no-redirect=1) about it.

We can solve the problem with the tools we have:


```python
def at_least(n, item) -> Event:
    "The event of getting at least n instances of item in an outcome."
    return ImplicitSet(lambda outcome: outcome.count(item) >= n)

def all_finishes(tosses: int) -> Set[tuple]:
    "All finishes of a game with `tosses` more tosses."
    return joins(product(*['ht'] * tosses))
```

We can generate the 16 equiprobable 4-toss finishes that Pierre wrote about:


```python
all_finishes(4)
```

```
{'h h h h',
 'h h h t',
 'h h t h',
 'h h t t',
 'h t h h',
 'h t h t',
 'h t t h',
 'h t t t',
 't h h h',
 't h h t',
 't h t h',
 't h t t',
 't t h h',
 't t h t',
 't t t h',
 't t t t'}
```

And we can find the 11 of them that are favorable to player `H`:


```python
favorable(at_least(2, 'h'), all_finishes(4))
```

```
Dist({'h h t h': 1,
      'h h t t': 1,
      'h t t h': 1,
      'h h h t': 1,
      't h h t': 1,
      'h t h h': 1,
      't h t h': 1,
      't h h h': 1,
      't t h h': 1,
      'h h h h': 1,
      'h t h t': 1})
```

Finally, we can answer the question:


```python
100 * P(at_least(2, 'h'), all_finishes(4))
```

```
68.75
```

Blaise deserves 68.75 francs. We agree with Pascal and Fermat; we're in good company!


# Newton's Answer to a Problem by Pepys

<table>
<tr><td><img width=190 src="http://scienceworld.wolfram.com/biography/pics/Newton.jpg"><center><a href="https://en.wikipedia.org/wiki/Isaac_Newton">Isaac Newton</a> 1693</center>
<td><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Samuel_Pepys_portrait.jpg/148px-Samuel_Pepys_portrait.jpg"><center><a href="https://en.wikipedia.org/wiki/Samuel_Pepys">Samuel Pepys</a> 1693</center>
</table>

Let's jump ahead from 1654 all the way to 1693, [when](http://fermatslibrary.com/s/isaac-newton-as-a-probabilist) Samuel Pepys wrote to Isaac Newton posing the problem:

> Which of the following three propositions has the greatest chance of success?
  1. Six fair dice are tossed independently and at least one “6” appears.
  2. Twelve fair dice are tossed independently and at least two “6”s appear.
  3. Eighteen fair dice are tossed independently and at least three “6”s appear.
  
Newton was able to answer the question correctly (although his reasoning was not quite right); let's see how we can do. Since we're only interested in whether a die comes up as "6" or not, we can define a single die like this:


```python
die6 = Dist({'6': 1/6, '.': 5/6})
```

Next we can define the joint distribution formed by combining two independent distribution like this:


```python
def joint2(A: Dist, B: Dist, format_fn='{}{}'.format) -> Dist:
    """The joint distribution of two independent distributions.
    Result is all entries of the form {'ab': frequency(a) * frequency(b)}"""
    return Dist({format_fn(a, b): A[a] * B[b]
                 for a in A for b in B})
```

(Note we pass in a format function to say how to combine the two outcomes. The default is to just concatenate them together, but it could be any function.)

Here's the joint distribution of outcomes (not the sum) from rolling two dice:


```python
joint2(die6, die6)
```

```
Dist({'..': 0.6944444444444445,
      '6.': 0.1388888888888889,
      '.6': 0.1388888888888889,
      '66': 0.027777777777777776})
```

And here is the joint distribution for `n` copies of the same distribution:


```python
def joint(n, dist: Dist, format_fn='{}{}'.format) -> Dist:
    "Joint probability distribution from rolling `n` dice."
    if n == 1:
        return dist
    else:
        return joint2(dist, joint(n - 1, dist, format_fn))
```

```python
joint(4, die6)
```

```
Dist({'....': 0.48225308641975323,
      '6...': 0.09645061728395063,
      '.6..': 0.09645061728395063,
      '..6.': 0.09645061728395063,
      '...6': 0.09645061728395063,
      '66..': 0.019290123456790126,
      '6.6.': 0.019290123456790126,
      '6..6': 0.019290123456790126,
      '.66.': 0.019290123456790122,
      '.6.6': 0.019290123456790122,
      '..66': 0.019290123456790122,
      '666.': 0.0038580246913580245,
      '66.6': 0.0038580246913580245,
      '6.66': 0.0038580246913580245,
      '.666': 0.0038580246913580245,
      '6666': 0.0007716049382716049})
```

Now we are ready to determine which proposition is more likely to have the required number of sixes:


```python
P(at_least(1, '6'), joint(6, die6))
```

```
0.665102023319616
```

```python
P(at_least(2, '6'), joint(12, die6))
```

```
0.6186673737323087
```

```python
P(at_least(3, '6'), joint(18, die6))
```

```
0.5973456859477232
```

We reach the same conclusion Newton did, that the best chance is rolling six dice.


# More Urn Problems: M&Ms and Bayes

Here's another urn problem (actually a "bag" problem) [from](http://allendowney.blogspot.com/2011/10/my-favorite-bayess-theorem-problems.html) prolific Python/Probability pundit [Allen Downey ](http://allendowney.blogspot.com/):

> The blue M&M was introduced in 1995.  Before then, the color mix in a bag of plain M&Ms was (30% Brown, 20% Yellow, 20% Red, 10% Green, 10% Orange, 10% Tan).  Afterward it was (24% Blue , 20% Green, 16% Orange, 14% Yellow, 13% Red, 13% Brown).
A friend of mine has two bags of M&Ms, and he tells me that one is from 1994 and one from 1996.  He won't tell me which is which, but he randomly selects one M&M from each bag.  One is yellow and one is green.  What is the probability that the yellow M&M came from the 1994 bag?

To solve this problem, we'll first create distributions for each bag: `bag94` and `bag96`:


```python
bag94 = Dist(brown=30, yellow=20, red=20, green=10, orange=10, tan=10)
bag96 = Dist(blue=24, green=20, orange=16, yellow=14, red=13, brown=13)
```

Next, define `MM` as the joint distribution–the sample space for picking one M&M from each bag. The outcome `'94:yellow 96:green'` means that a yellow M&M was selected from the 1994 bag and a green one from the 1996 bag. In this problem we don't get to see the actual outcome; we just see some evidence about the outcome, that it contains a yellow and a green.


```python
MM = joint2(bag94, bag96, '94:{} 96:{}'.format)
MM
```

```
Dist({'94:brown 96:blue': 720,
      '94:brown 96:green': 600,
      '94:brown 96:orange': 480,
      '94:yellow 96:blue': 480,
      '94:red 96:blue': 480,
      '94:brown 96:yellow': 420,
      '94:yellow 96:green': 400,
      '94:red 96:green': 400,
      '94:brown 96:red': 390,
      '94:brown 96:brown': 390,
      '94:yellow 96:orange': 320,
      '94:red 96:orange': 320,
      '94:yellow 96:yellow': 280,
      '94:red 96:yellow': 280,
      '94:yellow 96:red': 260,
      '94:yellow 96:brown': 260,
      '94:red 96:red': 260,
      '94:red 96:brown': 260,
      '94:green 96:blue': 240,
      '94:orange 96:blue': 240,
      '94:tan 96:blue': 240,
      '94:green 96:green': 200,
      '94:orange 96:green': 200,
      '94:tan 96:green': 200,
      '94:green 96:orange': 160,
      '94:orange 96:orange': 160,
      '94:tan 96:orange': 160,
      '94:green 96:yellow': 140,
      '94:orange 96:yellow': 140,
      '94:tan 96:yellow': 140,
      '94:green 96:red': 130,
      '94:green 96:brown': 130,
      '94:orange 96:red': 130,
      '94:orange 96:brown': 130,
      '94:tan 96:red': 130,
      '94:tan 96:brown': 130})
```

We are given the observation that "One is yellow and one is green":


```python
@ImplicitSet
def yellow_and_green(outcome: str) -> bool: return 'yellow' in outcome and 'green' in outcome

given(yellow_and_green, MM)
```

```
Dist({'94:yellow 96:green': 400, '94:green 96:yellow': 140})
```

We want to know "What is the probability that the yellow M&M came from the 1994 bag, given the observation?"


```python
@ImplicitSet
def yellow94(outcome: str) -> bool: return '94:yellow' in outcome

P(yellow94, given(yellow_and_green, MM))
```

```
0.7407407407407407
```

So there is a 74% chance that the yellow M&M comes from the 1994 bag.

Answering this question was straightforward: just like all the other probability problems, we simply create a sample space, and use `P` to pick out the probability of the event in question, given what we know about the outcome.

But in a sense it is curious that we were able to solve this problem with the same methodology as the others: this problem comes from a section of Downey's book titled **My favorite Bayes's Theorem Problems**, so one would expect that we'd need to invoke Bayes Theorem to solve it.  The computation above shows that that is not necessary.

| |
|---|
|![Bayes](https://upload.wikimedia.org/wikipedia/commons/d/d4/Thomas_Bayes.gif)|
|<a href="https://en.wikipedia.org/wiki/Thomas_Bayes">Rev. Thomas Bayes</a> (1701-1761)|

Of course, we *could* solve it using Bayes Theorem. Why is Bayes Theorem recommended? Because we are asked about the probability of an outcome given the evidence&mdash;the probability the yellow came from the 94 bag, given that there is a yellow and a green. But the problem statement doesn't directly tell us the probability of that outcome given the evidence; it just tells us the probability of the evidence given the outcome.

Before we see the colors of the M&Ms, there are two hypotheses, `A` and `B`, both with equal probability:

    A: first M&M from 94 bag, second from 96 bag
    B: first M&M from 96 bag, second from 94 bag
    P(A) = P(B) = 0.5
    
Then we get some evidence:
    
    E: first M&M yellow, second green
    
We want to know the probability of hypothesis `A`, given the evidence:
    
    P(A | E)
    
That's not easy to calculate (except by enumerating the sample space, which our `P` function does). But Bayes Theorem says:
    
    P(A | E) = P(E | A) * P(A) / P(E)
    
The quantities on the right-hand-side are easier to calculate:
    
    P(E | A) = 0.20 * 0.20 = 0.04
    P(E | B) = 0.10 * 0.14 = 0.014
    P(A)     = 0.5
    P(B)     = 0.5
    P(E)     = P(E | A) * P(A) + P(E | B) * P(B)
             = 0.04     * 0.5  + 0.014    * 0.5   =   0.027
    
And we can get a final answer:
    
    P(A | E) = P(E | A) * P(A) / P(E)
             = 0.04     * 0.5  / 0.027
             = 0.7407407407
             
You have a choice: Bayes Theorem allows you to do less calculation at the cost of more algebra; that is a great trade-off if you are working with pencil and paper. 

Enumerating the sample space allows you to do less algebra at the cost of more calculation; usually a good trade-off if you have a computer. But regardless of the approach you use, it is important to understand Bayes theorem and how it works.

There is one important question that Allen Downey does not address: *would you  eat thirty-year-old M&Ms*?
&#128552;


# Conclusion

We can solve all these problems just by counting! 

All you ever needed to know about probability problems you learned from Sesame Street:

| |
|---|
|![The Count](http://img2.oncoloring.com/count-dracula-number-thir_518b77b54ba6c-p.gif)|
|<a href="https://en.wikipedia.org/wiki/Count_von_Count">The Count</a> (1972—)|

We've had an interesting tour of probability and met some giants: Laplace, Bernoulli, Fermat, Pascal, Bayes, Newton, and  The Count.

The conclusion is: be methodical in defining the sample space and the event(s) of interest, and be careful in counting the number of outcomes in the numerator and denominator. and you can't go wrong. Easy as 1-2-3.

