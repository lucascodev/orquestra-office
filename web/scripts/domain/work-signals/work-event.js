import { WORK_MARKS } from "../../data/work-marks.js";
import { WORK_SIGNALS } from "../../data/text/pt-br/work-signals.js";
import { countPhrase } from "../text/count-phrase.js";
import { fillPhrase } from "../text/fill-phrase.js";
import { planStatus } from "../work-sheet/plan-status.js";
import { lastTestRunOf } from "../work-sheet/test-fields.js";

const TEXT = WORK_SIGNALS.event;
const APPROVED = "approved";

const eventOf = (kind, at, text) => ({ kind, at, icon: WORK_MARKS[kind], text });

function testsRunText(parts) {
  return fillPhrase(TEXT.testsRun, { result: parts.join(TEXT.resultSeparator) });
}

function runText(run) {
  if (run.isOk) return testsRunText([countPhrase(TEXT.passed, run.headlineCount)]);
  const failed = countPhrase(TEXT.failed, run.headlineCount);
  return testsRunText(run.passed > 0 ? [failed, countPhrase(TEXT.passed, run.passed)] : [failed]);
}

function lastRunEvent(agent) {
  const run = lastTestRunOf(agent?.tests);
  if (!run || run.finishedAt === null) return null;
  return eventOf(run.isOk ? "tests-passed" : "tests-failed", run.finishedAt, runText(run));
}

function approvedPlanEvent(agent) {
  const plan = planStatus(agent?.plan);
  if (plan?.state !== APPROVED || plan.decidedAt === null) return null;
  return eventOf("plan-approved", plan.decidedAt, TEXT.planApproved);
}

// The timeline's lines for one agent, read from its last test run and its approved plan, never from its log: the log keeps
// only the last twenty actions, so a busy agent would push its own result out of it within a minute.
export const workEventsOf = (agent) => [lastRunEvent(agent), approvedPlanEvent(agent)].filter(Boolean);
