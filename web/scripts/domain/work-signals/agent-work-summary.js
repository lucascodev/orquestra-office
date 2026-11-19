import { WORK_MARKS } from "../../data/work-marks.js";
import { WORK_SIGNALS } from "../../data/text/pt-br/work-signals.js";
import { countPhrase } from "../text/count-phrase.js";
import { fillPhrase } from "../text/fill-phrase.js";
import { checklistProgressOf, testsOf } from "./agent-work-fields.js";

const TEXT = WORK_SIGNALS.island;
// A dash keeps the columns lined up; read out on every row it would only be noise.
const UNSPOKEN = "";

function checklistSummary(agent) {
  const progress = checklistProgressOf(agent);
  if (!progress) return { icon: WORK_MARKS.checklist, text: TEXT.missing, spoken: UNSPOKEN };
  return { icon: WORK_MARKS.checklist, text: fillPhrase(TEXT.checklist, progress), spoken: fillPhrase(TEXT.checklistSpoken, progress) };
}

function lastRunSummary(agent) {
  const { lastRun } = testsOf(agent);
  if (!lastRun) return { kind: null, icon: "", text: TEXT.missing, spoken: UNSPOKEN };
  const kind = lastRun.isOk ? "tests-passed" : "tests-failed";
  const count = lastRun.isOk ? lastRun.passed : lastRun.failed;
  const spoken = countPhrase(lastRun.isOk ? TEXT.passedSpoken : TEXT.failedSpoken, count);
  return { kind, icon: WORK_MARKS[kind], text: count === null ? "" : String(count), spoken };
}

// What the island's sheet shows of each agent's work: the checklist as done/total and the result of the last test run,
// the passed count when it passed and the failed count when it failed, with a sentence for screen readers.
export const agentWorkSummaryOf = (agent) => ({ checklist: checklistSummary(agent), lastRun: lastRunSummary(agent) });
