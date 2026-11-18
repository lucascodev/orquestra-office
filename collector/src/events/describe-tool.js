import { ASK_TOOLS, DELEGATE_TOOLS, EDIT_TOOLS, READ_TOOLS, SHELL_TOOLS, TODO_TOOLS, WEB_TOOLS, WRITE_TOOLS } from "../shared/claude/tool-names.js";

export function baseName(path) {
  if (typeof path !== "string" || path.length === 0) return "";
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) ?? "";
}

function firstWord(command) {
  if (typeof command !== "string") return "";
  const word = command.trim().split(/\s+/)[0] ?? "";
  return baseName(word).replace(/[^\w.+-]/g, "").slice(0, 24);
}

function fileOf(input) {
  return baseName(input?.file_path ?? input?.notebook_path ?? input?.path ?? "");
}

export function describeTool(toolName, toolInput) {
  const name = String(toolName ?? "");
  if (READ_TOOLS.has(name)) {
    const file = fileOf(toolInput);
    return { status: "reviewing", activity: "reading", action: file ? `lendo ${file}` : "procurando no código" };
  }
  if (EDIT_TOOLS.has(name) || WRITE_TOOLS.has(name)) {
    const file = fileOf(toolInput);
    return { status: "working", activity: "editing", action: file ? `editando ${file}` : "editando um arquivo" };
  }
  if (SHELL_TOOLS.has(name)) {
    const word = firstWord(toolInput?.command);
    return { status: "working", activity: "terminal", action: word ? `rodando ${word}` : "rodando um comando" };
  }
  if (DELEGATE_TOOLS.has(name)) {
    const type = String(toolInput?.subagent_type ?? "").slice(0, 40);
    return { status: "working", activity: "delegating", action: type ? `delegou para ${type}` : "delegou uma tarefa" };
  }
  if (ASK_TOOLS.has(name)) {
    return {
      status: "needs_you",
      activity: "asking",
      action: name === "ExitPlanMode" ? "quer que você aprove o plano" : "tem uma pergunta para você",
    };
  }
  if (TODO_TOOLS.has(name)) return { status: "working", activity: "planning", action: "atualizou a lista de tarefas" };
  if (WEB_TOOLS.has(name)) return { status: "reviewing", activity: "web", action: "pesquisando na web" };
  if (name.startsWith("mcp__")) {
    const server = name.split("__")[1] ?? "";
    return { status: "working", activity: "editing", action: server ? `usando ${server.slice(0, 30)}` : "usando um conector" };
  }
  return { status: "working", activity: "editing", action: name ? `usando ${name.slice(0, 30)}` : "trabalhando" };
}
