import { ago, clockTime, esc } from "./format.js";
import { describeToolEntry, diffLines } from "./terminal-format.js";
import { codeBlock, highlight, renderMarkdown } from "./terminal-markdown.js";

const COLLAPSE_AFTER_LINES = 12;
const DIFF_SIGNS = { add: "+", del: "−", same: " " };

const stamp = (entry) => (entry.at ? `<time class="stamp" datetime="${new Date(entry.at).toISOString()}">${clockTime(entry.at)}</time>` : "");

function renderDiff(detail) {
  const rows = diffLines(detail).map((line) => `<span class="diff-line ${line.kind}"><span class="diff-sign" aria-hidden="true">${DIFF_SIGNS[line.kind]}</span>${esc(line.text)}</span>`);
  return `<pre class="diff">${rows.join("")}</pre>`;
}

const renderCommand = (detail) => `<div class="code-block command">
    <div class="code-head"><span>comando</span><button type="button" class="copy-btn" data-copy>copiar</button></div>
    <pre><code class="hljs"><span class="prompt-sign" aria-hidden="true">$ </span>${highlight(detail, "bash")}</code></pre>
  </div>`;

const DETAIL_RENDERERS = {
  diff: (detail) => renderDiff(detail),
  command: (detail) => renderCommand(detail),
  code: (detail, language) => codeBlock(detail, language),
  text: (detail) => `<pre class="plain">${esc(detail)}</pre>`,
};

function renderDetail(detail, format, language) {
  if (!detail) return "";
  const body = DETAIL_RENDERERS[format](detail, language);
  const lineCount = detail.split("\n").length;
  if (lineCount <= COLLAPSE_AFTER_LINES) return `<div class="detail">${body}</div>`;
  return `<details class="detail"><summary>${lineCount} linhas</summary>${body}</details>`;
}

function renderTool(entry) {
  const tool = describeToolEntry(entry);
  return `<div class="entry tool" data-kind="${esc(tool.kind)}">
    <div class="entry-head"><span class="tool-glyph" aria-hidden="true">${esc(tool.glyph)}</span><b>${esc(tool.toolName)}</b>
      <span class="tool-summary">${esc(tool.summary)}</span>${stamp(entry)}</div>
    ${renderDetail(entry.detail, tool.format, tool.language)}
  </div>`;
}

const ENTRY_RENDERERS = {
  prompt: (entry) => `<div class="entry prompt"><span class="busy" aria-hidden="true">›</span><span class="prompt-text">${esc(entry.text)}</span>${stamp(entry)}</div>`,
  message: (entry) => `<div class="entry prompt"><span class="busy" aria-hidden="true">›</span><span class="prompt-text">${esc(entry.text)} <span class="muted">· pelo escritório</span></span>${stamp(entry)}</div>`,
  tool: renderTool,
  reply: (entry) => `<div class="entry reply"><div class="md">${renderMarkdown(entry.text)}</div></div>`,
  error: (entry) => `<div class="entry error"><div class="entry-head"><span class="tool-glyph" aria-hidden="true">✗</span><b>${esc(entry.text)}</b>${stamp(entry)}</div>${renderDetail(entry.detail, "text")}</div>`,
  note: (entry) => `<div class="entry note">${esc(entry.text)} <span class="when">· ${ago(entry.at)}</span></div>`,
};

export const renderEntries = (entries) => entries.map((entry) => (ENTRY_RENDERERS[entry.kind] ?? ENTRY_RENDERERS.note)(entry)).join("");

export function renderHistory(entries) {
  return entries.length === 0 ? `<div class="entry note">Sem registros ainda.</div>` : renderEntries(entries);
}
