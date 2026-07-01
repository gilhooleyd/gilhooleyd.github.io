---
title: "Adding JS demos to my blog"
date: 2026-07-03
---

I've been playing around with my own Static Site Generator made in javascript.
One of the most exciting things about having my own SSG is that it is easy to
add new features for things that I want.

My latest cool feature is the ability to have interactive javascript code blocks.
This should make it much easier to write blog posts with usable demos that
other folks can play around with.


To use this feature, I add `js-editor` to the language tag on a code block.
The SSG will then use the `ace` library to create a code editor.

### How it works

On the right side of the editor, there is an output container. When you click
**Run**, your code is executed. Your code has access to two special variables:

- `element`: The `div` element on the right. You can manipulate it directly
  (e.g., `element.style.backgroundColor = 'red'`).
- `log(...args)`: A helper function to print text or objects to the output
  container.

### Try it out!

Here is a simple example. Try changing the text, adding new logs, or editing the
DOM styling, and then click **Run**.

```js-editor
log("Hello from the interactive editor!");
log("Today is:", new Date().toLocaleDateString());

// You can also manipulate the DOM directly:
element.style.border = "2px dashed #0969da";
element.style.padding = "15px";
element.style.borderRadius = "6px";
element.style.marginTop = "10px";

const btn = document.createElement('button');
btn.textContent = "Click me!";
btn.style.padding = "5px 10px";
btn.style.cursor = "pointer";
btn.onclick = () => alert("You clicked the generated button!");
element.appendChild(btn);
```
