<div align="right" style="text-align: right"><i>Peter Norvig<br>April 2015</i></div>

# When is Cheryl's Birthday?


**[This logic puzzle](https://en.wikipedia.org/wiki/Cheryl%27s_Birthday)** has been making the rounds:

1. Albert and Bernard became friends with Cheryl, and want to know when her birthday is. Cheryl gives them a list of 10 possible dates:
   - May 15,     May 16,     May 19
   - June 17,    June 18
   - July 14,    July 16
   - August 14,  August 15,  August 17
3. **Cheryl** then privately tells Albert the month and Bernard the day of her birthday.
4. **Albert**: "I don't know when Cheryl's birthday is, and I know that Bernard does not know."
5. **Bernard**: "At first I didn't know when Cheryl's birthday is, but I know now."
6. **Albert**: "Then I also know when Cheryl's birthday is."
7. So when is Cheryl's birthday?

This puzzle is designed for a paper-and-pencil solution, but I'm going to solve it with code; code is more flexible and can be used to solve other similar puzzles. Let's work through the puzzle line by line.

## 1. Cheryl gives Albert and Bernard a list of 10 possible dates:

The result of this is that Albert and Bernard each know the birthday is one of ten dates, but they don't know which date. We'll call a set of possible dates a **belief state**. As additional statements are made, each character's belief state will change. When someone has a belief state with just one possibility, we say they **know** the true value.



```python
BeliefState = set # A set of possible values

DATES = BeliefState({'May 15', 'May 16', 'May 19', 'June 17', 'June 18', 
                     'July 14', 'July 16', 'August 14', 'August 15', 'August 17'})

def know(beliefs: BeliefState) -> bool:
    """A person `knows` the correct value if their belief state has only one possibility."""
    return len(beliefs) == 1
```

We'll define accessor functions for the month and day of a date:


```python
def month(date: str) -> str: return date.split()[0]
def day(date: str)   -> str: return date.split()[1]

assert month('May 15') == 'May'
assert   day('May 15') == '15'
```

## 2. Cheryl then privately tells Albert the month and Bernard the day of her birthday.

We can define the idea of Cheryl having **told** someone a component of her birthdate, thus updating their belief state:


```python
def told(part: str) -> BeliefState:
    """Cheryl told a part of her birthdate to someone; return a belief state of possible dates."""
    return {date for date in DATES if part in date}
```

(*Note*: I dislike it that the function `told` uses the global constant `DATES`. But I can live with it.)

Let's consider `'May 15'` as a possible birthdate. Cheryl tells Albert `'May'` and Bernard `'15'`, so they would have  these belief states, and they would not *know* the birthday:


```python
assert told('May') == {'May 15', 'May 16', 'May 19'} # Albert's belief state
assert told('15')  == {'August 15', 'May 15'}        # Bernard's belief state
assert not know(told('May'))                         # Albert does not know
assert not know(told('15'))                          # Bernard does not know
```

Now consider  `'June 18'`; in this case, Bernard would *know*.


```python
assert told('June') == {'June 17', 'June 18'}  # Albert's belief state
assert told('18') == {'June 18'}               # Bernard's belief state
assert not know(told('June'))                  # Albert does not know
assert know(told('18'))                        # Bernard DOES know
```

# Overall Strategy

The puzzle is tricky because we're dealing with two types of uncertainty:

1. Albert and Bernard are initially uncertain about the birthdate. *(Cheryl knows something they don't know.)*
2. We (the puzzle solvers) don't know what Albert and Bernard were told by Cheryl. *(They know something we don't know.)*

If Cheryl tells Albert that the month is "May",  his belief state becomes {May 15, May 16, May 19}.  But we the puzzle solvers don't know what month he was told. To deal with this we will consider each of the ten dates one at a time and reason as follows: 
- For each date, we know what Albert and Bernard were told; we have eliminated the second type of uncertainty. 
- We can thus figure out if Albert and Bernard's statements are true (given this date). 
- There should be only one date out of the ten that makes all the statements true; that's Cheryl's birthday.

Here is the main function, `cheryls_birthday`, which computes the subset of possible dates that satisfy Albert and Bernard's statements.  We will implement a **statement** as a boolean function that takes a single date as input and returns true if the statement would be true under the condition that the given date is Cheryl's actual birthday. 


```python
def cheryls_birthday() -> BeliefState:
    """Return a subset of the global `DATES` for which all three statements are true."""
    return satisfy(DATES, albert1, bernard1, albert2)

## TODO: Implement statements albert1, bernard1, albert2
```

The function `satisfy` takes a belief state and some statements and returns the subset that satisfies all the statements:


```python
def satisfy(beliefs: BeliefState, *statements) -> BeliefState:
    """Return the subset of values in `beliefs` that satisfy all the statements."""
    return {value for value in beliefs if all(statement(value) for statement in statements)}
```

## 3. Albert: I don't know when Cheryl's birthday is, and I know that Bernard does not know.


Let's first rephrase this statement to use the concepts we have defined:

**Albert**: *After Cheryl **told** me the **month** of her birthdate, my **belief state** is a set of dates such that I didn't **know** her birthday.  And I know that Bernard does not know. How do I know that? I can see that there are no possible dates that Bernard would **know** Cheryl's birthday if he was **told** the **day** of that date.*

That I can translate directly into code:


```python
def albert1(date: str) -> bool:
    """Albert: I don't know when Cheryl's birthday is, and I know that Bernard does not know."""
    dates = told(month(date))
    return not know(dates) and not satisfy(dates, lambda date: know(told(day(date))))
```

We haven't solved the puzzle yet, but let's take a peek and see which dates satisfy Albert's first statement:


```python
satisfy(DATES, albert1)
```

```
{'August 14', 'August 15', 'August 17', 'July 14', 'July 16'}
```

## 4. Bernard: At first I didn't know when Cheryl's birthday is, but I know now.

Again, a paraphrase:

**Bernard:** *At first Cheryl **told** me the **day**, and I didn't **know**.  After I heard Albert's **statement**, I updated my **belief state**, and now I **know**.*


```python
def bernard1(date: str) -> bool:
    "Bernard: At first I don't know when Cheryl's birthday is, but I know now."
    at_first = told(day(date))
    now      = satisfy(at_first, albert1)
    return not know(at_first) and know(now)
```

Let's see which dates satisfy the two statements:


```python
satisfy(DATES, albert1, bernard1)
```

```
{'August 15', 'August 17', 'July 16'}
```

Wait a minute–I thought that Bernard **knew**?! Why are there **three** possible dates? 

According to the puzzle, Bernard does indeed know; it is just that we, the puzzle solvers, don't know yet.  That's because Bernard was told something we don't know: the day. If Bernard was told `'15'` then he would know `'August 15'`; if he was told `'17'` he would know `'August 17'`, and if he was told `'16'` he would know `'July 16'`. We'll need more information (coming in statement `albert2`) before *we* know.




## 5. Albert: Then I also know when Cheryl's birthday is.

A paraphrase:

**Albert**: *After being **told** the **month** and hearing Bernard's **statement**, I now **know** Cheryl's birthday.*


```python
def albert2(date: str) -> bool:
    "Albert: Then I also know when Cheryl's birthday is." 
    now = satisfy(told(month(date)), bernard1)
    return know(now)
```

## 6. So when is Cheryl's birthday?




```python
cheryls_birthday()
```

```
{'July 16'}
```

**Success!** We have deduced that Cheryl's birthday is **July 16**. We know Cheryl's birthday:


```python
assert know(cheryls_birthday())
```
