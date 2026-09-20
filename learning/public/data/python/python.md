# Introduction to Python Programming

## Course Overview
Welcome to Introduction to Python! This course is designed for beginners with little to no programming experience. By the end of this course, you'll have a solid foundation in Python programming and be able to write your own programs.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Python Basics](#python-basics)
3. [Data Types and Variables](#data-types-and-variables)
4. [Control Flow](#control-flow)
5. [Functions](#functions)
6. [Data Structures](#data-structures)
7. [File Handling](#file-handling)
8. [Error Handling](#error-handling)
9. [Modules and Packages](#modules-and-packages)
10. [Final Project](#final-project)

---

## Getting Started

### What is Python?
Python is a high-level, interpreted programming language known for its simplicity and readability. It's widely used in:
- Web development
- Data analysis and visualization
- Machine learning and AI
- Automation and scripting
- Scientific computing

### Installing Python
1. Visit [python.org](https://python.org)
2. Download Python 3.x (latest version)
3. Run the installer (check "Add Python to PATH")
4. Verify installation: `python --version`

### Your First Program
```python
print("Hello, World!")
```

---

## Python Basics

### Comments
```python
# This is a single-line comment

"""
This is a
multi-line comment
"""
```

### Basic Syntax Rules
- Python is case-sensitive
- Indentation matters (use 4 spaces)
- No semicolons needed at end of lines
- Use meaningful variable names

---

## Data Types and Variables

### Variables
```python
# No need to declare type
name = "Alice"
age = 25
height = 5.6
is_student = True
```

### Common Data Types
```python
# Integer
x = 10

# Float
pi = 3.14159

# String
message = "Hello, Python!"

# Boolean
is_valid = True

# None (null value)
empty_value = None
```

### Type Conversion
```python
# Convert between types
age = "25"
age_int = int(age)        # String to integer
price = 19.99
price_str = str(price)    # Float to string
```

### String Operations
```python
# Concatenation
greeting = "Hello" + " " + "World"

# String formatting
name = "Bob"
age = 30
print(f"My name is {name} and I'm {age} years old")

# Common string methods
text = "python programming"
print(text.upper())        # PYTHON PROGRAMMING
print(text.capitalize())   # Python programming
print(text.split())        # ['python', 'programming']
```

---

## Control Flow

### If Statements
```python
age = 18

if age >= 18:
    print("You are an adult")
elif age >= 13:
    print("You are a teenager")
else:
    print("You are a child")
```

### Comparison Operators
```python
==    # Equal to
!=    # Not equal to
>     # Greater than
<     # Less than
>=    # Greater than or equal to
<=    # Less than or equal to
```

### Logical Operators
```python
and   # Both conditions must be True
or    # At least one condition must be True
not   # Negates the condition

# Example
age = 25
has_license = True

if age >= 18 and has_license:
    print("You can drive")
```

### Loops

#### For Loop
```python
# Iterate over a range
for i in range(5):
    print(i)  # 0, 1, 2, 3, 4

# Iterate over a list
fruits = ["apple", "banana", "cherry"]
for fruit in fruits:
    print(fruit)
```

#### While Loop
```python
count = 0
while count < 5:
    print(count)
    count += 1
```

#### Loop Control
```python
# break - exit the loop
for i in range(10):
    if i == 5:
        break
    print(i)

# continue - skip to next iteration
for i in range(5):
    if i == 2:
        continue
    print(i)
```

---

## Functions

### Defining Functions
```python
def greet():
    print("Hello!")

greet()  # Call the function
```

### Functions with Parameters
```python
def greet_person(name):
    print(f"Hello, {name}!")

greet_person("Alice")
```

### Return Values
```python
def add(a, b):
    return a + b

result = add(5, 3)
print(result)  # 8
```

### Default Parameters
```python
def greet(name, greeting="Hello"):
    print(f"{greeting}, {name}!")

greet("Bob")              # Hello, Bob!
greet("Alice", "Hi")      # Hi, Alice!
```

### Multiple Return Values
```python
def calculate(a, b):
    sum_result = a + b
    product = a * b
    return sum_result, product

s, p = calculate(4, 5)
print(f"Sum: {s}, Product: {p}")
```

---

## Data Structures

### Lists
```python
# Creating lists
numbers = [1, 2, 3, 4, 5]
mixed = [1, "hello", 3.14, True]

# Accessing elements
print(numbers[0])      # 1 (first element)
print(numbers[-1])     # 5 (last element)

# Slicing
print(numbers[1:3])    # [2, 3]

# Common list methods
numbers.append(6)      # Add to end
numbers.insert(0, 0)   # Insert at position
numbers.remove(3)      # Remove specific value
numbers.pop()          # Remove last element
len(numbers)           # Length of list
```

### Tuples
```python
# Immutable (cannot be changed)
coordinates = (10, 20)
rgb = (255, 128, 0)

# Accessing elements
x, y = coordinates     # Unpacking
```

### Dictionaries
```python
# Key-value pairs
person = {
    "name": "Alice",
    "age": 25,
    "city": "New York"
}

# Accessing values
print(person["name"])          # Alice
print(person.get("age"))       # 25

# Adding/updating
person["email"] = "alice@email.com"
person["age"] = 26

# Dictionary methods
person.keys()          # Get all keys
person.values()        # Get all values
person.items()         # Get key-value pairs
```

### Sets
```python
# Unique, unordered collection
fruits = {"apple", "banana", "cherry"}

# Adding elements
fruits.add("orange")

# Set operations
set1 = {1, 2, 3}
set2 = {3, 4, 5}
print(set1.union(set2))        # {1, 2, 3, 4, 5}
print(set1.intersection(set2)) # {3}
```

---

## File Handling

### Reading Files
```python
# Read entire file
with open("file.txt", "r") as file:
    content = file.read()
    print(content)

# Read line by line
with open("file.txt", "r") as file:
    for line in file:
        print(line.strip())
```

### Writing Files
```python
# Write to file (overwrites)
with open("output.txt", "w") as file:
    file.write("Hello, World!\n")
    file.write("Python is awesome!")

# Append to file
with open("output.txt", "a") as file:
    file.write("\nNew line added")
```

---

## Error Handling

### Try-Except Blocks
```python
try:
    number = int(input("Enter a number: "))
    result = 10 / number
    print(result)
except ValueError:
    print("That's not a valid number!")
except ZeroDivisionError:
    print("Cannot divide by zero!")
except Exception as e:
    print(f"An error occurred: {e}")
finally:
    print("This always runs")
```

---

## Modules and Packages

### Importing Modules
```python
# Import entire module
import math
print(math.sqrt(16))

# Import specific functions
from math import sqrt, pi
print(sqrt(16))

# Import with alias
import random as rnd
print(rnd.randint(1, 10))
```

### Commonly Used Modules
```python
# math - mathematical functions
import math
math.sqrt(25)
math.ceil(4.3)

# random - random number generation
import random
random.randint(1, 100)
random.choice(['a', 'b', 'c'])

# datetime - date and time
from datetime import datetime
now = datetime.now()
print(now.strftime("%Y-%m-%d %H:%M:%S"))
```

---

## Final Project

### Project: Simple To-Do List Application

Create a command-line to-do list application with the following features:
1. Add tasks
2. View all tasks
3. Mark tasks as complete
4. Delete tasks
5. Save tasks to a file

**Starter Code:**
```python
def display_menu():
    print("\n=== To-Do List ===")
    print("1. Add task")
    print("2. View tasks")
    print("3. Complete task")
    print("4. Delete task")
    print("5. Exit")

def main():
    tasks = []
    
    while True:
        display_menu()
        choice = input("\nEnter your choice: ")
        
        if choice == "1":
            # Add your code here
            pass
        elif choice == "2":
            # Add your code here
            pass
        elif choice == "5":
            print("Goodbye!")
            break
        else:
            print("Invalid choice!")

if __name__ == "__main__":
    main()
```

---

## Additional Resources

### Practice Websites
- [HackerRank](https://www.hackerrank.com/domains/python)
- [LeetCode](https://leetcode.com/)
- [Codecademy](https://www.codecademy.com/learn/learn-python-3)
- [Python.org Tutorial](https://docs.python.org/3/tutorial/)

### Books
- "Python Crash Course" by Eric Matthes
- "Automate the Boring Stuff with Python" by Al Sweigart
- "Learn Python the Hard Way" by Zed Shaw

### Next Steps
- Object-Oriented Programming (OOP)
- Web development with Flask/Django
- Data analysis with Pandas
- Machine learning with scikit-learn

---

## Tips for Success

1. **Practice Daily** - Consistency is key to learning programming
2. **Write Code** - Don't just read, actually type and run code
3. **Break Problems Down** - Solve complex problems step by step
4. **Read Error Messages** - They tell you what went wrong
5. **Use Print Statements** - Debug by seeing what your variables contain
6. **Ask Questions** - Don't hesitate to seek help when stuck
7. **Build Projects** - Apply what you learn to real projects

---

## Course Completion Checklist

- [ ] Understand basic Python syntax
- [ ] Work with variables and data types
- [ ] Use conditional statements and loops
- [ ] Write and use functions
- [ ] Manipulate lists, dictionaries, and other data structures
- [ ] Read from and write to files
- [ ] Handle errors gracefully
- [ ] Import and use modules
- [ ] Complete final project

---

**Congratulations on starting your Python journey! Happy coding! 🐍**
