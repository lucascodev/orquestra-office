import { dayOf } from "../../../office/domain/daily-stats.js";
import { cleanLineOf } from "../values/clean-text.js";
import { isWriting, strongestAction } from "./file-actions.js";

const RUNS_TODAY_LIMIT = 20;
const FILE_LIMIT = 30;
const LABEL_LIMIT = 60;
const PATH_LIMIT = 300;

const listOf = (value) => (Array.isArray(value) ? value : []);

// Agents saved before these fields existed, or saved without the failure texts, load with the same shape as new ones.
export function testsOf(saved) {
  return {
    running: saved?.running ?? null,
    lastRun: saved?.lastRun ? { ...saved.lastRun, failures: listOf(saved.lastRun.failures) } : null,
    runsToday: listOf(saved?.runsToday),
    files: listOf(saved?.files),
    lastTestFileAt: saved?.lastTestFileAt ?? null,
  };
}

export function withRunning(tests, running) {
  return { ...tests, running };
}

function locatedFileOf(location) {
  const parts = String(location ?? "").split(":");
  while (parts.length > 1 && /^\d+$/.test(parts.at(-1))) parts.pop();
  return parts.join(":");
}

const isSameFile = (located, path) => located === path || located.endsWith(`/${path}`) || path.endsWith(`/${located}`);

// null when the run cannot say: no run yet, the file changed after it, or failures it did not locate.
function failedIn(file, lastRun) {
  if (!lastRun || file.at > lastRun.finishedAt) return null;
  const count = lastRun.failures.filter((failure) => isSameFile(locatedFileOf(failure.location), file.path)).length;
  if (count > 0) return count;
  const isEveryFailureLocated = lastRun.failures.length === lastRun.failed && lastRun.failures.every((failure) => failure.location);
  return lastRun.isOk || isEveryFailureLocated ? 0 : null;
}

const withFailuresCounted = (files, lastRun) => files.map((file) => ({ ...file, failed: failedIn(file, lastRun) }));

const runOfDay = ({ finishedAt, framework, command, isOk, passed, failed, skipped }) => ({
  finishedAt, framework, label: cleanLineOf(command, LABEL_LIMIT) || null, isOk, passed, failed, skipped,
});

export function withFinishedRun(tests, { result, startedAt, finishedAt }) {
  const lastRun = {
    command: result.command,
    framework: result.framework,
    startedAt,
    finishedAt,
    durationMs: startedAt === null ? null : Math.max(0, finishedAt - startedAt),
    isOk: result.isOk,
    passed: result.passed,
    failed: result.failed,
    skipped: result.skipped,
    failures: result.failures,
  };
  const today = dayOf(finishedAt);
  const earlierToday = tests.runsToday.filter((entry) => dayOf(entry.finishedAt) === today);
  return {
    ...tests,
    lastRun,
    runsToday: [runOfDay(lastRun), ...earlierToday].slice(0, RUNS_TODAY_LIMIT),
    files: withFailuresCounted(tests.files, lastRun),
  };
}

// Hooks run in parallel, so the start of a call can reach the office after its end.
export function withLateStart(tests, startedAt) {
  const { lastRun } = tests;
  if (!lastRun || lastRun.startedAt !== null || startedAt > lastRun.finishedAt) return tests;
  return { ...tests, lastRun: { ...lastRun, startedAt, durationMs: lastRun.finishedAt - startedAt } };
}

export function withRunsOfDay(tests, now) {
  const today = dayOf(now);
  if (tests.runsToday.every((entry) => dayOf(entry.finishedAt) === today)) return tests;
  return { ...tests, runsToday: tests.runsToday.filter((entry) => dayOf(entry.finishedAt) === today) };
}

export function withFileTouched(tests, { path, action, at }) {
  const shownPath = cleanLineOf(path, PATH_LIMIT);
  if (!shownPath) return tests;
  const previous = tests.files.find((file) => file.path === shownPath);
  const touched = { path: shownPath, action: strongestAction(previous?.action, action), at, failed: null };
  const files = [touched, ...tests.files.filter((file) => file !== previous)].slice(0, FILE_LIMIT);
  return {
    ...tests,
    files: [{ ...touched, failed: failedIn(touched, tests.lastRun) }, ...files.slice(1)],
    lastTestFileAt: isWriting(action) ? at : tests.lastTestFileAt,
  };
}
