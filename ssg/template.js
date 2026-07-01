import fs from "node:fs";
import path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const layoutPath = path.join(__dirname, "layout.html");
const layoutSource = fs.readFileSync(layoutPath, "utf-8");

/**
 * Returns the HTML script tags required for the Ace Editor.
 * @param {string} relativeRoot
 * @returns {string}
 */
const aceScripts = (relativeRoot) => `
<script src="${relativeRoot}ace/ace.js"></script>
<script>
  document.addEventListener("DOMContentLoaded", () => {
    const editorDivs = document.querySelectorAll('.ace-editor-instance');
    if (editorDivs.length === 0) return;

    // Set base path for Ace so it can load modes and themes relatively
    ace.config.set('basePath', '${relativeRoot}ace/');

    window.interactiveEditors = {};
    editorDivs.forEach(div => {
      const id = div.id;
      const editor = ace.edit(id);
      // No theme set -> defaults to the light theme
      editor.session.setMode("ace/mode/javascript");
      editor.session.setOption("useWorker", false); // Disable worker to avoid extra file requests
      editor.setOptions({
        fontSize: "14px",
        maxLines: Infinity, // Auto-grow height to prevent scrolling
        minLines: 8
      });
      window.interactiveEditors[id] = editor;
    });
  });

  function runEditor(id) {
    const editor = window.interactiveEditors[id];
    const outputDiv = document.getElementById(\`output-\${id}\`);
    if (!editor || !outputDiv) return;

    // Clear previous output
    outputDiv.innerHTML = '';

    const code = editor.getValue();
    try {
      const log = (...args) => {
        const msg = args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return arg.toString();
            }
          }
          return arg;
        }).join(' ');
        
        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.fontFamily = 'monospace';
        pre.textContent = msg;
        outputDiv.appendChild(pre);
      };

      const runFn = new Function('element', 'log', code);
      runFn(outputDiv, log);
    } catch (err) {
      outputDiv.innerHTML = \`<span style="color: #ff8585; font-family: monospace;">Error: \${err.message}</span>\`;
    }
  }
</script>
`;

/**
 * Wraps the content in a standard HTML template.
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.content
 * @param {string} params.relativeRoot
 * @param {string} [params.date]
 * @param {string} params.siteTitle
 * @param {boolean} [params.isHome]
 * @returns {string}
 */
export function getTemplate(
  { title, content, relativeRoot, date, siteTitle, isHome },
) {
  const year = new Date().getFullYear();
  const dateHtml = date ? `<div class="post-meta">${date}</div>` : "";
  const titleHtml = (title && !isHome) ? `<h1>${title}</h1>` : "";

  const hasEditor = content.includes('class="ace-editor-instance"');
  const extraScripts = hasEditor ? aceScripts(relativeRoot) : "";

  return layoutSource
    .replace(/{{title}}/g, title || siteTitle || "My Blog")
    .replace(/{{siteTitle}}/g, siteTitle || "My Blog")
    .replace(/{{titleHtml}}/g, titleHtml)
    .replace(/{{relativeRoot}}/g, relativeRoot)
    .replace(/{{dateHtml}}/g, dateHtml)
    .replace(/{{content}}/g, content)
    .replace(/{{year}}/g, year)
    .replace(/{{extraScripts}}/g, extraScripts);
}
