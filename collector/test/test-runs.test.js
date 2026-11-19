import { test } from "node:test";
import assert from "node:assert/strict";
import { testsOf, withFileTouched, withFinishedRun, withLateStart, withRunning, withRunsOfDay } from "../src/work/domain/tests/agent-tests.js";
import { FILE_ACTION } from "../src/work/domain/tests/file-actions.js";
import { createTestCalls } from "../src/work/domain/tests/test-calls.js";
import { testResultOf } from "../src/work/domain/tests/test-result.js";

const ROOT = "/home/dev/app";
const DAY = Date.UTC(2026, 10, 19, 12, 0);
const NEXT_DAY = Date.UTC(2026, 10, 20, 9, 0);
const JEST = { framework: "jest", command: "npx jest" };
const NPM_TEST = { framework: null, command: "npm test" };
const FAILURE = { name: "Calculator › adds", location: `${ROOT}/src/calc.test.js:12:20`, message: "expected 3 to be 4" };
const summary = (extra = {}) => ({ framework: "jest", passed: 248, failed: 2, skipped: 1, failures: [FAILURE], ...extra });

test("a test command without a summary passes or fails by how the call ended", () => {
  assert.deepEqual(testResultOf({ test: NPM_TEST, summary: null, isCallOk: true, root: ROOT }), {
    command: "npm test", framework: null, isOk: true, passed: null, failed: null, skipped: null, failures: [],
  });
  assert.equal(testResultOf({ test: NPM_TEST, summary: null, isCallOk: false, root: ROOT }).isOk, false);
});

test("a summary decides the result over how the call ended", () => {
  assert.equal(testResultOf({ test: NPM_TEST, summary: summary({ failed: 0 }), isCallOk: false, root: ROOT }).isOk, true);
  assert.equal(testResultOf({ test: NPM_TEST, summary: summary(), isCallOk: true, root: ROOT }).isOk, false);
});

test("a summary without the failed count leaves the result to how the call ended", () => {
  assert.equal(testResultOf({ test: NPM_TEST, summary: summary({ failed: undefined }), isCallOk: false, root: ROOT }).isOk, false);
});

test("the framework of the summary names the run, and the command's framework is the fallback", () => {
  assert.equal(testResultOf({ test: NPM_TEST, summary: summary(), isCallOk: true, root: ROOT }).framework, "jest");
  assert.equal(testResultOf({ test: JEST, summary: summary({ framework: "made-up" }), isCallOk: true, root: ROOT }).framework, "jest");
});

test("a command that is not a test becomes a run only when its output has a summary", () => {
  assert.equal(testResultOf({ test: null, script: "npm run check", summary: null, isCallOk: true, root: ROOT }), null);
  assert.equal(testResultOf({ test: null, script: "npm run check", summary: summary(), isCallOk: true, root: ROOT }).command, "npm run check");
});

test("counts that are not safe whole numbers become null", () => {
  const result = testResultOf({ test: JEST, summary: summary({ passed: -1, failed: 1e20, skipped: "3" }), isCallOk: false, root: ROOT });
  assert.deepEqual([result.passed, result.failed, result.skipped], [null, null, null]);
});

test("failures keep at most 10, with each field cut at 300 and the location relative to the project", () => {
  const many = Array.from({ length: 12 }, (_, index) => ({ ...FAILURE, name: `${index} ${"n".repeat(400)}` }));
  const { failures } = testResultOf({ test: JEST, summary: summary({ failures: many }), isCallOk: false, root: ROOT });
  assert.equal(failures.length, 10);
  assert.equal(failures[0].name.length, 300);
  assert.equal(failures[0].location, "src/calc.test.js:12:20");
});

test("failure fields lose secrets and control characters, and missing ones become null", () => {
  const leaking = { name: "logs in‮", location: null, message: "expected token=abc to be token=xyz" };
  const [failure] = testResultOf({ test: JEST, summary: summary({ failures: [leaking, "junk"] }), isCallOk: false, root: ROOT }).failures;
  assert.deepEqual(failure, { name: "logs in", location: null, message: "expected token=[redacted] to be token=[redacted]" });
});

test("a failure outside the project keeps only the file name in its location", () => {
  const outside = { ...FAILURE, location: "/home/dev/other/x.test.js:3" };
  assert.equal(testResultOf({ test: JEST, summary: summary({ failures: [outside] }), isCallOk: false, root: ROOT }).failures[0].location, "x.test.js:3");
});

const locations = [
  ["a file URL outside the project", "file:///home/x/a.test.js:3:1", "a.test.js:3:1"],
  ["a file URL inside the project", `file://${ROOT}/src/a.test.js:3:1`, "src/a.test.js:3:1"],
  ["a relative path that climbs out of the project", "../../outro/x_test.py:7", "x_test.py:7"],
  ["a path that climbs out of the root", `${ROOT}/../../Users/a.js:2`, "a.js:2"],
];

for (const [what, location, expected] of locations) {
  test(`the location of a failure at ${what} is ${expected}`, () => {
    const failure = { ...FAILURE, location };
    assert.equal(testResultOf({ test: JEST, summary: summary({ failures: [failure] }), isCallOk: false, root: ROOT }).failures[0].location, expected);
  });
}

const run = (result, finishedAt = DAY, startedAt = DAY - 12_000) => ({ result, startedAt, finishedAt });
const failingRun = () => testResultOf({ test: JEST, summary: summary(), isCallOk: false, root: ROOT });
const passingRun = () => testResultOf({ test: JEST, summary: summary({ failed: 0, failures: [] }), isCallOk: true, root: ROOT });

test("tests of an agent restored without the new fields start empty", () => {
  assert.deepEqual(testsOf(undefined), { running: null, lastRun: null, runsToday: [], files: [], lastTestFileAt: null });
  assert.deepEqual(testsOf({ lastRun: { isOk: true } }).lastRun.failures, []);
});

test("a finished run becomes the last run with its duration", () => {
  const tests = withFinishedRun(testsOf(null), run(failingRun()));
  assert.deepEqual(tests.lastRun, {
    command: "npx jest", framework: "jest", startedAt: DAY - 12_000, finishedAt: DAY, durationMs: 12_000,
    isOk: false, passed: 248, failed: 2, skipped: 1, failures: [{ name: "Calculator › adds", location: "src/calc.test.js:12:20", message: "expected 3 to be 4" }],
  });
});

test("a run whose start is unknown has no duration until the late start arrives", () => {
  const unknownStart = withFinishedRun(testsOf(null), run(passingRun(), DAY, null));
  assert.equal(unknownStart.lastRun.durationMs, null);
  const known = withLateStart(unknownStart, DAY - 5_000);
  assert.deepEqual([known.lastRun.startedAt, known.lastRun.durationMs], [DAY - 5_000, 5_000]);
});

test("a late start does not change a run that already has its duration", () => {
  const tests = withFinishedRun(testsOf(null), run(passingRun()));
  assert.equal(withLateStart(tests, DAY - 1), tests);
});

test("each run enters the runs of the day, the most recent first", () => {
  const tests = withFinishedRun(withFinishedRun(testsOf(null), run(failingRun(), DAY)), run(passingRun(), DAY + 60_000));
  assert.deepEqual(tests.runsToday, [
    { finishedAt: DAY + 60_000, framework: "jest", label: "npx jest", isOk: true, passed: 248, failed: 0, skipped: 1 },
    { finishedAt: DAY, framework: "jest", label: "npx jest", isOk: false, passed: 248, failed: 2, skipped: 1 },
  ]);
});

test("the runs of the day keep at most 20", () => {
  let tests = testsOf(null);
  for (let index = 0; index < 25; index += 1) tests = withFinishedRun(tests, run(passingRun(), DAY + index));
  assert.equal(tests.runsToday.length, 20);
  assert.equal(tests.runsToday[0].finishedAt, DAY + 24);
});

test("the first run of a new day starts the runs of the day again", () => {
  const tests = withFinishedRun(withFinishedRun(testsOf(null), run(failingRun(), DAY)), run(passingRun(), NEXT_DAY));
  assert.deepEqual(tests.runsToday.map((entry) => entry.finishedAt), [NEXT_DAY]);
});

test("turning the day drops yesterday's runs even with no new run", () => {
  const tests = withFinishedRun(testsOf(null), run(failingRun(), DAY));
  assert.deepEqual(withRunsOfDay(tests, NEXT_DAY).runsToday, []);
  assert.equal(withRunsOfDay(tests, DAY), tests);
});

test("touching a test file lists it, the most recent first", () => {
  const tests = withFileTouched(withFileTouched(testsOf(null), { path: "a.test.js", action: FILE_ACTION.READ, at: DAY }), { path: "b.test.js", action: FILE_ACTION.EDITED, at: DAY + 1 });
  assert.deepEqual(tests.files, [
    { path: "b.test.js", action: "edited", at: DAY + 1, failed: null },
    { path: "a.test.js", action: "read", at: DAY, failed: null },
  ]);
});

test("a file touched again keeps the strongest action and the latest time", () => {
  const created = withFileTouched(testsOf(null), { path: "a.test.js", action: FILE_ACTION.CREATED, at: DAY });
  const read = withFileTouched(created, { path: "a.test.js", action: FILE_ACTION.READ, at: DAY + 5 });
  assert.deepEqual(read.files, [{ path: "a.test.js", action: "created", at: DAY + 5, failed: null }]);
});

test("the files keep at most 30", () => {
  let tests = testsOf(null);
  for (let index = 0; index < 35; index += 1) tests = withFileTouched(tests, { path: `t${index}.test.js`, action: FILE_ACTION.READ, at: DAY + index });
  assert.equal(tests.files.length, 30);
  assert.equal(tests.files[0].path, "t34.test.js");
});

test("creating or editing a test file marks when, reading does not", () => {
  const read = withFileTouched(testsOf(null), { path: "a.test.js", action: FILE_ACTION.READ, at: DAY });
  assert.equal(read.lastTestFileAt, null);
  assert.equal(withFileTouched(read, { path: "a.test.js", action: FILE_ACTION.EDITED, at: DAY + 3 }).lastTestFileAt, DAY + 3);
});

test("a run counts its failures in each file touched before it", () => {
  const touched = withFileTouched(withFileTouched(testsOf(null), { path: "src/calc.test.js", action: FILE_ACTION.EDITED, at: DAY - 60_000 }), { path: "src/other.test.js", action: FILE_ACTION.READ, at: DAY - 60_000 });
  const tests = withFinishedRun(touched, run(failingRun()));
  assert.deepEqual(tests.files.map((file) => [file.path, file.failed]), [["src/other.test.js", null], ["src/calc.test.js", 1]]);
});

test("a passing run gives no failures to the files touched before it", () => {
  const touched = withFileTouched(testsOf(null), { path: "src/calc.test.js", action: FILE_ACTION.EDITED, at: DAY - 60_000 });
  assert.equal(withFinishedRun(touched, run(passingRun())).files[0].failed, 0);
});

test("a file touched after the last run has no failure count yet", () => {
  const tests = withFileTouched(withFinishedRun(testsOf(null), run(passingRun())), { path: "src/new.test.js", action: FILE_ACTION.CREATED, at: DAY + 1 });
  assert.equal(tests.files[0].failed, null);
});

test("the running test is set and cleared", () => {
  const running = withRunning(testsOf(null), { command: "npx jest", framework: "jest", startedAt: DAY });
  assert.deepEqual(running.running, { command: "npx jest", framework: "jest", startedAt: DAY });
  assert.equal(withRunning(running, null).running, null);
});

test("the calls remember when each test started and which one runs now", () => {
  const calls = createTestCalls();
  calls.start("a", "t1", { startedAt: DAY, test: JEST, isBackground: false });
  calls.start("a", "t2", { startedAt: DAY + 1, test: NPM_TEST, isBackground: false });
  calls.start("a", "t3", { startedAt: DAY + 2, test: null, isBackground: false });
  assert.deepEqual(calls.runningOf("a"), { command: "npm test", framework: null, startedAt: DAY + 1 });
  assert.equal(calls.finish("a", "t2").startedAt, DAY + 1);
  assert.deepEqual(calls.runningOf("a"), { command: "npx jest", framework: "jest", startedAt: DAY });
  assert.equal(calls.finish("a", "t2"), null);
});

test("a test running in the background is not shown as running", () => {
  const calls = createTestCalls();
  calls.start("a", "t1", { startedAt: DAY, test: JEST, isBackground: true });
  assert.equal(calls.runningOf("a"), null);
});

test("the end of a turn forgets the calls that never finished", () => {
  const calls = createTestCalls();
  calls.start("a", "t1", { startedAt: DAY, test: JEST, isBackground: false });
  calls.endTurn("a");
  assert.equal(calls.runningOf("a"), null);
  assert.equal(calls.finish("a", "t1"), null);
});

test("the calls know which call made the last run", () => {
  const calls = createTestCalls();
  calls.markLastRun("a", "t1");
  assert.equal(calls.isLastRun("a", "t1"), true);
  assert.equal(calls.isLastRun("a", "t2"), false);
  assert.equal(calls.isLastRun("b", "t1"), false);
});

test("a call without an id is not tracked", () => {
  const calls = createTestCalls();
  calls.start("a", null, { startedAt: DAY, test: JEST, isBackground: false });
  assert.equal(calls.runningOf("a"), null);
});
