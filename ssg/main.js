import { build } from "./build.js";
import { serve } from "./server.js";

// Native compatibility for both Node.js and Deno arguments
const args = typeof Deno !== "undefined" ? Deno.args : process.argv.slice(2);
const command = args[0];

if (command === "build") {
  build();
} else if (command === "serve") {
  let port = 3000;
  const portIdx = args.indexOf("--port");
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1], 10);
  }
  serve(port);
} else {
  console.log(`
Usage:
  Node.js:
    node ssg/main.js build      - Compile markdown files in content/ to HTML in docs/
    node ssg/main.js serve      - Start a local server to view the compiled site

  Deno:
    deno run --allow-read --allow-write ssg/main.js build
    deno run --allow-read --allow-net ssg/main.js serve

Options:
  --port <number>               - Specify port for the server (default: 3000)
`);
}
