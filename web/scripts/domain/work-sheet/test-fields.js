import { isRecord } from "../shared/is-record.js";
import { textOf, timeOf } from "../shared/field-values.js";
import { testFileState } from "./test-file-state.js";
import { testFrameworkName } from "./test-framework-name.js";
import { testRunSummary } from "./test-run-summary.js";

// One reader per field of agent.tests, shared by the tag over the figure, the island's sheet, the Testes tab and the timeline.
// A state saved before these fields, a Codex agent or a damaged record give the same empty answers.

const recordsOf = (value) => (Array.isArray(value) ? value.filter(isRecord) : []);
const testsField = (tests, field) => (isRecord(tests) ? tests[field] : undefined);

// A round running with no start time cannot be timed nor told apart from one that never ended, so it is no round running.
export function runningTestsOf(tests) {
  const running = testsField(tests, "running");
  const startedAt = isRecord(running) ? timeOf(running.startedAt) : null;
  if (startedAt === null) return null;
  return { command: textOf(running.command), frameworkName: testFrameworkName(running.framework), startedAt };
}

export function lastTestRunOf(tests) {
  const run = testsField(tests, "lastRun");
  const summary = testRunSummary(run);
  if (!summary) return null;
  const failures = recordsOf(run.failures).map((failure) => ({
    name: textOf(failure.name), location: textOf(failure.location), message: textOf(failure.message),
  }));
  return { ...summary, command: textOf(run.command), durationMs: timeOf(run.durationMs), failures };
}

// The collector empties runsToday at UTC midnight; the page keeps only what finished since the viewer's own midnight.
export function testRunsOfDay(tests, dayStart) {
  return recordsOf(testsField(tests, "runsToday"))
    .map((run) => ({ summary: testRunSummary(run), label: textOf(run.label) }))
    .filter(({ summary }) => summary && summary.finishedAt !== null && summary.finishedAt >= dayStart)
    .map(({ summary, label }) => ({ ...summary, label }));
}

export const testFilesOf = (tests) => recordsOf(testsField(tests, "files")).map(testFileState).filter((file) => file.path);

export const lastTestFileAtOf = (tests) => timeOf(testsField(tests, "lastTestFileAt"));

export const hasFailedLastRun = (tests) => lastTestRunOf(tests)?.isOk === false;
