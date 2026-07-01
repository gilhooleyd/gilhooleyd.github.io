---
title: "Making our own dynamic types"
date: 2025-10-12
---

Types are very helpful in expressing your intent and enforcing constraints. They
require you to think more closely about the problem. Changing your types are a
sign that callers and callees need to be updated and this can be enforced by the
compiler instead of at runtime.

Types are a useful tool for thinking about a problem. Often we can think in
terms of the data that we need and that we should output, and the shape of the
function we need becomes clear.

However, dynamic typing has a lot of benefits as well. One often touted benefit
is that you don't need to think as much before you start writing code. Another
is that the code you write is "more generic", it tends to be able to operate on
lots of similarly "shaped" objects. Adding typing often requires a lot of
boilerplate in order to get the types to align, especially in C++ and Rust where
typing is strict.

I've been thinking recently about the bridge between strongly typed and
dynamically typed languages. Writing in Python is a joy and writing in Rust can
be a slog even though Rust is a much better designed language. Is it possible to
reclaim some of the dynamic typing fun in Rust?

Let's start with the value type:

```rust
enum Type {
  Void,
  Int(i64),
  Float(f64),
  String(String),
  Vector(Vec<Type>),
  Dict(HashMap<Type, Type>),
}
```

Look at that! It already feels like we're most of the way to dynamic typing.

What about first class support for functions? Here's where we need to make some
design decisions. All dynamically typed functions will have to take in and
return the same type, so the most generic thing we can do is:

```rust
struct TypeFn {
  function: Rc<dyn Fn(Type) -> Type>,
}

enum Type {
  Fn(TypeFn)
}
```

This means that all of our functions take in and return a single `Type` object.
If we want a function that accepts or returns multiple values the object can be
`Type::Vector`.

Here is where we start to see a specific degrade in ergonomics because functions
no longer name their input or output parameters. Every dynamically typed
language has the ability to name input parameters since it helps so much for
usability.

```rust
// Good, can see what is happening.
fn my_foo(a: int, b: int) -> int;

// Bad, needs comments to see what is happening:
// Accepts: [Int, Int]
// Returns: Int
fn my_untyped_foo(input: Type) -> Type;
```

We could reclaim this information if we wanted by having folks write typed
functions and have a macro that derived the outer function that took in `Type`
and unwrapped it into the shape we need.

## Going to and from the typed world

If you have typed data there's a clear 1:1 translated to and from our dynamic
types. Something like:

```rust
struct Person {
  name: String,
  age: int64,
}

impl Person {
	fn to_type(&self) -> Type {
		let mut map = HashMap::new();
		map.insert("name".to_string(), self.name.copy());
		map.insert("age".to_string(), self.age);
		Type::Dict(map)
	}
	
	fn from_type(t: &Type) -> Self {
		let Type::HashMap(map) = t else { panic!(); };
		Person {
			name: map.get("name").unwrap().clone(),
			age: map.get("age").unwrap().clone(),
		}
	}
}
```

Now you could write a `derive` macro to make these automatic. The author of the
derive macro would just need to make sure that all of the standard library types
implement the trait to go to/from Type.

## Rust crimes: Panicking and unwrap

Even in the little bit of code that we've written so far we can see that I'm
committing some crimes against the spirit of how Rust is normally written. The
most egregious crime is the liberal use of `unwrap` and `panic`.

Using these two things has the benefit of simplifying all of the functions that
we write and providing clear errors when something goes wrong. They have the
major downside of only blowing up at runtime though, so you might not know about
problems ahead of time. This problem feels fairly intrinsic to dynamic typing
though: if you want dynamic types you are trading compile time strictness for
possibly bad runtime behavior.

## Drawing the rest of the owl

If you actually wanted to use this dynamic types in practice there's a couple
things I've forgotten to mention.

Syntax sugar for getting types "into" the dynamic world are really helpful. The
easiest thing that I've found is:

```rust
// Usage: let val = t(1);
// Usage: let v = t(vec![1, 2, 3]);
fn t<T>(v: T) -> Type where Type: From<T>{
    Type::from(v)
}
```

You will also need to implement `std::ops` traits on your type so you can add
values together. This area has some fun trade offs as well because when writing
these functions you can decide on what behavior you want. This is the place
where you can reimplement Python's `String * Int` behavior.

## Wrapping Up

I hope this was a fun exploration of types. It is fun to think that we easily
reclaim "dynamic typing" within a statically typed language. It seems much
harder to add static typing into a dynamically typed language.

I would love to see if this idea ever gained traction within Rust. I suspect
that it hasn't been explored so far because there are lots of rough edges
without buy-in from the compiler. Those rough edges are the need to convert
primitives into `Type` when writing code, and the fact that using the `TypeFn`
type means we can't name input parameters.
