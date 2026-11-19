import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClaudeEvent } from "../src/claude/claude-event.js";
import { normalizeCodexEvent } from "../src/codex/codex-event.js";
import { AGENT_ACTION } from "../src/office/domain/agent-actions.js";
import { createOfficeStore } from "../src/office/domain/office-store.js";

const SESSION = { session_id: "s1", cwd: "C:\\projetos\\orquestra" };
const MAIN_KEY = "claude:s1";
const SUBJECT_LIMIT = { command: 24, agentType: 40, toolName: 30 };

const claude = (hook, extra = {}, at = 1_000) => normalizeClaudeEvent({ ...SESSION, hook_event_name: hook, ...extra }, at);
const tool = (name, input = {}) => claude("PreToolUse", { tool_name: name, tool_input: input });
const actionOf = (event) => ({ actionId: event.actionId, subject: event.subject });

const reported = [
  ["opening a session", claude("SessionStart"), AGENT_ACTION.SESSION_OPENED, null],
  ["resuming a session", claude("SessionStart", { source: "resume" }), AGENT_ACTION.SESSION_RESUMED, null],
  ["receiving a prompt", claude("UserPromptSubmit", { prompt: "secret plan" }), AGENT_ACTION.PROMPT_RECEIVED, null],
  ["reading a file", tool("Read", { file_path: "C:\\repo\\docs\\README.md" }), AGENT_ACTION.READING, "README.md"],
  ["searching the code", tool("Grep", { pattern: "x" }), AGENT_ACTION.READING, null],
  ["editing a file", tool("Edit", { file_path: "/repo/src/secret.rs", old_string: "API_KEY=abc" }), AGENT_ACTION.EDITING, "secret.rs"],
  ["writing a notebook", tool("NotebookEdit", { notebook_path: "/repo/a.ipynb" }), AGENT_ACTION.EDITING, "a.ipynb"],
  ["writing without a path", tool("Write", {}), AGENT_ACTION.EDITING, null],
  ["running a command", tool("Bash", { command: "curl -H 'Authorization: Bearer xyz' https://x" }), AGENT_ACTION.RUNNING, "curl"],
  ["running a program by its path", tool("PowerShell", { command: "C:\\tools\\node.exe run.js" }), AGENT_ACTION.RUNNING, "node.exe"],
  ["running nothing named", tool("Bash", {}), AGENT_ACTION.RUNNING, null],
  ["delegating to a subagent", tool("Agent", { subagent_type: "code-reviewer", prompt: "secret" }), AGENT_ACTION.DELEGATING, "code-reviewer"],
  ["delegating to nobody named", tool("Task", {}), AGENT_ACTION.DELEGATING, null],
  ["asking a question", tool("AskUserQuestion"), AGENT_ACTION.ASKING_QUESTION, null],
  ["asking to approve a plan", tool("ExitPlanMode"), AGENT_ACTION.ASKING_PLAN_APPROVAL, null],
  ["updating the todo list", tool("TodoWrite"), AGENT_ACTION.UPDATING_TODOS, null],
  ["searching the web", tool("WebFetch", { url: "https://x" }), AGENT_ACTION.SEARCHING_WEB, null],
  ["using a connector", tool("mcp__notion__search"), AGENT_ACTION.USING_CONNECTOR, "notion"],
  ["using a connector with no server name", tool("mcp__"), AGENT_ACTION.USING_CONNECTOR, null],
  ["using another tool", tool("SlashCommand"), AGENT_ACTION.USING_TOOL, "SlashCommand"],
  ["using a tool with no name", tool(""), AGENT_ACTION.USING_TOOL, null],
  ["failing with a tool", claude("PostToolUseFailure", { tool_name: "Edit", error: "boom" }), AGENT_ACTION.TOOL_FAILED, "Edit"],
  ["failing with an unnamed tool", claude("PostToolUseFailure", {}), AGENT_ACTION.TOOL_FAILED, null],
  ["asking permission", claude("PermissionRequest", { tool_name: "Bash" }), AGENT_ACTION.PERMISSION_REQUESTED, "Bash"],
  ["asking permission for an unnamed tool", claude("PermissionRequest", {}), AGENT_ACTION.PERMISSION_REQUESTED, null],
  ["needing you in the terminal", claude("Notification", { notification_type: "elicitation_dialog" }), AGENT_ACTION.NEEDS_YOU_IN_TERMINAL, null],
  ["waiting for your reply", claude("Notification", { notification_type: "idle_prompt" }), AGENT_ACTION.WAITING_FOR_REPLY, null],
  ["finishing a turn", claude("Stop"), AGENT_ACTION.TURN_FINISHED, null],
  ["stopping on an API error", claude("StopFailure"), AGENT_ACTION.API_ERROR, null],
  ["starting a task", claude("SubagentStart", { agent_id: "a1", agent_type: "Explore" }), AGENT_ACTION.TASK_STARTED, null],
  ["delivering a task", claude("SubagentStop", { agent_id: "a1", agent_type: "Explore" }), AGENT_ACTION.TASK_DELIVERED, null],
  ["closing the session", claude("SessionEnd"), AGENT_ACTION.SESSION_CLOSED, null],
];

for (const [what, event, actionId, subject] of reported) {
  test(`a Claude Code event for ${what} names the action as ${actionId}${subject ? ` about ${subject}` : ""}`, () => {
    assert.deepEqual(actionOf(event), { actionId, subject });
  });
}

test("plain progress after a tool names no action", () => {
  assert.deepEqual(actionOf(claude("PostToolUse", { tool_name: "Bash" })), { actionId: null, subject: null });
});

test("a long program, subagent type or tool name is cut before it becomes the subject", () => {
  const long = (letter) => letter.repeat(200);
  assert.equal(tool("Bash", { command: long("p") }).subject, long("p").slice(0, SUBJECT_LIMIT.command));
  assert.equal(tool("Agent", { subagent_type: long("a") }).subject, long("a").slice(0, SUBJECT_LIMIT.agentType));
  assert.equal(tool(long("T")).subject, long("T").slice(0, SUBJECT_LIMIT.toolName));
  assert.equal(claude("PermissionRequest", { tool_name: long("P") }).subject, long("P").slice(0, SUBJECT_LIMIT.toolName));
});

test("a finished Codex turn names the action as waiting for you after the turn", () => {
  const event = normalizeCodexEvent({ type: "agent-turn-complete", "thread-id": "t1", cwd: "/home/dev/loja" }, 1);
  assert.deepEqual(actionOf(event), { actionId: AGENT_ACTION.TURN_FINISHED_WAITING, subject: null });
});

const mainAgentIn = (store) => Object.values(store.snapshot().projects)[0].agents[MAIN_KEY];

test("a new agent starts with no action named", () => {
  const store = createOfficeStore();
  store.apply(claude("PostToolUse"));
  assert.deepEqual(actionOf(mainAgentIn(store)), { actionId: null, subject: null });
});

test("the agent and its log keep the action and subject of each event", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart", {}, 1_000));
  store.apply(claude("PreToolUse", { tool_name: "Read", tool_input: { file_path: "/repo/a.md" } }, 2_000));
  const agent = mainAgentIn(store);
  assert.deepEqual(actionOf(agent), { actionId: AGENT_ACTION.READING, subject: "a.md" });
  assert.deepEqual(agent.log.map(({ at, actionId, subject }) => ({ at, actionId, subject })), [
    { at: 1_000, actionId: AGENT_ACTION.SESSION_OPENED, subject: null },
    { at: 2_000, actionId: AGENT_ACTION.READING, subject: "a.md" },
  ]);
});

test("plain progress keeps the action and the log as they were", () => {
  const store = createOfficeStore();
  store.apply(claude("PreToolUse", { tool_name: "Bash", tool_input: { command: "npm install" } }, 1_000));
  store.apply(claude("PostToolUse", { tool_name: "Bash" }, 2_000));
  const agent = mainAgentIn(store);
  assert.deepEqual(actionOf(agent), { actionId: AGENT_ACTION.RUNNING, subject: "npm" });
  assert.equal(agent.log.length, 1);
});

test("no event carries a ready-made phrase, only the action and its subject", () => {
  for (const [what, event] of reported) assert.equal(event.action, undefined, what);
  assert.equal(normalizeCodexEvent({ type: "agent-turn-complete", "thread-id": "t1", cwd: "/repo" }, 1).action, undefined);
});

test("the agent and its log keep no ready-made phrase", () => {
  const store = createOfficeStore();
  store.apply(claude("PreToolUse", { tool_name: "Read", tool_input: { file_path: "/repo/a.md" } }));
  const agent = mainAgentIn(store);
  assert.equal(agent.action, undefined);
  assert.deepEqual(agent.log.map((entry) => entry.text), [undefined]);
});
