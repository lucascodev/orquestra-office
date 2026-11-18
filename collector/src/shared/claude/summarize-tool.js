import { clip } from "../text/clip.js";
import { TOOL_SUMMARY } from "./tool-summary-ids.js";
import { DELEGATE_TOOLS, EDIT_TOOLS, SHELL_TOOLS, WRITE_TOOLS } from "./tool-names.js";

const DETAIL_LIMIT = 2_000;
const SUMMARY_LIMIT = 160;
const TOOL_NAME_LIMIT = 60;

const fileOf = (input) => String(input?.file_path ?? input?.notebook_path ?? input?.path ?? "");

const markLines = (text, mark) => String(text ?? "").split("\n").map((line) => `${mark} ${line}`).join("\n");
const diffOf = ({ old_string: before, new_string: after }) => `${markLines(before, "-")}\n${markLines(after, "+")}`;

function editDiff(input) {
  const edits = Array.isArray(input?.edits) ? input.edits : [input];
  return edits.filter((edit) => edit?.old_string !== undefined).map(diffOf).join("\n");
}

const described = (summaryId, subject, summary, detail) => ({ summaryId, subject, summary, detail });

function describe(name, input) {
  if (SHELL_TOOLS.has(name)) {
    const description = input?.description ? String(input.description) : null;
    return described(TOOL_SUMMARY.RUN_COMMAND, description, description ?? "Rodar um comando", input?.command);
  }
  if (WRITE_TOOLS.has(name)) return described(TOOL_SUMMARY.WRITE_FILE, fileOf(input), `Escrever ${fileOf(input)}`, input?.content ?? input?.new_source);
  if (EDIT_TOOLS.has(name)) return described(TOOL_SUMMARY.EDIT_FILE, fileOf(input), `Editar ${fileOf(input)}`, editDiff(input));
  if (name === "Read") return described(TOOL_SUMMARY.READ_FILE, fileOf(input), `Ler ${fileOf(input)}`, "");
  if (name === "WebFetch") return described(TOOL_SUMMARY.OPEN_PAGE, null, "Abrir uma página", input?.url);
  if (name === "WebSearch") return described(TOOL_SUMMARY.SEARCH_WEB, null, "Pesquisar na web", input?.query);
  if (DELEGATE_TOOLS.has(name)) {
    const type = input?.subagent_type == null ? null : String(input.subagent_type);
    return described(TOOL_SUMMARY.DELEGATE, type, `Delegar para ${type ?? "um subagente"}`, input?.prompt ?? input?.description);
  }
  return described(null, null, "", JSON.stringify(input ?? {}, null, 2));
}

export function summarizeTool(toolName, toolInput) {
  const name = String(toolName ?? "");
  const { summaryId, subject, summary, detail } = describe(name, toolInput);
  return {
    toolName: clip(name, TOOL_NAME_LIMIT),
    summaryId,
    subject: subject === null ? null : clip(subject, SUMMARY_LIMIT),
    summary: clip(String(summary), SUMMARY_LIMIT),
    detail: clip(detail, DETAIL_LIMIT),
  };
}
