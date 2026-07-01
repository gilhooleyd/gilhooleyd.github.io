This is the main github.io site.

The site is built with a custom SSG written in javascript. The javascript
uses only Node APIs but we expect to run this in deno.

The theme was added directly to the repo so I can make some stylistic changes.

The markdown gets output to HTML in the `docs` folder which we check in directly.
This is the laziest way I found to have a github site that doesn't require any actions.

# Site goals

- We should have no external dependencies that could break. If we are using a library it should
  be vendored in `static/`.
- The SSG should be as simple and maintanable as possible.
- AI will never be used to write blog posts.

# Helpful commands

Build the site and watch for changes:
```
deno task serve
```

Format the code:
```
deno task fmt
```
