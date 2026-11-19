import { isRecord } from "../shared/is-record.js";

const FAILED = "failed";
const PASSED = "passed";

const countOf = (value) => (Number.isInteger(value) && value >= 0 ? value : null);
const textOrNull = (value) => (typeof value === "string" && value ? value : null);

// A bad round with no failure counted ended by its exit code alone, so there is no number worth putting in its headline.
const failuresWorthCounting = (failed) => (failed > 0 ? failed : null);

// A round of tests in the terms the sheet shows: whether it went well and the numbers the collector could read. The headline
// counts what matters for the verdict, the failures of a bad round or the passes of a good one, and is null when unknown.
export function testRunSummary(run) {
  if (!isRecord(run)) return null;
  const passed = countOf(run.passed);
  const failed = countOf(run.failed);
  const skipped = countOf(run.skipped);
  const verdict = run.isOk === true ? PASSED : FAILED;
  return {
    verdict,
    isOk: verdict === PASSED,
    passed,
    failed,
    skipped,
    headlineCount: verdict === FAILED ? failuresWorthCounting(failed) : passed,
    hasCounts: passed !== null || failed !== null,
    framework: textOrNull(run.framework),
  };
}

export const hasFailedLastRun = (tests) => isRecord(tests) && isRecord(tests.lastRun) && tests.lastRun.isOk === false;
