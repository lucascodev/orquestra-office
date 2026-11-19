import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeHistoryEntry } from "../src/claude/claude-history-entry.js";
import { normalizeClaudeEvent } from "../src/claude/claude-event.js";
import { createSessionHistory } from "../src/history/session-history.js";
import { createRecordActivity } from "../src/office/application/record-activity.js";
import { createOfficeStore } from "../src/office/domain/office-store.js";
import { createOfficeStateFile } from "../src/office/infra/office-state-file.js";

const ROOT = "/home/dev/app";
const MAIN_KEY = "claude:s1";
const AT = Date.UTC(2026, 10, 19, 12, 0);
const FAILURE_MESSAGE = "expected the vault password to match";
const CHECKLIST_TEXT = "Rotate the staging credentials";
const PLAN_TEXT = "# Plan\nMove the billing worker";
const FINISHED_COMMAND = "npx jest --runInBand invoices";
const RUNNING_COMMAND = "npx vitest run receipts";
const FAILING = { framework: "jest", passed: 1, failed: 1, skipped: 0, failures: [{ name: "bills", location: "src/bill.test.js:3", message: FAILURE_MESSAGE }] };

async function withDataDir(run) {
  const dir = await mkdtemp(join(tmpdir(), "office-work-persistence-"));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

function busyStore() {
  const store = createOfficeStore();
  const activity = createRecordActivity({ store, history: createSessionHistory(), parseTestOutput: () => FAILING });
  const send = (hook, extra) => {
    const payload = { session_id: "s1", cwd: ROOT, hook_event_name: hook, ...extra };
    activity.record(normalizeClaudeEvent(payload, AT), claudeHistoryEntry(payload, AT));
  };
  send("PostToolUse", { tool_name: "TodoWrite", tool_use_id: "w1", tool_input: { todos: [{ content: CHECKLIST_TEXT, status: "pending", activeForm: CHECKLIST_TEXT }] } });
  send("PreToolUse", { tool_name: "ExitPlanMode", tool_use_id: "p1", tool_input: { plan: PLAN_TEXT } });
  send("PostToolUse", { tool_name: "Bash", tool_use_id: "b1", tool_input: { command: FINISHED_COMMAND }, tool_response: { stdout: "Tests: 1 failed" } });
  send("PreToolUse", { tool_name: "Bash", tool_use_id: "b2", tool_input: { command: RUNNING_COMMAND } });
  return store;
}

test("the saved state keeps the counts of the tests but no checklist, plan or failure text", () => withDataDir(async (dir) => {
  createOfficeStateFile(dir).saveNow(busyStore().snapshot());
  const saved = await readFile(join(dir, "office.json"), "utf8");
  for (const text of [FAILURE_MESSAGE, CHECKLIST_TEXT, PLAN_TEXT, "billing"]) assert.ok(!saved.includes(text), text);
  const agent = JSON.parse(saved).projects[ROOT].agents[MAIN_KEY];
  assert.equal(agent.checklist, undefined);
  assert.deepEqual([agent.tests.lastRun.failed, agent.tests.lastRun.failures], [1, []]);
  assert.deepEqual([agent.plan.version, agent.plan.state], [1, "proposed"]);
}));

// A command line may carry a credential the redaction did not recognize, so none of them reaches the disk.
test("the saved state keeps the framework and counts of the runs but no command, finished or still running", () => withDataDir(async (dir) => {
  createOfficeStateFile(dir).saveNow(busyStore().snapshot());
  const saved = await readFile(join(dir, "office.json"), "utf8");
  for (const command of [FINISHED_COMMAND, RUNNING_COMMAND]) assert.ok(!saved.includes(command), command);
  const { tests } = JSON.parse(saved).projects[ROOT].agents[MAIN_KEY];
  assert.equal(tests.running, null);
  assert.deepEqual(Object.keys(tests.lastRun).includes("command"), false);
  assert.deepEqual([tests.lastRun.framework, tests.lastRun.failed], ["jest", 1]);
  assert.deepEqual(tests.runsToday.map((run) => [Object.keys(run).includes("label"), run.framework, run.failed]), [[false, "jest", 1]]);
}));

test("saving leaves the running office as it was", () => withDataDir(async (dir) => {
  const store = busyStore();
  createOfficeStateFile(dir).saveNow(store.snapshot());
  const agent = store.findAgent(MAIN_KEY);
  assert.equal(agent.checklist.items[0].text, CHECKLIST_TEXT);
  assert.deepEqual([agent.tests.running.command, agent.tests.lastRun.command, agent.tests.runsToday[0].label], [RUNNING_COMMAND, FINISHED_COMMAND, FINISHED_COMMAND]);
}));

test("an agent loaded from the saved state takes new runs and tasks", () => withDataDir(async (dir) => {
  createOfficeStateFile(dir).saveNow(busyStore().snapshot());
  const store = createOfficeStore(createOfficeStateFile(dir).load());
  const activity = createRecordActivity({ store, history: createSessionHistory(), parseTestOutput: () => null });
  const send = (hook, extra) => activity.record(normalizeClaudeEvent({ session_id: "s1", cwd: ROOT, hook_event_name: hook, ...extra }, AT + 1), null);
  send("PostToolUse", { tool_name: "Bash", tool_use_id: "b3", tool_input: { command: "npx jest" }, tool_response: { stdout: "" } });
  send("PostToolUse", { tool_name: "TaskCreate", tool_use_id: "c1", tool_input: { subject: "New task" }, tool_response: { task: { id: "1" } } });
  const agent = store.findAgent(MAIN_KEY);
  assert.deepEqual(agent.tests.runsToday.length, 2);
  assert.deepEqual(agent.checklist.items.map((item) => item.text), ["New task"]);
  assert.equal(store.planOf(MAIN_KEY), null);
}));
