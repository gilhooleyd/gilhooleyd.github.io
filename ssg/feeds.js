import fs from "node:fs";
import path from "node:path";

/**
 * Escapes special XML characters.
 * @param {string} unsafe
 * @returns {string}
 */
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
    }
  });
}

/**
 * Generates RSS 2.0 and Atom 1.0 feeds.
 * @param {object} params
 * @param {string} params.baseURL
 * @param {string} params.siteTitle
 * @param {string} params.docsDir
 * @param {Array<{title: string, date: string, url: string, timestamp: number, htmlContent: string}>} params.posts
 */
export function generateFeeds({ baseURL, siteTitle, docsDir, posts }) {
  const cleanBase = baseURL.endsWith("/") ? baseURL : baseURL + "/";

  // Sort posts by date descending
  const sortedPosts = [...posts].sort((a, b) => b.timestamp - a.timestamp);

  const lastBuildDate = new Date().toUTCString();
  const lastBuildDateISO = new Date().toISOString();

  // 1. Generate RSS 2.0
  let rss = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <link>${cleanBase}</link>
    <description>Recent content on ${escapeXml(siteTitle)}</description>
    <generator>Custom JS SSG</generator>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${cleanBase}index.xml" rel="self" type="application/rss+xml" />\n`;

  for (const post of sortedPosts) {
    const postUrl = `${cleanBase}${post.url}`;
    const pubDate = post.date
      ? new Date(post.date).toUTCString()
      : lastBuildDate;
    const safeHtml = post.htmlContent.replace(/]]>/g, "]]&gt;<![CDATA[");

    rss += `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <pubDate>${pubDate}</pubDate>
      <guid>${postUrl}</guid>
      <description><![CDATA[${safeHtml}]]></description>
    </item>\n`;
  }

  rss += `  </channel>
</rss>`;

  // 2. Generate Atom 1.0
  let atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(siteTitle)}</title>
  <link href="${cleanBase}atom.xml" rel="self"/>
  <link href="${cleanBase}"/>
  <updated>${lastBuildDateISO}</updated>
  <id>${cleanBase}</id>
  <generator>Custom JS SSG</generator>\n`;

  for (const post of sortedPosts) {
    const postUrl = `${cleanBase}${post.url}`;
    const updated = post.date
      ? new Date(post.date).toISOString()
      : lastBuildDateISO;
    const safeHtml = post.htmlContent.replace(/]]>/g, "]]&gt;<![CDATA[");

    atom += `  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${postUrl}"/>
    <id>${postUrl}</id>
    <updated>${updated}</updated>
    <summary type="html"><![CDATA[${safeHtml}]]></summary>
  </entry>\n`;
  }

  atom += `</feed>`;

  fs.writeFileSync(path.join(docsDir, "index.xml"), rss, "utf-8");
  fs.writeFileSync(path.join(docsDir, "atom.xml"), atom, "utf-8");

  console.log("Generated feeds: docs/index.xml (RSS) and docs/atom.xml (Atom)");
}
