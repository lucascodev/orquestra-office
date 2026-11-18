import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClaudeEvent } from "../src/claude/claude-event.js";
import { claudeHistoryEntry } from "../src/claude/claude-history-entry.js";
import { normalizeStatusline } from "../src/claude/statusline-reading.js";

const base = { session_id: "s1", cwd: "C:\\projetos\\orquestra" };

test("pre tool use on edit becomes working with the file name only", () => {
  const e = normalizeClaudeEvent({ ...base, hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "C:\\x\\src\\secret.rs", old_string: "API_KEY=abc" } }, 1);
  assert.equal(e.status, "working");
  assert.deepEqual([e.actionId, e.subject], ["editing", "secret.rs"]);
  assert.ok(!JSON.stringify(e).includes("API_KEY"));
});

test("bash keeps only the program name, never the arguments", () => {
  const e = normalizeClaudeEvent({ ...base, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "curl -H 'Authorization: Bearer xyz' https://x" } }, 1);
  assert.deepEqual([e.actionId, e.subject], ["running", "curl"]);
});

test("prompt text never reaches the event", () => {
  const e = normalizeClaudeEvent({ ...base, hook_event_name: "UserPromptSubmit", prompt: "my password is hunter2" }, 1);
  assert.ok(!JSON.stringify(e).includes("hunter2"));
});

test("permission request and questions need the user", () => {
  assert.equal(normalizeClaudeEvent({ ...base, hook_event_name: "PermissionRequest", tool_name: "Bash" }, 1).status, "needs_you");
  assert.equal(normalizeClaudeEvent({ ...base, hook_event_name: "PreToolUse", tool_name: "AskUserQuestion", tool_input: {} }, 1).status, "needs_you");
  assert.equal(normalizeClaudeEvent({ ...base, hook_event_name: "Notification", notification_type: "permission_prompt" }, 1).status, "needs_you");
});

test("events inside a subagent carry its id and type", () => {
  const e = normalizeClaudeEvent({ ...base, hook_event_name: "PreToolUse", agent_id: "a9", agent_type: "Explore", tool_name: "Grep", tool_input: {} }, 1);
  assert.equal(e.agentId, "a9");
  assert.equal(e.agentType, "Explore");
  assert.equal(e.status, "reviewing");
});

test("unknown or invalid payloads are ignored", () => {
  assert.equal(normalizeClaudeEvent(null), null);
  assert.equal(normalizeClaudeEvent({ hook_event_name: "Stop" }), null);
  assert.equal(normalizeClaudeEvent({ ...base, hook_event_name: "ConfigChange" }), null);
});

const PATH_LIMIT = 400;
const SESSION_ID_LIMIT = 128;
const HUGE_CWD = "C:\\".padEnd(1_200_000, "x");
const LONG_SESSION_ID = "s".repeat(SESSION_ID_LIMIT * 4);

test("a huge cwd and a long session id are cut, so one hook cannot blow up every frame of the office", () => {
  const e = normalizeClaudeEvent({ session_id: LONG_SESSION_ID, cwd: HUGE_CWD, hook_event_name: "SessionStart" }, 1);
  assert.equal(e.cwd, HUGE_CWD.slice(0, PATH_LIMIT));
  assert.equal(e.sessionId, LONG_SESSION_ID.slice(0, SESSION_ID_LIMIT));
});

test("a long session id is cut the same way for the history and the usage reading, so they still find the agent", () => {
  const payload = { session_id: LONG_SESSION_ID, cwd: "/tmp/demo", hook_event_name: "UserPromptSubmit", prompt: "go" };
  const { sessionId } = normalizeClaudeEvent(payload, 1);
  assert.equal(claudeHistoryEntry(payload, 1).agentKey, `claude:${sessionId}`);
  assert.equal(normalizeStatusline({ session_id: LONG_SESSION_ID }, 1).sessionId, sessionId);
});
