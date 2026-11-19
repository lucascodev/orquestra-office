const SECOND = 1_000;
const MIN = 60 * SECOND;
const LOG_SIZE = 20;
const RUNS_TODAY = 20;

const HOOKS_COMMAND = "node --test hooks/test/*.test.mjs";
const PHYSICS_COMMAND = "npx vitest run src/physics";
const PHYSICS_TEST = "src/physics/collision.test.ts";
const JUMP_TEST = "src/physics/jump.test.ts";

const failure = (name, location, message) => ({ name, location, message });
const PHYSICS_FAILURES = [
  failure("keeps the player on the platform after landing", `${PHYSICS_TEST}:84`, "expected 'falling' to be 'grounded'"),
  failure("stops a jump at the ceiling", `${JUMP_TEST}:31`, "expected 3.2 to be less than or equal to 3"),
];
const HOOKS_FAILURES = [
  failure("keeps someone else's notify running after the office's", "hooks/test/install-codex-notify.test.mjs:158", "Expected values to be strictly equal: 0 !== 1"),
  failure("refuses a notify that cannot be chained", "hooks/test/install-codex-notify.test.mjs:190", "The input did not match the regular expression"),
];

const todayRun = (finishedAt, label, framework, counts) => ({ finishedAt, framework, label, ...counts });

// An agent on the main project that already ran its suite and has not touched a test in a while.
export function testsDoneLongAgo(now) {
  const lastRun = {
    command: HOOKS_COMMAND, framework: "node:test", startedAt: now - 19 * MIN, finishedAt: now - 19 * MIN + 4_100, durationMs: 4_100,
    isOk: true, passed: 242, failed: 0, skipped: 0, failures: [],
  };
  return {
    running: null,
    lastRun,
    runsToday: [
      todayRun(lastRun.finishedAt, "hooks · node --test", "node:test", { isOk: true, passed: 242, failed: 0, skipped: 0 }),
      todayRun(now - 70 * MIN, "web · npm run check", null, { isOk: true, passed: 461, failed: 0, skipped: 0 }),
      todayRun(now - 95 * MIN, "api · pytest", "pytest", { isOk: true, passed: 290, failed: 0, skipped: 3 }),
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
    command: HOOKS_COMMAND, framework: "node:test", startedAt: now - 6 * MIN, finishedAt: now - 6 * MIN + 4_100, durationMs: 4_100,
    isOk: false, passed: 248, failed: 2, skipped: 7, failures: HOOKS_FAILURES,
  };
  return {
    running: null,
    lastRun,
    runsToday: [
      todayRun(lastRun.finishedAt, "hooks · node --test", "node:test", { isOk: false, passed: 248, failed: 2, skipped: 7 }),
      todayRun(now - 40 * MIN, "make test", null, { isOk: false, passed: null, failed: null, skipped: null }),
    ],
    files: [
      { path: "hooks/test/install-codex-notify.test.mjs", action: "edited", at: now - 8 * MIN, failed: 2 },
      { path: "hooks/test/codex-chain.test.mjs", action: "read", at: now - 9 * MIN, failed: 0 },
    ],
    lastTestFileAt: now - 8 * MIN,
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

function startRun(agent, now) {
  agent.tests = { ...(agent.tests ?? emptyTests()), running: { command: PHYSICS_COMMAND, framework: "vitest", startedAt: now } };
  Object.assign(agent, { status: "working", activity: "terminal" });
  note(agent, now, "running-tests", "vitest");
}

function finishRun(agent, now, isOk) {
  const tests = agent.tests ?? emptyTests();
  const startedAt = tests.running?.startedAt ?? now;
  const counts = isOk ? { passed: 50, failed: 0, skipped: 2 } : { passed: 46, failed: 2, skipped: 2 };
  const lastRun = {
    command: PHYSICS_COMMAND, framework: "vitest", startedAt, finishedAt: now, durationMs: now - startedAt,
    isOk, ...counts, failures: isOk ? [] : PHYSICS_FAILURES,
  };
  const files = tests.files.map((file) => (file.action === "read" ? file : { ...file, failed: isOk ? 0 : 1 }));
  const runsToday = [todayRun(now, "vitest · física", "vitest", { isOk, ...counts }), ...tests.runsToday].slice(0, RUNS_TODAY);
  agent.tests = { ...tests, running: null, lastRun, runsToday, files };
  Object.assign(agent, { status: "working", activity: isOk ? "editing" : "failed" });
  note(agent, now, isOk ? "tests-passed" : "tests-failed", isOk ? counts.passed : counts.failed);
}

// The demo's test runner goes round: writes a test, runs the suite for about twelve seconds, fails two, fixes them and passes.
const TEST_CYCLE = [
  (agent, now) => touchTestFile(agent, PHYSICS_TEST, now),
  (agent, now) => touchTestFile(agent, JUMP_TEST, now),
  startRun, null, null,
  (agent, now) => finishRun(agent, now, false),
  (agent, now) => touchTestFile(agent, PHYSICS_TEST, now),
  null,
  startRun, null, null,
  (agent, now) => finishRun(agent, now, true),
];

export function tickTestRunner(agent, step, now) {
  TEST_CYCLE[step % TEST_CYCLE.length]?.(agent, now);
}
