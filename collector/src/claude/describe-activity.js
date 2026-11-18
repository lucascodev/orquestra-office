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

const doing = (status, activity, actionId, subject = "") => ({ status, activity, actionId, subject: subject || null });

export function describeActivity(toolName, toolInput) {
  const name = String(toolName ?? "");
  if (READ_TOOLS.has(name)) return doing("reviewing", "reading", AGENT_ACTION.READING, fileOf(toolInput));
  if (EDIT_TOOLS.has(name) || WRITE_TOOLS.has(name)) return doing("working", "editing", AGENT_ACTION.EDITING, fileOf(toolInput));
  if (SHELL_TOOLS.has(name)) return doing("working", "terminal", AGENT_ACTION.RUNNING, firstWord(toolInput?.command));
  if (DELEGATE_TOOLS.has(name)) return doing("working", "delegating", AGENT_ACTION.DELEGATING, String(toolInput?.subagent_type ?? "").slice(0, AGENT_TYPE_LIMIT));
  if (ASK_TOOLS.has(name)) return doing("needs_you", "asking", name === "ExitPlanMode" ? AGENT_ACTION.ASKING_PLAN_APPROVAL : AGENT_ACTION.ASKING_QUESTION);
  if (TODO_TOOLS.has(name)) return doing("working", "planning", AGENT_ACTION.UPDATING_TODOS);
  if (WEB_TOOLS.has(name)) return doing("reviewing", "web", AGENT_ACTION.SEARCHING_WEB);
  if (name.startsWith("mcp__")) return doing("working", "editing", AGENT_ACTION.USING_CONNECTOR, (name.split("__")[1] ?? "").slice(0, SHOWN_NAME_LIMIT));
  return doing("working", "editing", AGENT_ACTION.USING_TOOL, name.slice(0, SHOWN_NAME_LIMIT));
}
