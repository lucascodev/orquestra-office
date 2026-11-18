import { clip } from "../text/clip.js";
import { DELEGATE_TOOLS, EDIT_TOOLS, SHELL_TOOLS, WRITE_TOOLS } from "./tool-names.js";

const DETAIL_LIMIT = 2_000;
const SUMMARY_LIMIT = 160;

const fileOf = (input) => String(input?.file_path ?? input?.notebook_path ?? input?.path ?? "");

const markLines = (text, mark) => String(text ?? "").split("\n").map((line) => `${mark} ${line}`).join("\n");
const diffOf = ({ old_string: before, new_string: after }) => `${markLines(before, "-")}\n${markLines(after, "+")}`;

function editDiff(input) {
  const edits = Array.isArray(input?.edits) ? input.edits : [input];
  return edits.filter((edit) => edit?.old_string !== undefined).map(diffOf).join("\n");
}

function describe(name, input) {
  if (SHELL_TOOLS.has(name)) return { summary: input?.description || "Rodar um comando", detail: input?.command };
  if (WRITE_TOOLS.has(name)) return { summary: `Escrever ${fileOf(input)}`, detail: input?.content ?? input?.new_source };
  if (EDIT_TOOLS.has(name)) return { summary: `Editar ${fileOf(input)}`, detail: editDiff(input) };
  if (name === "Read") return { summary: `Ler ${fileOf(input)}`, detail: "" };
  if (name === "WebFetch") return { summary: "Abrir uma página", detail: input?.url };
  if (name === "WebSearch") return { summary: "Pesquisar na web", detail: input?.query };
  if (DELEGATE_TOOLS.has(name)) return { summary: `Delegar para ${input?.subagent_type ?? "um subagente"}`, detail: input?.prompt ?? input?.description };
  return { summary: "", detail: JSON.stringify(input ?? {}, null, 2) };
}

export function summarizeTool(toolName, toolInput) {
  const name = String(toolName ?? "");
  const { summary, detail } = describe(name, toolInput);
  return { toolName: clip(name, 60), summary: clip(String(summary), SUMMARY_LIMIT), detail: clip(detail, DETAIL_LIMIT) };
}
