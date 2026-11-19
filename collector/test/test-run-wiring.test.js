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

function officeThroughHooks() {
  const store = createOfficeStore();
  const activity = createRecordActivity({ store, history: createSessionHistory(), parseTestOutput });
  const send = (hook, extra, at) => {
    const payload = { ...SESSION, hook_event_name: hook, ...extra };
    activity.record(normalizeClaudeEvent(payload, at), claudeHistoryEntry(payload, at));
  };
  return { send, agent: () => store.findAgent("claude:s1") };
}

function runThroughHooks(command, stdout) {
  const office = officeThroughHooks();
  office.send("PreToolUse", bash(command), AT);
  office.send("PostToolUse", { ...bash(command), tool_response: { stdout, stderr: "", interrupted: false } }, AT + 3_000);
  return office.agent();
}

// Claude Code's Bash response carries stdout, stderr, interrupted and isImage, never an exit code: a command that exits
// with an error reaches the office as PostToolUseFailure, with the output in the error text.
test("a test command that fails with output the parser cannot read is a failed run", () => {
  const office = officeThroughHooks();
  office.send("PreToolUse", bash("npm test"), AT);
  office.send("PostToolUseFailure", { ...bash("npm test"), error: "Exit code 1\nnpm ERR! Missing script: \"test\"" }, AT + 3_000);
  const { tests, actionId, subject } = office.agent();
  assert.deepEqual([tests.lastRun.isOk, tests.lastRun.passed, tests.lastRun.failed], [false, null, null]);
  assert.deepEqual([actionId, subject], [AGENT_ACTION.TESTS_FAILED, null]);
});

test("a test command that ends well with output the parser cannot read is a passed run", () => {
  const office = officeThroughHooks();
  office.send("PreToolUse", bash("npm test"), AT);
  office.send("PostToolUse", { ...bash("npm test"), tool_response: { stdout: "all good", stderr: "", interrupted: false, isImage: false } }, AT + 3_000);
  const { tests, actionId } = office.agent();
  assert.deepEqual([tests.lastRun.isOk, tests.lastRun.passed, actionId], [true, null, AGENT_ACTION.TESTS_PASSED]);
});

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
