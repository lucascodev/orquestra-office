import DOMPurify from "../../../vendor/purify.es.js";
import hljs from "../../../vendor/highlight.min.js";
import { Marked } from "../../../vendor/marked.esm.js";
import { esc } from "../shared/escape-html.js";

const PLAIN_TEXT = "texto";

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName !== "A") return;
  node.setAttribute("target", "_blank");
  node.setAttribute("rel", "noopener noreferrer");
});

export function highlight(code, language) {
  const known = language && hljs.getLanguage(language) ? language : null;
  return known ? hljs.highlight(code, { language: known, ignoreIllegals: true }).value : esc(code);
}

export function codeBlock(code, language) {
  return `<div class="code-block">
    <div class="code-head"><span>${esc(language || PLAIN_TEXT)}</span><button type="button" class="copy-btn" data-copy>copiar</button></div>
    <pre><code class="hljs">${highlight(code, language)}</code></pre>
  </div>`;
}

const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: { code: ({ text, lang }) => codeBlock(text, (lang ?? "").split(/\s/)[0]) },
});

export const renderMarkdown = (text) => DOMPurify.sanitize(markdown.parse(String(text ?? "")), { ADD_ATTR: ["target"] });
