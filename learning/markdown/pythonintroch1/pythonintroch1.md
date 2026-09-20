

# 1. Very simple 'programs'
## 1.1 Running Python from the command line
In order to test pieces of code we can run Python from the command line. In this Jupyter Notebook we are going to simulate this. You can type the commands in the fields and execute them.
In the field type:
```python
print('Hello, World')
```
Then press ` + ` to execute the command.

```python

```

What happened?

You just created a program, that prints the words 'Hello, World'. The Python environment that you are in immediately compiles whatever you have typed in. This is useful for testing things, e.g. define a few variables, and then test to see if a certain line will work. That will come in a later lesson, though.

## 1.2 Math in Python
Type
```python
1 + 1
```
and execute the code.

```python
 + 1
```

Now type
```python
20 + 80
```
and execute the code.

```python

```

These are additions. We can of course use other mathematical operators.
Try this subtraction:
```python
6 - 5
```

```python

```

and this multiplication:
```python
2 * 5
```

```python

```

Try:
```python
5 ** 2
```

```python

```

`**` is the exponential operator, so we executed 5 squared.

Type:
```python
print('1 + 2 is an addition')
```

```python

```

You see that the `print` statement writes something on the screen.

Try this:
```python
print('one kilobyte is 2^10 bytes, or', 2 ** 10, 'bytes')
```

```python

```

This demonstrates that you can print text and calculations in a sentence. The commas separating each section are a way of separating strings (text) from calculations or variable.

Now try this:
```python
23 / 3
```

```python

```

And this:
```python
23 % 3
```

```python

```

`%` returns the remainder of the division.

## 1.3 Order of Operations

Remember that thing called order of operation that they taught in maths? Well, it applies in Python, too. Here it is, if you need reminding:
1. Parenthesis `()`
2. Exponents `**`
3. Multiplication `*`, division `/` and remainder `%`
4. Addition `+` and subtraction `-`

Here are some examples that you might want to try, if you're rusty on this:
```python
1 + 2 * 3
(1 + 2) * 3
```

```python

```

```python

```

## 1.4 Comments, Please
The final thing you'll need to know to move on to multi-line programs is the comment. Type the following (and yes, the output is shown):
```python
# I am a comment. Fear my wrath!
```

```python

```

A comment is a piece of code that is not run. In Python, you make something a comment by putting a hash in front of it. A hash comments everything after it in the line, and nothing before it. So you could type this:
```python
print("food is very nice") #eat me
```

```python

```

This results in a normal output, without the smutty comment, thank you very much.

Now try this:
```python
# print("food is very nice")
```

```python

```

Nothing happens, because the code was after a comment.

Comments are important for adding necessary information for another programmer to read, but not the computer. For example, an explanation of a section of code, saying what it does, or what is wrong with it. You can also comment bits of code by putting a `#` in front of it - if you don't want it to compile, but can't delete it because you might need it later.

# Assignment 1

Type in the cell below an expression to find out how many seconds are there in a 365-day year.

```python

```

# Assignment 2

The Earth can be approximated as a sphere with a radius of 6370 km. Use the cell below to find out the volume of such a shape in cubic meters.

```python

```

# Assignment 3

Get the answer of the following expression, using the cell below:

$$\frac{1}{2}+\frac{\frac{1}{3}}{\frac{1}{4}+\frac{1}{5}}$$

```python

```

