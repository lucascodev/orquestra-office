import {
  CHECKOUT_COMMAND, CHECKOUT_FILES, HOOKS_COMMAND, HOOKS_FAILURES, PHYSICS_SUITE, RENDER_COMMAND, RENDER_FILES, WEB_CHECK_COMMAND,
} from "./demo-test-suites.js";

const SECOND = 1_000;
const MIN = 60 * SECOND;
const LOG_SIZE = 20;
const RUNS_TODAY = 20;
// Under the minute the tag shows a pass or a test being written, with a tick of the demo to spare.
const JUST_PASSED_AGO_MS = 20 * SECOND;
const RENDER_DURATION_MS = 3_400;
const WRITER_TICKS_PER_EDIT = 3;

// As the collector writes it: the label of a round of today is its command, cut at 60 characters.
const LABEL_LIMIT = 60;
const todayRun = (finishedAt, command, framework, counts) => ({ finishedAt, framework, label: command.slice(0, LABEL_LIMIT), ...counts });

// An agent on the main project that already ran its suite and has not touched a test in a while.
export function testsDoneLongAgo(now) {
  const lastRun = {
    command: HOOKS_COMMAND, framework: "node-test", startedAt: now - 19 * MIN, finishedAt: now - 19 * MIN + 4_100, durationMs: 4_100,
    isOk: true, passed: 242, failed: 0, skipped: 0, failures: [],
  };
  return {
    running: null,
    lastRun,
    runsToday: [
      todayRun(lastRun.finishedAt, HOOKS_COMMAND, "node-test", { isOk: true, passed: 242, failed: 0, skipped: 0 }),
      todayRun(now - 70 * MIN, WEB_CHECK_COMMAND, null, { isOk: true, passed: 461, failed: 0, skipped: 0 }),
      todayRun(now - 95 * MIN, "pytest api/tests -q", "pytest", { isOk: true, passed: 290, failed: 0, skipped: 3 }),
    ],
    files: [
      { path: "hooks/test/office-codex-notify.test.mjs", action: "created", at: now - 25 * MIN, failed: 0 },
      { path: "hooks/test/codex-chain.test.mjs", action: "created", at: now - 27 * MIN, failed: 0 },
      { path: "hooks/test/support/fake-office.mjs", action: "read", at: now - 30 * MIN, failed: null },
    ],
    lastTestFileAt: now - 25 * MIN,
  };
}

// An agent whose last round failed and stays failed until it runs again, with an exit code and no counts in one older round.
export function testsThatFailed(now) {
  const lastRun = {
    command: HOOKS_COMMAND, framework: "node-test", startedAt: now - 6 * MIN, finishedAt: now - 6 * MIN + 4_100, durationMs: 4_100,
    isOk: false, passed: 248, failed: 2, skipped: 7, failures: HOOKS_FAILURES,
  };
  return {
    running: null,
    lastRun,
    runsToday: [
      todayRun(lastRun.finishedAt, HOOKS_COMMAND, "node-test", { isOk: false, passed: 248, failed: 2, skipped: 7 }),
      todayRun(now - 40 * MIN, "make test", null, { isOk: false, passed: null, failed: null, skipped: null }),
    ],
    files: [
      { path: "hooks/test/install-codex-notify.test.mjs", action: "edited", at: now - 8 * MIN, failed: 2 },
      { path: "hooks/test/codex-chain.test.mjs", action: "read", at: now - 9 * MIN, failed: 0 },
    ],
    lastTestFileAt: now - 8 * MIN,
  };
}

const passedRun = (suite, finishedAt, durationMs) => ({
  command: suite.command, framework: suite.framework, startedAt: finishedAt - durationMs, finishedAt, durationMs,
  isOk: true, ...suite.passing, failures: [],
});

// A test runner that is in the middle of a round when the demo opens, after a green one a few minutes before.
export function testsRunningSince(now, suite) {
  const lastRun = passedRun(suite, now - 3 * MIN, 4_100);
  return {
    running: { command: suite.command, framework: suite.framework, startedAt: now },
    lastRun,
    runsToday: [todayRun(lastRun.finishedAt, suite.command, suite.framework, { isOk: true, ...suite.passing })],
    files: suite.files.map((path, index) => ({ path, action: "edited", at: now - (index + 1) * MIN, failed: 0 })),
    lastTestFileAt: now - MIN,
  };
}

// An agent whose suite has just gone green: the demo keeps the round under a minute old, so the ✓ never goes away.
export function testsJustPassed(now) {
  const lastRun = {
    command: RENDER_COMMAND, framework: "vitest", startedAt: 0, finishedAt: 0, durationMs: RENDER_DURATION_MS,
    isOk: true, passed: 64, failed: 0, skipped: 1, failures: [],
  };
  const tests = {
    running: null,
    lastRun,
    runsToday: [
      todayRun(0, RENDER_COMMAND, "vitest", { isOk: true, passed: 64, failed: 0, skipped: 1 }),
      todayRun(now - 35 * MIN, RENDER_COMMAND, "vitest", { isOk: false, passed: 61, failed: 3, skipped: 1 }),
    ],
    files: RENDER_FILES.map((path, index) => ({ path, action: "edited", at: now - (index + 2) * MIN, failed: 0 })),
    lastTestFileAt: now - 2 * MIN,
  };
  return justPassedAt(tests, now);
}

function justPassedAt(tests, now) {
  const finishedAt = now - JUST_PASSED_AGO_MS;
  const lastRun = { ...tests.lastRun, startedAt: finishedAt - tests.lastRun.durationMs, finishedAt };
  const [latest, ...older] = tests.runsToday;
  return { ...tests, lastRun, runsToday: [{ ...latest, finishedAt }, ...older] };
}

export function keepJustPassed(agent, now) {
  if (agent.tests?.lastRun) agent.tests = justPassedAt(agent.tests, now);
}

// An agent writing new tests after a green round that is already a few minutes old.
export function testsBeingWritten(now) {
  const lastRun = {
    command: CHECKOUT_COMMAND, framework: "jest", startedAt: now - 12 * MIN, finishedAt: now - 12 * MIN + 6_800, durationMs: 6_800,
    isOk: true, passed: 118, failed: 0, skipped: 0, failures: [],
  };
  const [shipping] = CHECKOUT_FILES;
  return {
    running: null,
    lastRun,
    runsToday: [todayRun(lastRun.finishedAt, CHECKOUT_COMMAND, "jest", { isOk: true, passed: 118, failed: 0, skipped: 0 })],
    files: [{ path: shipping, action: "created", at: now - 10 * SECOND, failed: null }],
    lastTestFileAt: now - 10 * SECOND,
  };
}

const emptyTests = () => ({ running: null, lastRun: null, runsToday: [], files: [], lastTestFileAt: null });

function note(agent, now, actionId, subject) {
  agent.actionId = actionId;
  agent.subject = subject;
  agent.updatedAt = now;
  agent.log = [...(agent.log ?? []), { at: now, actionId, subject }].slice(-LOG_SIZE);
}

function touchTestFile(agent, path, now) {
  const tests = agent.tests ?? emptyTests();
  const others = tests.files.filter((file) => file.path !== path);
  const previous = tests.files.find((file) => file.path === path);
  const touched = { path, action: previous ? "edited" : "created", at: now, failed: previous?.failed ?? null };
  agent.tests = { ...tests, files: [touched, ...others], lastTestFileAt: now };
  Object.assign(agent, { status: "working", activity: "editing" });
  note(agent, now, "writing-tests", path.split("/").at(-1));
}

function startRun(agent, now, suite) {
  agent.tests = { ...(agent.tests ?? emptyTests()), running: { command: suite.command, framework: suite.framework, startedAt: now } };
  Object.assign(agent, { status: "working", activity: "terminal" });
  note(agent, now, "running-tests", suite.framework);
}

function finishRun(agent, now, suite, isOk) {
  const tests = agent.tests ?? emptyTests();
  const startedAt = tests.running?.startedAt ?? now;
  const counts = isOk ? suite.passing : suite.failing;
  const lastRun = {
    command: suite.command, framework: suite.framework, startedAt, finishedAt: now, durationMs: now - startedAt,
    isOk, ...counts, failures: isOk ? [] : suite.failures,
  };
  const files = tests.files.map((file) => (file.action === "read" ? file : { ...file, failed: isOk ? 0 : 1 }));
  const runsToday = [todayRun(now, suite.command, suite.framework, { isOk, ...counts }), ...tests.runsToday].slice(0, RUNS_TODAY);
  agent.tests = { ...tests, running: null, lastRun, runsToday, files };
  Object.assign(agent, { status: "working", activity: isOk ? "editing" : "failed" });
  note(agent, now, isOk ? "tests-passed" : "tests-failed", isOk ? counts.passed : counts.failed);
}

// A test runner of the demo goes round: writes a test, runs the suite for about twelve seconds, fails two, fixes them and passes.
const TEST_CYCLE = [
  (agent, now, suite) => touchTestFile(agent, suite.files[0], now),
  (agent, now, suite) => touchTestFile(agent, suite.files[1], now),
  startRun, null, null,
  (agent, now, suite) => finishRun(agent, now, suite, false),
  (agent, now, suite) => touchTestFile(agent, suite.files[0], now),
  null,
  startRun, null, null,
  (agent, now, suite) => finishRun(agent, now, suite, true),
];

export function tickTestRunner(agent, step, now, suite = PHYSICS_SUITE) {
  TEST_CYCLE[step % TEST_CYCLE.length]?.(agent, now, suite);
}

// The writer saves a test file every few ticks, always inside the minute the tag counts as writing.
export function tickTestWriter(agent, step, now) {
  if (step % WRITER_TICKS_PER_EDIT !== 0) return;
  const path = CHECKOUT_FILES[(step / WRITER_TICKS_PER_EDIT) % CHECKOUT_FILES.length];
  touchTestFile(agent, path, now);
}
