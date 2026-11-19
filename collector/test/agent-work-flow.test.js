import { test } from "node:test";
import assert from "node:assert/strict";
import { claudeHistoryEntry } from "../src/claude/claude-history-entry.js";
import { normalizeClaudeEvent } from "../src/claude/claude-event.js";
import { createSessionHistory } from "../src/history/session-history.js";
import { createRecordActivity } from "../src/office/application/record-activity.js";
import { AGENT_ACTION } from "../src/office/domain/agent-actions.js";
import { createOfficeStore } from "../src/office/domain/office-store.js";

const ROOT = "/home/dev/app";
const SESSION = { session_id: "s1", cwd: ROOT };
const MAIN_KEY = "claude:s1";
const DAY = Date.UTC(2026, 10, 19, 23, 50);
const NEXT_DAY = Date.UTC(2026, 10, 20, 0, 10);
const OUTPUT_TAIL_LIMIT = 64 * 1024;
const FAILING = { framework: "vitest", passed: 248, failed: 2, skipped: 0, failures: [{ name: "adds", location: `${ROOT}/src/calc.test.ts:12:5`, message: "expected 3 to be 4" }] };
const PASSING = { framework: "vitest", passed: 250, failed: 0, skipped: 0, failures: [] };

function officeWith(parseTestOutput = () => null) {
  const store = createOfficeStore();
  const outputs = [];
  const parse = (output) => {
    outputs.push(output);
    return parseTestOutput(output);
  };
  const activity = createRecordActivity({ store, history: createSessionHistory(), parseTestOutput: parse });
  const send = (hook, extra = {}, at = DAY) => {
    const payload = { ...SESSION, hook_event_name: hook, ...extra };
    activity.record(normalizeClaudeEvent(payload, at), claudeHistoryEntry(payload, at));
  };
  return { store, send, outputs, agent: () => store.findAgent(MAIN_KEY) };
}

const bash = (command, toolUseId = "t1", extra = {}) => ({ tool_name: "Bash", tool_use_id: toolUseId, tool_input: { command, ...extra } });
const output = (stdout, stderr = "") => ({ tool_response: { stdout, stderr, interrupted: false, isImage: false } });
const summaryBy = (byText) => (text) => Object.entries(byText).find(([marker]) => text.includes(marker))?.[1] ?? null;

test("a test command shows as running from its start, with when it started", () => {
  const office = officeWith();
  office.send("PreToolUse", bash("cd web && npx vitest run"), DAY);
  const agent = office.agent();
  assert.deepEqual([agent.actionId, agent.subject], [AGENT_ACTION.RUNNING_TESTS, "vitest"]);
  assert.deepEqual(agent.tests.running, { command: "npx vitest run", framework: "vitest", startedAt: DAY });
});

test("a test command with no known framework names the program it ran", () => {
  const office = officeWith();
  office.send("PreToolUse", bash("npm test"));
  assert.deepEqual([office.agent().actionId, office.agent().subject], [AGENT_ACTION.RUNNING_TESTS, "npm"]);
});

test("a failing run ends with its counts, failures, duration and a tests-failed entry in the log", () => {
  const office = officeWith(summaryBy({ "2 failed": FAILING }));
  office.send("PreToolUse", bash("npx vitest run"), DAY);
  office.send("PostToolUse", { ...bash("npx vitest run"), ...output("Tests  2 failed | 248 passed (250)") }, DAY + 12_000);
  const { tests, actionId, subject, log } = office.agent();
  assert.equal(tests.running, null);
  assert.deepEqual(tests.lastRun, {
    command: "npx vitest run", framework: "vitest", startedAt: DAY, finishedAt: DAY + 12_000, durationMs: 12_000,
    isOk: false, passed: 248, failed: 2, skipped: 0, failures: [{ name: "adds", location: "src/calc.test.ts:12:5", message: "expected 3 to be 4" }],
  });
  assert.deepEqual([actionId, subject], [AGENT_ACTION.TESTS_FAILED, 2]);
  assert.deepEqual(log.at(-1), { at: DAY + 12_000, actionId: AGENT_ACTION.TESTS_FAILED, subject: 2 });
});

test("a passing run logs tests-passed with how many passed", () => {
  const office = officeWith(summaryBy({ "250 passed": PASSING }));
  office.send("PreToolUse", bash("npx vitest run"));
  office.send("PostToolUse", { ...bash("npx vitest run"), ...output("Tests  250 passed (250)") }, DAY + 1);
  assert.deepEqual([office.agent().actionId, office.agent().subject, office.agent().tests.lastRun.isOk], [AGENT_ACTION.TESTS_PASSED, 250, true]);
});

test("a test command that fails with no summary is a failed run with unknown counts", () => {
  const office = officeWith();
  office.send("PreToolUse", bash("npm test"));
  office.send("PostToolUseFailure", { ...bash("npm test"), error: "Exit code 1\nsomething broke" }, DAY + 1);
  const { tests, actionId, subject } = office.agent();
  assert.deepEqual([tests.lastRun.isOk, tests.lastRun.passed, tests.lastRun.failed], [false, null, null]);
  assert.deepEqual([actionId, subject], [AGENT_ACTION.TESTS_FAILED, null]);
});

test("the failure output of a test command is what the parser reads", () => {
  const office = officeWith(summaryBy({ "2 failed": FAILING }));
  office.send("PostToolUseFailure", { ...bash("npx vitest run"), error: "Exit code 1\nTests  2 failed | 248 passed (250)" });
  assert.equal(office.agent().tests.lastRun.failed, 2);
});

test("an interrupted test command with no summary is a failed run", () => {
  const office = officeWith();
  office.send("PostToolUse", { ...bash("pytest"), tool_response: { stdout: "", stderr: "", interrupted: true } });
  assert.equal(office.agent().tests.lastRun.isOk, false);
});

test("a test command that exits with an error code and no summary is a failed run", () => {
  const office = officeWith();
  office.send("PostToolUse", { ...bash("pytest"), tool_response: { stdout: "boom", exitCode: 2 } });
  assert.equal(office.agent().tests.lastRun.isOk, false);
});

test("a script whose output has a test summary becomes a run", () => {
  const office = officeWith(summaryBy({ "250 passed": PASSING }));
  office.send("PostToolUse", { ...bash("npm run check"), ...output("lint ok\nTests  250 passed (250)") });
  assert.deepEqual([office.agent().tests.lastRun.command, office.agent().tests.lastRun.isOk], ["npm run check", true]);
});

test("a script whose output has no summary leaves the tests alone", () => {
  const office = officeWith();
  office.send("PostToolUse", { ...bash("npm run build"), ...output("built") });
  assert.equal(office.agent().tests, undefined);
  assert.equal(office.agent().actionId, null);
});

test("the output of a command that is neither a test nor a script never reaches the parser", () => {
  const office = officeWith(() => PASSING);
  office.send("PostToolUse", { ...bash("cat results.txt"), ...output("Tests  250 passed (250)") });
  assert.deepEqual(office.outputs, []);
  assert.equal(office.agent().tests, undefined);
});

test("the parser reads stdout and stderr together, only their last 64 KB", () => {
  const office = officeWith();
  office.send("PostToolUse", { ...bash("npx jest"), ...output("x".repeat(100_000), "Tests: 1 failed, 1 total") });
  const [read] = office.outputs;
  assert.equal(read.length, OUTPUT_TAIL_LIMIT);
  assert.ok(read.endsWith("Tests: 1 failed, 1 total"));
});

test("a test run in the background is not a run and does not show as running", () => {
  const office = officeWith(() => PASSING);
  office.send("PreToolUse", bash("npm test", "t1", { run_in_background: true }));
  assert.equal(office.agent().actionId, AGENT_ACTION.RUNNING_TESTS);
  assert.equal(office.agent().tests, undefined);
  office.send("PostToolUse", { ...bash("npm test", "t1", { run_in_background: true }), ...output("Command running in background with ID: b1") });
  assert.equal(office.agent().tests, undefined);
});

test("an end that arrives before its start still records the run, and the late start fills in the duration", () => {
  const office = officeWith(summaryBy({ "250 passed": PASSING }));
  office.send("PostToolUse", { ...bash("npx vitest run"), ...output("250 passed") }, DAY + 9_000);
  office.send("PreToolUse", bash("npx vitest run"), DAY);
  const { tests, actionId } = office.agent();
  assert.equal(tests.running, null);
  assert.deepEqual([tests.lastRun.startedAt, tests.lastRun.durationMs], [DAY, 9_000]);
  assert.equal(actionId, AGENT_ACTION.TESTS_PASSED);
});

test("the end of the turn clears a test whose end never arrived", () => {
  const office = officeWith();
  office.send("PreToolUse", bash("pytest"));
  office.send("Stop", {}, DAY + 1);
  assert.equal(office.agent().tests.running, null);
});

test("two tests running at once show the latest, and the other once the latest ends", () => {
  const office = officeWith();
  office.send("PreToolUse", bash("pytest", "t1"), DAY);
  office.send("PreToolUse", bash("npx jest", "t2"), DAY + 1);
  assert.equal(office.agent().tests.running.framework, "jest");
  office.send("PostToolUse", { ...bash("npx jest", "t2"), ...output("") }, DAY + 2);
  assert.equal(office.agent().tests.running.framework, "pytest");
});

test("the runs of the day start again when the sweep sees a new day", () => {
  const office = officeWith();
  office.send("PostToolUse", { ...bash("pytest"), ...output("") }, DAY);
  office.store.sweep(NEXT_DAY);
  assert.deepEqual(office.agent().tests.runsToday, []);
});

test("editing a test file is writing tests, and its end lists the file", () => {
  const office = officeWith();
  const edit = { tool_name: "Edit", tool_use_id: "e1", tool_input: { file_path: `${ROOT}/src/calc.test.ts`, old_string: "a", new_string: "b" } };
  office.send("PreToolUse", edit, DAY);
  assert.deepEqual([office.agent().actionId, office.agent().subject], [AGENT_ACTION.WRITING_TESTS, "calc.test.ts"]);
  office.send("PostToolUse", { ...edit, tool_response: { filePath: `${ROOT}/src/calc.test.ts` } }, DAY + 1);
  assert.deepEqual(office.agent().tests.files, [{ path: "src/calc.test.ts", action: "edited", at: DAY + 1, failed: null }]);
  assert.equal(office.agent().tests.lastTestFileAt, DAY + 1);
});

test("writing a new test file lists it as created", () => {
  const office = officeWith();
  office.send("PostToolUse", { tool_name: "Write", tool_use_id: "w1", tool_input: { file_path: `${ROOT}/tests/test_calc.py`, content: "x" }, tool_response: { type: "create" } });
  assert.equal(office.agent().tests.files[0].action, "created");
});

test("reading a test file lists it as read without marking test writing", () => {
  const office = officeWith();
  office.send("PostToolUse", { tool_name: "Read", tool_use_id: "r1", tool_input: { file_path: `${ROOT}/src/calc.spec.js` } });
  assert.deepEqual([office.agent().tests.files[0].action, office.agent().tests.lastTestFileAt], ["read", null]);
});

test("editing a source file is plain editing and lists nothing", () => {
  const office = officeWith();
  const edit = { tool_name: "Edit", tool_use_id: "e1", tool_input: { file_path: `${ROOT}/src/calc.ts` } };
  office.send("PreToolUse", edit);
  office.send("PostToolUse", edit);
  assert.equal(office.agent().actionId, AGENT_ACTION.EDITING);
  assert.equal(office.agent().tests, undefined);
});

test("a test folder in the user's home does not make every file a test file", () => {
  const office = officeWith();
  office.send("PreToolUse", { tool_name: "Edit", tool_use_id: "e1", tool_input: { file_path: "/home/test/app/src/calc.ts" } });
  assert.equal(office.agent().actionId, AGENT_ACTION.EDITING);
});

test("TodoWrite replaces the checklist", () => {
  const office = officeWith();
  const todos = [{ content: "Read", status: "completed", activeForm: "Reading" }, { content: "Write", status: "in_progress", activeForm: "Writing" }];
  office.send("PostToolUse", { tool_name: "TodoWrite", tool_use_id: "w1", tool_input: { todos } }, DAY);
  assert.deepEqual(office.agent().checklist, {
    items: [{ id: "1", text: "Read", status: "completed", activeText: "Reading" }, { id: "2", text: "Write", status: "in_progress", activeText: "Writing" }],
    updatedAt: DAY,
  });
});

const taskResponses = [
  ["a task object", { task: { id: "7", subject: "x" } }, "7"],
  ["a task id field", { taskId: 8 }, "8"],
  ["a text", "Task #9 created successfully: Write tests", "9"],
  ["a text field", { message: "Created task 10" }, "10"],
  ["a text with another number before the #", "1 task created as #12: Write tests", "12"],
];

for (const [what, response, id] of taskResponses) {
  test(`TaskCreate takes the id from ${what} in its response`, () => {
    const office = officeWith();
    office.send("PostToolUse", { tool_name: "TaskCreate", tool_use_id: "c1", tool_input: { subject: "Write tests", activeForm: "Writing tests" }, tool_response: response });
    assert.equal(office.agent().checklist.items[0].id, id);
  });
}

test("TaskCreate ignores a text response over 1 KB and numbers the task itself", () => {
  const office = officeWith();
  office.send("PostToolUse", { tool_name: "TaskCreate", tool_use_id: "c1", tool_input: { subject: "x" }, tool_response: `Task #5 ${"y".repeat(2_000)}` });
  assert.equal(office.agent().checklist.items[0].id, "1");
});

test("TaskUpdate changes a task and deletes it", () => {
  const office = officeWith();
  office.send("PostToolUse", { tool_name: "TaskCreate", tool_use_id: "c1", tool_input: { subject: "Write tests" }, tool_response: { task: { id: "1" } } });
  office.send("PostToolUse", { tool_name: "TaskUpdate", tool_use_id: "u1", tool_input: { taskId: "1", status: "in_progress" } });
  assert.equal(office.agent().checklist.items[0].status, "in_progress");
  office.send("PostToolUse", { tool_name: "TaskUpdate", tool_use_id: "u2", tool_input: { taskId: "1", status: "deleted" } });
  assert.deepEqual(office.agent().checklist.items, []);
});

test("a proposed plan is version 1 in the state, with its text only through planOf", () => {
  const office = officeWith();
  office.send("PreToolUse", { tool_name: "ExitPlanMode", tool_use_id: "p1", tool_input: { plan: "# Plan\n- step" } }, DAY);
  assert.deepEqual(office.agent().plan, { version: 1, state: "proposed", proposedAt: DAY, decidedAt: null, length: 13 });
  assert.ok(!JSON.stringify(office.store.snapshot()).includes("step"));
  assert.deepEqual(office.store.planOf(MAIN_KEY), { text: "# Plan\n- step", version: 1, state: "proposed", proposedAt: DAY, decidedAt: null });
});

test("the end of ExitPlanMode approves the plan and logs it", () => {
  const office = officeWith();
  const exit = { tool_name: "ExitPlanMode", tool_use_id: "p1", tool_input: { plan: "# Plan" } };
  office.send("PreToolUse", exit, DAY);
  office.send("PostToolUse", exit, DAY + 5);
  assert.deepEqual([office.agent().plan.state, office.agent().plan.decidedAt], ["approved", DAY + 5]);
  assert.deepEqual(office.agent().log.at(-1), { at: DAY + 5, actionId: AGENT_ACTION.PLAN_APPROVED, subject: null });
});

test("a second plan before approval is version 2, a revision", () => {
  const office = officeWith();
  office.send("PreToolUse", { tool_name: "ExitPlanMode", tool_use_id: "p1", tool_input: { plan: "# Plan A" } }, DAY);
  office.send("PreToolUse", { tool_name: "ExitPlanMode", tool_use_id: "p2", tool_input: { plan: "# Plan B" } }, DAY + 1);
  assert.deepEqual([office.agent().plan.version, office.agent().plan.state], [2, "revised"]);
  assert.equal(office.store.planOf(MAIN_KEY).text, "# Plan B");
});

test("the start of an approved plan that arrives late does not make a new version", () => {
  const office = officeWith();
  const exit = { tool_name: "ExitPlanMode", tool_use_id: "p1", tool_input: { plan: "# Plan" } };
  office.send("PostToolUse", exit, DAY + 5);
  office.send("PreToolUse", exit, DAY);
  assert.deepEqual([office.agent().plan.version, office.agent().plan.state], [1, "approved"]);
});

const SILENT_SESSION_TTL_MS = 6 * 60 * 60_000;

// The text kept in memory goes with the agent, so the same session coming back proposes its plan as a new one.
test("an agent that expired takes the same plan text again as version 1", () => {
  const office = officeWith();
  const exit = { tool_name: "ExitPlanMode", tool_use_id: "p1", tool_input: { plan: "# Plan" } };
  office.send("PreToolUse", exit, DAY);
  office.store.sweep(DAY + SILENT_SESSION_TTL_MS + 1);
  assert.equal(office.agent(), null);
  office.send("PreToolUse", { ...exit, tool_use_id: "p2" }, DAY + SILENT_SESSION_TTL_MS + 2);
  assert.deepEqual([office.agent().plan?.version, office.store.planOf(MAIN_KEY)?.text], [1, "# Plan"]);
});

test("an agent with no plan has none through planOf", () => {
  const office = officeWith();
  office.send("SessionStart");
  assert.equal(office.store.planOf(MAIN_KEY), null);
  assert.equal(office.store.planOf("claude:nobody"), null);
});

// Worst case in UTF-16 units, every text made of emoji (two units each): checklist 50 x 400 x 2 = 80 000, failures
// 10 x 900 x 2 = 18 000, files 30 x 300 x 2 = 18 000, runs of the day 20 x 60 x 2 = 2 400, plus field names and numbers.
const AGENT_SIZE_LIMIT = 128 * 1024;
const WIDE = "😀";

test("an agent with every list full and every text at its limit stays under 128 KB serialized", () => {
  const huge = (length) => WIDE.repeat(length);
  const failures = Array.from({ length: 15 }, () => ({ name: huge(600), location: `${ROOT}/${huge(600)}:1`, message: huge(600) }));
  const office = officeWith(() => ({ framework: "jest", passed: 1, failed: 15, skipped: 0, failures }));
  const todos = Array.from({ length: 60 }, (_, index) => ({ id: `${index}`.padEnd(40, "x"), content: huge(400), status: "in_progress", activeForm: huge(400) }));
  office.send("PostToolUse", { tool_name: "TodoWrite", tool_use_id: "w1", tool_input: { todos } });
  office.send("PreToolUse", { tool_name: "ExitPlanMode", tool_use_id: "p1", tool_input: { plan: huge(30_000) } });
  for (let index = 0; index < 35; index += 1) {
    office.send("PostToolUse", { tool_name: "Write", tool_use_id: `f${index}`, tool_input: { file_path: `${ROOT}/test/${index}${huge(500)}` } });
  }
  for (let index = 0; index < 25; index += 1) {
    office.send("PreToolUse", bash(`npx jest ${huge(400)}`, `b${index}`));
    office.send("PostToolUse", { ...bash(`npx jest ${huge(400)}`, `b${index}`), ...output("x") });
  }
  assert.ok(JSON.stringify(office.agent()).length <= AGENT_SIZE_LIMIT, `${JSON.stringify(office.agent()).length}`);
});

test("work inside a subagent goes to the subagent", () => {
  const office = officeWith();
  office.send("PreToolUse", { ...bash("pytest"), agent_id: "a1", agent_type: "Explore" });
  assert.ok(office.store.findAgent("claude:s1:a1").tests.running);
  assert.equal(office.agent().tests, undefined);
});
