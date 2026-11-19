import { EDIT_TOOLS, PLAN_TOOL, SHELL_TOOLS, WRITE_TOOLS } from "../../shared/claude/tool-names.js";
import { projectPathOf } from "../../shared/path/project-path.js";
import { scriptCommandOf } from "../../work/domain/commands/script-command.js";
import { testCommandOf } from "../../work/domain/commands/test-command.js";
import { planTextOf } from "../../work/domain/plan-text.js";
import { FILE_ACTION } from "../../work/domain/tests/file-actions.js";
import { isTestFile } from "../../work/domain/tests/test-file.js";
import { WORK_UPDATE } from "../../work/domain/work-update.js";
import { failureOutputOf, isShellCallOk, shellOutputOf } from "./shell-call.js";
import { taskIdOf } from "./task-id.js";

const READ_FILE_TOOLS = new Set(["Read", "NotebookRead"]);
const WRITE_TOOL = "Write";
const CREATED_FILE = "create";

const isBackground = (input) => input?.run_in_background === true;

function shellStarted(input, toolUseId) {
  return { type: WORK_UPDATE.SHELL_STARTED, toolUseId, test: testCommandOf(input?.command), isBackground: isBackground(input) };
}

// Only the output of a test command or of a script that may run the tests is read, and never one running in the background.
function shellFinished(input, toolUseId, { output, isCallOk }) {
  const inBackground = isBackground(input);
  const test = inBackground ? null : testCommandOf(input?.command);
  const script = inBackground || test ? null : scriptCommandOf(input?.command);
  return { type: WORK_UPDATE.SHELL_FINISHED, toolUseId, test, script, output: test || script ? output() : "", isCallOk, isBackground: inBackground };
}

function fileActionOf(toolName, response) {
  if (READ_FILE_TOOLS.has(toolName)) return FILE_ACTION.READ;
  if (toolName === WRITE_TOOL && response?.type === CREATED_FILE) return FILE_ACTION.CREATED;
  return EDIT_TOOLS.has(toolName) || WRITE_TOOLS.has(toolName) ? FILE_ACTION.EDITED : null;
}

function fileTouched(toolName, input, response, root) {
  const action = fileActionOf(toolName, response);
  const path = projectPathOf(input?.file_path ?? input?.notebook_path, root);
  return action && isTestFile(path) ? { type: WORK_UPDATE.FILE_TOUCHED, path, action } : null;
}

function plan(type, input) {
  const written = planTextOf(input?.plan);
  return written ? { type, plan: written } : null;
}

function started(toolName, input, toolUseId) {
  if (SHELL_TOOLS.has(toolName)) return shellStarted(input, toolUseId);
  if (toolName === PLAN_TOOL) return plan(WORK_UPDATE.PLAN_PROPOSED, input);
  return null;
}

function finished(toolName, input, response, toolUseId, root) {
  if (SHELL_TOOLS.has(toolName)) return shellFinished(input, toolUseId, { output: () => shellOutputOf(response), isCallOk: isShellCallOk(response) });
  if (toolName === PLAN_TOOL) return plan(WORK_UPDATE.PLAN_APPROVED, input);
  if (toolName === "TodoWrite") return { type: WORK_UPDATE.TODOS_WRITTEN, todos: input?.todos };
  if (toolName === "TaskCreate") return { type: WORK_UPDATE.TASK_CREATED, id: taskIdOf(response), text: input?.subject, activeText: input?.activeForm };
  if (toolName === "TaskUpdate") return { type: WORK_UPDATE.TASK_UPDATED, id: input?.taskId, status: input?.status, text: input?.subject, activeText: input?.activeForm };
  return fileTouched(toolName, input, response, root);
}

function failed(toolName, input, error, toolUseId) {
  if (!SHELL_TOOLS.has(toolName)) return null;
  return shellFinished(input, toolUseId, { output: () => failureOutputOf(error), isCallOk: false });
}

// What a tool call changed in the agent's checklist, plan or tests, or null when it changed none of them.
export function claudeWorkOf(payload, { toolUseId, root }) {
  const toolName = String(payload.tool_name ?? "");
  const input = payload.tool_input;
  switch (payload.hook_event_name) {
    case "PreToolUse":
      return started(toolName, input, toolUseId);
    case "PostToolUse":
      return finished(toolName, input, payload.tool_response, toolUseId, root);
    case "PostToolUseFailure":
      return failed(toolName, input, payload.error, toolUseId);
    default:
      return null;
  }
}
