---
title: "We have pipe at home"
date: 2025-10-11
---

I haven't written any code in gleam but I've liked what I've seen about the language. It has a very functional programming orientation and a syntax that feels similar to Rust code. It compiles to the Erlang Virtual Machine, and it also compiles to javascript, meaning it can be used in a variety of useful environments.

One of gleam's killer features that I see mentioned is is the pipeline operator `|>`. This operator takes the left hand side and passes it as an argument to the right hand side.

Here is an [example from Beam's website](https://tour.gleam.run/everything/#functions-pipelines):

```python
// With the pipe operator
"Hello, Mike!"
  |> string.drop_end(1)
  |> string.drop_start(7)
  |> io.println
```

A way that this would be written without the pipeline operator and without class methods would look like:
```python
io.println(string.drop_start(string.drop_end("Hello, Mike!", 1), 7));
```

You can see that this line is much harder to read. The functions have to be read from right-to-left, and the arguments have to be read by "ping-ponging" your eyes from the left side of the line back to the right.

Why is pipelining nice? Can we have pipelining in other languages? Continue reading to find out!
# In-fix vs Pre-fix notation
I believe these terms originally came from mathematics, and I only first heard about them when I started looking closer at functional programming. The terms are simple to understand.

- Infix - The operator is placed between or "in the middle" of two operands
	- Example: `2 + 2`
- Prefix - The operator is placed before the operands
	- Example: `cos(0)`

Infix operators are normally "binary operators" meaning they accept two arguments. This makes sense, as there's not a sensible place to put a third or fourth argument.
Generally when you chain infix operators you read the operations left-to-right, although math operators comes with their own precedence rules (PEMDAS) to make things more complicated.

Prefix operators can accept any amount of arguments which make them more flexible. LISP languages consider prefix operators superior and generally don't have support for infix operators without using lambdas.

One major problem with prefix operators is they are read "in-to-out", which involves the "ping ponging" that we saw in the above example. Here's a math example using prefix notation:
```
(- (+ 5 (- 4 3) 2) 1)
```

Here's the same example using infix notation:
```
5 + 4 - 3 + 2 - 1
```

For my eyes the infix notation is much easier to read, as it's read left-to-right without backtracking.
# Method calls as infix notation
It's interesting to think that a method call is a form of infix notation. The call
```python
class.function(arg1, arg2)
```

Can be thought of as the infix version of:
```python
function(class, arg1, arg2)
```

The "builder pattern" is one example where the functions return the modified class, which allows the developer to chain methods together. This is one form of pipelining that folks might be familiar with:
```python
my_object.set_a(1).set_b(2).set_c(3).build()
```

Compare this with the prefix notation version:
```python
build(set_c(set_b(set_a(my_object, 1), 2), 3))
```

I don't think anyone would be writing the prefix notation, the ping-ponging really hurts the readability.

Using functions for infix notation gets us "close" to Gleam's syntax but it's less expressive. It requires:
1) All functions return the class that you want to operate on
2) All functions that you want to call are method functions
Certainly (2) is difficult. Someone is not adding method functions directly to `List` in python, and so the amount that you're able to pipeline is limited.

However, higher order functions come to our rescue!
# We have pipe at home: python
All we need to do to "replicate" the pipe functionality is to write something that takes in data and a list of functions, and applies the data to the functions one after the other. We can write this simply in python with:
```python
def pipe(data, *fns):
	for f in fns:
	  data = f(data)
	return data
	
# Example
def add2(num):
  return num + 2

# Should print '5'
pipe(1, add2, add2, print)
```

The main limitation to pipe is that each function can only accept a single argument, which is that data that is being passed to it. In order to make functions with a single argument, we will either need to create `llambda` functions or use `partial`

```python
from functools import partial

# Should print '5'
pipe(1, partial(add(2)), lambda a: a + 2, print)
```

We can write the original gleam example in this way (although we need some help because python doesn't have a slice function):
```python
def slice(start=0, end=s.len, count_by=1, s):
  return s[start:end:count_by]
  
pipe("Hello, Mike!", partial(slice(0, -1)), partial(slice(7)), print)
```

Although since python makes slicing strings very easy I think everyone would agree that the above example is much worse than:
```python
print("Hello, Mike!"[7:-1])
```
# A more complicated example: Day 1 Advent of Code
The [2024 Advent of Code day 1](https://adventofcode.com/2024/day/1) challenge involves takes as input lines with 2 numbers:
```
3   4
4   3
2   5
1   3
3   9
3   3
```

The task is to collect the left and right columns, sort each column, and then add up the 'distances' between each value in each column.

We need one more function in order to write our solution and that is `ipipe` which is like pipe except it operates on iterators:
```python
def ipipe(iter, *fns):
  for f in fns:
    iter = map(f, iter)
  return iter
```

Now, to solve the problem we first open and parse the input
```python
# This 
# - takes the string
# - opens it as a file
# - reads the file as a string
# - splits the string by whitespace (returns a list)
# - calls `int()` on each string in the array
# - calls `list()` on the iterator (returns a list)
ints = pipe("day1", open, call("read"), call("split"), ipipe(int), list)
```

We then collect our left and right columns and sort them:
```python
left = sorted(ints[0::2])
right = sorted(ints[1::2])
```

Then we calculate the distance between the columns and print it:
```python
def distance(v): return abs(v[0] - v[1])

pipe(zip(left, right), imap(distance), sum, print)
```

