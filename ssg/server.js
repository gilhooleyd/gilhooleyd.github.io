import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { build } from "./build.js";
import { startWatcher } from "./watcher.js";

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export function serve(port = 3000) {
  // 1. Run initial build to ensure docs/ is up to date
  build();

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const projectRoot = path.resolve(__dirname, "..");
  const docsDir = path.join(projectRoot, "docs");

  const server = http.createServer((req, res) => {
    // Prevent directory traversal
    let safeUrl = path.normalize(decodeURIComponent(req.url)).replace(
      /^(\.\.[\/\\])+/,
      "",
    );
    // Remove query strings
    safeUrl = safeUrl.split("?")[0];

    let filePath = path.join(docsDir, safeUrl);

    // Ensure we are still within the docsDir
    if (!filePath.startsWith(docsDir)) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "text/plain");
      res.end("403 Forbidden");
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("404 Not Found");
      return;
    }

    // If it's a directory, look for index.html
    if (fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain");
        res.end("404 Not Found (No index.html)");
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);

    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => {
      console.error(err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
      res.end("500 Internal Server Error");
    });
    stream.pipe(res);
  });

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
    startWatcher();
  });
}
