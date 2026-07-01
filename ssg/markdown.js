/**
 * Parses YAML-like front matter from the start of a markdown file.
 * @param {string} content
 * @returns {{ frontMatter: Record<string, string>, markdownContent: string }}
 */
export function parseFrontMatter(content) {
  const lines = content.split("\n");
  const frontMatter = {};
  let markdownContent = content;

  const startLine = lines[0] ? lines[0].trim() : "";
  if (startLine === "---" || startLine === "+++") {
    const delimiter = startLine;
    const endIdx = lines.indexOf(delimiter, 1);
    if (endIdx !== -1) {
      const fmLines = lines.slice(1, endIdx);
      for (const line of fmLines) {
        const colonIdx = line.indexOf(":");
        const eqIdx = line.indexOf("=");
        // Use whichever separator comes first
        let splitIdx = -1;
        if (colonIdx !== -1 && eqIdx !== -1) {
          splitIdx = Math.min(colonIdx, eqIdx);
        } else if (colonIdx !== -1) {
          splitIdx = colonIdx;
        } else if (eqIdx !== -1) {
          splitIdx = eqIdx;
        }

        if (splitIdx !== -1) {
          const key = line.slice(0, splitIdx).trim();
          let value = line.slice(splitIdx + 1).trim();
          // Remove surrounding quotes if present
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          frontMatter[key] = value;
        }
      }
      markdownContent = lines.slice(endIdx + 1).join("\n");
    }
  }

  return { frontMatter, markdownContent };
}

/**
 * Escapes HTML characters to prevent rendering issues and XSS.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Parses inline markdown elements (bold, italic, code, links).
 * @param {string} text
 * @returns {string}
 */
function parseInline(text) {
  let [escaped] = [escapeHtml(text)];

  // Bold **text** or __text__
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Italic *text* or _text_
  escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");
  escaped = escaped.replace(/_(.*?)_/g, "<em>$1</em>");

  // Inline code `code`
  escaped = escaped.replace(/`(.*?)`/g, "<code>$1</code>");

  // Links [text](url)
  escaped = escaped.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

  return escaped;
}

/**
 * Converts markdown text to HTML.
 * @param {string} md
 * @returns {string}
 */
export function parseMarkdown(md) {
  const lines = md.split("\n");
  let html = "";
  let inCodeBlock = false;
  let codeContent = [];
  let codeLang = "";
  let currentParagraph = [];
  let inList = false;
  let editorCounter = 0;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      html += `<p>${parseInline(currentParagraph.join(" "))}</p>\n`;
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (inList) {
      html += `</ul>\n`;
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // End of code block
        if (codeLang === "js-editor") {
          const id = `editor-${editorCounter++}`;
          html += `<div class="interactive-editor">
  <div class="editor-left">
    <div class="ace-editor-instance" id="${id}">${
            escapeHtml(codeContent.join("\n"))
          }</div>
    <button class="run-btn" onclick="runEditor('${id}')">Run</button>
  </div>
  <div class="editor-right" id="output-${id}"></div>
</div>\n`;
        } else {
          html += `<pre><code class="language-${codeLang}">${
            escapeHtml(codeContent.join("\n"))
          }</code></pre>\n`;
        }
        codeContent = [];
        inCodeBlock = false;
      } else {
        // Start of code block
        flushParagraph();
        flushList();
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      flushParagraph();
      flushList();
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      html += `<h${level}>${parseInline(content)}</h${level}>\n`;
      continue;
    }

    // List items (unordered)
    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      if (!inList) {
        html += `<ul>\n`;
        inList = true;
      }
      html += `<li>${parseInline(listMatch[1])}</li>\n`;
      continue;
    }

    // Paragraph text
    currentParagraph.push(line);
  }

  flushParagraph();
  flushList();

  return html;
}
