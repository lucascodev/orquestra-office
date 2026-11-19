import { isRecord } from "../shared/is-record.js";
import { countOf, textOf, timeOf } from "../shared/field-values.js";

const FAILED = "failed";
const PASSED = "passed";

// A bad round with no failure counted ended by its exit code alone, so there is no number worth putting in its headline.
const failuresWorthCounting = (failed) => (failed > 0 ? failed : null);

// A round of tests in the terms the page shows: whether it went well and the numbers the collector could read. The headline
// counts what matters for the verdict, the failures of a bad round or the passes of a good one, and is null when unknown.
// A round that does not say whether it passed is no round at all: guessing would paint a failure nobody saw.
export function testRunSummary(run) {
  if (!isRecord(run) || typeof run.isOk !== "boolean") return null;
  const passed = countOf(run.passed);
  const failed = countOf(run.failed);
  const verdict = run.isOk ? PASSED : FAILED;
  return {
    verdict,
    isOk: run.isOk,
    passed,
    failed,
    skipped: countOf(run.skipped),
    headlineCount: run.isOk ? passed : failuresWorthCounting(failed),
    hasCounts: passed !== null || failed !== null,
    framework: textOf(run.framework),
    finishedAt: timeOf(run.finishedAt),
  };
}
