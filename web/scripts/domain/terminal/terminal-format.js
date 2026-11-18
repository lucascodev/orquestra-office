import { CODE_LANGUAGES, TOOL_GLYPHS, TOOL_KINDS } from "../../data/terminal-tools.js";

const TOOL_TEXT = /^([\w.-]+)(?::\s*(.*))?$/s;
const WRITE_SUMMARY = /^Escrever\s+(.+)$/;
const DIFF_MARKS = { "- ": "del", "+ ": "add" };
const DETAIL_FORMAT_BY_KIND = { edit: "diff", shell: "command", write: "code" };
const MCP_PREFIX = "mcp__";

export function languageOfFile(path) {
  const name = String(path ?? "").split(/[\\/]/).pop().toLowerCase();
  if (name === "dockerfile") return CODE_LANGUAGES.dockerfile;
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return CODE_LANGUAGES[extension] ?? null;
}

function kindOf(toolName) {
  if (toolName.startsWith(MCP_PREFIX)) return "other";
  return TOOL_KINDS[toolName] ?? "other";
}

function languageOf(kind, summary, detail) {
  if (kind === "shell") return "bash";
  if (kind === "write") return languageOfFile(WRITE_SUMMARY.exec(summary)?.[1]);
  if (kind === "other" && /^\s*[{[]/.test(detail)) return "json";
  return null;
}

export function describeToolEntry({ text, detail = "" }) {
  const [, toolName = String(text ?? ""), summary = ""] = TOOL_TEXT.exec(String(text ?? "")) ?? [];
  const kind = kindOf(toolName);
  const language = languageOf(kind, summary, detail);
  const format = DETAIL_FORMAT_BY_KIND[kind] ?? (language ? "code" : "text");
  return { toolName, summary, kind, glyph: TOOL_GLYPHS[kind], format, language };
}

export function diffLines(detail) {
  return String(detail ?? "").split("\n").map((line) => {
    const mark = line.slice(0, 2);
    const kind = DIFF_MARKS[mark];
    return kind ? { kind, text: line.slice(2) } : { kind: "same", text: line };
  });
}
