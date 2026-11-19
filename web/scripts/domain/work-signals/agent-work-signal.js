import { WORK_MARKS } from "../../data/work-marks.js";
import { WORK_SIGNALS } from "../../data/text/pt-br/work-signals.js";
import { countPhrase } from "../text/count-phrase.js";
import { fillPhrase } from "../text/fill-phrase.js";
import { checklistProgress } from "../work-sheet/checklist-progress.js";
import { runningElapsedMs } from "../work-sheet/running-elapsed.js";
import { lastTestFileAtOf, lastTestRunOf, runningTestsOf } from "../work-sheet/test-fields.js";
import { clockText } from "./clock-text.js";

export const PASSED_SHOWN_MS = 60_000;
export const WRITING_SHOWN_MS = 60_000;

export const NO_WORK_SIGNAL = Object.freeze({ kind: null, icon: "", text: "", elapsedMs: null });

const TEXT = WORK_SIGNALS.tag;

const signal = (kind, text, elapsedMs = null) => ({ kind, icon: WORK_MARKS[kind], text, elapsedMs });
const isRecent = (at, now, windowMs) => at !== null && now - at < windowMs;

function testingSignal({ running }, now) {
  if (!running) return null;
  const elapsedMs = runningElapsedMs(running.startedAt, now);
  return signal("testing", fillPhrase(TEXT.testing, { clock: clockText(elapsedMs) }), elapsedMs);
}

function failedSignal({ lastRun }) {
  if (!lastRun || lastRun.isOk) return null;
  return signal("tests-failed", countPhrase(TEXT.failed, lastRun.headlineCount));
}

function passedSignal({ lastRun }, now) {
  if (!lastRun?.isOk || !isRecent(lastRun.finishedAt, now, PASSED_SHOWN_MS)) return null;
  return signal("tests-passed", countPhrase(TEXT.passed, lastRun.headlineCount));
}

// Writing counts only while the last test file touched is newer than the last run and from the last minute.
function writingSignal({ lastRun, lastTestFileAt }, now) {
  const lastRunAt = lastRun?.finishedAt ?? Number.NEGATIVE_INFINITY;
  if (lastTestFileAt === null || lastTestFileAt <= lastRunAt || !isRecent(lastTestFileAt, now, WRITING_SHOWN_MS)) return null;
  return signal("writing-tests", TEXT.writing);
}

function checklistSignal({ checklist }) {
  if (!checklist?.hasOpenItems) return null;
  return signal("checklist", fillPhrase(TEXT.checklist, checklist));
}

function workOf(agent) {
  return {
    running: runningTestsOf(agent?.tests),
    lastRun: lastTestRunOf(agent?.tests),
    lastTestFileAt: lastTestFileAtOf(agent?.tests),
    checklist: checklistProgress(agent?.checklist),
  };
}

// What the tag over the figure says about the agent's tests and checklist, the first that applies in this order: tests
// running, the last run failed (until the next one), the last run passed (for a minute), writing a test, open checklist items.
export function agentWorkSignalOf(agent, now) {
  const work = workOf(agent);
  return testingSignal(work, now)
    ?? failedSignal(work)
    ?? passedSignal(work, now)
    ?? writingSignal(work, now)
    ?? checklistSignal(work)
    ?? NO_WORK_SIGNAL;
}
