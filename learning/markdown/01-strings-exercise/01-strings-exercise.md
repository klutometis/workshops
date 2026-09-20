# 1. Fill missing pieces
Fill `____` pieces below to have correct values for `lower_cased`, `stripped` and `stripped_lower_case` variables.

```python
original = " Python strings are COOL! "
lower_cased = original._____
stripped = ____.strip()
stripped_lower_cased = original._____._____
```

Let's verify that the implementation is correct by running the cell below. `assert` will raise `AssertionError` if the statement is not true.  

```python
assert lower_cased == " python strings are cool! "
assert stripped == "Python strings are COOL!"
assert stripped_lower_cased == "python strings are cool!"
```

# 2. Prettify ugly string
Use `str` methods to convert `ugly` to wanted `pretty`.

```python
ugly = " tiTle of MY new Book\n\n"
```

```python
# Your implementation:
pretty = "TODO"
```

Let's make sure that it does what we want. `assert` raises [`AssertionError`](https://docs.python.org/3/library/exceptions.html#AssertionError) if the statement is not `True`.

```python
print(f"pretty: {pretty}")
assert pretty == "Title Of My New Book"
```

# 3. Format string based on existing variables
Create `sentence` by using `verb`, `language`, and `punctuation` and any other strings you may need.

```python
verb = "is"
language = "Python"
punctuation = "!"
```

```python
# Your implementation:
sentence = "TODO"
```

```python
print(f"sentence: {sentence}")
assert sentence == "Learning Python is fun!"
```
