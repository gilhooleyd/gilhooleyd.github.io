import fs from "node:fs";
import path from "node:path";
import { parseFrontMatter, parseMarkdown } from "./markdown.js";
import { getTemplate } from "./template.js";
import { generateFeeds } from "./feeds.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.resolve(__dirname, "..");
export const contentDir = path.join(projectRoot, "content");
export const docsDir = path.join(projectRoot, "docs");
export const staticDir = path.join(projectRoot, "static");

/**
 * A simple JSON5 parser that removes comments and trailing commas
 * before calling standard JSON.parse().
 * @param {string} text
 * @returns {object}
 */
function parseJSON5(text) {
  // Strip comments while ignoring strings
  let cleaned = text.replace(
    /("([^"\\]|\\.)*")|('([^'\\]|\\.)*')|(\/\*[\s\S]*?\*\/)|(\/\/.*)/g,
    (match, g1, g2, g3, g4, g5, g6) => {
      if (g5 || g6) return "";
      return match;
    },
  );

  // Quote unquoted keys
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_]\w*)(\s*:)/g, '$1"$2"$3');

  // Remove trailing commas
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

  return JSON.parse(cleaned);
}

/**
 * Parses metadata.json5 to extract baseURL and site title.
 * Fallbacks are provided if the file is missing or cannot be parsed.
 * @returns {{ baseURL: string, siteTitle: string }}
 */
export function getSiteMetadata() {
  let baseURL = "https://gilhooleyd.github.io/";
  let siteTitle = "My Blog";

  const metadataPath = path.join(projectRoot, "metadata.json5");
  if (fs.existsSync(metadataPath)) {
    try {
      const content = fs.readFileSync(metadataPath, "utf-8");
      const config = parseJSON5(content);
      if (config.baseURL) baseURL = config.baseURL;
      if (config.siteTitle) siteTitle = config.siteTitle;
    } catch (err) {
      console.error("Error reading metadata.json5:", err);
    }
  }
  return { baseURL, siteTitle };
}

/**
 * Recursively gets all files in a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

/**
 * Recursively copies a directory.
 * @param {string} src
 * @param {string} dest
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Calculates the relative path to the root directory.
 * @param {string} relativePath
 * @returns {string}
 */
function getRelativeRoot(relativePath) {
  const depth = relativePath.split(/[/\\]/).length - 1;
  return depth > 0 ? "../".repeat(depth) : "./";
}

/**
 * Compiles a single markdown file to HTML.
 * @param {string} filePath
 */
export function compileFile(filePath) {
  const relativePath = path.relative(contentDir, filePath);
  const htmlRelativePath = relativePath.replace(/\.md$/, ".html");
  const outputPath = path.join(docsDir, htmlRelativePath);

  if (!fs.existsSync(filePath)) {
    // File was deleted
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log(`Removed: docs/${htmlRelativePath}`);
    }
    return;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { frontMatter, markdownContent } = parseFrontMatter(content);
    const htmlContent = parseMarkdown(markdownContent);

    const relativeRoot = getRelativeRoot(relativePath);
    const title = frontMatter.title || path.basename(relativePath, ".md");
    const date = frontMatter.date || null;
    const { siteTitle } = getSiteMetadata();
    const isHome = relativePath === "index.md";

    const fullHtml = getTemplate({
      title,
      content: htmlContent,
      relativeRoot,
      date,
      siteTitle,
      isHome,
    });

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, fullHtml, "utf-8");
    console.log(`Compiled: ${relativePath} -> docs/${htmlRelativePath}`);
  } catch (err) {
    console.error(`Error compiling ${relativePath}:`, err);
  }
}

/**
 * Copies a single static file to docs.
 * @param {string} filePath
 */
export function copyStaticFile(filePath) {
  const relativePath = path.relative(contentDir, filePath);
  const outputPath = path.join(docsDir, relativePath);

  if (!fs.existsSync(filePath)) {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log(`Removed static: docs/${relativePath}`);
    }
    return;
  }

  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(filePath, outputPath);
    console.log(`Copied static: ${relativePath} -> docs/${relativePath}`);
  } catch (err) {
    console.error(`Error copying static file ${relativePath}:`, err);
  }
}

/**
 * Rebuilds metadata files: index.html (if no content/index.md), RSS feed, and Atom feed.
 */
export function rebuildMeta() {
  const { baseURL, siteTitle } = getSiteMetadata();
  const postsDir = path.join(contentDir, "posts");
  const files = getFilesRecursively(postsDir);
  const posts = [];

  for (const filePath of files) {
    if (!filePath.endsWith(".md")) continue;

    const relativePath = path.relative(contentDir, filePath);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const { frontMatter, markdownContent } = parseFrontMatter(content);
      const title = frontMatter.title || path.basename(relativePath, ".md");
      const date = frontMatter.date || null;
      const htmlRelativePath = relativePath.replace(/\.md$/, ".html");
      const htmlContent = parseMarkdown(markdownContent);

      posts.push({
        title,
        date,
        url: htmlRelativePath,
        timestamp: date ? new Date(date).getTime() : 0,
        htmlContent,
      });
    } catch (e) {
      // Ignore errors
    }
  }

  // Sort posts by date descending
  posts.sort((a, b) => b.timestamp - a.timestamp);

  // 1. Rebuild Index HTML if no content/index.md exists
  const indexMdPath = path.join(contentDir, "index.md");
  if (!fs.existsSync(indexMdPath)) {
    let postsHtml = '<ul class="post-list">\n';
    for (const post of posts) {
      const dateStr = post.date ? `<span class="date">${post.date}</span>` : "";
      postsHtml +=
        `  <li class="post-item"><a href="./${post.url}">${post.title}</a>${dateStr}</li>\n`;
    }
    postsHtml += "</ul>";

    const indexHtml = getTemplate({
      title: siteTitle,
      content: postsHtml,
      relativeRoot: "./",
      siteTitle,
      isHome: true,
    });

    fs.writeFileSync(path.join(docsDir, "index.html"), indexHtml, "utf-8");
    console.log("Regenerated index.html");
  }

  // 2. Rebuild Feeds
  generateFeeds({ baseURL, siteTitle, docsDir, posts });
}

/**
 * Handles a single file change (creation, modification, or deletion).
 * @param {string} filePath
 */
export function handleFileChange(filePath) {
  const relativePath = path.relative(contentDir, filePath);

  if (relativePath.startsWith("..")) return;

  const isMd = filePath.endsWith(".md");

  if (isMd) {
    compileFile(filePath);

    const isPost = relativePath.startsWith(`posts${path.sep}`) ||
      relativePath.startsWith("posts/");
    if (isPost || relativePath === "index.md") {
      rebuildMeta();
    }
  } else {
    copyStaticFile(filePath);
  }
}

/**
 * Performs a full build of the site.
 */
export function build() {
  console.log("Building site...");

  if (fs.existsSync(docsDir)) {
    fs.rmSync(docsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(docsDir, { recursive: true });

  // Copy everything from static/ to docs/
  copyDir(staticDir, docsDir);
  console.log("Copied static assets.");

  const files = getFilesRecursively(contentDir);

  for (const filePath of files) {
    if (filePath.endsWith(".md")) {
      compileFile(filePath);
    } else {
      copyStaticFile(filePath);
    }
  }

  // Generate index and feeds
  rebuildMeta();

  console.log("Build complete!");
}
