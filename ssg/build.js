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
const postsDir = path.join(contentDir, "posts");


function isPathInside(childPath, parentPath) {
  const absoluteChild = path.resolve(childPath);
  const absoluteParent = path.resolve(parentPath);

  const relative = path.relative(absoluteParent, absoluteChild);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function filePathIsPost(filePath) {
  return isPathInside(filePath, postsDir);
}

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

let siteMetadata = null;
/**
 * Parses metadata.json5 to extract baseURL and site title.
 * Fallbacks are provided if the file is missing or cannot be parsed.
 * @returns {{ baseURL: string, siteTitle: string }}
 */
export function getSiteMetadata() {
  if (siteMetadata) return siteMetadata;

  const metadataPath = path.join(projectRoot, "metadata.json5");
  const content = fs.readFileSync(metadataPath, "utf-8");
  siteMetadata = parseJSON5(content);
  return siteMetadata;
}

/**
 * Recursively gets all files in a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const file of fs.readdirSync(dir)) {
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

function convertText(relativePath, content) {
  const { frontMatter, markdownContent } = parseFrontMatter(content);

  const title = frontMatter.title || path.basename(relativePath, ".md");
  const date = frontMatter.date || null;
  const htmlRelativePath = relativePath.replace(/\.md$/, ".html");
  const metadata = {
    title,
    date,
    url: htmlRelativePath,
    timestamp: date ? new Date(date).getTime() : 0,
  };

  const htmlContent = parseMarkdown(markdownContent);
  const relativeRoot = getRelativeRoot(relativePath);
  const { siteTitle } = getSiteMetadata();
  const fullHtml = getTemplate({
    title,
    content: htmlContent,
    relativeRoot,
    date,
    siteTitle,
  });

  return {
    metadata,
    fullHtml,
  };
}

/**
 * Compiles a single markdown file to HTML.
 * @param {string} filePath
 */
function compileFile(filePath) {
  const relativePath = path.relative(contentDir, filePath);
  const htmlRelativePath = relativePath.replace(/\.md$/, ".html");
  const outputPath = path.join(docsDir, htmlRelativePath);

  const content = fs.readFileSync(filePath, "utf-8");
  const post = convertText(relativePath, content);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, post.fullHtml, "utf-8");
  console.log(`Compiled: ${relativePath} -> docs/${htmlRelativePath}`);
  return post;
}

function copyStaticFile(filePath) {
  const relativePath = path.relative(contentDir, filePath);
  const outputPath = path.join(docsDir, relativePath);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(filePath, outputPath);
  console.log(`Copied static: ${relativePath} -> docs/${relativePath}`);
}

function buildMeta(posts) {
  const { baseURL, siteTitle } = getSiteMetadata();

  // Sort posts by newest first.
  posts.sort((a, b) => b.timestamp - a.timestamp);

  // Create the index.html
  let postToHtml = (post) => {
    const dateStr = post.date ? `<span class="date">${post.date}</span>` : "";
    return `  <li class="post-item"><a href="./${post.url}">${post.title}</a>${dateStr}</li>\n`;
  };

  let postsHtml = '<ul class="post-list">\n';
  for (const post of posts) {
    postsHtml += postToHtml(post);
  }
  postsHtml += "</ul>";

  const indexHtml = getTemplate({
    content: postsHtml,
    relativeRoot: "./",
    siteTitle,
    isHome: true,
  });

  fs.writeFileSync(path.join(docsDir, "index.html"), indexHtml, "utf-8");

  // Rebuild Feeds.
  generateFeeds({ baseURL, siteTitle, docsDir, posts });
}

function clearDir(dirPath) {
  if (fs.existsSync(docsDir)) {
    fs.rmSync(docsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(docsDir, { recursive: true });
}

/**
 * Performs a full build of the site.
 */
export function build() {
  console.log("Building site...");

  clearDir(docsDir);
  copyDir(staticDir, docsDir);

  const files = getFilesRecursively(contentDir);
  const posts = [];

  for (const filePath of files) {
    if (!filePath.endsWith(".md")) {
      copyStaticFile(filePath);
      continue;
    }
    let post = compileFile(filePath);

    if (filePathIsPost(filePath)) posts.push(post);
  }

  // Generate index and feeds.
  buildMeta(posts.map(p => p.metadata));

  console.log("Build complete!");
}

/**
 * Handles a list of file changes.
 * @param {Array<{string}>} filePath
 */
export function handleChangedFiles(filePaths) {
  build();
}
