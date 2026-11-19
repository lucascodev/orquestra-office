import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClaudeEvent } from "../src/claude/claude-event.js";
import { claudeHistoryEntry } from "../src/claude/claude-history-entry.js";
import { createSessionHistory } from "../src/history/session-history.js";
import { createRecordActivity } from "../src/office/application/record-activity.js";
import { createOfficeStore } from "../src/office/domain/office-store.js";

const SESSION = { session_id: "s1", cwd: "/home/dev/loja" };
const READ = { tool_name: "Read", tool_input: { file_path: "/home/dev/loja/a.md" } };
const EDIT = { tool_name: "Edit", tool_input: { file_path: "/home/dev/loja/b.js" } };

function office() {
  const store = createOfficeStore();
  const history = createSessionHistory();
  const activity = createRecordActivity({ store, history });
  let at = 1_000;
  const send = (hookEventName, extra = {}) => {
    at += 1;
    const payload = { ...SESSION, hook_event_name: hookEventName, ...extra };
    activity.record(normalizeClaudeEvent(payload, at), claudeHistoryEntry(payload, at));
  };
  return { send, agent: () => store.findAgent("claude:s1"), history: () => history.of("claude:s1") };
}

test("the event of a tool carries its tool_use_id", () => {
  const event = normalizeClaudeEvent({ ...SESSION, hook_event_name: "PostToolUse", tool_use_id: "toolu_1", ...READ }, 1);

  assert.equal(event.toolUseId, "toolu_1");
  assert.equal(normalizeClaudeEvent({ ...SESSION, hook_event_name: "PreToolUse", ...READ }, 1).toolUseId, null);
});

test("a PreToolUse arriving after the PostToolUse of the same call leaves the status alone", () => {
  const { send, agent } = office();
  send("UserPromptSubmit", { prompt: "go" });
  send("PostToolUse", { tool_use_id: "toolu_1", ...READ });
  const before = agent();

  send("PreToolUse", { tool_use_id: "toolu_1", ...READ });

  assert.equal(agent().status, before.status);
  assert.equal(agent().activity, before.activity);
  assert.equal(agent().action, before.action);
  assert.equal(agent().actionId, before.actionId);
  assert.equal(agent().subject, before.subject);
  assert.equal(agent().status, "working");
});

test("a PreToolUse arriving after its PostToolUseFailure leaves the status alone too", () => {
  const { send, agent } = office();
  send("PostToolUseFailure", { tool_use_id: "toolu_1", ...READ, error: "boom" });

  send("PreToolUse", { tool_use_id: "toolu_1", ...READ });

  assert.equal(agent().activity, "failed");
});

test("the history keeps both entries of a call that arrived out of order", () => {
  const { send, history } = office();
  send("PostToolUseFailure", { tool_use_id: "toolu_1", ...READ, error: "boom" });
  send("PreToolUse", { tool_use_id: "toolu_1", ...READ });

  assert.deepEqual(history().map((entry) => entry.kind), ["error", "tool"]);
});

test("a PostToolUse of a call started before the turn ended does not bring the agent back to work", () => {
  const { send, agent } = office();
  send("UserPromptSubmit", { prompt: "go" });
  send("PreToolUse", { tool_use_id: "toolu_1", ...READ });
  send("Stop");

  send("PostToolUse", { tool_use_id: "toolu_1", ...READ });

  assert.equal(agent().status, "break");
});

test("a failure of a call started before the turn ended does not bring the agent back to work", () => {
  const { send, agent } = office();
  send("PreToolUse", { tool_use_id: "toolu_1", ...READ });
  send("Stop");

  send("PostToolUseFailure", { tool_use_id: "toolu_1", ...READ, error: "boom" });

  assert.equal(agent().status, "break");
  assert.equal(agent().activity, "reading");
});

test("a new call after a Stop that let the agent go on still counts as work", () => {
  const { send, agent } = office();
  send("PreToolUse", { tool_use_id: "toolu_1", ...READ });
  send("PostToolUse", { tool_use_id: "toolu_1", ...READ });
  send("Stop");

  send("PreToolUse", { tool_use_id: "toolu_2", ...EDIT });

  assert.equal(agent().status, "working");
  assert.equal(agent().activity, "editing");
});

test("calls in order keep working as before", () => {
  const { send, agent } = office();
  send("PreToolUse", { tool_use_id: "toolu_1", ...READ });
  assert.equal(agent().activity, "reading");

  send("PostToolUse", { tool_use_id: "toolu_1", ...READ });
  send("PreToolUse", { tool_use_id: "toolu_2", ...EDIT });

  assert.equal(agent().activity, "editing");
  assert.equal(agent().tools, 2);
});
