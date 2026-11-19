import { lastTestFileAtOf, lastTestRunOf, runningTestsOf, testFilesOf, testRunsOfDay } from "./test-fields.js";

// Everything the Tests tab shows, or null when the session has not run, written or read a test yet, or the record is damaged.
// dayStart is the viewer's midnight, which decides what counts as today.
export function testsOverview(tests, { dayStart } = {}) {
  const overview = {
    running: runningTestsOf(tests),
    lastRun: lastTestRunOf(tests),
    runsToday: testRunsOfDay(tests, dayStart),
    files: testFilesOf(tests),
    lastTestFileAt: lastTestFileAtOf(tests),
  };
  const isEmpty = !overview.running && !overview.lastRun && overview.runsToday.length === 0 && overview.files.length === 0
    && overview.lastTestFileAt === null;
  return isEmpty ? null : overview;
}
