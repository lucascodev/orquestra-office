import { AGENT_ACTION } from "../office/domain/agent-actions.js";
import { baseName } from "../office/domain/path-name.js";
import { ASK_TOOLS, DELEGATE_TOOLS, EDIT_TOOLS, READ_TOOLS, SHELL_TOOLS, TODO_TOOLS, WEB_TOOLS, WRITE_TOOLS } from "../shared/claude/tool-names.js";

const COMMAND_NAME_LIMIT = 24;
const AGENT_TYPE_LIMIT = 40;
const SHOWN_NAME_LIMIT = 30;

function firstWord(command) {
  if (typeof command !== "string") return "";
  const word = command.trim().split(/\s+/)[0] ?? "";
  return baseName(word).replace(/[^\w.+-]/g, "").slice(0, COMMAND_NAME_LIMIT);
}

function fileOf(input) {
  return baseName(input?.file_path ?? input?.notebook_path ?? input?.path ?? "");
}

const orNull = (text) => text || null;

export function describeActivity(toolName, toolInput) {
  const name = String(toolName ?? "");
  if (READ_TOOLS.has(name)) {
    const file = fileOf(toolInput);
    return { status: "reviewing", activity: "reading", actionId: AGENT_ACTION.READING, subject: orNull(file), action: file ? `lendo ${file}` : "procurando no código" };
  }
  if (EDIT_TOOLS.has(name) || WRITE_TOOLS.has(name)) {
    const file = fileOf(toolInput);
    return { status: "working", activity: "editing", actionId: AGENT_ACTION.EDITING, subject: orNull(file), action: file ? `editando ${file}` : "editando um arquivo" };
  }
  if (SHELL_TOOLS.has(name)) {
    const word = firstWord(toolInput?.command);
    return { status: "working", activity: "terminal", actionId: AGENT_ACTION.RUNNING, subject: orNull(word), action: word ? `rodando ${word}` : "rodando um comando" };
  }
  if (DELEGATE_TOOLS.has(name)) {
    const type = String(toolInput?.subagent_type ?? "").slice(0, AGENT_TYPE_LIMIT);
    return { status: "working", activity: "delegating", actionId: AGENT_ACTION.DELEGATING, subject: orNull(type), action: type ? `delegou para ${type}` : "delegou uma tarefa" };
  }
  if (ASK_TOOLS.has(name)) {
    const isPlan = name === "ExitPlanMode";
    return {
      status: "needs_you",
      activity: "asking",
      actionId: isPlan ? AGENT_ACTION.ASKING_PLAN_APPROVAL : AGENT_ACTION.ASKING_QUESTION,
      subject: null,
      action: isPlan ? "quer que você aprove o plano" : "tem uma pergunta para você",
    };
  }
  if (TODO_TOOLS.has(name)) return { status: "working", activity: "planning", actionId: AGENT_ACTION.UPDATING_TODOS, subject: null, action: "atualizou a lista de tarefas" };
  if (WEB_TOOLS.has(name)) return { status: "reviewing", activity: "web", actionId: AGENT_ACTION.SEARCHING_WEB, subject: null, action: "pesquisando na web" };
  if (name.startsWith("mcp__")) {
    const server = (name.split("__")[1] ?? "").slice(0, SHOWN_NAME_LIMIT);
    return { status: "working", activity: "editing", actionId: AGENT_ACTION.USING_CONNECTOR, subject: orNull(server), action: server ? `usando ${server}` : "usando um conector" };
  }
  const shownName = name.slice(0, SHOWN_NAME_LIMIT);
  return { status: "working", activity: "editing", actionId: AGENT_ACTION.USING_TOOL, subject: orNull(shownName), action: shownName ? `usando ${shownName}` : "trabalhando" };
}
