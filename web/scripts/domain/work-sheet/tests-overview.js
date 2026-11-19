import { isRecord } from "../shared/is-record.js";
import { testFileState } from "./test-file-state.js";
import { testRunSummary } from "./test-run-summary.js";

const recordsOf = (value) => (Array.isArray(value) ? value.filter(isRecord) : []);
const textOrNull = (value) => (typeof value === "string" && value ? value : null);
const timeOrNull = (value) => (Number.isFinite(value) ? value : null);

function runningOf(running) {
  if (!isRecord(running)) return null;
  return { command: textOrNull(running.command), framework: textOrNull(running.framework), startedAt: timeOrNull(running.startedAt) };
}

function lastRunOf(run) {
  const summary = testRunSummary(run);
  if (!summary) return null;
  const failures = recordsOf(run.failures).map((failure) => ({
    name: textOrNull(failure.name), location: textOrNull(failure.location), message: textOrNull(failure.message),
  }));
  return {
    ...summary, command: textOrNull(run.command), finishedAt: timeOrNull(run.finishedAt), durationMs: timeOrNull(run.durationMs), failures,
  };
}

const runOfToday = (run) => ({ ...testRunSummary(run), finishedAt: timeOrNull(run.finishedAt), label: textOrNull(run.label) });

// Everything the Tests tab shows, or null when the session has not run, written or read a test yet, or the record is damaged.
export function testsOverview(tests) {
  if (!isRecord(tests)) return null;
  const overview = {
    running: runningOf(tests.running),
    lastRun: lastRunOf(tests.lastRun),
    runsToday: recordsOf(tests.runsToday).map(runOfToday),
    files: recordsOf(tests.files).map(testFileState).filter((file) => file.path),
  };
  const isEmpty = !overview.running && !overview.lastRun && overview.runsToday.length === 0 && overview.files.length === 0;
  return isEmpty ? null : overview;
}
