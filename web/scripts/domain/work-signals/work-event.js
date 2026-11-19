import { WORK_MARKS } from "../../data/work-marks.js";
import { WORK_SIGNALS } from "../../data/text/pt-br/work-signals.js";
import { countOf } from "../shared/field-values.js";
import { ownValueOf } from "../shared/own-value.js";
import { countPhrase } from "../text/count-phrase.js";
import { fillPhrase } from "../text/fill-phrase.js";
import { lastTestRunOf, testRunsOfDay } from "../work-sheet/test-fields.js";

// The log entry and the run it reports are written by the same hook, but not necessarily in the same millisecond.
export const RUN_MATCH_MS = 5_000;

const TEXT = WORK_SIGNALS.event;

function matchingRun(agent, entry, isOk) {
  const lastRun = lastTestRunOf(agent?.tests);
  const runsToday = testRunsOfDay(agent?.tests);
  const runs = lastRun ? [lastRun, ...runsToday] : runsToday;
  return runs.find((run) => run.isOk === isOk && run.finishedAt !== null && Math.abs(run.finishedAt - entry.at) <= RUN_MATCH_MS) ?? null;
}

function testsRunText(parts) {
  return fillPhrase(TEXT.testsRun, { result: parts.join(TEXT.resultSeparator) });
}

function failedText(entry, agent) {
  const run = matchingRun(agent, entry, false);
  const failed = countOf(entry.subject) ?? run?.failed ?? null;
  const passed = run?.passed ?? 0;
  return testsRunText(passed > 0 ? [countPhrase(TEXT.failed, failed), countPhrase(TEXT.passed, passed)] : [countPhrase(TEXT.failed, failed)]);
}

function passedText(entry, agent) {
  const passed = countOf(entry.subject) ?? matchingRun(agent, entry, true)?.passed ?? null;
  return testsRunText([countPhrase(TEXT.passed, passed)]);
}

const EVENT_TEXTS = {
  "tests-failed": failedText,
  "tests-passed": passedText,
  "plan-approved": () => TEXT.planApproved,
};

// One line of the day's timeline from one entry of the agent's log, or null for the entries the timeline leaves out.
// The number of the log entry wins; the run of the same moment adds what passed alongside what failed.
export function workEventOf(entry, agent) {
  const textOf = entry?.actionId ? ownValueOf(EVENT_TEXTS, entry.actionId) : undefined;
  if (!textOf || !Number.isFinite(entry.at)) return null;
  return { kind: entry.actionId, at: entry.at, icon: WORK_MARKS[entry.actionId], text: textOf(entry, agent) };
}
