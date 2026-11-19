import { test } from "node:test";
import assert from "node:assert/strict";
import { claudeHistoryEntry } from "../src/claude/claude-history-entry.js";
import { normalizeClaudeEvent } from "../src/claude/claude-event.js";
import { createSessionHistory } from "../src/history/session-history.js";
import { createRecordActivity } from "../src/office/application/record-activity.js";
import { AGENT_ACTION } from "../src/office/domain/agent-actions.js";
import { createOfficeStore } from "../src/office/domain/office-store.js";
import { parseTestOutput } from "../src/work/domain/test-output.js";
import { readTestOutputFixture } from "./support/test-output-fixture.js";

const AT = Date.UTC(2026, 10, 19, 15, 0);
const SESSION = { session_id: "s1", cwd: "/home/dev/app" };
const bash = (command) => ({ tool_name: "Bash", tool_use_id: "t1", tool_input: { command } });

function runThroughHooks(command, stdout) {
  const store = createOfficeStore();
  const activity = createRecordActivity({ store, history: createSessionHistory(), parseTestOutput });
  const send = (hook, extra, at) => {
    const payload = { ...SESSION, hook_event_name: hook, ...extra };
    activity.record(normalizeClaudeEvent(payload, at), claudeHistoryEntry(payload, at));
  };
  send("PreToolUse", bash(command), AT);
  send("PostToolUse", { ...bash(command), tool_response: { stdout, stderr: "", interrupted: false } }, AT + 3_000);
  return store.findAgent("claude:s1");
}

test("the real output parser turns a vitest run reported by the hooks into counts and named failures", () => {
  const agent = runThroughHooks("npx vitest run", readTestOutputFixture("vitest/vitest3-failures.txt"));

  assert.equal(agent.actionId, AGENT_ACTION.TESTS_FAILED);
  assert.deepEqual([agent.tests.lastRun.framework, agent.tests.lastRun.passed, agent.tests.lastRun.failed, agent.tests.lastRun.isOk], ["vitest", 5, 2, false]);
  assert.equal(agent.tests.lastRun.failures.length, 2);
  assert.ok(agent.tests.lastRun.failures.every((failure) => failure.name));
});

test("a node --test run keeps the framework id the parser and the command reader share", () => {
  const agent = runThroughHooks("node --test", readTestOutputFixture("node-test/spec-passing.txt"));

  assert.deepEqual([agent.tests.lastRun.framework, agent.tests.lastRun.passed, agent.tests.lastRun.isOk], ["node-test", 3, true]);
  assert.equal(agent.actionId, AGENT_ACTION.TESTS_PASSED);
});
