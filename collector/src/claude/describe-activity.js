import { AGENT_ACTION } from "../office/domain/agent-actions.js";
import { baseName } from "../office/domain/path-name.js";
import { ASK_TOOLS, DELEGATE_TOOLS, EDIT_TOOLS, READ_TOOLS, SHELL_TOOLS, TODO_TOOLS, WEB_TOOLS, WRITE_TOOLS } from "../shared/claude/tool-names.js";
import { projectPathOf } from "../shared/path/project-path.js";
import { testCommandOf } from "../work/domain/commands/test-command.js";
import { isTestFile } from "../work/domain/tests/test-file.js";

const COMMAND_NAME_LIMIT = 24;
const AGENT_TYPE_LIMIT = 40;
const SHOWN_NAME_LIMIT = 30;

function firstWord(command) {
  if (typeof command !== "string") return "";
  const word = command.trim().split(/\s+/)[0] ?? "";
  return baseName(word).replace(/[^\w.+-]/g, "").slice(0, COMMAND_NAME_LIMIT);
}

function testWord(command) {
  const testRun = testCommandOf(command);
  if (!testRun) return null;
  return testRun.framework ?? firstWord(testRun.command);
}

const pathOf = (input) => input?.file_path ?? input?.notebook_path ?? input?.path ?? "";
const fileOf = (input) => baseName(pathOf(input));

const doing = (status, activity, actionId, subject = "") => ({ status, activity, actionId, subject: subject || null });

function describeShell(command) {
  const testSubject = testWord(command);
  if (testSubject !== null) return doing("working", "terminal", AGENT_ACTION.RUNNING_TESTS, testSubject);
  return doing("working", "terminal", AGENT_ACTION.RUNNING, firstWord(command));
}

function describeEdit(input, projectRoot) {
  const isTest = isTestFile(projectPathOf(pathOf(input), projectRoot));
  return doing("working", "editing", isTest ? AGENT_ACTION.WRITING_TESTS : AGENT_ACTION.EDITING, fileOf(input));
}

export function describeActivity(toolName, toolInput, projectRoot = "") {
  const name = String(toolName ?? "");
  if (READ_TOOLS.has(name)) return doing("reviewing", "reading", AGENT_ACTION.READING, fileOf(toolInput));
  if (EDIT_TOOLS.has(name) || WRITE_TOOLS.has(name)) return describeEdit(toolInput, projectRoot);
  if (SHELL_TOOLS.has(name)) return describeShell(toolInput?.command);
  if (DELEGATE_TOOLS.has(name)) return doing("working", "delegating", AGENT_ACTION.DELEGATING, String(toolInput?.subagent_type ?? "").slice(0, AGENT_TYPE_LIMIT));
  if (ASK_TOOLS.has(name)) return doing("needs_you", "asking", name === "ExitPlanMode" ? AGENT_ACTION.ASKING_PLAN_APPROVAL : AGENT_ACTION.ASKING_QUESTION);
  if (TODO_TOOLS.has(name)) return doing("working", "planning", AGENT_ACTION.UPDATING_TODOS);
  if (WEB_TOOLS.has(name)) return doing("reviewing", "web", AGENT_ACTION.SEARCHING_WEB);
  if (name.startsWith("mcp__")) return doing("working", "editing", AGENT_ACTION.USING_CONNECTOR, (name.split("__")[1] ?? "").slice(0, SHOWN_NAME_LIMIT));
  return doing("working", "editing", AGENT_ACTION.USING_TOOL, name.slice(0, SHOWN_NAME_LIMIT));
}
