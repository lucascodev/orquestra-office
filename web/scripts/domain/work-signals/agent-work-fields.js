const COMPLETED = "completed";
const DIGITS = /^\d+$/;
const NO_TESTS = Object.freeze({ running: null, lastRun: null, runsToday: [], lastTestFileAt: null });

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const timeOf = (value) => (Number.isFinite(value) ? value : null);

// A count of tests comes as a number; a log subject may also bring it as text. Anything else is an unknown count.
export function countOf(value) {
  if (Number.isInteger(value) && value >= 0) return value;
  return typeof value === "string" && DIGITS.test(value) ? Number(value) : null;
}

// A run that does not say whether it passed is no run at all: guessing would paint a failure nobody saw.
function runOf(run) {
  if (!isRecord(run) || typeof run.isOk !== "boolean") return null;
  return {
    isOk: run.isOk,
    passed: countOf(run.passed),
    failed: countOf(run.failed),
    startedAt: timeOf(run.startedAt),
    finishedAt: timeOf(run.finishedAt),
  };
}

function runningOf(running) {
  if (!isRecord(running)) return null;
  const startedAt = timeOf(running.startedAt);
  return startedAt === null ? null : { startedAt };
}

// The tests of an agent read defensively: a state saved before these fields and the Codex agents have none of them.
export function testsOf(agent) {
  const tests = agent?.tests;
  if (!isRecord(tests)) return NO_TESTS;
  return {
    running: runningOf(tests.running),
    lastRun: runOf(tests.lastRun),
    runsToday: Array.isArray(tests.runsToday) ? tests.runsToday.map(runOf).filter(Boolean) : [],
    lastTestFileAt: timeOf(tests.lastTestFileAt),
  };
}

const isItem = (item) => isRecord(item) && typeof item.status === "string";

// How far the agent's checklist went, or null while it has none; items without a status are not counted.
export function checklistProgressOf(agent) {
  const checklist = agent?.checklist;
  if (!isRecord(checklist) || !Array.isArray(checklist.items)) return null;
  const items = checklist.items.filter(isItem);
  if (items.length === 0) return null;
  const done = items.filter((item) => item.status === COMPLETED).length;
  return { done, total: items.length };
}
